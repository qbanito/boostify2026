/**
 * LiveMapServices — Artist Profile module that connects the Live Map.
 *
 * From the artist profile the artist can:
 *  - See the live gig/musician map (same data as Producer Tools Live Map)
 *  - Open the map fullscreen
 *  - Publish their own profile/services on the map ("sell my services")
 *  - Visitors can book the artist's services directly
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  MapPin, Maximize2, Minimize2, Loader2, DollarSign, Star, Crosshair,
  Briefcase, Plus, Trash2, CheckCircle2, Radio, ExternalLink, Music,
} from "lucide-react";
import { Link } from "wouter";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ArtistService {
  id: number;
  name: string;
  photo: string;
  instrument: string;
  category: string;
  description: string;
  price: string;
  rating: string;
  totalReviews: number;
  genres: string[];
  city: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  bio: string | null;
  isAvailable: boolean | null;
  isVerified: boolean | null;
  completedJobs: number | null;
}

interface MapGig {
  id: number;
  title: string;
  instrumentNeeded: string;
  budgetMin: string;
  budgetMax: string;
  latitude: string;
  longitude: string;
  city: string | null;
  urgency: string;
  totalBids: number;
  userName: string | null;
}

interface MapMusician {
  musicianId: number;
  name: string;
  photo: string | null;
  instrument: string;
  price: string;
  rating: string;
  latitude: string;
  longitude: string;
  city: string | null;
  isVerified: boolean | null;
}

interface LiveMapServicesProps {
  artistId: number | string;
  artistName: string;
  artistImage?: string;
  colors: { primary: string; accent: string };
  isOwner: boolean;
}

const INSTRUMENTS = [
  "Guitar", "Bass", "Drums", "Piano", "Vocals", "Violin",
  "Production", "Mixing", "Mastering", "Songwriting", "DJ", "Other",
];

const URGENCY_COLOR: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};

// ─── Component ───────────────────────────────────────────────────────────────
export function LiveMapServices({ artistId, artistName, artistImage, colors, isOwner }: LiveMapServicesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const numericArtistId = Number(artistId);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Publish/edit dialog state
  const [showPublish, setShowPublish] = useState(false);
  const [editingService, setEditingService] = useState<ArtistService | null>(null);
  const [form, setForm] = useState({
    name: "", instrument: "Production", price: "", description: "",
    city: "", latitude: null as number | null, longitude: null as number | null,
  });
  const [locating, setLocating] = useState(false);

  // Booking dialog state
  const [bookingService, setBookingService] = useState<ArtistService | null>(null);
  const [bookingNotes, setBookingNotes] = useState("");

  // ─── Data ───────────────────────────────────────────────────────────────
  const { data: servicesRes, isLoading: servicesLoading } = useQuery({
    queryKey: ["artist-live-map-services", numericArtistId],
    queryFn: () => apiRequest({ url: `/api/service-requests/artist/${numericArtistId}/services`, method: "GET" }),
    enabled: !!numericArtistId,
  });
  const services: ArtistService[] = servicesRes?.data || [];

  const { data: mapRes } = useQuery({
    queryKey: ["artist-live-map-data"],
    queryFn: () => apiRequest({ url: "/api/service-requests/map/data", method: "GET" }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const gigs: MapGig[] = mapRes?.data?.requests || [];
  const mapMusicians: MapMusician[] = mapRes?.data?.musicians || [];

  // ─── Mutations ──────────────────────────────────────────────────────────
  const publishMutation = useMutation({
    mutationFn: (body: any) => apiRequest({
      url: `/api/service-requests/artist/${numericArtistId}/services`,
      method: "POST",
      data: body,
    }),
    onSuccess: () => {
      toast({ title: editingService ? "Service updated" : "Service published on the Live Map" });
      queryClient.invalidateQueries({ queryKey: ["artist-live-map-services", numericArtistId] });
      queryClient.invalidateQueries({ queryKey: ["artist-live-map-data"] });
      setShowPublish(false);
      setEditingService(null);
    },
    onError: () => toast({ title: "Could not publish the service", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (serviceId: number) => apiRequest({
      url: `/api/service-requests/artist/${numericArtistId}/services/${serviceId}`,
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({ title: "Service removed from the map" });
      queryClient.invalidateQueries({ queryKey: ["artist-live-map-services", numericArtistId] });
      queryClient.invalidateQueries({ queryKey: ["artist-live-map-data"] });
    },
    onError: () => toast({ title: "Could not remove the service", variant: "destructive" }),
  });

  const bookMutation = useMutation({
    mutationFn: (body: any) => apiRequest({ url: "/api/bookings", method: "POST", data: body }),
    onSuccess: () => {
      toast({ title: "Booking request sent", description: `${artistName} will review your request.` });
      setBookingService(null);
      setBookingNotes("");
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      toast({
        title: msg.includes("401") ? "Log in to book this service" : "Could not send the booking",
        variant: "destructive",
      });
    },
  });

  // ─── Map init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: [25, -30],
      zoom: 2,
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: false, // avoid page-scroll hijack inside profile; enabled in fullscreen
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    map.getContainer().style.background = "#16181d";
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = null; };
  }, []);

  // ─── Markers ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // Open gigs (service requests)
    gigs.forEach((g) => {
      const lat = parseFloat(g.latitude), lng = parseFloat(g.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const color = URGENCY_COLOR[g.urgency] || "#eab308";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.85);box-shadow:0 0 10px ${color}99"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([lat, lng], { icon })
        .bindPopup(`<b>${g.title}</b><br/>${g.instrumentNeeded} · $${g.budgetMin}–$${g.budgetMax}<br/><small>${g.city || ""} · ${g.totalBids} bids</small>`)
        .addTo(layer);
    });

    // Musicians on the map (other sellers)
    mapMusicians.forEach((m) => {
      const lat = parseFloat(m.latitude), lng = parseFloat(m.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#22c55e,#16a34a);border:2px solid rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 0 8px #22c55e66">🎵</div>`,
        iconSize: [26, 26], iconAnchor: [13, 13],
      });
      L.marker([lat, lng], { icon })
        .bindPopup(`<b>${m.name}</b><br/>${m.instrument} · $${m.price}<br/><small>${m.city || ""} · ⭐ ${m.rating}</small>`)
        .addTo(layer);
    });

    // THIS artist's own service pins — highlighted avatar marker with brand ring
    const ownPins = services.filter((s) => s.latitude && s.longitude);
    ownPins.forEach((s) => {
      const lat = parseFloat(s.latitude!), lng = parseFloat(s.longitude!);
      if (isNaN(lat) || isNaN(lng)) return;
      const avatar = s.photo || artistImage || "";
      const inner = avatar
        ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`
        : `<div style="width:100%;height:100%;border-radius:50%;background:${colors.primary};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${(artistName || "A").charAt(0)}</div>`;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:40px;height:40px;border-radius:50%;border:3px solid ${colors.accent};box-shadow:0 0 16px ${colors.accent}aa;overflow:hidden;background:#111">${inner}</div>`,
        iconSize: [40, 40], iconAnchor: [20, 20],
      });
      L.marker([lat, lng], { icon, zIndexOffset: 500 })
        .bindPopup(`<b>${artistName}</b><br/>${s.instrument} · $${s.price}<br/><small>${s.city || ""} · Selling services here</small>`)
        .addTo(layer);
    });

    // Center on artist's first pin if any
    if (ownPins.length > 0) {
      const p = ownPins[0];
      map.setView([parseFloat(p.latitude!), parseFloat(p.longitude!)], 6);
    }
  }, [gigs, mapMusicians, services, artistImage, artistName, colors.accent, colors.primary]);

  // ─── Fullscreen ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      const map = mapRef.current;
      if (map) {
        if (fs) map.scrollWheelZoom.enable(); else map.scrollWheelZoom.disable();
        setTimeout(() => map.invalidateSize(), 250);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (fullscreenRef.current) {
      fullscreenRef.current.requestFullscreen().catch(() => {
        toast({ title: "Fullscreen is not available in this browser", variant: "destructive" });
      });
    }
  }, [toast]);

  // ─── Publish form helpers ───────────────────────────────────────────────
  const openPublish = (svc?: ArtistService) => {
    if (svc) {
      setEditingService(svc);
      setForm({
        name: svc.name,
        instrument: svc.instrument,
        price: svc.price,
        description: svc.description,
        city: svc.city || "",
        latitude: svc.latitude ? parseFloat(svc.latitude) : null,
        longitude: svc.longitude ? parseFloat(svc.longitude) : null,
      });
    } else {
      setEditingService(null);
      setForm({
        name: `${artistName} — Session / Production`,
        instrument: "Production", price: "", description: "", city: "",
        latitude: null, longitude: null,
      });
    }
    setShowPublish(true);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
        toast({ title: "Location captured", description: "Your pin will appear on the Live Map." });
      },
      () => {
        setLocating(false);
        toast({ title: "Could not get your location", variant: "destructive" });
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const submitPublish = () => {
    if (!form.name.trim() || !form.description.trim() || !form.price) {
      toast({ title: "Fill in name, price and description", variant: "destructive" });
      return;
    }
    publishMutation.mutate({
      serviceId: editingService?.id,
      name: form.name.trim(),
      photo: artistImage || "",
      instrument: form.instrument,
      category: form.instrument,
      description: form.description.trim(),
      price: form.price,
      city: form.city.trim() || undefined,
      latitude: form.latitude ?? undefined,
      longitude: form.longitude ?? undefined,
    });
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Map block (fullscreen wrapper) */}
      <div
        ref={fullscreenRef}
        className={`relative rounded-xl overflow-hidden border border-white/10 ${isFullscreen ? "bg-slate-950 flex flex-col" : ""}`}
      >
        <div
          ref={mapDivRef}
          className="w-full"
          style={{ height: isFullscreen ? "100vh" : 380, background: "#16181d" }}
        />

        {/* Overlays — z-[650]: above Leaflet markers (600), below popups (700) */}
        <div className="absolute top-3 left-3 z-[650] flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md border"
            style={{ background: "rgba(0,0,0,.55)", borderColor: `${colors.accent}55` }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            LIVE MAP
          </span>
          <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-md border border-white/10">
            {gigs.length} gigs · {mapMusicians.length + services.filter(s => s.latitude).length} sellers
          </span>
        </div>

        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
          className="absolute bottom-3 left-3 z-[650] flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-md border border-white/15 hover:bg-black/80 transition-colors cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? "Exit" : "Fullscreen"}
        </button>

        <Link href="/producer-tools?tab=map">
          <button
            title="Open in Producer Tools"
            className="absolute bottom-3 right-3 z-[650] flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md border border-white/15 hover:bg-black/80 transition-colors cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Full map
          </button>
        </Link>
      </div>

      {/* Services header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" style={{ color: colors.accent }} />
          <h4 className="text-sm font-semibold text-white">
            {isOwner ? "My services for sale" : `Services by ${artistName}`}
          </h4>
          {services.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-white/20 text-white/60">
              {services.length}
            </Badge>
          )}
        </div>
        {isOwner && (
          <Button
            size="sm"
            onClick={() => openPublish()}
            className="rounded-full text-white"
            style={{ backgroundColor: colors.primary }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Sell a service
          </Button>
        )}
      </div>

      {/* Services list */}
      {servicesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
          <MapPin className="mx-auto h-8 w-8 text-white/25 mb-2" />
          <p className="text-sm text-white/60">
            {isOwner
              ? "You haven't published any services yet. Put your profile on the Live Map and start selling."
              : `${artistName} hasn't published services yet.`}
          </p>
          {isOwner && (
            <Button
              size="sm"
              onClick={() => openPublish()}
              className="mt-3 rounded-full text-white"
              style={{ backgroundColor: colors.primary }}
            >
              <Radio className="h-4 w-4 mr-1" />
              Publish my profile on the map
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-2 hover:border-white/25 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${colors.primary}22`, color: colors.accent }}
                  >
                    <Music className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{svc.name}</p>
                    <p className="text-[11px] text-white/50">
                      {svc.instrument}
                      {svc.city ? ` · ${svc.city}` : ""}
                      {svc.latitude ? " · 📍 on map" : ""}
                    </p>
                  </div>
                </div>
                {svc.isVerified && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
              </div>

              <p className="text-xs text-white/60 line-clamp-2">{svc.description}</p>

              <div className="mt-auto flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <span className="flex items-center gap-0.5 font-semibold text-white">
                    <DollarSign className="h-3.5 w-3.5" style={{ color: colors.accent }} />
                    {svc.price}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-yellow-400" />
                    {svc.rating}
                  </span>
                </div>
                {isOwner ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-white/20" onClick={() => openPublish(svc)}>
                      Edit
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 px-2 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => deleteMutation.mutate(svc.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs text-white"
                    style={{ backgroundColor: colors.primary }}
                    onClick={() => setBookingService(svc)}
                  >
                    Book
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Publish / Edit dialog (owner) ── */}
      <Dialog open={showPublish} onOpenChange={(o) => { setShowPublish(o); if (!o) setEditingService(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Edit service" : "Sell your services on the Live Map"}</DialogTitle>
            <DialogDescription>
              Your profile pin will appear on the map so producers and artists can find and hire you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Service title</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Vocals recording · Mixing & mastering"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Skill / instrument</Label>
                <Select value={form.instrument} onValueChange={(v) => setForm((f) => ({ ...f, instrument: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSTRUMENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Price (USD)</Label>
                <Input
                  type="number" min="0" step="1"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="150"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What do you offer, delivery time, what the client gets…"
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label>City (optional)</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="Miami, FL"
                />
              </div>
              <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating} className="border-white/20">
                {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4 mr-1" />}
                {locating ? "" : "Use my location"}
              </Button>
            </div>
            {form.latitude != null && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Pin set: {form.latitude.toFixed(4)}, {form.longitude?.toFixed(4)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublish(false)}>Cancel</Button>
            <Button
              onClick={submitPublish}
              disabled={publishMutation.isPending}
              className="text-white"
              style={{ backgroundColor: colors.primary }}
            >
              {publishMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingService ? "Save changes" : "Publish on map"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Booking dialog (visitors) ── */}
      <Dialog open={!!bookingService} onOpenChange={(o) => { if (!o) setBookingService(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book: {bookingService?.name}</DialogTitle>
            <DialogDescription>
              Send a booking request to {artistName} — ${bookingService?.price} USD
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Notes for the artist</Label>
            <Textarea
              rows={3}
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              placeholder="Describe your project, deadline, references…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingService(null)}>Cancel</Button>
            <Button
              onClick={() => bookingService && bookMutation.mutate({
                musicianId: bookingService.id,
                price: bookingService.price,
                additionalNotes: bookingNotes.trim() || undefined,
              })}
              disabled={bookMutation.isPending}
              className="text-white"
              style={{ backgroundColor: colors.primary }}
            >
              {bookMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LiveMapServices;
