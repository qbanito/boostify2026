/**
import { logger } from "../../lib/logger";
 * Componente de carga con una transición suave
 * Muestra un indicador de carga con animación y mensaje personalizable
 */
import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  timeout?: number;
  onTimeout?: () => void;
}

export function Loading({ 
  message = "Cargando...", 
  fullScreen = true,
  timeout = 0,
  onTimeout
}: LoadingProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [visibleMessage, setVisibleMessage] = useState(message);
  const [showRetryTip, setShowRetryTip] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let tipTimer: NodeJS.Timeout;
    
    // Si se proporciona un timeout, activar el manejador después del tiempo especificado
    if (timeout > 0) {
      timer = setTimeout(() => {
        setTimeoutReached(true);
        if (onTimeout) onTimeout();
      }, timeout);
      
      // Mostrar un consejo después de 5 segundos
      tipTimer = setTimeout(() => {
        setShowRetryTip(true);
      }, 5000);
    }
    
    // Cambiar el mensaje periódicamente para mostrar actividad
    const messageTimer = setInterval(() => {
      const messages = [
        "Cargando recursos...",
        "Preparando componentes...",
        "Conectando servicios...",
        "Iniciando aplicación...",
        "Casi listo..."
      ];
      
      setVisibleMessage(messages[Math.floor(Math.random() * messages.length)]);
    }, 2500);
    
    return () => {
      if (timer) clearTimeout(timer);
      if (tipTimer) clearTimeout(tipTimer);
      clearInterval(messageTimer);
    };
  }, [timeout, onTimeout]);

  const containerClasses = fullScreen 
    ? "fixed inset-0 flex flex-col items-center justify-center bg-background bg-opacity-95 z-50"
    : "flex flex-col items-center justify-center w-full h-full min-h-[200px]";

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="flex flex-col gap-2">
          <p className="text-lg font-medium min-h-[28px]">{visibleMessage}</p>
          
          {/* Mensaje de tiempo de espera */}
          {timeoutReached && (
            <div className="bg-amber-100 border border-amber-300 text-amber-800 p-3 rounded-md mt-4 max-w-md">
              <p className="font-medium">La carga está tardando más de lo esperado</p>
              <p className="text-sm mt-1">Esto puede deberse a una conexión lenta o un problema temporal.</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 px-4 py-2 bg-amber-200 hover:bg-amber-300 rounded-md text-sm font-medium"
              >
                Recargar página
              </button>
            </div>
          )}
          
          {/* Consejo de recarga */}
          {showRetryTip && !timeoutReached && (
            <p className="text-sm text-muted-foreground mt-2">
              Si la carga continúa por mucho tiempo, intenta refrescar la página.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}