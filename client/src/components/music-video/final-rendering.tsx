import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Card } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Progress } from "../ui/progress";
import { useToast } from "../../hooks/use-toast";
import { Download, Share, Film, ZoomIn, CheckCircle2, RefreshCw, ArrowUpRight } from "lucide-react";
import { TimelineClip } from "./timeline-editor";

interface FinalRenderingProps {
  timelineClips: TimelineClip[];
  videoUrl?: string;
  onUpscaleVideo: (options: UpscaleOptions) => Promise<string>;
  onDownloadVideo: () => void;
  onShareVideo: () => void;
}

export interface UpscaleOptions {
  resolution: "720p" | "1080p" | "4k";
  quality: "standard" | "high" | "ultra";
  framerate: number;
  stabilization: boolean;
}

export function FinalRendering({
  timelineClips,
  videoUrl,
  onUpscaleVideo,
  onDownloadVideo,
  onShareVideo
}: FinalRenderingProps) {
  const { toast } = useToast();
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [enhancedVideoUrl, setEnhancedVideoUrl] = useState<string | undefined>(videoUrl);
  const [upscaleOptions, setUpscaleOptions] = useState<UpscaleOptions>({
    resolution: "1080p",
    quality: "high",
    framerate: 30,
    stabilization: true
  });
  
  useEffect(() => {
    if (videoUrl && !enhancedVideoUrl) {
      setEnhancedVideoUrl(videoUrl);
    }
  }, [videoUrl]);
  
  // Simulación de progreso para dar feedback visual durante el proceso de upscaling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isUpscaling) {
      interval = setInterval(() => {
        setProgress(prev => {
          // Incremento no lineal para simular un proceso más realista
          // Al principio avanza más rápido, luego se ralentiza en el medio
          // y finalmente se acelera al final
          const increment = prev < 30 ? 2 : prev < 70 ? 0.5 : 1;
          const newProgress = prev + increment;
          return newProgress >= 100 ? 100 : newProgress;
        });
      }, 500);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isUpscaling]);
  
  const handleUpscaleVideo = async () => {
    if (!videoUrl || timelineClips.length === 0) {
      toast({
        title: "Error",
        description: "No hay un video disponible para mejorar",
        variant: "destructive"
      });
      return;
    }
    
    setIsUpscaling(true);
    setProgress(0);
    
    try {
      toast({
        title: "Procesando",
        description: "Mejorando la calidad del video..."
      });
      
      // Llamar al servicio de upscaling
      const enhancedUrl = await onUpscaleVideo(upscaleOptions);
      
      // Simular tiempo de espera para procesamiento
      setTimeout(() => {
        setProgress(100);
        setEnhancedVideoUrl(enhancedUrl);
        setIsUpscaling(false);
        
        toast({
          title: "Éxito",
          description: "Video mejorado correctamente con Qubico",
        });
      }, 1500);
      
    } catch (error) {
      logger.error("Error upscaling video:", error);
      setIsUpscaling(false);
      setProgress(0);
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al mejorar el video",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <Label>Video Renderizado</Label>
        <Card className="p-0 overflow-hidden">
          {enhancedVideoUrl ? (
            <video 
              src={enhancedVideoUrl} 
              className="w-full aspect-video" 
              controls
            />
          ) : (
            <div className="w-full aspect-video bg-muted flex items-center justify-center">
              <Film className="h-12 w-12 text-muted-foreground" />
              <p className="ml-2 text-muted-foreground">No hay video disponible</p>
            </div>
          )}
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Label>Configuración de Upscaling</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="resolution">Resolución</Label>
              <Select 
                disabled={isUpscaling}
                value={upscaleOptions.resolution}
                onValueChange={(value: "720p" | "1080p" | "4k") => 
                  setUpscaleOptions(prev => ({ ...prev, resolution: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar resolución" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="720p">HD (720p)</SelectItem>
                  <SelectItem value="1080p">Full HD (1080p)</SelectItem>
                  <SelectItem value="4k">Ultra HD (4K)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="quality">Calidad</Label>
              <Select 
                disabled={isUpscaling}
                value={upscaleOptions.quality}
                onValueChange={(value: "standard" | "high" | "ultra") => 
                  setUpscaleOptions(prev => ({ ...prev, quality: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar calidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Estándar</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="ultra">Ultra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 col-span-2">
              <div className="flex justify-between">
                <Label className="text-xs" htmlFor="framerate">Fotogramas por segundo: {upscaleOptions.framerate}</Label>
              </div>
              <Slider
                disabled={isUpscaling}
                value={[upscaleOptions.framerate]}
                min={24}
                max={60}
                step={1}
                onValueChange={(value) => 
                  setUpscaleOptions(prev => ({ ...prev, framerate: value[0] }))
                }
              />
            </div>
            
            <div className="col-span-2 flex items-center space-x-2">
              <input
                type="checkbox"
                id="stabilization"
                disabled={isUpscaling}
                checked={upscaleOptions.stabilization}
                onChange={(e) => 
                  setUpscaleOptions(prev => ({ ...prev, stabilization: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="stabilization" className="text-sm">Aplicar estabilización de video</Label>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <Label>Acciones</Label>
          <div className="space-y-3">
            <Button 
              className="w-full"
              disabled={isUpscaling || !videoUrl}
              onClick={handleUpscaleVideo}
            >
              {isUpscaling ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Mejorando video...
                </>
              ) : progress === 100 ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Video mejorado
                </>
              ) : (
                <>
                  <ZoomIn className="mr-2 h-4 w-4" />
                  Mejorar calidad de video
                </>
              )}
            </Button>
            
            {isUpscaling && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Procesando con Qubico Video Toolkit</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                disabled={!enhancedVideoUrl || isUpscaling}
                onClick={onDownloadVideo}
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
              
              <Button
                variant="outline"
                disabled={!enhancedVideoUrl || isUpscaling}
                onClick={onShareVideo}
              >
                <Share className="mr-2 h-4 w-4" />
                Compartir
              </Button>
            </div>
            
            <div className="pt-2">
              <p className="text-xs text-muted-foreground flex items-center">
                Potenciado por Qubico Video Toolkit
                <ArrowUpRight className="ml-1 h-3 w-3" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}