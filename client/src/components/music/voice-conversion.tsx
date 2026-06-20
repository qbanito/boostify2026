import React, { useState, useRef, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Upload, Play, Pause, Download, Music2, Music } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Progress } from '../ui/progress';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from '../../hooks/use-toast';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

import { voiceModelService } from '../../lib/services/voice-model-service';
import type { VoiceModel, VoiceConversionRequest, AudioEffect } from '../../lib/types/voice-model-types';

interface VoiceConversionProps {
  className?: string;
}

// Definimos algunos efectos de audio predefinidos para uso en la conversión
const predefinedAudioEffects: AudioEffect[] = [
  {
    name: "reverb",
    enabled: false,
    settings: {
      roomSize: 0.8,
      dampening: 0.5,
      width: 1.0
    }
  },
  {
    name: "delay",
    enabled: false,
    settings: {
      time: 0.3,
      feedback: 0.4,
      mix: 0.3
    }
  },
  {
    name: "chorus",
    enabled: false,
    settings: {
      rate: 1.5,
      depth: 0.7,
      feedback: 0.4,
      delay: 0.03
    }
  },
  {
    name: "compression",
    enabled: false,
    settings: {
      threshold: -24,
      ratio: 4,
      attack: 0.003,
      release: 0.25
    }
  }
];

export function VoiceConversion({ className }: VoiceConversionProps) {
  const [sourceAudio, setSourceAudio] = useState<File | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [transpose, setTranspose] = useState<number>(0);
  const [generationsCount, setGenerationsCount] = useState<number>(1);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedOutput, setSelectedOutput] = useState<number>(0);
  const [selectedEffects, setSelectedEffects] = useState<AudioEffect[]>([]);
  
  const sourceAudioRef = useRef<HTMLAudioElement>(null);
  const outputAudioRef = useRef<HTMLAudioElement>(null);
  
  // Consulta para obtener los modelos de voz disponibles
  const { data: voiceModels, isLoading: isLoadingModels } = useQuery({
    queryKey: ['voice-models'],
    queryFn: () => voiceModelService.getAvailableModels()
  });
  
  // Consulta para verificar el estado de la tarea de conversión
  const { 
    data: conversionStatus, 
    isLoading: isLoadingStatus,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['conversion-status', taskId],
    queryFn: () => voiceModelService.checkConversionStatus(taskId || ''),
    enabled: !!taskId,
    refetchInterval: isConverting ? 2000 : false
  });
  
  // Actualizamos el estado cuando la conversión se completa
  useEffect(() => {
    if (conversionStatus) {
      if (conversionStatus.status === 'completed') {
        setIsConverting(false);
        toast({
          title: 'Conversión completada',
          description: 'La conversión de voz se ha completado con éxito.'
        });
      } else if (conversionStatus.status === 'failed') {
        setIsConverting(false);
        toast({
          title: 'Error en la conversión',
          description: 'No se pudo completar la conversión de voz.',
          variant: 'destructive'
        });
      }
    }
  }, [conversionStatus]);
  
  // Mutación para iniciar la conversión
  const convertMutation = useMutation({
    mutationFn: (request: VoiceConversionRequest) => {
      return voiceModelService.convertAudio(
        request.audioFile, 
        request.model, 
        {
          transpose: request.transpose,
          effects: request.effects
        },
        'user-123' // Mock user ID for development
      );
    },
    onSuccess: (response: { taskId: string; recordId?: string }) => {
      setTaskId(response.taskId);
      setIsConverting(true);
      toast({
        title: 'Conversión iniciada',
        description: 'La conversión de voz ha comenzado. Este proceso puede tardar unos minutos.'
      });
    },
    onError: (error) => {
      setIsConverting(false);
      toast({
        title: 'Error al iniciar la conversión',
        description: error instanceof Error ? error.message : 'Ocurrió un error desconocido',
        variant: 'destructive'
      });
    }
  });
  
  // Manejador para subir archivo de audio
  const handleAudioUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Verificar que sea un archivo de audio
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'Tipo de archivo incorrecto',
          description: 'Por favor, sube un archivo de audio (WAV recomendado)',
          variant: 'destructive'
        });
        return;
      }
      
      setSourceAudio(file);
    }
  };
  
  // Manejador para gestionar los efectos de audio
  const toggleEffect = (effectName: string) => {
    const updatedEffects = [...selectedEffects];
    const effectIndex = updatedEffects.findIndex(effect => effect.name === effectName);
    
    if (effectIndex >= 0) {
      // El efecto ya existe, actualiza su estado enabled
      updatedEffects[effectIndex] = {
        ...updatedEffects[effectIndex],
        enabled: !updatedEffects[effectIndex].enabled
      };
    } else {
      // El efecto no existe, añade uno nuevo desde los predefinidos
      const predefinedEffect = predefinedAudioEffects.find(effect => effect.name === effectName);
      if (predefinedEffect) {
        updatedEffects.push({
          ...predefinedEffect,
          enabled: true // lo activamos por defecto
        });
      }
    }
    
    setSelectedEffects(updatedEffects);
  };

  // Manejador para iniciar la conversión
  const handleStartConversion = () => {
    if (!sourceAudio) {
      toast({
        title: 'Archivo de audio requerido',
        description: 'Por favor, sube un archivo de audio para la conversión',
        variant: 'destructive'
      });
      return;
    }
    
    if (!selectedModelId) {
      toast({
        title: 'Modelo no seleccionado',
        description: 'Por favor, selecciona un modelo de voz para la conversión',
        variant: 'destructive'
      });
      return;
    }
    
    // Filtrar solo los efectos que están habilitados
    const activeEffects = selectedEffects.filter(effect => effect.enabled);
    
    const request: VoiceConversionRequest = {
      audioFile: sourceAudio,
      model: selectedModelId,
      transpose,
      generationsCount: generationsCount,
      effects: activeEffects
    };
    
    convertMutation.mutate(request);
  };
  
  // Manejador para reproducir/pausar el audio original
  const toggleSourceAudio = () => {
    if (sourceAudioRef.current) {
      if (sourceAudioRef.current.paused) {
        sourceAudioRef.current.play();
      } else {
        sourceAudioRef.current.pause();
      }
    }
  };
  
  // Manejador para reproducir/pausar el audio convertido
  const toggleOutputAudio = () => {
    if (outputAudioRef.current) {
      if (outputAudioRef.current.paused) {
        outputAudioRef.current.play();
      } else {
        outputAudioRef.current.pause();
      }
    }
  };
  
  // Manejador para descargar el audio convertido con validación de URL
  const handleDownloadOutput = () => {
    if (conversionStatus?.result?.url) {
      const url = conversionStatus.result.url;
      
      // Validación mejorada de URL para seguridad
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        toast({
          title: 'Error de seguridad',
          description: 'La URL del audio no es válida o no está disponible.',
          variant: 'destructive'
        });
        return;
      }
      
      try {
        // Verificar que sea una URL válida con estructura correcta
        new URL(url);
        
        // Crear un enlace temporal para descargar el audio
        const link = document.createElement('a');
        link.href = url;
        link.download = `converted_voice_${Date.now()}.wav`;
        link.type = "audio/wav"; // Agregar MIME type correcto para el audio
        
        // Proceso de descarga con manejo de errores
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: 'Descarga iniciada',
          description: 'Tu archivo de audio procesado se está descargando...',
        });
      } catch (error) {
        toast({
          title: 'Error al descargar',
          description: 'No se pudo descargar el archivo de audio. La URL no es válida o no se puede acceder al recurso.',
          variant: 'destructive'
        });
        logger.error('Error al descargar audio:', error);
      }
    } else {
      toast({
        title: 'Audio no disponible',
        description: 'No hay un archivo de audio disponible para descargar.',
        variant: 'destructive'
      });
    }
  };
  
  // Seleccionar salida diferente (actualizado para nuevo formato API)
  const handleSelectOutput = (index: number) => {
    // En el nuevo formato solo tenemos una URL de resultado, así que ignoramos el índice
    setSelectedOutput(0); // Siempre usamos el primer resultado
  };
  
  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Conversión de Voz
          </CardTitle>
          <CardDescription>
            Convierte tu voz utilizando modelos de voz de IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entrada de audio */}
          <div>
            <Label htmlFor="source-audio">Audio Original</Label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2">
              <Input
                id="source-audio"
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                className="w-full sm:flex-1 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {sourceAudio && (
                <Button 
                  variant="outline" 
                  size="icon"
                  className="mt-2 sm:mt-0"
                  onClick={toggleSourceAudio}
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
            </div>
            {sourceAudio && (
              <audio 
                ref={sourceAudioRef}
                className="hidden"
                controls={false}
                preload="metadata"
                onEnded={() => setIsPlaying(false)}
                onError={(e) => {
                  logger.error('Error loading source audio:', e);
                  toast({
                    title: 'Error de audio',
                    description: 'No se pudo cargar el audio original. El formato podría no ser compatible.',
                    variant: 'destructive'
                  });
                }}
              >
                <source 
                  src={URL.createObjectURL(sourceAudio)} 
                  type={sourceAudio.type || "audio/mpeg"} 
                />
                <source 
                  src={URL.createObjectURL(sourceAudio)} 
                  type="audio/mp3" 
                />
                Tu navegador no soporta la reproducción de audio
              </audio>
            )}
          </div>
          
          {/* Selección de modelo */}
          <div>
            <Label htmlFor="voice-model">Modelo de Voz</Label>
            <Select
              value={selectedModelId}
              onValueChange={setSelectedModelId}
            >
              <SelectTrigger id="voice-model" className="mt-2">
                <SelectValue placeholder="Selecciona un modelo de voz" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingModels ? (
                  <div className="flex justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : voiceModels && voiceModels.length > 0 ? (
                  voiceModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{model.name}</span>
                        {model.isCustom && (
                          <Badge variant="outline" className="ml-2">Personal</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No hay modelos disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Opciones de conversión */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="transpose" className="text-xs sm:text-sm">Transposición</Label>
                <Badge variant="outline" className="h-5 px-2 text-xs">
                  {transpose > 0 ? '+' : ''}{transpose}
                </Badge>
              </div>
              <Slider
                id="transpose"
                min={-12}
                max={12}
                step={1}
                value={[transpose]}
                onValueChange={(value) => setTranspose(value[0])}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>-12</span>
                <span>0</span>
                <span>+12</span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="generations" className="text-xs sm:text-sm">Generaciones</Label>
                <Badge variant="outline" className="h-5 px-2 text-xs">
                  {generationsCount}
                </Badge>
              </div>
              <Slider
                id="generations"
                min={1}
                max={5}
                step={1}
                value={[generationsCount]}
                onValueChange={(value) => setGenerationsCount(value[0])}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>3</span>
                <span>5</span>
              </div>
            </div>

            {/* Efectos de audio */}
            <div className="mt-4">
              <Label className="text-xs sm:text-sm mb-2 block">Efectos de Audio</Label>
              <div className="grid grid-cols-2 gap-2">
                {predefinedAudioEffects.map((effect) => {
                  // Busca si el efecto está seleccionado
                  const isSelected = selectedEffects.some(
                    (selectedEffect) => selectedEffect.name === effect.name && selectedEffect.enabled
                  );
                  return (
                    <Button
                      key={effect.name}
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => toggleEffect(effect.name)}
                      className="flex items-center justify-start gap-2 text-xs h-auto py-2"
                    >
                      <div className={`h-3 w-3 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
                      <span className="capitalize">{effect.name}</span>
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona los efectos que deseas aplicar a tu voz
              </p>
            </div>
          </div>
          
          {/* Botón de conversión */}
          <Button
            className="w-full"
            onClick={handleStartConversion}
            disabled={isConverting || !sourceAudio || !selectedModelId}
          >
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Convirtiendo...
              </>
            ) : (
              <>
                <Music2 className="mr-2 h-4 w-4" />
                Convertir Voz
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Resultados de la conversión */}
      {(taskId || conversionStatus) && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de la Conversión</CardTitle>
            <CardDescription>
              {isConverting ? 'Procesando tu conversión de voz...' : 'Conversión completada'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isConverting && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progreso de la conversión</span>
                    <span>En progreso...</span>
                  </div>
                  <Progress value={isConverting ? 33 : 100} className="h-2" />
                </div>
                <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
                  <span className="flex-1">
                    {window.innerWidth <= 640 ? 
                      "Procesando... No cierres esta ventana." : 
                      "La conversión puede tardar unos minutos. No cierres esta ventana."}
                  </span>
                </div>
              </div>
            )}
            
            {!isConverting && conversionStatus && conversionStatus.status === 'completed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Badge variant="default">Completado</Badge>
                  <span>Tu conversión de voz está lista</span>
                </div>
                
                {conversionStatus.result && conversionStatus.result.url && (
                  <div>
                    <audio 
                      ref={outputAudioRef}
                      className="hidden"
                      controls={false}
                      preload="metadata"
                      onEnded={() => setIsPlaying(false)}
                      onError={(e) => {
                        logger.error('Error loading converted audio:', e);
                        toast({
                          title: 'Error de reproducción',
                          description: 'No se pudo cargar el audio convertido. Intenta descargar el archivo directamente.',
                          variant: 'destructive'
                        });
                        setIsPlaying(false);
                      }}
                    >
                      <source 
                        src={conversionStatus.result.url} 
                        type="audio/wav" 
                      />
                      <source 
                        src={conversionStatus.result.url} 
                        type="audio/mpeg" 
                      />
                      Tu navegador no soporta la reproducción de audio
                    </audio>
                    
                    {/* Removida la selección múltiple, ahora solo tenemos una URL de resultado */}
                    
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <Button onClick={toggleOutputAudio} className="w-full sm:flex-1">
                        {outputAudioRef.current?.paused ? (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Reproducir
                          </>
                        ) : (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pausar
                          </>
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleDownloadOutput}
                        className="w-full sm:w-auto mt-1 sm:mt-0"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Configuración (no disponible en el nuevo formato de API) */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Configuración utilizada:</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Modelo: {selectedModelId || "No disponible"}</p>
                    <p>Transposición: {transpose || 0} semitonos</p>
                    <div>
                      <p>Efectos aplicados:</p>
                      {selectedEffects.filter(effect => effect.enabled).length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedEffects
                            .filter(effect => effect.enabled)
                            .map(effect => (
                              <Badge key={effect.name} variant="outline" className="text-xs">
                                {effect.name}
                              </Badge>
                            ))
                          }
                        </div>
                      ) : (
                        <span className="text-xs">Ninguno</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {!isConverting && conversionStatus && conversionStatus.status === 'failed' && (
              <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                <h4 className="text-red-600 dark:text-red-400 font-medium mb-1 text-sm sm:text-base">Error en la conversión</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {conversionStatus.error || "Ocurrió un error durante la conversión. Por favor intenta de nuevo con un audio diferente o un modelo distinto."}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-3 w-full sm:w-auto text-xs sm:text-sm px-2 py-1 h-8" 
                  onClick={() => setTaskId(null)}
                >
                  Intentar nuevamente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}