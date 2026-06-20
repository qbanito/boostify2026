/**
 * EventMessages.tsx — Mensajes elegantes
 * ──────────────────────────────────────
 * Renders a list of styled text blocks the host writes for guests. Each block
 * picks one of several elegant typographic styles (quote, serif, script,
 * uppercase, gradient) so the page can carry beautiful, personal words.
 */

import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';

export interface MessageBlock {
  title?: string;
  body: string;
  style?: 'quote' | 'serif' | 'script' | 'uppercase' | 'gradient';
  align?: 'left' | 'center' | 'right';
}

export function EventMessages({ event }: { event: EventPublicData }) {
  const blocks = (Array.isArray(event.messages_json) ? event.messages_json : []) as MessageBlock[];
  const visible = blocks.filter((b) => b?.body?.trim());
  if (!visible.length) return null;

  const accent = event.accent_color || '#c9a84c';

  return (
    <section className="py-16 px-4 max-w-3xl mx-auto space-y-12">
      {visible.map((block, i) => {
        const align = block.align ?? 'center';
        const alignCls =
          align === 'left' ? 'text-left items-start' : align === 'right' ? 'text-right items-end' : 'text-center items-center';

        return (
          <motion.div
            key={i}
            className={`flex flex-col ${alignCls}`}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {block.title && (
              <span
                className="text-[11px] font-bold uppercase tracking-[0.35em] mb-4"
                style={{ color: accent }}
              >
                {block.title}
              </span>
            )}

            {renderBody(block, accent)}

            <motion.div
              className="h-px mt-7"
              style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)` }}
              initial={{ width: 0 }}
              whileInView={{ width: '5rem' }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
            />
          </motion.div>
        );
      })}
    </section>
  );
}

function renderBody(block: MessageBlock, accent: string) {
  const style = block.style ?? 'serif';
  const text = block.body;

  switch (style) {
    case 'quote':
      return (
        <div className="relative max-w-2xl">
          <Quote className="w-9 h-9 mb-3 opacity-30 mx-auto" style={{ color: accent }} />
          <p
            className="text-2xl sm:text-3xl leading-snug italic text-white/90"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            {text}
          </p>
        </div>
      );

    case 'script':
      return (
        <p
          className="text-3xl sm:text-4xl leading-relaxed"
          style={{ fontFamily: "'Pinyon Script', 'Brush Script MT', cursive", color: accent }}
        >
          {text}
        </p>
      );

    case 'uppercase':
      return (
        <p
          className="text-lg sm:text-xl font-semibold uppercase tracking-[0.25em] text-white/90 leading-relaxed max-w-2xl"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          {text}
        </p>
      );

    case 'gradient':
      return (
        <p
          className="text-2xl sm:text-4xl font-bold leading-tight max-w-2xl"
          style={{
            fontFamily: "'Cinzel', Georgia, serif",
            backgroundImage: `linear-gradient(120deg, #ffffff, ${accent})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {text}
        </p>
      );

    case 'serif':
    default:
      return (
        <p
          className="text-xl sm:text-2xl leading-relaxed text-white/85 max-w-2xl whitespace-pre-line"
          style={{ fontFamily: "'Cinzel', Georgia, serif" }}
        >
          {text}
        </p>
      );
  }
}
