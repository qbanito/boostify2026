/**
import { logger } from "../../lib/logger";
 * Video Generator With Camera Movements Component
 * 
 * Este componente integra la generación de video con los movimientos de cámara
 * permitiendo aplicar efectos dinámicos a los videos generados por IA.
 */
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useToast } from '../../hooks/use-toast';
import { Badge } from '../ui/badge';
import { CameraMovements } from './camera-movements';
import { useEditor } from '../../lib/context/editor-context';
import {
  Camera,
  Clapperboard,
  Sparkles,
  Film,
  Loader2,
  Palette,
  Video,
  Wand2,
  Music,
  MonitorPlay
} from 'lucide-react';

interface VideoGeneratorWithCameraProps {
  audioDuration?: number;
  onGenerateVideo?: (settings: any) => void;
  isLoading?: boolean;
  scenesCount?: number;
  cameraMovementsEnabled?: boolean;
}

export function VideoGeneratorWithCamera({
  audioDuration = 180,
  onGenerateVideo,
  isLoading = false,
  scenesCount = 5,
  cameraMovementsEnabled = true
}: VideoGeneratorWithCameraProps) {
  const { project, updateWorkflowData } = useEditor();
  const { toast } = useToast();
  
  // Estado para las pestañas
  const [activeTab, setActiveTab] = useState('camera');
  
  // Estado para los ajustes de generación
  const [settings, setSettings] = useState({
    style: 'cinematic',
    quality: 'high',
    resolution: '1080p',
    includeVoiceover: false,
    includeCameraMovements: cameraMovementsEnabled,
    includeSubtitles: false
  });

  // Verificar si hay movimientos de cámara definidos
  const hasCameraMovements = project.workflowData.cameraMovements && project.workflowData.cameraMovements.length > 0;
  
  // Cargar configuraciones guardadas
  useEffect(() => {
    if (project.workflowData.videoSettings) {
      setSettings(prev => ({
        ...prev,
        ...project.workflowData.videoSettings
      }));
    }
  }, [project.workflowData.videoSettings]);
  
  // Manejar cambios en las configuraciones
  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      
      // Guardar en el contexto del editor
      updateWorkflowData({
        videoSettings: newSettings
      });
      
      return newSettings;
    });
  };
  
  // Iniciar la generación del video
  const handleGenerateVideo = () => {
    if (!hasCameraMovements && settings.includeCameraMovements) {
      toast({
        title: "Movimientos de cámara no configurados",
        description: "Por favor, agrega movimientos de cámara o desactiva esta opción",
        variant: "destructive"
      });
      return;
    }
    
    // Guardar configuraciones finales
    updateWorkflowData({
      videoSettings: settings
    });
    
    // Llamar al callback de generación
    if (onGenerateVideo) {
      onGenerateVideo(settings);
    }
  };
  
  // Completar la configuración de movimientos de cámara
  const handleCameraMovementsComplete = () => {
    toast({
      title: "Movimientos guardados",
      description: "Se han guardado los movimientos de cámara correctamente"
    });
    
    // Cambiar a la pestaña de ajustes
    setActiveTab('settings');
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center">
            <Clapperboard className="h-5 w-5 mr-2 text-blue-600" />
            Generador de Video Musical AI
          </CardTitle>
          <CardDescription>
            Configura los parámetros para la generación de tu video musical
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="camera" className="flex items-center">
                <Camera className="h-4 w-4 mr-2" />
                Movimientos de Cámara
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center">
                <Sparkles className="h-4 w-4 mr-2" />
                Ajustes del Video
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="camera" className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-md mb-4">
                <h3 className="text-sm font-medium mb-1">Duración estimada: {Math.round(audioDuration)} segundos</h3>
                <p className="text-xs text-muted-foreground">
                  Configura los movimientos de cámara a aplicar durante la generación del video
                </p>
              </div>
              
              <CameraMovements 
                audioDuration={audioDuration}
                onComplete={handleCameraMovementsComplete}
              />
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  {/* Estilo Visual */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Estilo Visual</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'cinematic', label: 'Cinematográfico', icon: <Film className="h-4 w-4" /> },
                        { id: 'modern', label: 'Moderno', icon: <Palette className="h-4 w-4" /> },
                        { id: 'vibrant', label: 'Vibrante', icon: <Sparkles className="h-4 w-4" /> },
                        { id: 'minimal', label: 'Minimalista', icon: <Video className="h-4 w-4" /> }
                      ].map(style => (
                        <Button
                          key={style.id}
                          variant={settings.style === style.id ? "default" : "outline"}
                          className="h-auto py-2"
                          onClick={() => handleSettingChange('style', style.id)}
                        >
                          {style.icon}
                          <span className="ml-2">{style.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Calidad */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Calidad de Generación</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'standard', label: 'Estándar' },
                        { id: 'high', label: 'Alta' },
                        { id: 'ultra', label: 'Ultra HD' }
                      ].map(quality => (
                        <Button
                          key={quality.id}
                          variant={settings.quality === quality.id ? "default" : "outline"}
                          className="h-auto py-2"
                          onClick={() => handleSettingChange('quality', quality.id)}
                        >
                          {quality.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Resolución */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Resolución</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: '720p', label: '720p' },
                        { id: '1080p', label: '1080p' },
                        { id: '4k', label: '4K' }
                      ].map(resolution => (
                        <Button
                          key={resolution.id}
                          variant={settings.resolution === resolution.id ? "default" : "outline"}
                          className="h-auto py-2"
                          onClick={() => handleSettingChange('resolution', resolution.id)}
                        >
                          {resolution.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Características adicionales */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Características Adicionales</h3>
                    <div className="space-y-2">
                      <Button
                        variant={settings.includeVoiceover ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => handleSettingChange('includeVoiceover', !settings.includeVoiceover)}
                      >
                        <Music className="h-4 w-4 mr-2" />
                        <div className="flex-1 text-left">
                          <div className="flex justify-between">
                            <span>Narración de voz</span>
                            <Badge variant={settings.includeVoiceover ? "default" : "outline"}>
                              {settings.includeVoiceover ? "Activado" : "Desactivado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Añade narración automática basada en la letra
                          </p>
                        </div>
                      </Button>
                      
                      <Button
                        variant={settings.includeCameraMovements ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => handleSettingChange('includeCameraMovements', !settings.includeCameraMovements)}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        <div className="flex-1 text-left">
                          <div className="flex justify-between">
                            <span>Movimientos de cámara</span>
                            <Badge variant={settings.includeCameraMovements ? "default" : "outline"}>
                              {settings.includeCameraMovements ? "Activado" : "Desactivado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Aplica los movimientos de cámara configurados
                          </p>
                        </div>
                      </Button>
                      
                      <Button
                        variant={settings.includeSubtitles ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => handleSettingChange('includeSubtitles', !settings.includeSubtitles)}
                      >
                        <MonitorPlay className="h-4 w-4 mr-2" />
                        <div className="flex-1 text-left">
                          <div className="flex justify-between">
                            <span>Subtítulos</span>
                            <Badge variant={settings.includeSubtitles ? "default" : "outline"}>
                              {settings.includeSubtitles ? "Activado" : "Desactivado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Incluye subtítulos automáticos sincronizados
                          </p>
                        </div>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Resumen del escenario */}
                  <div className="bg-muted/30 p-4 rounded-md">
                    <h3 className="text-sm font-medium mb-2">Resumen del Proyecto</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duración:</span>
                        <span>{Math.round(audioDuration)} segundos</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Escenas:</span>
                        <span>{scenesCount} escenas</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Movimientos de cámara:</span>
                        <span>{project.workflowData.cameraMovements?.length || 0} configurados</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-medium">
                        <span>Tiempo estimado de renderizado:</span>
                        <span>{Math.round(audioDuration / 10) + 2} minutos</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('camera')}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Editar Movimientos
                </Button>
                <Button
                  onClick={handleGenerateVideo}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generar Video Musical
                    </>
                  )}
                </Button>
              </div>
              
              {isLoading && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between text-sm">
                    <span>Generando video...</span>
                    <span className="text-muted-foreground">Esto puede tardar varios minutos</span>
                  </div>
                  <Progress value={42} className="h-2" />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}