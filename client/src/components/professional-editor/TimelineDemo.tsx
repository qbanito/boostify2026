/**
 * Enhanced Timeline Demo Component
 * Demonstrates all features of the professional timeline editor
 */

import { useState, useEffect } from 'react';
import { EnhancedTimeline, TimelineClip, TimelineTrack } from './EnhancedTimeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { RefreshCw, Play, Save } from 'lucide-react';

// Sample data
const DEMO_DURATION = 120; // 2 minutes

const sampleTracks: TimelineTrack[] = [
  { id: '0', name: 'Video 1', type: 'video', visible: true, locked: false, color: '#8B5CF6' },
  { id: '1', name: 'Video 2', type: 'video', visible: true, locked: false, color: '#6366F1' },
  { id: '2', name: 'Audio Principal', type: 'audio', visible: true, locked: false, color: '#3B82F6' },
  { id: '3', name: 'Audio FX', type: 'audio', visible: true, locked: false, color: '#06B6D4' },
  { id: '4', name: 'Mix Final', type: 'mix', visible: true, locked: false, color: '#10B981' },
];

const sampleClips: TimelineClip[] = [
  {
    id: 'clip-1',
    title: 'Intro Scene',
    type: 'video',
    start: 0,
    duration: 15,
    url: 'https://example.com/clip1.mp4',
    trackId: '0',
    color: '#8B5CF6',
    selected: false,
    locked: false
  },
  {
    id: 'clip-2',
    title: 'Main Performance',
    type: 'video',
    start: 15,
    duration: 30,
    url: 'https://example.com/clip2.mp4',
    trackId: '0',
    color: '#8B5CF6',
    selected: false,
    locked: false
  },
  {
    id: 'clip-3',
    title: 'B-Roll',
    type: 'video',
    start: 20,
    duration: 15,
    url: 'https://example.com/clip3.mp4',
    trackId: '1',
    color: '#6366F1',
    selected: false,
    locked: false
  },
  {
    id: 'clip-4',
    title: 'Background Music',
    type: 'audio',
    start: 0,
    duration: 60,
    url: 'https://example.com/music.mp3',
    trackId: '2',
    color: '#3B82F6',
    selected: false,
    locked: false
  },
  {
    id: 'clip-5',
    title: 'Sound Effect',
    type: 'audio',
    start: 15,
    duration: 2,
    url: 'https://example.com/sfx.mp3',
    trackId: '3',
    color: '#06B6D4',
    selected: false,
    locked: false
  },
  {
    id: 'clip-6',
    title: 'Title Card',
    type: 'text',
    start: 0,
    duration: 5,
    url: '',
    trackId: '1',
    color: '#F59E0B',
    selected: false,
    locked: false
  },
  {
    id: 'clip-7',
    title: 'Outro Scene',
    type: 'video',
    start: 45,
    duration: 15,
    url: 'https://example.com/clip4.mp4',
    trackId: '0',
    color: '#8B5CF6',
    selected: false,
    locked: false
  },
];

export function TimelineDemo() {
  const { toast } = useToast();
  const [clips, setClips] = useState<TimelineClip[]>(sampleClips);
  const [tracks, setTracks] = useState<TimelineTrack[]>(sampleTracks);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackInterval, setPlaybackInterval] = useState<NodeJS.Timeout | null>(null);

  // Playback simulation
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= DEMO_DURATION) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
      setPlaybackInterval(interval);
    } else {
      if (playbackInterval) {
        clearInterval(playbackInterval);
        setPlaybackInterval(null);
      }
    }

    return () => {
      if (playbackInterval) clearInterval(playbackInterval);
    };
  }, [isPlaying]);

  const handleClipsChange = (newClips: TimelineClip[]) => {
    setClips(newClips);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    toast({
      title: "Reproducción iniciada",
      description: "El timeline está reproduciéndose"
    });
  };

  const handlePause = () => {
    setIsPlaying(false);
    toast({
      title: "Reproducción pausada",
      description: `Pausado en ${currentTime.toFixed(1)}s`
    });
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleReset = () => {
    setClips(sampleClips);
    setCurrentTime(0);
    setIsPlaying(false);
    toast({
      title: "Timeline reiniciado",
      description: "Se han restaurado los clips de demostración"
    });
  };

  const handleSave = () => {
    const data = JSON.stringify({
      clips,
      tracks,
      duration: DEMO_DURATION,
      timestamp: new Date().toISOString()
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline-demo-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Timeline guardado",
      description: "Proyecto exportado como JSON"
    });
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                Enhanced Professional Timeline Demo
              </CardTitle>
              <CardDescription className="mt-2">
                Timeline editor profesional 100% responsivo con todas las funcionalidades
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reiniciar
              </Button>
              <Button
                onClick={handleSave}
                data-testid="button-save-demo"
              >
                <Save className="h-4 w-4 mr-2" />
                Guardar JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Features List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Undo/Redo completo</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Drag & Drop con colisiones</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Trim/Resize clips</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Split/Cortar clips</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Touch gestures (móvil)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">100% Responsivo</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Atajos de teclado</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Snap to grid</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">✓</Badge>
              <span className="text-sm">Multi-track support</span>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-6 p-4 bg-zinc-900 rounded-lg">
            <h3 className="text-sm font-semibold mb-3 text-zinc-300">Atajos de Teclado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-zinc-400">
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">Space</kbd> Play/Pause</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">V</kbd> Select Tool</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">C</kbd> Razor Tool</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">T</kbd> Trim Tool</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">H</kbd> Hand Tool</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">Delete</kbd> Eliminar</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">Cmd+Z</kbd> Deshacer</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">Cmd+Y</kbd> Rehacer</div>
              <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded">Cmd+D</kbd> Duplicar</div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
            <span>{clips.length} clips en {tracks.length} pistas</span>
            <span>Duración total: {DEMO_DURATION}s</span>
            <span>Tiempo actual: {currentTime.toFixed(1)}s</span>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Timeline */}
      <EnhancedTimeline
        clips={clips}
        tracks={tracks}
        currentTime={currentTime}
        duration={DEMO_DURATION}
        isPlaying={isPlaying}
        onClipsChange={handleClipsChange}
        onSeek={handleSeek}
        onPlay={handlePlay}
        onPause={handlePause}
      />

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-400">
          <p>
            <strong className="text-white">Mover clips:</strong> Selecciona la herramienta "Select" (V) y arrastra los clips.
            El sistema detecta colisiones automáticamente.
          </p>
          <p>
            <strong className="text-white">Trim/Recortar:</strong> Selecciona la herramienta "Trim" (T) y arrastra los bordes
            de los clips para ajustar su duración.
          </p>
          <p>
            <strong className="text-white">Cortar clips:</strong> Selecciona la herramienta "Razor" (C) y haz clic en un clip
            donde quieras cortarlo.
          </p>
          <p>
            <strong className="text-white">Zoom:</strong> Usa los botones +/- o pinch en móvil para ajustar el zoom del timeline.
          </p>
          <p>
            <strong className="text-white">Selección múltiple:</strong> Mantén Ctrl/Cmd y haz clic en varios clips para
            seleccionarlos. Luego puedes eliminarlos o duplicarlos juntos.
          </p>
          <p>
            <strong className="text-white">Móvil:</strong> Usa gestos táctiles - pinch para zoom, drag para mover clips,
            y tap para seleccionar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default TimelineDemo;
