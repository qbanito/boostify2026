import { useState, useEffect } from 'react';
import { useSubscription } from '../lib/context/subscription-context';
import { SubscriptionPlan } from '../lib/api/subscription-service';

/**
 * Opciones para el hook useSubscriptionFeature
 */
export interface UseSubscriptionFeatureOptions {
  /**
   * Lista de correos electrónicos de administradores que siempre tienen acceso
   */
  adminEmails?: string[];
}

/**
 * Hook para controlar el acceso a características basadas en el plan de suscripción
 * 
 * @param requiredPlan Plan requerido para acceder a la característica
 * @param options Opciones adicionales
 * @returns Información sobre si el usuario tiene acceso y estado de carga
 */
export function useSubscriptionFeature(
  requiredPlan: SubscriptionPlan,
  options?: UseSubscriptionFeatureOptions
) {
  const { subscription, isLoading, user, hasAccess: checkAccess } = useSubscription();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  
  useEffect(() => {
    // Verificar si el usuario es administrador
    if (user?.email && options?.adminEmails) {
      setIsAdmin(options.adminEmails.includes(user.email));
    } else {
      setIsAdmin(false);
    }
    
    // Determinar si tiene acceso basado en el plan de suscripción o si es admin
    if (isAdmin) {
      setHasAccess(true);
    } else {
      // Usar la función hasAccess del contexto de suscripción
      setHasAccess(checkAccess(requiredPlan));
    }
  }, [user, checkAccess, requiredPlan, isAdmin, options?.adminEmails]);

  return {
    hasAccess,
    isLoading,
    isAdmin,
    plan: subscription?.currentPlan || 'free',
    requiredPlan,
    upgradeUrl: hasAccess ? null : '/pricing'
  };
}

export default useSubscriptionFeature;