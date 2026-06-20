import { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Crown, Gem, Zap, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TierConfig {
  name: string;
  price: number;
  videoModel: string;
  resolution: string;
  images: number;
  videos: number;
  lipsyncClips: number;
  regenerations: number;
  subscriptionTier: string;
  subscriptionValue: number;
  features: string[];
}

interface TiersData {
  essential: TierConfig;
  gold: TierConfig;
  platinum: TierConfig;
  diamond: TierConfig;
}

const tierIcons = {
  essential: Zap,
  gold: Sparkles,
  platinum: Crown,
  diamond: Gem
};

const tierColors = {
  essential: {
    badge: "bg-slate-600",
    border: "border-slate-200 dark:border-slate-800",
    button: "bg-slate-600 hover:bg-slate-700"
  },
  gold: {
    badge: "bg-yellow-600",
    border: "border-yellow-200 dark:border-yellow-900",
    button: "bg-yellow-600 hover:bg-yellow-700"
  },
  platinum: {
    badge: "bg-purple-600",
    border: "border-purple-200 dark:border-purple-900",
    button: "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
  },
  diamond: {
    badge: "bg-gradient-to-r from-cyan-600 to-blue-600",
    border: "border-cyan-200 dark:border-cyan-900",
    button: "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
  }
};

export default function MusicVideoPricing() {
  const { toast } = useToast();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  const { data: tiersData, isLoading } = useQuery<{ success: boolean; tiers: TiersData }>({
    queryKey: ['/api/stripe/music-video-tiers'],
  });

  const handleSelectTier = async (tier: string) => {
    setSelectedTier(tier);
    try {
      const response = await apiRequest({
        url: '/api/stripe/create-music-video-bundle-checkout',
        method: 'POST',
        data: {
          tier,
          songName: 'Music Video Bundle',
          duration: 180
        }
      }) as { url: string };

      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error) {
      logger.error('Error creating checkout:', error);
      toast({
        title: "Error",
        description: "Could not create checkout session. Please try again.",
        variant: "destructive"
      });
      setSelectedTier(null);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pricing...</p>
        </div>
      </div>
    );
  }

  const tiers = tiersData?.tiers;
  if (!tiers) return null;

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12 space-y-4">
        <Badge className="mb-4" variant="outline">Music Video Bundles</Badge>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          Professional Music Videos
          <span className="block text-primary mt-2">+ Growth Tools Included</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Get a premium AI-generated music video plus your first month of Boostify growth tools completely free.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {Object.entries(tiers).map(([key, tier]) => {
          const Icon = tierIcons[key as keyof typeof tierIcons];
          const colors = tierColors[key as keyof typeof tierColors];
          const isPopular = key === 'gold';
          const isLoading = selectedTier === key;

          return (
            <Card 
              key={key} 
              className={`relative ${colors.border} ${isPopular ? 'shadow-xl scale-105 ring-2 ring-primary' : 'hover:shadow-lg'} transition-all`}
              data-testid={`tier-card-${key}`}
            >
              {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}

              <CardHeader className="text-center pb-8">
                <div className="mx-auto mb-4 p-3 rounded-full bg-muted w-fit">
                  <Icon className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>
                  <span className="text-4xl font-bold text-foreground">${tier.price}</span>
                  <span className="text-muted-foreground"> one-time</span>
                </CardDescription>
                <Badge className={`${colors.badge} text-white mt-2`}>
                  {tier.resolution} • {tier.videos} scenes
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2 mb-6 min-h-[300px]">
                  {tier.features.slice(0, 8).map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className={feature.includes('🎁') ? 'font-semibold text-primary' : ''}>
                        {feature}
                      </span>
                    </div>
                  ))}
                  {tier.features.length > 8 && (
                    <div className="text-xs text-muted-foreground pt-2">
                      + {tier.features.length - 8} more features
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => handleSelectTier(key)}
                  disabled={isLoading}
                  className={`w-full ${colors.button} text-white`}
                  size="lg"
                  data-testid={`button-select-${key}`}
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Total value: ${tier.price + tier.subscriptionValue}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="mt-16">
        <h2 className="text-3xl font-bold text-center mb-8">Feature Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-semibold">Feature</th>
                <th className="text-center p-4 font-semibold">ESSENTIAL</th>
                <th className="text-center p-4 font-semibold bg-primary/5">GOLD</th>
                <th className="text-center p-4 font-semibold">PLATINUM</th>
                <th className="text-center p-4 font-semibold">DIAMOND</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-4 font-medium">Price</td>
                <td className="text-center p-4">${tiers.essential.price}</td>
                <td className="text-center p-4 bg-primary/5">${tiers.gold.price}</td>
                <td className="text-center p-4">${tiers.platinum.price}</td>
                <td className="text-center p-4">${tiers.diamond.price}</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Video Quality</td>
                <td className="text-center p-4">{tiers.essential.resolution}</td>
                <td className="text-center p-4 bg-primary/5">{tiers.gold.resolution}</td>
                <td className="text-center p-4">{tiers.platinum.resolution}</td>
                <td className="text-center p-4">{tiers.diamond.resolution}</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Scenes</td>
                <td className="text-center p-4">{tiers.essential.videos}</td>
                <td className="text-center p-4 bg-primary/5">{tiers.gold.videos}</td>
                <td className="text-center p-4">{tiers.platinum.videos}</td>
                <td className="text-center p-4">{tiers.diamond.videos}</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Lip-sync Clips</td>
                <td className="text-center p-4">{tiers.essential.lipsyncClips}</td>
                <td className="text-center p-4 bg-primary/5">{tiers.gold.lipsyncClips}</td>
                <td className="text-center p-4">{tiers.platinum.lipsyncClips}</td>
                <td className="text-center p-4">{tiers.diamond.lipsyncClips}</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Regenerations</td>
                <td className="text-center p-4">{tiers.essential.regenerations}</td>
                <td className="text-center p-4 bg-primary/5">{tiers.gold.regenerations}</td>
                <td className="text-center p-4">{tiers.platinum.regenerations}</td>
                <td className="text-center p-4">Unlimited (30d)</td>
              </tr>
              <tr className="border-b bg-primary/10">
                <td className="p-4 font-bold">Free Subscription</td>
                <td className="text-center p-4 text-sm">STARTER<br/>${tiers.essential.subscriptionValue}/mo</td>
                <td className="text-center p-4 bg-primary/15 text-sm">CREATOR<br/>${tiers.gold.subscriptionValue}/mo</td>
                <td className="text-center p-4 text-sm">PRO<br/>${tiers.platinum.subscriptionValue}/mo</td>
                <td className="text-center p-4 text-sm">ENTERPRISE<br/>${tiers.diamond.subscriptionValue}/mo</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Contact Database</td>
                <td className="text-center p-4">500</td>
                <td className="text-center p-4 bg-primary/5">2,000</td>
                <td className="text-center p-4">5,000</td>
                <td className="text-center p-4">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Instagram Tools</td>
                <td className="text-center p-4">20/mo</td>
                <td className="text-center p-4 bg-primary/5">50/mo</td>
                <td className="text-center p-4">100/mo</td>
                <td className="text-center p-4">Unlimited</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">YouTube Tools</td>
                <td className="text-center p-4">Basic</td>
                <td className="text-center p-4 bg-primary/5">Basic</td>
                <td className="text-center p-4">PRO + Thumbnails</td>
                <td className="text-center p-4">Enterprise Suite</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Smart Cards</td>
                <td className="text-center p-4">-</td>
                <td className="text-center p-4 bg-primary/5">✓ Digital</td>
                <td className="text-center p-4">✓ NFC</td>
                <td className="text-center p-4">✓ Premium</td>
              </tr>
              <tr className="border-b">
                <td className="p-4 font-medium">Support</td>
                <td className="text-center p-4">Email</td>
                <td className="text-center p-4 bg-primary/5">Email</td>
                <td className="text-center p-4">Priority Chat</td>
                <td className="text-center p-4">24/7 + Manager</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="mt-16 text-center max-w-4xl mx-auto">
        <h3 className="text-2xl font-bold mb-4">Why Choose Boostify Bundles?</h3>
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Professional Quality</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Premium AI-generated videos that compete with $5k-$50k traditional production
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Complete Growth Suite</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                First month of tools free - Instagram, YouTube, Spotify growth tools included
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">20 Minutes vs 3 Weeks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get your professional music video in minutes, not weeks or months
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
