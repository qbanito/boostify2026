import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useEditor } from '../../lib/context/editor-context';
import { 
  Track, 
  TrackType,
  Clip,
  AudioClip,
  TextClip
} from '../../lib/professional-editor-types';
import { cn } from '../../lib/utils';

import {
  Video,
  Music,
  Type,
  Image,
  Lock,
  LockOpen,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Trash2,
  Plus,
  Settings,
  ChevronDown,
  ChevronRight,
  Layers,
  GripVertical
} from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';

export interface TrackListPanelProps {
  className?: string;
  language?: 'es' | 'en';
  onAddTrack?: (trackType: TrackType) => void;
  onAddClip?: (trackId: string, clipType: 'video' | 'audio' | 'text') => void;
}

// Textos localizados
const localizedText = {
  tracks: {
    es: 'Pistas',
    en: 'Tracks'
  },
  addTrack: {
    es: 'Añadir pista',
    en: 'Add track'
  },
  videoTrack: {
    es: 'Pista de video',
    en: 'Video track'
  },
  audioTrack: {
    es: 'Pista de audio',
    en: 'Audio track'
  },
  textTrack: {
    es: 'Pista de texto',
    en: 'Text track'
  },
  overlayTrack: {
    es: 'Pista de superposición',
    en: 'Overlay track'
  },
  visibility: {
    es: 'Visibilidad',
    en: 'Visibility'
  },
  lock: {
    es: 'Bloquear',
    en: 'Lock'
  },
  unlock: {
    es: 'Desbloquear',
    en: 'Unlock'
  },
  mute: {
    es: 'Silenciar',
    en: 'Mute'
  },
  unmute: {
    es: 'Activar sonido',
    en: 'Unmute'
  },
  remove: {
    es: 'Eliminar',
    en: 'Remove'
  },
  duplicate: {
    es: 'Duplicar',
    en: 'Duplicate'
  },
  hide: {
    es: 'Ocultar',
    en: 'Hide'
  },
  show: {
    es: 'Mostrar',
    en: 'Show'
  },
  properties: {
    es: 'Propiedades',
    en: 'Properties'
  },
  volume: {
    es: 'Volumen',
    en: 'Volume'
  },
  opacity: {
    es: 'Opacidad',
    en: 'Opacity'
  },
  size: {
    es: 'Tamaño',
    en: 'Size'
  },
  position: {
    es: 'Posición',
    en: 'Position'
  },
  addClip: {
    es: 'Añadir clip',
    en: 'Add clip'
  },
  addVideo: {
    es: 'Añadir video',
    en: 'Add video'
  },
  addAudio: {
    es: 'Añadir audio',
    en: 'Add audio'
  },
  addText: {
    es: 'Añadir texto',
    en: 'Add text'
  },
  addImage: {
    es: 'Añadir imagen',
    en: 'Add image'
  },
  solo: {
    es: 'Solo',
    en: 'Solo'
  }
};

export function TrackListPanel({
  className,
  language = 'es',
  onAddTrack,
  onAddClip
}: TrackListPanelProps) {
  const { 
    state, 
    setSelectedTrack, 
    addTrack, 
    updateTrack, 
    removeTrack, 
    reorderTracks 
  } = useEditor();
  
  const [expandedTracks, setExpandedTracks] = useState<string[]>([]);
  
  // Obtener texto localizado
  const getText = (key: keyof typeof localizedText) => {
    return localizedText[key][language];
  };
  
  // Toggle expandir/colapsar una pista
  const toggleExpandTrack = (trackId: string) => {
    setExpandedTracks(prev => 
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };
  
  // Manejar selección de pista
  const handleSelectTrack = (trackId: string) => {
    setSelectedTrack(trackId);
  };
  
  // Manejar visibilidad de pista
  const handleVisibilityToggle = (trackId: string, isVisible: boolean) => {
    updateTrack(trackId, { visible: isVisible });
  };
  
  // Manejar bloqueo de pista
  const handleLockToggle = (trackId: string, isLocked: boolean) => {
    updateTrack(trackId, { locked: isLocked });
  };
  
  // Manejar silencio de pista
  const handleMuteToggle = (trackId: string, isMuted: boolean) => {
    updateTrack(trackId, { muted: isMuted });
  };
  
  // Manejar cambio de volumen
  const handleVolumeChange = (trackId: string, volume: number) => {
    updateTrack(trackId, { volume });
  };
  
  // Manejar modo solo
  const handleSoloToggle = (trackId: string, solo: boolean) => {
    // Si esta pista se pone en solo, todas las demás deberían silenciarse
    if (solo && state.project) {
      state.project.tracks.forEach(track => {
        if (track.id !== trackId) {
          updateTrack(track.id, { muted: true });
        }
      });
    }
    updateTrack(trackId, { solo, muted: false });
  };
  
  // Manejar eliminación de pista
  const handleRemoveTrack = (trackId: string) => {
    removeTrack(trackId);
  };
  
  // Manejar añadir pista
  const handleAddTrack = (type: TrackType) => {
    // Si hay un manejador personalizado, usarlo
    if (onAddTrack) {
      onAddTrack(type);
      return;
    }
    
    // Si no, usar el comportamiento por defecto
    const newTrack: Omit<Track, 'id'> = {
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${state.project?.tracks.length ?? 0 + 1}`,
      type,
      position: state.project?.tracks.length ?? 0,
      visible: true,
      locked: false,
      muted: false,
      solo: false,
      color: getTrackColor(type),
      createdAt: new Date()
    };
    
    addTrack(newTrack);
  };
  
  // Manejar añadir clip a una pista
  const handleAddClip = (trackId: string, clipType: 'video' | 'audio' | 'text') => {
    if (onAddClip) {
      onAddClip(trackId, clipType);
    }
  };
  
  // Manejar reordenamiento de pistas
  const handleDragEnd = (result: DropResult) => {
    // Si no hay destino válido, no hacemos nada
    if (!result.destination) return;
    
    // Si no hay proyecto, no hacemos nada
    if (!state.project) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    // Si el índice no cambió, no hacemos nada
    if (sourceIndex === destinationIndex) return;
    
    reorderTracks(sourceIndex, destinationIndex);
  };
  
  // Obtener color para el tipo de pista
  function getTrackColor(type: TrackType): string {
    switch (type) {
      case 'video':
        return '#4B91F7';
      case 'audio':
        return '#47B881';
      case 'text':
        return '#F7D154';
      case 'overlay':
        return '#D14343';
      default:
        return '#CCCCCC';
    }
  }
  
  // Obtener icono para el tipo de pista
  function getTrackIcon(type: TrackType) {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'text':
        return <Type className="h-4 w-4" />;
      case 'overlay':
        return <Image className="h-4 w-4" />;
      default:
        return <Layers className="h-4 w-4" />;
    }
  }
  
  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="text-sm font-medium">{getText('tracks')}</h3>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleAddTrack('video')}>
              <Video className="h-4 w-4 mr-2" />
              {getText('videoTrack')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTrack('audio')}>
              <Music className="h-4 w-4 mr-2" />
              {getText('audioTrack')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTrack('text')}>
              <Type className="h-4 w-4 mr-2" />
              {getText('textTrack')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTrack('overlay')}>
              <Image className="h-4 w-4 mr-2" />
              {getText('overlayTrack')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="track-list">
          {(provided) => (
            <div
              className="flex-1 overflow-y-auto"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {state.project && state.project.tracks.length > 0 ? (
                state.project.tracks.map((track, index) => (
                  <Draggable key={track.id} draggableId={track.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "mb-1 border-b",
                          snapshot.isDragging && "opacity-70",
                          state.selectedTrackId === track.id && "bg-accent",
                          !track.visible && "opacity-50"
                        )}
                      >
                        <div 
                          className="p-2 flex items-center"
                          onClick={() => handleSelectTrack(track.id)}
                        >
                          <div {...provided.dragHandleProps} className="mr-2 cursor-grab">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <div 
                            className="w-2 h-5 mr-2 rounded-sm" 
                            style={{ backgroundColor: track.color }}
                          />
                          
                          <button
                            className="mr-2 focus:outline-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandTrack(track.id);
                            }}
                          >
                            {expandedTracks.includes(track.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          
                          <div className="mr-2">
                            {getTrackIcon(track.type)}
                          </div>
                          
                          <div className="flex-1 truncate text-sm">{track.name}</div>
                          
                          <div className="flex items-center space-x-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleVisibilityToggle(track.id, !track.visible);
                                    }}
                                  >
                                    {track.visible ? (
                                      <Eye className="h-3 w-3" />
                                    ) : (
                                      <EyeOff className="h-3 w-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {track.visible ? getText('hide') : getText('show')}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLockToggle(track.id, !track.locked);
                                    }}
                                  >
                                    {track.locked ? (
                                      <Lock className="h-3 w-3" />
                                    ) : (
                                      <LockOpen className="h-3 w-3" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {track.locked ? getText('unlock') : getText('lock')}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {(track.type === 'video' || track.type === 'audio') && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMuteToggle(track.id, !track.muted);
                                      }}
                                    >
                                      {track.muted ? (
                                        <VolumeX className="h-3 w-3" />
                                      ) : (
                                        <Volume2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {track.muted ? getText('unmute') : getText('mute')}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <Settings className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleAddClip(track.id, 
                                  track.type === 'text' ? 'text' : 
                                  track.type === 'audio' ? 'audio' : 'video'
                                )}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  {getText('addClip')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {(track.type === 'video' || track.type === 'audio') && (
                                  <DropdownMenuItem
                                    onClick={() => handleSoloToggle(track.id, !track.solo)}
                                  >
                                    <Volume2 className="h-4 w-4 mr-2" />
                                    {getText('solo')}
                                    <div className="ml-auto">
                                      <Switch
                                        checked={track.solo}
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={(checked) => handleSoloToggle(track.id, checked)}
                                      />
                                    </div>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => handleRemoveTrack(track.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {getText('remove')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        
                        {expandedTracks.includes(track.id) && (
                          <div className="px-4 pb-2">
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="properties" className="border-none">
                                <AccordionTrigger className="py-1 text-xs hover:no-underline">
                                  {getText('properties')}
                                </AccordionTrigger>
                                <AccordionContent>
                                  {(track.type === 'video' || track.type === 'audio') && (
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-xs">{getText('volume')}</span>
                                          <span className="text-xs">{track.volume ?? 100}%</span>
                                        </div>
                                        <Slider
                                          defaultValue={[track.volume ?? 100]}
                                          max={100}
                                          step={1}
                                          onValueChange={([value]) => handleVolumeChange(track.id, value)}
                                        />
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Propiedades específicas para pistas de texto */}
                                  {track.type === 'text' && (
                                    <div className="space-y-4">
                                      {/* Aquí irían controles para pistas de texto */}
                                      <p className="text-xs text-muted-foreground">
                                        {language === 'es' ? 'Ajustes de texto' : 'Text settings'}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Propiedades específicas para pistas de overlay */}
                                  {track.type === 'overlay' && (
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex justify-between">
                                          <span className="text-xs">{getText('opacity')}</span>
                                          <span className="text-xs">100%</span>
                                        </div>
                                        <Slider
                                          defaultValue={[100]}
                                          max={100}
                                          step={1}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center text-muted-foreground">
                  <Layers className="h-8 w-8 mb-2" />
                  <p className="text-sm">
                    {language === 'es' ? 'No hay pistas disponibles' : 'No tracks available'}
                  </p>
                  <p className="text-xs mb-4">
                    {language === 'es' ? 'Añade una pista para comenzar' : 'Add a track to get started'}
                  </p>
                  <Button size="sm" onClick={() => handleAddTrack('video')}>
                    <Plus className="h-4 w-4 mr-1" />
                    {getText('addTrack')}
                  </Button>
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      <div className="p-3 border-t">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => handleAddTrack('video')}
        >
          <Plus className="h-4 w-4 mr-1" />
          {getText('addTrack')}
        </Button>
      </div>
    </div>
  );
}