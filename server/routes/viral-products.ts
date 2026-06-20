/**
 * Viral Products API Routes
 * Connects Apify TikTok dataset with FAL AI to generate promotional content
 */

import { Router, Request, Response } from 'express';
import { fetchViralProducts, getProductById } from '../services/apify-tiktok-products';
import { generateProductPromoImage, generateProductPromoVideo } from '../services/fal-service';
import { rateLimitAiGen } from '../middleware/rate-limit';

const router = Router();

/**
 * GET /api/viral-products
 * List trending TikTok products from the Apify dataset
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = parseInt(req.query.offset as string) || 0;
    const minUnitsSold = parseInt(req.query.minUnitsSold as string) || 0;

    const products = await fetchViralProducts({ limit, offset, minUnitsSold });

    res.json({
      success: true,
      products,
      total: products.length,
      offset,
      limit,
    });
  } catch (error: any) {
    console.error('❌ [Viral Products] Error listing products:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/viral-products/:productId
 * Get a single product by ID
 */
router.get('/:productId', async (req: Request, res: Response) => {
  try {
    const product = await getProductById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/viral-products/generate-promo-image
 * Generate a promotional image: artist + product composite
 * Body: { artistImageUrl, productId, artistName }
 */
router.post('/generate-promo-image', rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const { artistImageUrl, productId, artistName } = req.body;

    if (!artistImageUrl || !productId) {
      return res.status(400).json({ success: false, error: 'artistImageUrl and productId are required' });
    }

    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    console.log(`🛍️ [Viral] Generating promo image: ${artistName} x "${product.name.substring(0, 40)}..."`);
    console.log(`🛍️ [Viral] Artist image: ${artistImageUrl.substring(0, 60)}`);
    console.log(`🛍️ [Viral] Product image: ${product.product_img_url?.substring(0, 60)}`);

    const result = await generateProductPromoImage(
      artistImageUrl,
      product.product_img_url || '',
      product.name,
    );

    console.log(`🛍️ [Viral] Image result: success=${result.success}, imageUrl=${result.imageUrl?.substring(0, 80)}..., error=${result.error || 'none'}`);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Image generation failed' });
    }

    res.json({
      success: true,
      promoImageUrl: result.imageUrl || '',
      product: {
        id: product.product_id,
        name: product.name,
        price: product.price_display,
        unitsSold: product.units_sold,
      },
    });
  } catch (error: any) {
    console.error('❌ [Viral] Promo image error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/viral-products/generate-promo-video
 * Generate a TikTok-style promotional video from a promo image
 * Body: { promoImageUrl, productId, artistName?, artistGenre? }
 */
router.post('/generate-promo-video', rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const { promoImageUrl, productId, artistName, artistGenre } = req.body;

    if (!promoImageUrl || !productId) {
      return res.status(400).json({ success: false, error: 'promoImageUrl and productId are required' });
    }

    const product = await getProductById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    console.log(`🎬 [Viral] Generating promo video for "${product.name.substring(0, 40)}..." (genre: ${artistGenre || 'general'})`);

    const result = await generateProductPromoVideo(
      promoImageUrl,
      product.name,
      artistName || 'Artist',
      artistGenre || 'pop',
    );

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Video generation failed' });
    }

    res.json({
      success: true,
      promoVideoUrl: result.videoUrl || '',
      product: {
        id: product.product_id,
        name: product.name,
        price: product.price_display,
      },
    });
  } catch (error: any) {
    console.error('❌ [Viral] Promo video error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
