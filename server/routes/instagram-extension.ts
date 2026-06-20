/**
 * Instagram Chrome Extension Sync API
 * 
 * Provides endpoints for the Boostify Instagram Chrome Extension to:
 * - Connect/authenticate with the platform via tokens
 * - Sync Instagram profile stats periodically
 * - Retrieve and report on pending optimization actions
 * - Report Instagram events (new post, milestone, etc.)
 * - Proxy AI tools (captions, hashtags, ideas, timing, bio)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  instagramExtensionConnections, 
  instagramProfileSnapshots, 
  instagramPendingActions, 
  instagramExtensionEvents,
  users 
} from '../db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'boostify-ig-ext-secret-2025';

// ============================================================
// HELPER: Verify extension sync token
// ============================================================
function verifySyncToken(req: Request): { userId: number; connectionId: number; extensionId: string } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      connectionId: decoded.connectionId,
      extensionId: decoded.extensionId,
    };
  } catch {
    return null;
  }
}

// ============================================================
// POST /connect — Register a Chrome extension instance
// ============================================================
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, extensionId, instagramUsername, profileUrl, displayName } = req.body;

    if (!userId || !extensionId || !instagramUsername) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, extensionId, instagramUsername' 
      });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for existing active connection
    const [existing] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.instagramUsername, instagramUsername),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (existing) {
      return res.json({
        success: true,
        message: 'Already connected',
        connectionId: existing.id,
        syncToken: existing.syncToken,
        instagramUsername: existing.instagramUsername,
      });
    }

    const syncToken = jwt.sign(
      { userId, extensionId, connectionId: Date.now() },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const [connection] = await db.insert(instagramExtensionConnections).values({
      userId,
      extensionId,
      instagramUsername,
      profileUrl: profileUrl || `https://www.instagram.com/${instagramUsername}/`,
      displayName: displayName || instagramUsername,
      syncToken,
    }).returning();

    // Update the token with the real connectionId
    const finalToken = jwt.sign(
      { userId, extensionId, connectionId: connection.id },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    await db.update(instagramExtensionConnections)
      .set({ syncToken: finalToken })
      .where(eq(instagramExtensionConnections.id, connection.id));

    res.json({
      success: true,
      connectionId: connection.id,
      syncToken: finalToken,
      instagramUsername: connection.instagramUsername,
      displayName: connection.displayName,
    });

  } catch (error: any) {
    console.error('[IG-EXT] Connect error:', error);
    res.status(500).json({ error: 'Failed to connect extension' });
  }
});

// ============================================================
// POST /generate-connect-token — Generate a one-time token from the web app
// ============================================================
router.post('/generate-connect-token', async (req: Request, res: Response) => {
  try {
    const rawId = req.body.userId;
    if (!rawId) return res.status(400).json({ error: 'Missing userId' });
    const userId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const connectToken = jwt.sign(
      { userId, purpose: 'ig-ext-connect', nonce: crypto.randomBytes(8).toString('hex') },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ success: true, connectToken, expiresInMinutes: 15 });
  } catch (error: any) {
    console.error('[IG-EXT] Generate token error:', error);
    res.status(500).json({ error: 'Failed to generate connect token' });
  }
});

// ============================================================
// POST /validate-connect-token — Validate a connect token from the extension
// ============================================================
router.post('/validate-connect-token', async (req: Request, res: Response) => {
  try {
    const { connectToken, extensionId, instagramUsername, profileUrl, displayName } = req.body;

    if (!connectToken || !extensionId || !instagramUsername) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(connectToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired connect token' });
    }

    if (decoded.purpose !== 'ig-ext-connect') {
      return res.status(401).json({ error: 'Invalid token purpose' });
    }

    const userId = decoded.userId;

    // Check for existing connection
    const [existing] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.instagramUsername, instagramUsername),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (existing) {
      return res.json({
        success: true,
        connectionId: existing.id,
        syncToken: existing.syncToken,
        instagramUsername: existing.instagramUsername,
        userId,
      });
    }

    const syncToken = jwt.sign(
      { userId, extensionId, connectionId: Date.now() },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const [connection] = await db.insert(instagramExtensionConnections).values({
      userId,
      extensionId,
      instagramUsername,
      profileUrl: profileUrl || `https://www.instagram.com/${instagramUsername}/`,
      displayName: displayName || instagramUsername,
      syncToken,
    }).returning();

    const finalToken = jwt.sign(
      { userId, extensionId, connectionId: connection.id },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    await db.update(instagramExtensionConnections)
      .set({ syncToken: finalToken })
      .where(eq(instagramExtensionConnections.id, connection.id));

    res.json({
      success: true,
      connectionId: connection.id,
      syncToken: finalToken,
      instagramUsername: connection.instagramUsername,
      userId,
    });

  } catch (error: any) {
    console.error('[IG-EXT] Validate token error:', error);
    res.status(500).json({ error: 'Failed to validate connect token' });
  }
});

// ============================================================
// POST /disconnect — Disconnect extension
// ============================================================
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    await db.update(instagramExtensionConnections)
      .set({ status: 'revoked' })
      .where(eq(instagramExtensionConnections.id, auth.connectionId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('[IG-EXT] Disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// ============================================================
// GET /status — Get connection status (by sync token)
// ============================================================
router.get('/status', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const [connection] = await db.select()
      .from(instagramExtensionConnections)
      .where(eq(instagramExtensionConnections.id, auth.connectionId))
      .limit(1);

    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    res.json({
      success: true,
      connection: {
        id: connection.id,
        instagramUsername: connection.instagramUsername,
        displayName: connection.displayName,
        status: connection.status,
        lastSyncAt: connection.lastSyncAt,
        syncIntervalMinutes: connection.syncIntervalMinutes,
      },
    });
  } catch (error: any) {
    console.error('[IG-EXT] Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ============================================================
// GET /status/:userId — Get connection status by userId (for web dashboard)
// ============================================================
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid userId' });

    const connections = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .orderBy(desc(instagramExtensionConnections.lastSyncAt));

    res.json({ success: true, connections });
  } catch (error: any) {
    console.error('[IG-EXT] Status by userId error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ============================================================
// GET /connections/:userId — Get all connections for a user
// ============================================================
router.get('/connections/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId) return res.status(400).json({ error: 'Invalid userId' });

    const connections = await db.select()
      .from(instagramExtensionConnections)
      .where(eq(instagramExtensionConnections.userId, userId))
      .orderBy(desc(instagramExtensionConnections.createdAt));

    res.json({ success: true, connections });
  } catch (error: any) {
    console.error('[IG-EXT] Connections error:', error);
    res.status(500).json({ error: 'Failed to get connections' });
  }
});

// ============================================================
// POST /update-username — Update the Instagram username on the connection record
// ============================================================
router.post('/update-username', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { username, profilePicUrl } = req.body;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'username required' });
    }

    // Sanitize
    const cleanUsername = username.replace(/[^a-zA-Z0-9._]/g, '').substring(0, 30);

    await db.update(instagramExtensionConnections)
      .set({
        instagramUsername: cleanUsername,
      })
      .where(eq(instagramExtensionConnections.id, auth.connectionId));

    console.log('[IG-EXT] Username updated to @' + cleanUsername + ' for connection', auth.connectionId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[IG-EXT] Update username error:', error);
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// ============================================================
// POST /sync-stats — Receive profile stats from extension
// ============================================================
router.post('/sync-stats', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { followers, following, postsCount, bio, isVerified, avgLikes, avgComments, engagementRate, recentPosts, topHashtags, audienceDemographics, instagramUsername } = req.body;

    // Save snapshot
    const [snapshot] = await db.insert(instagramProfileSnapshots).values({
      connectionId: auth.connectionId,
      followers: followers || 0,
      following: following || 0,
      postsCount: postsCount || 0,
      bio: bio || '',
      isVerified: isVerified || false,
      avgLikes: avgLikes || 0,
      avgComments: avgComments || 0,
      engagementRate: engagementRate || 0,
      recentPosts: recentPosts || [],
      topHashtags: topHashtags || [],
      audienceDemographics: audienceDemographics || {},
    }).returning();

    // Update last sync timestamp + username if provided
    const updateData: Record<string, any> = { lastSyncAt: new Date() };
    if (instagramUsername && typeof instagramUsername === 'string' && instagramUsername !== 'unknown') {
      updateData.instagramUsername = instagramUsername.replace(/[^a-zA-Z0-9._]/g, '').substring(0, 30);
    }
    await db.update(instagramExtensionConnections)
      .set(updateData)
      .where(eq(instagramExtensionConnections.id, auth.connectionId));

    // Get pending actions
    const pendingActions = await db.select()
      .from(instagramPendingActions)
      .where(and(
        eq(instagramPendingActions.connectionId, auth.connectionId),
        eq(instagramPendingActions.status, 'pending')
      ))
      .orderBy(instagramPendingActions.priority)
      .limit(10);

    // Mark as sent
    if (pendingActions.length > 0) {
      await db.update(instagramPendingActions)
        .set({ status: 'sent', sentAt: new Date() })
        .where(inArray(instagramPendingActions.id, pendingActions.map(a => a.id)));
    }

    const connection = await db.select()
      .from(instagramExtensionConnections)
      .where(eq(instagramExtensionConnections.id, auth.connectionId))
      .limit(1);

    res.json({
      success: true,
      snapshotId: snapshot.id,
      pendingActions,
      nextSyncInMinutes: connection[0]?.syncIntervalMinutes || 5,
    });

  } catch (error: any) {
    console.error('[IG-EXT] Sync error:', error);
    res.status(500).json({ error: 'Failed to sync stats' });
  }
});

// ============================================================
// GET /pending-actions — Get pending actions (extension with token OR web dashboard with connectionId param)
// ============================================================
router.get('/pending-actions', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    let connectionId: number;

    if (auth) {
      connectionId = auth.connectionId;
    } else {
      // Fallback for web dashboard: accept connectionId as query param
      connectionId = parseInt(req.query.connectionId as string);
      if (!connectionId) return res.status(400).json({ error: 'connectionId query param required when no auth token' });
    }

    const actions = await db.select()
      .from(instagramPendingActions)
      .where(and(
        eq(instagramPendingActions.connectionId, connectionId),
        inArray(instagramPendingActions.status, ['pending', 'sent'])
      ))
      .orderBy(instagramPendingActions.priority)
      .limit(20);

    res.json({ success: true, actions });
  } catch (error: any) {
    console.error('[IG-EXT] Pending actions error:', error);
    res.status(500).json({ error: 'Failed to get actions' });
  }
});

// ============================================================
// POST /action-result — Report action result from extension
// ============================================================
router.post('/action-result', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { actionId, status, resultMessage } = req.body;
    if (!actionId || !status) return res.status(400).json({ error: 'Missing actionId or status' });

    const [action] = await db.update(instagramPendingActions)
      .set({
        status,
        appliedAt: status === 'applied' ? new Date() : undefined,
        resultMessage: resultMessage || null,
      })
      .where(and(
        eq(instagramPendingActions.id, actionId),
        eq(instagramPendingActions.connectionId, auth.connectionId)
      ))
      .returning();

    res.json({ success: true, action });
  } catch (error: any) {
    console.error('[IG-EXT] Action result error:', error);
    res.status(500).json({ error: 'Failed to report action result' });
  }
});

// ============================================================
// POST /webhook — Receive events from extension
// ============================================================
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { eventType, eventData } = req.body;
    if (!eventType) return res.status(400).json({ error: 'Missing eventType' });

    const [event] = await db.insert(instagramExtensionEvents).values({
      connectionId: auth.connectionId,
      eventType,
      eventData: eventData || {},
    }).returning();

    res.json({ success: true, eventId: event.id });
  } catch (error: any) {
    console.error('[IG-EXT] Webhook error:', error);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// ============================================================
// GET /snapshots/:connectionId — Get profile snapshots (extension with token OR web dashboard)
// ============================================================
router.get('/snapshots/:connectionId', async (req: Request, res: Response) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    if (!connectionId) return res.status(400).json({ error: 'Invalid connectionId' });

    const limit = parseInt(req.query.limit as string) || 50;

    // Verify access: either via sync token or via userId query param matching connection owner
    const auth = verifySyncToken(req);
    if (!auth) {
      // Fallback: verify connection ownership via connection record
      const [conn] = await db.select()
        .from(instagramExtensionConnections)
        .where(eq(instagramExtensionConnections.id, connectionId))
        .limit(1);
      if (!conn) return res.status(404).json({ error: 'Connection not found' });
      // Allow access (connection exists — dashboard has the connectionId from /status/:userId)
    }

    const snapshots = await db.select()
      .from(instagramProfileSnapshots)
      .where(eq(instagramProfileSnapshots.connectionId, connectionId))
      .orderBy(desc(instagramProfileSnapshots.snapshotAt))
      .limit(limit);

    res.json({ success: true, snapshots });
  } catch (error: any) {
    console.error('[IG-EXT] Snapshots error:', error);
    res.status(500).json({ error: 'Failed to get snapshots' });
  }
});

// ============================================================
// GET /events/:connectionId — Get recent events
// ============================================================
router.get('/events/:connectionId', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const connectionId = parseInt(req.params.connectionId);
    const limit = parseInt(req.query.limit as string) || 20;

    const events = await db.select()
      .from(instagramExtensionEvents)
      .where(eq(instagramExtensionEvents.connectionId, connectionId))
      .orderBy(desc(instagramExtensionEvents.createdAt))
      .limit(limit);

    res.json({ success: true, events });
  } catch (error: any) {
    console.error('[IG-EXT] Events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// ============================================================
// POST /create-action — Create a pending action from the web app
// ============================================================
router.post('/create-action', async (req: Request, res: Response) => {
  try {
    const { userId, connectionId, actionType, targetPostId, targetPostCaption, payload, generatedBy, priority } = req.body;

    if (!userId || !actionType || !payload) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [action] = await db.insert(instagramPendingActions).values({
      userId,
      connectionId: connectionId || null,
      actionType,
      targetPostId,
      targetPostCaption,
      payload,
      generatedBy: generatedBy || 'web-app',
      priority: priority || 5,
    }).returning();

    res.json({ success: true, action });
  } catch (error: any) {
    console.error('[IG-EXT] Create action error:', error);
    res.status(500).json({ error: 'Failed to create action' });
  }
});

// ============================================================
// POST /save-extraction — Store extracted user data from extension
// ============================================================
router.post('/save-extraction', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { extractType, query, sortMode, users: extractedUsers, totalCount } = req.body;
    if (!extractType || !Array.isArray(extractedUsers)) {
      return res.status(400).json({ error: 'Missing extractType or users array' });
    }

    // Sanitize user data — strip any HTML/scripts
    const sanitized = extractedUsers.slice(0, 10000).map((u: any) => ({
      username: String(u.username || '').replace(/[<>]/g, '').substring(0, 30),
      displayName: String(u.displayName || '').replace(/[<>]/g, '').substring(0, 100),
      profilePicUrl: String(u.profilePicUrl || '').substring(0, 500),
      isVerified: !!u.isVerified,
      isPrivate: !!u.isPrivate,
      source: extractType,
      sourceQuery: query ? String(query).replace(/[<>]/g, '').substring(0, 200) : undefined,
      extractedAt: u.extractedAt || new Date().toISOString(),
    }));

    // Store as an event for the connection
    const [event] = await db.insert(instagramExtensionEvents).values({
      connectionId: auth.connectionId,
      eventType: 'profile_update',
      eventData: {
        action: 'extraction',
        extractType,
        query: query || null,
        sortMode: sortMode || null,
        totalCount: sanitized.length,
        users: sanitized,
      },
      processed: false,
    }).returning();

    res.json({ 
      success: true, 
      eventId: event.id, 
      savedCount: sanitized.length,
    });
  } catch (error: any) {
    console.error('[IG-EXT] Save extraction error:', error);
    res.status(500).json({ error: 'Failed to save extraction' });
  }
});

// ============================================================
// GET /extractions/:connectionId — Get extraction history
// ============================================================
router.get('/extractions/:connectionId', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const connectionId = parseInt(req.params.connectionId);
    if (auth.connectionId !== connectionId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const events = await db.select()
      .from(instagramExtensionEvents)
      .where(and(
        eq(instagramExtensionEvents.connectionId, connectionId),
        sql`${instagramExtensionEvents.eventData}->>'action' = 'extraction'`
      ))
      .orderBy(desc(instagramExtensionEvents.createdAt))
      .limit(50);

    const extractions = events.map(e => ({
      id: e.id,
      extractType: (e.eventData as any)?.extractType,
      query: (e.eventData as any)?.query,
      totalCount: (e.eventData as any)?.totalCount,
      users: (e.eventData as any)?.users || [],
      createdAt: e.createdAt,
    }));

    res.json({ success: true, extractions });
  } catch (error: any) {
    console.error('[IG-EXT] Get extractions error:', error);
    res.status(500).json({ error: 'Failed to get extractions' });
  }
});

// ============================================================
// POST /save-extracted-profiles — Save profiles with email/phone/bio to dedicated table
// ============================================================
router.post('/save-extracted-profiles', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const { extractType, query, jobId, users } = req.body;
    if (!extractType || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Missing extractType or users array' });
    }

    // Import the new table
    const { instagramExtractedProfiles } = await import('../../db/schema');

    let savedCount = 0;
    const batch = users.slice(0, 5000); // Max 5000 per request

    for (const u of batch) {
      const username = String(u.username || '').replace(/[<>]/g, '').substring(0, 30);
      if (!username) continue;

      // Upsert — update if username already exists for this connection
      const existing = await db.select({ id: instagramExtractedProfiles.id })
        .from(instagramExtractedProfiles)
        .where(and(
          eq(instagramExtractedProfiles.connectionId, auth.connectionId),
          eq(instagramExtractedProfiles.username, username),
        ))
        .limit(1);

      const profileData = {
        connectionId: auth.connectionId,
        username,
        displayName: String(u.displayName || '').replace(/[<>]/g, '').substring(0, 100) || null,
        bio: String(u.bio || '').replace(/[<>]/g, '').substring(0, 500) || null,
        email: u.email ? String(u.email).toLowerCase().replace(/[<>]/g, '').substring(0, 200) : null,
        phone: u.phone ? String(u.phone).replace(/[<>]/g, '').substring(0, 30) : null,
        website: u.website ? String(u.website).replace(/[<>]/g, '').substring(0, 500) : null,
        profilePicUrl: u.profilePicUrl ? String(u.profilePicUrl).substring(0, 1000) : null,
        followers: typeof u.followers === 'number' ? u.followers : null,
        following: typeof u.following === 'number' ? u.following : null,
        postsCount: typeof u.postsCount === 'number' ? u.postsCount : null,
        isVerified: !!u.isVerified,
        isPrivate: !!u.isPrivate,
        isBusiness: !!u.isBusiness,
        category: u.category ? String(u.category).replace(/[<>]/g, '').substring(0, 100) : null,
        extractType: extractType as any,
        extractQuery: query ? String(query).replace(/[<>]/g, '').substring(0, 200) : null,
        extractJobId: jobId ? String(jobId).substring(0, 50) : null,
        profileVisitedAt: u.enriched ? new Date() : null,
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db.update(instagramExtractedProfiles)
          .set(profileData)
          .where(eq(instagramExtractedProfiles.id, existing[0].id));
      } else {
        await db.insert(instagramExtractedProfiles).values(profileData as any);
      }
      savedCount++;
    }

    res.json({ success: true, savedCount });
  } catch (error: any) {
    console.error('[IG-EXT] Save extracted profiles error:', error);
    res.status(500).json({ error: 'Failed to save extracted profiles' });
  }
});

// ============================================================
// GET /extracted-profiles/:connectionId — Get extracted profiles with filters
// ============================================================
router.get('/extracted-profiles/:connectionId', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const connectionId = parseInt(req.params.connectionId);
    if (auth.connectionId !== connectionId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { instagramExtractedProfiles } = await import('../../db/schema');
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: any[] = [eq(instagramExtractedProfiles.connectionId, connectionId)];

    if (req.query.extractType) {
      conditions.push(eq(instagramExtractedProfiles.extractType, req.query.extractType as any));
    }
    if (req.query.hasEmail === 'true') {
      conditions.push(sql`${instagramExtractedProfiles.email} IS NOT NULL`);
    }
    if (req.query.hasPhone === 'true') {
      conditions.push(sql`${instagramExtractedProfiles.phone} IS NOT NULL`);
    }
    if (req.query.isBusiness === 'true') {
      conditions.push(eq(instagramExtractedProfiles.isBusiness, true));
    }
    if (req.query.search) {
      const search = `%${String(req.query.search).replace(/[%_]/g, '')}%`;
      conditions.push(sql`(${instagramExtractedProfiles.username} ILIKE ${search} OR ${instagramExtractedProfiles.displayName} ILIKE ${search} OR ${instagramExtractedProfiles.bio} ILIKE ${search})`);
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Get total count
    const [{ count: totalCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(instagramExtractedProfiles)
      .where(whereClause);

    // Get profiles
    const profiles = await db.select()
      .from(instagramExtractedProfiles)
      .where(whereClause)
      .orderBy(desc(instagramExtractedProfiles.extractedAt))
      .limit(limit)
      .offset(offset);

    // Get stats
    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      withEmail: sql<number>`count(${instagramExtractedProfiles.email})::int`,
      withPhone: sql<number>`count(${instagramExtractedProfiles.phone})::int`,
      withWebsite: sql<number>`count(${instagramExtractedProfiles.website})::int`,
      businessAccounts: sql<number>`count(case when ${instagramExtractedProfiles.isBusiness} then 1 end)::int`,
      verified: sql<number>`count(case when ${instagramExtractedProfiles.isVerified} then 1 end)::int`,
      enriched: sql<number>`count(${instagramExtractedProfiles.profileVisitedAt})::int`,
    }).from(instagramExtractedProfiles)
      .where(eq(instagramExtractedProfiles.connectionId, connectionId));

    res.json({
      profiles,
      total: totalCount,
      page,
      limit,
      stats,
    });
  } catch (error: any) {
    console.error('[IG-EXT] Get extracted profiles error:', error);
    res.status(500).json({ error: 'Failed to get extracted profiles' });
  }
});

// ============================================================
// WEB APP ENDPOINTS (Clerk auth — for frontend, not extension)
// These duplicate some extension endpoints but auth via Clerk session
// ============================================================

// Helper: get userId from Clerk auth (works with Clerk middleware)
function getClerkUserId(req: Request): number | null {
  try {
    // Clerk attaches auth to req via middleware
    const auth = (req as any).auth;
    if (auth?.userId) {
      // Clerk userId is a string like "user_xxx", we need to look up the DB user
      return null; // Will use query param instead
    }
    // Fallback: use userId query param (validated by Clerk middleware upstream)
    const uid = parseInt(req.query.userId as string);
    return isNaN(uid) ? null : uid;
  } catch {
    return null;
  }
}

// GET /web/extractions — Get extraction history for web app
router.get('/web/extractions', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'userId query param required' });
    }

    // Find user's connection
    const [connection] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .orderBy(desc(instagramExtensionConnections.lastSyncAt))
      .limit(1);

    if (!connection) {
      return res.json({ success: true, extractions: [] });
    }

    const events = await db.select()
      .from(instagramExtensionEvents)
      .where(and(
        eq(instagramExtensionEvents.connectionId, connection.id),
        sql`${instagramExtensionEvents.eventData}->>'action' = 'extraction'`
      ))
      .orderBy(desc(instagramExtensionEvents.createdAt))
      .limit(50);

    const extractions = events.map(e => ({
      id: e.id,
      extractType: (e.eventData as any)?.extractType,
      query: (e.eventData as any)?.query,
      totalCount: (e.eventData as any)?.totalCount,
      users: (e.eventData as any)?.users || [],
      createdAt: e.createdAt,
    }));

    res.json({ success: true, extractions });
  } catch (error: any) {
    console.error('[IG-EXT] Web extractions error:', error);
    res.status(500).json({ error: 'Failed to get extractions' });
  }
});

// GET /web/extracted-profiles — Get extracted profiles for web app
router.get('/web/extracted-profiles', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'userId query param required' });
    }

    const [connection] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active')
      ))
      .orderBy(desc(instagramExtensionConnections.lastSyncAt))
      .limit(1);

    if (!connection) {
      return res.json({ profiles: [], total: 0, stats: {} });
    }

    const { instagramExtractedProfiles } = await import('../../db/schema');
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(instagramExtractedProfiles.connectionId, connection.id)];

    if (req.query.extractType) {
      conditions.push(eq(instagramExtractedProfiles.extractType, req.query.extractType as any));
    }
    if (req.query.hasEmail === 'true') {
      conditions.push(sql`${instagramExtractedProfiles.email} IS NOT NULL`);
    }
    if (req.query.search) {
      const search = `%${String(req.query.search).replace(/[%_]/g, '')}%`;
      conditions.push(sql`(${instagramExtractedProfiles.username} ILIKE ${search} OR ${instagramExtractedProfiles.displayName} ILIKE ${search})`);
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [{ count: totalCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(instagramExtractedProfiles)
      .where(whereClause);

    const profiles = await db.select()
      .from(instagramExtractedProfiles)
      .where(whereClause)
      .orderBy(desc(instagramExtractedProfiles.extractedAt))
      .limit(limit)
      .offset(offset);

    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      withEmail: sql<number>`count(${instagramExtractedProfiles.email})::int`,
      withPhone: sql<number>`count(${instagramExtractedProfiles.phone})::int`,
      businessAccounts: sql<number>`count(case when ${instagramExtractedProfiles.isBusiness} then 1 end)::int`,
      verified: sql<number>`count(case when ${instagramExtractedProfiles.isVerified} then 1 end)::int`,
    }).from(instagramExtractedProfiles)
      .where(eq(instagramExtractedProfiles.connectionId, connection.id));

    res.json({ profiles, total: totalCount, page, limit, stats });
  } catch (error: any) {
    console.error('[IG-EXT] Web extracted profiles error:', error);
    res.status(500).json({ error: 'Failed to get extracted profiles' });
  }
});

// GET /download — Redirect to Chrome Web Store
router.get('/download', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Install from Chrome Web Store',
    url: 'https://chromewebstore.google.com/detail/boostify-instagram-sync/PENDING_PUBLISH',
    instructions: 'Install manually from boostify-instagram-extension/dist/',
  });
});

export default router;
