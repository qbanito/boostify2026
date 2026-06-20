import { useRef, useState, useCallback, useEffect } from 'react';
import { 
  ClipOperation, 
  CLIP_HANDLE_WIDTH 
} from '../../constants/timeline-constants';

/**
 * Opciones para configurar las interacciones con clips
 */
export interface ClipInteractionsOptions {
  /**
   * Función que se llama cuando un clip se mueve
   */
  onMoveClip?: (clipId: number, newStartTime: number) => void;
  
  /**
   * Función que se llama cuando se redimensiona un clip
   */
  onResizeClip?: (clipId: number, isStart: boolean, newTime: number) => void;
  
  /**
   * Función que se llama cuando se selecciona un clip
   */
  onSelectClip?: (clipId: number) => void;
  
  /**
   * Función que se llama cuando se inicia una operación de clip
   */
  onOperationStart?: (operation: ClipOperation, clipId: number) => void;
  
  /**
   * Función que se llama cuando finaliza una operación de clip
   */
  onOperationEnd?: (operation: ClipOperation, clipId: number) => void;
  
  /**
   * Función para convertir píxeles a segundos según el zoom actual
   */
  pixelsToSeconds: (pixels: number) => number;
  
  /**
   * Función para convertir segundos a píxeles según el zoom actual
   */
  secondsToPixels: (seconds: number) => number;
  
  /**
   * Ancho del controlador de redimensionamiento en píxeles
   */
  handleWidth?: number;
}

/**
 * Hook para manejar las interacciones del usuario con los clips en el timeline
 * 
 * Este hook maneja:
 * - Selección de clips
 * - Arrastrar clips para moverlos
 * - Redimensionar clips desde el inicio o final
 * - Operaciones de movimiento de ratón y eventos táctiles
 */
export function useClipInteractions({
  onMoveClip,
  onResizeClip,
  onSelectClip,
  onOperationStart,
  onOperationEnd,
  pixelsToSeconds,
  secondsToPixels,
  handleWidth = CLIP_HANDLE_WIDTH
}: ClipInteractionsOptions) {
  // Estado para la operación actual y el clip seleccionado
  const [operation, setOperation] = useState<ClipOperation>(ClipOperation.NONE);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  
  // Refs para guardar la posición inicial y el desplazamiento
  const offsetXRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const activeClipIdRef = useRef<number | null>(null);
  
  /**
   * Inicia una operación de mover clip
   */
  const startMoveOperation = useCallback((clipId: number, clientX: number, currentStartTime: number) => {
    setOperation(ClipOperation.MOVE);
    activeClipIdRef.current = clipId;
    startXRef.current = clientX;
    offsetXRef.current = secondsToPixels(currentStartTime);
    
    if (onOperationStart) {
      onOperationStart(ClipOperation.MOVE, clipId);
    }
  }, [onOperationStart, secondsToPixels]);
  
  /**
   * Inicia una operación de redimensionar clip desde el inicio
   */
  const startResizeStartOperation = useCallback((clipId: number, clientX: number, currentStartTime: number) => {
    setOperation(ClipOperation.RESIZE_START);
    activeClipIdRef.current = clipId;
    startXRef.current = clientX;
    offsetXRef.current = secondsToPixels(currentStartTime);
    
    if (onOperationStart) {
      onOperationStart(ClipOperation.RESIZE_START, clipId);
    }
  }, [onOperationStart, secondsToPixels]);
  
  /**
   * Inicia una operación de redimensionar clip desde el final
   */
  const startResizeEndOperation = useCallback((clipId: number, clientX: number, currentEndTime: number) => {
    setOperation(ClipOperation.RESIZE_END);
    activeClipIdRef.current = clipId;
    startXRef.current = clientX;
    offsetXRef.current = secondsToPixels(currentEndTime);
    
    if (onOperationStart) {
      onOperationStart(ClipOperation.RESIZE_END, clipId);
    }
  }, [onOperationStart, secondsToPixels]);
  
  /**
   * Maneja el movimiento durante una operación activa
   */
  const handleMouseMove = useCallback((clientX: number) => {
    if (operation === ClipOperation.NONE || activeClipIdRef.current === null) {
      return;
    }
    
    const deltaX = clientX - startXRef.current;
    const newPositionPx = offsetXRef.current + deltaX;
    const newPositionSec = pixelsToSeconds(newPositionPx);
    
    switch (operation) {
      case ClipOperation.MOVE:
        if (onMoveClip) {
          onMoveClip(activeClipIdRef.current, newPositionSec);
        }
        break;
        
      case ClipOperation.RESIZE_START:
        if (onResizeClip) {
          onResizeClip(activeClipIdRef.current, true, newPositionSec);
        }
        break;
        
      case ClipOperation.RESIZE_END:
        if (onResizeClip) {
          onResizeClip(activeClipIdRef.current, false, newPositionSec);
        }
        break;
    }
  }, [operation, onMoveClip, onResizeClip, pixelsToSeconds]);
  
  /**
   * Finaliza cualquier operación activa
   */
  const endOperation = useCallback(() => {
    if (operation !== ClipOperation.NONE && activeClipIdRef.current !== null) {
      if (onOperationEnd) {
        onOperationEnd(operation, activeClipIdRef.current);
      }
      
      // Restablecer el estado
      setOperation(ClipOperation.NONE);
      activeClipIdRef.current = null;
    }
  }, [operation, onOperationEnd]);
  
  /**
   * Selecciona un clip
   */
  const selectClip = useCallback((clipId: number) => {
    setSelectedClipId(clipId);
    if (onSelectClip) {
      onSelectClip(clipId);
    }
  }, [onSelectClip]);
  
  /**
   * Deselecciona el clip actual
   */
  const deselectClip = useCallback(() => {
    setSelectedClipId(null);
  }, []);
  
  /**
   * Maneja los eventos de ratón para un clip
   */
  const getClipMouseHandlers = useCallback((
    clipId: number, 
    startTime: number, 
    endTime: number
  ) => {
    return {
      onClick: (e: React.MouseEvent) => {
        // Si no estamos en una operación, seleccionar el clip
        if (operation === ClipOperation.NONE) {
          e.stopPropagation();
          selectClip(clipId);
        }
      },
      onMouseDown: (e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Obtener la posición relativa del cursor dentro del clip
        const clipElement = e.currentTarget as HTMLElement;
        const clipRect = clipElement.getBoundingClientRect();
        const relativeX = e.clientX - clipRect.left;
        
        // Determinar la operación según la posición del cursor
        if (relativeX <= handleWidth) {
          // Cerca del borde izquierdo - redimensionar desde el inicio
          startResizeStartOperation(clipId, e.clientX, startTime);
        } else if (relativeX >= clipRect.width - handleWidth) {
          // Cerca del borde derecho - redimensionar desde el final
          startResizeEndOperation(clipId, e.clientX, endTime);
        } else {
          // En el medio - mover
          startMoveOperation(clipId, e.clientX, startTime);
        }
        
        // Seleccionar el clip
        selectClip(clipId);
      }
    };
  }, [
    operation, 
    selectClip, 
    startMoveOperation, 
    startResizeEndOperation, 
    startResizeStartOperation, 
    handleWidth
  ]);
  
  /**
   * Configura los event listeners globales
   */
  useEffect(() => {
    // Manejador para movimiento del ratón
    const handleGlobalMouseMove = (e: MouseEvent) => {
      handleMouseMove(e.clientX);
    };
    
    // Manejador para soltar el botón del ratón
    const handleGlobalMouseUp = () => {
      endOperation();
    };
    
    // Manejador para clics fuera de los clips
    const handleGlobalClick = (e: MouseEvent) => {
      // Verificar si el clic fue directamente en el timeline (no en un clip)
      const clickedOnClip = (e.target as HTMLElement)?.closest('.timeline-clip');
      if (!clickedOnClip) {
        deselectClip();
      }
    };
    
    // Añadir event listeners
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('click', handleGlobalClick);
    
    // Limpiar event listeners al desmontar
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [handleMouseMove, endOperation, deselectClip]);
  
  /**
   * Obtiene el estilo del cursor según la operación y posición
   */
  const getClipCursorStyle = useCallback((e: React.MouseEvent) => {
    // Si hay una operación activa, no cambiar el cursor
    if (operation !== ClipOperation.NONE) {
      return;
    }
    
    // Obtener la posición relativa del cursor dentro del clip
    const clipElement = e.currentTarget as HTMLElement;
    const clipRect = clipElement.getBoundingClientRect();
    const relativeX = e.clientX - clipRect.left;
    
    if (relativeX <= handleWidth) {
      return 'ew-resize'; // Redimensionar desde el inicio
    } else if (relativeX >= clipRect.width - handleWidth) {
      return 'ew-resize'; // Redimensionar desde el final
    } else {
      return 'move'; // Mover
    }
  }, [operation, handleWidth]);
  
  return {
    operation,
    selectedClipId,
    activeClipId: activeClipIdRef.current,
    getClipMouseHandlers,
    getClipCursorStyle,
    selectClip,
    deselectClip,
    isSelected: (clipId: number) => selectedClipId === clipId,
    handleMouseMove,
    endOperation
  };
}