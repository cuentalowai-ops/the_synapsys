import { logger } from '../config/logger';
import * as jose from 'jose';

/**
 * Trust Resolver Service
 * Resolves DIDs and validates trust anchors for credential issuers
 *
 * Compliance References:
 * - eIDAS 2.0 Art. 45a: Trust framework for qualified attestation providers
 * - W3C DID Core Spec: https://www.w3.org/TR/did-core/
 * - EBSI DID Method: https://ec.europa.eu/digital-building-blocks/wikis/display/EBSI
 * - EUDI ARF 1.4.0 Section 5: Trust Model
 *
 * Standards Alignment:
 * Based on eu-digital-identity-wallet ARF trust model
 * Compatible with EBSI Trust Chain validation
 */

export interface DIDDocument {
  '@context': string | string[];
  id: string; // DID identifier
  controller?: string | string[];
  verificationMethod?: VerificationMethod[];
  authentication?: Array<string | VerificationMethod>;
  assertionMethod?: Array<string | VerificationMethod>;
  keyAgreement?: Array<string | VerificationMethod>;
  capabilityInvocation?: Array<string | VerificationMethod>;
  capabilityDelegation?: Array<string | VerificationMethod>;
  service?: ServiceEndpoint[];
}

export interface VerificationMethod {
  id: string;
  type: string; // e.g., "JsonWebKey2020", "Ed25519VerificationKey2020"
  controller: string;
  publicKeyJwk?: jose.JWK;
  publicKeyMultibase?: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string | string[];
}

export interface TrustAnchor {
  did: string;
  name: string;
  trustFramework: 'EBSI' | 'EUDI_LAUNCHPAD' | 'NATIONAL' | 'CUSTOM';
  status: 'active' | 'suspended' | 'revoked';
  validFrom: Date;
  validUntil?: Date;
  metadata?: Record<string, unknown>;
}

export interface TrustResolverConfig {
  enableEBSI: boolean;
  enableEUDILaunchpad: boolean;
  enableMockTrustAnchors: boolean;
  ebsiEndpoint?: string;
  eudiLaunchpadEndpoint?: string;
  cacheTTL?: number; // seconds
}

/**
 * In-memory cache for DID documents and trust anchors
 * Production: Replace with Redis
 */
const didCache = new Map<string, { document: DIDDocument; timestamp: number }>();
const trustAnchorCache = new Map<string, { anchor: TrustAnchor; timestamp: number }>();

const DEFAULT_CACHE_TTL = 3600; // 1 hour

/**
 * Mock trust anchors for MVP testing
 * Based on EUDI ARF Section 5.2 Trust Model
 */
const MOCK_TRUST_ANCHORS: TrustAnchor[] = [
  {
    did: 'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4',
    name: 'European Commission - EBSI Root',
    trustFramework: 'EBSI',
    status: 'active',
    validFrom: new Date('2024-01-01'),
    validUntil: new Date('2029-12-31'),
    metadata: {
      country: 'EU',
      type: 'root_ca',
    },
  },
  {
    did: 'did:web:identity.foundation',
    name: 'Decentralized Identity Foundation',
    trustFramework: 'CUSTOM',
    status: 'active',
    validFrom: new Date('2023-01-01'),
  },
];

/**
 * Mock DID documents for testing
 * Format aligned with W3C DID Core v1.0
 */
const MOCK_DID_DOCUMENTS: Record<string, DIDDocument> = {
  'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4': {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
    id: 'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4',
    verificationMethod: [
      {
        id: 'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4#keys-1',
        type: 'JsonWebKey2020',
        controller: 'did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4',
        publicKeyJwk: {
          kty: 'EC',
          crv: 'P-256',
          x: 'jJ2Eqk0u2pCv7dV0RW8bRJ9VGM3LqK4KZS8nU5XhGqo',
          y: 'F2mT_q0H3Jt9YP8wKX7ZmN6RqJ5VbT3nZ8fH2gL9XqM',
        },
      },
    ],
    assertionMethod: ['did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4#keys-1'],
    authentication: ['did:ebsi:znxntxQrN3Xqe7RGTd3KQJ4#keys-1'],
  },
};

/**
 * Resolve a DID to its DID Document
 * Implements W3C DID Resolution spec
 */
export async function resolveDID(
  did: string,
  config: TrustResolverConfig = {
    enableMockTrustAnchors: true,
    enableEBSI: false,
    enableEUDILaunchpad: false,
  }
): Promise<{ success: boolean; document?: DIDDocument; error?: string }> {
  try {
    logger.info('Resolving DID', { did });

    // Check cache first
    const cached = didCache.get(did);
    const now = Date.now();
    const ttl = (config.cacheTTL || DEFAULT_CACHE_TTL) * 1000;

    if (cached && now - cached.timestamp < ttl) {
      logger.debug('DID resolved from cache', { did });
      return { success: true, document: cached.document };
    }

    // Determine DID method
    const method = did.split(':')[1];

    let document: DIDDocument | undefined;

    // Mock resolution for MVP
    if (config.enableMockTrustAnchors) {
      document = MOCK_DID_DOCUMENTS[did];
      if (document) {
        didCache.set(did, { document, timestamp: now });
        logger.info('DID resolved (mock)', { did, method });
        return { success: true, document };
      }
    }

    // EBSI DID resolution
    if (config.enableEBSI && method === 'ebsi') {
      const result = await resolveEBSIDID(did, config.ebsiEndpoint);
      if (result.success && result.document) {
        didCache.set(did, { document: result.document, timestamp: now });
        return result;
      }
    }

    // did:web resolution (simple HTTP fetch)
    if (method === 'web') {
      const result = await resolveWebDID(did);
      if (result.success && result.document) {
        didCache.set(did, { document: result.document, timestamp: now });
        return result;
      }
    }

    logger.warn('DID resolution failed', { did, method });
    return { success: false, error: `Unsupported DID method or DID not found: ${method}` };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DID resolution error', { did, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Resolve EBSI DID
 * Reference: EBSI DID Method Specification
 * https://ec.europa.eu/digital-building-blocks/wikis/display/EBSI/DID+Method
 */
async function resolveEBSIDID(
  did: string,
  endpoint?: string
): Promise<{ success: boolean; document?: DIDDocument; error?: string }> {
  const apiEndpoint = endpoint || 'https://api-pilot.ebsi.eu/did-registry/v4/identifiers';
  const url = `${apiEndpoint}/${encodeURIComponent(did)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `EBSI API error: ${response.status}`,
      };
    }

    const document = (await response.json()) as DIDDocument;
    logger.info('EBSI DID resolved', { did });
    return { success: true, document };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('EBSI DID resolution failed', { did, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Resolve did:web DID
 * Reference: W3C DID Method Web
 * https://w3c-ccg.github.io/did-method-web/
 */
async function resolveWebDID(
  did: string
): Promise<{ success: boolean; document?: DIDDocument; error?: string }> {
  try {
    // did:web:example.com:user:alice → https://example.com/user/alice/did.json
    const parts = did.split(':');
    if (parts.length < 3) {
      return { success: false, error: 'Invalid did:web format' };
    }

    const domain = parts[2];
    const path = parts.slice(3).join('/');
    const url = `https://${domain}${path ? '/' + path : ''}/.well-known/did.json`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const document = (await response.json()) as DIDDocument;
    logger.info('did:web resolved', { did, url });
    return { success: true, document };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('did:web resolution failed', { did, error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if a DID is in the trust anchor list
 * Implements eIDAS 2.0 Art. 45a trust validation
 */
export async function isTrustedIssuer(
  did: string,
  config: TrustResolverConfig = {
    enableMockTrustAnchors: true,
    enableEBSI: false,
    enableEUDILaunchpad: false,
  }
): Promise<{ trusted: boolean; anchor?: TrustAnchor; reason?: string }> {
  try {
    logger.info('Checking trust anchor', { did });

    // Check cache
    const cached = trustAnchorCache.get(did);
    const now = Date.now();
    const ttl = (config.cacheTTL || DEFAULT_CACHE_TTL) * 1000;

    if (cached && now - cached.timestamp < ttl) {
      const isValid =
        cached.anchor.status === 'active' &&
        (!cached.anchor.validUntil || cached.anchor.validUntil > new Date());

      return {
        trusted: isValid,
        anchor: cached.anchor,
        reason: isValid ? 'Trusted anchor (cached)' : 'Anchor expired or revoked',
      };
    }

    // Check mock trust anchors
    if (config.enableMockTrustAnchors) {
      const mockAnchor = MOCK_TRUST_ANCHORS.find((a) => a.did === did);
      if (mockAnchor) {
        trustAnchorCache.set(did, { anchor: mockAnchor, timestamp: now });

        const isValid =
          mockAnchor.status === 'active' &&
          (!mockAnchor.validUntil || mockAnchor.validUntil > new Date());

        logger.info('Trust anchor checked (mock)', { did, trusted: isValid });
        return {
          trusted: isValid,
          anchor: mockAnchor,
          reason: isValid ? 'Trusted anchor (mock)' : 'Anchor expired or revoked',
        };
      }
    }

    // TODO: Check EBSI Trust Registry (Week 4)
    // TODO: Check EUDI Launchpad Trust List (Week 4)

    logger.info('DID not in trust anchors', { did });
    return { trusted: false, reason: 'Not in trust anchor list' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Trust anchor check error', { did, error: errorMessage });
    return { trusted: false, reason: `Error: ${errorMessage}` };
  }
}

/**
 * Get all active trust anchors
 */
export function getTrustAnchors(
  config: TrustResolverConfig = {
    enableMockTrustAnchors: true,
    enableEBSI: false,
    enableEUDILaunchpad: false,
  }
): TrustAnchor[] {
  if (config.enableMockTrustAnchors) {
    return MOCK_TRUST_ANCHORS.filter((a) => a.status === 'active');
  }
  return [];
}

/**
 * Clear all caches (useful for testing)
 */
export function clearTrustCaches(): void {
  didCache.clear();
  trustAnchorCache.clear();
  logger.info('Trust resolver caches cleared');
}
