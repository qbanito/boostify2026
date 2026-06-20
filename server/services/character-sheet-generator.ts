/**
 * 🧠 Character Sheet Generator
 *
 * Reads an artist's profile (bio, genre, aesthetic, etc.) and uses GPT to
 * produce a structured `CharacterSheet` JSON. This sheet is then used to
 * craft consistent prompts when bootstrapping reference images.
 */
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { PRIMARY_MODEL } from '../utils/ai-config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

export interface CharacterSheet {
  name: string;
  artistName: string;
  age_range: string;             // "20-25", "30-35"...
  gender_presentation: string;
  ethnicity_hint?: string;
  hair: string;
  eyes: string;
  signature_outfit: string;
  body_type: string;
  vibe_keywords: string[];       // ["confident", "moody", "playful"]
  color_palette: string[];       // ["deep red", "matte black"]
  aesthetic_tags: string[];      // ["streetwear", "y2k"]
  notable_features?: string;     // tattoos, piercings, etc.
  base_prompt: string;           // ready-to-paste short description for prompts
}

export interface ArtistProfileForSheet {
  artistName?: string | null;
  realName?: string | null;
  biography?: string | null;
  genre?: string | null;
  country?: string | null;
  aestheticStyle?: string | null;
  visualStyle?: string | null;
  profileImageUrl?: string | null;
}

const SYS = `You are a casting director + visual stylist creating a CHARACTER SHEET for a music artist's promo imagery.
Return strict JSON matching this TypeScript interface:
interface CharacterSheet {
  name: string;
  artistName: string;
  age_range: string;
  gender_presentation: string;
  ethnicity_hint?: string;
  hair: string;
  eyes: string;
  signature_outfit: string;
  body_type: string;
  vibe_keywords: string[];
  color_palette: string[];
  aesthetic_tags: string[];
  notable_features?: string;
  base_prompt: string;
}

Rules:
- Be specific and visually concrete. Avoid clichés.
- "base_prompt" must be ONE sentence (<35 words) describing the person concretely so a Flux model can render them consistently.
- Use the artist's bio/genre/style hints. If profile data is sparse, infer plausible visual identity from the genre.
- Never include text like "AI", "render", "illustration" — we want photorealistic capture.`;

export async function generateCharacterSheet(profile: ArtistProfileForSheet): Promise<CharacterSheet> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const userPrompt = `Artist profile:
- Stage name: ${profile.artistName || 'Unknown'}
- Real name: ${profile.realName || '—'}
- Genre: ${profile.genre || 'unknown'}
- Country: ${profile.country || '—'}
- Aesthetic / visual style hints: ${profile.aestheticStyle || profile.visualStyle || '—'}
- Biography: ${(profile.biography || '').slice(0, 1500)}

Produce the CharacterSheet JSON now.`;

  const r = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    messages: [
      { role: 'system', content: SYS },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = r.choices[0]?.message?.content || '{}';
  let sheet: CharacterSheet;
  try {
    sheet = JSON.parse(raw);
  } catch (e) {
    logger.error('[CharacterSheet] parse failed', { raw });
    throw new Error('Failed to parse CharacterSheet JSON');
  }

  // Minimal sanity defaults
  sheet.artistName = sheet.artistName || profile.artistName || 'Artist';
  sheet.name = sheet.name || sheet.artistName;
  sheet.vibe_keywords = sheet.vibe_keywords || [];
  sheet.color_palette = sheet.color_palette || [];
  sheet.aesthetic_tags = sheet.aesthetic_tags || [];

  return sheet;
}

/**
 * 6 reference shot prompts for bootstrapping a LoRA training set.
 * Always use the SAME character description (sheet.base_prompt) so the
 * trained LoRA captures one consistent identity.
 */
export function buildBootstrapPrompts(sheet: CharacterSheet): Array<{
  label: string;
  prompt: string;
  aspect: '1:1' | '4:5' | '9:16' | '3:4';
}> {
  const subject = sheet.base_prompt;
  return [
    {
      label: 'studio_portrait',
      prompt: `${subject}. Studio portrait, neutral grey backdrop, soft octabox key light, 85mm f/1.8, eye-contact, beauty retouch, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'urban_golden_hour',
      prompt: `${subject}. 3/4 medium shot, urban rooftop at golden hour, warm backlight, anamorphic 35mm, candid expression, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'on_stage',
      prompt: `${subject}. Full-body, on a music stage with mic stand, performance light haze, 24mm wide, cinematic, photorealistic`,
      aspect: '9:16',
    },
    {
      label: 'profile_dramatic',
      prompt: `${subject}. Side profile, single hard rim light against deep black, dramatic chiaroscuro, 85mm, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'lifestyle_candid',
      prompt: `${subject}. Lifestyle candid moment, natural daylight near a window, slight smile, 35mm, Kodak Portra 400 look, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'editorial_fashion',
      prompt: `${subject}. Editorial fashion magazine cover style, hard light, beauty dish key, seamless backdrop, 85mm, photorealistic`,
      aspect: '4:5',
    },
  ];
}
