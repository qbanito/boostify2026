import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import {
  MapPin, Guitar, Drum, Piano, Mic2, Headphones, Music, Filter, Loader2,
  Crosshair, Users, Zap, Radio, Clock, DollarSign, Star, TrendingUp,
  Eye, EyeOff, Volume2, Layers, RefreshCw, Send, CheckCircle2, Briefcase, Coins,
  Sparkles, TrendingDown, Flame, Target, ChevronRight, Brain, ChevronDown, ChevronUp,
  Maximize2, Minimize2, Database, Plus, Trash2, X, ShieldCheck, Link2, Power, ScrollText,
} from "lucide-react";
import { Link } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import GigCreditsDashboard from "./gig-credits-dashboard";
import { calculateApplicationCost } from "../../../../shared/gig-credit-pricing";

// ── Instrument icon SVGs for map markers ──
const INSTRUMENT_SVGS: Record<string, { svg: string; gradient: string; emoji: string }> = {
  Guitar: {
    emoji: "🎸",
    gradient: "linear-gradient(135deg,#f97316,#ea580c)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><path d="M19.59 3.41c-.56-.56-1.5-.56-2.06 0L14 6.94l-1.47-1.47-1.06 1.06L13 8.06 5.06 16H3v3h3l7.94-7.94 1.53 1.53 1.06-1.06L15.06 10l3.53-3.53c.57-.56.57-1.5 0-2.06z"/></svg>`,
  },
  Drums: {
    emoji: "🥁",
    gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="10" rx="8" ry="5" fill="rgba(0,0,0,0.2)"/></svg>`,
  },
  Piano: {
    emoji: "🎹",
    gradient: "linear-gradient(135deg,#8b5cf6,#7c3aed)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="6" y="4" width="3" height="10" fill="rgba(0,0,0,0.4)"/><rect x="11" y="4" width="3" height="10" fill="rgba(0,0,0,0.4)"/><rect x="16" y="4" width="3" height="10" fill="rgba(0,0,0,0.4)"/></svg>`,
  },
  Bass: {
    emoji: "🎸",
    gradient: "linear-gradient(135deg,#06b6d4,#0891b2)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><path d="M19.59 3.41c-.56-.56-1.5-.56-2.06 0L14 6.94l-1.47-1.47-1.06 1.06L13 8.06 5.06 16H3v3h3l7.94-7.94 1.53 1.53 1.06-1.06L15.06 10l3.53-3.53c.57-.56.57-1.5 0-2.06z"/></svg>`,
  },
  Vocals: {
    emoji: "🎤",
    gradient: "linear-gradient(135deg,#ec4899,#db2777)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
  },
  Production: {
    emoji: "🎛️",
    gradient: "linear-gradient(135deg,#22c55e,#16a34a)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><rect x="1" y="6" width="22" height="12" rx="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/><rect x="11" y="8" width="2" height="8" rx="1"/></svg>`,
  },
  Mixing: {
    emoji: "🎚️",
    gradient: "linear-gradient(135deg,#eab308,#ca8a04)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><rect x="3" y="2" width="4" height="20" rx="1"/><rect x="10" y="6" width="4" height="16" rx="1"/><rect x="17" y="4" width="4" height="18" rx="1"/></svg>`,
  },
  Violin: {
    emoji: "🎻",
    gradient: "linear-gradient(135deg,#a855f7,#9333ea)",
    svg: `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" stroke="none"><ellipse cx="12" cy="14" rx="5" ry="7"/><line x1="12" y1="7" x2="12" y2="2" stroke="white" stroke-width="2"/></svg>`,
  },
};

const getInstrumentIcon = (instrument: string) => INSTRUMENT_SVGS[instrument] || INSTRUMENT_SVGS.Production;

// ── Create Leaflet divIcon per instrument ──
function makeInstrumentMarker(instrument: string, isRequest: boolean, sizeFactor = 1) {
  const info = getInstrumentIcon(instrument);
  const size = Math.round((isRequest ? 46 : 38) * sizeFactor);
  const border = isRequest ? 3 : 2;
  const pulse = isRequest ? "animation:boostify-pulse 2s ease-in-out infinite;" : "";
  const emojiSize = Math.round((isRequest ? 22 : 17) * sizeFactor);
  return L.divIcon({
    className: "boostify-marker",
    html: `<div style="width:${size}px;height:${size}px;background:${info.gradient};border-radius:50%;border:${border}px solid rgba(255,255,255,0.92);box-shadow:0 4px 14px rgba(0,0,0,0.5),0 0 22px rgba(249,115,22,0.18);display:flex;align-items:center;justify-content:center;${pulse}cursor:pointer;transition:transform .2s;">
      <span style="font-size:${emojiSize}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">${info.emoji}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// ── Zoom → marker scale factor (bigger icons that adapt to the map) ──
function zoomSizeFactor(zoom: number) {
  // zoom 2 (world) → 1.0, zoom 12+ (city) → ~1.9
  return Math.max(1, Math.min(1.9, 1 + (zoom - 2) * 0.09));
}

// ── Simulated live orders ──
interface SimOrder {
  id: number;
  title: string;
  instrument: string;
  budget: number;
  city: string;
  lat: number;
  lng: number;
  bids: number;
  urgency: "normal" | "urgent" | "flash";
  timeAgo: string;
  genre: string;
  userName: string;
}

const SIMULATED_ORDERS: SimOrder[] = [
  { id: 1, title: "Session Guitarist for Pop Track", instrument: "Guitar", budget: 250, city: "Los Angeles, CA", lat: 34.0522, lng: -118.2437, bids: 5, urgency: "urgent", timeAgo: "2m ago", genre: "Pop", userName: "Marcus J." },
  { id: 2, title: "Drummer needed for Rock Album", instrument: "Drums", budget: 400, city: "Nashville, TN", lat: 36.1627, lng: -86.7816, bids: 3, urgency: "flash", timeAgo: "30s ago", genre: "Rock", userName: "Sarah K." },
  { id: 3, title: "Piano arrangement for Wedding", instrument: "Piano", budget: 180, city: "New York, NY", lat: 40.7128, lng: -74.006, bids: 8, urgency: "normal", timeAgo: "15m ago", genre: "Classical", userName: "David L." },
  { id: 4, title: "Vocal recording - R&B Single", instrument: "Vocals", budget: 350, city: "Atlanta, GA", lat: 33.749, lng: -84.388, bids: 4, urgency: "urgent", timeAgo: "5m ago", genre: "R&B", userName: "Alicia M." },
  { id: 5, title: "Bass player for Jazz Sessions", instrument: "Bass", budget: 200, city: "Chicago, IL", lat: 41.8781, lng: -87.6298, bids: 2, urgency: "normal", timeAgo: "25m ago", genre: "Jazz", userName: "Tony R." },
  { id: 6, title: "Mix & Master - 5 track EP", instrument: "Mixing", budget: 800, city: "Miami, FL", lat: 25.7617, lng: -80.1918, bids: 6, urgency: "flash", timeAgo: "1m ago", genre: "Hip-Hop", userName: "DJ Blaze" },
  { id: 7, title: "Beat Production for Rap Album", instrument: "Production", budget: 500, city: "Houston, TX", lat: 29.7604, lng: -95.3698, bids: 7, urgency: "urgent", timeAgo: "8m ago", genre: "Trap", userName: "Mike D." },
  { id: 8, title: "Violin solo for Film Score", instrument: "Violin", budget: 600, city: "San Francisco, CA", lat: 37.7749, lng: -122.4194, bids: 1, urgency: "normal", timeAgo: "45m ago", genre: "Orchestral", userName: "Erica S." },
  { id: 9, title: "Electric Guitar for Metal Track", instrument: "Guitar", budget: 300, city: "Denver, CO", lat: 39.7392, lng: -104.9903, bids: 3, urgency: "normal", timeAgo: "12m ago", genre: "Metal", userName: "Jake W." },
  { id: 10, title: "Full Production + Vocals", instrument: "Production", budget: 1200, city: "London, UK", lat: 51.5074, lng: -0.1278, bids: 9, urgency: "flash", timeAgo: "15s ago", genre: "Electronic", userName: "Zara A." },
  { id: 11, title: "Acoustic Guitar for Indie Folk", instrument: "Guitar", budget: 150, city: "Portland, OR", lat: 45.5152, lng: -122.6784, bids: 2, urgency: "normal", timeAgo: "35m ago", genre: "Indie Folk", userName: "Lily T." },
  { id: 12, title: "Drum Programming Hip-Hop", instrument: "Drums", budget: 220, city: "Detroit, MI", lat: 42.3314, lng: -83.0458, bids: 4, urgency: "urgent", timeAgo: "3m ago", genre: "Hip-Hop", userName: "Carlos P." },
  { id: 13, title: "Piano + Strings arrangement", instrument: "Piano", budget: 750, city: "Berlin, DE", lat: 52.52, lng: 13.405, bids: 2, urgency: "normal", timeAgo: "1h ago", genre: "Cinematic", userName: "Hana M." },
  { id: 14, title: "Vocal Feature - Latin Pop", instrument: "Vocals", budget: 500, city: "Mexico City, MX", lat: 19.4326, lng: -99.1332, bids: 6, urgency: "flash", timeAgo: "45s ago", genre: "Latin Pop", userName: "Sofia R." },
  { id: 15, title: "Bass Slap for Funk Track", instrument: "Bass", budget: 280, city: "Philadelphia, PA", lat: 39.9526, lng: -75.1652, bids: 1, urgency: "normal", timeAgo: "50m ago", genre: "Funk", userName: "Derek B." },
  { id: 16, title: "Mix + Master Reggaeton EP", instrument: "Mixing", budget: 950, city: "San Juan, PR", lat: 18.4655, lng: -66.1057, bids: 5, urgency: "urgent", timeAgo: "7m ago", genre: "Reggaeton", userName: "J. Rivera" },
];

const SIMULATED_MUSICIANS = [
  { id: 101, name: "Alex Rivera", instrument: "Guitar", rating: 4.9, price: 85, lat: 34.08, lng: -118.32, verified: true, jobs: 127, genre: "Rock / Pop" },
  { id: 102, name: "Nina Patel", instrument: "Vocals", rating: 5.0, price: 120, lat: 40.73, lng: -73.99, verified: true, jobs: 89, genre: "R&B / Soul" },
  { id: 103, name: "James Carter", instrument: "Drums", rating: 4.7, price: 95, lat: 41.89, lng: -87.62, verified: false, jobs: 54, genre: "Jazz / Funk" },
  { id: 104, name: "Mei Lin Chen", instrument: "Piano", rating: 4.8, price: 110, lat: 37.78, lng: -122.41, verified: true, jobs: 203, genre: "Classical / Film" },
  { id: 105, name: "DJ Nexus", instrument: "Production", rating: 4.6, price: 150, lat: 25.78, lng: -80.18, verified: true, jobs: 312, genre: "Electronic" },
  { id: 106, name: "Maria Gonzalez", instrument: "Vocals", rating: 4.9, price: 100, lat: 19.44, lng: -99.12, verified: true, jobs: 68, genre: "Latin / Pop" },
  { id: 107, name: "Tommy Bassline", instrument: "Bass", rating: 4.5, price: 75, lat: 36.17, lng: -86.77, verified: false, jobs: 41, genre: "Country / Rock" },
  { id: 108, name: "Elena Volkov", instrument: "Violin", rating: 5.0, price: 140, lat: 51.51, lng: -0.12, verified: true, jobs: 156, genre: "Orchestral" },
  { id: 109, name: "RhythmKing", instrument: "Drums", rating: 4.8, price: 90, lat: 33.76, lng: -84.39, verified: true, jobs: 95, genre: "Trap / Hip-Hop" },
  { id: 110, name: "Studio Sage", instrument: "Mixing", rating: 4.9, price: 200, lat: 29.77, lng: -95.36, verified: true, jobs: 410, genre: "All genres" },
];

// ── Urgency helpers ──
const URGENCY_CONFIG = {
  flash: { label: "⚡ FLASH", color: "#ef4444", bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", glow: "0 0 20px rgba(239,68,68,0.3)" },
  urgent: { label: "🔥 URGENT", color: "#f97316", bg: "rgba(249,115,22,0.15)", border: "rgba(249,115,22,0.4)", glow: "0 0 16px rgba(249,115,22,0.25)" },
  normal: { label: "📋 Open", color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)", glow: "none" },
};

// ── External data-source integration ──
interface ExternalSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

const INSTRUMENT_KEYS = ["Guitar", "Drums", "Piano", "Bass", "Vocals", "Production", "Mixing", "Violin"];
function normalizeInstrument(v: any): string {
  if (!v) return "Production";
  const s = String(v);
  const hit = INSTRUMENT_KEYS.find((k) => k.toLowerCase() === s.toLowerCase());
  return hit || "Production";
}
function num(v: any): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Map an arbitrary external record into a SimOrder, or null if it lacks coordinates.
function toExternalOrder(rec: any, idx: number): SimOrder | null {
  const lat = num(rec.lat ?? rec.latitude ?? rec.Lat);
  const lng = num(rec.lng ?? rec.lon ?? rec.longitude ?? rec.Lng);
  if (lat == null || lng == null) return null;
  return {
    id: 900000 + idx,
    title: String(rec.title ?? rec.name ?? rec.service ?? "External order"),
    instrument: normalizeInstrument(rec.instrument ?? rec.instrumentNeeded ?? rec.category),
    budget: num(rec.budget ?? rec.budgetMax ?? rec.price) ?? 0,
    city: String(rec.city ?? rec.location ?? "Remote"),
    lat, lng,
    bids: Number(rec.bids ?? rec.totalBids ?? 0),
    urgency: (["flash", "urgent", "normal"].includes(rec.urgency) ? rec.urgency : "normal") as SimOrder["urgency"],
    timeAgo: String(rec.timeAgo ?? "live"),
    genre: String(rec.genre ?? "—"),
    userName: String(rec.userName ?? rec.client ?? "External"),
  };
}
function toExternalMusician(rec: any, idx: number) {
  const lat = num(rec.lat ?? rec.latitude);
  const lng = num(rec.lng ?? rec.lon ?? rec.longitude);
  if (lat == null || lng == null) return null;
  return {
    id: 950000 + idx,
    name: String(rec.name ?? rec.userName ?? "External musician"),
    instrument: normalizeInstrument(rec.instrument ?? rec.category),
    rating: num(rec.rating) ?? 5,
    price: num(rec.price ?? rec.rate) ?? 0,
    lat, lng,
    verified: Boolean(rec.verified),
    jobs: Number(rec.jobs ?? 0),
    genre: String(rec.genre ?? "—"),
  };
}

export function ProducerMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const musicianLayerRef = useRef<L.LayerGroup | null>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [instrumentFilter, setInstrumentFilter] = useState("all");
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showMusicians, setShowMusicians] = useState(true);
  const [showOrders, setShowOrders] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<SimOrder | null>(null);
  const [liveCount, setLiveCount] = useState(SIMULATED_ORDERS.length);
  const [mapZoom, setMapZoom] = useState(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const { toast } = useToast();

  // ── External database / data-source integrations ──
  const SOURCES_KEY = "boostify_producer_map_sources";
  const [showDataSources, setShowDataSources] = useState(false);
  const [dataSources, setDataSources] = useState<ExternalSource[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(SOURCES_KEY) || "[]"); } catch { return []; }
  });
  const [sourceForm, setSourceForm] = useState({ name: "", url: "" });
  const [externalOrders, setExternalOrders] = useState<SimOrder[]>([]);
  const [externalMusicians, setExternalMusicians] = useState<typeof SIMULATED_MUSICIANS>([]);
  const [sourceStatus, setSourceStatus] = useState<Record<string, "ok" | "error" | "loading">>({});

  // Apply dialog state
  const [applyOrder, setApplyOrder] = useState<SimOrder | null>(null);
  const [applyForm, setApplyForm] = useState({ amount: "", message: "", delivery: "2-3 days" });
  const [applySubmitted, setApplySubmitted] = useState<Set<number>>(new Set());

  // Gig Credits
  const [showCredits, setShowCredits] = useState(false);
  const { data: creditAccount } = useQuery<{ balance: number }>({ queryKey: ["/api/gig-credits/balance"] });
  const creditBalance = creditAccount?.balance ?? 0;

  // ── Smart Proposals (supply/demand intelligence based on viewport) ──
  const [viewportBounds, setViewportBounds] = useState<{ north: number; south: number; east: number; west: number; centerLat: number; centerLng: number; zoom: number } | null>(null);
  const [proposalsOpen, setProposalsOpen] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  const [proposalsTick, setProposalsTick] = useState(0);
  const [activeProposalIdx, setActiveProposalIdx] = useState(0);

  // Fetch real map data (merged with simulations)
  const { data: mapData, isLoading } = useQuery({
    queryKey: ["/api/service-requests/map/data"],
    queryFn: () => apiRequest("GET", "/api/service-requests/map/data"),
    refetchInterval: 30000,
  });

  // Handle apply button clicks from Leaflet popups
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('[data-apply-order]') as HTMLElement;
      if (btn) {
        const orderId = parseInt(btn.getAttribute('data-apply-order') || '0');
        const order = SIMULATED_ORDERS.find((o) => o.id === orderId);
        if (order) {
          setApplyOrder(order);
          setApplyForm({ amount: String(order.budget), message: "", delivery: "2-3 days" });
        }
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Simulate live counter
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveCount((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(SIMULATED_ORDERS.length - 3, Math.min(SIMULATED_ORDERS.length + 5, prev + delta));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Periodic shuffle of proposals so they feel alive even without map movement
  useEffect(() => {
    const t = setInterval(() => setProposalsTick(v => v + 1), 12000);
    return () => clearInterval(t);
  }, []);

  // Auto-rotate the highlighted proposal
  useEffect(() => {
    const t = setInterval(() => setActiveProposalIdx(v => v + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Initialize map with modern style
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [38.0, -40.0],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      minZoom: 2,
      maxZoom: 18,
      worldCopyJump: true,
    });

    // Modern dark GRAY styled tile layer (gray + orange palette)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // Custom zoom control position
    L.control.zoom({ position: "bottomright" }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    musicianLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapZoom(map.getZoom());

    // Track viewport for Smart Proposals
    const updateBounds = () => {
      const b = map.getBounds();
      const c = map.getCenter();
      setMapZoom(map.getZoom());
      setViewportBounds({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
        centerLat: c.lat,
        centerLng: c.lng,
        zoom: map.getZoom(),
      });
    };
    updateBounds();
    map.on("moveend", updateBounds);
    map.on("zoomend", updateBounds);

    // Inject marker animations CSS
    const style = document.createElement("style");
    style.textContent = `
      @keyframes boostify-pulse {
        0%, 100% { box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 0 rgba(249,115,22,0.5); transform: scale(1); }
        50% { box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 14px rgba(249,115,22,0); transform: scale(1.08); }
      }
      @keyframes boostify-flash {
        0%, 100% { box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 0 rgba(239,68,68,0.6); transform: scale(1); }
        50% { box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 0 18px rgba(239,68,68,0); transform: scale(1.12); }
      }
      .boostify-marker { background: none !important; border: none !important; }
      .boostify-marker div:hover { transform: scale(1.22) !important; z-index: 9999 !important; }
      .leaflet-container { background: #16181d !important; }
      .leaflet-popup-content-wrapper {
        background: rgba(23,23,26,0.96) !important;
        border: 1px solid rgba(249,115,22,0.25) !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 40px rgba(0,0,0,0.6) !important;
        backdrop-filter: blur(12px) !important;
      }
      .leaflet-popup-tip { background: rgba(23,23,26,0.96) !important; }
      .leaflet-popup-close-button { color: #a1a1aa !important; font-size: 20px !important; top: 8px !important; right: 10px !important; }
      .leaflet-control-zoom a { background: rgba(23,23,26,0.92) !important; color: #f97316 !important; border-color: rgba(249,115,22,0.25) !important; }
      .leaflet-control-zoom a:hover { background: rgba(249,115,22,0.15) !important; color: #fb923c !important; }
      .boostify-map-fs:fullscreen { background: #0c0d10; padding: 0; border-radius: 0; }
      .boostify-map-fs:fullscreen .boostify-map-canvas { height: 100vh !important; }
    `;
    document.head.appendChild(style);
    styleRef.current = style;

    return () => {
      map.remove();
      mapRef.current = null;
      style.remove();
    };
  }, []);

  // ── Smart Proposals: supply/demand intelligence for current viewport ──
  type SmartProposal = {
    id: string;
    kind: "demand_hot" | "supply_gap" | "price_premium" | "flash_deal" | "region_opportunity" | "underserved" | "low_competition" | "trend";
    icon: string;
    instrument?: string;
    title: string;
    subtitle: string;
    cta: string;
    score: number; // 0-100 priority
    color: string; // tailwind from class
    action?: () => void;
  };

  const isInBounds = useCallback((lat: number, lng: number) => {
    if (!viewportBounds) return true;
    const { north, south, east, west } = viewportBounds;
    const lngOk = west <= east ? (lng >= west && lng <= east) : (lng >= west || lng <= east);
    return lat >= south && lat <= north && lngOk;
  }, [viewportBounds]);

  const regionLabel = useMemo(() => {
    if (!viewportBounds) return "Worldwide";
    const { centerLat: lat, centerLng: lng, zoom } = viewportBounds;
    if (zoom < 4) return "Worldwide";
    // Find closest known city center from simulated dataset
    const allPoints = [...SIMULATED_ORDERS, ...SIMULATED_MUSICIANS.map(m => ({ ...m, city: (m as any).city || "" }))];
    let closest: any = null; let bestDist = Infinity;
    for (const p of SIMULATED_ORDERS) {
      const d = Math.hypot(p.lat - lat, p.lng - lng);
      if (d < bestDist) { bestDist = d; closest = p; }
    }
    if (closest && bestDist < 25) return closest.city.split(",")[0];
    // Continent fallback
    if (lat > 25 && lng > -30 && lng < 60) return "Europe";
    if (lat > 0 && lng > 60 && lng < 150) return "Asia";
    if (lat < 5 && lng > 100 && lng < 180) return "Oceania";
    if (lat > 15 && lng > -170 && lng < -50) return "North America";
    if (lat < 15 && lng > -90 && lng < -30) return "Latin America";
    if (lat < 0 && lng > -20 && lng < 55) return "Africa";
    return "this region";
  }, [viewportBounds]);

  const smartProposals = useMemo<SmartProposal[]>(() => {
    void proposalsTick; // re-roll
    const visibleOrders = SIMULATED_ORDERS.filter(o => isInBounds(o.lat, o.lng));
    const visibleMusicians = SIMULATED_MUSICIANS.filter(m => isInBounds(m.lat, m.lng));

    // Group by instrument
    const demandByInst: Record<string, number> = {};
    const supplyByInst: Record<string, number> = {};
    const budgetByInst: Record<string, number[]> = {};
    visibleOrders.forEach(o => {
      demandByInst[o.instrument] = (demandByInst[o.instrument] || 0) + 1;
      (budgetByInst[o.instrument] = budgetByInst[o.instrument] || []).push(o.budget);
    });
    visibleMusicians.forEach(m => {
      supplyByInst[m.instrument] = (supplyByInst[m.instrument] || 0) + 1;
    });

    const proposals: SmartProposal[] = [];
    const allInstruments = Array.from(new Set([...Object.keys(demandByInst), ...Object.keys(supplyByInst)]));

    // 1. Hot demand — instruments where demand >> supply
    allInstruments.forEach(inst => {
      const d = demandByInst[inst] || 0;
      const s = supplyByInst[inst] || 0;
      if (d >= 2 && d > s + 1) {
        const inf = getInstrumentIcon(inst);
        const avgBudget = Math.round((budgetByInst[inst] || []).reduce((a, b) => a + b, 0) / Math.max(1, (budgetByInst[inst] || []).length));
        proposals.push({
          id: `demand-${inst}`,
          kind: "demand_hot",
          icon: inf.emoji,
          instrument: inst,
          title: `🔥 Hot demand: ${inst}`,
          subtitle: `${d} open jobs vs only ${s} musicians in ${regionLabel}. Avg budget $${avgBudget}.`,
          cta: `Find ${inst} gigs`,
          score: 90 + d * 2,
          color: "from-rose-500 to-orange-500",
          action: () => setInstrumentFilter(inst),
        });
      }
    });

    // 2. Supply gap — instruments with demand and zero supply visible
    allInstruments.forEach(inst => {
      const d = demandByInst[inst] || 0;
      const s = supplyByInst[inst] || 0;
      if (d >= 1 && s === 0) {
        const inf = getInstrumentIcon(inst);
        proposals.push({
          id: `gap-${inst}`,
          kind: "supply_gap",
          icon: inf.emoji,
          instrument: inst,
          title: `⚠️ Supply gap: ${inst}`,
          subtitle: `Zero ${inst.toLowerCase()} musicians visible in ${regionLabel} — premium opportunity.`,
          cta: "List your service",
          score: 85,
          color: "from-amber-500 to-yellow-500",
          action: () => setInstrumentFilter(inst),
        });
      }
    });

    // 3. Premium pricing — average budget significantly higher than typical
    allInstruments.forEach(inst => {
      const budgets = budgetByInst[inst] || [];
      if (budgets.length >= 2) {
        const avg = budgets.reduce((a, b) => a + b, 0) / budgets.length;
        if (avg >= 500) {
          const inf = getInstrumentIcon(inst);
          proposals.push({
            id: `premium-${inst}`,
            kind: "price_premium",
            icon: inf.emoji,
            instrument: inst,
            title: `💎 Premium ${inst} jobs`,
            subtitle: `${budgets.length} ${inst.toLowerCase()} gigs averaging $${Math.round(avg)} in ${regionLabel}.`,
            cta: "View premium jobs",
            score: 75 + Math.round(avg / 50),
            color: "from-emerald-500 to-cyan-500",
            action: () => setInstrumentFilter(inst),
          });
        }
      }
    });

    // 4. Flash deals visible
    const flashOrders = visibleOrders.filter(o => o.urgency === "flash");
    if (flashOrders.length > 0) {
      const top = flashOrders[0];
      const inf = getInstrumentIcon(top.instrument);
      proposals.push({
        id: `flash-${top.id}`,
        kind: "flash_deal",
        icon: "⚡",
        instrument: top.instrument,
        title: `⚡ ${flashOrders.length} flash deal${flashOrders.length > 1 ? "s" : ""} now`,
        subtitle: `${top.title} — $${top.budget} in ${top.city}. Closing soon.`,
        cta: "Apply fast",
        score: 95,
        color: "from-red-500 to-pink-500",
        action: () => {
          setSelectedOrder(top);
          mapRef.current?.setView([top.lat, top.lng], 8, { animate: true, duration: 0.8 });
        },
      });
    }

    // 5. Low competition — orders in viewport with very few bids
    const lowCompetition = visibleOrders.filter(o => o.bids <= 2).sort((a, b) => a.bids - b.bids);
    if (lowCompetition.length >= 1) {
      const top = lowCompetition[0];
      const inf = getInstrumentIcon(top.instrument);
      proposals.push({
        id: `lowcomp-${top.id}`,
        kind: "low_competition",
        icon: "🎯",
        instrument: top.instrument,
        title: `🎯 Low competition window`,
        subtitle: `"${top.title}" has only ${top.bids} bid${top.bids === 1 ? "" : "s"} — high win rate.`,
        cta: "Apply now",
        score: 80,
        color: "from-blue-500 to-indigo-500",
        action: () => {
          setApplyOrder(top);
          setApplyForm({ amount: String(top.budget), message: "", delivery: "2-3 days" });
        },
      });
    }

    // 6. Region opportunity — empty viewport
    if (visibleOrders.length === 0 && visibleMusicians.length === 0 && viewportBounds && viewportBounds.zoom >= 5) {
      proposals.push({
        id: "empty-region",
        kind: "region_opportunity",
        icon: "🌍",
        title: `🌍 Untapped market in ${regionLabel}`,
        subtitle: `No services or musicians active here yet. Be the first — early-mover advantage.`,
        cta: "Post a request",
        score: 70,
        color: "from-violet-500 to-fuchsia-500",
      });
    }

    // 7. Underserved — many musicians but few jobs (good for clients posting requests)
    allInstruments.forEach(inst => {
      const d = demandByInst[inst] || 0;
      const s = supplyByInst[inst] || 0;
      if (s >= 2 && d === 0) {
        const inf = getInstrumentIcon(inst);
        proposals.push({
          id: `underserved-${inst}`,
          kind: "underserved",
          icon: inf.emoji,
          instrument: inst,
          title: `🛒 Buyer's market: ${inst}`,
          subtitle: `${s} ${inst.toLowerCase()} pros available in ${regionLabel}, no jobs posted. Great rates.`,
          cta: "Post a job",
          score: 65,
          color: "from-teal-500 to-emerald-500",
          action: () => setInstrumentFilter(inst),
        });
      }
    });

    // 8. Trending — region-wide momentum signal (random pick)
    if (visibleOrders.length >= 4) {
      const total = visibleOrders.length;
      const totalBudget = visibleOrders.reduce((a, b) => a + b.budget, 0);
      proposals.push({
        id: `trend-${regionLabel}`,
        kind: "trend",
        icon: "📈",
        title: `📈 ${regionLabel} is trending`,
        subtitle: `${total} active jobs · $${totalBudget.toLocaleString()} total volume in view.`,
        cta: "Explore region",
        score: 60 + total,
        color: "from-orange-500 to-amber-500",
      });
    }

    // Fallback: always have at least one proposal
    if (proposals.length === 0) {
      proposals.push({
        id: "explore",
        icon: "🧭",
        kind: "trend",
        title: `🧭 Explore the global map`,
        subtitle: `Pan or zoom to see live supply & demand intelligence for any region.`,
        cta: "Center on me",
        score: 50,
        color: "from-slate-500 to-slate-600",
        action: () => handleLocate(),
      });
    }

    // Sort by score, slight randomization for variety, take top 5
    return proposals
      .map(p => ({ ...p, score: p.score + Math.random() * 8 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [viewportBounds, regionLabel, isInBounds, proposalsTick]);

  // ── Place markers ──
  const placeMarkers = useCallback(() => {
    if (!mapRef.current || !markersRef.current || !musicianLayerRef.current) return;

    markersRef.current.clearLayers();
    musicianLayerRef.current.clearLayers();

    const sf = zoomSizeFactor(mapZoom);
    const orderSize = Math.round(44 * sf);
    const orderEmoji = Math.round(22 * sf);
    const musicianSize = Math.round(36 * sf);
    const musicianEmoji = Math.round(16 * sf);

    // Merge real data with simulated
    const realRequests = mapData?.data?.requests || [];
    const realMusicians = mapData?.data?.musicians || [];

    // Place simulated + external order markers
    if (showOrders) {
      [...SIMULATED_ORDERS, ...externalOrders].forEach((order) => {
        if (instrumentFilter !== "all" && order.instrument !== instrumentFilter) return;

        const uCfg = URGENCY_CONFIG[order.urgency];
        const inst = getInstrumentIcon(order.instrument);
        const markerIcon = L.divIcon({
          className: "boostify-marker",
          html: `<div style="width:${orderSize}px;height:${orderSize}px;background:${inst.gradient};border-radius:50%;border:3px solid rgba(255,255,255,0.92);box-shadow:0 4px 14px rgba(0,0,0,0.5),${uCfg.glow};display:flex;align-items:center;justify-content:center;animation:${order.urgency === "flash" ? "boostify-flash" : "boostify-pulse"} ${order.urgency === "flash" ? "1.2s" : "2.5s"} ease-in-out infinite;cursor:pointer;transition:transform .15s;">
            <span style="font-size:${orderEmoji}px;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));">${inst.emoji}</span>
          </div>`,
          iconSize: [orderSize, orderSize],
          iconAnchor: [orderSize / 2, orderSize / 2],
          popupAnchor: [0, -(orderSize / 2 + 4)],
        });

        const marker = L.marker([order.lat, order.lng], { icon: markerIcon });
        marker.bindPopup(`
          <div style="min-width:260px;max-width:300px;font-family:'Inter',system-ui,sans-serif;padding:4px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <div style="width:36px;height:36px;background:${inst.gradient};border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">${inst.emoji}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:14px;color:#f1f5f9;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${order.title}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:1px;">${order.city}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
              <span style="background:${uCfg.bg};color:${uCfg.color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid ${uCfg.border};">${uCfg.label}</span>
              <span style="background:rgba(34,197,94,0.12);color:#22c55e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid rgba(34,197,94,0.3);">💰 $${order.budget}</span>
              <span style="background:rgba(148,163,184,0.1);color:#94a3b8;padding:3px 10px;border-radius:20px;font-size:11px;border:1px solid rgba(148,163,184,0.2);">${order.genre}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(148,163,184,0.1);">
              <div style="display:flex;gap:12px;">
                <span style="font-size:11px;color:#64748b;">📨 ${order.bids} bids</span>
                <span style="font-size:11px;color:#64748b;">🕐 ${order.timeAgo}</span>
              </div>
              <span style="font-size:11px;color:#94a3b8;">by ${order.userName}</span>
            </div>
            <button data-apply-order="${order.id}" style="width:100%;margin-top:10px;padding:8px 16px;background:linear-gradient(135deg,#f97316,#ea580c);color:white;border:none;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .2s;letter-spacing:0.3px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
              🎯 Apply Now
            </button>
          </div>
        `, { maxWidth: 320, className: "boostify-popup" });

        marker.on("click", () => setSelectedOrder(order));
        markersRef.current!.addLayer(marker);
      });

      // Also place real requests
      realRequests.forEach((r: any) => {
        if (!r.latitude || !r.longitude) return;
        if (instrumentFilter !== "all" && r.instrumentNeeded !== instrumentFilter) return;
        const marker = L.marker([parseFloat(r.latitude), parseFloat(r.longitude)], { icon: makeInstrumentMarker(r.instrumentNeeded || "Production", true, sf) });
        marker.bindPopup(`
          <div style="min-width:220px;font-family:'Inter',system-ui,sans-serif;padding:4px;">
            <div style="font-weight:700;font-size:14px;color:#f97316;margin-bottom:6px;">⚡ ${r.title}</div>
            <div style="display:flex;gap:6px;margin-bottom:6px;">
              <span style="background:rgba(34,197,94,0.12);color:#22c55e;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:600;">$${r.budgetMin} - $${r.budgetMax}</span>
              <span style="font-size:12px;color:#94a3b8;">${r.instrumentNeeded}</span>
            </div>
            <div style="font-size:11px;color:#64748b;">${r.totalBids} bids · ${r.city || "Remote"}</div>
          </div>
        `);
        markersRef.current!.addLayer(marker);
      });
    }

    // Place musician markers
    if (showMusicians) {
      [...SIMULATED_MUSICIANS, ...externalMusicians].forEach((m) => {
        if (instrumentFilter !== "all" && m.instrument !== instrumentFilter) return;
        const inst = getInstrumentIcon(m.instrument);
        const musicianIcon = L.divIcon({
          className: "boostify-marker",
          html: `<div style="width:${musicianSize}px;height:${musicianSize}px;background:linear-gradient(135deg,#27272a,#3f3f46);border-radius:50%;border:2px solid rgba(249,115,22,0.35);box-shadow:0 3px 10px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s,border-color .2s;" onmouseover="this.style.borderColor='${inst.gradient.match(/#[a-f0-9]+/i)?.[0] || "#f97316"}'" onmouseout="this.style.borderColor='rgba(249,115,22,0.35)'">
            <span style="font-size:${musicianEmoji}px;">${inst.emoji}</span>
          </div>`,
          iconSize: [musicianSize, musicianSize],
          iconAnchor: [musicianSize / 2, musicianSize / 2],
          popupAnchor: [0, -(musicianSize / 2 + 4)],
        });

        const marker = L.marker([m.lat, m.lng], { icon: musicianIcon });
        marker.bindPopup(`
          <div style="min-width:240px;font-family:'Inter',system-ui,sans-serif;padding:4px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <div style="width:40px;height:40px;background:${inst.gradient};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">${inst.emoji}</div>
              <div>
                <div style="font-weight:700;font-size:14px;color:#f1f5f9;">${m.name} ${m.verified ? '<span style="color:#eab308;font-size:12px;">✓</span>' : ""}</div>
                <div style="font-size:12px;color:#94a3b8;">${m.instrument} · ${m.genre}</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <span style="background:rgba(34,197,94,0.12);color:#22c55e;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid rgba(34,197,94,0.3);">$${m.price}/hr</span>
              <span style="background:rgba(234,179,8,0.12);color:#eab308;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid rgba(234,179,8,0.3);">⭐ ${m.rating}</span>
              <span style="background:rgba(148,163,184,0.1);color:#94a3b8;padding:3px 10px;border-radius:20px;font-size:12px;border:1px solid rgba(148,163,184,0.2);">${m.jobs} jobs</span>
            </div>
          </div>
        `, { maxWidth: 280, className: "boostify-popup" });
        musicianLayerRef.current!.addLayer(marker);
      });

      realMusicians.forEach((m: any) => {
        if (!m.latitude || !m.longitude) return;
        if (instrumentFilter !== "all" && m.category !== instrumentFilter) return;
        const marker = L.marker([parseFloat(m.latitude), parseFloat(m.longitude)], { icon: makeInstrumentMarker(m.instrument || "Production", false, sf) });
        marker.bindPopup(`
          <div style="min-width:200px;font-family:'Inter',system-ui,sans-serif;padding:4px;">
            <div style="font-weight:700;font-size:13px;color:#3b82f6;">${m.name}</div>
            <div style="font-size:11px;color:#94a3b8;">${m.instrument} · ⭐ ${m.rating} · $${m.price}/session</div>
          </div>
        `);
        musicianLayerRef.current!.addLayer(marker);
      });
    }
  }, [mapData, instrumentFilter, showOrders, showMusicians, mapZoom, externalOrders, externalMusicians]);

  useEffect(() => { placeMarkers(); }, [placeMarkers]);

  // Locate user
  const handleLocate = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mapRef.current) return;
        const { latitude, longitude } = pos.coords;
        setUserLocation([latitude, longitude]);
        mapRef.current.setView([latitude, longitude], 10);
        L.circleMarker([latitude, longitude], {
          radius: 10, fillColor: "#22c55e", fillOpacity: 1, color: "white", weight: 3,
        }).addTo(mapRef.current).bindPopup(`<div style="font-family:system-ui;color:#f1f5f9;font-weight:600;">📍 You are here</div>`);
      },
      () => {}
    );
  };

  // ── Fullscreen toggle ──
  const toggleFullscreen = useCallback(() => {
    const el = fullscreenRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      // Leaflet needs a size recalculation after the container resizes
      setTimeout(() => mapRef.current?.invalidateSize(), 120);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── External data-source integration: fetch + normalize ──
  const refreshSources = useCallback(async () => {
    const active = dataSources.filter((s) => s.enabled);
    if (active.length === 0) {
      setExternalOrders([]);
      setExternalMusicians([]);
      return;
    }
    const orders: SimOrder[] = [];
    const musicians: typeof SIMULATED_MUSICIANS = [];
    await Promise.all(
      active.map(async (src) => {
        setSourceStatus((p) => ({ ...p, [src.id]: "loading" }));
        try {
          const res = await fetch(src.url, { headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error(String(res.status));
          const json = await res.json();
          const rawOrders: any[] = Array.isArray(json)
            ? json
            : json.orders || json.requests || json.data?.orders || json.data?.requests || [];
          const rawMusicians: any[] = json.musicians || json.data?.musicians || [];
          rawOrders.forEach((r, i) => {
            const o = toExternalOrder(r, orders.length + i);
            if (o) orders.push(o);
          });
          rawMusicians.forEach((r, i) => {
            const m = toExternalMusician(r, musicians.length + i);
            if (m) musicians.push(m as any);
          });
          setSourceStatus((p) => ({ ...p, [src.id]: "ok" }));
        } catch {
          setSourceStatus((p) => ({ ...p, [src.id]: "error" }));
        }
      })
    );
    setExternalOrders(orders);
    setExternalMusicians(musicians);
  }, [dataSources]);

  // Persist + refetch whenever sources change
  useEffect(() => {
    try { localStorage.setItem(SOURCES_KEY, JSON.stringify(dataSources)); } catch {}
    refreshSources();
  }, [dataSources, refreshSources]);

  const addDataSource = () => {
    const name = sourceForm.name.trim();
    const url = sourceForm.url.trim();
    if (!name || !/^https?:\/\//i.test(url)) {
      toast({ title: "Invalid source", description: "Enter a name and a valid http(s) JSON endpoint.", variant: "destructive" });
      return;
    }
    setDataSources((prev) => [...prev, { id: `src_${Date.now()}`, name, url, enabled: true }]);
    setSourceForm({ name: "", url: "" });
    toast({ title: "🔌 Data source connected", description: `${name} added. Markers will sync automatically.` });
  };
  const removeDataSource = (id: string) => setDataSources((prev) => prev.filter((s) => s.id !== id));
  const toggleDataSource = (id: string) =>
    setDataSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));

  const totalOrders = liveCount + externalOrders.length;
  const totalMusicians = SIMULATED_MUSICIANS.length + (mapData?.data?.musicians?.length || 0) + externalMusicians.length;
  const flashCount = SIMULATED_ORDERS.filter((o) => o.urgency === "flash").length;
  const activeSourceCount = dataSources.filter((s) => s.enabled).length;

  const instrumentList = ["Guitar", "Drums", "Piano", "Bass", "Vocals", "Production", "Mixing", "Violin"];

  return (
    <div className="space-y-3">
      {/* ── Header Bar ── */}
      <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700/50 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20 flex-shrink-0">
              <Radio className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Live Services Map
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                </span>
              </h3>
              <p className="text-xs text-slate-400 hidden sm:block">Real-time orders & musicians worldwide</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] sm:text-xs animate-pulse">
              <Zap className="h-3 w-3 mr-1" /> {flashCount} Flash
            </Badge>
            <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px] sm:text-xs">
              <TrendingUp className="h-3 w-3 mr-1" /> {totalOrders} orders
            </Badge>
            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] sm:text-xs">
              <Users className="h-3 w-3 mr-1" /> {totalMusicians} musicians
            </Badge>
            <Button
              size="sm"
              onClick={() => setShowCredits(true)}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] sm:text-xs h-6 sm:h-7 px-2 sm:px-3 font-bold shadow-lg shadow-amber-500/20"
            >
              <Coins className="h-3 w-3 mr-1" />
              {creditBalance} Credits
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Controls Row ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={instrumentFilter} onValueChange={setInstrumentFilter}>
            <SelectTrigger className="w-[130px] sm:w-[150px] bg-slate-800/80 border-slate-600/50 h-8 text-xs text-slate-300 rounded-lg">
              <Filter className="h-3 w-3 mr-1 text-slate-400" />
              <SelectValue placeholder="All Instruments" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              <SelectItem value="all">All Instruments</SelectItem>
              {instrumentList.map((i) => {
                const info = getInstrumentIcon(i);
                return <SelectItem key={i} value={i}>{info.emoji} {i}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowOrders(!showOrders)}
            size="sm"
            variant="outline"
            className={`h-8 text-xs border-slate-600/50 rounded-lg ${showOrders ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : "bg-slate-800/50 text-slate-500"}`}
          >
            {showOrders ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            Orders
          </Button>
          <Button
            onClick={() => setShowMusicians(!showMusicians)}
            size="sm"
            variant="outline"
            className={`h-8 text-xs border-slate-600/50 rounded-lg ${showMusicians ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "bg-slate-800/50 text-slate-500"}`}
          >
            {showMusicians ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            Musicians
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowDataSources(true)}
            size="sm"
            variant="outline"
            className={`h-8 text-xs border-slate-600/50 rounded-lg ${activeSourceCount > 0 ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : "text-slate-300 hover:bg-slate-700/50"}`}
          >
            <Database className="h-3 w-3 mr-1" /> Databases
            {activeSourceCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/25 text-orange-300">{activeSourceCount}</span>
            )}
          </Button>
          <Button onClick={handleLocate} size="sm" variant="outline" className="border-slate-600/50 h-8 text-xs text-slate-300 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30">
            <Crosshair className="h-3 w-3 mr-1" /> Locate Me
          </Button>
          <Button onClick={placeMarkers} size="sm" variant="outline" className="border-slate-600/50 h-8 text-xs text-slate-300 rounded-lg hover:bg-slate-700/50">
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          <Button onClick={toggleFullscreen} size="sm" variant="outline" className="border-slate-600/50 h-8 text-xs text-slate-300 rounded-lg hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/30">
            {isFullscreen ? <Minimize2 className="h-3 w-3 mr-1" /> : <Maximize2 className="h-3 w-3 mr-1" />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </Button>
        </div>
      </div>

      {/* ── Instrument Legend ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {instrumentList.map((inst) => {
          const info = getInstrumentIcon(inst);
          const count = SIMULATED_ORDERS.filter((o) => o.instrument === inst).length;
          const isActive = instrumentFilter === inst;
          return (
            <button
              key={inst}
              onClick={() => setInstrumentFilter(isActive ? "all" : inst)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                isActive
                  ? "bg-white/10 text-white border-white/20 shadow-lg"
                  : "bg-slate-800/40 text-slate-400 border-slate-700/30 hover:bg-slate-700/50 hover:text-slate-300"
              }`}
            >
              <span className="text-sm">{info.emoji}</span>
              {inst}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isActive ? "bg-white/20" : "bg-slate-700/50"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Map + Sidebar ── */}
      <div ref={fullscreenRef} className="boostify-map-fs flex flex-col lg:flex-row gap-3 bg-[#0c0d10]">
        {/* Map */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-700/40 shadow-2xl flex-1" style={{ minHeight: 420 }}>
          {isLoading && (
            <div className="absolute inset-0 bg-slate-900/80 z-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
              <span className="text-sm text-slate-400">Loading map data...</span>
            </div>
          )}
          {/* Top-left overlay stats */}
          <div className="absolute top-3 left-3 z-[400] flex flex-col gap-1.5">
            <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/40 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-[10px] sm:text-xs text-green-400 font-semibold">LIVE</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] sm:text-xs text-slate-300 font-medium">{totalOrders} active</span>
            </div>
            <div className="bg-slate-900/85 backdrop-blur-md border border-purple-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <Brain className="h-3 w-3 text-purple-400" />
              <span className="text-[10px] text-purple-300 font-semibold">AI viewing</span>
              <span className="text-[10px] text-slate-500">·</span>
              <span className="text-[10px] text-slate-300 font-medium truncate max-w-[140px]">{regionLabel}</span>
            </div>
          </div>

          {/* ═════════ SMART PROPOSALS PANEL (top-right overlay) ═════════ */}
          <div className="absolute top-3 right-3 z-[400] w-[200px] sm:w-[320px] max-w-[calc(100%-1.5rem)]">
            <div className="bg-gradient-to-br from-slate-900/95 to-slate-950/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setProposalsOpen(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-500/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] sm:text-xs font-bold text-white flex items-center gap-1.5">
                      Smart Proposals
                      <span className="bg-purple-500/20 text-purple-300 text-[8px] px-1.5 py-0.5 rounded-full border border-purple-500/30 font-semibold">AI</span>
                    </div>
                    <div className="text-[9px] text-slate-400">{smartProposals.length} insights · {regionLabel}</div>
                  </div>
                </div>
                {proposalsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {/* Body */}
              <AnimatePresence initial={false}>
                {proposalsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-2 space-y-1.5 max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                      {smartProposals.map((p, idx) => {
                        const isHighlighted = idx === activeProposalIdx % smartProposals.length;
                        return (
                          <motion.button
                            key={p.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2, delay: idx * 0.03 }}
                            onClick={() => {
                              if (p.action) p.action();
                              else if (p.instrument) setInstrumentFilter(p.instrument);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all hover:scale-[1.01] group relative overflow-hidden ${
                              isHighlighted
                                ? "bg-gradient-to-br from-purple-500/15 to-fuchsia-500/10 border-purple-500/40 shadow-lg shadow-purple-500/10"
                                : "bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/70 hover:border-slate-600/40"
                            }`}
                          >
                            {isHighlighted && (
                              <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${p.color} pointer-events-none`} />
                            )}
                            <div className="flex items-start gap-2 relative">
                              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center flex-shrink-0 text-sm shadow-md`}>
                                {p.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-white leading-tight">{p.title}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-snug">{p.subtitle}</div>
                                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-purple-300 font-semibold group-hover:text-purple-200">
                                  {p.cta} <ChevronRight className="h-3 w-3" />
                                </div>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="px-3 py-1.5 bg-slate-950/60 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">Updates as you move the map</span>
                      <button
                        onClick={() => setProposalsTick(v => v + 1)}
                        className="text-[9px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="h-2.5 w-2.5" /> Re-roll
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div ref={mapContainerRef} className="boostify-map-canvas h-[420px] sm:h-[500px] lg:h-[560px] w-full" />

          {/* Floating fullscreen toggle (bottom-left of the map) */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="absolute bottom-3 left-3 z-[400] w-9 h-9 rounded-xl bg-slate-900/85 backdrop-blur-md border border-orange-500/30 text-orange-400 hover:bg-orange-500/15 hover:text-orange-300 flex items-center justify-center transition-colors shadow-lg"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Live Feed Sidebar */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-2 max-h-[420px] sm:max-h-[500px] lg:max-h-[560px] overflow-hidden">
          <div className="bg-slate-900/60 backdrop-blur border border-slate-700/40 rounded-2xl p-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-400" />
                Live Feed
              </h4>
              <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">
                <Clock className="h-2.5 w-2.5 mr-1" /> Real-time
              </Badge>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {SIMULATED_ORDERS
                .filter((o) => instrumentFilter === "all" || o.instrument === instrumentFilter)
                .map((order) => {
                  const inst = getInstrumentIcon(order.instrument);
                  const uCfg = URGENCY_CONFIG[order.urgency];
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <button
                      key={order.id}
                      onClick={() => {
                        setSelectedOrder(order);
                        mapRef.current?.setView([order.lat, order.lng], 8, { animate: true, duration: 0.8 });
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all hover:scale-[1.01] ${
                        isSelected
                          ? "bg-orange-500/10 border-orange-500/30 shadow-lg shadow-orange-500/5"
                          : "bg-slate-800/30 border-slate-700/20 hover:bg-slate-800/60 hover:border-slate-600/40"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                          style={{ background: inst.gradient }}
                        >
                          {inst.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-white truncate">{order.title}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: uCfg.bg, color: uCfg.color, border: `1px solid ${uCfg.border}` }}
                            >
                              {uCfg.label}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold">${order.budget}</span>
                            <span className="text-[10px] text-slate-500">{order.city}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-500">{order.bids} bids</span>
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[9px] text-slate-500">{order.timeAgo}</span>
                            <span className="text-[9px] text-slate-600">·</span>
                            <span className="text-[9px] text-slate-500">{order.genre}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setApplyOrder(order);
                              setApplyForm({ amount: String(order.budget), message: "", delivery: "2-3 days" });
                            }}
                            disabled={applySubmitted.has(order.id)}
                            className={`mt-1.5 h-6 text-[10px] font-bold w-full rounded-lg ${
                              applySubmitted.has(order.id)
                                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                                : "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-md shadow-orange-500/20"
                            }`}
                          >
                            {applySubmitted.has(order.id) ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" /> Applied</>
                            ) : (
                              <><Briefcase className="h-3 w-3 mr-1" /> Apply Now</>
                            )}
                          </Button>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Apply Dialog ── */}
      <Dialog open={!!applyOrder} onOpenChange={(open) => { if (!open) setApplyOrder(null); }}>
        <DialogContent className="max-w-[92vw] sm:max-w-md bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                style={{ background: applyOrder ? getInstrumentIcon(applyOrder.instrument).gradient : "" }}
              >
                {applyOrder ? getInstrumentIcon(applyOrder.instrument).emoji : ""}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{applyOrder?.title}</div>
                <div className="text-[11px] text-slate-400 font-normal">{applyOrder?.city} · {applyOrder?.genre}</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Budget + Credit Cost */}
            <div className="bg-slate-800/50 rounded-xl p-3 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Client Budget</div>
                <div className="text-lg font-bold text-emerald-400">${applyOrder?.budget}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Apply Cost</div>
                <div className="text-lg font-bold text-amber-400">{applyOrder ? calculateApplicationCost(applyOrder.budget) : 0} credits</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Your Balance</div>
                <div className={`text-lg font-bold ${creditBalance >= (applyOrder ? calculateApplicationCost(applyOrder.budget) : 0) ? 'text-emerald-400' : 'text-rose-400'}`}>{creditBalance}</div>
              </div>
            </div>
            {applyOrder && creditBalance < calculateApplicationCost(applyOrder.budget) && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-xs text-rose-300">Insufficient credits to apply</span>
                <Button size="sm" onClick={() => { setApplyOrder(null); setShowCredits(true); }} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] h-6 px-2">
                  Buy Credits
                </Button>
              </div>
            )}

            {/* Your Price */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Your Price (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="number"
                  placeholder="Enter your price"
                  value={applyForm.amount}
                  onChange={(e) => setApplyForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="pl-9 bg-slate-800 border-slate-600 text-white h-10"
                />
              </div>
            </div>

            {/* Delivery Time */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Estimated Delivery</label>
              <Select value={applyForm.delivery} onValueChange={(v) => setApplyForm(prev => ({ ...prev, delivery: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="24 hours">24 Hours</SelectItem>
                  <SelectItem value="2-3 days">2-3 Days</SelectItem>
                  <SelectItem value="1 week">1 Week</SelectItem>
                  <SelectItem value="2 weeks">2 Weeks</SelectItem>
                  <SelectItem value="1 month">1 Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Message to Client</label>
              <Textarea
                placeholder="Introduce yourself, share your experience with this type of work..."
                value={applyForm.message}
                onChange={(e) => setApplyForm(prev => ({ ...prev, message: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white min-h-[80px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" onClick={() => setApplyOrder(null)} className="border-slate-600 text-slate-300 w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!applyOrder) return;
                if (!applyForm.amount || !applyForm.message.trim()) {
                  toast({ title: "Missing fields", description: "Set your price and write a message", variant: "destructive" });
                  return;
                }
                const cost = calculateApplicationCost(applyOrder.budget);
                // Mark as applied
                setApplySubmitted(prev => new Set(prev).add(applyOrder.id));
                setApplyOrder(null);
                setApplyForm({ amount: "", message: "", delivery: "2-3 days" });
                toast({
                  title: "🎯 Application Sent!",
                  description: `Your bid of $${applyForm.amount} for "${applyOrder.title}" has been submitted (${cost} credits).`,
                });
              }}
              className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-bold w-full sm:w-auto"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Legal protection / disclaimer ── */}
      <Card className="bg-slate-900/60 border-slate-700/50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-orange-400" />
          </div>
          <div className="space-y-2 min-w-0">
            <h4 className="text-sm font-bold text-white">Legally protected marketplace</h4>
            <p className="text-xs leading-relaxed text-slate-400">
              Boostify is a neutral technology platform that connects independent clients and musicians. We are not a
              party to any service agreement, do not employ the professionals listed, and do not guarantee outcomes,
              quality, or availability. Payments are held in escrow and released per our marketplace rules. Map markers
              labeled as samples or sourced from external databases are for demonstration and discovery only and may not
              represent real, currently available offers. Users are solely responsible for the content they post,
              applicable taxes, licensing, and compliance with local laws. All transactions are subject to our Terms,
              the Gig Marketplace Rules, and our copyright/DMCA protections.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs pt-1">
              <Link href="/gig-rules" className="text-orange-300 hover:text-orange-200 hover:underline flex items-center gap-1"><ScrollText className="h-3 w-3" /> Marketplace Rules</Link>
              <span className="text-slate-600">•</span>
              <Link href="/terms" className="text-orange-300 hover:text-orange-200 hover:underline">Terms</Link>
              <span className="text-slate-600">•</span>
              <Link href="/privacy" className="text-orange-300 hover:text-orange-200 hover:underline">Privacy</Link>
              <span className="text-slate-600">•</span>
              <Link href="/legal" className="text-orange-300 hover:text-orange-200 hover:underline">Legal Center</Link>
              <span className="text-slate-600">•</span>
              <Link href="/legal/dmca" className="text-orange-300 hover:text-orange-200 hover:underline">DMCA</Link>
              <span className="text-slate-600">•</span>
              <Link href="/legal/prohibited" className="text-orange-300 hover:text-orange-200 hover:underline">Prohibited Content</Link>
            </div>
            <p className="text-[11px] text-slate-500 pt-0.5">
              Not financial or legal advice. Escrow and credit features carry no guarantee of work being awarded.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Database integration dialog ── */}
      <Dialog open={showDataSources} onOpenChange={setShowDataSources}>
        <DialogContent className="max-w-[92vw] sm:max-w-lg bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold">Connect databases</div>
                <div className="text-[11px] text-slate-400 font-normal">Stream live orders & musicians from your own JSON endpoints</div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Add form */}
            <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
              <Input
                placeholder="Source name (e.g. My Studio API)"
                value={sourceForm.name}
                onChange={(e) => setSourceForm((p) => ({ ...p, name: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
              />
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="https://api.example.com/orders.json"
                  value={sourceForm.url}
                  onChange={(e) => setSourceForm((p) => ({ ...p, url: e.target.value }))}
                  className="pl-9 bg-slate-800 border-slate-600 text-white h-9 text-sm"
                />
              </div>
              <Button onClick={addDataSource} className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white h-9 text-sm font-bold">
                <Plus className="h-4 w-4 mr-1" /> Connect source
              </Button>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Endpoint must return JSON: an array, or <code className="text-slate-400">{"{ orders: [], musicians: [] }"}</code>.
                Each record needs <code className="text-slate-400">lat</code> &amp; <code className="text-slate-400">lng</code>
                (plus optional title, instrument, budget, city, price, rating). CORS must be enabled on your endpoint.
              </p>
            </div>

            {/* Connected sources */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {dataSources.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">No databases connected yet.</div>
              )}
              {dataSources.map((s) => {
                const st = sourceStatus[s.id];
                return (
                  <div key={s.id} className="flex items-center gap-2 bg-slate-800/40 border border-slate-700/40 rounded-lg p-2.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st === "ok" ? "bg-emerald-500" : st === "error" ? "bg-rose-500" : st === "loading" ? "bg-amber-500 animate-pulse" : "bg-slate-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{s.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{s.url}</div>
                    </div>
                    <button onClick={() => toggleDataSource(s.id)} title={s.enabled ? "Disable" : "Enable"} className={`p-1.5 rounded-md transition-colors ${s.enabled ? "text-emerald-400 hover:bg-emerald-500/10" : "text-slate-500 hover:bg-slate-700/50"}`}>
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeDataSource(s.id)} title="Remove" className="p-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
            <Button variant="outline" onClick={() => refreshSources()} className="border-slate-600 text-slate-300 w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" /> Sync now
            </Button>
            <Button onClick={() => setShowDataSources(false)} className="bg-slate-700 hover:bg-slate-600 text-white w-full sm:w-auto">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Gig Credits Dashboard ── */}
      <GigCreditsDashboard open={showCredits} onClose={() => setShowCredits(false)} />
    </div>
  );
}
