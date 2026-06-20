/**
 * Artist Command Engine — Intent Router
 *
 * Parses a natural-language command ("Hey Redwine, crea una canción afrobeat
 * sensual en español y francés con portada y video corto") into a structured
 * intent + parameters. Uses an LLM (OpenRouter/OpenAI via createTrackedOpenAI)
 * with a deterministic regex fallback so the engine NEVER hard-fails on parse.
 *
 * Designed to be provider-agnostic — future integrations (Gemini, Suno, FAL,
 * HeyGen, ElevenLabs) plug into the orchestrator, not here.
 */
import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { PRIMARY_MODEL } from '../../utils/ai-config';

export type CommandIntent =
  | 'create_song'
  | 'create_video'
  | 'create_campaign'
  | 'design_cover'
  | 'publish_teaser'
  | 'unknown';

export interface CommandParams {
  genre?: string;
  mood?: string;
  languages: string[];
  durationSeconds?: number;
  visualStyle?: string;
  objective?: string;
  format?: string;
  extras: string[]; // e.g. ['cover','short-video'] detected add-ons
  topic?: string;
}

export interface ParsedCommand {
  artistName: string | null;
  intent: CommandIntent;
  params: CommandParams;
  confidence: number;
  source: 'llm' | 'fallback';
}

const INTENT_KEYWORDS: Record<Exclude<CommandIntent, 'unknown'>, RegExp> = {
  create_song: /\b(canci[oó]n|tema|song|track|m[uú]sica|beat)\b/i,
  create_video: /\b(video|clip|visual|music\s*video|videoclip)\b/i,
  create_campaign: /\b(campa[nñ]a|campaign|promo(?:ci[oó]n)?|marketing|anuncio|ads?)\b/i,
  design_cover: /\b(portada|cover|car[aá]tula|artwork|art\b)\b/i,
  publish_teaser: /\b(teaser|adelanto|snippet|preview|avance)\b/i,
};

const LANGUAGE_MAP: Record<string, string> = {
  espanol: 'es', español: 'es', spanish: 'es', es: 'es',
  ingles: 'en', inglés: 'en', english: 'en', en: 'en',
  frances: 'fr', francés: 'fr', french: 'fr', fr: 'fr',
  portugues: 'pt', portugués: 'pt', portuguese: 'pt', pt: 'pt',
  italiano: 'it', italian: 'it', it: 'it',
  aleman: 'de', alemán: 'de', german: 'de', de: 'de',
};

const MOOD_KEYWORDS = [
  'sensual', 'romántico', 'romantico', 'triste', 'alegre', 'energético', 'energetico',
  'oscuro', 'épico', 'epico', 'melancólico', 'melancolico', 'agresivo', 'chill',
  'nostálgico', 'nostalgico', 'sexy', 'happy', 'sad', 'dark', 'epic', 'dreamy',
];

const GENRE_KEYWORDS = [
  'afrobeat', 'afrobeats', 'reggaeton', 'trap', 'pop', 'rock', 'r&b', 'rnb', 'hip-hop',
  'hip hop', 'rap', 'electronic', 'edm', 'house', 'techno', 'jazz', 'soul', 'blues',
  'indie', 'latin', 'reggae', 'country', 'folk', 'classical', 'k-pop', 'drill', 'dancehall',
];

/** Extract the "Hey <name>," addressed artist, if present. */
export function extractArtistName(raw: string): string | null {
  const m = raw.match(/\bhey[, ]+([a-z0-9 áéíóúñü'._-]+?)[,.:]/i);
  if (m && m[1]) return m[1].trim();
  // Also accept "oye <name>," (Spanish)
  const m2 = raw.match(/\b(?:oye|hola)[, ]+([a-z0-9 áéíóúñü'._-]+?)[,.:]/i);
  if (m2 && m2[1]) return m2[1].trim();
  return null;
}

function detectIntent(raw: string): { intent: CommandIntent; extras: string[] } {
  const extras: string[] = [];
  if (INTENT_KEYWORDS.design_cover.test(raw)) extras.push('cover');
  if (INTENT_KEYWORDS.create_video.test(raw)) extras.push('short-video');
  if (INTENT_KEYWORDS.publish_teaser.test(raw)) extras.push('teaser');

  // Primary intent priority: song > video > campaign > cover > teaser
  let intent: CommandIntent = 'unknown';
  if (INTENT_KEYWORDS.create_song.test(raw)) intent = 'create_song';
  else if (INTENT_KEYWORDS.create_video.test(raw)) intent = 'create_video';
  else if (INTENT_KEYWORDS.create_campaign.test(raw)) intent = 'create_campaign';
  else if (INTENT_KEYWORDS.design_cover.test(raw)) intent = 'design_cover';
  else if (INTENT_KEYWORDS.publish_teaser.test(raw)) intent = 'publish_teaser';

  return { intent, extras: Array.from(new Set(extras)) };
}

function detectLanguages(raw: string): string[] {
  const found = new Set<string>();
  const lower = raw.toLowerCase();
  for (const [word, code] of Object.entries(LANGUAGE_MAP)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) found.add(code);
  }
  return Array.from(found);
}

function firstMatch(raw: string, list: string[]): string | undefined {
  const lower = raw.toLowerCase();
  for (const term of list) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower)) {
      return term;
    }
  }
  return undefined;
}

function detectDuration(raw: string): number | undefined {
  const m = raw.match(/(\d{1,3})\s*(seg|segundos?|sec|seconds?|s\b)/i);
  if (m) return parseInt(m[1], 10);
  const min = raw.match(/(\d{1,2})\s*(min|minutos?|minutes?)/i);
  if (min) return parseInt(min[1], 10) * 60;
  if (/\b(corto|short|teaser|snippet)\b/i.test(raw)) return 30;
  return undefined;
}

/** Pure deterministic parse — always works, no network. */
export function fallbackParse(raw: string): ParsedCommand {
  const { intent, extras } = detectIntent(raw);
  const languages = detectLanguages(raw);
  const params: CommandParams = {
    genre: firstMatch(raw, GENRE_KEYWORDS),
    mood: firstMatch(raw, MOOD_KEYWORDS),
    languages: languages.length ? languages : ['es'],
    durationSeconds: detectDuration(raw),
    visualStyle: /\b(cinematic|cinematogr[aá]fico|neon|retro|vintage|futurista|minimalista|lujo|luxury)\b/i.exec(raw)?.[0],
    objective: /\b(viral|engagement|ventas|sales|streams|awareness|lanzamiento|release)\b/i.exec(raw)?.[0],
    format: /\b(9:16|16:9|1:1|vertical|horizontal|cuadrado|reel|short|tiktok)\b/i.exec(raw)?.[0],
    extras,
  };
  return {
    artistName: extractArtistName(raw),
    intent,
    params,
    confidence: intent === 'unknown' ? 0.2 : 0.6,
    source: 'fallback',
  };
}

const SYSTEM_PROMPT = `You are the Intent Router for the Boostify "Artist Command Engine".
You receive a short natural-language command (Spanish, English or mixed) that an
artist or manager speaks/types to control their music profile. Extract a strict
JSON object. Do NOT add commentary.

intent must be one of: create_song, create_video, create_campaign, design_cover, publish_teaser, unknown.
Return JSON with this exact shape:
{
  "artistName": string | null,           // the name addressed after "Hey ...," if any
  "intent": "<one of the enums>",
  "params": {
    "genre": string | null,              // e.g. "afrobeat"
    "mood": string | null,               // e.g. "sensual"
    "languages": string[],               // ISO codes, e.g. ["es","fr"]; default ["es"] if none
    "durationSeconds": number | null,    // for video/teaser
    "visualStyle": string | null,
    "objective": string | null,          // marketing goal
    "format": string | null,             // e.g. "9:16"
    "topic": string | null,              // lyrical theme if stated
    "extras": string[]                   // detected add-ons: any of "cover","short-video","teaser"
  },
  "confidence": number                   // 0..1
}`;

/**
 * Parse a command with the LLM; on any failure return the deterministic fallback.
 */
export async function routeCommand(raw: string): Promise<ParsedCommand> {
  const text = (raw || '').trim();
  if (!text) {
    return { artistName: null, intent: 'unknown', params: { languages: ['es'], extras: [] }, confidence: 0, source: 'fallback' };
  }

  try {
    const openai = createTrackedOpenAI();
    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    });
    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error('empty completion');
    const parsed = JSON.parse(content);

    const fb = fallbackParse(text);
    const params: CommandParams = {
      genre: parsed?.params?.genre ?? fb.params.genre,
      mood: parsed?.params?.mood ?? fb.params.mood,
      languages: Array.isArray(parsed?.params?.languages) && parsed.params.languages.length
        ? parsed.params.languages.map((l: string) => String(l).toLowerCase().slice(0, 5))
        : fb.params.languages,
      durationSeconds: typeof parsed?.params?.durationSeconds === 'number' ? parsed.params.durationSeconds : fb.params.durationSeconds,
      visualStyle: parsed?.params?.visualStyle ?? fb.params.visualStyle,
      objective: parsed?.params?.objective ?? fb.params.objective,
      format: parsed?.params?.format ?? fb.params.format,
      topic: parsed?.params?.topic ?? fb.params.topic,
      extras: Array.isArray(parsed?.params?.extras) && parsed.params.extras.length
        ? Array.from(new Set([...parsed.params.extras, ...fb.params.extras]))
        : fb.params.extras,
    };
    const intent: CommandIntent = ['create_song', 'create_video', 'create_campaign', 'design_cover', 'publish_teaser', 'unknown'].includes(parsed?.intent)
      ? parsed.intent
      : fb.intent;

    return {
      artistName: parsed?.artistName ?? fb.artistName,
      intent: intent === 'unknown' ? fb.intent : intent,
      params,
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0.75,
      source: 'llm',
    };
  } catch {
    return fallbackParse(text);
  }
}
