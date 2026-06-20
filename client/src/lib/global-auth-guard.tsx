import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useSubscription } from './context/subscription-context';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Crown } from 'lucide-react';
import { isAdminEmail } from '../../../shared/constants';

interface GlobalAuthGuardProps {
  children: React.ReactNode;
}

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/login',

  '/register',
  '/signup',
  '/dashboard',
  '/pricing',
  '/features',
  '/privacy',
  '/terms',
  '/cookies',
  '/resources',
  '/tips',
  '/guides',
  '/tools',
  '/blog',
  '/artist',
  '/investors',
];

/**
 * GlobalAuthGuard - SIMPLIFICADO para no bloquear la UI
 * Solo muestra modales cuando sea necesario, nunca bloquea el render
 */
export function GlobalAuthGuard({ children }: GlobalAuthGuardProps) {
  const { user, isAuthenticated } = useAuth();
  const { currentPlan } = useSubscription();
  const [location] = useLocation();
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Calcular valores derivados
  const isPublicRoute = useMemo(() => 
    PUBLIC_ROUTES.some(route => location === route || location.startsWith(route + '/')),
    [location]
  );

  const isAdmin = useMemo(() => 
    isAdminEmail(user?.email),
    [user?.email]
  );

  // Efecto para mostrar modal de suscripción si es necesario
  // PERO nunca bloquea el render
  useEffect(() => {
    // No mostrar modal en rutas públicas o si es admin
    if (isPublicRoute || isAdmin) {
      setShowSubscriptionModal(false);
      return;
    }

    // Si está autenticado pero no tiene plan, mostrar modal después de 2 segundos
    if (isAuthenticated && !currentPlan) {
      const timer = setTimeout(() => {
        setShowSubscriptionModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }

    setShowSubscriptionModal(false);
  }, [isAuthenticated, currentPlan, isPublicRoute, isAdmin]);

  // SIEMPRE renderizar children - nunca bloquear
  return (
    <>
      {children}

      {/* Modal de Subscripción - solo se muestra si necesario */}
      <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-orange-500" />
              Plan Requerido
            </DialogTitle>
            <DialogDescription>
              Para acceder a las funcionalidades de Boostify, necesitas seleccionar un plan.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Tenemos un plan gratuito que te permite explorar nuestras funcionalidades básicas, 
              o puedes elegir un plan premium para acceso completo.
            </p>
            
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Plan Gratuito</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✓ Acceso a funcionalidades básicas</li>
                <li>✓ Generación de imágenes limitada</li>
                <li>✓ Soporte por correo</li>
              </ul>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => window.location.href = '/pricing'}
                className="w-full"
              >
                Ver Planes y Seleccionar
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowSubscriptionModal(false)}
                className="w-full"
              >
                Continuar sin plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
