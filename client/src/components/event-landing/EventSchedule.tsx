/**
 * EventSchedule.tsx — Programa del día
 */
import { Clock } from 'lucide-react';
import type { EventPublicData } from '../../lib/event-api';
import { EventSectionHeading } from './EventSectionHeading';

interface ScheduleItem {
  time: string;
  title: string;
  desc?: string;
}

export function EventSchedule({ event }: { event: EventPublicData }) {
  const items = (Array.isArray(event.schedule_json) ? event.schedule_json : []) as ScheduleItem[];
  if (!items.length) return null;

  return (
    <section className="py-16 px-4 max-w-2xl mx-auto">
      <EventSectionHeading
        eyebrow="Programa"
        title="La noche te espera"
        icon={<Clock className="w-4 h-4" />}
        accentColor={event.accent_color}
      />

      <div className="relative">
        {/* vertical line */}
        <div className="absolute left-[72px] top-0 bottom-0 w-px opacity-20"
          style={{ background: event.accent_color }} />

        <div className="space-y-6">
          {items.map((item, i) => (
            <div key={i} className="flex gap-6 items-start">
              {/* time */}
              <div className="w-14 shrink-0 text-right">
                <span className="text-sm font-bold font-mono" style={{ color: event.accent_color }}>
                  {item.time}
                </span>
              </div>

              {/* dot */}
              <div className="shrink-0 mt-1.5 w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-black z-10"
                style={{ background: event.accent_color, boxShadow: `0 0 0 4px ${event.accent_color}30` }} />

              {/* content */}
              <div className="flex-1 pb-4">
                <p className="font-semibold text-white">{item.title}</p>
                {item.desc && <p className="text-sm text-white/50 mt-0.5">{item.desc}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
