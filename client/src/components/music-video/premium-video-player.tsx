import { useState, useRef, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import { useToast } from "../../hooks/use-toast";
import { Lock, Play, Pause, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { apiRequest } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";

const PREVIEW_LIMIT_SECONDS = 10;

interface PremiumVideoPlayerProps {
  videoId: string;
  videoUrl: string;
  title: string;
  isPurchased?: boolean;
  onPurchaseComplete?: () => void;
}

export function PremiumVideoPlayer({
  videoId,
  videoUrl,
  title,
  isPurchased = false,
  onPurchaseComplete
}: PremiumVideoPlayerProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPurchasePrompt, setShowPurchasePrompt] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (!videoElement) return;
    
    const onTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
      
      // Si no está comprado y supera el límite de tiempo, pausar y mostrar prompt
      if (!isPurchased && videoElement.currentTime >= PREVIEW_LIMIT_SECONDS) {
        videoElement.pause();
        setIsPlaying(false);
        setShowPurchasePrompt(true);
      }
    };
    
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onDurationChange = () => setDuration(videoElement.duration);
    
    videoElement.addEventListener('timeupdate', onTimeUpdate);
    videoElement.addEventListener('play', onPlay);
    videoElement.addEventListener('pause', onPause);
    videoElement.addEventListener('durationchange', onDurationChange);
    
    return () => {
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
      videoElement.removeEventListener('play', onPlay);
      videoElement.removeEventListener('pause', onPause);
      videoElement.removeEventListener('durationchange', onDurationChange);
    };
  }, [isPurchased]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      toast({
        title: "Necesitas iniciar sesión",
        description: "Por favor inicia sesión para comprar este video",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessingPayment(true);
      
      const response = await apiRequest('/api/stripe/create-music-video-payment', 'POST', {
        videoId
      });

      if (response.alreadyPurchased) {
        toast({
          title: "Video ya comprado",
          description: "Ya has comprado este video anteriormente. ¡Disfrútalo!",
        });
        if (onPurchaseComplete) {
          onPurchaseComplete();
        }
        setShowPurchasePrompt(false);
        return;
      }

      if (response.url) {
        window.location.href = response.url;
      } else {
        throw new Error("No se pudo crear la sesión de pago");
      }
    } catch (error) {
      logger.error("Error al iniciar el proceso de pago:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al procesar tu pago. Por favor intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const seekBackward = () => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 5);
      videoRef.current.currentTime = newTime;
      
      // Si no está comprado y estamos cerca del límite, asegurar que no lo pase
      if (!isPurchased && newTime > PREVIEW_LIMIT_SECONDS - 5) {
        videoRef.current.currentTime = Math.min(newTime, PREVIEW_LIMIT_SECONDS - 0.1);
      }
    }
  };

  const seekForward = () => {
    if (videoRef.current) {
      if (isPurchased) {
        // Si está comprado, permite avanzar normalmente
        videoRef.current.currentTime = Math.min(
          videoRef.current.duration, 
          videoRef.current.currentTime + 5
        );
      } else {
        // Si no está comprado, limitamos al tiempo de preview
        const newTime = Math.min(
          PREVIEW_LIMIT_SECONDS, 
          videoRef.current.currentTime + 5
        );
        videoRef.current.currentTime = newTime;
        
        // Si llegamos al límite, mostrar el prompt
        if (newTime >= PREVIEW_LIMIT_SECONDS) {
          videoRef.current.pause();
          setIsPlaying(false);
          setShowPurchasePrompt(true);
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getProgressPercentage = () => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="relative">
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-auto"
            poster={`https://picsum.photos/seed/${videoId}/800/450`}
          />
          
          {!isPurchased && (
            <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs flex items-center">
              <Lock className="h-3 w-3 mr-1" />
              Vista previa
            </div>
          )}
          
          {/* Barra de progreso */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div 
              className="absolute h-full bg-orange-500"
              style={{ width: `${getProgressPercentage()}%` }}
            />
            
            {!isPurchased && (
              <div 
                className="absolute h-full bg-red-500 opacity-50"
                style={{ left: `${(PREVIEW_LIMIT_SECONDS / duration) * 100}%`, width: '2px' }}
              />
            )}
          </div>
          
          {/* Controles de reproducción superpuestos */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full p-1 opacity-0 hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              onClick={seekBackward}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={seekForward}
              className="h-8 w-8 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <div className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {isPurchased ? formatTime(duration) : formatTime(Math.min(PREVIEW_LIMIT_SECONDS, duration))}
              </div>
            </div>
            
            {!isPurchased && (
              <Button 
                variant="default" 
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => setShowPurchasePrompt(true)}
              >
                Comprar Video Completo
              </Button>
            )}
            
            {isPurchased && (
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Diálogo de compra */}
      <Dialog open={showPurchasePrompt} onOpenChange={setShowPurchasePrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Quieres ver el video completo?</DialogTitle>
            <DialogDescription>
              Has visto los primeros 10 segundos del video. Para ver el video completo, puedes comprarlo por solo $199.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="font-semibold mb-2">Lo que obtendrás:</h4>
            <ul className="space-y-2 list-disc pl-5">
              <li>Acceso completo al video musical</li>
              <li>Alta calidad sin restricciones</li>
              <li>Opción para descargar el video</li>
              <li>Acceso permanente al contenido</li>
            </ul>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPurchasePrompt(false)}
            >
              Seguir en vista previa
            </Button>
            <Button 
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handlePurchase}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? 'Procesando...' : 'Comprar por $199'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}