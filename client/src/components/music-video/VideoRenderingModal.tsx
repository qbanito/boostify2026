import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Loader2, Film, Download, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import type { TimelineClip } from "./TimelineEditor";

interface VideoRenderingModalProps {
  open: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  audioUrl?: string;
  audioDuration?: number;
  projectId?: string;
  projectName?: string;
  onComplete?: (videoUrl: string) => void;
}

type RenderStatus = 'idle' | 'starting' | 'queued' | 'processing' | 'done' | 'failed';

export function VideoRenderingModal({
  open,
  onClose,
  clips,
  audioUrl,
  audioDuration,
  projectId,
  projectName,
  onComplete,
}: VideoRenderingModalProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<RenderStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');

  useEffect(() => {
    // Polling para verificar el estado del renderizado
    if (renderId && (status === 'queued' || status === 'processing')) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/video-rendering/status/${renderId}`);
          const data = await response.json();

          if (data.success) {
            setStatus(data.status);
            setProgress(data.progress || 0);

            if (data.status === 'done' && data.url) {
              setVideoUrl(data.url);
              clearInterval(interval);
              
              // Actualizar proyecto si existe
              if (projectId) {
                await updateProjectWithVideo(data.url);
              }

              toast({
                title: "Video renderizado exitosamente",
                description: "Tu video está listo para descargar",
              });

              onComplete?.(data.url);
            } else if (data.status === 'failed') {
              setError(data.error || 'Error desconocido en el renderizado');
              clearInterval(interval);
              toast({
                title: "Error en el renderizado",
                description: data.error || 'Error desconocido',
                variant: "destructive",
              });
            }
          }
        } catch (err: any) {
          logger.error('Error verificando estado:', err);
          setError(err.message);
          clearInterval(interval);
        }
      }, 5000); // Verificar cada 5 segundos

      return () => clearInterval(interval);
    }
  }, [renderId, status, projectId, onComplete, toast]);

  const updateProjectWithVideo = async (url: string) => {
    if (!projectId) return;

    try {
      await fetch('/api/video-rendering/update-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          videoUrl: url,
        }),
      });
    } catch (err) {
      logger.error('Error actualizando proyecto:', err);
    }
  };

  const startRendering = async () => {
    try {
      setStatus('starting');
      setError(null);
      setProgress(0);

      // Preparar clips para el renderizado
      const renderClips = clips
        .filter(clip => clip.imageUrl || clip.videoUrl)
        .map(clip => ({
          id: clip.id.toString(),
          videoUrl: clip.videoUrl,
          imageUrl: clip.imageUrl,
          start: clip.start,
          duration: clip.duration,
          transition: 'fade' as const,
        }));

      if (renderClips.length === 0) {
        throw new Error('No hay clips para renderizar');
      }

      const response = await fetch('/api/video-rendering/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ? parseInt(projectId) : undefined,
          clips: renderClips,
          audioUrl,
          audioDuration,
          resolution,
          quality,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error iniciando renderizado');
      }

      setRenderId(data.renderId);
      setStatus(data.status || 'queued');
      setProgress(data.progress || 10);

      toast({
        title: "Renderizado iniciado",
        description: "Tu video está siendo procesado...",
      });
    } catch (err: any) {
      logger.error('Error iniciando renderizado:', err);
      setError(err.message);
      setStatus('failed');
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (videoUrl) {
      window.open(videoUrl, '_blank');
    }
  };

  const handleClose = () => {
    if (status !== 'processing' && status !== 'queued') {
      onClose();
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'idle':
      case 'starting':
        return <Film className="h-8 w-8 text-primary" />;
      case 'queued':
      case 'processing':
        return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
      case 'done':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'failed':
        return <XCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Listo para renderizar';
      case 'starting':
        return 'Iniciando renderizado...';
      case 'queued':
        return 'En cola de renderizado...';
      case 'processing':
        return 'Renderizando tu video...';
      case 'done':
        return '¡Video listo!';
      case 'failed':
        return 'Error en el renderizado';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Renderizar Video Final
          </DialogTitle>
          <DialogDescription>
            {projectName && `Proyecto: ${projectName} | `}
            {clips.length} clips, {audioDuration ? `${Math.round(audioDuration)}s` : 'sin audio'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Estado */}
          <div className="flex flex-col items-center gap-4">
            {getStatusIcon()}
            <p className="text-lg font-semibold">{getStatusText()}</p>
            
            {error && (
              <div className="w-full p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {(status === 'starting' || status === 'queued' || status === 'processing') && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {progress}% completado
              </p>
            </div>
          )}

          {/* Configuración (solo en estado idle) */}
          {status === 'idle' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolución</Label>
                <Select
                  value={resolution}
                  onValueChange={(value: any) => setResolution(value)}
                >
                  <SelectTrigger id="resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD) - Recomendado</SelectItem>
                    <SelectItem value="4k">4K (Ultra HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quality">Calidad</Label>
                <Select
                  value={quality}
                  onValueChange={(value: any) => setQuality(value)}
                >
                  <SelectTrigger id="quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja (Rápido)</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta (Recomendado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Video listo */}
          {status === 'done' && videoUrl && (
            <div className="space-y-4">
              <video
                src={videoUrl}
                controls
                className="w-full rounded-lg"
                data-testid="rendered-video-preview"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={startRendering} data-testid="button-start-rendering">
                <Film className="mr-2 h-4 w-4" />
                Iniciar Renderizado
              </Button>
            </>
          )}

          {status === 'done' && videoUrl && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button onClick={handleDownload} data-testid="button-download-video">
                <Download className="mr-2 h-4 w-4" />
                Descargar Video
              </Button>
            </>
          )}

          {(status === 'queued' || status === 'processing') && (
            <Button variant="outline" disabled>
              Procesando...
            </Button>
          )}

          {status === 'failed' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button onClick={startRendering} variant="destructive">
                Reintentar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
