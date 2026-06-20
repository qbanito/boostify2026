/**
 * Subtitle Generation Service
 * Genera subtítulos automáticos desde la transcripción con timing
 */

import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';

export interface SubtitleLine {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  lines: SubtitleLine[];
}

export interface TranscriptionSegment {
  text: string;
  start?: number;
  end?: number;
  timestamp?: string;
}

/**
 * Generar subtítulos desde transcripción con timing
 */
export function generateSubtitlesFromTranscription(
  transcription: string,
  duration: number,
  options: {
    maxWordsPerLine?: number;
    minDisplayTime?: number;
    maxDisplayTime?: number;
  } = {}
): SubtitleLine[] {
  const {
    maxWordsPerLine = 8,
    minDisplayTime = 1.5,
    maxDisplayTime = 5
  } = options;

  // Dividir transcripción en oraciones
  const sentences = splitIntoSentences(transcription);
  
  // Calcular timing para cada línea
  const subtitles: SubtitleLine[] = [];
  const timePerSentence = duration / sentences.length;

  sentences.forEach((text, index) => {
    const words = text.trim().split(/\s+/);
    
    // Si la oración es muy larga, dividirla
    if (words.length > maxWordsPerLine) {
      const chunks = chunkWords(words, maxWordsPerLine);
      const timePerChunk = timePerSentence / chunks.length;
      
      chunks.forEach((chunk, chunkIndex) => {
        const start = index * timePerSentence + chunkIndex * timePerChunk;
        const end = Math.min(start + Math.min(timePerChunk, maxDisplayTime), duration);
        
        subtitles.push({
          id: `sub-${index}-${chunkIndex}`,
          start,
          end,
          text: chunk.join(' ')
        });
      });
    } else {
      const start = index * timePerSentence;
      const displayTime = Math.max(
        minDisplayTime,
        Math.min(words.length * 0.4, maxDisplayTime)
      );
      const end = Math.min(start + displayTime, duration);
      
      subtitles.push({
        id: `sub-${index}`,
        start,
        end,
        text: text.trim()
      });
    }
  });

  return subtitles;
}

/**
 * Dividir texto en oraciones
 */
function splitIntoSentences(text: string): string[] {
  // Dividir por puntos, signos de exclamación y pregunta
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Dividir palabras en chunks
 */
function chunkWords(words: string[], maxWords: number): string[][] {
  const chunks: string[][] = [];
  
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords));
  }
  
  return chunks;
}

/**
 * Generar subtítulos desde script JSON (si tiene timing)
 */
export function generateSubtitlesFromScript(
  script: any,
  duration: number
): SubtitleLine[] {
  if (!script || !script.scenes) {
    return [];
  }

  const subtitles: SubtitleLine[] = [];
  const timePerScene = duration / script.scenes.length;

  script.scenes.forEach((scene: any, index: number) => {
    if (scene.lyrics || scene.dialogue) {
      const text = scene.lyrics || scene.dialogue;
      const start = scene.timestamp || (index * timePerScene);
      const end = scene.endTime || (start + timePerScene);

      subtitles.push({
        id: `scene-${index}`,
        start,
        end,
        text: text.trim()
      });
    }
  });

  return subtitles;
}

/**
 * Convertir subtítulos a formato SRT
 */
export function convertToSRT(subtitles: SubtitleLine[]): string {
  let srt = '';

  subtitles.forEach((line, index) => {
    const startTime = formatSRTTime(line.start);
    const endTime = formatSRTTime(line.end);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${line.text}\n\n`;
  });

  return srt;
}

/**
 * Convertir subtítulos a formato VTT
 */
export function convertToVTT(subtitles: SubtitleLine[]): string {
  let vtt = 'WEBVTT\n\n';

  subtitles.forEach((line) => {
    const startTime = formatVTTTime(line.start);
    const endTime = formatVTTTime(line.end);

    vtt += `${startTime} --> ${endTime}\n`;
    vtt += `${line.text}\n\n`;
  });

  return vtt;
}

/**
 * Formatear tiempo para SRT (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

/**
 * Formatear tiempo para VTT (HH:MM:SS.mmm)
 */
function formatVTTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)}.${pad(ms, 3)}`;
}

/**
 * Padding helper
 */
function pad(num: number, size: number): string {
  return num.toString().padStart(size, '0');
}

/**
 * Crear clip de subtítulos para el timeline
 */
export function createSubtitleClip(
  subtitle: SubtitleLine,
  trackId: string
): TimelineClip {
  return {
    id: subtitle.id,
    title: subtitle.text.substring(0, 30) + (subtitle.text.length > 30 ? '...' : ''),
    type: 'text',
    start: subtitle.start,
    duration: subtitle.end - subtitle.start,
    url: '', // Los subtítulos no necesitan URL
    trackId,
    color: '#f59e0b',
    metadata: {
      text: subtitle.text,
      subtitleLine: true
    }
  };
}

/**
 * Crear track de subtítulos para el timeline
 */
export function createSubtitleTrack(): {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'mix';
  visible: boolean;
  locked: boolean;
} {
  return {
    id: 'subtitle-track',
    name: 'Subtítulos',
    type: 'mix',
    visible: true,
    locked: false
  };
}

/**
 * Alinear subtítulos con beats
 */
export function alignSubtitlesWithBeats(
  subtitles: SubtitleLine[],
  beats: Array<{ time: number }>
): SubtitleLine[] {
  return subtitles.map(subtitle => {
    // Encontrar beat más cercano al inicio
    const nearestBeat = beats.reduce((nearest, beat) => {
      const currentDiff = Math.abs(subtitle.start - beat.time);
      const nearestDiff = Math.abs(subtitle.start - nearest.time);
      return currentDiff < nearestDiff ? beat : nearest;
    }, beats[0]);

    return {
      ...subtitle,
      start: nearestBeat.time,
      end: nearestBeat.time + (subtitle.end - subtitle.start)
    };
  });
}

export default {
  generateSubtitlesFromTranscription,
  generateSubtitlesFromScript,
  convertToSRT,
  convertToVTT,
  createSubtitleClip,
  createSubtitleTrack,
  alignSubtitlesWithBeats
};
