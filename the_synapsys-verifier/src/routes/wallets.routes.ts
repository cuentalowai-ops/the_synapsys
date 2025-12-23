import { Router, Request, Response } from 'express';
import { orchestrator } from '../integrations/common/orchestrator';

const router = Router();

/**
 * GET /wallets/available
 * Listar wallets disponibles
 */
router.get('/available', (_req: Request, res: Response) => {
  try {
    const wallets = orchestrator.listAvailableWallets();
    const stats = orchestrator.getStats();
    
    res.json({
      status: 'success',
      wallets,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /wallets/initiate/:type
 * Iniciar autenticación con wallet específico
 */
router.post('/initiate/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const response = await orchestrator.initiateAuth(type as any);
    
    if (response.status === 'error') {
      res.status(400).json(response);
      return;
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
