import { useState, useEffect } from "react";
import { logger } from "../../lib/logger";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Loader2, Music2, User, Upload, Crown, Lock, CheckCircle2 } from "lucide-react";
import { TimelineClip } from "./timeline-editor";
import { useToast } from "../../hooks/use-toast";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Progress } from "../ui/progress";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";

export interface MusicianClip {
  id: string;
  type: string;
  name: string;
  start: number;
  end: number;
  imageUrl?: string;
  generatedUrl?: string;
}

interface MusicianIntegrationProps {
  clips?: TimelineClip[];
  audioBuffer?: AudioBuffer | null;
  onUpdateClip?: (clipId: number, updates: Partial<TimelineClip>) => void;
  isPurchased?: boolean;
  videoId?: string;
  onMusicianIntegrationComplete?: (musicianClips: MusicianClip[]) => void;
}

const musicianTypes = [
  {
    id: 'guitarist',
    name: 'Guitarrista',
    description: 'Perfecto para solos y riffs prominentes',
    icon: Music2
  },
  {
    id: 'bassist',
    name: 'Bajista',
    description: 'Ideal para secciones con bajo prominente',
    icon: Music2
  },
  {
    id: 'drummer',
    name: 'Baterista',
    description: 'Resalta partes rítmicas y cambios de tempo',
    icon: Music2
  },
  {
    id: 'pianist',
    name: 'Pianista',
    description: 'Para secciones melódicas o de acompañamiento',
    icon: Music2
  },
  {
    id: 'saxophonist',
    name: 'Saxofonista',
    description: 'Perfecto para solos de viento o secciones jazz',
    icon: Music2
  },
  {
    id: 'violinist',
    name: 'Violinista',
    description: 'Ideal para pasajes emotivos o crescendos',
    icon: Music2
  }
];

export function MusicianIntegration({ 
  clips = [], 
  audioBuffer, 
  onUpdateClip,
  isPurchased = false,
  videoId,
  onMusicianIntegrationComplete
}: MusicianIntegrationProps) {
  const { toast } = useToast();
  const [selectedMusicians, setSelectedMusicians] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [syncMode, setSyncMode] = useState("auto");
  const [detectSolos, setDetectSolos] = useState(true);
  const [detectSections, setDetectSections] = useState(true);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [detectedMusicianClips, setDetectedMusicianClips] = useState<MusicianClip[]>([]);
  const [integrationIntensity, setIntegrationIntensity] = useState(50);

  // Opciones adicionales para premium
  const [customMusicianImage, setCustomMusicianImage] = useState<File | null>(null);
  const [customStyle, setCustomStyle] = useState("realistic");

  // Simular la detección y análisis
  const analyzeAudio = async () => {
    if (selectedMusicians.length === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona al menos un músico para integrar",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    
    // Simulación del análisis progresivo
    const analyzeWithProgress = () => {
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 5;
        setProgress(currentProgress);
        
        if (currentProgress >= 100) {
          clearInterval(interval);
          // Al completar el análisis, generar clips detectados
          generateDetectedClips();
          setIsAnalyzing(false);
          setAnalysisComplete(true);
          
          toast({
            title: "Análisis completo",
            description: "Hemos detectado secciones musicales y generado la integración de músicos",
          });
        }
      }, 200);
    };
    
    // Iniciar el proceso simulado
    analyzeWithProgress();
  };
  
  // Generar clips detectados para los músicos seleccionados
  const generateDetectedClips = () => {
    if (!clips.length || !audioBuffer) return;
    
    const totalDuration = audioBuffer.duration;
    const newMusicianClips: MusicianClip[] = [];
    
    // Para cada músico seleccionado, crear 2-4 secciones distribuidas
    selectedMusicians.forEach(musicianId => {
      const musicianInfo = musicianTypes.find(m => m.id === musicianId);
      if (!musicianInfo) return;
      
      // Determinar número de apariciones según la intensidad
      const appearances = Math.floor(2 + (integrationIntensity / 50));
      
      for (let i = 0; i < appearances; i++) {
        // Calcular posiciones distribuidas a lo largo del video
        const startPercent = (i / appearances) + (Math.random() * 0.1);
        const clipDuration = 3 + (Math.random() * 4); // entre 3 y 7 segundos
        
        const start = startPercent * totalDuration;
        const end = Math.min(start + clipDuration, totalDuration);
        
        newMusicianClips.push({
          id: `${musicianId}-${i}`,
          type: musicianId,
          name: musicianInfo.name,
          start,
          end,
          imageUrl: `/assets/musicians/${musicianId}.jpg`, // Imágenes predefinidas
          generatedUrl: `/assets/musicians/${musicianId}-anim.mp4` // Videos predefinidos
        });
      }
    });
    
    // Ordenar por tiempo de inicio
    newMusicianClips.sort((a, b) => a.start - b.start);
    setDetectedMusicianClips(newMusicianClips);
    
    // Notificar al componente padre
    if (onMusicianIntegrationComplete) {
      onMusicianIntegrationComplete(newMusicianClips);
    }
  };
  
  const handleMusicianSelection = (musicianId: string) => {
    setSelectedMusicians(prev => {
      if (prev.includes(musicianId)) {
        return prev.filter(id => id !== musicianId);
      } else {
        return [...prev, musicianId];
      }
    });
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño y tipo
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "La imagen debe ser menor a 5MB",
          variant: "destructive"
        });
        return;
      }
      
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Por favor sube un archivo de imagen válido",
          variant: "destructive"
        });
        return;
      }
      
      setCustomMusicianImage(file);
      toast({
        title: "Imagen cargada",
        description: "Imagen de músico personalizada cargada correctamente"
      });
    }
  };

  // Si el usuario no ha comprado el video completo, mostrar una versión bloqueada
  if (!isPurchased) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-lg font-semibold">Integración de Músicos</Label>
          <Badge variant="outline" className="gap-1">
            <Lock className="h-3 w-3" />
            <span>Premium</span>
          </Badge>
        </div>
        
        <div className="relative">
          {/* Versión difuminada/bloqueada */}
          <div className="filter blur-[2px] opacity-50 pointer-events-none">
            <div className="space-y-4">
              {/* Versión bloqueada de la interfaz */}
              <div className="space-y-2">
                <Label>Añadir Músicos</Label>
                <div className="grid gap-2">
                  {musicianTypes.slice(0, 3).map((musician) => (
                    <div key={musician.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Music2 className="h-4 w-4 text-orange-500" />
                        <span>{musician.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" disabled>
                        Añadir
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Detección y Análisis</Label>
                <div className="grid gap-2">
                  <div className="flex items-center space-x-2 p-2 border rounded-lg">
                    <Checkbox id="detect-solos-locked" disabled />
                    <Label htmlFor="detect-solos-locked" className="text-sm">
                      Detección automática de solos
                    </Label>
                  </div>
                </div>
              </div>

              <Button disabled className="w-full">
                <Music2 className="mr-2 h-4 w-4" />
                Analizar y Sincronizar Músicos
              </Button>
            </div>
          </div>
          
          {/* Overlay de compra */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
            <Crown className="h-8 w-8 text-yellow-400 mb-2" />
            <h3 className="text-lg font-medium text-white">Función Premium</h3>
            <p className="text-sm text-white/80 text-center mb-4 max-w-xs">
              La integración de músicos está disponible al comprar el video musical completo
            </p>
            <Button
              onClick={() => {
                // Simular redirección a la compra
                toast({
                  title: "Compra el video completo",
                  description: "Esta funcionalidad está disponible con la compra del video completo por $199"
                });
              }}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              <Lock className="mr-2 h-4 w-4" />
              Desbloquear con la compra del video
            </Button>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground">
          <p>Al comprar el video completo desbloquearás:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Detección automática de solos instrumentales</li>
            <li>Integración de músicos visuales sincronizados con la música</li>
            <li>Personalización con imágenes propias</li>
            <li>Ajuste de planos según la intensidad musical</li>
            <li>Exportación en alta calidad</li>
          </ul>
        </div>
      </div>
    );
  }

  // Versión para usuarios que han comprado el video completo
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <Label className="text-lg font-semibold">Integración de Músicos</Label>
        <Badge variant="outline" className="gap-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-orange-600">
          <Crown className="h-3 w-3 text-yellow-500" />
          <span>Premium</span>
        </Badge>
      </div>
      
      <div className="space-y-4">
        {!analysisComplete ? (
          <>
            {/* Selección de Músicos */}
            <div className="space-y-2">
              <Label>Seleccionar Músicos a Integrar</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {musicianTypes.map((musician) => (
                  <div 
                    key={musician.id} 
                    className={`flex items-center justify-between p-2 border rounded-lg cursor-pointer transition-colors ${
                      selectedMusicians.includes(musician.id) 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' 
                        : 'hover:border-orange-300'
                    }`}
                    onClick={() => handleMusicianSelection(musician.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Music2 className={`h-4 w-4 ${
                        selectedMusicians.includes(musician.id) ? 'text-orange-500' : 'text-muted-foreground'
                      }`} />
                      <div>
                        <span className="font-medium">{musician.name}</span>
                        <p className="text-xs text-muted-foreground">{musician.description}</p>
                      </div>
                    </div>
                    <Checkbox 
                      checked={selectedMusicians.includes(musician.id)}
                      onCheckedChange={() => handleMusicianSelection(musician.id)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Imagen personalizada */}
            <div className="space-y-2">
              <Label>Imagen Personalizada (Opcional)</Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="flex-1"
                />
                {customMusicianImage && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Sube tu propia imagen para personalizar la apariencia de los músicos (opcional)
              </p>
            </div>

            {/* Detección y Análisis */}
            <div className="space-y-2">
              <Label>Opciones de Detección</Label>
              <div className="grid gap-2">
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <Label htmlFor="detect-solos" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Music2 className="h-4 w-4 text-orange-500" />
                    Detección automática de solos
                  </Label>
                  <Switch 
                    id="detect-solos" 
                    checked={detectSolos}
                    onCheckedChange={setDetectSolos}
                  />
                </div>
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <Label htmlFor="detect-sections" className="text-sm flex items-center gap-2 cursor-pointer">
                    <Music2 className="h-4 w-4 text-orange-500" />
                    Identificar secciones musicales
                  </Label>
                  <Switch 
                    id="detect-sections" 
                    checked={detectSections}
                    onCheckedChange={setDetectSections}
                  />
                </div>
              </div>
            </div>

            {/* Estilo visual */}
            <div className="space-y-2">
              <Label>Estilo Visual</Label>
              <RadioGroup 
                value={customStyle} 
                onValueChange={setCustomStyle}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                {['realistic', 'artistic', 'animated'].map((style) => (
                  <div key={style} className={`
                    flex items-center justify-between p-2 border rounded-lg
                    ${customStyle === style ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' : ''}
                  `}>
                    <Label htmlFor={`style-${style}`} className="text-sm cursor-pointer capitalize">
                      {style === 'realistic' ? 'Realista' : 
                       style === 'artistic' ? 'Artístico' : 'Animado'}
                    </Label>
                    <RadioGroupItem value={style} id={`style-${style}`} />
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Intensidad de integración */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Intensidad de Integración</Label>
                <span className="text-sm font-medium">{integrationIntensity}%</span>
              </div>
              <Slider
                min={10}
                max={100}
                step={10}
                value={[integrationIntensity]}
                onValueChange={([value]) => setIntegrationIntensity(value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sutil</span>
                <span>Intensa</span>
              </div>
            </div>

            {/* Opciones de Sincronización */}
            <div className="space-y-2">
              <Label>Modo de Sincronización</Label>
              <Select value={syncMode} onValueChange={setSyncMode}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar modo de sincronización" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática (basada en beats)</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="hybrid">Híbrida</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El modo automático detectará y sincronizará los músicos con los beats de la música
              </p>
            </div>

            {/* Botón de análisis */}
            {isAnalyzing ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>Analizando audio...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  {progress < 30 ? "Detectando patrones rítmicos..." :
                   progress < 60 ? "Identificando instrumentos y solos..." :
                   progress < 90 ? "Sincronizando músicos con la música..." :
                   "Finalizando análisis..."}
                </p>
              </div>
            ) : (
              <Button 
                onClick={analyzeAudio} 
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                disabled={selectedMusicians.length === 0}
              >
                <Music2 className="mr-2 h-4 w-4" />
                Analizar y Sincronizar Músicos
              </Button>
            )}
          </>
        ) : (
          // Resultados del análisis
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-sm text-green-800 dark:text-green-300">
                Análisis completo! Se han detectado {detectedMusicianClips.length} segmentos para músicos.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Músicos Detectados</Label>
              <div className="max-h-[300px] overflow-y-auto pr-2">
                {detectedMusicianClips.map((clip) => (
                  <Card key={clip.id} className="mb-2 overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-100 rounded-md flex items-center justify-center">
                          <Music2 className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{clip.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {(clip.end - clip.start).toFixed(1)}s
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Posición: {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setAnalysisComplete(false);
                  setSelectedMusicians([]);
                  setDetectedMusicianClips([]);
                }}
              >
                Reiniciar Análisis
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                onClick={() => {
                  toast({
                    title: "Integración completada",
                    description: "Los músicos se han integrado correctamente en tu video"
                  });
                }}
              >
                Aplicar al Video
              </Button>
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          <p className="font-medium">Detalles de la función:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Detección automática de solos instrumentales</li>
            <li>Identificación de secciones musicales (verso, coro, puente)</li>
            <li>Sincronización de músicos virtuales con el audio</li>
            <li>Generación de escenas específicas para cada músico</li>
            <li>Ajuste de planos según la intensidad musical</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
