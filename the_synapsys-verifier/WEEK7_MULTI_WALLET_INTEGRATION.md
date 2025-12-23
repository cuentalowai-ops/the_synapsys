# Week 7: Multi-Wallet Integration

## Overview

Implement multi-wallet support for the SYNAPSYS EUDI Wallet Relying Party, enabling seamless integration with multiple EUDI-compliant wallets including Gataca and iGrant.io.

## Objectives

1. **Wallet Discovery Service** - Automatic wallet capability detection
2. **Gataca Wallet Integration** - Full OpenID4VP integration with Gataca
3. **iGrant.io Wallet Integration** - Full OpenID4VP integration with iGrant.io
4. **Multi-Wallet Session Management** - Handle concurrent wallet sessions
5. **Wallet Metadata Registry** - Centralized wallet configuration

## Technical Requirements

### 1. Wallet Discovery Service

**File**: `src/services/WalletDiscoveryService.ts`

```typescript
interface WalletMetadata {
  walletId: string;
  name: string;
  provider: 'gataca' | 'igrant' | 'other';
  authorizationEndpoint: string;
  openid4vpVersion: string;
  supportedFormats: string[];
  capabilities: {
    sdJwt: boolean;
    mdoc: boolean;
    w3cVc: boolean;
  };
}
```

**Features**:
- Discover wallet capabilities via OpenID4VP discovery endpoints
- Cache wallet metadata
- Validate wallet compliance
- Support for custom wallet schemes (mdoc-openid4vp://, openid4vp://)

### 2. Gataca Wallet Integration

**File**: `src/services/GatacaWalletService.ts`

**Based on**: [web:12][web:13]

**Key Implementation Points**:
- Integrate with Gataca Vouch OIDC flow
- Configure IDP host and client credentials
- Handle authorization requests with proper scopes
- Implement callback handling for VP responses
- Support QR code and deep link flows

**Configuration**:
```typescript
interface GatacaConfig {
  idpHost: string; // Gataca Vouch base URL
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[]; // ['openid', 'profile', 'email', ...]
}
```

### 3. iGrant.io Wallet Integration

**File**: `src/services/IGrantWalletService.ts`

**Based on**: [web:17][web:18]

**Key Implementation Points**:
- Implement OpenID4VCI and OpenID4VP workflows
- Support SD-JWT selective disclosure
- Handle authorization endpoint interactions
- Support both NFC and QR code presentation methods
- GDPR-compliant data exchange

**Configuration**:
```typescript
interface IGrantConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  presentationEndpoint: string;
  supportedFormats: ['sd-jwt', 'mdoc', 'w3c-vc'];
  privacyMode: 'selective-disclosure' | 'full';
}
```

### 4. Multi-Wallet Authorization Handler

**File**: `src/services/MultiWalletAuthService.ts`

**Features**:
- Dynamic wallet selection based on user preference
- Unified authorization request generation
- Wallet-specific response handling
- Fallback mechanism if primary wallet fails

### 5. Database Schema Updates

**Migration**: `migrations/006_wallet_integrations.sql`

```sql
-- Wallet providers registry
CREATE TABLE wallet_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL,
  authorization_endpoint TEXT NOT NULL,
  metadata JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallet sessions
CREATE TABLE wallet_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  wallet_provider_id UUID REFERENCES wallet_providers(id),
  user_identifier VARCHAR(255),
  presentation_response JSONB,
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_wallet_sessions_session_id ON wallet_sessions(session_id);
CREATE INDEX idx_wallet_providers_wallet_id ON wallet_providers(wallet_id);
```

## API Endpoints

### GET /api/v1/wallets/discover
Discover available wallet providers

**Response**:
```json
{
  "wallets": [
    {
      "walletId": "gataca",
      "name": "Gataca Wallet",
      "provider": "gataca",
      "capabilities": {
        "sdJwt": true,
        "mdoc": true,
        "w3cVc": true
      }
    },
    {
      "walletId": "igrant",
      "name": "iGrant.io Data Wallet",
      "provider": "igrant",
      "capabilities": {
        "sdJwt": true,
        "mdoc": true,
        "w3cVc": true
      }
    }
  ]
}
```

### POST /api/v1/authorize/wallet
Initiate authorization with specific wallet

**Request**:
```json
{
  "walletProvider": "gataca",
  "presentationDefinition": { ... },
  "nonce": "xyz123"
}
```

**Response**:
```json
{
  "authorizationUrl": "openid4vp://...",
  "qrCode": "data:image/png;base64,...",
  "sessionId": "abc123",
  "expiresIn": 300
}
```

## Environment Variables

```bash
# Gataca Configuration
GATACA_IDP_HOST=https://vouch.gataca.io
GATACA_CLIENT_ID=your-client-id
GATACA_CLIENT_SECRET=your-client-secret
GATACA_REDIRECT_URI=https://synapsys.io/callback/gataca

# iGrant.io Configuration
IGRANT_AUTHORIZATION_ENDPOINT=https://api.igrant.io/v1/auth
IGRANT_TOKEN_ENDPOINT=https://api.igrant.io/v1/token
IGRANT_PRESENTATION_ENDPOINT=https://api.igrant.io/v1/present
IGRANT_CLIENT_ID=your-client-id
IGRANT_CLIENT_SECRET=your-client-secret

# Multi-Wallet Settings
WALLET_DISCOVERY_CACHE_TTL=3600
WALLET_SESSION_TIMEOUT=300
```

## Testing Strategy

### Unit Tests
- Test wallet discovery logic
- Test wallet-specific request generation
- Test response parsing for each wallet
- Test fallback mechanisms

### Integration Tests
- Test full authorization flow with Gataca (mock)
- Test full authorization flow with iGrant.io (mock)
- Test multi-wallet concurrent sessions
- Test wallet metadata caching

### Manual Testing
- Test with actual Gataca Wallet app
- Test with actual iGrant.io Data Wallet app
- Test QR code flows
- Test deep link flows
- Test error scenarios

## Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Create WalletDiscoveryService
- [ ] Create database migration
- [ ] Implement wallet metadata registry
- [ ] Add wallet discovery endpoint

### Phase 2: Gataca Integration (Days 2-3)
- [ ] Implement GatacaWalletService
- [ ] Configure Gataca Vouch OIDC
- [ ] Test with Gataca test environment
- [ ] Add Gataca-specific tests

### Phase 3: iGrant.io Integration (Days 3-4)
- [ ] Implement IGrantWalletService
- [ ] Configure OpenID4VP flows
- [ ] Test with iGrant.io sandbox
- [ ] Add iGrant-specific tests

### Phase 4: Multi-Wallet Orchestration (Days 4-5)
- [ ] Implement MultiWalletAuthService
- [ ] Add wallet selection UI support
- [ ] Implement session management
- [ ] Add comprehensive integration tests

### Phase 5: Documentation & Finalization (Day 5)
- [ ] Update API documentation
- [ ] Create wallet integration guides
- [ ] Update deployment configurations
- [ ] Final testing with both wallets

## Compliance Notes

- **eIDAS 2.0**: Both wallets comply with EU Digital Identity Wallet specifications
- **OpenID4VP**: Standard protocol ensures interoperability
- **GDPR**: Selective disclosure and minimal data sharing principles
- **Privacy**: User consent required for all credential presentations

## Success Criteria

✅ Users can select between Gataca and iGrant.io wallets
✅ Authorization flow works with both wallets
✅ QR code and deep link flows supported
✅ Wallet metadata properly cached and managed
✅ 85%+ test coverage for new code
✅ All integration tests passing
✅ Documentation complete

## References

- [Gataca Vouch Integration](https://docs.gataca.io/developers/technical-integration/gataca-vouch-integration)
- [iGrant.io OpenID4VC Guide](https://igrant.io/articles/eudi-wallets-with-openid-for-verifiable-credentials-openid4vc.html)
- [OpenID4VP Specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [W3C Digital Credentials API](https://wicg.github.io/digital-credentials/)

## Next Steps (Week 8)

After completing Week 7:
- Build React dashboard for wallet management
- Add wallet analytics and monitoring
- Implement wallet health checks
- Add support for additional EUDI wallets
