import { CalendarCheck, Briefcase } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader, ConciergeComposer } from './shared';

/**
 * Booking Assistant — concierge flow for promoters: send press kit, price range,
 * check availability and create a lead. The AI agent auto-replies to inbound
 * "quiero contratar al artista" messages; here the artist can follow up manually.
 */
export function BookingAssistant({ center }: { center: TelegramCenter }) {
  const bookingLeads = center.commands.filter((c) => c.intent === 'booking');
  const template =
    '🎤 ¡Gracias por tu interés en contratar al artista!\n\n📎 Press kit: https://boostify.app/epk/…\n💸 Rango de precios: a convenir según fecha y aforo\n📅 ¿Para qué fecha y ciudad sería el evento?\n\nResponde y agendamos una llamada.';

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<CalendarCheck className="h-5 w-5" />}
        title="Booking Assistant"
        subtitle="Responde a promotores con press kit, precios y disponibilidad. Crea leads."
      />

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
          <Briefcase className="h-4 w-4 text-sky-300" /> Respuesta a promotor
        </div>
        <ConciergeComposer center={center} placeholder="Mensaje al promotor…" defaultMessage={template} ctaLabel="Responder al promotor" />
      </GlassCard>

      <GlassCard className="p-4">
        <h4 className="mb-3 text-sm font-semibold text-white/80">Leads de booking detectados</h4>
        {bookingLeads.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">Aún no hay solicitudes de contratación.</p>
        ) : (
          <div className="space-y-2">
            {bookingLeads.slice(0, 10).map((l) => (
              <div key={l.id} className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-sm text-white/80">{l.rawText}</p>
                {l.from && <p className="mt-1 text-xs text-white/40">De: {l.from}</p>}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
