import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  Nfc,
  Sparkles,
  Plus,
  Loader2,
  ShoppingBag,
  Rocket,
  Package,
  Wand2,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  ImagePlus,
  Truck,
  Mail,
  Wallet,
  Send,
  Trash2,
  Link2,
  CalendarDays,
  Inbox,
  RefreshCw,
  Plug,
  Globe,
  Maximize2,
  Minimize2,
  Upload,
  Pencil,
  Info,
  Gift,
  ShieldCheck,
  TrendingUp,
  Users,
  Clock,
  Zap,
  Megaphone,
  Target,
  Store,
  ArrowRight,
} from 'lucide-react';
import { getAuthToken } from '../../lib/firebase';

interface SmartMerchColors {
  hexPrimary: string;
  hexAccent: string;
  hexBorder: string;
}

// Renders modal content into document.body so `position: fixed` overlays are
// anchored to the viewport, not to any transformed/parallax ancestor (the artist
// profile card uses transforms, which otherwise break fixed-position centering).
function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

interface SmartMerchModuleProps {
  artistId: number;
  artistName?: string;
  isOwner?: boolean;
  colors: SmartMerchColors;
  cardStyles?: string;
  cardStyleInline?: React.CSSProperties;
}

interface SmartProduct {
  id: number;
  artist_id: number;
  title: string;
  description?: string;
  category: string;
  image_url?: string;
  presale_price: string | number;
  currency?: string;
  min_presale_units: number;
  max_presale_units?: number;
  sold_units: number;
  artist_profit_pct: string | number;
  platform_profit_pct: string | number;
  management_type?: string;
  nfc_enabled: boolean;
  qr_enabled: boolean;
  unlock_type: string;
  is_example: boolean;
  is_published: boolean;
  status: string;
  fulfillment_unlocked: boolean;
  estimated_lead_days: number;
  linked_event_id?: number | null;
  fulfillment_provider?: string | null;
  unlock_payload?: any;
}

interface SupplierRow {
  id: number;
  supplier_name: string;
  provider_key?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  regions?: string | null;
  notes?: string | null;
  fulfillment_mode?: string | null;
  website?: string | null;
  api_connected?: boolean;
}

interface SupplierCatalogItem {
  key: string;
  name: string;
  kind: string;
  website?: string;
  regions?: string;
  apiReady?: boolean;
  note?: string;
}

interface EventLite {
  id: number;
  title: string;
  status: string;
  starts_at?: string | null;
  venue?: string | null;
  location?: string | null;
}

interface ThreadRow {
  id: number;
  concert_id?: number | null;
  buyer_email: string;
  buyer_name?: string | null;
  subject?: string | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  artist_unread?: number;
  status?: string;
  source?: 'merch' | 'event';
  event_title?: string | null;
}

interface MessageRow {
  id: number;
  sender_role: 'buyer' | 'artist' | 'system';
  body: string;
  created_at: string;
}

interface PayoutRow {
  id: number;
  amount: string | number;
  currency: string;
  method?: string | null;
  account?: string | null;
  status: string;
  reference?: string | null;
  requested_at?: string | null;
  paid_at?: string | null;
}

interface PayoutData {
  balance: {
    lifetimeEarned: number;
    paidOut: number;
    pending: number;
    available: number;
    currency: string;
  };
  method: { payoutMethod?: string | null; payoutAccount?: string | null };
  payouts: PayoutRow[];
}

interface ContractState {
  accepted: boolean;
  version?: string | null;
  currentVersion?: string;
  upToDate?: boolean;
  acceptedAt?: string | null;
  signerName?: string | null;
}

interface ManageData {
  products: SmartProduct[];
  summary: {
    paid_orders: string | number;
    paid_units: string | number;
    gross_revenue: string | number;
    artist_profit: string | number;
    platform_profit: string | number;
  } | null;
  suppliers: Array<{
    id: number;
    supplier_name: string;
    contact_email?: string;
    contact_phone?: string;
  }> & SupplierRow[];
  config: {
    artistProfitPct: number;
    managedArtistPct?: number;
    selfUploadArtistPct?: number;
    contractVersion?: string;
  };
  heroImageUrl?: string | null;
  contract?: ContractState;
}

async function authedInit(method: string, body?: unknown): Promise<RequestInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // cookie auth fallback
  }
  return {
    method,
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

function money(val?: string | number | null, currency = 'usd') {
  const n = Number(val ?? 0);
  if (!Number.isFinite(n)) return '—';
  const symbol = currency.toLowerCase() === 'eur' ? '€' : '$';
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(n: string | number) {
  return `${Number(n).toFixed(0)}%`;
}

function ProductCard({ product, accent, onBuy, isOwner, onPublish, onGenerateImage, generatingImage, onOpenDetail, onEdit }: {
  product: SmartProduct;
  accent: string;
  onBuy: (p: SmartProduct) => void;
  isOwner: boolean;
  onPublish: (id: number) => void;
  onGenerateImage: (p: SmartProduct) => void;
  generatingImage: boolean;
  onOpenDetail: (p: SmartProduct) => void;
  onEdit: (p: SmartProduct) => void;
}) {
  const sold = Number(product.sold_units || 0);
  const target = Math.max(1, Number(product.min_presale_units || 1));
  const progress = Math.min(100, (sold / target) * 100);
  const ready = !!product.fulfillment_unlocked;
  const isSelfUpload = product.management_type === 'artist_uploaded';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0f0f16', border: `1px solid ${accent}33` }}>
      <div className="relative aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => onOpenDetail(product)}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <Package className="w-8 h-8" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          {product.nfc_enabled && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#111827d1', color: '#a5b4fc' }}>NFC</span>}
          {product.qr_enabled && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#111827d1', color: '#93c5fd' }}>QR</span>}
          {product.is_example && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#111827d1', color: '#fcd34d' }}>AI</span>}
        </div>
        {isOwner && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: '#111827d1', color: isSelfUpload ? '#86efac' : '#fbcfe8' }}>
            {isSelfUpload ? 'My product' : 'Boostify'}
          </span>
        )}
        {isOwner && (
          <button
            onClick={(e) => { e.stopPropagation(); onGenerateImage(product); }}
            disabled={generatingImage}
            title="Generate an AI image using the artist identity"
            className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: '#0b0b12e6', color: accent, border: `1px solid ${accent}55` }}>
            {generatingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {generatingImage ? 'Generating…' : (product.image_url ? 'Regenerate AI' : 'Generate AI image')}
          </button>
        )}
      </div>

      <div className="p-3 space-y-2">
        <h4 className="text-sm font-bold text-white truncate cursor-pointer hover:underline" onClick={() => onOpenDetail(product)}>{product.title}</h4>
        <p className="text-[11px] text-gray-400 line-clamp-2">{product.description || 'Interactive physical product with smart unlock.'}</p>
        {product.linked_event_id ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-sky-300"><CalendarDays className="h-3 w-3" /> Linked to a show</span>
        ) : null}

        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pre-order</p>
            <p className="text-base font-bold" style={{ color: accent }}>{money(product.presale_price, product.currency || 'usd')}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500">{isOwner ? 'You earn' : 'Artist share'}</p>
            <p className="text-xs font-semibold text-white">{pct(product.artist_profit_pct)}</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span>{sold}/{target} units</span>
            <span>{ready ? 'Ready to ship' : 'Pre-order phase'}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: accent }} />
          </div>
        </div>

        <button
          onClick={() => onOpenDetail(product)}
          className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border"
          style={{ borderColor: `${accent}55`, color: accent, background: '#0b0b1255' }}>
          <Info className="h-3.5 w-3.5" /> View details
        </button>

        {!isOwner && product.is_published && product.status === 'presale_live' && (
          <button onClick={() => onBuy(product)} className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: accent, color: '#000' }}>
            <ShoppingBag className="h-3.5 w-3.5" /> Join the pre-order
          </button>
        )}

        {isOwner && (
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(product)} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border" style={{ borderColor: `${accent}55`, color: '#fff', background: '#0b0b1255' }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {!product.is_published && (
              <button onClick={() => onPublish(product.id)} className="flex-1 py-2 rounded-lg text-xs font-semibold" style={{ background: accent, color: '#000' }}>
                Publish
              </button>
            )}
            {ready && <span className="text-xs text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({ product, accent, onClose }: { product: SmartProduct; accent: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setErr('Name and email are required');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/smart-merch/products/${product.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ buyerName: name.trim(), buyerEmail: email.trim(), quantity: Math.max(1, Number(quantity) || 1) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not start payment');
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Could not start payment');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#13131a', border: `1px solid ${accent}44` }} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b" style={{ borderColor: `${accent}22` }}>
          <h3 className="text-base font-bold text-white">Pre-order checkout</h3>
          <p className="text-xs text-gray-400 mt-1">Shipping unlocks once the minimum units are reached.</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="p-3 rounded-lg" style={{ background: `${accent}14` }}>
            <p className="text-sm font-semibold text-white">{product.title}</p>
            <p className="text-xs text-gray-300 mt-1">{money(product.presale_price, product.currency || 'usd')} per unit</p>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" type="number" min={1}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          {err && <p className="text-xs text-red-400 inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}
          <button onClick={submit} disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: accent, color: '#000' }}>
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Redirecting…</span> : 'Continue to secure payment'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface DirectorySupplierUI {
  name: string;
  email: string;
  website: string;
  kind: string;
  regions: string[];
  moq: string;
  leadDays: string;
  note: string;
}

interface DirectoryEntry extends DirectorySupplierUI {
  category: string;
}

// Owner-only section: suggests 3+ real manufacturing suppliers matched to the
// product category and lets the artist send a Request-for-Quote (RFQ) by email.
// Delivery via Resend/Brevo; a copy of every request and all supplier replies
// is routed to the operator inbox (convoycubano@gmail.com) on the backend.
function ProductSuppliers({ product, accent }: { product: SmartProduct; accent: string }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<{ suppliers: DirectorySupplierUI[]; copyEmail?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [qty, setQty] = useState<number>(Math.max(1, Number(product.min_presale_units || 50)));
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = async () => {
    if (data || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/smart-merch/${product.artist_id}/products/${product.id}/suppliers/suggested`, await authedInit('GET'));
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Could not load suppliers');
      setData({ suppliers: json.suppliers || [], copyEmail: json.copyEmail });
    } catch (e: any) {
      setLoadError(e.message || 'Could not load suppliers');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load suppliers as soon as the product detail opens (section starts open).
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const startContact = (s: DirectorySupplierUI) => {
    setActiveKey(s.name);
    setEmailDraft(s.email || '');
    setNote('');
    setResult(null);
  };

  const sendQuote = async (s: DirectorySupplierUI) => {
    const to = emailDraft.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      setResult({ ok: false, msg: 'Please enter a valid supplier email.' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(
        `/api/smart-merch/${product.artist_id}/products/${product.id}/suppliers/contact`,
        await authedInit('POST', { supplierName: s.name, supplierEmail: to, estimatedQuantity: qty, message: note.trim() || undefined }),
      );
      const json = await res.json();
      if (!res.ok || !json.sent) throw new Error(json?.error || 'The email could not be sent');
      setResult({ ok: true, msg: `Quote request sent via ${json.provider || 'email'} — a copy went to ${json.copyEmail || 'the operator inbox'}.` });
      setActiveKey(null);
    } catch (e: any) {
      setResult({ ok: false, msg: e.message || 'The email could not be sent' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
      <button onClick={toggle} className="w-full flex items-center justify-between p-3 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: accent }}>
          <Truck className="h-3.5 w-3.5" /> Suppliers &amp; request a quote
        </span>
        <span className="text-gray-500 text-xs">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-xs text-gray-400 leading-relaxed">
            Real manufacturing partners matched to this product. Send a quote request by email — replies and a copy of every request are forwarded to your operations inbox.
          </p>

          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-xs py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading suppliers…</div>
          )}
          {loadError && <p className="text-xs text-red-400">{loadError}</p>}

          {data?.suppliers?.map((s) => (
            <div key={s.name} className="rounded-lg p-2.5" style={{ background: '#11161f', border: `1px solid ${accent}1f` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-gray-400">{s.kind}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">MOQ: {s.moq} · Lead: {s.leadDays} · {s.regions.join(', ')}</p>
                </div>
                <a href={s.website} target="_blank" rel="noreferrer" className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/10" style={{ color: accent }} title="Visit website">
                  <Globe className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">{s.note}</p>

              {activeKey === s.name ? (
                <div className="mt-2.5 space-y-2 rounded-md p-2.5" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide">Supplier email (editable)</label>
                    <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="sales@supplier.com"
                      className="w-full mt-1 px-2.5 py-1.5 rounded-md bg-black/40 text-white text-xs border border-white/10 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide">Est. quantity</label>
                    <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-md bg-black/40 text-white text-xs border border-white/10 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide">Note (optional)</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything specific about materials, colors, deadline…"
                      className="w-full mt-1 px-2.5 py-1.5 rounded-md bg-black/40 text-white text-xs border border-white/10 focus:outline-none resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => sendQuote(s)} disabled={sending} className="flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60" style={{ background: accent, color: '#000' }}>
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send quote request
                    </button>
                    <button onClick={() => setActiveKey(null)} className="px-3 py-1.5 rounded-md text-xs font-semibold border" style={{ borderColor: `${accent}44`, color: '#fff' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => startContact(s)} className="mt-2 w-full py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 border" style={{ borderColor: `${accent}55`, color: accent, background: '#0b0b1255' }}>
                  <Mail className="h-3.5 w-3.5" /> Request a quote
                </button>
              )}
            </div>
          ))}

          {result && (
            <p className={`text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>{result.msg}</p>
          )}
          {data?.copyEmail && (
            <p className="text-[10px] text-gray-500">A copy of every request and all replies go to {data.copyEmail}.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ProductDetailModal({ product, accent, isOwner, onClose, onBuy, onEdit, onPublish, onGenerateImage, generatingImage }: {
  product: SmartProduct;
  accent: string;
  isOwner: boolean;
  onClose: () => void;
  onBuy: (p: SmartProduct) => void;
  onEdit: (p: SmartProduct) => void;
  onPublish: (id: number) => void;
  onGenerateImage: (p: SmartProduct) => void;
  generatingImage: boolean;
}) {
  const sold = Number(product.sold_units || 0);
  const target = Math.max(1, Number(product.min_presale_units || 1));
  const progress = Math.min(100, (sold / target) * 100);
  const ready = !!product.fulfillment_unlocked;
  const isSelf = product.management_type === 'artist_uploaded';
  const leadDays = Number(product.estimated_lead_days || 0);

  // unlock_payload may arrive as a JSON string or an object
  const payload = useMemo(() => {
    const raw = product.unlock_payload;
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return { headline: raw }; }
    }
    return raw;
  }, [product.unlock_payload]);
  const rewardText: string | null = payload?.reward || payload?.headline || null;

  const benefits = [
    { icon: TrendingUp, label: 'You earn per unit', value: `${pct(product.artist_profit_pct)} ≈ ${money((Number(product.presale_price) || 0) * Number(product.artist_profit_pct) / 100, product.currency || 'usd')}` },
    { icon: ShieldCheck, label: 'Business model', value: isSelf ? 'Your own product (you manage it)' : 'Managed by Boostify (we produce & ship)' },
    { icon: Wallet, label: 'Payouts', value: 'Paid out transparently via Stripe' },
  ];

  const indications = [
    { icon: Users, label: 'Goal', value: `${sold}/${target} pre-orders ${ready ? '· goal reached' : 'to unlock production'}` },
    { icon: Truck, label: 'Production starts', value: ready ? 'Now — minimum reached' : `When ${target} units are reserved` },
    leadDays > 0 ? { icon: Clock, label: 'Estimated lead time', value: `~${leadDays} days after the goal is met` } : null,
    product.linked_event_id ? { icon: CalendarDays, label: 'Linked event', value: 'Tied to a live show — fans get it at the concert' } : null,
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <div className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[92vh] overflow-y-auto" style={{ background: '#13131a', border: `1px solid ${accent}44` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b sticky top-0 z-10" style={{ borderColor: `${accent}22`, background: '#13131a' }}>
          <h3 className="text-base font-bold text-white truncate pr-2">{product.title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 flex-shrink-0"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {/* Visual */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-xl overflow-hidden" style={{ background: '#0f0f16', border: `1px solid ${accent}22` }}>
              {product.image_url ? (
                <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600"><Package className="w-12 h-12" /></div>
              )}
              <div className="absolute top-2 left-2 flex gap-1">
                {product.nfc_enabled && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#111827d1', color: '#a5b4fc' }}>NFC</span>}
                {product.qr_enabled && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#111827d1', color: '#93c5fd' }}>QR</span>}
                {product.is_example && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#111827d1', color: '#fcd34d' }}>AI</span>}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: `${accent}14`, border: `1px solid ${accent}22` }}>
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pre-order price</p>
                <p className="text-2xl font-bold" style={{ color: accent }}>{money(product.presale_price, product.currency || 'usd')}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{ready ? 'Status' : 'Progress'}</p>
                <p className="text-sm font-semibold text-white">{ready ? 'Ready to ship' : `${Math.round(progress)}% funded`}</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: accent }} />
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1.5" style={{ color: accent }}><Info className="h-3.5 w-3.5" /> Description</p>
              <p className="text-sm text-gray-300 leading-relaxed">{product.description || 'Interactive physical product with a smart NFC/QR unlock that connects the fan to exclusive content.'}</p>
            </div>

            {rewardText && (
              <div className="p-3 rounded-xl" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: accent }}><Gift className="h-3.5 w-3.5" /> What the fan unlocks</p>
                <p className="text-sm text-gray-200">{rewardText}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: accent }}><Sparkles className="h-3.5 w-3.5" /> Benefits for the artist</p>
              <div className="space-y-2">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <b.icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                    <div>
                      <p className="text-xs text-gray-400">{b.label}</p>
                      <p className="text-sm text-white font-medium">{b.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: accent }}><CheckCircle2 className="h-3.5 w-3.5" /> How it works & indications</p>
              <div className="space-y-2">
                {(product.nfc_enabled || product.qr_enabled) && (
                  <div className="flex items-start gap-2.5">
                    <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                    <div>
                      <p className="text-xs text-gray-400">Smart unlock</p>
                      <p className="text-sm text-white font-medium">{product.nfc_enabled && product.qr_enabled ? 'Tap the NFC chip or scan the QR' : product.nfc_enabled ? 'Tap the NFC chip' : 'Scan the QR code'} to reveal exclusive content</p>
                    </div>
                  </div>
                )}
                {indications.map((ind, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <ind.icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                    <div>
                      <p className="text-xs text-gray-400">{ind.label}</p>
                      <p className="text-sm text-white font-medium">{ind.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isOwner && <ProductSuppliers product={product} accent={accent} />}

            {/* Actions */}
            <div className="pt-1 space-y-2">
              {!isOwner && product.is_published && product.status === 'presale_live' && (
                <button onClick={() => { onBuy(product); onClose(); }} className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ background: accent, color: '#000' }}>
                  <ShoppingBag className="h-4 w-4" /> Join the pre-order
                </button>
              )}
              {isOwner && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { onEdit(product); onClose(); }} className="py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border" style={{ borderColor: `${accent}55`, color: '#fff', background: '#0b0b1255' }}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => onGenerateImage(product)} disabled={generatingImage} className="py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border disabled:opacity-60" style={{ borderColor: `${accent}55`, color: accent, background: '#0b0b1255' }}>
                    {generatingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {product.image_url ? 'Regenerate AI' : 'AI image'}
                  </button>
                  {!product.is_published && (
                    <button onClick={() => { onPublish(product.id); onClose(); }} className="col-span-2 py-2 rounded-lg text-xs font-semibold" style={{ background: accent, color: '#000' }}>
                      Publish pre-order
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CreateProductModal({ artistId, accent, onClose, onSaved, managedArtistPct, selfUploadArtistPct, events, suppliers, editProduct }: {
  artistId: number;
  accent: string;
  onClose: () => void;
  onSaved: () => void;
  managedArtistPct: number;
  selfUploadArtistPct: number;
  events: EventLite[];
  suppliers: SupplierRow[];
  editProduct?: SmartProduct | null;
}) {
  const isEdit = !!editProduct;
  const [title, setTitle] = useState(editProduct?.title || '');
  const [description, setDescription] = useState(editProduct?.description || '');
  const [category, setCategory] = useState(editProduct?.category || 'wearable');
  const [imageUrl, setImageUrl] = useState(editProduct?.image_url || '');
  const [presalePrice, setPresalePrice] = useState(editProduct ? String(editProduct.presale_price ?? '79') : '79');
  const [minUnits, setMinUnits] = useState(editProduct ? String(editProduct.min_presale_units ?? '50') : '50');
  const [managementType, setManagementType] = useState<'boostify_managed' | 'artist_uploaded'>(
    (editProduct?.management_type as any) || 'boostify_managed',
  );
  const [linkedEventId, setLinkedEventId] = useState(editProduct?.linked_event_id ? String(editProduct.linked_event_id) : '');
  const [fulfillmentProvider, setFulfillmentProvider] = useState(editProduct?.fulfillment_provider || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isSelf = managementType === 'artist_uploaded';
  const artistShare = isSelf ? selfUploadArtistPct : managedArtistPct;
  const platformShare = 100 - artistShare;

  const handleUpload = async (file: File) => {
    if (!isEdit || !editProduct) {
      setErr('Save the product first, then you can upload an image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErr('Image must be 8MB or smaller.');
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/smart-merch/products/${editProduct.id}/upload-image`, await authedInit('POST', { image: dataUrl }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Upload failed');
      setImageUrl(json.imageUrl || json.product?.image_url || imageUrl);
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      setErr('Title is required');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (isEdit && editProduct) {
        const res = await fetch(`/api/smart-merch/${editProduct.id}`, await authedInit('PUT', {
          title: title.trim(),
          description,
          category,
          imageUrl: imageUrl || null,
          presalePrice: Number(presalePrice),
          minPresaleUnits: Number(minUnits),
          managementType,
          linkedEventId: linkedEventId ? Number(linkedEventId) : null,
          fulfillmentProvider: fulfillmentProvider || null,
        }));
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || json.error || 'Could not save changes');
        onSaved();
        onClose();
        return;
      }
      const res = await fetch('/api/smart-merch', await authedInit('POST', {
        artistId,
        title: title.trim(),
        description,
        category,
        imageUrl: imageUrl || null,
        presalePrice: Number(presalePrice),
        minPresaleUnits: Number(minUnits),
        managementType,
        linkedEventId: linkedEventId ? Number(linkedEventId) : null,
        fulfillmentProvider: fulfillmentProvider || null,
        nfcEnabled: true,
        qrEnabled: true,
      }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Could not create product');
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: '#13131a', border: `1px solid ${accent}44` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: `${accent}22` }}>
          <h3 className="text-base font-bold text-white">{isEdit ? 'Edit product' : 'New smart product'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          {/* Business model */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">Business model</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setManagementType('boostify_managed')}
                className="text-left p-2.5 rounded-lg border transition"
                style={{ background: !isSelf ? `${accent}1c` : '#0b0b12', borderColor: !isSelf ? accent : '#ffffff1a' }}>
                <p className="text-xs font-semibold text-white">Managed by Boostify</p>
                <p className="text-[10px] text-gray-400 mt-0.5">We produce and ship. You earn {managedArtistPct}%.</p>
              </button>
              <button type="button" onClick={() => setManagementType('artist_uploaded')}
                className="text-left p-2.5 rounded-lg border transition"
                style={{ background: isSelf ? `${accent}1c` : '#0b0b12', borderColor: isSelf ? accent : '#ffffff1a' }}>
                <p className="text-xs font-semibold text-white">My own product</p>
                <p className="text-[10px] text-gray-400 mt-0.5">You manage it. Boostify takes {100 - selfUploadArtistPct}%, you earn {selfUploadArtistPct}%.</p>
              </button>
            </div>
          </div>

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product title"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
              <option value="wearable">Wearable</option>
              <option value="collectible">Collectible</option>
              <option value="vinyl">Vinyl</option>
              <option value="poster">Poster</option>
              <option value="accessory">Accessory</option>
              <option value="other">Other</option>
            </select>
            <input value={presalePrice} onChange={(e) => setPresalePrice(e.target.value)} placeholder="Pre-order price" type="number"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={minUnits} onChange={(e) => setMinUnits(e.target.value)} placeholder="Minimum units" type="number"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          </div>

          {/* Upload your own product image (non-AI) */}
          <div className="rounded-lg p-3" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="preview" className="h-12 w-12 rounded-lg object-cover flex-shrink-0" style={{ border: `1px solid ${accent}33` }} />
                ) : (
                  <div className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#13131a', border: `1px solid ${accent}33` }}>
                    <Package className="h-5 w-5 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Upload your own photo</p>
                  <p className="text-[10px] text-gray-500">{isEdit ? 'JPG / PNG / WebP up to 8MB.' : 'Save the product first, then upload.'}</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.currentTarget.value = ''; }}
              />
              <button
                type="button"
                disabled={!isEdit || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                style={{ background: `${accent}1c`, color: accent, border: `1px solid ${accent}55` }}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>

          {/* Ecosystem links: concert event + fulfillment supplier */}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="text-[11px] text-gray-400 inline-flex items-center gap-1 mb-1"><CalendarDays className="h-3 w-3" /> Link to a show (ticket ↔ merch)</label>
              <select value={linkedEventId} onChange={(e) => setLinkedEventId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
                <option value="">No linked event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}{ev.venue ? ` · ${ev.venue}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 inline-flex items-center gap-1 mb-1"><Truck className="h-3 w-3" /> Fulfillment supplier</label>
              <select value={fulfillmentProvider} onChange={(e) => setFulfillmentProvider(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
                <option value="">Boostify default fulfillment</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.provider_key || s.supplier_name}>{s.supplier_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Transparent commission breakdown */}
          <div className="rounded-lg p-3 text-[11px]" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">You earn</span>
              <span className="font-semibold text-emerald-400">{artistShare}% ≈ {money((Number(presalePrice) || 0) * artistShare / 100, 'usd')}/unit</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-400">{isSelf ? 'Boostify commission' : 'Boostify'}</span>
              <span className="font-semibold text-white">{platformShare}% ≈ {money((Number(presalePrice) || 0) * platformShare / 100, 'usd')}/unit</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">Payments and revenue split are handled transparently by Stripe.</p>
          </div>
          {err && <p className="text-xs text-red-400 inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}
          <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: accent, color: '#000' }}>
            {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : (isEdit ? 'Save changes' : 'Create draft')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ContractModal({ artistId, accent, terms, onClose, onAccepted }: {
  artistId: number;
  accent: string;
  terms: { managedArtistPct: number; selfUploadArtistPct: number };
  onClose: () => void;
  onAccepted: () => void;
}) {
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const managedPlatform = 100 - terms.managedArtistPct;
  const selfCommission = 100 - terms.selfUploadArtistPct;

  const submit = async () => {
    if (!signerName.trim()) { setErr('Type your full name to sign'); return; }
    if (!agree) { setErr('You must accept the terms to continue'); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/contract/accept`,
        await authedInit('POST', { signerName: signerName.trim(), signerEmail: signerEmail.trim() }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not accept the contract');
      onAccepted();
      onClose();
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: '#13131a', border: `1px solid ${accent}55` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: `${accent}22` }}>
          <h3 className="text-base font-bold text-white inline-flex items-center gap-2"><FileText className="h-4 w-4" style={{ color: accent }} /> Smart Merch contract</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3 text-xs text-gray-300 leading-relaxed">
          <p className="text-gray-400">Merchandising agreement between the artist and Boostify for the Smart Merch Engine module. Read and sign it to start publishing products.</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li><span className="text-white font-semibold">Boostify-managed products.</span> Boostify designs, produces, stores and ships. The artist earns <span className="text-emerald-400 font-semibold">{terms.managedArtistPct}%</span> of net profit and Boostify {managedPlatform}%.</li>
            <li><span className="text-white font-semibold">Artist-owned products.</span> The artist uploads and manages their own products; Boostify charges a <span className="text-white font-semibold">{selfCommission}%</span> management fee and the artist earns <span className="text-emerald-400 font-semibold">{terms.selfUploadArtistPct}%</span>.</li>
            <li><span className="text-white font-semibold">Payments.</span> All charges, refunds and revenue split are handled transparently through Stripe. Boostify settles the artist share according to the current payout schedule.</li>
            <li><span className="text-white font-semibold">Pre-order and production.</span> Production and shipping are triggered only when each product reaches its minimum units. If not reached, orders may be refunded.</li>
            <li><span className="text-white font-semibold">NFC/QR activations.</span> Each unit includes a unique serial and activation URL to unlock exclusive artist content.</li>
            <li><span className="text-white font-semibold">Ownership and licensing.</span> The artist declares they hold the rights to their identity, logo and images and authorizes their use to generate the store's promotional material.</li>
          </ol>
          <input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Full name (signature)"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="Email (optional)" type="email"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span className="text-[11px] text-gray-300">I have read and accept the Smart Merch contract terms and confirm I hold the rights to the products and identity used.</span>
          </label>
          {err && <p className="text-xs text-red-400 inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}
          <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: accent, color: '#000' }}>
            {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Signing…</span> : 'Accept and sign contract'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Suppliers panel (owner) ─────────────────────────────────────────────────
function SuppliersPanel({ artistId, accent, suppliers, onChanged }: {
  artistId: number;
  accent: string;
  suppliers: SupplierRow[];
  onChanged: () => void;
}) {
  const [providerKey, setProviderKey] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [regions, setRegions] = useState('');
  const [notes, setNotes] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [fulfillmentMode, setFulfillmentMode] = useState('manual');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: catalogData } = useQuery<{ providers: SupplierCatalogItem[] }>({
    queryKey: ['smart-merch-suppliers-catalog'],
    queryFn: async () => {
      const res = await fetch('/api/smart-merch/suppliers/catalog', { credentials: 'include' });
      if (!res.ok) return { providers: [] };
      return res.json();
    },
    staleTime: 600000,
  });
  const providers = catalogData?.providers || [];
  const selectedProvider = providers.find((p) => p.key === providerKey);

  // Curated supplier directory (real partners + verified contact emails).
  const { data: directoryData } = useQuery<{ suppliers: DirectoryEntry[]; copyEmail?: string }>({
    queryKey: ['smart-merch-suppliers-directory'],
    queryFn: async () => {
      const res = await fetch('/api/smart-merch/suppliers/directory', { credentials: 'include' });
      if (!res.ok) return { suppliers: [] };
      return res.json();
    },
    staleTime: 600000,
  });
  const directory = directoryData?.suppliers || [];
  const connectedNames = new Set(suppliers.map((s) => (s.supplier_name || '').toLowerCase()));
  const [connectingKey, setConnectingKey] = useState<string | null>(null);

  const connectFromDirectory = async (d: DirectoryEntry) => {
    setConnectingKey(`${d.name}|${d.category}`);
    setErr(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/suppliers`, await authedInit('POST', {
        supplierName: d.name,
        contactEmail: d.email || undefined,
        regions: (d.regions || []).join(', ') || undefined,
        notes: `${d.kind} · MOQ ${d.moq} · Lead ${d.leadDays}. ${d.note}`,
        fulfillmentMode: 'manual',
        website: d.website,
      }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not connect supplier');
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setConnectingKey(null);
    }
  };

  const connect = async () => {
    if (!providerKey && !supplierName.trim()) { setErr('Choose a provider or enter a supplier name'); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/suppliers`, await authedInit('POST', {
        providerKey: providerKey || undefined,
        supplierName: supplierName.trim() || selectedProvider?.name,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        regions: regions.trim() || undefined,
        notes: notes.trim() || undefined,
        fulfillmentMode,
        website: selectedProvider?.website,
        apiKey: apiKey.trim() || undefined,
      }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not connect supplier');
      setProviderKey(''); setSupplierName(''); setContactName(''); setContactEmail('');
      setContactPhone(''); setRegions(''); setNotes(''); setApiKey('');
      onChanged();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/smart-merch/${artistId}/suppliers/${id}`, await authedInit('DELETE'));
    if (res.ok) onChanged();
  };

  return (
    <div className="space-y-4">
      {/* Connected suppliers */}
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Connected suppliers</p>
        {suppliers.length === 0 ? (
          <div className="rounded-xl p-4 text-center" style={{ background: '#0b0f16', border: `1px dashed ${accent}33` }}>
            <Truck className="h-6 w-6 mx-auto text-gray-500" />
            <p className="text-xs text-gray-400 mt-2">No suppliers connected yet. Connect a fulfillment partner below.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {suppliers.map((s) => (
              <div key={s.id} className="rounded-xl p-3 flex items-start justify-between gap-2" style={{ background: '#0f0f16', border: `1px solid ${accent}22` }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.supplier_name}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{s.fulfillment_mode || 'manual'} fulfillment{s.regions ? ` · ${s.regions}` : ''}</p>
                  {s.contact_email && <p className="text-[11px] text-gray-500 truncate">{s.contact_email}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {s.api_connected && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><Plug className="h-3 w-3" /> API linked</span>}
                    {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-sky-300"><Globe className="h-3 w-3" /> Site</a>}
                  </div>
                </div>
                <button onClick={() => remove(s.id)} title="Remove supplier" className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended suppliers (curated directory with verified contacts) */}
      <div>
        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Recommended suppliers</p>
        <p className="text-[11px] text-gray-500 mb-2">Real manufacturing partners with verified contact emails. Connect one with a single click, then request quotes from any product.</p>
        {directory.length === 0 ? (
          <div className="rounded-xl p-4 text-center" style={{ background: '#0b0f16', border: `1px dashed ${accent}33` }}>
            <Loader2 className="h-4 w-4 mx-auto text-gray-500 animate-spin" />
            <p className="text-xs text-gray-400 mt-2">Loading recommended suppliers…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {directory.map((d) => {
              const already = connectedNames.has(d.name.toLowerCase());
              const key = `${d.name}|${d.category}`;
              return (
                <div key={key} className="rounded-xl p-3" style={{ background: '#0f0f16', border: `1px solid ${accent}22` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{d.name}</p>
                      <p className="text-[11px] text-gray-400 capitalize">{d.category} · {d.kind}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">MOQ: {d.moq} · Lead: {d.leadDays} · {d.regions.join(', ')}</p>
                      {d.email ? (
                        <p className="text-[11px] text-sky-300 truncate mt-0.5">{d.email}</p>
                      ) : (
                        <p className="text-[11px] text-gray-500 mt-0.5">Contact via website</p>
                      )}
                    </div>
                    <a href={d.website} target="_blank" rel="noreferrer" className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/10" style={{ color: accent }} title="Visit website">
                      <Globe className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <button
                    onClick={() => connectFromDirectory(d)}
                    disabled={already || connectingKey === key}
                    className="mt-2 w-full py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 border disabled:opacity-60"
                    style={{ borderColor: `${accent}55`, color: already ? '#34d399' : accent, background: '#0b0b1255' }}>
                    {already ? <><CheckCircle2 className="h-3.5 w-3.5" /> Connected</> : connectingKey === key ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…</> : <><Link2 className="h-3.5 w-3.5" /> Connect</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {directoryData?.copyEmail && (
          <p className="text-[10px] text-gray-500 mt-1.5">Quote requests &amp; replies are also copied to {directoryData.copyEmail}.</p>
        )}
      </div>

      {/* Connect a new supplier */}
      <div className="rounded-xl p-4" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
        <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Connect a supplier</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select value={providerKey} onChange={(e) => { setProviderKey(e.target.value); const p = providers.find(x => x.key === e.target.value); if (p) setSupplierName(p.name); }}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
            <option value="">Choose a provider…</option>
            {providers.map((p) => (
              <option key={p.key} value={p.key}>{p.name}{p.apiReady ? ' (API)' : ''}</option>
            ))}
          </select>
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email" type="email"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={regions} onChange={(e) => setRegions(e.target.value)} placeholder="Shipping regions (e.g. US, EU)"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <select value={fulfillmentMode} onChange={(e) => setFulfillmentMode(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
            <option value="manual">Manual fulfillment</option>
            <option value="api">API fulfillment (print-on-demand)</option>
            <option value="dropship">Dropship</option>
          </select>
          {selectedProvider?.apiReady && (
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={`${selectedProvider.name} API key (optional)`} type="password"
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          )}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (lead times, MOQ, pricing…)" rows={2}
          className="w-full px-3 py-2 mt-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
        {selectedProvider?.note && <p className="text-[10px] text-gray-500 mt-1.5">{selectedProvider.note}</p>}
        {err && <p className="text-xs text-red-400 inline-flex items-center gap-1 mt-2"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}
        <button onClick={connect} disabled={saving} className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2" style={{ background: accent, color: '#000' }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {saving ? 'Connecting…' : 'Connect supplier'}
        </button>
      </div>
    </div>
  );
}

// ─── Messages panel (owner unified inbox: tickets + merch) ────────────────────
function MessagesPanel({ artistId, accent }: { artistId: number; accent: string }) {
  const qc = useQueryClient();
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const { data: inbox, isLoading, refetch } = useQuery<{ threads: ThreadRow[] }>({
    queryKey: ['smart-merch-messages', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/${artistId}/messages`, await authedInit('GET'));
      if (!res.ok) return { threads: [] };
      return res.json();
    },
    staleTime: 15000,
  });
  const threads = inbox?.threads || [];

  const { data: thread } = useQuery<{ thread: ThreadRow; messages: MessageRow[] }>({
    queryKey: ['smart-merch-thread', artistId, openThreadId],
    enabled: openThreadId != null,
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/${artistId}/messages/${openThreadId}`, await authedInit('GET'));
      if (!res.ok) return { thread: {} as ThreadRow, messages: [] };
      return res.json();
    },
  });

  const sendReply = async () => {
    if (!reply.trim() || openThreadId == null) return;
    setSending(true);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/messages/${openThreadId}/reply`, await authedInit('POST', { message: reply.trim() }));
      if (res.ok) {
        setReply('');
        qc.invalidateQueries({ queryKey: ['smart-merch-thread', artistId, openThreadId] });
        qc.invalidateQueries({ queryKey: ['smart-merch-messages', artistId] });
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
      {/* Thread list */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
        <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: `${accent}1a` }}>
          <span className="text-xs font-semibold text-gray-300 inline-flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" /> Inbox</span>
          <button onClick={() => refetch()} className="p-1 rounded text-gray-500 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>
          ) : threads.length === 0 ? (
            <p className="text-xs text-gray-500 p-4 text-center">No messages yet. Buyers who order merch or tickets will appear here.</p>
          ) : (
            threads.map((t) => (
              <button key={t.id} onClick={() => setOpenThreadId(t.id)}
                className="w-full text-left px-3 py-2.5 border-b transition hover:bg-white/5"
                style={{ borderColor: '#ffffff0a', background: openThreadId === t.id ? `${accent}14` : 'transparent' }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white truncate">{t.buyer_name || t.buyer_email}</span>
                  {!!t.artist_unread && <span className="shrink-0 px-1.5 rounded-full text-[9px] font-bold" style={{ background: accent, color: '#000' }}>{t.artist_unread}</span>}
                </div>
                <p className="text-[11px] text-gray-500 truncate">{t.last_message_preview || '—'}</p>
                <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: t.source === 'event' ? '#1e3a5f' : '#3f2a1e', color: t.source === 'event' ? '#93c5fd' : '#fbbf24' }}>
                  {t.source === 'event' ? (t.event_title || 'Event') : 'Merch'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread detail */}
      <div className="rounded-xl flex flex-col min-h-[360px]" style={{ background: '#0f0f16', border: `1px solid ${accent}22` }}>
        {openThreadId == null ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <Mail className="h-7 w-7 text-gray-600" />
            <p className="text-xs text-gray-500 mt-2">Select a conversation to read and reply.</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b" style={{ borderColor: `${accent}1a` }}>
              <p className="text-sm font-semibold text-white">{thread?.thread?.buyer_name || thread?.thread?.buyer_email}</p>
              <p className="text-[11px] text-gray-500">{thread?.thread?.buyer_email}</p>
            </div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[300px]">
              {(thread?.messages || []).map((m) => (
                <div key={m.id} className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${m.sender_role === 'artist' ? 'ml-auto' : ''}`}
                  style={{
                    background: m.sender_role === 'artist' ? `${accent}22` : m.sender_role === 'system' ? '#10231a' : '#1a1a22',
                    color: '#e5e7eb',
                  }}>
                  <p className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">{m.sender_role === 'system' ? 'System' : m.sender_role === 'artist' ? 'You' : 'Buyer'}</p>
                  {m.body}
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex items-center gap-2" style={{ borderColor: `${accent}1a` }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                placeholder="Type your reply…" className="flex-1 px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
              <button onClick={sendReply} disabled={sending || !reply.trim()} className="p-2.5 rounded-lg disabled:opacity-50" style={{ background: accent, color: '#000' }}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Payouts panel (owner) ───────────────────────────────────────────────────
function PayoutsPanel({ artistId, accent }: { artistId: number; accent: string }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState('');
  const [account, setAccount] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data, isLoading } = useQuery<PayoutData>({
    queryKey: ['smart-merch-payouts', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/${artistId}/payouts`, await authedInit('GET'));
      if (!res.ok) {
        return { balance: { lifetimeEarned: 0, paidOut: 0, pending: 0, available: 0, currency: 'usd' }, method: {}, payouts: [] };
      }
      return res.json();
    },
    staleTime: 20000,
  });

  if (data && !initialized) {
    if (data.method?.payoutMethod) setMethod(data.method.payoutMethod);
    if (data.method?.payoutAccount) setAccount(data.method.payoutAccount);
    setInitialized(true);
  }

  const saveMethod = async () => {
    setSavingMethod(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/payout-method`, await authedInit('PUT', { payoutMethod: method, payoutAccount: account }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Could not save payout method');
      setMsg('Payout method saved.');
      qc.invalidateQueries({ queryKey: ['smart-merch-payouts', artistId] });
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSavingMethod(false);
    }
  };

  const requestPayout = async () => {
    setRequesting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/payouts/request`, await authedInit('POST', {}));
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || 'Could not request payout');
      setMsg('Payout requested. Boostify will process it shortly.');
      qc.invalidateQueries({ queryKey: ['smart-merch-payouts', artistId] });
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setRequesting(false);
    }
  };

  const bal = data?.balance;

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Available</p>
              <p className="text-base font-bold text-emerald-400 mt-1">{money(bal?.available, bal?.currency)}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Lifetime earned</p>
              <p className="text-sm font-semibold text-white mt-1">{money(bal?.lifetimeEarned, bal?.currency)}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pending</p>
              <p className="text-sm font-semibold text-amber-400 mt-1">{money(bal?.pending, bal?.currency)}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Paid out</p>
              <p className="text-sm font-semibold text-white mt-1">{money(bal?.paidOut, bal?.currency)}</p>
            </div>
          </div>

          {/* Payout method */}
          <div className="rounded-xl p-4" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Payout method</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select value={method} onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
                <option value="">Select method…</option>
                <option value="paypal">PayPal</option>
                <option value="bank">Bank transfer</option>
                <option value="stripe">Stripe Connect</option>
                <option value="wise">Wise</option>
              </select>
              <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Account / email / IBAN"
                className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={saveMethod} disabled={savingMethod} className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-2" style={{ background: '#1f2937', color: '#e5e7eb', border: `1px solid ${accent}33` }}>
                {savingMethod ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />} Save method
              </button>
              <button onClick={requestPayout} disabled={requesting || !bal?.available} className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-2" style={{ background: accent, color: '#000' }}>
                {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Request payout
              </button>
            </div>
            {msg && <p className="text-[11px] text-gray-300 mt-2">{msg}</p>}
            <p className="text-[10px] text-gray-500 mt-2">Minimum payout is $20. Payouts are settled by Boostify from your available balance.</p>
          </div>

          {/* History */}
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Payout history</p>
            {(data?.payouts || []).length === 0 ? (
              <p className="text-xs text-gray-500">No payouts yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data!.payouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: '#0f0f16', border: `1px solid ${accent}1a` }}>
                    <span className="text-white font-semibold">{money(p.amount, p.currency)}</span>
                    <span className="text-gray-400 capitalize">{p.method || '—'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.status === 'paid' ? 'text-emerald-400' : p.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── CRM / Smart Campaigns panel (owner) ─────────────────────────────────────
// Markets Smart Merch products to the fans who bought tickets (or merch),
// pulling the audience live from the concert ticketing module and sending
// AI-drafted emails through Resend.
interface AudienceData {
  ticketBuyers: number;
  merchBuyers: number;
  byEvent: { concertId: number | null; title: string; fans: number }[];
}
interface CampaignRow {
  id: number;
  name: string;
  subject: string;
  message: string;
  audience: string;
  status: string;
  product_id?: number | null;
  product_title?: string | null;
  product_image?: string | null;
  concert_id?: number | null;
  event_title?: string | null;
  discount_code?: string | null;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  sent_at?: string | null;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all_ticket_buyers: 'All ticket buyers',
  specific_event: 'Buyers of one show',
  merch_buyers: 'Past merch buyers',
  all_fans: 'All fans (tickets + merch)',
};

function CrmCampaignsPanel({ artistId, accent, products, events }: {
  artistId: number;
  accent: string;
  products: SmartProduct[];
  events: EventLite[];
}) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const { data: audience } = useQuery<AudienceData>({
    queryKey: ['smart-merch-crm-audience', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/${artistId}/crm/audience`, await authedInit('GET'));
      if (!res.ok) return { ticketBuyers: 0, merchBuyers: 0, byEvent: [] };
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: campaignsData, isLoading } = useQuery<{ campaigns: CampaignRow[] }>({
    queryKey: ['smart-merch-crm-campaigns', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/${artistId}/crm/campaigns`, await authedInit('GET'));
      if (!res.ok) return { campaigns: [] };
      return res.json();
    },
    staleTime: 15000,
  });
  const campaigns = campaignsData?.campaigns || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['smart-merch-crm-campaigns', artistId] });
    qc.invalidateQueries({ queryKey: ['smart-merch-crm-audience', artistId] });
  };

  const sendCampaign = async (id: number) => {
    setSendingId(id);
    setBanner(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/crm/campaigns/${id}/send`, await authedInit('POST', {}));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not send campaign');
      setBanner(`Campaign sent · ${json.sent} delivered${json.failed ? `, ${json.failed} failed` : ''}.`);
      invalidate();
    } catch (e: any) {
      setBanner(e.message);
    } finally {
      setSendingId(null);
    }
  };

  const deleteCampaign = async (id: number) => {
    const res = await fetch(`/api/smart-merch/${artistId}/crm/campaigns/${id}`, await authedInit('DELETE'));
    if (res.ok) invalidate();
  };

  const totalFans = (audience?.ticketBuyers || 0);

  return (
    <div className="space-y-4">
      {/* Audience overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide inline-flex items-center gap-1"><Target className="h-3 w-3" /> Ticket buyers</p>
          <p className="text-base font-bold text-white mt-1">{audience?.ticketBuyers ?? 0}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide inline-flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Merch buyers</p>
          <p className="text-base font-bold text-white mt-1">{audience?.merchBuyers ?? 0}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Shows w/ fans</p>
          <p className="text-base font-bold text-white mt-1">{audience?.byEvent?.length ?? 0}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide inline-flex items-center gap-1"><Megaphone className="h-3 w-3" /> Campaigns</p>
          <p className="text-base font-bold text-white mt-1">{campaigns.length}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-400">Promote your products to the fans who bought tickets to your shows.</p>
        <button onClick={() => { setShowCreate(true); setBanner(null); }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
          style={{ background: accent, color: '#000' }}>
          <Plus className="h-3.5 w-3.5" /> New campaign
        </button>
      </div>

      {banner && (
        <div className="rounded-lg px-3 py-2 text-xs text-gray-200" style={{ background: '#0b0f16', border: `1px solid ${accent}33` }}>{banner}</div>
      )}

      {/* Campaign list */}
      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} /></div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: '#0b0f16', border: `1px dashed ${accent}33` }}>
          <Megaphone className="h-7 w-7 mx-auto text-gray-500" />
          <p className="text-sm text-gray-300 mt-2">No campaigns yet</p>
          <p className="text-xs text-gray-500 mt-1">Create a smart campaign to promote a product to your ticket buyers.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const isSent = c.status === 'sent';
            const isSending = c.status === 'sending' || sendingId === c.id;
            return (
              <div key={c.id} className="rounded-xl p-3" style={{ background: '#0f0f16', border: `1px solid ${accent}22` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{c.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                        style={{ background: isSent ? '#07140d' : '#1a1206', color: isSent ? '#34d399' : '#fbbf24', border: `1px solid ${isSent ? '#10b98144' : '#f59e0b44'}` }}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{c.subject}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px] text-gray-500">
                      <span className="inline-flex items-center gap-1"><Target className="h-3 w-3" /> {AUDIENCE_LABELS[c.audience] || c.audience}{c.event_title ? ` · ${c.event_title}` : ''}</span>
                      {c.product_title && <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> {c.product_title}</span>}
                      {c.discount_code && <span className="inline-flex items-center gap-1"><Gift className="h-3 w-3" /> {c.discount_code}</span>}
                    </div>
                    {isSent && (
                      <p className="text-[11px] text-gray-400 mt-1.5">Reached {c.sent_count}/{c.recipients_count} fans{c.failed_count ? ` · ${c.failed_count} failed` : ''}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><Users className="h-3 w-3" /> {c.recipients_count} fans</span>
                    {!isSent && (
                      <button onClick={() => sendCampaign(c.id)} disabled={isSending}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 disabled:opacity-60"
                        style={{ background: accent, color: '#000' }}>
                        {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} {isSending ? 'Sending…' : 'Send now'}
                      </button>
                    )}
                    {!isSent && (
                      <button onClick={() => deleteCampaign(c.id)} title="Delete" className="p-1 rounded text-gray-500 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <ModalPortal>
        <CampaignModal
          artistId={artistId}
          accent={accent}
          products={products}
          events={events}
          audience={audience}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); invalidate(); }}
        />
        </ModalPortal>
      )}
    </div>
  );
}

function CampaignModal({ artistId, accent, products, events, audience, onClose, onSaved }: {
  artistId: number;
  accent: string;
  products: SmartProduct[];
  events: EventLite[];
  audience?: AudienceData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const publishedProducts = useMemo(() => products.filter((p) => p.is_published || p.status === 'presale_live'), [products]);
  const [name, setName] = useState('');
  const [productId, setProductId] = useState<string>(publishedProducts[0] ? String(publishedProducts[0].id) : '');
  const [audienceType, setAudienceType] = useState('all_ticket_buyers');
  const [concertId, setConcertId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reach = useMemo(() => {
    if (audienceType === 'merch_buyers') return audience?.merchBuyers ?? 0;
    if (audienceType === 'all_fans') return (audience?.ticketBuyers ?? 0) + (audience?.merchBuyers ?? 0);
    if (audienceType === 'specific_event') {
      const ev = audience?.byEvent?.find((e) => String(e.concertId) === concertId);
      return ev?.fans ?? 0;
    }
    return audience?.ticketBuyers ?? 0;
  }, [audienceType, concertId, audience]);

  const aiDraft = async () => {
    setDrafting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/crm/ai-draft`, await authedInit('POST', {
        productId: productId ? Number(productId) : null,
        concertId: audienceType === 'specific_event' && concertId ? Number(concertId) : null,
        audience: audienceType,
      }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not draft copy');
      setSubject(json.subject || subject);
      setMessage(json.message || message);
      if (!name.trim() && json.subject) setName(json.subject.slice(0, 60));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDrafting(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) {
      setErr('Name, subject and message are required');
      return;
    }
    if (audienceType === 'specific_event' && !concertId) {
      setErr('Choose which show’s buyers to target');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/crm/campaigns`, await authedInit('POST', {
        name: name.trim(),
        subject: subject.trim(),
        message: message.trim(),
        audience: audienceType,
        productId: productId ? Number(productId) : null,
        concertId: audienceType === 'specific_event' && concertId ? Number(concertId) : null,
        discountCode: discountCode.trim() || null,
      }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not create campaign');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: '#13131a', border: `1px solid ${accent}44` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: `${accent}22` }}>
          <h3 className="text-base font-bold text-white inline-flex items-center gap-2"><Megaphone className="h-4 w-4" style={{ color: accent }} /> New smart campaign</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name (internal)"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />

          {/* Product to promote */}
          <div>
            <label className="text-[11px] text-gray-400 inline-flex items-center gap-1 mb-1"><Package className="h-3 w-3" /> Product to promote</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
              <option value="">No specific product (store link)</option>
              {publishedProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Audience */}
          <div>
            <label className="text-[11px] text-gray-400 inline-flex items-center gap-1 mb-1"><Target className="h-3 w-3" /> Audience</label>
            <select value={audienceType} onChange={(e) => setAudienceType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
              <option value="all_ticket_buyers">All ticket buyers ({audience?.ticketBuyers ?? 0})</option>
              <option value="specific_event">Buyers of a specific show</option>
              <option value="merch_buyers">Past merch buyers ({audience?.merchBuyers ?? 0})</option>
              <option value="all_fans">All fans · tickets + merch</option>
            </select>
          </div>

          {audienceType === 'specific_event' && (
            <select value={concertId} onChange={(e) => setConcertId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }}>
              <option value="">Choose a show…</option>
              {(audience?.byEvent?.length ? audience.byEvent.map((e) => ({ id: e.concertId, title: e.title, fans: e.fans })) : events.map((e) => ({ id: e.id, title: e.title, fans: undefined as number | undefined }))).map((ev) => (
                <option key={String(ev.id)} value={String(ev.id)}>{ev.title}{ev.fans != null ? ` · ${ev.fans} fans` : ''}</option>
              ))}
            </select>
          )}

          <div className="rounded-lg px-3 py-2 text-[11px] text-gray-300 inline-flex items-center gap-1.5 w-full" style={{ background: `${accent}14`, border: `1px solid ${accent}33` }}>
            <Users className="h-3.5 w-3.5" style={{ color: accent }} /> This campaign will reach <span className="font-semibold text-white">{reach}</span> fans.
          </div>

          {/* AI draft */}
          <button onClick={aiDraft} disabled={drafting}
            className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border disabled:opacity-60"
            style={{ borderColor: `${accent}55`, color: accent, background: '#0b0b1255' }}>
            {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {drafting ? 'Writing…' : 'AI: write the email for me'}
          </button>

          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Email message to your fans…" rows={6}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Fan discount code (optional)"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />

          {err && <p className="text-xs text-red-400 inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{err}</p>}
          <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ background: accent, color: '#000' }}>
            {saving ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : 'Save campaign'}
          </button>
          <p className="text-[10px] text-gray-500 text-center">Saved as a draft — review it, then hit “Send now” to deliver via Resend.</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function SmartMerchModule({ artistId, artistName, isOwner = false, colors, cardStyles, cardStyleInline }: SmartMerchModuleProps) {
  const accent = colors.hexAccent;
  const qc = useQueryClient();

  const [checkoutTarget, setCheckoutTarget] = useState<SmartProduct | null>(null);
  const [detailTarget, setDetailTarget] = useState<SmartProduct | null>(null);
  const [editTarget, setEditTarget] = useState<SmartProduct | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [generatingExamples, setGeneratingExamples] = useState(false);
  const [generatingHero, setGeneratingHero] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'crm' | 'suppliers' | 'messages' | 'payouts'>('products');

  const listKey = ['smart-merch', artistId, isOwner ? 'manage' : 'public'];

  const { data, isLoading } = useQuery<ManageData | { products: SmartProduct[]; heroImageUrl?: string | null }>({
    queryKey: listKey,
    queryFn: async () => {
      const url = isOwner ? `/api/smart-merch/${artistId}/manage` : `/api/smart-merch/${artistId}`;
      const res = await fetch(url, isOwner ? await authedInit('GET') : { credentials: 'include' });
      if (!res.ok) {
        if (isOwner) {
          return { products: [], summary: null, suppliers: [], config: { artistProfitPct: 30 } } as ManageData;
        }
        return { products: [] };
      }
      return res.json();
    },
    staleTime: 30000,
  });

  const products = useMemo(() => (data as any)?.products || [], [data]);

  // Keep the open detail modal in sync after refreshes (e.g. AI image generated)
  useEffect(() => {
    if (!detailTarget) return;
    const fresh = products.find((p: SmartProduct) => p.id === detailTarget.id);
    if (fresh && fresh !== detailTarget) setDetailTarget(fresh);
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = (isOwner ? (data as ManageData)?.summary : null) || null;
  const managedArtistPct = isOwner ? ((data as ManageData)?.config?.managedArtistPct ?? (data as ManageData)?.config?.artistProfitPct ?? 30) : 30;
  const selfUploadArtistPct = isOwner ? ((data as ManageData)?.config?.selfUploadArtistPct ?? 70) : 70;
  const heroImageUrl = (data as any)?.heroImageUrl as string | null | undefined;
  const contract = (isOwner ? (data as ManageData)?.contract : undefined) as ContractState | undefined;
  const contractAccepted = !!contract?.accepted;
  const suppliers: SupplierRow[] = (isOwner ? (data as ManageData)?.suppliers : []) || [];

  // Artist events (to link products to shows) — owner only
  const { data: eventsData } = useQuery<{ events: EventLite[] }>({
    queryKey: ['smart-merch-events', artistId],
    enabled: isOwner,
    queryFn: async () => {
      const res = await fetch(`/api/smart-merch/${artistId}/events`, await authedInit('GET'));
      if (!res.ok) return { events: [] };
      return res.json();
    },
    staleTime: 60000,
  });
  const events: EventLite[] = eventsData?.events || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: listKey });

  const requireContract = (): boolean => {
    if (isOwner && !contractAccepted) {
      setShowContract(true);
      return false;
    }
    return true;
  };

  const publishProduct = async (id: number) => {
    const res = await fetch(`/api/smart-merch/${id}/publish`, await authedInit('POST'));
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.error === 'contract_required') { setShowContract(true); return; }
      alert(json.message || json.error || 'Could not publish product');
      return;
    }
    invalidate();
  };

  const generateExamples = async () => {
    if (!requireContract()) return;
    setGeneratingExamples(true);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/generate-examples`, await authedInit('POST', { artistName: artistName || 'Artist' }));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not generate the catalog');
      invalidate();
      // Images are generated in the background — poll a few times so they appear.
      if (json.generatingImages) {
        let attempts = 0;
        const poll = setInterval(() => {
          attempts += 1;
          invalidate();
          if (attempts >= 6) clearInterval(poll);
        }, 6000);
      }
    } catch (e: any) {
      alert(e.message || 'Could not generate the catalog');
    } finally {
      setGeneratingExamples(false);
    }
  };

  const generateHero = async () => {
    setGeneratingHero(true);
    try {
      const res = await fetch(`/api/smart-merch/${artistId}/hero-image/generate`, await authedInit('POST', {}));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not generate the cover');
      invalidate();
    } catch (e: any) {
      alert(e.message || 'Could not generate the cover');
    } finally {
      setGeneratingHero(false);
    }
  };

  const generateProductImage = async (p: SmartProduct) => {
    setGeneratingImageId(p.id);
    try {
      const res = await fetch(`/api/smart-merch/products/${p.id}/generate-image`, await authedInit('POST', {}));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not generate the image');
      invalidate();
    } catch (e: any) {
      alert(e.message || 'Could not generate the image');
    } finally {
      setGeneratingImageId(null);
    }
  };

  const onCreateClick = () => {
    if (!requireContract()) return;
    setShowCreate(true);
  };

  if (!isOwner && !isLoading && products.length === 0 && !heroImageUrl) return null;

  // Visitor (non-logged-in) experience: show an elegant cover + a small preview,
  // and reveal the full catalog only inside the fullscreen storefront.
  const isVisitor = !isOwner;
  const VISITOR_PREVIEW = 4;
  const storeCover = heroImageUrl || (products.find((p: SmartProduct) => p.image_url) as SmartProduct | undefined)?.image_url || null;
  const visibleProducts: SmartProduct[] = isVisitor && !isFullscreen ? products.slice(0, VISITOR_PREVIEW) : products;
  const hiddenCount = isVisitor && !isFullscreen ? Math.max(0, products.length - VISITOR_PREVIEW) : 0;

  const fullscreenBtn = (
    <button
      onClick={() => setIsFullscreen((v) => !v)}
      title={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
      style={{ background: '#1f2937', color: '#e5e7eb', border: `1px solid ${accent}33` }}>
      {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      {isFullscreen ? 'Exit' : 'Fullscreen'}
    </button>
  );

  return (
    <div
      className={isFullscreen ? 'fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6' : cardStyles}
      style={isFullscreen ? { background: '#0a0a0f' } : cardStyleInline}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${accent}1c` }}>
            <Sparkles className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">BOOSTIFY SMART MERCH ENGINE</h3>
            <p className="text-[11px] text-gray-400">NFC/QR physical drops, threshold pre-orders, unlock activations.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isOwner && (
            <>
              <button onClick={generateHero} disabled={generatingHero}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                style={{ background: '#1f2937', color: '#e5e7eb', border: `1px solid ${accent}33` }}>
                {generatingHero ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                AI cover
              </button>
              <button onClick={generateExamples} disabled={generatingExamples}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                style={{ background: '#1f2937', color: '#e5e7eb', border: `1px solid ${accent}33` }}>
                {generatingExamples ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Generate full catalog (AI)
              </button>
              <button onClick={onCreateClick}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                style={{ background: accent, color: '#000' }}>
                <Plus className="h-3.5 w-3.5" /> New product
              </button>
            </>
          )}
          {fullscreenBtn}
        </div>
      </div>

      {/* Owner tab navigation */}
      {isOwner && (
        <div className="flex items-center gap-1 mb-4 p-1 rounded-xl overflow-x-auto" style={{ background: '#0b0f16', border: `1px solid ${accent}22` }}>
          {([
            { key: 'products', label: 'Products', icon: Package },
            { key: 'crm', label: 'Campaigns', icon: Megaphone },
            { key: 'suppliers', label: 'Suppliers', icon: Truck },
            { key: 'messages', label: 'Messages', icon: Mail },
            { key: 'payouts', label: 'Payouts', icon: Wallet },
          ] as const).map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition"
                style={{ background: active ? accent : 'transparent', color: active ? '#000' : '#9ca3af' }}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Hero banner (AI generated: Boostify brand + artist identity).
          For visitors it doubles as the clickable entry into the fullscreen store. */}
      {(!isOwner || activeTab === 'products') && (() => {
        const cover = isVisitor ? storeCover : heroImageUrl;
        if (cover) {
          const clickable = isVisitor && !isFullscreen;
          const Wrapper: any = clickable ? 'button' : 'div';
          return (
            <Wrapper
              onClick={clickable ? () => setIsFullscreen(true) : undefined}
              className={`group relative block w-full text-left rounded-2xl overflow-hidden mb-4 ${clickable ? 'cursor-pointer' : ''}`}
              style={{ border: `1px solid ${accent}33` }}>
              <img
                src={cover}
                alt="Boostify Smart Merch"
                className={`w-full object-cover transition-transform duration-700 ${clickable ? 'h-52 md:h-72 group-hover:scale-105' : 'h-40 md:h-52'}`}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.12) 100%)' }} />
              <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-center max-w-[80%]">
                <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>Smart Merch Engine</span>
                <h4 className="text-lg md:text-2xl font-extrabold text-white leading-tight mt-1">{artistName || 'Artist'} · Smart store</h4>
                <p className="text-[11px] md:text-xs text-gray-300 mt-1">Physical products with NFC and QR that unlock exclusive experiences.</p>
                {clickable && (
                  <span
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full text-xs font-bold w-fit shadow-lg transition-all group-hover:gap-3"
                    style={{ background: accent, color: '#000' }}>
                    <Store className="h-3.5 w-3.5" /> Enter store{products.length ? ` · ${products.length} ${products.length === 1 ? 'product' : 'products'}` : ''}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </Wrapper>
          );
        }
        if (isOwner) {
          return (
            <div className="rounded-2xl mb-4 p-4 flex items-center justify-between gap-3" style={{ background: '#0b0f16', border: `1px dashed ${accent}33` }}>
              <div className="flex items-center gap-2">
                <ImagePlus className="h-5 w-5" style={{ color: accent }} />
                <p className="text-xs text-gray-300">Generate an AI cover with the Boostify brand and your artist identity.</p>
              </div>
              <button onClick={generateHero} disabled={generatingHero}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 shrink-0"
                style={{ background: accent, color: '#000' }}>
                {generatingHero ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                Generate cover
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Contract status (owner only) */}
      {isOwner && (
        <div className="rounded-xl mb-4 p-3 flex items-center justify-between gap-3"
          style={{ background: contractAccepted ? '#07140d' : '#1a1206', border: `1px solid ${contractAccepted ? '#10b98144' : '#f59e0b55'}` }}>
          <div className="flex items-center gap-2">
            {contractAccepted
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : <AlertCircle className="h-4 w-4 text-amber-400" />}
            <p className="text-xs text-gray-200">
              {contractAccepted
                ? <>Smart Merch contract signed{contract?.signerName ? ` by ${contract.signerName}` : ''}.</>
                : <>You must sign the Smart Merch contract before publishing products.</>}
            </p>
          </div>
          <button onClick={() => setShowContract(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            style={{ background: contractAccepted ? '#111827' : accent, color: contractAccepted ? '#e5e7eb' : '#000', border: contractAccepted ? `1px solid ${accent}33` : 'none' }}>
            <FileText className="h-3.5 w-3.5" /> {contractAccepted ? 'View contract' : 'Sign contract'}
          </button>
        </div>
      )}

      {isOwner && activeTab === 'products' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Managed · you</p>
            <p className="text-sm font-semibold text-white mt-1">{pct(managedArtistPct)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Units sold</p>
            <p className="text-sm font-semibold text-white mt-1">{Number(summary?.paid_units || 0)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Gross</p>
            <p className="text-sm font-semibold text-white mt-1">{money(summary?.gross_revenue || 0)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: '#0f172a', border: `1px solid ${accent}22` }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Artist profit</p>
            <p className="text-sm font-semibold text-white mt-1">{money(summary?.artist_profit || 0)}</p>
          </div>
        </div>
      )}

      {/* Owner panels for non-product tabs */}
      {isOwner && activeTab === 'crm' && (
        <CrmCampaignsPanel artistId={artistId} accent={accent} products={products} events={events} />
      )}
      {isOwner && activeTab === 'suppliers' && (
        <SuppliersPanel artistId={artistId} accent={accent} suppliers={suppliers} onChanged={invalidate} />
      )}
      {isOwner && activeTab === 'messages' && (
        <MessagesPanel artistId={artistId} accent={accent} />
      )}
      {isOwner && activeTab === 'payouts' && (
        <PayoutsPanel artistId={artistId} accent={accent} />
      )}

      {(!isOwner || activeTab === 'products') && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? (
          <div className="col-span-full py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" style={{ color: accent }} /></div>
        ) : products.length === 0 ? (
          <div className="col-span-full py-10 text-center rounded-xl" style={{ background: '#0b0f16', border: `1px dashed ${accent}33` }}>
            <Package className="h-8 w-8 mx-auto text-gray-500" />
            <p className="text-sm text-gray-300 mt-2">No Smart Merch products yet</p>
            <p className="text-xs text-gray-500 mt-1">Create drafts, launch pre-orders and unlock shipping once the threshold is reached.</p>
          </div>
        ) : (
          visibleProducts.map((p: SmartProduct) => (
            <ProductCard
              key={p.id}
              product={p}
              accent={accent}
              onBuy={setCheckoutTarget}
              isOwner={isOwner}
              onPublish={publishProduct}
              onGenerateImage={generateProductImage}
              generatingImage={generatingImageId === p.id}
              onOpenDetail={setDetailTarget}
              onEdit={setEditTarget}
            />
          ))
        )}
      </div>
      )}

      {/* Visitor: invite to open the full storefront instead of stacking every product */}
      {isVisitor && !isFullscreen && products.length > 0 && (
        <button
          onClick={() => setIsFullscreen(true)}
          className="group mt-4 w-full rounded-2xl px-5 py-4 flex items-center justify-between gap-3 transition"
          style={{ background: `linear-gradient(90deg, ${accent}1f, transparent)`, border: `1px solid ${accent}44` }}>
          <span className="flex items-center gap-3 text-left">
            <span className="p-2 rounded-xl shrink-0" style={{ background: `${accent}22` }}>
              <Store className="h-5 w-5" style={{ color: accent }} />
            </span>
            <span>
              <span className="block text-sm font-bold text-white">Explore the full store</span>
              <span className="block text-[11px] text-gray-400">
                {hiddenCount > 0
                  ? `+${hiddenCount} more ${hiddenCount === 1 ? 'product' : 'products'} · open the elegant fullscreen storefront`
                  : 'Open the elegant fullscreen storefront'}
              </span>
            </span>
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold shrink-0 transition group-hover:gap-3" style={{ background: accent, color: '#000' }}>
            Enter store <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      )}

      {(isOwner ? activeTab === 'products' : isFullscreen) && (
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="rounded-lg p-3" style={{ background: '#111827', border: `1px solid ${accent}22` }}>
          <div className="flex items-center gap-2 text-xs text-gray-300 font-semibold"><QrCode className="h-4 w-4" /> QR activation</div>
          <p className="text-[11px] text-gray-500 mt-1">Every paid unit gets an activation URL and a unique serial.</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#111827', border: `1px solid ${accent}22` }}>
          <div className="flex items-center gap-2 text-xs text-gray-300 font-semibold"><Nfc className="h-4 w-4" /> NFC unlock</div>
          <p className="text-[11px] text-gray-500 mt-1">Tap the physical merch to unlock exclusive content or rewards.</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#111827', border: `1px solid ${accent}22` }}>
          <div className="flex items-center gap-2 text-xs text-gray-300 font-semibold"><Rocket className="h-4 w-4" /> Pre-order logistics</div>
          <p className="text-[11px] text-gray-500 mt-1">Shipping starts only when the minimum number of units is sold.</p>
        </div>
      </div>
      )}

      <AnimatePresence>
        {checkoutTarget && <ModalPortal><CheckoutModal product={checkoutTarget} accent={accent} onClose={() => setCheckoutTarget(null)} /></ModalPortal>}
        {detailTarget && (
          <ModalPortal>
          <ProductDetailModal
            product={detailTarget}
            accent={accent}
            isOwner={isOwner}
            onClose={() => setDetailTarget(null)}
            onBuy={setCheckoutTarget}
            onEdit={setEditTarget}
            onPublish={publishProduct}
            onGenerateImage={generateProductImage}
            generatingImage={generatingImageId === detailTarget.id}
          />
          </ModalPortal>
        )}
        {(showCreate || editTarget) && (
          <ModalPortal>
          <CreateProductModal
            artistId={artistId}
            accent={accent}
            managedArtistPct={managedArtistPct}
            selfUploadArtistPct={selfUploadArtistPct}
            events={events}
            suppliers={suppliers}
            editProduct={editTarget}
            onClose={() => { setShowCreate(false); setEditTarget(null); }}
            onSaved={invalidate}
          />
          </ModalPortal>
        )}
        {showContract && (
          <ModalPortal>
          <ContractModal
            artistId={artistId}
            accent={accent}
            terms={{ managedArtistPct, selfUploadArtistPct }}
            onClose={() => setShowContract(false)}
            onAccepted={invalidate}
          />
          </ModalPortal>
        )}
      </AnimatePresence>
    </div>
  );
}
