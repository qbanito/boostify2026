/**
 * E2E test for the Fan Monetization money path (no Stripe / no browser needed).
 *
 * Simulates a completed Stripe checkout for an artist catalog unlock and asserts:
 *  1) the unlock row is created (status 'active'),
 *  2) the artist wallet is credited exactly 85% (15% platform fee),
 *  3) hasActiveUnlock() then returns true for that fan,
 *  4) re-processing the SAME session is idempotent (no double credit / no 2nd row).
 *
 * Cleans up ALL test artifacts and restores the wallet to its exact prior state.
 *
 * Run: npx tsx scripts/test-artist-unlock.ts [artistId]
 */
import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db';
import { artistAccessUnlocks, artistWallet, walletTransactions } from '../server/db/schema';
import { recordArtistUnlock } from '../server/services/artist-unlock-service';
import { hasActiveUnlock } from '../server/routes/fan-monetization';

const ARTIST_ID = parseInt(process.argv[2] || '1417', 10);
const TEST_EMAIL = `e2e-unlock-${Date.now()}@boostify.test`;
const TEST_SESSION = `cs_test_e2e_${Date.now()}`;
const AMOUNT = 10; // $10 → artist 8.50, platform 1.50

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
  console.log(`\n🧪 E2E artist-unlock money path — artist #${ARTIST_ID}, $${AMOUNT}\n`);

  // Snapshot wallet before (for assertions + exact restore)
  const before = await db.query.artistWallet.findFirst({ where: eq(artistWallet.userId, ARTIST_ID) });
  const balBefore = before ? parseFloat(before.balance) : 0;
  const earnBefore = before ? parseFloat(before.totalEarnings) : 0;
  console.log(`  ℹ️ wallet before: balance=$${balBefore.toFixed(2)} totalEarnings=$${earnBefore.toFixed(2)}\n`);

  try {
    // ── 1) First processing ────────────────────────────────────────────────
    console.log('1) First webhook processing:');
    const r1 = await recordArtistUnlock({
      stripeSessionId: TEST_SESSION,
      artistId: ARTIST_ID,
      fanUserId: null,
      fanEmail: TEST_EMAIL,
      amount: AMOUNT,
      currency: 'usd',
    });
    assert(r1.ok && !r1.alreadyProcessed, 'unlock processed (not a duplicate)');
    assert(r1.artistEarning === 8.5, '85% split → artist earning', `$${r1.artistEarning}`);
    assert(r1.platformFee === 1.5, '15% split → platform fee', `$${r1.platformFee}`);

    const row = await db.query.artistAccessUnlocks.findFirst({
      where: eq(artistAccessUnlocks.stripePaymentId, TEST_SESSION),
    });
    assert(!!row && row.status === 'active', 'unlock row created with status=active');
    assert(!!row && parseFloat(row.amountPaid) === AMOUNT, 'unlock amountPaid recorded', `$${row?.amountPaid}`);

    const afterCredit = await db.query.artistWallet.findFirst({ where: eq(artistWallet.userId, ARTIST_ID) });
    const balAfter = afterCredit ? parseFloat(afterCredit.balance) : 0;
    assert(Math.round((balAfter - balBefore) * 100) / 100 === 8.5, 'wallet balance credited +$8.50', `now $${balAfter.toFixed(2)}`);

    // ── 2) Access check ─────────────────────────────────────────────────────
    console.log('\n2) Access resolution:');
    const access = await hasActiveUnlock(ARTIST_ID, null, TEST_EMAIL);
    assert(access === true, 'hasActiveUnlock() returns true for the fan');
    const noAccess = await hasActiveUnlock(ARTIST_ID, null, 'stranger@nobody.test');
    assert(noAccess === false, 'hasActiveUnlock() returns false for a different fan');

    // ── 3) Idempotency (webhook retry) ──────────────────────────────────────
    console.log('\n3) Idempotency (Stripe retries the same event):');
    const r2 = await recordArtistUnlock({
      stripeSessionId: TEST_SESSION,
      artistId: ARTIST_ID,
      fanUserId: null,
      fanEmail: TEST_EMAIL,
      amount: AMOUNT,
      currency: 'usd',
    });
    assert(r2.alreadyProcessed === true, 'second processing is a no-op (alreadyProcessed)');
    const afterRetry = await db.query.artistWallet.findFirst({ where: eq(artistWallet.userId, ARTIST_ID) });
    const balRetry = afterRetry ? parseFloat(afterRetry.balance) : 0;
    assert(balRetry === balAfter, 'wallet NOT double-credited on retry', `still $${balRetry.toFixed(2)}`);
    const rows = await db
      .select({ id: artistAccessUnlocks.id })
      .from(artistAccessUnlocks)
      .where(eq(artistAccessUnlocks.stripePaymentId, TEST_SESSION));
    assert(rows.length === 1, 'exactly ONE unlock row exists (no duplicate)');
  } finally {
    // ── Cleanup: remove all test artifacts and restore wallet exactly ───────
    console.log('\n🧹 Cleanup:');
    // Delete the test wallet transaction(s), matched precisely by session id.
    const txs = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, ARTIST_ID));
    for (const t of txs) {
      const meta: any = t.metadata;
      if (meta && meta.stripeSessionId === TEST_SESSION) {
        await db.delete(walletTransactions).where(eq(walletTransactions.id, t.id));
      }
    }
    await db.delete(artistAccessUnlocks).where(eq(artistAccessUnlocks.stripePaymentId, TEST_SESSION));
    // Restore wallet to the exact prior numbers (or zero it if it didn't exist).
    await db
      .update(artistWallet)
      .set({
        balance: before ? before.balance : '0',
        totalEarnings: before ? before.totalEarnings : '0',
        updatedAt: new Date(),
      })
      .where(eq(artistWallet.userId, ARTIST_ID));
    const restored = await db.query.artistWallet.findFirst({ where: eq(artistWallet.userId, ARTIST_ID) });
    console.log(`  ↩️ wallet restored: balance=$${restored ? parseFloat(restored.balance).toFixed(2) : 'n/a'} (was $${balBefore.toFixed(2)})`);
    console.log('  🗑️ test unlock row + wallet transaction deleted');
  }

  console.log(`\n${failed === 0 ? '✅ ALL PASSED' : '❌ SOME FAILED'} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥 Test crashed:', e);
  process.exit(1);
});
