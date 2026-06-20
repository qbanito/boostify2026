/**
 * Transition Panel
 * Controla transiciones entre clips (con toggle on/off)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { useToast } from '../../hooks/use-toast';
import { Zap, Play, AlertCircle } from 'lucide-react';
import type { TimelineClip } from './EnhancedTimeline';
import {
  applyAutoTransitions,
  toggleTransitions,
  validateTransitions,
  TRANSITION_PRESETS,
  type TransitionType,
  type ClipWithTransition
} from '../../lib/services/transition-service';

interface TransitionPanelProps {
  clips: TimelineClip[];
  onClipsUpdated?: (clips: TimelineClip[]) => void;
}

export function TransitionPanel({ clips, onClipsUpdated }: TransitionPanelProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [selectedType, setSelectedType] = useState<TransitionType>('dissolve');
  const [duration, setDuration] = useState(1.0);

  // Aplicar transiciones
  const handleApplyTransitions = () => {
    const clipsWithTransitions = applyAutoTransitions(
      clips,
      selectedType,
      {
        enabled,
        duration,
        easing: 'ease-in-out',
        skipFirst: true,
        skipLast: false
      }
    );

    // Validar
    const validation = validateTransitions(clipsWithTransitions);
    
    if (validation.errors.length > 0) {
      toast({
        title: 'Error en transiciones',
        description: validation.errors[0],
        variant: 'destructive'
      });
      return;
    }

    if (validation.warnings.length > 0) {
      toast({
        title: 'Advertencia',
        description: validation.warnings[0],
      });
    }

    onClipsUpdated?.(clipsWithTransitions);

    toast({
      title: 'Transiciones aplicadas',
      description: `${TRANSITION_PRESETS[selectedType].name} - ${duration.toFixed(1)}s`,
    });
  };

  // Toggle on/off
  const handleToggle = (newEnabled: boolean) => {
    setEnabled(newEnabled);

    // Si hay clips con transiciones, actualizar su estado
    if (clips.some((c: any) => c.transition)) {
      const updated = toggleTransitions(clips as ClipWithTransition[], newEnabled);
      onClipsUpdated?.(updated);

      toast({
        title: newEnabled ? 'Transiciones activadas' : 'Transiciones desactivadas',
        description: newEnabled 
          ? 'Las transiciones están ahora visibles'
          : 'Las transiciones están ocultas (sin eliminar)',
      });
    }
  };

  // Tipos de transición disponibles
  const transitionTypes: TransitionType[] = [
    'dissolve',
    'fade',
    'cross-dissolve',
    'wipe',
    'slide',
    'zoom',
    'whip-pan',
    'glitch'
  ];

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Transiciones
        </CardTitle>
        <CardDescription>
          Aplica transiciones automáticas entre clips
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Principal */}
        <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
          <div className="flex-1">
            <Label htmlFor="transitions-enabled" className="text-white font-medium">
              {enabled ? 'Activadas' : 'Desactivadas'}
            </Label>
            <p className="text-xs text-zinc-400 mt-0.5">
              {enabled 
                ? 'Las transiciones se aplicarán al video'
                : 'Las transiciones están deshabilitadas'
              }
            </p>
          </div>
          <Switch
            id="transitions-enabled"
            checked={enabled}
            onCheckedChange={handleToggle}
            data-testid="switch-transitions"
          />
        </div>

        {/* Tipo de Transición */}
        <div className="space-y-2">
          <Label className="text-sm text-zinc-400">
            Tipo de Transición
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {transitionTypes.map((type) => {
              const preset = TRANSITION_PRESETS[type];
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`
                    p-2 rounded-lg border-2 text-left transition-all
                    ${selectedType === type
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-zinc-800 bg-zinc-800/30 hover:border-zinc-700'
                    }
                  `}
                  data-testid={`button-transition-${type}`}
                >
                  <div className="text-lg mb-1">{preset.icon}</div>
                  <div className="text-xs font-medium text-white">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {preset.defaultDuration.toFixed(1)}s
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duración */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-zinc-400">
              Duración
            </Label>
            <span className="text-sm text-zinc-500">
              {duration.toFixed(1)}s
            </span>
          </div>
          <Slider
            value={[duration]}
            onValueChange={(v) => setDuration(v[0])}
            min={0.1}
            max={3.0}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Preview Info */}
        {selectedType && (
          <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800">
            <div className="flex items-start gap-2">
              <div className="text-2xl">{TRANSITION_PRESETS[selectedType].icon}</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {TRANSITION_PRESETS[selectedType].name}
                </p>
                <p className="text-xs text-zinc-400">
                  {TRANSITION_PRESETS[selectedType].description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Aplicar Button */}
        <Button
          onClick={handleApplyTransitions}
          className="w-full bg-yellow-600 hover:bg-yellow-700"
          data-testid="button-apply-transitions"
        >
          <Play className="h-4 w-4 mr-2" />
          Aplicar Transiciones
        </Button>

        {/* Warning */}
        {enabled && clips.length < 2 && (
          <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <AlertCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300">
              Necesitas al menos 2 clips en el timeline para aplicar transiciones
            </p>
          </div>
        )}

        {/* Info */}
        <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
          <p className="text-sm text-zinc-400">
            💡 Las transiciones se aplican automáticamente entre todos los clips.
            Puedes activarlas/desactivarlas con el switch sin perder la configuración.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default TransitionPanel;
