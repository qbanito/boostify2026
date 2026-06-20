import React, { useEffect, useState } from 'react';
import { logger } from "../lib/logger";
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { useSubscription } from '../lib/context/subscription-context';
import { apiRequest } from '../lib/query-client';

/**
 * This page is displayed after a successful subscription purchase
 * Stripe redirects to this page after checkout completion
 */
export default function SubscriptionSuccessPage() {
  const { refreshSubscription } = useSubscription();
  const [activating, setActivating] = useState(true);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Activar suscripción cuando la página carga
  useEffect(() => {
    const activateSubscription = async () => {
      try {
        // Obtener el sessionId de los parámetros de URL
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');
        
        if (!sessionId) {
          logger.error('No session_id en URL');
          setError('No se encontró información de pago');
          setActivating(false);
          return;
        }
        
        logger.info('Activando suscripción con sessionId:', sessionId);
        
        // Llamar al endpoint para activar la suscripción
        await apiRequest('/api/stripe/activate-subscription', {
          method: 'POST',
          body: { sessionId }
        });
        
        logger.info('Suscripción activada, refrescando datos...');
        
        // Esperar un momento para que Firestore se actualice
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refrescar la suscripción desde Firestore
        await refreshSubscription();
        
        setActivated(true);
        setActivating(false);
        
      } catch (err: any) {
        logger.error('Error al activar suscripción:', err);
        setError(err.message || 'Error al activar la suscripción');
        setActivating(false);
      }
    };
    
    activateSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  if (activating) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Activating your subscription...</h2>
            <p className="text-muted-foreground">Please wait while we set up your account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-16">
        <Card className="border-red-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-red-600">Activation Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p>{error}</p>
            <p className="text-muted-foreground">
              Please contact support if the problem persists.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/">Go Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-2xl mx-auto px-4 py-16">
      <Card className="border-green-200">
        <CardHeader className="text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <CardTitle className="text-2xl sm:text-3xl">Subscription Activated!</CardTitle>
          <CardDescription className="text-lg">
            Thank you for subscribing to Boostify.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p>
            Your subscription has been activated successfully. You now have access to premium features based on your chosen plan.
          </p>
          <p className="text-muted-foreground">
            You will receive a confirmation email with your subscription details shortly.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
          <Button asChild data-testid="button-view-subscription">
            <Link href="/account">
              View Subscription
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-go-dashboard">
            <Link href="/">
              Go to Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}