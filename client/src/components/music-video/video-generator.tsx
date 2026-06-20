import React, { useState } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Textarea } from '../ui/textarea';
import { toast } from '../../hooks/use-toast';
import { Loader2, Video, Wand2, Info, Check, Film, Clock3 } from 'lucide-react';

export interface VideoGeneratorProps {
  onGenerateVideo: (settings: VideoGenerationSettings) => Promise<void>;
  isLoading: boolean;
  scenesCount: number;
  // Soporte completo para clips de línea de tiempo con múltiples capas
  clips?: Array<{
    id: number;
    start: number;
    duration: number;
    // Tipo de clip con soporte para múltiples formatos de media
    type: 'video' | 'image' | 'transition' | 'audio' | 'effect' | 'text';
    // Layer al que pertenece: 0=audio, 1=video/imagen, 2=texto, 3=efectos
    layer: number;
    // Propiedades visuales
    thumbnail?: string;
    title: string;
    description?: string;
    imagePrompt?: string;
    // URLs de recursos
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    // Metadatos para información adicional y propiedades especiales
    metadata?: {
      section?: string;
      movementApplied?: boolean;
      movementPattern?: string;
      movementIntensity?: number;
      faceSwapApplied?: boolean;
      musicianIntegrated?: boolean;
      sourceIndex?: number;
    };
  }>;
  // Propiedades adicionales para edición y generación
  duration?: number; 
  isGenerating?: boolean;
  onGenerate?: () => Promise<void | string | null>;
}

export interface VideoGenerationSettings {
  model: string;
  quality: 'standard' | 'premium';
  duration: number;
  includeMusic: boolean;
  prompt: string;
  style: string;
  cameraMovement?: string;
}

const videoModels = [
  { id: 't2v-01', name: 'Standard', description: 'Generate videos from text' },
  { id: 'i2v-01', name: 'Image to Video', description: 'Animate your existing images' },
  { id: 's2v-01', name: 'Style to Video', description: 'Transfer visual styles' }
];

const cameraMovements = [
  'No movement',
  'Slow Zoom In',
  'Smooth Zoom Out',
  'Horizontal Pan',
  'Vertical Pan',
  'Dolly In',
  'Dolly Out',
  'Subtle Tracking',
  'Orbital Movement'
];

export function VideoGenerator({ onGenerateVideo, isLoading, scenesCount = 0, clips = [], duration = 15 }: VideoGeneratorProps) {
  // Inicializar con valores predeterminados, pero con consideración de clips y datos existentes
  const [settings, setSettings] = useState<VideoGenerationSettings>({
    model: 't2v-01',
    quality: 'standard',
    duration: duration > 0 ? Math.min(duration, 60) : 15, // Usar duración del proyecto o default
    includeMusic: true,
    prompt: generatePromptFromClips(clips), // Generar prompt basado en clips existentes
    style: 'cinematic',
    cameraMovement: 'Sin movimiento'
  });

  // Función para generar un prompt inicial basado en los clips existentes
  function generatePromptFromClips(clips: VideoGeneratorProps['clips']) {
    if (!clips || clips.length === 0) return '';
    
    // Extraer información de los clips para construir un prompt coherente
    const videoClips = clips.filter(clip => clip.type === 'video' || clip.type === 'image');
    if (videoClips.length === 0) return '';
    
    // Obtener secciones únicas
    const sections = Array.from(new Set(
      videoClips
        .map(clip => clip.metadata?.section)
        .filter(Boolean)
    ));
    
    // Extraer nombres/títulos de clips
    const clipTitles = videoClips.map(clip => clip.title).filter(Boolean);
    
    // Construir prompt básico
    return `Music video ${sections.join(', ')} with ${clipTitles.join(', ')}. Cinematic style, high quality.`;
  }

  const handleGenerate = async () => {
    if (!settings.prompt && settings.model === 't2v-01') {
      toast({
        title: "Prompt required",
        description: "Please enter a description for your video",
        variant: "destructive"
      });
      return;
    }
    
    // Guardar la configuración en localStorage para futuras referencias
    try {
      localStorage.setItem('last-video-generation-settings', JSON.stringify(settings));
    } catch (e) {
      logger.info('Error guardando configuración de video:', e);
    }
    
    await onGenerateVideo(settings);
  };

  // Tiempo estimado basado en los ajustes actuales
  const estimatedTime = () => {
    let baseTime = 120; // Tiempo base en segundos
    
    // Factores que afectan el tiempo
    if (settings.quality === 'premium') baseTime *= 1.5;
    if (settings.duration > 20) baseTime *= 1.3;
    
    // Convertir a minutos
    const minutes = Math.floor(baseTime / 60);
    const seconds = baseTime % 60;
    
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };
  
  // Estimación de costo basada en los ajustes actuales
  const estimatedCost = () => {
    let baseCost = 0.20; // Costo base en USD
    
    // Factores que afectan el costo
    if (settings.quality === 'premium') baseCost *= 2;
    if (settings.duration > 15) baseCost += (settings.duration - 15) * 0.05;
    
    return baseCost.toFixed(2);
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg">
      <CardHeader className="pb-4 space-y-1">
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Video className="h-6 w-6 text-primary" />
          </div>
          Generación de Video AI
        </CardTitle>
        <CardDescription className="text-base">
          Transforma tus escenas en videos de alta calidad con movimiento fluido
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="model-select" className="text-sm font-semibold">Modelo de Video</Label>
            <Film className="h-4 w-4 text-muted-foreground" />
          </div>
          <RadioGroup 
            value={settings.model} 
            onValueChange={(value) => setSettings({...settings, model: value})}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {videoModels.map((model) => (
              <div key={model.id} className="relative">
                <RadioGroupItem
                  value={model.id}
                  id={`model-${model.id}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`model-${model.id}`}
                  className="flex flex-col gap-2 rounded-lg border-2 border-muted bg-background/50 backdrop-blur p-4 hover:bg-accent/50 hover:border-primary/50 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:shadow-md cursor-pointer group"
                  data-testid={`model-option-${model.id}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-semibold text-sm">{model.name}</span>
                    <Check className="h-4 w-4 text-primary opacity-0 group-data-[state=checked]:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">{model.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div className="space-y-3">
          <Label htmlFor="quality" className="text-sm font-semibold">Calidad de Video</Label>
          <RadioGroup 
            value={settings.quality} 
            onValueChange={(value: 'standard' | 'premium') => setSettings({...settings, quality: value})}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div className="relative">
              <RadioGroupItem
                value="standard"
                id="quality-standard"
                className="peer sr-only"
              />
              <Label
                htmlFor="quality-standard"
                className="flex flex-col gap-2 rounded-lg border-2 border-muted bg-background/50 backdrop-blur p-4 hover:bg-accent/50 hover:border-primary/50 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:shadow-md cursor-pointer"
                data-testid="quality-standard"
              >
                <span className="font-semibold">Standard</span>
                <span className="text-xs text-muted-foreground">Calidad media (720p) - Más rápido</span>
              </Label>
            </div>
            <div className="relative">
              <RadioGroupItem
                value="premium"
                id="quality-premium"
                className="peer sr-only"
              />
              <Label
                htmlFor="quality-premium"
                className="flex flex-col gap-2 rounded-lg border-2 border-muted bg-background/50 backdrop-blur p-4 hover:bg-accent/50 hover:border-primary/50 transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:shadow-md cursor-pointer"
                data-testid="quality-premium"
              >
                <span className="font-semibold">Premium ✨</span>
                <span className="text-xs text-muted-foreground">Alta calidad (1080p) - Mejor resultado</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="space-y-3 bg-muted/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="duration" className="text-sm font-semibold">Duración</Label>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-primary" />
              <span className="text-base font-bold text-primary">{settings.duration}s</span>
            </div>
          </div>
          <Slider 
            id="duration"
            min={5} 
            max={30} 
            step={5}
            value={[settings.duration]} 
            onValueChange={(values) => setSettings({...settings, duration: values[0]})}
            className="cursor-pointer"
            data-testid="duration-slider"
          />
          <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground/80">
            <span>5s</span>
            <span className="text-center">15s</span>
            <span className="text-right">30s</span>
          </div>
        </div>
        
        {settings.model === 't2v-01' && (
          <div className="space-y-3">
            <Label htmlFor="prompt" className="text-sm font-semibold">Descripción del Video</Label>
            <Textarea 
              id="prompt" 
              placeholder="Describe con detalle qué quieres ver en el video..."
              value={settings.prompt}
              onChange={(e) => setSettings({...settings, prompt: e.target.value})}
              className="min-h-[100px] resize-none"
              data-testid="video-prompt"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Incluye detalles sobre atmósfera, colores, acciones y elementos visuales deseados.
            </p>
          </div>
        )}
        
        <div className="space-y-3">
          <Label htmlFor="camera-movement" className="text-sm font-semibold">Movimiento de Cámara</Label>
          <Select 
            value={settings.cameraMovement} 
            onValueChange={(value) => setSettings({...settings, cameraMovement: value})}
          >
            <SelectTrigger id="camera-movement" className="w-full" data-testid="camera-movement-select">
              <SelectValue placeholder="Selecciona movimiento" />
            </SelectTrigger>
            <SelectContent>
              {cameraMovements.map((movement) => (
                <SelectItem key={movement} value={movement} data-testid={`camera-${movement}`}>
                  {movement}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="pt-4">
          <Button 
            onClick={handleGenerate} 
            className="w-full h-12 bg-primary hover:bg-primary/90 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
            disabled={isLoading}
            data-testid="generate-video-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generando Video...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" />
                Generar Video
              </>
            )}
          </Button>
        </div>
        
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="border-2 border-primary/20 rounded-lg p-3 bg-primary/5 backdrop-blur">
            <div className="flex items-center gap-2 font-semibold text-primary mb-2">
              <Film className="h-4 w-4" />
              <span>Escenas</span>
            </div>
            <p className="text-muted-foreground">
              <span className="font-bold text-lg text-foreground">{scenesCount}</span> procesadas
            </p>
          </div>
          
          <div className="border-2 border-primary/20 rounded-lg p-3 bg-primary/5 backdrop-blur">
            <div className="flex items-center gap-2 font-semibold text-primary mb-2">
              <Clock3 className="h-4 w-4" />
              <span>Tiempo Est.</span>
            </div>
            <p className="text-muted-foreground">
              <span className="font-bold text-lg text-foreground">~{estimatedTime()}</span> min
            </p>
          </div>
          
          <div className="border-2 border-primary/20 rounded-lg p-3 bg-primary/5 backdrop-blur">
            <div className="flex items-center gap-2 font-semibold text-primary mb-2">
              <Info className="h-4 w-4" />
              <span>Proveedor</span>
            </div>
            <p className="text-muted-foreground font-semibold text-foreground">PiAPI/Hailuo</p>
          </div>
        </div>
        
        <div className="bg-primary/10 border-2 border-primary/20 p-4 rounded-lg text-sm">
          <p className="flex items-start gap-2 text-foreground/90">
            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              La generación puede tardar <strong>2-10 minutos</strong> según duración y calidad. Te notificaremos cuando esté listo.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}