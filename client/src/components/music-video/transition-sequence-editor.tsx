import React, { useState, useEffect } from 'react';
import { logger } from "../../lib/logger";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Slider } from "../../components/ui/slider";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { Switch } from "../../components/ui/switch";
import { 
  ArrowLeftRight, 
  Layers, 
  ZoomIn, 
  Film, 
  Scissors, 
  ArrowRightIcon, 
  ArrowDownIcon,
  Sparkles
} from "lucide-react";
import { TransitionType } from "../../lib/professional-editor-types";

// Tipo para cada transición disponible
interface TransitionOption {
  id: string;
  name: string;
  type: TransitionType;
  icon: React.ReactNode;
  duration: number; // segundos
  previewUrl?: string; // URL para vista previa de la transición
  compatible: ('video' | 'image' | 'all')[]; // con qué tipos de medios es compatible
}

// Configuración para una transición específica
interface TransitionConfig {
  id: string;
  type: TransitionType;
  duration: number;
  options?: Record<string, any>; // opciones específicas del tipo de transición
  fromClipId?: string;
  toClipId?: string;
}

// Props del componente
interface TransitionSequenceEditorProps {
  availableTransitions?: TransitionOption[];
  activeTransitions: TransitionConfig[];
  onUpdateTransitions: (transitions: TransitionConfig[]) => void;
  onApplyToTimeline?: () => void;
  className?: string;
}

const DEFAULT_TRANSITIONS: TransitionOption[] = [
  {
    id: 'cut',
    name: 'Corte',
    type: 'cut',
    icon: <Scissors className="w-4 h-4" />,
    duration: 0,
    compatible: ['all']
  },
  {
    id: 'crossfade',
    name: 'Fundido cruzado',
    type: 'crossfade',
    icon: <Layers className="w-4 h-4" />,
    duration: 0.5,
    compatible: ['all']
  },
  {
    id: 'fade',
    name: 'Fundido',
    type: 'fade',
    icon: <Film className="w-4 h-4" />,
    duration: 0.8,
    compatible: ['all']
  },
  {
    id: 'slide',
    name: 'Deslizamiento',
    type: 'slide',
    icon: <ArrowRightIcon className="w-4 h-4" />,
    duration: 0.6,
    compatible: ['all']
  },
  {
    id: 'zoom',
    name: 'Zoom',
    type: 'zoom',
    icon: <ZoomIn className="w-4 h-4" />,
    duration: 0.75,
    compatible: ['all']
  },
  {
    id: 'dissolve',
    name: 'Disolución',
    type: 'dissolve',
    icon: <Sparkles className="w-4 h-4" />,
    duration: 1.0,
    compatible: ['all']
  }
];

/**
 * Editor de secuencia de transiciones para videos musicales
 * 
 * Permite configurar y previsualizar transiciones entre clips,
 * con opciones adaptadas para generar videos musicales profesionales.
 */
export function TransitionSequenceEditor({
  availableTransitions = DEFAULT_TRANSITIONS,
  activeTransitions,
  onUpdateTransitions,
  onApplyToTimeline,
  className = ""
}: TransitionSequenceEditorProps) {
  const [selectedTransitionIndex, setSelectedTransitionIndex] = useState<number>(-1);
  
  // Estado para las nuevas transiciones que se están configurando
  const [newTransition, setNewTransition] = useState<TransitionConfig>({
    id: '', // se generará al añadir
    type: 'crossfade',
    duration: 0.5
  });
  
  // Opciones específicas para ciertos tipos de transiciones
  const [slideDirection, setSlideDirection] = useState<string>("left");
  const [fadeColor, setFadeColor] = useState<string>("black");
  
  // Función para generar un ID único
  const generateId = () => `transition-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  
  // Función para añadir una nueva transición
  const addTransition = () => {
    const options: Record<string, any> = {};
    
    // Agregar opciones específicas según el tipo
    if (newTransition.type === 'slide') {
      options.direction = slideDirection;
    } else if (newTransition.type === 'fade') {
      options.color = fadeColor;
    }
    
    const transitionToAdd: TransitionConfig = {
      ...newTransition,
      id: generateId(),
      options
    };
    
    onUpdateTransitions([...activeTransitions, transitionToAdd]);
    
    // Restablecer los valores predeterminados
    setNewTransition({
      id: '',
      type: 'crossfade',
      duration: 0.5
    });
  };
  
  // Función para eliminar una transición
  const removeTransition = (index: number) => {
    const updatedTransitions = [...activeTransitions];
    updatedTransitions.splice(index, 1);
    onUpdateTransitions(updatedTransitions);
    
    if (selectedTransitionIndex === index) {
      setSelectedTransitionIndex(-1);
    } else if (selectedTransitionIndex > index) {
      setSelectedTransitionIndex(selectedTransitionIndex - 1);
    }
  };
  
  // Función para actualizar una propiedad de la transición
  const updateTransitionProperty = (index: number, property: string, value: any) => {
    const updatedTransitions = [...activeTransitions];
    
    if (property === 'type') {
      // Cuando cambia el tipo, configuramos la duración por defecto
      const defaultOption = availableTransitions.find(t => t.type === value);
      if (defaultOption) {
        updatedTransitions[index] = {
          ...updatedTransitions[index],
          type: value as TransitionType,
          duration: defaultOption.duration
        };
      }
    } else if (property === 'options') {
      updatedTransitions[index] = {
        ...updatedTransitions[index],
        options: {
          ...updatedTransitions[index].options,
          ...value
        }
      };
    } else {
      updatedTransitions[index] = {
        ...updatedTransitions[index],
        [property]: value
      };
    }
    
    onUpdateTransitions(updatedTransitions);
  };
  
  // Función para encontrar un icono de transición por tipo
  const getTransitionIcon = (type: TransitionType) => {
    const transition = availableTransitions.find(t => t.type === type);
    return transition?.icon || <ArrowLeftRight className="w-4 h-4" />;
  };

  return (
    <Card className={`border shadow-sm ${className}`}>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center">
          <ArrowLeftRight className="w-5 h-5 mr-2 text-pink-500" />
          Editor de Transiciones
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Sección para añadir nueva transición */}
        <div className="bg-muted/30 rounded-md p-3 border">
          <h3 className="text-sm font-medium mb-2">Agregar nueva transición</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transition-type" className="text-xs">Tipo</Label>
              <Select 
                value={newTransition.type}
                onValueChange={(value) => setNewTransition({
                  ...newTransition,
                  type: value as TransitionType,
                  duration: availableTransitions.find(t => t.type === value)?.duration || 0.5
                })}
              >
                <SelectTrigger id="transition-type" className="h-8 text-xs">
                  <SelectValue placeholder="Tipo de transición" />
                </SelectTrigger>
                <SelectContent>
                  {availableTransitions.map(transition => (
                    <SelectItem key={transition.id} value={transition.type} className="text-xs">
                      <div className="flex items-center">
                        <div className="mr-2">{transition.icon}</div>
                        {transition.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="transition-duration" className="text-xs">
                Duración: {newTransition.duration.toFixed(1)}s
              </Label>
              <Slider 
                id="transition-duration"
                min={0.1}
                max={2.0}
                step={0.1}
                value={[newTransition.duration]}
                onValueChange={([value]) => setNewTransition({
                  ...newTransition,
                  duration: value
                })}
                disabled={newTransition.type === 'cut'}
                className="py-2"
              />
            </div>
          </div>
          
          {/* Opciones específicas según el tipo de transición */}
          {newTransition.type === 'slide' && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <RadioGroup 
                value={slideDirection}
                onValueChange={setSlideDirection}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="left" id="slide-left" className="w-3 h-3" />
                  <Label htmlFor="slide-left" className="text-xs">Izquierda</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="right" id="slide-right" className="w-3 h-3" />
                  <Label htmlFor="slide-right" className="text-xs">Derecha</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="up" id="slide-up" className="w-3 h-3" />
                  <Label htmlFor="slide-up" className="text-xs">Arriba</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="down" id="slide-down" className="w-3 h-3" />
                  <Label htmlFor="slide-down" className="text-xs">Abajo</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          {newTransition.type === 'fade' && (
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Color</Label>
              <RadioGroup 
                value={fadeColor}
                onValueChange={setFadeColor}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="black" id="fade-black" className="w-3 h-3" />
                  <Label htmlFor="fade-black" className="text-xs">Negro</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="white" id="fade-white" className="w-3 h-3" />
                  <Label htmlFor="fade-white" className="text-xs">Blanco</Label>
                </div>
              </RadioGroup>
            </div>
          )}
          
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              onClick={addTransition}
              className="h-7 text-xs"
            >
              Agregar transición
            </Button>
          </div>
        </div>
        
        {/* Lista de transiciones activas */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Transiciones configuradas</h3>
          
          {activeTransitions.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm bg-muted/20 rounded-md border border-dashed">
              No hay transiciones configuradas.
              <div className="text-xs mt-1">
                Agrega una transición usando el formulario de arriba.
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTransitions.map((transition, index) => {
                const isSelected = selectedTransitionIndex === index;
                
                return (
                  <div
                    key={transition.id}
                    className={`
                      border rounded-md p-2 cursor-pointer transition-colors
                      ${isSelected 
                        ? 'bg-primary/5 border-primary' 
                        : 'hover:bg-muted/50'}
                    `}
                    onClick={() => setSelectedTransitionIndex(isSelected ? -1 : index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                          {getTransitionIcon(transition.type)}
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            {availableTransitions.find(t => t.type === transition.type)?.name || transition.type}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Duración: {transition.duration.toFixed(1)}s
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTransition(index);
                        }}
                      >
                        <Scissors className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Panel de edición expandido */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">
                            Duración: {transition.duration.toFixed(1)}s
                          </Label>
                          <Slider 
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            value={[transition.duration]}
                            onValueChange={([value]) => updateTransitionProperty(index, 'duration', value)}
                            disabled={transition.type === 'cut'}
                            className="py-2"
                          />
                        </div>
                        
                        {/* Opciones específicas según el tipo de transición */}
                        {transition.type === 'slide' && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Dirección</Label>
                            <RadioGroup 
                              value={transition.options?.direction || 'left'}
                              onValueChange={(value) => updateTransitionProperty(index, 'options', { direction: value })}
                              className="flex flex-wrap gap-3"
                            >
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="left" id={`slide-left-${index}`} className="w-3 h-3" />
                                <Label htmlFor={`slide-left-${index}`} className="text-xs">Izquierda</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="right" id={`slide-right-${index}`} className="w-3 h-3" />
                                <Label htmlFor={`slide-right-${index}`} className="text-xs">Derecha</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="up" id={`slide-up-${index}`} className="w-3 h-3" />
                                <Label htmlFor={`slide-up-${index}`} className="text-xs">Arriba</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="down" id={`slide-down-${index}`} className="w-3 h-3" />
                                <Label htmlFor={`slide-down-${index}`} className="text-xs">Abajo</Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                        
                        {transition.type === 'fade' && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Color</Label>
                            <RadioGroup 
                              value={transition.options?.color || 'black'}
                              onValueChange={(value) => updateTransitionProperty(index, 'options', { color: value })}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="black" id={`fade-black-${index}`} className="w-3 h-3" />
                                <Label htmlFor={`fade-black-${index}`} className="text-xs">Negro</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <RadioGroupItem value="white" id={`fade-white-${index}`} className="w-3 h-3" />
                                <Label htmlFor={`fade-white-${index}`} className="text-xs">Blanco</Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Configuración para aplicar transiciones al ritmo */}
        <div className="bg-muted/30 rounded-md p-3 border mt-4">
          <h3 className="text-sm font-medium mb-2 flex items-center">
            <Sparkles className="w-4 h-4 mr-1 text-pink-500" />
            Sincronización musical
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sync-to-beats" className="text-xs">Sincronizar con beats</Label>
                  <Switch id="sync-to-beats" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Aplica las transiciones en sincronía con los beats musicales
                </p>
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="match-energy" className="text-xs">Coincidir con energía</Label>
                  <Switch id="match-energy" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Adapta el estilo de transición según la energía de la música
                </p>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="transition-pattern" className="text-xs">Patrón de transición</Label>
              <Select defaultValue="alternate">
                <SelectTrigger id="transition-pattern" className="h-8 text-xs">
                  <SelectValue placeholder="Seleccionar patrón" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential" className="text-xs">Secuencial (en orden)</SelectItem>
                  <SelectItem value="alternate" className="text-xs">Alternado</SelectItem>
                  <SelectItem value="random" className="text-xs">Aleatorio</SelectItem>
                  <SelectItem value="energy-based" className="text-xs">Basado en energía</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between py-3 border-t bg-muted/50">
        <div className="text-xs text-muted-foreground">
          {activeTransitions.length} transiciones configuradas
        </div>
        
        <Button
          variant="default"
          size="sm"
          onClick={onApplyToTimeline}
          disabled={activeTransitions.length === 0}
        >
          Aplicar a Timeline
        </Button>
      </CardFooter>
    </Card>
  );
}