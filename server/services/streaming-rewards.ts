/**
 * Streaming Rewards Engine — BTF token rewards for artists
 * ─────────────────────────────────────────────────────────────────────────────
 * Weekly epochs (Mon 00:00 UTC → next Mon). Per epoch each artist earns:
 *   base_btf   = valid_streams × btf_per_stream
 *   bonus_btf  = unique_listeners × bonus_per_listener
 *   action_btf = platform-action rewards (publish song, merch sale,
 *                credit purchase, follower growth) from reward_action_rules
 * If the epoch total exceeds pool_btf_per_epoch, all lines are pro-rated.
 *
 * Anti-fraud on valid streams (listening_history):
 *   - only plays with ms_played ≥ 30s
 *   - artist self-plays excluded
 *   - capped at max_streams_per_listener_day per (listener, artist, day)
 *   - anonymous plays weighted by anon_weight (default 0.25), capped per day
 *
 * Payout = CLAIM model: admin approves an epoch → entries become claimable →
 * the artist registers a Polygon wallet and claims → on-chain BTF transfer
 * from the platform treasury (PLATFORM_PRIVATE_KEY, same rail as btf-card).
 *
 * Tables: see add-streaming-rewards-tables.mjs. Neon tagged templates (no drizzle).
 */
import { neon } from '@neondatabase/serverless';
import { createPublicClient, createWalletClient, http, fallback, parseUnits } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const getSql = () => neon(process.env.DATABASE_URL!);

export const BTF_TOKEN_ADDRESS = '0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05' as `0x${string}`;
export const BTF_PRICE_USD = 0.001;

const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://polygon-rpc.com',
  'https://1rpc.io/matic',
];

const TRANSFER_ABI = [{
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  name: 'transfer',
  outputs: [{ name: '', type: 'bool' }],
  stateMutability: 'nonpayable',
  type: 'function',
}] as const;

const BALANCE_OF_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export interface RewardConfig {
  active: boolean;
  dryRun: boolean;
  autoCalculate: boolean;
  btfPerStream: number;
  bonusPerListener: number;
  poolBtfPerEpoch: number;
  minStreams: number;
  minClaimBtf: number;
  maxStreamsPerListenerDay: number;
  anonWeight: number;
}

export async function getRewardConfig(): Promise<RewardConfig> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM streaming_reward_config WHERE id = 1`;
  const r: any = rows[0] || {};
  return {
    active: r.active ?? true,
    dryRun: r.dry_run ?? true,
    autoCalculate: r.auto_calculate ?? true,
    btfPerStream: Number(r.btf_per_stream ?? 0.5),
    bonusPerListener: Number(r.bonus_per_listener ?? 1),
    poolBtfPerEpoch: Number(r.pool_btf_per_epoch ?? 100000),
    minStreams: Number(r.min_streams ?? 50),
    minClaimBtf: Number(r.min_claim_btf ?? 100),
    maxStreamsPerListenerDay: Number(r.max_streams_per_listener_day ?? 10),
    anonWeight: Number(r.anon_weight ?? 0.25),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Epoch helpers — weekly, Monday 00:00 UTC boundaries
// ─────────────────────────────────────────────────────────────────────────────

/** Monday 00:00 UTC of the week containing `d`. */
function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7; // Mon=0
  x.setUTCDate(x.getUTCDate() - dow);
  return x;
}

/** The most recent COMPLETE week: [prev Monday, this Monday). */
export function lastCompleteWeek(now = new Date()): { periodKey: string; startsAt: Date; endsAt: Date } {
  const endsAt = weekStart(now);
  const startsAt = new Date(endsAt.getTime() - 7 * 86400 * 1000);
  return { periodKey: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

/** The current, in-progress week: [this Monday, next Monday). */
export function currentWeek(now = new Date()): { periodKey: string; startsAt: Date; endsAt: Date } {
  const startsAt = weekStart(now);
  const endsAt = new Date(startsAt.getTime() + 7 * 86400 * 1000);
  return { periodKey: startsAt.toISOString().slice(0, 10), startsAt, endsAt };
}

// ─────────────────────────────────────────────────────────────────────────────
// Valid streams aggregation (anti-fraud)
// ─────────────────────────────────────────────────────────────────────────────

async function aggregateValidStreams(startsAt: Date, endsAt: Date, cfg: RewardConfig) {
  const sql = getSql();
  // Per (artist, listener, day) groups capped at maxStreamsPerListenerDay.
  // Anonymous listeners (user_id NULL) collapse into one group per artist/day,
  // capped at 4× the per-listener cap and weighted by anonWeight.
  const rows = await sql`
    WITH grouped AS (
      SELECT s.user_id                        AS artist_id,
             lh.user_id                       AS listener_id,
             DATE(lh.played_at)               AS day,
             COUNT(*)                         AS raw_streams
      FROM listening_history lh
      JOIN songs s ON s.id = lh.song_id
      WHERE lh.played_at >= ${startsAt.toISOString()}
        AND lh.played_at <  ${endsAt.toISOString()}
        AND COALESCE(lh.ms_played, 0) >= 30000
        AND s.user_id IS NOT NULL
        AND (lh.user_id IS NULL OR lh.user_id <> s.user_id)
      GROUP BY s.user_id, lh.user_id, DATE(lh.played_at)
    )
    SELECT artist_id,
           SUM(CASE
                 WHEN listener_id IS NULL
                   THEN LEAST(raw_streams::numeric, ${cfg.maxStreamsPerListenerDay * 4}::numeric) * ${cfg.anonWeight}::numeric
                 ELSE LEAST(raw_streams::numeric, ${cfg.maxStreamsPerListenerDay}::numeric)
               END)::numeric                                            AS valid_streams,
           COUNT(DISTINCT listener_id) FILTER (WHERE listener_id IS NOT NULL)::int AS unique_listeners
    FROM grouped
    GROUP BY artist_id
  ` as any[];
  return rows.map((r) => ({
    artistId: Number(r.artist_id),
    validStreams: Number(r.valid_streams || 0),
    uniqueListeners: Number(r.unique_listeners || 0),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Action rewards — derived from existing tables at calculation time
// (idempotent: events are wiped + recomputed with the epoch)
// ─────────────────────────────────────────────────────────────────────────────

interface ActionRule { actionKey: string; label: string; btfAmount: number; maxPerEpoch: number; active: boolean }

export async function getActionRules(): Promise<ActionRule[]> {
  const sql = getSql();
  const rows = await sql`SELECT * FROM reward_action_rules ORDER BY action_key` as any[];
  return rows.map((r) => ({
    actionKey: r.action_key,
    label: r.label,
    btfAmount: Number(r.btf_amount),
    maxPerEpoch: Number(r.max_per_epoch),
    active: !!r.active,
  }));
}

async function computeActionEvents(epochId: number, startsAt: Date, endsAt: Date) {
  const sql = getSql();
  const rules = (await getActionRules()).filter((r) => r.active);
  const byKey = new Map(rules.map((r) => [r.actionKey, r]));
  const events: { artistId: number; actionKey: string; qty: number; btf: number; meta: any }[] = [];

  // 1) publish_song — published songs created in the window
  const pub = byKey.get('publish_song');
  if (pub) {
    const rows = await sql`
      SELECT user_id AS artist_id, COUNT(*)::int AS n
      FROM songs
      WHERE is_published = true AND created_at >= ${startsAt.toISOString()} AND created_at < ${endsAt.toISOString()}
        AND user_id IS NOT NULL
      GROUP BY user_id
    ` as any[];
    for (const r of rows) {
      const qty = Math.min(Number(r.n), pub.maxPerEpoch);
      if (qty > 0) events.push({ artistId: Number(r.artist_id), actionKey: 'publish_song', qty, btf: qty * pub.btfAmount, meta: { songs: Number(r.n) } });
    }
  }

  // 2) merch_sale — first merch sale(s) of the window
  const merch = byKey.get('merch_sale');
  if (merch) {
    const rows = await sql`
      SELECT artist_id, COUNT(*)::int AS n
      FROM sales_transactions
      WHERE created_at >= ${startsAt.toISOString()} AND created_at < ${endsAt.toISOString()}
      GROUP BY artist_id
    ` as any[];
    for (const r of rows) {
      const qty = Math.min(Number(r.n), merch.maxPerEpoch);
      if (qty > 0) events.push({ artistId: Number(r.artist_id), actionKey: 'merch_sale', qty, btf: qty * merch.btfAmount, meta: { sales: Number(r.n) } });
    }
  }

  // 3) credit_purchase — artist bought credit packs (invests in the platform)
  const cred = byKey.get('credit_purchase');
  if (cred) {
    const rows = await sql`
      SELECT u.id AS artist_id, COUNT(*)::int AS n
      FROM credit_transactions ct
      JOIN users u ON LOWER(u.email) = LOWER(ct.user_email)
      WHERE ct.type = 'purchase' AND ct.amount > 0
        AND ct.created_at >= ${startsAt.toISOString()} AND ct.created_at < ${endsAt.toISOString()}
      GROUP BY u.id
    ` as any[];
    for (const r of rows) {
      const qty = Math.min(Number(r.n), cred.maxPerEpoch);
      if (qty > 0) events.push({ artistId: Number(r.artist_id), actionKey: 'credit_purchase', qty, btf: qty * cred.btfAmount, meta: { purchases: Number(r.n) } });
    }
  }

  // 4) follower_growth — one unit per 10 new followers in the window
  const fol = byKey.get('follower_growth');
  if (fol) {
    const rows = await sql`
      SELECT artist_id, COUNT(*)::int AS n
      FROM artist_follows
      WHERE created_at >= ${startsAt.toISOString()} AND created_at < ${endsAt.toISOString()}
      GROUP BY artist_id
    ` as any[];
    for (const r of rows) {
      const qty = Math.min(Math.floor(Number(r.n) / 10), fol.maxPerEpoch);
      if (qty > 0) events.push({ artistId: Number(r.artist_id), actionKey: 'follower_growth', qty, btf: qty * fol.btfAmount, meta: { newFollowers: Number(r.n) } });
    }
  }

  // Persist (epoch events were wiped by the caller)
  for (const e of events) {
    await sql`
      INSERT INTO artist_reward_events (epoch_id, artist_id, action_key, qty, btf_amount, meta)
      VALUES (${epochId}, ${e.artistId}, ${e.actionKey}, ${e.qty}, ${e.btf}, ${JSON.stringify(e.meta)})
    `;
  }
  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Epoch calculation
// ─────────────────────────────────────────────────────────────────────────────

export async function calculateEpoch(periodKey?: string): Promise<{
  epochId: number; periodKey: string; artistCount: number; totalBtf: number; prorateFactor: number;
}> {
  const sql = getSql();
  const cfg = await getRewardConfig();
  if (!cfg.active) throw new Error('Streaming rewards are disabled (config.active = false)');

  const period = periodKey
    ? { periodKey, startsAt: new Date(`${periodKey}T00:00:00.000Z`), endsAt: new Date(new Date(`${periodKey}T00:00:00.000Z`).getTime() + 7 * 86400 * 1000) }
    : lastCompleteWeek();
  if (Number.isNaN(period.startsAt.getTime())) throw new Error(`Invalid periodKey: ${periodKey}`);

  // Upsert epoch — refuse to recalculate approved/paid epochs.
  const existing = await sql`SELECT id, status FROM streaming_reward_epochs WHERE period_key = ${period.periodKey}` as any[];
  let epochId: number;
  if (existing.length) {
    if (existing[0].status !== 'calculated') {
      throw new Error(`Epoch ${period.periodKey} is ${existing[0].status} — cannot recalculate`);
    }
    epochId = Number(existing[0].id);
    await sql`DELETE FROM streaming_reward_entries WHERE epoch_id = ${epochId}`;
    await sql`DELETE FROM artist_reward_events WHERE epoch_id = ${epochId}`;
  } else {
    const ins = await sql`
      INSERT INTO streaming_reward_epochs (period_key, starts_at, ends_at, status)
      VALUES (${period.periodKey}, ${period.startsAt.toISOString()}, ${period.endsAt.toISOString()}, 'calculated')
      RETURNING id
    ` as any[];
    epochId = Number(ins[0].id);
  }

  const streams = await aggregateValidStreams(period.startsAt, period.endsAt, cfg);
  const actionEvents = await computeActionEvents(epochId, period.startsAt, period.endsAt);

  // Merge per-artist lines
  const lines = new Map<number, { validStreams: number; uniqueListeners: number; baseBtf: number; bonusBtf: number; actionBtf: number }>();
  for (const s of streams) {
    if (s.validStreams < cfg.minStreams) continue; // below qualification threshold
    lines.set(s.artistId, {
      validStreams: s.validStreams,
      uniqueListeners: s.uniqueListeners,
      baseBtf: s.validStreams * cfg.btfPerStream,
      bonusBtf: s.uniqueListeners * cfg.bonusPerListener,
      actionBtf: 0,
    });
  }
  for (const e of actionEvents) {
    const line = lines.get(e.artistId) || { validStreams: 0, uniqueListeners: 0, baseBtf: 0, bonusBtf: 0, actionBtf: 0 };
    line.actionBtf += e.btf;
    lines.set(e.artistId, line);
  }

  // Pool cap → pro-rata scaling
  let totalBtf = 0;
  for (const l of lines.values()) totalBtf += l.baseBtf + l.bonusBtf + l.actionBtf;
  const prorateFactor = totalBtf > cfg.poolBtfPerEpoch && totalBtf > 0 ? cfg.poolBtfPerEpoch / totalBtf : 1;

  let totalValidStreams = 0;
  let finalTotal = 0;
  for (const [artistId, l] of lines) {
    const base = round2(l.baseBtf * prorateFactor);
    const bonus = round2(l.bonusBtf * prorateFactor);
    const action = round2(l.actionBtf * prorateFactor);
    const total = round2(base + bonus + action);
    if (total <= 0) continue;
    totalValidStreams += l.validStreams;
    finalTotal += total;
    await sql`
      INSERT INTO streaming_reward_entries
        (epoch_id, artist_id, valid_streams, unique_listeners, base_btf, bonus_btf, action_btf, total_btf, status)
      VALUES
        (${epochId}, ${artistId}, ${round2(l.validStreams)}, ${l.uniqueListeners}, ${base}, ${bonus}, ${action}, ${total}, 'pending')
    `;
  }

  await sql`
    UPDATE streaming_reward_epochs
    SET total_valid_streams = ${round2(totalValidStreams)},
        total_btf = ${round2(finalTotal)},
        prorate_factor = ${prorateFactor},
        artist_count = ${lines.size},
        calculated_at = NOW()
    WHERE id = ${epochId}
  `;

  console.log(`[Streaming Rewards] Epoch ${period.periodKey} calculated: ${lines.size} artists, ${round2(finalTotal)} BTF (prorate ${prorateFactor.toFixed(4)})`);
  return { epochId, periodKey: period.periodKey, artistCount: lines.size, totalBtf: round2(finalTotal), prorateFactor };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval — entries become claimable
// ─────────────────────────────────────────────────────────────────────────────

export async function approveEpoch(epochId: number, approvedBy: string) {
  const sql = getSql();
  const rows = await sql`
    UPDATE streaming_reward_epochs
    SET status = 'approved', approved_at = NOW(), approved_by = ${approvedBy}
    WHERE id = ${epochId} AND status = 'calculated'
    RETURNING id, period_key, total_btf
  ` as any[];
  if (!rows.length) throw new Error('Epoch not found or not in calculated status');
  await sql`UPDATE streaming_reward_entries SET status = 'approved' WHERE epoch_id = ${epochId} AND status = 'pending'`;
  return rows[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain claim payout (treasury → artist wallet)
// ─────────────────────────────────────────────────────────────────────────────

function getTreasuryAccount() {
  const pk = process.env.PLATFORM_PRIVATE_KEY;
  if (!pk) throw new Error('PLATFORM_PRIVATE_KEY not configured');
  const formatted = pk.startsWith('0x') ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`);
  return privateKeyToAccount(formatted);
}

function rpcTransport() {
  return fallback(POLYGON_RPCS.map((url) => http(url, { timeout: 15000, retryCount: 2 })), { rank: true });
}

export async function getTreasuryBtfBalance(): Promise<number> {
  const client = createPublicClient({ chain: polygon, transport: rpcTransport() });
  const account = getTreasuryAccount();
  const balance = await client.readContract({
    address: BTF_TOKEN_ADDRESS,
    abi: BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  return Number(balance / BigInt(1e14)) / 10000; // ~4 decimals is plenty
}

const claimLocks = new Set<number>();

export async function claimRewards(artistId: number): Promise<{
  claimed: boolean; totalBtf: number; txHash?: string; simulated?: boolean; message: string;
}> {
  const sql = getSql();
  const cfg = await getRewardConfig();
  if (!cfg.active) return { claimed: false, totalBtf: 0, message: 'Rewards system is currently disabled' };
  if (claimLocks.has(artistId)) return { claimed: false, totalBtf: 0, message: 'A claim is already in progress' };

  claimLocks.add(artistId);
  try {
    const walletRows = await sql`SELECT reward_wallet_address FROM artist_wallet WHERE user_id = ${artistId}` as any[];
    const wallet = walletRows[0]?.reward_wallet_address as string | undefined;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return { claimed: false, totalBtf: 0, message: 'No valid reward wallet registered' };
    }

    const claimable = await sql`
      SELECT id, total_btf FROM streaming_reward_entries
      WHERE artist_id = ${artistId} AND status = 'approved'
    ` as any[];
    const totalBtf = round2(claimable.reduce((s, r) => s + Number(r.total_btf), 0));
    if (!claimable.length || totalBtf < cfg.minClaimBtf) {
      return { claimed: false, totalBtf, message: `Minimum claim is ${cfg.minClaimBtf} BTF (you have ${totalBtf})` };
    }

    if (cfg.dryRun) {
      return { claimed: false, totalBtf, simulated: true, message: `DRY RUN: would transfer ${totalBtf} BTF to ${wallet}` };
    }

    const ids = claimable.map((r) => Number(r.id));
    // Lock entries (guards double-claim across processes)
    const locked = await sql`
      UPDATE streaming_reward_entries SET status = 'claiming', wallet_address = ${wallet}
      WHERE id = ANY(${ids}) AND status = 'approved'
      RETURNING id
    ` as any[];
    if (locked.length !== ids.length) {
      await sql`UPDATE streaming_reward_entries SET status = 'approved' WHERE id = ANY(${ids}) AND status = 'claiming'`;
      return { claimed: false, totalBtf, message: 'Entries changed state — try again' };
    }

    try {
      const account = getTreasuryAccount();
      const walletClient = createWalletClient({ account, chain: polygon, transport: rpcTransport() });
      const publicClient = createPublicClient({ chain: polygon, transport: rpcTransport() });
      const amountWei = parseUnits(totalBtf.toFixed(4), 18);

      console.log(`[Streaming Rewards] Claiming ${totalBtf} BTF → ${wallet} (artist ${artistId})`);
      const txHash = await walletClient.writeContract({
        address: BTF_TOKEN_ADDRESS,
        abi: TRANSFER_ABI,
        functionName: 'transfer',
        args: [wallet as `0x${string}`, amountWei],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
      if (receipt.status !== 'success') throw new Error(`Transfer reverted: ${txHash}`);

      await sql`
        UPDATE streaming_reward_entries
        SET status = 'paid', tx_hash = ${txHash}, paid_at = NOW(), error = NULL
        WHERE id = ANY(${ids})
      `;
      // Mark fully-paid epochs
      await sql`
        UPDATE streaming_reward_epochs e SET status = 'paid'
        WHERE e.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM streaming_reward_entries en
            WHERE en.epoch_id = e.id AND en.status <> 'paid'
          )
      `;
      console.log(`[Streaming Rewards] ✅ Paid ${totalBtf} BTF to artist ${artistId}: ${txHash}`);
      return { claimed: true, totalBtf, txHash, message: `Transferred ${totalBtf} BTF` };
    } catch (err: any) {
      await sql`
        UPDATE streaming_reward_entries
        SET status = 'approved', error = ${String(err?.message || err).slice(0, 500)}
        WHERE id = ANY(${ids}) AND status = 'claiming'
      `;
      console.error('[Streaming Rewards] Claim transfer failed:', err?.message || err);
      return { claimed: false, totalBtf, message: 'On-chain transfer failed — rewards remain claimable. Try again later.' };
    }
  } finally {
    claimLocks.delete(artistId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Artist summary (for the profile widget)
// ─────────────────────────────────────────────────────────────────────────────

export async function getArtistRewardSummary(artistId: number) {
  const sql = getSql();
  const cfg = await getRewardConfig();

  const totals = await sql`
    SELECT
      COALESCE(SUM(total_btf) FILTER (WHERE status = 'approved'), 0)::numeric AS claimable,
      COALESCE(SUM(total_btf) FILTER (WHERE status IN ('pending','claiming')), 0)::numeric AS pending,
      COALESCE(SUM(total_btf) FILTER (WHERE status = 'paid'), 0)::numeric AS paid
    FROM streaming_reward_entries WHERE artist_id = ${artistId}
  ` as any[];

  const history = await sql`
    SELECT en.id, ep.period_key, en.valid_streams, en.unique_listeners,
           en.base_btf, en.bonus_btf, en.action_btf, en.total_btf,
           en.status, en.tx_hash, en.paid_at
    FROM streaming_reward_entries en
    JOIN streaming_reward_epochs ep ON ep.id = en.epoch_id
    WHERE en.artist_id = ${artistId}
    ORDER BY ep.starts_at DESC
    LIMIT 12
  ` as any[];

  // Live current-week stats (informational — not yet calculated)
  const cw = currentWeek();
  const live = await aggregateValidStreams(cw.startsAt, cw.endsAt, cfg);
  const mine = live.find((l) => l.artistId === artistId);

  const walletRows = await sql`SELECT reward_wallet_address FROM artist_wallet WHERE user_id = ${artistId}` as any[];

  return {
    config: {
      active: cfg.active,
      dryRun: cfg.dryRun,
      btfPerStream: cfg.btfPerStream,
      minStreams: cfg.minStreams,
      minClaimBtf: cfg.minClaimBtf,
      btfPriceUsd: BTF_PRICE_USD,
    },
    wallet: walletRows[0]?.reward_wallet_address || null,
    claimableBtf: Number(totals[0]?.claimable || 0),
    pendingBtf: Number(totals[0]?.pending || 0),
    paidBtf: Number(totals[0]?.paid || 0),
    currentWeek: {
      periodKey: cw.periodKey,
      validStreams: round2(mine?.validStreams || 0),
      uniqueListeners: mine?.uniqueListeners || 0,
      projectedBtf: round2((mine?.validStreams || 0) * cfg.btfPerStream + (mine?.uniqueListeners || 0) * cfg.bonusPerListener),
    },
    history: history.map((h) => ({
      id: Number(h.id),
      periodKey: h.period_key,
      validStreams: Number(h.valid_streams),
      uniqueListeners: Number(h.unique_listeners),
      baseBtf: Number(h.base_btf),
      bonusBtf: Number(h.bonus_btf),
      actionBtf: Number(h.action_btf),
      totalBtf: Number(h.total_btf),
      status: h.status,
      txHash: h.tx_hash,
      paidAt: h.paid_at,
    })),
  };
}

export async function setArtistRewardWallet(artistId: number, address: string) {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error('Invalid Polygon wallet address');
  const sql = getSql();
  await sql`
    INSERT INTO artist_wallet (user_id, reward_wallet_address)
    VALUES (${artistId}, ${address})
    ON CONFLICT (user_id) DO UPDATE SET reward_wallet_address = ${address}, updated_at = NOW()
  `;
  return { wallet: address };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler — auto-calculate the last complete week (payment stays manual)
// ─────────────────────────────────────────────────────────────────────────────

let schedulerStarted = false;

export function startStreamingRewardsScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  console.log('💰 [Streaming Rewards] scheduler started (hourly check)');
  const check = async () => {
    try {
      const cfg = await getRewardConfig();
      if (!cfg.active || !cfg.autoCalculate) return;
      const { periodKey } = lastCompleteWeek();
      const sql = getSql();
      const existing = await sql`SELECT id FROM streaming_reward_epochs WHERE period_key = ${periodKey}` as any[];
      if (existing.length) return;
      await calculateEpoch(periodKey);
    } catch (err: any) {
      console.warn('[Streaming Rewards] scheduler check failed:', err?.message || err);
    }
  };
  setInterval(() => { void check(); }, 3600_000);
  setTimeout(() => { void check(); }, 30_000);
}
