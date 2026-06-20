/**
 * BOOSTIFY - Spotify Integration Service
 * 
 * "Conecta tu Spotify y descubre artistas IA basados en tu gusto real"
 * 
 * This service:
 * - Handles Spotify OAuth flow (connect/disconnect)
 * - Fetches user's top artists, genres, and tracks
 * - Matches real music taste with AI artists
 * - Generates personalized AI artist suggestions
 */

import { db } from '../db';
import {
  spotifyConnections,
  users,
  artistPersonality,
  songs,
  type InsertSpotifyConnection,
  type SelectSpotifyConnection,
} from '../../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.7,
  maxTokens: 400,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Spotify API config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:5000/api/spotify/callback';

// ============================================
// OAUTH FLOW
// ============================================

/**
 * Get Spotify authorization URL
 */
export function getSpotifyAuthUrl(userId: number): string {
  const scopes = [
    'user-top-read',
    'user-read-recently-played',
    'user-library-read',
    'user-read-private',
    'user-read-email',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: scopes,
    state: String(userId),
    show_dialog: 'true',
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeSpotifyCode(code: string, userId: number): Promise<SelectSpotifyConnection | null> {
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('❌ [Spotify] Token exchange failed:', await tokenResponse.text());
      return null;
    }

    const tokens = await tokenResponse.json();

    // Get Spotify user profile
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    const profile = profileResponse.ok ? await profileResponse.json() : {};

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert connection
    const existing = await db
      .select()
      .from(spotifyConnections)
      .where(eq(spotifyConnections.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(spotifyConnections)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existing[0].refreshToken,
          tokenExpiresAt,
          spotifyUserId: profile.id,
          displayName: profile.display_name,
          spotifyProfileUrl: profile.external_urls?.spotify,
          spotifyImageUrl: profile.images?.[0]?.url,
          lastSyncedAt: new Date(),
        })
        .where(eq(spotifyConnections.userId, userId));

      return (await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)))[0];
    }

    const [connection] = await db.insert(spotifyConnections).values({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      spotifyUserId: profile.id,
      displayName: profile.display_name,
      spotifyProfileUrl: profile.external_urls?.spotify,
      spotifyImageUrl: profile.images?.[0]?.url,
    }).returning();

    console.log(`🎵 [Spotify] Connected user ${userId} (${profile.display_name})`);
    return connection;
  } catch (error) {
    console.error('❌ [Spotify] Error exchanging code:', error);
    return null;
  }
}

/**
 * Refresh expired token
 */
async function refreshSpotifyToken(connection: SelectSpotifyConnection): Promise<string | null> {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken,
      }),
    });

    if (!response.ok) return null;

    const tokens = await response.json();

    await db.update(spotifyConnections)
      .set({
        accessToken: tokens.access_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      })
      .where(eq(spotifyConnections.id, connection.id));

    return tokens.access_token;
  } catch {
    return null;
  }
}

async function getValidToken(connection: SelectSpotifyConnection): Promise<string | null> {
  if (new Date() < connection.tokenExpiresAt) {
    return connection.accessToken;
  }
  return refreshSpotifyToken(connection);
}

// ============================================
// FETCH USER'S MUSIC TASTE
// ============================================

/**
 * Sync user's top artists, genres, and tracks from Spotify
 */
export async function syncSpotifyTaste(userId: number): Promise<{
  topArtists: any[];
  topGenres: string[];
  topTracks: any[];
} | null> {
  try {
    const [connection] = await db
      .select()
      .from(spotifyConnections)
      .where(eq(spotifyConnections.userId, userId));

    if (!connection) return null;

    const token = await getValidToken(connection);
    if (!token) return null;

    // Fetch top artists
    const artistsRes = await fetch('https://api.spotify.com/v1/me/top/artists?limit=20&time_range=medium_term', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const artistsData = artistsRes.ok ? await artistsRes.json() : { items: [] };

    const topArtists = (artistsData.items || []).map((a: any) => ({
      name: a.name,
      genres: a.genres || [],
      popularity: a.popularity,
      spotifyId: a.id,
      imageUrl: a.images?.[0]?.url,
    }));

    // Extract all genres and count frequency
    const genreCount = new Map<string, number>();
    for (const artist of topArtists) {
      for (const genre of artist.genres) {
        genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
      }
    }
    const topGenres = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre]) => genre);

    // Fetch top tracks
    const tracksRes = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=medium_term', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const tracksData = tracksRes.ok ? await tracksRes.json() : { items: [] };

    const topTracks = (tracksData.items || []).map((t: any) => ({
      name: t.name,
      artist: t.artists?.[0]?.name || 'Unknown',
      spotifyId: t.id,
      previewUrl: t.preview_url,
    }));

    // Update connection
    await db.update(spotifyConnections)
      .set({
        topArtists,
        topGenres,
        topTracks,
        lastSyncedAt: new Date(),
      })
      .where(eq(spotifyConnections.userId, userId));

    console.log(`🎵 [Spotify] Synced taste for user ${userId}: ${topArtists.length} artists, ${topGenres.length} genres`);
    return { topArtists, topGenres, topTracks };
  } catch (error) {
    console.error('❌ [Spotify] Error syncing taste:', error);
    return null;
  }
}

// ============================================
// AI ARTIST MATCHING / SUGGESTIONS
// ============================================

/**
 * Match user's Spotify taste with AI artists in Boostify
 */
export async function generateAiArtistSuggestions(userId: number): Promise<Array<{
  artistId: number;
  artistName: string;
  matchScore: number;
  reason: string;
  avatarUrl: string | null;
}>> {
  try {
    const [connection] = await db
      .select()
      .from(spotifyConnections)
      .where(eq(spotifyConnections.userId, userId));

    if (!connection || !connection.topGenres || (connection.topGenres as string[]).length === 0) {
      return [];
    }

    const userGenres = connection.topGenres as string[];
    const userArtists = (connection.topArtists as any[]) || [];
    const userArtistNames = userArtists.map(a => a.name);

    // Get all AI artists with personalities
    const aiArtists = await db
      .select({
        artistId: artistPersonality.artistId,
        traits: artistPersonality.traits,
        influences: artistPersonality.influences,
        currentMood: artistPersonality.currentMood,
      })
      .from(artistPersonality);

    const artistIds = aiArtists.map(a => a.artistId);
    if (artistIds.length === 0) return [];

    const userInfo = await db
      .select({ 
        id: users.id, 
        username: users.username, 
        artistName: users.artistName,
        genre: users.genre,
        genres: users.genres,
        profileImageUrl: users.profileImageUrl, 
      })
      .from(users)
      .where(inArray(users.id, artistIds));

    const userMap = new Map(userInfo.map(u => [u.id, u]));

    // Score each AI artist
    const scored: Array<{
      artistId: number;
      artistName: string;
      matchScore: number;
      avatarUrl: string | null;
      genres: string[];
      influences: string[];
    }> = [];

    for (const ai of aiArtists) {
      const info = userMap.get(ai.artistId);
      if (!info) continue;

      let score = 0;
      const aiGenres = (info.genres as string[]) || [];
      const aiInfluences = (ai.influences as string[]) || [];

      // Genre matching (highest weight)
      for (const uGenre of userGenres) {
        for (const aGenre of aiGenres) {
          if (uGenre.toLowerCase().includes(aGenre.toLowerCase()) ||
              aGenre.toLowerCase().includes(uGenre.toLowerCase())) {
            score += 15;
          }
        }
        // Check genre field too
        if (info.genre && uGenre.toLowerCase().includes(info.genre.toLowerCase())) {
          score += 10;
        }
      }

      // Influence matching
      for (const influence of aiInfluences) {
        for (const realArtist of userArtistNames) {
          if (influence.toLowerCase().includes(realArtist.toLowerCase()) ||
              realArtist.toLowerCase().includes(influence.toLowerCase())) {
            score += 20;
          }
        }
      }

      // Base score for having a personality (active artist)
      score += 5;

      if (score > 0) {
        scored.push({
          artistId: ai.artistId,
          artistName: info.artistName || info.username || `Artist ${ai.artistId}`,
          matchScore: Math.min(score, 100),
          avatarUrl: info.profileImageUrl,
          genres: aiGenres,
          influences: aiInfluences,
        });
      }
    }

    // Sort by score and take top 5
    scored.sort((a, b) => b.matchScore - a.matchScore);
    const top5 = scored.slice(0, 5);

    // Generate AI reasoning for top matches
    const suggestions: Array<{
      artistId: number;
      artistName: string;
      matchScore: number;
      reason: string;
      avatarUrl: string | null;
    }> = [];

    for (const match of top5) {
      let reason = '';
      try {
        const prompt = `El usuario escucha: ${userArtistNames.slice(0, 5).join(', ')}.
Sus géneros favoritos: ${userGenres.slice(0, 5).join(', ')}.

Artista IA sugerido: ${match.artistName} (géneros: ${match.genres.join(', ')}, influencias: ${match.influences.join(', ')}).

Genera una razón CORTA (1 línea) de por qué le gustaría este artista IA. Formato: "Si te gusta [artista real], te encantará [artista IA] porque..."
Solo el texto, nada más.`;

        const response = await llm.invoke([new HumanMessage(prompt)]);
        reason = typeof response.content === 'string' ? response.content.trim() : '';
      } catch {
        reason = `Si te gustan ${userGenres.slice(0, 2).join(' y ')}, ${match.artistName} es para ti.`;
      }

      suggestions.push({
        artistId: match.artistId,
        artistName: match.artistName,
        matchScore: match.matchScore,
        reason,
        avatarUrl: match.avatarUrl,
      });
    }

    // Save suggestions
    await db.update(spotifyConnections)
      .set({ suggestedAiArtists: suggestions })
      .where(eq(spotifyConnections.userId, userId));

    return suggestions;
  } catch (error) {
    console.error('❌ [Spotify] Error generating suggestions:', error);
    return [];
  }
}

// ============================================
// QUERIES
// ============================================

export async function getSpotifyConnection(userId: number): Promise<SelectSpotifyConnection | null> {
  try {
    const [conn] = await db
      .select()
      .from(spotifyConnections)
      .where(eq(spotifyConnections.userId, userId));
    return conn || null;
  } catch {
    return null;
  }
}

export async function disconnectSpotify(userId: number): Promise<boolean> {
  try {
    await db.delete(spotifyConnections).where(eq(spotifyConnections.userId, userId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a demo connection for testing (no real Spotify needed)
 */
export async function createDemoSpotifyConnection(userId: number): Promise<SelectSpotifyConnection | null> {
  try {
    const demoTopArtists = [
      { name: "Bad Bunny", genres: ["reggaeton", "latin trap", "urbano latino"], popularity: 95, spotifyId: "4q3ewBCX7sLwd24euuV69X" },
      { name: "Rosalía", genres: ["pop", "flamenco nuevo", "latin pop"], popularity: 85, spotifyId: "7ltDVBr6mKbRvohxheJ9h1" },
      { name: "Dua Lipa", genres: ["pop", "dance pop", "electropop"], popularity: 90, spotifyId: "6M2wZ9GZgrQXHCFfjv46we" },
      { name: "Travis Scott", genres: ["hip hop", "trap", "rap"], popularity: 88, spotifyId: "0Y5tJX1MQlPlqiwlOH1tJY" },
      { name: "Karol G", genres: ["reggaeton", "latin pop", "urbano latino"], popularity: 87, spotifyId: "790FomKkXshlbRYZFtlgla" },
    ];

    const demoTopGenres = ["reggaeton", "latin trap", "urbano latino", "pop", "hip hop", "trap", "latin pop"];
    
    const demoTopTracks = [
      { name: "WHERE SHE GOES", artist: "Bad Bunny", spotifyId: "demo1" },
      { name: "DESPECHÁ", artist: "Rosalía", spotifyId: "demo2" },
      { name: "Levitating", artist: "Dua Lipa", spotifyId: "demo3" },
    ];

    const existing = await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)).limit(1);
    
    if (existing.length > 0) {
      await db.update(spotifyConnections).set({
        topArtists: demoTopArtists,
        topGenres: demoTopGenres,
        topTracks: demoTopTracks,
        lastSyncedAt: new Date(),
      }).where(eq(spotifyConnections.userId, userId));
    } else {
      await db.insert(spotifyConnections).values({
        userId,
        accessToken: 'demo_token',
        refreshToken: 'demo_refresh',
        tokenExpiresAt: new Date(Date.now() + 999 * 24 * 60 * 60 * 1000),
        spotifyUserId: `demo_${userId}`,
        displayName: 'Demo User',
        topArtists: demoTopArtists,
        topGenres: demoTopGenres,
        topTracks: demoTopTracks,
        lastSyncedAt: new Date(),
      });
    }

    return (await db.select().from(spotifyConnections).where(eq(spotifyConnections.userId, userId)))[0];
  } catch (error) {
    console.error('❌ [Spotify] Error creating demo connection:', error);
    return null;
  }
}
