/**
 * SeasonalDropsPanel — Active & upcoming collection drops with AI generation
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Loader2, Lock, Clock, Flame, Package } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface Collection {
  id: number;
  name: string;
  season: string;
  year: number;
  theme: string;
  inspiredBySong?: string;
  heroImageUrl?: string;
  lookbookUrls?: string[];
  status: 'upcoming' | 'active' | 'sold_out' | 'archived';
  dropDate?: string;
  isLimited: boolean;
  limitedQuantity?: number;
  tokenGated: boolean;
  createdAt: string;
}

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
}

const SEASON_LABELS: Record<string, string> = {
  spring_summer: 'SS', fall_winter: 'FW', limited: 'LTD', capsule: 'CAPSULE', collab: 'COLLAB',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: '#a78bfa', active: '#34d399', sold_out: '#f87171', archived: '#6b7280',
};

function CountdownTimer({ dropDate }: { dropDate: string }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(dropDate).getTime() - now;
  if (diff <= 0) return <span className="text-[11px] text-green-400 font-bold">LIVE NOW</span>;
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="text-[11px] font-mono text-white/60">
      {d > 0 ? `${d}d ` : ''}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}

export function SeasonalDropsPanel({ artistId, brand, isOwner, colors }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [genResult, setGenResult] = useState<Partial<Collection> | null>(null);
  const [form, setForm] = useState({ season: 'limited', inspiredBySong: '', year: new Date().getFullYear(), dropDate: '' });

  const { data, isLoading } = useQuery<{ success: boolean; collections: Collection[] }>({
    queryKey: ['fashion-collections', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/collections`),
    staleTime: 2 * 60 * 1000,
  });

  const collections = data?.collections || [];
  const activeDrops = collections.filter(c => c.status === 'active' || c.status === 'upcoming');
  const pastDrops = collections.filter(c => c.status === 'sold_out' || c.status === 'archived');

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/fashion-store/${artistId}/collections/generate`, form),
    onSuccess: (d: any) => { setGenResult(d.collection); },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => apiRequest('POST', `/api/fashion-store/${artistId}/collections`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fashion-collections', artistId] });
      setShowModal(false);
      setGenResult(null);
      toast({ title: '✅ Drop saved!' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (!brand) {
    return <p className="text-white/30 text-sm py-8 text-center">Create your fashion brand first to manage drops.</p>;
  }

  return (
    <div className="space-y-5">
      {isOwner && (
        <Button size="sm" onClick={() => setShowModal(true)}
          className="rounded-full font-semibold text-xs"
          style={{ background: colors.hexPrimary, color: 'white' }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Drop
        </Button>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
      ) : activeDrops.length === 0 ? (
        <div className="rounded-2xl p-8 text-center"
          style={{ border: `1px dashed ${colors.hexBorder}`, background: `${colors.hexPrimary}08` }}>
          <Flame className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-white/40 text-sm">No active drops yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activeDrops.map(col => (
            <CollectionCard key={col.id} col={col} colors={colors} />
          ))}
        </div>
      )}

      {pastDrops.length > 0 && (
        <div>
          <p className="text-white/25 text-[11px] uppercase tracking-widest mb-3">Past Drops</p>
          <div className="grid gap-3">
            {pastDrops.map(col => (
              <CollectionCard key={col.id} col={col} colors={colors} compact />
            ))}
          </div>
        </div>
      )}

      {/* New Drop Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-[#08080f] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">New Collection Drop</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={form.season} onValueChange={v => setForm(p => ({ ...p, season: v }))}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent className="bg-[#0d0d18] border-white/10 text-white">
                <SelectItem value="spring_summer">Spring / Summer</SelectItem>
                <SelectItem value="fall_winter">Fall / Winter</SelectItem>
                <SelectItem value="limited">Limited Edition</SelectItem>
                <SelectItem value="capsule">Capsule</SelectItem>
                <SelectItem value="collab">Collaboration</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={form.inspiredBySong}
              onChange={e => setForm(p => ({ ...p, inspiredBySong: e.target.value }))}
              placeholder="Inspired by song / album (optional)"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
            />
            <Input
              type="date"
              value={form.dropDate}
              onChange={e => setForm(p => ({ ...p, dropDate: e.target.value }))}
              className="bg-white/5 border-white/10 text-white"
            />

            {genResult ? (
              <div className="rounded-xl p-4 space-y-2"
                style={{ background: `${colors.hexPrimary}10`, border: `1px solid ${colors.hexBorder}` }}>
                {genResult.heroImageUrl && (
                  <img src={genResult.heroImageUrl} alt="Hero" className="w-full h-32 object-cover rounded-lg mb-2" />
                )}
                <p className="text-white font-bold tracking-widest">{genResult.name}</p>
                <p className="text-white/50 text-xs">{genResult.theme}</p>
                <Button size="sm" className="w-full rounded-xl text-xs font-semibold mt-1"
                  style={{ background: colors.hexPrimary }}
                  onClick={() => saveMutation.mutate({ ...genResult, ...form, dropDate: form.dropDate || undefined })}
                  disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Save Drop'}
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-full rounded-xl text-xs font-semibold"
                style={{ background: colors.hexPrimary }}
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}>
                {generateMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating Collection…</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate with AI</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollectionCard({ col, colors, compact = false }: { col: Collection; colors: any; compact?: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${colors.hexBorder}` }}>
      {!compact && col.heroImageUrl && (
        <div className="relative h-36 overflow-hidden">
          <img src={col.heroImageUrl} alt={col.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div>
              <p className="text-white font-bold tracking-widest text-sm">{col.name}</p>
              <p className="text-white/50 text-[10px]">{SEASON_LABELS[col.season]} {col.year}</p>
            </div>
            {col.dropDate && new Date(col.dropDate) > new Date() && (
              <div className="flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                <Clock className="w-3 h-3 text-white/40" />
                <CountdownTimer dropDate={col.dropDate} />
              </div>
            )}
          </div>
        </div>
      )}
      <div className="p-3 flex items-center justify-between gap-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
        {compact && (
          <div>
            <p className="text-white text-xs font-bold">{col.name}</p>
            <p className="text-white/30 text-[10px]">{SEASON_LABELS[col.season]} {col.year}</p>
          </div>
        )}
        <div className="flex gap-2 flex-wrap ml-auto">
          {col.isLimited && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              LTD {col.limitedQuantity || ''}
            </span>
          )}
          {col.tokenGated && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-purple-300 flex items-center gap-1"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <Lock className="w-2.5 h-2.5" /> Token Gated
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: `${STATUS_COLORS[col.status]}20`, color: STATUS_COLORS[col.status], border: `1px solid ${STATUS_COLORS[col.status]}40` }}>
            {col.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
