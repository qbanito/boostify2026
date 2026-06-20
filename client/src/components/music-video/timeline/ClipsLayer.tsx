import React from 'react';
import { logger } from "../../lib/logger";
import { cn } from '../../../lib/utils';
import { TimelineClip } from '../../../components/timeline/TimelineClip';

interface ClipsLayerProps {
  clips: TimelineClip[];
  selectedClip: number | null;
  timeToPixels: (time: number) => number;
  onSelectClip: (clipId: number) => void;
  onResizeClip: (clipId: number, newDuration: number) => void;
  onMoveClip: (clipId: number, newStart: number) => void;
  onPreviewClip: (clip: TimelineClip) => void;
  height?: number;
}

/**
 * Componente para gestionar la capa de clips en el timeline
 */
export function ClipsLayer({
  clips,
  selectedClip,
  timeToPixels,
  onSelectClip,
  onResizeClip,
  onMoveClip,
  onPreviewClip,
  height = 50
}: ClipsLayerProps) {
  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {/* Fondo para la capa de clips */}
      <div className="absolute inset-0 bg-card/5" />
      
      {/* Renderizar cada clip */}
      {clips.map((clip) => {
        const clipLeft = timeToPixels(clip.start);
        const clipWidth = timeToPixels(clip.duration);
        const isSelected = clip.id === selectedClip;
        
        // Determinar color según tipo de clip
        const clipTypeStyles = {
          video: "bg-purple-800/70 border-purple-500 hover:bg-purple-700/80",
          audio: "bg-blue-800/70 border-blue-500 hover:bg-blue-700/80",
          image: "bg-green-800/70 border-green-500 hover:bg-green-700/80",
          text: "bg-amber-800/70 border-amber-500 hover:bg-amber-700/80"
        };
        
        const clipTypeBg = clipTypeStyles[clip.type as keyof typeof clipTypeStyles] || "bg-gray-800/70 border-gray-500";
        
        return (
          <div
            key={clip.id}
            className={cn(
              "absolute flex items-center justify-between overflow-hidden rounded border p-1 transition-all",
              clipTypeBg,
              isSelected ? "ring-2 ring-white/50" : "ring-0",
              "cursor-move select-none"
            )}
            style={{
              left: `${clipLeft}px`,
              width: `${clipWidth}px`,
              height: `${height - 4}px`,
              top: "2px"
            }}
            onMouseDown={(e) => {
              // Si no es un control de redimensionamiento, seleccionar el clip
              if (!(e.target as HTMLElement).classList.contains("resizer")) {
                onSelectClip(clip.id);
              }
            }}
            onDoubleClick={() => onPreviewClip(clip)}
          >
            {/* Miniatura o previsualización para imágenes */}
            {clip.type === "image" && (clip.url || clip.imageUrl) && (
              <div className="absolute left-0 top-0 h-full w-full opacity-30">
                <img
                  src={clip.url || clip.imageUrl}
                  alt={clip.title || clip.name || "Clip"}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            
            {/* Previsualización para videos */}
            {clip.type === "video" && (clip.url || clip.videoUrl) && (
              <div className="absolute left-0 top-0 h-full w-full opacity-30">
                <video 
                  src={clip.url || clip.videoUrl} 
                  muted 
                  playsInline 
                  className="h-full w-full object-cover" 
                />
              </div>
            )}
            
            {/* Previsualización para audio */}
            {clip.type === "audio" && (clip.url || clip.audioUrl) && (
              <div className="absolute left-0 top-0 h-full w-full flex items-center justify-center opacity-30">
                <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center">
                  <span className="text-xs">♪</span>
                </div>
              </div>
            )}
            
            {/* Título del clip */}
            <div className="z-10 max-w-[calc(100%-20px)] truncate text-xs font-medium text-white">
              {clip.title || clip.name || `Clip ${clip.id}`}
            </div>
            
            {/* Controles de redimensionado */}
            <div
              className="resizer absolute right-0 top-0 h-full w-3 cursor-e-resize"
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelectClip(clip.id);
                
                // Implementar lógica de redimensionamiento
                const startX = e.clientX;
                const startWidth = clipWidth;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const dx = moveEvent.clientX - startX;
                  const newWidth = Math.max(20, startWidth + dx); // Mínimo 20px
                  const newDuration = newWidth / timeToPixels(1);
                  onResizeClip(clip.id, newDuration);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
            
            {/* Handle para mover el clip */}
            <div
              className="absolute left-0 top-0 h-full w-full cursor-move"
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelectClip(clip.id);
                
                // Implementar lógica de movimiento
                const startX = e.clientX;
                const startLeft = clipLeft;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const dx = moveEvent.clientX - startX;
                  const newLeft = Math.max(0, startLeft + dx);
                  const newStart = newLeft / timeToPixels(1);
                  onMoveClip(clip.id, newStart);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}