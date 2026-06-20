/**
 * EventCollaborativeGallery.tsx
 * ──────────────────────────────
 * Masonry-style gallery: displays approved uploads from all guests.
 */

import React, { useState, useEffect } from 'react';
import { Images } from 'lucide-react';
import { EventPublicData, GalleryItem, fetchGallery } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface Props {
  event: EventPublicData;
}

export function EventCollaborativeGallery({ event }: Props) {
  const accentColor = event.accent_color || '#c9a84c';
  const primaryColor = event.primary_color || '#1a0533';

  const galleryIntro: string = (event.interactive_config as any)?.gallery?.intro || '';

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  useEffect(() => {
    fetchGallery(event.slug)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [event.slug]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto" style={{ borderColor: `${accentColor} transparent` }} />
      </div>
    );
  }

  if (!items.length) {
    return (
      <section className="text-center py-12">
        <p className="text-sm" style={{ color: '#ffffff55' }}>
          Aún no hay fotos. ¡Sé el primero en compartir un recuerdo!
        </p>
      </section>
    );
  }

  return (
    <section id="gallery" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <EventSectionHeading
        eyebrow="Galería"
        title="Galería de Recuerdos"
        subtitle={galleryIntro || `${items.length} momentos compartidos`}
        icon={<Images size={14} />}
        accentColor={accentColor}
      />

      {/* Masonry grid */}
      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="break-inside-avoid relative group cursor-pointer rounded-lg overflow-hidden"
            style={{ border: `1px solid ${accentColor}22` }}
            onClick={() => setLightbox(item)}
          >
            <img
              src={item.thumbnail_url || item.media_url}
              alt={item.caption || ''}
              className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
                const parent = el.parentElement;
                if (parent && !parent.querySelector('[data-fallback]')) {
                  const ph = document.createElement('div');
                  ph.setAttribute('data-fallback', 'true');
                  ph.className = 'w-full flex items-center justify-center text-2xl';
                  ph.style.aspectRatio = '1';
                  ph.style.background = `${primaryColor}aa`;
                  ph.textContent = '\uD83D\uDDBC\uFE0F';
                  parent.appendChild(ph);
                }
              }}
            />
            {item.is_featured && (
              <div
                className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                style={{ background: accentColor, color: primaryColor }}
              >
                ★
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
              {item.caption && (
                <p className="text-xs text-white truncate">{item.caption}</p>
              )}
              <p className="text-xs" style={{ color: accentColor }}>
                {item.guest_name}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
          <img
            src={lightbox.media_url}
            alt={lightbox.caption || ''}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {(lightbox.caption || lightbox.guest_name) && (
            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center px-6 py-3 rounded-xl"
              style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {lightbox.caption && <p className="text-sm text-white">{lightbox.caption}</p>}
              {lightbox.guest_name && (
                <p className="text-xs mt-1" style={{ color: accentColor }}>
                  — {lightbox.guest_name}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
