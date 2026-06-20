/**
 * Artist Unlock Service
 *
 * Records a fan's pay-what-you-want catalog unlock and credits the artist's
 * wallet with an 85% / 15% split. Idempotent by Stripe session id so webhook
 * retries never double-credit.
 *
 * Extracted from the Stripe webhook so the money path can be unit-tested in
 * isolation (see scripts/test-artist-unlock.ts).
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { artistAccessUnlocks, artistFanLeads, artistWallet, users, walletTransactions } from '../db/schema';

export const ARTIST_SPLIT = 0.85; // 85% to the artist, 15% to Boostify

export interface RecordUnlockParams {
  stripeSessionId: string;
  artistId: number;
  fanUserId?: number | null;
  fanEmail?: string | null;
  amount: number; // dollars
  currency?: string;
}

export interface RecordUnlockResult {
  ok: boolean;
  alreadyProcessed: boolean;
  artistEarning: number;
  platformFee: number;
  balanceAfter?: number;
}

/**
 * Idempotently record an unlock and credit the artist wallet (85/15 split).
 */
export async function recordArtistUnlock(params: RecordUnlockParams): Promise<RecordUnlockResult> {
  const { stripeSessionId, artistId, amount } = params;
  const fanUserId = params.fanUserId ?? null;
  const fanEmail = params.fanEmail ?? null;
  const currency = (params.currency || 'usd').toLowerCase();

  if (!artistId || isNaN(artistId)) {
    throw new Error('recordArtistUnlock: invalid artistId');
  }

  const artistEarning = Math.round(amount * ARTIST_SPLIT * 100) / 100;
  const platformFee = Math.round((amount - artistEarning) * 100) / 100;

  // ── Idempotency: skip if this Stripe session was already processed ───────
  const existing = await db
    .select({ id: artistAccessUnlocks.id })
    .from(artistAccessUnlocks)
    .where(eq(artistAccessUnlocks.stripePaymentId, stripeSessionId))
    .limit(1);
  if (existing.length > 0) {
    console.log(`ℹ️ artist_unlock already processed for session ${stripeSessionId}`);
    return { ok: true, alreadyProcessed: true, artistEarning, platformFee };
  }

  // ── 1) Record the unlock (active) ────────────────────────────────────────
  await db.insert(artistAccessUnlocks).values({
    artistId,
    fanUserId,
    fanEmail,
    amountPaid: amount.toFixed(2),
    currency,
    stripePaymentId: stripeSessionId,
    status: 'active',
  });
  console.log(`✅ Unlock recorded: fan ${fanEmail || fanUserId} → artist #${artistId} ($${amount.toFixed(2)})`);

  // ── 1.5) Auto-enroll this payer as an artist-scoped fan (not platform-wide) ──
  if (fanEmail) {
    try {
      const [artistRow] = await db
        .select({ slug: users.slug })
        .from(users)
        .where(eq(users.id, artistId))
        .limit(1);

      await db.insert(artistFanLeads).values({
        artistId,
        email: fanEmail.toLowerCase(),
        name: null,
        artistSlug: artistRow?.slug || String(artistId),
        source: 'paid_unlock',
        metadata: {
          type: 'artist_unlock',
          stripeSessionId,
          amount,
          currency,
        },
      }).onConflictDoNothing({
        target: [artistFanLeads.artistId, artistFanLeads.email],
      });
    } catch (fanErr) {
      console.warn('⚠️ Failed to auto-enroll paid fan lead:', fanErr);
    }
  }

  // ── 2) Credit the artist wallet (85% artist / 15% Boostify) ──────────────
  let balanceAfter: number | undefined;
  try {
    let wallet = await db.query.artistWallet.findFirst({
      where: eq(artistWallet.userId, artistId),
    });
    if (!wallet) {
      const [created] = await db
        .insert(artistWallet)
        .values({ userId: artistId, balance: '0', totalEarnings: '0', totalSpent: '0', currency })
        .returning();
      wallet = created;
    }

    const balanceBefore = parseFloat(wallet.balance);
    balanceAfter = Math.round((balanceBefore + artistEarning) * 100) / 100;
    const totalEarnings = Math.round((parseFloat(wallet.totalEarnings) + artistEarning) * 100) / 100;

    await db
      .update(artistWallet)
      .set({
        balance: balanceAfter.toFixed(2),
        totalEarnings: totalEarnings.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(artistWallet.userId, artistId));

    await db.insert(walletTransactions).values({
      userId: artistId,
      type: 'earning',
      amount: artistEarning.toFixed(2),
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: balanceAfter.toFixed(2),
      description: `Catalog unlock by ${fanEmail || 'a fan'} (85% of $${amount.toFixed(2)})`,
      metadata: { type: 'artist_unlock', stripeSessionId, platformFee, fanEmail },
    });

    console.log(`💰 Wallet credited: artist #${artistId} +$${artistEarning.toFixed(2)} (platform $${platformFee.toFixed(2)})`);
  } catch (walletErr) {
    console.error('❌ Failed to credit artist wallet for unlock:', walletErr);
  }

  return { ok: true, alreadyProcessed: false, artistEarning, platformFee, balanceAfter };
}
