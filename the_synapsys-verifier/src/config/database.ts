import { Pool, PoolConfig } from 'pg';
import { logger } from './logger';

/**
 * PostgreSQL Database Configuration
 * Used for session management in OpenID4VP flow
 */

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'synapsys_verifier',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
};

// Create connection pool
export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// Connection test
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Initialize database schema for session management and audit logging
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create audit_logs table (eIDAS 2.0 Art. 64 - append-only)
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        actor VARCHAR(255),
        resource VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        result VARCHAR(50) NOT NULL,
        metadata JSONB
      );
    `);

    // Create indexes for audit_logs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor);
      CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_logs(result);
      CREATE INDEX IF NOT EXISTS idx_audit_retention ON audit_logs(timestamp) 
        WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '3 years';
    `);

    await client.query(`
      COMMENT ON TABLE audit_logs IS 
        'eIDAS 2.0 Art. 64 compliant audit log - APPEND ONLY - 3 year retention';
    `);

    // Create sessions table for OpenID4VP authorization flow
    await client.query(`
      CREATE TABLE IF NOT EXISTS vp_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        state VARCHAR(255) UNIQUE NOT NULL,
        nonce VARCHAR(255) NOT NULL,
        presentation_definition JSONB NOT NULL,
        redirect_uri TEXT,
        client_id VARCHAR(255),
        response_mode VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        vp_token TEXT,
        presentation_submission JSONB,
        completed_at TIMESTAMP,
        INDEX idx_state (state),
        INDEX idx_expires_at (expires_at),
        INDEX idx_status (status)
      );
    `);

    // Create index for cleanup of expired sessions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_expired_sessions 
      ON vp_sessions(expires_at) 
      WHERE status = 'pending';
    `);

    // Execute migration 003: Relying Party Management
    await client.query(`
      CREATE TABLE IF NOT EXISTS relying_parties (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        client_id VARCHAR(255) UNIQUE NOT NULL,
        client_secret_hash VARCHAR(255) NOT NULL,
        callback_url TEXT,
        allowed_origins TEXT[],
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        metadata JSONB
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rp_client_id ON relying_parties(client_id);
      CREATE INDEX IF NOT EXISTS idx_rp_status ON relying_parties(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rp_id UUID NOT NULL REFERENCES relying_parties(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP,
        expires_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_key_rp ON api_keys(rp_id);
      CREATE INDEX IF NOT EXISTS idx_api_key_status ON api_keys(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rp_verification_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rp_id UUID NOT NULL REFERENCES relying_parties(id) ON DELETE CASCADE,
        session_id UUID NOT NULL REFERENCES vp_sessions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        success BOOLEAN
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rpvs_rp_id ON rp_verification_sessions(rp_id);
      CREATE INDEX IF NOT EXISTS idx_rpvs_created_at ON rp_verification_sessions(created_at);
    `);

    await client.query('COMMIT');
    logger.info('Database schema initialized successfully (including RP tables)');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize database schema', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    client.release();
  }
}
