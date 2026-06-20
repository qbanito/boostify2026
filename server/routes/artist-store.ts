/**
 * Artist Store API Routes
 * 
 * Endpoints para la tienda pública de artistas con 100+ productos.
 * Usa el catálogo expandido de Printful + mockups generados bajo demanda.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, discoverClips, artistAvatarVideos, aiSocialPosts, songs } from '../db/schema';
import { eq, or, and, sql, desc, isNotNull } from 'drizzle-orm';

const router = Router();

function extractMasterDesignUrlFromMasterJson(masterJson: any): string {
  if (!masterJson || typeof masterJson !== 'object') return '';

  return (
    masterJson.masterDesignUrl ||
    masterJson.master_design_url ||
    masterJson?.branding?.masterDesignUrl ||
    masterJson?.branding?.master_design_url ||
    masterJson?.branding?.masterLogo ||
    masterJson?.designPack?.masterDesignUrl ||
    masterJson?.designPack?.master_design_url ||
    ''
  );
}

async function resolveMasterDesignUrl(opts: {
  artistId: number;
  artistSlug: string;
  fromMasterJson?: any;
  fromFirestoreUser?: string;
}): Promise<string> {
  const fromJson = extractMasterDesignUrlFromMasterJson(opts.fromMasterJson);
  if (fromJson) return fromJson;
  if (opts.fromFirestoreUser) return opts.fromFirestoreUser;

  try {
    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return '';

    const userQueries = [
      firestoreDb.collection('users').where('id', '==', opts.artistId).limit(1).get(),
      firestoreDb.collection('users').where('id', '==', String(opts.artistId)).limit(1).get(),
      firestoreDb.collection('users').where('slug', '==', opts.artistSlug).limit(1).get(),
    ];
    const userResults = await Promise.allSettled(userQueries);
    for (const result of userResults) {
      if (result.status !== 'fulfilled' || result.value.empty) continue;
      const data: any = result.value.docs[0].data() || {};
      const direct =
        data.masterDesignUrl ||
        data.master_design_url ||
        extractMasterDesignUrlFromMasterJson(data.masterJson || data.master_json);
      if (direct) return direct;
    }

    const artistDoc = await firestoreDb.collection('artists').doc(String(opts.artistId)).get();
    if (artistDoc.exists) {
      const artistData: any = artistDoc.data() || {};
      const direct =
        artistData.masterDesignUrl ||
        artistData.master_design_url ||
        extractMasterDesignUrlFromMasterJson(artistData.masterJson || artistData.master_json);
      if (direct) return direct;

      const logoDoc = await firestoreDb
        .collection('artists')
        .doc(String(opts.artistId))
        .collection('designPack')
        .doc('logo_emblem')
        .get();
      if (logoDoc.exists) {
        const logoData: any = logoDoc.data() || {};
        if (logoData.imageUrl) return logoData.imageUrl;
      }
    }
  } catch (err: any) {
    console.warn('[artist-store] Failed to resolve master design URL:', err?.message || err);
  }

  return '';
}

// Helper: find artist by slug in PostgreSQL.
// Looks up by `slug` first, then by `username`, then by name-derived slug
// (e.g. URL "urban-flow" → artistName "Urban Flow"), since the frontend
// falls back to `name.toLowerCase().replace(/\s+/g,'-')` when slug is null.
async function findArtistBySlug(slug: string) {
  const decoded = decodeURIComponent(slug);
  const result = await db.select().from(users)
    .where(or(eq(users.slug, decoded), eq(users.username, decoded)))
    .limit(1);
  if (result.length > 0) {
    const a = result[0];
    const masterDesignUrl = await resolveMasterDesignUrl({
      artistId: a.id,
      artistSlug: decoded,
      fromMasterJson: a.masterJson,
    });
    return {
      id: a.id,
      artistName: a.artistName || decoded,
      slug: a.slug || a.username || decoded,
      profileImageUrl: a.profileImage || '',
      genre: (a.genres as string[] | null)?.[0] || '',
      masterDesignUrl,
    };
  }

  // Try name-derived slug: "urban-flow" → match artistName ILIKE "urban flow"
  const nameGuess = decoded.replace(/[-_]+/g, ' ').trim();
  if (nameGuess) {
    const byName = await db.select().from(users)
      .where(sql`LOWER(${users.artistName}) = LOWER(${nameGuess})`)
      .limit(1);
    if (byName.length > 0) {
      const a = byName[0];
      const masterDesignUrl = await resolveMasterDesignUrl({
        artistId: a.id,
        artistSlug: decoded,
        fromMasterJson: a.masterJson,
      });
      return {
        id: a.id,
        artistName: a.artistName || decoded,
        slug: a.slug || a.username || decoded,
        profileImageUrl: a.profileImage || '',
        genre: (a.genres as string[] | null)?.[0] || '',
        masterDesignUrl,
      };
    }
  }

  // Fallback: try Firestore 'users' collection
  try {
    const { db: firestoreDb } = await import('../firebase');
    if (firestoreDb) {
      const snapshot = await firestoreDb.collection('users')
        .where('slug', '==', slug)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const masterDesignUrl = await resolveMasterDesignUrl({
          artistId: Number(data.id || 0),
          artistSlug: data.slug || slug,
          fromMasterJson: data.masterJson || data.master_json,
          fromFirestoreUser: data.masterDesignUrl || data.master_design_url || '',
        });
        return {
          id: data.id || 0,
          artistName: data.artistName || data.name || slug,
          slug: data.slug || slug,
          profileImageUrl: data.profileImage || data.profileImageUrl || '',
          genre: data.genre || (data.genres as string[] | null)?.[0] || '',
          masterDesignUrl,
        };
      }
    }
  } catch {}

  return null;
}

// GET /api/artist-store/:artistSlug/catalog
// Retorna el catálogo completo con mockups del artista
router.get('/:artistSlug/catalog', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const { category, search, page = '1', limit = '24' } = req.query;

    // Find artist in PostgreSQL (same as /api/artist/by-slug)
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const masterDesignUrl = artistData.masterDesignUrl || '';
    const artistName = artistData.artistName;

    // Import expanded catalog
    const { 
      getFullCatalog, 
      getProductsByCategory, 
      searchCatalogProducts, 
      getStoreCategories,
      getFeaturedProducts,
      TOTAL_PRODUCT_COUNT,
      getProductImageUrl,
      EXPANDED_CATALOG,
    } = await import('../config/printful-expanded-catalog');

    // Load store config from Firestore (price multipliers, visibility, featured)
    let storeConfig: any = null;
    try {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb) {
        const doc = await firestoreDb.collection('merchConfig').doc('global').get();
        if (doc.exists) storeConfig = doc.data();
      }
    } catch {}

    const hiddenProducts = new Set<number>(storeConfig?.hiddenProducts || []);
    const configFeatured: number[] = storeConfig?.featuredProducts || [];
    const globalMultiplier: number = storeConfig?.globalMultiplier || 0;
    const categoryMultipliers: Record<string, number> = storeConfig?.categoryMultipliers || {};
    const priceOverrides: Record<number, number> = storeConfig?.priceOverrides || {};
    const imageOverrides: Record<number, string> = storeConfig?.imageOverrides || {};

    // Helper: calculate effective retail price for a product
    const getEffectivePrice = (p: any) => {
      if (priceOverrides[p.printfulId]) return priceOverrides[p.printfulId];
      if (globalMultiplier > 0 || Object.keys(categoryMultipliers).length > 0) {
        const mult = categoryMultipliers[p.category] || globalMultiplier;
        if (mult > 0) return Math.ceil(p.baseCost * mult) - 0.01;
      }
      return p.retailPrice; // fallback to hardcoded price
    };

    // Get products based on filters, excluding hidden
    let products;
    if (search && typeof search === 'string') {
      products = searchCatalogProducts(search);
    } else if (category && typeof category === 'string') {
      products = getProductsByCategory(category as any);
    } else {
      products = getFullCatalog();
    }

    // Filter out hidden products
    products = products.filter(p => !hiddenProducts.has(p.printfulId));

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(48, Math.max(1, parseInt(limit as string) || 24));
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedProducts = products.slice(startIdx, startIdx + limitNum);

    // Pre-rendered Printful mockups (per artist) — baked-in design renders
    // saved by the batch endpoint /:slug/mockups/generate-all
    const mockupCache: Record<number, string> = {};
    try {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb && artistData.id) {
        const mockupsSnap = await firestoreDb.collection('storeMockups')
          .doc(String(artistData.id))
          .collection('products')
          .get();
        for (const docSnap of mockupsSnap.docs) {
          const d = docSnap.data();
          const pid = parseInt(docSnap.id, 10);
          const isCurrentDesign = !masterDesignUrl || d?.designUrl === masterDesignUrl;
          if (Number.isFinite(pid) && d?.mockupUrl && isCurrentDesign) mockupCache[pid] = d.mockupUrl;
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to load store mockup cache:', (err as any)?.message);
    }

    // Enrich products with artist-specific info + config prices
    const enrichedProducts = paginatedProducts.map(p => ({
      ...p,
      retailPrice: getEffectivePrice(p),
      artistName,
      displayName: `${artistName} ${p.name}`,
      designUrl: masterDesignUrl,
      productImageUrl: imageOverrides[p.printfulId] || getProductImageUrl(p.printfulId),
      mockupUrl: mockupCache[p.printfulId] || undefined,
      placement: p.placement,
    }));

    // Categories — recount after hiding products
    const visibleCatalog = EXPANDED_CATALOG.filter(p => !hiddenProducts.has(p.printfulId));
    const catMap = new Map<string, number>();
    for (const p of visibleCatalog) catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
    const categories = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Featured: use config if set, otherwise default
    let featured;
    if (configFeatured.length > 0) {
      featured = configFeatured
        .map(id => EXPANDED_CATALOG.find(p => p.printfulId === id))
        .filter((p): p is NonNullable<typeof p> => !!p && !hiddenProducts.has(p.printfulId));
    } else {
      featured = getFeaturedProducts().filter(p => !hiddenProducts.has(p.printfulId));
    }

    const totalVisible = visibleCatalog.length;

    // ── Store Redesign: artist-owned products (Firestore merchandise) ──
    // Buscamos los drops del artista (AI + custom) para mostrarlos en su
    // propia sección destacada. SOLO disponibles (isAvailable !== false).
    let artistProducts: any[] = [];
    try {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb && artistData.id) {
        const seen = new Set<string>();
        const queries = [
          firestoreDb.collection('merchandise').where('userId', '==', artistData.id).limit(50).get(),
          firestoreDb.collection('merchandise').where('userId', '==', String(artistData.id)).limit(50).get(),
          firestoreDb.collection('merchandise').where('userId', '==', artistSlug).limit(50).get(),
        ];
        const snaps = await Promise.allSettled(queries);
        for (const snapResult of snaps) {
          if (snapResult.status !== 'fulfilled') continue;
          for (const docSnap of snapResult.value.docs) {
            if (seen.has(docSnap.id)) continue;
            seen.add(docSnap.id);
            const d = docSnap.data();
            if (d?.isAvailable === false) continue;
            artistProducts.push({
              id: docSnap.id,
              name: d.name || 'Product',
              description: d.description || '',
              price: Number(d.price) || 0,
              imageUrl: d.imageUrl || (Array.isArray(d.images) ? d.images[0] : ''),
              category: d.category || 'Other',
              productType: d.productType || d.type || '',
              sizes: Array.isArray(d.sizes) ? d.sizes : [],
              isCustom: d.isCustom === true || d.aiGenerated === false,
              aiGenerated: d.aiGenerated === true,
              salesCount: Number(d.salesCount) || 0,
              createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : (d.createdAt || null),
            });
          }
        }
        // Sort: featured (custom first), then by salesCount desc
        artistProducts.sort((a, b) => (b.salesCount - a.salesCount) || (Number(b.isCustom) - Number(a.isCustom)));
      }
    } catch (err) {
      console.warn('⚠️ Failed to load artist products for store:', (err as any)?.message);
    }

    res.json({
      success: true,
      artist: {
        name: artistName,
        slug: artistSlug,
        imageUrl: artistData.profileImageUrl || '',
        genre: artistData.genre || '',
        masterDesignUrl,
        pgId: artistData.id,
      },
      catalog: {
        products: enrichedProducts,
        total: products.length,
        totalCatalog: totalVisible,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(products.length / limitNum),
      },
      categories,
      featured: featured.map(p => ({
        ...p,
        retailPrice: getEffectivePrice(p),
        artistName,
        displayName: `${artistName} ${p.name}`,
        designUrl: masterDesignUrl,
        productImageUrl: imageOverrides[p.printfulId] || getProductImageUrl(p.printfulId),
        mockupUrl: mockupCache[p.printfulId] || undefined,
        placement: p.placement,
      })),
      artistProducts,
    });
  } catch (error: any) {
    console.error('Error fetching artist store catalog:', error);
    res.status(500).json({ message: error.message || 'Error fetching catalog' });
  }
});

// GET /api/artist-store/:artistSlug/product/:printfulId
// Get details for a specific product with mockup generation
router.get('/:artistSlug/product/:printfulId', async (req: Request, res: Response) => {
  try {
    const { artistSlug, printfulId } = req.params;

    // Find artist in PostgreSQL
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const masterDesignUrl = artistData.masterDesignUrl || '';
    const artistName = artistData.artistName;

    // Find product in catalog
    const { EXPANDED_CATALOG } = await import('../config/printful-expanded-catalog');
    const product = EXPANDED_CATALOG.find(p => p.printfulId === parseInt(printfulId));

    if (!product) {
      return res.status(404).json({ message: 'Product not found in catalog' });
    }

    // Get variant details from Printful
    const { getPrintfulService } = await import('../services/printful-service');
    const printful = getPrintfulService();

    let variants: any[] = [];
    try {
      const printfulVariants = await printful.getCatalogVariants(product.printfulId);
      variants = printfulVariants.map((v: any) => ({
        id: v.id,
        size: v.size || 'One size',
        color: v.color || '',
        price: product.retailPrice,
        inStock: true,
      }));
    } catch {
      // If Printful API fails, provide basic variant info
      variants = [{ id: 0, size: 'One size', color: '', price: product.retailPrice, inStock: true }];
    }

    res.json({
      success: true,
      product: {
        ...product,
        artistName,
        displayName: `${artistName} ${product.name}`,
        designUrl: masterDesignUrl,
        variants,
      },
    });
  } catch (error: any) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: error.message || 'Error fetching product' });
  }
});

// POST /api/artist-store/:artistSlug/mockup
// Generate a Printful mockup for a specific product
router.post('/:artistSlug/mockup', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const { printfulId, variantIds } = req.body;

    if (!printfulId) {
      return res.status(400).json({ message: 'printfulId is required' });
    }

    // Find artist and get design
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const designUrl = artistData.masterDesignUrl || '';

    if (!designUrl) {
      return res.status(400).json({ message: 'Artist has no design image' });
    }

    // Find product in catalog to determine placement
    const { EXPANDED_CATALOG, getPlacementGeometry } = await import('../config/printful-expanded-catalog');
    const product = EXPANDED_CATALOG.find(p => p.printfulId === parseInt(printfulId));
    const placementName = product?.placement || 'front';

    // Resolve REAL Printful geometry (cached) for this product+variant+placement.
    // Falls back to category-based estimate if Printful printfiles unavailable.
    const { getRealPlacementGeometry } = await import('../services/printful-printfiles');
    const firstVariantId = Array.isArray(variantIds) && variantIds.length > 0
      ? parseInt(String(variantIds[0]), 10)
      : undefined;
    const realGeo = await getRealPlacementGeometry(
      parseInt(printfulId),
      firstVariantId,
      placementName,
      {
        // Brand mark is roughly square (4:5 generated → close to 1:1 for fit purposes)
        designAspectRatio: 1,
        // Apparel/hoodies want chest-anchored, everything else centered
        verticalAlign: product && ['Apparel', 'Hoodies & Sweatshirts', 'Kids & Baby'].includes(product.category) ? 'top' : 'center',
        coverage: product?.isAllOverPrint ? 1 : 0.85,
      },
    );
    console.log(`[mockup] product=${printfulId} placement=${placementName} geo=${realGeo.source} area=${realGeo.area_width}x${realGeo.area_height} dpi=${realGeo.dpi || 'n/a'}`);

    // Generate mockup via Printful
    const { getPrintfulService } = await import('../services/printful-service');
    const printful = getPrintfulService();

    const mockups = await printful.generateMockupAndWait(
      parseInt(printfulId),
      variantIds || [],
      designUrl,
      placementName,
      20,
      { area_width: realGeo.area_width, area_height: realGeo.area_height, width: realGeo.width, height: realGeo.height, top: realGeo.top, left: realGeo.left },
    );

    res.json({
      success: true,
      mockups,
    });
  } catch (error: any) {
    console.error('Error generating mockup:', error);
    res.status(500).json({ message: error.message || 'Error generating mockup' });
  }
});

// POST /api/artist-store/:artistSlug/generate-master-design
// Genera el diseño maestro de alta resolución para el artista
router.post('/:artistSlug/generate-master-design', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;

    // Find artist in PostgreSQL
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const artistName = artistData.artistName;
    const genre = artistData.genre || 'Pop';
    const artistImageUrl = artistData.profileImageUrl || '';

    // Check if master design already exists
    if (artistData.masterDesignUrl) {
      return res.json({
        success: true,
        masterDesignUrl: artistData.masterDesignUrl,
        cached: true,
      });
    }

    console.log(`🎨 Generating master design for ${artistName} (${genre})...`);

    // Generate high-res master design
    const { generateMasterDesign } = await import('../services/fal-service');
    const result = await generateMasterDesign(artistName, artistImageUrl, genre);

    if (!result.success || !result.imageUrl) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate master design',
        error: result.error,
      });
    }

    // Save master design URL to Firestore users collection
    try {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb) {
        const snapshot = await firestoreDb.collection('users')
          .where('slug', '==', artistSlug)
          .limit(1)
          .get();
        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({
            masterDesignUrl: result.imageUrl,
            masterDesignGeneratedAt: new Date(),
          });
        }
      }
    } catch (saveErr) {
      console.warn('Could not save master design URL to Firestore:', saveErr);
    }

    console.log(`✅ Master design generated for ${artistName}: ${result.imageUrl}`);

    res.json({
      success: true,
      masterDesignUrl: result.imageUrl,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error generating master design:', error);
    res.status(500).json({ message: error.message || 'Error generating master design' });
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/artist-store/:artistSlug/hero-media
// Reúne, desde la base de datos, el mejor VIDEO de fondo y un set de
// imágenes de alta calidad del artista para el hero de la tienda.
// Fuentes de video (en orden): Discover Clips → Avatar Talk → posts
// sociales de tipo video. Imágenes: portadas de canciones + posts +
// miniaturas de clips + master design + foto de perfil.
// Público. Degrada con gracia a { video:null, gallery:[] }.
// ════════════════════════════════════════════════════════════════
router.get('/:artistSlug/hero-media', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    const pgId = Number(artistData.id) || 0;
    let video: { url: string; poster?: string } | null = null;
    const gallery: string[] = [];
    const isHttp = (u?: string | null): u is string =>
      !!u && typeof u === 'string' && /^https?:\/\//i.test(u);
    const pushImg = (u?: string | null) => {
      if (isHttp(u) && !gallery.includes(u)) gallery.push(u);
    };
    const isVideoUrl = (u?: string | null): u is string =>
      isHttp(u) && /\.(mp4|webm|mov|m3u8)(\?|#|$)/i.test(u);

    if (pgId > 0) {
      const [clips, avatars, posts, artistSongs] = await Promise.allSettled([
        db.select({ videoUrl: discoverClips.videoUrl, thumbnailUrl: discoverClips.thumbnailUrl })
          .from(discoverClips)
          .where(and(
            eq(discoverClips.artistId, pgId),
            eq(discoverClips.isActive, true),
            isNotNull(discoverClips.videoUrl),
          ))
          .orderBy(desc(discoverClips.createdAt))
          .limit(6),
        db.select({ videoUrl: artistAvatarVideos.videoUrl, thumbnailUrl: artistAvatarVideos.thumbnailUrl })
          .from(artistAvatarVideos)
          .where(and(
            eq(artistAvatarVideos.artistId, String(pgId)),
            eq(artistAvatarVideos.status, 'ready'),
          ))
          .orderBy(desc(artistAvatarVideos.createdAt))
          .limit(3),
        db.select({ contentType: aiSocialPosts.contentType, mediaUrls: aiSocialPosts.mediaUrls })
          .from(aiSocialPosts)
          .where(eq(aiSocialPosts.artistId, pgId))
          .orderBy(desc(aiSocialPosts.createdAt))
          .limit(40),
        db.select({ coverArt: songs.coverArt })
          .from(songs)
          .where(eq(songs.userId, pgId))
          .orderBy(desc(songs.createdAt))
          .limit(12),
      ]);

      // ── VIDEO: Discover Clips (preferido) ──
      if (clips.status === 'fulfilled') {
        const c = clips.value.find((row) => isHttp(row.videoUrl));
        if (c) video = { url: c.videoUrl as string, poster: isHttp(c.thumbnailUrl) ? c.thumbnailUrl! : undefined };
      }
      // ── VIDEO fallback: Avatar Talk ──
      if (!video && avatars.status === 'fulfilled') {
        const a = avatars.value.find((row) => isHttp(row.videoUrl));
        if (a) video = { url: a.videoUrl as string, poster: isHttp(a.thumbnailUrl) ? a.thumbnailUrl! : undefined };
      }
      // ── Posts sociales: separa videos / imágenes ──
      const socialImages: string[] = [];
      if (posts.status === 'fulfilled') {
        for (const p of posts.value) {
          const urls = (p.mediaUrls || []).filter(isHttp);
          for (const u of urls) {
            if (isVideoUrl(u)) {
              if (!video) video = { url: u };
            } else {
              socialImages.push(u);
            }
          }
        }
      }

      // ── GALLERY: portadas de canciones → posts → miniaturas de clips ──
      if (artistSongs.status === 'fulfilled') artistSongs.value.forEach((s) => pushImg(s.coverArt));
      socialImages.forEach(pushImg);
      if (clips.status === 'fulfilled') clips.value.forEach((c) => pushImg(c.thumbnailUrl));
    }

    // Imágenes premium garantizadas (siempre al final como respaldo)
    pushImg(artistData.masterDesignUrl);
    pushImg(artistData.profileImageUrl);

    return res.json({ success: true, video, gallery: gallery.slice(0, 12) });
  } catch (error: any) {
    console.error('[artist-store] hero-media GET error:', error?.message || error);
    // Nunca rompas el hero por esto
    return res.json({ success: true, video: null, gallery: [] });
  }
});

// ════════════════════════════════════════════════════════════════
// GET /api/artist-store/:artistSlug/boutique-decor
// Devuelve la decoración (arte mural) ya generada para la boutique 3D.
// ════════════════════════════════════════════════════════════════
router.get('/:artistSlug/boutique-decor', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.json({ success: true, decor: null });

    const doc = await firestoreDb.collection('boutiqueDecor').doc(String(artistData.id)).get();
    if (!doc.exists) return res.json({ success: true, decor: null });
    return res.json({ success: true, decor: doc.data() });
  } catch (error: any) {
    console.error('[artist-store] boutique-decor GET error:', error?.message || error);
    res.status(500).json({ message: error.message || 'Error fetching boutique decor' });
  }
});

// ════════════════════════════════════════════════════════════════
// POST /api/artist-store/:artistSlug/boutique-decor/generate
// Genera con OpenAI un set de obras de arte mural para la tienda virtual 3D,
// coherente con la identidad del artista. Cacheado en Firestore (boutiqueDecor).
// Body: { force?: boolean }
// ════════════════════════════════════════════════════════════════
router.post('/:artistSlug/boutique-decor/generate', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const force = !!(req.body && req.body.force);

    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    const { db: firestoreDb } = await import('../firebase');
    const docRef = firestoreDb
      ? firestoreDb.collection('boutiqueDecor').doc(String(artistData.id))
      : null;

    // Reutilizar si ya existe (salvo force)
    if (docRef && !force) {
      const existing = await docRef.get();
      if (existing.exists) {
        const data: any = existing.data();
        if (Array.isArray(data?.pieces) && data.pieces.length > 0) {
          return res.json({ success: true, decor: data, cached: true });
        }
      }
    }

    // Obtener colores de marca del perfil (si existen)
    let brandColors: { primary?: string; secondary?: string; accent?: string } | undefined;
    try {
      if (firestoreDb) {
        const profSnap = await firestoreDb.collection('artistProfiles').doc(String(artistData.id)).get();
        const prof: any = profSnap.exists ? profSnap.data() : null;
        brandColors = prof?.brandColors || prof?.branding?.brandColors;
      }
    } catch { /* opcional */ }

    const referenceImages = [artistData.profileImageUrl, artistData.masterDesignUrl].filter(Boolean) as string[];

    console.log(`🖼️ Generando decoración de boutique 3D para ${artistData.artistName}...`);
    const { generateBoutiqueDecorSet } = await import('../services/fal-service');
    const pieces = await generateBoutiqueDecorSet(
      artistData.artistName,
      artistData.genre || 'Pop',
      referenceImages,
      brandColors
    );

    if (!pieces || pieces.length === 0) {
      return res.status(500).json({ success: false, message: 'No se pudo generar la decoración' });
    }

    const decor = {
      artistId: artistData.id,
      artistName: artistData.artistName,
      pieces,
      generatedAt: new Date().toISOString(),
    };

    if (docRef) {
      try {
        await docRef.set(decor);
      } catch (saveErr) {
        console.warn('[artist-store] could not save boutique decor:', saveErr);
      }
    }

    console.log(`✅ Decoración de boutique generada (${pieces.length} piezas) para ${artistData.artistName}`);
    res.json({ success: true, decor, cached: false });
  } catch (error: any) {
    console.error('[artist-store] boutique-decor generate error:', error?.message || error);
    res.status(500).json({ message: error.message || 'Error generating boutique decor' });
  }
});

// ════════════════════════════════════════════════════════════════
// Props 3D de la boutique (Meshy text-to-3D)
// Elementos decorativos GLB generados por IA para cada artista:
// candelabro de lujo + escultura de marca acorde al género.
// ════════════════════════════════════════════════════════════════

const activePropJobs = new Set<string>();

function boutiquePropSpecs(artistName: string, genre: string) {
  const g = genre || 'music';
  return [
    {
      key: 'chandelier',
      label: 'Candelabro de lujo',
      prompt:
        `Ornate luxury crystal chandelier for a high-end fashion boutique, hanging ceiling lamp, ` +
        `polished gold metal frame with cascading crystal prisms, elegant symmetrical design, ` +
        `expensive flagship store centerpiece, single object, no background`,
    },
    {
      key: 'sculpture',
      label: 'Escultura de marca',
      prompt:
        `Modern abstract luxury sculpture for the flagship boutique of a ${g} music artist, ` +
        `flowing polished chrome and dark marble forms on an elegant pedestal base, ` +
        `museum-grade designer art piece, premium materials, single object, no background`,
    },
    {
      key: 'displayTable',
      label: 'Mesa expositora',
      prompt:
        `Round luxury boutique display table, polished dark marble top with gold veining, ` +
        `sculptural polished brass base, high-end retail furniture, minimalist elegant design, ` +
        `single object, no background`,
    },
    {
      key: 'armchair',
      label: 'Sillón de terciopelo',
      prompt:
        `Elegant modern lounge armchair, deep velvet upholstery, curved enveloping back, ` +
        `polished gold metal legs, luxury hotel lobby furniture, designer piece, ` +
        `single object, no background`,
    },
    {
      key: 'plant',
      label: 'Planta decorativa',
      prompt:
        `Tall decorative indoor plant with sculptural broad leaves in an elegant white ceramic ` +
        `vase with gold trim, luxury boutique interior decoration, realistic foliage, ` +
        `single object, no background`,
    },
  ];
}

async function uploadBoutiqueProp(buffer: Buffer, artistId: string | number, key: string): Promise<string | null> {
  try {
    const { storage } = await import('../firebase');
    if (!storage) return null;
    const bucket = storage.bucket();
    const fileName = `boutique-props/${artistId}/${Date.now()}_${key}.glb`;
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'model/gltf-binary' }, validation: false });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (error: any) {
    console.error('[artist-store] boutique prop upload error:', error?.message || error);
    return null;
  }
}

/** Job en segundo plano: genera los props con Meshy, comprime y persiste. */
async function runBoutiquePropsJob(artistId: string, artistName: string, genre: string) {
  const { db: firestoreDb } = await import('../firebase');
  const docRef = firestoreDb?.collection('boutiqueProps').doc(artistId);
  try {
    const axios = (await import('axios')).default;
    const { generatePropModel } = await import('../services/meshy-props-service');
    const { compressGlb } = await import('../services/glb-compress');

    const props: Array<{ key: string; label: string; glbUrl: string; thumbnailUrl?: string | null }> = [];
    // Todos los props en PARALELO: Meshy los encola a la vez y el tiempo total
    // pasa de horas (secuencial) a la duración del prop más lento.
    await Promise.allSettled(
      boutiquePropSpecs(artistName, genre).map(async (spec) => {
        try {
          console.log(`🛋️ [boutique-props] ${artistId} generando "${spec.key}" con Meshy...`);
          const result = await generatePropModel({
            prompt: spec.prompt,
            onStage: (stage, taskId) => console.log(`[boutique-props] ${artistId} ${spec.key} stage=${stage} task=${taskId}`),
          });
          // Descargar YA (las URLs de Meshy expiran) + comprimir + persistir
          const dl = await axios.get(result.glbUrl, { responseType: 'arraybuffer', timeout: 180_000, maxContentLength: Infinity });
          let buffer = Buffer.from(dl.data);
          try {
            const c = await compressGlb(buffer, { quality: 'web' });
            if (c?.buffer) buffer = Buffer.from(c.buffer);
          } catch { /* usar sin comprimir */ }
          const url = await uploadBoutiqueProp(buffer, artistId, spec.key);
          if (url) {
            props.push({ key: spec.key, label: spec.label, glbUrl: url, thumbnailUrl: result.thumbnailUrl });
            // Persistencia incremental — cada prop listo queda guardado aunque otro falle
            if (docRef) {
              await docRef.set({ artistId, artistName, props: [...props], status: 'processing', updatedAt: new Date().toISOString() }, { merge: true });
            }
          }
        } catch (propErr: any) {
          console.error(`[boutique-props] ${artistId} prop "${spec.key}" failed:`, propErr?.message || propErr);
        }
      })
    );

    if (docRef) {
      await docRef.set(
        {
          artistId,
          artistName,
          props,
          status: props.length > 0 ? 'ready' : 'failed',
          error: props.length > 0 ? null : 'No se pudo generar ningún prop',
          generatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    console.log(`✅ [boutique-props] ${artistId} listo (${props.length} props)`);
  } catch (err: any) {
    console.error('[boutique-props] job failed:', err?.message || err);
    if (docRef) {
      await docRef.set({ status: 'failed', error: err?.message || 'Meshy job failed' }, { merge: true }).catch(() => {});
    }
  } finally {
    activePropJobs.delete(artistId);
  }
}

// GET /api/artist-store/:artistSlug/boutique-props
router.get('/:artistSlug/boutique-props', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.json({ success: true, props: null });

    const doc = await firestoreDb.collection('boutiqueProps').doc(String(artistData.id)).get();
    if (!doc.exists) return res.json({ success: true, props: null });
    return res.json({ success: true, props: doc.data() });
  } catch (error: any) {
    console.error('[artist-store] boutique-props GET error:', error?.message || error);
    res.status(500).json({ message: error.message || 'Error fetching boutique props' });
  }
});

// POST /api/artist-store/:artistSlug/boutique-props/generate
// Lanza el job Meshy en segundo plano (tarda varios minutos). Body: { force? }
router.post('/:artistSlug/boutique-props/generate', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const force = !!(req.body && req.body.force);

    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });
    const artistId = String(artistData.id);

    const { isMeshyPropsConfigured } = await import('../services/meshy-props-service');
    if (!isMeshyPropsConfigured()) {
      return res.status(503).json({ success: false, message: 'Meshy no está configurado (MESHY_API_KEY)' });
    }
    if (activePropJobs.has(artistId)) {
      return res.json({ success: true, status: 'processing', message: 'Ya hay un job en curso' });
    }

    const { db: firestoreDb } = await import('../firebase');
    if (firestoreDb && !force) {
      const existing = await firestoreDb.collection('boutiqueProps').doc(artistId).get();
      const data: any = existing.exists ? existing.data() : null;
      if (Array.isArray(data?.props) && data.props.length > 0 && data.status === 'ready') {
        return res.json({ success: true, status: 'ready', props: data, cached: true });
      }
      if (data?.status === 'processing') {
        return res.json({ success: true, status: 'processing', message: 'Generación en curso' });
      }
    }

    activePropJobs.add(artistId);
    if (firestoreDb) {
      await firestoreDb
        .collection('boutiqueProps')
        .doc(artistId)
        .set({ artistId, status: 'processing', startedAt: new Date().toISOString() }, { merge: true })
        .catch(() => {});
    }
    // Fire-and-forget: el pipeline Meshy excede el timeout HTTP del servidor
    void runBoutiquePropsJob(artistId, artistData.artistName, artistData.genre || 'Pop');

    res.json({ success: true, status: 'processing', message: 'Generando props 3D con Meshy (varios minutos)...' });
  } catch (error: any) {
    console.error('[artist-store] boutique-props generate error:', error?.message || error);
    res.status(500).json({ message: error.message || 'Error generating boutique props' });
  }
});

// ════════════════════════════════════════════════════════════════
// Audio interactivo de la boutique (ElevenLabs)
// Voz de anfitrión que da la bienvenida e incita a comprar cada producto.
// ════════════════════════════════════════════════════════════════

// Voz por defecto: "Charlotte" (elegante, multilingüe). Override con BOUTIQUE_VOICE_ID.
const BOUTIQUE_VOICE_ID = process.env.BOUTIQUE_VOICE_ID || 'XB0fDUnXU5powFXDhCwa';

async function synthBoutiqueLine(text: string): Promise<Buffer | null> {
  const el = await synthWithElevenLabs(text);
  if (el) return el;
  // Fallback: OpenAI TTS (gpt-4o-mini-tts) — p.ej. si ElevenLabs agotó la cuota
  return synthWithOpenAITTS(text);
}

async function synthWithOpenAITTS(text: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) return null;
  try {
    const axios = (await import('axios')).default;
    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'gpt-4o-mini-tts',
        voice: 'nova',
        input: text,
        response_format: 'mp3',
        instructions:
          'Habla en español, con un tono elegante, cálido y persuasivo, como la anfitriona de una boutique de lujo que invita a comprar.',
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 60000,
      }
    );
    console.log('[artist-store] 🔊 TTS fallback OpenAI usado');
    return Buffer.from(response.data);
  } catch (error: any) {
    const msg = error.response?.data ? Buffer.from(error.response.data).toString().slice(0, 300) : error.message;
    console.error('[artist-store] OpenAI TTS error:', msg);
    return null;
  }
}

async function synthWithElevenLabs(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) return null;
  try {
    const axios = (await import('axios')).default;
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${BOUTIQUE_VOICE_ID}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.55, use_speaker_boost: true },
      },
      {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        responseType: 'arraybuffer',
        timeout: 60000,
      }
    );
    return Buffer.from(response.data);
  } catch (error: any) {
    const msg = error.response?.data ? Buffer.from(error.response.data).toString().slice(0, 300) : error.message;
    console.error('[artist-store] ElevenLabs TTS error:', msg);
    return null;
  }
}

async function uploadBoutiqueAudio(buffer: Buffer, artistId: string | number, tag: string): Promise<string | null> {
  try {
    const { storage } = await import('../firebase');
    if (!storage) return null;
    const bucket = storage.bucket();
    const fileName = `boutique-audio/${artistId}/${Date.now()}_${tag}.mp3`;
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'audio/mpeg' }, validation: false });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (error: any) {
    console.error('[artist-store] boutique audio upload error:', error?.message || error);
    return null;
  }
}

/** Frases de venta creativas y variadas (en español) */
function buildPitchText(productName: string, price: number, artistName: string, idx: number): string {
  const priceTxt = price > 0 ? `por solo ${price.toFixed(2).replace('.', ' con ')} dólares` : 'a un precio exclusivo';
  const templates = [
    `¡Mira esto! ${productName}, pieza oficial de ${artistName}. Edición limitada, ${priceTxt}. Cuando se agote, no vuelve. ¡Hazla tuya ahora!`,
    `${productName}. Diseñado con la esencia de ${artistName}. Calidad premium ${priceTxt}. Los verdaderos fans ya lo tienen... ¿y tú?`,
    `Esto es ${productName}, directo del universo de ${artistName}. ${priceTxt.charAt(0).toUpperCase() + priceTxt.slice(1)}. Toca comprar y llévalo a casa hoy.`,
    `Tienes buen ojo. ${productName} es de lo más deseado de la colección de ${artistName}, ${priceTxt}. No lo pienses dos veces.`,
    `${productName}: estilo, exclusividad y la firma de ${artistName}, ${priceTxt}. Las unidades vuelan. ¡Asegura la tuya!`,
  ];
  return templates[idx % templates.length];
}

function buildWelcomeText(artistName: string): string {
  return `Bienvenido a la boutique oficial de ${artistName}. Cada pieza que ves es edición exclusiva, creada para verdaderos fans. Explora la sala, toca cualquier producto para escuchar su historia... y llévate algo único antes de que se agote.`;
}

// GET /api/artist-store/:artistSlug/boutique-audio
router.get('/:artistSlug/boutique-audio', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.json({ success: true, audio: null });

    const doc = await firestoreDb.collection('boutiqueAudio').doc(String(artistData.id)).get();
    if (!doc.exists) return res.json({ success: true, audio: null });
    return res.json({ success: true, audio: doc.data() });
  } catch (error: any) {
    console.error('[artist-store] boutique-audio GET error:', error?.message || error);
    res.status(500).json({ message: error.message || 'Error fetching boutique audio' });
  }
});

// POST /api/artist-store/:artistSlug/boutique-audio/generate
// Body: { products: [{ id, name, price }], force?: boolean }
// Genera (y cachea) la bienvenida + un pitch de venta por producto con ElevenLabs.
router.post('/:artistSlug/boutique-audio/generate', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const force = !!(req.body && req.body.force);
    const products: Array<{ id: string; name: string; price: number }> = Array.isArray(req.body?.products)
      ? req.body.products
          .filter((p: any) => p && p.id != null && typeof p.name === 'string' && p.name.trim())
          .slice(0, 10)
          .map((p: any) => ({ id: String(p.id), name: String(p.name).slice(0, 80), price: Number(p.price) || 0 }))
      : [];

    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ success: false, message: 'ElevenLabs no configurado' });
    }

    const { db: firestoreDb } = await import('../firebase');
    const docRef = firestoreDb ? firestoreDb.collection('boutiqueAudio').doc(String(artistData.id)) : null;

    // Cargar cache existente
    let existing: any = null;
    if (docRef && !force) {
      const snap = await docRef.get();
      if (snap.exists) existing = snap.data();
    }

    const audio: any = {
      artistId: artistData.id,
      artistName: artistData.artistName,
      welcome: existing?.welcome || null,
      pitches: { ...(existing?.pitches || {}) },
      generatedAt: new Date().toISOString(),
    };

    let generated = 0;

    // 1) Bienvenida
    if (!audio.welcome?.url) {
      const text = buildWelcomeText(artistData.artistName);
      const buf = await synthBoutiqueLine(text);
      if (buf) {
        const url = await uploadBoutiqueAudio(buf, artistData.id, 'welcome');
        if (url) {
          audio.welcome = { text, url };
          generated++;
        }
      }
    }

    // 2) Pitch por producto (solo los que falten)
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (audio.pitches[p.id]?.url) continue;
      const text = buildPitchText(p.name, p.price, artistData.artistName, i);
      const buf = await synthBoutiqueLine(text);
      if (!buf) continue;
      const url = await uploadBoutiqueAudio(buf, artistData.id, `pitch_${p.id}`);
      if (url) {
        audio.pitches[p.id] = { text, url, name: p.name };
        generated++;
      }
    }

    if (docRef) {
      try {
        await docRef.set(audio);
      } catch (saveErr) {
        console.warn('[artist-store] could not save boutique audio:', saveErr);
      }
    }

    console.log(`🔊 Audio de boutique para ${artistData.artistName}: ${generated} clips nuevos, ${Object.keys(audio.pitches).length} pitches en total`);
    res.json({ success: true, audio, generated });
  } catch (error: any) {
    console.error('[artist-store] boutique-audio generate error:', error?.message || error);
    res.status(500).json({ message: error.message || 'Error generating boutique audio' });
  }
});


// ════════════════════════════════════════════════════════════════
// POST /api/artist-store/:artistSlug/mockups/generate-all
// Pre-renders Printful mockups for the entire catalog with the artist's
// design baked-in. Saves URLs to Firestore: storeMockups/{artistId}/products/{printfulId}
// Body: { designUrl?: string; categories?: string[]; limit?: number; force?: boolean }
//   - designUrl: override design (default = artist masterDesignUrl)
//   - categories: only generate for these categories (default = all)
//   - limit: cap number of products to render (default = no cap)
//   - force: regenerate even if a cached mockup exists
// Returns: { success, generated, skipped, failed, errors }
// ════════════════════════════════════════════════════════════════
router.post('/:artistSlug/mockups/generate-all', async (req: Request, res: Response) => {
  try {
    const { artistSlug } = req.params;
    const { designUrl: overrideDesign, categories, limit, force } = req.body || {};

    const artistData = await findArtistBySlug(artistSlug);
    if (!artistData) return res.status(404).json({ message: 'Artist not found' });

    const designUrl = overrideDesign || artistData.masterDesignUrl;
    if (!designUrl) {
      return res.status(400).json({ message: 'Artist has no design image. Generate master design first.' });
    }

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.status(500).json({ message: 'Firestore not available' });

    const { EXPANDED_CATALOG, getPlacementGeometry } = await import('../config/printful-expanded-catalog');
    const { getPrintfulService } = await import('../services/printful-service');
    const printful = getPrintfulService();

    // Filter products to render
    let products = EXPANDED_CATALOG.filter(p => !p.isAllOverPrint); // skip all-over-print (needs full template)
    if (Array.isArray(categories) && categories.length > 0) {
      products = products.filter(p => categories.includes(p.category));
    }
    if (typeof limit === 'number' && limit > 0) products = products.slice(0, limit);

    const collRef = firestoreDb.collection('storeMockups').doc(String(artistData.id)).collection('products');

    // Skip already cached unless force
    let cachedIds = new Set<number>();
    if (!force) {
      const existing = await collRef.get();
      cachedIds = new Set(
        existing.docs
          .filter((d: any) => {
            const data = d.data() || {};
            return data.designUrl === designUrl;
          })
          .map((d: any) => parseInt(d.id, 10))
          .filter((n: number) => Number.isFinite(n))
      );
    }

    const toRender = products.filter(p => !cachedIds.has(p.printfulId));

    // Pull the real-geometry helper once
    const { getRealPlacementGeometry } = await import('../services/printful-printfiles');

    let generated = 0;
    const failed: { printfulId: number; name: string; error: string }[] = [];
    const skipped = products.length - toRender.length;

    // Helper: retry on Printful rate-limit (HTTP 429) with exponential backoff.
    const withRetry = async <T>(fn: () => Promise<T>, label: string, maxAttempts = 5): Promise<T> => {
      let lastErr: any;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          lastErr = err;
          const status = err?.response?.status || err?.status;
          const isRate = status === 429 || /rate.?limit|status code 429/i.test(err?.message || '');
          if (!isRate || attempt === maxAttempts) throw err;
          const wait = 8000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 1000); // 8s, 16s, 32s, 64s
          console.warn(`[mockups] ⏳ ${label} hit 429, retry ${attempt}/${maxAttempts - 1} in ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
      throw lastErr;
    };

    // Process SEQUENTIALLY (Printful rate-limits aggressively when many
    // mockup tasks are created in parallel). The /mockup-generator
    // endpoints have stricter limits (~10 req/min for create-task) than
    // the rest of the API, so we pace ourselves with a generous delay.
    const INTER_REQUEST_DELAY_MS = 4000;
    for (const p of toRender) {
      try {
        // Need at least 1 variant_id. Fetch product variants on the fly.
        const variants = await withRetry(
          () => printful.getCatalogVariants(p.printfulId),
          `variants(${p.printfulId})`,
        ).catch(() => [] as any[]);
        const firstVariantId = (variants as any[])?.[0]?.id;
        if (!firstVariantId) {
          failed.push({ printfulId: p.printfulId, name: p.name, error: 'No variants found' });
          continue;
        }
        const placementName = p.placement || getPlacementGeometry(p).placement;
        // Resolve REAL Printful printfile geometry (cached). Falls back to
        // category estimate if Printful printfiles are unavailable.
        const geo = await getRealPlacementGeometry(
          p.printfulId,
          firstVariantId,
          placementName,
          {
            designAspectRatio: 1,
            verticalAlign: ['Apparel', 'Hoodies & Sweatshirts', 'Kids & Baby'].includes(p.category) ? 'top' : 'center',
            coverage: p.isAllOverPrint ? 1 : 0.85,
          },
        );
        const mockups = await withRetry(
          () => printful.generateMockupAndWait(
            p.printfulId,
            [firstVariantId],
            designUrl,
            placementName,
            20,
            { area_width: geo.area_width, area_height: geo.area_height, width: geo.width, height: geo.height, top: geo.top, left: geo.left },
          ),
          `mockup(${p.printfulId})`,
        );
        const mockupUrl = mockups?.[0]?.mockup_url;
        if (!mockupUrl) {
          failed.push({ printfulId: p.printfulId, name: p.name, error: 'Empty mockup result' });
          continue;
        }
        await collRef.doc(String(p.printfulId)).set({
          mockupUrl,
          placement: placementName,
          geometry: { area_width: geo.area_width, area_height: geo.area_height, width: geo.width, height: geo.height, top: geo.top, left: geo.left, source: geo.source, dpi: geo.dpi },
          category: p.category,
          designUrl,
          createdAt: new Date(),
        }, { merge: true });
        generated++;
      } catch (err: any) {
        failed.push({ printfulId: p.printfulId, name: p.name, error: err?.message || String(err) });
      }
      // Small pause between products to stay under rate limit
      if (toRender.length > 1) await new Promise((r) => setTimeout(r, INTER_REQUEST_DELAY_MS));
    }

    res.json({
      success: true,
      total: products.length,
      generated,
      skipped,
      failed: failed.length,
      errors: failed.slice(0, 10), // first 10 errors for diagnostics
    });
  } catch (error: any) {
    console.error('Error in batch mockup generation:', error);
    res.status(500).json({ message: error.message || 'Batch mockup generation failed' });
  }
});

// ════════════════════════════════════════════════════════════════════
// GET /api/artist-store/catalog/:printfulId/variants
// Returns sizes/colors for a Printful catalog product so the storefront
// can render a proper size/color picker before checkout.
// In-memory cached for 1h to avoid hammering Printful's API.
// ════════════════════════════════════════════════════════════════════
type VariantCacheEntry = { fetchedAt: number; data: any };
const VARIANT_CACHE = new Map<number, VariantCacheEntry>();
const VARIANT_CACHE_TTL = 60 * 60 * 1000; // 1h

router.get('/catalog/:printfulId/variants', async (req: Request, res: Response) => {
  try {
    const printfulId = parseInt(req.params.printfulId, 10);
    if (!Number.isFinite(printfulId) || printfulId <= 0) {
      return res.status(400).json({ message: 'Invalid printfulId' });
    }

    const cached = VARIANT_CACHE.get(printfulId);
    if (cached && Date.now() - cached.fetchedAt < VARIANT_CACHE_TTL) {
      return res.json(cached.data);
    }

    const { getPrintfulService } = await import('../services/printful-service');
    const printful = getPrintfulService();
    const raw = await printful.getCatalogVariants(printfulId);

    // Group by size + color, build flat option list for the picker
    const sizeSet = new Set<string>();
    const colorMap = new Map<string, { color: string; colorCode?: string; image?: string }>();
    const variants = raw.map((v) => {
      if (v.size) sizeSet.add(v.size);
      if (v.color && !colorMap.has(v.color)) {
        colorMap.set(v.color, { color: v.color, colorCode: v.color_code, image: v.image });
      }
      return {
        variantId: v.id,
        size: v.size || '',
        color: v.color || '',
        colorCode: v.color_code || '',
        image: v.image || '',
        price: parseFloat(v.price) || 0,
        inStock: !!v.in_stock,
      };
    });

    const data = {
      printfulId,
      sizes: Array.from(sizeSet),
      colors: Array.from(colorMap.values()),
      variants,
      total: variants.length,
    };

    VARIANT_CACHE.set(printfulId, { fetchedAt: Date.now(), data });
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching catalog variants:', error?.message);
    res.status(500).json({ message: error?.message || 'Failed to fetch variants' });
  }
});

// ─────────────────────────────────────────────────────────────────
// PRINTFUL PRINTFILES — REAL GEOMETRY CACHE
// ─────────────────────────────────────────────────────────────────

// GET /api/artist-store/printfiles/:printfulId
// Returns the cached Printful printfiles spec for a product (placements, dpi, sizes).
router.get('/printfiles/:printfulId', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.printfulId, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid printfulId' });
    const { getPrintfilesForProduct, getAvailablePlacements } = await import('../services/printful-printfiles');
    const data = await getPrintfilesForProduct(id);
    if (!data) return res.status(404).json({ message: 'No printfiles for this product' });
    const placements = await getAvailablePlacements(id);
    res.json({ productId: id, placements, printfilesCount: data.printfiles.length, variantsCount: data.variant_printfiles.length, fetchedAt: data.fetchedAt, raw: data });
  } catch (error: any) {
    res.status(500).json({ message: error?.message || 'Failed to load printfiles' });
  }
});

// POST /api/artist-store/printfiles/prefetch
// Body: { productIds?: number[], category?: string, all?: boolean }
// Pre-fetches printfiles for all (or filtered) catalog products and caches them.
// Run this ONCE after deploy to warm up the cache (~3 min for 91 products).
router.post('/printfiles/prefetch', async (req: Request, res: Response) => {
  try {
    const { productIds, category, all } = req.body || {};
    const { EXPANDED_CATALOG } = await import('../config/printful-expanded-catalog');
    const { prefetchPrintfiles } = await import('../services/printful-printfiles');

    let ids: number[];
    if (Array.isArray(productIds) && productIds.length > 0) {
      ids = productIds.map((n: any) => parseInt(String(n), 10)).filter((n: number) => Number.isFinite(n));
    } else if (category) {
      ids = EXPANDED_CATALOG.filter((p) => p.category === category).map((p) => p.printfulId);
    } else if (all) {
      ids = EXPANDED_CATALOG.map((p) => p.printfulId);
    } else {
      return res.status(400).json({ message: 'Provide productIds[], category, or all=true' });
    }

    console.log(`[printfiles] 🔄 Prefetching printfiles for ${ids.length} products...`);
    const result = await prefetchPrintfiles(ids);
    console.log(`[printfiles] ✅ Prefetch done: ${result.ok.length} ok, ${result.failed.length} failed`);
    res.json({ requested: ids.length, ok: result.ok.length, failed: result.failed.length, failedIds: result.failed });
  } catch (error: any) {
    console.error('[printfiles] prefetch error:', error?.message);
    res.status(500).json({ message: error?.message || 'Failed to prefetch' });
  }
});

export default router;
