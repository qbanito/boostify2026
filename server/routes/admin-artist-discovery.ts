/**
 * Admin API routes for Boostify Artist Hunter Agent
 * Full discovery, scoring, search, lead management.
 * Target: 50k active artists by end of 2026.
 */

import { Router, Request, Response } from "express";
import {
  runDiscovery,
  getDiscoveryStats,
  getRunHistory,
  getLastRun,
  startDiscoveryScheduler,
  stopDiscoveryScheduler,
  isSchedulerRunning,
  isDiscoveryInProgress,
  type DiscoveryConfig,
  type DiscoverySource,
} from "../services/artist-discovery";
import {
  getHunterStats,
  scoreUnscoredLeads,
  searchLeads,
  updateLeadStatus,
  saveDiscoveryRun,
  getRecentRuns,
} from "../services/artist-discovery/hunter-scoring";
import {
  convertContactsToArtists,
  getPipelineStats,
  startAutoGeneration,
  stopAutoGeneration,
  isAutoGenerationRunning,
} from "../services/artist-discovery/contacts-to-artists";
import {
  aiBatchScoreLeads,
  getAgentBrainStats,
} from "../services/artist-discovery/agent-brain";
import {
  getGoalsDashboard,
  evaluateWeeklyPerformance,
  computeSourceROI,
  getSourceROI,
} from "../services/artist-discovery/agent-goals";
import {
  getAutonomyDashboard,
  getABTestSummary,
  createSubjectLineTest,
  getHealthHistory,
  trainPredictiveModel,
} from "../services/artist-discovery/agent-autonomy";
import { getPoolStats } from "../services/artist-discovery/apify-client-pool";
import { db } from "../db";
import { musicIndustryContacts } from "../../db/schema";
import { sql, isNotNull } from "drizzle-orm";

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// GET /status — Comprehensive hunter dashboard data
// ═══════════════════════════════════════════════════════════════════
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const [stats, hunterStats, dbRuns, pipelineStats, brainStats, goalsDashboard, autonomy] = await Promise.all([
      getDiscoveryStats(),
      getHunterStats(),
      getRecentRuns(15),
      getPipelineStats(),
      getAgentBrainStats(),
      getGoalsDashboard(),
      getAutonomyDashboard().catch(() => null),
    ]);

    res.json({
      ok: true,
      schedulerRunning: isSchedulerRunning(),
      discoveryInProgress: isDiscoveryInProgress(),
      autoGenRunning: isAutoGenerationRunning(),
      // Legacy fields
      totalContacts: stats.totalContacts,
      addedThisWeek: stats.addedThisWeek,
      bySource: stats.bySource,
      byCountry: stats.byCountry,
      lastRun: stats.lastRun,
      runHistory: stats.runHistory,
      // Hunter Agent fields
      hunter: hunterStats,
      dbRuns,
      // Pipeline fields
      pipeline: pipelineStats,
      // Agent Brain (AI) fields
      brain: brainStats,
      // Goal Engine fields
      goals: goalsDashboard,
      // Autonomy Engine (Phase 4)
      autonomy,
      // Apify Key Pool (failover)
      apifyPool: getPoolStats(),
    });
  } catch (err: any) {
    console.error("[HunterAPI] Status error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /run — Manual discovery trigger + auto-score
// ═══════════════════════════════════════════════════════════════════
router.post("/run", async (req: Request, res: Response) => {
  try {
    if (isDiscoveryInProgress()) {
      return res.status(409).json({ ok: false, error: "Discovery run already in progress" });
    }

    const { sources, dryRun, maxCountries } = req.body || {};

    const config: DiscoveryConfig = {};
    if (sources && Array.isArray(sources)) {
      const valid: DiscoverySource[] = ['spotify', 'bandcamp', 'google_ai', 'instagram', 'soundcloud', 'youtube', 'tiktok'];
      config.sources = sources.filter((s: string) => valid.includes(s as DiscoverySource)) as DiscoverySource[];
    }
    if (typeof dryRun === 'boolean') config.dryRun = dryRun;
    if (typeof maxCountries === 'number' && maxCountries > 0 && maxCountries <= 80) {
      config.maxCountries = maxCountries;
    }

    res.json({ ok: true, message: "Discovery run started", config });

    // Fire discovery + auto-score after completion
    const startMs = Date.now();
    runDiscovery(config).then(async (result) => {
      const durationMs = Date.now() - startMs;
      // Auto-score new leads
      const scoring = await scoreUnscoredLeads(1000);
      // Save run to DB
      await saveDiscoveryRun({
        runId: result.runId,
        sources: result.sources.map(s => s.source),
        rawLeads: result.totals.rawLeads,
        inserted: result.totals.inserted,
        duplicates: result.totals.duplicates,
        invalid: result.totals.invalid,
        scored: scoring.scored,
        sourceDetails: result.sources.map(s => ({
          source: s.source,
          rawLeads: s.rawLeads,
          inserted: s.ingestionResult.inserted,
          duplicates: s.ingestionResult.duplicates,
          durationMs: s.durationMs,
          error: s.error,
        })),
        config: config as Record<string, any>,
        durationMs,
      });
      console.log(`[HunterAgent] Run ${result.runId} saved — ${result.totals.inserted} inserted, ${scoring.scored} scored (avg ${scoring.avgScore})`);
    }).catch(async (err) => {
      console.error("[HunterAgent] Run error:", err);
      await saveDiscoveryRun({
        runId: `err_${Date.now()}`,
        sources: config.sources || [],
        rawLeads: 0, inserted: 0, duplicates: 0, invalid: 0, scored: 0,
        sourceDetails: [],
        config: config as Record<string, any>,
        durationMs: Date.now() - startMs,
        error: err.message,
      });
    });
  } catch (err: any) {
    console.error("[HunterAPI] Run error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /score — Manually trigger scoring of unscored leads
// ═══════════════════════════════════════════════════════════════════
router.post("/score", async (req: Request, res: Response) => {
  try {
    const batchSize = Math.min(parseInt(req.body?.batchSize) || 500, 5000);
    const result = await scoreUnscoredLeads(batchSize);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /leads — Search & filter leads
// ═══════════════════════════════════════════════════════════════════
router.get("/leads", async (req: Request, res: Response) => {
  try {
    const result = await searchLeads({
      query: req.query.q as string,
      country: req.query.country as string,
      source: req.query.source as string,
      status: req.query.status as string,
      minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
      maxScore: req.query.maxScore ? parseInt(req.query.maxScore as string) : undefined,
      tier: req.query.tier as string,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      sortBy: req.query.sortBy as string || 'created_at',
      sortDir: (req.query.sortDir as string || 'desc') as 'asc' | 'desc',
    });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /leads/:id/status — Update a lead's status
// ═══════════════════════════════════════════════════════════════════
router.patch("/leads/:id/status", async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.id);
    const { status } = req.body;
    const validStatuses = ['new', 'queued', 'contacted', 'opened', 'clicked', 'responded', 'not_interested', 'deal_in_progress', 'unsubscribed', 'bounced'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }
    const ok = await updateLeadStatus(contactId, status);
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /history — Run history from DB
// ═══════════════════════════════════════════════════════════════════
router.get("/history", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const dbRuns = await getRecentRuns(limit);
    const memoryRuns = getRunHistory();
    res.json({ ok: true, dbRuns, runs: memoryRuns });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Scheduler controls
// ═══════════════════════════════════════════════════════════════════
router.post("/scheduler/start", async (_req: Request, res: Response) => {
  try {
    startDiscoveryScheduler();
    res.json({ ok: true, schedulerRunning: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/scheduler/stop", async (_req: Request, res: Response) => {
  try {
    stopDiscoveryScheduler();
    res.json({ ok: true, schedulerRunning: false });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /fix-names — Derive names from email
// ═══════════════════════════════════════════════════════════════════
router.post("/fix-names", async (req: Request, res: Response) => {
  try {
    const dryRun = req.body?.dryRun === true;
    const contacts = await db
      .select({
        id: musicIndustryContacts.id,
        fullName: musicIndustryContacts.fullName,
        firstName: musicIndustryContacts.firstName,
        lastName: musicIndustryContacts.lastName,
        email: musicIndustryContacts.email,
      })
      .from(musicIndustryContacts)
      .where(isNotNull(musicIndustryContacts.email));

    const titleCase = (s: string) =>
      s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    function isNameBad(name: string): boolean {
      if (!name || name.length < 2) return true;
      const lower = name.toLowerCase().replace(/[^a-z]/g, '');
      if (lower.length < 2) return true;
      const vowels = lower.replace(/[^aeiou]/g, '').length;
      if (vowels / lower.length < 0.15) return true;
      if (name.trim().length > 25 && !name.includes(' ')) return true;
      if (/^\d+$/.test(name.trim()) || /^[a-f0-9]{8,}$/i.test(name.trim())) return true;
      return false;
    }

    function nameFromEmail(email: string) {
      const prefix = email.split('@')[0];
      if (!prefix) return null;
      const cleaned = prefix.replace(/\d+$/, '');
      const parts = cleaned.split(/[._\-+]+/).map(p => p.trim()).filter(p => p.length > 0).map(titleCase);
      if (!parts.length) return null;
      const fullName = parts.join(' ');
      if (fullName.length < 2) return null;
      return { fullName, firstName: parts[0], lastName: parts.length > 1 ? parts.slice(1).join(' ') : '' };
    }

    let fixed = 0;
    const previews: Array<{ id: number; oldName: string; newName: string; email: string }> = [];

    for (const c of contacts) {
      if (!c.email || !isNameBad(c.fullName)) continue;
      const derived = nameFromEmail(c.email);
      if (!derived || derived.fullName === c.fullName || isNameBad(derived.fullName)) continue;
      previews.push({ id: c.id, oldName: c.fullName, newName: derived.fullName, email: c.email });
      if (!dryRun) {
        await db.execute(sql`
          UPDATE music_industry_contacts
          SET full_name = ${derived.fullName}, first_name = ${derived.firstName}, last_name = ${derived.lastName}, updated_at = NOW()
          WHERE id = ${c.id}
        `);
        fixed++;
      }
    }

    res.json({ ok: true, dryRun, total: contacts.length, badNames: previews.length, fixed: dryRun ? 0 : fixed, previews: previews.slice(0, 100) });
  } catch (err: any) {
    console.error("[HunterAPI] Fix names error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /generate-artists — Bulk convert contacts into artist pages
// ═══════════════════════════════════════════════════════════════════
router.post("/generate-artists", async (req: Request, res: Response) => {
  try {
    const minScore = Math.max(0, Math.min(100, parseInt(req.body?.minScore) || 30));
    const batchSize = Math.max(1, Math.min(2000, parseInt(req.body?.batchSize) || 500));
    const dryRun = req.body?.dryRun === true;

    const result = await convertContactsToArtists({ minScore, batchSize, dryRun });
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[HunterAPI] Generate artists error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /pipeline-stats — Conversion pipeline metrics
// ═══════════════════════════════════════════════════════════════════
router.get("/pipeline-stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getPipelineStats();
    res.json({ ok: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /auto-gen/start|stop — Auto-generation scheduler
// ═══════════════════════════════════════════════════════════════════
router.post("/auto-gen/start", async (_req: Request, res: Response) => {
  try {
    startAutoGeneration();
    res.json({ ok: true, autoGenRunning: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/auto-gen/stop", async (_req: Request, res: Response) => {
  try {
    stopAutoGeneration();
    res.json({ ok: true, autoGenRunning: false });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /ai-score — Manual AI batch scoring (GPT-enhanced)
// ═══════════════════════════════════════════════════════════════════
router.post("/ai-score", async (req: Request, res: Response) => {
  try {
    const batchSize = Math.min(parseInt(req.body.batchSize) || 20, 50);
    res.json({ ok: true, message: `AI scoring ${batchSize} leads...` });
    aiBatchScoreLeads(batchSize).catch(err =>
      console.error("[HunterAPI] AI score error:", err));
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /brain-stats — Agent Brain AI statistics
// ═══════════════════════════════════════════════════════════════════
router.get("/brain-stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getAgentBrainStats();
    res.json({ ok: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /goals — Goals dashboard (current + recent goals + source ROI)
// ═══════════════════════════════════════════════════════════════
router.get("/goals", async (_req: Request, res: Response) => {
  try {
    const dashboard = await getGoalsDashboard();
    res.json({ ok: true, ...dashboard });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /goals/evaluate — Force evaluation of a week
// ═══════════════════════════════════════════════════════════════
router.post("/goals/evaluate", async (req: Request, res: Response) => {
  try {
    const weekStart = req.body?.weekStart ? new Date(req.body.weekStart) : undefined;
    const result = await evaluateWeeklyPerformance(weekStart);
    if (!result) {
      return res.status(404).json({ ok: false, error: "No goals found for that week" });
    }
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /source-roi — Source ROI for current or specified week
// ═══════════════════════════════════════════════════════════════
router.get("/source-roi", async (req: Request, res: Response) => {
  try {
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;
    let roi = await getSourceROI(weekStart);
    if (roi.length === 0) {
      roi = await computeSourceROI(weekStart);
    }
    res.json({ ok: true, sources: roi });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /autonomy — Full autonomy dashboard (A/B, health, predictive, sources)
// ═══════════════════════════════════════════════════════════════
router.get("/autonomy", async (_req: Request, res: Response) => {
  try {
    const dashboard = await getAutonomyDashboard();
    res.json({ ok: true, ...dashboard });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /ab-tests — List all A/B tests
// ═══════════════════════════════════════════════════════════════
router.get("/ab-tests", async (_req: Request, res: Response) => {
  try {
    const tests = await getABTestSummary();
    res.json({ ok: true, tests });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /ab-tests/create — Create a new subject line A/B test
// ═══════════════════════════════════════════════════════════════
router.post("/ab-tests/create", async (req: Request, res: Response) => {
  try {
    const { sequenceType, step, currentSubject } = req.body;
    if (!sequenceType || step === undefined || !currentSubject) {
      return res.status(400).json({ ok: false, error: "sequenceType, step, and currentSubject required" });
    }
    const test = await createSubjectLineTest(sequenceType, step, currentSubject);
    res.json({ ok: true, test });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /health — Health check history
// ═══════════════════════════════════════════════════════════════
router.get("/health", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = await getHealthHistory(limit);
    res.json({ ok: true, history });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /predictive/train — Force retrain predictive model
// ═══════════════════════════════════════════════════════════════
router.post("/predictive/train", async (_req: Request, res: Response) => {
  try {
    const model = await trainPredictiveModel();
    res.json({ ok: true, model });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
