/**
 * Timeline Actions Component
 * Acciones avanzadas: Generación de videos y Exportación a MP4
 */

import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { useToast } from '../../hooks/use-toast';
import { 
  Video, 
  Download, 
  Wand2, 
  Loader2,
  FileVideo,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

import type { TimelineClip, TimelineTrack } from './EnhancedTimeline';
import {
  generateBatchVideosFromClips,
  getAvailableVideoModels,
  type VideoModel,
  type VideoGenerationProgress
} from '../../lib/services/timeline-video-generation-service';
import {
  exportTimelineToMP4,
  estimateExportSize,
  type ExportProgress
} from '../../lib/services/timeline-export-service';

interface TimelineActionsProps {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  duration: number;
  onClipsUpdate?: (clips: TimelineClip[]) => void;
}

export function TimelineActions({ clips, tracks, duration, onClipsUpdate }: TimelineActionsProps) {
  const { toast } = useToast();
  
  // Video Generation State
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedModel, setSelectedModel] = useState<VideoModel>('kling-2.1-pro-i2v');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<VideoGenerationProgress | null>(null);
  
  // Export State
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportResolution, setExportResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [exportQuality, setExportQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  const availableModels = getAvailableVideoModels();

  // Contar clips de imagen
  const imageClips = clips.filter(c => c.type === 'image' && c.url);

  /**
   * Generar videos desde imágenes
   */
  const handleGenerateVideos = async () => {
    if (imageClips.length === 0) {
      toast({
        title: "No hay clips de imagen",
        description: "Agrega clips de imagen al timeline para generar videos",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress({
      status: 'queued',
      progress: 0
    });

    try {
      const results = await generateBatchVideosFromClips({
        clips: imageClips,
        model: selectedModel,
        duration: 5,
        onProgress: (progress) => {
          setGenerationProgress(progress);
        }
      });

      // Actualizar clips con videos generados
      if (onClipsUpdate) {
        const updatedClips = clips.map(clip => {
          const result = results.find(r => r.clipId === clip.id);
          if (result && result.status === 'completed' && result.videoUrl) {
            return {
              ...clip,
              type: 'video' as const,
              url: result.videoUrl
            };
          }
          return clip;
        });
        onClipsUpdate(updatedClips);
      }

      const successCount = results.filter(r => r.status === 'completed').length;
      const failedCount = results.filter(r => r.status === 'failed').length;

      toast({
        title: "Generación completada",
        description: `${successCount} videos generados exitosamente${failedCount > 0 ? `, ${failedCount} fallidos` : ''}`,
      });

      setShowGenerateDialog(false);
      
    } catch (error: any) {
      console.error('Error generando videos:', error);
      toast({
        title: "Error generando videos",
        description: error.message || "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  /**
   * Exportar timeline a MP4
   */
  const handleExportToMP4 = async () => {
    if (clips.length === 0) {
      toast({
        title: "No hay clips para exportar",
        description: "Agrega clips al timeline para exportar",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    setExportProgress({
      stage: 'preparing',
      progress: 0,
      message: 'Preparando exportación...'
    });

    try {
      const result = await exportTimelineToMP4({
        clips,
        tracks,
        duration,
        resolution: exportResolution,
        quality: exportQuality,
        includeAudio: true
      }, (progress) => {
        setExportProgress(progress);
      });

      if (result.success && result.videoUrl) {
        // Descargar el video
        const a = document.createElement('a');
        a.href = result.videoUrl;
        a.download = `timeline-export-${Date.now()}.mp4`;
        a.click();

        toast({
          title: "Exportación completada",
          description: `Video exportado exitosamente (${result.fileSize ? `${(result.fileSize / 1024 / 1024).toFixed(2)} MB` : ''})`,
        });

        setShowExportDialog(false);
      } else {
        throw new Error(result.error || 'Error exportando video');
      }
      
    } catch (error: any) {
      console.error('Error exportando timeline:', error);
      toast({
        title: "Error exportando video",
        description: error.message || "Error desconocido",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const estimatedSize = estimateExportSize(duration, exportResolution, exportQuality);

  return (
    <div className="flex items-center gap-2">
      {/* Generar Videos */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowGenerateDialog(true)}
        className="flex items-center gap-2"
        disabled={imageClips.length === 0}
        data-testid="button-generate-videos"
      >
        <Wand2 className="h-4 w-4" />
        Generar Videos
        {imageClips.length > 0 && (
          <Badge variant="secondary" className="ml-1">
            {imageClips.length}
          </Badge>
        )}
      </Button>

      {/* Exportar a MP4 */}
      <Button
        variant="default"
        size="sm"
        onClick={() => setShowExportDialog(true)}
        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
        disabled={clips.length === 0}
        data-testid="button-export-mp4"
      >
        <Download className="h-4 w-4" />
        Exportar MP4
      </Button>

      {/* Dialog: Generar Videos */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Generar Videos desde Imágenes
            </DialogTitle>
            <DialogDescription>
              Convierte {imageClips.length} clips de imagen en videos animados usando IA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector de Modelo */}
            <div className="space-y-2">
              <Label>Modelo de Generación</Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as VideoModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.description} • {model.pricing}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            {isGenerating && generationProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {generationProgress.status === 'processing' ? 'Generando...' : 'Procesando...'}
                  </span>
                  <span>{generationProgress.progress}%</span>
                </div>
                <Progress value={generationProgress.progress} />
              </div>
            )}

            {/* Info */}
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                Se generarán <strong>{imageClips.length} videos</strong> de aproximadamente 5 segundos cada uno.
                El proceso puede tardar varios minutos.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateDialog(false)}
              disabled={isGenerating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGenerateVideos}
              disabled={isGenerating}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generar Videos
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Exportar MP4 */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileVideo className="h-5 w-5 text-orange-500" />
              Exportar Timeline a MP4
            </DialogTitle>
            <DialogDescription>
              Exporta tu proyecto como un video MP4 de alta calidad
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Resolución */}
            <div className="space-y-2">
              <Label>Resolución</Label>
              <Select value={exportResolution} onValueChange={(v: any) => setExportResolution(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">HD 720p (1280x720)</SelectItem>
                  <SelectItem value="1080p">Full HD 1080p (1920x1080)</SelectItem>
                  <SelectItem value="4k">4K UHD (3840x2160)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Calidad */}
            <div className="space-y-2">
              <Label>Calidad</Label>
              <Select value={exportQuality} onValueChange={(v: any) => setExportQuality(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja (Rápido, archivo pequeño)</SelectItem>
                  <SelectItem value="medium">Media (Equilibrado)</SelectItem>
                  <SelectItem value="high">Alta (Recomendado)</SelectItem>
                  <SelectItem value="ultra">Ultra (Máxima calidad)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Progress */}
            {isExporting && exportProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {exportProgress.message}
                  </span>
                  <span>{exportProgress.progress}%</span>
                </div>
                <Progress value={exportProgress.progress} />
                {exportProgress.stage && (
                  <p className="text-xs text-muted-foreground">
                    Etapa: {exportProgress.stage}
                  </p>
                )}
              </div>
            )}

            {/* Info */}
            <div className="rounded-lg bg-muted p-3 text-sm space-y-2">
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">Duración:</span>
                <strong>{duration.toFixed(1)}s</strong>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">Clips totales:</span>
                <strong>{clips.length}</strong>
              </p>
              <p className="flex items-center justify-between">
                <span className="text-muted-foreground">Tamaño estimado:</span>
                <strong>{estimatedSize.sizeText}</strong>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(false)}
              disabled={isExporting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExportToMP4}
              disabled={isExporting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar MP4
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TimelineActions;
