/**
 * BOOSTIFY Video Budget Modal
 * Pre-generation budget system with dynamic pricing, Stripe payment, and contract
 * 
 * ADMIN: Sees full modal for analysis → can click "Close & Continue" to bypass payment
 * CLIENT: Sees full modal → MUST accept contract + pay through Stripe to unlock generation
 * 
 * 4x markup on internal costs | Commercial prices ending in $X9
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { Stripe as StripeType } from '@stripe/stripe-js';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import {
  calculateVideoBudget,
  getAvailableVideoModels,
  formatDuration,
  formatPrice,
  VIDEO_MODEL_PRICING,
  IMAGE_MODEL_PRICING,
  type BudgetConfig,
  type BudgetResult,
} from '../../../../shared/video-budget-calculator';
import {
  DollarSign, Shield, FileText, CreditCard, Lock, Check, X,
  Sparkles, Film, Image, Music, Zap, Clock, AlertTriangle,
  ChevronRight, Eye, EyeOff, Info, Crown, ArrowRight
} from 'lucide-react';

// ============================================
// STRIPE LOADER
// ============================================
const getStripe = async (): Promise<StripeType | null> => {
  try {
    const { loadStripe } = await import('@stripe/stripe-js');
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
    if (!stripeKey) {
      logger.warn('[VideoBudget] Stripe public key not configured');
      return null;
    }
    return await loadStripe(stripeKey);
  } catch (error) {
    logger.error('[VideoBudget] Error loading Stripe:', error);
    return null;
  }
};

// ============================================
// STEP LABELS
// ============================================
const STEPS = ['config', 'contract', 'payment'] as const;
const STEP_LABELS: Record<string, string> = {
  config: 'Configure',
  contract: 'Contract',
  payment: 'Payment',
};

// ============================================
// TYPES
// ============================================
interface VideoBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBudgetApproved: (budgetId: number) => void;
  isAdmin: boolean;
  songDuration: number; // seconds
  numClips: number;
  clipDuration: number; // seconds per clip
  songTitle: string;
  userEmail: string;
  userId?: string;
  projectId?: number;
}

// ============================================
// CHECKOUT FORM (inside Stripe Elements)
// ============================================
function CheckoutForm({ 
  onPaymentSuccess, 
  budgetId,
  displayPrice,
}: { 
  onPaymentSuccess: (paymentIntentId: string) => void; 
  budgetId: number;
  displayPrice: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.origin,
        },
      });

      if (error) {
        toast({
          title: 'Payment Error',
          description: error.message,
          variant: 'destructive',
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        await apiRequest('POST', '/api/video-budget/verify-payment', {
          budgetId,
          paymentIntentId: paymentIntent.id,
        });

        toast({
          title: 'Payment Successful',
          description: 'Your video has been unlocked. Generation will begin shortly!',
        });

        onPaymentSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error processing payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full h-12 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
      >
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            Processing...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Pay ${displayPrice} & Generate Video
          </div>
        )}
      </Button>
    </form>
  );
}

// ============================================
// TIER BADGE COLORS
// ============================================
const tierColors: Record<string, string> = {
  cinematic: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black',
  ultra: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  premium: 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white',
  studio: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white',
  standard: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white',
};

// ============================================
// MAIN MODAL
// ============================================
export function VideoBudgetModal({
  isOpen,
  onClose,
  onBudgetApproved,
  isAdmin,
  songDuration,
  numClips,
  clipDuration,
  songTitle,
  userEmail,
  userId,
  projectId,
}: VideoBudgetModalProps) {
  const { toast } = useToast();
  
  // Config state
  const [videoModelId, setVideoModelId] = useState('kling-2.6-pro');
  const [imageModelId, setImageModelId] = useState('flux-2-pro');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [includesLipsync, setIncludesLipsync] = useState(true);
  const [includesMotion, setIncludesMotion] = useState(true);
  const [includesMicrocuts, setIncludesMicrocuts] = useState(true);
  const [showInternalCosts, setShowInternalCosts] = useState(false);
  
  // Contract state
  const [contractAccepted, setContractAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [signature, setSignature] = useState('');
  
  // Payment state
  const [step, setStep] = useState<'config' | 'contract' | 'payment'>('config');
  const [clientSecret, setClientSecret] = useState('');
  const [budgetId, setBudgetId] = useState<number | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<StripeType | null> | null>(null);

  // Calculate budget in real-time
  const budgetConfig: BudgetConfig = useMemo(() => ({
    songDurationSec: songDuration,
    clipDurationSec: clipDuration || 5,
    videoModelId,
    imageModelId,
    includesLipsync,
    includesMotion,
    includesMicrocuts,
    resolution,
  }), [songDuration, clipDuration, videoModelId, imageModelId, includesLipsync, includesMotion, includesMicrocuts, resolution]);

  const budget: BudgetResult = useMemo(() => calculateVideoBudget(budgetConfig), [budgetConfig]);

  // Load Stripe on mount
  useEffect(() => {
    if (isOpen && !isAdmin) {
      setStripePromise(getStripe());
    }
  }, [isOpen, isAdmin]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setContractAccepted(false);
      setTermsAccepted(false);
      setSignature('');
      setClientSecret('');
      setBudgetId(null);
    }
  }, [isOpen]);

  // Admin bypass handler
  const handleAdminBypass = useCallback(async () => {
    try {
      const response = await apiRequest('POST', '/api/video-budget/create-payment', {
        config: budgetConfig,
        userEmail,
        userId,
        songTitle,
        projectId,
      });

      if (response.adminBypass) {
        toast({
          title: 'Admin Bypass',
          description: `Budget logged: ${formatPrice(budget.displayPrice)} (internal: $${budget.internalCost.toFixed(2)})`,
        });
        onBudgetApproved(response.budgetId);
        return;
      }
    } catch (error: any) {
      logger.warn('[VideoBudget] Admin bypass API failed, using client-side bypass:', error.message);
      toast({
        title: 'Admin Bypass (Local)',
        description: `Budget: ${formatPrice(budget.displayPrice)} — record pending`,
      });
      onBudgetApproved(-1);
      return;
    }
  }, [budgetConfig, userEmail, userId, songTitle, projectId, budget, toast, onBudgetApproved]);

  // Proceed to contract step
  const handleProceedToContract = useCallback(() => {
    setStep('contract');
  }, []);

  // Proceed to payment step
  const handleProceedToPayment = useCallback(async () => {
    if (!contractAccepted || !termsAccepted || !signature.trim()) {
      toast({
        title: 'Incomplete Contract',
        description: 'You must accept the terms and sign the contract to proceed.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingPayment(true);
    try {
      const response = await apiRequest('POST', '/api/video-budget/create-payment', {
        config: budgetConfig,
        userEmail,
        userId,
        songTitle,
        projectId,
      });

      setBudgetId(response.budgetId);
      setClientSecret(response.clientSecret);

      await apiRequest('POST', '/api/video-budget/sign-contract', {
        budgetId: response.budgetId,
        signature: signature.trim(),
      });

      setStep('payment');
    } catch (error: any) {
      logger.error('[VideoBudget] Create payment error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create payment',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingPayment(false);
    }
  }, [contractAccepted, termsAccepted, signature, budgetConfig, userEmail, userId, songTitle, projectId, toast]);

  // Payment success handler
  const handlePaymentSuccess = useCallback((paymentIntentId: string) => {
    if (budgetId) {
      onBudgetApproved(budgetId);
    }
  }, [budgetId, onBudgetApproved]);

  const videoModels = getAvailableVideoModels();
  const currentStepIndex = STEPS.indexOf(step);

  // ============================================
  // RENDER
  // ============================================
  return (
    <Dialog open={isOpen} onOpenChange={isAdmin ? onClose : undefined}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-zinc-950 to-zinc-900 border border-zinc-700/50 p-0"
        onPointerDownOutside={(e) => { if (!isAdmin) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!isAdmin) e.preventDefault(); }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-2 sticky top-0 z-10 bg-gradient-to-b from-zinc-950 via-zinc-950 to-transparent">
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Film className="w-7 h-7 text-orange-500" />
            <span className="bg-gradient-to-r from-orange-400 to-purple-400 bg-clip-text text-transparent">
              Music Video Budget
            </span>
            {isAdmin && (
              <Badge className="ml-2 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <Crown className="w-3 h-3 mr-1" /> ADMIN
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-400">
            {songTitle} · {formatDuration(songDuration)} · {numClips} clips
          </DialogDescription>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 pt-3 pb-1">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step === s ? 'bg-orange-500 text-white scale-110 ring-2 ring-orange-500/30' :
                    currentStepIndex > i ? 'bg-green-500/20 text-green-400' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>
                    {currentStepIndex > i ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium ${step === s ? 'text-orange-400' : 'text-zinc-500'}`}>
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < 2 && (
                  <div className={`w-12 h-0.5 mb-4 rounded transition-colors ${
                    currentStepIndex > i ? 'bg-green-500/40' : 'bg-zinc-700/50'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* ============================================ */}
          {/* STEP 1: Configuration & Budget */}
          {/* ============================================ */}
          {step === 'config' && (
            <div className="space-y-4">
              {/* Model Selection */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Film className="w-4 h-4 text-purple-400" />
                    Video Quality
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Video Engine — card radio grid */}
                  <div>
                    <Label className="text-xs text-zinc-500 mb-2 block">Video Engine</Label>
                    <div className="grid grid-cols-1 gap-2">
                      {videoModels.map(model => {
                        const selected = videoModelId === model.id;
                        const tierStyle: Record<string, { ring: string; badge: string; label: string }> = {
                          cinematic: { ring: 'ring-yellow-500/60', badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30', label: '🏆 CINEMATIC' },
                          ultra:     { ring: 'ring-purple-500/60', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30', label: '⚡ ULTRA' },
                          premium:   { ring: 'ring-blue-500/60',   badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',     label: '💎 PREMIUM' },
                          studio:    { ring: 'ring-emerald-500/60', badge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30', label: '🎬 STUDIO' },
                          standard:  { ring: 'ring-zinc-500/60',   badge: 'bg-zinc-700/60 text-zinc-300 border border-zinc-600/40',      label: '✅ STANDARD' },
                        };
                        const ts = tierStyle[model.tier] || tierStyle.standard;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => setVideoModelId(model.id)}
                            className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                              selected
                                ? `border-orange-500/60 bg-orange-500/10 ring-1 ${ts.ring}`
                                : 'border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600 hover:bg-zinc-800/70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${selected ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'}`} />
                                <span className="text-sm font-semibold text-zinc-100 truncate">{model.name}</span>
                              </div>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${ts.badge}`}>{ts.label}</span>
                            </div>
                            <p className="text-[11px] text-zinc-400 mt-1 ml-5">{model.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Image Engine */}
                  <div>
                    <Label className="text-xs text-zinc-500 mb-2 block">Image Engine</Label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {Object.entries(IMAGE_MODEL_PRICING).map(([id, model]) => {
                        const selected = imageModelId === id;
                        const isAdvanced = id === 'seedream-4';
                        const isRecommended = id === 'flux-2-pro';
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setImageModelId(id)}
                            className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${
                              selected
                                ? 'border-orange-500/60 bg-orange-500/10'
                                : 'border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${selected ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'}`} />
                                <span className="text-xs font-medium text-zinc-200 truncate">{model.name}</span>
                              </div>
                              {isAdvanced && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">🌱 MOST ADVANCED</span>
                              )}
                              {isRecommended && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✓ RECOMMENDED</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resolution */}
                  <div>
                    <Label className="text-xs text-zinc-500 mb-2 block">Resolution</Label>
                    <div className="flex gap-2">
                      {(['720p', '1080p', '4k'] as const).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setResolution(r)}
                          className={`flex-1 rounded-lg border py-2 text-xs font-bold transition-all ${
                            resolution === r
                              ? 'border-orange-500/60 bg-orange-500/15 text-orange-300'
                              : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                          }`}
                        >
                          {r === '720p' ? '720p HD' : r === '1080p' ? '1080p Full HD' : '4K Ultra HD'}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Features Toggle */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    Professional Effects
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="lipsync" 
                        checked={includesLipsync} 
                        onCheckedChange={(v) => setIncludesLipsync(!!v)}
                      />
                      <Label htmlFor="lipsync" className="text-sm cursor-pointer">
                        LipSync AI (PixVerse)
                      </Label>
                    </div>
                    <span className="text-xs text-zinc-500">Lip synchronization</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="motion" 
                        checked={includesMotion} 
                        onCheckedChange={(v) => setIncludesMotion(!!v)}
                      />
                      <Label htmlFor="motion" className="text-sm cursor-pointer">
                        Motion Transfer (DreamActor)
                      </Label>
                    </div>
                    <span className="text-xs text-zinc-500">Choreography</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="microcuts" 
                        checked={includesMicrocuts} 
                        onCheckedChange={(v) => setIncludesMicrocuts(!!v)}
                      />
                      <Label htmlFor="microcuts" className="text-sm cursor-pointer">
                        MicroCuts Engine
                      </Label>
                    </div>
                    <span className="text-xs text-zinc-500">Cinematic effects</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Breakdown */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    Cost Breakdown
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowInternalCosts(!showInternalCosts)}
                        className="ml-auto h-6 px-2 text-[10px] text-yellow-400 hover:text-yellow-300"
                      >
                        {showInternalCosts ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                        {showInternalCosts ? 'Hide Internal' : 'Show Internal'}
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <CostLine 
                      label={`${budget.costBreakdown.images.count} images`}
                      icon="🖼️"
                      value={budget.costBreakdown.images.total}
                      showInternal={showInternalCosts}
                      detail={`${budget.costBreakdown.images.count} × $${budget.costBreakdown.images.unitCost}`}
                    />
                    <CostLine 
                      label={`${budget.costBreakdown.videos.count} video clips`}
                      icon="🎬"
                      value={budget.costBreakdown.videos.total}
                      showInternal={showInternalCosts}
                      detail={`${budget.costBreakdown.videos.count} × $${budget.costBreakdown.videos.unitCost.toFixed(3)}`}
                    />
                    {includesLipsync && (
                      <CostLine 
                        label={`${budget.costBreakdown.lipsync.count} lipsync clips`}
                        icon="🎤"
                        value={budget.costBreakdown.lipsync.total}
                        showInternal={showInternalCosts}
                      />
                    )}
                    {includesMotion && (
                      <CostLine 
                        label={`${budget.costBreakdown.motion.count} motion transfer`}
                        icon="🕺"
                        value={budget.costBreakdown.motion.total}
                        showInternal={showInternalCosts}
                      />
                    )}
                    <CostLine 
                      label="OpenAI Pipeline"
                      icon="🤖"
                      value={budget.costBreakdown.openai.total}
                      showInternal={showInternalCosts}
                    />
                    <CostLine 
                      label={`${budget.costBreakdown.render.passes} render passes`}
                      icon="🎞️"
                      value={budget.costBreakdown.render.total}
                      showInternal={showInternalCosts}
                    />
                    <CostLine 
                      label="Corrections buffer"
                      icon="🔄"
                      value={budget.costBreakdown.corrections.total}
                      showInternal={showInternalCosts}
                      detail={`${(budget.costBreakdown.corrections.buffer * 100).toFixed(0)}% of subtotal`}
                    />

                    <Separator className="bg-zinc-700/50 my-2" />

                    {/* Internal cost — admin only */}
                    {isAdmin && showInternalCosts && (
                      <div className="flex justify-between items-center text-yellow-400 text-xs bg-yellow-500/5 rounded px-2 py-1">
                        <span>Internal Cost</span>
                        <span className="font-mono font-bold">${budget.internalCost.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Display price */}
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${tierColors[budget.videoModel.tier]} text-xs`}>
                          {budget.tierEmoji} {budget.tierLabel}
                        </Badge>
                        <span className="text-zinc-300 font-medium">Total</span>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-black bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                          ${budget.displayPrice}
                        </span>
                        <span className="text-xs text-zinc-500 block">USD · one-time payment</span>
                      </div>
                    </div>

                    {/* Per clip cost */}
                    <div className="text-center text-xs text-zinc-500 mt-1">
                      ${budget.costPerClip}/clip · {budget.numClips} clips · {formatDuration(songDuration)}
                    </div>

                    {/* Admin internal details */}
                    {isAdmin && showInternalCosts && (
                      <div className="mt-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20 text-[11px] text-yellow-400/70">
                        <p>Markup: {budget.markupMultiplier}x | Raw price: ${budget.userPrice.toFixed(2)} → Display: ${budget.displayPrice}</p>
                        <p>Margin: ${(budget.displayPrice - budget.internalCost).toFixed(2)} ({((1 - budget.internalCost / budget.displayPrice) * 100).toFixed(0)}%)</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {isAdmin && (
                  <Button
                    onClick={handleAdminBypass}
                    variant="outline"
                    className="flex-1 h-12 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Close & Continue
                  </Button>
                )}
                <Button
                  onClick={handleProceedToContract}
                  className="flex-1 h-12 text-lg font-bold bg-gradient-to-r from-orange-500 to-purple-600 hover:from-orange-600 hover:to-purple-700"
                >
                  {isAdmin ? 'View Contract' : 'Continue'} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* STEP 2: Contract */}
          {/* ============================================ */}
          {step === 'contract' && (
            <div className="space-y-4">
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-400" />
                    Service Agreement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-h-52 overflow-y-auto text-xs text-zinc-400 bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 space-y-2.5 scrollbar-thin scrollbar-track-zinc-800 scrollbar-thumb-zinc-600">
                    <p className="font-bold text-zinc-300 text-sm">MUSIC VIDEO GENERATION SERVICE AGREEMENT — BOOSTIFY</p>
                    <p>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p>Client: {userEmail}</p>
                    <p>Project: "{songTitle}" — {formatDuration(songDuration)}</p>
                    <Separator className="bg-zinc-700/30" />
                    
                    <p className="font-semibold text-zinc-300">1. SERVICE</p>
                    <p>Boostify will generate a professional music video using state-of-the-art artificial intelligence. 
                    The service includes: generation of {budget.numClips} clips using the {budget.videoModel.name} engine, 
                    {includesLipsync ? ' lip synchronization (LipSync),' : ''} 
                    {includesMotion ? ' motion transfer (choreography),' : ''} 
                    {includesMicrocuts ? ' MicroCuts cinematic effects,' : ''} 
                    professional rendering at {resolution}, and included corrections.</p>
                    
                    <p className="font-semibold text-zinc-300">2. PRICING & PAYMENT</p>
                    <p>The total price for this service is ${budget.displayPrice} USD, payable in full before generation begins. 
                    Payment is processed securely through Stripe.</p>
                    
                    <p className="font-semibold text-zinc-300">3. DELIVERY TIME</p>
                    <p>The video will be generated within an estimated 15–45 minutes, depending on complexity and system load. 
                    Boostify does not guarantee exact delivery times.</p>
                    
                    <p className="font-semibold text-zinc-300">4. INTELLECTUAL PROPERTY</p>
                    <p>The client retains all rights to original content (music, lyrics, artist image). 
                    Boostify retains rights to the technology and processes used. The generated video is the property of the client.</p>
                    
                    <p className="font-semibold text-zinc-300">5. CORRECTIONS</p>
                    <p>This budget includes a corrections buffer ({(budget.costBreakdown.corrections.buffer * 100).toFixed(0)}% of the base cost). 
                    Additional corrections beyond the included buffer may incur extra charges.</p>
                    
                    <p className="font-semibold text-zinc-300">6. REFUND POLICY</p>
                    <p>Once an image or video has been successfully generated by the system, that content is <strong className="text-orange-400">non-refundable</strong>. 
                    The user is responsible for reviewing and approving each clip before proceeding with the next. 
                    Refunds will only be issued for clips that failed due to a verifiable system error 
                    (e.g., image not generated, corrupted video, or processing failure). 
                    Stylistic differences or artistic expectation mismatches do not constitute grounds for a refund.</p>
                    
                    <p className="font-semibold text-zinc-300">7. AI-GENERATED CONTENT</p>
                    <p>All content is generated by artificial intelligence models. While Boostify employs the best available models 
                    (Kling, Veo, Grok), results may vary. Photorealistic perfection is not guaranteed in all cases.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Checkbox 
                        id="contract" 
                        checked={contractAccepted}
                        onCheckedChange={(v) => setContractAccepted(!!v)}
                      />
                      <Label htmlFor="contract" className="text-sm cursor-pointer leading-tight">
                        I have read and accept the terms of the music video generation service agreement.
                      </Label>
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox 
                        id="terms" 
                        checked={termsAccepted}
                        onCheckedChange={(v) => setTermsAccepted(!!v)}
                      />
                      <Label htmlFor="terms" className="text-sm cursor-pointer leading-tight">
                        I authorize the charge of <strong>${budget.displayPrice} USD</strong> to my payment method for 
                        the generation of this music video.
                      </Label>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-zinc-500 mb-1 block">Digital Signature</Label>
                      <Input
                        placeholder="Type your full name as signature"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        className="bg-zinc-800 border-zinc-700 font-serif italic"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3 border border-zinc-700/50">
                <div>
                  <p className="text-sm text-zinc-300">
                    <Badge className={`${tierColors[budget.videoModel.tier]} text-xs mr-2`}>
                      {budget.tierEmoji} {budget.tierLabel}
                    </Badge>
                    {budget.numClips} clips · {budget.videoModel.name}
                  </p>
                </div>
                <p className="text-2xl font-black text-green-400">${budget.displayPrice}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setStep('config')}
                  variant="outline"
                  className="flex-1 h-11 border-zinc-700"
                >
                  <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                  Back
                </Button>
                {isAdmin ? (
                  <Button
                    onClick={handleAdminBypass}
                    className="flex-1 h-11 text-lg font-bold bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-600 hover:to-amber-600"
                  >
                    <Crown className="w-5 h-5 mr-2" />
                    Approve as Admin
                  </Button>
                ) : (
                  <Button
                    onClick={handleProceedToPayment}
                    disabled={!contractAccepted || !termsAccepted || !signature.trim() || isCreatingPayment}
                    className="flex-1 h-11 text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                  >
                    {isCreatingPayment ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        Preparing...
                      </div>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Proceed to Payment
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* STEP 3: Payment */}
          {/* ============================================ */}
          {step === 'payment' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                <div>
                  <p className="text-lg font-bold text-zinc-200">{songTitle}</p>
                  <p className="text-xs text-zinc-500">
                    {budget.numClips} clips · {budget.videoModel.name} · {resolution}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-green-400">${budget.displayPrice}</p>
                  <p className="text-xs text-zinc-500">USD</p>
                </div>
              </div>

              {/* Stripe Payment */}
              <Card className="bg-zinc-900/50 border-zinc-700/50">
                <CardContent className="pt-6 pb-4">
                  {clientSecret && stripePromise ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <CheckoutForm 
                        onPaymentSuccess={handlePaymentSuccess}
                        budgetId={budgetId!}
                        displayPrice={budget.displayPrice}
                      />
                    </Elements>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
                      <p className="text-xs text-zinc-500">Loading payment form...</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Security note */}
              <div className="text-center text-xs text-zinc-500 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" />
                Secure payment via Stripe · 30-day guarantee · SSL encrypted
              </div>

              <Button
                onClick={() => setStep('contract')}
                variant="ghost"
                className="w-full text-zinc-500 hover:text-zinc-300"
              >
                <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
                Back to contract
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// COST LINE HELPER
// ============================================
function CostLine({ 
  label, 
  icon,
  value, 
  showInternal, 
  detail 
}: { 
  label: string; 
  icon: string;
  value: number; 
  showInternal: boolean;
  detail?: string;
}) {
  return (
    <div className="flex justify-between items-center text-zinc-400">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <span>{label}</span>
        {detail && <span className="text-[10px] text-zinc-600 ml-0.5">({detail})</span>}
      </div>
      {showInternal ? (
        <span className="text-xs font-mono text-yellow-400/70">${value.toFixed(2)}</span>
      ) : (
        <span className="text-xs text-zinc-600">✓</span>
      )}
    </div>
  );
}
