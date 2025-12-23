/**
 * Health Check Endpoint
 *
 * Compliance References:
 * - ISO 27001 A.12.4.1: Event logging for system health monitoring
 *
 * This endpoint provides system health status for monitoring and availability checks.
 */

import { Request, Response, Router } from 'express';
import logger from '../config/logger';

const router = Router();

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
  uptime: number;
}

/**
 * GET /health
 * Returns the health status of the service
 */
router.get('/', (_req: Request, res: Response) => {
  const healthResponse: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'the-synapsys-verifier',
    uptime: process.uptime(),
  };

  logger.info('Health check performed', { status: healthResponse.status });

  res.status(200).json(healthResponse);
});

export default router;
