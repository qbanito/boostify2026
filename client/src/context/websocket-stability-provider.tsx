import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

interface WebSocketStabilityContextType {
  isConnected: boolean;
  reconnect: () => void;
  sendMessage: (message: string) => void;
  lastError: string | null;
}

// Creamos el contexto para la estabilidad del WebSocket
const WebSocketStabilityContext = createContext<WebSocketStabilityContextType>({
  isConnected: false,
  reconnect: () => {},
  sendMessage: () => {},
  lastError: null
});

// Opciones configurables
interface WebSocketStabilityProviderProps {
  url: string;
  children: React.ReactNode;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  onMessage?: (event: MessageEvent) => void;
}

export const WebSocketStabilityProvider: React.FC<WebSocketStabilityProviderProps> = ({
  url,
  children,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
  pingInterval = 30000,
  onMessage
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const pendingMessagesRef = useRef<string[]>([]);

  // Función para limpiar intervalos y timeouts
  const cleanupTimers = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  // Función para establecer conexión WebSocket
  const connectWebSocket = () => {
    cleanupTimers();
    try {
      console.log("[WebSocket] Intentando conectar a:", url);
      const socket = new WebSocket(url);
      
      socket.onopen = () => {
        if (!isMountedRef.current) return;
        console.log("[WebSocket] Conexión establecida");
        setIsConnected(true);
        setLastError(null);
        reconnectAttemptsRef.current = 0;

        // Enviar mensajes pendientes
        while (pendingMessagesRef.current.length > 0) {
          const message = pendingMessagesRef.current.shift();
          if (message && socket.readyState === WebSocket.OPEN) {
            socket.send(message);
          }
        }

        // Iniciar ping periódico para mantener la conexión viva
        pingIntervalRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, pingInterval);
      };

      socket.onmessage = (event) => {
        if (!isMountedRef.current) return;
        // Procesar mensajes, incluyendo pongs
        if (event.data === '{"type":"pong"}') {
          console.log("[WebSocket] Pong recibido");
        } else if (onMessage) {
          onMessage(event);
        }
      };

      socket.onerror = (error) => {
        if (!isMountedRef.current) return;
        console.error("[WebSocket] Error:", error);
        setLastError("Se produjo un error en la conexión");
      };

      socket.onclose = (event) => {
        if (!isMountedRef.current) return;
        console.log(`[WebSocket] Conexión cerrada: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        cleanupTimers();

        // Reintentar conexión automáticamente si no fue un cierre normal
        if (event.code !== 1000 && event.code !== 1001) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = reconnectInterval * Math.pow(1.5, reconnectAttemptsRef.current);
            console.log(`[WebSocket] Reintentando en ${delay}ms (intento ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = window.setTimeout(() => {
              reconnectAttemptsRef.current++;
              if (isMountedRef.current) {
                connectWebSocket();
              }
            }, delay);
          } else {
            setLastError("Se excedió el número máximo de intentos de reconexión");
          }
        }
      };

      socketRef.current = socket;
    } catch (error) {
      console.error("[WebSocket] Error al crear conexión:", error);
      setLastError("Error al iniciar la conexión WebSocket");
    }
  };

  // Manejar reconexión manual
  const reconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connectWebSocket();
  };

  // Enviar mensaje a través del WebSocket
  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      // Si no está conectado, guardar mensaje para enviar cuando se conecte
      pendingMessagesRef.current.push(message);
      
      // Si el socket está cerrado, intentar reconectar
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        reconnect();
      }
    }
  };

  // Interceptar y manejar errores de WebSocket no capturados
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error && 
          (event.reason.name === 'AbortError' || 
           event.reason.message.includes('WebSocket'))) {
        console.warn("[WebSocket] Interceptado error de rechazo no manejado en WebSocket:", event.reason);
        event.preventDefault();  // Prevenir que el error sea registrado en consola
        
        // Intentar reconectar automáticamente
        reconnect();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Establecer conexión inicial
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      isMountedRef.current = false;
      cleanupTimers();
      
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url]);

  const contextValue = {
    isConnected,
    reconnect,
    sendMessage,
    lastError
  };

  return (
    <WebSocketStabilityContext.Provider value={contextValue}>
      {children}
    </WebSocketStabilityContext.Provider>
  );
};

// Hook personalizado para usar el contexto de WebSocket
export const useWebSocketStability = () => {
  const context = useContext(WebSocketStabilityContext);
  if (!context) {
    throw new Error('useWebSocketStability debe usarse dentro de un WebSocketStabilityProvider');
  }
  return context;
};

// Componente de estado de conexión (opcional, para mostrar en la interfaz)
export const WebSocketStatusIndicator: React.FC = () => {
  const { isConnected, lastError, reconnect } = useWebSocketStability();
  
  return (
    <div className="fixed bottom-0 right-0 p-2 z-50">
      <div className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${isConnected ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-200' : 'bg-red-200'}`} />
        <span className="text-white">
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
        {!isConnected && (
          <button 
            onClick={reconnect}
            className="ml-2 rounded-sm bg-white/20 px-1.5 py-0.5 text-xs hover:bg-white/30"
          >
            Reconectar
          </button>
        )}
        {lastError && (
          <span className="ml-2 text-xs text-white/80">{lastError}</span>
        )}
      </div>
    </div>
  );
};