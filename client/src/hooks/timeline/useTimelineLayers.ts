import { useState, useCallback, useMemo } from 'react';
import { LayerType } from '../../interfaces/timeline';

export interface LayerConfig {
  /**
   * ID único de la capa
   */
  id: number;
  
  /**
   * Nombre descriptivo de la capa
   */
  name: string;
  
  /**
   * Tipo de capa (audio, video, texto, efectos)
   */
  type: LayerType;
  
  /**
   * Si la capa está bloqueada para edición
   */
  locked: boolean;
  
  /**
   * Si la capa está visible
   */
  visible: boolean;
  
  /**
   * Color asociado con la capa (opcional)
   */
  color?: string;
  
  /**
   * Altura en píxeles de la capa
   */
  height: number;
  
  /**
   * Metadatos adicionales específicos para cada tipo de capa
   */
  metadata?: Record<string, any>;
}

interface TimelineLayersOptions {
  /**
   * Callback cuando cambia una capa
   */
  onLayerChange?: (layers: LayerConfig[]) => void;
  
  /**
   * Altura predeterminada de las capas
   */
  defaultLayerHeight?: number;
}

/**
 * Hook para gestionar las capas del timeline
 * 
 * Permite:
 * - Crear capas de diferentes tipos (audio, video, texto, efectos)
 * - Reordenar capas
 * - Cambiar visibilidad y bloqueo de capas
 * - Eliminar capas
 */
export function useTimelineLayers({
  onLayerChange,
  defaultLayerHeight = 50
}: TimelineLayersOptions = {}) {
  // Estado para las capas
  const [layers, setLayers] = useState<LayerConfig[]>([
    // Capa de audio (siempre presente en la posición más baja)
    {
      id: LayerType.AUDIO,
      name: 'Audio',
      type: LayerType.AUDIO,
      locked: false,
      visible: true,
      height: defaultLayerHeight,
      color: '#3498db' // Azul
    },
    // Capa de video/imagen (siempre presente arriba del audio)
    {
      id: LayerType.VIDEO,
      name: 'Video/Imagen',
      type: LayerType.VIDEO,
      locked: false,
      visible: true,
      height: defaultLayerHeight,
      color: '#9b59b6' // Púrpura
    }
  ]);
  
  /**
   * Añade una nueva capa de un tipo específico
   */
  const addLayer = useCallback((type: LayerType, name?: string, metadata?: Record<string, any>) => {
    const newLayer: LayerConfig = {
      id: Date.now(), // ID único basado en timestamp
      name: name || getDefaultLayerName(type),
      type,
      locked: false,
      visible: true,
      height: defaultLayerHeight,
      color: getLayerColorByType(type),
      metadata
    };
    
    setLayers(prevLayers => {
      const updatedLayers = [...prevLayers, newLayer];
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
    
    return newLayer;
  }, [defaultLayerHeight, onLayerChange]);
  
  /**
   * Elimina una capa por ID
   * Las capas base (audio y video) no pueden ser eliminadas
   */
  const removeLayer = useCallback((layerId: number) => {
    // No permitir eliminar las capas de audio o video
    if (layerId === LayerType.AUDIO || layerId === LayerType.VIDEO) {
      console.warn('No se pueden eliminar las capas base (audio y video)');
      return false;
    }
    
    setLayers(prevLayers => {
      const updatedLayers = prevLayers.filter(layer => layer.id !== layerId);
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
    
    return true;
  }, [onLayerChange]);
  
  /**
   * Actualiza una capa existente
   */
  const updateLayer = useCallback((layerId: number, updates: Partial<Omit<LayerConfig, 'id'>>) => {
    setLayers(prevLayers => {
      const updatedLayers = prevLayers.map(layer => {
        if (layer.id === layerId) {
          return { ...layer, ...updates };
        }
        return layer;
      });
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
  }, [onLayerChange]);
  
  /**
   * Cambia la visibilidad de una capa
   */
  const toggleLayerVisibility = useCallback((layerId: number) => {
    setLayers(prevLayers => {
      const updatedLayers = prevLayers.map(layer => {
        if (layer.id === layerId) {
          return { ...layer, visible: !layer.visible };
        }
        return layer;
      });
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
  }, [onLayerChange]);
  
  /**
   * Cambia el estado de bloqueo de una capa
   */
  const toggleLayerLock = useCallback((layerId: number) => {
    setLayers(prevLayers => {
      const updatedLayers = prevLayers.map(layer => {
        if (layer.id === layerId) {
          return { ...layer, locked: !layer.locked };
        }
        return layer;
      });
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
  }, [onLayerChange]);
  
  /**
   * Ajusta la altura de una capa
   */
  const resizeLayer = useCallback((layerId: number, height: number) => {
    // Asegurar que la altura esté dentro de límites razonables
    const constrainedHeight = Math.max(20, Math.min(200, height));
    
    setLayers(prevLayers => {
      const updatedLayers = prevLayers.map(layer => {
        if (layer.id === layerId) {
          return { ...layer, height: constrainedHeight };
        }
        return layer;
      });
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
  }, [onLayerChange]);
  
  /**
   * Mueve una capa hacia arriba en la pila de capas
   */
  const moveLayerUp = useCallback((layerId: number) => {
    setLayers(prevLayers => {
      const layerIndex = prevLayers.findIndex(layer => layer.id === layerId);
      
      // No se puede mover si ya está en la parte superior
      if (layerIndex === prevLayers.length - 1 || layerIndex === -1) {
        return prevLayers;
      }
      
      // Intercambiar con la capa de arriba
      const updatedLayers = [...prevLayers];
      [updatedLayers[layerIndex], updatedLayers[layerIndex + 1]] = 
      [updatedLayers[layerIndex + 1], updatedLayers[layerIndex]];
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
  }, [onLayerChange]);
  
  /**
   * Mueve una capa hacia abajo en la pila de capas
   */
  const moveLayerDown = useCallback((layerId: number) => {
    setLayers(prevLayers => {
      const layerIndex = prevLayers.findIndex(layer => layer.id === layerId);
      
      // No se puede mover si ya está en la parte inferior
      if (layerIndex <= 0 || layerIndex === -1) {
        return prevLayers;
      }
      
      // Intercambiar con la capa de abajo
      const updatedLayers = [...prevLayers];
      [updatedLayers[layerIndex], updatedLayers[layerIndex - 1]] = 
      [updatedLayers[layerIndex - 1], updatedLayers[layerIndex]];
      
      if (onLayerChange) {
        onLayerChange(updatedLayers);
      }
      
      return updatedLayers;
    });
  }, [onLayerChange]);
  
  /**
   * Restablece todas las capas a su estado original
   */
  const resetLayers = useCallback(() => {
    const defaultLayers = [
      {
        id: LayerType.AUDIO,
        name: 'Audio',
        type: LayerType.AUDIO,
        locked: false,
        visible: true,
        height: defaultLayerHeight,
        color: '#3498db' // Azul
      },
      {
        id: LayerType.VIDEO,
        name: 'Video/Imagen',
        type: LayerType.VIDEO,
        locked: false,
        visible: true,
        height: defaultLayerHeight,
        color: '#9b59b6' // Púrpura
      }
    ];
    
    setLayers(defaultLayers);
    
    if (onLayerChange) {
      onLayerChange(defaultLayers);
    }
  }, [defaultLayerHeight, onLayerChange]);
  
  /**
   * Devuelve solo las capas visibles
   */
  const visibleLayers = useMemo(() => {
    return layers.filter(layer => layer.visible);
  }, [layers]);
  
  /**
   * Obtiene una capa por ID
   */
  const getLayerById = useCallback((layerId: number) => {
    return layers.find(layer => layer.id === layerId) || null;
  }, [layers]);
  
  /**
   * Verifica si una capa está bloqueada
   */
  const isLayerLocked = useCallback((layerId: number) => {
    const layer = getLayerById(layerId);
    return layer ? layer.locked : false;
  }, [getLayerById]);
  
  return {
    layers,
    visibleLayers,
    addLayer,
    removeLayer,
    updateLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    resizeLayer,
    moveLayerUp,
    moveLayerDown,
    resetLayers,
    getLayerById,
    isLayerLocked
  };
}

/**
 * Obtiene un color adecuado según el tipo de capa
 */
function getLayerColorByType(type: LayerType | string): string {
  // Primero intentamos con el enum LayerType
  switch (type) {
    case LayerType.AUDIO:
      return '#3498db'; // Azul
    case LayerType.VIDEO:
      return '#9b59b6'; // Púrpura
    case LayerType.TEXT:
      return '#f39c12'; // Ámbar
    case LayerType.EFFECT:
      return '#2ecc71'; // Verde
    case LayerType.EFFECTS: // Compatibilidad
      return '#2ecc71'; // Verde
    case LayerType.IMAGE:
      return '#e74c3c'; // Rojo
    case LayerType.TRANSITION:
      return '#1abc9c'; // Turquesa
    case LayerType.AI_PLACEHOLDER:
      return '#d35400'; // Naranja
    case LayerType.VIDEO_IMAGE: // Compatibilidad
      return '#9b59b6'; // Púrpura
  }
  
  // Si no es un enum, probamos con string
  const typeStr = type.toString();
  const layerColors: Record<string, string> = {
    'audio': '#3498db',
    'video': '#9b59b6',
    'text': '#f39c12',
    'effect': '#2ecc71',
    'effects': '#2ecc71',
    'image': '#e74c3c',
    'transition': '#1abc9c', 
    'ai_placeholder': '#d35400',
    'video_image': '#9b59b6'
  };
  
  return layerColors[typeStr] || '#7f8c8d'; // Gris por defecto
}

/**
 * Obtiene un nombre predeterminado según el tipo de capa
 */
function getDefaultLayerName(type: LayerType): string {
  switch (type) {
    case LayerType.AUDIO:
      return 'Audio';
    case LayerType.VIDEO:
      return 'Video/Imagen';
    case LayerType.TEXT:
      return 'Texto';
    case LayerType.EFFECTS:
      return 'Efectos';
    default:
      return `Capa ${Date.now() % 1000}`;
  }
}