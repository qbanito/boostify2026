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
import { PRIMARY_MODEL } from '../../utils/ai-config';
import { generateMasterDesign } from '../fal-service';
import type { CommandIntent, CommandParams, ParsedCommand } from './intent-router';

export type ModuleKey =
  | 'lyrics'
  | 'music_description'
  | 'music_prompt'
  | 'cover'
  | 'video_script'
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
  type: 'text' | 'image' | 'json';
  title: string;
  content?: string;       // text/markdown
  imageUrl?: string;      // for image modules
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

async function llmText(system: string, user: string, maxTokens = 900): Promise<string> {
  const openai = createTrackedOpenAI();
  const completion = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    temperature: 0.85,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
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
      );
      return { type: 'text', title: 'Letra completa', content, provider: 'openrouter' };
    },
  },

  music_description: {
    key: 'music_description', label: 'Descripción musical', icon: 'Music2',
    run: async (ctx) => {
      const content = await llmText(
        `You are a music producer. Describe the production: tempo (BPM), key, instrumentation, rhythm/groove, arrangement and reference sound. Be concrete and concise (a producer should be able to build it).`,
        `Describe the music production for this song.\n${ctxBrief(ctx)}`,
        500,
      );
      return { type: 'text', title: 'Descripción musical', content, provider: 'openrouter' };
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
      );
      return { type: 'text', title: 'Guion de video corto', content, provider: 'openrouter' };
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
      );
      return { type: 'text', title: 'Brief de campaña', content, provider: 'openrouter' };
    },
  },

  teaser_script: {
    key: 'teaser_script', label: 'Guion de teaser', icon: 'Film',
    run: async (ctx) => {
      const content = await llmText(
        `You are a teaser editor. Write a 10-20s vertical teaser script: hook in the first 2s, the single moment that makes people stop scrolling, on-screen text overlays, and a final CTA card.`,
        `Write a teaser script.\n${ctxBrief(ctx)}`,
        400,
      );
      return { type: 'text', title: 'Guion de teaser', content, provider: 'openrouter' };
    },
  },
};

// ─── Intent → module plan ────────────────────────────────────────────────────

export function planModules(parsed: ParsedCommand): ModuleKey[] {
  const extras = new Set(parsed.params.extras || []);
  const plan: ModuleKey[] = [];

  switch (parsed.intent) {
    case 'create_song':
      plan.push('lyrics', 'music_description', 'music_prompt');
      if (extras.has('cover')) plan.push('cover');
      if (extras.has('short-video')) plan.push('video_script');
      plan.push('caption', 'metadata');
      break;
    case 'create_video':
      plan.push('video_script');
      if (extras.has('cover')) plan.push('cover');
      plan.push('caption');
      break;
    case 'create_campaign':
      plan.push('campaign_brief', 'caption', 'metadata');
      break;
    case 'design_cover':
      plan.push('cover', 'caption');
      break;
    case 'publish_teaser':
      plan.push('teaser_script', 'caption');
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
