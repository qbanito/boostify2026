/**
 * EventVendors.tsx — Proveedores / Créditos del evento
 */
import { Mic2, Instagram } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface Vendor { role: string; name: string; instagram?: string }

export function EventVendors({ event }: { event: EventPublicData }) {
  const vendors = (Array.isArray(event.vendors_json) ? event.vendors_json : []) as Vendor[];
  if (!vendors.length) return null;

  return (
    <section className="py-16 px-4 max-w-3xl mx-auto">
      <EventSectionHeading
        eyebrow="El equipo"
        title="Créditos del evento"
        icon={<Mic2 className="w-4 h-4" />}
        accentColor={event.accent_color}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {vendors.map((v, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">{v.role}</p>
            <p className="font-semibold text-white text-sm">{v.name}</p>
            {v.instagram && (
              <a href={`https://instagram.com/${v.instagram.replace('@', '')}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] mt-1.5 transition-opacity hover:opacity-80"
                style={{ color: event.accent_color }}>
                <Instagram className="w-3 h-3" />
                {v.instagram.startsWith('@') ? v.instagram : `@${v.instagram}`}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
