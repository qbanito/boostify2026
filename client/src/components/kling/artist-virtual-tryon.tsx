import { useState, useRef, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { 
  AlertCircle, 
  CheckCircle, 
  Loader2, 
  Upload, 
  Sparkles, 
  ShirtIcon, 
  RefreshCw,
  Download,
  Save,
  X
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { motion } from 'framer-motion';
import { useToast } from '../../hooks/use-toast';
import { klingService, TryOnResult } from '../../services/kling/kling-service';

export function ArtistVirtualTryOn() {
  const [modelImage, setModelImage] = useState<string>("");
  const [clothingImage, setClothingImage] = useState<string>("");
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const modelInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setImageState: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous results
    setResult(null);
    setTaskId(null);
    setProgress(0);
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }

    // Validate file is an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Tipo de archivo inválido",
        description: "Por favor, sube solo archivos de imagen (JPEG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Read and convert to data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageState(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStartTryOn = async () => {
    if (!modelImage || !clothingImage) {
      toast({
        title: "Imágenes faltantes",
        description: "Por favor, sube una imagen de modelo y de ropa para continuar",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      setProgress(0);

      // Clean up existing polling
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }

      const startResult = await klingService.startTryOn(modelImage, clothingImage);
      
      if (!startResult.success) {
        throw new Error(startResult.errorMessage || "Error al iniciar el proceso de prueba virtual");
      }

      setTaskId(startResult.taskId || null);
      setProgress(10); // Initial progress

      // Start polling for status updates
      if (startResult.taskId) {
        const intervalId = setInterval(async () => {
          try {
            const statusResult = await klingService.checkTryOnStatus(startResult.taskId!);
            
            // Update progress based on status
            if (statusResult.status === "pending") {
              setProgress((prev) => Math.min(prev + 5, 40));
            } else if (statusResult.status === "processing") {
              setProgress((prev) => Math.min(prev + 10, 80));
            }

            // When process is completed or failed, stop polling
            if (statusResult.status === "completed" || statusResult.status === "failed") {
              clearInterval(intervalId);
              setPollInterval(null);
              setLoading(false);
              setProgress(statusResult.status === "completed" ? 100 : 0);

              if (statusResult.status === "completed") {
                setResult(statusResult);
                toast({
                  title: "¡Éxito!",
                  description: "Prueba virtual completada con éxito",
                });
              } else {
                toast({
                  title: "Proceso fallido",
                  description: statusResult.errorMessage || "Error al generar el resultado de la prueba virtual",
                  variant: "destructive",
                });
              }
            }
          } catch (error) {
            logger.error("Error in polling interval:", error);
          }
        }, 2000); // Check every 2 seconds

        setPollInterval(intervalId);
      }
    } catch (error: any) {
      setLoading(false);
      setProgress(0);
      
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al iniciar el proceso",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setModelImage("");
    setClothingImage("");
    setResult(null);
    setTaskId(null);
    setProgress(0);
    
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    
    setLoading(false);

    if (modelInputRef.current) modelInputRef.current.value = '';
    if (clothingInputRef.current) clothingInputRef.current.value = '';
  };

  // Save a successful result - saves to localStorage
  const handleSaveResult = async () => {
    if (!result || !result.resultImage) {
      toast({
        title: "No hay resultado para guardar",
        description: "No hay un resultado completado para guardar",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save to localStorage
      const savedResults = JSON.parse(localStorage.getItem('tryonResults') || '[]');
      savedResults.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        resultImage: result.resultImage,
        modelImage,
        clothingImage
      });
      localStorage.setItem('tryonResults', JSON.stringify(savedResults));
      
      toast({
        title: "Guardado con éxito",
        description: "El resultado se ha guardado en tu historial local",
      });
    } catch (error: any) {
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudo guardar el resultado. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  // Download a try-on result image
  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `virtual-tryon-${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Tabs defaultValue="model" className="mb-6">
          <TabsList className="mb-4">
            <TabsTrigger value="model" className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> 
              Modelo
            </TabsTrigger>
            <TabsTrigger value="clothing" className="flex items-center gap-2">
              <ShirtIcon className="h-4 w-4" /> 
              Ropa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="model">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Sube tu imagen de modelo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="aspect-square relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
                    {modelImage ? (
                      <>
                        <img 
                          src={modelImage} 
                          alt="Modelo" 
                          className="w-full h-full object-cover"
                        />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                          onClick={() => setModelImage("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Da clic para subir una imagen de persona</p>
                      </div>
                    )}
                  </div>
                  
                  <Input 
                    ref={modelInputRef} 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setModelImage)} 
                    className="cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clothing">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">Sube tu imagen de ropa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="aspect-square relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
                    {clothingImage ? (
                      <>
                        <img 
                          src={clothingImage} 
                          alt="Ropa" 
                          className="w-full h-full object-cover"
                        />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-2 right-2 h-8 w-8 opacity-80 hover:opacity-100"
                          onClick={() => setClothingImage("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className="text-center p-4">
                        <ShirtIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Da clic para subir una imagen de ropa</p>
                      </div>
                    )}
                  </div>
                  
                  <Input 
                    ref={clothingInputRef} 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setClothingImage)} 
                    className="cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-3 mb-6 justify-center">
          <Button 
            onClick={handleStartTryOn} 
            disabled={!modelImage || !clothingImage || loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generar prueba virtual
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleReset}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reiniciar
          </Button>

          {result?.resultImage && (
            <>
              <Button 
                variant="secondary" 
                onClick={handleSaveResult}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Guardar resultado
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => handleDownloadImage(result.resultImage!)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </>
          )}
        </div>

        {/* Progress Indicator */}
        {loading && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Procesando...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-2">
              Este proceso suele tardar entre 10 y 20 segundos
            </p>
          </div>
        )}

        {/* Result Display */}
        {result?.resultImage && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Resultado generado
            </h3>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <img 
                  src={result.resultImage} 
                  alt="Resultado de prueba virtual" 
                  className="w-full max-h-[500px] object-contain"
                />
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Error Alert */}
        {result?.status === "failed" && result.errorMessage && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Proceso fallido</AlertTitle>
            <AlertDescription>
              {result.errorMessage}
            </AlertDescription>
          </Alert>
        )}
      </motion.div>
    </div>
  );
}
