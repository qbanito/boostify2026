import { useState, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { useToast } from "../../hooks/use-toast";
import { RefreshCw, Upload, Camera, Sparkles, FileAudio2, X, CheckCircle, AlertCircle, DollarSign } from "lucide-react";
import { applyPixVerseLipsync, estimateLipsyncCost, type PixVerseLipsyncResult } from "../../lib/api/pixverse-lipsync";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";

/**
 * LipsyncComponent - Real implementation using PixVerse via FAL
 * 🎤 Sincroniza labios en videos con audio real
 * 
 * Modelo: fal-ai/pixverse/lipsync
 * Costo: $0.04/segundo de video
 */
export function LipsyncComponent() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<PixVerseLipsyncResult | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const { toast } = useToast();

  // Calcular costo estimado
  const estimatedCost = videoDuration > 0 ? estimateLipsyncCost([{ duration: videoDuration }]) : null;

  const handleVideoChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast({
        title: "Tipo de archivo inválido",
        description: "Por favor, sube solo archivos de video (MP4, MOV, etc.)",
        variant: "destructive",
      });
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
    setResult(null);

    // Obtener duración del video
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      URL.revokeObjectURL(url);
    };
    video.src = url;
  }, [toast]);

  const handleAudioChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast({
        title: "Tipo de archivo inválido",
        description: "Por favor, sube solo archivos de audio (MP3, WAV, etc.)",
        variant: "destructive",
      });
      return;
    }

    setAudioFile(file);
    setAudioPreview(URL.createObjectURL(file));
    setResult(null);
  }, [toast]);

  const uploadToFirebase = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const handleLipsyncGeneration = async () => {
    if (!videoFile || !audioFile) {
      toast({
        title: "Archivos requeridos",
        description: "Necesitas subir tanto el video como el audio",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatusMessage("Preparando archivos...");
    setResult(null);

    try {
      // Paso 1: Subir video a Firebase (10%)
      setProgress(10);
      setStatusMessage("Subiendo video...");
      const timestamp = Date.now();
      const videoUrl = await uploadToFirebase(
        videoFile,
        `lipsync/videos/${timestamp}_${videoFile.name}`
      );

      // Paso 2: Subir audio a Firebase (20%)
      setProgress(20);
      setStatusMessage("Subiendo audio...");
      const audioUrl = await uploadToFirebase(
        audioFile,
        `lipsync/audio/${timestamp}_${audioFile.name}`
      );

      // Paso 3: Procesar con PixVerse (30-90%)
      setProgress(30);
      setStatusMessage("Procesando lip-sync con PixVerse...");
      
      // Simular progreso mientras esperamos
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 85));
      }, 3000);

      const lipsyncResult = await applyPixVerseLipsync({
        videoUrl,
        audioUrl,
      });

      clearInterval(progressInterval);

      // Paso 4: Completado (100%)
      setProgress(100);
      setResult(lipsyncResult);

      if (lipsyncResult.success) {
        setStatusMessage("¡Lip-sync completado!");
        toast({
          title: "¡Éxito!",
          description: `Lip-sync generado en ${Math.round((lipsyncResult.processingTime || 0) / 1000)}s`,
        });
      } else {
        setStatusMessage("Error en procesamiento");
        toast({
          title: "Error",
          description: lipsyncResult.error || "Error desconocido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Lipsync error:", error);
      setStatusMessage("Error");
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar lip-sync",
        variant: "destructive",
      });
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setVideoFile(null);
    setVideoPreview("");
    setAudioFile(null);
    setAudioPreview("");
    setResult(null);
    setVideoDuration(0);
    setProgress(0);
    setStatusMessage("");
  };

  return (
    <div className="space-y-6">
      {/* Video Input */}
      <div className="space-y-2">
        <Label htmlFor="videoFile" className="text-sm font-medium flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Video para sincronización
        </Label>
        
        <div className="aspect-video relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
          {videoPreview ? (
            <>
              <video 
                src={videoPreview} 
                controls
                className="w-full h-full object-contain"
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                onClick={() => {
                  setVideoFile(null);
                  setVideoPreview("");
                  setVideoDuration(0);
                  setResult(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="text-center p-4">
              <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Sube un video con una cara visible (close-up recomendado)</p>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Label 
            htmlFor="videoFile" 
            className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
          >
            <Upload className="h-3 w-3" />
            {videoPreview ? "Cambiar" : "Subir"} video
          </Label>
          <Input 
            id="videoFile" 
            type="file" 
            accept="video/*" 
            className="hidden" 
            onChange={handleVideoChange}
          />
        </div>
      </div>

      {/* Audio Input */}
      <div className="space-y-2">
        <Label htmlFor="audioFile" className="text-sm font-medium flex items-center gap-2">
          <FileAudio2 className="h-4 w-4" />
          Audio para sincronización
        </Label>
        
        <div className="h-24 relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
          {audioPreview ? (
            <div className="w-full p-4">
              <audio 
                src={audioPreview} 
                controls
                className="w-full"
              />
              <Button 
                variant="destructive" 
                size="icon" 
                className="absolute top-2 right-2 h-6 w-6 opacity-80 hover:opacity-100"
                onClick={() => {
                  setAudioFile(null);
                  setAudioPreview("");
                  setResult(null);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="text-center p-4">
              <FileAudio2 className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Audio que se sincronizará con los labios</p>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Label 
            htmlFor="audioFile" 
            className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
          >
            <Upload className="h-3 w-3" />
            {audioPreview ? "Cambiar" : "Subir"} audio
          </Label>
          <Input 
            id="audioFile" 
            type="file" 
            accept="audio/*" 
            className="hidden" 
            onChange={handleAudioChange}
          />
        </div>
      </div>

      {/* Cost Estimate */}
      {estimatedCost && (
        <div className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <DollarSign className="h-4 w-4 text-amber-500" />
          <span className="text-sm">
            Costo estimado: <strong>${estimatedCost.estimatedCost.toFixed(2)}</strong>
            <span className="text-muted-foreground ml-1">
              ({Math.round(estimatedCost.totalSeconds)}s × ${estimatedCost.costPerSecond}/s)
            </span>
          </span>
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{statusMessage}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-lg border ${
          result.success 
            ? 'bg-green-500/10 border-green-500/20' 
            : 'bg-red-500/10 border-red-500/20'
        }`}>
          {result.success ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">¡Lip-sync completado!</span>
              </div>
              <video 
                src={result.videoUrl} 
                controls 
                className="w-full rounded-md"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => window.open(result.videoUrl, '_blank')}
                >
                  Abrir en nueva pestaña
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = result.videoUrl!;
                    a.download = 'lipsync-video.mp4';
                    a.click();
                  }}
                >
                  Descargar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span>{result.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Generate Button */}
      <div className="flex gap-2 justify-center mt-6">
        {(videoFile || audioFile || result) && (
          <Button variant="outline" onClick={clearAll} disabled={isProcessing}>
            <X className="mr-2 h-4 w-4" />
            Limpiar
          </Button>
        )}
        <Button 
          onClick={handleLipsyncGeneration} 
          disabled={!videoFile || !audioFile || isProcessing}
          className="min-w-[180px]"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar Lip-sync
            </>
          )}
        </Button>
      </div>

      {/* Info Footer */}
      <div className="text-center text-xs text-muted-foreground mt-4 border-t pt-4 border-dashed space-y-1">
        <p>🎤 <strong>Modelo:</strong> PixVerse Lipsync (fal-ai)</p>
        <p>💡 Mejor resultado con videos close-up donde la cara sea claramente visible</p>
      </div>
    </div>
  );
}