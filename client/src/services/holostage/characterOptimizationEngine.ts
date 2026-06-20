// ─── Character Optimization Engine ───────────────────────────────────────────
// Analyzes and optimizes character assets for hologram projection performance.

import type { CharacterAsset } from '../../schemas/holostage/character.schema';

export interface OptimizationReport {
  polyCount: number;
  textureCount: number;
  estimatedVRAM: number;     // MB
  recommendedLOD: 'high' | 'medium' | 'low';
  warnings: string[];
  suggestions: string[];
  score: number;             // 0-100 (hologram-readiness)
}

export interface OptimizationSettings {
  targetPolyCount: number;
  maxTextureSize: number;    // px (e.g. 2048)
  enableLOD: boolean;
  stripUnusedBlendshapes: boolean;
  optimizeForHologram: boolean;
}

export const DEFAULT_OPTIMIZATION_SETTINGS: OptimizationSettings = {
  targetPolyCount: 25000,
  maxTextureSize: 2048,
  enableLOD: true,
  stripUnusedBlendshapes: false,
  optimizeForHologram: true,
};

/**
 * Analyzes a character asset and returns an optimization report.
 */
export function analyzeCharacter(character: CharacterAsset): OptimizationReport {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const polyCount = character.polyCount ?? 0;
  const textureCount = character.textureCount ?? 0;

  // Poly count analysis
  if (polyCount > 100000) {
    warnings.push('Poly count muy alto (>100k) — puede causar lag en proyector');
    suggestions.push('Exporta un LOD2 con ~25k triángulos para mejor performance');
  } else if (polyCount > 50000) {
    warnings.push('Poly count alto (>50k) — optimizar para projection en vivo');
  }

  // Texture analysis
  const vramMB = (textureCount * 4) + (polyCount * 0.0004); // rough estimate
  if (vramMB > 256) {
    warnings.push(`VRAM estimada alta (${vramMB.toFixed(0)}MB)`);
    suggestions.push('Usa texturas comprimidas BC7/ETC2');
  }

  // Blendshapes
  if (!character.blendshapes || character.blendshapes.length === 0) {
    suggestions.push('El character no tiene blendshapes — face tracking no estará disponible');
  }

  // LOD recommendation
  let recommendedLOD: 'high' | 'medium' | 'low' = 'high';
  if (polyCount > 75000) recommendedLOD = 'low';
  else if (polyCount > 30000) recommendedLOD = 'medium';

  // Score
  let score = 100;
  if (polyCount > 100000) score -= 30;
  else if (polyCount > 50000) score -= 15;
  if (vramMB > 256) score -= 20;
  if (!character.blendshapes?.length) score -= 10;
  if (character.rigType === 'unknown') score -= 15;
  score = Math.max(0, score);

  return {
    polyCount,
    textureCount,
    estimatedVRAM: vramMB,
    recommendedLOD,
    warnings,
    suggestions,
    score,
  };
}

/**
 * Returns a label and color for the character readiness score.
 */
export function getReadinessLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Listo para Show', color: '#10b981' };
  if (score >= 60) return { label: 'Aceptable', color: '#f59e0b' };
  if (score >= 40) return { label: 'Necesita Optimización', color: '#f97316' };
  return { label: 'No recomendado', color: '#ef4444' };
}
