/**
import { logger } from "../../lib/logger";
 * Camera Movements Component
 * 
 * Este componente permite al usuario configurar y aplicar movimientos de cámara
 * para la creación de videos musicales. Los movimientos de cámara son esenciales
 * para crear videos dinámicos y profesionales.
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Camera, Plus, Trash2, Edit3, VideoIcon, Save, RotateCcw } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useEditor } from '../../lib/context/editor-context';

interface CameraMovement {
  id?: string;
  name: string;
  type: 'pan' | 'zoom' | 'tilt' | 'dolly' | 'track';
  start: number;
  end: number;
  // Campos opcionales adicionales para compatibilidad con otras partes del código
  startTime?: number;
  duration?: number;
  parameters?: {
    intensity?: number;
    direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out';
    easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  };
}

interface CameraMovementsProps {
  audioDuration?: number;
  onComplete?: () => void;
}

/**
 * Formatea segundos a formato MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CameraMovements({ audioDuration = 180, onComplete }: CameraMovementsProps) {
  const { project, updateWorkflowData } = useEditor();
  const { toast } = useToast();
  
  // Movimientos de cámara guardados
  const [movements, setMovements] = useState<CameraMovement[]>(
    project.workflowData.cameraMovements || []
  );
  
  // Movimiento actual en edición
  const [currentMovement, setCurrentMovement] = useState<CameraMovement>({
    name: '',
    type: 'pan',
    start: 0,
    end: 10,
    parameters: {
      intensity: 50,
      direction: 'left',
      easing: 'linear'
    }
  });
  
  // Estado de edición
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Aplicar movimientos guardados al estado local al iniciar
  useEffect(() => {
    if (project.workflowData.cameraMovements?.length) {
      setMovements(project.workflowData.cameraMovements);
    }
  }, [project.workflowData.cameraMovements]);
  
  // Formatear tiempo para mostrar
  const formatTimeRange = (start: number, end: number) => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };
  
  // Obtener label descriptivo para el tipo de movimiento
  const getMovementTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'pan': 'Paneo',
      'zoom': 'Zoom',
      'tilt': 'Inclinación',
      'dolly': 'Avance/Retroceso',
      'track': 'Seguimiento'
    };
    return labels[type] || type;
  };
  
  // Guardar un nuevo movimiento
  const handleAddMovement = () => {
    if (!currentMovement.name) {
      toast({
        title: "Nombre requerido",
        description: "Por favor, asigna un nombre al movimiento",
        variant: "destructive"
      });
      return;
    }
    
    if (currentMovement.start >= currentMovement.end) {
      toast({
        title: "Rango inválido",
        description: "El tiempo de inicio debe ser menor que el tiempo final",
        variant: "destructive"
      });
      return;
    }
    
    // Si estamos editando, actualizar el movimiento existente
    if (editingIndex !== null) {
      const updatedMovements = [...movements];
      updatedMovements[editingIndex] = {...currentMovement};
      setMovements(updatedMovements);
      setEditingIndex(null);
      
      toast({
        title: "Movimiento actualizado",
        description: `El movimiento "${currentMovement.name}" ha sido actualizado`,
      });
    } else {
      // Agregar nuevo movimiento
      const newMovement = {
        ...currentMovement,
        id: `movement-${Date.now()}`
      };
      setMovements([...movements, newMovement]);
      
      toast({
        title: "Movimiento agregado",
        description: `El movimiento "${currentMovement.name}" ha sido agregado`,
      });
    }
    
    // Resetear el formulario
    setCurrentMovement({
      name: '',
      type: 'pan',
      start: 0,
      end: 10,
      parameters: {
        intensity: 50,
        direction: 'left',
        easing: 'linear'
      }
    });
  };
  
  // Eliminar un movimiento
  const handleDeleteMovement = (index: number) => {
    const updatedMovements = [...movements];
    const deletedName = updatedMovements[index].name;
    updatedMovements.splice(index, 1);
    setMovements(updatedMovements);
    
    toast({
      title: "Movimiento eliminado",
      description: `El movimiento "${deletedName}" ha sido eliminado`,
      variant: "default"
    });
    
    // Si estamos editando este movimiento, cancelar la edición
    if (editingIndex === index) {
      setEditingIndex(null);
      setCurrentMovement({
        name: '',
        type: 'pan',
        start: 0,
        end: 10,
        parameters: {
          intensity: 50,
          direction: 'left',
          easing: 'linear'
        }
      });
    }
  };
  
  // Editar un movimiento existente
  const handleEditMovement = (index: number) => {
    setEditingIndex(index);
    setCurrentMovement({...movements[index]});
  };
  
  // Guardar todos los movimientos en el editor context
  const handleSaveMovements = () => {
    updateWorkflowData({
      cameraMovements: movements
    });
    
    toast({
      title: "Movimientos guardados",
      description: `Se han guardado ${movements.length} movimientos de cámara`,
    });
    
    if (onComplete) {
      onComplete();
    }
  };
  
  // Obtener las opciones de dirección según el tipo de movimiento
  const getDirectionOptions = (type: string) => {
    switch (type) {
      case 'pan':
        return [
          { value: 'left', label: 'Izquierda' },
          { value: 'right', label: 'Derecha' }
        ];
      case 'tilt':
        return [
          { value: 'up', label: 'Arriba' },
          { value: 'down', label: 'Abajo' }
        ];
      case 'zoom':
      case 'dolly':
        return [
          { value: 'in', label: 'Acercamiento' },
          { value: 'out', label: 'Alejamiento' }
        ];
      default:
        return [
          { value: 'left', label: 'Izquierda' },
          { value: 'right', label: 'Derecha' }
        ];
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Camera className="h-5 w-5 mr-2 text-blue-600" />
            Movimientos de Cámara
          </CardTitle>
          <CardDescription>
            Agrega movimientos de cámara para dar vida a tu video musical
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Formulario para agregar/editar movimientos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Nombre</label>
                  <Input 
                    placeholder="Ej: Paneo inicial" 
                    value={currentMovement.name}
                    onChange={(e) => setCurrentMovement({...currentMovement, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Tipo de Movimiento</label>
                  <Select 
                    value={currentMovement.type}
                    onValueChange={(value: 'pan' | 'zoom' | 'tilt' | 'dolly' | 'track') => {
                      // Resetear la dirección al cambiar el tipo
                      const directions = getDirectionOptions(value);
                      setCurrentMovement({
                        ...currentMovement, 
                        type: value,
                        parameters: {
                          ...currentMovement.parameters,
                          direction: directions[0].value as any
                        }
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pan">Paneo (Horizontal)</SelectItem>
                      <SelectItem value="tilt">Inclinación (Vertical)</SelectItem>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="dolly">Avance/Retroceso</SelectItem>
                      <SelectItem value="track">Seguimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Dirección</label>
                  <Select 
                    value={currentMovement.parameters?.direction}
                    onValueChange={(value: 'left' | 'right' | 'up' | 'down' | 'in' | 'out') => {
                      setCurrentMovement({
                        ...currentMovement, 
                        parameters: {
                          ...currentMovement.parameters,
                          direction: value
                        }
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar dirección" />
                    </SelectTrigger>
                    <SelectContent>
                      {getDirectionOptions(currentMovement.type).map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Intensidad</label>
                  <div className="pt-2 px-1">
                    <Slider 
                      value={[currentMovement.parameters?.intensity || 50]}
                      min={10}
                      max={100}
                      step={5}
                      onValueChange={(values) => {
                        setCurrentMovement({
                          ...currentMovement, 
                          parameters: {
                            ...currentMovement.parameters,
                            intensity: values[0]
                          }
                        });
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Sutil</span>
                    <span>Moderada</span>
                    <span>Intensa</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Rango de tiempo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Rango de tiempo</label>
                <span className="text-sm text-muted-foreground">
                  {formatTimeRange(currentMovement.start, currentMovement.end)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Inicio (segundos)</label>
                  <Input 
                    type="number"
                    min={0}
                    max={audioDuration}
                    value={currentMovement.start}
                    onChange={(e) => setCurrentMovement({
                      ...currentMovement, 
                      start: parseFloat(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Fin (segundos)</label>
                  <Input 
                    type="number"
                    min={0}
                    max={audioDuration}
                    value={currentMovement.end}
                    onChange={(e) => setCurrentMovement({
                      ...currentMovement, 
                      end: parseFloat(e.target.value)
                    })}
                  />
                </div>
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex justify-end space-x-2 pt-2">
              <Button 
                variant="outline"
                onClick={() => {
                  setCurrentMovement({
                    name: '',
                    type: 'pan',
                    start: 0,
                    end: 10,
                    parameters: {
                      intensity: 50,
                      direction: 'left',
                      easing: 'linear'
                    }
                  });
                  setEditingIndex(null);
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reiniciar
              </Button>
              
              <Button 
                onClick={handleAddMovement}
                disabled={!currentMovement.name}
              >
                {editingIndex !== null ? (
                  <>
                    <Edit3 className="h-4 w-4 mr-1" />
                    Actualizar
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Lista de movimientos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Movimientos configurados</CardTitle>
          <CardDescription>
            {movements.length === 0 
              ? "Aún no has configurado movimientos de cámara" 
              : `${movements.length} movimientos configurados`}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {movements.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tiempo</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement, index) => (
                    <TableRow key={movement.id || index}>
                      <TableCell>{movement.name}</TableCell>
                      <TableCell>{getMovementTypeLabel(movement.type)}</TableCell>
                      <TableCell>{formatTimeRange(movement.start, movement.end)}</TableCell>
                      <TableCell>
                        {getDirectionOptions(movement.type).find(
                          o => o.value === movement.parameters?.direction
                        )?.label || movement.parameters?.direction}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditMovement(index)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteMovement(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <VideoIcon className="h-12 w-12 mb-2 opacity-20" />
              <p>No hay movimientos configurados</p>
              <p className="text-sm">Agrega movimientos de cámara para dar dinamismo a tu video</p>
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={handleSaveMovements}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={movements.length === 0}
            >
              <Save className="h-4 w-4 mr-1" />
              Guardar Movimientos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}