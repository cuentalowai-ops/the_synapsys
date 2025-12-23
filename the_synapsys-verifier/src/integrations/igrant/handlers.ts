import { Request, Response } from 'express';
import IGrantWalletClient from './index';
import { IGrantWalletSession } from './types';
import { randomUUID } from 'crypto';
import { logger } from '../../config/logger';

const iGrantClient = new IGrantWalletClient();

/**
 * Iniciar flujo de autenticación con iGrant
 */
export const initiateIGrantAuth = (req: Request, res: Response): void => {
  try {
    const { state, nonce } = IGrantWalletClient.generateSecurityParams();
    
    // Guardar en sesión (usar Redis en producción)
    if (req.session) {
      req.session.authState = state;
      req.session.authNonce = nonce;
      req.session.walletType = 'igrant';
    }

    const authUrl = iGrantClient.getAuthorizationUrl(state, nonce);
    
    logger.info('iGrant auth initiated', { state });
    
    res.json({
      status: 'success',
      authUrl,
      state,
    });
  } catch (error) {
    logger.error('iGrant auth initiation failed:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Callback de iGrant - procesar authorization code
 */
export const handleIGrantCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error, error_description } = req.query as Record<string, string>;

    // Validar error
    if (error) {
      logger.warn('iGrant callback error:', { error, error_description });
      res.status(400).json({
        status: 'error',
        message: error_description || error,
      });
      return;
    }

    // Validar state
    if (req.session && state !== req.session.authState) {
      logger.warn('iGrant state mismatch');
      res.status(400).json({
        status: 'error',
        message: 'State mismatch - possible CSRF attack',
      });
      return;
    }

    // Intercambiar código por tokens
    const tokenResponse = await iGrantClient.exchangeCodeForToken(code);
    
    // Obtener información del usuario
    const userInfo = await iGrantClient.getUserInfo(tokenResponse.accessToken);
    
    // Obtener credenciales
    const credentials = await iGrantClient.getUserCredentials(tokenResponse.accessToken);

    // Crear sesión de wallet (guardar en DB en producción)
    const walletSession: IGrantWalletSession = {
      sessionId: randomUUID(),
      walletType: 'igrant',
      userId: userInfo.sub,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      credentials,
      expiresAt: Date.now() + tokenResponse.expiresIn * 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    logger.info('iGrant session created', { userId: userInfo.sub, sessionId: walletSession.sessionId });

    // Responder con sesión creada
    res.json({
      status: 'success',
      session: walletSession,
      user: userInfo,
    });
  } catch (error) {
    logger.error('iGrant callback failed:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Obtener credenciales del usuario (con refresh automático si es necesario)
 */
export const getUserCredentialsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accessToken, refreshToken, expiresAt } = req.body;

    let token = accessToken;

    // Refrescar si está expirado
    if (Date.now() >= expiresAt && refreshToken) {
      const newTokens = await iGrantClient.refreshToken(refreshToken);
      token = newTokens.accessToken;
      logger.info('iGrant token refreshed');
    }

    // Obtener credenciales
    const credentials = await iGrantClient.getUserCredentials(token);

    res.json({
      status: 'success',
      credentials,
    });
  } catch (error) {
    logger.error('Failed to get iGrant credentials:', error);
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export default {
  initiateIGrantAuth,
  handleIGrantCallback,
  getUserCredentialsHandler,
};
