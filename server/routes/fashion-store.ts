/**
 * Fashion Virtual Store API Routes
 * POST/GET endpoints for brand identity, collections, products, campaigns, try-on
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  fashionBrands,
  fashionCollections,
  fashionProducts,
  fashionCampaigns,
  fashionTryonSessions,
  artistProfileImages,
  users,
} from '../../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import {
  generateBrandIdentity,
  generateCollection,
  generateProductConcept,
  generateProductLineup,
  generateFashionCampaign,
  isLikelyImageUrl,
} from '../services/fashion-ai-service';
import { rateLimitAiGen } from '../middleware/rate-limit';

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getArtistForUser(userId: number) {
  const [artist] = await db
    .select({
      id: users.id,
      artistName: users.artistName,
      genre: users.genres,         // array
      genreLegacy: users.genre,    // legacy single-text fallback
      biography: users.biography,
      profileImage: users.profileImage,
      coverImage: users.coverImage,
      country: users.country,
      location: users.location,
      instagramHandle: users.instagramHandle,
      spotifyUrl: users.spotifyUrl,
      tiktokUrl: users.tiktokUrl,
      concerts: users.concerts,
      masterJson: users.masterJson,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return artist || null;
}

/**
 * Collects usable still-image references for an artist: profile/cover image plus
 * gallery images. Video URLs (e.g. .mp4 loop banners) are filtered out by
 * isLikelyImageUrl so they never reach the FAL image editor.
 */
async function getArtistReferenceImages(
  artistId: number,
  primaryImage?: string | null,
  limit = 6,
): Promise<string[]> {
  const refs: string[] = [];
  if (isLikelyImageUrl(primaryImage || undefined)) refs.push(primaryImage as string);

  try {
    const gallery = await db
      .select({ imageUrl: artistProfileImages.imageUrl })
      .from(artistProfileImages)
      .where(eq(artistProfileImages.artistProfileId, artistId))
      .orderBy(asc(artistProfileImages.displayOrder))
      .limit(24);
    for (const row of gallery) {
      if (isLikelyImageUrl(row.imageUrl)) refs.push(row.imageUrl);
    }
  } catch (err: any) {
    console.warn('[fashion-store] gallery ref fetch failed:', err?.message);
  }

  return Array.from(new Set(refs)).slice(0, limit);
}

/**
 * Checks if pgUserId is allowed to manage the given artist.
 * Allows: direct owner (user IS the artist), creator via generatedBy, or admin.
 */
async function isArtistOwner(pgUserId: number, artistId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  if (pgUserId === artistId) return true;
  const [artist] = await db
    .select({ generatedBy: users.generatedBy })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);
  return artist?.generatedBy === pgUserId;
}

// ─── BRAND ───────────────────────────────────────────────────────────────────

/**
 * GET /api/fashion-store/:artistId/brand
 * Returns the artist's fashion brand (public)
 */
router.get('/:artistId/brand', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });

    const [brand] = await db
      .select()
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    return res.json({ success: true, brand: brand || null });
  } catch (err: any) {
    console.error('[fashion-store] brand GET error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/brand/generate
 * AI-generates a full brand identity for the artist
 */
router.post('/:artistId/brand/generate', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const artist = await getArtistForUser(artistId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    // Resolve best available STILL image (profile preferred; cover may be a video)
    const primaryImage = isLikelyImageUrl(artist.profileImage) ? artist.profileImage
      : isLikelyImageUrl(artist.coverImage) ? artist.coverImage : undefined;
    // Gather gallery references (still images only)
    const referenceImages = await getArtistReferenceImages(artistId, primaryImage);
    // Resolve genres (array preferred, fallback to legacy single-text)
    const genresArray = Array.isArray(artist.genre) && artist.genre.length > 0
      ? artist.genre
      : artist.genreLegacy ? [artist.genreLegacy] : undefined;

    const result = await generateBrandIdentity({
      artistName: artist.artistName || 'Artist',
      genre: genresArray?.[0],
      genres: genresArray,
      biography: artist.biography || undefined,
      profileImageUrl: primaryImage || undefined,
      referenceImages,
      country: artist.country || artist.location || undefined,
      instagramHandle: artist.instagramHandle || undefined,
      spotifyUrl: artist.spotifyUrl || undefined,
      tiktokUrl: artist.tiktokUrl || undefined,
      concertHighlights: (artist.concerts as any)?.highlights?.slice(0, 3) || undefined,
      upcomingTours: (artist.concerts as any)?.upcoming?.slice(0, 2) || undefined,
      masterJson: artist.masterJson || undefined,
    });

    return res.json({ success: true, brand: result });
  } catch (err: any) {
    console.error('[fashion-store] brand generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/brand/save
 * Save (upsert) the brand identity
 */
router.post('/:artistId/brand/save', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const {
      brandName, tagline, aesthetic, colorPalette, typographyStyle,
      logoUrl, moodboardUrls, brandManifesto, brandStory, founded,
      influences, isPublished,
    } = req.body;

    if (!brandName) return res.status(400).json({ error: 'brandName is required' });

    // upsert
    const existing = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    let brand;
    if (existing.length > 0) {
      [brand] = await db
        .update(fashionBrands)
        .set({ brandName, tagline, aesthetic, colorPalette, typographyStyle, logoUrl, moodboardUrls, brandManifesto, brandStory, founded, influences, isPublished, updatedAt: new Date() })
        .where(eq(fashionBrands.userId, artistId))
        .returning();
    } else {
      [brand] = await db
        .insert(fashionBrands)
        .values({ userId: artistId, brandName, tagline, aesthetic, colorPalette, typographyStyle, logoUrl, moodboardUrls, brandManifesto, brandStory, founded, influences, isPublished: isPublished ?? false })
        .returning();
    }

    return res.json({ success: true, brand });
  } catch (err: any) {
    console.error('[fashion-store] brand save error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── COLLECTIONS ─────────────────────────────────────────────────────────────

/**
 * GET /api/fashion-store/:artistId/collections
 */
router.get('/:artistId/collections', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);

    const [brand] = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.json({ success: true, collections: [] });

    const collections = await db
      .select()
      .from(fashionCollections)
      .where(eq(fashionCollections.brandId, brand.id))
      .orderBy(desc(fashionCollections.createdAt));

    return res.json({ success: true, collections });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/collections/generate
 * AI-generates a new collection
 */
router.post('/:artistId/collections/generate', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const [brand] = await db
      .select()
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.status(404).json({ error: 'Create your fashion brand first' });

    const artist = await getArtistForUser(artistId);
    const { season, inspiredBySong, year } = req.body;

    const result = await generateCollection(
      { brandName: brand.brandName, aesthetic: brand.aesthetic || '', colorPalette: brand.colorPalette || [] },
      {
        artistName: artist?.artistName || 'Artist',
        genre: Array.isArray(artist?.genre) ? artist.genre[0] : undefined,
        profileImageUrl: isLikelyImageUrl(artist?.profileImage) ? artist?.profileImage || undefined : undefined,
        referenceImages: await getArtistReferenceImages(artistId, artist?.profileImage),
      },
      { season, inspiredBySong, year }
    );

    return res.json({ success: true, collection: result });
  } catch (err: any) {
    console.error('[fashion-store] collection generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/collections
 * Save a collection
 */
router.post('/:artistId/collections', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const [brand] = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.status(404).json({ error: 'Create your fashion brand first' });

    const { name, season, year, theme, inspiredBySong, heroImageUrl, lookbookUrls, status, dropDate, isLimited, limitedQuantity, tokenGated } = req.body;

    const [collection] = await db
      .insert(fashionCollections)
      .values({
        brandId: brand.id,
        userId: artistId,
        name,
        season: season || 'limited',
        year: year ? Number(year) : new Date().getFullYear(),
        theme,
        inspiredBySong,
        heroImageUrl,
        lookbookUrls: lookbookUrls || [],
        status: status || 'upcoming',
        dropDate: dropDate ? new Date(dropDate) : undefined,
        isLimited: isLimited ?? false,
        limitedQuantity: limitedQuantity ? Number(limitedQuantity) : undefined,
        tokenGated: tokenGated ?? false,
      })
      .returning();

    return res.json({ success: true, collection });
  } catch (err: any) {
    console.error('[fashion-store] collection save error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

/**
 * GET /api/fashion-store/:artistId/products
 */
router.get('/:artistId/products', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const { collectionId } = req.query;

    const [brand] = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.json({ success: true, products: [] });

    const conditions = [eq(fashionProducts.brandId, brand.id)];
    if (collectionId) {
      conditions.push(eq(fashionProducts.collectionId, parseInt(collectionId as string)));
    }

    const products = await db
      .select()
      .from(fashionProducts)
      .where(and(...conditions))
      .orderBy(desc(fashionProducts.createdAt));

    return res.json({ success: true, products });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/products/generate
 * AI-generates a product concept + images
 */
router.post('/:artistId/products/generate', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const [brand] = await db
      .select()
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.status(404).json({ error: 'Create your fashion brand first' });

    const artist = await getArtistForUser(artistId);
    const { collectionId, category } = req.body;

    let collection = { name: brand.brandName, theme: brand.aesthetic || '' };
    if (collectionId) {
      const [col] = await db
        .select()
        .from(fashionCollections)
        .where(eq(fashionCollections.id, parseInt(collectionId)))
        .limit(1);
      if (col) collection = { name: col.name, theme: col.theme || '' };
    }

    const result = await generateProductConcept(
      { brandName: brand.brandName, aesthetic: brand.aesthetic || '', colorPalette: brand.colorPalette || [] },
      collection,
      category || 'top',
      isLikelyImageUrl(artist?.profileImage) ? artist?.profileImage || undefined : undefined,
      await getArtistReferenceImages(artistId, artist?.profileImage)
    );

    return res.json({ success: true, product: result });
  } catch (err: any) {
    console.error('[fashion-store] product generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/products
 * Save a product
 */
router.post('/:artistId/products', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const [brand] = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.status(404).json({ error: 'Create your fashion brand first' });

    const { name, description, category, price, compareAtPrice, productImageUrls, visualDirection, colorways, materials, collectionId, sizes, isAvailable, stock } = req.body;

    const [product] = await db
      .insert(fashionProducts)
      .values({
        brandId: brand.id,
        userId: artistId,
        collectionId: collectionId ? Number(collectionId) : undefined,
        name,
        description,
        category: category || 'top',
        price: String(price || '0'),
        compareAtPrice: compareAtPrice ? String(compareAtPrice) : undefined,
        productImageUrls: productImageUrls || [],
        visualDirection,
        colorways: colorways || [],
        sizes: sizes || ['XS', 'S', 'M', 'L', 'XL', '2XL'],
        materials: materials || [],
        isAvailable: isAvailable ?? true,
        stock: stock ? Number(stock) : 0,
      })
      .returning();

    return res.json({ success: true, product });
  } catch (err: any) {
    console.error('[fashion-store] product save error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────

/**
 * GET /api/fashion-store/:artistId/campaigns
 */
router.get('/:artistId/campaigns', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);

    const [brand] = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.json({ success: true, campaigns: [] });

    const campaigns = await db
      .select()
      .from(fashionCampaigns)
      .where(eq(fashionCampaigns.brandId, brand.id))
      .orderBy(desc(fashionCampaigns.createdAt));

    return res.json({ success: true, campaigns });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/campaigns/generate
 */
router.post('/:artistId/campaigns/generate', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const [brand] = await db
      .select()
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.status(404).json({ error: 'Create your fashion brand first' });

    const artist = await getArtistForUser(artistId);
    const { collectionId, targetPlatforms } = req.body;

    let collection = { name: brand.brandName, theme: brand.aesthetic || '' };
    if (collectionId) {
      const [col] = await db
        .select()
        .from(fashionCollections)
        .where(eq(fashionCollections.id, parseInt(collectionId)))
        .limit(1);
      if (col) collection = { name: col.name, theme: col.theme || '' };
    }

    const result = await generateFashionCampaign(
      { brandName: brand.brandName, aesthetic: brand.aesthetic || '', colorPalette: brand.colorPalette || [] },
      collection,
      {
        artistName: artist?.artistName || 'Artist',
        profileImageUrl: isLikelyImageUrl(artist?.profileImage) ? artist?.profileImage || undefined : undefined,
        referenceImages: await getArtistReferenceImages(artistId, artist?.profileImage),
      },
      targetPlatforms || ['instagram', 'tiktok']
    );

    // Auto-save
    const [campaign] = await db
      .insert(fashionCampaigns)
      .values({
        brandId: brand.id,
        userId: artistId,
        collectionId: collectionId ? Number(collectionId) : undefined,
        title: result.title,
        concept: result.concept,
        campaignImages: result.campaignImages || [],
        videoPrompt: result.videoPrompt,
        targetPlatforms: targetPlatforms || ['instagram', 'tiktok'],
        hashtags: result.hashtags,
        caption: result.caption,
        status: 'ready',
      })
      .returning();

    return res.json({ success: true, campaign });
  } catch (err: any) {
    console.error('[fashion-store] campaign generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/fashion-store/:artistId/generate-universe
 * One-click orchestration: generates (and saves) the full fashion universe —
 * brand identity (if missing), one collection/drop, a lineup of >= 10 products,
 * and a launch campaign — all wired together, using the artist's image + gallery
 * references for visual consistency.
 */
router.post('/:artistId/generate-universe', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist ID' });
    const pgUserId = Number((req as any).user?.id);
    const isAdmin = (req as any).user?.isAdmin === true || (req as any).user?.role === 'admin';
    if (!await isArtistOwner(pgUserId, artistId, isAdmin)) return res.status(403).json({ error: 'Forbidden' });

    const artist = await getArtistForUser(artistId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const productCount = Math.max(10, Math.min(Number(req.body?.productCount) || 10, 14));
    const season = req.body?.season || 'limited';
    const inspiredBySong = req.body?.inspiredBySong || undefined;
    const targetPlatforms: string[] = req.body?.targetPlatforms || ['instagram', 'tiktok'];

    // Still-image references (profile + gallery; videos filtered out)
    const primaryImage = isLikelyImageUrl(artist.profileImage) ? artist.profileImage
      : isLikelyImageUrl(artist.coverImage) ? artist.coverImage : undefined;
    const referenceImages = await getArtistReferenceImages(artistId, primaryImage);
    const genresArray = Array.isArray(artist.genre) && artist.genre.length > 0
      ? artist.genre
      : artist.genreLegacy ? [artist.genreLegacy] : undefined;

    const artistCtx = {
      artistName: artist.artistName || 'Artist',
      genre: genresArray?.[0],
      genres: genresArray,
      biography: artist.biography || undefined,
      profileImageUrl: primaryImage || undefined,
      referenceImages,
      country: artist.country || artist.location || undefined,
      instagramHandle: artist.instagramHandle || undefined,
      spotifyUrl: artist.spotifyUrl || undefined,
      tiktokUrl: artist.tiktokUrl || undefined,
      concertHighlights: (artist.concerts as any)?.highlights?.slice(0, 3) || undefined,
      upcomingTours: (artist.concerts as any)?.upcoming?.slice(0, 2) || undefined,
      masterJson: artist.masterJson || undefined,
    };

    // ── 1. Brand identity — reuse existing brand or generate + save a new one ──
    let [brand] = await db
      .select()
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) {
      const brandResult = await generateBrandIdentity(artistCtx);
      [brand] = await db
        .insert(fashionBrands)
        .values({
          userId: artistId,
          brandName: brandResult.brandName,
          tagline: brandResult.tagline,
          aesthetic: brandResult.aesthetic,
          colorPalette: brandResult.colorPalette,
          typographyStyle: brandResult.typographyStyle,
          logoUrl: brandResult.logoUrl,
          moodboardUrls: brandResult.moodboardUrls,
          brandManifesto: brandResult.brandManifesto,
          brandStory: brandResult.brandStory,
          founded: brandResult.founded,
          influences: brandResult.influences,
          isPublished: false,
        })
        .returning();
    }

    const brandMeta = { brandName: brand.brandName, aesthetic: brand.aesthetic || '', colorPalette: brand.colorPalette || [] };

    // ── 2. Collection / drop ───────────────────────────────────────────────────
    const collectionResult = await generateCollection(
      brandMeta,
      artistCtx,
      { season, inspiredBySong, year: new Date().getFullYear() },
    );

    const [collection] = await db
      .insert(fashionCollections)
      .values({
        brandId: brand.id,
        userId: artistId,
        name: collectionResult.name,
        season: collectionResult.season,
        year: collectionResult.year,
        theme: collectionResult.theme,
        inspiredBySong,
        heroImageUrl: collectionResult.heroImageUrl,
        lookbookUrls: collectionResult.lookbookUrls || [],
        status: 'active',
        isLimited: true,
      })
      .returning();

    // ── 3. Product lineup (>= 10) ──────────────────────────────────────────────
    const lineup = await generateProductLineup(
      brandMeta,
      { name: collection.name, theme: collection.theme || '' },
      productCount,
      artistCtx,
    );

    const savedProducts = [] as any[];
    for (const p of lineup) {
      const [product] = await db
        .insert(fashionProducts)
        .values({
          brandId: brand.id,
          userId: artistId,
          collectionId: collection.id,
          name: p.name,
          description: p.description,
          category: p.category || 'top',
          price: String(p.price || '0'),
          compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : undefined,
          productImageUrls: p.productImageUrls || [],
          visualDirection: p.visualDirection,
          colorways: p.colorways || [],
          sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
          materials: p.materials || [],
          isAvailable: true,
          stock: 0,
        })
        .returning();
      savedProducts.push(product);
    }

    // ── 4. Launch campaign ─────────────────────────────────────────────────────
    const campaignResult = await generateFashionCampaign(
      brandMeta,
      { name: collection.name, theme: collection.theme || '' },
      artistCtx,
      targetPlatforms,
    );

    const [campaign] = await db
      .insert(fashionCampaigns)
      .values({
        brandId: brand.id,
        userId: artistId,
        collectionId: collection.id,
        title: campaignResult.title,
        concept: campaignResult.concept,
        campaignImages: campaignResult.campaignImages || [],
        videoPrompt: campaignResult.videoPrompt,
        targetPlatforms,
        hashtags: campaignResult.hashtags,
        caption: campaignResult.caption,
        status: 'ready',
      })
      .returning();

    return res.json({
      success: true,
      brand,
      collection,
      products: savedProducts,
      productCount: savedProducts.length,
      campaign,
    });
  } catch (err: any) {
    console.error('[fashion-store] generate-universe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── TRY-ON ───────────────────────────────────────────────────────────────────

/**
 * POST /api/fashion-store/tryon
 * Virtual try-on session using Kling AI
 */
router.post('/tryon', async (req: Request, res: Response) => {
  try {
    const { modelImageUrl, garmentImageUrl, productId, brandId, isFanScene, fanName, isPublic } = req.body;

    if (!modelImageUrl || !garmentImageUrl) {
      return res.status(400).json({ error: 'modelImageUrl and garmentImageUrl are required' });
    }

    // Forward to the existing Kling try-on endpoint
    const klingRes = await fetch(`${process.env.BASE_URL || 'http://localhost:5000'}/api/kling/virtual-tryon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelImage: modelImageUrl, clothImage: garmentImageUrl }),
    });

    let resultImageUrl: string | null = null;
    let status: 'completed' | 'failed' = 'failed';

    if (klingRes.ok) {
      const klingData = await klingRes.json();
      resultImageUrl = klingData.imageUrl || klingData.result || null;
      status = resultImageUrl ? 'completed' : 'failed';
    }

    // Save session
    const pgUserId = Number((req as any).user?.id) || null;
    const [session] = await db
      .insert(fashionTryonSessions)
      .values({
        productId: productId ? Number(productId) : undefined,
        userId: pgUserId || undefined,
        brandId: brandId ? Number(brandId) : undefined,
        modelImageUrl,
        garmentImageUrl,
        resultImageUrl: resultImageUrl || undefined,
        isFanScene: isFanScene ?? false,
        fanName: fanName || undefined,
        isPublic: isPublic ?? false,
        status,
      })
      .returning();

    return res.json({ success: true, session, resultImageUrl });
  } catch (err: any) {
    console.error('[fashion-store] tryon error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/fashion-store/:artistId/tryon/fan-gallery
 * Public fan scenes
 */
router.get('/:artistId/tryon/fan-gallery', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId);

    const [brand] = await db
      .select({ id: fashionBrands.id })
      .from(fashionBrands)
      .where(eq(fashionBrands.userId, artistId))
      .limit(1);

    if (!brand) return res.json({ success: true, scenes: [] });

    const scenes = await db
      .select()
      .from(fashionTryonSessions)
      .where(
        and(
          eq(fashionTryonSessions.brandId, brand.id),
          eq(fashionTryonSessions.isPublic, true),
          eq(fashionTryonSessions.isFanScene, true),
          eq(fashionTryonSessions.status, 'completed')
        )
      )
      .orderBy(desc(fashionTryonSessions.createdAt))
      .limit(50);

    return res.json({ success: true, scenes });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
