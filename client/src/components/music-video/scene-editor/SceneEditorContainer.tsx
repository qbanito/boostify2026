/**
import { logger } from "../../lib/logger";
 * Componente SceneEditorContainer
 * Contenedor principal que gestiona múltiples editores de escenas y los integra con el timeline
 */
import React, { useState, useEffect } from 'react';
import { SceneEditor, SceneData } from './SceneEditor';
import { ScrollArea } from "../../ui/scroll-area";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { 
  Plus, 
  Save, 
  Download, 
  Upload, 
  Trash, 
  ChevronRight, 
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from "../../ui/card";
import { useToast } from "../../../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Separator } from "../../ui/separator";

// Tipos para la integración con el sistema de timeline
export interface TimelineClip {
  id: number;
  start: number;
  duration: number;
  type: string;
  layer: number;
  title: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  imagePrompt?: string;
}

// Props del contenedor
interface SceneEditorContainerProps {
  // Datos del timeline actual
  clips?: TimelineClip[];
  selectedClipId?: number;
  
  // Handlers para interacción con el timeline
  onClipUpdate?: (clipId: number, updates: Partial<TimelineClip>) => void;
  onRegenerateClipImage?: (clipId: number) => Promise<void>;
  onAddClip?: (clip: Omit<TimelineClip, 'id'>) => void;
  onSaveScenes?: () => Promise<void>;
  
  // Indicadores de estado
  isGenerating?: boolean;
  isProcessing?: boolean;
}

/**
 * Convierte un clip del timeline en datos de escena para el editor
 */
function mapClipToSceneData(clip: TimelineClip): SceneData {
  return {
    id: clip.id.toString(),
    prompt: clip.imagePrompt || clip.description || clip.title,
    shotType: getShotTypeFromPrompt(clip.imagePrompt || ''),
    imageUrl: clip.imageUrl,
    motionSettings: {
      intensity: 50,
      seed: Math.floor(Math.random() * 1000000).toString(),
      duration: `${Math.round(clip.duration / 1000)}s`
    },
    autoSfx: false
  };
}

/**
 * Extrae el tipo de plano del prompt si está disponible
 */
function getShotTypeFromPrompt(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('wide shot') || lowerPrompt.includes('plano general')) {
    return 'wide shot';
  } else if (lowerPrompt.includes('medium shot') || lowerPrompt.includes('plano medio')) {
    return 'medium shot';
  } else if (lowerPrompt.includes('close-up') || lowerPrompt.includes('primer plano')) {
    return 'close-up';
  } else if (lowerPrompt.includes('extreme close-up') || lowerPrompt.includes('plano detalle')) {
    return 'extreme close-up';
  }
  return 'medium shot'; // Valor predeterminado
}

/**
 * Actualiza un prompt de clip incluyendo información de tipo de plano y composición
 */
function buildEnhancedPrompt(sceneData: SceneData): string {
  // Comenzar con el prompt base
  let enhancedPrompt = sceneData.prompt;
  
  // Verificar si ya incluye el tipo de plano
  const hasShot = enhancedPrompt.toLowerCase().includes(sceneData.shotType.toLowerCase());
  if (!hasShot) {
    enhancedPrompt = `${sceneData.shotType}, ${enhancedPrompt}`;
  }
  
  // Añadir composición si existe
  if (sceneData.composition && !enhancedPrompt.toLowerCase().includes(sceneData.composition.toLowerCase())) {
    enhancedPrompt = `${enhancedPrompt}, with ${sceneData.composition}`;
  }
  
  return enhancedPrompt;
}

export function SceneEditorContainer({
  clips = [],
  selectedClipId,
  onClipUpdate,
  onRegenerateClipImage,
  onAddClip,
  onSaveScenes,
  isGenerating = false,
  isProcessing = false
}: SceneEditorContainerProps) {
  const { toast } = useToast();
  const [activeScene, setActiveScene] = useState<SceneData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("editor");
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  
  // Actualizar la escena activa cuando cambia el clip seleccionado o los clips
  useEffect(() => {
    if (selectedClipId && clips.length > 0) {
      const selectedClip = clips.find(clip => clip.id === selectedClipId);
      if (selectedClip) {
        setActiveScene(mapClipToSceneData(selectedClip));
      }
    } else if (clips.length > 0) {
      setActiveScene(mapClipToSceneData(clips[0]));
    } else {
      setActiveScene(null);
    }
  }, [clips, selectedClipId]);

  const handleSceneUpdate = (updatedScene: SceneData) => {
    if (!onClipUpdate || !activeScene) return;
    
    // Crear un prompt mejorado que incluya tipo de plano y composición
    const enhancedPrompt = buildEnhancedPrompt(updatedScene);
    
    // Actualizar el clip en el timeline
    onClipUpdate(parseInt(updatedScene.id), {
      imagePrompt: enhancedPrompt,
      title: updatedScene.prompt.substring(0, 30) + (updatedScene.prompt.length > 30 ? '...' : '')
    });
    
    toast({
      title: "Escena actualizada",
      description: "Los cambios han sido aplicados al timeline."
    });
  };

  const handleRegenerateImage = async (sceneId: string) => {
    if (!onRegenerateClipImage) return;
    
    try {
      setIsRegenerating(sceneId);
      await onRegenerateClipImage(parseInt(sceneId));
      toast({
        title: "Imagen regenerada",
        description: "La nueva imagen ha sido generada con éxito."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo regenerar la imagen.",
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(null);
    }
  };

  const navigateToScene = (direction: 'prev' | 'next') => {
    if (!activeScene || clips.length <= 1) return;
    
    const currentIndex = clips.findIndex(c => c.id.toString() === activeScene.id);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : clips.length - 1;
    } else {
      newIndex = currentIndex < clips.length - 1 ? currentIndex + 1 : 0;
    }
    
    setActiveScene(mapClipToSceneData(clips[newIndex]));
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="editor">Editor de Escenas</TabsTrigger>
              <TabsTrigger value="batch">Procesamiento por Lotes</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2">
              {onSaveScenes && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onSaveScenes}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Guardar
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="editor" className="mt-0">
            {clips.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <p className="text-lg text-muted-foreground mb-4">
                  No hay escenas en el timeline aún
                </p>
                {onAddClip && (
                  <Button onClick={() => {
                    onAddClip({
                      start: 0,
                      duration: 5000,
                      type: 'image',
                      layer: 1,
                      title: 'Nueva escena',
                      description: 'Descripción de la escena',
                      imagePrompt: 'medium shot, cinematic scene with dramatic lighting'
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Añadir Escena
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Navegación entre escenas */}
                {clips.length > 1 && (
                  <div className="flex items-center justify-between mb-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateToScene('prev')}
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Escena {clips.findIndex(c => activeScene && c.id.toString() === activeScene.id) + 1} de {clips.length}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateToScene('next')}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}

                {/* Editor de escena activa */}
                {activeScene && (
                  <SceneEditor 
                    scene={activeScene}
                    onUpdate={handleSceneUpdate}
                    onRegenerateImage={handleRegenerateImage}
                    isRegenerating={isRegenerating === activeScene.id}
                  />
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="batch" className="mt-0">
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <h3 className="font-medium mb-2">Procesamiento por Lotes</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Aplica cambios a múltiples escenas de forma simultánea.
                </p>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm">Regenerar todas las imágenes</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Regenera todas las imágenes usando los prompts actuales.
                    </p>
                    <Button 
                      variant="default" 
                      disabled={isGenerating || clips.length === 0}
                      onClick={async () => {
                        if (!onRegenerateClipImage) return;
                        
                        try {
                          toast({
                            title: "Iniciando regeneración",
                            description: `Procesando ${clips.length} imágenes...`,
                          });
                          
                          // Procesar todas las escenas en secuencia
                          for (const clip of clips) {
                            setIsRegenerating(clip.id.toString());
                            await onRegenerateClipImage(clip.id);
                            // Pequeña pausa para evitar sobrecarga de la API
                            await new Promise(r => setTimeout(r, 500));
                          }
                          
                          toast({
                            title: "Regeneración completada",
                            description: `Se han regenerado ${clips.length} imágenes con éxito.`,
                          });
                        } catch (error) {
                          toast({
                            title: "Error en el proceso",
                            description: "No se pudieron regenerar todas las imágenes.",
                            variant: "destructive"
                          });
                        } finally {
                          setIsRegenerating(null);
                        }
                      }}
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerar {clips.length} imágenes
                        </>
                      )}
                    </Button>
                  </div>

                  <Separator />

                  {/* Más opciones de procesamiento por lotes se pueden añadir aquí */}
                  <div>
                    <Label className="text-sm">Aplicar estilo uniforme</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Aplica la misma composición y estilo visual a todas las escenas.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                      <div>
                        <Label className="text-xs">Estilo visual</Label>
                        <Input placeholder="Ej: cinematográfico con luces dramáticas" className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Paleta de colores</Label>
                        <Input placeholder="Ej: tonos azules y cian" className="h-8" />
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      disabled={clips.length === 0}
                    >
                      Aplicar a todas las escenas
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}