import { logger } from '../config/logger';
import { verifyJWTWithJWK } from '../lib/jwt';
import {
  resolveDID,
  isTrustedIssuer,
  type DIDDocument,
  type TrustResolverConfig,
} from './TrustResolver';
import type { VerifiableCredential } from '../lib/presentationDefinition';

/**
 * Verifiable Credential Validator Service
 * Validates W3C Verifiable Credentials with trust chain verification
 *
 * Compliance References:
 * - W3C VC Data Model v1.1: https://www.w3.org/TR/vc-data-model/
 * - W3C VC Data Model v2.0: https://www.w3.org/TR/vc-data-model-2.0/
 * - eIDAS 2.0 Annex VI: Attestation validation requirements
 * - EUDI ARF 1.4.0 Section 6: Credential Formats
 *
 * Standards Alignment:
 * Based on eu-digital-identity-wallet/eudi-lib-*-openid4vp validation patterns
 */

export interface VCValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  issuer?: string;
  issuanceDate?: string;
  expirationDate?: string;
  trusted?: boolean;
  credentialSubject?: Record<string, unknown>;
}

export interface VCValidationOptions {
  checkTrust?: boolean;
  checkExpiration?: boolean;
  checkRevocation?: boolean; // TODO: Week 3.2
  trustConfig?: TrustResolverConfig;
}

/**
 * Validate a Verifiable Credential (JWT format)
 * Supports both VC 1.1 and VC 2.0 formats
 */
export async function validateVC(
  vcJWT: string,
  options: VCValidationOptions = {}
): Promise<VCValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    logger.info('Validating VC', { vcLength: vcJWT.length });

    // Default options
    const opts = {
      checkTrust: options.checkTrust ?? true,
      checkExpiration: options.checkExpiration ?? true,
      checkRevocation: options.checkRevocation ?? false,
      trustConfig: options.trustConfig,
    };

    // Step 1: Decode JWT to get issuer (iss claim)
    let vcPayload: any;
    let issuerDID: string;

    try {
      // JWT format: header.payload.signature
      const parts = vcJWT.split('.');
      if (parts.length !== 3) {
        errors.push('Invalid JWT format - expected 3 parts');
        return { valid: false, errors };
      }

      const payloadBase64 = parts[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      vcPayload = JSON.parse(payloadJson);

      // Extract issuer from JWT iss claim or VC issuer field
      issuerDID = vcPayload.iss || vcPayload.vc?.issuer || vcPayload.issuer;

      if (!issuerDID) {
        errors.push('Missing issuer in credential');
        return { valid: false, errors };
      }
    } catch (error) {
      errors.push(
        `Failed to decode VC JWT: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return { valid: false, errors };
    }

    // Step 2: Resolve issuer DID to get public key
    const didResolution = await resolveDID(issuerDID, opts.trustConfig);

    if (!didResolution.success || !didResolution.document) {
      errors.push(`Failed to resolve issuer DID: ${didResolution.error || 'Unknown error'}`);
      return { valid: false, errors, issuer: issuerDID };
    }

    const didDocument = didResolution.document;

    // Step 3: Extract public key from DID document
    const publicKey = extractPublicKeyFromDID(didDocument);

    if (!publicKey) {
      errors.push('No verification method with publicKeyJwk found in DID document');
      return { valid: false, errors, issuer: issuerDID };
    }

    // Step 4: Verify JWT signature
    const verification = await verifyJWTWithJWK(vcJWT, publicKey);

    if (!verification.valid) {
      errors.push(`JWT signature verification failed: ${verification.error || 'Unknown error'}`);
      return { valid: false, errors, issuer: issuerDID };
    }

    // Step 5: Extract and validate VC structure
    const vc: VerifiableCredential = verification.payload?.vc || (verification.payload as any);

    if (!vc) {
      errors.push('Missing vc claim in JWT payload');
      return { valid: false, errors, issuer: issuerDID };
    }

    // Validate required W3C VC fields
    if (!vc['@context']) {
      errors.push('Missing required field: @context');
    }
    if (!vc.type) {
      errors.push('Missing required field: type');
    }
    if (!vc.credentialSubject) {
      errors.push('Missing required field: credentialSubject');
    }

    // W3C VC Data Model: type must be array with "VerifiableCredential"
    const types = Array.isArray(vc.type) ? vc.type : [vc.type];
    if (!types.includes('VerifiableCredential')) {
      warnings.push('type array should include "VerifiableCredential"');
    }

    // Step 6: Check expiration if present
    const issuanceDate = vc.issuanceDate || vcPayload.iat;
    const expirationDate = vc.expirationDate || vcPayload.exp;

    if (opts.checkExpiration && expirationDate) {
      const expDate =
        typeof expirationDate === 'number'
          ? new Date(expirationDate * 1000)
          : new Date(expirationDate);

      if (expDate < new Date()) {
        errors.push(`Credential expired on ${expDate.toISOString()}`);
      }
    }

    // Step 7: Check trust anchor
    let trusted = false;
    if (opts.checkTrust) {
      const trustCheck = await isTrustedIssuer(issuerDID, opts.trustConfig);
      trusted = trustCheck.trusted;

      if (!trusted) {
        warnings.push(`Issuer not in trust anchor list: ${trustCheck.reason || 'Unknown reason'}`);
      }
    }

    // Step 8: Check revocation status (placeholder for Week 3.2)
    if (opts.checkRevocation) {
      warnings.push('Revocation checking not yet implemented');
    }

    // Return validation result
    if (errors.length > 0) {
      logger.warn('VC validation failed', { errors, issuer: issuerDID });
      return {
        valid: false,
        errors,
        warnings,
        issuer: issuerDID,
        issuanceDate: issuanceDate?.toString(),
        expirationDate: expirationDate?.toString(),
        trusted,
      };
    }

    logger.info('VC validation successful', {
      issuer: issuerDID,
      trusted,
      hasExpiration: !!expirationDate,
    });

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      issuer: issuerDID,
      issuanceDate: issuanceDate?.toString(),
      expirationDate: expirationDate?.toString(),
      trusted,
      credentialSubject: vc.credentialSubject,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('VC validation error', { error: errorMessage });
    return {
      valid: false,
      errors: [`Validation error: ${errorMessage}`],
    };
  }
}

/**
 * Extract public key JWK from DID document
 * Looks for verification method with assertionMethod or general verificationMethod
 */
function extractPublicKeyFromDID(didDocument: DIDDocument): jose.JWK | null {
  // Priority 1: assertionMethod (used for credential signing)
  if (didDocument.assertionMethod && didDocument.assertionMethod.length > 0) {
    const assertionMethod = didDocument.assertionMethod[0];

    if (typeof assertionMethod === 'object' && 'publicKeyJwk' in assertionMethod) {
      return assertionMethod.publicKeyJwk || null;
    }

    // If assertionMethod is a reference, look it up in verificationMethod
    if (typeof assertionMethod === 'string' && didDocument.verificationMethod) {
      const vm = didDocument.verificationMethod.find((v) => v.id === assertionMethod);
      if (vm?.publicKeyJwk) {
        return vm.publicKeyJwk;
      }
    }
  }

  // Priority 2: First verificationMethod with publicKeyJwk
  if (didDocument.verificationMethod && didDocument.verificationMethod.length > 0) {
    for (const vm of didDocument.verificationMethod) {
      if (vm.publicKeyJwk) {
        return vm.publicKeyJwk;
      }
    }
  }

  logger.warn('No public key found in DID document', { did: didDocument.id });
  return null;
}

/**
 * Validate multiple VCs in batch
 * Useful for Verifiable Presentations with multiple credentials
 */
export async function validateVCBatch(
  vcJWTs: string[],
  options: VCValidationOptions = {}
): Promise<{
  valid: boolean;
  results: VCValidationResult[];
  allTrusted: boolean;
}> {
  try {
    logger.info('Validating VC batch', { count: vcJWTs.length });

    const results = await Promise.all(vcJWTs.map((vcJWT) => validateVC(vcJWT, options)));

    const allValid = results.every((r) => r.valid);
    const allTrusted = results.every((r) => r.trusted === true);

    logger.info('VC batch validation complete', {
      total: vcJWTs.length,
      valid: results.filter((r) => r.valid).length,
      trusted: results.filter((r) => r.trusted).length,
    });

    return {
      valid: allValid,
      results,
      allTrusted,
    };
  } catch (error) {
    logger.error('VC batch validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
