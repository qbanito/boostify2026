/**
 * Cultural Context Builder
 *
 * Converts an artist's masterJson + profile into a list of search plans
 * that drive the Amazon PA-API. Strategy:
 *
 *   1. Country pack       (static — guaranteed coherent)
 *   2. Genre pack(s)      (static)
 *   3. OpenAI booster     (optional, on-demand — adds 4-6 unique queries
 *                          tailored to bio / aesthetic / mood)
 *   4. Universal fallback (only if 1-3 produced nothing)
 *
 * Each query is mapped to a Amazon SearchIndex when known, otherwise 'All'.
 * Output is deduplicated and capped at MAX_PLANS to keep PA-API spend bounded.
 */

import OpenAI from 'openai';
import {
  CULTURAL_PACKS,
  GENRE_PACKS,
  UNIVERSAL_FALLBACK,
  getCountryPack,
  getGenrePack,
  type KeywordEntry,
} from './cultural-packs';
import type { PaapiSearchIndex } from './paapi';
import { PRIMARY_MODEL } from '../../utils/ai-config';

export interface ArtistContextInput {
  artistId: number;
  name?: string | null;
  country?: string | null;
  genre?: string | null;
  genres?: string[] | null;
  biography?: string | null;
  masterJson?: any;
  aiBoosterEnabled?: boolean;
}

export interface SearchPlan {
  keywords: string;
  searchIndex: PaapiSearchIndex;
  /** Higher = surface earlier */
  priority: number;
  /** 'static' | 'ai' for analytics */
  source: 'country' | 'genre' | 'ai' | 'fallback';
}

const MAX_PLANS = 10; // ≤10 PA-API calls / artist refresh
const MAX_AI_QUERIES = 6;

// ── In-memory cache for the AI booster (24h) ────────────────────────────────
interface AiCacheEntry {
  queries: KeywordEntry[];
  expiresAt: number;
}
const aiCache = new Map<number, AiCacheEntry>();
const AI_TTL_MS = 24 * 60 * 60 * 1000;

// ────────────────────────────────────────────────────────────────────────────

function dedup(entries: KeywordEntry[]): KeywordEntry[] {
  const seen = new Set<string>();
  const out: KeywordEntry[] = [];
  for (const e of entries) {
    const key = e.q.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function pickN<T>(arr: T[], n: number): T[] {
  // Stable shuffle: deterministic for same length, but rotates per call
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function extractAestheticHints(masterJson: any): {
  aesthetic?: string;
  mood?: string;
  themes?: string[];
} {
  if (!masterJson || typeof masterJson !== 'object') return {};
  const md = masterJson;
  return {
    aesthetic:
      md.aesthetic ||
      md.visual?.aesthetic ||
      md.identity?.aesthetic ||
      md.brandIdentity?.aesthetic,
    mood: md.mood || md.audio?.mood || md.musicalIdentity?.mood,
    themes:
      md.themes ||
      md.lyrics?.themes ||
      md.musicalIdentity?.themes ||
      md.identity?.themes,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// OpenAI keyword booster
// ────────────────────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const VALID_INDEXES: PaapiSearchIndex[] = [
  'All', 'Apparel', 'Books', 'Electronics', 'HomeAndKitchen',
  'MusicalInstruments', 'Music', 'OfficeProducts', 'Beauty', 'Toys',
  'VideoGames', 'Jewelry', 'Software', 'GardenAndOutdoor', 'ArtsAndCrafts',
];

async function generateAiQueries(
  ctx: ArtistContextInput,
): Promise<KeywordEntry[]> {
  const openai = getOpenAI();
  if (!openai) return [];

  // Cache hit?
  const cached = aiCache.get(ctx.artistId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.queries;
  }

  const hints = extractAestheticHints(ctx.masterJson);
  const profileSummary = [
    ctx.name && `Name: ${ctx.name}`,
    ctx.genre && `Primary genre: ${ctx.genre}`,
    ctx.genres?.length && `All genres: ${ctx.genres.join(', ')}`,
    ctx.country && `Country: ${ctx.country}`,
    hints.aesthetic && `Aesthetic: ${hints.aesthetic}`,
    hints.mood && `Mood: ${hints.mood}`,
    hints.themes?.length && `Themes: ${hints.themes.slice(0, 5).join(', ')}`,
    ctx.biography && `Bio (truncated): ${String(ctx.biography).slice(0, 400)}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (!profileSummary.trim()) return [];

  const prompt = `You are a curator generating Amazon product search queries for a music artist's storefront. Given the artist context below, return ${MAX_AI_QUERIES} short, search-friendly Amazon queries (3-6 words each) for *physical products* that would resonate with this artist's fans and cultural identity.

ARTIST CONTEXT:
${profileSummary}

RULES:
- Mix categories: clothing, books, decor, instruments, accessories, beauty/lifestyle.
- Avoid duplicates of generic items already implied by the genre alone.
- Each query must be a real searchable noun phrase a shopper would type.
- Prefer cultural specificity over genericity.
- For each query, pick ONE Amazon SearchIndex from this list: ${VALID_INDEXES.join(', ')}

Respond with ONLY a JSON array, no markdown, in this exact shape:
[{"q": "...", "searchIndex": "..."}, ...]`;

  try {
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[amazon-context] AI booster returned non-JSON, skipping');
      return [];
    }

    // Accept either [{...}] or { queries: [{...}] }
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.queries)
      ? parsed.queries
      : Array.isArray(parsed?.results)
      ? parsed.results
      : [];

    const cleaned: KeywordEntry[] = arr
      .filter((x: any) => x && typeof x.q === 'string' && x.q.length > 2)
      .slice(0, MAX_AI_QUERIES)
      .map((x: any) => ({
        q: String(x.q).trim().slice(0, 120),
        searchIndex: VALID_INDEXES.includes(x.searchIndex) ? x.searchIndex : 'All',
      }));

    aiCache.set(ctx.artistId, {
      queries: cleaned,
      expiresAt: Date.now() + AI_TTL_MS,
    });

    return cleaned;
  } catch (err: any) {
    console.warn(
      '[amazon-context] AI booster failed (degrading to static packs):',
      err?.message ?? err,
    );
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main builder
// ────────────────────────────────────────────────────────────────────────────

export async function buildSearchPlans(
  ctx: ArtistContextInput,
): Promise<SearchPlan[]> {
  const plans: SearchPlan[] = [];
  const sourceMap = new Map<string, SearchPlan['source']>();

  // 1. Country pack — top priority (cultural anchor)
  const countryEntries = getCountryPack(ctx.country);
  for (const e of pickN(countryEntries, 4)) {
    const key = e.q.toLowerCase();
    if (!sourceMap.has(key)) {
      sourceMap.set(key, 'country');
      plans.push({
        keywords: e.q,
        searchIndex: e.searchIndex ?? 'All',
        priority: 100,
        source: 'country',
      });
    }
  }

  // 2. Genre pack(s)
  const genreList = [
    ctx.genre,
    ...(Array.isArray(ctx.genres) ? ctx.genres : []),
  ].filter(Boolean) as string[];

  for (const g of genreList.slice(0, 2)) {
    for (const e of pickN(getGenrePack(g), 3)) {
      const key = e.q.toLowerCase();
      if (!sourceMap.has(key)) {
        sourceMap.set(key, 'genre');
        plans.push({
          keywords: e.q,
          searchIndex: e.searchIndex ?? 'All',
          priority: 80,
          source: 'genre',
        });
      }
    }
  }

  // 3. AI booster
  if (ctx.aiBoosterEnabled !== false) {
    const aiEntries = await generateAiQueries(ctx);
    for (const e of aiEntries) {
      const key = e.q.toLowerCase();
      if (!sourceMap.has(key)) {
        sourceMap.set(key, 'ai');
        plans.push({
          keywords: e.q,
          searchIndex: e.searchIndex ?? 'All',
          priority: 90,
          source: 'ai',
        });
      }
    }
  }

  // 4. Fallback only if we have nothing
  if (plans.length === 0) {
    for (const e of UNIVERSAL_FALLBACK.slice(0, 6)) {
      plans.push({
        keywords: e.q,
        searchIndex: e.searchIndex ?? 'All',
        priority: 10,
        source: 'fallback',
      });
    }
  }

  // Sort by priority desc, cap to MAX_PLANS
  plans.sort((a, b) => b.priority - a.priority);
  return plans.slice(0, MAX_PLANS);
}

/**
 * Compute a stable hash for a set of plans, for cache keying.
 */
export function hashPlans(plans: SearchPlan[], marketplace: string): string {
  const canonical = plans
    .map((p) => `${p.searchIndex}|${p.keywords}`)
    .sort()
    .join('||');
  // Simple fast hash; collisions are fine here
  let h = 0;
  for (let i = 0; i < canonical.length; i++) {
    h = (h * 31 + canonical.charCodeAt(i)) | 0;
  }
  return `${marketplace}_${(h >>> 0).toString(36)}_${canonical.length}`;
}

// Export for tests / admin tooling
export const _internals = { CULTURAL_PACKS, GENRE_PACKS, aiCache };
