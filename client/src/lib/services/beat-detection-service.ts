/**
 * Beat Detection Service
 * Detecta beats en audio y sincroniza clips automáticamente
 */

import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';
import { logger } from "../logger";

export interface Beat {
  time: number;
  energy: number;
  confidence: number;
}

export interface BeatAnalysis {
  beats: Beat[];
  bpm: number;
  energy: number[];
  sections: MusicSection[];
}

export interface MusicSection {
  start: number;
  duration: number;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  energy: number;
}

/**
 * Detectar beats en un archivo de audio
 */
export async function detectBeats(audioUrl: string): Promise<BeatAnalysis> {
  try {
    // Cargar audio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Analizar audio
    const analysis = analyzeAudioBuffer(audioBuffer);
    
    return analysis;
  } catch (error) {
    logger.error('Error detectando beats:', error);
    
    // Fallback: generar beats sintéticos a 120 BPM
    return generateSyntheticBeats(120, 120);
  }
}

/**
 * Analizar buffer de audio para encontrar beats
 */
function analyzeAudioBuffer(audioBuffer: AudioBuffer): BeatAnalysis {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // Calcular energía por frame
  const frameSize = Math.floor(sampleRate * 0.05); // 50ms frames
  const energyLevels: number[] = [];

  for (let i = 0; i < channelData.length; i += frameSize) {
    let energy = 0;
    for (let j = 0; j < frameSize && i + j < channelData.length; j++) {
      energy += Math.abs(channelData[i + j]);
    }
    energyLevels.push(energy / frameSize);
  }

  // Detectar picos de energía como beats
  const beats = detectEnergyPeaks(energyLevels, sampleRate, frameSize);

  // Calcular BPM
  const bpm = calculateBPM(beats);

  // Detectar secciones musicales
  const sections = detectMusicSections(energyLevels, duration);

  return {
    beats,
    bpm,
    energy: energyLevels,
    sections
  };
}

/**
 * Detectar picos de energía
 */
function detectEnergyPeaks(
  energyLevels: number[],
  sampleRate: number,
  frameSize: number
): Beat[] {
  const beats: Beat[] = [];
  const threshold = calculateDynamicThreshold(energyLevels);

  for (let i = 1; i < energyLevels.length - 1; i++) {
    const prev = energyLevels[i - 1];
    const curr = energyLevels[i];
    const next = energyLevels[i + 1];

    // Es un pico si es mayor que vecinos y supera threshold
    if (curr > prev && curr > next && curr > threshold) {
      const time = (i * frameSize) / sampleRate;
      beats.push({
        time,
        energy: curr,
        confidence: Math.min(curr / (threshold * 2), 1)
      });
    }
  }

  return beats;
}

/**
 * Calcular threshold dinámico
 */
function calculateDynamicThreshold(energyLevels: number[]): number {
  const avg = energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length;
  const variance = energyLevels.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / energyLevels.length;
  const stdDev = Math.sqrt(variance);
  
  return avg + stdDev * 1.5;
}

/**
 * Calcular BPM desde beats
 */
function calculateBPM(beats: Beat[]): number {
  if (beats.length < 2) return 120; // Default

  // Calcular intervalos entre beats
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i].time - beats[i - 1].time);
  }

  // Usar mediana para robustez
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];

  // Convertir a BPM
  const bpm = 60 / median;

  return Math.round(bpm);
}

/**
 * Detectar secciones musicales
 */
function detectMusicSections(
  energyLevels: number[],
  duration: number
): MusicSection[] {
  const sections: MusicSection[] = [];
  const windowSize = 20; // 20 frames por ventana

  // Dividir en segmentos y calcular energía promedio
  for (let i = 0; i < energyLevels.length; i += windowSize) {
    const window = energyLevels.slice(i, i + windowSize);
    const avgEnergy = window.reduce((a, b) => a + b, 0) / window.length;
    
    const time = (i / energyLevels.length) * duration;
    const segmentDuration = (windowSize / energyLevels.length) * duration;

    // Clasificar tipo de sección por posición y energía
    let type: MusicSection['type'] = 'verse';
    if (i === 0) type = 'intro';
    else if (i >= energyLevels.length - windowSize) type = 'outro';
    else if (avgEnergy > 0.7) type = 'chorus';
    else if (avgEnergy < 0.3) type = 'bridge';

    sections.push({
      start: time,
      duration: segmentDuration,
      type,
      energy: avgEnergy
    });
  }

  return mergeSimilarSections(sections);
}

/**
 * Fusionar secciones similares consecutivas
 */
function mergeSimilarSections(sections: MusicSection[]): MusicSection[] {
  if (sections.length === 0) return [];

  const merged: MusicSection[] = [sections[0]];

  for (let i = 1; i < sections.length; i++) {
    const current = sections[i];
    const last = merged[merged.length - 1];

    if (current.type === last.type) {
      // Fusionar con la última sección
      last.duration += current.duration;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Generar beats sintéticos (fallback)
 */
function generateSyntheticBeats(bpm: number, duration: number): BeatAnalysis {
  const beatInterval = 60 / bpm;
  const beats: Beat[] = [];

  for (let time = 0; time < duration; time += beatInterval) {
    beats.push({
      time,
      energy: 0.5,
      confidence: 0.5
    });
  }

  return {
    beats,
    bpm,
    energy: [],
    sections: [
      { start: 0, duration: duration * 0.2, type: 'intro', energy: 0.3 },
      { start: duration * 0.2, duration: duration * 0.3, type: 'verse', energy: 0.5 },
      { start: duration * 0.5, duration: duration * 0.2, type: 'chorus', energy: 0.8 },
      { start: duration * 0.7, duration: duration * 0.2, type: 'verse', energy: 0.5 },
      { start: duration * 0.9, duration: duration * 0.1, type: 'outro', energy: 0.3 }
    ]
  };
}

/**
 * Alinear clips a beats automáticamente
 */
export function alignClipsToBeats(
  clips: TimelineClip[],
  beats: Beat[]
): TimelineClip[] {
  if (beats.length === 0) return clips;

  // Solo alinear clips de video/imagen
  const visualClips = clips.filter(c => c.type === 'video' || c.type === 'image');
  const audioClips = clips.filter(c => c.type === 'audio');

  // Alinear cada clip al beat más cercano
  const alignedVisualClips = visualClips.map(clip => {
    const nearestBeat = findNearestBeat(clip.start, beats);
    
    return {
      ...clip,
      start: nearestBeat.time
    };
  });

  return [...alignedVisualClips, ...audioClips];
}

/**
 * Encontrar beat más cercano a un tiempo
 */
function findNearestBeat(time: number, beats: Beat[]): Beat {
  let nearest = beats[0];
  let minDiff = Math.abs(time - beats[0].time);

  for (const beat of beats) {
    const diff = Math.abs(time - beat.time);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = beat;
    }
  }

  return nearest;
}

/**
 * Sugerir cortes basados en beats
 */
export function suggestCutsOnBeats(
  duration: number,
  beats: Beat[],
  targetClipCount: number = 20
): number[] {
  // Filtrar beats con alta confianza
  const significantBeats = beats.filter(b => b.confidence > 0.6);

  // Seleccionar beats distribuidos uniformemente
  const step = Math.floor(significantBeats.length / targetClipCount);
  const cutTimes: number[] = [];

  for (let i = 0; i < targetClipCount && i * step < significantBeats.length; i++) {
    cutTimes.push(significantBeats[i * step].time);
  }

  return cutTimes;
}

export default {
  detectBeats,
  alignClipsToBeats,
  suggestCutsOnBeats,
  calculateBPM,
  detectMusicSections
};
