/**
 * Micro-Cuts Generator
 * Genera sugerencias para freeze frames, whips, speed ramps, etc.
 */

import { logger } from "../logger";
import type { EditorProfile } from "../../data/editors/editor-schema";
import type { TimelineItem } from "../../components/timeline/TimelineClipUnified";

export interface MicroCut {
  id: string;
  type: "freeze_frame" | "speed_ramp" | "whip_transition" | "jump_cut" | "match_cut" | "crossfade" | "flash_frame";
  timestamp: number;
  duration: number;
  parameters: Record<string, any>;
  editor_style: string;
  confidence: number;
}

export interface MicroCutRecommendations {
  freeze_frames: MicroCut[];
  speed_ramps: MicroCut[];
  transitions: MicroCut[];
  overall_confidence: number;
}

/**
 * Genera micro-cuts basado en editor style
 */
export function generateMicroCuts(
  timeline: TimelineItem[],
  editor: EditorProfile,
  bpm: number,
  duration: number
): MicroCutRecommendations {
  try {
    logger.info(`🎬 [MICRO] Generando micro-cuts para ${editor.name}...`);

    const freezeFrames = generateFreezeFrames(editor, bpm, duration, timeline);
    const speedRamps = generateSpeedRamps(editor, bpm, duration, timeline);
    const transitions = generateTransitions(editor, bpm, duration, timeline);

    const overall_confidence = 
      (freezeFrames.reduce((sum, f) => sum + f.confidence, 0) / (freezeFrames.length || 1) +
       speedRamps.reduce((sum, s) => sum + s.confidence, 0) / (speedRamps.length || 1) +
       transitions.reduce((sum, t) => sum + t.confidence, 0) / (transitions.length || 1)) / 3;

    logger.info(`✅ [MICRO] ${freezeFrames.length} freeze frames, ${speedRamps.length} speed ramps, ${transitions.length} transitions`);

    return {
      freeze_frames: freezeFrames,
      speed_ramps: speedRamps,
      transitions,
      overall_confidence,
    };
  } catch (error) {
    logger.error("❌ [MICRO] Error generando micro-cuts:", error);
    return {
      freeze_frames: [],
      speed_ramps: [],
      transitions: [],
      overall_confidence: 0,
    };
  }
}

/**
 * Genera freeze frames
 */
function generateFreezeFrames(
  editor: EditorProfile,
  bpm: number,
  duration: number,
  timeline: TimelineItem[]
): MicroCut[] {
  const freezeTechnique = editor.micro_edit_techniques.freeze_frames;
  const cuts: MicroCut[] = [];
  
  // Frecuencia de freeze frames
  const frequency = freezeTechnique.frequency === "every 30-45 seconds" ? 37.5 : 60;
  
  for (let i = 0; i < duration; i += frequency) {
    const matching = timeline.find(t => Math.abs((t.start_time || 0) - i) < 1);
    
    if (matching) {
      cuts.push({
        id: `freeze-${i}`,
        type: "freeze_frame",
        timestamp: i,
        duration: 0.15,
        parameters: {
          color: "white",
          intensity: "medium",
          effect: "quick_punch"
        },
        editor_style: editor.name,
        confidence: 0.8,
      });
    }
  }
  
  return cuts;
}

/**
 * Genera speed ramps
 */
function generateSpeedRamps(
  editor: EditorProfile,
  bpm: number,
  duration: number,
  timeline: TimelineItem[]
): MicroCut[] {
  const speedTechnique = editor.micro_edit_techniques.speed_ramps;
  const cuts: MicroCut[] = [];
  
  // Generar en momentos clave
  const interval = duration / 5; // 5 speed ramps por video
  
  for (let i = interval; i < duration; i += interval) {
    const matching = timeline.find(t => Math.abs((t.start_time || 0) - i) < 1.5);
    
    if (matching) {
      const speedRanges = speedTechnique.speed_ranges;
      const speed = speedRanges[Math.floor(Math.random() * speedRanges.length)];
      
      cuts.push({
        id: `speed-${i}`,
        type: "speed_ramp",
        timestamp: i,
        duration: 0.5,
        parameters: {
          speed: speed || "1x",
          ramp_type: "ease_in_out",
          intensity: "medium"
        },
        editor_style: editor.name,
        confidence: 0.75,
      });
    }
  }
  
  return cuts;
}

/**
 * Genera transiciones
 */
function generateTransitions(
  editor: EditorProfile,
  bpm: number,
  duration: number,
  timeline: TimelineItem[]
): MicroCut[] {
  const transitions: MicroCut[] = [];
  
  // Una transición por cada cambio de escena
  for (let i = 1; i < timeline.length; i++) {
    const prevItem = timeline[i - 1];
    const currentItem = timeline[i];
    const timestamp = (prevItem.start_time || 0) + (prevItem.duration || 2);
    
    // Seleccionar tipo de transición basado en editor
    let transitionType: "whip_transition" | "crossfade" | "jump_cut" = "whip_transition";
    
    if (editor.signature_style.pace === "slow") {
      transitionType = "crossfade";
    } else if (editor.signature_style.pace === "ultra-fast") {
      transitionType = "jump_cut";
    }
    
    transitions.push({
      id: `trans-${i}`,
      type: transitionType,
      timestamp,
      duration: transitionType === "crossfade" ? 0.5 : 0.3,
      parameters: {
        style: editor.name,
        direction: "forward",
        color: "white"
      },
      editor_style: editor.name,
      confidence: 0.85,
    });
  }
  
  return transitions;
}
