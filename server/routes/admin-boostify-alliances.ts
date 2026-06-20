/**
 * Admin API — Boostify Alliances Dashboard
 * Aggregates music_industry_contacts data (with masterJson, leadScore, status)
 * into the shapes consumed by the Boostify Alliances admin UI widgets.
 *
 * Mounted at /api/admin/boostify-alliances
 */

import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import axios from 'axios';
import { db, pool } from '../db';
import { requireAdmin } from '../middleware/require-admin';

const router = Router();
router.use(requireAdmin);

// ─── Helpers ────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function deltaPct(current: number, previous: number): string {
  if (!previous) return current > 0 ? '+100%' : '0%';
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(0)}%`;
}

function initialsOf(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() || '').join('') || '??';
}

function gradientFor(seed: string): [string, string] {
  const palettes: Array<[string, string]> = [
    ['#2a1f1a', '#5a3620'],
    ['#3a1f2a', '#7a3e5a'],
    ['#1f2530', '#3a4860'],
    ['#2a1f3a', '#5a3e78'],
    ['#1f302a', '#3a6a4a'],
    ['#1f2a30', '#3a4a6a'],
    ['#30251f', '#6a4a30'],
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function scoreOf(row: any): number {
  const mj = row.master_json || {};
  const scoring: any = mj.scoring || {};
  const fromCompleteness =
    row.data_completeness != null ? Number(row.data_completeness) * 100 : null;
  const raw = scoring.leadScore ?? scoring.boostifyFitScore ?? fromCompleteness ?? 50;
  const n = Number(raw);
  return Math.round(Number.isFinite(n) ? n : 50);
}

// ─── Status → pipeline stage mapping ────────────────────────────────

type PipelineStageId = 'discovered' | 'qualified' | 'meeting' | 'proposal' | 'won' | 'lost';

function stageForStatus(status: string | null): PipelineStageId {
  switch (status) {
    case 'new':
    case 'queued':
      return 'discovered';
    case 'contacted':
    case 'opened':
    case 'clicked':
      return 'qualified';
    case 'responded':
      return 'meeting';
    case 'deal_in_progress':
      return 'proposal';
    case 'not_interested':
    case 'unsubscribed':
    case 'bounced':
      return 'lost';
    default:
      return 'discovered';
  }
}

const STAGE_DEFS: Array<{ id: PipelineStageId; label: string; accent: string; statuses: string[] }> = [
  { id: 'discovered', label: 'DISCOVERED', accent: '#4a90ff', statuses: ['new', 'queued'] },
  { id: 'qualified', label: 'QUALIFIED', accent: '#6a8eff', statuses: ['contacted', 'opened', 'clicked'] },
  { id: 'meeting', label: 'MEETING', accent: '#b26dff', statuses: ['responded'] },
  { id: 'proposal', label: 'PROPOSAL', accent: '#ff8a1f', statuses: ['deal_in_progress'] },
  { id: 'won', label: 'WON', accent: '#22c55e', statuses: ['won'] },
];

// ─── GET /overview → KPI strip ──────────────────────────────────────

router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const totals = await pool.query(`
      SELECT
        count(*)::int AS total_targets,
        count(*) FILTER (WHERE status IN ('opened','clicked','responded'))::int AS warm_leads,
        count(*) FILTER (WHERE status = 'deal_in_progress')::int AS active_deals,
        count(*) FILTER (WHERE status = 'responded')::int AS meetings,
        count(*) FILTER (WHERE created_at >= $1)::int AS total_recent,
        count(*) FILTER (WHERE created_at >= $2 AND created_at < $1)::int AS total_prev,
        count(*) FILTER (WHERE status IN ('opened','clicked','responded') AND last_contacted_at >= $1)::int AS warm_recent,
        count(*) FILTER (WHERE status IN ('opened','clicked','responded') AND last_contacted_at >= $2 AND last_contacted_at < $1)::int AS warm_prev
      FROM music_industry_contacts
    `, [thirtyDaysAgo.toISOString(), sixtyDaysAgo.toISOString()]);

    const r = totals.rows[0] || {};

    // Build 12-point sparks from daily created_at counts over the last 30 days.
    const sparkQ = await pool.query(`
      SELECT
        date_trunc('day', created_at) AS d,
        count(*)::int AS c
      FROM music_industry_contacts
      WHERE created_at >= $1
      GROUP BY 1
      ORDER BY 1 ASC
    `, [thirtyDaysAgo.toISOString()]);
    const daily: number[] = sparkQ.rows.map((x: any) => x.c);
    const spark = daily.length
      ? daily.slice(-12)
      : [3, 5, 4, 6, 8, 7, 9, 11, 10, 13, 12, 15];

    res.json({
      ok: true,
      kpis: [
        {
          id: 'total-targets',
          label: 'TOTAL TARGETS',
          value: formatCompact(r.total_targets || 0),
          delta: `${deltaPct(r.total_recent || 0, r.total_prev || 0)} vs last 30 days`,
          deltaPositive: (r.total_recent || 0) >= (r.total_prev || 0),
          spark,
        },
        {
          id: 'warm-leads',
          label: 'WARM LEADS',
          value: formatCompact(r.warm_leads || 0),
          delta: `${deltaPct(r.warm_recent || 0, r.warm_prev || 0)} vs last 30 days`,
          deltaPositive: (r.warm_recent || 0) >= (r.warm_prev || 0),
          spark,
        },
        {
          id: 'active-deals',
          label: 'ACTIVE DEALS',
          value: formatCompact(r.active_deals || 0),
          delta: `${deltaPct(r.active_deals || 0, Math.max(1, Math.floor((r.active_deals || 0) * 0.9)))} vs last 30 days`,
          deltaPositive: true,
          spark,
        },
        {
          id: 'meetings',
          label: 'MEETINGS SCHEDULED',
          value: formatCompact(r.meetings || 0),
          delta: `${deltaPct(r.meetings || 0, Math.max(1, Math.floor((r.meetings || 0) * 0.9)))} vs last 30 days`,
          deltaPositive: true,
          spark,
        },
      ],
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /overview]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /artist-radar → top-scored artists with search ─────────────

router.get('/artist-radar', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const params: any[] = [];
    let where = 'WHERE 1=1';
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (LOWER(full_name) LIKE $${params.length} OR LOWER(company_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`;
    }

    params.push(limit);
    const rows = (await pool.query(
      `SELECT id, full_name, company_name, city, state, country, industry,
              keywords, status, data_completeness, master_json, profile_image_url, boostify_image_url
         FROM music_industry_contacts
         ${where}
         ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, data_completeness * 100, 0) DESC,
                  created_at DESC
         LIMIT $${params.length}`,
      params,
    )).rows;

    const artists = rows.map((row: any) => {
      const mj = row.master_json || {};
      const name = row.full_name || mj.identity?.name || 'Unknown';
      const score = scoreOf(row);
      const location = [row.city, row.state, row.country].filter(Boolean).join(', ')
        || mj.identity?.location
        || 'Unknown';
      const label = row.company_name || mj.career?.label || '—';
      const genresRaw = mj.music?.genres || (row.keywords ? String(row.keywords).split(',').slice(0, 3) : []);
      const genres = (Array.isArray(genresRaw) ? genresRaw : []).map((g: string) => g.trim()).filter(Boolean);
      return {
        id: row.id,
        name,
        verified: score >= 80,
        location,
        label,
        genres: genres.length ? genres : ['Music'],
        leadScore: score,
        avatarInitials: initialsOf(name),
        avatarGradient: gradientFor(name),
        imageUrl: row.boostify_image_url || row.profile_image_url || null,
      };
    });

    res.json({ ok: true, artists });
  } catch (err: any) {
    console.error('[BoostifyAlliances /artist-radar]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /decision-circle → team around an artist ───────────────────

router.get('/decision-circle', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.query.contactId);
    let row: any = null;
    if (Number.isFinite(contactId)) {
      row = (await pool.query(
        `SELECT id, full_name, master_json FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
        [contactId],
      )).rows[0];
    }
    if (!row) {
      // Fallback: top-scored
      row = (await pool.query(
        `SELECT id, full_name, master_json FROM music_industry_contacts
           ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0) DESC
           LIMIT 1`,
      )).rows[0];
    }
    if (!row) return res.json({ ok: true, center: null, nodes: [] });

    const mj = row.master_json || {};
    const team = mj.team || {};

    const roleMap: Array<{ id: string; label: string; role: string; fallback: string; angle: number }> = [
      { id: 'manager', label: 'MANAGER', role: 'Manager', fallback: team.manager?.company || 'Unknown', angle: 90 },
      { id: 'label', label: 'LABEL', role: 'Label', fallback: team.label?.name || mj.career?.label || 'Independent', angle: 160 },
      { id: 'pr', label: 'PR', role: 'PR', fallback: team.pr?.company || 'In-house', angle: 20 },
      { id: 'booking', label: 'BOOKING', role: 'Booking', fallback: team.booking?.company || 'Unsigned', angle: 215 },
      { id: 'publisher', label: 'PUBLISHER', role: 'Publisher', fallback: team.publisher?.company || 'Self-published', angle: 325 },
    ];

    const nodes = roleMap.map((r) => {
      const t = (team as any)[r.id] || {};
      return {
        id: r.id,
        label: r.label,
        role: r.role,
        person: t.company || t.name || r.fallback,
        sub: t.contact || t.email || '—',
        angle: r.angle,
      };
    });

    res.json({
      ok: true,
      center: {
        id: row.id,
        name: row.full_name || mj.identity?.name || 'Artist',
        initials: initialsOf(row.full_name || ''),
        gradient: gradientFor(row.full_name || ''),
      },
      nodes,
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /decision-circle]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /fit-score → radial score + breakdown ──────────────────────

router.get('/fit-score', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.query.contactId);
    let row: any = null;
    if (Number.isFinite(contactId)) {
      row = (await pool.query(
        `SELECT id, full_name, master_json, data_completeness FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
        [contactId],
      )).rows[0];
    }
    if (!row) {
      row = (await pool.query(
        `SELECT id, full_name, master_json, data_completeness FROM music_industry_contacts
           ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0) DESC
           LIMIT 1`,
      )).rows[0];
    }
    if (!row) {
      return res.json({
        ok: true,
        score: 0,
        verdict: 'NO DATA',
        breakdown: [],
      });
    }

    const mj = row.master_json || {};
    const scoring = mj.scoring || {};
    const score = Math.round(
      Number(scoring.boostifyFitScore ?? scoring.leadScore ?? (row.data_completeness || 0) * 100),
    );

    const clamp = (v: any) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));

    const breakdown = [
      { label: 'Audience Alignment', value: clamp(scoring.audienceAlignment ?? score * 0.98), icon: '👥' },
      { label: 'Brand Synergy', value: clamp(scoring.brandSynergy ?? score * 0.95), icon: '✨' },
      { label: 'Market Momentum', value: clamp(scoring.marketMomentum ?? score * 0.92), icon: '📈' },
      { label: 'Cultural Impact', value: clamp(scoring.culturalImpact ?? score * 1.02), icon: '🌍' },
      { label: 'Partnership Potential', value: clamp(scoring.partnershipPotential ?? score * 0.96), icon: '🤝' },
    ];

    const verdict =
      score >= 90 ? 'EXCELLENT FIT' :
      score >= 75 ? 'STRONG FIT' :
      score >= 60 ? 'GOOD FIT' :
      score >= 40 ? 'MODERATE FIT' :
      'EARLY SIGNAL';

    res.json({
      ok: true,
      contactId: row.id,
      artistName: row.full_name || mj.identity?.name || 'Artist',
      score,
      verdict,
      breakdown,
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /fit-score]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /outreach-sequence → 4-step status ─────────────────────────

router.get('/outreach-sequence', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.query.contactId);
    let row: any = null;
    if (Number.isFinite(contactId)) {
      row = (await pool.query(
        `SELECT id, full_name, status, emails_sent, opens_count, clicks_count, last_contacted_at, master_json
           FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
        [contactId],
      )).rows[0];
    }
    if (!row) {
      row = (await pool.query(
        `SELECT id, full_name, status, emails_sent, opens_count, clicks_count, last_contacted_at, master_json
           FROM music_industry_contacts
           ORDER BY COALESCE(last_contacted_at, created_at) DESC
           LIMIT 1`,
      )).rows[0];
    }
    if (!row) return res.json({ ok: true, steps: [] });

    const status = row.status || 'new';
    const emailsSent = Number(row.emails_sent || 0);
    const opens = Number(row.opens_count || 0);
    const clicks = Number(row.clicks_count || 0);
    const hasMeeting = status === 'responded' || status === 'deal_in_progress';
    const inFollowup = opens > 0 || clicks > 0 || status === 'opened' || status === 'clicked';

    type Status = 'completed' | 'in-progress' | 'pending';
    const steps = [
      {
        icon: 'Mail',
        title: 'Email',
        subtitle: 'Intro & Value',
        status: (emailsSent > 0 ? 'completed' : 'pending') as Status,
        statusLabel: emailsSent > 0 ? 'Completed' : 'Pending',
      },
      {
        icon: 'Send',
        title: 'DM',
        subtitle: 'Personal Touch',
        status: (emailsSent > 1 || clicks > 0 ? 'completed' : emailsSent === 1 ? 'in-progress' : 'pending') as Status,
        statusLabel: emailsSent > 1 || clicks > 0 ? 'Completed' : emailsSent === 1 ? 'In Progress' : 'Pending',
      },
      {
        icon: 'Clock',
        title: 'Follow-up',
        subtitle: 'Check-in',
        status: (hasMeeting ? 'completed' : inFollowup ? 'in-progress' : 'pending') as Status,
        statusLabel: hasMeeting ? 'Completed' : inFollowup ? 'In Progress' : 'Pending',
        badge: inFollowup && !hasMeeting ? String(Math.max(1, clicks)) : undefined,
      },
      {
        icon: 'Calendar',
        title: 'Meeting',
        subtitle: 'Book a Call',
        status: (hasMeeting ? 'in-progress' : 'pending') as Status,
        statusLabel: hasMeeting ? 'Scheduled' : 'Pending',
      },
    ];

    res.json({ ok: true, contactId: row.id, artistName: row.full_name, steps });
  } catch (err: any) {
    console.error('[BoostifyAlliances /outreach-sequence]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /pipeline → stages with artist cards ───────────────────────

router.get('/pipeline', async (_req: Request, res: Response) => {
  try {
    const counts = (await pool.query(`
      SELECT status, count(*)::int AS c
      FROM music_industry_contacts
      GROUP BY status
    `)).rows;

    const statusCount = new Map<string, number>();
    for (const r of counts as any[]) statusCount.set(r.status || 'new', r.c);

    const rows = (await pool.query(`
      SELECT id, full_name, status, master_json, data_completeness, profile_image_url, boostify_image_url
      FROM music_industry_contacts
      ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, data_completeness * 100, 0) DESC,
               created_at DESC
      LIMIT 100
    `)).rows;

    const byStage: Record<PipelineStageId, any[]> = {
      discovered: [], qualified: [], meeting: [], proposal: [], won: [], lost: [],
    };
    for (const r of rows as any[]) {
      const stage = stageForStatus(r.status);
      byStage[stage].push({
        id: r.id,
        name: r.full_name || 'Unknown',
        score: scoreOf(r),
        initials: initialsOf(r.full_name || ''),
        gradient: gradientFor(r.full_name || ''),
        imageUrl: r.boostify_image_url || r.profile_image_url || null,
      });
    }

    const stages = STAGE_DEFS.map((def) => {
      let total = 0;
      for (const s of def.statuses) total += statusCount.get(s) || 0;
      return {
        id: def.id,
        label: def.label,
        accent: def.accent,
        count: total,
        cards: byStage[def.id].slice(0, 3),
      };
    });

    res.json({ ok: true, stages });
  } catch (err: any) {
    console.error('[BoostifyAlliances /pipeline]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── POST /pipeline/:contactId/move → advance/revert stage ──────────

router.post('/pipeline/:contactId/move', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.params.contactId);
    const stage = String(req.body?.stage || '') as PipelineStageId;
    if (!Number.isFinite(contactId)) return res.status(400).json({ ok: false, error: 'invalid contactId' });
    const def = STAGE_DEFS.find(s => s.id === stage);
    if (!def) return res.status(400).json({ ok: false, error: 'invalid stage' });
    const newStatus = def.statuses[0];
    await pool.query(
      `UPDATE music_industry_contacts SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, contactId],
    );
    res.json({ ok: true, contactId, stage, status: newStatus });
  } catch (err: any) {
    console.error('[BoostifyAlliances /pipeline/move]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /master-json → compact display JSON for the widget ─────────

router.get('/master-json', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.query.contactId);
    let row: any = null;
    if (Number.isFinite(contactId)) {
      row = (await pool.query(
        `SELECT id, full_name, city, state, country, company_name, master_json, profile_image_url, boostify_image_url
           FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
        [contactId],
      )).rows[0];
    }
    if (!row) {
      row = (await pool.query(
        `SELECT id, full_name, city, state, country, company_name, master_json, profile_image_url, boostify_image_url
           FROM music_industry_contacts
           ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0) DESC
           LIMIT 1`,
      )).rows[0];
    }
    if (!row) return res.json({ ok: true, compact: null, full: null, profile: null });

    const mj = row.master_json || {};
    const scoring = mj.scoring || {};
    const name = row.full_name || mj.identity?.name || 'Artist';
    const location = [row.city, row.state, row.country].filter(Boolean).join(', ') || '—';

    const compact = {
      artist_name: name,
      stage_name: mj.identity?.stageName || name,
      location,
      label: row.company_name || mj.career?.label || '—',
      management: mj.team?.manager?.company || '—',
      genres: mj.music?.genres || [],
      lead_score: Math.round(Number(scoring.leadScore || 0)),
      boostify_fit_score: Math.round(Number(scoring.boostifyFitScore || scoring.leadScore || 0)),
      audience_alignment: Number((scoring.audienceAlignment ?? 0) / 100) || null,
      brand_synergy: Number((scoring.brandSynergy ?? 0) / 100) || null,
      market_momentum: Number((scoring.marketMomentum ?? 0) / 100) || null,
      cultural_impact: Number((scoring.culturalImpact ?? 0) / 100) || null,
      partnership_potential: Number((scoring.partnershipPotential ?? 0) / 100) || null,
      social_followers_total: mj.audience?.totalFollowers
        ? formatCompact(Number(mj.audience.totalFollowers))
        : '—',
      monthly_listeners: mj.audience?.monthlyListeners
        ? formatCompact(Number(mj.audience.monthlyListeners))
        : '—',
      notable_achievements: mj.career?.achievements || [],
    };

    res.json({
      ok: true,
      contactId: row.id,
      compact,
      full: mj,
      profile: {
        name,
        verified: compact.lead_score >= 80,
        location,
        label: compact.label,
        initials: initialsOf(name),
        gradient: gradientFor(name),
        imageUrl: row.boostify_image_url || row.profile_image_url || null,
      },
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /master-json]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /offers → partnership opportunities ranked by potential ────

router.get('/offers', async (_req: Request, res: Response) => {
  try {
    const rows = (await pool.query(`
      SELECT id, full_name, company_name, city, country, status, master_json,
             profile_image_url, boostify_image_url, data_completeness
        FROM music_industry_contacts
        WHERE master_json IS NOT NULL
          AND COALESCE((master_json->'scoring'->>'partnershipPotential')::numeric,
                       (master_json->'scoring'->>'leadScore')::numeric, 0) > 0
        ORDER BY COALESCE((master_json->'scoring'->>'partnershipPotential')::numeric,
                          (master_json->'scoring'->>'leadScore')::numeric, 0) DESC
        LIMIT 30
    `)).rows;

    const offers = rows.map((row: any) => {
      const mj = row.master_json || {};
      const scoring = mj.scoring || {};
      const name = row.full_name || mj.identity?.artistName || 'Artist';
      const opps: any[] = Array.isArray(mj.opportunities) ? mj.opportunities : [];
      const topOpp = opps[0] || null;
      const potential = Math.round(
        Number(scoring.partnershipPotential ?? scoring.leadScore ?? 0),
      );
      return {
        id: row.id,
        name,
        initials: initialsOf(name),
        gradient: gradientFor(name),
        imageUrl: row.boostify_image_url || row.profile_image_url || null,
        location: [row.city, row.country].filter(Boolean).join(', ') || '—',
        label: row.company_name || mj.career?.label || '—',
        potential,
        status: row.status || 'new',
        offerType: topOpp?.type || topOpp?.category || 'Partnership',
        offerTitle: topOpp?.title || topOpp?.summary || 'Alliance opportunity',
        offerValue: topOpp?.estimatedValue || topOpp?.value || null,
      };
    });

    res.json({ ok: true, offers });
  } catch (err: any) {
    console.error('[BoostifyAlliances /offers]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /assets → visual assets library ────────────────────────────

router.get('/assets', async (_req: Request, res: Response) => {
  try {
    const rows = (await pool.query(`
      SELECT id, full_name, profile_image_url, boostify_image_url, master_json
        FROM music_industry_contacts
        WHERE (profile_image_url IS NOT NULL AND profile_image_url <> '')
           OR (boostify_image_url IS NOT NULL AND boostify_image_url <> '')
           OR master_json->'visual' IS NOT NULL
        ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0) DESC,
                 created_at DESC
        LIMIT 60
    `)).rows;

    const counts = (await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE profile_image_url IS NOT NULL AND profile_image_url <> '')::int AS with_profile,
        COUNT(*) FILTER (WHERE boostify_image_url IS NOT NULL AND boostify_image_url <> '')::int AS with_boostify,
        COUNT(*) FILTER (WHERE master_json->'visual'->'referenceImages' IS NOT NULL)::int AS with_references
      FROM music_industry_contacts
    `)).rows[0];

    const assets = rows.map((row: any) => {
      const mj = row.master_json || {};
      const visual = mj.visual || {};
      const name = row.full_name || mj.identity?.artistName || 'Artist';
      return {
        id: row.id,
        name,
        initials: initialsOf(name),
        gradient: gradientFor(name),
        profileImageUrl: row.profile_image_url || null,
        boostifyImageUrl: row.boostify_image_url || null,
        heroImageUrl: visual.boostifyStyled?.hero || null,
        moodKeywords: Array.isArray(visual.moodKeywords) ? visual.moodKeywords.slice(0, 4) : [],
        referenceCount: Array.isArray(visual.referenceImages) ? visual.referenceImages.length : 0,
      };
    });

    res.json({
      ok: true,
      counts: {
        total: counts?.total || 0,
        withProfile: counts?.with_profile || 0,
        withBoostify: counts?.with_boostify || 0,
        withReferences: counts?.with_references || 0,
      },
      assets,
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /assets]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── GET /analytics → aggregate metrics across all contacts ─────────

router.get('/analytics', async (_req: Request, res: Response) => {
  try {
    const summary = (await pool.query(`
      SELECT
        COUNT(*)::int AS total_contacts,
        COALESCE(SUM(emails_sent), 0)::int AS total_emails_sent,
        COALESCE(SUM(opens_count), 0)::int AS total_opens,
        COALESCE(SUM(clicks_count), 0)::int AS total_clicks,
        COUNT(*) FILTER (WHERE status = 'responded')::int AS responded,
        COUNT(*) FILTER (WHERE status = 'deal_in_progress')::int AS in_deal,
        COUNT(*) FILTER (WHERE status = 'won')::int AS won,
        COUNT(*) FILTER (WHERE status IN ('not_interested','unsubscribed','bounced'))::int AS lost,
        AVG(COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0))::numeric(6,2) AS avg_lead_score
      FROM music_industry_contacts
    `)).rows[0];

    const byStatus = (await pool.query(`
      SELECT status, COUNT(*)::int AS c
      FROM music_industry_contacts
      GROUP BY status
      ORDER BY c DESC
      LIMIT 10
    `)).rows;

    const daily = (await pool.query(`
      SELECT DATE(created_at) AS day, COUNT(*)::int AS c
      FROM music_industry_contacts
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `)).rows;

    const topGenres = (await pool.query(`
      SELECT jsonb_array_elements_text(master_json->'music'->'genres') AS genre, COUNT(*)::int AS c
      FROM music_industry_contacts
      WHERE master_json->'music'->'genres' IS NOT NULL
      GROUP BY genre
      ORDER BY c DESC
      LIMIT 8
    `)).rows.filter((r: any) => r.genre);

    const totalEmails = Number(summary?.total_emails_sent || 0);
    const totalOpens = Number(summary?.total_opens || 0);
    const totalClicks = Number(summary?.total_clicks || 0);

    res.json({
      ok: true,
      summary: {
        totalContacts: Number(summary?.total_contacts || 0),
        totalEmailsSent: totalEmails,
        totalOpens,
        totalClicks,
        openRate: totalEmails > 0 ? Math.round((totalOpens / totalEmails) * 1000) / 10 : 0,
        clickRate: totalEmails > 0 ? Math.round((totalClicks / totalEmails) * 1000) / 10 : 0,
        responded: Number(summary?.responded || 0),
        inDeal: Number(summary?.in_deal || 0),
        won: Number(summary?.won || 0),
        lost: Number(summary?.lost || 0),
        avgLeadScore: Math.round(Number(summary?.avg_lead_score || 0)),
      },
      byStatus: byStatus.map((r: any) => ({ status: r.status || 'unknown', count: r.c })),
      daily: daily.map((r: any) => ({ day: r.day, count: r.c })),
      topGenres: topGenres.map((r: any) => ({ genre: r.genre, count: r.c })),
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /analytics]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Image enrichment (Spotify) ─────────────────────────────────────

let _spotifyTokenCache: { token: string; expiresAt: number } | null = null;

async function getSpotifyAppToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (_spotifyTokenCache && Date.now() < _spotifyTokenCache.expiresAt - 30_000) {
    return _spotifyTokenCache.token;
  }
  try {
    const resp = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        timeout: 8000,
      },
    );
    const token = resp.data?.access_token;
    const expiresIn = Number(resp.data?.expires_in || 3600) * 1000;
    if (!token) return null;
    _spotifyTokenCache = { token, expiresAt: Date.now() + expiresIn };
    return token;
  } catch (err: any) {
    console.error('[BoostifyAlliances getSpotifyAppToken]', err?.message || err);
    return null;
  }
}

async function searchSpotifyArtistImage(name: string, token: string): Promise<{ url: string | null; spotifyId: string | null }> {
  try {
    const resp = await axios.get('https://api.spotify.com/v1/search', {
      params: { q: name, type: 'artist', limit: 1 },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    const item = resp.data?.artists?.items?.[0];
    if (!item) return { url: null, spotifyId: null };
    const url = item.images?.[0]?.url || item.images?.[1]?.url || null;
    return { url, spotifyId: item.id || null };
  } catch (err: any) {
    console.error('[BoostifyAlliances searchSpotifyArtistImage]', name, err?.message || err);
    return { url: null, spotifyId: null };
  }
}

// ─── Free fallback image providers (no API key required) ───────────

type ProviderHit = { provider: string; url: string; externalId?: string | null; extra?: Record<string, any> };

async function searchDeezerArtistImage(name: string): Promise<ProviderHit | null> {
  try {
    const resp = await axios.get('https://api.deezer.com/search/artist', {
      params: { q: name, limit: 1 },
      timeout: 8000,
    });
    const item = resp.data?.data?.[0];
    if (!item) return null;
    const url: string | null =
      item.picture_xl || item.picture_big || item.picture_medium || item.picture || null;
    // Deezer sometimes returns a generic silhouette placeholder — skip those
    if (!url || /\/artist\/unknown\//i.test(url)) return null;
    return {
      provider: 'deezer',
      url,
      externalId: item.id ? String(item.id) : null,
      extra: { nbFan: item.nb_fan, nbAlbum: item.nb_album, link: item.link },
    };
  } catch (err: any) {
    console.error('[BoostifyAlliances searchDeezerArtistImage]', name, err?.message || err);
    return null;
  }
}

async function searchItunesArtistImage(name: string): Promise<ProviderHit | null> {
  try {
    const resp = await axios.get('https://itunes.apple.com/search', {
      params: { term: name, entity: 'musicArtist', limit: 1 },
      timeout: 8000,
    });
    const artistId = resp.data?.results?.[0]?.artistId;
    if (!artistId) return null;
    // iTunes Search lacks artist images; pull latest album artwork as proxy
    const albums = await axios.get('https://itunes.apple.com/lookup', {
      params: { id: artistId, entity: 'album', limit: 1 },
      timeout: 8000,
    });
    const album = (albums.data?.results || []).find((r: any) => r.wrapperType === 'collection');
    const raw: string | null = album?.artworkUrl100 || null;
    if (!raw) return null;
    // Upgrade iTunes artwork to 1200x1200 when possible
    const url = raw.replace(/\/\d+x\d+bb\./, '/1200x1200bb.');
    return {
      provider: 'itunes',
      url,
      externalId: String(artistId),
      extra: { artistName: album?.artistName, albumName: album?.collectionName },
    };
  } catch (err: any) {
    console.error('[BoostifyAlliances searchItunesArtistImage]', name, err?.message || err);
    return null;
  }
}

async function searchMusicBrainzArtistImage(name: string): Promise<ProviderHit | null> {
  try {
    const search = await axios.get('https://musicbrainz.org/ws/2/artist/', {
      params: { query: `artist:"${name}"`, fmt: 'json', limit: 1 },
      headers: { 'User-Agent': 'Boostify/1.0 (alliances@boostify.app)' },
      timeout: 8000,
    });
    const mbid = search.data?.artists?.[0]?.id;
    if (!mbid) return null;
    // Try Cover Art Archive front release-group cover as proxy
    try {
      const rg = await axios.get(`https://musicbrainz.org/ws/2/release-group`, {
        params: { artist: mbid, type: 'album', fmt: 'json', limit: 1 },
        headers: { 'User-Agent': 'Boostify/1.0 (alliances@boostify.app)' },
        timeout: 8000,
      });
      const rgId = rg.data?.['release-groups']?.[0]?.id;
      if (rgId) {
        const url = `https://coverartarchive.org/release-group/${rgId}/front-500`;
        // Probe to ensure it exists (HEAD fast)
        await axios.head(url, { timeout: 6000 });
        return { provider: 'coverart', url, externalId: mbid, extra: { releaseGroupId: rgId } };
      }
    } catch {
      // no cover, fall through
    }
    return { provider: 'musicbrainz', url: '', externalId: mbid };
  } catch (err: any) {
    console.error('[BoostifyAlliances searchMusicBrainzArtistImage]', name, err?.message || err);
    return null;
  }
}

async function searchLastFmArtistImage(name: string): Promise<ProviderHit | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await axios.get('https://ws.audioscrobbler.com/2.0/', {
      params: { method: 'artist.getinfo', artist: name, api_key: apiKey, format: 'json' },
      timeout: 8000,
    });
    const images: Array<{ '#text': string; size: string }> = resp.data?.artist?.image || [];
    const mega = images.find((i) => i.size === 'mega')?.['#text'];
    const xl = images.find((i) => i.size === 'extralarge')?.['#text'];
    const url = mega || xl || null;
    if (!url || /2a96cbd8b46e442fc41c2b86b821562f/i.test(url)) return null; // Last.fm default star
    return { provider: 'lastfm', url, externalId: resp.data?.artist?.mbid || null };
  } catch (err: any) {
    console.error('[BoostifyAlliances searchLastFmArtistImage]', name, err?.message || err);
    return null;
  }
}

/**
 * Try providers in priority order. Returns the first successful hit plus
 * every source found, for storage in master_json.visual.sources[].
 */
async function resolveArtistImage(name: string, spotifyToken: string | null): Promise<{
  winner: ProviderHit | null;
  spotifyId: string | null;
  sources: ProviderHit[];
}> {
  const sources: ProviderHit[] = [];
  let winner: ProviderHit | null = null;
  let spotifyId: string | null = null;

  if (spotifyToken) {
    const s = await searchSpotifyArtistImage(name, spotifyToken);
    spotifyId = s.spotifyId;
    if (s.url) {
      const hit: ProviderHit = { provider: 'spotify', url: s.url, externalId: s.spotifyId };
      sources.push(hit);
      winner = hit;
    }
  }

  if (!winner) {
    const d = await searchDeezerArtistImage(name);
    if (d) { sources.push(d); winner = d; }
  }
  if (!winner) {
    const i = await searchItunesArtistImage(name);
    if (i) { sources.push(i); winner = i; }
  }
  if (!winner) {
    const mb = await searchMusicBrainzArtistImage(name);
    if (mb && mb.url) { sources.push(mb); winner = mb; }
  }
  if (!winner) {
    const lf = await searchLastFmArtistImage(name);
    if (lf) { sources.push(lf); winner = lf; }
  }

  return { winner, spotifyId, sources };
}

// GET — counts of contacts with/without images
router.get('/enrich-images/status', async (_req: Request, res: Response) => {
  try {
    const row = (await pool.query(
      `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE profile_image_url IS NOT NULL AND profile_image_url <> '')::int AS with_image,
          COUNT(*) FILTER (WHERE profile_image_url IS NULL OR profile_image_url = '')::int AS without_image
         FROM music_industry_contacts`,
    )).rows[0];
    res.json({
      ok: true,
      total: row?.total || 0,
      withImage: row?.with_image || 0,
      withoutImage: row?.without_image || 0,
      spotifyConfigured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      providers: {
        spotify: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
        deezer: true,
        itunes: true,
        musicbrainz: true,
        lastfm: Boolean(process.env.LASTFM_API_KEY),
      },
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /enrich-images/status]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// POST — enrich a batch of contacts without images via multi-provider fallback chain
// Order: Spotify → Deezer → iTunes → MusicBrainz/CoverArt → Last.fm
router.post('/enrich-images', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.body?.limit) || 50));
    const onlyContactId = Number(req.body?.contactId);

    // Spotify is optional now — fallbacks work without credentials
    const token = await getSpotifyAppToken();

    let rows: any[] = [];
    if (Number.isFinite(onlyContactId)) {
      rows = (await pool.query(
        `SELECT id, full_name, master_json FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
        [onlyContactId],
      )).rows;
    } else {
      rows = (await pool.query(
        `SELECT id, full_name, master_json
           FROM music_industry_contacts
           WHERE (profile_image_url IS NULL OR profile_image_url = '')
             AND (full_name IS NOT NULL AND full_name <> '')
           ORDER BY COALESCE((master_json->'scoring'->>'leadScore')::numeric, 0) DESC,
                    created_at DESC
           LIMIT $1`,
        [limit],
      )).rows;
    }

    let updated = 0;
    let notFound = 0;
    let skipped = 0;
    const providerCounts: Record<string, number> = {};
    const samples: Array<{ id: number; name: string; url: string; provider: string }> = [];

    for (const row of rows) {
      const mj = row.master_json || {};
      const queryName =
        mj.identity?.artistName ||
        mj.identity?.stageName ||
        row.full_name ||
        mj.identity?.fullName ||
        '';
      if (!queryName || queryName.length < 2) { skipped++; continue; }

      const { winner, spotifyId, sources } = await resolveArtistImage(queryName, token);
      if (!winner) { notFound++; continue; }

      const newMj = { ...mj };
      newMj.identity = { ...(newMj.identity || {}), avatarUrl: winner.url };
      if (spotifyId) {
        newMj.platforms = {
          ...(newMj.platforms || {}),
          spotify: { ...((newMj.platforms || {}).spotify || {}), id: spotifyId, imageUrl: winner.provider === 'spotify' ? winner.url : undefined },
        };
      }
      // Persist every source found for later reuse (model references, retries)
      newMj.visual = {
        ...(newMj.visual || {}),
        sources: [
          ...((newMj.visual || {}).sources || []).filter(
            (s: any) => !sources.some((x) => x.provider === s.provider),
          ),
          ...sources.map((s) => ({
            provider: s.provider,
            url: s.url,
            externalId: s.externalId || null,
            extra: s.extra || null,
            fetchedAt: new Date().toISOString(),
          })),
        ],
        primarySource: winner.provider,
      };

      await pool.query(
        `UPDATE music_industry_contacts
            SET profile_image_url = $1,
                master_json = $2,
                updated_at = NOW()
          WHERE id = $3`,
        [winner.url, JSON.stringify(newMj), row.id],
      );
      updated++;
      providerCounts[winner.provider] = (providerCounts[winner.provider] || 0) + 1;
      if (samples.length < 5) {
        samples.push({ id: row.id, name: queryName, url: winner.url, provider: winner.provider });
      }

      // Tiny delay to stay friendly with rate limits across providers
      await new Promise((r) => setTimeout(r, 120));
    }

    res.json({
      ok: true,
      processed: rows.length,
      updated,
      notFound,
      skipped,
      providerCounts,
      spotifyAvailable: Boolean(token),
      samples,
    });
  } catch (err: any) {
    console.error('[BoostifyAlliances /enrich-images]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

export default router;
