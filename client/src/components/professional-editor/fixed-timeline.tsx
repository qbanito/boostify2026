import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../ui/dropdown-menu';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { cn } from '../../lib/utils';

import { 
  PlayCircle, 
  PauseCircle, 
  Plus, 
  Layers, 
  Scissors, 
  Copy, 
  Trash, 
  Type, 
  Volume2, 
  Image, 
  Film, 
  CheckSquare, 
  ChevronsUpDown,
  MoveHorizontal,
  ZoomIn,
  ZoomOut,
  Eye,
  Wand2,
  Clock
} from 'lucide-react';

// Define el esquema de validación para el formulario de clip
const clipFormSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  start: z.number().min(0, "El tiempo de inicio debe ser positivo"),
  duration: z.number().min(0.1, "La duración debe ser mayor a 0.1"),
  url: z.string().url("Debe ser una URL válida").or(z.string().min(1, "La URL es obligatoria")),
  trackId: z.string().min(1, "Seleccione una pista"),
  type: z.enum(["video", "audio", "image", "text"], {
    required_error: "Seleccione un tipo de clip",
  }),
  color: z.string().optional(),
});

// Interfaces
interface Clip {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'image' | 'text';
  start: number;
  duration: number;
  url: string;
  trackId: string;
  color?: string;
  selected?: boolean;
}

interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'mix';
  color?: string;
}

interface ProfessionalTimelineProps {
  clips: Clip[];
  tracks: Track[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onAddClip?: (clip: Omit<Clip, 'id'>) => void;
  onUpdateClip?: (id: string, updates: Partial<Clip>) => void;
  onDeleteClip?: (id: string) => void;
  onSeek?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  zoomOptions?: number[];
}

// Etiquetas para tipos de pistas
const trackTypeLabels: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  mix: 'Mix'
};

// Utilidad para formatear tiempo en formato MM:SS.MS
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${ms}`;
};

const ProfessionalTimeline: React.FC<ProfessionalTimelineProps> = ({
  clips,
  onAddClip,
  onUpdateClip,
  onDeleteClip,
  currentTime,
  duration,
  onSeek,
  isPlaying,
  onPlay,
  onPause,
  tracks = [],
  zoomOptions = [25, 50, 75, 100, 150, 200, 300]
}) => {
  // Referencia para el elemento timeline
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  
  // Estado para el zoom
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  
  // Estado para clips seleccionados
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
  
  // Estado para el formulario de nuevo clip
  const [showAddClipDialog, setShowAddClipDialog] = useState<boolean>(false);
  const [clipDialogMode, setClipDialogMode] = useState<'add' | 'edit'>('add');
  const [clipBeingEdited, setClipBeingEdited] = useState<Clip | null>(null);
  
  // Colores por tipo de clip
  const clipTypeColors: Record<string, string> = {
    video: '#8B5CF6', // Púrpura para videos
    audio: '#3B82F6', // Azul para audio
    image: '#10B981', // Verde para imágenes
    text: '#F59E0B',  // Ámbar para texto
  };
  
  // Altura de cada pista
  const [trackHeight, setTrackHeight] = useState<number>(64);
  
  // Estado para manejar drag & drop
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  
  // Formulario para nuevo clip
  const form = useForm<z.infer<typeof clipFormSchema>>({
    resolver: zodResolver(clipFormSchema),
    defaultValues: {
      title: '',
      start: 0,
      duration: 5,
      url: '',
      trackId: '',
      type: 'video',
      color: ''
    }
  });
  
  // Efecto para sincronizar el playhead con currentTime
  useEffect(() => {
    const updatePlayhead = () => {
      if (playheadRef.current && timelineRef.current) {
        const percent = (currentTime / duration) * 100;
        playheadRef.current.style.left = `${percent}%`;
      }
    };
    
    updatePlayhead();
    
    // Crear un intervalo para actualizar regularmente el playhead durante la reproducción
    const interval = isPlaying ? setInterval(updatePlayhead, 33) : null;
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTime, duration, isPlaying]);
  
  // Función para convertir tiempo a posición en la línea de tiempo
  const timeToPosition = (time: number) => {
    return (time / duration) * 100;
  };
  
  // Función para calcular el ancho de un clip basado en su duración
  const calculateClipWidth = (startTime: number, clipDuration: number) => {
    return (clipDuration / duration) * 100;
  };
  
  // Manejo de clic en la línea de tiempo para buscar/posicionar
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickPercent = clickX / rect.width;
      
      // El tiempo al que debemos buscar basado en el clic
      const seekTime = clickPercent * duration;
      if (onSeek) onSeek(seekTime);
    }
  };
  
  // Manejo de clic en clips
  const handleClipClick = (e: React.MouseEvent, clipId: string) => {
    e.stopPropagation();
    
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isSelected = selectedClipIds.has(clipId);
      
      // Si se mantiene Ctrl/Cmd, hacer toggle de la selección
      if (isCtrl) {
        const newSelection = new Set(selectedClipIds);
        if (isSelected) {
          newSelection.delete(clipId);
        } else {
          newSelection.add(clipId);
        }
        setSelectedClipIds(newSelection);
      } 
      // Si no, seleccionar solo este clip
      else {
        setSelectedClipIds(new Set([clipId]));
      }
      
      // Actualizar el estado del clip si tenemos una función de actualización
      if (onUpdateClip) {
        onUpdateClip(clipId, { selected: !isSelected });
      }
    }
  };
  
  // Función para eliminar clips seleccionados
  const handleDeleteSelectedClips = () => {
    if (!onDeleteClip || selectedClipIds.size === 0) return;
    
    // Eliminar cada clip seleccionado
    selectedClipIds.forEach(clipId => {
      if (onDeleteClip) onDeleteClip(clipId);
    });
    
    // Limpiar selección
    setSelectedClipIds(new Set());
  };
  
  // Función para duplicar clips seleccionados
  const handleDuplicateSelectedClips = () => {
    // Implementar duplicación de clips aquí
  };
  
  // Preparar clip para edición
  const prepareEditClip = (clip: Clip) => {
    setClipBeingEdited(clip);
    
    // Establecer los valores del formulario basados en el clip seleccionado
    Object.keys(form.getValues()).forEach(key => {
      form.setValue(key as any, clip[key as keyof Clip] as any);
    });
    setClipDialogMode('edit');
    setShowAddClipDialog(true);
  };
  
  // Función para agregar o actualizar un clip
  const handleAddOrUpdateClip = (values: z.infer<typeof clipFormSchema>) => {
    if (clipDialogMode === 'edit' && clipBeingEdited && onUpdateClip) {
      // Actualizar clip existente
      onUpdateClip(clipBeingEdited.id, values);
    } else if (onAddClip) {
      // Agregar nuevo clip
      onAddClip(values);
    }
    
    setShowAddClipDialog(false);
    resetNewClipForm();
  };
  
  // Resetear formulario de nuevo clip
  const resetNewClipForm = () => {
    form.reset({
      title: '',
      start: 0,
      duration: 5,
      url: '',
      trackId: '',
      type: 'video',
      color: ''
    });
  };
  
  // Abrir el diálogo para agregar nuevo clip
  const handleOpenAddClipDialog = () => {
    resetNewClipForm();
    setClipDialogMode('add');
    setShowAddClipDialog(true);
  };
  
  // Obtener la mayor pista usada para diseño de la línea de tiempo
  const getMaxUsedTrackId = () => {
    const maxTrackId = clips.reduce((max, clip) => 
      Math.max(max, parseInt(clip.trackId)), 0);
    return Math.max(5, maxTrackId + 1); // Al menos 5 pistas
  };
  
  // Función para obtener pistas visibles
  const getVisibleTracks = () => tracks.map(track => track.id);
  
  // Renderizar marcadores de tiempo
  const renderTimeMarkers = () => {
    const markersCount = Math.ceil(15 * (zoomLevel / 100));
    const markers = [];
    
    // Crear marcadores principales
    for (let i = 0; i <= markersCount; i++) {
      const percent = (i / markersCount) * 100;
      const time = (percent / 100) * duration;
      
      markers.push(
        <div 
          key={`marker-${i}`}
          className="absolute h-4 border-l border-zinc-600 flex flex-col items-center"
          style={{ left: `${percent}%` }}
        >
          <span className="text-[10px] text-zinc-400 mt-1">
            {formatTime(time)}
          </span>
        </div>
      );
      
      // Agregar sub-marcadores entre marcadores principales
      if (i < markersCount) {
        for (let j = 1; j <= 3; j++) {
          const subPercent = percent + (j * ((1 / markersCount) * 100) / 4);
          markers.push(
            <div 
              key={`submarker-${i}-${j}`}
              className="absolute h-2 border-l border-zinc-800 top-0"
              style={{ left: `${subPercent}%` }}
            />
          );
        }
      }
    }
    
    return markers;
  };
  
  // Renderizar pistas
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
                      left: `${timeToPosition(clip.start)}%`,
                      width: `${calculateClipWidth(clip.start, clip.duration)}%`,
                      backgroundColor: clip.color || clipTypeColors[clip.type] || '#6b7280',
                      borderColor: clip.color || clipTypeColors[clip.type] || '#6b7280'
                    }}
                    onClick={(e) => handleClipClick(e, clip.id)}
                  >
                    <div className="w-full h-5 bg-black bg-opacity-20 flex justify-between items-center px-1 cursor-move">
                      <span className="text-[10px] font-medium text-white truncate">
                        {clip.title}
                      </span>
                      <span className="text-[8px] font-mono text-white bg-black bg-opacity-50 px-1 rounded">
                        {formatTime(clip.duration)}
                      </span>
                    </div>
                    <div className="w-full flex-1 flex items-center justify-center p-1 overflow-hidden">
                      {clip.type === 'video' && <Film className="h-4 w-4 text-white opacity-50" />}
                      {clip.type === 'audio' && <Volume2 className="h-4 w-4 text-white opacity-50" />}
                      {clip.type === 'image' && <Image className="h-4 w-4 text-white opacity-50" />}
                      {clip.type === 'text' && <Type className="h-4 w-4 text-white opacity-50" />}
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48 bg-zinc-900 border-zinc-800 text-gray-200">
                  <ContextMenuItem onClick={() => {
                    if (onSeek) onSeek(clip.start);
                  }}>
                    <PlayCircle className="h-4 w-4 mr-2" /> Reproducir desde aquí
                  </ContextMenuItem>
                  
                  <ContextMenuSeparator />
                  
                  <ContextMenuItem onClick={() => {
                    prepareEditClip(clip);
                  }}>
                    <Wand2 className="h-4 w-4 mr-2" /> Editar clip
                  </ContextMenuItem>
                  
                  <ContextMenuItem
                    onClick={() => {
                      // Por ahora placeholder
                    }}
                  >
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
  };
  
  return (
    <Card className="w-full bg-black border-0 rounded-xl overflow-hidden shadow-xl">
      <CardHeader className="pb-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center text-white">
            <Layers className="h-5 w-5 mr-2 text-orange-400" />
            Línea de tiempo
          </CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-zinc-400">Zoom:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center text-xs text-gray-300"
                >
                  {zoomLevel}%
                  <ChevronsUpDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-gray-200">
                {zoomOptions.map(zoom => (
                  <DropdownMenuItem 
                    key={zoom}
                    onClick={() => setZoomLevel(zoom)}
                    className={cn(
                      "flex items-center text-xs",
                      zoomLevel === zoom && "bg-zinc-800 text-orange-400"
                    )}
                  >
                    {zoom === zoomLevel && <CheckSquare className="h-3 w-3 mr-2" />}
                    {zoom !== zoomLevel && <div className="w-5 mr-2" />}
                    {zoom}%
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 bg-transparent border-zinc-700 text-zinc-400 hover:text-white"
              onClick={() => setZoomLevel(prev => Math.max(25, prev - 25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8 bg-transparent border-zinc-700 text-zinc-400 hover:text-white"
              onClick={() => setZoomLevel(prev => Math.min(300, prev + 25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 bg-black">
        {/* Controles de reproducción */}
        <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            {!isPlaying ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onPlay}
                className="h-8 w-8 bg-transparent text-zinc-400 hover:text-white"
              >
                <PlayCircle className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onPause}
                className="h-8 w-8 bg-transparent text-zinc-400 hover:text-white"
              >
                <PauseCircle className="h-5 w-5" />
              </Button>
            )}
            <div className="text-xs font-mono text-zinc-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenAddClipDialog}
              className="h-8 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Agregar clip</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteSelectedClips}
              className="h-8 w-8 bg-transparent text-zinc-400 hover:text-red-400"
              disabled={selectedClipIds.size === 0}
            >
              <Trash className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDuplicateSelectedClips}
              className="h-8 w-8 bg-transparent text-zinc-400 hover:text-white"
              disabled={selectedClipIds.size === 0}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Área de línea de tiempo con pistas */}
        <div 
          className="bg-zinc-950 relative overflow-x-auto"
          style={{ 
            height: `${Math.max(400, tracks.length * trackHeight + 40)}px`,
            width: `${zoomLevel}%` 
          }}
          ref={timelineRef}
          onClick={handleTimelineClick}
        >
          {/* Contenedor principal con scroll */}
          <div className="relative min-w-full h-full">
            {/* Playhead - cabeza de reproducción */}
            <div 
              ref={playheadRef}
              className="absolute top-0 h-full w-px bg-orange-500 z-10"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute -top-1 -left-2 w-4 h-4 bg-orange-500 rounded-full transform -translate-y-full" />
            </div>
            
            {/* Pistas */}
            <div className="absolute inset-0 mt-8">
              {renderTracks()}
            </div>
            
            {/* Marcadores de tiempo */}
            <div className="absolute inset-0 pointer-events-none">
              {renderTimeMarkers()}
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Diálogo para agregar/editar clip */}
      <Dialog open={showAddClipDialog} onOpenChange={setShowAddClipDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{clipDialogMode === 'add' ? 'Agregar nuevo clip' : 'Editar clip'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddOrUpdateClip)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Título</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Título del clip"
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Tipo</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="audio">Audio</SelectItem>
                          <SelectItem value="image">Imagen</SelectItem>
                          <SelectItem value="text">Texto</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <div className="flex space-x-4">
                <FormField
                  control={form.control}
                  name="start"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-zinc-300">Inicio (s)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          min="0"
                          max={duration}
                          className="bg-zinc-800 border-zinc-700 text-white"
                          onChange={e => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="text-zinc-300">Duración (s)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.1"
                          min="0.1"
                          className="bg-zinc-800 border-zinc-700 text-white"
                          onChange={e => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">URL del recurso</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://"
                        className="bg-zinc-800 border-zinc-700 text-white"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="trackId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Pista</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                          <SelectValue placeholder="Seleccionar pista" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                          {tracks.map(track => (
                            <SelectItem key={track.id} value={track.id}>
                              {track.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Color (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="color"
                        className="h-10 bg-zinc-800 border-zinc-700 text-white"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowAddClipDialog(false);
                    setClipBeingEdited(null);
                  }}
                  className="bg-transparent border-zinc-700 text-zinc-300 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {clipDialogMode === 'add' ? 'Agregar' : 'Actualizar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProfessionalTimeline;