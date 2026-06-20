import React, { useState, useEffect, useRef } from 'react';
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
  Label
} from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import {
  Slider
} from '../ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../ui/tooltip';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui/tabs';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu';
import {
  Music,
  Play,
  Pause,
  Upload,
  Download,
  Wand,
  Clock,
  BarChart4,
  FileAudio,
  RefreshCw,
  PlusCircle,
  Edit,
  Trash,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Share,
  Loader2,
  Music2 as Metronome // Usando Music2 como reemplazo de Metronome
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Beat, Section } from '../../lib/professional-editor-types';
import { v4 as uuidv4 } from 'uuid';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface BeatAnalyzerProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  onAddBeat?: (beat: Omit<Beat, 'id'>) => void;
  onUpdateBeat?: (id: string, updates: Partial<Beat>) => void;
  onDeleteBeat?: (id: string) => void;
  onAddSection?: (section: Omit<Section, 'id'>) => void;
  onUpdateSection?: (id: string, updates: Partial<Section>) => void;
  onDeleteSection?: (id: string) => void;
  beats: Beat[];
  sections: Section[];
  audioSrc?: string;
  projectId?: string;
}

// Paleta de colores para las secciones
const sectionColors = {
  intro: '#3b82f6',    // blue-500
  verse: '#ef4444',    // red-500
  chorus: '#f59e0b',   // amber-500
  bridge: '#8b5cf6',   // violet-500
  outro: '#10b981',    // emerald-500
  breakdown: '#ec4899', // pink-500
  custom: '#6b7280'    // gray-500
};

const BeatAnalyzer: React.FC<BeatAnalyzerProps> = ({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onAddBeat,
  onUpdateBeat,
  onDeleteBeat,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  beats = [],
  sections = [],
  audioSrc,
  projectId
}) => {
  // Estados
  const [activeTab, setActiveTab] = useState<string>('visual');
  const [visualizationMode, setVisualizationMode] = useState<'timeline' | 'grid'>('timeline');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [detectedBPM, setDetectedBPM] = useState<number | null>(null);
  const [manualBPM, setManualBPM] = useState<number>(120);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState<boolean>(false);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showBeatMarkersOnly, setShowBeatMarkersOnly] = useState<boolean>(false);
  const [tempSection, setTempSection] = useState<Omit<Section, 'id'>>({
    name: '',
    startTime: currentTime,
    endTime: currentTime + 10,
    type: 'verse',
    color: sectionColors.verse
  });
  
  // Referencias
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Inicializar elemento de audio
  useEffect(() => {
    if (audioSrc && !audioRef.current) {
      audioRef.current = new Audio(audioSrc);
    } else if (audioSrc && audioRef.current) {
      audioRef.current.src = audioSrc;
    }
  }, [audioSrc]);
  
  // Formatear tiempo (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Convertir tiempo a posición en la línea de tiempo
  const timeToPosition = (time: number): number => {
    return (time / duration) * 100;
  };
  
  // Convertir posición a tiempo
  const positionToTime = (position: number, width: number): number => {
    return (position / width) * duration;
  };
  
  // Manejar clic en la línea de tiempo
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !onSeek) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = offsetX / rect.width;
    
    onSeek(percentage * duration);
  };
  
  // Analizar beats automáticamente
  const analyzeBeats = async () => {
    if (!audioSrc) {
      alert('Se necesita un archivo de audio para el análisis');
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    try {
      // Simular análisis de beats
      const simulateAnalysis = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 5;
          setAnalysisProgress(Math.min(99, progress));
          
          if (progress >= 99) {
            clearInterval(interval);
            
            // Generar beats aleatorios como simulación
            const bpm = Math.floor(Math.random() * 40) + 100; // BPM entre 100 y 140
            setDetectedBPM(bpm);
            setManualBPM(bpm);
            
            const beatInterval = 60 / bpm;
            const generatedBeats: Omit<Beat, 'id'>[] = [];
            
            // Crear un beat para cada pulso
            for (let time = 0; time < duration; time += beatInterval) {
              const beatStrength = Math.random();
              const isMeasureStart = Math.floor(time / beatInterval) % 4 === 0;
              
              generatedBeats.push({
                time,
                type: isMeasureStart ? 'bar' : 'beat',
                intensity: isMeasureStart ? 0.8 + (Math.random() * 0.2) : 0.3 + (Math.random() * 0.5),
                label: isMeasureStart ? 'Compás' : undefined,
                bpm
              });
            }
            
            // Añadir los beats al estado
            if (onAddBeat) {
              // Eliminar beats existentes si los hay
              beats.forEach(beat => {
                if (onDeleteBeat) {
                  onDeleteBeat(beat.id);
                }
              });
              
              // Añadir nuevos beats
              generatedBeats.forEach(beat => {
                onAddBeat(beat);
              });
            }
            
            // Generar secciones automáticas basadas en la estructura típica de una canción
            if (onAddSection) {
              // Eliminar secciones existentes si las hay
              sections.forEach(section => {
                if (onDeleteSection) {
                  onDeleteSection(section.id);
                }
              });
              
              // Estructura típica: Intro, Verso, Estribillo, Verso, Estribillo, Puente, Estribillo, Outro
              const sectionDuration = duration / 8;
              
              const autoSections: Omit<Section, 'id'>[] = [
                {
                  name: 'Introducción',
                  startTime: 0,
                  endTime: sectionDuration,
                  type: 'intro',
                  color: sectionColors.intro
                },
                {
                  name: 'Verso 1',
                  startTime: sectionDuration,
                  endTime: sectionDuration * 2,
                  type: 'verse',
                  color: sectionColors.verse
                },
                {
                  name: 'Estribillo 1',
                  startTime: sectionDuration * 2,
                  endTime: sectionDuration * 3,
                  type: 'chorus',
                  color: sectionColors.chorus
                },
                {
                  name: 'Verso 2',
                  startTime: sectionDuration * 3,
                  endTime: sectionDuration * 4,
                  type: 'verse',
                  color: sectionColors.verse
                },
                {
                  name: 'Estribillo 2',
                  startTime: sectionDuration * 4,
                  endTime: sectionDuration * 5,
                  type: 'chorus',
                  color: sectionColors.chorus
                },
                {
                  name: 'Puente',
                  startTime: sectionDuration * 5,
                  endTime: sectionDuration * 6,
                  type: 'bridge',
                  color: sectionColors.bridge
                },
                {
                  name: 'Estribillo 3',
                  startTime: sectionDuration * 6,
                  endTime: sectionDuration * 7,
                  type: 'chorus',
                  color: sectionColors.chorus
                },
                {
                  name: 'Outro',
                  startTime: sectionDuration * 7,
                  endTime: duration,
                  type: 'outro',
                  color: sectionColors.outro
                }
              ];
              
              // Añadir secciones
              autoSections.forEach(section => {
                onAddSection(section);
              });
            }
            
            setAnalysisProgress(100);
            setTimeout(() => {
              setIsAnalyzing(false);
            }, 500);
          }
        }, 100);
      };
      
      simulateAnalysis();
    } catch (error) {
      console.error('Error al analizar beats:', error);
      setIsAnalyzing(false);
    }
  };
  
  // Generar beats manualmente basados en BPM
  const generateBeatsFromBPM = () => {
    if (!onAddBeat) return;
    
    // Limpiar beats existentes
    beats.forEach(beat => {
      if (onDeleteBeat) {
        onDeleteBeat(beat.id);
      }
    });
    
    // Generar nuevos beats basados en el BPM manual
    const beatInterval = 60 / manualBPM;
    const beatsCount = Math.floor(duration / beatInterval);
    
    for (let i = 0; i < beatsCount; i++) {
      const time = i * beatInterval;
      const isMeasureStart = i % 4 === 0;
      
      const newBeat: Omit<Beat, 'id'> = {
        time,
        type: isMeasureStart ? 'bar' : 'beat',
        intensity: isMeasureStart ? 0.8 : 0.5,
        label: isMeasureStart ? 'Compás' : undefined,
        bpm: manualBPM
      };
      
      onAddBeat(newBeat);
    }
  };
  
  // Añadir sección
  const handleAddSection = async () => {
    if (!onAddSection) return;
    
    // Validar tiempos
    if (tempSection.startTime >= tempSection.endTime) {
      alert('El tiempo de inicio debe ser menor que el tiempo de fin');
      return;
    }
    
    setIsSaving(true);
    
    // Crear nueva sección
    onAddSection(tempSection);
    
    // Guardar en Firestore si hay projectId
    if (projectId) {
      try {
        const sectionId = uuidv4();
        const sectionRef = doc(db, `projects/${projectId}/sections/${sectionId}`);
        await setDoc(sectionRef, {
          ...tempSection,
          createdAt: new Date()
        });
      } catch (error) {
        console.error('Error al guardar sección:', error);
      }
    }
    
    // Reiniciar formulario
    setTempSection({
      name: '',
      startTime: currentTime,
      endTime: currentTime + 10,
      type: 'verse',
      color: sectionColors.verse
    });
    
    setShowAddSectionDialog(false);
    setIsSaving(false);
  };
  
  // Actualizar sección
  const handleUpdateSection = async (id: string, updates: Partial<Section>) => {
    if (!onUpdateSection) return;
    
    setIsSaving(true);
    
    // Actualizar sección en el estado
    onUpdateSection(id, updates);
    
    // Actualizar en Firestore si hay projectId
    if (projectId) {
      try {
        const sectionRef = doc(db, `projects/${projectId}/sections/${id}`);
        await updateDoc(sectionRef, {
          ...updates,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Error al actualizar sección:', error);
      }
    }
    
    setIsSaving(false);
  };
  
  // Eliminar sección
  const handleDeleteSection = async (id: string) => {
    if (!onDeleteSection) return;
    
    setIsSaving(true);
    
    // Eliminar sección del estado
    onDeleteSection(id);
    
    // Eliminar de Firestore si hay projectId
    if (projectId) {
      try {
        const sectionRef = doc(db, `projects/${projectId}/sections/${id}`);
        await deleteDoc(sectionRef);
      } catch (error) {
        console.error('Error al eliminar sección:', error);
      }
    }
    
    // Limpiar selección si era la sección seleccionada
    if (selectedSectionId === id) {
      setSelectedSectionId(null);
    }
    
    setIsSaving(false);
  };
  
  // Cuando cambie el tipo de sección, actualizar también el color
  useEffect(() => {
    if (tempSection.type) {
      setTempSection(prev => ({
        ...prev,
        color: sectionColors[prev.type] || sectionColors.custom
      }));
    }
  }, [tempSection.type]);
  
  // Obtener el beat activo en el tiempo actual
  const getCurrentBeat = (): Beat | null => {
    // Ordenar beats por tiempo
    const sortedBeats = [...beats].sort((a, b) => a.time - b.time);
    
    // Encontrar el último beat antes del tiempo actual o el primero después
    let closestBeat: Beat | null = null;
    let minDistance = Infinity;
    
    for (const beat of sortedBeats) {
      const distance = Math.abs(beat.time - currentTime);
      if (distance < minDistance) {
        minDistance = distance;
        closestBeat = beat;
      }
    }
    
    // Solo considerar un beat como activo si está a menos de 0.2 segundos
    return minDistance <= 0.2 ? closestBeat : null;
  };
  
  // Obtener la sección activa en el tiempo actual
  const getCurrentSection = (): Section | null => {
    return sections.find(
      section => currentTime >= section.startTime && currentTime < section.endTime
    ) || null;
  };
  
  // Renderizar marcadores de tiempo
  const renderTimeMarkers = () => {
    // Mostrar 10 marcadores
    const markers = [];
    const step = duration / 10;
    
    for (let i = 0; i <= 10; i++) {
      const time = i * step;
      const position = timeToPosition(time);
      
      markers.push(
        <div
          key={`marker-${i}`}
          className="absolute top-0 text-xs text-gray-500"
          style={{ left: `${position}%` }}
        >
          <div className="h-2 border-l border-gray-300 dark:border-gray-700"></div>
          <div className="mt-1">{formatTime(time)}</div>
        </div>
      );
    }
    
    return markers;
  };
  
  // Renderizar línea de tiempo con beats y secciones
  const renderTimeline = () => {
    return (
      <div className="relative h-[200px] border rounded-md overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-6 flex px-4 border-b">
          {renderTimeMarkers()}
        </div>
        
        <div
          ref={timelineRef}
          className="absolute top-6 bottom-0 left-0 right-0 cursor-pointer"
          onClick={handleTimelineClick}
        >
          {/* Secciones */}
          <div className="absolute top-0 h-12 w-full">
            {!showBeatMarkersOnly && sections.map(section => (
              <div
                key={section.id}
                className={cn(
                  "absolute h-full rounded-sm border-2 flex items-center px-2 cursor-pointer",
                  selectedSectionId === section.id && "ring-2 ring-white dark:ring-gray-950 ring-opacity-50"
                )}
                style={{
                  left: `${timeToPosition(section.startTime)}%`,
                  width: `${timeToPosition(section.endTime) - timeToPosition(section.startTime)}%`,
                  backgroundColor: `${section.color}90`,
                  borderColor: section.color
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSectionId(section.id);
                }}
              >
                <div className="text-xs text-white font-medium truncate">
                  {section.name || section.type}
                </div>
                
                <div className="absolute right-1 top-1 flex space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSeek) onSeek(section.startTime);
                    }}
                    className="h-5 w-5 p-0 bg-white bg-opacity-20 text-white hover:bg-opacity-30"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Beats */}
          <div className="absolute top-14 h-[calc(100%-56px)] w-full">
            {beats.map(beat => (
              <div
                key={beat.id}
                className={cn(
                  "absolute top-0 h-full",
                  selectedBeatId === beat.id && "opacity-70"
                )}
                style={{ left: `${timeToPosition(beat.time)}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBeatId(beat.id);
                  if (onSeek) onSeek(beat.time);
                }}
              >
                <div
                  className={cn(
                    "w-0.5 h-full",
                    beat.type === 'bar' ? "bg-orange-500" : "bg-orange-300"
                  )}
                ></div>
                
                <div
                  className={cn(
                    "w-3 h-3 -ml-1.5 -mt-1.5 rounded-full",
                    beat.type === 'bar' ? "bg-orange-500" : "bg-orange-300"
                  )}
                  style={{ opacity: beat.intensity }}
                ></div>
                
                {beat.type === 'bar' && (
                  <div className="absolute top-4 left-1 text-xs text-orange-500">
                    {beat.label}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Marcador de tiempo actual */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
            style={{ left: `${timeToPosition(currentTime)}%` }}
          >
            <div className="w-3 h-3 bg-blue-500 rounded-full -ml-1.5 -mt-1.5"></div>
          </div>
        </div>
      </div>
    );
  };
  
  // Renderizar en modo grid
  const renderGrid = () => {
    // Ordenar beats por tiempo
    const sortedBeats = [...beats].sort((a, b) => a.time - b.time);
    
    return (
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Tiempo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-[100px]">Intensidad</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBeats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-10 text-gray-500">
                  No hay beats detectados aún
                </TableCell>
              </TableRow>
            ) : (
              sortedBeats.map(beat => (
                <TableRow
                  key={beat.id}
                  className={cn(
                    "cursor-pointer",
                    Math.abs(beat.time - currentTime) < 0.2 && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                  onClick={() => {
                    setSelectedBeatId(beat.id);
                    if (onSeek) onSeek(beat.time);
                  }}
                >
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(beat.time);
                      }}
                      className="h-6 p-0 text-xs"
                    >
                      {formatTime(beat.time)}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full mr-2",
                          beat.type === 'bar' ? "bg-orange-500" : "bg-orange-300"
                        )}
                      ></div>
                      <span className="capitalize">
                        {beat.type === 'bar' ? 'Compás' : 'Pulso'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${beat.intensity * 100}%` }}
                      ></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSeek) onSeek(beat.time);
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteBeat) onDeleteBeat(beat.id);
                        }}
                        className="h-7 w-7 p-0 text-red-500"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  // Renderizar lista de secciones
  const renderSections = () => {
    // Ordenar secciones por tiempo de inicio
    const sortedSections = [...sections].sort((a, b) => a.startTime - b.startTime);
    
    return (
      <div className="border rounded-md overflow-hidden mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Nombre</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead className="w-[120px]">Inicio</TableHead>
              <TableHead className="w-[120px]">Fin</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                  No hay secciones definidas
                </TableCell>
              </TableRow>
            ) : (
              sortedSections.map(section => (
                <TableRow
                  key={section.id}
                  className={cn(
                    "cursor-pointer",
                    currentTime >= section.startTime && currentTime < section.endTime && "bg-orange-50 dark:bg-orange-900/20"
                  )}
                  onClick={() => setSelectedSectionId(section.id)}
                >
                  <TableCell>
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: section.color }}
                      ></div>
                      <span>{section.name || section.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {section.type}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(section.startTime);
                      }}
                      className="h-6 p-0 text-xs"
                    >
                      {formatTime(section.startTime)}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(section.endTime);
                      }}
                      className="h-6 p-0 text-xs"
                    >
                      {formatTime(section.endTime)}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSeek) onSeek(section.startTime);
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setTempSection({
                              ...section,
                              name: section.name || '',
                            });
                            setShowAddSectionDialog(true);
                          }}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteSection(section.id)}
                            className="text-red-500"
                          >
                            <Trash className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <BarChart4 className="h-5 w-5 mr-2 text-orange-500" />
            Análisis de Ritmo
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Select
              value={visualizationMode}
              onValueChange={(value: 'timeline' | 'grid') => setVisualizationMode(value)}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue placeholder="Modo de visualización" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="timeline">Línea de tiempo</SelectItem>
                <SelectItem value="grid">Vista de rejilla</SelectItem>
              </SelectContent>
            </Select>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showBeatMarkersOnly ? "outline" : "default"}
                    size="sm"
                    onClick={() => setShowBeatMarkersOnly(!showBeatMarkersOnly)}
                    className="h-8 w-8 p-0"
                  >
                    <Metronome className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showBeatMarkersOnly ? "Mostrar secciones" : "Solo mostrar beats"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddSectionDialog(true)}
              className="h-8"
            >
              <PlusCircle className="h-4 w-4 mr-1" /> Añadir sección
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start p-0 rounded-none border-b">
            <TabsTrigger value="visual" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Visualización
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Análisis
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Secciones
            </TabsTrigger>
          </TabsList>
          
          {/* Visualización */}
          <TabsContent value="visual" className="p-4">
            {visualizationMode === 'timeline' ? renderTimeline() : renderGrid()}
            
            {/* Información del beat o sección activa */}
            <div className="mt-4">
              <div className="flex justify-between">
                <div>
                  <h3 className="text-sm font-medium mb-1">Beat actual</h3>
                  {getCurrentBeat() ? (
                    <div className="text-sm">
                      <p>Tiempo: {formatTime(getCurrentBeat()!.time)}</p>
                      <p>Tipo: {getCurrentBeat()!.type === 'bar' ? 'Compás' : 'Pulso'}</p>
                      {getCurrentBeat()!.bpm && <p>BPM: {getCurrentBeat()!.bpm}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No hay beat en la posición actual</p>
                  )}
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-1">Sección actual</h3>
                  {getCurrentSection() ? (
                    <div className="text-sm">
                      <p className="font-medium">{getCurrentSection()!.name || getCurrentSection()!.type}</p>
                      <p>{formatTime(getCurrentSection()!.startTime)} - {formatTime(getCurrentSection()!.endTime)}</p>
                      <div className="flex items-center mt-1">
                        <div
                          className="w-3 h-3 rounded-full mr-1"
                          style={{ backgroundColor: getCurrentSection()!.color }}
                        ></div>
                        <span className="capitalize">{getCurrentSection()!.type}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No hay sección en la posición actual</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Análisis */}
          <TabsContent value="analysis" className="p-4">
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2">Análisis de BPM</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="detected-bpm">BPM Detectado</Label>
                    <Input
                      id="detected-bpm"
                      value={detectedBPM !== null ? detectedBPM.toString() : 'No detectado'}
                      readOnly
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Beats por minuto detectados automáticamente
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="manual-bpm">BPM Manual</Label>
                    <div className="flex mt-1">
                      <Input
                        id="manual-bpm"
                        type="number"
                        value={manualBPM}
                        onChange={(e) => setManualBPM(Math.max(30, Math.min(300, parseInt(e.target.value) || 120)))}
                        min={30}
                        max={300}
                      />
                      <Button
                        variant="outline"
                        onClick={generateBeatsFromBPM}
                        className="ml-2"
                      >
                        Aplicar
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ajusta manualmente el tempo y genera beats
                    </p>
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button
                    onClick={analyzeBeats}
                    disabled={isAnalyzing || !audioSrc}
                    className="w-full"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analizando... {Math.round(analysisProgress)}%
                      </>
                    ) : (
                      <>
                        <Wand className="h-4 w-4 mr-2" />
                        Analizar automáticamente
                      </>
                    )}
                  </Button>
                  
                  {!audioSrc && (
                    <p className="text-xs text-red-500 mt-1">
                      Se necesita un archivo de audio para el análisis
                    </p>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Información de Beats</h3>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt>Número de beats:</dt>
                        <dd className="font-medium">{beats.length}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Compases:</dt>
                        <dd className="font-medium">{beats.filter(b => b.type === 'bar').length}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Pulsos:</dt>
                        <dd className="font-medium">{beats.filter(b => b.type === 'beat').length}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>BPM promedio:</dt>
                        <dd className="font-medium">
                          {beats.length > 0 && beats[0].bpm ? beats[0].bpm : 'Desconocido'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Información de Secciones</h3>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <dl className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <dt>Número de secciones:</dt>
                        <dd className="font-medium">{sections.length}</dd>
                      </div>
                      {Object.keys(sectionColors).map(type => {
                        const count = sections.filter(s => s.type === type).length;
                        if (count === 0) return null;
                        return (
                          <div key={type} className="flex justify-between">
                            <dt className="flex items-center">
                              <div
                                className="w-2 h-2 rounded-full mr-1"
                                style={{ backgroundColor: sectionColors[type] }}
                              ></div>
                              <span className="capitalize">{type}:</span>
                            </dt>
                            <dd className="font-medium">{count}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Secciones */}
          <TabsContent value="sections">
            <div className="p-4">
              {renderSections()}
              
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowAddSectionDialog(true)}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Añadir sección
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <div>
            {beats.length} beats • {sections.length} secciones
          </div>
          <div>
            {isSaving && "Guardando..."}
          </div>
        </div>
      </CardFooter>
      
      {/* Dialog para añadir/editar sección */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tempSection.name ? 'Editar sección' : 'Añadir nueva sección'}
            </DialogTitle>
            <DialogDescription>
              Define los parámetros para esta sección musical
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="section-name">Nombre</Label>
                <Input
                  id="section-name"
                  value={tempSection.name}
                  onChange={(e) => setTempSection({ ...tempSection, name: e.target.value })}
                  placeholder="Ej: Verso 1, Estribillo, etc."
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="section-type">Tipo</Label>
                <Select
                  value={tempSection.type}
                  onValueChange={(value: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'breakdown' | 'custom') => 
                    setTempSection({ 
                      ...tempSection, 
                      type: value,
                      color: sectionColors[value]
                    })
                  }
                >
                  <SelectTrigger id="section-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intro">Intro</SelectItem>
                    <SelectItem value="verse">Verso</SelectItem>
                    <SelectItem value="chorus">Estribillo</SelectItem>
                    <SelectItem value="bridge">Puente</SelectItem>
                    <SelectItem value="breakdown">Breakdown</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="section-start">Tiempo de inicio (s)</Label>
                <div className="flex items-center">
                  <Input
                    id="section-start"
                    type="number"
                    value={tempSection.startTime}
                    onChange={(e) => setTempSection({
                      ...tempSection,
                      startTime: Math.max(0, Math.min(tempSection.endTime - 1, parseFloat(e.target.value) || 0))
                    })}
                    min={0}
                    max={tempSection.endTime - 1}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTempSection({
                      ...tempSection,
                      startTime: currentTime
                    })}
                    className="ml-2"
                  >
                    Actual
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="section-end">Tiempo de fin (s)</Label>
                <div className="flex items-center">
                  <Input
                    id="section-end"
                    type="number"
                    value={tempSection.endTime}
                    onChange={(e) => setTempSection({
                      ...tempSection,
                      endTime: Math.max(tempSection.startTime + 1, Math.min(duration, parseFloat(e.target.value) || 0))
                    })}
                    min={tempSection.startTime + 1}
                    max={duration}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTempSection({
                      ...tempSection,
                      endTime: currentTime
                    })}
                    className="ml-2"
                  >
                    Actual
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="section-color">Color</Label>
              <div className="grid grid-cols-7 gap-2 mt-1">
                {Object.entries(sectionColors).map(([type, color]) => (
                  <div
                    key={type}
                    className={cn(
                      "w-full aspect-square rounded-md cursor-pointer transition-all",
                      tempSection.color === color && "ring-2 ring-black dark:ring-white"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setTempSection({ ...tempSection, color })}
                  ></div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSectionDialog(false);
                setTempSection({
                  name: '',
                  startTime: currentTime,
                  endTime: currentTime + 10,
                  type: 'verse',
                  color: sectionColors.verse
                });
              }}
            >
              Cancelar
            </Button>
            
            <Button
              onClick={handleAddSection}
              disabled={tempSection.startTime >= tempSection.endTime || isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                tempSection.name ? 'Actualizar' : 'Añadir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BeatAnalyzer;