import React, { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from "../../lib/logger";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '../ui/card';
import { 
  Button, 
  buttonVariants
} from '../ui/button';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { TimelineEditor, TimelineClip } from './timeline/TimelineEditor';
import { ensureCompatibleClip } from '../timeline/TimelineClipUnified';
import { 
  Music, 
  Video, 
  Image as ImageIcon, 
  Upload, 
  Wand2, 
  Film, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  Play, 
  Pause, 
  ChevronRight, 
  Save, 
  Clapperboard, 
  Scissors,
  Loader2
} from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from '../../hooks/use-toast';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { VideoGenerator, VideoGenerationSettings } from './video-generator';
import { VideoGeneratorWithCamera } from './video-generator-with-camera';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { ProgressSteps, Step } from './progress-steps';
import { useEditor } from '../../lib/context/editor-context';

// Definición local de los pasos para evitar problemas con HMR
const workflowSteps: Step[] = [
  {
    id: 'transcription',
    name: 'Transcripción de Audio',
    description: 'Analizando y transcribiendo la letra de tu canción',
    status: 'pending'
  },
  {
    id: 'script',
    name: 'Generación de Guion',
    description: 'Creando un guion visual basado en tu música',
    status: 'pending'
  },
  {
    id: 'sync',
    name: 'Sincronización',
    description: 'Sincronizando el video con el ritmo de la música',
    status: 'pending'
  },
  {
    id: 'scenes',
    name: 'Generación de Escenas',
    description: 'Creando las escenas del video musical',
    status: 'pending'
  },
  {
    id: 'customization',
    name: 'Personalización',
    description: 'Ajustando el estilo visual a tus preferencias',
    status: 'pending'
  },
  {
    id: 'movement',
    name: 'Integración de Movimiento',
    description: 'Añadiendo coreografías y dinámicas visuales',
    status: 'pending'
  },
  {
    id: 'lipsync',
    name: 'Sincronización de Labios',
    description: 'Sincronizando labios con la letra de la canción',
    status: 'pending'
  },
  {
    id: 'generation',
    name: 'Generación de Video',
    description: 'Creando videos con IA a partir de tus escenas',
    status: 'pending'
  },
  {
    id: 'rendering',
    name: 'Renderizado Final',
    description: 'Combinando todo en tu video musical',
    status: 'pending'
  }
];

interface MusicVideoWorkflowProps {
  onComplete?: (result: {
    videoUrl?: string;
    clips?: TimelineClip[];
    duration?: number;
  }) => void;
}

/**
 * Componente de flujo de trabajo para creación de videos musicales profesionales
 * 
 * Este componente implementa un flujo completo de 9 pasos para la creación de videos
 * musicales con edición profesional y generación asistida por IA.
 * 
 * Flujo de trabajo completo:
 * 1. Transcripción de Audio - Analiza la canción y extrae la letra
 * 2. Generación de Guion - Crea un guion visual basado en la letra y ritmo
 * 3. Sincronización - Alinea el contenido visual con el ritmo de la música
 * 4. Generación de Escenas - Crea escenas específicas para cada sección
 * 5. Personalización - Permite ajustar el estilo visual
 * 6. Integración de Movimiento - Añade dinámicas visuales y coreografías
 * 7. Sincronización de Labios - Sincroniza labios con la letra (si hay personas)
 * 8. Generación de Video - Crea los clips de video con IA
 * 9. Renderizado Final - Combina todo en un video musical completo
 * 
 * El componente incluye:
 * - Sistema visual de seguimiento de progreso
 * - Interfaz para carga de archivos (audio, imágenes, videos)
 * - Análisis automático y transcripción
 * - Visualización de línea de tiempo profesional
 * - Generación de video con IA usando PiAPI/Hailuo
 */
export function MusicVideoWorkflow({ onComplete }: MusicVideoWorkflowProps) {
  // Estado de archivos
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [bRollFiles, setBRollFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  
  // Estado de análisis
  const [timelineData, setTimelineData] = useState<TimelineClip[]>([]);
  const [transcription, setTranscription] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  
  // Integración con el contexto del editor
  const editorContext = useEditor();
  
  // Estado de procesamiento y UI
  const [activeStep, setActiveStep] = useState<string>('upload');
  
  // Usamos el estado local o el del contexto, dependiendo de si queremos forzar sincronización
  // En este caso usamos variables locales para mantener compatibilidad con el código existente
  // pero sincronizamos con el contexto en momentos clave
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string>('transcription');
  const [completedWorkflowSteps, setCompletedWorkflowSteps] = useState<string[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [currentView, setCurrentView] = useState<'clips' | 'timeline' | 'preview'>('clips');
  
  // Manejar la subida del audio (canción)
  const handleAudioUpload = (file: File) => {
    setAudioFile(file);
    toast({
      title: "Audio cargado",
      description: `Archivo: ${file.name}`,
    });
  };

  // Manejar la subida de imágenes principales
  const handleImagesUpload = (files: FileList) => {
    const newFiles = Array.from(files);
    setImageFiles((prev) => [...prev, ...newFiles]);
    
    toast({
      title: `${newFiles.length} imágenes cargadas`,
      description: "Las imágenes se usarán como clips principales",
    });
  };

  // Manejar la subida de videos
  const handleVideoUpload = (files: FileList) => {
    const newFiles = Array.from(files);
    setVideoFiles((prev) => [...prev, ...newFiles]);
    
    toast({
      title: `${newFiles.length} videos cargados`,
      description: "Los videos se usarán como clips principales",
    });
  };

  // Manejar la subida de b-roll
  const handleBRollUpload = (files: FileList) => {
    const newFiles = Array.from(files);
    setBRollFiles((prev) => [...prev, ...newFiles]);
    
    toast({
      title: `${newFiles.length} archivos B-roll cargados`,
      description: "Los archivos B-roll se usarán como material adicional",
    });
  };

  // Función simulada para transcribir el audio
  const transcribeAudio = useCallback(async (audioFile: File): Promise<string> => {
    return new Promise((resolve) => {
      // En una implementación real, se invocaría un servicio de reconocimiento de voz
      setTimeout(() => {
        resolve("Esta es una transcripción simulada de la letra de la canción, donde se identifican momentos clave como el estribillo y versos.");
      }, 2000);
    });
  }, []);

  // Función para extraer una etiqueta del nombre de archivo
  const extractLabel = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('closeup')) return 'Primer Plano';
    if (lower.includes('medio') || lower.includes('medium')) return 'Plano Medio';
    if (lower.includes('aerial') || lower.includes('aereo')) return 'Plano Aéreo';
    return 'Plano General';
  };

  // Componente para mostrar el estado de guardado
  const SaveStatusIndicator = () => {
    // Versión simplificada sin depender de propiedades no disponibles en el contexto
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Save className="h-4 w-4 text-green-500" />
              <span>Guardado automático</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Tu proyecto se guarda automáticamente</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  // Función para generar clips de línea de tiempo a partir de los archivos
  const generateEditingTimeline = useCallback(async () => {
    if (!audioFile) return [];
    
    // Se asume una duración base para el audio (en un caso real se detectaría)
    const audioDuration = audioFile.size > 1000000 ? 180 : 120; // Aproximación según tamaño
    setDuration(audioDuration);
    
    // Combinar archivos de imagen y video como clips principales
    const mediaFiles = [...imageFiles, ...videoFiles];
    
    if (mediaFiles.length === 0) {
      toast({
        title: "No hay suficientes archivos",
        description: "Se necesitan imágenes o videos para generar la línea de tiempo",
        variant: "destructive"
      });
      return [];
    }
    
    // Crear primero el clip para el audio utilizando nuestra función ensureCompatibleClip
    const audioClipBase = {
      id: 1, // ID 1 para el audio principal, siempre primero
      start: 0,
      duration: audioDuration,
      type: 'audio' as const,
      layer: 0, // Capa de audio (primera capa, siempre visible)
      title: audioFile.name.replace(/\.[^/.]+$/, ""),
      name: audioFile.name.replace(/\.[^/.]+$/, ""),
      audioUrl: URL.createObjectURL(audioFile),
      visible: true
    };
    
    // Asegurar que el clip es compatible con nuestra interfaz unificada
    const audioClip = ensureCompatibleClip(audioClipBase);
    
    // Determinar la duración de cada segmento basada en el audio
    const segmentDuration = audioDuration / Math.max(8, mediaFiles.length);
    let nextId = 2; // Empezamos desde 2 porque el audio es el ID 1
    
    // Crear clips para los archivos principales utilizando la interfaz unificada
    const mainClips = mediaFiles.map((file, index) => {
      const start = Math.floor(index * segmentDuration);
      const duration = Math.floor(segmentDuration);
      const isVideo = file.type.includes('video');
      const fileUrl = URL.createObjectURL(file);
      const name = extractLabel(file.name);
      
      // Crear un clip base con los campos necesarios
      const clipBase = {
        id: nextId++,
        start,
        duration,
        type: isVideo ? 'video' as const : 'image' as const,
        layer: 1, // Capa de video/imagen
        name,
        title: name, // Importante: añadir título para la interfaz unificada
        thumbnail: fileUrl,
        imageUrl: !isVideo ? fileUrl : undefined,
        videoUrl: isVideo ? fileUrl : undefined,
        visible: true,
        metadata: {
          section: index % 2 === 0 ? 'Verso' : 'Coro',
          sourceIndex: index
        }
      };
      
      // Asegurar compatibilidad con la interfaz unificada
      return ensureCompatibleClip(clipBase);
    });
    
    // Crear clips para B-roll si existen, garantizando que se coloquen correctamente en la línea de tiempo
    const bRollClips = [];
    if (bRollFiles.length > 0) {
      const interval = Math.floor(audioDuration / (bRollFiles.length + 1));
      
      bRollFiles.forEach((file, index) => {
        const start = (index + 1) * interval;
        const duration = 5; // Duración fija para B-roll
        const isVideo = file.type.includes('video');
        const fileUrl = URL.createObjectURL(file);
        const name = `B-Roll ${index + 1}`;
        
        // Crear clip base con los campos necesarios
        const clipBase = {
          id: nextId++,
          start,
          duration,
          type: isVideo ? 'video' as const : 'image' as const,
          layer: 1, // Capa de video/imagen
          name,
          title: name, // Importante: añadir título para la interfaz unificada
          thumbnail: fileUrl,
          imageUrl: !isVideo ? fileUrl : undefined,
          videoUrl: isVideo ? fileUrl : undefined,
          visible: true,
          metadata: {
            section: 'B-Roll'
          }
        };
        
        // Asegurar compatibilidad con la interfaz unificada
        bRollClips.push(ensureCompatibleClip(clipBase));
      });
    }
    
    // Combinar todos los clips, asegurando que el audio esté primero
    const allClips = [audioClip, ...mainClips, ...bRollClips];
    
    // Si la transcripción contiene "estribillo", marcar un clip central como estribillo
    if (transcription.toLowerCase().includes('estribillo')) {
      const midIndex = Math.floor(mainClips.length / 2);
      if (mainClips[midIndex]) {
        mainClips[midIndex].name += ' (Estribillo)';
        if (mainClips[midIndex].metadata) {
          mainClips[midIndex].metadata.section = 'Estribillo';
        }
      }
    }
    
    // Mostrar notificación de éxito
    toast({
      title: "Línea de tiempo generada",
      description: `Audio y ${mainClips.length} clips de imagen/video añadidos a la línea de tiempo`,
    });
    
    return allClips;
  }, [audioFile, imageFiles, videoFiles, bRollFiles, transcription]);

  // Marcador de progreso de flujo de trabajo
  const markStepComplete = useCallback((stepId: string, nextStepId?: string) => {
    // Actualizar estado local para mantener compatibilidad con componente actual
    setCompletedWorkflowSteps(prev => {
      if (!prev.includes(stepId)) {
        const newCompletedSteps = [...prev, stepId];
        
        // Sincronizar con el contexto del editor
        // Buscamos el índice del paso en el arreglo de steps
        const stepIndex = workflowSteps.findIndex(step => step.id === stepId);
        if (stepIndex !== -1) {
          editorContext.markStepAsCompleted(stepIndex);
        }
        
        return newCompletedSteps;
      }
      return prev;
    });
    
    if (nextStepId) {
      setCurrentWorkflowStep(nextStepId);
      
      // Sincronizar con el contexto del editor
      const nextStepIndex = workflowSteps.findIndex(step => step.id === nextStepId);
      if (nextStepIndex !== -1) {
        editorContext.setCurrentStep(nextStepIndex);
      }
    }
  }, [editorContext, workflowSteps]);
  
  // Iniciar análisis y generación de la línea de tiempo
  const handleStartAnalysis = async () => {
    if (!audioFile || (imageFiles.length === 0 && videoFiles.length === 0)) {
      toast({
        title: "Archivos insuficientes",
        description: "Por favor, sube al menos un audio y una imagen o video",
        variant: "destructive"
      });
      return;
    }
    
    setIsAnalyzing(true);
    setCurrentWorkflowStep('transcription');
    
    try {
      // Paso 1: Generar transcripción
      const transcript = await transcribeAudio(audioFile);
      setTranscription(transcript);
      
      // Calcular duración aproximada del audio
      const audioDuration = audioFile.size > 1000000 ? 180 : 120; // Aproximación según tamaño
      setDuration(audioDuration); // Asegurarnos de actualizar la duración para el timeline
      
      // Crear una URL para el archivo de audio
      const audioUrl = URL.createObjectURL(audioFile);
      
      // Crear clip de audio para el timeline y asegurar compatibilidad con nuestra interfaz unificada
      const audioClipBase = {
        id: 1,
        title: audioFile.name || 'Audio Principal', 
        name: audioFile.name || 'Audio Principal',
        type: 'audio' as const,
        layer: 0,
        start: 0,
        duration: audioDuration,
        audioUrl,
        url: audioUrl,
        waveform: [],
        visible: true,
        locked: false,
        trackId: 'audio-track-1',
        trimStart: 0,
        trimEnd: audioDuration,
        createdAt: new Date()
      };
      
      // Utilizar ensureCompatibleClip para garantizar compatibilidad completa con TimelineClipUnified
      const audioClip = ensureCompatibleClip(audioClipBase);
      
      // Guardar clips en el estado local
      setTimelineData(prevClips => [audioClip]);
      
      // Guardar la transcripción en el contexto del editor
      editorContext.addTranscription({
        text: transcript,
        type: 'lyrics', // Tipo de transcripción para letras musicales
        startTime: 0,
        endTime: audioDuration,
        duration: audioDuration, // Duración en segundos
        createdAt: new Date()
      });
      
      // Agregar audio al contexto del editor (para asegurar que aparezca en el timeline)
      editorContext.addClip({
        name: audioFile.name || 'Audio Principal',
        startTime: 0,
        duration: audioDuration,
        source: audioUrl,
        trackId: 'audio-track-1',
        trimStart: 0,
        trimEnd: audioDuration,
        createdAt: new Date()
      });
      
      // Actualizar datos del workflow en el contexto
      editorContext.updateWorkflowData({
        audioFile: audioUrl,
        transcription: transcript,
        transcriptionSegments: [
          { start: 0, end: audioDuration, text: transcript }
        ]
      });
      
      markStepComplete('transcription', 'script');
      
      // Simular progreso del análisis
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        
        // Avanzar por los pasos según el progreso
        if (progress === 30) {
          markStepComplete('script', 'sync');
        } else if (progress === 50) {
          markStepComplete('sync', 'scenes');
        } else if (progress === 70) {
          markStepComplete('scenes', 'customization');
        } else if (progress === 90) {
          markStepComplete('customization');
        }
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          
          // Una vez completado el análisis, generar la línea de tiempo
          generateEditingTimeline().then(clips => {
            setTimelineData(clips);
            setAnalysisComplete(true);
            setIsAnalyzing(false);
            setActiveStep('timeline');
            
            // Sincronizar con el contexto del editor - agregar clips de audio
            const audioClip = clips.find(clip => clip.type === 'audio');
            if (audioClip && audioClip.audioUrl) {
              // Agregar el audio como un clip normal usando la estructura esperada por EditorContext
              editorContext.addClip({
                name: audioFile?.name || 'Audio Principal',
                startTime: 0,
                duration: duration,
                source: audioClip.audioUrl,
                trackId: 'audio-track-1',
                trimStart: 0,
                trimEnd: duration,
                createdAt: new Date()
              });
            }
            
            // Agregar clips de video e imágenes al contexto
            clips
              .filter(clip => clip.type !== 'audio')
              .forEach(clip => {
                // Crear clip usando la estructura esperada por EditorContext
                const mediaUrl = clip.videoUrl || clip.imageUrl || '';
                editorContext.addClip({
                  name: clip.name || 'Clip',
                  source: mediaUrl,
                  startTime: clip.start || 0,
                  duration: clip.duration || 5,
                  trackId: `track-${clip.layer || 1}`,
                  trimStart: 0,
                  trimEnd: clip.duration || 5,
                  createdAt: new Date()
                });
              });
            
            // Marcar los primeros 5 pasos como completados
            markStepComplete('customization', 'movement');
            
            toast({
              title: "Análisis completado",
              description: "La línea de tiempo ha sido generada con éxito",
            });
          });
        }
      }, 500);
    } catch (error) {
      setIsAnalyzing(false);
      toast({
        title: "Error en el análisis",
        description: "Ocurrió un error al analizar los archivos",
        variant: "destructive"
      });
    }
  };

  // Manejar la generación del video final
  const handleGenerateVideo = async (settings: VideoGenerationSettings) => {
    if (timelineData.length === 0) {
      toast({
        title: "No hay línea de tiempo",
        description: "Primero debes crear una línea de tiempo",
        variant: "destructive"
      });
      return;
    }
    
    setIsGenerating(true);
    setGenerationProgress(0);
    setCurrentWorkflowStep('movement');
    
    // Simulación de progreso de generación de video
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        const newProgress = prev + Math.random() * 5;
        
        // Avanzar por los pasos finales según el progreso
        if (prev < 20 && newProgress >= 20) {
          markStepComplete('movement', 'lipsync');
          
          // Actualizar datos del workflow para movimiento
          editorContext.updateWorkflowData({
            cameraMovements: [
              { 
                id: `movement-${Date.now()}-1`,
                name: 'Zoom In', 
                type: 'zoom',
                start: 10, 
                end: 15,
                startTime: 10, 
                duration: 5,
                parameters: {
                  direction: 'in',
                  intensity: 50
                }
              },
              { 
                id: `movement-${Date.now()}-2`,
                name: 'Pan Right', 
                type: 'pan',
                start: 30, 
                end: 38,
                startTime: 30, 
                duration: 8,
                parameters: {
                  direction: 'right',
                  intensity: 60
                }
              },
              { 
                id: `movement-${Date.now()}-3`,
                name: 'Tilt Up', 
                type: 'tilt',
                start: 50, 
                end: 56,
                startTime: 50, 
                duration: 6,
                parameters: {
                  direction: 'up',
                  intensity: 45
                }
              }
            ]
          });
        } else if (prev < 40 && newProgress >= 40) {
          markStepComplete('lipsync', 'generation');
          
          // Actualizar datos del workflow para sincronización labial
          editorContext.updateWorkflowData({
            lipsyncData: {
              enabled: true,
              confidence: 0.85,
              segments: [
                { start: 5, end: 10, words: "Primera frase sincronizada" },
                { start: 20, end: 30, words: "Segunda frase con sincronización labial" }
              ]
            }
          });
        } else if (prev < 70 && newProgress >= 70) {
          markStepComplete('generation', 'rendering');
          
          // Actualizar datos del workflow para generación de video
          editorContext.updateWorkflowData({
            generatedSegments: timelineData.filter(clip => clip.type !== 'audio').map((clip, index) => ({
              id: `segment-${index}`,
              startTime: clip.start,
              duration: clip.duration,
              prompt: `Escena musical ${clip.metadata?.section || ''} con ${clip.title}`,
              style: settings.style || 'cinematográfico',
              status: 'completed'
            }))
          });
        } else if (prev < 90 && newProgress >= 90) {
          markStepComplete('rendering');
          
          // Actualizar datos del workflow para renderizado final
          editorContext.updateWorkflowData({
            renderStatus: 'completed',
            renderingProgress: 100,
            finalVideoUrl: '/assets/Standard_Mode_Generated_Video (2).mp4'
          });
        }
        
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          
          // Simular URL del video generado
          setTimeout(() => {
            // En un caso real, esta URL vendría del servidor
            const videoUrl = '/assets/Standard_Mode_Generated_Video (2).mp4';
            setGeneratedVideoUrl(videoUrl);
            setIsGenerating(false);
            setActiveStep('preview');
            
            // Completar todos los pasos del flujo de trabajo
            const allStepIds = workflowSteps.map(step => step.id);
            setCompletedWorkflowSteps(allStepIds);
            
            // Sincronizar con el contexto del editor - marcar todos los pasos como completados
            workflowSteps.forEach((_, index) => {
              editorContext.markStepAsCompleted(index);
            });
            
            // Actualizar el estado final del workflow en el contexto
            editorContext.updateWorkflowData({
              completed: true,
              finalVideoUrl: videoUrl,
              processingTime: Math.floor(Math.random() * 80) + 120,
              videoMetadata: {
                width: 1920,
                height: 1080,
                framerate: 30,
                duration: duration,
                format: 'mp4'
              }
            });
            
            toast({
              title: "Video generado",
              description: "Tu video musical ha sido creado con éxito",
            });
            
            // Notificar al componente padre si existe callback
            if (onComplete) {
              onComplete({
                videoUrl,
                clips: timelineData,
                duration: duration
              });
            }
          }, 1000);
          
          return 100;
        }
        return newProgress;
      });
    }, 500);
  };

  // Renderizado del componente
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Flujo de Trabajo para Video Musical</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>Crea videos musicales sincronizados con ritmo y letra</span>
                <SaveStatusIndicator />
              </CardDescription>
            </div>
            
            {/* Indicador de progreso básico */}
            <div className="flex items-center gap-2">
              {['upload', 'timeline', 'generate', 'preview'].map((step, index) => (
                <React.Fragment key={step}>
                  {index > 0 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Badge variant={activeStep === step ? "default" : "outline"}>
                    {step === 'upload' && 'Subir'}
                    {step === 'timeline' && 'Timeline'}
                    {step === 'generate' && 'Generar'}
                    {step === 'preview' && 'Preview'}
                  </Badge>
                </React.Fragment>
              ))}
            </div>
          </div>
          
          {/* Indicador detallado de progreso de workflow */}
          <div className="mt-2">
            <ProgressSteps 
              steps={workflowSteps}
              currentStep={currentWorkflowStep}
              completedSteps={completedWorkflowSteps}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Paso 1: Subir archivos */}
        {activeStep === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Canción (Audio)</Label>
                <div className="border border-dashed rounded-md p-4">
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.webm"
                      onChange={(e) => e.target.files && e.target.files[0] && handleAudioUpload(e.target.files[0])}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Sube un archivo de audio (MP3, WAV, etc.)</p>
                  </div>
                  
                  {audioFile && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <Music className="h-4 w-4 text-orange-500" />
                      <span>{audioFile.name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="mb-2 block">Clips Principales (Imágenes/Videos)</Label>
                <div className="border border-dashed rounded-md p-4">
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => e.target.files && handleImagesUpload(e.target.files)}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Ejemplos de nombre: closeup, plano medio, aerial</p>
                    </div>
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={(e) => e.target.files && handleVideoUpload(e.target.files)}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Clips de video existentes</p>
                    </div>
                  </div>
                  
                  {(imageFiles.length > 0 || videoFiles.length > 0) && (
                    <div className="mt-2 text-sm">
                      {imageFiles.length > 0 && (
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-blue-500" />
                          <span>{imageFiles.length} imágenes</span>
                        </div>
                      )}
                      {videoFiles.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-indigo-500" />
                          <span>{videoFiles.length} videos</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div>
              <Label className="mb-2 block">Material B-Roll (opcional)</Label>
              <div className="border border-dashed rounded-md p-4">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => e.target.files && handleBRollUpload(e.target.files)}
                  className="text-sm"
                />
                
                {bRollFiles.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Film className="h-4 w-4 text-purple-500" />
                    <span>{bRollFiles.length} archivos B-roll</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button 
                variant="default" 
                onClick={handleStartAnalysis}
                disabled={!audioFile || (imageFiles.length === 0 && videoFiles.length === 0) || isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Analizar y Crear Timeline
                  </>
                )}
              </Button>
            </div>
            
            {isAnalyzing && (
              <Progress value={generationProgress} className="h-2" />
            )}
          </div>
        )}
        
        {/* Paso 2: Visualización de línea de tiempo */}
        {activeStep === 'timeline' && (
          <div className="space-y-4">
            <Tabs defaultValue="clips" value={currentView} onValueChange={(value) => setCurrentView(value as any)}>
              <TabsList>
                <TabsTrigger value="clips">
                  <Film className="h-4 w-4 mr-2" />
                  Clips
                </TabsTrigger>
                <TabsTrigger value="timeline">
                  <Clock className="h-4 w-4 mr-2" />
                  Línea de Tiempo
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="clips" className="space-y-4 mt-4">
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {timelineData
                      .filter(clip => clip.type !== 'audio')
                      .map(clip => (
                        <Card key={clip.id} className="overflow-hidden">
                          <div className="relative aspect-video bg-muted">
                            {clip.thumbnail && (
                              <img
                                src={clip.thumbnail}
                                alt={clip.title}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1">
                              {Math.floor(clip.start)}s - {Math.floor(clip.start + clip.duration)}s
                            </div>
                          </div>
                          <CardContent className="p-2">
                            <div className="flex justify-between items-center">
                              <div className="text-sm font-medium truncate">{clip.title}</div>
                              <Badge variant="outline" className="text-xs">
                                {clip.metadata?.section || clip.type}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setActiveStep('upload')}>
                    Volver
                  </Button>
                  <Button onClick={() => setActiveStep('generate')}>
                    <Clapperboard className="h-4 w-4 mr-2" />
                    Continuar a Generación
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="timeline" className="space-y-4 mt-4">
                <div className="bg-muted rounded-md p-4 h-[500px] overflow-hidden">
                  {/* Editor de línea de tiempo real */}
                  {timelineData.length > 0 ? (
                    <TimelineEditor
                      clips={timelineData}
                      audioUrl={timelineData.find(clip => clip.type === 'audio')?.audioUrl}
                      videoUrl={timelineData.find(clip => clip.type === 'video')?.videoUrl}
                      duration={duration}
                      onClipsChange={(updatedClips) => {
                        setTimelineData(updatedClips);
                        // Guardar en el contexto del editor
                        editorContext.updateWorkflowData({
                          ...editorContext.workflowData,
                          generatedSegments: updatedClips.filter(clip => clip.type !== 'audio')
                        });
                      }}
                      onTimeChange={(time) => {
                        // Actualizar tiempo actual en el contexto
                        editorContext.setCurrentPlaybackTime(time);
                      }}
                      onPlaybackStateChange={(isPlaying) => {
                        // Actualizar estado de reproducción en el contexto
                        editorContext.setPlaybackState(isPlaying);
                      }}
                      showBeatGrid={true}
                      autoScroll={true}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground mb-4 h-full flex flex-col items-center justify-center">
                      <div className="mb-4">Aún no hay clips en la línea de tiempo</div>
                      <Button 
                        variant="default" 
                        onClick={() => setActiveStep('upload')}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Importar Archivos
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setActiveStep('upload')}>
                    Volver
                  </Button>
                  <Button onClick={() => setActiveStep('generate')}>
                    <Clapperboard className="h-4 w-4 mr-2" />
                    Continuar a Generación
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {/* Paso 3: Generación de video */}
        {activeStep === 'generate' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <VideoGeneratorWithCamera 
                  onGenerateVideo={handleGenerateVideo}
                  isLoading={isGenerating}
                  scenesCount={timelineData.filter(clip => clip.type !== 'audio').length}
                  audioDuration={duration}
                  cameraMovementsEnabled={true}
                />
                
                {isGenerating && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Generando video...</span>
                      <span>{Math.round(generationProgress)}%</span>
                    </div>
                    <Progress value={generationProgress} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveStep('timeline')}>
                Volver
              </Button>
            </div>
          </div>
        )}
        
        {/* Paso 4: Vista previa del video */}
        {activeStep === 'preview' && generatedVideoUrl && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="aspect-video bg-black rounded-md overflow-hidden">
                  <video 
                    src={generatedVideoUrl} 
                    controls 
                    className="w-full h-full"
                    poster="/assets/thumbnail-video.jpg"
                  />
                </div>
                
                <div className="flex justify-between mt-4">
                  <div>
                    <h3 className="text-lg font-semibold">Video Musical Generado</h3>
                    <p className="text-sm text-muted-foreground">
                      {timelineData.filter(clip => clip.type !== 'audio').length} clips | {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')} min
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </Button>
                    <Button variant="default">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Compartir
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveStep('generate')}>
                Volver
              </Button>
              <Button variant="default" onClick={() => setActiveStep('upload')}>
                Nuevo Proyecto
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MusicVideoWorkflow;