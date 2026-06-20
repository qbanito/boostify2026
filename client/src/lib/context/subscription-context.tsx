/**
 * Contexto para gestionar la información de suscripción del usuario
 * MIGRADO A POSTGRESQL - Noviembre 2025
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { logger } from "../logger";
import { useAuth } from '../../hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { isAdminEmail } from '../../../../shared/constants';

// Tipos de planes disponibles
// Soporta AMBAS nomenclaturas para compatibilidad:
// - Nueva: free, creator, professional, enterprise
// - Legacy: free, basic, pro, premium
export type PlanType = 'free' | 'creator' | 'professional' | 'enterprise' | 'basic' | 'pro' | 'premium';

// Mapeo de nomenclatura legacy a nueva
const PLAN_MAPPING: Record<string, string> = {
  'basic': 'creator',
  'pro': 'professional', 
  'premium': 'enterprise',
  // Los nuevos nombres se mapean a sí mismos
  'free': 'free',
  'creator': 'creator',
  'professional': 'professional',
  'enterprise': 'enterprise'
};

// Interfaz para los datos de suscripción
export interface Subscription {
  id: number;
  userId: number;
  plan: PlanType;
  status: 'active' | 'cancelled' | 'expired' | 'trialing' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  interval: 'monthly' | 'yearly';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isTrial: boolean;
  trialEndsAt?: Date;
  grantedByBundle?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interfaz de rol de usuario
export interface UserRole {
  id: number;
  userId: number;
  role: 'user' | 'moderator' | 'support' | 'admin';
  permissions: string[];
  grantedAt: Date;
}

// Interfaz para el contexto de suscripción
interface SubscriptionContextType {
  subscription: Subscription | null;
  currentPlan: PlanType;
  userRole: UserRole | null;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  hasAccess: (requiredPlan: PlanType) => boolean;
  isAdmin: () => boolean;
  hasPermission: (permission: string) => boolean;
}

// Crear contexto
const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  currentPlan: 'free',
  userRole: null,
  isLoading: true,
  error: null,
  refreshSubscription: async () => {},
  hasAccess: () => false,
  isAdmin: () => false,
  hasPermission: () => false,
});

/**
 * Función para obtener suscripción desde PostgreSQL
 */
async function fetchSubscription(userId: number): Promise<Subscription | null> {
  try {
    const response = await fetch(`/api/subscription/user/${userId}`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout to prevent hanging
    });
    
    const data = await response.json();
    
    // Convert date strings to Date objects
    if (data) {
      return {
        ...data,
        currentPeriodStart: new Date(data.currentPeriodStart),
        currentPeriodEnd: new Date(data.currentPeriodEnd),
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : undefined,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      };
    }
    
    return null;
  } catch (error) {
    logger.debug('Subscription fetch (non-critical):', error instanceof Error ? error.message : 'Unknown error');
    return null; // Return null instead of throwing to prevent breaking the app
  }
}

/**
 * Función para obtener rol de usuario desde PostgreSQL
 */
async function fetchUserRole(userId: number): Promise<UserRole | null> {
  try {
    const response = await fetch(`/api/user/role/${userId}`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout to prevent hanging
    });
    
    const data = await response.json();
    
    if (data) {
      return {
        ...data,
        grantedAt: new Date(data.grantedAt),
      };
    }
    
    return null;
  } catch (error) {
    logger.debug('User role fetch (non-critical):', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Proveedor de contexto de suscripción
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Calcular plan actual basado en el estado de la suscripción
  const currentPlan: PlanType = subscription?.status === 'active' || subscription?.status === 'trialing'
    ? subscription.plan 
    : 'free';
  
  // Cargar datos de suscripción cuando cambia el usuario
  useEffect(() => {
    const loadSubscriptionAndRole = async () => {
      if (!user?.id) {
        setSubscription(null);
        setUserRole(null);
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Cargar suscripción y rol en paralelo
        const [subscriptionData, roleData] = await Promise.all([
          fetchSubscription(user.id),
          fetchUserRole(user.id)
        ]);
        
        setSubscription(subscriptionData);
        setUserRole(roleData);
        
        // Only log if data was actually loaded
        if (subscriptionData || roleData) {
          logger.info('Subscription and role loaded:', {
            subscription: subscriptionData,
            role: roleData
          });
        }
      } catch (err: any) {
        // Silently fail - fetchSubscription and fetchUserRole now handle errors gracefully
        logger.debug('Error loading subscription and role (non-critical):', err?.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSubscriptionAndRole();
  }, [user?.id]);
  
  /**
   * Recargar datos de suscripción bajo demanda
   */
  const refreshSubscription = async (): Promise<void> => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const [subscriptionData, roleData] = await Promise.all([
        fetchSubscription(user.id),
        fetchUserRole(user.id)
      ]);
      
      setSubscription(subscriptionData);
      setUserRole(roleData);
    } catch (err: any) {
      logger.error('Error refreshing subscription:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Verificar si el usuario tiene acceso a un plan específico
   * Soporta AMBAS nomenclaturas: legacy (basic/pro/premium) y nueva (creator/professional/enterprise)
   * Jerarquía: free < creator/basic < professional/pro < enterprise/premium
   */
  const hasAccess = (requiredPlan: PlanType | string): boolean => {
    // Admin tiene acceso a todo (por rol o por email)
    if (userRole?.role === 'admin' || isAdminEmail(user?.email)) {
      return true;
    }
    
    // Normalizar nombres de planes a la nueva nomenclatura
    const normalizedCurrentPlan = PLAN_MAPPING[currentPlan] || currentPlan;
    const normalizedRequiredPlan = PLAN_MAPPING[requiredPlan] || requiredPlan;
    
    // Jerarquía usando nombres normalizados
    const planHierarchy = ['free', 'creator', 'professional', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(normalizedCurrentPlan);
    const requiredIndex = planHierarchy.indexOf(normalizedRequiredPlan);
    
    return currentIndex >= requiredIndex;
  };
  
  /**
   * Verificar si el usuario es administrador (por rol o por email)
   */
  const isAdmin = (): boolean => {
    return userRole?.role === 'admin' || isAdminEmail(user?.email);
  };
  
  /**
   * Verificar si el usuario tiene un permiso específico
   */
  const hasPermission = (permission: string): boolean => {
    // Admin tiene todos los permisos (por rol o por email)
    if (userRole?.role === 'admin' || isAdminEmail(user?.email)) {
      return true;
    }
    
    if (!userRole) return false;
    
    // Verificar permisos específicos
    return userRole.permissions?.includes(permission) || false;
  };
  
  const value: SubscriptionContextType = {
    subscription,
    currentPlan,
    userRole,
    isLoading,
    error,
    refreshSubscription,
    hasAccess,
    isAdmin,
    hasPermission,
  };
  
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Hook para usar el contexto de suscripción
 */
export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription debe usarse dentro de un SubscriptionProvider');
  }
  return context;
}
