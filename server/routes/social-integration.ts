/**
 * Social Integration API Routes
 * Central router for all Phase 1-5 social integration features:
 *  - Real user sync to social network
 *  - Follows system
 *  - Notification preferences
 *  - External publish queue (bridge to Chrome Extensions)
 *  - Platform events (auto-promotion)
 *  - Agent external action endpoint
 */

import { Router, Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { authenticate } from "../middleware/auth";
import { queueExternalPost, dispatchQueuedPosts, hasActiveExtensionConnection } from "../services/external-publish-service";
import { queueSocialNotification, flushNotificationQueue } from "../services/social-notification-service";
import { emitPlatformEvent, processPlatformEvents } from "../services/platform-events-service";
import { handleExternalActionIntent } from "../services/external-action-router";

const router = Router();
const getSql = () => neon(process.env.DATABASE_URL!);

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Real User ↔ Social Network sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/social-integration/sync-real-user
 * Called on login: links users.id → social_users with real email
 */
router.post("/sync-real-user", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const user = (req as any).user;
    const userId: number = user.id;
    const email: string = user.email || req.body.email || "";
    const displayName: string =
      user.artistName || user.firstName || user.username || `User ${userId}`;
    const avatar: string = user.profileImageUrl || user.profileImage || "";

    // Check if social_users row exists with this real_user_id
    const existing = await sql`
      SELECT id FROM social_users WHERE real_user_id = ${userId} LIMIT 1
    `;

    if (existing.length > 0) {
      // Update email and real_user_id link
      await sql`
        UPDATE social_users
        SET email = ${email}, real_user_id = ${userId},
            display_name = ${displayName},
            avatar = COALESCE(avatar, ${avatar || null}),
            updated_at = NOW()
        WHERE real_user_id = ${userId}
      `;
      return res.json({ synced: true, socialUserId: existing[0].id, created: false });
    }

    // Try to find by ID (legacy sync used users.id as social_users.id directly)
    const byId = await sql`SELECT id FROM social_users WHERE id = ${String(userId)} LIMIT 1`;
    if (byId.length > 0) {
      await sql`
        UPDATE social_users
        SET real_user_id = ${userId}, email = ${email},
            display_name = ${displayName},
            avatar = COALESCE(avatar, ${avatar || null}),
            updated_at = NOW()
        WHERE id = ${String(userId)}
      `;
      return res.json({ synced: true, socialUserId: byId[0].id, created: false });
    }

    // Create new social_users row
    const newId = `real_${userId}`;
    await sql`
      INSERT INTO social_users (id, display_name, avatar, bio, real_user_id, email, is_bot, created_at, updated_at)
      VALUES (${newId}, ${displayName}, ${avatar || null}, '', ${userId}, ${email}, FALSE, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET real_user_id = ${userId}, email = ${email}, updated_at = NOW()
    `;

    return res.json({ synced: true, socialUserId: newId, created: true });
  } catch (err) {
    console.error("[SocialInt] sync-real-user error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 — Follows
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/social-integration/follow */
router.post("/follow", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const followerId: string = req.body.followerId; // social_users.id (varchar)
    const followingId: string = req.body.followingId;
    if (!followerId || !followingId) return res.status(400).json({ error: "followerId and followingId required" });
    if (followerId === followingId) return res.status(400).json({ error: "Cannot follow yourself" });

    await sql`
      INSERT INTO social_follows (follower_id, following_id) VALUES (${followerId}, ${followingId})
      ON CONFLICT DO NOTHING
    `;

    // Update counters
    await sql`UPDATE social_users SET follows_count = COALESCE(follows_count, 0) + 1 WHERE id = ${followerId}`;
    await sql`UPDATE social_users SET followers_count = COALESCE(followers_count, 0) + 1 WHERE id = ${followingId}`;

    // Notify the person being followed
    const [target] = await sql`SELECT email, display_name FROM social_users WHERE id = ${followingId} LIMIT 1`;
    const [actor] = await sql`SELECT display_name FROM social_users WHERE id = ${followerId} LIMIT 1`;
    if (target?.email) {
      await queueSocialNotification({
        recipientUserId: followingId,
        recipientEmail: target.email,
        type: "follow",
        actorName: actor?.display_name || "Alguien",
        relatedUserId: followerId,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[SocialInt] follow error:", err);
    res.status(500).json({ error: "Failed to follow" });
  }
});

/** DELETE /api/social-integration/follow */
router.delete("/follow", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const { followerId, followingId } = req.body;
    await sql`DELETE FROM social_follows WHERE follower_id=${followerId} AND following_id=${followingId}`;
    await sql`UPDATE social_users SET follows_count = GREATEST(0, COALESCE(follows_count, 0) - 1) WHERE id=${followerId}`;
    await sql`UPDATE social_users SET followers_count = GREATEST(0, COALESCE(followers_count, 0) - 1) WHERE id=${followingId}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to unfollow" });
  }
});

/** GET /api/social-integration/followers/:socialUserId */
router.get("/followers/:socialUserId", async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const { socialUserId } = req.params;
    const rows = await sql`
      SELECT su.id, su.display_name, su.avatar, su.real_user_id
      FROM social_follows sf
      JOIN social_users su ON su.id = sf.follower_id
      WHERE sf.following_id = ${socialUserId}
      ORDER BY sf.created_at DESC LIMIT 100
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get followers" });
  }
});

/** GET /api/social-integration/following/:socialUserId */
router.get("/following/:socialUserId", async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const { socialUserId } = req.params;
    const rows = await sql`
      SELECT su.id, su.display_name, su.avatar, su.real_user_id
      FROM social_follows sf
      JOIN social_users su ON su.id = sf.following_id
      WHERE sf.follower_id = ${socialUserId}
      ORDER BY sf.created_at DESC LIMIT 100
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get following" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Notification preferences
// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /api/social-integration/notifications/preferences */
router.patch("/notifications/preferences", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId = (req as any).user.id;
    const { enabled } = req.body; // boolean
    await sql`
      UPDATE social_users SET email_notifications_enabled = ${!!enabled}
      WHERE real_user_id = ${userId}
    `;
    res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

/** GET /api/social-integration/notifications/my */
router.get("/notifications/my", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId = (req as any).user.id;
    const [su] = await sql`SELECT id FROM social_users WHERE real_user_id=${userId} LIMIT 1`;
    if (!su) return res.json([]);

    const rows = await sql`
      SELECT notification_type, subject, status, created_at, sent_at
      FROM social_notification_queue
      WHERE recipient_user_id = ${su.id}
      ORDER BY created_at DESC LIMIT 50
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 — External Publish (bridge to Chrome Extension)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/social-integration/publish-external */
router.post("/publish-external", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { sourceType, sourceId, platform, caption, imageUrl, videoUrl, hashtags, priority } = req.body;

    if (!caption || !platform) return res.status(400).json({ error: "caption and platform required" });

    const id = await queueExternalPost({
      sourceType: sourceType || "user_post",
      sourceId: sourceId || Date.now(),
      platform,
      userId,
      caption,
      imageUrl,
      videoUrl,
      hashtags: hashtags || [],
      priority: priority ?? 5,
    });

    if (id === null) {
      return res.status(409).json({
        error: `No tienes la extensión de ${platform} conectada. Instálala y conéctala primero.`,
      });
    }

    res.json({ success: true, queueId: id, message: `Encolado para ${platform}. Se publicará en el próximo sync.` });
  } catch (err) {
    console.error("[SocialInt] publish-external error:", err);
    res.status(500).json({ error: "Failed to queue external post" });
  }
});

/** GET /api/social-integration/publish-external/status */
router.get("/publish-external/status", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId = (req as any).user.id;
    const rows = await sql`
      SELECT id, platform, source_type, status, caption, created_at, dispatched_at, published_at, error_message
      FROM external_publish_queue
      WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 20
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get publish status" });
  }
});

/** GET /api/social-integration/extension-status */
router.get("/extension-status", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const [ig, yt] = await Promise.all([
      hasActiveExtensionConnection(userId, "instagram"),
      hasActiveExtensionConnection(userId, "youtube"),
    ]);
    res.json({ instagram: ig, youtube: yt, tiktok: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to check extension status" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4 — Agent external action endpoint
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/social-integration/agent-action
 * Called by any AI agent when the user says something like "postea esto en Instagram"
 */
router.post("/agent-action", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { message, generatedContent, imageUrl, videoUrl, artistName, songTitle } = req.body;

    if (!message) return res.status(400).json({ error: "message required" });

    const result = await handleExternalActionIntent(userId, message, {
      generatedContent,
      imageUrl,
      videoUrl,
      artistName,
      songTitle,
    });

    res.json(result);
  } catch (err) {
    console.error("[SocialInt] agent-action error:", err);
    res.status(500).json({ error: "Failed to process agent action" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 5 — Platform Events
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/social-integration/platform-event */
router.post("/platform-event", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { eventType, payload, autoPromote } = req.body;
    if (!eventType) return res.status(400).json({ error: "eventType required" });

    await emitPlatformEvent(eventType, { ...payload, actorUserId: userId }, !!autoPromote);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to emit event" });
  }
});

/** GET /api/social-integration/platform-events */
router.get("/platform-events", authenticate, async (req: Request, res: Response) => {
  const sql = getSql();
  try {
    const userId = (req as any).user.id;
    const rows = await sql`
      SELECT id, event_type, payload, auto_promote, processed, created_at, promoted_at
      FROM platform_events
      WHERE actor_user_id = ${userId}
      ORDER BY created_at DESC LIMIT 30
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get events" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL — Background worker triggers (called by the scheduler)
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/social-integration/worker/flush-notifications (internal) */
router.post("/worker/flush-notifications", async (_req: Request, res: Response) => {
  const result = await flushNotificationQueue(30);
  res.json(result);
});

/** POST /api/social-integration/worker/dispatch-posts (internal) */
router.post("/worker/dispatch-posts", async (_req: Request, res: Response) => {
  const result = await dispatchQueuedPosts(20);
  res.json(result);
});

/** POST /api/social-integration/worker/process-events (internal) */
router.post("/worker/process-events", async (_req: Request, res: Response) => {
  const result = await processPlatformEvents(20);
  res.json(result);
});

export default router;
