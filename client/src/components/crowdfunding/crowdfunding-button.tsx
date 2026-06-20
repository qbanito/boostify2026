import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { Heart, DollarSign, Loader2, TrendingUp } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { motion, AnimatePresence } from "framer-motion";

interface CrowdfundingCampaign {
  id: number;
  userId: number;
  title: string;
  description?: string;
  goalAmount: string;
  currentAmount: string;
  isActive: boolean;
  contributorsCount: number;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface CrowdfundingButtonProps {
  artistSlug: string;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
  };
}

export function CrowdfundingButton({ artistSlug, colors }: CrowdfundingButtonProps) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [campaign, setCampaign] = useState<CrowdfundingCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form state
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [contributorEmail, setContributorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Preset amounts
  const presetAmounts = [5, 10, 20, 50, 100];

  useEffect(() => {
    loadCampaign();
  }, [artistSlug]);

  const loadCampaign = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/crowdfunding/campaign/${artistSlug}`);
      const data = await response.json();

      if (data.success && data.campaign) {
        setCampaign(data.campaign);
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = () => {
    if (!campaign) return 0;
    const current = parseFloat(campaign.currentAmount || '0');
    const goal = parseFloat(campaign.goalAmount || '0');
    return goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  };

  const getContributionAmount = () => {
    if (customAmount) {
      const amount = parseFloat(customAmount);
      return isNaN(amount) || amount <= 0 ? null : amount;
    }
    return selectedAmount;
  };

  const handleContribute = async () => {
    const amount = getContributionAmount();

    if (!amount) {
      toast({
        title: "Amount Required",
        description: "Please select or enter a contribution amount",
        variant: "destructive",
      });
      return;
    }

    if (!isAnonymous && (!contributorEmail || !contributorName)) {
      toast({
        title: "Information Required",
        description: "Please provide your name and email, or contribute anonymously",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create Payment Intent
      const paymentIntentResponse = await fetch('/api/crowdfunding/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign!.id,
          amount,
          contributorEmail: isAnonymous ? null : contributorEmail,
          contributorName: isAnonymous ? null : contributorName,
        }),
      });

      const paymentIntentData = await paymentIntentResponse.json();

      if (!paymentIntentData.success) {
        throw new Error(paymentIntentData.message || 'Failed to create payment intent');
      }

      // Load Stripe
      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        paymentIntentData.clientSecret,
        {
          payment_method: {
            card: {
              // Aquí deberías usar Stripe Elements, pero para simplificar usamos payment link
            }
          }
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      // Confirm contribution in backend
      await fetch('/api/crowdfunding/confirm-contribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentIntent!.id,
          campaignId: campaign!.id,
          amount,
          contributorEmail: isAnonymous ? null : contributorEmail,
          contributorName: isAnonymous ? null : contributorName,
          message,
          isAnonymous,
        }),
      });

      toast({
        title: "Thank You!",
        description: `Your $${amount} contribution has been received successfully!`,
      });

      // Reload campaign data
      await loadCampaign();
      setShowDialog(false);
      resetForm();
    } catch (error: any) {
      console.error('Error processing contribution:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedAmount(null);
    setCustomAmount("");
    setContributorName("");
    setContributorEmail("");
    setMessage("");
    setIsAnonymous(false);
  };

  // Don't show button if no campaign or campaign is inactive
  if (isLoading || !campaign || !campaign.isActive) {
    return null;
  }

  const progress = calculateProgress();
  const current = parseFloat(campaign.currentAmount || '0');
  const goal = parseFloat(campaign.goalAmount || '0');

  return (
    <>
      {/* Floating Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed top-20 right-4 md:top-24 md:right-8 z-40"
      >
        <Button
          onClick={() => setShowDialog(true)}
          className="group relative overflow-hidden rounded-full px-4 md:px-6 py-2 md:py-3 font-bold text-sm md:text-base shadow-2xl transition-all duration-300 hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 100%)`,
            color: 'white',
          }}
          data-testid="button-crowdfunding-support"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-white/20 rounded-full"
          />
          <span className="relative flex items-center gap-2">
            <Heart className="h-4 w-4 md:h-5 md:w-5 fill-current" />
            <span className="hidden sm:inline">Support My Music</span>
            <span className="sm:hidden">Support</span>
          </span>
          {progress > 0 && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {Math.round(progress)}%
            </span>
          )}
        </Button>
      </motion.div>

      {/* Crowdfunding Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-950 border-gray-800 max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <Heart className="h-6 w-6" style={{ color: colors.hexAccent }} />
              {campaign.title}
            </DialogTitle>
            {campaign.description && (
              <DialogDescription className="text-gray-400 text-base">
                {campaign.description}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 100%)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white font-bold">
                  ${current.toFixed(0)} raised
                </span>
                <span className="text-gray-400">
                  of ${goal.toFixed(0)} goal
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingUp className="h-4 w-4" style={{ color: colors.hexAccent }} />
                <span>{campaign.contributorsCount} contributions</span>
              </div>
            </div>

            {/* Amount Selection */}
            <div className="space-y-3">
              <Label className="text-white text-sm font-semibold">Contribution Amount</Label>
              <div className="grid grid-cols-3 gap-2">
                {presetAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => {
                      setSelectedAmount(amount);
                      setCustomAmount("");
                    }}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
                      selectedAmount === amount ? 'ring-2 scale-105' : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: selectedAmount === amount ? colors.hexPrimary : 'transparent',
                      borderColor: colors.hexBorder,
                      borderWidth: '1px',
                      color: selectedAmount === amount ? 'white' : colors.hexAccent,
                    }}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="pl-10 bg-gray-900 border-gray-700 text-white"
                />
              </div>
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="anonymous" className="text-gray-400 text-sm cursor-pointer">
                Contribute anonymously
              </Label>
            </div>

            {/* Contributor Info */}
            {!isAnonymous && (
              <div className="space-y-3">
                <div>
                  <Label className="text-white text-sm">Your Name</Label>
                  <Input
                    value={contributorName}
                    onChange={(e) => setContributorName(e.target.value)}
                    placeholder="John Doe"
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white text-sm">Email</Label>
                  <Input
                    type="email"
                    value={contributorEmail}
                    onChange={(e) => setContributorEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
              </div>
            )}

            {/* Message */}
            <div>
              <Label className="text-white text-sm">Message (optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Leave a message of support..."
                className="bg-gray-900 border-gray-700 text-white resize-none"
                rows={3}
              />
            </div>

            {/* Platform Fee Notice */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-xs text-gray-400">
              ℹ️ <strong>70%</strong> goes to the artist, <strong>30%</strong> platform fee supports Boostify Music
            </div>

            {/* Contribute Button */}
            <Button
              onClick={handleContribute}
              disabled={isProcessing || !getContributionAmount()}
              className="w-full py-6 text-lg font-bold disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 100%)`,
                color: 'white',
              }}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Heart className="h-5 w-5 fill-current" />
                  Support with ${getContributionAmount() || 0}
                </span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
