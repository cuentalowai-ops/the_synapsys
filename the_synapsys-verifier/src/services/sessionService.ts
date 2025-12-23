import { pool } from '../config/database';
import { logger } from '../config/logger';
import { PresentationDefinition } from '../lib/presentationDefinition';
import crypto from 'crypto';

/**
 * Session Management Service
 * Manages OpenID4VP authorization sessions in PostgreSQL
 */

export interface VPSession {
  id: string;
  state: string;
  nonce: string;
  presentation_definition: PresentationDefinition;
  redirect_uri?: string;
  client_id?: string;
  response_mode?: string;
  created_at: Date;
  expires_at: Date;
  status: 'pending' | 'completed' | 'expired' | 'failed';
  vp_token?: string;
  presentation_submission?: Record<string, unknown>;
  completed_at?: Date;
}

/**
 * Database row type
 */
interface DBRow {
  id: string;
  state: string;
  nonce: string;
  presentation_definition: string | Record<string, unknown>;
  redirect_uri?: string;
  client_id?: string;
  response_mode?: string;
  created_at: Date;
  expires_at: Date;
  status: string;
  vp_token?: string;
  presentation_submission?: string | Record<string, unknown>;
  completed_at?: Date;
}

/**
 * Map database row to VPSession object
 */
function mapRowToSession(row: DBRow): VPSession {
  return {
    id: row.id,
    state: row.state,
    nonce: row.nonce,
    presentation_definition:
      typeof row.presentation_definition === 'string'
        ? JSON.parse(row.presentation_definition)
        : row.presentation_definition,
    redirect_uri: row.redirect_uri,
    client_id: row.client_id,
    response_mode: row.response_mode,
    created_at: row.created_at,
    expires_at: row.expires_at,
    status: row.status as VPSession['status'],
    vp_token: row.vp_token,
    presentation_submission:
      row.presentation_submission && typeof row.presentation_submission === 'string'
        ? JSON.parse(row.presentation_submission)
        : row.presentation_submission,
    completed_at: row.completed_at,
  };
}

/**
 * Generate cryptographically secure random string
 */
function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: VPSession['status']
): Promise<boolean> {
  try {
    const result = await pool.query('UPDATE vp_sessions SET status = $1 WHERE id = $2', [
      status,
      sessionId,
    ]);

    return (result.rowCount || 0) > 0;
  } catch (error) {
    logger.error('Failed to update session status', {
      sessionId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Create a new VP session
 */
export async function createVPSession(params: {
  presentation_definition: PresentationDefinition;
  redirect_uri?: string;
  client_id?: string;
  response_mode?: string;
  expiresInMinutes?: number;
}): Promise<VPSession> {
  const state = generateSecureRandom(32);
  const nonce = generateSecureRandom(32);
  const expiresInMinutes = params.expiresInMinutes || 15; // Default 15 minutes

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  try {
    const result = await pool.query(
      `INSERT INTO vp_sessions 
       (state, nonce, presentation_definition, redirect_uri, client_id, response_mode, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        state,
        nonce,
        JSON.stringify(params.presentation_definition),
        params.redirect_uri,
        params.client_id,
        params.response_mode || 'direct_post',
        expiresAt,
      ]
    );

    const session = mapRowToSession(result.rows[0] as DBRow);

    logger.info('VP session created', {
      sessionId: session.id,
      state: session.state,
      expiresAt: session.expires_at,
    });

    return session;
  } catch (error) {
    logger.error('Failed to create VP session', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to create VP session');
  }
}

/**
 * Get VP session by state parameter
 */
export async function getVPSessionByState(state: string): Promise<VPSession | null> {
  try {
    const result = await pool.query('SELECT * FROM vp_sessions WHERE state = $1', [state]);

    if (result.rows.length === 0) {
      return null;
    }

    const session = mapRowToSession(result.rows[0] as DBRow);

    // Check if session is expired
    if (session.status === 'pending' && new Date() > session.expires_at) {
      await updateSessionStatus(session.id, 'expired');
      session.status = 'expired';
    }

    return session;
  } catch (error) {
    logger.error('Failed to get VP session', {
      state,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Update VP session with VP token
 */
export async function completeVPSession(
  sessionId: string,
  vpToken: string,
  presentationSubmission: Record<string, unknown>
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE vp_sessions 
       SET vp_token = $1, 
           presentation_submission = $2, 
           status = 'completed',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [vpToken, JSON.stringify(presentationSubmission), sessionId]
    );

    if ((result.rowCount || 0) === 0) {
      logger.warn('Failed to complete VP session - not found or not pending', {
        sessionId,
      });
      return false;
    }

    logger.info('VP session completed', { sessionId });
    return true;
  } catch (error) {
    logger.error('Failed to complete VP session', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Delete expired sessions (cleanup task)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM vp_sessions 
       WHERE status = 'pending' AND expires_at < CURRENT_TIMESTAMP`
    );

    const count = result.rowCount || 0;

    if (count > 0) {
      logger.info('Cleaned up expired sessions', { count });
    }

    return count;
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}
