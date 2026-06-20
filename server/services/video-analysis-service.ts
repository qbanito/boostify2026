/**
 * 🎬 Video Analysis Service — AI-powered quality layers for Music Video Creator
 * 
 * 4 analysis layers that enhance the pipeline without breaking existing workflow:
 * 
 * Layer 1: Scene Quality Gate (Gemini Vision) — Post image generation
 *   Scores composition, director adherence, lyric matching. Flags <60 for regen.
 * 
 * Layer 2: Emotional Audio Analysis (GPT-4o) — Post Whisper
 *   Extracts per-section emotions → enriches image generation prompts.
 * 
 * Layer 3: Visual Continuity Check (Gemini Vision) — Pre-render
 *   Analyzes full scene sequence for color/lighting/style jumps.
 * 
 * Layer 4: Dynamic Pacing Engine (GPT-4o) — Pre-render
 *   Crosses audio energy curve with scenes → suggests per-clip duration & cut style.
 * 
 * All layers are optional (graceful degradation via try/catch).
 * Cost: ~$0.09 per video.
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { logger } from '../utils/logger';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = process.env.OPENAI_API_KEY
  ? createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2 || '';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';

// ═════════════════════════════════════════════════════════════
// INTERFACES
// ═════════════════════════════════════════════════════════════

export interface EmotionalSection {
  sectionType: string;
  startTime: number;
  endTime: number;
  emotion: string;
  intensity: number; // 0-100
  visualSuggestion: string;
  colorMood: string;
}

export interface EmotionalAnalysis {
  sections: EmotionalSection[];
  overallArc: string;
  dominantEmotion: string;
  moodboard: string;
  promptEnhancements: Record<string, string>; // sectionType → prompt text to inject
}

export interface SceneQualityScore {
  sceneId: number;
  composition: number;        // 0-100
  directorAdherence: number;  // 0-100
  lyricMatch: number;         // 0-100
  overall: number;            // 0-100
  issues: string[];
  suggestedFix: string | null; // prompt improvement if score < 60
}

export interface ContinuityIssue {
  fromScene: number;
  toScene: number;
  type: 'color_jump' | 'lighting_shift' | 'style_break' | 'location_discontinuity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface ContinuityReport {
  issues: ContinuityIssue[];
  overallScore: number; // 0-100
  colorConsistency: number;
  styleConsistency: number;
}

export interface PacingRecommendation {
  sceneId: number;
  suggestedDuration: number; // seconds
  cutStyle: 'hard_cut' | 'dissolve' | 'fade' | 'whip' | 'match_cut' | 'jump_cut';
  reason: string;
  energyLevel: number; // 0-100
}

export interface PacingPlan {
  recommendations: PacingRecommendation[];
  avgBPM: number;
  editingRhythm: string;
  totalDuration: number;
}

// ═════════════════════════════════════════════════════════════
// LAYER 1: EMOTIONAL AUDIO ANALYSIS (GPT-4o)
// ═════════════════════════════════════════════════════════════

/**
 * Analyzes lyrics + audio structure to extract per-section emotions.
 * Returns enriched prompt fragments to inject into image generation.
 * Cost: ~$0.02
 */
export async function analyzeEmotionalContent(
  lyrics: string,
  audioSections: Array<{ type: string; startTime: number; endTime: number; energy: string }>,
  genre?: string,
): Promise<EmotionalAnalysis | null> {
  if (!openai) {
    logger.warn('[VideoAnalysis] No OpenAI key — skipping emotional analysis');
    return null;
  }

  try {
    logger.log('[VideoAnalysis] 🎭 Layer 1: Emotional Audio Analysis starting...');

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a music video emotional director. Analyze lyrics and audio structure to extract precise emotions per section. Return JSON with:
{
  "sections": [{ "sectionType": "verse1", "startTime": 0, "endTime": 30, "emotion": "melancholy", "intensity": 70, "visualSuggestion": "dim lighting, rain on windows", "colorMood": "desaturated blues and grays" }],
  "overallArc": "from sadness through defiance to triumph",
  "dominantEmotion": "yearning",
  "moodboard": "one paragraph describing the visual/emotional world of this song",
  "promptEnhancements": { "verse": "add soft shadows, muted tones, introspective gaze", "chorus": "bright burst of warm light, dynamic movement, euphoric energy" }
}
Emotions must be SPECIFIC (not just "happy/sad"). Use: yearning, defiance, euphoria, melancholy, nostalgia, rage, serenity, tension, ecstasy, vulnerability, power, longing, liberation, etc.`
        },
        {
          role: 'user',
          content: `LYRICS:\n${lyrics}\n\nAUDIO SECTIONS:\n${JSON.stringify(audioSections)}\n\nGENRE: ${genre || 'unknown'}`
        }
      ],
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    logger.log(`[VideoAnalysis] ✅ Emotional analysis complete: ${result.dominantEmotion}, arc: ${result.overallArc}`);
    return result as EmotionalAnalysis;
  } catch (err: any) {
    logger.warn(`[VideoAnalysis] ⚠️ Emotional analysis failed: ${err.message}`);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════
// LAYER 2: SCENE QUALITY GATE (Gemini Vision)
// ═════════════════════════════════════════════════════════════

/**
 * Analyzes a generated scene image for quality, composition, and director style adherence.
 * Returns score + suggested prompt fix if below threshold.
 * Cost: ~$0.001 per image
 */
export async function analyzeSceneQuality(
  imageUrl: string,
  sceneId: number,
  expectedPrompt: string,
  directorName: string,
  lyrics?: string,
): Promise<SceneQualityScore | null> {
  if (!GEMINI_API_KEY) {
    logger.warn('[VideoAnalysis] No Gemini key — skipping scene quality gate');
    return null;
  }

  try {
    const prompt = `You are a professional cinematography quality analyst. Analyze this generated image for a music video.

EXPECTED SCENE: ${expectedPrompt.substring(0, 500)}
DIRECTOR STYLE: ${directorName}
${lyrics ? `LYRICS AT THIS MOMENT: "${lyrics}"` : ''}

Score this image precisely (0-100) on THREE criteria and return ONLY valid JSON:
{
  "composition": <0-100 score for framing, rule of thirds, visual balance, depth>,
  "directorAdherence": <0-100 how well it matches ${directorName}'s signature style>,
  "lyricMatch": <0-100 how well visuals connect to the lyrical content>,
  "overall": <weighted average: composition 30%, directorAdherence 40%, lyricMatch 30%>,
  "issues": ["specific issue 1", "specific issue 2"],
  "suggestedFix": "If overall < 60, provide a specific prompt improvement. Otherwise null."
}
Be strict but fair. Score 70+ means professional quality.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: await fetchImageAsBase64(imageUrl) } },
            ],
          }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const result = JSON.parse(text);

    const score: SceneQualityScore = {
      sceneId,
      composition: result.composition ?? 70,
      directorAdherence: result.directorAdherence ?? 70,
      lyricMatch: result.lyricMatch ?? 70,
      overall: result.overall ?? 70,
      issues: result.issues || [],
      suggestedFix: result.overall < 60 ? (result.suggestedFix || null) : null,
    };

    logger.log(`[VideoAnalysis] 🎯 Scene ${sceneId} quality: ${score.overall}/100 (comp:${score.composition} dir:${score.directorAdherence} lyric:${score.lyricMatch})`);
    return score;
  } catch (err: any) {
    logger.warn(`[VideoAnalysis] ⚠️ Scene quality analysis failed for scene ${sceneId}: ${err.message}`);
    return null;
  }
}

/**
 * Batch analyze multiple scenes in parallel (with concurrency limit).
 */
export async function batchAnalyzeScenes(
  scenes: Array<{ imageUrl: string; sceneId: number; prompt: string; lyrics?: string }>,
  directorName: string,
  concurrency = 3,
): Promise<SceneQualityScore[]> {
  const results: SceneQualityScore[] = [];

  for (let i = 0; i < scenes.length; i += concurrency) {
    const batch = scenes.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(s =>
        analyzeSceneQuality(s.imageUrl, s.sceneId, s.prompt, directorName, s.lyrics)
      ),
    );
    results.push(...batchResults.filter((r): r is SceneQualityScore => r !== null));
  }

  return results;
}

// ═════════════════════════════════════════════════════════════
// LAYER 3: VISUAL CONTINUITY CHECK (Gemini Vision)
// ═════════════════════════════════════════════════════════════

/**
 * Analyzes the full sequence of scene images for visual continuity.
 * Detects color jumps, lighting shifts, style breaks.
 * Cost: ~$0.01 per full analysis (sends representative samples)
 */
export async function analyzeVisualContinuity(
  sceneImages: Array<{ sceneId: number; imageUrl: string; description: string }>,
  directorName: string,
): Promise<ContinuityReport | null> {
  if (!GEMINI_API_KEY) {
    logger.warn('[VideoAnalysis] No Gemini key — skipping continuity check');
    return null;
  }

  try {
    logger.log(`[VideoAnalysis] 🔗 Layer 3: Visual Continuity Check (${sceneImages.length} scenes)...`);

    // Sample every Nth scene to keep under token limits (max ~12 images)
    const step = Math.max(1, Math.floor(sceneImages.length / 12));
    const sampled = sceneImages.filter((_, i) => i % step === 0).slice(0, 12);

    const parts: any[] = [
      {
        text: `You are a professional video editor analyzing visual continuity across ${sceneImages.length} scenes of a ${directorName}-directed music video. 
These ${sampled.length} images are sampled frames in sequence order.

Analyze for:
1. COLOR CONTINUITY: Are color palettes consistent? Sudden shifts?
2. LIGHTING CONSISTENCY: Does lighting feel from the same world?
3. STYLE COHERENCE: Does every image feel like the same video?
4. LOCATION LOGIC: Do scene transitions make narrative sense?

Return ONLY valid JSON:
{
  "issues": [{ "fromScene": 1, "toScene": 2, "type": "color_jump", "severity": "high", "description": "scene jumps from warm orange to cold blue", "suggestion": "add warm color grading to scene 2" }],
  "overallScore": <0-100>,
  "colorConsistency": <0-100>,
  "styleConsistency": <0-100>
}
If no issues, return empty issues array with high scores.`
      },
    ];

    // Add sampled images
    for (const scene of sampled) {
      try {
        const base64 = await fetchImageAsBase64(scene.imageUrl);
        parts.push({ text: `Scene ${scene.sceneId}: ${scene.description.substring(0, 100)}` });
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: base64 } });
      } catch {
        parts.push({ text: `Scene ${scene.sceneId}: [image unavailable] ${scene.description.substring(0, 100)}` });
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const result = JSON.parse(text);

    const report: ContinuityReport = {
      issues: result.issues || [],
      overallScore: result.overallScore ?? 80,
      colorConsistency: result.colorConsistency ?? 80,
      styleConsistency: result.styleConsistency ?? 80,
    };

    logger.log(`[VideoAnalysis] ✅ Continuity: score=${report.overallScore}/100, issues=${report.issues.length}, color=${report.colorConsistency}, style=${report.styleConsistency}`);
    return report;
  } catch (err: any) {
    logger.warn(`[VideoAnalysis] ⚠️ Continuity check failed: ${err.message}`);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════
// LAYER 4: DYNAMIC PACING ENGINE (GPT-4o)
// ═════════════════════════════════════════════════════════════

/**
 * Crosses audio energy curve with scene list to suggest optimal
 * per-clip duration and cut style for professional editing rhythm.
 * Cost: ~$0.02
 */
export async function generateDynamicPacing(
  scenes: Array<{ id: number; description: string; duration: number; energy?: string }>,
  audioSections: Array<{ type: string; startTime: number; endTime: number; energy: string }>,
  bpm: number,
  totalDuration: number,
): Promise<PacingPlan | null> {
  if (!openai) {
    logger.warn('[VideoAnalysis] No OpenAI key — skipping pacing engine');
    return null;
  }

  try {
    logger.log(`[VideoAnalysis] ⏱️ Layer 4: Dynamic Pacing Engine (${scenes.length} scenes, ${bpm} BPM)...`);

    const beatDuration = 60 / bpm; // seconds per beat

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert music video editor specializing in dynamic pacing. Given scenes, audio sections, and BPM, calculate optimal duration and cut style for each scene.

Rules:
- HIGH energy sections (chorus, drops): faster cuts (2-4 seconds per scene)
- LOW energy sections (verse, intro): longer holds (4-8 seconds per scene)  
- PEAK moments: can use 1-2 second flash cuts
- Transitions should match the emotional beat (hard cuts for energy, dissolves for sadness)
- Total runtime must approximately match totalDuration
- Cuts should land on beat boundaries when possible (beat duration = ${beatDuration.toFixed(3)}s)

Return JSON:
{
  "recommendations": [{ "sceneId": 1, "suggestedDuration": 4.5, "cutStyle": "hard_cut", "reason": "high energy chorus", "energyLevel": 85 }],
  "avgBPM": ${bpm},
  "editingRhythm": "one sentence describing the overall editing feel",
  "totalDuration": <sum of all durations>
}

Cut styles: hard_cut (energetic), dissolve (emotional), fade (endings/beginnings), whip (fast transitions), match_cut (visual continuity), jump_cut (rhythm/energy)`
        },
        {
          role: 'user',
          content: `SCENES:\n${JSON.stringify(scenes.map(s => ({ id: s.id, desc: s.description?.substring(0, 80), dur: s.duration, energy: s.energy })))}\n\nAUDIO SECTIONS:\n${JSON.stringify(audioSections)}\n\nBPM: ${bpm}\nTOTAL DURATION: ${totalDuration}s`
        }
      ],
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    const plan: PacingPlan = {
      recommendations: result.recommendations || [],
      avgBPM: bpm,
      editingRhythm: result.editingRhythm || '',
      totalDuration: result.totalDuration || totalDuration,
    };

    logger.log(`[VideoAnalysis] ✅ Pacing plan: ${plan.recommendations.length} scenes, rhythm: "${plan.editingRhythm}"`);
    return plan;
  } catch (err: any) {
    logger.warn(`[VideoAnalysis] ⚠️ Pacing engine failed: ${err.message}`);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════
// HELPER: Fetch image as base64 for Gemini Vision
// ═════════════════════════════════════════════════════════════

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}
