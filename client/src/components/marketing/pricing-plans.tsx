import { useState } from 'react';
import { logger } from "../../lib/logger";
import { useAuth } from '../../hooks/use-auth';
import { useSubscription } from '../../lib/context/subscription-context';
import { createCheckoutSession } from '../../lib/api/stripe-service';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Check, X, Loader2, Sparkles, Zap, Crown, Rocket, Mic } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { useLocation } from 'wouter';
import { SUBSCRIPTION_PLANS, PlanTier } from '../../lib/pricing-config';
import { motion } from 'framer-motion';

interface PricingPlansProps {
  /**
   * Whether to show all plans (default) or just the upgrade plans
   */
  simplified?: boolean;
  /**
   * Whether to animate the cards
   */
  withAnimation?: boolean;
}

// Map plan keys to icons
const planIcons: Record<PlanTier, React.ReactNode> = {
  free: <Sparkles className="h-6 w-6" />,
  artist: <Mic className="h-6 w-6" />,
  creator: <Zap className="h-6 w-6" />,
  professional: <Rocket className="h-6 w-6" />,
  enterprise: <Crown className="h-6 w-6" />
};

// Plan order for display
const planOrder: PlanTier[] = ['free', 'artist', 'creator', 'professional', 'enterprise'];

/**
 * The pricing plans offered by the platform
 * Uses centralized pricing-config.ts as single source of truth
 */
export function PricingPlans({ simplified = false, withAnimation = false }: PricingPlansProps) {
  const { user } = useAuth();
  const { status, currentPlan } = useSubscription();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const [_, setLocation] = useLocation();

  // Convert SUBSCRIPTION_PLANS to array in correct order
  const allPlans = planOrder.map(key => SUBSCRIPTION_PLANS[key]);

  // Filter plans based on current subscription
  const filteredPlans = simplified
    ? allPlans.filter(plan => {
        // Show plans with higher tier than current plan
        const currentIndex = planOrder.indexOf(currentPlan as PlanTier || 'free');
        const planIndex = planOrder.indexOf(plan.key);
        return planIndex > currentIndex;
      })
    : allPlans;

  // If using the simplified view and there are no valid upgrade plans, show a message
  if (simplified && filteredPlans.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-bold mb-2">You're on our highest plan!</h3>
        <p className="text-muted-foreground">
          You're already subscribed to our Dominate plan with all features unlocked.
        </p>
      </div>
    );
  }

  const handleSubscribe = async (planKey: PlanTier) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to subscribe to a plan",
        variant: "destructive",
      });
      setLocation('/auth');
      return;
    }

    const plan = SUBSCRIPTION_PLANS[planKey];
    if (!plan.stripeIds.monthly) {
      // Free plan - go to dashboard
      setLocation('/dashboard');
      return;
    }

    try {
      setIsLoading(planKey);
      const response = await createCheckoutSession(plan.stripeIds.monthly);
      
      if (response.url) {
        window.location.href = response.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      toast({
        title: "Subscription Error",
        description: "There was an error setting up your subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: price % 1 === 0 ? 0 : 2,
    }).format(price);
  };

  const CardWrapper = withAnimation ? motion.div : 'div';
  const cardAnimationProps = withAnimation ? {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    whileHover: { y: -8, transition: { duration: 0.2 } }
  } : {};

  return (
    <div className="container mx-auto py-10">
      {!simplified && (
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Choose Your Plan</h2>
          <p className="text-lg text-muted-foreground">
            Select the perfect plan for your music career stage
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {filteredPlans.map((plan, index) => {
          const isCurrentPlan = currentPlan === plan.key;
          const includedFeatures = plan.features.filter(f => f.included).map(f => f.name);
          const excludedFeatures = plan.features.filter(f => !f.included).map(f => f.name);
          
          return (
            <CardWrapper
              key={plan.key}
              {...(withAnimation ? { ...cardAnimationProps, transition: { delay: index * 0.1 } } : {})}
            >
              <Card 
                className={`flex flex-col h-full transition-all duration-300 ${
                  plan.popular 
                    ? 'border-orange-500 shadow-lg shadow-orange-500/20 bg-gradient-to-b from-orange-500/10 to-transparent' 
                    : 'border-zinc-800 hover:border-orange-500/50'
                }`}
              >
                <CardHeader className="pb-4">
                  {plan.popular && (
                    <Badge className="w-fit mb-2 bg-orange-500 text-white border-0">
                      {plan.highlight}
                    </Badge>
                  )}
                  {!plan.popular && plan.highlight && (
                    <Badge variant="outline" className="w-fit mb-2 border-zinc-700 text-zinc-400">
                      {plan.highlight}
                    </Badge>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${plan.popular ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {planIcons[plan.key]}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.displayName}</CardTitle>
                      <CardDescription className="text-sm mt-1">{plan.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="mb-6">
                    <span className="text-4xl font-bold">{formatPrice(plan.price.monthly)}</span>
                    <span className="text-muted-foreground">/month</span>
                    {plan.price.yearly > 0 && (
                      <p className="text-sm text-orange-400 mt-1">
                        or {formatPrice(plan.price.yearlyEquivalentMonthly)}/mo billed yearly (save 16%)
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {includedFeatures.slice(0, simplified ? 5 : 8).map((feature, i) => (
                      <div key={i} className="flex items-center">
                        <Check className="text-green-500 mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    
                    {!simplified && excludedFeatures.slice(0, 3).map((feature, i) => (
                      <div key={i} className="flex items-center text-muted-foreground">
                        <X className="text-zinc-600 mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    
                    {includedFeatures.length > (simplified ? 5 : 8) && (
                      <p className="text-sm text-orange-400 font-medium">
                        + {includedFeatures.length - (simplified ? 5 : 8)} more features
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className={`w-full ${plan.popular ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                    variant={plan.price.monthly === 0 ? "outline" : (plan.popular ? "default" : "secondary")}
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={isCurrentPlan || isLoading === plan.key}
                  >
                    {isLoading === plan.key ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : plan.price.monthly === 0 ? (
                      'Get Started Free'
                    ) : (
                      'Subscribe Now'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </CardWrapper>
          );
        })}
      </div>
    </div>
  );
}