/**
 * Video Concepts Visual Theme Service
 * Adapted from: aicontentskills/ai-video-storyboard-skill
 *
 * Generates a "Production Bible" / Visual Theme ONCE per storyboard,
 * before scene generation starts. Every scene's imagePrompt is then
 * constrained to match these parameters, eliminating the visual
 * inconsistency between scenes that plagued the old approach.
 *
 * The VisualTheme acts as a shared visual language:
 *   - Palette: the 5-6 colours that must appear across ALL scenes
 *   - Lens character: the optics feel (anamorphic, telephoto, etc.)
 *   - Film look: colour grade / grain aesthetic
 *   - Motion language: camera movement style
 *   - Atmospheric conditions: fog, volumetric light, etc.
 *
 * Integration point: buildStoryboardJson() calls generateVisualTheme()
 * first, then injects the theme into every imagePrompt suffix.
 */

import OpenAI from 'openai';
import { createTrackedOpenAI } from '../utils/tracked-openai.js';
import { PRIMARY_MODEL } from '../utils/ai-config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VisualTheme = {
  /** 4-6 hex or descriptive colour words used consistently across all scenes */
  palette: string[];
  /** Lighting approach e.g. "golden hour backlit", "soft diffused overcast" */
  lightingStyle: string;
  /** Lens character e.g. "anamorphic 35mm with horizontal flares", "telephoto 85mm" */
  lensCharacter: string;
  /** Colour grade / film stock aesthetic e.g. "warm analog grain, slight desaturation" */
  filmLook: string;
  /** Camera movement style e.g. "slow handheld drift", "locked-off with subtle push-in" */
  motionLanguage: string;
  /** Colour temperature e.g. "warm amber 3200K" */
  colorTemperature: string;
  /** Contrast approach e.g. "high contrast noir", "soft lifted shadows" */
  contrast: string;
  /** Depth-of-field style e.g. "shallow bokeh f/1.8", "deep landscape f/8" */
  depthOfField: string;
  /** Atmospheric elements e.g. "volumetric light rays, light haze" */
  atmospherics: string;
  /** How subjects are framed relative to environment */
  subjectTreatment: string;
  /** One-line cinematic reference e.g. "The style of Wong Kar-wai's In the Mood for Love" */
  cinematicReference: string;
  /** Platform-aware aspect / cadence note e.g. "vertical 4:5 portrait, 8s per scene" */
  platformNote: string;
};

export type VisualThemeInput = {
  eventType: string;
  tone: string[];
  palette?: string[];
  musicVibe?: string;
  colorPreferences?: string;
  visualStyle?: string;
  brief?: {
    storyTone?: string;
    inspirationKeywords?: string;
    narrationStyle?: string;
    notes?: string;
  };
  language?: 'es' | 'en';
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt engineering
// ─────────────────────────────────────────────────────────────────────────────

const VISUAL_THEME_SYSTEM = `You are the Director of Photography for Boostify Music's elite event film division.
Your job is to define a VISUAL THEME (Production Bible) for a premium personal film.
This theme must be consistent, cinematic, and emotionally resonant.

Return a SINGLE JSON object with NO markdown fences. All string values must be
concise (1-3 sentences max). Keys exactly as shown in the schema.`;

function buildVisualThemePrompt(input: VisualThemeInput): string {
  const lines = [
    `EVENT TYPE: ${input.eventType}`,
    `TONE KEYWORDS: ${input.tone.join(', ')}`,
    input.palette?.length ? `CLIENT COLOR PREFERENCES: ${input.palette.join(', ')}` : null,
    input.colorPreferences ? `ADDITIONAL COLOR NOTES: ${input.colorPreferences}` : null,
    input.musicVibe ? `MUSIC VIBE: ${input.musicVibe}` : null,
    input.visualStyle ? `VISUAL STYLE PRESET: ${input.visualStyle}` : null,
    input.brief?.storyTone ? `STORY TONE: ${input.brief.storyTone}` : null,
    input.brief?.inspirationKeywords
      ? `INSPIRATION KEYWORDS: ${input.brief.inspirationKeywords}`
      : null,
    input.brief?.narrationStyle
      ? `NARRATION STYLE: ${input.brief.narrationStyle}`
      : null,
    input.brief?.notes ? `DIRECTOR NOTES: ${input.brief.notes}` : null,
    '',
    'Return this JSON schema (fill ALL fields with specific, actionable values):',
    JSON.stringify({
      palette: ['#hex1', '#hex2', '#hex3', '#hex4', '#hex5'],
      lightingStyle: 'string',
      lensCharacter: 'string',
      filmLook: 'string',
      motionLanguage: 'string',
      colorTemperature: 'string',
      contrast: 'string',
      depthOfField: 'string',
      atmospherics: 'string',
      subjectTreatment: 'string',
      cinematicReference: 'string',
      platformNote: 'string',
    }),
  ]
    .filter((l) => l !== null)
    .join('\n');
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a VisualTheme Production Bible for the storyboard.
 * Call once before building the 10-scene storyboard, then inject
 * the theme suffix into every scene's imagePrompt.
 */
export async function generateVisualTheme(input: VisualThemeInput): Promise<VisualTheme> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const openai = createTrackedOpenAI({ apiKey: OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VISUAL_THEME_SYSTEM },
      { role: 'user', content: buildVisualThemePrompt(input) },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  return {
    palette: Array.isArray(parsed.palette) ? parsed.palette.map(String) : ['#1a1a2e', '#c9a84c', '#f5e6c8', '#2d1b69', '#e8d5b7'],
    lightingStyle: String(parsed.lightingStyle || 'warm natural light with golden hour accents'),
    lensCharacter: String(parsed.lensCharacter || 'anamorphic 35mm with gentle lens flares'),
    filmLook: String(parsed.filmLook || 'warm analog grain, slightly desaturated'),
    motionLanguage: String(parsed.motionLanguage || 'slow handheld drift with occasional locked-off moments'),
    colorTemperature: String(parsed.colorTemperature || 'warm amber 3400K'),
    contrast: String(parsed.contrast || 'medium contrast, lifted shadows, rich blacks'),
    depthOfField: String(parsed.depthOfField || 'shallow bokeh f/1.8, subject sharp against soft background'),
    atmospherics: String(parsed.atmospherics || 'soft atmospheric haze, gentle volumetric light'),
    subjectTreatment: String(parsed.subjectTreatment || 'subject slightly offset from center, environment adds context'),
    cinematicReference: String(parsed.cinematicReference || 'cinematic premium documentary style'),
    platformNote: String(parsed.platformNote || 'vertical 4:5 portrait frame, 8-10 seconds per scene'),
  };
}

/**
 * Builds the image prompt suffix from a VisualTheme.
 * Append this to every scene's imagePrompt before sending to image models.
 */
export function buildVisualThemeSuffix(theme: VisualTheme): string {
  return [
    `Palette: ${theme.palette.join(', ')}.`,
    `Lighting: ${theme.lightingStyle}.`,
    `Lens: ${theme.lensCharacter}.`,
    `Film look: ${theme.filmLook}.`,
    `Depth of field: ${theme.depthOfField}.`,
    `Atmosphere: ${theme.atmospherics}.`,
    `Colour temperature: ${theme.colorTemperature}.`,
    `Cinematic reference: ${theme.cinematicReference}.`,
    theme.platformNote,
    'Vertical 4:5 frame. No text. No captions.',
  ].join(' ');
}

/**
 * Formats the VisualTheme as a human-readable "Production Bible" string
 * for injection into the storyboard LLM system prompt.
 */
export function formatVisualThemeForPrompt(theme: VisualTheme): string {
  return `
VISUAL THEME / PRODUCTION BIBLE (ALL SCENES MUST CONFORM):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Colour palette  : ${theme.palette.join(', ')}
Colour temp     : ${theme.colorTemperature}
Lighting style  : ${theme.lightingStyle}
Lens character  : ${theme.lensCharacter}
Film look       : ${theme.filmLook}
Motion language : ${theme.motionLanguage}
Contrast        : ${theme.contrast}
Depth of field  : ${theme.depthOfField}
Atmospherics    : ${theme.atmospherics}
Subject         : ${theme.subjectTreatment}
Reference       : ${theme.cinematicReference}
Platform        : ${theme.platformNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE: Every imagePrompt MUST reflect this palette, lighting, and lens character.
Each scene must FEEL like it belongs to the same film, shot on the same day.
`.trim();
}
