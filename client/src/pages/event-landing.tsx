/**
 * event-landing.tsx
 * ──────────────────
 * Standalone Cinematic Event Landing page.
 *
 * ISOLATION:
 *  - NO Boostify navigation, sidebar, or PageWrapper
 *  - NO Firebase/Clerk auth — uses isolated event guest JWT
 *  - Rendered at /event/:slug
 *
 * Modules rendered in the order defined by event.modules_config.
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'wouter';
import { useEventData } from '../hooks/useEventData';
import { useEventGuest } from '../hooks/useEventGuest';
import { CinematicInvitationLogin } from '../components/event-landing/CinematicInvitationLogin';
import { EventHeroCinematic } from '../components/event-landing/EventHeroCinematic';
import { EventCinematicScenes } from '../components/event-landing/EventCinematicScenes';
import { EventRSVPForm } from '../components/event-landing/EventRSVPForm';
import { EventPhotoBooth } from '../components/event-landing/EventPhotoBooth';
import { EventSoundtrack } from '../components/event-landing/EventSoundtrack';
import { EventCollaborativeGallery } from '../components/event-landing/EventCollaborativeGallery';
import { EventMemoryBook } from '../components/event-landing/EventMemoryBook';
import { EventStory } from '../components/event-landing/EventStory';
import { EventSchedule } from '../components/event-landing/EventSchedule';
import { EventDressCode } from '../components/event-landing/EventDressCode';
import { EventVenue } from '../components/event-landing/EventVenue';
import { EventVendors } from '../components/event-landing/EventVendors';
import { EventGiftRegistry } from '../components/event-landing/EventGiftRegistry';
import { EventMessages } from '../components/event-landing/EventMessages';
import { EventDecorations } from '../components/event-landing/EventDecorations';
import type { EventPublicData } from '../lib/event-api';

// Default order if modules_config is not set
const DEFAULT_ORDER = [
  'hero', 'rsvp', 'story', 'schedule', 'photo_booth',
  'soundtrack', 'dress_code', 'venue', 'gallery',
  'memory_book', 'vendors', 'gift_registry', 'messages', 'ai_scenes', 'after_movie',
];

// ─── Cinematic ambient background ─────────────────────────────────────────────
// Floating glow orbs + film grain + vignette, tinted with the event palette.
// Purely decorative and pointer-events-none so it never blocks interaction.
function CinematicBackground({ primaryColor, accentColor }: { primaryColor: string; accentColor: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* base radial wash */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 50% -10%, ${accentColor}1f 0%, transparent 45%), radial-gradient(100% 60% at 50% 110%, ${primaryColor} 0%, transparent 60%)`,
        }}
      />
      {/* slow floating glow orbs */}
      <motion.div
        className="absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accentColor}22, transparent 70%)` }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accentColor}18, transparent 70%)` }}
        animate={{ x: [0, -50, 0], y: [0, 60, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/4 w-[24rem] h-[24rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${accentColor}14, transparent 70%)` }}
        animate={{ x: [0, 30, 0], y: [0, -40, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* film grain */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 100% at 50% 50%, transparent 55%, ${primaryColor}cc 100%)` }}
      />
    </div>
  );
}

// ─── Scroll reveal wrapper ────────────────────────────────────────────────────
// Fades + lifts each module into view as the guest scrolls.
function RevealSection({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventLandingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? '';

  const { event, isLoading, error } = useEventData(slug);
  const guestHook = useEventGuest(slug);
  const { guest } = guestHook;

  const rsvpRef = useRef<HTMLDivElement>(null);
  const trailerRef = useRef<HTMLDivElement>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: '#0d0117' }}
      >
        <motion.div
          className="w-14 h-14 rounded-full border-2"
          style={{ borderColor: '#c9a84c transparent' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <motion.p
          className="text-xs uppercase tracking-[0.4em]"
          style={{ color: '#c9a84c', fontFamily: "'Cinzel', Georgia, serif" }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          Preparando la experiencia
        </motion.p>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (error || !event) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center flex-col gap-4 text-center p-8"
        style={{ background: '#0d0117', color: '#fff', fontFamily: "'Cinzel', Georgia, serif" }}
      >
        <p className="text-4xl">🎬</p>
        <h1 className="text-2xl font-bold" style={{ color: '#c9a84c' }}>
          Evento no encontrado
        </h1>
        <p className="text-sm opacity-60">
          Este enlace no existe o el evento ya terminó.
        </p>
      </div>
    );
  }

  const primaryColor = event.primary_color || '#1a0533';
  const accentColor = event.accent_color || '#c9a84c';

  // ── Guest login gate ─────────────────────────────────────────────────────
  if (!guest) {
    return <CinematicInvitationLogin event={event} guestHook={guestHook} />;
  }

  const moduleOrder: string[] = Array.isArray(event.modules_config)
    ? (event.modules_config as string[])
    : DEFAULT_ORDER;

  // ── Full experience ──────────────────────────────────────────────────────
  return (
    <div style={{ background: primaryColor, minHeight: '100vh', color: '#fff' }} className="relative">

      {/* Cinematic ambient background */}
      <CinematicBackground primaryColor={primaryColor} accentColor={accentColor} />

      {/* Decorative animations overlay (host-configured ornaments) */}
      {event.feature_decorations && <EventDecorations event={event} />}

      {/* Content above the ambient layer */}
      <div className="relative z-10">
        {/* Hero is always first */}
        <EventHeroCinematic
          event={event}
          guestName={guest.guestName}
          onScrollToRsvp={() => scrollTo(rsvpRef)}
          onScrollToTrailer={() => scrollTo(trailerRef)}
        />

        {/* Sections in configured order */}
        <div className="space-y-24 py-24 px-4">
          {moduleOrder.filter(m => m !== 'hero').map(modId => {
            const node = renderModule(modId, event, accentColor, rsvpRef, trailerRef);
            if (!node) return null;
            return <RevealSection key={modId}>{node}</RevealSection>;
          })}

          {/* Cinematic poster — striking movie-style feature */}
          {event.poster_url && (
            <RevealSection key="cinematic-poster">
              <CinematicPosterFeature url={event.poster_url} title={event.event_title} accentColor={accentColor} />
            </RevealSection>
          )}

          {/* Styled cinematic images with text overlays */}
          {Array.isArray(event.cinematic_posters_json) && event.cinematic_posters_json
            .filter(p => p?.imageUrl)
            .map((p, i) => (
              <RevealSection key={`cine-img-${i}`}>
                <CinematicImageBanner poster={p} accentColor={accentColor} />
              </RevealSection>
            ))}

          {/* Film book — cinematic photo album the parents can order */}
          {event.film_book_json && Array.isArray(event.film_book_json.images) && event.film_book_json.images.filter(Boolean).length > 0 && (
            <RevealSection key="film-book">
              <FilmBookFlip book={event.film_book_json} accentColor={accentColor} eventTitle={event.event_title} />
            </RevealSection>
          )}

          {/* Linked artist profile CTA (read-only integration, never breaks artist profile) */}
          {event.linked_artist_slug && (
            <RevealSection key="linked-artist">
              <div className="max-w-xl mx-auto text-center">
                <div className="w-16 h-px mx-auto mb-6"
                  style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }} />
                <p className="text-xs uppercase tracking-[0.35em] mb-3 opacity-60"
                  style={{ color: accentColor, fontFamily: "'Cinzel', Georgia, serif" }}>
                  Detrás de la experiencia
                </p>
                <a
                  href={`/artist/${event.linked_artist_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                  style={{ border: `1px solid ${accentColor}66`, color: accentColor }}
                >
                  Descubre al artista →
                </a>
              </div>
            </RevealSection>
          )}

          {/* Promote Boostify services — fixed module, always visible.
              Drives event guests to our cinematic video service. */}
          <RevealSection key="boostify-services">
            <BoostifyServicesCTA accentColor={accentColor} />
          </RevealSection>

          {/* Footer */}
          <motion.footer
            className="text-center pb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-24 h-px mx-auto mb-4"
              style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }} />
            <p className="text-xs uppercase tracking-[0.3em] opacity-40" style={{ color: accentColor, fontFamily: "'Cinzel', Georgia, serif" }}>
              Experiencia creada con Boostify
            </p>
            <button onClick={guestHook.logout}
              className="mt-4 text-xs opacity-30 hover:opacity-60 transition-opacity" style={{ color: '#fff' }}>
              Salir de la experiencia
            </button>
          </motion.footer>
        </div>
      </div>
    </div>
  );
}

// ─── Cinematic poster feature ────────────────────────────────────────────────
// A framed, movie-style poster shown as a striking visual feature.
function CinematicPosterFeature({ url, title, accentColor }: { url: string; title: string; accentColor: string }) {
  return (
    <div className="max-w-md mx-auto">
      <motion.div
        className="relative rounded-2xl overflow-hidden"
        style={{ boxShadow: `0 30px 80px -20px ${accentColor}55, 0 0 0 1px ${accentColor}33` }}
        initial={{ opacity: 0, y: 40, rotateX: 12 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.02, y: -6 }}
      >
        {/* Ken-burns slow zoom for a cinematic feel */}
        <motion.img
          src={url} alt={title}
          className="w-full h-auto object-cover"
          style={{ aspectRatio: '2 / 3' }}
          initial={{ scale: 1.08 }}
          animate={{ scale: [1.08, 1.16, 1.08] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: `inset 0 0 120px rgba(0,0,0,0.5)` }} />
        <div className="absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }} />
        {/* animated light sweep */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-y-12 -left-1/3 w-1/3 rotate-12"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}33, transparent)` }}
          animate={{ left: ['-33%', '140%'] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.5 }}
        />
      </motion.div>
    </div>
  );
}

// ─── Cinematic styled image with text overlay ────────────────────────────────
// Full-width banner image with optional title/subtitle overlay for styling.
function CinematicImageBanner({
  poster, accentColor,
}: {
  poster: { imageUrl: string; title?: string; subtitle?: string; align?: 'left' | 'center' | 'right'; height?: 'sm' | 'md' | 'lg' };
  accentColor: string;
}) {
  const heightClass = poster.height === 'sm' ? 'h-56 md:h-72'
    : poster.height === 'lg' ? 'h-[28rem] md:h-[36rem]'
    : 'h-72 md:h-96';
  const align = poster.align ?? 'center';
  const justify = align === 'left' ? 'justify-start text-left'
    : align === 'right' ? 'justify-end text-right'
    : 'justify-center text-center';
  const hasText = !!(poster.title || poster.subtitle);

  return (
    <div className="max-w-5xl mx-auto">
      <motion.div
        className={`relative w-full ${heightClass} rounded-2xl overflow-hidden`}
        style={{ boxShadow: `0 24px 60px -24px ${accentColor}44, 0 0 0 1px rgba(255,255,255,0.06)` }}
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Slow ken-burns pan/zoom */}
        <motion.img
          src={poster.imageUrl} alt={poster.title ?? ''}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.12 }}
          animate={{ scale: [1.12, 1.22, 1.12], x: ['0%', '-2%', '0%'] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        {hasText && (
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.35))' }} />
        )}
        {hasText && (
          <div className={`absolute inset-0 flex flex-col ${justify} items-stretch p-8 md:p-12`}>
            <motion.div
              className={align === 'center' ? 'mx-auto max-w-2xl' : 'max-w-xl'}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            >
              {poster.title && (
                <h3 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}>
                  {poster.title}
                </h3>
              )}
              {poster.subtitle && (
                <p className="mt-3 text-base md:text-lg text-white/80 drop-shadow"
                  style={{ color: accentColor }}>
                  {poster.subtitle}
                </p>
              )}
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Film book — animated cinematic photo album ──────────────────────────────
// An interactive flip-book of the event's photos that the parents can order
// later. If not available yet, shows an elegant "Coming soon" cover.
function FilmBookFlip({
  book, accentColor, eventTitle,
}: {
  book: { images: string[]; title?: string; subtitle?: string; available: boolean; price?: string; currency?: string; orderUrl?: string; comingSoonText?: string };
  accentColor: string;
  eventTitle: string;
}) {
  const pages = (book.images || []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);

  const total = pages.length;
  const go = (d: number) => {
    setDir(d);
    setPage(p => Math.min(Math.max(p + d, 0), total - 1));
  };

  const title = book.title || 'El Libro de la Película';
  const subtitle = book.subtitle || eventTitle;

  return (
    <div className="max-w-4xl mx-auto">
      <SectionTitle label="El Libro de la Película" accentColor={accentColor} />

      {/* Closed book cover with a creative open animation */}
      {!open ? (
        <div className="flex flex-col items-center gap-6">
          <motion.button
            onClick={() => setOpen(true)}
            className="relative group"
            style={{ perspective: 1400 }}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ scale: 1.03 }}
          >
            {/* Subtle floating */}
            <motion.div
              animate={{ y: [0, -10, 0], rotateZ: [0, 0.6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-[260px] h-[360px] md:w-[320px] md:h-[440px] rounded-r-xl rounded-l-md overflow-hidden"
              style={{
                boxShadow: `0 40px 90px -25px ${accentColor}66, 0 0 0 1px ${accentColor}33`,
                transformStyle: 'preserve-3d',
              }}
            >
              <img src={pages[0]} alt={title}
                className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0"
                style={{ background: 'linear-gradient(125deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.7))' }} />
              {/* spine */}
              <div className="absolute left-0 top-0 bottom-0 w-3"
                style={{ background: `linear-gradient(to right, rgba(0,0,0,0.6), transparent)` }} />
              {/* light sweep on hover */}
              <motion.div aria-hidden
                className="pointer-events-none absolute -inset-y-10 -left-1/3 w-1/3 rotate-12"
                style={{ background: `linear-gradient(to right, transparent, ${accentColor}44, transparent)` }}
                animate={{ left: ['-33%', '140%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
              />
              <div className="absolute inset-x-0 bottom-0 p-6 text-center">
                <h3 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg"
                  style={{ fontFamily: "'Cinzel', Georgia, serif" }}>{title}</h3>
                {subtitle && <p className="mt-1 text-sm text-white/75">{subtitle}</p>}
                <p className="mt-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em]"
                  style={{ color: accentColor }}>Abrir el libro →</p>
              </div>
            </motion.div>
          </motion.button>

          <FilmBookOrderBar book={book} accentColor={accentColor} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          {/* Open book viewer */}
          <div className="relative w-full max-w-2xl" style={{ perspective: 1600 }}>
            <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden bg-black/40"
              style={{ boxShadow: `0 30px 80px -25px ${accentColor}55, 0 0 0 1px rgba(255,255,255,0.06)` }}>
              <AnimatePresence custom={dir} mode="popLayout">
                <motion.img
                  key={page}
                  src={pages[page]}
                  alt={`Página ${page + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  custom={dir}
                  initial={{ rotateY: dir > 0 ? -95 : 95, opacity: 0, transformOrigin: dir > 0 ? 'left center' : 'right center' }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: dir > 0 ? 95 : -95, opacity: 0, transformOrigin: dir > 0 ? 'right center' : 'left center' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ backfaceVisibility: 'hidden' }}
                />
              </AnimatePresence>
              {/* page sheen */}
              <div className="pointer-events-none absolute inset-0"
                style={{ background: 'linear-gradient(105deg, rgba(255,255,255,0.06), transparent 40%, rgba(0,0,0,0.25))' }} />
            </div>

            {/* nav */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <button onClick={() => go(-1)} disabled={page === 0}
                className="px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-30 transition"
                style={{ border: `1px solid ${accentColor}55`, color: accentColor }}>← Anterior</button>
              <span className="text-xs text-white/50 font-mono">{page + 1} / {total}</span>
              <button onClick={() => go(1)} disabled={page === total - 1}
                className="px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-30 transition"
                style={{ border: `1px solid ${accentColor}55`, color: accentColor }}>Siguiente →</button>
            </div>

            <div className="mt-2 text-center">
              <button onClick={() => { setOpen(false); setPage(0); }}
                className="text-xs text-white/40 hover:text-white/70 transition">Cerrar libro</button>
            </div>
          </div>

          <FilmBookOrderBar book={book} accentColor={accentColor} />
        </div>
      )}
    </div>
  );
}

// Order / coming-soon call-to-action for the film book.
function FilmBookOrderBar({
  book, accentColor,
}: {
  book: { available: boolean; price?: string; currency?: string; orderUrl?: string; comingSoonText?: string };
  accentColor: string;
}) {
  if (book.available) {
    const priceLabel = book.price
      ? `${book.currency === 'USD' || !book.currency ? '$' : ''}${book.price}${book.currency && book.currency !== 'USD' ? ' ' + book.currency : ''}`
      : '';
    return (
      <div className="text-center">
        {priceLabel && (
          <p className="text-sm text-white/60 mb-3">Llévate el libro impreso del evento{priceLabel ? ` · ${priceLabel}` : ''}</p>
        )}
        <a
          href={book.orderUrl || '/video-concepts'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-bold transition-transform hover:scale-105"
          style={{ background: accentColor, color: '#0c0c14', boxShadow: `0 14px 36px -10px ${accentColor}aa` }}
        >
          Ordenar el libro →
        </a>
      </div>
    );
  }
  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold"
        style={{ border: `1px dashed ${accentColor}66`, color: accentColor, background: `${accentColor}10` }}>
        ⏳ {book.comingSoonText?.trim() || 'Próximamente disponible para ordenar'}
      </span>
    </div>
  );
}

// ─── Boostify services promo (fixed module) ──────────────────────────────────
// Premium call-to-action that promotes Boostify's cinematic video service to
// every guest who views an event. Always rendered, links to /video-concepts.
function BoostifyServicesCTA({ accentColor }: { accentColor: string }) {
  const features = [
    { icon: '🎬', label: 'Tráilers cinematográficos' },
    { icon: '✨', label: 'Invitaciones interactivas' },
    { icon: '🎟️', label: 'Landing pages para tu evento' },
  ];
  return (
    <div className="max-w-3xl mx-auto px-2">
      <motion.div
        className="relative overflow-hidden rounded-3xl p-[1px]"
        style={{ background: `linear-gradient(135deg, ${accentColor}66, transparent 40%, ${accentColor}33)` }}
        whileHover={{ scale: 1.012 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div
          className="relative rounded-3xl px-8 py-12 sm:px-12 sm:py-14 text-center backdrop-blur-xl"
          style={{ background: 'rgba(8, 2, 18, 0.72)' }}
        >
          {/* soft glow */}
          <div
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-3xl opacity-40"
            style={{ background: `radial-gradient(circle, ${accentColor}55, transparent 70%)` }}
            aria-hidden
          />

          <p
            className="relative text-[11px] uppercase tracking-[0.4em] mb-4 opacity-70"
            style={{ color: accentColor, fontFamily: "'Cinzel', Georgia, serif" }}
          >
            ¿Te gustó esta experiencia?
          </p>
          <h2
            className="relative text-2xl sm:text-4xl font-semibold mb-4 leading-tight"
            style={{ color: '#fff', fontFamily: "'Cinzel', Georgia, serif", textShadow: `0 0 40px ${accentColor}33` }}
          >
            Crea la tuya con Boostify
          </h2>
          <p className="relative text-sm sm:text-base opacity-70 max-w-xl mx-auto mb-8" style={{ color: '#fff' }}>
            Producimos invitaciones y experiencias cinematográficas para bodas, quinceañeras,
            premieres y eventos corporativos. Cuéntanos tu idea y la convertimos en una página
            de evento inolvidable.
          </p>

          {/* feature pills */}
          <div className="relative flex flex-wrap items-center justify-center gap-2.5 mb-9">
            {features.map(f => (
              <span
                key={f.label}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                style={{ border: `1px solid ${accentColor}33`, color: '#fff', background: `${accentColor}0d` }}
              >
                <span>{f.icon}</span>
                {f.label}
              </span>
            ))}
          </div>

          <a
            href="/video-concepts"
            target="_blank"
            rel="noopener noreferrer"
            className="relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold transition-transform hover:scale-105"
            style={{ background: accentColor, color: '#0d0117', boxShadow: `0 12px 40px ${accentColor}55` }}
          >
            Contactar a Boostify
            <span aria-hidden>→</span>
          </a>

          <p className="relative mt-5 text-[11px] uppercase tracking-[0.3em] opacity-35" style={{ color: '#fff' }}>
            boostify · cinematic event studio
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dynamic module renderer ──────────────────────────────────────────────────
function renderModule(
  modId: string,
  event: EventPublicData,
  accentColor: string,
  rsvpRef: React.RefObject<HTMLDivElement>,
  trailerRef: React.RefObject<HTMLDivElement>,
): React.ReactNode {
  switch (modId) {
    case 'rsvp':
      if (!event.feature_rsvp) return null;
      return (
        <div key="rsvp" ref={rsvpRef}>
          <EventRSVPForm event={event} />
        </div>
      );

    case 'story':
      if (!event.feature_story) return null;
      return <EventStory key="story" event={event} />;

    case 'schedule':
      if (!event.feature_schedule) return null;
      return <EventSchedule key="schedule" event={event} />;

    case 'photo_booth':
      if (!event.feature_photo_booth) return null;
      return <EventPhotoBooth key="photo_booth" event={event} />;

    case 'soundtrack':
      if (!event.feature_soundtrack) return null;
      return <EventSoundtrack key="soundtrack" event={event} />;

    case 'dress_code':
      if (!event.feature_dress_code) return null;
      return <EventDressCode key="dress_code" event={event} />;

    case 'venue':
      if (!event.feature_venue) return null;
      return <EventVenue key="venue" event={event} />;

    case 'gallery':
      if (!event.feature_gallery) return null;
      return <EventCollaborativeGallery key="gallery" event={event} />;

    case 'memory_book':
      if (!event.feature_memory_book) return null;
      return <EventMemoryBook key="memory_book" event={event} />;

    case 'vendors':
      if (!event.feature_vendors) return null;
      return <EventVendors key="vendors" event={event} />;

    case 'gift_registry':
      if (!event.feature_gift_registry) return null;
      return <EventGiftRegistry key="gift_registry" event={event} />;

    case 'messages':
      if (!event.feature_messages) return null;
      return <EventMessages key="messages" event={event} />;

    case 'ai_scenes':
      if (!event.feature_ai_scenes || !event.ai_scenes_json) return null;
      return <EventCinematicScenes key="ai_scenes" event={event} />;

    case 'after_movie':
      if (!event.feature_after_movie || !event.after_movie_url) return null;
      return (
        <div key="after_movie" className="max-w-3xl mx-auto" ref={trailerRef}>
          <SectionTitle label="After Movie" accentColor={accentColor} />
          <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', border: `1px solid ${accentColor}33` }}>
            <iframe src={toEmbedUrl(event.after_movie_url!)} title="After Movie"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
        </div>
      );

    case 'trailer':
      if (!event.trailer_url) return null;
      return (
        <div key="trailer" className="max-w-3xl mx-auto">
          <SectionTitle label="Tráiler Cinematográfico" accentColor={accentColor} />
          <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', border: `1px solid ${accentColor}33` }}>
            <iframe src={toEmbedUrl(event.trailer_url)} title="Event Trailer"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <div className="text-center mb-12">
      <div className="flex items-center justify-center gap-4 mb-4">
        <div className="h-px w-12 sm:w-20" style={{ background: `linear-gradient(to right, transparent, ${accentColor})` }} />
        <span className="text-base" style={{ color: accentColor }}>✦</span>
        <div className="h-px w-12 sm:w-20" style={{ background: `linear-gradient(to left, transparent, ${accentColor})` }} />
      </div>
      <h2
        className="text-2xl sm:text-3xl font-semibold tracking-[0.18em] uppercase"
        style={{ color: '#fff', fontFamily: "'Cinzel', Georgia, serif", textShadow: `0 0 30px ${accentColor}44` }}
      >
        {label}
      </h2>
    </div>
  );
}

/** Convert a YouTube watch URL to embed URL */
function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      return `https://player.vimeo.com/video${u.pathname}`;
    }
  } catch {
    // fall through
  }
  return url;
}
