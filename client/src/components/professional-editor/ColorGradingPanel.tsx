/**
 * Color Grading Panel
 * Ajustes de color en tiempo real con sliders
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { useToast } from '../../hooks/use-toast';
import { Palette, RotateCcw, Sparkles, Check } from 'lucide-react';
import type { TimelineClip } from './EnhancedTimeline';
import {
  applyColorGrading,
  applyColorGradingPreset,
  resetColorGrading,
  COLOR_GRADING_PRESETS,
  DEFAULT_COLOR_GRADING,
  type ColorGradingSettings
} from '../../lib/services/color-grading-service';

interface ColorGradingPanelProps {
  clips: TimelineClip[];
  onClipsUpdated?: (clips: TimelineClip[]) => void;
}

export function ColorGradingPanel({ clips, onClipsUpdated }: ColorGradingPanelProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ColorGradingSettings>(DEFAULT_COLOR_GRADING);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Actualizar setting individual
  const updateSetting = (key: keyof ColorGradingSettings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSelectedPreset(null); // Deseleccionar preset al hacer cambios manuales
  };

  // Aplicar cambios al timeline
  const handleApply = () => {
    const updatedClips = applyColorGrading(clips, settings);
    onClipsUpdated?.(updatedClips);

    toast({
      title: 'Color grading aplicado',
      description: 'Los ajustes se han guardado en los clips',
    });
  };

  // Aplicar preset
  const handleApplyPreset = (presetId: string) => {
    const preset = COLOR_GRADING_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    setSettings(preset.settings);
    setSelectedPreset(presetId);

    const updatedClips = applyColorGradingPreset(clips, presetId);
    onClipsUpdated?.(updatedClips);

    toast({
      title: `Preset "${preset.name}" aplicado`,
      description: preset.description,
    });
  };

  // Resetear
  const handleReset = () => {
    setSettings(DEFAULT_COLOR_GRADING);
    setSelectedPreset(null);

    const updatedClips = resetColorGrading(clips);
    onClipsUpdated?.(updatedClips);

    toast({
      title: 'Color grading reseteado',
      description: 'Todos los ajustes han vuelto a los valores por defecto',
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-500" />
          Color Grading
        </CardTitle>
        <CardDescription>
          Ajusta colores, brillo y contraste en tiempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Presets */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Presets Rápidos</label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {COLOR_GRADING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset.id)}
                className={`
                  p-2 rounded-lg border-2 text-left transition-all
                  ${selectedPreset === preset.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                  }
                `}
                data-testid={`button-preset-${preset.id}`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-medium text-white">
                    {preset.name}
                  </span>
                  {selectedPreset === preset.id && (
                    <Check className="h-3 w-3 text-purple-500" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 line-clamp-2">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Controles Manuales */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Ajustes Manuales</label>
            {selectedPreset && (
              <Badge variant="outline" className="text-[10px]">
                Modificado
              </Badge>
            )}
          </div>

          {/* Brightness */}
          <ColorSlider
            label="Brillo"
            value={settings.brightness}
            onChange={(v) => updateSetting('brightness', v)}
            min={-100}
            max={100}
            icon="☀️"
          />

          {/* Contrast */}
          <ColorSlider
            label="Contraste"
            value={settings.contrast}
            onChange={(v) => updateSetting('contrast', v)}
            min={-100}
            max={100}
            icon="◐"
          />

          {/* Saturation */}
          <ColorSlider
            label="Saturación"
            value={settings.saturation}
            onChange={(v) => updateSetting('saturation', v)}
            min={-100}
            max={100}
            icon="🎨"
          />

          {/* Temperature */}
          <ColorSlider
            label="Temperatura"
            value={settings.temperature}
            onChange={(v) => updateSetting('temperature', v)}
            min={-100}
            max={100}
            icon="🌡️"
            colors={['#3b82f6', '#ef4444']}
          />

          {/* Exposure */}
          <ColorSlider
            label="Exposición"
            value={settings.exposure}
            onChange={(v) => updateSetting('exposure', v)}
            min={-100}
            max={100}
            icon="💡"
          />

          {/* Vignette */}
          <ColorSlider
            label="Viñeta"
            value={settings.vignette}
            onChange={(v) => updateSetting('vignette', v)}
            min={0}
            max={100}
            icon="⭕"
          />

          {/* Grain */}
          <ColorSlider
            label="Grano"
            value={settings.grain}
            onChange={(v) => updateSetting('grain', v)}
            min={0}
            max={100}
            icon="📹"
          />

          {/* Sharpen */}
          <ColorSlider
            label="Nitidez"
            value={settings.sharpen}
            onChange={(v) => updateSetting('sharpen', v)}
            min={0}
            max={100}
            icon="🔍"
          />
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={handleApply}
            className="w-full bg-purple-600 hover:bg-purple-700"
            data-testid="button-apply-color-grading"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Aplicar Color Grading
          </Button>

          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="button-reset-color-grading"
          >
            <RotateCcw className="h-3 w-3 mr-2" />
            Resetear
          </Button>
        </div>

        {/* Info */}
        <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
          <p className="text-sm text-zinc-400">
            💡 Usa los presets para aplicar looks profesionales rápidamente,
            o ajusta manualmente cada parámetro para un control total.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente de slider individual
interface ColorSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  icon?: string;
  colors?: [string, string];
}

function ColorSlider({ label, value, onChange, min, max, icon, colors }: ColorSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-400 flex items-center gap-1.5">
          {icon && <span className="text-sm">{icon}</span>}
          {label}
        </label>
        <span className="text-xs font-mono text-zinc-500">
          {value > 0 ? '+' : ''}{value}
        </span>
      </div>
      <div className="relative">
        <Slider
          value={[value]}
          onValueChange={(v) => onChange(v[0])}
          min={min}
          max={max}
          step={1}
          className="w-full"
        />
        {/* Gradient background */}
        {colors && (
          <div 
            className="absolute top-2 left-0 right-0 h-1 rounded-full -z-10 opacity-30"
            style={{
              background: `linear-gradient(to right, ${colors[0]}, ${colors[1]})`
            }}
          />
        )}
      </div>
    </div>
  );
}

export default ColorGradingPanel;
