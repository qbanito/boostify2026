import React, { useState, useRef, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '../ui/card';
import { Button } from '../ui/button';
import { 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Film, 
  AudioLines, 
  Type, 
  Sparkles,
  Play,
  Pause,
  Clock
} from 'lucide-react';

// Interface para clips simplificada para la demostración
interface SimpleClip {
  id: number;
  title: string;
  layer: number; // 0=audio, 1=video/imagen, 2=texto, 3=efectos
  color: string;
  startTime: number; // tiempo de inicio en segundos
  duration: number; // duración en segundos
  content?: string; // URL de imagen/video para mostrar
}

export function LayerFilterDemo() {
  // Estado para las capas visibles y bloqueadas
  const [visibleLayers, setVisibleLayers] = useState<number[]>([0, 1, 2, 3]);
  const [lockedLayers, setLockedLayers] = useState<number[]>([]);
  
  // Estado para la reproducción
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animationRef = useRef<number>();
  const TOTAL_DURATION = 30; // duración total en segundos
  const PIXELS_PER_SECOND = 50; // escala de visualización
  
  // Estado para el clip seleccionado
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  
  // Clips de prueba
  const sampleClips: SimpleClip[] = [
    { id: 1, title: 'Pista de audio principal', layer: 0, color: 'bg-blue-500', startTime: 0, duration: 30, content: '/path/to/audio.mp3' },
    { id: 2, title: 'Efecto de sonido', layer: 0, color: 'bg-blue-400', startTime: 5, duration: 3, content: '/path/to/effect.mp3' },
    { id: 3, title: 'Video de fondo', layer: 1, color: 'bg-purple-500', startTime: 0, duration: 15, content: '/path/to/video.mp4' },
    { id: 4, title: 'Imagen superpuesta', layer: 1, color: 'bg-purple-400', startTime: 15, duration: 15, content: '/path/to/image.jpg' },
    { id: 5, title: 'Título principal', layer: 2, color: 'bg-amber-500', startTime: 2, duration: 8, content: 'Título del video' },
    { id: 6, title: 'Subtítulos', layer: 2, color: 'bg-amber-400', startTime: 12, duration: 10, content: 'Subtítulos de ejemplo' },
    { id: 7, title: 'Efecto de brillo', layer: 3, color: 'bg-pink-500', startTime: 7, duration: 5, content: 'shine-effect' },
    { id: 8, title: 'Transición', layer: 3, color: 'bg-pink-400', startTime: 15, duration: 2, content: 'fade-transition' },
  ];
  
  // Filtrar clips por capas visibles
  const visibleClips = sampleClips.filter(clip => visibleLayers.includes(clip.layer));
  
  // Función para cambiar visibilidad de capa
  const toggleLayerVisibility = (layer: number) => {
    if (visibleLayers.includes(layer)) {
      setVisibleLayers(visibleLayers.filter(l => l !== layer));
    } else {
      setVisibleLayers([...visibleLayers, layer]);
    }
  };
  
  // Función para iniciar/pausar la reproducción
  const togglePlayback = () => {
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
  };
  
  // Iniciar reproducción 
  const startPlayback = () => {
    setIsPlaying(true);
    // Iniciar el loop de animación
    animationRef.current = requestAnimationFrame(updatePlayhead);
  };
  
  // Pausar reproducción
  const pausePlayback = () => {
    setIsPlaying(false);
    // Detener el loop de animación
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };
  
  // Reiniciar reproducción
  const resetPlayback = () => {
    setCurrentTime(0);
    pausePlayback();
  };
  
  // Actualizar el playhead (cabezal de reproducción)
  const updatePlayhead = () => {
    setCurrentTime(prevTime => {
      const newTime = prevTime + 0.05; // Avanzar 50ms
      
      // Si hemos llegado al final, reiniciar
      if (newTime >= TOTAL_DURATION) {
        pausePlayback();
        return 0;
      }
      
      // Continuar la animación
      animationRef.current = requestAnimationFrame(updatePlayhead);
      return newTime;
    });
  };
  
  // Filtrar clips visibles en el momento actual
  const activeClips = visibleClips.filter(clip => 
    currentTime >= clip.startTime && currentTime < (clip.startTime + clip.duration)
  );
  
  // Función para cambiar bloqueo de capa
  const toggleLayerLock = (layer: number) => {
    if (lockedLayers.includes(layer)) {
      setLockedLayers(lockedLayers.filter(l => l !== layer));
    } else {
      setLockedLayers([...lockedLayers, layer]);
    }
  };
  
  // Mapeo de iconos por tipo de capa
  const layerIcons = {
    0: <AudioLines className="h-5 w-5 text-blue-600 dark:text-blue-300" />,
    1: <Film className="h-5 w-5 text-purple-600 dark:text-purple-300" />,
    2: <Type className="h-5 w-5 text-amber-600 dark:text-amber-300" />,
    3: <Sparkles className="h-5 w-5 text-pink-600 dark:text-pink-300" />,
  };
  
  // Nombres de las capas
  const layerNames = {
    0: 'Audio',
    1: 'Video/Imagen',
    2: 'Texto',
    3: 'Efectos',
  };
  
  // Función para formatear el tiempo en formato MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Demostración de Filtrado de Capas</CardTitle>
          <CardDescription>Activa/desactiva la visibilidad de las capas para ver el efecto en los clips</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Controles de capas */}
            {[0, 1, 2, 3].map(layer => (
              <div key={layer} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                    {layerIcons[layer as keyof typeof layerIcons]}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">Capa de {layerNames[layer as keyof typeof layerNames]}</h4>
                    <p className="text-xs text-muted-foreground">
                      {visibleLayers.includes(layer) ? 'Visible' : 'Oculta'} · 
                      {lockedLayers.includes(layer) ? ' Bloqueada' : ' Desbloqueada'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className={visibleLayers.includes(layer) ? "bg-primary/10" : ""}
                    onClick={() => toggleLayerVisibility(layer)}
                  >
                    {visibleLayers.includes(layer) ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={lockedLayers.includes(layer) ? "bg-primary/10" : ""}
                    onClick={() => toggleLayerLock(layer)}
                  >
                    {lockedLayers.includes(layer) ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Controles de reproducción */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Reproductor</h3>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={togglePlayback}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={resetPlayback}
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm font-medium">
                  {formatTime(currentTime)} / {formatTime(TOTAL_DURATION)}
                </div>
              </div>
              
              {/* Línea de tiempo y playhead */}
              <div 
                className="relative h-16 bg-background rounded-md mb-2 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickPos = e.clientX - rect.left;
                  const percentage = clickPos / rect.width;
                  const newTime = percentage * TOTAL_DURATION;
                  setCurrentTime(Math.max(0, Math.min(newTime, TOTAL_DURATION)));
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-full">
                  {/* Regla de tiempo - marcas cada 5 segundos */}
                  {Array.from({ length: Math.floor(TOTAL_DURATION / 5) + 1 }).map((_, index) => (
                    <div 
                      key={`mark-${index}`}
                      className="absolute h-full w-[1px] bg-gray-200 opacity-50"
                      style={{
                        left: `${(index * 5 / TOTAL_DURATION) * 100}%`,
                      }}
                    />
                  ))}
                  
                  {/* Clips en la línea de tiempo */}
                  {visibleClips.map(clip => (
                    <div 
                      key={clip.id}
                      className={`absolute ${clip.color} h-[14px] rounded cursor-pointer ${selectedClipId === clip.id ? 'ring-2 ring-white ring-offset-2' : ''}`}
                      style={{
                        left: `${(clip.startTime / TOTAL_DURATION) * 100}%`,
                        width: `${(clip.duration / TOTAL_DURATION) * 100}%`,
                        top: `${clip.layer * 20 + 5}px`,
                      }}
                      title={`${clip.title} (${formatTime(clip.startTime)} - ${formatTime(clip.startTime + clip.duration)})`}
                      onClick={(e) => {
                        e.stopPropagation(); // Evitar que se propague al fondo y mueva el playhead
                        setSelectedClipId(clip.id);
                        // Opcionalmente, saltar al inicio del clip
                        // setCurrentTime(clip.startTime);
                      }}
                    />
                  ))}
                  
                  {/* Playhead (cabezal de reproducción) */}
                  <div 
                    className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10"
                    style={{
                      left: `${(currentTime / TOTAL_DURATION) * 100}%`,
                    }}
                  />
                  
                  {/* Indicador de tiempo actual en el playhead */}
                  <div 
                    className="absolute top-[-20px] z-10 bg-red-500 text-white text-xs px-1 py-0.5 rounded transform -translate-x-1/2"
                    style={{
                      left: `${(currentTime / TOTAL_DURATION) * 100}%`,
                    }}
                  >
                    {formatTime(currentTime)}
                  </div>
                </div>
              </div>
              
              {/* Marcadores de tiempo */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>00:00</span>
                <span>00:10</span>
                <span>00:20</span>
                <span>00:30</span>
              </div>
            </div>
          </div>
          
          {/* Panel de edición para el clip seleccionado */}
          {selectedClipId !== null && (
            <div className="mb-6 bg-muted p-4 rounded-lg border-2 border-primary">
              <h3 className="text-lg font-medium mb-3">Clip Seleccionado</h3>
              {(() => {
                const selectedClip = sampleClips.find(clip => clip.id === selectedClipId);
                if (!selectedClip) return <p>No se encontró el clip seleccionado</p>;
                
                return (
                  <div className="space-y-4">
                    <div className={`${selectedClip.color} p-4 rounded-lg text-white`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {layerIcons[selectedClip.layer as keyof typeof layerIcons]}
                          <span className="font-medium">{selectedClip.title}</span>
                        </div>
                        <span className="text-xs bg-black/20 px-2 py-1 rounded">
                          ID: {selectedClip.id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <div>
                          <p className="opacity-80">Tiempo Inicio:</p>
                          <p className="font-bold">{formatTime(selectedClip.startTime)}</p>
                        </div>
                        <div>
                          <p className="opacity-80">Duración:</p>
                          <p className="font-bold">{formatTime(selectedClip.duration)}</p>
                        </div>
                        <div>
                          <p className="opacity-80">Tiempo Final:</p>
                          <p className="font-bold">{formatTime(selectedClip.startTime + selectedClip.duration)}</p>
                        </div>
                        <div>
                          <p className="opacity-80">Capa:</p>
                          <p className="font-bold">{layerNames[selectedClip.layer as keyof typeof layerNames]}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Controles de tiempo y duración */}
                    <div className="grid grid-cols-2 gap-4 my-4">
                      <div>
                        <label htmlFor="startTime" className="text-sm font-medium mb-1 block">
                          Tiempo de inicio
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            id="startTime"
                            type="range" 
                            min={0} 
                            max={TOTAL_DURATION - selectedClip.duration} 
                            step={0.1}
                            value={selectedClip.startTime}
                            className="w-full accent-primary"
                            onChange={(e) => {
                              // Modificar el clip seleccionado
                              const newTime = parseFloat(e.target.value);
                              // Esta implementación solo muestra la interacción
                              // En la versión real, modificaría el arreglo de clips
                              setCurrentTime(newTime);
                            }}
                          />
                          <span className="text-xs">{formatTime(selectedClip.startTime)}</span>
                        </div>
                      </div>
                      <div>
                        <label htmlFor="duration" className="text-sm font-medium mb-1 block">
                          Duración
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            id="duration"
                            type="range" 
                            min={0.5} 
                            max={Math.min(30, TOTAL_DURATION - selectedClip.startTime)} 
                            step={0.1}
                            value={selectedClip.duration}
                            className="w-full accent-primary"
                            onChange={(e) => {
                              // Modificar la duración del clip seleccionado
                              // Esta implementación solo muestra la interacción
                              const newDuration = parseFloat(e.target.value);
                              logger.info(`Duración cambiada a: ${newDuration}s`);
                            }}
                          />
                          <span className="text-xs">{formatTime(selectedClip.duration)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Acciones del clip */}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        className="flex items-center gap-1"
                        onClick={() => {
                          setCurrentTime(selectedClip.startTime);
                        }}
                      >
                        <Play className="h-4 w-4" />
                        Ir al inicio
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex items-center gap-1"
                        onClick={() => {
                          // En la implementación completa, esto eliminaría el clip del arreglo
                          setSelectedClipId(null);
                          logger.info(`Eliminar clip: ${selectedClip.id}`);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                        Eliminar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="flex items-center gap-1"
                        onClick={() => {
                          // Deseleccionar el clip
                          setSelectedClipId(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                        Cerrar
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Lista de clips activos */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Clips Activos en Tiempo Actual ({activeClips.length})</h3>
            <div className="space-y-2">
              {activeClips.map(clip => (
                <div 
                  key={clip.id} 
                  className={`${clip.color} p-3 rounded-lg text-white flex items-center justify-between cursor-pointer ${selectedClipId === clip.id ? 'ring-2 ring-white' : ''}`}
                  onClick={() => setSelectedClipId(clip.id)}
                >
                  <div className="flex items-center gap-2">
                    {layerIcons[clip.layer as keyof typeof layerIcons]}
                    <span>{clip.title}</span>
                  </div>
                  <span className="text-xs bg-black/20 px-2 py-1 rounded">
                    Tiempo: {formatTime(clip.startTime)} - {formatTime(clip.startTime + clip.duration)}
                  </span>
                </div>
              ))}
              
              {activeClips.length === 0 && (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p>No hay clips activos en el tiempo actual: {formatTime(currentTime)}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Lista de clips visibles */}
          <div>
            <h3 className="text-lg font-medium mb-3">Todos los Clips Visibles ({visibleClips.length} de {sampleClips.length})</h3>
            <div className="space-y-2">
              {visibleClips.map(clip => (
                <div 
                  key={clip.id} 
                  className={`${clip.color} p-3 rounded-lg text-white flex items-center justify-between`}
                >
                  <div className="flex items-center gap-2">
                    {layerIcons[clip.layer as keyof typeof layerIcons]}
                    <span>{clip.title}</span>
                  </div>
                  <span className="text-xs bg-black/20 px-2 py-1 rounded">
                    Tiempo: {formatTime(clip.startTime)} - {formatTime(clip.startTime + clip.duration)}
                  </span>
                </div>
              ))}
              
              {visibleClips.length === 0 && (
                <div className="bg-muted p-4 rounded-lg text-center">
                  <p>No hay clips visibles. Activa alguna capa para ver sus clips.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => setVisibleLayers([0, 1, 2, 3])}
          >
            Mostrar Todas
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setVisibleLayers([])}
          >
            Ocultar Todas
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}