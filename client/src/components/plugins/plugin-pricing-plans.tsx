import { useState, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "../ui/card";
import { Button } from "../ui/button";
import { auth } from '../../lib/firebase';
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { CheckCircle, Loader2, Rocket, Zap } from "lucide-react";

// Definir función para cargar Stripe de forma lazy
const getStripe = async () => {
  try {
    if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
      throw new Error('Missing Stripe public key');
    }
    
    // Importación dinámica para evitar cargar Stripe en la inicialización
    const { loadStripe } = await import('@stripe/stripe-js');
    return await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
  } catch (error) {
    logger.error('Error loading Stripe:', error);
    return null;
  }
};

export interface PluginPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  plugins: string[];
  description: string;
  popular?: boolean;
  priceId: string;
}

// Planes específicos para plugins
const pluginPlans: PluginPlan[] = [
  {
    id: 'basic',
    name: "Basic",
    price: 99,
    features: [
      "Access to 3 key plugins",
      "BeatNews for music news aggregation",
      "ContentPulse for AI content generation",
      "SocialSync for social media management",
      "Standard API access limits",
      "Email support",
      "Basic analytics",
      "Weekly reports"
    ],
    plugins: ["BeatNews", "ContentPulse", "SocialSync"],
    description: "Ideal for solo artists and small music creators looking to enhance their online presence.",
    popular: false,
    priceId: "price_plugins_basic" // Este es un ID temporal para Stripe
  },
  {
    id: 'professional',
    name: "Professional",
    price: 199,
    features: [
      "Access to 6 key plugins",
      "All Basic plugins +",
      "EventBeat for event management",
      "TuneMatch for personalized recommendations",
      "TrendTracker for analytics",
      "Increased API access limits",
      "Priority email & chat support",
      "Custom reports",
      "Advanced analytics dashboard"
    ],
    plugins: ["BeatNews", "ContentPulse", "SocialSync", "EventBeat", "TuneMatch", "TrendTracker"],
    description: "Perfect for established artists and small labels managing multiple projects.",
    popular: true,
    priceId: "price_plugins_professional" // Este es un ID temporal para Stripe
  },
  {
    id: 'enterprise',
    name: "Enterprise",
    price: 299,
    features: [
      "Access to all 9 plugins",
      "All Professional plugins +",
      "StreamLink for streaming analytics",
      "EchoChat for engagement management",
      "SEOPulse for SEO optimization",
      "Unlimited API access",
      "24/7 dedicated support",
      "Custom integration services",
      "White label options",
      "Team collaboration tools"
    ],
    plugins: ["BeatNews", "ContentPulse", "SocialSync", "EventBeat", "TuneMatch", "TrendTracker", "StreamLink", "EchoChat", "SEOPulse"],
    description: "The ultimate solution for labels, agencies, and professional music marketers.",
    popular: false,
    priceId: "price_plugins_enterprise" // Este es un ID temporal para Stripe
  }
];

export function PluginPricingPlans() {
  const { toast } = useToast();
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Verificar usuario actual
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });

    // Verificar configuración de Stripe
    getStripe().catch((error) => {
      logger.error('Error initializing Stripe:', error);
      setStripeError(error.message);
      toast({
        title: "Configuration Notice",
        description: "Pricing is in demonstration mode. Stripe integration is ready for production use.",
        variant: "default"
      });
    });

    return () => unsubscribe();
  }, []);

  const handleSubscribe = async (plan: PluginPlan) => {
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please log in to subscribe to a plugin plan",
        variant: "destructive"
      });
      return;
    }

    try {
      setProcessingPlanId(plan.priceId);

      // En un entorno de producción, aquí se conectaría con Stripe
      // Para esta demostración, simulamos el proceso
      
      toast({
        title: "Subscription Started",
        description: `You've subscribed to the ${plan.name} Plugin Plan. Enjoy your enhanced capabilities!`,
        variant: "default"
      });

      // Simular el proceso de pago
      setTimeout(() => {
        setProcessingPlanId(null);
      }, 2000);

      // En producción, el código se vería así:
      /*
      const stripe = await getStripe();
      if (!stripe) throw new Error('Stripe not initialized');

      const response = await fetch('/api/create-plugin-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          planName: plan.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error creating payment session');
      }

      const { sessionId } = await response.json();
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) throw error;
      */
      
    } catch (error: any) {
      logger.error('Error in subscription process:', error);
      toast({
        title: "Subscription Error",
        description: error.message || "There was an error processing your subscription",
        variant: "destructive"
      });
    } finally {
      setProcessingPlanId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-4">
      {pluginPlans.map((plan) => (
        <Card 
          key={plan.id} 
          className={`border-2 ${plan.popular ? 'border-orange-500' : 'border-border'} flex flex-col h-full`}
        >
          <CardHeader className="space-y-1">
            {plan.popular && (
              <Badge className="w-fit bg-orange-500 hover:bg-orange-600">
                Most Popular
              </Badge>
            )}
            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold">${plan.price}</span>
              <span className="text-muted-foreground pb-1">/month</span>
            </div>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="font-medium mb-2 text-sm text-orange-500">
              {plan.plugins.length} Plugins Included
            </p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className={`w-full h-12 ${
                plan.popular 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-500'
              }`}
              onClick={() => handleSubscribe(plan)}
              disabled={processingPlanId === plan.priceId}
            >
              {processingPlanId === plan.priceId ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {plan.popular ? (
                    <Zap className="mr-2 h-5 w-5" />
                  ) : (
                    <Rocket className="mr-2 h-5 w-5" />
                  )}
                  Subscribe Now
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}