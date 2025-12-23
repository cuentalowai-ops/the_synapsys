import { logger } from '../config/logger';
import { decode as sdJwtDecode } from '@sd-jwt/decode';
import { verifyJWTWithJWK } from '../lib/jwt';
import { resolveDID, isTrustedIssuer, type TrustResolverConfig } from './TrustResolver';

/**
 * SD-JWT Validator Service
 * Validates Selective Disclosure JWTs for privacy-preserving credentials
 *
 * Compliance References:
 * - SD-JWT Spec: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-selective-disclosure-jwt
 * - ISO 18013-5: Mobile Driving License (mDL) - uses SD-JWT patterns
 * - EUDI ARF 1.4.0 Section 6.3: SD-JWT VC format
 * - eIDAS 2.0 Annex VI: Privacy-preserving attestations
 *
 * Standards Alignment:
 * Based on eu-digital-identity-wallet SD-JWT implementation patterns
 * Compatible with @sd-jwt reference libraries
 */

export interface SDJWTValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  issuer?: string;
  disclosedClaims?: Record<string, unknown>;
  issuanceDate?: string;
  expirationDate?: string;
  trusted?: boolean;
  disclosureCount?: number;
}

export interface SDJWTValidationOptions {
  checkTrust?: boolean;
  checkExpiration?: boolean;
  trustConfig?: TrustResolverConfig;
  requireMinimumDisclosures?: number;
}

/**
 * Validate SD-JWT credential
 * Format: <Issuer-signed JWT>~<Disclosure 1>~<Disclosure 2>~...~<Key Binding JWT>
 */
export async function validateSDJWT(
  sdJwtToken: string,
  options: SDJWTValidationOptions = {}
): Promise<SDJWTValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    logger.info('Validating SD-JWT', { tokenLength: sdJwtToken.length });

    // Default options
    const opts = {
      checkTrust: options.checkTrust ?? true,
      checkExpiration: options.checkExpiration ?? true,
      trustConfig: options.trustConfig,
      requireMinimumDisclosures: options.requireMinimumDisclosures,
    };

    // Step 1: Parse SD-JWT structure
    // Format: <JWT>~<disclosure>~<disclosure>~...~<kb-jwt>
    const parts = sdJwtToken.split('~');

    if (parts.length < 1) {
      errors.push('Invalid SD-JWT format');
      return { valid: false, errors };
    }

    const issuerJWT = parts[0];
    const disclosures = parts.slice(1, -1).filter((d) => d.length > 0);
    const keyBindingJWT = parts[parts.length - 1];

    logger.debug('SD-JWT parsed', {
      disclosureCount: disclosures.length,
      hasKeyBinding: keyBindingJWT.length > 0,
    });

    // Step 2: Decode SD-JWT using @sd-jwt/decode
    let decodedSDJWT: any;

    try {
      decodedSDJWT = sdJwtDecode(sdJwtToken);
    } catch (error) {
      errors.push(
        `Failed to decode SD-JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return { valid: false, errors };
    }

    // Step 3: Extract issuer from JWT
    const issuerDID =
      decodedSDJWT.jwt?.payload?.iss ||
      decodedSDJWT.jwt?.payload?.issuer ||
      decodedSDJWT.payload?.iss;

    if (!issuerDID) {
      errors.push('Missing issuer in SD-JWT');
      return { valid: false, errors };
    }

    // Step 4: Resolve issuer DID
    const didResolution = await resolveDID(issuerDID, opts.trustConfig);

    if (!didResolution.success || !didResolution.document) {
      errors.push(`Failed to resolve issuer DID: ${didResolution.error || 'Unknown error'}`);
      return { valid: false, errors, issuer: issuerDID };
    }

    // Step 5: Extract public key from DID Document
    const publicKey = extractPublicKeyFromDID(didResolution.document);

    if (!publicKey) {
      errors.push('No public key found in DID document');
      return { valid: false, errors, issuer: issuerDID };
    }

    // Step 6: Verify Issuer JWT signature
    const issuerVerification = await verifyJWTWithJWK(issuerJWT, publicKey);

    if (!issuerVerification.valid) {
      errors.push(
        `Issuer JWT signature verification failed: ${issuerVerification.error || 'Unknown error'}`
      );
      return { valid: false, errors, issuer: issuerDID };
    }

    // Step 7: Extract disclosed claims
    const disclosedClaims = decodedSDJWT.disclosures || {};

    // Check minimum disclosure requirement if specified
    const disclosureCount = Object.keys(disclosedClaims).length;

    if (opts.requireMinimumDisclosures && disclosureCount < opts.requireMinimumDisclosures) {
      warnings.push(
        `Only ${disclosureCount} claims disclosed, required minimum: ${opts.requireMinimumDisclosures}`
      );
    }

    // Step 8: Extract dates from JWT payload
    const payload = issuerVerification.payload || {};
    const issuanceDate = payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined;
    const expirationDate = payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined;

    // Check expiration
    if (opts.checkExpiration && payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      if (expDate < new Date()) {
        errors.push(`SD-JWT expired on ${expDate.toISOString()}`);
      }
    }

    // Step 9: Check trust anchor
    let trusted = false;
    if (opts.checkTrust) {
      const trustCheck = await isTrustedIssuer(issuerDID, opts.trustConfig);
      trusted = trustCheck.trusted;

      if (!trusted) {
        warnings.push(`Issuer not in trust anchor list: ${trustCheck.reason || 'Unknown'}`);
      }
    }

    // Return validation result
    if (errors.length > 0) {
      logger.warn('SD-JWT validation failed', { errors, issuer: issuerDID });
      return {
        valid: false,
        errors,
        warnings,
        issuer: issuerDID,
        disclosureCount,
      };
    }

    logger.info('SD-JWT validation successful', {
      issuer: issuerDID,
      trusted,
      disclosureCount,
    });

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      issuer: issuerDID,
      disclosedClaims,
      issuanceDate,
      expirationDate,
      trusted,
      disclosureCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('SD-JWT validation error', { error: errorMessage });
    return {
      valid: false,
      errors: [`Validation error: ${errorMessage}`],
    };
  }
}

/**
 * Verify age-over claim in SD-JWT
 * Privacy-preserving age verification without revealing exact birthdate
 */
export async function verifyAgeOver(
  sdJwtToken: string,
  minAge: number
): Promise<{ verified: boolean; ageOver?: number; error?: string }> {
  try {
    logger.info('Verifying age-over claim', { minAge });

    // Validate SD-JWT
    const validation = await validateSDJWT(sdJwtToken, {
      checkTrust: true,
      checkExpiration: true,
    });

    if (!validation.valid) {
      return {
        verified: false,
        error: `SD-JWT validation failed: ${validation.errors?.join(', ')}`,
      };
    }

    // Look for age_over_NN claims in disclosed claims
    const disclosedClaims = validation.disclosedClaims || {};

    // Check for specific age_over claim
    const ageOverKey = `age_over_${minAge}`;
    if (disclosedClaims[ageOverKey] === true) {
      logger.info('Age-over verification successful', { minAge, claim: ageOverKey });
      return { verified: true, ageOver: minAge };
    }

    // Check for higher age_over claims
    for (const key of Object.keys(disclosedClaims)) {
      if (key.startsWith('age_over_')) {
        const claimAge = parseInt(key.substring(9), 10);
        if (claimAge >= minAge && disclosedClaims[key] === true) {
          logger.info('Age-over verification successful (higher claim)', {
            minAge,
            claimAge,
          });
          return { verified: true, ageOver: claimAge };
        }
      }
    }

    // Check for birthdate disclosure (less privacy-preserving)
    if (disclosedClaims.birth_date || disclosedClaims.birthdate) {
      const birthDate = new Date(
        (disclosedClaims.birth_date || disclosedClaims.birthdate) as string
      );
      const age = calculateAge(birthDate);

      if (age >= minAge) {
        logger.info('Age-over verified via birthdate', { minAge, calculatedAge: age });
        return { verified: true, ageOver: age };
      } else {
        return { verified: false, error: `Age ${age} is below minimum ${minAge}` };
      }
    }

    return {
      verified: false,
      error: `No age_over_${minAge} claim found in disclosed claims`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Age-over verification error', { error: errorMessage });
    return { verified: false, error: errorMessage };
  }
}

/**
 * Get all disclosed claims from SD-JWT
 * Selective disclosure mechanism
 */
export async function verifySelectiveDisclosure(
  sdJwtToken: string
): Promise<{ success: boolean; claims?: Record<string, unknown>; error?: string }> {
  try {
    const validation = await validateSDJWT(sdJwtToken, {
      checkTrust: false,
      checkExpiration: false,
    });

    if (!validation.valid) {
      return {
        success: false,
        error: `SD-JWT validation failed: ${validation.errors?.join(', ')}`,
      };
    }

    logger.info('Selective disclosure verified', {
      disclosureCount: validation.disclosureCount,
    });

    return {
      success: true,
      claims: validation.disclosedClaims || {},
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Selective disclosure verification error', {
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Helper: Extract public key from DID document
 */
function extractPublicKeyFromDID(didDocument: any): any {
  // Try assertionMethod first
  if (didDocument.assertionMethod?.[0]?.publicKeyJwk) {
    return didDocument.assertionMethod[0].publicKeyJwk;
  }

  // Try verificationMethod
  if (didDocument.verificationMethod?.[0]?.publicKeyJwk) {
    return didDocument.verificationMethod[0].publicKeyJwk;
  }

  return null;
}

/**
 * Helper: Calculate age from birthdate
 */
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}
