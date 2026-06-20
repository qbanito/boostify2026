import React, { useState, useEffect, useRef } from 'react';
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
  Input
} from '../../components/ui/input';
import {
  Label
} from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui/tabs';
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
  Music,
  Volume2,
  VolumeX,
  Mic,
  Plus,
  Trash,
  Save,
  Upload,
  Download,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Music2,
  Activity, // Reemplazo de Waveform por Activity (similar visualmente)
  LayoutGrid,
  ListMusic,
  RefreshCw,
  FileAudio,
  Scissors,
  Headphones,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AudioTrack } from '../../lib/professional-editor-types';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '../../lib/firebase';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { doc, setDoc, collection, updateDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

interface AudioTrackEditorProps {
  audioTracks: AudioTrack[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onAddTrack?: (track: Omit<AudioTrack, 'id'>) => void;
  onUpdateTrack?: (id: string, updates: Partial<AudioTrack>) => void;
  onDeleteTrack?: (id: string) => void;
  onSeek?: (time: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  projectId?: string;
}

// Colores por tipo de audio
const trackTypeColors: Record<string, string> = {
  music: '#8b5cf6', // violet-500
  vocal: '#f43f5e', // rose-500
  sfx: '#f59e0b',   // amber-500
  ambience: '#10b981' // emerald-500
};

// Opciones para tipo de pista
const trackTypeOptions = [
  { value: 'music', label: 'Music', icon: <Music className="h-4 w-4 mr-2" /> },
  { value: 'vocal', label: 'Voz', icon: <Mic className="h-4 w-4 mr-2" /> },
  { value: 'sfx', label: 'Efectos', icon: <Volume2 className="h-4 w-4 mr-2" /> },
  { value: 'ambience', label: 'Ambiente', icon: <Music2 className="h-4 w-4 mr-2" /> }
];

const AudioTrackEditor: React.FC<AudioTrackEditorProps> = ({
  audioTracks = [],
  currentTime,
  duration,
  isPlaying,
  onAddTrack,
  onUpdateTrack,
  onDeleteTrack,
  onSeek,
  onPlay,
  onPause,
  projectId
}) => {
  // Estados
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('timeline');
  const [muted, setMuted] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(1);
  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [editingMarkers, setEditingMarkers] = useState<boolean>(false);
  const [newTrackData, setNewTrackData] = useState<Omit<AudioTrack, 'id'>>({
    name: '',
    source: '',
    volume: 1,
    muted: false,
    loop: false,
    startTime: 0,
    duration: 0,
    type: 'music',
    waveform: []
  });
  
  // Referencias
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  
  // Formatear tiempo (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Obtener la posición en la línea de tiempo
  const timeToPosition = (time: number): number => {
    return (time / duration) * 100;
  };
  
  // Manejar la selección de archivo de audio
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setAudioFile(file);
      
      // Obtener duración del archivo
      const audioElement = new Audio();
      audioElement.src = URL.createObjectURL(file);
      
      audioElement.onloadedmetadata = () => {
        setNewTrackData({
          ...newTrackData,
          name: file.name.replace(/\.[^/.]+$/, ""), // Quitar extensión
          duration: audioElement.duration,
          source: URL.createObjectURL(file) // URL temporal
        });
        
        // Generar forma de onda (simplificado)
        generateWaveform(audioElement);
      };
      
      setUploadError(null);
    }
  };
  
  // Generar forma de onda para visualización
  const generateWaveform = async (audioElement: HTMLAudioElement) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioElement.src);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Obtener datos del canal izquierdo
      const rawData = audioBuffer.getChannelData(0);
      
      // Simplificar a 100 puntos para visualización
      const sampleSize = Math.floor(rawData.length / 100);
      const sampledData: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const startIndex = i * sampleSize;
        const endIndex = (i + 1) * sampleSize > rawData.length ? rawData.length : (i + 1) * sampleSize;
        
        // Calcular el valor absoluto máximo en este segmento
        let max = 0;
        for (let j = startIndex; j < endIndex; j++) {
          const absValue = Math.abs(rawData[j]);
          if (absValue > max) max = absValue;
        }
        
        sampledData.push(max);
      }
      
      // Normalizar valores entre 0 y 1
      const maxValue = Math.max(...sampledData);
      const normalizedData = sampledData.map(val => val / maxValue);
      
      setNewTrackData(prev => ({
        ...prev,
        waveform: normalizedData
      }));
    } catch (error) {
      console.error("Error al generar la forma de onda:", error);
    }
  };
  
  // Subir archivo de audio a Firebase Storage
  const uploadAudioFile = async (): Promise<string> => {
    if (!audioFile || !projectId) {
      throw new Error("No hay archivo de audio o ID de proyecto");
    }
    
    const storageRef = ref(storage, `projects/${projectId}/audio/${audioFile.name}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, audioFile);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Error al subir archivo:", error);
          setUploadError("Error al subir el archivo. Inténtalo de nuevo.");
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };
  
  // Añadir nueva pista de audio
  const handleAddTrack = async () => {
    if (!onAddTrack) return;
    
    let audioUrl = newTrackData.source;
    
    // Si hay archivo y estamos conectados a Firestore
    if (audioFile && projectId) {
      setIsSaving(true);
      try {
        audioUrl = await uploadAudioFile();
      } catch (error) {
        console.error("Error al subir audio:", error);
        setIsSaving(false);
        return;
      }
    }
    
    const trackId = uuidv4();
    const newTrack: Omit<AudioTrack, 'id'> = {
      ...newTrackData,
      source: audioUrl
    };
    
    // Añadir al estado local
    onAddTrack(newTrack);
    
    // Si hay un ID de proyecto, guardar en Firestore
    if (projectId) {
      try {
        const trackRef = doc(db, `projects/${projectId}/audioTracks/${trackId}`);
        await setDoc(trackRef, {
          ...newTrack,
          createdAt: new Date()
        });
      } catch (error) {
        console.error("Error al guardar pista de audio:", error);
      } finally {
        setIsSaving(false);
      }
    }
    
    resetForm();
    setShowAddDialog(false);
  };
  
  // Actualizar pista de audio
  const handleUpdateTrack = async (id: string, updates: Partial<AudioTrack>) => {
    if (!onUpdateTrack) return;
    
    // Actualizar en el estado local
    onUpdateTrack(id, updates);
    
    // Si hay un ID de proyecto, actualizar en Firestore
    if (projectId) {
      setIsSaving(true);
      try {
        const trackRef = doc(db, `projects/${projectId}/audioTracks/${id}`);
        await updateDoc(trackRef, {
          ...updates,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error("Error al actualizar pista de audio:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };
  
  // Eliminar pista de audio
  const handleDeleteTrack = async (id: string) => {
    if (!onDeleteTrack) return;
    
    // Eliminar del estado local
    onDeleteTrack(id);
    
    // Si hay un ID de proyecto, eliminar de Firestore
    if (projectId) {
      setIsSaving(true);
      try {
        const trackRef = doc(db, `projects/${projectId}/audioTracks/${id}`);
        await deleteDoc(trackRef);
      } catch (error) {
        console.error("Error al eliminar pista de audio:", error);
      } finally {
        setIsSaving(false);
      }
    }
    
    // Si era la pista seleccionada, deseleccionar
    if (id === selectedTrackId) {
      setSelectedTrackId(null);
    }
  };
  
  // Resetear formulario
  const resetForm = () => {
    setNewTrackData({
      name: '',
      source: '',
      volume: 1,
      muted: false,
      loop: false,
      startTime: 0,
      duration: 0,
      type: 'music',
      waveform: []
    });
    setAudioFile(null);
    setUploadProgress(0);
    setUploadError(null);
  };
  
  // Manejar clic en línea de tiempo
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !timelineContainerRef.current) return;
    
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = offsetX / rect.width;
    
    onSeek(percentage * duration);
  };
  
  // Iniciar/detener grabación de audio
  const toggleRecording = async () => {
    if (isRecording) {
      // Detener grabación
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    } else {
      // Iniciar grabación
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);
          const fileName = `Grabación_${new Date().toISOString().replace(/[:.]/g, '-')}`;
          
          // Crear un archivo a partir del blob
          const file = new File([blob], `${fileName}.wav`, { type: 'audio/wav' });
          setAudioFile(file);
          
          // Obtener duración y forma de onda
          const audioElement = new Audio(audioUrl);
          audioElement.onloadedmetadata = () => {
            setNewTrackData({
              ...newTrackData,
              name: fileName,
              source: audioUrl,
              duration: audioElement.duration,
              type: 'vocal' // Asumir que es voz
            });
            
            // Generar forma de onda
            generateWaveform(audioElement);
          };
          
          setShowAddDialog(true);
          setIsRecording(false);
          
          // Detener stream
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error("Error al iniciar grabación:", error);
      }
    }
  };
  
  // Sincronizar la reproducción de audio con el estado de isPlaying y currentTime
  useEffect(() => {
    // Para cada pista de audio
    audioTracks.forEach(track => {
      const audioElement = audioElementsRef.current[track.id];
      
      if (audioElement) {
        // Aplicar volumen y mute
        audioElement.volume = muted ? 0 : track.volume * masterVolume;
        audioElement.muted = muted || track.muted;
        
        // Sincronizar tiempo si no está reproduciendo
        if (!isPlaying && Math.abs(audioElement.currentTime - currentTime) > 0.2) {
          if (currentTime >= track.startTime && 
              currentTime < track.startTime + track.duration) {
            audioElement.currentTime = currentTime - track.startTime;
          }
        }
        
        // Manejar reproducción
        if (isPlaying) {
          if (currentTime >= track.startTime && 
              currentTime < track.startTime + track.duration) {
            // El tiempo actual está dentro del rango de la pista, debe reproducir
            if (audioElement.paused) {
              audioElement.currentTime = currentTime - track.startTime;
              audioElement.play().catch(e => console.error("Error al reproducir audio:", e));
            }
          } else {
            // El tiempo actual está fuera del rango de la pista, debe pausar
            if (!audioElement.paused) {
              audioElement.pause();
            }
          }
        } else {
          // Si isPlaying es false, asegurarnos de que todo esté pausado
          if (!audioElement.paused) {
            audioElement.pause();
          }
        }
      }
    });
  }, [audioTracks, currentTime, isPlaying, muted, masterVolume]);
  
  // Crear o actualizar elementos de audio cuando cambian las pistas
  useEffect(() => {
    // Limpiar elementos antiguos que ya no existen en audioTracks
    Object.keys(audioElementsRef.current).forEach(id => {
      if (!audioTracks.some(track => track.id === id)) {
        // Esta pista ya no existe, eliminar el elemento
        delete audioElementsRef.current[id];
      }
    });
    
    // Crear o actualizar elementos de audio
    audioTracks.forEach(track => {
      if (!audioElementsRef.current[track.id]) {
        // Crear nuevo elemento de audio
        const audioElement = new Audio(track.source);
        audioElement.loop = track.loop;
        audioElementsRef.current[track.id] = audioElement;
      } else {
        // Actualizar elemento existente
        const audioElement = audioElementsRef.current[track.id];
        if (audioElement.src !== track.source) {
          audioElement.src = track.source;
        }
        audioElement.loop = track.loop;
      }
    });
  }, [audioTracks]);
  
  // Limpiar cuando se desmonta el componente
  useEffect(() => {
    return () => {
      // Detener todos los elementos de audio
      Object.values(audioElementsRef.current).forEach(audioElement => {
        audioElement.pause();
        audioElement.src = '';
      });
      
      // Limpiar URL de objetos
      if (newTrackData.source && newTrackData.source.startsWith('blob:')) {
        URL.revokeObjectURL(newTrackData.source);
      }
    };
  }, []);
  
  // Renderizar forma de onda
  const renderWaveform = (waveformData: number[] = [], color: string = '#8b5cf6') => {
    if (!waveformData || waveformData.length === 0) {
      // Forma de onda ficticia si no hay datos
      return (
        <div className="flex items-center h-12 justify-around">
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i} 
              className="bg-gray-200 dark:bg-gray-700 rounded-full" 
              style={{ 
                height: `${10 + Math.random() * 20}px`,
                width: '3px'
              }}
            />
          ))}
        </div>
      );
    }
    
    return (
      <div className="flex items-center h-12 justify-around">
        {waveformData.map((value, i) => (
          <div 
            key={i} 
            className="rounded-full" 
            style={{ 
              height: `${value * 30}px`,
              width: '2px',
              backgroundColor: color,
              opacity: 0.8
            }}
          />
        ))}
      </div>
    );
  };
  
  // Renderizar marcador de posición actual 
  const renderCurrentTimeMarker = () => {
    return (
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-10 pointer-events-none"
        style={{ left: `${timeToPosition(currentTime)}%` }}
      >
        <div className="w-3 h-3 bg-orange-500 rounded-full -ml-1.5 -mt-1"></div>
      </div>
    );
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <Music2 className="h-5 w-5 mr-2 text-orange-500" />
            Pistas de Audio
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Button
                variant={muted ? "default" : "outline"}
                size="sm"
                onClick={() => setMuted(!muted)}
                className="h-8 w-8 p-0"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              
              <Slider
                value={[masterVolume * 100]}
                min={0}
                max={100}
                step={1}
                className="w-24 h-4"
                onValueChange={(value) => setMasterVolume(value[0] / 100)}
              />
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" /> Añadir pista
              </Button>
              
              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="sm"
                onClick={toggleRecording}
                className="h-8"
              >
                <Mic className="h-4 w-4 mr-1" /> {isRecording ? "Detener" : "Grabar"}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        
        {showSettings && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Opciones de visualización</h4>
                <div className="flex space-x-2">
                  <Button
                    variant={!editingMarkers ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditingMarkers(false)}
                    className="text-xs"
                  >
                    <Activity className="h-3.5 w-3.5 mr-1" /> Vista estándar
                  </Button>
                  
                  <Button
                    variant={editingMarkers ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditingMarkers(true)}
                    className="text-xs"
                  >
                    <Scissors className="h-3.5 w-3.5 mr-1" /> Editar marcadores
                  </Button>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2">Dispositivos de entrada</h4>
                <Select 
                  value={selectedAudioInput || ''}
                  onValueChange={setSelectedAudioInput}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar micrófono" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Dispositivo predeterminado</SelectItem>
                    {/* Aquí se listarían los dispositivos disponibles */}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start p-0 rounded-none border-b">
            <TabsTrigger value="timeline" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              <LayoutGrid className="h-4 w-4 mr-2" /> Línea de tiempo
            </TabsTrigger>
            <TabsTrigger value="tracks" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              <ListMusic className="h-4 w-4 mr-2" /> Lista de pistas
            </TabsTrigger>
          </TabsList>
          
          {/* Vista de línea de tiempo */}
          <TabsContent value="timeline" className="min-h-[200px]">
            <div 
              ref={timelineContainerRef}
              className="relative h-full border-b border-t min-h-[200px] cursor-pointer"
              onClick={handleTimelineClick}
            >
              {/* Marcadores de tiempo */}
              <div className="absolute inset-x-0 top-0 h-6 flex justify-between text-xs text-gray-500 border-b">
                {Array.from({ length: 11 }).map((_, i) => {
                  const time = (i / 10) * duration;
                  return (
                    <div 
                      key={i} 
                      className="relative"
                      style={{ left: `${i * 10}%` }}
                    >
                      <div className="absolute h-2 border-l border-gray-300 dark:border-gray-700"></div>
                      <div className="absolute top-3 -translate-x-1/2">
                        {formatTime(time)}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Pistas de audio */}
              <div className="absolute top-8 inset-x-0 bottom-0 overflow-y-auto">
                {audioTracks.map((track, index) => (
                  <div 
                    key={track.id}
                    className={cn(
                      "relative h-16 border-b border-gray-200 dark:border-gray-800",
                      selectedTrackId === track.id && "bg-gray-50 dark:bg-gray-900"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrackId(track.id);
                    }}
                  >
                    {/* Nombre de la pista */}
                    <div className="absolute left-0 top-0 bottom-0 w-48 border-r bg-gray-50 dark:bg-gray-900 py-2 px-3 flex flex-col justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-2 h-2 rounded-full mr-2" 
                          style={{ backgroundColor: trackTypeColors[track.type] }}
                        />
                        <div className="font-medium truncate flex-1">
                          {track.name}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateTrack(track.id, { muted: !track.muted });
                            }}
                            className="h-6 w-6 p-0"
                          >
                            {track.muted ? (
                              <VolumeX className="h-3 w-3 text-red-500" />
                            ) : (
                              <Volume2 className="h-3 w-3" />
                            )}
                          </Button>
                          
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={track.volume * 100}
                            onChange={(e) => {
                              handleUpdateTrack(track.id, { volume: parseInt(e.target.value) / 100 });
                            }}
                            className="w-16 h-1.5"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTrack(track.id);
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Contenido principal - Visualización de audio */}
                    <div 
                      className="absolute inset-y-0 left-48 right-0"
                    >
                      {/* Caja de la pista de audio */}
                      <div 
                        className={cn(
                          "absolute top-2 bottom-2 rounded-md border-2 flex items-center justify-center",
                          track.muted && "opacity-50"
                        )}
                        style={{
                          left: `${timeToPosition(track.startTime)}%`,
                          width: `${timeToPosition(track.startTime + track.duration) - timeToPosition(track.startTime)}%`,
                          borderColor: trackTypeColors[track.type],
                          backgroundColor: `${trackTypeColors[track.type]}30`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSeek) {
                            onSeek(track.startTime);
                          }
                        }}
                      >
                        {/* Forma de onda */}
                        <div className="absolute inset-0 px-2 overflow-hidden">
                          {renderWaveform(track.waveform, trackTypeColors[track.type])}
                        </div>
                        
                        {/* Marcadores de inicio y fin */}
                        {editingMarkers && (
                          <>
                            <div 
                              className="absolute top-0 left-0 w-2 h-full cursor-ew-resize bg-gray-800 opacity-50 hover:opacity-80"
                              onMouseDown={(e) => {
                                // Implementación de drag para ajustar startTime
                              }}
                            />
                            <div 
                              className="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-gray-800 opacity-50 hover:opacity-80"
                              onMouseDown={(e) => {
                                // Implementación de drag para ajustar duration
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Mensaje si no hay pistas */}
                {audioTracks.length === 0 && (
                  <div className="h-full flex items-center justify-center py-10 text-gray-500">
                    <div className="text-center">
                      <FileAudio className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No hay pistas de audio</p>
                      <p className="text-sm mt-1">Añade una nueva pista haciendo clic en "Añadir pista"</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Marcador de tiempo actual */}
              {renderCurrentTimeMarker()}
            </div>
          </TabsContent>
          
          {/* Vista de lista de pistas */}
          <TabsContent value="tracks">
            <div className="divide-y">
              {audioTracks.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <FileAudio className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No hay pistas de audio</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddDialog(true)}
                    className="mt-4"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Añadir pista
                  </Button>
                </div>
              ) : (
                audioTracks.map(track => (
                  <div 
                    key={track.id}
                    className={cn(
                      "p-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer",
                      selectedTrackId === track.id && "bg-gray-50 dark:bg-gray-900"
                    )}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <div className="flex justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: trackTypeColors[track.type] }}>
                          <Music className="h-5 w-5" style={{ color: trackTypeColors[track.type] }} />
                        </div>
                        
                        <div>
                          <div className="font-medium">
                            {track.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {track.type.charAt(0).toUpperCase() + track.type.slice(1)} • {formatTime(track.duration)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSeek && onSeek(track.startTime);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateTrack(track.id, { muted: !track.muted });
                          }}
                          className="h-8 w-8 p-0"
                        >
                          {track.muted ? (
                            <VolumeX className="h-4 w-4 text-red-500" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTrack(track.id);
                          }}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Controles adicionales de la pista seleccionada */}
                    {selectedTrackId === track.id && (
                      <div className="mt-3 grid grid-cols-2 gap-4">
                        <div className="flex space-x-3 items-center">
                          <div className="flex-1">
                            <Label htmlFor={`volume-${track.id}`} className="text-xs">
                              Volumen
                            </Label>
                            <Slider
                              id={`volume-${track.id}`}
                              value={[track.volume * 100]}
                              min={0}
                              max={100}
                              step={1}
                              className="h-4"
                              onValueChange={(value) => {
                                handleUpdateTrack(track.id, { volume: value[0] / 100 });
                              }}
                            />
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Label htmlFor={`loop-${track.id}`} className="text-xs">
                              Repetir
                            </Label>
                            <Switch
                              id={`loop-${track.id}`}
                              checked={track.loop}
                              onCheckedChange={(checked) => {
                                handleUpdateTrack(track.id, { loop: checked });
                              }}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs mb-1 block">
                            Posición de inicio: {formatTime(track.startTime)}
                          </Label>
                          <Slider
                            value={[track.startTime]}
                            min={0}
                            max={Math.max(0, duration - track.duration)}
                            step={0.1}
                            className="h-4"
                            onValueChange={(value) => {
                              handleUpdateTrack(track.id, { startTime: value[0] });
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <div>
            {audioTracks.length} pistas • Duración total: {formatTime(duration)}
          </div>
          <div>
            {isRecording && (
              <span className="flex items-center text-red-500">
                <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-1"></span>
                Grabando...
              </span>
            )}
            {isSaving && "Guardando..."}
          </div>
        </div>
      </CardFooter>
      
      {/* Dialog para añadir pista */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir nueva pista de audio</DialogTitle>
            <DialogDescription>
              Sube un archivo de audio o utiliza una grabación para añadir una nueva pista.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="track-name">Nombre</Label>
                <Input
                  id="track-name"
                  value={newTrackData.name}
                  onChange={(e) => setNewTrackData({ ...newTrackData, name: e.target.value })}
                  placeholder="Nombre de la pista"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="track-type">Tipo</Label>
                <Select
                  value={newTrackData.type}
                  onValueChange={(value: 'music' | 'vocal' | 'sfx' | 'ambience') => {
                    setNewTrackData({ ...newTrackData, type: value });
                  }}
                >
                  <SelectTrigger id="track-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {trackTypeOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center">
                          {option.icon}
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Subir archivo de audio */}
            <div className="space-y-2">
              <Label>Archivo de audio</Label>
              <div className="border rounded-md p-4 text-center">
                {audioFile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center text-gray-700 dark:text-gray-300">
                      <FileAudio className="h-8 w-8 mr-2" />
                      <div className="text-left">
                        <div className="font-medium">{audioFile.name}</div>
                        <div className="text-xs text-gray-500">
                          {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • {formatTime(newTrackData.duration)}
                        </div>
                      </div>
                    </div>
                    
                    {/* Vista previa de forma de onda */}
                    <div className="mt-2">
                      {renderWaveform(newTrackData.waveform, trackTypeColors[newTrackData.type])}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        // Limpiar archivo
                        if (newTrackData.source && newTrackData.source.startsWith('blob:')) {
                          URL.revokeObjectURL(newTrackData.source);
                        }
                        setAudioFile(null);
                        setNewTrackData({
                          ...newTrackData,
                          source: '',
                          duration: 0,
                          waveform: []
                        });
                      }}
                    >
                      Cambiar archivo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      onClick={() => audioInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo
                    </Button>
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                    <p className="text-xs text-gray-500">
                      Formatos soportados: MP3, WAV, OGG, M4A
                    </p>
                  </div>
                )}
                
                {uploadError && (
                  <div className="mt-2 text-red-500 text-sm">
                    {uploadError}
                  </div>
                )}
                
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-2">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 rounded-full" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Subiendo: {uploadProgress.toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Tiempo de inicio (s)</Label>
                <Input
                  id="start-time"
                  type="number"
                  value={newTrackData.startTime}
                  onChange={(e) => setNewTrackData({ 
                    ...newTrackData, 
                    startTime: parseFloat(e.target.value) 
                  })}
                  min={0}
                  max={duration}
                  step={0.1}
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="track-loop">Reproducir en bucle</Label>
                  <Switch
                    id="track-loop"
                    checked={newTrackData.loop}
                    onCheckedChange={(checked) => {
                      setNewTrackData({ ...newTrackData, loop: checked });
                    }}
                  />
                </div>
                
                <div className="flex justify-between mt-2">
                  <Label htmlFor="track-muted">Silenciar</Label>
                  <Switch
                    id="track-muted"
                    checked={newTrackData.muted}
                    onCheckedChange={(checked) => {
                      setNewTrackData({ ...newTrackData, muted: checked });
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddTrack}
              disabled={!audioFile || !newTrackData.name || isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Subiendo...
                </>
              ) : (
                'Añadir pista'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AudioTrackEditor;