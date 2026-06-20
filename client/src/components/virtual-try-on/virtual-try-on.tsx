import React, { useState, useRef } from 'react';
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { useToast } from "../../hooks/use-toast";
import { Loader2, Upload, Image as ImageIcon, Camera, Shirt } from 'lucide-react';
import axios from 'axios';

export type TryOnImage = {
  url: string;
};

interface VirtualTryOnProps {
  className?: string;
}

export function VirtualTryOn({ className }: VirtualTryOnProps) {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [clothingImage, setClothingImage] = useState<string | null>(null);
  const [clothingType, setClothingType] = useState<'dress' | 'upper' | 'lower'>('dress');
  const [resultImages, setResultImages] = useState<TryOnImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("upload");
  const { toast } = useToast();

  const modelInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para manejar la subida de imágenes
  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
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
      setImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Función para manejar la entrada de URL externa
  const handleUrlInput = (url: string, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
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
    
    setter(url);
  };

  // Función para iniciar el proceso de Try-On
  const startTryOn = async () => {
    if (!modelImage) {
      toast({
        title: "Imagen del modelo requerida",
        description: "Por favor, sube una imagen de una persona",
        variant: "destructive",
      });
      return;
    }

    if (!clothingImage) {
      toast({
        title: "Imagen de ropa requerida",
        description: "Por favor, sube una imagen de una prenda de vestir",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Preparar los datos según el tipo de ropa seleccionado
      const requestData: any = {
        model_input: modelImage,
        batch_size: 1
      };

      // Asignar la imagen de ropa al campo correcto según el tipo seleccionado
      if (clothingType === 'dress') {
        requestData.dress_input = clothingImage;
      } else if (clothingType === 'upper') {
        requestData.upper_input = clothingImage;
      } else if (clothingType === 'lower') {
        requestData.lower_input = clothingImage;
      }

      // Enviar la solicitud al servidor
      const response = await axios.post('/proxy/kling/try-on/start', requestData);

      if (response.data.success && response.data.taskId) {
        setTaskId(response.data.taskId);
        
        // Iniciar polling para verificar el estado
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(checkTryOnStatus, 3000);
        toast({
          title: "Procesando",
          description: "Hemos comenzado a procesar tu solicitud de Virtual Try-On",
        });
      } else {
        throw new Error(response.data.error || "Error al iniciar el Try-On");
      }
    } catch (error: any) {
      logger.error("Error al iniciar Virtual Try-On:", error);
      toast({
        title: "Error",
        description: error.message || "Ocurrió un error al iniciar el proceso",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  // Función para verificar el estado del proceso
  const checkTryOnStatus = async () => {
    if (!taskId) return;

    try {
      const response = await axios.get(`/proxy/kling/try-on/status?taskId=${taskId}`);
      
      if (response.data.status === 'completed' && response.data.success) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        setResultImages(response.data.images || []);
        setIsProcessing(false);
        setProgress(100);
        
        toast({
          title: "¡Completado!",
          description: "El proceso de Virtual Try-On ha finalizado con éxito",
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
    setModelImage(null);
    setClothingImage(null);
    setResultImages([]);
    setTaskId(null);
    setProgress(0);
    setActiveTab("upload");
    
    // Limpiar los inputs
    if (modelInputRef.current) modelInputRef.current.value = "";
    if (clothingInputRef.current) clothingInputRef.current.value = "";
  };

  return (
    <div className={`container mx-auto py-6 ${className}`}>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Virtual Try-On</CardTitle>
          <CardDescription>
            Prueba virtualmente prendas de vestir en modelos usando IA
          </CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Subir Imágenes</TabsTrigger>
              <TabsTrigger value="result" disabled={resultImages.length === 0}>
                Resultados
              </TabsTrigger>
            </TabsList>
          </div>
          
          <CardContent className="py-4">
            <TabsContent value="upload">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sección de imagen del modelo */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="modelImage">Imagen del Modelo</Label>
                    <div className="mt-2">
                      <Input
                        id="modelImage"
                        type="file"
                        ref={modelInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setModelImage)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="modelUrl">O usar URL de una imagen de modelo</Label>
                    <div className="mt-2 flex space-x-2">
                      <Input
                        id="modelUrl"
                        type="text"
                        placeholder="https://ejemplo.com/modelo.jpg"
                        onBlur={(e) => handleUrlInput(e.target.value, setModelImage)}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          const urlInput = document.getElementById('modelUrl') as HTMLInputElement;
                          handleUrlInput(urlInput.value, setModelImage);
                        }}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Cargar
                      </Button>
                    </div>
                  </div>
                  
                  {modelImage && (
                    <div className="rounded-md overflow-hidden border aspect-auto p-2">
                      <img
                        src={modelImage}
                        alt="Imagen del modelo"
                        className="max-h-[300px] mx-auto object-contain"
                      />
                    </div>
                  )}
                </div>
                
                {/* Sección de imagen de ropa */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="clothingType">Tipo de Prenda</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Button
                        type="button"
                        variant={clothingType === 'dress' ? 'default' : 'outline'}
                        onClick={() => setClothingType('dress')}
                      >
                        Vestido Completo
                      </Button>
                      <Button
                        type="button"
                        variant={clothingType === 'upper' ? 'default' : 'outline'}
                        onClick={() => setClothingType('upper')}
                      >
                        Parte Superior
                      </Button>
                      <Button
                        type="button"
                        variant={clothingType === 'lower' ? 'default' : 'outline'}
                        onClick={() => setClothingType('lower')}
                      >
                        Parte Inferior
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="clothingImage">Imagen de la Prenda</Label>
                    <div className="mt-2">
                      <Input
                        id="clothingImage"
                        type="file"
                        ref={clothingInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setClothingImage)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="clothingUrl">O usar URL de una imagen de prenda</Label>
                    <div className="mt-2 flex space-x-2">
                      <Input
                        id="clothingUrl"
                        type="text"
                        placeholder="https://ejemplo.com/prenda.jpg"
                        onBlur={(e) => handleUrlInput(e.target.value, setClothingImage)}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          const urlInput = document.getElementById('clothingUrl') as HTMLInputElement;
                          handleUrlInput(urlInput.value, setClothingImage);
                        }}
                      >
                        <Shirt className="h-4 w-4 mr-2" />
                        Cargar
                      </Button>
                    </div>
                  </div>
                  
                  {clothingImage && (
                    <div className="rounded-md overflow-hidden border aspect-auto p-2">
                      <img
                        src={clothingImage}
                        alt="Imagen de la prenda"
                        className="max-h-[300px] mx-auto object-contain"
                      />
                    </div>
                  )}
                  
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-md mt-4">
                    <h3 className="font-medium text-sm mb-2">Recomendaciones</h3>
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                      <li>Para mejores resultados, usa imágenes claras del modelo en posición frontal</li>
                      <li>La prenda debe ser visible en toda su extensión</li>
                      <li>Para prendas superiores, es preferible que la prenda esté en posición frontal</li>
                      <li>El procesamiento puede tardar hasta 1 minuto</li>
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
                <h3 className="text-lg font-medium">Resultados del Virtual Try-On</h3>
                
                {resultImages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {resultImages.map((image, index) => (
                      <div key={index} className="border rounded-md overflow-hidden">
                        <img
                          src={image.url}
                          alt={`Resultado ${index + 1}`}
                          className="w-full h-auto object-cover aspect-square"
                        />
                        <div className="p-2">
                          <a
                            href={image.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Ver imagen completa
                          </a>
                        </div>
                      </div>
                    ))}
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
              onClick={startTryOn}
              disabled={isProcessing || !modelImage || !clothingImage}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando
                </>
              ) : (
                <>
                  <Shirt className="mr-2 h-4 w-4" />
                  Probar Virtualmente
                </>
              )}
            </Button>
          </CardFooter>
        </Tabs>
      </Card>
    </div>
  );
}

export default VirtualTryOn;