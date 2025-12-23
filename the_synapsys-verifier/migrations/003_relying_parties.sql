-- Migration 003: Relying Party Management
-- Creates tables for multi-tenant RP support with OAuth 2.0 client credentials
--
-- Compliance:
-- - eIDAS 2.0 Art. 45: WRP multi-client support
-- - OAuth 2.0 RFC 6749: Client credentials flow
-- - ISO 27001 A.9: Access control
-- - GDPR Art. 25: Privacy by design

BEGIN;

-- Table: relying_parties
-- Stores registered Relying Party organizations using the verifier service
CREATE TABLE IF NOT EXISTS relying_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  client_id VARCHAR(255) UNIQUE NOT NULL,
  client_secret_hash VARCHAR(255) NOT NULL, -- bcrypt hash, NEVER store plaintext
  callback_url TEXT,
  allowed_origins TEXT[], -- CORS origins for this RP
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, revoked
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  metadata JSONB, -- Flexible storage for RP-specific config
  
  -- Indexes
  INDEX idx_rp_client_id (client_id),
  INDEX idx_rp_status (status),
  INDEX idx_rp_created_at (created_at)
);

-- Table: api_keys  
-- Alternative authentication method for RPs (simpler than OAuth for some use cases)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rp_id UUID NOT NULL REFERENCES relying_parties(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE, -- bcrypt hash of API key
  name VARCHAR(255) NOT NULL, -- Human-readable name for the key
  status VARCHAR(50) DEFAULT 'active', -- active, revoked
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiration
  
  -- Indexes
  INDEX idx_api_key_rp (rp_id),
  INDEX idx_api_key_status (status),
  INDEX idx_api_key_expires (expires_at)
);

-- Table: rp_verification_sessions
-- Links verification sessions to specific RPs for analytics
CREATE TABLE IF NOT EXISTS rp_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rp_id UUID NOT NULL REFERENCES relying_parties(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES vp_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  success BOOLEAN,
  
  -- Indexes for analytics queries
  INDEX idx_rpvs_rp_id (rp_id),
  INDEX idx_rpvs_session_id (session_id),
  INDEX idx_rpvs_created_at (created_at),
  INDEX idx_rpvs_success (success)
);

-- Comments for documentation
COMMENT ON TABLE relying_parties IS 
  'Registered Relying Parties using Synapsys verifier service - OAuth 2.0 clients';

COMMENT ON TABLE api_keys IS 
  'API Keys for RP authentication - Alternative to OAuth client credentials';

COMMENT ON TABLE rp_verification_sessions IS 
  'Links verification sessions to RPs for analytics and billing';

COMMENT ON COLUMN relying_parties.client_secret_hash IS 
  'bcrypt hash of client_secret - NEVER store plaintext (OWASP A02:2021)';

COMMENT ON COLUMN api_keys.key_hash IS 
  'bcrypt hash of API key - NEVER store plaintext (OWASP A02:2021)';

COMMIT;
