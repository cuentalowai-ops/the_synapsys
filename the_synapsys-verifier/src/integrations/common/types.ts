export type WalletType = 'gataca' | 'igrant' | 'other';

export interface WalletCredential {
  id: string;
  type: string;
  issuer: string;
  claims: Record<string, unknown>;
  issuanceDate: string;
  expirationDate?: string;
}

export interface WalletUserInfo {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface WalletSession {
  sessionId: string;
  walletType: WalletType;
  userId: string;
  credentials: WalletCredential[];
  expiresAt: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletAuthResponse {
  authUrl?: string;
  status: 'initiated' | 'success' | 'error';
  message?: string;
}

export interface WalletProvider {
  name: WalletType;
  initiateAuth(): Promise<WalletAuthResponse>;
  handleCallback(params: Record<string, string>): Promise<WalletSession>;
  getUserCredentials(session: WalletSession): Promise<WalletCredential[]>;
  revokeSession(session: WalletSession): Promise<void>;
}
