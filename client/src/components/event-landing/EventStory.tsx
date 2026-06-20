/**
 * EventStory.tsx — Historia del homenajeado
 */
import { BookOpen, Quote } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

export function EventStory({ event }: { event: EventPublicData }) {
  const story = event.story_json as { title?: string; body?: string; quote?: string } | null;
  if (!story?.body) return null;

  return (
    <section className="py-16 px-4 max-w-3xl mx-auto">
      <EventSectionHeading
        eyebrow="Historia"
        title={story.title || `La historia de ${event.honoree_name ?? 'nuestra protagonista'}`}
        icon={<BookOpen className="w-4 h-4" />}
        accentColor={event.accent_color}
      />

      <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        {/* decorative corner */}
        <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 rounded-tl-2xl"
          style={{ borderColor: event.accent_color + '60' }} />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 rounded-br-2xl"
          style={{ borderColor: event.accent_color + '60' }} />

        <p className="text-white/75 leading-relaxed text-base whitespace-pre-line">{story.body}</p>

        {story.quote && (
          <blockquote className="mt-8 pl-6 border-l-2 italic text-white/60 text-lg"
            style={{ borderColor: event.accent_color }}>
            <Quote className="w-5 h-5 mb-2 opacity-50" style={{ color: event.accent_color }} />
            {story.quote}
          </blockquote>
        )}
      </div>
    </section>
  );
}
