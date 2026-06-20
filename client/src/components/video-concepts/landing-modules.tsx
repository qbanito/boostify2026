/**
 * Event-Landing Modules
 * ─────────────────────
 * Reusable, preset-driven sections that render on /video-concepts/project/:id
 * AFTER the deposit is confirmed. Each module is a small, isolated component
 * that consumes the project + masterJson and renders nothing if its data
 * isn't applicable. The parent (`LandingShell`) decides which modules to
 * render via `resolveLandingPreset(eventType, stylePreset).modules`.
 *
 * NOTE: Gallery and Store render preview shells today. They're wired so
 * that — when we abstract the artist-profile `ImageGalleryDisplay` and
 * `OfficialStoreSection` to accept `entityType: 'event-landing'` — we can
 * swap in the real components without touching this file's call sites.
 */

import { motion } from 'framer-motion';
import {
  CalendarDays, Clock3, Gift, Heart, ImageIcon, MapPin,
  MessageSquareHeart, Receipt, ShoppingBag, Star, Users,
} from 'lucide-react';
import type { LandingModuleId } from '../../config/event-landing-presets';

// ──────────────────────────────────────────────────────────────────────────
// Shared props
// ──────────────────────────────────────────────────────────────────────────

export interface LandingProject {
  id: number;
  clientName: string;
  eventType: string;
  eventDate?: string | null;
  eventLocation?: string | null;
  selectedPreset?: string | null;
}

export interface LandingModuleProps {
  project: LandingProject;
  lang: 'es' | 'en';
}

const t = (es: string, en: string, lang: 'es' | 'en') => (lang === 'es' ? es : en);

const card =
  'rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-9';

const ribbon =
  'inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.22em] text-amber-300 bg-amber-500/10 border border-amber-500/30 mb-4';

// ──────────────────────────────────────────────────────────────────────────
// Countdown
// ──────────────────────────────────────────────────────────────────────────

function CountdownModule({ project, lang }: LandingModuleProps) {
  if (!project.eventDate) return null;
  const target = new Date(project.eventDate).getTime();
  const ms = target - Date.now();
  if (Number.isNaN(target)) return null;

  const days = Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((ms / (1000 * 60 * 60)) % 24));
  const minutes = Math.max(0, Math.floor((ms / (1000 * 60)) % 60));

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <Clock3 className="w-3.5 h-3.5" /> {t('Cuenta regresiva', 'Countdown', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-6">
        {t('Faltan', 'Time until', lang)} {project.eventDate}
      </h2>
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        {[
          { label: t('Días', 'Days', lang), value: days },
          { label: t('Horas', 'Hours', lang), value: hours },
          { label: t('Minutos', 'Minutes', lang), value: minutes },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-black/40 p-5 text-center"
          >
            <div className="text-4xl md:text-5xl font-black text-amber-200 tabular-nums">
              {item.value}
            </div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/55 mt-2">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// RSVP — preview shell
// ──────────────────────────────────────────────────────────────────────────

function RsvpModule({ project, lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <Users className="w-3.5 h-3.5" /> RSVP
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('Confirma tu asistencia', 'Confirm your attendance', lang)}
      </h2>
      <p className="text-white/60 max-w-2xl leading-relaxed mb-6">
        {t(
          `Los invitados de ${project.clientName} podrán confirmar aquí. La integración con la app interactiva se activa cuando el equipo creativo apruebe el blueprint.`,
          `Guests of ${project.clientName} will RSVP here. Integration with the interactive app activates once the creative team approves the blueprint.`,
          lang,
        )}
      </p>
      <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
        <button
          disabled
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-5 py-3 font-bold disabled:cursor-not-allowed"
        >
          {t('Asistiré', 'Attending', lang)}
        </button>
        <button
          disabled
          className="rounded-xl border border-white/10 bg-white/[0.03] text-white/65 px-5 py-3 font-bold disabled:cursor-not-allowed"
        >
          {t('No podré', 'Cannot attend', lang)}
        </button>
      </div>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Gallery — preview shell (future: ImageGalleryDisplay with entityType)
// ──────────────────────────────────────────────────────────────────────────

function GalleryModule({ lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <ImageIcon className="w-3.5 h-3.5" /> {t('Galería', 'Gallery', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('Galería del evento', 'Event gallery', lang)}
      </h2>
      <p className="text-white/60 max-w-2xl leading-relaxed mb-6">
        {t(
          'Después del evento, las fotos y clips destacados se publican aquí. Compatible con descargas privadas para los invitados.',
          'After the event, photos and highlight clips publish here. Supports private guest downloads.',
          lang,
        )}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] flex items-center justify-center"
          >
            <ImageIcon className="w-6 h-6 text-white/20" />
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Guestbook — preview shell
// ──────────────────────────────────────────────────────────────────────────

function GuestbookModule({ lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <MessageSquareHeart className="w-3.5 h-3.5" />{' '}
        {t('Libro de invitados', 'Guest book', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('Mensajes para los protagonistas', 'Messages for the hosts', lang)}
      </h2>
      <p className="text-white/60 max-w-2xl leading-relaxed">
        {t(
          'Los invitados dejan dedicatorias en texto, audio o video. Las mejores se incluyen en el corte final.',
          'Guests leave dedications in text, audio or video. The best ones are included in the final cut.',
          lang,
        )}
      </p>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Schedule — pulled from masterJson chapters when available
// ──────────────────────────────────────────────────────────────────────────

function ScheduleModule({ project, lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <CalendarDays className="w-3.5 h-3.5" />{' '}
        {t('Agenda', 'Schedule', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-5">
        {t('Itinerario del día', 'Day itinerary', lang)}
      </h2>
      <div className="space-y-3 max-w-2xl">
        {[
          { time: '15:00', label: t('Llegada y bienvenida', 'Arrival & welcome', lang) },
          { time: '16:00', label: t('Ceremonia / acto principal', 'Ceremony / main act', lang) },
          { time: '18:00', label: t('Sesión fotográfica editorial', 'Editorial photo session', lang) },
          { time: '20:00', label: t('Cena y discursos', 'Dinner & speeches', lang) },
          { time: '22:00', label: t('Fiesta y captura cinematográfica', 'Party & cinematic capture', lang) },
        ].map((item) => (
          <div
            key={item.time}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
          >
            <div className="text-amber-300 font-mono text-sm w-14">{item.time}</div>
            <div className="text-white/75 text-sm">{item.label}</div>
          </div>
        ))}
      </div>
      {project.eventLocation && (
        <p className="mt-5 inline-flex items-center gap-2 text-white/55 text-sm">
          <MapPin className="w-4 h-4 text-amber-300" /> {project.eventLocation}
        </p>
      )}
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Store — preview shell (future: OfficialStoreSection with entityType)
// ──────────────────────────────────────────────────────────────────────────

function StoreModule({ lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <ShoppingBag className="w-3.5 h-3.5" />{' '}
        {t('Tienda del evento', 'Event store', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('Piezas coleccionables', 'Collectible pieces', lang)}
      </h2>
      <p className="text-white/60 max-w-2xl leading-relaxed mb-6">
        {t(
          'Tazas, libros foto, remeras y láminas con la dirección de arte del evento. Los invitados pueden comprar después de la ceremonia.',
          'Mugs, photo books, tees and prints in the event art direction. Guests can purchase after the ceremony.',
          lang,
        )}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { icon: Gift, label: t('Photo book', 'Photo book', lang) },
          { icon: Receipt, label: t('Lámina firmada', 'Signed print', lang) },
          { icon: Heart, label: t('Recuerdo familiar', 'Family memento', lang) },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/10 bg-black/30 p-4 flex items-center gap-3"
          >
            <item.icon className="w-5 h-5 text-amber-300" />
            <span className="text-white/75 text-sm font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Legacy timeline (for `legacy` event type)
// ──────────────────────────────────────────────────────────────────────────

function LegacyTimelineModule({ lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <Star className="w-3.5 h-3.5" />{' '}
        {t('Línea de tiempo', 'Timeline', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('Capítulos de la historia', 'Story chapters', lang)}
      </h2>
      <p className="text-white/60 max-w-2xl leading-relaxed">
        {t(
          'Décadas, lugares y personas que conforman el legado. La línea de tiempo se llena con material familiar curado por el director.',
          'Decades, places and people that shape the legacy. The timeline fills with family material curated by the director.',
          lang,
        )}
      </p>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sponsors (corporate / quince)
// ──────────────────────────────────────────────────────────────────────────

function SponsorsModule({ lang }: LandingModuleProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={card}
    >
      <span className={ribbon}>
        <Star className="w-3.5 h-3.5" />{' '}
        {t('Padrinos / Sponsors', 'Sponsors', lang)}
      </span>
      <h2 className="text-3xl md:text-4xl font-bold mb-3">
        {t('Reconocimientos', 'Acknowledgments', lang)}
      </h2>
      <p className="text-white/60 max-w-2xl leading-relaxed">
        {t(
          'Espacio cinematográfico para padrinos, marcas o patrocinadores que hicieron posible el evento.',
          'A cinematic space for sponsors and brands that made the event possible.',
          lang,
        )}
      </p>
    </motion.section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Registry (only the optional add-on modules; core ones live in the page)
// ──────────────────────────────────────────────────────────────────────────

export type LandingModuleComponent = (props: LandingModuleProps) => JSX.Element | null;

export const LANDING_MODULES: Partial<
  Record<LandingModuleId, LandingModuleComponent>
> = {
  countdown: CountdownModule,
  rsvp: RsvpModule,
  gallery: GalleryModule,
  guestbook: GuestbookModule,
  schedule: ScheduleModule,
  store: StoreModule,
  legacyTimeline: LegacyTimelineModule,
  sponsors: SponsorsModule,
};
