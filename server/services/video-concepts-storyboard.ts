// ────────────────────────────────────────────────────────────────────
// Video-Concepts Storyboard Service
// ────────────────────────────────────────────────────────────────────
// Generates a fully interactive 10-scene storyboard for a paid project.
//
//   1. buildStoryboard()         → calls OpenAI (gpt-4o) to author a
//                                  structured JSON: title, logline,
//                                  palette, ten scenes with prompt,
//                                  narration, visualDirection, music cue.
//   2. generateSceneImage()      → renders ONE scene image trying a
//                                  cascade of providers. When the
//                                  client uploaded reference photos we
//                                  use them in EDIT mode (the user
//                                  asked specifically for openai/
//                                  gpt-image-2 in edit-mode); otherwise
//                                  we fall back to text-to-image.
//                                  OpenAI Images API is the final
//                                  fallback if every fal model fails.
//
// All long-running work happens in the background once the client
// triggers /generate; the route writes scene rows back into
// project.storyboardJson as each image lands so the UI can poll
// real-time.
// ────────────────────────────────────────────────────────────────────

import { fal } from '@fal-ai/client';
import OpenAI from 'openai';
import { createTrackedOpenAI } from '../utils/tracked-openai.js';
import type { videoConceptProjects, videoConceptAssets } from '../../db/schema.js';
import { PRIMARY_MODEL } from '../utils/ai-config';
import {
  generateVisualTheme,
  buildVisualThemeSuffix,
  formatVisualThemeForPrompt,
  type VisualTheme,
} from './video-concepts-visual-theme';

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
if (FAL_KEY) fal.config({ credentials: FAL_KEY });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export const STORYBOARD_VERSION = 'sb-1.0-2026-04';
export const STORYBOARD_SCENE_COUNT = 10;

// Shape persisted in project.storyboardJson.
export type StoryboardScene = {
  id: string;
  order: number;
  title: string;
  narration: string;            // bilingual rendering handled by client (we store ES + EN below)
  narrationEn?: string;
  visualDirection: string;
  cameraMove: string;
  duration: string;             // "00:08"
  musicCue: string;
  imagePrompt: string;          // english prompt for the image model
  imageUrl?: string | null;
  generatedAt?: string | null;
  generationStatus: 'pending' | 'generating' | 'ready' | 'error';
  generationProvider?: string | null;
  sourceAssetUrl?: string | null; // ref image used as edit base
  consistencyScore?: number | null; // 0-100 from ViMax-style VLM selection (Fase 3)
  error?: string | null;
};

export type StoryboardJson = {
  version: string;
  generatedAt: string;
  title: string;
  logline: string;
  tagline?: string;
  tone: string[];
  palette: string[];
  storyArc: string;             // "three-act", etc.
  visualTheme?: VisualTheme;    // Production Bible (Fase 2)
  scenes: StoryboardScene[];
};

export type ClientBriefDetails = {
  storyTone?: string;            // "romantic" | "epic" | "intimate" | etc.
  mustHaveMoments?: string[];    // free-text list
  peopleToFeature?: string;      // free-text
  colorPreferences?: string;
  musicVibe?: string;
  narrationStyle?: string;       // "voiceover" | "lyrical" | "silent" | "lyrics_in_song"
  inspirationKeywords?: string;
  language?: 'es' | 'en';
  notes?: string;
  uploadedAssetUrls?: string[];  // public URLs of references the client uploaded
  updatedAt?: string;
};

type Project = typeof videoConceptProjects.$inferSelect;
type Asset = typeof videoConceptAssets.$inferSelect;

// ───────────────────────── 1. Storyboard text via LLM ─────────────────────────

const SYSTEM_PROMPT = `You are the lead creative director of "Boostify Music", an ultra-premium cinematic
production house. The client paid the booking deposit and wants to see a stunning
10-scene storyboard for their personal event film. Your job: author a CINEMATIC,
EMOTIONAL, BILINGUAL storyboard JSON.

Return a SINGLE valid JSON object with this exact shape (no markdown fences):

{
  "title": string,                       // film title in the client's language
  "logline": string,                     // one-sentence pitch
  "tagline": string,                     // marketing line under the title
  "tone": string[],                      // 3-5 mood adjectives
  "palette": string[],                   // 4-6 color words (with hex if appropriate)
  "storyArc": "three-act" | "vignette" | "circular" | "anthology",
  "scenes": [                            // EXACTLY 10 SCENES, ordered 1-10
    {
      "title": string,                   // short scene title (in chosen language)
      "narration": string,               // full narration line in chosen language (1-2 sentences, evocative, written in present tense)
      "narrationEn": string,             // same line translated to English (always required)
      "visualDirection": string,         // direction for the cinematographer (lighting, framing, blocking)
      "cameraMove": string,              // dolly-in, handheld, drone, locked-off, push-in, etc.
      "duration": string,                // "00:08" mm:ss style, total should be ~2 min
      "musicCue": string,                // emotional cue ("strings swell", "808 drop", etc.)
      "imagePrompt": string              // ENGLISH prompt for an image model: cinematic, vertical 4:5,
                                         // include subjects, lighting, mood, color palette, lens.
                                         // Must NOT contain text/captions; do not name real celebrities.
    }
  ]
}

Rules:
- Use the EVENT details, the CLIENT BRIEF, the MASTER CONCEPT JSON, and the client's
  uploaded references to inform scene composition and recurring visual motifs.
- Each scene must be visually distinct (different lighting, location, time of day, or framing).
- Storyboard should arc: hook → world-building → connection → climax → resolution.
- Image prompts must be photorealistic, cinematic, premium. Mention vertical 4:5 frame.
- Never invent identifiable real people; describe subjects abstractly ("the bride", "the host", "the children").
- All narration must feel personal and warm, never generic.`;

function buildUserPrompt(args: {
  project: Project;
  brief: ClientBriefDetails;
  language: 'es' | 'en';
  assetUrls: string[];
}): string {
  const { project, brief, language, assetUrls } = args;
  return [
    `Language for narration & titles: ${language === 'es' ? 'Spanish (Mexican / neutral LATAM)' : 'English (US neutral)'}.`,
    '',
    'EVENT METADATA:',
    JSON.stringify({
      eventType: project.eventType,
      eventDate: project.eventDate,
      eventLocation: project.eventLocation,
      visualStyle: project.visualStyle,
      musicDirection: project.musicDirection,
      emotionalKeywords: project.emotionalKeywords,
      importantPeople: project.importantPeople,
      notes: project.notes,
      budgetRange: project.budgetRange,
      selectedPreset: project.selectedPreset,
    }, null, 2),
    '',
    'MASTER CONCEPT JSON (creative blueprint generated at deposit):',
    project.masterJson ? JSON.stringify(project.masterJson, null, 2).slice(0, 4000) : '(not generated yet)',
    '',
    'CLIENT BRIEF (filled after deposit):',
    JSON.stringify(brief, null, 2),
    '',
    `UPLOADED REFERENCE IMAGES (${assetUrls.length}):`,
    assetUrls.length ? assetUrls.map((u, i) => `  ${i + 1}. ${u}`).join('\n') : '  (none provided)',
    '',
    'Return ONLY the JSON object — no commentary, no markdown.',
  ].join('\n');
}

export async function buildStoryboardJson(args: {
  project: Project;
  brief: ClientBriefDetails;
  assetUrls: string[];
  language?: 'es' | 'en';
}): Promise<StoryboardJson> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const language: 'es' | 'en' = args.language || (args.brief.language === 'en' ? 'en' : 'es');
  const openai = createTrackedOpenAI({ apiKey: OPENAI_API_KEY });

  // ── FASE 2: Generate Visual Theme FIRST (Production Bible) ─────────────────
  // All scene imagePrompts will be constrained to this theme, ensuring
  // visual consistency across all 10 scenes.
  let visualTheme: VisualTheme | undefined;
  try {
    visualTheme = await generateVisualTheme({
      eventType: args.project.eventType || 'event',
      tone: Array.isArray(args.project.emotionalKeywords) ? args.project.emotionalKeywords : [],
      palette: args.project.visualStyle ? [args.project.visualStyle] : undefined,
      musicVibe: args.project.musicDirection || undefined,
      colorPreferences: args.brief.colorPreferences,
      visualStyle: args.project.visualStyle || undefined,
      brief: {
        storyTone: args.brief.storyTone,
        inspirationKeywords: args.brief.inspirationKeywords,
        narrationStyle: args.brief.narrationStyle,
        notes: args.brief.notes,
      },
      language,
    });
  } catch (err) {
    // Non-fatal: proceed without theme if generation fails
    console.warn('[Storyboard] Visual theme generation failed, proceeding without:', err);
  }

  // Inject visual theme into system prompt if available
  const themeSuffix = visualTheme ? `\n\n${formatVisualThemeForPrompt(visualTheme)}` : '';
  const systemWithTheme = SYSTEM_PROMPT + themeSuffix;

  const completion = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    temperature: 0.85,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemWithTheme },
      { role: 'user', content: buildUserPrompt({ project: args.project, brief: args.brief, language, assetUrls: args.assetUrls }) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const scenesRaw: any[] = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  if (scenesRaw.length < 6) {
    throw new Error(`Storyboard generation returned only ${scenesRaw.length} scenes (need ≥ 6)`);
  }

  const now = new Date().toISOString();
  const themeSuffixForPrompt = visualTheme ? ' ' + buildVisualThemeSuffix(visualTheme) : '';

  const scenes: StoryboardScene[] = scenesRaw.slice(0, STORYBOARD_SCENE_COUNT).map((s, i) => ({
    id: `scene-${i + 1}-${Date.now().toString(36)}`,
    order: i + 1,
    title: String(s.title || `Scene ${i + 1}`),
    narration: String(s.narration || ''),
    narrationEn: typeof s.narrationEn === 'string' ? s.narrationEn : undefined,
    visualDirection: String(s.visualDirection || ''),
    cameraMove: String(s.cameraMove || 'static'),
    duration: String(s.duration || '00:08'),
    musicCue: String(s.musicCue || ''),
    // Append visual theme suffix to every imagePrompt for consistency
    imagePrompt: String(s.imagePrompt || s.visualDirection || s.title || '') + themeSuffixForPrompt,
    generationStatus: 'pending',
  }));

  // Pad to STORYBOARD_SCENE_COUNT scenes if model returned fewer than 10.
  while (scenes.length < STORYBOARD_SCENE_COUNT) {
    const i = scenes.length;
    scenes.push({
      id: `scene-${i + 1}-${Date.now().toString(36)}`,
      order: i + 1,
      title: language === 'es' ? `Escena ${i + 1}` : `Scene ${i + 1}`,
      narration: '',
      visualDirection: '',
      cameraMove: 'static',
      duration: '00:08',
      musicCue: '',
      imagePrompt: '',
      generationStatus: 'pending',
    });
  }

  return {
    version: STORYBOARD_VERSION,
    generatedAt: now,
    title: String(parsed?.title || (language === 'es' ? 'Tu película' : 'Your film')),
    logline: String(parsed?.logline || ''),
    tagline: parsed?.tagline ? String(parsed.tagline) : undefined,
    tone: Array.isArray(parsed?.tone) ? parsed.tone.map(String) : [],
    palette: Array.isArray(parsed?.palette) ? parsed.palette.map(String) : [],
    storyArc: typeof parsed?.storyArc === 'string' ? parsed.storyArc : 'three-act',
    visualTheme,
    scenes,
  };
}

// ───────────────────────── 2. Image generation cascade ─────────────────────────

async function fetchAsBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Reference fetch failed (${res.status})`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

type SceneImageResult = { url: string; provider: string };

/**
 * Run a fal model (subscribe), pluck imageUrl from the standard shapes.
 */
async function tryFalModel(modelId: string, input: any): Promise<string> {
  const result = await fal.subscribe(modelId, { input, logs: false });
  const data: any = (result as any)?.data ?? result;
  const url =
    data?.images?.[0]?.url ||
    data?.image?.url ||
    (typeof data?.images?.[0] === 'string' ? data.images[0] : null);
  if (!url) throw new Error(`fal model ${modelId} returned no image url`);
  return url;
}

/**
 * Generate ONE scene image. Tries (in order):
 *   1. fal openai/gpt-image-1 EDIT byok (uses OPENAI_API_KEY) ← the user-requested model in edit mode
 *   2. fal nano-banana-2/edit (cheap, fast)
 *   3. fal bytedance/seedream/v4/edit
 *   4. OpenAI Images API edit (DALL-E)
 *   5. fal text-to-image fallbacks (gpt-image-1 byok, nano-banana-2, flux-pro)
 *   6. OpenAI Images API generate
 */
export async function generateSceneImage(args: {
  prompt: string;
  referenceUrls?: string[];   // client-uploaded images to use as edit base
}): Promise<SceneImageResult> {
  const prompt = args.prompt?.trim();
  if (!prompt) throw new Error('Empty image prompt');
  const refs = (args.referenceUrls || []).filter(Boolean);
  const primaryRef = refs[0];
  const errors: string[] = [];

  // ── EDIT-MODE attempts (only when we have at least one reference image)
  if (primaryRef) {
    // 1. fal openai/gpt-image-1 EDIT BYOK — what the user explicitly requested.
    if (OPENAI_API_KEY && FAL_KEY) {
      try {
        const url = await tryFalModel('fal-ai/gpt-image-1/edit-image/byok', {
          prompt: `${prompt} — vertical 4:5 cinematic frame, no text, no captions`,
          image_urls: refs.slice(0, 4),
          quality: 'high',
          openai_api_key: OPENAI_API_KEY,
        });
        return { url, provider: 'fal:gpt-image-1/edit/byok' };
      } catch (e: any) {
        errors.push(`gpt-image-1/edit/byok: ${e?.message || e}`);
      }
    }

    // 2. nano-banana-2/edit
    if (FAL_KEY) {
      try {
        const url = await tryFalModel('fal-ai/nano-banana-2/edit', {
          prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
          image_urls: refs.slice(0, 4),
          num_images: 1,
          aspect_ratio: '4:5',
          output_format: 'jpeg',
        });
        return { url, provider: 'fal:nano-banana-2/edit' };
      } catch (e: any) {
        errors.push(`nano-banana-2/edit: ${e?.message || e}`);
      }
    }

    // 3. seedream v4 edit
    if (FAL_KEY) {
      try {
        const url = await tryFalModel('fal-ai/bytedance/seedream/v4/edit', {
          prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
          image_urls: refs.slice(0, 4),
          image_size: 'portrait_4_3',
          num_images: 1,
        });
        return { url, provider: 'fal:seedream-v4/edit' };
      } catch (e: any) {
        errors.push(`seedream-v4/edit: ${e?.message || e}`);
      }
    }

    // 4. OpenAI Images edit (DALL-E)
    if (OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        const { buffer, contentType } = await fetchAsBuffer(primaryRef);
        const file = new File([new Uint8Array(buffer)], 'ref.png', { type: contentType });
        const resp: any = await openai.images.edit({
          model: 'gpt-image-1',
          image: file as any,
          prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
          size: '1024x1536',
          n: 1,
        });
        const b64 = resp?.data?.[0]?.b64_json;
        const direct = resp?.data?.[0]?.url;
        if (direct) return { url: direct, provider: 'openai:images.edit' };
        if (b64) return { url: `data:image/png;base64,${b64}`, provider: 'openai:images.edit' };
        throw new Error('OpenAI images.edit returned no data');
      } catch (e: any) {
        errors.push(`openai:images.edit: ${e?.message || e}`);
      }
    }
  }

  // ── TEXT-TO-IMAGE fallbacks (no client refs OR all edit attempts failed) ──
  if (FAL_KEY && OPENAI_API_KEY) {
    try {
      const url = await tryFalModel('fal-ai/gpt-image-1/text-to-image/byok', {
        prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
        image_size: 'portrait_4_3',
        num_images: 1,
        quality: 'high',
        openai_api_key: OPENAI_API_KEY,
      });
      return { url, provider: 'fal:gpt-image-1/t2i/byok' };
    } catch (e: any) {
      errors.push(`gpt-image-1/t2i/byok: ${e?.message || e}`);
    }
  }
  if (FAL_KEY) {
    try {
      const url = await tryFalModel('fal-ai/nano-banana-2', {
        prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
        num_images: 1,
        aspect_ratio: '4:5',
        output_format: 'jpeg',
      });
      return { url, provider: 'fal:nano-banana-2' };
    } catch (e: any) {
      errors.push(`nano-banana-2: ${e?.message || e}`);
    }
    try {
      const url = await tryFalModel('fal-ai/bytedance/seedream/v4/text-to-image', {
        prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
        image_size: 'portrait_4_3',
        num_images: 1,
      });
      return { url, provider: 'fal:seedream-v4/t2i' };
    } catch (e: any) {
      errors.push(`seedream-v4/t2i: ${e?.message || e}`);
    }
  }
  if (OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const resp: any = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: `${prompt} — vertical 4:5 cinematic frame, no text`,
        size: '1024x1536',
        n: 1,
      });
      const direct = resp?.data?.[0]?.url;
      const b64 = resp?.data?.[0]?.b64_json;
      if (direct) return { url: direct, provider: 'openai:images.generate' };
      if (b64) return { url: `data:image/png;base64,${b64}`, provider: 'openai:images.generate' };
      throw new Error('OpenAI images.generate returned no data');
    } catch (e: any) {
      errors.push(`openai:images.generate: ${e?.message || e}`);
    }
  }

  throw new Error(`All image providers failed: ${errors.join(' | ')}`);
}
