/**
 * Merch Marketing Hub API
 * 
 * Full marketing system for Boostify merch store:
 * - Contact management (CRUD, import CSV, tag management)
 * - Campaign creation & scheduling (email + social)
 * - Brevo email sending integration
 * - AI promotional content generation via FAL (nano-banana-2)
 * - Campaign analytics & tracking
 * 
 * Endpoints:
 *   CONTACTS:
 *     GET    /contacts              — List contacts (paginated, filterable)
 *     POST   /contacts              — Add single contact
 *     POST   /contacts/import       — Bulk import contacts (JSON array)
 *     PATCH  /contacts/:id          — Update contact
 *     DELETE /contacts/:id          — Remove contact
 *     GET    /contacts/stats        — Contact database stats
 *     POST   /contacts/tag          — Bulk add tag to contacts
 * 
 *   CAMPAIGNS:
 *     GET    /campaigns             — List campaigns
 *     POST   /campaigns             — Create campaign
 *     GET    /campaigns/:id         — Get campaign details + stats
 *     PATCH  /campaigns/:id         — Update campaign
 *     POST   /campaigns/:id/send    — Send/execute campaign
 *     POST   /campaigns/:id/pause   — Pause active campaign
 * 
 *   AI CONTENT:
 *     POST   /ai/promo-image        — Generate promotional product image with FAL
 *     POST   /ai/email-content      — Generate email HTML content with AI
 *     POST   /ai/social-content     — Generate social media post content
 * 
 *   ANALYTICS:
 *     GET    /analytics/overview    — Campaign performance overview
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { marketingContacts, marketingCampaigns, marketingEmailLog } from '../db/schema';
import { desc, eq, gte, lte, sql, count, sum, ilike, inArray, and, or } from 'drizzle-orm';
import { buildImageMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';

const router = Router();

// Brevo config
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// ══════════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════════

// GET /contacts — List with pagination, search, filters
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const source = req.query.source as string;
    const tag = req.query.tag as string;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(marketingContacts.email, `%${search}%`),
          ilike(marketingContacts.name, `%${search}%`)
        )
      );
    }
    if (status) conditions.push(eq(marketingContacts.status, status as any));
    if (source) conditions.push(eq(marketingContacts.source, source as any));
    if (tag) conditions.push(sql`${marketingContacts.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [contacts, totalResult] = await Promise.all([
      db.select().from(marketingContacts)
        .where(where)
        .orderBy(desc(marketingContacts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(marketingContacts).where(where),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    res.json({
      contacts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('❌ Error listing contacts:', error);
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

// POST /contacts — Add single contact
router.post('/contacts', async (req: Request, res: Response) => {
  try {
    const { email, name, source, tags, metadata } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check duplicate
    const existing = await db.select({ id: marketingContacts.id })
      .from(marketingContacts)
      .where(eq(marketingContacts.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Contact already exists', contactId: existing[0].id });
    }

    const [contact] = await db.insert(marketingContacts).values({
      email: email.toLowerCase().trim(),
      name: name || null,
      source: source || 'manual',
      tags: tags || [],
      metadata: metadata || null,
    }).returning();

    res.status(201).json(contact);
  } catch (error) {
    console.error('❌ Error adding contact:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// POST /contacts/import — Bulk import contacts
router.post('/contacts/import', async (req: Request, res: Response) => {
  try {
    const { contacts: importList } = req.body;
    if (!Array.isArray(importList) || importList.length === 0) {
      return res.status(400).json({ error: 'Provide an array of contacts' });
    }
    if (importList.length > 5000) {
      return res.status(400).json({ error: 'Maximum 5000 contacts per import' });
    }

    // Get existing emails to avoid duplicates
    const emails = importList
      .map((c: any) => (c.email || '').toLowerCase().trim())
      .filter((e: string) => e.includes('@'));

    const existing = await db.select({ email: marketingContacts.email })
      .from(marketingContacts)
      .where(inArray(marketingContacts.email, emails));
    
    const existingSet = new Set(existing.map(e => e.email));

    const toInsert = [];
    let skipped = 0;
    for (const c of importList) {
      const email = (c.email || '').toLowerCase().trim();
      if (!email.includes('@') || existingSet.has(email)) {
        skipped++;
        continue;
      }
      existingSet.add(email); // prevent duplicates within the batch
      toInsert.push({
        email,
        name: c.name || null,
        source: 'import' as const,
        tags: c.tags || [],
        metadata: c.metadata || null,
      });
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      // Insert in chunks of 500
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500);
        await db.insert(marketingContacts).values(chunk);
        inserted += chunk.length;
      }
    }

    res.json({ imported: inserted, skipped, total: importList.length });
  } catch (error) {
    console.error('❌ Error importing contacts:', error);
    res.status(500).json({ error: 'Failed to import contacts' });
  }
});

// PATCH /contacts/:id — Update contact
router.patch('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, tags, status, metadata } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (tags !== undefined) updates.tags = tags;
    if (status !== undefined) updates.status = status;
    if (metadata !== undefined) updates.metadata = metadata;

    const [updated] = await db.update(marketingContacts)
      .set(updates)
      .where(eq(marketingContacts.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Contact not found' });
    res.json(updated);
  } catch (error) {
    console.error('❌ Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// DELETE /contacts/:id
router.delete('/contacts/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [deleted] = await db.delete(marketingContacts)
      .where(eq(marketingContacts.id, id))
      .returning();
    if (!deleted) return res.status(404).json({ error: 'Contact not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// GET /contacts/stats — Contact stats
router.get('/contacts/stats', async (_req: Request, res: Response) => {
  try {
    const [totals] = await db.select({
      total: count(),
      totalSpent: sum(marketingContacts.totalSpent),
    }).from(marketingContacts);

    const byStatus = await db.select({
      status: marketingContacts.status,
      count: count(),
    }).from(marketingContacts).groupBy(marketingContacts.status);

    const bySource = await db.select({
      source: marketingContacts.source,
      count: count(),
    }).from(marketingContacts).groupBy(marketingContacts.source);

    // All unique tags
    const tagsResult = await db.select({ tags: marketingContacts.tags })
      .from(marketingContacts)
      .where(sql`jsonb_array_length(${marketingContacts.tags}::jsonb) > 0`);
    
    const tagCounts: Record<string, number> = {};
    for (const row of tagsResult) {
      for (const tag of (row.tags as string[] || [])) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    res.json({
      total: Number(totals?.total || 0),
      totalSpent: parseFloat(String(totals?.totalSpent || '0')),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, Number(s.count)])),
      bySource: Object.fromEntries(bySource.map(s => [s.source, Number(s.count)])),
      tags: tagCounts,
    });
  } catch (error) {
    console.error('❌ Error fetching contact stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /contacts/tag — Bulk tag contacts
router.post('/contacts/tag', async (req: Request, res: Response) => {
  try {
    const { contactIds, tag, action } = req.body;
    if (!Array.isArray(contactIds) || !tag) {
      return res.status(400).json({ error: 'contactIds array and tag required' });
    }

    if (action === 'remove') {
      // Remove tag from contacts
      await db.execute(sql`
        UPDATE marketing_contacts 
        SET tags = tags::jsonb - ${tag}, updated_at = NOW()
        WHERE id = ANY(${contactIds})
      `);
    } else {
      // Add tag to contacts that don't already have it
      await db.execute(sql`
        UPDATE marketing_contacts
        SET tags = CASE 
          WHEN NOT (tags::jsonb @> ${JSON.stringify([tag])}::jsonb) 
          THEN tags::jsonb || ${JSON.stringify([tag])}::jsonb
          ELSE tags::jsonb
        END,
        updated_at = NOW()
        WHERE id = ANY(${contactIds})
      `);
    }

    res.json({ success: true, affected: contactIds.length });
  } catch (error) {
    console.error('❌ Error bulk tagging:', error);
    res.status(500).json({ error: 'Failed to tag contacts' });
  }
});

// ══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════════════════════

// GET /campaigns — List all campaigns
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const type = req.query.type as string;

    const conditions = [];
    if (status) conditions.push(eq(marketingCampaigns.status, status as any));
    if (type) conditions.push(eq(marketingCampaigns.type, type as any));

    const campaigns = await db.select()
      .from(marketingCampaigns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(marketingCampaigns.createdAt));

    res.json(campaigns);
  } catch (error) {
    console.error('❌ Error listing campaigns:', error);
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

// POST /campaigns — Create campaign
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    const {
      name, description, type, subject, previewText, htmlContent,
      senderName, senderEmail, targetTags, targetSegment,
      socialPlatforms, socialContent, socialImageUrl,
      productIds, discountCode, discountPercent,
      scheduledAt, aiGeneratedImage, aiPromptUsed,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    const [campaign] = await db.insert(marketingCampaigns).values({
      name,
      description: description || null,
      type,
      subject: subject || null,
      previewText: previewText || null,
      htmlContent: htmlContent || null,
      senderName: senderName || 'Boostify Music',
      senderEmail: senderEmail || 'marketing@boostifymusic.com',
      targetTags: targetTags || null,
      targetSegment: targetSegment || 'all',
      socialPlatforms: socialPlatforms || null,
      socialContent: socialContent || null,
      socialImageUrl: socialImageUrl || null,
      productIds: productIds || null,
      discountCode: discountCode || null,
      discountPercent: discountPercent || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      aiGeneratedImage: aiGeneratedImage || null,
      aiPromptUsed: aiPromptUsed || null,
    }).returning();

    res.status(201).json(campaign);
  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// GET /campaigns/:id — Campaign details with email stats
router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db.select().from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id));
    
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Email log stats
    const logStats = await db.select({
      status: marketingEmailLog.status,
      count: count(),
    })
      .from(marketingEmailLog)
      .where(eq(marketingEmailLog.campaignId, id))
      .groupBy(marketingEmailLog.status);

    res.json({
      ...campaign,
      emailStats: Object.fromEntries(logStats.map(s => [s.status, Number(s.count)])),
    });
  } catch (error) {
    console.error('❌ Error fetching campaign:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// PATCH /campaigns/:id — Update campaign
router.patch('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = { ...req.body, updatedAt: new Date() };
    // Prevent changing id/createdAt
    delete updates.id;
    delete updates.createdAt;

    const [updated] = await db.update(marketingCampaigns)
      .set(updates)
      .where(eq(marketingCampaigns.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Campaign not found' });
    res.json(updated);
  } catch (error) {
    console.error('❌ Error updating campaign:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// POST /campaigns/:id/send — Execute email campaign via Brevo
router.post('/campaigns/:id/send', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db.select().from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id));

    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!campaign.subject || !campaign.htmlContent) {
      return res.status(400).json({ error: 'Campaign needs subject and htmlContent before sending' });
    }
    if (campaign.status === 'sent' || campaign.status === 'sending') {
      return res.status(400).json({ error: 'Campaign already sent or in progress' });
    }

    if (!BREVO_API_KEY) {
      return res.status(500).json({ error: 'Brevo API key not configured' });
    }

    // Build recipient list based on segment + tags
    const conditions = [eq(marketingContacts.status, 'active')];
    if (campaign.targetSegment === 'active_buyers') {
      conditions.push(sql`${marketingContacts.totalPurchases} > 0`);
    } else if (campaign.targetSegment === 'vip') {
      conditions.push(sql`CAST(${marketingContacts.totalSpent} AS numeric) > 100`);
    } else if (campaign.targetSegment === 'inactive') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      conditions.push(
        or(
          sql`${marketingContacts.lastEmailedAt} IS NULL`,
          lte(marketingContacts.lastEmailedAt, ninetyDaysAgo)
        )!
      );
    }
    if (campaign.targetTags && (campaign.targetTags as string[]).length > 0) {
      for (const tag of campaign.targetTags as string[]) {
        conditions.push(sql`${marketingContacts.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`);
      }
    }

    const recipients = await db.select({
      id: marketingContacts.id,
      email: marketingContacts.email,
      name: marketingContacts.name,
    })
      .from(marketingContacts)
      .where(and(...conditions))
      .limit(5000);

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients match the campaign targeting' });
    }

    // Mark campaign as sending
    await db.update(marketingCampaigns).set({
      status: 'sending',
      totalRecipients: recipients.length,
      sentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(marketingCampaigns.id, id));

    // Send emails in batches (non-blocking — respond immediately)
    res.json({ 
      success: true, 
      message: `Sending to ${recipients.length} recipients...`,
      totalRecipients: recipients.length,
    });

    // Background send process
    let sentCount = 0;
    let failCount = 0;
    let bouncedCount = 0;

    for (const recipient of recipients) {
      try {
        // Personalize HTML
        const personalizedHtml = campaign.htmlContent!
          .replace(/\{\{name\}\}/g, recipient.name || 'Friend')
          .replace(/\{\{email\}\}/g, recipient.email);

        const brevoPayload = {
          sender: { name: campaign.senderName, email: campaign.senderEmail },
          to: [{ email: recipient.email, name: recipient.name || undefined }],
          subject: campaign.subject!.replace(/\{\{name\}\}/g, recipient.name || 'Friend'),
          htmlContent: personalizedHtml,
          headers: { 'X-Campaign-Id': String(id) },
        };

        const response = await fetch(BREVO_API_URL, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': BREVO_API_KEY,
          },
          body: JSON.stringify(brevoPayload),
        });

        const data = await response.json() as any;

        // Log the send
        await db.insert(marketingEmailLog).values({
          campaignId: id,
          contactId: recipient.id,
          toEmail: recipient.email,
          brevoMessageId: data.messageId || null,
          status: response.ok ? 'sent' : 'failed',
          errorMessage: response.ok ? null : (data.message || 'Send failed'),
          sentAt: response.ok ? new Date() : null,
        });

        // Update contact stats
        if (response.ok) {
          sentCount++;
          await db.update(marketingContacts).set({
            lastEmailedAt: new Date(),
            totalEmailsSent: sql`${marketingContacts.totalEmailsSent} + 1`,
          }).where(eq(marketingContacts.id, recipient.id));
        } else {
          failCount++;
        }

        // Small delay between sends to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        failCount++;
        console.error(`Failed to send to ${recipient.email}:`, err);
      }
    }

    // Update campaign final stats
    await db.update(marketingCampaigns).set({
      status: 'sent',
      emailsSent: sentCount,
      emailsBounced: bouncedCount,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(marketingCampaigns.id, id));

    console.log(`✅ Campaign #${id} completed: ${sentCount} sent, ${failCount} failed`);
  } catch (error) {
    console.error('❌ Error sending campaign:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to send campaign' });
    }
  }
});

// POST /campaigns/:id/pause — Pause campaign
router.post('/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [updated] = await db.update(marketingCampaigns).set({
      status: 'paused',
      updatedAt: new Date(),
    }).where(eq(marketingCampaigns.id, id)).returning();

    if (!updated) return res.status(404).json({ error: 'Campaign not found' });
    res.json(updated);
  } catch (error) {
    console.error('❌ Error pausing campaign:', error);
    res.status(500).json({ error: 'Failed to pause campaign' });
  }
});

// ══════════════════════════════════════════════════════════════
// AI CONTENT GENERATION
// ══════════════════════════════════════════════════════════════

// POST /ai/promo-image — Generate promotional product image via FAL nano-banana-2
router.post('/ai/promo-image', async (req: Request, res: Response) => {
  try {
    const { productName, productCategory, artistName, style, customPrompt } = req.body;
    
    if (!productName) {
      return res.status(400).json({ error: 'productName is required' });
    }

    const FAL_API_KEY = process.env.FAL_API_KEY;
    if (!FAL_API_KEY) {
      return res.status(500).json({ error: 'FAL API key not configured' });
    }

    // Build promotional prompt
    const styleGuide = style || 'modern, vibrant, commercial photography style';
    const ctx: ArtistContext = { artistName: artistName || '', genre: null, mood: null };
    const basePrompt = customPrompt || buildPromoPrompt(productName, productCategory, artistName, styleGuide);
    const masterpieceBlock = buildImageMasterpieceRules(ctx, 'merch-product');
    const prompt = `${basePrompt}\n\n${masterpieceBlock}`;

    const response = await fetch('https://fal.run/fal-ai/nano-banana-2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: { width: 1024, height: 1024 },
        num_images: 1,
        guidance_scale: 7.5,
        num_inference_steps: 30,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('FAL API error:', error);
      return res.status(502).json({ error: 'Image generation failed' });
    }

    const data = await response.json() as any;
    const imageUrl = data.images?.[0]?.url || data.image?.url;

    if (!imageUrl) {
      return res.status(502).json({ error: 'No image returned' });
    }

    res.json({
      imageUrl,
      prompt,
      model: 'nano-banana-2',
    });
  } catch (error) {
    console.error('❌ Error generating promo image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// POST /ai/email-content — Generate email HTML with AI
router.post('/ai/email-content', async (req: Request, res: Response) => {
  try {
    const { campaignType, products, discountPercent, artistName, tone } = req.body;

    const productList = (products || []).map((p: any) =>
      `• ${p.name} — $${p.price}`
    ).join('\n');

    const html = buildEmailTemplate({
      campaignType: campaignType || 'product_launch',
      productList,
      discountPercent,
      artistName: artistName || 'Boostify Artist',
      tone: tone || 'professional',
    });

    res.json({
      htmlContent: html,
      subject: generateSubjectLine(campaignType, artistName, discountPercent),
      previewText: generatePreviewText(campaignType, discountPercent),
    });
  } catch (error) {
    console.error('❌ Error generating email content:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// POST /ai/social-content — Generate social media post
router.post('/ai/social-content', async (req: Request, res: Response) => {
  try {
    const { platform, products, artistName, campaignGoal, tone } = req.body;

    const post = generateSocialPost({
      platform: platform || 'instagram',
      products: products || [],
      artistName: artistName || 'Boostify Artist',
      campaignGoal: campaignGoal || 'product_launch',
      tone: tone || 'energetic',
    });

    res.json(post);
  } catch (error) {
    console.error('❌ Error generating social content:', error);
    res.status(500).json({ error: 'Failed to generate social content' });
  }
});

// ══════════════════════════════════════════════════════════════
// ANALYTICS
// ══════════════════════════════════════════════════════════════

// GET /analytics/overview — Campaign performance overview
router.get('/analytics/overview', async (_req: Request, res: Response) => {
  try {
    // Campaign totals
    const campaignStats = await db.select({
      totalCampaigns: count(),
      totalSent: sum(marketingCampaigns.emailsSent),
      totalDelivered: sum(marketingCampaigns.emailsDelivered),
      totalOpened: sum(marketingCampaigns.emailsOpened),
      totalClicked: sum(marketingCampaigns.emailsClicked),
      totalConversions: sum(marketingCampaigns.conversions),
      totalRevenue: sum(marketingCampaigns.revenue),
    }).from(marketingCampaigns);

    const byCampaignType = await db.select({
      type: marketingCampaigns.type,
      count: count(),
      totalRevenue: sum(marketingCampaigns.revenue),
    })
      .from(marketingCampaigns)
      .groupBy(marketingCampaigns.type);

    // Contact growth (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentContacts = await db.select({ count: count() })
      .from(marketingContacts)
      .where(gte(marketingContacts.createdAt, thirtyDaysAgo));

    const totalContacts = await db.select({ count: count() })
      .from(marketingContacts)
      .where(eq(marketingContacts.status, 'active'));

    const stats = campaignStats[0];
    const sent = Number(stats?.totalSent || 0);
    const opened = Number(stats?.totalOpened || 0);
    const clicked = Number(stats?.totalClicked || 0);

    res.json({
      campaigns: {
        total: Number(stats?.totalCampaigns || 0),
        totalSent: sent,
        totalDelivered: Number(stats?.totalDelivered || 0),
        totalOpened: opened,
        totalClicked: clicked,
        totalConversions: Number(stats?.totalConversions || 0),
        totalRevenue: parseFloat(String(stats?.totalRevenue || '0')),
        openRate: sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0',
        clickRate: opened > 0 ? ((clicked / opened) * 100).toFixed(1) : '0',
      },
      byType: byCampaignType.map(t => ({
        type: t.type,
        count: Number(t.count),
        revenue: parseFloat(String(t.totalRevenue || '0')),
      })),
      contacts: {
        total: Number(totalContacts[0]?.count || 0),
        newLast30Days: Number(recentContacts[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('❌ Error fetching marketing analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ══════════════════════════════════════════════════════════════
// HELPERS — Email template builder, prompt builders, etc.
// ══════════════════════════════════════════════════════════════

function buildPromoPrompt(productName: string, category?: string, artistName?: string, style?: string): string {
  const categoryHint = category ? `, ${category} product` : '';
  const artistHint = artistName ? ` for ${artistName} brand` : '';
  return `Professional product photography of a ${productName}${categoryHint}${artistHint}. ${style || 'Clean white background, studio lighting, commercial e-commerce style'}. High resolution, sharp details, appealing presentation for online store. No text or watermarks.`;
}

function buildEmailTemplate(opts: {
  campaignType: string;
  productList: string;
  discountPercent?: number;
  artistName: string;
  tone: string;
}): string {
  const { campaignType, productList, discountPercent, artistName } = opts;

  const discountBanner = discountPercent
    ? `<div style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 16px; border-radius: 12px; text-align: center; margin: 20px 0;">
        <p style="font-size: 28px; font-weight: bold; margin: 0;">${discountPercent}% OFF</p>
        <p style="margin: 4px 0 0; opacity: 0.9;">Limited time offer on all merchandise</p>
       </div>`
    : '';

  const headerTitle = campaignType === 'flash_sale' ? '⚡ Flash Sale!'
    : campaignType === 'product_launch' ? '🔥 New Drop!'
    : campaignType === 'email_promo' ? '🎁 Special Offer'
    : '🎵 From the Store';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;background:#171717;border-radius:16px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px 24px;text-align:center;">
      <img src="https://boostifymusic.com/logo.png" alt="Boostify" style="height:40px;margin-bottom:16px;" />
      <h1 style="color:#f97316;font-size:24px;margin:0;">${headerTitle}</h1>
      <p style="color:#a3a3a3;margin:8px 0 0;font-size:14px;">${artistName} Official Merchandise</p>
    </div>
    
    <!-- Body -->
    <div style="padding:24px;">
      ${discountBanner}
      
      <h2 style="color:#f5f5f5;font-size:18px;margin:24px 0 12px;">Featured Products</h2>
      <div style="background:#262626;border-radius:12px;padding:16px;margin-bottom:20px;">
        <pre style="font-family:inherit;white-space:pre-wrap;color:#d4d4d4;margin:0;font-size:14px;line-height:1.8;">${productList || '• Check out our latest collection!'}</pre>
      </div>
      
      <div style="text-align:center;margin:28px 0;">
        <a href="https://boostifymusic.com/store" style="display:inline-block;background:#f97316;color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:bold;font-size:16px;">Shop Now →</a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="padding:20px 24px;border-top:1px solid #333;text-align:center;">
      <p style="color:#737373;font-size:11px;margin:0;">
        You're receiving this because you subscribed to {{name}} updates.<br/>
        <a href="#" style="color:#737373;">Unsubscribe</a> · <a href="#" style="color:#737373;">Preferences</a>
      </p>
      <p style="color:#525252;font-size:10px;margin:8px 0 0;">© ${new Date().getFullYear()} Boostify Music. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

function generateSubjectLine(campaignType: string, artistName?: string, discountPercent?: number): string {
  const name = artistName || 'Boostify';
  if (discountPercent) return `🔥 ${discountPercent}% OFF — ${name} Merch Sale!`;
  switch (campaignType) {
    case 'flash_sale': return `⚡ Flash Sale — ${name} Merch, Limited Time!`;
    case 'product_launch': return `🚀 New Drop — ${name} Just Released New Merch!`;
    case 'email_promo': return `🎁 Exclusive Offer from ${name}`;
    default: return `${name} — New from the Official Store`;
  }
}

function generatePreviewText(campaignType: string, discountPercent?: number): string {
  if (discountPercent) return `Save ${discountPercent}% on all merchandise. Limited time only.`;
  switch (campaignType) {
    case 'flash_sale': return 'Hurry! This deal won\'t last long.';
    case 'product_launch': return 'Be the first to cop the latest drop.';
    default: return 'Check out what\'s new in the official store.';
  }
}

function generateSocialPost(opts: {
  platform: string;
  products: any[];
  artistName: string;
  campaignGoal: string;
  tone: string;
}): { content: string; hashtags: string[]; platform: string } {
  const { platform, products, artistName, campaignGoal, tone } = opts;
  const productMentions = products.slice(0, 3).map((p: any) => p.name || 'New Product').join(', ');

  const hashtags = [
    `#${artistName.replace(/\s/g, '')}Merch`,
    '#BoostifyMusic', '#OfficialMerch', '#NewDrop',
    ...(campaignGoal === 'flash_sale' ? ['#FlashSale', '#LimitedOffer'] : []),
    ...(platform === 'instagram' ? ['#ShopNow', '#MerchDrop'] : []),
    ...(platform === 'tiktok' ? ['#MerchTok', '#SmallBusiness'] : []),
  ];

  let content = '';
  if (campaignGoal === 'flash_sale') {
    content = `⚡ FLASH SALE ⚡\n\n${productMentions} — now available at a special price!\n\n🛍️ Shop now at boostifymusic.com/store\n\nDon't miss out — this deal won't last! 🔥`;
  } else if (campaignGoal === 'product_launch') {
    content = `🚀 NEW DROP 🚀\n\n${artistName} just dropped new merch!\n\n🔥 ${productMentions}\n\n🛒 Available now → boostifymusic.com/store\n\nLink in bio! 🎵`;
  } else {
    content = `🎵 ${artistName} Official Merch\n\nRep your favorite artist! 🔥\n\n${productMentions}\n\n🛍️ Shop → boostifymusic.com/store`;
  }

  return { content, hashtags, platform };
}

export default router;
