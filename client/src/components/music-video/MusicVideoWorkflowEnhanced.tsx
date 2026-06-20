/**
import { logger } from "../../lib/logger";
 * Enhanced Music Video Workflow
 * Flujo completo integrado con EnhancedTimeline
 * 
 * Pasos:
 * 1. Subir imagen artista + canción
 * 2. Seleccionar director (opcional)
 * 3. Transcribir canción
 * 4. Generar guion con timing
 * 5. Generar imágenes para cada escena
 * 6. Editar en timeline profesional
 * 7. Generar videos con IA
 * 8. Exportar MP4 final
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { EnhancedTimeline, type TimelineClip, type TimelineTrack } from '../professional-editor/EnhancedTimeline';
import { DirectorSelectionModal } from './director-selection-modal';
import {
  Upload,
  Music,
  Image as ImageIcon,
  Wand2,
  Film,
  Download,
  Sparkles,
  CheckCircle2,
  Loader2,
  ChevronRight,
  UserCircle
} from 'lucide-react';

import { generateMusicVideoPrompts } from '../../lib/api/music-video-generator';
import type { MusicVideoScript } from '../../lib/api/music-video-generator';
import {
  convertScriptToTimelineClips,
  generateImagesForScript,
  updateTimelineClipsWithImages,
  saveMusicVideoProject,
  type MusicVideoProject
} from '../../lib/services/music-video-timeline-integration';

type WorkflowStep = 
  | 'upload'
  | 'transcribe'
  | 'script'
  | 'images'
  | 'timeline'
  | 'complete';

export function MusicVideoWorkflowEnhanced() {
  const { toast } = useToast();

  // Estado del proyecto
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [project, setProject] = useState<Partial<MusicVideoProject>>({
    id: `project-${Date.now()}`,
    title: 'Nuevo Video Musical',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Archivos
  const [artistImage, setArtistImage] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artistImagePreview, setArtistImagePreview] = useState<string>('');

  // Estado de procesamiento
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

  // Timeline
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const [currentTime, setCurrentTime] = useState(0);

  /**
   * Paso 1: Subir archivos
   */
  const handleArtistImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArtistImage(file);
      const preview = URL.createObjectURL(file);
      setArtistImagePreview(preview);
      
      toast({
        title: "Imagen del artista cargada",
        description: file.name
      });
    }
  }, [toast]);

  const handleAudioUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      
      // Obtener duración del audio
      const audio = new Audio();
      audio.src = URL.createObjectURL(file);
      audio.addEventListener('loadedmetadata', () => {
        setProject(prev => ({
          ...prev,
          audioDuration: audio.duration
        }));
      });
      
      toast({
        title: "Canción cargada",
        description: `${file.name} (${Math.round(audio.duration || 0)}s)`
      });
    }
  }, [toast]);

  /**
   * Paso 2-5: Generar todo el contenido
   */
  const handleGenerateContent = useCallback(async () => {
    if (!audioFile || !project.audioDuration) {
      toast({
        title: "Falta información",
        description: "Por favor sube una canción primero",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Subir archivos a Firebase Storage
      setProcessingMessage('Subiendo archivos...');
      setProcessingProgress(10);

      const audioUrl = await uploadToStorage(audioFile, 'audio');
      let artistImageUrl = '';
      
      if (artistImage) {
        artistImageUrl = await uploadToStorage(artistImage, 'images');
      }

      setProject(prev => ({
        ...prev,
        audioUrl,
        artistImageUrl
      }));

      // Paso 2: Transcribir (simulado por ahora)
      setCurrentStep('transcribe');
      setProcessingMessage('Transcribiendo canción...');
      setProcessingProgress(20);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      const mockTranscription = "Letra de la canción con timing...";
      
      setProject(prev => ({
        ...prev,
        transcription: mockTranscription
      }));

      // Paso 3: Generar script
      setCurrentStep('script');
      setProcessingMessage('Generando guion cinematográfico...');
      setProcessingProgress(30);

      const script = await generateMusicVideoPrompts(
        mockTranscription,
        project.audioDuration,
        true // isPaid
      );

      setProject(prev => ({
        ...prev,
        script
      }));

      // Paso 4: Convertir script a timeline
      setProcessingMessage('Creando timeline...');
      setProcessingProgress(40);

      const { clips: initialClips, tracks: timelineTracks } = convertScriptToTimelineClips({
        script,
        audioUrl
      });

      setClips(initialClips);
      setTracks(timelineTracks);

      // Paso 5: Generar imágenes
      setCurrentStep('images');
      setProcessingMessage('Generando imágenes para escenas...');

      const generatedImages = await generateImagesForScript({
        script,
        artistImageUrl,
        onProgress: (imgProgress) => {
          const progress = 40 + (imgProgress.current / imgProgress.total) * 40;
          setProcessingProgress(progress);
          setProcessingMessage(`Generando imagen ${imgProgress.current}/${imgProgress.total}`);
        }
      });

      // Actualizar clips con imágenes
      const clipsWithImages = updateTimelineClipsWithImages(initialClips, generatedImages);
      setClips(clipsWithImages);

      setProject(prev => ({
        ...prev,
        generatedImages,
        timelineClips: clipsWithImages
      }));

      // Completado
      setCurrentStep('timeline');
      setProcessingProgress(100);
      setProcessingMessage('¡Listo para editar!');

      toast({
        title: "Contenido generado exitosamente",
        description: `${script.total_scenes} escenas creadas en ${script.total_duration}s`
      });

    } catch (error: any) {
      logger.error('Error generando contenido:', error);
      toast({
        title: "Error generando contenido",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [audioFile, artistImage, project.audioDuration, toast]);

  /**
   * Guardar proyecto
   */
  const handleSaveProject = useCallback(async () => {
    const result = await saveMusicVideoProject(project as MusicVideoProject);
    
    if (result.success) {
      toast({
        title: "Proyecto guardado",
        description: `ID: ${result.projectId}`
      });
    } else {
      toast({
        title: "Error guardando proyecto",
        description: result.error,
        variant: "destructive"
      });
    }
  }, [project, toast]);

  /**
   * Helper: Subir archivo a Firebase Storage
   */
  const uploadToStorage = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error subiendo archivo');
    }

    const result = await response.json();
    return result.url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-white flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-orange-500" />
            Music Video Creator
          </h1>
          <p className="text-zinc-400">
            Crea videos musicales profesionales con IA en minutos
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {[
                { id: 'upload', icon: Upload, label: 'Subir' },
                { id: 'transcribe', icon: Music, label: 'Transcribir' },
                { id: 'script', icon: Film, label: 'Guion' },
                { id: 'images', icon: ImageIcon, label: 'Imágenes' },
                { id: 'timeline', icon: Wand2, label: 'Timeline' }
              ].map((step, index, array) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex flex-col items-center ${
                    currentStep === step.id ? 'text-orange-500' : 
                    array.findIndex(s => s.id === currentStep) > index ? 'text-green-500' : 
                    'text-zinc-600'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                      currentStep === step.id ? 'border-orange-500 bg-orange-500/10' :
                      array.findIndex(s => s.id === currentStep) > index ? 'border-green-500 bg-green-500/10' :
                      'border-zinc-700 bg-zinc-800'
                    }`}>
                      {array.findIndex(s => s.id === currentStep) > index ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <step.icon className="h-6 w-6" />
                      )}
                    </div>
                    <span className="text-xs mt-2">{step.label}</span>
                  </div>
                  {index < array.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-zinc-700 mx-2" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Upload */}
        {currentStep === 'upload' && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle>Paso 1: Sube tu contenido</CardTitle>
              <CardDescription>
                Imagen del artista y canción para crear el video
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Artist Image */}
              <div className="space-y-2">
                <Label>Imagen del Artista (Opcional)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleArtistImageUpload}
                    className="flex-1"
                    data-testid="input-artist-image"
                  />
                  {artistImagePreview && (
                    <img
                      src={artistImagePreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-lg object-cover"
                    />
                  )}
                </div>
              </div>

              {/* Audio File */}
              <div className="space-y-2">
                <Label>Canción (MP3, WAV)</Label>
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  data-testid="input-audio-file"
                />
                {project.audioDuration && (
                  <p className="text-sm text-zinc-400">
                    Duración: {Math.round(project.audioDuration)}s
                  </p>
                )}
              </div>

              <Button
                onClick={handleGenerateContent}
                disabled={!audioFile || isProcessing}
                className="w-full bg-orange-600 hover:bg-orange-700"
                data-testid="button-generate-content"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Generar Video Musical
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Processing Progress */}
        {isProcessing && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{processingMessage}</span>
                  <span className="text-white font-medium">{processingProgress}%</span>
                </div>
                <Progress value={processingProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Timeline Editor */}
        {currentStep === 'timeline' && clips.length > 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Editor de Timeline</CardTitle>
                  <CardDescription className="mt-1">
                    {clips.filter(c => c.type !== 'audio').length} escenas • {project.script?.total_duration}s
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSaveProject}
                    data-testid="button-save-project"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Guardar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <EnhancedTimeline
                clips={clips}
                tracks={tracks}
                duration={project.script?.total_duration || 60}
                currentTime={currentTime}
                onClipsChange={setClips}
                onSeek={setCurrentTime}
              />
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        {currentStep === 'timeline' && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="font-medium text-white">Generar Videos</p>
                    <p className="text-zinc-400">Convierte imágenes en videos animados</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Film className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-white">Editar Timeline</p>
                    <p className="text-zinc-400">Ajusta timing y transiciones</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-white">Exportar MP4</p>
                    <p className="text-zinc-400">Descarga tu video final</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default MusicVideoWorkflowEnhanced;
