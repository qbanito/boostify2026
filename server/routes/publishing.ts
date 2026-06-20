/**
 * Publishing & Sync Licensing API
 * 
 * Endpoints for the Publishing Hub:
 * - Briefs: Create/manage music briefs (what companies need)
 * - Submissions: Submit tracks to briefs or directly to companies
 * - Deals: Track sync/publishing deals with financials
 * - Messages: Communication threads
 * - Dashboard: Stats and analytics
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  publishingBriefs,
  publishingSubmissions,
  publishingDeals,
  publishingMessages,
  musicIndustryContacts,
  users,
} from '../db/schema';
import { eq, and, desc, sql, inArray, ilike, or, gte } from 'drizzle-orm';

const router = Router();

// ============================================================
// BRIEFS
// ============================================================

// GET /briefs — List active briefs (filterable)
router.get('/briefs', async (req: Request, res: Response) => {
  try {
    const { projectType, genre, status = 'active', limit = '20', offset = '0' } = req.query;
    const conditions: any[] = [];

    if (status) conditions.push(eq(publishingBriefs.status, status as string));
    if (projectType) conditions.push(eq(publishingBriefs.projectType, projectType as string));

    const briefs = await db.select()
      .from(publishingBriefs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(publishingBriefs.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(publishingBriefs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ briefs, total: countResult?.count || 0 });
  } catch (e: any) {
    console.error('[PUBLISHING] Briefs list error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /briefs — Create a new brief
router.post('/briefs', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    // Resolve numeric user ID
    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const { title, description, projectType, genres, moods, tempo, vocalPreference,
      referenceLinks, budgetMin, budgetMax, currency, deadline, exclusivity, territory, usageDuration } = req.body;

    if (!title || !description || !projectType) {
      return res.status(400).json({ error: 'Title, description, and projectType are required' });
    }

    const [brief] = await db.insert(publishingBriefs).values({
      userId: dbUser.id,
      title,
      description,
      projectType,
      genres: genres || [],
      moods: moods || [],
      tempo,
      vocalPreference,
      referenceLinks: referenceLinks || [],
      budgetMin,
      budgetMax,
      currency: currency || 'USD',
      deadline: deadline ? new Date(deadline) : null,
      exclusivity: exclusivity || 'negotiable',
      territory: territory || 'worldwide',
      usageDuration,
      status: 'active',
    }).returning();

    res.json({ success: true, brief });
  } catch (e: any) {
    console.error('[PUBLISHING] Create brief error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// SUBMISSIONS
// ============================================================

// GET /submissions — List user's submissions
router.get('/submissions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.json({ submissions: [] });

    const { status, briefId } = req.query;
    const conditions: any[] = [eq(publishingSubmissions.userId, dbUser.id)];
    if (status) conditions.push(eq(publishingSubmissions.status, status as string));
    if (briefId) conditions.push(eq(publishingSubmissions.briefId, parseInt(briefId as string)));

    const submissions = await db.select()
      .from(publishingSubmissions)
      .where(and(...conditions))
      .orderBy(desc(publishingSubmissions.createdAt));

    res.json({ submissions });
  } catch (e: any) {
    console.error('[PUBLISHING] Submissions list error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /submissions — Submit a track
router.post('/submissions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const { briefId, contactId, trackTitle, artistName, genre, duration, bpm, trackUrl,
      previewUrl, lyrics, isrc, coverArtUrl, pitchNote, suggestedFee, exclusivityOffer } = req.body;

    if (!trackTitle || !artistName) {
      return res.status(400).json({ error: 'trackTitle and artistName are required' });
    }

    const [submission] = await db.insert(publishingSubmissions).values({
      userId: dbUser.id,
      briefId: briefId || null,
      contactId: contactId || null,
      trackTitle,
      artistName,
      genre,
      duration,
      bpm,
      trackUrl,
      previewUrl,
      lyrics,
      isrc,
      coverArtUrl,
      pitchNote,
      suggestedFee,
      exclusivityOffer: exclusivityOffer || 'negotiable',
      status: 'submitted',
    }).returning();

    // Increment brief submission count if linked to a brief
    if (briefId) {
      await db.update(publishingBriefs)
        .set({ totalSubmissions: sql`${publishingBriefs.totalSubmissions} + 1`, updatedAt: new Date() })
        .where(eq(publishingBriefs.id, briefId));
    }

    res.json({ success: true, submission });
  } catch (e: any) {
    console.error('[PUBLISHING] Create submission error:', e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /submissions/:id — Update submission status
router.patch('/submissions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, reviewerNotes } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (reviewerNotes) updateData.reviewerNotes = reviewerNotes;
    if (status === 'under_review' || status === 'shortlisted' || status === 'accepted' || status === 'rejected') {
      updateData.reviewedAt = new Date();
    }

    const [updated] = await db.update(publishingSubmissions)
      .set(updateData)
      .where(eq(publishingSubmissions.id, id))
      .returning();

    res.json({ success: true, submission: updated });
  } catch (e: any) {
    console.error('[PUBLISHING] Update submission error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// DEALS
// ============================================================

// GET /deals — List user's deals
router.get('/deals', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.json({ deals: [] });

    const deals = await db.select()
      .from(publishingDeals)
      .where(eq(publishingDeals.userId, dbUser.id))
      .orderBy(desc(publishingDeals.createdAt));

    // Calculate totals
    const totalEarnings = deals.reduce((sum, d) => sum + (d.artistEarning || 0), 0);
    const activeDeals = deals.filter(d => ['active', 'contract_signed'].includes(d.status)).length;

    res.json({ deals, totalEarnings, activeDeals });
  } catch (e: any) {
    console.error('[PUBLISHING] Deals list error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /deals — Create a deal from a submission or directly
router.post('/deals', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const { submissionId, contactId, briefId, dealType, title, trackTitle, artistName,
      projectName, companyName, dealAmount, currency, exclusivity, territory,
      usageDuration, contractTerms, royaltyPercentage, advanceAmount } = req.body;

    if (!dealType || !title || !trackTitle || !artistName) {
      return res.status(400).json({ error: 'dealType, title, trackTitle, and artistName are required' });
    }

    const platformFee = dealAmount ? Math.round(dealAmount * 0.15) : null;
    const artistEarning = dealAmount ? dealAmount - (platformFee || 0) : null;

    const [deal] = await db.insert(publishingDeals).values({
      userId: dbUser.id,
      submissionId: submissionId || null,
      contactId: contactId || null,
      briefId: briefId || null,
      dealType,
      title,
      trackTitle,
      artistName,
      projectName,
      companyName,
      dealAmount,
      currency: currency || 'USD',
      platformFee,
      artistEarning,
      royaltyPercentage,
      advanceAmount,
      exclusivity: exclusivity || 'non_exclusive',
      territory: territory || 'worldwide',
      usageDuration,
      contractTerms,
      status: 'proposed',
    }).returning();

    // Update submission status if linked
    if (submissionId) {
      await db.update(publishingSubmissions)
        .set({ status: 'deal_in_progress', updatedAt: new Date() })
        .where(eq(publishingSubmissions.id, submissionId));
    }

    res.json({ success: true, deal });
  } catch (e: any) {
    console.error('[PUBLISHING] Create deal error:', e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /deals/:id — Update deal status/terms
router.patch('/deals/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, dealAmount, contractTerms, contractSignedAt } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (dealAmount !== undefined) {
      updateData.dealAmount = dealAmount;
      updateData.platformFee = Math.round(dealAmount * 0.15);
      updateData.artistEarning = dealAmount - updateData.platformFee;
    }
    if (contractTerms) updateData.contractTerms = contractTerms;
    if (contractSignedAt) updateData.contractSignedAt = new Date(contractSignedAt);
    if (status === 'contract_signed') updateData.contractSignedAt = new Date();

    const [updated] = await db.update(publishingDeals)
      .set(updateData)
      .where(eq(publishingDeals.id, id))
      .returning();

    res.json({ success: true, deal: updated });
  } catch (e: any) {
    console.error('[PUBLISHING] Update deal error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// MESSAGES
// ============================================================

// GET /messages — Get messages for a deal or submission
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { dealId, submissionId } = req.query;
    if (!dealId && !submissionId) return res.status(400).json({ error: 'dealId or submissionId required' });

    const condition = dealId
      ? eq(publishingMessages.dealId, parseInt(dealId as string))
      : eq(publishingMessages.submissionId, parseInt(submissionId as string));

    const messages = await db.select()
      .from(publishingMessages)
      .where(condition)
      .orderBy(publishingMessages.sentAt);

    res.json({ messages });
  } catch (e: any) {
    console.error('[PUBLISHING] Messages error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /messages — Send a message
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const { dealId, submissionId, contactId, subject, body, direction = 'outbound', channel = 'platform' } = req.body;

    if (!body) return res.status(400).json({ error: 'Message body required' });

    const [msg] = await db.insert(publishingMessages).values({
      dealId: dealId || null,
      submissionId: submissionId || null,
      userId: dbUser.id,
      contactId: contactId || null,
      direction,
      channel,
      subject,
      body,
    }).returning();

    res.json({ success: true, message: msg });
  } catch (e: any) {
    console.error('[PUBLISHING] Send message error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// DASHBOARD & STATS
// ============================================================

// GET /dashboard — Publishing hub stats
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.json({
      submissions: { total: 0, pending: 0, accepted: 0, rejected: 0 },
      deals: { total: 0, active: 0, totalEarnings: 0 },
      briefs: { available: 0 },
      contacts: { publishing: 0, sync: 0, tv: 0 },
    });

    // Submission stats
    const subs = await db.select({ status: publishingSubmissions.status, count: sql<number>`count(*)` })
      .from(publishingSubmissions)
      .where(eq(publishingSubmissions.userId, dbUser.id))
      .groupBy(publishingSubmissions.status);

    const subStats = {
      total: subs.reduce((s, r) => s + Number(r.count), 0),
      pending: Number(subs.find(r => r.status === 'submitted')?.count || 0) + Number(subs.find(r => r.status === 'under_review')?.count || 0),
      accepted: Number(subs.find(r => r.status === 'accepted')?.count || 0) + Number(subs.find(r => r.status === 'licensed')?.count || 0),
      rejected: Number(subs.find(r => r.status === 'rejected')?.count || 0),
    };

    // Deal stats
    const dealRows = await db.select()
      .from(publishingDeals)
      .where(eq(publishingDeals.userId, dbUser.id));

    const dealStats = {
      total: dealRows.length,
      active: dealRows.filter(d => ['active', 'contract_signed', 'negotiating'].includes(d.status)).length,
      totalEarnings: dealRows.reduce((s, d) => s + (d.artistEarning || 0), 0),
    };

    // Available briefs
    const [briefCount] = await db.select({ count: sql<number>`count(*)` })
      .from(publishingBriefs)
      .where(eq(publishingBriefs.status, 'active'));

    // Industry contacts (publishing, sync, tv)
    const contactCounts = await db.select({
      category: musicIndustryContacts.category,
      count: sql<number>`count(*)`
    })
      .from(musicIndustryContacts)
      .where(inArray(musicIndustryContacts.category, ['publishing', 'sync', 'tv']))
      .groupBy(musicIndustryContacts.category);

    res.json({
      submissions: subStats,
      deals: dealStats,
      briefs: { available: Number(briefCount?.count || 0) },
      contacts: {
        publishing: Number(contactCounts.find(c => c.category === 'publishing')?.count || 0),
        sync: Number(contactCounts.find(c => c.category === 'sync')?.count || 0),
        tv: Number(contactCounts.find(c => c.category === 'tv')?.count || 0),
      },
    });
  } catch (e: any) {
    console.error('[PUBLISHING] Dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /contacts — Get publishing/sync/TV contacts for pitching
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const { category, search, limit = '50', offset = '0' } = req.query;
    const conditions: any[] = [];

    // Default to publishing-relevant categories
    const cats = category
      ? [category as string]
      : ['publishing', 'sync', 'tv'];
    conditions.push(inArray(musicIndustryContacts.category, cats));

    if (search) {
      conditions.push(
        or(
          ilike(musicIndustryContacts.fullName, `%${search}%`),
          ilike(musicIndustryContacts.companyName, `%${search}%`),
          ilike(musicIndustryContacts.jobTitle, `%${search}%`),
        )
      );
    }

    const contacts = await db.select()
      .from(musicIndustryContacts)
      .where(and(...conditions))
      .orderBy(desc(musicIndustryContacts.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(musicIndustryContacts)
      .where(and(...conditions));

    res.json({ contacts, total: Number(countResult?.count || 0) });
  } catch (e: any) {
    console.error('[PUBLISHING] Contacts error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /pitch — Send a pitch email to a company contact
router.post('/pitch', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [dbUser] = await db.select({ id: users.id }).from(users)
      .where(typeof userId === 'number' ? eq(users.id, userId) : eq(users.clerkId, userId))
      .limit(1);
    if (!dbUser) return res.status(404).json({ error: 'User not found' });

    const { contactId, trackTitle, artistName, genre, trackUrl, pitchNote, suggestedFee } = req.body;

    if (!contactId || !trackTitle || !artistName) {
      return res.status(400).json({ error: 'contactId, trackTitle, and artistName are required' });
    }

    // Get the contact
    const [contact] = await db.select().from(musicIndustryContacts)
      .where(eq(musicIndustryContacts.id, contactId)).limit(1);
    if (!contact) return res.status(404).json({ error: 'Contact not found' });

    // Create submission record
    const [submission] = await db.insert(publishingSubmissions).values({
      userId: dbUser.id,
      contactId,
      trackTitle,
      artistName,
      genre,
      trackUrl,
      pitchNote,
      suggestedFee,
      status: 'submitted',
    }).returning();

    // Create outbound message
    await db.insert(publishingMessages).values({
      submissionId: submission.id,
      userId: dbUser.id,
      contactId,
      direction: 'outbound',
      channel: 'email',
      subject: `Music Submission: "${trackTitle}" by ${artistName}`,
      body: pitchNote || `Hi ${contact.firstName || contact.fullName},\n\nI'd like to submit "${trackTitle}" for your consideration. ${genre ? `Genre: ${genre}.` : ''}\n\n${trackUrl ? `Listen here: ${trackUrl}` : ''}\n\nBest regards,\n${artistName}`,
    });

    // Update contact status
    await db.update(musicIndustryContacts)
      .set({
        status: 'contacted',
        lastContactedAt: new Date(),
        emailsSent: sql`${musicIndustryContacts.emailsSent} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(musicIndustryContacts.id, contactId));

    res.json({ success: true, submission, contactName: contact.fullName, contactEmail: contact.email });
  } catch (e: any) {
    console.error('[PUBLISHING] Pitch error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
