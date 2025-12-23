/**
 * API Types - Type definitions for API requests and responses
 */

// ============================================================================
// Auth Types
// ============================================================================
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  rpId: string;
  rpName: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  status: 'success' | 'error';
  access_token?: string;
  user?: AuthUser;
  error?: string;
}

// ============================================================================
// OOTS Token Types
// ============================================================================
export interface OOTSToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface TokenPayload {
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  scope: string[];
  jti?: string;
}

export interface OOTSConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  scopes_supported: string[];
  response_types_supported: string[];
  response_modes_supported: string[];
  grant_types_supported: string[];
}

// ============================================================================
// Session Types
// ============================================================================
export interface VPSession {
  id: string;
  clientId: string;
  rpId: string;
  status: 'pending' | 'completed' | 'expired' | 'revoked';
  walletType: 'igrant' | 'gataca' | 'other';
  credentials: Credential[];
  qrCode?: string;
  deepLink?: string;
  createdAt: string;
  expiresAt: string;
  completedAt?: string;
  userId?: string;
}

export interface CreateSessionRequest {
  client_id: string;
  required_vps: string[];
  redirect_uri: string;
  wallet_type?: 'igrant' | 'gataca' | 'other';
}

export interface SessionResponse {
  status: 'success' | 'error';
  session?: VPSession;
  sessions?: VPSession[];
  error?: string;
}

// ============================================================================
// Credential Types
// ============================================================================
export interface Credential {
  id: string;
  type: string;
  issuer: string;
  subject?: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject?: Record<string, any>;
  proof?: CredentialProof;
}

export interface CredentialProof {
  type: string;
  created: string;
  proofPurpose: string;
  verificationMethod: string;
  jws?: string;
}

// ============================================================================
// Wallet Types
// ============================================================================
export interface WalletProvider {
  id: string;
  name: string;
  type: 'igrant' | 'gataca' | 'oots' | 'other';
  description: string;
  icon?: string;
  configured: boolean;
  available: boolean;
  endpoints?: {
    authorization?: string;
    token?: string;
    userinfo?: string;
  };
}

export interface WalletConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: string[];
  issuerUrl: string;
}

// ============================================================================
// Relying Party Types
// ============================================================================
export interface RelyingParty {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  clientUri: string;
  logoUri?: string;
  tosUri?: string;
  policyUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRPRequest {
  name: string;
  redirect_uris: string[];
  client_uri: string;
  logo_uri?: string;
  tos_uri?: string;
  policy_uri?: string;
}

// ============================================================================
// Analytics Types
// ============================================================================
export interface AnalyticsData {
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  expiredSessions: number;
  successRate: number;
  averageCompletionTime: number;
  sessionsPerDay: Array<{
    date: string;
    count: number;
  }>;
  walletUsage: Array<{
    wallet: string;
    count: number;
    percentage: number;
  }>;
}

// ============================================================================
// Audit Log Types
// ============================================================================
export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: string;
  userId?: string;
  rpId?: string;
  sessionId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  userId?: string;
  rpId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Generic API Response Types
// ============================================================================
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  status: 'success' | 'error';
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================
export interface ApiError {
  status: 'error';
  error: string;
  message?: string;
  code?: string;
  details?: any;
}
