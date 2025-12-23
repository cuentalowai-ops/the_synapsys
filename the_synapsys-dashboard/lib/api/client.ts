/**
 * API Client - Axios-based HTTP client for backend communication
 * Connects dashboard to the_synapsys-verifier backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  OOTSToken,
  OOTSConfig,
  VPSession,
  CreateSessionRequest,
  SessionResponse,
  WalletProvider,
  RelyingParty,
  RegisterRPRequest,
  AnalyticsData,
  AuditLog,
  AuditLogFilter,
  ApiResponse,
} from './types';

// Base URL from environment or default to localhost
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ============================================================================
// Axios Instance Configuration
// ============================================================================
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ============================================================================
// Request Interceptor - Add Auth Token
// ============================================================================
apiClient.interceptors.request.use(
  (config) => {
    // Add token to all requests if available (client-side only)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================================================
// Response Interceptor - Handle Errors
// ============================================================================
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 Unauthorized - Token expired or invalid
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login only if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
    }

    // Handle 429 Rate Limit
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded:', error.response.data);
    }

    // Handle 500 Server Error
    if (error.response?.status === 500) {
      console.error('Server error:', error.response.data);
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// API Service Methods
// ============================================================================

export const api = {
  // ==========================================================================
  // Authentication & Authorization
  // ==========================================================================
  auth: {
    /**
     * Login with email and password
     */
    login: async (email: string, password: string): Promise<AuthResponse> => {
      const response = await apiClient.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      return response.data;
    },

    /**
     * Logout current user
     */
    logout: async (): Promise<void> => {
      await apiClient.post('/auth/logout');
    },

    /**
     * Get current authenticated user
     */
    me: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.get('/auth/me');
      return response.data;
    },
  },

  // ==========================================================================
  // OOTS Token Management
  // ==========================================================================
  oots: {
    /**
     * Generate an OOTS access token
     */
    getToken: async (
      userId: string,
      rpId: string,
      scope?: string[]
    ): Promise<OOTSToken> => {
      const response = await apiClient.post<OOTSToken>('/api/v1/oots/token', {
        userId,
        rpId,
        scope,
      });
      return response.data;
    },

    /**
     * Get OOTS OAuth 2.0 configuration
     */
    getConfig: async (): Promise<ApiResponse<{ config: OOTSConfig }>> => {
      const response = await apiClient.get('/api/v1/oots/config');
      return response.data;
    },

    /**
     * Revoke an access or refresh token
     */
    revokeToken: async (token: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/api/v1/oots/revoke', { token });
      return response.data;
    },

    /**
     * Verify a token
     */
    verifyToken: async (token: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/api/v1/oots/verify', { token });
      return response.data;
    },

    /**
     * Refresh an access token
     */
    refreshToken: async (
      refreshToken: string,
      clientId: string
    ): Promise<OOTSToken> => {
      const response = await apiClient.post<OOTSToken>(
        '/api/v1/oots/refresh',
        {
          refresh_token: refreshToken,
          client_id: clientId,
        }
      );
      return response.data;
    },

    /**
     * Get user info using access token
     */
    getUserInfo: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.get('/api/v1/oots/userinfo');
      return response.data;
    },
  },

  // ==========================================================================
  // Relying Party Management
  // ==========================================================================
  rp: {
    /**
     * Register a new relying party
     */
    register: async (data: RegisterRPRequest): Promise<ApiResponse<RelyingParty>> => {
      const response = await apiClient.post('/rp/register', data);
      return response.data;
    },

    /**
     * List all relying parties
     */
    list: async (): Promise<ApiResponse<RelyingParty[]>> => {
      const response = await apiClient.get('/rp/list');
      return response.data;
    },

    /**
     * Get a specific relying party
     */
    get: async (rpId: string): Promise<ApiResponse<RelyingParty>> => {
      const response = await apiClient.get(`/rp/${rpId}`);
      return response.data;
    },

    /**
     * Update a relying party
     */
    update: async (
      rpId: string,
      data: Partial<RegisterRPRequest>
    ): Promise<ApiResponse<RelyingParty>> => {
      const response = await apiClient.put(`/rp/${rpId}`, data);
      return response.data;
    },
  },

  // ==========================================================================
  // VP Sessions Management
  // ==========================================================================
  sessions: {
    /**
     * Create a new VP session
     */
    create: async (data: CreateSessionRequest): Promise<SessionResponse> => {
      const response = await apiClient.post<SessionResponse>('/vp/session', data);
      return response.data;
    },

    /**
     * List all sessions
     */
    list: async (): Promise<SessionResponse> => {
      const response = await apiClient.get<SessionResponse>('/vp/sessions');
      return response.data;
    },

    /**
     * Get a specific session
     */
    get: async (sessionId: string): Promise<ApiResponse<VPSession>> => {
      const response = await apiClient.get(`/vp/session/${sessionId}`);
      return response.data;
    },

    /**
     * Complete a session with credential
     */
    complete: async (
      sessionId: string,
      credential: any
    ): Promise<ApiResponse<VPSession>> => {
      const response = await apiClient.post(
        `/vp/session/${sessionId}/complete`,
        { credential }
      );
      return response.data;
    },

    /**
     * Revoke a session
     */
    revoke: async (sessionId: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.post(`/vp/session/${sessionId}/revoke`);
      return response.data;
    },
  },

  // ==========================================================================
  // Wallets Management
  // ==========================================================================
  wallets: {
    /**
     * List all configured wallets
     */
    list: async (): Promise<ApiResponse<WalletProvider[]>> => {
      const response = await apiClient.get('/api/v1/wallets');
      return response.data;
    },

    /**
     * Get available wallets
     */
    available: async (): Promise<ApiResponse<{ wallets: WalletProvider[] }>> => {
      const response = await apiClient.get('/api/v1/wallets/available');
      return response.data;
    },

    /**
     * Get wallet configuration
     */
    getConfig: async (walletType: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.get(
        `/api/v1/wallets/${walletType}/config`
      );
      return response.data;
    },
  },

  // ==========================================================================
  // QR Code Generation
  // ==========================================================================
  qr: {
    /**
     * Generate QR code for session
     */
    generate: async (sessionId: string): Promise<ApiResponse<{ qrCode: string }>> => {
      const response = await apiClient.get(`/qr/session/${sessionId}`);
      return response.data;
    },

    /**
     * Get session status via QR
     */
    getStatus: async (sessionId: string): Promise<ApiResponse<{ status: string }>> => {
      const response = await apiClient.get(`/qr/session/${sessionId}/status`);
      return response.data;
    },
  },

  // ==========================================================================
  // iGrant.io Integration
  // ==========================================================================
  igrant: {
    /**
     * Initiate iGrant.io authentication
     */
    initiate: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/api/v1/igrant/auth/initiate');
      return response.data;
    },

    /**
     * Handle iGrant.io callback
     */
    callback: async (code: string, state: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/api/v1/igrant/auth/callback', {
        code,
        state,
      });
      return response.data;
    },
  },

  // ==========================================================================
  // Gataca Integration
  // ==========================================================================
  gataca: {
    /**
     * Initiate Gataca authentication
     */
    initiate: async (): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/api/v1/gataca/auth/initiate');
      return response.data;
    },

    /**
     * Verify Gataca VP token
     */
    verify: async (vpToken: string): Promise<ApiResponse<any>> => {
      const response = await apiClient.post('/api/v1/gataca/verify', {
        vpToken,
      });
      return response.data;
    },
  },

  // ==========================================================================
  // Analytics & Reporting
  // ==========================================================================
  analytics: {
    /**
     * Get analytics data
     */
    getStats: async (): Promise<ApiResponse<AnalyticsData>> => {
      const response = await apiClient.get('/analytics/stats');
      return response.data;
    },

    /**
     * Get session metrics
     */
    getSessionMetrics: async (
      startDate?: string,
      endDate?: string
    ): Promise<ApiResponse<any>> => {
      const response = await apiClient.get('/analytics/sessions', {
        params: { startDate, endDate },
      });
      return response.data;
    },
  },

  // ==========================================================================
  // Audit Logs
  // ==========================================================================
  audit: {
    /**
     * List audit logs with filters
     */
    list: async (filter?: AuditLogFilter): Promise<ApiResponse<AuditLog[]>> => {
      const response = await apiClient.get('/audit/logs', {
        params: filter,
      });
      return response.data;
    },

    /**
     * Get a specific audit log
     */
    get: async (logId: string): Promise<ApiResponse<AuditLog>> => {
      const response = await apiClient.get(`/audit/logs/${logId}`);
      return response.data;
    },
  },

  // ==========================================================================
  // Health & System
  // ==========================================================================
  system: {
    /**
     * Check system health
     */
    health: async (): Promise<any> => {
      const response = await apiClient.get('/health');
      return response.data;
    },

    /**
     * Get system version
     */
    version: async (): Promise<any> => {
      const response = await apiClient.get('/version');
      return response.data;
    },
  },
};

// Export default
export default apiClient;
