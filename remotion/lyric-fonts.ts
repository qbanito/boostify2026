/**
 * Lyric video typography — modern font loading + per-style presets.
 * ─────────────────────────────────────────────────────────────────────────────
 * Fonts are loaded with @remotion/google-fonts so they are FETCHED at render
 * time inside the headless browser (works on AWS Lambda too — the lambda has
 * internet access to fonts.gstatic.com). We only load the handful of weights we
 * actually use to keep network requests (and render time) low.
 *
 * Each lyric style ("lyricStyle" prop) maps to a font family + animation flavor
 * so the lyrics look gorgeous and adapt to the artist / song mood.
 */
import { loadFont as loadOutfit } from '@remotion/google-fonts/Outfit';
import { loadFont as loadSora } from '@remotion/google-fonts/Sora';
import { loadFont as loadUnbounded } from '@remotion/google-fonts/Unbounded';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadBebas } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

// Load each face once (module scope) with a minimal set of weights/subsets.
const outfit = loadOutfit('normal', { weights: ['500', '700', '800', '900'], subsets: ['latin'] });
const sora = loadSora('normal', { weights: ['400', '600', '800'], subsets: ['latin'] });
const unbounded = loadUnbounded('normal', { weights: ['600', '800'], subsets: ['latin'] });
const anton = loadAnton('normal', { weights: ['400'], subsets: ['latin'] });
const bebas = loadBebas('normal', { weights: ['400'], subsets: ['latin'] });
const playfair = loadPlayfair('normal', { weights: ['600', '700', '800'], subsets: ['latin'] });
const montserrat = loadMontserrat('normal', { weights: ['600', '800', '900'], subsets: ['latin'] });

export const LYRIC_FONTS = {
  outfit: outfit.fontFamily,
  sora: sora.fontFamily,
  unbounded: unbounded.fontFamily,
  anton: anton.fontFamily,
  bebas: bebas.fontFamily,
  playfair: playfair.fontFamily,
  montserrat: montserrat.fontFamily,
};

export type LyricStyle = 'glow' | 'kinetic' | 'neon' | 'elegant' | 'bold' | 'clean';

// Animation flavor for the per-word entrance of the ACTIVE line.
export type LyricAnim = 'pop' | 'rise' | 'fade';

export interface LyricStylePreset {
  fontFamily: string;
  weightActive: number;
  weightIdle: number;
  uppercase: boolean;
  letterSpacing: number; // px
  italicAccent: boolean;
  anim: LyricAnim;
  glow: number; // 0..1 multiplier for the accent glow strength
  lineHeight: number;
}

export const LYRIC_STYLE_PRESETS: Record<LyricStyle, LyricStylePreset> = {
  // Default modern look: clean geometric sans, big bold, soft accent glow.
  glow: {
    fontFamily: LYRIC_FONTS.outfit,
    weightActive: 800,
    weightIdle: 600,
    uppercase: false,
    letterSpacing: -0.5,
    italicAccent: false,
    anim: 'pop',
    glow: 1,
    lineHeight: 1.12,
  },
  // Kinetic typography: words rise + blur-in with a springy stagger.
  kinetic: {
    fontFamily: LYRIC_FONTS.sora,
    weightActive: 800,
    weightIdle: 600,
    uppercase: false,
    letterSpacing: -0.3,
    italicAccent: false,
    anim: 'rise',
    glow: 0.8,
    lineHeight: 1.14,
  },
  // Neon club energy: chunky display face, uppercase, strong glow.
  neon: {
    fontFamily: LYRIC_FONTS.unbounded,
    weightActive: 800,
    weightIdle: 600,
    uppercase: true,
    letterSpacing: 0.5,
    italicAccent: false,
    anim: 'pop',
    glow: 1.4,
    lineHeight: 1.2,
  },
  // Elegant / romantic: high-contrast serif, lighter weights, italic accent.
  elegant: {
    fontFamily: LYRIC_FONTS.playfair,
    weightActive: 700,
    weightIdle: 600,
    uppercase: false,
    letterSpacing: 0,
    italicAccent: true,
    anim: 'fade',
    glow: 0.7,
    lineHeight: 1.18,
  },
  // Bold statement: condensed heavy caps (rap / urbano / rock).
  bold: {
    fontFamily: LYRIC_FONTS.anton,
    weightActive: 400,
    weightIdle: 400,
    uppercase: true,
    letterSpacing: 0.5,
    italicAccent: false,
    anim: 'rise',
    glow: 1.1,
    lineHeight: 1.05,
  },
  // Minimal clean: Montserrat, balanced, subtle.
  clean: {
    fontFamily: LYRIC_FONTS.montserrat,
    weightActive: 800,
    weightIdle: 600,
    uppercase: false,
    letterSpacing: -0.2,
    italicAccent: false,
    anim: 'fade',
    glow: 0.6,
    lineHeight: 1.16,
  },
};

/** Map an artist genre to the most fitting lyric style. */
export function lyricStyleForGenre(genre?: string): LyricStyle {
  const g = (genre || '').toLowerCase();
  if (/(trap|rap|hip|drill|reggaeton|urbano|urban)/.test(g)) return 'bold';
  if (/(edm|electro|house|techno|dance|club|dubstep|hyperpop)/.test(g)) return 'neon';
  if (/(pop|k-?pop|indie|synth)/.test(g)) return 'kinetic';
  if (/(ballad|bolero|jazz|soul|r&b|rnb|acoustic|classical|folk|blues)/.test(g)) return 'elegant';
  return 'glow';
}

export function resolveLyricPreset(style?: LyricStyle): LyricStylePreset {
  return LYRIC_STYLE_PRESETS[style || 'glow'] || LYRIC_STYLE_PRESETS.glow;
}
