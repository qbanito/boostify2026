// API Routes for Agent Marketplace
import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  agentMarketplaceListings,
  agentMarketplaceInstalls,
  users,
} from '../../db/schema';
import { eq, desc, and, sql, count, ilike, inArray, or } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();

// ============================================
// PUBLIC — Browse marketplace (no auth required for reading)
// ============================================

/**
 * GET /api/marketplace/agents
 * Browse published marketplace listings with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      agentType,
      search,
      featured,
      sort = 'popular',
      limit = '24',
      offset = '0',
    } = req.query;

    const conditions = [eq(agentMarketplaceListings.status, 'published')];

    if (category && typeof category === 'string') {
      conditions.push(eq(agentMarketplaceListings.category, category as any));
    }
    if (agentType && typeof agentType === 'string') {
      conditions.push(eq(agentMarketplaceListings.agentType, agentType as any));
    }
    if (featured === 'true') {
      conditions.push(eq(agentMarketplaceListings.isFeatured, true));
    }
    if (search && typeof search === 'string') {
      conditions.push(
        or(
          ilike(agentMarketplaceListings.name, `%${search}%`),
          ilike(agentMarketplaceListings.shortDescription, `%${search}%`)
        )!
      );
    }

    let orderBy;
    switch (sort) {
      case 'newest':
        orderBy = desc(agentMarketplaceListings.publishedAt);
        break;
      case 'rating':
        orderBy = desc(agentMarketplaceListings.avgRating);
        break;
      case 'popular':
      default:
        orderBy = desc(agentMarketplaceListings.installCount);
        break;
    }

    const listings = await db.select()
      .from(agentMarketplaceListings)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(Number(limit))
      .offset(Number(offset));

    // Total count for pagination
    const [{ total }] = await db.select({ total: count() })
      .from(agentMarketplaceListings)
      .where(and(...conditions));

    res.json({
      success: true,
      listings,
      pagination: {
        total: Number(total),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error) {
    console.error('[MARKETPLACE] Error fetching listings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch marketplace listings' });
  }
});

/**
 * GET /api/marketplace/agents/featured
 * Get featured listings for the homepage carousel
 */
router.get('/featured', async (_req: Request, res: Response) => {
  try {
    const listings = await db.select()
      .from(agentMarketplaceListings)
      .where(and(
        eq(agentMarketplaceListings.status, 'published'),
        eq(agentMarketplaceListings.isFeatured, true)
      ))
      .orderBy(desc(agentMarketplaceListings.installCount))
      .limit(8);

    res.json({ success: true, listings });
  } catch (error) {
    console.error('[MARKETPLACE] Error fetching featured:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch featured listings' });
  }
});

/**
 * GET /api/marketplace/agents/categories
 * Get aggregate counts per category
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const cats = await db.select({
      category: agentMarketplaceListings.category,
      count: count(),
    })
    .from(agentMarketplaceListings)
    .where(eq(agentMarketplaceListings.status, 'published'))
    .groupBy(agentMarketplaceListings.category);

    res.json({ success: true, categories: cats });
  } catch (error) {
    console.error('[MARKETPLACE] Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/marketplace/agents/:slug
 * Get a single listing detail by slug
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [listing] = await db.select()
      .from(agentMarketplaceListings)
      .where(and(
        eq(agentMarketplaceListings.slug, slug),
        eq(agentMarketplaceListings.status, 'published')
      ))
      .limit(1);

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    res.json({ success: true, listing });
  } catch (error) {
    console.error('[MARKETPLACE] Error fetching listing:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch listing' });
  }
});

// ============================================
// AUTHENTICATED — Install, uninstall, rate
// ============================================

/**
 * GET /api/marketplace/agents/user/installed
 * Get the current user's installed agents
 */
router.get('/user/installed', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const installed = await db.select({
      install: agentMarketplaceInstalls,
      listing: agentMarketplaceListings,
    })
    .from(agentMarketplaceInstalls)
    .innerJoin(agentMarketplaceListings, eq(agentMarketplaceInstalls.listingId, agentMarketplaceListings.id))
    .where(and(
      eq(agentMarketplaceInstalls.userId, userId),
      eq(agentMarketplaceInstalls.isActive, true)
    ))
    .orderBy(desc(agentMarketplaceInstalls.installedAt));

    res.json({ success: true, installed });
  } catch (error) {
    console.error('[MARKETPLACE] Error fetching installed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch installed agents' });
  }
});

/**
 * POST /api/marketplace/agents/:id/install
 * Install a marketplace agent
 */
router.post('/:id/install', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const listingId = parseInt(req.params.id);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Check listing exists and is published
    const [listing] = await db.select()
      .from(agentMarketplaceListings)
      .where(and(
        eq(agentMarketplaceListings.id, listingId),
        eq(agentMarketplaceListings.status, 'published')
      ))
      .limit(1);

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    // Check if already installed
    const [existing] = await db.select()
      .from(agentMarketplaceInstalls)
      .where(and(
        eq(agentMarketplaceInstalls.userId, userId),
        eq(agentMarketplaceInstalls.listingId, listingId),
        eq(agentMarketplaceInstalls.isActive, true)
      ))
      .limit(1);

    if (existing) {
      return res.status(400).json({ success: false, error: 'Already installed' });
    }

    // Create install record
    const [install] = await db.insert(agentMarketplaceInstalls).values({
      userId,
      listingId,
    }).returning();

    // Increment install count
    await db.update(agentMarketplaceListings)
      .set({
        installCount: sql`${agentMarketplaceListings.installCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agentMarketplaceListings.id, listingId));

    res.json({ success: true, install });
  } catch (error) {
    console.error('[MARKETPLACE] Error installing:', error);
    res.status(500).json({ success: false, error: 'Failed to install agent' });
  }
});

/**
 * POST /api/marketplace/agents/:id/uninstall
 * Uninstall a marketplace agent
 */
router.post('/:id/uninstall', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const listingId = parseInt(req.params.id);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const [updated] = await db.update(agentMarketplaceInstalls)
      .set({
        isActive: false,
        uninstalledAt: new Date(),
      })
      .where(and(
        eq(agentMarketplaceInstalls.userId, userId),
        eq(agentMarketplaceInstalls.listingId, listingId),
        eq(agentMarketplaceInstalls.isActive, true)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Install not found' });
    }

    // Decrement install count
    await db.update(agentMarketplaceListings)
      .set({
        installCount: sql`GREATEST(${agentMarketplaceListings.installCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(agentMarketplaceListings.id, listingId));

    res.json({ success: true });
  } catch (error) {
    console.error('[MARKETPLACE] Error uninstalling:', error);
    res.status(500).json({ success: false, error: 'Failed to uninstall agent' });
  }
});

/**
 * POST /api/marketplace/agents/:id/rate
 * Rate an installed agent
 */
router.post('/:id/rate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const listingId = parseInt(req.params.id);
    const { rating, review } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be 1-5' });
    }

    // Must have installed to rate
    const [install] = await db.select()
      .from(agentMarketplaceInstalls)
      .where(and(
        eq(agentMarketplaceInstalls.userId, userId),
        eq(agentMarketplaceInstalls.listingId, listingId)
      ))
      .limit(1);

    if (!install) {
      return res.status(403).json({ success: false, error: 'Must install before rating' });
    }

    // Update the install record with the rating
    await db.update(agentMarketplaceInstalls)
      .set({ rating: Math.round(rating), review: review || null })
      .where(eq(agentMarketplaceInstalls.id, install.id));

    // Recalculate average
    const [stats] = await db.select({
      avg: sql<string>`COALESCE(AVG(${agentMarketplaceInstalls.rating}), 0)`,
      cnt: sql<number>`COUNT(${agentMarketplaceInstalls.rating})`,
    })
    .from(agentMarketplaceInstalls)
    .where(and(
      eq(agentMarketplaceInstalls.listingId, listingId),
      sql`${agentMarketplaceInstalls.rating} IS NOT NULL`
    ));

    await db.update(agentMarketplaceListings)
      .set({
        avgRating: stats.avg,
        ratingCount: Number(stats.cnt),
        updatedAt: new Date(),
      })
      .where(eq(agentMarketplaceListings.id, listingId));

    res.json({ success: true, avgRating: Number(Number(stats.avg).toFixed(2)), ratingCount: Number(stats.cnt) });
  } catch (error) {
    console.error('[MARKETPLACE] Error rating:', error);
    res.status(500).json({ success: false, error: 'Failed to rate agent' });
  }
});

/**
 * POST /api/marketplace/agents/seed
 * Seed initial marketplace listings (admin only / dev)
 */
router.post('/seed', authenticate, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.isAdmin;
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    // Check if already seeded
    const [existing] = await db.select({ c: count() }).from(agentMarketplaceListings);
    if (Number(existing.c) > 0) {
      return res.json({ success: true, message: 'Already seeded', count: Number(existing.c) });
    }

    const seedListings = [
      {
        authorName: 'Boostify Team',
        name: 'Hit Song Formula',
        slug: 'hit-song-formula',
        shortDescription: 'AI-powered workflow that analyzes trending patterns and helps you compose chart-ready songs',
        longDescription: 'Combines the Composer and Marketing agents to first analyze current music trends, then generate lyrics and melodies optimized for streaming platforms. Includes genre detection, hook analysis, and playlist placement strategy.',
        agentType: 'multi-agent' as const,
        category: 'workflow' as const,
        tags: ['songwriting', 'trends', 'hit-making', 'streaming'],
        color: 'from-purple-600 to-blue-600',
        isFree: true,
        price: '0',
        configuration: {
          steps: [
            { name: 'Trend Analysis', description: 'Analyze current music trends', agentType: 'marketing', prompt: 'Analyze current top 50 trending songs and identify common patterns in {{genre}}.' },
            { name: 'Lyric Generation', description: 'Generate lyrics based on trends', agentType: 'composer', prompt: 'Write lyrics following the identified trends for a {{genre}} song about {{topic}}.' },
            { name: 'Playlist Strategy', description: 'Create playlist placement plan', agentType: 'marketing', prompt: 'Create a playlist placement strategy for this new song.' },
          ],
          requiredInputs: [
            { key: 'genre', label: 'Genre', type: 'text', required: true },
            { key: 'topic', label: 'Song Topic', type: 'text', required: true },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: true,
        isVerified: true,
        installCount: 342,
        avgRating: '4.7',
        ratingCount: 89,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'Album Launch Kit',
        slug: 'album-launch-kit',
        shortDescription: 'Complete album release automation — from cover art to social campaigns',
        longDescription: 'A multi-step workflow that coordinates Photographer, Marketing, and Social Media agents. Generates album artwork, creates a 30-day pre-release campaign, schedules social posts, and prepares press materials.',
        agentType: 'multi-agent' as const,
        category: 'automation' as const,
        tags: ['album', 'release', 'campaign', 'launch'],
        color: 'from-orange-500 to-red-600',
        isFree: true,
        price: '0',
        configuration: {
          steps: [
            { name: 'Cover Art', description: 'Generate album cover concepts', agentType: 'photographer', prompt: 'Create 3 album cover concepts for "{{albumName}}" in {{style}} style.' },
            { name: 'Campaign Plan', description: 'Build 30-day launch campaign', agentType: 'marketing', prompt: 'Create a 30-day pre-release campaign for album "{{albumName}}".' },
            { name: 'Social Content', description: 'Generate social media content pack', agentType: 'social-media', prompt: 'Create a content pack for promoting "{{albumName}}" across all platforms.' },
          ],
          requiredInputs: [
            { key: 'albumName', label: 'Album Name', type: 'text', required: true },
            { key: 'style', label: 'Visual Style', type: 'text', required: false },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: true,
        isVerified: true,
        installCount: 218,
        avgRating: '4.5',
        ratingCount: 56,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'Viral TikTok Strategy',
        slug: 'viral-tiktok-strategy',
        shortDescription: 'Data-driven TikTok content strategy with trend-matching hooks',
        longDescription: 'Specialized Social Media agent template pre-configured with TikTok trend analysis, hook optimization, and sound selection. Generates 30 days of TikTok content ideas tailored to your music.',
        agentType: 'social-media' as const,
        category: 'template' as const,
        tags: ['tiktok', 'viral', 'social-media', 'short-form'],
        color: 'from-pink-500 to-rose-600',
        isFree: true,
        price: '0',
        configuration: {
          systemPrompt: 'You are a TikTok content strategist specialized in music promotion. Focus on viral hooks, trending sounds, duet opportunities, and challenge creation. Always provide specific timestamps for hooks and trending audio references.',
          tools: ['generate_post_pack', 'create_content_calendar'],
          requiredInputs: [
            { key: 'musicStyle', label: 'Your Music Style', type: 'text', required: true },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: true,
        isVerified: true,
        installCount: 567,
        avgRating: '4.8',
        ratingCount: 134,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'Music Video Storyboard Pro',
        slug: 'music-video-storyboard-pro',
        shortDescription: 'Professional-grade storyboarding with scene-by-scene AI visualization',
        longDescription: 'Enhanced Video Director template that generates detailed storyboards with camera angles, lighting notes, and AI-generated scene concept images. Perfect for pre-production planning.',
        agentType: 'video-director' as const,
        category: 'template' as const,
        tags: ['video', 'storyboard', 'pre-production', 'visual'],
        color: 'from-violet-500 to-purple-600',
        isFree: true,
        price: '0',
        configuration: {
          systemPrompt: 'You are an expert music video director and storyboard artist. For every scene, provide: Scene number, Duration, Camera angle (wide/medium/close-up), Camera movement (static/pan/dolly/crane), Lighting (natural/studio/neon/contrast), Color palette, Actor/performer direction, Props needed, Post-production effects.',
          tools: ['create_storyboard', 'generate_scene_image'],
          requiredInputs: [
            { key: 'songTitle', label: 'Song Title', type: 'text', required: true },
            { key: 'mood', label: 'Video Mood', type: 'text', required: true },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: false,
        isVerified: true,
        installCount: 145,
        avgRating: '4.6',
        ratingCount: 41,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'Merch Empire Builder',
        slug: 'merch-empire-builder',
        shortDescription: 'Design a complete merchandise line with brand-consistent AI artwork',
        longDescription: 'Combines Merchandise and Marketing agents to design a full product line (t-shirts, hoodies, caps, posters) with consistent branding and pricing strategies.',
        agentType: 'merchandise' as const,
        category: 'workflow' as const,
        tags: ['merch', 'design', 'branding', 'e-commerce'],
        color: 'from-amber-500 to-orange-600',
        isFree: true,
        price: '0',
        configuration: {
          steps: [
            { name: 'Brand Analysis', description: 'Analyze artist brand identity', agentType: 'manager', prompt: 'Analyze the brand identity of {{artistName}} and define visual guidelines for merchandise.' },
            { name: 'Design Generation', description: 'Generate merch designs', agentType: 'merchandise', prompt: 'Create 5 merch design concepts for {{artistName}} following their brand guidelines.' },
            { name: 'Pricing Strategy', description: 'Set optimal pricing', agentType: 'marketing', prompt: 'Create a pricing strategy for the merchandise line.' },
          ],
          requiredInputs: [
            { key: 'artistName', label: 'Artist Name', type: 'text', required: true },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: false,
        isVerified: true,
        installCount: 98,
        avgRating: '4.3',
        ratingCount: 27,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'Career Roadmap 360',
        slug: 'career-roadmap-360',
        shortDescription: 'Generate a comprehensive 12-month career development plan',
        longDescription: 'Manager agent template that creates a detailed career roadmap covering: goal setting, milestone tracking, networking strategies, revenue diversification, skill development, and industry positioning.',
        agentType: 'manager' as const,
        category: 'template' as const,
        tags: ['career', 'planning', 'strategy', 'growth'],
        color: 'from-cyan-500 to-blue-600',
        isFree: true,
        price: '0',
        configuration: {
          systemPrompt: 'You are a senior music industry career manager with 20+ years of experience. Create detailed, actionable career roadmaps with specific timelines, KPIs, and contingency plans. Consider streaming revenue, live performances, sync licensing, brand partnerships, and merchandise as revenue streams.',
          tools: ['create_career_roadmap', 'generate_pitch_deck'],
          requiredInputs: [
            { key: 'currentStage', label: 'Current Career Stage', type: 'text', required: true },
            { key: 'goals', label: 'Primary Goals', type: 'text', required: true },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: true,
        isVerified: true,
        installCount: 203,
        avgRating: '4.4',
        ratingCount: 62,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'Spotify Growth Hacker',
        slug: 'spotify-growth-hacker',
        shortDescription: 'Automated playlist pitching and Spotify algorithm optimization',
        longDescription: 'Marketing agent template fine-tuned for Spotify growth. Generates playlist pitching emails, analyzes release timing, optimizes metadata, and creates editorial playlist submission strategies.',
        agentType: 'marketing' as const,
        category: 'prompt-pack' as const,
        tags: ['spotify', 'playlists', 'growth', 'streaming'],
        color: 'from-green-500 to-emerald-600',
        isFree: true,
        price: '0',
        configuration: {
          systemPrompt: 'You are a Spotify growth strategist. Focus on: playlist pitching (both editorial and independent), release timing optimization, metadata best practices, pre-save campaigns, Spotify for Artists tips, algorithm triggers (save rate, skip rate, completion rate), and playlist placement outreach templates.',
          tools: ['create_campaign', 'schedule_posts'],
          requiredInputs: [
            { key: 'trackTitle', label: 'Track Title', type: 'text', required: true },
            { key: 'releaseDate', label: 'Release Date', type: 'text', required: false },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: false,
        isVerified: true,
        installCount: 412,
        avgRating: '4.6',
        ratingCount: 97,
        publishedAt: new Date(),
      },
      {
        authorName: 'Boostify Team',
        name: 'PR & Press Kit Generator',
        slug: 'pr-press-kit-generator',
        shortDescription: 'Create professional press kits and PR materials instantly',
        longDescription: 'Combines Manager and Marketing agents to generate professional press releases, artist bios, EPKs, and media pitch templates.',
        agentType: 'multi-agent' as const,
        category: 'toolkit' as const,
        tags: ['pr', 'press', 'media', 'publicity'],
        color: 'from-indigo-500 to-purple-600',
        isFree: true,
        price: '0',
        configuration: {
          steps: [
            { name: 'Artist Bio', description: 'Generate professional artist bio', agentType: 'manager', prompt: 'Write a professional artist bio for {{artistName}} suitable for press kits.' },
            { name: 'Press Release', description: 'Create press release template', agentType: 'marketing', prompt: 'Write a press release for {{artistName}}\'s upcoming release "{{releaseName}}".' },
            { name: 'Media Pitch', description: 'Generate media pitch emails', agentType: 'marketing', prompt: 'Create 3 media pitch email templates for different outlet types (blogs, radio, magazines).' },
          ],
          requiredInputs: [
            { key: 'artistName', label: 'Artist Name', type: 'text', required: true },
            { key: 'releaseName', label: 'Release Name', type: 'text', required: false },
          ],
        },
        requiredPlan: 'free' as const,
        status: 'published' as const,
        isFeatured: false,
        isVerified: true,
        installCount: 176,
        avgRating: '4.5',
        ratingCount: 48,
        publishedAt: new Date(),
      },
    ];

    const inserted = await db.insert(agentMarketplaceListings).values(seedListings).returning();

    res.json({ success: true, message: `Seeded ${inserted.length} marketplace listings`, count: inserted.length });
  } catch (error) {
    console.error('[MARKETPLACE] Error seeding:', error);
    res.status(500).json({ success: false, error: 'Failed to seed marketplace' });
  }
});

export default router;
