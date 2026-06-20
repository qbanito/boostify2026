/**
 * Timeline Editor Agent
 * Agente inteligente que recomienda cambios de edición al timeline
 */

import { logger } from "../logger";
import type { TimelineItem } from "../../components/timeline/TimelineClipUnified";
import type { EditorProfile } from "../../data/editors/editor-schema";
import { analyzeTimelineForEditing, type EditAnalysis } from "./edit-analysis-engine";
import { generateMicroCuts, type MicroCutRecommendations } from "./micro-cuts-generator";

export interface TimelineEditSuggestion {
  scene_id: string;
  suggested_duration: number;
  suggested_start_time: number;
  reason: string;
  confidence: number;
  micro_edits: Array<{
    type: string;
    timestamp: number;
    parameters: Record<string, any>;
  }>;
}

export interface TimelineEditPlan {
  editor: EditorProfile;
  suggestions: TimelineEditSuggestion[];
  overall_approach: string;
  expected_impact: string;
  confidence_score: number;
}

/**
 * Analiza timeline y genera plan de edición
 */
export async function generateTimelineEditPlan(
  timeline: TimelineItem[],
  audioBuffer?: AudioBuffer,
  genreHint?: string
): Promise<TimelineEditPlan> {
  try {
    logger.info("🎬 [EDITOR-AGENT] Iniciando análisis de edición...");

    // 1. Analizar timeline
    const analysis = await analyzeTimelineForEditing(timeline, audioBuffer, genreHint);
    
    // 2. Generar micro-cuts
    const microCuts = generateMicroCuts(
      timeline,
      analysis.recommended_editor,
      analysis.detected_bpm,
      timeline.reduce((sum, t) => sum + (t.duration || 2), 0)
    );

    // 3. Generar sugerencias de reordenamiento
    const suggestions = generateEditSuggestions(timeline, analysis, microCuts);

    // 4. Crear plan general
    const plan: TimelineEditPlan = {
      editor: analysis.recommended_editor,
      suggestions,
      overall_approach: generateApproachDescription(analysis.recommended_editor),
      expected_impact: generateImpactDescription(microCuts),
      confidence_score: calculateConfidenceScore(suggestions, microCuts),
    };

    logger.info(`✅ [EDITOR-AGENT] Plan generado con ${suggestions.length} sugerencias`);
    return plan;
  } catch (error) {
    logger.error("❌ [EDITOR-AGENT] Error generando plan:", error);
    throw error;
  }
}

/**
 * Genera sugerencias de edición
 */
function generateEditSuggestions(
  timeline: TimelineItem[],
  analysis: EditAnalysis,
  microCuts: MicroCutRecommendations
): TimelineEditSuggestion[] {
  const suggestions: TimelineEditSuggestion[] = [];
  const editor = analysis.recommended_editor;
  
  timeline.forEach((item, index) => {
    const duration = item.duration || 2;
    let suggested_duration = duration;
    
    // Ajustar duración según editor
    if (editor.signature_style.pace === "ultra-fast") {
      suggested_duration = Math.max(0.8, duration * 0.7); // Más corto
    } else if (editor.signature_style.pace === "slow") {
      suggested_duration = Math.min(4, duration * 1.3); // Más largo
    }
    
    // Obtener micro-cuts para esta escena
    const itemMicroCuts = [
      ...microCuts.freeze_frames,
      ...microCuts.speed_ramps,
      ...microCuts.transitions,
    ].filter(cut => Math.abs(cut.timestamp - (item.start_time || 0)) < 2);
    
    suggestions.push({
      scene_id: item.id,
      suggested_duration,
      suggested_start_time: item.start_time || 0,
      reason: generateSuggestionReason(editor, index, timeline.length),
      confidence: 0.75 + (Math.random() * 0.2),
      micro_edits: itemMicroCuts.map(cut => ({
        type: cut.type,
        timestamp: cut.timestamp,
        parameters: cut.parameters,
      })),
    });
  });
  
  return suggestions;
}

/**
 * Genera descripción del enfoque
 */
function generateApproachDescription(editor: EditorProfile): string {
  return `${editor.name} editing style: ${editor.signature_style.description}. 
  Pace: ${editor.signature_style.pace}. 
  Primary technique: ${editor.signature_style.dominant_technique}.`;
}

/**
 * Genera descripción de impacto
 */
function generateImpactDescription(microCuts: MicroCutRecommendations): string {
  const totalCuts = microCuts.freeze_frames.length + 
                   microCuts.speed_ramps.length + 
                   microCuts.transitions.length;
  
  return `${totalCuts} micro-edits suggested: ${microCuts.freeze_frames.length} freeze frames, ` +
         `${microCuts.speed_ramps.length} speed ramps, ${microCuts.transitions.length} transitions. ` +
         `Expected to increase editing energy and professional polish.`;
}

/**
 * Calcula score de confianza
 */
function calculateConfidenceScore(
  suggestions: TimelineEditSuggestion[],
  microCuts: MicroCutRecommendations
): number {
  const avgSuggestionConfidence = suggestions.length > 0
    ? suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length
    : 0.5;
  
  return (avgSuggestionConfidence + microCuts.overall_confidence) / 2;
}

/**
 * Genera razón para la sugerencia
 */
function generateSuggestionReason(editor: EditorProfile, sceneIndex: number, totalScenes: number): string {
  const position = sceneIndex / totalScenes;
  
  if (position < 0.25) {
    return `Opening moment - ${editor.name} style emphasizes strong intro`;
  } else if (position < 0.5) {
    return `Build phase - ${editor.name} increases editing intensity`;
  } else if (position < 0.75) {
    return `Climax section - maximum ${editor.name} editing energy`;
  } else {
    return `Resolution - ${editor.name} style wind-down to closure`;
  }
}
