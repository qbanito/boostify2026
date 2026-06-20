/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY — Artist Marketing Context Service
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Reads and generates the artist-specific marketing context document.
 * The context_md field is injected into AI prompts via ai-skills-injector to
 * personalise every AI call with artist-specific data (name, genre, audience…).
 *
 * Functions:
 *   getArtistMarketingContext(userId)      — fetch stored context (or null)
 *   generateArtistMarketingContext(userId) — build & persist context from profile
 *   getOrGenerateContext(userId)           — convenience: fetch or auto-generate
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { db } from '../db';
import { artistMarketingContext, users, songs } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtistMarketingContextData {
  userId: number;
  artistName: string | null;
  genre: string[] | null;
  subgenre: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  usp: string | null;
  positioning: string | null;
  primaryGoals: string[] | null;
  socialChannels: Record<string, string> | null;
  keyReleases: Array<{ title: string; year?: number; type?: string }> | null;
  contentPillars: string[] | null;
  similarArtists: string[] | null;
  differentiators: string[] | null;
  contextMd: string | null;
  lastGeneratedAt: Date | null;
}

// ─── Fetch stored context ─────────────────────────────────────────────────────

/**
 * Returns the stored marketing context for an artist, or null if not yet generated.
 */
export async function getArtistMarketingContext(userId: number): Promise<ArtistMarketingContextData | null> {
  const [row] = await db
    .select()
    .from(artistMarketingContext)
    .where(eq(artistMarketingContext.userId, userId))
    .limit(1);

  if (!row) return null;
  return row as ArtistMarketingContextData;
}

// ─── Generate & persist context ───────────────────────────────────────────────

/**
 * Generates the artist marketing context from the user's profile and recent songs.
 * Persists it to the DB and returns the compiled context_md string.
 */
export async function generateArtistMarketingContext(userId: number): Promise<string> {
  // Fetch artist profile
  const [artist] = await db
    .select({
      id: users.id,
      artistName: users.artistName,
      biography: users.biography,
      genre: users.genre,
      genres: users.genres,
      location: users.location,
      spotifyUrl: users.spotifyUrl,
      instagramHandle: users.instagramHandle,
      twitterHandle: users.twitterHandle,
      youtubeChannel: users.youtubeChannel,
      facebookUrl: users.facebookUrl,
      tiktokUrl: users.tiktokUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!artist) throw new Error(`Artist not found: userId=${userId}`);

  // Fetch recent song titles
  let recentSongs: Array<{ title: string; year?: number; type?: string }> = [];
  try {
    const songRows = await db
      .select({ title: songs.title })
      .from(songs)
      .where(eq(songs.userId, userId))
      .orderBy(desc(songs.createdAt))
      .limit(10);
    recentSongs = songRows.map((s) => ({ title: s.title, type: 'single' }));
  } catch {
    // songs table not available — skip
  }

  // Build genre list
  const genreList: string[] = [];
  if (artist.genre) genreList.push(artist.genre);
  if (artist.genres?.length) genreList.push(...artist.genres.filter((g) => g !== artist.genre));
  const uniqueGenres = [...new Set(genreList)];

  // Build social channels map
  const socialChannels: Record<string, string> = {};
  if (artist.instagramHandle) socialChannels.instagram = artist.instagramHandle;
  if (artist.twitterHandle) socialChannels.twitter = artist.twitterHandle;
  if (artist.youtubeChannel) socialChannels.youtube = artist.youtubeChannel;
  if (artist.facebookUrl) socialChannels.facebook = artist.facebookUrl;
  if (artist.tiktokUrl) socialChannels.tiktok = artist.tiktokUrl;
  if (artist.spotifyUrl) socialChannels.spotify = artist.spotifyUrl;

  // Compile the context_md document — injected into all AI calls
  const contextMd = buildContextMd({
    artistName: artist.artistName || 'Unknown Artist',
    genres: uniqueGenres,
    biography: artist.biography,
    location: artist.location,
    socialChannels,
    recentSongs,
  });

  // Upsert into artist_marketing_context
  const upsertData = {
    userId,
    artistName: artist.artistName,
    genre: uniqueGenres.length ? uniqueGenres : null,
    socialChannels: Object.keys(socialChannels).length ? socialChannels : null,
    keyReleases: recentSongs.length ? recentSongs : null,
    contextMd,
    lastGeneratedAt: new Date(),
    updatedAt: new Date(),
  };

  const existing = await db
    .select({ id: artistMarketingContext.id })
    .from(artistMarketingContext)
    .where(eq(artistMarketingContext.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(artistMarketingContext)
      .set(upsertData)
      .where(eq(artistMarketingContext.userId, userId));
  } else {
    await db.insert(artistMarketingContext).values(upsertData);
  }

  return contextMd;
}

// ─── Convenience: get or generate ────────────────────────────────────────────

/**
 * Returns the stored context_md or auto-generates it on first access.
 * Returns empty string on any failure to ensure AI calls never break.
 */
export async function getOrGenerateContext(userId: number | null | undefined): Promise<string> {
  if (!userId) return '';
  try {
    const existing = await getArtistMarketingContext(userId);
    if (existing?.contextMd) return existing.contextMd;
    return await generateArtistMarketingContext(userId);
  } catch {
    return '';
  }
}

// ─── Context markdown builder ─────────────────────────────────────────────────

interface ContextBuildInput {
  artistName: string;
  genres: string[];
  biography: string | null | undefined;
  location: string | null | undefined;
  socialChannels: Record<string, string>;
  recentSongs: Array<{ title: string; year?: number; type?: string }>;
}

function buildContextMd(data: ContextBuildInput): string {
  const lines: string[] = [
    '# Artist Marketing Context',
    '',
    `**Artist Name:** ${data.artistName}`,
  ];

  if (data.genres.length) {
    lines.push(`**Genres:** ${data.genres.join(', ')}`);
  }
  if (data.location) {
    lines.push(`**Location:** ${data.location}`);
  }
  if (data.biography) {
    lines.push('', '## Biography', '', data.biography.trim());
  }
  if (data.recentSongs.length) {
    lines.push('', '## Recent Releases', '');
    for (const s of data.recentSongs) {
      lines.push(`- ${s.title}${s.type ? ` (${s.type})` : ''}`);
    }
  }
  if (Object.keys(data.socialChannels).length) {
    lines.push('', '## Social Channels', '');
    for (const [platform, handle] of Object.entries(data.socialChannels)) {
      lines.push(`- **${platform}:** ${handle}`);
    }
  }

  return lines.join('\n');
}
