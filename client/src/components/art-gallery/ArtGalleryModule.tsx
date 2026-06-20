/**
 * ArtGalleryModule
 *
 * Galería de Arte para artistas visuales — cuadros, pinturas, esculturas,
 * arte digital y artes plásticas en general.
 *
 * Tres modos de venta por obra:
 *   - Precio fijo (fixed)      : compra directa de la obra original 1/1
 *   - Subasta (auction)        : contador / cuenta regresiva + pujas en vivo
 *   - Edición tokenizada (tokenized) : copias numeradas vendidas con tokens
 *
 * Vista Fan:    explorar obras → pujar / comprar / coleccionar token
 * Vista Owner:  crear obra → subir imagen → publicar → gestionar ventas
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Palette, Gavel, Clock, Tag, Coins, Plus, X, Loader2, ImagePlus,
  CheckCircle2, ShoppingBag, TrendingUp, Hash, Sparkles, Trash2, Send,
  Eye, Award, Brush, Upload, AlertCircle, Pencil, Lock, Flame,
} from "lucide-react";
import { storage } from "../../firebase";
import { ref as fbRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuthToken } from "../../lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Artwork {
  id: number;
  artist_id: number;
  title: string;
  description?: string;
  category: string;
  medium?: string;
  dimensions?: string;
  year_created?: number;
  is_original?: boolean;
  image_url: string;
  extra_images?: string[];
  sale_mode: "fixed" | "auction" | "tokenized";
  currency?: string;
  // fixed
  price?: string | number;
  is_sold?: boolean;
  buy_payment_status?: string;
  // auction
  starting_price?: string | number;
  reserve_price?: string | number;
  min_increment?: string | number;
  buy_now_price?: string | number;
  current_bid?: string | number;
  current_bidder_name?: string;
  bid_count?: number;
  auction_start?: string;
  auction_end?: string;
  auction_settled?: boolean;
  winner_name?: string;
  winner_payment_status?: string;
  // tokenized
  edition_size?: number;
  token_price?: string | number;
  tokens_minted?: number;
  tokens_sold?: number;
  tokens_available?: number;
  // shared
  status: string;
  is_published?: boolean;
  featured?: boolean;
  views?: number;
  created_at?: string;
}

interface ArtColors { hexPrimary: string; hexAccent: string; hexBorder: string; }

interface ArtGalleryModuleProps {
  artistId: number;
  artistName?: string;
  isOwner?: boolean;
  colors: ArtColors;
  cardStyles?: string;
  cardStyleInline?: React.CSSProperties;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  painting: "Pintura",
  drawing: "Dibujo",
  sculpture: "Escultura",
  photography: "Fotografía",
  digital: "Arte digital",
  mixed: "Técnica mixta",
  print: "Grabado",
  other: "Otro",
};

const SALE_MODE_LABELS: Record<string, string> = {
  fixed: "Precio fijo",
  auction: "Subasta",
  tokenized: "Edición tokenizada",
};

function money(val?: string | number | null, currency = "usd") {
  const n = parseFloat(String(val ?? 0));
  if (isNaN(n)) return "—";
  const symbol = currency?.toLowerCase() === "eur" ? "€" : "$";
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

async function authedInit(method: string, body?: unknown): Promise<RequestInit> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* cookie auth fallback */ }
  return {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

// ─── Modal portal — escapes any transformed/parallax ancestor stacking context
// so modals always render on top of the profile section "frames". ────────────
function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

// ─── Live Countdown ─────────────────────────────────────────────────────────
function Countdown({ endsAt, accent }: { endsAt?: string; accent: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endsAt) return null;
  const remaining = new Date(endsAt).getTime() - now;
  if (remaining <= 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#ef4444" }}>
        <Clock className="h-3.5 w-3.5" /> Subasta finalizada
      </div>
    );
  }
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const urgent = remaining < 3600000; // < 1h
  const seg = (v: number, l: string) => (
    <div className="flex flex-col items-center px-1.5 py-1 rounded-md min-w-[34px]"
         style={{ background: `${accent}15`, border: `1px solid ${accent}33` }}>
      <span className="text-sm font-bold leading-none tabular-nums" style={{ color: urgent ? "#ef4444" : accent }}>
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[8px] uppercase tracking-wide text-gray-400 mt-0.5">{l}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1">
      {d > 0 && seg(d, "días")}
      {seg(h, "hrs")}
      {seg(m, "min")}
      {seg(s, "seg")}
    </div>
  );
}

// ─── Sale badge ──────────────────────────────────────────────────────────────
function SaleBadge({ art }: { art: Artwork }) {
  const map: Record<string, { label: string; icon: any; color: string }> = {
    fixed: { label: "Venta directa", icon: Tag, color: "#10b981" },
    auction: { label: "Subasta", icon: Gavel, color: "#f59e0b" },
    tokenized: { label: "Edición", icon: Coins, color: "#a855f7" },
  };
  const cfg = map[art.sale_mode] || map.fixed;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: `${cfg.color}1a`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

// ─── Buyer modal (compra / token) ────────────────────────────────────────────
function BuyerModal({ art, mode, accent, onClose }: {
  art: Artwork; mode: "buy" | "token"; accent: string; onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim()) { setErr("Nombre y email son obligatorios"); return; }
    setLoading(true); setErr(null);
    try {
      const path = mode === "token" ? "buy-token" : "buy";
      const res = await fetch(`/api/art-gallery/${art.id}/${path}`,
        await authedInit("POST", { buyerName: name.trim(), buyerEmail: email.trim() }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al iniciar el pago");
      if (data.checkoutUrl) { window.location.href = data.checkoutUrl; return; }
      onClose();
    } catch (e: any) { setErr(e.message); setLoading(false); }
  };

  const price = mode === "token"
    ? money(art.token_price, art.currency)
    : art.sale_mode === "auction"
      ? (art.auction_settled ? money(art.current_bid, art.currency) : money(art.buy_now_price, art.currency))
      : money(art.price, art.currency);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#13131a", border: `1px solid ${accent}40` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="relative h-40">
          <img src={art.image_url} alt={art.title} className="w-full h-full object-cover" />
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <h3 className="text-lg font-bold text-white">{art.title}</h3>
            <p className="text-xs text-gray-400">{CATEGORY_LABELS[art.category] || art.category}{art.medium ? ` · ${art.medium}` : ""}</p>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${accent}12` }}>
            <span className="text-xs text-gray-300">{mode === "token" ? "Precio del token" : "Total a pagar"}</span>
            <span className="text-xl font-bold" style={{ color: accent }}>{price}</span>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre completo"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none"
            style={{ borderColor: `${accent}33` }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tu email" type="email"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none"
            style={{ borderColor: `${accent}33` }} />
          {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
          <button onClick={submit} disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: accent, color: "#000" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
            Continuar al pago seguro
          </button>
          <p className="text-[10px] text-gray-500 text-center">Pago procesado de forma segura con Stripe</p>
        </div>
      </motion.div>
    </div>
    </ModalPortal>
  );
}

// ─── Bid modal (subasta) ─────────────────────────────────────────────────────
function BidModal({ art, accent, onClose, onPlaced }: {
  art: Artwork; accent: string; onClose: () => void; onPlaced: () => void;
}) {
  const current = parseFloat(String(art.current_bid ?? art.starting_price ?? 0));
  const inc = parseFloat(String(art.min_increment ?? 1)) || 1;
  const hasBids = (art.bid_count || 0) > 0;
  const minNext = hasBids ? current + inc : current;
  const [amount, setAmount] = useState<string>(String(minNext));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!name.trim()) { setErr("Tu nombre es obligatorio"); return; }
    if (!amt || amt < minNext) { setErr(`La puja mínima es ${money(minNext, art.currency)}`); return; }
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/art-gallery/${art.id}/bid`,
        await authedInit("POST", { bidderName: name.trim(), bidderEmail: email.trim() || undefined, amount: amt }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo registrar la puja");
      onPlaced(); onClose();
    } catch (e: any) { setErr(e.message); setLoading(false); }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#13131a", border: `1px solid ${accent}40` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="relative h-40">
          <img src={art.image_url} alt={art.title} className="w-full h-full object-cover" />
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
          <div className="absolute bottom-3 left-3"><Countdown endsAt={art.auction_end} accent={accent} /></div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2"><Gavel className="h-4 w-4" style={{ color: accent }} />
            <h3 className="text-lg font-bold text-white">{art.title}</h3></div>
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${accent}12` }}>
            <span className="text-xs text-gray-300">Puja actual</span>
            <span className="text-xl font-bold" style={{ color: accent }}>{money(current, art.currency)}</span>
          </div>
          <p className="text-[11px] text-gray-400">Puja mínima siguiente: <span className="font-semibold" style={{ color: accent }}>{money(minNext, art.currency)}</span></p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={minNext} step={inc}
              className="w-full pl-7 pr-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none font-semibold"
              style={{ borderColor: `${accent}33` }} />
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tu email (para avisarte si ganas)" type="email"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border text-sm text-white outline-none" style={{ borderColor: `${accent}33` }} />
          {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
          <button onClick={submit} disabled={loading}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: accent, color: "#000" }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
            Confirmar puja
          </button>
        </div>
      </motion.div>
    </div>
    </ModalPortal>
  );
}

// ─── Owner create form ───────────────────────────────────────────────────────
function CreateArtworkForm({ artistId, accent, onClose, onCreated }: {
  artistId: number; accent: string; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState<any>({
    title: "", description: "", category: "painting", medium: "", dimensions: "",
    yearCreated: "", isOriginal: true, imageUrl: "", saleMode: "fixed",
    price: "", startingPrice: "", reservePrice: "", minIncrement: "10", buyNowPrice: "",
    auctionEnd: "", editionSize: "10", tokenPrice: "", shippingFlatRate: "0",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const path = `art-gallery/${artistId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const storageRef = fbRef(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      set("imageUrl", url);
    } catch (e: any) { setErr("Error al subir la imagen: " + e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!form.title.trim()) { setErr("El título es obligatorio"); return; }
    if (!form.imageUrl) { setErr("Sube una imagen de la obra"); return; }
    if (form.saleMode === "fixed" && !form.price) { setErr("Indica el precio"); return; }
    if (form.saleMode === "auction" && (!form.startingPrice || !form.auctionEnd)) { setErr("Indica precio inicial y fecha de cierre"); return; }
    if (form.saleMode === "tokenized" && (!form.tokenPrice || !form.editionSize)) { setErr("Indica precio del token y tamaño de la edición"); return; }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/art-gallery`, await authedInit("POST", { ...form, artistId }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear la obra");
      onCreated(); onClose();
    } catch (e: any) { setErr(e.message); setSaving(false); }
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-black/40 border text-sm text-white outline-none transition-colors focus:bg-black/60 placeholder:text-gray-500";
  const borderStyle = { borderColor: `${accent}33` };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[2000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto" onClick={onClose}>
      <motion.div initial={{ scale: 0.96, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl my-4 sm:my-8 shadow-2xl flex flex-col max-h-[92vh]"
        style={{ background: "#13131a", border: `1px solid ${accent}40` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: `${accent}22`, background: `linear-gradient(180deg, ${accent}10, transparent)` }}>
          <h3 className="text-base font-bold text-white flex items-center gap-2"><Brush className="h-4 w-4" style={{ color: accent }} /> Nueva obra de arte</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {/* Image */}
          <div className="aspect-video rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer relative group/upload"
            style={{ borderColor: `${accent}40`, background: "#0a0a0f" }} onClick={() => fileRef.current?.click()}>
            {form.imageUrl ? (
              <>
                <img src={form.imageUrl} alt="preview" className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/0 group-hover/upload:bg-black/50 flex items-center justify-center transition-colors">
                  <span className="opacity-0 group-hover/upload:opacity-100 text-xs text-white font-medium flex items-center gap-1.5 transition-opacity"><ImagePlus className="h-4 w-4" /> Cambiar imagen</span>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500">
                {uploading ? <Loader2 className="h-7 w-7 animate-spin mx-auto" style={{ color: accent }} /> : <ImagePlus className="h-7 w-7 mx-auto" style={{ color: `${accent}99` }} />}
                <p className="text-xs mt-2 font-medium">{uploading ? "Subiendo…" : "Sube la imagen de tu obra"}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">JPG, PNG · alta resolución recomendada</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-400 block">Título *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="p. ej. Amanecer en cobalto" className={inputCls} style={borderStyle} />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-400 block">Descripción</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Historia, inspiración, técnica…" rows={2} className={inputCls} style={borderStyle} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400 block">Categoría</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls} style={borderStyle}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400 block">Técnica</label>
              <input value={form.medium} onChange={(e) => set("medium", e.target.value)} placeholder="Óleo, acrílico…" className={inputCls} style={borderStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400 block">Dimensiones</label>
              <input value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="80 x 100 cm" className={inputCls} style={borderStyle} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400 block">Año</label>
              <input value={form.yearCreated} onChange={(e) => set("yearCreated", e.target.value)} placeholder="2025" type="number" className={inputCls} style={borderStyle} />
            </div>
          </div>

          {/* Sale mode selector */}
          <div className="pt-1">
            <label className="text-[11px] font-medium text-gray-400 block mb-1.5">Modo de venta</label>
            <div className="grid grid-cols-3 gap-2">
              {(["fixed", "auction", "tokenized"] as const).map((m) => {
                const Icon = m === "fixed" ? Tag : m === "auction" ? Gavel : Coins;
                const active = form.saleMode === m;
                return (
                  <button key={m} onClick={() => set("saleMode", m)} type="button"
                    className="py-2.5 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all"
                    style={{ background: active ? accent : "#0a0a0f", color: active ? "#000" : "#9ca3af", border: `1px solid ${active ? accent : `${accent}22`}` }}>
                    <Icon className="h-4 w-4" /> {SALE_MODE_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode-specific fields */}
          {form.saleMode === "fixed" && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-400 block">Precio (USD) *</label>
              <input value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="1500" type="number" className={inputCls} style={borderStyle} />
            </div>
          )}
          {form.saleMode === "auction" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={form.startingPrice} onChange={(e) => set("startingPrice", e.target.value)} placeholder="Precio inicial *" type="number" className={inputCls} style={borderStyle} />
                <input value={form.reservePrice} onChange={(e) => set("reservePrice", e.target.value)} placeholder="Precio reserva (opc.)" type="number" className={inputCls} style={borderStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.minIncrement} onChange={(e) => set("minIncrement", e.target.value)} placeholder="Incremento mínimo" type="number" className={inputCls} style={borderStyle} />
                <input value={form.buyNowPrice} onChange={(e) => set("buyNowPrice", e.target.value)} placeholder="Comprar ya (opc.)" type="number" className={inputCls} style={borderStyle} />
              </div>
              <label className="text-[11px] font-medium text-gray-400 block">Cierre de la subasta (contador) *</label>
              <input value={form.auctionEnd} onChange={(e) => set("auctionEnd", e.target.value)} type="datetime-local" className={inputCls} style={borderStyle} />
            </div>
          )}
          {form.saleMode === "tokenized" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400 block">Nº de copias *</label>
                <input value={form.editionSize} onChange={(e) => set("editionSize", e.target.value)} placeholder="10" type="number" className={inputCls} style={borderStyle} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-400 block">Precio token *</label>
                <input value={form.tokenPrice} onChange={(e) => set("tokenPrice", e.target.value)} placeholder="150" type="number" className={inputCls} style={borderStyle} />
              </div>
            </div>
          )}

          {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p>}
        </div>
        <div className="p-4 border-t shrink-0" style={{ borderColor: `${accent}22` }}>
          <button onClick={submit} disabled={saving || uploading}
            className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
            style={{ background: accent, color: "#000" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear obra (borrador)
          </button>
        </div>
      </motion.div>
    </div>
    </ModalPortal>
  );
}

// ─── Artwork card ────────────────────────────────────────────────────────────
function ArtworkCard({ art, colors, isOwner, onBuy, onBid, onPublish, onDelete, onSettle, publishing }: {
  art: Artwork; colors: ArtColors; isOwner: boolean;
  onBuy: (a: Artwork, mode: "buy" | "token") => void;
  onBid: (a: Artwork) => void;
  onPublish: (a: Artwork) => void;
  onDelete: (a: Artwork) => void;
  onSettle: (a: Artwork) => void;
  publishing: number | null;
}) {
  const { hexAccent } = colors;
  const isDraft = art.status === "draft" || !art.is_published;
  const auctionLive = art.sale_mode === "auction" && art.status === "live" &&
    art.auction_end && new Date(art.auction_end).getTime() > Date.now();
  const auctionOver = art.sale_mode === "auction" && art.auction_end &&
    new Date(art.auction_end).getTime() <= Date.now();
  const sold = art.is_sold || art.status === "sold";
  const tokensSold = Number(art.tokens_sold || 0);
  const editionSize = Number(art.edition_size || 0);

  return (
    <div className="rounded-xl overflow-hidden group relative transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: "linear-gradient(180deg, #14141c, #0c0c12)", border: `1px solid ${hexAccent}26`, boxShadow: `0 8px 30px -12px ${hexAccent}33` }}>
      {/* Museum frame */}
      <div className="p-2.5">
        <div className="relative rounded-lg overflow-hidden"
          style={{ padding: "6px", background: `linear-gradient(145deg, ${hexAccent}2e, ${hexAccent}10 45%, #0a0a0f)`, boxShadow: `inset 0 0 0 1px ${hexAccent}30` }}>
          <div className="relative aspect-square overflow-hidden rounded-[3px]" style={{ background: "#000", boxShadow: "inset 0 0 22px rgba(0,0,0,0.8)" }}>
            <img src={art.image_url} alt={art.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.07]" />
            {/* subtle gallery vignette + top sheen */}
            <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.45)" }} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent opacity-40" />
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              <SaleBadge art={art} />
              {isDraft && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800/90 text-zinc-300 backdrop-blur-sm">Borrador</span>}
              {sold && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-600/85 text-white backdrop-blur-sm">Vendido</span>}
            </div>
            {art.featured && (
              <span className="absolute top-2 right-2 p-1 rounded-full shadow-lg" style={{ background: `${hexAccent}` }}><Sparkles className="h-3 w-3 text-black" /></span>
            )}
            {auctionLive && (
              <div className="absolute bottom-2 left-2 right-2 flex justify-center">
                <div className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md" style={{ border: `1px solid ${hexAccent}40` }}><Countdown endsAt={art.auction_end} accent={hexAccent} /></div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 pt-0.5 space-y-2">
        <div>
          <h4 className="text-sm font-bold text-white truncate" style={{ letterSpacing: "0.01em" }}>{art.title}</h4>
          <p className="text-[11px] text-gray-400 truncate">
            {CATEGORY_LABELS[art.category] || art.category}{art.medium ? ` · ${art.medium}` : ""}{art.dimensions ? ` · ${art.dimensions}` : ""}
          </p>
        </div>

        {/* Price / bid row */}
        {art.sale_mode === "fixed" && (
          <div className="flex items-center justify-between">
            <span className="text-base font-bold" style={{ color: hexAccent }}>{money(art.price, art.currency)}</span>
            {art.is_original && <span className="text-[9px] uppercase tracking-wide text-gray-500">Original 1/1</span>}
          </div>
        )}
        {art.sale_mode === "auction" && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500">{(art.bid_count || 0) > 0 ? "Puja actual" : "Precio inicial"}</p>
              <span className="text-base font-bold" style={{ color: hexAccent }}>{money(art.current_bid ?? art.starting_price, art.currency)}</span>
            </div>
            <span className="text-[10px] text-gray-400 flex items-center gap-1"><Gavel className="h-3 w-3" />{art.bid_count || 0} pujas</span>
          </div>
        )}
        {art.sale_mode === "tokenized" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold" style={{ color: hexAccent }}>{money(art.token_price, art.currency)}</span>
              <span className="text-[10px] text-gray-400">{tokensSold}/{editionSize} vendidos</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${editionSize ? (tokensSold / editionSize) * 100 : 0}%`, background: hexAccent }} />
            </div>
          </div>
        )}

        {/* Actions */}
        {!isOwner && (
          <div className="pt-1">
            {art.sale_mode === "fixed" && !sold && (
              <button onClick={() => onBuy(art, "buy")} className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: hexAccent, color: "#000" }}>
                <ShoppingBag className="h-3.5 w-3.5" /> Comprar obra
              </button>
            )}
            {art.sale_mode === "auction" && auctionLive && (
              <div className="flex gap-1.5">
                <button onClick={() => onBid(art)} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: hexAccent, color: "#000" }}>
                  <Gavel className="h-3.5 w-3.5" /> Pujar
                </button>
                {art.buy_now_price != null && (
                  <button onClick={() => onBuy(art, "buy")} className="px-3 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: `${hexAccent}55`, color: hexAccent }}>
                    Comprar ya
                  </button>
                )}
              </div>
            )}
            {art.sale_mode === "auction" && auctionOver && art.auction_settled && art.winner_name && art.winner_payment_status !== "paid" && (
              <button onClick={() => onBuy(art, "buy")} className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: hexAccent, color: "#000" }}>
                <Award className="h-3.5 w-3.5" /> Soy el ganador · Pagar
              </button>
            )}
            {art.sale_mode === "auction" && auctionOver && !art.auction_settled && (
              <div className="text-center text-[11px] text-gray-500 py-1.5">Subasta cerrada · esperando resultado</div>
            )}
            {art.sale_mode === "tokenized" && !sold && (tokensSold < editionSize) && (
              <button onClick={() => onBuy(art, "token")} className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: hexAccent, color: "#000" }}>
                <Coins className="h-3.5 w-3.5" /> Coleccionar token
              </button>
            )}
            {sold && <div className="text-center text-[11px] text-gray-500 py-1.5">No disponible</div>}
          </div>
        )}

        {/* Owner controls */}
        {isOwner && (
          <div className="pt-1 flex gap-1.5">
            {isDraft && (
              <button onClick={() => onPublish(art)} disabled={publishing === art.id}
                className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60" style={{ background: hexAccent, color: "#000" }}>
                {publishing === art.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publicar
              </button>
            )}
            {!isDraft && art.sale_mode === "auction" && auctionOver && !art.auction_settled && (
              <button onClick={() => onSettle(art)} className="flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5" style={{ background: hexAccent, color: "#000" }}>
                <Award className="h-3.5 w-3.5" /> Cerrar subasta
              </button>
            )}
            {!isDraft && !(art.sale_mode === "auction" && auctionOver && !art.auction_settled) && (
              <div className="flex-1 py-2 rounded-lg text-xs font-medium text-center" style={{ background: "#0a0a0f", color: "#6b7280", border: `1px solid ${hexAccent}22` }}>
                {sold ? "Vendido" : "Publicado"}{art.views ? ` · ${art.views} 👁` : ""}
              </div>
            )}
            <button onClick={() => onDelete(art)} className="px-2.5 py-2 rounded-lg" style={{ background: "#1a1a22", color: "#ef4444" }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main module ─────────────────────────────────────────────────────────────
export default function ArtGalleryModule({ artistId, artistName, isOwner = false, colors, cardStyles, cardStyleInline }: ArtGalleryModuleProps) {
  const qc = useQueryClient();
  const { hexAccent } = colors;
  const [showCreate, setShowCreate] = useState(false);
  const [buyTarget, setBuyTarget] = useState<{ art: Artwork; mode: "buy" | "token" } | null>(null);
  const [bidTarget, setBidTarget] = useState<Artwork | null>(null);
  const [publishing, setPublishing] = useState<number | null>(null);

  const listKey = ["art-gallery", artistId, isOwner ? "manage" : "public"];
  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      const url = isOwner ? `/api/art-gallery/${artistId}/manage` : `/api/art-gallery/${artistId}`;
      const res = await fetch(url, isOwner ? await authedInit("GET") : { credentials: "include" });
      if (!res.ok) return { artworks: [] as Artwork[] };
      const json = await res.json();
      return { artworks: (json.artworks || []) as Artwork[] };
    },
    staleTime: 30000,
  });
  const artworks = data?.artworks || [];

  const refresh = () => qc.invalidateQueries({ queryKey: listKey });

  const publish = async (art: Artwork) => {
    setPublishing(art.id);
    try {
      const res = await fetch(`/api/art-gallery/${art.id}/publish`, await authedInit("POST"));
      const j = await res.json();
      if (!res.ok) alert(j.error || "No se pudo publicar");
      refresh();
    } finally { setPublishing(null); }
  };
  const settle = async (art: Artwork) => {
    const res = await fetch(`/api/art-gallery/${art.id}/settle`, await authedInit("POST"));
    const j = await res.json();
    if (!res.ok) { alert(j.error || "No se pudo cerrar"); return; }
    refresh();
  };
  const remove = async (art: Artwork) => {
    if (!confirm(`¿Eliminar "${art.title}"?`)) return;
    const res = await fetch(`/api/art-gallery/${art.id}`, await authedInit("DELETE"));
    if (res.ok) refresh();
  };

  // Hide the whole section for visitors when there is nothing published
  if (!isOwner && !isLoading && artworks.length === 0) return null;

  const liveCount = artworks.filter((a) => a.is_published && a.status !== "archived").length;

  return (
    <div className={cardStyles} style={cardStyleInline}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, ${hexAccent}26, ${hexAccent}0d)`, border: `1px solid ${hexAccent}30` }}><Palette className="h-5 w-5" style={{ color: hexAccent }} /></div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">Galería de Arte</h3>
            <p className="text-[11px] text-gray-400">{liveCount} {liveCount === 1 ? "obra" : "obras"} · ventas, subastas y ediciones</p>
          </div>
        </div>
        {isOwner && (
          <button onClick={() => setShowCreate(true)} className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-transform hover:scale-[1.03] shadow-lg" style={{ background: hexAccent, color: "#000" }}>
            <Plus className="h-3.5 w-3.5" /> Añadir obra
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: hexAccent }} /></div>
      ) : artworks.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl relative overflow-hidden" style={{ background: "radial-gradient(120% 120% at 50% 0%, " + hexAccent + "12, #0a0a0f 60%)", border: `1px dashed ${hexAccent}33` }}>
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: `${hexAccent}1a`, border: `1px solid ${hexAccent}33` }}>
            <Palette className="h-7 w-7" style={{ color: hexAccent }} />
          </div>
          <p className="text-sm text-white font-semibold">Tu galería está lista para brillar</p>
          {isOwner
            ? <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto">Añade tu primera pieza —pintura, escultura o arte digital— y véndela como original, en subasta o por ediciones.</p>
            : <p className="text-xs text-gray-500 mt-1.5">Aún no hay obras publicadas.</p>}
          {isOwner && (
            <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-transform hover:scale-[1.03]" style={{ background: hexAccent, color: "#000" }}>
              <Plus className="h-3.5 w-3.5" /> Añadir primera obra
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {artworks.map((art) => (
            <ArtworkCard key={art.id} art={art} colors={colors} isOwner={isOwner}
              onBuy={(a, mode) => setBuyTarget({ art: a, mode })}
              onBid={(a) => setBidTarget(a)}
              onPublish={publish} onDelete={remove} onSettle={settle} publishing={publishing} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateArtworkForm artistId={artistId} accent={hexAccent} onClose={() => setShowCreate(false)} onCreated={refresh} />}
        {buyTarget && <BuyerModal art={buyTarget.art} mode={buyTarget.mode} accent={hexAccent} onClose={() => setBuyTarget(null)} />}
        {bidTarget && <BidModal art={bidTarget} accent={hexAccent} onClose={() => setBidTarget(null)} onPlaced={refresh} />}
      </AnimatePresence>
    </div>
  );
}
