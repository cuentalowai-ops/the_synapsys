import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing for frontend access
 *
 * Compliance References:
 * - OWASP: CORS Security Best Practices
 * - ISO 27001 A.14.1.2: Securing application services
 * - eIDAS 2.0 Art. 64: Security measures
 *
 * Configuration:
 * - Whitelist approach (explicit origins)
 * - Credentials support for cookies/auth
 * - Preflight caching for performance
 */

export interface CORSConfig {
  allowedOrigins: string[];
  allowCredentials?: boolean;
  maxAge?: number; // Preflight cache duration (seconds)
  exposedHeaders?: string[];
}

/**
 * Default CORS configuration
 * Update allowedOrigins in production with actual frontend domains
 */
const DEFAULT_CONFIG: CORSConfig = {
  allowedOrigins: [
    'http://localhost:5173', // Vite dev server (dashboard)
    'http://localhost:3001', // Next.js dev server (website)
    'http://localhost:4173', // Vite preview
    // Production origins (add via environment variables)
    ...(process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || []),
  ],
  allowCredentials: true,
  maxAge: 86400, // 24 hours
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
};

/**
 * Create CORS middleware with custom configuration
 */
export function createCORSMiddleware(config: CORSConfig = DEFAULT_CONFIG) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    const isAllowedOrigin =
      origin &&
      config.allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        if (allowed.endsWith('*')) {
          const baseOrigin = allowed.slice(0, -1);
          return origin.startsWith(baseOrigin);
        }
        return origin === allowed;
      });

    // Set CORS headers
    if (isAllowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);

      if (config.allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Exposed headers (for rate limiting info)
      if (config.exposedHeaders && config.exposedHeaders.length > 0) {
        res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
      }
    } else {
      // Log rejected origin for security monitoring
      if (origin) {
        logger.warn('CORS: Origin not allowed', { origin, path: req.path });
      }
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );

      if (config.maxAge) {
        res.setHeader('Access-Control-Max-Age', config.maxAge.toString());
      }

      // Preflight successful
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Default CORS middleware export
 */
export const corsMiddleware = createCORSMiddleware(DEFAULT_CONFIG);
