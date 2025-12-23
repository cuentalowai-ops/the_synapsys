import { logger } from '../config/logger';
import * as cbor from 'cbor';

/**
 * Mobile Document (mDoc) Decoder Service
 * Decodes and validates ISO 18013-5 mobile driving licenses and other mDocs
 *
 * Compliance References:
 * - ISO/IEC 18013-5:2021: Mobile Driving License (mDL)
 * - EUDI ARF 1.4.0 Section 6.4: mDoc format for PID and attestations
 * - eIDAS 2.0 Annex VI: mDoc support requirements
 *
 * Standards Alignment:
 * Based on ISO 18013-5 CBOR encoding and Mobile Security Object (MSO)
 * Compatible with EUDI Wallet mDoc implementations
 */

export interface MDocData {
  docType: string; // e.g., "org.iso.18013.5.1.mDL"
  nameSpaces: Record<string, Record<string, unknown>>;
  issuerAuth?: IssuerAuth;
  deviceAuth?: DeviceAuth;
}

export interface IssuerAuth {
  mso: MobileSecurityObject;
  signature: Buffer;
  algorithm: string;
}

export interface MobileSecurityObject {
  version: string;
  digestAlgorithm: string;
  valueDigests: Record<string, Record<string, Buffer>>;
  deviceKeyInfo: {
    deviceKey: Record<string, unknown>;
  };
  docType: string;
  validityInfo: {
    signed: Date;
    validFrom: Date;
    validUntil: Date;
  };
}

export interface DeviceAuth {
  deviceSignature?: Buffer;
  deviceMac?: Buffer;
}

export interface DrivingLicense {
  family_name: string;
  given_name: string;
  birth_date: string;
  issue_date: string;
  expiry_date: string;
  issuing_country: string;
  issuing_authority: string;
  document_number: string;
  portrait?: Buffer;
  driving_privileges?: Array<{
    vehicle_category_code: string;
    issue_date: string;
    expiry_date: string;
  }>;
  [key: string]: unknown;
}

/**
 * Decode mobile document (mDoc) from CBOR bytes
 * ISO 18013-5 format: CBOR-encoded with issuer and device authentication
 */
export async function decodeMobileDocument(
  mdocBytes: Buffer
): Promise<{ success: boolean; data?: MDocData; error?: string }> {
  try {
    logger.info('Decoding mDoc', { size: mdocBytes.length });

    // Step 1: Decode CBOR
    let cborData: any;

    try {
      cborData = cbor.decode(mdocBytes);
    } catch (error) {
      return {
        success: false,
        error: `CBOR decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Step 2: Extract mDoc structure
    // ISO 18013-5 Structure: Device Response → Documents array
    const documents = cborData?.documents || [cborData];

    if (!Array.isArray(documents) || documents.length === 0) {
      return {
        success: false,
        error: 'No documents found in mDoc structure',
      };
    }

    const document = documents[0];

    // Step 3: Extract docType and namespaces
    const docType = document.docType || 'unknown';
    const issuerSigned = document.issuerSigned || {};
    const nameSpaces: Record<string, Record<string, unknown>> = {};

    // Parse namespaces (contains actual data elements)
    if (issuerSigned.nameSpaces) {
      for (const ns in issuerSigned.nameSpaces) {
        const items = issuerSigned.nameSpaces[ns];
        nameSpaces[ns] = {};

        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.elementIdentifier && item.elementValue !== undefined) {
              nameSpaces[ns][item.elementIdentifier] = item.elementValue;
            }
          }
        }
      }
    }

    // Step 4: Extract issuer authentication (MSO)
    const issuerAuth = issuerSigned.issuerAuth
      ? parseIssuerAuth(issuerSigned.issuerAuth)
      : undefined;

    // Step 5: Extract device authentication (optional for offline verification)
    const deviceAuth = document.deviceSigned ? parseDeviceAuth(document.deviceSigned) : undefined;

    const mdocData: MDocData = {
      docType,
      nameSpaces,
      issuerAuth,
      deviceAuth,
    };

    logger.info('mDoc decoded successfully', {
      docType,
      namespaceCount: Object.keys(nameSpaces).length,
      hasIssuerAuth: !!issuerAuth,
    });

    return { success: true, data: mdocData };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('mDoc decoding error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Validate Mobile Driving License (mDL) specific format
 * ISO 18013-5:2021 compliance
 */
export async function validateMDL(mdocBytes: Buffer): Promise<{
  valid: boolean;
  license?: DrivingLicense;
  errors?: string[];
}> {
  const errors: string[] = [];

  try {
    // Decode mDoc
    const decoded = await decodeMobileDocument(mdocBytes);

    if (!decoded.success || !decoded.data) {
      return {
        valid: false,
        errors: [decoded.error || 'Failed to decode mDoc'],
      };
    }

    const mdoc = decoded.data;

    // Validate docType is mDL
    if (mdoc.docType !== 'org.iso.18013.5.1.mDL' && !mdoc.docType.includes('mDL')) {
      errors.push(`Expected mDL docType, got: ${mdoc.docType}`);
    }

    // Extract mDL namespace (org.iso.18013.5.1)
    const mdlNamespace = mdoc.nameSpaces['org.iso.18013.5.1'] || mdoc.nameSpaces.mDL || {};

    // Validate required fields (ISO 18013-5 mandatory data elements)
    const requiredFields = [
      'family_name',
      'given_name',
      'birth_date',
      'issue_date',
      'expiry_date',
      'issuing_country',
      'document_number',
    ];

    for (const field of requiredFields) {
      if (!(field in mdlNamespace)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Construct DrivingLicense object
    const license: DrivingLicense = {
      family_name: mdlNamespace.family_name as string,
      given_name: mdlNamespace.given_name as string,
      birth_date: mdlNamespace.birth_date as string,
      issue_date: mdlNamespace.issue_date as string,
      expiry_date: mdlNamespace.expiry_date as string,
      issuing_country: mdlNamespace.issuing_country as string,
      issuing_authority: (mdlNamespace.issuing_authority as string) || 'unknown',
      document_number: mdlNamespace.document_number as string,
      portrait: mdlNamespace.portrait as Buffer | undefined,
      driving_privileges: mdlNamespace.driving_privileges as any,
    };

    logger.info('mDL validated successfully', {
      documentNumber: license.document_number,
      issuingCountry: license.issuing_country,
    });

    return { valid: true, license };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('mDL validation error', { error: errorMessage });
    return { valid: false, errors: [errorMessage] };
  }
}

/**
 * Verify Mobile Security Object (MSO) signature
 * TODO: Implement full MSO signature verification with issuer certificates
 */
export async function verifyMSO(
  mso: MobileSecurityObject
): Promise<{ valid: boolean; error?: string }> {
  try {
    logger.info('Verifying MSO', { docType: mso.docType });

    // Basic validation
    if (!mso.version || !mso.digestAlgorithm) {
      return { valid: false, error: 'Invalid MSO structure' };
    }

    // Check validity period
    const now = new Date();
    if (mso.validityInfo.validFrom > now) {
      return { valid: false, error: 'MSO not yet valid' };
    }

    if (mso.validityInfo.validUntil < now) {
      return { valid: false, error: 'MSO expired' };
    }

    // TODO: Verify digest algorithm is approved (SHA-256, SHA-384, SHA-512)
    // TODO: Verify value digests match actual data elements
    // TODO: Verify MSO signature with issuer certificate from IACA

    logger.warn('MSO verification incomplete - signature check not yet implemented');

    return { valid: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('MSO verification error', { error: errorMessage });
    return { valid: false, error: errorMessage };
  }
}

/**
 * Parse issuer authentication from CBOR
 */
function parseIssuerAuth(issuerAuthCBOR: any): IssuerAuth | undefined {
  try {
    // ISO 18013-5: IssuerAuth is a COSE_Sign1 structure
    if (!issuerAuthCBOR) return undefined;

    return {
      mso: {} as MobileSecurityObject, // TODO: Parse MSO from protected headers
      signature: Buffer.from(issuerAuthCBOR.signature || []),
      algorithm: issuerAuthCBOR.algorithm || 'ES256',
    };
  } catch (error) {
    logger.warn('Failed to parse issuer auth', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return undefined;
  }
}

/**
 * Parse device authentication from CBOR
 */
function parseDeviceAuth(deviceSignedCBOR: any): DeviceAuth | undefined {
  try {
    if (!deviceSignedCBOR) return undefined;

    return {
      deviceSignature: deviceSignedCBOR.deviceSignature
        ? Buffer.from(deviceSignedCBOR.deviceSignature)
        : undefined,
      deviceMac: deviceSignedCBOR.deviceMac ? Buffer.from(deviceSignedCBOR.deviceMac) : undefined,
    };
  } catch (error) {
    logger.warn('Failed to parse device auth', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return undefined;
  }
}
