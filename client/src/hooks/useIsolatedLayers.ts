/**
 * Hook personalizado para gestionar las restricciones en capas aisladas
 * 
 * Este hook proporciona:
 * - Validación de operaciones en clips dentro de capas aisladas
 * - Restricciones para tipos específicos de capas (audio, placeholders IA, etc.)
 * - Mensajes de error personalizados para operaciones no permitidas
 */

import { useState, useCallback } from 'react';
import { LayerType } from '../interfaces/timeline';
import { ClipOperation } from '../constants/timeline-constants';
import { TimelineClip } from '../components/timeline/TimelineClip';

/**
 * Opciones para el hook de capas aisladas
 */
interface IsolatedLayersOptions {
  // Tipos de capas con restricciones especiales
  restrictedLayerTypes?: string[];
  
  // Duración máxima permitida para placeholders de IA (en segundos)
  maxAIPlaceholderDuration?: number;
  
  // Permitir o no solapamiento de clips en la misma capa
  allowOverlap?: boolean;
}

/**
 * Resultado de la validación de operaciones en clips
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string; // Propiedad alias para compatibilidad
}

/**
 * Hook personalizado para manejar lógica de validación de operaciones en capas aisladas
 */
function useIsolatedLayers(options: IsolatedLayersOptions = {}) {
  // Opciones por defecto
  const {
    restrictedLayerTypes = [
      LayerType.AUDIO,  // Capa de audio completamente aislada
      LayerType.VIDEO,  // Capa de video con restricciones de edición
      LayerType.TEXT,   // Capa de texto con edición estándar
      LayerType.EFFECT  // Capa de efectos avanzados
    ],
    maxAIPlaceholderDuration = 5, // 5 segundos por defecto
    allowOverlap = false
  } = options;

  // Último error de validación
  const [lastError, setLastError] = useState<string | null>(null);

  /**
   * Validar si es posible realizar una operación en un clip
   */
  const validateClipOperation = useCallback((
    clip: TimelineClip,
    existingClips: TimelineClip[],
    operation: ClipOperation,
    layerType?: string // Parámetro opcional para compatibilidad
  ): ValidationResult => {
    // Resultado por defecto
    const result: ValidationResult = { isValid: true };

    // Validar restricciones específicas para placeholders de IA
    if (clip.metadata?.isAIGenerated || clip.type === 'ai_placeholder') {
      // Validar duración máxima para placeholders de IA
      if (clip.duration > maxAIPlaceholderDuration) {
        result.isValid = false;
        result.error = `AI Placeholder duration exceeds maximum allowed (${maxAIPlaceholderDuration}s)`;
        result.message = result.error; // Para compatibilidad
        setLastError(result.error);
        return result;
      }
    }

    // Validar capas restringidas
    if (restrictedLayerTypes.includes(clip.type)) {
      // Para capas restringidas, solo permitir ciertas operaciones
      switch (operation) {
        case ClipOperation.ADD:
          // Permitir añadir clips en capas restringidas
          break;
          
        case ClipOperation.DELETE:
          // No permitir eliminar en algunos casos específicos
          if (existingClips.filter(c => c.layer === clip.layer).length <= 1) {
            result.isValid = false;
            result.error = 'Cannot delete the last clip in an isolated layer';
            result.message = result.error; // Para compatibilidad
            setLastError(result.error);
            return result;
          }
          break;
          
        case ClipOperation.MOVE:
        case ClipOperation.RESIZE_START:
        case ClipOperation.RESIZE_END:
        case ClipOperation.DUPLICATE:
        case ClipOperation.SPLIT:
          // Por defecto, no permitir otras operaciones en capas restringidas
          result.isValid = false;
          result.error = 'Cannot modify clips in isolated layers';
          result.message = result.error; // Para compatibilidad
          setLastError(result.error);
          return result;
          
        default:
          // Operación desconocida
          result.isValid = false;
          result.error = 'Invalid operation on restricted layer';
          result.message = result.error; // Para compatibilidad
          setLastError(result.error);
          return result;
      }
    }

    // Validar solapamiento de clips (si no está permitido)
    if (!allowOverlap && [ClipOperation.ADD, ClipOperation.MOVE, ClipOperation.RESIZE_START, ClipOperation.RESIZE_END].includes(operation)) {
      // Obtener clips en la misma capa
      const clipsInSameLayer = existingClips.filter(c => 
        c.layer === clip.layer && c.id !== clip.id
      );
      
      // Calcular tiempo de inicio y fin del clip
      const clipStart = clip.start;
      const clipEnd = clip.start + clip.duration;
      
      // Verificar solapamiento con otros clips
      const hasOverlap = clipsInSameLayer.some(otherClip => {
        const otherStart = otherClip.start;
        const otherEnd = otherClip.start + otherClip.duration;
        
        // Detectar si hay solapamiento entre los clips
        return (
          (clipStart >= otherStart && clipStart < otherEnd) || // El inicio del clip está dentro del otro
          (clipEnd > otherStart && clipEnd <= otherEnd) ||     // El fin del clip está dentro del otro
          (clipStart <= otherStart && clipEnd >= otherEnd)     // El clip contiene completamente al otro
        );
      });
      
      if (hasOverlap) {
        result.isValid = false;
        result.error = 'Clips cannot overlap in this layer';
        result.message = result.error; // Para compatibilidad
        setLastError(result.error);
        return result;
      }
    }

    // Si llegamos aquí, la operación es válida
    setLastError(null);
    return result;
  }, [restrictedLayerTypes, maxAIPlaceholderDuration, allowOverlap]);

  /**
   * Obtener el último error de validación
   */
  const getLastError = useCallback(() => {
    return lastError;
  }, [lastError]);

  /**
   * Limpiar el último error
   */
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  return {
    validateClipOperation,
    getLastError,
    clearError
  };
}

// Exportar el hook principal
export { useIsolatedLayers };

// Para mantener compatibilidad con las importaciones existentes
export const IsolatedLayerOperation = ClipOperation;

// Re-exportamos tipos para mantener la compatibilidad
export type { TimelineClip, IsolatedLayersOptions, ValidationResult };