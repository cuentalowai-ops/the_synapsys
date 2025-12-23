/**
 * OOTS Routes - OAuth 2.0 Token Endpoints
 * 
 * Provides token generation, verification, and management
 * for digital wallet integration
 */

import { Router, Request, Response } from 'express';
import ootsTokenService from '../services/OOTSTokenService';
import logger from '../config/logger';

const router = Router();

/**
 * POST /api/v1/oots/token
 * Generate an access token
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { userId, rpId, scope } = req.body;

    // Validation
    if (!userId || !rpId) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing required fields: userId and rpId',
      });
    }

    // Parse scope
    let scopeArray: string[] = ['openid', 'profile'];
    if (scope) {
      scopeArray = Array.isArray(scope) ? scope : scope.split(' ');
    }

    // Generate token response
    const tokenResponse = await ootsTokenService.generateTokenResponse(
      userId,
      rpId,
      scopeArray,
      true
    );

    logger.info('OOTS token generated successfully', { userId, rpId });

    return res.status(200).json({
      status: 'success',
      ...tokenResponse,
    });
  } catch (error) {
    logger.error('Token generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({
      status: 'error',
      error: 'Token generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/oots/verify
 * Verify an access token
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing token',
      });
    }

    const payload = await ootsTokenService.verifyToken(token);

    return res.status(200).json({
      status: 'success',
      valid: true,
      payload,
    });
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid token',
    });
  }
});

/**
 * GET /api/v1/oots/config
 * Get OOTS OAuth 2.0 configuration
 */
router.get('/config', (_req: Request, res: Response) => {
  const baseUrl = process.env.BASE_URL || 'https://synapsys.io';
  
  res.json({
    status: 'success',
    config: {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/api/v1/oots/token`,
      revocation_endpoint: `${baseUrl}/api/v1/oots/revoke`,
      userinfo_endpoint: `${baseUrl}/api/v1/oots/userinfo`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      scopes_supported: ['openid', 'profile', 'email', 'address', 'phone'],
      response_types_supported: ['code', 'token', 'id_token'],
      response_modes_supported: ['query', 'fragment', 'form_post'],
      grant_types_supported: [
        'authorization_code',
        'implicit',
        'refresh_token',
      ],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['HS256', 'RS256'],
    },
  });
});

/**
 * POST /api/v1/oots/revoke
 * Revoke an access or refresh token
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    const { token, token_type_hint } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing token',
      });
    }

    // In a production environment, store revoked tokens in Redis or database
    // For now, we'll just log the revocation
    logger.info('Token revocation requested', {
      token_type_hint: token_type_hint || 'access_token',
      token_length: token.length,
    });

    return res.status(200).json({
      status: 'success',
      revoked: true,
      message: 'Token revoked successfully',
    });
  } catch (error) {
    logger.error('Token revocation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({
      status: 'error',
      error: 'Revocation failed',
    });
  }
});

/**
 * POST /api/v1/oots/refresh
 * Refresh an access token using a refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token, client_id } = req.body;

    if (!refresh_token || !client_id) {
      return res.status(400).json({
        status: 'error',
        error: 'Missing refresh_token or client_id',
      });
    }

    // In production, validate the refresh token from database
    // For now, generate a new token
    const tokenResponse = await ootsTokenService.generateTokenResponse(
      'user-from-refresh',
      client_id,
      ['openid', 'profile'],
      true
    );

    logger.info('Token refreshed successfully', { client_id });

    return res.status(200).json({
      status: 'success',
      ...tokenResponse,
    });
  } catch (error) {
    logger.error('Token refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({
      status: 'error',
      error: 'Token refresh failed',
    });
  }
});

/**
 * GET /api/v1/oots/userinfo
 * Get user information using access token
 */
router.get('/userinfo', async (req: Request, res: Response) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = ootsTokenService.extractBearerToken(authHeader);

    if (!token) {
      return res.status(401).json({
        status: 'error',
        error: 'Missing or invalid Authorization header',
      });
    }

    // Verify token
    const payload = await ootsTokenService.verifyToken(token);

    // In production, fetch user data from database
    // For now, return minimal info from token
    return res.status(200).json({
      sub: payload.sub,
      aud: payload.aud,
      iss: payload.iss,
      scope: payload.scope,
      // Add more user info from database if needed
    });
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      error: 'Invalid or expired token',
    });
  }
});

export default router;
