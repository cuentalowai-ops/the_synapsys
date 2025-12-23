import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { logger } from '../config/logger';

/**
 * Encryption Service for Data-at-Rest Protection
 *
 * Compliance References:
 * - NIS2 Directive Art. 21(2)(c): Encryption measures for network and information systems
 * - ISO 27001 A.10.1: Cryptographic controls
 * - GDPR Art. 32(1)(a): Encryption of personal data
 * - eIDAS 2.0 Art. 45: Security measures for WRP
 *
 * Implementation:
 * - Algorithm: AES-256-GCM (NIST approved, authenticated encryption)
 * - Key derivation: scrypt (OWASP recommended for 2024+)
 * - IV: Random 16 bytes per encryption (never reused)
 * - Auth tag: 16 bytes for integrity verification
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SCRYPT_COST = 16384; // N parameter (CPU/memory cost)

/**
 * Encryption Service Class
 * Singleton pattern - initialized once with master key
 */
export class EncryptionService {
  private key: Buffer;

  constructor(masterKey: string) {
    if (!masterKey || masterKey.length < 32) {
      logger.warn('SECURITY WARNING: Master key too short. Use 32+ characters in production!');
    }

    // Derive 256-bit key from master key using scrypt
    // Salt is static (application-specific) - NOT cryptographic salt
    this.key = scryptSync(masterKey, 'synapsys-eudi-wrp-2025', KEY_LENGTH, {
      N: SCRYPT_COST,
      r: 8,
      p: 1,
    });

    logger.info('Encryption service initialized', {
      algorithm: ALGORITHM,
      keyLength: KEY_LENGTH * 8, // bits
    });
  }

  /**
   * Encrypt plaintext (NIS2 Article 21 compliance)
   * Returns: hex-encoded IV + AuthTag + Ciphertext
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV (NEVER reuse)
      const iv = randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = createCipheriv(ALGORITHM, this.key, iv);

      // Encrypt
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine: IV (32 hex) + AuthTag (32 hex) + Ciphertext (variable hex)
      const encrypted = iv.toString('hex') + authTag.toString('hex') + ciphertext;

      logger.debug('Data encrypted', { length: encrypted.length });

      return encrypted;
    } catch (error) {
      logger.error('Encryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt ciphertext
   * Input: hex-encoded IV + AuthTag + Ciphertext
   */
  decrypt(encrypted: string): string {
    try {
      // Parse components
      const ivHex = encrypted.slice(0, IV_LENGTH * 2);
      const authTagHex = encrypted.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2);
      const ciphertextHex = encrypted.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Create decipher
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      logger.debug('Data decrypted successfully');

      return plaintext;
    } catch (error) {
      logger.error('Decryption failed - possible tampering or wrong key', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Encrypt JSON object
   * Convenience method for structured data
   */
  encryptJSON(data: Record<string, unknown>): string {
    return this.encrypt(JSON.stringify(data));
  }

  /**
   * Decrypt to JSON object
   */
  decryptJSON(encrypted: string): Record<string, unknown> {
    const plaintext = this.decrypt(encrypted);
    return JSON.parse(plaintext) as Record<string, unknown>;
  }
}

/**
 * Singleton instance
 * Initialized with ENCRYPTION_MASTER_KEY from environment
 *
 * CRITICAL SECURITY NOTE:
 * - NEVER commit ENCRYPTION_MASTER_KEY to git
 * - Rotate master key every 90 days (OWASP recommendation)
 * - Use secrets manager in production (AWS Secrets Manager, GCP Secret Manager, etc.)
 * - Master key should be 32+ random characters
 */
export const encryption = new EncryptionService(
  process.env.ENCRYPTION_MASTER_KEY || 'DEV_ONLY_KEY_CHANGE_IN_PRODUCTION_32_CHARS_MIN'
);

/**
 * Validate encryption/decryption (health check)
 */
export function testEncryption(): boolean {
  try {
    const testData = 'NIS2 compliance test ' + Date.now();
    const encrypted = encryption.encrypt(testData);
    const decrypted = encryption.decrypt(encrypted);

    if (testData !== decrypted) {
      logger.error('Encryption test failed - decrypt mismatch');
      return false;
    }

    logger.info('Encryption self-test passed');
    return true;
  } catch (error) {
    logger.error('Encryption self-test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
