/**
 * ============================================================
 *  HERMES MEMORY SERVICE — Artist Memory & Soul Generator
 * ============================================================
 *
 * Generates Hermes Agent-compatible memory files for each artist:
 *   - MEMORY.md  : persistent facts, preferences, history
 *   - SOUL.md    : artist personality, voice, visual DNA
 *   - goals.json : current objectives derived from blueprint
 *
 * These files feed into Hermes Agent's persistent memory system,
 * so the AI agent "knows" the artist deeply across all sessions.
 */

import { db as pgDb } from '../../db';
import { users, songs, artistBlueprints } from '../../db/schema';
import { eq } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HermesArtistProfile {
  artistId: number;
  artistName: string;
  memory: string;    // MEMORY.md content
  soul: string;      // SOUL.md content
  goals: HermesGoal[];
  raw: {
    user: Record<string, any>;
    blueprint: Record<string, any> | null;
    songCount: number;
    topSongs: Array<{ title: string; genre: string; streams?: number }>;
  };
}

export interface HermesGoal {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed';
  category: 'growth' | 'content' | 'monetization' | 'brand' | 'release';
}

export interface HermesWebhookPayload {
  artistId: number;
  taskType: string;
  taskTitle: string;
  result: string;
  memoryUpdates?: string;  // New facts to store in artist memory
  timestamp: string;
}

// ─── Main Export Functions ────────────────────────────────────────────────────

/**
 * Export a full Hermes-compatible profile for an artist.
 * Called on first Hermes session init or manual refresh.
 */
export async function exportArtistHermesProfile(artistId: number): Promise<HermesArtistProfile> {
  // Load artist from DB
  const artistRows = await pgDb
    .select()
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  if (artistRows.length === 0) {
    throw new Error(`Artist ${artistId} not found`);
  }

  const artist = artistRows[0];

  // Load blueprint
  const blueprintRows = await pgDb
    .select()
    .from(artistBlueprints)
    .where(eq(artistBlueprints.artistId, artistId))
    .limit(1);

  const blueprint = blueprintRows.length > 0 ? blueprintRows[0] : null;
  const blueprintJson = blueprint?.blueprintJson as Record<string, any> | null;

  // Load songs
  const artistSongs = await pgDb
    .select({
      title: songs.title,
      genre: songs.genre,
      streams: songs.plays,
    })
    .from(songs)
    .where(eq(songs.userId, artistId))
    .limit(20);

  const memory = generateMemoryMd(artist, blueprintJson, artistSongs);
  const soul = generateSoulMd(artist, blueprintJson);
  const goals = generateGoals(artist, blueprintJson);

  return {
    artistId,
    artistName: artist.artistName || artist.username || `Artist ${artistId}`,
    memory,
    soul,
    goals,
    raw: {
      user: artist,
      blueprint: blueprintJson,
      songCount: artistSongs.length,
      topSongs: artistSongs.slice(0, 5),
    },
  };
}

/**
 * Generate MEMORY.md — persistent facts Hermes should always know about this artist.
 */
function generateMemoryMd(
  artist: Record<string, any>,
  blueprint: Record<string, any> | null,
  songList: Array<{ title: string; genre: string; streams?: number | null }>
): string {
  const name = artist.artistName || artist.username || 'Unknown Artist';
  const genre = artist.genre || (artist.genres as string[] | null)?.[0] || 'Unknown';
  const location = artist.location || artist.country || 'Unknown';
  const bio = artist.biography ? artist.biography.substring(0, 300) : '';

  const dna = blueprint?.artist_dna as Record<string, any> | null;
  const identity = blueprint?.identity as Record<string, any> | null;
  const sound = blueprint?.sound as Record<string, any> | null;
  const strategy = blueprint?.strategy as Record<string, any> | null;

  const topSongsList = songList.length > 0
    ? songList.slice(0, 5).map(s => `  - "${s.title}" (${s.genre || genre})`).join('\n')
    : '  - No songs registered yet';

  const platforms: string[] = [];
  if (artist.spotifyUrl) platforms.push(`Spotify: ${artist.spotifyUrl}`);
  if (artist.instagramHandle) platforms.push(`Instagram: @${artist.instagramHandle}`);
  if (artist.twitterHandle) platforms.push(`Twitter: @${artist.twitterHandle}`);
  if (artist.youtubeChannel) platforms.push(`YouTube: ${artist.youtubeChannel}`);
  if (artist.tiktokUrl) platforms.push(`TikTok: ${artist.tiktokUrl}`);

  return `# Artist Memory — ${name}
<!-- Hermes persistent memory for artist ID: ${artist.id} -->
<!-- Last exported: ${new Date().toISOString()} -->

## Identity
- **Artist Name**: ${name}
- **Real Name**: ${artist.realName || 'Not disclosed'}
- **Genre**: ${genre}
- **Location**: ${location}
- **Career Stage**: ${dna?.career_stage || 'Emerging'}
- **Career Started**: ${dna?.career_start_year || 'Unknown'}
- **Boostify ID**: ${artist.id}
- **Slug**: ${artist.slug || 'N/A'}

## Biography
${bio || 'No biography available yet.'}

## Music Catalog (${songList.length} songs)
Top songs:
${topSongsList}

## Social Platforms
${platforms.length > 0 ? platforms.join('\n') : '- No platforms linked yet'}

## Brand Essence
- **Archetype**: ${blueprint?.brand_archetype || identity?.brand_archetype || 'Not defined'}
- **Tagline**: ${dna?.tagline || 'Not defined'}
- **Unique Value**: ${identity?.unique_value_proposition || 'Not defined'}
- **Communication Style**: ${identity?.communication_style || 'Not defined'}

## Sound Profile
- **Primary Sound**: ${sound?.primary_sound_description || genre}
- **Vocal Style**: ${sound?.vocal_style || 'Not defined'}
- **Production Style**: ${sound?.production_style || 'Not defined'}
- **Key Influences**: ${Array.isArray(sound?.key_influences) ? sound.key_influences.join(', ') : 'Not defined'}

## Current Strategy
- **Phase**: ${strategy?.current_phase || 'Growth'}
- **90-day Focus**: ${strategy?.['90_day_priority'] || 'Build audience and release new content'}
- **Target Audience**: ${strategy?.target_audience_description || 'Music fans in the genre'}

## Artist Preferences & Notes
<!-- Add personal notes here as you learn more about this artist -->
- Communication style: Direct, results-oriented
- Prefers: Concise messages, practical action items
- Timezone: ${location}

## Session History
<!-- Hermes will auto-append session summaries here -->
`;
}

/**
 * Generate SOUL.md — Hermes personality/voice file for the artist agent.
 */
function generateSoulMd(
  artist: Record<string, any>,
  blueprint: Record<string, any> | null
): string {
  const name = artist.artistName || artist.username || 'Artist';
  const genre = artist.genre || (artist.genres as string[] | null)?.[0] || 'music';

  const identity = blueprint?.identity as Record<string, any> | null;
  const dna = blueprint?.artist_dna as Record<string, any> | null;
  const sound = blueprint?.sound as Record<string, any> | null;
  const brandProfile = blueprint?.brand_profile as Record<string, any> | null;

  const traits = Array.isArray(identity?.personality_traits)
    ? identity.personality_traits.join(', ')
    : 'creative, authentic, ambitious';

  const moodKeywords = Array.isArray(brandProfile?.mood_keywords)
    ? brandProfile.mood_keywords.join(', ')
    : 'energetic, passionate, bold';

  const voice = identity?.social_media_voice || 'authentic and engaging';

  return `# Soul — AI Assistant for ${name}

## Role
You are the dedicated AI manager and creative partner for **${name}**, a ${genre} artist on the Boostify Music Platform.

Your mission is to help ${name} grow their music career, create compelling content, and build their brand — all with deep personalized knowledge of who they are as an artist.

## Artist Voice & Personality
When creating content or messaging AS or FOR ${name}:
- **Personality**: ${traits}
- **Energy**: ${moodKeywords}
- **Communication Style**: ${identity?.communication_style || 'direct and authentic'}
- **Social Media Voice**: ${voice}
- **Brand Archetype**: ${identity?.brand_archetype || dna?.career_stage || 'Emerging Artist'}

## Content Guidelines
- Always reflect the artist's authentic personality — never generic
- Genre context: **${genre}** — stay culturally relevant
- Target audience: ${(blueprint?.strategy as any)?.target_audience_description || 'music fans, ages 18-35'}
- Visual signature: ${identity?.visual_signature || 'consistent and bold'}
- Language: Adapt to artist's natural communication style (may use slang, regional expressions)

## Boostify Platform Context
You have access to the Boostify API via custom tools:
- \`get_artist_profile\` — Get current artist data, stats, songs
- \`get_artist_songs\` — Get full song catalog with performance data
- \`get_artist_blueprint\` — Get the 13-module strategic blueprint
- \`create_social_post\` — Save content ideas to the platform
- \`update_artist_notes\` — Update artist memory with new learnings
- \`get_artist_analytics\` — Get streaming and engagement stats

## Sound DNA
${sound?.primary_sound_description || `${genre} with a unique artistic voice`}

Key influences: ${Array.isArray(sound?.key_influences) ? sound.key_influences.join(', ') : 'Various genre legends'}

## Important Notes for Every Interaction
1. **Always check** the artist's latest data before making recommendations
2. **Be specific** — generic advice is worthless for a real artist
3. **Remember context** from previous sessions (check MEMORY.md)
4. **Respect their goals** — always align suggestions with their 90-day focus
5. **Output-oriented** — end every task with clear next steps the artist can take NOW

## Persona Rules
- DO NOT pretend to be ${name} in third-party contexts without consent
- DO write content in their voice when asked
- DO proactively flag opportunities (trending sounds, viral moments, collaboration chances)
- DO track and remind about time-sensitive tasks (release dates, deadlines)
`;
}

/**
 * Generate current goals array from blueprint strategy.
 */
function generateGoals(
  artist: Record<string, any>,
  blueprint: Record<string, any> | null
): HermesGoal[] {
  const strategy = blueprint?.strategy as Record<string, any> | null;
  const goals: HermesGoal[] = [];

  if (!strategy) {
    return [
      {
        id: 'default-1',
        title: 'Generate Superstar Blueprint',
        description: 'Generate the AI-powered Superstar Blueprint to unlock personalized strategy',
        priority: 'high',
        status: 'active',
        category: 'brand',
      },
    ];
  }

  // Priority 90-day goal
  if (strategy['90_day_priority']) {
    goals.push({
      id: 'goal-90d',
      title: '90-Day Priority',
      description: String(strategy['90_day_priority']),
      priority: 'high',
      status: 'active',
      category: 'growth',
    });
  }

  // Content goal
  if (strategy.content_frequency) {
    goals.push({
      id: 'goal-content',
      title: 'Content Consistency',
      description: `Post ${strategy.content_frequency} across platforms`,
      priority: 'medium',
      status: 'active',
      category: 'content',
    });
  }

  // Release goal
  if (strategy.release_cadence) {
    goals.push({
      id: 'goal-release',
      title: 'Release Cadence',
      description: `Release music ${strategy.release_cadence}`,
      priority: 'medium',
      status: 'active',
      category: 'release',
    });
  }

  // Monetization
  const monetization = blueprint?.monetization as Record<string, any> | null;
  if (monetization?.primary_revenue_streams) {
    goals.push({
      id: 'goal-monetize',
      title: 'Monetization',
      description: `Activate: ${Array.isArray(monetization.primary_revenue_streams) ? monetization.primary_revenue_streams.slice(0, 3).join(', ') : 'multiple revenue streams'}`,
      priority: 'medium',
      status: 'active',
      category: 'monetization',
    });
  }

  return goals.length > 0 ? goals : [
    {
      id: 'default-growth',
      title: 'Grow Music Career',
      description: 'Build audience, release music, and monetize consistently',
      priority: 'high',
      status: 'active',
      category: 'growth',
    },
  ];
}

/**
 * Apply incoming memory updates from Hermes back to the artist's record.
 * Parses Hermes-formatted key: value pairs and stores them.
 */
export async function applyHermesMemoryUpdate(
  artistId: number,
  memorySection: string
): Promise<{ updated: boolean; fields: string[] }> {
  // Parse simple key: value lines from Hermes memory update
  const lines = memorySection.split('\n');
  const updates: Record<string, string> = {};

  for (const line of lines) {
    const match = line.match(/^[-*]?\s*\*{0,2}([^:*]+)\*{0,2}:\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      updates[key] = match[2].trim();
    }
  }

  // Map known fields to DB columns (safe whitelist)
  const fieldMap: Record<string, string> = {
    biography: 'biography',
    bio: 'biography',
    location: 'location',
    genre: 'genre',
    website: 'website',
    instagram: 'instagramHandle',
    twitter_handle: 'twitterHandle',
    spotify_url: 'spotifyUrl',
  };

  const dbUpdates: Record<string, string> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (fieldMap[key]) {
      dbUpdates[fieldMap[key]] = value;
    }
  }

  if (Object.keys(dbUpdates).length === 0) {
    return { updated: false, fields: [] };
  }

  await pgDb
    .update(users)
    .set(dbUpdates as any)
    .where(eq(users.id, artistId));

  return { updated: true, fields: Object.keys(dbUpdates) };
}
