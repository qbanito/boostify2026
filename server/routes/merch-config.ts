/**
 * Merch Store Configuration API
 * 
 * Admin-level endpoints for managing:
 * - Global/per-category price multipliers
 * - Product visibility (show/hide)
 * - Featured product selection
 * - Design/image overrides
 * 
 * Config is stored in Firestore: merchConfig/{configId}
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export interface MerchStoreConfig {
  /** Global price multiplier applied to all baseCosts (default 2.2) */
  globalMultiplier: number;
  /** Per-category overrides — if set, takes priority over globalMultiplier */
  categoryMultipliers: Record<string, number>;
  /** Array of printfulIds that are hidden from the public store */
  hiddenProducts: number[];
  /** Array of printfulIds that should appear as featured (max 6) */
  featuredProducts: number[];
  /** Per-product image overrides: printfulId → custom image URL */
  imageOverrides: Record<number, string>;
  /** Per-product custom retail price overrides */
  priceOverrides: Record<number, number>;
  /** Last updated timestamp */
  updatedAt: string;
}

const DEFAULT_CONFIG: MerchStoreConfig = {
  globalMultiplier: 2.2,
  categoryMultipliers: {},
  hiddenProducts: [],
  featuredProducts: [],
  imageOverrides: {},
  priceOverrides: {},
  updatedAt: new Date().toISOString(),
};

const FIRESTORE_COLLECTION = 'merchConfig';
const CONFIG_DOC_ID = 'global';

// Helper to get Firestore reference
async function getFirestoreDb() {
  const { db: firestoreDb } = await import('../firebase');
  return firestoreDb;
}

// ═══════════════════════════════════════════════════════════════
// GET /api/merch-config — Get current store configuration
// ═══════════════════════════════════════════════════════════════
router.get('/', async (_req: Request, res: Response) => {
  try {
    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.json({ success: true, config: DEFAULT_CONFIG });
    }

    const doc = await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).get();
    if (!doc.exists) {
      return res.json({ success: true, config: DEFAULT_CONFIG });
    }

    const config = { ...DEFAULT_CONFIG, ...doc.data() } as MerchStoreConfig;
    res.json({ success: true, config });
  } catch (error: any) {
    console.error('Error fetching merch config:', error);
    res.status(500).json({ message: error.message || 'Error fetching config' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUT /api/merch-config — Save full store configuration
// ═══════════════════════════════════════════════════════════════
router.put('/', async (req: Request, res: Response) => {
  try {
    const updates = req.body as Partial<MerchStoreConfig>;

    // Validate multiplier range
    if (updates.globalMultiplier !== undefined) {
      const m = Number(updates.globalMultiplier);
      if (isNaN(m) || m < 1.0 || m > 10.0) {
        return res.status(400).json({ message: 'Global multiplier must be between 1.0 and 10.0' });
      }
      updates.globalMultiplier = m;
    }

    // Validate category multipliers
    if (updates.categoryMultipliers) {
      for (const [, val] of Object.entries(updates.categoryMultipliers)) {
        const v = Number(val);
        if (isNaN(v) || v < 1.0 || v > 10.0) {
          return res.status(400).json({ message: 'Category multipliers must be between 1.0 and 10.0' });
        }
      }
    }

    // Validate featured products (max 6)
    if (updates.featuredProducts && updates.featuredProducts.length > 6) {
      return res.status(400).json({ message: 'Maximum 6 featured products allowed' });
    }

    updates.updatedAt = new Date().toISOString();

    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).set(updates, { merge: true });

    // Return the merged config
    const doc = await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).get();
    const config = { ...DEFAULT_CONFIG, ...doc.data() } as MerchStoreConfig;

    res.json({ success: true, config });
  } catch (error: any) {
    console.error('Error saving merch config:', error);
    res.status(500).json({ message: error.message || 'Error saving config' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/merch-config/multiplier — Quick update just the multiplier
// ═══════════════════════════════════════════════════════════════
router.patch('/multiplier', async (req: Request, res: Response) => {
  try {
    const { globalMultiplier, categoryMultipliers } = req.body;

    const updates: any = { updatedAt: new Date().toISOString() };

    if (globalMultiplier !== undefined) {
      const m = Number(globalMultiplier);
      if (isNaN(m) || m < 1.0 || m > 10.0) {
        return res.status(400).json({ message: 'Multiplier must be between 1.0 and 10.0' });
      }
      updates.globalMultiplier = m;
    }

    if (categoryMultipliers) {
      updates.categoryMultipliers = categoryMultipliers;
    }

    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).set(updates, { merge: true });
    const doc = await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).get();
    const config = { ...DEFAULT_CONFIG, ...doc.data() } as MerchStoreConfig;

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating multiplier' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/merch-config/visibility — Toggle product visibility
// ═══════════════════════════════════════════════════════════════
router.patch('/visibility', async (req: Request, res: Response) => {
  try {
    const { printfulId, visible } = req.body;

    if (!printfulId || typeof visible !== 'boolean') {
      return res.status(400).json({ message: 'printfulId and visible (boolean) required' });
    }

    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    const doc = await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).get();
    const config = { ...DEFAULT_CONFIG, ...(doc.exists ? doc.data() : {}) } as MerchStoreConfig;

    const hiddenSet = new Set(config.hiddenProducts || []);

    if (visible) {
      hiddenSet.delete(Number(printfulId));
    } else {
      hiddenSet.add(Number(printfulId));
    }

    await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).set(
      { hiddenProducts: Array.from(hiddenSet), updatedAt: new Date().toISOString() },
      { merge: true }
    );

    res.json({ success: true, hiddenProducts: Array.from(hiddenSet) });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating visibility' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/merch-config/visibility/bulk — Bulk hide/show
// ═══════════════════════════════════════════════════════════════
router.patch('/visibility/bulk', async (req: Request, res: Response) => {
  try {
    const { printfulIds, visible } = req.body;

    if (!Array.isArray(printfulIds) || typeof visible !== 'boolean') {
      return res.status(400).json({ message: 'printfulIds (array) and visible (boolean) required' });
    }

    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    const doc = await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).get();
    const config = { ...DEFAULT_CONFIG, ...(doc.exists ? doc.data() : {}) } as MerchStoreConfig;

    const hiddenSet = new Set(config.hiddenProducts || []);

    for (const id of printfulIds) {
      if (visible) {
        hiddenSet.delete(Number(id));
      } else {
        hiddenSet.add(Number(id));
      }
    }

    await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).set(
      { hiddenProducts: Array.from(hiddenSet), updatedAt: new Date().toISOString() },
      { merge: true }
    );

    res.json({ success: true, hiddenProducts: Array.from(hiddenSet) });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating visibility' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/merch-config/featured — Update featured products
// ═══════════════════════════════════════════════════════════════
router.patch('/featured', async (req: Request, res: Response) => {
  try {
    const { featuredProducts } = req.body;

    if (!Array.isArray(featuredProducts)) {
      return res.status(400).json({ message: 'featuredProducts (array of printfulIds) required' });
    }

    if (featuredProducts.length > 6) {
      return res.status(400).json({ message: 'Maximum 6 featured products' });
    }

    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).set(
      { featuredProducts: featuredProducts.map(Number), updatedAt: new Date().toISOString() },
      { merge: true }
    );

    res.json({ success: true, featuredProducts });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error updating featured' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/merch-config/preview — Preview pricing with current config
// Returns all products with calculated prices
// ═══════════════════════════════════════════════════════════════
router.get('/preview', async (_req: Request, res: Response) => {
  try {
    const firestoreDb = await getFirestoreDb();
    let config = DEFAULT_CONFIG;

    if (firestoreDb) {
      const doc = await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).get();
      if (doc.exists) {
        config = { ...DEFAULT_CONFIG, ...doc.data() } as MerchStoreConfig;
      }
    }

    const { EXPANDED_CATALOG, getProductImageUrl } = await import('../config/printful-expanded-catalog');

    const products = EXPANDED_CATALOG.map(p => {
      // Determine effective price
      let effectivePrice: number;
      if (config.priceOverrides[p.printfulId]) {
        effectivePrice = config.priceOverrides[p.printfulId];
      } else {
        const multiplier = config.categoryMultipliers[p.category] || config.globalMultiplier;
        effectivePrice = Math.ceil(p.baseCost * multiplier) - 0.01;
      }

      const isHidden = config.hiddenProducts.includes(p.printfulId);
      const isFeatured = config.featuredProducts.length > 0
        ? config.featuredProducts.includes(p.printfulId)
        : p.featured;

      return {
        printfulId: p.printfulId,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory,
        baseCost: p.baseCost,
        originalRetailPrice: p.retailPrice,
        calculatedPrice: effectivePrice,
        margin: ((effectivePrice - p.baseCost) / effectivePrice * 100).toFixed(1),
        isHidden,
        isFeatured,
        imageUrl: config.imageOverrides[p.printfulId] || getProductImageUrl(p.printfulId),
        tags: p.tags,
        gender: p.gender,
      };
    });

    const visibleProducts = products.filter(p => !p.isHidden);
    const avgMargin = visibleProducts.length > 0
      ? (visibleProducts.reduce((sum, p) => sum + parseFloat(p.margin), 0) / visibleProducts.length).toFixed(1)
      : '0';

    res.json({
      success: true,
      config,
      products,
      stats: {
        total: products.length,
        visible: visibleProducts.length,
        hidden: products.length - visibleProducts.length,
        featured: products.filter(p => p.isFeatured).length,
        avgMargin,
        priceRange: {
          min: Math.min(...visibleProducts.map(p => p.calculatedPrice)),
          max: Math.max(...visibleProducts.map(p => p.calculatedPrice)),
        },
      },
    });
  } catch (error: any) {
    console.error('Error generating preview:', error);
    res.status(500).json({ message: error.message || 'Error generating preview' });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/merch-config/reset — Reset to defaults
// ═══════════════════════════════════════════════════════════════
router.post('/reset', async (_req: Request, res: Response) => {
  try {
    const firestoreDb = await getFirestoreDb();
    if (!firestoreDb) {
      return res.status(500).json({ message: 'Firestore not available' });
    }

    const freshConfig = { ...DEFAULT_CONFIG, updatedAt: new Date().toISOString() };
    await firestoreDb.collection(FIRESTORE_COLLECTION).doc(CONFIG_DOC_ID).set(freshConfig);

    res.json({ success: true, config: freshConfig });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error resetting config' });
  }
});

export default router;
