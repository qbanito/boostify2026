/**
 * BOOSTIFY — YouTube OAuth Routes
 * Mounted at: /api/auth/youtube
 *
 * GET    /api/auth/youtube/connect     → return Google consent URL (requires auth)
 * GET    /api/auth/youtube/callback    → handle OAuth callback (public, Google redirects here)
 * GET    /api/auth/youtube/connection  → current user's YouTube connection status
 * DELETE /api/auth/youtube/disconnect  → revoke & delete stored tokens
 *
 * Lets an artist connect their YouTube channel so rendered lyric videos can be
 * published from inside the karaoke / lyrics-video module while logged in.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  isYoutubeOAuthConfigured,
  getYoutubeAuthUrl,
  exchangeYoutubeCode,
  getYoutubeConnection,
  disconnectYoutube,
} from '../services/youtube-service';

const router = Router();

// GET /api/auth/youtube/connect — returns the Google OAuth URL for the signed-in user
router.get('/connect', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  if (!isYoutubeOAuthConfigured()) {
    return res.status(503).json({
      success: false,
      configured: false,
      error: 'YouTube upload is not configured on the server.',
      instructions: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable YouTube publishing.',
    });
  }

  try {
    const authUrl = await getYoutubeAuthUrl(userId);
    res.json({ success: true, authUrl, data: { authUrl } });
  } catch (err: any) {
    console.error('[YouTube OAuth] Connect error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/youtube/callback — Google redirects here after consent
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[YouTube OAuth] User denied or error:', error);
    return res.redirect('/dashboard?youtube=denied');
  }
  if (!code || !state) {
    return res.redirect('/dashboard?youtube=error');
  }

  try {
    const result = await exchangeYoutubeCode(code as string, state as string);
    if (!result) return res.redirect('/dashboard?youtube=error');
    return res.redirect('/dashboard?youtube=connected');
  } catch (err: any) {
    console.error('[YouTube OAuth] Callback error:', err.message);
    return res.redirect('/dashboard?youtube=error');
  }
});

// GET /api/auth/youtube/connection — safe status (never exposes tokens)
router.get('/connection', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const conn = await getYoutubeConnection(userId);
    if (!conn) {
      return res.json({
        success: true,
        connected: false,
        configured: isYoutubeOAuthConfigured(),
        connection: null,
        data: null,
      });
    }

    const connection = {
      connected: conn.isActive,
      isActive: conn.isActive,
      channelId: conn.channelId,
      channelTitle: conn.channelTitle,
      thumbnailUrl: conn.thumbnailUrl,
      scopes: conn.scopes,
      tokenExpiresAt: conn.tokenExpiresAt,
      createdAt: conn.createdAt,
    };

    return res.json({
      success: true,
      connected: conn.isActive,
      configured: isYoutubeOAuthConfigured(),
      connection,
      data: connection,
    });
  } catch (err: any) {
    console.error('[YouTube OAuth] Get connection error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get connection' });
  }
});

// DELETE /api/auth/youtube/disconnect — removes stored tokens
router.delete('/disconnect', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    await disconnectYoutube(userId);
    res.json({ success: true, message: 'YouTube account disconnected' });
  } catch (err: any) {
    console.error('[YouTube OAuth] Disconnect error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to disconnect' });
  }
});

export default router;
