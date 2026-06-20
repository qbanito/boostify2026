/**
 * Artist Discovery Engine — Main Orchestrator
 * Coordinates all discovery sources, runs on schedule, and tracks results.
 * Target: 10,000+ new artist contacts per week.
 * 
 * Schedule: Runs every 6 hours (4x/day) with rotating sources.
 * Each run targets ~400-700 new contacts → 1,600-2,800/day → 11,200-19,600/week
 */

import crypto from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { discoverSpotifyArtists } from './source-apify-spotify';
import { discoverBandcampArtists } from './source-apify-bandcamp';
import { discoverGoogleAIArtists } from './source-google-ai';
import { discoverInstagramArtists } from './source-apify-instagram';
import { discoverSoundCloudArtists } from './source-apify-soundcloud';
import { discoverYouTubeArtists } from './source-apify-youtube';
import { discoverTikTokArtists } from './source-apify-tiktok';
import { discoverYouTubeApiArtists } from './source-youtube-api';
import { discoverSpotifyApiArtists } from './source-spotify-api';
import { ingestArtists, type IngestionResult } from './ingestion-pipeline';
import { getOptimizedSources } from './agent-autonomy';

// ─── Types ───────────────────────────────────────────────────────

export type DiscoverySource = 'spotify' | 'bandcamp' | 'google_ai' | 'instagram' | 'soundcloud' | 'youtube' | 'tiktok' | 'youtube_api' | 'spotify_api';

export interface DiscoveryRunResult {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  sources: {
    source: DiscoverySource;
    rawLeads: number;
    ingestionResult: IngestionResult;
    durationMs: number;
    error?: string;
  }[];
  totals: {
    rawLeads: number;
    inserted: number;
    duplicates: number;
    invalid: number;
  };
}

export interface DiscoveryConfig {
  sources?: DiscoverySource[];
  dryRun?: boolean;
  maxCountries?: number;
}

// ─── Run History (in-memory, last 50 runs) ───────────────────────
const runHistory: DiscoveryRunResult[] = [];
const MAX_HISTORY = 50;

export function getRunHistory(): DiscoveryRunResult[] {
  return runHistory;
}

export function getLastRun(): DiscoveryRunResult | null {
  return runHistory[0] || null;
}

// ─── Source rotation logic ───────────────────────────────────────
// Dynamic: uses ROI-weighted optimization from agent-autonomy
// Fallback: hardcoded rotation for when no ROI data exists yet
let runCounter = 0;

function getHardcodedSources(): DiscoverySource[] {
  runCounter++;
  const cycle = runCounter % 4;

  // Always include non-Apify sources (youtube_api, spotify_api) so we keep
  // ingesting leads even when Apify quotas are exhausted.
  switch (cycle) {
    case 1: return ['youtube_api', 'spotify', 'google_ai', 'soundcloud', 'youtube'];
    case 2: return ['spotify_api', 'bandcamp', 'instagram', 'google_ai', 'tiktok'];
    case 3: return ['youtube_api', 'spotify', 'bandcamp', 'instagram', 'youtube'];
    case 0: return ['youtube_api', 'spotify_api', 'google_ai', 'soundcloud', 'spotify', 'bandcamp', 'instagram', 'youtube', 'tiktok'];
    default: return ['youtube_api', 'spotify_api'];
  }
}

async function getSourcesForRun(): Promise<DiscoverySource[]> {
  try {
    const optimized = await getOptimizedSources();
    if (optimized.sources.length > 0) {
      console.log(`[Discovery] Using optimized sources: ${optimized.sources.join(', ')} — ${optimized.reasoning}`);
      return optimized.sources as DiscoverySource[];
    }
  } catch (err) {
    // Fallback to hardcoded rotation
  }
  return getHardcodedSources();
}

// ─── Main Discovery Run ──────────────────────────────────────────

export async function runDiscovery(config: DiscoveryConfig = {}): Promise<DiscoveryRunResult> {
  const defaultSources = config.sources || await getSourcesForRun();
  const {
    sources = defaultSources,
    dryRun = false,
    maxCountries = 15,
  } = config;

  const runId = `disc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const startedAt = new Date();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 [ArtistDiscovery] Starting run ${runId}`);
  console.log(`📋 Sources: ${sources.join(', ')}`);
  console.log(`🌎 Max countries: ${maxCountries}`);
  console.log(`${'═'.repeat(60)}\n`);

  const result: DiscoveryRunResult = {
    runId,
    startedAt,
    completedAt: new Date(),
    sources: [],
    totals: { rawLeads: 0, inserted: 0, duplicates: 0, invalid: 0 },
  };

  for (const source of sources) {
    const sourceStart = Date.now();
    let rawLeads: any[] = [];
    let ingestionResult: IngestionResult = { total: 0, inserted: 0, duplicates: 0, invalid: 0, errors: [] };
    let error: string | undefined;

    try {
      console.log(`\n🎯 [ArtistDiscovery] Running source: ${source}`);

      switch (source) {
        case 'spotify':
          rawLeads = await discoverSpotifyArtists({ maxResultsPerQuery: 50 });
          break;
        case 'bandcamp':
          rawLeads = await discoverBandcampArtists({ maxResultsPerQuery: 50 });
          break;
        case 'google_ai':
          rawLeads = await discoverGoogleAIArtists({ maxCountries, useAI: true });
          break;
        case 'instagram':
          rawLeads = await discoverInstagramArtists({ maxHashtags: 10, maxPostsPerHashtag: 30 });
          break;
        case 'soundcloud':
          rawLeads = await discoverSoundCloudArtists({ maxQueries: 15 });
          break;
        case 'youtube':
          rawLeads = await discoverYouTubeArtists({ maxQueries: 20 });
          break;
        case 'tiktok':
          rawLeads = await discoverTikTokArtists({ maxQueries: 15 });
          break;
        case 'youtube_api':
          rawLeads = await discoverYouTubeApiArtists({ maxQueries: 10, maxResultsPerQuery: 25 });
          break;
        case 'spotify_api':
          rawLeads = await discoverSpotifyApiArtists({ maxQueries: 8, maxResultsPerQuery: 30 });
          break;
      }

      console.log(`  📊 Raw leads from ${source}: ${rawLeads.length}`);

      if (!dryRun && rawLeads.length > 0) {
        const batchId = `${runId}_${source}`;
        ingestionResult = await ingestArtists(rawLeads, `apify_${source}`, batchId);
        console.log(`  ✅ Inserted: ${ingestionResult.inserted}, Dupes: ${ingestionResult.duplicates}, Invalid: ${ingestionResult.invalid}`);
      }
    } catch (err: any) {
      error = err.message?.slice(0, 300);
      console.error(`  ❌ Source ${source} failed:`, error);
    }

    const durationMs = Date.now() - sourceStart;

    result.sources.push({
      source,
      rawLeads: rawLeads.length,
      ingestionResult,
      durationMs,
      error,
    });

    result.totals.rawLeads += rawLeads.length;
    result.totals.inserted += ingestionResult.inserted;
    result.totals.duplicates += ingestionResult.duplicates;
    result.totals.invalid += ingestionResult.invalid;
  }

  result.completedAt = new Date();
  const totalDuration = result.completedAt.getTime() - startedAt.getTime();

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ [ArtistDiscovery] Run ${runId} complete`);
  console.log(`📊 Raw: ${result.totals.rawLeads} | Inserted: ${result.totals.inserted} | Dupes: ${result.totals.duplicates} | Invalid: ${result.totals.invalid}`);
  console.log(`⏱️  Duration: ${Math.round(totalDuration / 1000)}s`);
  console.log(`${'═'.repeat(60)}\n`);

  // Save to history
  runHistory.unshift(result);
  if (runHistory.length > MAX_HISTORY) runHistory.pop();

  return result;
}

// ─── Get current DB stats ────────────────────────────────────────

export async function getDiscoveryStats() {
  try {
    const [totalResult, bySourceResult, byCountryResult, recentResult] = await Promise.all([
      db.execute(sql`SELECT count(*) as total FROM music_industry_contacts`),
      db.execute(sql`SELECT import_source, count(*) as cnt FROM music_industry_contacts GROUP BY import_source ORDER BY cnt DESC LIMIT 20`),
      db.execute(sql`SELECT country, count(*) as cnt FROM music_industry_contacts WHERE country IS NOT NULL GROUP BY country ORDER BY cnt DESC LIMIT 30`),
      db.execute(sql`SELECT count(*) as cnt FROM music_industry_contacts WHERE created_at > NOW() - INTERVAL '7 days'`),
    ]);

    return {
      totalContacts: parseInt(totalResult.rows[0]?.total as string || '0'),
      addedThisWeek: parseInt(recentResult.rows[0]?.cnt as string || '0'),
      bySource: bySourceResult.rows,
      byCountry: byCountryResult.rows,
      lastRun: getLastRun(),
      runHistory: runHistory.slice(0, 10),
    };
  } catch (err) {
    console.error('[ArtistDiscovery] Stats error:', err);
    return { totalContacts: 0, addedThisWeek: 0, bySource: [], byCountry: [], lastRun: null, runHistory: [] };
  }
}

// ─── Scheduler ───────────────────────────────────────────────────

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function startDiscoveryScheduler() {
  if (schedulerInterval) {
    console.log('[ArtistDiscovery] Scheduler already running');
    return;
  }

  console.log('🔍 [ArtistDiscovery] Starting discovery scheduler (every 6 hours)');
  console.log(`  🎯 Target: 10,000+ new artists/week`);

  // First run after 2 minutes (let server boot)
  setTimeout(async () => {
    if (!isRunning) {
      isRunning = true;
      try {
        await runDiscovery();
      } catch (err) {
        console.error('[ArtistDiscovery] Scheduled run error:', err);
      } finally {
        isRunning = false;
      }
    }
  }, 2 * 60 * 1000);

  // Then every 6 hours
  schedulerInterval = setInterval(async () => {
    if (isRunning) {
      console.log('[ArtistDiscovery] Skipping — previous run still in progress');
      return;
    }
    isRunning = true;
    try {
      await runDiscovery();
    } catch (err) {
      console.error('[ArtistDiscovery] Scheduled run error:', err);
    } finally {
      isRunning = false;
    }
  }, SIX_HOURS_MS);
}

export function stopDiscoveryScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[ArtistDiscovery] Scheduler stopped');
  }
}

export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}

export function isDiscoveryInProgress(): boolean {
  return isRunning;
}
