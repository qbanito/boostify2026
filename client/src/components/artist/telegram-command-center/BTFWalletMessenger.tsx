import { Wallet, ArrowDownUp, Coins } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader, StatTile, ConciergeComposer } from './shared';

/**
 * BTF Wallet Messenger — notify sales / tokens received, show balance and recent
 * transactions, and confirm internal conversions over Telegram.
 */
export function BTFWalletMessenger({ center }: { center: TelegramCenter }) {
  const revenue = center.analytics?.revenue ?? 0;
  const template = '🪙 ¡Venta confirmada! Se acreditaron tokens BTF a tu wallet. Revisa tu balance y transacciones en tu Artist Profile.';

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Wallet className="h-5 w-5" />}
        title="BTF Wallet"
        subtitle="Notifica ventas y tokens, muestra balance y confirma conversiones."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Ingresos Telegram" value={`$${revenue.toFixed(2)}`} accent="amber" />
        <StatTile label="Ventas tickets" value={center.analytics?.ticketsSold ?? 0} />
        <StatTile label="Ventas merch" value={center.analytics?.merchSold ?? 0} accent="sky" />
      </div>

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
          <Coins className="h-4 w-4 text-amber-300" /> Notificación de wallet
        </div>
        <ConciergeComposer center={center} placeholder="Mensaje de wallet/transacción…" defaultMessage={template} ctaLabel="Enviar notificación" />
      </GlassCard>

      <GlassCard className="flex items-center gap-2 p-3 text-xs text-white/55">
        <ArrowDownUp className="h-4 w-4 shrink-0 text-sky-300" />
        Las conversiones y retiros se ejecutan en el módulo Economic Engine / BTF Token; aquí solo notificas al fan.
      </GlassCard>
    </div>
  );
}
