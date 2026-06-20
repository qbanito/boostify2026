/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║               BOOSTIFY  —  MASTERPIECE RULES ENGINE             ║
 * ║  Central DNA for all generative AI modules.                     ║
 * ║  Every image, lyric, and music prompt draws from this file.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   import { buildImageMasterpieceRules, buildLyricMasterpieceRules,
 *            buildAudioMasterpieceRules, VISUAL_DNA } from '../utils/masterpiece-rules';
 */

// ─── Shared types ────────────────────────────────────────────────────────────

export interface VisualDNA {
  dominantColors?: string[];
  symbol?: string;
  aestheticStyle?: string;
  referenceArtist?: string;
  moodKeyword?: string;
}

export interface ArtistContext {
  artistName: string;
  genre?: string | null;
  mood?: string | null;
  songTitle?: string | null;
  biography?: string | null;
  visualDNA?: VisualDNA | null;
}

// ─── GENRE MAPPINGS ──────────────────────────────────────────────────────────

const GENRE_VISUAL_REFS: Record<string, { directors: string; palette: string; symbol: string; era: string }> = {
  'hip-hop':    { directors: 'Hype Williams, Director X', palette: 'deep blacks, gold, neon accents', symbol: 'urban architecture or crown', era: 'contemporary cinematic' },
  'rap':        { directors: 'Cole Bennett, Dave Free',   palette: 'monochrome with single color pop', symbol: 'motion or defiance gesture', era: 'street documentary' },
  'pop':        { directors: 'Joseph Kahn, Dave Meyers',  palette: 'pastel to vivid — high contrast', symbol: 'light flare or mirror', era: 'glossy editorial' },
  'r&b':        { directors: 'Melina Matsoukas, Benny Boom', palette: 'warm golds, browns, silhouettes', symbol: 'golden hour light', era: 'sensual cinematic' },
  'soul':       { directors: 'Anton Corbijn, Mark Romanek',  palette: 'warm analogue film tones', symbol: 'hands or vintage micro', era: '35mm film grain' },
  'rock':       { directors: 'Anton Corbijn, Sam Bayer',     palette: 'desaturated with red or amber', symbol: 'raw texture or debris', era: 'gritty documentary' },
  'metal':      { directors: 'Wayne Isham, Frames',          palette: 'black and cold blue', symbol: 'shattered glass or fire', era: 'dark theatrical' },
  'electronic': { directors: 'Floria Sigismondi, Syndrome', palette: 'neon on black, geometric', symbol: 'circuit or data stream', era: 'futuristic sci-fi' },
  'edm':        { directors: 'Syndrome, Robert Hales',       palette: 'ultra-vivid, strobed', symbol: 'crowd wave or laser grid', era: 'festival panoramic' },
  'indie':      { directors: 'Lance Bangs, Ryan Staake',     palette: 'lo-fi warm tones, grain', symbol: 'empty road or open window', era: 'indie film aesthetic' },
  'folk':       { directors: 'Sophie Muller, Declan Quinn',  palette: 'natural earth tones', symbol: 'landscape or worn hands', era: 'documentary naturalism' },
  'country':    { directors: 'Trey Fanjoy, Roman White',     palette: 'warm sunset, sepia', symbol: 'open road or American flag', era: 'americana cinematic' },
  'jazz':       { directors: 'Matthew Rolston, Victor Skrebneski', palette: 'deep shadow, brass tones', symbol: 'instrument close-up', era: 'classic noir' },
  'classical':  { directors: 'Bruno Monsaingeon',            palette: 'ivory, deep crimson, gold', symbol: 'sheet music or hall', era: 'timeless formal' },
  'latin':      { directors: 'Jessy Terrero, Ethan Lader',   palette: 'rich tropical, vibrant', symbol: 'movement or sunset coast', era: 'vibrant editorial' },
  'reggaeton':  { directors: 'Jessy Terrero, Carlos Perez',  palette: 'neon tropical, deep contrast', symbol: 'city skyline or coast', era: 'high-energy editorial' },
};

const GENRE_LYRIC_REFS: Record<string, { banned: string[]; hook: string; theme: string; production: string }> = {
  'hip-hop':    { banned: ['hustle', 'grind', 'on top', 'making it rain'], hook: 'rhythmic triplet flow, unexpected word reversal', theme: 'duality of struggle and ascent', production: 'boom-bap or trap with room for breath' },
  'pop':        { banned: ['baby', 'oh yeah', 'can\'t stop', 'you complete me'], hook: 'vowel-forward singable melody hook under 6 words', theme: 'universal emotion with specific detail', production: 'verse/pre-chorus/chorus/bridge/outro' },
  'r&b':        { banned: ['love potion', 'night and day', 'soul mate'], hook: 'melismatic phrase that resolves on a major 7th', theme: 'intimate vulnerability with confidence', production: 'slow build with drop chorus' },
  'rock':       { banned: ['breaking free', 'scream and shout', 'this is our time'], hook: 'anthemic vowel scream or resolved power chord phrase', theme: 'identity vs. conformity', production: 'guitar-led verse, explosive chorus' },
  'electronic': { banned: ['dance all night', 'feel alive', 'losing control'], hook: 'repetitive minimal phrase that transforms', theme: 'transcendence through rhythm', production: 'build-drop-breakdown-drop' },
  'indie':      { banned: ['open road', 'lost and found', 'wandering soul'], hook: 'conversational turn of phrase, subverts expectation', theme: 'mundane detail revealing deep meaning', production: 'restrained verse, unexpected bridge' },
  'folk':       { banned: ['rivers flow', 'winds blow', 'heart of gold'], hook: 'narrative scene painted in one line', theme: 'place + memory + loss', production: 'verse/chorus/verse/chorus/outro only' },
  'latin':      { banned: ['corazón', 'bailar toda la noche', 'el amor'], hook: 'dance-ready phrase under 4 words, Spanish-English blend', theme: 'desire, celebration, identity', production: 'intro hook, verse, coro, verse, coro, bridge, coro' },
};

const GENRE_AUDIO_REFS: Record<string, { producer: string; bpm: string; key: string; texture: string; drop: string }> = {
  'hip-hop':    { producer: 'Metro Boomin, Kanye West', bpm: '80-100 bpm', key: 'minor', texture: 'sampled soul under 808 sub-bass', drop: 'first beat drop at bar 4 or 8' },
  'pop':        { producer: 'Max Martin, Greg Kurstin', bpm: '90-130 bpm', key: 'major', texture: 'layered synths, live drums, voice doubles', drop: 'full chorus hit with snare reverb wash' },
  'r&b':        { producer: 'No I.D., Timbaland', bpm: '65-95 bpm', key: 'minor 7th', texture: 'warm pads, snap percussion, intimate vocal space', drop: 'stripped verse building to lush chorus' },
  'electronic': { producer: 'Aphex Twin, Four Tet', bpm: '128-145 bpm', key: 'any, with modulation', texture: 'evolving synth layers, side-chained bass', drop: 'main drop at 32 or 64 bars in' },
  'rock':       { producer: 'Rick Rubin, Butch Vig', bpm: '100-160 bpm', key: 'power chords E/A/D', texture: 'room-mic drums, overdriven guitar, driven bass', drop: 'chorus explosion after quiet pre-chorus' },
  'folk':       { producer: 'T Bone Burnett, Joe Henry', bpm: '70-100 bpm', key: 'D or G major', texture: 'acoustic guitar, upright bass, minimal reverb', drop: 'key change or stripped silence before final chorus' },
  'latin':      { producer: 'Tainy, Sky Rompiendo', bpm: '90-115 bpm', key: 'minor or major', texture: 'perreo rhythm, dembow, brass stabs', drop: 'coro explosion with full percussion' },
};

// ─── GENRE HELPERS ───────────────────────────────────────────────────────────

function normalizeGenre(genre?: string | null): string {
  if (!genre) return 'pop';
  const g = genre.toLowerCase().trim();
  for (const key of Object.keys(GENRE_VISUAL_REFS)) {
    if (g.includes(key)) return key;
  }
  return 'pop';
}

// ─── 1. VISUAL MASTERPIECE RULES ─────────────────────────────────────────────

/**
 * Returns a rich visual rules block to inject into image generation prompts.
 * Covers composition, color theory, symbol, permanence, and zero-noise rules.
 *
 * @param ctx          Artist + song context
 * @param useCase      How the image will be used (affects aspect ratio guidance)
 */
export function buildImageMasterpieceRules(
  ctx: ArtistContext,
  useCase: 'album-cover' | 'instagram-post' | 'instagram-carousel' | 'merch-logo' | 'merch-product' | 'poster' = 'album-cover',
): string {
  const genre = normalizeGenre(ctx.genre);
  const ref = GENRE_VISUAL_REFS[genre] || GENRE_VISUAL_REFS['pop'];
  const dna = ctx.visualDNA;

  const compositionRule = useCase === 'instagram-carousel'
    ? 'Rule of thirds with LEFT-HEAVY balance so text overlays fit right side. Consistent depth of field across all slides.'
    : 'Strict rule of thirds. Single primary focal point. Intentional depth of field creates foreground/midground/background separation.';

  const colorRule = dna?.dominantColors?.length
    ? `Color palette inherited from artist DNA: ${dna.dominantColors.join(', ')}. No more than 3 dominant hues. Contrast ratio ≥ 7:1.`
    : `Genre-authentic palette: ${ref.palette}. Limit to 3-4 dominant hues. Emotional color: single hue carries the song's core feeling.`;

  const symbolRule = dna?.symbol
    ? `Central symbol: "${dna.symbol}" — this is the artist's visual signature, include it as a recurring motif.`
    : `Include ONE symbolic element that visually encodes the song/artist theme. The symbol must be universal yet specific — Storm Thorgerson level of conceptual clarity.`;

  const permanenceRule = `Permanence test: this image must feel relevant in 20 years. Directorial reference: ${ref.directors}. Era aesthetic: ${ref.era}.`;

  const useCaseExtra = useCase === 'album-cover'
    ? 'Format: perfect 1:1 square. Designed for vinyl LP and digital streaming thumbnail. Must read at 300x300px AND 3000x3000px.'
    : useCase === 'instagram-post'
    ? 'Format: Instagram square 1:1 or portrait 4:5. Bold visual hook visible in feed thumbnail. Designed to stop scroll.'
    : useCase === 'instagram-carousel'
    ? 'Format: consistent 1:1 across all slides. Slide 1 is the hook — most arresting image. Uniform color treatment ties all slides.'
    : useCase === 'merch-logo'
    ? 'Format: emblem must be legible at 1 inch on a t-shirt AND readable at billboard scale. Clean, timeless logomark. No thin strokes.'
    : useCase === 'merch-product'
    ? 'Format: design placed on product area. Composition centered with breathing room. Works on light and dark fabric.'
    : 'Format: 2:3 portrait (film poster ratio). Key visual in upper 2/3. Title area in lower 1/3.';

  return [
    `[VISUAL MASTERPIECE RULES — ${useCase.toUpperCase()}]`,
    `COMPOSITION: ${compositionRule}`,
    `COLOR: ${colorRule}`,
    `SYMBOL: ${symbolRule}`,
    `PERMANENCE: ${permanenceRule}`,
    `USE CASE: ${useCaseExtra}`,
    `ZERO NOISE: No text, no logos, no watermarks, no stock-photo poses, no artificial HDR saturation, no lens flare clichés, no generic studio white backgrounds unless minimalism is the concept.`,
    `CRAFT LEVEL: This must be portfolio-worthy. Think Anton Corbijn for rock, Nick Knight for editorial, Annie Leibovitz for portraiture, Basquiat/Warhol for art-direction boldness. Elevate beyond "professional photo" into "iconic image".`,
  ].join('\n');
}

// ─── 2. LYRIC MASTERPIECE RULES ──────────────────────────────────────────────

/**
 * Returns a lyric craftsmanship rules block to inject into song-writing prompts.
 * Covers first-line hook, central metaphor, universality, melodic hook, banned clichés.
 */
export function buildLyricMasterpieceRules(
  ctx: ArtistContext,
  mode: 'full-song' | 'chorus-only' | 'verse-only' | 'rewrite' = 'full-song',
): string {
  const genre = normalizeGenre(ctx.genre);
  const ref = GENRE_LYRIC_REFS[genre] || GENRE_LYRIC_REFS['pop'];

  const bannedList = ref.banned.map(b => `"${b}"`).join(', ');

  const modeRule = mode === 'chorus-only'
    ? `CHORUS RULES: This is the emotional peak. Must be singable after 3 listens. Under 20 words ideally. Hook technique: ${ref.hook}.`
    : mode === 'verse-only'
    ? `VERSE RULES: Set the scene, advance the narrative, earn the chorus emotionally. Every line must either introduce new information or deepen existing emotion.`
    : mode === 'rewrite'
    ? `REWRITE RULES: Honor every line the human wrote. Add only what serves. Remove nothing that has personal DNA. Improve meter, imagery, and resonance — never change the emotional truth.`
    : `FULL SONG RULES: Structure must be ${ref.production}. Every section has one job — execute it with precision.`;

  return [
    `[LYRIC MASTERPIECE RULES — ${mode.toUpperCase()}]`,
    `FIRST LINE: Must capture attention in under 5 words. Test: does this line make the listener lean in? Examples of first-line mastery: "It was the best of times" level of immediate world-building.`,
    `CENTRAL METAPHOR: ONE sustained metaphor runs through the entire song. It must be unexpected yet immediately understood (e.g., grief as a slow flood, fame as a costume you can't remove).`,
    `UNIVERSALITY: The theme must be personally specific yet universally relatable. The more specific the detail, the more universal the resonance.`,
    `MELODIC HOOK: ${ref.hook}. The chorus phrase must be tarareable — if you can't hum it, rewrite it.`,
    `EMOTIONAL ARC: The song must have ONE moment of transformation or revelation — "the turn" where something shifts. Place it in the bridge or pre-chorus.`,
    `BANNED CLICHÉS for ${genre}: ${bannedList}. These are forbidden. Finding the original phrase is the work.`,
    `THEME DIRECTION: ${ref.theme}`,
    `MODE RULES: ${modeRule}`,
    `CRAFT LEVEL: Think Joni Mitchell's specificity, Dylan's imagery, Kendrick's narrative layers, Sondheim's structural precision. Every word earns its place.`,
  ].join('\n');
}

// ─── 3. AUDIO MASTERPIECE RULES ──────────────────────────────────────────────

/**
 * Returns audio production rules to inject into music generation prompts.
 * Covers structure, dynamic range, emotional drop, and production references.
 */
export function buildAudioMasterpieceRules(
  ctx: ArtistContext,
  style: 'full-track' | 'instrumental' | 'ambient' = 'full-track',
): string {
  const genre = normalizeGenre(ctx.genre);
  const ref = GENRE_AUDIO_REFS[genre] || GENRE_AUDIO_REFS['pop'];

  const styleRule = style === 'instrumental'
    ? 'No vocals. Melody carried by lead instrument. Dynamics replace lyrical arc.'
    : style === 'ambient'
    ? 'Minimal percussion. Texture-forward. Evolves rather than resolves.'
    : `Full production. Vocal-forward mix. Clear A-section, B-section, peak-section structure.`;

  return [
    `[AUDIO MASTERPIECE RULES — ${style.toUpperCase()}]`,
    `STRUCTURE: ${ref.production || 'verse/pre-chorus/chorus/verse/chorus/bridge/chorus/outro'}. Each section has a distinct sonic identity — listener must feel where they are.`,
    `TEMPO & KEY: ${ref.bpm}, ${ref.key}. Tempo precision is critical — rushing or dragging destroys feel.`,
    `TEXTURE: ${ref.texture}. Every instrument occupies its own frequency range — no mud, no masking.`,
    `DYNAMIC RANGE: Minimum 14dB LU dynamic range. Loudness war is forbidden. The loud sections feel loud BECAUSE the quiet sections are quiet.`,
    `EMOTIONAL DROP: ${ref.drop}. This is the moment that makes a listener replay the track. Design it deliberately.`,
    `PRODUCTION REFERENCE: Inspired by ${ref.producer}'s approach to the ${genre} genre. Their signature: intentional space, frequency clarity, emotional placement of each element.`,
    `STYLE RULES: ${styleRule}`,
    `CRAFT LEVEL: The mix must translate on earbuds, car speakers, club system, and studio monitors equally. Balance for emotion, not for meters.`,
  ].join('\n');
}

// ─── 4. CONVENIENCE HELPERS ──────────────────────────────────────────────────

/**
 * Quick enrichment: adds masterpiece context lines to any existing prompt string.
 * Non-destructive — appends after the original prompt.
 */
export function enrichPromptWithMasterpieceRules(
  existingPrompt: string,
  ctx: ArtistContext,
  type: 'image' | 'lyric' | 'audio',
  subtype?: string,
): string {
  const separator = '\n\n---MASTERPIECE STANDARDS---\n';
  if (type === 'image') {
    return existingPrompt + separator + buildImageMasterpieceRules(ctx, (subtype as any) || 'album-cover');
  } else if (type === 'lyric') {
    return existingPrompt + separator + buildLyricMasterpieceRules(ctx, (subtype as any) || 'full-song');
  } else {
    return existingPrompt + separator + buildAudioMasterpieceRules(ctx, (subtype as any) || 'full-track');
  }
}

/**
 * Build a full Suno/Udio style-tag string enriched with production rules.
 * Returns: a pipe-separated tag string optimized for music generation APIs.
 */
export function buildMusicTags(ctx: ArtistContext, extraTags?: string): string {
  const genre = normalizeGenre(ctx.genre);
  const ref = GENRE_AUDIO_REFS[genre] || GENRE_AUDIO_REFS['pop'];
  const mood = ctx.mood || 'emotive';
  const base = [
    ctx.genre || 'pop',
    mood,
    ref.bpm,
    ref.key,
    `${ref.producer} production style`,
    extraTags,
  ].filter(Boolean).join(', ');
  return base;
}

// ─── 5. EMOTIONAL STUDIO ENGINE ──────────────────────────────────────────────

export type EmotionalUseCase =
  | 'silent-emotion'
  | 'pain-to-art'
  | 'iconic-identity'
  | 'social-meaning'
  | 'minimal-scene'
  | 'universal-emotion'
  | 'tenderness-layer'
  | 'body-performance';

/**
 * Builds a focused emotional intelligence block for a given use case.
 * Injects into image, lyric, or audio generation prompts to add depth and memorability.
 */
export function buildEmotionalDNA(ctx: ArtistContext, useCase: EmotionalUseCase): string {
  const genre = normalizeGenre(ctx.genre);
  const name = ctx.artistName || 'the artist';
  const mood = ctx.mood || 'emotive';

  switch (useCase) {
    case 'silent-emotion':
      return [
        `[SILENT EMOTION PROTOCOL — Visual Communication Law]`,
        `The image must communicate ONE clear emotion in under 3 seconds, without any text or caption.`,
        `Face and body posture are the primary narrative devices — not objects, not backgrounds.`,
        `Silhouette test: cover the image details. The outline alone must tell the story.`,
        `Emotion target for ${name}: ${mood}. Make it physically visible in the body language.`,
        `Forbidden: stock poses, neutral expressions, decorative emptiness. Every element carries meaning.`,
        `Reference: a single frame must work as a standalone story — no context needed.`,
      ].join('\n');

    case 'pain-to-art':
      return [
        `[PAIN-TO-ART PROTOCOL — Transformation Narrative]`,
        `Layer 1 — The Wound: name what was lost, broken, or taken from ${name}. Be specific, not poetic.`,
        `Layer 2 — The Survival: what hardened and survived. What the artist became because of the wound.`,
        `Layer 3 — The Universal: why millions recognize this pain as their own. The personal becomes political.`,
        `Principle: the more specific the pain, the more universal the resonance. Generic suffering has no power.`,
        `Output must contain: one lyric fragment, one visual concept, one campaign angle — all rooted in real emotion.`,
        `Forbidden: inspirational platitudes, "rise and shine" arc, motivational poster language.`,
      ].join('\n');

    case 'iconic-identity':
      return [
        `[ICONIC IDENTITY PROTOCOL — Recognizable Character Architecture]`,
        `${name} needs ONE instantly recognizable visual silhouette — a specific clothing item, hat, coat, color that becomes a cultural shorthand.`,
        `Assign: a dominant color (specific hex or shade), a signature gesture (exact physical movement), a walk style (3-word description), a verbal mark (phrase or sound the artist always uses).`,
        `The identity must survive a shadow test: the artist's silhouette alone, without face, must be identifiable.`,
        `Emotional core: ONE dominant emotion the artist embodies above all others for ${name}.`,
        `Universal emotion this artist channels: select from — longing, ambition, tenderness, defiance, joy, grief, desire, freedom, belonging, rage.`,
        `Forbidden: generic "cool" aesthetics, borrowed visual identities, trend-chasing looks.`,
      ].join('\n');

    case 'social-meaning':
      return [
        `[SOCIAL MEANING LAYER — Dual-Layer Content Protocol]`,
        `Every creative work for ${name} must carry TWO simultaneous layers:`,
        `SURFACE LAYER (commercial): rhythm, hook, visual appeal, danceability, shareability.`,
        `DEPTH LAYER (meaning): a social observation, human truth, cultural critique, or emotional statement.`,
        `The depth layer should be discoverable but not forced. A listener who wants entertainment gets it. A listener who wants meaning finds it.`,
        `Genre context for ${genre}: the depth layer must feel organic to the genre's cultural tradition, not grafted on.`,
        `Test: can a journalist write a paragraph about the meaning of this work? If not, deepen the depth layer.`,
      ].join('\n');

    case 'minimal-scene':
      return [
        `[MINIMAL SCENE COMPOSER — Scene Economy Law]`,
        `One location. One light source. One gesture. One emotion. This is a complete scene.`,
        `The constraint is the creative liberation. Limited budget forces visual precision.`,
        `Ask: what single image could represent the ENTIRE ${ctx.songTitle || 'song'} by ${name}?`,
        `Scene elements: one human figure (or absence of figure), one environmental detail, one light direction, one color temperature.`,
        `Cinematic references: Kubrick's single-point perspective, Wong Kar-wai's saturated shadows, Tarkovsky's long still frames.`,
        `The scene must create a feeling BEFORE the music starts. Silent power.`,
        `Forbidden: crowded compositions, explainer visuals, literal song lyrics illustrated.`,
      ].join('\n');

    case 'universal-emotion':
      return [
        `[UNIVERSAL EMOTION MAPPER — Global Resonance Protocol]`,
        `Identify the ONE universal emotion that anchors this work by ${name}.`,
        `Universal emotions (select the dominant): love, hunger, loneliness, desire, loss, ambition, fear, tenderness, hope, betrayal, freedom, belonging.`,
        `Map the emotion to adaptations: how does this exact emotion sound in afrobeat? in indie folk? in latin trap? in classical? in deep house?`,
        `Language adaptation: the emotional truth must survive translation. Test: does the visual or melody carry the emotion WITHOUT the lyrics?`,
        `Cultural specificity: identify which cultural market will feel this emotion most intensely and why.`,
        `Output: primary emotion + three cultural adaptations + one visual that crosses all language barriers.`,
      ].join('\n');

    case 'tenderness-layer':
      return [
        `[TENDERNESS LAYER — Human Connection Validator]`,
        `Core question: can the audience feel something for ${name}, or do they just observe a product?`,
        `Tenderness signals: vulnerability in lyrics, imperfection in performance, a moment of stillness in a video, a detail that feels private and real.`,
        `Test: does this work contain at least ONE moment where ${name} appears genuinely human — uncertain, longing, afraid, or grateful?`,
        `The work does not need to be soft. It needs to be honest. Hardness can carry tenderness. Street music can carry grief.`,
        `Scoring axis: 0 (pure product, no humanity) → 100 (deeply human, universally felt).`,
        `Recommendation threshold: any score below 60 requires a rewrite of the emotional core.`,
      ].join('\n');

    case 'body-performance':
      return [
        `[BODY PERFORMANCE DIRECTOR — Movement Choreography Protocol]`,
        `Every section of the performance has a distinct physical state for ${name}.`,
        `Emotion → posture mapping: grief (shoulders inward, chin slightly down, weight on one foot), defiance (chest high, direct gaze, controlled hands), desire (open body language, slow movement, intentional eye contact), joy (full body engagement, upward energy, loose arms).`,
        `Walk style prescription: define the artist's walk in 3 words. This walk is used in every video, every live show, every avatar animation.`,
        `Hands are always telling a story: closed fist (conviction), open palm (invitation), single pointed finger (accusation), crossed arms broken (emotional armor falling).`,
        `Current song mood: ${mood}. Map all gestures to this emotional register.`,
        `Forbidden: generic choreography, filler movements, energy that contradicts the lyrical content.`,
      ].join('\n');

    default:
      return buildImageMasterpieceRules(ctx, 'album-cover');
  }
}

// ─── 6. VISUAL DNA FINGERPRINT ────────────────────────────────────────────────

/**
 * Extract and cache a Visual DNA fingerprint from a successfully generated image prompt.
 * In future: store this in the artist's DB record for cross-module inheritance.
 */
export function extractVisualDNAFromPrompt(prompt: string, genre?: string | null): VisualDNA {
  const g = normalizeGenre(genre);
  const ref = GENRE_VISUAL_REFS[g] || GENRE_VISUAL_REFS['pop'];
  return {
    aestheticStyle: ref.era,
    referenceArtist: ref.directors.split(',')[0].trim(),
    moodKeyword: ref.palette.split(',')[0].trim(),
  };
}
