/**
 * BOOSTIFY Treasury Engine
 * =========================
 * Smart funding pool that keeps provider token balances healthy.
 *
 * Idea: a credit is sold to the user at `markup`x its real provider cost.
 * On every credit purchase we set aside the real-cost share (paid / markup)
 * into a funding reserve. Every billable operation records its real provider
 * spend against that reserve. Admins see, per provider, how much is reserved,
 * how much has been spent, the last known external balance, and a health
 * status with low-balance alerts. Auto-recharge is supported only where the
 * provider exposes a programmatic top-up (most do not, so it is opt-in).
 *
 * All functions are best-effort and never throw to the caller path — a treasury
 * hiccup must never block a user purchase or a billable operation.
 */

import { db } from '../db';
import { providerTreasuryAccounts as treasuryAccounts, providerTreasuryTransactions as treasuryTransactions } from '../db/schema';
import { eq, sql, desc, gte } from 'drizzle-orm';
import { OPERATION_COSTS, DEFAULT_MARKUP_MULTIPLIER, type OperationType } from '../../shared/credit-pricing';

const POOL = '_pool'; // aggregate reserve shared by all providers

type AccountRow = typeof treasuryAccounts.$inferSelect;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function statusFor(externalBalance: number, threshold: number): 'healthy' | 'low' | 'critical' {
  if (externalBalance <= threshold * 0.4) return 'critical';
  if (externalBalance <= threshold) return 'low';
  return 'healthy';
}

/** Get (or lazily create) a provider account. */
async function ensureAccount(provider: string): Promise<AccountRow | null> {
  try {
    const [row] = await db.select().from(treasuryAccounts).where(eq(treasuryAccounts.provider, provider));
    if (row) return row;
    const [created] = await db.insert(treasuryAccounts).values({ provider }).returning();
    return created;
  } catch (e) {
    // Table may not exist yet (migration not run) — degrade silently.
    return null;
  }
}

/**
 * Reserve the real-cost share of a credit purchase into the funding pool.
 * @param totalPaidUsd what the user actually paid (e.g. package price)
 * @param markup the markup multiplier applied (defaults to config default)
 */
export async function reserveFromPurchase(
  totalPaidUsd: number,
  markup: number = DEFAULT_MARKUP_MULTIPLIER,
  refId?: string,
): Promise<{ reservedUsd: number } | null> {
  try {
    const safeMarkup = markup > 0 ? markup : DEFAULT_MARKUP_MULTIPLIER;
    const reservedUsd = Math.max(0, totalPaidUsd) / safeMarkup;
    if (reservedUsd <= 0) return { reservedUsd: 0 };

    const acct = await ensureAccount(POOL);
    if (!acct) return null;

    const [updated] = await db
      .update(treasuryAccounts)
      .set({
        reservedUsd: sql`${treasuryAccounts.reservedUsd} + ${reservedUsd}`,
        updatedAt: new Date(),
      })
      .where(eq(treasuryAccounts.provider, POOL))
      .returning();

    await db.insert(treasuryTransactions).values({
      provider: POOL,
      type: 'reserve',
      amountUsd: reservedUsd.toFixed(6),
      balanceAfterUsd: updated ? num(updated.reservedUsd).toFixed(4) : null,
      source: 'credit_purchase',
      description: `Reserved provider-funding share of $${totalPaidUsd.toFixed(2)} at ${safeMarkup}x`,
      refId: refId || null,
    });

    return { reservedUsd };
  } catch (e) {
    console.warn('[treasury] reserveFromPurchase failed (non-fatal):', (e as Error)?.message);
    return null;
  }
}

/**
 * Record the real provider spend of a billable operation against the pool and
 * the specific provider account.
 */
export async function recordProviderSpend(
  internalCostUsd: number,
  opts: { operationType?: OperationType | string; provider?: string; source?: string; refId?: string } = {},
): Promise<void> {
  try {
    const cost = Math.max(0, internalCostUsd);
    if (cost <= 0) return;

    let provider = opts.provider;
    if (!provider && opts.operationType) {
      const op = OPERATION_COSTS[opts.operationType as OperationType];
      provider = op?.provider;
    }
    provider = (provider || 'unknown').toLowerCase();

    // Spend against the shared pool (reduces reserve) and the provider account.
    for (const acctProvider of [POOL, provider]) {
      const acct = await ensureAccount(acctProvider);
      if (!acct) continue;

      const isPool = acctProvider === POOL;
      const [updated] = await db
        .update(treasuryAccounts)
        .set({
          spentUsd: sql`${treasuryAccounts.spentUsd} + ${cost}`,
          // For the pool, draining reserve as we spend; provider account just tracks spend.
          ...(isPool ? { reservedUsd: sql`GREATEST(${treasuryAccounts.reservedUsd} - ${cost}, 0)` } : {}),
          // Drawing down the provider's known external balance as we consume it.
          ...(!isPool ? { externalBalanceUsd: sql`${treasuryAccounts.externalBalanceUsd} - ${cost}` } : {}),
          updatedAt: new Date(),
        })
        .where(eq(treasuryAccounts.provider, acctProvider))
        .returning();

      if (updated && !isPool) {
        const ext = num(updated.externalBalanceUsd);
        const threshold = num(updated.lowBalanceThresholdUsd);
        const newStatus = statusFor(ext, threshold);
        if (newStatus !== updated.status) {
          await db
            .update(treasuryAccounts)
            .set({ status: newStatus, lastAlertAt: newStatus !== 'healthy' ? new Date() : updated.lastAlertAt })
            .where(eq(treasuryAccounts.provider, acctProvider));
          if (newStatus !== 'healthy') {
            console.warn(`🏦 [treasury] ${acctProvider} balance ${newStatus.toUpperCase()} — external ~$${ext.toFixed(2)} (threshold $${threshold.toFixed(2)})`);
          }
        }
      }

      await db.insert(treasuryTransactions).values({
        provider: acctProvider,
        type: 'spend',
        amountUsd: (-cost).toFixed(6),
        balanceAfterUsd: updated ? num(isPool ? updated.reservedUsd : updated.externalBalanceUsd).toFixed(4) : null,
        source: opts.source || String(opts.operationType || 'operation'),
        description: `Provider spend ${provider}`,
        refId: opts.refId || null,
      });
    }
  } catch (e) {
    console.warn('[treasury] recordProviderSpend failed (non-fatal):', (e as Error)?.message);
  }
}

/** Admin: manually record a real provider top-up (money sent to FAL/OpenAI/etc). */
export async function recordTopup(
  provider: string,
  amountUsd: number,
  adminEmail: string,
): Promise<AccountRow | null> {
  const p = provider.toLowerCase();
  const acct = await ensureAccount(p);
  if (!acct) return null;

  const [updated] = await db
    .update(treasuryAccounts)
    .set({
      externalBalanceUsd: sql`${treasuryAccounts.externalBalanceUsd} + ${amountUsd}`,
      reservedUsd: sql`GREATEST(${treasuryAccounts.reservedUsd} - ${amountUsd}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(treasuryAccounts.provider, p))
    .returning();

  if (updated) {
    const ext = num(updated.externalBalanceUsd);
    const threshold = num(updated.lowBalanceThresholdUsd);
    const [final] = await db
      .update(treasuryAccounts)
      .set({ status: statusFor(ext, threshold) })
      .where(eq(treasuryAccounts.provider, p))
      .returning();

    await db.insert(treasuryTransactions).values({
      provider: p,
      type: 'topup',
      amountUsd: amountUsd.toFixed(6),
      balanceAfterUsd: num(updated.externalBalanceUsd).toFixed(4),
      source: 'manual',
      description: `Manual top-up by ${adminEmail}`,
    });

    return final || updated;
  }

  await db.insert(treasuryTransactions).values({
    provider: p,
    type: 'topup',
    amountUsd: amountUsd.toFixed(6),
    balanceAfterUsd: null,
    source: 'manual',
    description: `Manual top-up by ${adminEmail}`,
  });

  return updated || null;
}

/** Admin: configure a provider account (threshold / external balance / auto-recharge). */
export async function configureProvider(
  provider: string,
  patch: {
    externalBalanceUsd?: number;
    lowBalanceThresholdUsd?: number;
    autoRechargeEnabled?: boolean;
    autoRechargeAmountUsd?: number;
  },
): Promise<AccountRow | null> {
  const p = provider.toLowerCase();
  await ensureAccount(p);

  const set: Record<string, any> = { updatedAt: new Date() };
  if (patch.externalBalanceUsd !== undefined) set.externalBalanceUsd = patch.externalBalanceUsd.toString();
  if (patch.lowBalanceThresholdUsd !== undefined) set.lowBalanceThresholdUsd = patch.lowBalanceThresholdUsd.toString();
  if (patch.autoRechargeEnabled !== undefined) set.autoRechargeEnabled = patch.autoRechargeEnabled;
  if (patch.autoRechargeAmountUsd !== undefined) set.autoRechargeAmountUsd = patch.autoRechargeAmountUsd.toString();

  const [updated] = await db
    .update(treasuryAccounts)
    .set(set)
    .where(eq(treasuryAccounts.provider, p))
    .returning();

  if (updated) {
    const ext = num(updated.externalBalanceUsd);
    const threshold = num(updated.lowBalanceThresholdUsd);
    const [final] = await db
      .update(treasuryAccounts)
      .set({ status: statusFor(ext, threshold) })
      .where(eq(treasuryAccounts.provider, p))
      .returning();
    return final || updated;
  }
  return updated || null;
}

/** Admin dashboard overview: all accounts + recent ledger + 30-day totals. */
export async function getTreasuryOverview(): Promise<{
  pool: { reservedUsd: number; spentUsd: number };
  providers: Array<{
    provider: string;
    reservedUsd: number;
    spentUsd: number;
    externalBalanceUsd: number;
    lowBalanceThresholdUsd: number;
    autoRechargeEnabled: boolean;
    autoRechargeAmountUsd: number;
    status: string;
    updatedAt: Date | null;
  }>;
  recentTransactions: Array<{
    provider: string; type: string; amountUsd: number; source: string | null; description: string | null; createdAt: Date;
  }>;
  last30Days: { reservedUsd: number; spentUsd: number };
}> {
  const empty = {
    pool: { reservedUsd: 0, spentUsd: 0 },
    providers: [],
    recentTransactions: [],
    last30Days: { reservedUsd: 0, spentUsd: 0 },
  };
  try {
    const accounts = await db.select().from(treasuryAccounts);
    const poolRow = accounts.find((a) => a.provider === POOL);

    const recent = await db
      .select()
      .from(treasuryTransactions)
      .orderBy(desc(treasuryTransactions.createdAt))
      .limit(50);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const windowTx = await db
      .select()
      .from(treasuryTransactions)
      .where(gte(treasuryTransactions.createdAt, since));

    let reserved30 = 0;
    let spent30 = 0;
    for (const t of windowTx) {
      if (t.provider !== POOL) continue;
      if (t.type === 'reserve') reserved30 += num(t.amountUsd);
      if (t.type === 'spend') spent30 += Math.abs(num(t.amountUsd));
    }

    return {
      pool: { reservedUsd: num(poolRow?.reservedUsd), spentUsd: num(poolRow?.spentUsd) },
      providers: accounts
        .filter((a) => a.provider !== POOL)
        .map((a) => ({
          provider: a.provider,
          reservedUsd: num(a.reservedUsd),
          spentUsd: num(a.spentUsd),
          externalBalanceUsd: num(a.externalBalanceUsd),
          lowBalanceThresholdUsd: num(a.lowBalanceThresholdUsd),
          autoRechargeEnabled: a.autoRechargeEnabled,
          autoRechargeAmountUsd: num(a.autoRechargeAmountUsd),
          status: a.status,
          updatedAt: a.updatedAt,
        })),
      recentTransactions: recent.map((t) => ({
        provider: t.provider,
        type: t.type,
        amountUsd: num(t.amountUsd),
        source: t.source,
        description: t.description,
        createdAt: t.createdAt,
      })),
      last30Days: { reservedUsd: reserved30, spentUsd: spent30 },
    };
  } catch (e) {
    console.warn('[treasury] getTreasuryOverview failed (non-fatal):', (e as Error)?.message);
    return empty;
  }
}
