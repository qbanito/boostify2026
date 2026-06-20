import { useState } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Crown, Sparkles, Gem, Zap, ArrowUpRight, Calendar, TrendingUp, Settings, ExternalLink } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { CollapsibleSection } from "./collapsible-section";
import { useToast } from "../../hooks/use-toast";
import { apiRequest, queryClient } from "../../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface Subscription {
  id?: number;
  plan: string;
  status: string;
  price: number;
  currency: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  features: string[];
  stripeSubscriptionId?: string;
  videosLimit?: number;
  songsLimit?: number;
  videosUsed?: number;
  songsUsed?: number;
  artistsGeneratedLimit?: number;
  artistsGeneratedUsed?: number;
  aiGenerationLimit?: number;
  aiGenerationUsed?: number;
  epkLimit?: number;
  epkUsed?: number;
  imageGalleriesLimit?: number;
  imageGalleriesUsed?: number;
  removeBoostifyLogo?: boolean;
  customizeMerchandise?: boolean;
  commissionRate?: number;
}

interface PlanUsage {
  videosGenerated: number;
  videosLimit: number;
  percentageUsed: number;
}

const planConfig = {
  free: {
    name: "Free",
    icon: Zap,
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    videosLimit: 1,
    songsLimit: 2,
    artistsLimit: 0,
    aiGenerationLimit: 0, // Obligatorio para FREE (sin stock)
    epkLimit: 0,
    imageGalleriesLimit: 0,
    removeBoostifyLogo: false,
    customizeMerchandise: false,
    commissionRate: 5,
    price: 0
  },
  basic: {
    name: "BASIC",
    icon: Sparkles,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    videosLimit: 10,
    songsLimit: 20,
    artistsLimit: 1,
    aiGenerationLimit: 10,
    epkLimit: 1,
    imageGalleriesLimit: 1,
    removeBoostifyLogo: false,
    customizeMerchandise: false,
    commissionRate: 20,
    price: 59.99
  },
  pro: {
    name: "PRO",
    icon: Crown,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    videosLimit: 50,
    songsLimit: 100,
    artistsLimit: 5,
    aiGenerationLimit: 100,
    epkLimit: 5,
    imageGalleriesLimit: 5,
    removeBoostifyLogo: true,
    customizeMerchandise: true,
    commissionRate: 20,
    price: 99.99
  },
  premium: {
    name: "PREMIUM",
    icon: Gem,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    videosLimit: 999,
    songsLimit: 999,
    artistsLimit: 10,
    aiGenerationLimit: 999,
    epkLimit: 999,
    imageGalleriesLimit: 999,
    removeBoostifyLogo: true,
    customizeMerchandise: true,
    commissionRate: 20,
    price: 149.99
  }
};

export function SubscriptionCardCompact() {
  const { toast } = useToast();
  const [showComparison, setShowComparison] = useState(false);
  
  const { data: subscription, isLoading } = useQuery<Subscription>({
    queryKey: ["/api/subscriptions/current"],
  });

  // Get actual usage from subscription data
  const usage: PlanUsage = {
    videosGenerated: subscription?.videosUsed || 0,
    videosLimit: subscription?.videosLimit || 0,
    percentageUsed: subscription && subscription.videosLimit > 0 
      ? ((subscription.videosUsed || 0) / subscription.videosLimit) * 100 
      : 0
  };

  const manageMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest({
        url: "/api/stripe/create-portal-session",
        method: "POST"
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo abrir el portal de gestión",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <CollapsibleSection
        title="Mi Suscripción"
        icon={<Crown className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </CollapsibleSection>
    );
  }

  if (!subscription) return null;

  const plan = subscription.plan.toLowerCase() as keyof typeof planConfig;
  const config = planConfig[plan] || planConfig.free;
  const Icon = config.icon;
  const isFreePlan = plan === "free";

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <>
      <CollapsibleSection
        title="Mi Suscripción"
        icon={<Icon className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3">
          {/* Plan actual */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 ${config.bgColor} rounded-lg`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{config.name}</p>
                <p className="text-xs text-gray-400">
                  {isFreePlan ? "Plan gratuito" : `$${subscription.price}/${subscription.currency}/mes`}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {subscription.status === "active" ? "Activo" : 
               subscription.status === "trialing" ? "Prueba" : "Inactivo"}
            </Badge>
          </div>

          {/* Uso del plan */}
          <div className="space-y-3">
            {/* Videos */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">📹 Videos</span>
                <span className="text-white font-medium">{subscription?.videosUsed || 0}/{subscription?.videosLimit || 0}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${config.bgColor} transition-all duration-300`}
                  style={{ width: `${Math.min(usage.percentageUsed, 100)}%` }}
                />
              </div>
            </div>

            {/* Songs */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">🎵 Songs</span>
                <span className="text-white font-medium">{subscription?.songsUsed || 0}/{subscription?.songsLimit || 0}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${config.bgColor} transition-all duration-300`}
                  style={{ width: `${Math.min(((subscription?.songsUsed || 0) / (subscription?.songsLimit || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* AI Generated Artists */}
            {(subscription?.artistsGeneratedLimit || 0) > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">🤖 AI Artists</span>
                  <span className="text-white font-medium">{subscription?.artistsGeneratedUsed || 0}/{subscription?.artistsGeneratedLimit || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${config.bgColor} transition-all duration-300`}
                    style={{ width: `${Math.min(((subscription?.artistsGeneratedUsed || 0) / (subscription?.artistsGeneratedLimit || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* AI Generation Tool */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">✨ AI Generation</span>
                <span className="text-white font-medium">{subscription?.aiGenerationUsed || 0}/{subscription?.aiGenerationLimit || 0}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${config.bgColor} transition-all duration-300`}
                  style={{ width: `${Math.min(((subscription?.aiGenerationUsed || 0) / (subscription?.aiGenerationLimit || 1)) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* EPK (Electronic Press Kit) */}
            {(subscription?.epkLimit || 0) > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">📋 EPK</span>
                  <span className="text-white font-medium">{subscription?.epkUsed || 0}/{subscription?.epkLimit || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${config.bgColor} transition-all duration-300`}
                    style={{ width: `${Math.min(((subscription?.epkUsed || 0) / (subscription?.epkLimit || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Image Galleries */}
            {(subscription?.imageGalleriesLimit || 0) > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">🖼️ Galleries</span>
                  <span className="text-white font-medium">{subscription?.imageGalleriesUsed || 0}/{subscription?.imageGalleriesLimit || 0}</span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${config.bgColor} transition-all duration-300`}
                    style={{ width: `${Math.min(((subscription?.imageGalleriesUsed || 0) / (subscription?.imageGalleriesLimit || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Permissions & Features */}
          <div className="space-y-2 pt-2 border-t border-gray-700">
            <div className="text-xs font-semibold text-gray-300">Permissions Permisos & Características Features</div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${subscription?.removeBoostifyLogo ? 'bg-green-500' : 'bg-gray-600'}`}></div>
              <span className="text-xs text-gray-400">Remove Boostify Logo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${subscription?.customizeMerchandise ? 'bg-green-500' : 'bg-gray-600'}`}></div>
              <span className="text-xs text-gray-400">Customize Merchandise</span>
            </div>
            {subscription?.commissionRate && (
              <div className="text-xs text-gray-400 pt-1">
                💰 Commission: <span className="text-green-400 font-semibold">{subscription.commissionRate}%</span> per sale
              </div>
            )}
          </div>

          {/* Renewal Date */}
          {subscription.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-xs text-gray-400 p-2 bg-gray-800/30 rounded">
              <Calendar className="h-3 w-3" />
              <span>
                {subscription.cancelAtPeriodEnd 
                  ? `Termina: ${formatDate(subscription.currentPeriodEnd)}`
                  : `Renueva: ${formatDate(subscription.currentPeriodEnd)}`
                }
              </span>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            {isFreePlan ? (
              <Link href="/music-video-pricing" className="flex-1">
                <Button
                  size="sm"
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  data-testid="button-upgrade-plan-compact"
                >
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Mejorar Plan
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => manageMutation.mutate()}
                  disabled={manageMutation.isPending}
                  data-testid="button-manage-subscription-compact"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  {manageMutation.isPending ? "Abriendo..." : "Gestionar"}
                </Button>
                <Link href="/music-video-pricing" className="flex-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    data-testid="button-change-plan-compact"
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Cambiar
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Link a comparación */}
          <Button
            variant="link"
            size="sm"
            className="w-full text-xs text-orange-500 hover:text-orange-400 p-0 h-auto"
            onClick={() => setShowComparison(true)}
            data-testid="button-compare-plans"
          >
            Ver comparación de planes
          </Button>
        </div>
      </CollapsibleSection>

      {/* Modal de comparación de planes */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-2xl">Comparar Planes</DialogTitle>
            <DialogDescription className="text-gray-400">
              Elige el plan perfecto para tus necesidades de producción musical
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {Object.entries(planConfig).filter(([key]) => key !== 'free').map(([key, planInfo]) => (
              <div
                key={key}
                className={`p-4 border rounded-lg ${
                  key === plan ? 'border-orange-500 bg-orange-500/5' : 'border-gray-700'
                }`}
              >
                <div className={`p-2 ${planInfo.bgColor} rounded-lg w-fit mb-3`}>
                  <planInfo.icon className={`h-5 w-5 ${planInfo.color}`} />
                </div>
                <h3 className="text-white font-bold mb-1">{planInfo.name}</h3>
                <p className="text-2xl font-bold text-white mb-1">
                  ${key === 'essential' ? '99' : key === 'gold' ? '149' : key === 'platinum' ? '249' : '399'}
                </p>
                <p className="text-xs text-gray-400 mb-4">/mes</p>
                <ul className="space-y-2 text-xs text-gray-300 mb-4">
                  <li className="flex items-start gap-1">
                    <span className="text-orange-500 mt-0.5">✓</span>
                    <span>{planInfo.videosLimit} video{planInfo.videosLimit > 1 ? 's' : ''}/mes</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="text-orange-500 mt-0.5">✓</span>
                    <span>Calidad {key === 'essential' ? 'HD' : key === 'gold' ? '4K' : key === 'platinum' ? '4K HDR' : '8K'}</span>
                  </li>
                  <li className="flex items-start gap-1">
                    <span className="text-orange-500 mt-0.5">✓</span>
                    <span>Primer mes gratis</span>
                  </li>
                </ul>
                <Link href="/music-video-pricing">
                  <Button
                    size="sm"
                    className={`w-full ${
                      key === plan 
                        ? 'bg-gray-700' 
                        : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                    disabled={key === plan}
                  >
                    {key === plan ? 'Plan Actual' : 'Seleccionar'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
