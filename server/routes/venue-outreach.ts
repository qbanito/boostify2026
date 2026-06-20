/**
 * Venue Booking Outreach API Routes
 * Google Maps scraping → Email proposal campaigns → Deal pipeline
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  venueContacts, venueBookingCampaigns, venueBookingDeals, users,
} from '../db/schema';
import { eq, and, desc, sql, ilike, inArray, or } from 'drizzle-orm';
import { apifyVenueScraper } from '../services/apify-venue-scraper';
import {
  getTemplateList, generateEmailFromTemplate, VenueEmailData,
} from '../services/venue-email-templates';
import { rateLimitEmailSend, rateLimitProposal } from '../middleware/rate-limit';

const router = Router();

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const PLATFORM_URL = process.env.BASE_URL || 'https://boostifymusic.com';

// ─── Auth helper — resolves Clerk/Firebase string ID to PG integer ───
async function getUserPgId(req: Request): Promise<number | null> {
  // Try Clerk auth first
  const clerkId = (req as any).auth?.userId;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  // Fallback: req.user.id (could be string UID or numeric)
  const rawId = (req as any).user?.id;
  if (!rawId) return null;
  // If it's numeric already
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;
  // String UID — look up by clerkId or firestoreId
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id || null;
}

// Resolve artistId (string from client, could be Firebase UID or PG int)
async function resolveArtistId(raw: string | number): Promise<number | null> {
  const numId = Number(raw);
  if (!isNaN(numId) && numId > 0) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, numId)).limit(1);
    if (u) return u.id;
  }
  // String UID lookup
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(raw)), eq(users.firestoreId, String(raw))))
    .limit(1);
  return u?.id || null;
}

// ═══════════════════════════════════════════════════════════════════
// GET /email-templates — List available email templates
// ═══════════════════════════════════════════════════════════════════
router.get('/email-templates', (_req: Request, res: Response) => {
  res.json(getTemplateList());
});

// ═══════════════════════════════════════════════════════════════════
// POST /email-preview — Generate email preview with artist data
// ═══════════════════════════════════════════════════════════════════
router.post('/email-preview', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { templateId, artistId, venueName, showFee, setDuration, availability, technicalRequirements, customMessage } = req.body;
  if (!artistId) return res.status(400).json({ error: 'artistId is required' });

  const resolvedArtistId = await resolveArtistId(artistId);
  if (!resolvedArtistId) return res.status(404).json({ error: 'Artist not found' });

  const [artist] = await db.select().from(users).where(eq(users.id, resolvedArtistId)).limit(1);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });

  const emailData: VenueEmailData = {
    artistName: artist.artistName || artist.username || 'Artist',
    artistSlug: artist.slug || '',
    artistGenre: artist.genre || (artist.genres as string[])?.[0] || 'Music',
    artistBio: artist.biography || '',
    artistImage: artist.profileImage || '',
    spotifyUrl: artist.spotifyUrl || '',
    youtubeChannel: artist.youtubeChannel || '',
    instagramHandle: artist.instagramHandle || '',
    venueName: venueName || 'Sample Venue',
    showFee, setDuration, availability, technicalRequirements, customMessage,
    dealId: 0, // preview only
  };

  const { html, subject } = generateEmailFromTemplate(templateId || 'professional_pitch', emailData);
  res.json({ html, subject });
  } catch (err: any) {
    console.error('❌ Email preview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /tech-rider — Get artist's technical rider from profile + Firestore
// ═══════════════════════════════════════════════════════════════════
router.get('/tech-rider', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const artistId = req.query.artistId ? (await resolveArtistId(req.query.artistId as string) || userId) : userId;

  const [artist] = await db.select({
    id: users.id,
    technicalRider: users.technicalRider,
    artistName: users.artistName,
  }).from(users).where(eq(users.id, artistId)).limit(1);

  if (!artist) return res.status(404).json({ error: 'Artist not found' });

  // Parse technical rider JSON from user profile
  let riderData: any = null;
  if (artist.technicalRider) {
    try {
      riderData = typeof artist.technicalRider === 'string'
        ? JSON.parse(artist.technicalRider)
        : artist.technicalRider;
    } catch { riderData = null; }
  }

  // Build a summary text from the rider data
  let summary = '';
  if (riderData) {
    const parts: string[] = [];
    if (riderData.sound || riderData.pa) parts.push(`Sound: ${riderData.sound || riderData.pa}`);
    if (riderData.monitors) parts.push(`Monitors: ${riderData.monitors}`);
    if (riderData.microphones || riderData.mics) parts.push(`Microphones: ${riderData.microphones || riderData.mics}`);
    if (riderData.stage) parts.push(`Stage: ${riderData.stage}`);
    if (riderData.lighting) parts.push(`Lighting: ${riderData.lighting}`);
    if (riderData.power) parts.push(`Power: ${riderData.power}`);
    if (riderData.backline) parts.push(`Backline: ${riderData.backline}`);
    if (riderData.other) parts.push(`Other: ${riderData.other}`);
    // If it's just a flat text string stored as JSON
    if (typeof riderData === 'string') {
      summary = riderData;
    } else if (riderData.summary || riderData.text || riderData.content) {
      summary = riderData.summary || riderData.text || riderData.content;
    } else if (parts.length) {
      summary = parts.join(' · ');
    } else {
      // Flatten any keys we find
      summary = Object.entries(riderData)
        .filter(([_, v]) => v && typeof v === 'string')
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
    }
  }

  res.json({
    hasRider: !!riderData,
    riderData,
    summary,
    artistName: artist.artistName,
  });
  } catch (err: any) {
    console.error('❌ Tech rider error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /search — Run Apify Google Maps scrape
// ═══════════════════════════════════════════════════════════════════
router.post('/search', async (req: Request, res: Response) => {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { locationQuery, searchStringsArray, maxCrawledPlacesPerSearch, language } = req.body;
  if (!locationQuery || !searchStringsArray?.length) {
    return res.status(400).json({ error: 'locationQuery and searchStringsArray are required' });
  }

  try {
    const venues = await apifyVenueScraper.searchVenues({
      locationQuery,
      searchStringsArray,
      maxCrawledPlacesPerSearch: Math.min(maxCrawledPlacesPerSearch || 100, 200),
      language: language || 'en',
    });

    const result = await apifyVenueScraper.saveVenues(
      venues, userId, `${locationQuery} | ${searchStringsArray.join(', ')}`
    );

    res.json({ success: true, total: venues.length, ...result });
  } catch (err: any) {
    console.error('❌ Venue search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /load-dataset — Load venues from existing Apify dataset
// ═══════════════════════════════════════════════════════════════════
router.post('/load-dataset', async (req: Request, res: Response) => {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { datasetId } = req.body;

  try {
    const venues = await apifyVenueScraper.loadFromDataset(datasetId);
    const result = await apifyVenueScraper.saveVenues(
      venues, userId, `dataset:${datasetId || 'default'}`, datasetId
    );
    res.json({ success: true, total: venues.length, ...result });
  } catch (err: any) {
    console.error('❌ Dataset load error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /venues — List scraped venues (with filters)
// ═══════════════════════════════════════════════════════════════════
router.get('/venues', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { category, city, status, hasEmail, limit } = req.query;
  const conditions: any[] = [eq(venueContacts.addedByUserId, userId)];

  if (category && category !== 'all') conditions.push(sql`${venueContacts.category} = ${String(category)}`);
  if (city) conditions.push(ilike(venueContacts.city, `%${String(city)}%`));
  if (status && status !== 'all') conditions.push(sql`${venueContacts.status} = ${String(status)}`);

  let query = db.select().from(venueContacts)
    .where(and(...conditions))
    .orderBy(desc(venueContacts.googleRating))
    .limit(Number(limit) || 200);

  const venues = await query;

  // Optionally filter by has email (can't do this easily in SQL with nullable)
  const filtered = hasEmail === 'true' ? venues.filter(v => v.email) : venues;
  res.json(filtered);
  } catch (err: any) {
    console.error('❌ Venues list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /stats — Campaign statistics
// ═══════════════════════════════════════════════════════════════════
router.get('/stats', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const [venueCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(venueContacts).where(eq(venueContacts.addedByUserId, userId));
  const [withEmail] = await db.select({ count: sql<number>`count(*)::int` })
    .from(venueContacts).where(and(eq(venueContacts.addedByUserId, userId), sql`${venueContacts.email} IS NOT NULL`));
  const campaigns = await db.select().from(venueBookingCampaigns)
    .where(eq(venueBookingCampaigns.userId, userId)).orderBy(desc(venueBookingCampaigns.createdAt));
  const deals = await db.select().from(venueBookingDeals)
    .where(eq(venueBookingDeals.userId, userId));

  const pipeline: Record<string, number> = {};
  deals.forEach(d => { pipeline[d.status || 'sent'] = (pipeline[d.status || 'sent'] || 0) + 1; });

  res.json({
    totalVenues: venueCount?.count || 0,
    venuesWithEmail: withEmail?.count || 0,
    totalCampaigns: campaigns.length,
    totalDeals: deals.length,
    pipeline,
    campaigns,
  });
  } catch (err: any) {
    console.error('❌ Stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /campaign — Create a booking campaign
// ═══════════════════════════════════════════════════════════════════
router.post('/campaign', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { artistId, name, locationQuery, searchTerms, showFee, setDuration, technicalRequirements, availability, customMessage, emailTemplate } = req.body;
  if (!artistId || !name) return res.status(400).json({ error: 'artistId and name are required' });

  const resolvedArtistId = await resolveArtistId(artistId);
  if (!resolvedArtistId) return res.status(404).json({ error: 'Artist not found' });

  const [campaign] = await db.insert(venueBookingCampaigns).values({
    userId, artistId: resolvedArtistId, name,
    locationQuery: locationQuery || '',
    searchTerms: searchTerms || [],
    showFee: showFee || null,
    setDuration: setDuration || null,
    technicalRequirements: technicalRequirements || null,
    availability: availability || null,
    customMessage: customMessage || null,
    emailTemplate: emailTemplate || 'professional_pitch',
    status: 'ready',
  }).returning();

  res.json(campaign);
  } catch (err: any) {
    console.error('❌ Campaign create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /send — Send proposal emails to selected venues
// ═══════════════════════════════════════════════════════════════════
router.post('/send', rateLimitEmailSend, async (req: Request, res: Response) => {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { venueIds, campaignId, artistId, templateId } = req.body;
  if (!venueIds?.length || !artistId) return res.status(400).json({ error: 'venueIds and artistId required' });

  const resolvedArtistId = await resolveArtistId(artistId);
  if (!resolvedArtistId) return res.status(404).json({ error: 'Artist not found' });

  // Load artist
  const [artist] = await db.select().from(users).where(eq(users.id, resolvedArtistId)).limit(1);
  if (!artist) return res.status(404).json({ error: 'Artist not found' });

  // Load campaign (optional)
  let campaign: any = null;
  if (campaignId) {
    const [c] = await db.select().from(venueBookingCampaigns).where(eq(venueBookingCampaigns.id, campaignId)).limit(1);
    campaign = c;
  }

  // Load venues
  const venues = await db.select().from(venueContacts)
    .where(and(
      inArray(venueContacts.id, venueIds),
      eq(venueContacts.addedByUserId, userId)
    ));

  const venuesWithEmail = venues.filter(v => v.email);
  if (!venuesWithEmail.length) return res.status(400).json({ error: 'None of the selected venues have email addresses' });

  let sent = 0, failed = 0;
  const dealIds: number[] = [];

  for (const venue of venuesWithEmail) {
    try {
      // Create deal first
      const [deal] = await db.insert(venueBookingDeals).values({
        campaignId: campaignId || null,
        venueContactId: venue.id,
        artistId: resolvedArtistId,
        userId,
        title: `${artist.artistName || artist.username} @ ${venue.name}`,
        proposedFee: campaign?.showFee || null,
        setDuration: campaign?.setDuration || null,
        technicalRequirements: campaign?.technicalRequirements || null,
        status: 'sent',
        proposalSentAt: new Date(),
      }).returning();

      dealIds.push(deal.id);

      // Generate email using template system
      const emailData: VenueEmailData = {
        artistName: artist.artistName || artist.username || 'Artist',
        artistSlug: artist.slug || '',
        artistGenre: artist.genre || (artist.genres as string[])?.[0] || 'Music',
        artistBio: artist.biography || '',
        artistImage: artist.profileImage || '',
        spotifyUrl: artist.spotifyUrl || '',
        youtubeChannel: artist.youtubeChannel || '',
        instagramHandle: artist.instagramHandle || '',
        venueName: venue.name,
        showFee: campaign?.showFee || undefined,
        setDuration: campaign?.setDuration || undefined,
        availability: campaign?.availability || undefined,
        technicalRequirements: campaign?.technicalRequirements || undefined,
        customMessage: campaign?.customMessage || undefined,
        dealId: deal.id,
      };

      const { html, subject } = generateEmailFromTemplate(
        templateId || campaign?.emailTemplate || 'professional_pitch',
        emailData,
      );

      if (BREVO_API_KEY) {
        const emailRes = await fetch(BREVO_API_URL, {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { email: 'bookings@boostifymusic.com', name: 'Boostify Music Bookings' },
            to: [{ email: venue.email!, name: venue.name }],
            subject,
            htmlContent: html,
          }),
        });
        const emailResult = await emailRes.json();
        if (!emailResult.messageId) throw new Error(emailResult.message || 'Email failed');
      }

      // Update venue status
      await db.update(venueContacts).set({
        status: 'contacted',
        lastContactedAt: new Date(),
        emailsSent: sql`${venueContacts.emailsSent} + 1`,
      }).where(eq(venueContacts.id, venue.id));

      sent++;
    } catch (err: any) {
      console.error(`❌ Failed to send to ${venue.name}:`, err.message);
      failed++;
    }
  }

  // Update campaign stats
  if (campaignId) {
    await db.update(venueBookingCampaigns).set({
      emailsSent: sql`${venueBookingCampaigns.emailsSent} + ${sent}`,
      totalVenues: sql`${venueBookingCampaigns.totalVenues} + ${venuesWithEmail.length}`,
      bookingsCreated: sql`${venueBookingCampaigns.bookingsCreated} + ${dealIds.length}`,
    }).where(eq(venueBookingCampaigns.id, campaignId));
  }

  res.json({ sent, failed, dealIds, totalWithEmail: venuesWithEmail.length });
});

// ═══════════════════════════════════════════════════════════════════
// GET /deals — List booking deals
// ═══════════════════════════════════════════════════════════════════
router.get('/deals', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const deals = await db.select({
    deal: venueBookingDeals,
    venue: venueContacts,
  }).from(venueBookingDeals)
    .leftJoin(venueContacts, eq(venueBookingDeals.venueContactId, venueContacts.id))
    .where(eq(venueBookingDeals.userId, userId))
    .orderBy(desc(venueBookingDeals.createdAt));

  res.json(deals);
  } catch (err: any) {
    console.error('❌ Deals list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /deals/export.csv — CSV export of booking deals
// ═══════════════════════════════════════════════════════════════════
router.get('/deals/export.csv', async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const rows = await db.select({
      deal: venueBookingDeals,
      venue: venueContacts,
    }).from(venueBookingDeals)
      .leftJoin(venueContacts, eq(venueBookingDeals.venueContactId, venueContacts.id))
      .where(eq(venueBookingDeals.userId, userId))
      .orderBy(desc(venueBookingDeals.createdAt));

    const headers = [
      'deal_id', 'created_at', 'updated_at', 'status', 'title',
      'venue_name', 'venue_city', 'venue_email', 'venue_phone',
      'proposed_fee', 'agreed_fee', 'counter_offer', 'currency',
      'proposed_date', 'confirmed_date', 'notes',
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
        r.deal.title,
        r.venue?.name || '',
        r.venue?.city || '',
        r.venue?.email || '',
        r.venue?.phone || '',
        r.deal.proposedFee || '',
        r.deal.agreedFee || '',
        r.deal.counterOffer || '',
        r.deal.currency || 'usd',
        r.deal.proposedDate?.toISOString?.() || '',
        r.deal.confirmedDate?.toISOString?.() || '',
        r.deal.notes || '',
      ].map(escape).join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="venue-deals-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err: any) {
    console.error('❌ Venue deals CSV export error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /proposal/:dealId — Public venue proposal page data
// ═══════════════════════════════════════════════════════════════════
router.get('/proposal/:dealId', async (req: Request, res: Response) => {
  const dealId = Number(req.params.dealId);
  if (!dealId) return res.status(400).json({ error: 'Invalid deal ID' });

  const [result] = await db.select({
    deal: venueBookingDeals,
    venue: venueContacts,
  }).from(venueBookingDeals)
    .leftJoin(venueContacts, eq(venueBookingDeals.venueContactId, venueContacts.id))
    .where(eq(venueBookingDeals.id, dealId))
    .limit(1);

  if (!result) return res.status(404).json({ error: 'Proposal not found' });

  // Load artist
  const [artist] = await db.select({
    id: users.id,
    artistName: users.artistName,
    username: users.username,
    slug: users.slug,
    biography: users.biography,
    genre: users.genre,
    genres: users.genres,
    profileImage: users.profileImage,
    coverImage: users.coverImage,
    spotifyUrl: users.spotifyUrl,
    youtubeChannel: users.youtubeChannel,
    instagramHandle: users.instagramHandle,
  }).from(users).where(eq(users.id, result.deal.artistId)).limit(1);

  // Mark as opened
  if (result.deal.status === 'sent') {
    await db.update(venueBookingDeals).set({
      status: 'opened', proposalOpenedAt: new Date(),
    }).where(eq(venueBookingDeals.id, dealId));
  }

  res.json({ deal: result.deal, venue: result.venue, artist });
});

// ═══════════════════════════════════════════════════════════════════
// POST /proposal/:dealId/respond — Venue responds to proposal
// ═══════════════════════════════════════════════════════════════════
router.post('/proposal/:dealId/respond', rateLimitProposal, async (req: Request, res: Response) => {
  const dealId = Number(req.params.dealId);
  const { action, counterOffer, message } = req.body;

  if (!dealId || !action) return res.status(400).json({ error: 'dealId and action required' });

  const statusMap: Record<string, string> = {
    accept: 'booked',
    reject: 'rejected',
    counter_offer: 'negotiating',
    interested: 'replied',
  };

  const newStatus = statusMap[action];
  if (!newStatus) return res.status(400).json({ error: 'Invalid action' });

  await db.update(venueBookingDeals).set({
    status: newStatus as any,
    venueResponse: message || null,
    counterOffer: action === 'counter_offer' ? counterOffer : null,
    repliedAt: new Date(),
  }).where(eq(venueBookingDeals.id, dealId));

  // Update venue status
  const [deal] = await db.select().from(venueBookingDeals).where(eq(venueBookingDeals.id, dealId)).limit(1);
  if (deal) {
    await db.update(venueContacts).set({
      status: action === 'accept' ? 'booked' : action === 'reject' ? 'not_interested' : 'replied',
    }).where(eq(venueContacts.id, deal.venueContactId));
  }

  res.json({ success: true, status: newStatus });
});

// ═══════════════════════════════════════════════════════════════════
// PATCH /rates — Update artist booking rates
// ═══════════════════════════════════════════════════════════════════
router.patch('/rates', async (req: Request, res: Response) => {
  try {
  const userId = await getUserPgId(req);
  if (!userId) return res.status(401).json({ error: 'Authentication required' });

  const { campaignId, showFee, setDuration, technicalRequirements, availability } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'campaignId required' });

  await db.update(venueBookingCampaigns).set({
    showFee: showFee || null,
    setDuration: setDuration || null,
    technicalRequirements: technicalRequirements || null,
    availability: availability || null,
  }).where(and(eq(venueBookingCampaigns.id, campaignId), eq(venueBookingCampaigns.userId, userId)));

  res.json({ success: true });
  } catch (err: any) {
    console.error('❌ Rates update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
