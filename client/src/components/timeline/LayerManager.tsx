/**
 * Componente para gestionar las capas de la línea de tiempo
 * 
 * Este componente permite agregar, eliminar, ocultar, bloquear y seleccionar capas.
 * También muestra los clips asociados a cada capa.
 */

import React, { useCallback } from 'react';
import { cn } from '../../lib/utils';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Music,
  Video,
  Image,
  Type,
  Sparkles,
  CirclePlus,
  Menu,
  Star,
  Wand2,
  ImageIcon,
  Layers,
  PanelTop,
  FlaskConical
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { LayerType } from '../../interfaces/timeline';
import { TimelineClip } from './TimelineClip';

/**
 * Propiedades de la capa
 */
export interface Layer {
  id: number;
  name: string;
  type: string;
  locked: boolean;
  visible: boolean;
  height: number;
  color: string;
}

/**
 * Propiedades del componente LayerManager
 */
export interface LayerManagerProps {
  layers: Layer[];
  clips: any[];
  visibleLayers: Record<number, boolean>;
  lockedLayers: Record<number, boolean>;
  selectedLayerId: number | null;
  onAddLayer: (type: string) => void;
  onRemoveLayer: (id: number) => void;
  onToggleLayerVisibility: (id: number) => void;
  onToggleLayerLock: (id: number) => void;
  onSelectLayer: (id: number) => void;
  onUpdateLayer?: (id: number, updates: Partial<Layer>) => void;
  onOrderChange?: (newOrder: number[]) => void;
}

/**
 * Componente que muestra un tipo de capa con un ícono según su tipo
 */
const LayerTypeIcon: React.FC<{ type: string; className?: string }> = ({ type, className }) => {
  switch (type) {
    case LayerType.AUDIO:
      return <Music className={className} />;
    case LayerType.VIDEO:
      return <Video className={className} />;
    case LayerType.IMAGE:
      return <ImageIcon className={className} />;
    case LayerType.TEXT:
      return <Type className={className} />;
    case LayerType.EFFECT:
      return <Wand2 className={className} />;
    case LayerType.TRANSITION:
      return <PanelTop className={className} />;
    case LayerType.AI_PLACEHOLDER:
      return <Star className={className} />;
    case LayerType.VIDEO_IMAGE:
      return <Layers className={className} />;
    case LayerType.EFFECTS:
      return <FlaskConical className={className} />;
    default:
      return <Menu className={className} />;
  }
};

/**
 * Componente principal de administración de capas
 */
const LayerManager: React.FC<LayerManagerProps> = ({
  layers,
  clips,
  visibleLayers,
  lockedLayers,
  selectedLayerId,
  onAddLayer,
  onRemoveLayer,
  onToggleLayerVisibility,
  onToggleLayerLock,
  onSelectLayer,
  onUpdateLayer,
  onOrderChange
}) => {
  /**
   * Manejar click en una capa para seleccionarla
   */
  const handleLayerClick = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectLayer(id);
  }, [onSelectLayer]);
  
  /**
   * Manejar arrastre de las capas para cambiar su orden
   */
  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', String(id));
  }, []);
  
  /**
   * Permitir soltar elementos durante el arrastre
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  /**
   * Manejar el soltar una capa para reordenar
   */
  const handleDrop = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    
    // Si no hay función de reordenamiento, no hacer nada
    if (!onOrderChange) return;
    
    // Obtener ID de la capa arrastrada
    const draggedId = Number(e.dataTransfer.getData('text/plain'));
    
    // No permitir arrastrar si la capa está bloqueada
    if (lockedLayers[draggedId]) return;
    
    // Obtener índices de las capas
    const draggedIndex = layers.findIndex(layer => layer.id === draggedId);
    const targetIndex = layers.findIndex(layer => layer.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Crear nuevo orden
    const newOrder = [...layers];
    const [movedLayer] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, movedLayer);
    
    // Actualizar orden
    onOrderChange(newOrder.map(layer => layer.id));
  }, [layers, lockedLayers, onOrderChange]);
  
  /**
   * Mover capa hacia arriba (decrementar su índice)
   */
  const moveLayerUp = useCallback((id: number) => {
    if (!onOrderChange) return;
    
    const index = layers.findIndex(layer => layer.id === id);
    
    // No mover si es la primera capa
    if (index <= 0) return;
    
    // No permitir mover si la capa está bloqueada
    if (lockedLayers[id]) return;
    
    const newOrder = [...layers];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    
    onOrderChange(newOrder.map(layer => layer.id));
  }, [layers, lockedLayers, onOrderChange]);
  
  /**
   * Mover capa hacia abajo (incrementar su índice)
   */
  const moveLayerDown = useCallback((id: number) => {
    if (!onOrderChange) return;
    
    const index = layers.findIndex(layer => layer.id === id);
    
    // No mover si es la última capa
    if (index >= layers.length - 1) return;
    
    // No permitir mover si la capa está bloqueada
    if (lockedLayers[id]) return;
    
    const newOrder = [...layers];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    
    onOrderChange(newOrder.map(layer => layer.id));
  }, [layers, lockedLayers, onOrderChange]);
  
  /**
   * Agregar una nueva capa según el tipo
   */
  const handleAddLayer = useCallback((type: string) => {
    onAddLayer(type);
  }, [onAddLayer]);
  
  /**
   * Eliminar una capa
   */
  const handleRemoveLayer = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onRemoveLayer(id);
  }, [onRemoveLayer]);
  
  /**
   * Alternar visibilidad de una capa
   */
  const handleToggleVisibility = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onToggleLayerVisibility(id);
  }, [onToggleLayerVisibility]);
  
  /**
   * Alternar bloqueo de una capa
   */
  const handleToggleLock = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onToggleLayerLock(id);
  }, [onToggleLayerLock]);
  
  return (
    <div className="layer-manager bg-background border-border overflow-y-auto" style={{ minWidth: "280px" }}>
      {/* Encabezado */}
      <div className="bg-muted/40 px-4 py-3 border-b border-border">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-foreground">Capas</h3>
          
          {/* Menú para agregar capas */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 px-2">
                <Plus size={16} className="mr-1" />
                <span>Añadir Capa</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="grid gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddLayer(LayerType.AUDIO)}
                >
                  <Music size={14} className="mr-2" />
                  <span>Audio</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddLayer(LayerType.VIDEO)}
                >
                  <Video size={14} className="mr-2" />
                  <span>Video</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddLayer(LayerType.IMAGE)}
                >
                  <Image size={14} className="mr-2" />
                  <span>Imágenes</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddLayer(LayerType.TEXT)}
                >
                  <Type size={14} className="mr-2" />
                  <span>Texto</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddLayer(LayerType.EFFECT)}
                >
                  <Sparkles size={14} className="mr-2" />
                  <span>Efectos</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleAddLayer(LayerType.AI_PLACEHOLDER)}
                >
                  <Star size={14} className="mr-2" />
                  <span>IA Generativa</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Lista de capas */}
      <div className="layers-list">
        {layers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          const isVisible = visibleLayers[layer.id];
          const isLocked = lockedLayers[layer.id];
          
          // Filtrar clips de esta capa
          const layerClips = clips.filter(clip => clip.layer === layer.id);
          
          return (
            <div 
              key={layer.id}
              className={cn(
                "layer-item border-b border-border py-2 px-4 hover:bg-muted/40 transition-colors",
                isSelected ? "bg-primary/10" : "",
                isVisible ? "" : "opacity-60"
              )}
              onClick={(e) => handleLayerClick(e, layer.id)}
              draggable={!isLocked && onOrderChange !== undefined}
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, layer.id)}
            >
              {/* Información de la capa */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <div 
                    className="layer-color w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: layer.color }}
                  />
                  <div className="flex items-center">
                    <LayerTypeIcon type={layer.type} className="w-4 h-4 mr-1 text-foreground/70" />
                    <span className="text-sm font-medium text-foreground">{layer.name}</span>
                  </div>
                </div>
                
                {/* Acciones para la capa */}
                <div className="flex space-x-1">
                  {/* Botón de visibilidad */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={(e) => handleToggleVisibility(e, layer.id)}
                        >
                          {isVisible ? (
                            <Eye size={14} className="text-foreground/70" />
                          ) : (
                            <EyeOff size={14} className="text-foreground/70" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isVisible ? "Ocultar capa" : "Mostrar capa"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Botón de bloqueo */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={(e) => handleToggleLock(e, layer.id)}
                        >
                          {isLocked ? (
                            <Lock size={14} className="text-foreground/70" />
                          ) : (
                            <Unlock size={14} className="text-foreground/70" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isLocked ? "Desbloquear capa" : "Bloquear capa"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  
                  {/* Menú de acciones */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        disabled={isLocked}
                      >
                        <Menu size={14} className="text-foreground/70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      {/* Opción para mover la capa hacia arriba */}
                      {onOrderChange && (
                        <DropdownMenuItem 
                          onClick={() => moveLayerUp(layer.id)}
                          disabled={
                            isLocked || 
                            layers.findIndex(l => l.id === layer.id) === 0
                          }
                        >
                          <ChevronUp size={14} className="mr-2" />
                          <span>Mover arriba</span>
                        </DropdownMenuItem>
                      )}
                      
                      {/* Opción para mover la capa hacia abajo */}
                      {onOrderChange && (
                        <DropdownMenuItem 
                          onClick={() => moveLayerDown(layer.id)}
                          disabled={
                            isLocked || 
                            layers.findIndex(l => l.id === layer.id) === layers.length - 1
                          }
                        >
                          <ChevronDown size={14} className="mr-2" />
                          <span>Mover abajo</span>
                        </DropdownMenuItem>
                      )}
                      
                      {/* Opción para eliminar la capa */}
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={(e) => handleRemoveLayer(e, layer.id)}
                        disabled={isLocked}
                      >
                        <Trash2 size={14} className="mr-2" />
                        <span>Eliminar</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Previsualización de clips en esta capa */}
              {layerClips.length > 0 && (
                <div className="layer-clips-preview mt-1 pl-6">
                  <div className="text-xs text-foreground/60 mb-1">
                    {layerClips.length} {layerClips.length === 1 ? 'clip' : 'clips'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {layerClips.slice(0, 3).map((clip) => (
                      <div 
                        key={clip.id}
                        className="clip-preview px-2 py-1 text-[10px] rounded truncate"
                        style={{ 
                          backgroundColor: layer.color,
                          opacity: 0.8,
                          maxWidth: '80px'
                        }}
                      >
                        {clip.title}
                      </div>
                    ))}
                    {layerClips.length > 3 && (
                      <div className="text-xs text-foreground/60 self-end">
                        +{layerClips.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LayerManager;