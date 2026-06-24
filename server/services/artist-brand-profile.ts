/**
 * ============================================================
 *  ARTIST BRAND PROFILE — JSON MASTER DE IDENTIDAD VISUAL
 * ============================================================
 *
 * Cada artista tiene UN único Brand Profile que define su ADN
 * visual. Este JSON se genera UNA vez (con Gemini analizando
 * nombre + género + foto + bio), se cachea en Firestore y se
 * REUTILIZA en TODAS las generaciones de imágenes (merch IA,
 * portadas, posters, mockups). Garantiza coherencia.
 *
 * Firestore path: `artistBrandProfiles/{artistId}`
 *
 * Este profile se inyecta en cada prompt de FAL para que el modelo
 * tenga la misma "biblia visual" producto a producto.
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Rich artist-identity block — the full "who is this artist" DNA.
 * Think of a Michael-Jackson-style dossier: sound, voice, performance,
 * fashion, persona, lore and audience. All fields are descriptive so they
 * can feed prompts, bios, marketing copy, EPKs, etc. Optional/back-compat.
 */
export interface ArtistIdentity {
  // — PERSONA & STORY —
  /** One-line artist statement / positioning. */
  tagline: string;
  /** Personality & character — how the artist comes across. */
  persona: string;
  /** Origin story / lore / background narrative. */
  backstory: string;
  /** City / country of origin. */
  origin: string;
  /** Era / time period of the sound (e.g. "contemporary 2020s"). */
  era: string;
  /** Languages the artist performs in. */
  languages: string[];
  /** Core values / what the artist stands for. */
  values: string[];

  // — MUSICAL IDENTITY —
  primaryGenre: string;
  subGenres: string[];
  /** Artists who shaped this sound. */
  influences: string[];
  /** "Recommended if you like" comparable artists. */
  similarArtists: string[];
  /** Description of the signature sound / sonic palette. */
  signatureSound: string;
  /** Key instruments / production elements. */
  instrumentation: string[];
  /** Typical tempo range, e.g. "90-110 BPM". */
  tempoRange: string;
  /** Vocal characteristics (range, texture, delivery). */
  vocalStyle: string;
  /** Recurring lyrical themes. */
  lyricalThemes: string[];

  // — PERFORMANCE / STAGE —
  stagePresence: string;
  performanceStyle: string;
  liveShowElements: string[];

  // — FASHION / STYLING —
  fashionStyle: string;
  signatureLooks: string[];
  accessories: string[];
  hairAndGrooming: string;

  // — AUDIENCE & MARKETING —
  targetAudience: string;
  fanbaseName: string;
  /** Brand voice / how the artist communicates. */
  toneOfVoice: string;
  contentPillars: string[];
  slogans: string[];
}

/**
 * CHARACTER SHEET — the immutable visual identity anchor.
 * Generated once from the artist's photo + profile, it locks the face / body /
 * wardrobe so EVERY downstream generation (merch, holograms, social posters,
 * music videos, fashion) renders the SAME person. Stored inside the brand
 * profile so the existing cross-module brand bus propagates it everywhere.
 */
export interface BrandCharacterSheet {
  /** Immutable face+body identity anchor (<40 words) injected into prompts. */
  identityLock: string;
  signatureOutfit?: string;
  headStudyNotes?: string;
  /** 4-6 signature wardrobe/brand colors. */
  signaturePalette?: string[];
  wardrobe?: Array<{ name: string; description: string }>;
  props?: Array<{ name: string; description: string }>;
  materials?: string[];
  vibeKeywords?: string[];
  /** Canonical model-sheet views (turnaround / head study / portrait). */
  views: Array<{ key: string; label: string; category: string; url: string }>;
  /** Composed DENXEL-style model-sheet poster (optional). */
  posterUrl?: string;
  /** Strongest single identity image for quick image-to-image (head front / portrait). */
  primaryRef?: string;
  generatedAt: string;
  version: number;
}

export interface ArtistBrandProfile {
  /** Postgres user id */
  artistId: number | string;
  artistName: string;
  genre: string;

  // — VISUAL DNA —
  /** Hex color triad — primary, secondary, accent */
  brandColors: {
    primary: string;   // dominant color
    secondary: string; // support color
    accent: string;    // highlight pop color
  };
  /** Typography description for prompt injection */
  typography: {
    style: string;     // e.g. "bold custom display sans, slightly distressed"
    weight: string;    // e.g. "extra-bold, condensed"
    mood: string;      // e.g. "aggressive, modern, chrome"
  };
  /** Compact visual-style descriptor used as backbone of every prompt */
  visualStyle: string;
  /** Recurring iconographic motifs the brand uses */
  motifs: string[];
  /** Mood adjectives — energy, atmosphere, attitude */
  moodKeywords: string[];
  /** Free-form signature elements (textures, finishes, signature shapes) */
  signatureElements: string;

  // — RICH ARTIST IDENTITY (sound, voice, performance, fashion, persona) —
  /** Full artist-identity dossier. Optional for back-compat with old docs. */
  identity?: ArtistIdentity;

  // — REFERENCES —
  /** URLs that act as visual ground-truth for image-to-image generation */
  referenceImages: {
    artistPhoto?: string;
    masterLogo?: string;
    additional?: string[];
  };

  /** Locked visual identity (turnaround + head study + wardrobe). Optional. */
  characterSheet?: BrandCharacterSheet;

  // — PROMPT BUILDING BLOCKS —
  /** Pre-composed prompt prefix used in every generation */
  promptPrefix: string;
  /** Things the model must AVOID for this brand */
  negativePrompt: string;

  // — META —
  generatedAt: string;
  source: 'gemini' | 'openai' | 'manual' | 'fallback';
  version: number;
}

// ─────────────────────────────────────────────────────────────
// GEMINI CLIENT
// ─────────────────────────────────────────────────────────────

const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY2,
].filter((k): k is string => !!k && k.length > 0);

const geminiClients = apiKeys.map((key) => new GoogleGenAI({ apiKey: key }));

// ─────────────────────────────────────────────────────────────
// GENRE FALLBACK PALETTES (usado si Gemini falla)
// ─────────────────────────────────────────────────────────────

const GENRE_FALLBACK_DNA: Record<string, Partial<ArtistBrandProfile>> = {
  'pop':       { brandColors: { primary: '#FF3D7F', secondary: '#FFD93D', accent: '#FFFFFF' }, visualStyle: 'colorful y2k pop aesthetic, glossy gradients, playful geometric shapes', motifs: ['stars', 'hearts', 'sparkles', 'bubble shapes'], moodKeywords: ['vibrant', 'playful', 'modern', 'glossy'] },
  'hip-hop':   { brandColors: { primary: '#000000', secondary: '#D4AF37', accent: '#FFFFFF' }, visualStyle: 'urban streetwear bold, gold-on-black, sharp graffiti-influenced lines', motifs: ['chains', 'crowns', 'graffiti tags', 'spray drips'], moodKeywords: ['bold', 'urban', 'confident', 'street'] },
  'rap':       { brandColors: { primary: '#0A0A0A', secondary: '#C0C0C0', accent: '#FF0040' }, visualStyle: 'dark trap aesthetic with chrome and blood-red highlights, gothic display typography', motifs: ['barbed wire', 'roses', 'broken glass', 'chrome'], moodKeywords: ['dark', 'aggressive', 'raw', 'underground'] },
  'trap':      { brandColors: { primary: '#1A0033', secondary: '#7F00FF', accent: '#00FFE0' }, visualStyle: 'cyber distorted typography, glitch art, neon purple and cyan, retro CRT artifacts', motifs: ['glitch bars', 'static', 'cassette tapes', 'broken circuits'], moodKeywords: ['cyber', 'distorted', 'futuristic', 'edgy'] },
  'electronic':{ brandColors: { primary: '#0D1B2A', secondary: '#00FFFF', accent: '#FF00FF' }, visualStyle: 'synthwave grid futurism, neon line-art, 80s sci-fi influence', motifs: ['grids', 'sound waves', 'mountains', 'sun'], moodKeywords: ['futuristic', 'neon', 'synthetic', 'energetic'] },
  'edm':       { brandColors: { primary: '#0D0D0D', secondary: '#39FF14', accent: '#FF1493' }, visualStyle: 'rave neon emblem, vibrant gradient, abstract sound waves, festival energy', motifs: ['lightning', 'sound waves', 'lasers', 'crowd silhouettes'], moodKeywords: ['energetic', 'electric', 'euphoric', 'pulsing'] },
  'rock':      { brandColors: { primary: '#1A1A1A', secondary: '#B22222', accent: '#FFFFFF' }, visualStyle: 'distressed vintage rock, grunge texture, hand-drawn typography, gritty', motifs: ['skulls', 'wings', 'guitars', 'flames'], moodKeywords: ['rebellious', 'gritty', 'raw', 'classic'] },
  'metal':     { brandColors: { primary: '#000000', secondary: '#8B0000', accent: '#A0A0A0' }, visualStyle: 'gothic metal logo, sharp angular blackletter, ornate occult emblem', motifs: ['skulls', 'pentagrams', 'thorns', 'serpents'], moodKeywords: ['heavy', 'dark', 'ornate', 'powerful'] },
  'indie':     { brandColors: { primary: '#3D2C2C', secondary: '#D4B896', accent: '#7F9F80' }, visualStyle: 'hand-drawn illustration, muted earth tones, vintage botanical, lo-fi feel', motifs: ['moons', 'mountains', 'plants', 'birds'], moodKeywords: ['nostalgic', 'organic', 'introspective', 'warm'] },
  'r&b':       { brandColors: { primary: '#1A0F0A', secondary: '#D4AF37', accent: '#F5E6D3' }, visualStyle: 'elegant serif art-deco, gold on cream, smooth flowing curves', motifs: ['art-deco frames', 'roses', 'silk drapes', 'crescents'], moodKeywords: ['elegant', 'sensual', 'sophisticated', 'smooth'] },
  'soul':      { brandColors: { primary: '#3D1F0A', secondary: '#D49A4F', accent: '#F5DCB3' }, visualStyle: 'warm 70s vintage typography, sepia tones, retro emblem style', motifs: ['vinyl records', 'sun rays', 'flowers', 'afros'], moodKeywords: ['warm', 'soulful', 'vintage', 'emotive'] },
  'jazz':      { brandColors: { primary: '#0A0A0A', secondary: '#D4AF37', accent: '#8B0000' }, visualStyle: 'classic art-deco emblem, gold and black, geometric sunburst, vintage poster', motifs: ['saxophones', 'piano keys', 'sunbursts', 'martini glasses'], moodKeywords: ['sophisticated', 'classic', 'timeless', 'smooth'] },
  'latin':     { brandColors: { primary: '#FF6B35', secondary: '#FFD93D', accent: '#06A77D' }, visualStyle: 'tropical bold typography, vibrant earth + jewel tones, palm and sun motifs', motifs: ['palms', 'sun', 'flowers', 'maracas'], moodKeywords: ['vibrant', 'passionate', 'tropical', 'festive'] },
  'reggaeton': { brandColors: { primary: '#1A0033', secondary: '#FF1493', accent: '#39FF14' }, visualStyle: 'urban latin emblem, neon green and pink, bold display font, party energy', motifs: ['palm trees', 'fire', 'crowns', 'lightning'], moodKeywords: ['urban', 'flashy', 'energetic', 'sensual'] },
  'reggae':    { brandColors: { primary: '#FF0000', secondary: '#FFD700', accent: '#00A86B' }, visualStyle: 'rasta tri-color emblem, hand-drawn lion or palm, organic feel', motifs: ['lions', 'palms', 'cannabis leaves', 'sunshine'], moodKeywords: ['relaxed', 'spiritual', 'warm', 'organic'] },
  'country':   { brandColors: { primary: '#3D2817', secondary: '#D4A574', accent: '#8B0000' }, visualStyle: 'western typography, brown and tan, vintage badge with rope and stars', motifs: ['boots', 'stars', 'horseshoes', 'wheat'], moodKeywords: ['rugged', 'authentic', 'rural', 'timeless'] },
  'folk':      { brandColors: { primary: '#3D2C2C', secondary: '#A89F7B', accent: '#5C7A4A' }, visualStyle: 'minimalist line-art, earthy palette, mountain or feather motif, hand-rendered', motifs: ['mountains', 'feathers', 'rivers', 'stars'], moodKeywords: ['serene', 'natural', 'introspective', 'humble'] },
  'classical': { brandColors: { primary: '#0A0A0A', secondary: '#D4AF37', accent: '#F5F5DC' }, visualStyle: 'elegant serif monogram, gold leaf, ornate filigree frame, timeless', motifs: ['laurels', 'columns', 'instruments', 'scrolls'], moodKeywords: ['elegant', 'refined', 'timeless', 'noble'] },
  'k-pop':     { brandColors: { primary: '#FFB6E1', secondary: '#A0E7E5', accent: '#FFFFFF' }, visualStyle: 'kawaii pastel emblem, glitter and stars, soft holographic gradients', motifs: ['stars', 'hearts', 'sparkles', 'rainbows'], moodKeywords: ['cute', 'dreamy', 'pastel', 'energetic'] },
  'bolero':    { brandColors: { primary: '#1A0E08', secondary: '#D4A574', accent: '#5C7A8A' }, visualStyle: 'vintage latin elegance, sepia and brass tones, art-deco lettering, romantic poster aesthetic', motifs: ['palms', 'guitars', 'crescent moon', 'art-deco frames'], moodKeywords: ['romantic', 'vintage', 'elegant', 'nocturnal'] },
  'tropical':  { brandColors: { primary: '#0E3B2E', secondary: '#D49A4F', accent: '#F5DCB3' }, visualStyle: 'tropical retro elegance, jewel + earth tones, vintage travel-poster aesthetic', motifs: ['palms', 'sun', 'flowers', 'flamingos'], moodKeywords: ['warm', 'tropical', 'retro', 'sophisticated'] },
  'editorial': { brandColors: { primary: '#0F0F12', secondary: '#D9D2C5', accent: '#A47148' }, visualStyle: 'minimalist editorial fashion aesthetic, neutral premium palette, refined typography', motifs: ['minimal lines', 'circles', 'serifs', 'frames'], moodKeywords: ['minimal', 'premium', 'editorial', 'timeless'] },
};

// Genre aliases (Spanish / common variants -> canonical key)
const GENRE_ALIASES: Record<string, string> = {
  'bolero': 'bolero',
  'son': 'tropical',
  'salsa': 'tropical',
  'merengue': 'tropical',
  'bachata': 'latin',
  'cumbia': 'latin',
  'tango': 'jazz',
  'urbano': 'reggaeton',
  'trap-latino': 'reggaeton',
  'pop-latino': 'latin',
  'reggaetón': 'reggaeton',
  'hip hop': 'hip-hop',
  'kpop': 'k-pop',
};

function getFallbackDna(genre: string): Partial<ArtistBrandProfile> {
  const key = (genre || '').toLowerCase().trim();
  const canonical = GENRE_ALIASES[key] || key;
  // Default to neutral editorial fallback (NOT pop) when genre is unknown to avoid
  // injecting pink/y2k/hearts/sparkles into artists that don't belong to that aesthetic.
  return GENRE_FALLBACK_DNA[canonical] || GENRE_FALLBACK_DNA['editorial'];
}

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────

function buildPromptPrefix(p: Pick<ArtistBrandProfile, 'artistName' | 'visualStyle' | 'brandColors' | 'moodKeywords'>): string {
  return `Brand identity for music artist "${p.artistName}". ${p.visualStyle}. Color palette: primary ${p.brandColors.primary}, secondary ${p.brandColors.secondary}, accent ${p.brandColors.accent}. Mood: ${p.moodKeywords.join(', ')}.`;
}

const DEFAULT_NEGATIVE = 'no photographic faces glued onto products, no celebrity look-alikes, no random stock photography, no watermarks, no extra fingers, no distorted text, no off-brand colors';

/**
 * Minimal genre-based identity used when the AI doesn't return an identity block.
 * Keeps the JSON complete (never empty) without inventing fake specifics.
 */
function buildFallbackIdentity(input: {
  artistName: string;
  genre: string;
  bio?: string;
  fallback: Partial<ArtistBrandProfile>;
}): ArtistIdentity {
  const moods = (input.fallback.moodKeywords as string[]) || ['bold', 'modern'];
  const genre = input.genre || 'music';
  return {
    tagline: `${input.artistName} — ${moods.slice(0, 2).join(', ')} ${genre}.`,
    persona: `A ${moods[0]} ${genre} artist with a distinct point of view.`,
    backstory: input.bio?.slice(0, 280) || `${input.artistName} is building a singular voice in ${genre}.`,
    origin: '',
    era: 'contemporary',
    languages: [],
    values: ['authenticity', 'craft', 'connection'],
    primaryGenre: genre,
    subGenres: [],
    influences: [],
    similarArtists: [],
    signatureSound: `${moods.join(', ')} ${genre} production.`,
    instrumentation: [],
    tempoRange: '',
    vocalStyle: '',
    lyricalThemes: [],
    stagePresence: `${moods[0]} and magnetic.`,
    performanceStyle: '',
    liveShowElements: [],
    fashionStyle: input.fallback.visualStyle || '',
    signatureLooks: [],
    accessories: [],
    hairAndGrooming: '',
    targetAudience: `Fans of ${genre}.`,
    fanbaseName: '',
    toneOfVoice: `${moods[0]}, confident, authentic.`,
    contentPillars: ['music releases', 'behind the scenes', 'live performances'],
    slogans: [],
  };
}

// ─────────────────────────────────────────────────────────────
// GEMINI GENERATION
// ─────────────────────────────────────────────────────────────

const BRAND_SYSTEM_PROMPT = `You are a professional art director AND music brand strategist designing a permanent, complete identity for a music artist. Output STRICT JSON ONLY (no markdown, no commentary). Schema:
{
  "brandColors": { "primary": "#RRGGBB", "secondary": "#RRGGBB", "accent": "#RRGGBB" },
  "typography": { "style": "...", "weight": "...", "mood": "..." },
  "visualStyle": "one rich descriptive sentence that captures the brand vibe (vector flat / chrome / grunge / etc.)",
  "motifs": ["motif1", "motif2", "motif3", "motif4"],
  "moodKeywords": ["adjective1", "adjective2", "adjective3", "adjective4"],
  "signatureElements": "free-form description of recurring textures, shapes, finishes that should appear across all merch",
  "identity": {
    "tagline": "one-line artist positioning statement",
    "persona": "personality & character — how the artist comes across on and off stage",
    "backstory": "2-3 sentence origin story / lore that gives the artist depth",
    "origin": "city, country",
    "era": "sound era, e.g. 'contemporary 2020s with retro 80s nods'",
    "languages": ["language1", "language2"],
    "values": ["value1", "value2", "value3"],
    "primaryGenre": "main genre",
    "subGenres": ["subgenre1", "subgenre2", "subgenre3"],
    "influences": ["artist1", "artist2", "artist3", "artist4"],
    "similarArtists": ["riyl1", "riyl2", "riyl3"],
    "signatureSound": "description of the sonic palette / production signature",
    "instrumentation": ["instrument/production1", "instrument2", "instrument3"],
    "tempoRange": "e.g. '90-115 BPM'",
    "vocalStyle": "vocal range, texture and delivery characteristics",
    "lyricalThemes": ["theme1", "theme2", "theme3"],
    "stagePresence": "how they command a stage",
    "performanceStyle": "choreography / energy / band setup description",
    "liveShowElements": ["element1", "element2", "element3"],
    "fashionStyle": "overall wardrobe aesthetic",
    "signatureLooks": ["look1", "look2", "look3"],
    "accessories": ["accessory1", "accessory2"],
    "hairAndGrooming": "hair and grooming signature",
    "targetAudience": "core demographic + psychographic description",
    "fanbaseName": "an evocative fanbase nickname",
    "toneOfVoice": "how the artist communicates on social / in copy",
    "contentPillars": ["pillar1", "pillar2", "pillar3"],
    "slogans": ["slogan1", "slogan2"]
  }
}

Constraints:
- Colors must be valid 6-char hex.
- Avoid generic "orange and black" unless the genre demands it.
- Motifs must be CONCRETE visual objects (not adjectives).
- Choose a palette that fits the genre AND feels iconic, not generic.
- The visualStyle must be specific enough that two designers reading it would produce coherent results.
- The "identity" block must be SPECIFIC and believable for THIS artist (use the name, genre and bio). Influences and similarArtists must be REAL artists that fit the genre. Never leave fields empty.`;

function buildBrandUserPrompt(input: { artistName: string; genre: string; bio?: string }): string {
  return `Artist name: "${input.artistName}"
Genre: ${input.genre}
${input.bio ? `Bio / context: ${input.bio}` : ''}

Design their permanent brand DNA now. Return ONLY the JSON object.`;
}

async function generateProfileWithGemini(input: {
  artistName: string;
  genre: string;
  bio?: string;
  artistImageUrl?: string;
}): Promise<Partial<ArtistBrandProfile> | null> {
  if (geminiClients.length === 0) {
    console.warn('[BrandProfile] No Gemini API keys configured — trying OpenAI');
    return null;
  }

  const systemPrompt = BRAND_SYSTEM_PROMPT;
  const userPrompt = buildBrandUserPrompt(input);

  for (let i = 0; i < geminiClients.length; i++) {
    try {
      const client = geminiClients[i];
      const response: any = await Promise.race([
        client.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
          ],
        } as any),
        new Promise((_, rej) => setTimeout(() => rej(new Error('gemini timeout')), 30000)),
      ]);

      const text: string =
        response?.text ||
        response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        '';
      if (!text) continue;

      // strip markdown fences if present
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) continue;
      const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));

      // Validate minimum shape
      if (!parsed.brandColors?.primary || !parsed.visualStyle) continue;
      return parsed as Partial<ArtistBrandProfile>;
    } catch (err: any) {
      console.warn(`[BrandProfile] Gemini key ${i + 1} failed:`, err?.message || err);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// OPENAI GENERATION (fallback when Gemini is unavailable)
// ─────────────────────────────────────────────────────────────

async function generateProfileWithOpenAI(input: {
  artistName: string;
  genre: string;
  bio?: string;
  artistImageUrl?: string;
}): Promise<Partial<ArtistBrandProfile> | null> {
  const apiKey = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.warn('[BrandProfile] No OpenAI API key configured — using fallback DNA');
    return null;
  }

  const hasImage = !!input.artistImageUrl && /^https?:\/\//i.test(input.artistImageUrl);

  try {
    const openai = new OpenAI({ apiKey });

    // The artist's profile photo is the GROUND TRUTH for the visual identity.
    // When present, send it to gpt-4o vision so colors/style come FROM the image.
    const userContent: any = hasImage
      ? [
          {
            type: 'text',
            text:
              `${buildBrandUserPrompt(input)}\n\n` +
              `IMPORTANT: The attached image is this artist's official profile photo. ` +
              `It is the PRIMARY SOURCE OF TRUTH for the visual identity. ` +
              `Derive brandColors DIRECTLY from the dominant colors, lighting and wardrobe seen in the photo. ` +
              `Derive visualStyle, typography mood, motifs, signatureElements, fashionStyle, signatureLooks, accessories and hairAndGrooming from what is ACTUALLY visible in the image (setting, outfit, color grading, mood). ` +
              `Do NOT invent a palette that contradicts the photo. Match the photo's real aesthetic.`,
          },
          { type: 'image_url', image_url: { url: input.artistImageUrl, detail: 'low' } },
        ]
      : buildBrandUserPrompt(input);

    const response: any = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        temperature: 0.7,
        messages: [
          { role: 'system', content: BRAND_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('openai timeout')), hasImage ? 60000 : 40000)),
    ]);

    const text: string = response?.choices?.[0]?.message?.content || '';
    if (!text) return null;

    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd < 0) return null;
    const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));

    if (!parsed.brandColors?.primary || !parsed.visualStyle) return null;
    return parsed as Partial<ArtistBrandProfile>;
  } catch (err: any) {
    console.warn('[BrandProfile] OpenAI generation failed:', err?.message || err);
    // If the vision request failed (bad image url, etc.), retry text-only once.
    if (hasImage) {
      try {
        const openai = new OpenAI({ apiKey });
        const response: any = await openai.chat.completions.create({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          temperature: 0.7,
          messages: [
            { role: 'system', content: BRAND_SYSTEM_PROMPT },
            { role: 'user', content: buildBrandUserPrompt(input) },
          ],
        });
        const text: string = response?.choices?.[0]?.message?.content || '';
        const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonStart = clean.indexOf('{');
        const jsonEnd = clean.lastIndexOf('}');
        if (jsonStart < 0 || jsonEnd < 0) return null;
        const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
        if (!parsed.brandColors?.primary || !parsed.visualStyle) return null;
        return parsed as Partial<ArtistBrandProfile>;
      } catch (err2: any) {
        console.warn('[BrandProfile] OpenAI text-only retry failed:', err2?.message || err2);
      }
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

/**
 * Generate (and persist) a fresh ArtistBrandProfile.
 * If Gemini fails, falls back to genre-based DNA.
 */
export async function generateBrandProfile(input: {
  artistId: number | string;
  artistName: string;
  genre: string;
  bio?: string;
  artistImageUrl?: string;
  masterDesignUrl?: string;
}): Promise<ArtistBrandProfile> {
  const genre = (input.genre || 'editorial').toLowerCase();
  const fallback = getFallbackDna(genre);

  let aiSource: 'gemini' | 'openai' | null = null;
  let aiData = await generateProfileWithGemini({
    artistName: input.artistName,
    genre,
    bio: input.bio,
    artistImageUrl: input.artistImageUrl,
  });
  if (aiData) {
    aiSource = 'gemini';
  } else {
    // Gemini unavailable/failed — try OpenAI before falling back to genre presets
    aiData = await generateProfileWithOpenAI({
      artistName: input.artistName,
      genre,
      bio: input.bio,
      artistImageUrl: input.artistImageUrl,
    });
    if (aiData) aiSource = 'openai';
  }

  const dna = aiData || fallback;

  const profile: ArtistBrandProfile = {
    artistId: input.artistId,
    artistName: input.artistName,
    genre,
    brandColors: dna.brandColors || (fallback.brandColors as ArtistBrandProfile['brandColors']),
    typography: dna.typography || {
      style: 'bold custom display typography',
      weight: 'extra-bold',
      mood: (fallback.moodKeywords || ['modern'])[0],
    },
    visualStyle: dna.visualStyle || (fallback.visualStyle as string),
    motifs: dna.motifs && dna.motifs.length ? dna.motifs : (fallback.motifs as string[]),
    moodKeywords: dna.moodKeywords && dna.moodKeywords.length ? dna.moodKeywords : (fallback.moodKeywords as string[]),
    signatureElements: dna.signatureElements || `Recurring use of ${(fallback.motifs as string[])?.slice(0, 2).join(' and ')}, anchored on ${fallback.brandColors?.primary} backgrounds with ${fallback.brandColors?.accent} pops.`,
    identity: (dna as Partial<ArtistBrandProfile>).identity || buildFallbackIdentity({ artistName: input.artistName, genre, bio: input.bio, fallback }),
    referenceImages: {
      artistPhoto: input.artistImageUrl || '',
      masterLogo: input.masterDesignUrl || '',
    },
    promptPrefix: '',
    negativePrompt: DEFAULT_NEGATIVE,
    generatedAt: new Date().toISOString(),
    source: aiSource || 'fallback',
    version: 1,
  };
  profile.promptPrefix = buildPromptPrefix(profile);

  // Persist to Firestore (best-effort)
  try {
    const { db: firestoreDb } = await import('../firebase');
    if (firestoreDb) {
      await firestoreDb
        .collection('artistBrandProfiles')
        .doc(String(input.artistId))
        .set(profile, { merge: true });
      console.log(`[BrandProfile] ✅ Saved profile for artist ${input.artistId} (${input.artistName})`);
    }
  } catch (err: any) {
    console.warn('[BrandProfile] Firestore save failed:', err?.message || err);
  }

  return profile;
}

/**
 * Read a stored ArtistBrandProfile (or null if not generated yet).
 */
export async function loadBrandProfile(artistId: number | string): Promise<ArtistBrandProfile | null> {
  try {
    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return null;
    const snap = await firestoreDb
      .collection('artistBrandProfiles')
      .doc(String(artistId))
      .get();
    if (!snap.exists) return null;
    return snap.data() as ArtistBrandProfile;
  } catch (err: any) {
    console.warn('[BrandProfile] load failed:', err?.message || err);
    return null;
  }
}

/**
 * Get the existing profile or generate a new one if absent.
 * Idempotent — call this freely before any image generation.
 */
export async function getOrCreateBrandProfile(input: {
  artistId: number | string;
  artistName: string;
  genre: string;
  bio?: string;
  artistImageUrl?: string;
  masterDesignUrl?: string;
  forceRegenerate?: boolean;
}): Promise<ArtistBrandProfile> {
  if (!input.forceRegenerate) {
    const existing = await loadBrandProfile(input.artistId);
    if (existing) {
      // Refresh reference images if newer master logo / photo provided
      const needRefRefresh =
        (input.artistImageUrl && existing.referenceImages?.artistPhoto !== input.artistImageUrl) ||
        (input.masterDesignUrl && existing.referenceImages?.masterLogo !== input.masterDesignUrl);
      if (needRefRefresh) {
        existing.referenceImages = {
          ...existing.referenceImages,
          artistPhoto: input.artistImageUrl || existing.referenceImages?.artistPhoto,
          masterLogo: input.masterDesignUrl || existing.referenceImages?.masterLogo,
        };
        try {
          const { db: firestoreDb } = await import('../firebase');
          if (firestoreDb) {
            await firestoreDb
              .collection('artistBrandProfiles')
              .doc(String(input.artistId))
              .set({ referenceImages: existing.referenceImages }, { merge: true });
          }
        } catch {}
      }
      return existing;
    }
  }
  return generateBrandProfile(input);
}

/**
 * Build a fully-loaded product prompt anchored in the brand DNA.
 * Used by fal-service.generateMerchandiseImage and any other generator
 * that wants brand-coherent output.
 */
export function buildProductPromptFromProfile(
  profile: ArtistBrandProfile,
  productType: string,
  productSpec: string,
): string {
  const motifLine = profile.motifs.length
    ? `Incorporate signature motifs (use 1-2 per product, never all): ${profile.motifs.join(', ')}.`
    : '';
  const typoLine = `Typography: ${profile.typography.style}, ${profile.typography.weight}, mood ${profile.typography.mood}.`;
  return `${profile.promptPrefix}
${productSpec}
${typoLine}
${motifLine}
Signature: ${profile.signatureElements}
The artist's NAME "${profile.artistName}" should appear as part of the printed graphic where appropriate (typography integrated into the design — never as a watermark).
Strict brand coherence: every visual decision (color, motif, typography, mood) must match the brand DNA above. Do NOT improvise off-brand styles.
Negative: ${profile.negativePrompt}.`;
}

/**
 * Returns the array of reference image URLs that should be passed
 * as `image_urls` to multi-reference edit endpoints.
 * Order matters: artist photo first (identity lock), master logo second.
 */
export function getReferenceImageUrls(profile: ArtistBrandProfile, fallbackArtistImage?: string): string[] {
  const refs: string[] = [];
  // Character sheet identity anchor wins (strongest, multi-angle locked likeness).
  const cs = profile.characterSheet;
  if (cs?.primaryRef) refs.push(cs.primaryRef);
  if (profile.referenceImages?.artistPhoto && !refs.includes(profile.referenceImages.artistPhoto)) {
    refs.push(profile.referenceImages.artistPhoto);
  }
  if (profile.referenceImages?.masterLogo) refs.push(profile.referenceImages.masterLogo);
  if (refs.length === 0 && fallbackArtistImage) refs.push(fallbackArtistImage);
  return refs;
}

/**
 * All canonical character-sheet view URLs (turnaround / head / portrait),
 * with the strongest identity anchor first. Empty array when no sheet yet.
 */
export function getCharacterSheetRefs(profile: ArtistBrandProfile | null | undefined): string[] {
  const cs = profile?.characterSheet;
  if (!cs) return [];
  const ordered: string[] = [];
  if (cs.primaryRef) ordered.push(cs.primaryRef);
  for (const v of cs.views || []) {
    if (v?.url && !ordered.includes(v.url)) ordered.push(v.url);
  }
  return ordered;
}

// ─────────────────────────────────────────────────────────────
// CROSS-MODULE BRAND BUS
// ─────────────────────────────────────────────────────────────
// Generic helpers so ANY image/content generator (social posters, song
// covers, news, etc.) can speak the same visual language as the merch engine.
// Single source of truth = the cached ArtistBrandProfile.

/**
 * Compact, generic brand-DNA block injectable into any image prompt.
 * Unlike buildProductPromptFromProfile (merch-specific), this only describes
 * the palette / mood / style so it composes cleanly with scene prompts.
 */
export function buildBrandPromptBlock(profile: ArtistBrandProfile): string {
  const c = profile.brandColors;
  const palette = c ? `primary ${c.primary}, secondary ${c.secondary}, accent ${c.accent}` : '';
  const mood = (profile.moodKeywords || []).join(', ');
  const motifs = (profile.motifs || []).slice(0, 3).join(', ');
  const identityLock = profile.characterSheet?.identityLock?.trim();
  return [
    `BRAND DNA (keep visual identity consistent): ${profile.visualStyle}.`,
    identityLock ? `ARTIST IDENTITY LOCK (the person must match this exactly — never alter face, build or signature look): ${identityLock}.` : '',
    palette ? `On-brand color grading — ${palette}.` : '',
    mood ? `Mood: ${mood}.` : '',
    motifs ? `Subtle signature motifs when natural (do not force, never as logos): ${motifs}.` : '',
  ].filter(Boolean).join(' ');
}

export interface BrandPromptContext {
  profile: ArtistBrandProfile | null;
  /** Ready-to-inject text block (empty string when no profile). */
  promptBlock: string;
  /** Ordered reference image URLs (artist photo first, master logo second). */
  referenceImages: string[];
}

/**
 * Cross-module entry point: resolve an artist's brand DNA for prompt building.
 * - Safe: never throws (returns empty context on failure).
 * - Cheap: reads the Firestore cache by default.
 * - Optional `ensure` generates+caches the profile once if missing (idempotent).
 */
export async function getBrandPromptContext(input: {
  artistId: number | string;
  artistName?: string;
  genre?: string;
  bio?: string;
  artistImageUrl?: string;
  masterDesignUrl?: string;
  /** When true, generate+persist the profile if it does not exist yet. */
  ensure?: boolean;
  /** Fallback reference image (e.g. artist profile photo) if profile has none. */
  fallbackArtistImage?: string;
}): Promise<BrandPromptContext> {
  try {
    let profile: ArtistBrandProfile | null = await loadBrandProfile(input.artistId);
    if (!profile && input.ensure && input.artistName) {
      profile = await getOrCreateBrandProfile({
        artistId: input.artistId,
        artistName: input.artistName,
        genre: input.genre || 'editorial',
        bio: input.bio,
        artistImageUrl: input.artistImageUrl,
        masterDesignUrl: input.masterDesignUrl,
      });
    }
    if (!profile) {
      return {
        profile: null,
        promptBlock: '',
        referenceImages: input.fallbackArtistImage ? [input.fallbackArtistImage] : [],
      };
    }
    return {
      profile,
      promptBlock: buildBrandPromptBlock(profile),
      referenceImages: getReferenceImageUrls(profile, input.fallbackArtistImage),
    };
  } catch (err: any) {
    console.warn('[BrandProfile] getBrandPromptContext failed:', err?.message || err);
    return {
      profile: null,
      promptBlock: '',
      referenceImages: input.fallbackArtistImage ? [input.fallbackArtistImage] : [],
    };
  }
}

/**
 * Persist a generated CHARACTER SHEET into the artist's brand profile.
 * - Ensures the brand profile exists (idempotent).
 * - Stores the full characterSheet block.
 * - Appends the canonical view URLs into referenceImages.additional[] (deduped)
 *   so every existing brand-bus consumer inherits the locked references.
 * Safe: never throws (logs + returns false on failure).
 */
export async function saveCharacterSheetToBrandProfile(
  input: {
    artistId: number | string;
    artistName?: string;
    genre?: string;
    bio?: string;
    artistImageUrl?: string;
    masterDesignUrl?: string;
  },
  sheet: BrandCharacterSheet,
): Promise<boolean> {
  try {
    // Make sure a profile exists before we merge into it.
    await getOrCreateBrandProfile({
      artistId: input.artistId,
      artistName: input.artistName || 'Artist',
      genre: input.genre || 'editorial',
      bio: input.bio,
      artistImageUrl: input.artistImageUrl,
      masterDesignUrl: input.masterDesignUrl,
    });

    const existing = await loadBrandProfile(input.artistId);
    const prevAdditional = existing?.referenceImages?.additional || [];
    const viewUrls = (sheet.views || []).map((v) => v.url).filter(Boolean);
    const additional = Array.from(new Set([...viewUrls, ...prevAdditional])).slice(0, 12);

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) return false;
    await firestoreDb
      .collection('artistBrandProfiles')
      .doc(String(input.artistId))
      .set(
        {
          characterSheet: sheet,
          referenceImages: {
            ...(existing?.referenceImages || {}),
            additional,
          },
        },
        { merge: true },
      );
    return true;
  } catch (err: any) {
    console.warn('[BrandProfile] saveCharacterSheetToBrandProfile failed:', err?.message || err);
    return false;
  }
}