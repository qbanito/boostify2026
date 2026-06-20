/**
 * EventGiftRegistry.tsx — Mesa de regalos
 */
import { Gift, ExternalLink } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface GiftItem { item: string; store?: string; url?: string }

export function EventGiftRegistry({ event }: { event: EventPublicData }) {
  const items = (Array.isArray(event.gift_registry_json) ? event.gift_registry_json : []) as GiftItem[];
  if (!items.length) return null;

  return (
    <section className="py-16 px-4 max-w-2xl mx-auto">
      <EventSectionHeading
        eyebrow="Regalos"
        title="Mesa de regalos"
        icon={<Gift className="w-4 h-4" />}
        accentColor={event.accent_color}
      />
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/8">
        {items.map((g, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <Gift className="w-4 h-4 shrink-0 opacity-40" style={{ color: event.accent_color }} />
              <div>
                <p className="font-medium text-white text-sm">{g.item}</p>
                {g.store && <p className="text-xs text-white/40">{g.store}</p>}
              </div>
            </div>
            {g.url && (
              <a href={g.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: event.accent_color }}>
                Ver <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
