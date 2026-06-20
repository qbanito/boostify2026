/**
 * Influencer Brand Routes v2 — Artist × Brand Content Collaboration API
 * 
 * UPGRADED Endpoints:
 * GET    /packages                          — List influencer packages ($300-$3000)
 * POST   /packages/checkout                 — Stripe checkout for package purchase
 * POST   /packages/payment-success          — Handle successful Stripe payment
 * GET    /brands                            — List/search brands
 * POST   /brands                            — Create brand profile
 * POST   /brands/import                     — Bulk import brands from CSV
 * GET    /brands/:brandId/products          — List brand products
 * POST   /brands/:brandId/products          — Add product to brand catalog
 * GET    /campaigns                         — Artist's campaigns
 * POST   /campaigns                         — Create new campaign
 * PATCH  /campaigns/:id/status              — Update campaign status
 * GET    /campaigns/:id/content             — Get campaign content pieces
 * POST   /campaigns/:id/generate-image      — Generate promo image (AI fusion)
 * POST   /campaigns/:id/generate-video      — Generate PixVerse viral video
 * POST   /campaigns/:id/generate-gallery    — Generate image gallery batch
 * POST   /campaigns/:id/generate-caption    — Generate social caption
 * POST   /campaigns/:id/generate-dialogue   — Generate promotional dialogue script
 * POST   /campaigns/:id/generate-song       — Generate brand jingle (Lyria 3)
 * GET    /campaigns/:id/songs               — Get campaign songs
 * GET    /campaigns/:id/messages            — Get campaign messages
 * POST   /campaigns/:id/messages            — Send message in campaign
 * POST   /campaigns/:id/messages/read       — Mark messages as read
 * GET    /stats                             — Influencer dashboard stats
 * GET    /toggle                            — Get module on/off state
 * POST   /toggle                            — Toggle module on/off
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { rateLimitAiGen } from '../middleware/rate-limit';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import {
  getInfluencerPackages,
  createPackageCheckout,
  handlePackagePaymentSuccess,
  getBrands,
  createBrand,
  importBrandsFromCSV,
  getBrandProducts,
  addBrandProduct,
  createCampaign,
  getArtistCampaigns,
  updateCampaignStatus,
  generateCampaignPromoImage,
  generateCampaignPromoVideo,
  generateCampaignGallery,
  generateCampaignCaption,
  generatePromotionalDialogue,
  generateBrandSong,
  getCampaignSongs,
  getCampaignContent,
  sendMessage,
  getCampaignMessages,
  markMessagesRead,
  getUnreadCount,
  getInfluencerStats,
} from '../services/influencer-brand-service';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────

async function getUserPgId(clerkId: string): Promise<number | null> {
  const user = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user[0]?.id || null;
}

// ═══════════════════════════════════════════════════════════════
// PACKAGES
// ═══════════════════════════════════════════════════════════════

router.get('/packages', async (_req: Request, res: Response) => {
  try {
    const packages = await getInfluencerPackages();
    res.json({ success: true, packages });
  } catch (err) {
    console.error('❌ [Influencer] Error fetching packages:', err);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});

// ═══════════════════════════════════════════════════════════════
// STRIPE CHECKOUT
// ═══════════════════════════════════════════════════════════════

router.post('/packages/checkout', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = await getUserPgId(clerkId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const { packageId, brandId, campaignTitle, customerEmail } = req.body;
    if (!packageId || !brandId || !campaignTitle?.trim()) {
      return res.status(400).json({ error: 'packageId, brandId, and campaignTitle are required' });
    }

    const result = await createPackageCheckout({
      packageId: parseInt(packageId),
      brandId: parseInt(brandId),
      artistId: userId,
      campaignTitle: campaignTitle.trim(),
      customerEmail,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('❌ [Influencer] Checkout error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
  }
});

router.post('/packages/payment-success', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const campaign = await handlePackagePaymentSuccess(sessionId);
    if (!campaign) return res.status(400).json({ error: 'Payment not verified or already processed' });

    res.json({ success: true, campaign });
  } catch (err) {
    console.error('❌ [Influencer] Payment callback error:', err);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BRANDS
// ═══════════════════════════════════════════════════════════════

router.get('/brands', authenticate, async (req: Request, res: Response) => {
  try {
    const { search, industry, limit, offset } = req.query;
    const brands = await getBrands({
      search: search as string,
      industry: industry as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    res.json({ success: true, brands });
  } catch (err) {
    console.error('❌ [Influencer] Error fetching brands:', err);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

router.post('/brands', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = await getUserPgId(clerkId);

    const { name, industry, website, contactEmail, contactName, description,
            instagramHandle, tiktokHandle, logo, heroProductUrl, heroProductName } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Brand name is required' });

    const brand = await createBrand({
      name: name.trim(),
      industry: industry || 'other',
      website, contactEmail, contactName, description,
      instagramHandle, tiktokHandle, logo,
      heroProductUrl, heroProductName,
      addedByUserId: userId,
    });

    res.json({ success: true, brand });
  } catch (err) {
    console.error('❌ [Influencer] Error creating brand:', err);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

router.post('/brands/import', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = await getUserPgId(clerkId);

    const { brands } = req.body;
    if (!Array.isArray(brands) || brands.length === 0) {
      return res.status(400).json({ error: 'brands array is required' });
    }
    if (brands.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 brands per import' });
    }

    const results = await importBrandsFromCSV(brands, userId || undefined);
    res.json({ success: true, ...results });
  } catch (err) {
    console.error('❌ [Influencer] Error importing brands:', err);
    res.status(500).json({ error: 'Failed to import brands' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BRAND PRODUCTS
// ═══════════════════════════════════════════════════════════════

router.get('/brands/:brandId/products', authenticate, async (req: Request, res: Response) => {
  try {
    const brandId = parseInt(req.params.brandId);
    if (isNaN(brandId)) return res.status(400).json({ error: 'Invalid brandId' });

    const products = await getBrandProducts(brandId);
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/brands/:brandId/products', authenticate, async (req: Request, res: Response) => {
  try {
    const brandId = parseInt(req.params.brandId);
    if (isNaN(brandId)) return res.status(400).json({ error: 'Invalid brandId' });

    const { name, description, imageUrl, price, category, productUrl } = req.body;
    if (!name?.trim() || !imageUrl?.trim()) {
      return res.status(400).json({ error: 'Product name and imageUrl are required' });
    }

    const product = await addBrandProduct({
      brandId,
      name: name.trim(),
      description,
      imageUrl,
      price: price || null,
      category: category || null,
      productUrl: productUrl || null,
    });

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

router.get('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = await getUserPgId(clerkId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const { status } = req.query;
    const campaigns = await getArtistCampaigns(userId, status as string);
    res.json({ success: true, campaigns });
  } catch (err) {
    console.error('❌ [Influencer] Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

router.post('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = await getUserPgId(clerkId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const { brandId, packageId, title, brief, productIds, totalAmount } = req.body;
    if (!brandId || !title?.trim() || !totalAmount) {
      return res.status(400).json({ error: 'brandId, title, and totalAmount are required' });
    }

    const campaign = await createCampaign({
      brandId: parseInt(brandId),
      artistId: userId,
      packageId: packageId ? parseInt(packageId) : undefined,
      title: title.trim(),
      brief,
      productIds: productIds?.map((id: any) => parseInt(id)),
      totalAmount: String(totalAmount),
    });

    res.json({ success: true, campaign });
  } catch (err) {
    console.error('❌ [Influencer] Error creating campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

router.patch('/campaigns/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const campaign = await updateCampaignStatus(campaignId, status);
    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update campaign status' });
  }
});

// ═══════════════════════════════════════════════════════════════
// CAMPAIGN CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════

router.get('/campaigns/:id/content', authenticate, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const content = await getCampaignContent(campaignId);
    res.json({ success: true, content });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign content' });
  }
});

router.post('/campaigns/:id/generate-image', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { productId, artistImageUrl, productImageUrl, productName } = req.body;
    if (!productId || !artistImageUrl || !productImageUrl || !productName) {
      return res.status(400).json({
        error: 'productId, artistImageUrl, productImageUrl, and productName are required',
      });
    }

    console.log(`🎨 [Influencer] Generating promo image: campaign=${campaignId}, product="${productName}"`);

    const result = await generateCampaignPromoImage({
      campaignId,
      productId: parseInt(productId),
      artistImageUrl,
      productImageUrl,
      productName,
    });

    if (result.success) {
      res.json({ success: true, content: result.content });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('❌ [Influencer] Error generating promo image:', err);
    res.status(500).json({ error: 'Failed to generate promo image' });
  }
});

router.post('/campaigns/:id/generate-video', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { productId, promoImageUrl, productName, artistName, artistGenre } = req.body;
    if (!productId || !promoImageUrl || !productName) {
      return res.status(400).json({
        error: 'productId, promoImageUrl, and productName are required',
      });
    }

    console.log(`🎬 [Influencer] PixVerse promo video: campaign=${campaignId}, product="${productName}"`);

    const result = await generateCampaignPromoVideo({
      campaignId,
      productId: parseInt(productId),
      promoImageUrl,
      productName,
      artistName: artistName || 'Artist',
      artistGenre: artistGenre || 'pop',
    });

    if (result.success) {
      res.json({ success: true, content: result.content });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('❌ [Influencer] Error generating promo video:', err);
    res.status(500).json({ error: 'Failed to generate promo video' });
  }
});

// ═══════════════════════════════════════════════════════════════
// IMAGE GALLERY (batch generation)
// ═══════════════════════════════════════════════════════════════

router.post('/campaigns/:id/generate-gallery', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { productId, artistImageUrl, productImageUrl, productName, count } = req.body;
    if (!productId || !artistImageUrl || !productImageUrl || !productName) {
      return res.status(400).json({ error: 'productId, artistImageUrl, productImageUrl, and productName are required' });
    }

    console.log(`🖼️ [Influencer] Generating gallery: campaign=${campaignId}, count=${count || 3}`);

    const results = await generateCampaignGallery({
      campaignId,
      productId: parseInt(productId),
      artistImageUrl,
      productImageUrl,
      productName,
      count: Math.min(parseInt(count) || 3, 20),
    });

    res.json({ success: true, results, generated: results.filter(r => r.success).length });
  } catch (err) {
    console.error('❌ [Influencer] Gallery error:', err);
    res.status(500).json({ error: 'Failed to generate gallery' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PROMOTIONAL DIALOGUE SCRIPT
// ═══════════════════════════════════════════════════════════════

router.post('/campaigns/:id/generate-dialogue', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { productName, productDescription, brandName, artistName, artistGenre, durationSeconds } = req.body;
    if (!productName || !brandName || !artistName) {
      return res.status(400).json({ error: 'productName, brandName, and artistName are required' });
    }

    console.log(`🎙️ [Influencer] Generating dialogue: ${artistName} × ${productName}`);

    const result = await generatePromotionalDialogue({
      campaignId,
      productName, productDescription: productDescription || '',
      brandName, artistName, artistGenre: artistGenre || 'pop',
      durationSeconds: parseInt(durationSeconds) || 30,
    });

    res.json({ success: true, script: result.script, content: result.content });
  } catch (err) {
    console.error('❌ [Influencer] Dialogue error:', err);
    res.status(500).json({ error: 'Failed to generate dialogue' });
  }
});

// ═══════════════════════════════════════════════════════════════
// BRAND SONG GENERATION (Lyria 3 → MiniMax fallback)
// ═══════════════════════════════════════════════════════════════

router.post('/campaigns/:id/generate-song', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { productName, brandName, artistName, artistGenre, artistGender } = req.body;
    if (!productName || !brandName || !artistName) {
      return res.status(400).json({ error: 'productName, brandName, and artistName are required' });
    }

    console.log(`🎵 [Influencer] Generating brand song: ${brandName} × ${artistName}`);

    const result = await generateBrandSong({
      campaignId,
      productName, brandName,
      artistName, artistGenre: artistGenre || 'pop',
      artistGender: artistGender || 'male',
    });

    if (result.success) {
      res.json({ success: true, song: result.song });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error('❌ [Influencer] Song generation error:', err);
    res.status(500).json({ error: 'Failed to generate brand song' });
  }
});

router.get('/campaigns/:id/songs', authenticate, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const songs = await getCampaignSongs(campaignId);
    res.json({ success: true, songs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// ═══════════════════════════════════════════════════════════════
// MESSAGING — Brand ↔ Artist within campaigns
// ═══════════════════════════════════════════════════════════════

router.get('/campaigns/:id/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const messages = await getCampaignMessages(campaignId);

    // Auto-mark as read for the current user
    const clerkId = (req as any).auth?.userId;
    if (clerkId) {
      const userId = await getUserPgId(clerkId);
      if (userId) {
        // Simple heuristic: if user is the campaign artist, mark brand messages read
        await markMessagesRead(campaignId, 'artist');
      }
    }

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/campaigns/:id/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = await getUserPgId(clerkId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { message, senderType, attachmentUrl, attachmentType } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

    const msg = await sendMessage({
      campaignId,
      senderType: senderType || 'artist',
      senderUserId: userId,
      message: message.trim(),
      attachmentUrl: attachmentUrl || undefined,
      attachmentType: attachmentType || undefined,
    });

    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/campaigns/:id/messages/read', authenticate, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.id);
    if (isNaN(campaignId)) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { readerType } = req.body;
    await markMessagesRead(campaignId, readerType || 'artist');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

router.post('/campaigns/:id/generate-caption', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const { contentId, brandName, productName, artistName, artistGenre, platform } = req.body;
    if (!contentId || !brandName || !productName) {
      return res.status(400).json({ error: 'contentId, brandName, and productName are required' });
    }

    const result = await generateCampaignCaption({
      contentId: parseInt(contentId),
      brandName,
      productName,
      artistName: artistName || 'Artist',
      artistGenre: artistGenre || 'pop',
      platform: platform || 'instagram',
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate caption' });
  }
});

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });

    const userId = await getUserPgId(clerkId);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const stats = await getInfluencerStats(userId);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('❌ [Influencer] Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ═══════════════════════════════════════════════════════════════
// MODULE TOGGLE (enable/disable on artist page)
// ═══════════════════════════════════════════════════════════════

router.get('/toggle', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });

    const [user] = await db.select({
      profileLayout: users.profileLayout,
    }).from(users).where(eq(users.clerkId, clerkId)).limit(1);

    const isEnabled = user?.profileLayout?.visibility?.['brand-collabs'] ?? false;
    res.json({ success: true, enabled: isEnabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get toggle state' });
  }
});

router.post('/toggle', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) return res.status(401).json({ error: 'Not authenticated' });

    const { enabled } = req.body;

    const [user] = await db.select({
      id: users.id,
      profileLayout: users.profileLayout,
    }).from(users).where(eq(users.clerkId, clerkId)).limit(1);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const layout = user.profileLayout || { order: [], visibility: {} };
    layout.visibility = layout.visibility || {};
    layout.visibility['brand-collabs'] = !!enabled;

    // Add to order if not present
    if (!layout.order.includes('brand-collabs')) {
      layout.order.push('brand-collabs');
    }

    await db.update(users)
      .set({ profileLayout: layout, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle module' });
  }
});

export default router;
