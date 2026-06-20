import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '../ui/card';
import {
  Button
} from '../ui/button';
import {
  Input
} from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../ui/popover';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuGroup
} from '../ui/context-menu';
import {
  Eye,
  FileVideo,
  Image,
  Music,
  Type,
  Play,
  Pause,
  Plus,
  PlusCircle,
  Scissors,
  Copy,
  Trash,
  Move,
  ZoomIn,
  ZoomOut,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Save,
  Clock,
  Mic,
  Settings,
  Split,
  SplitSquareVertical,
  SplitSquareHorizontal,
  Crop,
  RotateCw,
  Sparkles,
  MessageSquarePlus,
  Keyboard,
  Maximize,
  Minimize,
  MoveHorizontal,
  Filter,
  Palette,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TimelineClip } from '../../lib/professional-editor-types';

interface ProfessionalTimelineProps {
  clips: TimelineClip[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  onAddClip?: (clip: Omit<TimelineClip, 'id'>) => void;
  onUpdateClip?: (id: string, updates: Partial<TimelineClip>) => void;
  onDeleteClip?: (id: string) => void;
  onPlay?: () => void;
  onPause?: () => void;
}

// Colores por tipo de clip
const clipTypeColors: Record<string, string> = {
  video: '#3b82f6', // blue-500
  image: '#10b981', // green-500
  audio: '#f59e0b', // amber-500
  text: '#8b5cf6',  // violet-500
  transition: '#ec4899' // pink-500
};

// Paleta de colores para clips de diferentes tipos al estilo Adobe Premiere
const premierePalette = [
  '#4ade80', // verde (clips de video)
  '#a78bfa', // morado (clips de texto)
  '#f97316', // naranja (audio principal)
  '#60a5fa', // azul claro (efectos)
  '#fbbf24', // amarillo (música)
  '#f43f5e', // rojo (transiciones)
  '#22d3ee', // cian (imagen fija)
];

// Mapeo de tipo de pista a nombre en Adobe Premiere
const trackTypeLabels: Record<string, string> = {
  'video': 'Video',
  'audio': 'Audio',
  'mix': 'Mix'
};

// Definir el componente con tipo de retorno explícito para asegurar que devuelve JSX.Element
function ProfessionalTimeline({
  clips = [],
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onAddClip,
  onUpdateClip,
  onDeleteClip,
  onPlay,
  onPause,
}: ProfessionalTimelineProps): JSX.Element {
  // Estado
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  const [visibleTracks, setVisibleTracks] = useState<Set<string>>(new Set(['0', '1', '2', '3', '4']));
  const [showAddClipDialog, setShowAddClipDialog] = useState<boolean>(false);
  const [isAddingClip, setIsAddingClip] = useState<boolean>(false);
  const [clipBeingEdited, setClipBeingEdited] = useState<TimelineClip | null>(null);
  const [clipDialogMode, setClipDialogMode] = useState<'add' | 'edit'>('add');
  const [timelineHeight, setTimelineHeight] = useState<number>(200);
  const [trackHeight, setTrackHeight] = useState<number>(40);
  
  // Referencias
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Form state for new/edited clip
  const [newClipData, setNewClipData] = useState<Partial<TimelineClip>>({
    name: '',
    type: 'video',
    startTime: currentTime,
    duration: 5,
    trackId: '0',
    selected: false,
    mediaUrl: ''
  });
  
  // Formatear tiempo en formato profesional (HH:MM:SS:FF)
  const formatTime = (timeInSeconds: number, frameRate: number = 24): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const frames = Math.floor((timeInSeconds % 1) * frameRate);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };
  
  // Convertir tiempo a posición en la línea de tiempo
  const timeToPosition = (time: number): number => {
    return (time / duration) * 100 * (zoomLevel / 100);
  };
  
  // Convertir posición a tiempo
  const positionToTime = (position: number): number => {
    return (position / (100 * (zoomLevel / 100))) * duration;
  };
  
  // Calcular ancho de un clip
  const calculateClipWidth = (startTime: number, clipDuration: number): number => {
    const startPos = timeToPosition(startTime);
    const endPos = timeToPosition(startTime + clipDuration);
    return endPos - startPos;
  };
  
  // Ajustar scroll automáticamente para mantener tiempo actual visible
  useEffect(() => {
    if (scrollContainerRef.current && timelineRef.current) {
      const container = scrollContainerRef.current;
      const timeline = timelineRef.current;
      
      // Calcular posición del tiempo actual
      const currentTimePosition = (currentTime / duration) * timeline.scrollWidth;
      
      // Si el tiempo actual está fuera del área visible, ajustar scroll
      if (currentTimePosition < container.scrollLeft || 
          currentTimePosition > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = currentTimePosition - (container.clientWidth / 2);
      }
    }
  }, [currentTime, duration]);
  
  // Obtener pistas visibles
  const getVisibleTracks = () => {
    // Obtener todas las pistas únicas de los clips
    const trackIds = new Set(clips.map(clip => clip.trackId));
    
    // Asegurar que siempre haya al menos 5 pistas (0-4)
    for (let i = 0; i < 5; i++) {
      trackIds.add(i.toString());
    }
    
    // Filtrar por pistas visibles
    return Array.from(trackIds)
      .filter(trackId => visibleTracks.has(trackId))
      .sort((a, b) => parseInt(a.toString()) - parseInt(b.toString()));
  };
  
  // Obtener altura total de la línea de tiempo
  const getTimelineHeight = () => {
    return getVisibleTracks().length * trackHeight;
  };
  
  // Manejar clic en la línea de tiempo
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !onSeek) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left + scrollContainerRef.current!.scrollLeft;
    const percentage = offsetX / (timelineRef.current.scrollWidth);
    
    onSeek(percentage * duration);
  };
  
  // Manejar selección de clips
  const handleClipClick = (e: React.MouseEvent<HTMLDivElement>, clipId: string) => {
    e.stopPropagation();
    
    // Modificar selección según teclas presionadas
    if (e.ctrlKey || e.metaKey) {
      // Toggle selección con Ctrl/Cmd
      const newSelection = new Set(selectedClipIds);
      if (newSelection.has(clipId)) {
        newSelection.delete(clipId);
      } else {
        newSelection.add(clipId);
      }
      setSelectedClipIds(newSelection);
    } else if (e.shiftKey && selectedClipIds.size > 0) {
      // Selección con Shift
      // Seleccionar todos los clips entre el último seleccionado y este
      const clipsArray = clips.map(c => c.id);
      const lastSelectedIndex = clipsArray.findIndex(id => 
        Array.from(selectedClipIds).includes(id));
      const currentIndex = clipsArray.indexOf(clipId);
      
      if (lastSelectedIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        
        const newSelection = new Set(selectedClipIds);
        for (let i = start; i <= end; i++) {
          newSelection.add(clipsArray[i]);
        }
        setSelectedClipIds(newSelection);
      }
    } else {
      // Click simple
      setSelectedClipIds(new Set([clipId]));
    }
    
    // Actualizar clips seleccionados
    if (onUpdateClip) {
      clips.forEach(clip => {
        const willBeSelected = e.ctrlKey || e.metaKey 
          ? (clip.id === clipId ? !clip.selected : clip.selected)
          : clip.id === clipId;
          
        if (clip.selected !== willBeSelected) {
          onUpdateClip(clip.id, { selected: willBeSelected });
        }
      });
    }
  };
  
  // Agregar un nuevo clip
  const handleAddClip = () => {
    if (!onAddClip) return;
    
    const newClip: Omit<TimelineClip, 'id'> = {
      name: newClipData.name || `Nuevo ${newClipData.type}`,
      type: newClipData.type || 'video',
      startTime: newClipData.startTime || currentTime,
      duration: newClipData.duration || 5,
      trackId: newClipData.trackId || '0',
      selected: false,
      mediaUrl: newClipData.mediaUrl || ''
    };
    
    onAddClip(newClip);
    setShowAddClipDialog(false);
    resetNewClipForm();
  };
  
  // Editar un clip existente
  const handleEditClip = () => {
    if (!onUpdateClip || !clipBeingEdited) return;
    
    const updates: Partial<TimelineClip> = {
      name: newClipData.name,
      type: newClipData.type,
      startTime: newClipData.startTime,
      duration: newClipData.duration,
      trackId: newClipData.trackId,
      mediaUrl: newClipData.mediaUrl
    };
    
    onUpdateClip(clipBeingEdited.id, updates);
    setShowAddClipDialog(false);
    setClipBeingEdited(null);
  };
  
  // Eliminar clips seleccionados
  const handleDeleteSelectedClips = () => {
    if (!onDeleteClip || selectedClipIds.size === 0) return;
    
    // Eliminar cada clip seleccionado
    selectedClipIds.forEach(clipId => {
      onDeleteClip(clipId);
    });
    
    // Limpiar selección
    setSelectedClipIds(new Set());
  };
  
  // Resetear formulario de nuevo clip
  const resetNewClipForm = () => {
    setNewClipData({
      name: '',
      type: 'video',
      startTime: currentTime,
      duration: 5,
      trackId: '0',
      selected: false,
      mediaUrl: ''
    });
  };
  
  // Preparar edición de clip
  const prepareEditClip = (clip: TimelineClip) => {
    setClipBeingEdited(clip);
    setNewClipData({
      name: clip.name,
      type: clip.type,
      startTime: clip.startTime,
      duration: clip.duration,
      trackId: clip.trackId,
      selected: clip.selected,
      mediaUrl: clip.mediaUrl || ''
    });
    setClipDialogMode('edit');
    setShowAddClipDialog(true);
  };
  
  // Preparar añadir nuevo clip
  const prepareAddClip = () => {
    resetNewClipForm();
    setClipDialogMode('add');
    setShowAddClipDialog(true);
  };
  
  // Obtener el número total de pistas
  const getTotalTracks = () => {
    const maxTrackId = clips.reduce((max, clip) => 
      Math.max(max, parseInt(clip.trackId)), 0);
    return Math.max(5, maxTrackId + 1); // Al menos 5 pistas
  };
  
  // Renderizar marcadores de tiempo al estilo Adobe Premiere
  const renderTimeMarkers = () => {
    // Calcular número de marcadores según zoom
    const markersCount = Math.ceil(15 * (zoomLevel / 100));
    const markers = [];
    
    // Crear marcadores principales (con texto)
    for (let i = 0; i <= markersCount; i++) {
      const percent = (i / markersCount) * 100;
      const time = (percent / 100) * duration;
      
      // Crear marcador principal
      markers.push(
        <div 
          key={`marker-${i}`} 
          className="absolute top-0 h-full border-l border-gray-500 dark:border-gray-700" 
          style={{ left: `${percent}%` }}
        >
          <span className="absolute top-0 left-1 text-[10px] text-gray-300 bg-zinc-950 px-1 font-mono">
            {formatTime(time)}
          </span>
        </div>
      );
      
      // Crear submarcadores (sin texto) entre marcadores principales
      if (i < markersCount) {
        // Añadir 3 submarcadores entre cada marcador principal
        for (let j = 1; j <= 3; j++) {
          const subPercent = percent + (j * ((1 / markersCount) * 100) / 4);
          
          markers.push(
            <div 
              key={`submarker-${i}-${j}`} 
              className={`absolute top-5 h-2 border-l ${j === 2 ? 'border-gray-400' : 'border-gray-600'} dark:border-gray-800`}
              style={{ left: `${subPercent}%` }}
            />
          );
        }
      }
    }
    
    return markers;
  };
  
  // Renderizar pistas de la línea de tiempo al estilo Adobe Premiere
  const renderTracks = () => {
    const visibleTrackIds = getVisibleTracks();
    
    return visibleTrackIds.map(trackId => {
      // Determinar tipo de pista (video, audio, etc.) basado en ID
      // Asumimos: 0-1 son video, 2-3 son audio, 4 es mix
      const trackTypeIdx = parseInt(trackId);
      const trackType = trackTypeIdx < 2 ? 'video' : trackTypeIdx < 4 ? 'audio' : 'mix';
      const trackName = trackTypeLabels[trackType] || 'Pista';
      const trackColor = trackType === 'video' ? 'bg-purple-800' : 
                         trackType === 'audio' ? 'bg-blue-800' : 'bg-amber-800';
      
      return (
        <div 
          key={`track-${trackId}`} 
          className="relative border-b border-zinc-800"
          style={{ height: `${trackHeight}px` }}
        >
          <div className={`absolute inset-y-0 left-0 w-32 flex-shrink-0 bg-zinc-900 flex items-center justify-between px-2 border-r border-zinc-700`}>
            <div className="flex items-center">
              <span className={`h-3 w-3 rounded-sm ${trackColor} mr-2`}></span>
              <span className="text-xs text-gray-300 font-medium">{trackName} {parseInt(trackId) + 1}</span>
            </div>
            <div className="flex space-x-1">
              <button className="text-gray-400 hover:text-white">
                <Volume2 className="h-3 w-3" />
              </button>
              <button className="text-gray-400 hover:text-white">
                <Eye className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <div className="ml-32 h-full relative">
          {/* Clips en esta pista */}
          {clips
            .filter(clip => clip.trackId === trackId)
            .map(clip => (
              <ContextMenu key={clip.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      "absolute top-1 h-[calc(100%-8px)] rounded-md border-2 cursor-pointer flex flex-col items-start overflow-hidden",
                      clip.selected && "ring-2 ring-white dark:ring-gray-950 ring-opacity-50",
                      "group"
                    )}
                    style={{
                      left: `${timeToPosition(clip.startTime)}%`,
                      width: `${calculateClipWidth(clip.startTime, clip.duration)}%`,
                      backgroundColor: clip.color || clipTypeColors[clip.type] || '#6b7280',
                      borderColor: clip.color || clipTypeColors[clip.type] || '#6b7280'
                    }}
                    onClick={(e) => handleClipClick(e, clip.id)}
                  >
                    <div className="w-full px-1 text-xs text-white font-medium truncate bg-black bg-opacity-30">
                      {clip.name}
                    </div>
                    
                    <div className="flex items-center space-x-1 absolute bottom-0 right-0 p-0.5 bg-black bg-opacity-30 rounded-tl-sm">
                      {clip.type === 'video' && <FileVideo className="h-2.5 w-2.5 text-white" />}
                      {clip.type === 'image' && <Image className="h-2.5 w-2.5 text-white" />}
                      {clip.type === 'audio' && <Music className="h-2.5 w-2.5 text-white" />}
                      {clip.type === 'text' && <Type className="h-2.5 w-2.5 text-white" />}
                    </div>
                    
                    {/* Overlay para mostrar al hacer hover */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex space-x-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-6 w-6 p-0 bg-white text-black"
                          onClick={(e) => {
                            e.stopPropagation();
                            prepareEditClip(clip);
                          }}
                        >
                          <Scissors className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>
                
                <ContextMenuContent className="w-56">
                  <ContextMenuItem onClick={() => prepareEditClip(clip)}>
                    <Move className="h-4 w-4 mr-2" /> Editar
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => {
                    if (onUpdateClip) onUpdateClip(clip.id, { selected: true });
                    setSelectedClipIds(new Set([clip.id]));
                  }}>
                    <Maximize className="h-4 w-4 mr-2" /> Seleccionar
                  </ContextMenuItem>
                  
                  <ContextMenuSeparator />
                  
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <Scissors className="h-4 w-4 mr-2" /> Recortar
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      <ContextMenuItem onClick={() => prepareEditClip(clip)}>
                        <SplitSquareVertical className="h-4 w-4 mr-2" /> Dividir en punto actual
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => prepareEditClip(clip)}>
                        <Crop className="h-4 w-4 mr-2" /> Recortar inicio
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => prepareEditClip(clip)}>
                        <Crop className="h-4 w-4 mr-2" /> Recortar final
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <Filter className="h-4 w-4 mr-2" /> Efectos
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      <ContextMenuItem>
                        <Sparkles className="h-4 w-4 mr-2" /> Añadir filtro
                      </ContextMenuItem>
                      <ContextMenuItem>
                        <Palette className="h-4 w-4 mr-2" /> Ajustar color
                      </ContextMenuItem>
                      <ContextMenuItem>
                        <RotateCw className="h-4 w-4 mr-2" /> Rotar/Ajustar
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>
                      <Volume2 className="h-4 w-4 mr-2" /> Audio
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-48">
                      <ContextMenuItem>
                        <Volume2 className="h-4 w-4 mr-2" /> Ajustar volumen
                      </ContextMenuItem>
                      <ContextMenuItem>
                        <VolumeX className="h-4 w-4 mr-2" /> Silenciar
                      </ContextMenuItem>
                      <ContextMenuItem>
                        <MessageSquarePlus className="h-4 w-4 mr-2" /> Añadir narración
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  
                  <ContextMenuSeparator />
                  
                  <ContextMenuItem onClick={() => {
                    if (onSeek) onSeek(clip.startTime);
                  }}>
                    <Play className="h-4 w-4 mr-2" /> Reproducir desde aquí
                  </ContextMenuItem>
                  
                  <ContextMenuItem>
                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                  </ContextMenuItem>
                  
                  <ContextMenuSeparator />
                  
                  <ContextMenuItem onClick={() => {
                    if (onDeleteClip) onDeleteClip(clip.id);
                  }} className="text-red-500">
                    <Trash className="h-4 w-4 mr-2" /> Eliminar
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
        </div>
      </div>
      );
    });
  }; // Cierre de la función renderTracks
  
  return (
    <Card className="w-full bg-black border-0 rounded-xl overflow-hidden shadow-xl">
      <CardHeader className="pb-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center text-white">
            <Layers className="h-5 w-5 mr-2 text-orange-400" />
            Línea de tiempo
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 px-2 py-1 border rounded-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
                disabled={zoomLevel <= 25}
                className="h-7 w-7 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              
              <span className="text-xs w-14 text-center">
                Zoom: {zoomLevel}%
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomLevel(Math.min(400, zoomLevel + 25))}
                disabled={zoomLevel >= 400}
                className="h-7 w-7 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prepareAddClip}
                    className="h-8"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Añadir clip
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Añadir un nuevo clip a la línea de tiempo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedClipIds.size > 0 && onDeleteClip) {
                        handleDeleteSelectedClips();
                      }
                    }}
                    disabled={selectedClipIds.size === 0}
                    className="h-8"
                  >
                    <Scissors className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cortar selección</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <Filter className="h-4 w-4 mr-1" /> Efectos
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="grid gap-2">
                  <h4 className="font-medium text-sm">Aplicar efecto</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Sparkles className="h-4 w-4 mr-2" /> Añadir filtro
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Palette className="h-4 w-4 mr-2" /> Ajustar color
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <RotateCw className="h-4 w-4 mr-2" /> Transformar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <SplitSquareVertical className="h-4 w-4 mr-1" /> Transiciones
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="grid gap-2">
                  <h4 className="font-medium text-sm">Añadir transición</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Split className="h-4 w-4 mr-2" /> Fundido
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <MoveHorizontal className="h-4 w-4 mr-2" /> Deslizar
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <Minimize className="h-4 w-4 mr-2" /> Zoom
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="grid gap-2">
                  <h4 className="font-medium text-sm">Opciones</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTrackHeight(Math.max(20, trackHeight - 10))}
                    disabled={trackHeight <= 20}
                    className="justify-start"
                  >
                    <ChevronUp className="h-4 w-4 mr-2" /> Reducir altura de pistas
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTrackHeight(Math.min(80, trackHeight + 10))}
                    disabled={trackHeight >= 80}
                    className="justify-start"
                  >
                    <ChevronDown className="h-4 w-4 mr-2" /> Aumentar altura de pistas
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedClipIds.size > 0 && onDeleteClip) {
                        handleDeleteSelectedClips();
                      }
                    }}
                    disabled={selectedClipIds.size === 0}
                    className="justify-start text-red-500"
                  >
                    <Trash className="h-4 w-4 mr-2" /> Eliminar seleccionados
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 overflow-hidden bg-zinc-950">
        <div className="relative min-h-[200px]" ref={containerRef}>
          {/* Línea de tiempo scrollable */}
          <div
            ref={scrollContainerRef}
            className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-950"
            style={{ height: `${getTimelineHeight() + 30}px` }}
          >
            <div 
              ref={timelineRef}
              className="relative"
              style={{ 
                width: `${100 * (zoomLevel / 100)}%`,
                height: `${getTimelineHeight()}px`
              }}
              onClick={handleTimelineClick}
            >
              {/* Fondo de pistas */}
              <div className="absolute inset-0">
                {renderTracks()}
              </div>
              
              {/* Marcadores de tiempo */}
              <div className="absolute inset-0 pointer-events-none">
                {renderTimeMarkers()}
              </div>
              
              {/* Marcador de tiempo actual - Estilo CapCut móvil */}
              <div 
                className="absolute top-0 h-full w-1 bg-orange-500 z-10 pointer-events-none shadow-[0_0_8px_rgba(249,115,22,0.7)]"
                style={{ left: `${timeToPosition(currentTime)}%` }}
              >
                <div className="w-4 h-4 bg-orange-500 rounded-full -ml-1.5 -mt-1.5 shadow-md"></div>
              </div>
            </div>
          </div>
          
          {/* Controles de reproducción - Estilo CapCut */}
          <div className="flex items-center justify-center space-x-3 py-3 border-t border-zinc-800 bg-zinc-900">
            {isPlaying ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPause}
                className="h-9 w-9 p-0 rounded-full bg-zinc-800 hover:bg-zinc-700"
              >
                <Pause className="h-4 w-4 text-white" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPlay}
                className="h-9 w-9 p-0 rounded-full bg-orange-600 hover:bg-orange-700"
              >
                <Play className="h-4 w-4 text-white" />
              </Button>
            )}
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-white font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Dialog para añadir/editar clips */}
      <Dialog open={showAddClipDialog} onOpenChange={setShowAddClipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {clipDialogMode === 'add' ? 'Añadir nuevo clip' : 'Editar clip'}
            </DialogTitle>
            <DialogDescription>
              Configura los parámetros del clip y haz clic en guardar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="clip-name" className="text-sm font-medium">
                  Título
                </label>
                <Input
                  id="clip-name"
                  value={newClipData.name || ''}
                  onChange={(e) => setNewClipData({ ...newClipData, name: e.target.value })}
                  placeholder="Título del clip"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="clip-type" className="text-sm font-medium">
                  Tipo
                </label>
                <Select
                  value={newClipData.type}
                  onValueChange={(value: 'video' | 'image' | 'audio' | 'text') => 
                    setNewClipData({ ...newClipData, type: value })
                  }
                >
                  <SelectTrigger id="clip-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="image">Imagen</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="text">Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label htmlFor="clip-startTime" className="text-sm font-medium">
                  Inicio (s)
                </label>
                <Input
                  id="clip-startTime"
                  type="number"
                  value={newClipData.startTime}
                  onChange={(e) => setNewClipData({ 
                    ...newClipData, 
                    startTime: parseFloat(e.target.value) 
                  })}
                  min={0}
                  max={duration}
                  step={0.1}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="clip-duration" className="text-sm font-medium">
                  Duración (s)
                </label>
                <Input
                  id="clip-duration"
                  type="number"
                  value={newClipData.duration}
                  onChange={(e) => setNewClipData({ 
                    ...newClipData, 
                    duration: parseFloat(e.target.value) 
                  })}
                  min={0.1}
                  step={0.1}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="clip-track" className="text-sm font-medium">
                  Pista
                </label>
                <Select
                  value={newClipData.trackId?.toString()}
                  onValueChange={(value) => 
                    setNewClipData({ ...newClipData, trackId: value })
                  }
                >
                  <SelectTrigger id="clip-track">
                    <SelectValue placeholder="Seleccionar pista" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: getTotalTracks() }).map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        Pista {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="clip-mediaUrl" className="text-sm font-medium">
                URL
              </label>
              <Input
                id="clip-mediaUrl"
                value={newClipData.mediaUrl || ''}
                onChange={(e) => setNewClipData({ ...newClipData, mediaUrl: e.target.value })}
                placeholder={`URL del ${newClipData.type}`}
              />
              <p className="text-xs text-gray-500">
                {newClipData.type === 'video' && 'Introduce la URL del video (mp4, webm, etc.)'}
                {newClipData.type === 'image' && 'Introduce la URL de la imagen (jpg, png, etc.)'}
                {newClipData.type === 'audio' && 'Introduce la URL del audio (mp3, wav, etc.)'}
                {newClipData.type === 'text' && 'Introduce el texto a mostrar'}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddClipDialog(false);
              setClipBeingEdited(null);
            }}>
              Cancelar
            </Button>
            
            <Button 
              onClick={clipDialogMode === 'add' ? handleAddClip : handleEditClip}
              disabled={!newClipData.name || !newClipData.type}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {clipDialogMode === 'add' ? 'Añadir' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Barra de acciones estilo CapCut móvil */}
      <div className="px-2 py-3 bg-zinc-950 border-t border-zinc-800 flex justify-between items-center">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-9 rounded-full bg-zinc-800 text-white px-4 flex items-center gap-2"
          onClick={() => prepareAddClip()}
        >
          <PlusCircle className="h-4 w-4 text-orange-400" />
          <span className="text-xs">Añadir pista</span>
        </Button>
        
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 rounded-full bg-zinc-800 text-white px-4 flex items-center gap-2"
          >
            <Mic className="h-4 w-4 text-orange-400" />
            <span className="text-xs hidden md:inline">Grabar</span>
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 rounded-full bg-zinc-800 text-white flex items-center justify-center"
          >
            <Settings className="h-4 w-4 text-gray-300" />
          </Button>
        </div>
      </div>
      
      {/* Footer con info de timeline */}
      <CardFooter className="pt-2 text-xs text-gray-400 bg-zinc-950 border-t border-zinc-800">
        <div className="flex justify-between w-full">
          <div className="flex items-center space-x-2">
            <div className="bg-zinc-800 px-2 py-1 rounded-md flex items-center">
              <FileVideo className="h-3 w-3 mr-1.5 text-orange-400" />
              <span>Clips: {clips.length}</span>
            </div>
            {selectedClipIds.size > 0 && (
              <div className="bg-zinc-800 px-2 py-1 rounded-md">
                Seleccionados: {selectedClipIds.size}
              </div>
            )}
          </div>
          <div className="bg-zinc-800 px-2 py-1 rounded-md flex items-center">
            <Clock className="h-3 w-3 mr-1.5 text-orange-400" />
            <span>Duración: {formatTime(duration)}</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
} // Fin del componente ProfessionalTimeline

export default ProfessionalTimeline;