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
import { callAI } from '../utils/smart-ai';

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
  // ── V2: visual character-sheet (turnaround / wardrobe / props / materials) ──
  identity_lock?: string;        // concise immutable face+body identity anchor (<40 words)
  head_study_notes?: string;     // face shape, jawline, brows, skin, expression default
  signature_palette?: string[];  // 4-6 exact wardrobe/brand colors (hex or named)
  wardrobe?: Array<{ name: string; description: string }>;   // 2-4 signature looks
  props?: Array<{ name: string; description: string }>;      // 2-4 signature accessories/props
  materials?: string[];          // fabrics/textures (leather, denim, silk, chrome...)
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

const SYS = `You are a high-fashion casting director + editorial stylist creating a definitive CHARACTER SHEET (model sheet) for a music artist's promo imagery — magazine-campaign quality (Vogue / editorial fashion lookbook), the kind used in film/animation production with turnaround, head study, wardrobe, props, palette and materials. The visual language is elevated, premium, editorial fashion — NOT amateur, NOT generic stock.
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
  identity_lock: string;
  head_study_notes: string;
  signature_palette: string[];
  wardrobe: Array<{ name: string; description: string }>;
  props: Array<{ name: string; description: string }>;
  materials: string[];
}

Rules:
- Be specific and visually concrete. Avoid clichés.
- "base_prompt" must be ONE sentence (<35 words) describing the person concretely so a Flux model can render them consistently.
- "identity_lock" is the IMMUTABLE anchor (<40 words): exact face shape, hair, eyes, skin, build — the traits that must NEVER change between generations.
- "head_study_notes": face geometry (jaw, cheekbones, brows, nose), skin texture, default expression.
- "signature_palette": 4-6 exact colors (named or hex) that define the artist's wardrobe/brand look.
- "wardrobe": 2-4 signature outfits, each with a short concrete description.
- "props": 2-4 signature accessories/objects (instrument, jewelry, eyewear, hat...).
- "materials": fabrics/textures that recur (leather, denim, silk, chrome, velvet...).
- Use the artist's bio/genre/style hints. If profile data is sparse, infer plausible visual identity from the genre.
- Wardrobe and styling must read as high-fashion editorial coherent with the artist's genre and culture — refined, intentional, campaign-grade.
- Never include text like "AI", "render", "illustration" — we want photorealistic capture.`;

/**
 * Builds a high-fashion EDITORIAL style modifier that stays coherent with the
 * specific artist (their vibe, aesthetic tags, palette and materials). This is
 * appended to every generated view so the character sheet reads like a premium
 * magazine campaign instead of generic stock — while the identity_lock keeps
 * the face/body identical to the artist's real photo.
 */
export function buildEditorialStyle(sheet: CharacterSheet): string {
  const vibe = (sheet.vibe_keywords || []).slice(0, 3).join(', ');
  const tags = (sheet.aesthetic_tags || []).slice(0, 3).join(', ');
  const palette = (sheet.signature_palette || sheet.color_palette || []).slice(0, 4).join(', ');
  const materials = (sheet.materials || []).slice(0, 3).join(', ');
  return [
    'high-fashion editorial campaign aesthetic',
    'premium magazine photography, Vogue / editorial lookbook grade',
    'sophisticated art direction and intentional styling',
    'refined cinematic directional lighting, elegant contrast, rich tonality',
    'shot on medium-format, fine grain, crisp detail',
    tags ? `fashion direction: ${tags}` : '',
    materials ? `luxe materials: ${materials}` : '',
    vibe ? `editorial mood: ${vibe}` : '',
    palette ? `coherent color story: ${palette}` : '',
  ].filter(Boolean).join(', ');
}

export async function generateCharacterSheet(profile: ArtistProfileForSheet): Promise<CharacterSheet> {
  const userPrompt = `Artist profile:
- Stage name: ${profile.artistName || 'Unknown'}
- Real name: ${profile.realName || '—'}
- Genre: ${profile.genre || 'unknown'}
- Country: ${profile.country || '—'}
- Aesthetic / visual style hints: ${profile.aestheticStyle || profile.visualStyle || '—'}
- Biography: ${(profile.biography || '').slice(0, 1500)}

Produce the CharacterSheet JSON now.`;

  // Primary: smart-ai cascade (OpenAI → z.ai/GLM → …) so we survive provider outages.
  let raw = '{}';
  try {
    raw = await callAI(
      'content',
      [
        { role: 'system', content: SYS },
        { role: 'user', content: userPrompt },
      ],
      { requireJSON: true, temperature: 0.7, maxTokens: 1800, label: 'character-sheet' },
    );
  } catch (e) {
    logger.warn('[CharacterSheet] callAI failed, falling back to OpenAI direct', {
      error: (e as Error)?.message,
    });
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const r = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: userPrompt },
      ],
    });
    raw = r.choices[0]?.message?.content || '{}';
  }

  let sheet: CharacterSheet;
  try {
    // callAI may wrap JSON in prose/fences — extract the object defensively.
    const match = raw.match(/\{[\s\S]*\}/);
    sheet = JSON.parse(match ? match[0] : raw);
  } catch (e) {
    logger.error('[CharacterSheet] parse failed', { raw: raw.slice(0, 500) });
    throw new Error('Failed to parse CharacterSheet JSON');
  }

  // Minimal sanity defaults
  sheet.artistName = sheet.artistName || profile.artistName || 'Artist';
  sheet.name = sheet.name || sheet.artistName;
  sheet.vibe_keywords = sheet.vibe_keywords || [];
  sheet.color_palette = sheet.color_palette || [];
  sheet.aesthetic_tags = sheet.aesthetic_tags || [];
  // V2 defaults
  sheet.identity_lock = sheet.identity_lock || sheet.base_prompt || '';
  sheet.head_study_notes = sheet.head_study_notes || '';
  sheet.signature_palette = (sheet.signature_palette && sheet.signature_palette.length)
    ? sheet.signature_palette
    : sheet.color_palette;
  sheet.wardrobe = Array.isArray(sheet.wardrobe) ? sheet.wardrobe : [];
  sheet.props = Array.isArray(sheet.props) ? sheet.props : [];
  sheet.materials = Array.isArray(sheet.materials) ? sheet.materials : [];

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
  const editorial = buildEditorialStyle(sheet);
  return [
    {
      label: 'studio_portrait',
      prompt: `${subject}. Studio portrait, neutral grey backdrop, soft octabox key light, 85mm f/1.8, eye-contact, beauty retouch, ${editorial}, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'urban_golden_hour',
      prompt: `${subject}. 3/4 medium shot, urban rooftop at golden hour, warm backlight, anamorphic 35mm, candid expression, ${editorial}, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'on_stage',
      prompt: `${subject}. Full-body, on a music stage with mic stand, performance light haze, 24mm wide, cinematic, ${editorial}, photorealistic`,
      aspect: '9:16',
    },
    {
      label: 'profile_dramatic',
      prompt: `${subject}. Side profile, single hard rim light against deep black, dramatic chiaroscuro, 85mm, ${editorial}, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'lifestyle_candid',
      prompt: `${subject}. Lifestyle candid moment, natural daylight near a window, slight smile, 35mm, Kodak Portra 400 look, ${editorial}, photorealistic`,
      aspect: '4:5',
    },
    {
      label: 'editorial_fashion',
      prompt: `${subject}. Editorial fashion magazine cover style, hard light, beauty dish key, seamless backdrop, 85mm, ${editorial}, photorealistic`,
      aspect: '4:5',
    },
  ];
}

export interface CanonicalView {
  key: string;
  label: string;
  prompt: string;
  aspect: '1:1' | '4:5' | '9:16' | '3:4';
  category: 'turnaround' | 'head' | 'portrait';
}

/**
 * The canonical "model sheet" views used to LOCK an artist's visual identity.
 * These are generated once (anchored on the artist's real photo via Flux Kontext)
 * and become the master references every downstream module reuses.
 *
 * The same identity anchor (identity_lock + signature outfit) is repeated in
 * every prompt so face + wardrobe stay consistent across all angles.
 */
export function buildCanonicalViewPrompts(sheet: CharacterSheet): CanonicalView[] {
  const lock = (sheet.identity_lock || sheet.base_prompt || '').trim();
  const outfit = (sheet.signature_outfit || '').trim();
  const materials = (sheet.materials || []).slice(0, 4).join(', ');
  const palette = (sheet.signature_palette || sheet.color_palette || []).slice(0, 5).join(', ');
  const wardrobeLook = sheet.wardrobe?.[0]?.description || outfit;

  const anchor = [lock, outfit ? `wearing ${outfit}` : '', materials ? `materials: ${materials}` : '']
    .filter(Boolean)
    .join(', ');

  const editorial = buildEditorialStyle(sheet);

  const consistency =
    `same exact person and face, identical features, consistent identity, neutral seamless studio backdrop, even soft three-point lighting, full color, sharp focus, photorealistic, ultra-detailed, ${editorial}`;

  return [
    {
      key: 'turnaround_front',
      label: 'Turnaround · Front',
      category: 'turnaround',
      aspect: '3:4',
      prompt: `${anchor}. Full-body character turnaround FRONT view, standing straight, arms relaxed at sides, T-pose-free neutral stance, facing camera. ${consistency}`,
    },
    {
      key: 'turnaround_threequarter',
      label: 'Turnaround · 3/4',
      category: 'turnaround',
      aspect: '3:4',
      prompt: `${anchor}. Full-body character turnaround THREE-QUARTER view (45 degrees), standing straight, arms relaxed. ${consistency}`,
    },
    {
      key: 'turnaround_side',
      label: 'Turnaround · Side',
      category: 'turnaround',
      aspect: '3:4',
      prompt: `${anchor}. Full-body character turnaround SIDE profile view (90 degrees), standing straight, arms relaxed. ${consistency}`,
    },
    {
      key: 'turnaround_back',
      label: 'Turnaround · Back',
      category: 'turnaround',
      aspect: '3:4',
      prompt: `${anchor}. Full-body character turnaround BACK view, standing straight, showing hairstyle and outfit from behind. ${consistency}`,
    },
    {
      key: 'head_front',
      label: 'Head Study · Front',
      category: 'head',
      aspect: '1:1',
      prompt: `${lock}. Head and shoulders study, FRONT view, neutral expression, ${sheet.head_study_notes || 'clear facial features'}. Close-up, ${consistency}`,
    },
    {
      key: 'head_threequarter',
      label: 'Head Study · 3/4',
      category: 'head',
      aspect: '1:1',
      prompt: `${lock}. Head and shoulders study, THREE-QUARTER view (45 degrees), neutral expression. Close-up, ${consistency}`,
    },
    {
      key: 'portrait_cinematic',
      label: 'Cinematic Portrait',
      category: 'portrait',
      aspect: '4:5',
      prompt: `${anchor}${wardrobeLook && wardrobeLook !== outfit ? `, ${wardrobeLook}` : ''}. Hero high-fashion editorial campaign portrait, dramatic directional lighting${palette ? `, color palette ${palette}` : ''}, confident editorial expression, shallow depth of field, 85mm, ${editorial}, photorealistic, ultra-detailed`,
    },
  ];
}
