/**
 * EventCinematicScenes.tsx
 * ──────────────────────────
 * Displays AI-generated cinematic scenes from the event.
 */

import React from 'react';
import { Clapperboard } from 'lucide-react';
import { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface Scene {
  title: string;
  description: string;
  imageUrl?: string;
  mood?: string;
}

interface Props {
  event: EventPublicData;
}

export function EventCinematicScenes({ event }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';

  const scenes: Scene[] = Array.isArray(event.ai_scenes_json) ? event.ai_scenes_json : [];

  if (!scenes.length) return null;

  return (
    <section id="scenes" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <EventSectionHeading
        eyebrow="Escenas"
        title="Escenas del Evento"
        subtitle="La historia de esta noche"
        icon={<Clapperboard size={14} />}
        accentColor={accentColor}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenes.map((scene, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden group transition-all duration-300"
            style={{
              background: `${primaryColor}dd`,
              border: `1px solid ${accentColor}33`,
            }}
          >
            {/* Scene image */}
            <div
              className="relative overflow-hidden"
              style={{ aspectRatio: '16/9', background: `${primaryColor}88` }}
            >
              {scene.imageUrl ? (
                <img
                  src={scene.imageUrl}
                  alt={scene.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    const parent = el.parentElement;
                    if (parent && !parent.querySelector('[data-fallback]')) {
                      const ph = document.createElement('div');
                      ph.setAttribute('data-fallback', 'true');
                      ph.className = 'absolute inset-0 flex items-center justify-center text-4xl';
                      ph.textContent = '\uD83C\uDFAC';
                      parent.appendChild(ph);
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🎬</div>
              )}
              {/* Scene number */}
              <div
                className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: accentColor, color: primaryColor }}
              >
                {i + 1}
              </div>
              {/* Mood badge */}
              {scene.mood && (
                <div
                  className="absolute bottom-3 right-3 px-2 py-1 rounded-full text-xs"
                  style={{ background: 'rgba(0,0,0,0.7)', color: accentColor, border: `1px solid ${accentColor}44` }}
                >
                  {scene.mood}
                </div>
              )}
            </div>

            {/* Scene info */}
            <div className="p-4">
              <h3 className="font-semibold mb-1" style={{ color: '#fff' }}>
                {scene.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: '#ffffff77' }}>
                {scene.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
