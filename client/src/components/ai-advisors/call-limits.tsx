/**
 * Componente para mostrar los límites de llamadas del usuario
 * según su plan de suscripción actual
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';
import { useLocation } from 'wouter';
import { advisorCallService } from '../../lib/services/advisor-call-service';
import { useSubscription } from '../../lib/context/subscription-context';

// Componentes UI
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

// Iconos
import { Phone, ArrowRight, AlertCircle, InfoIcon } from 'lucide-react';

interface CallLimitsProps {
  variant?: 'default' | 'compact';
  showUpgradeButton?: boolean;
  className?: string;
}

export function CallLimits({
  variant = 'default',
  showUpgradeButton = true,
  className = '',
}: CallLimitsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { subscription, currentPlan } = useSubscription();
  const [callsUsed, setCallsUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Obtener el límite de llamadas según el plan
  const callLimit = advisorCallService.getMonthlyCallLimit(currentPlan);
  
  // Calcular el porcentaje de uso
  const usagePercentage = Math.min(Math.round((callsUsed / callLimit) * 100), 100);
  
  // Determinar el estado del límite
  const callsRemaining = callLimit - callsUsed;
  const hasReachedLimit = callsRemaining <= 0;
  
  // Cargar datos de uso de llamadas
  useEffect(() => {
    const loadCallUsage = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Obtener historial de llamadas para calcular uso
        const history = await advisorCallService.getUserCallHistory();
        
        // Actualizar estado
        setCallsUsed(history.totalCalls);
      } catch (err: any) {
        console.error('Error loading call usage:', err);
        setError(err.message || 'Error al cargar información de uso');
        
        // Notificar al usuario del error
        toast({
          title: 'Error',
          description: 'No se pudo cargar información sobre límites de llamadas',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCallUsage();
  }, [user, toast]);
  
  // Ir a la página de precios para actualizar plan
  const handleUpgrade = () => {
    setLocation('/pricing');
  };

  // Versión compacta del componente
  if (variant === 'compact') {
    return (
      <div className="bg-muted/30 rounded-lg p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Phone className="h-4 w-4 mr-2 text-primary" />
            <span className="text-sm font-medium">Llamadas a asesores</span>
          </div>
          <Badge variant={hasReachedLimit ? "destructive" : "outline"}>
            {currentPlan.toUpperCase()}
          </Badge>
        </div>
        
        <Progress 
          value={usagePercentage} 
          className={`h-2 mb-2 ${
            usagePercentage > 90 ? 'bg-red-200' : 
            usagePercentage > 70 ? 'bg-amber-200' : 'bg-muted'
          }`}
        />
        
        <div className="flex items-center justify-between text-xs">
          <span>
            {callsUsed} de {callLimit} utilizadas
          </span>
          <span className={`font-medium ${hasReachedLimit ? 'text-destructive' : ''}`}>
            {callsRemaining} restantes
          </span>
        </div>
        
        {hasReachedLimit && showUpgradeButton && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 text-xs"
            onClick={handleUpgrade}
          >
            Actualizar Plan
          </Button>
        )}
      </div>
    );
  }
  
  // Versión completa del componente (default)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Límites de Llamadas</CardTitle>
            <CardDescription>Tu plan actual te permite un número específico de llamadas mensuales a asesores</CardDescription>
          </div>
          <Badge 
            variant={
              currentPlan === 'premium' ? 'default' : 
              currentPlan === 'pro' ? 'secondary' : 
              currentPlan === 'basic' ? 'outline' : 'secondary'
            }
            className="uppercase"
          >
            Plan {currentPlan}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full border-4 border-muted-foreground/20 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Cargando datos de uso...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <p className="text-sm text-muted-foreground">Error al cargar datos de uso</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-full">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-medium">
                  {hasReachedLimit ? 'Límite alcanzado' : 'Llamadas disponibles'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {hasReachedLimit 
                    ? 'Has utilizado todas tus llamadas para este mes' 
                    : `Tienes ${callsRemaining} llamadas restantes este mes`}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uso mensual</span>
                <span className="font-medium">
                  {callsUsed} de {callLimit} llamadas
                </span>
              </div>
              
              <Progress 
                value={usagePercentage} 
                className={`h-3 ${
                  usagePercentage > 90 ? 'bg-red-200' : 
                  usagePercentage > 70 ? 'bg-amber-200' : 'bg-muted'
                }`}
              />
              
              <div className="text-xs text-muted-foreground flex justify-between mt-1">
                <span>0</span>
                <span>{Math.floor(callLimit / 2)}</span>
                <span>{callLimit}</span>
              </div>
            </div>
            
            <div className="mt-4 bg-muted/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InfoIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Límites de llamadas por plan</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Free: 3/mes • Basic: 10/mes • Pro: 30/mes • Premium: 100/mes
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      {showUpgradeButton && currentPlan !== 'premium' && (
        <CardFooter>
          <Button 
            onClick={handleUpgrade}
            className="w-full"
            variant={hasReachedLimit ? "default" : "outline"}
          >
            Actualizar a un plan superior
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}