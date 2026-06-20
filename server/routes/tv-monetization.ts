/**
 * TV Monetization Routes — /api/tv/monetization/*
 * ─────────────────────────────────────────────────────────────────
 * Handles video tips from fans to artists.  Tips flow:
 *   1. POST /tip/intent  → create Stripe PaymentIntent, return clientSecret
 *   2. POST /tip/confirm → verify PI status, write salesTransaction +
 *                          walletTransaction for the artist
 *
 * Artist earnings:
 *   GET /revenue         → authenticated artist's aggregated TV tip stats
 *   GET /top-tipped      → public leaderboard of top-tipped artists
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { users, artistWallet, walletTransactions, salesTransactions } from '../../db/schema';
import { eq, and, desc, sql, gte, like } from 'drizzle-orm';

const router = Router();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = new Stripe(stripeKey!, {
  apiVersion: '2025-01-27.acacia' as any,
});

const PLATFORM_FEE_RATE = 0.15; // 15% platform fee — artist keeps 85%

// ─── Shared helper: resolve DB user ID from req.user (any auth provider) ─────

async function getUserId(req: Request): Promise<number | null> {
  const user = req.user as Record<string, unknown> | undefined;
  if (!user) return null;

  // Clerk Auth
  if (typeof user.id === 'string' && user.id.startsWith('user_')) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, user.id)).limit(1);
    return row?.id ?? null;
  }
  // Numeric DB id
  if (typeof user.id === 'number') return user.id;
  // claims.sub
  if (user.claims && typeof (user.claims as Record<string, unknown>).sub === 'string') {
    const sub = (user.claims as Record<string, string>).sub;
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.replitId, sub)).limit(1);
    return row?.id ?? null;
  }
  // uid (Firebase)
  if (typeof user.uid === 'string') {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.replitId, user.uid)).limit(1);
    return row?.id ?? null;
  }
  return null;
}

// ─── Shared helper: upsert artist wallet and record a walletTransaction ──────

async function creditArtistWallet(
  artistUserId: number,
  artistAmount: number,
  description: string,
  relatedSaleId: number,
  meta: Record<string, unknown>,
): Promise<void> {
  const existing = await db
    .select()
    .from(artistWallet)
    .where(eq(artistWallet.userId, artistUserId))
    .limit(1);

  if (existing.length > 0) {
    const currentBalance = parseFloat(existing[0].balance ?? '0');
    const currentEarnings = parseFloat(existing[0].totalEarnings ?? '0');
    const newBalance = currentBalance + artistAmount;
    const newEarnings = currentEarnings + artistAmount;

    await db
      .update(artistWallet)
      .set({
        balance: newBalance.toFixed(2),
        totalEarnings: newEarnings.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(artistWallet.id, existing[0].id));

    await db.insert(walletTransactions).values({
      userId: artistUserId,
      type: 'earning',
      amount: artistAmount.toFixed(2),
      balanceBefore: currentBalance.toFixed(2),
      balanceAfter: newBalance.toFixed(2),
      description,
      relatedSaleId,
      metadata: meta,
    });
  } else {
    await db.insert(artistWallet).values({
      userId: artistUserId,
      balance: artistAmount.toFixed(2),
      totalEarnings: artistAmount.toFixed(2),
      totalSpent: '0.00',
      currency: 'usd',
    });

    await db.insert(walletTransactions).values({
      userId: artistUserId,
      type: 'earning',
      amount: artistAmount.toFixed(2),
      balanceBefore: '0.00',
      balanceAfter: artistAmount.toFixed(2),
      description,
      relatedSaleId,
      metadata: meta,
    });
  }
}

// ─── POST /api/tv/monetization/tip/intent ────────────────────────────────────
// Create a Stripe PaymentIntent so the client can render the Payment Element.
// Body: { videoId, videoTitle, artistId (DB user id), amount (USD cents int) }

router.post('/tip/intent', authenticate, async (req: Request, res: Response) => {
  try {
    const { videoId, videoTitle, artistId, amountCents } = req.body as {
      videoId: string;
      videoTitle: string;
      artistId: number;
      amountCents: number;
    };

    if (!videoId || !videoTitle || !artistId || !amountCents) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (typeof amountCents !== 'number' || amountCents < 100 || amountCents > 100_000) {
      return res.status(400).json({ success: false, message: 'Amount must be between $1 and $1,000' });
    }

    const fanUserId = await getUserId(req);
    if (!fanUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Prevent self-tipping
    if (fanUserId === artistId) {
      return res.status(400).json({ success: false, message: 'You cannot tip your own video' });
    }

    const totalAmountUSD = amountCents / 100;
    const platformFee = totalAmountUSD * PLATFORM_FEE_RATE;
    const artistAmount = totalAmountUSD - platformFee;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        source: 'tv_tip',
        videoId,
        videoTitle: videoTitle.slice(0, 500),
        artistId: String(artistId),
        fanUserId: String(fanUserId),
        platformFee: platformFee.toFixed(2),
        artistAmount: artistAmount.toFixed(2),
      },
      description: `Boostify TV Tip — ${videoTitle}`,
    });

    return res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      breakdown: {
        total: totalAmountUSD,
        platformFee,
        artistAmount,
      },
    });
  } catch (err) {
    console.error('[TV Tip Intent]', err);
    return res.status(500).json({ success: false, message: 'Failed to create payment intent' });
  }
});

// ─── POST /api/tv/monetization/tip/confirm ───────────────────────────────────
// Called after client-side payment succeeds.  Verifies PI status, creates
// salesTransaction and credits the artist wallet.

router.post('/tip/confirm', authenticate, async (req: Request, res: Response) => {
  try {
    const { paymentIntentId } = req.body as { paymentIntentId: string };

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Missing paymentIntentId' });
    }

    const fanUserId = await getUserId(req);
    if (!fanUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Verify with Stripe
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (pi.status !== 'succeeded') {
      return res.status(400).json({ success: false, message: `Payment not completed (status: ${pi.status})` });
    }

    const meta = pi.metadata;
    const artistId = parseInt(meta.artistId, 10);
    const totalAmountUSD = pi.amount / 100;
    const platformFee = parseFloat(meta.platformFee);
    const artistAmount = parseFloat(meta.artistAmount);
    const videoId = meta.videoId;
    const videoTitle = meta.videoTitle;

    // Idempotency: check if this PI was already processed
    const existing = await db
      .select({ id: salesTransactions.id })
      .from(salesTransactions)
      .where(eq(salesTransactions.stripePaymentId, paymentIntentId))
      .limit(1);

    if (existing.length > 0) {
      return res.json({ success: true, alreadyProcessed: true, saleId: existing[0].id });
    }

    // Create salesTransaction row
    const [sale] = await db
      .insert(salesTransactions)
      .values({
        artistId,
        merchandiseId: null,
        productName: `TV Tip — ${videoTitle}`,
        saleAmount: totalAmountUSD.toFixed(2),
        productionCost: '0.00',
        artistEarning: artistAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        commissionRate: PLATFORM_FEE_RATE * 100,
        quantity: 1,
        currency: 'usd',
        buyerEmail: null,
        stripePaymentId: paymentIntentId,
        status: 'completed',
      })
      .returning();

    // Credit artist wallet
    await creditArtistWallet(
      artistId,
      artistAmount,
      `TV Tip — ${videoTitle}`,
      sale.id,
      { source: 'tv_tip', videoId, videoTitle, fanUserId },
    );

    return res.json({
      success: true,
      saleId: sale.id,
      artistAmount,
    });
  } catch (err) {
    console.error('[TV Tip Confirm]', err);
    return res.status(500).json({ success: false, message: 'Failed to confirm tip' });
  }
});

// ─── GET /api/tv/monetization/revenue ────────────────────────────────────────
// Authenticated artist's aggregated TV monetization stats.

router.get('/revenue', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Fetch all completed TV-tip sales for this artist
    const tips = await db
      .select()
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, userId),
          eq(salesTransactions.status, 'completed'),
          like(salesTransactions.productName, 'TV Tip — %'),
          gte(salesTransactions.createdAt, since),
        ),
      )
      .orderBy(desc(salesTransactions.createdAt));

    const totalRevenue = tips.reduce((s, r) => s + parseFloat(r.saleAmount), 0);
    const totalEarning = tips.reduce((s, r) => s + parseFloat(r.artistEarning), 0);
    const totalPlatformFee = tips.reduce((s, r) => s + parseFloat(r.platformFee), 0);

    // Breakdown by video (from productName)
    const byVideo = tips.reduce<Record<string, { title: string; count: number; earning: number }>>((acc, t) => {
      const title = t.productName.replace('TV Tip — ', '');
      if (!acc[title]) acc[title] = { title, count: 0, earning: 0 };
      acc[title].count += 1;
      acc[title].earning += parseFloat(t.artistEarning);
      return acc;
    }, {});

    const recentTips = tips.slice(0, 20).map(t => ({
      id: t.id,
      videoTitle: t.productName.replace('TV Tip — ', ''),
      amount: parseFloat(t.saleAmount),
      earning: parseFloat(t.artistEarning),
      createdAt: t.createdAt,
    }));

    return res.json({
      success: true,
      stats: {
        totalTips: tips.length,
        totalRevenue,
        totalEarning,
        totalPlatformFee,
        byVideo: Object.values(byVideo).sort((a, b) => b.earning - a.earning),
        recentTips,
        periodDays: days,
      },
    });
  } catch (err) {
    console.error('[TV Revenue]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch revenue stats' });
  }
});

// ─── GET /api/tv/monetization/top-tipped — public leaderboard ────────────────

router.get('/top-tipped', async (_req: Request, res: Response) => {
  try {
    // Aggregate total tips per artist from the last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await db
      .select({
        artistId: salesTransactions.artistId,
        totalEarning: sql<number>`sum(cast(${salesTransactions.artistEarning} as numeric))`.as('total_earning'),
        tipCount: sql<number>`count(*)`.as('tip_count'),
      })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.status, 'completed'),
          like(salesTransactions.productName, 'TV Tip — %'),
          gte(salesTransactions.createdAt, since),
        ),
      )
      .groupBy(salesTransactions.artistId)
      .orderBy(desc(sql`total_earning`))
      .limit(10);

    // Enrich with artist names
    const enriched = await Promise.all(
      rows.map(async r => {
        const [artist] = await db
          .select({ artistName: users.artistName, slug: users.slug })
          .from(users)
          .where(eq(users.id, r.artistId))
          .limit(1);
        return {
          artistId: r.artistId,
          artistName: artist?.artistName ?? 'Unknown Artist',
          artistSlug: artist?.slug ?? null,
          totalEarning: Number(r.totalEarning),
          tipCount: Number(r.tipCount),
        };
      }),
    );

    return res.json({ success: true, leaderboard: enriched });
  } catch (err) {
    console.error('[TV Top-Tipped]', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
  }
});

export default router;
