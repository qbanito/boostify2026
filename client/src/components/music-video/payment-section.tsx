import { useState, memo } from "react";
import { logger } from "../../lib/logger";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { CheckCircle2, CreditCard, Loader2, Lock, Sparkles, Zap } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";

interface PaymentSectionProps {
  songName: string;
  duration: number;
  userId: string;
  isPaid: boolean;
  onPaymentSuccess: () => void;
}

export const PaymentSection = memo(function PaymentSection({ 
  songName, 
  duration, 
  userId,
  isPaid,
  onPaymentSuccess 
}: PaymentSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // DEPRECATED: Individual video payment removed in favor of bundles
      // Use music video pricing page for tier-based bundles (video + subscription)
      const response = await apiRequest({
        url: '/api/stripe/create-music-video-bundle-checkout',
        method: 'POST',
        data: {
          tier: 'gold',
          songName: songName || 'Music Video',
          duration: duration || 180
        }
      }) as { url: string };

      if (response.url) {
        // Redirigir a Stripe Checkout
        window.location.href = response.url;
      } else {
        throw new Error('Payment URL not received');
      }
    } catch (error) {
      logger.error('Error al crear sesión de pago:', error);
      toast({
        title: t('payment.paymentError'),
        description: error instanceof Error ? error.message : t('payment.couldNotInitiate'),
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (isPaid) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            {t('payment.fullVideoUnlocked')}
          </CardTitle>
          <CardDescription>
            {t('payment.paidForComplete')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{t('payment.thirtyScenes')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{t('payment.fullVideo', { duration })}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span>{t('payment.professionalQuality')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 w-full" data-testid="payment-section">
      {/* Plan Gratuito */}
      <Card className="border-muted hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="text-base md:text-lg">{t('payment.freePreview')}</CardTitle>
            <Badge variant="secondary" className="text-xs">{t('payment.freePreview')}</Badge>
          </div>
          <CardDescription>
            {t('payment.tryBeforePay')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span>{t('payment.tenSecondPreview')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span>{t('payment.testScenes')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4" />
              <span>{t('payment.standardQuality')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Premium */}
      <Card className="border-primary shadow-lg relative overflow-hidden hover:shadow-xl transition-shadow">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
        
        <CardHeader className="relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              {t('payment.premiumFullVideo')}
            </CardTitle>
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm md:text-base px-3 py-1">
              {t('payment.priceLabel')}
            </Badge>
          </div>
          <CardDescription>
            {t('payment.professionalGrade')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 relative">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">30 unique cinematic scenes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Full video ({Math.round(duration)}s)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Premium models (KLING, Veo, Sora)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Varied and creative prompts</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">High-quality download</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Permanently saved in your account</span>
            </div>
          </div>

          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg text-sm md:text-base"
            size="lg"
            data-testid="button-pay-premium"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('payment.processing')}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {t('payment.unlockFullVideo')} - {t('payment.priceLabel')}
              </>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>{t('payment.securePayment')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
