// iGrant.io Types

export interface IGrantWalletConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface IGrantAuthorizationRequest {
  clientId: string;
  redirectUri: string;
  responseType: string;
  scope: string;
  state: string;
  nonce: string;
}

export interface IGrantTokenRequest {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  refreshToken?: string;
  clientId: string;
  clientSecret: string;
}

export interface IGrantTokenResponse {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface IGrantCredential {
  id: string;
  type: string;
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  claims: Record<string, any>;
}

export interface IGrantUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  credentials?: IGrantCredential[];
}

export interface IGrantWalletSession {
  sessionId: string;
  walletType: 'igrant';
  userId: string;
  accessToken: string;
  refreshToken?: string;
  credentials: IGrantCredential[];
  expiresAt: number;
  createdAt: Date;
  updatedAt: Date;
}
