/**
 * OOTS Token Service - OAuth 2.0 Token Provider for Wallets
 * 
 * OOTS = OpenID Token Server
 * Generates and validates tokens for digital wallet verification
 * Required for iGrant.io + Gataca flows
 */

import * as jose from 'jose';
import { randomBytes } from 'crypto';
import logger from '../config/logger';

export interface TokenPayload {
  sub: string; // Subject (user ID)
  aud: string; // Audience (RP ID)
  iss: string; // Issuer
  iat: number; // Issued at
  exp: number; // Expiration
  scope: string[]; // Scopes
  jti?: string; // JWT ID
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export class OOTSTokenService {
  private jwtSecret: string;
  private issuer: string;


  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    this.issuer = process.env.ISSUER_URL || 'https://synapsys.io';

    if (this.jwtSecret === 'dev-secret-key-change-in-production') {
      logger.warn('Using default JWT secret - CHANGE IN PRODUCTION!');
    }
  }

  /**
   * Generate an access token for a user and relying party
   */
  async generateToken(
    userId: string,
    rpId: string,
    scope: string[] = ['openid', 'profile']
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const jti = randomBytes(16).toString('hex');

    const secret = new TextEncoder().encode(this.jwtSecret);
    
    const token = await new jose.SignJWT({
      scope,
      jti,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setIssuer(this.issuer)
      .setSubject(userId)
      .setAudience(rpId)
      .setExpirationTime('1h')
      .sign(secret);

    logger.info('OOTS token generated', {
      userId,
      rpId,
      scope,
      jti,
      expiresAt: new Date((now + 3600) * 1000).toISOString(),
    });

    return token;
  }

  /**
   * Verify and decode a token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const secret = new TextEncoder().encode(this.jwtSecret);
      const { payload } = await jose.jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      const tokenPayload: TokenPayload = {
        sub: payload.sub || '',
        aud: (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) || '',
        iss: payload.iss || '',
        iat: payload.iat || 0,
        exp: payload.exp || 0,
        scope: (payload.scope as string[]) || [],
        jti: payload.jti as string,
      };

      logger.info('OOTS token verified', {
        sub: tokenPayload.sub,
        aud: tokenPayload.aud,
        jti: tokenPayload.jti,
      });

      return tokenPayload;
    } catch (error) {
      logger.error('OOTS token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Invalid or expired token');
    }
  }


  /**
   * Generate a refresh token (random secure string)
   */
  generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate a complete token response
   */
  async generateTokenResponse(
    userId: string,
    rpId: string,
    scope: string[] = ['openid', 'profile'],
    includeRefreshToken: boolean = true
  ): Promise<TokenResponse> {
    const accessToken = await this.generateToken(userId, rpId, scope);

    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: scope.join(' '),
    };

    if (includeRefreshToken) {
      response.refresh_token = this.generateRefreshToken();
    }

    return response;
  }

  /**
   * Extract token from Authorization header
   */
  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Validate token scopes
   */
  validateScopes(token: TokenPayload, requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => token.scope.includes(scope));
  }
}

// Export singleton instance
export default new OOTSTokenService();
