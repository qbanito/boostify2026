import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from "../../lib/logger";
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Maximize2,
  Download,
  Settings
} from 'lucide-react';
import { gsapTransitionsService, type GSAPSceneConfig, type GSAPTransitionType } from '../../lib/services/gsap-transitions';
import { cn } from '../../lib/utils';
import { ImageEffects } from './image-sequence-manager';

interface GSAPVideoPreviewProps {
  scenes: Array<{
    imageUrl: string;
    duration: number;
    transitionType?: string;
    transitionDuration?: number;
    cameraMovement?: 'pan-left' | 'pan-right' | 'zoom-in' | 'zoom-out' | 'static';
    shotType?: string;
    effects?: ImageEffects;
  }>;
  onClose?: () => void;
  className?: string;
}

export function GSAPVideoPreview({ scenes, onClose, className }: GSAPVideoPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationFrameRef = useRef<number>();

  // Mapear tipos de transición del sistema existente a GSAP
  const mapTransitionType = (type?: string): GSAPTransitionType => {
    const mapping: Record<string, GSAPTransitionType> = {
      'crossfade': 'crossfade',
      'fade': 'fade',
      'slide': 'slide-left',
      'zoom': 'zoom-in',
      'dissolve': 'dissolve',
      'cut': 'cut',
      'wipe': 'wipe-left'
    };
    return mapping[type || 'fade'] || 'fade';
  };

  // Convertir escenas al formato GSAP
  const gsapScenes: GSAPSceneConfig[] = scenes.map((scene, index) => ({
    imageUrl: scene.imageUrl,
    duration: scene.duration || 3,
    transition: {
      type: mapTransitionType(scene.transitionType),
      duration: scene.transitionDuration || 0.5,
      ease: 'power2.inOut'
    },
    cameraMovement: scene.cameraMovement || 'static',
    movementIntensity: 0.1,
    effects: scene.effects
  }));

  // Inicializar timeline GSAP
  useEffect(() => {
    if (!containerRef.current || scenes.length === 0) return;

    const timeline = gsapTransitionsService.createTimeline(
      containerRef.current,
      gsapScenes,
      {
        onUpdate: (progress) => {
          const duration = gsapTransitionsService.getTotalDuration();
          setCurrentTime(progress * duration);
        },
        onSceneChange: (sceneIndex) => {
          setCurrentSceneIndex(sceneIndex);
        },
        onComplete: () => {
          setIsPlaying(false);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
        }
      }
    );

    setTotalDuration(timeline.duration());

    return () => {
      gsapTransitionsService.destroy();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scenes]);

  // Actualizar tiempo actual durante la reproducción
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const updateTime = () => {
      const time = gsapTransitionsService.getCurrentTime();
      setCurrentTime(time);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      gsapTransitionsService.pause();
      setIsPlaying(false);
    } else {
      gsapTransitionsService.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleRestart = useCallback(() => {
    gsapTransitionsService.restart();
    setIsPlaying(true);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    const newTime = value[0];
    gsapTransitionsService.seekTime(newTime);
    setCurrentTime(newTime);
  }, []);

  const handleSkipForward = useCallback(() => {
    const newTime = Math.min(currentTime + 5, totalDuration);
    gsapTransitionsService.seekTime(newTime);
    setCurrentTime(newTime);
  }, [currentTime, totalDuration]);

  const handleSkipBackward = useCallback(() => {
    const newTime = Math.max(currentTime - 5, 0);
    gsapTransitionsService.seekTime(newTime);
    setCurrentTime(newTime);
  }, [currentTime]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentScene = scenes[currentSceneIndex];

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-orange-500" />
            GSAP Video Preview
          </CardTitle>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-preview"
            >
              Close
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Video Container */}
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
          data-testid="gsap-preview-container"
        >
          {scenes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <p>No scenes to preview</p>
            </div>
          )}
        </div>

        {/* Scene Info */}
        {currentScene && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" data-testid="text-scene-info">
              Scene {currentSceneIndex + 1} / {scenes.length}
            </Badge>
            {currentScene.shotType && (
              <Badge variant="secondary">{currentScene.shotType}</Badge>
            )}
            {currentScene.transitionType && (
              <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/50">
                {currentScene.transitionType}
              </Badge>
            )}
            {currentScene.cameraMovement && currentScene.cameraMovement !== 'static' && (
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50">
                {currentScene.cameraMovement}
              </Badge>
            )}
          </div>
        )}

        {/* Timeline Slider */}
        <div className="space-y-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={totalDuration}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
            data-testid="slider-timeline"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-current-time">{formatTime(currentTime)}</span>
            <span data-testid="text-total-duration">{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRestart}
            disabled={scenes.length === 0}
            data-testid="button-restart"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipBackward}
            disabled={scenes.length === 0}
            data-testid="button-skip-backward"
          >
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            size="lg"
            onClick={handlePlayPause}
            disabled={scenes.length === 0}
            className="gap-2 px-8"
            data-testid="button-play-pause"
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Play
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipForward}
            disabled={scenes.length === 0}
            data-testid="button-skip-forward"
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            disabled={scenes.length === 0}
            data-testid="button-fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Additional Info */}
        <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Total Scenes: {scenes.length}</span>
            <span>Duration: {formatTime(totalDuration)}</span>
          </div>
          <Badge variant="outline" className="gap-1">
            <Settings className="w-3 h-3" />
            GSAP Timeline
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
