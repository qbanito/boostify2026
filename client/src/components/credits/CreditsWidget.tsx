/**
 * CreditsWidget
 * =============
 * Compact, owner-only credit bar for the artist profile. Shows the live credit
 * balance, a low-balance warning, and a "Buy Credits" button that opens
 * BuyCreditsModal. Also self-heals a returning Stripe Checkout (?credits_session=)
 * by verifying it and refreshing the balance.
 */

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Zap, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const BuyCreditsModal = lazy(() => import('./BuyCreditsModal'));

interface Props {
  email?: string;
  tier?: string;
  accentColor?: string;
  primaryColor?: string;
  lowBalanceThreshold?: number;
}

export default function CreditsWidget({
  email,
  tier = 'free',
  accentColor = '#f97316',
  primaryColor = '#ec4899',
  lowBalanceThreshold = 50,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const verifyingRef = useRef(false);

  const balanceQuery = useQuery({
    queryKey: ['credit-balance', email],
    queryFn: async () => {
      if (!email) return { credits: 0, isAdmin: false };
      const res = await apiRequest({ url: `/api/credits/balance`, method: 'GET', params: { email } });
      return res || { credits: 0, isAdmin: false };
    },
    enabled: !!email,
    staleTime: 30 * 1000,
  });

  const credits: number = balanceQuery.data?.credits ?? 0;
  const isAdmin: boolean = !!balanceQuery.data?.isAdmin;

  // Settle a returning Stripe Checkout session.
  useEffect(() => {
    if (!email || verifyingRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('credits_session');
    if (!sessionId) return;

    verifyingRef.current = true;
    (async () => {
      try {
        const res = await apiRequest('/api/credits/verify-checkout', { method: 'POST', data: { sessionId } });
        if (res?.success) {
          toast({
            title: res.alreadyProcessed ? 'Purchase already applied' : 'Credits added!',
            description: `${(res.credits || 0).toLocaleString()} credits are now in your balance.`,
          });
          await queryClient.invalidateQueries({ queryKey: ['credit-balance', email] });
        }
      } catch (e: any) {
        toast({ title: 'Could not verify purchase', description: e?.message || 'Please contact support if charged.', variant: 'destructive' });
      } finally {
        // Strip the query param so we don't re-verify on refresh.
        params.delete('credits_session');
        const clean = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
        window.history.replaceState({}, '', clean);
      }
    })();
  }, [email, queryClient, toast]);

  if (!email) return null;

  const isLow = !isAdmin && credits < lowBalanceThreshold;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-3.5 shadow-lg overflow-hidden relative flex items-center justify-between gap-3"
        style={{
          background: isLow
            ? `linear-gradient(135deg, rgba(40,20,10,0.85) 0%, rgba(20,12,8,0.7) 100%)`
            : `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)`,
          border: `1px solid ${isLow ? '#f59e0b66' : `${accentColor}55`}`,
          boxShadow: `0 0 24px ${accentColor}22, inset 0 1px 0 ${accentColor}22`,
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}33, ${accentColor}33)`, border: `1px solid ${accentColor}55` }}
          >
            <Zap className="h-5 w-5" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {balanceQuery.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <span className="text-lg font-extrabold text-white leading-none">
                  {isAdmin ? '∞' : credits.toLocaleString()}
                </span>
              )}
              <span className="text-xs font-semibold text-gray-400">credits</span>
            </div>
            {isLow ? (
              <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-3 w-3" /> Low balance — top up to keep creating
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 mt-0.5">Powers your AI image, video & voice tools</p>
            )}
          </div>
        </div>

        {!isAdmin && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-xs text-white transition-all hover:scale-[1.03]"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, boxShadow: `0 2px 12px ${accentColor}44` }}
            data-testid="button-buy-credits"
          >
            <Plus className="h-3.5 w-3.5" /> Buy Credits
          </button>
        )}
      </motion.div>

      {modalOpen && (
        <Suspense fallback={null}>
          <BuyCreditsModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            email={email}
            tier={tier}
            accentColor={accentColor}
            primaryColor={primaryColor}
          />
        </Suspense>
      )}
    </>
  );
}
