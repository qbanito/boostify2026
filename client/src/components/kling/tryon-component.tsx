import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { useToast } from "../../hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  Camera, 
  Upload, 
  Sparkles, 
  RefreshCw, 
  Save, 
  Download, 
  AlertCircle,
  Check,
  X
} from "lucide-react";
import { klingService, TryOnResult } from "../../services/kling/kling-service";

/**
 * VirtualTryOnComponent
 * A component that allows users to upload model and clothing images and see a virtual try-on result
 */
export function VirtualTryOnComponent() {
  const [modelImage, setModelImage] = useState<string>("");
  const [clothingImage, setClothingImage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [savedResults, setSavedResults] = useState<TryOnResult[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const { toast } = useToast();

  // Load saved results on mount
  useEffect(() => {
    loadSavedResults();
  }, []);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // Fetch saved results from localStorage
  const loadSavedResults = async () => {
    try {
      const results = JSON.parse(localStorage.getItem('tryonResults') || '[]');
      setSavedResults(results);
    } catch (error) {
      logger.error("Error loading saved results:", error);
    }
  };

  // Handle file upload for model or clothing
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    setImage: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = event.target.files?.[0];
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
    if (!file.type.startsWith("image/")) {
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
        setImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Start the try-on process
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
      setIsLoading(true);
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
              setIsLoading(false);
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
      setIsLoading(false);
      setProgress(0);
      
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error al iniciar el proceso",
        variant: "destructive",
      });
    }
  };

  // Reset all inputs and results
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
    
    setIsLoading(false);
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
        id: Date.now().toString(),
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
      
      // Refresh the saved results list
      loadSavedResults();
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
    <div className="space-y-6">
      <Tabs defaultValue="create" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="create">Crear prueba virtual</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Model Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="modelImage" className="text-sm font-medium">
                Imagen del modelo
              </Label>
              
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
                    <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Sube la imagen del modelo</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <Label 
                  htmlFor="modelImage" 
                  className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
                >
                  <Upload className="h-3 w-3" />
                  {modelImage ? "Cambiar" : "Subir"} modelo
                </Label>
                <Input 
                  id="modelImage" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileChange(e, setModelImage)}
                />
              </div>
            </div>

            {/* Clothing Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="clothingImage" className="text-sm font-medium">
                Imagen de la prenda
              </Label>
              
              <div className="aspect-square relative bg-muted/40 rounded-md overflow-hidden border border-input flex items-center justify-center">
                {clothingImage ? (
                  <>
                    <img 
                      src={clothingImage} 
                      alt="Prenda" 
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
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Sube la imagen de la prenda</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center">
                <Label 
                  htmlFor="clothingImage" 
                  className="cursor-pointer inline-flex items-center justify-center gap-1 text-sm text-primary py-1 px-2 rounded hover:bg-primary/10"
                >
                  <Upload className="h-3 w-3" />
                  {clothingImage ? "Cambiar" : "Subir"} prenda
                </Label>
                <Input 
                  id="clothingImage" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => handleFileChange(e, setClothingImage)}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-6 justify-center">
            <Button 
              onClick={handleStartTryOn} 
              disabled={!modelImage || !clothingImage || isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
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
          {isLoading && (
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
                <Check className="h-5 w-5 text-green-500" />
                Resultado generado
              </h3>
              <div className="bg-muted/30 p-1 rounded-md border border-input">
                <img 
                  src={result.resultImage} 
                  alt="Resultado de prueba virtual" 
                  className="rounded-md w-full max-h-[500px] object-contain mx-auto"
                />
              </div>
            </div>
          )}
          
          {/* Error Alert */}
          {result?.status === "failed" && result.errorMessage && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle className="flex items-center gap-2">
                <X className="h-4 w-4" />
                Proceso fallido
              </AlertTitle>
              <AlertDescription>
                {result.errorMessage}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <h2 className="text-lg font-semibold mb-4">
            {savedResults.length === 0 ? "No hay resultados guardados" : "Resultados guardados"}
          </h2>
          
          {savedResults.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-4 opacity-20" />
              <p>No hay resultados guardados aún.</p>
              <p className="text-sm">Crea una prueba virtual y guárdala para verla aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedResults.map((item: any, index: number) => (
                <Card key={item.id || index} className="overflow-hidden border-primary/20">
                  <CardContent className="p-0">
                    {item.resultImage && (
                      <div className="relative">
                        <img 
                          src={item.resultImage} 
                          alt="Resultado guardado" 
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex justify-between items-center">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => handleDownloadImage(item.resultImage!)}
                            className="h-8 w-8 p-0"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-white/90">
                            {new Date(item.timestamp || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}