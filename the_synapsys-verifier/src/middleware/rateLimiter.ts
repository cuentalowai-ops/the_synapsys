import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

/**
 * Rate Limiting Middleware
 * Protects against DoS attacks and ensures service availability
 *
 * Compliance References:
 * - NIS2 Directive (EU 2022/2555): Security measures for network services
 * - ISO 27001 A.14.2.7: Protection against Denial of Service
 * - eIDAS 2.0 Art. 64: Service availability requirements
 *
 * Implementation Notes:
 * - In-memory store for MVP (replace with Redis for production)
 * - Configurable per-endpoint limits
 * - IP-based tracking
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    firstRequest: number;
    lastRequest: number;
  };
}

const requestStore: RateLimitStore = {};

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Default rate limit configurations per endpoint
 */
export const RATE_LIMITS = {
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 min
  },
  authorize: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50, // Stricter for authorization
  },
  directPost: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50,
  },
  health: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // Allow monitoring tools
  },
};

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = getClientIP(req);
    const key = `${clientIP}:${req.path}`;

    const now = Date.now();
    const record = requestStore[key];

    // Initialize or reset window
    if (!record || now - record.firstRequest > config.windowMs) {
      requestStore[key] = {
        count: 1,
        firstRequest: now,
        lastRequest: now,
      };
      next();
      return;
    }

    // Increment count
    record.count += 1;
    record.lastRequest = now;

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      const retryAfter = Math.ceil((record.firstRequest + config.windowMs - now) / 1000);

      logger.warn('Rate limit exceeded', {
        ip: clientIP,
        path: req.path,
        count: record.count,
        limit: config.maxRequests,
        retryAfter,
      });

      res.status(429).json({
        error: 'too_many_requests',
        error_description:
          config.message ||
          `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${Math.floor(config.windowMs / 1000)} seconds.`,
        retry_after: retryAfter,
      });
      return;
    }

    // Add rate limit headers (informational)
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (config.maxRequests - record.count).toString());
    res.setHeader(
      'X-RateLimit-Reset',
      Math.ceil((record.firstRequest + config.windowMs) / 1000).toString()
    );

    next();
  };
}

/**
 * Get client IP address from request
 * Handles various proxy headers
 */
function getClientIP(req: Request): string {
  // Check X-Forwarded-For header (proxy/load balancer)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }

  // Fallback to socket remote address
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Periodic cleanup of old rate limit records
 * Call this with setInterval in production
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const maxAge = Math.max(...Object.values(RATE_LIMITS).map((rl) => rl.windowMs));

  let cleaned = 0;

  for (const key in requestStore) {
    if (now - requestStore[key].lastRequest > maxAge) {
      delete requestStore[key];
      cleaned += 1;
    }
  }

  if (cleaned > 0) {
    logger.debug('Rate limit store cleaned', { recordsCleaned: cleaned });
  }
}

/**
 * Get current rate limit status for debugging
 */
export function getRateLimitStats(): {
  totalKeys: number;
  activeRequests: number;
} {
  const totalKeys = Object.keys(requestStore).length;
  const activeRequests = Object.values(requestStore).reduce((sum, record) => sum + record.count, 0);

  return { totalKeys, activeRequests };
}

/**
 * Clear all rate limit records (for testing)
 */
export function clearRateLimitStore(): void {
  Object.keys(requestStore).forEach((key) => {
    delete requestStore[key];
  });
  logger.info('Rate limit store cleared');
}
