import { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import { PIXELS_PER_SECOND } from '../../constants/timeline-constants';

interface WaveSurferOptions {
  audioUrl: string;
  container: HTMLElement | null;
  timelineContainer?: HTMLElement | null;
  height?: number;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  barWidth?: number;
  barGap?: number;
  responsive?: boolean;
  minPxPerSec?: number;
  onReady?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  onFinish?: () => void;
}

/**
 * Hook personalizado para WaveSurfer
 * Proporciona una forma fácil de crear y controlar visualizaciones de forma de onda de audio
 */
export function useWaveSurfer({
  audioUrl,
  container,
  timelineContainer = null,
  height = 80,
  waveColor = '#64748b',
  progressColor = '#3b82f6',
  cursorColor = '#ef4444',
  barWidth = 2,
  barGap = 1,
  responsive = true,
  minPxPerSec = PIXELS_PER_SECOND,
  onReady,
  onTimeUpdate,
  onFinish
}: WaveSurferOptions) {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  
  // Referencias
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const timelinePluginRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  
  // Inicializar WaveSurfer
  useEffect(() => {
    if (!container) return;
    
    containerRef.current = container;
    setLoading(true);
    setError(null);
    
    try {
      // Configuración base
      const options: any = {
        container,
        height,
        waveColor,
        progressColor,
        cursorColor,
        barWidth,
        barGap,
        minPxPerSec,
        responsive,
        normalize: true,
        partialRender: true
      };
      
      // Crear instancia
      const wavesurfer = WaveSurfer.create(options);
      
      // Añadir plugin de timeline si se proporciona un contenedor
      if (timelineContainer) {
        timelinePluginRef.current = wavesurfer.registerPlugin(
          TimelinePlugin.create({
            container: timelineContainer,
            primaryLabelInterval: 5,
            secondaryLabelInterval: 1,
            primaryColor: 'rgb(100, 100, 100)',
            secondaryColor: 'rgb(150, 150, 150)',
            primaryFontColor: '#000',
            secondaryFontColor: '#444'
          })
        );
      }
      
      // Manejadores de eventos
      wavesurfer.on('ready', () => {
        setIsReady(true);
        setDuration(wavesurfer.getDuration());
        setLoading(false);
        
        // Extraer y guardar los datos de picos
        const rawPeaks = wavesurfer.exportPeaks();
        setPeaks(rawPeaks[0] || []);
        
        if (onReady) onReady();
      });
      
      wavesurfer.on('play', () => setIsPlaying(true));
      wavesurfer.on('pause', () => setIsPlaying(false));
      wavesurfer.on('finish', () => {
        setIsPlaying(false);
        if (onFinish) onFinish();
      });
      
      wavesurfer.on('audioprocess', (time: number) => {
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      });
      
      wavesurfer.on('seek', (progress: number) => {
        const seekTime = progress * wavesurfer.getDuration();
        setCurrentTime(seekTime);
        if (onTimeUpdate) onTimeUpdate(seekTime);
      });
      
      wavesurfer.on('loading', (percent: number) => {
        if (percent < 100) {
          setBuffering(true);
        } else {
          setBuffering(false);
        }
      });
      
      wavesurfer.on('error', (errorMessage: any) => {
        console.error('WaveSurfer error:', errorMessage);
        setError('Error al cargar el audio');
        setLoading(false);
      });
      
      // Cargar audio - proxy Firebase Storage URLs to avoid CORS
      const isFirebaseUrl = audioUrl.includes('storage.googleapis.com') || 
                            audioUrl.includes('firebasestorage.googleapis.com');
      const loadUrl = isFirebaseUrl 
        ? `/api/proxy/firebase-file?url=${encodeURIComponent(audioUrl)}`
        : audioUrl;
      wavesurfer.load(loadUrl);
      
      // Guardar referencia
      wavesurferRef.current = wavesurfer;
      
      // Limpieza
      return () => {
        if (wavesurferRef.current) {
          wavesurferRef.current.destroy();
          wavesurferRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error al inicializar WaveSurfer:', error);
      setError('Error al inicializar el visualizador de audio');
      setLoading(false);
    }
  }, [audioUrl, container]);
  
  // Controles de reproducción
  const play = useCallback(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.play();
    }
  }, [isReady]);
  
  const pause = useCallback(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.pause();
    }
  }, [isReady]);
  
  const stop = useCallback(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.stop();
    }
  }, [isReady]);
  
  const seekTo = useCallback((time: number) => {
    if (wavesurferRef.current && isReady) {
      const progress = time / duration;
      wavesurferRef.current.seekTo(progress);
      setCurrentTime(time);
    }
  }, [isReady, duration]);
  
  const setPlaybackRate = useCallback((rate: number) => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setPlaybackRate(rate);
    }
  }, [isReady]);
  
  const setVolume = useCallback((volume: number) => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setVolume(volume);
    }
  }, [isReady]);
  
  const toggleMute = useCallback(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.toggleMute();
    }
  }, [isReady]);
  
  const setZoom = useCallback((zoomLevel: number) => {
    if (wavesurferRef.current && isReady) {
      // El nivel de zoom es minPxPerSec multiplicado por el nivel
      const pxPerSec = minPxPerSec * zoomLevel;
      wavesurferRef.current.zoom(pxPerSec);
    }
  }, [isReady, minPxPerSec]);
  
  // Analizar regiones para detección de beats
  const analyzeBeats = useCallback(() => {
    if (!peaks.length) return [];
    
    const threshold = 0.7; // Umbral para considerar un pico como un beat
    const minInterval = 0.3; // Mínimo tiempo entre beats (en segundos)
    
    const sampleRate = peaks.length / duration;
    const minDistance = Math.floor(minInterval * sampleRate);
    
    const beatPositions: number[] = [];
    
    for (let i = 1; i < peaks.length - 1; i++) {
      // Un pico es un posible beat si es más alto que sus vecinos y supera el umbral
      if (peaks[i] > peaks[i-1] && 
          peaks[i] > peaks[i+1] && 
          peaks[i] > threshold) {
        
        // Convertir la posición a tiempo
        const time = i / sampleRate;
        
        // Evitar beats demasiado cercanos
        if (beatPositions.length === 0 || 
           (time - beatPositions[beatPositions.length - 1]) >= minInterval) {
          beatPositions.push(time);
        }
      }
    }
    
    return beatPositions;
  }, [peaks, duration]);
  
  // Acceso a la instancia de WaveSurfer
  const getWaveSurfer = useCallback(() => wavesurferRef.current, []);
  
  return {
    // Estado
    isReady,
    isPlaying,
    duration,
    currentTime,
    buffering,
    loading,
    error,
    peaks,
    
    // Controles
    play,
    pause,
    stop,
    seekTo,
    setPlaybackRate,
    setVolume,
    toggleMute,
    setZoom,
    
    // Análisis
    analyzeBeats,
    
    // Acceso a la instancia
    getWaveSurfer
  };
}