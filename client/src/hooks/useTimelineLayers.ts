/**
 * Hook personalizado para la gestión de capas en la línea de tiempo
 * 
 * Este hook proporciona:
 * - Estado para las capas (visibilidad, bloqueo, orden)
 * - Funciones para manipular capas (añadir, eliminar, reordenar, etc.)
 * - Soporte para capas aisladas (audio, video, etc.)
 */

import { useState, useCallback, useEffect } from 'react';
import { LayerType } from '../interfaces/timeline';

/**
 * Configuración de una capa
 */
export interface LayerConfig {
  id: number;
  name: string; 
  type: string;
  locked: boolean;
  visible: boolean;
  height: number;
  color: string;
}

/**
 * Opciones para crear el hook de capas
 */
export interface TimelineLayersOptions {
  createDefaultLayers?: boolean;
  isolatedLayerTypes?: string[];
  defaultLayerHeight?: number;
}

/**
 * Colores predeterminados para cada tipo de capa
 */
const LAYER_COLORS = {
  [LayerType.AUDIO]: '#8A2BE2',
  [LayerType.VIDEO]: '#4169E1',
  [LayerType.IMAGE]: '#20B2AA',
  [LayerType.TEXT]: '#FF6347',
  [LayerType.EFFECT]: '#FFD700',
  [LayerType.TRANSITION]: '#32CD32',
  [LayerType.AI_PLACEHOLDER]: '#BA55D3'
};

/**
 * Hook personalizado para gestionar las capas de la línea de tiempo
 */
function useTimelineLayers(
  initialLayers: LayerConfig[] = [],
  options: TimelineLayersOptions = {}
) {
  // Opciones predeterminadas
  const {
    createDefaultLayers = false,
    isolatedLayerTypes = [],
    defaultLayerHeight = 60
  } = options;

  // Estado de las capas
  const [layers, setLayers] = useState<LayerConfig[]>(() => {
    if (initialLayers.length > 0) {
      return [...initialLayers];
    }

    // Crear capas predeterminadas si se solicita
    if (createDefaultLayers) {
      return [
        // Capa 0: Audio - Aislada y bloqueada
        {
          id: 0,
          name: 'Audio Principal',
          type: LayerType.AUDIO,
          locked: true, // Siempre bloqueada
          visible: true,
          height: defaultLayerHeight,
          color: LAYER_COLORS[LayerType.AUDIO]
        },
        // Capa 1: Video/Imágenes - Para placeholders AI
        {
          id: 1,
          name: 'Video/Imágenes',
          type: LayerType.VIDEO,
          locked: isolatedLayerTypes.includes(LayerType.VIDEO),
          visible: true,
          height: defaultLayerHeight,
          color: LAYER_COLORS[LayerType.VIDEO]
        },
        // Capa 2: Texto - Para edición estándar
        {
          id: 2,
          name: 'Texto',
          type: LayerType.TEXT,
          locked: isolatedLayerTypes.includes(LayerType.TEXT),
          visible: true,
          height: defaultLayerHeight,
          color: LAYER_COLORS[LayerType.TEXT]
        },
        // Capa 3: Efectos - Para efectos avanzados
        {
          id: 3,
          name: 'Efectos',
          type: LayerType.EFFECT,
          locked: isolatedLayerTypes.includes(LayerType.EFFECT),
          visible: true,
          height: defaultLayerHeight,
          color: LAYER_COLORS[LayerType.EFFECT]
        }
      ];
    }

    return [];
  });

  // Estado para la visibilidad de las capas
  const [visibleLayers, setVisibleLayers] = useState<Record<number, boolean>>({});
  
  // Estado para el bloqueo de las capas
  const [lockedLayers, setLockedLayers] = useState<Record<number, boolean>>({});
  
  // Estado para la capa seleccionada actualmente
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(
    layers.length > 0 ? layers[0].id : null
  );

  // Inicializar estados de visibilidad y bloqueo basado en las capas
  useEffect(() => {
    const visibilityMap: Record<number, boolean> = {};
    const lockMap: Record<number, boolean> = {};

    layers.forEach(layer => {
      visibilityMap[layer.id] = layer.visible;
      lockMap[layer.id] = layer.locked;
    });

    setVisibleLayers(visibilityMap);
    setLockedLayers(lockMap);
  }, []);

  /**
   * Añadir una nueva capa
   */
  const addLayer = useCallback((type: string) => {
    setLayers(prevLayers => {
      // Encontrar el ID más alto para asignar un nuevo ID
      const highestId = Math.max(...prevLayers.map(layer => layer.id), -1);
      const newId = highestId + 1;

      // Crear una nueva capa
      const newLayer: LayerConfig = {
        id: newId,
        name: getLayerName(type, prevLayers),
        type,
        locked: isolatedLayerTypes.includes(type),
        visible: true,
        height: defaultLayerHeight,
        color: LAYER_COLORS[type as LayerType] || '#CCCCCC'
      };

      // Actualizar estados de visibilidad y bloqueo
      setVisibleLayers(prev => ({ ...prev, [newId]: true }));
      setLockedLayers(prev => ({ ...prev, [newId]: isolatedLayerTypes.includes(type) }));
      
      // Seleccionar la nueva capa
      setSelectedLayerId(newId);

      return [...prevLayers, newLayer];
    });
  }, [isolatedLayerTypes, defaultLayerHeight]);

  /**
   * Eliminar una capa
   */
  const removeLayer = useCallback((id: number) => {
    // No permitir eliminar capas aisladas
    if (layers.find(l => l.id === id && isolatedLayerTypes.includes(l.type))) {
      return false;
    }

    setLayers(prevLayers => {
      const updatedLayers = prevLayers.filter(layer => layer.id !== id);
      
      // Si se elimina la capa seleccionada, seleccionar otra
      if (selectedLayerId === id && updatedLayers.length > 0) {
        setSelectedLayerId(updatedLayers[0].id);
      } else if (updatedLayers.length === 0) {
        setSelectedLayerId(null);
      }
      
      return updatedLayers;
    });

    // Limpiar estados de visibilidad y bloqueo
    setVisibleLayers(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
    
    setLockedLayers(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    return true;
  }, [layers, selectedLayerId, isolatedLayerTypes]);

  /**
   * Cambiar el orden de las capas
   */
  const reorderLayers = useCallback((newOrder: number[]) => {
    // Verificar que todos los IDs estén presentes
    if (layers.length !== newOrder.length) return false;
    
    setLayers(prevLayers => {
      // Crear un mapa de capas por ID para facilitar la reordenación
      const layerMap = new Map(prevLayers.map(layer => [layer.id, layer]));
      
      // Crear nuevo array reordenado
      const reorderedLayers = newOrder.map(id => {
        const layer = layerMap.get(id);
        if (!layer) throw new Error(`Layer with ID ${id} not found`);
        return layer;
      });
      
      return reorderedLayers;
    });
    
    return true;
  }, [layers]);

  /**
   * Cambiar visibilidad de una capa
   */
  const toggleLayerVisibility = useCallback((id: number) => {
    setVisibleLayers(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    
    // También actualizar el estado en la lista de capas
    setLayers(prev => 
      prev.map(layer => 
        layer.id === id ? { ...layer, visible: !visibleLayers[id] } : layer
      )
    );
  }, [visibleLayers]);

  /**
   * Cambiar estado de bloqueo de una capa
   */
  const toggleLayerLock = useCallback((id: number) => {
    // No permitir desbloquear capas aisladas
    const layer = layers.find(l => l.id === id);
    if (layer && isolatedLayerTypes.includes(layer.type)) {
      return false;
    }

    setLockedLayers(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    
    // También actualizar el estado en la lista de capas
    setLayers(prev => 
      prev.map(layer => 
        layer.id === id ? { ...layer, locked: !lockedLayers[id] } : layer
      )
    );
    
    return true;
  }, [layers, lockedLayers, isolatedLayerTypes]);

  /**
   * Seleccionar una capa
   */
  const selectLayer = useCallback((id: number) => {
    setSelectedLayerId(id);
  }, []);

  /**
   * Actualizar una capa
   */
  const updateLayer = useCallback((id: number, updates: Partial<LayerConfig>) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return false;
    
    // No permitir cambiar el tipo de las capas aisladas
    if (isolatedLayerTypes.includes(layer.type) && updates.type && updates.type !== layer.type) {
      return false;
    }
    
    setLayers(prev => 
      prev.map(layer => 
        layer.id === id ? { ...layer, ...updates } : layer
      )
    );
    
    // Actualizar estados de visibilidad y bloqueo si se modifican
    if (updates.visible !== undefined) {
      setVisibleLayers(prev => ({
        ...prev,
        [id]: updates.visible as boolean
      }));
    }
    
    if (updates.locked !== undefined) {
      setLockedLayers(prev => ({
        ...prev,
        [id]: updates.locked as boolean
      }));
    }
    
    return true;
  }, [layers, isolatedLayerTypes]);

  /**
   * Generar un nombre único para una nueva capa
   */
  function getLayerName(type: string, existingLayers: LayerConfig[]): string {
    // Definir nombres base según el tipo
    const baseNames: Record<string, string> = {
      [LayerType.AUDIO]: 'Audio',
      [LayerType.VIDEO]: 'Video',
      [LayerType.IMAGE]: 'Imágenes',
      [LayerType.TEXT]: 'Texto',
      [LayerType.EFFECT]: 'Efectos',
      [LayerType.TRANSITION]: 'Transición',
      [LayerType.AI_PLACEHOLDER]: 'IA Placeholder'
    };
    
    const baseName = baseNames[type] || 'Capa';
    
    // Contar cuántas capas del mismo tipo ya existen
    const sameTypeCount = existingLayers.filter(layer => layer.type === type).length;
    
    // Si ya existe una capa de este tipo, añadir un número
    return sameTypeCount > 0 ? `${baseName} ${sameTypeCount + 1}` : baseName;
  }

  /**
   * Restaurar capas a su estado inicial
   */
  const resetLayers = useCallback(() => {
    setLayers(initialLayers);
    
    // Reiniciar estados de visibilidad y bloqueo
    const visibilityMap: Record<number, boolean> = {};
    const lockMap: Record<number, boolean> = {};
    
    initialLayers.forEach(layer => {
      visibilityMap[layer.id] = layer.visible;
      lockMap[layer.id] = layer.locked;
    });
    
    setVisibleLayers(visibilityMap);
    setLockedLayers(lockMap);
    
    // Seleccionar la primera capa si existe
    setSelectedLayerId(initialLayers.length > 0 ? initialLayers[0].id : null);
  }, [initialLayers]);

  /**
   * Verificar si una capa está aislada
   */
  const isIsolatedLayer = useCallback((layerId: number) => {
    const layer = layers.find(l => l.id === layerId);
    return layer ? isolatedLayerTypes.includes(layer.type) : false;
  }, [layers, isolatedLayerTypes]);

  /**
   * Obtener todas las capas de un tipo específico
   */
  const getLayersByType = useCallback((type: string) => {
    return layers.filter(layer => layer.type === type);
  }, [layers]);

  /**
   * Verificar si se puede añadir un clip a una capa específica
   * @param layerId ID de la capa
   * @param clips Array de clips existentes
   * @returns Verdadero si es posible añadir un clip a esta capa
   */
  const canAddClipToLayer = useCallback((layerId: number, clips: any[]) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return false;
    
    // No se pueden añadir clips a capas bloqueadas
    if (lockedLayers[layerId]) return false;
    
    // Verificar restricciones específicas por tipo de capa
    // Por ejemplo, algunas capas como audio podrían tener restricciones adicionales
    if (layer.type === LayerType.AUDIO) {
      // Verificar si ya hay clips en esta capa
      const layerClips = clips.filter(clip => clip.layer === layerId);
      // Máximo 1 clip para la capa de audio
      if (layerClips.length >= 1) return false;
    }
    
    return true;
  }, [layers, lockedLayers]);

  return {
    layers,
    visibleLayers,
    lockedLayers,
    selectedLayerId,
    addLayer,
    removeLayer,
    reorderLayers,
    toggleLayerVisibility,
    toggleLayerLock,
    selectLayer,
    updateLayer,
    resetLayers,
    isIsolatedLayer,
    getLayersByType,
    canAddClipToLayer
  };
}

// Exportar el hook principal
export { useTimelineLayers };

// NO volvemos a exportar los tipos porque ya están exportados arriba