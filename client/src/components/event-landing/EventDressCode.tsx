/**
 * EventDressCode.tsx — Código de vestimenta
 */
import { Shirt } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface DressCodeData {
  note?: string;
  palette?: string[];
  forbid?: string;
}

export function EventDressCode({ event }: { event: EventPublicData }) {
  const dc = event.dress_code_json as DressCodeData | null;
  if (!dc?.note && !dc?.palette?.length) return null;

  return (
    <section className="py-16 px-4 max-w-2xl mx-auto">
      <EventSectionHeading
        eyebrow="Dress Code"
        title="Viste para la ocasión"
        icon={<Shirt className="w-4 h-4" />}
        accentColor={event.accent_color}
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center space-y-6">
        {dc.note && (
          <p className="text-white/80 text-lg leading-relaxed">{dc.note}</p>
        )}

        {dc.palette && dc.palette.length > 0 && (
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-4">Paleta de colores</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {dc.palette.map((color, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-14 h-14 rounded-full ring-2 ring-white/10 shadow-lg"
                    style={{ background: color }}
                  />
                  <span className="text-[10px] font-mono text-white/40">{color}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {dc.forbid && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-xs text-red-400/80">
              <span className="font-bold">Nota:</span> {dc.forbid}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
