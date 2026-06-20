import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  Loader2, Upload, Camera, Sparkles, Palette, UserCircle2, 
  Clock, History, Bookmark, ArrowLeft, CheckCircle, X, Trash2,
  Save, Info, FileText
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { motion } from "framer-motion";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { 
  Dialog, DialogContent, DialogDescription, 
  DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { imageAdvisorService, SavedImageAdvice } from "../../lib/services/image-advisor-service";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "../ui/badge";

export function ImageStyleAdvisor() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [styleRecommendation, setStyleRecommendation] = useState<string>("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [brandingTips, setBrandingTips] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");
  const [selectedResult, setSelectedResult] = useState<SavedImageAdvice | null>(null);
  
  // Ref para evitar múltiples actualizaciones simultáneas
  const refreshInProgress = useRef(false);

  const [artistStyle, setArtistStyle] = useState({
    genre: "",
    vibe: "Professional",
    aesthetic: "Modern",
    colorPalette: "Vibrant",
  });

  // Query for saved results con mejor manejo de errores
  const { data: savedResults = [], refetch: refetchResults, isLoading: isLoadingResults } = useQuery({
    queryKey: ["imageAdviceResults"],
    queryFn: async () => {
      try {
        const results = await imageAdvisorService.getSavedResults();
        return results;
      } catch (err) {
        logger.error("Error retrieving saved results:", err);
        // No mostramos toast aquí para evitar errores en la carga inicial
        return [];
      }
    },
    // No vuelve a cargar automáticamente para evitar ciclos
    staleTime: 5 * 60 * 1000, // 5 minutos (reducimos las consultas innecesarias)
    retry: 1 // Reducimos los reintentos para evitar ciclos
  });

  // Image analysis mutation con mejor manejo de errores
  const analyzeImageMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      return await imageAdvisorService.analyzeImage(imageUrl);
    },
    onSuccess: (data) => {
      // Verificamos que los datos tengan el formato correcto
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid response format");
      }
      
      setStyleRecommendation(data.styleAnalysis || '');
      setRecommendations(data.recommendations || []);
      setColorPalette(data.colorPalette || []);
      setBrandingTips(data.brandingTips || []);
      
      toast({
        title: "Análisis completado",
        description: "Imagen analizada correctamente",
      });
      
      // Ejecutamos refetch solo si el análisis fue exitoso y no hay otro en progreso
      setTimeout(() => {
        if (!refreshInProgress.current) {
          refreshInProgress.current = true;
          refetchResults().finally(() => {
            refreshInProgress.current = false;
          });
        }
      }, 1000); // Retrasamos para evitar ciclos
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Error al analizar la imagen';
      logger.error("Error analyzing image:", error);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Style recommendations mutation con mejor manejo de errores
  const generateRecommendationsMutation = useMutation({
    mutationFn: async ({ style, genre }: { style: string; genre: string }) => {
      // Validación de parámetros
      if (!style || !genre) {
        throw new Error("Es necesario seleccionar género y estilo");
      }
      return await imageAdvisorService.generateVisualRecommendations(style, genre);
    },
    onSuccess: (data) => {
      // Verificamos que los datos tengan el formato correcto
      if (!data || !Array.isArray(data)) {
        throw new Error("Formato de respuesta inválido");
      }
      
      setRecommendations(data);
      
      toast({
        title: "Recomendaciones generadas",
        description: "Se han generado recomendaciones de estilo",
      });
      
      // Ejecutamos refetch solo si la generación fue exitosa y no hay otro en progreso
      setTimeout(() => {
        if (!refreshInProgress.current) {
          refreshInProgress.current = true;
          refetchResults().finally(() => {
            refreshInProgress.current = false;
          });
        }
      }, 1000); // Retrasamos para evitar ciclos
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Error al generar recomendaciones';
      logger.error("Error generating style recommendations:", error);
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setReferenceImage(imageUrl);
        analyzeImageMutation.mutate(imageUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateRecommendations = async () => {
    if (!artistStyle.genre) {
      toast({
        title: "Error",
        description: "Please select a genre first",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsGenerating(true);
      await generateRecommendationsMutation.mutateAsync({
        style: `${artistStyle.vibe} ${artistStyle.aesthetic}`,
        genre: artistStyle.genre
      });
    } catch (error) {
      logger.error("Error generating style recommendations:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSavedResult = (result: SavedImageAdvice) => {
    setSelectedResult(result);
    setStyleRecommendation(result.styleAnalysis);
    setRecommendations(result.recommendations);
    setColorPalette(result.colorPalette || []);
    setBrandingTips(result.brandingTips || []);
    
    if (result.referenceImage) {
      setReferenceImage(result.referenceImage);
    }
    
    if (result.genre) {
      setArtistStyle(prev => ({
        ...prev,
        genre: result.genre || ""
      }));
    }
    
    if (result.style) {
      const styleParts = (result.style || "").split(" ");
      if (styleParts.length > 0) {
        setArtistStyle(prev => ({
          ...prev,
          vibe: styleParts[0] || "Professional",
          aesthetic: styleParts[1] || "Modern"
        }));
      }
    }
    
    setActiveTab("upload");
    
    toast({
      title: "Result Loaded",
      description: "Saved analysis has been loaded successfully",
    });
  };

  const clearResults = () => {
    setReferenceImage(null);
    setStyleRecommendation("");
    setRecommendations([]);
    setColorPalette([]);
    setBrandingTips([]);
    setSelectedResult(null);
    
    toast({
      title: "Cleared",
      description: "Analysis results have been cleared",
    });
  };
  
  // Helper function to format dates properly from Firestore Timestamps
  const formatDate = (date: Date | undefined | null): string => {
    if (!date) return "Unknown date";
    
    try {
      return new Date(date).toLocaleString();
    } catch (error) {
      logger.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  return (
    <div className="space-y-8">
      <Tabs 
        value={activeTab} 
        onValueChange={(value) => setActiveTab(value as "upload" | "history")}
        className="w-full mb-4"
      >
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="upload" className="flex items-center space-x-2">
            <Camera className="h-4 w-4" />
            <span>Upload & Analyze</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <History className="h-4 w-4" />
            <span>History ({savedResults.length})</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="space-y-8">
          <div className="grid gap-6 md:gap-8">
            <div className="space-y-4">
              <Label className="text-base font-medium">Musical Genre</Label>
              <Select
                value={artistStyle.genre}
                onValueChange={(value) => setArtistStyle(prev => ({ ...prev, genre: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select your genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pop">Pop</SelectItem>
                  <SelectItem value="rock">Rock</SelectItem>
                  <SelectItem value="hiphop">Hip Hop</SelectItem>
                  <SelectItem value="electronic">Electronic</SelectItem>
                  <SelectItem value="jazz">Jazz</SelectItem>
                  <SelectItem value="classical">Classical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Desired Vibe</Label>
              <Select
                value={artistStyle.vibe}
                onValueChange={(value) => setArtistStyle(prev => ({ ...prev, vibe: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select the vibe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Edgy">Edgy</SelectItem>
                  <SelectItem value="Artistic">Artistic</SelectItem>
                  <SelectItem value="Minimalist">Minimalist</SelectItem>
                  <SelectItem value="Avant-garde">Avant-garde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Aesthetic Style</Label>
              <Select
                value={artistStyle.aesthetic}
                onValueChange={(value) => setArtistStyle(prev => ({ ...prev, aesthetic: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select aesthetic style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Modern">Modern</SelectItem>
                  <SelectItem value="Vintage">Vintage</SelectItem>
                  <SelectItem value="Urban">Urban</SelectItem>
                  <SelectItem value="Natural">Natural</SelectItem>
                  <SelectItem value="Futuristic">Futuristic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium">Reference Image (Optional)</Label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer border-orange-500/20 bg-black/20 hover:bg-black/30">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-4 text-orange-500" />
                    <p className="mb-2 text-sm text-orange-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG or GIF (MAX. 5MB)
                    </p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {referenceImage && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4"
                >
                  <Card className="overflow-hidden">
                    <img 
                      src={referenceImage} 
                      alt="Reference" 
                      className="w-full h-64 object-cover"
                    />
                  </Card>
                </motion.div>
              )}
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleGenerateRecommendations}
                disabled={isGenerating || !artistStyle.genre}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Recommendations</span>
                  </div>
                )}
              </Button>
              
              {styleRecommendation && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={clearResults}
                        variant="outline"
                        className="border-orange-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear results</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Results Section */}
            {styleRecommendation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card className="p-6 bg-black/40 backdrop-blur-sm border-orange-500/20">
                  <div className="flex items-start gap-4">
                    <UserCircle2 className="h-6 w-6 text-orange-500 mt-1" />
                    <div>
                      <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        Style Analysis
                        {selectedResult && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            <Clock className="h-3 w-3 mr-1" /> 
                            Loaded from history
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">{styleRecommendation}</p>
                    </div>
                  </div>
                </Card>

                {recommendations.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Recommendations</h3>
                    <div className="grid gap-4">
                      {recommendations.map((recommendation, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className="p-4 bg-black/40 backdrop-blur-sm border-orange-500/20">
                            <p className="text-sm">{recommendation}</p>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                
                {colorPalette.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center">
                      <Palette className="h-5 w-5 mr-2 text-orange-500" />
                      Color Palette
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {colorPalette.map((color, index) => (
                        <div key={index} className="space-y-2">
                          <div 
                            className="h-16 rounded-md" 
                            style={{ 
                              backgroundColor: color.startsWith('#') ? color : '#' + color,
                              border: '1px solid rgba(255,255,255,0.1)'
                            }}
                          ></div>
                          <p className="text-xs text-center">{color}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {brandingTips.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Branding Tips</h3>
                    <div className="grid gap-4">
                      {brandingTips.map((tip, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card className="p-4 bg-black/40 backdrop-blur-sm border-orange-500/20">
                            <div className="flex items-start gap-2">
                              <div className="h-5 w-5 rounded-full bg-orange-500/20 flex-shrink-0 mt-0.5 flex items-center justify-center">
                                <span className="text-orange-500 text-xs">{index + 1}</span>
                              </div>
                              <p className="text-sm">{tip}</p>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">Your Style Analysis History</h2>
            <p className="text-muted-foreground">
              View and load your previous style analyses and recommendations
            </p>
          </div>
          
          {savedResults.length === 0 ? (
            <Card className="p-8 bg-black/40 backdrop-blur-sm border-orange-500/20 text-center">
              <div className="flex flex-col items-center justify-center gap-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-lg mb-2">No saved analyses yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Upload an image or generate style recommendations to create your first analysis.
                  </p>
                </div>
                <Button 
                  onClick={() => setActiveTab("upload")}
                  className="mt-4 bg-orange-500 hover:bg-orange-600"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go to Image Upload
                </Button>
              </div>
            </Card>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="grid gap-4">
                {savedResults.map((result, index) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="overflow-hidden border-orange-500/20 hover:border-orange-500/40 transition-colors">
                      <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-md font-medium flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {result.genre && (
                              <Badge variant="outline" className="text-xs">
                                {result.genre}
                              </Badge>
                            )}
                            {result.style && (
                              <Badge variant="outline" className="text-xs bg-orange-500/10">
                                {result.style}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(result.createdAt).split(',')[0]} {/* Mostrar solo la fecha */}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {result.referenceImage && (
                            <div className="w-24 h-24 flex-shrink-0">
                              <img 
                                src={result.referenceImage} 
                                alt="Reference" 
                                className="w-full h-full object-cover rounded-md"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {result.styleAnalysis}
                            </p>
                            {result.recommendations.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {result.recommendations.length} recommendations
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Info className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Style Analysis Details</DialogTitle>
                              <DialogDescription>
                                Analysis from {formatDate(result.createdAt)}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                              {result.referenceImage && (
                                <div className="mb-4">
                                  <img
                                    src={result.referenceImage}
                                    alt="Reference"
                                    className="w-full h-48 object-contain rounded-md"
                                  />
                                </div>
                              )}
                              <div>
                                <h4 className="font-medium text-sm">Style Analysis</h4>
                                <p className="text-sm mt-1 text-muted-foreground">{result.styleAnalysis}</p>
                              </div>
                              {result.recommendations.length > 0 && (
                                <div>
                                  <h4 className="font-medium text-sm">Recommendations</h4>
                                  <ul className="mt-1 space-y-2">
                                    {result.recommendations.map((rec, i) => (
                                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                        <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                                        <span>{rec}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <DialogFooter className="mt-4">
                              <Button variant="outline" onClick={() => loadSavedResult(result)}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Load This Analysis
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant="default" 
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => loadSavedResult(result)}
                        >
                          <ArrowLeft className="h-4 w-4 mr-1" />
                          Load
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}