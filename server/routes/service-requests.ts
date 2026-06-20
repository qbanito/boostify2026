import express from 'express';
import { db } from '../db';
import { 
  serviceRequests, serviceBids, musicians, musicianProfiles, musicianImports,
  notifications, users,
  insertServiceRequestSchema, insertServiceBidSchema, insertMusicianProfileSchema
} from '../../db/schema';
import { eq, desc, and, sql, gte, lte, or, ilike } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

const router = express.Router();

// ============================================================
// SERVICE REQUESTS
// ============================================================

// GET /api/service-requests — List all open service requests
router.get('/', async (req, res) => {
  try {
    const { status = 'open', instrument, limit = '50', offset = '0' } = req.query;
    
    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(serviceRequests.status, status as string));
    if (instrument && instrument !== 'all') conditions.push(eq(serviceRequests.instrumentNeeded, instrument as string));

    const results = await db
      .select({
        request: serviceRequests,
        userName: users.artistName,
        userImage: users.profileImage,
      })
      .from(serviceRequests)
      .leftJoin(users, eq(serviceRequests.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(serviceRequests.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching service requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch service requests' });
  }
});

// GET /api/service-requests/my — Get current user's requests
router.get('/my', async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const results = await db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.userId, userId))
      .orderBy(desc(serviceRequests.createdAt));

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error fetching my service requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch your requests' });
  }
});

// POST /api/service-requests — Create a new service request
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const validatedData = insertServiceRequestSchema.parse({
      ...req.body,
      userId,
      expiresAt: req.body.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
    });

    const [newRequest] = await db
      .insert(serviceRequests)
      .values(validatedData)
      .returning();

    // Notify musicians that match the instrument
    const matchingMusicians = await db
      .select({ id: musicians.id, userId: musicians.userId, name: musicians.name })
      .from(musicians)
      .where(and(
        eq(musicians.isActive, true),
        ilike(musicians.category, validatedData.instrumentNeeded)
      ));

    // Create notifications for matching musicians that have linked user accounts
    for (const m of matchingMusicians) {
      if (m.userId) {
        await db.insert(notifications).values({
          userId: m.userId,
          type: 'SERVICE_REQUEST_NEW',
          title: `New ${validatedData.instrumentNeeded} gig available!`,
          message: `${validatedData.title} — Budget: $${validatedData.budgetMin}-$${validatedData.budgetMax}`,
          link: `/producer-tools?tab=bids&request=${newRequest.id}`,
          metadata: { requestId: newRequest.id, instrument: validatedData.instrumentNeeded },
        });
      }
    }

    res.status(201).json({ success: true, data: newRequest });
  } catch (error) {
    console.error('Error creating service request:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to create service request' });
  }
});

// GET /api/service-requests/:id — Get request with bids
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [request] = await db
      .select({
        request: serviceRequests,
        userName: users.artistName,
        userImage: users.profileImage,
      })
      .from(serviceRequests)
      .leftJoin(users, eq(serviceRequests.userId, users.id))
      .where(eq(serviceRequests.id, parseInt(id)));

    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });

    // Increment view count
    await db.update(serviceRequests)
      .set({ viewCount: sql`${serviceRequests.viewCount} + 1` })
      .where(eq(serviceRequests.id, parseInt(id)));

    // Get bids for this request
    const bids = await db
      .select({
        bid: serviceBids,
        musicianName: musicians.name,
        musicianPhoto: musicians.photo,
        musicianRating: musicians.rating,
        musicianCategory: musicians.category,
      })
      .from(serviceBids)
      .leftJoin(musicians, eq(serviceBids.musicianId, musicians.id))
      .where(eq(serviceBids.serviceRequestId, parseInt(id)))
      .orderBy(desc(serviceBids.createdAt));

    res.json({ success: true, data: { ...request, bids } });
  } catch (error) {
    console.error('Error fetching service request:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch request' });
  }
});

// PATCH /api/service-requests/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { id } = req.params;
    
    const [updated] = await db.update(serviceRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, parseInt(id)), eq(serviceRequests.userId, userId)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: 'Request not found or not yours' });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error cancelling request:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel request' });
  }
});

// ============================================================
// BIDS
// ============================================================

// POST /api/service-requests/:id/bids — Submit a bid
router.post('/:id/bids', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const requestId = parseInt(req.params.id);

    // Check request exists and is open
    const [request] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, requestId));
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'open') return res.status(400).json({ success: false, error: 'Request is no longer open' });

    const validatedData = insertServiceBidSchema.parse({
      ...req.body,
      serviceRequestId: requestId,
      userId,
    });

    const [newBid] = await db.insert(serviceBids).values(validatedData).returning();

    // Update bid count
    await db.update(serviceRequests)
      .set({ totalBids: sql`${serviceRequests.totalBids} + 1`, updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId));

    // Notify the request owner about the new bid
    const musician = await db.select({ name: musicians.name }).from(musicians)
      .where(eq(musicians.id, validatedData.musicianId)).limit(1);

    await db.insert(notifications).values({
      userId: request.userId,
      type: 'BID_RECEIVED',
      title: 'New bid received!',
      message: `${musician[0]?.name || 'A musician'} bid $${validatedData.amount} on "${request.title}"`,
      link: `/producer-tools?tab=bids&request=${requestId}`,
      metadata: { requestId, bidId: newBid.id, amount: Number(validatedData.amount) },
    });

    res.status(201).json({ success: true, data: newBid });
  } catch (error) {
    console.error('Error creating bid:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ success: false, error: 'Failed to submit bid' });
  }
});

// PATCH /api/service-requests/:id/bids/:bidId/accept — Accept a bid
router.patch('/:id/bids/:bidId/accept', async (req, res) => {
  try {
    const userId = (req as any).userId;
    const requestId = parseInt(req.params.id);
    const bidId = parseInt(req.params.bidId);

    // Verify ownership
    const [request] = await db.select().from(serviceRequests)
      .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.userId, userId)));
    if (!request) return res.status(404).json({ success: false, error: 'Request not found or not yours' });

    // Accept the bid
    const [acceptedBid] = await db.update(serviceBids)
      .set({ status: 'accepted', respondedAt: new Date(), updatedAt: new Date() })
      .where(eq(serviceBids.id, bidId))
      .returning();

    if (!acceptedBid) return res.status(404).json({ success: false, error: 'Bid not found' });

    // Reject all other bids
    await db.update(serviceBids)
      .set({ status: 'rejected', respondedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(serviceBids.serviceRequestId, requestId),
        sql`${serviceBids.id} != ${bidId}`
      ));

    // Update request status
    await db.update(serviceRequests)
      .set({ status: 'in_progress', selectedBidId: bidId, updatedAt: new Date() })
      .where(eq(serviceRequests.id, requestId));

    // Notify the winning musician
    if (acceptedBid.userId) {
      await db.insert(notifications).values({
        userId: acceptedBid.userId,
        type: 'BID_ACCEPTED',
        title: 'Your bid was accepted! 🎉',
        message: `Your bid of $${acceptedBid.amount} for "${request.title}" was accepted!`,
        link: `/producer-tools?tab=bids&request=${requestId}`,
        metadata: { requestId, bidId },
      });
    }

    res.json({ success: true, data: acceptedBid });
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ success: false, error: 'Failed to accept bid' });
  }
});

// ============================================================
// MUSICIAN PROFILES (extended) & MAP DATA
// ============================================================

// GET /api/service-requests/map/data — Get data for the real-time map
router.get('/map/data', async (req, res) => {
  try {
    // Get active requests with location
    const activeRequests = await db
      .select({
        id: serviceRequests.id,
        title: serviceRequests.title,
        instrumentNeeded: serviceRequests.instrumentNeeded,
        budgetMin: serviceRequests.budgetMin,
        budgetMax: serviceRequests.budgetMax,
        latitude: serviceRequests.latitude,
        longitude: serviceRequests.longitude,
        city: serviceRequests.city,
        urgency: serviceRequests.urgency,
        totalBids: serviceRequests.totalBids,
        createdAt: serviceRequests.createdAt,
        userName: users.artistName,
      })
      .from(serviceRequests)
      .leftJoin(users, eq(serviceRequests.userId, users.id))
      .where(eq(serviceRequests.status, 'open'));

    // Get available musicians with location
    const availableMusicians = await db
      .select({
        musicianId: musicians.id,
        name: musicians.name,
        photo: musicians.photo,
        instrument: musicians.instrument,
        category: musicians.category,
        price: musicians.price,
        rating: musicians.rating,
        latitude: musicianProfiles.latitude,
        longitude: musicianProfiles.longitude,
        city: musicianProfiles.city,
        isVerified: musicianProfiles.isVerified,
        completedJobs: musicianProfiles.completedJobs,
      })
      .from(musicians)
      .leftJoin(musicianProfiles, eq(musicians.id, musicianProfiles.musicianId))
      .where(eq(musicians.isActive, true));

    res.json({
      success: true,
      data: {
        requests: activeRequests.filter(r => r.latitude && r.longitude),
        musicians: availableMusicians.filter(m => m.latitude && m.longitude),
      }
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch map data' });
  }
});

// ============================================================
// ADMIN: MUSICIAN IMPORTS
// ============================================================

// POST /api/service-requests/admin/musicians/import — Bulk import musicians
router.post('/admin/musicians/import', async (req, res) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { musicians: musiciansList, source = 'json' } = req.body;
    
    if (!Array.isArray(musiciansList) || musiciansList.length === 0) {
      return res.status(400).json({ success: false, error: 'No musicians data provided' });
    }

    const batchId = crypto.randomUUID();
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Create import log
    await db.insert(musicianImports).values({
      batchId,
      importedBy: userId,
      source: source as any,
      totalRecords: musiciansList.length,
      status: 'processing',
    });

    for (let i = 0; i < musiciansList.length; i++) {
      try {
        const m = musiciansList[i];
        
        // Insert musician
        const [newMusician] = await db.insert(musicians).values({
          name: m.name,
          photo: m.photo || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop',
          instrument: m.instrument,
          category: m.category || m.instrument,
          description: m.description || `Professional ${m.instrument} player`,
          price: String(m.price || 100),
          rating: String(m.rating || 4.5),
          genres: m.genres || ['Pop', 'Rock'],
          isActive: true,
        }).returning();

        // Create extended profile if location data exists
        if (m.city || m.latitude) {
          await db.insert(musicianProfiles).values({
            musicianId: newMusician.id,
            city: m.city,
            country: m.country,
            latitude: m.latitude ? String(m.latitude) : null,
            longitude: m.longitude ? String(m.longitude) : null,
            bio: m.bio,
            yearsExperience: m.yearsExperience,
            portfolioUrl: m.portfolioUrl,
            instagramUrl: m.instagramUrl,
            importSource: source,
            importBatchId: batchId,
          });
        }

        successCount++;
      } catch (err: any) {
        errorCount++;
        errors.push({ row: i + 1, error: err.message || 'Unknown error' });
      }
    }

    // Update import log
    await db.update(musicianImports)
      .set({
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : null,
        status: errorCount === musiciansList.length ? 'failed' : 'completed',
        completedAt: new Date(),
      })
      .where(eq(musicianImports.batchId, batchId));

    res.json({
      success: true,
      data: { batchId, total: musiciansList.length, imported: successCount, errors: errorCount, errorDetails: errors }
    });
  } catch (error) {
    console.error('Error importing musicians:', error);
    res.status(500).json({ success: false, error: 'Failed to import musicians' });
  }
});

// GET /api/service-requests/admin/musicians/imports — Get import history
router.get('/admin/musicians/imports', async (req, res) => {
  try {
    const imports = await db.select().from(musicianImports).orderBy(desc(musicianImports.createdAt)).limit(50);
    res.json({ success: true, data: imports });
  } catch (error) {
    console.error('Error fetching imports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch import history' });
  }
});

// GET /api/service-requests/admin/musicians/stats — Dashboard stats
router.get('/admin/musicians/stats', async (req, res) => {
  try {
    const [totalMusicians] = await db.select({ count: sql<number>`count(*)` }).from(musicians);
    const [activeMusicians] = await db.select({ count: sql<number>`count(*)` }).from(musicians).where(eq(musicians.isActive, true));
    const [verifiedMusicians] = await db.select({ count: sql<number>`count(*)` }).from(musicianProfiles).where(eq(musicianProfiles.isVerified, true));
    const [totalRequests] = await db.select({ count: sql<number>`count(*)` }).from(serviceRequests);
    const [openRequests] = await db.select({ count: sql<number>`count(*)` }).from(serviceRequests).where(eq(serviceRequests.status, 'open'));
    const [totalBids] = await db.select({ count: sql<number>`count(*)` }).from(serviceBids);

    // Musicians by category
    const byCategory = await db
      .select({ category: musicians.category, count: sql<number>`count(*)` })
      .from(musicians)
      .groupBy(musicians.category);

    res.json({
      success: true,
      data: {
        totalMusicians: Number(totalMusicians.count),
        activeMusicians: Number(activeMusicians.count),
        verifiedMusicians: Number(verifiedMusicians.count),
        totalRequests: Number(totalRequests.count),
        openRequests: Number(openRequests.count),
        totalBids: Number(totalBids.count),
        byCategory,
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// PATCH /api/service-requests/admin/musicians/:id/verify — Verify a musician
router.patch('/admin/musicians/:id/verify', async (req, res) => {
  try {
    const musicianId = parseInt(req.params.id);
    
    const [existing] = await db.select().from(musicianProfiles)
      .where(eq(musicianProfiles.musicianId, musicianId));

    if (existing) {
      await db.update(musicianProfiles)
        .set({ isVerified: true, verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(musicianProfiles.musicianId, musicianId));
    } else {
      await db.insert(musicianProfiles).values({
        musicianId,
        isVerified: true,
        verifiedAt: new Date(),
      });
    }

    res.json({ success: true, message: 'Musician verified' });
  } catch (error) {
    console.error('Error verifying musician:', error);
    res.status(500).json({ success: false, error: 'Failed to verify musician' });
  }
});

export default router;
