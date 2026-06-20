import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import {
  Layers,
  Play,
  Pause,
  Search,
  Wand2
} from 'lucide-react';
import { Input } from '../../components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export interface Transition {
  id: string;
  name: string;
  type: string;
  duration: number;
  preview?: string;
  clipBeforeId?: string;
  clipAfterId?: string;
  startTime?: number;
  endTime?: number;
}

export interface TransitionsPanelProps {
  transitions: Transition[];
  clips: any[]; // Reemplazar por el tipo adecuado
  currentTime: number;
  duration: number;
  onAddTransition: (transition: Omit<Transition, 'id'>) => void;
  onUpdateTransition: (id: string, updates: Partial<Transition>) => void;
  onDeleteTransition: (id: string) => void;
  onPreview: (transition: Transition) => void;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
}

// Definición de transiciones disponibles
const AVAILABLE_TRANSITIONS = [
  { type: 'fade', name: 'Fundido', description: 'Desvanece suavemente entre clips' },
  { type: 'crossfade', name: 'Fundido cruzado', description: 'Mezcla gradualmente ambos clips' },
  { type: 'wipe-left', name: 'Barrido izquierda', description: 'Transición con barrido hacia la izquierda' },
  { type: 'wipe-right', name: 'Barrido derecha', description: 'Transición con barrido hacia la derecha' },
  { type: 'wipe-up', name: 'Barrido arriba', description: 'Transición con barrido hacia arriba' },
  { type: 'wipe-down', name: 'Barrido abajo', description: 'Transición con barrido hacia abajo' },
  { type: 'zoom-in', name: 'Zoom de entrada', description: 'Transición con zoom hacia adentro' },
  { type: 'zoom-out', name: 'Zoom de salida', description: 'Transición con zoom hacia afuera' },
  { type: 'rotate', name: 'Rotación', description: 'Transición con rotación entre clips' },
  { type: 'dissolve', name: 'Disolución', description: 'Disolución gradual entre clips' },
  { type: 'blur', name: 'Desenfoque', description: 'Transición con desenfoque entre clips' },
  { type: 'slide-left', name: 'Deslizar izquierda', description: 'Desliza un clip hacia la izquierda' },
  { type: 'slide-right', name: 'Deslizar derecha', description: 'Desliza un clip hacia la derecha' },
];

const TransitionsPanel: React.FC<TransitionsPanelProps> = ({
  transitions,
  clips,
  currentTime,
  duration,
  onAddTransition,
  onUpdateTransition,
  onDeleteTransition,
  onPreview,
  isPlaying,
  onPlay,
  onPause,
  onSeek
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransitionType, setSelectedTransitionType] = useState<string>('fade');
  const [newTransitionDuration, setNewTransitionDuration] = useState(1.0);
  
  // Filtrar transiciones por término de búsqueda
  const filteredTransitions = AVAILABLE_TRANSITIONS.filter(transition => 
    transition.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transition.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Formatear tiempo en MM:SS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Encontrar clips adyacentes al tiempo actual
  const findAdjacentClips = () => {
    // Ordenar clips por tiempo de inicio
    const sortedClips = [...clips].sort((a, b) => a.startTime - b.startTime);
    
    let beforeClip = null;
    let afterClip = null;
    
    for (let i = 0; i < sortedClips.length; i++) {
      if (sortedClips[i].endTime <= currentTime) {
        beforeClip = sortedClips[i];
      }
      if (sortedClips[i].startTime >= currentTime && !afterClip) {
        afterClip = sortedClips[i];
      }
    }
    
    return { beforeClip, afterClip };
  };
  
  // Crear una nueva transición en el tiempo actual
  const handleAddTransition = () => {
    const { beforeClip, afterClip } = findAdjacentClips();
    
    if (!beforeClip || !afterClip) {
      alert('No se pueden encontrar clips adyacentes en la posición actual');
      return;
    }
    
    const newTransition = {
      name: AVAILABLE_TRANSITIONS.find(t => t.type === selectedTransitionType)?.name || 'Transición',
      type: selectedTransitionType,
      duration: newTransitionDuration,
      clipBeforeId: beforeClip.id,
      clipAfterId: afterClip.id,
      startTime: beforeClip.endTime - (newTransitionDuration / 2),
      endTime: afterClip.startTime + (newTransitionDuration / 2)
    };
    
    onAddTransition(newTransition);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Transiciones</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={isPlaying ? onPause : onPlay}
            className="h-8 w-8 rounded-full bg-zinc-800"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="text-sm text-zinc-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
      
      {/* Buscador de transiciones */}
      <div className="relative">
        <Search className="absolute left-2 top-3 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Buscar transiciones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 bg-zinc-900 border-zinc-800"
        />
      </div>
      
      {/* Galería de transiciones disponibles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
        {filteredTransitions.map((transition) => (
          <Card 
            key={transition.type} 
            className={`bg-zinc-900 border-zinc-800 cursor-pointer transition-all hover:border-orange-500 ${
              selectedTransitionType === transition.type ? 'border-orange-500 ring-1 ring-orange-500' : ''
            }`}
            onClick={() => setSelectedTransitionType(transition.type)}
          >
            <CardHeader className="p-2">
              <CardTitle className="text-sm font-medium text-white">{transition.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="h-10 flex items-center justify-center bg-zinc-800 rounded-md">
                <Layers className="h-5 w-5 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Controles de la nueva transición */}
      <div className="bg-zinc-900 p-3 rounded-md border border-zinc-800">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Configuración de transición</h4>
        <div className="space-y-3">
          <div className="flex space-x-2">
            <div className="flex-1">
              <label className="text-xs text-zinc-400 block mb-1">Tipo</label>
              <Select value={selectedTransitionType} onValueChange={setSelectedTransitionType}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_TRANSITIONS.map((t) => (
                    <SelectItem key={t.type} value={t.type}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Duración (s)</label>
              <Input
                type="number"
                value={newTransitionDuration}
                onChange={(e) => setNewTransitionDuration(parseFloat(e.target.value))}
                min={0.1}
                max={5}
                step={0.1}
                className="bg-zinc-950 border-zinc-800"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              onClick={() => onSeek(Math.max(0, currentTime - 2))}
              className="bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-300"
            >
              Ver antes
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onSeek(Math.min(duration, currentTime + 2))}
              className="bg-zinc-950 border-zinc-800 hover:bg-zinc-900 text-zinc-300"
            >
              Ver después
            </Button>
          </div>
          
          <Button 
            variant="default" 
            onClick={handleAddTransition}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Wand2 className="h-4 w-4 mr-2" /> Añadir transición
          </Button>
        </div>
      </div>
      
      {/* Transiciones aplicadas */}
      <div>
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Transiciones aplicadas ({transitions.length})</h4>
        {transitions.length === 0 ? (
          <div className="text-sm text-zinc-500 flex items-center justify-center h-20 border border-dashed border-zinc-700 rounded-md">
            No hay transiciones aplicadas
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {transitions.map((transition) => (
              <div 
                key={transition.id}
                className="p-2 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm text-white">{transition.name}</div>
                    <div className="text-xs text-zinc-400">
                      {transition.startTime !== undefined 
                        ? `${formatTime(transition.startTime)} - ${formatTime(transition.endTime || 0)}`
                        : 'Tiempo no definido'
                      }
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" 
                            size="icon"
                            onClick={() => onPreview(transition)}
                            className="h-8 w-8 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Previsualizar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost" 
                            size="icon"
                            onClick={() => onDeleteTransition(transition.id)}
                            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/10"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Eliminar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                
                {/* Opciones de duración */}
                <div className="mt-2">
                  <label className="text-xs text-zinc-400 block mb-1">Duración: {transition.duration}s</label>
                  <Slider
                    value={[transition.duration]}
                    min={0.1}
                    max={5}
                    step={0.1}
                    onValueChange={(values) => onUpdateTransition(transition.id, { duration: values[0] })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransitionsPanel;