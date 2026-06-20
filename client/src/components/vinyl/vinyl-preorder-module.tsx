/**
 * VinylPreorderModule
 * Full artist-facing + fan-facing vinyl pre-order experience for Boostify.
 * Integrates with Diggers Factory (semi-automated via fulfillment report).
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Disc3, Plus, X, ChevronDown, ChevronUp, Download,
  ExternalLink, CheckCircle2, Clock, AlertCircle, Music,
  Package, Truck, Star, Info, ShoppingCart, Loader2,
  Settings2, BarChart3, Users, DollarSign,
  Upload, Image as ImageIcon, Palette, Type, ArrowDown, ArrowUp,
  Pencil, Save, Sparkles,
} from "lucide-react";
import { SpinningVinyl } from "./spinning-vinyl";
import { storage } from "../../firebase";
import { ref as fbRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuthToken } from "../../lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VinylCampaign {
  id: number;
  artistId: number;
  title: string;
  subtitle?: string;
  coverImage1000: string;
  coverImageBack?: string;
  tracklistJson: Array<{ side: string; track: number; title: string; duration: string }>;
  vinylFormat: string;
  vinylType: string;
  vinylColor: string;
  vinylWeight: string;
  vinylSpeed: string;
  sleeveType: string;
  productionCostTotal: string;
  minimumUnits: number;
  maxUnits: number;
  unitCost: string;
  sellPrice: string;
  shippingFlatRate: string;
  currentUnits: number;
  campaignStatus: "active" | "goal_reached" | "fulfilled" | "cancelled";
  isPublished: boolean;
  campaignEnd?: string;
  createdAt: string;
  // snake_case fallback from raw DB
  cover_image_1000?: string;
  sell_price?: string;
  minimum_units?: number;
  current_units?: number;
  campaign_status?: string;
  artist_id?: number;
  vinyl_format?: string;
  vinyl_color?: string;
  vinyl_speed?: string;
  vinyl_type?: string;
  shipping_flat_rate?: string;
}

interface ArtistInfo {
  pgId?: number;
  id?: number;
  name?: string;
  artistName?: string;
  profileImage?: string;
  coverImage?: string;
  isOwner?: boolean;
}

interface VinylPreorderModuleProps {
  artist: ArtistInfo;
  colors?: { hexPrimary: string; hexAccent: string };
  isOwner?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(val?: string | number) {
  const n = parseFloat(String(val || 0));
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
}

function progressPct(current: number, minimum: number) {
  return Math.min(100, Math.round((current / minimum) * 100));
}

/**
 * Build fetch options for authenticated endpoints. Sends the Firebase ID token
 * as a Bearer header when available and always includes cookies so Clerk/session
 * auth keeps working. Without this, owner-only vinyl calls return 401.
 */
async function authedJsonInit(method: string, body?: unknown): Promise<RequestInit> {
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

const VINYL_COLOR_LABELS: Record<string, string> = {
  black: "Black",
  color: "Solid Color",
  splatter: "Splatter",
  cloudy: "Cloudy",
  "aside-bside": "A-side / B-side",
  marble: "Marble",
  "color-in-color": "Color-in-Color",
  "half-half": "Half & Half",
  picture: "Picture Disc",
};

const STATUS_CONFIG = {
  active: { label: "Pre-Order Active", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Clock },
  goal_reached: { label: "Goal Reached! Processing...", color: "text-violet-400", bg: "bg-violet-500/10", icon: CheckCircle2 },
  fulfilled: { label: "Sent to Production", color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", icon: Package },
  cancelled: { label: "Campaign Cancelled", color: "text-red-400", bg: "bg-red-500/10", icon: X },
};

// ─── Sub-component: Campaign Card (public view for fans) ─────────────────────

function CampaignPublicCard({
  campaign,
  accentColor,
}: {
  campaign: VinylCampaign;
  accentColor: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const coverImg = campaign.cover_image_1000 || campaign.coverImage1000 || "";
  const sellPrice = parseFloat(campaign.sell_price || campaign.sellPrice || "0");
  const shipping = parseFloat(campaign.shipping_flat_rate || campaign.shippingFlatRate || "12");
  const minimum = campaign.minimum_units || campaign.minimumUnits || 100;
  const current = campaign.current_units || campaign.currentUnits || 0;
  const pct = progressPct(current, minimum);
  const status = (campaign.campaign_status || campaign.campaignStatus || "active") as keyof typeof STATUS_CONFIG;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = statusCfg.icon;

  const vinylColorKey = campaign.vinyl_color || campaign.vinylColor || "black";
  const isActive = status === "active";

  async function handlePreOrder() {
    if (!buyerEmail || !buyerName) {
      setCheckoutError("Ingresa tu nombre y email para continuar.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const res = await fetch(`/api/vinyl/campaigns/${campaign.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: 1, buyerEmail, buyerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el checkout");
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (err: any) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden"
    >
      {/* Top: vinyl animation + info */}
      <div className="flex flex-col sm:flex-row gap-6 p-5">
        {/* Vinyl */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <SpinningVinyl
            coverImage={coverImg}
            spinning={isActive}
            size={180}
            vinylColor={
              vinylColorKey === "picture"
                ? "picture"
                : vinylColorKey === "black"
                ? "black"
                : "colored"
            }
            accentColor={accentColor}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
          <div>
            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold mb-2 ${statusCfg.bg} ${statusCfg.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </div>
            <h3 className="text-lg font-black text-white leading-tight">{campaign.title}</h3>
            {campaign.subtitle && (
              <p className="text-xs text-zinc-400 mt-0.5">{campaign.subtitle}</p>
            )}
            <p className="text-xs text-zinc-500 mt-1">
              {campaign.vinyl_format || campaign.vinylFormat}" {campaign.vinyl_type || campaign.vinylType} — {VINYL_COLOR_LABELS[vinylColorKey] || vinylColorKey} — {campaign.vinyl_speed || campaign.vinylSpeed}
            </p>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-400">
                <span className="text-white font-bold">{current}</span> / {minimum} units
              </span>
              <span className="text-zinc-500">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ background: `linear-gradient(90deg, ${accentColor}, #f472b6)` }}
              />
            </div>
            {pct < 100 && (
              <p className="text-[11px] text-zinc-600 mt-1">
                {minimum - current} units needed to produce
              </p>
            )}
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Price</p>
              <p className="text-xl font-black text-white">{formatPrice(sellPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Shipping</p>
              <p className="text-sm font-semibold text-zinc-300">{formatPrice(shipping)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist toggle */}
      {campaign.tracklistJson?.length > 0 && (
        <div className="border-t border-white/5">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              {campaign.tracklistJson.length} tracks
            </span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-1">
                  {["A", "B"].map((side) => {
                    const sideTrax = campaign.tracklistJson.filter((t) => t.side === side);
                    if (!sideTrax.length) return null;
                    return (
                      <div key={side}>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Lado {side}</p>
                        {sideTrax.map((t) => (
                          <div key={t.track} className="flex items-center justify-between py-0.5">
                            <span className="text-xs text-zinc-300">
                              <span className="text-zinc-600 mr-2">{side}{t.track}.</span>
                              {t.title}
                            </span>
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

      {/* Pre-order CTA */}
      {isActive && (
        <div className="border-t border-white/5 p-5">
          <AnimatePresence mode="wait">
            {!ordering ? (
              <motion.button
                key="cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOrdering(true)}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
              >
                <ShoppingCart className="w-4 h-4" />
                Pre-ordenar — {formatPrice(sellPrice + shipping)} USD
              </motion.button>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                {checkoutError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />{checkoutError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setOrdering(false)}
                    className="px-4 py-2 rounded-lg bg-white/5 text-sm text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePreOrder}
                    disabled={checkoutLoading}
                    className="flex-1 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
                  >
                    {checkoutLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Redirigiendo...</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" />Confirmar pre-orden</>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 text-center flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Tu pago queda en reserva hasta alcanzar las {minimum} unidades. Si no se alcanza, no se cobra.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

// ─── VinylCoverDesigner ────────────────────────────────────────────────────────

interface VinylCoverDesignerProps {
  title: string;
  artistName: string;
  tracks: TrackEntry[];
  accentColor: string;
  initialFrontUrl?: string;
  initialBackUrl?: string;
  onFrontReady: (url: string) => void;
  onBackReady: (url: string) => void;
}

function VinylCoverDesigner({
  title,
  artistName,
  tracks,
  accentColor,
  initialFrontUrl = "",
  initialBackUrl = "",
  onFrontReady,
  onBackReady,
}: VinylCoverDesignerProps) {
  const [activeTab, setActiveTab] = useState<"front" | "back">("front");
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [frontSaved, setFrontSaved] = useState(!!initialFrontUrl);
  const [backSaved, setBackSaved] = useState(!!initialBackUrl);

  // Front cover
  const [imagePreview, setImagePreview] = useState(initialFrontUrl);
  const [imageUrl, setImageUrl] = useState(initialFrontUrl);
  const [showArtistText, setShowArtistText] = useState(true);
  const [showAlbumTitle, setShowAlbumTitle] = useState(true);
  const [overlayPos, setOverlayPos] = useState<"top" | "bottom">("bottom");
  const [overlayStyle, setOverlayStyle] = useState<"gradient" | "bar" | "none">("gradient");
  const [overlayColor, setOverlayColor] = useState("#000000");
  const [overlayOpacity, setOverlayOpacity] = useState(0.75);
  const [textColor, setTextColor] = useState("#ffffff");
  const [titleText, setTitleText] = useState(title);
  const [artistText, setArtistText] = useState(artistName);

  // Back cover
  const [backBgColor, setBackBgColor] = useState("#090909");
  const [backTextColor, setBackTextColor] = useState("#ffffff");
  const [labelName, setLabelName] = useState("Boostify Records");
  const [catalogNumber, setCatalogNumber] = useState("");
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()));
  const [showBarcode, setShowBarcode] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (title) setTitleText(title); }, [title]);
  useEffect(() => { if (artistName) setArtistText(artistName); }, [artistName]);

  // ── Upload image to Firebase ──────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    setUploadError("");
    setFrontSaved(false);
    try {
      const sRef = fbRef(storage, `vinyl-covers/front-${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(sRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setImageUrl(url);
      onFrontReady(url);
      setFrontSaved(true);
    } catch (err: any) {
      setUploadError("Error al subir: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  function handleUrlPaste(url: string) {
    setImageUrl(url);
    setImagePreview(url);
    if (url.startsWith("http")) {
      onFrontReady(url);
      setFrontSaved(true);
    }
  }

  // ── Draw front cover on 1000x1000 canvas ─────────────────────────────────
  function drawFrontCanvas(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) {
    ctx.clearRect(0, 0, 1000, 1000);
    // Background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 1000, 1000);

    if (img) {
      const scale = Math.max(1000 / img.width, 1000 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (1000 - w) / 2, (1000 - h) / 2, w, h);
    }

    // Overlay
    const barH = 220;
    if (overlayStyle !== "none" && (showArtistText || showAlbumTitle)) {
      const yStart = overlayPos === "bottom" ? 1000 - barH : 0;
      if (overlayStyle === "gradient") {
        const grad = ctx.createLinearGradient(0, yStart, 0, yStart + barH);
        const hex = Math.round(overlayOpacity * 255).toString(16).padStart(2, "0");
        if (overlayPos === "bottom") {
          grad.addColorStop(0, `${overlayColor}00`);
          grad.addColorStop(1, `${overlayColor}${hex}`);
        } else {
          grad.addColorStop(0, `${overlayColor}${hex}`);
          grad.addColorStop(1, `${overlayColor}00`);
        }
        ctx.fillStyle = grad;
      } else {
        ctx.globalAlpha = overlayOpacity;
        ctx.fillStyle = overlayColor;
      }
      ctx.fillRect(0, yStart, 1000, barH);
      ctx.globalAlpha = 1;
    }

    // Text
    if (showArtistText && artistText) {
      ctx.fillStyle = textColor;
      ctx.font = "bold 58px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        artistText.toUpperCase(),
        500,
        overlayPos === "bottom" ? 870 : 100,
      );
    }
    if (showAlbumTitle && titleText) {
      ctx.fillStyle = textColor;
      ctx.font = "38px Arial, sans-serif";
      ctx.globalAlpha = 0.88;
      ctx.textAlign = "center";
      ctx.fillText(titleText, 500, overlayPos === "bottom" ? 935 : 155);
      ctx.globalAlpha = 1;
    }
  }

  // ── Draw back cover on 1000x1000 canvas ──────────────────────────────────
  function drawBackCanvas(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.fillStyle = backBgColor;
    ctx.fillRect(0, 0, 1000, 1000);

    // Top accent line
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, 1000, 5);

    // Artist name
    ctx.fillStyle = backTextColor;
    ctx.font = "bold 62px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((artistText || "ARTIST").toUpperCase(), 500, 95);

    // Album title
    ctx.globalAlpha = 0.72;
    ctx.font = "38px Arial, sans-serif";
    ctx.fillText(titleText || "Album Title", 500, 148);
    ctx.globalAlpha = 1;

    // Divider
    ctx.fillStyle = accentColor + "55";
    ctx.fillRect(60, 175, 880, 1);

    // Tracklist
    const sideA = tracks.filter((t) => t.side === "A" && t.title);
    const sideB = tracks.filter((t) => t.side === "B" && t.title);
    let y = 215;

    const drawSide = (sideTracks: TrackEntry[], sideLabel: string) => {
      if (!sideTracks.length) return;
      ctx.font = "bold 20px Arial, sans-serif";
      ctx.fillStyle = accentColor;
      ctx.textAlign = "left";
      ctx.fillText(`LADO ${sideLabel}`, 60, y);
      y += 34;
      sideTracks.forEach((t) => {
        ctx.font = "24px Arial, sans-serif";
        ctx.fillStyle = backTextColor;
        ctx.globalAlpha = 0.9;
        ctx.textAlign = "left";
        ctx.fillText(`${sideLabel}${t.track}. ${t.title}`, 70, y);
        if (t.duration) {
          ctx.textAlign = "right";
          ctx.globalAlpha = 0.45;
          ctx.fillText(t.duration, 940, y);
        }
        ctx.globalAlpha = 1;
        y += 34;
      });
      y += 16;
    };

    drawSide(sideA, "A");
    drawSide(sideB, "B");

    // Bottom divider
    ctx.fillStyle = accentColor + "55";
    ctx.fillRect(60, 880, 880, 1);

    // Footer
    ctx.font = "18px Arial, sans-serif";
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = backTextColor;
    ctx.textAlign = "left";
    if (labelName) ctx.fillText(labelName.toUpperCase(), 60, 910);
    ctx.textAlign = "center";
    if (catalogNumber) ctx.fillText(catalogNumber, 500, 910);
    ctx.textAlign = "right";
    ctx.fillText(`© ${copyrightYear} ${artistText}`, 940, 910);
    ctx.globalAlpha = 1;

    // Barcode placeholder
    if (showBarcode) {
      const bx = 820, by = 930, bh = 52;
      for (let i = 0; i < 28; i++) {
        const bw = i % 4 === 0 ? 3 : 1.5;
        ctx.fillStyle = backTextColor;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(bx + i * 3.5, by, bw, i % 3 === 0 ? bh : bh * 0.8);
      }
      ctx.globalAlpha = 0.45;
      ctx.font = "13px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("0 00000 00000 0", bx + 49, by + bh + 14);
      ctx.globalAlpha = 1;
    }
  }

  // ── Export front and upload ───────────────────────────────────────────────
  async function handleExportFront() {
    setExporting(true);
    setUploadError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d")!;

      if (imagePreview) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => { drawFrontCanvas(ctx, img); resolve(); };
          img.onerror = () => { drawFrontCanvas(ctx, null); resolve(); };
          img.src = imagePreview;
        });
      } else {
        drawFrontCanvas(ctx, null);
      }

      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png", 0.95));
      const file = new File([blob], `vinyl-front-${Date.now()}.png`, { type: "image/png" });
      const sRef = fbRef(storage, `vinyl-covers/front-${Date.now()}.png`);
      const snapshot = await uploadBytes(sRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setImageUrl(url);
      onFrontReady(url);
      setFrontSaved(true);
    } catch (err: any) {
      setUploadError("Error exportando portada: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  // ── Export back and upload ────────────────────────────────────────────────
  async function handleExportBack() {
    setExporting(true);
    setUploadError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1000;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d")!;
      drawBackCanvas(ctx);

      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png", 0.95));
      const file = new File([blob], `vinyl-back-${Date.now()}.png`, { type: "image/png" });
      const sRef = fbRef(storage, `vinyl-covers/back-${Date.now()}.png`);
      const snapshot = await uploadBytes(sRef, file);
      const url = await getDownloadURL(snapshot.ref);
      onBackReady(url);
      setBackSaved(true);
    } catch (err: any) {
      setUploadError("Error exportando contraportada: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  // Opacity hex helper
  const opHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-white/8">
        {(["front", "back"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === tab ? "text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
            style={activeTab === tab ? { background: `${accentColor}25`, borderBottom: `2px solid ${accentColor}` } : {}}
          >
            {tab === "front" ? (
              <><Palette className="w-3.5 h-3.5" /> Portada Frontal {frontSaved && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}</>
            ) : (
              <><Disc3 className="w-3.5 h-3.5" /> Contraportada {backSaved && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}</>
            )}
          </button>
        ))}
      </div>

      {/* ── FRONT COVER ── */}
      {activeTab === "front" && (
        <div className="space-y-3">
          {/* Image source row */}
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-zinc-300 hover:border-violet-500/50 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? "Subiendo…" : "Subir imagen"}
            </button>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => handleUrlPaste(e.target.value)}
              placeholder="O pega URL de portada 1000×1000…"
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
            />
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>

          {/* Live CSS preview */}
          <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/8 bg-zinc-950 max-h-72">
            {imagePreview ? (
              <img src={imagePreview} alt="cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <ImageIcon className="w-10 h-10 text-zinc-700" />
                <p className="text-xs text-zinc-600">Sube o pega URL de la portada</p>
                <p className="text-[10px] text-zinc-700">Mínimo 1000×1000 px recomendado</p>
              </div>
            )}

            {/* Overlay preview */}
            {imagePreview && overlayStyle !== "none" && (showArtistText || showAlbumTitle) && (
              <div
                className={`absolute inset-x-0 ${overlayPos === "bottom" ? "bottom-0" : "top-0"}`}
                style={{
                  height: "22%",
                  background:
                    overlayStyle === "gradient"
                      ? overlayPos === "bottom"
                        ? `linear-gradient(to bottom, transparent, ${overlayColor}${opHex(overlayOpacity)})`
                        : `linear-gradient(to top, transparent, ${overlayColor}${opHex(overlayOpacity)})`
                      : `${overlayColor}${opHex(overlayOpacity)}`,
                }}
              />
            )}

            {/* Text preview */}
            {imagePreview && (showArtistText || showAlbumTitle) && (
              <div
                className={`absolute inset-x-0 px-3 flex flex-col ${overlayPos === "bottom" ? "bottom-2 items-start" : "top-2 items-start"}`}
                style={{ color: textColor }}
              >
                {showArtistText && <p className="font-black text-[11px] leading-none tracking-widest uppercase drop-shadow-lg">{artistText}</p>}
                {showAlbumTitle && <p className="text-[9px] opacity-80 mt-0.5 drop-shadow">{titleText}</p>}
              </div>
            )}

            <div className="absolute top-2 right-2 text-[9px] bg-black/60 text-zinc-400 px-1.5 py-0.5 rounded">1000×1000</div>
          </div>

          {/* Overlay controls */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Type className="w-3 h-3" /> Títulos en portada
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showArtistText} onChange={(e) => setShowArtistText(e.target.checked)} className="rounded border-white/20" />
                <span className="text-xs text-zinc-300">Nombre artista</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showAlbumTitle} onChange={(e) => setShowAlbumTitle(e.target.checked)} className="rounded border-white/20" />
                <span className="text-xs text-zinc-300">Título álbum</span>
              </label>
            </div>

            {(showArtistText || showAlbumTitle) && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Posición</label>
                  <select
                    value={overlayPos}
                    onChange={(e) => setOverlayPos(e.target.value as "top" | "bottom")}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="bottom" className="bg-zinc-900">Abajo</option>
                    <option value="top" className="bg-zinc-900">Arriba</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Fondo texto</label>
                  <select
                    value={overlayStyle}
                    onChange={(e) => setOverlayStyle(e.target.value as any)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white"
                  >
                    <option value="gradient" className="bg-zinc-900">Degradado</option>
                    <option value="bar" className="bg-zinc-900">Barra sólida</option>
                    <option value="none" className="bg-zinc-900">Sin fondo</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Color texto</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" />
                    <span className="text-[10px] text-zinc-500">{textColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Color fondo + opac.</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" />
                    <input
                      type="range" min="0" max="1" step="0.05"
                      value={overlayOpacity}
                      onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {uploadError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{uploadError}</p>}

          <button
            onClick={handleExportFront}
            disabled={exporting || uploading || !imagePreview}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
          >
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />Generando 1000×1000…</> : <><ImageIcon className="w-4 h-4" />Guardar portada frontal (1000×1000 PNG)</>}
          </button>
          {frontSaved && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Portada guardada correctamente</p>}
        </div>
      )}

      {/* ── BACK COVER ── */}
      {activeTab === "back" && (
        <div className="space-y-3">
          {/* Live CSS preview */}
          <div
            className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/8 p-5 flex flex-col max-h-72"
            style={{ background: backBgColor, color: backTextColor }}
          >
            {/* Accent top line */}
            <div className="absolute top-0 inset-x-0 h-1" style={{ background: accentColor }} />

            {/* Header */}
            <div className="text-center mt-1 mb-2">
              <p className="font-black text-[11px] tracking-widest uppercase">{artistText || "ARTIST NAME"}</p>
              <p className="text-[9px] opacity-65 mt-0.5">{titleText || "Album Title"}</p>
            </div>

            {/* Divider */}
            <div className="h-px mb-2" style={{ background: `${accentColor}55` }} />

            {/* Tracklist */}
            <div className="flex-1 overflow-hidden text-[8px] leading-relaxed">
              {(["A", "B"] as const).map((side) => {
                const st = tracks.filter((t) => t.side === side && t.title);
                if (!st.length) return null;
                return (
                  <div key={side} className="mb-1.5">
                    <p className="text-[7px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accentColor }}>Lado {side}</p>
                    {st.map((t) => (
                      <div key={t.track} className="flex justify-between opacity-85">
                        <span>{side}{t.track}. {t.title}</span>
                        <span className="opacity-50 ml-2">{t.duration}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {!tracks.some((t) => t.title) && (
                <p className="opacity-30 text-[8px] text-center py-4">Agrega tracks en el paso anterior</p>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-1.5 border-t" style={{ borderColor: `${accentColor}35` }}>
              <div className="flex justify-between text-[7px] opacity-50">
                <span>{labelName || "LABEL"}</span>
                <span>{catalogNumber}</span>
                <span>© {copyrightYear}</span>
              </div>
            </div>

            {/* Barcode */}
            {showBarcode && (
              <div className="absolute bottom-3 right-3 flex flex-col items-center">
                <div className="flex gap-px items-end h-6">
                  {Array.from({ length: 22 }, (_, i) => (
                    <div key={i} style={{ width: i % 4 === 0 ? 2 : 1, height: i % 3 === 0 ? "100%" : "72%", background: backTextColor, opacity: 0.75 }} />
                  ))}
                </div>
                <p className="text-[5px] mt-0.5 opacity-40">0 00000 00000 0</p>
              </div>
            )}

            <div className="absolute top-2 right-2 text-[8px] bg-black/60 text-zinc-400 px-1 py-0.5 rounded">1000×1000</div>
          </div>

          {/* Back cover controls */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Diseño de contraportada</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Fondo</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={backBgColor} onChange={(e) => setBackBgColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" />
                  {[["#090909","Negro"],["#f5f5f5","Blanco"],["#1a0a2e","Morado"],["#0d1f0d","Verde"]].map(([c, l]) => (
                    <button key={c} onClick={() => setBackBgColor(c)} className="w-5 h-5 rounded-full border border-white/20" style={{ background: c }} title={l} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Color texto</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={backTextColor} onChange={(e) => setBackTextColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" />
                  {[["#ffffff","Blanco"],["#000000","Negro"]].map(([c, l]) => (
                    <button key={c} onClick={() => setBackTextColor(c)} className="w-5 h-5 rounded-full border border-white/20" style={{ background: c }} title={l} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Sello / Label</label>
                <input
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  placeholder="Ej: Boostify Records"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">N° Catálogo</label>
                <input
                  value={catalogNumber}
                  onChange={(e) => setCatalogNumber(e.target.value)}
                  placeholder="Ej: BM-001"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Año copyright</label>
                <input
                  value={copyrightYear}
                  onChange={(e) => setCopyrightYear(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showBarcode} onChange={(e) => setShowBarcode(e.target.checked)} className="rounded border-white/20" />
                  <span className="text-xs text-zinc-300">Barcode placeholder</span>
                </label>
              </div>
            </div>
          </div>

          {uploadError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{uploadError}</p>}

          <button
            onClick={handleExportBack}
            disabled={exporting}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
          >
            {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />Generando 1000×1000…</> : <><Disc3 className="w-4 h-4" />Guardar contraportada (1000×1000 PNG)</>}
          </button>
          {backSaved && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Contraportada guardada correctamente</p>}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Create Campaign Form (owner only) ─────────────────────────

interface TrackEntry { side: string; track: number; title: string; duration: string }

function CreateCampaignForm({
  artistId,
  accentColor,
  onCreated,
  onCancel,
}: {
  artistId: number;
  accentColor: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Basic info
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [coverImageBack, setCoverImageBack] = useState("");
  const [tracks, setTracks] = useState<TrackEntry[]>([
    { side: "A", track: 1, title: "", duration: "" },
  ]);

  // Auto-generated Boostify print artwork (front + back + booklet)
  const [bookPages, setBookPages] = useState<{ url: string; label: string }[]>([]);
  const [artworkProvider, setArtworkProvider] = useState("");
  const [generatingArt, setGeneratingArt] = useState(false);
  const [artError, setArtError] = useState("");

  // Step 2: Vinyl specs
  const [vinylFormat, setVinylFormat] = useState("12");
  const [vinylType, setVinylType] = useState("1LP");
  const [vinylColor, setVinylColor] = useState("black");
  const [vinylWeight, setVinylWeight] = useState("140g");
  const [vinylSpeed, setVinylSpeed] = useState("33RPM");
  const [sleeveType, setSleeveType] = useState("color");
  const [includeMastering, setIncludeMastering] = useState(false);
  const [withBarcode, setWithBarcode] = useState(true);

  // Step 3: Economics
  const [productionCostTotal, setProductionCostTotal] = useState("");
  const [minimumUnits] = useState(100);
  const [shippingFlatRate, setShippingFlatRate] = useState("12.00");
  const [diggersQuoteRef, setDiggersQuoteRef] = useState("");
  const [copyrightOrg, setCopyrightOrg] = useState("");
  const [copyrightConfirmed, setCopyrightConfirmed] = useState(false);

  const costTotal = parseFloat(productionCostTotal || "0");
  const unitCost = costTotal > 0 ? (costTotal / minimumUnits).toFixed(2) : "0.00";
  const sellPrice = costTotal > 0 ? ((costTotal / minimumUnits) * 2).toFixed(2) : "0.00";
  const totalFanPays = parseFloat(sellPrice) + parseFloat(shippingFlatRate);

  function addTrack() {
    const last = tracks[tracks.length - 1];
    const nextNum = last?.side === "A" && tracks.filter((t) => t.side === "A").length >= 6
      ? { side: "B", track: 1 }
      : { side: last?.side || "A", track: (last?.track || 0) + 1 };
    setTracks([...tracks, { ...nextNum, title: "", duration: "" }]);
  }

  function removeTrack(i: number) {
    setTracks(tracks.filter((_, idx) => idx !== i));
  }

  // ── Auto-generate print artwork (cover + back + booklet) via Boostify ────────
  async function handleAutoGenerateArtwork() {
    setArtError("");
    setGeneratingArt(true);
    try {
      const res = await fetch(
        `/api/vinyl/${artistId}/generate-artwork`,
        await authedJsonInit("POST", {
          title: title || undefined,
          subtitle: subtitle || undefined,
          tracklist: tracks.filter((t) => t.title),
          accentColor,
          includeBook: true,
        })
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar la portada");
      if (data.frontUrl) setCoverImage(data.frontUrl);
      if (data.backUrl) setCoverImageBack(data.backUrl);
      if (Array.isArray(data.bookPages)) setBookPages(data.bookPages);
      if (data.provider) setArtworkProvider(data.provider);
    } catch (err: any) {
      setArtError(err.message || "Error generando la portada");
    } finally {
      setGeneratingArt(false);
    }
  }

  async function handleSubmit() {
    if (!copyrightConfirmed) {
      setError("Debes confirmar que tienes los derechos de autor para este material.");
      return;
    }
    if (!title || !coverImage || !productionCostTotal) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/vinyl/campaigns", await authedJsonInit("POST", {
          artistId,
          title,
          subtitle,
          coverImage1000: coverImage,
          coverImageBack: coverImageBack || undefined,
          tracklistJson: tracks.filter((t) => t.title),
          printFrontUrl: coverImage || undefined,
          printBackUrl: coverImageBack || undefined,
          bookPagesJson: bookPages,
          artworkProvider: artworkProvider || undefined,
          vinylFormat,
          vinylType,
          vinylColor,
          vinylWeight,
          vinylSpeed,
          sleeveType,
          includeMastering,
          withBarcode,
          productionCostTotal: costTotal,
          minimumUnits,
          shippingFlatRate: parseFloat(shippingFlatRate),
          diggersQuoteRef,
          copyrightOrg,
          copyrightConfirmed,
      }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la campaña");
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ["Portada & Tracks", "Especificaciones", "Economía"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-violet-400" />
          <span className="font-bold text-sm text-white">Nueva campaña de vinilo</span>
        </div>
        <button onClick={onCancel} className="text-zinc-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Step tabs */}
      <div className="flex border-b border-white/5">
        {stepLabels.map((label, i) => (
          <button
            key={i}
            onClick={() => i < step && setStep((i + 1) as 1 | 2 | 3)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              step === i + 1 ? "text-white border-b-2 border-violet-500" : "text-zinc-500"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {/* ── Step 1: Portada & Tracks ──────────────────────────────────────── */}
        {step === 1 && (
          <>
            {/* Album title + subtitle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Título del álbum *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Isla Callada"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Subtítulo / Edición</label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Ej: Edición Limitada 2025"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>

            {/* Tracklist FIRST (needed for back cover preview) */}
            <div>
              <label className="text-xs text-zinc-400 mb-2 block flex items-center gap-1.5">
                <Music className="w-3 h-3" /> Tracklist
              </label>
              <div className="space-y-2">
                {tracks.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={t.side}
                      onChange={(e) => setTracks(tracks.map((x, j) => j === i ? { ...x, side: e.target.value } : x))}
                      className="w-14 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white"
                    >
                      <option value="A">A{t.track}</option>
                      <option value="B">B{t.track}</option>
                    </select>
                    <input
                      value={t.title}
                      onChange={(e) => setTracks(tracks.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Título de la canción"
                      className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <input
                      value={t.duration}
                      onChange={(e) => setTracks(tracks.map((x, j) => j === i ? { ...x, duration: e.target.value } : x))}
                      placeholder="3:45"
                      className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button onClick={() => removeTrack(i)} className="text-zinc-600 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addTrack}
                className="mt-2 flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar track
              </button>
            </div>

            {/* ✨ Boostify auto-generate (cover + back + booklet, print-ready) */}
            <div
              className="rounded-xl p-4 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${accentColor}1f, ${accentColor}08)`,
                border: `1px solid ${accentColor}33`,
              }}
            >
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex-1">
                  <p className="text-sm font-black text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
                    Auto-generar artwork con Boostify
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Crea automáticamente la <b className="text-zinc-200">carátula</b> + <b className="text-zinc-200">contraportada</b> con
                    los títulos de las canciones, créditos y un <b className="text-zinc-200">libro</b> del vinilo
                    usando tus imágenes — todo en dimensiones de impresión (12" · 300 DPI).
                  </p>
                </div>
              </div>
              <button
                onClick={handleAutoGenerateArtwork}
                disabled={generatingArt}
                className="mt-3 w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 relative z-10"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
              >
                {generatingArt ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generando artwork de impresión…</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generar carátula + libro (Boostify)</>
                )}
              </button>
              {artError && <p className="text-[11px] text-red-400 mt-2 relative z-10">{artError}</p>}
              {bookPages.length > 0 && (
                <div className="mt-3 relative z-10">
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 mb-2">
                    <CheckCircle2 className="w-3 h-3" /> Carátula, contraportada y libro ({bookPages.length} páginas) listos para imprimir
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {bookPages.map((p, i) => (
                      <a
                        key={i}
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 group"
                        title={`${p.label} — abrir en alta resolución`}
                      >
                        <img
                          src={p.url}
                          alt={p.label}
                          className="w-16 h-16 rounded-lg object-cover border border-white/10 group-hover:border-white/40 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cover Designer */}
            <div className="rounded-xl border border-white/8 bg-white/[0.015] p-3">
              <p className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-violet-400" />
                Diseñador de portadas — 1000×1000 px
                <span className="text-[9px] text-zinc-500 font-normal ml-1">Diggers Factory compatible</span>
              </p>
              <VinylCoverDesigner
                title={title}
                artistName={""}
                tracks={tracks}
                accentColor={accentColor}
                initialFrontUrl={coverImage}
                initialBackUrl={coverImageBack}
                onFrontReady={(url) => setCoverImage(url)}
                onBackReady={(url) => setCoverImageBack(url)}
              />
            </div>

            {/* Preview spinning vinyl if cover is ready */}
            {coverImage && (
              <div className="flex items-center gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <SpinningVinyl coverImage={coverImage} size={100} accentColor={accentColor} spinning />
                <div>
                  <p className="text-xs font-bold text-white">{title || "Sin título"}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Vista previa del vinilo</p>
                  {coverImageBack && (
                    <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Portada + Contraportada listos
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (!title) { alert("Agrega el título del álbum"); return; }
                if (!coverImage) { alert("Guarda la portada frontal antes de continuar"); return; }
                setStep(2);
              }}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
            >
              Siguiente: Especificaciones →
            </button>
          </>
        )}

        {/* ── Step 2: Vinyl specs ───────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Formato", value: vinylFormat, onChange: setVinylFormat, options: [["7", '7" single'], ["10", '10" EP'], ["12", '12" LP']] },
                { label: "Tipo", value: vinylType, onChange: setVinylType, options: [["1LP", "1 LP"], ["2LP", "2 LP"]] },
                { label: "Color", value: vinylColor, onChange: setVinylColor, options: Object.entries(VINYL_COLOR_LABELS) },
                { label: "Peso", value: vinylWeight, onChange: setVinylWeight, options: [["140g", "140g estándar"], ["180g", "180g audiófilo"]] },
                { label: "Velocidad", value: vinylSpeed, onChange: setVinylSpeed, options: [["33RPM", "33 RPM"], ["45RPM", "45 RPM"]] },
                { label: "Cubierta", value: sleeveType, onChange: setSleeveType, options: [["color", "Color"], ["gatefold", "Gatefold"], ["double_gatefold", "Doble Gatefold"], ["discobag", "Discobag"]] },
              ].map(({ label, value, onChange, options }) => (
                <div key={label}>
                  <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
                  <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    {options.map(([v, l]) => (
                      <option key={v} value={v} className="bg-zinc-900">{l}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMastering}
                  onChange={(e) => setIncludeMastering(e.target.checked)}
                  className="rounded border-white/20"
                />
                <span className="text-xs text-zinc-300">Incluir mastering para vinilo (~€60/track)</span>
              </label>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withBarcode}
                  onChange={(e) => setWithBarcode(e.target.checked)}
                  className="rounded border-white/20"
                />
                <span className="text-xs text-zinc-300">Incluir barcode sticker</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-zinc-400 bg-white/5 hover:bg-white/8"
              >
                ← Atrás
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
              >
                Siguiente: Economía →
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Economics ─────────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-4 text-xs text-zinc-300 space-y-1">
              <p className="font-bold text-violet-300 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                Obtén tu cotización en Diggers Factory
              </p>
              <p>Ve a <strong>diggersfactory.com/creation/vinyl</strong>, configura tu vinilo con las mismas especificaciones elegidas y anota el costo total para {minimumUnits} unidades.</p>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Costo de producción total (USD) *</label>
              <input
                type="number"
                value={productionCostTotal}
                onChange={(e) => setProductionCostTotal(e.target.value)}
                placeholder="Ej: 1800"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
              />
              <p className="text-[10px] text-zinc-600 mt-1">Costo total para {minimumUnits} unidades según cotización de Diggers Factory</p>
            </div>

            {costTotal > 0 && (
              <div className="rounded-xl bg-white/5 border border-white/8 p-4 space-y-2">
                <p className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Cálculo automático de precios
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Costo por unidad</span>
                  <span className="text-white font-semibold">{formatPrice(unitCost)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Markup 100%</span>
                  <span className="text-emerald-400 font-semibold">×2</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                  <span className="text-zinc-300 font-semibold">Precio de venta</span>
                  <span className="text-white font-black">{formatPrice(sellPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">+ Envío estimado</span>
                  <span className="text-zinc-300">{formatPrice(shippingFlatRate)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                  <span className="text-emerald-300 font-bold">Fan paga total</span>
                  <span className="text-emerald-300 font-black">{formatPrice(totalFanPays)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-violet-300 font-bold">Tu ganancia neta (100 uds.)</span>
                  <span className="text-violet-300 font-black">
                    {formatPrice((parseFloat(sellPrice) - parseFloat(unitCost)) * minimumUnits)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Ref. cotización Diggers</label>
                <input
                  value={diggersQuoteRef}
                  onChange={(e) => setDiggersQuoteRef(e.target.value)}
                  placeholder="Opcional"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Envío plano (USD)</label>
                <input
                  type="number"
                  value={shippingFlatRate}
                  onChange={(e) => setShippingFlatRate(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Organización de copyright</label>
              <input
                value={copyrightOrg}
                onChange={(e) => setCopyrightOrg(e.target.value)}
                placeholder="BMI, ASCAP, SDRM, SGAE..."
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={copyrightConfirmed}
                onChange={(e) => setCopyrightConfirmed(e.target.checked)}
                className="mt-0.5 rounded border-white/20 flex-shrink-0"
              />
              <span className="text-xs text-zinc-400 leading-relaxed">
                Confirmo que poseo o tengo autorización para prensar este material en vinilo y que tengo afiliación a una organización de derechos de autor o aceptaré el proceso de autorización de prensado de Diggers Factory.
              </span>
            </label>

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />{error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-zinc-400 bg-white/5 hover:bg-white/8"
              >
                ← Atrás
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !copyrightConfirmed}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Publicando...</>
                ) : (
                  <><Disc3 className="w-4 h-4" />Publicar campaña</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Sub-component: Owner Dashboard ──────────────────────────────────────────

function OwnerDashboard({
  campaign,
  accentColor,
}: {
  campaign: VinylCampaign;
  accentColor: string;
}) {
  const qc = useQueryClient();
  const [loadingFulfill, setLoadingFulfill] = useState(false);
  const [fulfillError, setFulfillError] = useState("");
  const [fulfillReport, setFulfillReport] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    title: campaign.title || "",
    subtitle: campaign.subtitle || "",
    sellPrice: campaign.sell_price ?? campaign.sellPrice ?? "0",
    shippingFlatRate: campaign.shipping_flat_rate ?? campaign.shippingFlatRate ?? "12",
    campaignStatus: campaign.campaign_status || campaign.campaignStatus || "active",
    campaignEnd: (campaign as any).campaign_end?.slice(0, 10) ?? "",
    isPublished: (campaign as any).is_published != null ? !!(campaign as any).is_published : campaign.isPublished,
    coverImage1000: campaign.cover_image_1000 ?? campaign.coverImage1000 ?? "",
    coverImageBack: (campaign as any).cover_image_back ?? campaign.coverImageBack ?? "",
  });
  const initialTracks: Array<{ side: string; track: number; title: string; duration: string }> =
    Array.isArray((campaign as any).tracklist_json)
      ? (campaign as any).tracklist_json
      : Array.isArray(campaign.tracklistJson)
        ? campaign.tracklistJson
        : [];
  const [editTracks, setEditTracks] = useState(initialTracks);
  const [coverUploading, setCoverUploading] = useState(false);

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>, slot: "front" | "back") {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setEditError("");
    try {
      const sRef = fbRef(storage, `vinyl-covers/${slot}-${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(sRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setEditForm(f => slot === "front" ? { ...f, coverImage1000: url } : { ...f, coverImageBack: url });
    } catch (err: any) {
      setEditError("Error al subir la imagen: " + err.message);
    } finally {
      setCoverUploading(false);
    }
  }

  function updateTrack(idx: number, patch: Partial<{ side: string; track: number; title: string; duration: string }>) {
    setEditTracks(ts => ts.map((t, i) => i === idx ? { ...t, ...patch } : t));
  }
  function addTrack() {
    setEditTracks(ts => [...ts, { side: "A", track: ts.length + 1, title: "", duration: "" }]);
  }
  function removeEditTrack(idx: number) {
    setEditTracks(ts => ts.filter((_, i) => i !== idx));
  }

  async function handleEditSave() {
    setEditSaving(true); setEditSaved(false); setEditError("");
    try {
      const res = await fetch(`/api/vinyl/campaigns/${campaign.id}`, await authedJsonInit("PATCH", {
          title: editForm.title,
          subtitle: editForm.subtitle || null,
          sellPrice: parseFloat(editForm.sellPrice) || 0,
          shippingFlatRate: parseFloat(editForm.shippingFlatRate) || 0,
          campaignStatus: editForm.campaignStatus,
          campaignEnd: editForm.campaignEnd || null,
          isPublished: editForm.isPublished,
          coverImage1000: editForm.coverImage1000 || null,
          coverImageBack: editForm.coverImageBack || null,
          tracklistJson: editTracks.filter(t => t.title?.trim()),
      }));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      qc.invalidateQueries({ queryKey: [`/api/vinyl/${campaign.artist_id || campaign.artistId}/campaigns`] });
      qc.invalidateQueries({ queryKey: [`vinyl-campaigns-admin-${campaign.artist_id || campaign.artistId}`] });
      setEditSaved(true);
      setTimeout(() => setEditSaved(false), 3000);
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditSaving(false);
    }
  }

  const fieldCls = "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500";
  const labelCls = "text-[10px] text-zinc-500 block mb-1";

  const current = campaign.current_units || campaign.currentUnits || 0;
  const minimum = campaign.minimum_units || campaign.minimumUnits || 100;
  const pct = progressPct(current, minimum);
  const status = (campaign.campaign_status || campaign.campaignStatus || "active") as keyof typeof STATUS_CONFIG;

  async function handleFulfill() {
    setLoadingFulfill(true);
    setFulfillError("");
    try {
      const res = await fetch(`/api/vinyl/campaigns/${campaign.id}/fulfill`, await authedJsonInit("POST"));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setFulfillReport(data.report);
    } catch (err: any) {
      setFulfillError(err.message);
    } finally {
      setLoadingFulfill(false);
    }
  }

  function downloadReport() {
    if (!fulfillReport) return;
    const blob = new Blob([JSON.stringify(fulfillReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vinyl-fulfillment-${campaign.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/8 overflow-hidden space-y-0">
      {/* ── Edit Campaign Panel ── */}
      <div className="p-4 border-b border-white/5">
        <button
          onClick={() => setEditOpen(!editOpen)}
          className="w-full flex items-center justify-between text-xs transition-colors"
          style={{ color: editOpen ? accentColor : "#52525b" }}
        >
          <span className="flex items-center gap-1.5 font-bold">
            <Pencil className="w-3.5 h-3.5" />
            Editar campaña
          </span>
          {editOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <AnimatePresence>
          {editOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3">
                {/* Title + Subtitle */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Título *</label>
                    <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className={fieldCls} placeholder="Título de la campaña" />
                  </div>
                  <div>
                    <label className={labelCls}>Subtítulo</label>
                    <input value={editForm.subtitle} onChange={e => setEditForm(f => ({ ...f, subtitle: e.target.value }))}
                      className={fieldCls} placeholder="Opcional" />
                  </div>
                </div>
                {/* Prices */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Precio de venta (USD)</label>
                    <input type="number" step="0.01" min="0" value={editForm.sellPrice}
                      onChange={e => setEditForm(f => ({ ...f, sellPrice: e.target.value }))}
                      className={fieldCls} placeholder="39.99" />
                  </div>
                  <div>
                    <label className={labelCls}>Envío (USD)</label>
                    <input type="number" step="0.01" min="0" value={editForm.shippingFlatRate}
                      onChange={e => setEditForm(f => ({ ...f, shippingFlatRate: e.target.value }))}
                      className={fieldCls} placeholder="12.00" />
                  </div>
                </div>
                {/* Status + Date */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Estado</label>
                    <select value={editForm.campaignStatus} onChange={e => setEditForm(f => ({ ...f, campaignStatus: e.target.value }))}
                      className={fieldCls}>
                      {["active","goal_reached","fulfilled","cancelled"].map(s => (
                        <option key={s} value={s} className="bg-zinc-900">{s.replace("_"," ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Fin de campaña</label>
                    <input type="date" value={editForm.campaignEnd}
                      onChange={e => setEditForm(f => ({ ...f, campaignEnd: e.target.value }))}
                      className={fieldCls} />
                  </div>
                </div>
                {/* Published toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setEditForm(f => ({ ...f, isPublished: !f.isPublished }))}
                    className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${editForm.isPublished ? "bg-violet-600" : "bg-zinc-700"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${editForm.isPublished ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                  <span className="text-xs text-zinc-300">Publicada (visible para fans)</span>
                </label>
                {/* Cover images */}
                <div className="space-y-2 pt-1">
                  <label className={labelCls}>Portada del disco</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { slot: "front" as const, url: editForm.coverImage1000, label: "Frontal" },
                      { slot: "back" as const, url: editForm.coverImageBack, label: "Trasera" },
                    ]).map(({ slot, url, label }) => (
                      <div key={slot} className="space-y-1.5">
                        <div className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5">
                          {url ? (
                            <img src={url} alt={`Portada ${label}`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <label className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-zinc-300 hover:bg-white/10 cursor-pointer transition-colors">
                          {coverUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          {label}
                          <input type="file" accept="image/*" className="hidden"
                            disabled={coverUploading}
                            onChange={(e) => handleCoverUpload(e, slot)} />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Tracklist */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className={labelCls + " mb-0"}>Canciones del disco</label>
                    <button type="button" onClick={addTrack}
                      className="flex items-center gap-1 text-[10px] text-violet-300 hover:text-violet-200">
                      <Plus className="w-3 h-3" />Añadir
                    </button>
                  </div>
                  {editTracks.length === 0 && (
                    <p className="text-[10px] text-zinc-600">Aún no hay canciones. Añade la primera.</p>
                  )}
                  <div className="space-y-1.5">
                    {editTracks.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select value={t.side} onChange={e => updateTrack(idx, { side: e.target.value })}
                          className="rounded-lg bg-white/5 border border-white/10 px-1.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                          {["A","B","C","D"].map(s => <option key={s} value={s} className="bg-zinc-900">{s}</option>)}
                        </select>
                        <input value={t.title} onChange={e => updateTrack(idx, { title: e.target.value })}
                          className={fieldCls + " flex-1"} placeholder={`Título de la canción ${idx + 1}`} />
                        <input value={t.duration} onChange={e => updateTrack(idx, { duration: e.target.value })}
                          className="w-16 rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500"
                          placeholder="3:24" />
                        <button type="button" onClick={() => removeEditTrack(idx)}
                          className="text-zinc-600 hover:text-red-400 p-1">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                {editError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{editError}</p>}
                <button onClick={handleEditSave} disabled={editSaving}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}>
                  {editSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : editSaved
                    ? <><CheckCircle2 className="w-4 h-4 text-emerald-300" />¡Guardado!</>
                    : <><Save className="w-4 h-4" />Guardar cambios</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stats + Fulfillment ── */}
      <div className="p-4 space-y-3">
      <p className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
        Dashboard de artista
      </p>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pre-órdenes", value: current, icon: Users, color: "text-violet-300" },
          { label: "Progreso", value: `${pct}%`, icon: BarChart3, color: "text-fuchsia-300" },
          { label: "Precio venta", value: formatPrice(campaign.sell_price || campaign.sellPrice), icon: DollarSign, color: "text-emerald-300" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="text-center p-2 rounded-lg bg-white/5">
            <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
            <p className="text-xs font-black text-white">{value}</p>
            <p className="text-[10px] text-zinc-600">{label}</p>
          </div>
        ))}
      </div>

      {status === "goal_reached" && !fulfillReport && (
        <div className="space-y-2">
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ¡Meta alcanzada! Captura los pagos y genera el reporte para Diggers Factory.
          </p>
          {fulfillError && (
            <p className="text-xs text-red-400">{fulfillError}</p>
          )}
          <button
            onClick={handleFulfill}
            disabled={loadingFulfill}
            className="w-full py-2 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: `linear-gradient(135deg, #7c3aed, #ec4899)` }}
          >
            {loadingFulfill ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Procesando cobros...</>
            ) : (
              <><Package className="w-4 h-4" />Capturar pagos & generar reporte</>
            )}
          </button>
        </div>
      )}

      {fulfillReport && (
        <div className="space-y-2">
          <p className="text-xs text-fuchsia-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Reporte generado — {fulfillReport.totalUnits} unidades, pagos capturados.
          </p>
          <button
            onClick={downloadReport}
            className="w-full py-2 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar JSON para Diggers Factory
          </button>
          <a
            href="https://www.diggersfactory.com/es/creation/vinyl"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2 rounded-lg font-bold text-sm text-white flex items-center justify-center gap-2 bg-violet-600/20 border border-violet-500/30 hover:bg-violet-600/30 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Diggers Factory →
          </a>
        </div>
      )}
      </div>{/* end stats section */}
    </div>
  );
}

// ─── Main Module ─────────────────────────────────────────────────────────────

export function VinylPreorderModule({ artist, colors, isOwner: isOwnerProp }: VinylPreorderModuleProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();

  const artistId = artist?.pgId || artist?.id;
  const isOwner = isOwnerProp ?? artist?.isOwner ?? false;
  const accentColor = colors?.hexPrimary || "#7c3aed";

  const { data, isLoading } = useQuery<{ campaigns: VinylCampaign[] }>({
    queryKey: [`/api/vinyl/${artistId}/campaigns`],
    enabled: !!artistId && expanded && !isOwner,
    queryFn: async () => {
      const res = await fetch(`/api/vinyl/${artistId}/campaigns`);
      if (!res.ok) throw new Error("Error loading campaigns");
      return res.json();
    },
  });

  const { data: adminData, isLoading: adminLoading } = useQuery<{ campaigns: VinylCampaign[] }>({
    queryKey: [`vinyl-campaigns-admin-${artistId}`],
    enabled: !!artistId && expanded && isOwner,
    queryFn: async () => {
      const res = await fetch(`/api/vinyl/${artistId}/campaigns/all`, await authedJsonInit("GET"));
      if (!res.ok) throw new Error("Error loading campaigns");
      return res.json();
    },
  });

  const campaigns = (isOwner ? adminData?.campaigns : data?.campaigns) || [];
  const isLoadingCampaigns = isOwner ? adminLoading : isLoading;

  if (!expanded) {
    return (
      <div
        className="rounded-2xl border border-white/8 px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <Disc3 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">Vinyl Records</span>
          {campaigns.length > 0 && (
            <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
              {campaigns.length}
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-zinc-500" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Disc3 className="w-5 h-5 text-violet-400" />
          <h2 className="text-base font-black text-white">Vinyl Records</h2>
          <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
            Pre-Order
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && !showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-white border border-violet-500/30 rounded-full px-3 py-1.5 transition-colors hover:bg-violet-500/10"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva campaña
            </button>
          )}
          <button onClick={() => setExpanded(false)} className="text-zinc-600 hover:text-zinc-400">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <CreateCampaignForm
            artistId={artistId!}
            accentColor={accentColor}
            onCreated={() => {
              setShowCreate(false);
              qc.invalidateQueries({ queryKey: [`/api/vinyl/${artistId}/campaigns`] });
            }}
            onCancel={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>

      {/* Campaigns list */}
      {isLoadingCampaigns ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : campaigns.length === 0 && !showCreate ? (
        <div className="text-center py-12 space-y-3">
          <Disc3 className="w-12 h-12 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 font-semibold text-sm">Sin campañas de vinilo todavía</p>
          {isOwner && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white rounded-xl px-5 py-2.5"
              style={{ background: `linear-gradient(135deg, ${accentColor}, #ec4899)` }}
            >
              <Plus className="w-4 h-4" />
              Lanzar primera campaña de vinilo
            </button>
          )}
          {!isOwner && (
            <p className="text-zinc-600 text-xs">Este artista no tiene campañas activas por el momento.</p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {campaigns.map((c) => (
            <div key={c.id}>
              <CampaignPublicCard campaign={c} accentColor={accentColor} />
              {isOwner && <OwnerDashboard campaign={c} accentColor={accentColor} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default VinylPreorderModule;
