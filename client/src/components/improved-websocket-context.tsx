/**
 * Improved WebSocket Context
 * 
 * Este contexto proporciona una gestión mejorada de WebSockets para la aplicación,
 * atendiendo específicamente al problema "The user aborted a request" que puede
 * ocurrir con las conexiones WebSocket de Vite HMR.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { logger } from "@/lib/logger";
import WebSocketManager from '../lib/utils/websocket-manager';

interface WebSocketContextValue {
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => boolean;
  isConnected: boolean;
  lastMessage: any | null;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket debe ser usado dentro de un WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  url: string;
  children: React.ReactNode;
  protocols?: string | string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  autoConnect?: boolean;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  url,
  children,
  protocols,
  reconnectInterval = 2000,
  maxReconnectAttempts = 5,
  autoConnect = true,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  
  // Configurar el WebSocketManager y gestionar su ciclo de vida
  useEffect(() => {
    // Solo crear una instancia si autoConnect es true
    if (autoConnect) {
      initializeWebSocket();
    }
    
    // Limpiar al desmontar
    return () => {
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
        wsManagerRef.current = null;
      }
    };
  }, [url, protocols, reconnectInterval, maxReconnectAttempts, autoConnect]);
  
  // Inicializar el WebSocketManager con manejo de errores adecuado
  const initializeWebSocket = () => {
    try {
      // Crear una nueva instancia de WebSocketManager con configuración personalizada
      wsManagerRef.current = new WebSocketManager({
        url,
        protocols,
        reconnectInterval,
        maxReconnectAttempts,
        onOpen: () => {
          logger.info('WebSocket conectado');
          setIsConnected(true);
        },
        onMessage: (event) => {
          try {
            // Intentar analizar el mensaje como JSON si es posible
            const parsed = typeof event.data === 'string' 
              ? JSON.parse(event.data) 
              : event.data;
            setLastMessage(parsed);
          } catch (error) {
            // Si no es JSON, guardar el mensaje como está
            setLastMessage(event.data);
          }
        },
        onClose: () => {
          logger.info('WebSocket desconectado');
          setIsConnected(false);
        },
        onError: (error) => {
          logger.error('Error de WebSocket:', error);
          setIsConnected(false);
        }
      });
    } catch (error) {
      logger.error('Error al inicializar WebSocket:', error);
    }
  };
  
  // Función para enviar mensajes a través de WebSocket
  const send = (data: string | ArrayBufferLike | Blob | ArrayBufferView): boolean => {
    if (!wsManagerRef.current) {
      logger.warn('Intento de envío sin WebSocket inicializado');
      return false;
    }
    return wsManagerRef.current.send(data);
  };
  
  // Conectar manualmente si autoConnect es false
  const connect = () => {
    if (!wsManagerRef.current) {
      initializeWebSocket();
    } else if (!wsManagerRef.current.isConnected()) {
      wsManagerRef.current.connect();
    }
  };
  
  // Desconectar manualmente
  const disconnect = () => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
    }
  };
  
  const contextValue: WebSocketContextValue = {
    send,
    isConnected,
    lastMessage,
    connect,
    disconnect
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Componente para mejorar específicamente las conexiones HMR de Vite
 * y prevenir el error "The user aborted a request"
 */
export const ViteHMRErrorHandler: React.FC = () => {
  useEffect(() => {
    // Función para interceptar y mejorar las conexiones WebSocket
    const patchWebSocket = () => {
      const originalWebSocket = window.WebSocket;
      
      // Reemplazar el constructor de WebSocket para añadir gestión de errores
      window.WebSocket = function(url: string, protocols?: string | string[]) {
        // Verificar si es una conexión HMR de Vite
        const isViteHMR = typeof url === 'string' && 
          (url.includes('vite-hmr') || url.includes('/__vite-hmr'));
        
        // Crear la instancia de WebSocket
        const ws = new originalWebSocket(url, protocols);
        
        if (isViteHMR) {
          // Mejorar el manejo de errores para conexiones HMR
          const originalSend = ws.send;
          ws.send = function(data) {
            try {
              return originalSend.call(ws, data);
            } catch (err) {
              logger.warn('Error interceptado en WebSocket.send de Vite HMR:', err);
              // No propagar errores para evitar que rompan la aplicación
              return false;
            }
          };
          
          // Añadir manejador de error más robusto
          ws.addEventListener('error', (event) => {
            logger.warn('Error interceptado en conexión WebSocket de Vite HMR:', event);
            // Prevenir que errores de WebSocket provoquen crashes en la aplicación
            event.preventDefault();
            event.stopPropagation();
          }, { capture: true });
        }
        
        return ws;
      } as any;
      
      // Conservar las propiedades estáticas y prototipos
      window.WebSocket.prototype = originalWebSocket.prototype;
      Object.setPrototypeOf(window.WebSocket, originalWebSocket);
    };
    
    // Aplicar el parche solo en entorno de desarrollo
    if (import.meta.env.DEV) {
      try {
        patchWebSocket();
        logger.info('WebSocket mejorado para prevenir errores de Vite HMR');
      } catch (error) {
        logger.error('Error al aplicar parche WebSocket:', error);
      }
    }
    
    // Manejar errores a nivel global para evitar crashes por WebSocket
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Verificar si es un error relacionado con WebSocket
      if (
        event.reason && 
        (event.reason.message?.includes('WebSocket') || 
         event.reason.message?.includes('aborted'))
      ) {
        logger.warn('Interceptado error de rechazo no manejado en WebSocket:', event.reason);
        event.preventDefault();
      }
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  return null; // Este componente no renderiza nada
};

export default WebSocketProvider;