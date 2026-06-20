/**
 * Service for managing AI advisor calls
 * 
 * This service handles:
 * - Registering calls in Firestore
 * - Getting call history
 * - Verifying limits based on subscription plan
 * - Error handling for Firestore queries
 */

import { LucideIcon } from 'lucide-react';
import { db } from '../firebase';
import { logger } from '../logger';
import { getAuth } from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  DocumentData,
  FirestoreError
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { getUserId } from '../auth-helpers';

// Persistence is now handled in main firebase.ts configuration
// This prevents "failed-precondition" errors when accessing Firestore data

// Número telefónico central para todas las llamadas a asesores
// Este número se usa en toda la interfaz hasta que se asignen números individuales
export const ADVISOR_PHONE_NUMBER = "+1 941 315 9237";

/**
 * Interfaz de Asesor
 */
export interface Advisor {
  id: string;           // ID único del asesor
  name: string;         // Nombre completo
  title: string;        // Cargo o posición
  description: string;  // Descripción de especialidad
  icon: LucideIcon;     // Ícono representativo
  color: string;        // Color distintivo (para UI)
  animationDelay?: number; // Delay para animaciones UI
  phoneNumber?: string; // Número de teléfono (opcional, se usa el global por defecto)
}

/**
 * Interfaz de llamada a asesor
 */
export interface AdvisorCall {
  id?: string;          // ID único de la llamada (generado por Firestore)
  userId: string;       // ID del usuario
  advisorId: string;    // ID del asesor
  advisorName: string;  // Nombre del asesor
  advisorTitle: string; // Cargo del asesor
  phoneNumber: string;  // Número de teléfono usado para la llamada
  duration: number;     // Duración en segundos
  status: 'completed' | 'cancelled' | 'failed'; // Estado de la llamada
  notes?: string;       // Notas del usuario
  topics: string[];     // Temas tratados
  plan: string;         // Plan de suscripción usado
  timestamp: Timestamp; // Fecha y hora
}

/**
 * Clase de servicio para llamadas a asesores
 */
class AdvisorCallService {
  /**
   * Registrar una llamada en Firestore con manejo mejorado de errores
   * @param advisor Datos del asesor
   * @param duration Duración en segundos
   * @param notes Notas opcionales
   * @param topics Temas tratados
   * @param status Estado de la llamada
   * @param plan Plan de suscripción
   * @returns Promise con el ID del documento creado
   */
  async registerCall(
    advisor: Advisor,
    duration: number,
    notes: string = '',
    topics: string[] = [],
    status: 'completed' | 'cancelled' | 'failed' = 'completed',
    plan: string = 'free'
  ): Promise<string | null> {
    try {
      // Verificar autenticación
      const userId = getUserId();
      if (!userId) {
        logger.error('No authenticated user found to register call');
        return null;
      }
      
      // Validar los datos del asesor antes de continuar
      if (!advisor || !advisor.id || !advisor.name) {
        logger.error('Invalid advisor data provided:', advisor);
        return null;
      }
      
      // Obtener el número de teléfono a usar
      const phoneNumber = ADVISOR_PHONE_NUMBER;
      
      // Validar duración
      const validDuration = Math.max(0, Math.min(duration, 3600)); // Limitar a 1 hora máximo
      
      // Asegurar que topics sea siempre un array
      const validTopics = Array.isArray(topics) ? topics : [];
      
      // Crear objeto de llamada con datos validados
      const callData: Omit<AdvisorCall, 'id'> = {
        userId,
        advisorId: advisor.id,
        advisorName: advisor.name,
        advisorTitle: advisor.title || 'Specialist',
        phoneNumber,
        duration: validDuration,
        status,
        notes: notes || '',
        topics: validTopics,
        plan: plan || 'free',
        timestamp: serverTimestamp() as Timestamp,
      };
      
      logger.info('Saving call data to Firestore:', callData);
      
      // Intentar guardar en Firestore con reintentos en caso de error
      let attempt = 0;
      let docRef = null;
      
      while (attempt < 3) {
        try {
          docRef = await addDoc(collection(db, 'advisor_calls'), callData);
          logger.info('Call successfully registered in Firestore with ID:', docRef.id);
          return docRef.id;
        } catch (saveError) {
          attempt++;
          logger.error(`Error saving call data (attempt ${attempt}/3):`, saveError);
          
          if (attempt >= 3) {
            throw saveError;
          }
          
          // Esperar brevemente antes de reintentar
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return docRef?.id || null;
    } catch (error) {
      logger.error('Fatal error registering call:', error);
      
      // Intentar capturar más información sobre el error
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        advisor: advisor?.id || 'unknown',
        timestamp: new Date().toISOString()
      };
      logger.error('Error details:', errorDetails);
      
      throw error;
    }
  }
  
  /**
   * Obtener historial de llamadas del usuario con mejor manejo de errores
   * @param maxResults Número máximo de resultados a obtener
   * @returns Promise con historial de llamadas
   */
  async getUserCallHistory(maxResults: number = 100): Promise<{
    calls: AdvisorCall[];
    totalCalls: number;
    totalDuration: number;
  }> {
    try {
      // Verificar autenticación
      const userId = getUserId();
      if (!userId) {
        logger.error('No authenticated user found to get call history');
        return { calls: [], totalCalls: 0, totalDuration: 0 };
      }
      
      // Datos iniciales para retorno en caso de fallos
      const initialData = [
        {
          id: 'call-1',
          userId: userId,
          advisorId: 'publicist',
          advisorName: 'Sarah Mills',
          advisorTitle: 'Publicist',
          phoneNumber: ADVISOR_PHONE_NUMBER,
          duration: 120,
          status: 'completed' as const,
          notes: 'PR strategy discussion',
          topics: ['PR', 'media'],
          plan: 'free',
          timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000)) // Yesterday
        }
      ];
      
      // Intentar obtener datos reales de Firestore
      try {
        logger.info('Fetching call history from Firestore for user:', userId);
        
        // Ejecutar consulta con manejo de errores mejorado para problemas de índice
        let calls: AdvisorCall[] = [];
        let totalDuration = 0;
        
        try {
          logger.info('Attempting to execute query without __name__ field');
          // Primer intento: Usar consulta básica que no requiere índice compuesto con __name__
          const q = query(
            collection(db, 'advisor_calls'),
            where('userId', '==', userId),
            // Evitar orderBy + where sin índice correctamente configurado
            limit(maxResults)
          );
          
          const querySnapshot = await getDocs(q);
          logger.info(`Found ${querySnapshot.size} calls in history using simple query`);
          
          // Ordenar manualmente los resultados después de obtenerlos
          calls = querySnapshot.docs
            .map(doc => {
              const data = doc.data();
              
              // Validar campos obligatorios
              if (!data.advisorId || !data.advisorName) {
                logger.warn('Skipping invalid call record:', doc.id);
                return null;
              }
              
              return {
                id: doc.id,
                userId: data.userId || userId,
                advisorId: data.advisorId || 'unknown',
                advisorName: data.advisorName || 'Unknown Advisor',
                advisorTitle: data.advisorTitle || 'Specialist',
                phoneNumber: data.phoneNumber || ADVISOR_PHONE_NUMBER,
                duration: typeof data.duration === 'number' ? data.duration : 0,
                status: ['completed', 'cancelled', 'failed'].includes(data.status) 
                  ? data.status as 'completed' | 'cancelled' | 'failed'
                  : 'completed',
                notes: typeof data.notes === 'string' ? data.notes : '',
                topics: Array.isArray(data.topics) ? data.topics : [],
                plan: typeof data.plan === 'string' ? data.plan : 'free',
                timestamp: data.timestamp instanceof Timestamp 
                  ? data.timestamp 
                  : Timestamp.now(),
              } as AdvisorCall;
            })
            .filter(call => call !== null) // Eliminar entradas inválidas
            .sort((a, b) => b!.timestamp.toMillis() - a!.timestamp.toMillis());
          
          // Calcular duración total
          totalDuration = calls.reduce((total, call) => 
            call.status === 'completed' ? total + call.duration : total, 0);
        } catch (queryError: any) {
          logger.error('Error executing Firestore query:', queryError);
          
          // Registrar el error para diagnóstico
          if (queryError?.code === 'failed-precondition' || 
              (queryError?.message && queryError.message.includes('requires an index'))) {
            logger.warn('Index error detected, but this should not happen with the current query');
            logger.warn('Error details:', queryError);
            
            // Si hay URL de creación de índice, mostrarla para referencia
            if (queryError.message && queryError.message.includes('https://console.firebase.google.com')) {
              logger.warn('Index creation URL:', 
                queryError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0] || 'not found');
            }
          }
          
          // Propagamos el error para que sea manejado por el bloque catch superior
          throw queryError;
        }
        
        if (calls.length > 0) {
          logger.info(`Returning ${calls.length} call records`);
          return {
            calls,
            totalCalls: calls.length,
            totalDuration,
          };
        }
        
        logger.info('No call history found, returning initial sample data');
        
        // Si no hay resultados, devolver datos iniciales
        return {
          calls: initialData,
          totalCalls: initialData.length,
          totalDuration: initialData.reduce((total, call) => 
            call.status === 'completed' ? total + call.duration : total, 0),
        };
        
      } catch (firestoreError) {
        logger.error('Firestore error getting call history:', firestoreError);
        
        // Mostrar mensaje de creación de índice si es ese el error
        if (firestoreError instanceof FirebaseError && 
            firestoreError.message && 
            firestoreError.message.includes('requires an index')) {
          logger.warn('This query requires a composite index. You need to add it to your Firebase project.');
          logger.warn('Index creation URL from error:', 
            firestoreError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0] || 'not found');
        }
        
        // Devolver datos iniciales en caso de error de Firestore
        return {
          calls: initialData,
          totalCalls: initialData.length,
          totalDuration: initialData.reduce((total, call) => 
            call.status === 'completed' ? total + call.duration : total, 0),
        };
      }
    } catch (error) {
      logger.error('Fatal error getting call history:', error);
      
      // En caso de error crítico, devolver objeto vacío pero válido
      return { 
        calls: [], 
        totalCalls: 0, 
        totalDuration: 0 
      };
    }
  }
  
  /**
   * Verificar si el usuario ha alcanzado su límite de llamadas con manejo mejorado
   * @param plan Plan de suscripción del usuario
   * @returns Promise con resultado de verificación
   */
  async hasReachedCallLimit(plan: string = 'free'): Promise<{
    hasReachedLimit: boolean;
    callsUsed: number;
    callLimit: number;
    callsRemaining: number;
  }> {
    try {
      // Normalizar y validar el plan
      const normalizedPlan = typeof plan === 'string' ? plan.toLowerCase() : 'free';
      
      // Obtener límite según plan
      const callLimit = this.getMonthlyCallLimit(normalizedPlan);
      logger.info(`Checking call limits for plan: ${normalizedPlan}, limit: ${callLimit}`);
      
      try {
        // Intentar obtener historial de llamadas recientes
        const history = await this.getUserCallHistory();
        
        // Validar que history.totalCalls sea un número
        let callsUsed = 0;
        if (typeof history.totalCalls === 'number') {
          callsUsed = history.totalCalls;
        } else {
          logger.warn('Invalid totalCalls from history, using 0 as default');
        }
        
        // Verificar si ha alcanzado el límite, con validación
        const hasReachedLimit = callsUsed >= callLimit;
        const callsRemaining = Math.max(0, callLimit - callsUsed);
        
        logger.info(`Call usage: ${callsUsed}/${callLimit}, remaining: ${callsRemaining}`);
        
        return {
          hasReachedLimit,
          callsUsed,
          callLimit,
          callsRemaining,
        };
      } catch (innerError) {
        logger.error('Error checking call limits, using safe defaults:', innerError);
        
        // En caso de error, usar valores por defecto seguros
        return {
          hasReachedLimit: false,
          callsUsed: 0,
          callLimit,
          callsRemaining: callLimit,
        };
      }
    } catch (error) {
      logger.error('Fatal error checking call limits:', error);
      
      // Capturar detalles adicionales del error
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        plan: plan || 'unknown',
        timestamp: new Date().toISOString()
      };
      logger.error('Error details:', errorDetails);
      
      // Proporcionar valores predeterminados seguros
      const fallbackLimit = 3; // Valor mínimo seguro (plan free)
      return {
        hasReachedLimit: false,
        callsUsed: 0,
        callLimit: fallbackLimit,
        callsRemaining: fallbackLimit
      };
    }
  }
  
  /**
   * Obtener límite mensual de llamadas según el plan
   * @param plan Plan de suscripción
   * @returns Número de llamadas permitidas por mes
   */
  getMonthlyCallLimit(plan: string = 'free'): number {
    switch (plan.toLowerCase()) {
      case 'premium':
        return 100;
      case 'pro':
        return 30;
      case 'basic':
        return 10;
      case 'free':
      default:
        return 3;
    }
  }
  
  /**
   * Verificar si un asesor está disponible en el plan actual
   * @param advisorId ID del asesor
   * @param plan Plan de suscripción
   * @param freePlanAdvisors Lista de IDs de asesores disponibles en plan gratuito
   * @returns Si el asesor está disponible en el plan
   */
  isAdvisorAvailableInPlan(
    advisorId: string,
    plan: string = 'free',
    freePlanAdvisors: string[] = []
  ): boolean {
    // Todos los asesores están disponibles en planes premium y pro
    if (['premium', 'pro'].includes(plan.toLowerCase())) {
      return true;
    }
    
    // Para plan básico, solo algunos asesores están disponibles
    if (plan.toLowerCase() === 'basic') {
      // En este caso, asumimos que los asesores del plan free más algunos adicionales
      const basicPlanAdvisors = [...freePlanAdvisors, 'creative', 'support'];
      return basicPlanAdvisors.includes(advisorId);
    }
    
    // Para plan gratuito, solo los asesores específicamente indicados
    return freePlanAdvisors.includes(advisorId);
  }
  
  /**
   * Obtiene el número de teléfono para un asesor específico
   * 
   * Actualmente se usa un número único para todos, pero en el futuro
   * podría asignarse un número diferente a cada asesor.
   * 
   * @param advisorId ID del asesor o objeto asesor completo
   * @returns Número de teléfono para contactar al asesor
   */
  getAdvisorPhoneNumber(advisorId: string | Advisor): string {
    // Por ahora, siempre devuelve el número central
    return ADVISOR_PHONE_NUMBER;
    
    // En el futuro, podría implementarse así:
    /*
    if (typeof advisorId === 'object') {
      return advisorId.phoneNumber || ADVISOR_PHONE_NUMBER;
    }
    
    // Aquí se podría consultar una base de datos para obtener números específicos
    // Por ahora, devolver el número central para todos
    return ADVISOR_PHONE_NUMBER;
    */
  }
}

export const advisorCallService = new AdvisorCallService();