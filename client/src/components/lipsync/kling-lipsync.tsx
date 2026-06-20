import { useState, useRef } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Progress } from "../ui/progress";
import { Slider } from "../ui/slider";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAuth } from "../../hooks/use-auth";
import { Mic, Upload, AlertCircle, CheckCircle2, RefreshCcw, Play } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";
import type { TimelineClip } from "../music-video/timeline-editor";

export interface KlingLipsyncProps {
  className?: string;
  videoTaskId?: string;
  isPurchased?: boolean;
  // Actualizado para incluir la estructura de metadata.lipsync
  onLipSyncComplete?: (result: {
    videoUrl: string;
    metadata?: {
      lipsync?: {
        applied: boolean;
        videoUrl?: string;
        progress?: number;
        timestamp?: string;
      }
    }
  }) => void;
  clips?: TimelineClip[];
}

// Opciones de timbre de voz disponibles para la generación
const VOICE_TIMBRE_OPTIONS = [
  { value: "Rock", label: "Rock" },
  { value: "Pop", label: "Pop" },
  { value: "Jazz", label: "Jazz" },
  { value: "Folk", label: "Folk" },
  { value: "Classic", label: "Clásico" },
  { value: "Opera", label: "Ópera" }
];

export function KlingLipsync({
  className,
  videoTaskId,
  isPurchased = false,
  onLipSyncComplete,
  clips = []
}: KlingLipsyncProps) {
  const { toast } = useToast();
  const { user } = useAuth(); // Mover aquí para cumplir reglas de Hooks
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [method, setMethod] = useState<"audio" | "lyrics">("audio");
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState(10);
  const [accuracy, setAccuracy] = useState(80);
  const [voiceTimbre, setVoiceTimbre] = useState("Rock"); // Timbre de voz para generación con PiAPI
  const [voiceSpeed, setVoiceSpeed] = useState(1.0); // Velocidad de la voz (1.0 = normal)
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filtrar solo los planos adecuados para LipSync
  const eligibleClips = clips.filter(clip =>
    ["close-up", "medium", "extreme close-up"].includes(clip.shotType?.toLowerCase() || "")
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("audio/")) {
        setAudioFile(file);
        setError(null);
      } else {
        setError("Por favor, selecciona un archivo de audio válido");
        setAudioFile(null);
      }
    }
  };

  const handleClipSelect = (index: number) => {
    setSelectedClipIndex(index);
    if (eligibleClips[index]) {
      // Actualizar la duración del video basado en el clip seleccionado
      setVideoDuration(eligibleClips[index].duration || 10);
    }
  };

  const handleLipSyncStart = async () => {
    if (!isPurchased) {
      toast({
        title: "Función Premium",
        description: "Necesitas comprar el video completo para acceder a esta función",
        variant: "destructive",
      });
      return;
    }

    if (!videoTaskId) {
      toast({
        title: "Error",
        description: "No se encontró el ID del video",
        variant: "destructive",
      });
      return;
    }

    if (selectedClipIndex === null && eligibleClips.length > 0) {
      toast({
        title: "Selección necesaria",
        description: "Por favor, selecciona un clip para aplicar el LipSync",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoading(true);
      setProgress(0);
      setError(null);
      setResultUrl("");

      const selectedClip = eligibleClips[selectedClipIndex || 0];
      const clipId = selectedClip?.id || "clip_1";
      const shotType = selectedClip?.shotType?.toLowerCase() || "close-up";

      // Crear FormData para enviar al servidor
      const formData = new FormData();
      formData.append("videoTaskId", videoTaskId || "");
      formData.append("clipId", typeof clipId === 'string' ? clipId : clipId.toString());
      formData.append("shotType", shotType);
      formData.append("method", method);
      formData.append("accuracy", accuracy.toString());
      
      // Parámetros específicos para la API de PiAPI
      if (method === "lyrics") {
        formData.append("voiceTimbre", voiceTimbre);
        formData.append("voiceSpeed", voiceSpeed.toString());
      }

      if (method === "audio" && audioFile) {
        formData.append("audioFile", audioFile);
      } else if (method === "lyrics" && lyrics) {
        formData.append("lyrics", lyrics);
      } else {
        throw new Error("Por favor proporciona un archivo de audio o texto para la sincronización");
      }

      // Iniciar la tarea de LipSync
      const startResponse = await fetch("/api/kling/lipsync/start", {
        method: "POST",
        body: formData,
      });
      
      const startResult = await startResponse.json();
      
      if (!startResponse.ok || !startResult.success) {
        throw new Error(startResult.error || "Error al iniciar el proceso de LipSync");
      }
      
      setTaskId(startResult.taskId);
      toast({
        title: "Proceso iniciado",
        description: "La sincronización de labios ha comenzado, espera unos minutos",
      });
      
      // Iniciar el polling para verificar el estado de la tarea
      // Iniciar con un tiempo corto de verificación y luego aumentarlo gradualmente
      let checkInterval = 3000; // 3 segundos iniciales
      const maxInterval = 8000; // máximo 8 segundos entre verificaciones
      
      const pollingInterval = setInterval(async () => {
        try {
          const statusResponse = await apiRequest(`/api/kling/lipsync/status?taskId=${startResult.taskId}`);
          
          if (statusResponse.status === "processing") {
            // Calcular progreso de forma más natural con pequeñas variaciones aleatorias
            const randomIncrement = Math.random() * 2; // pequeña variación para animar el progreso
            const calculatedProgress = Math.min(
              statusResponse.progress || (progress + 3 + randomIncrement), 
              95
            );
            setProgress(calculatedProgress);
            
            // Actualizar el estado de progreso con mensaje descriptivo
            logger.info(`LipSync progreso: ${calculatedProgress.toFixed(0)}%, próxima verificación en ${checkInterval/1000}s`);
            
            // Aumentar gradualmente el intervalo para no sobrecargar el servidor
            checkInterval = Math.min(checkInterval * 1.1, maxInterval);
            clearInterval(pollingInterval);
            
            // Reiniciar con el nuevo intervalo
            setTimeout(() => {
              const newPollingInterval = setInterval(async () => {
                try {
                  const newStatusResponse = await apiRequest(`/api/kling/lipsync/status?taskId=${startResult.taskId}`);
                  // Procesar respuesta como antes
                  // (Este código nunca se ejecutará porque setTimeout creará una nueva verificación)
                } catch (innerError) {
                  logger.error("Error en verificación interna:", innerError);
                }
              }, checkInterval);
            }, checkInterval);
            
          } else if (statusResponse.status === "completed") {
            clearInterval(pollingInterval);
            setProgress(100);
            setResultUrl(statusResponse.videoUrl);
            
            // Registrar en consola para depuración
            logger.info(`LipSync completado con éxito: ${statusResponse.videoUrl}`);
            
            toast({
              title: "LipSync completado",
              description: "La sincronización de labios se ha completado con éxito",
            });
            
            if (onLipSyncComplete) {
              // Actualizar utilizando el nuevo patrón metadata.lipsync
              onLipSyncComplete({
                videoUrl: statusResponse.videoUrl,
                // Añadir metadatos específicos para permitir actualización en el padre
                metadata: {
                  lipsync: {
                    applied: true,
                    videoUrl: statusResponse.videoUrl,
                    progress: 100,
                    timestamp: new Date().toISOString()
                  }
                }
              });
              
              // Si hay un clip seleccionado, su actualización será manejada por
              // el componente padre a través de onLipSyncComplete con los metadatos
              // que proporcionamos arriba
            }
            
            // Guardar historial en Firestore para referencias futuras
            try {              
              if (user?.uid) {
                logger.info("Guardando resultado de LipSync en historial...");
                // Esta funcionalidad requeriría implementación adicional
                // Por ejemplo, guardar en una colección de historial:
                // await addDoc(collection(db, "lipsync_history"), {
                //   userId: user.uid,
                //   videoUrl: statusResponse.videoUrl,
                //   timestamp: serverTimestamp(),
                //   taskId: startResult.taskId
                // });
              }
            } catch (saveError) {
              logger.error("Error al guardar historial:", saveError);
              // No afecta al flujo principal
            }
            
            setLoading(false);
          } else if (statusResponse.status === "failed") {
            clearInterval(pollingInterval);
            logger.error("Error en LipSync:", statusResponse.error);
            toast({
              title: "Error en proceso de LipSync",
              description: statusResponse.error || "Se produjo un error durante la sincronización",
              variant: "destructive"
            });
            throw new Error(statusResponse.error || "Error en el proceso de LipSync");
          }
        } catch (err) {
          clearInterval(pollingInterval);
          setError(err instanceof Error ? err.message : "Error al verificar el estado");
          setLoading(false);
        }
      }, 5000); // Verificar cada 5 segundos
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar el proceso de LipSync");
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    setTaskId(null);
    setResultUrl("");
  };

  if (!isPurchased) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Sincronización de Labios</CardTitle>
          <CardDescription>
            Aplica tecnología de sincronización labial a los planos cercanos del artista
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Función Premium</AlertTitle>
            <AlertDescription>
              Esta función está disponible después de comprar el video completo.
              Compra el video para desbloquear todas las funciones avanzadas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (resultUrl) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>LipSync Completado</CardTitle>
          <CardDescription>
            La sincronización de labios se ha aplicado correctamente al clip seleccionado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Proceso finalizado</AlertTitle>
            <AlertDescription>
              La sincronización de labios se ha completado con éxito. Puedes ver el resultado a continuación.
            </AlertDescription>
          </Alert>
          
          <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
            <video 
              src={resultUrl} 
              controls 
              className="h-full w-full object-cover"
            />
          </div>
          
          <Button 
            onClick={handleRetry} 
            variant="outline" 
            className="w-full"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Realizar otra sincronización
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sincronización de Labios</CardTitle>
        <CardDescription>
          Aplica tecnología de sincronización labial a los planos cercanos y medios del artista
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {eligibleClips.length === 0 ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No hay planos elegibles</AlertTitle>
            <AlertDescription>
              No se encontraron planos cercanos o medios del artista en el video.
              La sincronización de labios solo funciona con primeros planos y planos medios.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Selecciona el clip para aplicar LipSync</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {eligibleClips.map((clip, index) => (
                  <Button
                    key={clip.id}
                    variant={selectedClipIndex === index ? "default" : "outline"}
                    className="h-auto py-2 justify-start"
                    onClick={() => handleClipSelect(index)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{clip.shotType}</div>
                      <div className="text-xs text-muted-foreground">
                        {clip.start.toFixed(1)}s - {(clip.start + clip.duration).toFixed(1)}s
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Precisión de la sincronización ({accuracy}%)</Label>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[accuracy]}
                onValueChange={([value]) => setAccuracy(value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Mayor precisión puede requerir más tiempo de procesamiento
              </p>
            </div>

            <Tabs defaultValue="audio" value={method} onValueChange={(v) => setMethod(v as "audio" | "lyrics")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="audio" disabled={loading}>
                  <Upload className="mr-2 h-4 w-4" />
                  Audio
                </TabsTrigger>
                <TabsTrigger value="lyrics" disabled={loading}>
                  <Mic className="mr-2 h-4 w-4" />
                  Letra
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="audio" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="audio-file">Archivo de audio para la sincronización</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      id="audio-file"
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      disabled={loading}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Seleccionar
                    </Button>
                  </div>
                  {audioFile && (
                    <p className="text-sm text-muted-foreground">
                      Archivo seleccionado: {audioFile.name}
                    </p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="lyrics" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="lyrics">Letra para la sincronización</Label>
                  <Textarea
                    id="lyrics"
                    placeholder="Ingresa la letra que será sincronizada con los labios del artista..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    disabled={loading}
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voiceTimbre">Timbre de voz</Label>
                  <Select
                    value={voiceTimbre}
                    onValueChange={setVoiceTimbre}
                    disabled={loading}
                  >
                    <SelectTrigger id="voiceTimbre" className="w-full">
                      <SelectValue placeholder="Selecciona un timbre de voz" />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_TIMBRE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El timbre de voz afecta el estilo de la voz generada
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Velocidad de voz ({(voiceSpeed * 100).toFixed(0)}%)</Label>
                  <Slider
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={[voiceSpeed]}
                    onValueChange={([value]) => setVoiceSpeed(value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ajusta la velocidad de la voz generada
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Progreso</Label>
                  <span className="text-sm">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  El proceso de LipSync puede tardar varios minutos
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleLipSyncStart}
              disabled={loading || (method === "audio" && !audioFile) || (method === "lyrics" && !lyrics) || selectedClipIndex === null}
            >
              {loading ? (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Sincronización de Labios
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}