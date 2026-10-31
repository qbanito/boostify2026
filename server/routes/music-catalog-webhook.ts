import { Router } from 'express';
import { processMusicWebhook } from '../services/music-catalog-webhook';

const router = Router();
router.post('/webhook', async (req, res) => {
  const secret = process.env.MUSIC_STRIPE_WEBHOOK_SECRET;
  const signature = req.get('stripe-signature');
  if (!secret) return res.status(503).json({ error: 'Webhook is not configured' });
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Invalid webhook request' });
  try {
    const result = await processMusicWebhook(req.body, signature, secret, process.env.NODE_ENV === 'production', async (purchase) => {
      const { recordArtistUnlock } = await import('../services/artist-unlock-service');
      return recordArtistUnlock(purchase);
    });
    return res.json({ received: true, result });
  } catch (error: any) {
    if (error?.type === 'StripeSignatureVerificationError') return res.status(400).json({ error: 'Invalid signature' });
    console.error('[music-webhook] Processing failed:', error?.message || 'unknown error');
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});
export default router;
