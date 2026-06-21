import { Ticket, QrCode } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader, StatTile, ConciergeComposer } from './shared';

/**
 * Ticket Messenger — send tickets, reminders and VIP upgrades over Telegram.
 * Uses the message/media gateway with ticket-oriented templates.
 */
export function TicketMessenger({ center }: { center: TelegramCenter }) {
  const sold = center.analytics?.ticketsSold ?? 0;
  const template =
    '🎟️ ¡Tu entrada está lista! Toca el link para confirmar tu compra y recibir tu QR único de acceso: \nhttps://boostify.app/tickets/…\n\nNos vemos en el show 🔥';

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Ticket className="h-5 w-5" />}
        title="Ticket Messenger"
        subtitle="Envía tickets con QR único, recordatorios y upgrades VIP."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Tickets vendidos" value={sold} />
        <StatTile label="Ingresos Telegram" value={`$${(center.analytics?.revenue ?? 0).toFixed(0)}`} accent="amber" />
        <StatTile label="Fans activos" value={center.analytics?.activeFans ?? 0} accent="sky" />
      </div>
      <GlassCard className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
          <QrCode className="h-4 w-4 text-sky-300" /> Plantilla de ticket (edítala antes de enviar)
        </div>
        <ConciergeComposer center={center} placeholder="Mensaje del ticket…" defaultMessage={template} ctaLabel="Enviar ticket" />
      </GlassCard>
    </div>
  );
}
