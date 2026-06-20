import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { Label } from "../ui/label";
import { TimelineClip } from "./timeline-editor";
import FaceSwap, { FaceSwapResult } from "../face-swap/face-swap";
import { Button } from "../ui/button";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { User, Wand2, Loader2, Check, AlertCircle, Info } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { faceSwapService } from "../../lib/services/face-swap-service";

// Extiende la definición de TimelineClip para incluir shotType
interface EnhancedTimelineClip extends TimelineClip {
  shotType?: string;
}

// Define propiedades adicionales para metadata
interface ExtendedMetadata {
  section?: string;
  movementApplied?: boolean;
  movementPattern?: string;
  movementIntensity?: number;
  faceSwapApplied?: boolean;
  musicianIntegrated?: boolean;
  shotType?: string;
  faceSwapTimestamp?: string;
}

interface ArtistCustomizationProps {
  clips?: TimelineClip[];
  onUpdateClip?: (clipId: number, updates: Partial<TimelineClip>) => void;
  onFaceSwapComplete?: (results: FaceSwapResult[]) => void;
  isPurchased?: boolean;
  videoId?: string;
}

/**
 * Componente para la personalización de artista en el video musical
 * Incluye la integración con Face Swap y detección automática de planos
 */
export function ArtistCustomization({ 
  clips = [], 
  onUpdateClip,
  onFaceSwapComplete,
  isPurchased = false,
  videoId 
}: ArtistCustomizationProps) {
  const [faceSwapResults, setFaceSwapResults] = useState<FaceSwapResult[]>([]);
  const [artistImage, setArtistImage] = useState<string | null>(null);
  const [autoDetect, setAutoDetect] = useState<boolean>(true);
  const [autoSwapInProgress, setAutoSwapInProgress] = useState<boolean>(false);
  const [autoSwapProgress, setAutoSwapProgress] = useState<number>(0);
  const [detectedClips, setDetectedClips] = useState<TimelineClip[]>([]);
  const [processedClips, setProcessedClips] = useState<number[]>([]);
  const { toast } = useToast();
  
  // Manejar la finalización del face swap
  const handleFaceSwapComplete = (results: FaceSwapResult[], uploadedImage?: string | null) => {
    setFaceSwapResults(results);
    
    // Extraer la imagen del artista del parámetro o del primer resultado si existe
    const sourceImage = uploadedImage || (results.length > 0 ? results[0].sourceImageUrl : null);
    
    if (sourceImage) {
      setArtistImage(sourceImage);
      
      // Si tenemos la imagen del artista y el autodetect está activado, 
      // iniciar el procesamiento automático
      if (autoDetect && !autoSwapInProgress) {
        handleAutoDetectSwap(sourceImage);
      }
    }
    
    if (onFaceSwapComplete) {
      onFaceSwapComplete(results);
    }
  };
  
  // Detectar planos "close-up" y "medium shot" automáticamente
  useEffect(() => {
    if (!clips || clips.length === 0) return;
    
    // Filtrar clips que coincidan con los tipos de plano que necesitamos
    const eligibleClips = clips.filter(clip => {
      const enhancedClip = clip as EnhancedTimelineClip;
      // Verificar el shotType del clip (pueden estar en diferentes formatos)
      const shotType = enhancedClip.shotType?.toLowerCase() || '';
      
      // Verificar en metadata si está disponible
      const metadata = clip.metadata as ExtendedMetadata | undefined;
      const metadataShotType = metadata?.shotType?.toLowerCase() || '';
      
      return (
        shotType.includes('close-up') || 
        shotType.includes('closeup') || 
        shotType.includes('medium') || 
        shotType.includes('medio') ||
        metadataShotType.includes('close-up') ||
        metadataShotType.includes('closeup') ||
        metadataShotType.includes('medium') ||
        metadataShotType.includes('medio')
      );
    });
    
    setDetectedClips(eligibleClips);
    
    // Si tenemos la imagen del artista y el autodetect está activado,
    // podemos iniciar el procesamiento automático
    if (artistImage && autoDetect && !autoSwapInProgress && eligibleClips.length > 0) {
      handleAutoDetectSwap(artistImage);
    }
  }, [clips, artistImage, autoDetect]);
  
  // Función para manejar el face swap automático en planos detectados
  const handleAutoDetectSwap = async (sourceImage: string) => {
    if (!detectedClips.length) {
      toast({
        title: "No se detectaron planos elegibles",
        description: "No hay planos de primer plano o plano medio en el timeline",
        variant: "default",
      });
      return;
    }
    
    // Filtrar clips ya procesados
    const clipsToProcess = detectedClips.filter(clip => !processedClips.includes(clip.id));
    
    if (clipsToProcess.length === 0) {
      toast({
        title: "Información",
        description: "Todos los planos elegibles ya han sido procesados",
        variant: "default",
      });
      return;
    }
    
    try {
      setAutoSwapInProgress(true);
      setAutoSwapProgress(0);
      
      toast({
        title: "Procesamiento automático iniciado",
        description: `Aplicando Face Swap a ${clipsToProcess.length} planos detectados`,
        variant: "default",
      });
      
      // Procesar cada clip individualmente para mayor estabilidad
      for (let i = 0; i < clipsToProcess.length; i++) {
        const clip = clipsToProcess[i];
        setAutoSwapProgress(Math.round((i / clipsToProcess.length) * 100));
        
        // Solo procesar si el clip tiene una imagen generada
        if (!clip.imageUrl && !clip.thumbnail) {
          logger.info(`Clip ${clip.id} no tiene imagen, omitiendo`);
          continue;
        }
        
        // Usar la imagen URL o thumbnail como imagen objetivo
        const targetImageUrl = clip.imageUrl || clip.thumbnail;
        
        if (!targetImageUrl) {
          logger.info(`Clip ${clip.id} no tiene imagen válida, omitiendo`);
          continue;
        }
        
        try {
          // Usar el servicio de face swap para procesar la imagen
          // Llamar al método startFaceSwap que ya existe, creando un formato adecuado
          const results = await faceSwapService.startFaceSwap(
            sourceImage,
            videoId || 'auto-detected', 
            ['auto-process']
          );
          
          if (results.length > 0) {
            // Actualizar el clip con la nueva imagen
            if (onUpdateClip) {
              // Crear una copia del metadata existente
              const updatedMetadata: ExtendedMetadata = {
                ...(clip.metadata as ExtendedMetadata || {}),
                faceSwapApplied: true,
                faceSwapTimestamp: new Date().toISOString()
              };
              
              onUpdateClip(clip.id, {
                imageUrl: results[0].resultImageUrl,
                metadata: updatedMetadata
              });
            }
            
            // Agregar a clips procesados
            setProcessedClips(prev => [...prev, clip.id]);
          }
        } catch (error) {
          logger.error(`Error procesando clip ${clip.id}:`, error);
          // Continuamos con el siguiente clip aunque uno falle
        }
      }
      
      setAutoSwapProgress(100);
      
      toast({
        title: "Procesamiento automático completado",
        description: `Se han procesado ${processedClips.length} planos con éxito`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error en el procesamiento automático",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setAutoSwapInProgress(false);
    }
  };
  
  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <Label className="text-lg font-semibold">Personalización de Artista</Label>
          
          {detectedClips.length > 0 && (
            <Badge variant="outline" className="ml-2">
              {detectedClips.length} planos elegibles detectados
            </Badge>
          )}
        </div>
        
        {autoDetect && (
          <Alert className="bg-blue-500/10 border-blue-500/50 mb-4">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-600">Detección automática activada</AlertTitle>
            <AlertDescription className="text-sm text-blue-600">
              Los planos de primer plano y planos medios serán procesados automáticamente cuando subas una foto.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Componente de Face Swap */}
        <FaceSwap 
          videoId={videoId}
          onComplete={handleFaceSwapComplete}
          isPurchased={isPurchased}
        />
        
        {autoSwapInProgress && (
          <div className="space-y-2 mt-4">
            <Label className="text-sm">Procesando planos automáticamente...</Label>
            <Progress value={autoSwapProgress} className="w-full h-2" />
            <p className="text-xs text-muted-foreground">
              Aplicando Face Swap a los planos detectados. Esto puede tardar unos minutos.
            </p>
          </div>
        )}
        
        {artistImage && detectedClips.length > 0 && !autoSwapInProgress && processedClips.length < detectedClips.length && (
          <Button
            onClick={() => handleAutoDetectSwap(artistImage)}
            className="mt-4"
            variant="secondary"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Procesar {detectedClips.length - processedClips.length} planos detectados
          </Button>
        )}
        
        {processedClips.length > 0 && (
          <div className="mt-4 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-600" />
              <span className="text-sm font-medium">
                {processedClips.length} planos procesados con éxito
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
