import React, { ReactNode } from 'react';
import { useSubscription } from '../../lib/context/subscription-context';
import { SubscriptionPlan } from '../../lib/api/subscription-service';
import { Button } from '../ui/button';
import { useLocation } from 'wouter';
import { Skeleton } from '../ui/skeleton';
import { AlertTriangle } from 'lucide-react';

interface SubscriptionGateProps {
  children: ReactNode;
  requiredPlan: SubscriptionPlan;
  fallback?: ReactNode;
}

/**
 * SubscriptionGate component controls access to premium features based on subscription level
 * - Displays children if user has required subscription level
 * - Shows upgrade prompt or custom fallback if subscription is insufficient
 * - Shows loading state while checking subscription
 * 
 * @param children Content to display if user has access
 * @param requiredPlan Minimum subscription plan required for access
 * @param fallback Optional custom component to show if access is denied
 */
export function SubscriptionGate({
  children,
  requiredPlan,
  fallback
}: SubscriptionGateProps) {
  const { subscription, isLoading, hasAccess } = useSubscription();
  const [, navigate] = useLocation();

  // Show loading state while checking subscription
  if (isLoading) {
    return (
      <div className="w-full space-y-4 p-6 bg-muted/30 rounded-lg">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    );
  }

  // If user has access to the required plan, show the children
  if (hasAccess(requiredPlan)) {
    return <>{children}</>;
  }

  // If a custom fallback is provided, show it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  return (
    <div className="w-full p-6 bg-muted/20 border border-muted rounded-lg flex flex-col items-center justify-center space-y-4 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h3 className="text-lg font-medium">Premium Feature</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        This feature requires the {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan or higher. 
        Upgrade your subscription to access additional features.
      </p>
      <div className="flex gap-3 mt-4">
        <Button variant="outline" onClick={() => navigate('/')}>
          Go Back
        </Button>
        <Button onClick={() => navigate('/pricing')}>
          View Plans
        </Button>
      </div>
    </div>
  );
}