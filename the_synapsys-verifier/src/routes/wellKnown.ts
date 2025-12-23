import { Request, Response, Router } from 'express';
import { logger } from '../config/logger';
import { getTrustAnchors } from '../services/TrustResolver';

/**
 * OpenID4VP Discovery Endpoint
 * Provides verifier metadata for wallets
 *
 * Compliance References:
 * - OpenID4VP 1.0 Section 8: Verifier Metadata
 * - RFC 8414: OAuth 2.0 Authorization Server Metadata
 * - EUDI ARF 1.4.0: Verifier discovery requirements
 *
 * Standards Alignment:
 * Based on OpenID4VP specification discovery mechanism
 */

const router = Router();

/**
 * GET /.well-known/openid4vp-configuration
 * Returns verifier metadata
 */
router.get('/openid4vp-configuration', (req: Request, res: Response) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Get active trust anchors
    const trustAnchors = getTrustAnchors({
      enableMockTrustAnchors: true,
      enableEBSI: false,
      enableEUDILaunchpad: false,
    });

    const metadata = {
      // Issuer identifier
      issuer: baseUrl,

      // Authorization endpoint
      authorization_endpoint: `${baseUrl}/authorize`,

      // Response types supported
      response_types_supported: ['vp_token'],

      // Response modes supported
      response_modes_supported: ['direct_post', 'direct_post.jwt'],

      // VP formats supported (W3C VC, SD-JWT VC, ISO mDL)
      vp_formats_supported: {
        jwt_vp: {
          alg_values_supported: ['RS256', 'ES256', 'ES256K', 'EdDSA'],
        },
        jwt_vc: {
          alg_values_supported: ['RS256', 'ES256', 'ES256K', 'EdDSA'],
        },
        'vc+sd-jwt': {
          alg_values_supported: ['ES256', 'EdDSA'],
          kb_jwt_alg_values_supported: ['ES256', 'EdDSA'],
        },
        mso_mdoc: {
          alg_values_supported: ['ES256', 'EdDSA'],
        },
      },

      // Presentation definition formats supported
      presentation_definition_formats_supported: {
        jwt_vp: {
          alg: ['RS256', 'ES256', 'ES256K', 'EdDSA'],
        },
        jwt_vc: {
          alg: ['RS256', 'ES256', 'ES256K', 'EdDSA'],
        },
      },

      // Client ID schemes
      client_id_schemes_supported: ['redirect_uri', 'did', 'x509_san_dns', 'x509_san_uri'],

      // Trust frameworks
      trust_frameworks_supported: ['ebsi', 'eudi_launchpad', 'national'],

      // Trust anchors
      trust_anchors: trustAnchors.map((anchor) => ({
        did: anchor.did,
        name: anchor.name,
        framework: anchor.trustFramework,
      })),

      // Service endpoints
      direct_post_endpoint: `${baseUrl}/direct_post`,

      // Authorization server metadata
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],

      // Conformance
      specification_version: '1.0',
      compliant_with: [
        'OpenID4VP 1.0',
        'DIF Presentation Exchange v2.0.0',
        'W3C VC Data Model 1.1',
        'eIDAS 2.0 Annex VI ARF 1.4.0',
      ],

      // Additional metadata
      service_documentation: `${baseUrl}/docs`,
      contact: ['support@synapsys.example'],
    };

    logger.info('OpenID4VP metadata requested', { ip: req.ip });

    res.json(metadata);
  } catch (error) {
    logger.error('Failed to generate OpenID4VP metadata', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to generate verifier metadata',
    });
  }
});

/**
 * GET /.well-known/did-configuration.json
 * DID Configuration resource (optional, for did:web support)
 */
router.get('/did-configuration.json', (req: Request, res: Response) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const domain = req.get('host');

    // TODO: Generate actual DID for this verifier
    const verifierDID = `did:web:${domain}`;

    const didConfiguration = {
      '@context': 'https://identity.foundation/.well-known/did-configuration/v1',
      linked_dids: [
        {
          did: verifierDID,
          // TODO: Add Domain Linkage Credential (JWT)
          // This proves ownership of the domain
        },
      ],
    };

    logger.info('DID configuration requested', { did: verifierDID });

    res.json(didConfiguration);
  } catch (error) {
    logger.error('Failed to generate DID configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to generate DID configuration',
    });
  }
});

export default router;
