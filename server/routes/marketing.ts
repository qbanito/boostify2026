/**
 * Marketing Routes - Email campaigns, social media, and marketing tools
 * Connected to PostgreSQL database for merchandise marketing
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { 
  outreachCampaigns, 
  outreachEmailLog, 
  marketingMetrics,
  users 
} from '../../db/schema';
import { eq, desc, sql, and, gte, count } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = Router();

// ==================== MARKETING DASHBOARD ====================

/**
 * GET /api/marketing/stats - Get marketing statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get user from database
    const user = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = user[0].id;

    // Get campaign stats
    const campaigns = await db
      .select({
        total: count(),
        active: sql<number>`COUNT(*) FILTER (WHERE status = 'active')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
        totalSent: sql<number>`COALESCE(SUM(emails_sent), 0)`,
        totalOpened: sql<number>`COALESCE(SUM(emails_opened), 0)`,
        totalClicked: sql<number>`COALESCE(SUM(emails_clicked), 0)`,
        totalReplied: sql<number>`COALESCE(SUM(emails_replied), 0)`
      })
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.userId, userId));

    // Get marketing metrics
    const metrics = await db
      .select()
      .from(marketingMetrics)
      .where(eq(marketingMetrics.userId, userId))
      .limit(1);

    // Calculate open rate
    const stats = campaigns[0];
    const openRate = stats.totalSent > 0 
      ? Math.round((Number(stats.totalOpened) / Number(stats.totalSent)) * 100) 
      : 0;
    const clickRate = stats.totalOpened > 0 
      ? Math.round((Number(stats.totalClicked) / Number(stats.totalOpened)) * 100) 
      : 0;

    res.json({
      emailMarketing: {
        isActive: Number(stats.active) > 0,
        totalCampaigns: Number(stats.total),
        activeCampaigns: Number(stats.active),
        completedCampaigns: Number(stats.completed),
        totalSent: Number(stats.totalSent),
        totalOpened: Number(stats.totalOpened),
        totalClicked: Number(stats.totalClicked),
        totalReplied: Number(stats.totalReplied),
        openRate,
        clickRate
      },
      socialMedia: {
        isConnected: true,
        spotifyFollowers: metrics[0]?.spotifyFollowers || 0,
        instagramFollowers: metrics[0]?.instagramFollowers || 0,
        youtubeViews: metrics[0]?.youtubeViews || 0,
        totalEngagement: metrics[0]?.totalEngagement || 0
      },
      plugins: {
        abandonedCartRecovery: { enabled: true, recoveredCarts: 12, revenue: 450 },
        customerReviews: { enabled: true, totalReviews: 47, averageRating: 4.8 },
        loyaltyProgram: { enabled: true, activeMembers: 156, pointsIssued: 24500 },
        seoOptimizer: { enabled: true, score: 85, improvements: 3 }
      }
    });
  } catch (error: any) {
    console.error('Error fetching marketing stats:', error);
    res.status(500).json({ message: error.message || 'Error fetching marketing stats' });
  }
});

// ==================== EMAIL CAMPAIGNS ====================

/**
 * GET /api/marketing/campaigns - Get user's email campaigns
 */
router.get('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const campaigns = await db
      .select()
      .from(outreachCampaigns)
      .where(eq(outreachCampaigns.userId, user[0].id))
      .orderBy(desc(outreachCampaigns.createdAt))
      .limit(20);

    res.json(campaigns);
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ message: error.message || 'Error fetching campaigns' });
  }
});

/**
 * POST /api/marketing/campaigns - Create a new email campaign
 */
router.post('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, description, targetFilters, dailyLimit, scheduledAt } = req.body;

    const [campaign] = await db
      .insert(outreachCampaigns)
      .values({
        userId: user[0].id,
        name,
        description,
        targetFilters,
        dailyLimit: dailyLimit || 20,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      })
      .returning();

    res.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ message: error.message || 'Error creating campaign' });
  }
});

/**
 * PUT /api/marketing/campaigns/:id/status - Update campaign status
 */
router.put('/campaigns/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status } = req.body;

    const user = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (!user.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === 'active') updateData.startedAt = new Date();
    if (status === 'paused') updateData.pausedAt = new Date();
    if (status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db
      .update(outreachCampaigns)
      .set(updateData)
      .where(
        and(
          eq(outreachCampaigns.id, parseInt(id)),
          eq(outreachCampaigns.userId, user[0].id)
        )
      )
      .returning();

    res.json({ success: true, campaign: updated });
  } catch (error: any) {
    console.error('Error updating campaign status:', error);
    res.status(500).json({ message: error.message || 'Error updating campaign status' });
  }
});

// ==================== SOCIAL MEDIA POSTING ====================

/**
 * POST /api/marketing/social/post - Create a social media post
 */
router.post('/social/post', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { content, platforms, imageUrl, scheduledAt } = req.body;

    // Store scheduled post (in a real app, this would integrate with social APIs)
    // For now, return success to simulate the functionality
    res.json({
      success: true,
      post: {
        id: Date.now().toString(),
        content,
        platforms,
        imageUrl,
        scheduledAt,
        status: scheduledAt ? 'scheduled' : 'posted',
        createdAt: new Date()
      }
    });
  } catch (error: any) {
    console.error('Error creating social post:', error);
    res.status(500).json({ message: error.message || 'Error creating social post' });
  }
});

// ==================== MARKETING PLUGINS ====================

/**
 * GET /api/marketing/plugins/:plugin - Get plugin configuration
 */
router.get('/plugins/:plugin', authenticate, async (req: Request, res: Response) => {
  try {
    const { plugin } = req.params;
    
    // Return plugin configuration based on type
    const pluginConfigs: Record<string, any> = {
      'abandoned-cart': {
        enabled: true,
        reminderDelay: 24, // hours
        discountPercentage: 10,
        emailTemplate: 'default',
        stats: { recoveredCarts: 12, totalRevenue: 450, conversionRate: 15 }
      },
      'customer-reviews': {
        enabled: true,
        autoRequest: true,
        requestDelay: 7, // days after purchase
        minimumRating: 4,
        stats: { totalReviews: 47, averageRating: 4.8, pendingApproval: 3 }
      },
      'loyalty-program': {
        enabled: true,
        pointsPerDollar: 10,
        rewardThreshold: 1000,
        rewardValue: 10, // $10 discount
        stats: { activeMembers: 156, pointsIssued: 24500, redemptions: 34 }
      },
      'seo-optimizer': {
        enabled: true,
        autoMetaTags: true,
        sitemapEnabled: true,
        stats: { score: 85, pagesOptimized: 12, improvements: 3 }
      }
    };

    const config = pluginConfigs[plugin];
    if (!config) {
      return res.status(404).json({ message: 'Plugin not found' });
    }

    res.json(config);
  } catch (error: any) {
    console.error('Error fetching plugin config:', error);
    res.status(500).json({ message: error.message || 'Error fetching plugin config' });
  }
});

/**
 * PUT /api/marketing/plugins/:plugin - Update plugin configuration
 */
router.put('/plugins/:plugin', authenticate, async (req: Request, res: Response) => {
  try {
    const { plugin } = req.params;
    const config = req.body;

    // In a real app, this would save to database
    res.json({
      success: true,
      plugin,
      config: { ...config, updatedAt: new Date() }
    });
  } catch (error: any) {
    console.error('Error updating plugin config:', error);
    res.status(500).json({ message: error.message || 'Error updating plugin config' });
  }
});

// ==================== EMAIL TEMPLATES FOR MERCHANDISE ====================

/**
 * GET /api/marketing/email-templates - Get merchandise email templates
 */
router.get('/email-templates', authenticate, async (req: Request, res: Response) => {
  try {
    const templates = [
      {
        id: 'new-product',
        name: 'New Product Launch',
        subject: '🎵 New {artistName} Merch Just Dropped!',
        preview: 'Exclusive new merchandise from your favorite artist...'
      },
      {
        id: 'sale',
        name: 'Sale Announcement',
        subject: '🔥 {discountPercent}% OFF - Limited Time Only!',
        preview: 'Don\'t miss out on these exclusive deals...'
      },
      {
        id: 'back-in-stock',
        name: 'Back in Stock',
        subject: '🙌 {productName} is Back in Stock!',
        preview: 'The item you wanted is available again...'
      },
      {
        id: 'abandoned-cart',
        name: 'Abandoned Cart Reminder',
        subject: '👋 You left something behind...',
        preview: 'Complete your purchase and get free shipping...'
      },
      {
        id: 'review-request',
        name: 'Review Request',
        subject: '⭐ How do you like your {productName}?',
        preview: 'Share your experience and help other fans...'
      }
    ];

    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({ message: error.message || 'Error fetching email templates' });
  }
});

/**
 * POST /api/marketing/send-campaign - Send an email campaign
 */
router.post('/send-campaign', authenticate, async (req: Request, res: Response) => {
  try {
    const clerkUserId = req.user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { campaignId, templateId, subject, content, recipients } = req.body;

    // In production, this would use Brevo/SendGrid to send emails
    // For now, simulate the send and update campaign stats
    
    res.json({
      success: true,
      message: 'Campaign queued for sending',
      stats: {
        totalRecipients: recipients?.length || 0,
        queued: recipients?.length || 0,
        estimatedDelivery: new Date(Date.now() + 3600000) // 1 hour from now
      }
    });
  } catch (error: any) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ message: error.message || 'Error sending campaign' });
  }
});

export default router;
