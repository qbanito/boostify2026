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
import { randomBytes } from 'node:crypto';
import { getAddress, verifyMessage } from 'viem';
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
  STREAMING_REWARD_TERMS_VERSION,
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

router.post('/terms/accept', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, error: 'Valid account required' });
    if (req.body?.accepted !== true || req.body?.termsVersion !== STREAMING_REWARD_TERMS_VERSION) {
      return res.status(400).json({ success: false, error: 'Explicit acceptance of the current BTF Rewards terms is required' });
    }
    const addressRows = await getSql()`SELECT reward_wallet_address, reward_wallet_verified_at FROM artist_wallet WHERE user_id = ${userId}` as any[];
    const ipAddress = String(req.ip || '').slice(0, 45);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 500);
    await getSql()`
      INSERT INTO streaming_reward_terms_acceptances (user_id, terms_version, wallet_address, ip_address, user_agent)
      VALUES (${userId}, ${STREAMING_REWARD_TERMS_VERSION}, ${addressRows[0]?.reward_wallet_verified_at ? addressRows[0]?.reward_wallet_address || null : null}, ${ipAddress}, ${userAgent})
      ON CONFLICT (user_id, terms_version) DO NOTHING
    `;
    res.json({ success: true, termsAccepted: true, termsVersion: STREAMING_REWARD_TERMS_VERSION });
  } catch (err: any) {
    console.error('[Streaming Rewards] terms acceptance failed:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not record acceptance' });
  }
});

router.post('/wallet/challenge', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.id);
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, error: 'Valid account required' });
    const recentChallenges = await getSql()`
      SELECT COUNT(*)::int AS count FROM streaming_reward_wallet_challenges
      WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '10 minutes'
    ` as any[];
    if (Number(recentChallenges[0]?.count || 0) >= 10) {
      return res.status(429).json({ success: false, error: 'Too many wallet verification attempts. Try again later.' });
    }
    const terms = await getSql()`
      SELECT id FROM streaming_reward_terms_acceptances
      WHERE user_id = ${userId} AND terms_version = ${STREAMING_REWARD_TERMS_VERSION} LIMIT 1
    ` as any[];
    if (!terms.length) return res.status(403).json({ success: false, error: 'Accept the BTF Rewards terms before linking a wallet' });

    let address: string;
    try { address = getAddress(String(req.body?.address || '').trim()).toLowerCase(); }
    catch { return res.status(400).json({ success: false, error: 'Connect a valid EVM wallet address' }); }
    const nonce = randomBytes(24).toString('hex');
    const message = [
      'Boostify BTF Rewards wallet verification',
      `Account: ${userId}`,
      `Wallet: ${address}`,
      `Nonce: ${nonce}`,
      'Purpose: link this wallet to receive BTF reward claims on Polygon.',
      'This signature does not authorize a token transfer or spend.',
    ].join('\n');
    const rows = await getSql()`
      INSERT INTO streaming_reward_wallet_challenges (user_id, wallet_address, message, expires_at)
      VALUES (${userId}, ${address}, ${message}, NOW() + INTERVAL '5 minutes')
      RETURNING id, message, expires_at
    ` as any[];
    await getSql()`
      DELETE FROM streaming_reward_wallet_challenges
      WHERE user_id = ${userId} AND consumed_at IS NULL AND expires_at < NOW()
    `;
    res.json({ success: true, challengeId: Number(rows[0].id), address, message: rows[0].message, expiresAt: rows[0].expires_at });
  } catch (err: any) {
    console.error('[Streaming Rewards] wallet challenge failed:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not create wallet verification challenge' });
  }
});

router.post('/wallet/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.id);
    const challengeId = Number(req.body?.challengeId);
    const signature = String(req.body?.signature || '');
    if (!Number.isInteger(userId) || userId <= 0) return res.status(401).json({ success: false, error: 'Valid account required' });
    if (!Number.isInteger(challengeId) || challengeId <= 0 || signature.length > 2048 || !/^0x[0-9a-fA-F]+$/.test(signature)) {
      return res.status(400).json({ success: false, error: 'A valid wallet challenge and signature are required' });
    }
    const challenges = await getSql()`
      SELECT id, wallet_address, message FROM streaming_reward_wallet_challenges
      WHERE id = ${challengeId} AND user_id = ${userId} AND consumed_at IS NULL AND expires_at > NOW()
      LIMIT 1
    ` as any[];
    if (!challenges.length) return res.status(400).json({ success: false, error: 'Wallet challenge expired or already used; request a new one' });
    const challenge = challenges[0];
    const valid = await verifyMessage({
      address: challenge.wallet_address as `0x${string}`,
      message: String(challenge.message),
      signature: signature as `0x${string}`,
    });
    if (!valid) return res.status(400).json({ success: false, error: 'Wallet signature could not be verified' });
    const consumed = await getSql()`
      UPDATE streaming_reward_wallet_challenges SET consumed_at = NOW()
      WHERE id = ${challengeId} AND user_id = ${userId} AND consumed_at IS NULL AND expires_at > NOW()
      RETURNING id
    ` as any[];
    if (!consumed.length) return res.status(409).json({ success: false, error: 'Wallet challenge has already been used' });
    const result = await setArtistRewardWallet(userId, String(challenge.wallet_address));
    await getSql()`
      UPDATE streaming_reward_terms_acceptances
      SET wallet_address = ${result.wallet}
      WHERE user_id = ${userId} AND terms_version = ${STREAMING_REWARD_TERMS_VERSION}
    `;
    res.json({ success: true, ...result, verified: true });
  } catch (err: any) {
    console.error('[Streaming Rewards] wallet verification failed:', err?.message || err);
    res.status(500).json({ success: false, error: 'Could not verify wallet ownership' });
  }
});

router.post('/wallet', authenticate, (_req: Request, res: Response) => {
  res.status(410).json({ success: false, error: 'Direct wallet entry is disabled. Verify wallet ownership with a signature.' });
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
    res.json({ success: true, leaders: [] });
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
