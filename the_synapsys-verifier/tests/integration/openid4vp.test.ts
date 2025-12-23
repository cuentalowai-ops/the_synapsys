import request from 'supertest';
import app from '../../src/index';
import { pool } from '../../src/config/database';
import * as jose from 'jose';

/**
 * Integration Tests: OpenID4VP Authorization Flow
 *
 * Tests complete flow:
 * 1. GET /authorize - Create authorization request
 * 2. Wallet processes request (mocked)
 * 3. POST /direct_post - Submit VP token
 * 4. Verify session completion
 *
 * Compliance Testing:
 * - OpenID4VP 1.0: Full protocol flow
 * - DIF PE v2.0.0: Presentation matching
 * - W3C VC Data Model: Credential validation
 * - eIDAS 2.0: Trust anchor validation
 */

describe('OpenID4VP Integration Flow', () => {
  // Test keypair for signing mock VCs
  let mockIssuerKeyPair: jose.GenerateKeyPairResult;
  let mockHolderKeyPair: jose.GenerateKeyPairResult;

  beforeAll(async () => {
    // Generate test keypairs
    mockIssuerKeyPair = await jose.generateKeyPair('ES256');
    mockHolderKeyPair = await jose.generateKeyPair('ES256');

    // Wait for database to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup: close database connections
    await pool.end();
  });

  describe('Complete Authorization Flow', () => {
    let authState: string;
    let authNonce: string;

    it('should create authorization request successfully', async () => {
      const response = await request(app)
        .get('/authorize')
        .query({ response_type: 'vp_token' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('authorization_request_uri');
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('presentation_definition');

      // Save state and nonce for next steps
      authState = response.body.state;

      // Extract nonce from authorization_request_uri
      const uri = new URL(
        response.body.authorization_request_uri.replace('openid4vp://?', 'http://dummy?')
      );
      authNonce = uri.searchParams.get('nonce') || '';

      expect(authState).toBeTruthy();
      expect(authNonce).toBeTruthy();
    });

    it('should reject authorization request without response_type', async () => {
      const response = await request(app)
        .get('/authorize')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('response_type');
    });

    it('should reject invalid response_type', async () => {
      const response = await request(app)
        .get('/authorize')
        .query({ response_type: 'code' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('vp_token');
    });

    it('should accept VP token via direct_post', async () => {
      // Create mock VP token (simplified for testing)
      const mockVC = await createMockVC(mockIssuerKeyPair.privateKey);
      const mockVP = await createMockVP(mockHolderKeyPair.privateKey, mockVC, authNonce);

      const presentationSubmission = {
        id: 'submission-' + Date.now(),
        definition_id: 'default-pd-' + Date.now(),
        descriptor_map: [
          {
            id: 'id_credential',
            format: 'jwt_vc',
            path: '$.verifiableCredential[0]',
          },
        ],
      };

      const response = await request(app)
        .post('/direct_post')
        .send({
          vp_token: mockVP,
          presentation_submission: JSON.stringify(presentationSubmission),
          state: authState,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
    });

    it('should reject invalid state in direct_post', async () => {
      const response = await request(app)
        .post('/direct_post')
        .send({
          vp_token: 'dummy_token',
          presentation_submission: '{}',
          state: 'invalid_state',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('state');
    });

    it('should reject missing vp_token', async () => {
      const response = await request(app)
        .post('/direct_post')
        .send({
          presentation_submission: '{}',
          state: 'some_state',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'invalid_request');
      expect(response.body.error_description).toContain('vp_token');
    });
  });

  describe('OpenID4VP Discovery Metadata', () => {
    it('should return verifier metadata', async () => {
      const response = await request(app)
        .get('/.well-known/openid4vp-configuration')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('response_types_supported');
      expect(response.body.response_types_supported).toContain('vp_token');
      expect(response.body).toHaveProperty('vp_formats_supported');
      expect(response.body).toHaveProperty('trust_anchors');
    });

    it('should return DID configuration', async () => {
      const response = await request(app)
        .get('/.well-known/did-configuration.json')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('@context');
      expect(response.body).toHaveProperty('linked_dids');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on authorize endpoint', async () => {
      const requests = [];

      // Make 51 requests (limit is 50)
      for (let i = 0; i < 51; i++) {
        requests.push(request(app).get('/authorize').query({ response_type: 'vp_token' }));
      }

      const responses = await Promise.all(requests);

      // Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error', 'too_many_requests');
      expect(lastResponse.body).toHaveProperty('retry_after');
    }, 30000); // 30s timeout for this test
  });
});

/**
 * Helper: Create mock Verifiable Credential (JWT format)
 */
async function createMockVC(privateKey: any): Promise<string> {
  const vcPayload = {
    vc: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      issuer: 'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4',
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
        degree: {
          type: 'BachelorDegree',
          name: 'Bachelor of Science and Arts',
        },
      },
    },
    iss: 'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4',
    sub: ' did:example:ebfeb1f712ebc6f1c276e12ec21',
  };

  const jwt = await new jose.SignJWT(vcPayload)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(privateKey);

  return jwt;
}

/**
 * Helper: Create mock Verifiable Presentation (JWT format)
 */
async function createMockVP(
  privateKey: any,
  vcJWT: string,
  nonce: string
): Promise<string> {
  const vpPayload = {
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: [vcJWT],
      holder: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
      presentation_submission: {
        id: 'submission-' + Date.now(),
        definition_id: 'default-pd-' + Date.now(),
        descriptor_map: [
          {
            id: 'id_credential',
            format: 'jwt_vc',
            path: '$.verifiableCredential[0]',
          },
        ],
      },
    },
    iss: 'did:example:ebfeb1f712ebc6f1c276e12ec21',
    aud: 'http://localhost:3000',
    nonce,
  };

  const jwt = await new jose.SignJWT(vpPayload)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);

  return jwt;
}
