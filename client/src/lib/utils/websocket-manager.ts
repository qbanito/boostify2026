import { logger } from "../logger";
/**
 * WebSocket Manager
 * 
 * Utilidad para gestionar conexiones WebSocket con reconexión automática
 * y manejo de errores mejorado para prevenir "The user aborted a request"
 */

interface WebSocketOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  protocols?: string | string[];
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private manuallyDisconnected: boolean = false;
  private protocols?: string | string[];
  
  // Manejadores de eventos
  private onOpenHandler: ((event: Event) => void) | null = null;
  private onMessageHandler: ((event: MessageEvent) => void) | null = null;
  private onCloseHandler: ((event: CloseEvent) => void) | null = null;
  private onErrorHandler: ((event: Event) => void) | null = null;
  
  constructor(options: WebSocketOptions) {
    this.url = options.url;
    this.reconnectInterval = options.reconnectInterval || 2000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.protocols = options.protocols;
    
    // Guardar los manejadores de eventos
    if (options.onOpen) this.onOpenHandler = options.onOpen;
    if (options.onMessage) this.onMessageHandler = options.onMessage;
    if (options.onClose) this.onCloseHandler = options.onClose;
    if (options.onError) this.onErrorHandler = options.onError;
    
    // Conectar inmediatamente
    this.connect();
  }
  
  /**
   * Establece la conexión WebSocket con manejo de errores mejorado
   */
  public connect(): void {
    if (this.ws !== null) {
      this.cleanupConnection();
    }
    
    try {
      this.ws = new WebSocket(this.url, this.protocols);
      
      // Configurar manejadores de eventos con captura de errores mejorada
      this.ws.addEventListener('open', this.handleOpen);
      this.ws.addEventListener('message', this.handleMessage);
      this.ws.addEventListener('close', this.handleClose);
      this.ws.addEventListener('error', this.handleError);
      
      // Restablecer el contador de intentos de reconexión si se conecta con éxito
      this.manuallyDisconnected = false;
    } catch (error) {
      logger.error('Error al crear la conexión WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Envía datos a través de la conexión WebSocket
   * @param data Los datos a enviar
   * @returns true si se envió con éxito, false en caso contrario
   */
  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.warn('Intento de envío en una conexión WebSocket cerrada o no inicializada');
      return false;
    }
    
    try {
      this.ws.send(data);
      return true;
    } catch (error) {
      logger.error('Error al enviar datos por WebSocket:', error);
      return false;
    }
  }
  
  /**
   * Cierra la conexión WebSocket de manera controlada
   */
  public disconnect(): void {
    this.manuallyDisconnected = true;
    this.cleanupConnection();
    
    // Limpiar intentos de reconexión
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Verifica si la conexión está abierta y activa
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Limpia los recursos de la conexión actual
   */
  private cleanupConnection(): void {
    if (!this.ws) return;
    
    try {
      // Eliminar todos los event listeners para evitar fugas de memoria
      this.ws.removeEventListener('open', this.handleOpen);
      this.ws.removeEventListener('message', this.handleMessage);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.removeEventListener('error', this.handleError);
      
      // Solo intentar cerrar si la conexión está abierta o en proceso de conectarse
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Closed by client');
      }
    } catch (error) {
      logger.warn('Error al limpiar la conexión WebSocket:', error);
    } finally {
      this.ws = null;
    }
  }
  
  /**
   * Programa un intento de reconexión
   */
  private scheduleReconnect(): void {
    if (this.manuallyDisconnected || this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(
        this.manuallyDisconnected
          ? 'Reconexión no programada: desconexión manual'
          : `Reconexión abandonada después de ${this.reconnectAttempts} intentos`
      );
      return;
    }
    
    // Limpiar cualquier temporizador existente
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
    }
    
    // Incrementar el contador de intentos
    this.reconnectAttempts++;
    
    // Programar reconexión con retroceso exponencial
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 30000);
    
    logger.info(`Programando reconexión WebSocket en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      logger.info(`Intentando reconexión WebSocket (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }
  
  // Métodos de gestión de eventos con captura de errores y bind
  private handleOpen = (event: Event): void => {
    this.reconnectAttempts = 0; // Restablecer contador al conectarse exitosamente
    
    if (this.onOpenHandler) {
      try {
        this.onOpenHandler(event);
      } catch (error) {
        logger.error('Error en el manejador onOpen:', error);
      }
    }
  };
  
  private handleMessage = (event: MessageEvent): void => {
    if (this.onMessageHandler) {
      try {
        this.onMessageHandler(event);
      } catch (error) {
        logger.error('Error en el manejador onMessage:', error);
      }
    }
  };
  
  private handleClose = (event: CloseEvent): void => {
    if (this.onCloseHandler) {
      try {
        this.onCloseHandler(event);
      } catch (error) {
        logger.error('Error en el manejador onClose:', error);
      }
    }
    
    // Solo intentar reconectar para cierres no limpios o si no fue manual
    if ((!event.wasClean || event.code !== 1000) && !this.manuallyDisconnected) {
      logger.warn(`Conexión WebSocket cerrada con código ${event.code}. Motivo: ${event.reason || 'Sin motivo específico'}`);
      this.scheduleReconnect();
    }
  };
  
  private handleError = (event: Event): void => {
    logger.error('Error de WebSocket:', event);
    
    if (this.onErrorHandler) {
      try {
        this.onErrorHandler(event);
      } catch (error) {
        logger.error('Error en el manejador onError:', error);
      }
    }
    
    // Limpiar la conexión en caso de error para prevenir fugas
    this.cleanupConnection();
    
    // Programar reconexión si no fue desconectado manualmente
    if (!this.manuallyDisconnected) {
      this.scheduleReconnect();
    }
  };
}

export default WebSocketManager;