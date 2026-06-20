/**
 * BTFPaymentModal — Universal "Pay with BTF" modal
 * 
 * Shows: service name, base price, tier discount, final price,
 * burn amount, approve → pay flow, success animation
 * 
 * Usage:
 *   <BTFPaymentModal
 *     serviceId="ai_song"
 *     open={showModal}
 *     onClose={() => setShowModal(false)}
 *     onSuccess={(result) => handleServiceUnlock(result)}
 *   />
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Flame, CheckCircle, AlertCircle, Loader2, Zap, Shield, ExternalLink, Wallet } from 'lucide-react';
import { useBTFPayment, type PaymentResult } from '@/hooks/use-btf-payment';
import {
  BTF_SERVICE_PRICES,
  calculateServicePrice,
  formatBTF,
  type BTFServiceId,
} from '@/lib/btf-service-pricing';
import { BTF_TOKEN_ADDRESS } from '@/lib/btf-token-config';
import { Link } from 'wouter';

interface BTFPaymentModalProps {
  serviceId: BTFServiceId;
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: PaymentResult) => void;
  customAmount?: number;
}

export function BTFPaymentModal({
  serviceId,
  open,
  onClose,
  onSuccess,
  customAmount,
}: BTFPaymentModalProps) {
  const {
    getPrice,
    canAfford,
    payForBTFService,
    userTier,
    btfBalance,
    isLoading,
    isConnected,
    status,
    lastResult,
    reset,
  } = useBTFPayment();

  const [step, setStep] = useState<'preview' | 'paying' | 'success' | 'error'>('preview');
  const [utilityAcknowledged, setUtilityAcknowledged] = useState(false);

  const handleAcknowledgeChange = useCallback(async (checked: boolean) => {
    setUtilityAcknowledged(checked);
    if (checked) {
      // Fire-and-forget: record the acknowledgement server-side
      try {
        await fetch('/api/btf/acknowledge-terms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'anonymous', termsVersion: 'v1.0' }),
        });
      } catch {
        // Non-critical — proceed even if logging fails
      }
    }
  }, []);

  const service = BTF_SERVICE_PRICES[serviceId];
  const pricing = getPrice(serviceId);
  const affordable = canAfford(serviceId);
  const effectiveAmount = customAmount || pricing.finalPrice;

  useEffect(() => {
    if (open) {
      setStep('preview');
      setUtilityAcknowledged(false);
      reset();
    }
  }, [open, reset]);

  const handlePay = useCallback(async () => {
    setStep('paying');
    const result = await payForBTFService(serviceId, customAmount);

    if (result.status === 'success') {
      setStep('success');
      onSuccess?.(result);
    } else {
      setStep('error');
    }
  }, [payForBTFService, serviceId, customAmount, onSuccess]);

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-black/95 border-purple-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">{service.icon}</span>
            Add BTF Credits — Service Access
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {service.name} — {service.description}
          </DialogDescription>
          <p className="text-xs text-gray-500 mt-1">
            You are using BTF Credits to access a Boostify digital service.
          </p>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ── Preview Step ── */}
          {step === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Price Breakdown */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Base Price</span>
                  <span>{formatBTF(pricing.basePrice)}</span>
                </div>

                {pricing.discountPercent > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {userTier} Discount ({pricing.discountPercent}%)
                    </span>
                    <span className="text-emerald-400">-{formatBTF(pricing.discountAmount)}</span>
                  </div>
                )}

                <div className="border-t border-white/10 pt-2 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className={pricing.isFree ? 'text-emerald-400' : 'text-purple-400'}>
                    {pricing.isFree ? 'FREE' : formatBTF(effectiveAmount)}
                  </span>
                </div>
              </div>

              {/* Burn Info */}
              {!pricing.isFree && (
                <div className="flex items-center gap-2 text-xs text-orange-400/80 bg-orange-500/10 rounded-lg px-3 py-2">
                  <Flame className="w-3 h-3 shrink-0" />
                  <span>
                    {formatBTF(pricing.burnAmount)} will be burned permanently (50% deflationary)
                  </span>
                </div>
              )}

              {/* Balance */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Your Balance</span>
                <span className={!affordable ? 'text-red-400' : 'text-white'}>
                  {btfBalance.toFixed(2)} BTF
                </span>
              </div>

              {/* Not Connected */}
              {!isConnected && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center text-sm text-red-400">
                  <Wallet className="w-4 h-4 mx-auto mb-1" />
                  Connect your wallet to pay with BTF
                </div>
              )}

              {/* Not Enough BTF */}
              {isConnected && !affordable && !pricing.isFree && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center text-sm">
                  <p className="text-orange-400 mb-2">
                    Need {formatBTF(effectiveAmount - btfBalance)} more BTF
                  </p>
                  <a
                    href="/btf-wallet"
                    className="text-purple-400 hover:text-purple-300 underline text-xs flex items-center justify-center gap-1"
                  >
                    Add BTF Credits <Zap className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Legal acknowledgement checkbox */}
              <div className="flex items-start gap-2 rounded-lg border border-gray-700/50 bg-gray-900/60 px-3 py-2">
                <Checkbox
                  id="utility-ack"
                  checked={utilityAcknowledged}
                  onCheckedChange={(v) => handleAcknowledgeChange(!!v)}
                  className="mt-0.5"
                />
                <label htmlFor="utility-ack" className="text-xs text-gray-400 leading-snug cursor-pointer">
                  I understand that BTF is a utility token used only to access digital services inside Boostify.
                  BTF is <strong>not</strong> an investment product and does not provide royalties, dividends,
                  revenue share, ownership, or profit rights.
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1 border-white/20 text-white hover:bg-white/10">
                  Cancel
                </Button>

                {pricing.isFree ? (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handlePay}
                    disabled={!utilityAcknowledged}
                  >
                    <Zap className="w-4 h-4 mr-1" /> Activate Free
                  </Button>
                ) : (
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    onClick={handlePay}
                    disabled={!affordable || !isConnected || !utilityAcknowledged}
                  >
                    <Flame className="w-4 h-4 mr-1" />
                    Use {formatBTF(effectiveAmount)} Credits
                  </Button>
                )}
              </div>

              {/* Tier Upsell */}
              {userTier === 'None' && (
                <p className="text-xs text-center text-gray-500">
                  <Link href="/btf-wallet" className="text-purple-400 hover:underline">
                    Activate a service tier
                  </Link>
                  {' '}to unlock up to 100% credit discounts
                </p>
              )}
            </motion.div>
          )}

          {/* ── Paying Step ── */}
          {step === 'paying' && (
            <motion.div
              key="paying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center space-y-4"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="mx-auto w-12 h-12"
              >
                <Loader2 className="w-12 h-12 text-purple-400" />
              </motion.div>
              <div>
                <p className="font-semibold">Processing Payment...</p>
                <p className="text-sm text-gray-400 mt-1">Confirm the transaction in your wallet</p>
              </div>
              <div className="text-xs text-gray-500">
                {pricing.isFree ? 'Verifying tier benefits...' : `Burning ${formatBTF(pricing.burnAmount)} BTF on Polygon`}
              </div>
            </motion.div>
          )}

          {/* ── Success Step ── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
              >
                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
              </motion.div>

              <div>
                <p className="font-bold text-lg text-emerald-400">Payment Complete!</p>
                <p className="text-sm text-gray-400 mt-1">{service.name} unlocked</p>
              </div>

              {lastResult?.burnedAmount ? (
                <div className="bg-orange-500/10 rounded-lg px-3 py-2 text-xs text-orange-400 flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3" />
                  {formatBTF(lastResult.burnedAmount)} BTF burned forever 🔥
                </div>
              ) : null}

              {lastResult?.txHash && (
                <a
                  href={`https://polygonscan.com/tx/${lastResult.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:underline flex items-center justify-center gap-1"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <Button
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600"
                onClick={onClose}
              >
                Continue
              </Button>
            </motion.div>
          )}

          {/* ── Error Step ── */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center space-y-4"
            >
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
              <div>
                <p className="font-bold text-red-400">Payment Failed</p>
                <p className="text-sm text-gray-400 mt-1">
                  {lastResult?.error || 'Transaction was rejected or failed'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1 border-white/20 text-white hover:bg-white/10">
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={() => setStep('preview')}
                >
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
//  PayWithBTFButton — Inline button that opens the modal
// ═══════════════════════════════════════════════════════

interface PayWithBTFButtonProps {
  serviceId: BTFServiceId;
  onSuccess?: (result: PaymentResult) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  children?: React.ReactNode;
}

export function PayWithBTFButton({
  serviceId,
  onSuccess,
  className = '',
  size = 'default',
  variant = 'default',
  children,
}: PayWithBTFButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const { getPrice, userTier } = useBTFPayment();
  const pricing = getPrice(serviceId);
  const service = BTF_SERVICE_PRICES[serviceId];

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        size={size}
        variant={variant as any}
        className={`${variant === 'default' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : ''} ${className}`}
      >
        {children || (
          <>
            <Flame className="w-4 h-4 mr-1" />
            {pricing.isFree ? (
              <span>Free with {userTier}</span>
            ) : (
              <span>Pay {formatBTF(pricing.finalPrice)} BTF</span>
            )}
          </>
        )}
      </Button>

      <BTFPaymentModal
        serviceId={serviceId}
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={(result) => {
          setShowModal(false);
          onSuccess?.(result);
        }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  ServicePriceTag — Small inline price indicator
// ═══════════════════════════════════════════════════════

interface ServicePriceTagProps {
  serviceId: BTFServiceId;
  className?: string;
}

export function ServicePriceTag({ serviceId, className = '' }: ServicePriceTagProps) {
  const { getPrice, userTier } = useBTFPayment();
  const pricing = getPrice(serviceId);

  if (pricing.isFree) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full ${className}`}>
        <Zap className="w-3 h-3" /> FREE
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full ${className}`}>
      <Flame className="w-3 h-3" /> {formatBTF(pricing.finalPrice)}
      {pricing.discountPercent > 0 && (
        <span className="text-emerald-400 line-through text-[10px] ml-1">
          {formatBTF(pricing.basePrice)}
        </span>
      )}
    </span>
  );
}
