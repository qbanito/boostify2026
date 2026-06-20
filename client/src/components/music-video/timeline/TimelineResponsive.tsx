/**
 * Timeline Responsive Wrapper
 * Adaptación automática para móvil y desktop
 * Portrait: Vertical layout con toolbar colapsible
 * Landscape: Horizontal layout con todos los controles visibles
 */

import React, { useState, useEffect } from 'react';
import { TimelineEditor as TimelineEditorComponent } from './TimelineEditor';
import { Button } from '@/components/ui/button';
import { Menu, X, Settings } from 'lucide-react';
import type { TimelineClip } from '@/interfaces/timeline';

// Re-export TimelineEditor for compatibility
export const TimelineEditor = TimelineEditorComponent;

interface TimelineResponsiveProps {
  initialClips: TimelineClip[];
  duration: number;
  markers?: any[];
  readOnly?: boolean;
  videoPreviewUrl?: string;
  audioPreviewUrl?: string;
  onChange?: (clips: TimelineClip[]) => void;
  audioBuffer?: AudioBuffer;
  genreHint?: string;
}

export function TimelineResponsive(props: TimelineResponsiveProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Detectar cambios de orientación y tamaño
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Mobile si es menor que 768px (tablet breakpoint)
      setIsMobile(width < 768);
      
      // Detectar orientación
      const isPortrait = height > width;
      setOrientation(isPortrait ? 'portrait' : 'landscape');
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isMobile) {
    // Desktop: Timeline normal
    return (
      <div className="w-full h-full">
        <TimelineEditorComponent {...props} />
      </div>
    );
  }

  // Mobile: Layout responsivo
  return (
    <div className="flex flex-col w-full h-full bg-neutral-950">
      {/* Header móvil con toggle toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-white/10 md:hidden">
        <h3 className="text-sm font-semibold text-white">Timeline</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowToolbar(!showToolbar)}
          className="gap-2"
        >
          {showToolbar ? (
            <X size={16} />
          ) : (
            <Menu size={16} />
          )}
        </Button>
      </div>

      {/* Contenedor principal responsive */}
      {orientation === 'portrait' ? (
        // Portrait: Stack vertical
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Preview (más grande en portrait) */}
          <div className="flex-none h-48 sm:h-64 border-b border-white/10">
            {props.videoPreviewUrl && (
              <video
                src={props.videoPreviewUrl}
                className="w-full h-full object-contain bg-black"
                controls
                playsInline
              />
            )}
          </div>

          {/* Timeline (scrollable) */}
          <div className="flex-1 overflow-auto">
            <TimelineEditorComponent {...props} />
          </div>
        </div>
      ) : (
        // Landscape: 2 columnas
        <div className="flex flex-1 overflow-hidden">
          {/* Preview en columna izquierda */}
          <div className="w-2/5 flex-none border-r border-white/10">
            {props.videoPreviewUrl && (
              <video
                src={props.videoPreviewUrl}
                className="w-full h-full object-contain bg-black"
                controls
                playsInline
              />
            )}
          </div>

          {/* Timeline en columna derecha */}
          <div className="flex-1 overflow-auto">
            <TimelineEditorComponent {...props} />
          </div>
        </div>
      )}

      {/* Toolbar flotante en móvil (colapsible) */}
      {isMobile && showToolbar && (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-white/10 p-2 max-h-[200px] overflow-y-auto md:hidden">
          <div className="flex flex-wrap gap-1 justify-center">
            <Button size="sm" variant="ghost" className="text-xs">
              Select
            </Button>
            <Button size="sm" variant="ghost" className="text-xs">
              Razor
            </Button>
            <Button size="sm" variant="ghost" className="text-xs">
              Trim
            </Button>
            <Button size="sm" variant="ghost" className="text-xs">
              Hand
            </Button>
            <Button size="sm" variant="ghost" className="text-xs">
              Snap
            </Button>
            <Button size="sm" variant="ghost" className="text-xs">
              Motion
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TimelineResponsive;
