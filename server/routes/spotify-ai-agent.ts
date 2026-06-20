import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { users, songs, spotifyCurators, spotifyExtensionConnections, spotifyProfileSnapshots, spotifyContentLibrary } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { authenticate } from '../middleware/auth';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

const openai = process.env.OPENAI_API_KEY ? createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function resolveNumericUserId(userId: string | number): Promise<number | null> {
  if (typeof userId === 'number') return userId;
  const str = String(userId);
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  if (str.startsWith('user_')) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, str)).limit(1);
    return user?.id || null;
  }
  return null;
}

async function getArtistContext(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const artistSongs = await db.select().from(songs).where(eq(songs.artistId, userId)).orderBy(desc(songs.createdAt)).limit(5);
  const [conn] = await db.select().from(spotifyExtensionConnections).where(eq(spotifyExtensionConnections.userId, userId)).limit(1);
  const snapshots = conn ? await db.select().from(spotifyProfileSnapshots)
    .where(eq(spotifyProfileSnapshots.connectionId, conn.id))
    .orderBy(desc(spotifyProfileSnapshots.snapshotAt)).limit(5) : [];

  return {
    name: user?.displayName || user?.username || 'Artist',
    genre: user?.genre || 'Music',
    bio: user?.biography || '',
    spotifyUrl: user?.spotifyUrl || '',
    monthlyListeners: conn?.monthlyListeners || 0,
    followers: conn?.followers || 0,
    totalStreams: conn?.totalStreams || 0,
    topCities: conn?.topCities || [],
    recentTracks: artistSongs.map(s => ({ title: s.title, genre: s.genre })),
    snapshots: snapshots.map(s => ({ listeners: s.monthlyListeners, followers: s.followers, date: s.snapshotAt })),
  };
}

// Chat endpoint — conversational AI for Spotify growth
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });

    const { message } = req.body;
    if (!message || message.length > 2000) return res.status(400).json({ error: 'Message required (max 2000 chars)' });

    const ctx = await getArtistContext(numId);

    if (!openai) {
      // Offline fallback
      return res.json({ response: getOfflineResponse(message), source: 'offline' });
    }

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: `You are SpotifyBot, an expert Spotify growth advisor for music artists on the Boostify platform. 
Artist context: ${ctx.name}, Genre: ${ctx.genre}, Monthly Listeners: ${ctx.monthlyListeners}, Followers: ${ctx.followers}, Total Streams: ${ctx.totalStreams}
Recent tracks: ${ctx.recentTracks.map(t => t.title).join(', ')}
Top cities: ${ctx.topCities.map((c: any) => c.city).join(', ')}
Bio: ${ctx.bio}
Give specific, actionable advice. Reference their actual data. Be concise.` },
        { role: 'user', content: message }
      ],
      max_tokens: 800,
    });

    res.json({ response: completion.choices[0].message.content, source: 'openai' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Execute action — structured tool execution
router.post('/execute', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });

    const { action, params } = req.body;
    const ctx = await getArtistContext(numId);

    const handlers: Record<string, () => Promise<any>> = {
      'generate-pitch': async () => {
        if (!openai) return { type: 'pitch', result: { pitchEmail: `Hi,\n\nI'd love to submit "${ctx.recentTracks[0]?.title || 'my latest track'}" for your playlist consideration.\n\nBest,\n${ctx.name}` } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Generate a professional Spotify playlist pitch email. Artist: ${ctx.name}, Genre: ${ctx.genre}, Monthly Listeners: ${ctx.monthlyListeners}. Track: ${params?.trackName || ctx.recentTracks[0]?.title || 'latest track'}. Curator: ${params?.curatorName || 'Playlist Curator'}. Playlist: ${params?.playlistName || ''}. Format as JSON: {"subject":"...", "pitchEmail":"...", "followUpEmail":"...", "tips":["...",]}` },
            { role: 'user', content: 'Generate the pitch' }],
          max_tokens: 1000, response_format: { type: 'json_object' },
        });
        return { type: 'pitch', result: JSON.parse(r.choices[0].message.content || '{}') };
      },

      'optimize-seo': async () => {
        if (!openai) return { type: 'seo', result: { optimizedTitle: ctx.recentTracks[0]?.title || 'Track', keywords: ['music', ctx.genre.toLowerCase()], tips: ['Add genre keywords to description'] } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Optimize Spotify SEO for artist ${ctx.name}, genre ${ctx.genre}. Track: ${params?.trackName || ctx.recentTracks[0]?.title}. Format as JSON: {"optimizedTitle":"...", "optimizedDescription":"...", "keywords":["..."], "tags":["..."], "tips":["..."]}` },
            { role: 'user', content: 'Optimize SEO' }],
          max_tokens: 800, response_format: { type: 'json_object' },
        });
        return { type: 'seo', result: JSON.parse(r.choices[0].message.content || '{}') };
      },

      'find-playlists': async () => {
        if (!openai) return { type: 'playlists', result: { playlists: [{ name: `${ctx.genre} Vibes`, followers: '10K+', matchScore: 85 }] } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Find 10 Spotify playlists perfect for: Artist: ${ctx.name}, Genre: ${ctx.genre}, Monthly Listeners: ${ctx.monthlyListeners}, Track mood: ${params?.mood || 'energetic'}. Format as JSON: {"playlists":[{"name":"...", "estimatedFollowers":"...", "genre":"...", "matchScore":85, "submissionTip":"...", "curatorType":"..."}]}` },
            { role: 'user', content: 'Find matching playlists' }],
          max_tokens: 1000, response_format: { type: 'json_object' },
        });
        return { type: 'playlists', result: JSON.parse(r.choices[0].message.content || '{}') };
      },

      'growth-plan': async () => {
        if (!openai) return { type: 'growth-plan', result: { weeks: [{ week: 1, tasks: ['Optimize Spotify profile', 'Submit to 5 playlists'] }] } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Create a 4-week Spotify growth plan for: ${ctx.name}, ${ctx.genre}, ${ctx.monthlyListeners} monthly listeners, ${ctx.followers} followers. Format as JSON: {"goal":"...", "currentState":"...", "weeks":[{"week":1, "focus":"...", "tasks":["..."], "expectedResult":"..."}], "projectedListeners":0, "keyMetrics":["..."]}` },
            { role: 'user', content: 'Create growth plan' }],
          max_tokens: 1200, response_format: { type: 'json_object' },
        });
        return { type: 'growth-plan', result: JSON.parse(r.choices[0].message.content || '{}') };
      },

      'full-audit': async () => {
        if (!openai) return { type: 'audit', result: { score: 65, strengths: ['Active profile'], weaknesses: ['Low playlist count'], quickWins: ['Optimize bio'] } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Full Spotify audit for: ${ctx.name}, Genre: ${ctx.genre}, Monthly Listeners: ${ctx.monthlyListeners}, Followers: ${ctx.followers}, Streams: ${ctx.totalStreams}, Tracks: ${ctx.recentTracks.length}, Top Cities: ${ctx.topCities.map((c: any) => c.city).join(', ')}. Format as JSON: {"score":0-100, "strengths":["..."], "weaknesses":["..."], "quickWins":["..."], "detailedAnalysis":"...", "projections":{"30days":0, "60days":0, "90days":0}}` },
            { role: 'user', content: 'Run full audit' }],
          max_tokens: 1000, response_format: { type: 'json_object' },
        });
        return { type: 'audit', result: JSON.parse(r.choices[0].message.content || '{}') };
      },

      'release-plan': async () => {
        if (!openai) return { type: 'release-plan', result: { phases: [{ name: 'Pre-release', tasks: ['Tease on socials', 'Submit to playlists'] }] } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Create a release strategy for ${ctx.name}'s next track. Genre: ${ctx.genre}. Current monthly listeners: ${ctx.monthlyListeners}. Track: ${params?.trackName || 'upcoming single'}. Format as JSON: {"title":"...", "phases":[{"name":"Pre-release|Release Week|Post-release", "timeline":"...", "tasks":["..."], "channels":["..."]}], "playlistStrategy":"...", "socialMediaPlan":"...", "budgetSuggestion":"..."}` },
            { role: 'user', content: 'Create release plan' }],
          max_tokens: 1000, response_format: { type: 'json_object' },
        });
        return { type: 'release-plan', result: JSON.parse(r.choices[0].message.content || '{}') };
      },

      'bio-optimizer': async () => {
        if (!openai) return { type: 'bio', result: { bios: [{ version: 'Short', text: `${ctx.name} — ${ctx.genre} artist.` }] } };
        const r = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'system', content: `Optimize Spotify artist bio for: ${ctx.name}, Genre: ${ctx.genre}, Monthly Listeners: ${ctx.monthlyListeners}. Current bio: "${ctx.bio}". Format as JSON: {"bios":[{"version":"Short|Medium|Full", "text":"...", "seoKeywords":["..."]}], "tips":["..."]}` },
            { role: 'user', content: 'Optimize bio' }],
          max_tokens: 800, response_format: { type: 'json_object' },
        });
        return { type: 'bio', result: JSON.parse(r.choices[0].message.content || '{}') };
      },
    };

    const handler = handlers[action];
    if (!handler) return res.status(400).json({ error: `Unknown action: ${action}` });

    const result = await handler();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Suggestions
router.get('/suggestions', authenticate, async (_req: Request, res: Response) => {
  res.json([
    { id: 'audit', label: 'Full Account Audit', icon: 'search', action: 'full-audit' },
    { id: 'playlists', label: 'Find Playlists', icon: 'list-music', action: 'find-playlists' },
    { id: 'pitch', label: 'Generate Pitch', icon: 'mail', action: 'generate-pitch' },
    { id: 'seo', label: 'Optimize SEO', icon: 'search', action: 'optimize-seo' },
    { id: 'growth', label: 'Growth Plan', icon: 'trending-up', action: 'growth-plan' },
    { id: 'release', label: 'Release Strategy', icon: 'rocket', action: 'release-plan' },
    { id: 'bio', label: 'Optimize Bio', icon: 'user', action: 'bio-optimizer' },
  ]);
});

// Library endpoints
router.get('/library', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });

    const items = await db.select().from(spotifyContentLibrary)
      .where(eq(spotifyContentLibrary.userId, numId))
      .orderBy(desc(spotifyContentLibrary.createdAt))
      .limit(50);
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/library/save', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });

    const { contentType, title, content, metadata, imageUrl } = req.body;
    const [item] = await db.insert(spotifyContentLibrary).values({
      userId: numId, contentType, title, content, metadata: metadata || {}, imageUrl,
    }).returning();
    res.json(item);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

function getOfflineResponse(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('playlist')) return 'To find the right playlists: 1) Search for playlists in your genre with 1K-50K followers, 2) Check if the curator actively updates, 3) Look for submission links in the playlist description, 4) Use tools like SubmitHub or PlaylistPush.';
  if (m.includes('pitch') || m.includes('curator')) return 'A great curator pitch includes: 1) Short intro, 2) Why your track fits their playlist, 3) Key metrics (monthly listeners, recent growth), 4) Links to the track and socials, 5) Professional but personable tone.';
  if (m.includes('stream') || m.includes('listener')) return 'To grow streams: 1) Release consistently (every 4-6 weeks), 2) Get on editorial and independent playlists, 3) Run pre-save campaigns, 4) Use Spotify Canvas, 5) Collaborate with similar artists.';
  if (m.includes('release') || m.includes('launch')) return 'Release strategy: 1) Submit to Spotify editorial 4 weeks before release, 2) Set up pre-save page, 3) Tease on socials 2 weeks out, 4) Pitch to independent curators 1 week before, 5) Day-of: post everywhere with streaming link.';
  if (m.includes('seo') || m.includes('algorithm')) return 'Spotify algorithm tips: 1) Optimize track titles with keywords, 2) Use all available metadata (mood, genre tags), 3) Maintain consistent release schedule, 4) Drive saves over streams (saves > streams for algorithm), 5) Encourage followers to enable notifications.';
  return 'I can help with: playlist matching, curator pitching, SEO optimization, growth plans, release strategies, and artist bio optimization. What would you like to work on?';
}

export default router;
