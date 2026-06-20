/**
 * event-api.ts
 * ────────────
 * All fetch helpers for the Cinematic Event Landing API (/api/events).
 * Auto-attaches the event-scoped guest JWT from sessionStorage.
 * Never touches Clerk/Firebase tokens.
 */

import { getGuestSession } from './event-guest-session';

const BASE = '/api/events';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CinematicPoster {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  align?: 'left' | 'center' | 'right';
  height?: 'sm' | 'md' | 'lg';
}

export interface FilmBook {
  images: string[];
  title?: string;
  subtitle?: string;
  available: boolean;
  price?: string;
  currency?: string;
  orderUrl?: string;
  comingSoonText?: string;
}

export interface EventPublicData {
  id: number;
  slug: string;
  event_title: string;
  event_subtitle: string | null;
  event_type: string;
  event_date: string | null;
  event_location: string | null;
  honoree_name: string | null;
  hero_image_url: string | null;
  hero_video_url: string | null;
  hero_media_type: string | null;
  linked_artist_id: number | null;
  linked_artist_slug: string | null;
  trailer_url: string | null;
  poster_url: string | null;
  background_music_url: string | null;
  tier: 'silver' | 'gold' | 'premiere';
  status: string;
  access_mode: 'open' | 'code' | 'list';
  // features — original
  feature_rsvp: boolean;
  feature_photo_booth: boolean;
  feature_soundtrack: boolean;
  feature_ai_scenes: boolean;
  feature_gallery: boolean;
  feature_memory_book: boolean;
  feature_after_movie: boolean;
  // features — new modules
  feature_story: boolean;
  feature_schedule: boolean;
  feature_dress_code: boolean;
  feature_venue: boolean;
  feature_vendors: boolean;
  feature_gift_registry: boolean;
  feature_messages: boolean;
  feature_decorations: boolean;
  // content
  ai_scenes_json: any[] | null;
  ai_song_json: any | null;
  after_movie_url: string | null;
  story_json: any | null;
  schedule_json: any[] | null;
  dress_code_json: any | null;
  venue_json: any | null;
  vendors_json: any[] | null;
  gift_registry_json: any[] | null;
  messages_json: any[] | null;
  decorations_json: any | null;
  interactive_config: any | null;
  cinematic_posters_json: CinematicPoster[] | null;
  film_book_json: FilmBook | null;
  // module order
  modules_config: string[] | null;
  // visual
  primary_color: string;
  accent_color: string;
  theme_preset: string;
  published_at: string | null;
}

export interface GuestLoginResult {
  guestToken: string;
  guestName: string;
  eventSlug: string;
}

export interface RsvpResult {
  success: boolean;
  rsvpId: number;
  qrData: string;
  message: string;
}

export interface Memory {
  id: number;
  guest_name: string;
  memory_type: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
}

export interface GalleryItem {
  id: number;
  guest_name: string | null;
  media_url: string;
  thumbnail_url: string | null;
  media_type: string;
  caption: string | null;
  is_featured: boolean;
  created_at: string;
}

export interface Dedication {
  id: number;
  guest_name: string;
  song_title: string;
  artist_name: string | null;
  dedication_message: string | null;
  spotify_url: string | null;
  youtube_url: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function guestHeaders(slug: string): HeadersInit {
  const session = getGuestSession(slug);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.guestToken) {
    headers['Authorization'] = `Bearer ${session.guestToken}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error((body as any).error || res.statusText), {
      status: res.status,
      requiresCode: (body as any).requiresCode ?? false,
    });
  }
  return res.json() as Promise<T>;
}

// ─── Public endpoints ─────────────────────────────────────────────────────────

export async function fetchEvent(slug: string): Promise<EventPublicData> {
  const res = await fetch(`${BASE}/${slug}`);
  const data = await handleResponse<{ event: EventPublicData }>(res);
  return data.event;
}

export async function guestLogin(
  slug: string,
  name: string,
  accessCode?: string
): Promise<GuestLoginResult> {
  const res = await fetch(`${BASE}/${slug}/guest-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, accessCode }),
  });
  return handleResponse<GuestLoginResult>(res);
}

export async function fetchRsvpCount(slug: string): Promise<number> {
  const res = await fetch(`${BASE}/${slug}/rsvps/count`);
  const data = await handleResponse<{ total: number }>(res);
  return data.total;
}

export async function fetchMemories(slug: string): Promise<Memory[]> {
  const res = await fetch(`${BASE}/${slug}/memories`);
  const data = await handleResponse<{ memories: Memory[] }>(res);
  return data.memories;
}

export async function fetchGallery(slug: string): Promise<GalleryItem[]> {
  const res = await fetch(`${BASE}/${slug}/gallery`);
  const data = await handleResponse<{ uploads: GalleryItem[] }>(res);
  return data.uploads;
}

export async function fetchDedications(slug: string): Promise<Dedication[]> {
  const res = await fetch(`${BASE}/${slug}/soundtrack`);
  const data = await handleResponse<{ dedications: Dedication[] }>(res);
  return data.dedications;
}

// ─── Guest-authenticated endpoints ───────────────────────────────────────────

export async function submitRsvp(
  slug: string,
  payload: {
    guestCount?: number;
    mealPreference?: 'meat' | 'fish' | 'vegetarian' | 'vegan' | 'none';
    message?: string;
    attending?: boolean;
    email?: string;
    phone?: string;
  }
): Promise<RsvpResult> {
  const res = await fetch(`${BASE}/${slug}/rsvp`, {
    method: 'POST',
    headers: guestHeaders(slug),
    body: JSON.stringify(payload),
  });
  return handleResponse<RsvpResult>(res);
}

export async function submitMemory(
  slug: string,
  payload: {
    type: 'text' | 'audio' | 'video' | 'signature';
    content?: string;
    mediaUrl?: string;
    signatureData?: string;
  }
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/${slug}/memory`, {
    method: 'POST',
    headers: guestHeaders(slug),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function submitDedication(
  slug: string,
  payload: {
    songTitle: string;
    artistName?: string;
    message?: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  }
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/${slug}/dedicate-song`, {
    method: 'POST',
    headers: guestHeaders(slug),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean }>(res);
}

// ─── Owner endpoints (uses Boostify Clerk token, not guest token) ─────────────

export async function createEvent(
  payload: {
    slug: string;
    eventTitle: string;
    eventType?: string;
    accessMode?: 'open' | 'code' | 'list';
    accessCode?: string;
    tier?: 'silver' | 'gold' | 'premiere';
    projectId?: number;
    [key: string]: any;
  },
  clerkToken: string
): Promise<{ id: number; slug: string }> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkToken}` },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ event: { id: number; slug: string } }>(res);
  return data.event;
}

export async function updateEvent(
  slug: string,
  payload: Record<string, any>,
  clerkToken: string
): Promise<void> {
  const res = await fetch(`${BASE}/${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkToken}` },
    body: JSON.stringify(payload),
  });
  await handleResponse<{ success: boolean }>(res);
}

export async function deleteEvent(
  slug: string,
  clerkToken: string
): Promise<void> {
  const res = await fetch(`${BASE}/${slug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${clerkToken}` },
  });
  await handleResponse<{ success: boolean }>(res);
}

export interface MyEventSummary {
  id: number;
  slug: string;
  event_title: string;
  event_subtitle: string | null;
  event_type: string;
  event_date: string | null;
  event_location: string | null;
  honoree_name: string | null;
  status: string;
  tier: string;
  access_mode: string;
  published_at: string | null;
  created_at: string;
  primary_color: string;
  accent_color: string;
  theme_preset: string;
  // features
  feature_rsvp: boolean;
  feature_photo_booth: boolean;
  feature_soundtrack: boolean;
  feature_ai_scenes: boolean;
  feature_gallery: boolean;
  feature_memory_book: boolean;
  feature_after_movie: boolean;
  feature_story: boolean;
  feature_schedule: boolean;
  feature_dress_code: boolean;
  feature_venue: boolean;
  feature_vendors: boolean;
  feature_gift_registry: boolean;
  feature_messages: boolean;
  feature_decorations: boolean;
  // content
  story_json: any | null;
  schedule_json: any[] | null;
  dress_code_json: any | null;
  venue_json: any | null;
  vendors_json: any[] | null;
  gift_registry_json: any[] | null;
  messages_json: any[] | null;
  decorations_json: any | null;
  interactive_config: any | null;
  ai_scenes_json: any[] | null;
  ai_song_json: any | null;
  after_movie_url: string | null;
  cinematic_posters_json: CinematicPoster[] | null;
  film_book_json: FilmBook | null;
  modules_config: string[] | null;
  // client
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_notes: string | null;
  // media
  hero_image_url: string | null;
  hero_video_url: string | null;
  hero_media_type: string | null;
  linked_artist_id: number | null;
  linked_artist_slug: string | null;
  trailer_url: string | null;
  poster_url: string | null;
  background_music_url: string | null;
}

export async function fetchMyEvents(clerkToken: string): Promise<MyEventSummary[]> {
  const res = await fetch(BASE, {
    headers: { Authorization: `Bearer ${clerkToken}` },
  });
  const data = await handleResponse<{ events: MyEventSummary[] }>(res);
  return data.events;
}

// ─── Owner admin view: registered guests / RSVPs ──────────────────────────────

/** A single guest registration (row from event_rsvps). */
export interface EventRsvp {
  id: number;
  event_id: number;
  guest_session_id: number | null;
  guest_name: string;
  guest_email: string | null;
  guest_phone: string | null;
  guest_count: number;
  meal_preference: string | null;
  message: string | null;
  attending: boolean;
  confirmed_at: string;
  qr_code_url: string | null;
  qr_code_data: string | null;
  created_at: string;
}

export interface EventAdminStats {
  confirmed_guests: number;
  memory_count: number;
  gallery_count: number;
  total_visitors: number;
}

export interface EventAdminData {
  event: MyEventSummary & Record<string, any>;
  rsvps: EventRsvp[];
  memories: Memory[];
  gallery: GalleryItem[];
  dedications: Dedication[];
  stats: EventAdminStats;
}

/**
 * Owner-only: fetch the full admin view of an event, including every guest
 * who registered (RSVPs), plus memories, gallery uploads, dedications and
 * aggregate stats. Requires the owner's Clerk token.
 */
export async function fetchEventAdmin(
  slug: string,
  clerkToken: string
): Promise<EventAdminData> {
  const res = await fetch(`${BASE}/${slug}/admin`, {
    headers: { Authorization: `Bearer ${clerkToken}` },
  });
  return handleResponse<EventAdminData>(res);
}

/**
 * Upload an image / video / audio file (as a base64 data URL) to Firebase
 * Storage via the events media endpoint. Returns a permanent public URL.
 */
export async function uploadEventMedia(
  fileData: string,
  fileName: string,
  clerkToken: string,
  kind?: 'image' | 'video' | 'audio'
): Promise<{ url: string; kind: string }> {
  const res = await fetch(`${BASE}/upload-media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkToken}` },
    body: JSON.stringify({ fileData, fileName, kind }),
  });
  const data = await handleResponse<{ url: string; kind: string }>(res);
  return data;
}

/** Improve an event text field with AI. Returns the improved text. */
export async function improveEventText(
  field: string,
  text: string,
  clerkToken: string,
  eventContext?: Record<string, any>
): Promise<string> {
  const res = await fetch(`${BASE}/ai/improve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkToken}` },
    body: JSON.stringify({ field, text, eventContext }),
  });
  const data = await handleResponse<{ improved: string }>(res);
  return data.improved;
}

/** AI-generated full event draft used to pre-fill the editor. */
export interface GeneratedEventDraft {
  eventTitle: string;
  eventSubtitle: string;
  honoreeName: string;
  eventType: string;
  themePreset: string;
  primaryColor: string;
  accentColor: string;
  story: { title: string; body: string; quote: string };
  schedule: Array<{ time: string; title: string; desc: string }>;
  dressCode: { note: string; palette: string[] };
}

/** Generate a complete event draft from a short prompt. */
export async function generateEventDraft(
  prompt: string,
  clerkToken: string,
  eventType?: string
): Promise<GeneratedEventDraft> {
  const res = await fetch(`${BASE}/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clerkToken}` },
    body: JSON.stringify({ prompt, eventType }),
  });
  const data = await handleResponse<{ draft: GeneratedEventDraft }>(res);
  return data.draft;
}
