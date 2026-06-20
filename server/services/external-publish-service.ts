/**
 * External Publish Service
 * Bridge between internal Boostify posts and real social networks via Chrome Extensions.
 *
 * Flow:
 *  1. AI post / user post / platform event is created internally
 *  2. Caller invokes queueExternalPost() — inserts into external_publish_queue
 *  3. dispatchToChrome() reads queued posts and inserts into instagramPendingActions
 *     (existing queue that Chrome Extension polls every sync cycle)
 *  4. Extension picks up the action, publishes to Instagram/YouTube, reports result back
 */

import { neon } from "@neondatabase/serverless";

const getSql = () => neon(process.env.DATABASE_URL!);

export type ExternalPlatform = "instagram" | "youtube" | "tiktok";
export type ExternalSourceType = "ai_social_post" | "user_post" | "platform_event" | "agent_post";

export interface ExternalPublishRequest {
  sourceType: ExternalSourceType;
  sourceId: number;
  platform: ExternalPlatform;
  userId: number; // real users.id who owns the Chrome Extension connection
  caption: string;
  imageUrl?: string;
  videoUrl?: string;
  hashtags?: string[];
  priority?: number; // 1-10, lower = higher priority
}

/** Queue a post for publishing to an external platform */
export async function queueExternalPost(req: ExternalPublishRequest): Promise<number | null> {
  const sql = getSql();
  try {
    // Verify user has an active Chrome Extension connection for this platform
    if (req.platform === "instagram") {
      const conn = await sql`
        SELECT id FROM instagram_extension_connections
        WHERE user_id = ${req.userId} AND status = 'active'
        LIMIT 1
      `;
      if (!conn.length) {
        console.log(`[ExtPublish] No active IG extension for user ${req.userId}, skipping`);
        return null;
      }
    }

    const rows = await sql`
      INSERT INTO external_publish_queue
        (source_type, source_id, platform, user_id, caption, image_url, video_url, hashtags, priority)
      VALUES
        (${req.sourceType}, ${req.sourceId}, ${req.platform}, ${req.userId},
         ${req.caption}, ${req.imageUrl ?? null}, ${req.videoUrl ?? null},
         ${req.hashtags ?? null}, ${req.priority ?? 5})
      RETURNING id
    `;
    return rows[0]?.id ?? null;
  } catch (err) {
    console.error("[ExtPublish] queue error:", err);
    return null;
  }
}

/**
 * Dispatch queued posts to the Chrome Extension pending actions table.
 * Should be called periodically (e.g. every 5 minutes by a background timer).
 */
export async function dispatchQueuedPosts(limit = 10): Promise<{ dispatched: number }> {
  const sql = getSql();
  let dispatched = 0;

  const queued = await sql`
    SELECT q.*, ic.id AS ig_conn_id
    FROM external_publish_queue q
    LEFT JOIN instagram_extension_connections ic
      ON ic.user_id = q.user_id AND ic.status = 'active'
    WHERE q.status = 'queued'
      AND q.platform = 'instagram'
    ORDER BY q.priority ASC, q.created_at ASC
    LIMIT ${limit}
  `;

  for (const row of queued) {
    if (!row.ig_conn_id) {
      // No active connection — mark failed
      await sql`
        UPDATE external_publish_queue
        SET status='failed', error_message='No active Instagram extension connection', updated_at=NOW()
        WHERE id=${row.id}
      `;
      continue;
    }

    // Build caption with hashtags
    const hashtagStr = Array.isArray(row.hashtags) && row.hashtags.length
      ? "\n\n" + row.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";
    const fullCaption = (row.caption + hashtagStr).substring(0, 2200); // IG limit

    // Insert into instagramPendingActions (existing queue)
    await sql`
      INSERT INTO instagram_pending_actions
        (user_id, connection_id, action_type, payload, generated_by, priority, status)
      VALUES
        (${row.user_id}, ${row.ig_conn_id}, 'post',
         ${JSON.stringify({
           caption: fullCaption,
           imageUrl: row.image_url ?? null,
           videoUrl: row.video_url ?? null,
           sourceType: row.source_type,
           sourceId: row.source_id,
         })},
         'boostify-auto', ${row.priority ?? 5}, 'pending')
    `;

    await sql`
      UPDATE external_publish_queue
      SET status='dispatched', dispatched_at=NOW(), ig_connection_id=${row.ig_conn_id}, updated_at=NOW()
      WHERE id=${row.id}
    `;
    dispatched++;
  }

  return { dispatched };
}

/**
 * Mark a post as published after the extension reports success.
 * Called from the AI social agents route when an action-result comes in.
 */
export async function markExternalPublished(
  sourceType: ExternalSourceType,
  sourceId: number,
  platform: ExternalPlatform,
  externalPostId?: string
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE external_publish_queue
    SET status='published', published_at=NOW(), external_post_id=${externalPostId ?? null}, updated_at=NOW()
    WHERE source_type=${sourceType} AND source_id=${sourceId} AND platform=${platform}
      AND status='dispatched'
  `;
}

/**
 * Check if a user has an active Chrome Extension connection for a platform.
 * Used by the UI to show/hide the "Publish to IG" button.
 */
export async function hasActiveExtensionConnection(
  userId: number,
  platform: ExternalPlatform
): Promise<boolean> {
  const sql = getSql();
  if (platform === "instagram") {
    const r = await sql`
      SELECT 1 FROM instagram_extension_connections
      WHERE user_id=${userId} AND status='active' LIMIT 1
    `;
    return r.length > 0;
  }
  if (platform === "youtube") {
    const r = await sql`
      SELECT 1 FROM youtube_extension_connections
      WHERE user_id=${userId} AND status='active' LIMIT 1
    `;
    return r.length > 0;
  }
  return false;
}
