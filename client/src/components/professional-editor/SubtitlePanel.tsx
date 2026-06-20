/**
 * Subtitle Panel
 * Genera y gestiona subtítulos automáticos
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Slider } from '../ui/slider';
import { useToast } from '../../hooks/use-toast';
import { Subtitles, Download, Trash2, AlignLeft } from 'lucide-react';
import type { TimelineClip, TimelineTrack } from './EnhancedTimeline';
import {
  generateSubtitlesFromTranscription,
  createSubtitleClip,
  createSubtitleTrack,
  convertToSRT,
  convertToVTT,
  type SubtitleLine
} from '../../lib/services/subtitle-generation-service';

interface SubtitlePanelProps {
  transcription?: string;
  duration: number;
  onSubtitlesGenerated?: (clips: TimelineClip[], track: TimelineTrack) => void;
}

export function SubtitlePanel({
  transcription,
  duration,
  onSubtitlesGenerated
}: SubtitlePanelProps) {
  const { toast } = useToast();
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [maxWordsPerLine, setMaxWordsPerLine] = useState(8);
  const [minDisplayTime, setMinDisplayTime] = useState(1.5);

  // Generar subtítulos
  const handleGenerateSubtitles = () => {
    if (!transcription) {
      toast({
        title: 'No hay transcripción',
        description: 'Primero necesitas transcribir el audio',
        variant: 'destructive'
      });
      return;
    }

    const generated = generateSubtitlesFromTranscription(
      transcription,
      duration,
      {
        maxWordsPerLine,
        minDisplayTime,
        maxDisplayTime: 5
      }
    );

    setSubtitles(generated);

    toast({
      title: 'Subtítulos generados',
      description: `${generated.length} líneas de subtítulos creadas`,
    });
  };

  // Añadir al timeline
  const handleAddToTimeline = () => {
    if (subtitles.length === 0) {
      toast({
        title: 'No hay subtítulos',
        description: 'Genera subtítulos primero',
        variant: 'destructive'
      });
      return;
    }

    // Crear track de subtítulos
    const track = createSubtitleTrack();

    // Crear clips de subtítulos
    const subtitleClips = subtitles.map(subtitle =>
      createSubtitleClip(subtitle, track.id)
    );

    onSubtitlesGenerated?.(subtitleClips, track);

    toast({
      title: 'Subtítulos añadidos',
      description: `${subtitleClips.length} clips añadidos al timeline`,
    });
  };

  // Descargar SRT
  const handleDownloadSRT = () => {
    if (subtitles.length === 0) return;

    const srt = convertToSRT(subtitles);
    downloadFile(srt, 'subtitles.srt', 'text/plain');

    toast({
      title: 'SRT descargado',
      description: 'Archivo de subtítulos guardado',
    });
  };

  // Descargar VTT
  const handleDownloadVTT = () => {
    if (subtitles.length === 0) return;

    const vtt = convertToVTT(subtitles);
    downloadFile(vtt, 'subtitles.vtt', 'text/vtt');

    toast({
      title: 'VTT descargado',
      description: 'Archivo de subtítulos guardado',
    });
  };

  // Limpiar subtítulos
  const handleClear = () => {
    setSubtitles([]);
    toast({
      title: 'Subtítulos eliminados',
      description: 'Los subtítulos han sido limpiados',
    });
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Subtitles className="h-5 w-5 text-blue-500" />
          Subtítulos Automáticos
        </CardTitle>
        <CardDescription>
          Genera subtítulos desde la transcripción
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuración */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-400">
                Palabras por línea
              </label>
              <span className="text-sm text-zinc-500">
                {maxWordsPerLine}
              </span>
            </div>
            <Slider
              value={[maxWordsPerLine]}
              onValueChange={(v) => setMaxWordsPerLine(v[0])}
              min={4}
              max={12}
              step={1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-400">
                Tiempo mínimo (seg)
              </label>
              <span className="text-sm text-zinc-500">
                {minDisplayTime.toFixed(1)}s
              </span>
            </div>
            <Slider
              value={[minDisplayTime]}
              onValueChange={(v) => setMinDisplayTime(v[0])}
              min={0.5}
              max={3.0}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        {/* Generar Button */}
        <Button
          onClick={handleGenerateSubtitles}
          disabled={!transcription}
          className="w-full bg-blue-600 hover:bg-blue-700"
          data-testid="button-generate-subtitles"
        >
          <AlignLeft className="h-4 w-4 mr-2" />
          Generar Subtítulos
        </Button>

        {/* Preview */}
        {subtitles.length > 0 && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Líneas</span>
                <Badge variant="secondary">{subtitles.length}</Badge>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-zinc-800/30 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-xs text-zinc-500 mb-2">Preview:</p>
              {subtitles.slice(0, 3).map((line, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs text-zinc-400">
                    {line.start.toFixed(1)}s - {line.end.toFixed(1)}s
                  </p>
                  <p className="text-sm text-white">{line.text}</p>
                </div>
              ))}
              {subtitles.length > 3 && (
                <p className="text-xs text-zinc-500">
                  +{subtitles.length - 3} más...
                </p>
              )}
            </div>

            {/* Acciones */}
            <div className="space-y-2">
              <Button
                onClick={handleAddToTimeline}
                variant="default"
                className="w-full"
                data-testid="button-add-subtitles-timeline"
              >
                <Subtitles className="h-4 w-4 mr-2" />
                Añadir al Timeline
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleDownloadSRT}
                  variant="outline"
                  size="sm"
                  data-testid="button-download-srt"
                >
                  <Download className="h-3 w-3 mr-1" />
                  SRT
                </Button>
                <Button
                  onClick={handleDownloadVTT}
                  variant="outline"
                  size="sm"
                  data-testid="button-download-vtt"
                >
                  <Download className="h-3 w-3 mr-1" />
                  VTT
                </Button>
              </div>

              <Button
                onClick={handleClear}
                variant="ghost"
                size="sm"
                className="w-full"
                data-testid="button-clear-subtitles"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Limpiar
              </Button>
            </div>
          </div>
        )}

        {/* Info */}
        {!transcription && (
          <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
            <p className="text-sm text-zinc-400">
              💡 Los subtítulos se generan automáticamente desde la transcripción
              de tu audio. Ajusta las configuraciones arriba para personalizar.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper para descargar archivos
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default SubtitlePanel;
