import React, { useState, useRef } from 'react';
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { useToast } from "../../hooks/use-toast";
import { Loader2, Upload, Image as ImageIcon, PlayCircle, Wand2 } from 'lucide-react';
import axios from 'axios';
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

interface KlingEffectsProps {
  className?: string;
}

export function KlingEffects({ className }: KlingEffectsProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [effect, setEffect] = useState<'squish' | 'expansion'>('squish');
  const [resultVideo, setResultVideo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para manejar la subida de imágenes
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Tipo de archivo inválido",
        description: "Por favor, sube solo archivos de imagen (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Leer el archivo como base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageUrl(result);
    };
    reader.readAsDataURL(file);
  };

  // Función para manejar la entrada de URL externa
  const handleUrlInput = (url: string) => {
    if (!url) return;
    
    // Validación simple de URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast({
        title: "URL inválida",
        description: "Por favor, introduce una URL válida que comience con http:// o https://",
        variant: "destructive",
      });
      return;
    }
    
    setImageUrl(url);
  };

  // Función para iniciar el proceso de Kling Effects
  const startEffects = async () => {
    if (!imageUrl) {
      toast({
        title: "Imagen requerida",
        description: "Por favor, sube o proporciona la URL de una imagen",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Enviar la solicitud al servidor
      const response = await axios.post('/proxy/kling/effects/start', {
        image_url: imageUrl,
        effect: effect
      });

      if (response.data.success && response.data.taskId) {
        setTaskId(response.data.taskId);
        
        // Iniciar polling para verificar el estado
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(checkEffectsStatus, 3000);
        toast({
          title: "Procesando",
          description: "Hemos comenzado a aplicar el efecto a tu imagen",
        });
      } else {
        throw new Error(response.data.error || "Error al iniciar el proceso de efectos");
      }
    } catch (error: any) {
      logger.error("Error al iniciar Kling Effects:", error);
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al iniciar el proceso",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  // Función para verificar el estado del proceso
  const checkEffectsStatus = async () => {
    if (!taskId) return;

    try {
      const response = await axios.get(`/proxy/kling/effects/status?taskId=${taskId}`);
      
      if (response.data.status === 'completed' && response.data.success) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setResultVideo(response.data.videoUrl);
        setIsProcessing(false);
        setProgress(100);
        
        toast({
          title: "¡Completado!",
          description: "El efecto se ha aplicado correctamente a tu imagen",
        });
        
        // Cambiar a la pestaña de resultados
        setActiveTab("result");
      } else if (response.data.status === 'failed') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setIsProcessing(false);
        
        toast({
          title: "Error",
          description: response.data.errorMessage || "El proceso falló",
          variant: "destructive",
        });
      } else if (response.data.status === 'processing') {
        // Actualizar el progreso
        setProgress(response.data.progress || 50);
      }
    } catch (error: any) {
      logger.error("Error al verificar estado:", error);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      setIsProcessing(false);
      
      toast({
        title: "Error",
        description: "Ocurrió un error al verificar el estado del proceso",
        variant: "destructive",
      });
    }
  };

  // Limpiar el intervalo al desmontar el componente
  React.useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const resetForm = () => {
    setImageUrl(null);
    setResultVideo(null);
    setTaskId(null);
    setProgress(0);
    setActiveTab("upload");
    
    // Limpiar el input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={`container mx-auto py-6 ${className}`}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Kling Effects</CardTitle>
          <CardDescription>
            Aplica efectos especiales a tus imágenes para convertirlas en videos animados
          </CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Subir Imagen</TabsTrigger>
              <TabsTrigger value="result" disabled={!resultVideo}>
                Resultado
              </TabsTrigger>
            </TabsList>
          </div>
          
          <CardContent className="py-4">
            <TabsContent value="upload">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección de carga de imagen */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="imageUpload">Subir Imagen</Label>
                    <div className="mt-2">
                      <Input
                        id="imageUpload"
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="imageUrl">O usar URL de una imagen</Label>
                    <div className="mt-2 flex space-x-2">
                      <Input
                        id="imageUrl"
                        type="text"
                        placeholder="https://ejemplo.com/imagen.jpg"
                        onBlur={(e) => handleUrlInput(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={() => {
                        const urlInput = document.getElementById('imageUrl') as HTMLInputElement;
                        handleUrlInput(urlInput.value);
                      }}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Cargar
                      </Button>
                    </div>
                  </div>
                  
                  {imageUrl && (
                    <div className="rounded-md overflow-hidden border aspect-auto p-2">
                      <img
                        src={imageUrl}
                        alt="Imagen para aplicar efecto"
                        className="max-h-[300px] mx-auto object-contain"
                      />
                    </div>
                  )}
                </div>
                
                {/* Sección de selección de efecto */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="effectType">Selecciona un Efecto</Label>
                    <div className="mt-2">
                      <RadioGroup
                        value={effect}
                        onValueChange={(value) => setEffect(value as 'squish' | 'expansion')}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-accent">
                          <RadioGroupItem value="squish" id="squish" />
                          <Label htmlFor="squish" className="flex-1 cursor-pointer">
                            <div className="font-medium">Squish</div>
                            <div className="text-sm text-muted-foreground">
                              Efecto de compresión y expansión que da la apariencia de elasticidad a la imagen.
                            </div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 border rounded-md hover:bg-accent">
                          <RadioGroupItem value="expansion" id="expansion" />
                          <Label htmlFor="expansion" className="flex-1 cursor-pointer">
                            <div className="font-medium">Expansion</div>
                            <div className="text-sm text-muted-foreground">
                              Efecto que crea una sensación de expansión desde el centro de la imagen.
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-md mt-4">
                    <h3 className="font-medium text-sm mb-2">Información del Efecto</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Kling Effects convierte imágenes estáticas en videos con efectos especiales mediante IA.
                    </p>
                    <p className="text-xs font-medium">Recomendaciones:</p>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1 mt-1">
                      <li>Usa imágenes con buena calidad y resolución</li>
                      <li>Elige imágenes con sujetos bien definidos</li>
                      <li>El procesamiento puede tardar hasta 30 segundos</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {isProcessing && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Procesando...</span>
                    <span className="text-sm font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="result">
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Resultado del Efecto</h3>
                
                {resultVideo ? (
                  <div className="space-y-4">
                    <div className="border rounded-md overflow-hidden">
                      <video 
                        src={resultVideo}
                        controls
                        autoPlay
                        loop
                        className="w-full h-auto max-h-[500px]"
                      />
                    </div>
                    <div className="flex justify-between">
                      <a
                        href={resultVideo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm flex items-center"
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Ver video en una nueva pestaña
                      </a>
                      <a
                        href={resultVideo}
                        download="kling-effect-video.mp4"
                        className="text-blue-600 hover:underline text-sm flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Descargar video
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No hay resultados disponibles</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={resetForm}>
              Reiniciar
            </Button>
            
            <Button
              onClick={startEffects}
              disabled={isProcessing || !imageUrl}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Aplicar Efecto
                </>
              )}
            </Button>
          </CardFooter>
        </Tabs>
      </Card>
    </div>
  );
}

export default KlingEffects;