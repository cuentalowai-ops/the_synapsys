/**
 * Version Endpoint
 *
 * Compliance References:
 * - eIDAS 2.0 Art. 45: Requirements for qualified electronic signature creation devices
 * - ISO 27001 A.12.4.1: Event logging for version tracking
 *
 * This endpoint provides version information for the EUDI Wallet Relying Party service.
 */

import { Request, Response, Router } from 'express';
import logger from '../config/logger';

const router = Router();

interface VersionResponse {
  name: string;
  version: string;
  description: string;
  compliance: {
    eidas2: string[];
    iso27001: string[];
    gdpr: string[];
  };
  nodeVersion: string;
  timestamp: string;
}

/**
 * GET /version
 * Returns version and compliance information
 */
router.get('/', (_req: Request, res: Response) => {
  const versionResponse: VersionResponse = {
    name: 'the-synapsys-verifier',
    version: '0.1.0',
    description: 'EUDI Wallet Relying Party Backend',
    compliance: {
      eidas2: ['Art. 45', 'Art. 64'],
      iso27001: ['A.12.4.1'],
      gdpr: ['Art. 5'],
    },
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };

  logger.info('Version information requested');

  res.status(200).json(versionResponse);
});

export default router;
