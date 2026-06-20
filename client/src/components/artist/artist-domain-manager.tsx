/**
 * Artist Domain Manager — v2
 *
 * Tab 1: Find & Buy    — search + TLD price comparison + one-click purchase
 * Tab 2: Manage & DNS  — privacy, lock, forwarding, DNS records
 * Tab 3: Email / Resend— guided Resend.com setup, DNS records, connected flow
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, Shield, Lock, ArrowRight, Copy, Check,
  Plus, Trash2, RefreshCw, AlertCircle, CheckCircle2,
  Mail, Settings2, ExternalLink, ChevronRight, Loader2, X,
  HelpCircle, Tag, Star, Zap, DollarSign, Sparkles,
  MailCheck, Send, Key, ShieldCheck, Info,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistDomain {
  id: number;
  domain: string;
  status: 'pending' | 'active' | 'expired' | 'suspended' | 'failed';
  pricePerYear: number;
  currency: string;
  autoRenew: boolean;
  privacyEnabled: boolean;
  domainLocked: boolean;
  forwardingUrl: string | null;
  forwardingType: '301' | '302';
  expiresAt: string | null;
  purchasedAt: string | null;
}

interface AvailabilityResult {
  domain: string;
  tld: string;
  isAvailable: boolean;
  pricePerYear: number;
  itemId: string;
}

interface DnsRecord {
  name: string;
  type: string;
  ttl: number;
  records: { content: string }[];
}

interface Props {
  artistId: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  pending:   { label: 'Pending',   color: 'bg-yellow-500/20  text-yellow-400  border-yellow-500/30'  },
  expired:   { label: 'Expired',   color: 'bg-red-500/20     text-red-400     border-red-500/30'     },
  suspended: { label: 'Suspended', color: 'bg-orange-500/20  text-orange-400  border-orange-500/30'  },
  failed:    { label: 'Failed',    color: 'bg-red-500/20     text-red-400     border-red-500/30'     },
};

const TLD_META: Record<string, { label: string; badge?: string; badgeColor?: string; approxCents: number }> = {
  com:   { label: '.com',    badge: 'Popular',   badgeColor: '#6366f1', approxCents: 1299 },
  net:   { label: '.net',    badge: 'Classic',   badgeColor: '#8b5cf6', approxCents: 1599 },
  org:   { label: '.org',    badge: 'Trusted',   badgeColor: '#0ea5e9', approxCents: 1399 },
  io:    { label: '.io',     badge: 'Tech',      badgeColor: '#10b981', approxCents: 4900 },
  music: { label: '.music',  badge: 'Artist ✨', badgeColor: '#f59e0b', approxCents: 3990 },
  band:  { label: '.band',   badge: 'Artist ✨', badgeColor: '#f59e0b', approxCents: 2990 },
  live:  { label: '.live',   badge: 'Events',    badgeColor: '#ef4444', approxCents: 2490 },
  pro:   { label: '.pro',    badge: 'Pro',       badgeColor: '#a855f7', approxCents: 1990 },
  co:    { label: '.co',     badge: 'Short',     badgeColor: '#06b6d4', approxCents: 2999 },
  studio:{ label: '.studio', badge: 'Creative',  badgeColor: '#ec4899', approxCents: 2490 },
};
const ALL_TLDS = Object.keys(TLD_META);
const DEFAULT_TLDS = ['com', 'net', 'music', 'band', 'io', 'live'];

const GUIDE_ITEMS = [
  {
    icon: Search,
    color: '#6366f1',
    title: 'Find & Buy',
    body: 'Busca el nombre de tu dominio y compara precios por TLD (.com, .music, .band, etc.). Puedes activar o desactivar qué extensiones quieres ver. Compra con un clic — el registro puede tardar unos minutos.',
  },
  {
    icon: DollarSign,
    color: '#10b981',
    title: 'Precios por año',
    body: 'Cada TLD tiene un precio distinto. Los dominios .music y .band están diseñados para artistas. El precio mostrado es por año; se renueva automáticamente si activas auto-renew.',
  },
  {
    icon: Shield,
    color: '#8b5cf6',
    title: 'Privacy & Lock',
    body: 'Privacy Protection oculta tus datos personales en el WHOIS público. Domain Lock impide transferencias no autorizadas. Ambas opciones se pueden activar desde la pestaña Manage.',
  },
  {
    icon: ArrowRight,
    color: '#f59e0b',
    title: 'Forwarding',
    body: 'Redirige tu dominio a cualquier URL (tu perfil de Boostify, Spotify, Instagram, etc.). Un redirect 301 es permanente — ideal para SEO. Configúralo en la pestaña Manage.',
  },
  {
    icon: Send,
    color: '#f97316',
    title: 'Email con Resend',
    body: 'Resend.com te permite enviar emails profesionales desde tu dominio (contacto@tuartista.com) de forma gratuita hasta 3,000 emails/mes. Esta pestaña te guía paso a paso.',
  },
  {
    icon: Key,
    color: '#06b6d4',
    title: 'DNS Records',
    body: 'Los registros DNS son como el sistema de direcciones de internet. SPF y DKIM son registros de texto que le dicen al mundo que tus emails son legítimos. No necesitas saber programar — solo copiar y pegar.',
  },
];

const formatPrice = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors hover:bg-white/8"
      style={{ color: copied ? '#4ade80' : 'rgba(255,255,255,0.4)' }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label && <span>{copied ? 'Copiado' : label}</span>}
    </button>
  );
}

// ─── Tab 1: Find & Buy ────────────────────────────────────────────────────────

function FindBuyTab({ artistId }: { artistId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AvailabilityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [selectedTlds, setSelectedTlds] = useState<Set<string>>(new Set(DEFAULT_TLDS));
  const [showAllTlds, setShowAllTlds] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleTld = (tld: string) => {
    setSelectedTlds(prev => {
      const next = new Set(prev);
      if (next.has(tld)) {
        if (next.size > 1) next.delete(tld);
      } else {
        next.add(tld);
      }
      return next;
    });
  };

  // Cleanup debounce timer on unmount to prevent state updates on unmounted component
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleSearch = useCallback(async (value: string, tlds: string[]) => {
    if (!value.trim() || value.length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      const data = await apiRequest({ url: '/api/artist-domain/check-availability', method: 'POST', data: { name: value.trim(), tlds } });
      const sorted = (data.results ?? []) as AvailabilityResult[];
      sorted.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return a.pricePerYear - b.pricePerYear;
      });
      setResults(sorted);
    } catch (err: any) {
      toast({ title: 'Búsqueda fallida', description: err.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const triggerSearch = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val, Array.from(selectedTlds)), 700);
  }, [handleSearch, selectedTlds]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 63);
    setQuery(val);
    triggerSearch(val);
  };

  // Re-search when TLD selection changes
  useEffect(() => {
    if (query.length > 1) triggerSearch(query);
  }, [selectedTlds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePurchase = async (result: AvailabilityResult) => {
    setPurchasing(result.domain);
    try {
      await apiRequest({ url: `/api/artist-domain/${artistId}/purchase`, method: 'POST', data: { domain: result.domain, itemId: result.itemId, pricePerYear: result.pricePerYear, currency: 'USD' } });
      toast({
        title: '🌐 Registro iniciado',
        description: `${result.domain} está siendo configurado. Puede tardar unos minutos.`,
      });
      queryClient.invalidateQueries({ queryKey: ['artist-domains', artistId] });
    } catch (err: any) {
      toast({ title: 'Compra fallida', description: err.message, variant: 'destructive' });
    } finally {
      setPurchasing(null);
    }
  };

  const availableCount = results.filter(r => r.isAvailable).length;
  const cheapest = results.filter(r => r.isAvailable).sort((a, b) => a.pricePerYear - b.pricePerYear)[0];
  const visibleTlds = showAllTlds ? ALL_TLDS : ALL_TLDS.slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
        <input
          value={query}
          onChange={handleInputChange}
          placeholder="Ej: juanlopez, skymelo, themoonartist..."
          className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder-white/25 outline-none border border-white/10 focus:border-indigo-500/60 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
        {isSearching ? (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />
        ) : query ? (
          <button onClick={() => { setQuery(''); setResults([]); }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* TLD selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Extensiones a buscar</p>
          <button onClick={() => setShowAllTlds(v => !v)}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
            {showAllTlds ? 'Ver menos' : 'Ver todas'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleTlds.map(tld => {
            const meta = TLD_META[tld];
            const active = selectedTlds.has(tld);
            return (
              <motion.button
                key={tld}
                whileTap={{ scale: 0.94 }}
                onClick={() => toggleTld(tld)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                style={active
                  ? { background: `${meta.badgeColor}20`, borderColor: `${meta.badgeColor}50`, color: meta.badgeColor }
                  : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }
                }
              >
                <span>{meta.label}</span>
                {meta.badge && active && (
                  <span className="text-[9px] opacity-70">{meta.badge}</span>
                )}
                <span className="text-[10px] opacity-60">~{formatPrice(meta.approxCents)}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="popLayout">
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5"
          >
            {availableCount > 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-500/20"
                style={{ background: 'rgba(16,185,129,0.05)' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">{availableCount} disponible{availableCount > 1 ? 's' : ''}</span>
                </div>
                {cheapest && (
                  <span className="text-xs text-white/40">Desde {formatPrice(cheapest.pricePerYear)}/año</span>
                )}
              </div>
            )}

            {results.map((r, idx) => {
              const meta = TLD_META[r.tld] || { label: `.${r.tld}`, approxCents: r.pricePerYear, badgeColor: '#6366f1' };
              const isBestValue = r.isAvailable && r.domain === cheapest?.domain;
              const isAvailableAndCheap = r.isAvailable && r.pricePerYear <= 1500;
              return (
                <motion.div
                  key={r.domain}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border transition-all"
                  style={{
                    background: r.isAvailable ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                    borderColor: isBestValue ? 'rgba(99,102,241,0.4)' : r.isAvailable ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className={`w-4 h-4 flex-shrink-0 ${r.isAvailable ? 'text-emerald-400' : 'text-white/20'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-bold ${r.isAvailable ? 'text-white' : 'text-white/30 line-through'}`}>
                          {r.domain}
                        </p>
                        {meta.badge && r.isAvailable && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `${meta.badgeColor}20`, color: meta.badgeColor, border: `1px solid ${meta.badgeColor}40` }}>
                            {meta.badge}
                          </span>
                        )}
                        {isBestValue && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            ⭐ Mejor precio
                          </span>
                        )}
                      </div>
                      {r.isAvailable && r.pricePerYear > 0 && (
                        <p className="text-xs text-white/45 mt-0.5">
                          <span className="font-bold text-white/70">{formatPrice(r.pricePerYear)}</span>/año
                          {isAvailableAndCheap && <span className="ml-1.5 text-emerald-400 text-[10px]">✓ Precio bajo</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {r.isAvailable ? (
                    <Button
                      size="sm"
                      disabled={purchasing === r.domain}
                      onClick={() => handlePurchase(r)}
                      className="flex-shrink-0 h-8 px-4 text-xs font-bold"
                      style={{ background: isBestValue ? '#6366f1' : 'rgba(99,102,241,0.7)', color: '#fff' }}
                    >
                      {purchasing === r.domain ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>Comprar <ChevronRight className="w-3 h-3 ml-0.5" /></>
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs text-white/25 flex-shrink-0">No disponible</span>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {isSearching && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
            className="w-10 h-10 rounded-full bg-indigo-500/15 flex items-center justify-center">
            <Search className="w-5 h-5 text-indigo-400" />
          </motion.div>
          <p className="text-sm text-white/40">Verificando disponibilidad...</p>
        </div>
      )}

      {!isSearching && !query && (
        <div className="text-center py-10">
          <Globe className="w-10 h-10 mx-auto mb-3 text-white/15" />
          <p className="text-sm text-white/30">Escribe un nombre para ver disponibilidad y precios</p>
          <p className="text-xs text-white/20 mt-1">Los dominios .music y .band son perfectos para artistas</p>
        </div>
      )}
    </div>
  );
}

// ─── DNS Record Editor ────────────────────────────────────────────────────────

function DnsEditor({ domain, artistId }: { domain: string; artistId: number }) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dns-records', domain],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/artist-domain/${artistId}/${domain}/dns`);
      return (res.records ?? []) as DnsRecord[];
    },
    enabled: !!domain,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ name, type }: { name: string; type: string }) =>
      apiRequest('DELETE', `/api/artist-domain/${artistId}/${domain}/dns`, { name, type }),
    onSuccess: () => { toast({ title: 'DNS record eliminado' }); refetch(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return (
    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-white/40" /></div>
  );

  const records = data ?? [];
  const typeColor: Record<string, string> = {
    A: '#6366f1', AAAA: '#8b5cf6', CNAME: '#10b981',
    MX: '#f59e0b', TXT: '#06b6d4', NS: '#f97316', SOA: '#ef4444',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Registros DNS</p>
        <button onClick={() => refetch()} className="text-white/25 hover:text-white/60 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      {records.length === 0 ? (
        <p className="text-xs text-white/25 text-center py-4">No se encontraron registros DNS</p>
      ) : (
        <div className="space-y-1.5">
          {records.map((rec, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/6 text-xs"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="w-12 font-bold font-mono text-[11px]" style={{ color: typeColor[rec.type] ?? '#6366f1' }}>
                {rec.type}
              </span>
              <span className="flex-1 text-white/65 font-mono truncate">{rec.name}</span>
              <span className="text-white/30 font-mono text-[10px]">TTL {rec.ttl}</span>
              <CopyButton value={rec.records?.[0]?.content ?? rec.name} />
              <button onClick={() => deleteMutation.mutate({ name: rec.name, type: rec.type })}
                className="text-white/20 hover:text-red-400 transition-colors ml-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Manage & DNS ──────────────────────────────────────────────────────

function ManageTab({ artistId, domains }: { artistId: number; domains: ArtistDomain[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState<ArtistDomain | null>(
    domains.length > 0 ? domains[0] : null
  );
  const [forwardUrl, setForwardUrl] = useState(selectedDomain?.forwardingUrl ?? '');

  useEffect(() => {
    if (selectedDomain) setForwardUrl(selectedDomain.forwardingUrl ?? '');
  }, [selectedDomain]);

  const toggleMutation = useMutation({
    mutationFn: async ({ endpoint, payload }: { endpoint: string; payload: object }) =>
      apiRequest('PUT', endpoint, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['artist-domains', artistId] }),
    onError: (e: any) => toast({ title: 'Error al actualizar', description: e.message, variant: 'destructive' }),
  });

  const forwardingMutation = useMutation({
    mutationFn: async ({ url, type }: { url: string; type: string }) =>
      apiRequest('POST', `/api/artist-domain/${artistId}/${selectedDomain?.domain}/forwarding`, { url, type }),
    onSuccess: () => {
      toast({ title: 'Redirección guardada' });
      queryClient.invalidateQueries({ queryKey: ['artist-domains', artistId] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeForwardingMutation = useMutation({
    mutationFn: async () =>
      apiRequest('DELETE', `/api/artist-domain/${artistId}/${selectedDomain?.domain}/forwarding`, {}),
    onSuccess: () => {
      toast({ title: 'Redirección eliminada' });
      setForwardUrl('');
      queryClient.invalidateQueries({ queryKey: ['artist-domains', artistId] });
    },
  });

  if (domains.length === 0) {
    return (
      <div className="text-center py-12 text-white/25">
        <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No tienes dominios aún. Compra uno en "Buscar & Comprar".</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {domains.length > 1 && (
        <Select value={selectedDomain?.domain}
          onValueChange={v => setSelectedDomain(domains.find(d => d.domain === v) ?? null)}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-white/10">
            {domains.map(d => (
              <SelectItem key={d.domain} value={d.domain} className="text-white">{d.domain}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedDomain && (
        <>
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-white/10"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="font-bold text-white text-sm">{selectedDomain.domain}</p>
                {selectedDomain.expiresAt && (
                  <p className="text-xs text-white/35 mt-0.5">
                    Vence {new Date(selectedDomain.expiresAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
            <Badge className={`text-xs border ${STATUS_CONFIG[selectedDomain.status]?.color ?? 'bg-white/10 text-white/50'}`}>
              {STATUS_CONFIG[selectedDomain.status]?.label ?? selectedDomain.status}
            </Badge>
          </div>

          <div className="space-y-2.5">
            {[
              {
                icon: Shield, iconColor: '#6366f1',
                label: 'Privacy Protection',
                desc: 'Oculta tus datos personales en el WHOIS público',
                checked: selectedDomain.privacyEnabled,
                onToggle: (v: boolean) => {
                  toggleMutation.mutate({
                    endpoint: `/api/artist-domain/${artistId}/${selectedDomain.domain}/privacy`,
                    payload: { enabled: v },
                  });
                  setSelectedDomain({ ...selectedDomain, privacyEnabled: v });
                },
              },
              {
                icon: Lock, iconColor: '#f59e0b',
                label: 'Domain Lock',
                desc: 'Previene transferencias no autorizadas',
                checked: selectedDomain.domainLocked,
                onToggle: (v: boolean) => {
                  toggleMutation.mutate({
                    endpoint: `/api/artist-domain/${artistId}/${selectedDomain.domain}/lock`,
                    payload: { locked: v },
                  });
                  setSelectedDomain({ ...selectedDomain, domainLocked: v });
                },
              },
            ].map((toggle, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-white/8"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${toggle.iconColor}15` }}>
                    <toggle.icon className="w-4 h-4" style={{ color: toggle.iconColor }} />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{toggle.label}</p>
                    <p className="text-xs text-white/35 mt-0.5">{toggle.desc}</p>
                  </div>
                </div>
                <Switch checked={toggle.checked} disabled={toggleMutation.isPending} onCheckedChange={toggle.onToggle} />
              </div>
            ))}
          </div>

          <Separator className="bg-white/8" />

          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <ArrowRight className="w-3 h-3" /> Redirección de dominio
            </p>
            <div className="flex gap-2">
              <input
                value={forwardUrl}
                onChange={e => setForwardUrl(e.target.value)}
                placeholder="https://tu-pagina.com"
                className="flex-1 px-3 py-2 rounded-lg text-sm text-white placeholder-white/20 outline-none border border-white/10 focus:border-indigo-500/60 transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              />
              <Button size="sm" disabled={!forwardUrl || forwardingMutation.isPending}
                onClick={() => forwardingMutation.mutate({ url: forwardUrl, type: '301' })}
                className="bg-indigo-600 hover:bg-indigo-500 h-9 px-4 text-xs font-bold">
                {forwardingMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
              </Button>
              {selectedDomain.forwardingUrl && (
                <Button size="sm" variant="ghost"
                  onClick={() => removeForwardingMutation.mutate()}
                  className="h-9 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <p className="text-xs text-white/25">
              Los visitantes de <span className="text-white/45">{selectedDomain.domain}</span> serán redirigidos (301 permanente)
            </p>
          </div>

          <Separator className="bg-white/8" />

          {selectedDomain.status === 'active' && (
            <DnsEditor domain={selectedDomain.domain} artistId={artistId} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab 3: Email Setup with Resend ──────────────────────────────────────────

function EmailSetupTab({ domains }: { domains: ArtistDomain[] }) {
  const activeDomains = domains.filter(d => d.status === 'active');
  const [selectedDomain, setSelectedDomain] = useState(activeDomains[0]?.domain ?? '');
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (n: number) => setCompletedSteps(prev => {
    const next = new Set(prev);
    next.has(n) ? next.delete(n) : next.add(n);
    return next;
  });

  const domain = selectedDomain || 'tudominio.com';

  const resendDnsRecords = [
    {
      step: 'Verificación de dominio',
      type: 'TXT',
      name: `_resend.${domain}`,
      value: '(valor provisto por Resend en tu dashboard → Domains)',
      note: 'Resend genera este valor único al agregar tu dominio',
      color: '#6366f1',
      icon: ShieldCheck,
    },
    {
      step: 'SPF — autorizar envío',
      type: 'TXT',
      name: `send.${domain}`,
      value: '"v=spf1 include:amazonses.com ~all"',
      note: 'Marca tus emails como legítimos ante otros servidores',
      color: '#10b981',
      icon: CheckCircle2,
    },
    {
      step: 'DKIM — firma digital',
      type: 'CNAME',
      name: `resend._domainkey.${domain}`,
      value: '(3 registros CNAME provistos por Resend al agregar dominio)',
      note: 'Resend genera valores únicos de DKIM por dominio',
      color: '#f59e0b',
      icon: Key,
    },
    {
      step: 'DMARC — política anti-spam',
      type: 'TXT',
      name: `_dmarc.${domain}`,
      value: '"v=DMARC1; p=none; rua=mailto:dmarc@resend.dev"',
      note: 'Opcional pero muy recomendado para evitar que te marquen como spam',
      color: '#8b5cf6',
      icon: Shield,
    },
  ];

  const steps = [
    {
      n: 1,
      icon: Send,
      color: '#f97316',
      title: 'Crea tu cuenta en Resend',
      body: 'Resend es gratuito hasta 3,000 emails/mes. Regístrate con tu email en resend.com — no necesitas tarjeta de crédito.',
      action: (
        <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="h-8 px-4 text-xs font-bold mt-2"
            style={{ background: '#f97316', color: '#fff' }}>
            <ExternalLink className="w-3 h-3 mr-1.5" /> Abrir Resend.com
          </Button>
        </a>
      ),
    },
    {
      n: 2,
      icon: Globe,
      color: '#6366f1',
      title: 'Agrega tu dominio en Resend',
      body: `En el dashboard de Resend, ve a Domains → Add Domain y escribe: ${domain}. Resend te dará los registros DNS que necesitas agregar.`,
      action: (
        <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-8 px-4 text-xs font-bold mt-2 border-white/15 text-white hover:bg-white/8">
            <ExternalLink className="w-3 h-3 mr-1.5" /> Ir a Resend → Domains
          </Button>
        </a>
      ),
    },
    {
      n: 3,
      icon: Key,
      color: '#10b981',
      title: 'Agrega los registros DNS',
      body: 'Copia los registros de abajo y agrégalos en la pestaña Manage → DNS Records de tu dominio. Los valores con "(provisto por Resend)" los encuentras en tu dashboard de Resend.',
      action: null as React.ReactNode,
    },
    {
      n: 4,
      icon: MailCheck,
      color: '#a855f7',
      title: 'Verifica y crea tu email',
      body: `Vuelve al dashboard de Resend y haz clic en "Verify". Una vez verificado, crea tu primera dirección: info@${domain} o contacto@${domain}.`,
      action: (
        <a href="https://resend.com/emails" target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="h-8 px-4 text-xs font-bold mt-2 border-white/15 text-white hover:bg-white/8">
            <ExternalLink className="w-3 h-3 mr-1.5" /> Verificar en Resend
          </Button>
        </a>
      ),
    },
  ];

  if (activeDomains.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="w-10 h-10 mx-auto mb-3 text-white/15" />
        <p className="text-sm text-white/35 font-medium">Necesitas un dominio activo para configurar email</p>
        <p className="text-xs text-white/20 mt-1">Compra uno en la pestaña "Buscar & Comprar"</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {activeDomains.length > 1 && (
        <Select value={selectedDomain} onValueChange={setSelectedDomain}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-white/10">
            {activeDomains.map(d => (
              <SelectItem key={d.domain} value={d.domain} className="text-white">{d.domain}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="rounded-xl p-4 flex items-start gap-3 border border-orange-500/25"
        style={{ background: 'rgba(249,115,22,0.07)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)' }}>
          <Send className="w-4 h-4 text-orange-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Email profesional con Resend</p>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            Envía emails desde <span className="text-orange-300 font-medium">contacto@{domain}</span> — apariencia profesional, gratuito hasta 3,000/mes, sin configurar servidores.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const done = completedSteps.has(step.n);
          return (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border overflow-hidden"
              style={{
                borderColor: done ? `${step.color}40` : 'rgba(255,255,255,0.08)',
                background: done ? `${step.color}08` : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <button
                  onClick={() => toggleStep(step.n)}
                  className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all"
                  style={{
                    borderColor: done ? step.color : 'rgba(255,255,255,0.2)',
                    background: done ? step.color : 'transparent',
                  }}
                >
                  {done && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${step.color}20` }}>
                      <step.icon className="w-3 h-3" style={{ color: step.color }} />
                    </div>
                    <p className="text-sm font-bold text-white">Paso {step.n}: {step.title}</p>
                  </div>
                  <p className="text-xs text-white/45 mt-1.5 leading-relaxed">{step.body}</p>
                  {step.action}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-white/40" />
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Registros DNS para Resend</p>
        </div>
        {resendDnsRecords.map((rec, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: `${rec.color}25`, background: `${rec.color}06` }}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 border-b"
              style={{ borderColor: `${rec.color}15`, background: `${rec.color}10` }}>
              <rec.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: rec.color }} />
              <p className="text-xs font-bold" style={{ color: rec.color }}>{rec.step}</p>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md ml-auto"
                style={{ background: `${rec.color}20`, color: rec.color }}>{rec.type}</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1">Nombre / Host</p>
                  <p className="text-xs font-mono text-white/80 break-all">{rec.name}</p>
                </div>
                <CopyButton value={rec.name} label="Copiar" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1">Valor</p>
                  <p className="text-xs font-mono text-white/80 break-all leading-relaxed">{rec.value}</p>
                </div>
                {!rec.value.includes('(') && <CopyButton value={rec.value} label="Copiar" />}
              </div>
              <p className="text-[11px] text-white/30 flex items-start gap-1.5">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-white/25" />
                {rec.note}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/8"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <AlertCircle className="w-3.5 h-3.5 text-yellow-400/60 flex-shrink-0" />
        <p className="text-xs text-white/30">Los cambios DNS pueden tardar entre 30 min y 48 horas en propagarse globalmente</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ArtistDomainManager({ artistId }: Props) {
  const [showGuide, setShowGuide] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['artist-domains', artistId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/artist-domain/${artistId}`);
      return (res.domains ?? []) as ArtistDomain[];
    },
    refetchInterval: (q) => {
      const domains = q.state.data ?? [];
      return domains.some((d: ArtistDomain) => d.status === 'pending') ? 6000 : false;
    },
    staleTime: 30_000,
  });

  const domains = data ?? [];
  const activeDomains = domains.filter(d => d.status === 'active');

  return (
    <>
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="domain-guide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0d0d12,#191924)' }}
              onClick={e => e.stopPropagation()}
            >
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/8 rounded-t-2xl"
                style={{ background: 'rgba(13,13,18,0.96)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/15">
                    <Globe className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-widest uppercase text-indigo-400">Guía</p>
                    <h3 className="text-base font-bold text-white leading-tight">My Domain — Como funciona</h3>
                  </div>
                </div>
                <button onClick={() => setShowGuide(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {GUIDE_ITEMS.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3 p-3 rounded-xl border border-white/6"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${item.color}20` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="px-5 py-4 border-t border-white/8">
                <p className="text-[10px] text-gray-500 text-center">
                  Registro via Namecheap · Email via Resend.com · DNS propagacion 24-48h
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: 'linear-gradient(145deg, rgba(17,17,27,0.9), rgba(10,10,18,0.95))' }}
      >
        <div className="px-5 py-4 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
                <Globe className="w-[18px] h-[18px] text-indigo-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">My Domain</h3>
                <p className="text-xs text-white/35 mt-0.5">Gestiona tu dominio profesional de artista</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeDomains.length > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-xs border">
                  {activeDomains.length} activo{activeDomains.length > 1 ? 's' : ''}
                </Badge>
              )}
              <button onClick={() => setShowGuide(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/35 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                title="Como funciona">
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {domains.length > 0 && (
            <div className="mt-3.5 flex flex-wrap gap-2">
              {domains.map(d => (
                <span key={d.domain}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border font-medium ${STATUS_CONFIG[d.status]?.color ?? 'bg-white/8 text-white/45 border-white/10'}`}>
                  <Globe className="w-3 h-3" />
                  {d.domain}
                  {d.status === 'pending' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-white/25" />
            </div>
          ) : (
            <Tabs defaultValue="find">
              <TabsList className="grid grid-cols-3 w-full rounded-xl h-10 p-1 mb-5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {[
                  { value: 'find', label: 'Buscar' },
                  { value: 'manage', label: 'Gestionar' },
                  { value: 'email', label: 'Email' },
                ].map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value}
                    className="rounded-lg text-xs font-semibold text-white/45 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="find" className="mt-0">
                <FindBuyTab artistId={artistId} />
              </TabsContent>
              <TabsContent value="manage" className="mt-0">
                <ManageTab artistId={artistId} domains={domains} />
              </TabsContent>
              <TabsContent value="email" className="mt-0">
                <EmailSetupTab domains={domains} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="px-5 py-3 border-t border-white/6 flex items-center justify-between">
          <p className="text-[10px] text-white/20">Dominios · Registrado via Namecheap</p>
          <div className="flex items-center gap-1.5">
            <Send className="w-3 h-3 text-orange-400/60" />
            <span className="text-[10px] text-white/25">Email via Resend.com</span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
