import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Star, ShoppingBag, MapPin, UserPlus, Send, Loader2, Upload } from 'lucide-react';
import type { WhatsAppCenter } from '../../../hooks/use-whatsapp-center';
import { GlassCard, PanelHeader } from './shared';

const SEGMENTS = [
  { key: 'all', label: 'Todos', icon: Users },
  { key: 'vip', label: 'Fans VIP', icon: Star },
  { key: 'buyers', label: 'Compradores', icon: ShoppingBag },
  { key: 'new', label: 'Nuevos', icon: UserPlus },
];

/**
 * Fan Messenger — browse contacts by segment, import a contact list and send a
 * 1:1 message. Consent + opt-out are enforced server-side.
 */
export function FanMessenger({ center }: { center: WhatsAppCenter }) {
  const [segment, setSegment] = useState('all');
  const [selected, setSelected] = useState<string>('');
  const [message, setMessage] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [csv, setCsv] = useState('');

  const filtered = center.contacts.filter((c) => {
    if (segment === 'vip') return c.isVip;
    if (segment === 'buyers') return (c.totalSpent || 0) > 0;
    if (segment === 'new') return !c.lastMessageAt;
    return true;
  });

  const send = () => {
    if (!selected || !message.trim()) return;
    center.sendMessage.mutate({ to: selected, message: message.trim() });
    setMessage('');
  };

  const doImport = () => {
    // Parse simple "name,phone,city,vip" lines.
    const contacts = csv.split('\n').map((line) => {
      const [name, phone, city, vip] = line.split(',').map((x) => x?.trim());
      if (!phone) return null;
      return { name: name || phone, phone, city: city || null, isVip: /^(1|true|vip|si|sí)$/i.test(vip || ''), source: 'import', consentStatus: 'opted_in' as const };
    }).filter(Boolean) as any[];
    if (contacts.length) center.importContacts.mutate(contacts);
    setCsv(''); setShowImport(false);
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Users className="h-5 w-5" />}
        title="Fan Messenger"
        subtitle="Segmenta tu audiencia y conversa 1:1 con tus fans."
      />

      {/* Segment chips */}
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSegment(key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              segment === key
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
            <span className="ml-1 rounded-full bg-black/30 px-1.5 text-[10px]">
              {key === 'all' ? center.contacts.length : key === 'vip' ? center.segments.vip : key === 'buyers' ? center.segments.buyers : center.segments.new}
            </span>
          </button>
        ))}
        <button
          onClick={() => setShowImport((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white"
        >
          <Upload className="h-3.5 w-3.5" /> Importar
        </button>
      </div>

      {showImport && (
        <GlassCard className="p-4">
          <p className="mb-2 text-xs text-white/60">Pega contactos (uno por línea): <code>nombre,teléfono,ciudad,vip</code></p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={4}
            placeholder={'Ana,5215550001,CDMX,vip\nLuis,5215550002,Guadalajara,'}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
          />
          <button
            onClick={doImport}
            disabled={center.importContacts.isPending || !csv.trim()}
            className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            {center.importContacts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Importar contactos
          </button>
        </GlassCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Contact list */}
        <GlassCard className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-white/40">Aún no hay contactos en este segmento.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.phone)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                  selected === c.phone ? 'bg-emerald-500/15' : 'hover:bg-white/5'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium text-white">
                    {c.name} {c.isVip && <Star className="h-3 w-3 text-amber-400" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/45">
                    <span>+{c.phone}</span>
                    {c.city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{c.city}</span>}
                  </div>
                </div>
                {c.consentStatus === 'opted_out' && (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-300">opt-out</span>
                )}
              </button>
            ))
          )}
        </GlassCard>

        {/* Composer */}
        <GlassCard className="p-4">
          <div className="mb-2 text-sm text-white/70">
            {selected ? <>Mensaje a <span className="font-semibold text-white">+{selected}</span></> : 'Selecciona un fan'}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Escribe tu mensaje…"
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={send}
            disabled={!center.isConnected || !selected || !message.trim() || center.sendMessage.isPending}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {center.sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar mensaje
          </motion.button>
        </GlassCard>
      </div>
    </div>
  );
}
