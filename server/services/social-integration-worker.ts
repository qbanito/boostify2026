/**
 * Social Integration Background Worker
 * Runs periodic tasks:
 *  - Every 2 min: flush pending email notifications
 *  - Every 5 min: dispatch queued posts to Chrome Extension
 *  - Every 5 min: process platform events (auto-promotion)
 *  - Every Sunday: send weekly digest emails
 *
 * Called from server/index.ts after server starts.
 */

import { flushNotificationQueue } from "./social-notification-service";
import { dispatchQueuedPosts } from "./external-publish-service";
import { processPlatformEvents } from "./platform-events-service";
import { neon } from "@neondatabase/serverless";

let timers: ReturnType<typeof setInterval>[] = [];
let isRunning = false;

export function startSocialIntegrationWorker(): void {
  if (isRunning) return;
  isRunning = true;

  console.log("🔄 [SocialWorker] Starting social integration background worker...");

  // Flush email notifications every 2 minutes
  timers.push(
    setInterval(async () => {
      try {
        const result = await flushNotificationQueue(30);
        if (result.sent > 0 || result.failed > 0) {
          console.log(`📧 [SocialWorker] Notifications: ${result.sent} sent, ${result.failed} failed`);
        }
      } catch (err) {
        console.error("[SocialWorker] flush-notifications error:", err);
      }
    }, 2 * 60 * 1000)
  );

  // Dispatch queued posts to Chrome Extension every 5 minutes
  timers.push(
    setInterval(async () => {
      try {
        const result = await dispatchQueuedPosts(20);
        if (result.dispatched > 0) {
          console.log(`📲 [SocialWorker] Dispatched ${result.dispatched} posts to Chrome Extension`);
        }
      } catch (err) {
        console.error("[SocialWorker] dispatch-posts error:", err);
      }
    }, 5 * 60 * 1000)
  );

  // Process platform events every 5 minutes
  timers.push(
    setInterval(async () => {
      try {
        const result = await processPlatformEvents(20);
        if (result.processed > 0) {
          console.log(`⚡ [SocialWorker] Processed ${result.processed} platform events`);
        }
      } catch (err) {
        console.error("[SocialWorker] process-events error:", err);
      }
    }, 5 * 60 * 1000)
  );

  // Weekly digest — check every hour, send on Sunday at 10am UTC
  timers.push(
    setInterval(async () => {
      try {
        const now = new Date();
        const isSunday = now.getUTCDay() === 0;
        const is10am = now.getUTCHours() === 10 && now.getUTCMinutes() < 60;
        if (!isSunday || !is10am) return;
        await sendWeeklyDigest();
        console.log("📰 [SocialWorker] Weekly digest sent");
      } catch (err) {
        console.error("[SocialWorker] weekly-digest error:", err);
      }
    }, 60 * 60 * 1000) // check every hour
  );

  console.log("✅ [SocialWorker] Background worker active (notifications, dispatch, events)");
}

export function stopSocialIntegrationWorker(): void {
  timers.forEach(clearInterval);
  timers = [];
  isRunning = false;
}

// ── Weekly digest ─────────────────────────────────────────────────────────────

async function sendWeeklyDigest(): Promise<void> {
  const sql = neon(process.env.DATABASE_URL!);
  const { flushNotificationQueue } = await import("./social-notification-service");
  const { queueSocialNotification } = await import("./social-notification-service");

  // Get all active users with email and notifications enabled
  const users = await sql`
    SELECT id, display_name, email, followers_count, follows_count
    FROM social_users
    WHERE email IS NOT NULL
      AND email_notifications_enabled = TRUE
      AND is_bot = FALSE
    LIMIT 5000
  `;

  // Top posts this week
  const topPosts = await sql`
    SELECT sp.content, sp.likes, su.display_name AS author
    FROM social_posts sp
    JOIN social_users su ON su.id = sp.user_id
    WHERE sp.created_at > NOW() - INTERVAL '7 days'
    ORDER BY sp.likes DESC
    LIMIT 5
  `;

  const topPostsHtml = topPosts.length
    ? topPosts
        .map(
          (p) =>
            `<div style="border-left:3px solid #8B5CF6;padding:8px 12px;margin:8px 0;color:#ccc">
          <strong style="color:#EC4899">${p.author}</strong>: "${(p.content || "").substring(0, 100)}"
          <span style="color:#666;font-size:12px"> · ❤️ ${p.likes ?? 0}</span>
        </div>`
        )
        .join("")
    : "<p style='color:#666'>No hay posts destacados esta semana.</p>";

  const APP_URL = process.env.APP_URL || "https://www.boostifymusic.com";

  for (const user of users) {
    await queueSocialNotification({
      recipientUserId: user.id,
      recipientEmail: user.email,
      type: "weekly_digest",
      extraData: {
        title: "📊 Tu resumen semanal de Boostify",
        body: `
          <h3 style="color:#fff;margin:0 0 16px">Posts más populares esta semana</h3>
          ${topPostsHtml}
          <div style="margin-top:24px;padding:16px;background:rgba(139,92,246,.08);border-radius:8px">
            <p style="color:#a0a0a0;margin:0 0 8px;font-size:14px">Tu actividad esta semana:</p>
            <p style="color:#fff;margin:0;font-size:14px">👥 ${user.followers_count ?? 0} seguidores · 🤝 ${user.follows_count ?? 0} siguiendo</p>
          </div>`,
        ctaText: "Ver el feed completo",
        ctaUrl: `${APP_URL}/social`,
      },
    });
  }

  await flushNotificationQueue(users.length + 10);
}
