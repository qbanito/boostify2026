/**
 * Beat Sync Panel
 * Panel para detectar beats y sincronizar clips automáticamente
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { useToast } from '../../hooks/use-toast';
import { Music, Zap, Activity, CheckCircle2 } from 'lucide-react';
import type { TimelineClip } from './EnhancedTimeline';
import { detectBeats, alignClipsToBeats, suggestCutsOnBeats, type BeatAnalysis } from '../../lib/services/beat-detection-service';

interface BeatSyncPanelProps {
  clips: TimelineClip[];
  duration: number;
  onClipsAligned?: (alignedClips: TimelineClip[]) => void;
}

export function BeatSyncPanel({ clips, duration, onClipsAligned }: BeatSyncPanelProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [beatAnalysis, setBeatAnalysis] = useState<BeatAnalysis | null>(null);
  const [sensitivity, setSensitivity] = useState(50);

  // Detectar beats del audio
  const handleDetectBeats = async () => {
    setIsAnalyzing(true);

    try {
      // Buscar clip de audio
      const audioClip = clips.find(c => c.type === 'audio');
      
      if (!audioClip) {
        toast({
          title: 'No hay audio',
          description: 'Añade un archivo de audio al timeline primero',
          variant: 'destructive'
        });
        return;
      }

      // Detectar beats
      const analysis = await detectBeats(audioClip.url);
      setBeatAnalysis(analysis);

      toast({
        title: 'Beats detectados',
        description: `${analysis.beats.length} beats encontrados • BPM: ${analysis.bpm}`,
      });
    } catch (error) {
      console.error('Error detectando beats:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron detectar los beats del audio',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Alinear clips a beats
  const handleAlignToBeats = () => {
    if (!beatAnalysis) {
      toast({
        title: 'Detecta beats primero',
        description: 'Haz click en "Detectar Beats" antes de alinear',
        variant: 'destructive'
      });
      return;
    }

    const alignedClips = alignClipsToBeats(clips, beatAnalysis.beats);
    onClipsAligned?.(alignedClips);

    toast({
      title: 'Clips alineados',
      description: 'Los clips se alinearon automáticamente a los beats',
    });
  };

  // Sugerir cortes en beats
  const handleSuggestCuts = () => {
    if (!beatAnalysis) {
      toast({
        title: 'Detecta beats primero',
        description: 'Haz click en "Detectar Beats" antes de sugerir cortes',
        variant: 'destructive'
      });
      return;
    }

    const cutTimes = suggestCutsOnBeats(duration, beatAnalysis.beats, 20);
    
    toast({
      title: 'Cortes sugeridos',
      description: `${cutTimes.length} puntos de corte identificados en los beats principales`,
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5 text-orange-500" />
          Auto-Sync con Beats
        </CardTitle>
        <CardDescription>
          Detecta beats automáticamente y sincroniza clips con la música
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Detect Beats Button */}
        <Button
          onClick={handleDetectBeats}
          disabled={isAnalyzing}
          className="w-full"
          data-testid="button-detect-beats"
        >
          {isAnalyzing ? (
            <>
              <Activity className="h-4 w-4 mr-2 animate-pulse" />
              Analizando audio...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Detectar Beats
            </>
          )}
        </Button>

        {/* Beat Analysis Results */}
        {beatAnalysis && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400">BPM</p>
                <p className="text-2xl font-bold text-orange-500">
                  {beatAnalysis.bpm}
                </p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-xs text-zinc-400">Beats</p>
                <p className="text-2xl font-bold text-green-500">
                  {beatAnalysis.beats.length}
                </p>
              </div>
            </div>

            {/* Music Sections */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                Secciones Detectadas:
              </p>
              <div className="flex flex-wrap gap-2">
                {beatAnalysis.sections.map((section, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className={getSectionColor(section.type)}
                  >
                    {section.type.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={handleAlignToBeats}
                variant="default"
                className="w-full bg-orange-600 hover:bg-orange-700"
                data-testid="button-align-beats"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Alinear Clips a Beats
              </Button>

              <Button
                onClick={handleSuggestCuts}
                variant="outline"
                className="w-full"
                data-testid="button-suggest-cuts"
              >
                <Zap className="h-4 w-4 mr-2" />
                Sugerir Puntos de Corte
              </Button>
            </div>

            {/* Sensitivity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400">
                  Sensibilidad
                </label>
                <span className="text-sm text-zinc-500">
                  {sensitivity}%
                </span>
              </div>
              <Slider
                value={[sensitivity]}
                onValueChange={(v) => setSensitivity(v[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Info */}
        {!beatAnalysis && (
          <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
            <p className="text-sm text-zinc-400">
              💡 El detector de beats analiza tu música y encuentra los puntos
              de máxima energía para sincronizar tus clips automáticamente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getSectionColor(type: string): string {
  const colors: Record<string, string> = {
    intro: 'bg-blue-600',
    verse: 'bg-green-600',
    chorus: 'bg-orange-600',
    bridge: 'bg-purple-600',
    outro: 'bg-zinc-600'
  };
  return colors[type] || 'bg-zinc-600';
}

export default BeatSyncPanel;
