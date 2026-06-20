/**
 * Director AI Service
 * Servicio de IA para interacción con el director seleccionado en el timeline.
 * Genera sugerencias de mejora y permite chat contextual por corte.
 */

import { logger } from '../logger';
import type { DirectorProfile } from '../../data/directors/director-schema';
import type { TimelineClip } from '../../interfaces/timeline';
import { chatWithAI } from '../api/openrouter';

// ─── Director Image Map ──────────────────────────────────────

const DIRECTOR_IMAGE_MAP: Record<string, string> = {
  'sofia-ramirez': '/assets/generated_images/sofia_ramirez_director_headshot_portrait.png',
  'david-kim': '/assets/generated_images/david_kim_director_professional_headshot.png',
  'james-wilson': '/assets/generated_images/james_wilson_director_headshot_portrait.png',
  'isabella-moretti': '/assets/generated_images/isabella_moretti_director_professional_portrait.png',
  'marcus-chen': '/assets/generated_images/marcus_chen_director_professional_headshot.png',
  'elena-rodriguez': '/assets/generated_images/elena_rodriguez_director_professional_portrait.png',
  'carlos-rodriguez': '/assets/generated_images/carlos_rodriguez_director_headshot_portrait.png',
  'nina-patel': '/assets/generated_images/nina_patel_director_professional_portrait.png',
  'david-oconnor': '/assets/generated_images/david_oconnor_director_professional_headshot.png',
  'elena-petrov': '/assets/generated_images/elena_petrov_director_professional_portrait.png',
  'yuki-tanaka': '/assets/generated_images/yuki_tanaka_director_professional_headshot.png',
  'amara-johnson': '/assets/generated_images/amara_johnson_director_professional_portrait.png',
  'michael-brooks': '/assets/generated_images/michael_brooks_director_professional_headshot.png',
  'alex-thompson': '/assets/generated_images/alex_thompson_director_professional_portrait.png',
};

/** Get the headshot image URL for a director, with DiceBear fallback */
export function getDirectorImageUrl(director: DirectorProfile): string {
  return DIRECTOR_IMAGE_MAP[director.id] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(director.name)}&scale=80`;
}

// ─── Interfaces ───────────────────────────────────────────────

export interface DirectorSuggestion {
  id: string;
  clipId?: number;
  type: 'shot_change' | 'duration' | 'transition' | 'lighting' | 'camera' | 'pacing' | 'narrative' | 'regenerate';
  title: string;
  description: string;
  confidence: number; // 0-1
  changes?: Partial<TimelineClip> & { newPrompt?: string };
  applied?: boolean;
  dismissed?: boolean;
}

export interface DirectorChatMessage {
  role: 'director' | 'user';
  content: string;
  timestamp: number;
  actions?: DirectorChatAction[];
}

export interface DirectorChatAction {
  label: string;
  icon: string;
  type: 'shot_type' | 'duration' | 'camera' | 'lens' | 'lighting' | 'regenerate' | 'transition';
  value: any;
  clipField?: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function buildDirectorPersona(director: DirectorProfile): string {
  return `You are ${director.name}, a world-class music video director.
Your specialty: ${director.specialty}
Your visual style: ${director.visual_style.description}
Signature techniques: ${director.visual_style.signature_techniques.join(', ')}
Camera preferences: ${director.camera_preferences.favorite_shot_types.join(', ')} with ${director.camera_preferences.favorite_movements.join(', ')}
Editing style: ${director.editing_style.pace} pace, ${director.editing_style.rhythm_approach}
Storytelling: ${director.storytelling.narrative_approach}
You should ALWAYS respond in character as this director. Be opinionated, creative, and specific.
Respond in the same language the user writes to you (Spanish or English).`;
}

function buildClipContext(clip: TimelineClip): string {
  const parts: string[] = [];
  parts.push(`Scene: ${clip.title || `Clip #${clip.id}`}`);
  parts.push(`Duration: ${clip.duration.toFixed(1)}s (starts at ${clip.start.toFixed(1)}s)`);
  if (clip.shotType) parts.push(`Shot type: ${clip.shotType}`);
  if (clip.shotCategory) parts.push(`Category: ${clip.shotCategory}`);
  if (clip.lyricsSegment) parts.push(`Lyrics: "${clip.lyricsSegment}"`);
  if (clip.metadata?.prompt) parts.push(`Visual prompt: ${clip.metadata.prompt}`);
  if (clip.metadata?.cameraMovement) parts.push(`Camera: ${clip.metadata.cameraMovement}`);
  if (clip.metadata?.lightingType) parts.push(`Lighting: ${clip.metadata.lightingType}`);
  return parts.join('\n');
}

function buildTimelineOverview(clips: TimelineClip[]): string {
  const imageClips = clips.filter(c => c.layerId === 1);
  const totalDuration = Math.max(...clips.map(c => c.start + c.duration), 0);
  const avgDuration = imageClips.length > 0 
    ? imageClips.reduce((s, c) => s + c.duration, 0) / imageClips.length 
    : 0;
  const perfCount = imageClips.filter(c => c.shotCategory === 'PERFORMANCE').length;
  const brollCount = imageClips.filter(c => c.shotCategory === 'B-ROLL').length;
  const shotTypes = [...new Set(imageClips.map(c => c.shotType).filter(Boolean))];

  return `Timeline overview:
- Total duration: ${totalDuration.toFixed(1)}s
- Total scenes: ${imageClips.length}
- Average shot duration: ${avgDuration.toFixed(1)}s
- Performance shots: ${perfCount}, B-Roll shots: ${brollCount}
- Shot types used: ${shotTypes.join(', ') || 'N/A'}
- Scenes:\n${imageClips.map((c, i) => `  ${i + 1}. "${c.title || `Scene ${c.id}`}" (${c.duration.toFixed(1)}s) [${c.shotCategory || 'N/A'}] ${c.shotType || ''} — ${c.lyricsSegment ? `"${c.lyricsSegment.substring(0, 50)}"` : 'no lyrics'}`).join('\n')}`;
}

// ─── Main Functions ───────────────────────────────────────────

/**
 * Genera sugerencias de mejora del director para el timeline completo
 */
export async function generateDirectorSuggestions(
  director: DirectorProfile,
  clips: TimelineClip[],
  scriptContent?: string,
): Promise<DirectorSuggestion[]> {
  try {
    logger.info(`🎬 [DirectorAI] Generating suggestions from ${director.name}...`);

    const overview = buildTimelineOverview(clips);
    const persona = buildDirectorPersona(director);
    const scriptContext = buildMasterScriptContext(scriptContent);

    const systemPrompt = `${persona}

You are reviewing a music video timeline and providing professional improvement suggestions.
${scriptContext}
${overview}

Analyze this timeline and provide 4-6 specific, actionable suggestions to improve it according to your directorial vision.
Each suggestion should reference specific scenes by their number.

IMPORTANT: Return ONLY a valid JSON array, no markdown, no explanation outside JSON.

JSON format:
[
  {
    "id": "sug-1",
    "clipIndex": 0,
    "type": "shot_change|duration|transition|lighting|camera|pacing|narrative|regenerate",
    "title": "Short title",
    "description": "Detailed explanation of what to change and why",
    "confidence": 0.85,
    "changes": {
      "shotType": "CU",
      "duration": 3.5,
      "newPrompt": "New visual description if regeneration needed"
    }
  }
]

Types explained:
- shot_change: Change the shot type (CU, MS, LS, ECU, etc.)
- duration: Adjust clip duration for better pacing
- transition: Suggest a transition between scenes
- lighting: Change lighting approach
- camera: Change camera movement
- pacing: Overall rhythm adjustment
- narrative: Story/sequence reorganization
- regenerate: Regenerate the image with a new prompt`;

    const response = await chatWithAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please review my timeline and give me your professional suggestions for improvement.' }
    ]);

    const text = typeof response === 'string' ? response : response?.choices?.[0]?.message?.content || '';
    
    // Extract JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('[DirectorAI] Could not parse suggestions JSON');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      clipIndex: number;
      type: string;
      title: string;
      description: string;
      confidence: number;
      changes?: Record<string, any>;
    }>;

    const imageClips = clips.filter(c => c.layerId === 1);

    return parsed.map((s, i) => ({
      id: s.id || `sug-${i + 1}`,
      clipId: imageClips[s.clipIndex]?.id,
      type: s.type as DirectorSuggestion['type'],
      title: s.title,
      description: s.description,
      confidence: s.confidence || 0.7,
      changes: s.changes,
      applied: false,
      dismissed: false,
    }));
  } catch (error) {
    logger.error('[DirectorAI] Error generating suggestions:', error);
    return [];
  }
}

/**
 * Chat contextual con el director sobre un corte específico
 */
export async function chatWithDirector(
  director: DirectorProfile,
  clip: TimelineClip,
  allClips: TimelineClip[],
  chatHistory: DirectorChatMessage[],
  userMessage: string,
  scriptContent?: string,
): Promise<DirectorChatMessage> {
  try {
    logger.info(`🎬 [DirectorAI] Chat with ${director.name} about clip ${clip.id}...`);

    const persona = buildDirectorPersona(director);
    const clipInfo = buildClipContext(clip);
    const overview = buildTimelineOverview(allClips);
    const scriptContext = buildMasterScriptContext(scriptContent);

    const systemPrompt = `${persona}

You are having a conversation about a specific scene in the music video timeline.
${scriptContext}
CURRENT SCENE:
${clipInfo}

FULL TIMELINE CONTEXT:
${overview}

Respond naturally as ${director.name}. Be specific and suggest concrete changes.
When suggesting changes, include an "actions" array with applicable modifications.

IMPORTANT: Return ONLY valid JSON (no markdown wrapping):
{
  "message": "Your response text here",
  "actions": [
    {
      "label": "Button text",
      "icon": "emoji",
      "type": "shot_type|duration|camera|lens|lighting|regenerate|transition",
      "value": "the value to set",
      "clipField": "field name in clip to modify"
    }
  ]
}

Action types:
- shot_type → clipField: "shotType", value: "CU"|"MS"|"LS"|"ECU"|"WS"|"OTS"|"POV"
- duration → clipField: "duration", value: number in seconds
- camera → clipField: "metadata.cameraMovement", value: "STATIC"|"PAN"|"TILT"|"DOLLY"|"ZOOM"|"CRANE"|"HANDHELD"
- lighting → clipField: "metadata.lightingType", value: string
- regenerate → value: "new prompt text for image generation"
- transition → value: { type: "dissolve"|"cut"|"fade"|"wipe", duration: 0.5 }`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.map(m => ({
        role: (m.role === 'director' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ];

    const response = await chatWithAI(messages);
    const text = typeof response === 'string' ? response : response?.choices?.[0]?.message?.content || '';

    // Try to parse structured response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          role: 'director',
          content: parsed.message || text,
          timestamp: Date.now(),
          actions: parsed.actions || [],
        };
      }
    } catch {
      // Not JSON — use as plain text
    }

    return {
      role: 'director',
      content: text,
      timestamp: Date.now(),
      actions: [],
    };
  } catch (error) {
    logger.error('[DirectorAI] Chat error:', error);
    return {
      role: 'director',
      content: 'Lo siento, tuve un problema procesando tu consulta. ¿Podrías intentar de nuevo?',
      timestamp: Date.now(),
      actions: [],
    };
  }
}

/**
 * Genera el guion profesional (script breakdown) para un clip
 */
export function generateClipScript(
  clip: TimelineClip,
  director?: DirectorProfile,
  clipIndex?: number,
): {
  sceneNumber: string;
  shotType: string;
  cameraMovement: string;
  duration: string;
  timecode: string;
  lyrics: string;
  prompt: string;
  lighting: string;
  directorNotes: string;
  shotCategory: string;
  lens: string;
  transition: string;
} {
  const sceneNum = clipIndex !== undefined ? clipIndex + 1 : clip.id;
  const meta = clip.metadata || {};

  return {
    sceneNumber: `SCENE ${sceneNum}`,
    shotType: clip.shotType || meta.shotType || 'WIDE',
    cameraMovement: meta.cameraMovement || meta.camera_movement || 'STATIC',
    duration: `${clip.duration.toFixed(1)}s`,
    timecode: `${formatTimecode(clip.start)} → ${formatTimecode(clip.start + clip.duration)}`,
    lyrics: clip.lyricsSegment || meta.lyricsSegment || meta.lyrics_segment || '—',
    prompt: meta.prompt || clip.text || '—',
    lighting: meta.lightingType || meta.lighting_type || (director?.lighting_style?.preferred_lighting?.[0]) || '—',
    directorNotes: director 
      ? `${director.name}: ${director.editing_style.rhythm_approach}` 
      : '—',
    shotCategory: clip.shotCategory || meta.shotCategory || 'GENERAL',
    lens: meta.lensType || meta.lens_type || (director?.camera_preferences?.favorite_lenses?.[0]) || '—',
    transition: clip.transition ? `${clip.transition.type} (${clip.transition.duration}s)` : 'CUT',
  };
}

function buildMasterScriptContext(scriptContent?: string): string {
  if (!scriptContent) return '';
  try {
    const parsed = JSON.parse(scriptContent);
    const scenes = parsed.scenes || parsed;
    if (!Array.isArray(scenes) || scenes.length === 0) return '';
    const lines = scenes.map((s: any, i: number) => {
      const parts = [`  Scene ${i + 1}:`];
      if (s.visual_description || s.description) parts.push(`Visual: ${s.visual_description || s.description}`);
      if (s.narrative_context) parts.push(`Narrative: ${s.narrative_context}`);
      if (s.lyric_connection) parts.push(`Lyrics: ${s.lyric_connection}`);
      if (s.emotion || s.mood) parts.push(`Emotion: ${s.emotion || s.mood}`);
      if (s.shot_type) parts.push(`Shot: ${s.shot_type}`);
      if (s.camera_movement) parts.push(`Camera: ${s.camera_movement}`);
      if (s.location) parts.push(`Location: ${s.location}`);
      if (s.lighting) parts.push(`Lighting: ${s.lighting}`);
      return parts.join(' | ');
    }).join('\n');
    return `\nMASTER SCRIPT (guion master — maintain coherence with this vision):\n${lines}\n`;
  } catch {
    return '';
  }
}

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 24);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
}
