/**
 * YouTube Chrome Extension Sync API
 * 
 * Provides endpoints for the Boostify YouTube Chrome Extension to:
 * - Connect/authenticate with the platform
 * - Sync channel stats periodically
 * - Retrieve and report on pending optimization actions
 * - Report YouTube events (new video, milestone, etc.)
 * - Stream live metrics via SSE
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  youtubeExtensionConnections, 
  youtubeChannelSnapshots, 
  youtubePendingActions, 
  youtubeExtensionEvents,
  users,
  marketingMetrics 
} from '../db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'boostify-yt-ext-secret-2025';

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
    const { userId, extensionId, channelId, channelUrl, channelName } = req.body;

    if (!userId || !extensionId || !channelId) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, extensionId, channelId' 
      });
    }

    // Check if user exists
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check for existing active connection with same channel
    const [existing] = await db.select()
      .from(youtubeExtensionConnections)
      .where(and(
        eq(youtubeExtensionConnections.userId, userId),
        eq(youtubeExtensionConnections.channelId, channelId),
        eq(youtubeExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (existing) {
      // Return existing connection token
      return res.json({
        success: true,
        message: 'Already connected',
        connectionId: existing.id,
        syncToken: existing.syncToken,
        channelName: existing.channelName,
      });
    }

    // Generate sync token (JWT)
    const connectionIdTemp = Date.now(); // temporary before insert
    const syncToken = jwt.sign(
      { userId, extensionId, connectionId: connectionIdTemp },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    // Create connection
    const [connection] = await db.insert(youtubeExtensionConnections).values({
      userId,
      extensionId,
      channelId,
      channelUrl: channelUrl || null,
      channelName: channelName || null,
      syncToken,
      status: 'active',
      lastSyncAt: new Date(),
    }).returning();

    // Update the token with the real connectionId
    const finalToken = jwt.sign(
      { userId, extensionId, connectionId: connection.id },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    await db.update(youtubeExtensionConnections)
      .set({ syncToken: finalToken })
      .where(eq(youtubeExtensionConnections.id, connection.id));

    // Update user's youtubeChannel if not set
    if (!user.youtubeChannel && channelUrl) {
      await db.update(users)
        .set({ youtubeChannel: channelUrl })
        .where(eq(users.id, userId));
    }

    console.log(`🔌 YouTube Extension connected: user=${userId}, channel=${channelId}, conn=${connection.id}`);

    res.json({
      success: true,
      message: 'Extension connected successfully',
      connectionId: connection.id,
      syncToken: finalToken,
      channelName: channelName || channelId,
    });

  } catch (error: any) {
    console.error('❌ Extension connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /disconnect — Revoke an extension connection
// ============================================================
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    await db.update(youtubeExtensionConnections)
      .set({ status: 'revoked' })
      .where(eq(youtubeExtensionConnections.id, auth.connectionId));

    console.log(`🔌 YouTube Extension disconnected: conn=${auth.connectionId}`);
    res.json({ success: true, message: 'Disconnected' });
  } catch (error: any) {
    console.error('❌ Extension disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /status — Get connection status (for web app UI)
// ============================================================
router.get('/status/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

    const connections = await db.select()
      .from(youtubeExtensionConnections)
      .where(and(
        eq(youtubeExtensionConnections.userId, userId),
        eq(youtubeExtensionConnections.status, 'active')
      ))
      .orderBy(desc(youtubeExtensionConnections.createdAt));

    if (connections.length === 0) {
      return res.json({
        connected: false,
        connections: [],
      });
    }

    // Get latest snapshot for each connection
    const connectionsWithStats = await Promise.all(
      connections.map(async (conn) => {
        const [latestSnapshot] = await db.select()
          .from(youtubeChannelSnapshots)
          .where(eq(youtubeChannelSnapshots.connectionId, conn.id))
          .orderBy(desc(youtubeChannelSnapshots.snapshotAt))
          .limit(1);

        const pendingActionsCount = await db.select({ count: sql<number>`count(*)` })
          .from(youtubePendingActions)
          .where(and(
            eq(youtubePendingActions.connectionId, conn.id),
            eq(youtubePendingActions.status, 'pending')
          ));

        return {
          ...conn,
          latestSnapshot,
          pendingActionsCount: Number(pendingActionsCount[0]?.count || 0),
        };
      })
    );

    res.json({
      connected: true,
      connections: connectionsWithStats,
    });

  } catch (error: any) {
    console.error('❌ Extension status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /sync-stats — Receive channel stats from extension
// ============================================================
router.post('/sync-stats', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { subscribers, totalViews, videoCount, watchTimeHours, avgViewDuration, topVideos, recentUploads, trafficSources, demographics } = req.body;

    // Verify connection is still active
    const [conn] = await db.select()
      .from(youtubeExtensionConnections)
      .where(and(
        eq(youtubeExtensionConnections.id, auth.connectionId),
        eq(youtubeExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (!conn) {
      return res.status(403).json({ error: 'Connection revoked or not found' });
    }

    // Create snapshot
    const [snapshot] = await db.insert(youtubeChannelSnapshots).values({
      connectionId: auth.connectionId,
      subscribers: subscribers || 0,
      totalViews: totalViews || 0,
      videoCount: videoCount || 0,
      watchTimeHours: watchTimeHours || 0,
      avgViewDuration: avgViewDuration || 0,
      topVideos: topVideos || [],
      recentUploads: recentUploads || [],
      trafficSources: trafficSources || {},
      demographics: demographics || {},
    }).returning();

    // Update last sync timestamp
    await db.update(youtubeExtensionConnections)
      .set({ lastSyncAt: new Date() })
      .where(eq(youtubeExtensionConnections.id, auth.connectionId));

    // Update marketing metrics if they exist
    try {
      await db.update(marketingMetrics)
        .set({ youtubeViews: totalViews || 0 })
        .where(eq(marketingMetrics.userId, auth.userId));
    } catch {}

    // Update user's topYoutubeVideos
    if (topVideos && topVideos.length > 0) {
      const formattedVideos = topVideos.slice(0, 5).map((v: any) => ({
        title: v.title,
        url: `https://youtube.com/watch?v=${v.videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${v.videoId}/maxresdefault.jpg`,
        type: 'youtube',
      }));

      try {
        await db.update(users)
          .set({ topYoutubeVideos: formattedVideos })
          .where(eq(users.id, auth.userId));
      } catch {}
    }

    // Get pending actions to return to extension
    const pendingActions = await db.select()
      .from(youtubePendingActions)
      .where(and(
        eq(youtubePendingActions.connectionId, auth.connectionId),
        eq(youtubePendingActions.status, 'pending')
      ))
      .orderBy(youtubePendingActions.priority);

    console.log(`📊 YouTube sync: conn=${auth.connectionId}, subs=${subscribers}, views=${totalViews}, pending=${pendingActions.length}`);

    res.json({
      success: true,
      snapshotId: snapshot.id,
      pendingActions,
      nextSyncInMinutes: conn.syncIntervalMinutes || 5,
    });

  } catch (error: any) {
    console.error('❌ Sync stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /pending-actions — Get all pending actions for the extension
// ============================================================
router.get('/pending-actions', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const actions = await db.select()
      .from(youtubePendingActions)
      .where(and(
        eq(youtubePendingActions.connectionId, auth.connectionId),
        inArray(youtubePendingActions.status, ['pending', 'sent'])
      ))
      .orderBy(youtubePendingActions.priority, youtubePendingActions.createdAt);

    // Mark as "sent" since the extension is now aware of them
    const pendingIds = actions.filter(a => a.status === 'pending').map(a => a.id);
    if (pendingIds.length > 0) {
      await db.update(youtubePendingActions)
        .set({ status: 'sent', sentAt: new Date() })
        .where(inArray(youtubePendingActions.id, pendingIds));
    }

    res.json({ 
      success: true, 
      actions: actions.map(a => ({
        ...a,
        status: a.status === 'pending' ? 'sent' : a.status,
      })),
    });

  } catch (error: any) {
    console.error('❌ Pending actions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /action-result — Report result of an applied action
// ============================================================
router.post('/action-result', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { actionId, status, resultMessage } = req.body;

    if (!actionId || !status) {
      return res.status(400).json({ error: 'Missing actionId or status' });
    }

    if (!['applied', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: applied, failed, cancelled' });
    }

    const [updated] = await db.update(youtubePendingActions)
      .set({
        status,
        appliedAt: status === 'applied' ? new Date() : null,
        resultMessage: resultMessage || null,
      })
      .where(and(
        eq(youtubePendingActions.id, actionId),
        eq(youtubePendingActions.connectionId, auth.connectionId)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Action not found' });
    }

    console.log(`⚡ Action ${actionId} ${status}: ${resultMessage || 'no message'}`);

    res.json({ success: true, action: updated });

  } catch (error: any) {
    console.error('❌ Action result error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /create-action — Create a new pending action (from web app)
// ============================================================
router.post('/create-action', async (req: Request, res: Response) => {
  try {
    const { userId, connectionId, actionType, targetVideoId, targetVideoTitle, payload, generatedBy, priority } = req.body;

    if (!userId || !actionType || !payload) {
      return res.status(400).json({ error: 'Missing required fields: userId, actionType, payload' });
    }

    // If connectionId not specified, find the active one
    let connId = connectionId;
    if (!connId) {
      const [conn] = await db.select()
        .from(youtubeExtensionConnections)
        .where(and(
          eq(youtubeExtensionConnections.userId, userId),
          eq(youtubeExtensionConnections.status, 'active')
        ))
        .orderBy(desc(youtubeExtensionConnections.createdAt))
        .limit(1);
      
      if (conn) connId = conn.id;
    }

    const [action] = await db.insert(youtubePendingActions).values({
      userId,
      connectionId: connId || null,
      actionType: actionType as any,
      targetVideoId: targetVideoId || null,
      targetVideoTitle: targetVideoTitle || null,
      payload,
      status: 'pending',
      generatedBy: generatedBy || 'manual',
      priority: priority || 5,
    }).returning();

    console.log(`📋 Action created: ${actionType} for video ${targetVideoId || 'none'}, user=${userId}`);

    // Notify connected extension via WebSocket if available
    if (connId && (global as any).__ytExtWebSockets) {
      const ws = (global as any).__ytExtWebSockets.get(connId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'new_action', action }));
      }
    }

    res.json({ success: true, action });

  } catch (error: any) {
    console.error('❌ Create action error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /webhook — Receive events from the extension
// ============================================================
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    const { eventType, eventData } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'Missing eventType' });
    }

    const [event] = await db.insert(youtubeExtensionEvents).values({
      connectionId: auth.connectionId,
      eventType: eventType as any,
      eventData: eventData || {},
      processed: false,
    }).returning();

    console.log(`📡 YouTube event: ${eventType} from conn=${auth.connectionId}`);

    // Auto-process certain events
    if (eventType === 'video_published' && eventData?.videoId) {
      // Automatically create optimization actions for new videos
      const actionsToCreate = [
        {
          actionType: 'update_tags' as const,
          payload: { action: 'analyze_and_suggest', videoId: eventData.videoId },
          generatedBy: 'auto-new-video',
          priority: 2,
        },
        {
          actionType: 'update_title' as const,
          payload: { action: 'analyze_and_suggest', videoId: eventData.videoId, currentTitle: eventData.title },
          generatedBy: 'auto-new-video',
          priority: 3,
        },
      ];

      for (const action of actionsToCreate) {
        await db.insert(youtubePendingActions).values({
          userId: auth.userId,
          connectionId: auth.connectionId,
          targetVideoId: eventData.videoId,
          targetVideoTitle: eventData.title || null,
          ...action,
          status: 'pending',
        });
      }

      // Mark event as processed
      await db.update(youtubeExtensionEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(youtubeExtensionEvents.id, event.id));
    }

    res.json({ success: true, eventId: event.id });

  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /snapshots/:connectionId — Get historical snapshots for charts
// ============================================================
router.get('/snapshots/:connectionId', async (req: Request, res: Response) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const limit = parseInt(req.query.limit as string) || 50;

    if (isNaN(connectionId)) {
      return res.status(400).json({ error: 'Invalid connectionId' });
    }

    const snapshots = await db.select()
      .from(youtubeChannelSnapshots)
      .where(eq(youtubeChannelSnapshots.connectionId, connectionId))
      .orderBy(desc(youtubeChannelSnapshots.snapshotAt))
      .limit(limit);

    res.json({ success: true, snapshots: snapshots.reverse() });

  } catch (error: any) {
    console.error('❌ Snapshots error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /events/:connectionId — Get recent events
// ============================================================
router.get('/events/:connectionId', async (req: Request, res: Response) => {
  try {
    const connectionId = parseInt(req.params.connectionId);
    const limit = parseInt(req.query.limit as string) || 20;

    if (isNaN(connectionId)) {
      return res.status(400).json({ error: 'Invalid connectionId' });
    }

    const events = await db.select()
      .from(youtubeExtensionEvents)
      .where(eq(youtubeExtensionEvents.connectionId, connectionId))
      .orderBy(desc(youtubeExtensionEvents.createdAt))
      .limit(limit);

    res.json({ success: true, events });

  } catch (error: any) {
    console.error('❌ Events error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /live-metrics — SSE stream for real-time metrics
// ============================================================
router.get('/live-metrics', async (req: Request, res: Response) => {
  try {
    const auth = verifySyncToken(req);
    if (!auth) return res.status(401).json({ error: 'Invalid sync token' });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Send initial data
    const [latestSnapshot] = await db.select()
      .from(youtubeChannelSnapshots)
      .where(eq(youtubeChannelSnapshots.connectionId, auth.connectionId))
      .orderBy(desc(youtubeChannelSnapshots.snapshotAt))
      .limit(1);

    const pendingCount = await db.select({ count: sql<number>`count(*)` })
      .from(youtubePendingActions)
      .where(and(
        eq(youtubePendingActions.connectionId, auth.connectionId),
        inArray(youtubePendingActions.status, ['pending', 'sent'])
      ));

    res.write(`data: ${JSON.stringify({
      type: 'initial',
      snapshot: latestSnapshot,
      pendingActionsCount: Number(pendingCount[0]?.count || 0),
    })}\n\n`);

    // Heartbeat every 30 seconds
    const interval = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
    }, 30000);

    // Cleanup on close
    req.on('close', () => {
      clearInterval(interval);
    });

  } catch (error: any) {
    console.error('❌ Live metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /generate-connect-token — Generate a token for the web app to display as QR/link
// ============================================================
router.post('/generate-connect-token', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Generate a temp connect token (valid 10 min)
    const connectToken = jwt.sign(
      { userId, purpose: 'extension-connect', nonce: crypto.randomBytes(16).toString('hex') },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    // Deep link for the extension
    const connectUrl = `boostify-ext://connect?token=${connectToken}`;

    res.json({
      success: true,
      connectToken,
      connectUrl,
      expiresIn: 600, // seconds
    });

  } catch (error: any) {
    console.error('❌ Generate connect token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /validate-connect-token — Extension validates the connect token
// ============================================================
router.post('/validate-connect-token', async (req: Request, res: Response) => {
  try {
    const { connectToken, extensionId, channelId, channelUrl, channelName } = req.body;

    if (!connectToken || !extensionId || !channelId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the temp token
    let decoded: any;
    try {
      decoded = jwt.verify(connectToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired connect token' });
    }

    if (decoded.purpose !== 'extension-connect') {
      return res.status(401).json({ error: 'Invalid token purpose' });
    }

    // Now create the actual connection (reuse connect logic)
    const fakeReq = {
      body: {
        userId: decoded.userId,
        extensionId,
        channelId,
        channelUrl,
        channelName,
      },
    } as Request;

    // Forward to connect handler via internal call
    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId)).limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check for existing
    const [existing] = await db.select()
      .from(youtubeExtensionConnections)
      .where(and(
        eq(youtubeExtensionConnections.userId, decoded.userId),
        eq(youtubeExtensionConnections.channelId, channelId),
        eq(youtubeExtensionConnections.status, 'active')
      ))
      .limit(1);

    if (existing) {
      return res.json({
        success: true,
        connectionId: existing.id,
        syncToken: existing.syncToken,
        channelName: existing.channelName,
        userId: decoded.userId,
      });
    }

    const syncToken = jwt.sign(
      { userId: decoded.userId, extensionId, connectionId: 0 },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    const [connection] = await db.insert(youtubeExtensionConnections).values({
      userId: decoded.userId,
      extensionId,
      channelId,
      channelUrl: channelUrl || null,
      channelName: channelName || null,
      syncToken,
      status: 'active',
      lastSyncAt: new Date(),
    }).returning();

    const finalToken = jwt.sign(
      { userId: decoded.userId, extensionId, connectionId: connection.id },
      JWT_SECRET,
      { expiresIn: '365d' }
    );

    await db.update(youtubeExtensionConnections)
      .set({ syncToken: finalToken })
      .where(eq(youtubeExtensionConnections.id, connection.id));

    console.log(`🔌 YouTube Extension connected via token: user=${decoded.userId}, channel=${channelId}`);

    res.json({
      success: true,
      connectionId: connection.id,
      syncToken: finalToken,
      channelName: channelName || channelId,
      userId: decoded.userId,
    });

  } catch (error: any) {
    console.error('❌ Validate connect token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DOWNLOAD: Serve extension as ZIP file
// ============================================================
router.get('/download', async (_req: Request, res: Response) => {
  try {
    const JSZip = (await import('jszip')).default;
    const fs = await import('fs');
    const pathMod = await import('path');

    const distDir = pathMod.join(process.cwd(), 'boostify-youtube-extension', 'dist');

    if (!fs.existsSync(distDir)) {
      return res.status(404).json({ 
        error: 'Extension not built yet. Run: cd boostify-youtube-extension && npm run build' 
      });
    }

    const zip = new JSZip();

    // Recursively add files
    function addDir(dirPath: string, zipFolder: JSZip) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = pathMod.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          const sub = zipFolder.folder(entry.name)!;
          addDir(fullPath, sub);
        } else {
          zipFolder.file(entry.name, fs.readFileSync(fullPath));
        }
      }
    }

    addDir(distDir, zip);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="boostify-youtube-extension.zip"',
      'Content-Length': String(zipBuffer.length),
    });
    res.send(zipBuffer);

  } catch (error: any) {
    console.error('❌ Extension download error:', error);
    res.status(500).json({ error: 'Failed to generate extension download' });
  }
});

export default router;
