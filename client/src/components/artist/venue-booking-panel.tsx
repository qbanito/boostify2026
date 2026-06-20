/**
 * Venue Booking Panel — Search Google Maps venues, send booking proposals, manage deals
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Search, Send, MapPin, Mail, Phone, Globe, Star, Building2,
  Music, Calendar, DollarSign, CheckCircle2, XCircle, MessageSquare,
  Loader2, ChevronRight, ExternalLink, RefreshCw, Filter,
  Eye, FileText, Download, Palette, Wrench, Zap,
  HelpCircle, X, Target, CreditCard, Settings,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const GUIDE_ITEMS = [
  {
    icon: Building2,
    color: '#f97316',
    title: 'What is Venue Booking?',
    body: 'This module lets you find live music venues, bars, nightclubs, and event spaces, then send automated booking proposals directly to their contact email — all without leaving Boostify.',
  },
  {
    icon: Search,
    color: '#3b82f6',
    title: 'Search Venues',
    body: 'Use "Search Venues" to scrape Google Maps for venues in any city. Enter a location, add search terms like "bars with live music", and set a result limit. You can also import venues from an existing Apify dataset ID.',
  },
  {
    icon: MapPin,
    color: '#a855f7',
    title: 'My Venues',
    body: 'All found venues are saved to "My Venues". Filter by category or by venues that have an email address. Select individual or all venues to include them in a campaign.',
  },
  {
    icon: Mail,
    color: '#10b981',
    title: 'Email Enrichment',
    body: 'Many venues found on Google Maps are missing contact emails. Use the enrichment feature to automatically search for the venue\'s booking or management email using AI and web scraping.',
  },
  {
    icon: Send,
    color: '#f59e0b',
    title: 'Campaign — Sending Proposals',
    body: 'In the Campaign tab, choose an email template (standard booking request, festival pitch, residency proposal, etc.), set your proposed fee and available dates, then send to all venues with emails at once.',
  },
  {
    icon: FileText,
    color: '#06b6d4',
    title: 'Tech Rider',
    body: 'Before sending, make sure your Tech Rider is set up in your profile. It is automatically included in your booking proposals so venues know exactly what equipment and stage setup you need.',
  },
  {
    icon: Calendar,
    color: '#ec4899',
    title: 'Bookings Pipeline',
    body: 'The Bookings tab tracks every proposal. Each deal moves through: Sent → Opened → Interested → Negotiating → Confirmed / Rejected. You can send follow-ups or record counter-offers directly from this view.',
  },
  {
    icon: Settings,
    color: '#8b5cf6',
    title: 'Pro Tips',
    body: 'Start with 20–50 venues in your target city. Use the most specific search terms for your genre. Send proposals Tuesday–Thursday for the best open rates. Follow up once after 5 days if no response.',
  },
];

interface VenueBookingPanelProps {
  artistId: string;
  artistName: string;
}

interface VenueContact {
  id: number; name: string; address: string; city: string; country: string;
  phone: string | null; email: string | null; website: string | null;
  googleRating: string | null; totalReviews: number | null;
  category: string; status: string; imageUrl: string | null;
}

interface VenueDeal {
  deal: {
    id: number; title: string; proposedFee: string | null; agreedFee: string | null;
    status: string; venueResponse: string | null; counterOffer: string | null;
    proposedDate: string | null; createdAt: string;
  };
  venue: VenueContact | null;
}

interface Stats {
  totalVenues: number; venuesWithEmail: number;
  totalCampaigns: number; totalDeals: number;
  pipeline: Record<string, number>;
  campaigns: any[];
}

interface EmailTemplateInfo {
  id: string; name: string; description: string; icon: string; category: string;
}

interface TechRiderData {
  hasRider: boolean;
  riderData: any;
  summary: string;
  artistName: string;
}

const SECTIONS = ["overview", "search", "venues", "campaign", "deals"] as const;
type Section = typeof SECTIONS[number];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-yellow-500/20 text-yellow-300",
  replied: "bg-green-500/20 text-green-300",
  interested: "bg-emerald-500/20 text-emerald-300",
  booked: "bg-orange-500/20 text-orange-300",
  not_interested: "bg-red-500/20 text-red-300",
  sent: "bg-blue-500/20 text-blue-300",
  opened: "bg-indigo-500/20 text-indigo-300",
  negotiating: "bg-purple-500/20 text-purple-300",
  confirmed: "bg-green-500/20 text-green-300",
  rejected: "bg-red-500/20 text-red-300",
};

const CATEGORY_ICONS: Record<string, string> = {
  bar: "🍺", nightclub: "🎵", restaurant: "🍽️", event_venue: "🎪",
  lounge: "🍸", hotel: "🏨", festival: "🎊", theater: "🎭", other: "📍",
};

async function apiGet(path: string) {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}
async function apiPost(path: string, body: any) {
  const res = await fetch(path, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

export function VenueBookingPanel({ artistId, artistName }: VenueBookingPanelProps) {
  const [section, setSection] = useState<Section>("overview");
  const [showGuide, setShowGuide] = useState(false);
  const qc = useQueryClient();

  const navItems: { key: Section; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "search", label: "Search Venues", icon: Search },
    { key: "venues", label: "My Venues", icon: MapPin },
    { key: "campaign", label: "Campaign", icon: Send },
    { key: "deals", label: "Bookings", icon: Calendar },
  ];

  return (
    <div className="space-y-4">

      {/* ── GUIDE OVERLAY ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="venue-guide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowGuide(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0f0f14,#1a1a24)' }}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/8" style={{ background: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500/20">
                    <HelpCircle className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-widest uppercase text-orange-400">How it works</p>
                    <h3 className="text-base font-bold text-white leading-tight">Venue Booking Guide</h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Guide items */}
              <div className="px-4 sm:px-6 py-4 space-y-3">
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

              {/* Footer */}
              <div className="px-4 sm:px-6 py-4 border-t border-white/8">
                <p className="text-[10px] text-gray-500 text-center">
                  Venue proposals are sent via your connected email · All bookings tracked in your pipeline
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSection(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              section === key ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        {/* Guide button */}
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="ml-auto flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors"
          title="How it works"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {section === "overview" && <OverviewSection artistId={artistId} />}
      {section === "search" && <SearchSection artistId={artistId} onDone={() => { qc.invalidateQueries({ queryKey: ["/api/venue-outreach/venues"] }); setSection("venues"); }} />}
      {section === "venues" && <VenuesSection artistId={artistId} />}
      {section === "campaign" && <CampaignSection artistId={artistId} artistName={artistName} />}
      {section === "deals" && <DealsSection artistId={artistId} />}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────
function OverviewSection({ artistId }: { artistId: string }) {
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/venue-outreach/stats"], queryFn: () => apiGet("/api/venue-outreach/stats") });
  if (!stats) return <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-orange-400" /></div>;

  const cards = [
    { label: "Venues Found", value: stats.totalVenues, icon: MapPin, color: "text-blue-400" },
    { label: "With Email", value: stats.venuesWithEmail, icon: Mail, color: "text-green-400" },
    { label: "Proposals Sent", value: stats.totalDeals, icon: Send, color: "text-orange-400" },
    { label: "Booked", value: stats.pipeline?.booked || 0, icon: CheckCircle2, color: "text-emerald-400" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cards.map(c => (
          <div key={c.label} className="bg-white/5 rounded-lg p-3 text-center">
            <c.icon className={`h-5 w-5 mx-auto mb-1 ${c.color}`} />
            <div className="text-lg font-bold">{c.value}</div>
            <div className="text-[10px] text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>
      {stats.pipeline && Object.keys(stats.pipeline).length > 0 && (
        <div className="bg-white/5 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-2 font-medium">Pipeline</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.pipeline).map(([k, v]) => (
              <Badge key={k} variant="outline" className={`text-[10px] ${STATUS_COLORS[k] || ""}`}>{k}: {v}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search Venues ────────────────────────────────────────────────
function SearchSection({ artistId, onDone }: { artistId: string; onDone: () => void }) {
  const [location, setLocation] = useState("");
  const [terms, setTerms] = useState("bars with live music, nightclubs, music venues, event venues, restaurants with entertainment");
  const [maxResults, setMaxResults] = useState("50");
  const [datasetId, setDatasetId] = useState("OakLyvnfYcgaOYDgv");

  const searchMut = useMutation({
    mutationFn: (body: any) => apiPost("/api/venue-outreach/search", body),
    onSuccess: () => onDone(),
  });

  const loadDatasetMut = useMutation({
    mutationFn: (body: any) => apiPost("/api/venue-outreach/load-dataset", body),
    onSuccess: () => onDone(),
  });

  return (
    <div className="space-y-4">
      {/* Load from existing dataset */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-orange-400">📦 Load from Existing Dataset</p>
        <p className="text-[10px] text-gray-500">Import venues from a previously scraped Apify dataset</p>
        <div className="flex gap-2">
          <Input placeholder="Dataset ID" value={datasetId} onChange={e => setDatasetId(e.target.value)} className="bg-white/5 border-white/10 h-8 text-xs flex-1" />
          <Button size="sm" onClick={() => loadDatasetMut.mutate({ datasetId })}
            disabled={!datasetId || loadDatasetMut.isPending} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold text-[10px] h-8 px-3">
            {loadDatasetMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load"}
          </Button>
        </div>
        {loadDatasetMut.isError && <p className="text-[10px] text-red-400">{(loadDatasetMut.error as any)?.message}</p>}
        {loadDatasetMut.data && <p className="text-[10px] text-green-400">✅ Loaded {loadDatasetMut.data.total} venues, {loadDatasetMut.data.saved} new saved</p>}
      </div>

      {/* New search */}
      <div className="border-t border-white/10 pt-3 space-y-3">
        <p className="text-xs font-medium text-gray-300">🔍 New Google Maps Search</p>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">City or Location *</label>
        <Input placeholder="Barcelona, Spain" value={location} onChange={e => setLocation(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Search Terms (comma separated)</label>
        <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} className="bg-white/5 border-white/10 text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Max Results per Term</label>
        <Input type="number" value={maxResults} onChange={e => setMaxResults(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm w-32" />
      </div>
      <Button onClick={() => searchMut.mutate({
        locationQuery: location,
        searchStringsArray: terms.split(",").map(s => s.trim()).filter(Boolean),
        maxCrawledPlacesPerSearch: Number(maxResults) || 50,
      })} disabled={!location || searchMut.isPending} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold text-xs h-9">
        {searchMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Scraping Google Maps...</> : <><Search className="h-3.5 w-3.5 mr-1.5" />Search Venues</>}
      </Button>
      {searchMut.isError && <p className="text-xs text-red-400">{(searchMut.error as any)?.message}</p>}
      {searchMut.data && <p className="text-xs text-green-400">✅ Found {searchMut.data.total} venues, {searchMut.data.saved} new saved</p>}
      </div>
    </div>
  );
}

// ─── My Venues ────────────────────────────────────────────────────
function VenuesSection({ artistId }: { artistId: string }) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [emailOnly, setEmailOnly] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: venues = [], isLoading, refetch } = useQuery<VenueContact[]>({
    queryKey: ["/api/venue-outreach/venues", categoryFilter, emailOnly],
    queryFn: () => apiGet(`/api/venue-outreach/venues?category=${categoryFilter}&hasEmail=${emailOnly}`),
  });

  const toggle = (id: number) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === venues.length) setSelected(new Set());
    else setSelected(new Set(venues.map(v => v.id)));
  };

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-md text-xs px-2 py-1.5 text-gray-300">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_ICONS).map(([k, v]) => <option key={k} value={k}>{v} {k}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={emailOnly} onChange={e => setEmailOnly(e.target.checked)} className="rounded" />
          Has Email Only
        </label>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="h-7 text-[10px]">
          <RefreshCw className="h-3 w-3 mr-1" />Refresh
        </Button>
        {selected.size > 0 && (
          <span className="text-xs text-orange-400 font-medium ml-2">{selected.size} selected</span>
        )}
      </div>

      {/* Venue List */}
      {isLoading ? (
        <div className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-500" /></div>
      ) : venues.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No venues found. Search for venues first!</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={selected.size === venues.length && venues.length > 0} onChange={toggleAll} className="rounded" />
              Select All ({venues.length})
            </label>
          </div>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {venues.map(v => (
              <div key={v.id} onClick={() => toggle(v.id)}
                className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors border ${
                  selected.has(v.id) ? "bg-orange-500/10 border-orange-500/30" : "bg-white/5 border-transparent hover:bg-white/10"
                }`}>
                <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} className="mt-1 rounded" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{CATEGORY_ICONS[v.category] || "📍"}</span>
                    <span className="text-sm font-medium truncate">{v.name}</span>
                    {v.googleRating && (
                      <Badge variant="outline" className="text-[9px] flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5 text-yellow-400" /> {v.googleRating}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{v.address}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {v.email && <span className="text-[10px] text-green-400 flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" /> {v.email}</span>}
                    {v.phone && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" /> {v.phone}</span>}
                    {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-400 flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" /> Web</a>}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[v.status] || ""}`}>{v.status}</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Campaign (Configure + Template + Send) ──────────────────────
function CampaignSection({ artistId, artistName }: { artistId: string; artistName: string }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'config' | 'select' | 'preview'>('config');
  const [name, setName] = useState(`${artistName} Venue Tour`);
  const [showFee, setShowFee] = useState("");
  const [setDuration, setSetDuration] = useState("60 min");
  const [techReqs, setTechReqs] = useState("");
  const [availability, setAvailability] = useState("");
  const [customMsg, setCustomMsg] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("professional_pitch");
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [selectedVenueIds, setSelectedVenueIds] = useState<number[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");

  // Fetch available email templates
  const { data: templates = [] } = useQuery<EmailTemplateInfo[]>({
    queryKey: ["/api/venue-outreach/email-templates"],
    queryFn: () => apiGet("/api/venue-outreach/email-templates"),
  });

  // Fetch tech rider from manager-tools
  const { data: techRider } = useQuery<TechRiderData>({
    queryKey: ["/api/venue-outreach/tech-rider", artistId],
    queryFn: () => apiGet(`/api/venue-outreach/tech-rider?artistId=${artistId}`),
  });

  // Venues with email for selection
  const { data: venues = [] } = useQuery<VenueContact[]>({
    queryKey: ["/api/venue-outreach/venues", "all", true],
    queryFn: () => apiGet("/api/venue-outreach/venues?hasEmail=true"),
  });

  // Import tech rider into campaign
  const importTechRider = () => {
    if (techRider?.summary) {
      setTechReqs(techRider.summary);
    }
  };

  const createCampaign = useMutation({
    mutationFn: (body: any) => apiPost("/api/venue-outreach/campaign", body),
    onSuccess: (data) => { setCampaignId(data.id); setStep('select'); },
  });

  const sendProposals = useMutation({
    mutationFn: (body: any) => apiPost("/api/venue-outreach/send", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/venue-outreach/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/venue-outreach/deals"] });
    },
  });

  // Email preview mutation
  const previewMut = useMutation({
    mutationFn: (body: any) => apiPost("/api/venue-outreach/email-preview", body),
    onSuccess: (data) => { setPreviewHtml(data.html); setStep('preview'); },
  });

  const toggleVenue = (id: number) => {
    setSelectedVenueIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePreview = () => {
    previewMut.mutate({
      templateId: selectedTemplate,
      artistId,
      venueName: "Example Venue",
      showFee: showFee || undefined,
      setDuration: setDuration || undefined,
      availability: availability || undefined,
      technicalRequirements: techReqs || undefined,
      customMessage: customMsg || undefined,
    });
  };

  // ── Step 1: Configure Campaign ──
  if (step === 'config') {
    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-400">Configure your booking campaign, select a template, and send proposals.</p>

        {/* Template Selector */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block font-medium flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-orange-400" /> Email Template
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedTemplate === t.id
                    ? "bg-orange-500/15 border-orange-500/40 ring-1 ring-orange-500/30"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{t.icon}</span>
                  <span className="text-xs font-semibold text-white">{t.name}</span>
                  {selectedTemplate === t.id && <CheckCircle2 className="h-3 w-3 text-orange-400 ml-auto" />}
                </div>
                <p className="text-[10px] text-gray-500 leading-snug">{t.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-400 mb-1 block">Campaign Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">💰 Show Fee (USD)</label>
            <Input placeholder="500" value={showFee} onChange={e => setShowFee(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">⏱️ Set Duration</label>
            <Input value={setDuration} onChange={e => setSetDuration(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 mb-1 block">📅 Availability</label>
            <Input placeholder="Weekends in July-August 2025" value={availability} onChange={e => setAvailability(e.target.value)} className="bg-white/5 border-white/10 h-9 text-sm" />
          </div>

          {/* Technical Requirements with Import */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400 flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Technical Requirements
              </label>
              {techRider?.hasRider && (
                <button onClick={importTechRider}
                  className="flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 transition-colors font-medium">
                  <Download className="h-3 w-3" /> Import from Manager Tools
                </button>
              )}
            </div>
            <Textarea
              placeholder="PA system, 2 monitors, stage min 3x4m..."
              value={techReqs}
              onChange={e => setTechReqs(e.target.value)}
              rows={3}
              className="bg-white/5 border-white/10 text-sm"
            />
            {techRider?.hasRider && !techReqs && (
              <p className="text-[10px] text-orange-400/70 mt-1 flex items-center gap-1">
                <Zap className="h-2.5 w-2.5" /> Tech rider found in Manager Tools — click "Import" to auto-fill
              </p>
            )}
          </div>

          <div className="col-span-2">
            <label className="text-xs text-gray-400 mb-1 block">✉️ Custom Message (Optional)</label>
            <Textarea placeholder="We'd love to bring our energy to your venue..." value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={3} className="bg-white/5 border-white/10 text-sm" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePreview}
            disabled={previewMut.isPending}
            variant="outline" className="text-xs h-9 border-white/20 text-gray-300 hover:text-white">
            {previewMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
            Preview Email
          </Button>
          <Button onClick={() => createCampaign.mutate({
            artistId, name, showFee, setDuration,
            technicalRequirements: techReqs,
            availability, customMessage: customMsg,
            emailTemplate: selectedTemplate,
          })} disabled={!name || createCampaign.isPending} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold text-xs h-9">
            {createCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ChevronRight className="h-3.5 w-3.5 mr-1.5" />}
            Create Campaign & Select Venues
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Preview ──
  if (step === 'preview') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-orange-400" /> Email Preview — {templates.find(t => t.id === selectedTemplate)?.name}
          </p>
          <button onClick={() => setStep('config')} className="text-[10px] text-gray-500 hover:text-gray-300">← Back to Config</button>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <iframe
            srcDoc={previewHtml}
            className="w-full border-0"
            style={{ height: '500px' }}
            title="Email Preview"
            sandbox="allow-same-origin"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setStep('config')} variant="outline" className="text-xs h-9 border-white/20 text-gray-300">
            ← Edit Campaign
          </Button>
          <Button onClick={() => createCampaign.mutate({
            artistId, name, showFee, setDuration,
            technicalRequirements: techReqs,
            availability, customMessage: customMsg,
            emailTemplate: selectedTemplate,
          })} disabled={!name || createCampaign.isPending} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold text-xs h-9">
            {createCampaign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ChevronRight className="h-3.5 w-3.5 mr-1.5" />}
            Looks Good — Select Venues
          </Button>
        </div>
      </div>
    );
  }

  // ── Step 2: Select venues + Send ──
  return (
    <div className="space-y-4">
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center justify-between">
        <p className="text-xs text-green-400 font-medium">✅ Campaign created! Select venues to send proposals to:</p>
        <Badge variant="outline" className="text-[9px] text-orange-300 border-orange-500/30">
          {templates.find(t => t.id === selectedTemplate)?.icon} {templates.find(t => t.id === selectedTemplate)?.name}
        </Badge>
      </div>
      {venues.length === 0 ? (
        <p className="text-xs text-gray-500">No venues with email found. Search for venues first.</p>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer mb-1">
            <input type="checkbox" checked={selectedVenueIds.length === venues.length && venues.length > 0}
              onChange={() => setSelectedVenueIds(selectedVenueIds.length === venues.length ? [] : venues.map(v => v.id))} className="rounded" />
            Select All ({venues.length} venues with email)
          </label>
          {venues.map(v => (
            <label key={v.id} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer border transition-colors ${
              selectedVenueIds.includes(v.id) ? "bg-orange-500/10 border-orange-500/30" : "bg-white/5 border-transparent"
            }`}>
              <input type="checkbox" checked={selectedVenueIds.includes(v.id)} onChange={() => toggleVenue(v.id)} className="rounded" />
              <span className="text-xs">{CATEGORY_ICONS[v.category] || "📍"}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{v.name}</span>
                <span className="text-[10px] text-gray-500 truncate block">{v.email} · {v.city}</span>
              </div>
            </label>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={() => { setCampaignId(null); setStep('config'); }} variant="outline" className="text-xs h-9 border-white/20 text-gray-300">
          ← Back
        </Button>
        <Button onClick={() => sendProposals.mutate({ venueIds: selectedVenueIds, campaignId, artistId, templateId: selectedTemplate })}
          disabled={selectedVenueIds.length === 0 || sendProposals.isPending} className="bg-orange-500 hover:bg-orange-600 text-black font-semibold text-xs h-9">
          {sendProposals.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Sending Proposals...</> : <><Send className="h-3.5 w-3.5 mr-1.5" />Send to {selectedVenueIds.length} Venues</>}
        </Button>
      </div>
      {sendProposals.data && (
        <p className="text-xs text-green-400">✅ Sent: {sendProposals.data.sent} | Failed: {sendProposals.data.failed}</p>
      )}
    </div>
  );
}

// ─── Deals / Bookings ────────────────────────────────────────────
function DealsSection({ artistId }: { artistId: string }) {
  const { data: deals = [], isLoading } = useQuery<VenueDeal[]>({
    queryKey: ["/api/venue-outreach/deals"],
    queryFn: () => apiGet("/api/venue-outreach/deals"),
  });

  if (isLoading) return <div className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-500" /></div>;

  if (deals.length === 0) return (
    <div className="text-center py-8 text-gray-500">
      <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">No bookings yet. Create a campaign and send proposals!</p>
    </div>
  );

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {deals.map(({ deal, venue }) => (
        <div key={deal.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{deal.title}</p>
              <p className="text-[11px] text-gray-500">{venue?.address || "Unknown venue"}</p>
            </div>
            <Badge variant="outline" className={`text-[9px] flex-shrink-0 ${STATUS_COLORS[deal.status] || ""}`}>{deal.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {deal.proposedFee && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" /> ${deal.proposedFee}</span>
            )}
            {deal.venueResponse && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" /> {deal.venueResponse}</span>
            )}
            {deal.counterOffer && (
              <span className="text-[10px] text-orange-400 flex items-center gap-0.5">Counter: ${deal.counterOffer}</span>
            )}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-gray-600">{new Date(deal.createdAt).toLocaleDateString()}</span>
            <a href={`/venue-proposal/${deal.id}`} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-orange-400 flex items-center gap-0.5 hover:underline">
              <ExternalLink className="h-2.5 w-2.5" /> View Proposal
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
