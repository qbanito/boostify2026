/**
 * Boostify TV Content Routes — /api/tv/content/*
 * ─────────────────────────────────────────────────────────────
 * Manages the high-level TV channel experience:
 *   GET  /api/tv/content              → All content across all categories
 *   GET  /api/tv/content/category/:cat → Filter by category
 *   POST /api/tv/content/generate     → AI auto-generate content (FAL + GPT-4o)
 *   POST /api/tv/content/generate-news-segment → Generate full news video segment
 *   GET  /api/tv/content/trending     → Trending / most-viewed content
 *   GET  /api/tv/content/schedule     → Live channel schedule (auto-playlist)
 *   POST /api/tv/content/save-generated → Save AI-generated content to Firestore
 */

import { Router, Request, Response } from 'express';
import { db as firebaseDb } from '../firebase';
import { db } from '../db';
import { users, discoverClips } from '../../db/schema';
import { isNotNull, eq, desc } from 'drizzle-orm';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { generateImageWithNanoBanana, generateVideoWithGrok, generateVideoFromImage } from '../services/fal-service';

const router = Router();

const PRIMARY_MODEL = process.env.PRIMARY_MODEL || 'gpt-4o';

// ─────────────────────────────────────────────────────────────
// TV Channel Categories
// ─────────────────────────────────────────────────────────────
const TV_CATEGORIES = [
  { id: 'all',           label: 'All',           icon: 'tv',       description: 'All Boostify TV content' },
  { id: 'featured',      label: 'Featured',      icon: 'star',     description: 'Editor\'s picks and spotlighted content' },
  { id: 'news',          label: 'Music News',    icon: 'newspaper', description: 'Latest music industry news and updates' },
  { id: 'entertainment', label: 'Entertainment', icon: 'film',     description: 'Shows, interviews and entertainment' },
  { id: 'podcast',       label: 'Podcast',       icon: 'mic',      description: 'Music podcasts and long-form audio' },
  { id: 'music',         label: 'Music Videos',  icon: 'music',    description: 'Official music videos and clips' },
  { id: 'live',          label: 'Live',          icon: 'radio',    description: 'Live performances and concerts' },
  { id: 'trending',      label: 'Trending',      icon: 'trending-up', description: 'Top trending videos right now' },
  { id: 'documentary',   label: 'Documentary',   icon: 'clapperboard', description: 'Artist documentaries and stories' },
  { id: 'tutorial',      label: 'Tutorials',     icon: 'graduation-cap', description: 'Music production tutorials' },
];

// ─────────────────────────────────────────────────────────────
// GET /api/tv/content/categories
// ─────────────────────────────────────────────────────────────
router.get('/categories', (_req: Request, res: Response) => {
  res.json({ success: true, categories: TV_CATEGORIES });
});

// ─────────────────────────────────────────────────────────────
// GET /api/tv/content — All content (Firestore + PG + AI clips)
// ─────────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const [firestoreSnap, artists, clips] = await Promise.allSettled([
      // Firestore videos
      firebaseDb.collection('videos').orderBy('createdAt', 'desc').limit(200).get(),
      // Artists with YouTube
      db.select({
        id: users.id,
        artistName: users.artistName,
        slug: users.slug,
        profileImageUrl: users.profileImageUrl,
        profileImage: users.profileImage,
        genres: users.genres,
        topYoutubeVideos: users.topYoutubeVideos
      }).from(users).where(isNotNull(users.artistName)),
      // AI-generated discover clips
      db.select({
        id: discoverClips.id,
        title: discoverClips.title,
        description: discoverClips.description,
        videoUrl: discoverClips.videoUrl,
        thumbnailUrl: discoverClips.thumbnailUrl,
        clipDuration: discoverClips.clipDuration,
        views: discoverClips.views,
        mood: discoverClips.mood,
        genres: discoverClips.genres,
        artistId: discoverClips.artistId,
        createdAt: discoverClips.createdAt
      }).from(discoverClips).where(eq(discoverClips.isActive, true)).orderBy(desc(discoverClips.createdAt)).limit(100)
    ]);

    const validCategories = new Set(['featured', 'live', 'videos', 'music', 'news', 'entertainment', 'podcast', 'trending', 'documentary', 'tutorial']);
    const allVideos: any[] = [];

    // Process Firestore videos
    if (firestoreSnap.status === 'fulfilled') {
      const artistMap = buildArtistMap(artists.status === 'fulfilled' ? artists.value : []);
      firestoreSnap.value.docs.forEach(doc => {
        const data = doc.data();
        const rawPath: string = data.filePath || data.url || data.videoUrl || '';
        if (!rawPath) return;
        const { isYouTube, videoId, thumbnailPath, finalPath } = processVideoUrl(rawPath, data);
        const category = validCategories.has(data.category) ? data.category : 'music';
        const artist = artistMap.get(String(data.userId || ''));
        allVideos.push({
          id: doc.id,
          title: data.title || 'Untitled',
          description: data.description || '',
          filePath: finalPath,
          thumbnailPath,
          duration: data.duration || '0:00',
          views: data.views || 0,
          category,
          isYouTube,
          videoId,
          artistId: data.userId || null,
          artistName: artist?.artistName || data.artistName || null,
          artistSlug: artist?.slug || null,
          artistImage: artist?.profileImageUrl || artist?.profileImage || null,
          genres: artist?.genres || data.genres || [],
          source: 'firestore',
          createdAt: data.createdAt?.toDate?.() || new Date()
        });
      });
    }

    // Process YouTube profile videos
    if (artists.status === 'fulfilled') {
      artists.value.forEach(artist => {
        if (!Array.isArray(artist.topYoutubeVideos)) return;
        artist.topYoutubeVideos.forEach((video: any, idx: number) => {
          const { isYouTube, videoId, thumbnailPath, finalPath } = processVideoUrl(video.url || '', video);
          if (!finalPath) return;
          allVideos.push({
            id: `yt-${artist.id}-${idx}`,
            title: video.title || `${artist.artistName} - Video`,
            description: `Official video from ${artist.artistName}`,
            filePath: finalPath,
            thumbnailPath,
            duration: '0:00',
            views: Math.floor(Math.random() * 50000) + 1000,
            category: 'music',
            isYouTube,
            videoId,
            artistId: artist.id,
            artistName: artist.artistName,
            artistSlug: artist.slug,
            artistImage: artist.profileImageUrl || artist.profileImage || null,
            genres: artist.genres || [],
            source: 'youtube-profile',
            createdAt: new Date()
          });
        });
      });
    }

    // Process AI clips
    if (clips.status === 'fulfilled') {
      const artistMap = buildArtistMap(artists.status === 'fulfilled' ? artists.value : []);
      clips.value.filter(c => c.videoUrl).forEach(clip => {
        const artist = artistMap.get(String(clip.artistId || ''));
        const secs = clip.clipDuration || 15;
        allVideos.push({
          id: `clip-${clip.id}`,
          title: clip.title || `AI Music Clip`,
          description: clip.description || '',
          filePath: clip.videoUrl,
          thumbnailPath: clip.thumbnailUrl || null,
          duration: `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`,
          views: clip.views || 0,
          category: 'music',
          isYouTube: false,
          videoId: null,
          artistId: clip.artistId,
          artistName: artist?.artistName || 'AI Artist',
          artistSlug: artist?.slug || null,
          artistImage: artist?.profileImageUrl || artist?.profileImage || null,
          genres: (clip.genres as string[]) || artist?.genres || [],
          source: 'ai-clip',
          isAIGenerated: true,
          createdAt: clip.createdAt || new Date()
        });
      });
    }

    // Also fetch AI-generated TV content from Firestore
    try {
      const aiContentSnap = await firebaseDb.collection('tv_content')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      aiContentSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.videoUrl && !data.thumbnailUrl) return;
        allVideos.push({
          id: `tv-${doc.id}`,
          title: data.title || 'AI Generated Content',
          description: data.description || '',
          filePath: data.videoUrl || data.thumbnailUrl,
          thumbnailPath: data.thumbnailUrl || null,
          duration: data.duration || '3:00',
          views: data.views || Math.floor(Math.random() * 5000),
          category: data.category || 'news',
          isYouTube: false,
          videoId: null,
          artistId: null,
          artistName: 'Boostify TV',
          artistSlug: null,
          artistImage: null,
          genres: [],
          source: 'ai-generated',
          isAIGenerated: true,
          contentType: data.contentType || 'segment',
          aiProvider: data.aiProvider || 'fal',
          createdAt: data.createdAt?.toDate?.() || new Date()
        });
      });
    } catch (_err) {
      // tv_content collection may not exist yet
    }

    // Sort by views
    allVideos.sort((a, b) => (b.views || 0) - (a.views || 0));

    // Deduplicate by filePath
    const seen = new Set<string>();
    const unique = allVideos.filter(v => {
      if (seen.has(v.filePath)) return false;
      seen.add(v.filePath);
      return true;
    });

    res.json({
      success: true,
      videos: unique,
      totalCount: unique.length,
      categories: TV_CATEGORIES,
      breakdown: TV_CATEGORIES.slice(1).map(cat => ({
        category: cat.id,
        label: cat.label,
        count: unique.filter(v => v.category === cat.id).length
      }))
    });
  } catch (error: any) {
    console.error('[TV-CONTENT] Error:', error);
    res.status(500).json({ success: false, videos: [], message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/tv/content/trending
// ─────────────────────────────────────────────────────────────
router.get('/trending', async (_req: Request, res: Response) => {
  try {
    const snap = await firebaseDb.collection('videos')
      .orderBy('views', 'desc')
      .limit(20)
      .get();
    const videos = snap.docs.map(doc => {
      const data = doc.data();
      const { isYouTube, videoId, thumbnailPath, finalPath } = processVideoUrl(data.filePath || data.url || '', data);
      return { id: doc.id, title: data.title || 'Untitled', filePath: finalPath, thumbnailPath, isYouTube, videoId, views: data.views || 0, category: data.category || 'trending' };
    }).filter(v => v.filePath);
    res.json({ success: true, videos });
  } catch (err: any) {
    res.status(500).json({ success: false, videos: [], message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/tv/content/generate
// AI generates a batch of content for any category
// ─────────────────────────────────────────────────────────────
router.post('/generate', async (req: Request, res: Response) => {
  const { category = 'news', topic, count = 3 } = req.body;

  if (!['news', 'entertainment', 'podcast', 'documentary', 'tutorial', 'trending'].includes(category)) {
    return res.status(400).json({ success: false, message: 'Invalid category for generation' });
  }

  try {
    const openai = createTrackedOpenAI();

    // Step 1: Generate content brief with GPT-4o
    const contentPrompt = buildContentGenerationPrompt(category, topic, Math.min(count, 5));
    const contentResp = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: contentPrompt }],
      max_tokens: 2000
    });

    const parsed = JSON.parse(contentResp.choices[0].message.content || '{}');
    const segments: any[] = parsed.segments || [];

    if (!segments.length) {
      return res.status(500).json({ success: false, message: 'No segments generated' });
    }

    // Step 2: Generate thumbnail images for each segment (parallel)
    const results = await Promise.allSettled(
      segments.map(async (seg: any) => {
        const imagePrompt = seg.imagePrompt || `${seg.title} — ${category} TV broadcast thumbnail, cinematic, professional news studio`;
        const imgResult = await generateImageWithNanoBanana(imagePrompt, { aspectRatio: '16:9' });
        return {
          ...seg,
          thumbnailUrl: imgResult.success ? imgResult.imageUrl : null,
          category,
          source: 'ai-generated',
          isAIGenerated: true,
          aiProvider: 'gpt4o+fal',
          contentType: 'segment',
          views: 0,
          createdAt: new Date()
        };
      })
    );

    const generated = results
      .filter(r => r.status === 'fulfilled')
      .map((r: any) => r.value);

    // Step 3: Save to Firestore tv_content collection
    const savedIds: string[] = [];
    for (const item of generated) {
      try {
        const docRef = await firebaseDb.collection('tv_content').add({
          ...item,
          createdAt: new Date()
        });
        savedIds.push(docRef.id);
        item.id = `tv-${docRef.id}`;
      } catch (_err) {
        // continue
      }
    }

    res.json({
      success: true,
      generated,
      count: generated.length,
      savedIds
    });
  } catch (error: any) {
    console.error('[TV-CONTENT] Generate error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/tv/content/generate-news-segment
// Generates a full news segment: text + thumbnail + optional intro video
// ─────────────────────────────────────────────────────────────
router.post('/generate-news-segment', async (req: Request, res: Response) => {
  const { headline, topic, includeVideo = false } = req.body;

  if (!headline && !topic) {
    return res.status(400).json({ success: false, message: 'headline or topic required' });
  }

  try {
    const openai = createTrackedOpenAI();

    // Generate full news segment
    const newsResp = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `You are a senior music news producer at Boostify TV. Write a professional, engaging news segment.

Topic/Headline: "${headline || topic}"

Return JSON with:
{
  "title": "compelling headline (under 80 chars)",
  "subtitle": "sub-headline or breaking news tag (under 50 chars)",
  "summary": "3-sentence summary for the anchor to read on air",
  "fullScript": "complete teleprompter script (300-500 words) with anchor intro, main story, expert context, industry impact, and outro",
  "imagePrompt": "detailed cinematic image prompt for the thumbnail (news studio, microphones, broadcast graphics, relevant music industry imagery)",
  "tags": ["music", "industry", "..."],
  "duration": "estimated duration like '3:45'",
  "breakingNews": true or false,
  "category": "news"
}`
      }],
      max_tokens: 1500
    });

    const segment = JSON.parse(newsResp.choices[0].message.content || '{}');

    // Generate thumbnail image
    const imgResult = await generateImageWithNanoBanana(
      segment.imagePrompt || `Music news broadcast: ${segment.title}, professional TV news studio, breaking news graphics, Boostify TV`,
      { aspectRatio: '16:9' }
    );

    segment.thumbnailUrl = imgResult.success ? imgResult.imageUrl : null;
    segment.category = 'news';
    segment.source = 'ai-generated';
    segment.isAIGenerated = true;
    segment.aiProvider = 'gpt4o+fal';
    segment.views = 0;

    // Optional: generate intro video from thumbnail
    let videoUrl: string | null = null;
    if (includeVideo && imgResult.success && imgResult.imageUrl) {
      try {
        const videoResult = await generateVideoFromImage(
          imgResult.imageUrl,
          `Professional music news broadcast: ${segment.title}. Camera slowly zooms in on news desk with broadcast graphics animating in. Professional TV studio lighting.`
        );
        if (videoResult.success && videoResult.videoUrl) {
          videoUrl = videoResult.videoUrl;
        }
      } catch (_err) {
        // video is optional, continue without it
      }
    }

    segment.videoUrl = videoUrl;
    segment.filePath = videoUrl || segment.thumbnailUrl;

    // Save to Firestore
    let docId: string | null = null;
    try {
      const docRef = await firebaseDb.collection('tv_content').add({
        ...segment,
        createdAt: new Date()
      });
      docId = docRef.id;
      segment.id = `tv-${docId}`;
    } catch (_err) {
      // continue
    }

    res.json({
      success: true,
      segment,
      docId,
      hasVideo: !!videoUrl
    });
  } catch (error: any) {
    console.error('[TV-CONTENT] News segment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/tv/content/schedule
// Returns an auto-generated 24h channel schedule playlist
// ─────────────────────────────────────────────────────────────
router.get('/schedule', async (_req: Request, res: Response) => {
  try {
    const openai = createTrackedOpenAI();

    const scheduleResp = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: `Generate a 24-hour Boostify TV channel schedule. This is a premium music TV channel like MTV2, Fuse or BET Music.

Return JSON with:
{
  "schedule": [
    {
      "time": "06:00",
      "title": "Show/Block title",
      "description": "What plays during this block",
      "category": "news|music|entertainment|podcast|live|featured",
      "duration": "60",
      "icon": "🎵",
      "isLive": false,
      "highlight": true for primetime slots
    }
  ],
  "currentBlock": "which block is live right now based on UTC time",
  "primetime": "20:00-23:00"
}`
      }],
      max_tokens: 1500
    });

    const schedule = JSON.parse(scheduleResp.choices[0].message.content || '{}');

    // Mark current time slot
    const now = new Date();
    const hourNow = now.getUTCHours();
    const minuteNow = now.getUTCMinutes();
    const currentMinutes = hourNow * 60 + minuteNow;

    if (Array.isArray(schedule.schedule)) {
      schedule.schedule = schedule.schedule.map((slot: any) => {
        const [h, m] = (slot.time || '00:00').split(':').map(Number);
        const slotMinutes = h * 60 + (m || 0);
        const slotEnd = slotMinutes + parseInt(slot.duration || '60');
        slot.isCurrent = currentMinutes >= slotMinutes && currentMinutes < slotEnd;
        return slot;
      });
    }

    res.json({ success: true, ...schedule, generatedAt: new Date() });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function buildArtistMap(artists: any[]) {
  const map = new Map<string, any>();
  artists.forEach(a => {
    map.set(String(a.id), a);
    if (a.slug) map.set(a.slug, a);
  });
  return map;
}

function processVideoUrl(rawUrl: string, data: any) {
  const isYouTube = rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be');
  let videoId: string | null = null;
  let thumbnailPath: string | null = data.thumbnailUrl || data.thumbnailPath || null;
  let finalPath = rawUrl;

  if (isYouTube) {
    if (rawUrl.includes('v=')) videoId = rawUrl.split('v=')[1]?.split('&')[0];
    else if (rawUrl.includes('youtu.be/')) videoId = rawUrl.split('youtu.be/')[1]?.split('?')[0];
    else if (rawUrl.includes('/shorts/')) videoId = rawUrl.split('/shorts/')[1]?.split('?')[0];
    else if (rawUrl.includes('/embed/')) videoId = rawUrl.split('/embed/')[1]?.split('?')[0];
    if (videoId) {
      finalPath = `https://www.youtube.com/embed/${videoId}`;
      if (!thumbnailPath) thumbnailPath = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    }
  }

  return { isYouTube, videoId, thumbnailPath, finalPath };
}

function buildContentGenerationPrompt(category: string, topic?: string, count = 3): string {
  const categoryGuides: Record<string, string> = {
    news: `Music industry news segments. Topics: new albums, record deals, chart milestones, label news, industry trends, streaming records, award shows, controversies.`,
    entertainment: `Music entertainment shows. Ideas: artist interviews, behind-the-scenes features, music video breakdowns, concert recaps, pop culture moments.`,
    podcast: `Music podcast episodes. Topics: deep dives into genres, producer interviews, songwriting process, career stories, music theory, business of music.`,
    documentary: `Short documentary segments. Ideas: origin stories, genre history, iconic album making-of, city music scenes, movement/era retrospectives.`,
    tutorial: `Music tutorials. Topics: production tips, mixing/mastering, songwriting, music theory, career advice, social media strategy for artists.`,
    trending: `Trending content in music. Topics: viral moments, breakout artists, trending sounds, social media challenges, streaming charts.`
  };

  const guide = categoryGuides[category] || 'general music content';
  const topicHint = topic ? `Focus on: "${topic}"` : 'Generate diverse, timely topics';

  return `You are a content director for Boostify TV — a premium AI-powered music television channel. Generate ${count} compelling ${category} content segments for the channel.

${topicHint}
Category guide: ${guide}

Return JSON:
{
  "segments": [
    {
      "title": "Compelling title (under 80 chars)",
      "description": "2-3 sentence description of the content",
      "summary": "Opening hook line for anchor/host",
      "imagePrompt": "Detailed cinematic prompt for thumbnail image generation — describe the visual scene in detail (setting, lighting, people if any, graphics, atmosphere)",
      "duration": "estimated duration like '4:30' or '12:00'",
      "tags": ["tag1", "tag2"],
      "isBreaking": false,
      "category": "${category}",
      "contentType": "segment"
    }
  ]
}

Make each segment feel like real, high-quality TV content. Vary topics, tone and angle.`;
}

export default router;
