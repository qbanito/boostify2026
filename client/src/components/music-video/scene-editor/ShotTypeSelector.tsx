/**
import { logger } from "../../lib/logger";
 * Componente ShotTypeSelector
 * Permite seleccionar el tipo de plano para una escena
 */
import React from 'react';
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { 
  Maximize2, 
  Users, 
  User, 
  ZoomIn 
} from 'lucide-react';

interface ShotTypeSelectorProps {
  selectedType: string;
  onSelect: (type: string) => void;
}

// Definición de tipos de planos disponibles
const SHOT_TYPES = [
  {
    id: "wide shot",
    label: "Wide shot",
    description: "Plano general que muestra el entorno completo",
    icon: Maximize2
  },
  {
    id: "medium shot",
    label: "Medium shot",
    description: "Plano medio que captura expresión y lenguaje corporal",
    icon: Users
  },
  {
    id: "close-up",
    label: "Close-up",
    description: "Primer plano que enfatiza la emoción y los detalles",
    icon: User
  },
  {
    id: "extreme close-up",
    label: "Extreme close-up",
    description: "Plano detalle que muestra detalles específicos",
    icon: ZoomIn
  }
];

export function ShotTypeSelector({ selectedType, onSelect }: ShotTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Shot Type</Label>
      
      <RadioGroup 
        value={selectedType}
        onValueChange={onSelect}
        className="grid grid-cols-1 gap-2"
      >
        {SHOT_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <label
              key={type.id}
              className={`
                flex items-center space-x-2 rounded-md border p-2 cursor-pointer
                hover:bg-accent hover:text-accent-foreground
                ${selectedType === type.id ? 'bg-accent text-accent-foreground' : ''}
              `}
            >
              <RadioGroupItem value={type.id} id={type.id} />
              <Icon className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{type.label}</span>
                <span className="text-xs text-muted-foreground">{type.description}</span>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}