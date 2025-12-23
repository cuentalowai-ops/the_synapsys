-- Migration 004: NIS2 Encryption Support for Sensitive Data
-- Adds encrypted columns to vp_sessions table
--
-- Compliance:
-- - NIS2 Directive Article 21(2)(c): Encryption of stored data
-- - ISO 27001 A.10.1.1: Cryptographic controls policy
-- - GDPR Article 32(1)(a): Encryption of personal data

BEGIN;

-- Add encrypted columns to vp_sessions
ALTER TABLE vp_sessions 
  ADD COLUMN IF NOT EXISTS redirect_uri_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS presentation_definition_encrypted TEXT;

-- Add comments for documentation
COMMENT ON COLUMN vp_sessions.redirect_uri_encrypted IS 
  'AES-256-GCM encrypted redirect_uri (NIS2 Article 21)';

COMMENT ON COLUMN vp_sessions.presentation_definition_encrypted IS 
  'AES-256-GCM encrypted presentation definition (NIS2 Article 21)';

COMMENT ON TABLE vp_sessions IS 
  'OpenID4VP sessions with NIS2-compliant encryption for sensitive fields';

COMMIT;
