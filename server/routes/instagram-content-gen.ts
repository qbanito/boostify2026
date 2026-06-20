import { Router, Request, Response } from 'express';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import {
  users, songs, instagramExtensionConnections, instagramProfileSnapshots,
  instagramPendingActions, instagramContentLibrary,
} from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { getBlueprintBrief } from '../services/artist-blueprint-generator';
import { buildImageMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';

const router = Router();

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const openai = OPENAI_KEY ? createTrackedOpenAI({ apiKey: OPENAI_KEY }) : null;
const FAL_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY_BACKUP || '';

// ─── Helpers ────────────────────────────────────────────────

// Resolve Clerk string IDs (e.g. "user_2abc...") to numeric DB user IDs
async function resolveNumericUserId(rawId: any): Promise<number | null> {
  if (!rawId) return null;
  // Already numeric
  if (typeof rawId === 'number') return rawId;
  const str = String(rawId);
  // Looks like a Clerk ID (starts with "user_")
  if (str.startsWith('user_')) {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, str)).limit(1);
    return row?.id ?? null;
  }
  // Try parsing as integer
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;
  // Last resort: try as clerk ID
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, str)).limit(1);
  return row?.id ?? null;
}

async function getArtistProfile(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const recentSongs = await db.select({
    title: songs.title, genre: songs.genre, coverArt: songs.coverArt,
  }).from(songs).where(eq(songs.userId, userId)).orderBy(desc(songs.createdAt)).limit(5);

  const [conn] = await db.select()
    .from(instagramExtensionConnections)
    .where(and(eq(instagramExtensionConnections.userId, userId), eq(instagramExtensionConnections.status, 'active')))
    .limit(1);

  let igStats: any = null;
  if (conn) {
    const [snap] = await db.select()
      .from(instagramProfileSnapshots)
      .where(eq(instagramProfileSnapshots.connectionId, conn.id))
      .orderBy(desc(instagramProfileSnapshots.snapshotAt))
      .limit(1);
    igStats = snap;
  }

  return {
    name: user.artistName || user.firstName || user.username || 'Artist',
    genre: user.genre || user.genres?.[0] || 'music',
    genres: user.genres || [user.genre].filter(Boolean),
    bio: user.biography || '',
    profileImage: user.profileImageUrl || user.profileImage || '',
    coverImage: user.coverImage || '',
    instagram: user.instagramHandle || '',
    location: user.location || '',
    website: user.website || '',
    songs: recentSongs,
    igStats,
    connectionId: conn?.id || null,
  };
}

async function queueAction(userId: number, connectionId: number | null, actionType: string, payload: any) {
  try {
    const [action] = await db.insert(instagramPendingActions).values({
      userId,
      connectionId,
      actionType: actionType as any,
      payload,
      generatedBy: 'content-gen',
      priority: 2,
    } as any).returning();
    return action.id;
  } catch (err) {
    console.error('[Content-Gen] Queue error:', err);
    return null;
  }
}

// ─── POST /generate-post-image ──────────────────────────────
// Generates a real Instagram post image using OpenAI gpt-image-1
// Based on the artist's genre, style, latest songs, and brand

router.post('/generate-post-image', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const artist = await getArtistProfile(numId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { style, topic, mood, caption, size = '1024x1024' } = req.body;

    // Build a highly specific visual prompt based on the artist's actual brand
    const latestSong = artist.songs[0];
    const baseStyle = style || 'modern album art aesthetic';
    const baseMood = mood || (artist.genre?.includes('hip') ? 'bold urban' : artist.genre?.includes('pop') ? 'bright colorful' : 'moody atmospheric');

    const visualPrompt = `Create a professional Instagram post image for a ${artist.genre} music artist named "${artist.name}".

Style: ${baseStyle}
Mood: ${baseMood}
${topic ? `Theme: ${topic}` : latestSong ? `Promoting their latest track "${latestSong.title}"` : `General brand post for a ${artist.genre} artist`}
${artist.location ? `Location vibe: ${artist.location}` : ''}

The image should look like a professional Instagram post that a major-label ${artist.genre} artist would use. High-quality, visually striking, perfect for Instagram square format. No text or watermarks in the image itself. Make it feel authentic and on-brand for ${artist.genre} music.

${buildImageMasterpieceRules(
  { artistName: artist.name, genre: artist.genre, mood: baseMood, songTitle: latestSong?.title || null } as ArtistContext,
  'instagram-post'
)}`;

    console.log(`[Content-Gen] Generating post image for ${artist.name} (${artist.genre})`);

    if (!openai) return res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.' });

    let response;
    try {
      response = await openai!.images.generate({
        model: 'gpt-image-1',
      prompt: visualPrompt,
      n: 1,
      size: size as '1024x1024' | '1536x1024' | '1024x1536',
      quality: 'medium',
    });

    } catch (imgErr: any) {
      // Fallback to dall-e-3 if gpt-image-1 not available
      console.log('[Content-Gen] gpt-image-1 failed, trying dall-e-3:', imgErr.message);
      try {
        response = await openai!.images.generate({
          model: 'dall-e-3',
          prompt: visualPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        });
      } catch (fallbackErr: any) {
        console.error('[Content-Gen] Both image models failed:', fallbackErr.message);
        return res.status(503).json({ error: `Image generation failed: ${fallbackErr.message}. Check your OpenAI API key has access to image models.` });
      }
    }

    const imageData = response.data?.[0];
    if (!imageData) throw new Error('No image generated');

    // gpt-image-1 returns b64_json
    const b64 = (imageData as any).b64_json;
    const imageUrl = (imageData as any).url;

    // Generate a matching caption using text AI
    const captionPrompt = `Write 1 engaging Instagram caption for a ${artist.genre} music artist named "${artist.name}".
${topic ? `Post topic: ${topic}` : latestSong ? `Promoting "${latestSong.title}"` : 'General brand post'}
Style: authentic, ${baseMood}. Include 2-3 emojis maximum. Include a call-to-action. Add 8 relevant hashtags.
Return ONLY JSON: { "caption": "text here", "hashtags": ["#tag1"] }`;

    let generatedCaption = caption || '';
    let hashtags: string[] = [];
    if (!caption) {
      try {
        const captionResp = await openai!.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [{ role: 'user', content: captionPrompt }],
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });
        const parsed = JSON.parse(captionResp.choices[0]?.message?.content || '{}');
        generatedCaption = parsed.caption || '';
        hashtags = parsed.hashtags || [];
      } catch { /* caption generation is non-critical */ }
    }

    // Queue to extension if connected
    let actionId: number | null = null;
    if (artist.connectionId) {
      actionId = await queueAction(numId, artist.connectionId, 'post_caption', {
        caption: generatedCaption,
        hashtags,
        imageBase64: b64 ? `data:image/png;base64,${b64}` : undefined,
        imageUrl: imageUrl || undefined,
        source: 'ai-content-gen',
        type: 'post_image',
      });
    }

    res.json({
      success: true,
      image: b64 ? `data:image/png;base64,${b64}` : imageUrl,
      caption: generatedCaption,
      hashtags,
      artist: { name: artist.name, genre: artist.genre },
      queuedToExtension: !!actionId,
      actionId,
    });
  } catch (err: any) {
    console.error('[Content-Gen] Image generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate image' });
  }
});

// ─── POST /generate-carousel ────────────────────────────────
// Generates a carousel (3-5 images) with cohesive visual style

router.post('/generate-carousel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const artist = await getArtistProfile(numId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { topic, slideCount = 4, style } = req.body;

    if (!openai) return res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' });

    // First, generate the carousel content plan
    const planPrompt = `Plan a ${slideCount}-slide Instagram carousel for a ${artist.genre} music artist named "${artist.name}".
${topic ? `Topic: ${topic}` : `About their music career and latest releases`}

For each slide, provide:
1. A visual description (what image to create)
2. Text overlay (short, punchy — max 10 words)
3. The slide's purpose (hook, info, CTA, etc.)

Return ONLY JSON:
{
  "title": "Carousel title",
  "slides": [
    { "visual": "description for image generation", "text": "overlay text", "purpose": "hook" }
  ],
  "caption": "Instagram caption for the post",
  "hashtags": ["#tag1"]
}`;

    const planResp = await openai!.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: planPrompt }],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });
    const plan = JSON.parse(planResp.choices[0]?.message?.content || '{}');
    const slides = plan.slides || [];

    if (!slides.length) throw new Error('Failed to plan carousel');

    console.log(`[Content-Gen] Generating ${slides.length}-slide carousel for ${artist.name}`);

    // Generate images for each slide in parallel (max 4 concurrent)
    const imagePromises = slides.slice(0, 5).map(async (slide: any, idx: number) => {
      try {
        const masterpieceRules = buildImageMasterpieceRules(
          { artistName: artist.name, genre: artist.genre } as ArtistContext,
          'instagram-carousel'
        );
        const imgPrompt = `Instagram carousel slide ${idx + 1}/${slides.length}. ${artist.genre} music artist "${artist.name}" brand style. ${slide.visual}. Professional quality, cohesive style across carousel. No text in image.\n\n${masterpieceRules}`;
        let resp;
        try {
          resp = await openai!.images.generate({ model: 'gpt-image-1', prompt: imgPrompt, n: 1, size: '1024x1024', quality: 'medium' });
        } catch {
          resp = await openai!.images.generate({ model: 'dall-e-3', prompt: imgPrompt, n: 1, size: '1024x1024', quality: 'standard' });
        }
        const img = resp.data?.[0];
        const b64 = (img as any)?.b64_json;
        return {
          image: b64 ? `data:image/png;base64,${b64}` : (img as any)?.url || null,
          text: slide.text,
          purpose: slide.purpose,
        };
      } catch (err: any) {
        console.error(`[Content-Gen] Slide ${idx + 1} failed:`, err.message);
        return { image: null, text: slide.text, purpose: slide.purpose, error: err.message };
      }
    });

    const carouselSlides = await Promise.all(imagePromises);
    const successCount = carouselSlides.filter(s => s.image).length;

    // Queue to extension
    let actionId: number | null = null;
    if (artist.connectionId && successCount > 0) {
      actionId = await queueAction(numId, artist.connectionId, 'schedule_post', {
        type: 'carousel',
        slides: carouselSlides,
        caption: plan.caption || '',
        hashtags: plan.hashtags || [],
        source: 'ai-content-gen',
      });
    }

    res.json({
      success: true,
      title: plan.title,
      slides: carouselSlides,
      caption: plan.caption || '',
      hashtags: plan.hashtags || [],
      artist: { name: artist.name, genre: artist.genre },
      queuedToExtension: !!actionId,
      actionId,
    });
  } catch (err: any) {
    console.error('[Content-Gen] Carousel error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate carousel' });
  }
});

// ─── POST /generate-reel ────────────────────────────────────
// Generates a video reel using fal.ai based on artist brand

router.post('/generate-reel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const artist = await getArtistProfile(numId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    if (!FAL_KEY) {
      return res.status(503).json({ error: 'Video generation not configured. Set FAL_API_KEY.' });
    }

    const { concept, duration = 5, style } = req.body;

    if (!openai) return res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' });

    // Generate a video concept prompt
    const conceptPrompt = `Write a concise visual prompt (max 80 words) for a ${duration}-second Instagram Reel video for a ${artist.genre} music artist named "${artist.name}".
${concept ? `Concept: ${concept}` : 'Create an eye-catching promotional clip'}
Style: ${style || 'cinematic, music-industry quality'}
It should look like content a signed ${artist.genre} artist would post. Dynamic camera movement, professional lighting.
Return ONLY JSON: { "prompt": "visual description", "caption": "instagram caption", "hashtags": ["#tag1"] }`;

    const conceptResp = await openai!.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: conceptPrompt }],
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });
    const videoIdea = JSON.parse(conceptResp.choices[0]?.message?.content || '{}');

    console.log(`[Content-Gen] Generating reel for ${artist.name}: ${videoIdea.prompt?.substring(0, 60)}...`);

    // First generate a base image for i2v (image-to-video) — more stable than text-to-video
    const baseImageResp = await openai!.images.generate({
      model: 'gpt-image-1',
      prompt: `Cinematic first frame for a music video. ${videoIdea.prompt}. ${artist.genre} aesthetic. Professional quality, 16:9 widescreen.`,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
    });

    const baseImg = baseImageResp.data?.[0];
    const b64 = (baseImg as any)?.b64_json;
    if (!b64) throw new Error('Failed to generate base frame');

    const baseImageUrl = `data:image/png;base64,${b64}`;

    // Use fal.ai to animate the image into a video
    const falResponse = await fetch('https://queue.fal.run/fal-ai/kling-video/v2/standard/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: videoIdea.prompt,
        image_url: baseImageUrl,
        duration: String(Math.min(duration, 10)),
        aspect_ratio: '9:16', // Reel format
      }),
    });

    if (!falResponse.ok) {
      const falError = await falResponse.text();
      console.error('[Content-Gen] fal.ai queue error:', falError);
      // Return the base image as fallback
      return res.json({
        success: true,
        status: 'image_only',
        baseImage: baseImageUrl,
        videoStatus: 'failed',
        videoError: `Video generation failed: ${falResponse.status}`,
        caption: videoIdea.caption || '',
        hashtags: videoIdea.hashtags || [],
        artist: { name: artist.name, genre: artist.genre },
        message: 'Base image generated. Video generation is currently unavailable.',
      });
    }

    const falData: any = await falResponse.json();
    const requestId = falData.request_id;

    // Return immediately with the request ID for polling
    let actionId: number | null = null;
    if (artist.connectionId) {
      actionId = await queueAction(numId, artist.connectionId, 'post_reel', {
        type: 'reel',
        falRequestId: requestId,
        baseImage: baseImageUrl,
        caption: videoIdea.caption || '',
        hashtags: videoIdea.hashtags || [],
        source: 'ai-content-gen',
        status: 'generating',
      });
    }

    res.json({
      success: true,
      status: 'generating',
      requestId,
      baseImage: baseImageUrl,
      caption: videoIdea.caption || '',
      hashtags: videoIdea.hashtags || [],
      artist: { name: artist.name, genre: artist.genre },
      queuedToExtension: !!actionId,
      actionId,
      pollUrl: `/api/instagram/content-gen/reel-status/${requestId}`,
    });
  } catch (err: any) {
    console.error('[Content-Gen] Reel error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate reel' });
  }
});

// ─── GET /reel-status/:requestId ────────────────────────────
// Poll fal.ai for video generation status

router.get('/reel-status/:requestId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!FAL_KEY) return res.status(503).json({ error: 'Not configured' });

    const { requestId } = req.params;

    const statusResp = await fetch(
      `https://queue.fal.run/fal-ai/kling-video/v2/standard/image-to-video/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${FAL_KEY}` } }
    );

    if (!statusResp.ok) {
      return res.json({ status: 'failed', error: `Status check failed: ${statusResp.status}` });
    }

    const statusData: any = await statusResp.json();

    if (statusData.status === 'COMPLETED') {
      // Fetch the result
      const resultResp = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/v2/standard/image-to-video/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_KEY}` } }
      );
      const resultData: any = await resultResp.json();
      return res.json({
        status: 'completed',
        videoUrl: resultData.video?.url || resultData.output?.url || null,
      });
    }

    res.json({
      status: statusData.status === 'IN_PROGRESS' ? 'generating' : statusData.status?.toLowerCase() || 'pending',
      progress: statusData.progress || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /generate-story ───────────────────────────────────
// Generates Instagram Story images (9:16 format)

router.post('/generate-story', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const artist = await getArtistProfile(numId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { type = 'promotion', topic } = req.body;
    const latestSong = artist.songs[0];

    if (!openai) return res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' });

    const storyTypes: Record<string, string> = {
      promotion: `Promotional story announcing ${latestSong ? `"${latestSong.title}"` : 'new music'}. Bold typography-inspired visual, vibrant colors, music-themed.`,
      behind_scenes: `Behind-the-scenes studio moment. Raw, authentic feel. Equipment, creative process, artistic vibe.`,
      announcement: `Big announcement visual. Dramatic, attention-grabbing. ${topic || 'New release coming soon'}.`,
      engagement: `Interactive story design. Question or poll visual. Engaging, fun, on-brand for ${artist.genre}.`,
      aesthetic: `Aesthetic mood board style. ${artist.genre} vibes. Curated visual identity. Artistic and inspiring.`,
    };

    const visualDesc = storyTypes[type] || storyTypes.promotion;

    const response = await openai!.images.generate({
      model: 'gpt-image-1',
      prompt: `Instagram Story (9:16 vertical) for ${artist.genre} artist "${artist.name}". ${visualDesc} Professional quality, no text or watermarks. Vertical format optimized for Stories.`,
      n: 1,
      size: '1024x1536',
      quality: 'medium',
    });

    const img = response.data?.[0];
    const b64 = (img as any)?.b64_json;

    let actionId: number | null = null;
    if (artist.connectionId) {
      actionId = await queueAction(numId, artist.connectionId, 'post_story', {
        type: 'story',
        storyType: type,
        imageBase64: b64 ? `data:image/png;base64,${b64}` : undefined,
        imageUrl: (img as any)?.url || undefined,
        source: 'ai-content-gen',
      });
    }

    res.json({
      success: true,
      image: b64 ? `data:image/png;base64,${b64}` : (img as any)?.url,
      storyType: type,
      artist: { name: artist.name, genre: artist.genre },
      queuedToExtension: !!actionId,
      actionId,
    });
  } catch (err: any) {
    console.error('[Content-Gen] Story error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate story' });
  }
});

// ─── POST /generate-content-pack ────────────────────────────
// Generates a full week of content: 5 posts + 3 stories + 2 reels
// All visually cohesive and based on the artist's brand

router.post('/generate-content-pack', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });

    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const artist = await getArtistProfile(numId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const { weekTheme } = req.body;

    if (!openai) return res.status(503).json({ error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' });

    // Plan the entire week
    const blueprintContentBrief = await getBlueprintBrief(numId, 'content_brief');
    const blueprintLine = blueprintContentBrief ? `\nBlueprint strategy: ${blueprintContentBrief}` : '';
    const planPrompt = `Plan a week of Instagram content for ${artist.genre} artist "${artist.name}".
${artist.songs.length ? `Latest songs: ${artist.songs.map(s => s.title).join(', ')}` : ''}
${weekTheme ? `Week theme: ${weekTheme}` : ''}${blueprintLine}

Create exactly 5 post ideas + 3 story ideas. For each, provide a visual description for AI image generation and a caption.
Return ONLY JSON:
{
  "weekTheme": "theme name",
  "posts": [
    { "day": "Monday", "visual": "image description", "caption": "caption text", "hashtags": ["#tag"], "type": "post" }
  ],
  "stories": [
    { "day": "Monday", "visual": "story image description", "storyType": "promotion", "text": "story text" }
  ]
}`;

    const planResp = await openai!.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: planPrompt }],
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });
    const plan = JSON.parse(planResp.choices[0]?.message?.content || '{}');

    // Generate images for first 3 posts (to keep response time reasonable)
    const postsToGenerate = (plan.posts || []).slice(0, 3);
    const imageResults = await Promise.all(
      postsToGenerate.map(async (post: any) => {
        try {
          const resp = await openai!.images.generate({
            model: 'gpt-image-1',
            prompt: `Instagram post for ${artist.genre} artist "${artist.name}". ${post.visual}. Professional quality, square format. No text.`,
            n: 1,
            size: '1024x1024',
            quality: 'medium',
          });
          const img = resp.data?.[0];
          const b64 = (img as any)?.b64_json;
          return {
            ...post,
            image: b64 ? `data:image/png;base64,${b64}` : (img as any)?.url || null,
            generated: true,
          };
        } catch {
          return { ...post, image: null, generated: false };
        }
      })
    );

    // Queue all generated content
    let queuedCount = 0;
    if (artist.connectionId) {
      for (const post of imageResults.filter(p => p.image)) {
        const id = await queueAction(numId, artist.connectionId, 'post_caption', {
          caption: post.caption,
          hashtags: post.hashtags,
          imageBase64: post.image,
          day: post.day,
          source: 'content-pack',
          type: 'scheduled_post',
        });
        if (id) queuedCount++;
      }
    }

    res.json({
      success: true,
      weekTheme: plan.weekTheme || weekTheme || 'Brand Growth',
      posts: imageResults,
      remainingPosts: (plan.posts || []).slice(3),
      stories: plan.stories || [],
      artist: { name: artist.name, genre: artist.genre },
      queuedToExtension: queuedCount,
      totalContent: (plan.posts?.length || 0) + (plan.stories?.length || 0),
    });
  } catch (err: any) {
    console.error('[Content-Gen] Content pack error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate content pack' });
  }
});

// ─── POST /save-to-library ──────────────────────────────────
// Save generated content to the content library for reuse

router.post('/save-to-library', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const { contentType, title, caption, hashtags, imageUrls, videoUrl, slides, style, mood, topic, artistName, artistGenre, metadata } = req.body;

    if (!contentType) return res.status(400).json({ error: 'contentType required' });

    const [saved] = await db.insert(instagramContentLibrary).values({
      userId: numId,
      contentType,
      title: title || `${contentType} - ${new Date().toLocaleDateString()}`,
      caption: caption || '',
      hashtags: hashtags || [],
      imageUrls: imageUrls || [],
      videoUrl: videoUrl || null,
      slides: slides || null,
      artistName: artistName || '',
      artistGenre: artistGenre || '',
      style: style || '',
      mood: mood || '',
      topic: topic || '',
      status: 'ready',
      generatedBy: 'ai',
      metadata: metadata || {},
    } as any).returning();

    res.json({ success: true, id: saved.id });
  } catch (err: any) {
    console.error('[Content-Gen] Save error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /library ───────────────────────────────────────────
// Get all saved content for the user

router.get('/library', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });

    const items = await db.select()
      .from(instagramContentLibrary)
      .where(eq(instagramContentLibrary.userId, numId))
      .orderBy(desc(instagramContentLibrary.createdAt))
      .limit(50);

    res.json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /library/:id ────────────────────────────────────

router.delete('/library/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Auth required' });
    const numId = await resolveNumericUserId(userId);
    if (!numId) return res.status(404).json({ error: 'User not found' });
    const itemId = parseInt(req.params.id, 10);

    await db.delete(instagramContentLibrary)
      .where(and(eq(instagramContentLibrary.id, itemId), eq(instagramContentLibrary.userId, numId)));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /artist-context/:userId ────────────────────────────
// Returns full artist context for the Create tab to display

router.get('/artist-context/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const numId = await resolveNumericUserId(req.params.userId);
    if (!numId) return res.status(400).json({ error: 'Invalid userId' });

    const artist = await getArtistProfile(numId);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    res.json({
      success: true,
      artist: {
        name: artist.name,
        genre: artist.genre,
        genres: artist.genres,
        bio: artist.bio,
        profileImage: artist.profileImage,
        instagram: artist.instagram,
        location: artist.location,
        website: artist.website,
        songs: artist.songs,
        igStats: artist.igStats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

