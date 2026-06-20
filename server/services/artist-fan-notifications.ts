/**
 * Artist Fan Notifications
 * Sends emails to all active fans of an artist when events occur.
 */
import { db } from '../../db';
import { artistFanLeads } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import {
  sendFanNewSongEmail,
  sendFanNewNewsEmail,
} from './brevo-email-service';

export type FanEventType = 'new_song' | 'new_news';

export interface FanNotificationData {
  artistName: string;
  artistSlug: string;
  songTitle?: string;
  newsTitle?: string;
}

/**
 * Notify all active fans of an artist about an event (new song or news).
 * Fire-and-forget safe — errors are caught per-fan and logged without crashing.
 */
export async function notifyArtistFans(
  artistId: number,
  eventType: FanEventType,
  data: FanNotificationData
): Promise<void> {
  try {
    const fans = await db
      .select()
      .from(artistFanLeads)
      .where(and(eq(artistFanLeads.artistId, artistId), eq(artistFanLeads.isUnsubscribed, false)));

    if (!fans.length) return;

    console.log(`📣 [FanNotify] Notifying ${fans.length} fans of artist #${artistId} — event: ${eventType}`);

    for (const fan of fans) {
      try {
        if (eventType === 'new_song' && data.songTitle) {
          await sendFanNewSongEmail(fan.email, fan.name || '', data.artistName, data.songTitle, data.artistSlug);
        } else if (eventType === 'new_news' && data.newsTitle) {
          await sendFanNewNewsEmail(fan.email, fan.name || '', data.artistName, data.newsTitle, data.artistSlug);
        }
      } catch (err: any) {
        console.warn(`⚠️ [FanNotify] Failed to email fan ${fan.email}:`, err?.message);
      }
    }
  } catch (err: any) {
    console.error('❌ [FanNotify] Error querying fans:', err?.message);
  }
}
