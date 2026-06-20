import React, { useState, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Textarea } from '../ui/textarea';
import { toast } from '../../hooks/use-toast';
import { Loader2, ThumbsUp, Activity, Wand2, Check } from 'lucide-react';
import { Badge } from '../ui/badge';

interface MovementIntegrationProps {
  onApplyMovements: (movements: MovementSettings) => void;
  isLoading?: boolean;
  initialSettings?: Partial<MovementSettings>;
}

export interface MovementSettings {
  style: string;
  intensity: number;
  customPrompt?: string;
  transitions: string;
  cameraMovements?: string[];
}

const movementStyles = [
  "Fluido y Elegante",
  "Enérgico y Dinámico",
  "Suave y Sutil",
  "Rítmico y Preciso",
  "Dramático y Expresivo"
];

const transitionTypes = [
  "Cortes Rápidos",
  "Fundidos Suaves",
  "Transiciones Rítmicas",
  "Zoom Progresivo",
  "Barridos Laterales",
  "Mezcla Personalizada"
];

const cameraMovementOptions = [
  "Paneo Horizontal",
  "Paneo Vertical",
  "Zoom In",
  "Zoom Out",
  "Seguimiento",
  "Movimiento Orbital",
  "Dolly",
  "Tilt"
];

export function MovementIntegration({ onApplyMovements, isLoading = false, initialSettings }: MovementIntegrationProps) {
  const [settings, setSettings] = useState<MovementSettings>({
    style: "Fluido y Elegante",
    intensity: 65,
    customPrompt: "",
    transitions: "Fundidos Suaves",
    cameraMovements: []
  });
  
  const [isSuccess, setIsSuccess] = useState(false);

  // Aplicar configuraciones iniciales si están disponibles
  useEffect(() => {
    if (initialSettings) {
      setSettings(prevSettings => ({
        ...prevSettings,
        ...initialSettings
      }));
    }
  }, [initialSettings]);

  const handleApply = () => {
    try {
      onApplyMovements(settings);
      
      setIsSuccess(true);
      
      toast({
        title: "Movimientos aplicados",
        description: "Los ajustes de movimiento se han aplicado exitosamente a tu video musical"
      });
      
      // Resetear el estado de éxito después de 3 segundos
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      logger.error("Error al aplicar movimientos:", error);
      
      toast({
        title: "Error",
        description: "No se pudieron aplicar los movimientos. Por favor, intenta de nuevo.",
        variant: "destructive"
      });
    }
  };

  const toggleCameraMovement = (movement: string) => {
    setSettings(prev => {
      const currentMovements = prev.cameraMovements || [];
      
      if (currentMovements.includes(movement)) {
        // Eliminar el movimiento si ya está seleccionado
        return {
          ...prev,
          cameraMovements: currentMovements.filter(m => m !== movement)
        };
      } else {
        // Agregar el movimiento (máximo 3)
        if (currentMovements.length >= 3) {
          toast({
            title: "Máximo alcanzado",
            description: "Solo puedes seleccionar hasta 3 movimientos de cámara",
            variant: "default"
          });
          return prev;
        }
        
        return {
          ...prev,
          cameraMovements: [...currentMovements, movement]
        };
      }
    });
  };

  return (
    <Card className="border border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Activity className="h-5 w-5 mr-2 text-amber-600" />
          Integración de Movimiento
        </CardTitle>
        <CardDescription>
          Añade movimientos dinámicos para que tu video musical cobre vida
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="style">Estilo de Movimiento</Label>
          <Select 
            value={settings.style} 
            onValueChange={(value) => setSettings({...settings, style: value})}
          >
            <SelectTrigger id="style">
              <SelectValue placeholder="Seleccionar estilo" />
            </SelectTrigger>
            <SelectContent>
              {movementStyles.map((style) => (
                <SelectItem key={style} value={style}>{style}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="intensity">Intensidad</Label>
            <span className="text-sm text-muted-foreground">{settings.intensity}%</span>
          </div>
          <Slider 
            id="intensity"
            min={10} 
            max={100} 
            step={5}
            value={[settings.intensity]} 
            onValueChange={(values) => setSettings({...settings, intensity: values[0]})}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Sutil</span>
            <span>Equilibrado</span>
            <span>Intenso</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transitions">Tipo de Transiciones</Label>
          <Select 
            value={settings.transitions} 
            onValueChange={(value) => setSettings({...settings, transitions: value})}
          >
            <SelectTrigger id="transitions">
              <SelectValue placeholder="Seleccionar transiciones" />
            </SelectTrigger>
            <SelectContent>
              {transitionTypes.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Movimientos de Cámara (Máx. 3)</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {cameraMovementOptions.map((movement) => {
              const isSelected = settings.cameraMovements?.includes(movement) || false;
              return (
                <Badge
                  key={movement}
                  variant={isSelected ? "default" : "outline"}
                  className={`cursor-pointer ${isSelected ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                  onClick={() => toggleCameraMovement(movement)}
                >
                  {movement}
                  {isSelected && <Check className="ml-1 h-3 w-3" />}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Los movimientos de cámara seleccionados: {settings.cameraMovements?.length || 0}/3
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-prompt">Instrucciones Personalizadas (Opcional)</Label>
          <Textarea 
            id="custom-prompt" 
            placeholder="Describe movimientos específicos que deseas ver..."
            value={settings.customPrompt}
            onChange={(e) => setSettings({...settings, customPrompt: e.target.value})}
            className="h-20"
          />
        </div>

        <div className="pt-2">
          <Button 
            onClick={handleApply} 
            className={`w-full ${isSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aplicando Movimientos...
              </>
            ) : isSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Movimientos Aplicados Correctamente
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Aplicar Movimientos a las Escenas
              </>
            )}
          </Button>
        </div>

        <div className="mt-4 p-3 bg-amber-100 rounded-md text-sm">
          <p className="flex items-start gap-2">
            <ThumbsUp className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Los movimientos se aplicarán a todas las escenas siguiendo la configuración de estilo y ritmo de la música, añadiendo dinamismo visual.</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}