/**
 * ModuleGate — access control for a platform module.
 *
 * Renders children if the user can access `moduleKey` via subscription, a
 * one-time unlock, the all-access pass, or admin. Otherwise shows a paywall
 * with TWO paths:
 *   • Unlock for $X  → one-time Stripe checkout (lifetime access to this module)
 *   • Subscribe      → go to /pricing (best deal; unlocks everything in the tier)
 *
 * Heavy AI renders stay credit-metered even after an unlock.
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import * as Icons from 'lucide-react';
import { Lock, ArrowRight, Loader2, Check } from 'lucide-react';
import { useModuleAccess } from '../../hooks/use-module-access';
import { getModule } from '../../../../shared/module-catalog';
import { getPlanDisplayName } from '../../../../shared/plan-config';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';

export interface ModuleGateProps {
  moduleKey: string;
  children: React.ReactNode;
  /** Show blurred children behind the paywall instead of a plain card. */
  preview?: boolean;
  /** Hide silently when locked (no paywall UI). */
  silent?: boolean;
}

export function ModuleGate({ moduleKey, children, preview = false, silent = false }: ModuleGateProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isLoading, hasModuleAccess, refetch } = useModuleAccess();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const mod = getModule(moduleKey);
  const price = mod ? (mod.unlockPriceCents / 100).toFixed(0) : null;
  const tierName = mod ? getPlanDisplayName(mod.requiredPlan) : '';
  const access = hasModuleAccess(moduleKey);

  // Handle the Stripe redirect back (?unlocked=<key> | ?unlock=cancelled).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlocked = params.get('unlocked');
    if (unlocked) {
      refetch?.();
      if (unlocked === moduleKey) {
        toast({
          title: '¡Módulo desbloqueado! 🎉',
          description: `Ya tienes acceso de por vida a ${mod?.name || 'este módulo'}.`,
        });
      }
      params.delete('unlocked');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCheckout = async () => {
    try {
      setCheckoutLoading(true);
      const returnPath = window.location.pathname + window.location.search;
      const r: any = await apiRequest({
        url: `/api/modules/${moduleKey}/unlock-checkout`,
        method: 'POST',
        data: { returnPath },
      });
      if (r?.url) {
        window.location.href = r.url;
        return;
      }
      throw new Error(r?.error || 'No se pudo iniciar el pago');
    } catch (e: any) {
      // Already-owned race → just refresh access.
      if (e?.message?.toLowerCase?.().includes('already')) {
        refetch?.();
      } else if (e?.message?.toLowerCase?.().includes('auth')) {
        toast({ title: 'Inicia sesión', description: 'Necesitas una cuenta para desbloquear.', variant: 'destructive' });
        navigate('/auth');
      } else {
        toast({ title: 'No se pudo iniciar el pago', description: e?.message || 'Inténtalo de nuevo.', variant: 'destructive' });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return silent ? null : (
      <div className="flex items-center justify-center p-10 min-h-[160px]">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (access) return <>{children}</>;
  if (silent) return null;

  // Resolve the module's icon from lucide-react by name (fallback to Lock).
  const ModIcon = (mod && (Icons as any)[mod.icon]) || Lock;

  const Paywall = (
    <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-10 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-xl mb-5">
        <ModIcon className="h-8 w-8 text-white" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">{mod?.name || 'Módulo premium'}</h3>
      {mod?.description && <p className="text-white/70 mb-1 max-w-md">{mod.description}</p>}
      {mod?.note && <p className="text-[11px] text-white/40 mb-5">{mod.note}</p>}

      <div className="w-full flex flex-col sm:flex-row gap-3 mt-4">
        {/* One-time unlock */}
        {price && (
          <button
            type="button"
            onClick={startCheckout}
            disabled={checkoutLoading}
            className="flex-1 group relative overflow-hidden rounded-xl border border-orange-500/40 bg-white/[0.03] hover:bg-white/[0.06] px-5 py-4 transition-all disabled:opacity-60"
            data-testid={`button-unlock-${moduleKey}`}
          >
            <div className="flex items-center justify-center gap-2 text-white font-bold text-lg">
              {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 text-orange-400" />}
              Desbloquear ${price}
            </div>
            <div className="text-[11px] text-white/50 mt-1">Pago único · acceso de por vida</div>
          </button>
        )}

        {/* Subscription upsell (best value) */}
        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-pink-600 hover:scale-[1.02] px-5 py-4 transition-all"
          data-testid={`button-subscribe-${moduleKey}`}
        >
          <div className="flex items-center justify-center gap-2 text-white font-bold text-lg">
            Suscríbete <ArrowRight className="h-4 w-4" />
          </div>
          <div className="text-[11px] text-white/80 mt-1">Plan {tierName} · desbloquéalo TODO</div>
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-white/40 mt-5">
        <Check className="h-3 w-3 text-green-400" /> La suscripción incluye este y todos los módulos de su nivel
      </div>
    </div>
  );

  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl min-h-[320px]">
        <div className="filter blur-md pointer-events-none select-none opacity-40">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/80 to-black/90 backdrop-blur-sm">
          {Paywall}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-black min-h-[320px] flex items-center justify-center">
      {Paywall}
    </div>
  );
}

export default ModuleGate;
