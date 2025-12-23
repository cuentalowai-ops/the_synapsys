-- Migration 006: Multi-Wallet Integration
-- Creates tables for managing multiple EUDI-compliant wallet providers
--
-- Compliance:
-- - eIDAS 2.0: EUDI Wallet ecosystem support
-- - OpenID4VP 1.0: Multi-wallet capability
-- - ARF 1.4.0: Wallet provider specifications

BEGIN;

-- Table: wallet_providers
-- Stores registered EUDI-compliant wallet providers (Gataca, iGrant.io, etc.)
CREATE TABLE IF NOT EXISTS wallet_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL, -- 'gataca', 'igrant', 'other'
  authorization_endpoint TEXT NOT NULL,
  metadata JSONB NOT NULL, -- Full WalletMetadata object
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_wallet_id (wallet_id),
  INDEX idx_provider_type (provider_type),
  INDEX idx_is_active (is_active)
);

-- Table: wallet_sessions
-- Tracks active wallet sessions for multi-wallet authorization flows
CREATE TABLE IF NOT EXISTS wallet_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  wallet_provider_id UUID REFERENCES wallet_providers(id) ON DELETE CASCADE,
  user_identifier VARCHAR(255),
  presentation_response JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'expired', 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  -- Indexes
  INDEX idx_wallet_sessions_session_id (session_id),
  INDEX idx_wallet_sessions_provider (wallet_provider_id),
  INDEX idx_wallet_sessions_status (status),
  INDEX idx_wallet_sessions_expires (expires_at)
);

-- Comments for documentation
COMMENT ON TABLE wallet_providers IS 
  'Registry of EUDI-compliant wallet providers (Gataca, iGrant.io, etc.) - OpenID4VP multi-wallet support';

COMMENT ON TABLE wallet_sessions IS 
  'Active wallet sessions for multi-wallet authorization flows - tracks user interactions per wallet';

COMMENT ON COLUMN wallet_providers.metadata IS 
  'Full WalletMetadata JSON object including capabilities, supported formats, and OpenID4VP version';

COMMENT ON COLUMN wallet_sessions.presentation_response IS 
  'VP token and presentation submission from wallet - stored for analytics';

COMMIT;
