/**
 * Sponsor API Routes
 * Full CRUD + search + campaign management + deal pipeline for sponsor acquisition.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  sponsorContacts, sponsorCampaigns, sponsorDeals, sponsorEmailLog,
  users, subscriptions,
  type InsertSponsorContact, type InsertSponsorCampaign, type InsertSponsorDeal,
} from '../db/schema';
import { eq, and, desc, ilike, inArray, sql, count, gte } from 'drizzle-orm';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { rateLimitEmailSend, rateLimitAiGen, rateLimitProposal } from '../middleware/rate-limit';
import { apifySponsorScraper, generateDedupeHash, type ScrapedBrand } from '../services/apify-sponsor-scraper';
import {
  generateProposalHtml,
  generateProposalSubject,
  sendSponsorProposal,
  sendFollowUp,
  generateSubjectVariants,
} from '../services/sponsor-email-service';
import { createSponsorInvoice, getDealPaymentStatus } from '../services/sponsor-payment-service';
import { createNotification } from '../utils/notifications';
import { processFollowUps } from '../services/sponsor-followup-scheduler';
import { generateAIProposal } from '../services/ai-proposal-generator';
import { enrichContact, bulkEnrichContacts, isEnrichmentConfigured } from '../services/contact-enrichment-service';

const router = Router();
const PLATFORM_URL = process.env.SPONSOR_PROPOSAL_BASE_URL || 'https://boostifymusic.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserPgId(clerkId: string): Promise<number | null> {
  const user = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user[0]?.id || null;
}

async function getArtistData(artistId: number) {
  const artist = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  if (!artist[0]) return null;
  const a = artist[0];
  return {
    name: a.artistName || a.username || 'Artist',
    genre: a.genre || a.genres?.[0] || 'Music',
    biography: a.biography || '',
    profileImage: a.profileImage || a.profileImageUrl || '',
    slug: a.slug || String(a.id),
    instagramFollowers: undefined as number | undefined,
    spotifyListeners: undefined as number | undefined,
    youtubeViews: undefined as number | undefined,
    totalSongs: undefined as number | undefined,
  };
}

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

/**
 * GET /api/sponsors/contacts — List sponsor contacts with filters
 */
router.get('/contacts', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { industry, status, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

    let query = db.select().from(sponsorContacts).where(eq(sponsorContacts.addedByUserId, userId));

    // Count
    const totalResult = await db.select({ count: count() }).from(sponsorContacts)
      .where(eq(sponsorContacts.addedByUserId, userId));
    const total = totalResult[0]?.count || 0;

    const contacts = await db.select().from(sponsorContacts)
      .where(eq(sponsorContacts.addedByUserId, userId))
      .orderBy(desc(sponsorContacts.createdAt))
      .limit(limitNum)
      .offset((pageNum - 1) * limitNum);

    res.json({ success: true, contacts, total, page: pageNum, limit: limitNum });
  } catch (error: any) {
    console.error('❌ Error listing sponsor contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/contacts — Add contact manually
 */
router.post('/contacts', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { brandName, contactName, contactEmail, contactRole, website, instagramHandle, industry } = req.body;
    if (!brandName) return res.status(400).json({ error: 'brandName is required' });

    const hash = generateDedupeHash(contactEmail, brandName);
    const existing = await db.select({ id: sponsorContacts.id }).from(sponsorContacts)
      .where(eq(sponsorContacts.dedupeHash, hash)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: 'Contact already exists', existingId: existing[0].id });

    const [contact] = await db.insert(sponsorContacts).values({
      brandName,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      contactRole: contactRole || null,
      website: website || null,
      instagramHandle: instagramHandle || null,
      industry: industry || 'other',
      dedupeHash: hash,
      importSource: 'manual',
      addedByUserId: userId,
      status: 'new',
    }).returning();

    res.json({ success: true, contact });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/sponsors/contacts/:id
 */
router.delete('/contacts/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const contactId = parseInt(req.params.id);
    await db.delete(sponsorContacts).where(
      and(eq(sponsorContacts.id, contactId), eq(sponsorContacts.addedByUserId, userId))
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── APIFY SEARCH ─────────────────────────────────────────────────────────────

/**
 * POST /api/sponsors/search — Search for sponsors via Apify
 */
router.post('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // ── Rate limiting: check sponsorSearchLimit vs sponsorSearchUsed ──
    const sub = await db.select({
      limit: subscriptions.sponsorSearchLimit,
      used: subscriptions.sponsorSearchUsed,
    }).from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const searchLimit = sub[0]?.limit ?? 0;
    const searchUsed = sub[0]?.used ?? 0;

    // Admin bypass (limit >= 999) — normal users are gated
    if (searchLimit < 999 && searchUsed >= searchLimit) {
      return res.status(429).json({
        error: 'Search limit reached',
        message: `You have used ${searchUsed}/${searchLimit} searches. Upgrade your plan for more.`,
        limit: searchLimit,
        used: searchUsed,
      });
    }

    const { source, query: searchQuery, niche, instagramUsername, websiteUrl, limit = 15 } = req.body;

    let results: ScrapedBrand[] = [];

    switch (source) {
      case 'instagram':
        results = await apifySponsorScraper.searchBrandsByNiche(niche || searchQuery, limit);
        break;
      case 'google':
        results = await apifySponsorScraper.searchSponsorsOnGoogle(searchQuery || niche, limit);
        break;
      case 'instagram_profile':
        if (instagramUsername) {
          const brand = await apifySponsorScraper.scrapeBrandInstagram(instagramUsername);
          if (brand) results = [brand];
        }
        break;
      case 'website':
        if (websiteUrl) {
          const enriched = await apifySponsorScraper.enrichContactFromWebsite(websiteUrl);
          if (enriched.contactEmail || enriched.description) {
            results = [{ brandName: new URL(websiteUrl).hostname.replace('www.', ''), ...enriched } as ScrapedBrand];
          }
        }
        break;
      default:
        // Default: search Instagram
        results = await apifySponsorScraper.searchBrandsByNiche(searchQuery || niche || '', limit);
    }

    // Auto-save results to database
    const saveResult = await apifySponsorScraper.saveContacts(
      results,
      userId,
      source === 'google' ? 'apify_google' : source === 'website' ? 'apify_web' : 'apify_instagram'
    );

    // Increment search usage counter
    if (sub[0]) {
      await db.update(subscriptions).set({
        sponsorSearchUsed: searchUsed + 1,
        updatedAt: new Date(),
      }).where(eq(subscriptions.userId, userId));
    }

    res.json({
      success: true,
      results,
      saved: saveResult.saved,
      duplicates: saveResult.duplicates,
      errors: saveResult.errors,
      searchesRemaining: searchLimit >= 999 ? 'unlimited' : Math.max(0, searchLimit - searchUsed - 1),
    });
  } catch (error: any) {
    console.error('❌ Sponsor search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/contacts/import-csv — Bulk import from CSV data
 */
router.post('/contacts/import-csv', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { contacts: rawContacts } = req.body;
    if (!Array.isArray(rawContacts)) return res.status(400).json({ error: 'contacts must be an array' });

    const brands: ScrapedBrand[] = rawContacts.map((c: any) => ({
      brandName: c.brandName || c.company || c.name || 'Unknown',
      contactName: c.contactName || c.contact || undefined,
      contactEmail: c.contactEmail || c.email || undefined,
      contactRole: c.contactRole || c.role || undefined,
      website: c.website || c.url || undefined,
      instagramHandle: c.instagram || c.instagramHandle || undefined,
      industry: c.industry || undefined,
    }));

    const saveResult = await apifySponsorScraper.saveContacts(brands, userId, 'csv_import');
    res.json({ success: true, ...saveResult });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── CONTACT ENRICHMENT ───────────────────────────────────────────────────────

/**
 * POST /api/sponsors/contacts/:id/enrich — Enrich a single contact via Hunter.io
 */
router.post('/contacts/:id/enrich', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    if (!isEnrichmentConfigured()) {
      return res.status(503).json({ error: 'Email enrichment is not configured (HUNTER_API_KEY required)' });
    }

    const contactId = parseInt(req.params.id);
    const result = await enrichContact(contactId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/contacts/bulk-enrich — Enrich all contacts missing emails
 */
router.post('/contacts/bulk-enrich', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    if (!isEnrichmentConfigured()) {
      return res.status(503).json({ error: 'Email enrichment is not configured (HUNTER_API_KEY required)' });
    }

    const result = await bulkEnrichContacts(userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── CAMPAIGNS ────────────────────────────────────────────────────────────────

/**
 * GET /api/sponsors/campaigns — List campaigns for current user
 */
router.get('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const campaigns = await db.select().from(sponsorCampaigns)
      .where(eq(sponsorCampaigns.userId, userId))
      .orderBy(desc(sponsorCampaigns.createdAt));

    res.json({ success: true, campaigns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/campaigns — Create a new campaign
 */
router.post('/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { artistId, name, dealType, budgetMin, budgetMax, targetIndustries, dailyLimit, customMessage } = req.body;
    if (!artistId || !name || !dealType) return res.status(400).json({ error: 'artistId, name, dealType required' });

    // Generate proposal HTML
    const artist = await getArtistData(parseInt(artistId));
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const proposalData = {
      artist,
      brandName: '{{brand_name}}', // Placeholder — replaced per-contact
      dealType,
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      customMessage,
    };

    const proposalHtml = generateProposalHtml(proposalData);
    const proposalSubject = generateProposalSubject(proposalData);

    const [campaign] = await db.insert(sponsorCampaigns).values({
      userId,
      artistId: parseInt(artistId),
      name,
      dealType,
      proposalHtml,
      proposalSubject,
      budgetMin: budgetMin || null,
      budgetMax: budgetMax || null,
      targetIndustries: targetIndustries || [],
      dailyLimit: dailyLimit || 10,
      status: 'draft',
    }).returning();

    res.json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sponsors/campaigns/:id — Campaign detail with stats
 */
router.get('/campaigns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const campaign = await db.select().from(sponsorCampaigns)
      .where(and(eq(sponsorCampaigns.id, parseInt(req.params.id)), eq(sponsorCampaigns.userId, userId)))
      .limit(1);

    if (!campaign[0]) return res.status(404).json({ error: 'Campaign not found' });

    // Get email stats
    const emails = await db.select().from(sponsorEmailLog)
      .where(eq(sponsorEmailLog.campaignId, campaign[0].id));

    // Get deals created from this campaign
    const deals = await db.select().from(sponsorDeals)
      .where(eq(sponsorDeals.campaignId, campaign[0].id));

    res.json({ success: true, campaign: campaign[0], emails, deals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/campaigns/:id/send — Send proposal emails to selected contacts
 */
router.post('/campaigns/:id/send', authenticate, rateLimitEmailSend, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const campaignId = parseInt(req.params.id);
    const { contactIds } = req.body; // Array of contact IDs to send to

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: 'contactIds array required' });
    }

    const campaign = await db.select().from(sponsorCampaigns)
      .where(and(eq(sponsorCampaigns.id, campaignId), eq(sponsorCampaigns.userId, userId)))
      .limit(1);
    if (!campaign[0]) return res.status(404).json({ error: 'Campaign not found' });

    const artist = await getArtistData(campaign[0].artistId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    // Load contacts
    const contacts = await db.select().from(sponsorContacts)
      .where(and(
        inArray(sponsorContacts.id, contactIds.map(Number)),
        eq(sponsorContacts.addedByUserId, userId)
      ));

    let sent = 0, failed = 0;

    for (const contact of contacts) {
      if (!contact.contactEmail) { failed++; continue; }

      // Generate personalized proposal
      const proposalData = {
        artist,
        brandName: contact.brandName,
        contactName: contact.contactName || undefined,
        dealType: campaign[0].dealType as any,
        budgetMin: campaign[0].budgetMin ? parseFloat(campaign[0].budgetMin) : undefined,
        budgetMax: campaign[0].budgetMax ? parseFloat(campaign[0].budgetMax) : undefined,
      };

      // Create a deal for this contact
      const [deal] = await db.insert(sponsorDeals).values({
        campaignId,
        sponsorContactId: contact.id,
        artistId: campaign[0].artistId,
        userId,
        dealType: campaign[0].dealType as any,
        title: `${artist.name} x ${contact.brandName} — ${campaign[0].name}`,
        proposedAmount: campaign[0].budgetMin || null,
        status: 'proposed',
      }).returning();

      // Generate HTML with deal ID for tracking
      const html = generateProposalHtml({ ...proposalData, dealId: deal.id });
      const subject = generateProposalSubject(proposalData);

      const result = await sendSponsorProposal({
        campaignId,
        dealId: deal.id,
        sponsorContactId: contact.id,
        toEmail: contact.contactEmail,
        toName: contact.contactName || undefined,
        subject,
        htmlContent: html,
        emailType: 'proposal',
      });

      if (result.success) {
        sent++;
        await db.update(sponsorDeals).set({ proposalSentAt: new Date() }).where(eq(sponsorDeals.id, deal.id));
      } else {
        failed++;
      }
    }

    // Update campaign stats
    await db.update(sponsorCampaigns).set({
      emailsSent: (campaign[0].emailsSent || 0) + sent,
      totalContacts: (campaign[0].totalContacts || 0) + contacts.length,
      status: 'sending',
      startedAt: campaign[0].startedAt || new Date(),
      updatedAt: new Date(),
    }).where(eq(sponsorCampaigns.id, campaignId));

    res.json({ success: true, sent, failed, total: contacts.length });
  } catch (error: any) {
    console.error('❌ Campaign send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DEALS ────────────────────────────────────────────────────────────────────

/**
 * GET /api/sponsors/deals — List all deals for current user
 */
router.get('/deals', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { status } = req.query;
    const deals = await db.select({
      deal: sponsorDeals,
      contact: sponsorContacts,
    })
      .from(sponsorDeals)
      .leftJoin(sponsorContacts, eq(sponsorDeals.sponsorContactId, sponsorContacts.id))
      .where(eq(sponsorDeals.userId, userId))
      .orderBy(desc(sponsorDeals.createdAt));

    res.json({ success: true, deals });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sponsors/deals/export.csv — CSV export of all deals for current user
 */
router.get('/deals/export.csv', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const rows = await db.select({
      deal: sponsorDeals,
      contact: sponsorContacts,
    })
      .from(sponsorDeals)
      .leftJoin(sponsorContacts, eq(sponsorDeals.sponsorContactId, sponsorContacts.id))
      .where(eq(sponsorDeals.userId, userId))
      .orderBy(desc(sponsorDeals.createdAt));

    const headers = [
      'deal_id', 'created_at', 'updated_at', 'status',
      'brand_name', 'contact_name', 'contact_email',
      'proposed_amount', 'agreed_amount', 'currency', 'notes',
    ];
    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push([
        r.deal.id,
        r.deal.createdAt?.toISOString?.() || '',
        r.deal.updatedAt?.toISOString?.() || '',
        r.deal.status,
        r.contact?.brandName || '',
        r.contact?.contactName || '',
        r.contact?.contactEmail || '',
        r.deal.proposedAmount || '',
        r.deal.agreedAmount || '',
        r.deal.currency || 'USD',
        r.deal.notes || '',
      ].map(escape).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sponsor-deals-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error: any) {
    console.error('[Sponsor CSV export]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/sponsors/deals/:id — Update deal status/amount
 */
router.patch('/deals/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const dealId = parseInt(req.params.id);
    const { status, agreedAmount, notes } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (agreedAmount) updateData.agreedAmount = String(agreedAmount);
    if (notes !== undefined) updateData.notes = notes;

    await db.update(sponsorDeals).set(updateData)
      .where(and(eq(sponsorDeals.id, dealId), eq(sponsorDeals.userId, userId)));

    const updated = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);

    // Notify artist on important status changes
    if (status && ['active', 'completed'].includes(status)) {
      const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, updated[0]?.sponsorContactId)).limit(1);
      const brandName = contact[0]?.brandName || 'Sponsor';
      await createNotification({
        userId,
        type: status === 'active' ? 'SPONSOR_DEAL_ACTIVE' : 'SPONSOR_DEAL_COMPLETED',
        title: status === 'active' ? `🚀 Deal with ${brandName} is active!` : `🎉 Deal with ${brandName} completed!`,
        message: `"${updated[0]?.title}" is now ${status}.`,
        metadata: { dealId, brandName, status },
      });
    }

    res.json({ success: true, deal: updated[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/deals/:id/invoice — Generate Stripe payment link for the sponsor
 */
router.post('/deals/:id/invoice', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const dealId = parseInt(req.params.id);

    // Verify ownership
    const deal = await db.select().from(sponsorDeals)
      .where(and(eq(sponsorDeals.id, dealId), eq(sponsorDeals.userId, userId)))
      .limit(1);
    if (!deal[0]) return res.status(404).json({ error: 'Deal not found' });

    const result = await createSponsorInvoice(dealId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/deals/:id/follow-up — Send follow-up email
 */
router.post('/deals/:id/follow-up', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const dealId = parseInt(req.params.id);
    const { type = 'follow_up' } = req.body;

    const result = await sendFollowUp(dealId, type);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── BULK ACTIONS ─────────────────────────────────────────────────────────────

/**
 * POST /api/sponsors/deals/bulk/status — Update status of multiple deals at once
 */
router.post('/deals/bulk/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { dealIds, status } = req.body;
    if (!Array.isArray(dealIds) || dealIds.length === 0 || !status) {
      return res.status(400).json({ error: 'dealIds[] and status are required' });
    }

    const validStatuses = ['proposed', 'negotiating', 'accepted', 'payment_pending', 'active', 'completed', 'rejected', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    let updated = 0;
    for (const dealId of dealIds.map(Number)) {
      const result = await db.update(sponsorDeals).set({
        status,
        updatedAt: new Date(),
      }).where(and(eq(sponsorDeals.id, dealId), eq(sponsorDeals.userId, userId)));
      updated++;
    }

    res.json({ success: true, updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/deals/bulk/follow-up — Send follow-up to multiple deals
 */
router.post('/deals/bulk/follow-up', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { dealIds } = req.body;
    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({ error: 'dealIds[] is required' });
    }

    let sent = 0, failed = 0;
    for (const dealId of dealIds.map(Number)) {
      // Verify ownership
      const deal = await db.select().from(sponsorDeals)
        .where(and(eq(sponsorDeals.id, dealId), eq(sponsorDeals.userId, userId)))
        .limit(1);
      if (!deal[0]) { failed++; continue; }

      const result = await sendFollowUp(dealId, 'follow_up');
      if (result.success) sent++;
      else failed++;
    }

    res.json({ success: true, sent, failed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── PROPOSAL PREVIEW ─────────────────────────────────────────────────────────

/**
 * POST /api/sponsors/generate-proposal — Generate proposal HTML preview (no send)
 */
router.post('/generate-proposal', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, brandName, dealType, budgetMin, budgetMax, customMessage } = req.body;
    if (!artistId || !brandName || !dealType) return res.status(400).json({ error: 'artistId, brandName, dealType required' });

    const artist = await getArtistData(parseInt(artistId));
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const html = generateProposalHtml({
      artist,
      brandName,
      dealType,
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      customMessage,
    });

    const subject = generateProposalSubject({ artist, brandName, dealType });

    res.json({ success: true, html, subject });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sponsors/generate-ai-proposal — Generate AI-personalized proposal copy
 */
router.post('/generate-ai-proposal', authenticate, rateLimitAiGen, async (req: Request, res: Response) => {
  try {
    const { artistId, brandName, brandIndustry, brandDescription, dealType, budgetMin, budgetMax } = req.body;
    if (!artistId || !brandName || !dealType) return res.status(400).json({ error: 'artistId, brandName, dealType required' });

    const artist = await getArtistData(parseInt(artistId));
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const aiResult = await generateAIProposal({
      artistName: artist.name,
      artistGenre: artist.genre,
      artistBio: artist.biography,
      instagramFollowers: artist.instagramFollowers,
      spotifyListeners: artist.spotifyListeners,
      brandName,
      brandIndustry,
      brandDescription,
      dealType,
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
    });

    // Generate full HTML with AI copy
    const html = generateProposalHtml({
      artist,
      brandName,
      dealType,
      budgetMin: budgetMin ? parseFloat(budgetMin) : undefined,
      budgetMax: budgetMax ? parseFloat(budgetMax) : undefined,
      customMessage: aiResult.customMessage,
    });

    res.json({
      success: true,
      ai: aiResult,
      html,
      subject: aiResult.subjectLine,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── EMAIL TRACKING ───────────────────────────────────────────────────────────

/** GET /api/sponsors/track/open/:dealId — 1x1 tracking pixel for email opens */
router.get('/track/open/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (!isNaN(dealId)) {
      // Update deal
      await db.update(sponsorDeals).set({
        proposalOpenedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(sponsorDeals.id, dealId));

      // Update email log
      await db.update(sponsorEmailLog).set({
        status: 'opened',
        openedAt: new Date(),
      }).where(and(eq(sponsorEmailLog.dealId, dealId), eq(sponsorEmailLog.status, 'sent')));

      // Update contact opens count
      const deal = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);
      if (deal[0]) {
        const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, deal[0].sponsorContactId)).limit(1);
        if (contact[0]) {
          await db.update(sponsorContacts).set({
            opensCount: (contact[0].opensCount || 0) + 1,
            status: contact[0].status === 'contacted' ? 'opened' : contact[0].status,
            updatedAt: new Date(),
          }).where(eq(sponsorContacts.id, contact[0].id));
        }

        // Notify artist on first open
        if (!deal[0].proposalOpenedAt) {
          const brand = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, deal[0].sponsorContactId)).limit(1);
          await createNotification({
            userId: deal[0].artistId,
            type: 'SPONSOR_EMAIL_OPENED',
            title: `👀 ${brand[0]?.brandName || 'A sponsor'} opened your proposal!`,
            message: `"${deal[0].title}" was just opened. They're looking!`,
            metadata: { dealId, brandName: brand[0]?.brandName },
          });
        }
      }
    }
  } catch (err) {
    // Silently fail — tracking should not break the experience
    console.error('Tracking pixel error:', err);
  }
  // Return a 1x1 transparent GIF regardless
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache' });
  res.send(pixel);
});

/** GET /api/sponsors/track/click/:dealId — Click tracking redirect */
router.get('/track/click/:dealId', async (req: Request, res: Response) => {
  const dealId = parseInt(req.params.dealId);
  const dest = req.query.dest as string;

  try {
    if (!isNaN(dealId)) {
      await db.update(sponsorEmailLog).set({
        status: 'clicked',
        clickedAt: new Date(),
      }).where(and(eq(sponsorEmailLog.dealId, dealId), inArray(sponsorEmailLog.status, ['sent', 'opened'])));
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Validate destination URL to prevent open redirect
  try {
    const url = new URL(dest || '');
    const platformHost = new URL(PLATFORM_URL).hostname;
    if (url.hostname === platformHost || url.hostname === 'localhost') {
      return res.redirect(302, dest);
    }
  } catch {}
  res.redirect(302, PLATFORM_URL);
});

// ─── PUBLIC: Proposal Landing Page Data ───────────────────────────────────────

/**
 * GET /api/sponsors/proposal/:dealId — Public endpoint for sponsor proposal landing page
 */
router.get('/proposal/:dealId', async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    const deal = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);
    if (!deal[0]) return res.status(404).json({ error: 'Proposal not found' });

    const contact = await db.select().from(sponsorContacts)
      .where(eq(sponsorContacts.id, deal[0].sponsorContactId)).limit(1);

    const artist = await getArtistData(deal[0].artistId);
    const paymentStatus = await getDealPaymentStatus(dealId);

    res.json({
      success: true,
      deal: {
        id: deal[0].id,
        title: deal[0].title,
        dealType: deal[0].dealType,
        description: deal[0].description,
        proposedAmount: deal[0].proposedAmount,
        agreedAmount: deal[0].agreedAmount,
        status: deal[0].status,
        contractTerms: deal[0].contractTerms,
      },
      brand: contact[0] ? {
        name: contact[0].brandName,
        industry: contact[0].industry,
      } : null,
      artist,
      payment: paymentStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ADMIN: Manual follow-up trigger ──────────────────────────────────────────

router.post('/admin/trigger-followups', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await processFollowUps();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── STATS DASHBOARD ──────────────────────────────────────────────────────────

/**
 * GET /api/sponsors/stats — Sponsor module stats for dashboard
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId((req as any).auth?.userId);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const [contactsCount] = await db.select({ count: count() }).from(sponsorContacts)
      .where(eq(sponsorContacts.addedByUserId, userId));
    const [campaignsCount] = await db.select({ count: count() }).from(sponsorCampaigns)
      .where(eq(sponsorCampaigns.userId, userId));
    const [dealsCount] = await db.select({ count: count() }).from(sponsorDeals)
      .where(eq(sponsorDeals.userId, userId));

    // Revenue from completed deals
    const completedDeals = await db.select({
      totalRevenue: sql<string>`COALESCE(SUM(CAST(${sponsorDeals.agreedAmount} AS DECIMAL)), 0)`,
      totalArtistEarning: sql<string>`COALESCE(SUM(CAST(${sponsorDeals.artistEarning} AS DECIMAL)), 0)`,
      totalPlatformFee: sql<string>`COALESCE(SUM(CAST(${sponsorDeals.platformFee} AS DECIMAL)), 0)`,
    }).from(sponsorDeals)
      .where(and(
        eq(sponsorDeals.userId, userId),
        inArray(sponsorDeals.status, ['active', 'completed'])
      ));

    // Pipeline breakdown
    const pipeline = await db.select({
      status: sponsorDeals.status,
      count: count(),
    }).from(sponsorDeals)
      .where(eq(sponsorDeals.userId, userId))
      .groupBy(sponsorDeals.status);

    res.json({
      success: true,
      stats: {
        totalContacts: contactsCount?.count || 0,
        totalCampaigns: campaignsCount?.count || 0,
        totalDeals: dealsCount?.count || 0,
        revenue: {
          total: completedDeals[0]?.totalRevenue || '0',
          artistEarnings: completedDeals[0]?.totalArtistEarning || '0',
          platformFees: completedDeals[0]?.totalPlatformFee || '0',
        },
        pipeline: pipeline.reduce((acc, p) => { acc[p.status || 'unknown'] = p.count; return acc; }, {} as Record<string, number>),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── PUBLIC: Sponsor Accept / Reject / Counter-Offer ──────────────────────────

/**
 * POST /api/sponsors/proposal/:dealId/respond — Public endpoint for sponsor to respond
 * No authentication required — accessed via email link
 */
router.post('/proposal/:dealId/respond', rateLimitProposal, async (req: Request, res: Response) => {
  try {
    const dealId = parseInt(req.params.dealId);
    if (isNaN(dealId)) return res.status(400).json({ error: 'Invalid deal ID' });

    const { action, counterAmount, message } = req.body;
    const validActions = ['interested', 'accepted', 'rejected', 'counter_offer'];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({ error: 'action must be one of: interested, accepted, rejected, counter_offer' });
    }

    const deal = await db.select().from(sponsorDeals).where(eq(sponsorDeals.id, dealId)).limit(1);
    if (!deal[0]) return res.status(404).json({ error: 'Deal not found' });

    // Only allow response if deal is in an open state
    if (!['proposed', 'negotiating'].includes(deal[0].status)) {
      return res.status(400).json({ error: `Deal is already ${deal[0].status}, cannot respond` });
    }

    const contact = await db.select().from(sponsorContacts).where(eq(sponsorContacts.id, deal[0].sponsorContactId)).limit(1);
    const brandName = contact[0]?.brandName || 'Sponsor';
    const artist = await db.select().from(users).where(eq(users.id, deal[0].artistId)).limit(1);
    const artistName = artist[0]?.artistName || artist[0]?.username || 'Artist';

    // Map action to deal status
    const statusMap: Record<string, string> = {
      interested: 'negotiating',
      accepted: 'accepted',
      rejected: 'rejected',
      counter_offer: 'negotiating',
    };

    const updateData: Record<string, any> = {
      status: statusMap[action],
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    };
    if (action === 'counter_offer' && counterAmount) {
      updateData.agreedAmount = String(counterAmount);
      updateData.notes = `${deal[0].notes || ''}\n[Sponsor counter-offer: $${counterAmount}] ${message || ''}`.trim();
    } else if (message) {
      updateData.notes = `${deal[0].notes || ''}\n[Sponsor ${action}] ${message}`.trim();
    }

    await db.update(sponsorDeals).set(updateData).where(eq(sponsorDeals.id, dealId));

    // Update contact status
    if (contact[0]) {
      const contactStatus = action === 'accepted' ? 'deal_in_progress' :
        action === 'rejected' ? 'not_interested' : 'interested';
      await db.update(sponsorContacts).set({
        status: contactStatus,
        updatedAt: new Date(),
      }).where(eq(sponsorContacts.id, contact[0].id));
    }

    // Notify the artist
    const notifTitles: Record<string, string> = {
      interested: `🟢 ${brandName} is interested!`,
      accepted: `✅ ${brandName} accepted your proposal!`,
      rejected: `❌ ${brandName} declined your proposal`,
      counter_offer: `💬 ${brandName} made a counter-offer`,
    };
    const notifMessages: Record<string, string> = {
      interested: `${brandName} has shown interest in "${deal[0].title}". Follow up to close the deal!`,
      accepted: `Great news! ${brandName} accepted "${deal[0].title}". Generate an invoice to collect payment.`,
      rejected: `${brandName} has declined "${deal[0].title}". ${message ? `Reason: ${message}` : 'Don\'t give up — keep reaching out!'}`,
      counter_offer: `${brandName} counter-offered $${counterAmount || '?'} for "${deal[0].title}". ${message || ''}`,
    };

    await createNotification({
      userId: deal[0].artistId,
      type: 'SPONSOR_RESPONSE',
      title: notifTitles[action],
      message: notifMessages[action],
      link: `/artist/${artist[0]?.slug || deal[0].artistId}`,
      metadata: { dealId, action, brandName, counterAmount },
    });

    // Log the email interaction
    if (contact[0]?.contactEmail) {
      await db.insert(sponsorEmailLog).values({
        dealId,
        sponsorContactId: contact[0].id,
        toEmail: contact[0].contactEmail,
        toName: contact[0].contactName || brandName,
        subject: `Sponsor Response: ${action}`,
        emailType: action === 'accepted' ? 'acceptance' : 'counter_offer',
        status: 'sent',
        sentAt: new Date(),
      });
    }

    res.json({ success: true, status: statusMap[action] });
  } catch (error: any) {
    console.error('❌ Sponsor response error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
