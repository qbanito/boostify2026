/**
 * Artist Activation Engine — Main Orchestrator
 * Automates the entire funnel: Discovery → Email → Onboard → Convert → Expand
 * 
 * Target: 50,000 active artists by end of 2026
 * 
 * Runs every 30 minutes:
 * 1. Auto-enroll new discovery contacts into welcome_cold drip
 * 2. Process drip queue (send due emails)
 * 3. Process segment transitions (cold→warm→hot)
 * 4. Detect inactive users → win-back sequences
 * 5. Detect engaged users → referral push
 */

import { processDripQueue, autoEnrollNewContacts, getDripStats, enrollInSequence } from './drip-engine';
import {
  processSegmentTransitions,
  detectInactiveForWinBack,
  detectEngagedForReferral,
  getConversionFunnel,
} from './conversion-intelligence';
import { trackEvent, getActivationStats, getScoreByEmail, getHotLeads, generateMagicLink, generateClaimLink, verifyMagicLink, verifyUnsubscribeToken } from './activation-tracker';
import { rescoreEngagedLeads } from '../artist-discovery/hunter-scoring';
import { aiBatchScoreLeads, getAgentBrainStats } from '../artist-discovery/agent-brain';
import { processGoalTick, getGoalsDashboard, evaluateWeeklyPerformance, computeSourceROI, getSourceROI } from '../artist-discovery/agent-goals';
import {
  processAutonomyTick as runAutonomyTick,
  getAutonomyDashboard,
  getABTestSummary,
  createSubjectLineTest,
  getHealthHistory,
  trainPredictiveModel,
} from '../artist-discovery/agent-autonomy';

// ─── Re-exports ──────────────────────────────────────────────────

export {
  // Drip engine
  processDripQueue,
  autoEnrollNewContacts,
  getDripStats,
  enrollInSequence,
  // Conversion intelligence
  processSegmentTransitions,
  detectInactiveForWinBack,
  detectEngagedForReferral,
  getConversionFunnel,
  // Activation tracker
  trackEvent,
  getActivationStats,
  getScoreByEmail,
  getHotLeads,
  generateMagicLink,
  generateClaimLink,
  verifyMagicLink,
  verifyUnsubscribeToken,
  // Agent Brain (AI)
  aiBatchScoreLeads,
  getAgentBrainStats,
  // Goal Engine
  processGoalTick,
  getGoalsDashboard,
  evaluateWeeklyPerformance,
  computeSourceROI,
  getSourceROI,
  // Autonomy Engine (Phase 4)
  getAutonomyDashboard,
  getABTestSummary,
  createSubjectLineTest,
  getHealthHistory,
  trainPredictiveModel,
};

// ─── Run History ─────────────────────────────────────────────────

interface ActivationRunResult {
  timestamp: Date;
  enrolled: number;
  emailsSent: number;
  emailErrors: number;
  sequencesCompleted: number;
  segmentTransitions: number;
  winBackEnrolled: number;
  referralEnrolled: number;
  durationMs: number;
}

const runHistory: ActivationRunResult[] = [];
const MAX_HISTORY = 100;

export function getActivationRunHistory(): ActivationRunResult[] {
  return runHistory;
}

// ─── Main Processing Tick ────────────────────────────────────────

let isProcessing = false;
let lastRescoreAt = 0; // Track when we last ran a full re-score
let lastAiScoreAt = 0; // Track when we last ran AI scoring
let lastGoalTickAt = 0; // Track when we last ran goal evaluation
let lastAutonomyTickAt = 0; // Track when we last ran autonomy tick
const RESCORE_INTERVAL_MS = 4 * 60 * 60 * 1000; // Re-score every 4 hours
const AI_SCORE_INTERVAL_MS = 8 * 60 * 60 * 1000; // AI-score every 8 hours
const GOAL_TICK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Goal tick every 6 hours
const AUTONOMY_TICK_INTERVAL_MS = 12 * 60 * 60 * 1000; // Autonomy tick every 12 hours

export async function processActivationTick(): Promise<ActivationRunResult> {
  if (isProcessing) {
    console.log('[Activation] Skipping — previous tick still running');
    return runHistory[0] || { timestamp: new Date(), enrolled: 0, emailsSent: 0, emailErrors: 0, sequencesCompleted: 0, segmentTransitions: 0, winBackEnrolled: 0, referralEnrolled: 0, durationMs: 0 };
  }

  isProcessing = true;
  const start = Date.now();

  try {
    console.log('\n🎯 [Activation] Starting activation tick...');

    // 1. Auto-enroll new contacts
    const enrolled = await autoEnrollNewContacts(200);

    // 2. Process drip queue
    const dripResult = await processDripQueue(100);

    // 3. Process segment transitions
    const transitions = await processSegmentTransitions(200);

    // 4. Detect inactive users for win-back
    const winBack = await detectInactiveForWinBack();

    // 5. Detect engaged users for referral
    const referral = await detectEngagedForReferral();

    // 6. Periodic re-scoring (every 4h) — update scores with real engagement data
    let rescored = 0;
    if (Date.now() - lastRescoreAt > RESCORE_INTERVAL_MS) {
      const rescoreResult = await rescoreEngagedLeads(500);
      rescored = rescoreResult.rescored;
      lastRescoreAt = Date.now();
    }

    // 7. AI batch scoring (every 8h) — GPT-enhanced scoring for B-tier+ leads
    let aiScored = 0;
    if (Date.now() - lastAiScoreAt > AI_SCORE_INTERVAL_MS) {
      const aiResult = await aiBatchScoreLeads(20); // 20 leads per batch to control API costs
      aiScored = aiResult.scored;
      lastAiScoreAt = Date.now();
    }

    // 8. Goal engine tick (every 6h) — update KPIs, evaluate past week, compute source ROI
    let goalsUpdated = false;
    let goalEvaluated = false;
    if (Date.now() - lastGoalTickAt > GOAL_TICK_INTERVAL_MS) {
      const goalResult = await processGoalTick();
      goalsUpdated = goalResult.goalsUpdated;
      goalEvaluated = goalResult.evaluated;
      lastGoalTickAt = Date.now();
    }

    const result: ActivationRunResult = {
      timestamp: new Date(),
      enrolled,
      emailsSent: dripResult.sent,
      emailErrors: dripResult.errors,
      sequencesCompleted: dripResult.completed,
      segmentTransitions: transitions,
      winBackEnrolled: winBack,
      referralEnrolled: referral,
      durationMs: Date.now() - start,
    };

    // Save to history
    runHistory.unshift(result);
    if (runHistory.length > MAX_HISTORY) runHistory.pop();

    // 9. Autonomy tick (every 12h) — A/B tests, self-healing, predictive model, source optimization
    let autonomyRan = false;
    if (Date.now() - lastAutonomyTickAt > AUTONOMY_TICK_INTERVAL_MS) {
      try {
        const autonomyResult = await runAutonomyTick();
        autonomyRan = true;
        lastAutonomyTickAt = Date.now();
        console.log(`  🤖 [Autonomy] evaluated:${autonomyResult.abTestsEvaluated} health:${autonomyResult.healthChecks.length} healed:${autonomyResult.selfHealed}`);
      } catch (err) {
        console.error('[Activation] Autonomy tick error (non-fatal):', err);
      }
    }

    console.log(`✅ [Activation] Tick done in ${result.durationMs}ms — enrolled:${enrolled} sent:${dripResult.sent} transitions:${transitions} rescored:${rescored} ai:${aiScored}${goalsUpdated ? ' goals:✓' : ''}${goalEvaluated ? ' eval:✓' : ''}${autonomyRan ? ' autonomy:✓' : ''}`);
    return result;
  } catch (err) {
    console.error('[Activation] Tick error:', err);
    const emptyResult: ActivationRunResult = {
      timestamp: new Date(), enrolled: 0, emailsSent: 0, emailErrors: 0,
      sequencesCompleted: 0, segmentTransitions: 0, winBackEnrolled: 0,
      referralEnrolled: 0, durationMs: Date.now() - start,
    };
    return emptyResult;
  } finally {
    isProcessing = false;
  }
}

// ─── Scheduler (every 30 minutes) ────────────────────────────────

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startActivationScheduler() {
  if (schedulerInterval) {
    console.log('[Activation] Scheduler already running');
    return;
  }

  console.log('🎯 [Activation] Starting activation scheduler (every 30 minutes)');
  console.log('   📊 Target: 50,000 active artists by end of 2026');

  // First run after 3 minutes (let server boot fully)
  setTimeout(() => {
    processActivationTick().catch(err => console.error('[Activation] Initial tick error:', err));
  }, 3 * 60 * 1000);

  // Then every 30 minutes
  schedulerInterval = setInterval(() => {
    processActivationTick().catch(err => console.error('[Activation] Scheduled tick error:', err));
  }, THIRTY_MINUTES_MS);
}

export function stopActivationScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Activation] Scheduler stopped');
  }
}

export function isActivationSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

export function isActivationProcessing(): boolean {
  return isProcessing;
}

// ─── Combined Stats ──────────────────────────────────────────────

export async function getFullActivationDashboard() {
  const [activationStats, dripStats, funnel] = await Promise.all([
    getActivationStats(),
    getDripStats(),
    getConversionFunnel(),
  ]);

  return {
    scheduler: {
      running: isActivationSchedulerRunning(),
      processing: isActivationProcessing(),
    },
    activation: activationStats,
    drip: dripStats,
    funnel,
    recentRuns: runHistory.slice(0, 10),
  };
}
