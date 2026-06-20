/**
 * 🎥 Video prompt + spoken-promo script builder
 *
 * Produces a Kling motion prompt that respects the EXACT same character
 * sheet + scene used to generate the source promo image, plus an
 * optional spoken-promo script for the artist's HeyGen avatar.
 */
import OpenAI from 'openai';
import type { CharacterSheet } from './character-sheet-generator';
import { PRIMARY_MODEL } from '../utils/ai-config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

export interface ImageSceneContext {
  basePrompt: string;
  hookLine?: string;
  action?: string;
  environment?: string;
  wardrobe?: string;
  camera?: string;
}

export interface VideoMotionPlan {
  motionPrompt: string;     // sent to Kling
  negativePrompt: string;
  cameraMovement: string;
  duration: 5 | 10;
}

const SYS_MOTION = `You craft motion prompts for image-to-video models (Kling).
You are given a SOURCE IMAGE description + the artist's character sheet.
Return JSON: { "motionPrompt": string, "negativePrompt": string, "cameraMovement": string, "duration": 5|10 }

Hard rules:
- DO NOT change the subject, wardrobe, environment or identity. The image is FROZEN, you only describe MOTION + CAMERA.
- "motionPrompt": describe what the subject does (subtle micro-expression, hair flow, breath, slight body sway, mouthing the lyric, slow turn, etc.) plus the camera movement. <50 words.
- "negativePrompt": list of artifacts to avoid (face morphing, double face, extra limbs, identity drift, blurry, low-res, watermark, text artifacts).
- "cameraMovement": ONE concrete camera move (e.g. "slow dolly-in", "subtle parallax", "handheld micro-shake", "orbit 15 degrees right").
- "duration": 5 for hooks/loops, 10 for hero shots. Default 5.`;

export async function buildKlingMotionPlan(args: {
  scene: ImageSceneContext;
  sheet: CharacterSheet | null;
  songTitle: string;
  songMood?: string[];
}): Promise<VideoMotionPlan> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const sheetBlock = args.sheet
    ? `Character (LOCKED): ${args.sheet.base_prompt}; outfit: ${args.sheet.signature_outfit}; vibe: ${(args.sheet.vibe_keywords || []).join(', ')}`
    : '';

  const userMsg = `SOURCE IMAGE (do not change anything visible):
- subject prompt: ${args.scene.basePrompt}
- action: ${args.scene.action || 'unspecified'}
- environment: ${args.scene.environment || 'unspecified'}
- wardrobe: ${args.scene.wardrobe || 'unspecified'}
- camera framing: ${args.scene.camera || 'unspecified'}
${sheetBlock}

Song: "${args.songTitle}"${args.songMood?.length ? ' · mood: ' + args.songMood.join(', ') : ''}

Return JSON now.`;

  const r = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.6,
    messages: [
      { role: 'system', content: SYS_MOTION },
      { role: 'user', content: userMsg },
    ],
  });
  const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
  return {
    motionPrompt: parsed.motionPrompt || `${args.scene.action || 'subtle motion'}, ${args.scene.camera || 'slow dolly-in'}`,
    negativePrompt:
      parsed.negativePrompt ||
      'face morph, double face, extra limbs, identity drift, blurry, low-res, watermark, text',
    cameraMovement: parsed.cameraMovement || 'slow dolly-in',
    duration: (parsed.duration === 10 ? 10 : 5) as 5 | 10,
  };
}

// ─── Spoken promo script ───────────────────────────────────────────────────

const SYS_SPOKEN = `You write SHORT first-person spoken-promo scripts for music artists.
The artist will say this on camera (HeyGen avatar). Return JSON: { "script": string, "language": string, "estimatedDurationSec": number }

Rules:
- Tone: confident, intimate, conversational. NEVER read like an ad.
- Length: 12 to 22 seconds spoken aloud (~30-55 words).
- First sentence MUST hook (a stat, a feeling, a question).
- End with a clear CTA mentioning the song title.
- Match the song's language (detect from title/mood/genre cues; default to English if unclear).
- DO NOT mention "AI", "platform", "Boostify". Speak as the artist.`;

export interface SpokenPromoScript {
  script: string;
  language: string;
  estimatedDurationSec: number;
}

export async function buildSpokenPromoScript(args: {
  sheet: CharacterSheet | null;
  songTitle: string;
  songMood?: string[];
  songThemes?: string[];
  hookLine?: string;
  language?: string;
}): Promise<SpokenPromoScript> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const userMsg = `Artist: ${args.sheet?.artistName || 'the artist'}
Vibe keywords: ${(args.sheet?.vibe_keywords || []).join(', ') || 'none'}
Aesthetic: ${(args.sheet?.aesthetic_tags || []).join(', ') || 'none'}

Song: "${args.songTitle}"
Mood: ${(args.songMood || []).join(', ') || 'unspecified'}
Themes: ${(args.songThemes || []).join(', ') || 'unspecified'}
${args.hookLine ? 'Hook line idea: ' + args.hookLine : ''}
${args.language ? 'Force language: ' + args.language : ''}

Return JSON now.`;

  const r = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.85,
    messages: [
      { role: 'system', content: SYS_SPOKEN },
      { role: 'user', content: userMsg },
    ],
  });
  const parsed = JSON.parse(r.choices[0]?.message?.content || '{}');
  return {
    script: parsed.script || `Hey, I'm ${args.sheet?.artistName || 'an artist'}. My new single ${args.songTitle} is out now.`,
    language: parsed.language || args.language || 'en',
    estimatedDurationSec: Number(parsed.estimatedDurationSec) || 18,
  };
}
