/**
 * 🎵 Audio Analysis Service - OpenAI Whisper + Análisis Local
 * 
 * Analiza automáticamente la estructura musical para enriquecer la edición de video.
 * Este servicio se ejecuta automáticamente cuando el usuario sube audio
 * y proporciona información para sincronizar escenas con la música.
 * 
 * FLUJO:
 * 1. OpenAI Whisper → Transcribir letra con timestamps (identifica PERFORMANCE)
 * 2. Análisis de energía y estructura
 * 3. Combinar para identificar secciones con voz (PERFORMANCE) vs instrumentales (B-ROLL)
 * 
 * CAPACIDADES:
 * - Transcripción de letra con timestamps (Whisper)
 * - Detección de estructura (intro, verso, coro, bridge, outro)
 * - BPM estimado
 * - Momentos de alta energía (drops, climax)
 * - Beats y downbeats para sincronización
 * 
 * COSTO: ~$0.006/min (Whisper)
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { createTrackedOpenAI } from '../utils/tracked-openai';

const FAL_API_KEY = process.env.FAL_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Inicializar OpenAI client
const openai = OPENAI_API_KEY ? createTrackedOpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ========== INTERFACES ==========

export interface AudioSection {
  type: 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'breakdown' | 'solo' | 'outro' | 'instrumental';
  startTime: number;
  endTime: number;
  duration: number;
  energy: 'low' | 'medium' | 'high' | 'peak';
  description: string;
}

export interface InstrumentSegment {
  startTime: number;
  endTime: number;
  prominence: 'background' | 'supporting' | 'lead';
  isSolo: boolean;
}

export interface InstrumentAnalysis {
  name: string;
  segments: InstrumentSegment[];
}

export interface KeyMoment {
  timestamp: number;
  type: 'drop' | 'crescendo' | 'breakdown' | 'climax' | 'silence' | 'transition' | 'hook';
  intensity: number; // 1-10
  suggestedEffect: 'zoom_in' | 'zoom_out' | 'flash' | 'slow_motion' | 'fast_cuts' | 'shake' | 'glitch' | 'crossfade' | 'none';
  description: string;
}

export interface EnergyPoint {
  timestamp: number;
  level: number; // 0-100
}

export interface AudioAnalysisResult {
  // Metadata básica
  duration: number;
  bpm: number;
  key: string; // "C major", "A minor", etc.
  genre: string;
  mood: string[];
  
  // Estructura de la canción
  sections: AudioSection[];
  
  // Instrumentos detectados
  instruments: InstrumentAnalysis[];
  
  // Beats para sincronización
  beats: number[];
  downbeats: number[]; // Primer beat de cada compás
  
  // Momentos clave para efectos
  keyMoments: KeyMoment[];
  
  // Curva de energía para visualización
  energyCurve: EnergyPoint[];
  
  // 🎤 NUEVO: Transcripción de Whisper
  transcription?: TranscriptionResult;
  
  // Metadata de análisis
  analyzedAt: string;
  analysisVersion: string;
  rawResponse?: any;
}

// 🎤 Transcripción con timestamps de Whisper
export interface TranscriptionSegment {
  id: number;
  start: number;   // segundos
  end: number;     // segundos
  text: string;    // letra de ese segmento
  hasVocals: boolean; // true si tiene voz cantando
}

export interface TranscriptionResult {
  text: string;           // Letra completa
  language: string;       // Idioma detectado
  duration: number;       // Duración del audio
  segments: TranscriptionSegment[];
  vocalSegments: Array<{ start: number; end: number }>; // Rangos donde hay voz
}

export interface EditingRecommendations {
  // Recomendaciones para edición automática
  suggestedCutPoints: number[]; // Timestamps recomendados para cortes
  sceneDurationBySection: Record<string, number>; // Duración recomendada por tipo de sección
  transitionsByEnergy: Record<string, string>; // Tipo de transición según energía
}

// ========== SERVICIO PRINCIPAL ==========

/**
 * 🎵 Analiza un archivo de audio
 * 
 * FLUJO:
 * 1. OpenAI Whisper → Transcribir letra con timestamps
 * 2. Generar análisis de estructura basado en transcripción
 * 3. Identificar secciones PERFORMANCE (con voz) vs B-ROLL (instrumental)
 */
export async function analyzeAudio(audioUrl: string): Promise<AudioAnalysisResult> {
  logger.log(`[AudioAnalysis] 🎵 Iniciando análisis de audio: ${audioUrl.substring(0, 60)}...`);

  try {
    // ====== PASO 1: Transcribir con OpenAI Whisper ======
    let transcription: TranscriptionResult | undefined;
    
    if (openai && OPENAI_API_KEY) {
      logger.log('[AudioAnalysis] 🎤 Paso 1: Transcribiendo con OpenAI Whisper...');
      transcription = await transcribeWithWhisper(audioUrl);
      logger.log(`[AudioAnalysis] ✅ Transcripción completada:
        - Duración: ${transcription.duration}s
        - Idioma: ${transcription.language}
        - Segmentos: ${transcription.segments.length}
        - Segmentos con voz: ${transcription.vocalSegments.length}
      `);
    } else {
      logger.warn('[AudioAnalysis] ⚠️ OpenAI API key no configurada, saltando transcripción');
    }

    // ====== PASO 2: Generar análisis de estructura ======
    logger.log('[AudioAnalysis] 📊 Paso 2: Generando análisis de estructura...');
    
    const duration = transcription?.duration || 180;
    const bpm = 120; // BPM estimado por defecto
    
    // Generar secciones basadas en transcripción
    const sections = transcription 
      ? generateSectionsFromTranscription(transcription)
      : generateDefaultSections(duration);
    
    // Generar beats
    const beats = generateBeats(bpm, duration);
    const downbeats = beats.filter((_, i) => i % 4 === 0);
    
    // Detectar momentos clave
    const keyMoments = detectKeyMoments(sections);
    
    // Generar curva de energía
    const energyCurve = generateEnergyCurve(sections, duration);

    const analysis: AudioAnalysisResult = {
      duration,
      bpm,
      key: 'Unknown',
      genre: 'Unknown',
      mood: ['neutral'],
      sections,
      instruments: [],
      beats,
      downbeats,
      keyMoments,
      energyCurve,
      transcription,
      analyzedAt: new Date().toISOString(),
      analysisVersion: '2.0.0-whisper',
    };
    
    logger.log(`[AudioAnalysis] ✅ Análisis completado:
      - BPM: ${analysis.bpm}
      - Secciones: ${analysis.sections.length}
      - Key Moments: ${analysis.keyMoments.length}
      - Beats: ${analysis.beats.length}
      - Con transcripción: ${!!transcription}
    `);

    return analysis;

  } catch (error: any) {
    logger.error('[AudioAnalysis] ❌ Error en análisis:', error.message);
    
    // Fallback a análisis básico
    logger.warn('[AudioAnalysis] Usando análisis básico como fallback');
    return generateBasicAnalysis(audioUrl);
  }
}

// ========== TRANSCRIPCIÓN CON WHISPER ==========

/**
 * 🎤 Transcribe audio usando OpenAI Whisper
 * Devuelve letra con timestamps para identificar secciones PERFORMANCE
 * 
 * IMPORTANTE: Requiere URL HTTP(S) accesible - NO soporta blob: URLs
 */
async function transcribeWithWhisper(audioUrl: string): Promise<TranscriptionResult> {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  // Validar que NO sea una URL blob (estas son URLs del navegador, no accesibles desde servidor)
  if (audioUrl.startsWith('blob:')) {
    throw new Error('blob: URLs are not supported. Audio must be uploaded to Firebase or a public URL first.');
  }

  // Validar que sea una URL HTTP válida
  if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
    throw new Error(`Invalid audio URL protocol. Expected http:// or https://, got: ${audioUrl.substring(0, 20)}...`);
  }

  try {
    logger.log(`[Whisper] Descargando audio desde: ${audioUrl.substring(0, 80)}...`);
    
    // Descargar el audio desde la URL
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minutos para archivos grandes
      headers: {
        'User-Agent': 'Boostify-Music/1.0',
      },
    });
    
    logger.log(`[Whisper] Audio descargado: ${audioResponse.data.byteLength} bytes`);
    
    // Determinar el tipo de archivo por extensión o content-type
    const contentType = audioResponse.headers['content-type'] || 'audio/mpeg';
    const extension = audioUrl.includes('.wav') ? 'wav' : 
                      audioUrl.includes('.m4a') ? 'm4a' :
                      audioUrl.includes('.webm') ? 'webm' : 'mp3';
    
    // Crear un File-like object para Whisper
    const audioBuffer = Buffer.from(audioResponse.data);
    const audioFile = new File([audioBuffer], `audio.${extension}`, { type: contentType });

    // Llamar a Whisper con timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Parsear respuesta
    const segments: TranscriptionSegment[] = (transcription.segments || []).map((seg: any, i: number) => ({
      id: i,
      start: seg.start || 0,
      end: seg.end || 0,
      text: seg.text || '',
      hasVocals: (seg.text || '').trim().length > 0,
    }));

    // Identificar rangos con voz (para marcar PERFORMANCE)
    const vocalSegments: Array<{ start: number; end: number }> = [];
    let currentVocalStart: number | null = null;

    segments.forEach((seg, i) => {
      if (seg.hasVocals && seg.text.trim().length > 3) {
        if (currentVocalStart === null) {
          currentVocalStart = seg.start;
        }
      } else {
        if (currentVocalStart !== null) {
          vocalSegments.push({
            start: currentVocalStart,
            end: segments[i - 1]?.end || seg.start,
          });
          currentVocalStart = null;
        }
      }
    });

    // Cerrar último segmento si quedó abierto
    if (currentVocalStart !== null && segments.length > 0) {
      vocalSegments.push({
        start: currentVocalStart,
        end: segments[segments.length - 1].end,
      });
    }

    return {
      text: transcription.text || '',
      language: (transcription as any).language || 'unknown',
      duration: (transcription as any).duration || segments[segments.length - 1]?.end || 180,
      segments,
      vocalSegments,
    };

  } catch (error: any) {
    logger.error('[Whisper] Error transcribiendo:', error.message);
    throw error;
  }
}

/**
 * Genera secciones basadas en la transcripción de Whisper
 * Las secciones con voz se marcan como potenciales PERFORMANCE
 */
function generateSectionsFromTranscription(transcription: TranscriptionResult): AudioSection[] {
  const sections: AudioSection[] = [];
  const duration = transcription.duration;
  
  if (transcription.vocalSegments.length === 0) {
    // Sin voz detectada, usar estructura por defecto
    return generateDefaultSections(duration);
  }

  let lastEnd = 0;
  let sectionIndex = 0;

  transcription.vocalSegments.forEach((vocal, i) => {
    // Agregar sección instrumental antes de la voz (si hay gap)
    if (vocal.start > lastEnd + 2) {
      sections.push({
        type: sectionIndex === 0 ? 'intro' : 'instrumental',
        startTime: lastEnd,
        endTime: vocal.start,
        duration: vocal.start - lastEnd,
        energy: 'low',
        description: sectionIndex === 0 ? 'Intro instrumental' : 'Instrumental break',
      });
      sectionIndex++;
    }

    // Agregar sección con voz (PERFORMANCE candidate)
    const vocalDuration = vocal.end - vocal.start;
    let sectionType: AudioSection['type'] = 'verse';
    let energy: AudioSection['energy'] = 'medium';

    // Heurística simple para detectar coros vs versos
    if (vocalDuration > 20) {
      sectionType = 'verse';
      energy = 'medium';
    } else if (vocalDuration > 10) {
      sectionType = 'chorus';
      energy = 'high';
    } else {
      sectionType = 'pre-chorus';
      energy = 'medium';
    }

    sections.push({
      type: sectionType,
      startTime: vocal.start,
      endTime: vocal.end,
      duration: vocalDuration,
      energy,
      description: `${sectionType} - vocal performance`,
    });
    
    lastEnd = vocal.end;
    sectionIndex++;
  });

  // Agregar outro si queda tiempo
  if (lastEnd < duration - 2) {
    sections.push({
      type: 'outro',
      startTime: lastEnd,
      endTime: duration,
      duration: duration - lastEnd,
      energy: 'low',
      description: 'Outro',
    });
  }

  return sections;
}

/**
 * Parsea la respuesta de fal-ai a nuestro formato estructurado
 */
function parseAudioAnalysisResponse(rawData: any, audioUrl: string): AudioAnalysisResult {
  // Adaptar según el formato real de respuesta de fal-ai
  // Esta función se ajustará cuando veamos el formato exacto
  
  const duration = rawData.duration || rawData.audio_duration || 180;
  const bpm = rawData.bpm || rawData.tempo || 120;
  
  // Parsear secciones
  const sections: AudioSection[] = (rawData.sections || rawData.structure || []).map((s: any, i: number) => ({
    type: mapSectionType(s.label || s.type || 'verse'),
    startTime: s.start || s.start_time || (i * 30),
    endTime: s.end || s.end_time || ((i + 1) * 30),
    duration: (s.end || s.end_time || ((i + 1) * 30)) - (s.start || s.start_time || (i * 30)),
    energy: mapEnergy(s.energy || s.intensity || 'medium'),
    description: s.description || s.label || `Section ${i + 1}`,
  }));

  // Parsear instrumentos
  const instruments: InstrumentAnalysis[] = (rawData.instruments || []).map((inst: any) => ({
    name: inst.name || inst.instrument || 'unknown',
    segments: (inst.segments || inst.activations || []).map((seg: any) => ({
      startTime: seg.start || seg.start_time || 0,
      endTime: seg.end || seg.end_time || duration,
      prominence: mapProminence(seg.prominence || seg.level || 'supporting'),
      isSolo: seg.is_solo || seg.solo || false,
    })),
  }));

  // Parsear beats
  const beats: number[] = rawData.beats || rawData.beat_times || generateBeats(bpm, duration);
  const downbeats: number[] = rawData.downbeats || rawData.bar_starts || beats.filter((_, i) => i % 4 === 0);

  // Parsear momentos clave
  const keyMoments: KeyMoment[] = (rawData.key_moments || rawData.highlights || []).map((m: any) => ({
    timestamp: m.time || m.timestamp || 0,
    type: mapMomentType(m.type || m.label || 'transition'),
    intensity: m.intensity || m.strength || 5,
    suggestedEffect: suggestEffect(m.type || m.label, m.intensity || 5),
    description: m.description || m.label || '',
  }));

  // Generar curva de energía
  const energyCurve: EnergyPoint[] = rawData.energy_curve || generateEnergyCurve(sections, duration);

  return {
    duration,
    bpm,
    key: rawData.key || rawData.musical_key || 'Unknown',
    genre: rawData.genre || 'Unknown',
    mood: rawData.mood || rawData.moods || ['neutral'],
    sections: sections.length > 0 ? sections : generateDefaultSections(duration),
    instruments,
    beats,
    downbeats,
    keyMoments: keyMoments.length > 0 ? keyMoments : detectKeyMoments(sections),
    energyCurve,
    analyzedAt: new Date().toISOString(),
    analysisVersion: '1.0.0',
    rawResponse: rawData,
  };
}

// ========== FUNCIONES AUXILIARES ==========

function mapSectionType(label: string): AudioSection['type'] {
  const normalized = label.toLowerCase().trim();
  const mapping: Record<string, AudioSection['type']> = {
    'intro': 'intro',
    'verse': 'verse',
    'pre-chorus': 'pre-chorus',
    'prechorus': 'pre-chorus',
    'chorus': 'chorus',
    'hook': 'chorus',
    'bridge': 'bridge',
    'breakdown': 'breakdown',
    'drop': 'breakdown',
    'solo': 'solo',
    'instrumental': 'instrumental',
    'outro': 'outro',
    'ending': 'outro',
  };
  return mapping[normalized] || 'verse';
}

function mapEnergy(level: string | number): AudioSection['energy'] {
  if (typeof level === 'number') {
    if (level >= 80) return 'peak';
    if (level >= 60) return 'high';
    if (level >= 40) return 'medium';
    return 'low';
  }
  const normalized = level.toLowerCase();
  if (['peak', 'maximum', 'very high'].includes(normalized)) return 'peak';
  if (['high', 'energetic', 'intense'].includes(normalized)) return 'high';
  if (['medium', 'moderate', 'mid'].includes(normalized)) return 'medium';
  return 'low';
}

function mapProminence(level: string): InstrumentSegment['prominence'] {
  const normalized = level.toLowerCase();
  if (['lead', 'primary', 'main', 'solo'].includes(normalized)) return 'lead';
  if (['supporting', 'secondary', 'accompaniment'].includes(normalized)) return 'supporting';
  return 'background';
}

function mapMomentType(type: string): KeyMoment['type'] {
  const normalized = type.toLowerCase();
  const mapping: Record<string, KeyMoment['type']> = {
    'drop': 'drop',
    'bass drop': 'drop',
    'crescendo': 'crescendo',
    'build': 'crescendo',
    'buildup': 'crescendo',
    'breakdown': 'breakdown',
    'climax': 'climax',
    'peak': 'climax',
    'silence': 'silence',
    'pause': 'silence',
    'hook': 'hook',
    'transition': 'transition',
  };
  return mapping[normalized] || 'transition';
}

function suggestEffect(type: string, intensity: number): KeyMoment['suggestedEffect'] {
  const normalized = type.toLowerCase();
  
  if (['drop', 'bass drop'].includes(normalized)) {
    return intensity > 7 ? 'shake' : 'zoom_in';
  }
  if (['climax', 'peak'].includes(normalized)) {
    return 'flash';
  }
  if (['breakdown'].includes(normalized)) {
    return 'slow_motion';
  }
  if (intensity > 8) {
    return 'glitch';
  }
  if (intensity > 5) {
    return 'fast_cuts';
  }
  return 'crossfade';
}

function generateBeats(bpm: number, duration: number): number[] {
  const beatInterval = 60 / bpm;
  const beats: number[] = [];
  for (let t = 0; t < duration; t += beatInterval) {
    beats.push(Math.round(t * 1000) / 1000);
  }
  return beats;
}

function generateEnergyCurve(sections: AudioSection[], duration: number): EnergyPoint[] {
  const curve: EnergyPoint[] = [];
  const step = 1; // 1 segundo
  
  for (let t = 0; t <= duration; t += step) {
    const section = sections.find(s => t >= s.startTime && t < s.endTime);
    const energyMap = { 'low': 25, 'medium': 50, 'high': 75, 'peak': 95 };
    const level = section ? energyMap[section.energy] : 50;
    
    // Añadir variación natural
    const variation = Math.sin(t * 0.5) * 5 + Math.random() * 5;
    curve.push({
      timestamp: t,
      level: Math.max(0, Math.min(100, level + variation)),
    });
  }
  
  return curve;
}

function generateDefaultSections(duration: number): AudioSection[] {
  // Estructura típica de canción pop
  const structure = [
    { type: 'intro', percentage: 0.05, energy: 'low' as const },
    { type: 'verse', percentage: 0.15, energy: 'medium' as const },
    { type: 'pre-chorus', percentage: 0.08, energy: 'high' as const },
    { type: 'chorus', percentage: 0.15, energy: 'peak' as const },
    { type: 'verse', percentage: 0.12, energy: 'medium' as const },
    { type: 'pre-chorus', percentage: 0.08, energy: 'high' as const },
    { type: 'chorus', percentage: 0.15, energy: 'peak' as const },
    { type: 'bridge', percentage: 0.10, energy: 'medium' as const },
    { type: 'chorus', percentage: 0.10, energy: 'peak' as const },
    { type: 'outro', percentage: 0.02, energy: 'low' as const },
  ];
  
  const sections: AudioSection[] = [];
  let currentTime = 0;
  
  structure.forEach((s, i) => {
    const sectionDuration = duration * s.percentage;
    sections.push({
      type: s.type as AudioSection['type'],
      startTime: currentTime,
      endTime: currentTime + sectionDuration,
      duration: sectionDuration,
      energy: s.energy,
      description: `${s.type.charAt(0).toUpperCase() + s.type.slice(1)} section`,
    });
    currentTime += sectionDuration;
  });
  
  return sections;
}

function detectKeyMoments(sections: AudioSection[]): KeyMoment[] {
  const moments: KeyMoment[] = [];
  
  sections.forEach((section, i) => {
    // Detectar cambios de sección como momentos clave
    if (i > 0) {
      const prevSection = sections[i - 1];
      if (section.energy !== prevSection.energy) {
        moments.push({
          timestamp: section.startTime,
          type: section.energy === 'peak' ? 'climax' : 'transition',
          intensity: section.energy === 'peak' ? 8 : 5,
          suggestedEffect: section.energy === 'peak' ? 'zoom_in' : 'crossfade',
          description: `Transition from ${prevSection.type} to ${section.type}`,
        });
      }
    }
    
    // Marcar coros como hooks
    if (section.type === 'chorus' && section.energy === 'peak') {
      moments.push({
        timestamp: section.startTime,
        type: 'hook',
        intensity: 9,
        suggestedEffect: 'flash',
        description: 'Chorus hook - high energy moment',
      });
    }
  });
  
  return moments;
}

/**
 * Genera análisis básico cuando fal-ai no está disponible
 */
async function generateBasicAnalysis(audioUrl: string): Promise<AudioAnalysisResult> {
  logger.warn('[AudioAnalysis] Generando análisis básico (sin fal-ai)');
  
  // Duración estimada por defecto (se puede mejorar con ffprobe)
  const duration = 180; // 3 minutos default
  const bpm = 120;
  
  return {
    duration,
    bpm,
    key: 'Unknown',
    genre: 'Unknown',
    mood: ['neutral'],
    sections: generateDefaultSections(duration),
    instruments: [],
    beats: generateBeats(bpm, duration),
    downbeats: generateBeats(bpm, duration).filter((_, i) => i % 4 === 0),
    keyMoments: [],
    energyCurve: generateEnergyCurve(generateDefaultSections(duration), duration),
    analyzedAt: new Date().toISOString(),
    analysisVersion: '1.0.0-basic',
  };
}

// ========== UTILIDADES PARA EDICIÓN ==========

/**
 * Genera recomendaciones de edición basadas en el análisis
 */
export function generateEditingRecommendations(analysis: AudioAnalysisResult): EditingRecommendations {
  // Puntos de corte recomendados = downbeats cada 2-4 compases
  const cutPoints = analysis.downbeats.filter((_, i) => i % 2 === 0);
  
  // Duración de escena por tipo de sección
  const sceneDurationBySection: Record<string, number> = {
    'intro': 4,      // 4 beats (más lento)
    'verse': 2,      // 2 beats (storytelling)
    'pre-chorus': 2, // 2 beats (building)
    'chorus': 1,     // 1 beat (energético)
    'bridge': 4,     // 4 beats (reflexión)
    'breakdown': 2,  // 2 beats (dramático)
    'solo': 8,       // 8 beats (spotlight)
    'outro': 4,      // 4 beats (cierre)
    'instrumental': 4,
  };
  
  // Transiciones según energía
  const transitionsByEnergy: Record<string, string> = {
    'low': 'slow_dissolve',
    'medium': 'crossfade',
    'high': 'fast_fade',
    'peak': 'cut', // Corte abrupto en alta energía
  };
  
  return {
    suggestedCutPoints: cutPoints,
    sceneDurationBySection,
    transitionsByEnergy,
  };
}

/**
 * Obtiene el instrumento dominante en un timestamp específico
 */
export function getDominantInstrumentAt(analysis: AudioAnalysisResult, timestamp: number): string | null {
  for (const instrument of analysis.instruments) {
    const activeSegment = instrument.segments.find(
      seg => timestamp >= seg.startTime && timestamp < seg.endTime && seg.prominence === 'lead'
    );
    if (activeSegment) {
      return instrument.name;
    }
  }
  return null;
}

/**
 * Obtiene la sección musical en un timestamp
 */
export function getSectionAt(analysis: AudioAnalysisResult, timestamp: number): AudioSection | null {
  return analysis.sections.find(
    s => timestamp >= s.startTime && timestamp < s.endTime
  ) || null;
}

/**
 * Encuentra el beat más cercano a un timestamp
 */
export function getNearestBeat(analysis: AudioAnalysisResult, timestamp: number): number {
  if (analysis.beats.length === 0) return timestamp;
  
  let nearest = analysis.beats[0];
  let minDiff = Math.abs(timestamp - nearest);
  
  for (const beat of analysis.beats) {
    const diff = Math.abs(timestamp - beat);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = beat;
    }
  }
  
  return nearest;
}

/**
 * Snap un timestamp al beat más cercano
 */
export function snapToBeat(analysis: AudioAnalysisResult, timestamp: number, threshold: number = 0.2): number {
  const nearest = getNearestBeat(analysis, timestamp);
  if (Math.abs(timestamp - nearest) <= threshold) {
    return nearest;
  }
  return timestamp;
}

export default {
  analyzeAudio,
  generateEditingRecommendations,
  getDominantInstrumentAt,
  getSectionAt,
  getNearestBeat,
  snapToBeat,
};
