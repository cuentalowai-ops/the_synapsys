import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';
import {
  createAuthorizationRequest,
  generateQRCode,
  handleCallback,
  validateGatacaVP,
  buildGatacaDeepLink,
} from '../services/GatacaWalletService';
import { createPresentationDefinition } from '../lib/presentationDefinition';

/**
 * Gataca Wallet Integration Endpoints
 * OpenID4VP flows with Gataca Vouch
 *
 * Compliance References:
 * - Gataca Vouch: https://docs.gataca.io/developers/technical-integration/gataca-vouch-integration
 * - OpenID4VP 1.0: Authorization flows
 * - eIDAS 2.0: EUDI Wallet integration
 */

const router = Router();

/**
 * POST /api/v1/gataca/authorize
 * Initiate authorization with Gataca Wallet
 */
router.post(
  '/authorize',
  async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Gataca authorization requested', { ip: req.ip });

      const { presentationDefinition } = req.body;

      // Use provided presentation definition or create default
      const pd =
        presentationDefinition ||
        createPresentationDefinition('gataca-default-' + Date.now(), [
          {
            id: 'identity_credential',
            name: 'Identity Credential',
            purpose: 'Verify your identity',
            credentialType: 'VerifiableCredential',
          },
        ]);

      // Create authorization request
      const authRequest = createAuthorizationRequest(pd);

      if (!authRequest.success || !authRequest.authorizationUrl) {
        res.status(500).json({
          error: 'authorization_failed',
          error_description:
            authRequest.error || 'Failed to create authorization request',
        });
        return;
      }

      // Generate QR code
      const qrResult = await generateQRCode(authRequest.authorizationUrl);

      // Build deep link for mobile
      const deepLink = buildGatacaDeepLink(authRequest.authorizationUrl);

      logger.info('Gataca authorization request created', {
        state: authRequest.state,
        hasQR: qrResult.success,
      });

      res.json({
        success: true,
        authorizationUrl: authRequest.authorizationUrl,
        deepLink,
        qrCode: qrResult.qrCode,
        state: authRequest.state,
        nonce: authRequest.nonce,
        expiresIn: 300, // 5 minutes
        sessionId: authRequest.state, // Use state as session ID
      });
    } catch (error) {
      logger.error('Gataca authorization endpoint error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to process Gataca authorization',
      });
    }
  }
);

/**
 * GET /api/v1/gataca/callback
 * Handle OAuth callback from Gataca Vouch
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error, error_description } = req.query;

    logger.info('Gataca callback received', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
    });

    // TODO: Retrieve expected state from session storage
    // For now, we accept any state (INSECURE - fix in production)
    const expectedState = state as string;

    // Handle callback
    const callbackResult = await handleCallback(
      {
        code: code as string,
        state: state as string,
        error: error as string,
        error_description: error_description as string,
      },
      expectedState
    );

    if (!callbackResult.success) {
      res.status(400).json({
        error: 'callback_failed',
        error_description:
          callbackResult.error || 'Failed to process callback',
      });
      return;
    }

    // Validate VP token
    if (callbackResult.vpToken) {
      const vpValidation = await validateGatacaVP(callbackResult.vpToken);

      if (!vpValidation.valid) {
        res.status(400).json({
          error: 'vp_validation_failed',
          error_description:
            vpValidation.error || 'VP token validation failed',
        });
        return;
      }

      logger.info('Gataca callback processed successfully', {
        state,
        hasVP: true,
      });

      res.json({
        success: true,
        message: 'Gataca authorization completed',
        claims: vpValidation.claims,
      });
    } else {
      res.json({
        success: true,
        message: 'Authorization completed (no VP token)',
        tokens: callbackResult.tokens,
      });
    }
  } catch (error) {
    logger.error('Gataca callback endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to process Gataca callback',
    });
  }
});

/**
 * POST /api/v1/gataca/verify
 * Verify a VP token from Gataca
 */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { vpToken } = req.body;

    if (!vpToken) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing vpToken parameter',
      });
      return;
    }

    logger.info('Gataca VP verification requested');

    const validation = await validateGatacaVP(vpToken);

    if (!validation.valid) {
      res.status(400).json({
        error: 'vp_invalid',
        error_description: validation.error || 'VP token is invalid',
      });
      return;
    }

    logger.info('Gataca VP verified successfully');

    res.json({
      success: true,
      valid: true,
      claims: validation.claims,
    });
  } catch (error) {
    logger.error('Gataca verify endpoint error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to verify Gataca VP',
    });
  }
});

export default router;
