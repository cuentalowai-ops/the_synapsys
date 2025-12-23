import { pool } from '../config/database';
import { logger } from '../config/logger';

/**
 * Audit Logging Service
 * Immutable audit trail for compliance and security monitoring
 *
 * Compliance References:
 * - eIDAS 2.0 Art. 64: Liability - Audit logging requirements
 * - ISO 27001 A.12.4.1: Event logging
 * - GDPR Art. 5(1)(f): Integrity and confidentiality
 * - GDPR Art. 32: Security of processing
 * - NIS2 Directive: Incident detection and reporting
 *
 * Implementation Rules:
 * - Append-only table (NO UPDATE/DELETE permissions in production)
 * - 3-year retention (eIDAS requirement)
 * - No PII in logs (GDPR Art. 5 data minimisation)
 * - Structured JSON metadata for flexibility
 */

export interface AuditEvent {
  eventType: string; // e.g., "authorization_created", "vp_token_received"
  actor?: string; // IP or anonymized identifier (NO PII)
  resource?: string; // Resource affected (session ID, credential ID)
  action: string; // Action performed
  result: 'success' | 'failure' | 'error';
  metadata?: Record<string, unknown>; // Additional context (NO PII)
  timestamp?: Date; // Auto-generated if not provided
}

export interface AuditLogQuery {
  eventType?: string;
  actor?: string;
  result?: 'success' | 'failure' | 'error';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Initialize audit_logs table
 * Called during database initialization
 */
export async function initializeAuditLogsTable(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        actor VARCHAR(255),
        resource VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        result VARCHAR(50) NOT NULL,
        metadata JSONB,
        -- Indexes for common queries
        INDEX idx_timestamp (timestamp),
        INDEX idx_event_type (event_type),
        INDEX idx_actor (actor),
        INDEX idx_result (result)
      );
    `);

    // Create index for retention policy queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_retention 
      ON audit_logs(timestamp) 
      WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '3 years';
    `);

    // Grant only INSERT and SELECT permissions (NO UPDATE/DELETE)
    // This should be enforced at database role level in production
    await client.query(`
      COMMENT ON TABLE audit_logs IS 
        'eIDAS 2.0 Art. 64 compliant audit log - APPEND ONLY - 3 year retention';
    `);

    await client.query('COMMIT');
    logger.info('Audit logs table initialized');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize audit logs table', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Log an audit event
 * This is the ONLY way to write to audit_logs (append-only pattern)
 */
export async function logAuditEvent(event: AuditEvent): Promise<boolean> {
  try {
    const result = await pool.query(
      `INSERT INTO audit_logs 
       (event_type, actor, resource, action, result, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        event.eventType,
        event.actor,
        event.resource,
        event.action,
        event.result,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.timestamp || new Date(),
      ]
    );

    const auditId = result.rows[0]?.id;

    logger.debug('Audit event logged', {
      auditId,
      eventType: event.eventType,
      result: event.result,
    });

    return true;
  } catch (error) {
    // Critical: Audit logging failure should be logged but not throw
    // to avoid breaking the main application flow
    logger.error('Failed to log audit event (CRITICAL)', {
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Query audit logs
 * Read-only access for compliance reporting and security analysis
 */
export async function queryAuditLogs(query: AuditLogQuery = {}): Promise<{
  success: boolean;
  logs?: Array<AuditEvent & { id: number; timestamp: Date }>;
  total?: number;
  error?: string;
}> {
  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (query.eventType) {
      conditions.push(`event_type = $${paramIndex++}`);
      values.push(query.eventType);
    }

    if (query.actor) {
      conditions.push(`actor = $${paramIndex++}`);
      values.push(query.actor);
    }

    if (query.result) {
      conditions.push(`result = $${paramIndex++}`);
      values.push(query.result);
    }

    if (query.startDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      values.push(query.startDate);
    }

    if (query.endDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      values.push(query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      values
    );

    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    // Get paginated results
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    const dataResult = await pool.query(
      `SELECT * FROM audit_logs ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    const logs = dataResult.rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      actor: row.actor,
      resource: row.resource,
      action: row.action,
      result: row.result,
      metadata:
        row.metadata && typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    }));

    logger.info('Audit logs queried', { total, returned: logs.length });

    return { success: true, logs, total };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to query audit logs', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete audit logs older than retention period
 * eIDAS 2.0: 3 year retention required
 * Should be run as scheduled task (daily/weekly)
 */
export async function cleanupExpiredAuditLogs(retentionYears: number = 3): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM audit_logs 
       WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${retentionYears} years'`
    );

    const deleted = result.rowCount || 0;

    if (deleted > 0) {
      logger.info('Expired audit logs cleaned up', {
        deleted,
        retentionYears,
      });
    }

    return deleted;
  } catch (error) {
    logger.error('Failed to cleanup expired audit logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Get audit log statistics (for dashboard)
 */
export async function getAuditLogStats(days: number = 30): Promise<{
  totalEvents: number;
  successRate: number;
  eventsByType: Record<string, number>;
  eventsByDay: Array<{ date: string; count: number }>;
}> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Total events
    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE timestamp >= $1',
      [startDate]
    );
    const totalEvents = parseInt(totalResult.rows[0]?.total || '0', 10);

    // Success rate
    const successResult = await pool.query(
      `SELECT COUNT(*) as success FROM audit_logs 
       WHERE timestamp >= $1 AND result = 'success'`,
      [startDate]
    );
    const successCount = parseInt(successResult.rows[0]?.success || '0', 10);
    const successRate = totalEvents > 0 ? (successCount / totalEvents) * 100 : 0;

    // Events by type
    const typeResult = await pool.query(
      `SELECT event_type, COUNT(*) as count 
       FROM audit_logs 
       WHERE timestamp >= $1
       GROUP BY event_type
       ORDER BY count DESC`,
      [startDate]
    );

    const eventsByType: Record<string, number> = {};
    typeResult.rows.forEach((row) => {
      eventsByType[row.event_type] = parseInt(row.count, 10);
    });

    // Events by day
    const dayResult = await pool.query(
      `SELECT DATE(timestamp) as date, COUNT(*) as count
       FROM audit_logs
       WHERE timestamp >= $1
       GROUP BY DATE(timestamp)
       ORDER BY date ASC`,
      [startDate]
    );

    const eventsByDay = dayResult.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      count: parseInt(row.count, 10),
    }));

    logger.info('Audit log stats generated', { days, totalEvents });

    return {
      totalEvents,
      successRate,
      eventsByType,
      eventsByDay,
    };
  } catch (error) {
    logger.error('Failed to get audit log stats', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
