/**
 * EventSoundtrack.tsx
 * ────────────────────
 * Playlist display + song dedication form.
 */

import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import { EventPublicData, Dedication, fetchDedications, submitDedication } from '../../lib/event-api';
import { getGuestSession } from '../../lib/event-guest-session';
import { EventSectionHeading } from './EventSectionHeading';

interface Props {
  event: EventPublicData;
}

export function EventSoundtrack({ event }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';

  const config = (event.interactive_config as any)?.soundtrack ?? {};
  const intro: string = config.intro || 'Dedica una canción especial';
  const suggested: Array<{ title: string; artist: string }> = Array.isArray(config.playlist) ? config.playlist : [];

  const [dedications, setDedications] = useState<Dedication[]>([]);
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = getGuestSession(event.slug);

  useEffect(() => {
    fetchDedications(event.slug)
      .then(setDedications)
      .catch(() => {});
  }, [event.slug, submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songTitle.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitDedication(event.slug, {
        songTitle: songTitle.trim(),
        artistName: artistName.trim() || undefined,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
      setSongTitle('');
      setArtistName('');
      setMessage('');
      setTimeout(() => setSubmitted(false), 4000);
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
    <div id="soundtrack">
      <EventSectionHeading
        eyebrow="Soundtrack"
        title="Soundtrack del Evento"
        subtitle={intro}
        icon={<Music size={14} />}
        accentColor={accentColor}
      />
      <section style={sectionStyle}>

      {/* Suggested playlist from the host */}
      {suggested.length > 0 && (
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: accentColor }}>
            Playlist sugerida
          </p>
          <div className="space-y-2">
            {suggested.map((s, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm" style={{ background: `${accentColor}22` }}>
                  🎶
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#fff' }}>{s.title}</p>
                  {s.artist && <p className="text-xs truncate" style={{ color: '#ffffff77' }}>{s.artist}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dedication form */}
      {session && (
        <form onSubmit={handleSubmit} className="space-y-3 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombre de la canción *"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              maxLength={200}
              required
              className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
            />
            <input
              type="text"
              placeholder="Artista (opcional)"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              maxLength={200}
              className="col-span-2 sm:col-span-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
            />
          </div>
          <textarea
            placeholder="Tu dedicatoria (opcional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={300}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}
          {submitted && <p className="text-xs" style={{ color: accentColor }}>¡Dedicatoria enviada! 🎵</p>}

          <button
            type="submit"
            disabled={submitting || !songTitle.trim()}
            className="w-full py-2 rounded-lg text-sm font-semibold uppercase tracking-wider disabled:opacity-40"
            style={{ background: accentColor, color: primaryColor }}
          >
            {submitting ? 'Enviando...' : '🎵 Dedicar canción'}
          </button>
        </form>
      )}

      {/* Dedications list */}
      {dedications.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-widest mb-4" style={{ color: accentColor }}>
            Dedicatorias ({dedications.length})
          </p>
          {dedications.map((d) => (
            <div
              key={d.id}
              className="flex gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
                style={{ background: `${accentColor}22` }}
              >
                🎵
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#fff' }}>
                  {d.song_title}
                  {d.artist_name && (
                    <span style={{ color: '#ffffff88' }}> · {d.artist_name}</span>
                  )}
                </p>
                {d.dedication_message && (
                  <p className="text-xs mt-1" style={{ color: '#ffffff66' }}>
                    "{d.dedication_message}"
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: accentColor }}>
                  — {d.guest_name}
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
