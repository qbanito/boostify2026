import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
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
  Slider
} from '../../components/ui/slider';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../../components/ui/dialog';
import {
  Switch
} from '../../components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../../components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../../components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '../../components/ui/alert-dialog';
import {
  Camera,
  Plus,
  Trash,
  Move,
  Play,
  Pause,
  Eye,
  EyeOff,
  Undo,
  Redo,
  Save,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  CornerLeftUp,
  CornerRightUp,
  CornerLeftDown,
  CornerRightDown,
  Maximize,
  Minimize,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { CameraMovement } from '../../lib/professional-editor-types';
import { v4 as uuidv4 } from 'uuid';
import { doc, collection, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CameraMovementEditorProps {
  cameraMovements: CameraMovement[];
  currentTime: number;
  duration: number;
  onAddMovement?: (movement: Omit<CameraMovement, 'id'>) => void;
  onUpdateMovement?: (id: string, updates: Partial<CameraMovement>) => void;
  onDeleteMovement?: (id: string) => void;
  onSeek?: (time: number) => void;
  projectId?: string;
}

// Opciones para el tipo de movimiento
const movementTypes = [
  { value: 'track', label: 'Tracking', icon: <ArrowRight className="h-4 w-4 mr-2" />, description: 'Movimiento lateral (izquierda/derecha)' },
  { value: 'zoom', label: 'Zoom', icon: <ZoomIn className="h-4 w-4 mr-2" />, description: 'Acercar o alejar la cámara' },
  { value: 'pan', label: 'Panorámica', icon: <RotateCw className="h-4 w-4 mr-2" />, description: 'Movimiento horizontal giratorio' },
  { value: 'tilt', label: 'Inclinación', icon: <ArrowUp className="h-4 w-4 mr-2" />, description: 'Movimiento vertical hacia arriba/abajo' },
  { value: 'dolly', label: 'Dolly', icon: <Move className="h-4 w-4 mr-2" />, description: 'Movimiento hacia adelante/atrás' }
];

// Colores para los tipos de movimiento
const movementTypeColors: Record<string, string> = {
  track: '#22c55e', // green-500
  zoom: '#3b82f6', // blue-500
  pan: '#f97316',  // orange-500
  tilt: '#ec4899',  // pink-500
  dolly: '#8b5cf6'  // violet-500
};

// Iconos para los tipos de movimiento
const MovementTypeIcon: React.FC<{ type: string }> = ({ type }) => {
  switch (type) {
    case 'track':
      return <ArrowRight className="h-4 w-4" />;
    case 'zoom':
      return <ZoomIn className="h-4 w-4" />;
    case 'pan':
      return <RotateCw className="h-4 w-4" />;
    case 'tilt':
      return <ArrowUp className="h-4 w-4" />;
    case 'dolly':
      return <Move className="h-4 w-4" />;
    default:
      return <Camera className="h-4 w-4" />;
  }
};

// Valores predeterminados para los parámetros según el tipo de movimiento
const getDefaultParameters = (type: string) => {
  switch (type) {
    case 'track':
      return { speed: 0.5, distance: 1.0 };
    case 'zoom':
      return { factor: 1.5, speed: 0.5 };
    case 'pan':
      return { angle: 45, speed: 0.5 };
    case 'tilt':
      return { angle: 30, speed: 0.5 };
    case 'dolly':
      return { distance: 2.0, speed: 0.5 };
    default:
      return {};
  }
};

const CameraMovementEditor: React.FC<CameraMovementEditorProps> = ({
  cameraMovements = [],
  currentTime,
  duration,
  onAddMovement,
  onUpdateMovement,
  onDeleteMovement,
  onSeek,
  projectId
}) => {
  // Estados
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('timeline');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [movementToDelete, setMovementToDelete] = useState<string | null>(null);
  const [movementFilter, setMovementFilter] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(true);
  const [newMovement, setNewMovement] = useState<Omit<CameraMovement, 'id'>>({
    name: '',
    type: 'zoom',
    startTime: currentTime,
    start: 1.0,
    end: 1.5,
    duration: 3,
    parameters: getDefaultParameters('zoom')
  });
  
  // Referencias
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Obtener el movimiento seleccionado
  const selectedMovement = cameraMovements.find(m => m.id === selectedMovementId) || null;
  
  // Calcular movimientos filtrados
  const filteredMovements = movementFilter
    ? cameraMovements.filter(m => m.type === movementFilter)
    : cameraMovements;
  
  // Ordenar por tiempo de inicio
  const sortedMovements = [...filteredMovements].sort((a, b) => a.startTime - b.startTime);
  
  // Formatear tiempo (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Obtener la posición en línea de tiempo
  const timeToPosition = (time: number): number => {
    return (time / duration) * 100;
  };
  
  // Manejar cambio en tipo de movimiento
  const handleMovementTypeChange = (type: 'track' | 'zoom' | 'pan' | 'tilt' | 'dolly') => {
    setNewMovement({
      ...newMovement,
      type,
      parameters: getDefaultParameters(type)
    });
  };
  
  // Añadir nuevo movimiento
  const handleAddMovement = async () => {
    if (!onAddMovement) return;
    
    const movementId = uuidv4();
    onAddMovement(newMovement);
    
    // Si hay un ID de proyecto, guardar en Firestore
    if (projectId) {
      setIsSaving(true);
      try {
        const movementRef = doc(db, `projects/${projectId}/cameraMovements/${movementId}`);
        await setDoc(movementRef, {
          ...newMovement,
          createdAt: new Date()
        });
      } catch (error) {
        console.error("Error al guardar movimiento de cámara:", error);
      } finally {
        setIsSaving(false);
      }
    }
    
    // Resetear formulario
    setNewMovement({
      name: '',
      type: 'zoom',
      startTime: currentTime,
      start: 1.0,
      end: 1.5,
      duration: 3,
      parameters: getDefaultParameters('zoom')
    });
    
    setShowAddDialog(false);
  };
  
  // Actualizar movimiento existente
  const handleUpdateMovement = async (id: string, updates: Partial<CameraMovement>) => {
    if (!onUpdateMovement) return;
    
    onUpdateMovement(id, updates);
    
    // Si hay un ID de proyecto, actualizar en Firestore
    if (projectId) {
      setIsSaving(true);
      try {
        const movementRef = doc(db, `projects/${projectId}/cameraMovements/${id}`);
        await updateDoc(movementRef, {
          ...updates,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error("Error al actualizar movimiento de cámara:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };
  
  // Eliminar movimiento
  const handleDeleteMovement = async (id: string) => {
    if (!onDeleteMovement) return;
    
    onDeleteMovement(id);
    
    // Si hay un ID de proyecto, eliminar de Firestore
    if (projectId) {
      setIsSaving(true);
      try {
        const movementRef = doc(db, `projects/${projectId}/cameraMovements/${id}`);
        await deleteDoc(movementRef);
      } catch (error) {
        console.error("Error al eliminar movimiento de cámara:", error);
      } finally {
        setIsSaving(false);
      }
    }
    
    if (id === selectedMovementId) {
      setSelectedMovementId(null);
    }
    
    setMovementToDelete(null);
    setShowDeleteConfirm(false);
  };
  
  // Manejar clic en la línea de tiempo
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !onSeek) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const percentage = offsetX / rect.width;
    
    onSeek(percentage * duration);
  };
  
  // Obtener rango de uso para un parámetro según el tipo
  const getParameterRange = (type: string, param: string): { min: number, max: number, step: number } => {
    switch (type) {
      case 'zoom':
        if (param === 'factor') return { min: 0.5, max: 5, step: 0.1 };
        if (param === 'speed') return { min: 0.1, max: 2, step: 0.1 };
        break;
      case 'track':
      case 'dolly':
        if (param === 'distance') return { min: 0.1, max: 10, step: 0.1 };
        if (param === 'speed') return { min: 0.1, max: 2, step: 0.1 };
        break;
      case 'pan':
      case 'tilt':
        if (param === 'angle') return { min: -180, max: 180, step: 1 };
        if (param === 'speed') return { min: 0.1, max: 2, step: 0.1 };
        break;
    }
    
    return { min: 0, max: 10, step: 0.1 };
  };
  
  // Obtener movimientos activos en el tiempo actual
  const getActiveMovements = () => {
    return cameraMovements.filter(
      movement => 
        currentTime >= movement.startTime && 
        currentTime <= movement.startTime + movement.duration
    );
  };

  // Obtener una descripción legible del movimiento
  const getMovementDescription = (movement: CameraMovement): string => {
    switch (movement.type) {
      case 'zoom':
        const zoomDirection = movement.end > movement.start ? 'acercamiento' : 'alejamiento';
        return `${zoomDirection} con factor ${Math.abs(movement.end - movement.start).toFixed(1)}`;
      case 'track':
        const trackDirection = movement.end > movement.start ? 'derecha' : 'izquierda';
        return `movimiento lateral hacia ${trackDirection}`;
      case 'pan':
        const panDirection = movement.end > movement.start ? 'derecha' : 'izquierda';
        return `panorámica hacia ${panDirection} (${Math.abs(movement.end - movement.start).toFixed(0)}°)`;
      case 'tilt':
        const tiltDirection = movement.end > movement.start ? 'arriba' : 'abajo';
        return `inclinación hacia ${tiltDirection} (${Math.abs(movement.end - movement.start).toFixed(0)}°)`;
      case 'dolly':
        const dollyDirection = movement.end > movement.start ? 'adelante' : 'atrás';
        return `movimiento hacia ${dollyDirection}`;
      default:
        return 'movimiento de cámara';
    }
  };
  
  // Renderizar el marcador de tiempo actual
  const renderCurrentTimeMarker = () => {
    return (
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-10 pointer-events-none"
        style={{ left: `${timeToPosition(currentTime)}%` }}
      >
        <div className="w-3 h-3 bg-orange-500 rounded-full -ml-1.5 -mt-1"></div>
      </div>
    );
  };
  
  // Renderizar etiquetas de tiempo
  const renderTimeLabels = () => {
    const numLabels = 11; // 0%, 10%, 20%, ..., 100%
    
    return Array.from({ length: numLabels }).map((_, index) => {
      const position = index / (numLabels - 1) * 100;
      const time = (position / 100) * duration;
      
      return (
        <div
          key={`time-${index}`}
          className="absolute top-0 text-xs text-gray-500"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          <div className="h-2 border-l border-gray-300 dark:border-gray-700 mb-1"></div>
          {formatTime(time)}
        </div>
      );
    });
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <Camera className="h-5 w-5 mr-2 text-orange-500" />
            Movimientos de Cámara
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Select
              value={movementFilter || "all"}
              onValueChange={(value) => setMovementFilter(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {movementTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center">
                      {type.icon}
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={previewEnabled ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewEnabled(!previewEnabled)}
                    className="h-8 w-8 p-0"
                  >
                    {previewEnabled ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{previewEnabled ? "Desactivar vista previa" : "Activar vista previa"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start p-0 rounded-none border-b">
            <TabsTrigger value="timeline" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Línea de Tiempo
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Lista
            </TabsTrigger>
            <TabsTrigger value="active" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Activos
            </TabsTrigger>
          </TabsList>
          
          {/* Vista de línea de tiempo */}
          <TabsContent value="timeline" className="min-h-[200px]">
            <div className="relative p-4 pt-8 border-t border-b min-h-[200px]">
              {/* Marcadores de tiempo */}
              <div className="absolute left-0 right-0 top-0 h-6 flex px-4">
                {renderTimeLabels()}
              </div>
              
              {/* Contenedor de la línea de tiempo */}
              <div 
                ref={timelineRef}
                className="relative h-[180px] mt-6"
                onClick={handleTimelineClick}
              >
                {/* Visualización de movimientos */}
                {sortedMovements.map((movement, index) => (
                  <div 
                    key={movement.id}
                    className={cn(
                      "absolute h-10 rounded-md border-2 cursor-pointer transition-all",
                      selectedMovementId === movement.id && "ring-2 ring-blue-500 dark:ring-blue-700",
                      currentTime >= movement.startTime && 
                      currentTime <= movement.startTime + movement.duration && 
                      "border-white dark:border-white"
                    )}
                    style={{
                      left: `${timeToPosition(movement.startTime)}%`,
                      width: `${timeToPosition(movement.startTime + movement.duration) - timeToPosition(movement.startTime)}%`,
                      top: `${(index % 4) * 40}px`,
                      backgroundColor: `${movementTypeColors[movement.type]}80`,
                      borderColor: movementTypeColors[movement.type]
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMovementId(movement.id);
                    }}
                  >
                    <div className="absolute inset-0 flex items-center px-2 text-sm font-medium">
                      <MovementTypeIcon type={movement.type} />
                      <span className="ml-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        {movement.name || getMovementDescription(movement)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Marcador de tiempo actual */}
                {renderCurrentTimeMarker()}
                
                {/* Mensaje si no hay movimientos */}
                {sortedMovements.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No hay movimientos de cámara</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddDialog(true)}
                        className="mt-4"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Añadir movimiento
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Vista de lista */}
          <TabsContent value="list">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Tipo</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[120px]">Tiempo</TableHead>
                    <TableHead className="w-[120px]">Duración</TableHead>
                    <TableHead className="w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-40">
                        <div className="text-center text-gray-500">
                          <Camera className="h-12 w-12 mx-auto mb-2 opacity-20" />
                          <p>No hay movimientos de cámara</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAddDialog(true)}
                            className="mt-4"
                          >
                            <Plus className="h-4 w-4 mr-1" /> Añadir movimiento
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedMovements.map(movement => (
                      <TableRow 
                        key={movement.id}
                        className={cn(
                          selectedMovementId === movement.id && "bg-gray-50 dark:bg-gray-900",
                          currentTime >= movement.startTime && 
                          currentTime <= movement.startTime + movement.duration && 
                          "bg-orange-50 dark:bg-orange-900/20"
                        )}
                        onClick={() => setSelectedMovementId(movement.id)}
                      >
                        <TableCell>
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center" 
                            style={{ backgroundColor: movementTypeColors[movement.type] }}
                          >
                            <MovementTypeIcon type={movement.type} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {movement.name || movementTypes.find(t => t.value === movement.type)?.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {getMovementDescription(movement)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            size="sm"
                            className="h-6 p-0 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeek && onSeek(movement.startTime);
                            }}
                          >
                            {formatTime(movement.startTime)}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {movement.duration.toFixed(1)}s
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Clonar el movimiento con nuevos valores
                                if (onAddMovement) {
                                  const { id, ...rest } = movement;
                                  onAddMovement({
                                    ...rest,
                                    name: `${rest.name || movementTypes.find(t => t.value === rest.type)?.label} (copia)`,
                                    startTime: Math.min(rest.startTime + rest.duration, duration - rest.duration)
                                  });
                                }
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMovementToDelete(movement.id);
                                setShowDeleteConfirm(true);
                              }}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          
          {/* Vista de movimientos activos */}
          <TabsContent value="active">
            <div className="border-t">
              {getActiveMovements().length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No hay movimientos activos en este momento</p>
                  <p className="text-sm mt-1">
                    Tiempo actual: {formatTime(currentTime)}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {getActiveMovements().map(movement => (
                    <div 
                      key={movement.id}
                      className={cn(
                        "p-4",
                        selectedMovementId === movement.id && "bg-gray-50 dark:bg-gray-900"
                      )}
                    >
                      <div className="flex items-start">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0" 
                          style={{ backgroundColor: movementTypeColors[movement.type] }}
                        >
                          <MovementTypeIcon type={movement.type} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="font-medium text-lg flex items-center">
                            {movement.name || movementTypes.find(t => t.value === movement.type)?.label}
                            
                            <span className="text-sm font-normal ml-2 text-gray-500">
                              {formatTime(movement.startTime)} - {formatTime(movement.startTime + movement.duration)}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                            {getMovementDescription(movement)}
                          </div>
                          
                          {/* Barra de progreso */}
                          <div className="mt-3 relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="absolute top-0 left-0 h-full rounded-full" 
                              style={{ 
                                backgroundColor: movementTypeColors[movement.type],
                                width: `${((currentTime - movement.startTime) / movement.duration) * 100}%`
                              }}
                            ></div>
                          </div>
                          
                          {/* Controles */}
                          <div className="mt-3 flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedMovementId(movement.id)}
                              className="text-xs h-7"
                            >
                              <Settings className="h-3.5 w-3.5 mr-1" /> Editar
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSeek && onSeek(movement.startTime)}
                              className="text-xs h-7"
                            >
                              <Play className="h-3.5 w-3.5 mr-1" /> Ir al inicio
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 text-xs text-gray-500">
        <div>
          {cameraMovements.length} movimientos totales • {getActiveMovements().length} activos
        </div>
        <div>
          {isSaving && "Guardando..."}
        </div>
      </CardFooter>
      
      {/* Panel de detalles del movimiento seleccionado */}
      {selectedMovement && (
        <div className="border-t p-4">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center mr-3" 
                style={{ backgroundColor: movementTypeColors[selectedMovement.type] }}
              >
                <MovementTypeIcon type={selectedMovement.type} />
              </div>
              
              <div>
                <h3 className="font-medium text-lg">
                  {selectedMovement.name || movementTypes.find(t => t.value === selectedMovement.type)?.label}
                </h3>
                <p className="text-sm text-gray-500">
                  {formatTime(selectedMovement.startTime)} - {formatTime(selectedMovement.startTime + selectedMovement.duration)}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSeek && onSeek(selectedMovement.startTime)}
              >
                <Play className="h-4 w-4 mr-1" /> Reproducir
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setMovementToDelete(selectedMovement.id);
                  setShowDeleteConfirm(true);
                }}
              >
                <Trash className="h-4 w-4 mr-1" /> Eliminar
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="movement-name">Nombre</Label>
                <Input
                  id="movement-name"
                  value={selectedMovement.name || ''}
                  onChange={(e) => handleUpdateMovement(selectedMovement.id, { name: e.target.value })}
                  placeholder={movementTypes.find(t => t.value === selectedMovement.type)?.label || 'Movimiento'}
                />
              </div>
              
              <div>
                <Label htmlFor="movement-type">Tipo</Label>
                <Select
                  value={selectedMovement.type}
                  onValueChange={(value: 'track' | 'zoom' | 'pan' | 'tilt' | 'dolly') => {
                    handleUpdateMovement(selectedMovement.id, { 
                      type: value,
                      parameters: getDefaultParameters(value)
                    });
                  }}
                >
                  <SelectTrigger id="movement-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {movementTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          {type.icon}
                          <span className="ml-2">{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {movementTypes.find(t => t.value === selectedMovement.type)?.description}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <Label>Tiempo de inicio</Label>
                <div className="flex items-center">
                  <Input
                    type="number"
                    value={selectedMovement.startTime}
                    onChange={(e) => handleUpdateMovement(selectedMovement.id, { 
                      startTime: Math.max(0, Math.min(duration - selectedMovement.duration, parseFloat(e.target.value))) 
                    })}
                    min={0}
                    max={duration - selectedMovement.duration}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    className="ml-2"
                    onClick={() => handleUpdateMovement(selectedMovement.id, { startTime: currentTime })}
                  >
                    Actual
                  </Button>
                </div>
              </div>
              
              <div>
                <Label>Duración (segundos)</Label>
                <Input
                  type="number"
                  value={selectedMovement.duration}
                  onChange={(e) => handleUpdateMovement(selectedMovement.id, { 
                    duration: Math.max(0.1, Math.min(duration - selectedMovement.startTime, parseFloat(e.target.value))) 
                  })}
                  min={0.1}
                  max={duration - selectedMovement.startTime}
                  step={0.1}
                />
              </div>
            </div>
          </div>
          
          {/* Parámetros específicos del tipo de movimiento */}
          <div className="mt-4">
            <h4 className="font-medium mb-2">Parámetros</h4>
            
            <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
              {selectedMovement.type === 'zoom' && (
                <>
                  <div className="space-y-2">
                    <Label>Factor de zoom</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {selectedMovement.start.toFixed(1)}</span>
                        <span className="text-xs">Fin: {selectedMovement.end.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ZoomOut className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[selectedMovement.start, selectedMovement.end]}
                          min={0.5}
                          max={5}
                          step={0.1}
                          onValueChange={([start, end]) => handleUpdateMovement(selectedMovement.id, { start, end })}
                        />
                        <ZoomIn className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Velocidad</Label>
                    <Slider
                      value={[selectedMovement.parameters?.speed || 0.5]}
                      min={0.1}
                      max={2}
                      step={0.1}
                      onValueChange={([speed]) => handleUpdateMovement(selectedMovement.id, { 
                        parameters: { ...selectedMovement.parameters, speed } 
                      })}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Lento</span>
                      <span>Rápido</span>
                    </div>
                  </div>
                </>
              )}
              
              {selectedMovement.type === 'track' && (
                <>
                  <div className="space-y-2">
                    <Label>Posición</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {selectedMovement.start.toFixed(1)}</span>
                        <span className="text-xs">Fin: {selectedMovement.end.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowLeft className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[selectedMovement.start, selectedMovement.end]}
                          min={-5}
                          max={5}
                          step={0.1}
                          onValueChange={([start, end]) => handleUpdateMovement(selectedMovement.id, { start, end })}
                        />
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Distancia y velocidad</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Distancia</Label>
                        <Input
                          type="number"
                          value={selectedMovement.parameters?.distance || 1.0}
                          onChange={(e) => handleUpdateMovement(selectedMovement.id, { 
                            parameters: { 
                              ...selectedMovement.parameters, 
                              distance: parseFloat(e.target.value) 
                            } 
                          })}
                          min={0.1}
                          max={10}
                          step={0.1}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Velocidad</Label>
                        <Input
                          type="number"
                          value={selectedMovement.parameters?.speed || 0.5}
                          onChange={(e) => handleUpdateMovement(selectedMovement.id, { 
                            parameters: { 
                              ...selectedMovement.parameters, 
                              speed: parseFloat(e.target.value) 
                            } 
                          })}
                          min={0.1}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {selectedMovement.type === 'pan' && (
                <>
                  <div className="space-y-2">
                    <Label>Ángulo</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {selectedMovement.start.toFixed(0)}°</span>
                        <span className="text-xs">Fin: {selectedMovement.end.toFixed(0)}°</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RotateCcw className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[selectedMovement.start, selectedMovement.end]}
                          min={-180}
                          max={180}
                          step={1}
                          onValueChange={([start, end]) => handleUpdateMovement(selectedMovement.id, { start, end })}
                        />
                        <RotateCw className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Velocidad de rotación</Label>
                    <Slider
                      value={[selectedMovement.parameters?.speed || 0.5]}
                      min={0.1}
                      max={2}
                      step={0.1}
                      onValueChange={([speed]) => handleUpdateMovement(selectedMovement.id, { 
                        parameters: { ...selectedMovement.parameters, speed } 
                      })}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Lento</span>
                      <span>Rápido</span>
                    </div>
                  </div>
                </>
              )}
              
              {selectedMovement.type === 'tilt' && (
                <>
                  <div className="space-y-2">
                    <Label>Ángulo</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {selectedMovement.start.toFixed(0)}°</span>
                        <span className="text-xs">Fin: {selectedMovement.end.toFixed(0)}°</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[selectedMovement.start, selectedMovement.end]}
                          min={-90}
                          max={90}
                          step={1}
                          onValueChange={([start, end]) => handleUpdateMovement(selectedMovement.id, { start, end })}
                        />
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Velocidad de inclinación</Label>
                    <Slider
                      value={[selectedMovement.parameters?.speed || 0.5]}
                      min={0.1}
                      max={2}
                      step={0.1}
                      onValueChange={([speed]) => handleUpdateMovement(selectedMovement.id, { 
                        parameters: { ...selectedMovement.parameters, speed } 
                      })}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Lento</span>
                      <span>Rápido</span>
                    </div>
                  </div>
                </>
              )}
              
              {selectedMovement.type === 'dolly' && (
                <>
                  <div className="space-y-2">
                    <Label>Posición</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {selectedMovement.start.toFixed(1)}</span>
                        <span className="text-xs">Fin: {selectedMovement.end.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[selectedMovement.start, selectedMovement.end]}
                          min={-5}
                          max={5}
                          step={0.1}
                          onValueChange={([start, end]) => handleUpdateMovement(selectedMovement.id, { start, end })}
                        />
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Distancia y velocidad</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Distancia</Label>
                        <Input
                          type="number"
                          value={selectedMovement.parameters?.distance || 2.0}
                          onChange={(e) => handleUpdateMovement(selectedMovement.id, { 
                            parameters: { 
                              ...selectedMovement.parameters, 
                              distance: parseFloat(e.target.value) 
                            } 
                          })}
                          min={0.1}
                          max={10}
                          step={0.1}
                        />
                      </div>
                      
                      <div>
                        <Label className="text-xs">Velocidad</Label>
                        <Input
                          type="number"
                          value={selectedMovement.parameters?.speed || 0.5}
                          onChange={(e) => handleUpdateMovement(selectedMovement.id, { 
                            parameters: { 
                              ...selectedMovement.parameters, 
                              speed: parseFloat(e.target.value) 
                            } 
                          })}
                          min={0.1}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Dialog para añadir nuevo movimiento */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir movimiento de cámara</DialogTitle>
            <DialogDescription>
              Configura los parámetros del movimiento y haz clic en añadir.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-movement-name">Nombre (opcional)</Label>
                <Input
                  id="new-movement-name"
                  value={newMovement.name}
                  onChange={(e) => setNewMovement({ ...newMovement, name: e.target.value })}
                  placeholder="Ej: Zoom inicial"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-movement-type">Tipo de movimiento</Label>
                <Select
                  value={newMovement.type}
                  onValueChange={(value: 'track' | 'zoom' | 'pan' | 'tilt' | 'dolly') => 
                    handleMovementTypeChange(value)
                  }
                >
                  <SelectTrigger id="new-movement-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {movementTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          {type.icon}
                          <span className="ml-2">{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {movementTypes.find(t => t.value === newMovement.type)?.description}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-movement-start-time">Tiempo de inicio (s)</Label>
                <div className="flex items-center">
                  <Input
                    id="new-movement-start-time"
                    type="number"
                    value={newMovement.startTime}
                    onChange={(e) => setNewMovement({ 
                      ...newMovement, 
                      startTime: Math.max(0, Math.min(duration - newMovement.duration, parseFloat(e.target.value)))
                    })}
                    min={0}
                    max={duration - newMovement.duration}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewMovement({ ...newMovement, startTime: currentTime })}
                    className="ml-2"
                  >
                    Actual
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-movement-duration">Duración (s)</Label>
                <Input
                  id="new-movement-duration"
                  type="number"
                  value={newMovement.duration}
                  onChange={(e) => setNewMovement({ 
                    ...newMovement, 
                    duration: Math.max(0.1, Math.min(duration - newMovement.startTime, parseFloat(e.target.value)))
                  })}
                  min={0.1}
                  max={duration - newMovement.startTime}
                  step={0.1}
                />
              </div>
            </div>
            
            {/* Parámetros específicos según el tipo de movimiento */}
            <div className="space-y-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
              <h4 className="font-medium">Parámetros</h4>
              
              {newMovement.type === 'zoom' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Factor de zoom</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {newMovement.start.toFixed(1)}</span>
                        <span className="text-xs">Fin: {newMovement.end.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ZoomOut className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[newMovement.start, newMovement.end]}
                          min={0.5}
                          max={5}
                          step={0.1}
                          onValueChange={([start, end]) => setNewMovement({ ...newMovement, start, end })}
                        />
                        <ZoomIn className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {newMovement.type === 'track' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Posición</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {newMovement.start.toFixed(1)}</span>
                        <span className="text-xs">Fin: {newMovement.end.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowLeft className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[newMovement.start, newMovement.end]}
                          min={-5}
                          max={5}
                          step={0.1}
                          onValueChange={([start, end]) => setNewMovement({ ...newMovement, start, end })}
                        />
                        <ArrowRight className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {newMovement.type === 'pan' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Ángulo</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {newMovement.start.toFixed(0)}°</span>
                        <span className="text-xs">Fin: {newMovement.end.toFixed(0)}°</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RotateCcw className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[newMovement.start, newMovement.end]}
                          min={-180}
                          max={180}
                          step={1}
                          onValueChange={([start, end]) => setNewMovement({ ...newMovement, start, end })}
                        />
                        <RotateCw className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {newMovement.type === 'tilt' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Ángulo</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {newMovement.start.toFixed(0)}°</span>
                        <span className="text-xs">Fin: {newMovement.end.toFixed(0)}°</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[newMovement.start, newMovement.end]}
                          min={-90}
                          max={90}
                          step={1}
                          onValueChange={([start, end]) => setNewMovement({ ...newMovement, start, end })}
                        />
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {newMovement.type === 'dolly' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Posición</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Inicio: {newMovement.start.toFixed(1)}</span>
                        <span className="text-xs">Fin: {newMovement.end.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                        <Slider
                          value={[newMovement.start, newMovement.end]}
                          min={-5}
                          max={5}
                          step={0.1}
                          onValueChange={([start, end]) => setNewMovement({ ...newMovement, start, end })}
                        />
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddMovement}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Añadir movimiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El movimiento será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setMovementToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (movementToDelete) {
                  handleDeleteMovement(movementToDelete);
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default CameraMovementEditor;