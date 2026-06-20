/**
 * BOOSTIFY — TikTok OAuth Routes
 * Mounted at: /api/auth/tiktok
 *
 * GET  /api/auth/tiktok/connect      → return TikTok auth URL (requires auth)
 * GET  /api/auth/tiktok/callback     → handle OAuth callback (public, TikTok redirects here)
 * GET  /api/auth/tiktok/connection   → get current user's TikTok connection status
 * DELETE /api/auth/tiktok/disconnect → revoke & delete stored tokens
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTiktokAuthUrl,
  exchangeTiktokCode,
  getTiktokConnection,
  disconnectTiktok,
} from '../services/tiktok-service';

const router = Router();

// -----------------------------------------------
// GET /api/auth/tiktok/connect
// Returns the TikTok OAuth URL for the signed-in user
// -----------------------------------------------
router.get('/connect', authenticate, (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  const authUrl = getTiktokAuthUrl(userId);
  res.json({ success: true, authUrl, data: { authUrl } });
});

// -----------------------------------------------
// GET /api/auth/tiktok/callback
// TikTok redirects here after the user authorizes the app
// -----------------------------------------------
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[TikTok OAuth] User denied or error:', error, error_description);
    return res.redirect('/dashboard?tiktok=denied');
  }

  if (!code || !state) {
    return res.redirect('/dashboard?tiktok=error');
  }

  try {
    const connection = await exchangeTiktokCode(
      code as string,
      state as string,
    );

    if (!connection) {
      return res.redirect('/dashboard?tiktok=error');
    }

    return res.redirect('/dashboard?tiktok=connected');
  } catch (err) {
    console.error('[TikTok OAuth] Callback error:', err);
    return res.redirect('/dashboard?tiktok=error');
  }
});

// -----------------------------------------------
// GET /api/auth/tiktok/connection
// Returns current user's TikTok connection (safe — no tokens exposed)
// -----------------------------------------------
router.get('/connection', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const conn = await getTiktokConnection(userId);
    if (!conn) {
      return res.json({ success: true, connected: false, connection: null, data: null });
    }

    const connection = {
      connected:       conn.isActive,
      isActive:        conn.isActive,
      displayName:     conn.displayName,
      avatarUrl:       conn.avatarUrl,
      profileDeepLink: conn.profileDeepLink,
      scopes:          conn.scopes,
      tokenExpiresAt:  conn.tokenExpiresAt,
      lastSyncedAt:    conn.lastSyncedAt,
      createdAt:       conn.createdAt,
    };

    // Never expose raw tokens to the client
    return res.json({
      success: true,
      connected: conn.isActive,
      connection,
      data: connection,
    });
  } catch (err) {
    console.error('[TikTok OAuth] Get connection error:', err);
    res.status(500).json({ success: false, error: 'Failed to get connection' });
  }
});

// -----------------------------------------------
// DELETE /api/auth/tiktok/disconnect
// Deletes stored tokens — user loses TikTok access
// -----------------------------------------------
router.delete('/disconnect', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    await disconnectTiktok(userId);
    res.json({ success: true, message: 'TikTok account disconnected' });
  } catch (err) {
    console.error('[TikTok OAuth] Disconnect error:', err);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

// -----------------------------------------------
// POST /api/auth/tiktok/webhook
// TikTok sends events here (token revocation, user deauthorization, etc.)
// TikTok verifies ownership with a GET request first (challenge)
// -----------------------------------------------
router.get('/webhook', (req: Request, res: Response) => {
  // TikTok sends a challenge parameter to verify the endpoint
  const challenge = req.query.challenge as string;
  if (challenge) {
    return res.status(200).send(challenge);
  }
  res.status(200).send('OK');
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log('[TikTok Webhook] Event received:', JSON.stringify(event));

    // Handle user deauthorization — delete stored tokens
    if (event?.event === 'user.revoke' || event?.type === 'user.revoke') {
      const openId = event?.user?.open_id || event?.open_id;
      if (openId) {
        const { db } = await import('../db');
        const { tiktokConnections } = await import('../../db/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(tiktokConnections).where(eq(tiktokConnections.tiktokOpenId, openId));
        console.log('[TikTok Webhook] Tokens deleted for openId:', openId);
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[TikTok Webhook] Error:', err);
    res.status(200).json({ success: true }); // Always 200 to TikTok
  }
});

export default router;
