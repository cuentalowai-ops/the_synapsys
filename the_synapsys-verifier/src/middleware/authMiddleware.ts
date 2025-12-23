import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import {
  authenticateRP as verifyRPCredentials,
  validateAPIKey as verifyAPIKey,
  type RelyingParty,
} from '../services/OAuthService';

/**
 * Authentication Middleware for Relying Party APIs
 * Supports both OAuth 2.0 client credentials and API key authentication
 *
 * Compliance References:
 * - OAuth 2.0 RFC 6749: Client authentication
 * - RFC 6750: Bearer Token Usage
 * - OWASP: Authentication best practices
 * - ISO 27001 A.9.2: User access management
 */

// Extend Express Request to include authenticated RP
declare global {
  namespace Express {
    interface Request {
      rp?: RelyingParty;
    }
  }
}

/**
 * Authenticate Relying Party using Bearer token or Basic auth
 * Checks Authorization header: "Bearer <api_key>" or "Basic <base64(client_id:client_secret)>"
 */
export async function authenticateRPMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing Authorization header',
      });
      return;
    }

    // Parse authorization header
    const [scheme, credentials] = authHeader.split(' ');

    if (!scheme || !credentials) {
      res.status(401).json({
        error: 'invalid_request',
        error_description: 'Invalid Authorization header format',
      });
      return;
    }

    let rp: RelyingParty | undefined;

    // Method 1: Bearer token (API Key)
    if (scheme.toLowerCase() === 'bearer') {
      const validation = await verifyAPIKey(credentials);

      if (!validation.valid || !validation.rp) {
        logger.warn('API key authentication failed', { ip: req.ip });
        res.status(401).json({
          error: 'invalid_token',
          error_description: validation.error || 'Invalid or expired API key',
        });
        return;
      }

      rp = validation.rp;
    }
    // Method 2: Basic auth (OAuth client credentials)
    else if (scheme.toLowerCase() === 'basic') {
      const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
      const [clientId, clientSecret] = decoded.split(':');

      if (!clientId || !clientSecret) {
        res.status(401).json({
          error: 'invalid_request',
          error_description: 'Invalid Basic auth format',
        });
        return;
      }

      const auth = await verifyRPCredentials(clientId, clientSecret);

      if (!auth.success || !auth.rp) {
        logger.warn('OAuth authentication failed', { clientId, ip: req.ip });
        res.status(401).json({
          error: 'invalid_client',
          error_description: auth.error || 'Invalid client credentials',
        });
        return;
      }

      rp = auth.rp;
    } else {
      res.status(401).json({
        error: 'invalid_request',
        error_description: 'Unsupported authorization scheme. Use Bearer or Basic',
      });
      return;
    }

    // Attach RP to request
    req.rp = rp;

    logger.info('RP authenticated successfully', {
      rpId: rp.id,
      rpName: rp.name,
      method: scheme.toLowerCase(),
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Authentication failed',
    });
  }
}

/**
 * Validate Bearer token (API key) only
 * Lightweight middleware for API key-only authentication
 */
export async function validateBearerToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing or invalid Bearer token',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    const validation = await verifyAPIKey(token);

    if (!validation.valid || !validation.rp) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: validation.error || 'Invalid API key',
      });
      return;
    }

    req.rp = validation.rp;

    next();
  } catch (error) {
    logger.error('Bearer token validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      error: 'server_error',
      error_description: 'Token validation failed',
    });
  }
}

/**
 * Check if authenticated RP has specific permission (future extensibility)
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.rp) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Authentication required',
      });
      return;
    }

    // TODO: Implement role-based access control (RBAC)
    // For now, all authenticated RPs have all permissions

    logger.debug('Permission check passed', {
      rpId: req.rp.id,
      permission,
    });

    next();
  };
}
