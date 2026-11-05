import { useEffect, useMemo, useState } from 'react';
import { Coins, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { apiRequest } from '../../lib/queryClient';
import { CREDIT_PACKAGES } from '../../../../shared/credit-pricing';

interface QuoteItem {
  stage: string;
  label: string;
  providerCostUsd: number;
  credits: number;
}

interface QuoteResponse {
  success: boolean;
  quote: {
    providerCostUsd: number;
    customerPriceUsd: number;
    credits: number;
    markupMultiplier: number;
    items: QuoteItem[];
  };
  balance: number;
  canAfford: boolean;
  isAdmin: boolean;
}

export function MusicVideoCostSummary({
  sceneCount,
  projectId,
  resolution = '1080p',
}: {
  sceneCount: number;
  projectId?: number | null;
  resolution?: '480p' | '720p' | '1080p';
}) {
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizedScenes = Math.min(200, Math.max(1, Math.round(sceneCount || 40)));

  const loadQuote = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiRequest({
        url: '/api/music-video-billing/quote',
        method: 'POST',
        data: {
          projectId: projectId || undefined,
          sceneCount: normalizedScenes,
          clipDurationSeconds: 5,
          videoModel: 'alibaba/wan-3.0/reference-to-video',
          resolution,
          imageModel: 'openai/gpt-image-2.5/sunburst',
          imageQuality: 'high',
          includeScript: true,
          includeTranscription: true,
          renderMinutes: Math.ceil((normalizedScenes * 5) / 60),
        },
      });
      setData(response);
    } catch (quoteError: any) {
      setError(quoteError?.message || 'Could not calculate the project estimate.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQuote(), 250);
    return () => window.clearTimeout(timer);
  }, [normalizedScenes, projectId, resolution]);

  const recommendedPackage = useMemo(() => {
    if (!data) return CREDIT_PACKAGES[0];
    const shortage = Math.max(0, data.quote.credits - data.balance);
    return CREDIT_PACKAGES.find((pkg) => pkg.credits >= shortage) || CREDIT_PACKAGES[CREDIT_PACKAGES.length - 1];
  }, [data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('credits_session');
    if (!sessionId) return;
    void apiRequest({
      url: '/api/credits/verify-checkout',
      method: 'POST',
      data: { sessionId },
    }).then(() => {
      params.delete('credits_session');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', next);
      void loadQuote();
    }).catch((verificationError: any) => {
      setError(verificationError?.message || 'Your payment is still being verified. Refresh in a moment.');
    });
  }, []);

  const buyCredits = async () => {
    try {
      setCheckoutLoading(true);
      const response = await apiRequest({
        url: '/api/credits/create-checkout-session',
        method: 'POST',
        data: { packageId: recommendedPackage.id, successUrl: window.location.href },
      });
      if (!response?.url) throw new Error('Stripe Checkout did not return a payment URL.');
      window.location.href = response.url;
    } catch (checkoutError: any) {
      setError(checkoutError?.message || 'Could not open Stripe Checkout.');
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="mx-3 mt-3 rounded-2xl border border-orange-400/20 bg-gradient-to-r from-orange-500/[0.08] via-black/80 to-fuchsia-500/[0.06] p-3 text-white shadow-[0_18px_70px_rgba(249,115,22,0.08)] sm:mx-6 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-2.5 text-orange-300">
            <Coins className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold sm:text-base">Live project credit estimate</h3>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Estimated pricing
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              This estimate covers the listed stages and may change with your model, duration and creative choices.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-white/60"><Loader2 className="h-4 w-4 animate-spin" /> Calculating…</div>
        ) : data ? (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Estimated use</p>
              <p className="text-lg font-semibold text-orange-300">{data.isAdmin ? 'Admin included' : `${data.quote.credits.toLocaleString()} credits`}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Your balance</p>
              <p className="text-lg font-semibold">{data.balance.toLocaleString()}</p>
            </div>
            {!data.canAfford && !data.isAdmin && (
              <Button onClick={buyCredits} disabled={checkoutLoading} className="bg-orange-500 text-white hover:bg-orange-400">
                {checkoutLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Buy {recommendedPackage.label}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => void loadQuote()} aria-label="Refresh credit estimate">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}

export default MusicVideoCostSummary;
