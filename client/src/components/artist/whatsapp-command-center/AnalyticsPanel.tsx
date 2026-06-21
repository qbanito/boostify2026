import { BarChart3, TrendingUp } from 'lucide-react';
import type { WhatsAppCenter } from '../../../hooks/use-whatsapp-center';
import { GlassCard, PanelHeader, StatTile } from './shared';

const INTENT_LABEL: Record<string, string> = {
  create_campaign: 'Campañas', sell_tickets: 'Tickets', message_fans: 'Mensaje a fans',
  design_cover: 'Portadas', create_video: 'Videos', create_song: 'Canciones',
  check_revenue: 'Ingresos', show_merch: 'Merch', booking: 'Booking', wallet_balance: 'Wallet',
  greeting: 'Saludos', opt_out: 'Opt-out', unknown: 'Otros',
};

/** Analytics — operational KPIs for the WhatsApp channel. */
export function AnalyticsPanel({ center }: { center: WhatsAppCenter }) {
  const a = center.analytics;
  const maxCmd = Math.max(1, ...(a?.topCommands || []).map((c) => c.count));

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<BarChart3 className="h-5 w-5" />}
        title="Analytics"
        subtitle="Mensajes, fans activos, conversión e ingresos generados por WhatsApp."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Mensajes enviados" value={a?.messagesSent ?? 0} />
        <StatTile label="Respondidos" value={a?.messagesResponded ?? 0} accent="sky" />
        <StatTile label="Fans activos" value={a?.activeFans ?? 0} accent="violet" />
        <StatTile label="Conversión" value={`${a?.conversionRate ?? 0}%`} accent="amber" />
        <StatTile label="Ingresos" value={`$${(a?.revenue ?? 0).toFixed(0)}`} accent="emerald" />
        <StatTile label="Tickets" value={a?.ticketsSold ?? 0} accent="rose" />
        <StatTile label="Merch" value={a?.merchSold ?? 0} accent="sky" />
        <StatTile label="Campañas" value={a?.campaignsCount ?? 0} accent="violet" />
      </div>

      <GlassCard className="p-4">
        <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80">
          <TrendingUp className="h-4 w-4 text-emerald-300" /> Comandos más usados
        </h4>
        {(!a?.topCommands || a.topCommands.length === 0) ? (
          <p className="py-4 text-center text-sm text-white/40">Sin datos de comandos todavía.</p>
        ) : (
          <div className="space-y-2.5">
            {a.topCommands.map((c) => (
              <div key={c.intent}>
                <div className="mb-1 flex items-center justify-between text-xs text-white/60">
                  <span>{INTENT_LABEL[c.intent] || c.intent}</span>
                  <span>{c.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-400"
                    style={{ width: `${(c.count / maxCmd) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
