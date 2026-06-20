/**
 * CinematicInvitationLogin.tsx
 * ────────────────────────────
 * The first screen guests see: a luxury "cinema door" experience.
 * No Boostify UI — completely standalone cinematic design.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { UseEventGuestReturn } from '../../hooks/useEventGuest';
import { EventPublicData } from '../../lib/event-api';

interface Props {
  event: EventPublicData;
  guestHook: UseEventGuestReturn;
}

export function CinematicInvitationLogin({ event, guestHook }: Props) {
  const { isLoading, error, requiresCode, login } = guestHook;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [entered, setEntered] = useState(false);

  const primaryColor = event.primary_color || '#1a0533';
  const accentColor = event.accent_color || '#c9a84c';

  const hasHeroVideo = event.hero_media_type === 'video' && !!event.hero_video_url;
  const heroImage = event.hero_image_url || null;

  // Deterministic, memoized particle layout (avoids re-randomizing every render).
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, i) => ({
        id: i,
        size: ((i * 13) % 3) + 1,
        top: (i * 37) % 100,
        left: (i * 53) % 100,
        delay: ((i * 7) % 40) / 10,
        duration: ((i * 11) % 30) / 10 + 2,
      })),
    []
  );

  useEffect(() => {
    if (requiresCode) setShowCode(true);
  }, [requiresCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setEntered(true);
    await login(name.trim(), showCode ? code : undefined);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: primaryColor, fontFamily: "'Cinzel', 'Georgia', serif" }}
    >
      {/* Hero background (blurred, immersive) */}
      {hasHeroVideo ? (
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-35"
          style={{ filter: 'blur(8px) saturate(1.1)' }}
          src={event.hero_video_url!}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
        />
      ) : heroImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${heroImage})`, filter: 'blur(8px) saturate(1.1)' }}
          aria-hidden
        />
      ) : null}

      {/* Ambient stars / particles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full opacity-30 animate-pulse"
            style={{
              width: p.size + 'px',
              height: p.size + 'px',
              background: accentColor,
              top: p.top + '%',
              left: p.left + '%',
              animationDelay: p.delay + 's',
              animationDuration: p.duration + 's',
            }}
          />
        ))}
      </div>

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, ${primaryColor}cc 100%)`,
        }}
        aria-hidden
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl text-center"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${accentColor}44`,
          boxShadow: `0 0 60px ${accentColor}22`,
        }}
      >
        {/* Decorative top line */}
        <div
          className="w-16 h-px mx-auto mb-6"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
        />

        {/* Event type badge */}
        <p
          className="uppercase tracking-[0.3em] text-xs mb-3 font-light"
          style={{ color: accentColor }}
        >
          {event.event_type === 'quinceanera'
            ? 'Quinceañera'
            : event.event_type === 'wedding'
            ? 'Boda'
            : event.event_type === 'premiere'
            ? 'Premiere'
            : 'Evento Especial'}
        </p>

        {/* Main title */}
        <h1
          className="text-3xl sm:text-4xl font-bold mb-2"
          style={{ color: '#fff', textShadow: `0 0 30px ${accentColor}88` }}
        >
          {event.event_title}
        </h1>

        {event.event_subtitle && (
          <p className="text-sm mb-6 font-light" style={{ color: '#ffffff88' }}>
            {event.event_subtitle}
          </p>
        )}

        {/* Decorative divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: `${accentColor}44` }} />
          <div
            className="w-2 h-2 rotate-45"
            style={{ background: accentColor }}
          />
          <div className="flex-1 h-px" style={{ background: `${accentColor}44` }} />
        </div>

        <p className="text-sm mb-6 font-light" style={{ color: '#ffffff99' }}>
          {event.access_mode === 'open'
            ? 'Ingresa tu nombre para acceder a esta experiencia'
            : 'Ingresa tu nombre y código de acceso'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Tu nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            disabled={isLoading}
            className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all placeholder-white/30"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: `1px solid ${accentColor}66`,
              color: '#fff',
            } as React.CSSProperties}
          />

          {(showCode || event.access_mode === 'code') && (
            <input
              type="password"
              placeholder="Código de acceso"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={50}
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all placeholder-white/30"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${accentColor}66`,
                color: '#fff',
              } as React.CSSProperties}
            />
          )}

          {error && (
            <p className="text-xs py-2" style={{ color: '#ff6b6b' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full py-3 rounded-lg font-semibold uppercase tracking-widest text-sm transition-all duration-300 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
              color: primaryColor,
              boxShadow: isLoading ? 'none' : `0 0 20px ${accentColor}55`,
            }}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Decorative bottom line */}
        <div
          className="w-16 h-px mx-auto mt-8"
          style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
        />
      </div>
    </div>
  );
}
