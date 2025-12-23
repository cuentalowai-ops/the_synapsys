import { Router, Request, Response } from 'express';
import { initiateIGrantAuth, handleIGrantCallback, getUserCredentialsHandler } from '../integrations/igrant/handlers';

const router = Router();

/**
 * POST /igrant/auth/initiate
 * Iniciar flujo de autenticación con iGrant
 */
router.post('/auth/initiate', (req: Request, res: Response) => {
  initiateIGrantAuth(req, res);
});

/**
 * GET /igrant/auth/callback
 * Callback de iGrant después de autorización
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  await handleIGrantCallback(req, res);
});

/**
 * GET /igrant/credentials
 * Obtener credenciales del usuario
 */
router.get('/credentials', async (req: Request, res: Response) => {
  await getUserCredentialsHandler(req, res);
});

export default router;
