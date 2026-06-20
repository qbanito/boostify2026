/**
 * Video Preview Player
 * Preview en tiempo real del timeline
 */

import { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Play, Pause, SkipBack, SkipForward, Maximize2 } from 'lucide-react';
import type { TimelineClip } from './EnhancedTimeline';
import { getActiveClipAtTime, generateCachedPreviewFrame } from '../../lib/services/video-preview-service';

interface VideoPreviewPlayerProps {
  clips: TimelineClip[];
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
  onSeek?: (time: number) => void;
  onPlayPause?: () => void;
}

export function VideoPreviewPlayer({
  clips,
  currentTime,
  duration,
  isPlaying = false,
  onSeek,
  onPlayPause
}: VideoPreviewPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Actualizar preview cuando cambia el tiempo
  useEffect(() => {
    updatePreview();
  }, [currentTime, clips]);

  const updatePreview = async () => {
    setIsLoading(true);
    try {
      const frame = await generateCachedPreviewFrame(clips, currentTime, {
        quality: 'medium',
        fps: 30,
        resolution: { width: 1920, height: 1080 }
      });

      if (frame) {
        setPreviewUrl(frame.imageUrl);
      }
    } catch (error) {
      console.error('Error generando preview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipBackward = () => {
    onSeek?.(Math.max(0, currentTime - 5));
  };

  const handleSkipForward = () => {
    onSeek?.(Math.min(duration, currentTime + 5));
  };

  const activeClip = getActiveClipAtTime(clips, currentTime);

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <div className="aspect-video bg-black relative overflow-hidden">
        {/* Preview Image/Video */}
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <div className="text-center">
              <Play className="h-16 w-16 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No preview available</p>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
          </div>
        )}

        {/* Clip Info Overlay */}
        {activeClip && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white text-sm font-medium">{activeClip.title}</p>
            <p className="text-zinc-400 text-xs">
              {activeClip.type.toUpperCase()} • {activeClip.duration.toFixed(1)}s
            </p>
          </div>
        )}

        {/* Fullscreen Button */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 text-white hover:bg-white/20"
          onClick={() => {
            const elem = canvasRef.current?.parentElement;
            if (elem?.requestFullscreen) {
              elem.requestFullscreen();
            }
          }}
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleSkipBackward}
            data-testid="button-skip-back"
          >
            <SkipBack className="h-5 w-5" />
          </Button>

          <Button
            size="icon"
            variant="default"
            onClick={onPlayPause}
            className="bg-orange-600 hover:bg-orange-700 h-12 w-12"
            data-testid="button-play-pause"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6 ml-0.5" />
            )}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={handleSkipForward}
            data-testid="button-skip-forward"
          >
            <SkipForward className="h-5 w-5" />
          </Button>
        </div>

        {/* Time Display */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400 font-mono">
            {formatTime(currentTime)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 font-mono">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </Card>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default VideoPreviewPlayer;
