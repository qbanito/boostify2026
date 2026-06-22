/**
 * Apify Client Pool — Automatic failover between primary and backup API keys
 * When primary key hits rate/usage limits, transparently retries with backup key.
 */

import { ApifyClient } from 'apify-client';

// ─── API Keys ────────────────────────────────────────────────────

const PRIMARY_TOKEN = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY || '';
const BACKUP_TOKEN = process.env.APIFY_API_TOKEN_BACKUP || '';

const primaryClient = PRIMARY_TOKEN ? new ApifyClient({ token: PRIMARY_TOKEN }) : null;
const backupClient = BACKUP_TOKEN ? new ApifyClient({ token: BACKUP_TOKEN }) : null;

// Track which key is currently "active" (preferred)
let activeKey: 'primary' | 'backup' = 'primary';
let primaryExhaustedAt: number | null = null;
const EXHAUSTION_COOLDOWN_MS = 6 * 60 * 60 * 1000; // Retry primary after 6h

// When BOTH keys are exhausted (or no keys exist) we mark a global cooldown so
// callers can skip Apify-dependent work entirely instead of hammering the API
// (and wasting time + OpenAI tokens on sources that can never scrape).
let bothExhaustedAt: number | null = null;
const BOTH_EXHAUSTION_COOLDOWN_MS = 60 * 60 * 1000; // Re-probe Apify after 1h

/**
 * True when Apify cannot currently run (no keys configured, or both keys hit
 * their quota within the cooldown window). Lets discovery fall back to the
 * non-Apify sources (youtube_api / spotify_api) without wasting work.
 */
export function isApifyExhausted(): boolean {
  if (!primaryClient && !backupClient) return true;
  if (bothExhaustedAt && Date.now() - bothExhaustedAt < BOTH_EXHAUSTION_COOLDOWN_MS) return true;
  return false;
}

/** Manually flag Apify as exhausted (used by sources that call Apify directly). */
export function markApifyExhausted(_msg?: string): void {
  bothExhaustedAt = Date.now();
}

/** Whether an error from a direct Apify call indicates quota/usage exhaustion. */
export function isApifyExhaustionError(err: any): boolean {
  return isExhausionError(err);
}

// ─── Stats ───────────────────────────────────────────────────────

interface PoolStats {
  primaryCalls: number;
  backupCalls: number;
  primaryErrors: number;
  backupErrors: number;
  failovers: number;
  lastFailoverAt: Date | null;
}

const stats: PoolStats = {
  primaryCalls: 0,
  backupCalls: 0,
  primaryErrors: 0,
  backupErrors: 0,
  failovers: 0,
  lastFailoverAt: null,
};

export function getPoolStats(): PoolStats & { activeKey: string; hasBackup: boolean } {
  return { ...stats, activeKey, hasBackup: !!BACKUP_TOKEN };
}

// ─── Detect exhaustion errors ────────────────────────────────────

function isExhausionError(err: any): boolean {
  const msg = (err?.message || err?.toString() || '').toLowerCase();
  return (
    msg.includes('usage hard limit') ||
    msg.includes('usage limit') ||
    msg.includes('rate limit') ||
    msg.includes('quota exceeded') ||
    msg.includes('insufficient') ||
    msg.includes('payment required') ||
    msg.includes('402') ||
    msg.includes('429')
  );
}

// ─── Run Actor with Failover ─────────────────────────────────────

/**
 * Run an Apify actor with automatic failover to backup key.
 * Same API as apifyClient.actor(actorId).call(input, options)
 */
export async function runActorWithFailover(
  actorId: string,
  input: Record<string, any>,
  options: { waitSecs?: number } = {},
): Promise<{ defaultDatasetId: string; client: ApifyClient }> {
  // Fast-fail when Apify is exhausted — avoids re-hammering hundreds of queries
  // against keys that are already over quota.
  if (isApifyExhausted()) {
    throw new Error('[ApifyPool] Skipped — Apify exhausted (cooldown active)');
  }

  // Check if primary should be retried after cooldown
  if (activeKey === 'backup' && primaryExhaustedAt) {
    if (Date.now() - primaryExhaustedAt > EXHAUSTION_COOLDOWN_MS) {
      console.log('[ApifyPool] Cooldown expired — trying primary key again');
      activeKey = 'primary';
      primaryExhaustedAt = null;
    }
  }

  // Determine order: active first, then fallback
  const clients: { label: 'primary' | 'backup'; client: ApifyClient | null }[] =
    activeKey === 'primary'
      ? [{ label: 'primary', client: primaryClient }, { label: 'backup', client: backupClient }]
      : [{ label: 'backup', client: backupClient }, { label: 'primary', client: primaryClient }];

  for (const { label, client } of clients) {
    if (!client) continue;

    try {
      const run = await client.actor(actorId).call(input, options);

      // Track success — clear any global exhaustion flag (Apify is alive again)
      if (label === 'primary') stats.primaryCalls++;
      else stats.backupCalls++;
      bothExhaustedAt = null;

      return { defaultDatasetId: run.defaultDatasetId, client };
    } catch (err: any) {
      const errMsg = err?.message?.slice(0, 200) || '';

      if (label === 'primary') stats.primaryErrors++;
      else stats.backupErrors++;

      if (isExhausionError(err)) {
        console.warn(`[ApifyPool] ${label} key exhausted: ${errMsg}`);

        if (label === 'primary') {
          primaryExhaustedAt = Date.now();
          activeKey = 'backup';
          stats.failovers++;
          stats.lastFailoverAt = new Date();
          console.log('[ApifyPool] ⚡ Failing over to BACKUP key');
          continue; // Try backup
        } else {
          // Both exhausted — flag a global cooldown so callers skip Apify work
          markApifyExhausted(errMsg);
          throw new Error(`[ApifyPool] Both primary and backup keys exhausted: ${errMsg}`);
        }
      }

      // Non-exhaustion error — just throw, don't failover
      throw err;
    }
  }

  throw new Error('[ApifyPool] No API keys available');
}

/**
 * Get dataset items using the client that produced the run
 */
export async function getDatasetItems(
  client: ApifyClient,
  datasetId: string,
): Promise<any[]> {
  const { items } = await client.dataset(datasetId).listItems();
  return items;
}

/**
 * Convenience: run actor and return items in one call
 */
export async function runActorAndGetItems(
  actorId: string,
  input: Record<string, any>,
  options: { waitSecs?: number } = {},
): Promise<any[]> {
  const { defaultDatasetId, client } = await runActorWithFailover(actorId, input, options);
  return getDatasetItems(client, defaultDatasetId);
}

// ─── Init Log ────────────────────────────────────────────────────

if (PRIMARY_TOKEN) {
  console.log(`[ApifyPool] Primary key: ...${PRIMARY_TOKEN.slice(-6)}`);
}
if (BACKUP_TOKEN) {
  console.log(`[ApifyPool] Backup key: ...${BACKUP_TOKEN.slice(-6)} (failover enabled)`);
} else {
  console.log('[ApifyPool] ⚠️ No backup key — single key mode');
}
