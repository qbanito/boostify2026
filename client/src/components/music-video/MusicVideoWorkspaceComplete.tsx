/**
import { logger } from "@/lib/logger";
 * Workspace Completo para Creación de Videos Musicales con IA
 * Sistema profesional con timeline sincronizado, generación automática y referencias faciales
 */
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { 
  Plus, 
  Download, 
  Upload, 
  Wand2,
  Trash2,
  Play,
  Music,
  Image as ImageIcon,
  Users,
  Sparkles,
  Film,
  Loader2,
  Edit3
} from 'lucide-react';
import { CinematicSceneEditor, type CinematicSceneData } from './CinematicSceneEditor';
import { useToast } from "../../hooks/use-toast";
import { useAuth } from '../../hooks/use-auth';
import { useAuth as useClerkAuth } from "@clerk/clerk-react";
import { musicVideoProjectService } from '../../lib/services/music-video-project-service';
import { useLocation } from 'wouter';

// Estilos de edición disponibles
const editingStyles = [
  { id: "cinematic", name: "Cinematográfico", description: "Cortes largos y cinematográficos", duration: { min: 3, max: 8 } },
  { id: "music_video", name: "Video Musical", description: "Cortes rápidos y dinámicos estilo MTV", duration: { min: 1, max: 3 } },
  { id: "dynamic", name: "Dinámico", description: "Adapta a la energía de la música", duration: { min: 1.5, max: 4 } },
  { id: "slow", name: "Lento", description: "Transiciones suaves", duration: { min: 5, max: 10 } },
  { id: "rhythmic", name: "Rítmico", description: "Cortes en cada beat", duration: { min: 1, max: 2 } },
];

interface ReferenceImage {
  id: number;
  file: File;
  preview: string;
  base64: string;
}

interface AudioFile {
  file: File;
  name: string;
  duration: number;
  size: string;
  url: string;
}

interface MusicVideoWorkspaceCompleteProps {
  projectName?: string;
}

export function MusicVideoWorkspaceComplete({ 
  projectName = "Mi Video Musical"
}: MusicVideoWorkspaceCompleteProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { getToken } = useClerkAuth(); // Para obtener token de autenticación
  const [, setLocation] = useLocation();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [scenes, setScenes] = useState<CinematicSceneData[]>(getDefaultScenes());
  const [selectedSceneId, setSelectedSceneId] = useState<number>(scenes[0]?.id || 1);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<number | null>(null);
  const [editingStyle, setEditingStyle] = useState<string>("cinematic");
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Función para convertir File a base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Extraer solo la parte base64 (sin el prefijo data:image/...)
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Manejo de carga de imágenes de referencia
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newImages: ReferenceImage[] = [];
    
    for (let i = 0; i < Math.min(files.length, 3 - referenceImages.length); i++) {
      const file = files[i];
      const preview = URL.createObjectURL(file);
      const base64 = await fileToBase64(file);
      
      newImages.push({
        id: Date.now() + i,
        file,
        preview,
        base64
      });
    }

    setReferenceImages(prev => [...prev, ...newImages]);
    
    if (newImages.length > 0) {
      setSelectedReferenceId(newImages[0].id);
      toast({
        title: "Imágenes cargadas",
        description: `Se han cargado ${newImages.length} imagen(es) de referencia.`
      });
    }

    event.target.value = '';
  };

  const handleDeleteReference = (id: number) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
    if (selectedReferenceId === id) {
      setSelectedReferenceId(null);
    }
    toast({
      title: "Imagen eliminada",
      description: "La imagen de referencia ha sido eliminada."
    });
  };

  // Manejo de carga de archivos de audio
  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    // Validar que sea un archivo de audio válido (por tipo MIME o extensión)
    const isValidType = fileType.includes('audio') || 
                        fileName.endsWith('.wav') || 
                        fileName.endsWith('.mp3') ||
                        fileName.endsWith('.m4a') ||
                        fileName.endsWith('.aac') ||
                        fileName.endsWith('.flac') ||
                        fileName.endsWith('.ogg');
    
    if (!isValidType) {
      toast({
        title: "Formato no soportado",
        description: "Solo se permiten archivos de audio.",
        variant: "destructive"
      });
      event.target.value = '';
      return;
    }

    // Validar tamaño (máximo 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: "Archivo demasiado grande",
        description: "El archivo de audio no debe superar los 50MB.",
        variant: "destructive"
      });
      event.target.value = '';
      return;
    }

    try {
      // Crear URL del archivo
      const url = URL.createObjectURL(file);
      
      // Obtener duración del audio
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          resolve();
        });
      });

      const duration = audio.duration;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      // Formatear tamaño del archivo
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const sizeText = `${sizeMB} MB`;

      const audioData: AudioFile = {
        file,
        name: file.name,
        duration,
        size: sizeText,
        url
      };

      setAudioFile(audioData);
      
      toast({
        title: "Audio cargado",
        description: `${file.name} (${durationText}, ${sizeText}) cargado exitosamente.`
      });

    } catch (error) {
      logger.error('Error al cargar audio:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el archivo de audio.",
        variant: "destructive"
      });
    }

    event.target.value = '';
  };

  const handleRemoveAudio = () => {
    if (audioFile?.url) {
      URL.revokeObjectURL(audioFile.url);
    }
    setAudioFile(null);
    toast({
      title: "Audio eliminado",
      description: "El archivo de audio ha sido eliminado."
    });
  };

  const handleTranscribeAudio = async () => {
    if (!audioFile) return;

    setIsTranscribing(true);
    
    try {
      toast({
        title: "Transcribiendo audio",
        description: "Este proceso puede tardar algunos minutos..."
      });

      // Obtener token de Clerk para autenticación
      const authToken = await getToken();
      
      const formData = new FormData();
      formData.append('audio', audioFile.file);

      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al transcribir el audio');
      }

      logger.info('Transcripción completa:', data.transcription);

      toast({
        title: "Transcripción completa",
        description: `Audio transcrito exitosamente. ${data.transcription.text.length} caracteres.`
      });

      // Aquí podrías actualizar el estado con la transcripción
      // Por ejemplo: setTranscription(data.transcription.text);

    } catch (error: any) {
      logger.error('Error al transcribir:', error);
      toast({
        title: "Error en transcripción",
        description: error.message || "No se pudo transcribir el audio. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSceneUpdate = (updatedScene: CinematicSceneData) => {
    setScenes(prev => 
      prev.map(scene => scene.id === updatedScene.id ? updatedScene : scene)
    );
  };

  const handleAddScene = () => {
    const newId = Math.max(...scenes.map(s => s.id)) + 1;
    const newScene: CinematicSceneData = {
      id: newId,
      scene: "Nueva escena",
      camera: "ARRI Alexa LF, lente 35mm",
      lighting: "Iluminación natural",
      style: "Cinematográfico moderno",
      movement: "Plano estático"
    };
    setScenes(prev => [...prev, newScene]);
    setSelectedSceneId(newId);
  };

  const handleDeleteScene = (sceneId: number) => {
    if (scenes.length <= 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe haber al menos una escena.",
        variant: "destructive"
      });
      return;
    }

    setScenes(prev => prev.filter(s => s.id !== sceneId));
    if (selectedSceneId === sceneId) {
      const remainingScenes = scenes.filter(s => s.id !== sceneId);
      setSelectedSceneId(remainingScenes[0]?.id || 1);
    }
  };

  const handleExportJSON = () => {
    const exportData = scenes.map(scene => ({
      id: scene.id,
      scene: scene.scene,
      camera: scene.camera,
      lighting: scene.lighting,
      style: scene.style,
      movement: scene.movement
    }));

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '_')}_scenes.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "JSON exportado",
      description: "El archivo JSON con las escenas ha sido descargado."
    });
  };

  const handleGenerateAllImages = async () => {
    setIsGeneratingAll(true);
    setGenerationProgress(0);
    
    try {
      const selectedReference = referenceImages.find(img => img.id === selectedReferenceId);
      
      toast({
        title: "Generando video completo",
        description: selectedReference 
          ? `Generando ${scenes.length} cortes con rostro de referencia...`
          : `Generando ${scenes.length} cortes...`
      });

      // Usar FAL nano-banana para generación de imágenes
      const prompts = scenes.map(scene => scene.description || scene.prompt || `Scene ${scene.id}`);
      
      const response = await fetch('/api/fal/nano-banana/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompts: prompts,
          aspectRatio: '16:9',
          ...(selectedReference && { referenceImages: [selectedReference.base64 || selectedReference.url] })
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // FAL batch returns results as an array with index property
        const updatedScenes = scenes.map((scene, index) => {
          const result = data.results?.find((r: any) => r.index === index) || data.results?.[index];
          if (result?.success && result.imageUrl) {
            return { ...scene, imageUrl: result.imageUrl };
          }
          return scene;
        });

        setScenes(updatedScenes);
        setGenerationProgress(100);

        const successCount = data.successCount || data.results?.filter((r: any) => r.success).length || 0;
        
        toast({
          title: "Video generado",
          description: `${successCount} de ${scenes.length} cortes generados exitosamente.`
        });
      } else {
        throw new Error(data.error || 'Error al generar imágenes');
      }
    } catch (error: any) {
      logger.error('Error generando video:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el video. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingAll(false);
      setGenerationProgress(0);
    }
  };

  // Función para guardar y abrir en editor profesional
  const handleOpenInProfessionalEditor = async () => {
    if (!user) {
      toast({
        title: "Autenticación requerida",
        description: "Debes iniciar sesión para usar el editor profesional",
        variant: "destructive",
      });
      return;
    }

    if (!audioFile) {
      toast({
        title: "Audio requerido",
        description: "Debes cargar un archivo de audio antes de abrir en el editor profesional",
        variant: "destructive",
      });
      return;
    }

    setIsSavingProject(true);
    try {
      // Convertir scenes a TimelineItems
      const timelineItems = scenes.map((scene, index) => {
        const startTime = index * 5000; // 5 segundos por escena por defecto
        const duration = 5000;
        
        return {
          id: scene.id,
          group: 1, // Capa 1 por defecto
          start_time: startTime,
          end_time: startTime + duration,
          duration: duration,
          title: scene.scene.substring(0, 30) + '...',
          imageUrl: scene.imageUrl,
          imagePrompt: scene.scene,
          shotType: scene.camera,
          type: 'image',
          metadata: {
            lighting: scene.lighting,
            style: scene.style,
            movement: scene.movement,
          }
        };
      });

      // Calcular duración total
      const totalDuration = scenes.length * 5; // en segundos

      // Guardar proyecto
      const savedProjectId = await musicVideoProjectService.saveProject(
        user.id.toString(),
        projectName,
        {
          audioUrl: audioFile.url,
          timelineItems: timelineItems,
          artistReferences: referenceImages.map(img => img.preview),
          editingStyle: editingStyle,
          duration: totalDuration
        },
        currentProjectId || undefined
      );

      setCurrentProjectId(savedProjectId);

      toast({
        title: "Proyecto guardado",
        description: "Abriendo en editor profesional...",
      });

      // Navegar al editor profesional con el projectId
      setTimeout(() => {
        setLocation(`/professional-editor?projectId=${savedProjectId}`);
      }, 500);

    } catch (error) {
      logger.error('Error saving project:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el proyecto",
        variant: "destructive",
      });
    } finally {
      setIsSavingProject(false);
    }
  };

  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  return (
    <div className="flex flex-col h-full gap-3 p-3 md:p-4 bg-background">
      {/* Header con controles */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 px-4 md:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <Music className="h-5 w-5" />
                {projectName}
              </CardTitle>
              
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJSON}
                  data-testid="button-export-json"
                  className="text-xs md:text-sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Exportar JSON
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenInProfessionalEditor}
                  disabled={isSavingProject || !audioFile}
                  data-testid="button-open-professional-editor"
                  className="text-xs md:text-sm"
                >
                  {isSavingProject ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4 mr-1" />
                      Editor Profesional
                    </>
                  )}
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerateAllImages}
                  disabled={isGeneratingAll || scenes.length === 0}
                  data-testid="button-generate-video"
                  className="text-xs md:text-sm"
                >
                  {isGeneratingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Generando {generationProgress}%
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generar Video
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Estilo de edición, audio y referencias */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="editing-style" className="text-xs md:text-sm">Estilo de Edición</Label>
                <Select value={editingStyle} onValueChange={setEditingStyle}>
                  <SelectTrigger id="editing-style" className="text-xs md:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editingStyles.map((style) => (
                      <SelectItem key={style.id} value={style.id} className="text-xs md:text-sm">
                        {style.name} - {style.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs md:text-sm flex items-center gap-1">
                  <Music className="h-3 w-3" />
                  Audio para Transcripción
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => audioInputRef.current?.click()}
                    disabled={!!audioFile}
                    className="flex-1 text-xs md:text-sm"
                    data-testid="button-upload-audio"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {audioFile ? 'Audio Cargado' : 'Importar WAV/MP3'}
                  </Button>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/aac,audio/x-m4a,audio/ogg,audio/webm,audio/flac"
                    className="hidden"
                    onChange={handleAudioUpload}
                    data-testid="input-audio-file"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs md:text-sm flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Imágenes de Referencia ({referenceImages.length}/3)
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={referenceImages.length >= 3}
                    className="flex-1 text-xs md:text-sm"
                    data-testid="button-upload-image"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Subir Imagen
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
            </div>

            {/* Información del audio cargado */}
            {audioFile && (
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Music className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={audioFile.name}>
                          {audioFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tamaño: {audioFile.size} • Duración: {Math.floor(audioFile.duration / 60)}:{Math.floor(audioFile.duration % 60).toString().padStart(2, '0')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTranscribeAudio}
                        disabled={isTranscribing}
                        className="text-xs"
                        data-testid="button-transcribe-audio"
                      >
                        {isTranscribing ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Transcribiendo...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-3 w-3 mr-1" />
                            Transcribir
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAudio}
                        disabled={isTranscribing}
                        className="text-xs h-8 w-8 p-0"
                        data-testid="button-remove-audio"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Referencias visuales */}
            {referenceImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {referenceImages.map((img) => (
                  <div
                    key={img.id}
                    className={`relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                      selectedReferenceId === img.id 
                        ? 'border-primary shadow-lg' 
                        : 'border-transparent hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedReferenceId(img.id)}
                  >
                    <img 
                      src={img.preview} 
                      alt="Referencia" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteReference(img.id);
                      }}
                      className="absolute top-0 right-0 p-1 bg-destructive text-destructive-foreground rounded-bl-md"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Timeline y Editor */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 overflow-hidden min-h-0">
        {/* Timeline de escenas */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base flex items-center gap-1">
                <Film className="h-4 w-4" />
                Timeline ({scenes.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleAddScene}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-1 p-3">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className={`
                      flex items-center gap-2 p-2 rounded-md cursor-pointer
                      transition-all text-xs md:text-sm
                      ${selectedSceneId === scene.id 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'hover:bg-muted'}
                    `}
                    onClick={() => setSelectedSceneId(scene.id)}
                    data-testid={`scene-item-${scene.id}`}
                  >
                    {scene.imageUrl ? (
                      <img 
                        src={scene.imageUrl} 
                        alt={`Corte ${scene.id}`}
                        className="w-12 h-8 md:w-16 md:h-10 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-8 md:w-16 md:h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="h-4 w-4 opacity-50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Corte #{scene.id}</p>
                      <p className="text-xs truncate opacity-80">
                        {scene.scene.substring(0, 30)}...
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteScene(scene.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Editor de escena seleccionada */}
        <div className="lg:col-span-3 overflow-auto">
          {selectedScene ? (
            <CinematicSceneEditor
              key={selectedScene.id}
              scene={selectedScene}
              onUpdate={handleSceneUpdate}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <p className="text-muted-foreground text-sm md:text-base">
                Selecciona o añade una escena
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// Escenas de ejemplo por defecto
function getDefaultScenes(): CinematicSceneData[] {
  return [
    {
      id: 1,
      scene: "Plano general: el artista camina con paso firme sobre la pista de un aeropuerto privado al atardecer. Detrás se observan jets ejecutivos alineados, hangares blancos y luces cálidas encendiéndose.",
      camera: "ARRI Alexa LF, lente 35mm anamórfico, formato 2.39:1",
      lighting: "golden hour cálida con flare solar lateral, reflejos metálicos sobre los jets y sombras largas",
      style: "Bruno Aveillan – lujo cinematográfico con atmósfera de poder y éxito",
      movement: "travelling frontal lento con ligero paneo hacia el skyline iluminado al fondo"
    },
    {
      id: 2,
      scene: "Plano medio: el artista se detiene junto a un jet privado Gulfstream G700, mira hacia cámara con expresión seria, el viento mueve su camisa mientras las hélices giran en el fondo.",
      camera: "Sony Venice 8K, lente 50mm con filtro ND suave, enfoque en el rostro",
      lighting: "puesta de sol intensa detrás del avión, tonos naranjas y dorados con flare natural",
      style: "look cinematográfico premium, contraste entre el cielo cálido y el metal frío de los jets",
      movement: "cámara en slow motion acercándose lentamente hasta plano cerrado"
    },
    {
      id: 3,
      scene: "Plano aéreo con drone: el artista camina por la pista entre dos jets privados mientras un tercer avión despega al fondo. La ciudad brilla en el horizonte bajo el último sol del día.",
      camera: "drone 8K, lente gran angular 24mm",
      lighting: "cielo anaranjado con reflejos rosados y luces de pista encendiéndose",
      style: "cine de lujo internacional, energía de movimiento y grandeza visual",
      movement: "ascenso lento en espiral para capturar el jet despegando y el artista en tierra"
    }
  ];
}
