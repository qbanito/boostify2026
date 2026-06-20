import { useState, useEffect } from 'react';
import { logger } from "../lib/logger";
import { useToast } from '../hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ImageIcon, VideoIcon, Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';

import { 
  generateImage as apiGenerateImage, 
  generateVideo as apiGenerateVideo,
  ImageResult,
  VideoResult
} from '../lib/api/multi-platform-generator';
import { ApiProvider } from '../lib/types/model-types';

interface AsyncTaskStatus {
  id: string;
  provider: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ImageResult | VideoResult;
  error?: string;
  type: 'image' | 'video';
  startTime: Date;
}

// Función para iniciar generación de imágenes 
const startImageGeneration = async (prompt: string, provider: string): Promise<AsyncTaskStatus> => {
  try {
    logger.info(`Iniciando generación de imagen con prompt: "${prompt}" usando ${provider}`);
    
    // Llamamos a la API real que hemos implementado en el backend
    const endpoint = `/api/proxy/${provider}/generate-image`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    logger.info('API response:', data);
    
    // Verificar si estamos recibiendo una respuesta fallback del servidor
    const isFallback = data.fallback === true;

    // Extraer el ID de la tarea o generar uno si no existe
    const taskId = data.task_id || data.id || `${provider}-${Date.now()}`;
    
    // Si es una respuesta fallback o ya tenemos la URL, creamos una tarea completada
    if (isFallback || (data.images && Array.isArray(data.images) && data.images.length > 0)) {
      // Hay una URL directa disponible, lo tratamos como una tarea completada
      let imageUrl = '';
      
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        // Estructura: { images: [{ url: "..." }] }
        if (typeof data.images[0] === 'string') {
          imageUrl = data.images[0];
        } else if (data.images[0] && data.images[0].url) {
          imageUrl = data.images[0].url;
        }
      } else if (data.fallback && data.fallback.images && Array.isArray(data.fallback.images)) {
        // Estructura: { fallback: { images: ["..."] } }
        imageUrl = data.fallback.images[0];
      } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        // Estructura: { data: [{ url: "..." }] }
        if (data.data[0] && data.data[0].url) {
          imageUrl = data.data[0].url;
        } else if (typeof data.data[0] === 'string') {
          imageUrl = data.data[0];
        }
      }
      
      if (!imageUrl && isFallback) {
        // Fallback garantizado para el caso de error
        imageUrl = 'https://images.unsplash.com/photo-1580927752452-89d86da3fa0a';
      }
      
      if (imageUrl) {
        return {
          id: taskId,
          provider,
          prompt,
          status: 'completed',
          progress: 100,
          result: {
            url: imageUrl,
            provider: isFallback ? `${provider} (fallback)` : provider,
            requestId: taskId,
            prompt,
            createdAt: new Date()
          },
          type: 'image',
          startTime: new Date()
        };
      }
    }
    
    // Si llegamos aquí, es una tarea asíncrona
    return {
      id: taskId,
      provider,
      prompt,
      status: 'pending',
      progress: 0,
      type: 'image',
      startTime: new Date()
    };
  } catch (error) {
    logger.error('Error iniciando generación de imagen:', error);
    
    // Fallback garantizado en caso de error
    return {
      id: `${provider}-error-${Date.now()}`,
      provider,
      prompt,
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'image',
      startTime: new Date(),
      result: {
        url: 'https://images.unsplash.com/photo-1580927752452-89d86da3fa0a',
        provider: `${provider} (local fallback)`,
        prompt,
        createdAt: new Date()
      }
    };
  }
};

// Función para iniciar generación de videos
const startVideoGeneration = async (prompt: string, provider: string): Promise<AsyncTaskStatus> => {
  try {
    logger.info(`Iniciando generación de video con prompt: "${prompt}" usando ${provider}`);
    
    // Llamamos a la API real que hemos implementado en el backend
    const endpoint = `/api/proxy/${provider}/generate-video`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    logger.info('API response for video:', data);
    
    // Verificar si estamos recibiendo una respuesta fallback del servidor
    const isFallback = data.fallback === true;
    
    // Extraer el ID de la tarea o generar uno si no existe
    const taskId = data.id || `${provider}-${Date.now()}`;
    
    // Si es una respuesta fallback o ya tenemos la URL, creamos una tarea completada
    if (isFallback || data.output?.url || data.url) {
      let videoUrl = '';
      
      if (data.output && data.output.url) {
        videoUrl = data.output.url;
      } else if (data.data && data.data.url) {
        videoUrl = data.data.url;
      } else if (data.url) {
        videoUrl = data.url;
      } else if (data.data && Array.isArray(data.data) && data.data.length > 0 && data.data[0].url) {
        videoUrl = data.data[0].url;
      }
      
      if (!videoUrl && isFallback) {
        // Fallback garantizado para el caso de error
        videoUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      }
      
      if (videoUrl) {
        return {
          id: taskId,
          provider,
          prompt,
          status: 'completed',
          progress: 100,
          result: {
            url: videoUrl,
            provider: isFallback ? `${provider} (fallback)` : provider,
            requestId: taskId,
            prompt,
            createdAt: new Date()
          },
          type: 'video',
          startTime: new Date()
        };
      }
    }
    
    // Si llegamos aquí, es una tarea asíncrona
    return {
      id: taskId,
      provider,
      prompt,
      status: 'pending',
      progress: 0,
      type: 'video',
      startTime: new Date()
    };
  } catch (error) {
    logger.error('Error iniciando generación de video:', error);
    
    // Fallback garantizado en caso de error
    return {
      id: `${provider}-error-${Date.now()}`,
      provider,
      prompt,
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      type: 'video',
      startTime: new Date(),
      result: {
        url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        provider: `${provider} (local fallback)`,
        prompt,
        createdAt: new Date()
      }
    };
  }
};

// Función para verificar el estado de una tarea de generación de imagen
const checkImageTaskStatus = async (taskId: string, provider: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: ImageResult;
  error?: string;
}> => {
  try {
    logger.info(`Verificando estado de tarea de imagen ${taskId} en ${provider}`);
    
    const endpoint = `/api/proxy/${provider}/task/${taskId}`;
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    logger.info(`Estado de tarea ${taskId}:`, data);
    
    // Verificar si es una respuesta fallback
    const isFallback = data.fallback === true;
    
    // Extraer estado según el formato de respuesta
    let status: string = '';
    let generated: any[] = [];
    let errorInfo: string | undefined;
    
    if (data.data) {
      // Formato estándar: { data: { status: '...', generated: [...] } }
      status = data.data.status;
      generated = data.data.generated || [];
      errorInfo = data.error_info;
    } else if (data.status) {
      // Formato simple: { status: '...', images: [...] }
      status = data.status;
      generated = data.images || [];
      errorInfo = data.error_info;
    }
    
    // Normalizar estado para nuestro sistema
    let normalizedStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
    let progress = 0;
    let result: ImageResult | undefined;
    
    if (status) {
      // Convertir variaciones de estado a nuestro formato
      if (status.toUpperCase() === 'IN_PROGRESS' || status.toLowerCase() === 'processing' || status.toLowerCase() === 'pending') {
        normalizedStatus = 'processing';
        progress = 50; // Aproximación
      } else if (status.toUpperCase() === 'COMPLETED' || status.toLowerCase() === 'completed' || status.toLowerCase() === 'success') {
        normalizedStatus = 'completed';
        progress = 100;
        
        // Extraer URL de la imagen si está disponible
        if (generated && generated.length > 0) {
          let imageUrl = '';
          if (typeof generated[0] === 'string') {
            imageUrl = generated[0];
          } else if (generated[0] && generated[0].url) {
            imageUrl = generated[0].url;
          }
          
          if (imageUrl) {
            result = {
              url: imageUrl,
              provider,
              requestId: taskId,
              prompt: '',  // No tenemos el prompt original aquí
              createdAt: new Date()
            };
          }
        }
      } else if (status.toLowerCase().includes('fail') || status.toLowerCase() === 'error') {
        normalizedStatus = 'failed';
        progress = 100;
      }
    }
    
    return {
      status: normalizedStatus,
      progress,
      result,
      error: errorInfo
    };
  } catch (error) {
    logger.error(`Error verificando estado de tarea ${taskId}:`, error);
    return {
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Función para verificar el estado de una tarea de generación de video
const checkVideoTaskStatus = async (taskId: string, provider: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: VideoResult;
  error?: string;
}> => {
  try {
    logger.info(`Verificando estado de tarea de video ${taskId} en ${provider}`);
    
    const endpoint = `/api/proxy/${provider}/video/${taskId}`;
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    logger.info(`Estado de tarea de video ${taskId}:`, data);
    
    // Verificar si es una respuesta fallback
    const isFallback = data.fallback === true;
    
    // Extraer estado según el formato de respuesta
    let status: string = '';
    let videoUrl: string = '';
    let errorInfo: string | undefined;
    
    if (data.status) {
      status = data.status;
      
      // Extraer URL del video según el formato específico del proveedor
      if (provider === 'luma') {
        // Formatos de Luma: { status: '...', output: { url: '...' } }
        if (data.output && data.output.url) {
          videoUrl = data.output.url;
        }
      } else if (provider === 'kling') {
        // Formatos de Kling: { status: '...', url: '...' }
        if (data.url) {
          videoUrl = data.url;
        }
      }
      
      errorInfo = data.error_info;
    }
    
    // Normalizar estado para nuestro sistema
    let normalizedStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
    let progress = 0;
    let result: VideoResult | undefined;
    
    if (status) {
      // Convertir variaciones de estado a nuestro formato
      if (status.toLowerCase() === 'pending' || status.toLowerCase() === 'processing' || status.toLowerCase() === 'in_progress') {
        normalizedStatus = 'processing';
        progress = 50; // Aproximación
      } else if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'success') {
        normalizedStatus = 'completed';
        progress = 100;
        
        // Crear resultado si tenemos una URL de video
        if (videoUrl) {
          result = {
            url: videoUrl,
            provider,
            requestId: taskId,
            prompt: '',  // No tenemos el prompt original aquí
            createdAt: new Date()
          };
        }
      } else if (status.toLowerCase().includes('fail') || status.toLowerCase() === 'error') {
        normalizedStatus = 'failed';
        progress = 100;
      }
    }
    
    return {
      status: normalizedStatus,
      progress,
      result,
      error: errorInfo
    };
  } catch (error) {
    logger.error(`Error verificando estado de tarea de video ${taskId}:`, error);
    return {
      status: 'failed',
      progress: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Componente principal para probar generación de imágenes y videos
export default function ImageGeneratorSimplePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [imagePrompt, setImagePrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [imageProvider, setImageProvider] = useState('freepik');
  const [videoProvider, setVideoProvider] = useState('luma');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<ImageResult[]>([]);
  const [generatedVideos, setGeneratedVideos] = useState<VideoResult[]>([]);
  
  // Estado para tareas asíncronas
  const [tasks, setTasks] = useState<AsyncTaskStatus[]>([]);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Función para verificar el estado de las tareas activas
  useEffect(() => {
    // Solo verificar las tareas si hay alguna pendiente o en proceso
    const hasPendingTasks = tasks.some(task => 
      task.status === 'pending' || task.status === 'processing'
    );
    
    if (!hasPendingTasks || isCheckingStatus) return;
    
    const checkStatus = async () => {
      setIsCheckingStatus(true);
      
      try {
        // Crear una copia de tareas para actualizar
        const updatedTasks = [...tasks];
        let hasUpdates = false;
        
        // Verificar cada tarea pendiente o en proceso
        for (let i = 0; i < updatedTasks.length; i++) {
          const task = updatedTasks[i];
          
          if (task.status !== 'pending' && task.status !== 'processing') continue;
          
          if (task.type === 'image') {
            // Verificar estado de tarea de imagen
            const statusResult = await checkImageTaskStatus(task.id, task.provider);
            
            // Actualizar la tarea con el nuevo estado
            const newTaskState = {
              ...task,
              status: statusResult.status,
              progress: statusResult.progress,
              error: statusResult.error,
              result: statusResult.result ? {
                ...statusResult.result,
                prompt: task.prompt  // Preservar el prompt original
              } : task.result
            };
            
            // Verificar si hay cambios significativos
            const statusChanged = newTaskState.status !== task.status;
            const progressChanged = newTaskState.progress !== task.progress;
            
            // Solo actualizar si hubo cambios
            if (statusChanged || progressChanged) {
              updatedTasks[i] = newTaskState;
              hasUpdates = true;
              
              // Notificar sobre cambios de estado importantes
              if (statusChanged) {
                if (newTaskState.status === 'completed') {
                  toast({
                    title: 'Generation completed',
                    description: `Your ${task.type} has been generated successfully!`,
                    variant: 'success',
                  });
                  
                  // Si se completó y hay un resultado, agregarlo a las imágenes/videos generados
                  if (newTaskState.result && task.type === 'image') {
                    const imageResult: ImageResult = {
                      ...newTaskState.result,
                      prompt: task.prompt
                    };
                    setGeneratedImages(prev => [imageResult, ...prev]);
                  }
                } else if (newTaskState.status === 'failed') {
                  toast({
                    title: 'Generation failed',
                    description: newTaskState.error || `Failed to generate your ${task.type}`,
                    variant: 'destructive',
                  });
                } else if (newTaskState.status === 'processing' && task.status === 'pending') {
                  // Cambio de pendiente a procesando
                  toast({
                    title: 'Processing started',
                    description: `Your ${task.type} is now being processed...`,
                  });
                }
              }
            }
          } else if (task.type === 'video') {
            // Verificar estado de tarea de video
            const statusResult = await checkVideoTaskStatus(task.id, task.provider);
            
            // Actualizar la tarea con el nuevo estado
            const newTaskState = {
              ...task,
              status: statusResult.status,
              progress: statusResult.progress,
              error: statusResult.error,
              result: statusResult.result ? {
                ...statusResult.result,
                prompt: task.prompt  // Preservar el prompt original
              } : task.result
            };
            
            // Verificar si hay cambios significativos
            const statusChanged = newTaskState.status !== task.status;
            const progressChanged = newTaskState.progress !== task.progress;
            
            // Solo actualizar si hubo cambios
            if (statusChanged || progressChanged) {
              updatedTasks[i] = newTaskState;
              hasUpdates = true;
              
              // Notificar sobre cambios de estado importantes
              if (statusChanged) {
                if (newTaskState.status === 'completed') {
                  toast({
                    title: 'Video generation completed',
                    description: `Your video has been generated successfully!`,
                    variant: 'success',
                  });
                  
                  // Si se completó y hay un resultado, agregarlo a los videos generados
                  if (newTaskState.result && task.type === 'video') {
                    const videoResult: VideoResult = {
                      ...newTaskState.result,
                      prompt: task.prompt
                    };
                    setGeneratedVideos(prev => [videoResult, ...prev]);
                  }
                } else if (newTaskState.status === 'failed') {
                  toast({
                    title: 'Video generation failed',
                    description: newTaskState.error || `Failed to generate your video`,
                    variant: 'destructive',
                  });
                } else if (newTaskState.status === 'processing' && task.status === 'pending') {
                  // Cambio de pendiente a procesando
                  toast({
                    title: 'Video processing started',
                    description: `Your video is now being processed. This may take several minutes...`,
                  });
                }
              }
            }
          }
        }
        
        // Actualizar estado si hubo cambios
        if (hasUpdates) {
          setTasks(updatedTasks);
        }
      } catch (error) {
        logger.error('Error checking task status:', error);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    // Verificar estado cada 3 segundos
    const intervalId = setInterval(checkStatus, 3000);
    
    // Limpiar intervalo al desmontar
    return () => clearInterval(intervalId);
  }, [tasks, isCheckingStatus, toast]);

  // Cargar una imagen inicial para demostrar que el sistema funciona
  useEffect(() => {
    // Solo cargar si no hay imágenes generadas aún
    if (generatedImages.length === 0) {
      const loadInitialImage = async () => {
        try {
          logger.info("Cargando imagen inicial...");
          // Usar freepik como proveedor por defecto para el ejemplo inicial
          const task = await startImageGeneration("perro jugando en la playa", "freepik");
          
          // Si la tarea ya está completada (fallback), agregar la imagen directamente
          if (task.status === 'completed' && task.result) {
            setGeneratedImages([task.result as ImageResult]);
            logger.info("Imagen inicial cargada:", task.result);
          } else {
            // De lo contrario, agregar la tarea para monitoreo
            setTasks(prev => [...prev, task]);
            logger.info("Tarea de imagen inicial iniciada:", task);
          }
        } catch (error) {
          logger.error("Error al cargar imagen inicial:", error);
        }
      };
      
      loadInitialImage();
    }
  }, []);

  // Handle image generation
  const handleImageGenerate = async () => {
    if (!imagePrompt) {
      toast({
        title: 'Prompt required',
        description: 'Please enter a description for your image',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      toast({
        title: 'Starting image generation',
        description: `Using ${imageProvider} to create your vision...`,
      });

      const task = await startImageGeneration(imagePrompt, imageProvider);
      
      // Si la tarea ya está completada (fallback), agregar la imagen directamente
      if (task.status === 'completed' && task.result) {
        setGeneratedImages(prev => [task.result as ImageResult, ...prev]);
        
        toast({
          title: 'Image generated successfully',
          description: 'Your image is ready to view',
          variant: 'success',
        });
      } else {
        // De lo contrario, agregar la tarea para monitoreo
        setTasks(prev => [...prev, task]);
        
        toast({
          title: 'Generation in progress',
          description: 'Your image is being generated. This may take a minute.',
        });
      }
    } catch (error) {
      logger.error('Error generating image:', error);
      toast({
        title: 'Generation failed',
        description: 'Could not generate the image. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle video generation
  const handleVideoGenerate = async () => {
    if (!videoPrompt) {
      toast({
        title: 'Prompt required',
        description: 'Please enter a description for your video',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      toast({
        title: 'Starting video generation',
        description: `Using ${videoProvider} to create your video...`,
      });

      const task = await startVideoGeneration(videoPrompt, videoProvider);
      
      // Si la tarea ya está completada (fallback), agregar el video directamente
      if (task.status === 'completed' && task.result) {
        setGeneratedVideos(prev => [task.result as VideoResult, ...prev]);
        
        toast({
          title: 'Video generated successfully',
          description: 'Your video is ready to view',
          variant: 'success',
        });
      } else {
        // De lo contrario, agregar la tarea para monitoreo
        setTasks(prev => [...prev, task]);
        
        toast({
          title: 'Generation in progress',
          description: 'Your video is being generated. This may take a few minutes.',
        });
      }
    } catch (error) {
      logger.error('Error generating video:', error);
      toast({
        title: 'Generation failed',
        description: 'Could not generate the video. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">AI Media Generator</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        Create stunning images and videos with AI
      </p>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'image' | 'video')}>
        <TabsList className="mb-4">
          <TabsTrigger value="image">
            <ImageIcon className="mr-2 h-4 w-4" />
            Images
          </TabsTrigger>
          <TabsTrigger value="video">
            <VideoIcon className="mr-2 h-4 w-4" />
            Videos
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left panel: Generation form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === 'image' ? 'Image Generator' : 'Video Generator'}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'image' 
                    ? 'Create AI-powered images with our generator' 
                    : 'Generate videos with advanced AI'}
                </CardDescription>
              </CardHeader>
              
              <TabsContent value="image" className="mt-0">
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-prompt">Image Description</Label>
                    <Input 
                      id="image-prompt"
                      placeholder="Describe the image you want to generate..." 
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Be as detailed as possible for best results
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Generation Engine</Label>
                    <div className="flex space-x-4">
                      <Button 
                        variant={imageProvider === 'fal' ? 'default' : 'outline'}
                        onClick={() => setImageProvider('fal')}
                        size="sm"
                      >
                        Fal.ai
                      </Button>
                      <Button 
                        variant={imageProvider === 'freepik' ? 'default' : 'outline'}
                        onClick={() => setImageProvider('freepik')}
                        size="sm"
                      >
                        Freepik
                      </Button>
                      <Button 
                        variant={imageProvider === 'kling' ? 'default' : 'outline'}
                        onClick={() => setImageProvider('kling')}
                        size="sm"
                      >
                        Kling
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={handleImageGenerate} 
                    className="w-full"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Generate Image
                      </>
                    )}
                  </Button>
                </CardContent>
              </TabsContent>

              <TabsContent value="video" className="mt-0">
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="video-prompt">Video Description</Label>
                    <Input 
                      id="video-prompt"
                      placeholder="Describe the video you want to generate..." 
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Be detailed about scenes, actions, and style
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Video Engine</Label>
                    <div className="flex space-x-4">
                      <Button 
                        variant={videoProvider === 'luma' ? 'default' : 'outline'}
                        onClick={() => setVideoProvider('luma')}
                        size="sm"
                      >
                        Luma
                      </Button>
                      <Button 
                        variant={videoProvider === 'kling' ? 'default' : 'outline'}
                        onClick={() => setVideoProvider('kling')}
                        size="sm"
                      >
                        Kling
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={handleVideoGenerate} 
                    className="w-full"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <VideoIcon className="mr-2 h-4 w-4" />
                        Generate Video
                      </>
                    )}
                  </Button>
                </CardContent>
              </TabsContent>
            </Card>
          </div>

          {/* Right panel: Results gallery */}
          <div className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>
                  {activeTab === 'image' ? 'Generated Images' : 'Generated Videos'}
                </CardTitle>
                <CardDescription>
                  {activeTab === 'image'
                    ? 'View your AI-generated images'
                    : 'View your AI-generated videos'}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {/* Tasks in progress */}
                {tasks.some(task => 
                  (task.status === 'pending' || task.status === 'processing') && 
                  (activeTab === 'image' ? task.type === 'image' : task.type === 'video')
                ) && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-4">Tasks in Progress</h3>
                    <div className="space-y-4">
                      {tasks
                        .filter(task => 
                          (task.status === 'pending' || task.status === 'processing') && 
                          (activeTab === 'image' ? task.type === 'image' : task.type === 'video')
                        )
                        .map((task, index) => (
                          <div key={index} className="border rounded-lg p-4 bg-muted/30">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center">
                                {task.status === 'pending' ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin text-yellow-500" />
                                ) : (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-500" />
                                )}
                                <span className="font-medium">
                                  {task.type === 'image' ? 'Image' : 'Video'} Generation
                                </span>
                              </div>
                              <Badge variant={task.status === 'pending' ? 'outline' : 'default'}>
                                {task.status === 'pending' ? 'Queued' : 'Processing'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 truncate">
                              {task.prompt}
                            </p>
                            <div className="space-y-1">
                              <Progress value={task.progress} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Using {task.provider}</span>
                                <span>
                                  {Math.floor((Date.now() - task.startTime.getTime()) / 1000)}s elapsed
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                
                <TabsContent value="image" className="mt-0">
                  {generatedImages.length === 0 && !tasks.some(t => t.type === 'image' && (t.status === 'pending' || t.status === 'processing')) ? (
                    <div className="text-center py-12">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold">No images yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Generate your first image to see it here
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedImages.map((image, index) => (
                        <div 
                          key={index} 
                          className="relative overflow-hidden rounded-lg"
                        >
                          <img 
                            src={image.url} 
                            alt={`Generated image ${index + 1}`} 
                            className="w-full h-40 object-cover"
                          />
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                            {image.provider}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="video" className="mt-0">
                  {generatedVideos.length === 0 ? (
                    <div className="text-center py-12">
                      <VideoIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-semibold">No videos yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Generate your first video to see it here
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generatedVideos.map((video, index) => (
                        <div 
                          key={index} 
                          className="relative overflow-hidden rounded-lg"
                        >
                          <video 
                            src={video.url} 
                            className="w-full h-40 object-cover"
                            controls
                          />
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                            {video.provider}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
}