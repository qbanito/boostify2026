/**
 * BOOSTIFY — Google Merchant Center routes
 * Mounted at: /api/merchant
 *
 * GET    /api/merchant/connect      → Google consent URL (content scope) [auth]
 * GET    /api/merchant/callback     → OAuth callback (public, Google redirects here)
 * GET    /api/merchant/status       → connection + product status [auth]
 * POST   /api/merchant/sync         → push the artist's products to Merchant Center [auth]
 * DELETE /api/merchant/disconnect   → remove stored tokens [auth]
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { pool } from '../db';
import {
  isMerchantConfigured,
  getMerchantAuthUrl,
  exchangeMerchantCode,
  getMerchantConnection,
  disconnectMerchant,
  getMerchantStatus,
  syncProductsToMerchant,
} from '../services/merchant-service';

const router = Router();

// ¿El usuario controla este perfil de artista? (su id o un perfil que generó)
async function userOwnsArtist(userId: number, artistId: number): Promise<boolean> {
  if (!userId || !artistId) return false;
  if (userId === artistId) return true;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND (id = $2 OR generated_by = $2) LIMIT 1`,
      [artistId, userId],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// GET /api/merchant/connect?artistId=123 — devuelve la URL de consentimiento de Google
router.get('/connect', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  if (!isMerchantConfigured()) {
    return res.status(503).json({
      success: false,
      configured: false,
      error: 'Google OAuth no está configurado en el servidor.',
      instructions: 'Define GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, habilita la Content API for Shopping y registra el redirect /api/merchant/callback.',
    });
  }
  try {
    const artistId = Number(req.query.artistId) || userId;
    if (artistId !== userId && !(await userOwnsArtist(userId, artistId))) {
      return res.status(403).json({ success: false, error: 'No controlas este artista.' });
    }
    const authUrl = await getMerchantAuthUrl(userId, artistId);
    res.json({ success: true, authUrl, data: { authUrl } });
  } catch (err: any) {
    console.error('[Merchant OAuth] connect error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/merchant/callback — Google redirige aquí tras el consentimiento
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect('/?merchant=denied');
  if (!code || !state) return res.redirect('/?merchant=error');
  try {
    const result = await exchangeMerchantCode(code as string, state as string);
    // Sincroniza el catálogo inmediatamente tras conectar (best-effort).
    syncProductsToMerchant(result.userId, result.artistId || result.userId).catch(() => {});
    return res.redirect('/?merchant=connected');
  } catch (err: any) {
    console.error('[Merchant OAuth] callback error:', err.message);
    return res.redirect(`/?merchant=error&reason=${encodeURIComponent(err.message || 'error')}`);
  }
});

// GET /api/merchant/status — estado de conexión + productos
router.get('/status', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const status = await getMerchantStatus(userId);
    const conn = await getMerchantConnection(userId);
    res.json({ success: true, ...status, connection: conn });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/merchant/sync — empuja los productos del artista a Merchant Center
router.post('/sync', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const artistId = Number(req.body?.artistId) || userId;
    if (artistId !== userId && !(await userOwnsArtist(userId, artistId))) {
      return res.status(403).json({ success: false, error: 'No controlas este artista.' });
    }
    const result = await syncProductsToMerchant(userId, artistId);
    if (!result.connected) {
      return res.status(result.configured ? 409 : 503).json({
        success: false,
        ...result,
        error: result.configured ? 'Conecta tu cuenta de Merchant Center primero.' : 'Google OAuth no configurado.',
      });
    }
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Merchant] sync error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/merchant/disconnect — elimina los tokens guardados
router.delete('/disconnect', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    await disconnectMerchant(userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
