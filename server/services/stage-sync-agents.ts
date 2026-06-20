// ────────────────────────────────────────────────────────────────────
// Boostify StageSync AI — Internal Agents
// ────────────────────────────────────────────────────────────────────
// Six specialized AI agents that power the live-show production
// module: Repertoire Architect, Visual Director, Loop Generator,
// Stage Technical Director, Sync Engine and Emergency Show Assistant.
// ────────────────────────────────────────────────────────────────────

import { GoogleGenAI } from '@google/genai';
import { logger } from '../utils/logger';

const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  '';

const ai = new GoogleGenAI({
  apiKey: GEMINI_KEY,
  ...(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
    ? { httpOptions: { apiVersion: '', baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL } }
    : {}),
});

const MODEL = 'gemini-2.0-flash-exp';

function tryParseJson<T = any>(raw: string): T | null {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\s*|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fallthrough */ }
    }
    return null;
  }
}

async function geminiJSON<T = any>(prompt: string, system?: string): Promise<T | null> {
  if (!GEMINI_KEY) {
    logger.warn('[StageSync] No Gemini key — agent returning null');
    return null;
  }
  try {
    const result = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        ...(system ? { systemInstruction: system } : {}),
        responseMimeType: 'application/json',
        temperature: 0.85,
      },
    });
    const text = (result as any)?.text || (result as any)?.response?.text || '';
    return tryParseJson<T>(text);
  } catch (e: any) {
    logger.warn('[StageSync] Gemini call failed:', e?.message || e);
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────
export interface ShowSong {
  position: number;
  song_title: string;
  duration: string; // mm:ss
  bpm: number;
  mood: string;
  visual_scene: {
    intro: string;
    verse: string;
    chorus: string;
    bridge: string;
    final: string;
  };
  cue_points: Array<{ at: string; action: string }>;
  fallback_visual: string;
  technical_notes: string;
}

export interface ShowMaster {
  show_id: string;
  artist_name: string;
  show_title: string;
  visual_identity: {
    style: string;
    palette: string[];
    motion_language: string;
    camera_style: string;
    texture_system: string;
    forbidden_styles: string[];
  };
  technical_setup: {
    screens: string[];
    control_protocols: string[];
    software_targets: string[];
  };
  setlist: ShowSong[];
}

// ── 1. Repertoire Architect Agent ──────────────────────────────
export async function repertoireArchitectAgent(input: {
  artistName: string;
  genre?: string;
  vibe?: string;
  durationMinutes?: number;
  songs?: Array<{ title: string; bpm?: number; duration?: string; mood?: string }>;
}): Promise<{ setlist: ShowSong[]; rationale: string } | null> {
  const sys = `You are the Repertoire Architect Agent for Boostify StageSync AI. You design optimal live-show setlists for professional music artists. Output strict JSON only.`;
  const prompt = `Build a setlist for "${input.artistName}" (${input.genre || 'pop'}, vibe: ${input.vibe || 'cinematic'}).
Target duration: ${input.durationMinutes || 60} minutes.
${input.songs?.length ? `Existing repertoire candidates: ${JSON.stringify(input.songs)}` : 'Generate 8-12 plausible song titles for this artist.'}

Return JSON with shape:
{
  "setlist": [
    {
      "position": 1,
      "song_title": "...",
      "duration": "mm:ss",
      "bpm": 0,
      "mood": "...",
      "visual_scene": { "intro": "...", "verse": "...", "chorus": "...", "bridge": "...", "final": "..." },
      "cue_points": [ { "at": "0:00", "action": "..." } ],
      "fallback_visual": "...",
      "technical_notes": "..."
    }
  ],
  "rationale": "why this energy curve works"
}`;
  return geminiJSON(prompt, sys);
}

// ── 2. Visual Director Agent ───────────────────────────────────
export async function visualDirectorAgent(input: {
  artistName: string;
  genre?: string;
  showTitle?: string;
  brandColors?: string[];
  vibe?: string;
}): Promise<ShowMaster['visual_identity'] | null> {
  const sys = `You are the Visual Director Agent for Boostify StageSync AI. You design coherent visual identities for live shows. Output strict JSON only.`;
  const prompt = `Design the visual identity for "${input.showTitle || 'Live Show'}" by ${input.artistName} (${input.genre || 'pop'}).
Brand colors: ${(input.brandColors || ['#F97316', '#1F2937', '#FFFFFF']).join(', ')}
Vibe: ${input.vibe || 'cinematic and intimate'}.

Return JSON:
{
  "style": "one-line aesthetic description",
  "palette": ["#hex","#hex","#hex","#hex"],
  "motion_language": "how motion should feel (slow drift, kinetic, glitch, etc)",
  "camera_style": "virtual camera direction",
  "texture_system": "key textures (film grain, fluid, noise, ink)",
  "forbidden_styles": ["list","of","things","to","avoid"]
}`;
  return geminiJSON(prompt, sys);
}

// ── 3. Loop Generator Agent ────────────────────────────────────
export async function loopGeneratorAgent(input: {
  songTitle: string;
  bpm: number;
  mood: string;
  visualIdentity?: ShowMaster['visual_identity'];
  section?: 'intro' | 'verse' | 'chorus' | 'bridge' | 'final';
}): Promise<{ prompts: string[]; durations: number[]; sync_to_bpm: boolean; loop_strategy: string } | null> {
  const sys = `You are the Loop Generator Agent. You spec generative video loops for live shows synced to BPM. Output strict JSON only.`;
  const prompt = `Generate visual loop specs for "${input.songTitle}" (${input.bpm} BPM, ${input.mood} mood, section: ${input.section || 'chorus'}).
Visual identity: ${JSON.stringify(input.visualIdentity || {})}

Return JSON:
{
  "prompts": ["3 distinct text-to-video prompts ready for Runway/Sora/Veo3"],
  "durations": [4, 8, 8],
  "sync_to_bpm": true,
  "loop_strategy": "how loops crossfade with the music"
}`;
  return geminiJSON(prompt, sys);
}

// ── 4. Stage Technical Director Agent ──────────────────────────
export async function stageTechnicalDirectorAgent(input: {
  show: Partial<ShowMaster>;
  targetSoftware?: string[];
}): Promise<{ exports: Array<{ format: string; description: string; payload: any }> } | null> {
  const sys = `You are the Stage Technical Director Agent. You produce technical exports (Resolume, TouchDesigner, MIDI, OSC, SMPTE, Art-Net, Ableton Link). Output strict JSON only.`;
  const targets = input.targetSoftware?.length ? input.targetSoftware : ['Resolume', 'TouchDesigner', 'MIDI', 'OSC', 'SMPTE', 'Art-Net', 'Ableton Link'];
  const prompt = `Build a technical export package for this show.
Show: ${JSON.stringify(input.show).slice(0, 4000)}
Targets: ${targets.join(', ')}

Return JSON:
{
  "exports": [
    {
      "format": "Resolume Composition (.avc-ish)",
      "description": "...",
      "payload": { "decks": [], "clips": [], "cues": [] }
    },
    {
      "format": "MIDI Cue Map",
      "description": "...",
      "payload": { "ppq": 480, "events": [] }
    }
  ]
}`;
  return geminiJSON(prompt, sys);
}

// ── 5. Sync Engine Agent ───────────────────────────────────────
export async function syncEngineAgent(input: {
  show: Partial<ShowMaster>;
  devices?: Array<{ id: string; type: string; status?: string }>;
}): Promise<{ timeline: Array<{ at: string; bus: string; payload: any }>; status: 'ready' | 'fallback' | 'error' } | null> {
  const sys = `You are the Sync Engine Agent. You produce a unified timeline that drives all connected devices in lock-step. Output strict JSON only.`;
  const prompt = `Compile the live cue timeline for this show.
Show: ${JSON.stringify(input.show).slice(0, 3500)}
Devices: ${JSON.stringify(input.devices || [])}

Return JSON:
{
  "timeline": [ { "at": "00:00:05", "bus": "OSC|MIDI|ArtNet|SMPTE", "payload": {} } ],
  "status": "ready"
}`;
  return geminiJSON(prompt, sys);
}

// ── 6. Emergency Show Assistant ────────────────────────────────
export async function emergencyShowAssistant(input: {
  symptom: string;
  show?: Partial<ShowMaster>;
  currentSongPosition?: number;
}): Promise<{ severity: 'low' | 'medium' | 'high'; recoveryPlan: string[]; fallbackVisual?: string } | null> {
  const sys = `You are the Emergency Show Assistant. When a live performance hits a problem (audio drop, visuals freeze, sync loss, device offline), you produce an instant recovery plan. Output strict JSON only.`;
  const prompt = `Live emergency reported: "${input.symptom}".
Current song position: ${input.currentSongPosition ?? 'unknown'}.
Show context (truncated): ${JSON.stringify(input.show || {}).slice(0, 2000)}

Return JSON:
{
  "severity": "low|medium|high",
  "recoveryPlan": ["step 1", "step 2", "step 3"],
  "fallbackVisual": "what to push to all screens immediately"
}`;
  return geminiJSON(prompt, sys);
}
