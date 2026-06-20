/**
 * BOOSTIFY AUTONOMOUS ECOSYSTEM - API Routes
 * Endpoints for the autonomous AI artist ecosystem
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  aiCollaborations, 
  aiBeefs, 
  aiEconomicDecisions, 
  aiArtistTreasury,
  aiGeneratedMusic,
  aiArtistEvolution,
  platformRevenue,
  artistPersonality,
  users
} from '../../db/schema';
import { eq, desc, sql, and, or, gt } from 'drizzle-orm';

const router = Router();

// ============================================
// ECOSYSTEM DASHBOARD
// ============================================

/**
 * Get ecosystem overview stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalArtists,
      activeCollabs,
      activeBeefs,
      totalSongs,
      platformEarnings
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(artistPersonality),
      db.select({ count: sql<number>`count(*)` }).from(aiCollaborations)
        .where(or(
          eq(aiCollaborations.status, 'proposed'),
          eq(aiCollaborations.status, 'negotiating'),
          eq(aiCollaborations.status, 'in_progress')
        )),
      db.select({ count: sql<number>`count(*)` }).from(aiBeefs)
        .where(or(
          eq(aiBeefs.status, 'brewing'),
          eq(aiBeefs.status, 'active'),
          eq(aiBeefs.status, 'escalating')
        )),
      db.select({ count: sql<number>`count(*)` }).from(aiGeneratedMusic),
      db.select({ total: sql<number>`COALESCE(SUM(amount::numeric), 0)` }).from(platformRevenue),
    ]);

    res.json({
      success: true,
      stats: {
        totalArtists: Number(totalArtists[0]?.count || 0),
        activeCollaborations: Number(activeCollabs[0]?.count || 0),
        activeBeefs: Number(activeBeefs[0]?.count || 0),
        totalSongsGenerated: Number(totalSongs[0]?.count || 0),
        platformEarnings: parseFloat(platformEarnings[0]?.total?.toString() || '0'),
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching stats:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// COLLABORATIONS
// ============================================

/**
 * Get all collaborations
 */
router.get('/collaborations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    let query = db
      .select({
        id: aiCollaborations.id,
        title: aiCollaborations.title,
        description: aiCollaborations.description,
        collaborationType: aiCollaborations.collaborationType,
        status: aiCollaborations.status,
        initiatorId: aiCollaborations.initiatorId,
        targetId: aiCollaborations.targetId,
        hypeScore: aiCollaborations.hypeScore,
        createdAt: aiCollaborations.createdAt,
      })
      .from(aiCollaborations)
      .orderBy(desc(aiCollaborations.createdAt))
      .limit(limit);

    const collabs = await query;

    // Enrich with artist names
    const enrichedCollabs = await Promise.all(
      collabs.map(async (collab) => {
        const [initiator, target] = await Promise.all([
          db.select({ name: users.artistName, image: users.profileImage })
            .from(users).where(eq(users.id, collab.initiatorId)).limit(1),
          db.select({ name: users.artistName, image: users.profileImage })
            .from(users).where(eq(users.id, collab.targetId)).limit(1),
        ]);
        return {
          ...collab,
          initiator: initiator[0] || { name: 'Unknown', image: null },
          target: target[0] || { name: 'Unknown', image: null },
        };
      })
    );

    res.json({ success: true, collaborations: enrichedCollabs });
  } catch (error) {
    console.error('[Ecosystem] Error fetching collaborations:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get collaboration details
 */
router.get('/collaborations/:id', async (req, res) => {
  try {
    const collab = await db
      .select()
      .from(aiCollaborations)
      .where(eq(aiCollaborations.id, parseInt(req.params.id)))
      .limit(1);

    if (!collab[0]) {
      return res.status(404).json({ success: false, error: 'Collaboration not found' });
    }

    const [initiator, target] = await Promise.all([
      db.select({ name: users.artistName, image: users.profileImage, genre: users.genre })
        .from(users).where(eq(users.id, collab[0].initiatorId)).limit(1),
      db.select({ name: users.artistName, image: users.profileImage, genre: users.genre })
        .from(users).where(eq(users.id, collab[0].targetId)).limit(1),
    ]);

    res.json({
      success: true,
      collaboration: {
        ...collab[0],
        initiator: initiator[0],
        target: target[0],
      },
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching collaboration:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// BEEFS / DRAMA
// ============================================

/**
 * Get all beefs
 */
router.get('/beefs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    const beefs = await db
      .select({
        id: aiBeefs.id,
        title: aiBeefs.title,
        description: aiBeefs.description,
        beefType: aiBeefs.beefType,
        status: aiBeefs.status,
        intensity: aiBeefs.intensity,
        publicInterest: aiBeefs.publicInterest,
        instigatorId: aiBeefs.instigatorId,
        targetId: aiBeefs.targetId,
        createdAt: aiBeefs.createdAt,
      })
      .from(aiBeefs)
      .orderBy(desc(aiBeefs.publicInterest))
      .limit(limit);

    // Enrich with artist names
    const enrichedBeefs = await Promise.all(
      beefs.map(async (beef) => {
        const [instigator, target] = await Promise.all([
          db.select({ name: users.artistName, image: users.profileImage })
            .from(users).where(eq(users.id, beef.instigatorId)).limit(1),
          db.select({ name: users.artistName, image: users.profileImage })
            .from(users).where(eq(users.id, beef.targetId)).limit(1),
        ]);
        return {
          ...beef,
          instigator: instigator[0] || { name: 'Unknown', image: null },
          target: target[0] || { name: 'Unknown', image: null },
        };
      })
    );

    res.json({ success: true, beefs: enrichedBeefs });
  } catch (error) {
    console.error('[Ecosystem] Error fetching beefs:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get beef details with full timeline
 */
router.get('/beefs/:id', async (req, res) => {
  try {
    const beef = await db
      .select()
      .from(aiBeefs)
      .where(eq(aiBeefs.id, parseInt(req.params.id)))
      .limit(1);

    if (!beef[0]) {
      return res.status(404).json({ success: false, error: 'Beef not found' });
    }

    const [instigator, target] = await Promise.all([
      db.select({ name: users.artistName, image: users.profileImage, genre: users.genre })
        .from(users).where(eq(users.id, beef[0].instigatorId)).limit(1),
      db.select({ name: users.artistName, image: users.profileImage, genre: users.genre })
        .from(users).where(eq(users.id, beef[0].targetId)).limit(1),
    ]);

    // Get related diss tracks
    const dissTrackIds = (beef[0].dissTrackIds as number[]) || [];
    const dissTracks = dissTrackIds.length > 0 
      ? await db.select().from(aiGeneratedMusic).where(sql`${aiGeneratedMusic.id} = ANY(${dissTrackIds})`)
      : [];

    res.json({
      success: true,
      beef: {
        ...beef[0],
        instigator: instigator[0],
        target: target[0],
        dissTracks,
      },
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching beef:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// ECONOMY
// ============================================

/**
 * Get treasury leaderboard
 */
router.get('/economy/leaderboard', async (req, res) => {
  try {
    const treasuries = await db
      .select({
        artistId: aiArtistTreasury.artistId,
        totalPortfolioValue: aiArtistTreasury.totalPortfolioValue,
        usdBalance: aiArtistTreasury.usdBalance,
        streamingRevenue: aiArtistTreasury.streamingRevenue,
        investmentStrategy: aiArtistTreasury.investmentStrategy,
      })
      .from(aiArtistTreasury)
      .orderBy(desc(aiArtistTreasury.totalPortfolioValue))
      .limit(20);

    const enriched = await Promise.all(
      treasuries.map(async (t) => {
        const artist = await db
          .select({ name: users.artistName, image: users.profileImage })
          .from(users)
          .where(eq(users.id, t.artistId))
          .limit(1);
        return {
          ...t,
          artistName: artist[0]?.name || 'Unknown',
          artistImage: artist[0]?.image,
        };
      })
    );

    res.json({ success: true, leaderboard: enriched });
  } catch (error) {
    console.error('[Ecosystem] Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get artist treasury
 */
router.get('/economy/treasury/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);
    
    const treasury = await db
      .select()
      .from(aiArtistTreasury)
      .where(eq(aiArtistTreasury.artistId, artistId))
      .limit(1);

    if (!treasury[0]) {
      return res.status(404).json({ success: false, error: 'Treasury not found' });
    }

    // Get recent decisions
    const recentDecisions = await db
      .select()
      .from(aiEconomicDecisions)
      .where(eq(aiEconomicDecisions.artistId, artistId))
      .orderBy(desc(aiEconomicDecisions.createdAt))
      .limit(10);

    res.json({
      success: true,
      treasury: treasury[0],
      recentDecisions,
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching treasury:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get platform revenue stats
 */
router.get('/economy/platform-revenue', async (req, res) => {
  try {
    const revenueByType = await db
      .select({
        revenueType: platformRevenue.revenueType,
        total: sql<number>`SUM(amount::numeric)`,
        count: sql<number>`count(*)`,
      })
      .from(platformRevenue)
      .groupBy(platformRevenue.revenueType);

    const totalRevenue = revenueByType.reduce(
      (sum, r) => sum + parseFloat(r.total?.toString() || '0'),
      0
    );

    const recentRevenue = await db
      .select()
      .from(platformRevenue)
      .orderBy(desc(platformRevenue.createdAt))
      .limit(20);

    res.json({
      success: true,
      totalRevenue,
      byType: revenueByType,
      recent: recentRevenue,
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching platform revenue:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// AI GENERATED MUSIC
// ============================================

/**
 * Get AI generated music
 */
router.get('/music', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const artistId = req.query.artistId ? parseInt(req.query.artistId as string) : undefined;

    let query = db
      .select({
        id: aiGeneratedMusic.id,
        title: aiGeneratedMusic.title,
        description: aiGeneratedMusic.description,
        genre: aiGeneratedMusic.genre,
        mood: aiGeneratedMusic.mood,
        coverArtUrl: aiGeneratedMusic.coverArtUrl,
        audioUrl: aiGeneratedMusic.audioUrl,
        status: aiGeneratedMusic.status,
        isPublished: aiGeneratedMusic.isPublished,
        isDissTrack: aiGeneratedMusic.isDissTrack,
        plays: aiGeneratedMusic.plays,
        likes: aiGeneratedMusic.likes,
        artistId: aiGeneratedMusic.artistId,
        createdAt: aiGeneratedMusic.createdAt,
      })
      .from(aiGeneratedMusic)
      .orderBy(desc(aiGeneratedMusic.createdAt))
      .limit(limit);

    const songs = await query;

    const enriched = await Promise.all(
      songs.map(async (song) => {
        const artist = await db
          .select({ name: users.artistName, image: users.profileImage })
          .from(users)
          .where(eq(users.id, song.artistId))
          .limit(1);
        return {
          ...song,
          artistName: artist[0]?.name || 'Unknown',
          artistImage: artist[0]?.image,
        };
      })
    );

    res.json({ success: true, music: enriched });
  } catch (error) {
    console.error('[Ecosystem] Error fetching music:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Get song details
 */
router.get('/music/:id', async (req, res) => {
  try {
    const song = await db
      .select()
      .from(aiGeneratedMusic)
      .where(eq(aiGeneratedMusic.id, parseInt(req.params.id)))
      .limit(1);

    if (!song[0]) {
      return res.status(404).json({ success: false, error: 'Song not found' });
    }

    const artist = await db
      .select({ name: users.artistName, image: users.profileImage, genre: users.genre })
      .from(users)
      .where(eq(users.id, song[0].artistId))
      .limit(1);

    res.json({
      success: true,
      song: {
        ...song[0],
        artist: artist[0],
      },
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching song:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// ARTIST EVOLUTION
// ============================================

/**
 * Get artist evolution timeline
 */
router.get('/evolution/:artistId', async (req, res) => {
  try {
    const artistId = parseInt(req.params.artistId);

    const evolution = await db
      .select()
      .from(aiArtistEvolution)
      .where(eq(aiArtistEvolution.artistId, artistId))
      .orderBy(desc(aiArtistEvolution.createdAt))
      .limit(50);

    const artist = await db
      .select({ name: users.artistName, image: users.profileImage, genre: users.genre })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);

    res.json({
      success: true,
      artist: artist[0],
      evolution,
    });
  } catch (error) {
    console.error('[Ecosystem] Error fetching evolution:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ============================================
// ACTIVITY FEED
// ============================================

/**
 * Get ecosystem activity feed
 */
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 30;
    const activities: any[] = [];

    // Get recent collaborations
    const collabs = await db
      .select({
        id: aiCollaborations.id,
        type: sql`'collaboration'`,
        title: aiCollaborations.title,
        status: aiCollaborations.status,
        artistId: aiCollaborations.initiatorId,
        createdAt: aiCollaborations.createdAt,
      })
      .from(aiCollaborations)
      .orderBy(desc(aiCollaborations.createdAt))
      .limit(10);

    // Get recent beefs
    const beefs = await db
      .select({
        id: aiBeefs.id,
        type: sql`'beef'`,
        title: aiBeefs.title,
        status: aiBeefs.status,
        artistId: aiBeefs.instigatorId,
        createdAt: aiBeefs.createdAt,
      })
      .from(aiBeefs)
      .orderBy(desc(aiBeefs.createdAt))
      .limit(10);

    // Get recent songs
    const songs = await db
      .select({
        id: aiGeneratedMusic.id,
        type: sql`'music'`,
        title: aiGeneratedMusic.title,
        status: aiGeneratedMusic.status,
        artistId: aiGeneratedMusic.artistId,
        createdAt: aiGeneratedMusic.createdAt,
      })
      .from(aiGeneratedMusic)
      .where(eq(aiGeneratedMusic.isPublished, true))
      .orderBy(desc(aiGeneratedMusic.createdAt))
      .limit(10);

    // Get recent economic decisions
    const decisions = await db
      .select({
        id: aiEconomicDecisions.id,
        type: sql`'economy'`,
        title: aiEconomicDecisions.decisionType,
        status: aiEconomicDecisions.status,
        artistId: aiEconomicDecisions.artistId,
        createdAt: aiEconomicDecisions.createdAt,
      })
      .from(aiEconomicDecisions)
      .where(eq(aiEconomicDecisions.status, 'completed'))
      .orderBy(desc(aiEconomicDecisions.createdAt))
      .limit(10);

    // Combine and sort
    const allActivities = [...collabs, ...beefs, ...songs, ...decisions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    // Enrich with artist info
    const enrichedActivities = await Promise.all(
      allActivities.map(async (activity) => {
        const artist = await db
          .select({ name: users.artistName, image: users.profileImage })
          .from(users)
          .where(eq(users.id, activity.artistId))
          .limit(1);
        return {
          ...activity,
          artistName: artist[0]?.name || 'Unknown',
          artistImage: artist[0]?.image,
        };
      })
    );

    res.json({ success: true, activities: enrichedActivities });
  } catch (error) {
    console.error('[Ecosystem] Error fetching activity:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
