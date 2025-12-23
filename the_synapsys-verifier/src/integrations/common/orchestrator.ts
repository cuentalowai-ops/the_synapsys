import { WalletType, WalletAuthResponse, WalletSession, WalletCredential } from './types';
import { WalletRegistry } from './wallet-registry';
import IGrantWalletClient from '../igrant';
import { logger } from '../../config/logger';

export class WalletOrchestrator {
  private wallets: Map<WalletType, WalletRegistry> = new Map();

  constructor() {
    logger.info('WalletOrchestrator initialized');
  }

  /**
   * Registrar un proveedor de wallet
   */
  registerWallet(wallet: WalletRegistry): void {
    this.wallets.set(wallet.walletType, wallet);
    logger.info(`Wallet registered: ${wallet.name} (${wallet.walletType})`);
  }

  /**
   * Obtener proveedor de wallet
   */
  getWallet(type: WalletType): WalletRegistry | undefined {
    return this.wallets.get(type);
  }

  /**
   * Listar wallets disponibles
   */
  listAvailableWallets() {
    return Array.from(this.wallets.values()).map(w => w.getMetadata());
  }

  /**
   * Iniciar autenticación con cualquier wallet
   */
  async initiateAuth(walletType: WalletType): Promise<WalletAuthResponse> {
    const wallet = this.getWallet(walletType);
    if (!wallet) {
      logger.warn(`Wallet type ${walletType} not supported`);
      return {
        status: 'error',
        message: `Wallet type ${walletType} not supported`,
      };
    }

    logger.info(`Initiating auth with ${walletType}`);
    return wallet.initiateAuth();
  }

  /**
   * Procesar callback de cualquier wallet
   */
  async handleCallback(walletType: WalletType, params: Record<string, string>): Promise<WalletSession> {
    const wallet = this.getWallet(walletType);
    if (!wallet) {
      throw new Error(`Wallet type ${walletType} not supported`);
    }

    logger.info(`Handling callback for ${walletType}`);
    return wallet.handleCallback(params);
  }

  /**
   * Obtener credenciales consolidadas de múltiples wallets
   */
  async getConsolidatedCredentials(sessions: WalletSession[]): Promise<Record<WalletType, WalletCredential[]>> {
    const consolidated: Partial<Record<WalletType, WalletCredential[]>> = {};

    for (const session of sessions) {
      const wallet = this.getWallet(session.walletType);
      if (wallet) {
        try {
          consolidated[session.walletType] = await wallet.getUserCredentials(session);
          logger.info(`Retrieved credentials from ${session.walletType}`);
        } catch (error) {
          logger.error(`Failed to get credentials from ${session.walletType}:`, error);
        }
      }
    }

    return consolidated as Record<WalletType, WalletCredential[]>;
  }

  /**
   * Revocar todas las sesiones
   */
  async revokeAllSessions(sessions: WalletSession[]): Promise<void> {
    logger.info(`Revoking ${sessions.length} wallet sessions`);
    
    for (const session of sessions) {
      const wallet = this.getWallet(session.walletType);
      if (wallet) {
        try {
          await wallet.revokeSession(session);
          logger.info(`Session revoked for ${session.walletType}`);
        } catch (error) {
          logger.error(`Failed to revoke session for ${session.walletType}:`, error);
        }
      }
    }
  }

  /**
   * Obtener estadísticas de wallets
   */
  getStats() {
    return {
      totalWallets: this.wallets.size,
      availableTypes: Array.from(this.wallets.keys()),
    };
  }
}

export const orchestrator = new WalletOrchestrator();
