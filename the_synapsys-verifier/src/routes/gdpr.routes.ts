import { Router, Request, Response } from 'express';
import { authenticateRPMiddleware } from '../middleware/authMiddleware';
import { pool } from '../config/database';
import { logAuditEvent } from '../services/AuditLogger';
import { logger } from '../config/logger';

/**
 * GDPR Data Subject Rights Endpoints
 * Implements fundamental rights for data protection
 *
 * Compliance References:
 * - GDPR Article 15: Right to access by the data subject
 * - GDPR Article 17: Right to erasure ("right to be forgotten")
 * - GDPR Article 20: Right to data portability
 * - ISO 27001 A.18.1.4: Privacy and protection of PII
 */

const router = Router();

/**
 * GET /api/v1/gdpr/export
 * GDPR Article 15 - Right to Access
 * Export all data associated with the Relying Party
 */
router.get(
  '/export',
  authenticateRPMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rpId = req.rp?.id;

      if (!rpId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      logger.info('GDPR data export requested', { rpId });

      // Gather all RP data
      const rpData = await pool.query(
        'SELECT id, name, client_id, callback_url, allowed_origins, status, created_at, updated_at, last_used_at FROM relying_parties WHERE id = $1',
        [rpId]
      );

      const sessions = await pool.query(
        'SELECT session_id, created_at, completed_at, success FROM rp_verification_sessions WHERE rp_id = $1 ORDER BY created_at DESC',
        [rpId]
      );

      const apiKeys = await pool.query(
        'SELECT id, name, status, created_at, last_used_at, expires_at FROM api_keys WHERE rp_id = $1',
        [rpId]
      );

      const exportData = {
        relying_party: rpData.rows[0],
        verification_sessions: sessions.rows,
        api_keys: apiKeys.rows.map((key) => ({
          id: key.id,
          name: key.name,
          status: key.status,
          created_at: key.created_at,
          last_used_at: key.last_used_at,
          expires_at: key.expires_at,
          // NOTE: key_hash is NOT exported (security)
        })),
        export_timestamp: new Date().toISOString(),
        gdpr_notice: 'Data exported under GDPR Article 15 - Right to Access',
      };

      // Log GDPR request in audit trail
      await logAuditEvent({
        eventType: 'gdpr_data_export',
        actor: rpId,
        action: 'export_personal_data',
        result: 'success',
        metadata: {
          gdpr_article: 'Article 15',
          records_exported: {
            sessions: sessions.rows.length,
            api_keys: apiKeys.rows.length,
          },
        },
      });

      res.json({
        success: true,
        data: exportData,
      });
    } catch (error) {
      logger.error('GDPR data export failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        error: 'export_failed',
        error_description: 'Failed to export data',
      });
    }
  }
);

/**
 * POST /api/v1/gdpr/delete
 * GDPR Article 17 - Right to Erasure
 * Mark RP account for deletion (soft delete with 30-day retention)
 */
router.post(
  '/delete',
  authenticateRPMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rpId = req.rp?.id;
      const { confirmation } = req.body;

      if (!rpId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      // Require explicit confirmation to prevent accidental deletions
      if (confirmation !== 'DELETE_MY_DATA') {
        res.status(400).json({
          error: 'confirmation_required',
          error_description: 'Send { "confirmation": "DELETE_MY_DATA" } to confirm deletion',
        });
        return;
      }

      logger.warn('GDPR data deletion requested', { rpId });

      // Soft delete: Set status to 'deleted' (maintains audit trail)
      await pool.query('UPDATE relying_parties SET status = $1, updated_at = NOW() WHERE id = $2', [
        'deleted',
        rpId,
      ]);

      // Revoke all API keys
      await pool.query('UPDATE api_keys SET status = $1 WHERE rp_id = $2', ['revoked', rpId]);

      // Log deletion in audit trail (MUST be preserved per eIDAS)
      await logAuditEvent({
        eventType: 'gdpr_data_deletion',
        actor: rpId,
        action: 'delete_rp_account',
        result: 'success',
        metadata: {
          gdpr_article: 'Article 17 - Right to Erasure',
          retention_period: '30 days for audit compliance',
        },
      });

      res.json({
        success: true,
        message:
          'Account marked for deletion. Data will be purged after 30-day retention period (audit compliance).',
        deletion_effective_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      logger.error('GDPR data deletion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        error: 'deletion_failed',
        error_description: 'Failed to process deletion request',
      });
    }
  }
);

export default router;
