/**
 * Componente para representar clips individuales en la línea de tiempo
 * Maneja la renderización visual de todo tipo de clips (audio, imagen, video, texto)
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { 
  Trash, Copy, Play, Link, Image, Video, Music, Text, 
  Eye, EyeOff, Lock, Unlock, RefreshCw, FileText, 
  Scissors, Move, Film, Type, Info
} from 'lucide-react';
import { TimelineClip as TimelineClipType } from '../music-video/TimelineEditor';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../../components/ui/dialog';

interface TimelineClipProps {
  clip: TimelineClipType;
  selected: boolean;
  timeToPixels: (time: number) => number;
  onSelect: (id: number, multiSelect?: boolean) => void;
  onMouseDown: (e: React.MouseEvent, clipId: number, handle?: 'start' | 'end' | 'body') => void;
  onDelete: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onPreview?: (id: number) => void;
  onRegenerate?: (id: number) => void;
  onSplit?: (id: number, time: number) => void;
}

/**
 * Componente para clips de línea de tiempo
 * Maneja la interacción y visualización de clips en la línea de tiempo
 */
export function TimelineClip({
  clip,
  selected,
  timeToPixels,
  onSelect,
  onMouseDown,
  onDelete,
  onDuplicate,
  onPreview,
  onRegenerate,
  onSplit
}: TimelineClipProps) {
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  
  // Calculamos la posición y ancho del clip basándonos en start y duration
  const left = timeToPixels(clip.start);
  const width = timeToPixels(clip.duration);
  
  // Determinar el ícono basado en el tipo de clip
  const getClipIcon = () => {
    switch (clip.type) {
      case 'video':
        return <Video className="h-3 w-3" />;
      case 'image':
        return <Image className="h-3 w-3" />;
      case 'audio':
        return <Music className="h-3 w-3" />;
      case 'text':
        return <Text className="h-3 w-3" />;
      case 'effect':
        return <Film className="h-3 w-3" />;
      case 'transition':
        return <Type className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  // Determinar el color del clip basado en el tipo y la capa
  const getClipColor = () => {
    // Destacar las imágenes generadas en la capa 7 con un color especial
    if (clip.layer === 7 && clip.type === 'image') {
      return 'bg-gradient-to-r from-orange-900 to-amber-800 border-amber-500';
    }
    
    switch (clip.type) {
      case 'video':
        return 'bg-gradient-to-r from-blue-950 to-blue-900 border-blue-500';
      case 'image':
        return 'bg-gradient-to-r from-indigo-950 to-indigo-900 border-indigo-500';
      case 'audio':
        return 'bg-gradient-to-r from-rose-950 to-rose-900 border-rose-500';
      case 'text':
        return 'bg-gradient-to-r from-green-950 to-green-900 border-green-500';
      case 'effect':
        return 'bg-gradient-to-r from-purple-950 to-purple-900 border-purple-500';
      case 'transition':
        return 'bg-gradient-to-r from-amber-950 to-amber-900 border-amber-500';
      default:
        return 'bg-gradient-to-r from-gray-900 to-gray-800 border-gray-500';
    }
  };

  // Manejar clic en clip
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Si es una imagen y tiene prompt, mostrar el diálogo
    if (clip.type === 'image' && clip.imagePrompt) {
      setShowPromptDialog(true);
    }
    
    onSelect(clip.id, e.ctrlKey || e.metaKey);
  };
  
  // Manejar regeneración desde el diálogo
  const handleRegenerateFromDialog = () => {
    if (onRegenerate) {
      onRegenerate(clip.id);
    }
    setShowPromptDialog(false);
  };

  // Verificar si el clip tiene imagen o miniatura
  const hasImage = clip.thumbnail || clip.imageUrl;

  return (
    <>
      {/* Diálogo para mostrar el prompt de la imagen */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prompt de imagen: {clip.title || `Clip ${clip.id}`}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {clip.imageUrl && (
              <div className="flex justify-center mb-4">
                <img 
                  src={clip.imageUrl} 
                  alt="Imagen generada" 
                  className="max-h-[40vh] object-contain rounded-md border border-gray-300"
                />
              </div>
            )}
            
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-md">
              <h4 className="text-sm font-medium mb-2">Prompt utilizado:</h4>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm">
                {clip.imagePrompt || "No hay prompt disponible para esta imagen."}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            {clip.type === 'image' && onRegenerate && (
              <Button 
                onClick={handleRegenerateFromDialog}
                className="mr-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerar imagen
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setShowPromptDialog(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div
        className={cn(
          "absolute rounded-sm overflow-hidden border select-none",
          getClipColor(),
          selected ? 'border-2 ring-2 ring-primary ring-opacity-50 z-10' : 'border',
          clip.visible === false ? 'opacity-50' : 'opacity-100',
          clip.locked ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          height: '40px',
          top: '4px',
          transition: 'border-color 0.1s ease',
        }}
        onClick={handleClick}
        onMouseDown={(e) => !clip.locked && onMouseDown(e, clip.id, 'body')}
      >
      {/* Manijas para redimensionar */}
      {!clip.locked && (
        <>
          <div
            className="absolute left-0 top-0 w-2 h-full bg-gray-800 bg-opacity-50 cursor-ew-resize z-10"
            onMouseDown={(e) => onMouseDown(e, clip.id, 'start')}
          />
          <div
            className="absolute right-0 top-0 w-2 h-full bg-gray-800 bg-opacity-50 cursor-ew-resize z-10"
            onMouseDown={(e) => onMouseDown(e, clip.id, 'end')}
          />
        </>
      )}

      {/* Contenido principal del clip */}
      <div className="relative h-full flex flex-col">
        {/* Barra superior con controles */}
        <div className="absolute top-0 left-0 right-0 h-5 bg-black bg-opacity-40 flex items-center justify-between px-1 text-white z-20">
          <div className="flex items-center space-x-1 text-xs truncate max-w-[70%]">
            {getClipIcon()}
            <span className="truncate">{clip.title || `Clip ${clip.id}`}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            {clip.visible === false ? (
              <EyeOff className="h-3 w-3 text-gray-400" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            
            {clip.locked && (
              <Lock className="h-3 w-3 text-gray-400" />
            )}
          </div>
        </div>

        {/* Cuerpo del clip - Mostrar miniatura si está disponible */}
        <div className="flex-1 overflow-hidden">
          {hasImage ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={clip.thumbnail || clip.imageUrl}
                alt={clip.title}
                className="w-full h-full object-cover"
                style={{ opacity: 0.8 }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {clip.type === 'audio' && clip.waveform ? (
                <div className="w-full h-full flex items-center justify-center">
                  {/* Visualización simplificada de la forma de onda */}
                  <div className="flex h-[70%] items-end space-x-[1px]">
                    {clip.waveform.slice(0, Math.min(50, clip.waveform.length)).map((value, i) => (
                      <div
                        key={`waveform-${clip.id}-${i}`}
                        className="w-[2px] bg-rose-400"
                        style={{ height: `${value * 100}%` }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-400">
                  {clip.shotType || clip.description || clip.type}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controles que aparecen cuando el clip está seleccionado */}
        {selected && (
          <div className="absolute bottom-0 left-0 right-0 h-5 bg-black bg-opacity-60 flex items-center justify-center space-x-1 z-20">
            <TooltipProvider>
              {onPreview && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(clip.id);
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Vista previa</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {onDuplicate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate(clip.id);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Duplicar</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(clip.id);
                      }}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Eliminar</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {clip.type === 'image' && onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRegenerate(clip.id);
                      }}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Regenerar imagen</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {onSplit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-4 w-4 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Dividir en el punto medio
                        const midPoint = clip.start + (clip.duration / 2);
                        onSplit(clip.id, midPoint);
                      }}
                    >
                      <Scissors className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Dividir clip</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        )}

        {/* Información adicional / etiquetas */}
        {clip.shotType && (
          <Badge
            variant="outline"
            className="absolute top-5 right-0 text-[10px] h-4 pointer-events-none bg-purple-500/80 border-purple-400 text-white font-mono"
          >
            {clip.shotType}
          </Badge>
        )}
      </div>
    </div>
    </>
  );
}