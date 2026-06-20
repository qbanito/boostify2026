import React, { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import { useSubscription } from '../lib/context/subscription-context';

/**
 * This page is displayed after a subscription cancellation
 */
export default function SubscriptionCancelledPage() {
  const { refreshSubscription, subscription } = useSubscription();
  const [hasRefreshed, setHasRefreshed] = useState(false);
  
  // Refresh subscription status when page loads (only once)
  useEffect(() => {
    if (!hasRefreshed) {
      refreshSubscription().finally(() => {
        setHasRefreshed(true);
      });
    }
  }, [hasRefreshed, refreshSubscription]);
  
  return (
    <div className="container max-w-2xl mx-auto px-4 py-16">
      <Card className="border-amber-200">
        <CardHeader className="text-center">
          <AlertCircle className="mx-auto mb-4 h-16 w-16 text-amber-500" />
          <CardTitle className="text-2xl sm:text-3xl">Subscription Cancelled</CardTitle>
          <CardDescription className="text-lg">
            Your subscription has been cancelled.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p>
            {subscription.cancelAtPeriodEnd 
              ? "Your subscription will remain active until the end of your current billing period." 
              : "Your subscription has been cancelled and is no longer active."}
          </p>
          <p className="text-muted-foreground">
            We're sorry to see you go. You can resubscribe at any time to regain access to premium features.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4">
          <Button asChild>
            <Link href="/pricing">
              View Plans
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              Go to Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}