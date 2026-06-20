import React, { useState, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { Check, X, Loader2, Sparkles, Music, Video, Zap, Crown, Mic, Camera, Wand2, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { useSubscription } from '../../lib/context/subscription-context';
import { 
  createCheckoutSession, 
  fetchStripePublicKey, 
  fetchSubscriptionPlans,
  SubscriptionPlan 
} from '../../lib/api/stripe-service';
import { useAuth } from '../../hooks/use-auth';
import { Skeleton } from '../ui/skeleton';
import { toast } from '../../hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../ui/badge';
import { motion } from 'framer-motion';
import { SUBSCRIPTION_PLANS, getStripePriceId, getYearlySavings, type PlanTier } from '@/lib/pricing-config';

interface ProcessedPlan {
  name: string;
  key: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  priceId: {
    monthly: string;
    yearly: string;
  };
  popular?: boolean;
  highlight?: string;
  icon?: React.ReactNode;
  features: { name: string; included: boolean }[];
}

// Mapping del API a nuestro formato de planes (LEGACY - Mantener por compatibilidad)
const planKeyMap: Record<string, string> = {
  'Free': 'free',
  'Artist': 'artist',
  'Basic': 'creator',
  'Creator': 'creator',
  'Pro': 'professional',
  'Professional': 'professional',
  'Premium': 'enterprise',
  'Enterprise': 'enterprise'
};

interface PricingPlansProps {
  simplified?: boolean;
  withAnimation?: boolean;
}

/**
 * PricingPlans component displays subscription plans with pricing options
 * Supports both full and simplified views for different contexts
 */
export function PricingPlans({ simplified = false, withAnimation = false }: PricingPlansProps) {
  const [yearly, setYearly] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { subscription, currentPlan, isLoading: subscriptionLoading, isAdmin } = useSubscription();
  
  const { data: plansData, isLoading: plansLoading, error: plansError } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: fetchSubscriptionPlans
  });
  
  const isLoading = authLoading || subscriptionLoading || plansLoading;

  // Efecto para procesar plan guardado después del login
  useEffect(() => {
    if (user && !authLoading) {
      const selectedPlanStr = localStorage.getItem('selectedPlan');
      if (selectedPlanStr) {
        try {
          const { planKey, yearly: savedYearly } = JSON.parse(selectedPlanStr);
          
          localStorage.removeItem('selectedPlan');
          
          toast({
            title: "Procesando tu suscripción",
            description: `Continuando con el plan ${planKey.toUpperCase()}...`,
            variant: "default"
          });
          
          setTimeout(() => {
            handleSubscribe(planKey, savedYearly);
          }, 500);
        } catch (error) {
          logger.error('Error procesando plan guardado:', error);
          localStorage.removeItem('selectedPlan');
        }
      }
    }
  }, [user, authLoading]);

  // ✅ USAR CONFIGURACIÓN CENTRALIZADA desde shared/pricing-config.ts
  // 5-Tier System: Discover → Artist → Elevate → Amplify → Dominate
  const pricingPlans: ProcessedPlan[] = [
    {
      name: SUBSCRIPTION_PLANS.free.displayName,
      key: SUBSCRIPTION_PLANS.free.key,
      description: SUBSCRIPTION_PLANS.free.description,
      highlight: SUBSCRIPTION_PLANS.free.highlight,
      icon: <Music className="h-6 w-6" />,
      price: {
        monthly: SUBSCRIPTION_PLANS.free.price.monthly,
        yearly: SUBSCRIPTION_PLANS.free.price.yearly
      },
      priceId: {
        monthly: SUBSCRIPTION_PLANS.free.stripeIds.monthly,
        yearly: SUBSCRIPTION_PLANS.free.stripeIds.yearly
      },
      features: SUBSCRIPTION_PLANS.free.features
    },
    {
      name: SUBSCRIPTION_PLANS.artist.displayName,
      key: SUBSCRIPTION_PLANS.artist.key,
      description: SUBSCRIPTION_PLANS.artist.description,
      highlight: SUBSCRIPTION_PLANS.artist.highlight,
      popular: SUBSCRIPTION_PLANS.artist.popular,
      icon: <Mic className="h-6 w-6" />,
      price: {
        monthly: SUBSCRIPTION_PLANS.artist.price.monthly,
        yearly: SUBSCRIPTION_PLANS.artist.price.yearly
      },
      priceId: {
        monthly: SUBSCRIPTION_PLANS.artist.stripeIds.monthly,
        yearly: SUBSCRIPTION_PLANS.artist.stripeIds.yearly
      },
      features: SUBSCRIPTION_PLANS.artist.features
    },
    {
      name: SUBSCRIPTION_PLANS.creator.displayName,
      key: SUBSCRIPTION_PLANS.creator.key,
      description: SUBSCRIPTION_PLANS.creator.description,
      highlight: SUBSCRIPTION_PLANS.creator.highlight,
      icon: <Video className="h-6 w-6" />,
      price: {
        monthly: SUBSCRIPTION_PLANS.creator.price.monthly,
        yearly: SUBSCRIPTION_PLANS.creator.price.yearly
      },
      priceId: {
        monthly: SUBSCRIPTION_PLANS.creator.stripeIds.monthly,
        yearly: SUBSCRIPTION_PLANS.creator.stripeIds.yearly
      },
      features: SUBSCRIPTION_PLANS.creator.features
    },
    {
      name: SUBSCRIPTION_PLANS.professional.displayName,
      key: SUBSCRIPTION_PLANS.professional.key,
      description: SUBSCRIPTION_PLANS.professional.description,
      highlight: SUBSCRIPTION_PLANS.professional.highlight,
      icon: <Zap className="h-6 w-6" />,
      price: {
        monthly: SUBSCRIPTION_PLANS.professional.price.monthly,
        yearly: SUBSCRIPTION_PLANS.professional.price.yearly
      },
      priceId: {
        monthly: SUBSCRIPTION_PLANS.professional.stripeIds.monthly,
        yearly: SUBSCRIPTION_PLANS.professional.stripeIds.yearly
      },
      features: SUBSCRIPTION_PLANS.professional.features
    },
    {
      name: SUBSCRIPTION_PLANS.enterprise.displayName,
      key: SUBSCRIPTION_PLANS.enterprise.key,
      description: SUBSCRIPTION_PLANS.enterprise.description,
      highlight: SUBSCRIPTION_PLANS.enterprise.highlight,
      icon: <Crown className="h-6 w-6" />,
      price: {
        monthly: SUBSCRIPTION_PLANS.enterprise.price.monthly,
        yearly: SUBSCRIPTION_PLANS.enterprise.price.yearly
      },
      priceId: {
        monthly: SUBSCRIPTION_PLANS.enterprise.stripeIds.monthly,
        yearly: SUBSCRIPTION_PLANS.enterprise.stripeIds.yearly
      },
      features: SUBSCRIPTION_PLANS.enterprise.features
    }
  ];

  const handleSubscribe = async (planKey: string, yearly: boolean) => {
    logger.info('handleSubscribe called:', { planKey, yearly, user });
    
    if (!user) {
      localStorage.setItem('selectedPlan', JSON.stringify({ planKey, yearly }));
      
      logger.info('User not authenticated, redirecting to /auth');
      toast({
        title: "Inicia sesión para continuar",
        description: `Has seleccionado el plan ${planKey.toUpperCase()}. Por favor inicia sesión para completar tu suscripción.`,
        variant: "default"
      });
      
      window.location.href = '/auth?returnTo=/pricing';
      return;
    }
    
    // ✅ Usar sistema de roles en lugar de email hardcodeado
    // Admin users can still subscribe — don't block checkout
    if (isAdmin()) {
      logger.info('Admin user proceeding to checkout for plan:', planKey);
    }

    const plan = pricingPlans.find(p => p.key === planKey);
    if (!plan) return;

    try {
      const priceId = yearly ? 
        plan.priceId.yearly : 
        plan.priceId.monthly;
      
      toast({
        title: "Creando sesión de pago",
        description: "Por favor espera mientras te redirigimos a la página de pago...",
        variant: "default"
      });
      
      if (priceId) {
        try {
          const sessionUrl = await createCheckoutSession(priceId);
          logger.info("URL de sesión de checkout:", sessionUrl);
          
          if (typeof sessionUrl === 'string') {
            window.location.href = sessionUrl;
          } else {
            throw new Error("Formato de respuesta de sesión incorrecto");
          }
          return;
        } catch (error) {
          logger.error("Error al crear sesión de checkout:", error);
          throw error;
        }
      } else {
        throw new Error("ID de precio no disponible para el plan seleccionado");
      }
    } catch (error) {
      logger.error('Error starting checkout:', error);
      toast({
        title: "Error",
        description: "No se pudo iniciar el proceso de suscripción. Por favor, inténtalo de nuevo más tarde.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent className="flex-1">
              <Skeleton className="h-10 w-24 mb-6" />
              <div className="space-y-2">
                {[...Array(6)].map((_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (plansError && !pricingPlans.length) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-bold mb-2">Error cargando planes</h3>
        <p className="text-muted-foreground mb-4">
          No pudimos cargar los planes de suscripción. Por favor, intenta nuevamente más tarde.
        </p>
        <Button onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  if (simplified) {
    const Wrapper = withAnimation ? motion.div : 'div';
    const CardWrapper = withAnimation ? motion.div : React.Fragment;
    
    return (
      <Wrapper
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        {...(withAnimation ? { 
          variants: containerVariants,
          initial: "hidden",
          animate: "visible"
        } : {})}
      >
        {pricingPlans.map((plan) => (
          <CardWrapper key={plan.key} {...(withAnimation ? { variants: itemVariants } : {})}>
            <Card className={`flex flex-col h-full relative overflow-hidden backdrop-blur-lg border-2 ${
              plan.popular 
                ? 'bg-gradient-to-br from-orange-500/20 via-background/50 to-background border-orange-500 shadow-2xl shadow-orange-500/30 scale-105' 
                : 'bg-gradient-to-br from-white/5 via-background to-background border-white/10 hover:border-orange-500/50 hover:shadow-2xl hover:shadow-orange-500/20'
            } transition-all duration-500 group`}>
              {plan.highlight && (
                <Badge 
                  className={`absolute top-3 right-3 ${
                    plan.key === 'artist' ? 'bg-orange-500' :
                    plan.key === 'creator' ? 'bg-blue-500' :
                    plan.key === 'professional' ? 'bg-purple-500' :
                    plan.key === 'enterprise' ? 'bg-purple-600' : 
                    'bg-gray-500'
                  }`}
                  data-testid={`badge-${plan.key}`}
                >
                  {plan.highlight}
                </Badge>
              )}
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2 rounded-lg ${
                    plan.key === 'free' ? 'bg-gray-500/20' :
                    plan.key === 'artist' ? 'bg-orange-500/20' :
                    plan.key === 'creator' ? 'bg-blue-500/20' :
                    plan.key === 'professional' ? 'bg-purple-500/20' :
                    'bg-amber-500/20'
                  }`}>
                    {plan.icon}
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black">{plan.name}</CardTitle>
                    <CardDescription className="text-xs mt-1 text-gray-400">{plan.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-6">
                <div className="mb-6">
                  {plan.price.monthly === 0 ? (
                    <div>
                      <div className="text-4xl font-black text-white">Free Forever</div>
                      <div className="text-sm text-gray-400 mt-2">No credit card needed</div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black text-white">${yearly ? Math.floor(plan.price.yearly / 12) : plan.price.monthly}</span>
                        <span className="text-gray-400 text-sm">/{yearly ? 'mo' : 'mo'}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        {yearly ? `Billed $${plan.price.yearly}/year` : `Billed monthly`}
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                  {plan.features.slice(0, 6).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                        feature.included ? 'text-orange-500' : 'text-gray-600'
                      }`} />
                      <span className={feature.included ? 'text-gray-200' : 'text-gray-600 line-through'}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.key, yearly)}
                  disabled={isLoading || (subscription?.status === 'active' && currentPlan === plan.key)}
                  data-testid={`button-subscribe-${plan.key}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : subscription?.status === 'active' && currentPlan === plan.key ? (
                    'Current Plan'
                  ) : plan.price.monthly === 0 ? (
                    'Get Started'
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </CardWrapper>
        ))}
      </Wrapper>
    );
  }

  // Full detailed pricing view
  const Wrapper = withAnimation ? motion.div : 'div';
  const CardWrapper = withAnimation ? motion.div : React.Fragment;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-orange-500 to-purple-600 bg-clip-text text-transparent">
            Choose Your Creative Power
          </h2>
          <p className="text-lg text-muted-foreground">
            Create stunning AI music videos with professional tools. From audio transcription to lip-sync generation.
          </p>
        </motion.div>
      </div>
      
      {/* Billing Toggle */}
      <motion.div 
        className="flex justify-center mb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="relative inline-flex items-center p-1 bg-muted rounded-full">
          <div 
            className={`absolute inset-y-1 transition-all duration-300 ease-out rounded-full bg-background shadow-md ${
              yearly ? 'left-[50%] right-1' : 'left-1 right-[50%]'
            }`}
          />
          <Label 
            htmlFor="monthly" 
            className={`relative z-10 px-8 py-3 cursor-pointer rounded-full transition-colors font-medium ${
              !yearly ? 'text-foreground' : 'text-muted-foreground'
            }`}
            onClick={() => setYearly(false)}
          >
            Monthly
          </Label>
          <Label 
            htmlFor="yearly" 
            className={`relative z-10 px-8 py-3 cursor-pointer rounded-full transition-colors flex items-center gap-2 font-medium ${
              yearly ? 'text-foreground' : 'text-muted-foreground'
            }`}
            onClick={() => setYearly(true)}
          >
            Yearly
            <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">
              Save 16%
            </Badge>
          </Label>
          <Switch
            id="billing-toggle"
            className="sr-only"
            checked={yearly}
            onCheckedChange={setYearly}
          />
        </div>
      </motion.div>
      
      {/* Pricing Cards */}
      <Wrapper
        className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        {...(withAnimation ? { 
          variants: containerVariants, 
          initial: "hidden", 
          animate: "visible"
        } : {})}
      >
        {pricingPlans.map((plan, index) => (
          <CardWrapper key={plan.key} {...(withAnimation ? { variants: itemVariants } : {})}>
            <Card 
              className={`flex flex-col h-full relative overflow-hidden border-2 ${
                plan.popular 
                  ? 'border-orange-500 shadow-2xl shadow-orange-500/30 scale-105 z-10' 
                  : 'border-border hover:border-primary/50 hover:shadow-xl hover:scale-[1.02]'
              } transition-all duration-300`}
              data-testid={`card-plan-${plan.key}`}
            >
              {/* Highlight Badge */}
              {plan.highlight && (
                <div className={`absolute top-0 left-0 right-0 py-2.5 text-center text-white text-xs font-bold tracking-wide ${
                  plan.key === 'artist' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                  plan.key === 'creator' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                  plan.key === 'professional' ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                  plan.key === 'enterprise' ? 'bg-gradient-to-r from-purple-600 to-purple-700' :
                  'bg-gradient-to-r from-gray-500 to-gray-600'
                }`}>
                  {plan.highlight}
                </div>
              )}

              <CardHeader className={plan.highlight ? 'pt-12' : 'pt-6'}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${
                    plan.key === 'artist' ? 'bg-orange-500/10 text-orange-500' :
                    plan.key === 'creator' ? 'bg-blue-500/10 text-blue-500' :
                    plan.key === 'professional' ? 'bg-purple-500/10 text-purple-500' :
                    plan.key === 'enterprise' ? 'bg-purple-600/10 text-purple-600' :
                    'bg-gray-500/10 text-gray-500'
                  }`}>
                    {plan.icon}
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                </div>
                <CardDescription className="text-base">{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 space-y-6">
                {/* Price */}
                <div className="flex items-baseline gap-1">
                  {plan.price.monthly === 0 ? (
                    <span className="text-5xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-muted-foreground">$</span>
                      <span className="text-5xl font-bold">
                        {yearly ? plan.price.yearly : plan.price.monthly}
                      </span>
                      <span className="text-lg text-muted-foreground font-medium">
                        /{yearly ? 'year' : 'month'}
                      </span>
                    </>
                  )}
                </div>
                
                {/* Features List */}
                <ul className="space-y-3">
                  {plan.features.slice(0, 8).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {feature.included ? (
                        <div className="rounded-full bg-green-500/15 p-0.5 mt-0.5 flex-shrink-0">
                          <Check className="h-4 w-4 text-green-600" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="rounded-full bg-muted p-0.5 mt-0.5 flex-shrink-0">
                          <X className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <span className={`text-sm ${!feature.included ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                  {plan.features.length > 8 && (
                    <li className="text-sm text-muted-foreground italic pl-6">
                      + {plan.features.length - 8} more features
                    </li>
                  )}
                </ul>
              </CardContent>
              
              <CardFooter className="pt-6 pb-8">
                <Button 
                  className={`w-full h-12 text-base font-semibold ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30' 
                      : ''
                  }`}
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleSubscribe(plan.key, yearly)}
                  disabled={isLoading || (subscription?.status === 'active' && currentPlan === plan.key)}
                  data-testid={`button-subscribe-${plan.key}`}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : subscription?.status === 'active' && currentPlan === plan.key ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Current Plan
                    </>
                  ) : plan.price.monthly === 0 ? (
                    'Get Started Free'
                  ) : (
                    'Start Creating'
                  )}
                </Button>
              </CardFooter>
            </Card>
          </CardWrapper>
        ))}
      </Wrapper>

      {/* Feature Highlights */}
      <motion.div 
        className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
          <Mic className="h-10 w-10 text-orange-500 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Music Video Creation</h3>
          <p className="text-sm text-muted-foreground">Create professional music videos with AI-powered tools</p>
        </div>
        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
          <Camera className="h-10 w-10 text-blue-500 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Artist Image Generation</h3>
          <p className="text-sm text-muted-foreground">Design stunning visuals for your artist brand and promotions</p>
        </div>
        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-600/20">
          <Wand2 className="h-10 w-10 text-purple-600 mx-auto mb-3" />
          <h3 className="font-semibold mb-2">Multi-Platform Distribution</h3>
          <p className="text-sm text-muted-foreground">Reach your audience on YouTube, Spotify, and Instagram</p>
        </div>
      </motion.div>

      {/* Trust Badge */}
      <motion.div 
        className="mt-12 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-sm text-muted-foreground mb-2">Trusted by creators worldwide</p>
        <div className="flex justify-center items-center gap-6">
          <Badge variant="outline" className="text-xs">Cancel anytime</Badge>
          <Badge variant="outline" className="text-xs">Secure payments</Badge>
          <Badge variant="outline" className="text-xs">24/7 Support</Badge>
        </div>
      </motion.div>
    </div>
  );
}
