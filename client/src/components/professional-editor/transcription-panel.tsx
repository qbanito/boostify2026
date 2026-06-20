import React, { useState, useEffect } from 'react';
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
  Input
} from '../../components/ui/input';
import {
  Label
} from '../../components/ui/label';
import {
  Textarea
} from '../../components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../components/ui/dialog';
import {
  Switch
} from '../../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '../../components/ui/popover';
import {
  Slider
} from '../../components/ui/slider';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '../../components/ui/hover-card';
import {
  Badge
} from '../../components/ui/badge';
import {
  ScrollArea
} from '../../components/ui/scroll-area';
import {
  FileText,
  Plus,
  Trash,
  Edit,
  Play,
  Pause,
  Clock,
  Type,
  SlidersHorizontal,
  Upload,
  Download,
  RotateCw,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Split,
  Languages,
  Check,
  Loader2,
  Wand,
  FileUp,
  AlignJustify,
  Copy
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Transcription } from '../../lib/professional-editor-types';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface TranscriptionPanelProps {
  transcriptions: Transcription[];
  currentTime: number;
  duration: number;
  onAddTranscription?: (transcription: Omit<Transcription, 'id'>) => void;
  onUpdateTranscription?: (id: string, updates: Partial<Transcription>) => void;
  onDeleteTranscription?: (id: string) => void;
  onSeek?: (time: number) => void;
  projectId?: string;
  isPlaying?: boolean;
  language?: 'es' | 'en';
}

// Tipos de transcripción
const transcriptionTypes = [
  { value: 'intro', label: 'Introducción', color: '#3b82f6' }, // blue
  { value: 'verse', label: 'Verso', color: '#ef4444' },       // red
  { value: 'chorus', label: 'Estribillo', color: '#f59e0b' }, // amber
  { value: 'bridge', label: 'Puente', color: '#8b5cf6' },     // violet
  { value: 'outro', label: 'Outro', color: '#10b981' },       // emerald
  { value: 'custom', label: 'Personalizado', color: '#6b7280' } // gray
];

// Tipos en inglés
const transcriptionTypesEn = [
  { value: 'intro', label: 'Intro', color: '#3b82f6' },
  { value: 'verse', label: 'Verse', color: '#ef4444' },
  { value: 'chorus', label: 'Chorus', color: '#f59e0b' },
  { value: 'bridge', label: 'Bridge', color: '#8b5cf6' },
  { value: 'outro', label: 'Outro', color: '#10b981' },
  { value: 'custom', label: 'Custom', color: '#6b7280' }
];

// Posiciones para subtítulos
const subtitlePositions = [
  { value: 'top', label: 'Superior', icon: <AlignJustify className="h-4 w-4 rotate-180" /> },
  { value: 'center', label: 'Centro', icon: <AlignCenter className="h-4 w-4" /> },
  { value: 'bottom', label: 'Inferior', icon: <AlignJustify className="h-4 w-4" /> }
];

// Posiciones en inglés
const subtitlePositionsEn = [
  { value: 'top', label: 'Top', icon: <AlignJustify className="h-4 w-4 rotate-180" /> },
  { value: 'center', label: 'Center', icon: <AlignCenter className="h-4 w-4" /> },
  { value: 'bottom', label: 'Bottom', icon: <AlignJustify className="h-4 w-4" /> }
];

const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  transcriptions = [],
  currentTime,
  duration,
  onAddTranscription,
  onUpdateTranscription,
  onDeleteTranscription,
  onSeek,
  projectId,
  isPlaying = false,
  language = 'es'
}) => {
  // Estados
  const [activeTab, setActiveTab] = useState<string>('timeline');
  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [showImportExport, setShowImportExport] = useState<boolean>(false);
  const [exportText, setExportText] = useState<string>('');
  const [importText, setImportText] = useState<string>('');
  const [importFormat, setImportFormat] = useState<string>('srt');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set([]));
  const [viewMode, setViewMode] = useState<'compact' | 'full'>('compact');
  
  // Nuevo subtítulo
  const [newTranscription, setNewTranscription] = useState<Omit<Transcription, 'id'>>({
    text: '',
    startTime: currentTime,
    endTime: currentTime + 3,
    type: 'verse',
    language: language || 'es',
    style: {
      color: '#ffffff',
      fontSize: 18,
      fontWeight: 'normal',
      position: 'bottom'
    }
  });
  
  // Usar el tipo de transcripción según el idioma
  const getTranscriptionTypes = () => {
    return language === 'es' ? transcriptionTypes : transcriptionTypesEn;
  };
  
  // Obtener posiciones según el idioma
  const getSubtitlePositions = () => {
    return language === 'es' ? subtitlePositions : subtitlePositionsEn;
  };
  
  // Formatear tiempo (mm:ss.ms)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };
  
  // Formatear tiempo para SRT (hh:mm:ss,ms)
  const formatSrtTime = (timeInSeconds: number): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  };
  
  // Calcular posición en línea de tiempo
  const timeToPosition = (time: number): number => {
    return (time / duration) * 100;
  };
  
  // Obtener transcripciones activas en el tiempo actual
  const getActiveTranscriptions = (): Transcription[] => {
    return transcriptions.filter(
      transcription => currentTime >= transcription.startTime && currentTime <= transcription.endTime
    );
  };
  
  // Obtener el color según el tipo
  const getTypeColor = (type: string): string => {
    return getTranscriptionTypes().find(t => t.value === type)?.color || '#6b7280';
  };
  
  // Obtener etiqueta según el tipo
  const getTypeLabel = (type: string): string => {
    return getTranscriptionTypes().find(t => t.value === type)?.label || 'Personalizado';
  };
  
  // Filtrar transcripciones por tipo seleccionado
  const getFilteredTranscriptions = (): Transcription[] => {
    if (selectedTypes.size === 0) return transcriptions;
    return transcriptions.filter(t => selectedTypes.has(t.type));
  };
  
  // Manejar añadir transcripción
  const handleAddTranscription = () => {
    if (!onAddTranscription) return;
    
    setIsSaving(true);
    
    // Añadir al estado local
    onAddTranscription(newTranscription);
    
    // Guardar en Firestore si hay projectId
    if (projectId) {
      try {
        const transcriptionId = uuidv4();
        const transcriptionRef = doc(db, `projects/${projectId}/transcriptions/${transcriptionId}`);
        setDoc(transcriptionRef, {
          ...newTranscription,
          createdAt: new Date()
        })
        .catch(error => {
          console.error("Error al guardar transcripción:", error);
        });
      } catch (error) {
        console.error("Error al guardar transcripción:", error);
      }
    }
    
    // Resetear formulario
    setNewTranscription({
      text: '',
      startTime: currentTime,
      endTime: currentTime + 3,
      type: 'verse',
      language: language || 'es',
      style: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'normal',
        position: 'bottom'
      }
    });
    
    setShowAddDialog(false);
    setIsSaving(false);
  };
  
  // Manejar actualización de transcripción
  const handleUpdateTranscription = (id: string, updates: Partial<Transcription>) => {
    if (!onUpdateTranscription) return;
    
    setIsSaving(true);
    
    // Actualizar en estado local
    onUpdateTranscription(id, updates);
    
    // Actualizar en Firestore si hay projectId
    if (projectId) {
      try {
        const transcriptionRef = doc(db, `projects/${projectId}/transcriptions/${id}`);
        updateDoc(transcriptionRef, {
          ...updates,
          updatedAt: new Date()
        })
        .then(() => {
          setIsSaving(false);
        })
        .catch(error => {
          console.error("Error al actualizar transcripción:", error);
          setIsSaving(false);
        });
      } catch (error) {
        console.error("Error al actualizar transcripción:", error);
        setIsSaving(false);
      }
    } else {
      setIsSaving(false);
    }
  };
  
  // Manejar eliminación de transcripción
  const handleDeleteTranscription = (id: string) => {
    if (!onDeleteTranscription) return;
    
    setIsSaving(true);
    
    // Eliminar del estado local
    onDeleteTranscription(id);
    
    // Eliminar de Firestore si hay projectId
    if (projectId) {
      try {
        const transcriptionRef = doc(db, `projects/${projectId}/transcriptions/${id}`);
        deleteDoc(transcriptionRef)
        .then(() => {
          // Si era la transcripción seleccionada, deseleccionar
          if (id === selectedTranscriptionId) {
            setSelectedTranscriptionId(null);
          }
          setIsSaving(false);
        })
        .catch(error => {
          console.error("Error al eliminar transcripción:", error);
          setIsSaving(false);
        });
      } catch (error) {
        console.error("Error al eliminar transcripción:", error);
        setIsSaving(false);
      }
    } else {
      // Si era la transcripción seleccionada, deseleccionar
      if (id === selectedTranscriptionId) {
        setSelectedTranscriptionId(null);
      }
      setIsSaving(false);
    }
  };
  
  // Generar transcripciones automáticamente (simulado)
  const handleGenerateTranscriptions = () => {
    setIsGenerating(true);
    
    // Simular proceso de generación
    setTimeout(() => {
      if (onAddTranscription) {
        // Ejemplo de transcripciones generadas
        const generatedTranscriptions: Omit<Transcription, 'id'>[] = [
          {
            text: language === 'es' ? "Este es un ejemplo de transcripción generada automáticamente." : "This is an example of an automatically generated transcription.",
            startTime: 5,
            endTime: 8,
            type: 'intro',
            language: language || 'es',
            style: {
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 'normal',
              position: 'bottom'
            }
          },
          {
            text: language === 'es' ? "Se generan varias líneas para mostrar cómo funciona." : "Multiple lines are generated to show how it works.",
            startTime: 10,
            endTime: 15,
            type: 'verse',
            language: language || 'es',
            style: {
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 'normal',
              position: 'bottom'
            }
          },
          {
            text: language === 'es' ? "Las líneas se distribuyen a lo largo del video." : "Lines are distributed throughout the video.",
            startTime: 20,
            endTime: 25,
            type: 'chorus',
            language: language || 'es',
            style: {
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 'normal',
              position: 'bottom'
            }
          }
        ];
        
        // Añadir cada transcripción generada
        const savePromises = [];
        
        generatedTranscriptions.forEach(transcript => {
          onAddTranscription(transcript);
          
          // Guardar en Firestore si hay projectId
          if (projectId) {
            const transcriptionId = uuidv4();
            const transcriptionRef = doc(db, `projects/${projectId}/transcriptions/${transcriptionId}`);
            const promise = setDoc(transcriptionRef, {
              ...transcript,
              createdAt: new Date()
            })
            .catch(error => {
              console.error("Error al guardar transcripción generada:", error);
            });
            
            savePromises.push(promise);
          }
        });
        
        // Esperar a que todas las promesas terminen
        Promise.all(savePromises);
      }
      
      setIsGenerating(false);
    }, 2000);
  };
  
  // Exportar transcripciones a formato SRT
  const handleExportTranscriptions = () => {
    // Ordenar transcripciones por tiempo de inicio
    const sortedTranscriptions = [...transcriptions].sort((a, b) => a.startTime - b.startTime);
    
    // Generar texto SRT
    let srtText = '';
    sortedTranscriptions.forEach((transcription, index) => {
      srtText += `${index + 1}\n`;
      srtText += `${formatSrtTime(transcription.startTime)} --> ${formatSrtTime(transcription.endTime)}\n`;
      srtText += `${transcription.text}\n\n`;
    });
    
    setExportText(srtText);
    setShowImportExport(true);
  };
  
  // Importar transcripciones desde texto
  const handleImportTranscriptions = () => {
    if (!importText.trim() || !onAddTranscription) return;
    
    setIsSaving(true);
    
    try {
      // Parsear según el formato
      if (importFormat === 'srt') {
        // Formato SRT
        const srtRegex = /(\d+)\s+(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([\s\S]*?)(?=\s*\d+\s+\d{2}:\d{2}:\d{2},\d{3}\s+-->|\s*$)/g;
        let match;
        let promises: Promise<void>[] = [];
        
        while ((match = srtRegex.exec(importText)) !== null) {
          const startTimeStr = match[2]; // HH:MM:SS,mmm
          const endTimeStr = match[3];   // HH:MM:SS,mmm
          const text = match[4].trim();
          
          // Convertir tiempo SRT a segundos
          const startTime = parseTimeString(startTimeStr);
          const endTime = parseTimeString(endTimeStr);
          
          if (startTime === null || endTime === null) continue;
          
          const newTranscription: Omit<Transcription, 'id'> = {
            text,
            startTime,
            endTime,
            type: 'verse', // Tipo por defecto
            language: language || 'es',
            style: {
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 'normal',
              position: 'bottom'
            }
          };
          
          // Añadir transcripción
          onAddTranscription(newTranscription);
          
          // Guardar en Firestore si hay projectId
          if (projectId) {
            const transcriptionId = uuidv4();
            const transcriptionRef = doc(db, `projects/${projectId}/transcriptions/${transcriptionId}`);
            const promise = setDoc(transcriptionRef, {
              ...newTranscription,
              createdAt: new Date()
            })
            .catch(error => {
              console.error("Error al guardar transcripción:", error);
            });
            
            promises.push(promise);
          }
        }
        
        // Esperar a que todas las promesas terminen
        Promise.all(promises)
          .then(() => {
            // Limpiar y cerrar
            setImportText('');
            setShowImportExport(false);
            setIsSaving(false);
          })
          .catch(error => {
            console.error("Error al guardar transcripciones:", error);
            setIsSaving(false);
          });
      } else if (importFormat === 'txt') {
        // Formato texto simple (cada línea es una transcripción)
        const lines = importText.split('\n').filter(line => line.trim());
        const totalLines = lines.length;
        
        if (totalLines > 0) {
          // Distribuir uniformemente a lo largo del video
          const timePerLine = duration / totalLines;
          const promises: Promise<void>[] = [];
          
          lines.forEach((line, index) => {
            if (!line.trim()) return;
            
            const startTime = index * timePerLine;
            const endTime = startTime + timePerLine;
            
            const newTranscription: Omit<Transcription, 'id'> = {
              text: line.trim(),
              startTime,
              endTime,
              type: 'verse', // Tipo por defecto
              language: language || 'es',
              style: {
                color: '#ffffff',
                fontSize: 18,
                fontWeight: 'normal',
                position: 'bottom'
              }
            };
            
            // Añadir transcripción
            onAddTranscription(newTranscription);
            
            // Guardar en Firestore si hay projectId
            if (projectId) {
              const transcriptionId = uuidv4();
              const transcriptionRef = doc(db, `projects/${projectId}/transcriptions/${transcriptionId}`);
              const promise = setDoc(transcriptionRef, {
                ...newTranscription,
                createdAt: new Date()
              })
              .catch(error => {
                console.error("Error al guardar transcripción:", error);
              });
              
              promises.push(promise);
            }
          });
          
          // Esperar a que todas las promesas terminen
          Promise.all(promises)
            .then(() => {
              // Limpiar y cerrar
              setImportText('');
              setShowImportExport(false);
              setIsSaving(false);
            })
            .catch(error => {
              console.error("Error al guardar transcripciones:", error);
              setIsSaving(false);
            });
        } else {
          setImportText('');
          setShowImportExport(false);
          setIsSaving(false);
        }
      } else {
        setImportText('');
        setShowImportExport(false);
        setIsSaving(false);
      }
    } catch (error) {
      console.error("Error al importar transcripciones:", error);
      setIsSaving(false);
    }
  };
  
  // Convertir tiempo en formato HH:MM:SS,mmm a segundos
  const parseTimeString = (timeStr: string): number | null => {
    try {
      // Formato HH:MM:SS,mmm o MM:SS.mmm
      const pattern = timeStr.includes(',') 
        ? /(\d{2}):(\d{2}):(\d{2}),(\d{3})/ 
        : /(\d+):(\d{2})\.(\d{3})/;
      
      const match = timeStr.match(pattern);
      if (!match) return null;
      
      if (timeStr.includes(',')) {
        // Formato HH:MM:SS,mmm
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        const milliseconds = parseInt(match[4]);
        
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
      } else {
        // Formato MM:SS.mmm
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        
        return minutes * 60 + seconds + milliseconds / 1000;
      }
    } catch (e) {
      console.error("Error al parsear tiempo:", e, timeStr);
      return null;
    }
  };
  
  // Renderizar línea de tiempo
  const renderTimeline = () => {
    return (
      <div className="relative h-[200px] border rounded-md overflow-hidden">
        {/* Escala de tiempo */}
        <div className="absolute top-0 left-0 right-0 h-6 border-b flex px-4">
          {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(percent => (
            <div
              key={`time-${percent}`}
              className="absolute text-xs text-gray-500"
              style={{ left: `${percent * 100}%` }}
            >
              <div className="h-2 border-l border-gray-300 dark:border-gray-700"></div>
              <div className="mt-1">{formatTime(percent * duration)}</div>
            </div>
          ))}
        </div>
        
        {/* Transcripciones en la línea de tiempo */}
        <div className="absolute top-8 left-0 right-0 bottom-0 px-4">
          {getFilteredTranscriptions().map((transcription, index) => (
            <div
              key={transcription.id}
              className={cn(
                "absolute h-8 rounded-md flex items-center px-2 cursor-pointer border-2 transition-all",
                selectedTranscriptionId === transcription.id && "ring-2 ring-blue-500",
                "hover:opacity-90"
              )}
              style={{
                left: `${timeToPosition(transcription.startTime)}%`,
                width: `${timeToPosition(transcription.endTime) - timeToPosition(transcription.startTime)}%`,
                top: `${Math.min(6, index % 6) * 25}px`,
                backgroundColor: `${getTypeColor(transcription.type)}80`,
                borderColor: getTypeColor(transcription.type)
              }}
              onClick={() => setSelectedTranscriptionId(transcription.id)}
            >
              <div className="text-xs font-medium text-white truncate">
                {transcription.text}
              </div>
            </div>
          ))}
          
          {/* Marcador de tiempo actual */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-10 pointer-events-none"
            style={{ left: `${timeToPosition(currentTime)}%` }}
          >
            <div className="w-3 h-3 bg-orange-500 rounded-full -ml-1.5"></div>
          </div>
        </div>
      </div>
    );
  };
  
  // Renderizar pestaña de vista previa
  const renderPreview = () => {
    const activeTranscriptions = getActiveTranscriptions();
    
    return (
      <div className="relative aspect-video border rounded-md overflow-hidden bg-black">
        {/* Simulación de video */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">
            <FileText className="h-16 w-16 mx-auto opacity-20" />
            <p className="mt-2">{language === 'es' ? 'Vista previa de transcripción' : 'Transcription preview'}</p>
          </div>
        </div>
        
        {/* Transcripciones activas */}
        <div className="absolute inset-0 flex flex-col p-4">
          <div className="flex-1"></div>
          <div className="flex flex-col items-center">
            {activeTranscriptions.map(transcription => (
              <div
                key={transcription.id}
                className={cn(
                  "px-4 py-1 rounded-md mb-1 max-w-[80%] text-center",
                  transcription.style?.position === 'center' && "mt-auto mb-auto",
                  transcription.style?.position === 'top' && "mt-0 mb-auto"
                )}
                style={{
                  color: transcription.style?.color || '#ffffff',
                  fontSize: `${transcription.style?.fontSize || 18}px`,
                  fontWeight: transcription.style?.fontWeight || 'normal',
                  textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
                }}
              >
                {transcription.text}
              </div>
            ))}
          </div>
        </div>
        
        {/* Información de tiempo actual */}
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          {formatTime(currentTime)}
        </div>
      </div>
    );
  };
  
  // Renderizar lista de transcripciones
  const renderList = () => {
    return (
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Tiempo</TableHead>
              <TableHead>Texto</TableHead>
              <TableHead className="w-[100px]">Tipo</TableHead>
              <TableHead className="w-[100px]">Duración</TableHead>
              <TableHead className="w-[120px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getFilteredTranscriptions().length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-gray-500">
                    {language === 'es' ? 'No hay transcripciones' : 'No transcriptions'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddDialog(true)}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-1" /> 
                    {language === 'es' ? 'Añadir transcripción' : 'Add transcription'}
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              // Ordenar por tiempo de inicio
              [...getFilteredTranscriptions()]
                .sort((a, b) => a.startTime - b.startTime)
                .map(transcription => (
                <TableRow
                  key={transcription.id}
                  className={cn(
                    "cursor-pointer",
                    selectedTranscriptionId === transcription.id && "bg-blue-50 dark:bg-blue-900/20",
                    currentTime >= transcription.startTime && currentTime <= transcription.endTime && 
                      "bg-orange-50 dark:bg-orange-900/20"
                  )}
                  onClick={() => setSelectedTranscriptionId(transcription.id)}
                >
                  <TableCell>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSeek) onSeek(transcription.startTime);
                      }}
                      className="h-6 p-0 text-xs"
                    >
                      {formatTime(transcription.startTime)}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {viewMode === 'compact' ? (
                      <div className="truncate max-w-[200px]">
                        {transcription.text}
                      </div>
                    ) : (
                      <div>{transcription.text}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      style={{ backgroundColor: getTypeColor(transcription.type) }}
                      className="text-white"
                    >
                      {getTypeLabel(transcription.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(transcription.endTime - transcription.startTime).toFixed(1)}s
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewTranscription({
                            ...transcription,
                            style: transcription.style || {
                              color: '#ffffff',
                              fontSize: 18,
                              fontWeight: 'normal',
                              position: 'bottom'
                            }
                          });
                          setShowAddDialog(true);
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTranscription(transcription.id);
                        }}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
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
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <FileText className="h-5 w-5 mr-2 text-orange-500" />
            {language === 'es' ? 'Transcripciones y Subtítulos' : 'Transcriptions & Subtitles'}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {/* Filtro por tipo */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-1" />
                  {language === 'es' ? 'Filtrar' : 'Filter'}
                  {selectedTypes.size > 0 && (
                    <Badge variant="secondary" className="ml-1">{selectedTypes.size}</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {language === 'es' ? 'Filtrar por tipo' : 'Filter by type'}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {getTranscriptionTypes().map(type => (
                      <Badge
                        key={type.value}
                        variant={selectedTypes.has(type.value) ? "default" : "outline"}
                        style={{ 
                          backgroundColor: selectedTypes.has(type.value) ? type.color : 'transparent',
                          borderColor: type.color,
                          color: selectedTypes.has(type.value) ? 'white' : type.color
                        }}
                        className="cursor-pointer"
                        onClick={() => {
                          const newSelectedTypes = new Set(selectedTypes);
                          if (newSelectedTypes.has(type.value)) {
                            newSelectedTypes.delete(type.value);
                          } else {
                            newSelectedTypes.add(type.value);
                          }
                          setSelectedTypes(newSelectedTypes);
                        }}
                      >
                        {type.label}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex justify-between pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTypes(new Set())}
                      className="text-xs"
                    >
                      {language === 'es' ? 'Limpiar filtros' : 'Clear filters'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const allTypes = new Set(getTranscriptionTypes().map(t => t.value));
                        setSelectedTypes(allTypes);
                      }}
                      className="text-xs"
                    >
                      {language === 'es' ? 'Seleccionar todos' : 'Select all'}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Cambiar vista */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'compact' ? 'full' : 'compact')}
              className="h-8 w-8 p-0"
            >
              {viewMode === 'compact' ? (
                <AlignJustify className="h-4 w-4" />
              ) : (
                <AlignLeft className="h-4 w-4" />
              )}
            </Button>
            
            {/* Botón de importar/exportar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Al abrir, preparar el texto de exportación
                handleExportTranscriptions();
              }}
              className="h-8"
            >
              <FileUp className="h-4 w-4 mr-1" />
              {language === 'es' ? 'Importar/Exportar' : 'Import/Export'}
            </Button>
            
            {/* Botón de añadir */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              {language === 'es' ? 'Añadir' : 'Add'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start p-0 rounded-none border-b">
            <TabsTrigger value="timeline" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              {language === 'es' ? 'Línea de Tiempo' : 'Timeline'}
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              {language === 'es' ? 'Lista' : 'List'}
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              {language === 'es' ? 'Vista Previa' : 'Preview'}
            </TabsTrigger>
          </TabsList>
          
          {/* Vista línea de tiempo */}
          <TabsContent value="timeline" className="p-4">
            {renderTimeline()}
            
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                {language === 'es' 
                  ? `Añadir transcripción en ${formatTime(currentTime)}`
                  : `Add transcription at ${formatTime(currentTime)}`
                }
              </Button>
            </div>
          </TabsContent>
          
          {/* Vista lista */}
          <TabsContent value="list" className="border-t">
            {renderList()}
          </TabsContent>
          
          {/* Vista previa */}
          <TabsContent value="preview" className="p-4">
            {renderPreview()}
            
            <div className="mt-4 flex justify-between">
              <div>
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Wand className="h-4 w-4 mr-1" />
                      {language === 'es' ? 'Generar automáticamente' : 'Auto-generate'}
                    </Button>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">
                        {language === 'es' ? 'Generación automática' : 'Automatic generation'}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {language === 'es' 
                          ? 'Genera subtítulos automáticamente analizando el audio del video.'
                          : 'Automatically generate subtitles by analyzing video audio.'
                        }
                      </p>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
              
              <div>
                <p className="text-xs text-gray-500">
                  {language === 'es' 
                    ? `Transcripciones activas: ${getActiveTranscriptions().length}`
                    : `Active transcriptions: ${getActiveTranscriptions().length}`
                  }
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <div>
            {language === 'es'
              ? `${transcriptions.length} transcripciones • ${getActiveTranscriptions().length} activas`
              : `${transcriptions.length} transcriptions • ${getActiveTranscriptions().length} active`
            }
          </div>
          <div>
            {isSaving && (language === 'es' ? "Guardando..." : "Saving...")}
            {isGenerating && (language === 'es' ? "Generando..." : "Generating...")}
          </div>
        </div>
      </CardFooter>
      
      {/* Dialog para añadir/editar transcripción */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newTranscription.text
                ? (language === 'es' ? 'Editar transcripción' : 'Edit transcription')
                : (language === 'es' ? 'Añadir nueva transcripción' : 'Add new transcription')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'es'
                ? 'Define el texto y los tiempos para esta transcripción'
                : 'Define the text and timing for this transcription'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="transcription-text">
                {language === 'es' ? 'Texto' : 'Text'}
              </Label>
              <Textarea
                id="transcription-text"
                value={newTranscription.text}
                onChange={(e) => setNewTranscription({ ...newTranscription, text: e.target.value })}
                placeholder={language === 'es' ? "Ingresa el texto del subtítulo" : "Enter subtitle text"}
                className="min-h-[80px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Tiempo de inicio (s)' : 'Start time (s)'}
                </Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    value={newTranscription.startTime}
                    onChange={(e) => setNewTranscription({
                      ...newTranscription,
                      startTime: Math.max(0, Math.min(newTranscription.endTime - 0.1, parseFloat(e.target.value) || 0))
                    })}
                    min={0}
                    max={newTranscription.endTime - 0.1}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewTranscription({
                      ...newTranscription,
                      startTime: currentTime
                    })}
                    className="ml-2"
                  >
                    {language === 'es' ? 'Actual' : 'Current'}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Tiempo de fin (s)' : 'End time (s)'}
                </Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    value={newTranscription.endTime}
                    onChange={(e) => setNewTranscription({
                      ...newTranscription,
                      endTime: Math.max(newTranscription.startTime + 0.1, Math.min(duration, parseFloat(e.target.value) || 0))
                    })}
                    min={newTranscription.startTime + 0.1}
                    max={duration}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewTranscription({
                      ...newTranscription,
                      endTime: Math.min(duration, currentTime + 3)
                    })}
                    className="ml-2"
                  >
                    +3s
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Tipo' : 'Type'}
                </Label>
                <Select
                  value={newTranscription.type}
                  onValueChange={(value: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom') => {
                    setNewTranscription({ ...newTranscription, type: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'es' ? "Seleccionar tipo" : "Select type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {getTranscriptionTypes().map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: type.color }}
                          ></div>
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Idioma' : 'Language'}
                </Label>
                <Select
                  value={newTranscription.language || language || 'es'}
                  onValueChange={(value: 'es' | 'en') => {
                    setNewTranscription({ ...newTranscription, language: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={language === 'es' ? "Seleccionar idioma" : "Select language"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>
                {language === 'es' ? 'Estilo' : 'Style'}
              </Label>
              <div className="grid grid-cols-2 gap-4 mt-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
                <div className="space-y-2">
                  <Label className="text-xs">
                    {language === 'es' ? 'Color del texto' : 'Text color'}
                  </Label>
                  <div className="flex">
                    <Input
                      type="color"
                      value={newTranscription.style?.color || '#ffffff'}
                      onChange={(e) => setNewTranscription({
                        ...newTranscription,
                        style: {
                          ...newTranscription.style,
                          color: e.target.value
                        }
                      })}
                      className="w-10 h-10 p-1"
                    />
                    <div className="ml-2 flex-1">
                      <Input
                        value={newTranscription.style?.color || '#ffffff'}
                        onChange={(e) => setNewTranscription({
                          ...newTranscription,
                          style: {
                            ...newTranscription.style,
                            color: e.target.value
                          }
                        })}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">
                    {language === 'es' ? 'Tamaño del texto' : 'Font size'}
                  </Label>
                  <div className="flex items-center">
                    <div className="flex-1 mr-2">
                      <Slider
                        value={[newTranscription.style?.fontSize || 18]}
                        min={12}
                        max={36}
                        step={1}
                        onValueChange={([fontSize]) => setNewTranscription({
                          ...newTranscription,
                          style: {
                            ...newTranscription.style,
                            fontSize
                          }
                        })}
                      />
                    </div>
                    <div className="w-12 text-center">
                      {newTranscription.style?.fontSize || 18}px
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">
                    {language === 'es' ? 'Peso de la fuente' : 'Font weight'}
                  </Label>
                  <Select
                    value={newTranscription.style?.fontWeight || 'normal'}
                    onValueChange={(value: string) => setNewTranscription({
                      ...newTranscription,
                      style: {
                        ...newTranscription.style,
                        fontWeight: value
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">
                        {language === 'es' ? 'Normal' : 'Normal'}
                      </SelectItem>
                      <SelectItem value="bold">
                        {language === 'es' ? 'Negrita' : 'Bold'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">
                    {language === 'es' ? 'Posición' : 'Position'}
                  </Label>
                  <Select
                    value={newTranscription.style?.position || 'bottom'}
                    onValueChange={(value: 'top' | 'center' | 'bottom') => setNewTranscription({
                      ...newTranscription,
                      style: {
                        ...newTranscription.style,
                        position: value
                      }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getSubtitlePositions().map(position => (
                        <SelectItem key={position.value} value={position.value}>
                          <div className="flex items-center">
                            {position.icon}
                            <span className="ml-2">{position.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Vista previa */}
            <div className="mt-2">
              <div className="relative aspect-video border rounded-md overflow-hidden bg-black">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className={cn(
                      "px-4 py-1 rounded-md text-center max-w-[80%]",
                      newTranscription.style?.position === 'center' && "self-center",
                      newTranscription.style?.position === 'top' && "self-start mt-4",
                      newTranscription.style?.position === 'bottom' && "self-end mb-4"
                    )}
                    style={{
                      color: newTranscription.style?.color || '#ffffff',
                      fontSize: `${newTranscription.style?.fontSize || 18}px`,
                      fontWeight: newTranscription.style?.fontWeight || 'normal',
                      textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
                    }}
                  >
                    {newTranscription.text || (language === 'es' ? 'Vista previa de subtítulo' : 'Subtitle preview')}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                // Resetear el formulario si es una nueva transcripción
                if (!newTranscription.text) {
                  setNewTranscription({
                    text: '',
                    startTime: currentTime,
                    endTime: currentTime + 3,
                    type: 'verse',
                    language: language || 'es',
                    style: {
                      color: '#ffffff',
                      fontSize: 18,
                      fontWeight: 'normal',
                      position: 'bottom'
                    }
                  });
                }
              }}
            >
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </Button>
            
            <Button
              onClick={handleAddTranscription}
              disabled={isSaving || !newTranscription.text.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'es' ? 'Guardando...' : 'Saving...'}
                </>
              ) : (
                newTranscription.text
                  ? (language === 'es' ? 'Actualizar' : 'Update')
                  : (language === 'es' ? 'Añadir' : 'Add')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para importar/exportar */}
      <Dialog open={showImportExport} onOpenChange={setShowImportExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'es' ? 'Importar/Exportar Transcripciones' : 'Import/Export Transcriptions'}
            </DialogTitle>
            <DialogDescription>
              {language === 'es'
                ? 'Importa o exporta transcripciones en formato SRT o texto plano'
                : 'Import or export transcriptions in SRT or plain text format'
              }
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="export" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="export">
                {language === 'es' ? 'Exportar' : 'Export'}
              </TabsTrigger>
              <TabsTrigger value="import">
                {language === 'es' ? 'Importar' : 'Import'}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="export" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>
                  {language === 'es' ? 'Formato SRT' : 'SRT Format'}
                </Label>
                <div className="relative">
                  <Textarea
                    value={exportText}
                    readOnly
                    className="h-[200px] font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(exportText);
                    }}
                    className="absolute top-2 right-2"
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    {language === 'es' ? 'Copiar' : 'Copy'}
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Descargar como archivo SRT
                    const blob = new Blob([exportText], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'transcriptions.srt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  {language === 'es' ? 'Descargar SRT' : 'Download SRT'}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="import" className="space-y-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {language === 'es' ? 'Formato de entrada' : 'Input format'}
                  </Label>
                  <Select
                    value={importFormat}
                    onValueChange={setImportFormat}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="srt">SRT</SelectItem>
                      <SelectItem value="txt">
                        {language === 'es' ? 'Texto plano' : 'Plain text'}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={importFormat === 'srt'
                    ? "1\n00:00:01,000 --> 00:00:04,000\nSubtítulo de ejemplo"
                    : language === 'es' ? "Pega aquí tu texto, cada línea será un subtítulo" : "Paste your text here, each line will be a subtitle"
                  }
                  className="h-[200px]"
                />
              </div>
              
              <div className="flex justify-end">
                <Button
                  onClick={handleImportTranscriptions}
                  disabled={isSaving || !importText.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {language === 'es' ? 'Importando...' : 'Importing...'}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      {language === 'es' ? 'Importar' : 'Import'}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TranscriptionPanel;