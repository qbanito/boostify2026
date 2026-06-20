/**
 * EventRSVPForm.tsx
 * ──────────────────
 * Multi-step RSVP confirmation with QR code display.
 */

import React, { useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { EventPublicData } from '../../lib/event-api';
import { submitRsvp, RsvpResult } from '../../lib/event-api';
import { getGuestSession } from '../../lib/event-guest-session';
import { EventSectionHeading } from './EventSectionHeading';

interface Props {
  event: EventPublicData;
}

type Step = 'form' | 'confirmed';

export function EventRSVPForm({ event }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';

  const session = getGuestSession(event.slug);
  const guestName = session?.guestName ?? 'Invitado';

  const [step, setStep] = useState<Step>('form');
  const [guestCount, setGuestCount] = useState(1);
  const [mealPreference, setMealPreference] = useState<string>('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [attending, setAttending] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RsvpResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await submitRsvp(event.slug, {
        guestCount: attending ? guestCount : 0,
        mealPreference: attending ? (mealPreference as any || undefined) : undefined,
        message: message || undefined,
        attending,
        email: email || undefined,
      });
      setResult(res);
      setStep('confirmed');
    } catch (err: any) {
      setError(err.message ?? 'Error al confirmar');
    } finally {
      setIsLoading(false);
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: `${primaryColor}dd`,
    border: `1px solid ${accentColor}33`,
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '560px',
    margin: '0 auto',
    fontFamily: "'Cinzel', 'Georgia', serif",
  };

  if (step === 'confirmed' && result) {
    return (
      <div id="rsvp">
        <EventSectionHeading
          eyebrow="RSVP"
          title="Confirma tu Asistencia"
          icon={<CalendarCheck size={14} />}
          accentColor={accentColor}
        />
        <section style={sectionStyle}>
        <div className="text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl"
            style={{ background: `${accentColor}22`, border: `2px solid ${accentColor}` }}
          >
            ✓
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: accentColor, fontFamily: "'Cinzel', Georgia, serif" }}>
            ¡Confirmado!
          </h2>
          <p className="text-sm mb-6" style={{ color: '#ffffff88' }}>
            {guestName}, tu asistencia ha sido confirmada.
          </p>

          {result.qrData && (
            <div
              className="p-4 rounded-lg mb-4 text-xs break-all"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#ffffff66' }}
            >
              <p className="mb-2" style={{ color: accentColor }}>
                Código de entrada
              </p>
              <p>{result.qrData}</p>
              <p className="mt-2 text-xs opacity-60">
                Guarda este código o muestra esta pantalla en la entrada
              </p>
            </div>
          )}
        </div>
        </section>
      </div>
    );
  }

  return (
    <div id="rsvp">
      <EventSectionHeading
        eyebrow="RSVP"
        title="Confirma tu Asistencia"
        subtitle={`${guestName}, cuéntanos si estarás presente`}
        icon={<CalendarCheck size={14} />}
        accentColor={accentColor}
      />
      <section style={sectionStyle}>
      <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: 'sans-serif' }}>
        {/* Attending toggle */}
        <div className="flex gap-3">
          {[true, false].map((val) => (
            <button
              key={String(val)}
              type="button"
              onClick={() => setAttending(val)}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: attending === val ? accentColor : 'rgba(255,255,255,0.07)',
                color: attending === val ? primaryColor : '#fff',
                border: `1px solid ${attending === val ? accentColor : accentColor + '33'}`,
              }}
            >
              {val ? '✓ Asistiré' : '✗ No podré asistir'}
            </button>
          ))}
        </div>

        {attending && (
          <>
            {/* Guest count */}
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: accentColor }}>
                ¿Cuántos asistirán?
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                  className="w-10 h-10 rounded-full text-lg"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: `1px solid ${accentColor}44` }}
                >
                  −
                </button>
                <span className="text-2xl font-bold w-8 text-center" style={{ color: '#fff' }}>
                  {guestCount}
                </span>
                <button
                  type="button"
                  onClick={() => setGuestCount(Math.min(20, guestCount + 1))}
                  className="w-10 h-10 rounded-full text-lg"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: `1px solid ${accentColor}44` }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Meal preference */}
            <div>
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: accentColor }}>
                Preferencia alimentaria (opcional)
              </label>
              <select
                value={mealPreference}
                onChange={(e) => setMealPreference(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
              >
                <option value="">Sin preferencia</option>
                <option value="meat">Carne</option>
                <option value="fish">Pescado</option>
                <option value="vegetarian">Vegetariano</option>
                <option value="vegan">Vegano</option>
              </select>
            </div>
          </>
        )}

        {/* Email */}
        <div>
          <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: accentColor }}>
            Email (para enviar tu invitación digital)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
          />
        </div>

        {/* Personal message */}
        <div>
          <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: accentColor }}>
            Mensaje para {event.honoree_name || 'la festejada'} (opcional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Tu mensaje especial..."
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: `1px solid ${accentColor}44` }}
          />
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg font-semibold uppercase tracking-widest text-sm transition-all disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
            color: primaryColor,
          }}
        >
          {isLoading ? 'Confirmando...' : 'Confirmar'}
        </button>
      </form>
      </section>
    </div>
  );
}
