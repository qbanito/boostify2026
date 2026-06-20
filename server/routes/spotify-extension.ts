import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { spotifyExtensionConnections, spotifyProfileSnapshots, spotifyPendingActions, spotifyExtractedProfiles, users } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// Generate a connection token
router.post('/generate-connect-token', async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId;
    if (!userId && userId !== 0) return res.status(400).json({ error: 'userId required' });
    const numericId = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    if (isNaN(numericId) || numericId <= 0) return res.status(400).json({ error: 'Invalid userId' });

    // Validate user exists
    const [user] = await db.select().from(users).where(eq(users.id, numericId)).limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');

    const existing = await db.select().from(spotifyExtensionConnections).where(eq(spotifyExtensionConnections.userId, numericId)).limit(1);

    if (existing.length > 0) {
      await db.update(spotifyExtensionConnections)
        .set({ syncToken: token, status: 'active', lastSyncAt: new Date() })
        .where(eq(spotifyExtensionConnections.id, existing[0].id));
      return res.json({ token, connectionId: existing[0].id, isReconnect: true });
    }

    const [conn] = await db.insert(spotifyExtensionConnections)
      .values({ userId: numericId, syncToken: token, status: 'active' })
      .returning();

    res.json({ token, connectionId: conn.id, isReconnect: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Verify sync token helper
async function verifySyncToken(req: Request) {
  const token = req.headers['x-sync-token'] as string || req.body?.syncToken;
  if (!token) return null;
  const [conn] = await db.select().from(spotifyExtensionConnections)
    .where(and(eq(spotifyExtensionConnections.syncToken, token), eq(spotifyExtensionConnections.status, 'active')));
  return conn || null;
}

// Connection status
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const uid = parseInt(req.params.userId, 10);
    const [conn] = await db.select().from(spotifyExtensionConnections).where(eq(spotifyExtensionConnections.userId, uid));
    if (!conn) return res.json({ connected: false });

    const snapshots = await db.select().from(spotifyProfileSnapshots)
      .where(eq(spotifyProfileSnapshots.connectionId, conn.id))
      .orderBy(desc(spotifyProfileSnapshots.snapshotAt))
      .limit(30);

    res.json({ connected: true, connection: conn, snapshots });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sync stats from extension
router.post('/sync-stats', async (req: Request, res: Response) => {
  try {
    const conn = await verifySyncToken(req);
    if (!conn) return res.status(401).json({ error: 'Invalid sync token' });

    const { monthlyListeners, followers, playlistCount, totalStreams, topCities, popularity, spotifyUsername, displayName, spotifyImageUrl } = req.body;

    // Update connection
    const updateData: any = { lastSyncAt: new Date() };
    if (monthlyListeners !== undefined) updateData.monthlyListeners = monthlyListeners;
    if (followers !== undefined) updateData.followers = followers;
    if (playlistCount !== undefined) updateData.playlistCount = playlistCount;
    if (totalStreams !== undefined) updateData.totalStreams = totalStreams;
    if (topCities) updateData.topCities = topCities;
    if (spotifyUsername) updateData.spotifyUsername = spotifyUsername;
    if (displayName) updateData.displayName = displayName;
    if (spotifyImageUrl) updateData.spotifyImageUrl = spotifyImageUrl;

    await db.update(spotifyExtensionConnections).set(updateData).where(eq(spotifyExtensionConnections.id, conn.id));

    // Create snapshot
    const [snapshot] = await db.insert(spotifyProfileSnapshots).values({
      connectionId: conn.id,
      monthlyListeners: monthlyListeners || 0,
      followers: followers || 0,
      playlistCount: playlistCount || 0,
      totalStreams: totalStreams || 0,
      topCities: topCities || [],
      popularity: popularity || 0,
    }).returning();

    res.json({ success: true, snapshotId: snapshot.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Update username
router.post('/update-username', async (req: Request, res: Response) => {
  try {
    const conn = await verifySyncToken(req);
    if (!conn) return res.status(401).json({ error: 'Invalid sync token' });

    const { spotifyUsername, displayName, spotifyImageUrl } = req.body;
    const updateData: any = {};
    if (spotifyUsername) updateData.spotifyUsername = spotifyUsername;
    if (displayName) updateData.displayName = displayName;
    if (spotifyImageUrl) updateData.spotifyImageUrl = spotifyImageUrl;

    await db.update(spotifyExtensionConnections).set(updateData).where(eq(spotifyExtensionConnections.id, conn.id));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Pending actions
router.get('/pending-actions/:connectionId', async (req: Request, res: Response) => {
  try {
    const connId = parseInt(req.params.connectionId, 10);
    const actions = await db.select().from(spotifyPendingActions)
      .where(and(eq(spotifyPendingActions.connectionId, connId), eq(spotifyPendingActions.status, 'pending')))
      .orderBy(desc(spotifyPendingActions.createdAt))
      .limit(20);
    res.json(actions);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Create action
router.post('/create-action', async (req: Request, res: Response) => {
  try {
    const conn = await verifySyncToken(req);
    if (!conn) return res.status(401).json({ error: 'Invalid sync token' });

    const { actionType, payload } = req.body;
    const [action] = await db.insert(spotifyPendingActions).values({
      connectionId: conn.id, actionType, payload: payload || {},
    }).returning();

    res.json({ success: true, actionId: action.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Save extracted profiles
router.post('/save-extraction', async (req: Request, res: Response) => {
  try {
    const conn = await verifySyncToken(req);
    if (!conn) {
      // Try web-auth fallback
      const userId = req.body.userId;
      if (!userId) return res.status(401).json({ error: 'Auth required' });
    }

    const { profiles, extractType, extractQuery, connectionId: bodyConnId } = req.body;
    const connId = conn?.id || bodyConnId;
    if (!connId || !profiles || !Array.isArray(profiles)) {
      return res.status(400).json({ error: 'connectionId and profiles[] required' });
    }

    const sanitized = profiles.slice(0, 5000).map((p: any) => ({
      connectionId: connId,
      extractType: extractType || 'unknown',
      extractQuery: extractQuery?.substring(0, 500),
      username: p.username?.substring(0, 200),
      displayName: p.displayName?.substring(0, 200),
      profilePicUrl: p.profilePicUrl?.substring(0, 500),
      profileUrl: p.profileUrl?.substring(0, 500),
      email: p.email?.substring(0, 200),
      followerCount: p.followerCount || null,
      monthlyListeners: p.monthlyListeners || null,
      playlistName: p.playlistName?.substring(0, 300),
      playlistUrl: p.playlistUrl?.substring(0, 500),
      playlistFollowers: p.playlistFollowers || null,
      genres: p.genres || [],
      isVerified: p.isVerified || false,
      isCurator: p.isCurator || false,
      bio: p.bio?.substring(0, 2000),
      isEnriched: p.isEnriched || false,
    }));

    if (sanitized.length > 0) {
      await db.insert(spotifyExtractedProfiles).values(sanitized);
    }

    res.json({ success: true, saved: sanitized.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Web-accessible endpoints (for frontend, uses userId instead of sync token)
router.get('/web/extractions', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string, 10);
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const [conn] = await db.select().from(spotifyExtensionConnections).where(eq(spotifyExtensionConnections.userId, userId));
    if (!conn) return res.json([]);

    const profiles = await db.select().from(spotifyExtractedProfiles)
      .where(eq(spotifyExtractedProfiles.connectionId, conn.id))
      .orderBy(desc(spotifyExtractedProfiles.extractedAt))
      .limit(500);

    res.json(profiles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/web/extracted-profiles', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string, 10);
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const [conn] = await db.select().from(spotifyExtensionConnections).where(eq(spotifyExtensionConnections.userId, userId));
    if (!conn) return res.json({ profiles: [], total: 0 });

    const profiles = await db.select().from(spotifyExtractedProfiles)
      .where(eq(spotifyExtractedProfiles.connectionId, conn.id))
      .orderBy(desc(spotifyExtractedProfiles.extractedAt))
      .limit(1000);

    res.json({ profiles, total: profiles.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
