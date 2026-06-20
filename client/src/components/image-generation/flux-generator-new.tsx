/**
import { logger } from "@/lib/logger";
 * Nuevo Flux Image Generator Component
 * 
 * Este componente proporciona una interfaz dedicada para generar imágenes con PiAPI Flux,
 * utilizando localStorage para almacenamiento y garantizando una sola generación a la vez.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Loader2, Image as ImageIcon, Save, RefreshCw, Trash2 } from 'lucide-react';
import { FluxModel, FluxTaskType, FluxLoraType } from '../../lib/api/flux/flux-service';
import { ImageResult } from '../../lib/types/model-types';
import { fluxLocalStorageService } from '../../lib/api/flux/flux-local-storage-service';
import { useToast } from '../../hooks/use-toast';

// Objeto de URLs de muestra para mostrar durante desarrollo
const SAMPLE_IMAGES = {
  DOG: "https://img.theapi.app/temp/33c6ba8c-7f33-48f1-93c7-c16fd09de9cf.png",
  LANDSCAPE: "https://img.theapi.app/temp/7ec63745-c13a-472c-a93a-a7f1fa7a8606.png",
  ANIME: "https://img.theapi.app/temp/0e8a5243-e530-4774-a6b4-e56c5de48a54.png"
};

interface FluxGeneratorProps {
  onGeneratedImage?: (image: ImageResult) => void;
  onImageSelected?: (image: ImageResult) => void;
  isGenerating?: boolean;
  setIsGenerating?: (isGenerating: boolean) => void;
}

export function FluxGenerator({ 
  onGeneratedImage, 
  onImageSelected, 
  isGenerating: externalIsGenerating, 
  setIsGenerating: externalSetIsGenerating 
}: FluxGeneratorProps) {
  // Estado para inputs del formulario
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState<FluxModel>(FluxModel.FLUX1_DEV);
  const [loraType, setLoraType] = useState<FluxLoraType | ''>('');
  const [useLoRA, setUseLoRA] = useState(false);
  const [loraStrength, setLoraStrength] = useState<number>(0.7); // Valor por defecto 0.7 (70%)
  const [localIsGenerating, localSetIsGenerating] = useState(false);
  
  // Usar el estado externo si se proporciona, si no, usar el estado local
  const isGenerating = externalIsGenerating !== undefined ? externalIsGenerating : localIsGenerating;
  const setIsGenerating = externalSetIsGenerating || localSetIsGenerating;
  
  const [generatedImage, setGeneratedImage] = useState<ImageResult | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<ImageResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('generate');
  
  const { toast } = useToast();
  
  // Cargar imágenes guardadas del localStorage al montar el componente
  useEffect(() => {
    function loadSavedImages() {
      try {
        setIsLoading(true);
        const images = fluxLocalStorageService.getImages();
        
        // Filtrar imágenes sin URLs
        const completedImages = images.filter(img => img.url && img.url.length > 0);
        logger.info(`Loaded ${completedImages.length} saved Flux images from localStorage`);
        
        // Si no hay imágenes, mostrar una imagen de muestra para mejor UX
        if (completedImages.length === 0) {
          // Crear imagen de muestra de perro
          const sampleImage: ImageResult = {
            url: SAMPLE_IMAGES.DOG,
            provider: 'flux-sample',
            taskId: 'sample-dog',
            status: 'COMPLETED',
            prompt: "perro callejero",
            createdAt: new Date(),
            firestoreId: 'sample-dog-id'
          };
          
          // Guardar en localStorage y actualizar estado
          fluxLocalStorageService.saveImage(sampleImage);
          setSavedImages([sampleImage]);
        } else {
          setSavedImages(completedImages);
        }
      } catch (error) {
        logger.error('Error loading saved Flux images:', error);
        toast({
          title: 'Error al cargar imágenes',
          description: 'No se pudieron cargar las imágenes guardadas',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    loadSavedImages();
  }, [toast]);
  
  // Verificar estado de tareas pendientes
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (pendingTaskId) {
      // Determinar el intervalo de verificación (más rápido para tareas simuladas)
      const checkInterval = pendingTaskId.startsWith('simulated-') ? 1000 : 3000;
      
      logger.info(`Configurando verificación de estado para tarea ${pendingTaskId} cada ${checkInterval}ms`);
      
      interval = setInterval(async () => {
        try {
          // Verificar estado de la tarea en el servidor
          const result = await axios.get(`/api/flux/status?taskId=${pendingTaskId}`);
          logger.info('Flux task status update:', result.data);
          
          // Verificar si la tarea está completada
          if (result.data.data && result.data.data.status === 'completed') {
            // Extraer URL de imagen (manejar ambos formatos de respuesta)
            let imageUrl = null;
            
            if (result.data.data.output?.images && result.data.data.output.images.length > 0) {
              imageUrl = result.data.data.output.images[0];
            } 
            else if (result.data.data.output?.image_url) {
              imageUrl = result.data.data.output.image_url;
            }
            
            if (imageUrl) {
              logger.info('URL de imagen encontrada:', imageUrl);
              
              // Marcar la imagen como simulada si viene de una respuesta simulada
              const providerSuffix = result.data.simulated ? '-simulado' : model;
              
              // Crear objeto de imagen completada
              const completedImage: ImageResult = {
                url: imageUrl,
                provider: `flux-${providerSuffix}`,
                taskId: pendingTaskId,
                status: 'COMPLETED',
                prompt: prompt,
                createdAt: new Date()
              };
              
              // Actualizar estados
              setGeneratedImage(completedImage);
              setPendingTaskId(null);
              setIsGenerating(false);
              
              // Guardar en localStorage
              const saveId = fluxLocalStorageService.saveImage(completedImage);
              
              // Añadir a imágenes guardadas
              setSavedImages(prev => 
                [{ ...completedImage, firestoreId: saveId }, ...prev]
              );
              
              // Notificar al componente padre
              if (onGeneratedImage) {
                onGeneratedImage(completedImage);
              }
              
              toast({
                title: 'Imagen Generada',
                description: 'Tu imagen ha sido generada exitosamente',
              });
            } else {
              logger.error('Tarea completada pero no se encontró URL de imagen:', result.data);
              setIsGenerating(false);
              setPendingTaskId(null);
              
              toast({
                title: 'Error de Generación',
                description: 'La imagen se generó pero no pudimos obtener su URL',
                variant: 'destructive'
              });
            }
          } 
          else if (result.data.data && result.data.data.status === 'failed') {
            // Tarea fallida
            setPendingTaskId(null);
            setIsGenerating(false);
            
            toast({
              title: 'Generación Fallida',
              description: 'No se pudo generar la imagen. Por favor intenta de nuevo con un prompt diferente.',
              variant: 'destructive'
            });
          }
        } catch (error) {
          logger.error('Error checking Flux task status:', error);
        }
      }, checkInterval);
    }
    
    // Limpiar intervalo al desmontar
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [pendingTaskId, onGeneratedImage, toast, model, prompt, setIsGenerating]);
  
  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir generación si ya hay una generación en curso
    if (isGenerating) {
      toast({
        title: 'Generación en curso',
        description: 'Por favor espera a que termine la generación actual',
        variant: 'default'
      });
      return;
    }
    
    if (!prompt.trim()) {
      toast({
        title: 'Se requiere descripción',
        description: 'Por favor, ingresa una descripción para la imagen',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // Buscar si tenemos una imagen similar en localStorage
      const similarImage = fluxLocalStorageService.getImages().find(img => 
        img.url && img.prompt && 
        img.prompt.toLowerCase().includes(prompt.toLowerCase().slice(0, 10))
      );
      
      if (similarImage) {
        logger.info('Found similar existing Flux image:', similarImage);
        setGeneratedImage(similarImage);
        setIsGenerating(false);
        
        if (onGeneratedImage) {
          onGeneratedImage(similarImage);
        }
        
        toast({
          title: 'Imagen Similar Encontrada',
          description: 'Encontramos una imagen similar que fue generada previamente',
        });
        return;
      }
      
      // Configurar opciones según si usamos LoRA o no
      const taskType = useLoRA ? FluxTaskType.TXT2IMG_LORA : FluxTaskType.TXT2IMG;
      
      // Llamar a la API para generar una imagen real (una sola a la vez)
      const response = await axios.post('/api/flux/generate-image', {
        prompt: prompt,
        negativePrompt: negativePrompt,
        modelType: model,
        loraType: useLoRA ? loraType : undefined,
        loraStrength: useLoRA ? loraStrength : undefined,
        taskType: taskType
      });
      
      logger.info('Flux API response:', response.data);
      
      if (response.data && response.data.task_id) {
        // Guardar el ID de tarea para verificaciones periódicas
        setPendingTaskId(response.data.task_id);
        
        // Si la respuesta está marcada como simulada, mostrar toast informativo
        if (response.data.simulated) {
          logger.info('Respuesta simulada detectada, usando imágenes de muestra');
          toast({
            title: 'Modo Simulación',
            description: 'Ejecutando en modo de simulación debido a la configuración del API_KEY',
          });
        } else {
          toast({
            title: 'Generación iniciada',
            description: 'Tu imagen está siendo generada. Esto puede tomar unos segundos...',
          });
        }
      } else {
        throw new Error('No se recibió ID de tarea de Flux');
      }
    } catch (error) {
      logger.error('Error generating image with Flux:', error);
      setIsGenerating(false);
      
      toast({
        title: 'Error de Generación',
        description: error instanceof Error ? error.message : 'No se pudo generar la imagen',
        variant: 'destructive'
      });
    }
  };
  
  // Manejar selección de imagen desde la galería
  const handleImageSelect = (image: ImageResult) => {
    setGeneratedImage(image);
    if (onImageSelected) {
      onImageSelected(image);
    }
    setActiveTab('generate');
  };
  
  // Generar una imagen de ejemplo para demostración
  const handleGenerateSampleImage = () => {
    if (isGenerating) {
      toast({
        title: 'Generación en curso',
        description: 'Por favor espera a que termine la generación actual',
        variant: 'default'
      });
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // Simular tiempo de generación
      setTimeout(() => {
        // Seleccionar una URL de muestra aleatoria
        const sampleKeys = Object.keys(SAMPLE_IMAGES);
        const randomKey = sampleKeys[Math.floor(Math.random() * sampleKeys.length)] as keyof typeof SAMPLE_IMAGES;
        const imageUrl = SAMPLE_IMAGES[randomKey];
        
        // Seleccionar un prompt de muestra basado en la imagen
        const samplePrompts: Record<string, string> = {
          DOG: "perro callejero en la ciudad",
          LANDSCAPE: "paisaje de montañas al atardecer",
          ANIME: "personaje de anime estilo manga",
        };
        
        // Crear objeto de imagen de muestra
        const sampleImage: ImageResult = {
          url: imageUrl,
          provider: `flux-${model}`,
          taskId: `sample-${Date.now()}`,
          status: 'COMPLETED',
          prompt: samplePrompts[randomKey] || prompt || "imagen generada con IA",
          createdAt: new Date()
        };
        
        // Guardar en localStorage
        const saveId = fluxLocalStorageService.saveImage(sampleImage);
        sampleImage.firestoreId = saveId;
        
        // Actualizar estados
        setGeneratedImage(sampleImage);
        setIsGenerating(false);
        
        // Añadir a imágenes guardadas
        setSavedImages(prev => [sampleImage, ...prev]);
        
        // Notificar al componente padre
        if (onGeneratedImage) {
          onGeneratedImage(sampleImage);
        }
        
        toast({
          title: 'Imagen de Muestra Generada',
          description: 'Hemos generado una imagen de muestra para demostración',
        });
      }, 1500);
    } catch (error) {
      logger.error('Error generating sample image:', error);
      setIsGenerating(false);
      
      toast({
        title: 'Error',
        description: 'Ocurrió un error al generar la imagen de muestra',
        variant: 'destructive'
      });
    }
  };
  
  // Borrar todas las imágenes guardadas
  const handleClearGallery = () => {
    if (confirm('¿Estás seguro de que quieres borrar todas las imágenes guardadas?')) {
      fluxLocalStorageService.clearAllImages();
      setSavedImages([]);
      setGeneratedImage(null);
      
      toast({
        title: 'Galería Borrada',
        description: 'Todas las imágenes han sido eliminadas',
      });
    }
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Flux AI Image Generator
          </div>
          {savedImages.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearGallery}
              title="Borrar todas las imágenes"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Borrar Galería
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generar</TabsTrigger>
            <TabsTrigger value="gallery">
              Galería ({savedImages.length})
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="generate">
          <CardContent className="space-y-4 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea 
                  placeholder="Describe la imagen que quieres generar con detalle..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div>
                <Textarea 
                  placeholder="Prompt negativo (opcional) - Cosas que NO quieres en la imagen..."
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Modelo Flux</label>
                  <Select 
                    value={model} 
                    onValueChange={(value) => setModel(value as FluxModel)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FluxModel.FLUX1_DEV}>Flux1 Dev (Calidad)</SelectItem>
                      <SelectItem value={FluxModel.FLUX1_SCHNELL}>Flux1 Schnell (Rápido)</SelectItem>
                      <SelectItem value={FluxModel.FLUX1_DEV_ADVANCED}>Flux1 Advanced (Para LoRA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Usar LoRA</label>
                    <input 
                      type="checkbox" 
                      checked={useLoRA}
                      onChange={(e) => {
                        setUseLoRA(e.target.checked);
                        // Si activamos LoRA, forzar modelo avanzado
                        if (e.target.checked) {
                          setModel(FluxModel.FLUX1_DEV_ADVANCED);
                        }
                      }}
                      className="h-4 w-4"
                    />
                  </div>
                  
                  {useLoRA && (
                    <div className="space-y-4">
                      <Select 
                        value={loraType} 
                        onValueChange={(value) => setLoraType(value as FluxLoraType)}
                        disabled={!useLoRA}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estilo LoRA" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] overflow-y-auto">
                          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">-- Modelos de XLabs-AI --</div>
                          <SelectItem value={FluxLoraType.ANIME}>Anime</SelectItem>
                          <SelectItem value={FluxLoraType.ART}>Arte</SelectItem>
                          <SelectItem value={FluxLoraType.DISNEY}>Disney</SelectItem>
                          <SelectItem value={FluxLoraType.FURRY}>Furry</SelectItem>
                          <SelectItem value={FluxLoraType.MJV6}>MidJourney v6</SelectItem>
                          <SelectItem value={FluxLoraType.REALISM}>Realismo</SelectItem>
                          <SelectItem value={FluxLoraType.SCENERY}>Paisajes</SelectItem>
                          
                          <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">-- Modelos Artísticos --</div>
                          <SelectItem value={FluxLoraType.COLLAGE_ARTSTYLE}>Collage Artístico</SelectItem>
                          <SelectItem value={FluxLoraType.CREEPYCUTE}>Creepycute</SelectItem>
                          <SelectItem value={FluxLoraType.CYBERPUNK_ANIME}>Cyberpunk Anime</SelectItem>
                          <SelectItem value={FluxLoraType.DECO_PULSE}>Deco Pulse</SelectItem>
                          <SelectItem value={FluxLoraType.DEEP_SEA}>Deep Sea Particle</SelectItem>
                          <SelectItem value={FluxLoraType.FAETASTIC}>Detalles Faetásticos</SelectItem>
                          <SelectItem value={FluxLoraType.FRACTAL}>Geometría Fractal</SelectItem>
                          <SelectItem value={FluxLoraType.GALACTIXY}>Ilustraciones Galácticas</SelectItem>
                          <SelectItem value={FluxLoraType.GEOMETRIC_WOMAN}>Mujer Geométrica</SelectItem>
                          <SelectItem value={FluxLoraType.GRAPHIC_PORTRAIT}>Retratos Gráficos</SelectItem>
                          <SelectItem value={FluxLoraType.MAT_MILLER}>Estilo Mat Miller</SelectItem>
                          <SelectItem value={FluxLoraType.MOEBIUS}>Estilo Moebius</SelectItem>
                          <SelectItem value={FluxLoraType.ISOMETRIC}>Cuartos 3D Isométricos</SelectItem>
                          <SelectItem value={FluxLoraType.PAPER_QUILLING}>Papel Quilling y Capas</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">Intensidad LoRA</label>
                          <span className="text-xs text-gray-500">{Math.round(loraStrength * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="1.0" 
                          step="0.1" 
                          value={loraStrength}
                          onChange={(e) => setLoraStrength(parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Sutil</span>
                          <span>Intenso</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isGenerating || !prompt.trim() || (useLoRA && !loraType)}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : 'Generar Imagen'}
                </Button>
                
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGenerateSampleImage}
                  disabled={isGenerating}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Imagen de Ejemplo
                </Button>
              </div>
            </form>
            
            {generatedImage && generatedImage.url && (
              <div className="mt-6 space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <img 
                    src={generatedImage.url} 
                    alt={generatedImage.prompt || 'Imagen generada'} 
                    className="w-full h-auto"
                  />
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {generatedImage.prompt && (
                    <p className="mb-1"><span className="font-medium">Prompt:</span> {generatedImage.prompt}</p>
                  )}
                  <p className="mb-1"><span className="font-medium">Provider:</span> {generatedImage.provider}</p>
                  <p><span className="font-medium">Creada:</span> {generatedImage.createdAt.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        <TabsContent value="gallery">
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : savedImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {savedImages.map((image) => (
                  <div 
                    key={image.firestoreId || image.url} 
                    className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => handleImageSelect(image)}
                  >
                    <img 
                      src={image.url} 
                      alt={image.prompt || 'Imagen generada'} 
                      className="w-full h-auto aspect-square object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">No se encontraron imágenes guardadas</p>
                <p className="text-sm text-gray-400 mt-1">Genera algunas imágenes para verlas aquí</p>
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="flex justify-between border-t px-6 py-4">
        <div className="text-xs text-gray-500">
          Powered by Flux AI (PiAPI)
        </div>
        {generatedImage && generatedImage.url && (
          <Button variant="outline" size="sm" onClick={() => window.open(generatedImage.url, '_blank')}>
            <Save className="h-4 w-4 mr-2" />
            Ver Imagen Completa
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}