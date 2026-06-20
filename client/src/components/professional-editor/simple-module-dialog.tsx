import React, { useState, useEffect } from 'react';
import { ModuleConfig } from '../../lib/professional-editor-types';
import { useToast } from '../../hooks/use-toast';

interface SimpleModuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  modules: ModuleConfig[];
  onModulesChange: (modules: ModuleConfig[]) => void;
}

export function SimpleModuleDialog({ isOpen, onClose, modules, onModulesChange }: SimpleModuleDialogProps) {
  const [localModules, setLocalModules] = useState<ModuleConfig[]>([]);
  const [activeTab, setActiveTab] = useState('panels');
  const { toast } = useToast();
  
  // Cargar módulos al abrir el diálogo
  useEffect(() => {
    if (isOpen) {
      setLocalModules([...modules]);
    }
  }, [isOpen, modules]);
  
  // Guardar los cambios cuando el usuario acepte
  const handleSave = () => {
    onModulesChange(localModules);
    toast({
      title: "Configuración guardada",
      description: "La configuración de módulos se ha actualizado correctamente"
    });
    onClose();
  };
  
  // Cancelar y descartar cambios
  const handleCancel = () => {
    setLocalModules([...modules]);
    onClose();
  };
  
  // Restablecer a la configuración predeterminada
  const handleReset = () => {
    const defaultModules: ModuleConfig[] = [
      { id: 'preview', name: 'Vista previa', type: 'panel', enabled: true, visible: true, position: 0, defaultSize: 60 },
      { id: 'timeline', name: 'Línea de tiempo', type: 'panel', enabled: true, visible: true, position: 1, defaultSize: 20 },
      { id: 'edit', name: 'Editor', type: 'panel', enabled: true, visible: true, position: 2, defaultSize: 20 },
      { id: 'effects', name: 'Efectos', type: 'tool', enabled: true, visible: true, position: 3 },
      { id: 'audio', name: 'Audio', type: 'tool', enabled: true, visible: true, position: 4 },
      { id: 'text', name: 'Texto', type: 'tool', enabled: true, visible: true, position: 5 },
      { id: 'camera', name: 'Cámara', type: 'tool', enabled: true, visible: true, position: 6 },
      { id: 'transitions', name: 'Transiciones', type: 'tool', enabled: true, visible: true, position: 7 },
    ];
    
    setLocalModules(defaultModules);
    toast({
      title: "Configuración restablecida",
      description: "Se ha restablecido la configuración predeterminada"
    });
  };
  
  // Cambiar visibilidad de un módulo
  const toggleVisibility = (moduleId: string) => {
    setLocalModules(prev => 
      prev.map(m => 
        m.id === moduleId 
          ? { ...m, visible: !m.visible } 
          : m
      )
    );
  };
  
  // Cambiar estado de activación/desactivación de un módulo
  const toggleEnabled = (moduleId: string) => {
    setLocalModules(prev => 
      prev.map(m => 
        m.id === moduleId 
          ? { ...m, enabled: !m.enabled, visible: !m.enabled ? true : m.visible } 
          : m
      )
    );
  };
  
  // Mover un módulo hacia arriba en la lista
  const moveUp = (moduleId: string) => {
    setLocalModules(prev => {
      const index = prev.findIndex(m => m.id === moduleId);
      if (index <= 0) return prev;
      
      const result = [...prev];
      // Intercambiar posiciones
      const temp = result[index].position;
      result[index].position = result[index - 1].position;
      result[index - 1].position = temp;
      
      // Reordenar el array
      return result.sort((a, b) => a.position - b.position);
    });
  };
  
  // Mover un módulo hacia abajo en la lista
  const moveDown = (moduleId: string) => {
    setLocalModules(prev => {
      const index = prev.findIndex(m => m.id === moduleId);
      if (index === -1 || index >= prev.length - 1) return prev;
      
      const result = [...prev];
      // Intercambiar posiciones
      const temp = result[index].position;
      result[index].position = result[index + 1].position;
      result[index + 1].position = temp;
      
      // Reordenar el array
      return result.sort((a, b) => a.position - b.position);
    });
  };
  
  // Filtrar módulos por tipo según la pestaña activa
  const filteredModules = localModules
    .filter(m => {
      if (activeTab === 'panels') return m.type === 'panel';
      if (activeTab === 'tools') return m.type === 'tool';
      if (activeTab === 'widgets') return m.type === 'widget';
      return true;
    })
    .sort((a, b) => a.position - b.position);
  
  // No renderizar nada si no está abierto
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-xl font-bold">Configurar módulos del editor</h2>
          <p className="text-sm text-zinc-400">
            Personaliza los módulos visibles y su orden en el editor profesional.
          </p>
        </div>
        
        <div className="p-4">
          <div className="flex space-x-2 mb-4">
            <button 
              onClick={() => setActiveTab('panels')} 
              className={`px-3 py-2 rounded ${activeTab === 'panels' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}
            >
              Paneles
            </button>
            <button 
              onClick={() => setActiveTab('tools')} 
              className={`px-3 py-2 rounded ${activeTab === 'tools' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}
            >
              Herramientas
            </button>
            <button 
              onClick={() => setActiveTab('widgets')} 
              className={`px-3 py-2 rounded ${activeTab === 'widgets' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}
            >
              Widgets
            </button>
          </div>
          
          <div className="overflow-y-auto h-[50vh] border border-zinc-800 rounded-md p-2">
            <div className="space-y-4 p-2">
              {filteredModules.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No hay módulos de este tipo configurados
                </div>
              ) : (
                filteredModules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-3 border border-zinc-800 rounded-md bg-zinc-950">
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500">☰</span>
                      <div>
                        <div className="font-medium">{module.name}</div>
                        <div className="text-xs text-zinc-500">{module.id}</div>
                      </div>
                      {module.defaultSize && (
                        <span className="ml-2 px-2 py-1 text-xs rounded bg-zinc-800">
                          {module.defaultSize}%
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Botones de navegación */}
                      <button
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-50"
                        onClick={() => moveUp(module.id)}
                        disabled={filteredModules.indexOf(module) === 0}
                      >
                        ↑
                      </button>
                      <button
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-50"
                        onClick={() => moveDown(module.id)}
                        disabled={filteredModules.indexOf(module) === filteredModules.length - 1}
                      >
                        ↓
                      </button>
                      
                      {/* Botón de visibilidad */}
                      <button
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-50"
                        onClick={() => toggleVisibility(module.id)}
                        disabled={!module.enabled}
                      >
                        {module.visible ? "👁️" : "👁️‍🗨️"}
                      </button>
                      
                      {/* Switch para habilitar/deshabilitar */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`switch-${module.id}`}
                          checked={module.enabled}
                          onChange={() => toggleEnabled(module.id)}
                          className="h-4 w-4"
                        />
                        <label htmlFor={`switch-${module.id}`} className="text-sm">
                          {module.enabled ? "Activado" : "Desactivado"}
                        </label>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-800 flex justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
          >
            Restablecer
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}