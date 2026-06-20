/**
 * Artist Enrichment Agent — Main Orchestrator
 * Coordinates the entire enrichment pipeline:
 * 1. Auto-enqueues unenriched artists
 * 2. Processes enrichment batches every 15 minutes
 * 3. Exports all functions for API routes
 */

export {
  collectArtistData,
  collectSpotifyData,
  collectInstagramData,
  collectYouTubeData,
  collectGoogleData,
} from './data-collector';

export {
  analyzeArtistData,
} from './profile-analyzer';

export {
  buildArtistProfile,
} from './profile-builder';

export {
  enqueueArtistEnrichment,
  processEnrichmentJob,
  processBatch,
  getQueueStats,
  getQueueItems,
  getArtistEnrichmentHistory,
  retryEnrichment,
  autoEnqueueUnenrichedArtists,
} from './enrichment-queue';

import { processBatch, autoEnqueueUnenrichedArtists, getQueueStats } from './enrichment-queue';

// ─── Scheduler ──────────────────────────────────────────────────

let enrichmentInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function enrichmentTick(): Promise<void> {
  if (isRunning) {
    console.log('[Enrichment] ⏭️ Skipping tick — previous batch still running');
    return;
  }

  isRunning = true;
  try {
    // Step 1: Auto-enqueue unenriched artists (up to 20 per tick)
    const enqueued = await autoEnqueueUnenrichedArtists(20);

    // Step 2: Process a batch of 5 artists
    const result = await processBatch(5);

    if (enqueued > 0 || result.processed > 0) {
      const stats = await getQueueStats();
      console.log(`[Enrichment] 📊 Tick complete — enqueued: ${enqueued}, processed: ${result.processed}, succeeded: ${result.succeeded}, pending: ${stats.pending}, total: ${stats.total}`);
    }
  } catch (err) {
    console.error('[Enrichment] Tick error:', err);
  } finally {
    isRunning = false;
  }
}

export function startEnrichmentScheduler(): void {
  if (enrichmentInterval) {
    console.log('[Enrichment] ⚠️ Scheduler already running');
    return;
  }

  console.log('🔍 [Enrichment] Starting artist enrichment scheduler (every 15 min)');
  console.log('  📊 Auto-enqueues unenriched artists + processes batches of 5');

  // Initial tick after 5 min delay (let server stabilize)
  setTimeout(() => {
    enrichmentTick();
  }, 5 * 60 * 1000);

  // Then every 15 minutes
  enrichmentInterval = setInterval(() => {
    enrichmentTick();
  }, 15 * 60 * 1000);
}

export function stopEnrichmentScheduler(): void {
  if (enrichmentInterval) {
    clearInterval(enrichmentInterval);
    enrichmentInterval = null;
    console.log('[Enrichment] ⏹️ Scheduler stopped');
  }
}
