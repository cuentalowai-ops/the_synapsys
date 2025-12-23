import { logger } from '../config/logger';
import { pool } from '../config/database';

/**
 * Wallet Discovery Service
 * Automatic wallet capability detection and metadata management
 *
 * Compliance References:
 * - OpenID4VP 1.0: Wallet metadata discovery
 * - eIDAS 2.0: EUDI Wallet compatibility
 * - ARF 1.4.0: Wallet provider specifications
 *
 * Multi-Wallet Support:
 * - Gataca Wallet
 * - iGrant.io Data Wallet
 * - Generic EUDI-compliant wallets
 */

export interface WalletMetadata {
  walletId: string;
  name: string;
  provider: 'gataca' | 'igrant' | 'other';
  authorizationEndpoint: string;
  openid4vpVersion: string;
  supportedFormats: string[];
  capabilities: {
    sdJwt: boolean;
    mdoc: boolean;
    w3cVc: boolean;
  };
}

export interface WalletProvider {
  id: string;
  walletId: string;
  name: string;
  providerType: 'gataca' | 'igrant' | 'other';
  authorizationEndpoint: string;
  metadata: WalletMetadata;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * In-memory cache for wallet metadata
 * Production: Consider Redis for distributed systems
 */
const walletCache = new Map<string, { metadata: WalletMetadata; timestamp: number }>();
const CACHE_TTL = parseInt(process.env.WALLET_DISCOVERY_CACHE_TTL || '3600', 10) * 1000;

/**
 * Pre-configured wallet providers
 * Based on official documentation from Gataca and iGrant.io
 */
const KNOWN_WALLETS: WalletMetadata[] = [
  {
    walletId: 'gataca',
    name: 'Gataca Wallet',
    provider: 'gataca',
    authorizationEndpoint: process.env.GATACA_IDP_HOST || 'https://vouch.gataca.io',
    openid4vpVersion: '1.0',
    supportedFormats: ['jwt_vp', 'jwt_vc', 'vc+sd-jwt'],
    capabilities: {
      sdJwt: true,
      mdoc: true,
      w3cVc: true,
    },
  },
  {
    walletId: 'igrant',
    name: 'iGrant.io Data Wallet',
    provider: 'igrant',
    authorizationEndpoint:
      process.env.IGRANT_AUTHORIZATION_ENDPOINT || 'https://api.igrant.io/v1/auth',
    openid4vpVersion: '1.0',
    supportedFormats: ['jwt_vp', 'jwt_vc', 'vc+sd-jwt', 'mso_mdoc'],
    capabilities: {
      sdJwt: true,
      mdoc: true,
      w3cVc: true,
    },
  },
];

/**
 * Discover all available wallet providers
 * Returns cached or database-stored wallet metadata
 */
export async function discoverWallets(): Promise<{
  success: boolean;
  wallets?: WalletMetadata[];
  error?: string;
}> {
  try {
    logger.info('Discovering available wallets');

    // Get active wallet providers from database
    const result = await pool.query(
      'SELECT * FROM wallet_providers WHERE is_active = true ORDER BY name'
    );

    const wallets: WalletMetadata[] = result.rows.map((row) => {
      const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      return metadata as WalletMetadata;
    });

    // If no wallets in database, use known wallets
    if (wallets.length === 0) {
      logger.info('No wallets in database, using known wallets', {
        count: KNOWN_WALLETS.length,
      });
      return { success: true, wallets: KNOWN_WALLETS };
    }

    logger.info('Wallets discovered', { count: wallets.length });
    return { success: true, wallets };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to discover wallets', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Get wallet metadata by walletId
 * Checks cache first, then database
 */
export async function getWalletMetadata(
  walletId: string
): Promise<{ success: boolean; metadata?: WalletMetadata; error?: string }> {
  try {
    // Check cache
    const cached = walletCache.get(walletId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      logger.debug('Wallet metadata from cache', { walletId });
      return { success: true, metadata: cached.metadata };
    }

    // Query database
    const result = await pool.query(
      'SELECT metadata FROM wallet_providers WHERE wallet_id = $1 AND is_active = true',
      [walletId]
    );

    if (result.rows.length === 0) {
      // Try known wallets
      const knownWallet = KNOWN_WALLETS.find((w) => w.walletId === walletId);
      if (knownWallet) {
        walletCache.set(walletId, { metadata: knownWallet, timestamp: Date.now() });
        return { success: true, metadata: knownWallet };
      }

      return { success: false, error: 'Wallet provider not found' };
    }

    const metadata =
      typeof result.rows[0].metadata === 'string'
        ? JSON.parse(result.rows[0].metadata)
        : result.rows[0].metadata;

    // Update cache
    walletCache.set(walletId, { metadata, timestamp: Date.now() });

    logger.info('Wallet metadata retrieved', { walletId });
    return { success: true, metadata };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get wallet metadata', {
      walletId,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Register a new wallet provider
 * Stores wallet metadata in database
 */
export async function registerWalletProvider(
  metadata: WalletMetadata
): Promise<{ success: boolean; providerId?: string; error?: string }> {
  try {
    logger.info('Registering wallet provider', { walletId: metadata.walletId });

    const result = await pool.query(
      `INSERT INTO wallet_providers 
       (wallet_id, name, provider_type, authorization_endpoint, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (wallet_id) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         provider_type = EXCLUDED.provider_type,
         authorization_endpoint = EXCLUDED.authorization_endpoint,
         metadata = EXCLUDED.metadata,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        metadata.walletId,
        metadata.name,
        metadata.provider,
        metadata.authorizationEndpoint,
        JSON.stringify(metadata),
        true,
      ]
    );

    const providerId = result.rows[0].id;

    // Clear cache for this wallet
    walletCache.delete(metadata.walletId);

    logger.info('Wallet provider registered', {
      walletId: metadata.walletId,
      providerId,
    });

    return { success: true, providerId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to register wallet provider', {
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Initialize known wallets in database
 */
export async function initializeKnownWallets(): Promise<void> {
  try {
    logger.info('Initializing known wallets');

    for (const wallet of KNOWN_WALLETS) {
      await registerWalletProvider(wallet);
    }

    logger.info('Known wallets initialized', { count: KNOWN_WALLETS.length });
  } catch (error) {
    logger.error('Failed to initialize known wallets', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Validate wallet compliance with OpenID4VP and eIDAS specs
 */
export function validateWalletCompliance(metadata: WalletMetadata): {
  compliant: boolean;
  issues?: string[];
} {
  const issues: string[] = [];

  // Check required fields
  if (!metadata.walletId) issues.push('Missing walletId');
  if (!metadata.name) issues.push('Missing name');
  if (!metadata.authorizationEndpoint) issues.push('Missing authorizationEndpoint');
  if (!metadata.openid4vpVersion) issues.push('Missing openid4vpVersion');

  // Check supported formats
  if (!metadata.supportedFormats || metadata.supportedFormats.length === 0) {
    issues.push('No supported formats specified');
  }

  // Check capabilities
  if (!metadata.capabilities) {
    issues.push('Missing capabilities');
  }

  return {
    compliant: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * Clear wallet metadata cache
 */
export function clearWalletCache(): void {
  walletCache.clear();
  logger.info('Wallet cache cleared');
}
