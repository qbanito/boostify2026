/**
 * Influencer Brand Service v2 — Full Brand × Artist Content Collaboration Engine
 * 
 * UPGRADED:
 * ✅ Brand uploads products → Artist generates fusion content
 * ✅ PixVerse C1 Reference-to-Video + Image-to-Video (FAL AI)
 * ✅ AI product-artist image fusion (GPT Image 1.5 → Flux Kontext fallback)
 * ✅ Messaging system (brand ↔ artist real-time chat)
 * ✅ AI-generated brand jingle/song (Lyria 3 + MiniMax fallback)
 * ✅ Promotional dialogue scripts (Gemini)
 * ✅ Stripe checkout for package payments
 * ✅ Image gallery generation (batch promo images per plan)
 * ✅ Caption + hashtag generation with platform optimization
 */

import { db } from '../db';
import { eq, desc, and, ilike, sql, asc } from 'drizzle-orm';
import {
  brandProfiles, brandProducts, influencerPackages,
  brandCampaigns, campaignContent, brandMessages, campaignSongs, users,
  type InsertBrandProfile, type InsertBrandProduct,
  type InsertBrandCampaign, type InsertCampaignContent,
} from '../db/schema';
import { generateProductPromoImage, generateProductPromoVideo } from './fal-service';
import axios from 'axios';
import Stripe from 'stripe';

const FAL_API_KEY = process.env.FAL_API_KEY || '';
const FAL_BASE_URL = 'https://fal.run';
const PLATFORM_URL = process.env.VITE_APP_URL || process.env.BASE_URL || 'http://localhost:5000';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2024-04-10' as any }) : null;

// ═══════════════════════════════════════════════════════════════
// DEFAULT PACKAGES — Seeded on first load
// ═══════════════════════════════════════════════════════════════

const PLATFORM_FEE_RATE = 0.15; // 15% platform cut

const DEFAULT_PACKAGES = [
  {
    name: 'Starter Shoutout',
    slug: 'starter-shoutout',
    tier: 'starter' as const,
    price: '300.00',
    description: 'Quick brand exposure. 3 AI fusion images of the artist rocking your product, captions ready to post, and a promotional script.',
    features: [
      '3 AI fusion images (artist + your product)',
      '3 ready-to-post captions with hashtags',
      '1 promotional dialogue script',
      '1 story mention template',
      'Brand–Artist messaging',
      '48h delivery',
      '1 revision round',
    ],
    promoImages: 3, promoVideos: 0, socialPosts: 3, storyMentions: 1,
    songMention: false, dedicatedSong: false, exclusivityDays: 0, revisionRounds: 1, sortOrder: 1,
  },
  {
    name: 'Growth Campaign',
    slug: 'growth-campaign',
    tier: 'growth' as const,
    price: '800.00',
    description: 'Full content pack. AI promo images, 2 viral PixVerse videos with the artist showcasing your product, social captions, and a promotional dialogue.',
    features: [
      '6 AI fusion images (multiple angles & styles)',
      '2 viral PixVerse AI videos (artist × product)',
      '6 social media captions with trending hashtags',
      '1 promotional dialogue script (30s)',
      '3 story mention templates',
      'Brand–Artist messaging',
      '30-day product mention in artist bio',
      '72h delivery · 2 revision rounds',
    ],
    promoImages: 6, promoVideos: 2, socialPosts: 6, storyMentions: 3,
    songMention: false, dedicatedSong: false, exclusivityDays: 30, revisionRounds: 2, sortOrder: 2,
  },
  {
    name: 'Premium Viral',
    slug: 'premium-viral',
    tier: 'premium' as const,
    price: '1800.00',
    description: 'Maximum impact. 12 promo images, 5 viral PixVerse videos, product mention in a song, full image gallery, and a custom promotional script.',
    features: [
      '12 AI fusion images (editorial, lifestyle, product focus)',
      '5 viral PixVerse AI videos (TikTok, Reels, Shorts)',
      '12 social captions with SEO-optimized hashtags',
      '1 custom promotional dialogue (60s script)',
      'Product mention in next song lyrics',
      'Full image gallery with download pack',
      '5 story templates',
      'Brand–Artist messaging + priority support',
      '60-day exclusivity · 3 revision rounds',
    ],
    promoImages: 12, promoVideos: 5, socialPosts: 12, storyMentions: 5,
    songMention: true, dedicatedSong: false, exclusivityDays: 60, revisionRounds: 3, sortOrder: 3,
  },
  {
    name: 'Enterprise Brand Deal',
    slug: 'enterprise-brand-deal',
    tier: 'enterprise' as const,
    price: '3000.00',
    description: 'The ultimate partnership. A dedicated AI-generated brand song, 20 fusion images, 10 viral videos, full campaign identity, and 90-day exclusive ambassador status.',
    features: [
      '20 AI fusion images (full campaign visual identity)',
      '10 viral PixVerse AI videos with custom storylines',
      '🎵 Dedicated brand song (AI-generated jingle!)',
      '20 social media posts with captions',
      '10 story templates',
      'Unlimited promotional dialogue scripts',
      'Full downloadable image gallery',
      '90-day exclusive brand ambassador',
      'Unlimited revision rounds',
      'Dedicated account manager',
      'Campaign analytics report',
    ],
    promoImages: 20, promoVideos: 10, socialPosts: 20, storyMentions: 10,
    songMention: true, dedicatedSong: true, exclusivityDays: 90, revisionRounds: 99, sortOrder: 4,
  },
];

// ═══════════════════════════════════════════════════════════════
// PACKAGES
// ═══════════════════════════════════════════════════════════════

export async function getInfluencerPackages() {
  const packages = await db.select().from(influencerPackages)
    .where(eq(influencerPackages.isActive, true))
    .orderBy(influencerPackages.sortOrder);

  // Auto-seed if empty
  if (packages.length === 0) {
    await seedDefaultPackages();
    return db.select().from(influencerPackages)
      .where(eq(influencerPackages.isActive, true))
      .orderBy(influencerPackages.sortOrder);
  }

  return packages;
}

export async function seedDefaultPackages() {
  for (const pkg of DEFAULT_PACKAGES) {
    const existing = await db.select().from(influencerPackages)
      .where(eq(influencerPackages.slug, pkg.slug))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(influencerPackages).values(pkg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// STRIPE CHECKOUT — Pay for a package
// ═══════════════════════════════════════════════════════════════

export async function createPackageCheckout(params: {
  packageId: number;
  brandId: number;
  artistId: number;
  campaignTitle: string;
  customerEmail?: string;
}) {
  if (!stripe) throw new Error('Stripe not configured');

  const [pkg] = await db.select().from(influencerPackages)
    .where(eq(influencerPackages.id, params.packageId)).limit(1);
  if (!pkg) throw new Error('Package not found');

  const [artist] = await db.select({ artistName: users.artistName })
    .from(users).where(eq(users.id, params.artistId)).limit(1);

  const [brand] = await db.select({ name: brandProfiles.name })
    .from(brandProfiles).where(eq(brandProfiles.id, params.brandId)).limit(1);

  const amountCents = Math.round(parseFloat(pkg.price) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${pkg.name} — ${artist?.artistName || 'Artist'} × ${brand?.name || 'Brand'}`,
          description: pkg.description || `Influencer marketing package: ${pkg.tier}`,
        },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    metadata: {
      type: 'influencer_brand_package',
      packageId: String(params.packageId),
      brandId: String(params.brandId),
      artistId: String(params.artistId),
      campaignTitle: params.campaignTitle,
      tier: pkg.tier,
    },
    success_url: `${PLATFORM_URL}/artist-page?tab=brand-collabs&payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${PLATFORM_URL}/artist-page?tab=brand-collabs&payment=cancelled`,
    customer_email: params.customerEmail || undefined,
  });

  return { checkoutUrl: session.url, sessionId: session.id };
}

export async function handlePackagePaymentSuccess(sessionId: string) {
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') return null;

  const { packageId, brandId, artistId, campaignTitle } = session.metadata || {};
  if (!packageId || !brandId || !artistId) return null;

  const existing = await db.select({ id: brandCampaigns.id })
    .from(brandCampaigns)
    .where(eq(brandCampaigns.stripePaymentIntentId, session.payment_intent as string))
    .limit(1);
  if (existing.length > 0) return existing[0];

  const [pkg] = await db.select().from(influencerPackages)
    .where(eq(influencerPackages.id, parseInt(packageId))).limit(1);

  const total = pkg ? pkg.price : '0';
  const fee = (parseFloat(total) * PLATFORM_FEE_RATE).toFixed(2);
  const earning = (parseFloat(total) - parseFloat(fee)).toFixed(2);

  const [campaign] = await db.insert(brandCampaigns).values({
    brandId: parseInt(brandId),
    artistId: parseInt(artistId),
    packageId: parseInt(packageId),
    title: campaignTitle || `${pkg?.name || 'Campaign'}`,
    totalAmount: total,
    platformFee: fee,
    artistEarning: earning,
    status: 'accepted',
    stripePaymentIntentId: session.payment_intent as string,
    paidAt: new Date(),
  }).returning();

  await sendMessage({
    campaignId: campaign.id,
    senderType: 'system',
    message: `✅ Payment received! Campaign "${campaignTitle}" is now active. The artist can start creating content.`,
  });

  return campaign;
}

// ═══════════════════════════════════════════════════════════════
// BRAND PROFILES
// ═══════════════════════════════════════════════════════════════

export async function getBrands(options: {
  search?: string;
  industry?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { search, industry, limit = 50, offset = 0 } = options;

  let query = db.select().from(brandProfiles)
    .where(eq(brandProfiles.isActive, true))
    .orderBy(desc(brandProfiles.createdAt))
    .limit(limit)
    .offset(offset);

  // Apply filters via raw conditions
  const conditions = [eq(brandProfiles.isActive, true)];
  if (industry) conditions.push(eq(brandProfiles.industry, industry as any));
  if (search) conditions.push(ilike(brandProfiles.name, `%${search}%`));

  return db.select().from(brandProfiles)
    .where(and(...conditions))
    .orderBy(desc(brandProfiles.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createBrand(data: InsertBrandProfile) {
  const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const [brand] = await db.insert(brandProfiles).values({ ...data, slug }).returning();
  return brand;
}

export async function importBrandsFromCSV(rows: Array<{
  name: string;
  industry?: string;
  website?: string;
  contactEmail?: string;
  contactName?: string;
  instagramHandle?: string;
  tiktokHandle?: string;
  description?: string;
}>, addedByUserId?: number) {
  const results = { imported: 0, skipped: 0, errors: 0 };

  for (const row of rows) {
    try {
      if (!row.name?.trim()) { results.skipped++; continue; }

      const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const existing = await db.select({ id: brandProfiles.id })
        .from(brandProfiles)
        .where(eq(brandProfiles.slug, slug))
        .limit(1);

      if (existing.length > 0) { results.skipped++; continue; }

      await db.insert(brandProfiles).values({
        name: row.name.trim(),
        slug,
        industry: (row.industry as any) || 'other',
        website: row.website || null,
        contactEmail: row.contactEmail || null,
        contactName: row.contactName || null,
        instagramHandle: row.instagramHandle || null,
        tiktokHandle: row.tiktokHandle || null,
        description: row.description || null,
        addedByUserId: addedByUserId || null,
      });
      results.imported++;
    } catch (err) {
      results.errors++;
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// BRAND PRODUCTS
// ═══════════════════════════════════════════════════════════════

export async function getBrandProducts(brandId: number) {
  return db.select().from(brandProducts)
    .where(and(eq(brandProducts.brandId, brandId), eq(brandProducts.isActive, true)))
    .orderBy(desc(brandProducts.createdAt));
}

export async function addBrandProduct(data: InsertBrandProduct) {
  const [product] = await db.insert(brandProducts).values(data).returning();
  return product;
}

// ═══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════

export async function createCampaign(data: {
  brandId: number;
  artistId: number;
  packageId?: number;
  title: string;
  brief?: string;
  productIds?: number[];
  totalAmount: string;
}) {
  const total = parseFloat(data.totalAmount);
  const fee = (total * PLATFORM_FEE_RATE).toFixed(2);
  const earning = (total - parseFloat(fee)).toFixed(2);

  const [campaign] = await db.insert(brandCampaigns).values({
    brandId: data.brandId,
    artistId: data.artistId,
    packageId: data.packageId || null,
    title: data.title,
    brief: data.brief || null,
    productIds: data.productIds || [],
    totalAmount: data.totalAmount,
    platformFee: fee,
    artistEarning: earning,
    status: 'proposal',
  }).returning();

  await sendMessage({
    campaignId: campaign.id,
    senderType: 'system',
    message: `🤝 New campaign proposal: "${data.title}". Total: $${data.totalAmount}`,
  });

  return campaign;
}

export async function getArtistCampaigns(artistId: number, status?: string) {
  const conditions = [eq(brandCampaigns.artistId, artistId)];
  if (status) conditions.push(eq(brandCampaigns.status, status as any));

  const campaigns = await db.select({
    campaign: brandCampaigns,
    brand: {
      id: brandProfiles.id,
      name: brandProfiles.name,
      logo: brandProfiles.logo,
      industry: brandProfiles.industry,
    },
  })
    .from(brandCampaigns)
    .leftJoin(brandProfiles, eq(brandCampaigns.brandId, brandProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(brandCampaigns.createdAt));

  return campaigns;
}

export async function updateCampaignStatus(campaignId: number, status: string) {
  const updates: Record<string, any> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'completed') updates.completedAt = new Date();
  if (status === 'paid') updates.paidAt = new Date();

  const [updated] = await db.update(brandCampaigns)
    .set(updates)
    .where(eq(brandCampaigns.id, campaignId))
    .returning();

  await sendMessage({
    campaignId,
    senderType: 'system',
    message: `📋 Campaign status updated: ${status.replace(/_/g, ' ')}`,
  });

  return updated;
}

// ═══════════════════════════════════════════════════════════════
// MESSAGING SYSTEM — Brand ↔ Artist chat within campaigns
// ═══════════════════════════════════════════════════════════════

export async function sendMessage(params: {
  campaignId: number;
  senderType: 'brand' | 'artist' | 'system';
  senderUserId?: number;
  message: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file' | 'audio';
}) {
  const [msg] = await db.insert(brandMessages).values({
    campaignId: params.campaignId,
    senderType: params.senderType,
    senderUserId: params.senderUserId || null,
    message: params.message,
    attachmentUrl: params.attachmentUrl || null,
    attachmentType: params.attachmentType || null,
  }).returning();
  return msg;
}

export async function getCampaignMessages(campaignId: number, limit = 100) {
  return db.select().from(brandMessages)
    .where(eq(brandMessages.campaignId, campaignId))
    .orderBy(asc(brandMessages.createdAt))
    .limit(limit);
}

export async function markMessagesRead(campaignId: number, readerType: 'brand' | 'artist') {
  const oppositeType = readerType === 'brand' ? 'artist' : 'brand';
  await db.update(brandMessages)
    .set({ isRead: true })
    .where(and(
      eq(brandMessages.campaignId, campaignId),
      eq(brandMessages.senderType, oppositeType),
      eq(brandMessages.isRead, false),
    ));
}

export async function getUnreadCount(campaignId: number, readerType: 'brand' | 'artist') {
  const oppositeType = readerType === 'brand' ? 'artist' : 'brand';
  const [result] = await db.select({
    count: sql<number>`count(*)::int`,
  }).from(brandMessages)
    .where(and(
      eq(brandMessages.campaignId, campaignId),
      eq(brandMessages.senderType, oppositeType),
      eq(brandMessages.isRead, false),
    ));
  return result?.count || 0;
}

// ═══════════════════════════════════════════════════════════════
// AI CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a promo image for a campaign — artist holding/showcasing the brand's product
 * Uses the existing FAL pipeline: GPT Image 1.5 → Flux Kontext → Bria → Sharp fallback
 */
export async function generateCampaignPromoImage(params: {
  campaignId: number;
  productId: number;
  artistImageUrl: string;
  productImageUrl: string;
  productName: string;
}) {
  const { campaignId, productId, artistImageUrl, productImageUrl, productName } = params;

  // Create pending content record
  const [content] = await db.insert(campaignContent).values({
    campaignId,
    productId,
    type: 'promo_image',
    status: 'generating',
    prompt: `Artist endorsement photo for ${productName}`,
  }).returning();

  try {
    const result = await generateProductPromoImage(artistImageUrl, productImageUrl, productName);

    if (result.success && result.imageUrl) {
      const [updated] = await db.update(campaignContent)
        .set({
          imageUrl: result.imageUrl,
          aiModel: result.provider || 'fal-multi-strategy',
          status: 'ready',
        })
        .where(eq(campaignContent.id, content.id))
        .returning();
      return { success: true, content: updated };
    }

    await db.update(campaignContent)
      .set({ status: 'rejected' })
      .where(eq(campaignContent.id, content.id));
    return { success: false, error: result.error || 'Image generation failed' };
  } catch (err) {
    await db.update(campaignContent)
      .set({ status: 'rejected' })
      .where(eq(campaignContent.id, content.id));
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Generate a viral promo video with PixVerse C1 Reference-to-Video
 * Uses artist reference image + product to create dynamic video content
 * Fallbacks: PixVerse Image-to-Video → Grok Imagine Video
 */
export async function generateCampaignPromoVideo(params: {
  campaignId: number;
  productId: number;
  promoImageUrl: string;
  productName: string;
  artistName: string;
  artistGenre: string;
}) {
  const { campaignId, productId, promoImageUrl, productName, artistName, artistGenre } = params;

  const [content] = await db.insert(campaignContent).values({
    campaignId,
    productId,
    type: 'promo_video',
    status: 'generating',
    prompt: `PixVerse viral: ${artistName} × ${productName}`,
  }).returning();

  const genreVibes: Record<string, string> = {
    'hip-hop': 'confident swagger, urban neon lights, slow-mo flex with product',
    'pop': 'bright colors, playful energy, smooth transitions, sparkle effects',
    'rock': 'gritty raw energy, dramatic spotlights, high contrast, headbang reveal',
    'reggaeton': 'tropical heat, vibrant colors, dynamic camera shake, fiesta energy',
    'electronic': 'pulsing LED trails, futuristic holograms, beat-synced visuals',
    'r&b': 'silky smooth movement, warm amber lighting, sensual slow pan',
    'latin': 'fiery passion, vibrant warm colors, rhythmic movement, golden glow',
    'jazz': 'elegant noir, warm spotlight, sophisticated angles, smoky lounge',
    'indie': 'warm golden-hour, vintage film grain, artistic slow-motion, bokeh',
    'country': 'golden sunset, rustic warm lighting, open field, Americana vibes',
  };
  const vibe = genreVibes[artistGenre.toLowerCase()] || genreVibes['pop'];
  const videoPrompt = `Cinematic TikTok product ad. A charismatic music artist showcases "${productName}" with magnetic energy. ${vibe}. Dynamic camera movement from wide to dramatic close-up of the product. The artist holds the product confidently, smiles, and presents it to camera. Professional commercial lighting. Vertical format. Ultra-smooth motion. No text, no watermarks.`;

  try {
    // Strategy 1: PixVerse C1 Reference-to-Video (preserves artist likeness)
    console.log(`🎬 [Influencer] PixVerse Reference-to-Video: ${artistName} × ${productName}`);
    const pixverseResult = await callPixVerseReferenceToVideo(promoImageUrl, videoPrompt);
    if (pixverseResult.success && pixverseResult.videoUrl) {
      const [updated] = await db.update(campaignContent)
        .set({ videoUrl: pixverseResult.videoUrl, aiModel: 'pixverse-c1-reference', status: 'ready' })
        .where(eq(campaignContent.id, content.id)).returning();
      return { success: true, content: updated };
    }

    // Strategy 2: PixVerse C1 Image-to-Video
    console.log(`🎬 [Influencer] Fallback: PixVerse Image-to-Video`);
    const i2vResult = await callPixVerseImageToVideo(promoImageUrl, videoPrompt);
    if (i2vResult.success && i2vResult.videoUrl) {
      const [updated] = await db.update(campaignContent)
        .set({ videoUrl: i2vResult.videoUrl, aiModel: 'pixverse-c1-i2v', status: 'ready' })
        .where(eq(campaignContent.id, content.id)).returning();
      return { success: true, content: updated };
    }

    // Strategy 3: Grok Imagine Video (final fallback)
    console.log(`🎬 [Influencer] Final fallback: Grok Imagine Video`);
    const grokResult = await generateProductPromoVideo(promoImageUrl, productName, artistName, artistGenre);
    if (grokResult.success && grokResult.videoUrl) {
      const [updated] = await db.update(campaignContent)
        .set({ videoUrl: grokResult.videoUrl, aiModel: 'grok-imagine-video', status: 'ready' })
        .where(eq(campaignContent.id, content.id)).returning();
      return { success: true, content: updated };
    }

    await db.update(campaignContent).set({ status: 'rejected' }).where(eq(campaignContent.id, content.id));
    return { success: false, error: 'All video generation strategies failed' };
  } catch (err) {
    await db.update(campaignContent).set({ status: 'rejected' }).where(eq(campaignContent.id, content.id));
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// PixVerse C1 Reference-to-Video API call
async function callPixVerseReferenceToVideo(referenceImageUrl: string, prompt: string) {
  try {
    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/pixverse/c1/reference-to-video`,
      {
        prompt,
        reference_image_url: referenceImageUrl,
        duration: 5,
        quality: 'high',
        aspect_ratio: '9:16',
        negative_prompt: 'text, watermark, logo, caption, subtitle, blurry, low quality',
      },
      {
        headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 300000,
      }
    );
    const videoUrl = response.data?.video?.url;
    return videoUrl ? { success: true, videoUrl } : { success: false, error: 'No video URL in response' };
  } catch (err: any) {
    console.error(`❌ PixVerse ref-to-video failed:`, err.response?.data?.detail || err.message);
    return { success: false, error: err.message };
  }
}

// PixVerse C1 Image-to-Video API call
async function callPixVerseImageToVideo(imageUrl: string, prompt: string) {
  try {
    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/pixverse/c1/image-to-video`,
      {
        prompt,
        image_url: imageUrl,
        duration: 5,
        quality: 'high',
        aspect_ratio: '9:16',
        negative_prompt: 'text, watermark, logo, caption, subtitle, blurry, low quality',
      },
      {
        headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 300000,
      }
    );
    const videoUrl = response.data?.video?.url;
    return videoUrl ? { success: true, videoUrl } : { success: false, error: 'No video URL in response' };
  } catch (err: any) {
    console.error(`❌ PixVerse image-to-video failed:`, err.response?.data?.detail || err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Generate batch promo images (gallery) for a campaign based on package limits
 */
export async function generateCampaignGallery(params: {
  campaignId: number; productId: number;
  artistImageUrl: string; productImageUrl: string;
  productName: string; count: number;
}) {
  const results = [];
  const scenes = [
    'studio lighting, product endorsement pose, clean white background',
    'urban street style, artist walking with product, cinematic',
    'close-up editorial, artist examining product, magazine cover style',
    'lifestyle photo, artist using product naturally, warm golden hour',
    'dramatic spotlight, artist presenting product, dark background',
    'outdoor fashion shoot, artist with product, city skyline',
  ];

  for (let i = 0; i < Math.min(params.count, 20); i++) {
    const scene = scenes[i % scenes.length];
    try {
      const result = await generateProductPromoImage(
        params.artistImageUrl, params.productImageUrl,
        `${params.productName} — ${scene}`
      );
      const [content] = await db.insert(campaignContent).values({
        campaignId: params.campaignId, productId: params.productId,
        type: 'promo_image', status: result.success ? 'ready' : 'rejected',
        imageUrl: result.imageUrl || null, aiModel: result.provider || 'fal',
        prompt: `Gallery #${i + 1}: ${scene}`,
      }).returning();
      results.push({ success: result.success, content });
    } catch (err) {
      results.push({ success: false, error: (err as Error).message });
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// PROMOTIONAL DIALOGUE SCRIPT — AI-generated product pitch
// ═══════════════════════════════════════════════════════════════

export async function generatePromotionalDialogue(params: {
  campaignId: number;
  productName: string; productDescription: string;
  brandName: string; artistName: string; artistGenre: string;
  durationSeconds?: number;
}) {
  const duration = params.durationSeconds || 30;
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a creative director writing a ${duration}-second promotional dialogue script for a music artist endorsing a product.

Artist: ${params.artistName} (genre: ${params.artistGenre})
Brand: ${params.brandName}
Product: ${params.productName}
Product Info: ${params.productDescription || 'Premium quality product'}

Write a natural, authentic promotional dialogue script that:
- Sounds like the artist genuinely loves and uses the product
- Matches the artist's genre vibe and personality
- Has a hook in the first 3 seconds
- Includes a call-to-action
- Feels native to TikTok/Instagram Reels
- Duration: ~${duration} seconds when spoken

Format:
[HOOK - 3s]
...opening line...

[BODY - ${duration - 8}s]
...main dialogue...

[CTA - 5s]
...call to action...

Write ONLY the script, no explanations.`;

  const result = await model.generateContent(prompt);
  const script = result.response.text();

  const [content] = await db.insert(campaignContent).values({
    campaignId: params.campaignId,
    type: 'social_post',
    caption: script,
    aiModel: 'gemini-2.0-flash',
    prompt: `Promotional dialogue: ${params.artistName} × ${params.productName}`,
    status: 'ready',
  }).returning();

  return { success: true, script, content };
}

// ═══════════════════════════════════════════════════════════════
// BRAND SONG — AI-generated jingle/song featuring the product
// ═══════════════════════════════════════════════════════════════

export async function generateBrandSong(params: {
  campaignId: number;
  productName: string; brandName: string;
  artistName: string; artistGenre: string;
  artistGender?: 'male' | 'female';
}) {
  const [song] = await db.insert(campaignSongs).values({
    campaignId: params.campaignId,
    title: `${params.brandName} × ${params.artistName}`,
    genre: params.artistGenre, mood: 'upbeat',
    status: 'generating',
  }).returning();

  try {
    const { generateArtistSongWithLyria3 } = await import('./lyria3-service');
    const customLyrics = generateBrandSongLyrics(params.productName, params.brandName, params.artistGenre);

    const result = await generateArtistSongWithLyria3(
      params.artistName,
      `${params.brandName} Anthem`,
      params.artistGenre,
      'upbeat energetic commercial',
      params.artistGender || 'male',
      customLyrics,
    );

    if (result.success && result.audioUrl) {
      const [updated] = await db.update(campaignSongs).set({
        audioUrl: result.audioUrl, lyrics: result.lyrics || customLyrics,
        aiModel: 'lyria-3', status: 'ready',
        duration: result.duration || 30,
      }).where(eq(campaignSongs.id, song.id)).returning();
      return { success: true, song: updated };
    }

    // Fallback: MiniMax via FAL
    const { generateArtistSongWithFAL } = await import('./fal-service');
    const falResult = await generateArtistSongWithFAL(
      params.artistName,
      `${params.brandName} Anthem`,
      params.artistGenre, 'upbeat',
      params.artistGender || 'male',
      customLyrics,
    );

    if (falResult.success && falResult.audioUrl) {
      const [updated] = await db.update(campaignSongs).set({
        audioUrl: falResult.audioUrl, lyrics: falResult.lyrics || customLyrics,
        aiModel: 'minimax-music', status: 'ready',
      }).where(eq(campaignSongs.id, song.id)).returning();
      return { success: true, song: updated };
    }

    await db.update(campaignSongs).set({ status: 'rejected' }).where(eq(campaignSongs.id, song.id));
    return { success: false, error: 'Song generation failed with all providers' };
  } catch (err) {
    await db.update(campaignSongs).set({ status: 'rejected' }).where(eq(campaignSongs.id, song.id));
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function generateBrandSongLyrics(productName: string, brandName: string, genre: string): string {
  return `[Verse 1]
Yo I found something new, something that's real
${brandName} got the ${productName}, man you know the deal
Quality on point, style on a hundred
Every time I bring it out, people left stunned

[Chorus]
${brandName}, ${brandName}, that's the name you know
${productName} in my hand, watch me steal the show
From the studio to the streets, everywhere I go
${brandName} got the wave, let the whole world know

[Verse 2]
They ask me what I'm rocking, I tell them every time
${brandName} ${productName}, yeah that joint is mine
Not just a product, it's a lifestyle thing
When you feel this quality, makes your heart sing

[Chorus]
${brandName}, ${brandName}, that's the name you know
${productName} in my hand, watch me steal the show`;
}

export async function getCampaignSongs(campaignId: number) {
  return db.select().from(campaignSongs)
    .where(eq(campaignSongs.campaignId, campaignId))
    .orderBy(desc(campaignSongs.createdAt));
}

/**
 * Generate a social media caption + hashtags for a campaign content piece
 */
export async function generateCampaignCaption(params: {
  contentId: number;
  brandName: string;
  productName: string;
  artistName: string;
  artistGenre: string;
  platform: 'instagram' | 'tiktok' | 'twitter';
}) {
  const { contentId, brandName, productName, artistName, artistGenre, platform } = params;

  const platformLength: Record<string, number> = {
    instagram: 2200,
    tiktok: 300,
    twitter: 280,
  };
  const maxLen = platformLength[platform] || 300;

  // Simple template-based caption (avoids extra API call cost for MVP)
  const captions: Record<string, string[]> = {
    instagram: [
      `🔥 When ${artistName} meets @${brandName} — magic happens.\n\nRocking the ${productName} because real ones know quality. This isn't just a product, it's a statement.\n\n#${brandName.replace(/\s+/g, '')} #${artistName.replace(/\s+/g, '')} #Collab #BrandPartner #${artistGenre.replace(/\s+/g, '')}`,
      `New collab alert 🚨 ${artistName} × ${brandName}\n\nThe ${productName} hits different when it's part of the culture. Elevating the game, one collab at a time.\n\n#Ad #Sponsored #${brandName.replace(/\s+/g, '')} #NewDrop`,
    ],
    tiktok: [
      `${artistName} × ${brandName} 🔥 The ${productName} goes crazy! #collab #${brandName.replace(/\s+/g, '')} #fyp #viral`,
      `POV: ${artistName} found their new favorite ${productName} 👀 @${brandName} #ad #brandpartner #fyp`,
    ],
    twitter: [
      `🔥 New collab with @${brandName}! The ${productName} is insane. Real quality, real vibes. #${artistGenre} #Collab`,
      `Partnering with @${brandName} on something special 👀 The ${productName} speaks for itself.`,
    ],
  };

  const options = captions[platform] || captions.instagram;
  const caption = options[Math.floor(Math.random() * options.length)];
  const hashtags = [
    `#${brandName.replace(/\s+/g, '')}`,
    `#${artistName.replace(/\s+/g, '')}`,
    '#BrandCollab', '#Sponsored', '#Ad',
    `#${artistGenre.replace(/\s+/g, '')}Music`,
  ];

  await db.update(campaignContent)
    .set({ caption, hashtags })
    .where(eq(campaignContent.id, contentId));

  return { caption, hashtags };
}

/**
 * Get all content pieces for a campaign
 */
export async function getCampaignContent(campaignId: number) {
  return db.select().from(campaignContent)
    .where(eq(campaignContent.campaignId, campaignId))
    .orderBy(desc(campaignContent.createdAt));
}

/**
 * Get campaign dashboard stats for an artist
 */
export async function getInfluencerStats(artistId: number) {
  const [campaignStats] = await db.select({
    totalCampaigns: sql<number>`count(*)::int`,
    activeCampaigns: sql<number>`count(*) filter (where ${brandCampaigns.status} in ('accepted', 'content_creation', 'review', 'revision'))::int`,
    totalRevenue: sql<string>`coalesce(sum(${brandCampaigns.artistEarning}::numeric) filter (where ${brandCampaigns.status} in ('paid', 'completed')), 0)::text`,
    pendingRevenue: sql<string>`coalesce(sum(${brandCampaigns.artistEarning}::numeric) filter (where ${brandCampaigns.status} in ('delivered', 'payment_pending')), 0)::text`,
  })
    .from(brandCampaigns)
    .where(eq(brandCampaigns.artistId, artistId));

  const [contentStats] = await db.select({
    totalImages: sql<number>`count(*) filter (where ${campaignContent.type} = 'promo_image')::int`,
    totalVideos: sql<number>`count(*) filter (where ${campaignContent.type} = 'promo_video')::int`,
    totalContent: sql<number>`count(*)::int`,
  })
    .from(campaignContent)
    .innerJoin(brandCampaigns, eq(campaignContent.campaignId, brandCampaigns.id))
    .where(eq(brandCampaigns.artistId, artistId));

  const [songStats] = await db.select({
    totalSongs: sql<number>`count(*)::int`,
  }).from(campaignSongs)
    .innerJoin(brandCampaigns, eq(campaignSongs.campaignId, brandCampaigns.id))
    .where(eq(brandCampaigns.artistId, artistId));

  const [messageStats] = await db.select({
    unreadMessages: sql<number>`count(*) filter (where ${brandMessages.isRead} = false and ${brandMessages.senderType} = 'brand')::int`,
  }).from(brandMessages)
    .innerJoin(brandCampaigns, eq(brandMessages.campaignId, brandCampaigns.id))
    .where(eq(brandCampaigns.artistId, artistId));

  return {
    campaigns: campaignStats,
    content: contentStats,
    songs: songStats,
    messages: messageStats,
  };
}
