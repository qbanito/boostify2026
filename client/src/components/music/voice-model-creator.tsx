/**
import { logger } from "@/lib/logger";
 * Componente de Creación de Modelos de Voz
 * 
 * Este componente permite a los usuarios:
 * 1. Grabar o subir muestras de voz
 * 2. Entrenar un modelo personalizado de voz
 * 3. Ver el progreso de entrenamiento
 */

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Progress } from '../ui/progress';
import { toast } from '../../hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Mic, Upload, Pause, Save, Server, Info, AlertCircle } from 'lucide-react';

interface VoiceModelCreatorProps {
  className?: string;
  onModelCreated?: (modelId: string) => void;
}

export function VoiceModelCreator({ className, onModelCreated }: VoiceModelCreatorProps) {
  // Estados para controlar la grabación
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [audioSamples, setAudioSamples] = useState<{id: string; name: string; duration: number; url: string}[]>([]);
  const [modelName, setModelName] = useState<string>('');
  const [enhanceFidelity, setEnhanceFidelity] = useState<boolean>(true);
  const [reduceNoise, setReduceNoise] = useState<boolean>(true);
  const [isCreatingModel, setIsCreatingModel] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<number>(0);
  
  // Referencia para acceder al grabador
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Función para iniciar grabación
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const sampleName = `Sample_${audioSamples.length + 1}`;
        
        setAudioSamples([
          ...audioSamples,
          {
            id: `sample-${Date.now()}`,
            name: sampleName,
            duration: recordingTime,
            url: audioUrl
          }
        ]);
        
        toast({
          title: 'Grabación completada',
          description: `Se ha guardado la muestra "${sampleName}" (${recordingTime}s)`
        });
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Iniciar temporizador para seguir el tiempo de grabación
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
    } catch (error) {
      logger.error('Error al iniciar grabación:', error);
      toast({
        title: 'Error de grabación',
        description: 'No se pudo acceder al micrófono. Verifica los permisos.',
        variant: 'destructive'
      });
    }
  };
  
  // Función para detener grabación
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Detener todos los tracks de audio
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      // Limpiar temporizador
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };
  
  // Función para subir archivo de audio
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Verificar que sea un archivo de audio
      if (!file.type.startsWith('audio/')) {
        toast({
          title: 'Tipo de archivo incorrecto',
          description: 'Por favor, sube un archivo de audio (WAV, MP3, etc.)',
          variant: 'destructive'
        });
        return;
      }
      
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      
      // Cargar el audio para obtener metadatos como duración
      audio.onloadedmetadata = () => {
        const sampleName = file.name.replace(/\.[^/.]+$/, ""); // Nombre sin extensión
        
        setAudioSamples([
          ...audioSamples,
          {
            id: `sample-${Date.now()}`,
            name: sampleName,
            duration: Math.round(audio.duration),
            url: audioUrl
          }
        ]);
        
        toast({
          title: 'Archivo subido',
          description: `Se ha añadido "${sampleName}" a tus muestras`
        });
      };
      
      audio.onerror = () => {
        toast({
          title: 'Error al cargar audio',
          description: 'No se pudo procesar el archivo de audio',
          variant: 'destructive'
        });
      };
      
      // Cargar el audio para procesar metadatos
      audio.load();
    }
  };
  
  // Eliminar una muestra
  const removeSample = (sampleId: string) => {
    setAudioSamples(audioSamples.filter(sample => sample.id !== sampleId));
  };
  
  // Iniciar creación del modelo
  const startModelCreation = () => {
    if (audioSamples.length < 2) {
      toast({
        title: 'Insufficient samples',
        description: 'You need at least 2 voice samples to create a model',
        variant: 'destructive'
      });
      return;
    }
    
    if (!modelName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please provide a name for your voice model',
        variant: 'destructive'
      });
      return;
    }
    
    // Simulación de proceso de entrenamiento
    setIsCreatingModel(true);
    setTrainingProgress(0);
    
    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsCreatingModel(false);
          
          toast({
            title: 'Model created successfully',
            description: `Your model "${modelName}" has been created and is ready to use`
          });
          
          // Generate a mock model ID and call the callback if provided
          const modelId = `model-${Date.now()}`;
          if (onModelCreated) {
            onModelCreated(modelId);
          }
          
          return 100;
        }
        return prev + 5;
      });
    }, 500);
  };
  
  // Formato del tiempo en MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="mb-4">
        <CardTitle className="flex items-center gap-2 mb-2">
          <Server className="h-5 w-5 text-primary" />
          Voice Model Training
        </CardTitle>
        <CardDescription className="text-base">
          Create your own custom voice models for voice conversion with AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Información sobre requisitos */}
        <Alert className="bg-muted/50 mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Requirements for optimal results</AlertTitle>
          <AlertDescription className="mt-1">
            For best results, provide at least 3-5 high-quality audio samples
            with a total duration of 2-5 minutes recorded in a noise-free environment.
          </AlertDescription>
        </Alert>
        
        {/* Voice Recording Section */}
        <div className="space-y-6 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Voice Samples</h3>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => document.getElementById('upload-audio')?.click()}
                disabled={isRecording}
                className="px-4 py-2 h-10"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Audio
              </Button>
              <Input
                id="upload-audio"
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              {isRecording ? (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={stopRecording}
                  className="px-4 py-2 h-10"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Stop ({formatTime(recordingTime)})
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={startRecording}
                  className="px-4 py-2 h-10"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Record
                </Button>
              )}
            </div>
          </div>
          
          {/* Sample List */}
          <div className="space-y-2">
            {audioSamples.length === 0 ? (
              <div className="bg-muted/30 p-10 rounded-lg flex flex-col items-center justify-center text-center">
                <Server className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-base text-muted-foreground mb-2">
                  No voice samples yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Record or upload audio files to create your voice model
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 p-5 rounded-lg">
                {audioSamples.map((sample) => (
                  <div 
                    key={sample.id} 
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Mic className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{sample.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(sample.duration)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {
                          const audio = new Audio(sample.url);
                          audio.play();
                        }}
                      >
                        <Mic className="h-5 w-5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => removeSample(sample.id)}
                      >
                        <AlertCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="mt-3 text-sm text-muted-foreground">
                  {audioSamples.length} samples · {formatTime(audioSamples.reduce((acc, sample) => acc + sample.duration, 0))} total duration
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Model Configuration */}
        <div className="space-y-5 pt-4 mb-6">
          <h3 className="text-base font-medium">Model Configuration</h3>
          
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3">
              <Label htmlFor="model-name" className="text-sm">Model Name</Label>
              <Input
                id="model-name"
                placeholder="e.g., My Professional Voice"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="h-11"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <Label htmlFor="enhance-fidelity" className="text-sm">Enhance Fidelity</Label>
                <p className="text-xs text-muted-foreground">
                  Improves realism and reduces artifacts
                </p>
              </div>
              <Switch
                id="enhance-fidelity"
                checked={enhanceFidelity}
                onCheckedChange={setEnhanceFidelity}
                className="scale-110"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <Label htmlFor="reduce-noise" className="text-sm">Noise Reduction</Label>
                <p className="text-xs text-muted-foreground">
                  Eliminates background noise and improves clarity
                </p>
              </div>
              <Switch
                id="reduce-noise"
                checked={reduceNoise}
                onCheckedChange={setReduceNoise}
                className="scale-110"
              />
            </div>
          </div>
        </div>
        
        {/* Training Progress */}
        {isCreatingModel && (
          <div className="space-y-3 mb-4 mt-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Training model...</span>
              <span>{trainingProgress}%</span>
            </div>
            <Progress value={trainingProgress} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">
              Training may take several minutes. Please do not close this window.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="border-t bg-muted/30 pt-6 pb-6 flex justify-between mt-4">
        <Button variant="outline" disabled={isCreatingModel} className="h-11">
          <Info className="h-4 w-4 mr-2" />
          Learn More
        </Button>
        <Button
          disabled={audioSamples.length < 2 || !modelName.trim() || isCreatingModel}
          onClick={startModelCreation}
          className="h-11"
        >
          <Save className="h-4 w-4 mr-2" />
          {isCreatingModel ? 'Training...' : 'Create Model'}
        </Button>
      </CardFooter>
    </Card>
  );
}