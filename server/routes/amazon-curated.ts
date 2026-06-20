/**
 * Amazon Curated Picks — Routes
 *
 * Public:
 *   GET  /api/amazon-curated/by-slug/:slug      → curated products
 *   GET  /api/amazon-curated/by-artist/:id      → curated products (numeric)
 *   POST /api/amazon-curated/click              → log a click
 *
 * Authenticated (artist owner or admin):
 *   POST /api/amazon-curated/refresh/:id        → force refresh cache
 *   POST /api/amazon-curated/settings/:id       → update affiliate tag / booster flag
 *   GET  /api/amazon-curated/settings/:id       → read settings (owner)
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { eq, or, and, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  users,
  amazonProductCache,
  amazonClickEvents,
} from '../db/schema';
import {
  searchItems,
  withAffiliateTag,
  isPaapiConfigured,
  type PaapiItem,
} from '../services/amazon/paapi';
import {
  buildSearchPlans,
  hashPlans,
  type SearchPlan,
} from '../services/amazon/cultural-context';
import {
  detectMarketplaceFromTag,
  buildDetailPageUrl,
  buildAssociatesImageUrl,
  SUPPORTED_MARKETPLACES,
} from '../services/amazon/marketplace';

const router = Router();

const CACHE_TTL_HOURS = 24;
const MAX_PRODUCTS = 25;

// ── Tag validation: Amazon Associates tag format `something-20`, `myname-21` etc.
const TAG_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,28}[a-zA-Z0-9])?-[0-9]{2}$/;
// ASIN: 10 alphanumeric chars (case-insensitive). Most products start with B0; books are 10 digits/letters.
const ASIN_REGEX = /^[A-Z0-9]{10}$/i;
const MAX_MANUAL_PICKS = 25;

const manualPickSchema = z.object({
  asin: z.string().trim().regex(ASIN_REGEX, 'Invalid ASIN (10 alphanumeric chars)').transform((v) => v.toUpperCase()),
  title: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(280).optional().nullable(),
});

const settingsSchema = z.object({
  amazonAffiliateTag: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .refine(
      (v) => !v || TAG_REGEX.test(v),
      'Invalid Amazon Associates tag format (e.g. "myartist-20")',
    ),
  amazonAiBoosterEnabled: z.boolean().optional(),
  amazonManualPicks: z.array(manualPickSchema).max(MAX_MANUAL_PICKS).optional(),
  amazonMarketplaceOverride: z
    .string()
    .trim()
    .nullable()
    .optional()
    .refine(
      (v) => !v || SUPPORTED_MARKETPLACES.some((m) => m.code === v.toUpperCase()),
      'Invalid marketplace code',
    ),
});

const clickSchema = z.object({
  artistId: z.number().int().positive().optional(),
  asin: z.string().trim().min(1).max(20),
  affiliateTag: z.string().trim().min(1).max(40),
  referrer: z.string().max(500).optional().nullable(),
});

// ── Rate limits ─────────────────────────────────────────────────────────────
const publicReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const clickLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_refreshes' },
});

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ManualPick {
  asin: string;
  title?: string | null;
  note?: string | null;
}

interface ResolvedArtist {
  id: number;
  slug: string | null;
  name: string | null;
  country: string | null;
  genre: string | null;
  genres: string[] | null;
  biography: string | null;
  masterJson: any;
  amazonAffiliateTag: string | null;
  amazonAiBoosterEnabled: boolean;
  amazonManualPicks: ManualPick[];
  amazonMarketplaceOverride: string | null;
}

async function loadArtistByAnyId(
  identifier: string | number,
): Promise<ResolvedArtist | null> {
  const numeric = typeof identifier === 'number' ? identifier : Number(identifier);
  const where = !Number.isNaN(numeric) && numeric > 0
    ? or(eq(users.id, numeric), eq(users.slug, String(identifier)))
    : eq(users.slug, String(identifier));

  const [row] = await db
    .select({
      id: users.id,
      slug: users.slug,
      name: users.artistName,
      country: users.country,
      genre: users.genre,
      genres: users.genres,
      biography: users.biography,
      masterJson: users.masterJson,
      amazonAffiliateTag: users.amazonAffiliateTag,
      amazonAiBoosterEnabled: users.amazonAiBoosterEnabled,
      amazonManualPicks: users.amazonManualPicks,
      amazonMarketplaceOverride: users.amazonMarketplaceOverride,
    })
    .from(users)
    .where(where)
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    amazonManualPicks: Array.isArray(row.amazonManualPicks) ? (row.amazonManualPicks as ManualPick[]) : [],
  };
}

async function resolveOwnerOrAdmin(
  req: Request,
  artistId: number,
): Promise<{ ok: boolean; error?: string }> {
  const clerkUser = req.user as any;
  if (!clerkUser?.id) return { ok: false, error: 'unauthorized' };

  const [me] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  if (!me) return { ok: false, error: 'user_not_found' };
  if (me.role === 'admin') return { ok: true };
  if (me.id === artistId) return { ok: true };
  return { ok: false, error: 'forbidden' };
}

interface CuratedProduct {
  asin: string;
  title: string;
  imageUrl: string | null;
  price: PaapiItem['price'];
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  brand: string | null;
  url: string; // already tagged
  source: 'amazon' | 'manual';
  note?: string | null;
}

/**
 * Build CuratedProduct list from manual ASINs without calling PA-API.
 * Uses Amazon Associates image widget for product images.
 */
function buildManualProducts(
  manualPicks: ManualPick[],
  tag: string,
  marketplaceOverride?: string | null,
): CuratedProduct[] {
  if (!manualPicks?.length || !tag) return [];
  const mp = detectMarketplaceFromTag(tag, marketplaceOverride);
  return manualPicks.slice(0, MAX_PRODUCTS).map((p): CuratedProduct => ({
    asin: p.asin,
    title: p.title || `Amazon ${mp.country} · ${p.asin}`,
    imageUrl: buildAssociatesImageUrl(p.asin, tag, mp, 250),
    price: null,
    rating: null,
    reviewCount: null,
    category: null,
    brand: null,
    url: buildDetailPageUrl(p.asin, tag, mp),
    source: 'manual',
    note: p.note ?? null,
  }));
}

function rankItem(it: PaapiItem, plan: SearchPlan): number {
  const rating = it.rating ?? 3;
  const reviews = it.reviewCount ?? 0;
  const reviewWeight = Math.min(Math.sqrt(reviews) / 10, 5); // cap influence
  return plan.priority * (rating / 5) + reviewWeight;
}

async function fetchFreshProducts(
  artist: ResolvedArtist,
  plans: SearchPlan[],
): Promise<CuratedProduct[]> {
  const tag = artist.amazonAffiliateTag || process.env.PAAPI_PARTNER_TAG!;
  const seen = new Map<string, { item: PaapiItem; score: number }>();

  for (const plan of plans) {
    try {
      const items = await searchItems({
        keywords: plan.keywords,
        searchIndex: plan.searchIndex,
        itemCount: 5,
        partnerTag: tag,
      });
      for (const it of items) {
        const score = rankItem(it, plan);
        const existing = seen.get(it.asin);
        if (!existing || score > existing.score) {
          seen.set(it.asin, { item: it, score });
        }
      }
    } catch (err: any) {
      // Don't fail the whole batch on a single plan error
      console.warn(
        `[amazon-curated] plan failed (${plan.keywords}):`,
        err?.message ?? err,
      );
    }
  }

  const ranked = [...seen.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PRODUCTS)
    .map(({ item }): CuratedProduct => ({
      asin: item.asin,
      title: item.title,
      imageUrl: item.imageUrl,
      price: item.price,
      rating: item.rating,
      reviewCount: item.reviewCount,
      category: item.category,
      brand: item.brand,
      url: withAffiliateTag(item.detailPageUrl, tag),
      source: 'amazon',
    }));

  return ranked;
}

async function getOrFetchCurated(
  artist: ResolvedArtist,
  opts: { forceRefresh?: boolean } = {},
): Promise<{
  products: CuratedProduct[];
  cached: boolean;
  fetchedAt: Date;
  expiresAt: Date;
  source: 'cache' | 'fresh' | 'manual' | 'unconfigured';
}> {
  // 1) Manual picks always take priority — works WITHOUT PA-API access.
  const tagForManual = artist.amazonAffiliateTag || process.env.PAAPI_PARTNER_TAG;
  if (artist.amazonManualPicks?.length && tagForManual) {
    return {
      products: buildManualProducts(
        artist.amazonManualPicks,
        tagForManual,
        artist.amazonMarketplaceOverride,
      ),
      cached: false,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 3600_000),
      source: 'manual',
    };
  }

  // 2) Fall back to PA-API auto-curation if configured.
  if (!isPaapiConfigured()) {
    return {
      products: [],
      cached: false,
      fetchedAt: new Date(),
      expiresAt: new Date(),
      source: 'unconfigured',
    };
  }

  const plans = await buildSearchPlans({
    artistId: artist.id,
    name: artist.name,
    country: artist.country,
    genre: artist.genre,
    genres: artist.genres,
    biography: artist.biography,
    masterJson: artist.masterJson,
    aiBoosterEnabled: artist.amazonAiBoosterEnabled,
  });

  const marketplace = process.env.PAAPI_MARKETPLACE || 'www.amazon.com';
  const queryHash = hashPlans(plans, marketplace);

  if (!opts.forceRefresh) {
    const [hit] = await db
      .select()
      .from(amazonProductCache)
      .where(
        and(
          eq(amazonProductCache.artistId, artist.id),
          eq(amazonProductCache.queryHash, queryHash),
          gt(amazonProductCache.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (hit) {
      // Re-tag URLs in case affiliate tag changed since cache write
      const tag = artist.amazonAffiliateTag || process.env.PAAPI_PARTNER_TAG!;
      const products: CuratedProduct[] = (hit.productsJson as any[]).map(
        (p): CuratedProduct => ({
          ...p,
          url: withAffiliateTag(p.url || '', tag),
        }),
      );
      return {
        products,
        cached: true,
        fetchedAt: hit.fetchedAt,
        expiresAt: hit.expiresAt,
        source: 'cache',
      };
    }
  }

  const fresh = await fetchFreshProducts(artist, plans);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 3600_000);

  if (fresh.length > 0) {
    await db
      .insert(amazonProductCache)
      .values({
        artistId: artist.id,
        queryHash,
        marketplace,
        productsJson: fresh as any,
        itemCount: fresh.length,
        fetchedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [amazonProductCache.artistId, amazonProductCache.queryHash],
        set: {
          productsJson: fresh as any,
          itemCount: fresh.length,
          fetchedAt: now,
          expiresAt,
          marketplace,
        },
      });
  }

  return {
    products: fresh,
    cached: false,
    fetchedAt: now,
    expiresAt,
    source: 'fresh',
  };
}

function maskTag(t: string | null | undefined): string | null {
  if (!t) return null;
  if (t.length <= 6) return t;
  return `${t.slice(0, 3)}***${t.slice(-3)}`;
}

// ── Public endpoints ────────────────────────────────────────────────────────

router.get(
  '/by-slug/:slug',
  publicReadLimiter,
  async (req: Request, res: Response) => {
    try {
      const slug = String(req.params.slug || '').trim();
      if (!slug) return res.status(400).json({ error: 'slug_required' });

      const artist = await loadArtistByAnyId(slug);
      if (!artist) return res.status(404).json({ error: 'artist_not_found' });

      const result = await getOrFetchCurated(artist);

      res.json({
        artistId: artist.id,
        artistSlug: artist.slug,
        artistName: artist.name,
        affiliateTag: maskTag(
          artist.amazonAffiliateTag || process.env.PAAPI_PARTNER_TAG || null,
        ),
        configured: result.source !== 'unconfigured',
        cached: result.cached,
        source: result.source,
        fetchedAt: result.fetchedAt,
        expiresAt: result.expiresAt,
        products: result.products,
      });
    } catch (err: any) {
      console.error('[amazon-curated] by-slug failed:', err);
      res.status(500).json({ error: 'internal_error', message: err?.message });
    }
  },
);

router.get(
  '/by-artist/:id',
  publicReadLimiter,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ error: 'invalid_artist_id' });

      const artist = await loadArtistByAnyId(id);
      if (!artist) return res.status(404).json({ error: 'artist_not_found' });

      const result = await getOrFetchCurated(artist);

      res.json({
        artistId: artist.id,
        artistSlug: artist.slug,
        artistName: artist.name,
        affiliateTag: maskTag(
          artist.amazonAffiliateTag || process.env.PAAPI_PARTNER_TAG || null,
        ),
        configured: result.source !== 'unconfigured',
        cached: result.cached,
        source: result.source,
        fetchedAt: result.fetchedAt,
        expiresAt: result.expiresAt,
        products: result.products,
      });
    } catch (err: any) {
      console.error('[amazon-curated] by-artist failed:', err);
      res.status(500).json({ error: 'internal_error', message: err?.message });
    }
  },
);

router.post('/click', clickLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = clickSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_payload', detail: parsed.error.flatten() });
    }
    const { artistId, asin, affiliateTag, referrer } = parsed.data;

    const visitorId = (req.headers['x-visitor-id'] as string) || null;
    const userAgent =
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent'].slice(0, 500)
        : null;

    await db.insert(amazonClickEvents).values({
      artistId: artistId ?? null,
      asin,
      affiliateTag,
      visitorId,
      referrer: referrer ?? null,
      userAgent,
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[amazon-curated] click failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── Owner endpoints ─────────────────────────────────────────────────────────

router.post(
  '/refresh/:id',
  refreshLimiter,
  async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ error: 'invalid_artist_id' });

      const auth = await resolveOwnerOrAdmin(req, id);
      if (!auth.ok) return res.status(403).json({ error: auth.error });

      const artist = await loadArtistByAnyId(id);
      if (!artist) return res.status(404).json({ error: 'artist_not_found' });

      const result = await getOrFetchCurated(artist, { forceRefresh: true });

      res.json({
        ok: true,
        cached: result.cached,
        source: result.source,
        count: result.products.length,
        fetchedAt: result.fetchedAt,
        expiresAt: result.expiresAt,
      });
    } catch (err: any) {
      console.error('[amazon-curated] refresh failed:', err);
      res.status(500).json({ error: 'internal_error', message: err?.message });
    }
  },
);

router.get('/settings/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: 'invalid_artist_id' });

    const auth = await resolveOwnerOrAdmin(req, id);
    if (!auth.ok) return res.status(403).json({ error: auth.error });

    const [row] = await db
      .select({
        amazonAffiliateTag: users.amazonAffiliateTag,
        amazonAiBoosterEnabled: users.amazonAiBoosterEnabled,
        amazonManualPicks: users.amazonManualPicks,
        amazonMarketplaceOverride: users.amazonMarketplaceOverride,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'artist_not_found' });

    const tag = row.amazonAffiliateTag || process.env.PAAPI_PARTNER_TAG || null;
    const mp = detectMarketplaceFromTag(tag, row.amazonMarketplaceOverride);

    res.json({
      amazonAffiliateTag: row.amazonAffiliateTag ?? '',
      amazonAiBoosterEnabled: row.amazonAiBoosterEnabled,
      amazonManualPicks: Array.isArray(row.amazonManualPicks) ? row.amazonManualPicks : [],
      amazonMarketplaceOverride: row.amazonMarketplaceOverride ?? '',
      paapiConfigured: isPaapiConfigured(),
      marketplace: {
        country: mp.country,
        label: mp.label,
        host: mp.host,
      },
      supportedMarketplaces: SUPPORTED_MARKETPLACES,
    });
  } catch (err: any) {
    console.error('[amazon-curated] settings get failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

router.post('/settings/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res.status(400).json({ error: 'invalid_artist_id' });

    const auth = await resolveOwnerOrAdmin(req, id);
    if (!auth.ok) return res.status(403).json({ error: auth.error });

    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: 'invalid_payload', detail: parsed.error.flatten() });
    }

    const updates: Record<string, any> = {};
    if (parsed.data.amazonAffiliateTag !== undefined) {
      const v = parsed.data.amazonAffiliateTag;
      updates.amazonAffiliateTag = v && v.length > 0 ? v : null;
    }
    if (parsed.data.amazonAiBoosterEnabled !== undefined) {
      updates.amazonAiBoosterEnabled = parsed.data.amazonAiBoosterEnabled;
    }
    if (parsed.data.amazonManualPicks !== undefined) {
      // Dedupe ASINs (case-insensitive), keep first occurrence
      const seen = new Set<string>();
      const deduped = parsed.data.amazonManualPicks.filter((p) => {
        const k = p.asin.toUpperCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      updates.amazonManualPicks = deduped;
    }
    if (parsed.data.amazonMarketplaceOverride !== undefined) {
      const v = parsed.data.amazonMarketplaceOverride;
      updates.amazonMarketplaceOverride = v ? v.toUpperCase() : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ ok: true, changed: false });
    }

    updates.updatedAt = new Date();

    await db.update(users).set(updates).where(eq(users.id, id));

    // Invalidate PA-API cache when tag, override, or manual picks change
    if (
      'amazonAffiliateTag' in updates ||
      'amazonManualPicks' in updates ||
      'amazonMarketplaceOverride' in updates
    ) {
      await db
        .delete(amazonProductCache)
        .where(eq(amazonProductCache.artistId, id));
    }

    res.json({ ok: true, changed: true });
  } catch (err: any) {
    console.error('[amazon-curated] settings post failed:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
