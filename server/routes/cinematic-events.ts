/**
 * Cinematic Event Landing — Backend Routes
 * ─────────────────────────────────────────
 * /api/events/:slug        → Public: hero data
 * /api/events/:slug/login  → Guest login (isolated from Boostify auth)
 * /api/events/:slug/...    → Guest-authenticated actions
 * /api/events              → Owner-authenticated management (Boostify JWT)
 *
 * Guest session is a SEPARATE JWT signed with CINEMATIC_EVENT_JWT_SECRET.
 * It never touches Firebase or the Boostify `users` table.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { pool, db } from '../db';
import { authenticate } from '../middleware/auth';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../firebase';
import { callAI } from '../utils/smart-ai';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { isAdminEmail } from '../../shared/constants';
import { sendRsvpConfirmation, sendHostRsvpNotification, type EventForEmail } from '../services/event-email';

// OpenAI client (direct) — same setup used in Artist Profile generation that works reliably
const eventAiOpenAI = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const router = Router();

/**
 * Resolve the authenticated request to a guaranteed INTEGER Postgres user id.
 *
 * `req.user.id` may be either the integer PG id (when the Clerk user already
 * exists in the `users` table) or the raw Clerk user string (e.g. "user_2ab…")
 * when the user has not been provisioned yet. Inserting that string into the
 * INTEGER `owner_user_id` column throws ("invalid input syntax for type
 * integer"), which surfaced as the "token incorrect" error when creating an
 * event. Here we always return a valid integer, auto-provisioning the user
 * row from their Clerk identity when needed.
 */
async function getOwnerPgId(req: Request): Promise<number | null> {
  const u = (req as any).user;
  if (!u) return null;

  if (typeof u.id === 'number') return u.id;
  if (typeof u.id === 'string' && /^\d+$/.test(u.id)) return parseInt(u.id, 10);

  const clerkId: string | null =
    u.uid || u.clerkUserId || (typeof u.id === 'string' ? u.id : null);
  if (!clerkId) return null;

  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    if (existing) return existing.id;

    const [created] = await db
      .insert(users)
      .values({ clerkId, email: u.email ?? null, role: 'artist' })
      .returning({ id: users.id });
    return created?.id ?? null;
  } catch (err) {
    console.error('[cinematic-events] getOwnerPgId failed:', (err as Error).message);
    return null;
  }
}

/** True when the authenticated request belongs to a platform admin. */
function isEventAdmin(req: Request): boolean {
  const u = (req as any).user;
  if (u?.isAdmin === true) return true;
  const email = (u?.email ?? u?.primaryEmail ?? '').toString();
  return isAdminEmail(email);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GUEST_JWT_SECRET =
  process.env.CINEMATIC_EVENT_JWT_SECRET || 'cel-fallback-secret-change-in-prod';
const GUEST_JWT_EXPIRES = '7d';

// jose requires a Uint8Array key
const JWT_KEY = new TextEncoder().encode(GUEST_JWT_SECRET);

// ─── Guest JWT helpers ────────────────────────────────────────────────────────

interface GuestPayload {
  sub: string;   // sessionToken (UUID)
  event: string; // slug
  name: string;
  guestId: number;
}

async function signGuestToken(payload: GuestPayload): Promise<string> {
  return new SignJWT({ event: payload.event, name: payload.name, guestId: payload.guestId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(GUEST_JWT_EXPIRES)
    .sign(JWT_KEY);
}

async function verifyGuestToken(token: string): Promise<GuestPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_KEY, { algorithms: ['HS256'] });
    return {
      sub: payload.sub as string,
      event: payload['event'] as string,
      name: payload['name'] as string,
      guestId: payload['guestId'] as number,
    };
  } catch {
    return null;
  }
}

// ─── Access code hashing (Node.js built-in crypto, no extra deps) ─────────────

function hashAccessCode(code: string): string {
  // scryptSync: slow-hash suitable for low-entropy secrets (access codes)
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(code, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyAccessCode(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  try {
    const derived = crypto.scryptSync(code, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

// ─── Middleware: authenticate guest (isolated) ────────────────────────────────

function authenticateEventGuest(
  req: Request & { guestSession?: GuestPayload },
  res: Response,
  next: NextFunction
) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Guest token required' });
  }
  const token = auth.slice(7);
  verifyGuestToken(token).then((payload) => {
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired guest token' });
    }
    const slug = (req.params as any).slug;
    if (slug && payload.event !== slug) {
      return res.status(403).json({ error: 'Token does not match this event' });
    }
    (req as any).guestSession = payload;
    next();
  }).catch(() => res.status(401).json({ error: 'Invalid or expired guest token' }));
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const GuestLoginSchema = z.object({
  name: z.string().min(2).max(120),
  accessCode: z.string().optional(),
});

const RsvpSchema = z.object({
  guestCount: z.number().int().min(1).max(20).default(1),
  mealPreference: z.enum(['meat', 'fish', 'vegetarian', 'vegan', 'none']).optional(),
  message: z.string().max(500).optional(),
  attending: z.boolean().default(true),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
});

const MemorySchema = z.object({
  type: z.enum(['text', 'audio', 'video', 'signature']).default('text'),
  content: z.string().max(1000).optional(),
  mediaUrl: z.string().url().optional(),
  signatureData: z.string().optional(),
});

const DedicationSchema = z.object({
  songTitle: z.string().min(1).max(200),
  artistName: z.string().max(200).optional(),
  message: z.string().max(300).optional(),
  spotifyUrl: z.string().url().optional(),
  youtubeUrl: z.string().url().optional(),
});

const CreateEventSchema = z.object({
  slug: z.string()
    .min(3).max(120)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers and hyphens only'),
  eventTitle: z.string().min(2).max(200),
  eventSubtitle: z.string().max(300).optional(),
  eventType: z.enum(['quinceanera', 'wedding', 'corporate', 'premiere', 'other']).default('quinceanera'),
  eventDate: z.string().optional(),
  eventLocation: z.string().max(300).optional(),
  honoreeName: z.string().max(200).optional(),
  accessMode: z.enum(['open', 'code', 'list']).default('open'),
  accessCode: z.string().min(4).max(50).optional(),
  tier: z.enum(['silver', 'gold', 'premiere']).default('silver'),
  projectId: z.number().int().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  themePreset: z.string().optional(),
}).passthrough(); // allow extra config fields (features, modules, media, content) to be applied after insert

/**
 * Columns that may be set/updated from a camelCase request body. Shared by the
 * POST (create) and PATCH (update) handlers so the full event configuration —
 * modules, features, media, content and the new hero-video / linked-artist
 * fields — is persisted in a single place.
 */
const PATCHABLE_COLUMNS = [
  'event_title', 'event_subtitle', 'event_date', 'event_location',
  'honoree_name', 'hero_image_url', 'hero_video_url', 'hero_media_type',
  'trailer_url', 'poster_url', 'background_music_url', 'status',
  'feature_rsvp', 'feature_photo_booth', 'feature_soundtrack',
  'feature_ai_scenes', 'feature_gallery', 'feature_memory_book',
  'feature_after_movie', 'feature_story', 'feature_schedule',
  'feature_dress_code', 'feature_venue', 'feature_vendors',
  'feature_gift_registry', 'feature_messages', 'feature_decorations',
  'primary_color', 'accent_color', 'theme_preset',
  'ai_scenes_json', 'ai_song_json', 'after_movie_url', 'after_movie_json',
  'story_json', 'schedule_json', 'dress_code_json', 'venue_json',
  'vendors_json', 'gift_registry_json', 'messages_json', 'decorations_json',
  'cinematic_posters_json',
  'film_book_json',
  'interactive_config',
  'modules_config',
  'linked_artist_id', 'linked_artist_slug',
  'client_name', 'client_email', 'client_phone', 'client_notes',
];

/** Columns stored as JSON/JSONB — objects & arrays must be serialized before
 * being sent to node-postgres, otherwise JS arrays become Postgres array
 * literals ("{...}") and the jsonb column rejects them ("invalid input syntax for type json"). */
const JSON_COLUMNS = new Set([
  'ai_scenes_json', 'ai_song_json', 'after_movie_json',
  'story_json', 'schedule_json', 'dress_code_json', 'venue_json',
  'vendors_json', 'gift_registry_json', 'messages_json', 'decorations_json',
  'cinematic_posters_json',
  'film_book_json',
  'interactive_config', 'modules_config',
]);

/** Apply allowed camelCase body fields to an event row. Returns affected count. */
async function applyEventFields(eventId: number, body: Record<string, any>): Promise<void> {
  const toSnake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();
  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [key, val] of Object.entries(body)) {
    const col = toSnake(key);
    if (PATCHABLE_COLUMNS.includes(col)) {
      setClauses.push(`${col} = $${idx++}`);
      // Serialize objects/arrays destined for JSON/JSONB columns.
      if (JSON_COLUMNS.has(col) && val !== null && typeof val === 'object') {
        values.push(JSON.stringify(val));
      } else {
        values.push(val);
      }
    }
  }
  if (setClauses.length === 0) return;
  setClauses.push(`updated_at = NOW()`);
  values.push(eventId);
  await pool.query(
    `UPDATE cinematic_event_landings SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    values
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/events/:slug
 * Returns public-safe event data (hero section, trailer, countdown).
 * Does NOT expose access codes, guest list, or internal data.
 */
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         id, slug, event_title, event_subtitle, event_type, event_date,
         event_location, honoree_name, hero_image_url, hero_video_url,
         hero_media_type, trailer_url, linked_artist_id, linked_artist_slug,
         poster_url, background_music_url, tier, status,
         feature_rsvp, feature_photo_booth, feature_soundtrack,
         feature_ai_scenes, feature_gallery, feature_memory_book, feature_after_movie,
         feature_story, feature_schedule, feature_dress_code,
         feature_venue, feature_vendors, feature_gift_registry,
         feature_messages, feature_decorations,
         ai_scenes_json, ai_song_json, after_movie_url,
         story_json, schedule_json, dress_code_json,
         venue_json, vendors_json, gift_registry_json,
         messages_json, decorations_json,
         cinematic_posters_json,
         film_book_json,
         interactive_config,
         modules_config,
         primary_color, accent_color, theme_preset, access_mode, published_at
       FROM cinematic_event_landings
       WHERE slug = $1 AND status = 'published'`,
      [slug]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event: result.rows[0] });
  } catch (err) {
    console.error('[cinematic-events] GET /:slug', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/events/:slug/guest-login
 * Validates guest name + optional access code.
 * Returns a short-lived event-scoped JWT that is completely isolated
 * from the main Boostify Firebase/Clerk session.
 */
router.post('/:slug/guest-login', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const parsed = GuestLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }
  const { name, accessCode } = parsed.data;

  try {
    const eventResult = await pool.query(
      `SELECT id, access_mode, access_code_hash, status
       FROM cinematic_event_landings WHERE slug = $1`,
      [slug]
    );
    const event = eventResult.rows[0];
    if (!event || event.status !== 'published') {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Validate access code if required
    if (event.access_mode === 'code') {
      if (!accessCode) {
        return res.status(403).json({ error: 'Access code required', requiresCode: true });
      }
      if (!event.access_code_hash) {
        return res.status(500).json({ error: 'Event configuration error' });
      }
      const valid = verifyAccessCode(accessCode, event.access_code_hash);
      if (!valid) {
        return res.status(403).json({ error: 'Incorrect access code', requiresCode: true });
      }
    }

    // Create or retrieve guest session
    const sessionToken = crypto.randomUUID();
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket.remoteAddress || 'unknown';

    const insertResult = await pool.query(
      `INSERT INTO event_guest_sessions
         (event_id, guest_name, session_token, last_seen_at, user_agent, ip_address)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING id`,
      [event.id, name.trim(), sessionToken, req.headers['user-agent'] ?? null, ipAddress]
    );
    const guestId = insertResult.rows[0].id;

    const guestToken = await signGuestToken({
      sub: sessionToken,
      event: slug,
      name: name.trim(),
      guestId,
    });

    res.json({ guestToken, guestName: name.trim(), eventSlug: slug });
  } catch (err) {
    console.error('[cinematic-events] POST /:slug/guest-login', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GUEST-AUTHENTICATED ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/events/:slug/me
 * Returns current guest session info.
 */
router.get('/:slug/me', authenticateEventGuest, async (req: Request, res: Response) => {
  const gs = (req as any).guestSession as GuestPayload;
  res.json({ guestId: gs.guestId, guestName: gs.name, eventSlug: gs.event });
});

/**
 * POST /api/events/:slug/rsvp
 */
router.post('/:slug/rsvp', authenticateEventGuest, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const gs = (req as any).guestSession as GuestPayload;
  const parsed = RsvpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }
  const { guestCount, mealPreference, message, attending, email, phone } = parsed.data;

  try {
    const eventResult = await pool.query(
      `SELECT id, slug, event_title, event_subtitle, event_type, event_date,
              event_location, honoree_name, hero_image_url, accent_color
         FROM cinematic_event_landings WHERE slug = $1 AND status = 'published'`,
      [slug]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
    const eventRow = eventResult.rows[0];
    const eventId = eventRow.id;

    // Idempotent: update if already RSVPed
    const existing = await pool.query(
      `SELECT id FROM event_rsvps WHERE event_id = $1 AND guest_session_id = $2`,
      [eventId, gs.guestId]
    );

    let rsvpId: number;
    if (existing.rows[0]) {
      await pool.query(
        `UPDATE event_rsvps SET guest_count=$1, meal_preference=$2, message=$3,
         attending=$4, guest_email=$5, guest_phone=$6, confirmed_at=NOW()
         WHERE id=$7`,
        [guestCount, mealPreference ?? null, message ?? null, attending, email ?? null, phone ?? null, existing.rows[0].id]
      );
      rsvpId = existing.rows[0].id;
    } else {
      const ins = await pool.query(
        `INSERT INTO event_rsvps
           (event_id, guest_session_id, guest_name, guest_email, guest_phone,
            guest_count, meal_preference, message, attending)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [eventId, gs.guestId, gs.name, email ?? null, phone ?? null,
         guestCount, mealPreference ?? null, message ?? null, attending]
      );
      rsvpId = ins.rows[0].id;
    }

    // Generate simple QR code data string (URL with rsvp id)
    const qrData = `${process.env.APP_BASE_URL || 'https://boostify.com'}/event/${slug}?rsvp=${rsvpId}`;
    await pool.query(`UPDATE event_rsvps SET qr_code_data=$1 WHERE id=$2`, [qrData, rsvpId]);

    // ── Smart messaging: confirmation email + calendar reminders (fire-and-forget) ──
    if (email) {
      const eventForEmail: EventForEmail = {
        id: eventRow.id,
        slug: eventRow.slug,
        event_title: eventRow.event_title,
        event_subtitle: eventRow.event_subtitle,
        event_type: eventRow.event_type,
        event_date: eventRow.event_date,
        event_location: eventRow.event_location,
        honoree_name: eventRow.honoree_name,
        hero_image_url: eventRow.hero_image_url,
        accent_color: eventRow.accent_color,
      };

      // Generate a warm AI-personalized line, then send emails. Don't block the response.
      (async () => {
        let smartNote: string | undefined;
        try {
          const completion = await eventAiOpenAI.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.8,
            max_tokens: 70,
            messages: [
              {
                role: 'system',
                content:
                  'Eres un anfitrión cálido. Escribe UNA sola frase breve (máx 22 palabras), en español, ' +
                  'cariñosa y elegante, para confirmar la asistencia de un invitado a un evento. ' +
                  'Sin comillas, sin emojis, sin saludos ni firmas.',
              },
              {
                role: 'user',
                content:
                  `Evento: "${eventRow.event_title}"${eventRow.event_type ? ` (${eventRow.event_type})` : ''}. ` +
                  `Invitado: ${gs.name}. ${attending ? 'Confirmó que asistirá.' : 'No podrá asistir.'}`,
              },
            ],
          });
          smartNote = completion.choices[0]?.message?.content?.trim() || undefined;
        } catch (e) {
          console.warn('[cinematic-events] smart note generation failed, using template only');
        }

        try {
          await sendRsvpConfirmation({
            to: email,
            guestName: gs.name,
            event: eventForEmail,
            attending,
            guestCount,
            smartNote,
          });
        } catch (e) {
          console.error('[cinematic-events] RSVP confirmation email failed', e);
        }

        // Notify the host/admin
        const hostEmail = process.env.EVENT_NOTIFY_EMAIL || 'convoycubano@gmail.com';
        try {
          await sendHostRsvpNotification({
            to: hostEmail,
            event: eventForEmail,
            guestName: gs.name,
            guestEmail: email,
            guestPhone: phone,
            guestCount,
            attending,
            message,
            mealPreference,
          });
        } catch (e) {
          console.error('[cinematic-events] host RSVP notification failed', e);
        }
      })();
    }

    res.json({ success: true, rsvpId, qrData, message: 'RSVP confirmed!' });
  } catch (err) {
    console.error('[cinematic-events] POST /:slug/rsvp', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/events/:slug/memory
 */
router.post('/:slug/memory', authenticateEventGuest, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const gs = (req as any).guestSession as GuestPayload;
  const parsed = MemorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }

  try {
    const eventResult = await pool.query(
      `SELECT id FROM cinematic_event_landings WHERE slug = $1 AND status = 'published'`,
      [slug]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });

    await pool.query(
      `INSERT INTO event_memories
         (event_id, guest_session_id, guest_name, memory_type, content, media_url, signature_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [eventResult.rows[0].id, gs.guestId, gs.name,
       parsed.data.type, parsed.data.content ?? null,
       parsed.data.mediaUrl ?? null, parsed.data.signatureData ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[cinematic-events] POST /:slug/memory', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/events/:slug/dedicate-song
 */
router.post('/:slug/dedicate-song', authenticateEventGuest, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const gs = (req as any).guestSession as GuestPayload;
  const parsed = DedicationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }

  try {
    const eventResult = await pool.query(
      `SELECT id FROM cinematic_event_landings WHERE slug = $1 AND status = 'published'`,
      [slug]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });

    await pool.query(
      `INSERT INTO event_soundtrack_dedications
         (event_id, guest_session_id, guest_name, song_title, artist_name,
          dedication_message, spotify_url, youtube_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [eventResult.rows[0].id, gs.guestId, gs.name,
       parsed.data.songTitle, parsed.data.artistName ?? null,
       parsed.data.message ?? null, parsed.data.spotifyUrl ?? null,
       parsed.data.youtubeUrl ?? null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[cinematic-events] POST /:slug/dedicate-song', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/events/:slug/rsvps  (public count only)
 * GET /api/events/:slug/memories (approved only)
 */
router.get('/:slug/rsvps/count', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const r = await pool.query(
      `SELECT COUNT(*) as total FROM event_rsvps er
       JOIN cinematic_event_landings cel ON cel.id = er.event_id
       WHERE cel.slug = $1 AND er.attending = TRUE`,
      [slug]
    );
    res.json({ total: parseInt(r.rows[0].total, 10) });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/:slug/memories', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const r = await pool.query(
      `SELECT em.id, em.guest_name, em.memory_type, em.content, em.media_url, em.created_at
       FROM event_memories em
       JOIN cinematic_event_landings cel ON cel.id = em.event_id
       WHERE cel.slug = $1 AND em.is_approved = TRUE
       ORDER BY em.created_at DESC LIMIT 50`,
      [slug]
    );
    res.json({ memories: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/:slug/gallery', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const r = await pool.query(
      `SELECT egu.id, egu.guest_name, egu.media_url, egu.thumbnail_url,
              egu.media_type, egu.caption, egu.is_featured, egu.created_at
       FROM event_gallery_uploads egu
       JOIN cinematic_event_landings cel ON cel.id = egu.event_id
       WHERE cel.slug = $1 AND egu.is_approved = TRUE
       ORDER BY egu.is_featured DESC, egu.created_at DESC LIMIT 100`,
      [slug]
    );
    res.json({ uploads: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

router.get('/:slug/soundtrack', async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const r = await pool.query(
      `SELECT esd.id, esd.guest_name, esd.song_title, esd.artist_name,
              esd.dedication_message, esd.spotify_url, esd.youtube_url, esd.created_at
       FROM event_soundtrack_dedications esd
       JOIN cinematic_event_landings cel ON cel.id = esd.event_id
       WHERE cel.slug = $1
       ORDER BY esd.created_at DESC LIMIT 100`,
      [slug]
    );
    res.json({ dedications: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OWNER-AUTHENTICATED ENDPOINTS (Boostify auth required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/events
 * Create a new cinematic event landing.
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const parsed = CreateEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
  }
  const data = parsed.data;

  try {
    // Hash access code if provided
    let accessCodeHash: string | null = null;
    if (data.accessMode === 'code' && data.accessCode) {
      accessCodeHash = hashAccessCode(data.accessCode);
    }

    const ownerId = await getOwnerPgId(req);
    if (!ownerId) {
      return res.status(401).json({ error: 'Could not resolve your account. Please sign in again.' });
    }

    const result = await pool.query(
      `INSERT INTO cinematic_event_landings
         (project_id, owner_user_id, slug, event_title, event_subtitle, event_type,
          event_date, event_location, honoree_name, access_mode, access_code_hash,
          tier, primary_color, accent_color, theme_preset, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft')
       RETURNING id, slug`,
      [
        data.projectId ?? null, ownerId, data.slug, data.eventTitle,
        data.eventSubtitle ?? null, data.eventType,
        data.eventDate ? new Date(data.eventDate) : null,
        data.eventLocation ?? null, data.honoreeName ?? null,
        data.accessMode, accessCodeHash, data.tier,
        data.primaryColor ?? '#1a0533', data.accentColor ?? '#c9a84c',
        data.themePreset ?? 'dark_luxury',
      ]
    );

    // Persist the rest of the configuration (features, modules, content, media,
    // hero video, linked artist) sent with the create request so the event is
    // fully configured immediately — not just the core fields.
    const created = result.rows[0];
    try {
      await applyEventFields(created.id, req.body as Record<string, any>);
    } catch (cfgErr) {
      console.error('[cinematic-events] POST / applyEventFields:', (cfgErr as Error).message);
    }

    res.status(201).json({ event: created });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An event with this slug already exists' });
    }
    console.error('[cinematic-events] POST /', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * PATCH /api/events/:slug
 * Update event config. Owner only.
 */
router.patch('/:slug', authenticate, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const ownerId = await getOwnerPgId(req);
  try {
    const eventResult = await pool.query(
      `SELECT id, owner_user_id FROM cinematic_event_landings WHERE slug = $1`,
      [slug]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
    if (!isEventAdmin(req) && ownerId && eventResult.rows[0].owner_user_id !== ownerId) {
      // Platform admins bypass ownership; everyone else must own the event.
      return res.status(403).json({ error: 'Not authorized' });
    }

    const eventId = eventResult.rows[0].id;
    const body = req.body as Record<string, any>;

    // Determine if any patchable fields were provided.
    const toSnake = (s: string) => s.replace(/([A-Z])/g, '_$1').toLowerCase();
    const hasValidField = Object.keys(body).some(k => PATCHABLE_COLUMNS.includes(toSnake(k)));
    // Access mode / code are handled separately (need hashing) — allow them to count as a valid update too.
    const hasAccessChange =
      typeof body.accessMode === 'string' || typeof body.accessCode === 'string';
    if (!hasValidField && !hasAccessChange) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await applyEventFields(eventId, body);

    // Update access mode / code (hashed). 'code' mode with a new code re-hashes;
    // switching away from 'code' clears the stored hash.
    if (hasAccessChange) {
      const mode = typeof body.accessMode === 'string' ? body.accessMode : undefined;
      if (mode === 'code') {
        if (typeof body.accessCode === 'string' && body.accessCode.trim().length >= 4) {
          await pool.query(
            `UPDATE cinematic_event_landings SET access_mode = 'code', access_code_hash = $1, updated_at = NOW() WHERE id = $2`,
            [hashAccessCode(body.accessCode.trim()), eventId]
          );
        } else {
          // Keep existing hash, just ensure the mode is set.
          await pool.query(
            `UPDATE cinematic_event_landings SET access_mode = 'code', updated_at = NOW() WHERE id = $1`,
            [eventId]
          );
        }
      } else if (mode === 'open' || mode === 'list') {
        await pool.query(
          `UPDATE cinematic_event_landings SET access_mode = $1, access_code_hash = NULL, updated_at = NOW() WHERE id = $2`,
          [mode, eventId]
        );
      }
    }

    // If publishing, set published_at
    if (body.status === 'published') {
      await pool.query(
        `UPDATE cinematic_event_landings SET published_at = NOW() WHERE id = $1 AND published_at IS NULL`,
        [eventId]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[cinematic-events] PATCH /:slug', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/events/:slug/admin
 * Full admin view: event + all RSVPs + stats.
 */
router.get('/:slug/admin', authenticate, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const ownerId = await getOwnerPgId(req);

  try {
    const eventResult = await pool.query(
      `SELECT * FROM cinematic_event_landings WHERE slug = $1`,
      [slug]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
    if (!isEventAdmin(req) && ownerId && eventResult.rows[0].owner_user_id !== ownerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const eventId = eventResult.rows[0].id;

    const [rsvps, memories, gallery, dedications, stats] = await Promise.all([
      pool.query(`SELECT * FROM event_rsvps WHERE event_id = $1 ORDER BY created_at DESC`, [eventId]),
      pool.query(`SELECT * FROM event_memories WHERE event_id = $1 ORDER BY created_at DESC`, [eventId]),
      pool.query(`SELECT * FROM event_gallery_uploads WHERE event_id = $1 ORDER BY created_at DESC`, [eventId]),
      pool.query(`SELECT * FROM event_soundtrack_dedications WHERE event_id = $1 ORDER BY created_at DESC`, [eventId]),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM event_rsvps WHERE event_id = $1 AND attending = TRUE) AS confirmed_guests,
           (SELECT COUNT(*) FROM event_memories WHERE event_id = $1) AS memory_count,
           (SELECT COUNT(*) FROM event_gallery_uploads WHERE event_id = $1) AS gallery_count,
           (SELECT COUNT(*) FROM event_guest_sessions WHERE event_id = $1) AS total_visitors`,
        [eventId]
      ),
    ]);

    res.json({
      event: eventResult.rows[0],
      rsvps: rsvps.rows,
      memories: memories.rows,
      gallery: gallery.rows,
      dedications: dedications.rows,
      stats: stats.rows[0],
    });
  } catch (err) {
    console.error('[cinematic-events] GET /:slug/admin', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/events
 * List all events owned by the current user.
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const ownerId = await getOwnerPgId(req);
  if (!ownerId) return res.status(401).json({ error: 'Not authenticated' });
  const admin = isEventAdmin(req);
  try {
    const r = await pool.query(
      `SELECT id, slug, event_title, event_subtitle, event_type, event_date,
              event_location, honoree_name, status, tier, access_mode,
              published_at, created_at, updated_at,
              primary_color, accent_color, theme_preset,
              hero_image_url, hero_video_url, hero_media_type,
              trailer_url, background_music_url, linked_artist_id, linked_artist_slug,
              feature_rsvp, feature_photo_booth, feature_soundtrack,
              feature_ai_scenes, feature_gallery, feature_memory_book, feature_after_movie,
              feature_story, feature_schedule, feature_dress_code,
              feature_venue, feature_vendors, feature_gift_registry,
              feature_messages, feature_decorations,
              story_json, schedule_json, dress_code_json,
              venue_json, vendors_json, gift_registry_json,
              messages_json, decorations_json,
              interactive_config,
              ai_scenes_json, ai_song_json, after_movie_url,
              modules_config,
              client_name, client_email, client_phone, client_notes
       FROM cinematic_event_landings
       ${admin ? '' : 'WHERE owner_user_id = $1'}
       ORDER BY created_at DESC`,
      admin ? [] : [ownerId]
    );
    res.json({ events: r.rows });
  } catch (err) {
    console.error('[cinematic-events] GET /', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * DELETE /api/events/:slug
 * Permanently delete an event and all its related guest data. Owner only.
 */
router.delete('/:slug', authenticate, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const ownerId = await getOwnerPgId(req);
  try {
    const eventResult = await pool.query(
      `SELECT id, owner_user_id FROM cinematic_event_landings WHERE slug = $1`,
      [slug]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Event not found' });
    if (!isEventAdmin(req) && ownerId && eventResult.rows[0].owner_user_id !== ownerId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const eventId = eventResult.rows[0].id;

    // Remove related guest data first to satisfy FK constraints
    await pool.query(`DELETE FROM event_rsvps WHERE event_id = $1`, [eventId]);
    await pool.query(`DELETE FROM event_memories WHERE event_id = $1`, [eventId]);
    await pool.query(`DELETE FROM event_gallery_uploads WHERE event_id = $1`, [eventId]);
    await pool.query(`DELETE FROM event_soundtrack_dedications WHERE event_id = $1`, [eventId]);
    await pool.query(`DELETE FROM event_guest_sessions WHERE event_id = $1`, [eventId]);
    await pool.query(`DELETE FROM cinematic_event_landings WHERE id = $1`, [eventId]);

    res.json({ success: true });
  } catch (err) {
    console.error('[cinematic-events] DELETE /:slug', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/events/ai/improve
 * Improve an event text field with AI (English copywriting for events).
 * Body: { field, text, eventContext? }
 */
router.post('/ai/improve', authenticate, async (req: Request, res: Response) => {
  try {
    const { field, text, eventContext } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }
    const fieldLabel = typeof field === 'string' && field.trim() ? field.trim() : 'text';
    const contextLine =
      eventContext && typeof eventContext === 'object'
        ? `Event context: ${JSON.stringify(eventContext).slice(0, 800)}`
        : '';

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an elite event copywriter for luxury, cinematic event landing pages. ' +
          'Rewrite the provided text so it is elegant, emotionally compelling, concise and in polished English. ' +
          'Keep it appropriate for the specified field. Do NOT add quotes, labels, markdown or explanations. ' +
          'Return ONLY the improved text.',
      },
      {
        role: 'user' as const,
        content:
          `Field: ${fieldLabel}\n${contextLine}\n\nOriginal text:\n"""${text.slice(0, 4000)}"""\n\nImproved text:`,
      },
    ];

    const completion = await eventAiOpenAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 600,
    });
    const improved = completion.choices[0]?.message?.content ?? '';

    const cleaned = String(improved || '').trim().replace(/^["']|["']$/g, '').trim();
    if (!cleaned) return res.status(502).json({ error: 'AI returned empty result' });
    res.json({ improved: cleaned });
  } catch (err) {
    console.error('[cinematic-events] POST /ai/improve', err);
    res.status(500).json({ error: 'AI improvement failed' });
  }
});

/**
 * POST /api/events/ai/generate
 * Generate a complete event draft from a short natural-language prompt.
 * Body: { prompt, eventType? }
 * Returns structured JSON the editor can use to pre-fill every tab.
 */
router.post('/ai/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt, eventType } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const messages = [
      {
        role: 'system' as const,
        content:
          'You are an elite event designer for luxury, cinematic event landing pages. ' +
          'From a short brief you produce a complete, polished event concept in elegant English. ' +
          'You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no commentary) ' +
          'matching exactly this TypeScript shape:\n' +
          '{\n' +
          '  "eventTitle": string,\n' +
          '  "eventSubtitle": string,\n' +
          '  "honoreeName": string,\n' +
          '  "eventType": "quinceanera"|"wedding"|"premiere"|"corporate"|"other",\n' +
          '  "themePreset": "dark_luxury"|"rose_gold"|"midnight"|"champagne"|"emerald",\n' +
          '  "primaryColor": string,\n' +
          '  "accentColor": string,\n' +
          '  "story": { "title": string, "body": string, "quote": string },\n' +
          '  "schedule": [ { "time": string, "title": string, "desc": string } ],\n' +
          '  "dressCode": { "note": string, "palette": string[] }\n' +
          '}\n' +
          'eventTitle: short and evocative. eventSubtitle: one elegant line. honoreeName: "" if not applicable. ' +
          'primaryColor: dark background hex. accentColor: elegant accent hex. schedule: 3-6 items with 24h times. ' +
          'dressCode.palette: 2-4 hex colors. Keep all text refined and emotionally compelling. ' +
          'Never invent real personal data beyond what the brief implies.',
      },
      {
        role: 'user' as const,
        content:
          `Brief: ${prompt.slice(0, 1500)}\n` +
          (eventType ? `Preferred event type: ${eventType}\n` : '') +
          'Return ONLY the JSON object.',
      },
    ];

    const completion = await eventAiOpenAI.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      temperature: 0.85,
      max_tokens: 1400,
    });
    const raw = completion.choices[0]?.message?.content ?? '';

    let jsonText = String(raw || '').trim();
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = jsonText.indexOf('{');
    const last = jsonText.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      jsonText = jsonText.slice(first, last + 1);
    }

    let draft: any;
    try {
      draft = JSON.parse(jsonText);
    } catch {
      return res.status(502).json({ error: 'AI returned malformed JSON' });
    }

    const safeStr = (v: any) => (typeof v === 'string' ? v : '');
    const result = {
      eventTitle: safeStr(draft.eventTitle).slice(0, 120),
      eventSubtitle: safeStr(draft.eventSubtitle).slice(0, 200),
      honoreeName: safeStr(draft.honoreeName).slice(0, 120),
      eventType: ['quinceanera', 'wedding', 'premiere', 'corporate', 'other'].includes(draft.eventType)
        ? draft.eventType
        : (eventType || 'other'),
      themePreset: ['dark_luxury', 'rose_gold', 'midnight', 'champagne', 'emerald'].includes(draft.themePreset)
        ? draft.themePreset
        : 'dark_luxury',
      primaryColor: /^#[0-9a-f]{3,8}$/i.test(safeStr(draft.primaryColor)) ? draft.primaryColor : '#1a0533',
      accentColor: /^#[0-9a-f]{3,8}$/i.test(safeStr(draft.accentColor)) ? draft.accentColor : '#c9a84c',
      story: {
        title: safeStr(draft?.story?.title).slice(0, 120),
        body: safeStr(draft?.story?.body).slice(0, 4000),
        quote: safeStr(draft?.story?.quote).slice(0, 300),
      },
      schedule: Array.isArray(draft.schedule)
        ? draft.schedule.slice(0, 8).map((s: any) => ({
            time: safeStr(s?.time).slice(0, 12),
            title: safeStr(s?.title).slice(0, 120),
            desc: safeStr(s?.desc).slice(0, 300),
          }))
        : [],
      dressCode: {
        note: safeStr(draft?.dressCode?.note).slice(0, 400),
        palette: Array.isArray(draft?.dressCode?.palette)
          ? draft.dressCode.palette.filter((c: any) => /^#[0-9a-f]{3,8}$/i.test(String(c))).slice(0, 4)
          : [],
      },
    };

    res.json({ draft: result });
  } catch (err) {
    console.error('[cinematic-events] POST /ai/generate', err);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

/**
 * POST /api/events/upload-media
 * Upload a base64 image / video / audio file to Firebase Storage and return a public URL.
 * Body: { fileData (data URL or raw base64), fileName, kind? ('image'|'video'|'audio') }
 */
router.post('/upload-media', authenticate, async (req: Request, res: Response) => {
  try {
    const { fileData, fileName, kind } = req.body || {};
    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData and fileName are required' });
    }

    let mimeType = '';
    let base64Body = String(fileData);
    const dataUrlMatch = base64Body.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.*)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Body = dataUrlMatch[2];
    }

    if (!/^(image|video|audio)\//i.test(mimeType)) {
      return res.status(400).json({ error: `Unsupported media type: ${mimeType || 'unknown'}` });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Body, 'base64');
    } catch {
      return res.status(400).json({ error: 'fileData is not valid base64' });
    }

    // Caps: 15MB images/audio, 250MB video (~5 min at 1080p).
    const isVideo = /^video\//i.test(mimeType);
    const cap = isVideo ? 250 * 1024 * 1024 : 15 * 1024 * 1024;
    if (buffer.length > cap) {
      return res.status(413).json({ error: `File too large (max ${cap / (1024 * 1024)}MB).` });
    }

    if (!storage) {
      return res.status(503).json({ error: 'Storage not configured on server' });
    }

    const ext =
      (fileName && fileName.includes('.') ? fileName.split('.').pop() : '') ||
      mimeType.split('/')[1].replace('+xml', '');
    const safeBase =
      String(fileName || 'media')
        .replace(/\.[^.]+$/, '')
        .replace(/[^\w\-]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80) || 'media';
    const objectPath = `event-media/${Date.now()}-${crypto
      .randomBytes(4)
      .toString('hex')}-${safeBase}.${ext}`;

    const bucket = storage.bucket();
    const file = bucket.file(objectPath);
    const downloadToken = crypto.randomUUID();

    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedBy: (req as any).user?.uid || (req as any).user?.id || 'unknown',
          originalName: String(fileName).slice(0, 200),
        },
      },
    });

    try {
      await file.makePublic();
    } catch {
      // Uniform bucket-level access — token URL is sufficient.
    }

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;
    const resolvedKind = isVideo ? 'video' : /^audio\//i.test(mimeType) ? 'audio' : 'image';

    res.json({ success: true, url: publicUrl, path: objectPath, kind: kind || resolvedKind });
  } catch (err: any) {
    console.error('[cinematic-events] POST /upload-media', err);
    res.status(500).json({ error: err?.message || 'Failed to upload media' });
  }
});

export default router;