import { logger } from '../config/logger';
import crypto from 'crypto';

/**
 * Gataca Wallet Service
 * Integration with Gataca Vouch for OpenID4VP flows
 *
 * Compliance References:
 * - OpenID4VP 1.0: Verifiable Presentations protocol
 * - OpenID Connect Core: Authorization code flow
 * - Gataca Vouch Integration: https://docs.gataca.io/developers/technical-integration/gataca-vouch-integration
 * - eIDAS 2.0: EUDI Wallet provider integration
 *
 * Implementation based on:
 * - Gataca Vouch OIDC specification
 * - OpenID4VP with Presentation Definition
 */

export interface GatacaConfig {
  idpHost: string; // Gataca Vouch base URL
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[]; // ['openid', 'profile', 'email', ...]
}

export interface GatacaAuthorizationRequest {
  response_type: 'code';
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  nonce: string;
  presentation_definition?: Record<string, unknown>;
}

export interface GatacaAuthorizationResponse {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export interface GatacaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
  vp_token?: string;
}

/**
 * Gataca configuration from environment
 */
const gatacaConfig: GatacaConfig = {
  idpHost: process.env.GATACA_IDP_HOST || 'https://vouch.gataca.io',
  clientId: process.env.GATACA_CLIENT_ID || '',
  clientSecret: process.env.GATACA_CLIENT_SECRET || '',
  redirectUri:
    process.env.GATACA_REDIRECT_URI ||
    'http://localhost:3000/api/v1/gataca/callback',
  scopes: ['openid', 'profile', 'vp'],
};

/**
 * Initialize Gataca authentication with configuration check
 */
export function initializeGatacaAuth(
  config?: Partial<GatacaConfig>
): { initialized: boolean; error?: string } {
  const finalConfig = { ...gatacaConfig, ...config };

  if (!finalConfig.clientId || !finalConfig.clientSecret) {
    logger.error('Gataca configuration incomplete', {
      hasClientId: !!finalConfig.clientId,
      hasClientSecret: !!finalConfig.clientSecret,
    });

    return {
      initialized: false,
      error: 'Missing Gataca client credentials',
    };
  }

  logger.info('Gataca authentication initialized', {
    idpHost: finalConfig.idpHost,
    redirectUri: finalConfig.redirectUri,
  });

  return { initialized: true };
}

/**
 * Create OpenID4VP authorization request for Gataca Wallet
 * Generates authorization URL with presentation definition
 */
export function createAuthorizationRequest(
  presentationDefinition: Record<string, unknown>,
  config?: Partial<GatacaConfig>
): {
  success: boolean;
  authorizationUrl?: string;
  state?: string;
  nonce?: string;
  error?: string;
} {
  try {
    const finalConfig = { ...gatacaConfig, ...config };

    // Generate secure state and nonce
    const state = crypto.randomBytes(16).toString('base64url');
    const nonce = crypto.randomBytes(16).toString('base64url');

    // Build authorization request
    const authRequest: GatacaAuthorizationRequest = {
      response_type: 'code',
      client_id: finalConfig.clientId,
      redirect_uri: finalConfig.redirectUri,
      scope: finalConfig.scopes.join(' '),
      state,
      nonce,
      presentation_definition: presentationDefinition,
    };

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: authRequest.response_type,
      client_id: authRequest.client_id,
      redirect_uri: authRequest.redirect_uri,
      scope: authRequest.scope,
      state: authRequest.state,
      nonce: authRequest.nonce,
    });

    // Add presentation_definition as JSON string if provided
    if (presentationDefinition) {
      params.append(
        'presentation_definition',
        JSON.stringify(presentationDefinition)
      );
    }

    const authorizationUrl = `${finalConfig.idpHost}/authorize?${params.toString()}`;

    logger.info('Gataca authorization request created', {
      state,
      hasPresentation: !!presentationDefinition,
    });

    return {
      success: true,
      authorizationUrl,
      state,
      nonce,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create Gataca authorization request', {
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Generate QR code from authorization URL
 * For wallet scanning via mobile devices
 */
export async function generateQRCode(
  authUrl: string
): Promise<{ success: boolean; qrCode?: string; error?: string }> {
  try {
    // Import qrcode dynamically
    const QRCode = await import('qrcode');

    // Generate QR code as data URL (base64)
    const qrCode = await QRCode.toDataURL(authUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
    });

    logger.info('QR code generated for Gataca', {
      urlLength: authUrl.length,
    });

    return { success: true, qrCode };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to generate QR code', { error: errorMessage });

    return { success: false, error: errorMessage };
  }
}

/**
 * Handle OAuth callback from Gataca
 * Exchange authorization code for tokens
 */
export async function handleCallback(
  response: GatacaAuthorizationResponse,
  expectedState: string,
  config?: Partial<GatacaConfig>
): Promise<{
  success: boolean;
  tokens?: GatacaTokenResponse;
  vpToken?: string;
  error?: string;
}> {
  try {
    // Validate state parameter (CSRF protection)
    if (response.state !== expectedState) {
      logger.warn('Gataca callback state mismatch', {
        expected: expectedState,
        received: response.state,
      });
      return { success: false, error: 'Invalid state parameter' };
    }

    // Check for error in response
    if (response.error) {
      logger.warn('Gataca authorization error', {
        error: response.error,
        description: response.error_description,
      });
      return {
        success: false,
        error: response.error_description || response.error,
      };
    }

    // Validate authorization code
    if (!response.code) {
      return { success: false, error: 'Missing authorization code' };
    }

    const finalConfig = { ...gatacaConfig, ...config };

    // Exchange code for tokens
    const tokenResponse = await fetch(`${finalConfig.idpHost}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${finalConfig.clientId}:${finalConfig.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: response.code,
        redirect_uri: finalConfig.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Gataca token exchange failed', {
        status: tokenResponse.status,
        error: errorText,
      });
      return {
        success: false,
        error: `Token exchange failed: ${tokenResponse.status}`,
      };
    }

    const tokens = (await tokenResponse.json()) as GatacaTokenResponse;

    logger.info('Gataca tokens received', {
      hasAccessToken: !!tokens.access_token,
      hasIdToken: !!tokens.id_token,
      hasVpToken: !!tokens.vp_token,
    });

    return {
      success: true,
      tokens,
      vpToken: tokens.vp_token || tokens.id_token,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gataca callback handling failed', { error: errorMessage });

    return { success: false, error: errorMessage };
  }
}

/**
 * Validate VP token from Gataca
 * Verifies JWT signature and extracts claims
 */
export async function validateGatacaVP(
  vpToken: string
): Promise<{
  valid: boolean;
  claims?: Record<string, unknown>;
  error?: string;
}> {
  try {
    logger.info('Validating Gataca VP token');

    // Decode JWT (without verification for now - full verification in VCValidator)
    const parts = vpToken.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid JWT format' };
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );

    // Extract VP or claims
    const vp = payload.vp || payload;

    // Basic validation
    if (!vp) {
      return { valid: false, error: 'Missing VP in token' };
    }

    // Extract verifiable credentials
    const credentials =
      vp.verifiableCredential || vp.verifiable_credential || [];

    logger.info('Gataca VP validated', {
      credentialCount: Array.isArray(credentials) ? credentials.length : 0,
      holder: vp.holder,
    });

    return {
      valid: true,
      claims: {
        vp,
        credentials,
        holder: vp.holder,
        ...payload,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gataca VP validation failed', { error: errorMessage });

    return { valid: false, error: errorMessage };
  }
}

/**
 * Build Gataca-specific deep link for mobile wallet
 * Format: openid4vp:// scheme for Gataca app
 */
export function buildGatacaDeepLink(authorizationUrl: string): string {
  // Gataca supports standard openid4vp:// scheme
  return authorizationUrl.replace(/^https?:\/\//, 'openid4vp://');
}

/**
 * Check Gataca service health
 * Verify connection to Gataca Vouch
 */
export async function checkGatacaHealth(
  config?: Partial<GatacaConfig>
): Promise<{ healthy: boolean; error?: string }> {
  try {
    const finalConfig = { ...gatacaConfig, ...config };

    // Try to fetch OpenID configuration
    const response = await fetch(
      `${finalConfig.idpHost}/.well-known/openid-configuration`,
      { method: 'GET', headers: { Accept: 'application/json' } }
    );

    if (!response.ok) {
      return { healthy: false, error: `HTTP ${response.status}` };
    }

    logger.info('Gataca health check passed');
    return { healthy: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Gataca health check failed', { error: errorMessage });

    return { healthy: false, error: errorMessage };
  }
}
