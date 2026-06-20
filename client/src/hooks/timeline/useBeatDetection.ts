import { useState, useEffect, useCallback, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

export interface BeatDetectionOptions {
  /**
   * Sensibilidad de detección de beats (0-1)
   * Valores más altos detectan más beats
   */
  sensitivity?: number;
  
  /**
   * Umbral de energía para considerar un beat
   */
  threshold?: number;
  
  /**
   * Tiempo mínimo entre beats en segundos
   */
  minTimeBetweenBeats?: number;
  
  /**
   * Tiempo de análisis en segundos
   * Cuánto tiempo analizar para el cálculo de energía promedio
   */
  analysisTime?: number;
  
  /**
   * Callback que se ejecuta cuando se detectan los beats
   */
  onBeatsDetected?: (beats: number[]) => void;
  
  /**
   * Instancia de WaveSurfer para analizar
   */
  wavesurfer?: WaveSurfer | null;
}

/**
 * Hook para la detección automática de beats en audio
 * 
 * Este hook proporciona:
 * - Detección automática de beats usando análisis de energía de audio
 * - Detección de BPM (beats por minuto)
 * - Posiciones de beats en segundos
 * - Controles para ajustar manualmente el BPM
 */
export function useBeatDetection({
  sensitivity = 0.5,
  threshold = 0.01,
  minTimeBetweenBeats = 0.3,
  analysisTime = 5,
  onBeatsDetected,
  wavesurfer = null
}: BeatDetectionOptions = {}) {
  // Estado para los beats detectados y el BPM
  const [beats, setBeats] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number>(0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [manualBpm, setManualBpm] = useState<number>(120); // BPM predeterminado para ajuste manual
  const [isUsingManualBpm, setIsUsingManualBpm] = useState<boolean>(false);
  
  // Referencias para los datos de análisis
  const audioDataRef = useRef<Float32Array | null>(null);
  const sampleRateRef = useRef<number>(44100);
  
  /**
   * Actualiza la sensibilidad de la detección
   */
  const updateSensitivity = useCallback((newSensitivity: number) => {
    // Asegurar que esté en el rango 0-1
    const normalizedSensitivity = Math.max(0, Math.min(1, newSensitivity));
    
    // Si tenemos datos de audio, volver a detectar con la nueva sensibilidad
    if (audioDataRef.current && !isUsingManualBpm) {
      detectBeats(audioDataRef.current, sampleRateRef.current, normalizedSensitivity);
    }
  }, [isUsingManualBpm]);
  
  /**
   * Algoritmo para detectar beats basado en análisis de energía
   */
  const detectBeats = useCallback((
    audioData: Float32Array, 
    sampleRate: number, 
    currentSensitivity: number
  ) => {
    setIsDetecting(true);
    
    // Almacenar los datos para reutilizarlos
    audioDataRef.current = audioData;
    sampleRateRef.current = sampleRate;
    
    // Tamaño de la ventana deslizante para análisis (100ms)
    const windowSize = Math.floor(sampleRate * 0.1);
    const detectedBeats: number[] = [];
    
    // Calcular la energía promedio de todo el fragmento
    let totalEnergy = 0;
    for (let i = 0; i < audioData.length; i++) {
      totalEnergy += audioData[i] * audioData[i];
    }
    const averageEnergy = totalEnergy / audioData.length;
    
    // Ajustar el umbral basado en la sensibilidad y la energía promedio
    const adjustedThreshold = averageEnergy + (threshold * currentSensitivity * 10);
    
    // Tiempo mínimo entre beats en muestras
    const minSamplesBetweenBeats = Math.floor(minTimeBetweenBeats * sampleRate);
    
    // Ventana deslizante para detectar picos de energía
    let lastBeatPosition = -minSamplesBetweenBeats;
    
    for (let i = 0; i < audioData.length - windowSize; i += windowSize / 2) {
      // Calcular la energía de la ventana actual
      let windowEnergy = 0;
      for (let j = 0; j < windowSize; j++) {
        if (i + j < audioData.length) {
          windowEnergy += audioData[i + j] * audioData[i + j];
        }
      }
      windowEnergy /= windowSize;
      
      // Detectar si es un beat (energía mayor que el umbral ajustado)
      if (windowEnergy > adjustedThreshold && (i - lastBeatPosition) > minSamplesBetweenBeats) {
        const beatTimeInSeconds = i / sampleRate;
        detectedBeats.push(beatTimeInSeconds);
        lastBeatPosition = i;
      }
    }
    
    // Calcular BPM basado en los beats detectados
    if (detectedBeats.length > 1) {
      const beatIntervals = [];
      for (let i = 1; i < detectedBeats.length; i++) {
        beatIntervals.push(detectedBeats[i] - detectedBeats[i - 1]);
      }
      
      // Calcular el intervalo promedio entre beats
      const averageInterval = beatIntervals.reduce((sum, interval) => sum + interval, 0) / beatIntervals.length;
      
      // Convertir a BPM (beats por minuto)
      const calculatedBpm = Math.round(60 / averageInterval);
      
      // Asegurar que esté en un rango razonable (40-200 BPM)
      if (calculatedBpm >= 40 && calculatedBpm <= 200) {
        setBpm(calculatedBpm);
      } else {
        // Valor predeterminado si el cálculo está fuera de rango
        setBpm(120);
      }
    } else {
      // No hay suficientes beats para calcular
      setBpm(120);
    }
    
    setBeats(detectedBeats);
    setIsDetecting(false);
    
    if (onBeatsDetected) {
      onBeatsDetected(detectedBeats);
    }
    
    return detectedBeats;
  }, [minTimeBetweenBeats, threshold, onBeatsDetected]);
  
  /**
   * Genera beats basados en BPM manual
   */
  const generateBeatsFromBpm = useCallback((manualBpm: number, duration: number) => {
    if (!duration || duration <= 0) return [];
    
    const beatInterval = 60 / manualBpm; // Intervalo entre beats en segundos
    const generatedBeats: number[] = [];
    
    // Generar beats a lo largo de toda la duración
    for (let time = 0; time < duration; time += beatInterval) {
      generatedBeats.push(time);
    }
    
    setBeats(generatedBeats);
    
    if (onBeatsDetected) {
      onBeatsDetected(generatedBeats);
    }
    
    return generatedBeats;
  }, [onBeatsDetected]);
  
  /**
   * Actualiza el BPM manual
   */
  const updateManualBpm = useCallback((newBpm: number, audioDuration?: number) => {
    const normalizedBpm = Math.max(40, Math.min(200, newBpm));
    setManualBpm(normalizedBpm);
    
    if (isUsingManualBpm && audioDuration) {
      generateBeatsFromBpm(normalizedBpm, audioDuration);
    }
  }, [isUsingManualBpm, generateBeatsFromBpm]);
  
  /**
   * Cambia entre detección automática y BPM manual
   */
  const toggleBpmMode = useCallback((useManual: boolean, audioDuration?: number) => {
    setIsUsingManualBpm(useManual);
    
    if (useManual && audioDuration) {
      // Cambiar a modo manual - generar beats basados en BPM manual
      generateBeatsFromBpm(manualBpm, audioDuration);
    } else if (!useManual && audioDataRef.current) {
      // Cambiar a modo automático - volver a detectar beats
      detectBeats(audioDataRef.current, sampleRateRef.current, sensitivity);
    }
  }, [manualBpm, sensitivity, detectBeats, generateBeatsFromBpm]);
  
  /**
   * Inicia la detección de beats en el audio
   */
  const analyzeAudio = useCallback(async () => {
    if (!wavesurfer) return;
    
    try {
      setIsDetecting(true);
      
      // Obtener los datos de audio
      const audioBuffer = wavesurfer.getDecodedData();
      
      if (!audioBuffer) {
        console.error('No se pudieron obtener datos de audio');
        setIsDetecting(false);
        return;
      }
      
      // Solo analizar el canal izquierdo (0) para simplicidad
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Limitar el análisis a los primeros X segundos para rendimiento
      const samplesToAnalyze = Math.min(
        audioData.length, 
        Math.floor(sampleRate * analysisTime)
      );
      
      const audioSlice = audioData.slice(0, samplesToAnalyze);
      
      // Ejecutar el algoritmo de detección
      if (!isUsingManualBpm) {
        detectBeats(audioSlice, sampleRate, sensitivity);
      } else {
        // Si estamos en modo manual, generar beats basados en BPM
        generateBeatsFromBpm(manualBpm, audioBuffer.duration);
      }
      
    } catch (error) {
      console.error('Error al analizar el audio:', error);
      setIsDetecting(false);
    }
  }, [wavesurfer, detectBeats, sensitivity, isUsingManualBpm, manualBpm, generateBeatsFromBpm, analysisTime]);
  
  // Iniciar el análisis cuando cambie el wavesurfer
  useEffect(() => {
    if (wavesurfer) {
      wavesurfer.once('ready', analyzeAudio);
    }
    
    return () => {
      if (wavesurfer) {
        wavesurfer.un('ready', analyzeAudio);
      }
    };
  }, [wavesurfer, analyzeAudio]);
  
  /**
   * Obtiene el beat más cercano a un tiempo dado
   */
  const getNearestBeat = useCallback((time: number, maxDistance: number = 0.5): number | null => {
    if (beats.length === 0) return null;
    
    let nearestBeat = null;
    let minDistance = maxDistance;
    
    for (const beat of beats) {
      const distance = Math.abs(beat - time);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBeat = beat;
      }
    }
    
    return nearestBeat;
  }, [beats]);
  
  /**
   * Genera una cuadrícula de tiempo basada en los beats detectados
   */
  const generateBeatGrid = useCallback((pixelsPerSecond: number, totalWidth: number): number[] => {
    if (beats.length === 0) return [];
    
    const grid: number[] = [];
    const totalTimeInSeconds = totalWidth / pixelsPerSecond;
    
    // Si estamos en modo manual, generar beats basados en BPM
    if (isUsingManualBpm) {
      const beatInterval = 60 / manualBpm;
      for (let time = 0; time < totalTimeInSeconds; time += beatInterval) {
        grid.push(time * pixelsPerSecond);
      }
    } else {
      // Usar los beats detectados
      for (const beat of beats) {
        if (beat <= totalTimeInSeconds) {
          grid.push(beat * pixelsPerSecond);
        }
      }
    }
    
    return grid;
  }, [beats, isUsingManualBpm, manualBpm]);
  
  return {
    beats,
    bpm,
    isDetecting,
    manualBpm,
    isUsingManualBpm,
    updateSensitivity,
    updateManualBpm,
    toggleBpmMode,
    analyzeAudio,
    getNearestBeat,
    generateBeatGrid
  };
}