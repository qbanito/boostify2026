/**
 * Streaming Rewards API  (mounted at /api/streaming-rewards)
 * ─────────────────────────────────────────────────────────────────────────────
 * BTF token rewards for artists — streams + platform actions.
 *
 * ARTIST (auth):
 *   GET  /me            → reward summary (claimable/pending/paid, live week, history)
 *   POST /wallet        → register Polygon reward wallet {address}
 *   POST /claim         → claim approved BTF (on-chain transfer, dry-run aware)
 * PUBLIC:
 *   GET  /leaderboard   → top earning artists (paid + approved BTF)
 * ADMIN (auth + isAdmin):
 *   GET   /admin/overview          → config + treasury balance + epoch list
 *   PATCH /admin/config            → update economics / kill switch / dry-run
 *   GET   /admin/rules             → action reward rules
 *   PATCH /admin/rules/:key        → update a rule
 *   POST  /admin/epochs/calculate  → {periodKey?} calculate (default last complete week)
 *   POST  /admin/epochs/:id/approve→ entries become claimable
 *   GET   /admin/epochs/:id/entries→ entry lines for review
 */
import { Router, Request, Response } from 'express';
import { neon } from '@neondatabase/serverless';
import { authenticate } from '../middleware/auth';
import {
  getRewardConfig,
  getActionRules,
  calculateEpoch,
  approveEpoch,
  claimRewards,
  getArtistRewardSummary,
  setArtistRewardWallet,
  getTreasuryBtfBalance,
  BTF_PRICE_USD,
} from '../services/streaming-rewards';

const router = Router();
const getSql = () => neon(process.env.DATABASE_URL!);

function requireAdmin(req: Request, res: Response): boolean {
  if (!(req as any).user?.isAdmin) {
    res.status(403).json({ success: false, error: 'Admin only' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST
// ─────────────────────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.id);
    const summary = await getArtistRewardSummary(userId);
    res.json({ success: true, ...summary });
  } catch (err: any) {
    console.error('[Streaming Rewards] /me error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load rewards' });
  }
});

router.post('/wallet', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.id);
    const address = String(req.body?.address || '').trim();
    const result = await setArtistRewardWallet(userId, address);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/claim', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.id);
    const result = await claimRewards(userId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Streaming Rewards] /claim error:', err.message);
    res.status(500).json({ success: false, error: 'Claim failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — leaderboard
// ─────────────────────────────────────────────────────────────────────────────

router.get('/leaderboard', async (_req: Request, res: Response) => {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT en.artist_id,
             u.artist_name, u.first_name, u.last_name, u.username, u.slug,
             u.profile_image, u.profile_image_url,
             SUM(en.total_btf)::numeric AS total_btf,
             SUM(en.valid_streams)::numeric AS total_streams
      FROM streaming_reward_entries en
      JOIN users u ON u.id = en.artist_id
      WHERE en.status IN ('approved', 'claiming', 'paid')
      GROUP BY en.artist_id, u.artist_name, u.first_name, u.last_name, u.username, u.slug, u.profile_image, u.profile_image_url
      ORDER BY SUM(en.total_btf) DESC
      LIMIT 20
    ` as any[];
    res.json({
      success: true,
      btfPriceUsd: BTF_PRICE_USD,
      leaders: rows.map((r) => ({
        artistId: Number(r.artist_id),
        name: r.artist_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username || 'Boostify Artist',
        slug: r.slug,
        image: r.profile_image_url || r.profile_image,
        totalBtf: Number(r.total_btf),
        totalStreams: Number(r.total_streams),
      })),
    });
  } catch (err: any) {
    console.error('[Streaming Rewards] /leaderboard error:', err.message);
    res.json({ success: true, leaders: [], btfPriceUsd: BTF_PRICE_USD });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/overview', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const config = await getRewardConfig();
    const rules = await getActionRules();
    const epochs = await sql`
      SELECT id, period_key, starts_at, ends_at, status, total_valid_streams,
             total_btf, prorate_factor, artist_count, calculated_at, approved_at, approved_by
      FROM streaming_reward_epochs
      ORDER BY starts_at DESC
      LIMIT 24
    ` as any[];
    let treasuryBtf: number | null = null;
    try { treasuryBtf = await getTreasuryBtfBalance(); } catch { /* wallet not configured */ }
    res.json({
      success: true,
      config,
      rules,
      treasuryBtf,
      btfPriceUsd: BTF_PRICE_USD,
      epochs: epochs.map((e) => ({
        id: Number(e.id),
        periodKey: e.period_key,
        startsAt: e.starts_at,
        endsAt: e.ends_at,
        status: e.status,
        totalValidStreams: Number(e.total_valid_streams),
        totalBtf: Number(e.total_btf),
        prorateFactor: Number(e.prorate_factor),
        artistCount: Number(e.artist_count),
        calculatedAt: e.calculated_at,
        approvedAt: e.approved_at,
        approvedBy: e.approved_by,
      })),
    });
  } catch (err: any) {
    console.error('[Streaming Rewards] /admin/overview error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to load overview' });
  }
});

router.patch('/admin/config', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const b = req.body || {};
    const num = (v: any, min: number, max: number) => Math.min(Math.max(Number(v), min), max);
    // Apply each provided field individually (tagged templates — no dynamic SQL)
    if (b.active !== undefined) await sql`UPDATE streaming_reward_config SET active = ${!!b.active}, updated_at = NOW() WHERE id = 1`;
    if (b.dryRun !== undefined) await sql`UPDATE streaming_reward_config SET dry_run = ${!!b.dryRun}, updated_at = NOW() WHERE id = 1`;
    if (b.autoCalculate !== undefined) await sql`UPDATE streaming_reward_config SET auto_calculate = ${!!b.autoCalculate}, updated_at = NOW() WHERE id = 1`;
    if (b.btfPerStream !== undefined) await sql`UPDATE streaming_reward_config SET btf_per_stream = ${num(b.btfPerStream, 0, 1000)}, updated_at = NOW() WHERE id = 1`;
    if (b.bonusPerListener !== undefined) await sql`UPDATE streaming_reward_config SET bonus_per_listener = ${num(b.bonusPerListener, 0, 1000)}, updated_at = NOW() WHERE id = 1`;
    if (b.poolBtfPerEpoch !== undefined) await sql`UPDATE streaming_reward_config SET pool_btf_per_epoch = ${num(b.poolBtfPerEpoch, 0, 100000000)}, updated_at = NOW() WHERE id = 1`;
    if (b.minStreams !== undefined) await sql`UPDATE streaming_reward_config SET min_streams = ${Math.round(num(b.minStreams, 0, 100000))}, updated_at = NOW() WHERE id = 1`;
    if (b.minClaimBtf !== undefined) await sql`UPDATE streaming_reward_config SET min_claim_btf = ${num(b.minClaimBtf, 0, 1000000)}, updated_at = NOW() WHERE id = 1`;
    if (b.maxStreamsPerListenerDay !== undefined) await sql`UPDATE streaming_reward_config SET max_streams_per_listener_day = ${Math.round(num(b.maxStreamsPerListenerDay, 1, 1000))}, updated_at = NOW() WHERE id = 1`;
    if (b.anonWeight !== undefined) await sql`UPDATE streaming_reward_config SET anon_weight = ${num(b.anonWeight, 0, 1)}, updated_at = NOW() WHERE id = 1`;
    const config = await getRewardConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/rules', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json({ success: true, rules: await getActionRules() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/admin/rules/:key', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const key = String(req.params.key);
    const b = req.body || {};
    if (b.btfAmount !== undefined) await sql`UPDATE reward_action_rules SET btf_amount = ${Math.min(Math.max(Number(b.btfAmount), 0), 1000000)}, updated_at = NOW() WHERE action_key = ${key}`;
    if (b.maxPerEpoch !== undefined) await sql`UPDATE reward_action_rules SET max_per_epoch = ${Math.round(Math.min(Math.max(Number(b.maxPerEpoch), 0), 1000))}, updated_at = NOW() WHERE action_key = ${key}`;
    if (b.active !== undefined) await sql`UPDATE reward_action_rules SET active = ${!!b.active}, updated_at = NOW() WHERE action_key = ${key}`;
    res.json({ success: true, rules: await getActionRules() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/epochs/calculate', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const periodKey = req.body?.periodKey ? String(req.body.periodKey) : undefined;
    const result = await calculateEpoch(periodKey);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/admin/epochs/:id/approve', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const epochId = Number(req.params.id);
    const email = (req as any).user?.email || `user:${(req as any).user?.id}`;
    const result = await approveEpoch(epochId, email);
    res.json({ success: true, epoch: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/admin/epochs/:id/entries', authenticate, async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const sql = getSql();
  try {
    const epochId = Number(req.params.id);
    const rows = await sql`
      SELECT en.*, u.artist_name, u.first_name, u.last_name, u.username, u.slug
      FROM streaming_reward_entries en
      JOIN users u ON u.id = en.artist_id
      WHERE en.epoch_id = ${epochId}
      ORDER BY en.total_btf DESC
    ` as any[];
    const events = await sql`
      SELECT artist_id, action_key, qty, btf_amount, meta
      FROM artist_reward_events
      WHERE epoch_id = ${epochId}
    ` as any[];
    res.json({
      success: true,
      entries: rows.map((r) => ({
        id: Number(r.id),
        artistId: Number(r.artist_id),
        artistName: r.artist_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username,
        slug: r.slug,
        validStreams: Number(r.valid_streams),
        uniqueListeners: Number(r.unique_listeners),
        baseBtf: Number(r.base_btf),
        bonusBtf: Number(r.bonus_btf),
        actionBtf: Number(r.action_btf),
        totalBtf: Number(r.total_btf),
        status: r.status,
        walletAddress: r.wallet_address,
        txHash: r.tx_hash,
        paidAt: r.paid_at,
        error: r.error,
      })),
      events: events.map((e) => ({
        artistId: Number(e.artist_id),
        actionKey: e.action_key,
        qty: Number(e.qty),
        btfAmount: Number(e.btf_amount),
        meta: e.meta,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
