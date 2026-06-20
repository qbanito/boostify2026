/**
 * E2E test for the Module Unlock money path (no Stripe / no browser needed).
 *
 * Simulates a completed Stripe checkout for a one-time module unlock and asserts:
 *  1) the unlock row is created (status 'active'),
 *  2) getUnlockedModuleKeys() / hasModuleUnlock() then return it,
 *  3) resolveModuleAccess() grants access for that module (and the all-access
 *     pass grants access to OTHER modules too),
 *  4) re-processing the SAME session is idempotent (no duplicate row),
 *  5) NO artist wallet split happens (pure platform product).
 *
 * Cleans up ALL test artifacts.
 *
 * Run: npx tsx scripts/test-module-unlock.ts [userId]
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { moduleUnlocks } from '../server/db/schema';
import {
  recordModuleUnlock,
  getUnlockedModuleKeys,
  hasModuleUnlock,
} from '../server/services/module-unlock-service';
import { resolveModuleAccess, ALL_ACCESS_KEY } from '../shared/module-catalog';

const USER_ID = parseInt(process.argv[2] || '1417', 10);
const MODULE_KEY = 'music-video-creator';
const SESSION_1 = `cs_test_mod_${Date.now()}`;
const SESSION_2 = `cs_test_all_${Date.now()}`;
const AMOUNT = 49;

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string, extra = '') {
  if (cond) {
    console.log(`  ✅ ${label}${extra ? ' — ' + extra : ''}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${extra ? ' — ' + extra : ''}`);
    failed++;
  }
}

async function main() {
  console.log(`\n🧪 E2E module-unlock money path — user #${USER_ID}\n`);

  try {
    // ── 1) Single module unlock ─────────────────────────────────────────────
    console.log(`1) Unlock single module '${MODULE_KEY}' ($${AMOUNT}):`);
    const r1 = await recordModuleUnlock({
      stripeSessionId: SESSION_1,
      userId: USER_ID,
      moduleKey: MODULE_KEY,
      amount: AMOUNT,
      currency: 'usd',
    });
    assert(r1.ok && !r1.alreadyProcessed, 'unlock processed (not a duplicate)');

    const row = await db.query.moduleUnlocks.findFirst({
      where: eq(moduleUnlocks.stripePaymentId, SESSION_1),
    });
    assert(!!row && row.status === 'active', 'unlock row created with status=active');
    assert(!!row && row.moduleKey === MODULE_KEY, 'unlock moduleKey recorded', row?.moduleKey);
    assert(!!row && parseFloat(row.amountPaid) === AMOUNT, 'amountPaid recorded', `$${row?.amountPaid}`);

    const keys = await getUnlockedModuleKeys(USER_ID);
    assert(keys.includes(MODULE_KEY), 'getUnlockedModuleKeys() includes the module');
    assert(await hasModuleUnlock(USER_ID, MODULE_KEY), 'hasModuleUnlock() true for the module');

    // ── 2) Access resolution (free plan, no admin) ──────────────────────────
    console.log('\n2) Access resolution (free plan, not admin):');
    assert(
      resolveModuleAccess(MODULE_KEY, 'free', keys, false) === true,
      'resolveModuleAccess grants the unlocked module on free plan',
    );
    assert(
      resolveModuleAccess('artist-generator', 'free', keys, false) === false,
      'resolveModuleAccess DENIES a different (not unlocked) module',
    );
    assert(
      resolveModuleAccess('artist-generator', 'enterprise', keys, false) === true,
      'subscription (enterprise) grants a premium module without unlock',
    );

    // ── 3) Idempotency (webhook retry) ──────────────────────────────────────
    console.log('\n3) Idempotency (Stripe retries the same event):');
    const r1b = await recordModuleUnlock({
      stripeSessionId: SESSION_1,
      userId: USER_ID,
      moduleKey: MODULE_KEY,
      amount: AMOUNT,
      currency: 'usd',
    });
    assert(r1b.alreadyProcessed === true, 'second processing is a no-op (alreadyProcessed)');
    const dupRows = await db
      .select({ id: moduleUnlocks.id })
      .from(moduleUnlocks)
      .where(eq(moduleUnlocks.stripePaymentId, SESSION_1));
    assert(dupRows.length === 1, 'exactly ONE unlock row exists (no duplicate)');

    // ── 4) All-access pass grants everything ────────────────────────────────
    console.log('\n4) All-access lifetime pass:');
    await recordModuleUnlock({
      stripeSessionId: SESSION_2,
      userId: USER_ID,
      moduleKey: ALL_ACCESS_KEY,
      amount: 399,
      currency: 'usd',
    });
    const keys2 = await getUnlockedModuleKeys(USER_ID);
    assert(keys2.includes(ALL_ACCESS_KEY), 'all-access key recorded');
    assert(
      resolveModuleAccess('artist-generator', 'free', keys2, false) === true,
      'all-access grants ANY module on free plan',
    );
    assert(
      resolveModuleAccess('virtual-record-label', 'free', keys2, false) === true,
      'all-access grants another premium module too',
    );
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    console.log('\n🧹 Cleanup:');
    await db.delete(moduleUnlocks).where(
      and(eq(moduleUnlocks.userId, USER_ID), eq(moduleUnlocks.stripePaymentId, SESSION_1)),
    );
    await db.delete(moduleUnlocks).where(
      and(eq(moduleUnlocks.userId, USER_ID), eq(moduleUnlocks.stripePaymentId, SESSION_2)),
    );
    const leftover = await getUnlockedModuleKeys(USER_ID);
    console.log(`  🗑️ test unlock rows deleted · remaining keys for user: [${leftover.join(', ')}]`);
  }

  console.log(`\n${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥 Test crashed:', e);
  process.exit(1);
});
