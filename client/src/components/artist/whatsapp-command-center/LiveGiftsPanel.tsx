import { Gift, Crown, Trophy } from 'lucide-react';
import type { WhatsAppCenter } from '../../../hooks/use-whatsapp-center';
import { GlassCard, PanelHeader, ConciergeComposer } from './shared';

/**
 * Live Gifts Engine — during a live, surface top supporters (ranked by spend),
 * thank fans and confirm tips/gifts paid in BTF or internal credits.
 */
export function LiveGiftsPanel({ center }: { center: WhatsAppCenter }) {
  const ranking = [...center.contacts]
    .filter((c) => (c.totalSpent || 0) > 0)
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    .slice(0, 10);

  const template = '🎁 ¡Gracias por tu regalo en el live! Eres parte del Top de fans. 🙌 Te llegará una recompensa exclusiva muy pronto.';

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Gift className="h-5 w-5" />}
        title="Live Gifts"
        subtitle="Procesa regalos y propinas durante el live; agradece a tus top fans."
      />

      <GlassCard className="p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
          <Trophy className="h-4 w-4 text-amber-300" /> Ranking de fans
        </h4>
        {ranking.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">Aún no hay regalos registrados.</p>
        ) : (
          <div className="space-y-1.5">
            {ranking.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-white">
                  <span className={`w-5 text-center font-bold ${i === 0 ? 'text-amber-300' : 'text-white/40'}`}>{i + 1}</span>
                  {i === 0 && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                  {c.name}
                </span>
                <span className="text-sm font-semibold text-emerald-300">${(c.totalSpent || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-3 text-sm text-white/70">Agradece a un fan</div>
        <ConciergeComposer center={center} placeholder="Mensaje de agradecimiento…" defaultMessage={template} ctaLabel="Agradecer regalo" />
      </GlassCard>
    </div>
  );
}
