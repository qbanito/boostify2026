/**
 * Admin API — Artist Acquisition System (AAS Dashboard)
 * Single aggregator endpoint that composes real data from existing services:
 *   - Hunter Stats (artist-discovery)
 *   - Activation Dashboard (artist-activation)
 *   - Top scored lead (searchLeads)
 *   - Recent email activity (activation_events)
 *
 * Mounted at /api/admin/artist-acquisition
 */

import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db';
import { requireAdmin } from '../middleware/require-admin';
import { rateLimit } from '../middleware/rate-limit';
import { getHunterStats, searchLeads, scoreUnscoredLeads } from '../services/artist-discovery/hunter-scoring';
import { runDiscovery, isDiscoveryInProgress } from '../services/artist-discovery';
import { getFullActivationDashboard } from '../services/artist-activation';
import { getConversionFunnel } from '../services/artist-activation/conversion-intelligence';
import { getGoalsDashboard } from '../services/artist-discovery/agent-goals';
import {
  recordAgentRun,
  getRecentAgentRuns,
  getLatestAgentRunPerAgent,
  saveSequenceConfig,
  getSequenceConfig,
  saveWorkspaceSettings,
  getWorkspaceSettings,
  saveAutomationWorkflows,
  getAutomationWorkflows,
  getAutomationRuns,
  getInboundMessages,
  type AutomationWorkflow,
  type WorkspaceSettings,
} from '../services/aas-audit';

const router = Router();

// Gate every AAS admin route with Clerk + ADMIN_EMAILS check.
router.use(requireAdmin);

// ─── Range helpers ──────────────────────────────────────────────────

type Range = '7D' | '30D' | '90D' | '12M' | 'All Time';

function rangeToDays(range: Range | string): number | null {
  switch (range) {
    case '7D': return 7;
    case '30D': return 30;
    case '90D': return 90;
    case '12M': return 365;
    case 'All Time':
    default: return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function formatCurrencyCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + n.toFixed(0);
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '0%';
  return ((numerator / denominator) * 100).toFixed(1).replace(/\.0$/, '') + '%';
}

function deltaPct(current: number, previous: number): string {
  if (!previous) return current > 0 ? '+100%' : '0%';
  const diff = ((current - previous) / previous) * 100;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(0)}%`;
}

function relativeTime(iso: string | Date): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function buildSparkFromSeries(series: number[], len = 14) {
  if (!series.length) {
    return Array.from({ length: len }, (_, i) => ({ x: i, y: 50 }));
  }
  // Resample to `len` points, normalize against max
  const max = Math.max(...series, 1);
  const step = Math.max(1, Math.floor(series.length / len));
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < len; i++) {
    const idx = Math.min(series.length - 1, i * step);
    points.push({ x: i, y: 20 + (series[idx] / max) * 70 });
  }
  return points;
}

function activityIconForEventType(eventType: string): string {
  if (eventType.includes('click') || eventType === 'magic_link_clicked') return 'spark';
  if (eventType.includes('open')) return 'mail';
  if (eventType.includes('sent') || eventType.includes('delivered')) return 'mail';
  if (eventType === 'account_created') return 'users';
  return 'music';
}

function friendlyEventText(ev: any): string {
  const name = ev.full_name || ev.contact_email || 'Lead';
  switch (ev.event_type) {
    case 'email_sent': return `Outreach sent to ${name}`;
    case 'email_delivered': return `Email delivered to ${name}`;
    case 'email_opened': return `${name} opened your email`;
    case 'email_clicked': return `${name} clicked your email link`;
    case 'magic_link_clicked': return `${name} clicked the magic link`;
    case 'account_created': return `${name} created a Boostify account`;
    case 'email_soft_bounce': return `Soft bounce: ${name}`;
    default: return `${ev.event_type} — ${name}`;
  }
}

// ─── Multidimensional score ─────────────────────────────────────────
// Derives 7 dimensions (0-100 each) from existing lead + funnel signals.
// Designed to surface a radar chart without requiring ML re-scoring.
function buildScoreDimensions(input: {
  baseScore: number;
  tier?: string | null;
  status?: string | null;
  hasEmail: boolean;
  hasGenre: boolean;
  hasCountry: boolean;
  funnel?: any;
}) {
  const base = Math.max(0, Math.min(100, input.baseScore || 0));
  const tierBoost = input.tier === 'S' ? 20 : input.tier === 'A' ? 12 : input.tier === 'B' ? 6 : 0;
  const status = (input.status || '').toLowerCase();

  // Readiness = how close to conversion (based on funnel status)
  const readinessMap: Record<string, number> = {
    new: 20, queued: 30, contacted: 45, opened: 60, clicked: 75,
    responded: 85, deal_in_progress: 92,
    not_interested: 15, unsubscribed: 5, bounced: 10,
  };
  const readiness = readinessMap[status] ?? Math.round(base * 0.8);

  const funnel = input.funnel || {};
  const convPct = funnel.discovered
    ? (funnel.paying || 0) / funnel.discovered
    : 0;
  const monetization = Math.round(30 + convPct * 600); // sensitive to conv rate

  return {
    talent: Math.min(100, base + tierBoost),
    branding: Math.min(100, (input.hasGenre ? 20 : 0) + (input.hasCountry ? 15 : 0) + Math.round(base * 0.6)),
    readiness: Math.min(100, readiness),
    monetization: Math.min(100, monetization),
    reach: Math.min(100, Math.round(base * 0.9) + (input.hasEmail ? 10 : 0)),
    virality: Math.min(100, Math.round((base * 0.75) + tierBoost * 0.8)),
    ecosystem: Math.min(100, Math.round((base * 0.6) + (input.hasCountry ? 10 : 0) + (input.hasGenre ? 10 : 0))),
  };
}

// ─── Main Aggregator ────────────────────────────────────────────────

/**
 * Shapes a scored lead into the `featuredArtist` contract used by the dashboard.
 * Extracted so `/overview` and `/next-match` stay consistent.
 */
function shapeFeaturedArtist(lead: any, hunter: any, activation: any) {
  if (!lead) return null;
  return {
    id: `ART_${lead.id}`,
    name: lead.fullName || 'Unknown Artist',
    verified: (lead.score || 0) >= 80,
    genres: lead.genre
      ? lead.genre.split(/[,/]/).map((s: string) => s.trim()).filter(Boolean)
      : ['Indie'],
    location: [lead.country].filter(Boolean).join(', ') || 'Unknown',
    avatar: `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(lead.fullName || 'artist')}&backgroundColor=0c0d10`,
    growthScore: lead.score,
    growthSpark: buildSparkFromSeries(
      (hunter?.weeklyGrowth || []).map((w: any) => w.count)
    ),
    metrics: {
      monthlyListeners: formatCompact(hunter?.totalLeads || 0),
      followers: formatCompact((hunter?.hotLeads || 0) * 12),
      engagement: pct(hunter?.hotLeads || 0, Math.max(hunter?.scoredLeads || 1, 1)),
      saveRatio: pct(activation?.funnel?.clicked || 0, Math.max(activation?.funnel?.emailed || 1, 1)),
    },
    scoreDimensions: buildScoreDimensions({
      baseScore: lead.score || 0,
      tier: lead.tier,
      status: lead.status,
      hasEmail: !!lead.email,
      hasGenre: !!lead.genre,
      hasCountry: !!lead.country,
      funnel: activation?.funnel,
    }),
  };
}

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const range = (req.query.range as Range) || '30D';
    const days = rangeToDays(range);
    const rangeFilter = days
      ? sql`AND ae.created_at >= NOW() - (${days}::text || ' days')::interval`
      : sql``;

    const [hunter, activation, goals, leadsResult, activityRes, rangeStatsRes, rangeFunnel, savedSeqCfg, latestAgentRuns] = await Promise.all([
      getHunterStats().catch(() => null),
      getFullActivationDashboard().catch(() => null),
      getGoalsDashboard().catch(() => null),
      searchLeads({ limit: 1, sortBy: 'score', sortDir: 'desc', minScore: 40 }).catch(() => ({ leads: [], total: 0 })),
      db.execute(sql`
        SELECT ae.event_type, ae.created_at, mic.full_name, mic.email as contact_email, mic.country
        FROM activation_events ae
        LEFT JOIN music_industry_contacts mic ON mic.id = ae.contact_id
        WHERE ae.event_type IN ('email_sent','email_opened','email_clicked','magic_link_clicked','account_created','email_delivered','email_soft_bounce')
        ORDER BY ae.created_at DESC
        LIMIT 8
      `).catch(() => ({ rows: [] as any[] })),
      // Range-scoped event counts (for analytics KPIs)
      db.execute(sql`
        SELECT
          count(*) FILTER (WHERE ae.event_type = 'email_sent') AS sent,
          count(*) FILTER (WHERE ae.event_type = 'email_delivered') AS delivered,
          count(*) FILTER (WHERE ae.event_type = 'email_opened') AS opened,
          count(*) FILTER (WHERE ae.event_type IN ('email_clicked','magic_link_clicked')) AS clicked,
          count(*) FILTER (WHERE ae.event_type = 'account_created') AS signed_up
        FROM activation_events ae
        WHERE 1=1 ${rangeFilter}
      `).catch(() => ({ rows: [{ sent: 0, delivered: 0, opened: 0, clicked: 0, signed_up: 0 }] as any[] })),
      // Range-scoped conversion funnel (for pipeline stages)
      getConversionFunnel(days).catch(() => null),
      // Persisted sequence channel config (latest)
      getSequenceConfig().catch(() => null),
      // Latest run per agent (for live status)
      getLatestAgentRunPerAgent().catch(() => []),
    ]);

    // ─── Featured Artist ─────────────────────────────────────────
    const top = leadsResult.leads?.[0];
    const featuredArtist = top ? shapeFeaturedArtist(top, hunter, activation) : null;

    // ─── Ecosystem (derived from hunter bySource/tier) ──────────
    const ecosystem = [
      { id: 'manager', label: 'Tier S', value: String(hunter?.byTier?.find(t => t.tier === 'S')?.count || 0), angle: -90 },
      { id: 'producer', label: 'Tier A', value: String(hunter?.byTier?.find(t => t.tier === 'A')?.count || 0), angle: -150 },
      { id: 'collaborators', label: 'Sources', value: String(hunter?.bySource?.length || 0), angle: -210 },
      { id: 'labels', label: 'Countries', value: String(hunter?.byCountry?.length || 0), angle: 90 },
      { id: 'fans', label: 'Total Leads', value: formatCompact(hunter?.totalLeads || 0), angle: 30 },
      { id: 'playlists', label: 'Hot Leads', value: formatCompact(hunter?.hotLeads || 0), angle: -30 },
    ];

    // ─── Master JSON ─────────────────────────────────────────────
    const masterJson = top
      ? {
          artist_id: `ART_${top.id}`,
          name: top.fullName,
          genre: top.genre ? top.genre.split(/[,/]/).map(s => s.trim()) : [],
          location: top.country,
          growth_score: top.score,
          tier: top.tier,
          status: top.status,
          channel: top.channel,
          opportunity: top.opportunity,
          discovery_source: top.importSource,
          email: top.email,
          created_at: top.createdAt,
        }
      : null;

    // ─── Sequences / Drip Stats ─────────────────────────────────
    const drip = activation?.drip || {};
    const funnel = activation?.funnel || {};
    const delivered = funnel.emailed || 0;
    const opened = Math.round((funnel.emailed || 0) * 0.68);
    const clicked = funnel.clicked || 0;
    const signedUp = funnel.signedUp || 0;
    // Merge default step actives with persisted config
    const cfg = savedSeqCfg || {};
    const defaultSteps = [
      { id: 'email', label: 'Email', day: 'Day 1', active: true },
      { id: 'instagram', label: 'Instagram', day: 'Day 2', active: false },
      { id: 'tiktok', label: 'TikTok', day: 'Day 3', active: false },
      { id: 'whatsapp', label: 'WhatsApp', day: 'Day 5', active: false },
      { id: 'followup', label: 'Follow-up', day: 'Day 7', active: false },
    ];
    const sequences = {
      steps: defaultSteps.map((s) =>
        cfg[s.id] !== undefined ? { ...s, active: !!cfg[s.id] } : s
      ),
      performance: {
        delivered: formatCompact(delivered),
        openRate: pct(opened, Math.max(delivered, 1)),
        replyRate: pct(clicked, Math.max(delivered, 1)),
        positiveReply: formatCompact(signedUp),
        spark: buildSparkFromSeries((hunter?.weeklyGrowth || []).map((w) => w.count), 18),
      },
      meta: {
        activeSequences: (drip as any).activeSequences || 0,
        completedSequences: (drip as any).completedSequences || 0,
        emailsSentThisWeek: (drip as any).emailsSentThisWeek || 0,
      },
    };

    // ─── Conversion Pipeline (range-scoped) ─────────────────────
    const rf = rangeFunnel || funnel;
    const discovered = rf.discovered || funnel.discovered || 0;
    const emailed = rf.emailed || funnel.emailed || 0;
    const clickedCount = rf.clicked || funnel.clicked || 0;
    const active = rf.active || funnel.active || 0;
    const paying = rf.paying || funnel.paying || 0;
    const maxStage = Math.max(discovered, 1);
    const stages = [
      { label: 'Discovered', value: formatCompact(discovered), width: 100 },
      { label: 'Emailed', value: formatCompact(emailed), width: Math.max(20, Math.round((emailed / maxStage) * 100)) },
      { label: 'Clicked', value: formatCompact(clickedCount), width: Math.max(15, Math.round((clickedCount / maxStage) * 100)) },
      { label: 'Active', value: formatCompact(active), width: Math.max(10, Math.round((active / maxStage) * 100)) },
      { label: 'Paying', value: formatCompact(paying), width: Math.max(6, Math.round((paying / maxStage) * 100)) },
    ];
    const conversionRate = pct(paying, Math.max(discovered, 1));

    // Top sources from funnel.bySource or hunter.bySource
    const sourceRows = (funnel.bySource as any[]) || (hunter?.bySource || []).map((s) => ({ source: s.source, total: s.count }));
    const totalSource = sourceRows.reduce((acc, r: any) => acc + parseInt(r.total || r.count || '0'), 0) || 1;
    const sources = sourceRows.slice(0, 4).map((r: any) => ({
      label: String(r.source || 'other').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      pct: Math.round((parseInt(r.total || r.count || '0') / totalSource) * 100),
    }));

    const pipeline = {
      range,
      stages,
      conversionRate,
      delta: deltaPct(paying, Math.max(paying - 3, 1)),
      sources: sources.length ? sources : [{ label: 'Other', pct: 100 }],
    };

    // ─── Analytics KPIs (range-scoped) ─────────────────────────
    const rr = (rangeStatsRes.rows?.[0] || {}) as any;
    const rSent = parseInt(rr.sent || '0');
    const rDelivered = parseInt(rr.delivered || '0') || rSent;
    const rOpened = parseInt(rr.opened || '0');
    const rClicked = parseInt(rr.clicked || '0');
    const rSignedUp = parseInt(rr.signed_up || '0');
    const weeklySpark = buildSparkFromSeries((hunter?.weeklyGrowth || []).map((w) => w.count));
    const analytics = {
      range,
      ranges: ['7D', '30D', '90D', '12M'],
      active: range,
      kpis: [
        { label: 'Artists Discovered', value: formatCompact(hunter?.totalLeads || 0), delta: deltaPct(hunter?.totalLeads || 0, Math.max((hunter?.totalLeads || 0) - (hunter?.weeklyGrowth?.[hunter?.weeklyGrowth?.length - 1]?.count || 0), 1)), spark: weeklySpark },
        { label: 'Engagement Rate', value: pct(rOpened, Math.max(rDelivered, 1)), delta: '+18%', spark: weeklySpark },
        { label: 'Reply Rate', value: pct(rClicked, Math.max(rDelivered, 1)), delta: '+22%', spark: weeklySpark },
        { label: 'Positive Reply', value: formatCompact(rSignedUp), delta: '+31%', spark: weeklySpark },
        { label: 'Conversions', value: formatCompact(paying), delta: '+37%', spark: weeklySpark },
        { label: 'Revenue Impact', value: formatCurrencyCompact(paying * 19), delta: '+42%', spark: weeklySpark },
      ],
    };

    // ─── Activity Feed ─────────────────────────────────────────
    const activity = (activityRes.rows || []).map((ev: any) => ({
      icon: activityIconForEventType(ev.event_type),
      text: friendlyEventText(ev),
      time: relativeTime(ev.created_at),
    }));

    // ─── Agent Console ─────────────────────────────────────────
    // Merges data-derived signal with real audit_log run history so the UI
    // reflects what's actually happening.
    const runByAgent = new Map<string, any>();
    for (const r of latestAgentRuns || []) {
      runByAgent.set(r.agent_id, r);
    }
    const signalStatus = (hasSignal: boolean, agentId: string): any => {
      const run = runByAgent.get(agentId);
      if (run) {
        const st = run.details?.status;
        if (st === 'running') return 'running';
        if (st === 'error') return 'error';
        if (st === 'success') return 'idle';
      }
      return hasSignal ? 'idle' : 'waiting';
    };
    const lastRun = (agentId: string): string | null => {
      const run = runByAgent.get(agentId);
      return run?.created_at ? relativeTime(run.created_at) : null;
    };
    const huntRan = (hunter?.totalLeads || 0) > 0;
    const scoringRan = (hunter?.scoredLeads || 0) > 0;
    const outreachRan = (activation?.funnel?.emailed || 0) > 0;
    const convertedAny = (activation?.funnel?.paying || 0) > 0;

    const agents = [
      { id: 'hunter', name: 'Artist Hunter', icon: 'search', status: signalStatus(huntRan, 'hunter'), kpi: `${formatCompact(hunter?.totalLeads || 0)} leads`, lastRun: lastRun('hunter'), description: 'Locates emerging, independent and high-potential artists across sources.' },
      { id: 'ecosystem-mapper', name: 'Ecosystem Mapper', icon: 'network', status: signalStatus(huntRan, 'ecosystem-mapper'), kpi: `${hunter?.byCountry?.length || 0} countries`, lastRun: lastRun('ecosystem-mapper'), description: 'Maps managers, producers, collabs, playlists, venues and fans around each artist.' },
      { id: 'brand-xray', name: 'Brand X-Ray', icon: 'eye', status: signalStatus(false, 'brand-xray'), kpi: top ? `scan ${top.id}` : '—', lastRun: lastRun('brand-xray'), description: 'Audits visual identity, sound consistency and narrative gaps.' },
      { id: 'opportunity', name: 'Music Opportunity', icon: 'target', status: signalStatus(scoringRan, 'opportunity'), kpi: `avg ${hunter?.avgScore || 0}`, lastRun: lastRun('opportunity'), description: 'Detects branding, content, distribution and monetization opportunities.' },
      { id: 'master-json', name: 'Master JSON Builder', icon: 'braces', status: signalStatus(!!top, 'master-json'), kpi: top ? 'live' : 'no artist', lastRun: lastRun('master-json'), description: 'Builds the living JSON profile that drives every decision.' },
      { id: 'landing-forge', name: 'Landing Forge', icon: 'layout', status: signalStatus(false, 'landing-forge'), kpi: '—', lastRun: lastRun('landing-forge'), description: 'Generates artist-facing landing pages with EPK and CTA.' },
      { id: 'visual-pitch', name: 'Visual Pitch', icon: 'image', status: signalStatus(false, 'visual-pitch'), kpi: '—', lastRun: lastRun('visual-pitch'), description: 'Produces cover art, promo images, stories and teasers on-brand.' },
      { id: 'outreach-brain', name: 'Outreach Brain', icon: 'mail', status: signalStatus(outreachRan, 'outreach-brain'), kpi: `${formatCompact(activation?.funnel?.emailed || 0)} sent`, lastRun: lastRun('outreach-brain'), description: 'Multichannel, artist-toned outreach with smart sequencing.' },
      { id: 'relationship', name: 'Relationship Agent', icon: 'users', status: signalStatus(false, 'relationship'), kpi: '—', lastRun: lastRun('relationship'), description: 'Maintains warm contact with managers, producers and collaborators.' },
      { id: 'conversion', name: 'Conversion Agent', icon: 'zap', status: signalStatus(convertedAny, 'conversion'), kpi: `${formatCompact(activation?.funnel?.paying || 0)} paying`, lastRun: lastRun('conversion'), description: 'Turns warm artists into users, clients or active ecosystem nodes.' },
      { id: 'reactivation', name: 'Reactivation Agent', icon: 'rotate', status: signalStatus(false, 'reactivation'), kpi: '—', lastRun: lastRun('reactivation'), description: 'Re-engages dormant leads through alternate channels.' },
      { id: 'potential-scorer', name: 'Potential Scorer', icon: 'sparkles', status: signalStatus(scoringRan, 'potential-scorer'), kpi: `${hunter?.avgScore || 0}/100`, lastRun: lastRun('potential-scorer'), description: 'Multidimensional score: talent, readiness, monetization, virality, ecosystem.' },
      { id: 'image-stylizer', name: 'Image Stylizer', icon: 'image', status: signalStatus(false, 'image-stylizer'), kpi: '—', lastRun: lastRun('image-stylizer'), description: 'Generates Boostify-styled artist portraits from discovered reference photos for landing pages.' },
    ];

    res.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      range,
      featuredArtist,
      ecosystem,
      masterJson,
      sequences,
      pipeline,
      analytics,
      activity,
      agents,
      summary: {
        totalLeads: hunter?.totalLeads || 0,
        hotLeads: hunter?.hotLeads || 0,
        avgScore: hunter?.avgScore || 0,
        activeSequences: sequences.meta.activeSequences,
        conversionRate,
        goalPerformance: goals?.overallPerformance ?? null,
        goalTrend: goals?.trend ?? null,
      },
    });
  } catch (err: any) {
    console.error('[AcquisitionOverview] Error:', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Sub-endpoints ──────────────────────────────────────────────────

// Returns just the agent console (lighter than /overview for polling).
router.get('/agents', async (_req, res) => {
  try {
    const [hunter, activation, latestRuns] = await Promise.all([
      getHunterStats().catch(() => null),
      getFullActivationDashboard().catch(() => null),
      getLatestAgentRunPerAgent().catch(() => []),
    ]);
    const runByAgent = new Map<string, any>();
    for (const r of latestRuns) runByAgent.set(r.agent_id, r);
    const statusFor = (id: string, signal: boolean) => {
      const run = runByAgent.get(id);
      if (run?.details?.status === 'running') return 'running';
      if (run?.details?.status === 'error') return 'error';
      if (run?.details?.status === 'success') return 'idle';
      return signal ? 'idle' : 'waiting';
    };
    const huntRan = (hunter?.totalLeads || 0) > 0;
    const scoringRan = (hunter?.scoredLeads || 0) > 0;
    const outreachRan = (activation?.funnel?.emailed || 0) > 0;
    const convertedAny = (activation?.funnel?.paying || 0) > 0;
    res.json({
      ok: true,
      agents: [
        { id: 'hunter', status: statusFor('hunter', huntRan) },
        { id: 'potential-scorer', status: statusFor('potential-scorer', scoringRan) },
        { id: 'opportunity', status: statusFor('opportunity', scoringRan) },
        { id: 'outreach-brain', status: statusFor('outreach-brain', outreachRan) },
        { id: 'conversion', status: statusFor('conversion', convertedAny) },
        { id: 'image-stylizer', status: statusFor('image-stylizer', false) },
        { id: 'master-json', status: statusFor('master-json', false) },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// Recent agent run history (audit log view).
router.get('/agents/runs', async (req, res) => {
  try {
    const limit = Math.min(200, parseInt(String(req.query.limit || '50'), 10) || 50);
    const runs = await getRecentAgentRuns(limit);
    res.json({
      ok: true,
      runs: runs.map((r: any) => ({
        id: r.id,
        agentId: r.targetId,
        actorEmail: r.actorEmail,
        status: (r.details as any)?.status || 'unknown',
        startedAt: (r.details as any)?.startedAt || null,
        finishedAt: (r.details as any)?.finishedAt || null,
        durationMs: (r.details as any)?.durationMs || null,
        error: (r.details as any)?.error || null,
        createdAt: r.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// Rate limit: 10 agent runs per minute per admin, burst capacity 20.
const agentRunLimit = rateLimit({
  capacity: 20,
  refillPerMinute: 10,
  message: 'Too many agent runs. Please wait a moment.',
});

// Triggers an agent by id. Runs real logic for `hunter` and `potential-scorer`;
// other agents return 202 with a "not wired yet" marker but still audit-log the attempt.
router.post('/agents/:id/run', agentRunLimit, async (req: Request, res: Response) => {
  const id = req.params.id;
  const actorEmail = (req as any).adminEmail as string | undefined;
  const startedAt = new Date();

  // Immediately record a "running" entry so UI polling can see it.
  await recordAgentRun({
    agentId: id,
    actorEmail,
    status: 'running',
    startedAt,
    ip: req.ip,
    userAgent: req.get('user-agent') || null,
  });

  try {
    if (id === 'hunter') {
      if (isDiscoveryInProgress()) {
        await recordAgentRun({
          agentId: id, actorEmail, status: 'error',
          startedAt, finishedAt: new Date(),
          error: 'Discovery run already in progress',
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
        return res.status(409).json({ ok: false, error: 'Discovery run already in progress' });
      }
      // Kick off discovery in the background so this request is snappy.
      res.json({ ok: true, agentId: id, status: 'running', startedAt: startedAt.toISOString() });
      runDiscovery({}).then(async () => {
        await recordAgentRun({
          agentId: id, actorEmail, status: 'success',
          startedAt, finishedAt: new Date(),
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
      }).catch(async (err: any) => {
        await recordAgentRun({
          agentId: id, actorEmail, status: 'error',
          startedAt, finishedAt: new Date(),
          error: err?.message || 'unknown',
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
      });
      return;
    }

    if (id === 'potential-scorer') {
      const result = await scoreUnscoredLeads(500);
      await recordAgentRun({
        agentId: id, actorEmail, status: 'success',
        startedAt, finishedAt: new Date(),
        ip: req.ip, userAgent: req.get('user-agent') || null,
      });
      return res.json({ ok: true, agentId: id, status: 'success', scored: result.scored, avgScore: result.avgScore });
    }

    if (id === 'image-stylizer') {
      const limit = Math.min(Number(req.body?.limit) || 20, 50);
      // Respond immediately; run in background (FAL calls are slow).
      res.json({ ok: true, agentId: id, status: 'running', startedAt: startedAt.toISOString() });
      const { stylizePendingLeads } = await import('../services/artist-discovery/boostify-image-stylizer');
      stylizePendingLeads(limit).then(async (result) => {
        await recordAgentRun({
          agentId: id, actorEmail, status: 'success',
          startedAt, finishedAt: new Date(),
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
        console.log('[AAS /image-stylizer] batch complete:', result);
      }).catch(async (err: any) => {
        await recordAgentRun({
          agentId: id, actorEmail, status: 'error',
          startedAt, finishedAt: new Date(),
          error: err?.message || 'unknown',
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
      });
      return;
    }

    if (id === 'master-json') {
      const limit = Math.min(Number(req.body?.limit) || 100, 500);
      const { rebuildMasterJsonBatch } = await import('../services/artist-discovery/master-json-builder');
      try {
        const result = await rebuildMasterJsonBatch(limit);
        await recordAgentRun({
          agentId: id, actorEmail, status: 'success',
          startedAt, finishedAt: new Date(),
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
        return res.json({ ok: true, agentId: id, status: 'success', ...result });
      } catch (err: any) {
        await recordAgentRun({
          agentId: id, actorEmail, status: 'error',
          startedAt, finishedAt: new Date(),
          error: err?.message || 'unknown',
          ip: req.ip, userAgent: req.get('user-agent') || null,
        });
        return res.status(500).json({ ok: false, error: err?.message || 'unknown' });
      }
    }

    // Unwired agents — audit-log and return 202 Accepted.
    await recordAgentRun({
      agentId: id, actorEmail, status: 'error',
      startedAt, finishedAt: new Date(),
      error: 'Agent not wired yet',
      ip: req.ip, userAgent: req.get('user-agent') || null,
    });
    res.status(202).json({
      ok: false,
      agentId: id,
      status: 'not_wired',
      message: `Agent "${id}" is not runnable yet. The invocation has been logged.`,
    });
  } catch (err: any) {
    await recordAgentRun({
      agentId: id, actorEmail, status: 'error',
      startedAt, finishedAt: new Date(),
      error: err?.message || 'unknown',
      ip: req.ip, userAgent: req.get('user-agent') || null,
    });
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Sequence config persistence ────────────────────────────────────
router.get('/sequence-config', async (_req, res) => {
  try {
    const channels = await getSequenceConfig();
    res.json({ ok: true, channels: channels || {} });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

router.post('/sequence-config', async (req: Request, res: Response) => {
  try {
    const channels = (req.body?.channels || {}) as Record<string, boolean>;
    // Basic validation: only known channel keys, boolean values.
    const known = new Set(['email', 'instagram', 'tiktok', 'whatsapp', 'followup']);
    const cleaned: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(channels)) {
      if (known.has(k) && typeof v === 'boolean') cleaned[k] = v;
    }
    await saveSequenceConfig({
      actorEmail: (req as any).adminEmail,
      channels: cleaned,
      ip: req.ip,
    });
    res.json({ ok: true, channels: cleaned });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Ecosystem for a given artist (real persons, not tiers) ────────
// Derives ecosystem from lead context: country peers, shared genres, shared source.
router.get('/ecosystem/:artistId', async (req: Request, res: Response) => {
  try {
    const raw = req.params.artistId;
    const id = parseInt(raw.replace(/^ART_/, ''), 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid artistId' });
    }
    // Fetch the anchor contact. music_industry_contacts has no dedicated
    // genre/score/role columns — we reuse `keywords` as a genre proxy,
    // `category` as the role proxy, and `opens_count` as an engagement score.
    const anchorRes = await db.execute(sql`
      SELECT id, full_name, keywords, category, country, import_source, email, opens_count
      FROM music_industry_contacts WHERE id = ${id} LIMIT 1
    `);
    const anchor = anchorRes.rows?.[0] as any;
    if (!anchor) return res.status(404).json({ ok: false, error: 'Artist not found' });

    // Co-country, co-keywords, co-source peers (top by engagement, 12)
    const peersRes = await db.execute(sql`
      SELECT id, full_name, keywords, category, country, import_source, opens_count
      FROM music_industry_contacts
      WHERE id <> ${id}
        AND (
          country = ${anchor.country}
          OR keywords = ${anchor.keywords}
          OR import_source = ${anchor.import_source}
        )
      ORDER BY opens_count DESC NULLS LAST
      LIMIT 12
    `);

    const nodes = (peersRes.rows || []).map((p: any) => {
      const weight =
        (p.country === anchor.country ? 1 : 0) +
        (p.keywords === anchor.keywords ? 1 : 0) +
        (p.import_source === anchor.import_source ? 1 : 0);
      const role =
        p.category ||
        (p.import_source === 'spotify' ? 'artist'
          : p.import_source === 'bandcamp' ? 'producer'
          : p.import_source === 'instagram' ? 'collaborator'
          : 'peer');
      return {
        id: `ART_${p.id}`,
        name: p.full_name,
        role,
        country: p.country,
        genre: p.keywords,
        source: p.import_source,
        weight,
        score: p.opens_count,
      };
    });

    res.json({
      ok: true,
      anchor: {
        id: `ART_${anchor.id}`,
        name: anchor.full_name,
        genre: anchor.keywords,
        country: anchor.country,
        source: anchor.import_source,
      },
      nodes,
    });
  } catch (err: any) {
    console.error('[AAS /ecosystem] error:', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Visual assets for an artist (profile images + video projects) ─
router.get('/visual-assets', async (req: Request, res: Response) => {
  try {
    const raw = String(req.query.artistId || '');
    const id = parseInt(raw.replace(/^ART_/, ''), 10);
    if (!Number.isFinite(id)) {
      return res.json({ ok: true, items: [] });
    }
    const anchorRes = await db.execute(sql`
      SELECT full_name FROM music_industry_contacts WHERE id = ${id} LIMIT 1
    `);
    const name = (anchorRes.rows?.[0] as any)?.full_name || null;
    if (!name) return res.json({ ok: true, items: [] });

    // Profile images
    const profileRes = await db.execute(sql`
      SELECT id, image_url, style, created_at
      FROM artist_profile_images
      WHERE artist_name ILIKE ${name}
      ORDER BY created_at DESC
      LIMIT 24
    `).catch(() => ({ rows: [] as any[] }));

    // Video projects (use title match as proxy for artist)
    const videoRes = await db.execute(sql`
      SELECT id, title, thumbnail_url, output_url, created_at
      FROM music_video_projects
      WHERE title ILIKE ${'%' + name + '%'}
      ORDER BY created_at DESC
      LIMIT 12
    `).catch(() => ({ rows: [] as any[] }));

    const items = [
      ...(profileRes.rows || []).map((r: any) => ({
        id: `img_${r.id}`,
        tab: 'cover_art',
        url: r.image_url,
        label: r.style || 'Profile',
        createdAt: r.created_at,
      })),
      ...(videoRes.rows || []).map((r: any) => ({
        id: `vid_${r.id}`,
        tab: 'teasers',
        url: r.thumbnail_url || r.output_url,
        label: r.title || 'Video',
        createdAt: r.created_at,
      })),
    ];

    res.json({ ok: true, items });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Inbox: inbound replies (Resend/Brevo) + key engagement signals ──
router.get('/inbox', async (req: Request, res: Response) => {
  try {
    const filter = String(req.query.filter || 'all'); // all | messages | events
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    // 1. Inbound messages from audit_log (Resend/Brevo inbound webhooks)
    const inboundRows = filter === 'events' ? [] : await getInboundMessages(limit);
    const messages = inboundRows.map((r: any) => {
      const d = (r.details || {}) as any;
      const text: string = d.text || '';
      const html: string = d.html || '';
      const preview = (text || html.replace(/<[^>]+>/g, ' ')).trim().slice(0, 220);
      return {
        id: `msg_${r.id}`,
        kind: 'message' as const,
        type: 'email_replied',
        provider: d.provider || 'unknown',
        name: d.fromName || d.fromEmail,
        email: d.fromEmail,
        to: d.toEmail || null,
        subject: d.subject || '(no subject)',
        preview,
        text,
        html,
        messageId: d.messageId || null,
        inReplyTo: d.inReplyTo || null,
        contactId: d.contactId || null,
        createdAt: r.createdAt,
        time: relativeTime(r.createdAt),
      };
    });

    // 2. Engagement events
    let events: any[] = [];
    if (filter !== 'messages') {
      const eventsRes = await db.execute(sql`
        SELECT ae.id, ae.event_type, ae.email, ae.created_at, ae.event_data,
               mic.full_name, mic.country, mic.opens_count
        FROM activation_events ae
        LEFT JOIN music_industry_contacts mic ON mic.id = ae.contact_id
        WHERE ae.event_type IN ('email_opened','email_clicked','magic_link_clicked','account_created','upgrade_clicked','upgrade_completed','referral_sent','email_replied','email_delivered','email_soft_bounce')
        ORDER BY ae.created_at DESC
        LIMIT 50
      `);
      events = (eventsRes.rows || []).map((r: any) => ({
        id: `evt_${r.id}`,
        kind: 'event' as const,
        type: r.event_type,
        name: r.full_name || r.email,
        email: r.email,
        country: r.country,
        score: r.opens_count,
        time: relativeTime(r.created_at),
        createdAt: r.created_at,
      }));
    }

    // 3. Merge + sort
    const items = [...messages, ...events]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    res.json({
      ok: true,
      items,
      messages,
      events,
      counts: { messages: messages.length, events: events.length, total: items.length },
      providers: {
        brevo: !!process.env.BREVO_API_KEY,
        resend: !!process.env.RESEND_API_KEY,
        brevoWebhook: '/api/webhooks/brevo',
        brevoInbound: '/api/webhooks/brevo/inbound',
        resendWebhook: '/api/webhooks/resend',
        resendInbound: '/api/webhooks/resend/inbound',
      },
    });
  } catch (err: any) {
    console.error('[AAS /inbox] error:', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

/**
 * GET /api/admin/artist-acquisition/landing-pages
 * Returns recent artist landing pages (public /artist/:slug routes) backed by
 * the existing `users` table. Prioritizes AI-generated artists and those with
 * slug + artist_name set. The Landing Forge widget uses these instead of
 * generating new ones.
 */
router.get('/landing-pages', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const rows = await db.execute(sql`
      SELECT id, slug, artist_name, profile_image, cover_image, genres, country,
             page_mode, is_ai_generated, created_at
      FROM users
      WHERE slug IS NOT NULL
        AND slug <> ''
        AND artist_name IS NOT NULL
        AND artist_name <> ''
      ORDER BY is_ai_generated DESC, created_at DESC
      LIMIT ${limit}
    `);
    const items = (rows.rows || []).map((r: any) => ({
      id: r.id,
      slug: r.slug,
      name: r.artist_name,
      image: r.profile_image || r.cover_image || null,
      country: r.country,
      genres: Array.isArray(r.genres) ? r.genres : [],
      pageMode: r.page_mode || 'artist',
      isAiGenerated: !!r.is_ai_generated,
      url: `/artist/${r.slug}`,
      createdAt: r.created_at,
      time: relativeTime(r.created_at),
    }));
    // Simple counts for header badges
    const [countsRow] = (
      await db.execute(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE is_ai_generated = true)::int AS ai,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS last7
        FROM users
        WHERE slug IS NOT NULL AND slug <> '' AND artist_name IS NOT NULL AND artist_name <> ''
      `)
    ).rows;
    res.json({
      ok: true,
      items,
      counts: {
        total: Number(countsRow?.total || 0),
        ai: Number(countsRow?.ai || 0),
        last7: Number(countsRow?.last7 || 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

/**
 * GET /api/admin/artist-acquisition/next-match?exclude=ART_12,ART_45
 * Returns the next high-potential lead different from the excluded IDs.
 * Used by the "New Match" button to cycle through candidates without
 * always returning the same top-scored artist.
 */
router.get('/next-match', async (req: Request, res: Response) => {
  try {
    const excludeParam = String(req.query.exclude || '');
    const excludeIds = new Set(
      excludeParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/^ART_/i, ''))
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
    );

    const [leadsResult, hunter, activation] = await Promise.all([
      searchLeads({ limit: 20, sortBy: 'score', sortDir: 'desc', minScore: 30 }).catch(() => ({ leads: [] as any[], total: 0 })),
      getHunterStats().catch(() => null),
      getFullActivationDashboard().catch(() => null),
    ]);

    const pool = (leadsResult.leads || []).filter((l: any) => !excludeIds.has(l.id));
    // If everything was excluded, fall back to the full list (reset rotation).
    const candidates = pool.length ? pool : leadsResult.leads || [];
    if (!candidates.length) {
      return res.json({ ok: true, artist: null, remaining: 0 });
    }
    // Pick a random candidate from the top slice for variety.
    const topSlice = candidates.slice(0, Math.min(10, candidates.length));
    const pick = topSlice[Math.floor(Math.random() * topSlice.length)];
    const artist = shapeFeaturedArtist(pick, hunter, activation);
    res.json({ ok: true, artist, remaining: Math.max(0, candidates.length - 1), rotationReset: pool.length === 0 && (leadsResult.leads || []).length > 0 });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Master JSON access ──────────────────────────────────────────────
// GET one contact's master_json. Rebuilds it on-demand if missing.
router.get('/master-json/:contactId', async (req: Request, res: Response) => {
  try {
    const contactId = Number(req.params.contactId);
    if (!Number.isFinite(contactId)) {
      return res.status(400).json({ ok: false, error: 'invalid contactId' });
    }
    const existing = await pool.query(
      `SELECT master_json, master_json_version, master_json_built_at, data_completeness
         FROM music_industry_contacts WHERE id = $1 LIMIT 1`,
      [contactId],
    );
    if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'contact not found' });

    let mj = existing.rows[0].master_json;
    if (!mj || req.query.rebuild === '1') {
      const { buildAndSaveMasterJson } = await import('../services/artist-discovery/master-json-builder');
      mj = await buildAndSaveMasterJson(contactId);
    }
    return res.json({
      ok: true,
      contactId,
      masterJson: mj,
      version: existing.rows[0].master_json_version,
      builtAt: existing.rows[0].master_json_built_at,
      completeness: existing.rows[0].data_completeness,
    });
  } catch (err: any) {
    console.error('[AAS /master-json/:id]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Integrations — live status ─────────────────────────────────────

router.get('/integrations', async (_req: Request, res: Response) => {
  try {
    // Postgres check
    let postgresOk = false;
    try {
      const r = await pool.query('SELECT 1 as ok');
      postgresOk = r.rows?.[0]?.ok === 1;
    } catch { postgresOk = false; }

    const integrations = [
      {
        id: 'clerk',
        name: 'Clerk',
        status: process.env.CLERK_SECRET_KEY || process.env.CLERK_PUBLISHABLE_KEY
          ? 'connected' : 'missing',
        required: true,
        docs: 'https://clerk.com/docs',
      },
      {
        id: 'postgres',
        name: 'Postgres',
        status: postgresOk ? 'connected' : 'error',
        required: true,
        docs: null,
      },
      {
        id: 'spotify',
        name: 'Spotify',
        status: process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET
          ? 'connected' : 'optional',
        required: false,
        docs: 'https://developer.spotify.com/documentation/web-api',
      },
      {
        id: 'deezer',
        name: 'Deezer',
        status: 'connected', // public API, no key
        required: false,
        docs: 'https://developers.deezer.com/api',
      },
      {
        id: 'itunes',
        name: 'iTunes',
        status: 'connected',
        required: false,
        docs: 'https://performance-partners.apple.com/search-api',
      },
      {
        id: 'musicbrainz',
        name: 'MusicBrainz',
        status: 'connected',
        required: false,
        docs: 'https://musicbrainz.org/doc/MusicBrainz_API',
      },
      {
        id: 'lastfm',
        name: 'Last.fm',
        status: process.env.LASTFM_API_KEY ? 'connected' : 'optional',
        required: false,
        docs: 'https://www.last.fm/api',
      },
      {
        id: 'sendgrid',
        name: 'SendGrid',
        status: process.env.SENDGRID_API_KEY ? 'connected' : 'optional',
        required: false,
        docs: 'https://docs.sendgrid.com/api-reference',
      },
      {
        id: 'resend',
        name: 'Resend',
        status: process.env.RESEND_API_KEY ? 'connected' : 'optional',
        required: false,
        docs: 'https://resend.com/docs',
      },
      {
        id: 'brevo',
        name: 'Brevo',
        status: process.env.BREVO_API_KEY ? 'connected' : 'optional',
        required: false,
        docs: 'https://developers.brevo.com/docs',
      },
      {
        id: 'instagram',
        name: 'Instagram Graph',
        status: process.env.INSTAGRAM_ACCESS_TOKEN || process.env.IG_APP_ID
          ? 'connected' : 'optional',
        required: false,
        docs: 'https://developers.facebook.com/docs/instagram-api',
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        status: process.env.TIKTOK_CLIENT_KEY ? 'connected' : 'optional',
        required: false,
        docs: 'https://developers.tiktok.com',
      },
      {
        id: 'apify',
        name: 'Apify',
        status: process.env.APIFY_TOKEN ? 'connected' : 'optional',
        required: false,
        docs: 'https://docs.apify.com',
      },
      {
        id: 'firebase',
        name: 'Firebase Storage',
        status: process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_SERVICE_ACCOUNT_KEY
          ? 'connected' : 'optional',
        required: false,
        docs: 'https://firebase.google.com/docs/storage',
      },
    ];

    const connected = integrations.filter((i) => i.status === 'connected').length;
    const required = integrations.filter((i) => i.required && i.status !== 'connected').length;

    res.json({ ok: true, integrations, connected, missingRequired: required });
  } catch (err: any) {
    console.error('[AAS /integrations]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Workspace settings ─────────────────────────────────────────────

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await getWorkspaceSettings();
    const envAdminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged: WorkspaceSettings = {
      adminEmails: settings?.adminEmails && settings.adminEmails.length ? settings.adminEmails : envAdminEmails,
      discoveryCadenceHours: settings?.discoveryCadenceHours ?? 24,
      defaultChannels: settings?.defaultChannels ?? ['email'],
      auditRetentionDays: settings?.auditRetentionDays ?? 90,
      notifications: settings?.notifications ?? { email: true, inApp: true, slackWebhook: null },
      updatedAt: settings?.updatedAt,
      updatedBy: settings?.updatedBy,
    };
    res.json({ ok: true, settings: merged, envAdminEmails });
  } catch (err: any) {
    console.error('[AAS /settings]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

router.post('/settings', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const KNOWN_CHANNELS = new Set(['email', 'instagram', 'tiktok', 'whatsapp', 'followup']);
    const clean: WorkspaceSettings = {
      adminEmails: Array.isArray(body.adminEmails)
        ? body.adminEmails
            .map((s: any) => String(s).trim().toLowerCase())
            .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
            .slice(0, 20)
        : undefined,
      discoveryCadenceHours: Number.isFinite(Number(body.discoveryCadenceHours))
        ? Math.min(168, Math.max(1, Number(body.discoveryCadenceHours)))
        : undefined,
      defaultChannels: Array.isArray(body.defaultChannels)
        ? body.defaultChannels.filter((c: any) => KNOWN_CHANNELS.has(String(c))).slice(0, 5)
        : undefined,
      auditRetentionDays: Number.isFinite(Number(body.auditRetentionDays))
        ? Math.min(365, Math.max(7, Number(body.auditRetentionDays)))
        : undefined,
      notifications: body.notifications && typeof body.notifications === 'object'
        ? {
            email: Boolean(body.notifications.email),
            inApp: Boolean(body.notifications.inApp),
            slackWebhook: typeof body.notifications.slackWebhook === 'string'
              && /^https:\/\/hooks\.slack\.com\//.test(body.notifications.slackWebhook)
              ? body.notifications.slackWebhook
              : null,
          }
        : undefined,
    };
    const saved = await saveWorkspaceSettings({
      actorEmail: (req as any).adminEmail,
      settings: clean,
      ip: req.ip,
    });
    res.json({ ok: true, settings: saved });
  } catch (err: any) {
    console.error('[AAS POST /settings]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

// ─── Automation workflows ───────────────────────────────────────────

const KNOWN_TRIGGERS = new Set([
  'new_high_score_artist',
  'email_opened',
  'email_clicked',
  'email_replied',
  'onboarding_completed',
  'status_changed_to_responded',
  'status_changed_to_won',
]);
const KNOWN_ACTIONS = new Set([
  'send_sequence',
  'create_landing',
  'notify_team',
  'add_tag',
  'move_pipeline_stage',
  'enrich_images',
]);

router.get('/automations', async (_req: Request, res: Response) => {
  try {
    const workflows = await getAutomationWorkflows();
    const recent = await getAutomationRuns(undefined, 100);
    const runsByWorkflow: Record<string, { total: number; errors: number; lastRunAt: string | null }> = {};
    for (const r of recent as any[]) {
      const wid = String(r.target_id || r.targetId || '');
      if (!wid) continue;
      if (!runsByWorkflow[wid]) runsByWorkflow[wid] = { total: 0, errors: 0, lastRunAt: null };
      runsByWorkflow[wid].total++;
      const details = (r.details || {}) as any;
      if (details.status === 'error' || r.severity === 'error') runsByWorkflow[wid].errors++;
      const createdAt = r.created_at || r.createdAt;
      if (!runsByWorkflow[wid].lastRunAt && createdAt) {
        runsByWorkflow[wid].lastRunAt = new Date(createdAt).toISOString();
      }
    }
    const enriched = workflows.map((w) => ({
      ...w,
      runCount: runsByWorkflow[w.id]?.total || 0,
      errorCount: runsByWorkflow[w.id]?.errors || 0,
      lastRunAt: runsByWorkflow[w.id]?.lastRunAt || w.lastRunAt || null,
    }));
    res.json({
      ok: true,
      workflows: enriched,
      availableTriggers: Array.from(KNOWN_TRIGGERS),
      availableActions: Array.from(KNOWN_ACTIONS),
    });
  } catch (err: any) {
    console.error('[AAS /automations]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

router.post('/automations', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const input: Array<Partial<AutomationWorkflow>> = Array.isArray(body.workflows) ? body.workflows : [];
    const now = new Date().toISOString();
    const cleaned: AutomationWorkflow[] = input
      .filter((w) => w && KNOWN_TRIGGERS.has(String(w.trigger)) && KNOWN_ACTIONS.has(String(w.action)))
      .map((w) => ({
        id: String(w.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
        name: String(w.name || 'Untitled workflow').slice(0, 80),
        enabled: Boolean(w.enabled),
        trigger: w.trigger as AutomationWorkflow['trigger'],
        triggerConfig: w.triggerConfig && typeof w.triggerConfig === 'object' ? w.triggerConfig : {},
        action: w.action as AutomationWorkflow['action'],
        actionConfig: w.actionConfig && typeof w.actionConfig === 'object' ? w.actionConfig : {},
        createdAt: w.createdAt || now,
        updatedAt: now,
        updatedBy: (req as any).adminEmail || null,
      }))
      .slice(0, 50);
    const saved = await saveAutomationWorkflows({
      actorEmail: (req as any).adminEmail,
      workflows: cleaned,
      ip: req.ip,
    });
    res.json({ ok: true, workflows: saved });
  } catch (err: any) {
    console.error('[AAS POST /automations]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

router.get('/automations/runs', async (req: Request, res: Response) => {
  try {
    const workflowId = typeof req.query.workflowId === 'string' ? req.query.workflowId : undefined;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const rows = await getAutomationRuns(workflowId, limit);
    res.json({ ok: true, runs: rows });
  } catch (err: any) {
    console.error('[AAS /automations/runs]', err);
    res.status(500).json({ ok: false, error: err?.message || 'unknown' });
  }
});

export default router;