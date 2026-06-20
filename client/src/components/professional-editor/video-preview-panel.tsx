import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '../../components/ui/card';
import {
  Button
} from '../../components/ui/button';
import {
  Slider
} from '../../components/ui/slider';
import {
  PlayCircle,
  PauseCircle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  DownloadCloud,
  Share2,
  ScreenShare,
  Info,
  FileVideo,
  ZoomIn,
  ZoomOut,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VisualEffect } from '../../lib/professional-editor-types';

interface VideoPreviewPanelProps {
  videoSrc: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeEffects: VisualEffect[];
  onPlay?: () => void;
  onPause?: () => void;
  onSeek?: (time: number) => void;
  onToggleEffect?: (effectId: string, enabled: boolean) => void;
}

const VideoPreviewPanel: React.FC<VideoPreviewPanelProps> = ({
  videoSrc,
  currentTime,
  duration,
  isPlaying,
  activeEffects = [],
  onPlay,
  onPause,
  onSeek,
  onToggleEffect
}) => {
  // Estados
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showEffectsOverlay, setShowEffectsOverlay] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [videoQuality, setVideoQuality] = useState<'auto' | '720p' | '1080p'>('auto');
  
  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  
  // Formatear tiempo (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Actualizar video según los cambios en currentTime
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);
  
  // Manejar reproducción/pausa según isPlaying
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(error => {
          console.error('Error al reproducir video:', error);
          if (onPause) {
            onPause();
          }
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, onPause]);
  
  // Manejar volumen y mute
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);
  
  // Manejar pantalla completa
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Ocultar controles después de un tiempo
  useEffect(() => {
    if (isPlaying) {
      if (controlsTimeoutRef.current !== null) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    
    return () => {
      if (controlsTimeoutRef.current !== null) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);
  
  // Manejar clic en reproducir/pausar
  const handlePlayPause = () => {
    if (isPlaying && onPause) {
      onPause();
    } else if (!isPlaying && onPlay) {
      onPlay();
    }
  };
  
  // Manejar clic en la barra de progreso
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = offsetX / rect.width;
    
    onSeek(percentage * duration);
  };
  
  // Manejar alternar pantalla completa
  const handleToggleFullscreen = () => {
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
  };
  
  // Manejar alternar efectos
  const handleToggleEffect = (effectId: string, enabled: boolean) => {
    if (onToggleEffect) {
      onToggleEffect(effectId, enabled);
    }
  };
  
  // Aplicar efectos al video
  const applyVisualEffects = () => {
    if (!activeEffects || activeEffects.length === 0) return {};
    
    // Todos los efectos están habilitados por defecto según la interfaz del tipo
    // Construir estilos CSS basados en los efectos
    const styles: React.CSSProperties = {};
    
    activeEffects.forEach(effect => {
      // Usar parameters para determinar el subtipo de efecto
      const effectSubtype = effect.parameters?.subtype as string;
      
      switch (effect.type) {
        case 'filter':
          if (effectSubtype === 'blur') {
            styles.filter = `${styles.filter || ''} blur(${effect.intensity * 10}px)`;
          } else if (effectSubtype === 'brightness') {
            styles.filter = `${styles.filter || ''} brightness(${effect.parameters?.level || 1 * 2})`;
          } else if (effectSubtype === 'contrast') {
            styles.filter = `${styles.filter || ''} contrast(${effect.parameters?.level || 1 * 2})`;
          } else if (effectSubtype === 'grayscale') {
            styles.filter = `${styles.filter || ''} grayscale(${effect.parameters?.level || 1})`;
          } else if (effectSubtype === 'sepia') {
            styles.filter = `${styles.filter || ''} sepia(${effect.parameters?.level || 1})`;
          } else if (effectSubtype === 'hue-rotate') {
            styles.filter = `${styles.filter || ''} hue-rotate(${effect.parameters?.degrees || 0}deg)`;
          } else if (effectSubtype === 'saturate') {
            styles.filter = `${styles.filter || ''} saturate(${effect.parameters?.level || 1})`;
          }
          break;
        
        case 'custom':
          // Cambiado de 'transform' a 'custom' para cumplir con la interfaz VisualEffect
          if (effectSubtype === 'rotate') {
            styles.transform = `${styles.transform || ''} rotate(${effect.parameters?.degree || 0}deg)`;
          } else if (effectSubtype === 'scale') {
            styles.transform = `${styles.transform || ''} scale(${effect.parameters?.scale || 1})`;
          }
          break;
        
        // Otros tipos de efectos podrían implementarse aquí
      }
    });
    
    return styles;
  };
  
  // Renderizar overlay de texto
  const renderTextOverlays = () => {
    if (!showEffectsOverlay || !activeEffects || activeEffects.length === 0) return null;
    
    // Filtrar efectos de tipo texto usando custom como tipo y texto como subtype
    const textEffects = activeEffects.filter(
      effect => (effect.type === 'custom' && effect.parameters?.subtype === 'text')
    );
    
    if (textEffects.length === 0) return null;
    
    return (
      <>
        {textEffects.map(effect => {
          if (!effect.parameters) return null;
          
          const position = effect.parameters.position || 'center';
          
          let positionStyle: React.CSSProperties = {};
          
          switch (position) {
            case 'top':
              positionStyle = { top: '10%', left: '50%', transform: 'translateX(-50%)' };
              break;
            case 'bottom':
              positionStyle = { bottom: '10%', left: '50%', transform: 'translateX(-50%)' };
              break;
            case 'left':
              positionStyle = { left: '10%', top: '50%', transform: 'translateY(-50%)' };
              break;
            case 'right':
              positionStyle = { right: '10%', top: '50%', transform: 'translateY(-50%)' };
              break;
            case 'top-left':
              positionStyle = { top: '10%', left: '10%' };
              break;
            case 'top-right':
              positionStyle = { top: '10%', right: '10%' };
              break;
            case 'bottom-left':
              positionStyle = { bottom: '10%', left: '10%' };
              break;
            case 'bottom-right':
              positionStyle = { bottom: '10%', right: '10%' };
              break;
            default: // center
              positionStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
          }
          
          return (
            <div
              key={effect.id}
              className="absolute z-20 text-center"
              style={{
                ...positionStyle,
                color: effect.parameters.color || '#ffffff',
                fontSize: `${effect.parameters.fontSize || 36}px`,
                fontWeight: effect.parameters.fontWeight || 'normal',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.7)'
              }}
            >
              {effect.parameters.text || ''}
            </div>
          );
        })}
      </>
    );
  };
  
  // Renderizar overlays de color o gradiente
  const renderColorOverlays = () => {
    if (!showEffectsOverlay || !activeEffects || activeEffects.length === 0) return null;
    
    // Filtrar efectos de tipo overlay
    const overlayEffects = activeEffects.filter(
      effect => effect.type === 'overlay'
    );
    
    if (overlayEffects.length === 0) return null;
    
    return (
      <>
        {overlayEffects.map(effect => {
          if (!effect.parameters) return null;
          
          // Usar parameters.subtype para determinar el tipo de overlay
          const overlayType = effect.parameters.subtype as string;
          
          if (overlayType === 'color') {
            return (
              <div
                key={effect.id}
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  backgroundColor: effect.parameters.color || 'rgba(0, 0, 0, 0.5)',
                  opacity: effect.parameters.opacity || 0.5
                }}
              />
            );
          } else if (overlayType === 'gradient') {
            return (
              <div
                key={effect.id}
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: `linear-gradient(${effect.parameters.direction || 'to right'}, ${effect.parameters.startColor || '#000000'}, ${effect.parameters.endColor || '#ffffff'})`,
                  opacity: effect.parameters.opacity || 0.5
                }}
              />
            );
          } else if (overlayType === 'image' && effect.parameters.url) {
            return (
              <div
                key={effect.id}
                className="absolute inset-0 z-10 pointer-events-none bg-cover bg-center"
                style={{
                  backgroundImage: `url(${effect.parameters.url})`,
                  opacity: effect.parameters.opacity || 0.7
                }}
              />
            );
          }
          
          return null;
        })}
      </>
    );
  };
  
  return (
    <Card className="w-full bg-black border-0 rounded-xl overflow-hidden shadow-xl">
      <CardHeader className="pb-2 bg-zinc-950 border-b border-zinc-800">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg md:text-xl flex items-center text-white">
            <FileVideo className="h-4 w-4 md:h-5 md:w-5 mr-1.5 md:mr-2 text-orange-400" />
            Vista Previa
          </CardTitle>
          
          <div className="flex items-center space-x-1 md:space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEffectsOverlay(!showEffectsOverlay)}
              className={cn(
                "h-7 md:h-8 px-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs md:text-sm",
                showEffectsOverlay && "bg-zinc-700 text-orange-400"
              )}
            >
              <Info className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
              <span className="hidden md:inline">Efectos</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-7 md:h-8 px-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs md:text-sm"
            >
              <Settings className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1" />
              <span className="hidden md:inline">Ajustes</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative bg-black aspect-video"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          onMouseMove={() => {
            setShowControls(true);
            if (isPlaying) {
              if (controlsTimeoutRef.current !== null) {
                window.clearTimeout(controlsTimeoutRef.current);
              }
              
              controlsTimeoutRef.current = window.setTimeout(() => {
                setShowControls(false);
              }, 3000);
            }
          }}
        >
          {/* Video */}
          {videoSrc ? (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              style={applyVisualEffects()}
              poster="/placeholder-video.jpg"
              onClick={handlePlayPause}
              onWaiting={() => setIsLoading(true)}
              onPlaying={() => setIsLoading(false)}
            >
              <source src={videoSrc} type="video/mp4" />
              Tu navegador no soporta el tag de video.
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <FileVideo className="h-16 w-16 mx-auto text-gray-400" />
                <p className="mt-2 text-gray-500">No hay video cargado</p>
                <p className="text-sm text-gray-400">Carga un video para previsualizarlo</p>
              </div>
            </div>
          )}
          
          {/* Color overlays y efectos */}
          {renderColorOverlays()}
          
          {/* Text overlays */}
          {renderTextOverlays()}
          
          {/* Indicador de carga */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 z-30">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
          
          {/* Controles de reproducción - Estilo CapCut para móvil */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {/* Barra de progreso - Optimizada para toque */}
            <div
              className="w-full h-2.5 bg-zinc-700 rounded-full mb-2 md:mb-3 cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="h-full bg-orange-500 rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="w-4 h-4 bg-white rounded-full absolute -right-2 -top-0.75 shadow-md touch-manipulation"></div>
              </div>
            </div>
            
            {/* Controles principales */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-1 md:space-x-2">
                {/* Botón de reproducción con estilo CapCut - naranja destacado */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPause}
                  className="h-10 w-10 md:h-12 md:w-12 p-0 text-white bg-orange-600 rounded-full flex items-center justify-center shadow-md"
                >
                  {isPlaying ? (
                    <PauseCircle className="h-6 w-6 md:h-7 md:w-7 text-white" />
                  ) : (
                    <PlayCircle className="h-6 w-6 md:h-7 md:w-7 text-white" />
                  )}
                </Button>
                
                <div className="flex flex-col items-start ml-2">
                  {/* Controles de tiempo en formato CapCut móvil */}
                  <div className="flex items-center mb-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (onSeek) {
                          onSeek(Math.max(0, currentTime - 5));
                        }
                      }}
                      className="h-6 w-6 p-0 text-gray-300 hover:text-white"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (onSeek) {
                          onSeek(Math.min(duration, currentTime + 5));
                        }
                      }}
                      className="h-6 w-6 p-0 text-gray-300 hover:text-white"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  {/* Indicador de tiempo estilo CapCut */}
                  <span className="text-gray-300 text-xs md:text-sm font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 relative group">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                    className="h-8 w-8 p-0 text-white hover:bg-white/20"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <div className="hidden group-hover:block absolute bottom-full left-0 p-2 bg-gray-900 rounded-md -ml-8">
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={([newVolume]) => {
                        setVolume(newVolume);
                        if (newVolume > 0 && isMuted) {
                          setIsMuted(false);
                        }
                      }}
                      className="w-24 h-[6px]"
                    />
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleFullscreen}
                  className="h-8 w-8 p-0 text-white hover:bg-white/20"
                >
                  {isFullscreen ? (
                    <Minimize className="h-4 w-4" />
                  ) : (
                    <Maximize className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Panel de efectos activos - Estilo CapCut */}
        {activeEffects.length > 0 && showEffectsOverlay && (
          <div className="p-3 bg-zinc-900 border-t border-zinc-800">
            <h3 className="text-sm font-medium mb-2 text-white flex items-center">
              <Info className="h-4 w-4 mr-1 text-orange-400" />
              Efectos activos ({activeEffects.length})
            </h3>
            
            <div className="flex flex-wrap gap-2">
              {activeEffects.map(effect => (
                <div
                  key={effect.id}
                  className={cn(
                    "flex items-center space-x-1 p-1.5 rounded-md border text-xs",
                    "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 transition-colors"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={true} // Por defecto, todos los efectos están activos según la definición de tipo
                    onChange={(e) => handleToggleEffect(effect.id, e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-orange-500"
                  />
                  <span className="capitalize">
                    {effect.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Panel de ajustes - Estilo CapCut */}
        {showSettings && (
          <div className="p-3 bg-zinc-900 border-t border-zinc-800">
            <h3 className="text-sm font-medium mb-2 text-white flex items-center">
              <Settings className="h-4 w-4 mr-1 text-blue-400" />
              Ajustes de video
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 p-2 rounded-lg">
                <h4 className="text-xs text-gray-300 mb-1">Calidad</h4>
                <div className="flex space-x-2">
                  <Button
                    variant={videoQuality === 'auto' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setVideoQuality('auto')}
                    className={cn(
                      "h-7 text-xs",
                      videoQuality === 'auto' 
                        ? "bg-orange-600 hover:bg-orange-700 text-white" 
                        : "bg-zinc-700 text-gray-200 hover:text-white"
                    )}
                  >
                    Auto
                  </Button>
                  <Button
                    variant={videoQuality === '720p' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setVideoQuality('720p')}
                    className={cn(
                      "h-7 text-xs",
                      videoQuality === '720p' 
                        ? "bg-orange-600 hover:bg-orange-700 text-white" 
                        : "bg-zinc-700 text-gray-200 hover:text-white"
                    )}
                  >
                    720p
                  </Button>
                  <Button
                    variant={videoQuality === '1080p' ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setVideoQuality('1080p')}
                    className={cn(
                      "h-7 text-xs",
                      videoQuality === '1080p' 
                        ? "bg-orange-600 hover:bg-orange-700 text-white" 
                        : "bg-zinc-700 text-gray-200 hover:text-white"
                    )}
                  >
                    1080p
                  </Button>
                </div>
              </div>
              
              <div className="bg-zinc-800 p-2 rounded-lg">
                <h4 className="text-xs text-gray-300 mb-1">Acciones</h4>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs bg-zinc-700 text-gray-200 hover:text-white hover:bg-zinc-600"
                  >
                    <DownloadCloud className="h-3 w-3 mr-1 text-blue-400" /> Descargar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs bg-zinc-700 text-gray-200 hover:text-white hover:bg-zinc-600"
                  >
                    <Share2 className="h-3 w-3 mr-1 text-green-400" /> Compartir
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <div>
            Tiempo actual: {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          <div>
            Efectos activos: {activeEffects.length}/{activeEffects.length}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default VideoPreviewPanel;