import React from 'react';
import { useLocation } from 'wouter';
import { useSubscriptionFeature } from '../../hooks/use-subscription-feature';
import { SubscriptionPlan } from '../../lib/api/subscription-service';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { AlertTriangle, Lock, ArrowRight } from 'lucide-react';

// Subscription feature access control component properties
export interface SubscriptionFeatureProps {
  // Minimum plan required to access this feature
  requiredPlan: SubscriptionPlan;
  // Content to display if the user has access
  children: React.ReactNode;
  // Optional: feature title (displayed in the blocked view)
  title?: string;
  // Optional: feature description (displayed in the blocked view)
  description?: string;
  // Optional: whether to show a preview of the feature
  preview?: boolean;
  // Optional: whether to hide silently (no upgrade UI)
  silent?: boolean;
  // Optional: admin email list that always have access
  adminEmails?: string[];
  // Optional: alternative redirect URL
  redirectUrl?: string;
}

/**
 * Component to restrict features based on the user's subscription plan
 * 
 * Controls access to specific application features based on
 * the user's subscription level. If the user doesn't have the required plan,
 * it displays a blocking message with an upgrade option.
 */
export function SubscriptionFeature({
  requiredPlan,
  children,
  title,
  description,
  preview = false,
  silent = false,
  adminEmails = ['convoycubano@gmail.com'], // Admin always has access
  redirectUrl
}: SubscriptionFeatureProps) {
  const [, setLocation] = useLocation();
  const {
    hasAccess,
    isLoading,
    upgradeUrl
  } = useSubscriptionFeature(requiredPlan, { adminEmails });
  
  // Function to navigate to another route
  const navigate = (to: string) => setLocation(to);

  // If loading, show a loading state
  if (isLoading) {
    return silent ? null : (
      <div className="flex items-center justify-center p-6 min-h-[100px] animate-pulse">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // If user has access, show content normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // If silent mode, don't show any upgrade UI
  if (silent) {
    return null;
  }

  // If preview mode, show content with a lock overlay
  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-lg">
        {/* Blurred content */}
        <div className="filter blur-sm pointer-events-none">
          {children}
        </div>
        
        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-gradient-to-b from-black/70 to-black/85 text-white backdrop-blur-sm">
          <Lock className="h-12 w-12 mb-4 text-amber-500" />
          <h3 className="text-xl font-bold mb-2">
            {title || `Premium ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Feature`}
          </h3>
          {description && <p className="mb-4 text-white/80">{description}</p>}
          <Button
            onClick={() => navigate(redirectUrl || '/pricing')}
            className="mt-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-md"
            style={{ padding: "0.5rem 1rem" }}
          >
            Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Standard blocked view (not preview, not silent)
  return (
    <Card className="p-6 flex flex-col items-center text-center shadow-md border-amber-500/20">
      <AlertTriangle className="h-12 w-12 mb-4 text-amber-500" />
      <h3 className="text-xl font-bold mb-2">
        {title || `Feature available in ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan`}
      </h3>
      {description && <p className="mb-4 text-muted-foreground">{description}</p>}
      <Button
        onClick={() => navigate(redirectUrl || '/pricing')}
        className="mt-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium shadow-md"
        style={{ padding: "0.5rem 1rem" }}
      >
        Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </Card>
  );
}

export default SubscriptionFeature;