/**
 * Montage Quality Engine — quality gates nativos para el timeline
 *
 * Reimplementación PROPIA de los conceptos de calidad popularizados por
 * sistemas agentic de producción de video (riesgo de "slideshow", validación
 * pre-render, alineación a beats). No copia código de terceros.
 *
 * Todo es puro y sin efectos: recibe clips y devuelve reportes/copias.
 */

import { TimelineClip, ClipType } from '@/interfaces/timeline';

// ── Tipos ──

export type QualityVerdict = 'strong' | 'acceptable' | 'revise' | 'fail';

export interface QualityFactor {
  key: string;
  label: string;          // etiqueta ES para UI
  score: number;          // 0-100 (más alto = más riesgo)
  weight: number;         // peso relativo en el total
  detail: string;
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;        // ES para UI
  clipIds?: number[];
  atSeconds?: number;
}

export interface TimelineQualityReport {
  score: number;              // 0-100 riesgo total (más alto = peor)
  verdict: QualityVerdict;
  factors: QualityFactor[];
  issues: QualityIssue[];
  suggestions: string[];
  stats: {
    visualClips: number;
    videoClips: number;
    stillClips: number;
    placeholders: number;
    avgClipSeconds: number;
    coveredSeconds: number;
    gapSeconds: number;
    audioCoverageSeconds: number;
    beatAlignedCutRatio: number | null; // null si no hay beats
  };
}

export interface BeatSnapResult {
  clips: TimelineClip[];
  movedCount: number;
  totalCutPoints: number;
}

// ── Helpers ──

const VISUAL_LAYER = 1;
const AUDIO_LAYER = 2;

const isStill = (c: TimelineClip): boolean =>
  (c.type === ClipType.IMAGE || c.type === ClipType.GENERATED_IMAGE) && !c.videoUrl;

const isVisual = (c: TimelineClip): boolean =>
  c.layerId === VISUAL_LAYER &&
  c.type !== ClipType.AUDIO &&
  c.duration > 0;

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const verdictFromScore = (score: number): QualityVerdict =>
  score < 25 ? 'strong' : score < 50 ? 'acceptable' : score < 75 ? 'revise' : 'fail';

/** Desviación estándar simple */
const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

// ── Análisis principal ──

export function analyzeTimelineQuality(
  clips: TimelineClip[],
  options: { duration: number; beats?: number[] }
): TimelineQualityReport {
  const duration = Math.max(0, options.duration || 0);
  const beats = (options.beats || []).filter((b) => isFinite(b) && b >= 0);

  const visual = clips
    .filter(isVisual)
    .slice()
    .sort((a, b) => a.start - b.start);
  const audio = clips.filter((c) => c.layerId === AUDIO_LAYER || c.type === ClipType.AUDIO);

  const issues: QualityIssue[] = [];
  const suggestions: string[] = [];

  // ── Cobertura visual + huecos + solapes ──
  let coveredSeconds = 0;
  let gapSeconds = 0;
  let cursor = 0;
  for (const c of visual) {
    if (c.start > cursor + 0.5) {
      const gap = c.start - cursor;
      gapSeconds += gap;
      issues.push({
        severity: 'warning',
        code: 'visual-gap',
        message: `Hueco visual de ${gap.toFixed(1)}s en ${cursor.toFixed(1)}s`,
        atSeconds: cursor,
      });
    }
    const end = c.start + c.duration;
    coveredSeconds += Math.max(0, end - Math.max(c.start, cursor));
    cursor = Math.max(cursor, end);
  }
  if (duration > 0 && cursor < duration - 1.5 && visual.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'tail-uncovered',
      message: `Los últimos ${(duration - cursor).toFixed(1)}s no tienen contenido visual`,
      atSeconds: cursor,
    });
  }
  for (let i = 1; i < visual.length; i++) {
    const prev = visual[i - 1];
    const overlap = prev.start + prev.duration - visual[i].start;
    if (overlap > 0.25) {
      issues.push({
        severity: 'info',
        code: 'overlap',
        message: `"${visual[i].title || visual[i].id}" solapa ${overlap.toFixed(1)}s con el clip anterior`,
        clipIds: [prev.id, visual[i].id],
        atSeconds: visual[i].start,
      });
    }
  }

  // ── Placeholders / media faltante ──
  const placeholders = clips.filter(
    (c) => c.type === ClipType.PLACEHOLDER || (isVisual(c) && !c.url && !c.imageUrl && !c.image_url && !c.generatedImageUrl && c.type !== ClipType.TEXT)
  );
  if (placeholders.length > 0) {
    issues.push({
      severity: 'error',
      code: 'placeholders',
      message: `${placeholders.length} clip(s) sin media (placeholder) — genera o asigna imágenes/videos antes de exportar`,
      clipIds: placeholders.map((c) => c.id),
    });
  }

  // ── Audio ──
  const audioCoverageSeconds = audio.reduce((a, c) => a + Math.max(0, c.duration), 0);
  if (audio.length === 0 && visual.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'no-audio',
      message: 'No hay pistas de audio en el timeline',
    });
  }

  // ── Factores de riesgo "slideshow" (0-100 cada uno) ──
  const videoClips = visual.filter((c) => c.type === ClipType.VIDEO || !!c.videoUrl);
  const stillClips = visual.filter(isStill);
  const totalVisualSeconds = visual.reduce((a, c) => a + c.duration, 0) || 1;
  const stillSeconds = stillClips.reduce((a, c) => a + c.duration, 0);
  const durations = visual.map((c) => c.duration);
  const avgClipSeconds = durations.length > 0 ? totalVisualSeconds / durations.length : 0;

  // 1. Proporción de imágenes estáticas
  const stillRatio = stillSeconds / totalVisualSeconds;
  // Imágenes con efectos/animación (ken burns, motion) descuentan riesgo
  const animatedStills = stillClips.filter((c) => (c.effects?.length || 0) > 0 || (c.metadata?.animation));
  const animatedDiscount = stillClips.length > 0 ? (animatedStills.length / stillClips.length) * 0.4 : 0;
  const fStill = clamp(stillRatio * 100 * (1 - animatedDiscount), 0, 100);

  // 2. Monotonía de duraciones (todas iguales = pase de diapositivas)
  const spread = avgClipSeconds > 0 ? stdDev(durations) / avgClipSeconds : 1;
  const fMonotony = visual.length >= 4 ? clamp((0.35 - spread) / 0.35, 0, 1) * 100 : 0;

  // 3. Clips estáticos demasiado largos
  const longStills = stillClips.filter((c) => c.duration > 6);
  const fLongStills = stillClips.length > 0 ? clamp((longStills.length / stillClips.length) * 100, 0, 100) : 0;

  // 4. Variedad de transiciones (0 transiciones en >6 clips = corte seco monótono; todas iguales también)
  const transitions = visual.map((c) => c.transition?.type).filter(Boolean) as string[];
  const uniqueTransitions = new Set(transitions).size;
  let fTransitions = 0;
  if (visual.length > 6) {
    if (transitions.length === 0) fTransitions = 35;
    else if (uniqueTransitions === 1 && transitions.length > 4) fTransitions = 25;
  }

  // 5. Alineación a beats (si hay beats detectados)
  let beatAlignedCutRatio: number | null = null;
  let fBeats = 0;
  if (beats.length > 3 && visual.length > 2) {
    const cutPoints = visual.slice(1).map((c) => c.start);
    const aligned = cutPoints.filter((t) => beats.some((b) => Math.abs(b - t) <= 0.12));
    beatAlignedCutRatio = cutPoints.length > 0 ? aligned.length / cutPoints.length : 0;
    fBeats = clamp((1 - beatAlignedCutRatio) * 60, 0, 60);
  }

  const factors: QualityFactor[] = [
    { key: 'still-ratio', label: 'Imágenes estáticas', score: Math.round(fStill), weight: 0.34, detail: `${Math.round(stillRatio * 100)}% del tiempo visual son imágenes fijas${animatedStills.length ? ` (${animatedStills.length} con animación)` : ''}` },
    { key: 'monotony', label: 'Monotonía de cortes', score: Math.round(fMonotony), weight: 0.2, detail: `Duración media ${avgClipSeconds.toFixed(1)}s, variación ${(spread * 100).toFixed(0)}%` },
    { key: 'long-stills', label: 'Estáticos largos', score: Math.round(fLongStills), weight: 0.16, detail: `${longStills.length} imagen(es) fija(s) de más de 6s` },
    { key: 'transitions', label: 'Variedad de transiciones', score: Math.round(fTransitions), weight: 0.12, detail: transitions.length === 0 ? 'Sin transiciones definidas' : `${uniqueTransitions} tipo(s) de transición` },
    { key: 'beat-sync', label: 'Sincronía con beats', score: Math.round(fBeats), weight: 0.18, detail: beatAlignedCutRatio === null ? 'Sin análisis de beats disponible' : `${Math.round((beatAlignedCutRatio || 0) * 100)}% de cortes caen en beat` },
  ];

  const totalWeight = factors.reduce((a, f) => a + f.weight, 0);
  const score = Math.round(
    clamp(factors.reduce((a, f) => a + f.score * f.weight, 0) / totalWeight, 0, 100)
  );

  // ── Sugerencias ──
  if (fStill > 50) suggestions.push('Convierte imágenes clave en video (Grok/FAL image-to-video) o añade efectos de movimiento tipo Ken Burns.');
  if (fMonotony > 40) suggestions.push('Varía la duración de los clips: planos cortos en el estribillo (2-3s) y más largos en versos (4-6s).');
  if (fLongStills > 40) suggestions.push('Divide las imágenes fijas de más de 6s con microcortes (panel ⚡).');
  if (fTransitions > 20) suggestions.push('Añade 2-3 tipos de transición en momentos clave (no en todos los cortes).');
  if (beatAlignedCutRatio !== null && beatAlignedCutRatio < 0.5) suggestions.push('Usa "Alinear cortes al beat" para ajustar los cortes a la música.');
  if (placeholders.length > 0) suggestions.push('Resuelve los placeholders con el generador de imágenes (🖼️) antes de exportar.');
  if (gapSeconds > 1) suggestions.push('Cierra los huecos visuales arrastrando clips o extendiendo los adyacentes.');

  return {
    score,
    verdict: verdictFromScore(score),
    factors,
    issues,
    suggestions,
    stats: {
      visualClips: visual.length,
      videoClips: videoClips.length,
      stillClips: stillClips.length,
      placeholders: placeholders.length,
      avgClipSeconds: Number(avgClipSeconds.toFixed(2)),
      coveredSeconds: Number(coveredSeconds.toFixed(2)),
      gapSeconds: Number(gapSeconds.toFixed(2)),
      audioCoverageSeconds: Number(audioCoverageSeconds.toFixed(2)),
      beatAlignedCutRatio: beatAlignedCutRatio === null ? null : Number(beatAlignedCutRatio.toFixed(3)),
    },
  };
}

// ── Beat snap (alinear cortes al beat) ──

/**
 * Ajusta los puntos de corte de la capa visual al beat más cercano dentro de
 * la tolerancia. Mantiene la continuidad: el clip anterior se extiende/recorta
 * para que no queden huecos nuevos. Devuelve COPIAS (no muta).
 */
export function snapClipsToBeats(
  clips: TimelineClip[],
  beats: number[],
  options: { toleranceSec?: number; layerId?: number; minClipSec?: number } = {}
): BeatSnapResult {
  const tolerance = options.toleranceSec ?? 0.3;
  const layerId = options.layerId ?? VISUAL_LAYER;
  const minClip = options.minClipSec ?? 0.4;
  const validBeats = (beats || []).filter((b) => isFinite(b) && b >= 0).sort((a, b) => a - b);

  if (validBeats.length === 0) {
    return { clips, movedCount: 0, totalCutPoints: 0 };
  }

  const result = clips.map((c) => ({ ...c }));
  const layerClips = result
    .filter((c) => c.layerId === layerId && c.duration > 0)
    .sort((a, b) => a.start - b.start);

  let moved = 0;
  let totalCuts = 0;

  for (let i = 1; i < layerClips.length; i++) {
    const prev = layerClips[i - 1];
    const curr = layerClips[i];
    const cutPoint = curr.start;
    totalCuts++;

    // beat más cercano dentro de tolerancia
    let best: number | null = null;
    let bestDist = tolerance;
    for (const b of validBeats) {
      const d = Math.abs(b - cutPoint);
      if (d <= bestDist) { best = b; bestDist = d; }
      if (b > cutPoint + tolerance) break;
    }
    if (best === null || Math.abs(best - cutPoint) < 0.02) continue;

    const currEnd = curr.start + curr.duration;
    const newCurrDuration = currEnd - best;
    const wasTouching = Math.abs(prev.start + prev.duration - curr.start) < 0.05;
    const newPrevDuration = best - prev.start;

    // Guardas: nunca dejar clips por debajo del mínimo
    if (newCurrDuration < minClip) continue;
    if (wasTouching && newPrevDuration < minClip) continue;

    curr.start = best;
    curr.duration = newCurrDuration;
    if (wasTouching) prev.duration = newPrevDuration;
    moved++;
  }

  return { clips: result, movedCount: moved, totalCutPoints: totalCuts };
}
