import React, { useState } from 'react';
import { logger } from "../lib/logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { CalendarIcon, CreditCard, User, Settings, Loader2 } from 'lucide-react';
import { useSubscription } from '../lib/context/subscription-context';
import { useAuth } from '../hooks/use-auth';
import { cancelSubscription } from '../lib/api/subscription-service';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from '../hooks/use-toast';
import { format } from 'date-fns';
import { PricingPlans } from '../components/subscription/pricing-plans';
import { apiRequest } from '../lib/queryClient';
import { SUBSCRIPTION_PLANS } from '@/lib/pricing-config';

/**
 * Account page with subscription management and user settings
 */
export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { subscription, isLoading: subscriptionLoading, refreshSubscription, currentPlan } = useSubscription();
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  
  const isLoading = authLoading || subscriptionLoading;

  const handleChangePlan = async (newPlanKey: string) => {
    if (!user) return;
    
    const newPlan = SUBSCRIPTION_PLANS[newPlanKey as any];
    if (!newPlan || newPlan.stripeIds.monthly === '') {
      toast({
        title: "Invalid Plan",
        description: "This plan cannot be changed to at this time.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (!window.confirm(`Upgrade your plan to ${newPlan.displayName}? You'll be charged the difference pro-rata.`)) {
        return;
      }

      setIsChangingPlan(true);

      const result = await apiRequest('/api/subscription/change', {
        method: 'POST',
        body: JSON.stringify({
          newPlanPriceId: newPlan.stripeIds.monthly
        })
      });

      if (result.success) {
        await refreshSubscription();
        toast({
          title: "Plan Updated",
          description: `Successfully upgraded to ${newPlan.displayName}!`
        });
      }
    } catch (error) {
      logger.error('Error changing plan:', error);
      toast({
        title: "Error",
        description: "Failed to change your plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsChangingPlan(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;
    
    try {
      // Confirm cancellation
      if (!window.confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
        return;
      }
      
      // Get authentication token
      const token = await user.getIdToken();
      
      // Call API to cancel subscription
      await cancelSubscription(token);
      
      // Refresh subscription status
      await refreshSubscription();
      
      // Show success message
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled. It will remain active until the end of your billing period.",
      });
    } catch (error) {
      logger.error('Error cancelling subscription:', error);
      
      // Show error message
      toast({
        title: "Error",
        description: "Failed to cancel your subscription. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row items-start gap-8">
        <Tabs defaultValue="subscription" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="subscription">
              <CreditCard className="h-4 w-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="subscription" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Details</CardTitle>
                <CardDescription>Manage your subscription plan and billing</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-6 w-1/4" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Current Plan</h3>
                      <p className="text-xl font-bold">
                        {subscription?.active && subscription?.plan
                          ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) 
                          : 'Free'}
                      </p>
                    </div>
                    
                    {subscription?.active && subscription?.currentPeriodEnd && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground">Renewal Date</h3>
                        <p className="flex items-center text-lg">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(new Date(subscription.currentPeriodEnd), 'MMMM d, yyyy')}
                        </p>
                      </div>
                    )}
                    
                    {subscription?.active && subscription?.cancelAtPeriodEnd && (
                      <div className="bg-amber-100 dark:bg-amber-950 p-4 rounded-md">
                        <p className="text-amber-800 dark:text-amber-200">
                          Your subscription is set to cancel at the end of the current billing period.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                <Button 
                  variant="outline" 
                  onClick={refreshSubscription}
                  disabled={isLoading}
                >
                  Refresh
                </Button>
                
                {subscription?.active && !subscription?.cancelAtPeriodEnd && (
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelSubscription}
                    disabled={isLoading}
                  >
                    Cancel Subscription
                  </Button>
                )}
                
                {(!subscription?.active || subscription?.cancelAtPeriodEnd) && (
                  <Button onClick={() => window.location.href = '/pricing'}>
                    View Plans
                  </Button>
                )}
              </CardFooter>
            </Card>
            
            {subscription?.active && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Upgrade Your Plan</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
                    <Card key={plan.key} className={plan.key === currentPlan ? 'border-orange-500 border-2' : ''}>
                      <CardHeader>
                        <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold mb-2">
                          ${plan.price.monthly}
                          <span className="text-sm text-muted-foreground">/mo</span>
                        </div>
                        {plan.key === currentPlan && (
                          <div className="text-green-600 font-semibold">✓ Current Plan</div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button
                          onClick={() => handleChangePlan(plan.key)}
                          disabled={plan.key === currentPlan || isChangingPlan}
                          className="w-full"
                          variant={plan.key === currentPlan ? 'outline' : 'default'}
                        >
                          {isChangingPlan ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          {plan.key === currentPlan ? 'Current Plan' : 'Upgrade'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {((!subscription?.active || subscription?.cancelAtPeriodEnd)) && (
              <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">Available Plans</h2>
                <PricingPlans simplified />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Manage your personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Profile management will be added in a future update.</p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your account preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Account settings will be added in a future update.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}