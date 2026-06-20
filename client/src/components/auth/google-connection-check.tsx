import { useState, useEffect } from 'react';
import { logger } from "@/lib/logger";

/**
 * Componente que verifica la conectividad con los servicios de Google antes
 * de intentar la autenticación. Esto puede ayudar a detectar problemas de red
 * o bloqueos que resultarían en errores de autenticación.
 */
export function useGoogleConnectionCheck() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [canConnect, setCanConnect] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Verificar conectividad con los dominios de Google necesarios para autenticación
  const checkGoogleConnection = async (): Promise<boolean> => {
    setIsConnecting(true);
    
    try {
      const domains = [
        'https://accounts.google.com/gsi/status', 
        'https://apis.google.com/js/api.js'
      ];
      
      // Intentar cargar recursos de Google con un timeout
      const promises = domains.map(domain => {
        return new Promise<boolean>(resolve => {
          const timeout = setTimeout(() => {
            logger.info(`Timeout connecting to ${domain}`);
            resolve(false);
          }, 5000);
          
          fetch(domain, { 
            method: 'HEAD',
            mode: 'no-cors' // Importante para evitar errores CORS
          })
            .then(() => {
              clearTimeout(timeout);
              resolve(true);
            })
            .catch(error => {
              logger.error(`Error connecting to ${domain}:`, error);
              clearTimeout(timeout);
              resolve(false);
            });
        });
      });
      
      const results = await Promise.all(promises);
      const canConnect = results.every(result => result);
      
      setCanConnect(canConnect);
      setLastChecked(new Date());
      logger.info(`Google connectivity check: ${canConnect ? 'Success' : 'Failed'}`);
      
      return canConnect;
    } catch (error) {
      logger.error('Error checking Google connectivity:', error);
      setCanConnect(false);
      setLastChecked(new Date());
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Verificar la conectividad cuando se monta el componente
  useEffect(() => {
    checkGoogleConnection();
  }, []);

  return {
    isConnecting,
    canConnect,
    lastChecked,
    checkGoogleConnection
  };
}