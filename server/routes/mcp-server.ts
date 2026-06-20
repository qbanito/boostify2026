/**
 * Boostify MCP (Model Context Protocol) Server
 * Exposes all Boostify intelligence tools to AI agents via MCP protocol.
 * Supports SSE transport for remote access and Stdio for local.
 */
import { Router, Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db';
import { mcpApiKeys, mcpApiKeyScopes, type MCPApiKeyScope } from '../../db/schema';
import { mcpAuth, requireMcpScope, generateApiKey, hashApiKey } from '../middleware/mcp-auth';
import { authenticate } from '../middleware/auth';
import { mcpBodyCategoryRateLimit, getCategoryLimits, getUsageSnapshot } from '../middleware/mcp-rate-limiter';

// ─── Tool Definitions ───────────────────────────────────────────

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  inputSchema: Record<string, any>;
}

export const MCP_TOOLS: MCPTool[] = [
  // Artist Intelligence
  {
    name: 'search_artist',
    description: 'Search for an artist across Spotify and YouTube. Returns cross-platform IDs, followers, popularity, genres.',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Artist name to search' } }, required: ['query'] },
  },
  {
    name: 'get_artist_stats',
    description: 'Get multi-platform statistics for an artist (Spotify followers, popularity, YouTube subscribers, video views).',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' }, period: { type: 'number', default: 30 } }, required: ['artistId'] },
  },
  {
    name: 'get_geographic_data',
    description: 'Get geographic listener distribution estimates based on genre. Returns top countries and cities.',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  {
    name: 'analyze_growth_rates',
    description: 'Analyze growth trends (accelerating, steady, decelerating, declining) across platforms.',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' }, platform: { type: 'string', default: 'spotify' }, period: { type: 'number', default: 90 } }, required: ['artistId'] },
  },
  {
    name: 'find_similar_artists',
    description: 'Find similar artists using Spotify Fans Also Like graph. Returns related artists with overlap scores.',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  {
    name: 'find_genre_competitors',
    description: 'Find genre competitors with market position analysis (same genre, similar scale).',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  {
    name: 'get_career_stage',
    description: 'Classify artist career stage: Superstar, Mainstream, Mid-Level, Developing, Emerging, Long-Tail.',
    category: 'artist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  // Playlist & Chart Intelligence  
  {
    name: 'find_editorial_placements',
    description: 'Track editorial playlist placements for an artist. Returns playlists where artist tracks appear.',
    category: 'playlist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' }, days: { type: 'number', default: 90 } }, required: ['artistId'] },
  },
  {
    name: 'get_active_playlists',
    description: 'List all playlists currently featuring an artist.',
    category: 'playlist-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  {
    name: 'search_playlists',
    description: 'Search for playlists by genre keyword.',
    category: 'playlist-intelligence',
    inputSchema: { type: 'object', properties: { genre: { type: 'string' } }, required: ['genre'] },
  },
  {
    name: 'get_available_charts',
    description: 'List available music charts (Global Top 50, country-specific, Viral 50).',
    category: 'chart-intelligence',
    inputSchema: { type: 'object', properties: { platform: { type: 'string', default: 'spotify' }, country: { type: 'string' } } },
  },
  {
    name: 'get_chart_ranking',
    description: 'Get current chart ranking data with track positions, artists, and popularity.',
    category: 'chart-intelligence',
    inputSchema: { type: 'object', properties: { chartSlug: { type: 'string', description: 'Chart identifier (e.g. global-top-50, us-top-50)' } }, required: ['chartSlug'] },
  },
  // Song DNA & Market
  {
    name: 'resolve_song',
    description: 'Resolve a song by ISRC, Spotify ID, or title+artist. Returns canonical identifiers.',
    category: 'song-intelligence',
    inputSchema: { type: 'object', properties: { isrc: { type: 'string' }, spotifyId: { type: 'string' }, title: { type: 'string' }, artist: { type: 'string' } } },
  },
  {
    name: 'get_song_metadata',
    description: 'Get full Song DNA: audio features, genres, mood, key, tempo, time signature.',
    category: 'song-intelligence',
    inputSchema: { type: 'object', properties: { songId: { type: 'string' } }, required: ['songId'] },
  },
  {
    name: 'get_song_performance',
    description: 'Get song performance metrics: popularity, estimated streams.',
    category: 'song-intelligence',
    inputSchema: { type: 'object', properties: { songId: { type: 'string' } }, required: ['songId'] },
  },
  {
    name: 'get_audio_features',
    description: 'Get detailed audio features: danceability, energy, valence, acousticness, tempo, key, etc.',
    category: 'song-intelligence',
    inputSchema: { type: 'object', properties: { songId: { type: 'string' } }, required: ['songId'] },
  },
  {
    name: 'get_audience_demographics',
    description: 'Get audience demographics: age distribution, gender, top countries, interests.',
    category: 'song-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  {
    name: 'analyze_market_potential',
    description: 'Analyze market potential for an artist in a specific city (TAM, penetration, growth gap).',
    category: 'song-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' }, city: { type: 'string' }, country: { type: 'string' } }, required: ['artistId', 'city', 'country'] },
  },
  {
    name: 'match_song_across_platforms',
    description: 'Find the same recording on Spotify, Apple Music, Deezer, MusicBrainz, and YouTube. Returns per-platform matches with confidence scores.',
    category: 'song-intelligence',
    inputSchema: {
      type: 'object',
      properties: {
        isrc:        { type: 'string', description: 'ISRC code (preferred for exact matching)' },
        spotifyId:   { type: 'string', description: 'Spotify track ID' },
        title:       { type: 'string', description: 'Song title' },
        artistName:  { type: 'string', description: 'Artist name' },
      },
    },
  },
  {
    name: 'predict_hit_potential',
    description: 'Predict the hit potential of a Spotify track. Returns an overall score (0–100), letter grade (S/A/B/C/D), per-factor breakdown (danceability, energy, valence, tempo, loudness, artist momentum, genre trend, duration), actionable recommendations, and comparable songs.',
    category: 'song-intelligence',
    inputSchema: {
      type: 'object',
      properties: {
        spotifyTrackId: { type: 'string', description: 'Spotify track ID' },
      },
      required: ['spotifyTrackId'],
    },
  },
  // Tour Intelligence
  {
    name: 'find_opening_acts_local',
    description: 'Find local opening act candidates for a tour stop in a specific country.',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' }, country: { type: 'string' }, city: { type: 'string' } }, required: ['artistId', 'country'] },
  },
  {
    name: 'find_opening_acts_strategic',
    description: 'Find high-growth emerging artists as strategic opening acts.',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: { artistId: { type: 'string' } }, required: ['artistId'] },
  },
  {
    name: 'search_festivals',
    description: 'Search festivals by genre, country, or name. Database of 18+ major global festivals.',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: { genre: { type: 'string' }, country: { type: 'string' }, name: { type: 'string' } } },
  },
  {
    name: 'get_upcoming_festivals',
    description: 'Get upcoming festivals sorted by date, optionally filtered by genre.',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: { genre: { type: 'string' }, limit: { type: 'number', default: 20 } } },
  },
  {
    name: 'get_artist_live_events',
    description: 'Fetch upcoming live events for an artist by name from Bandsintown and Songkick.',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: { artistName: { type: 'string' } }, required: ['artistName'] },
  },
  {
    name: 'get_nearby_live_events',
    description: 'Get upcoming live events in a city or metro area (Songkick metro lookup).',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: { location: { type: 'string' }, genre: { type: 'string' } }, required: ['location'] },
  },
  {
    name: 'get_live_event_sources',
    description: 'Check which live-event data APIs (Bandsintown, Songkick) are configured.',
    category: 'tour-intelligence',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'optimize_tour_route',
    description: 'Optimise a multi-city tour route using Nearest-Neighbour TSP + 2-opt. Returns ordered stops with distances, travel modes, and rest-day suggestions.',
    category: 'tour-intelligence',
    inputSchema: {
      type: 'object',
      properties: {
        cities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              countryCode: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
            required: ['name'],
          },
        },
        anchor: { type: 'boolean', default: true },
      },
      required: ['cities'],
    },
  },
  // Existing Boostify tools
  {
    name: 'generate_music',
    description: 'Generate AI music tracks using Boostify music generation engine.',
    category: 'content-creation',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, genre: { type: 'string' }, duration: { type: 'number' } }, required: ['prompt'] },
  },
  {
    name: 'generate_cover_art',
    description: 'Generate album cover art using AI (DALL-E, Flux, or Gemini).',
    category: 'content-creation',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, style: { type: 'string' } }, required: ['prompt'] },
  },
  {
    name: 'analyze_audio',
    description: 'Analyze audio for BPM, key, energy, genre classification.',
    category: 'audio-analysis',
    inputSchema: { type: 'object', properties: { audioUrl: { type: 'string' } }, required: ['audioUrl'] },
  },
  {
    name: 'transcribe_audio',
    description: 'Transcribe audio to text with timestamps (Whisper).',
    category: 'audio-analysis',
    inputSchema: { type: 'object', properties: { audioUrl: { type: 'string' }, language: { type: 'string' } }, required: ['audioUrl'] },
  },
  {
    name: 'clone_voice',
    description: 'Create a voice clone from audio samples for AI singing.',
    category: 'voice-ai',
    inputSchema: { type: 'object', properties: { audioUrl: { type: 'string' }, voiceName: { type: 'string' } }, required: ['audioUrl', 'voiceName'] },
  },
  {
    name: 'distribute_music',
    description: 'Submit a release for distribution to streaming platforms.',
    category: 'distribution',
    inputSchema: { type: 'object', properties: { releaseId: { type: 'string' }, platforms: { type: 'array', items: { type: 'string' } } }, required: ['releaseId'] },
  },
];

// ─── Tool Executor ──────────────────────────────────────────────

export async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    // Artist Intelligence
    case 'search_artist': {
      const { searchArtist } = await import('../services/artist-intelligence');
      return searchArtist(args.query);
    }
    case 'get_artist_stats': {
      const { getArtistStats } = await import('../services/artist-intelligence');
      return getArtistStats(args.artistId, args.period || 30);
    }
    case 'get_geographic_data': {
      const { getGeographicData } = await import('../services/artist-intelligence');
      return getGeographicData(args.artistId);
    }
    case 'analyze_growth_rates': {
      const { analyzeGrowthRates } = await import('../services/artist-intelligence');
      return analyzeGrowthRates(args.artistId, args.platform || 'spotify', args.period || 90);
    }
    case 'find_similar_artists': {
      const { findSimilarArtists } = await import('../services/artist-intelligence');
      return findSimilarArtists(args.artistId);
    }
    case 'find_genre_competitors': {
      const { findGenreCompetitors } = await import('../services/artist-intelligence');
      return findGenreCompetitors(args.artistId);
    }
    case 'get_career_stage': {
      const { getCareerStage } = await import('../services/artist-intelligence');
      return getCareerStage(args.artistId);
    }
    // Playlist & Chart Intelligence
    case 'find_editorial_placements': {
      const { findEditorialPlacements } = await import('../services/playlist-chart-intelligence');
      return findEditorialPlacements(args.artistId, args.days || 90);
    }
    case 'get_active_playlists': {
      const { getArtistActivePlaylists } = await import('../services/playlist-chart-intelligence');
      return getArtistActivePlaylists(args.artistId);
    }
    case 'search_playlists': {
      const { searchGlobalPlaylists } = await import('../services/playlist-chart-intelligence');
      return searchGlobalPlaylists(args.genre);
    }
    case 'get_available_charts': {
      const { getAvailableCharts } = await import('../services/playlist-chart-intelligence');
      return getAvailableCharts(args.platform, args.country);
    }
    case 'get_chart_ranking': {
      const { getChartRanking } = await import('../services/playlist-chart-intelligence');
      return getChartRanking(args.chartSlug);
    }
    // Song DNA
    case 'resolve_song': {
      const { resolveSongIdentity } = await import('../services/song-market-intelligence');
      return resolveSongIdentity(args);
    }
    case 'get_song_metadata': {
      const { getSongMetadata } = await import('../services/song-market-intelligence');
      return getSongMetadata(args.songId);
    }
    case 'get_song_performance': {
      const { getSongPerformance } = await import('../services/song-market-intelligence');
      return getSongPerformance(args.songId);
    }
    case 'get_audio_features': {
      const { getAudioFeatures } = await import('../services/song-market-intelligence');
      return getAudioFeatures(args.songId);
    }
    case 'get_audience_demographics': {
      const { getAudienceDemographics } = await import('../services/song-market-intelligence');
      return getAudienceDemographics(args.artistId);
    }
    case 'analyze_market_potential': {
      const { analyzeMarketPotential } = await import('../services/song-market-intelligence');
      return analyzeMarketPotential(args.artistId, args.city, args.country);
    }
    case 'match_song_across_platforms': {
      const { matchSongAcrossPlatforms } = await import('../services/cross-platform-matching');
      return matchSongAcrossPlatforms({
        isrc:       args.isrc       as string | undefined,
        spotifyId:  args.spotifyId  as string | undefined,
        title:      args.title      as string | undefined,
        artistName: args.artistName as string | undefined,
      });
    }
    case 'predict_hit_potential': {
      const { scoreHitPotential } = await import('../services/song-market-intelligence');
      return scoreHitPotential(args.spotifyTrackId as string);
    }
    // Tour Intelligence
    case 'find_opening_acts_local': {
      const { findLocalOpeningActs } = await import('../services/tour-intelligence');
      return findLocalOpeningActs(args.artistId, args.country, args.city);
    }
    case 'find_opening_acts_strategic': {
      const { findStrategicOpeningActs } = await import('../services/tour-intelligence');
      return findStrategicOpeningActs(args.artistId);
    }
    case 'search_festivals': {
      const { searchFestivals } = await import('../services/tour-intelligence');
      return searchFestivals(args);
    }
    case 'get_upcoming_festivals': {
      const { getUpcomingFestivals } = await import('../services/tour-intelligence');
      return getUpcomingFestivals(args.genre, args.limit);
    }
    case 'get_artist_live_events': {
      const { getArtistLiveEvents } = await import('../services/live-events');
      return getArtistLiveEvents(args.artistName as string);
    }
    case 'get_nearby_live_events': {
      const { getNearbyLiveEvents } = await import('../services/live-events');
      return getNearbyLiveEvents(args.location as string, args.genre as string | undefined);
    }
    case 'get_live_event_sources': {
      const { getLiveEventSources } = await import('../services/live-events');
      return getLiveEventSources();
    }
    case 'optimize_tour_route': {
      const { optimizeTourRoute } = await import('../services/tour-routing');
      return optimizeTourRoute(args.cities as Array<{ name: string; countryCode?: string; lat?: number; lng?: number }>, { anchor: args.anchor as boolean | undefined });
    }
    default:
      throw new Error(`Tool '${toolName}' not implemented`);
  }
}

// ─── MCP Router ─────────────────────────────────────────────────

const router = Router();

// GET /api/mcp/tools — List all available tools
router.get('/tools', mcpAuth, requireMcpScope('tools:read'), async (_req: Request, res: Response) => {
  res.json({
    tools: MCP_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
});

// GET /api/mcp/tools/categories — List tools by category
router.get('/tools/categories', mcpAuth, requireMcpScope('tools:read'), async (_req: Request, res: Response) => {
  const categories: Record<string, MCPTool[]> = {};
  for (const tool of MCP_TOOLS) {
    if (!categories[tool.category]) categories[tool.category] = [];
    categories[tool.category].push(tool);
  }
  res.json({ categories });
});

// POST /api/mcp/execute — Execute a tool
router.post('/execute', mcpAuth, requireMcpScope('tools:execute'), mcpBodyCategoryRateLimit, async (req: Request, res: Response) => {
  try {
    const { tool, arguments: args } = req.body;
    if (!tool || typeof tool !== 'string') {
      return res.status(400).json({ error: 'Missing required field: tool' });
    }
    const toolDef = MCP_TOOLS.find(t => t.name === tool);
    if (!toolDef) {
      return res.status(404).json({ error: `Unknown tool: ${tool}`, available: MCP_TOOLS.map(t => t.name) });
    }
    const result = await executeTool(tool, args || {});
    res.json({
      tool,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    res.status(500).json({ error: message });
  }
});

// SSE endpoint for streaming tool execution
router.get('/sse', mcpAuth, requireMcpScope('sse:connect'), (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'connected', tools: MCP_TOOLS.length })}\n\n`);

  // Keep alive
  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30000);

  req.on('close', () => clearInterval(interval));
});

// POST /api/mcp/sse/execute — Execute via SSE stream
router.post('/sse/execute', mcpAuth, requireMcpScope('sse:connect'), mcpBodyCategoryRateLimit, async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    const { tool, arguments: args } = req.body;
    res.write(`data: ${JSON.stringify({ type: 'start', tool })}\n\n`);
    const result = await executeTool(tool, args || {});
    res.write(`data: ${JSON.stringify({ type: 'result', tool, result })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
  }
  res.end();
});

// ─── API Key Management Routes ────────────────────────────────

// POST /api/mcp/keys — Create a new API key (requires session/Clerk auth)
router.post('/keys', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id?: string | number })?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, scopes, rateLimit, expiresAt } = req.body as {
      name: string;
      scopes?: MCPApiKeyScope[];
      rateLimit?: number;
      expiresAt?: string | null;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Validate scopes
    const resolvedScopes: MCPApiKeyScope[] = Array.isArray(scopes) && scopes.length > 0
      ? scopes.filter((s): s is MCPApiKeyScope => (mcpApiKeyScopes as readonly string[]).includes(s))
      : [...mcpApiKeyScopes];

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12); // 'bmcp_' + 7 chars

    const [created] = await db.insert(mcpApiKeys).values({
      userId: Number(userId),
      name: name.trim(),
      keyPrefix,
      keyHash,
      scopes: resolvedScopes,
      rateLimit: typeof rateLimit === 'number' && rateLimit > 0 ? rateLimit : 60,
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();

    // Return the raw key ONCE — it will never be readable again
    return res.status(201).json({
      id: created.id,
      name: created.name,
      key: rawKey,   // shown only on creation
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      rateLimit: created.rateLimit,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
      warning: 'Copy this key now. It will not be shown again.',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
});

// GET /api/mcp/keys — List API keys for the authenticated user
router.get('/keys', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id?: string | number })?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await db
      .select({
        id: mcpApiKeys.id,
        name: mcpApiKeys.name,
        keyPrefix: mcpApiKeys.keyPrefix,
        scopes: mcpApiKeys.scopes,
        rateLimit: mcpApiKeys.rateLimit,
        isActive: mcpApiKeys.isActive,
        lastUsedAt: mcpApiKeys.lastUsedAt,
        expiresAt: mcpApiKeys.expiresAt,
        createdAt: mcpApiKeys.createdAt,
      })
      .from(mcpApiKeys)
      .where(eq(mcpApiKeys.userId, Number(userId)))
      .orderBy(desc(mcpApiKeys.createdAt));

    return res.json({ keys: rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
});

// PATCH /api/mcp/keys/:id — Update name, scopes, rateLimit, or isActive
router.patch('/keys/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id?: string | number })?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const keyId = parseInt(req.params.id, 10);
    if (isNaN(keyId)) return res.status(400).json({ error: 'Invalid key id' });

    const { name, scopes, rateLimit, isActive } = req.body as {
      name?: string;
      scopes?: MCPApiKeyScope[];
      rateLimit?: number;
      isActive?: boolean;
    };

    // Verify ownership
    const existing = await db
      .select({ id: mcpApiKeys.id })
      .from(mcpApiKeys)
      .where(eq(mcpApiKeys.id, keyId))
      .limit(1);

    if (!existing[0]) return res.status(404).json({ error: 'Key not found' });

    const updates: Partial<typeof mcpApiKeys.$inferInsert> = { updatedAt: new Date() };
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (typeof rateLimit === 'number' && rateLimit > 0) updates.rateLimit = rateLimit;
    if (Array.isArray(scopes)) {
      updates.scopes = scopes.filter((s): s is MCPApiKeyScope =>
        (mcpApiKeyScopes as readonly string[]).includes(s));
    }

    const [updated] = await db
      .update(mcpApiKeys)
      .set(updates)
      .where(eq(mcpApiKeys.id, keyId))
      .returning({
        id: mcpApiKeys.id,
        name: mcpApiKeys.name,
        keyPrefix: mcpApiKeys.keyPrefix,
        scopes: mcpApiKeys.scopes,
        rateLimit: mcpApiKeys.rateLimit,
        isActive: mcpApiKeys.isActive,
        expiresAt: mcpApiKeys.expiresAt,
        updatedAt: mcpApiKeys.updatedAt,
      });

    return res.json(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
});

// DELETE /api/mcp/keys/:id — Permanently revoke/delete an API key
router.delete('/keys/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id?: string | number })?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const keyId = parseInt(req.params.id, 10);
    if (isNaN(keyId)) return res.status(400).json({ error: 'Invalid key id' });

    await db.delete(mcpApiKeys).where(eq(mcpApiKeys.id, keyId));

    return res.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
});

// POST /api/mcp/keys/:id/test — Test a stored key (by ID, without raw value)
// Returns a simulated probe of what the key can do: validates active/not-expired,
// enumerates tools for its scopes, and runs a lightweight safe probe.
router.post('/keys/:id/test', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id?: string | number })?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const keyId = parseInt(req.params.id, 10);
    if (isNaN(keyId)) return res.status(400).json({ error: 'Invalid key id' });

    const [key] = await db.select().from(mcpApiKeys)
      .where(eq(mcpApiKeys.id, keyId)).limit(1);

    if (!key) return res.status(404).json({ error: 'Key not found' });
    if (Number(key.userId) !== Number(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const expired = key.expiresAt ? new Date(key.expiresAt) < now : false;
    const scopes = (key.scopes || []) as MCPApiKeyScope[];

    // Count tools reachable per scope
    const toolsRead = scopes.includes('tools:read');
    const toolsExec = scopes.includes('tools:execute');
    const sse = scopes.includes('sse:connect');
    const reachableTools = (toolsRead || toolsExec) ? MCP_TOOLS.length : 0;
    const reachableCategories = (toolsRead || toolsExec)
      ? [...new Set(MCP_TOOLS.map(t => t.category))].length : 0;

    const checks = [
      { name: 'Key stored',       ok: true },
      { name: 'Active',           ok: !!key.isActive },
      { name: 'Not expired',      ok: !expired },
      { name: 'Has scopes',       ok: scopes.length > 0 },
      { name: 'tools:read',       ok: toolsRead },
      { name: 'tools:execute',    ok: toolsExec },
      { name: 'sse:connect',      ok: sse },
      { name: 'Rate limit > 0',   ok: (key.rateLimit || 0) > 0 },
    ];
    const allPassed = checks
      .filter(c => ['Key stored', 'Active', 'Not expired', 'Has scopes', 'Rate limit > 0'].includes(c.name))
      .every(c => c.ok);

    return res.json({
      success: allPassed,
      keyId,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      expired,
      scopes,
      rateLimit: key.rateLimit,
      lastUsedAt: key.lastUsedAt,
      reachable: {
        tools: reachableTools,
        categories: reachableCategories,
        transports: [
          ...(toolsRead || toolsExec ? ['http'] : []),
          ...(sse ? ['sse'] : []),
        ],
      },
      checks,
      probeAt: now.toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
});

// GET /api/mcp/admin/status — System-wide MCP health (requires user auth)
router.get('/admin/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as { id?: string | number })?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const categories = [...new Set(MCP_TOOLS.map(t => t.category))];
    const now = new Date();

    const userKeys = await db.select({
      id: mcpApiKeys.id,
      isActive: mcpApiKeys.isActive,
      expiresAt: mcpApiKeys.expiresAt,
      lastUsedAt: mcpApiKeys.lastUsedAt,
    }).from(mcpApiKeys).where(eq(mcpApiKeys.userId, Number(userId)));

    const activeKeys = userKeys.filter(
      k => k.isActive && (!k.expiresAt || new Date(k.expiresAt) >= now),
    ).length;
    const expiredKeys = userKeys.filter(
      k => k.expiresAt && new Date(k.expiresAt) < now,
    ).length;
    const lastUsed = userKeys
      .map(k => k.lastUsedAt ? new Date(k.lastUsedAt).getTime() : 0)
      .reduce((a, b) => Math.max(a, b), 0);

    const limits = getCategoryLimits();

    return res.json({
      success: true,
      server: {
        name: 'boostify-mcp-server',
        version: '1.0.0',
        online: true,
        transports: ['http', 'sse', 'stdio'],
      },
      tools: {
        total: MCP_TOOLS.length,
        categories: categories.length,
        byCategory: categories.map(c => ({
          category: c,
          count: MCP_TOOLS.filter(t => t.category === c).length,
        })),
      },
      keys: {
        total: userKeys.length,
        active: activeKeys,
        expired: expiredKeys,
        lastUsedAt: lastUsed ? new Date(lastUsed).toISOString() : null,
      },
      rateLimits: {
        windowMs: 60_000,
        categories: limits,
      },
      scopesSupported: ['tools:read', 'tools:execute', 'sse:connect'],
      probeAt: now.toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    return res.status(500).json({ error: message });
  }
});

// GET /api/mcp/rate-limits — Per-category rate-limit config
router.get('/rate-limits', mcpAuth, async (req: Request, res: Response) => {
  const limits = getCategoryLimits();

  // Include caller's current usage if they have an identity
  const identity =
    req.mcpApiKey?.keyPrefix
      ? `apikey:${req.mcpApiKey.keyPrefix}`
      : `ip:${((req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip ?? 'unknown')}`;

  const usage = getUsageSnapshot(identity);

  res.json({
    windowMs: 60_000,
    windowDescription: '1 minute sliding window',
    categories: limits.map(l => ({
      ...l,
      used: usage[l.category]?.used ?? 0,
      remaining: Math.max(0, l.limit - (usage[l.category]?.used ?? 0)),
    })),
    identity: req.mcpApiKey
      ? { type: 'api-key', prefix: req.mcpApiKey.keyPrefix, keyRateLimit: req.mcpApiKey.rateLimit }
      : { type: 'session' },
  });
});

// GET /api/mcp/info — Server info
router.get('/info', async (_req: Request, res: Response) => {
  res.json({
    name: 'boostify-mcp-server',
    version: '1.0.0',
    description: 'Boostify Music Platform MCP Server — AI agent tools for the music industry',
    totalTools: MCP_TOOLS.length,
    categories: [...new Set(MCP_TOOLS.map(t => t.category))],
    transport: ['http', 'sse', 'stdio'],
    documentation: '/api/mcp/tools',
    stdio: {
      description: 'Stdio transport for local AI agents (Claude Desktop, VS Code extensions, custom bots)',
      command: 'npx tsx server/mcp/stdio-transport.ts',
      npmScript: 'npm run mcp:stdio',
      protocol: 'JSON-RPC 2.0 (newline-delimited)',
      methods: ['initialize', 'initialized', 'ping', 'tools/list', 'tools/call'],
      claudeDesktopConfig: {
        mcpServers: {
          boostify: {
            command: 'npx',
            args: ['tsx', 'server/mcp/stdio-transport.ts'],
            env: {
              DATABASE_URL: '<your-neon-database-url>',
              SPOTIFY_CLIENT_ID: '<optional>',
              SPOTIFY_CLIENT_SECRET: '<optional>',
            },
          },
        },
      },
    },
  });
});

export default router;
