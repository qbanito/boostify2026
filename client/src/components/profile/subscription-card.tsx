import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Crown, Sparkles, Gem, Zap, ArrowUpRight, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface Subscription {
  id?: number;
  plan: string;
  status: string;
  price: number;
  currency: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  features: string[];
}

const planConfig = {
  free: {
    name: "Free",
    icon: Zap,
    color: "from-gray-500 to-gray-600",
    badgeColor: "bg-gray-500"
  },
  essential: {
    name: "ESSENTIAL",
    icon: Sparkles,
    color: "from-blue-500 to-blue-600",
    badgeColor: "bg-blue-500"
  },
  gold: {
    name: "GOLD",
    icon: Crown,
    color: "from-yellow-500 to-yellow-600",
    badgeColor: "bg-yellow-500"
  },
  platinum: {
    name: "PLATINUM",
    icon: Gem,
    color: "from-purple-500 to-purple-600",
    badgeColor: "bg-purple-500"
  },
  diamond: {
    name: "DIAMOND",
    icon: Gem,
    color: "from-cyan-400 to-blue-500",
    badgeColor: "bg-cyan-400"
  }
};

export function SubscriptionCard() {
  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ["/api/subscriptions/current"],
  });

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-orange-500/20 rounded-2xl p-6 shadow-xl animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  if (!subscription) return null;

  const plan = subscription.plan.toLowerCase() as keyof typeof planConfig;
  const config = planConfig[plan] || planConfig.free;
  const Icon = config.icon;
  const isFreePlan = plan === "free";
  const isPremiumPlan = ["essential", "gold", "platinum", "diamond"].includes(plan);

  // Formatear fecha de renovación
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 border border-orange-500/20 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 bg-gradient-to-br ${config.color} rounded-xl`}>
            <Icon className="h-8 w-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white">
                {config.name}
              </h2>
              <Badge className={`${config.badgeColor} text-white`}>
                {subscription.status === "active" ? "Activo" : 
                 subscription.status === "trialing" ? "Período de prueba" :
                 subscription.status === "cancelled" ? "Cancelado" : "Inactivo"}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">
              {isFreePlan ? "Plan gratuito" : `$${subscription.price}/${subscription.currency} al mes`}
            </p>
          </div>
        </div>

        <div className="flex gap-3 w-full sm:w-auto">
          {isFreePlan ? (
            <Link href="/music-video-pricing">
              <Button
                className="flex-1 sm:flex-none bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                data-testid="button-upgrade-plan"
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                Mejorar Plan
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/music-video-pricing">
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                  data-testid="button-change-plan"
                >
                  Cambiar Plan
                </Button>
              </Link>
              <Button
                variant="outline"
                className="border-gray-500 text-gray-400 hover:bg-gray-700"
                data-testid="button-manage-subscription"
              >
                Gestionar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Información de renovación */}
      {subscription.currentPeriodEnd && (
        <div className="mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Calendar className="h-4 w-4 text-orange-500" />
            <span>
              {subscription.cancelAtPeriodEnd 
                ? `Tu suscripción termina el ${formatDate(subscription.currentPeriodEnd)}`
                : `Se renueva el ${formatDate(subscription.currentPeriodEnd)}`
              }
            </span>
          </div>
        </div>
      )}

      {/* Features del plan */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          {isPremiumPlan ? "Beneficios de tu plan:" : "Con este plan tienes:"}
        </h3>
        <ul className="space-y-2">
          {(Array.isArray(subscription.features) ? subscription.features : []).map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-orange-500 mt-0.5">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Call to action para planes free */}
      {isFreePlan && (
        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-400 mb-3">
            🎬 Obtén hasta 8 music videos premium al mes con nuestros planes pagos
          </p>
          <Link href="/music-video-pricing">
            <Button 
              variant="ghost" 
              className="text-orange-500 hover:text-orange-400 p-0 h-auto"
              data-testid="link-view-plans"
            >
              Ver todos los planes →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
