/**
import { logger } from "../../lib/logger";
 * Editor de Escenas Cinematográficas
 * Permite editar todos los parámetros cinematográficos para cada corte del video musical
 * Estructura: scene, camera, lighting, style, movement
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { 
  Wand2, 
  RefreshCw, 
  Save, 
  Image as ImageIcon,
  Camera,
  Lightbulb,
  Palette,
  Video
} from 'lucide-react';
import { useToast } from "../../hooks/use-toast";
import { generateImageFromScene, type CinematicScene } from "../../lib/api/gemini-image";

export interface CinematicSceneData extends CinematicScene {
  imageUrl?: string;
  isGenerating?: boolean;
}

interface CinematicSceneEditorProps {
  scene: CinematicSceneData;
  onUpdate: (scene: CinematicSceneData) => void;
  onGenerateImage?: (scene: CinematicSceneData) => Promise<void>;
}

export function CinematicSceneEditor({ 
  scene, 
  onUpdate,
  onGenerateImage 
}: CinematicSceneEditorProps) {
  const { toast } = useToast();
  const [localScene, setLocalScene] = useState<CinematicSceneData>(scene);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setLocalScene(scene);
  }, [scene]);

  const handleFieldChange = (field: keyof CinematicScene, value: string) => {
    setLocalScene(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localScene);
    toast({
      title: "Escena guardada",
      description: "Los cambios han sido guardados correctamente."
    });
  };

  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const result = await generateImageFromScene(localScene);
      
      if (result.success && result.imageUrl) {
        const updatedScene = {
          ...localScene,
          imageUrl: result.imageUrl
        };
        setLocalScene(updatedScene);
        onUpdate(updatedScene);
        
        toast({
          title: "Imagen generada",
          description: "La imagen cinematográfica se ha generado exitosamente."
        });
      } else {
        throw new Error(result.error || 'Error al generar imagen');
      }
    } catch (error: any) {
      logger.error('Error generando imagen:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo generar la imagen. Intente nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Corte #{scene.id}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateImage}
              disabled={isGenerating}
              data-testid={`button-generate-image-${scene.id}`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-1" />
                  Generar Imagen
                </>
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              data-testid={`button-save-${scene.id}`}
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Previsualización de imagen */}
        <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
          {localScene.imageUrl ? (
            <img 
              src={localScene.imageUrl} 
              alt={`Escena ${scene.id}`}
              className="w-full h-full object-cover"
              data-testid={`img-scene-${scene.id}`}
            />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Sin imagen generada</p>
            </div>
          )}
        </div>

        {/* Scene Description */}
        <div className="space-y-2">
          <Label htmlFor={`scene-${scene.id}`} className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Descripción de la Escena
          </Label>
          <Textarea
            id={`scene-${scene.id}`}
            value={localScene.scene}
            onChange={(e) => handleFieldChange('scene', e.target.value)}
            placeholder="Plano general: el artista camina con paso firme sobre la pista de un aeropuerto privado al atardecer..."
            rows={3}
            className="resize-none"
            data-testid={`input-scene-${scene.id}`}
          />
        </div>

        {/* Camera Setup */}
        <div className="space-y-2">
          <Label htmlFor={`camera-${scene.id}`} className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Cámara y Configuración
          </Label>
          <Input
            id={`camera-${scene.id}`}
            value={localScene.camera}
            onChange={(e) => handleFieldChange('camera', e.target.value)}
            placeholder="ARRI Alexa LF, lente 35mm anamórfico, formato 2.39:1"
            data-testid={`input-camera-${scene.id}`}
          />
        </div>

        {/* Lighting */}
        <div className="space-y-2">
          <Label htmlFor={`lighting-${scene.id}`} className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Iluminación
          </Label>
          <Input
            id={`lighting-${scene.id}`}
            value={localScene.lighting}
            onChange={(e) => handleFieldChange('lighting', e.target.value)}
            placeholder="golden hour cálida con flare solar lateral, reflejos metálicos..."
            data-testid={`input-lighting-${scene.id}`}
          />
        </div>

        {/* Visual Style */}
        <div className="space-y-2">
          <Label htmlFor={`style-${scene.id}`} className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Estilo Visual
          </Label>
          <Input
            id={`style-${scene.id}`}
            value={localScene.style}
            onChange={(e) => handleFieldChange('style', e.target.value)}
            placeholder="Bruno Aveillan – lujo cinematográfico con atmósfera de poder y éxito"
            data-testid={`input-style-${scene.id}`}
          />
        </div>

        {/* Camera Movement */}
        <div className="space-y-2">
          <Label htmlFor={`movement-${scene.id}`} className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Movimiento de Cámara
          </Label>
          <Input
            id={`movement-${scene.id}`}
            value={localScene.movement}
            onChange={(e) => handleFieldChange('movement', e.target.value)}
            placeholder="travelling frontal lento con ligero paneo hacia el skyline iluminado"
            data-testid={`input-movement-${scene.id}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
