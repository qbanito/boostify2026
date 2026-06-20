/**
 * EventHeroCinematic.tsx
 * ──────────────────────
 * Full-screen cinematic hero: video/image background with film treatment,
 * countdown in glass cards, glowing CTAs, ambient music toggle and an optional
 * full-screen intro playback ("Ver intro") for an unforgettable first impression.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EventPublicData } from '../../lib/event-api';

interface Props {
  event: EventPublicData;
  guestName: string;
  onScrollToRsvp?: () => void;
  onScrollToTrailer?: () => void;
}

function useCountdown(targetDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!targetDate) return;
    const target = new Date(targetDate).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return timeLeft;
}

export function EventHeroCinematic({ event, guestName, onScrollToRsvp, onScrollToTrailer }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';
  const countdown = useCountdown(event.event_date);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  const isEventPast = event.event_date ? new Date(event.event_date) < new Date() : false;
  const hasHeroVideo = event.hero_media_type === 'video' && !!event.hero_video_url;

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
    } else {
      audio.play().catch(() => {});
      setMusicPlaying(true);
    }
  };

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: primaryColor, fontFamily: "'Cinzel', 'Georgia', serif" }}
    >
      {/* ── Cinematic background (video > image), with a slow Ken-Burns drift ── */}
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.12 }}
        animate={{ scale: 1 }}
        transition={{ duration: 18, ease: 'easeOut' }}
        aria-hidden
      >
        {hasHeroVideo ? (
          <video
            src={event.hero_video_url!}
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        ) : event.hero_image_url ? (
          <img
            src={event.hero_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        ) : null}
      </motion.div>

      {/* ── Layered overlays: top/bottom gradient + radial vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, ${primaryColor}cc 0%, ${primaryColor}33 35%, ${primaryColor}aa 75%, ${primaryColor} 100%)`,
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, ${primaryColor}99 100%)`,
        }}
        aria-hidden
      />

      {/* ── Subtle film grain ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />

      {/* ── Floating shimmer particles ── */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${(i * 53) % 100}%`,
            top: `${(i * 37) % 100}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0], y: [-8, -28, -8] }}
          transition={{ duration: 4 + (i % 5), repeat: Infinity, delay: i * 0.4 }}
          aria-hidden
        />
      ))}

      {/* Background ambient music */}
      {event.background_music_url && (
        <audio ref={audioRef} src={event.background_music_url} loop preload="none" />
      )}

      {/* Content */}
      <motion.div
        className="relative z-10 text-center px-4 max-w-3xl w-full"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
        }}
      >
        {/* Welcome back */}
        {guestName && (
          <motion.p
            className="uppercase tracking-[0.4em] text-xs mb-4 font-light"
            style={{ color: accentColor }}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          >
            Bienvenida, {guestName}
          </motion.p>
        )}

        {/* Decorative line */}
        <motion.div
          className="h-px mx-auto mb-6"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
          variants={{ hidden: { width: 0, opacity: 0 }, show: { width: 96, opacity: 1 } }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        {/* Honoree name / event title */}
        {event.honoree_name && (
          <motion.h2
            className="text-lg font-light mb-1"
            style={{ color: '#ffffff99' }}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          >
            {event.event_type === 'quinceanera' ? 'Mis XV Años de' : 'Celebración de'}
          </motion.h2>
        )}
        <motion.h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight mb-4"
          style={{
            backgroundImage: `linear-gradient(180deg, #ffffff 0%, #ffffff 55%, ${accentColor} 130%)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: `0 0 60px ${accentColor}66`,
          }}
          variants={{ hidden: { opacity: 0, y: 24, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1 } }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {event.honoree_name || event.event_title}
        </motion.h1>

        {event.event_subtitle && (
          <motion.p
            className="text-base font-light mb-2"
            style={{ color: '#ffffffbb' }}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
          >
            {event.event_subtitle}
          </motion.p>
        )}

        {/* Date & Location */}
        {(event.event_date || event.event_location) && (
          <div className="flex flex-wrap justify-center gap-6 my-6 text-sm" style={{ color: '#ffffff99' }}>
            {event.event_date && (
              <span>
                📅{' '}
                {new Date(event.event_date).toLocaleDateString('es-ES', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            )}
            {event.event_location && <span>📍 {event.event_location}</span>}
          </div>
        )}

        {/* Countdown — glass cards */}
        {event.event_date && !isEventPast && (
          <div className="flex justify-center gap-3 sm:gap-5 my-8">
            {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit) => (
              <div
                key={unit}
                className="text-center rounded-2xl px-3 sm:px-5 py-3 backdrop-blur-md"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${accentColor}33`,
                  boxShadow: `inset 0 1px 0 ${accentColor}22, 0 8px 30px rgba(0,0,0,0.3)`,
                }}
              >
                <div
                  className="text-3xl sm:text-5xl font-bold tabular-nums"
                  style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}66` }}
                >
                  {String(countdown[unit]).padStart(2, '0')}
                </div>
                <div className="text-[10px] sm:text-xs uppercase tracking-widest mt-1" style={{ color: '#ffffff88' }}>
                  {unit === 'days' ? 'días' : unit === 'hours' ? 'horas' : unit === 'minutes' ? 'min' : 'seg'}
                </div>
              </div>
            ))}
          </div>
        )}

        {isEventPast && event.after_movie_url && (
          <div className="my-6">
            <p className="text-sm mb-3" style={{ color: '#ffffff88' }}>
              Revive este momento mágico
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          {hasHeroVideo && (
            <motion.button
              onClick={() => setIntroOpen(true)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-3 rounded-full font-semibold uppercase tracking-widest text-sm transition-all duration-300 flex items-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                color: primaryColor,
                boxShadow: `0 0 30px ${accentColor}66`,
              }}
            >
              ▶ Ver intro
            </motion.button>
          )}
          {event.feature_rsvp && !isEventPast && (
            <motion.button
              onClick={onScrollToRsvp}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-3 rounded-full font-semibold uppercase tracking-widest text-sm transition-all duration-300"
              style={{
                background: hasHeroVideo ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                color: hasHeroVideo ? '#fff' : primaryColor,
                border: hasHeroVideo ? `1px solid ${accentColor}66` : 'none',
                boxShadow: hasHeroVideo ? 'none' : `0 0 24px ${accentColor}55`,
              }}
            >
              Confirmar Asistencia
            </motion.button>
          )}
          {event.trailer_url && (
            <motion.button
              onClick={onScrollToTrailer}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-3 rounded-full font-semibold uppercase tracking-widest text-sm transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: `1px solid ${accentColor}66`,
              }}
            >
              ▶ Ver Tráiler
            </motion.button>
          )}
        </div>

        {/* Music toggle */}
        {event.background_music_url && (
          <button
            onClick={toggleMusic}
            className="mt-8 flex items-center gap-2 mx-auto text-xs uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: accentColor }}
          >
            {musicPlaying ? '⏸' : '▶'} Música de ambiente
          </button>
        )}
      </motion.div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div
          className="w-px h-12 animate-pulse"
          style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }}
        />
        <p className="text-xs uppercase tracking-widest" style={{ color: accentColor }}>
          Desplaza
        </p>
      </div>

      {/* ── Full-screen intro playback ── */}
      <AnimatePresence>
        {introOpen && hasHeroVideo && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIntroOpen(false)}
          >
            <motion.video
              src={event.hero_video_url!}
              autoPlay
              controls
              playsInline
              className="max-w-[94vw] max-h-[88vh] rounded-xl shadow-2xl"
              style={{ boxShadow: `0 0 80px ${accentColor}44` }}
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setIntroOpen(false)}
              className="absolute top-6 right-6 w-11 h-11 rounded-full flex items-center justify-center text-white text-xl transition-all hover:scale-110"
              style={{ background: 'rgba(255,255,255,0.1)', border: `1px solid ${accentColor}66` }}
              aria-label="Cerrar intro"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
