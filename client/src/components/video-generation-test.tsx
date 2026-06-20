/**
 * Componente para manejar la generación de videos usando PiAPI/Hailuo
 */

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { useToast } from '../hooks/use-toast';
import { generateVideo, checkVideoStatus, VideoStatusResponse, VideoGenerationOptions } from '../lib/api/video-service';
import { Progress } from './ui/progress';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Info } from 'lucide-react';

export default function VideoGenerator() {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [model, setModel] = useState<VideoGenerationOptions['model']>('t2v-01-director');
  const [imageUrl, setImageUrl] = useState('');
  const [cameraMovement, setCameraMovement] = useState('');
  const [expandPrompt, setExpandPrompt] = useState(true);
  const { toast } = useToast();

  // Estado de polling para verificar el estado del video
  const [isPolling, setIsPolling] = useState(false);

  // Validar si se requiere imagen para el modelo seleccionado
  const modelRequiresImage = (model: string | undefined): boolean => {
    if (!model) return false;
    return ['i2v-01', 'i2v-01-live', 's2v-01'].includes(model);
  };

  // Validar si se requiere movimiento de cámara para el modelo seleccionado
  const modelSupportsCameraMovement = (model: string | undefined): boolean => {
    if (!model) return false;
    return model === 't2v-01-director';
  };

  const startVideoGeneration = async () => {
    if (!prompt) {
      toast({
        title: "Error",
        description: "Por favor ingresa una descripción para el video",
        variant: "destructive"
      });
      return;
    }

    // Validar que se proporcionó una imagen URL si el modelo lo requiere
    if (modelRequiresImage(model) && !imageUrl) {
      toast({
        title: "Error",
        description: "Este modelo requiere una URL de imagen",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGenerating(true);
      setGeneratedVideoUrl(null);
      setProgress(0);

      // Crear opciones para la generación
      const options: VideoGenerationOptions = {
        prompt,
        duration,
        model,
        style: 'cinematic',
        expand_prompt: expandPrompt
      };

      // Añadir URL de imagen si el modelo lo requiere
      if (modelRequiresImage(model) && imageUrl) {
        options.image_url = imageUrl;
      }

      // Añadir movimientos de cámara si el modelo lo soporta
      if (modelSupportsCameraMovement(model) && cameraMovement) {
        options.camera_movement = cameraMovement;
      }

      const response = await generateVideo(options);

      if (response.success && response.result?.task_id) {
        setCurrentTaskId(response.result.task_id);
        startPolling(response.result.task_id);
        
        toast({
          title: "Video en proceso",
          description: "La generación del video ha comenzado"
        });
      } else {
        throw new Error('No se pudo iniciar la generación del video');
      }
    } catch (error: any) {
      console.error('Error al generar video:', error);
      toast({
        title: "Error",
        description: error.message || "Error al generar el video",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  };

  const startPolling = async (taskId: string) => {
    if (isPolling) return;
    setIsPolling(true);

    const pollInterval = setInterval(async () => {
      try {
        const status = await checkVideoStatus(taskId);
        
        if (status.progress) {
          setProgress(status.progress);
        }

        if (status.status === 'completed' && status.result?.url) {
          clearInterval(pollInterval);
          setIsPolling(false);
          setIsGenerating(false);
          setGeneratedVideoUrl(status.result.url);
          setProgress(100);
          
          toast({
            title: "¡Video generado!",
            description: "Tu video está listo para reproducir"
          });
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setIsPolling(false);
          setIsGenerating(false);
          
          toast({
            title: "Error",
            description: status.error || "Error al generar el video",
            variant: "destructive"
          });
        }
      } catch (error: any) {
        console.error('Error al verificar estado:', error);
        clearInterval(pollInterval);
        setIsPolling(false);
        setIsGenerating(false);
        
        toast({
          title: "Error",
          description: "Error al verificar el estado del video",
          variant: "destructive"
        });
      }
    }, 3000); // Verificar cada 3 segundos

    // Limpiar el intervalo si el componente se desmonta
    return () => clearInterval(pollInterval);
  };

  // Función para obtener la descripción del modelo seleccionado
  const getModelDescription = (modelType: string | undefined): string => {
    if (!modelType) return '';
    
    switch(modelType) {
      case 't2v-01':
        return 'Genera videos a partir de descripciones de texto. Ideal para escenas simples.';
      case 't2v-01-director':
        return 'Modelo avanzado con soporte para movimientos de cámara específicos como zoom, paneo y rotación.';
      case 'i2v-01':
        return 'Convierte una imagen estática en un video corto. Requiere URL de una imagen.';
      case 'i2v-01-live':
        return 'Añade efectos de movimiento sutil a imágenes estáticas. Requiere URL de una imagen.';
      case 's2v-01':
        return 'Genera videos manteniendo la identidad del sujeto en la imagen de referencia. Ideal para rostros.';
      default:
        return '';
    }
  };

  // Componente informativo sobre modelos
  const ModelInfoCard = () => {
    return (
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-medium">Guía de modelos de generación</h3>
          </div>
          
          <Tabs defaultValue="t2v">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="t2v">Texto a Video</TabsTrigger>
              <TabsTrigger value="i2v">Imagen a Video</TabsTrigger>
            </TabsList>
            
            <TabsContent value="t2v" className="space-y-4 pt-4">
              <div className="space-y-2">
                <h4 className="font-medium">t2v-01 (Estándar)</h4>
                <p className="text-sm text-muted-foreground">
                  Modelo básico que genera videos a partir de descripciones textuales. Ideal para escenas sencillas
                  y pruebas rápidas. Es el modelo más rápido pero con menos control.
                </p>
                <ul className="text-sm list-disc pl-5 text-muted-foreground">
                  <li>Duración recomendada: 3-10 segundos</li>
                  <li>Escenas: paisajes, objetos, situaciones simples</li>
                  <li>No requiere imágenes de referencia</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">t2v-01-director (Avanzado)</h4>
                <p className="text-sm text-muted-foreground">
                  Versión mejorada que permite especificar movimientos de cámara concretos. Ofrece mayor control
                  sobre la composición y narrativa visual de la escena.
                </p>
                <ul className="text-sm list-disc pl-5 text-muted-foreground">
                  <li>Movimientos disponibles: zoom, paneo, rotación, dolly</li>
                  <li>Mayor calidad visual y consistencia temporal</li>
                  <li>Ideal para: videos musicales, escenas cinematográficas</li>
                </ul>
              </div>
            </TabsContent>
            
            <TabsContent value="i2v" className="space-y-4 pt-4">
              <div className="space-y-2">
                <h4 className="font-medium">i2v-01 (Imagen a Video)</h4>
                <p className="text-sm text-muted-foreground">
                  Convierte una imagen estática en una secuencia de video con movimiento natural.
                  Útil para animar fotografías o imágenes generadas.
                </p>
                <ul className="text-sm list-disc pl-5 text-muted-foreground">
                  <li>Requiere URL de imagen de referencia</li>
                  <li>Mejor con imágenes de alta calidad (min. 512px)</li>
                  <li>Añade movimiento manteniendo la estética original</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">i2v-01-live (Efecto Live)</h4>
                <p className="text-sm text-muted-foreground">
                  Versión especializada que añade efectos de cinemagrafía a imágenes. Crea movimientos
                  sutiles que dan vida a la imagen manteniendo la mayor parte estática.
                </p>
                <ul className="text-sm list-disc pl-5 text-muted-foreground">
                  <li>Ideal para retratos y paisajes</li>
                  <li>Efecto similar a "Live Photos" de Apple</li>
                  <li>Movimientos más sutiles y realistas</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">s2v-01 (Sujeto a Video)</h4>
                <p className="text-sm text-muted-foreground">
                  Diseñado específicamente para generar videos manteniendo la identidad del sujeto de la imagen.
                  Excelente para rostros y personajes reconocibles.
                </p>
                <ul className="text-sm list-disc pl-5 text-muted-foreground">
                  <li>Optimizado para rostros humanos</li>
                  <li>Conserva la identidad del sujeto</li>
                  <li>Combina imagen de referencia con descripción textual</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-4">
      <ModelInfoCard />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="model">Modelo de generación</Label>
          <Select
            value={model}
            onValueChange={(value) => setModel(value as VideoGenerationOptions['model'])}
            disabled={isGenerating}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona un modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="t2v-01">Texto a Video (Estándar)</SelectItem>
              <SelectItem value="t2v-01-director">Texto a Video con Movimientos de Cámara</SelectItem>
              <SelectItem value="i2v-01">Imagen a Video (Estándar)</SelectItem>
              <SelectItem value="i2v-01-live">Imagen a Video (Efecto Live)</SelectItem>
              <SelectItem value="s2v-01">Sujeto a Video (Rostros)</SelectItem>
            </SelectContent>
          </Select>
          {model && (
            <p className="text-xs text-muted-foreground mt-1">
              {getModelDescription(model)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Descripción del video</Label>
          <Input
            id="prompt"
            placeholder="Describe el video que deseas generar..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
          <p className="text-xs text-muted-foreground">
            {model === 't2v-01-director' ? 
              'Sé específico con la escena, estilo visual y movimientos deseados.' : 
              'Describe el video con detalles sobre el ambiente, objetos, personas, estilo visual y acción.'}
          </p>
        </div>

        {/* Campo de URL de imagen para modelos que la requieren */}
        {modelRequiresImage(model) && (
          <div className="space-y-2">
            <Label htmlFor="imageUrl">URL de la imagen <span className="text-red-500">*</span></Label>
            <Input
              id="imageUrl"
              placeholder="https://ejemplo.com/imagen.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isGenerating}
            />
            <p className="text-xs text-muted-foreground">
              {model === 's2v-01' 
                ? 'Proporciona una imagen clara del rostro o sujeto que deseas mantener en el video.'
                : 'Proporciona una imagen de alta calidad como base para la animación del video.'}
            </p>
          </div>
        )}

        {/* Campo de movimiento de cámara para t2v-01-director */}
        {modelSupportsCameraMovement(model) && (
          <div className="space-y-2">
            <Label htmlFor="cameraMovement">Movimiento de cámara</Label>
            <Select
              value={cameraMovement}
              onValueChange={setCameraMovement}
              disabled={isGenerating}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin movimiento específico</SelectItem>
                <SelectItem value="zoom in">Acercamiento</SelectItem>
                <SelectItem value="zoom out">Alejamiento</SelectItem>
                <SelectItem value="pan left">Paneo a la izquierda</SelectItem>
                <SelectItem value="pan right">Paneo a la derecha</SelectItem>
                <SelectItem value="rotate">Rotación</SelectItem>
                <SelectItem value="dolly">Dolly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Duración (segundos): {duration}</Label>
          <Slider
            value={[duration]}
            onValueChange={(values) => setDuration(values[0])}
            min={3}
            max={30}
            step={1}
            disabled={isGenerating}
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="expandPrompt"
            checked={expandPrompt}
            onChange={(e) => setExpandPrompt(e.target.checked)}
            disabled={isGenerating}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <Label htmlFor="expandPrompt" className="text-sm">
            Expandir prompt (recomendado)
          </Label>
        </div>

        <Button
          onClick={startVideoGeneration}
          disabled={isGenerating || !prompt || (modelRequiresImage(model) && !imageUrl)}
          className="w-full"
        >
          {isGenerating ? 'Generando...' : 'Generar Video'}
        </Button>

        {isGenerating && (
          <Card className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Progreso: {progress}%</Label>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  ID: {currentTaskId}
                </span>
              </div>
              <Progress value={progress} className="w-full" />
              
              <div className="space-y-1">
                <div className="text-sm font-medium">Estado:</div>
                <div className="flex space-x-1 items-center">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm">
                    {progress < 25 ? 'Inicializando modelo...' : 
                     progress < 50 ? 'Procesando prompt...' :
                     progress < 75 ? 'Generando frames...' :
                     progress < 95 ? 'Finalizando video...' :
                     'Optimizando resultado...'}
                  </span>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <p>La generación puede tomar entre 10 y 60 segundos dependiendo del modelo y la complejidad.</p>
                <p>Modelo utilizado: <span className="font-medium">{model}</span></p>
              </div>
            </div>
          </Card>
        )}

        {generatedVideoUrl && (
          <Card className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <Label>Video Generado:</Label>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Completado
              </span>
            </div>
            <video
              src={generatedVideoUrl}
              controls
              className="w-full rounded-lg"
              style={{ maxHeight: '400px' }}
              autoPlay
              loop
            />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Modelo:</span> {model} 
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">ID de tarea:</span> {currentTaskId}
              </p>
              <div className="flex justify-end mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(generatedVideoUrl, '_blank')}
                >
                  Abrir en nueva pestaña
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}