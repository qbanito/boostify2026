import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocketStability } from '../../context/websocket-stability-provider';

interface UseWebSocketConnectionProps {
  url?: string;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectOnOpen?: boolean;
}

export function useWebSocketConnection({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectOnOpen = true,
}: UseWebSocketConnectionProps) {
  // Usar el proveedor de estabilidad WebSocket
  const { isConnected, sendMessage, reconnect } = useWebSocketStability();
  
  // Estado para seguimiento de mensajes
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [messageHistory, setMessageHistory] = useState<any[]>([]);
  
  // Referencias para seguimiento de callbacks
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  
  // Actualizar refs cuando cambian los callbacks
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
  }, [onMessage, onConnect, onDisconnect]);
  
  // Manejar cambios de estado de conexión
  useEffect(() => {
    if (isConnected) {
      console.log('[WSHook] Conexión WebSocket establecida');
      onConnectRef.current?.();
    } else {
      console.log('[WSHook] Conexión WebSocket perdida');
      onDisconnectRef.current?.();
    }
  }, [isConnected]);
  
  // Enviar mensaje al WebSocket con manejo de errores
  const send = useCallback((data: any) => {
    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      sendMessage(message);
      return true;
    } catch (error) {
      console.error('[WSHook] Error al enviar mensaje:', error);
      return false;
    }
  }, [sendMessage]);
  
  // Procesar mensajes recibidos
  const handleMessage = useCallback((data: any) => {
    try {
      // Procesar mensaje (convertir a objeto si es string JSON)
      let processedData;
      if (typeof data === 'string') {
        try {
          processedData = JSON.parse(data);
        } catch (e) {
          processedData = data;
        }
      } else {
        processedData = data;
      }
      
      // Actualizar estado
      setLastMessage(processedData);
      setMessageHistory(prev => [...prev.slice(-99), processedData]);
      
      // Llamar al callback proporcionado
      onMessageRef.current?.(processedData);
    } catch (error) {
      console.error('[WSHook] Error al procesar mensaje:', error);
    }
  }, []);
  
  // Forzar reconexión (accesible al usuario del hook)
  const forceReconnect = useCallback(() => {
    console.log('[WSHook] Forzando reconexión WebSocket');
    reconnect();
  }, [reconnect]);
  
  // Limpiar historial de mensajes
  const clearHistory = useCallback(() => {
    setMessageHistory([]);
    setLastMessage(null);
  }, []);
  
  return {
    isConnected,
    send,
    lastMessage,
    messageHistory,
    reconnect: forceReconnect,
    clearHistory
  };
}