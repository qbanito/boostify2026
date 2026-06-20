import React, { useState } from 'react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../../components/ui/tabs';
import {
  Slider
} from '../../components/ui/slider';
import {
  Input
} from '../../components/ui/input';
import {
  Label
} from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../../components/ui/select';
import {
  Wand2 as MagicWand, // Usando Wand2 como reemplazo de MagicWand
  Plus,
  Trash,
  Edit,
  Play,
  Layers,
  Filter,
  LayoutGrid,
  List,
  Sparkles,
  BarChart,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { VisualEffect } from '../../lib/professional-editor-types';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface EffectsPanelProps {
  effects: VisualEffect[];
  currentTime: number;
  duration: number;
  onAddEffect?: (effect: Omit<VisualEffect, 'id'>) => void;
  onUpdateEffect?: (id: string, updates: Partial<VisualEffect>) => void;
  onDeleteEffect?: (id: string) => void;
  onSeek?: (time: number) => void;
  projectId?: string;
}

// Tipos de efectos disponibles
const effectTypes = [
  { 
    value: 'filter', 
    label: 'Filtro', 
    icon: <Filter className="h-4 w-4 mr-2" />,
    description: 'Aplica filtros visuales como sepia, blanco y negro, etc.'
  },
  { 
    value: 'overlay', 
    label: 'Superposición', 
    icon: <Layers className="h-4 w-4 mr-2" />,
    description: 'Superpone elementos como viñetas, marcas de agua, etc.'
  },
  { 
    value: 'transition', 
    label: 'Transición', 
    icon: <LayoutGrid className="h-4 w-4 mr-2" />,
    description: 'Aplica transiciones entre clips como fundidos, disoluciones, etc.'
  },
  { 
    value: 'zoom', 
    label: 'Zoom', 
    icon: <MagicWand className="h-4 w-4 mr-2" />,
    description: 'Aplica efectos de acercamiento o alejamiento'
  },
  { 
    value: 'crop', 
    label: 'Recorte', 
    icon: <Sparkles className="h-4 w-4 mr-2" />,
    description: 'Recorta o reencuadra el contenido visual'
  },
  { 
    value: 'blur', 
    label: 'Desenfoque', 
    icon: <BarChart className="h-4 w-4 mr-2" />,
    description: 'Aplica efectos de desenfoque o nitidez'
  },
  { 
    value: 'custom', 
    label: 'Personalizado', 
    icon: <MagicWand className="h-4 w-4 mr-2" />,
    description: 'Efecto personalizado definido por el usuario'
  }
];

// Colores para cada tipo de efecto
const effectColors: Record<string, string> = {
  filter: '#f43f5e',       // rose-500
  overlay: '#f59e0b',      // amber-500
  transition: '#3b82f6',   // blue-500
  zoom: '#8b5cf6',         // violet-500
  crop: '#10b981',         // emerald-500
  blur: '#6366f1',         // indigo-500
  custom: '#64748b'        // slate-500
};

const EffectsPanel: React.FC<EffectsPanelProps> = ({
  effects = [],
  currentTime,
  duration,
  onAddEffect,
  onUpdateEffect,
  onDeleteEffect,
  onSeek,
  projectId
}) => {
  // Estados
  const [activeTab, setActiveTab] = useState<string>('effects');
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Nuevo efecto
  const [newEffect, setNewEffect] = useState<Omit<VisualEffect, 'id'>>({
    name: '',
    type: 'filter',
    startTime: currentTime,
    duration: 5,
    intensity: 0.5,
    parameters: {},
  });
  
  // Formatear tiempo (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Calcular posición en línea de tiempo
  const timeToPosition = (time: number): number => {
    return (time / duration) * 100;
  };
  
  // Encontrar efectos activos en el tiempo actual
  const getActiveEffects = (): VisualEffect[] => {
    return effects.filter(
      effect => currentTime >= effect.startTime && currentTime < (effect.startTime + effect.duration)
    );
  };
  
  // Manejar añadir efecto
  const handleAddEffect = async () => {
    if (!onAddEffect) return;
    
    setIsSaving(true);
    
    // Añadir al estado local
    onAddEffect(newEffect);
    
    // Guardar en Firestore si hay projectId
    if (projectId) {
      try {
        const effectId = uuidv4();
        const effectRef = doc(db, `projects/${projectId}/effects/${effectId}`);
        await setDoc(effectRef, {
          ...newEffect,
          createdAt: new Date()
        });
      } catch (error) {
        console.error("Error al guardar efecto:", error);
      }
    }
    
    // Resetear formulario
    setNewEffect({
      name: '',
      type: 'filter',
      startTime: currentTime,
      duration: 5,
      intensity: 0.5,
      parameters: {}
    });
    
    setShowAddDialog(false);
    setIsSaving(false);
  };
  
  // Manejar actualización de efecto
  const handleUpdateEffect = async (id: string, updates: Partial<VisualEffect>) => {
    if (!onUpdateEffect) return;
    
    setIsSaving(true);
    
    // Actualizar en estado local
    onUpdateEffect(id, updates);
    
    // Actualizar en Firestore si hay projectId
    if (projectId) {
      try {
        const effectRef = doc(db, `projects/${projectId}/effects/${id}`);
        await updateDoc(effectRef, {
          ...updates,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error("Error al actualizar efecto:", error);
      }
    }
    
    setIsSaving(false);
  };
  
  // Manejar eliminación de efecto
  const handleDeleteEffect = async (id: string) => {
    if (!onDeleteEffect) return;
    
    setIsSaving(true);
    
    // Eliminar del estado local
    onDeleteEffect(id);
    
    // Eliminar de Firestore si hay projectId
    if (projectId) {
      try {
        const effectRef = doc(db, `projects/${projectId}/effects/${id}`);
        await deleteDoc(effectRef);
      } catch (error) {
        console.error("Error al eliminar efecto:", error);
      }
    }
    
    // Si era el efecto seleccionado, deseleccionar
    if (id === selectedEffectId) {
      setSelectedEffectId(null);
    }
    
    setIsSaving(false);
  };
  
  // Renderizar efectos en modo cuadrícula
  const renderEffectsGrid = () => {
    if (effects.length === 0) {
      return (
        <div className="py-10 text-center text-gray-500">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No hay efectos visuales</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-1" /> Añadir efecto
          </Button>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
        {effects.map(effect => (
          <div
            key={effect.id}
            className={cn(
              "border rounded-md p-3 cursor-pointer transition-all hover:border-gray-400",
              selectedEffectId === effect.id && "border-blue-500 bg-blue-50 dark:bg-blue-900/20",
              currentTime >= effect.startTime && 
              currentTime < (effect.startTime + effect.duration) && 
              "bg-orange-50 dark:bg-orange-900/20"
            )}
            onClick={() => setSelectedEffectId(effect.id)}
          >
            <div className="flex items-center justify-between mb-1">
              <div 
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: effectColors[effect.type] }}
              >
                {effectTypes.find(t => t.value === effect.type)?.icon}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSeek) onSeek(effect.startTime);
                }}
                className="h-6 w-6 p-0"
              >
                <Play className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="text-sm font-medium truncate">
              {effect.name || effectTypes.find(t => t.value === effect.type)?.label}
            </div>
            
            <div className="text-xs text-gray-500 mt-1">
              {formatTime(effect.startTime)} - {formatTime(effect.startTime + effect.duration)}
            </div>
            
            <div className="flex space-x-1 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewEffect({
                    ...effect,
                    name: effect.name || ''
                  });
                  setShowAddDialog(true);
                }}
                className="h-7 p-0 text-xs flex-1"
              >
                <Edit className="h-3 w-3 mr-1" /> Editar
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEffect(effect.id);
                }}
                className="h-7 p-0 text-xs flex-1 text-red-500 hover:text-red-600"
              >
                <Trash className="h-3 w-3 mr-1" /> Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // Renderizar efectos en modo lista
  const renderEffectsList = () => {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Tipo</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead className="w-[120px]">Tiempo</TableHead>
            <TableHead className="w-[120px]">Duración</TableHead>
            <TableHead className="w-[100px]">Intensidad</TableHead>
            <TableHead className="w-[100px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {effects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No hay efectos visuales</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddDialog(true)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-1" /> Añadir efecto
                </Button>
              </TableCell>
            </TableRow>
          ) : (
            effects.map(effect => (
              <TableRow
                key={effect.id}
                className={cn(
                  "cursor-pointer",
                  selectedEffectId === effect.id && "bg-blue-50 dark:bg-blue-900/20",
                  currentTime >= effect.startTime && 
                  currentTime < (effect.startTime + effect.duration) && 
                  "bg-orange-50 dark:bg-orange-900/20"
                )}
                onClick={() => setSelectedEffectId(effect.id)}
              >
                <TableCell>
                  <div className="flex items-center">
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                      style={{ backgroundColor: effectColors[effect.type] }}
                    >
                      {effectTypes.find(t => t.value === effect.type)?.icon}
                    </div>
                    <span className="capitalize">
                      {effectTypes.find(t => t.value === effect.type)?.label}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {effect.name || '-'}
                </TableCell>
                <TableCell>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSeek) onSeek(effect.startTime);
                    }}
                    className="h-6 p-0 text-xs"
                  >
                    {formatTime(effect.startTime)}
                  </Button>
                </TableCell>
                <TableCell>
                  {effect.duration}s
                </TableCell>
                <TableCell>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full"
                      style={{ 
                        width: `${effect.intensity * 100}%`,
                        backgroundColor: effectColors[effect.type]
                      }}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewEffect({
                          ...effect,
                          name: effect.name || ''
                        });
                        setShowAddDialog(true);
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEffect(effect.id);
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
    );
  };
  
  // Renderizar línea de tiempo
  const renderTimeline = () => {
    return (
      <div className="relative h-[200px] border rounded-md overflow-hidden mt-4">
        {/* Escala de tiempo */}
        <div className="absolute top-0 left-0 right-0 h-6 border-b flex px-4">
          {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(percent => (
            <div
              key={`time-${percent}`}
              className="absolute text-xs text-gray-500"
              style={{ left: `${percent * 100}%` }}
            >
              <div className="h-2 border-l border-gray-300 dark:border-gray-700"></div>
              <div className="mt-1">{formatTime(percent * duration)}</div>
            </div>
          ))}
        </div>
        
        {/* Efectos en la línea de tiempo */}
        <div className="absolute top-8 left-0 right-0 bottom-0 px-4">
          {effects.map((effect, index) => (
            <div
              key={effect.id}
              className={cn(
                "absolute h-8 rounded-md flex items-center px-2 cursor-pointer border-2 transition-all",
                selectedEffectId === effect.id && "ring-2 ring-blue-500"
              )}
              style={{
                left: `${timeToPosition(effect.startTime)}%`,
                width: `${timeToPosition(effect.startTime + effect.duration) - timeToPosition(effect.startTime)}%`,
                top: `${index % 5 * 40}px`,
                backgroundColor: `${effectColors[effect.type]}80`,
                borderColor: effectColors[effect.type]
              }}
              onClick={() => setSelectedEffectId(effect.id)}
            >
              <div className="flex items-center text-sm text-white truncate">
                {effectTypes.find(t => t.value === effect.type)?.icon}
                <span className="ml-1">{effect.name || effect.type}</span>
              </div>
            </div>
          ))}
          
          {/* Marcador de tiempo actual */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-orange-500 z-10 pointer-events-none"
            style={{ left: `${timeToPosition(currentTime)}%` }}
          >
            <div className="w-3 h-3 bg-orange-500 rounded-full -ml-1.5"></div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl flex items-center">
            <MagicWand className="h-5 w-5 mr-2 text-orange-500" />
            Efectos Visuales
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "h-8 rounded-none border-0",
                  viewMode === 'grid' ? "bg-orange-500 hover:bg-orange-600" : ""
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn(
                  "h-8 rounded-none border-0 border-l",
                  viewMode === 'list' ? "bg-orange-500 hover:bg-orange-600" : ""
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir efecto
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start p-0 rounded-none border-b">
            <TabsTrigger value="effects" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Efectos
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Línea de Tiempo
            </TabsTrigger>
            <TabsTrigger value="active" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              Activos
            </TabsTrigger>
          </TabsList>
          
          {/* Pestaña de Efectos */}
          <TabsContent value="effects">
            {viewMode === 'grid' ? renderEffectsGrid() : renderEffectsList()}
          </TabsContent>
          
          {/* Pestaña de Línea de Tiempo */}
          <TabsContent value="timeline" className="p-4">
            {renderTimeline()}
            
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" /> Añadir efecto en {formatTime(currentTime)}
              </Button>
            </div>
          </TabsContent>
          
          {/* Pestaña de Efectos Activos */}
          <TabsContent value="active" className="p-4">
            <div className="text-sm font-medium mb-2">
              Efectos activos en {formatTime(currentTime)}
            </div>
            
            {getActiveEffects().length === 0 ? (
              <div className="py-8 text-center text-gray-500 border rounded-md">
                <p>No hay efectos activos en el tiempo actual</p>
              </div>
            ) : (
              <div className="space-y-3">
                {getActiveEffects().map(effect => (
                  <div
                    key={effect.id}
                    className="border rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                    onClick={() => setSelectedEffectId(effect.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                          style={{ backgroundColor: effectColors[effect.type] }}
                        >
                          {effectTypes.find(t => t.value === effect.type)?.icon}
                        </div>
                        <div>
                          <div className="font-medium">
                            {effect.name || effectTypes.find(t => t.value === effect.type)?.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTime(effect.startTime)} - {formatTime(effect.startTime + effect.duration)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewEffect({
                              ...effect,
                              name: effect.name || ''
                            });
                            setShowAddDialog(true);
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEffect(effect.id);
                          }}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Intensidad: {Math.round(effect.intensity * 100)}%</div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${effect.intensity * 100}%`,
                            backgroundColor: effectColors[effect.type]
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="pt-2 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <div>
            {effects.length} efectos • {getActiveEffects().length} activos
          </div>
          <div>
            {isSaving && "Guardando..."}
          </div>
        </div>
      </CardFooter>
      
      {/* Dialog para añadir/editar efecto */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newEffect.name ? 'Editar efecto' : 'Añadir nuevo efecto'}
            </DialogTitle>
            <DialogDescription>
              Define los parámetros para este efecto visual
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effect-name">Nombre (opcional)</Label>
                <Input
                  id="effect-name"
                  value={newEffect.name}
                  onChange={(e) => setNewEffect({ ...newEffect, name: e.target.value })}
                  placeholder="Ej: Filtro Sepia"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="effect-type">Tipo de efecto</Label>
                <Select
                  value={newEffect.type}
                  onValueChange={(value: 'filter' | 'overlay' | 'transition' | 'zoom' | 'crop' | 'blur' | 'custom') => 
                    setNewEffect({ ...newEffect, type: value })
                  }
                >
                  <SelectTrigger id="effect-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {effectTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center">
                          {type.icon}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {effectTypes.find(t => t.value === newEffect.type)?.description}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effect-startTime">Tiempo de inicio (s)</Label>
                <div className="flex items-center">
                  <Input
                    id="effect-startTime"
                    type="number"
                    value={newEffect.startTime}
                    onChange={(e) => setNewEffect({
                      ...newEffect,
                      startTime: Math.max(0, Math.min(duration - newEffect.duration, parseFloat(e.target.value) || 0))
                    })}
                    min={0}
                    max={duration - newEffect.duration}
                    step={0.1}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewEffect({
                      ...newEffect,
                      startTime: currentTime
                    })}
                    className="ml-2"
                  >
                    Actual
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="effect-duration">Duración (s)</Label>
                <Input
                  id="effect-duration"
                  type="number"
                  value={newEffect.duration}
                  onChange={(e) => setNewEffect({
                    ...newEffect,
                    duration: Math.max(0.1, Math.min(duration - newEffect.startTime, parseFloat(e.target.value) || 0))
                  })}
                  min={0.1}
                  max={duration - newEffect.startTime}
                  step={0.1}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="effect-intensity">Intensidad: {Math.round(newEffect.intensity * 100)}%</Label>
              <Slider
                id="effect-intensity"
                value={[newEffect.intensity * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([value]) => setNewEffect({
                  ...newEffect,
                  intensity: value / 100
                })}
              />
            </div>
            
            {/* Parámetros específicos para cada tipo de efecto */}
            {newEffect.type === 'filter' && (
              <div className="space-y-2">
                <Label>Parámetros de filtro</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Contraste</Label>
                    <Slider
                      value={[newEffect.parameters?.contrast || 50]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([value]) => setNewEffect({
                        ...newEffect,
                        parameters: { ...newEffect.parameters, contrast: value }
                      })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Saturación</Label>
                    <Slider
                      value={[newEffect.parameters?.saturation || 50]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([value]) => setNewEffect({
                        ...newEffect,
                        parameters: { ...newEffect.parameters, saturation: value }
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {newEffect.type === 'zoom' && (
              <div className="space-y-2">
                <Label>Parámetros de zoom</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Factor</Label>
                    <Slider
                      value={[newEffect.parameters?.factor || 150]}
                      min={100}
                      max={300}
                      step={1}
                      onValueChange={([value]) => setNewEffect({
                        ...newEffect,
                        parameters: { ...newEffect.parameters, factor: value }
                      })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Velocidad</Label>
                    <Slider
                      value={[newEffect.parameters?.speed || 50]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={([value]) => setNewEffect({
                        ...newEffect,
                        parameters: { ...newEffect.parameters, speed: value }
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setNewEffect({
                  name: '',
                  type: 'filter',
                  startTime: currentTime,
                  duration: 5,
                  intensity: 0.5,
                  parameters: {}
                });
              }}
            >
              Cancelar
            </Button>
            
            <Button
              onClick={handleAddEffect}
              disabled={isSaving}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                newEffect.name ? 'Actualizar' : 'Añadir'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EffectsPanel;