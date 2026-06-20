import React from 'react';
import { WebSocketStabilityProvider, WebSocketStatusIndicator } from '../../context/websocket-stability-provider';

// Opciones de configuración
const WEBSOCKET_URL = 'wss://' + window.location.host + '/websocket';
const RECONNECT_INTERVAL = 2000;
const MAX_RECONNECT_ATTEMPTS = 15;
const PING_INTERVAL = 20000;

interface AppWebSocketProviderProps {
  children: React.ReactNode;
  showStatusIndicator?: boolean;
}

/**
 * Proveedor de WebSocket para toda la aplicación
 * Proporciona una conexión estable con reconexión automática
 */
export function AppWebSocketProvider({ children, showStatusIndicator = true }: AppWebSocketProviderProps) {
  // Manejar mensajes entrantes de WebSocket
  const handleWebSocketMessage = (event: MessageEvent) => {
    try {
      // Intentar analizar el mensaje como JSON
      const data = JSON.parse(event.data);
      
      // Log de depuración
      if (!data.type || data.type !== 'ping') {
        console.log("[WebSocket] Mensaje recibido:", data);
      }
      
      // Disparar eventos personalizados para que otros componentes puedan escuchar
      if (data.type && data.payload) {
        const customEvent = new CustomEvent(`ws:${data.type}`, { 
          detail: data.payload 
        });
        window.dispatchEvent(customEvent);
      }
    } catch (error) {
      // Si no es JSON, manejar como cadena de texto
      console.log("[WebSocket] Mensaje de texto recibido:", event.data);
    }
  };

  return (
    <WebSocketStabilityProvider
      url={WEBSOCKET_URL}
      reconnectInterval={RECONNECT_INTERVAL}
      maxReconnectAttempts={MAX_RECONNECT_ATTEMPTS}
      pingInterval={PING_INTERVAL}
      onMessage={handleWebSocketMessage}
    >
      {children}
      {showStatusIndicator && <WebSocketStatusIndicator />}
    </WebSocketStabilityProvider>
  );
}