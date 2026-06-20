/**
 * EventVenue.tsx — Lugar / Mapa / Cómo llegar
 */
import { MapPin, Navigation, Car, ExternalLink } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface VenueData {
  address?: string;
  mapUrl?: string;
  parking?: string;
  howToGet?: string;
}

export function EventVenue({ event }: { event: EventPublicData }) {
  const venue = event.venue_json as VenueData | null;
  const address = venue?.address || event.event_location;
  if (!address) return null;

  return (
    <section className="py-16 px-4 max-w-3xl mx-auto">
      <EventSectionHeading
        eyebrow="El lugar"
        title="Cómo llegar"
        icon={<Navigation className="w-4 h-4" />}
        accentColor={event.accent_color}
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* address row */}
        <div className="flex items-center gap-4 p-6 border-b border-white/8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: event.accent_color + '20' }}>
            <MapPin className="w-6 h-6" style={{ color: event.accent_color }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{address}</p>
            {event.event_location && venue?.address && venue.address !== event.event_location && (
              <p className="text-sm text-white/45 mt-0.5">{event.event_location}</p>
            )}
          </div>
          {venue?.mapUrl && (
            <a href={venue.mapUrl} target="_blank" rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-white/5"
              style={{ borderColor: event.accent_color + '40', color: event.accent_color }}>
              <ExternalLink className="w-4 h-4" /> Ver mapa
            </a>
          )}
        </div>

        {/* details grid */}
        {(venue?.parking || venue?.howToGet) && (
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
            {venue.parking && (
              <div className="p-6">
                <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-widest mb-2">
                  <Car className="w-4 h-4" /> Estacionamiento
                </div>
                <p className="text-white/75 text-sm leading-relaxed">{venue.parking}</p>
              </div>
            )}
            {venue.howToGet && (
              <div className="p-6">
                <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-widest mb-2">
                  <Navigation className="w-4 h-4" /> Cómo llegar
                </div>
                <p className="text-white/75 text-sm leading-relaxed">{venue.howToGet}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
