/**
 * EventSectionHeading.tsx
 * ────────────────────────
 * Shared cinematic section heading used across every landing module so the
 * whole experience shares one elegant, luxury typographic system (matching the
 * Cinzel serif hero). Renders an accent eyebrow with icon, a serif title, an
 * optional subtitle and an animated gradient divider.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  /** Small uppercase label above the title (e.g. "Historia"). */
  eyebrow: string;
  /** Main serif heading. */
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Lucide icon shown next to the eyebrow. */
  icon?: React.ReactNode;
  /** Event accent color (hex). */
  accentColor: string;
  className?: string;
}

export function EventSectionHeading({
  eyebrow,
  title,
  subtitle,
  icon,
  accentColor,
  className = '',
}: Props) {
  return (
    <div className={`text-center mb-10 ${className}`}>
      <motion.span
        className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em]"
        style={{ color: accentColor }}
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
      >
        {icon}
        {eyebrow}
      </motion.span>

      <motion.h2
        className="mt-3 text-3xl sm:text-4xl font-bold text-white leading-tight"
        style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6, delay: 0.05 }}
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          className="mt-3 text-sm text-white/50 max-w-md mx-auto leading-relaxed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.12 }}
        >
          {subtitle}
        </motion.p>
      )}

      {/* animated gradient divider */}
      <motion.div
        className="h-px mx-auto mt-6"
        style={{ background: `linear-gradient(to right, transparent, ${accentColor}, transparent)` }}
        initial={{ width: 0, opacity: 0 }}
        whileInView={{ width: '6rem', opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
