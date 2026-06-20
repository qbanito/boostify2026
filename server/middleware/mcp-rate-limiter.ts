/**
 * MCP Per-Category Rate Limiter
 *
 * Enforces per-tool-category request limits using an in-process sliding-window
 * algorithm (no Redis required).  Each counter bucket is keyed by:
 *   `${identity}:${category}`
 * where `identity` is the API-key prefix (if authenticated via an MCP API key)
 * or the client IP (for session/Clerk-authenticated browser requests).
 *
 * Window-clearing strategy: a rolling 1-minute window — requests older than
 * windowMs are discarded before every check (O(n) but list sizes are tiny).
 *
 * Category limits (requests per minute):
 *   artist-intelligence   → 60  (cheap Spotify/YT lookups)
 *   playlist-intelligence → 40
 *   chart-intelligence    → 40
 *   song-intelligence     → 40
 *   tour-intelligence     → 30
 *   content-creation      → 10  (expensive — AI generation)
 *   audio-analysis        → 10  (expensive — Whisper/BPM)
 *   voice-ai              → 5   (very expensive — voice cloning)
 *   distribution          → 20
 *   default               → 30  (fallback for any unlisted category)
 *
 * All limits are multiplied by the `rateLimit` multiplier stored on the
 * caller's MCP API key (default multiplier = 1.0 for keys with limit=60).
 * Browser sessions always use a multiplier of 1.0.
 */

import { Request, Response, NextFunction } from 'express';

// ─── Category rate-limit table ───────────────────────────────────────────────

export type ToolCategory =
  | 'artist-intelligence'
  | 'playlist-intelligence'
  | 'chart-intelligence'
  | 'song-intelligence'
  | 'tour-intelligence'
  | 'content-creation'
  | 'audio-analysis'
  | 'voice-ai'
  | 'distribution';

/** Requests per minute for each category (baseline, multiplier=1). */
export const CATEGORY_RPM: Readonly<Record<ToolCategory | 'default', number>> = {
  'artist-intelligence':   60,
  'playlist-intelligence': 40,
  'chart-intelligence':    40,
  'song-intelligence':     40,
  'tour-intelligence':     30,
  'content-creation':      10,
  'audio-analysis':        10,
  'voice-ai':               5,
  'distribution':          20,
  'default':               30,
} as const;

const WINDOW_MS = 60_000; // 1 minute

// ─── Sliding-window store ────────────────────────────────────────────────────

/** Maps `identity:category` → sorted list of request timestamps (ms). */
const store = new Map<string, number[]>();

/** Purge entries that have aged out of the window. */
function purge(timestamps: number[], now: number): number[] {
  const cutoff = now - WINDOW_MS;
  // Remove all entries older than the window start.
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) i++;
  return i > 0 ? timestamps.slice(i) : timestamps;
}

/**
 * Check the current count for `key` and record a new hit if not over limit.
 * Returns `{ allowed: boolean; current: number; limit: number; resetInMs: number }`.
 */
function checkAndRecord(
  key: string,
  limit: number,
): { allowed: boolean; current: number; limit: number; resetInMs: number } {
  const now = Date.now();
  const raw = store.get(key) ?? [];
  const timestamps = purge(raw, now);

  const current = timestamps.length;

  if (current >= limit) {
    // Return ms until the oldest entry ages out
    const resetInMs = timestamps[0] ? timestamps[0] + WINDOW_MS - now : WINDOW_MS;
    store.set(key, timestamps);
    return { allowed: false, current, limit, resetInMs: Math.max(0, resetInMs) };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, current: current + 1, limit, resetInMs: WINDOW_MS };
}

// ─── Store housekeeping ─────────────────────────────────────────────────────

/** Remove completely empty / expired keys every 5 minutes to prevent leaks. */
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store.entries()) {
    const fresh = purge(timestamps, now);
    if (fresh.length === 0) {
      store.delete(key);
    } else {
      store.set(key, fresh);
    }
  }
}, 5 * 60_000);

// ─── Public inspection helpers ──────────────────────────────────────────────

export interface CategoryStats {
  category: string;
  limit: number;
  windowMs: number;
  description: string;
}

export function getCategoryLimits(): CategoryStats[] {
  return Object.entries(CATEGORY_RPM).map(([category, limit]) => ({
    category,
    limit,
    windowMs: WINDOW_MS,
    description: getCategoryDescription(category),
  }));
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'artist-intelligence':   'Artist search, stats, growth analysis, competitors (Spotify/YouTube data)',
    'playlist-intelligence': 'Editorial placements, active playlists, global playlist search',
    'chart-intelligence':    'Music chart rankings and available chart listings',
    'song-intelligence':     'Song DNA, audio features, market potential, audience demographics',
    'tour-intelligence':     'Opening act search, festival discovery, market analysis',
    'content-creation':      'AI music generation, cover art generation (expensive — AI calls)',
    'audio-analysis':        'Audio BPM/key analysis, Whisper transcription (expensive)',
    'voice-ai':              'Voice cloning from audio samples (very expensive)',
    'distribution':          'Music distribution submissions to streaming platforms',
    'default':               'General fallback for uncategorized tools',
  };
  return descriptions[category] ?? 'Unknown category';
}

/** Return the current window usage for a given identity across all categories. */
export function getUsageSnapshot(identity: string): Record<string, { used: number; limit: number }> {
  const now = Date.now();
  const result: Record<string, { used: number; limit: number }> = {};
  for (const [cat, limit] of Object.entries(CATEGORY_RPM)) {
    const key = `${identity}:${cat}`;
    const raw = store.get(key) ?? [];
    const fresh = purge(raw, now);
    result[cat] = { used: fresh.length, limit };
  }
  return result;
}

// ─── Identity helpers ───────────────────────────────────────────────────────

function resolveIdentity(req: Request): string {
  // API-key callers use the key prefix (set by mcpAuth middleware).
  if (req.mcpApiKey?.keyPrefix) return `apikey:${req.mcpApiKey.keyPrefix}`;
  // Session / Clerk callers use their IP.
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.ip ??
    'unknown';
  return `ip:${ip}`;
}

/**
 * Compute the effective per-minute limit for a category, factoring in the
 * API-key's rateLimit value (keys have rateLimit=60 as default = 1× baseline).
 *
 * Multiplier = keyRateLimit / 60  (so a key with 120 gets 2×, one with 30 gets 0.5×)
 */
function effectiveLimit(category: string, req: Request): number {
  const baseline = CATEGORY_RPM[category as ToolCategory] ?? CATEGORY_RPM['default'];
  if (!req.mcpApiKey) return baseline;
  const multiplier = req.mcpApiKey.rateLimit / 60;
  return Math.max(1, Math.round(baseline * multiplier));
}

// ─── Middleware factory ──────────────────────────────────────────────────────

/**
 * `mcpCategoryRateLimit(getCategory)`
 *
 * Returns an Express middleware that enforces the per-category rate limit.
 *
 * `getCategory` is a function that extracts the tool category from the request.
 * It receives the full `Request` and should return a category string or `null`
 * when the category cannot be determined (limit is then applied as 'default').
 */
export function mcpCategoryRateLimit(
  getCategory: (req: Request) => string | null,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawCategory = getCategory(req) ?? 'default';
    const category = rawCategory in CATEGORY_RPM ? rawCategory : 'default';

    const identity = resolveIdentity(req);
    const limit    = effectiveLimit(category, req);
    const key      = `${identity}:${category}`;

    const { allowed, current, resetInMs } = checkAndRecord(key, limit);

    // Always expose rate-limit headers (same shape as express-rate-limit)
    res.setHeader('X-RateLimit-Category',   category);
    res.setHeader('X-RateLimit-Limit',      limit);
    res.setHeader('X-RateLimit-Remaining',  Math.max(0, limit - current));
    res.setHeader('X-RateLimit-Reset',      Math.ceil((Date.now() + resetInMs) / 1000));
    res.setHeader('Retry-After',            allowed ? '' : Math.ceil(resetInMs / 1000));

    if (!allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        category,
        limit,
        retryAfterMs: resetInMs,
        retryAfterSeconds: Math.ceil(resetInMs / 1000),
        message: `Too many requests in this category (${category}). Limit: ${limit} req/min.`,
      });
      return;
    }

    next();
  };
}

// ─── Pre-built middleware for /execute and /sse/execute ─────────────────────

/**
 * Resolves the tool category from the request body's `tool` field.
 * Used by POST /execute and POST /sse/execute.
 */
function categoryFromBody(req: Request): string | null {
  const toolName = req.body?.tool;
  if (typeof toolName !== 'string') return null;
  // Avoid importing MCP_TOOLS here to prevent a circular dep — use a minimal map.
  return TOOL_CATEGORY_MAP[toolName] ?? null;
}

/**
 * Flat tool-name → category map.
 * This avoids a circular import of MCP_TOOLS from mcp-server.ts.
 */
const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  // artist-intelligence
  search_artist:              'artist-intelligence',
  get_artist_stats:           'artist-intelligence',
  get_geographic_data:        'artist-intelligence',
  analyze_growth_rates:       'artist-intelligence',
  find_similar_artists:       'artist-intelligence',
  find_genre_competitors:     'artist-intelligence',
  get_career_stage:           'artist-intelligence',
  // playlist-intelligence
  find_editorial_placements:  'playlist-intelligence',
  get_active_playlists:       'playlist-intelligence',
  search_playlists:           'playlist-intelligence',
  // chart-intelligence
  get_available_charts:       'chart-intelligence',
  get_chart_ranking:          'chart-intelligence',
  // song-intelligence
  resolve_song:               'song-intelligence',
  get_song_metadata:          'song-intelligence',
  get_song_performance:       'song-intelligence',
  get_audio_features:         'song-intelligence',
  get_audience_demographics:  'song-intelligence',
  analyze_market_potential:   'song-intelligence',
  match_song_across_platforms:'song-intelligence',
  predict_hit_potential:      'song-intelligence',
  // tour-intelligence
  find_opening_acts_local:    'tour-intelligence',
  find_opening_acts_strategic:'tour-intelligence',
  search_festivals:           'tour-intelligence',
  get_upcoming_festivals:     'tour-intelligence',
  get_artist_live_events:     'tour-intelligence',
  get_nearby_live_events:     'tour-intelligence',
  get_live_event_sources:     'tour-intelligence',
  optimize_tour_route:        'tour-intelligence',
  // content-creation
  generate_music:             'content-creation',
  generate_cover_art:         'content-creation',
  // audio-analysis
  analyze_audio:              'audio-analysis',
  transcribe_audio:           'audio-analysis',
  // voice-ai
  clone_voice:                'voice-ai',
  // distribution
  distribute_music:           'distribution',
};

/** Ready-to-use middleware — reads category from `req.body.tool`. */
export const mcpBodyCategoryRateLimit = mcpCategoryRateLimit(categoryFromBody);
