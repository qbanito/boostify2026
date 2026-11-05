import { Router, type Request, type Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { musicVideoProjects } from '../db/schema';
import { getUserBalance } from '../services/credit-engine';
import {
  calculateMusicVideoQuote,
  listMusicVideoBilling,
  MUSIC_VIDEO_EFFECTIVE_CREDIT_USD,
  MUSIC_VIDEO_MARKUP,
} from '../services/music-video-billing';

const router = Router();
router.use(authenticate);

function verifiedEmail(req: Request, res: Response) {
  const email = String(req.user?.email || '').trim().toLowerCase();
  if (!email) {
    res.status(401).json({ success: false, error: 'A verified account email is required.' });
    return null;
  }
  return email;
}

router.post('/quote', async (req, res) => {
  try {
    const email = verifiedEmail(req, res);
    if (!email) return;
    const projectId = Number(req.body?.projectId);
    if (Number.isInteger(projectId) && projectId > 0) {
      const [project] = await db.select({ id: musicVideoProjects.id }).from(musicVideoProjects)
        .where(and(eq(musicVideoProjects.id, projectId), eq(musicVideoProjects.userEmail, email))).limit(1);
      if (!project) return res.status(404).json({ success: false, error: 'Project not found for this account.' });
    }
    const quote = calculateMusicVideoQuote(req.body || {});
    const balance = await getUserBalance(email);
    return res.json({
      success: true,
      quote,
      balance: balance.credits,
      isAdmin: balance.isAdmin,
      canAfford: balance.isAdmin || balance.credits >= quote.credits,
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not calculate the quote.' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const email = verifiedEmail(req, res);
    if (!email) return;
    const rows = await listMusicVideoBilling(email, Number(req.query.limit) || 50);
    return res.json({ success: true, reservations: rows });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Could not load billing history.' });
  }
});

router.get('/policy', (_req, res) => {
  res.json({
    success: true,
    markupMultiplier: MUSIC_VIDEO_MARKUP,
    effectiveCreditUsd: MUSIC_VIDEO_EFFECTIVE_CREDIT_USD,
    billing: 'reserve-before-provider, settle-on-success, refund-on-failure',
  });
});

export default router;
