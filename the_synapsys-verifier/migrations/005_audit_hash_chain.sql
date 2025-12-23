-- Migration 005: Audit Log Hash Chain for Tamper-Evidence
-- Adds cryptographic hash chain to audit_logs for integrity verification
--
-- Compliance:
-- - ISO 27001 A.12.4.2: Protection of log information
-- - ISO 27001 A.12.4.3: Administrator and operator logs
-- - NIS2 Directive Article 21: Security measures
-- - eIDAS 2.0 Article 64: Audit trail integrity

BEGIN;

-- Add hash chain columns to audit_logs
ALTER TABLE audit_logs 
  ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);

-- Create index for hash verification queries
CREATE INDEX IF NOT EXISTS idx_audit_hash ON audit_logs(current_hash);

-- Add comments for documentation
COMMENT ON COLUMN audit_logs.previous_hash IS 
  'SHA-256 hash of previous audit log entry - creates tamper-evident chain';

COMMENT ON COLUMN audit_logs.current_hash IS 
  'SHA-256 hash of current entry (event_type + actor + action + result + metadata + previous_hash)';

COMMENT ON TABLE audit_logs IS 
  'eIDAS 2.0 Art. 64 + ISO 27001 A.12.4.2 compliant audit log - APPEND ONLY with hash chain - 3 year retention';

COMMIT;
