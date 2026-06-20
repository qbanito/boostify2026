import React, { useState, useEffect } from 'react';
import { GripVertical, GripHorizontal, ChevronRight, ChevronDown } from 'lucide-react';
import { ResizableHandle } from '../../components/ui/resizable';

interface ResizeHandleControlProps {
  id?: string;
  withHandle?: boolean;
  orientation?: 'vertical' | 'horizontal';
  onCollapse?: () => void;
  isCollapsed?: boolean;
  className?: string;
}

/**
 * Componente mejorado para controlar los ResizableHandle con soporte para móvil
 * Detecta automáticamente la orientación basada en el modo (móvil o escritorio)
 */
const ResizeHandleControl: React.FC<ResizeHandleControlProps> = ({
  id,
  withHandle = true,
  orientation: propOrientation,
  onCollapse,
  isCollapsed = false,
  className = ''
}) => {
  // Estado para controlar la orientación basada en el tamaño de la pantalla
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>(
    propOrientation || (window.innerWidth < 768 ? 'horizontal' : 'vertical')
  );

  // Determinar qué ícono mostrar basado en la orientación
  const getGripComponent = () => {
    return orientation === 'horizontal' ? (
      <GripHorizontal className="h-4 w-4 text-zinc-400" />
    ) : (
      <GripVertical className="h-4 w-4 text-zinc-400" />
    );
  };

  // Determinar qué ícono de colapso mostrar basado en la orientación y estado
  const getCollapseIcon = () => {
    if (orientation === 'horizontal') {
      return isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
    } else {
      return isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />;
    }
  };

  // Detectar cambios en el tamaño de la ventana para ajustar la orientación
  useEffect(() => {
    const handleResize = () => {
      if (!propOrientation) { // Solo actualizar si no se proporcionó orientación específica
        setOrientation(window.innerWidth < 768 ? 'horizontal' : 'vertical');
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [propOrientation]);

  // Si se proporciona una orientación específica, usarla
  useEffect(() => {
    if (propOrientation) {
      setOrientation(propOrientation);
    }
  }, [propOrientation]);

  return (
    <ResizableHandle
      id={id}
      withHandle={withHandle}
      className={`p-1 ${className}`}
    >
      <div className="flex items-center justify-center h-full w-full">
        {getGripComponent()}
        
        {/* Botón opcional para colapsar el panel */}
        {onCollapse && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCollapse();
            }}
            className="ml-1 hover:bg-zinc-700 rounded-full p-1"
          >
            {getCollapseIcon()}
          </button>
        )}
      </div>
    </ResizableHandle>
  );
};

export default ResizeHandleControl;