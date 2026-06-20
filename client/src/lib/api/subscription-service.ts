import { apiRequest } from '../query-client';
import { logger } from "../logger";

/**
 * Tipos de planes de suscripción disponibles
 */
export type SubscriptionPlan = 'free' | 'artist' | 'basic' | 'pro' | 'premium' | 'creator' | 'professional' | 'enterprise';

/**
 * Jerarquía de planes para determinar acceso a características
 * Valores numéricos más altos tienen más acceso
 */
export const PLAN_HIERARCHY: Record<SubscriptionPlan, number> = {
  'free': 0,
  'artist': 5,
  'basic': 10,
  'creator': 10,
  'pro': 20,
  'professional': 20,
  'premium': 30,
  'enterprise': 30,
};

/**
 * Estado de la suscripción devuelto por la API
 */
export interface SubscriptionStatus {
  id: string | null;
  plan: string | null;
  currentPlan: SubscriptionPlan;
  status: string | null;
  active: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  priceId: string | null;
}

/**
 * Obtener el estado actual de la suscripción
 * @returns Promesa con el estado de la suscripción
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    // Intentamos obtener la suscripción con un timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 segundos de timeout
    
    const response = await apiRequest('/api/stripe/subscription-status', {
      signal: controller.signal
    }).catch(e => {
      logger.warn('Falló la solicitud de suscripción', e);
      return null;
    });
    
    clearTimeout(timeoutId);
    
    // Verificar si tenemos una respuesta válida, si no usar el fallback
    if (response && response.currentPlan) {
      return response;
    } else {
      logger.warn('La respuesta de suscripción no es válida, usando estado predeterminado');
      return getDefaultSubscriptionStatus();
    }
  } catch (error) {
    logger.error('Error al obtener el estado de la suscripción:', error);
    return getDefaultSubscriptionStatus();
  }
}

// Función separada para obtener un estado predeterminado
function getDefaultSubscriptionStatus(): SubscriptionStatus {
  return {
    id: null,
    plan: null,
    currentPlan: 'free', // Plan gratuito por defecto
    status: 'active', // Lo marcamos como activo
    active: true,     // Marcarlo activo para evitar problemas de navegación
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    priceId: null
  };
}

/**
 * Crear una nueva suscripción
 * @param planId ID del plan a suscribir
 * @returns URL de checkout de Stripe
 */
export async function createSubscription(planId: string): Promise<string> {
  const response = await apiRequest('/api/stripe/create-subscription', {
    method: 'POST',
    body: { priceId: planId }
  });
  
  if (!response.success || !response.url) {
    throw new Error(response.message || 'Error al crear la suscripción');
  }
  
  return response.url;
}

/**
 * Actualizar la suscripción actual a un nuevo plan
 * @param planId ID del nuevo plan
 * @returns URL de checkout de Stripe
 */
export async function updateSubscription(planId: string): Promise<string> {
  const response = await apiRequest('/api/stripe/update-subscription', {
    method: 'POST',
    body: { priceId: planId }
  });
  
  if (!response.success || !response.url) {
    throw new Error(response.message || 'Error al actualizar la suscripción');
  }
  
  return response.url;
}

/**
 * Cancelar la suscripción actual
 * @returns Resultado de la operación
 */
export async function cancelSubscription(): Promise<{ success: boolean; message: string }> {
  const response = await apiRequest('/api/stripe/cancel-subscription', {
    method: 'POST'
  });
  
  return {
    success: response.success,
    message: response.message || 'Suscripción cancelada correctamente'
  };
}

/**
 * Verifica si un plan tiene acceso a una característica
 * @param currentPlan Plan actual
 * @param requiredPlan Plan requerido
 * @returns true si tiene acceso
 */
export function canAccessFeature(
  currentPlan: SubscriptionPlan,
  requiredPlan: SubscriptionPlan
): boolean {
  if (!currentPlan || !requiredPlan) {
    return false;
  }
  
  return PLAN_HIERARCHY[currentPlan] >= PLAN_HIERARCHY[requiredPlan];
}

/**
 * Determina el nombre legible del plan para mostrar
 * @param plan Identificador del plan
 * @returns Nombre legible del plan
 */
export function getPlanDisplayName(plan: SubscriptionPlan): string {
  const displayNames: Record<SubscriptionPlan, string> = {
    'free': 'Discover (Free)',
    'artist': 'Artist',
    'basic': 'Elevate',
    'creator': 'Elevate',
    'pro': 'Amplify',
    'professional': 'Amplify',
    'premium': 'Dominate',
    'enterprise': 'Dominate',
  };
  
  return displayNames[plan] || 'Plan Desconocido';
}

/**
 * Determina el precio del plan
 * @param plan Identificador del plan
 * @returns Precio mensual del plan
 */
export function getPlanPrice(plan: SubscriptionPlan): number {
  const prices: Record<SubscriptionPlan, number> = {
    'free': 0,
    'artist': 19.99,
    'basic': 49.99,
    'creator': 49.99,
    'pro': 89.99,
    'professional': 89.99,
    'premium': 149.99,
    'enterprise': 149.99,
  };
  
  return prices[plan] || 0;
}

/**
 * Obtiene las características disponibles para cada plan
 * @returns Mapa de planes con sus características
 */
export function getPlanFeatures(): Record<SubscriptionPlan, string[]> {
  return {
    'free': [
      'Acceso a cursos básicos',
      'Análisis de 1 canción por mes',
      'Compartir en redes sociales'
    ],
    'basic': [
      'Todo lo incluido en el plan Gratuito',
      'Acceso a todos los cursos básicos',
      'Análisis de 5 canciones por mes',
      'Herramientas de producción básicas',
      'Soporte por email'
    ],
    'pro': [
      'Todo lo incluido en el plan Básico',
      'Acceso a cursos avanzados',
      'Análisis ilimitado de canciones',
      'Herramientas de producción avanzadas',
      'Soporte prioritario',
      'Masterización de 3 canciones por mes'
    ],
    'premium': [
      'Todo lo incluido en el plan Pro',
      'Acceso a masterclasses exclusivas',
      'Sesiones 1-a-1 con productores',
      'Distribución de música en plataformas',
      'Masterización ilimitada',
      'Análisis de mercado y audiencia',
      'Soporte 24/7'
    ]
  };
}