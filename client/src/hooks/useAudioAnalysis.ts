/**
 * 🎵 useAudioAnalysis Hook
 * 
 * Hook para integrar el análisis de audio en componentes React.
 * Proporciona información musical para sincronizar la edición de video.
 * 
 * USO:
 * const { analysis, isAnalyzing, analyzeAudio } = useAudioAnalysis();
 * 
 * // Analizar cuando se sube audio
 * useEffect(() => {
 *   if (audioUrl) analyzeAudio(audioUrl);
 * }, [audioUrl]);
 * 
 * // Usar en el timeline
 * const section = analysis?.sections.find(s => currentTime >= s.startTime && currentTime < s.endTime);
 */

import { useState, useCallback, useRef } from 'react';

// ========== TIPOS ==========

export interface AudioSection {
  type: 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'breakdown' | 'solo' | 'outro' | 'instrumental';
  startTime: number;
  endTime: number;
  duration: number;
  energy: 'low' | 'medium' | 'high' | 'peak';
  description: string;
}

export interface KeyMoment {
  timestamp: number;
  type: 'drop' | 'crescendo' | 'breakdown' | 'climax' | 'silence' | 'transition' | 'hook';
  intensity: number;
  suggestedEffect: string;
  description: string;
}

export interface AudioAnalysis {
  duration: number;
  bpm: number;
  key: string;
  genre: string;
  mood: string[];
  sections: AudioSection[];
  instruments: Array<{
    name: string;
    segments: Array<{
      startTime: number;
      endTime: number;
      prominence: 'background' | 'supporting' | 'lead';
      isSolo: boolean;
    }>;
  }>;
  beats: number[];
  downbeats: number[];
  keyMoments: KeyMoment[];
  energyCurve: Array<{ timestamp: number; level: number }>;
}

export interface EditingRecommendations {
  suggestedCutPoints: number[];
  sceneDurationBySection: Record<string, number>;
  transitionsByEnergy: Record<string, string>;
}

interface UseAudioAnalysisReturn {
  analysis: AudioAnalysis | null;
  recommendations: EditingRecommendations | null;
  isAnalyzing: boolean;
  error: string | null;
  analyzeAudio: (audioUrl: string, projectId?: string) => Promise<void>;
  clearAnalysis: () => void;
  
  // Utilidades
  getSectionAt: (timestamp: number) => AudioSection | null;
  getDominantInstrumentAt: (timestamp: number) => string | null;
  getNearestBeat: (timestamp: number) => number;
  snapToBeat: (timestamp: number, threshold?: number) => number;
  isKeyMomentNear: (timestamp: number, threshold?: number) => KeyMoment | null;
  getEnergyAt: (timestamp: number) => number;
}

// ========== HOOK ==========

export function useAudioAnalysis(): UseAudioAnalysisReturn {
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<EditingRecommendations | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache de análisis por URL
  const cacheRef = useRef<Map<string, { analysis: AudioAnalysis; recommendations: EditingRecommendations }>>(new Map());

  /**
   * Analiza un archivo de audio
   * IMPORTANTE: Requiere URL HTTP(S) - NO soporta blob: URLs
   */
  const analyzeAudio = useCallback(async (audioUrl: string, projectId?: string) => {
    // ⚠️ Validar que NO sea una URL blob
    if (audioUrl.startsWith('blob:')) {
      console.error('[useAudioAnalysis] blob: URLs are not supported. Audio must be uploaded to Firebase first.');
      setError('Audio must be uploaded before analysis. Please wait for upload to complete.');
      return;
    }

    // Validar que sea una URL HTTP válida
    if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
      console.error('[useAudioAnalysis] Invalid audio URL protocol:', audioUrl.substring(0, 30));
      setError('Invalid audio URL. Must be a valid HTTP/HTTPS URL.');
      return;
    }

    // 🔥 Proxy Firebase Storage URLs so the backend can fetch them reliably
    // Firebase Storage URLs are public but may have CORS restrictions for direct fetch calls
    let resolvedUrl = audioUrl;
    if (
      audioUrl.includes('firebasestorage.googleapis.com') ||
      audioUrl.includes('storage.googleapis.com')
    ) {
      // Strip extra params that might cause signature mismatches, keep the token
      try {
        const parsed = new URL(audioUrl);
        const token = parsed.searchParams.get('token');
        const cleanUrl = token
          ? `${parsed.origin}${parsed.pathname}?token=${token}`
          : `${parsed.origin}${parsed.pathname}`;
        resolvedUrl = cleanUrl;
        console.log('[useAudioAnalysis] Cleaned Firebase URL for analysis');
      } catch {
        // Keep original if URL parsing fails
      }
    }

    // Verificar cache
    const cacheKey = projectId || resolvedUrl;
    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)!;
      setAnalysis(cached.analysis);
      setRecommendations(cached.recommendations);
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('[useAudioAnalysis] Analyzing audio:', resolvedUrl.substring(0, 60));
      
      const response = await fetch('/api/audio-analysis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl: resolvedUrl, projectId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setAnalysis(data.analysis);
        setRecommendations(data.recommendations);
        
        // Guardar en cache
        cacheRef.current.set(cacheKey, {
          analysis: data.analysis,
          recommendations: data.recommendations,
        });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('[useAudioAnalysis] Error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  /**
   * Limpia el análisis actual
   */
  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setRecommendations(null);
    setError(null);
  }, []);

  // ========== UTILIDADES ==========

  /**
   * Obtiene la sección musical en un timestamp
   */
  const getSectionAt = useCallback((timestamp: number): AudioSection | null => {
    if (!analysis) return null;
    return analysis.sections.find(
      s => timestamp >= s.startTime && timestamp < s.endTime
    ) || null;
  }, [analysis]);

  /**
   * Obtiene el instrumento dominante en un timestamp
   */
  const getDominantInstrumentAt = useCallback((timestamp: number): string | null => {
    if (!analysis) return null;
    
    for (const instrument of analysis.instruments) {
      const activeSegment = instrument.segments.find(
        seg => timestamp >= seg.startTime && timestamp < seg.endTime && seg.prominence === 'lead'
      );
      if (activeSegment) {
        return instrument.name;
      }
    }
    return null;
  }, [analysis]);

  /**
   * Encuentra el beat más cercano
   */
  const getNearestBeat = useCallback((timestamp: number): number => {
    if (!analysis || analysis.beats.length === 0) return timestamp;
    
    return analysis.beats.reduce((prev, curr) => 
      Math.abs(curr - timestamp) < Math.abs(prev - timestamp) ? curr : prev
    );
  }, [analysis]);

  /**
   * Ajusta un timestamp al beat más cercano si está dentro del threshold
   */
  const snapToBeat = useCallback((timestamp: number, threshold: number = 0.2): number => {
    if (!analysis) return timestamp;
    
    const nearest = getNearestBeat(timestamp);
    if (Math.abs(timestamp - nearest) <= threshold) {
      return nearest;
    }
    return timestamp;
  }, [analysis, getNearestBeat]);

  /**
   * Verifica si hay un key moment cerca del timestamp
   */
  const isKeyMomentNear = useCallback((timestamp: number, threshold: number = 1.0): KeyMoment | null => {
    if (!analysis) return null;
    
    return analysis.keyMoments.find(
      km => Math.abs(km.timestamp - timestamp) <= threshold
    ) || null;
  }, [analysis]);

  /**
   * Obtiene el nivel de energía en un timestamp (0-100)
   */
  const getEnergyAt = useCallback((timestamp: number): number => {
    if (!analysis || analysis.energyCurve.length === 0) return 50;
    
    // Encontrar el punto más cercano en la curva
    const nearest = analysis.energyCurve.reduce((prev, curr) => 
      Math.abs(curr.timestamp - timestamp) < Math.abs(prev.timestamp - timestamp) ? curr : prev
    );
    
    return nearest.level;
  }, [analysis]);

  return {
    analysis,
    recommendations,
    isAnalyzing,
    error,
    analyzeAudio,
    clearAnalysis,
    getSectionAt,
    getDominantInstrumentAt,
    getNearestBeat,
    snapToBeat,
    isKeyMomentNear,
    getEnergyAt,
  };
}

// ========== UTILIDADES ADICIONALES ==========

/**
 * Colores por tipo de sección para visualización en timeline
 */
export const SECTION_COLORS: Record<AudioSection['type'], string> = {
  intro: '#6366f1',      // Indigo
  verse: '#10b981',      // Emerald
  'pre-chorus': '#f59e0b', // Amber
  chorus: '#ef4444',     // Red (alta energía)
  bridge: '#8b5cf6',     // Violet
  breakdown: '#06b6d4',  // Cyan
  solo: '#f97316',       // Orange
  outro: '#6b7280',      // Gray
  instrumental: '#3b82f6', // Blue
};

/**
 * Iconos sugeridos por tipo de instrumento
 */
export const INSTRUMENT_ICONS: Record<string, string> = {
  vocals: '🎤',
  guitar: '🎸',
  electric_guitar: '🎸',
  acoustic_guitar: '🎸',
  bass: '🎸',
  drums: '🥁',
  piano: '🎹',
  keyboard: '🎹',
  synth: '🎹',
  strings: '🎻',
  violin: '🎻',
  brass: '🎺',
  trumpet: '🎺',
  saxophone: '🎷',
  percussion: '🥁',
  default: '🎵',
};

/**
 * Obtiene el icono de un instrumento
 */
export function getInstrumentIcon(instrument: string): string {
  const normalized = instrument.toLowerCase().replace(/[_-]/g, '');
  return INSTRUMENT_ICONS[normalized] || INSTRUMENT_ICONS.default;
}

export default useAudioAnalysis;
