/**
 * Social Media Content Generator Routes
 * Genera contenido viral para Facebook, Instagram y TikTok
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { socialMediaPosts, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateSocialMediaContent, generateSocialMediaFromMasterJson } from '../services/social-media-service';
import { artistBlueprints } from '../../db/schema';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { storage as firebaseStorage } from '../firebase';
import { InferenceClient } from '@huggingface/inference';
import sharp from 'sharp';
import { getBrandPromptContext } from '../services/artist-brand-profile';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const hfClient = process.env.HUGGINGFACE_TOKEN ? new InferenceClient(process.env.HUGGINGFACE_TOKEN) : null;

const router = Router();

// Validación de input
const generateContentSchema = z.object({
  artistName: z.string().min(1),
  biography: z.string().min(10),
  profileUrl: z.string().url(),
  postgresId: z.number().optional()
});

/**
 * POST /api/social-media/generate-content
 * Genera posts para Facebook, Instagram y TikTok y los guarda
 */
router.post('/generate-content', async (req: Request, res: Response) => {
  try {
    const validated = generateContentSchema.parse(req.body);

    // Normalize the incoming profile URL to the canonical public domain so the
    // link baked into captions/images is never localhost (dev) or a preview host.
    let normalizedProfileUrl = validated.profileUrl;
    try {
      const incoming = new URL(validated.profileUrl);
      normalizedProfileUrl = `${getPublicAppUrl()}${incoming.pathname}`;
    } catch { /* keep original if it can't be parsed */ }

    const result = await generateSocialMediaContent(
      validated.artistName,
      validated.biography,
      normalizedProfileUrl,
      validated.postgresId
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate content'
      });
    }

    // Guardar posts en la BD si existe userId
    if (validated.postgresId && result.posts) {
      try {
        for (const post of result.posts) {
          await db.insert(socialMediaPosts).values({
            userId: validated.postgresId,
            platform: post.platform,
            caption: post.caption,
            hashtags: post.hashtags,
            cta: post.cta,
            viralScore: post.viralScore || 0,
            isPublished: true
          });
        }
        console.log('✅ Posts saved to database');
      } catch (dbError) {
        console.error('⚠️ Error saving posts to database:', dbError);
        // No fallar el request si no se puede guardar
      }
    }

    return res.json({
      success: true,
      posts: result.posts || [],
      message: 'Social media content generated successfully'
    });

  } catch (error: any) {
    console.error('Error generating social media content:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/social-media/posts
 * Obtiene los posts del usuario autenticado
 */
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !user.id) {
      return res.json({ success: true, posts: [], count: 0 });
    }

    const posts = await db
      .select()
      .from(socialMediaPosts)
      .where(
        and(eq(socialMediaPosts.userId, user.id), eq(socialMediaPosts.isPublished, true))
      )
      .orderBy(desc(socialMediaPosts.createdAt));

    return res.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0
    });
  } catch (error: any) {
    console.error('Error fetching social media posts for user:', error);
    return res.json({ success: true, posts: [], count: 0 });
  }
});

/**
 * GET /api/social-media/posts/:userId
 * Obtiene los posts de redes sociales de un artista
 */
router.get('/posts/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const numUserId = parseInt(userId);

    if (isNaN(numUserId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }

    const posts = await db
      .select()
      .from(socialMediaPosts)
      .where(
        and(eq(socialMediaPosts.userId, numUserId), eq(socialMediaPosts.isPublished, true))
      )
      .orderBy(desc(socialMediaPosts.createdAt));

    return res.json({
      success: true,
      posts: posts || [],
      count: posts?.length || 0
    });
  } catch (error: any) {
    console.error('Error fetching social media posts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch posts'
    });
  }
});

/**
 * POST /api/social-media/generate-from-master/:userId
 * Genera posts usando el masterJson del artista para máxima personalización
 */
router.post('/generate-from-master/:userId', async (req: Request, res: Response) => {
  try {
    const numUserId = parseInt(req.params.userId);
    if (isNaN(numUserId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });

    // Fetch user + masterJson
    const [user] = await db.select({
      id: users.id,
      artistName: users.artistName,
      username: users.username,
      slug: users.slug,
      biography: users.biography,
      masterJson: users.masterJson,
    }).from(users).where(eq(users.id, numUserId)).limit(1);

    if (!user) return res.status(404).json({ success: false, error: 'Artist not found' });

    const artistName = user.artistName || user.username || 'Artist';
    // Always use the public production domain + artist slug so the link baked into
    // captions/images is shareable (never localhost or a numeric id).
    const profileUrl = `${getPublicAppUrl()}/artist/${user.slug || user.username || numUserId}`;

    // Delete old posts before regenerating
    await db.delete(socialMediaPosts).where(eq(socialMediaPosts.userId, numUserId));

    const result = await generateSocialMediaFromMasterJson(
      artistName,
      user.biography || '',
      profileUrl,
      user.masterJson as any,
      numUserId
    );

    if (!result.success || !result.posts) {
      return res.status(500).json({ success: false, error: result.error || 'Generation failed' });
    }

    // Save new posts
    const savedPosts: any[] = [];
    for (const post of result.posts) {
      const [saved] = await db.insert(socialMediaPosts).values({
        userId: numUserId,
        platform: post.platform,
        caption: post.caption,
        hashtags: post.hashtags,
        cta: post.cta,
        viralScore: post.viralScore || 0,
        isPublished: true,
      }).returning();
      savedPosts.push(saved);
    }

    // Generate a publishable image for each post (FAL → OpenAI DALL-E 3 fallback)
    // Rotates through real artist reference photos for identity consistency.
    try {
      const refs = await getArtistReferencePool(numUserId);
      const brandCtx = await getBrandPromptContext({
        artistId: numUserId,
        artistName: (user as any).artistName || (user as any).username || undefined,
        genre: (user as any).genre || (user as any).genres?.[0] || undefined,
        bio: (user as any).biography || undefined,
        artistImageUrl: refs[0],
        ensure: true,
      });
      const imaged = await Promise.all(savedPosts.map(async (post, i) => {
        const prompt = buildPostImagePrompt(user, post, brandCtx.promptBlock);
        const aspect = PLATFORM_ASPECT[post.platform] || '4:5';
        // Rotate the reference pool with a random offset so each post (and each
        // regeneration) leads with a DIFFERENT base photo.
        const rotated = refs.length > 0 ? shuffleArray(refs) : [];
        const refForThis = rotated.length > 0
          ? Array.from(new Set([rotated[i % rotated.length], rotated[0]])).slice(0, 2)
          : [];
        const overlay: PosterOverlay = {
          headline: derivePostHeadline(post.caption),
          eyebrow: (user as any).artistName || (user as any).username || '',
          cta: sanitizeOverlayCta((post as any).cta),
          variant: pickPosterVariant(),
        };
        const img = await generatePostImage(prompt, aspect, refForThis, numUserId, `post${post.id}`, overlay);
        if ('url' in img) {
          await db.update(socialMediaPosts)
            .set({ imageUrl: img.url, imageModel: img.model, updatedAt: new Date() })
            .where(eq(socialMediaPosts.id, post.id));
          return { ...post, imageUrl: img.url, imageModel: img.model };
        }
        return post;
      }));
      return res.json({ success: true, posts: imaged, count: imaged.length });
    } catch (imgErr: any) {
      console.warn('[Social Media] post image generation failed (posts saved without images):', imgErr?.message);
    }

    return res.json({ success: true, posts: savedPosts, count: savedPosts.length });
  } catch (error: any) {
    console.error('[Social Media] generate-from-master error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/social-media/generate-photos
// Genera 3 imágenes fotorrealistas del artista usando FAL AI
// Conectado al Superstar Blueprint / masterJson para contexto máximo
// ─────────────────────────────────────────────────────────────────────────────

const SCENE_DEFINITIONS: Record<string, { label: string; cameraStyle: string; setting: string; action: string }> = {
  studio_session: {
    label: 'Sesión de Grabación',
    cameraStyle: 'documentary candid photography, Sony A7 IV, 35mm f/1.4, natural studio light',
    setting: 'professional recording studio with vintage microphones, mixing board glowing, acoustic panels, warm amber Edison bulb lighting, glass booth visible in background',
    action: 'artist wearing headphones recording vocals with eyes closed, deeply focused, genuine emotion',
  },
  daily_life: {
    label: 'Vida Cotidiana',
    cameraStyle: 'street photography style, Leica M11, 50mm, natural daylight, candid reportage',
    setting: 'urban city environment, coffee shop, street corner or local neighborhood with authentic atmosphere',
    action: 'artist in relaxed casual outfit, natural unposed moment, walking or sitting contemplatively',
  },
  live_event: {
    label: 'Evento en Vivo',
    cameraStyle: 'concert photography, Canon EOS R3, 70-200mm f/2.8, dramatic stage lighting',
    setting: 'concert stage with crowd, powerful stage lighting beams, smoke effects, large LED screen backdrop showing visuals',
    action: 'artist performing with intense energy, microphone in hand, crowd visible below and behind, spotlight on artist',
  },
  photo_shoot: {
    label: 'Sesión de Fotos',
    cameraStyle: 'editorial fashion photography, medium format Hasselblad, studio strobe lighting, Vogue aesthetic',
    setting: 'professional photography studio, seamless white or colored backdrop, professional lighting setup with softboxes and reflectors',
    action: 'artist posing confidently in stylized outfit, direct eye contact with camera, powerful stance',
  },
  music_video_bts: {
    label: 'Making-of Videoclip',
    cameraStyle: 'behind-the-scenes documentary, Sony FX6, wide angle, on-set atmosphere',
    setting: 'film set with camera crew, director, lighting rigs, monitors, clapper board visible, creative chaos of production',
    action: 'artist between takes, natural interaction with crew, costume and makeup touched up, reviewing playback on monitor',
  },
};

const PHOTOREALISM_SUFFIX = 'photorealistic, ultra high resolution, 8K, cinematic color grading, skin texture visible, real person photography NOT illustration NOT digital art NOT painting, shot on professional camera, award-winning photo';

function buildArtistContext(artistData: any, blueprint: any): string {
  const parts: string[] = [];
  
  const name = artistData.artistName || artistData.firstName || 'the artist';
  const genre = artistData.genre || (artistData.genres as string[])?.[0] || 'music';
  const country = artistData.country || '';
  const era = blueprint?.currentEra || blueprint?.modules?.brand?.currentEra || '';
  const archetype = blueprint?.brandArchetype || blueprint?.modules?.brand?.archetype || '';
  const style = blueprint?.modules?.brand?.visualIdentity?.primaryStyle || '';
  const palette = blueprint?.modules?.brand?.visualIdentity?.colorPalette || '';

  parts.push(`${name}, ${genre} artist`);
  if (country) parts.push(`from ${country}`);
  if (era) parts.push(`${era} era`);
  if (archetype) parts.push(`${archetype} archetype`);
  if (style) parts.push(`${style} visual style`);
  if (palette) parts.push(`color palette: ${palette}`);

  return parts.join(', ');
}

const generatePhotosSchema = z.object({
  artistId: z.number().int().positive(),
  sceneType: z.enum(['studio_session', 'daily_life', 'live_event', 'photo_shoot', 'music_video_bts']),
});

/**
 * Collects reference photos of the artist from their Firestore image galleries.
 * These real photos are used as image-to-image references so generated posts
 * keep the artist's true face/style while staying visually varied.
 * Returns image URLs only (skips videos), de-duplicated, newest first.
 */
async function fetchGalleryReferenceImages(artistId: number, limit = 12): Promise<string[]> {
  try {
    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return [];

    // Galleries may have been saved with the userId as a string OR a number
    // (legacy data). Query both variants and merge, like the frontend does.
    const galleriesRef = firestoreDb.collection('image_galleries');
    const snapshots = await Promise.all([
      galleriesRef.where('userId', '==', String(artistId)).get(),
      galleriesRef.where('userId', '==', artistId).get(),
    ]);

    const seenDocs = new Set<string>();
    const urls: string[] = [];
    for (const snap of snapshots) {
      snap.forEach(doc => {
        if (seenDocs.has(doc.id)) return;
        seenDocs.add(doc.id);
        const data = doc.data() as any;
        const imgs = Array.isArray(data?.generatedImages) ? data.generatedImages : [];
        for (const img of imgs) {
          if (!img || img.isVideo) continue;
          const url = typeof img === 'string' ? img : img.url;
          if (typeof url === 'string' && /^https?:\/\//.test(url)) urls.push(url);
        }
        // Also include explicit reference images stored on the gallery
        const refs = Array.isArray(data?.referenceImageUrls) ? data.referenceImageUrls : [];
        for (const url of refs) {
          if (typeof url === 'string' && /^https?:\/\//.test(url)) urls.push(url);
        }
      });
    }

    // De-duplicate while preserving order, then cap to `limit`.
    return Array.from(new Set(urls)).slice(0, limit);
  } catch (e) {
    console.warn('[generate-photos] gallery reference fetch failed:', (e as Error)?.message);
    return [];
  }
}

router.post('/generate-photos', async (req: Request, res: Response) => {
  try {
    const validated = generatePhotosSchema.parse(req.body);
    const { artistId, sceneType } = validated;

    // FAL is the primary provider; OpenAI DALL-E 3 acts as fallback, so we
    // don't hard-fail when FAL isn't configured.
    if (!process.env.FAL_KEY && !process.env.FAL_AI_KEY && !process.env.FAL_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, error: 'No image provider configured (FAL or OpenAI)' });
    }

    // 1. Fetch artist profile
    const [artist] = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        firstName: users.firstName,
        biography: users.biography,
        genre: users.genre,
        genres: users.genres,
        country: users.country,
        profileImage: users.profileImage,
        profileImageUrl: users.profileImageUrl,
        masterJson: users.masterJson,
      })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);

    if (!artist) {
      return res.status(404).json({ success: false, error: 'Artist not found' });
    }

    // 2. Try to load Superstar Blueprint
    let blueprint: any = null;
    try {
      const [bp] = await db
        .select({ blueprint: artistBlueprints.blueprint, globalArtistScore: artistBlueprints.globalArtistScore, brandArchetype: artistBlueprints.brandArchetype, currentEra: artistBlueprints.currentEra })
        .from(artistBlueprints)
        .where(eq(artistBlueprints.artistId, artistId))
        .limit(1);
      if (bp) blueprint = { ...bp.blueprint as any, brandArchetype: bp.brandArchetype, currentEra: bp.currentEra, globalArtistScore: bp.globalArtistScore };
    } catch (_) { /* blueprint optional */ }

    // Also use masterJson as fallback
    if (!blueprint && artist.masterJson) {
      blueprint = artist.masterJson as any;
    }

    const scene = SCENE_DEFINITIONS[sceneType];
    const artistContext = buildArtistContext(artist, blueprint);

    // Build a pool of REAL artist reference photos: profile image first, then
    // gallery images. Each generated post uses one of these as an image-to-image
    // reference, so posts stay on-identity while looking varied and viral.
    const profileRef = artist.profileImage || artist.profileImageUrl || null;
    const galleryRefs = await fetchGalleryReferenceImages(artistId);
    const referenceImages = Array.from(
      new Set([profileRef, ...galleryRefs].filter((u): u is string => !!u))
    );
    const referenceImageUrl = referenceImages[0] ?? null;
    console.log(`[generate-photos] artist=${artistId} profileRef=${profileRef ? 'yes' : 'no'} galleryRefs=${galleryRefs.length} totalRefs=${referenceImages.length}`);

    // 3. Build 3 variant prompts for the same scene
    const VARIANTS = [
      { angle: 'close-up portrait shot, face centered, bokeh background', mood: 'intimate and powerful' },
      { angle: 'medium shot full upper body, environmental context visible', mood: 'authentic and storytelling' },
      { angle: 'wide establishing shot with full environment, subject in frame', mood: 'cinematic and epic' },
    ];

    const prompts = VARIANTS.map(v => {
      const base = `${artistContext}. ${scene.action}. ${scene.setting}. ${v.angle}. ${v.mood} mood. ${scene.cameraStyle}. ${PHOTOREALISM_SUFFIX}`;
      return base;
    });

    // 4. Generate in parallel — FAL edit (refs) → FAL t2i → OpenAI DALL-E 3 fallback
    const generateOne = async (prompt: string, index: number): Promise<{ url: string; model: string; index: number } | null> => {
      // Rotate through the pool so each of the 3 posts references a different
      // real artist photo (profile + gallery) for maximum variety.
      const refForThis = referenceImages.length > 0
        ? Array.from(new Set([referenceImages[index % referenceImages.length], referenceImageUrl].filter((u): u is string => !!u))).slice(0, 2)
        : [];
      const result = await generatePostImage(prompt, '4:5', refForThis, artistId, `photo${index}`);
      return 'url' in result ? { ...result, index } : null;
    };

    // Run all 3 in parallel
    const results = await Promise.all(prompts.map((p, i) => generateOne(p, i)));

    const images = results
      .filter((r): r is { url: string; model: string; index: number } => r !== null && !!r.url)
      .map(r => ({
        url: r.url,
        sceneType,
        sceneLabel: scene.label,
        angle: VARIANTS[r.index].angle,
        mood: VARIANTS[r.index].mood,
        prompt: prompts[r.index],
        model: r.model,
      }));

    if (images.length === 0) {
      return res.status(500).json({ success: false, error: 'All image generations failed (FAL + OpenAI fallback). Check API keys.' });
    }

    const artistName = artist.artistName || artist.firstName || 'Artist';

    return res.json({
      success: true,
      images,
      artistName,
      sceneLabel: scene.label,
      usedReference: referenceImages.length > 0,
      referenceCount: referenceImages.length,
      usedGalleryReferences: galleryRefs.length > 0,
      count: images.length,
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid parameters', details: error.errors });
    }
    console.error('[Social Media] generate-photos error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Post image generation — FAL primary, OpenAI (DALL-E 3) fallback
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_ASPECT: Record<string, '4:5' | '9:16' | '16:9'> = {
  instagram: '4:5',
  tiktok: '9:16',
  facebook: '16:9',
};

const OPENAI_SIZE_MAP: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
  '4:5': '1024x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
};

// gpt-image-1 supports a different size set than DALL-E 3
const GPT_IMAGE_SIZE_MAP: Record<string, '1024x1024' | '1536x1024' | '1024x1536'> = {
  '4:5': '1024x1536',
  '9:16': '1024x1536',
  '16:9': '1536x1024',
};

// Final canvas dimensions per aspect ratio (used for the poster composition).
const PLATFORM_PIXELS: Record<string, { w: number; h: number }> = {
  '4:5': { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
};

/** Fetches a remote image URL into a Buffer (or null on failure). */
async function fetchToBuffer(url: string): Promise<Buffer | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Edits the artist's real reference photo with FLUX.1-Kontext-dev (via the
 * HuggingFace router, fal-ai provider) — preserves the artist's face/identity
 * while restyling the scene. This is the key to images that actually look like
 * the artist when FAL/OpenAI credits are exhausted. Returns image bytes or null.
 */
async function hfKontextEdit(prompt: string, referenceImageUrl: string): Promise<Buffer | null> {
  if (!hfClient) return null;
  try {
    const refBuf = await fetchToBuffer(referenceImageUrl);
    if (!refBuf) return null;
    const blob = new Blob([refBuf], { type: 'image/jpeg' });
    const out = await hfClient.imageToImage({
      provider: 'fal-ai',
      model: 'black-forest-labs/FLUX.1-Kontext-dev',
      inputs: blob,
      parameters: {
        prompt: `Keep the EXACT same person — preserve their face, hairstyle, skin tone and identity with high fidelity. ${prompt}`,
      },
    });
    return Buffer.from(await (out as Blob).arrayBuffer());
  } catch (e) {
    console.warn('[social-media] HF Kontext edit failed:', (e as Error)?.message);
    return null;
  }
}

const NON_IMAGE_EXT_RE = /\.(mp4|mov|webm|m4v|avi|mkv|gif)(\?|$)/i;
/** True if a URL is an http(s) image we can safely use as an edit reference (no video). */
function isLikelyImageUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  return !NON_IMAGE_EXT_RE.test(url);
}

/**
 * Edits the artist's real photo with Google Gemini 2.5 Flash Image ("nano-banana")
 * — preserves the artist's face/identity while restyling the scene. Tries each
 * configured Google API key. Returns image bytes or null.
 */
async function geminiEditImage(prompt: string, referenceImageUrl: string): Promise<Buffer | null> {
  const keys = [process.env.GOOGLE_API_KEY2, process.env.GOOGLE_API_KEY3, process.env.GOOGLE_API_KEY]
    .filter((k): k is string => !!k);
  if (keys.length === 0) return null;
  const refBuf = await fetchToBuffer(referenceImageUrl);
  if (!refBuf) return null;
  const body = JSON.stringify({
    contents: [{
      parts: [
        { text: `Keep the EXACT same person — preserve their face, hairstyle, skin tone and identity with high fidelity. ${prompt}` },
        { inline_data: { mime_type: 'image/jpeg', data: refBuf.toString('base64') } },
      ],
    }],
  });
  for (const key of keys) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      });
      if (!resp.ok) continue;
      const j = await resp.json() as any;
      const parts = j?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) {
        const data = p?.inline_data?.data || p?.inlineData?.data;
        if (data) return Buffer.from(data, 'base64');
      }
    } catch { /* try next key */ }
  }
  return null;
}

/**
 * Edits the artist's real photo with Replicate FLUX.1-Kontext-dev (image-to-image)
 * — preserves identity while restyling. Returns image bytes or null.
 */
async function replicateKontextEdit(prompt: string, referenceImageUrl: string): Promise<Buffer | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  try {
    const resp = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Prefer': 'wait' },
      body: JSON.stringify({
        input: {
          prompt: `Keep the EXACT same person, face and identity. ${prompt}`,
          input_image: referenceImageUrl,
          output_format: 'jpg',
          aspect_ratio: 'match_input_image',
        },
      }),
    });
    if (!resp.ok) return null;
    const j = await resp.json() as any;
    const out = Array.isArray(j.output) ? j.output[0] : j.output;
    if (typeof out === 'string') return await fetchToBuffer(out);
    return null;
  } catch (e) {
    console.warn('[social-media] Replicate Kontext edit failed:', (e as Error)?.message);
    return null;
  }
}

/**
 * Generates with the Higgsfield Soul model (async queue), preserving the artist's
 * likeness via an image reference when provided. Gated on HIGGSFIELD_API_KEY +
 * HIGGSFIELD_API_SECRET. Returns image bytes or null.
 * Docs: https://docs.higgsfield.ai/docs/how-to/introduction
 */
async function higgsfieldEditImage(prompt: string, referenceImageUrl: string | null, aspectRatio: string): Promise<Buffer | null> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET || process.env.HIGGSFIELD_SECRET;
  if (!key || !secret) return null;
  const auth = `Key ${key}:${secret}`;
  try {
    const input: Record<string, any> = {
      prompt: referenceImageUrl
        ? `Keep the EXACT same person, face and identity from the reference image. ${prompt}`
        : prompt,
      aspect_ratio: aspectRatio,
      quality: '1080p',
    };
    if (referenceImageUrl) {
      input.image_reference = referenceImageUrl;
      input.input_images = [referenceImageUrl];
    }
    const submit = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!submit.ok) { console.warn('[social-media] Higgsfield submit:', submit.status); return null; }
    const sub = await submit.json() as any;
    let imageUrl: string | null = sub.images?.[0]?.url || null;
    const statusUrl: string | null = sub.status_url
      || (sub.request_id ? `https://platform.higgsfield.ai/requests/${sub.request_id}/status` : null);
    for (let i = 0; i < 30 && !imageUrl && statusUrl; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const st = await fetch(statusUrl, { headers: { 'Authorization': auth } });
      if (!st.ok) continue;
      const sj = await st.json() as any;
      if (sj.status === 'completed') { imageUrl = sj.images?.[0]?.url || null; break; }
      if (sj.status === 'failed' || sj.status === 'nsfw') break;
    }
    if (!imageUrl) return null;
    return await fetchToBuffer(imageUrl);
  } catch (e) {
    console.warn('[social-media] Higgsfield edit failed:', (e as Error)?.message);
    return null;
  }
}

/** Generates a text-to-image PNG with HuggingFace FLUX.1-schnell (free tier). */
async function hfSchnellText(prompt: string): Promise<Buffer | null> {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
  if (!HF_TOKEN) return null;
  for (const model of ['black-forest-labs/FLUX.1-schnell', 'black-forest-labs/FLUX.1-dev']) {
    try {
      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json', 'Accept': 'image/png' },
        body: JSON.stringify({ inputs: prompt.slice(0, 1800) }),
      });
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) continue;
      return Buffer.from(await resp.arrayBuffer());
    } catch { /* try next */ }
  }
  return null;
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\uFE0F\u200D]/gu;

/** Escapes text for safe inclusion inside SVG markup. */
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Canonical public app URL used for shareable links (never localhost). */
function getPublicAppUrl(): string {
  const raw = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.PRODUCTION_URL || 'https://boostifymusic.com';
  return raw.replace(/\/+$/, '');
}

/**
 * Strips every URL-like token from a string: full http(s) URLs, www.*, bare
 * domains, AND dev/local hosts that have no TLD — localhost, 127.0.0.1, raw
 * IPv4/IPv6 (incl. [::1]) and any host:port (e.g. localhost:5000, [::1]:5000).
 * This is what keeps "localhost" from ever being baked onto a poster.
 */
function stripUrlsAndHosts(input: string): string {
  return input
    .replace(/https?:\/\/\S+/gi, ' ')                         // full URLs (any host)
    .replace(/\bwww\.\S+/gi, ' ')                             // www.*
    .replace(/\[?::1\]?(?::\d+)?\b\S*/gi, ' ')                // IPv6 localhost [::1]:port
    .replace(/\blocalhost(?::\d+)?\b\S*/gi, ' ')              // localhost[:port]/path
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b\S*/gi, ' ')// raw IPv4[:port]/path
    .replace(/\b[\w-]+\.(?:com|net|org|io|app|co|me|tv|fm|xyz|link|bio|page|site|store|shop)\b\S*/gi, ' ') // bare domains
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Cleans a post CTA before baking it onto the poster image. Raw URLs look bad
 * on the image (and the link belongs in the caption/bio), so we strip any URL
 * and collapse "link in bio: <url>" down to a short call-to-action.
 */
function sanitizeOverlayCta(cta?: string | null): string | undefined {
  if (!cta) return undefined;
  let text = stripUrlsAndHosts(cta)
    .replace(/\b(?:link in bio|visit my profile|discover more|listen now)\s*[:→-]*\s*$/i, 'Link in bio 👆')
    .replace(/[:→\-\s]+$/g, '')
    .trim();
  if (!text) return 'Link in bio 👆';
  return text;
}

/** Derives a short, punchy, uppercase headline from a post caption. */
function derivePostHeadline(caption: string, fallback = 'ESCÚCHALO AHORA'): string {
  if (!caption) return fallback;
  let text = stripUrlsAndHosts(caption)
    .replace(/[#@]\w+/g, ' ')
    .replace(EMOJI_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Prefer the first sentence / line up to a natural break.
  const firstChunk = text.split(/[.!?\n]/).map(s => s.trim()).find(s => s.length >= 6) || text;
  let headline = firstChunk.trim();
  if (headline.length > 48) headline = headline.slice(0, 46).replace(/\s+\S*$/, '') + '…';
  return (headline || fallback).toUpperCase();
}

/** Word-wraps a string into at most maxLines lines of ~maxChars each. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines) {
    const used = lines.join(' ').length;
    if (used < text.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines.slice(0, maxLines);
}

interface PosterOverlay {
  headline: string;
  eyebrow?: string;   // small accent tag above the headline (e.g. artist name)
  cta?: string;       // small call-to-action at the bottom
  accentColor?: string;
  variant?: PosterVariant; // layout/position variation so each poster differs
}

/** A randomized poster layout so every generated/regenerated post looks different. */
interface PosterVariant {
  vAlign: 'top' | 'bottom' | 'center';
  hAlign: 'left' | 'center';
  crop: 'attention' | 'north' | 'south' | 'centre' | 'east' | 'west';
  accent: string;
}

// Vibrant accent palette rotated across posters.
const POSTER_ACCENTS = ['#ff2d6f', '#7c5cff', '#2dd4bf', '#f97316', '#facc15', '#22d3ee', '#ec4899', '#a3e635', '#fb7185', '#38bdf8'];

const POSTER_LAYOUTS: { vAlign: PosterVariant['vAlign']; hAlign: PosterVariant['hAlign']; crop: PosterVariant['crop'] }[] = [
  { vAlign: 'bottom', hAlign: 'left',   crop: 'attention' },
  { vAlign: 'bottom', hAlign: 'center', crop: 'attention' },
  { vAlign: 'top',    hAlign: 'left',   crop: 'south' },
  { vAlign: 'top',    hAlign: 'center', crop: 'south' },
  { vAlign: 'center', hAlign: 'left',   crop: 'east' },
  { vAlign: 'center', hAlign: 'center', crop: 'attention' },
  { vAlign: 'bottom', hAlign: 'left',   crop: 'north' },
  { vAlign: 'top',    hAlign: 'left',   crop: 'centre' },
];

/**
 * Picks a random poster layout + accent. Pass an `accentColor` to bias toward the
 * artist's brand color (50% of the time it is used, otherwise a rotating accent),
 * keeping variety while staying on-brand.
 */
function pickPosterVariant(accentColor?: string): PosterVariant {
  const layout = POSTER_LAYOUTS[Math.floor(Math.random() * POSTER_LAYOUTS.length)];
  const brandOk = accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor);
  const accent = brandOk && Math.random() < 0.5
    ? accentColor!
    : POSTER_ACCENTS[Math.floor(Math.random() * POSTER_ACCENTS.length)];
  return { ...layout, accent };
}

/** Returns a shuffled copy of an array (Fisher–Yates). */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Composes a modern, viral Instagram-style announcement poster:
 * resizes the base image to the platform canvas, adds a legibility gradient and
 * crisp announcement text (eyebrow + bold headline + CTA). Returns JPEG bytes.
 * Text is rendered with SVG/sharp so it is always sharp and readable (AI image
 * models render garbled text). The optional `variant` shifts text position, crop
 * focus and accent color so every poster looks different.
 */
async function composeAnnouncementOverlay(
  baseImage: Buffer,
  aspect: string,
  overlay: PosterOverlay,
): Promise<Buffer> {
  const { w, h } = PLATFORM_PIXELS[aspect] || PLATFORM_PIXELS['4:5'];
  const variant = overlay.variant || { vAlign: 'bottom', hAlign: 'left', crop: 'attention', accent: overlay.accentColor || '#ff2d6f' };
  const accent = /^#[0-9a-fA-F]{6}$/.test(variant.accent) ? variant.accent : '#ff2d6f';

  const base = await sharp(baseImage)
    .resize(w, h, { fit: 'cover', position: variant.crop })
    .toBuffer();

  const pad = Math.round(w * 0.07);
  const availWidth = w - pad * 2;
  const centered = variant.hAlign === 'center';
  const textX = centered ? Math.round(w / 2) : pad;
  const textAnchor = centered ? 'middle' : 'start';

  // Auto-fit the headline: pick a font size + wrapping so the longest line fits.
  const CHAR_W = 0.56; // avg glyph width ratio for a bold sans font
  let headlineFont = Math.round(w * (aspect === '16:9' ? 0.058 : 0.078));
  const headlineRaw = escapeXml(overlay.headline);
  let lines: string[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const maxChars = Math.max(8, Math.floor(availWidth / (headlineFont * CHAR_W)));
    lines = wrapText(headlineRaw, maxChars, 3);
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
    if (longest * headlineFont * CHAR_W <= availWidth || headlineFont <= w * 0.03) break;
    headlineFont = Math.round(headlineFont * 0.9);
  }
  const lineHeight = Math.round(headlineFont * 1.12);
  const eyebrow = overlay.eyebrow ? escapeXml(overlay.eyebrow.toUpperCase().slice(0, 28)) : '';
  const cta = overlay.cta ? escapeXml(overlay.cta.toUpperCase().slice(0, 34)) : '';

  const blockH = lines.length * lineHeight;
  const eyebrowFont = Math.round(headlineFont * 0.34);
  const ctaFont = Math.round(headlineFont * 0.36);
  const ctaH = cta ? Math.round(ctaFont * 2.6) : 0;
  const eyebrowGap = eyebrow ? Math.round(eyebrowFont * 1.6) : 0;
  const ctaGap = cta ? Math.round(h * 0.025) : 0;
  // Full text block: eyebrow + headline + cta.
  const totalH = eyebrowGap + blockH + ctaGap + ctaH;

  // Vertical anchor → top Y of the whole block.
  let blockTop: number;
  if (variant.vAlign === 'top') blockTop = Math.round(h * 0.08) + eyebrowGap;
  else if (variant.vAlign === 'center') blockTop = Math.round((h - totalH) / 2) + eyebrowGap;
  else blockTop = h - pad - ctaH - ctaGap - blockH; // bottom

  const headlineTop = blockTop;
  const eyebrowY = headlineTop - Math.round(eyebrowFont * 0.7);
  const ctaTop = headlineTop + blockH + ctaGap;

  const tspans = lines
    .map((ln, i) => `<text x="${textX}" y="${headlineTop + (i + 1) * lineHeight - Math.round(lineHeight * 0.22)}" text-anchor="${textAnchor}" font-family="'DejaVu Sans','Arial Black',Arial,Helvetica,sans-serif" font-size="${headlineFont}" font-weight="800" fill="#ffffff" letter-spacing="-0.5">${ln}</text>`)
    .join('');

  // Eyebrow: accent bar + label. Bar omitted when centered for a cleaner look.
  const eyebrowSvg = eyebrow
    ? (centered
        ? `<text x="${textX}" y="${eyebrowY}" text-anchor="middle" font-family="'DejaVu Sans',Arial,Helvetica,sans-serif" font-size="${eyebrowFont}" font-weight="700" fill="${accent}" letter-spacing="3">${eyebrow}</text>`
        : `<rect x="${pad}" y="${eyebrowY - eyebrowFont}" width="${Math.round(eyebrowFont * 0.5)}" height="${Math.round(eyebrowFont * 1.25)}" fill="${accent}"/>
           <text x="${pad + Math.round(eyebrowFont * 0.9)}" y="${eyebrowY}" font-family="'DejaVu Sans',Arial,Helvetica,sans-serif" font-size="${eyebrowFont}" font-weight="700" fill="${accent}" letter-spacing="3">${eyebrow}</text>`)
    : '';

  const ctaWidth = Math.min(w - pad * 2, cta.length * ctaFont * 0.66 + ctaFont * 1.6);
  const ctaX = centered ? Math.round(w / 2 - ctaWidth / 2) : pad;
  const ctaSvg = cta
    ? `<rect x="${ctaX}" y="${ctaTop}" width="${ctaWidth}" height="${ctaH}" rx="${Math.round(ctaH / 2)}" fill="${accent}"/>
       <text x="${ctaX + Math.round(ctaWidth / 2)}" y="${ctaTop + Math.round(ctaH * 0.66)}" text-anchor="middle" font-family="'DejaVu Sans',Arial,Helvetica,sans-serif" font-size="${ctaFont}" font-weight="700" fill="#ffffff" letter-spacing="1.5">${cta}</text>`
    : '';

  // Legibility gradient follows the vertical anchor.
  let gradientRect: string;
  if (variant.vAlign === 'top') {
    const gradBottom = Math.min(h, totalH + Math.round(h * 0.18));
    gradientRect = `<rect x="0" y="0" width="${w}" height="${gradBottom}" fill="url(#veilTop)"/>`;
  } else if (variant.vAlign === 'center') {
    gradientRect = `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#veilCenter)"/>`;
  } else {
    const gradTop = Math.max(0, h - totalH - Math.round(h * 0.18));
    gradientRect = `<rect x="0" y="${gradTop}" width="${w}" height="${h - gradTop}" fill="url(#veilBottom)"/>`;
  }

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="veilBottom" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="0.55" stop-color="#000000" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.92"/>
      </linearGradient>
      <linearGradient id="veilTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0.92"/>
        <stop offset="0.5" stop-color="#000000" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="veilCenter" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0.25"/>
        <stop offset="0.5" stop-color="#000000" stop-opacity="0.72"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.25"/>
      </linearGradient>
    </defs>
    ${gradientRect}
    ${eyebrowSvg}
    ${tspans}
    ${ctaSvg}
  </svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
}


/**
 * Persists an image (URL or base64) to Firebase Storage so it never expires.
 * DALL-E URLs expire in ~1 hour, so OpenAI fallback images MUST be persisted.
 * Returns the permanent public URL, or null on failure.
 */
async function persistPostImage(imageData: string, artistId: number, tag: string): Promise<string | null> {
  try {
    if (!firebaseStorage) return null;
    let buffer: Buffer;
    if (imageData.startsWith('http')) {
      const resp = await fetch(imageData);
      if (!resp.ok) return null;
      buffer = Buffer.from(await resp.arrayBuffer());
    } else {
      buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    }
    const bucket = firebaseStorage.bucket();
    const fileName = `social-posts/${artistId}/${Date.now()}_${tag}.jpg`;
    const file = bucket.file(fileName);
    await file.save(buffer, {
      metadata: { contentType: 'image/jpeg' },
      public: true,
    });
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (e) {
    console.warn('[social-media] persistPostImage failed:', (e as Error)?.message);
    return null;
  }
}

/** Saves raw image bytes to Firebase Storage and returns the permanent URL. */
async function persistPostImageBuffer(buffer: Buffer, artistId: number, tag: string): Promise<string | null> {
  try {
    if (!firebaseStorage) return null;
    const bucket = firebaseStorage.bucket();
    const fileName = `social-posts/${artistId}/${Date.now()}_${tag}.jpg`;
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (e) {
    console.warn('[social-media] persistPostImageBuffer failed:', (e as Error)?.message);
    return null;
  }
}

/**
 * Generates a publishable social media image for a post. Resolves a base image
 * (preferring the artist's real likeness) then optionally composes a viral
 * announcement-poster text overlay.
 *
 * Provider chain (first success wins):
 * 1. FAL nano-banana-2/edit       — image-to-image with the artist's real photos
 * 2. Google Gemini 2.5 Flash Image — image edit with the artist's real photo
 * 3. Higgsfield Soul              — image-to-image (when HIGGSFIELD_API_KEY set)
 * 4. Replicate FLUX.1-Kontext-dev — image-to-image with the artist's real photo
 * 5. HF FLUX.1-Kontext-dev        — image-to-image with the artist's real photo
 * 6. Artist's REAL photo as base  — guarantees likeness when all AI edit
 *    providers are out of credit (the poster IS the artist's real photo)
 * 7. FAL nano-banana-2            — text-to-image (only when no reference photo)
 * 8. HF FLUX.1-schnell            — text-to-image (free tier)
 * 9. OpenAI gpt-image-1 → dall-e-3
 */
async function generatePostImage(
  prompt: string,
  aspectRatio: '4:5' | '9:16' | '16:9',
  referenceImages: string[],
  artistId: number,
  tag: string,
  overlay?: PosterOverlay,
): Promise<{ url: string; model: string } | { error: string }> {
  const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY_BACKUP || '';
  const errors: string[] = [];
  let baseBuffer: Buffer | null = null;
  let usedModel = '';
  // Only real http(s) images can be used as edit references (skip .mp4 covers).
  const imageRefs = (referenceImages || []).filter(isLikelyImageUrl);

  // ══ EDIT PROVIDERS — preserve the artist's REAL likeness ═══════════════════
  // ── 1. FAL nano-banana-2/edit (best likeness, when in credit) ──────────────
  if (FAL_API_KEY && imageRefs.length > 0) {
    try {
      const resp = await fetch('https://fal.run/fal-ai/nano-banana-2/edit', {
        method: 'POST',
        headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Use the person from the reference image(s) — keep their exact face, identity and likeness. ${prompt}`,
          image_urls: imageRefs.slice(0, 2),
          aspect_ratio: aspectRatio,
          num_images: 1,
          output_format: 'jpeg',
        }),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const url = data.images?.[0]?.url || data.image?.url || null;
        if (url) { baseBuffer = await fetchToBuffer(url); usedModel = 'nano-banana-2/edit'; }
      } else {
        errors.push(`FAL edit: ${resp.status}`);
      }
    } catch (e) { errors.push(`FAL edit: ${(e as Error)?.message}`); }
  }

  // ── 2. Google Gemini 2.5 Flash Image edit (artist likeness) ────────────────
  if (!baseBuffer && imageRefs.length > 0) {
    baseBuffer = await geminiEditImage(prompt, imageRefs[0]);
    if (baseBuffer) usedModel = 'gemini-2.5-flash-image';
    else errors.push('Gemini edit: unavailable');
  }

  // ── 3. Higgsfield Soul image-to-image (artist likeness, if configured) ─────
  if (!baseBuffer && imageRefs.length > 0) {
    baseBuffer = await higgsfieldEditImage(prompt, imageRefs[0], aspectRatio);
    if (baseBuffer) usedModel = 'higgsfield-soul';
    else errors.push('Higgsfield: unavailable');
  }

  // ── 4. Replicate FLUX.1-Kontext-dev image-to-image (artist likeness) ───────
  if (!baseBuffer && imageRefs.length > 0) {
    baseBuffer = await replicateKontextEdit(prompt, imageRefs[0]);
    if (baseBuffer) usedModel = 'replicate:flux-kontext';
    else errors.push('Replicate: unavailable');
  }

  // ── 5. HF FLUX.1-Kontext-dev image-to-image (artist likeness, free-ish) ────
  if (!baseBuffer && imageRefs.length > 0) {
    baseBuffer = await hfKontextEdit(prompt, imageRefs[0]);
    if (baseBuffer) usedModel = 'hf:flux-kontext';
    else errors.push('HF Kontext: unavailable');
  }

  // ══ REAL-PHOTO FALLBACK ════════════════════════════════════════════════════
  // When every AI edit provider is out of credit, use the artist's actual photo
  // as the poster base. This GUARANTEES the poster looks like the artist (it IS
  // their real photo); the text overlay turns it into a professional promo
  // poster. Zero API cost — far better than a generic text-to-image that looks
  // nothing like the artist.
  if (!baseBuffer && imageRefs.length > 0) {
    for (const ref of imageRefs) {
      const buf = await fetchToBuffer(ref);
      if (buf) { baseBuffer = buf; usedModel = 'artist-photo'; break; }
    }
    if (!baseBuffer) errors.push('Artist photo fetch: failed');
  }

  // ══ TEXT-TO-IMAGE FALLBACKS — only when there is NO reference photo ═════════
  // ── 7. FAL nano-banana-2 text-to-image ─────────────────────────────────────
  if (!baseBuffer && FAL_API_KEY) {
    try {
      const resp = await fetch('https://fal.run/fal-ai/nano-banana-2', {
        method: 'POST',
        headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspect_ratio: aspectRatio, num_images: 1, output_format: 'jpeg' }),
      });
      if (resp.ok) {
        const data = await resp.json() as any;
        const url = data.images?.[0]?.url || data.image?.url || null;
        if (url) { baseBuffer = await fetchToBuffer(url); usedModel = 'nano-banana-2'; }
      } else {
        errors.push(`FAL t2i: ${resp.status}`);
      }
    } catch (e) { errors.push(`FAL t2i: ${(e as Error)?.message}`); }
  }

  // ── 8. HF FLUX.1-schnell text-to-image (free tier) ─────────────────────────
  if (!baseBuffer) {
    baseBuffer = await hfSchnellText(prompt);
    if (baseBuffer) usedModel = 'hf:flux-schnell';
    else errors.push('HF schnell: failed');
  }

  // ── 9. OpenAI image fallback (gpt-image-1 → dall-e-3) ──────────────────────
  if (!baseBuffer) {
    const openAiModels: { model: 'gpt-image-1' | 'dall-e-3'; size: string; quality: string }[] = [
      { model: 'gpt-image-1', size: GPT_IMAGE_SIZE_MAP[aspectRatio] ?? '1024x1024', quality: 'high' },
      { model: 'dall-e-3', size: OPENAI_SIZE_MAP[aspectRatio] ?? '1024x1024', quality: 'hd' },
    ];
    for (const cfg of openAiModels) {
      try {
        const response = await openai.images.generate({
          model: cfg.model, prompt: prompt.slice(0, 4000), size: cfg.size as any, quality: cfg.quality as any, n: 1,
        });
        const item = response.data?.[0];
        if (item?.b64_json) { baseBuffer = Buffer.from(item.b64_json, 'base64'); usedModel = cfg.model; break; }
        if (item?.url) { baseBuffer = await fetchToBuffer(item.url); usedModel = cfg.model; if (baseBuffer) break; }
      } catch (oaiErr: any) {
        errors.push(`OpenAI ${cfg.model}: ${oaiErr?.message || 'failed'}`);
      }
    }
  }

  if (!baseBuffer) {
    console.error('[social-media] All image providers failed:', errors.join(' | '));
    return { error: errors.join(' | ') || 'All image providers failed' };
  }

  // ── Compose the viral announcement poster (crisp text overlay) ─────────────
  let finalBuffer = baseBuffer;
  if (overlay && overlay.headline) {
    try {
      finalBuffer = await composeAnnouncementOverlay(baseBuffer, aspectRatio, overlay);
      usedModel += '+poster';
    } catch (e) {
      console.warn('[social-media] poster overlay failed, using base image:', (e as Error)?.message);
    }
  }

  const permanent = await persistPostImageBuffer(finalBuffer, artistId, tag);
  if (!permanent) return { error: 'Failed to persist generated image' };
  return { url: permanent, model: usedModel };
}

/** Builds a photorealistic, on-brand image prompt for a social post. */
function buildPostImagePrompt(
  artist: { artistName?: string | null; username?: string | null; genre?: string | null; genres?: string[] | null; country?: string | null },
  post: { platform: string; caption: string },
  brandBlock?: string,
): string {
  const name = artist.artistName || artist.username || 'the artist';
  const genre = artist.genre || artist.genres?.[0] || 'music';
  const platformVibe: Record<string, string> = {
    instagram: 'editorial Instagram promo-poster aesthetic, premium music-campaign photography, bold scroll-stopping composition, strong negative space at the bottom for a headline',
    tiktok: 'vertical TikTok-ready promo frame, energetic dynamic candid moment, bold vibrant colors, space at the bottom for a caption',
    facebook: 'cinematic wide social campaign banner, storytelling environment, warm engaging atmosphere',
  };
  const vibe = platformVibe[post.platform] || platformVibe.instagram;
  const captionEssence = stripUrlsAndHosts(post.caption).replace(/[\n\r]+/g, ' ').slice(0, 220);
  return `Eye-catching promotional social-media campaign image for ${name}, a ${genre} artist${artist.country ? ` from ${artist.country}` : ''}. The artist is the clear hero of the shot, confident and charismatic, dramatic cinematic lighting and rich on-brand color grading. Visual concept announcing: "${captionEssence}". ${vibe}.${brandBlock ? ` ${brandBlock}` : ''} Leave clean uncluttered space toward the lower third for an announcement headline. NO text, NO words, NO letters, NO logos in the image. ${PHOTOREALISM_SUFFIX}`;
}

/** Resolves the real reference photos pool for an artist (profile + galleries). */
async function getArtistReferencePool(artistId: number): Promise<string[]> {
  const [artist] = await db
    .select({ profileImage: users.profileImage, profileImageUrl: users.profileImageUrl })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);
  const profileRef = artist?.profileImage || artist?.profileImageUrl || null;
  const galleryRefs = await fetchGalleryReferenceImages(artistId);
  return Array.from(new Set([profileRef, ...galleryRefs].filter((u): u is string => !!u)));
}

/**
 * POST /api/social-media/posts/:postId/generate-image
 * Genera (o regenera) la imagen publicable de un post concreto.
 * FAL primario · OpenAI DALL-E 3 como fallback.
 */
router.post('/posts/:postId/generate-image', async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.postId);
    if (isNaN(postId)) return res.status(400).json({ success: false, error: 'Invalid post ID' });

    const [post] = await db.select().from(socialMediaPosts).where(eq(socialMediaPosts.id, postId)).limit(1);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found' });

    const [artist] = await db
      .select({ artistName: users.artistName, username: users.username, genre: users.genre, genres: users.genres, country: users.country })
      .from(users)
      .where(eq(users.id, post.userId))
      .limit(1);
    if (!artist) return res.status(404).json({ success: false, error: 'Artist not found' });

    const refs = await getArtistReferencePool(post.userId);
    const brandCtx = await getBrandPromptContext({
      artistId: post.userId,
      artistName: artist.artistName || artist.username || undefined,
      genre: artist.genre || artist.genres?.[0] || undefined,
      artistImageUrl: refs[0],
      ensure: true,
    });
    const prompt = buildPostImagePrompt(artist, post, brandCtx.promptBlock);
    const aspect = PLATFORM_ASPECT[post.platform] || '4:5';

    const artistLabel = artist.artistName || artist.username || '';
    // Shuffle refs so each regeneration leads with a different base photo, and
    // pick a fresh random layout/accent → every download looks different.
    const rotatedRefs = shuffleArray(refs);
    const overlay: PosterOverlay = {
      headline: derivePostHeadline(post.caption),
      eyebrow: artistLabel,
      cta: sanitizeOverlayCta((post as any).cta),
      variant: pickPosterVariant(),
    };

    const result = await generatePostImage(prompt, aspect, rotatedRefs, post.userId, `post${postId}`, overlay);
    if ('error' in result) return res.status(500).json({ success: false, error: result.error });

    await db.update(socialMediaPosts)
      .set({ imageUrl: result.url, imageModel: result.model, updatedAt: new Date() })
      .where(eq(socialMediaPosts.id, postId));

    return res.json({ success: true, imageUrl: result.url, model: result.model });
  } catch (error: any) {
    console.error('[Social Media] generate-image error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
