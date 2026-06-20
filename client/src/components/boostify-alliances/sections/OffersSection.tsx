import { Handshake, Loader2, DollarSign } from 'lucide-react';
import { TOKENS } from '../../artist-acquisition/shared/tokens';
import { SectionCard } from '../../artist-acquisition/shared/SectionCard';
import { useOffers } from '../hooks/useAlliancesApi';

interface OffersSectionProps {
  onSelect: (id: number) => void;
  selectedContactId: number | null;
}

export function OffersSection({ onSelect, selectedContactId }: OffersSectionProps) {
  const { data, isLoading } = useOffers();
  const offers: Array<{
    id: number; name: string; initials: string; gradient: [string, string];
    imageUrl?: string | null; location: string; label: string; potential: number;
    status: string; offerType: string; offerTitle: string; offerValue?: string | number | null;
  }> = data?.offers || [];

  return (
    <SectionCard
      title="PARTNERSHIP OFFERS"
      action={
        <span className="text-[11.5px]" style={{ color: TOKENS.MUTED }}>
          {offers.length} opportunities
        </span>
      }
      bodyClassName="p-0"
    >
      {isLoading && offers.length === 0 ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" style={{ color: TOKENS.MUTED }} />
        </div>
      ) : offers.length === 0 ? (
        <div className="p-8 text-center text-[12px]" style={{ color: TOKENS.MUTED }}>
          No offers yet. Enrich contacts or run AI scoring to populate opportunities.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: TOKENS.BORDER_SOFT }}>
          {offers.map((o) => {
            const isSelected = o.id === selectedContactId;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelect(o.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                data-testid={`alliances-offer-${o.id}`}
                style={{
                  borderBottom: `1px solid ${TOKENS.BORDER_SOFT}`,
                  background: isSelected ? 'rgba(255,122,0,0.08)' : 'transparent',
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0 overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${o.gradient[0]}, ${o.gradient[1]})`,
                    color: 'rgba(255,255,255,0.95)',
                    border: `1px solid ${isSelected ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                  }}
                >
                  {o.imageUrl ? (
                    <img src={o.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    o.initials
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
                      {o.name}
                    </span>
                    <span
                      className="text-[9.5px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
                      style={{
                        background: TOKENS.ORANGE_SOFT,
                        color: TOKENS.ORANGE_GLOW,
                        border: `1px solid ${TOKENS.ORANGE_RING}`,
                      }}
                    >
                      {o.offerType}
                    </span>
                  </div>
                  <div className="text-[11.5px] truncate mt-0.5" style={{ color: TOKENS.TEXT }}>
                    {o.offerTitle}
                  </div>
                  <div className="text-[10.5px] truncate" style={{ color: TOKENS.MUTED }}>
                    {o.label} · {o.location} · status: {o.status}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {o.offerValue && (
                    <div className="flex items-center gap-1 justify-end text-[11px]" style={{ color: TOKENS.POSITIVE }}>
                      <DollarSign size={10} />
                      {String(o.offerValue)}
                    </div>
                  )}
                  <div className="text-[9.5px] font-semibold tracking-widest mt-0.5" style={{ color: TOKENS.MUTED_2 }}>
                    POTENTIAL
                  </div>
                  <div
                    className="text-[22px] font-black leading-none mt-0.5 flex items-center gap-1 justify-end"
                    style={{ color: TOKENS.ORANGE_GLOW, textShadow: '0 0 10px rgba(255,138,31,0.4)' }}
                  >
                    <Handshake size={14} />
                    {o.potential}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
