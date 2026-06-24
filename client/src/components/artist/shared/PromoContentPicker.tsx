import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Link2, Music, Film, ShoppingBag, Ticket, Image as ImageIcon, Loader2, X, Search } from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

export type PromoContentType = 'song' | 'video' | 'product' | 'ticket' | 'gallery';

export interface PromoContentItem {
  id: string;
  type: PromoContentType;
  title: string;
  subtitle?: string;
  link: string;
  mediaUrl?: string;
  caption: string;
}

interface PromoContentResponse {
  success: boolean;
  artist?: { id: number; slug: string; name: string };
  profileUrl?: string;
  storeUrl?: string;
  counts?: Record<string, number>;
  items: PromoContentItem[];
}

const TYPE_META: Record<PromoContentType, { label: string; icon: typeof Music }> = {
  song: { label: 'Canciones', icon: Music },
  video: { label: 'Videos', icon: Film },
  product: { label: 'Productos', icon: ShoppingBag },
  ticket: { label: 'Tickets', icon: Ticket },
  gallery: { label: 'Galería', icon: ImageIcon },
};

const TYPE_ORDER: PromoContentType[] = ['song', 'video', 'product', 'ticket', 'gallery'];

/**
 * PromoContentPicker — shared content-library picker for the publishing modules
 * (WhatsApp, Telegram, Discord, Reddit). Fetches the artist's promotable content
 * (songs/videos/products/tickets/gallery) as ready-to-use links + media + pre-written
 * captions and lets the artist insert them into a composer with one click — so they
 * never have to write a post from scratch.
 */
export function PromoContentPicker({
  artistId,
  accent = '#22c55e',
  onPick,
  label = 'Insertar contenido',
  className = '',
}: {
  artistId: string | number;
  accent?: string;
  onPick: (item: PromoContentItem) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<PromoContentType | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery<PromoContentResponse>({
    queryKey: ['promo-content', String(artistId)],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/promo-content/${artistId}`);
      return (res && res.items) ? res : { success: false, items: [] };
    },
    enabled: open && !!artistId,
    staleTime: 60_000,
  });

  const items = data?.items || [];

  const availableTypes = useMemo(() => {
    const present = new Set(items.map(i => i.type));
    return TYPE_ORDER.filter(t => present.has(t));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (filter === 'all' || i.type === filter) &&
      (!q || i.title.toLowerCase().includes(q) || (i.subtitle || '').toLowerCase().includes(q)),
    );
  }, [items, filter, search]);

  const handlePick = (item: PromoContentItem) => {
    onPick(item);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.08]"
        style={{ borderColor: open ? `${accent}66` : undefined }}
      >
        <Link2 className="h-3.5 w-3.5" style={{ color: accent }} />
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-2 w-[min(420px,90vw)] rounded-2xl border border-white/10 bg-[#0d1117]/95 p-3 shadow-[0_12px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/60">Biblioteca de contenido</span>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-white/40 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-full bg-transparent text-xs text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>

            {/* Type filter chips */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                style={filter === 'all'
                  ? { background: accent, color: '#0a0a0a' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
              >
                Todos
              </button>
              {availableTypes.map(t => {
                const Icon = TYPE_META[t].icon;
                const active = filter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilter(t)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                    style={active
                      ? { background: accent, color: '#0a0a0a' }
                      : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
                  >
                    <Icon className="h-3 w-3" />
                    {TYPE_META[t].label}
                    {data?.counts?.[t] ? <span className="opacity-60">{data.counts[t]}</span> : null}
                  </button>
                );
              })}
            </div>

            {/* List */}
            <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
              {isLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando contenido…
                </div>
              )}
              {isError && (
                <div className="py-6 text-center text-xs text-rose-300">
                  No se pudo cargar.{' '}
                  <button type="button" onClick={() => refetch()} className="underline">Reintentar</button>
                </div>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <div className="py-8 text-center text-xs text-white/40">
                  No hay contenido publicado todavía.
                </div>
              )}
              {filtered.map(item => {
                const Icon = TYPE_META[item.type].icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handlePick(item)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-2 text-left transition hover:bg-white/[0.07]"
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-white/5">
                      {item.mediaUrl ? (
                        <img src={item.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Icon className="h-4 w-4 text-white/30" />
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-md bg-black/70 p-0.5">
                        <Icon className="h-2.5 w-2.5" style={{ color: accent }} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-white">{item.title}</div>
                      {item.subtitle && <div className="truncate text-[10px] text-white/45">{item.subtitle}</div>}
                    </div>
                    <span className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold" style={{ background: `${accent}22`, color: accent }}>
                      Insertar
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PromoContentPicker;
