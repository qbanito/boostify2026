import { useState } from 'react';
import { CalendarPlus, Loader2, Calendar, MapPin } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, DCTextarea, Badge, EmptyState } from './shared';

export default function EventManager({ dc }: { dc: DiscordCenter }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [accessLevel, setAccessLevel] = useState('all');

  const create = () => {
    if (!title.trim() || !startTime) return;
    dc.createEvent.mutate(
      { title: title.trim(), description: description.trim(), startTime: new Date(startTime).toISOString(), location: location.trim() || undefined, accessLevel },
      { onSuccess: () => { setTitle(''); setDescription(''); setStartTime(''); setLocation(''); } },
    );
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<CalendarPlus className="h-5 w-5" />} title="Gestor de eventos"
        subtitle="Programa watch parties, Q&As, lives y meet & greets directamente en Discord." />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-5">
          <DCInput placeholder="Título del evento" value={title} onChange={(e) => setTitle(e.target.value)} />
          <DCTextarea rows={3} placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="block text-[11px] uppercase tracking-wide text-white/40">Inicio</label>
          <DCInput type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-white/40" /><DCInput placeholder="Ubicación / enlace (opcional)" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-white/40">Acceso</span>
            {['all', 'vip', 'token'].map((a) => (
              <button key={a} onClick={() => setAccessLevel(a)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${accessLevel === a ? 'bg-[#5865F2] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{a}</button>
            ))}
          </div>
          <DCButton onClick={create} disabled={!title.trim() || !startTime || !dc.connected || dc.createEvent.isPending} className="w-full">
            {dc.createEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Crear evento
          </DCButton>
        </GlassCard>

        <GlassCard className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-white">Próximos eventos</h4>
          {dc.events.length > 0 ? (
            <div className="space-y-2">
              {dc.events.slice(0, 8).map((ev) => (
                <div key={ev.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">{ev.title}</span>
                    <Badge tone={ev.status === 'scheduled' ? 'emerald' : 'slate'}>{ev.status}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-white/50">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(ev.startTime).toLocaleString()}</span>
                    <Badge tone="blurple">{ev.accessLevel}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Calendar className="h-6 w-6" />} title="Sin eventos programados" hint="Crea tu primer evento para reunir a tu comunidad." />
          )}
        </GlassCard>
      </div>
    </div>
  );
}
