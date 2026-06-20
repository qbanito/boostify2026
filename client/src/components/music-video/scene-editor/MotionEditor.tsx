/**
import { logger } from "../../lib/logger";
 * Componente MotionEditor
 * Editor avanzado para controlar aspectos de movimiento y efectos en la escena
 * Versión mejorada con presets de movimiento para diferentes estilos cinematográficos
 */
import React, { useState, useEffect } from 'react';
import { Label } from "../../ui/label";
import { Slider } from "../../ui/slider";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { RefreshCw, Wand2, Volume2, Film, ZoomIn, ChevronsUpDown, Wind, Sparkles, Palette } from 'lucide-react';
import { Switch } from "../../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../ui/tooltip";
import { Card, CardContent } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { useToast } from "../../../hooks/use-toast";

interface MotionEditorProps {
  settings?: {
    intensity: number;
    seed: string;
    duration: string;
    preset?: string;
  };
  autoSfx?: boolean;
  onSettingsChange: (settings: MotionEditorProps['settings']) => void;
  onAutoSfxChange: (autoSfx: boolean) => void;
}

// Opciones predefinidas para la duración del movimiento
const DURATION_OPTIONS = [
  '3s', '5s', '7s', '9s'
];

// Presets de movimiento para diferentes estilos cinematográficos
const MOTION_PRESETS = [
  {
    id: 'subtle-dolly',
    name: 'Dolly Suave',
    icon: Film,
    description: 'Movimiento suave de cámara hacia adelante, ideal para momento emotivos',
    settings: { intensity: 30, duration: '7s' }
  },
  {
    id: 'dramatic-zoom',
    name: 'Zoom Dramático',
    icon: ZoomIn,
    description: 'Acercamiento gradual para enfatizar emociones o detalles importantes',
    settings: { intensity: 60, duration: '5s' }
  },
  {
    id: 'cinematic-pan',
    name: 'Paneo Cinematográfico',
    icon: ChevronsUpDown,
    description: 'Movimiento horizontal pausado para revelar el entorno completo',
    settings: { intensity: 40, duration: '9s' }
  },
  {
    id: 'dynamic-tracking',
    name: 'Seguimiento Dinámico',
    icon: Wind,
    description: 'Movimiento fluido que sigue al sujeto con energía moderada',
    settings: { intensity: 70, duration: '5s' }
  },
  {
    id: 'gentle-floating',
    name: 'Flotación Suave',
    icon: Sparkles,
    description: 'Movimiento etéreo y flotante para escenas oníricas o relajantes',
    settings: { intensity: 25, duration: '9s' }
  }
];

export function MotionEditor({ 
  settings = { intensity: 50, seed: '123456', duration: '5s' }, 
  autoSfx = false,
  onSettingsChange,
  onAutoSfxChange
}: MotionEditorProps) {
  const { toast } = useToast();
  const [intensity, setIntensity] = useState(settings.intensity);
  const [seed, setSeed] = useState(settings.seed);
  const [duration, setDuration] = useState(settings.duration);
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(settings.preset);

  // Sincronizar con cambios de props
  useEffect(() => {
    setIntensity(settings.intensity);
    setSeed(settings.seed);
    setDuration(settings.duration);
    setSelectedPreset(settings.preset);
  }, [settings]);

  const handleIntensityChange = (value: number[]) => {
    const newIntensity = value[0];
    setIntensity(newIntensity);
    onSettingsChange({
      ...settings,
      intensity: newIntensity,
      preset: undefined // Limpiar preset al personalizar
    });
    setSelectedPreset(undefined);
  };

  const handleSeedChange = (value: string) => {
    setSeed(value);
    onSettingsChange({
      ...settings,
      seed: value
    });
  };

  const handleDurationChange = (value: string) => {
    setDuration(value);
    onSettingsChange({
      ...settings,
      duration: value,
      preset: undefined // Limpiar preset al personalizar
    });
    setSelectedPreset(undefined);
  };

  const handleAutoSfxChange = (checked: boolean) => {
    onAutoSfxChange(checked);
  };

  const generateRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000).toString();
    setSeed(newSeed);
    onSettingsChange({
      ...settings,
      seed: newSeed
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = MOTION_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    // Actualizar valores locales y en el padre
    setIntensity(preset.settings.intensity);
    setDuration(preset.settings.duration);
    setSelectedPreset(presetId);
    
    onSettingsChange({
      ...settings,
      intensity: preset.settings.intensity,
      duration: preset.settings.duration,
      preset: presetId
    });
    
    toast({
      title: "Preset aplicado",
      description: `Se ha aplicado el estilo "${preset.name}" a la escena.`
    });
  };

  // Clasificar la intensidad para mostrar etiquetas descriptivas
  const getIntensityLabel = () => {
    if (intensity < 20) return "Muy sutil";
    if (intensity < 40) return "Sutil";
    if (intensity < 60) return "Moderada";
    if (intensity < 80) return "Intensa";
    return "Muy intensa";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Motion editor</Label>
        <div className="flex items-center space-x-2">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <Switch 
            checked={autoSfx} 
            onCheckedChange={handleAutoSfxChange}
            id="auto-sfx"
          />
          <Label htmlFor="auto-sfx" className="text-xs">
            Auto SFX
          </Label>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 mb-2">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-muted-foreground">Intensidad</Label>
              <Badge variant="outline" className="text-xs font-normal">
                {getIntensityLabel()} ({intensity}%)
              </Badge>
            </div>
            <Slider 
              value={[intensity]} 
              min={0} 
              max={100} 
              step={1} 
              onValueChange={handleIntensityChange}
              className="py-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Seed</Label>
              <div className="flex space-x-2">
                <Input 
                  value={seed}
                  onChange={(e) => handleSeedChange(e.target.value)}
                  className="h-8"
                />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={generateRandomSeed}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Generar seed aleatorio</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duración</Label>
              <Select 
                value={duration} 
                onValueChange={handleDurationChange}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Duración" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="presets" className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MOTION_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <Card 
                  key={preset.id} 
                  className={`cursor-pointer border ${selectedPreset === preset.id ? 'border-primary' : ''}`}
                  onClick={() => applyPreset(preset.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <div className={`p-2 rounded-full ${selectedPreset === preset.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {preset.settings.intensity}% intensidad
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {preset.settings.duration}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      
      {selectedPreset && activeTab === "basic" && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Preset activo: <span className="font-medium">{MOTION_PRESETS.find(p => p.id === selectedPreset)?.name}</span>
          </p>
          <Button 
            variant="ghost" 
            size="sm"
            className="h-6 text-xs"
            onClick={() => setActiveTab("presets")}
          >
            <Wand2 className="h-3 w-3 mr-1" />
            Cambiar preset
          </Button>
        </div>
      )}
    </div>
  );
}