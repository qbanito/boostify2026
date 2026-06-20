/**
 * EventDecorations.tsx — Animaciones decorativas
 * ──────────────────────────────────────────────
 * A fixed, full-page, pointer-events-none ornamental overlay that gently
 * decorates the whole experience. The host picks a style (petals, confetti,
 * sparkles, hearts, snow, bubbles) and a density. Purely cosmetic.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { EventPublicData } from '../../lib/event-api';

export interface DecorationConfig {
  style?: 'petals' | 'confetti' | 'sparkles' | 'hearts' | 'snow' | 'bubbles';
  density?: 'low' | 'medium' | 'high';
}

const GLYPHS: Record<NonNullable<DecorationConfig['style']>, string[]> = {
  petals: ['🌸', '🌺', '🏵️'],
  confetti: ['▪', '▫', '◆', '●'],
  sparkles: ['✦', '✧', '⋆', '✺'],
  hearts: ['❤', '♡', '💗'],
  snow: ['❄', '❅', '❆'],
  bubbles: ['○', '◌', '⚬'],
};

const DENSITY_COUNT: Record<NonNullable<DecorationConfig['density']>, number> = {
  low: 14,
  medium: 26,
  high: 42,
};

export function EventDecorations({ event }: { event: EventPublicData }) {
  const config = (event.decorations_json ?? {}) as DecorationConfig;
  const style = config.style ?? 'sparkles';
  const count = DENSITY_COUNT[config.density ?? 'medium'];
  const accent = event.accent_color || '#c9a84c';
  const glyphs = GLYPHS[style] ?? GLYPHS.sparkles;
  const colored = style === 'confetti' || style === 'sparkles' || style === 'bubbles';

  // Deterministic particle layout so it doesn't reshuffle on every render.
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        glyph: glyphs[i % glyphs.length],
        left: (i * 67) % 100,
        size: 12 + ((i * 7) % 22),
        duration: 7 + ((i * 5) % 10),
        delay: (i * 0.6) % 8,
        drift: ((i % 5) - 2) * 30,
        rotate: style === 'confetti' || style === 'petals',
      })),
    [count, glyphs, style],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className="absolute -top-10 select-none"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            color: colored ? accent : undefined,
            textShadow: colored ? `0 0 8px ${accent}66` : undefined,
          }}
          initial={{ y: '-10vh', opacity: 0, rotate: 0 }}
          animate={{
            y: '110vh',
            x: [0, p.drift, 0],
            opacity: [0, 0.85, 0.85, 0],
            rotate: p.rotate ? [0, 180, 360] : 0,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {p.glyph}
        </motion.span>
      ))}
    </div>
  );
}
