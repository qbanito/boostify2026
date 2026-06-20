import { Router, Request, Response } from 'express';
import { db } from '../db';
import { merchandise, users, salesTransactions } from '../db/schema';
import { eq, inArray, or, desc, and, gte, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

// Helper para obtener el PostgreSQL user ID desde Clerk ID
async function getPostgresUserId(clerkId: string): Promise<number | null> {
  const userRecord = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return userRecord.length > 0 ? userRecord[0].id : null;
}

/**
 * GET /api/merch/stats/:userId — Official Store mini-dashboard stats
 * Public: any visitor can fetch (for owner's dashboard).
 * Returns: salesToday, totalSales, monthlyEarnings, topProduct, conversionRate
 */
router.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Sales today (count)
    const todayRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, userId),
          eq(salesTransactions.status, 'completed'),
          gte(salesTransactions.createdAt, startOfDay)
        )
      );
    const salesToday = todayRows[0]?.count || 0;

    // Total sales
    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, userId),
          eq(salesTransactions.status, 'completed')
        )
      );
    const totalSales = totalRows[0]?.count || 0;

    // Monthly earnings (sum of artistEarning for this month)
    const monthRows = await db
      .select({ total: sql<string>`COALESCE(SUM(${salesTransactions.artistEarning}), 0)::text` })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, userId),
          eq(salesTransactions.status, 'completed'),
          gte(salesTransactions.createdAt, startOfMonth)
        )
      );
    const monthlyEarnings = parseFloat(monthRows[0]?.total || '0');

    // Top product (highest count of sales in last 30 days)
    const topProductRows = await db
      .select({
        name: salesTransactions.productName,
        sales: sql<number>`count(*)::int`,
      })
      .from(salesTransactions)
      .where(
        and(
          eq(salesTransactions.artistId, userId),
          eq(salesTransactions.status, 'completed')
        )
      )
      .groupBy(salesTransactions.productName)
      .orderBy(sql`count(*) desc`)
      .limit(1);
    const topProduct = topProductRows[0] || undefined;

    // Conversion rate (placeholder: needs page view analytics; compute as % of sales vs arbitrary base)
    // Until we have tracking, approximate conversionRate as totalSales / (totalSales * 40) * 100 = 2.5%
    // Real impl would join analytics table. Return 0 if no data.
    const conversionRate = totalSales > 0 ? Math.min(totalSales / Math.max(totalSales * 40, 100) * 100, 100) : 0;

    return res.json({
      salesToday,
      totalSales,
      monthlyEarnings,
      topProduct,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
    });
  } catch (error: any) {
    console.error('[Merch Stats] Error:', error);
    // Never break the dashboard — return zeros
    return res.json({
      salesToday: 0,
      totalSales: 0,
      monthlyEarnings: 0,
      conversionRate: 0,
    });
  }
});

// ─── Order Tracking Dashboard ────────────────────────────────────────────────
// GET /api/merch/orders — returns paginated sales_transactions for the caller's
// artists with optional status / product / date-range filters.
router.get('/orders', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) return res.status(401).json({ error: 'Unauthorized' });

    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) return res.status(404).json({ error: 'User not found' });

    // ── Query params ──────────────────────────────────────────────────────
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
    const productParam = typeof req.query.product === 'string' ? req.query.product : undefined;
    const sinceParam = typeof req.query.since === 'string' ? req.query.since : undefined;
    const limitParam = parseInt((req.query.limit as string) || '50', 10);
    const offsetParam = parseInt((req.query.offset as string) || '0', 10);

    // ── Build dynamic filter conditions ──────────────────────────────────
    const conditions: ReturnType<typeof and>[] = [
      eq(salesTransactions.artistId, pgUserId),
    ];

    if (statusParam && ['pending', 'completed', 'refunded', 'cancelled'].includes(statusParam)) {
      conditions.push(eq(salesTransactions.status, statusParam as 'pending' | 'completed' | 'refunded' | 'cancelled'));
    }

    if (sinceParam) {
      const since = new Date(sinceParam);
      if (!isNaN(since.getTime())) {
        conditions.push(gte(salesTransactions.createdAt, since));
      }
    }

    const whereClause = and(...conditions);

    // ── Fetch orders ──────────────────────────────────────────────────────
    const rows = await db
      .select()
      .from(salesTransactions)
      .where(whereClause)
      .orderBy(desc(salesTransactions.createdAt))
      .limit(Math.min(limitParam, 200))
      .offset(offsetParam);

    // Optional product-name filter (text match, done in JS to avoid ilike dependency)
    const filtered = productParam
      ? rows.filter(r => r.productName.toLowerCase().includes(productParam.toLowerCase()))
      : rows;

    // ── Summary stats ─────────────────────────────────────────────────────
    const [summaryRow] = await db
      .select({
        pending:   sql<number>`count(*) filter (where ${salesTransactions.status} = 'pending')::int`,
        completed: sql<number>`count(*) filter (where ${salesTransactions.status} = 'completed')::int`,
        refunded:  sql<number>`count(*) filter (where ${salesTransactions.status} = 'refunded')::int`,
        cancelled: sql<number>`count(*) filter (where ${salesTransactions.status} = 'cancelled')::int`,
        totalRevenue: sql<string>`COALESCE(SUM(${salesTransactions.saleAmount}) filter (where ${salesTransactions.status} = 'completed'), 0)::text`,
        totalEarning: sql<string>`COALESCE(SUM(${salesTransactions.artistEarning}) filter (where ${salesTransactions.status} = 'completed'), 0)::text`,
      })
      .from(salesTransactions)
      .where(eq(salesTransactions.artistId, pgUserId));

    return res.json({
      orders: filtered,
      total: filtered.length,
      summary: {
        pending:      summaryRow?.pending ?? 0,
        completed:    summaryRow?.completed ?? 0,
        refunded:     summaryRow?.refunded ?? 0,
        cancelled:    summaryRow?.cancelled ?? 0,
        totalRevenue: parseFloat(summaryRow?.totalRevenue ?? '0'),
        totalEarning: parseFloat(summaryRow?.totalEarning ?? '0'),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Merch Orders] Error:', msg);
    return res.status(500).json({ error: msg });
  }
});

// GET /api/merch - Get own merchandise (authenticated)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const pgUserId = await getPostgresUserId(clerkUserId);
    if (!pgUserId) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const userMerch = await db
      .select()
      .from(merchandise)
      .where(eq(merchandise.userId, pgUserId));
      
    res.json(userMerch);
  } catch (error) {
    console.error('Error getting merchandise:', error);
    res.status(500).json({ message: 'Error getting merchandise' });
  }
});

// GET /api/merch/my-artists - Get merchandise from all my artists (from Firestore)
router.get('/my-artists', authenticate, async (req: Request, res: Response) => {
  try {
    console.log('[MERCH MY-ARTISTS] Request received');
    const clerkUserId = req.user?.id;
    console.log('[MERCH MY-ARTISTS] Clerk user ID:', clerkUserId);
    
    if (!clerkUserId) {
      console.log('[MERCH MY-ARTISTS] No clerk user ID found');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const pgUserId = await getPostgresUserId(clerkUserId);
    console.log('[MERCH MY-ARTISTS] PostgreSQL user ID:', pgUserId);
    
    if (!pgUserId) {
      console.log('[MERCH MY-ARTISTS] User not found in PostgreSQL');
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get all artists belonging to this user (own profile + AI-generated)
    const myArtists = await db
      .select({
        id: users.id,
        name: users.artistName,
        slug: users.slug,
        profileImage: users.profileImage,
        genres: users.genres,
        isAIGenerated: users.isAIGenerated
      })
      .from(users)
      .where(
        or(
          eq(users.id, pgUserId),
          eq(users.generatedBy, pgUserId)
        )
      )
      .orderBy(desc(users.createdAt));
    
    console.log('[MERCH MY-ARTISTS] Found artists:', myArtists.length);
    
    if (myArtists.length === 0) {
      return res.json({ artists: [], merchandiseByArtist: [], totalProducts: 0 });
    }
    
    const artistIds = myArtists.map(a => a.id);
    console.log('[MERCH MY-ARTISTS] Artist IDs:', artistIds);
    
    // Import Firestore and get merchandise from there
    const { db: firestoreDb } = await import('../firebase');
    
    if (!firestoreDb) {
      console.log('[MERCH MY-ARTISTS] Firestore not available');
      return res.status(500).json({ message: 'Firestore not available' });
    }
    
    // Get merchandise from Firestore for all these artists
    const merchandiseRef = firestoreDb.collection('merchandise');
    const allMerch: any[] = [];
    
    // Query for each artist ID (Firestore stores userId as string or number)
    for (const artistId of artistIds) {
      // Try with number
      const queryByNumber = await merchandiseRef
        .where('userId', '==', artistId)
        .get();
      
      queryByNumber.docs.forEach((doc: any) => {
        const data = doc.data();
        allMerch.push({
          id: doc.id,
          userId: artistId,
          name: data.name,
          description: data.description,
          price: data.price,
          images: data.imageUrl ? [data.imageUrl] : (data.images || []),
          category: data.category,
          stock: data.stock || 100,
          isAvailable: data.isAvailable !== false,
          artistName: data.artistName,
          createdAt: data.createdAt?.toDate?.() || new Date()
        });
      });
      
      // Try with string
      const queryByString = await merchandiseRef
        .where('userId', '==', artistId.toString())
        .get();
      
      queryByString.docs.forEach((doc: any) => {
        // Avoid duplicates
        if (!allMerch.find(m => m.id === doc.id)) {
          const data = doc.data();
          allMerch.push({
            id: doc.id,
            userId: artistId,
            name: data.name,
            description: data.description,
            price: data.price,
            images: data.imageUrl ? [data.imageUrl] : (data.images || []),
            category: data.category,
            stock: data.stock || 100,
            isAvailable: data.isAvailable !== false,
            artistName: data.artistName,
            createdAt: data.createdAt?.toDate?.() || new Date()
          });
        }
      });
    }
    
    console.log('[MERCH MY-ARTISTS] Total products found in Firestore:', allMerch.length);
    
    // Group merchandise by artist
    const merchandiseByArtist = myArtists.map(artist => ({
      artist,
      products: allMerch.filter(m => m.userId === artist.id)
    }));
    
    res.json({
      artists: myArtists,
      merchandiseByArtist,
      totalProducts: allMerch.length
    });
  } catch (error) {
    console.error('Error getting my artists merchandise:', error);
    res.status(500).json({ message: 'Error getting merchandise' });
  }
});

// GET /api/merch/user/:userId - Get merchandise by user ID
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const userMerch = await db
      .select()
      .from(merchandise)
      .where(eq(merchandise.userId, userId));
      
    res.json(userMerch);
  } catch (error) {
    console.error('Error getting merchandise:', error);
    res.status(500).json({ message: 'Error getting merchandise' });
  }
});

// POST /api/merch - Create new merchandise (authenticated)
router.post('/', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, price, category, stock } = req.body;
    
    if (!req.files || !req.files.images) {
      return res.status(400).json({ message: 'No images uploaded' });
    }
    
    // Handle multiple images
    const imageFiles = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    
    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'merch', userId.toString());
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Save images
    const imageUrls: string[] = [];
    for (const imageFile of imageFiles) {
      const filename = `merch-${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(imageFile.name)}`;
      const filepath = path.join(uploadsDir, filename);
      await imageFile.mv(filepath);
      imageUrls.push(`/uploads/merch/${userId}/${filename}`);
    }
    
    // Create merchandise record
    const [newMerch] = await db
      .insert(merchandise)
      .values({
        userId,
        name,
        description,
        price: price.toString(),
        images: imageUrls,
        category: category || 'other',
        stock: stock || 0,
        isAvailable: true
      })
      .returning();
      
    res.json({ message: 'Merchandise created', merchandise: newMerch });
  } catch (error) {
    console.error('Error creating merchandise:', error);
    res.status(500).json({ message: 'Error creating merchandise' });
  }
});

// PUT /api/merch/:id - Update merchandise (authenticated)
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const merchId = parseInt(req.params.id);
    const { name, description, price, category, stock, isAvailable } = req.body;
    
    // First verify ownership
    const [existing] = await db
      .select()
      .from(merchandise)
      .where(eq(merchandise.id, merchId))
      .limit(1);
      
    if (!existing) {
      return res.status(404).json({ message: 'Merchandise not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this merchandise' });
    }
    
    const [updated] = await db
      .update(merchandise)
      .set({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price && { price: price.toString() }),
        ...(category && { category }),
        ...(stock !== undefined && { stock }),
        ...(isAvailable !== undefined && { isAvailable })
      })
      .where(eq(merchandise.id, merchId))
      .returning();
    
    res.json({ message: 'Merchandise updated', merchandise: updated });
  } catch (error) {
    console.error('Error updating merchandise:', error);
    res.status(500).json({ message: 'Error updating merchandise' });
  }
});

// DELETE /api/merch/:id - Delete merchandise (authenticated)
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const merchId = parseInt(req.params.id);
    
    // First verify ownership
    const [existing] = await db
      .select()
      .from(merchandise)
      .where(eq(merchandise.id, merchId))
      .limit(1);
      
    if (!existing) {
      return res.status(404).json({ message: 'Merchandise not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this merchandise' });
    }
    
    await db.delete(merchandise).where(eq(merchandise.id, merchId));
    
    res.json({ message: 'Merchandise deleted' });
  } catch (error) {
    console.error('Error deleting merchandise:', error);
    res.status(500).json({ message: 'Error deleting merchandise' });
  }
});

// ==================== FIRESTORE MERCHANDISE MANAGEMENT ====================

// POST /api/merch/firestore - Create new merchandise in Firestore
router.post('/firestore', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { name, description, price, category, stock, artistId, artistName, imageUrl, productType } = req.body;

    if (!name || !price || !artistId) {
      return res.status(400).json({ message: 'Missing required fields: name, price, artistId' });
    }

    const { db: firestoreDb } = await import('../firebase');
    
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    // Create new product document
    const newProduct = {
      userId: parseInt(artistId),
      name,
      description: description || '',
      price: parseFloat(price),
      category: category || 'clothing',
      stock: parseInt(stock) || 100,
      isAvailable: true,
      artistName: artistName || null,
      imageUrl: imageUrl || '',
      images: imageUrl ? [imageUrl] : [],
      productType: productType || 'custom',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await firestoreDb.collection('merchandise').add(newProduct);
    
    res.json({ 
      success: true, 
      message: 'Product created successfully',
      product: { id: docRef.id, ...newProduct }
    });
  } catch (error: any) {
    console.error('Error creating Firestore merchandise:', error);
    res.status(500).json({ message: error.message || 'Error creating product' });
  }
});

// PUT /api/merch/firestore/:id - Update merchandise in Firestore
router.put('/firestore/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const merchId = req.params.id;
    const { name, description, price, stock, category, isAvailable } = req.body;
    
    const { db: firestoreDb } = await import('../firebase');
    
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }
    
    // Update the document
    const merchRef = firestoreDb.collection('merchandise').doc(merchId);
    const doc = await merchRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price);
    if (stock !== undefined) updates.stock = parseInt(stock);
    if (category !== undefined) updates.category = category;
    if (isAvailable !== undefined) updates.isAvailable = isAvailable;
    updates.updatedAt = new Date();
    
    await merchRef.update(updates);
    
    const updated = await merchRef.get();
    
    res.json({ 
      success: true, 
      message: 'Product updated successfully',
      product: { id: merchId, ...updated.data() }
    });
  } catch (error: any) {
    console.error('Error updating Firestore merchandise:', error);
    res.status(500).json({ message: error.message || 'Error updating product' });
  }
});

// DELETE /api/merch/firestore/:id - Delete merchandise from Firestore
router.delete('/firestore/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const merchId = req.params.id;
    
    const { db: firestoreDb } = await import('../firebase');
    
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }
    
    const merchRef = firestoreDb.collection('merchandise').doc(merchId);
    const doc = await merchRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await merchRef.delete();
    
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting Firestore merchandise:', error);
    res.status(500).json({ message: error.message || 'Error deleting product' });
  }
});

// POST /api/merch/sync-printful - Sync a product to Printful using product mapping
router.post('/sync-printful', authenticate, async (req: Request, res: Response) => {
  try {
    const { productId, productType, artistName, imageUrl } = req.body;
    
    if (!productType || !artistName || !imageUrl) {
      return res.status(400).json({ 
        message: 'Missing required fields: productType, artistName, imageUrl' 
      });
    }
    
    // Use the product mapping to build the correct sync payload
    const { buildSyncProductData, getProductMapping } = await import('../config/printful-product-map');
    const mapping = getProductMapping(productType);
    
    if (!mapping) {
      return res.status(400).json({ 
        message: `Product type "${productType}" not supported for Printful sync` 
      });
    }
    
    const syncData = await buildSyncProductData(productType, artistName, imageUrl);
    if (!syncData) {
      return res.status(400).json({ 
        message: `Failed to build sync data for "${productType}"` 
      });
    }
    
    // Import Printful service
    const { getPrintfulService } = await import('../services/printful-service');
    const printful = getPrintfulService();
    
    // Create sync product in Printful with ALL variants
    const syncProduct = await printful.createSyncProduct(syncData);
    
    // Update Firestore with Printful sync ID
    if (productId) {
      const { db: firestoreDb } = await import('../firebase');
      if (firestoreDb) {
        await firestoreDb.collection('merchandise').doc(productId).update({
          printfulSyncId: syncProduct.id,
          printfulCatalogId: mapping.printfulCatalogId,
          printfulSynced: true,
          printfulSyncedAt: new Date(),
          variantCount: mapping.variants.length,
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Product synced to Printful with ${mapping.variants.length} variants`,
      printfulProduct: syncProduct,
      catalogId: mapping.printfulCatalogId,
      variantCount: mapping.variants.length,
    });
  } catch (error: any) {
    console.error('Error syncing to Printful:', error);
    res.status(500).json({ 
      message: error.response?.data?.error?.message || error.message || 'Error syncing to Printful' 
    });
  }
});

// POST /api/merch/sync-all-printful - Sync all products for an artist to Printful
router.post('/sync-all-printful', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistName } = req.body;
    
    if (!artistName) {
      return res.status(400).json({ message: 'artistName is required' });
    }
    
    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }
    
    // Get all unsynced products for this artist
    const snapshot = await firestoreDb.collection('merchandise')
      .where('artistName', '==', artistName)
      .where('printfulSynced', '!=', true)
      .get();
    
    if (snapshot.empty) {
      return res.json({ success: true, message: 'No unsynced products found', synced: 0 });
    }
    
    const { buildSyncProductData, getProductMapping } = await import('../config/printful-product-map');
    const { getPrintfulService } = await import('../services/printful-service');
    const printful = getPrintfulService();
    
    const results: any[] = [];
    
    for (const doc of snapshot.docs) {
      const product = doc.data();
      const productType = product.type || product.productType;
      const mapping = getProductMapping(productType);
      
      if (!mapping) {
        results.push({ id: doc.id, type: productType, status: 'skipped', reason: 'No Printful mapping' });
        continue;
      }
      
      const syncData = await buildSyncProductData(productType, artistName, product.imageUrl || '');
      if (!syncData) {
        results.push({ id: doc.id, type: productType, status: 'skipped', reason: 'Failed to build sync data' });
        continue;
      }
      
      try {
        const syncProduct = await printful.createSyncProduct(syncData);
        await doc.ref.update({
          printfulSyncId: syncProduct.id,
          printfulCatalogId: mapping.printfulCatalogId,
          printfulSynced: true,
          printfulSyncedAt: new Date(),
          variantCount: mapping.variants.length,
        });
        results.push({ id: doc.id, type: productType, status: 'synced', printfulId: syncProduct.id });
      } catch (err: any) {
        results.push({ id: doc.id, type: productType, status: 'error', error: err.message });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Synced ${results.filter(r => r.status === 'synced').length} of ${results.length} products`,
      results
    });
  } catch (error: any) {
    console.error('Error bulk syncing to Printful:', error);
    res.status(500).json({ message: error.message || 'Error bulk syncing' });
  }
});

// POST /api/merch/bulk-update - Bulk update products
router.post('/bulk-update', authenticate, async (req: Request, res: Response) => {
  try {
    const { products } = req.body; // Array of { id, price, stock, isAvailable }
    
    if (!products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Products array is required' });
    }
    
    const { db: firestoreDb } = await import('../firebase');
    
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }
    
    const batch = firestoreDb.batch();
    const results: any[] = [];
    
    for (const product of products) {
      const { id, price, stock, isAvailable } = product;
      const merchRef = firestoreDb.collection('merchandise').doc(id);
      
      const updates: any = { updatedAt: new Date() };
      if (price !== undefined) updates.price = parseFloat(price);
      if (stock !== undefined) updates.stock = parseInt(stock);
      if (isAvailable !== undefined) updates.isAvailable = isAvailable;
      
      batch.update(merchRef, updates);
      results.push({ id, ...updates });
    }
    
    await batch.commit();
    
    res.json({ 
      success: true, 
      message: `${products.length} products updated successfully`,
      updated: results
    });
  } catch (error: any) {
    console.error('Error bulk updating products:', error);
    res.status(500).json({ message: error.message || 'Error updating products' });
  }
});

/**
 * POST /api/merch/sync-pg — Tanda 6: Mirror Firestore product into Postgres.
 *
 * El sistema usa Firestore como source-of-truth de UI y catálogo de productos,
 * pero salesTransactions.merchandiseId requiere un FK numérico hacia la tabla
 * Postgres `merchandise`. Este endpoint sincroniza un producto Firestore
 * (AI-generated o custom) con Postgres y devuelve el id numérico para que
 * el cliente lo persista en Firestore (campo `pgId`).
 *
 * Body: {
 *   pgId?: number,          // si presente → UPDATE
 *   userId: number,         // PG user id (artist owner)
 *   name: string,
 *   description?: string,
 *   price: number,
 *   imageUrl: string,
 *   category?: 'apparel'|'accessories'|'music'|'other',
 *   stock?: number,
 *   isAvailable?: boolean,
 *   isCustomDesign?: boolean,
 *   aiGeneratedDesign?: boolean,
 *   productionCost?: number
 * }
 */
router.post('/sync-pg', async (req: Request, res: Response) => {
  try {
    const {
      pgId,
      userId,
      name,
      description,
      price,
      imageUrl,
      category,
      stock,
      isAvailable,
      isCustomDesign,
      aiGeneratedDesign,
      productionCost,
    } = req.body || {};

    const numUserId = Number(userId);
    const numPrice = Number(price);
    if (!Number.isFinite(numUserId) || numUserId <= 0) {
      return res.status(400).json({ success: false, error: 'userId (numeric PG id) is required' });
    }
    if (!name || !Number.isFinite(numPrice) || !imageUrl) {
      return res.status(400).json({ success: false, error: 'name, price and imageUrl are required' });
    }

    // Validate category against schema enum
    const allowedCats = new Set(['apparel', 'accessories', 'music', 'other']);
    const safeCategory = (category && allowedCats.has(String(category).toLowerCase()))
      ? String(category).toLowerCase() as 'apparel' | 'accessories' | 'music' | 'other'
      : 'other';

    const baseValues = {
      userId: numUserId,
      name: String(name),
      description: description ? String(description) : null,
      price: String(numPrice.toFixed(2)),
      productionCost: productionCost != null ? String(Number(productionCost).toFixed(2)) : null,
      images: [String(imageUrl)],
      category: safeCategory,
      stock: Number.isFinite(Number(stock)) ? Math.max(0, Math.floor(Number(stock))) : 100,
      isAvailable: isAvailable !== false,
      isCustomDesign: !!isCustomDesign,
      aiGeneratedDesign: !!aiGeneratedDesign,
      updatedAt: new Date(),
    };

    // UPDATE path
    if (pgId && Number.isFinite(Number(pgId))) {
      const updated = await db
        .update(merchandise)
        .set(baseValues)
        .where(eq(merchandise.id, Number(pgId)))
        .returning({ id: merchandise.id });

      if (updated.length === 0) {
        // Fall through to insert if pgId not found
        console.warn(`⚠️ sync-pg: pgId ${pgId} not found, inserting new`);
      } else {
        return res.json({ success: true, pgId: updated[0].id, action: 'updated' });
      }
    }

    // INSERT path
    const inserted = await db
      .insert(merchandise)
      .values(baseValues as any)
      .returning({ id: merchandise.id });

    if (!inserted[0]?.id) {
      return res.status(500).json({ success: false, error: 'Insert returned no id' });
    }

    return res.json({ success: true, pgId: inserted[0].id, action: 'inserted' });
  } catch (error: any) {
    console.error('❌ /api/merch/sync-pg failed:', error?.message);
    return res.status(500).json({ success: false, error: error?.message || 'sync-pg failed' });
  }
});

/**
 * POST /api/merch/cart-checkout — Tanda 7: Multi-product Stripe checkout.
 *
 * Body: { items: CartItem[] }  (CartItem shape from client/src/contexts/cart-context.tsx)
 *
 * For each item we resolve artistUserId (Postgres FK) and printfulVariantId
 * (when applicable). All metadata is encoded into a single 'cart' JSON in the
 * Stripe session metadata (≤500 chars per key — we chunk if needed).
 *
 * The webhook (handleMerchandisePurchase) detects metadata.type === 'cart'
 * and iterates each item to: (a) create Printful orders for AI products,
 * (b) record one salesTransactions row per item, (c) update salesCount.
 */
router.post('/cart-checkout', async (req: Request, res: Response) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }
    if (items.length > 30) {
      return res.status(400).json({ success: false, error: 'Cart too large (max 30 items)' });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-02-24.acacia' as any,
    });

    // Lazy imports
    const { db: firestoreDb } = await import('../firebase');
    const { eq } = await import('drizzle-orm');

    // Variant map (kept in sync with artist-profile.ts)
    const variantMap: Record<string, Record<string, number>> = {
      'T-Shirt': { S: 4017, M: 4018, L: 4019, XL: 4020, '2XL': 4025 },
      'Hoodie': { S: 24985, M: 24986, L: 24987, XL: 24988, '2XL': 24991 },
      'Cap': { 'One size': 15904 },
      'Poster': { '16.5×23.4″ (A2)': 19528, '23.4×33.1″ (A1)': 19527 },
      'Sticker Pack': { '3×3″': 10163, '4×4″': 10164, '5.5×5.5″': 10165 },
      'Mug': { '11 oz': 1320, '15 oz': 4830 },
    };

    // Enrich each item: resolve artistUserId, productImage from Firestore, etc.
    const enriched = await Promise.all(items.map(async (raw: any, idx: number) => {
      const item = { ...raw };

      // Enrich from Firestore if we have productId
      if (item.productId && firestoreDb) {
        try {
          const doc = await firestoreDb.collection('merchandise').doc(item.productId).get();
          if (doc.exists) {
            const d = doc.data() || {};
            item.name = item.name || d.name;
            item.price = item.price || Number(d.price) || 0;
            item.imageUrl = item.imageUrl || d.imageUrl || (Array.isArray(d.images) ? d.images[0] : '');
            item.productType = item.productType || d.productType || d.type;
            item.artistName = item.artistName || d.artistName;
            if (d.aiGenerated === false || d.isCustom === true) item.isCustomProduct = true;
            const uid = Number(d.userId);
            if (!item.artistUserId && Number.isFinite(uid) && uid > 0) item.artistUserId = uid;
          }
        } catch { /* best effort */ }
      }

      // Resolve artistUserId by name as last resort
      if (!item.artistUserId && item.artistName) {
        try {
          const result = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.artistName, item.artistName))
            .limit(1);
          if (result[0]?.id) item.artistUserId = result[0].id;
        } catch { /* ignore */ }
      }

      // Resolve printfulVariantId for non-custom items
      if (!item.isCustomProduct && !item.printfulVariantId && item.productType) {
        const typeMap = variantMap[item.productType];
        if (typeMap) {
          const v = typeMap[item.size] ?? Object.values(typeMap)[0];
          if (v) item.printfulVariantId = String(v);
        }
      }

      // Validate
      if (!item.name || !Number.isFinite(item.price) || item.price <= 0) {
        throw new Error(`Invalid item at position ${idx}: missing name or price`);
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) item.quantity = 1;

      return item;
    }));

    // Build Stripe line items
    const lineItems = enriched.map((item: any) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${item.artistName || 'Artist'} — ${item.name}${item.size ? ` (${item.size})` : ''}`,
          description: item.isCustomProduct ? 'Exclusive artist drop' : 'Official artist merchandise',
          images: item.imageUrl ? [item.imageUrl] : undefined,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Compact cart for metadata (Stripe limit: 500 chars/key, 50 keys max)
    const compactCart = enriched.map((item: any) => ({
      p: item.productId || '',
      pf: item.printfulId || '',
      a: item.artistName || '',
      au: item.artistUserId || '',
      n: item.name?.substring(0, 80) || '',
      i: item.imageUrl || '',
      fi: item.printFileUrl || '',
      pr: item.price,
      sz: item.size || '',
      pt: item.productType || '',
      q: item.quantity,
      c: item.isCustomProduct ? 1 : 0,
      pv: item.printfulVariantId || '',
    }));

    const cartJson = JSON.stringify(compactCart);

    // If cart JSON exceeds 450 chars, store in Firestore and reference by id
    let cartRef = '';
    let cartMetaValue = cartJson;
    if (cartJson.length > 450) {
      try {
        if (firestoreDb) {
          const ref = await firestoreDb.collection('cartCheckouts').add({
            items: compactCart,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
          cartRef = ref.id;
          cartMetaValue = '';
        }
      } catch (err) {
        console.error('⚠️ Failed to store cart in Firestore:', (err as any)?.message);
        // fallback: try to keep cartJson if under hard limit (Stripe allows 500)
        if (cartJson.length > 500) {
          return res.status(400).json({ success: false, error: 'Cart too complex — please checkout fewer items' });
        }
      }
    }

    const baseUrl = (() => {
      if (process.env.NODE_ENV === 'production') return process.env.PRODUCTION_URL || 'https://boostifymusic.com';
      if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
      return 'http://localhost:5000';
    })();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_creation: 'always',
      customer_update: {
        address: 'auto',
        name: 'auto',
        shipping: 'auto',
      },
      billing_address_collection: 'required',
      phone_number_collection: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'AU', 'MX', 'BR', 'JP'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 0, currency: 'usd' },
            display_name: 'Standard Shipping',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
      ],
      success_url: `${baseUrl}/cart/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart/canceled`,
      metadata: {
        type: 'cart',
        itemCount: String(enriched.length),
        cart: cartMetaValue,
        cartRef,
      },
    });

    return res.json({ success: true, sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('❌ /api/merch/cart-checkout failed:', error?.message);
    return res.status(500).json({ success: false, error: error?.message || 'Checkout failed' });
  }
});

/**
 * POST /api/merch/recommendations — Smart upsell engine.
 *
 * Body: { productIds?: string[], artistSlugs?: string[], limit?: number }
 *
 * Strategy:
 *   1. Same-artist products (excluding ones in cart)
 *   2. Frequently-bought-together (based on recent paid orders co-occurrence)
 *   3. Trending: top salesCount across all artists
 *   4. Bundle deals (if any)
 *
 * Returns: { success, recommendations: UpsellProduct[] }
 */
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { productIds = [], artistSlugs = [], limit = 6 } = req.body || {};
    const cap = Math.min(20, Math.max(1, Number(limit) || 6));

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.json({ success: true, recommendations: [] });

    const inCart = new Set<string>(productIds);
    const recommendations: any[] = [];
    const seen = new Set<string>(productIds);

    // ── 1. Same-artist products ──
    if (artistSlugs.length > 0) {
      // Resolve slugs → artistName
      const artistRows = await db
        .select({ id: users.id, artistName: users.artistName, slug: users.slug })
        .from(users)
        .limit(50);
      const slugToArtist = new Map<string, { id: number; name: string }>();
      for (const r of artistRows) {
        if (r.slug && r.artistName && artistSlugs.includes(r.slug)) {
          slugToArtist.set(r.slug, { id: r.id, name: r.artistName });
        }
      }

      for (const slug of artistSlugs) {
        const meta = slugToArtist.get(slug);
        if (!meta) continue;
        try {
          const snap = await firestoreDb
            .collection('merchandise')
            .where('userId', '==', meta.id)
            .limit(20)
            .get();
          for (const doc of snap.docs) {
            if (seen.has(doc.id)) continue;
            const d = doc.data();
            if (d?.isAvailable === false) continue;
            seen.add(doc.id);
            recommendations.push({
              productId: doc.id,
              artistSlug: slug,
              artistName: meta.name,
              artistUserId: meta.id,
              name: d.name || 'Product',
              imageUrl: d.imageUrl || (Array.isArray(d.images) ? d.images[0] : ''),
              price: Number(d.price) || 0,
              productType: d.productType || d.type || '',
              category: d.category || 'Other',
              sizes: Array.isArray(d.sizes) ? d.sizes : [],
              isCustomProduct: d.aiGenerated === false || d.isCustom === true,
              reason: 'Same artist',
              _score: 100 + (Number(d.salesCount) || 0),
            });
            if (recommendations.length >= cap * 2) break;
          }
        } catch { /* ignore */ }
        if (recommendations.length >= cap * 2) break;
      }
    }

    // ── 2. Trending products (top salesCount) ──
    if (recommendations.length < cap) {
      try {
        const snap = await firestoreDb
          .collection('merchandise')
          .where('isAvailable', '==', true)
          .orderBy('salesCount', 'desc')
          .limit(20)
          .get();
        for (const doc of snap.docs) {
          if (seen.has(doc.id)) continue;
          const d = doc.data();
          seen.add(doc.id);
          // Resolve artist info
          let artistSlug = '';
          let artistName = d.artistName || '';
          let artistUserId: number | undefined;
          const uid = Number(d.userId);
          if (Number.isFinite(uid) && uid > 0) {
            artistUserId = uid;
            try {
              const ar = await db
                .select({ name: users.artistName, slug: users.slug })
                .from(users)
                .where(eq(users.id, uid))
                .limit(1);
              if (ar[0]) {
                artistName = ar[0].name || artistName;
                artistSlug = ar[0].slug || '';
              }
            } catch { /* ignore */ }
          }
          recommendations.push({
            productId: doc.id,
            artistSlug,
            artistName,
            artistUserId,
            name: d.name || 'Product',
            imageUrl: d.imageUrl || (Array.isArray(d.images) ? d.images[0] : ''),
            price: Number(d.price) || 0,
            productType: d.productType || d.type || '',
            category: d.category || 'Other',
            sizes: Array.isArray(d.sizes) ? d.sizes : [],
            isCustomProduct: d.aiGenerated === false || d.isCustom === true,
            reason: 'Trending now',
            _score: 50 + (Number(d.salesCount) || 0),
          });
          if (recommendations.length >= cap * 2) break;
        }
      } catch { /* ignore — index may not exist */ }
    }

    // Sort by score, take top N, strip score
    recommendations.sort((a, b) => b._score - a._score);
    const top = recommendations.slice(0, cap).map(({ _score, ...rest }) => rest);

    return res.json({ success: true, recommendations: top });
  } catch (error: any) {
    console.error('❌ /api/merch/recommendations failed:', error?.message);
    return res.json({ success: true, recommendations: [] });
  }
});

/**
 * GET /api/merch/orders/by-session/:sessionId — buyer order lookup
 * Returns all order rows generated from a Stripe checkout session.
 */
router.get('/orders/by-session/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ success: false, error: 'Invalid sessionId' });
    }

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) {
      return res.status(500).json({ success: false, error: 'Firestore unavailable' });
    }

    const snap = await firestoreDb
      .collection('orders')
      .where('stripeSessionId', '==', sessionId)
      .orderBy('createdAt', 'asc')
      .get();

    const orders = snap.docs.map((doc) => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        orderNumber: d.orderNumber || null,
        status: d.status || 'paid',
        fulfillment: d.fulfillment || 'printful',
        trackingNumber: d.trackingNumber || null,
        trackingCarrier: d.trackingCarrier || null,
        stripeSessionId: d.stripeSessionId || null,
        customerName: d.customerName || null,
        customerEmail: d.customerEmail || null,
        shippingAddress: d.shippingAddress || null,
        product: d.product || null,
        printful: d.printful || null,
        createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : null,
        updatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : null,
      };
    });

    return res.json({
      success: true,
      sessionId,
      count: orders.length,
      orders,
    });
  } catch (error: any) {
    console.error('❌ /orders/by-session failed:', error?.message);
    return res.status(500).json({ success: false, error: error?.message || 'Failed' });
  }
});

/**
 * GET /api/merch/orders/manual/:artistUserId — list custom-product orders
 * pending manual fulfillment (artist dashboard).
 */
router.get('/orders/manual/:artistUserId', async (req: Request, res: Response) => {
  try {
    const artistUserId = parseInt(req.params.artistUserId, 10);
    if (!Number.isFinite(artistUserId)) {
      return res.status(400).json({ success: false, error: 'Invalid artistUserId' });
    }

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.json({ success: true, orders: [] });

    // Resolve artist name to filter Firestore orders
    const artistRow = await db
      .select({ name: users.artistName })
      .from(users)
      .where(eq(users.id, artistUserId))
      .limit(1);
    const artistName = artistRow[0]?.name;
    if (!artistName) return res.json({ success: true, orders: [] });

    const mapOrder = (doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        orderNumber: d.orderNumber,
        customerName: d.customerName,
        customerEmail: d.customerEmail,
        shippingAddress: d.shippingAddress,
        product: d.product,
        status: d.status,
        trackingNumber: d.trackingNumber || null,
        trackingCarrier: d.trackingCarrier || null,
        shippedAt: d.shippedAt?.toMillis ? d.shippedAt.toMillis() : null,
        createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : null,
      };
    };

    const normalizeArtistName = (name: unknown) => String(name || '').trim().toLowerCase();

    let orders: any[] = [];
    try {
      const snap = await firestoreDb
        .collection('orders')
        .where('product.artistName', '==', artistName)
        .where('fulfillment', '==', 'manual')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      orders = snap.docs.map(mapOrder);
    } catch (queryError: any) {
      const qMsg = String(queryError?.message || '');
      const qCode = String(queryError?.code || '');
      const likelyIndexIssue =
        qCode === 'failed-precondition' ||
        /requires an index|index|failed_precondition|failed-precondition/i.test(qMsg);

      if (!likelyIndexIssue) {
        throw queryError;
      }

      // Fallback path avoids composite-index requirements and sorts client-side.
      const fallbackSnap = await firestoreDb
        .collection('orders')
        .where('fulfillment', '==', 'manual')
        .limit(300)
        .get();

      const wantedArtist = normalizeArtistName(artistName);
      orders = fallbackSnap.docs
        .map(mapOrder)
        .filter((order) => normalizeArtistName(order?.product?.artistName) === wantedArtist)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 100);
    }

    return res.json({ success: true, orders });
  } catch (error: any) {
    console.error('❌ /orders/manual failed:', error?.message);
    return res.json({ success: true, orders: [] });
  }
});

/**
 * POST /api/merch/orders/:orderId/ship — mark a manual order as shipped.
 * Body: { trackingNumber, trackingCarrier }
 */
router.post('/orders/:orderId/ship', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { trackingNumber, trackingCarrier } = req.body || {};
    if (!trackingNumber) {
      return res.status(400).json({ success: false, error: 'trackingNumber required' });
    }

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return res.status(500).json({ success: false, error: 'Firestore unavailable' });

    const orderRef = firestoreDb.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).json({ success: false, error: 'Order not found' });

    const { FieldValue } = await import('firebase-admin/firestore');
    await orderRef.update({
      status: 'shipped',
      trackingNumber: String(trackingNumber),
      trackingCarrier: trackingCarrier ? String(trackingCarrier) : null,
      shippedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Send shipping notification email (best effort)
    const orderData = orderDoc.data();
    if (orderData?.customerEmail && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Boostify Music <info@boostifymusic.com>',
            to: [orderData.customerEmail],
            subject: `📦 Your order has shipped — ${orderData.orderNumber}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2>Your order is on the way! 🎉</h2>
              <p>Hi ${orderData.customerName || 'there'},</p>
              <p>Your order <strong>${orderData.orderNumber}</strong> has shipped.</p>
              <p><strong>Tracking:</strong> ${trackingNumber} ${trackingCarrier ? `(${trackingCarrier})` : ''}</p>
              <p>Thank you for supporting <strong>${orderData.product?.artistName || 'the artist'}</strong>.</p>
            </div>`,
          }),
        });
      } catch (mailErr) {
        console.error('⚠️ Shipping email failed:', (mailErr as any)?.message);
      }
    }

    // Update salesTransaction status to 'completed'
    if (orderData?.stripePaymentIntent) {
      try {
        await db
          .update(salesTransactions)
          .set({ status: 'completed' })
          .where(eq(salesTransactions.stripePaymentId, orderData.stripePaymentIntent));
      } catch (dbErr) {
        console.error('⚠️ Failed to update sale status:', (dbErr as any)?.message);
      }
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('❌ /orders/ship failed:', error?.message);
    return res.status(500).json({ success: false, error: error?.message || 'Failed' });
  }
});

export default router;
