import React from 'react';
import { 
  Play, Pause, Undo, Redo, Save, Download, Upload, 
  RefreshCw, Layout, Video, Music, Type, Camera, 
  Wand2, Scissors, Layers, Settings
} from 'lucide-react';

interface MobileToolbarProps {
  activeTool: string;
  onToolSelect: (toolId: string) => void;
  isPlaying?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onReset?: () => void;
  onConfigurePanels?: () => void;
}

export function MobileToolbar({
  activeTool,
  onToolSelect,
  isPlaying = false,
  onPlay,
  onPause,
  onUndo,
  onRedo,
  onSave,
  onExport,
  onImport,
  onReset,
  onConfigurePanels
}: MobileToolbarProps) {
  const toolButtons = [
    { id: 'video', icon: <Video className="h-5 w-5" />, label: 'Video' },
    { id: 'audio', icon: <Music className="h-5 w-5" />, label: 'Audio' },
    { id: 'text', icon: <Type className="h-5 w-5" />, label: 'Texto' },
    { id: 'camera', icon: <Camera className="h-5 w-5" />, label: 'Cámara' },
    { id: 'effects', icon: <Wand2 className="h-5 w-5" />, label: 'Efectos' },
    { id: 'cut', icon: <Scissors className="h-5 w-5" />, label: 'Cortar' },
    { id: 'transitions', icon: <Layers className="h-5 w-5" />, label: 'Transiciones' },
    { id: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Ajustes' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black z-30 sm:hidden">
      {/* Barra principal */}
      <div className="flex justify-between items-center px-2 py-1 border-t border-zinc-800">
        {/* Control de reproducción */}
        <div className="flex items-center space-x-2">
          {isPlaying ? (
            <button 
              onClick={onPause} 
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
              aria-label="Pausa"
            >
              <Pause className="h-5 w-5" />
            </button>
          ) : (
            <button 
              onClick={onPlay} 
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
              aria-label="Reproducir"
            >
              <Play className="h-5 w-5" />
            </button>
          )}
          
          <button 
            onClick={onUndo} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Deshacer"
          >
            <Undo className="h-5 w-5" />
          </button>
          
          <button 
            onClick={onRedo} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Rehacer"
          >
            <Redo className="h-5 w-5" />
          </button>
        </div>
        
        {/* Acciones */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={onSave} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Guardar"
          >
            <Save className="h-5 w-5" />
          </button>
          
          <button 
            onClick={onExport} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Exportar"
          >
            <Download className="h-5 w-5" />
          </button>
          
          <button 
            onClick={onImport} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Importar"
          >
            <Upload className="h-5 w-5" />
          </button>
          
          <button 
            onClick={onReset} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Reiniciar"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
          
          <button 
            onClick={onConfigurePanels} 
            className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800"
            aria-label="Configurar paneles"
          >
            <Layout className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Barra de herramientas secundaria con scroll horizontal */}
      <div className="overflow-x-auto whitespace-nowrap p-2 border-t border-zinc-800 bg-zinc-950">
        <div className="flex space-x-2">
          {toolButtons.map((tool) => (
            <button
              key={tool.id}
              onClick={() => onToolSelect(tool.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-md min-w-[60px] ${
                activeTool === tool.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {tool.icon}
              <span className="text-xs mt-1">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}