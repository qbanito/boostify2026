/**
 * Artist Command Engine — Module Orchestrator
 *
 * Maps a parsed intent to a list of independent MODULES, then executes each one
 * as a task. Each module is a small async unit with a stable `key`, a human
 * label, and a `run(ctx)` function that returns a typed output. Modules are
 * intentionally decoupled so future providers (Suno, FAL, HeyGen, ElevenLabs,
 * Firebase Functions, Make webhooks) can be swapped in per-module without
 * touching the routing or the UI.
 *
 * Persistence is handled by the route layer (Firestore artistCommands /
 * artistTasks). The orchestrator just reports progress through callbacks.
 */
import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { OpenAI } from 'openai';
import { PRIMARY_MODEL, ZAI_API_KEY, ZAI_BASE_URL, isZaiConfigured } from '../../utils/ai-config';
import { generateMasterDesign, generateMusicWithMiniMax, generateVideoFromImage } from '../fal-service';
import type { CommandIntent, CommandParams, ParsedCommand } from './intent-router';

export type ModuleKey =
  | 'lyrics'
  | 'music_description'
  | 'music_prompt'
  | 'music_audio'
  | 'cover'
  | 'video_script'
  | 'video_clip'
  | 'caption'
  | 'metadata'
  | 'campaign_brief'
  | 'teaser_script';

export interface ModuleContext {
  artistName: string;
  artistImageUrl?: string | null;
  genre?: string;
  params: CommandParams;
  /** Outputs of previously-completed modules in this run (e.g. lyrics feed video script). */
  prior: Record<string, any>;
}

export interface ModuleResult {
  type: 'text' | 'image' | 'json' | 'audio' | 'video';
  title: string;
  content?: string;       // text/markdown
  imageUrl?: string;      // for image modules
  audioUrl?: string;      // for audio modules
  videoUrl?: string;      // for video modules
  data?: any;             // structured json
  provider?: string;
}

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  icon: string; // lucide icon name for the UI
  run: (ctx: ModuleContext) => Promise<ModuleResult>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function langNames(codes: string[]): string {
  const map: Record<string, string> = {
    es: 'Spanish', en: 'English', fr: 'French', pt: 'Portuguese', it: 'Italian', de: 'German',
  };
  return codes.map((c) => map[c] || c).join(' and ');
}

// ─── LLM helpers ─────────────────────────────────────────────────────────────
// GLM-5.2 (z.ai flagship) es el modelo más avanzado: lo usamos como PRINCIPAL en
// los módulos creativos/estratégicos largos (letra, guiones, brief, descripción).
// Si z.ai falla, cae automáticamente a gpt-4o-mini (createTrackedOpenAI).
const GLM_FLAGSHIP = 'glm-5.2';
let _zaiClient: OpenAI | null = null;
function getZaiClient(): OpenAI {
  if (!_zaiClient) {
    _zaiClient = new OpenAI({ apiKey: ZAI_API_KEY, baseURL: ZAI_BASE_URL });
  }
  return _zaiClient;
}

async function llmText(
  system: string,
  user: string,
  maxTokens = 900,
  opts: { flagship?: boolean } = {},
): Promise<string> {
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];

  // Módulos flagship: GLM-5.2 primero (máxima calidad), luego fallback a gpt-4o-mini.
  if (opts.flagship && isZaiConfigured()) {
    try {
      const completion = await getZaiClient().chat.completions.create({
        model: GLM_FLAGSHIP,
        temperature: 0.85,
        max_tokens: maxTokens,
        messages,
      });
      const out = (completion.choices?.[0]?.message?.content || '').trim();
      if (out) return out;
    } catch (e: any) {
      console.warn('[ArtistCommand] GLM-5.2 falló, fallback gpt-4o-mini:', e?.message);
    }
  }

  const openai = createTrackedOpenAI();
  const completion = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    temperature: 0.85,
    max_tokens: maxTokens,
    messages,
  });
  return (completion.choices?.[0]?.message?.content || '').trim();
}

async function llmJson(system: string, user: string): Promise<any> {
  const openai = createTrackedOpenAI();
  const completion = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    temperature: 0.5,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const content = completion.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(content); } catch { return {}; }
}

function ctxBrief(ctx: ModuleContext): string {
  const p = ctx.params;
  return [
    `Artist: ${ctx.artistName}`,
    p.genre ? `Genre: ${p.genre}` : ctx.genre ? `Genre: ${ctx.genre}` : '',
    p.mood ? `Mood: ${p.mood}` : '',
    `Languages: ${langNames(p.languages)}`,
    p.topic ? `Theme: ${p.topic}` : '',
    p.visualStyle ? `Visual style: ${p.visualStyle}` : '',
    p.objective ? `Objective: ${p.objective}` : '',
    p.format ? `Format: ${p.format}` : '',
    p.durationSeconds ? `Duration: ${p.durationSeconds}s` : '',
  ].filter(Boolean).join('\n');
}

// ─── Module registry ─────────────────────────────────────────────────────────

const MODULES: Record<ModuleKey, ModuleDefinition> = {
  lyrics: {
    key: 'lyrics', label: 'Letra completa', icon: 'PenLine',
    run: async (ctx) => {
      const content = await llmText(
        `You are a hit songwriter for the music platform Boostify. Write original, emotionally resonant song lyrics. Use clear [Verse], [Pre-Chorus], [Chorus], [Bridge], [Outro] section tags. If multiple languages are requested, weave them naturally (e.g. verses in one, chorus hook in another). Keep it radio-ready and original.`,
        `Write a complete song.\n${ctxBrief(ctx)}`,
        1100,
        { flagship: true },
      );
      return { type: 'text', title: 'Letra completa', content, provider: 'zai:glm-5.2' };
    },
  },

  music_description: {
    key: 'music_description', label: 'Descripción musical', icon: 'Music2',
    run: async (ctx) => {
      const content = await llmText(
        `You are a music producer. Describe the production: tempo (BPM), key, instrumentation, rhythm/groove, arrangement and reference sound. Be concrete and concise (a producer should be able to build it).`,
        `Describe the music production for this song.\n${ctxBrief(ctx)}`,
        500,
        { flagship: true },
      );
      return { type: 'text', title: 'Descripción musical', content, provider: 'zai:glm-5.2' };
    },
  },

  music_prompt: {
    key: 'music_prompt', label: 'Prompt de música (Suno/FAL)', icon: 'Wand2',
    run: async (ctx) => {
      const content = await llmText(
        `You write compact text-to-music generation prompts compatible with Suno and FAL MiniMax. Output ONE single line: comma-separated descriptors (genre, mood, instruments, vocal style, BPM, language) — no prose, no labels. Max 200 chars.`,
        `Create the music-generation prompt.\n${ctxBrief(ctx)}`,
        160,
      );
      return { type: 'text', title: 'Prompt para generación de música', content: content.replace(/\n+/g, ' ').trim(), provider: 'openrouter' };
    },
  },

  music_audio: {
    key: 'music_audio', label: 'Canción (audio real)', icon: 'AudioLines',
    run: async (ctx) => {
      // Build a compact style prompt (10-300 chars) — reuse music_prompt if present.
      let style = String(ctx.prior?.music_prompt?.content || '').replace(/\n+/g, ' ').trim();
      if (style.length < 10) {
        style = [
          ctx.params.genre || ctx.genre || 'pop',
          ctx.params.mood || 'energetic',
          'modern production, catchy hooks, professional vocals',
        ].filter(Boolean).join(', ');
      }
      style = style.slice(0, 290);

      // Lyrics (10-3000 chars) — reuse the lyrics module, else write a short set.
      let lyrics = String(ctx.prior?.lyrics?.content || '').trim();
      if (lyrics.length < 10) {
        lyrics = await llmText(
          `You are a hit songwriter. Write a SHORT, original song (2 verses + chorus) using [verse] and [chorus] tags. Keep it under 900 characters.`,
          `Write a short song.\n${ctxBrief(ctx)}`,
          600,
        );
      }
      lyrics = lyrics.slice(0, 2900);

      try {
        const result = await generateMusicWithMiniMax(style, lyrics);
        if (result?.success && result.audioUrl) {
          return {
            type: 'audio',
            title: 'Canción generada',
            audioUrl: result.audioUrl,
            content: style,
            provider: result.provider || 'fal-minimax-music-v2',
          };
        }
        throw new Error(result?.error || 'No se recibió audio');
      } catch (e: any) {
        // Never dead-end: deliver the production brief so the artist can still ship.
        return {
          type: 'text',
          title: 'Canción (audio no disponible ahora)',
          content: `No se pudo generar el audio en este momento (${e?.message || 'error'}).\n\nPrompt de estilo:\n${style}\n\nLetra:\n${lyrics}`,
          provider: 'prompt-only',
        };
      }
    },
  },

  cover: {
    key: 'cover', label: 'Portada del single', icon: 'Image',
    run: async (ctx) => {
      // Reuse the existing brand-aware cover generator (FAL → OpenAI fallback inside).
      try {
        const result = await generateMasterDesign(
          ctx.artistName,
          ctx.artistImageUrl || '',
          ctx.params.genre || ctx.genre || 'pop',
        );
        const imageUrl = (result as any)?.imageUrl || (result as any)?.url;
        if (imageUrl) {
          return { type: 'image', title: 'Portada del single', imageUrl, provider: (result as any)?.provider || 'fal' };
        }
      } catch { /* fall through to prompt-only */ }
      // If image generation is unavailable, at least deliver an art-direction prompt.
      const prompt = await llmText(
        `You are an art director. Write a single vivid image-generation prompt for a single cover (square 1:1). No text in the image. Include style, palette, subject, lighting, mood.`,
        `Single cover art direction.\n${ctxBrief(ctx)}`,
        220,
      );
      return { type: 'text', title: 'Portada (prompt de arte)', content: prompt, provider: 'prompt-only' };
    },
  },

  video_script: {
    key: 'video_script', label: 'Guion de video corto', icon: 'Clapperboard',
    run: async (ctx) => {
      const lyricsHint = ctx.prior?.lyrics?.content ? `\n\nUse this song as reference:\n${String(ctx.prior.lyrics.content).slice(0, 600)}` : '';
      const content = await llmText(
        `You are a music-video director. Write a shot-by-shot script for a short vertical video (9:16). Use a numbered shot list with: timecode, visual, camera, and on-screen action. Keep it to the requested duration.`,
        `Write the short-video script.\n${ctxBrief(ctx)}${lyricsHint}`,
        700,
        { flagship: true },
      );
      return { type: 'text', title: 'Guion de video corto', content, provider: 'zai:glm-5.2' };
    },
  },

  video_clip: {
    key: 'video_clip', label: 'Video clip (real)', icon: 'Video',
    run: async (ctx) => {
      // Animate the freshly-generated cover, else the artist photo.
      const sourceImage = String(ctx.prior?.cover?.imageUrl || ctx.artistImageUrl || '').trim();
      if (!sourceImage || !/^https?:\/\//.test(sourceImage)) {
        return {
          type: 'text',
          title: 'Video clip (sin imagen base)',
          content: 'No hay portada ni imagen del artista para animar. Genera primero una portada o añade una foto al perfil.',
          provider: 'prompt-only',
        };
      }
      const genre = ctx.params.genre || ctx.genre || 'pop';
      const motion = `${ctx.artistName} performing ${genre}, cinematic camera movement, dynamic stage lighting, music-video aesthetic, subtle realistic motion`;
      const aspectRatio: '16:9' | '9:16' =
        ctx.params.format && /(horizontal|16:9|youtube|landscape)/i.test(String(ctx.params.format)) ? '16:9' : '9:16';
      const duration = ctx.params.durationSeconds && ctx.params.durationSeconds >= 3 && ctx.params.durationSeconds <= 6
        ? ctx.params.durationSeconds : 6;
      try {
        const result = await generateVideoFromImage(sourceImage, motion, { aspectRatio, duration, resolution: '720p' });
        if (result?.success && result.videoUrl) {
          return {
            type: 'video',
            title: 'Video clip generado',
            videoUrl: result.videoUrl,
            content: motion,
            provider: result.provider || 'fal-grok-image-to-video',
          };
        }
        throw new Error(result?.error || 'No se recibió video');
      } catch (e: any) {
        return {
          type: 'text',
          title: 'Video clip (no disponible ahora)',
          content: `No se pudo generar el video en este momento (${e?.message || 'error'}).\n\nIdea de plano:\n${motion}`,
          provider: 'prompt-only',
        };
      }
    },
  },

  caption: {
    key: 'caption', label: 'Caption para redes', icon: 'Hash',
    run: async (ctx) => {
      const data = await llmJson(
        `You are a social media strategist. Return JSON: {"caption": string, "hashtags": string[], "cta": string}. Caption is punchy, on-brand, in the primary requested language; 10-15 relevant hashtags.`,
        `Create a launch social caption.\n${ctxBrief(ctx)}`,
      );
      const content = [data.caption, '', (data.hashtags || []).map((h: string) => (h.startsWith('#') ? h : `#${h}`)).join(' '), data.cta ? `\nCTA: ${data.cta}` : '']
        .filter(Boolean).join('\n');
      return { type: 'text', title: 'Caption para redes', content, data, provider: 'openrouter' };
    },
  },

  metadata: {
    key: 'metadata', label: 'Metadata para distribución', icon: 'ListMusic',
    run: async (ctx) => {
      const data = await llmJson(
        `You are a music distribution specialist (DistroKid/CD Baby style). Return JSON with keys: title, primaryArtist, featuredArtists (array), genre, subGenre, language, explicit (boolean), moods (array), isrcSuggested (boolean), releaseType ("single"|"ep"|"album"), copyright, recommendedReleaseDate (ISO date), platforms (array).`,
        `Build distribution metadata.\n${ctxBrief(ctx)}`,
      );
      return { type: 'json', title: 'Metadata para distribución', data, provider: 'openrouter' };
    },
  },

  campaign_brief: {
    key: 'campaign_brief', label: 'Brief de campaña', icon: 'Megaphone',
    run: async (ctx) => {
      const content = await llmText(
        `You are a music marketing strategist. Write a concise multi-platform campaign brief: objective, target audience, key message, 3 content pillars, channel plan (TikTok/IG/YouTube/Ads), 7-day posting calendar, and 3 KPIs.`,
        `Build the promo campaign brief.\n${ctxBrief(ctx)}`,
        850,
        { flagship: true },
      );
      return { type: 'text', title: 'Brief de campaña', content, provider: 'zai:glm-5.2' };
    },
  },

  teaser_script: {
    key: 'teaser_script', label: 'Guion de teaser', icon: 'Film',
    run: async (ctx) => {
      const content = await llmText(
        `You are a teaser editor. Write a 10-20s vertical teaser script: hook in the first 2s, the single moment that makes people stop scrolling, on-screen text overlays, and a final CTA card.`,
        `Write a teaser script.\n${ctxBrief(ctx)}`,
        400,
        { flagship: true },
      );
      return { type: 'text', title: 'Guion de teaser', content, provider: 'zai:glm-5.2' };
    },
  },
};

// ─── Intent → module plan ────────────────────────────────────────────────────

export function planModules(parsed: ParsedCommand): ModuleKey[] {
  const extras = new Set(parsed.params.extras || []);
  const plan: ModuleKey[] = [];

  switch (parsed.intent) {
    case 'create_song':
      plan.push('lyrics', 'music_description', 'music_prompt', 'music_audio');
      if (extras.has('cover')) plan.push('cover');
      if (extras.has('short-video')) {
        if (!plan.includes('cover')) plan.push('cover'); // need a source frame
        plan.push('video_script', 'video_clip');
      }
      plan.push('caption', 'metadata');
      break;
    case 'create_video':
      plan.push('cover', 'video_script', 'video_clip', 'caption');
      break;
    case 'create_campaign':
      plan.push('campaign_brief', 'caption', 'metadata');
      break;
    case 'design_cover':
      plan.push('cover', 'caption');
      break;
    case 'publish_teaser':
      plan.push('cover', 'teaser_script', 'video_clip', 'caption');
      break;
    default:
      // Unknown → best-effort small pack so the user still gets value.
      plan.push('caption');
  }
  // de-dupe while preserving order
  return Array.from(new Set(plan));
}

export function getModule(key: ModuleKey): ModuleDefinition {
  return MODULES[key];
}

export function moduleLabel(key: ModuleKey): string {
  return MODULES[key]?.label || key;
}

export function moduleIcon(key: ModuleKey): string {
  return MODULES[key]?.icon || 'Sparkles';
}

export interface OrchestratorCallbacks {
  onTaskStart: (key: ModuleKey) => Promise<void> | void;
  onTaskDone: (key: ModuleKey, result: ModuleResult) => Promise<void> | void;
  onTaskFail: (key: ModuleKey, error: string) => Promise<void> | void;
}

/**
 * Execute the planned modules sequentially (so later modules can use earlier
 * outputs, e.g. video script referencing the lyrics). Each task is independent:
 * a failure in one does not abort the rest.
 */
export async function runPlan(
  plan: ModuleKey[],
  baseCtx: Omit<ModuleContext, 'prior'>,
  cb: OrchestratorCallbacks,
): Promise<Record<string, ModuleResult>> {
  const prior: Record<string, ModuleResult> = {};
  for (const key of plan) {
    const mod = MODULES[key];
    if (!mod) continue;
    await cb.onTaskStart(key);
    try {
      const result = await mod.run({ ...baseCtx, prior });
      prior[key] = result;
      await cb.onTaskDone(key, result);
    } catch (err: any) {
      await cb.onTaskFail(key, err?.message || 'module failed');
    }
  }
  return prior;
}
