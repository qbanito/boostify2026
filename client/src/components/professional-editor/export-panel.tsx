import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription
} from '../../components/ui/card';
import {
  Button
} from '../../components/ui/button';
import {
  Input
} from '../../components/ui/input';
import {
  Label
} from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui/tabs';
import {
  Progress
} from '../../components/ui/progress';
import {
  RadioGroup,
  RadioGroupItem
} from '../../components/ui/radio-group';
import {
  Switch
} from '../../components/ui/switch';
import {
  Slider
} from '../../components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../../components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../../components/ui/accordion';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '../../components/ui/drawer';
import {
  FileVideo,
  Download,
  UploadCloud,
  Settings,
  Check,
  CheckCircle,
  Save,
  Share,
  Copy,
  AlertCircle,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Music,
  BarChart,
  Zap,
  Send,
  Loader2,
  CircleSlash,
  Sparkles,
  Video,
  Maximize2,
  Ban,
  Play,
  PauseCircle,
  Undo,
  Clock,
  HandCoins,
  Trophy,
  Link
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { EditorState } from '../../lib/professional-editor-types';
import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

interface ExportPanelProps {
  editorState: Partial<EditorState>;
  duration: number;
  onExport?: (options: ExportOptions) => Promise<string>;
  onSaveProject?: () => Promise<string>;
  projectId?: string;
  userId?: string;
}

export interface ExportOptions {
  format: 'mp4' | 'webm' | 'gif';
  quality: 'draft' | 'standard' | 'high';
  resolution: '480p' | '720p' | '1080p' | '4k';
  frameRate: number;
  includeAudio: boolean;
  includeSubtitles: boolean;
  startTime: number;
  endTime: number;
  watermark: boolean;
  effects: boolean;
  metadata: Record<string, any>;
}

// Predefined export presets
const exportPresets = [
  { 
    id: 'web', 
    name: 'Web', 
    description: 'Optimizado para redes sociales y web',
    options: {
      format: 'mp4',
      quality: 'standard',
      resolution: '720p',
      frameRate: 30,
      includeAudio: true,
      includeSubtitles: true,
      watermark: false,
      effects: true
    }
  },
  { 
    id: 'mobile', 
    name: 'Móvil', 
    description: 'Optimizado para dispositivos móviles',
    options: {
      format: 'mp4',
      quality: 'standard',
      resolution: '720p',
      frameRate: 30,
      includeAudio: true,
      includeSubtitles: true,
      watermark: false,
      effects: true
    }
  },
  { 
    id: 'hd', 
    name: 'Alta Definición', 
    description: 'Máxima calidad para uso profesional',
    options: {
      format: 'mp4',
      quality: 'high',
      resolution: '1080p',
      frameRate: 60,
      includeAudio: true,
      includeSubtitles: true,
      watermark: false,
      effects: true
    }
  },
  { 
    id: 'animated', 
    name: 'GIF Animado', 
    description: 'Para crear GIFs animados',
    options: {
      format: 'gif',
      quality: 'standard',
      resolution: '480p',
      frameRate: 15,
      includeAudio: false,
      includeSubtitles: false,
      watermark: false,
      effects: true
    }
  },
  { 
    id: 'draft', 
    name: 'Borrador', 
    description: 'Vista previa rápida de baja calidad',
    options: {
      format: 'mp4',
      quality: 'draft',
      resolution: '480p',
      frameRate: 30,
      includeAudio: true,
      includeSubtitles: true,
      watermark: true,
      effects: true
    }
  }
];

const resolutionMap = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 }
};

const ExportPanel: React.FC<ExportPanelProps> = ({
  editorState,
  duration,
  onExport,
  onSaveProject,
  projectId,
  userId
}) => {
  // Estados
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'mp4',
    quality: 'standard',
    resolution: '720p',
    frameRate: 30,
    includeAudio: true,
    includeSubtitles: true,
    startTime: 0,
    endTime: duration,
    watermark: false,
    effects: true,
    metadata: {}
  });
  
  const [selectedPreset, setSelectedPreset] = useState<string>('web');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportResult, setExportResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    url?: string;
    error?: string;
  }>({
    status: 'idle'
  });
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    projectId?: string;
    error?: string;
  }>({
    status: 'idle'
  });
  
  const [activeTab, setActiveTab] = useState<string>('options');
  const [showResultDialog, setShowResultDialog] = useState<boolean>(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [projectUrl, setProjectUrl] = useState<string>('');
  const [showCustomRange, setShowCustomRange] = useState<boolean>(false);
  const [isPreviewEnabled, setIsPreviewEnabled] = useState<boolean>(true);
  
  // Actualizar las opciones de exportación cuando cambie un preset
  useEffect(() => {
    const preset = exportPresets.find(p => p.id === selectedPreset);
    if (preset) {
      setExportOptions({
        ...exportOptions,
        ...preset.options,
        startTime: exportOptions.startTime,
        endTime: exportOptions.endTime,
        metadata: exportOptions.metadata
      });
    }
  }, [selectedPreset]);
  
  // Actualizar fin de tiempo cuando cambie la duración
  useEffect(() => {
    setExportOptions(prev => ({
      ...prev,
      endTime: duration
    }));
  }, [duration]);
  
  // Generar URLs para compartir
  useEffect(() => {
    if (projectId) {
      setProjectUrl(`https://${window.location.host}/editor/${projectId}`);
    }
  }, [projectId]);
  
  // Formatear tiempo (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calcular tamaño de archivo estimado
  const estimateFileSize = (): string => {
    const { resolution, frameRate, quality, format, includeAudio } = exportOptions;
    const { width, height } = resolutionMap[resolution];
    const duration = exportOptions.endTime - exportOptions.startTime;
    const pixels = width * height;
    
    // Bits por pixel aproximados para cada nivel de calidad
    const bppMap = {
      draft: 0.1,
      standard: 0.2,
      high: 0.4
    };
    
    // Factor de compresión para cada formato
    const formatFactorMap = {
      mp4: 1,
      webm: 0.8,
      gif: 2.5
    };
    
    // Cálculo base (muy aproximado)
    let sizeInBits = pixels * frameRate * duration * bppMap[quality] * formatFactorMap[format];
    
    // Añadir audio (aproximado)
    if (includeAudio && format !== 'gif') {
      // ~128kbps para audio estándar
      sizeInBits += 128000 * duration;
    }
    
    // Convertir a MB
    const sizeInMB = sizeInBits / (8 * 1024 * 1024);
    
    return `${Math.round(sizeInMB * 10) / 10} MB`;
  };
  
  // Calcular tiempo de procesamiento estimado
  const estimateProcessingTime = (): string => {
    const { resolution, quality, effects } = exportOptions;
    const duration = exportOptions.endTime - exportOptions.startTime;
    
    // Factores de complejidad (multiplicadores aproximados)
    const resolutionFactorMap = {
      '480p': 1,
      '720p': 2,
      '1080p': 4,
      '4k': 10
    };
    
    const qualityFactorMap = {
      draft: 0.5,
      standard: 1,
      high: 2
    };
    
    // Base: 0.5x tiempo real para 720p/standard sin efectos
    let processingTimeFactor = 0.5 * resolutionFactorMap[resolution] * qualityFactorMap[quality];
    
    // Efectos añaden complejidad
    if (effects && editorState.visualEffects && editorState.visualEffects.length > 0) {
      processingTimeFactor *= (1 + editorState.visualEffects.length * 0.2);
    }
    
    // Tiempo total estimado en segundos
    const estimatedSeconds = duration * processingTimeFactor;
    
    if (estimatedSeconds < 60) {
      return `${Math.ceil(estimatedSeconds)} segundos`;
    } else {
      return `${Math.ceil(estimatedSeconds / 60)} minutos`;
    }
  };
  
  // Obtener información del proyecto
  const getProjectInfo = () => {
    const audioTracksCount = editorState.audioTracks?.length || 0;
    const visualEffectsCount = editorState.visualEffects?.length || 0;
    const transcriptionsCount = editorState.transcriptions?.length || 0;
    const cameraMovementsCount = editorState.cameraMovements?.length || 0;
    
    return {
      audioTracksCount,
      visualEffectsCount,
      transcriptionsCount,
      cameraMovementsCount,
      totalDuration: duration,
      projectName: editorState.projectName || 'Proyecto sin título'
    };
  };
  
  // Manejar la exportación
  const handleExport = async () => {
    if (!onExport) {
      setExportResult({
        status: 'error',
        error: 'No se ha proporcionado una función de exportación'
      });
      return;
    }
    
    setIsExporting(true);
    setExportProgress(0);
    setExportResult({
      status: 'loading'
    });
    
    // Simular progreso
    const progressInterval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 5;
      });
    }, 500);
    
    try {
      // Llamar a la función de exportación
      const resultUrl = await onExport(exportOptions);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      setExportResult({
        status: 'success',
        url: resultUrl
      });
      
      // Guardar el registro de exportación en Firestore
      if (projectId && userId) {
        try {
          const exportId = uuidv4();
          await setDoc(doc(db, `projects/${projectId}/exports/${exportId}`), {
            options: exportOptions,
            url: resultUrl,
            createdAt: Timestamp.now(),
            userId,
            projectId
          });
        } catch (error) {
          console.error("Error al guardar registro de exportación:", error);
        }
      }
      
      setShareUrl(resultUrl);
      setShowResultDialog(true);
    } catch (error) {
      console.error("Error al exportar:", error);
      clearInterval(progressInterval);
      
      setExportResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido al exportar'
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  // Manejar guardado del proyecto
  const handleSaveProject = async () => {
    if (!onSaveProject) {
      setSaveResult({
        status: 'error',
        error: 'No se ha proporcionado una función de guardado'
      });
      return;
    }
    
    setIsSaving(true);
    setSaveResult({
      status: 'loading'
    });
    
    try {
      // Llamar a la función de guardado
      const savedProjectId = await onSaveProject();
      
      setSaveResult({
        status: 'success',
        projectId: savedProjectId
      });
      
      setProjectUrl(`https://${window.location.host}/editor/${savedProjectId}`);
    } catch (error) {
      console.error("Error al guardar:", error);
      
      setSaveResult({
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido al guardar'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Copiar al portapapeles
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Error al copiar:", error);
      return false;
    }
  };
  
  // Renderizar presets
  const renderPresets = () => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {exportPresets.map(preset => (
          <div
            key={preset.id}
            className={cn(
              "border rounded-md p-3 cursor-pointer transition-all",
              selectedPreset === preset.id 
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950" 
                : "hover:border-gray-400"
            )}
            onClick={() => setSelectedPreset(preset.id)}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{preset.name}</h3>
              {selectedPreset === preset.id && (
                <CheckCircle className="h-4 w-4 text-orange-500" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {preset.description}
            </p>
            <div className="flex items-center mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="mr-2">{preset.options.resolution}</span>
              <span className="mr-2">{preset.options.format.toUpperCase()}</span>
              <span>{preset.options.frameRate} FPS</span>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <FileVideo className="h-5 w-5 mr-2 text-orange-500" />
            Exportación y Guardado
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveProject}
                    disabled={isSaving}
                    className="h-8"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-1" />
                    )}
                    Guardar proyecto
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Guardar el proyecto actual</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isPreviewEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsPreviewEnabled(!isPreviewEnabled)}
                    className="h-8 w-8 p-0"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPreviewEnabled ? "Desactivar vista previa" : "Activar vista previa"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        
        <CardDescription>
          Configura las opciones de exportación y guarda tu proyecto
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start p-0 rounded-none border-b">
            <TabsTrigger value="options" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Opciones
            </TabsTrigger>
            <TabsTrigger value="presets" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Presets
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Historial
            </TabsTrigger>
          </TabsList>
          
          {/* Opciones de exportación */}
          <TabsContent value="options" className="p-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="format">Formato</Label>
                  <Select
                    value={exportOptions.format}
                    onValueChange={(value: 'mp4' | 'webm' | 'gif') => setExportOptions({
                      ...exportOptions,
                      format: value,
                      // Desactivar audio si es GIF
                      includeAudio: value === 'gif' ? false : exportOptions.includeAudio
                    })}
                  >
                    <SelectTrigger id="format">
                      <SelectValue placeholder="Seleccionar formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                      <SelectItem value="webm">WebM (VP9)</SelectItem>
                      <SelectItem value="gif">GIF Animado</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {exportOptions.format === 'mp4' && "Máxima compatibilidad, ideal para redes sociales y compartir"}
                    {exportOptions.format === 'webm' && "Mejor relación calidad/tamaño, ideal para web"}
                    {exportOptions.format === 'gif' && "Animaciones sin audio, ideal para mensajería"}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolución</Label>
                  <Select
                    value={exportOptions.resolution}
                    onValueChange={(value: '480p' | '720p' | '1080p' | '4k') => setExportOptions({
                      ...exportOptions,
                      resolution: value
                    })}
                  >
                    <SelectTrigger id="resolution">
                      <SelectValue placeholder="Seleccionar resolución" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p (854×480)</SelectItem>
                      <SelectItem value="720p">720p HD (1280×720)</SelectItem>
                      <SelectItem value="1080p">1080p Full HD (1920×1080)</SelectItem>
                      <SelectItem value="4k">4K Ultra HD (3840×2160)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {resolutionMap[exportOptions.resolution].width} × {resolutionMap[exportOptions.resolution].height} píxeles
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quality">Calidad</Label>
                  <Select
                    value={exportOptions.quality}
                    onValueChange={(value: 'draft' | 'standard' | 'high') => setExportOptions({
                      ...exportOptions,
                      quality: value
                    })}
                  >
                    <SelectTrigger id="quality">
                      <SelectValue placeholder="Seleccionar calidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Borrador (Rápido)</SelectItem>
                      <SelectItem value="standard">Estándar</SelectItem>
                      <SelectItem value="high">Alta (Lento)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {exportOptions.quality === 'draft' && "Menor calidad, rápido procesamiento, archivo pequeño"}
                    {exportOptions.quality === 'standard' && "Equilibrio entre calidad y tamaño de archivo"}
                    {exportOptions.quality === 'high' && "Máxima calidad visual, procesamiento lento, archivo grande"}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="frameRate">Imágenes por segundo</Label>
                  <Select
                    value={exportOptions.frameRate.toString()}
                    onValueChange={(value) => setExportOptions({
                      ...exportOptions,
                      frameRate: parseInt(value)
                    })}
                  >
                    <SelectTrigger id="frameRate">
                      <SelectValue placeholder="Seleccionar FPS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 FPS</SelectItem>
                      <SelectItem value="24">24 FPS (Cine)</SelectItem>
                      <SelectItem value="30">30 FPS (Estándar)</SelectItem>
                      <SelectItem value="60">60 FPS (Fluido)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    A mayor FPS, mayor fluidez y tamaño de archivo
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-audio" className="cursor-pointer">
                      Incluir audio
                    </Label>
                    <Switch
                      id="include-audio"
                      checked={exportOptions.includeAudio}
                      onCheckedChange={(checked) => setExportOptions({
                        ...exportOptions,
                        includeAudio: checked
                      })}
                      disabled={exportOptions.format === 'gif'}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="include-subtitles" className="cursor-pointer">
                      Incluir subtítulos
                    </Label>
                    <Switch
                      id="include-subtitles"
                      checked={exportOptions.includeSubtitles}
                      onCheckedChange={(checked) => setExportOptions({
                        ...exportOptions,
                        includeSubtitles: checked
                      })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="watermark" className="cursor-pointer">
                      Marca de agua
                    </Label>
                    <Switch
                      id="watermark"
                      checked={exportOptions.watermark}
                      onCheckedChange={(checked) => setExportOptions({
                        ...exportOptions,
                        watermark: checked
                      })}
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="custom-range" className="cursor-pointer">
                      Rango personalizado
                    </Label>
                    <Switch
                      id="custom-range"
                      checked={showCustomRange}
                      onCheckedChange={setShowCustomRange}
                    />
                  </div>
                  
                  {showCustomRange && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Inicio</Label>
                          <Input
                            type="number"
                            value={exportOptions.startTime}
                            onChange={(e) => setExportOptions({
                              ...exportOptions,
                              startTime: Math.max(0, Math.min(exportOptions.endTime - 1, parseFloat(e.target.value)))
                            })}
                            min={0}
                            max={exportOptions.endTime - 1}
                            step={0.1}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Fin</Label>
                          <Input
                            type="number"
                            value={exportOptions.endTime}
                            onChange={(e) => setExportOptions({
                              ...exportOptions,
                              endTime: Math.max(exportOptions.startTime + 1, Math.min(duration, parseFloat(e.target.value)))
                            })}
                            min={exportOptions.startTime + 1}
                            max={duration}
                            step={0.1}
                          />
                        </div>
                      </div>
                      
                      <div className="px-1">
                        <Slider
                          value={[exportOptions.startTime, exportOptions.endTime]}
                          min={0}
                          max={duration}
                          step={0.1}
                          onValueChange={([start, end]) => setExportOptions({
                            ...exportOptions,
                            startTime: start,
                            endTime: end
                          })}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>{formatTime(0)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Estadísticas de exportación */}
              <div className="mt-2">
                <Accordion type="single" collapsible>
                  <AccordionItem value="info">
                    <AccordionTrigger className="text-sm">
                      Información de exportación
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="text-sm space-y-2 mt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-gray-500">Duración:</p>
                            <p className="font-medium">
                              {formatTime(exportOptions.endTime - exportOptions.startTime)}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-gray-500">Tamaño estimado:</p>
                            <p className="font-medium">
                              {estimateFileSize()}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-gray-500">Tiempo de procesamiento:</p>
                            <p className="font-medium">
                              {estimateProcessingTime()}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-gray-500">Dimensiones:</p>
                            <p className="font-medium">
                              {resolutionMap[exportOptions.resolution].width} × {resolutionMap[exportOptions.resolution].height}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              
              <div>
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full bg-orange-500 hover:bg-orange-600"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exportando... {Math.round(exportProgress)}%
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar video
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* Presets */}
          <TabsContent value="presets" className="p-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Presets de exportación</h3>
                {renderPresets()}
              </div>
              
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-3">Aplicar preset</h3>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveTab('options')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar opciones avanzadas
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* Historial */}
          <TabsContent value="history" className="border-t">
            {/* Mostrar aquí el historial de exportaciones */}
            <div className="p-4">
              <div className="text-center py-12 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Historial no disponible</p>
                <p className="text-xs mt-1">
                  Las exportaciones anteriores aparecerán aquí
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <div>
            <div className="flex items-center">
              {saveResult.status === 'success' && (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 mr-1" />
              )}
              {getProjectInfo().projectName}
            </div>
          </div>
          <div>
            {exportResult.status === 'error' && (
              <span className="text-red-500 flex items-center">
                <AlertCircle className="h-3.5 w-3.5 mr-1" />
                Error en la exportación
              </span>
            )}
            {exportResult.status === 'success' && (
              <span className="text-green-500 flex items-center">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Exportación completada
              </span>
            )}
          </div>
        </div>
      </CardFooter>
      
      {/* Diálogo de resultado de exportación */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Exportación Completada</DialogTitle>
            <DialogDescription>
              Tu video ha sido exportado exitosamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="relative aspect-video rounded-md overflow-hidden mb-4">
              {exportResult.url ? (
                <video 
                  src={exportResult.url} 
                  controls 
                  poster="/placeholder-thumbnail.jpg"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                  <Video className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enlace del video</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(exportResult.url || '')}
                  className="h-7"
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                </Button>
              </div>
              
              <Input
                value={exportResult.url || ''}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              
              <div className="flex space-x-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (exportResult.url) {
                      const a = document.createElement('a');
                      a.href = exportResult.url;
                      a.download = `${getProjectInfo().projectName}.${exportOptions.format}`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar
                </Button>
                
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    if (exportResult.url) {
                      window.open(exportResult.url, '_blank');
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Video
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResultDialog(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ExportPanel;