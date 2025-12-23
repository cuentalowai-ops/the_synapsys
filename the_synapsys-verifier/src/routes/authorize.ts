import { Request, Response, Router } from 'express';
import { logger } from '../config/logger';
import { createVPSession } from '../services/sessionService';
import {
  createPresentationDefinition,
  validatePresentationDefinition,
} from '../lib/presentationDefinition';

/**
 * OpenID4VP Authorization Endpoint
 * Implements authorization request handler according to OpenID4VP spec
 * https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
 */

const router = Router();

/**
 * GET /authorize
 * Initiates OpenID4VP authorization flow
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info('Authorization request received', {
      query: req.query,
      ip: req.ip,
    });

    // Extract query parameters
    const {
      response_type,
      client_id,
      redirect_uri,
      scope: _scope,
      state: _clientState,
      nonce: _clientNonce,
      presentation_definition,
      presentation_definition_uri,
    } = req.query;

    // Validate required parameters
    if (!response_type || response_type !== 'vp_token') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'response_type must be vp_token',
      });
    }

    // Get or create presentation definition
    let presentationDef;

    if (presentation_definition) {
      // Parse inline presentation definition
      try {
        presentationDef =
          typeof presentation_definition === 'string'
            ? JSON.parse(presentation_definition)
            : presentation_definition;

        const validation = validatePresentationDefinition(presentationDef);
        if (!validation.valid) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: `Invalid presentation_definition: ${validation.errors?.join(', ')}`,
          });
        }
      } catch (error) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid presentation_definition JSON',
        });
      }
    } else if (presentation_definition_uri) {
      // Fetch presentation definition from URI
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'presentation_definition_uri not yet supported',
      });
    } else {
      // Create default presentation definition
      presentationDef = createPresentationDefinition('default-pd-' + Date.now(), [
        {
          id: 'id_credential',
          name: 'Identity Credential',
          purpose: 'We need your identity credential',
          credentialType: 'VerifiableCredential',
        },
      ]);
    }

    // Create VP session
    const session = await createVPSession({
      presentation_definition: presentationDef,
      redirect_uri: redirect_uri as string | undefined,
      client_id: client_id as string | undefined,
      response_mode: 'direct_post',
      expiresInMinutes: 15,
    });

    // Build authorization request URI for wallet
    const authRequestUri = buildAuthorizationRequestUri(
      req,
      session.state,
      session.nonce,
      presentationDef
    );

    logger.info('Authorization request created', {
      sessionId: session.id,
      state: session.state,
      authRequestUri,
    });

    // Return authorization request as JSON (for API usage)
    // In production, this could redirect to a wallet or return a QR code
    return res.json({
      authorization_request_uri: authRequestUri,
      state: session.state,
      expires_in: 900, // 15 minutes
      presentation_definition: presentationDef,
    });
  } catch (error) {
    logger.error('Authorization request failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process authorization request',
    });
  }
});

/**
 * Build OpenID4VP authorization request URI
 */
function buildAuthorizationRequestUri(
  req: Request,
  state: string,
  nonce: string,
  presentationDefinition: Record<string, unknown>
): string {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const params = new URLSearchParams({
    response_type: 'vp_token',
    response_mode: 'direct_post',
    client_id: baseUrl,
    redirect_uri: `${baseUrl}/direct_post`,
    state,
    nonce,
    presentation_definition: JSON.stringify(presentationDefinition),
  });

  // Return as openid4vp:// URI scheme for wallet deep linking
  return `openid4vp://?${params.toString()}`;
}

export default router;
