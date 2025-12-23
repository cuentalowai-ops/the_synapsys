/**
 * the_synapsys EUDI Wallet Relying Party - Main Application Entry Point
 *
 * Compliance References:
 * - eIDAS 2.0 Art. 45: Requirements for qualified electronic signature creation devices
 * - eIDAS 2.0 Art. 64: Liability of trust service providers
 * - ISO 27001 A.12.4.1: Event logging
 * - GDPR Art. 5: Principles relating to processing of personal data
 *
 * This is a skeleton implementation establishing the basic server infrastructure
 * for an EUDI Wallet Relying Party backend service.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import logger from './config/logger';
import { initializeDatabase, testDatabaseConnection } from './config/database';
import { createRateLimiter, RATE_LIMITS, cleanupRateLimitStore } from './middleware/rateLimiter';
import { corsMiddleware } from './middleware/cors';
import { cleanupExpiredAuditLogs } from './services/AuditLogger';
import healthRouter from './routes/health';
import versionRouter from './routes/version';
import authorizeRouter from './routes/authorize';
import directPostRouter from './routes/directPost';
import wellKnownRouter from './routes/wellKnown';
import gdprRouter from './routes/gdpr.routes';
import walletsRouter from './routes/wallets.routes';
import gatacaRouter from './routes/gataca.routes';
import ootsRouter from './routes/oots.routes';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware); // CORS must be first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Routes with rate limiting
app.use('/health', createRateLimiter(RATE_LIMITS.health), healthRouter);
app.use('/version', versionRouter);
app.use('/authorize', createRateLimiter(RATE_LIMITS.authorize), authorizeRouter);
app.use('/direct_post', createRateLimiter(RATE_LIMITS.directPost), directPostRouter);
app.use('/.well-known', wellKnownRouter);
app.use('/api/v1/gdpr', gdprRouter);
app.use('/api/v1/wallets', walletsRouter);
app.use('/api/v1/gataca', gatacaRouter);
app.use('/api/v1/oots', createRateLimiter(RATE_LIMITS.authorize), ootsRouter);

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'the_synapsys EUDI Wallet Relying Party',
    description: 'Backend service for EUDI Wallet verification',
    endpoints: {
      health: '/health',
      version: '/version',
      authorize: '/authorize',
      direct_post: '/direct_post',
      metadata: '/.well-known/openid4vp-configuration',
      trust_anchors: '/.well-known/openid4vp-configuration',
      oots: '/api/v1/oots',
      wallets: '/api/v1/wallets',
      gataca: '/api/v1/gataca',
    },
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
  });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
  });
});

// Start server
if (require.main === module) {
  // Initialize database connection
  testDatabaseConnection()
    .then((connected) => {
      if (connected) {
        return initializeDatabase();
      }
      throw new Error('Database connection failed');
    })
    .then(() => {
      app.listen(PORT, () => {
        logger.info(`Server started on port ${PORT}`, {
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
        });

        // Start periodic cleanup tasks
        // Cleanup tasks every 15 minutes
        setInterval(
          () => {
            cleanupRateLimitStore();
            cleanupExpiredAuditLogs(3); // 3 year retention
          },
          15 * 60 * 1000
        );
      });
    })
    .catch((error) => {
      logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    });
}

export default app;
