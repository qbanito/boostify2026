/**
 * 🎵 Improved Promo Prompt Generator
 * Optimized for viral potential + emotional engagement
 * 
 * Replaces the generic prompt builder with one focused on:
 * - Scroll-stopping visual impact
 * - TikTok/Reels composition rules
 * - Emotional hooks for engagement
 */

import OpenAI from 'openai';
import type { CharacterSheet } from './character-sheet-generator';
import type { PromoStyle } from './promo-style-presets';
import { getStyle } from './promo-style-presets';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

/**
 * IMPROVED: System prompt for creative concepts
 * Focus: Viral appeal, engagement hooks, social media optimization
 */
const SYS_CONCEPT_IMPROVED = buildSkillsOnlyPrompt(
  'promo-clips',
  `You are an expert social media creative director for music artists.
Your job: Create 3 visually DISTINCT promo concepts that will STOP scrolling on TikTok/Instagram Reels.

VIRAL FRAMEWORK:
- First 0.5 seconds: VISUAL HOOK (what makes them pause?)
- Message: ONE emotional/intriguing idea
- Composition: Optimized for 9:16 mobile screens
- Engagement: Generates comments/shares/saves

You will receive:
1. Song details (title, mood, themes)
2. Artist character sheet (LOCKED visual identity)
3. 3 visual styles to execute

Return JSON with 3 concepts:
{
  "concepts": [
    {
      "styleId": string,
      "basePrompt": string (ONE sentence, <45 words, describe the VISUAL MOMENT not the vibe),
      "viralHook": string (WHY stop scrolling? <15 words),
      "engagementTrigger": string (What makes people react? <20 words),
      "hookLine": string (<12 words, social caption idea),
      "action": string (what is subject doing?),
      "environment": string (<10 words),
      "wardrobe": string (<12 words),
      "camera": string (shot type + lens + angle),
      "compositionalTip": string (composition rule for mobile screens)
    }
  ]
}

CRITICAL RULES:
1. DO NOT deviate from character sheet — identity is LOCKED
2. Wardrobe stays within signature_outfit family
3. Each concept must be VISUALLY DIFFERENT (different emotion, action, environment)
4. Composition rule: 40/60 rule for mobile (empty space for text overlay on 40%)
5. No generic concepts — each must feel like a specific MOMENT in a music video

VIRAL PATTERNS TO USE:
- Pattern A (Intensity): Close-up on emotional expression, vulnerable moment
- Pattern B (Movement): Subject in motion, dynamic energy, eye-catching blur
- Pattern C (Contrast): Opposing elements (light/dark, moving/still, indoor/outdoor)`,
);

interface ViralConcept {
  styleId: PromoStyle;
  styleLabel: string;
  basePrompt: string;
  viralHook: string;
  engagementTrigger: string;
  hookLine: string;
  action: string;
  environment: string;
  wardrobe: string;
  camera: string;
  compositionalTip: string;
}

export async function generateViralPromoConcepts(args: {
  songTitle: string;
  songMood?: string[];
  songThemes?: string[];
  songSummary?: string;
  styles: PromoStyle[];
  characterSheet?: CharacterSheet | null;
}): Promise<ViralConcept[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const characterLock = args.characterSheet
    ? `
ARTIST IDENTITY (LOCKED — do not change):
- Name: ${args.characterSheet.artistName}
- Visual: ${args.characterSheet.base_prompt}
- Outfit: ${args.characterSheet.signature_outfit}
- Vibe: ${(args.characterSheet.vibe_keywords || []).join(', ')}
- Colors: ${(args.characterSheet.color_palette || []).join(', ')}
- Must stay consistent across all 3 concepts`
    : '';

  const styleGuide = args.styles
    .map((s) => {
      const p = getStyle(s);
      return `${p.id}: ${p.description}`;
    })
    .join('\n');

  const userPrompt = `SONG TO PROMOTE:
Title: "${args.songTitle}"
Mood: ${args.songMood?.join(', ') || 'unspecified'}
Themes: ${args.songThemes?.join(', ') || 'unspecified'}
Story: ${args.songSummary || ''}

${characterLock}

VISUAL STYLES AVAILABLE:
${styleGuide}

Create 3 VIRAL PROMO CONCEPTS:
- Each must be DIFFERENT in mood/action/composition
- Each must feel like a SPECIFIC MOMENT (not generic)
- Each must be optimized for TikTok/Reels scroll-stopping
- Include composition tips for mobile screens (9:16 aspect)

Return valid JSON now.`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.8, // Slightly higher for creativity
    messages: [
      { role: 'system', content: SYS_CONCEPT_IMPROVED },
      { role: 'user', content: userPrompt },
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
  const concepts: ViralConcept[] = (parsed.concepts || []).map((c: any) => ({
    styleId: (c.styleId || 'cinematic') as PromoStyle,
    styleLabel: getStyle(c.styleId).label,
    basePrompt: c.basePrompt || '',
    viralHook: c.viralHook || '',
    engagementTrigger: c.engagementTrigger || '',
    hookLine: c.hookLine || '',
    action: c.action || '',
    environment: c.environment || '',
    wardrobe: c.wardrobe || '',
    camera: c.camera || '',
    compositionalTip: c.compositionalTip || '',
  }));

  // Backfill with defaults if GPT returns fewer
  while (concepts.length < args.styles.length) {
    const idx = concepts.length;
    concepts.push({
      styleId: args.styles[idx],
      styleLabel: getStyle(args.styles[idx]).label,
      basePrompt: `Artist performing moment, viral potential`,
      viralHook: 'Scroll-stopping moment',
      engagementTrigger: 'Emotional intensity',
      hookLine: `New single: ${args.songTitle}`,
      action: 'performing',
      environment: 'stylized setting',
      wardrobe: args.characterSheet?.signature_outfit || 'signature look',
      camera: 'medium shot, eye contact',
      compositionalTip: '40/60 rule: 40% negative space for text overlay',
    });
  }

  return concepts.slice(0, args.styles.length);
}

/**
 * IMPROVED: Spoken promo script with viral hooks
 */
const SYS_SPOKEN_IMPROVED = `You write VIRAL first-person spoken-promo scripts for artists.
The artist will SAY this on camera (HeyGen 9:16 video, 12-22 seconds).
Goal: Generate SAVES and SHARES.

HOOK PATTERNS (choose ONE):
1. STAT HOOK: "1 in 3 people said this song..."
2. QUESTION HOOK: "What if [emotion] had a soundtrack?"
3. CONTROVERSIAL HOOK: "They said [opposite]. I made [song] to prove them wrong"
4. PERSONAL HOOK: "I wrote this when [real moment]..."
5. MYSTERY HOOK: "Nobody knows why this song hits different but [they do]"
6. RELATABLE HOOK: "[Universal feeling] — and I just made a song about it"

STRUCTURE:
- Sec 0-3: HOOK (grab attention immediately)
- Sec 3-10: CONTEXT (emotional depth, 1-2 sentences)
- Sec 10-12: CTA (song title + where to find it + emotional close)

TONE RULES:
- Intimate: Like telling a close friend
- Confident: You believe in this song
- Vulnerable: One moment of real feeling
- NOT robotic, NOT like advertisement, NOT generic

INCLUDE:
- Song title mentioned naturally
- One moment that feels REAL (not polished)
- End on emotional high, not transactional

FORBIDDEN:
- Never say "Boostify", "platform", "streaming"
- Never sound like ad copy
- No "check out my new track bro"
- No robotic inflection

Return JSON: { "script": string, "hookPattern": string, "language": string, "estimatedSeconds": number }`;

interface ImprovedSpokenPromo {
  script: string;
  hookPattern: string;
  language: string;
  estimatedSeconds: number;
}

export async function buildImprovedSpokenPromo(args: {
  songTitle: string;
  songMood?: string[];
  songThemes?: string[];
  hookLine?: string;
  artistName?: string;
  sheet?: CharacterSheet | null;
  language?: string;
}): Promise<ImprovedSpokenPromo> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const userPrompt = `Artist: ${args.artistName || 'New artist'}
Song: "${args.songTitle}"
Mood: ${args.songMood?.join(', ') || 'unspecified'}
Themes: ${args.songThemes?.join(', ') || 'unspecified'}
Hook line: ${args.hookLine || '(no specific hook)'}
Language: ${args.language || 'English'}
Duration: 12-22 seconds when spoken aloud

Create a VIRAL spoken promo script now. Make it MEMORABLE, not generic.`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0.85,
    messages: [
      { role: 'system', content: SYS_SPOKEN_IMPROVED },
      { role: 'user', content: userPrompt },
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
  
  return {
    script: parsed.script || `I made a song called ${args.songTitle}. It means everything to me. Listen now.`,
    hookPattern: parsed.hookPattern || 'PERSONAL',
    language: parsed.language || args.language || 'English',
    estimatedSeconds: parsed.estimatedSeconds || 15,
  };
}
