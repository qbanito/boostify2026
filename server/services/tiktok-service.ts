/**
 * BOOSTIFY — TikTok OAuth Service
 *
 * Handles the full TikTok Login Kit v2 OAuth flow:
 *  - Build authorization URL (PKCE)
 *  - Exchange authorization code for access + refresh tokens
 *  - Fetch basic user profile
 *  - Persist/update connection in DB
 *  - Refresh expired access tokens
 *  - Disconnect (delete stored tokens)
 */

import crypto from 'crypto';
import { db } from '../db';
import {
  tiktokConnections,
  type InsertTiktokConnection,
  type SelectTiktokConnection,
} from '../../db/schema';
import { eq } from 'drizzle-orm';

// -----------------------------------------------
// Config (set in .env / Render env vars)
// -----------------------------------------------
const TIKTOK_CLIENT_KEY    = process.env.TIKTOK_CLIENT_KEY    || '';
const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';
const TIKTOK_REDIRECT_URI  = process.env.TIKTOK_REDIRECT_URI
  || 'https://boostifymusic.com/api/auth/tiktok/callback';

// Scopes requested by account, analytics, and direct video publishing.
const TIKTOK_SCOPES = ['user.info.basic', 'video.list', 'video.publish'].join(',');

// In-memory PKCE store (state → { codeVerifier, userId })
// In production with multiple instances, move this to Redis/DB
const pkceStore = new Map<string, { codeVerifier: string; userId: number }>();

// -----------------------------------------------
// PKCE helpers
// -----------------------------------------------
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// -----------------------------------------------
// Build TikTok authorization URL
// -----------------------------------------------
export function getTiktokAuthUrl(userId: number): string {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  pkceStore.set(state, { codeVerifier, userId });

  // Clean up stale entries after 10 minutes
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_key:            TIKTOK_CLIENT_KEY,
    response_type:         'code',
    scope:                 TIKTOK_SCOPES,
    redirect_uri:          TIKTOK_REDIRECT_URI,
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

// -----------------------------------------------
// Exchange authorization code for tokens
// -----------------------------------------------
interface TiktokTokenResponse {
  access_token:  string;
  refresh_token: string;
  expires_in:    number;       // seconds until access token expires
  open_id:       string;
  scope:         string;
  token_type:    string;
  refresh_expires_in?: number;
}

export async function exchangeTiktokCode(
  code: string,
  state: string,
): Promise<SelectTiktokConnection | null> {
  const entry = pkceStore.get(state);
  if (!entry) {
    console.error('[TikTok OAuth] Unknown or expired state:', state);
    return null;
  }
  pkceStore.delete(state);

  const { codeVerifier, userId } = entry;

  const body = new URLSearchParams({
    client_key:    TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    code,
    grant_type:    'authorization_code',
    redirect_uri:  TIKTOK_REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!tokenRes.ok) {
    console.error('[TikTok OAuth] Token exchange failed:', await tokenRes.text());
    return null;
  }

  const tokens: TiktokTokenResponse = await tokenRes.json();
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Fetch basic profile
  const profile = await fetchTiktokProfile(tokens.access_token, tokens.open_id);

  const values: Omit<InsertTiktokConnection, never> = {
    userId,
    accessToken:     tokens.access_token,
    refreshToken:    tokens.refresh_token ?? null,
    tokenExpiresAt,
    tiktokOpenId:    tokens.open_id,
    displayName:     profile?.display_name ?? null,
    avatarUrl:       profile?.avatar_url ?? null,
    profileDeepLink: profile?.profile_deep_link ?? null,
    scopes:          tokens.scope,
    isActive:        true,
    updatedAt:       new Date(),
  };

  // Upsert
  const existing = await db.query.tiktokConnections.findFirst({
    where: eq(tiktokConnections.userId, userId),
  });

  if (existing) {
    const [updated] = await db
      .update(tiktokConnections)
      .set(values)
      .where(eq(tiktokConnections.userId, userId))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(tiktokConnections)
      .values(values)
      .returning();
    return inserted;
  }
}

// -----------------------------------------------
// Fetch TikTok user basic profile
// -----------------------------------------------
interface TiktokUserInfo {
  display_name?:     string;
  avatar_url?:       string;
  profile_deep_link?: string;
}

async function fetchTiktokProfile(
  accessToken: string,
  openId: string,
): Promise<TiktokUserInfo | null> {
  try {
    const res = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,profile_deep_link',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.user ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------
// Refresh access token
// -----------------------------------------------
export async function refreshTiktokToken(userId: number): Promise<SelectTiktokConnection | null> {
  const conn = await db.query.tiktokConnections.findFirst({
    where: eq(tiktokConnections.userId, userId),
  });
  if (!conn?.refreshToken) return null;

  const body = new URLSearchParams({
    client_key:    TIKTOK_CLIENT_KEY,
    client_secret: TIKTOK_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: conn.refreshToken,
  });

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    console.error('[TikTok OAuth] Token refresh failed:', await res.text());
    return null;
  }

  const tokens: TiktokTokenResponse = await res.json();
  const [updated] = await db
    .update(tiktokConnections)
    .set({
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token ?? conn.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(tiktokConnections.userId, userId))
    .returning();

  return updated ?? null;
}

// -----------------------------------------------
// Get stored connection
// -----------------------------------------------
export async function getTiktokConnection(
  userId: number,
): Promise<SelectTiktokConnection | null> {
  return (
    (await db.query.tiktokConnections.findFirst({
      where: eq(tiktokConnections.userId, userId),
    })) ?? null
  );
}

// -----------------------------------------------
// Disconnect — delete all tokens
// -----------------------------------------------
export async function disconnectTiktok(userId: number): Promise<void> {
  await db.delete(tiktokConnections).where(eq(tiktokConnections.userId, userId));
}
