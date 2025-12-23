import { pool } from '../config/database';
import { logger } from '../config/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * OAuth Service for Relying Party Management
 * Implements OAuth 2.0 Client Credentials flow for RP authentication
 *
 * Compliance References:
 * - OAuth 2.0 RFC 6749: Client Credentials Grant
 * - OWASP A02:2021: Cryptographic Failures (bcrypt for secrets)
 * - eIDAS 2.0 Art. 45: Multi-client WRP support
 * - ISO 27001 A.9.2: User access management
 */

const BCRYPT_ROUNDS = 12; // OWASP recommended minimum for 2024+

export interface RelyingParty {
  id: string;
  name: string;
  client_id: string;
  callback_url?: string;
  allowed_origins?: string[];
  status: 'active' | 'suspended' | 'revoked';
  created_at: Date;
  updated_at: Date;
  last_used_at?: Date;
  metadata?: Record<string, unknown>;
}

export interface RPCredentials {
  client_id: string;
  client_secret: string; // ONLY returned once at registration
  rp: RelyingParty;
}

export interface APIKey {
  id: string;
  rp_id: string;
  key: string; // ONLY returned once at generation
  name: string;
  status: 'active' | 'revoked';
  created_at: Date;
  expires_at?: Date;
}

/**
 * Register a new Relying Party
 * Returns client_id and client_secret (ONLY TIME secret is visible)
 */
export async function registerRP(data: {
  name: string;
  callback_url?: string;
  allowed_origins?: string[];
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; credentials?: RPCredentials; error?: string }> {
  try {
    logger.info('Registering new Relying Party', { name: data.name });

    // Generate secure client_id and client_secret
    const client_id = `rp_${crypto.randomBytes(16).toString('hex')}`;
    const client_secret = crypto.randomBytes(32).toString('base64url');

    // Hash client_secret with bcrypt (NEVER store plaintext)
    const client_secret_hash = await bcrypt.hash(client_secret, BCRYPT_ROUNDS);

    // Insert into database
    const result = await pool.query(
      `INSERT INTO relying_parties 
       (name, client_id, client_secret_hash, callback_url, allowed_origins, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, client_id, callback_url, allowed_origins, status, created_at, updated_at, metadata`,
      [
        data.name,
        client_id,
        client_secret_hash,
        data.callback_url,
        data.allowed_origins || [],
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    const rp = mapRowToRP(result.rows[0]);

    logger.info('Relying Party registered successfully', {
      rpId: rp.id,
      clientId: client_id,
    });

    return {
      success: true,
      credentials: {
        client_id,
        client_secret, // ONLY time this is visible!
        rp,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to register Relying Party', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Authenticate Relying Party with client credentials
 * OAuth 2.0 Client Credentials Grant
 */
export async function authenticateRP(
  clientId: string,
  clientSecret: string
): Promise<{ success: boolean; rp?: RelyingParty; error?: string }> {
  try {
    logger.info('Authenticating Relying Party', { clientId });

    // Get RP from database
    const result = await pool.query('SELECT * FROM relying_parties WHERE client_id = $1', [
      clientId,
    ]);

    if (result.rows.length === 0) {
      logger.warn('RP authentication failed - client not found', { clientId });
      return { success: false, error: 'Invalid client credentials' };
    }

    const row = result.rows[0];

    // Check if RP is active
    if (row.status !== 'active') {
      logger.warn('RP authentication failed - not active', {
        clientId,
        status: row.status,
      });
      return { success: false, error: `Client is ${row.status}` };
    }

    // Verify client_secret with bcrypt
    const secretMatch = await bcrypt.compare(clientSecret, row.client_secret_hash);

    if (!secretMatch) {
      logger.warn('RP authentication failed - invalid secret', { clientId });
      return { success: false, error: 'Invalid client credentials' };
    }

    // Update last_used_at
    await pool.query('UPDATE relying_parties SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [
      row.id,
    ]);

    const rp = mapRowToRP(row);

    logger.info('RP authenticated successfully', { rpId: rp.id, clientId });

    return { success: true, rp };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RP authentication error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate API key for a Relying Party
 * Alternative authentication method (simpler than OAuth for some clients)
 */
export async function generateAPIKey(
  rpId: string,
  name: string,
  expiresInDays?: number
): Promise<{ success: boolean; apiKey?: APIKey; error?: string }> {
  try {
    logger.info('Generating API key', { rpId, name });

    // Verify RP exists
    const rpCheck = await pool.query(
      'SELECT id FROM relying_parties WHERE id = $1 AND status = $2',
      [rpId, 'active']
    );

    if (rpCheck.rows.length === 0) {
      return { success: false, error: 'Relying Party not found or not active' };
    }

    // Generate secure API key
    const keyValue = `sk_${crypto.randomBytes(32).toString('base64url')}`;

    // Hash API key with bcrypt
    const keyHash = await bcrypt.hash(keyValue, BCRYPT_ROUNDS);

    // Calculate expiration
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // Insert into database
    const result = await pool.query(
      `INSERT INTO api_keys (rp_id, key_hash, name, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rp_id, name, status, created_at, expires_at`,
      [rpId, keyHash, name, expiresAt]
    );

    const apiKey: APIKey = {
      id: result.rows[0].id,
      rp_id: result.rows[0].rp_id,
      key: keyValue, // ONLY time this is visible!
      name: result.rows[0].name,
      status: result.rows[0].status,
      created_at: result.rows[0].created_at,
      expires_at: result.rows[0].expires_at,
    };

    logger.info('API key generated successfully', {
      keyId: apiKey.id,
      rpId,
    });

    return { success: true, apiKey };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to generate API key', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Validate API key and return associated RP
 */
export async function validateAPIKey(
  apiKeyValue: string
): Promise<{ valid: boolean; rp?: RelyingParty; error?: string }> {
  try {
    // Get all active API keys (we need to check all hashes)
    const result = await pool.query(
      `SELECT ak.*, rp.* 
       FROM api_keys ak
       JOIN relying_parties rp ON ak.rp_id = rp.id
       WHERE ak.status = 'active' AND rp.status = 'active'
       AND (ak.expires_at IS NULL OR ak.expires_at > CURRENT_TIMESTAMP)`
    );

    // Check each key hash (constant-time comparison via bcrypt)
    for (const row of result.rows) {
      const matches = await bcrypt.compare(apiKeyValue, row.key_hash);

      if (matches) {
        // Update last_used_at
        await pool.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [
          row.id,
        ]);

        const rp = mapRowToRP(row);

        logger.info('API key validated', { rpId: rp.id, keyId: row.id });

        return { valid: true, rp };
      }
    }

    logger.warn('API key validation failed - no match found');
    return { valid: false, error: 'Invalid API key' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('API key validation error', { error: errorMessage });
    return { valid: false, error: errorMessage };
  }
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string, rpId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE api_keys 
       SET status = 'revoked'
       WHERE id = $1 AND rp_id = $2`,
      [keyId, rpId]
    );

    const revoked = (result.rowCount || 0) > 0;

    if (revoked) {
      logger.info('API key revoked', { keyId, rpId });
    }

    return revoked;
  } catch (error) {
    logger.error('Failed to revoke API key', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Get RP by ID
 */
export async function getRPById(
  rpId: string
): Promise<{ success: boolean; rp?: RelyingParty; error?: string }> {
  try {
    const result = await pool.query('SELECT * FROM relying_parties WHERE id = $1', [rpId]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Relying Party not found' };
    }

    const rp = mapRowToRP(result.rows[0]);
    return { success: true, rp };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Map database row to RelyingParty object
 */
function mapRowToRP(row: any): RelyingParty {
  return {
    id: row.id,
    name: row.name,
    client_id: row.client_id,
    callback_url: row.callback_url,
    allowed_origins: row.allowed_origins,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at,
    metadata:
      row.metadata && typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
  };
}
