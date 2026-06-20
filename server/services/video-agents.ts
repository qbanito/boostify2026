/**
 * AI Video Agents — Boostify HyperFrame Video Engine
 *
 * Six specialized AI agents that orchestrate the full video production pipeline:
 *
 * 1. Creative Director Agent   — concept, mood, narrative
 * 2. Scriptwriter Agent        — avatar script, captions, CTA
 * 3. Visual Composer Agent     — HyperFrames scene instructions
 * 4. Avatar Director Agent     — HeyGen API payload
 * 5. Render Supervisor Agent   — job state, errors, retries
 * 6. Distribution Agent        — platform versions, metadata
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { logger } from '../utils/logger';
import type { HyperFramesCaption, HyperFramesScene } from './hyperframes-render';
import type { HeyGenVideoGeneratePayload } from './heygen-video-api';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '',
});

// ─── Input types ──────────────────────────────────────────────────────────────

export interface VideoProductionInput {
  artist: {
    id: string;
    name: string;
    genre: string;
    visualIdentity?: string;
    brandColors?: string[];
    avatarId?: string;
    voiceId?: string;
    language?: string;
    bio?: string;
    profileImageUrl?: string;
  };
  song?: {
    id?: string;
    title: string;
    lyrics?: string;
    mood?: string;
    bpm?: number | string;
    duration?: number | string;
    audioUrl?: string;
    coverArtUrl?: string;
  };
  campaign?: {
    type?: string;
    goal?: string;
    platform?: string;
    format?: '9:16' | '16:9' | '1:1';
    durationSeconds?: number;
    cta?: string;
    targetAudience?: string;
    language?: string;
  };
  videoStyle?: {
    visualStyle?: string;
    motionStyle?: string;
    cameraStyle?: string;
    typography?: string;
    effects?: string[];
    references?: string[];
  };
  videoType: string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface CreativeConcept {
  title: string;
  logline: string;
  mood: string;
  visualDirection: string;
  emotionalGoal: string;
  colorGrade: string;
  hookLine: string;
}

export interface VideoScript {
  avatarScript: string;
  voiceover: string;
  captions: HyperFramesCaption[];
}

export interface SceneDirective {
  sceneNumber: number;
  duration: string;
  durationMs: number;
  visualDescription: string;
  hyperframesInstruction: string;
  heygenInstruction: string;
  textOverlay: string;
  cameraMovement: string;
  transition: string;
  audioCue: string;
  mediaType: 'avatar' | 'cover_art' | 'b_roll' | 'lyric_visual' | 'title_card';
}

export interface VideoProductionPlan {
  concept: CreativeConcept;
  script: VideoScript;
  scenes: SceneDirective[];
  heygenPayload: HeyGenVideoGeneratePayload;
  hyperframesScenes: HyperFramesScene[];
  distributionNotes: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Creative Director Agent
// ─────────────────────────────────────────────────────────────────────────────

export async function runCreativeDirectorAgent(input: VideoProductionInput): Promise<CreativeConcept> {
  const artist = input.artist;
  const song = input.song;
  const campaign = input.campaign;

  const systemPrompt = `You are a world-class Music Video Creative Director for AI artists.
You create cinematic, emotionally resonant video concepts for social platforms.
Rules:
- Every concept must feel premium, not generic
- Create a strong hook in the first 3 seconds
- Adapt visual direction to the artist's genre and identity
- Prioritize emotion over information
- Generate output as JSON only`;

  const userPrompt = `Create a creative video concept for:

Artist: ${artist.name}
Genre: ${artist.genre}
Bio: ${artist.bio || 'Independent artist'}
Visual Identity: ${artist.visualIdentity || 'Modern, cinematic'}
Brand Colors: ${(artist.brandColors || ['#000', '#fff']).join(', ')}

Song: ${song?.title || 'Untitled'}
Mood: ${song?.mood || 'Emotional'}
Lyrics excerpt: ${song?.lyrics ? song.lyrics.slice(0, 300) : 'Instrumental'}

Campaign type: ${input.videoType}
Platform: ${campaign?.platform || 'TikTok'}
Goal: ${campaign?.goal || 'New release announcement'}
Target audience: ${campaign?.targetAudience || 'Music fans 18-35'}
CTA: ${campaign?.cta || 'Stream Now'}

Return JSON:
{
  "title": "Concept title",
  "logline": "One sentence that captures the video (max 20 words)",
  "mood": "Single mood word (e.g. intense, melancholic, euphoric)",
  "visualDirection": "Two sentences on visual direction",
  "emotionalGoal": "What emotion should the viewer feel?",
  "colorGrade": "Color grade style (e.g. desaturated blue, warm golden, neon cyan)",
  "hookLine": "The first 3-second hook (max 10 words)"
}`;

  try {
    const res = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 600,
      temperature: 0.85,
    });

    const parsed = JSON.parse(res.choices[0].message.content || '{}') as CreativeConcept;
    logger.info(`[CreativeDirector] Concept: "${parsed.title}" — ${parsed.logline}`);
    return parsed;
  } catch (err: any) {
    logger.error(`[CreativeDirector] Error: ${err.message}`);
    return {
      title: `${artist.name} — ${song?.title || 'New Release'}`,
      logline: `${artist.name} presents their new music.`,
      mood: 'powerful',
      visualDirection: 'Dark cinematic aesthetic with bold typography. Artist in focus.',
      emotionalGoal: 'Inspire and captivate the audience.',
      colorGrade: 'desaturated noir with blue highlights',
      hookLine: `${artist.name} — Out Now`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Scriptwriter Agent
// ─────────────────────────────────────────────────────────────────────────────

export async function runScriptwriterAgent(
  input: VideoProductionInput,
  concept: CreativeConcept,
  durationSeconds: number,
): Promise<VideoScript> {
  const artist = input.artist;
  const song = input.song;
  const language = input.campaign?.language || artist.language || 'en';
  const cta = input.campaign?.cta || 'Stream Now';

  const systemPrompt = `You are an elite music video scriptwriter specializing in viral social content.
Write in ${language === 'es' ? 'Spanish' : language === 'pt' ? 'Portuguese' : 'English'}.
Rules:
- Avatar script: spoken directly to camera, intimate and confident
- Captions: modern, bold, sync with speech rhythm
- Hook must land in first 2 seconds
- Include strong CTA at the end
- Return JSON only`;

  const userPrompt = `Write a video script for:

Artist: ${artist.name}
Song: ${song?.title || 'New Release'}
Concept: "${concept.logline}"
Mood: ${concept.mood}
Hook: "${concept.hookLine}"
CTA: "${cta}"
Duration: ${durationSeconds} seconds
Language: ${language}

Return JSON:
{
  "avatarScript": "Spoken script for the AI avatar (15-${durationSeconds - 5} seconds of speech)",
  "voiceover": "Same content formatted as clean voiceover text",
  "captions": [
    { "text": "Caption text", "startMs": 0, "endMs": 2000 }
  ]
}

Generate 4-8 captions spaced across the ${durationSeconds * 1000}ms duration. Last caption should be the CTA.`;

  try {
    const res = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.8,
    });

    const parsed = JSON.parse(res.choices[0].message.content || '{}') as VideoScript;
    if (!Array.isArray(parsed.captions)) parsed.captions = [];

    logger.info(`[Scriptwriter] Script ready. ${parsed.captions.length} captions. Language: ${language}`);
    return parsed;
  } catch (err: any) {
    logger.error(`[Scriptwriter] Error: ${err.message}`);
    const half = durationSeconds * 500;
    return {
      avatarScript: `${concept.hookLine} — ${song?.title || 'My new song'} is out now. ${cta}!`,
      voiceover: `${concept.hookLine}. ${cta}.`,
      captions: [
        { text: concept.hookLine, startMs: 0, endMs: 2500 },
        { text: song?.title || 'New Release', startMs: half - 1000, endMs: half + 1500 },
        { text: cta.toUpperCase(), startMs: (durationSeconds - 4) * 1000, endMs: (durationSeconds - 1) * 1000 },
      ],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Visual Composer Agent (HyperFrames)
// ─────────────────────────────────────────────────────────────────────────────

export async function runVisualComposerAgent(
  input: VideoProductionInput,
  concept: CreativeConcept,
  durationSeconds: number,
): Promise<{ scenes: SceneDirective[]; hyperframesScenes: HyperFramesScene[] }> {
  const numScenes = Math.max(2, Math.floor(durationSeconds / 8));
  const sceneMs = Math.floor((durationSeconds * 1000) / numScenes);

  const systemPrompt = `You are a Visual Composer for HyperFrames HTML video compositions.
HyperFrames uses HTML elements with data-start / data-duration attributes.
Each scene is a visual block. Return structured scene directives.
Return JSON only.`;

  const userPrompt = `Design ${numScenes} scenes for a ${durationSeconds}s ${input.videoType} video:

Artist: ${input.artist.name}
Genre: ${input.artist.genre}
Concept: "${concept.logline}"
Mood: ${concept.mood}
Color Grade: ${concept.colorGrade}
Visual Style: ${input.videoStyle?.visualStyle || 'cinematic'}
Format: ${input.campaign?.format || '9:16'}

Return JSON array of scenes:
[
  {
    "sceneNumber": 1,
    "duration": "8s",
    "durationMs": 8000,
    "visualDescription": "What the viewer sees",
    "hyperframesInstruction": "HTML/CSS instruction for HyperFrames composer",
    "heygenInstruction": "What the HeyGen avatar should do/express here",
    "textOverlay": "Text on screen (or empty)",
    "cameraMovement": "push-in | pull-out | static | pan-left | pan-right",
    "transition": "fade | slide | flash | cut",
    "audioCue": "Music note (e.g. 'bass drop', 'chorus', 'bridge')",
    "mediaType": "avatar | cover_art | b_roll | lyric_visual | title_card"
  }
]

Scene 1 must be the hook. Last scene must have CTA. Mix avatar scenes with cover art / lyric visuals.`;

  try {
    const res = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.75,
    });

    const content = res.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);
    const scenes: SceneDirective[] = Array.isArray(parsed) ? parsed : (parsed.scenes ?? []);

    // Normalize durations
    let cursor = 0;
    const hyperframesScenes: HyperFramesScene[] = scenes.map((s, i) => {
      const durMs = s.durationMs || sceneMs;
      const startMs = cursor;
      cursor += durMs;
      return {
        sceneNumber: i + 1,
        startMs,
        endMs: cursor,
        durationMs: durMs,
        visualDescription: s.visualDescription,
        textOverlay: s.textOverlay,
        cameraMovement: s.cameraMovement,
        transition: s.transition,
        audioCue: s.audioCue,
        mediaUrl: undefined,
        avatarVideoUrl: undefined,
      };
    });

    logger.info(`[VisualComposer] ${scenes.length} scenes generated`);
    return { scenes, hyperframesScenes };
  } catch (err: any) {
    logger.error(`[VisualComposer] Error: ${err.message}`);
    const fallback: SceneDirective[] = [
      {
        sceneNumber: 1, duration: '3s', durationMs: 3000,
        visualDescription: 'Artist name title card with hook line',
        hyperframesInstruction: 'Full-screen dark background with centered artist name in bold white',
        heygenInstruction: 'Confident introduction stare to camera',
        textOverlay: concept.hookLine,
        cameraMovement: 'push-in', transition: 'fade', audioCue: 'intro',
        mediaType: 'title_card',
      },
      {
        sceneNumber: 2, duration: `${durationSeconds - 6}s`, durationMs: (durationSeconds - 6) * 1000,
        visualDescription: 'Main artist performance / song preview',
        hyperframesInstruction: 'Avatar video centered with cover art background at 30% opacity',
        heygenInstruction: 'Speak the script naturally with emotion matching the mood',
        textOverlay: input.song?.title || '',
        cameraMovement: 'static', transition: 'cut', audioCue: 'verse',
        mediaType: 'avatar',
      },
      {
        sceneNumber: 3, duration: '3s', durationMs: 3000,
        visualDescription: 'CTA end card with artist branding',
        hyperframesInstruction: 'Brand color gradient background with CTA text centered',
        heygenInstruction: 'Point to screen / smile / gesture to link',
        textOverlay: input.campaign?.cta || 'Stream Now',
        cameraMovement: 'pull-out', transition: 'fade', audioCue: 'outro',
        mediaType: 'title_card',
      },
    ];
    const hf: HyperFramesScene[] = fallback.map((s, i) => ({
      sceneNumber: i + 1,
      startMs: fallback.slice(0, i).reduce((a, b) => a + b.durationMs, 0),
      endMs: fallback.slice(0, i + 1).reduce((a, b) => a + b.durationMs, 0),
      durationMs: s.durationMs,
      visualDescription: s.visualDescription,
      textOverlay: s.textOverlay,
      mediaUrl: undefined, avatarVideoUrl: undefined,
    }));
    return { scenes: fallback, hyperframesScenes: hf };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Avatar Director Agent (HeyGen)
// ─────────────────────────────────────────────────────────────────────────────

export function runAvatarDirectorAgent(
  input: VideoProductionInput,
  script: VideoScript,
  concept: CreativeConcept,
): HeyGenVideoGeneratePayload {
  const format = input.campaign?.format ?? '9:16';
  const dimensionMap: Record<string, { width: number; height: number }> = {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1':  { width: 1080, height: 1080 },
  };

  const bgColorMap: Record<string, string> = {
    noir: '#0a0a0a',
    dark: '#0d1117',
    blue: '#060d1f',
    purple: '#0f0520',
    warm: '#1c0f00',
  };

  const grade = concept.colorGrade.toLowerCase();
  let bgColor = '#0a0a0a';
  for (const [key, val] of Object.entries(bgColorMap)) {
    if (grade.includes(key)) { bgColor = val; break; }
  }

  const webhookBase = process.env.WEBHOOK_BASE_URL || 'https://boostify-music.onrender.com';

  return {
    avatar_id: input.artist.avatarId || 'mock_avatar_neutral_1',
    voice_id: input.artist.voiceId || 'mock_voice_en_1',
    script: script.avatarScript,
    background: { type: 'color', value: bgColor },
    dimension: dimensionMap[format] ?? dimensionMap['9:16'],
    caption: false,
    talking_style: 'expressive',
    webhook_url: `${webhookBase}/api/ai-video-studio/webhooks/heygen`,
    title: `Boostify — ${input.artist.name} — ${input.videoType}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Render Supervisor Agent
// ─────────────────────────────────────────────────────────────────────────────

export function buildRenderSupervisorReport(jobId: number, stages: {
  creative: boolean;
  script: boolean;
  hyperframes: boolean;
  heygen: boolean;
  assembly: boolean;
}): { status: string; completedStages: number; totalStages: number; progressPercent: number } {
  const values = Object.values(stages);
  const completed = values.filter(Boolean).length;
  const total = values.length;
  const pct = Math.round((completed / total) * 100);

  let status = 'draft';
  if (stages.creative && stages.script) status = 'script_generated';
  if (stages.hyperframes) status = 'hyperframes_generated';
  if (stages.heygen) status = 'heygen_processing';
  if (stages.assembly) status = 'rendering';
  if (completed === total) status = 'completed';

  return { status, completedStages: completed, totalStages: total, progressPercent: pct };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Distribution Agent
// ─────────────────────────────────────────────────────────────────────────────

export function runDistributionAgent(
  input: VideoProductionInput,
  concept: CreativeConcept,
  script: VideoScript,
): Record<string, string> {
  const songTitle = input.song?.title || 'New Release';
  const cta = input.campaign?.cta || 'Stream Now';

  const caption = `${concept.hookLine} 🎵\n\n${cta} 👇`;
  const hashtags = `#${input.artist.name.replace(/\s+/g, '')} #NewMusic #${input.artist.genre?.replace(/\s+/g, '') || 'Music'} #MusicRelease`;

  return {
    tiktok_caption: `${caption}\n\n${hashtags} #TikTokMusic`,
    instagram_caption: `${caption}\n\n${hashtags} #InstagramMusic #Reels`,
    youtube_description: `${songTitle} by ${input.artist.name}\n\n${script.voiceover}\n\n${cta}\n\n${hashtags}`,
    spotify_canvas_note: `9:16 loop optimized for Spotify Canvas (max 8s loop recommended)`,
    seo_tags: [input.artist.name, songTitle, input.artist.genre || 'music', 'new release', cta].join(', '),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator — runs all 6 agents in sequence
// ─────────────────────────────────────────────────────────────────────────────

export async function orchestrateVideoProduction(input: VideoProductionInput): Promise<VideoProductionPlan> {
  const durationSeconds = input.campaign?.durationSeconds ?? 30;
  const format = input.campaign?.format ?? '9:16';

  logger.info(`[VideoOrchestrator] Starting pipeline for ${input.artist.name} — ${input.videoType}`);

  // 1. Creative Director
  const concept = await runCreativeDirectorAgent(input);

  // 2. Scriptwriter
  const script = await runScriptwriterAgent(input, concept, durationSeconds);

  // 3. Visual Composer (HyperFrames scenes)
  const { scenes, hyperframesScenes } = await runVisualComposerAgent(input, concept, durationSeconds);

  // 4. Avatar Director (HeyGen payload)
  const heygenPayload = runAvatarDirectorAgent(input, script, concept);

  // 5. Distribution
  const distributionNotes = runDistributionAgent(input, concept, script);

  logger.info(`[VideoOrchestrator] Pipeline complete. ${scenes.length} scenes, ${script.captions.length} captions.`);

  return {
    concept,
    script,
    scenes,
    heygenPayload,
    hyperframesScenes,
    distributionNotes,
  };
}
