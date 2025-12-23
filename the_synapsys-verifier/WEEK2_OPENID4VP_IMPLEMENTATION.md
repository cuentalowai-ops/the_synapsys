# Week 2: OpenID4VP Protocol Implementation

## Overview

This document describes the OpenID4VP (OpenID for Verifiable Presentations) implementation for the Synapsys EUDI Wallet Relying Party, compliant with eIDAS 2.0 Annex VI (ARF 1.4.0).

## Implementation Status

### ✅ Completed Features

#### 1. Database Layer
- **File**: `src/config/database.ts`
- PostgreSQL connection pool with automatic retry
- Schema initialization for VP sessions
- Session lifecycle management
- Graceful shutdown handling

#### 2. JWT Validation Library
- **File**: `src/lib/jwt.ts`
- **Supported Algorithms**: RS256, ES256, ES256K, EdDSA
- JWK (JSON Web Key) verification
- JWKS (JSON Web Key Set) URL support
- JWT creation for testing
- Expiration and Not-Before validation

#### 3. Presentation Definition Parser
- **File**: `src/lib/presentationDefinition.ts`
- DIF Presentation Exchange v2.0.0 compliant
- Schema validation for Presentation Definitions
- Presentation Submission validation
- Credential matching and evaluation

#### 4. Session Management Service
- **File**: `src/services/sessionService.ts`
- Cryptographically secure state/nonce generation
- Session CRUD operations
- Automatic expired session cleanup
- PostgreSQL-backed persistence

#### 5. Authorization Endpoint
- **File**: `src/routes/authorize.ts`
- **Endpoint**: `GET /authorize`
- OpenID4VP authorization request handler
- Presentation Definition parsing
- Session creation
- Authorization Request URI generation

#### 6. Direct Post Endpoint
- **File**: `src/routes/directPost.ts`
- **Endpoint**: `POST /direct_post`
- VP token reception from wallets
- JWT-based VP validation
- Presentation Submission evaluation
- Session completion

## Architecture

```
┌─────────────────┐
│   EUDI Wallet   │
└────────┬────────┘
         │ 1. Scan QR / Deep Link
         ▼
┌─────────────────────────────────┐
│  GET /authorize                 │
│  - Create session               │
│  - Generate state/nonce         │
│  - Return auth request URI      │
└────────┬────────────────────────┘
         │ 2. Authorization Request
         ▼
┌─────────────────┐
│   EUDI Wallet   │
│  (User consent) │
└────────┬────────┘
         │ 3. VP Token
         ▼
┌─────────────────────────────────┐
│  POST /direct_post              │
│  - Validate VP token            │
│  - Verify presentation          │
│  - Complete session             │
└─────────────────────────────────┘
```

## API Endpoints

### GET /authorize

Initiates OpenID4VP authorization flow.

**Query Parameters:**
- `response_type` (required): Must be `vp_token`
- `client_id` (optional): Client identifier
- `redirect_uri` (optional): Callback URL
- `presentation_definition` (optional): Inline PD as JSON
- `presentation_definition_uri` (optional): URL to fetch PD

**Response:**
```json
{
  "authorization_request_uri": "openid4vp://?response_type=vp_token&...",
  "state": "random_state_value",
  "expires_in": 900,
  "presentation_definition": { ... }
}
```

### POST /direct_post

Receives VP token from wallet.

**Body Parameters:**
- `vp_token` (required): JWT-encoded Verifiable Presentation
- `presentation_submission` (required): Presentation Submission JSON
- `state` (required): State parameter from authorization request

**Response (Success):**
```json
{
  "status": "success",
  "message": "VP token received and validated successfully"
}
```

**Response (With Redirect):**
```json
{
  "redirect_uri": "https://client.example.com/callback?state=..."
}
```

## Database Schema

### vp_sessions Table

```sql
CREATE TABLE vp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR(255) UNIQUE NOT NULL,
  nonce VARCHAR(255) NOT NULL,
  presentation_definition JSONB NOT NULL,
  redirect_uri TEXT,
  client_id VARCHAR(255),
  response_mode VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  vp_token TEXT,
  presentation_submission JSONB,
  completed_at TIMESTAMP
);

CREATE INDEX idx_state ON vp_sessions(state);
CREATE INDEX idx_expires_at ON vp_sessions(expires_at);
CREATE INDEX idx_status ON vp_sessions(status);
CREATE INDEX idx_expired_sessions ON vp_sessions(expires_at) 
  WHERE status = 'pending';
```

## Configuration

### Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=synapsys_verifier
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Server Configuration
PORT=3000
NODE_ENV=production

# Logging
LOG_LEVEL=info
```

## Security Features

### 1. Cryptographic Security
- State and nonce generated using `crypto.randomBytes(32)`
- Base64URL encoding for URL-safe parameters
- JWT signature verification

### 2. Session Management
- 15-minute session expiration by default
- Automatic cleanup of expired sessions
- One-time use sessions (status transitions)

### 3. Validation Layers
1. Parameter validation (required fields, format)
2. JWT structure and signature validation
3. Presentation Definition schema validation
4. Presentation Submission evaluation
5. Credential matching against requirements

## Standards Compliance

### OpenID4VP
- OpenID for Verifiable Presentations 1.0
- Response mode: `direct_post`
- Response type: `vp_token`

### DIF Presentation Exchange
- Presentation Exchange v2.0.0
- Input Descriptors
- Submission Requirements
- Descriptor Mapping

### eIDAS 2.0
- ARF 1.4.0 (Architecture and Reference Framework)
- Annex VI compliance
- Trust Framework requirements

### W3C Standards
- Verifiable Credentials Data Model
- Verifiable Presentations
- JSON-LD context support

## Testing

### Unit Tests (TODO)
```bash
npm test
```

### Integration Tests (TODO)
```bash
npm run test:integration
```

### Manual Testing

1. Start PostgreSQL:
```bash
docker run -d \
  --name synapsys-postgres \
  -e POSTGRES_DB=synapsys_verifier \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15
```

2. Start the server:
```bash
npm run dev
```

3. Test authorization endpoint:
```bash
curl http://localhost:3000/authorize?response_type=vp_token
```

4. Test with custom Presentation Definition:
```bash
curl -X GET "http://localhost:3000/authorize" \
  -G \
  --data-urlencode 'response_type=vp_token' \
  --data-urlencode 'presentation_definition={
    "id": "test-pd",
    "input_descriptors": [{
      "id": "id_credential",
      "constraints": {
        "fields": [{
          "path": ["$.type"],
          "filter": {
            "type": "array",
            "contains": {"const": "VerifiableCredential"}
          }
        }]
      }
    }]
  }'
```

## Error Handling

### Error Response Format

```json
{
  "error": "error_code",
  "error_description": "Human-readable error description"
}
```

### Error Codes

- `invalid_request`: Missing or invalid required parameters
- `invalid_vp_token`: VP token validation failed
- `invalid_presentation_submission`: Presentation submission invalid
- `invalid_presentation`: Presentation doesn't match definition
- `server_error`: Internal server error

## Performance Considerations

### Database Connection Pooling
- Max connections: 20 (configurable)
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

### Session Cleanup
- Automatic cleanup runs on expired session queries
- Can be scheduled with cron for proactive cleanup

### Caching (Future Enhancement)
- Redis for session caching
- JWKS caching with TTL

## Future Enhancements

### Short Term
- [ ] Integration tests
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Rate limiting
- [ ] CORS configuration

### Medium Term
- [ ] Redis session caching
- [ ] Presentation Definition URI fetching
- [ ] Credential status verification
- [ ] Trust registry integration

### Long Term
- [ ] Multi-factor authentication
- [ ] Audit logging
- [ ] Analytics dashboard
- [ ] Compliance reporting

## Troubleshooting

### Database Connection Issues
```
Error: Database connection failed
```
**Solution**: Check PostgreSQL is running and credentials are correct

### JWT Verification Failures
```
Error: JWT verification failed
```
**Solution**: Ensure wallet is using supported algorithms (RS256, ES256, ES256K, EdDSA)

### Session Not Found
```
Error: Invalid or expired state parameter
```
**Solution**: Session may have expired (15 min default) or state parameter is incorrect

## References

- [OpenID4VP Specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [DIF Presentation Exchange](https://identity.foundation/presentation-exchange/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [eIDAS 2.0 ARF](https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation)
- [jose Library Documentation](https://github.com/panva/jose)

## Support

For issues or questions, refer to the main project documentation or contact the development team.

---

**Implementation Version**: 0.2.0  
**Last Updated**: December 22, 2025  
**Status**: Core OpenID4VP Flow Operational
