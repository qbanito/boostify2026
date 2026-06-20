/**
 * Edit Analysis Engine
 * Detecta ritmo, analiza genre, y determina estilo óptimo
 */

import { logger } from "../logger";
import type { TimelineItem } from "../../components/timeline/TimelineClipUnified";
import type { EditorProfile } from "../../data/editors/editor-schema";
import { recommendEditorForGenre } from "../../data/editors";

export interface EditAnalysis {
  detected_bpm: number;
  beat_positions: number[];
  dominant_rhythm: "fast" | "moderate" | "slow";
  genre_detected: string;
  recommended_editor: EditorProfile;
  edit_recommendations: EditRecommendation[];
  audio_analysis: AudioAnalysis;
}

export interface EditRecommendation {
  scene_id: string;
  timestamp: number;
  recommended_action: "freeze_frame" | "speed_ramp" | "whip_transition" | "jump_cut" | "match_cut" | "crossfade" | "flash_frame";
  confidence: number;
  reason: string;
  parameters?: Record<string, any>;
}

export interface AudioAnalysis {
  tempo: number;
  beat_grid: number[];
  kick_positions: number[];
  snare_positions: number[];
  hihat_positions: number[];
  energy_curve: number[];
  section_breaks: Array<{ timestamp: number; type: string }>;
}

/**
 * Analiza el timeline y detecta ritmo/estilo para edición
 */
export async function analyzeTimelineForEditing(
  timeline: TimelineItem[],
  audioBuffer?: AudioBuffer,
  genreHint?: string
): Promise<EditAnalysis> {
  try {
    logger.info("🎬 [EDIT] Analizando timeline para edición...");

    // 1. Analizar audio
    const audioAnalysis = audioBuffer 
      ? analyzeAudioBuffer(audioBuffer)
      : generateDefaultAudioAnalysis();

    // 2. Detectar tempo BPM
    const bpm = detectBPM(audioAnalysis);
    const dominant_rhythm = bpm > 120 ? "fast" : bpm > 90 ? "moderate" : "slow";

    // 3. Detectar genre
    const genre = genreHint || detectGenreFromTimeline(timeline);

    // 4. Recomendar editor
    const editor = recommendEditorForGenre(genre);

    logger.info(`📊 [EDIT] BPM: ${bpm}, Genre: ${genre}, Editor: ${editor.name}`);

    // 5. Generar recomendaciones de edición
    const recommendations = generateEditRecommendations(
      timeline,
      audioAnalysis,
      editor,
      bpm
    );

    return {
      detected_bpm: bpm,
      beat_positions: audioAnalysis.beat_grid,
      dominant_rhythm,
      genre_detected: genre,
      recommended_editor: editor,
      edit_recommendations: recommendations,
      audio_analysis: audioAnalysis,
    };
  } catch (error) {
    logger.error("❌ [EDIT] Error analizando timeline:", error);
    throw error;
  }
}

/**
 * Analiza buffer de audio
 */
function analyzeAudioBuffer(audioBuffer: AudioBuffer): AudioAnalysis {
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  const frameLength = audioBuffer.getChannelData(0).length;
  
  // Simular análisis de audio (en producción usarías librería de audio)
  const tempo = Math.round(Math.random() * 80 + 70); // 70-150 BPM simulado
  const beats = generateBeatGrid(duration, tempo);
  
  return {
    tempo,
    beat_grid: beats,
    kick_positions: beats.filter((_, i) => i % 4 === 0),
    snare_positions: beats.filter((_, i) => i % 4 === 2),
    hihat_positions: beats.map(b => b + 0.125), // Offbeat
    energy_curve: generateEnergyCurve(duration),
    section_breaks: detectSectionBreaks(duration),
  };
}

/**
 * Análisis de audio por defecto
 */
function generateDefaultAudioAnalysis(): AudioAnalysis {
  const tempo = 120;
  const beats = generateBeatGrid(3, tempo);
  
  return {
    tempo,
    beat_grid: beats,
    kick_positions: beats.filter((_, i) => i % 4 === 0),
    snare_positions: beats.filter((_, i) => i % 4 === 2),
    hihat_positions: beats.map(b => b + 0.125),
    energy_curve: generateEnergyCurve(3),
    section_breaks: [],
  };
}

/**
 * Genera grid de beats basado en BPM
 */
function generateBeatGrid(duration: number, bpm: number): number[] {
  const beatInterval = 60 / bpm; // segundos por beat
  const beats: number[] = [];
  
  for (let t = 0; t < duration; t += beatInterval) {
    beats.push(t);
  }
  
  return beats;
}

/**
 * Deteta BPM
 */
function detectBPM(audio: AudioAnalysis): number {
  return audio.tempo || 120;
}

/**
 * Detecta género del timeline
 */
function detectGenreFromTimeline(timeline: TimelineItem[]): string {
  // Analizar propiedades del timeline
  const avgDuration = timeline.reduce((sum, t) => sum + (t.duration || 2), 0) / timeline.length;
  const hasPerformance = timeline.some(t => t.label?.includes("performance"));
  
  if (avgDuration < 1.5 && timeline.length > 8) return "pop";
  if (hasPerformance) return "hip-hop";
  return "electronic";
}

/**
 * Genera curva de energía
 */
function generateEnergyCurve(duration: number): number[] {
  const points: number[] = [];
  const numPoints = Math.ceil(duration * 10);
  
  for (let i = 0; i < numPoints; i++) {
    const t = i / numPoints;
    // Curva: baja -> alta -> baja
    points.push(Math.sin(t * Math.PI) * Math.cos(t * Math.PI * 4));
  }
  
  return points;
}

/**
 * Detecta breaks de sección
 */
function detectSectionBreaks(duration: number): Array<{ timestamp: number; type: string }> {
  return [
    { timestamp: duration * 0.25, type: "verse_to_chorus" },
    { timestamp: duration * 0.5, type: "chorus" },
    { timestamp: duration * 0.75, type: "bridge" },
  ];
}

/**
 * Genera recomendaciones de edición
 */
function generateEditRecommendations(
  timeline: TimelineItem[],
  audio: AudioAnalysis,
  editor: EditorProfile,
  bpm: number
): EditRecommendation[] {
  const recommendations: EditRecommendation[] = [];
  
  timeline.forEach((item, index) => {
    const timestamp = item.start_time || index * 2;
    const nextBeat = audio.beat_grid.find(b => b >= timestamp);
    
    if (nextBeat) {
      // Congelar en puntos de impacto
      if (audio.kick_positions.includes(nextBeat)) {
        recommendations.push({
          scene_id: item.id,
          timestamp,
          recommended_action: "freeze_frame",
          confidence: 0.85,
          reason: `Beat kick position - congelar por ${editor.micro_edit_techniques.freeze_frames.duration}`,
          parameters: {
            duration: 0.15,
            intensity: "high"
          }
        });
      }
      
      // Transiciones de cambio
      if (index % 3 === 0) {
        recommendations.push({
          scene_id: item.id,
          timestamp,
          recommended_action: "whip_transition",
          confidence: 0.7,
          reason: "Natural scene transition point",
          parameters: {
            speed: "fast"
          }
        });
      }
    }
  });
  
  return recommendations;
}
