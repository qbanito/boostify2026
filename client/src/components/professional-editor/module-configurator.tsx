import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Check, Grip, X, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { ModuleConfig } from '../../lib/professional-editor-types';
import { toast } from '../../hooks/use-toast';

interface ModuleConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  modules: ModuleConfig[];
  onModulesChange: (modules: ModuleConfig[]) => void;
}

export function ModuleConfigurator({ isOpen, onClose, modules, onModulesChange }: ModuleConfiguratorProps) {
  const [localModules, setLocalModules] = useState<ModuleConfig[]>([]);
  const [activeTab, setActiveTab] = useState('panels');
  
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
      title: 'Configuración guardada',
      description: 'La configuración de módulos se ha actualizado correctamente.',
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
      title: 'Configuración restablecida',
      description: 'Se ha restablecido la configuración predeterminada de módulos.',
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
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Configurar módulos del editor</DialogTitle>
          <DialogDescription>
            Personaliza los módulos visibles y su orden en el editor profesional.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="panels">Paneles</TabsTrigger>
            <TabsTrigger value="tools">Herramientas</TabsTrigger>
            <TabsTrigger value="widgets">Widgets</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-2">
            <ScrollArea className="h-[50vh] border rounded-md p-2">
              <div className="space-y-4 p-2">
                {filteredModules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay módulos de este tipo configurados
                  </div>
                ) : (
                  filteredModules.map((module) => (
                    <div key={module.id} className="flex items-center justify-between p-3 border rounded-md bg-background">
                      <div className="flex items-center gap-3">
                        <Grip className="h-4 w-4 text-muted-foreground cursor-move" />
                        <div>
                          <div className="font-medium">{module.name}</div>
                          <div className="text-xs text-muted-foreground">{module.id}</div>
                        </div>
                        {module.defaultSize && (
                          <Badge variant="outline" className="ml-2">
                            {module.defaultSize}%
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Botones de navegación */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveUp(module.id)}
                          disabled={filteredModules.indexOf(module) === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveDown(module.id)}
                          disabled={filteredModules.indexOf(module) === filteredModules.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        
                        {/* Botón de visibilidad */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleVisibility(module.id)}
                          disabled={!module.enabled}
                        >
                          {module.visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        
                        {/* Switch para habilitar/deshabilitar */}
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`switch-${module.id}`}
                            checked={module.enabled}
                            onCheckedChange={() => toggleEnabled(module.id)}
                          />
                          <Label htmlFor={`switch-${module.id}`}>
                            {module.enabled ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )}
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4 flex justify-between items-center">
          <Button variant="outline" onClick={handleReset}>
            Restablecer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar cambios
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}