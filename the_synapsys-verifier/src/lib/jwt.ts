import * as jose from 'jose';
import { logger } from '../config/logger';

/**
 * JWT Validation Library
 * Supports RS256, ES256, ES256K, EdDSA (eIDAS 2.0 compliant)
 */

export interface JWTPayload {
  iss?: string; // Issuer
  sub?: string; // Subject
  aud?: string | string[]; // Audience
  exp?: number; // Expiration time
  nbf?: number; // Not before
  iat?: number; // Issued at
  jti?: string; // JWT ID
  nonce?: string; // Nonce for replay protection
  [key: string]: unknown; // Additional claims
}

export interface JWTVerificationOptions {
  issuer?: string | string[];
  audience?: string | string[];
  algorithms?: string[];
  maxTokenAge?: number; // in seconds
  clockTolerance?: number; // in seconds
}

export interface JWTVerificationResult {
  valid: boolean;
  payload?: JWTPayload;
  header?: jose.ProtectedHeaderParameters;
  error?: string;
}

/**
 * Verify JWT with JWK (JSON Web Key)
 */
export async function verifyJWTWithJWK(
  token: string,
  jwk: jose.JWK,
  options?: JWTVerificationOptions
): Promise<JWTVerificationResult> {
  try {
    // Import the JWK as a public key
    const publicKey = await jose.importJWK(jwk);

    // Set up verification options
    const verifyOptions: jose.JWTVerifyOptions = {
      issuer: options?.issuer,
      audience: options?.audience,
      algorithms: options?.algorithms || ['RS256', 'ES256', 'ES256K', 'EdDSA'],
      maxTokenAge: options?.maxTokenAge ? `${options.maxTokenAge}s` : undefined,
      clockTolerance: options?.clockTolerance,
    };

    // Verify the JWT
    const { payload, protectedHeader } = await jose.jwtVerify(token, publicKey, verifyOptions);

    logger.info('JWT verification successful', {
      algorithm: protectedHeader.alg,
      issuer: payload.iss,
    });

    return {
      valid: true,
      payload: payload as JWTPayload,
      header: protectedHeader,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('JWT verification failed', { error: errorMessage });

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Verify JWT with JWKS (JSON Web Key Set) URL
 */
export async function verifyJWTWithJWKS(
  token: string,
  jwksUrl: string,
  options?: JWTVerificationOptions
): Promise<JWTVerificationResult> {
  try {
    // Create JWKS client
    const JWKS = jose.createRemoteJWKSet(new URL(jwksUrl));

    // Set up verification options
    const verifyOptions: jose.JWTVerifyOptions = {
      issuer: options?.issuer,
      audience: options?.audience,
      algorithms: options?.algorithms || ['RS256', 'ES256', 'ES256K', 'EdDSA'],
      maxTokenAge: options?.maxTokenAge ? `${options.maxTokenAge}s` : undefined,
      clockTolerance: options?.clockTolerance,
    };

    // Verify the JWT
    const { payload, protectedHeader } = await jose.jwtVerify(token, JWKS, verifyOptions);

    logger.info('JWT verification successful with JWKS', {
      algorithm: protectedHeader.alg,
      issuer: payload.iss,
      jwksUrl,
    });

    return {
      valid: true,
      payload: payload as JWTPayload,
      header: protectedHeader,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('JWT verification with JWKS failed', {
      error: errorMessage,
      jwksUrl,
    });

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Decode JWT without verification (for inspection only)
 */
export function decodeJWT(token: string): JWTVerificationResult {
  try {
    const decoded = jose.decodeJwt(token);
    const header = jose.decodeProtectedHeader(token);

    return {
      valid: true,
      payload: decoded as JWTPayload,
      header,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('JWT decoding failed', { error: errorMessage });

    return {
      valid: false,
      error: errorMessage,
    };
  }
}

/**
 * Create a signed JWT (for testing or internal use)
 */
export async function createSignedJWT(
  payload: JWTPayload,
  privateKey: Uint8Array | jose.JWK,
  algorithm: string = 'RS256',
  expiresIn: string = '1h'
): Promise<string> {
  try {
    // Import key if it's a JWK
    const signingKey = 'kty' in privateKey ? await jose.importJWK(privateKey) : privateKey;

    const jwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: algorithm })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(signingKey);

    logger.info('JWT created successfully', { algorithm, expiresIn });
    return jwt;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to create JWT', { error: errorMessage });
    throw new Error(`JWT creation failed: ${errorMessage}`);
  }
}

/**
 * Validate JWT expiration
 */
export function isJWTExpired(payload: JWTPayload): boolean {
  if (!payload.exp) {
    return false; // No expiration claim
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Validate JWT not before claim
 */
export function isJWTNotYetValid(payload: JWTPayload): boolean {
  if (!payload.nbf) {
    return false; // No nbf claim
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.nbf > now;
}
