import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ZOOM_FACTOR_IN, 
  ZOOM_FACTOR_OUT, 
  MAX_ZOOM, 
  MIN_ZOOM,
  AUTOSCROLL_THRESHOLD_FACTOR,
  SCROLL_POSITION_FORWARD,
  SCROLL_POSITION_BACKWARD
} from '../../constants/timeline-constants';
import { TimelineClip } from '../../components/music-video/timeline-editor';

interface UseTimelineNavigationProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  selectedClip: number | null;
  clips: TimelineClip[];
}

interface UseTimelineNavigationResult {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  timeToPixels: (time: number) => number;
  pixelsToTime: (pixels: number) => number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  updatePlayheadPosition: () => void;
}

/**
 * Hook para manejar la navegación en el timeline, incluyendo zoom y scroll
 */
export function useTimelineNavigation({
  duration,
  currentTime,
  isPlaying,
  selectedClip,
  clips
}: UseTimelineNavigationProps): UseTimelineNavigationResult {
  const [zoom, setZoom] = useState<number>(1);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  // Funciones de conversión entre tiempo y píxeles
  const timeToPixels = useCallback((time: number) => time * zoom * 100, [zoom]);
  const pixelsToTime = useCallback((pixels: number) => pixels / (zoom * 100), [zoom]);
  
  // Función para aumentar el zoom
  const handleZoomIn = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.min(prev * ZOOM_FACTOR_IN, MAX_ZOOM);
      
      // Si hay un clip seleccionado, centrar la vista en él
      if (selectedClip !== null && scrollAreaRef.current) {
        const clip = clips.find(c => c.id === selectedClip);
        if (clip) {
          const clipCenter = (clip.start + clip.duration / 2) * newZoom * 100;
          scrollAreaRef.current.scrollLeft = clipCenter - scrollAreaRef.current.clientWidth / 2;
        }
      }
      
      return newZoom;
    });
  }, [selectedClip, clips, zoom]);
  
  // Función para disminuir el zoom
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / ZOOM_FACTOR_OUT, MIN_ZOOM));
  }, []);
  
  // Función para actualizar la posición del playhead y gestionar auto-scroll
  const updatePlayheadPosition = useCallback(() => {
    const playheadPosition = timeToPixels(currentTime);
    
    // Auto-scroll optimizado
    if (scrollAreaRef.current && isPlaying) {
      const scrollLeft = scrollAreaRef.current.scrollLeft;
      const clientWidth = scrollAreaRef.current.clientWidth;
      const threshold = clientWidth * AUTOSCROLL_THRESHOLD_FACTOR;
      
      // Scroll profesional estilo CapCut/Premiere
      if (playheadPosition > scrollLeft + clientWidth - threshold) {
        // Borde derecho - scroll anticipado
        const targetScroll = playheadPosition - (clientWidth * SCROLL_POSITION_FORWARD);
        scrollAreaRef.current.scrollTo({
          left: targetScroll,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      } else if (playheadPosition < scrollLeft + threshold && scrollLeft > 0) {
        // Borde izquierdo - scroll anticipado
        const targetScroll = Math.max(0, playheadPosition - (clientWidth * SCROLL_POSITION_BACKWARD));
        scrollAreaRef.current.scrollTo({
          left: targetScroll,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        });
      }
    }
  }, [currentTime, isPlaying, timeToPixels]);
  
  // Actualizar la posición del playhead cuando cambie el tiempo o el estado de reproducción
  useEffect(() => {
    updatePlayheadPosition();
  }, [currentTime, isPlaying, updatePlayheadPosition]);
  
  return {
    zoom,
    setZoom,
    scrollAreaRef,
    timeToPixels,
    pixelsToTime,
    handleZoomIn,
    handleZoomOut,
    updatePlayheadPosition
  };
}