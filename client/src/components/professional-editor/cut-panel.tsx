import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import { Scissors, Plus, RotateCcw, RotateCw, Trash2, Split } from 'lucide-react';
import { Input } from '../../components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';

export interface CutPanelProps {
  currentTime: number;
  duration: number;
  clips: any[]; // Tipo de clips específico puede ser reemplazado
  onCut: (time: number) => void;
  onRemove: (clipId: string) => void;
  onSplit: (clipId: string, time: number) => void;
  onTrim: (clipId: string, startTime: number, endTime: number) => void;
  onSeek: (time: number) => void;
}

const CutPanel: React.FC<CutPanelProps> = ({
  currentTime,
  duration,
  clips,
  onCut,
  onRemove,
  onSplit,
  onTrim,
  onSeek
}) => {
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const selectedClip = selectedClipId ? clips.find(clip => clip.id === selectedClipId) : null;
  
  // Encontrar el clip que contiene el tiempo actual
  const currentClip = clips.find(
    clip => currentTime >= clip.startTime && currentTime <= clip.endTime
  );
  
  // Estado para los marcadores de inicio y fin para recortar
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(duration);
  
  // Aplicar recorte al clip seleccionado
  const handleApplyTrim = () => {
    if (selectedClipId) {
      onTrim(selectedClipId, trimStart, trimEnd);
    }
  };
  
  // Formatear tiempo en formato MM:SS.MS
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 100);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };
  
  // Seleccionar un clip y actualizar los valores de recorte
  const handleSelectClip = (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (clip) {
      setSelectedClipId(clipId);
      setTrimStart(clip.startTime);
      setTrimEnd(clip.endTime);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Herramienta de Corte</h3>
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onCut(currentTime)}
                  className="bg-orange-500/20 border-orange-500 hover:bg-orange-500/30 text-white"
                >
                  <Scissors className="h-4 w-4 mr-1" /> Cortar
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cortar en la posición actual</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => currentClip && onSplit(currentClip.id, currentTime)}
                  disabled={!currentClip}
                  className="bg-blue-500/20 border-blue-500 hover:bg-blue-500/30 text-white"
                >
                  <Split className="h-4 w-4 mr-1" /> Dividir
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Dividir el clip actual en la posición del cursor</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Indicador de posición actual */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>Posición actual:</span>
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
        <Slider
          value={[currentTime]}
          min={0}
          max={duration}
          step={0.01}
          onValueChange={(value) => onSeek(value[0])}
          className="w-full"
        />
      </div>
      
      {/* Lista de clips */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Clips ({clips.length})</h4>
        {clips.length === 0 ? (
          <div className="text-sm text-zinc-500 flex items-center justify-center h-20 border border-dashed border-zinc-700 rounded-md">
            No hay clips disponibles
          </div>
        ) : (
          clips.map((clip) => (
            <div 
              key={clip.id}
              className={`p-2 rounded-md border ${
                selectedClipId === clip.id 
                  ? 'bg-zinc-800 border-orange-500' 
                  : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
              } cursor-pointer mb-2`}
              onClick={() => handleSelectClip(clip.id)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="font-medium text-sm text-white">
                    {clip.name || `Clip ${clip.id.slice(-4)}`}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </div>
                </div>
                <Button
                  variant="ghost" 
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(clip.id);
                  }}
                  className="h-8 w-8 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Mostrar controles de recorte solo para el clip seleccionado */}
              {selectedClipId === clip.id && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Inicio</label>
                      <div className="flex space-x-1">
                        <Input
                          type="number"
                          value={trimStart}
                          onChange={(e) => setTrimStart(parseFloat(e.target.value))}
                          min={0}
                          max={trimEnd - 0.1}
                          step={0.01}
                          className="h-8 text-xs bg-zinc-950 border-zinc-800"
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 bg-zinc-950"
                          onClick={() => onSeek(trimStart)}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Fin</label>
                      <div className="flex space-x-1">
                        <Input
                          type="number"
                          value={trimEnd}
                          onChange={(e) => setTrimEnd(parseFloat(e.target.value))}
                          min={trimStart + 0.1}
                          max={duration}
                          step={0.01}
                          className="h-8 text-xs bg-zinc-950 border-zinc-800"
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 bg-zinc-950"
                          onClick={() => onSeek(trimEnd)}
                        >
                          <RotateCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <Slider
                    value={[trimStart, trimEnd]}
                    min={0}
                    max={duration}
                    step={0.01}
                    onValueChange={(values) => {
                      setTrimStart(values[0]);
                      setTrimEnd(values[1]);
                    }}
                    className="my-2"
                  />
                  
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleApplyTrim}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Aplicar Recorte
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Botón para añadir un nuevo clip vacío */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => alert('Funcionalidad para agregar clip en desarrollo')}
        className="w-full border-dashed border-zinc-700 bg-transparent hover:bg-zinc-900 text-zinc-400"
      >
        <Plus className="h-4 w-4 mr-1" /> Añadir clip vacío
      </Button>
    </div>
  );
};

export default CutPanel;