/**
 * Platform Events Service
 * Cross-module event bus. Any module calls emitPlatformEvent() when something notable happens.
 * The background worker (processPlatformEvents) reads new events and:
 *   - Queues external posts for auto-promotion on Instagram/YouTube
 *   - Sends email notifications to followers/fans
 *   - Optionally broadcasts inside the social feed
 */

import { neon } from "@neondatabase/serverless";
import { queueExternalPost } from "./external-publish-service";
import { queueSocialNotification } from "./social-notification-service";

const getSql = () => neon(process.env.DATABASE_URL!);

export type PlatformEventType =
  | "song_certified"
  | "token_launched"
  | "token_price_milestone"
  | "artist_created"
  | "hologram_scheduled"
  | "promo_video_ready"
  | "post_viral"
  | "new_follower_milestone"
  | "revenue_milestone"
  | "booking_confirmed"
  | "collab_request";

export interface PlatformEventPayload {
  /** ID of the artist/user who triggered the event */
  actorUserId?: number;
  artistName?: string;
  artistSlug?: string;
  // song_certified
  songTitle?: string;
  songUrl?: string;
  audioUrl?: string;
  certHash?: string;
  // token_launched / token_price_milestone
  tokenSymbol?: string;
  tokenPrice?: number;
  // hologram_scheduled
  hologramDate?: string;
  venueCity?: string;
  // promo_video_ready
  videoUrl?: string;
  // generic
  title?: string;
  body?: string;
  imageUrl?: string;
  ctaUrl?: string;
  [key: string]: unknown;
}

/** Emit an event — fire-and-forget, never throws */
export async function emitPlatformEvent(
  type: PlatformEventType,
  payload: PlatformEventPayload,
  autoPromote = false
): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO platform_events (event_type, actor_user_id, payload, auto_promote)
      VALUES (${type}, ${payload.actorUserId ?? null}, ${JSON.stringify(payload)}, ${autoPromote})
    `;
  } catch (err) {
    console.error("[PlatformEvents] emit error:", err);
  }
}

/** Process unprocessed events — call every 5 min from background worker */
export async function processPlatformEvents(limit = 20): Promise<{ processed: number }> {
  const sql = getSql();
  let processed = 0;

  const events = await sql`
    SELECT * FROM platform_events
    WHERE processed = FALSE
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;

  for (const event of events) {
    try {
      await handleEvent(event);
      await sql`UPDATE platform_events SET processed=TRUE, promoted_at=NOW() WHERE id=${event.id}`;
      processed++;
    } catch (err) {
      console.error(`[PlatformEvents] handle error for event ${event.id}:`, err);
      // Mark processed anyway to avoid infinite loop
      await sql`UPDATE platform_events SET processed=TRUE WHERE id=${event.id}`;
    }
  }

  return { processed };
}

async function handleEvent(event: any): Promise<void> {
  const sql = getSql();
  const p: PlatformEventPayload = event.payload;
  const actorUserId: number | null = event.actor_user_id;

  // ── Find artist's active IG connection ────────────────────────────────────
  let igConnectionExists = false;
  if (actorUserId) {
    const conn = await sql`
      SELECT 1 FROM instagram_extension_connections
      WHERE user_id=${actorUserId} AND status='active' LIMIT 1
    `;
    igConnectionExists = conn.length > 0;
  }

  switch (event.event_type as PlatformEventType) {
    // ── Song Certified ───────────────────────────────────────────────────────
    case "song_certified": {
      if (!actorUserId) break;

      const caption = `🎵 Nueva canción certificada en @boostifymusic\n\n"${p.songTitle}" — ${p.artistName}\n\nCertificado con hash SHA-256 en blockchain.\n\n#BoostifyMusic #MusicNFT #CertificadoDigital #IndieMusic`;

      if (igConnectionExists) {
        await queueExternalPost({
          sourceType: "platform_event",
          sourceId: event.id,
          platform: "instagram",
          userId: actorUserId,
          caption,
          imageUrl: p.imageUrl,
          hashtags: ["BoostifyMusic", "MusicNFT", "CertificadoDigital"],
          priority: 3,
        });
      }

      // Notify followers via email
      const followers = await sql`
        SELECT su.email, su.id AS social_user_id
        FROM social_follows sf
        JOIN social_users su ON su.id = sf.follower_id
        WHERE sf.following_id = (
          SELECT id FROM social_users WHERE real_user_id=${actorUserId} LIMIT 1
        )
        AND su.email IS NOT NULL
        AND su.email_notifications_enabled = TRUE
        LIMIT 500
      `;

      for (const fan of followers) {
        await queueSocialNotification({
          recipientUserId: fan.social_user_id,
          recipientEmail: fan.email,
          type: "new_song",
          actorName: p.artistName || "Un artista",
          extraData: { songTitle: p.songTitle },
        });
      }
      break;
    }

    // ── Token Launched ───────────────────────────────────────────────────────
    case "token_launched": {
      if (!actorUserId) break;
      const caption = `🚀 ¡Nuevo token lanzado en @boostifymusic!\n\n$${p.tokenSymbol} — ${p.artistName}\nPrecio inicial: $${p.tokenPrice ?? "—"}\n\nInvierte en música real. 🎵\n\n#BoostifyMusic #MusicToken #Web3Music #NFT`;

      if (igConnectionExists) {
        await queueExternalPost({
          sourceType: "platform_event",
          sourceId: event.id,
          platform: "instagram",
          userId: actorUserId,
          caption,
          hashtags: ["BoostifyMusic", "MusicToken", "Web3Music"],
          priority: 2,
        });
      }
      break;
    }

    // ── Token Price Milestone ────────────────────────────────────────────────
    case "token_price_milestone": {
      if (!actorUserId) break;

      // Notify holders (users who bought this token)
      const holders = await sql`
        SELECT u.email, u.first_name, ts.symbol
        FROM token_purchases tp
        JOIN users u ON u.id = tp.buyer_user_id
        JOIN tokenized_songs ts ON ts.id = tp.song_id
        WHERE tp.artist_user_id = ${actorUserId}
          AND u.email IS NOT NULL
        LIMIT 500
      `.catch(() => []);

      for (const holder of holders) {
        const su = await sql`
          SELECT id FROM social_users WHERE real_user_id = (
            SELECT id FROM users WHERE email = ${holder.email} LIMIT 1
          ) LIMIT 1
        `.catch(() => []);
        if (!su.length) continue;

        await queueSocialNotification({
          recipientUserId: su[0].id,
          recipientEmail: holder.email,
          type: "token_alert",
          actorName: p.artistName || "Artista",
          extraData: { symbol: p.tokenSymbol, price: p.tokenPrice },
        });
      }
      break;
    }

    // ── Hologram Scheduled ───────────────────────────────────────────────────
    case "hologram_scheduled": {
      if (!actorUserId) break;
      const caption = `🎭 ¡Hologram Show confirmado!\n\n${p.artistName} — ${p.hologramDate ?? ""}\n📍 ${p.venueCity ?? "Próximamente"}\n\nReserva tu lugar en boostifymusic.com\n\n#HologramShow #BoostifyMusic #LiveMusic`;

      if (igConnectionExists) {
        await queueExternalPost({
          sourceType: "platform_event",
          sourceId: event.id,
          platform: "instagram",
          userId: actorUserId,
          caption,
          hashtags: ["HologramShow", "BoostifyMusic", "LiveMusic"],
          priority: 2,
        });
      }
      break;
    }

    // ── Promo Video Ready ────────────────────────────────────────────────────
    case "promo_video_ready": {
      if (!actorUserId || !igConnectionExists) break;
      const caption = `🎬 Nuevo video promocional disponible!\n\n"${p.songTitle}" — ${p.artistName}\n\nCreado con IA en Boostify Music 🤖🎵\n\n#BoostifyMusic #MusicVideo #AIMusic`;

      await queueExternalPost({
        sourceType: "platform_event",
        sourceId: event.id,
        platform: "instagram",
        userId: actorUserId,
        caption,
        videoUrl: p.videoUrl,
        hashtags: ["BoostifyMusic", "MusicVideo", "AIMusic"],
        priority: 4,
      });
      break;
    }

    // ── Viral Post ───────────────────────────────────────────────────────────
    case "post_viral": {
      // Notify post author that their post went viral
      if (!actorUserId) break;
      const [authorUser] = await sql`SELECT email FROM users WHERE id=${actorUserId} LIMIT 1`.catch(() => []);
      if (!authorUser?.email) break;

      const su = await sql`SELECT id FROM social_users WHERE real_user_id=${actorUserId} LIMIT 1`.catch(() => []);
      if (!su.length) break;

      await queueSocialNotification({
        recipientUserId: su[0].id,
        recipientEmail: authorUser.email,
        type: "viral_post",
        postId: p.postId as number,
        postContent: p.postContent as string,
        extraData: { likes: p.likes },
      });
      break;
    }

    default:
      break;
  }
}
