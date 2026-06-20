/**
 * VinylEditionModule
 *
 * Sistema de Ediciones Limitadas de Vinilo — Tokens de inversión físicos
 * 100 / 300 / 500 copias únicas con valor revalorizable
 *
 * Vista Owner:  Crear edición → Generar portada con FAL Flux → Publicar tokens
 * Vista Fan:    Explorar ediciones → Comprar token numerado → Seguir valor
 */
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Disc3, Sparkles, Lock, TrendingUp, ShoppingBag, Star, Info,
  ChevronDown, ChevronUp, CheckCircle2, Clock, Package, AlertCircle,
  Loader2, Image as ImageIcon, Wand2, BarChart3, Users, DollarSign,
  ArrowUpRight, Badge, Hash, Layers, Gem, Trophy, Flame, Plus, X,
  ExternalLink, RefreshCw, Video, Download, Camera, Film,
  Pencil, Save,
} from "lucide-react";
import { SpinningVinyl } from "./spinning-vinyl";
import { storage } from "../../firebase";
import { ref as fbRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUser } from "@clerk/clerk-react";
import { getAuthToken } from "../../lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VinylEdition {
  id: number;
  artistId: number;
  title: string;
  subtitle?: string;
  description?: string;
  coverImage1000?: string;
  cover_image_1000?: string;
  aiCoverPrompt?: string;
  vinylFormat: string;
  vinyl_format?: string;
  vinylType: string;
  vinyl_type?: string;
  vinylColor: string;
  vinyl_color?: string;
  vinylWeight: string;
  vinyl_weight?: string;
  vinylSpeed: string;
  vinyl_speed?: string;
  sleeveType: string;
  editionSize: number;
  edition_size?: number;
  tokensMinted: number;
  tokens_minted?: number;
  mintPrice: string;
  mint_price?: string;
  currentMarketValue?: string;
  current_market_value?: string;
  shippingFlatRate: string;
  shipping_flat_rate?: string;
  rarityTier: string;
  rarity_tier?: string;
  tokenSymbol?: string;
  token_symbol?: string;
  catalogNumber?: string;
  catalog_number?: string;
  appreciationNotes?: string;
  appreciation_notes?: string;
  status: string;
  isPublished: boolean;
  is_published?: boolean;
  tracklistJson?: Array<{ side: string; track: number; title: string; duration: string }>;
  tracklist_json?: Array<{ side: string; track: number; title: string; duration: string }>;
  tokensSold?: number;
  tokens_sold?: number;
  tokensAvailable?: number;
  tokens_available?: number;
  createdAt: string;
  created_at?: string;
}

interface TokenInfo {
  tokenNumber: number;
  token_number?: number;
  serialLabel: string;
  serial_label?: string;
  paymentStatus: string;
  payment_status?: string;
  isListedForSale: boolean;
  is_listed_for_sale?: boolean;
  listPrice?: string;
  list_price?: string;
  currentValue?: string;
  current_value?: string;
  holderName?: string;
  holder_name?: string;
  shippingStatus: string;
  shipping_status?: string;
}

interface VinylEditionModuleProps {
  artistId?: number;
  artistName?: string;
  accentColor?: string;
  isOwner?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RARITY_CONFIG = {
  unique:  { label: "UNIQUE",  copies: 100, color: "from-amber-400 to-orange-500",  bg: "bg-amber-500/10",  text: "text-amber-400",  icon: Gem },
  rare:    { label: "RARE",    copies: 300, color: "from-violet-400 to-purple-600", bg: "bg-violet-500/10", text: "text-violet-400", icon: Star },
  limited: { label: "LIMITED", copies: 500, color: "from-cyan-400 to-blue-500",  bg: "bg-cyan-500/10",   text: "text-cyan-400",   icon: Layers },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:       { label: "Draft",           color: "text-zinc-400" },
  presale:     { label: "Pre-Sale",        color: "text-yellow-400" },
  live:        { label: "Available",       color: "text-emerald-400" },
  sold_out:    { label: "Sold Out",        color: "text-red-400" },
  production:  { label: "In Production",  color: "text-violet-400" },
  fulfilled:   { label: "Shipped",         color: "text-fuchsia-400" },
  cancelled:   { label: "Cancelled",       color: "text-red-500" },
};

function fmt(val?: string | number | null) {
  const n = parseFloat(String(val || 0));
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
}

/**
 * Build fetch options for authenticated endpoints. Sends the Firebase ID token
 * as a Bearer header when available and always includes cookies so Clerk/session
 * auth keeps working. Without this, owner-only edition calls return 401.
 */
async function authedInit(method: string, body?: unknown): Promise<RequestInit> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* token optional — cookie auth may still succeed */
  }
  return {
    method,
    headers,
    credentials: "include",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
}

// ─── Token Grid ───────────────────────────────────────────────────────────────

function TokenGrid({ tokens, mintPrice, accentColor }: {
  tokens: TokenInfo[];
  mintPrice: string;
  accentColor: string;
}) {
  const MAX_SHOW = 50;
  const shown = tokens.slice(0, MAX_SHOW);

  const colorOf = (t: TokenInfo) => {
    const status = t.payment_status || t.paymentStatus;
    if (status === "paid") return "#10b981";
    if (status === "pending") return "#f59e0b";
    const listed = t.is_listed_for_sale ?? t.isListedForSale;
    if (listed) return accentColor;
    return "#ffffff15";
  };

  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {shown.map((t) => {
        const num = t.token_number ?? t.tokenNumber;
        const serial = t.serial_label ?? t.serialLabel;
        const status = t.payment_status ?? t.paymentStatus;
        return (
          <div
            key={num}
            title={`#${serial} — ${status}`}
            className="w-5 h-5 rounded-sm cursor-default transition-transform hover:scale-125"
            style={{ background: colorOf(t) }}
          />
        );
      })}
      {tokens.length > MAX_SHOW && (
        <div className="w-5 h-5 rounded-sm bg-white/10 flex items-center justify-center">
          <span className="text-[8px] text-zinc-400">+{tokens.length - MAX_SHOW}</span>
        </div>
      )}
      <div className="w-full flex items-center gap-4 mt-2 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Sold</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> Pending</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: accentColor }} /> For Sale</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/10 inline-block" /> Available</span>
      </div>
    </div>
  );
}

// ─── Vinyl Media Tools (Owner) ────────────────────────────────────────────────

function VinylMediaTools({ edition, accentColor }: {
  edition: VinylEdition;
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState<"image" | "video">("image");

  // Product image state
  const [generatingImage, setGeneratingImage] = useState(false);
  const [productImageUrl, setProductImageUrl] = useState("");
  const [imageError, setImageError] = useState("");

  // Promo video state
  const [artistPhotoUrl, setArtistPhotoUrl] = useState("");
  const [videoState, setVideoState] = useState<"idle" | "queued" | "polling" | "done" | "failed">("idle");
  const [videoRequestId, setVideoRequestId] = useState("");
  const [videoStatusUrl, setVideoStatusUrl] = useState("");
  const [videoResultUrl, setVideoResultUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState("");
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling on unmount
  React.useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Poll FAL for video status
  React.useEffect(() => {
    if (videoState !== "polling" || !videoRequestId) return;
    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({ statusUrl: videoStatusUrl, resultUrl: videoResultUrl });
        const res = await fetch(`/api/vinyl-editions/poll-fal/${videoRequestId}?${params}`);
        const data = await res.json();
        if (data.status === "completed" && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setVideoState("done");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setVideoError(data.error || "Generation failed");
          setVideoState("failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [videoState, videoRequestId, videoStatusUrl, videoResultUrl]);

  async function handleGenerateProductImage() {
    setGeneratingImage(true); setImageError(""); setProductImageUrl("");
    try {
      const res = await fetch(`/api/vinyl-editions/${edition.id}/generate-product-image`, await authedInit("POST"));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProductImageUrl(data.imageUrl);
    } catch (e: any) {
      setImageError(e.message);
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleGeneratePromoVideo() {
    setVideoState("queued"); setVideoError(""); setVideoUrl("");
    try {
      const res = await fetch(`/api/vinyl-editions/${edition.id}/generate-promo-video`, await authedInit("POST", { artistPhotoUrl: artistPhotoUrl.trim() || undefined }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVideoRequestId(data.requestId);
      setVideoStatusUrl(data.statusUrl);
      setVideoResultUrl(data.resultUrl);
      setVideoState("polling");
    } catch (e: any) {
      setVideoError(e.message);
      setVideoState("failed");
    }
  }

  const cover = edition.cover_image_1000 || edition.coverImage1000 || "";

  if (!cover) return null;

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs transition-colors hover:bg-white/[0.02]"
        style={{ color: accentColor }}
      >
        <span className="flex items-center gap-1.5 font-semibold">
          <Film className="w-3.5 h-3.5" />
          Generate Media (Owner)
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Tab switcher */}
              <div className="flex rounded-xl bg-white/[0.04] p-1 gap-1">
                {(["image", "video"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setMediaTab(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${mediaTab === t ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {t === "image" ? <Camera className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    {t === "image" ? "Product Photo" : "Promo Video"}
                  </button>
                ))}
              </div>

              {/* ── Product Image Tab ── */}
              {mediaTab === "image" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Genera una foto de producto premium del vinilo con iluminación de estudio, sleeve y disco visible — ideal para redes sociales y tiendas.
                  </p>

                  <button
                    onClick={handleGenerateProductImage}
                    disabled={generatingImage}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-90"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
                  >
                    {generatingImage
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Generando con FLUX Pro...</>
                      : <><Sparkles className="w-4 h-4" />Generate Product Photo</>}
                  </button>

                  {generatingImage && (
                    <p className="text-[10px] text-zinc-500 text-center">FLUX Pro Kontext · ~30-60 segundos</p>
                  )}

                  {imageError && (
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{imageError}
                    </p>
                  )}

                  {productImageUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <img
                        src={productImageUrl}
                        alt="Vinyl product photo"
                        className="w-full rounded-xl object-cover aspect-square border border-white/10"
                      />
                      <a
                        href={productImageUrl}
                        download={`${edition.title || "vinyl"}-product.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 rounded-xl border border-white/10 text-xs text-zinc-400 hover:text-white hover:border-white/20 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar imagen
                      </a>
                      <button
                        onClick={handleGenerateProductImage}
                        disabled={generatingImage}
                        className="w-full py-2 rounded-xl border border-white/10 text-xs text-zinc-500 hover:text-white flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className="w-3 h-3" />Regenerar
                      </button>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── Promo Video Tab ── */}
              {mediaTab === "video" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Video promo vertical 9:16 de 5s con Seedance 2.0 Fast — tocadisco + artista sosteniendo el vinilo. Perfecto para Reels e historias.
                  </p>

                  <div>
                    <label className="text-[11px] text-zinc-500 block mb-1">Foto del artista (opcional)</label>
                    <input
                      type="url"
                      value={artistPhotoUrl}
                      onChange={e => setArtistPhotoUrl(e.target.value)}
                      placeholder="https://... URL de la foto del artista"
                      disabled={videoState === "queued" || videoState === "polling"}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 disabled:opacity-40"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Si incluyes una foto, el artista aparece sosteniendo el disco. Sin foto, se genera una escena de tocadisco.
                    </p>
                  </div>

                  {videoState === "idle" || videoState === "failed" ? (
                    <button
                      onClick={handleGeneratePromoVideo}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                      style={{ background: `linear-gradient(135deg, #7c3aed, #ec4899)` }}
                    >
                      <Video className="w-4 h-4" />
                      Generate Promo Video (5s · 720p · 9:16)
                    </button>
                  ) : videoState === "queued" || videoState === "polling" ? (
                    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-center space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-violet-400" />
                      <p className="text-xs text-violet-300 font-semibold">
                        {videoState === "queued" ? "Enviando a Seedance 2.0..." : "Generando video · Seedance 2.0 Fast"}
                      </p>
                      <p className="text-[10px] text-zinc-500">bytedance/seedance-2.0/fast/reference-to-video · ~1-3 min</p>
                      <div className="flex gap-1 justify-center mt-1">
                        {[0,1,2].map(i => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {videoError && (
                    <div className="space-y-2">
                      <p className="text-xs text-red-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{videoError}
                      </p>
                      <button
                        onClick={() => { setVideoState("idle"); setVideoError(""); }}
                        className="text-[11px] text-zinc-500 hover:text-white underline"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}

                  {videoState === "done" && videoUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <video
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full rounded-xl border border-white/10 bg-black"
                        style={{ maxHeight: 480 }}
                      />
                      <div className="flex gap-2">
                        <a
                          href={videoUrl}
                          download={`${edition.title || "vinyl"}-promo.mp4`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                          style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Descargar video
                        </a>
                        <button
                          onClick={() => { setVideoState("idle"); setVideoUrl(""); setVideoError(""); }}
                          className="px-4 py-2 rounded-xl border border-white/10 text-xs text-zinc-500 hover:text-white transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-600 text-center">Seedance 2.0 Fast · 720p · 9:16 · 5s</p>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Edition Card (Fan View) ─────────────────────────────────────────────────

function EditionCard({ edition, accentColor, onBuy, isOwner = false }: {
  edition: VinylEdition;
  accentColor: string;
  onBuy: (edition: VinylEdition) => void;
  isOwner?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const cover = edition.cover_image_1000 || edition.coverImage1000 || "";
  const size = edition.edition_size ?? edition.editionSize ?? 100;
  const sold = edition.tokens_sold ?? edition.tokensSold ?? 0;
  const available = edition.tokens_available ?? edition.tokensAvailable ?? (size - sold);
  const price = parseFloat(edition.mint_price ?? edition.mintPrice ?? "0");
  const marketVal = parseFloat(edition.current_market_value ?? edition.currentMarketValue ?? String(price));
  const rarity = (edition.rarity_tier ?? edition.rarityTier ?? "unique") as keyof typeof RARITY_CONFIG;
  const rc = RARITY_CONFIG[rarity] || RARITY_CONFIG.unique;
  const RIcon = rc.icon;
  const status = edition.status;
  const tracklist = edition.tracklist_json ?? edition.tracklistJson ?? [];
  const symbol = edition.token_symbol ?? edition.tokenSymbol;
  const colorKey = edition.vinyl_color ?? edition.vinylColor ?? "black";
  const appreciation = edition.appreciation_notes ?? edition.appreciationNotes;
  const soldPct = Math.min(100, Math.round((sold / size) * 100));
  const gain = price > 0 ? ((marketVal - price) / price) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-5 p-5">
        <div className="flex-shrink-0 flex items-center justify-center">
          <SpinningVinyl
            coverImage={cover}
            spinning={status === "live"}
            size={160}
            vinylColor={colorKey === "picture" ? "picture" : colorKey === "black" ? "black" : "colored"}
            accentColor={accentColor}
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Rarity badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${rc.bg} ${rc.text} uppercase tracking-widest`}>
              <RIcon className="w-3 h-3" />
              {rc.label} Edition — {size} copies
            </span>
            {symbol && (
              <span className="text-[10px] text-zinc-600 font-mono">{symbol}</span>
            )}
          </div>

          <div>
            <h3 className="text-lg font-black text-white leading-tight">{edition.title}</h3>
            {edition.subtitle && <p className="text-xs text-zinc-400 mt-0.5">{edition.subtitle}</p>}
            <p className="text-xs text-zinc-600 mt-1">
              {edition.vinyl_format ?? edition.vinylFormat}" {edition.vinyl_type ?? edition.vinylType} — {colorKey} — {edition.vinyl_speed ?? edition.vinylSpeed}
            </p>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400"><span className="text-white font-bold">{sold}</span> / {size} tokens</span>
              <span className="text-zinc-500">{soldPct}% sold</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${soldPct}%` }}
                transition={{ duration: 1 }}
                style={{ background: `linear-gradient(90deg, ${accentColor}, #ec4899)` }}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-end gap-5">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Mint Price</p>
              <p className="text-2xl font-black text-white">{fmt(price)}</p>
            </div>
            {marketVal !== price && (
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Market Value</p>
                <p className="text-lg font-bold" style={{ color: gain >= 0 ? "#10b981" : "#f87171" }}>
                  {fmt(marketVal)}
                  <span className="text-xs ml-1">{gain >= 0 ? "+" : ""}{gain.toFixed(1)}%</span>
                </p>
              </div>
            )}
            <div className="ml-auto">
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Available</p>
              <p className="text-lg font-bold text-white">{available}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Appreciation pitch */}
      {appreciation && (
        <div className="mx-5 mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/5">
          <p className="text-xs text-zinc-400 leading-relaxed flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
            {appreciation}
          </p>
        </div>
      )}

      {/* Tracklist toggle */}
      {tracklist.length > 0 && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs text-zinc-500 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Disc3 className="w-3.5 h-3.5" />{tracklist.length} tracks
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-0.5">
                  {["A", "B"].map((side) => {
                    const st = tracklist.filter(t => t.side === side);
                    if (!st.length) return null;
                    return (
                      <div key={side} className="mt-2">
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Side {side}</p>
                        {st.map(t => (
                          <div key={t.track} className="flex justify-between py-0.5">
                            <span className="text-xs text-zinc-300"><span className="text-zinc-600 mr-1.5">{side}{t.track}.</span>{t.title}</span>
                            <span className="text-[11px] text-zinc-600">{t.duration}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* CTA */}
      {status === "live" && available > 0 && (
        <div className="border-t border-white/5 p-4">
          <button
            onClick={() => onBuy(edition)}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
          >
            <ShoppingBag className="w-4 h-4" />
            Get Token #{sold + 1} — {fmt(price + parseFloat(edition.shipping_flat_rate ?? edition.shippingFlatRate ?? "14"))} USD
          </button>
          <p className="text-[10px] text-zinc-600 text-center mt-2 flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            Hand-numbered physical edition · Only {size} copies worldwide
          </p>
        </div>
      )}
      {status === "sold_out" && (
        <div className="border-t border-white/5 p-4 text-center text-xs text-red-400 flex items-center justify-center gap-1">
          <Flame className="w-3.5 h-3.5" /> Agotado — busca en el mercado secundario
        </div>
      )}

      {/* Owner media tools */}
      {isOwner && <VinylMediaTools edition={edition} accentColor={accentColor} />}

      {/* Owner edit panel */}
      {isOwner && <EditionEditPanel edition={edition} accentColor={accentColor} />}
    </motion.div>
  );
}

// ─── EditionEditPanel (owner inline editor) ───────────────────────────────────

function EditionEditPanel({ edition, accentColor }: {
  edition: VinylEdition;
  accentColor: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: edition.title || "",
    subtitle: edition.subtitle || "",
    mintPrice: edition.mint_price ?? edition.mintPrice ?? "45",
    shippingFlatRate: edition.shipping_flat_rate ?? edition.shippingFlatRate ?? "14",
    currentMarketValue: edition.current_market_value ?? edition.currentMarketValue ?? "",
    appreciationNotes: edition.appreciation_notes ?? edition.appreciationNotes ?? "",
    status: edition.status || "draft",
    tokenSymbol: edition.token_symbol ?? edition.tokenSymbol ?? "",
    catalogNumber: edition.catalog_number ?? edition.catalogNumber ?? "",
    saleStart: (edition as any).sale_start?.slice(0, 10) ?? "",
    saleEnd: (edition as any).sale_end?.slice(0, 10) ?? "",
  });

  async function handleSave() {
    setSaving(true); setSaved(false); setError("");
    try {
      const res = await fetch(`/api/vinyl-editions/${edition.id}`, await authedInit("PUT", {
          title: form.title,
          subtitle: form.subtitle || null,
          mint_price: parseFloat(form.mintPrice) || 0,
          shipping_flat_rate: parseFloat(form.shippingFlatRate) || 0,
          current_market_value: form.currentMarketValue ? parseFloat(form.currentMarketValue) : null,
          appreciation_notes: form.appreciationNotes || null,
          status: form.status,
          token_symbol: form.tokenSymbol || null,
          catalog_number: form.catalogNumber || null,
          sale_start: form.saleStart || null,
          sale_end: form.saleEnd || null,
      }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      qc.invalidateQueries({ queryKey: ["vinyl-editions-admin"] });
      qc.invalidateQueries({ queryKey: ["vinyl-editions"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const fieldCls = "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500";
  const labelCls = "text-[10px] text-zinc-500 block mb-1";

  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs transition-colors hover:bg-white/[0.02]"
        style={{ color: open ? accentColor : "#52525b" }}
      >
        <span className="flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" />
          Edit Edition
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              {/* Row 1: title + subtitle */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Title *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className={fieldCls} placeholder="Edition title" />
                </div>
                <div>
                  <label className={labelCls}>Subtitle</label>
                  <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                    className={fieldCls} placeholder="Optional subtitle" />
                </div>
              </div>

              {/* Row 2: prices */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Mint Price (USD)</label>
                  <input type="number" step="0.01" min="0" value={form.mintPrice}
                    onChange={e => setForm(f => ({ ...f, mintPrice: e.target.value }))}
                    className={fieldCls} placeholder="45.00" />
                </div>
                <div>
                  <label className={labelCls}>Shipping (USD)</label>
                  <input type="number" step="0.01" min="0" value={form.shippingFlatRate}
                    onChange={e => setForm(f => ({ ...f, shippingFlatRate: e.target.value }))}
                    className={fieldCls} placeholder="14.00" />
                </div>
                <div>
                  <label className={labelCls}>Market Value (USD)</label>
                  <input type="number" step="0.01" min="0" value={form.currentMarketValue}
                    onChange={e => setForm(f => ({ ...f, currentMarketValue: e.target.value }))}
                    className={fieldCls} placeholder="Same as mint" />
                </div>
              </div>

              {/* Row 3: status + token symbol + catalog */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className={fieldCls}>
                    {["draft","presale","live","sold_out","production","fulfilled","cancelled"].map(s => (
                      <option key={s} value={s} className="bg-zinc-900 capitalize">{s.replace("_"," ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Token Symbol</label>
                  <input value={form.tokenSymbol} onChange={e => setForm(f => ({ ...f, tokenSymbol: e.target.value }))}
                    className={fieldCls} placeholder="e.g. BFYE001" />
                </div>
                <div>
                  <label className={labelCls}>Catalog Number</label>
                  <input value={form.catalogNumber} onChange={e => setForm(f => ({ ...f, catalogNumber: e.target.value }))}
                    className={fieldCls} placeholder="e.g. BFY-2025-001" />
                </div>
              </div>

              {/* Row 4: sale dates */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Sale Start</label>
                  <input type="date" value={form.saleStart} onChange={e => setForm(f => ({ ...f, saleStart: e.target.value }))}
                    className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Sale End</label>
                  <input type="date" value={form.saleEnd} onChange={e => setForm(f => ({ ...f, saleEnd: e.target.value }))}
                    className={fieldCls} />
                </div>
              </div>

              {/* Appreciation notes */}
              <div>
                <label className={labelCls}>Investment / Appreciation Notes</label>
                <textarea rows={2} value={form.appreciationNotes}
                  onChange={e => setForm(f => ({ ...f, appreciationNotes: e.target.value }))}
                  className={`${fieldCls} resize-none`}
                  placeholder="Why this edition will appreciate in value…" />
              </div>

              {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

              <button onClick={handleSave} disabled={saving}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : saved
                  ? <><CheckCircle2 className="w-4 h-4 text-emerald-300" />Saved!</>
                  : <><Save className="w-4 h-4" />Save Changes</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Owner Creator ────────────────────────────────────────────────────────────

function EditionCreator({ artistId, artistName, accentColor, onCreated }: {
  artistId: number;
  artistName: string;
  accentColor: string;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"config" | "cover" | "publish">("config");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editionId, setEditionId] = useState<number | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [generatingCover, setGeneratingCover] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("cinematic");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    description: "",
    editionSize: 100,
    mintPrice: "",
    vinylColor: "black",
    vinylFormat: "12",
    vinylType: "1LP",
    vinylWeight: "180g",
    vinylSpeed: "33RPM",
    tokenSymbol: "",
    catalogNumber: "",
    appreciationNotes: "",
    copyrightConfirmed: false,
  });

  const rarity = form.editionSize <= 100 ? "unique" : form.editionSize <= 300 ? "rare" : "limited";
  const rc = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG];
  const suggestedPrice = form.editionSize <= 100 ? 65 : form.editionSize <= 300 ? 45 : 35;

  async function handleCreateDraft() {
    if (!form.title) { setError("El título es requerido"); return; }
    if (!form.copyrightConfirmed) { setError("Debes confirmar los derechos de autor"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/vinyl-editions", await authedInit("POST", {
          artistId,
          ...form,
          mintPrice: form.mintPrice || String(suggestedPrice),
          tracklistJson: [],
      }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear");
      setEditionId(data.edition.id);
      setStep("cover");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCover() {
    if (!editionId || !aiPrompt) return;
    setGeneratingCover(true); setError("");
    try {
      const res = await fetch(`/api/vinyl-editions/${editionId}/generate-cover`, await authedInit("POST", { prompt: aiPrompt, style: aiStyle }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCoverUrl(data.imageUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingCover(false);
    }
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editionId) return;
    setSaving(true); setError("");
    try {
      const sRef = fbRef(storage, `vinyl-editions/${editionId}/cover-${Date.now()}.${file.name.split(".").pop()}`);
      const snap = await uploadBytes(sRef, file);
      const url = await getDownloadURL(snap.ref);
      await fetch(`/api/vinyl-editions/${editionId}`, await authedInit("PUT", { coverImage1000: url }));
      setCoverUrl(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Generate vinyl-disc mockup as 1000×1000 PNG cover ────────────────────
  async function handleUseVinylMockup() {
    if (!editionId) return;
    setSaving(true); setError("");
    try {
      const S = 1000;
      const canvas = document.createElement("canvas");
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext("2d")!;

      // Background
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, S, S);

      const cx = 500, cy = 500;

      // Outer glow
      const glowGr = ctx.createRadialGradient(cx, cy, 300, cx, cy, 500);
      glowGr.addColorStop(0, "transparent");
      glowGr.addColorStop(1, accentColor + "28");
      ctx.fillStyle = glowGr;
      ctx.fillRect(0, 0, S, S);

      // Vinyl disc — color varies by selection
      const colorKey = form.vinylColor;
      let discFill: string | CanvasGradient;
      if (colorKey === "black") {
        const dg = ctx.createRadialGradient(cx - 80, cy - 80, 0, cx, cy, 490);
        dg.addColorStop(0, "#2a2a2a"); dg.addColorStop(0.5, "#151515"); dg.addColorStop(1, "#0a0a0a");
        discFill = dg;
      } else if (colorKey === "color") {
        const dg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 490);
        dg.addColorStop(0, accentColor + "cc"); dg.addColorStop(0.6, accentColor + "44"); dg.addColorStop(1, "#111");
        discFill = dg;
      } else if (colorKey === "splatter") {
        discFill = "#111";
      } else if (colorKey === "marble") {
        const dg = ctx.createLinearGradient(10, 10, 990, 990);
        dg.addColorStop(0, "#1a1a2e"); dg.addColorStop(0.3, accentColor + "55"); dg.addColorStop(0.6, "#0d0d1a"); dg.addColorStop(1, "#2d2d4a");
        discFill = dg;
      } else if (colorKey === "cloudy") {
        const dg = ctx.createRadialGradient(cx, cy, 50, cx, cy, 490);
        dg.addColorStop(0, "#1a1a3a"); dg.addColorStop(0.4, "#111122"); dg.addColorStop(1, "#080808");
        discFill = dg;
      } else if (colorKey === "half-half") {
        discFill = "#111";
      } else {
        discFill = "#111";
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 490, 0, Math.PI * 2);
      ctx.fillStyle = discFill;
      ctx.fill();

      // Half-half special
      if (colorKey === "half-half") {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 490, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = accentColor + "99";
        ctx.fillRect(cx, 0, 500, 1000);
        ctx.restore();
      }

      // Splatter dots
      if (colorKey === "splatter") {
        for (let i = 0; i < 80; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 380;
          const sx = cx + Math.cos(angle) * dist;
          const sy = cy + Math.sin(angle) * dist;
          ctx.beginPath();
          ctx.arc(sx, sy, 2 + Math.random() * 6, 0, Math.PI * 2);
          ctx.fillStyle = accentColor + Math.floor(80 + Math.random() * 160).toString(16).padStart(2, "0");
          ctx.fill();
        }
      }

      // Groove rings
      for (let i = 0; i < 18; i++) {
        const r = 195 + i * 15;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + i * 0.006})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Center label
      const lblR = 178;
      const lblGr = ctx.createRadialGradient(cx - 40, cy - 40, 0, cx, cy, lblR);
      lblGr.addColorStop(0, accentColor + "ee");
      lblGr.addColorStop(0.6, accentColor + "88");
      lblGr.addColorStop(1, "#000000cc");
      ctx.beginPath();
      ctx.arc(cx, cy, lblR, 0, Math.PI * 2);
      ctx.fillStyle = lblGr;
      ctx.fill();

      // Label ring
      ctx.beginPath();
      ctx.arc(cx, cy, lblR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Title on label
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      const titleLine = (form.title || artistName || "VINYL").toUpperCase().slice(0, 18);
      ctx.font = `bold ${titleLine.length > 12 ? 30 : 36}px system-ui, Arial, sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 8;
      ctx.fillText(titleLine, cx, cy - (form.subtitle ? 22 : 8));

      if (form.subtitle) {
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.font = "20px system-ui, Arial, sans-serif";
        ctx.fillText(form.subtitle.slice(0, 22), cx, cy + 18);
      }

      // Artist name below title
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "15px system-ui, Arial, sans-serif";
      ctx.fillText(artistName?.slice(0, 24) || "", cx, cy + (form.subtitle ? 46 : 28));
      ctx.shadowBlur = 0;

      // Spindle hole
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Disc edge shadow
      const edgeSh = ctx.createRadialGradient(cx, cy, 440, cx, cy, 495);
      edgeSh.addColorStop(0, "transparent");
      edgeSh.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.beginPath();
      ctx.arc(cx, cy, 490, 0, Math.PI * 2);
      ctx.fillStyle = edgeSh;
      ctx.fill();

      // Reflection sheen
      const reflGr = ctx.createRadialGradient(320, 280, 0, 320, 280, 260);
      reflGr.addColorStop(0, "rgba(255,255,255,0.14)");
      reflGr.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, 490, 0, Math.PI * 2);
      ctx.fillStyle = reflGr;
      ctx.fill();

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Canvas render failed");

      const sRef = fbRef(storage, `vinyl-editions/${editionId}/cover-${Date.now()}.png`);
      const snap = await uploadBytes(sRef, blob);
      const url = await getDownloadURL(snap.ref);

      await fetch(`/api/vinyl-editions/${editionId}`, await authedInit("PUT", { coverImage1000: url }));
      setCoverUrl(url);
    } catch (e: any) {
      setError(e.message || "Failed to generate vinyl cover");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!editionId) return;
    if (!coverUrl) { setError("You need a cover image before publishing"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/vinyl-editions/${editionId}/publish`, await authedInit("POST"));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      qc.invalidateQueries({ queryKey: ["vinyl-editions-admin", artistId] });
      qc.invalidateQueries({ queryKey: ["vinyl-editions", artistId] });
      onCreated();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-5">
      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        {(["config", "cover", "publish"] as const).map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${step === s ? "bg-white/10 text-white font-bold" : "text-zinc-600"}`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: step === s ? accentColor : "transparent", border: `1px solid ${step === s ? accentColor : "#ffffff20"}` }}>
                {i + 1}
              </span>
              {s === "config" ? "Configure" : s === "cover" ? "Cover Art" : "Publish"}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-white/10" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Config */}
      {step === "config" && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">New Limited Edition</h3>

          {/* Edition size selector */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-2 block">Edition Size</label>
            <div className="grid grid-cols-3 gap-2">
              {([100, 300, 500] as const).map(n => {
                const r = n <= 100 ? "unique" : n <= 300 ? "rare" : "limited";
                const rc2 = RARITY_CONFIG[r];
                const Ic = rc2.icon;
                return (
                  <button
                    key={n}
                    onClick={() => setForm(f => ({ ...f, editionSize: n }))}
                    className={`p-3 rounded-xl border text-center transition-all ${form.editionSize === n ? "border-white/20 bg-white/5" : "border-white/5 hover:border-white/10"}`}
                  >
                    <Ic className={`w-4 h-4 mx-auto mb-1 ${rc2.text}`} />
                    <p className="text-white font-bold text-sm">{n}</p>
                    <p className={`text-[10px] uppercase font-bold ${rc2.text}`}>
                      {rc2.label}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">≈${suggestedPrice} USD</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 block mb-1">Album Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                placeholder="e.g. Silent Island Vol. I" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Subtitle</label>
              <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                placeholder="e.g. Golden Edition" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Mint Price (USD)</label>
              <input type="number" value={form.mintPrice} onChange={e => setForm(f => ({ ...f, mintPrice: e.target.value }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                placeholder={String(suggestedPrice)} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Token Symbol</label>
              <input value={form.tokenSymbol} onChange={e => setForm(f => ({ ...f, tokenSymbol: e.target.value.toUpperCase() }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-mono"
                placeholder={`${artistName?.toUpperCase().slice(0, 6) || "ARTST"}001`} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Vinyl Color</label>
              <select value={form.vinylColor} onChange={e => setForm(f => ({ ...f, vinylColor: e.target.value }))}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500">
                <option value="black">Black</option>
                <option value="color">Solid Color</option>
                <option value="splatter">Splatter</option>
                <option value="cloudy">Cloudy</option>
                <option value="marble">Marble</option>
                <option value="picture">Picture Disc</option>
                <option value="half-half">Half & Half</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Investment Pitch</label>
            <textarea
              value={form.appreciationNotes}
              onChange={e => setForm(f => ({ ...f, appreciationNotes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
              placeholder="e.g. Artist's first physical album. Only 100 hand-numbered copies. First editions appreciate exponentially in collector value..."
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.copyrightConfirmed}
              onChange={e => setForm(f => ({ ...f, copyrightConfirmed: e.target.checked }))}
              className="mt-0.5" />
            <span className="text-xs text-zinc-500">
              I confirm I hold the copyright for this content and accept Diggers Factory manufacturing terms.
            </span>
          </label>

          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

          <button onClick={handleCreateDraft} disabled={saving}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <>Next: Design Cover Art →</>}
          </button>
        </div>
      )}

      {/* Step 2: Cover */}
      {step === "cover" && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">Cover Art 1000×1000</h3>
          <p className="text-xs text-zinc-500">Generate with AI, upload your own, or use the vinyl mockup below.</p>

          {/* Live vinyl preview */}
          <div className="flex flex-col items-center py-3">
            <SpinningVinyl
              coverImage={coverUrl}
              title={form.title || "My Album"}
              subtitle={form.subtitle || artistName}
              spinning={!coverUrl}
              size={220}
              vinylColor={
                form.vinylColor === "picture" ? "picture"
                : form.vinylColor === "black" ? "black"
                : "colored"
              }
              accentColor={accentColor}
            />
            {coverUrl && (
              <span className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cover set — ready to publish
              </span>
            )}
          </div>

          {/* Option 1: Use vinyl mockup */}
          <button
            onClick={handleUseVinylMockup}
            disabled={saving}
            className="w-full py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}22, transparent)`,
              borderColor: accentColor + "55",
              color: accentColor,
            }}
          >
            <Disc3 className="w-4 h-4" />
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Rendering vinyl...</> : "Use Vinyl Design as Cover"}
          </button>

          {/* Option 2: AI Generator */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <p className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Generate with FAL FLUX Pro
            </p>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-none"
              placeholder="Describe the cover: e.g. Man gazing at the ocean from a deserted island at sunset, atmospheric, warm colors, photorealistic..."
            />
            <div className="flex gap-2">
              <select value={aiStyle} onChange={e => setAiStyle(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none">
                <option value="cinematic">Cinematic</option>
                <option value="illustration">Illustration</option>
                <option value="abstract">Abstract</option>
                <option value="photography">Photography</option>
                <option value="painting">Painting</option>
                <option value="dark moody">Dark Moody</option>
              </select>
              <button onClick={handleGenerateCover} disabled={generatingCover || !aiPrompt}
                className="flex-1 py-2 rounded-lg font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                style={{ background: accentColor }}>
                {generatingCover ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Generate</>}
              </button>
            </div>
          </div>

          {/* Option 3: Upload */}
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadCover} />
            <button onClick={() => fileInputRef.current?.click()} disabled={saving}
              className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-zinc-400 hover:text-white hover:border-white/20 flex items-center justify-center gap-2 transition-colors">
              <ImageIcon className="w-4 h-4" />
              {saving ? "Uploading..." : "Upload image (1000×1000)"}
            </button>
          </div>

          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

          <button onClick={() => setStep("publish")} disabled={!coverUrl}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: coverUrl ? `linear-gradient(135deg, ${accentColor}, #ec4899)` : undefined }}>
            Next: Publish Tokens →
          </button>
        </div>
      )}

      {/* Step 3: Publish */}
      {step === "publish" && (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-white">Publish Edition</h3>

          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Summary</p>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Edition Size</span>
              <span className="text-white font-bold">{form.editionSize} copies ({rc.label})</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Price per Token</span>
              <span className="text-white font-bold">{fmt(form.mintPrice || suggestedPrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Potential Revenue</span>
              <span className="text-emerald-400 font-bold">{fmt((parseFloat(form.mintPrice || String(suggestedPrice))) * form.editionSize)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Vinyl</span>
              <span className="text-white">{form.vinylFormat}" {form.vinylType} — {form.vinylColor}</span>
            </div>
          </div>

          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
            <p className="text-xs text-amber-400 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Publishing will create {form.editionSize} numbered tokens. Once enough fans purchase, a manufacturing order will be placed with Diggers Factory (minimum 100 copies, 6-8 weeks delivery).
            </p>
          </div>

          {coverUrl && (
            <img src={coverUrl} alt="Cover preview" className="w-24 h-24 rounded-xl object-cover" />
          )}

          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

          <button onClick={handlePublish} disabled={saving}
            className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Publishing...</> : <><Trophy className="w-4 h-4" />Publish & Activate Tokens</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({ edition, onClose, accentColor }: {
  edition: VinylEdition;
  onClose: () => void;
  accentColor: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const price = parseFloat(edition.mint_price ?? edition.mintPrice ?? "0");
  const shipping = parseFloat(edition.shipping_flat_rate ?? edition.shippingFlatRate ?? "14");

  async function handleCheckout() {
    if (!name || !email) { setError("Name and email are required"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/vinyl-editions/${edition.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerEmail: email, buyerName: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl bg-zinc-900 border border-white/10 p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-black text-white text-lg">{edition.title}</h3>
            <p className="text-xs text-zinc-500">Numbered token · Limited edition</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-xl bg-white/5 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-zinc-500">Token</span><span className="text-white font-bold">{fmt(price)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Shipping</span><span className="text-white">{fmt(shipping)}</span></div>
          <div className="flex justify-between border-t border-white/5 pt-1.5 mt-1"><span className="text-zinc-400 font-semibold">Total</span><span className="font-black text-white">{fmt(price + shipping)}</span></div>
        </div>

        <div className="space-y-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500" />
        </div>

        {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}

        <button onClick={handleCheckout} disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><ShoppingBag className="w-4 h-4" />Pay with card</>}
        </button>

        <p className="text-[10px] text-zinc-600 text-center flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Secure payment via Stripe · Your token is reserved during checkout
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export function VinylEditionModule({ artistId, artistName = "Artista", accentColor = "#7c3aed", isOwner = false }: VinylEditionModuleProps) {
  const [showCreator, setShowCreator] = useState(false);
  const [buyEdition, setBuyEdition] = useState<VinylEdition | null>(null);
  const [tab, setTab] = useState<"editions" | "market">("editions");
  const qc = useQueryClient();

  const { data: publicData, isLoading: loadingPublic } = useQuery({
    queryKey: ["vinyl-editions", artistId],
    queryFn: async () => {
      if (!artistId) return { editions: [] };
      const res = await fetch(`/api/vinyl-editions/${artistId}`);
      return res.json();
    },
    enabled: !!artistId,
    refetchInterval: 30000,
  });

  const { data: adminData, isLoading: loadingAdmin } = useQuery({
    queryKey: ["vinyl-editions-admin", artistId],
    queryFn: async () => {
      if (!artistId || !isOwner) return { editions: [] };
      const res = await fetch(`/api/vinyl-editions/admin/${artistId}`, await authedInit("GET"));
      return res.json();
    },
    enabled: !!artistId && isOwner,
  });

  const editions: VinylEdition[] = isOwner
    ? (adminData?.editions || [])
    : (publicData?.editions || []);

  const isLoading = isOwner ? loadingAdmin : loadingPublic;

  const totalRevenue = editions.reduce((acc, e) => {
    const sold = e.tokens_sold ?? e.tokensSold ?? 0;
    const price = parseFloat(e.mint_price ?? e.mintPrice ?? "0");
    return acc + sold * price;
  }, 0);

  const totalTokens = editions.reduce((acc, e) => acc + (e.edition_size ?? e.editionSize ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Disc3 className="w-5 h-5" style={{ color: accentColor }} />
            Limited Edition Tokens
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Hand-numbered physical tokens · Only as many copies as were pressed</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => qc.invalidateQueries({ queryKey: ["vinyl-editions", artistId] })}
            className="p-2 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isOwner && (
            <button onClick={() => setShowCreator(!showCreator)}
              className="px-3 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 transition-all hover:scale-[1.02]"
              style={{ background: showCreator ? "#ffffff15" : `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
              {showCreator ? <><X className="w-4 h-4" />Cancel</> : <><Plus className="w-4 h-4" />New Edition</>}
            </button>
          )}
        </div>
      </div>

      {/* Owner stats */}
      {isOwner && editions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Layers, label: "Editions", value: editions.length },
            { icon: Hash, label: "Total Tokens", value: totalTokens },
            { icon: DollarSign, label: "Revenue", value: fmt(totalRevenue) },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl bg-white/[0.02] border border-white/5 p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1 text-zinc-500" />
              <p className="text-white font-bold text-sm">{value}</p>
              <p className="text-[10px] text-zinc-600">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Creator */}
      <AnimatePresence>
        {isOwner && showCreator && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <EditionCreator
              artistId={artistId!}
              artistName={artistName}
              accentColor={accentColor}
              onCreated={() => { setShowCreator(false); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
        </div>
      )}

      {/* Editions list */}
      {!isLoading && editions.length === 0 && !showCreator && (
        <div className="text-center py-10">
          <Disc3 className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 text-sm">
            {isOwner ? "Create your first limited vinyl edition" : "No editions available yet"}
          </p>
          {isOwner && (
            <button onClick={() => setShowCreator(true)}
              className="mt-3 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
              + Create Edition
            </button>
          )}
        </div>
      )}

      <div className="space-y-4">
        {editions.map(edition => (
          <EditionCard
            key={edition.id}
            edition={edition}
            accentColor={accentColor}
            isOwner={isOwner}
            onBuy={(e) => setBuyEdition(e)}
          />
        ))}
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {buyEdition && (
          <CheckoutModal
            edition={buyEdition}
            onClose={() => setBuyEdition(null)}
            accentColor={accentColor}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default VinylEditionModule;
