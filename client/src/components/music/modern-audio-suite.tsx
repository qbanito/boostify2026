import { useState } from "react";
import { logger } from "@/lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { 
  Loader2, Wand2, Mic, Download, Split, Waves, Music, History, 
  Settings, AudioLines, Headphones, Info
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { useToast } from "../../hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useIsMobile } from "../../hooks/use-mobile";

// Importamos los estilos específicos para optimización móvil
import "../../styles/mobile-optimization.css";

/**
 * Componente ModernAudioSuite
 * 
 * Versión moderna y optimizada para móviles del Audio Production Suite,
 * con un diseño limpio, navegación mejorada y experiencia de usuario optimizada.
 */
export function ModernAudioSuite() {
  // Estados básicos
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("mastering");
  const isMobile = useIsMobile();
  
  // Estados para ajustes expandibles en móvil
  const [isExpanded, setIsExpanded] = useState<Record<string, boolean>>({
    settings: false,
    quality: false,
    advanced: false
  });
  
  const { toast } = useToast();
  
  // Función de procesamiento de audio simplificada
  const handleProcessAudio = async () => {
    if (!audioFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de audio",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsProcessing(true);
      // Simulación de proceso de audio (en producción, llamaríamos a una API real)
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Éxito",
        description: "Procesamiento de audio iniciado correctamente"
      });

    } catch (error) {
      logger.error("Error procesando audio:", error);
      toast({
        title: "Error",
        description: "Error al procesar el audio. Por favor intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Alternar estado expandido para secciones en móvil
  const toggleExpanded = (section: string) => {
    setIsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 bg-background rounded-lg shadow-sm mb-4 sm:mb-8 audio-processing-container">
      {/* Encabezado del componente */}
      <header className="flex items-center justify-between audio-processing-header">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <AudioLines className="text-primary h-6 w-6" />
          Audio Production Suite
        </h1>
        <Badge variant="outline" className="bg-primary/5">Pro</Badge>
      </header>
      
      {/* Navegación por pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isMobile ? "grid-cols-3 mobile-tabs-container" : "grid-cols-5"} gap-1 sm:gap-2 p-1`}>
          <TabsTrigger value="mastering" className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 h-auto">
            <Waves className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap">{isMobile ? "Audio" : "Audio Processing"}</span>
          </TabsTrigger>
          <TabsTrigger value="voice-conversion" className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 h-auto">
            <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap">{isMobile ? "Voz" : "Voice Conversion"}</span>
          </TabsTrigger>
          <TabsTrigger value="voice-model" className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 h-auto">
            <Music className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap">{isMobile ? "Entrenar" : "Train Voice"}</span>
          </TabsTrigger>
          {!isMobile && (
            <>
              <TabsTrigger value="separation" className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 h-auto">
                <Split className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap">Stem Separation</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 h-auto">
                <History className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap">History</span>
              </TabsTrigger>
            </>
          )}
          {isMobile && (
            <TabsTrigger value="more" className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-2 h-auto">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm font-medium text-center whitespace-nowrap">Más</span>
            </TabsTrigger>
          )}
        </TabsList>
        
        {/* Pestaña de Procesamiento de Audio */}
        <TabsContent value="mastering" className="space-y-4 pt-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AudioLines className="h-5 w-5 text-primary" />
                    Audio Processing
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Optimize your audio with professional mastering
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-primary/5 hidden sm:flex">Professional</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              {/* Selección de archivo - versión optimizada para móvil */}
              <div className="space-y-2">
                <Label htmlFor="audio-mastering" className="flex items-center gap-2 text-sm">
                  <Music className="h-4 w-4 text-primary/80" />
                  <span>Audio File</span>
                </Label>
                {isMobile ? (
                  <div className="custom-file-input-mobile">
                    <div className="flex flex-col items-center justify-center h-full">
                      <Music className="h-8 w-8 text-primary/40 mb-2" />
                      <p className="text-xs font-medium">{audioFile ? audioFile.name : "Select audio file"}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(2)} MB` : "Tap to browse files"}
                      </p>
                    </div>
                    <Input
                      id="audio-mastering"
                      type="file"
                      accept="audio/*"
                      onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                ) : (
                  <Input
                    id="audio-mastering"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    className="border-primary/20 focus:border-primary/50 text-sm"
                  />
                )}
                <p className="text-xs text-muted-foreground italic">
                  Upload your audio file (WAV or MP3) for processing
                </p>
              </div>
              
              {/* Opciones de procesamiento en formato de cards */}
              <TooltipProvider>
                <div className="modern-audio-controls">
                  <Card className="bg-primary/5 border-0 hover:bg-primary/10 transition-colors cursor-pointer modern-audio-control-item">
                    <CardContent className="p-3 flex flex-col items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2 modern-audio-control-icon">
                        <Wand2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-xs sm:text-sm modern-audio-control-title">Master Track</h3>
                        <p className="text-[10px] sm:text-xs text-center text-muted-foreground modern-audio-control-description">
                          Optimize levels
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-primary/5 border-0 hover:bg-primary/10 transition-colors cursor-pointer modern-audio-control-item">
                    <CardContent className="p-3 flex flex-col items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2 modern-audio-control-icon">
                        <Split className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-xs sm:text-sm modern-audio-control-title">Voice Extraction</h3>
                        <p className="text-[10px] sm:text-xs text-center text-muted-foreground modern-audio-control-description">
                          Isolate vocals
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-primary/5 border-0 hover:bg-primary/10 transition-colors cursor-pointer modern-audio-control-item">
                    <CardContent className="p-3 flex flex-col items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2 modern-audio-control-icon">
                        <Settings className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-xs sm:text-sm modern-audio-control-title">Advanced Settings</h3>
                        <p className="text-[10px] sm:text-xs text-center text-muted-foreground modern-audio-control-description">
                          Fine-tune params
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TooltipProvider>
              
              {/* Configuraciones avanzadas colapsables - optimizadas para móvil */}
              <Collapsible 
                open={isExpanded.settings} 
                onOpenChange={() => toggleExpanded('settings')}
                className="border rounded-md p-0 overflow-hidden"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-muted/50 touch-target">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">Processing Settings</h3>
                  </div>
                  <div className="w-6 h-6 flex items-center justify-center">
                    <Info className={`h-4 w-4 transform transition-transform ${isExpanded.settings ? 'rotate-180' : ''}`} />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-4 space-y-4 bg-background/80">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs">Quality Level</Label>
                        <Badge variant="outline" className="text-[10px]">High</Badge>
                      </div>
                      <Slider defaultValue={[75]} max={100} step={1} className="my-3 audio-slider-mobile" />
                    </div>
                    
                    <div className="flex items-center justify-between space-x-2 touch-target py-1">
                      <Label htmlFor="noise-reduction" className="text-sm cursor-pointer">
                        Noise Reduction
                      </Label>
                      <Switch id="noise-reduction" />
                    </div>
                    
                    <div className="flex items-center justify-between space-x-2 touch-target py-1">
                      <Label htmlFor="loudness-normalize" className="text-sm cursor-pointer">
                        Loudness Normalization
                      </Label>
                      <Switch id="loudness-normalize" defaultChecked />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 px-4 sm:px-6 pb-4 audio-processing-footer">
              <Button 
                onClick={handleProcessAudio}
                disabled={isProcessing || !audioFile}
                className={`w-full touch-button bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 ${isProcessing ? 'reduce-motion' : 'responsive-transition'}`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className={isMobile ? "text-sm" : ""}>Processing...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    <span className={isMobile ? "text-sm" : ""}>Process Audio</span>
                  </>
                )}
              </Button>
              {isProcessing && (
                <div className="mt-2 bg-primary/5 rounded-md p-2 text-center">
                  <p className="text-xs text-primary font-medium">Processing your audio</p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                    <div className="bg-primary h-1.5 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                Processing typically takes 1-2 minutes depending on file size
              </p>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* Pestaña de Voice Conversion */}
        <TabsContent value="voice-conversion" className="space-y-4 pt-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Mic className="h-5 w-5 text-primary" />
                    Voice Conversion
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Transform your vocals using advanced AI models
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-blue-500/5 text-blue-500 hidden sm:flex">AI Powered</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              {/* Guía de información */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/10 p-3 sm:p-4 space-y-2 sm:space-y-3">
                <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                  <div className="bg-blue-500/10 p-1.5 rounded-full mt-0.5 sm:mt-0">
                    <Headphones className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium">Recording High-Quality Datasets</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      For best results, record vocals in a quiet environment
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                  <div className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-500 font-medium">1</span>
                    </div>
                    <p>Use a good microphone with pop filter</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-500 font-medium">2</span>
                    </div>
                    <p>Record in a quiet room with no background noise</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-500 font-medium">3</span>
                    </div>
                    <p>Maintain consistent distance from mic</p>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-green-500 font-medium">4</span>
                    </div>
                    <p>Record at least 10 minutes of clear audio</p>
                  </div>
                </div>
              </div>
              
              {/* Más contenidos de Voice Conversion se implementarán en la próxima iteración */}
              <p className="text-sm text-center text-muted-foreground">
                Voice conversion tools will be available in the next update
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Otras pestañas se implementarán en futuras iteraciones */}
        <TabsContent value="voice-model" className="space-y-4 pt-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Music className="h-5 w-5 text-primary" />
                Train Voice Model
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Create custom AI voice models from your recordings
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 text-center py-8">
              <p className="text-sm text-muted-foreground">
                Voice model training coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="separation" className="space-y-4 pt-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Split className="h-5 w-5 text-primary" />
                Stem Separation
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Split your audio into individual instrument stems
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 text-center py-8">
              <p className="text-sm text-muted-foreground">
                Stem separation tools coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4 pt-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-primary" />
                Processing History
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                View and manage your previous audio processing jobs
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 text-center py-8">
              <p className="text-sm text-muted-foreground">
                No processing history available
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Menú Más para móvil */}
        <TabsContent value="more" className="space-y-4 pt-2">
          <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-primary" />
                More Options
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col">
                <div className="border-b py-3 px-4 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <Split className="h-4 w-4 text-primary" />
                    <span className="text-sm">Stem Separation</span>
                  </div>
                </div>
                <div className="border-b py-3 px-4 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <span className="text-sm">History</span>
                  </div>
                </div>
                <div className="py-3 px-4 hover:bg-primary/5 transition-colors">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    <span className="text-sm">Download Templates</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}