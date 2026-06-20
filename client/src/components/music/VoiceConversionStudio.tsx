import React, { useState, useRef, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Loader2, Upload, Play, Pause, Download, 
  Music2, Music, Plus, Trash, Settings,
  Sliders, Speaker, Mic, Activity, BarChart2
} from 'lucide-react';
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
import { Switch } from '../ui/switch';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

import { voiceModelService } from '../../lib/services/voice-model-service';
import type { VoiceModel, VoiceConversionRequest, VoiceConversionResponse, AudioEffect, VoiceConversionRecord } from '../../lib/types/voice-model-types';

// Adaptando ConversionResult para que sea idéntico a VoiceConversionResponse
interface ConversionResult extends VoiceConversionResponse {
  // Asegurar que ConversionResult sea compatible con VoiceConversionResponse
  taskId: string;
  recordId?: string; // Hacemos esto opcional para que coincida con VoiceConversionResponse
}

interface VoiceConversionStudioProps {
  className?: string;
}

export function VoiceConversionStudio({ className }: VoiceConversionStudioProps) {
  // Estados para archivos y modelos de voz
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [voices, setVoices] = useState<{ id: string, name: string, model: string }[]>([]);
  
  // ID del usuario para las conversiones
  const userId = localStorage.getItem('currentUserId') || 'user123';
  
  // El ID del elemento de selección de modelo
  const MODEL_SELECTOR_ID = 'voice-model-selector';
  const [activeTab, setActiveTab] = useState<'voices' | 'history'>('voices');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  
  // Estados para los controles de reproducción
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  
  // Estados para los efectos de audio
  const [effectsEnabled, setEffectsEnabled] = useState<boolean>(false);
  const [effects, setEffects] = useState<AudioEffect[]>([
    {
      name: "autoEQ",
      enabled: false,
      settings: {
        profile: "balanced",
      }
    },
    {
      name: "voiceVariance",
      enabled: false,
      settings: {
        value: 50,
      }
    },
    {
      name: "widen",
      enabled: false,
      settings: {}
    },
    {
      name: "pitchCorrection",
      enabled: false,
      settings: {
        semitones: 0,
      }
    },
    {
      name: "delay",
      enabled: false,
      settings: {
        time: 30,
        feedback: 20,
      }
    },
    {
      name: "compressor",
      enabled: false,
      settings: {
        threshold: -24,
        ratio: 4,
      }
    },
    {
      name: "reverb",
      enabled: false,
      settings: {
        size: 30,
        decay: 20,
        mix: 30,
      }
    },
  ]);
  
  // Refs para manipulación de audio
  const audioInputRef = useRef<HTMLAudioElement>(null);
  const audioOutputRef = useRef<HTMLAudioElement>(null);
  
  // Consulta para obtener los modelos de voz disponibles
  const { data: voiceModels, isLoading: isLoadingModels } = useQuery({
    queryKey: ['voice-models'],
    queryFn: () => voiceModelService.getAvailableModels()
  });
  
  // Consulta para verificar el estado de la tarea de procesamiento
  const { 
    data: conversionStatus, 
    isLoading: isLoadingStatus,
    refetch: refetchStatus
  } = useQuery({
    queryKey: ['conversion-status', taskId],
    queryFn: () => voiceModelService.checkConversionStatus(taskId || ''),
    enabled: !!taskId,
    refetchInterval: isProcessing ? 2000 : false
  });
  
  // Consultamos las conversiones recientes
  const { data: recentConversions, isLoading: isLoadingRecent } = useQuery({
    queryKey: ['recent-conversions'],
    queryFn: async () => {
      const uid = localStorage.getItem('currentUserId') || 'user123'; // Usar ID almacenado o valor por defecto
      return voiceModelService.getUserVoiceConversions(uid);
    }
  });
  
  // Actualizamos el estado cuando la conversión se completa
  useEffect(() => {
    if (conversionStatus) {
      if (conversionStatus.status === 'completed') {
        setIsProcessing(false);
        toast({
          title: 'Procesamiento completado',
          description: 'El procesamiento de voz se ha completado con éxito.'
        });
      } else if (conversionStatus.status === 'failed') {
        setIsProcessing(false);
        toast({
          title: 'Error en el procesamiento',
          description: 'No se pudo completar el procesamiento de voz.',
          variant: 'destructive'
        });
      }
    }
  }, [conversionStatus]);
  
  // Mutación para iniciar la conversión
  const convertMutation = useMutation<ConversionResult, Error, VoiceConversionRequest>({
    mutationFn: async (request: VoiceConversionRequest) => {
      // Usar audioFile prioritariamente, con fallback a audio_file para compatibilidad
      const audioFile = request.audioFile || request.audio_file;
      
      if (!audioFile) {
        throw new Error('No se proporcionó un archivo de audio válido');
      }
      
      const apiResult = await voiceModelService.convertAudio(
        audioFile,
        request.model,
        {
          transpose: request.transpose,
          effects: request.effects
        },
        userId
      );
      
      // Convertir explícitamente a ConversionResult para garantizar compatibilidad de tipos
      const result: ConversionResult = {
        taskId: apiResult.taskId,
        recordId: apiResult.recordId || '' // Asignamos string vacío si es undefined
      };
      
      return result;
    },
    onSuccess: (result: ConversionResult) => {
      setTaskId(result.taskId);
      setIsProcessing(true);
      toast({
        title: 'Procesamiento iniciado',
        description: 'El procesamiento de voz ha comenzado. Este proceso puede tardar unos minutos.'
      });
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: 'Error al iniciar el procesamiento',
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
      
      setInputFile(file);
      
      // Extraer información del archivo para mostrar detalles
      if (audioInputRef.current) {
        const url = URL.createObjectURL(file);
        audioInputRef.current.src = url;
        audioInputRef.current.onloadedmetadata = () => {
          if (audioInputRef.current) {
            setDuration(audioInputRef.current.duration);
          }
        };
      }
    }
  };
  
  // Manejador para iniciar el procesamiento
  const handleStartProcessing = () => {
    if (!inputFile) {
      toast({
        title: 'Archivo de audio requerido',
        description: 'Por favor, sube un archivo de audio para procesar',
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
    
    // Extraer los efectos habilitados para aplicarlos
    const enabledEffects = effects
      .filter(effect => effect.enabled);
    
    // Crear la solicitud incluyendo los efectos utilizando camelCase
    const request: VoiceConversionRequest = {
      audioFile: inputFile, // Nuevo formato camelCase
      model: selectedModelId,
      transpose: 0, // O el valor que corresponda de los efectos
      generationsCount: 1, // Nuevo formato camelCase
      effects: enabledEffects.length > 0 ? enabledEffects : undefined
    };
    
    convertMutation.mutate(request);
  };
  
  // Manejador para añadir una voz al proyecto
  const handleAddVoice = () => {
    if (!selectedModelId) {
      toast({
        title: 'Modelo no seleccionado',
        description: 'Por favor, selecciona un modelo de voz para añadir',
        variant: 'destructive'
      });
      return;
    }
    
    const selectedModel = voiceModels?.find(model => model.id === selectedModelId);
    if (!selectedModel) return;
    
    const newVoice = {
      id: `voice_${Date.now()}`,
      name: selectedModel.name,
      model: selectedModel.id
    };
    
    setVoices([...voices, newVoice]);
    
    toast({
      title: 'Voz añadida',
      description: `La voz ${selectedModel.name} ha sido añadida al proyecto`
    });
  };
  
  // Manejador para eliminar una voz del proyecto
  const handleRemoveVoice = (voiceId: string) => {
    setVoices(voices.filter(voice => voice.id !== voiceId));
  };
  
  // Manejador para cambiar el estado de un efecto
  const handleToggleEffect = (effectName: string, enabled: boolean) => {
    setEffects(effects.map(effect => 
      effect.name === effectName 
        ? { ...effect, enabled } 
        : effect
    ));
  };
  
  // Manejador para ajustar la configuración de un efecto
  const handleEffectSettingChange = (effectName: string, settingName: string, value: number | string | boolean) => {
    setEffects(effects.map(effect => 
      effect.name === effectName 
        ? { 
            ...effect, 
            settings: { 
              ...effect.settings, 
              [settingName]: value 
            } 
          } 
        : effect
    ));
  };
  
  // Manejador para reproducir/pausar el audio de entrada
  const toggleInputAudio = () => {
    if (audioInputRef.current) {
      if (audioInputRef.current.paused) {
        audioInputRef.current.play();
        setIsPlaying(true);
      } else {
        audioInputRef.current.pause();
        setIsPlaying(false);
      }
    }
  };
  
  // Función para formatear el tiempo en MM:SS
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Función para formatear fecha con manejo seguro de tipos
  const formatDate = (dateOrTimestamp: any): string => {
    if (!dateOrTimestamp) return 'Fecha desconocida';
    
    try {
      // Caso 1: Es un objeto Timestamp de Firestore
      if (dateOrTimestamp && typeof dateOrTimestamp.toDate === 'function') {
        return dateOrTimestamp.toDate().toLocaleDateString();
      }
      
      // Caso 2: Es un objeto Date
      if (dateOrTimestamp instanceof Date) {
        return dateOrTimestamp.toLocaleDateString();
      }
      
      // Caso 3: Es un string ISO o timestamp numérico
      return new Date(dateOrTimestamp).toLocaleDateString();
    } catch (error) {
      logger.error('Error formatting date:', error);
      return 'Fecha inválida';
    }
  };
  
  // Actualizar la posición actual durante la reproducción
  useEffect(() => {
    const updateTime = () => {
      if (audioInputRef.current) {
        setCurrentTime(audioInputRef.current.currentTime);
      }
    };
    
    if (isPlaying) {
      const interval = setInterval(updateTime, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying]);
  
  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Estudio de Conversión de Voz
          </CardTitle>
          <CardDescription>
            Convierte y procesa tu voz con efectos profesionales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Panel principal con tabs */}
          <Tabs defaultValue="voices" onValueChange={(value) => setActiveTab(value as 'voices' | 'history')}>
            <TabsList className="grid w-full grid-cols-2 music-tabs-list">
              <TabsTrigger value="voices" className="music-tab-trigger">Voces</TabsTrigger>
              <TabsTrigger value="history" className="music-tab-trigger">Historial</TabsTrigger>
            </TabsList>
            
            <TabsContent value="voices" className="space-y-4">
              {/* Entrada de audio */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-16 w-16 bg-primary/20 rounded-md flex items-center justify-center">
                    <Activity className="h-10 w-10 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium">
                      {inputFile ? inputFile.name : 'Input File'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground music-player-controls">
                      <span>{inputFile ? formatTime(duration) : '0:00'}</span>
                      {inputFile && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 music-action-button"
                            onClick={toggleInputAudio}
                          >
                            {isPlaying ? (
                              <Pause className="h-3 w-3" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="music-action-button"
                    onClick={() => document.getElementById('input-audio')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Replace Audio
                  </Button>
                </div>
                <Input
                  id="input-audio"
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                </div>
                <audio 
                  ref={audioInputRef}
                  className="hidden"
                  controls={false}
                  preload="metadata"
                  onEnded={() => setIsPlaying(false)}
                  onError={(e) => {
                    logger.error('Error loading audio file:', e);
                    toast({
                      title: 'Error de audio',
                      description: 'No se pudo cargar el archivo de audio.',
                      variant: 'destructive'
                    });
                  }}
                />
              </div>
              
              {/* Lista de voces en el proyecto */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Voces</h3>
                  <Button variant="ghost" size="sm" className="h-8 music-action-button" onClick={handleAddVoice}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add voice to project
                  </Button>
                </div>
                
                {/* Lista de voces */}
                <div className="space-y-2">
                  {voices.length === 0 ? (
                    <div className="bg-muted/50 p-6 rounded-lg flex flex-col items-center justify-center">
                      <Mic className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No hay voces añadidas al proyecto.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Selecciona un modelo y haz clic en "Add voice to project"
                      </p>
                    </div>
                  ) : (
                    voices.map((voice) => (
                      <div 
                        key={voice.id} 
                        className="flex items-center justify-between bg-muted/50 p-3 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center">
                            <Music2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium">{voice.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {voiceModels?.find(m => m.id === voice.model)?.description?.substring(0, 30) || 'Voice model'}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 music-action-button">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Configuración de Voz</DialogTitle>
                                <DialogDescription>
                                  Ajusta los parámetros para la voz "{voice.name}"
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="voice-name">Nombre</Label>
                                  <Input 
                                    id="voice-name" 
                                    defaultValue={voice.name} 
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="voice-transpose">Transposición</Label>
                                  <Slider
                                    id="voice-transpose"
                                    min={-12}
                                    max={12}
                                    step={1}
                                    defaultValue={[0]}
                                    className="mt-2"
                                  />
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>-12</span>
                                    <span>0</span>
                                    <span>+12</span>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline">Cancelar</Button>
                                <Button>Guardar cambios</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-destructive/90 music-action-button"
                            onClick={() => handleRemoveVoice(voice.id)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Selección de modelo de voz */}
              <div>
                <Label htmlFor="voice-model">Modelo de Voz</Label>
                <Select
                  value={selectedModelId}
                  onValueChange={setSelectedModelId}
                >
                  <SelectTrigger className="mt-2">
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
            </TabsContent>
            
            <TabsContent value="history" className="space-y-4">
              {isLoadingRecent ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : recentConversions && recentConversions.length > 0 ? (
                <div className="space-y-2">
                  {recentConversions?.map((conversion: any) => (
                    <div 
                      key={conversion.id} 
                      className="flex items-center justify-between bg-muted/50 p-3 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center">
                          <Music2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium">
                            Conversión {formatDate(conversion.createdAt)}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            Modelo: {conversion.modelName || conversion.model || "Desconocido"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 music-player-controls">
                        {conversion.outputUrl && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 music-action-button"
                            onClick={() => {
                              window.open(conversion.outputUrl, '_blank');
                            }}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 music-action-button"
                          onClick={() => {
                            if (conversion.outputUrl) {
                              // Crear un enlace temporal para descargar el audio
                              const link = document.createElement('a');
                              link.href = conversion.outputUrl;
                              link.download = `converted_${Date.now()}.wav`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-muted/50 p-6 rounded-lg flex flex-col items-center justify-center">
                  <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay conversiones recientes.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Las conversiones que realices aparecerán aquí.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
          
          {/* Panel de efectos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Efectos</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="enable-effects" className="text-sm">
                  {effectsEnabled ? 'Habilitados' : 'Deshabilitados'}
                </Label>
                <Switch 
                  id="enable-effects" 
                  checked={effectsEnabled}
                  onCheckedChange={setEffectsEnabled}
                />
              </div>
            </div>
            
            <div className={`space-y-3 ${!effectsEnabled && 'opacity-50 pointer-events-none'}`}>
              {/* Auto EQ */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Auto EQ</Label>
                </div>
                <div className="flex items-center gap-2">
                  {effects.find(e => e.name === "autoEQ")?.enabled && (
                    <Select
                      value={(effects.find(e => e.name === "autoEQ")?.settings.profile as string) || "balanced"}
                      onValueChange={(value) => handleEffectSettingChange("autoEQ", "profile", value)}
                    >
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="bright">Bright</SelectItem>
                        <SelectItem value="clear">Clear</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Switch 
                    checked={effects.find(e => e.name === "autoEQ")?.enabled || false}
                    onCheckedChange={(checked) => handleToggleEffect("autoEQ", checked)}
                  />
                </div>
              </div>
              
              {/* Voice Variance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Voice Variance</Label>
                </div>
                <div className="flex items-center gap-2">
                  {effects.find(e => e.name === "voiceVariance")?.enabled && (
                    <div className="w-28 flex items-center">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[effects.find(e => e.name === "voiceVariance")?.settings.value as number || 50]}
                        onValueChange={(value) => handleEffectSettingChange("voiceVariance", "value", value[0])}
                      />
                      <span className="ml-2 text-xs w-6">
                        {effects.find(e => e.name === "voiceVariance")?.settings.value || 50}%
                      </span>
                    </div>
                  )}
                  <Switch 
                    checked={effects.find(e => e.name === "voiceVariance")?.enabled || false}
                    onCheckedChange={(checked) => handleToggleEffect("voiceVariance", checked)}
                  />
                </div>
              </div>
              
              {/* Widen */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Speaker className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Widen</Label>
                </div>
                <Switch 
                  checked={effects.find(e => e.name === "widen")?.enabled || false}
                  onCheckedChange={(checked) => handleToggleEffect("widen", checked)}
                />
              </div>
              
              {/* Pitch Correction */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Pitch Correction</Label>
                </div>
                <Switch 
                  checked={effects.find(e => e.name === "pitchCorrection")?.enabled || false}
                  onCheckedChange={(checked) => handleToggleEffect("pitchCorrection", checked)}
                />
              </div>
              
              {/* Delay */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Delay</Label>
                </div>
                <Switch 
                  checked={effects.find(e => e.name === "delay")?.enabled || false}
                  onCheckedChange={(checked) => handleToggleEffect("delay", checked)}
                />
              </div>
              
              {/* Compressor */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Compressor</Label>
                </div>
                <Switch 
                  checked={effects.find(e => e.name === "compressor")?.enabled || false}
                  onCheckedChange={(checked) => handleToggleEffect("compressor", checked)}
                />
              </div>
              
              {/* Reverb */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <Label className="text-sm">Reverb</Label>
                </div>
                <Switch 
                  checked={effects.find(e => e.name === "reverb")?.enabled || false}
                  onCheckedChange={(checked) => handleToggleEffect("reverb", checked)}
                />
              </div>
            </div>
          </div>
          
          {/* Botón de procesamiento */}
          <Button
            className="w-full music-action-button"
            onClick={handleStartProcessing}
            disabled={isProcessing || !inputFile || !selectedModelId}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Music2 className="mr-2 h-4 w-4" />
                Procesar Audio
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Resultados del procesamiento */}
      {(taskId || conversionStatus) && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Procesamiento</CardTitle>
            <CardDescription>
              {isProcessing ? 'Procesando tu audio...' : 'Procesamiento completado'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isProcessing && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progreso del procesamiento</span>
                    <span>En progreso...</span>
                  </div>
                  <Progress value={isProcessing ? 33 : 100} className="h-2" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>El procesamiento puede tardar unos minutos. No cierres esta ventana.</span>
                </div>
              </div>
            )}
            
            {!isProcessing && conversionStatus && conversionStatus.status === 'completed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Badge variant="default">Completado</Badge>
                  <span>Tu audio procesado está listo</span>
                </div>
                
                {conversionStatus.result && conversionStatus.result.url && (
                  <div className="space-y-2">
                    <audio 
                      ref={audioOutputRef}
                      controls
                      preload="metadata"
                      className="w-full"
                      src={conversionStatus.result.url}
                      onError={(e) => {
                        logger.error('Error loading processed audio:', e);
                        toast({
                          title: 'Error de reproducción',
                          description: 'No se pudo cargar el audio procesado. Intenta descargar el archivo directamente.',
                          variant: 'destructive'
                        });
                      }}
                    />
                    
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          if (conversionStatus.result?.url) {
                            const link = document.createElement('a');
                            link.href = conversionStatus.result.url;
                            link.download = `processed_${Date.now()}.wav`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                        Descargar Audio
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}