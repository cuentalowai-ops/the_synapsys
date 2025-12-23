import axios, { AxiosInstance } from 'axios';
import { randomBytes } from 'crypto';
import { IGrantWalletConfig, IGrantTokenRequest, IGrantTokenResponse, IGrantUserInfo, IGrantCredential } from './types';
import { IGRANT_CONFIG, IGRANT_ENDPOINTS } from './config';

export class IGrantWalletClient {
  private client: AxiosInstance;
  private config: IGrantWalletConfig;

  constructor(config: Partial<IGrantWalletConfig> = {}) {
    this.config = {
      clientId: config.clientId || IGRANT_CONFIG.clientId,
      clientSecret: config.clientSecret || IGRANT_CONFIG.clientSecret,
      redirectUri: config.redirectUri || IGRANT_CONFIG.redirectUri,
      scopes: config.scopes || IGRANT_CONFIG.scopes,
    };

    this.client = axios.create({
      baseURL: 'https://api.igrant.io',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synapsys-RP/1.0',
      },
    });
  }

  /**
   * Generar authorization request URL
   */
  getAuthorizationUrl(state: string, nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code id_token',
      scope: this.config.scopes.join(' '),
      state,
      nonce,
    });

    return `${IGRANT_ENDPOINTS.authorize}?${params.toString()}`;
  }

  /**
   * Intercambiar authorization code por tokens
   */
  async exchangeCodeForToken(code: string): Promise<IGrantTokenResponse> {
    try {
      const request: IGrantTokenRequest = {
        grantType: 'authorization_code',
        code,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      };

      const response = await this.client.post<IGrantTokenResponse>(
        IGRANT_ENDPOINTS.token,
        {
          grant_type: request.grantType,
          code: request.code,
          client_id: request.clientId,
          client_secret: request.clientSecret,
          redirect_uri: this.config.redirectUri,
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`iGrant token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtener información del usuario
   */
  async getUserInfo(accessToken: string): Promise<IGrantUserInfo> {
    try {
      const response = await this.client.get<IGrantUserInfo>(
        IGRANT_ENDPOINTS.userinfo,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`iGrant userinfo failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtener credenciales del usuario
   */
  async getUserCredentials(accessToken: string): Promise<IGrantCredential[]> {
    try {
      const response = await this.client.get<{ credentials: IGrantCredential[] }>(
        IGRANT_ENDPOINTS.credentials,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.credentials || [];
    } catch (error) {
      throw new Error(`iGrant credentials fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refrescar access token
   */
  async refreshToken(refreshToken: string): Promise<IGrantTokenResponse> {
    try {
      const request: IGrantTokenRequest = {
        grantType: 'refresh_token',
        refreshToken,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      };

      const response = await this.client.post<IGrantTokenResponse>(
        IGRANT_ENDPOINTS.token,
        {
          grant_type: request.grantType,
          refresh_token: request.refreshToken,
          client_id: request.clientId,
          client_secret: request.clientSecret,
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`iGrant token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revocar token
   */
  async revokeToken(token: string, tokenTypeHint: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    try {
      await this.client.post(
        IGRANT_ENDPOINTS.revoke,
        {
          token,
          token_type_hint: tokenTypeHint,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }
      );
    } catch (error) {
      throw new Error(`iGrant token revoke failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generar state y nonce seguros
   */
  static generateSecurityParams(): { state: string; nonce: string } {
    return {
      state: randomBytes(32).toString('hex'),
      nonce: randomBytes(32).toString('hex'),
    };
  }
}

export default IGrantWalletClient;
