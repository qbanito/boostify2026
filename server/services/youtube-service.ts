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
import { pool } from '../db';

const YT_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

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
      is_active        BOOLEAN DEFAULT true,
      created_at       TIMESTAMPTZ DEFAULT now(),
      updated_at       TIMESTAMPTZ DEFAULT now()
    )
  `);
}

/** Build the Google consent URL for this user. */
export async function getYoutubeAuthUrl(userId: number): Promise<string> {
  if (!isYoutubeOAuthConfigured()) {
    throw new Error(
      'YouTube upload is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.',
    );
  }
  const oauth2 = await getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
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
