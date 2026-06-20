/**
 * Module Unlock Service
 *
 * Records a user's one-time platform module unlock (lifetime access). Unlike
 * artist catalog unlocks, this is a pure platform product: Boostify keeps 100%
 * — there is NO artist wallet split.
 *
 * Idempotent by Stripe session id so webhook retries never create duplicates.
 * Extracted so the money path can be unit-tested (scripts/test-module-unlock.ts).
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { moduleUnlocks } from '../db/schema';
import { ALL_ACCESS_KEY, isValidModuleKey } from '../../shared/module-catalog';

export interface RecordModuleUnlockParams {
  stripeSessionId: string;
  userId: number;
  moduleKey: string;
  amount: number; // dollars
  currency?: string;
}

export interface RecordModuleUnlockResult {
  ok: boolean;
  alreadyProcessed: boolean;
}

/**
 * Idempotently record a module unlock (status 'active').
 */
export async function recordModuleUnlock(
  params: RecordModuleUnlockParams,
): Promise<RecordModuleUnlockResult> {
  const { stripeSessionId, userId, moduleKey, amount } = params;
  const currency = (params.currency || 'usd').toLowerCase();

  if (!userId || isNaN(userId)) throw new Error('recordModuleUnlock: invalid userId');
  if (!moduleKey || !isValidModuleKey(moduleKey)) {
    throw new Error(`recordModuleUnlock: invalid moduleKey '${moduleKey}'`);
  }

  // ── Idempotency: skip if this Stripe session was already processed ───────
  const existing = await db
    .select({ id: moduleUnlocks.id })
    .from(moduleUnlocks)
    .where(eq(moduleUnlocks.stripePaymentId, stripeSessionId))
    .limit(1);
  if (existing.length > 0) {
    console.log(`ℹ️ module_unlock already processed for session ${stripeSessionId}`);
    return { ok: true, alreadyProcessed: true };
  }

  await db.insert(moduleUnlocks).values({
    userId,
    moduleKey,
    amountPaid: amount.toFixed(2),
    currency,
    stripePaymentId: stripeSessionId,
    status: 'active',
  });
  console.log(`✅ Module unlocked: user #${userId} → '${moduleKey}' ($${amount.toFixed(2)})`);

  return { ok: true, alreadyProcessed: false };
}

/**
 * All module keys the user has actively unlocked. If they own the all-access
 * pass, that key is present (the catalog resolver treats it as "everything").
 */
export async function getUnlockedModuleKeys(userId: number): Promise<string[]> {
  if (!userId || isNaN(userId)) return [];
  const rows = await db
    .select({ moduleKey: moduleUnlocks.moduleKey })
    .from(moduleUnlocks)
    .where(and(eq(moduleUnlocks.userId, userId), eq(moduleUnlocks.status, 'active')));
  return Array.from(new Set(rows.map((r) => r.moduleKey)));
}

/** Does the user have this specific module unlocked (or the all-access pass)? */
export async function hasModuleUnlock(userId: number, moduleKey: string): Promise<boolean> {
  const keys = await getUnlockedModuleKeys(userId);
  return keys.includes(ALL_ACCESS_KEY) || keys.includes(moduleKey);
}
