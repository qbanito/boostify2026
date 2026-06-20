/**
 * EventMemoryBook.tsx
 * ────────────────────
 * Guests leave text messages, audio notes, or digital signatures.
 */

import React, { useState, useEffect } from 'react';
import { BookHeart } from 'lucide-react';
import { EventPublicData, Memory, fetchMemories, submitMemory } from '../../lib/event-api';
import { getGuestSession } from '../../lib/event-guest-session';
import { EventSectionHeading } from './EventSectionHeading';

interface Props {
  event: EventPublicData;
}

type MemoryType = 'text' | 'signature';

export function EventMemoryBook({ event }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';

  const session = getGuestSession(event.slug);

  const config = (event.interactive_config as any)?.memory_book ?? {};
  const intro: string = config.intro || 'Deja un mensaje que perdure para siempre';
  const prompt: string = config.prompt || '';

  const [memories, setMemories] = useState<Memory[]>([]);
  const [tab, setTab] = useState<MemoryType>('text');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMemories, setLoadingMemories] = useState(true);

  const loadMemories = () => {
    setLoadingMemories(true);
    fetchMemories(event.slug)
      .then(setMemories)
      .catch(() => {})
      .finally(() => setLoadingMemories(false));
  };

  useEffect(() => {
    loadMemories();
  }, [event.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitMemory(event.slug, { type: tab, content: content.trim() });
      setContent('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      loadMemories();
    } catch (err: any) {
      setError(err.message ?? 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: `${primaryColor}dd`,
    border: `1px solid ${accentColor}33`,
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '640px',
    margin: '0 auto',
    fontFamily: 'sans-serif',
  };

  return (
    <div id="memory-book">
      <EventSectionHeading
        eyebrow="Recuerdos"
        title="Libro de Recuerdos"
        subtitle={intro}
        icon={<BookHeart size={14} />}
        accentColor={accentColor}
      />
      <section style={sectionStyle}>

      {prompt && (
        <p className="text-center text-sm italic mb-6" style={{ color: accentColor, fontFamily: 'Georgia, serif' }}>
          “{prompt}”
        </p>
      )}

      {/* Submit form (only for logged-in guests) */}
      {session && (
        <div className="mb-8">
          {/* Type tabs */}
          <div className="flex gap-2 mb-4">
            {(['text', 'signature'] as MemoryType[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-4 py-1 rounded-full text-xs font-medium transition-all"
                style={{
                  background: tab === t ? accentColor : 'rgba(255,255,255,0.07)',
                  color: tab === t ? primaryColor : '#fff',
                }}
              >
                {t === 'text' ? '✍️ Mensaje' : '🖊️ Firma'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === 'text' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escribe tu mensaje especial..."
                maxLength={1000}
                rows={4}
                required
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
              />
            )}
            {tab === 'signature' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tu firma en texto o un mensaje corto..."
                maxLength={200}
                rows={2}
                required
                className="w-full px-3 py-2 rounded-lg text-sm font-cursive italic resize-none"
                style={{
                  background: 'rgba(255,255,255,0.07)', color: '#fff',
                  border: `1px solid ${accentColor}44`,
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.1rem',
                }}
              />
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
            {submitted && (
              <p className="text-xs" style={{ color: accentColor }}>
                ¡Tu {tab === 'text' ? 'mensaje' : 'firma'} fue guardado! 💫
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="w-full py-2 rounded-lg text-sm font-semibold uppercase tracking-wider disabled:opacity-40"
              style={{ background: accentColor, color: primaryColor }}
            >
              {submitting ? 'Guardando...' : 'Dejar Recuerdo'}
            </button>
          </form>
        </div>
      )}

      {/* Memories list */}
      {loadingMemories ? (
        <div className="text-center py-8">
          <div className="w-6 h-6 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: `${accentColor} transparent` }} />
        </div>
      ) : memories.length === 0 ? (
        <p className="text-center text-sm py-6" style={{ color: '#ffffff44' }}>
          Sé el primero en dejar un recuerdo
        </p>
      ) : (
        <div className="space-y-4">
          {memories.map((m) => (
            <div
              key={m.id}
              className="p-4 rounded-xl relative"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${accentColor}22`,
              }}
            >
              {/* Quote mark decoration */}
              <div
                className="absolute top-3 left-3 text-3xl opacity-20 leading-none select-none"
                style={{ color: accentColor, fontFamily: 'Georgia' }}
              >
                "
              </div>
              <div className="pl-6">
                {m.memory_type === 'signature' ? (
                  <p
                    className="text-base italic"
                    style={{ color: '#fff', fontFamily: 'Georgia, serif', fontSize: '1.1rem' }}
                  >
                    {m.content}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed" style={{ color: '#ffffffcc' }}>
                    {m.content}
                  </p>
                )}
                <p className="text-xs mt-3" style={{ color: accentColor }}>
                  — {m.guest_name}
                  <span className="ml-2 opacity-50">
                    {new Date(m.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric', month: 'short',
                    })}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
