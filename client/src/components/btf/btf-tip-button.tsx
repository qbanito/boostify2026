/**
 * BTFTipButton — Send BTF tips to artists
 * 
 * Features:
 * - Preset tip amounts (5, 10, 25, 50, 100 BTF)
 * - Custom amount input
 * - Uses direct transfer (2% auto-burn via transfer tax)
 * - Success animation with confetti emoji burst
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Send, Loader2, CheckCircle, AlertCircle, Flame, ExternalLink, Wallet } from 'lucide-react';
import { useBTFPayment } from '@/hooks/use-btf-payment';
import { TIP_PRESETS } from '@/lib/btf-service-pricing';

interface BTFTipButtonProps {
  artistAddress?: string;
  artistName: string;
  artistImage?: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export function BTFTipButton({
  artistAddress,
  artistName,
  artistImage,
  className = '',
  size = 'sm',
}: BTFTipButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Button
        size={size}
        onClick={() => setShowModal(true)}
        className={`bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white ${className}`}
      >
        <Heart className="w-3 h-3 mr-1" />
        {size !== 'icon' && 'Tip BTF'}
      </Button>

      <BTFTipModal
        artistAddress={artistAddress}
        artistName={artistName}
        artistImage={artistImage}
        open={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  Tip Modal
// ═══════════════════════════════════════════════════════

interface BTFTipModalProps {
  artistAddress?: string;
  artistName: string;
  artistImage?: string;
  open: boolean;
  onClose: () => void;
}

function BTFTipModal({
  artistAddress,
  artistName,
  artistImage,
  open,
  onClose,
}: BTFTipModalProps) {
  const { sendTip, btfBalance, isConnected } = useBTFPayment();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState('');
  const [step, setStep] = useState<'select' | 'sending' | 'success' | 'error'>('select');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const effectiveAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;
  const canAfford = btfBalance >= effectiveAmount && effectiveAmount > 0;
  const burnAmount = Math.floor(effectiveAmount * 2 / 100); // 2% transfer burn
  const artistReceives = effectiveAmount - burnAmount;

  const handleSend = useCallback(async () => {
    if (!artistAddress || !canAfford) return;

    setStep('sending');
    const result = await sendTip(artistAddress, effectiveAmount);

    if (result.status === 'success') {
      setTxHash(result.txHash);
      setStep('success');
    } else {
      setError(result.error || 'Transaction failed');
      setStep('error');
    }
  }, [artistAddress, effectiveAmount, canAfford, sendTip]);

  const handleClose = () => {
    setStep('select');
    setCustomAmount('');
    setSelectedAmount(10);
    setError('');
    setTxHash(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm bg-black/95 border-pink-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400" />
            Tip {artistName}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Send BTF directly to this artist. 2% burn fuels deflation.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ── Select Amount ── */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Artist Preview */}
              {artistImage && (
                <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                  <img
                    src={artistImage}
                    alt={artistName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-sm">{artistName}</p>
                    <p className="text-xs text-gray-400">Will receive {artistReceives.toFixed(1)} BTF</p>
                  </div>
                </div>
              )}

              {/* Presets */}
              <div className="grid grid-cols-5 gap-1.5">
                {TIP_PRESETS.map((preset) => (
                  <button
                    key={preset.amount}
                    onClick={() => { setSelectedAmount(preset.amount); setCustomAmount(''); }}
                    className={`rounded-lg p-2 text-center transition-all border ${
                      selectedAmount === preset.amount && !customAmount
                        ? 'border-pink-500 bg-pink-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <span className="text-lg">{preset.emoji}</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">{preset.amount}</p>
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Custom amount..."
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="bg-white/5 border-white/10 text-white pl-3 pr-12"
                  min={1}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">BTF</span>
              </div>

              {/* Summary */}
              <div className="bg-white/5 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tip Amount</span>
                  <span className="font-bold">{effectiveAmount} BTF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" /> Burn (2%)
                  </span>
                  <span className="text-orange-400">{burnAmount.toFixed(2)} BTF</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5">
                  <span className="text-gray-400">Artist Receives</span>
                  <span className="text-emerald-400 font-bold">{artistReceives.toFixed(2)} BTF</span>
                </div>
              </div>

              {/* Balance */}
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Your Balance</span>
                <span className={!canAfford ? 'text-red-400' : 'text-gray-400'}>
                  {btfBalance.toFixed(2)} BTF
                </span>
              </div>

              {!isConnected && (
                <div className="text-center text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
                  <Wallet className="w-4 h-4 mx-auto mb-1" />
                  Connect wallet to send tips
                </div>
              )}

              {!artistAddress && (
                <div className="text-center text-xs text-yellow-400 bg-yellow-500/10 rounded-lg p-2">
                  This artist hasn't set a wallet address yet
                </div>
              )}

              {/* Send Button */}
              <Button
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
                onClick={handleSend}
                disabled={!canAfford || !isConnected || !artistAddress || effectiveAmount <= 0}
              >
                <Send className="w-4 h-4 mr-1" />
                Send {effectiveAmount} BTF
              </Button>
            </motion.div>
          )}

          {/* ── Sending ── */}
          {step === 'sending' && (
            <motion.div
              key="sending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8 text-center space-y-3"
            >
              <Loader2 className="w-10 h-10 text-pink-400 animate-spin mx-auto" />
              <p className="font-semibold">Sending Tip...</p>
              <p className="text-xs text-gray-400">Confirm in your wallet</p>
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="text-5xl"
              >
                💝
              </motion.div>
              <p className="font-bold text-lg text-pink-400">Tip Sent!</p>
              <p className="text-sm text-gray-400">
                {artistName} received {artistReceives.toFixed(2)} BTF
              </p>
              <p className="text-xs text-orange-400">
                <Flame className="w-3 h-3 inline" /> {burnAmount.toFixed(2)} BTF burned
              </p>
              {txHash && (
                <a
                  href={`https://polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:underline flex items-center justify-center gap-1"
                >
                  View on Polygonscan <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <Button
                className="w-full bg-gradient-to-r from-pink-600 to-rose-600"
                onClick={handleClose}
              >
                Done
              </Button>
            </motion.div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center space-y-3"
            >
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <p className="font-bold text-red-400">Tip Failed</p>
              <p className="text-sm text-gray-400">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} className="flex-1 border-white/20 text-white hover:bg-white/10">
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-pink-600 hover:bg-pink-700"
                  onClick={() => setStep('select')}
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
//  Inline Tip Badge (shows on artist profiles)
// ═══════════════════════════════════════════════════════

interface TipBadgeProps {
  totalTipsReceived?: number;
  className?: string;
}

export function TipBadge({ totalTipsReceived = 0, className = '' }: TipBadgeProps) {
  if (totalTipsReceived === 0) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full ${className}`}>
      💝 {totalTipsReceived >= 1000 ? `${(totalTipsReceived / 1000).toFixed(1)}K` : totalTipsReceived} BTF received
    </span>
  );
}
