/**
import { logger } from "../../lib/logger";
 * Componente SceneEditor
 * Editor principal para escenas individuales en la producción de videos musicales AI.
 * Permite edición de prompts, tipos de plano, composición y diálogo.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "../../ui/card";
import { 
  RefreshCw, 
  Edit, 
  Image as ImageIcon, 
  Plus, 
  Trash, 
  Video, 
  Play 
} from 'lucide-react';
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Badge } from "../../ui/badge";
import { Separator } from "../../ui/separator";
import { MotionEditor } from './MotionEditor';
import { ShotTypeSelector } from './ShotTypeSelector';
import { CompositionEditor } from './CompositionEditor';
import { CharacterDialogueEditor } from './CharacterDialogueEditor';
import { useToast } from "../../../hooks/use-toast";

export interface SceneData {
  id: string;
  prompt: string;
  shotType: string;
  characterName?: string;
  characterDialogue?: string;
  composition?: string;
  imageUrl?: string;
  motionSettings?: {
    intensity: number;
    seed: string;
    duration: string;
  };
  autoSfx?: boolean;
}

interface SceneEditorProps {
  scene: SceneData;
  onUpdate: (scene: SceneData) => void;
  onRegenerateImage: (sceneId: string) => Promise<void>;
  isRegenerating?: boolean;
}

export function SceneEditor({ 
  scene, 
  onUpdate, 
  onRegenerateImage,
  isRegenerating = false 
}: SceneEditorProps) {
  const { toast } = useToast();
  const [localScene, setLocalScene] = useState<SceneData>(scene);
  const [isEditing, setIsEditing] = useState(false);

  // Sincronizar con los cambios de prop
  useEffect(() => {
    setLocalScene(scene);
  }, [scene]);

  const handlePromptChange = (prompt: string) => {
    setLocalScene(prev => ({ ...prev, prompt }));
  };

  const handleShotTypeChange = (shotType: string) => {
    setLocalScene(prev => ({ ...prev, shotType }));
  };

  const handleCompositionChange = (composition: string) => {
    setLocalScene(prev => ({ ...prev, composition }));
  };

  const handleDialogueChange = (characterDialogue: string, characterName?: string) => {
    setLocalScene(prev => ({ 
      ...prev, 
      characterDialogue,
      characterName: characterName || prev.characterName
    }));
  };

  const handleMotionChange = (motionSettings: SceneData['motionSettings']) => {
    setLocalScene(prev => ({ ...prev, motionSettings }));
  };

  const handleAutoSfxChange = (autoSfx: boolean) => {
    setLocalScene(prev => ({ ...prev, autoSfx }));
  };

  const saveChanges = () => {
    onUpdate(localScene);
    setIsEditing(false);
    toast({
      title: "Cambios guardados",
      description: "Los cambios en la escena han sido guardados correctamente."
    });
  };

  const handleRegenerateImage = async () => {
    try {
      await onRegenerateImage(scene.id);
      toast({
        title: "Regenerando imagen",
        description: "La imagen está siendo regenerada con los ajustes actuales."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo regenerar la imagen. Intente nuevamente.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full shadow-md">
      <CardContent className="p-4">
        {/* Prompt principal y controles de edición */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            {isEditing ? (
              <Textarea
                value={localScene.prompt}
                onChange={e => handlePromptChange(e.target.value)}
                className="w-full resize-none font-medium"
                rows={3}
                placeholder="Describe esta escena de forma detallada..."
              />
            ) : (
              <div className="relative">
                <p className="font-medium">{localScene.prompt}</p>
                <button 
                  className="absolute top-0 right-0 p-1 rounded-full bg-secondary text-secondary-foreground opacity-50 hover:opacity-100"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="ml-2 flex-shrink-0"
            onClick={handleRegenerateImage}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Previsualizacion de la imagen */}
        <div className="mb-4 aspect-video bg-muted rounded-md overflow-hidden relative">
          {localScene.imageUrl ? (
            <img 
              src={localScene.imageUrl} 
              alt="Preview de la escena" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground ml-2">Sin imagen generada</p>
            </div>
          )}
          <Badge 
            className="absolute top-2 right-2" 
            variant={getShotTypeVariant(localScene.shotType)}
          >
            {localScene.shotType || "Sin tipo de plano"}
          </Badge>
        </div>

        {/* Secciones de edición */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ShotTypeSelector 
            selectedType={localScene.shotType}
            onSelect={handleShotTypeChange}
          />
          
          <CompositionEditor
            composition={localScene.composition || ""}
            onUpdate={handleCompositionChange}
          />
        </div>

        <Separator className="my-4" />
        
        <CharacterDialogueEditor
          characterName={localScene.characterName}
          dialogue={localScene.characterDialogue}
          onUpdate={handleDialogueChange}
        />

        <Separator className="my-4" />
        
        <MotionEditor
          settings={localScene.motionSettings}
          autoSfx={localScene.autoSfx}
          onSettingsChange={handleMotionChange}
          onAutoSfxChange={handleAutoSfxChange}
        />

        {/* Botones de acción */}
        {isEditing && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={saveChanges}>
              Guardar cambios
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Función de utilidad para determinar la variante del badge según el tipo de plano
function getShotTypeVariant(shotType?: string): "default" | "secondary" | "outline" {
  if (!shotType) return "outline";
  
  const type = shotType.toLowerCase();
  if (type.includes("close-up")) return "secondary";
  return "default";
}