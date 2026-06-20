/**
 * Hook para centralizar las consultas al historial de llamadas
 * 
 * Este hook sirve como caché global para el historial de llamadas,
 * evitando múltiples consultas a Firestore desde diferentes componentes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { advisorCallService, AdvisorCall } from '../lib/services/advisor-call-service';

interface CallHistoryState {
  calls: AdvisorCall[];
  totalCalls: number;
  totalDuration: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Estado inicial
const initialState: CallHistoryState = {
  calls: [],
  totalCalls: 0,
  totalDuration: 0,
  isLoading: true,
  error: null,
  lastUpdated: null
};

// Cache compartido para evitar múltiples consultas innecesarias
let globalCallHistory: CallHistoryState = {...initialState};
let globalListeners: Array<(state: CallHistoryState) => void> = [];

// Función para notificar a todos los suscriptores sobre cambios
const notifyListeners = (newState: CallHistoryState) => {
  globalCallHistory = newState;
  globalListeners.forEach(listener => listener(newState));
};

/**
 * Hook para acceder y gestionar el historial de llamadas a asesores
 * 
 * @param maxResults Número máximo de resultados a obtener
 * @returns Estado del historial y funciones para actualizarlo
 */
export function useAdvisorCallHistory(maxResults: number = 100) {
  const { user } = useAuth();
  const [state, setState] = useState<CallHistoryState>(globalCallHistory);
  
  // Función para cargar el historial desde Firestore
  const fetchCallHistory = useCallback(async (force: boolean = false) => {
    // Si ya tenemos datos y no es una carga forzada, usamos la caché
    if (globalCallHistory.calls.length > 0 && 
        globalCallHistory.lastUpdated && 
        !force && 
        (new Date().getTime() - globalCallHistory.lastUpdated.getTime() < 60000)) {
      setState(globalCallHistory);
      return;
    }
    
    if (!user) {
      const emptyState = {
        ...initialState,
        isLoading: false
      };
      notifyListeners(emptyState);
      return;
    }
    
    try {
      // Marcar como cargando
      notifyListeners({
        ...globalCallHistory,
        isLoading: true,
        error: null
      });
      
      // Obtener datos de Firestore
      const history = await advisorCallService.getUserCallHistory(maxResults);
      
      // Actualizar estado global
      const newState = {
        calls: history.calls,
        totalCalls: history.totalCalls,
        totalDuration: history.totalDuration,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      };
      
      notifyListeners(newState);
    } catch (err: any) {
      console.error('Error loading call history:', err);
      
      const errorState = {
        ...globalCallHistory,
        isLoading: false,
        error: err.message || 'Error loading call history'
      };
      
      notifyListeners(errorState);
    }
  }, [user, maxResults]);
  
  // Efecto para registrar y limpiar el listener
  useEffect(() => {
    // Función específica para este componente
    const listener = (newState: CallHistoryState) => {
      setState(newState);
    };
    
    // Registrar listener
    globalListeners.push(listener);
    
    // Cargar datos iniciales si es necesario
    if (user && (globalCallHistory.calls.length === 0 || !globalCallHistory.lastUpdated)) {
      fetchCallHistory();
    } else {
      // Usar caché existente
      setState(globalCallHistory);
    }
    
    // Limpiar al desmontar
    return () => {
      globalListeners = globalListeners.filter(l => l !== listener);
    };
  }, [user, fetchCallHistory]);
  
  return {
    ...state,
    refresh: () => fetchCallHistory(true)
  };
}

/**
 * Hook simplificado para verificar si el usuario ha alcanzado su límite de llamadas
 * Utiliza la caché compartida para evitar consultas repetidas
 * 
 * @param plan Plan de suscripción actual
 * @returns Información sobre el límite de llamadas
 */
export function useCallLimits(plan: string = 'free') {
  const { calls, isLoading, error, refresh } = useAdvisorCallHistory();
  
  // Calcular límites basados en el historial en caché
  const callLimit = advisorCallService.getMonthlyCallLimit(plan);
  const callsUsed = isLoading ? 0 : calls.length;
  const hasReachedLimit = callsUsed >= callLimit;
  const callsRemaining = Math.max(0, callLimit - callsUsed);
  
  return {
    isLoading,
    error,
    hasReachedLimit,
    callsUsed,
    callLimit,
    callsRemaining,
    refresh
  };
}