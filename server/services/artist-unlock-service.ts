/**
 * Artist Unlock Service
 *
 * Records a fan's pay-what-you-want catalog unlock and credits the artist's
 * wallet with an 80% / 20% split. Idempotent by Stripe session id so webhook
 * retries never double-credit.
 *
 * Extracted from the Stripe webhook so the money path can be unit-tested in
 * isolation (see scripts/test-artist-unlock.ts).
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { artistAccessUnlocks, artistFanLeads, artistWallet, salesTransactions, users, walletTransactions, notifications } from '../db/schema';
import { musicCatalogSplit } from '../../shared/music-catalog-pricing';

export const ARTIST_SPLIT = 0.80; // 80% to the artist, 20% to Boostify

export interface RecordUnlockParams {
  stripeSessionId: string;
  artistId: number;
  fanUserId?: number | null;
  fanEmail?: string | null;
  amount: number; // dollars
  currency?: string;
  /** Destination charges already transfer the artist's share through Stripe. */
  settlement?: 'stripe_connect' | 'wallet';
}

export interface RecordUnlockResult {
  ok: boolean;
  alreadyProcessed: boolean;
  artistEarning: number;
  platformFee: number;
  balanceAfter?: number;
}

/**
 * Idempotently record an unlock and credit the artist wallet (80/20 split).
 */
export async function recordArtistUnlock(params: RecordUnlockParams): Promise<RecordUnlockResult> {
  const { stripeSessionId, artistId, amount } = params;
  const fanUserId = params.fanUserId ?? null;
  const fanEmail = params.fanEmail ?? null;
  const currency = (params.currency || 'usd').toLowerCase();

  if (!artistId || isNaN(artistId)) {
    throw new Error('recordArtistUnlock: invalid artistId');
  }
  if (!stripeSessionId || !Number.isFinite(amount) || amount <= 0 || currency !== 'usd') {
    throw new Error('recordArtistUnlock: invalid payment details');
  }

  const { artistShareCents, platformFeeCents } = musicCatalogSplit(Math.round(amount * 100));
  const artistEarning = artistShareCents / 100;
  const platformFee = platformFeeCents / 100;

  // ── Idempotency: skip if this Stripe session was already processed ───────
  // Lock across processes and commit entitlement and credit together.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${stripeSessionId}, 0))`);
    const [existing] = await tx.select({ id: artistAccessUnlocks.id })
      .from(artistAccessUnlocks).where(eq(artistAccessUnlocks.stripePaymentId, stripeSessionId)).limit(1);
    if (existing) return { ok: true, alreadyProcessed: true, artistEarning, platformFee };
    await tx.insert(artistAccessUnlocks).values({
      artistId, fanUserId, fanEmail, amountPaid: amount.toFixed(2), currency,
      stripePaymentId: stripeSessionId, status: 'active',
    });
    const [sale] = await tx.insert(salesTransactions).values({
      artistId, productName: 'Music catalog access', saleAmount: amount.toFixed(2),
      productionCost: '0', artistEarning: artistEarning.toFixed(2), platformFee: platformFee.toFixed(2),
      commissionRate: 80, quantity: 1, currency, buyerEmail: fanEmail,
      stripePaymentId: stripeSessionId, status: 'completed',
    }).returning({ id: salesTransactions.id });
    let balanceAfter: number | undefined;
    if (params.settlement !== 'stripe_connect') {
      await tx.insert(artistWallet).values({ userId: artistId, balance: '0', totalEarnings: '0', totalSpent: '0', currency })
        .onConflictDoNothing({ target: artistWallet.userId });
      const [wallet] = await tx.update(artistWallet).set({
        balance: sql`${artistWallet.balance} + ${artistEarning.toFixed(2)}::numeric`,
        totalEarnings: sql`${artistWallet.totalEarnings} + ${artistEarning.toFixed(2)}::numeric`,
        updatedAt: new Date(),
      }).where(eq(artistWallet.userId, artistId)).returning({ balance: artistWallet.balance });
      balanceAfter = Number(wallet.balance);
      const balanceBefore = Math.round((balanceAfter - artistEarning) * 100) / 100;
      await tx.insert(walletTransactions).values({
        userId: artistId, type: 'earning', amount: artistEarning.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2), balanceAfter: balanceAfter.toFixed(2),
        relatedSaleId: sale.id,
        description: `Catalog unlock (80% of $${amount.toFixed(2)})`,
        metadata: { type: 'artist_unlock', stripeSessionId, platformFee },
      });
    }
    await tx.insert(notifications).values({
      userId: artistId, type: 'PAYMENT_SUCCESS', title: 'Music catalog sale',
      message: `A fan unlocked your catalog. Artist share: $${artistEarning.toFixed(2)}.`,
      metadata: { amount: artistEarning, saleId: sale.id },
    });
    if (fanUserId) await tx.insert(notifications).values({
      userId: fanUserId, type: 'PAYMENT_SUCCESS', title: 'Music catalog unlocked',
      message: 'Your payment was confirmed and your catalog access is active.',
      metadata: { artistId, saleId: sale.id },
    });
    return { ok: true, alreadyProcessed: false, artistEarning, platformFee, balanceAfter };
  });
}

export interface RecordSubscriptionPaymentParams {
  stripeInvoiceId: string;
  artistId: number;
  fanUserId?: number | null;
  fanEmail?: string | null;
  amount: number; // dollars (amount_paid for this invoice)
  currency?: string;
}

/**
 * Idempotently record a monthly catalog-membership invoice payment and credit
 * the artist wallet (80/20 split). Runs on every successful invoice
 * (first charge + each renewal). Idempotent by Stripe invoice id.
 */
export async function recordArtistSubscriptionPayment(
  params: RecordSubscriptionPaymentParams,
): Promise<RecordUnlockResult> {
  const { stripeInvoiceId, artistId, amount } = params;
  const fanUserId = params.fanUserId ?? null;
  const fanEmail = params.fanEmail ?? null;
  const currency = (params.currency || 'usd').toLowerCase();

  if (!artistId || isNaN(artistId)) {
    throw new Error('recordArtistSubscriptionPayment: invalid artistId');
  }

  const artistEarning = Math.round(amount * ARTIST_SPLIT * 100) / 100;
  const platformFee = Math.round((amount - artistEarning) * 100) / 100;

  // ── Idempotency: skip if this Stripe invoice was already processed ────────
  const existing = await db
    .select({ id: salesTransactions.id })
    .from(salesTransactions)
    .where(eq(salesTransactions.stripePaymentId, stripeInvoiceId))
    .limit(1);
  if (existing.length > 0) {
    console.log(`ℹ️ artist_catalog_subscription invoice already processed: ${stripeInvoiceId}`);
    return { ok: true, alreadyProcessed: true, artistEarning, platformFee };
  }

  if (amount <= 0) {
    return { ok: true, alreadyProcessed: false, artistEarning: 0, platformFee: 0 };
  }

  // ── 1) Record the sale (completed) ───────────────────────────────────────
  let saleId: number | undefined;
  try {
    const [sale] = await db
      .insert(salesTransactions)
      .values({
        artistId,
        productName: 'Membresía mensual del catálogo',
        saleAmount: amount.toFixed(2),
        productionCost: '0',
        artistEarning: artistEarning.toFixed(2),
        platformFee: platformFee.toFixed(2),
        commissionRate: 15,
        quantity: 1,
        currency,
        buyerEmail: fanEmail,
        stripePaymentId: stripeInvoiceId,
        status: 'completed',
      })
      .returning({ id: salesTransactions.id });
    saleId = sale?.id;
  } catch (saleErr) {
    console.error('❌ Failed to record subscription sale:', saleErr);
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
      description: `Membresía mensual de ${fanEmail || 'un fan'} (80% de $${amount.toFixed(2)})`,
      relatedSaleId: saleId ?? null,
      metadata: { type: 'artist_catalog_subscription', stripeInvoiceId, platformFee, fanEmail },
    });

    console.log(`💰 Wallet credited (membership): artist #${artistId} +$${artistEarning.toFixed(2)} (platform $${platformFee.toFixed(2)})`);
  } catch (walletErr) {
    console.error('❌ Failed to credit artist wallet for subscription:', walletErr);
  }

  // ── 3) Auto-enroll the paying fan as an artist-scoped lead ───────────────
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
        source: 'paid_membership',
        metadata: { type: 'artist_catalog_subscription', stripeInvoiceId, amount, currency },
      }).onConflictDoNothing({
        target: [artistFanLeads.artistId, artistFanLeads.email],
      });
    } catch (fanErr) {
      console.warn('⚠️ Failed to auto-enroll membership fan lead:', fanErr);
    }
  }

  return { ok: true, alreadyProcessed: false, artistEarning, platformFee, balanceAfter };
}
