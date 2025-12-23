import { WalletType, WalletAuthResponse, WalletSession, WalletCredential } from './types';

export abstract class WalletRegistry {
  abstract walletType: WalletType;
  abstract name: string;
  abstract description: string;

  abstract initiateAuth(): Promise<WalletAuthResponse>;
  abstract handleCallback(params: Record<string, string>): Promise<WalletSession>;
  abstract getUserCredentials(session: WalletSession): Promise<WalletCredential[]>;
  abstract revokeSession(session: WalletSession): Promise<void>;

  getMetadata() {
    return {
      type: this.walletType,
      name: this.name,
      description: this.description,
    };
  }
}
