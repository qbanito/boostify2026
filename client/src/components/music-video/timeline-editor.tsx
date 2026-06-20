/**
import { logger } from "../../lib/logger";
 * Editor de línea de tiempo para música
 * Componente principal que integra gestión de capas, clips y reproducción de audio
 * @export TimelineEditor - Componente principal del editor
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { 
  Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut,
  Music, Volume2, Volume1, VolumeX, Layers, Lock, Eye, Trash, 
  Plus, Save, Download, Upload, Share2, Loader2, ChevronLeft, 
  ChevronRight, EyeOff, LockOpen, Unlock
} from 'lucide-react';
import { Player, type PlayerRef } from '@remotion/player';
import { MusicVideoComposition } from '../remotion/MusicVideoComposition';
import { convertClipsToRemotionProps, calculateDurationInFrames } from '../../lib/utils/timeline-to-remotion';
import { TimelineClip } from '../timeline/TimelineClip';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Slider } from '../../components/ui/slider';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../hooks/use-toast';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';

import LayerManager from '../timeline/LayerManager';
import { useTimelineLayers, LayerConfig } from '../../hooks/useTimelineLayers';
import { useIsolatedLayers, IsolatedLayerOperation } from '../../hooks/useIsolatedLayers';
import { useEditor } from '../../lib/context/editor-context';
import { 
  LayerType, 
  PIXELS_PER_SECOND, 
  DEFAULT_ZOOM, 
  CLIP_COLORS,
  ClipOperation
} from '../../constants/timeline-constants';

// Utilizamos TimelineClip importado desde '../timeline/TimelineClip'

// Metadatos del mapa de beats
export interface BeatMapMetadata {
  bpm: number;
  timeSignature: string;
  key: string;
}

// Mapa de beats para sincronización
export interface BeatMap {
  beats: {
    time: number;
    type: 'downbeat' | 'beat';
  }[];
  sections: {
    startTime: number;
    endTime: number;
    name: string;
  }[];
  metadata: BeatMapMetadata;
}

// Propiedades del editor de línea de tiempo
interface TimelineEditorProps {
  clips?: TimelineClip[];
  beatMap?: BeatMap;
  audioUrl?: string;
  videoUrl?: string; // URL para vista previa de vídeo
  duration?: number;
  className?: string;
  onClipsChange?: (clips: TimelineClip[]) => void;
  onTimeChange?: (time: number) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  onAddClip?: (clip: Omit<TimelineClip, 'id'>) => void;
  onUpdateClip?: (id: number, updates: Partial<TimelineClip>) => void;
  onDeleteClip?: (id: number) => void;
  showBeatGrid?: boolean;
  readOnly?: boolean;
  autoScroll?: boolean;
  initialTime?: number;
  maxTime?: number;
}

/**
 * Editor de línea de tiempo para música
 * 
 * Componente principal que integra:
 * - Gestión de capas (audio, video, texto, efectos)
 * - Edición de clips con restricciones
 * - Reproducción y visualización de audio
 * - Sincronización con beats
 */
export function TimelineEditor({
  clips: initialClips = [],
  beatMap,
  audioUrl,
  videoUrl, // Añadido parámetro para URL de vídeo
  duration = 0,
  className,
  onClipsChange,
  onTimeChange,
  onPlaybackStateChange,
  onAddClip,
  onUpdateClip,
  onDeleteClip,
  showBeatGrid = true,
  readOnly = false,
  autoScroll = true,
  initialTime = 0,
  maxTime = 0
}: TimelineEditorProps): JSX.Element {
  // Obtener el contexto del editor
  const editor = useEditor();
  
  // Estado para clips - usando estado del editor si está disponible
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [nextClipId, setNextClipId] = useState<number>(
    Math.max(...initialClips.map(c => c.id), 0) + 1
  );
  
  // Estado para reproducción de audio - sincronizado con playhead del editor
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Estado para UI y navegación - sincronizado con timelineView del editor
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [showAllLayers, setShowAllLayers] = useState(true);
  const [snap, setSnap] = useState(true);
  const [activeOperation, setActiveOperation] = useState<ClipOperation>(ClipOperation.NONE);
  
  // Referencias a elementos DOM
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null); // Referencia específica para video de vista previa
  const playerRef = useRef<PlayerRef>(null); // Referencia al Player de Remotion
  const animationFrameRef = useRef<number>(0);
  
  // Estado para preview de video
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [previewLoaded, setPreviewLoaded] = useState<boolean>(false);
  const [useRemotionPreview, setUseRemotionPreview] = useState<boolean>(true); // Remotion como preview por defecto
  
  // Hooks personalizados
  const { toast } = useToast();
  const isolatedLayers = useIsolatedLayers();

  // Remotion: Computar props para el Player basado en los clips del timeline
  const remotionFps = 30;
  const remotionProps = useMemo(
    () => convertClipsToRemotionProps(clips, audioUrl),
    [clips, audioUrl]
  );
  const remotionDurationInFrames = useMemo(
    () => calculateDurationInFrames(clips, duration, remotionFps),
    [clips, duration]
  );
  
  // Hook para gestión de capas
  const {
    layers,
    visibleLayers,
    lockedLayers,
    selectedLayerId,
    addLayer,
    updateLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    selectLayer,
    getLayersByType,
    canAddClipToLayer
  } = useTimelineLayers([], { 
    createDefaultLayers: true, 
    isolatedLayerTypes: [
      LayerType.AUDIO,   // Capa 0: Audio aislada y bloqueada
      LayerType.VIDEO,   // Capa 1: Video/imágenes con placeholders AI
      LayerType.TEXT,    // Capa 2: Texto para edición estándar
      LayerType.EFFECT   // Capa 3: Efectos avanzados
    ]
  });

  // Inicializar componente con datos del contexto cuando esté disponible
  useEffect(() => {
    // Solo inicializar desde contexto si hay un proyecto activo
    if (editor.state?.project) {
      logger.info("📋 Inicializando TimelineEditor desde EditorContext");
      
      // Extraer clips de todas las pistas del proyecto
      const projectClips: TimelineClip[] = [];
      
      if (editor.state.project.tracks && editor.state.project.tracks.length > 0) {
        try {
          // Iterar sobre las pistas
          editor.state.project.tracks.forEach(track => {
            // Verificar si la pista tiene una propiedad 'clips' y si es un array
            // Esto es seguro ya que estamos en un bloque try-catch
            if (track && track.hasOwnProperty('clips') && Array.isArray((track as any).clips)) {
              const trackClips = (track as any).clips;
              
              if (trackClips.length > 0) {
                // Convertir cada clip al formato esperado por el timeline
                const processedClips = trackClips.map((clip: any) => ({
                  id: typeof clip.id === 'string' ? parseInt(clip.id, 10) : clip.id,
                  layer: track.id, // Usar trackId como layerId
                  type: clip.type || 'default',
                  title: clip.title || clip.name || 'Clip',
                  name: clip.name || clip.title || 'Clip',
                  start: clip.start || clip.startTime || 0,
                  startTime: clip.startTime || clip.start || 0,
                  duration: clip.duration || 0,
                  endTime: clip.endTime || (clip.start + clip.duration) || 0,
                  // Buscar URL en todos los campos posibles (fix para inconsistencia de nombres)
                  url: clip.url || clip.generatedImage || clip.image_url || clip.publicUrl || clip.firebaseUrl || clip.imageUrl || '',
                  color: clip.color || '#FF5733',
                  content: clip.content || '',
                  selected: false
                }));
                
                projectClips.push(...processedClips);
              }
            }
          });
        } catch (error) {
          logger.error("Error al procesar clips de pistas:", error);
        }
      }
      
      // Solo actualizar si hay clips para evitar reset no deseado
      if (projectClips.length > 0) {
        setClips(projectClips);
        
        // Establecer el próximo ID basado en los clips existentes
        const maxId = Math.max(...projectClips.map(c => typeof c.id === 'number' ? c.id : parseInt(String(c.id), 10)), 0);
        setNextClipId(maxId + 1);
        
        logger.info(`📋 Cargados ${projectClips.length} clips desde el EditorContext`);
      }
      
      // Sincronizar el tiempo actual y estado de reproducción
      if (editor.state.playhead) {
        setCurrentTime(editor.state.playhead.time || initialTime);
        setIsPlaying(editor.state.playhead.isPlaying || false);
      }
      
      // Sincronizar zoom y vista
      if (editor.state.timelineView) {
        setZoom(editor.state.timelineView.scale || DEFAULT_ZOOM);
      }
      
      // Sincronizar selección si existe
      if (editor.state.selectedClipId) {
        const clipId = typeof editor.state.selectedClipId === 'string' 
          ? parseInt(editor.state.selectedClipId, 10) 
          : editor.state.selectedClipId;
        
        setSelectedClipId(clipId);
      }
    }
  }, [editor.state?.project, editor.state?.playhead, editor.state?.timelineView, initialTime]);
  
  // Manejar cambios en clips iniciales (props externos)
  useEffect(() => {
    // Solo actualizar desde props si no estamos inicializando desde contexto
    if (!editor.state?.project || !editor.state.project.tracks || editor.state.project.tracks.length === 0) {
      setClips(initialClips);
      setNextClipId(Math.max(...initialClips.map(c => c.id), 0) + 1);
      logger.info("📋 Inicializando TimelineEditor desde props iniciales");
    }
  }, [JSON.stringify(initialClips), editor.state?.project]);

  // Gestionar reproducción de audio - mejorado para dispositivos móviles
  useEffect(() => {
    if (audioRef.current) {
      // Establecer volumen sin importar el estado de reproducción
      audioRef.current.volume = isMuted ? 0 : volume;
      
      if (isPlaying) {
        // Solución para reproducción en móviles: necesitamos manejar la Promise correctamente
        const playPromise = audioRef.current.play();
        
        // En móviles, play() devuelve una Promise que debemos manejar para evitar errores
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // La reproducción comenzó con éxito
              logger.info("Reproducción iniciada correctamente");
            })
            .catch(error => {
              // La reproducción falló, probablemente debido a políticas de interacción del usuario
              logger.error("Error al iniciar reproducción:", error);
              // Reintentar con un control más explícito para móviles
              if (error.name === 'NotAllowedError') {
                toast({
                  title: "Interacción requerida",
                  description: "Toca la pantalla para permitir la reproducción",
                  variant: "default"
                });
              }
              setIsPlaying(false);
            });
        }
      } else {
        // Pausar reproducción
        audioRef.current.pause();
      }
    }
    
    // Notificar cambios de estado de reproducción
    if (onPlaybackStateChange) {
      onPlaybackStateChange(isPlaying);
    }
  }, [isPlaying, isMuted, volume, toast]);

  // Actualización de tiempo durante reproducción con sincronización de video optimizada
  useEffect(() => {
    // Esta implementación usa requestAnimationFrame para máxima fluidez y sincronía
    
    // Esta variable detecta si necesitamos detener la animación debido a un evento externo
    let isMounted = true;
    
    if (isPlaying) {
      logger.info("▶️ Iniciando control de reproducción y animación de timeline");
      
      // Definimos el sistema de loops de animación para actualización de tiempo
      const updateTimeFromAudio = () => {
        // Verificar si el componente sigue montado
        if (!isMounted) return;
        
        try {
          // El audio es siempre nuestra fuente de verdad para la sincronización
          if (audioRef.current) {
            const currentAudioTime = audioRef.current.currentTime;
            
            // Actualizar tiempo del componente (para la UI)
            setCurrentTime(currentAudioTime);
            
            // Comprobar si hemos llegado al final
            if (currentAudioTime >= duration) {
              logger.info("🔚 Final de reproducción alcanzado");
              setIsPlaying(false);
              
              // Reiniciar a tiempo cero o quizás al inicio si implementamos loop
              if (audioRef.current) audioRef.current.pause();
              if (videoRef.current) videoRef.current.pause();
              if (previewVideoRef.current) previewVideoRef.current.pause();
              if (playerRef.current) playerRef.current.pause();
              
              // Confirmar que hemos detenido la reproducción
              return;
            }
            
            // Verificar si el audio y el video de vista previa están sincronizados
            // Si la diferencia es mayor que 100ms, sincronizamos manualmente
            if (previewVideoRef.current && Math.abs(previewVideoRef.current.currentTime - currentAudioTime) > 0.1) {
              logger.info("⚠️ Resincronizando video de vista previa, desviación detectada");
              previewVideoRef.current.currentTime = currentAudioTime;
            }
            
            // Sincronizar Remotion Player con el tiempo del audio
            if (playerRef.current && useRemotionPreview) {
              const targetFrame = Math.round(currentAudioTime * remotionFps);
              playerRef.current.seekTo(targetFrame);
            }
          }
          
          // Continuar animación si seguimos reproduciendo
          if (isPlaying && isMounted) {
            animationFrameRef.current = requestAnimationFrame(updateTimeFromAudio);
          }
        } catch (error) {
          logger.error("Error en bucle de animación:", error);
          
          // En caso de error, intentamos continuar con la animación para evitar congelación
          if (isPlaying && isMounted) {
            animationFrameRef.current = requestAnimationFrame(updateTimeFromAudio);
          }
        }
      };
      
      // Iniciar bucle de actualización optimizado para rendimiento
      animationFrameRef.current = requestAnimationFrame(updateTimeFromAudio);
      
      // Limpiar cuando el efecto se desmonte o cambien las dependencias
      return () => {
        isMounted = false;
        
        // Cancelar bucle de animación
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        logger.info("🛑 Bucle de animación de timeline detenido");
      };
    }
    
    // Cuando no está reproduciendo, nos aseguramos de limpiar el bucle de animación
    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, duration, useRemotionPreview]);

  // Actualizar posición de tiempo y sincronizar video
  useEffect(() => {
    if (onTimeChange) {
      onTimeChange(currentTime);
    }
    
    // Sincronizar con EditorContext
    editor.setCurrentPlaybackTime(currentTime);
    editor.setPlaybackState(isPlaying);
    
    // Si está reproduciendo, no hacer nada más (el audio controla el tiempo)
    if (isPlaying) return;
    
    // Si está en pausa, actualizar tiempo manualmente en el audio y video
    if (audioRef.current) {
      audioRef.current.currentTime = currentTime;
    }
    
    // Sincronizar video si está disponible
    if (videoRef.current) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime, isPlaying, onTimeChange, editor]);
  
  // Efecto para sincronizar video de referencia
  useEffect(() => {
    if (!videoRef.current) return;
    
    const videoElement = videoRef.current;
    
    // Manejar eventos de video
    const handleVideoCanPlay = () => {
      logger.info("Video de referencia listo para reproducción");
      setPreviewLoaded(true);
    };
    
    const handleVideoError = (e: any) => {
      logger.error("Error en elemento de video:", e);
      setPreviewLoaded(false);
    };
    
    // Registrar manejadores de eventos
    videoElement.addEventListener('canplay', handleVideoCanPlay);
    videoElement.addEventListener('error', handleVideoError);
    
    // Sincronizar con el estado de reproducción
    if (isPlaying && previewLoaded) {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          logger.error("Error al iniciar reproducción de video:", error);
        });
      }
    } else {
      videoElement.pause();
    }
    
    // Limpiar manejadores al desmontar
    return () => {
      videoElement.removeEventListener('canplay', handleVideoCanPlay);
      videoElement.removeEventListener('error', handleVideoError);
    };
  }, [isPlaying, previewLoaded]);
  
  // Efecto específico para la vista previa de video
  useEffect(() => {
    if (!previewVideoRef.current || !videoUrl) return;
    
    const previewElement = previewVideoRef.current;
    
    // Manejar eventos de video de vista previa
    const handlePreviewCanPlay = () => {
      logger.info("Vista previa de video lista para reproducción");
      setPreviewLoaded(true);
    };
    
    const handlePreviewError = (e: any) => {
      logger.error("Error en vista previa de video:", e);
      setPreviewLoaded(false);
    };
    
    // Registrar manejadores de eventos
    previewElement.addEventListener('canplay', handlePreviewCanPlay);
    previewElement.addEventListener('error', handlePreviewError);
    
    // Sincronizar reproducción
    if (isPlaying && previewLoaded) {
      logger.info("Intentando reproducir vista previa de video");
      const playPromise = previewElement.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          logger.error("Error al reproducir vista previa:", error);
        });
      }
    } else {
      previewElement.pause();
    }
    
    // Sincronizar tiempo
    if (!isPlaying && videoRef.current) {
      previewElement.currentTime = videoRef.current.currentTime;
    }
    
    // Limpiar manejadores al desmontar
    return () => {
      previewElement.removeEventListener('canplay', handlePreviewCanPlay);
      previewElement.removeEventListener('error', handlePreviewError);
    };
  }, [isPlaying, previewLoaded, videoUrl, currentTime]);

  // Notificar cambios en los clips
  useEffect(() => {
    if (onClipsChange) {
      onClipsChange(clips);
    }
    
    // Sincronizar los clips con el EditorContext si es necesario
    if (editor.state?.project) {
      // Actualizamos las pistas individualmente con los clips correspondientes
      const tracks = editor.state.project.tracks || [];
      
      // Por cada pista, actualizamos sus clips asociados
      tracks.forEach(track => {
        const trackClips = clips.filter(clip => clip.layer === track.id); // Usar 'layer' en lugar de 'trackId'
        
        if (trackClips.length > 0) {
          // Convertir clips a formato esperado por el editor
          const formattedClips = trackClips.map(clip => ({
            id: String(clip.id), // Convertir IDs numéricos a strings 
            title: clip.title || clip.name || 'Clip',
            name: clip.name || clip.title || 'Clip',
            start: clip.start || clip.startTime || 0,
            startTime: clip.startTime || clip.start || 0,
            duration: clip.duration || 0,
            endTime: clip.endTime || (clip.start + clip.duration) || 0,
            // Buscar URL en todos los campos posibles (fix para inconsistencia de nombres)
            url: clip.url || clip.generatedImage || clip.image_url || clip.publicUrl || clip.firebaseUrl || clip.imageUrl || '',
            color: clip.color || '#FF5733',
            content: clip.content || '',
            // No incluimos 'trackId' para evitar errores de tipo
          }));
          
          // Actualizar la pista con los clips correspondientes
          try {
            editor.updateTrack(track.id, {
              name: track.name, // Mantener el nombre de la pista
              type: track.type // Mantener el tipo de pista
              // No incluimos 'clips' directamente para evitar errores de tipo
            });
            
            // Sincronizar los clips individualmente si es necesario
            // Esta es una solución temporal hasta que se resuelvan los problemas de tipos
            formattedClips.forEach(clip => {
              if (typeof editor.addClip === 'function') {
                try {
                  // Solo pasar propiedades compatibles con la interfaz Clip
                  editor.addClip({
                    trackId: track.id,      // ID de la pista
                    name: clip.name,        // Nombre del clip
                    title: clip.title,      // Título del clip
                    start: clip.start,      // Tiempo de inicio
                    startTime: clip.startTime, // Alias de tiempo de inicio
                    duration: clip.duration,// Duración 
                    endTime: clip.endTime,  // Tiempo de finalización
                    // URL del recurso - buscar en todos los campos posibles
                    url: clip.url || clip.generatedImage || clip.image_url || clip.publicUrl || clip.firebaseUrl || clip.imageUrl || '',
                    // Omitimos propiedades que podrían causar problemas de tipo
                    source: '',             // Fuente requerida por Clip
                    trimStart: 0,           // Valor por defecto
                    trimEnd: 0,             // Valor por defecto
                    createdAt: new Date()   // Fecha de creación actual
                  });
                } catch (clipError) {
                  logger.error('Error al añadir clip individual:', clipError);
                }
              }
            });
          } catch (error) {
            logger.error('Error al sincronizar clips con el editor:', error);
          }
        }
      });
    }
  }, [clips, onClipsChange, editor]);

  // Funciones para reproducción
  const togglePlay = useCallback(() => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    
    try {
      // Control de reproducción global con manejo preciso de errores
      if (newPlayState) {
        logger.info("▶️ Iniciando reproducción sincronizada");
        
        // Array para controlar promesas de reproducción
        const playPromises = [];
        
        // Iniciar reproducción de audio primero (funciona como "maestro")
        if (audioRef.current) {
          playPromises.push(
            audioRef.current.play()
              .catch(err => {
                logger.error("Error al reproducir audio:", err);
                // Si falla el audio, revertimos el estado
                setIsPlaying(false);
                throw new Error("No se pudo reproducir el audio");
              })
          );
        }
        
        // Sincronizar video de referencia (usado para análisis interno)
        if (videoRef.current) {
          playPromises.push(
            videoRef.current.play()
              .catch(err => {
                logger.error("Error al reproducir video de referencia:", err);
                // No revertimos el estado aquí, solo registramos
              })
          );
        }
        
        // Sincronizar vista previa (lo que el usuario ve)
        if (previewVideoRef.current) {
          playPromises.push(
            previewVideoRef.current.play()
              .catch(err => {
                logger.error("Error al reproducir vista previa:", err);
                // Error crítico, notificar al usuario
                toast({
                  title: "Error de reproducción",
                  description: "No se pudo reproducir el video de vista previa. Intente hacer clic nuevamente.",
                  variant: "destructive",
                });
              })
          );
        }
        
        // Verificar si todo se reprodujo correctamente
        Promise.all(playPromises).then(() => {
          logger.info("✅ Todos los elementos multimedia sincronizados y reproduciendo");
        }).catch(() => {
          logger.info("⚠️ Algunos elementos no pudieron sincronizarse");
        });
        
      } else {
        // Pausar todos los elementos
        logger.info("⏸️ Pausando todos los elementos");
        
        if (audioRef.current) audioRef.current.pause();
        if (videoRef.current) videoRef.current.pause();
        if (previewVideoRef.current) previewVideoRef.current.pause();
      }
    } catch (error) {
      // Error inesperado, revertir estado
      logger.error("Error fatal al controlar reproducción:", error);
      setIsPlaying(false);
      toast({
        title: "Error de reproducción",
        description: "Ocurrió un problema al intentar reproducir. Intente de nuevo.",
        variant: "destructive",
      });
    }
  }, [isPlaying, toast]);
  
  // Declaración seekToTime para manejo de la sincronización de tiempo
  const seekToTime = useCallback((time: number) => {
    // Garantizar que el tiempo está dentro de los límites del video/audio
    const clampedTime = Math.min(Math.max(time, 0), duration);
    
    // Actualizar el estado de tiempo actualizado
    setCurrentTime(clampedTime);
    
    // Log para debug de sincronización
    logger.info(`⏱️ Buscando tiempo: ${clampedTime.toFixed(2)}s de ${duration.toFixed(2)}s`);
    
    try {
      // Actualizar tiempo de audio - prioridad alta
      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
        logger.info(`🔊 Audio sincronizado a ${clampedTime.toFixed(2)}s`);
      }
      
      // Actualizar tiempo de video de referencia
      if (videoRef.current) {
        videoRef.current.currentTime = clampedTime;
        logger.info(`🎬 Video de referencia sincronizado`);
      }
      
      // Actualizar tiempo del video de vista previa específico 
      if (previewVideoRef.current) {
        previewVideoRef.current.currentTime = clampedTime;
        logger.info(`👁️ Video de vista previa sincronizado`);
      }
      
      // Sincronizar Remotion Player
      if (playerRef.current && useRemotionPreview) {
        playerRef.current.seekTo(Math.round(clampedTime * remotionFps));
      }
      
      // Actualizar cualquier otro video que pueda estar en el panel
      // Esta es una sincronización de respaldo por si se añaden más elementos
      document.querySelectorAll('video').forEach(video => {
        if (video !== videoRef.current && video !== previewVideoRef.current) {
          video.currentTime = clampedTime;
        }
      });
    } catch (error) {
      logger.error('Error al sincronizar medios:', error);
      toast({
        title: "Error de sincronización",
        description: "No se pudieron sincronizar todos los elementos multimedia",
        variant: "destructive",
      });
    }
  }, [duration, toast]);
  
  // Función para detener reproducción
  const stop = useCallback(() => {
    // Detener reproducción
    setIsPlaying(false);
    
    logger.info("⏹️ Deteniendo y reiniciando todos los elementos multimedia");
    
    try {
      // Usar seekToTime(0) para la sincronización de tiempo
      // Esto asegura que todos los elementos se reinicien correctamente
      seekToTime(0);
      
      // Asegurarnos de pausar explícitamente todos los elementos
      if (audioRef.current) {
        audioRef.current.pause();
        logger.info("🔊 Audio detenido y reiniciado");
      }
      
      if (videoRef.current) {
        videoRef.current.pause();
        logger.info("🎬 Video de referencia detenido y reiniciado");
      }
      
      if (previewVideoRef.current) {
        previewVideoRef.current.pause();
        logger.info("👁️ Vista previa detenida y reiniciada");
      }
      
      // Detener y reiniciar Remotion Player
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.seekTo(0);
      }
      
      // Reiniciar cualquier otro video que pueda estar en el panel
      document.querySelectorAll('video').forEach(video => {
        if (video !== videoRef.current && video !== previewVideoRef.current) {
          video.currentTime = 0;
          video.pause();
        }
      });
    } catch (error) {
      logger.error("Error al detener reproducción:", error);
      toast({
        title: "Error al detener",
        description: "No se pudieron detener todos los elementos multimedia correctamente",
        variant: "destructive",
      });
    }
  }, [seekToTime, toast]);
  
  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Funciones para navegación y zoom
  const zoomIn = useCallback(() => {
    const newZoom = Math.min(zoom * 1.2, 5.0);
    setZoom(newZoom);
    
    // Sincronizar con EditorContext
    editor.setTimelineView({
      scale: newZoom
    });
  }, [zoom, editor]);
  
  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(newZoom);
    
    // Sincronizar con EditorContext
    editor.setTimelineView({
      scale: newZoom
    });
  }, [zoom, editor]);
  
  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    
    // Sincronizar con EditorContext
    editor.setTimelineView({
      scale: DEFAULT_ZOOM
    });
  }, [editor]);

  // Función para seleccionar clip
  const selectClip = useCallback((id: number | null) => {
    setSelectedClipId(id);
    
    // Actualizar la selección en el contexto del editor
    if (id !== null) {
      editor.setSelectedClip(String(id));
    } else {
      editor.setSelectedClip(null);
    }
  }, [editor]);
  
  // Funciones para gestión de clips
  const addClip = useCallback((clipData: Omit<TimelineClip, 'id'>) => {
    if (readOnly) return;
    
    // Verificar si la capa está bloqueada
    if (lockedLayers[clipData.layer]) {
      toast({
        title: 'Capa bloqueada',
        description: 'No puedes añadir clips a una capa bloqueada',
        variant: 'destructive'
      });
      return;
    }
    
    // Validar operación con restricciones de capas aisladas
    const layerType = layers.find(l => l.id === clipData.layer)?.type;
    const dummyClip = { id: -1, ...clipData };
    
    const validationResult = isolatedLayers.validateClipOperation(
      dummyClip, clips, IsolatedLayerOperation.ADD, layerType
    );
    
    if (!validationResult.isValid) {
      toast({
        title: 'Operación no permitida',
        description: validationResult.message || 'No se puede añadir el clip con la configuración actual',
        variant: 'destructive'
      });
      return;
    }
    
    // Crear nuevo clip asegurando compatibilidad con name/title y start/startTime/endTime
    let syncedClipData = { ...clipData };
    
    // Sincronizar name y title
    syncedClipData.name = clipData.name || clipData.title || 'Clip';
    syncedClipData.title = clipData.title || clipData.name || 'Clip';
    
    // Sincronizar startTime y start
    if (syncedClipData.start !== undefined && syncedClipData.startTime === undefined) {
      syncedClipData.startTime = syncedClipData.start;
    } else if (syncedClipData.startTime !== undefined && syncedClipData.start === undefined) {
      syncedClipData.start = syncedClipData.startTime;
    }
    
    // Calcular endTime basado en start y duration
    if (syncedClipData.start !== undefined && syncedClipData.duration !== undefined) {
      syncedClipData.endTime = syncedClipData.start + syncedClipData.duration;
    }
    
    // Crear el clip con los datos sincronizados
    const newClip: TimelineClip = {
      id: nextClipId,
      ...syncedClipData
    };
    
    setClips(prev => [...prev, newClip]);
    setNextClipId(prev => prev + 1);
    setSelectedClipId(newClip.id);
    
    // Notificar adición con los datos sincronizados
    if (onAddClip) {
      // Asegurarnos de que se envíen los datos completos incluyendo name y title
      const notificationData = {
        ...clipData,
        name: newClip.name,
        title: newClip.title
      };
      onAddClip(notificationData);
    }
    
    return newClip.id;
  }, [
    readOnly, 
    lockedLayers, 
    layers, 
    clips, 
    nextClipId, 
    onAddClip, 
    isolatedLayers,
    toast
  ]);
  
  const updateClip = useCallback((id: number, updates: Partial<TimelineClip>) => {
    if (readOnly) return;
    
    // Buscar el clip a actualizar
    const clipToUpdate = clips.find(c => c.id === id);
    if (!clipToUpdate) return;
    
    // Verificar si la capa está bloqueada
    if (lockedLayers[clipToUpdate.layer]) {
      toast({
        title: 'Capa bloqueada',
        description: 'No puedes modificar clips en una capa bloqueada',
        variant: 'destructive'
      });
      return;
    }
    
    // Si se está cambiando de capa, validar la operación
    if (updates.layer !== undefined && updates.layer !== clipToUpdate.layer) {
      const layerType = layers.find(l => l.id === updates.layer)?.type;
      
      const validationResult = isolatedLayers.validateClipOperation(
        { ...clipToUpdate, ...updates },
        clips.filter(c => c.id !== id),
        IsolatedLayerOperation.MOVE,
        layerType
      );
      
      if (!validationResult.isValid) {
        toast({
          title: 'Operación no permitida',
          description: validationResult.message || 'No se puede mover el clip a la capa seleccionada',
          variant: 'destructive'
        });
        return;
      }
    }
    
    // Si se está cambiando la duración o posición, validar overlap
    if (updates.duration !== undefined || updates.start !== undefined) {
      const updatedClip = { ...clipToUpdate, ...updates };
      
      const validationResult = isolatedLayers.validateClipOperation(
        updatedClip,
        clips.filter(c => c.id !== id),
        IsolatedLayerOperation.RESIZE_END, // Usamos RESIZE_END en lugar de RESIZE que no existe
        layers.find(l => l.id === updatedClip.layer)?.type
      );
      
      if (!validationResult.isValid) {
        toast({
          title: 'Operación no permitida',
          description: validationResult.message || 'La nueva duración o posición no es válida',
          variant: 'destructive'
        });
        return;
      }
    }
    
    // Sincronizar todos los campos relacionados
    let finalUpdates = { ...updates };
    
    // Sincronizar title y name
    if (updates.title !== undefined && updates.name === undefined) {
      finalUpdates.name = updates.title;
    }
    
    if (updates.name !== undefined && updates.title === undefined) {
      finalUpdates.title = updates.name;
    }
    
    // Sincronizar start/startTime
    if (updates.start !== undefined && updates.startTime === undefined) {
      finalUpdates.startTime = updates.start;
    }
    
    if (updates.startTime !== undefined && updates.start === undefined) {
      finalUpdates.start = updates.startTime;
    }
    
    // Calcular o actualizar endTime si tenemos start y duration
    if ((updates.start !== undefined || clipToUpdate.start !== undefined) && 
        (updates.duration !== undefined || clipToUpdate.duration !== undefined)) {
      const newStart = updates.start ?? clipToUpdate.start;
      const newDuration = updates.duration ?? clipToUpdate.duration;
      finalUpdates.endTime = newStart + newDuration;
    }
    
    // Calcular duration desde startTime/endTime si ambos están disponibles
    if (updates.startTime !== undefined && updates.endTime !== undefined) {
      finalUpdates.duration = updates.endTime - updates.startTime;
    }
    
    // Actualizar clip con los cambios sincronizados
    setClips(prev => 
      prev.map(clip => clip.id === id ? { ...clip, ...finalUpdates } : clip)
    );
    
    // Notificar actualización con los cambios sincronizados
    if (onUpdateClip) {
      onUpdateClip(id, finalUpdates);
    }
  }, [
    readOnly, 
    lockedLayers, 
    clips, 
    layers, 
    onUpdateClip, 
    isolatedLayers, 
    toast
  ]);
  
  const deleteClip = useCallback((id: number) => {
    if (readOnly) return;
    
    // Buscar el clip a eliminar
    const clipToDelete = clips.find(c => c.id === id);
    if (!clipToDelete) return;
    
    // Verificar si la capa está bloqueada
    if (lockedLayers[clipToDelete.layer]) {
      toast({
        title: 'Capa bloqueada',
        description: 'No puedes eliminar clips de una capa bloqueada',
        variant: 'destructive'
      });
      return;
    }
    
    // Validar operación
    const validationResult = isolatedLayers.validateClipOperation(
      clipToDelete,
      clips,
      IsolatedLayerOperation.DELETE,
      layers.find(l => l.id === clipToDelete.layer)?.type
    );
    
    if (!validationResult.isValid) {
      toast({
        title: 'Operación no permitida',
        description: validationResult.message || 'No se puede eliminar este clip',
        variant: 'destructive'
      });
      return;
    }
    
    // Eliminar clip
    setClips(prev => prev.filter(clip => clip.id !== id));
    
    // Deseleccionar si era el clip seleccionado
    if (selectedClipId === id) {
      setSelectedClipId(null);
    }
    
    // Notificar eliminación
    if (onDeleteClip) {
      onDeleteClip(id);
    }
  }, [
    readOnly, 
    lockedLayers, 
    clips, 
    selectedClipId, 
    layers, 
    onDeleteClip, 
    isolatedLayers,
    toast
  ]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeOperation !== ClipOperation.NONE) return;
    
    // Obtener posición relativa en el timeline
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    
    // Convertir a tiempo
    const rawClickTime = (clickX / (PIXELS_PER_SECOND * zoom));
    
    // Limitar al rango válido de la línea de tiempo
    const validClickTime = Math.max(0, Math.min(rawClickTime, duration));
    
    // Actualizar tiempo actual
    seekToTime(validClickTime);
    
    // Log para debug de sincronización
    logger.info(`Timeline click: posición ${clickX.toFixed(0)}px, tiempo ${validClickTime.toFixed(2)}s`);
  }, [activeOperation, zoom, seekToTime, duration]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Atajos de teclado
    switch (e.key) {
      case ' ': // Espacio para reproducir/pausar
        togglePlay();
        e.preventDefault();
        break;
      case 'Delete': // Eliminar clip seleccionado
        if (selectedClipId !== null) {
          deleteClip(selectedClipId);
        }
        break;
      case 'Escape': // Cancelar operación y deseleccionar
        setActiveOperation(ClipOperation.NONE);
        setSelectedClipId(null);
        break;
      case '+': // Zoom in
        zoomIn();
        break;
      case '-': // Zoom out
        zoomOut();
        break;
      case '0': // Reset zoom
        resetZoom();
        break;
    }
  }, [togglePlay, selectedClipId, deleteClip, zoomIn, zoomOut, resetZoom]);

  // Clases dinámicas con soporte mejorado para móviles
  const timelineClasses = cn(
    'timeline-editor',
    'relative',
    'flex flex-col',
    'border rounded-md',
    'h-full overflow-hidden',
    'mobile-optimized', // Clase para optimizaciones móviles
    className
  );
  
  // Calcular dimensiones del timeline
  const timelineDuration = maxTime > 0 ? maxTime : Math.max(duration, 
    clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0)
  );
  
  const timelineWidth = timelineDuration * PIXELS_PER_SECOND * zoom;

  return (
    <div 
      className={timelineClasses}
      onKeyDown={handleKeyDown} 
      tabIndex={0}
    >
      {/* Audio player mejorado para móviles */}
      <audio 
        ref={audioRef}
        src={audioUrl} 
        preload="auto" 
        playsInline // Necesario para iOS
        muted={isMuted} // Para manejar mejor el estado de silencio
        loop={false}
        style={{ display: 'none' }}
        onCanPlay={() => logger.info("Audio listo para reproducción")}
        onError={(e) => logger.error("Error en elemento de audio:", e)}
      />
      
      {/* Video player para vista previa (versión oculta para referencia) */}
      {videoUrl && (
        <video 
          ref={videoRef}
          src={videoUrl}
          preload="auto"
          playsInline // Necesario para iOS
          muted={isMuted}
          loop={false}
          className="hidden" // Oculto ya que usaremos una versión más grande en el panel principal
          onCanPlay={() => logger.info("Video listo para reproducción")}
          onError={(e) => logger.error("Error en elemento de video:", e)}
        />
      )}
      
      {/* Barra de herramientas mejorada para móviles */}
      <div className="timeline-toolbar flex flex-wrap items-center justify-between p-2 border-b bg-muted/30 gap-2">
        {/* Grupo de controles de reproducción - siempre visible */}
        <div className="flex items-center space-x-2">
          {/* Controles de reproducción con botones más grandes para táctil */}
          <Button 
            size="icon" 
            variant="outline" 
            onClick={stop}
            title="Detener"
            className="h-8 w-8 md:h-9 md:w-9 touch-manipulation" 
          >
            <SkipBack className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          
          <Button 
            size="icon" 
            variant={isPlaying ? "secondary" : "outline"}
            onClick={togglePlay}
            title={isPlaying ? "Pausar" : "Reproducir"}
            className="h-9 w-9 md:h-10 md:w-10 touch-manipulation" 
          >
            {isPlaying ? <Pause className="h-5 w-5 md:h-6 md:w-6" /> : <Play className="h-5 w-5 md:h-6 md:w-6" />}
          </Button>
          
          {/* Tiempo actual - optimizado para móvil */}
          <div className="time-display bg-background px-2 py-1 rounded text-sm md:text-base font-mono whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        {/* Grupo de controles secundarios - responsivo */}
        <div className="flex flex-wrap items-center space-x-2 gap-y-2">
          {/* Control de volumen - adaptado para móvil */}
          <div className="flex items-center space-x-1">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={toggleMute}
              title={isMuted ? "Activar sonido" : "Silenciar"}
              className="h-8 w-8 touch-manipulation"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : volume > 0.5 ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <Volume1 className="h-4 w-4" />
              )}
            </Button>
            
            <Slider
              className="w-16 md:w-24"
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={([val]) => setVolume(val)}
              aria-label="Volumen"
            />
          </div>
          
          {/* Grupo de controles de zoom - diseño compacto */}
          <div className="flex items-center space-x-1">
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={zoomOut}
              title="Reducir zoom"
              className="h-8 w-8 touch-manipulation"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={resetZoom}
              title="Restablecer zoom"
              className="h-8 w-8 touch-manipulation"
            >
              <div className="h-4 w-4 flex items-center justify-center text-xs font-medium">1x</div>
            </Button>
            
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={zoomIn}
              title="Aumentar zoom"
              className="h-8 w-8 touch-manipulation"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Opciones adicionales - agrupadas en modo móvil */}
          <div className="flex items-center space-x-1">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setSnap(!snap)}
              className="touch-manipulation"
            >
              <Badge variant={snap ? "default" : "outline"} className="whitespace-nowrap">Ajustar</Badge>
            </Button>
            
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setShowAllLayers(!showAllLayers)}
              className="touch-manipulation hidden sm:flex"
            >
              <Badge variant={showAllLayers ? "default" : "outline"} className="whitespace-nowrap">Todas las capas</Badge>
            </Button>
            
            {/* Botón para mostrar/ocultar vista previa */}
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setShowPreview(!showPreview)}
                className="touch-manipulation"
                title={showPreview ? "Ocultar vista previa" : "Mostrar vista previa"}
              >
                <Badge variant={showPreview ? "default" : "outline"} className="whitespace-nowrap">
                  <Eye className="h-3.5 w-3.5 mr-1" /> Vista previa
                </Badge>
              </Button>
          </div>
        </div>
      </div>
      
      {/* Área principal con diseño adaptativo para móviles */}
      <div className="timeline-content flex flex-col md:flex-row h-full bg-background">
        {/* Panel lateral de capas - colapsa en móvil */}
        <div className="layers-panel md:w-64 w-full h-auto md:h-full max-h-[200px] md:max-h-none border-b md:border-b-0 md:border-r border-border p-2 overflow-y-auto">
          <LayerManager
            layers={layers}
            clips={clips}
            visibleLayers={visibleLayers}
            lockedLayers={lockedLayers}
            selectedLayerId={selectedLayerId}
            onAddLayer={addLayer}
            onRemoveLayer={removeLayer}
            onUpdateLayer={updateLayer}
            onToggleLayerVisibility={toggleLayerVisibility}
            onToggleLayerLock={toggleLayerLock}
            onSelectLayer={selectLayer}
          />
        </div>
        
        {/* Panel principal de timeline - se adapta mejor en móvil */}
        <div className="timeline-panel flex-1 overflow-hidden">
          {/* Panel de Vista Previa - Remotion Player o Video tradicional */}
          {showPreview && (
            <div className={cn(
              "video-preview-panel border-b border-border relative overflow-hidden bg-black/95",
              "w-full h-auto max-h-[300px] md:max-h-[400px] transition-all duration-300"
            )}>
              <div className="relative w-full aspect-video max-w-3xl mx-auto p-1">
                {/* Toggle Remotion / Video clásico */}
                <div className="absolute top-2 right-2 z-30 flex items-center gap-2 bg-black/60 rounded px-2 py-1">
                  <span className="text-xs text-white/70">Remotion</span>
                  <Switch 
                    checked={useRemotionPreview} 
                    onCheckedChange={setUseRemotionPreview}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Remotion Player Preview */}
                {useRemotionPreview && clips.length > 0 ? (
                  <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black rounded-sm cursor-pointer" onClick={togglePlay}>
                    <Player
                      ref={playerRef}
                      component={MusicVideoComposition}
                      inputProps={remotionProps}
                      durationInFrames={Math.max(remotionDurationInFrames, 1)}
                      compositionWidth={1080}
                      compositionHeight={1920}
                      fps={remotionFps}
                      style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: '100%',
                      }}
                      controls={false}
                      autoPlay={false}
                    />
                    {/* Overlay play/pause */}
                    <div className={cn(
                      "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                      "bg-black/20 pointer-events-none",
                      isPlaying ? "opacity-0" : "opacity-100"
                    )}>
                      {!isPlaying && (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-background/80 flex items-center justify-center">
                          <Play className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : useRemotionPreview && clips.length === 0 ? (
                  <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black rounded-sm">
                    <div className="text-white/50 text-center">
                      <Music className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Añade clips al timeline para ver la vista previa</p>
                    </div>
                  </div>
                ) : (
                  /* Fallback: Video HTML5 clásico (cuando Remotion está desactivado) */
                  <div className="relative w-full h-full overflow-hidden flex items-center justify-center bg-black rounded-sm">
                    {videoUrl ? (
                      <video 
                        ref={previewVideoRef}
                        src={videoUrl}
                        preload="auto"
                        playsInline
                        muted={isMuted}
                        loop={false}
                        className="h-auto max-h-full max-w-full object-contain z-20"
                        onClick={togglePlay}
                        style={{ width: "100%" }}
                        onCanPlay={(e) => {
                          if (videoRef.current) {
                            e.currentTarget.currentTime = videoRef.current.currentTime;
                          }
                          setPreviewLoaded(true);
                        }}
                      />
                    ) : (
                      <div className="text-white/50 text-center">
                        <Music className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Sin video de referencia</p>
                      </div>
                    )}
                    {/* Overlay play/pause para video clásico */}
                    <div className={cn(
                      "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                      "bg-black/30 pointer-events-none",
                      isPlaying ? "opacity-0" : "opacity-100"
                    )}>
                      {!isPlaying && (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-background/80 flex items-center justify-center">
                          <Play className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Indicador de tiempo de reproducción */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
                  <div 
                    className="h-full bg-primary"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Regla temporal mejorada para táctil */}
          <div className="time-ruler h-8 md:h-10 border-b border-border relative bg-muted/20 overflow-hidden">
            <div 
              className="ruler-marks absolute top-0 left-0 h-full"
              style={{ width: `${timelineWidth}px` }}
            >
              {/* Marcas temporales - visible solo en marcas importantes en móvil */}
              {Array.from({ length: Math.ceil(timelineDuration) + 1 }).map((_, i) => (
                <div 
                  key={`mark-${i}`}
                  className="time-mark absolute top-0 h-full border-l text-xs"
                  style={{ 
                    left: `${i * PIXELS_PER_SECOND * zoom}px`,
                    borderColor: i % 5 === 0 ? 'currentColor' : 'var(--border)',
                    display: (i % 5 === 0 || window.innerWidth > 768) ? 'block' : 'none'
                  }}
                >
                  {i % 5 === 0 && (
                    <span className="absolute top-1 left-1 text-xs md:text-sm">{formatTime(i)}</span>
                  )}
                </div>
              ))}
              
              {/* Marcas de beats (si está habilitado) - optimizado para móvil */}
              {showBeatGrid && beatMap && beatMap.beats.map((beat, i) => (
                <div 
                  key={`beat-${i}`}
                  className={cn(
                    "beat-mark absolute top-0 h-full border-l border-dashed",
                    beat.type === 'downbeat' ? 'border-primary/60' : 'border-primary/30',
                    beat.type !== 'downbeat' && 'hidden md:block' // Oculta marcas secundarias en móvil
                  )}
                  style={{ 
                    left: `${beat.time * PIXELS_PER_SECOND * zoom}px`,
                  }}
                />
              ))}
              
              {/* Marcador de posición actual - más grande para mejor visibilidad en pantallas táctiles */}
              <div 
                className="playhead absolute top-0 h-full w-1 md:w-px bg-destructive z-10"
                style={{ left: `${currentTime * PIXELS_PER_SECOND * zoom}px` }}
              >
                <div className="w-4 h-4 md:w-3 md:h-3 bg-destructive absolute -left-2 md:-left-1.5 -top-2 md:-top-1.5 rounded-full" />
              </div>
            </div>
          </div>
          
          {/* Área de clips */}
          <ScrollArea 
            className="timeline-scroll-area h-[calc(100%-2rem)]"
            scrollHideDelay={100}
          >
            <div 
              ref={timelineRef}
              className="timeline-tracks relative"
              style={{ 
                width: `${timelineWidth}px`,
                minHeight: `${layers.reduce((h, layer) => h + (layer.height || 50), 0)}px` 
              }}
              onClick={handleTimelineClick}
            >
              {/* Fondo de las secciones (si está habilitado) */}
              {showBeatGrid && beatMap && beatMap.sections.map((section, i) => (
                <div 
                  key={`section-${i}`}
                  className="section-marker absolute top-0 h-full bg-primary/5 border-l border-r border-primary/20"
                  style={{ 
                    left: `${section.startTime * PIXELS_PER_SECOND * zoom}px`,
                    width: `${(section.endTime - section.startTime) * PIXELS_PER_SECOND * zoom}px`
                  }}
                >
                  <div className="text-xs text-muted-foreground absolute top-0 left-1">
                    {section.name}
                  </div>
                </div>
              ))}
              
              {/* Lineas horizontales de capas */}
              {layers.map((layer, i) => (
                <div 
                  key={`layer-${layer.id}`}
                  className={cn(
                    "layer-track relative border-b border-border",
                    !visibleLayers[layer.id] && "opacity-30"
                  )}
                  style={{ 
                    height: `${layer.height || 50}px`,
                    top: `${layers.slice(0, i).reduce((h, l) => h + (l.height || 50), 0)}px`
                  }}
                >
                  {/* Fondo de la capa */}
                  <div 
                    className="layer-background absolute inset-0 z-0"
                    style={{ 
                      backgroundColor: `${layer.color}10`,
                      borderLeft: `4px solid ${layer.color}`
                    }}
                  />
                  
                  {/* Clips de esta capa - mejorados para móvil CON IMAGEN */}
                  {clips
                    .filter(clip => clip.layer === layer.id)
                    .map(clip => {
                      // Obtener URL de imagen - buscar en todos los campos posibles
                      const clipImageUrl = clip.url || clip.imageUrl || clip.thumbnail || 
                                          clip.generatedImage || clip.image_url || 
                                          clip.publicUrl || clip.firebaseUrl || '';
                      const hasImage = clipImageUrl && (clip.type === 'image' || clip.type === 'video');
                      
                      return (
                        <div 
                          key={`clip-${clip.id}`}
                          className={cn(
                            "clip absolute rounded border-2 flex items-center justify-center overflow-hidden",
                            "cursor-pointer select-none shadow-sm touch-manipulation",
                            "min-h-[30px] min-w-[40px]", // Mínimo tamaño para interacción táctil
                            selectedClipId === clip.id && "ring-2 ring-ring ring-offset-1",
                            lockedLayers[layer.id] && "opacity-50 cursor-not-allowed"
                          )}
                          style={{ 
                            left: `${clip.start * PIXELS_PER_SECOND * zoom}px`,
                            width: `${clip.duration * PIXELS_PER_SECOND * zoom}px`,
                            top: '4px',
                            height: 'calc(100% - 8px)',
                            backgroundColor: hasImage ? 'transparent' : (CLIP_COLORS[layer.type as LayerType]?.background || '#e0e0e0'),
                            borderColor: CLIP_COLORS[layer.type as LayerType]?.border || '#c0c0c0',
                            color: CLIP_COLORS[layer.type as LayerType]?.text || '#333333',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClipId(clip.id);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            seekToTime(clip.start);
                          }}
                        >
                          {/* IMAGEN DE FONDO del clip si existe */}
                          {hasImage && (
                            <img 
                              src={clipImageUrl}
                              alt={clip.title || clip.name || 'Clip'}
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{ opacity: 0.85 }}
                              onError={(e) => {
                                // Si falla la carga de imagen, ocultarla
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          
                          {/* Overlay oscuro para mejorar legibilidad del texto */}
                          {hasImage && (
                            <div className="absolute inset-0 bg-black/30" />
                          )}
                          
                          {/* Contenido del clip (diferente según el tipo) - optimizado para pantallas pequeñas */}
                          <div className={cn(
                            "clip-content text-xs md:font-medium px-1 truncate w-full text-center relative z-10",
                            hasImage && "text-white font-medium drop-shadow-md"
                          )}>
                            {clip.title || clip.name || (clip.type === 'audio' ? 'Audio' : 
                              clip.type === 'image' ? 'Imagen' : 
                              clip.type === 'text' ? 'Texto' : 
                              clip.type === 'effect' ? 'Efecto' : 'Clip')}
                          </div>
                          
                          {/* Iconos de metadatos del clip - más grandes para táctil */}
                          {clip.metadata && (
                            <div className="absolute right-1 top-1 flex space-x-1 z-10">
                              {clip.metadata.movementApplied && (
                                <div className="w-2.5 h-2.5 md:w-2 md:h-2 bg-blue-500 rounded-full" title="Movimiento aplicado" />
                              )}
                              {clip.metadata.faceSwapApplied && (
                                <div className="w-2.5 h-2.5 md:w-2 md:h-2 bg-purple-500 rounded-full" title="Face swap aplicado" />
                              )}
                              {clip.metadata.musicianIntegrated && (
                                <div className="w-2.5 h-2.5 md:w-2 md:h-2 bg-green-500 rounded-full" title="Músico integrado" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ))}
              
              {/* Marcador de posición actual (línea vertical) */}
              <div 
                className="playhead-line absolute top-0 h-full w-px bg-destructive z-20"
                style={{ left: `${currentTime * PIXELS_PER_SECOND * zoom}px` }}
              />
            </div>
          </ScrollArea>
        </div>
      </div>
      
      {/* Panel de propiedades (para clip seleccionado) - Optimizado para táctil */}
      {selectedClipId !== null && (
        <div className="properties-panel border-t border-border p-3 bg-background/80">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Propiedades del clip</h3>
            
            {/* Botones de acción rápida para móvil */}
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline"
                size="sm"
                className="h-8 px-2 md:h-7 touch-manipulation"
                onClick={() => seekToTime(clips.find(c => c.id === selectedClipId)?.start || 0)}
                title="Ir al inicio del clip"
              >
                <Play className="h-4 w-4" />
              </Button>
              
              <Button 
                variant="destructive"
                size="sm"
                className="h-8 px-2 md:h-7 touch-manipulation"
                onClick={() => deleteClip(selectedClipId)}
                disabled={readOnly}
                title="Eliminar clip"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Datos del clip - adaptado para móvil */}
            <div className="space-y-3">
              {/* Título - botones más grandes */}
              <div className="grid grid-cols-3 items-center gap-2">
                <Label htmlFor="clip-title" className="text-xs col-span-1">Título:</Label>
                <Input 
                  id="clip-title"
                  className="col-span-2 h-9 md:h-8"
                  value={clips.find(c => c.id === selectedClipId)?.title || clips.find(c => c.id === selectedClipId)?.name || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateClip(selectedClipId, { 
                      title: value,
                      name: value // Actualizar ambos campos para mantener la compatibilidad
                    });
                  }}
                  disabled={readOnly}
                />
              </div>
              
              {/* Tipo */}
              <div className="grid grid-cols-3 items-center">
                <Label className="text-xs">Tipo:</Label>
                <span className="col-span-2 text-sm">
                  {clips.find(c => c.id === selectedClipId)?.type}
                </span>
              </div>
              
              {/* Capa */}
              <div className="grid grid-cols-3 items-center">
                <Label className="text-xs">Capa:</Label>
                <span className="col-span-2 text-sm">
                  {layers.find(l => 
                    l.id === clips.find(c => c.id === selectedClipId)?.layer
                  )?.name}
                </span>
              </div>
            </div>
            
            {/* Posición y tiempo - controles optimizados para móvil */}
            <div className="space-y-3">
              {/* Inicio - control optimizado para táctil */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="clip-start" className="text-xs">Inicio:</Label>
                  <span className="text-xs font-mono">
                    {formatTime(clips.find(c => c.id === selectedClipId)?.start || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0 touch-manipulation"
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (clip) updateClip(selectedClipId, { start: Math.max(0, clip.start - 0.1) });
                    }}
                    disabled={readOnly}
                  >
                    <span className="text-xs">-0.1</span>
                  </Button>
                  
                  <Input 
                    id="clip-start"
                    className="h-8"
                    type="range"
                    min={0}
                    max={timelineDuration - (clips.find(c => c.id === selectedClipId)?.duration || 0)}
                    step={0.1}
                    value={clips.find(c => c.id === selectedClipId)?.start || 0}
                    onChange={(e) => updateClip(selectedClipId, { start: parseFloat(e.target.value) })}
                    disabled={readOnly}
                  />
                  
                  <Button 
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0 touch-manipulation"
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (clip) {
                        const maxStart = timelineDuration - clip.duration;
                        updateClip(selectedClipId, { start: Math.min(maxStart, clip.start + 0.1) });
                      }
                    }}
                    disabled={readOnly}
                  >
                    <span className="text-xs">+0.1</span>
                  </Button>
                </div>
              </div>
              
              {/* Duración - control optimizado para táctil */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="clip-duration" className="text-xs">Duración:</Label>
                  <span className="text-xs font-mono">
                    {formatTime(clips.find(c => c.id === selectedClipId)?.duration || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0 touch-manipulation"
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (clip) updateClip(selectedClipId, { duration: Math.max(0.1, clip.duration - 0.1) });
                    }}
                    disabled={readOnly}
                  >
                    <span className="text-xs">-0.1</span>
                  </Button>
                  
                  <Input 
                    id="clip-duration"
                    className="h-8"
                    type="range"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={clips.find(c => c.id === selectedClipId)?.duration || 0}
                    onChange={(e) => updateClip(selectedClipId, { duration: parseFloat(e.target.value) })}
                    disabled={readOnly}
                  />
                  
                  <Button 
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 shrink-0 touch-manipulation"
                    onClick={() => {
                      const clip = clips.find(c => c.id === selectedClipId);
                      if (clip) {
                        const maxDuration = timelineDuration - clip.start;
                        updateClip(selectedClipId, { duration: Math.min(maxDuration, clip.duration + 0.1) });
                      }
                    }}
                    disabled={readOnly}
                  >
                    <span className="text-xs">+0.1</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Función auxiliar para formatear tiempo en formato MM:SS.MS
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

// La interfaz TimelineClip ya está exportada directamente arriba