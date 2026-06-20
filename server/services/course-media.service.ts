/**
 * Course Media Service — multi-provider images, narration & lesson video.
 *
 * Image generation chain (first that succeeds wins):
 *  1. HuggingFace FLUX.1-schnell  → FREE, fast text-to-image (primary)
 *  2. OpenAI gpt-image-1          → high quality fallback (paid)
 *  3. FAL nano-banana-2           → last resort (only if FAL has balance)
 *
 * Narration: OpenAI gpt-4o-mini-tts (cheap) primary → FAL dia-tts fallback.
 * Lesson video: relevant embeddable YouTube tutorial (free, no token cost).
 *
 * All generated media is uploaded to Firebase Storage for permanent URLs.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { storage, db as firestore } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY_BACKUP || '';
const FAL_BASE_URL = 'https://fal.run';
const FAL_QUEUE_URL = 'https://queue.fal.run';
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// ─── Models ───────────────────────────────────────────────
const MODELS = {
  THUMBNAIL: 'fal-ai/nano-banana-2',     // FAL last-resort only (out of balance → HF/OpenAI used first)
  LESSON_IMAGE: 'fal-ai/nano-banana-2',
  TTS: 'fal-ai/dia-tts',                 // FAL TTS fallback (OpenAI TTS is primary)
} as const;

// ─── Course-specific visual prompts for coherent thumbnails ─
const COURSE_VISUAL_PROMPTS: Record<string, string> = {
  'boostify-essentials': 'A futuristic music production dashboard with glowing holographic interface, a producer wearing headphones touching floating music controls, audio waveforms and equalizer bars, glowing purple and cyan neon lights, digital workspace in a dark studio room',
  'ai-music-production': 'A professional music studio with a large mixing console, AI neural network visualization overlaid on audio waveforms, glowing sound frequencies, synthesizer keyboard, studio monitors, purple and blue ambient lighting, photorealistic',
  'ai-music-videos': 'A cinematic film camera pointing at a holographic screen showing a music video in production, video timeline interface floating in air, film reels, neon lights, motion capture dots on a dancer silhouette, dark studio with purple and orange glow',
  'music-marketing-mastery': 'A smartphone showing social media analytics and music streaming charts going up, surrounded by floating social media icons and music notes, digital marketing dashboard, bright orange and purple gradients, modern tech aesthetic',
  'music-business-essentials': 'A professional desk with a vinyl record, legal contract documents, golden music award trophy, stacks of royalty checks, a laptop showing revenue graphs, warm golden and dark tones, executive music office',
  'artist-brand-development': 'An artist silhouette standing in front of a massive glowing neon sign of their brand logo, mood board with photos and color palettes floating around, camera flashes, bold typography elements, vibrant pink and electric blue lighting',
  'digital-distribution': 'A globe surrounded by floating music streaming platform logos with glowing connection lines between them, digital music files flying through fiber optic cables, world map with distribution nodes, blue and green futuristic lighting',
  'mixing-mastering-ai': 'A detailed close-up of a professional analog mixing board with LED meters at peak, headphones resting on the console, audio spectrum analyzer display, AI chip glowing on the board, warm studio lighting with orange and amber tones',
  'visual-effects-motion': 'A dynamic scene of particle effects exploding around a dancing figure, motion blur trails, camera lens flare, holographic visual effect layers stacked in 3D space, neon green and magenta color grading, cinematic VFX composition',
};

function headers() {
  return {
    'Authorization': `Key ${FAL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ─── HELPERS ──────────────────────────────────────────────

async function downloadToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return {
      base64: Buffer.from(res.data).toString('base64'),
      mimeType: res.headers['content-type'] || 'image/png',
    };
  } catch (e: any) {
    logger.error('[CourseMedia] download error:', e.message);
    return null;
  }
}

async function uploadToFirebase(
  base64: string,
  mimeType: string,
  folder: string
): Promise<string> {
  try {
    if (!storage) {
      return `data:${mimeType};base64,${base64}`;
    }
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `${folder}/${Date.now()}_${uuidv4().slice(0, 8)}.${ext}`;
    const buf = Buffer.from(base64, 'base64');
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(buf, { metadata: { contentType: mimeType }, validation: false });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (e: any) {
    logger.error('[CourseMedia] Firebase upload error:', e.message);
    return `data:${mimeType};base64,${base64}`;
  }
}

async function uploadBufferToFirebase(buffer: Buffer, mimeType: string, folder: string): Promise<string> {
  return uploadToFirebase(buffer.toString('base64'), mimeType, folder);
}

// ─── MULTI-PROVIDER IMAGE GENERATION ─────────────────────
// Chain: HuggingFace FLUX.1-schnell (free) → OpenAI gpt-image-1 → FAL nano-banana-2.
// FAL is currently out of balance, so the free HF provider is the workhorse.

/** HuggingFace FLUX.1-schnell — free serverless text-to-image. Returns raw image bytes. */
async function hfFluxImage(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!HF_TOKEN) return null;
  for (const model of ['black-forest-labs/FLUX.1-schnell', 'black-forest-labs/FLUX.1-dev']) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png',
        },
        body: JSON.stringify({ inputs: prompt.slice(0, 1800) }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) continue;
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length < 1000) continue;
      return { buffer, mimeType: ct.split(';')[0] || 'image/png' };
    } catch {
      // try next model
    }
  }
  return null;
}

/** OpenAI gpt-image-1 — high-quality paid fallback. Returns raw image bytes. */
async function openaiImage(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await axios.post(
      'https://api.openai.com/v1/images/generations',
      { model: 'gpt-image-1', prompt: prompt.slice(0, 3800), n: 1, size: '1536x1024', quality: 'medium' },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    const b64 = res.data?.data?.[0]?.b64_json;
    if (!b64) return null;
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  } catch (e: any) {
    logger.error('[CourseMedia] OpenAI image error:', e?.response?.data?.error?.message || e.message);
    return null;
  }
}

/** FAL nano-banana-2 — last resort (only works when FAL has balance). */
async function falImage(prompt: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!FAL_API_KEY) return null;
  try {
    const res = await axios.post(
      `${FAL_BASE_URL}/${MODELS.THUMBNAIL}`,
      { prompt, image_size: 'landscape_16_9', num_images: 1, output_format: 'png' },
      { headers: headers(), timeout: 120000 }
    );
    const tempUrl = res.data?.images?.[0]?.url;
    if (!tempUrl) return null;
    const dl = await downloadToBase64(tempUrl);
    if (!dl) return null;
    return { buffer: Buffer.from(dl.base64, 'base64'), mimeType: dl.mimeType };
  } catch (e: any) {
    logger.error('[CourseMedia] FAL image error:', e?.response?.data?.detail || e.message);
    return null;
  }
}

/**
 * Generate an image with the resilient provider chain and upload it to Firebase.
 * @returns permanent image URL, or null if every provider failed.
 */
async function generateImageToFirebase(prompt: string, folder: string): Promise<string | null> {
  const providers: Array<{ name: string; fn: () => Promise<{ buffer: Buffer; mimeType: string } | null> }> = [
    { name: 'hf-flux-schnell', fn: () => hfFluxImage(prompt) },
    { name: 'openai-gpt-image-1', fn: () => openaiImage(prompt) },
    { name: 'fal-nano-banana-2', fn: () => falImage(prompt) },
  ];
  for (const p of providers) {
    const out = await p.fn();
    if (out) {
      logger.log(`[CourseMedia] ✅ image via ${p.name} (${out.buffer.length} bytes)`);
      return uploadBufferToFirebase(out.buffer, out.mimeType, folder);
    }
    logger.log(`[CourseMedia] ⚠️ image provider ${p.name} unavailable, trying next…`);
  }
  logger.error('[CourseMedia] ❌ all image providers failed');
  return null;
}

// ─── COURSE THUMBNAIL (multi-provider) ───────────────────

export async function generateCourseThumbnail(
  courseTitle: string,
  category: string,
  options?: { slug?: string; description?: string }
): Promise<string | null> {
  try {
    // Use course-specific visual prompt if available, otherwise build one from title + description
    const specificPrompt = options?.slug ? COURSE_VISUAL_PROMPTS[options.slug] : null;
    const prompt = specificPrompt
      ? `${specificPrompt}, ultra detailed, 4K resolution, photorealistic, cinematic composition, no text, no letters, no words`
      : `${buildPromptFromCourse(courseTitle, category, options?.description)}, ultra detailed, 4K resolution, photorealistic, cinematic composition, no text, no letters, no words`;

    logger.log(`[CourseMedia] 🎨 Generating thumbnail for: ${courseTitle}`);

    const permanentUrl = await generateImageToFirebase(prompt, 'course-thumbnails');
    if (!permanentUrl) throw new Error('All image providers failed');
    logger.log(`[CourseMedia] ✅ Thumbnail generated: ${permanentUrl}`);
    return permanentUrl;
  } catch (e: any) {
    logger.error('[CourseMedia] Thumbnail generation failed:', e.message);
    return null;
  }
}

/** Build a detailed visual prompt from course metadata when no specific prompt exists */
function buildPromptFromCourse(title: string, category: string, description?: string): string {
  const subject = description ? description.split('.')[0] : title;
  const categoryVisuals: Record<string, string> = {
    'Production': 'professional music studio with mixing console, synthesizers, studio monitors, audio waveforms',
    'Video Production': 'cinematic film set with camera equipment, video editing timeline, film reels, motion graphics',
    'Marketing': 'digital marketing dashboard with social media analytics, growth charts, smartphone with viral content',
    'Business': 'executive office with contracts, golden music award, revenue graphs, vinyl records',
    'Branding': 'creative mood board with brand colors, artist silhouette, photography equipment, design tools',
    'Distribution': 'global network map with streaming connections, digital music files, worldwide distribution nodes',
    'Audio Engineering': 'analog mixing board with LED meters, professional headphones, audio spectrum analyzer',
    'Visual Effects': 'dynamic particle effects, motion trails, holographic layers, cinematic color grading',
    'Boostify Platform': 'futuristic music interface dashboard with holographic controls, glowing audio waveforms',
  };
  const visual = categoryVisuals[category] || 'modern music technology workspace with neon accents';
  return `${visual}, representing "${subject}", dark moody background with vibrant neon purple and cyan lighting, cinematic atmosphere`;
}

// ─── LESSON IMAGE (Nano Banana 2 — fast) ─────────────────

export async function generateLessonImage(
  lessonTitle: string,
  courseTitle: string,
  lessonDescription?: string
): Promise<string | null> {
  try {
    const prompt = `Professional educational illustration for lesson "${lessonTitle}" in course "${courseTitle}". ${lessonDescription ? lessonDescription.slice(0, 100) : ''}. Modern, clean, visually appealing, educational infographic style, dark elegant background with vibrant accent colors, detailed, 4K, no text, no letters`;

    logger.log(`[CourseMedia] 🖼️ Generating lesson image: ${lessonTitle}`);

    const permanentUrl = await generateImageToFirebase(prompt, 'lesson-images');
    if (!permanentUrl) throw new Error('All image providers failed');
    logger.log(`[CourseMedia] ✅ Lesson image generated: ${permanentUrl}`);
    return permanentUrl;
  } catch (e: any) {
    logger.error('[CourseMedia] Lesson image failed:', e.message);
    return null;
  }
}

// ─── AUDIO NARRATION (Dia TTS — text to speech) ──────────

/** Strip markdown / formatting so the narration reads cleanly. */
function toSpokenText(markdown: string): string {
  return (markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')          // remove code blocks
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links → keep text
    .replace(/^#{1,6}\s+/gm, '')               // headings
    .replace(/[*_>#-]/g, ' ')                   // markdown symbols
    .replace(/\s+/g, ' ')                       // collapse whitespace
    .trim();
}

/**
 * Build a concise spoken narration script (~45-90s) from the lesson content.
 * Caps length so Dia TTS stays fast and reliable.
 */
function buildNarrationScript(
  lessonTitle: string,
  courseTitle: string,
  contentMarkdown?: string,
  keyPoints?: string[]
): string {
  const intro = `Welcome to ${lessonTitle}, part of ${courseTitle}.`;
  const body = toSpokenText(contentMarkdown || '').slice(0, 900);
  const points = (keyPoints && keyPoints.length)
    ? ` Key takeaways: ${keyPoints.slice(0, 4).map(p => toSpokenText(p)).join('. ')}.`
    : '';
  const outro = ' Take your time, practice each step, and move on when you feel ready.';
  // Hard cap to keep TTS snappy
  return `${intro} ${body}${points}${outro}`.slice(0, 1400);
}

/**
 * Generate a full lesson narration (not just a welcome intro).
 * Reads an actual spoken script derived from the lesson content.
 *
 * Provider chain: OpenAI gpt-4o-mini-tts (cheap, reliable) → FAL dia-tts.
 */
export async function generateLessonAudio(
  lessonTitle: string,
  courseTitle: string,
  contentMarkdown?: string,
  keyPoints?: string[]
): Promise<string | null> {
  const text = buildNarrationScript(lessonTitle, courseTitle, contentMarkdown, keyPoints);
  logger.log(`[CourseMedia] 🎙️ Generating lesson narration: ${lessonTitle} (${text.length} chars)`);

  // 1) OpenAI gpt-4o-mini-tts — economical & reliable
  const openaiAudio = await openaiTTS(text);
  if (openaiAudio) {
    const url = await uploadBufferToFirebase(openaiAudio, 'audio/mpeg', 'lesson-audio');
    logger.log(`[CourseMedia] ✅ Narration via OpenAI TTS: ${url}`);
    return url;
  }

  // 2) FAL dia-tts — fallback (only when FAL has balance)
  const falUrl = await falDiaTTS(text);
  if (falUrl) {
    logger.log(`[CourseMedia] ✅ Narration via FAL dia-tts: ${falUrl}`);
    return falUrl;
  }

  logger.error('[CourseMedia] Lesson narration failed: all TTS providers unavailable');
  return null;
}

/** OpenAI gpt-4o-mini-tts → MP3 buffer (cheap voice model). */
async function openaiTTS(text: string): Promise<Buffer | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'gpt-4o-mini-tts',
        voice: 'nova',
        input: text.slice(0, 3800),
        response_format: 'mp3',
        instructions: 'Read as a warm, clear and engaging online course instructor. Friendly, professional, well paced.',
      },
      { headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 120000 }
    );
    const buf = Buffer.from(res.data);
    return buf.length > 500 ? buf : null;
  } catch (e: any) {
    const msg = e?.response?.data ? Buffer.from(e.response.data).toString('utf8').slice(0, 200) : e.message;
    logger.error('[CourseMedia] OpenAI TTS error:', msg);
    return null;
  }
}

/** FAL dia-tts queue → permanent Firebase URL (fallback). */
async function falDiaTTS(text: string): Promise<string | null> {
  if (!FAL_API_KEY) return null;
  try {
    const res = await axios.post(
      `${FAL_QUEUE_URL}/${MODELS.TTS}`,
      { text },
      { headers: headers(), timeout: 120000 }
    );
    const statusUrl = res.data.status_url;
    const responseUrl = res.data.response_url;
    if (!res.data.request_id) return null;

    let result: any = null;
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status = await axios.get(statusUrl, { headers: headers() });
      if (status.data.status === 'COMPLETED') {
        result = (await axios.get(responseUrl, { headers: headers() })).data;
        break;
      }
      if (status.data.status === 'FAILED') return null;
    }
    if (!result) return null;

    const audioUrl = result.audio?.url || result.audio_url;
    if (!audioUrl) return null;
    const dl = await downloadToBase64(audioUrl);
    if (!dl) return audioUrl;
    return uploadToFirebase(dl.base64, dl.mimeType || 'audio/wav', 'lesson-audio');
  } catch (e: any) {
    logger.error('[CourseMedia] FAL dia-tts error:', e?.response?.data?.detail || e.message);
    return null;
  }
}

// ─── LESSON VIDEO (YouTube — free, no token cost) ────────

/**
 * Find a relevant, embeddable educational YouTube video for a lesson.
 * Free (YouTube Data API quota), zero token cost. Returns an embed URL.
 */
export async function generateLessonVideo(
  lessonTitle: string,
  courseTitle: string,
  category?: string
): Promise<{ videoUrl: string; embedUrl: string; title: string; channel: string } | null> {
  if (!YOUTUBE_API_KEY) return null;
  try {
    const query = `${lessonTitle} ${category || courseTitle} tutorial`.slice(0, 100);
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        videoEmbeddable: 'true',
        videoDuration: 'medium',
        safeSearch: 'strict',
        relevanceLanguage: 'en',
        maxResults: 1,
        key: YOUTUBE_API_KEY,
      },
      timeout: 20000,
    });
    const item = res.data?.items?.[0];
    const videoId = item?.id?.videoId;
    if (!videoId) return null;
    logger.log(`[CourseMedia] 🎬 Lesson video found: ${item.snippet?.title}`);
    return {
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      title: item.snippet?.title || lessonTitle,
      channel: item.snippet?.channelTitle || '',
    };
  } catch (e: any) {
    logger.error('[CourseMedia] Lesson video search failed:', e?.response?.data?.error?.message || e.message);
    return null;
  }
}

/** Backwards-compatible short welcome intro (delegates to narration with no body). */
export async function generateAudioIntro(
  lessonTitle: string,
  courseTitle: string
): Promise<string | null> {
  return generateLessonAudio(lessonTitle, courseTitle);
}

// ─── BATCH GENERATE THUMBNAILS FOR ACADEMY COURSES ───────

export async function generateAcademyThumbnails(
  coursesData: Array<{ slug: string; title: string; category: string; description?: string }>
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Process sequentially to avoid rate limits
  for (const c of coursesData) {
    const url = await getOrCreateAcademyThumbnail(c.slug, c.title, c.category, c.description);
    if (url) results[c.slug] = url;
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}

// ─── ACADEMY THUMBNAIL CACHE (Firestore — generate once, reuse for all clients) ──

const ACADEMY_THUMB_DOC = 'academyAssets/courseThumbnails';

/** Read all cached academy thumbnails (slug → permanent URL) from Firestore. */
export async function getCachedAcademyThumbnails(): Promise<Record<string, string>> {
  try {
    if (!firestore) return {};
    const snap = await firestore.doc(ACADEMY_THUMB_DOC).get();
    return snap.exists ? ((snap.data()?.thumbnails as Record<string, string>) || {}) : {};
  } catch (e: any) {
    logger.error('[CourseMedia] read thumbnail cache failed:', e.message);
    return {};
  }
}

/**
 * Return a cached academy thumbnail for a slug, generating + persisting it once
 * if it does not exist yet. This guarantees the image is created a single time
 * and then reused for every future visitor (stored in the database).
 */
export async function getOrCreateAcademyThumbnail(
  slug: string,
  title: string,
  category: string,
  description?: string
): Promise<string | null> {
  // 1) Serve from Firestore cache if present
  const cache = await getCachedAcademyThumbnails();
  if (cache[slug]) return cache[slug];

  // 2) Generate with the resilient provider chain
  const url = await generateCourseThumbnail(title, category, { slug, description });
  if (!url) return null;

  // 3) Persist so it is generated only once for all clients
  try {
    if (firestore) {
      await firestore.doc(ACADEMY_THUMB_DOC).set(
        { thumbnails: { [slug]: url }, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
  } catch (e: any) {
    logger.error('[CourseMedia] persist thumbnail cache failed:', e.message);
  }
  return url;
}
