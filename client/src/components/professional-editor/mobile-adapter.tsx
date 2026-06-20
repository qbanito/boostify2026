import React, { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { ArrowUp, ArrowDown, X } from 'lucide-react';

interface MobileAdapterProps {
  children: React.ReactNode;
  title?: string;
  id?: string;
  onToggle?: () => void;
  isVisible?: boolean;
  className?: string;
  minHeight?: string;
  fullHeight?: boolean;
}

/**
 * Componente adaptador para secciones móviles
 * Proporciona un contenedor para cada sección con su cabecera y controles
 */
const MobileAdapter: React.FC<MobileAdapterProps> = ({
  children,
  title = 'Sección',
  id,
  onToggle,
  isVisible = true,
  className = '',
  minHeight = '200px',
  fullHeight = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Alternar entre expandido y contraído (usado en modo móvil)
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Cerrar la sección (si se proporciona callback)
  const handleClose = () => {
    if (onToggle) {
      onToggle();
    }
  };
  
  // Aplicar clase para altura completa cuando se expande
  const getContainerClasses = () => {
    let classes = `border-b border-zinc-800 ${className}`;
    
    if (fullHeight || isExpanded) {
      classes += ' h-[calc(100vh-200px)]';
    } else {
      classes += ` min-h-[${minHeight}]`;
    }
    
    return classes;
  };
  
  // Resetear el estado expandido cuando la visibilidad cambia
  useEffect(() => {
    if (!isVisible) {
      setIsExpanded(false);
    }
  }, [isVisible]);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div id={id} className={getContainerClasses()}>
      <div className="p-2 bg-zinc-900 flex justify-between items-center">
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={toggleExpand}
          >
            {isExpanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
          
          {onToggle && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className={`${isExpanded ? 'h-[calc(100%-40px)]' : 'h-full'} overflow-auto p-2`}>
        {children}
      </div>
    </div>
  );
};

export default MobileAdapter;