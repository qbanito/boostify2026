/**
 * BOOSTIFY — YouTube OAuth & upload service
 *
 * Stores each artist's YouTube OAuth2 tokens (server-side) so the karaoke /
 * lyrics-video module can render a lyric video and publish it to the artist's
 * channel without the browser ever handling the access token.
 *
 * Required env (uploading needs a real Google OAuth2 *client*, not just an API key):
 *   GOOGLE_CLIENT_ID      (or YOUTUBE_CLIENT_ID)
 *   GOOGLE_CLIENT_SECRET  (or YOUTUBE_CLIENT_SECRET)
 *   GOOGLE_OAUTH_REDIRECT (optional — defaults to <baseUrl>/api/auth/youtube/callback)
 *
 * When these are not configured every function degrades gracefully so the rest
 * of the app keeps working (the UI shows a "needs setup" state).
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pool } from '../db';

const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',          // manage channel: branding (banner/portada), thumbnails
  'https://www.googleapis.com/auth/youtube.force-ssl', // escribir comentarios (commentThreads.insert)
  'https://www.googleapis.com/auth/youtube.readonly',
];

/** Scope that allows updating channel branding + setting custom thumbnails. */
const YT_MANAGE_SCOPE = 'https://www.googleapis.com/auth/youtube';

const STATE_SECRET =
  process.env.SESSION_SECRET ||
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.YOUTUBE_CLIENT_SECRET ||
  'boostify-youtube-oauth-state';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getConfig(): OAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '';
  const baseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT ||
    process.env.YOUTUBE_REDIRECT_URI ||
    `${baseUrl.replace(/\/$/, '')}/api/auth/youtube/callback`;
  return { clientId, clientSecret, redirectUri };
}

/** True when a real Google OAuth2 client is configured (required for uploads). */
export function isYoutubeOAuthConfigured(): boolean {
  const { clientId, clientSecret } = getConfig();
  return Boolean(clientId && clientSecret);
}

async function getOAuthClient(): Promise<any> {
  const { google } = await import('googleapis');
  const { clientId, clientSecret, redirectUri } = getConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// ── Signed state (stateless CSRF protection, carries the user id) ──────────────
function signState(userId: number): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, n: crypto.randomBytes(8).toString('hex'), t: Date.now() }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state: string): number | null {
  const [payload, sig] = (state || '').split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(payload).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return typeof obj.uid === 'number' ? obj.uid : null;
  } catch {
    return null;
  }
}

/** Idempotently create the token table (safe in prod — no-op when it exists). */
async function ensureTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS youtube_connections (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER UNIQUE,
      access_token     TEXT,
      refresh_token    TEXT,
      token_expires_at TIMESTAMPTZ,
      channel_id       TEXT,
      channel_title    TEXT,
      thumbnail_url    TEXT,
      scopes           TEXT,
      lyric_playlist_id TEXT,
      is_active        BOOLEAN DEFAULT true,
      created_at       TIMESTAMPTZ DEFAULT now(),
      updated_at       TIMESTAMPTZ DEFAULT now()
    )
  `);
  // Backfill the playlist column on pre-existing installs.
  await pool
    .query(`ALTER TABLE youtube_connections ADD COLUMN IF NOT EXISTS lyric_playlist_id TEXT`)
    .catch(() => {});
}

/** Extracts a readable reason from a googleapis error (reason + message). */
function ytErrorReason(e: any): string {
  const apiErr = e?.response?.data?.error;
  const reason = apiErr?.errors?.[0]?.reason;
  const msg = apiErr?.message || e?.message || 'unknown error';
  return reason ? `${reason}: ${msg}` : msg;
}

/** Build the Google consent URL for this user. */
export async function getYoutubeAuthUrl(
  userId: number,
  opts: { forceSelectAccount?: boolean } = {},
): Promise<string> {
  if (!isYoutubeOAuthConfigured()) {
    throw new Error(
      'YouTube upload is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.',
    );
  }
  const oauth2 = await getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    // 'select_account consent' fuerza el selector de cuenta/canal de Google para
    // que el artista pueda conectar/cambiar a OTRO canal (la API no puede crear
    // canales, pero sí elegir uno distinto cambiando de cuenta de Google).
    prompt: opts.forceSelectAccount ? 'select_account consent' : 'consent',
    include_granted_scopes: true,
    scope: YT_SCOPES,
    state: signState(userId),
  });
}

/** Exchange the OAuth code for tokens and persist them for the user. */
export async function exchangeYoutubeCode(
  code: string,
  state: string,
): Promise<{ userId: number; channelTitle: string } | null> {
  const userId = verifyState(state);
  if (!userId) throw new Error('Invalid OAuth state');

  const oauth2 = await getOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  let channelId = '';
  let channelTitle = '';
  let thumbnailUrl = '';
  try {
    const { google } = await import('googleapis');
    const yt = google.youtube({ version: 'v3', auth: oauth2 });
    const ch = await yt.channels.list({ part: ['snippet'], mine: true });
    const c = ch.data.items?.[0];
    if (c) {
      channelId = c.id || '';
      channelTitle = c.snippet?.title || '';
      thumbnailUrl = c.snippet?.thumbnails?.default?.url || '';
    }
  } catch {
    /* channel lookup is best-effort */
  }

  await ensureTable();
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  await pool.query(
    `INSERT INTO youtube_connections
       (user_id, access_token, refresh_token, token_expires_at, channel_id,
        channel_title, thumbnail_url, scopes, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
     ON CONFLICT (user_id) DO UPDATE SET
       access_token     = EXCLUDED.access_token,
       refresh_token    = COALESCE(EXCLUDED.refresh_token, youtube_connections.refresh_token),
       token_expires_at = EXCLUDED.token_expires_at,
       channel_id       = EXCLUDED.channel_id,
       channel_title    = EXCLUDED.channel_title,
       thumbnail_url    = EXCLUDED.thumbnail_url,
       scopes           = EXCLUDED.scopes,
       is_active        = true,
       updated_at       = now()`,
    [
      userId,
      tokens.access_token || '',
      tokens.refresh_token || null,
      expiresAt,
      channelId,
      channelTitle,
      thumbnailUrl,
      YT_SCOPES.join(' '),
    ],
  );

  return { userId, channelTitle };
}

export interface YoutubeConnectionInfo {
  isActive: boolean;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  scopes: string;
  tokenExpiresAt: Date | null;
  createdAt: Date | null;
}

/** Return the user's connection (never exposes tokens). */
export async function getYoutubeConnection(userId: number): Promise<YoutubeConnectionInfo | null> {
  await ensureTable();
  const r = await pool.query('SELECT * FROM youtube_connections WHERE user_id = $1 LIMIT 1', [userId]);
  const row = r.rows[0];
  if (!row || !row.is_active) return null;
  return {
    isActive: row.is_active,
    channelId: row.channel_id || '',
    channelTitle: row.channel_title || '',
    thumbnailUrl: row.thumbnail_url || '',
    scopes: row.scopes || '',
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

/** Remove the stored connection. */
export async function disconnectYoutube(userId: number): Promise<void> {
  await ensureTable();
  await pool.query('DELETE FROM youtube_connections WHERE user_id = $1', [userId]);
}

/**
 * Return a valid (refreshed if necessary) access token for the user, or null if
 * they have not connected YouTube. Refreshes via the stored refresh token when
 * the access token is expired or about to expire.
 */
export async function getValidAccessToken(userId: number): Promise<string | null> {
  await ensureTable();
  const r = await pool.query(
    'SELECT * FROM youtube_connections WHERE user_id = $1 AND is_active = true LIMIT 1',
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;

  const expMs = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const stillValid = expMs && expMs - Date.now() > 60_000;
  if (stillValid && row.access_token) return row.access_token;
  if (!row.refresh_token) return row.access_token || null;

  const oauth2 = await getOAuthClient();
  oauth2.setCredentials({ refresh_token: row.refresh_token });
  const { credentials } = await oauth2.refreshAccessToken();
  const newToken = credentials.access_token || '';
  const newExp = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
  await pool.query(
    'UPDATE youtube_connections SET access_token = $1, token_expires_at = $2, updated_at = now() WHERE user_id = $3',
    [newToken, newExp, userId],
  );
  return newToken || row.access_token || null;
}

// ════════════════════════════════════════════════════════════════════════════
// Publishing & channel management (used by the lyrics-video album autopilot)
// ════════════════════════════════════════════════════════════════════════════

export interface YoutubeManageState {
  connected: boolean;
  canManageChannel: boolean; // true when the artist granted the full manage scope
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
}

/** Connection status + whether the stored grant can manage channel branding. */
export async function getYoutubeManageState(userId: number): Promise<YoutubeManageState> {
  const conn = await getYoutubeConnection(userId);
  if (!conn) {
    return { connected: false, canManageChannel: false, channelId: '', channelTitle: '', thumbnailUrl: '' };
  }
  const scopeList = (conn.scopes || '').split(/\s+/).filter(Boolean);
  return {
    connected: true,
    canManageChannel: scopeList.includes(YT_MANAGE_SCOPE),
    channelId: conn.channelId,
    channelTitle: conn.channelTitle,
    thumbnailUrl: conn.thumbnailUrl,
  };
}

async function downloadToTmp(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = path.join(os.tmpdir(), `yt_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
  fs.writeFileSync(tmp, buf);
  return tmp;
}

/**
 * Sanitiza las keywords/tags de YouTube para evitar el error
 * "The request metadata specifies invalid video keywords":
 *  - elimina < > (caracteres prohibidos por YouTube) y el # inicial
 *  - colapsa espacios, recorta cada tag y descarta vacíos
 *  - deduplica (case-insensitive)
 *  - respeta el límite total de ~500 caracteres (una tag con espacios cuenta
 *    entre comillas → +2). Se detiene antes de superar el límite.
 */
export function sanitizeYoutubeTags(tags?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const raw of tags || []) {
    let t = String(raw || '')
      .replace(/[<>]/g, '')
      .replace(/^#+/, '')
      .replace(/["\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    // YouTube cuenta entre comillas las tags con espacios/comas → +2 al total.
    const cost = t.length + (/[\s,]/.test(t) ? 2 : 0) + 1; // +1 separador
    if (total + cost > 480) break;
    seen.add(key);
    out.push(t);
    total += cost;
    if (out.length >= 30) break;
  }
  return out;
}

/** Limpia título/descripción de caracteres que YouTube rechaza (< >). */
export function sanitizeYoutubeText(s?: string, max = 4900): string {
  return String(s || '').replace(/[<>]/g, '').slice(0, max);
}

/**
 * Upload a rendered video (by URL) to the artist's connected YouTube channel.
 * Optionally sets a custom thumbnail. Returns the new video id + watch URL.
 */
export async function uploadVideoToYoutube(opts: {
  userId: number;
  videoUrl: string;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: 'public' | 'unlisted' | 'private';
  thumbnailUrl?: string;
  categoryId?: string;
  /** When set, the video is added to (or creates) a playlist with this title. */
  playlistTitle?: string;
  playlistDescription?: string;
}): Promise<{
  videoId: string;
  url: string;
  thumbnailSet: boolean;
  thumbnailError?: string;
  playlistId?: string;
  playlistUrl?: string;
}> {
  const token = await getValidAccessToken(opts.userId);
  if (!token) throw new Error('YouTube account not connected');

  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const youtube = google.youtube({ version: 'v3', auth });

  const videoTmp = await downloadToTmp(opts.videoUrl, 'mp4');
  try {
    const ins = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: sanitizeYoutubeText(opts.title || 'Lyric Video', 100) || 'Lyric Video',
          description: sanitizeYoutubeText(opts.description || '', 4900),
          tags: sanitizeYoutubeTags(opts.tags),
          categoryId: opts.categoryId || '10', // Music
        },
        status: {
          privacyStatus: opts.privacyStatus || 'public',
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: fs.createReadStream(videoTmp) },
    });
    const videoId = (ins.data.id as string) || '';
    if (!videoId) throw new Error('YouTube did not return a video id');

    // ── Custom thumbnail ──────────────────────────────────────────────────
    // YouTube caps custom thumbnails at 2MB; gpt-image-1 PNGs are often larger,
    // so we re-encode to a 1280x720 JPEG before uploading. We also surface the
    // real failure reason (the most common one is an UNVERIFIED channel, which
    // YouTube blocks from setting custom thumbnails).
    let thumbnailSet = false;
    let thumbnailError: string | undefined;
    if (opts.thumbnailUrl) {
      let srcTmp: string | undefined;
      let jpgTmp: string | undefined;
      try {
        srcTmp = await downloadToTmp(opts.thumbnailUrl, 'img');
        let uploadPath = srcTmp;
        try {
          const sharp = (await import('sharp')).default;
          jpgTmp = path.join(os.tmpdir(), `yt_thumb_${Date.now()}.jpg`);
          await sharp(srcTmp).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(jpgTmp);
          uploadPath = jpgTmp;
        } catch (se: any) {
          console.warn('[YouTube] thumbnail resize skipped:', se?.message);
        }
        await youtube.thumbnails.set({
          videoId,
          media: { mimeType: 'image/jpeg', body: fs.createReadStream(uploadPath) },
        });
        thumbnailSet = true;
      } catch (e: any) {
        thumbnailError = ytErrorReason(e);
        console.warn('[YouTube] thumbnails.set failed:', thumbnailError);
      } finally {
        if (srcTmp) { try { fs.unlinkSync(srcTmp); } catch {} }
        if (jpgTmp) { try { fs.unlinkSync(jpgTmp); } catch {} }
      }
    }

    // ── Playlist: each artist gets one playlist with all their songs ──────
    let playlistId: string | undefined;
    let playlistUrl: string | undefined;
    if (opts.playlistTitle) {
      try {
        playlistId = await ensureArtistPlaylist(
          opts.userId,
          opts.playlistTitle,
          opts.playlistDescription,
          youtube,
        );
        if (playlistId) {
          await addVideoToPlaylist(opts.userId, playlistId, videoId, youtube);
          playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
        }
      } catch (e: any) {
        console.warn('[YouTube] playlist add failed:', ytErrorReason(e));
      }
    }

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailSet,
      thumbnailError,
      playlistId,
      playlistUrl,
    };
  } finally {
    try { fs.unlinkSync(videoTmp); } catch {}
  }
}

/**
 * Publish a top-level comment on a video as the connected channel. Used to drop
 * a "Shop this video" comment with product/event deep-links right after upload.
 * Best-effort: returns the comment id or null (never throws on API failure).
 * Note: the YouTube Data API cannot PIN a comment programmatically — the creator
 * pins it once in YouTube Studio; this still surfaces the links to viewers.
 */
export async function insertVideoComment(
  userId: number,
  videoId: string,
  text: string,
): Promise<string | null> {
  if (!videoId || !text || !text.trim()) return null;
  try {
    const token = await getValidAccessToken(userId);
    if (!token) return null;
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const youtube = google.youtube({ version: 'v3', auth });
    const resp = await youtube.commentThreads.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: {
            snippet: { textOriginal: sanitizeYoutubeText(text, 9900) },
          },
        },
      },
    });
    return (resp.data.id as string) || null;
  } catch (e: any) {
    console.warn('[YouTube] insertVideoComment failed:', ytErrorReason(e));
    return null;
  }
}

/**
 * Update the description of an EXISTING video. `build` receives the current
 * description and returns the new one (lets callers merge a shop section
 * idempotently). YouTube's videos.update requires title + categoryId, so we
 * read the current snippet first and preserve them. Best-effort: never throws.
 */
export async function updateVideoDescription(
  userId: number,
  videoId: string,
  build: (current: string) => string,
): Promise<{ updated: boolean; reason?: string }> {
  if (!videoId) return { updated: false, reason: 'no_video_id' };
  try {
    const token = await getValidAccessToken(userId);
    if (!token) return { updated: false, reason: 'not_connected' };
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const youtube = google.youtube({ version: 'v3', auth });
    const list = await youtube.videos.list({ part: ['snippet'], id: [videoId] });
    const item = list.data.items?.[0];
    if (!item?.snippet) return { updated: false, reason: 'not_found' };
    const cur = item.snippet.description || '';
    const next = sanitizeYoutubeText(build(cur), 4900);
    if (next === cur) return { updated: false, reason: 'unchanged' };
    await youtube.videos.update({
      part: ['snippet'],
      requestBody: {
        id: videoId,
        snippet: {
          title: item.snippet.title || 'Lyric Video',
          categoryId: item.snippet.categoryId || '10',
          description: next,
          tags: item.snippet.tags || undefined,
          defaultLanguage: item.snippet.defaultLanguage || undefined,
        },
      },
    });
    return { updated: true };
  } catch (e: any) {
    return { updated: false, reason: ytErrorReason(e) };
  }
}

/**
 * Post a top-level "shop" comment on a video ONLY if one containing `marker`
 * isn't already there (idempotent across re-runs). Best-effort, never throws.
 */
export async function ensureVideoShopComment(
  userId: number,
  videoId: string,
  text: string,
  marker: string,
  legacyMarkers: string[] = [],
): Promise<{ posted: boolean; reason?: string }> {
  if (!videoId || !text || !text.trim()) return { posted: false, reason: 'empty' };
  try {
    const token = await getValidAccessToken(userId);
    if (!token) return { posted: false, reason: 'not_connected' };
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    const youtube = google.youtube({ version: 'v3', auth });
    if (marker || legacyMarkers.length) {
      try {
        const existing = await youtube.commentThreads.list({
          part: ['snippet'],
          videoId,
          maxResults: 100,
          textFormat: 'plainText',
        });
        const items = existing.data.items || [];
        const hasMarker = (txt: string, m: string) => !!m && txt.includes(m);
        const found = items.some((it: any) =>
          hasMarker(String(it?.snippet?.topLevelComment?.snippet?.textDisplay || ''), marker),
        );
        if (found) return { posted: false, reason: 'already_present' };
        // Migración: borra comentarios de versiones anteriores para no duplicar.
        for (const it of items) {
          const txt = String((it as any)?.snippet?.topLevelComment?.snippet?.textDisplay || '');
          const commentId = (it as any)?.snippet?.topLevelComment?.id;
          if (commentId && legacyMarkers.some((m) => hasMarker(txt, m))) {
            try {
              await youtube.comments.delete({ id: commentId });
            } catch {
              /* sin permiso de borrado o ya borrado → ignorar */
            }
          }
        }
      } catch {
        /* comentarios desactivados o sin hilos → intentar insertar igual */
      }
    }
    await youtube.commentThreads.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: sanitizeYoutubeText(text, 9900) } },
        },
      },
    });
    return { posted: true };
  } catch (e: any) {
    return { posted: false, reason: ytErrorReason(e) };
  }
}

/**
 * Ensure the artist has a single YouTube playlist that collects all their songs.
 * Strategy: reuse the stored playlist id → else find an existing playlist with
 * the same title → else create a new public playlist. The id is cached on the
 * youtube_connections row so we don't re-create it on every upload.
 */
export async function ensureArtistPlaylist(
  userId: number,
  title: string,
  description?: string,
  client?: any,
): Promise<string | undefined> {
  await ensureTable();
  const playlistTitle = sanitizeYoutubeText(title, 150) || 'My Songs';

  let youtube = client;
  if (!youtube) {
    const token = await getValidAccessToken(userId);
    if (!token) return undefined;
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    youtube = google.youtube({ version: 'v3', auth });
  }

  // 1) Cached id — verify it still exists.
  const { rows } = await pool.query(
    'SELECT lyric_playlist_id FROM youtube_connections WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  const cached: string = rows[0]?.lyric_playlist_id || '';
  if (cached) {
    try {
      const chk = await youtube.playlists.list({ part: ['id'], id: [cached] });
      if (chk.data.items?.length) return cached;
    } catch { /* fall through to recreate */ }
  }

  // 2) Find an existing playlist with the same title.
  try {
    let pageToken: string | undefined;
    for (let i = 0; i < 5; i++) {
      const list = await youtube.playlists.list({
        part: ['id', 'snippet'],
        mine: true,
        maxResults: 50,
        pageToken,
      });
      const match = (list.data.items || []).find(
        (p: any) => (p.snippet?.title || '').trim().toLowerCase() === playlistTitle.trim().toLowerCase(),
      );
      if (match?.id) {
        await pool.query(
          'UPDATE youtube_connections SET lyric_playlist_id = $1, updated_at = now() WHERE user_id = $2',
          [match.id, userId],
        );
        return match.id as string;
      }
      pageToken = list.data.nextPageToken || undefined;
      if (!pageToken) break;
    }
  } catch (e: any) {
    console.warn('[YouTube] playlists.list failed:', ytErrorReason(e));
  }

  // 3) Create a new playlist.
  try {
    const created = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: playlistTitle,
          description: sanitizeYoutubeText(description || `All songs by ${title}.`, 4900),
        },
        status: { privacyStatus: 'public' },
      },
    });
    const id = created.data.id as string;
    if (id) {
      await pool.query(
        'UPDATE youtube_connections SET lyric_playlist_id = $1, updated_at = now() WHERE user_id = $2',
        [id, userId],
      );
    }
    return id || undefined;
  } catch (e: any) {
    console.warn('[YouTube] playlists.insert failed:', ytErrorReason(e));
    return undefined;
  }
}

/** Add a video to a playlist, ignoring duplicate-insert errors. */
export async function addVideoToPlaylist(
  userId: number,
  playlistId: string,
  videoId: string,
  client?: any,
): Promise<boolean> {
  let youtube = client;
  if (!youtube) {
    const token = await getValidAccessToken(userId);
    if (!token) return false;
    const { google } = await import('googleapis');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    youtube = google.youtube({ version: 'v3', auth });
  }
  try {
    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
      },
    });
    return true;
  } catch (e: any) {
    console.warn('[YouTube] playlistItems.insert failed:', ytErrorReason(e));
    return false;
  }
}

/**
 * Update the artist channel branding: banner image (portada), description and
 * keywords. Requires the full manage scope — returns needsReconnect when the
 * stored grant is upload-only.
 */
export async function setChannelBranding(opts: {
  userId: number;
  description?: string;
  keywords?: string[];
  bannerImageUrl?: string;
}): Promise<{ updated: boolean; bannerSet: boolean; needsReconnect?: boolean }> {
  const token = await getValidAccessToken(opts.userId);
  if (!token) throw new Error('YouTube account not connected');

  const { rows } = await pool.query(
    'SELECT channel_id, scopes FROM youtube_connections WHERE user_id = $1 AND is_active = true LIMIT 1',
    [opts.userId]
  );
  const channelId: string = rows[0]?.channel_id || '';
  const scopeList = String(rows[0]?.scopes || '').split(/\s+/).filter(Boolean);
  if (!scopeList.includes(YT_MANAGE_SCOPE)) {
    return { updated: false, bannerSet: false, needsReconnect: true };
  }
  if (!channelId) throw new Error('No channel id on file — reconnect YouTube');

  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const youtube = google.youtube({ version: 'v3', auth });

  let bannerSet = false;
  let bannerExternalUrl: string | undefined;
  if (opts.bannerImageUrl) {
    try {
      const bannerTmp = await downloadToTmp(opts.bannerImageUrl, 'png');
      try {
        const up = await youtube.channelBanners.insert({ media: { body: fs.createReadStream(bannerTmp) } });
        bannerExternalUrl = up.data.url || undefined;
        bannerSet = !!bannerExternalUrl;
      } finally {
        try { fs.unlinkSync(bannerTmp); } catch {}
      }
    } catch (e: any) {
      console.warn('[YouTube] channelBanners.insert failed:', e?.message);
    }
  }

  const brandingSettings: any = { channel: {} };
  if (opts.description) brandingSettings.channel.description = opts.description.slice(0, 1000);
  if (opts.keywords?.length) brandingSettings.channel.keywords = opts.keywords.join(' ').slice(0, 500);
  if (bannerExternalUrl) brandingSettings.image = { bannerExternalUrl };

  await youtube.channels.update({
    part: ['brandingSettings'],
    requestBody: { id: channelId, brandingSettings },
  });

  return { updated: true, bannerSet };
}
