/**
 * Social Notification Service
 * Sends email notifications for social interactions (like, comment, follow, viral, weekly digest)
 * Uses Brevo (already configured in brevo-email-service.ts)
 * Queues notifications in social_notification_queue, then flushes via a background worker
 */

import { neon } from "@neondatabase/serverless";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const FROM_EMAIL = "info@boostifymusic.com";
const FROM_NAME = "Boostify Music";
const APP_URL = process.env.APP_URL || "https://www.boostifymusic.com";

const getSql = () => neon(process.env.DATABASE_URL!);

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "viral_post"
  | "weekly_digest"
  | "new_song"
  | "token_alert"
  | "artist_post"
  | "platform_event";

export interface SocialNotificationInput {
  recipientUserId: string; // social_users.id (varchar)
  recipientEmail: string;
  type: NotificationType;
  actorName?: string; // who did the action
  actorAvatar?: string;
  postContent?: string; // first 120 chars of post
  postId?: number;
  relatedUserId?: string; // actor social_users.id
  extraData?: Record<string, unknown>;
}

// ── Brevo send helper ─────────────────────────────────────────────────────────

async function sendBrevo(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": key,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    const json = await res.json() as any;
    return !!json.messageId;
  } catch {
    return false;
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:14px;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.5)">
<tr><td style="background:linear-gradient(90deg,#8B5CF6 0%,#EC4899 100%);padding:24px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:1px">🎵 BOOSTIFY MUSIC</h1>
</td></tr>
<tr><td style="padding:32px">
${content}
</td></tr>
<tr><td style="padding:16px 32px;text-align:center;border-top:1px solid rgba(255,255,255,.07)">
<p style="margin:0;color:#555;font-size:12px">Boostify Music · <a href="${APP_URL}/settings" style="color:#8B5CF6">Gestionar notificaciones</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function likeTemplate(actorName: string, postPreview: string, postUrl: string): string {
  return baseTemplate(`
<h2 style="color:#fff;margin:0 0 12px">❤️ A alguien le gustó tu post</h2>
<p style="color:#a0a0a0;font-size:15px;line-height:1.6"><strong style="color:#EC4899">${actorName}</strong> le dio like a tu publicación:</p>
<blockquote style="border-left:3px solid #8B5CF6;padding:12px 16px;margin:16px 0;background:rgba(139,92,246,.08);border-radius:0 8px 8px 0;color:#ccc;font-style:italic">"${postPreview}"</blockquote>
<div style="text-align:center;margin-top:24px"><a href="${postUrl}" style="background:linear-gradient(90deg,#8B5CF6,#EC4899);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Ver post</a></div>`);
}

function commentTemplate(actorName: string, commentText: string, postPreview: string, postUrl: string): string {
  return baseTemplate(`
<h2 style="color:#fff;margin:0 0 12px">💬 Nuevo comentario en tu post</h2>
<p style="color:#a0a0a0;font-size:15px;line-height:1.6"><strong style="color:#EC4899">${actorName}</strong> comentó en tu publicación:</p>
<blockquote style="border-left:3px solid #8B5CF6;padding:12px 16px;margin:16px 0;background:rgba(139,92,246,.08);border-radius:0 8px 8px 0;color:#ccc;font-style:italic">"${commentText}"</blockquote>
<p style="color:#666;font-size:13px">En tu post: "${postPreview}"</p>
<div style="text-align:center;margin-top:24px"><a href="${postUrl}" style="background:linear-gradient(90deg,#8B5CF6,#EC4899);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Responder</a></div>`);
}

function followTemplate(actorName: string, profileUrl: string): string {
  return baseTemplate(`
<h2 style="color:#fff;margin:0 0 12px">🌟 Nuevo seguidor</h2>
<p style="color:#a0a0a0;font-size:15px;line-height:1.6"><strong style="color:#EC4899">${actorName}</strong> ha empezado a seguirte en Boostify Music.</p>
<div style="text-align:center;margin-top:24px"><a href="${profileUrl}" style="background:linear-gradient(90deg,#8B5CF6,#EC4899);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Ver perfil</a></div>`);
}

function viralTemplate(postPreview: string, likes: number, postUrl: string): string {
  return baseTemplate(`
<h2 style="color:#fff;margin:0 0 12px">🔥 ¡Tu post está volviéndose viral!</h2>
<p style="color:#a0a0a0;font-size:15px;line-height:1.6">Tu publicación ya tiene <strong style="color:#EC4899">${likes} likes</strong> y sigue creciendo:</p>
<blockquote style="border-left:3px solid #EC4899;padding:12px 16px;margin:16px 0;background:rgba(236,72,153,.08);border-radius:0 8px 8px 0;color:#ccc;font-style:italic">"${postPreview}"</blockquote>
<div style="text-align:center;margin-top:24px"><a href="${postUrl}" style="background:linear-gradient(90deg,#EC4899,#F97316);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Ver mi post viral 🚀</a></div>`);
}

function platformEventTemplate(title: string, body: string, ctaText: string, ctaUrl: string): string {
  return baseTemplate(`
<h2 style="color:#fff;margin:0 0 12px">${title}</h2>
<p style="color:#a0a0a0;font-size:15px;line-height:1.6">${body}</p>
<div style="text-align:center;margin-top:24px"><a href="${ctaUrl}" style="background:linear-gradient(90deg,#8B5CF6,#EC4899);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">${ctaText}</a></div>`);
}

// ── Queue & Send ──────────────────────────────────────────────────────────────

/** Queue a notification. Fires-and-forgets — does NOT block the caller. */
export async function queueSocialNotification(input: SocialNotificationInput): Promise<void> {
  const sql = getSql();
  try {
    // Check user opted-in
    const [user] = await sql`
      SELECT email_notifications_enabled FROM social_users WHERE id = ${input.recipientUserId}
    `;
    if (!user || user.email_notifications_enabled === false) return;

    const { subject, html } = buildEmailContent(input);

    await sql`
      INSERT INTO social_notification_queue
        (recipient_user_id, recipient_email, notification_type, subject, html_content, related_post_id, related_user_id, status)
      VALUES
        (${input.recipientUserId}, ${input.recipientEmail}, ${input.type}, ${subject}, ${html},
         ${input.postId ?? null}, ${input.relatedUserId ?? null}, 'pending')
    `;
  } catch (err) {
    // Never crash the caller
    console.error("[SocialNotif] queue error:", err);
  }
}

function buildEmailContent(input: SocialNotificationInput): { subject: string; html: string } {
  const actor = input.actorName || "Alguien";
  const preview = (input.postContent || "").substring(0, 120);
  const postUrl = input.postId ? `${APP_URL}/social?post=${input.postId}` : `${APP_URL}/social`;

  switch (input.type) {
    case "like":
      return {
        subject: `❤️ ${actor} le gustó tu post en Boostify`,
        html: likeTemplate(actor, preview, postUrl),
      };
    case "comment":
      return {
        subject: `💬 ${actor} comentó en tu post`,
        html: commentTemplate(actor, (input.extraData?.commentText as string) || "", preview, postUrl),
      };
    case "follow":
      return {
        subject: `🌟 ${actor} ha empezado a seguirte`,
        html: followTemplate(actor, `${APP_URL}/social`),
      };
    case "viral_post":
      return {
        subject: `🔥 ¡Tu post está viral! ${input.extraData?.likes ?? ""} likes`,
        html: viralTemplate(preview, (input.extraData?.likes as number) || 0, postUrl),
      };
    case "new_song":
      return {
        subject: `🎵 ${actor} lanzó una nueva canción certificada`,
        html: platformEventTemplate(
          "🎵 Nueva canción certificada",
          `<strong style="color:#EC4899">${actor}</strong> acaba de certificar una nueva canción en Boostify Music: <em>${input.extraData?.songTitle ?? "sin título"}</em>.`,
          "Escucharla ahora",
          postUrl
        ),
      };
    case "token_alert":
      return {
        subject: `📈 Token ${input.extraData?.symbol ?? ""} superó $${input.extraData?.price ?? ""}`,
        html: platformEventTemplate(
          "📈 Alerta de token",
          `El token <strong style="color:#EC4899">$${input.extraData?.symbol ?? ""}</strong> de ${actor} acaba de alcanzar <strong style="color:#22c55e">$${input.extraData?.price ?? ""}</strong>.`,
          "Ver en BoostiSwap",
          `${APP_URL}/boostiswap`
        ),
      };
    case "platform_event":
    default:
      return {
        subject: (input.extraData?.subject as string) || "Novedad en Boostify Music",
        html: platformEventTemplate(
          (input.extraData?.title as string) || "Novedad en Boostify",
          (input.extraData?.body as string) || "",
          (input.extraData?.ctaText as string) || "Ver en Boostify",
          (input.extraData?.ctaUrl as string) || APP_URL
        ),
      };
  }
}

/** Flush up to `limit` pending notifications. Called by a cron/timer. */
export async function flushNotificationQueue(limit = 20): Promise<{ sent: number; failed: number }> {
  const sql = getSql();
  let sent = 0;
  let failed = 0;

  const rows = await sql`
    SELECT id, recipient_email, subject, html_content
    FROM social_notification_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  for (const row of rows) {
    const ok = await sendBrevo(row.recipient_email, row.subject, row.html_content);
    if (ok) {
      await sql`UPDATE social_notification_queue SET status='sent', sent_at=NOW() WHERE id=${row.id}`;
      sent++;
    } else {
      await sql`UPDATE social_notification_queue SET status='failed', error_message='Brevo delivery failed' WHERE id=${row.id}`;
      failed++;
    }
  }

  return { sent, failed };
}
