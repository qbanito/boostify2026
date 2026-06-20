/**
import { logger } from "../../lib/logger";
 * Componente CharacterDialogueEditor
 * Editor para gestionar diálogos de personajes en la escena
 */
import React, { useState } from 'react';
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Button } from "../../ui/button";
import { PlusCircle, MessageSquare } from 'lucide-react';
import { Switch } from "../../ui/switch";

interface CharacterDialogueEditorProps {
  characterName?: string;
  dialogue?: string;
  onUpdate: (dialogue: string, characterName?: string) => void;
}

export function CharacterDialogueEditor({ 
  characterName, 
  dialogue, 
  onUpdate 
}: CharacterDialogueEditorProps) {
  const [showDialogue, setShowDialogue] = useState(Boolean(dialogue));
  const [tempName, setTempName] = useState(characterName || '');
  const [tempDialogue, setTempDialogue] = useState(dialogue || '');

  const handleToggleDialogue = (checked: boolean) => {
    setShowDialogue(checked);
    if (!checked) {
      // Si se desactiva, limpiar el diálogo
      onUpdate('', tempName);
    }
  };

  const handleSaveDialogue = () => {
    onUpdate(tempDialogue, tempName);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Character Dialogue</Label>
        <div className="flex items-center space-x-2">
          <Switch 
            checked={showDialogue} 
            onCheckedChange={handleToggleDialogue}
            id="dialogue-toggle"
          />
          <Label htmlFor="dialogue-toggle" className="text-xs">
            {showDialogue ? 'Activado' : 'Desactivado'}
          </Label>
        </div>
      </div>

      {showDialogue && (
        <>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Nombre del personaje</Label>
            <Input
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="Nombre del personaje o narrador"
              className="h-8"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Diálogo</Label>
            <Textarea
              value={tempDialogue}
              onChange={(e) => setTempDialogue(e.target.value)}
              placeholder="Escribe aquí el diálogo del personaje..."
              className="resize-none"
              rows={2}
            />
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSaveDialogue}
            className="mt-2"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Aplicar diálogo
          </Button>
        </>
      )}

      {!showDialogue && (
        <p className="text-xs text-muted-foreground">
          Activa esta opción para añadir diálogo de personaje o narración a la escena.
        </p>
      )}
    </div>
  );
}