/**
 * Official Store Enhancements Router
 *
 * Endpoints:
 *   Bundles:
 *     GET    /bundles/:userId                 — List active bundles for artist
 *     POST   /bundles                         — Create bundle (authenticated)
 *     POST   /bundles/ai-generate/:userId     — AI-generate bundles from artist products + masterJson
 *     DELETE /bundles/:id                     — Remove bundle
 *
 *   Views / Analytics:
 *     POST   /views/track                     — Track a product view (public, rate-limited client-side)
 *     GET    /views/heatmap/:userId           — Owner heatmap: views vs sales by product
 *
 *   AI Content:
 *     POST   /ai/rewrite-description/:productId  — Rewrite product description with masterJson voice
 *     POST   /ai/generate-design/:userId         — Generate a new merch design using masterJson
 *
 *   Seasonal Drops:
 *     POST   /seasonal/create-drop/:userId    — Create a seasonal collection (admin or cron-triggered)
 *     GET    /seasonal/current/:userId        — Get current seasonal drop for artist
 *
 *   Pre-orders:
 *     GET    /pre-orders/:userId              — List pre-order products for artist
 *     POST   /pre-orders/:productId/commit    — Increment pre-order counter when customer commits
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  merchandise,
  users,
  productBundles,
  productViews,
  salesTransactions,
  artistBlueprints,
} from '../db/schema';
import { eq, and, desc, sql, inArray, gte, isNotNull } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// ─────────────── Helpers ───────────────

async function getPostgresUserId(clerkId: string): Promise<number | null> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return rows[0]?.id || null;
}

async function fetchMasterJson(userId: number): Promise<any> {
  const [row] = await db
    .select({ masterJson: users.masterJson, name: users.artistName, username: users.username, biography: users.biography })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row || null;
}

const SEASONAL_MAP: Record<string, { name: string; theme: string; discount: number }> = {
  '01': { name: 'winter-new-year', theme: 'Fresh Start · Minimalist · Crisp Whites', discount: 15 },
  '02': { name: 'valentines', theme: 'Love · Intimate · Warm reds and pinks', discount: 10 },
  '03': { name: 'spring-awakening', theme: 'Blossoms · Pastels · Renewal', discount: 12 },
  '04': { name: 'spring-tour', theme: 'Tour Season · Festival ready', discount: 15 },
  '05': { name: 'summer-preview', theme: 'Bright · Bold · Outdoor', discount: 10 },
  '06': { name: 'summer-drop', theme: 'Beach · Festival · Neon', discount: 20 },
  '07': { name: 'mid-summer', theme: 'Vacation · Light · Breezy', discount: 15 },
  '08': { name: 'back-to-school', theme: 'Dorm · Student · Everyday', discount: 18 },
  '09': { name: 'autumn-harvest', theme: 'Warm tones · Layering · Cozy', discount: 12 },
  '10': { name: 'halloween', theme: 'Dark · Spooky · Horror aesthetic', discount: 25 },
  '11': { name: 'black-friday', theme: 'Major discount · Fans first', discount: 30 },
  '12': { name: 'holiday-gift', theme: 'Gift-ready · Festive · Premium packaging', discount: 20 },
};

function getCurrentSeasonal() {
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return SEASONAL_MAP[month] || SEASONAL_MAP['06'];
}

// ─────────────── BUNDLES ───────────────

router.get('/bundles/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const bundles = await db
      .select()
      .from(productBundles)
      .where(and(eq(productBundles.userId, userId), eq(productBundles.isActive, true)))
      .orderBy(desc(productBundles.createdAt));

    return res.json({ success: true, bundles, count: bundles.length });
  } catch (error: any) {
    console.error('[Bundles] List error:', error);
    return res.json({ success: true, bundles: [], count: 0 });
  }
});

router.post('/bundles', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).user?.id;
    if (!clerkId) return res.status(401).json({ error: 'Unauthorized' });

    const pgId = await getPostgresUserId(clerkId);
    if (!pgId) return res.status(404).json({ error: 'User not found' });

    const { name, description, productIds, bundlePrice, imageUrl, expiresAt } = req.body;
    if (!name || !Array.isArray(productIds) || productIds.length < 2) {
      return res.status(400).json({ error: 'Bundle requires name and at least 2 products' });
    }

    // Calculate original price by summing product prices
    const products = await db
      .select({ id: merchandise.id, price: merchandise.price })
      .from(merchandise)
      .where(inArray(merchandise.id, productIds));

    const originalPrice = products.reduce((sum, p) => sum + parseFloat(p.price || '0'), 0);
    const finalBundlePrice = bundlePrice || originalPrice * 0.8; // 20% default discount
    const discountPercent = Math.round(((originalPrice - finalBundlePrice) / originalPrice) * 100);

    const [bundle] = await db.insert(productBundles).values({
      userId: pgId,
      name,
      description: description || '',
      productIds,
      originalPrice: originalPrice.toFixed(2),
      bundlePrice: finalBundlePrice.toFixed(2),
      discountPercent,
      imageUrl: imageUrl || (products[0] as any)?.images?.[0] || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    return res.json({ success: true, bundle });
  } catch (error: any) {
    console.error('[Bundles] Create error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/bundles/ai-generate/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const userData = await fetchMasterJson(userId);
    const products = await db
      .select()
      .from(merchandise)
      .where(and(eq(merchandise.userId, userId), eq(merchandise.isAvailable, true)))
      .limit(20);

    if (products.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 products to generate bundles' });
    }

    // Simple heuristic: create 3 bundles from product categories
    const byCategory: Record<string, typeof products> = {};
    products.forEach(p => {
      const cat = p.category || 'other';
      (byCategory[cat] ||= []).push(p);
    });

    const generated: any[] = [];
    const artistName = userData?.name || userData?.username || 'Artist';

    // Bundle 1: Starter Pack (cheapest 3)
    const cheapest = [...products].sort((a, b) => parseFloat(a.price) - parseFloat(b.price)).slice(0, 3);
    if (cheapest.length === 3) {
      const original = cheapest.reduce((s, p) => s + parseFloat(p.price), 0);
      const bundlePrice = original * 0.85;
      const [b] = await db.insert(productBundles).values({
        userId,
        name: `${artistName} Starter Pack`,
        description: `Start your ${artistName} collection with 3 essentials. Save 15%.`,
        productIds: cheapest.map(p => p.id),
        originalPrice: original.toFixed(2),
        bundlePrice: bundlePrice.toFixed(2),
        discountPercent: 15,
        imageUrl: cheapest[0].images?.[0],
        aiGenerated: true,
      }).returning();
      generated.push(b);
    }

    // Bundle 2: Full Drip (apparel + hoodie + accessory)
    const apparel = products.find(p => p.category === 'apparel');
    const accessory = products.find(p => p.category === 'accessories');
    const other = products.find(p => ['music', 'other'].includes(p.category || 'other') && p.id !== apparel?.id && p.id !== accessory?.id);
    if (apparel && accessory && other) {
      const items = [apparel, accessory, other];
      const original = items.reduce((s, p) => s + parseFloat(p.price), 0);
      const bundlePrice = original * 0.80;
      const [b] = await db.insert(productBundles).values({
        userId,
        name: `Full Drip — ${artistName} Edition`,
        description: `The complete ${artistName} look. Apparel + accessories + exclusive item. Save 20%.`,
        productIds: items.map(p => p.id),
        originalPrice: original.toFixed(2),
        bundlePrice: bundlePrice.toFixed(2),
        discountPercent: 20,
        imageUrl: apparel.images?.[0],
        aiGenerated: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }).returning();
      generated.push(b);
    }

    // Bundle 3: Fan Collection (top 4 by view count)
    const trending = [...products].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 4);
    if (trending.length === 4) {
      const original = trending.reduce((s, p) => s + parseFloat(p.price), 0);
      const bundlePrice = original * 0.75;
      const [b] = await db.insert(productBundles).values({
        userId,
        name: `Ultimate Fan Collection`,
        description: `Most-loved items by ${artistName} fans. 4 trending products, 25% off.`,
        productIds: trending.map(p => p.id),
        originalPrice: original.toFixed(2),
        bundlePrice: bundlePrice.toFixed(2),
        discountPercent: 25,
        imageUrl: trending[0].images?.[0],
        aiGenerated: true,
      }).returning();
      generated.push(b);
    }

    return res.json({ success: true, bundles: generated, count: generated.length });
  } catch (error: any) {
    console.error('[Bundles] AI generate error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/bundles/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).user?.id;
    const pgId = clerkId ? await getPostgresUserId(clerkId) : null;
    if (!pgId) return res.status(401).json({ error: 'Unauthorized' });

    const bundleId = parseInt(req.params.id);
    await db.delete(productBundles).where(and(eq(productBundles.id, bundleId), eq(productBundles.userId, pgId)));
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ─────────────── VIEWS / HEATMAP ───────────────

router.post('/views/track', async (req: Request, res: Response) => {
  try {
    const { merchandiseId, artistId, source, sessionId, referrer } = req.body;
    if (!merchandiseId || !artistId) return res.json({ success: false });

    const mId = parseInt(String(merchandiseId));
    const aId = parseInt(String(artistId));
    if (!Number.isFinite(mId) || !Number.isFinite(aId)) {
      return res.json({ success: false });
    }

    // Fire-and-forget insert (no await on error handling to keep it fast)
    await db.insert(productViews).values({
      merchandiseId: mId,
      artistId: aId,
      source: source || 'card',
      sessionId: sessionId || null,
      referrer: referrer || req.get('referer') || null,
      userAgent: req.get('user-agent') || null,
    }).catch(() => {/* silent */});

    // Increment the denormalized view count
    await db
      .update(merchandise)
      .set({ viewCount: sql`${merchandise.viewCount} + 1` })
      .where(eq(merchandise.id, mId))
      .catch(() => {/* silent */});

    return res.json({ success: true });
  } catch {
    return res.json({ success: false });
  }
});

router.get('/views/heatmap/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    // Views per product (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const viewsRows = await db
      .select({
        merchandiseId: productViews.merchandiseId,
        views: sql<number>`count(*)::int`,
      })
      .from(productViews)
      .where(and(eq(productViews.artistId, userId), gte(productViews.createdAt, thirtyDaysAgo)))
      .groupBy(productViews.merchandiseId);

    // Sales per product
    const salesRows = await db
      .select({
        merchandiseId: salesTransactions.merchandiseId,
        sales: sql<number>`count(*)::int`,
      })
      .from(salesTransactions)
      .where(and(
        eq(salesTransactions.artistId, userId),
        eq(salesTransactions.status, 'completed'),
        isNotNull(salesTransactions.merchandiseId)
      ))
      .groupBy(salesTransactions.merchandiseId);

    const salesMap = new Map(salesRows.map(r => [r.merchandiseId, r.sales]));

    // Merge into heatmap entries with conversion rate
    const heatmap = viewsRows.map(v => {
      const sales = v.merchandiseId ? salesMap.get(v.merchandiseId) || 0 : 0;
      const convRate = v.views > 0 ? (sales / v.views) * 100 : 0;
      return {
        merchandiseId: v.merchandiseId,
        views: v.views,
        sales,
        conversionRate: parseFloat(convRate.toFixed(2)),
      };
    }).sort((a, b) => b.views - a.views);

    return res.json({ success: true, heatmap, period: '30d' });
  } catch (error: any) {
    console.error('[Heatmap] Error:', error);
    return res.json({ success: true, heatmap: [], period: '30d' });
  }
});

// ─────────────── AI CONTENT ───────────────

router.post('/ai/rewrite-description/:productId', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).user?.id;
    const pgId = clerkId ? await getPostgresUserId(clerkId) : null;
    if (!pgId) return res.status(401).json({ error: 'Unauthorized' });

    const productId = parseInt(req.params.productId);
    const [product] = await db.select().from(merchandise).where(
      and(eq(merchandise.id, productId), eq(merchandise.userId, pgId))
    ).limit(1);

    if (!product) return res.status(404).json({ error: 'Product not found' });

    const userData = await fetchMasterJson(pgId);
    const master = userData?.masterJson as any;
    const uniqueVoice = master?.persona?.uniqueVoice || '';
    const aesthetic = master?.visual_dna?.aesthetic || '';
    const genre = master?.musical_dna?.genre || '';
    const artistName = userData?.name || 'Artist';

    // Use OpenAI to rewrite
    let newDescription = product.description || '';
    try {
      const { createTrackedOpenAI } = await import('../utils/tracked-openai');
      const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

      const prompt = `You are ${artistName}'s copywriter. Rewrite this product description in the artist's unique voice.

ARTIST CONTEXT:
- Genre: ${genre}
- Aesthetic: ${aesthetic}
- Unique voice: ${uniqueVoice}

PRODUCT: ${product.name}
CURRENT DESCRIPTION: ${product.description || 'No description'}

Rewrite the description in 2–3 short sentences (max 280 chars). Make it feel personal, authentic to the artist, and emotionally compelling. Output ONLY the rewritten description, no markdown.`;

      const response = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.8,
      });
      newDescription = response.choices[0]?.message?.content?.trim() || newDescription;
    } catch (e: any) {
      console.warn('[AI Rewrite] OpenAI failed, using fallback:', e.message);
    }

    await db.update(merchandise).set({
      description: newDescription,
      updatedAt: new Date(),
    }).where(eq(merchandise.id, productId));

    return res.json({ success: true, description: newDescription });
  } catch (error: any) {
    console.error('[AI Rewrite] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/ai/generate-design/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).user?.id;
    const pgId = clerkId ? await getPostgresUserId(clerkId) : null;
    if (!pgId) return res.status(401).json({ error: 'Unauthorized' });

    const userId = parseInt(req.params.userId);
    if (userId !== pgId) return res.status(403).json({ error: 'Forbidden' });

    // ── Blueprint Gate: Require a completed Superstar Blueprint ──
    const [bp] = await db
      .select({
        id: artistBlueprints.id,
        brandArchetype: artistBlueprints.brandArchetype,
        currentEra: artistBlueprints.currentEra,
        primaryGenre: artistBlueprints.primaryGenre,
        blueprintJson: artistBlueprints.blueprintJson,
      })
      .from(artistBlueprints)
      .where(
        and(
          eq(artistBlueprints.artistId, pgId),
          eq(artistBlueprints.generationStatus, 'completed'),
        ),
      )
      .limit(1);

    if (!bp) {
      return res.status(400).json({
        success: false,
        error: 'no_blueprint',
        message: 'You must generate your Superstar Blueprint first before creating store products. Your Blueprint unlocks a coherent visual identity for all merchandise.',
      });
    }

    const userData = await fetchMasterJson(pgId);
    const artistName = userData?.name || 'Artist';
    const profileImageUrl = (await db.select({ profileImageUrl: users.profileImageUrl }).from(users).where(eq(users.id, pgId)).limit(1))[0]?.profileImageUrl || '';
    const genre = bp.primaryGenre || userData?.masterJson?.musical_dna?.genre || 'pop';

    // Generate 6 draft products using the full luxury merchandise pipeline
    const { generateArtistMerchandise } = await import('../services/fal-service');
    const products = await generateArtistMerchandise(artistName, profileImageUrl, genre);

    const normalizeCategoryForPG = (type: string): 'apparel' | 'accessories' | 'music' | 'other' => {
      if (type === 'T-Shirt' || type === 'Hoodie') return 'apparel';
      if (type === 'Cap' || type === 'Sticker Pack' || type === 'Mug') return 'accessories';
      return 'other';
    };

    // Save all 6 products as DRAFTS — artist must review and publish each one
    const savedProducts = [];
    for (const product of products) {
      const productName = `${artistName} — ${product.name}`;
      const description = `Official ${artistName} merchandise • ${product.type} • Boostify Music`;
      const [newProduct] = await db.insert(merchandise).values({
        userId: pgId,
        name: productName,
        description,
        price: product.price.toFixed(2),
        images: product.imageUrl ? [product.imageUrl] : [],
        category: normalizeCategoryForPG(product.type),
        isAvailable: false, // Draft — artist must review + publish
        aiGeneratedDesign: true,
        isCustomDesign: false,
        removeBoostifyLogo: false,
      }).returning();
      savedProducts.push(newProduct);
    }

    return res.json({
      success: true,
      count: savedProducts.length,
      products: savedProducts,
      message: `${savedProducts.length} draft products created. Review and publish them from your store dashboard.`,
      blueprintUsed: { id: bp.id, brandArchetype: bp.brandArchetype, era: bp.currentEra },
    });
  } catch (error: any) {
    console.error('[AI Design] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─────────────── SEASONAL DROPS ───────────────

router.get('/seasonal/current/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const current = getCurrentSeasonal();
    const products = await db
      .select()
      .from(merchandise)
      .where(and(
        eq(merchandise.userId, userId),
        eq(merchandise.seasonalCollection, current.name)
      ));

    return res.json({
      success: true,
      seasonal: current,
      products,
      count: products.length,
    });
  } catch (error: any) {
    return res.json({ success: true, seasonal: getCurrentSeasonal(), products: [], count: 0 });
  }
});

router.post('/seasonal/create-drop/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).user?.id;
    const pgId = clerkId ? await getPostgresUserId(clerkId) : null;
    if (!pgId) return res.status(401).json({ error: 'Unauthorized' });

    const userId = parseInt(req.params.userId);
    if (userId !== pgId) return res.status(403).json({ error: 'Forbidden' });

    const current = getCurrentSeasonal();
    // Tag top 3 available products with current seasonal collection + apply discount
    const topProducts = await db
      .select()
      .from(merchandise)
      .where(and(eq(merchandise.userId, pgId), eq(merchandise.isAvailable, true)))
      .orderBy(desc(merchandise.viewCount))
      .limit(3);

    for (const p of topProducts) {
      await db.update(merchandise).set({
        seasonalCollection: current.name,
        productStatus: 'limited',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        updatedAt: new Date(),
      }).where(eq(merchandise.id, p.id));
    }

    return res.json({
      success: true,
      seasonal: current,
      productsTagged: topProducts.length,
    });
  } catch (error: any) {
    console.error('[Seasonal] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ─────────────── PRE-ORDERS ───────────────

router.get('/pre-orders/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });

    const products = await db
      .select()
      .from(merchandise)
      .where(and(
        eq(merchandise.userId, userId),
        eq(merchandise.productStatus, 'pre_order')
      ));

    return res.json({ success: true, products, count: products.length });
  } catch (error: any) {
    return res.json({ success: true, products: [], count: 0 });
  }
});

router.post('/pre-orders/:productId/commit', async (req: Request, res: Response) => {
  try {
    const productId = parseInt(req.params.productId);

    const [product] = await db.select().from(merchandise).where(eq(merchandise.id, productId)).limit(1);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.productStatus !== 'pre_order') {
      return res.status(400).json({ error: 'Product is not a pre-order' });
    }

    await db.update(merchandise).set({
      preOrderCurrentOrders: sql`${merchandise.preOrderCurrentOrders} + 1`,
      updatedAt: new Date(),
    }).where(eq(merchandise.id, productId));

    // If threshold met, auto-promote to active
    const newCount = (product.preOrderCurrentOrders || 0) + 1;
    const threshold = product.preOrderMinimumOrders || 0;
    const validated = threshold > 0 && newCount >= threshold;
    if (validated) {
      await db.update(merchandise).set({
        productStatus: 'active',
        updatedAt: new Date(),
      }).where(eq(merchandise.id, productId));
    }

    return res.json({
      success: true,
      newCount,
      threshold,
      validated,
    });
  } catch (error: any) {
    console.error('[Pre-orders] Commit error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
