import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2,
  Shield,
  Upload,
  TrendingUp,
  Globe,
  Headphones,
  Radio,
  Smartphone,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  BarChart3,
  DollarSign,
  Plus,
  Send,
  Eye,
  Mail,
  Building2,
  Disc3,
  ListMusic,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileAudio,
  Image,
  Hash,
  CalendarDays,
  Package,
  Loader2,
  X,
  Star,
  Copy,
  Linkedin,
  FileText,
  MessageSquare,
  Crown,
  Rocket,
  Dna,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { SongDNATab } from "../components/dashboard/song-dna-tab";
import { Header } from "../components/layout/header";
import { RightsManagementCard } from "../components/rights/rights-management-card";
import { DistributionCard } from "../components/distribution/distribution-card";
import { useAuth } from "../hooks/use-auth";

// Video from public folder (Vite serves from client/public)
const heroVideo = "/assets/promos/REGGAETON.mp4";

// ============================================================================
// Types
// ============================================================================
interface Song {
  id: number;
  title: string;
  audioUrl: string;
  coverArt: string | null;
  genre: string | null;
  duration: string | null;
  mood: string | null;
  isrc: string | null;
  upc: string | null;
  plays: number;
  generatedWithAI: boolean;
  aiProvider: string | null;
  createdAt: string;
}

interface ReleaseTrack {
  id: number;
  releaseId: number;
  songId: number;
  trackNumber: number;
  title: string;
  isrc: string | null;
  duration: number | null;
  song: Song | null;
}

interface Release {
  id: number;
  title: string;
  type: string;
  upc: string | null;
  status: string;
  genre: string | null;
  coverArtUrl: string | null;
  releaseDate: string | null;
  createdAt: string;
}

interface ReleaseDetail extends Release {
  tracks: ReleaseTrack[];
  submissions: any[];
}

interface Partner {
  id: number;
  name: string;
  slug: string;
  type: string;
  tier: string;
  website: string | null;
  contactEmail: string | null;
  status: string;
  outreachStatus: string;
  features: string[];
  revSharePercent: string;
  territories: number;
  lastContactedAt: string | null;
  notes: string | null;
}

interface OutreachPackage {
  emailSubject: string;
  shortOutreach: string;
  fullPartnershipEmail: string;
  followUpEmail: string;
  linkedInMessage: string;
  contactFormMessage: string;
  internalStatusLabel: string;
}

interface PartnerProfile {
  slug: string;
  name: string;
  website: string;
  contactRoutes: { type: string; value: string }[];
  apiDocs: string;
  whiteLabelOffering: string;
  b2bPath: string;
  fitNotes: string;
  priorityScore: number;
}

interface DSP {
  id: number;
  name: string;
  slug: string;
  category: string;
  payPerStream: string;
  territories: number;
}

interface ModuleAudit {
  module: string;
  status: string;
  description: string;
  priority: string;
}

interface DashboardData {
  releases: { total: number; byStatus: Record<string, number>; recent: Release[] };
  royalties: { totalStreams: string | null; totalNetRevenue: string | null; transactionCount: number };
  partners: { total: number; active: number; contacted: number };
  dsps: { total: number };
  songs: { total: number; available: number; inReleases: number };
  audit: ModuleAudit[];
}

// ============================================================================
// Tabs
// ============================================================================
type TabId = "overview" | "songs" | "releases" | "partners" | "dsps" | "royalties" | "song-dna" | "audit";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "songs", label: "My Songs", icon: Music2 },
  { id: "releases", label: "Releases", icon: Disc3 },
  { id: "partners", label: "Partners", icon: Building2 },
  { id: "dsps", label: "DSPs", icon: Globe },
  { id: "royalties", label: "Royalties", icon: DollarSign },
  { id: "song-dna", label: "Song DNA", icon: Dna },
  { id: "audit", label: "Module Audit", icon: Shield },
];

// ============================================================================
// Status colors
// ============================================================================
function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400",
    metadata_complete: "bg-blue-500/20 text-blue-400",
    review: "bg-yellow-500/20 text-yellow-400",
    approved: "bg-green-500/20 text-green-400",
    delivering: "bg-purple-500/20 text-purple-400",
    live: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-red-500/20 text-red-400",
    takedown: "bg-red-500/20 text-red-400",
    // partners
    researching: "bg-gray-500/20 text-gray-400",
    contacted: "bg-blue-500/20 text-blue-400",
    negotiating: "bg-yellow-500/20 text-yellow-400",
    active: "bg-emerald-500/20 text-emerald-400",
    paused: "bg-orange-500/20 text-orange-400",
    // audit
    EXISTS_CONNECTED: "bg-emerald-500/20 text-emerald-400",
    EXISTS_NOT_CONNECTED: "bg-yellow-500/20 text-yellow-400",
    PARTIAL: "bg-orange-500/20 text-orange-400",
    MISSING_CREATE_NOW: "bg-red-500/20 text-red-400",
    PLANNED: "bg-blue-500/20 text-blue-400",
    // outreach
    not_contacted: "bg-gray-500/20 text-gray-400",
    email_sent: "bg-blue-500/20 text-blue-400",
    replied: "bg-green-500/20 text-green-400",
    meeting_scheduled: "bg-purple-500/20 text-purple-400",
    contract_review: "bg-yellow-500/20 text-yellow-400",
    signed: "bg-emerald-500/20 text-emerald-400",
  };
  return map[status] || "bg-gray-500/20 text-gray-400";
}

function tierBadge(tier: string) {
  const map: Record<string, string> = {
    tier1: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    tier2: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
    tier3: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
  };
  return map[tier] || "bg-gray-500 text-white";
}

export default function DistributionTools() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [dsps, setDsps] = useState<DSP[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [showNewRelease, setShowNewRelease] = useState(false);
  const [showAddSong, setShowAddSong] = useState<number | null>(null); // releaseId
  const [distributing, setDistributing] = useState<number | null>(null); // songId
  const [newReleaseTitle, setNewReleaseTitle] = useState("");
  const [newReleaseType, setNewReleaseType] = useState("single");
  const [sending, setSending] = useState<number | null>(null);
  const [expandedPartner, setExpandedPartner] = useState<number | null>(null);
  const [outreachPkg, setOutreachPkg] = useState<Record<number, OutreachPackage>>({});
  const [partnerProfiles, setPartnerProfiles] = useState<PartnerProfile[]>([]);
  const [outreachFormat, setOutreachFormat] = useState<string>("fullPartnershipEmail");
  const [copied, setCopied] = useState(false);

  // ── Partner communication state ─────────────────────────────────────
  const [outreachLogs, setOutreachLogs] = useState<Record<number, any[]>>({});
  const [partnerNotes, setPartnerNotes] = useState<Record<number, string>>({});
  const [savingNotes, setSavingNotes] = useState<number | null>(null);
  const [composeOpen, setComposeOpen] = useState<number | null>(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeChannel, setComposeChannel] = useState<string>("email");
  const [composing, setComposing] = useState(false);

  const userId = (user as any)?.id || 1;

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/distribution/dashboard/${userId}`);
      const data = await res.json();
      if (data.success) setDashboard(data.data);
    } catch (e) { console.error("Dashboard fetch:", e); }
  }, [userId]);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/distribution/partners");
      const data = await res.json();
      if (data.success) setPartners(data.partners);
    } catch (e) { console.error("Partners fetch:", e); }
  }, []);

  const fetchDSPs = useCallback(async () => {
    try {
      const res = await fetch("/api/distribution/dsps");
      const data = await res.json();
      if (data.success) setDsps(data.dsps);
    } catch (e) { console.error("DSPs fetch:", e); }
  }, []);

  const fetchReleases = useCallback(async () => {
    try {
      const res = await fetch(`/api/distribution/releases/${userId}`);
      const data = await res.json();
      if (data.success) setReleases(data.releases);
    } catch (e) { console.error("Releases fetch:", e); }
  }, [userId]);

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch(`/api/distribution/songs/${userId}`);
      const data = await res.json();
      if (data.success) setSongs(data.songs);
    } catch (e) { console.error("Songs fetch:", e); }
  }, [userId]);

  const fetchAvailableSongs = useCallback(async () => {
    try {
      const res = await fetch(`/api/distribution/songs/${userId}/available`);
      const data = await res.json();
      if (data.success) setAvailableSongs(data.songs);
    } catch (e) { console.error("Available songs fetch:", e); }
  }, [userId]);

  const fetchReleaseDetail = useCallback(async (releaseId: number) => {
    try {
      const res = await fetch(`/api/distribution/releases/full/${releaseId}`);
      const data = await res.json();
      if (data.success) setSelectedRelease(data.release);
    } catch (e) { console.error("Release detail fetch:", e); }
  }, []);

  const seedData = async () => {
    setLoading(true);
    try {
      await fetch("/api/distribution/seed", { method: "POST" });
      setSeeded(true);
      await Promise.all([fetchDashboard(), fetchPartners(), fetchDSPs(), fetchReleases(), fetchSongs()]);
      fetchPartnerProfiles();
    } catch (e) { console.error("Seed error:", e); }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchPartners(), fetchDSPs(), fetchReleases(), fetchSongs()]);
      fetchPartnerProfiles();
      setLoading(false);
    };
    init();
  }, [fetchDashboard, fetchPartners, fetchDSPs, fetchReleases, fetchSongs]);

  // Auto-seed if no partners exist
  useEffect(() => {
    if (!loading && partners.length === 0 && !seeded) {
      seedData();
    }
  }, [loading, partners.length, seeded]);

  const createNewRelease = async () => {
    if (!newReleaseTitle.trim()) return;
    try {
      await fetch("/api/distribution/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, title: newReleaseTitle, type: newReleaseType }),
      });
      setNewReleaseTitle("");
      setShowNewRelease(false);
      await fetchReleases();
      await fetchDashboard();
    } catch (e) { console.error("Create release error:", e); }
  };

  const submitReleaseForReview = async (id: number) => {
    try {
      await fetch(`/api/distribution/releases/${id}/submit`, { method: "POST" });
      await fetchReleases();
      await fetchDashboard();
    } catch (e) { console.error("Submit error:", e); }
  };

  const sendOutreach = async (partnerId: number, messageType: "full" | "follow_up" = "full") => {
    setSending(partnerId);
    try {
      const res = await fetch(`/api/distribution/partners/${partnerId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageType }),
      });
      const data = await res.json();
      if (data.success) await fetchPartners();
    } catch (e) { console.error("Outreach error:", e); }
    setSending(null);
  };

  const fetchOutreachPackage = async (partnerId: number) => {
    try {
      const res = await fetch(`/api/distribution/partners/${partnerId}/outreach-package`);
      const data = await res.json();
      if (data.success) setOutreachPkg(prev => ({ ...prev, [partnerId]: data.outreach }));
    } catch (e) { console.error("Outreach package error:", e); }
  };

  const fetchPartnerProfiles = async () => {
    try {
      const res = await fetch("/api/distribution/partner-profiles");
      const data = await res.json();
      if (data.success) setPartnerProfiles(data.profiles);
    } catch (e) { console.error("Partner profiles error:", e); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text.replace(/<[^>]*>/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePartnerExpand = async (partnerId: number) => {
    if (expandedPartner === partnerId) {
      setExpandedPartner(null);
    } else {
      setExpandedPartner(partnerId);
      if (!outreachPkg[partnerId]) await fetchOutreachPackage(partnerId);
      if (!outreachLogs[partnerId]) await fetchOutreachLog(partnerId);
      const partner = partners.find(p => p.id === partnerId);
      if (partner && partnerNotes[partnerId] === undefined) {
        setPartnerNotes(prev => ({ ...prev, [partnerId]: partner.notes || "" }));
      }
    }
  };

  // ── Partner communication handlers ──────────────────────────────────
  const fetchOutreachLog = async (partnerId: number) => {
    try {
      const res = await fetch(`/api/distribution/partners/${partnerId}/outreach-log`);
      const data = await res.json();
      if (data.success) setOutreachLogs(prev => ({ ...prev, [partnerId]: data.log || [] }));
    } catch (e) { console.error("Outreach log fetch:", e); }
  };

  const saveNotes = async (partnerId: number) => {
    setSavingNotes(partnerId);
    try {
      await fetch(`/api/distribution/partners/${partnerId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: partnerNotes[partnerId] || "" }),
      });
      await fetchPartners();
    } catch (e) { console.error("Save notes error:", e); }
    setSavingNotes(null);
  };

  const sendCustomMessage = async (partnerId: number) => {
    if (!composeSubject.trim() || !composeBody.trim()) return;
    setComposing(true);
    try {
      const res = await fetch(`/api/distribution/partners/${partnerId}/custom-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: composeSubject,
          body: composeBody,
          channel: composeChannel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComposeSubject(""); setComposeBody("");
        setComposeOpen(null);
        await Promise.all([fetchOutreachLog(partnerId), fetchPartners()]);
      } else {
        console.error("Custom message failed:", data.error);
      }
    } catch (e) { console.error("Custom message error:", e); }
    setComposing(false);
  };

  const logManualNote = async (partnerId: number, body: string, channel: string = "internal") => {
    try {
      await fetch(`/api/distribution/partners/${partnerId}/outreach-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "note", channel, body, status: "logged" }),
      });
      await fetchOutreachLog(partnerId);
    } catch (e) { console.error("Log note error:", e); }
  };

  const updateOutreachStatus = async (partnerId: number, outreachStatus: string) => {
    try {
      await fetch(`/api/distribution/partners/${partnerId}/outreach-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachStatus }),
      });
      await Promise.all([fetchPartners(), fetchOutreachLog(partnerId)]);
    } catch (e) { console.error("Status update error:", e); }
  };

  const quickDistribute = async (songId: number) => {
    setDistributing(songId);
    try {
      const res = await fetch(`/api/distribution/songs/${songId}/quick-distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        await Promise.all([fetchReleases(), fetchSongs(), fetchAvailableSongs(), fetchDashboard()]);
      }
    } catch (e) { console.error("Quick distribute error:", e); }
    setDistributing(null);
  };

  const addSongToRelease = async (releaseId: number, songId: number) => {
    try {
      await fetch(`/api/distribution/releases/${releaseId}/add-song`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      setShowAddSong(null);
      await Promise.all([fetchReleases(), fetchSongs(), fetchAvailableSongs(), fetchDashboard()]);
      if (selectedRelease?.id === releaseId) {
        await fetchReleaseDetail(releaseId);
      }
    } catch (e) { console.error("Add song to release error:", e); }
  };

  const removeTrack = async (trackId: number) => {
    try {
      await fetch(`/api/distribution/tracks/${trackId}`, { method: "DELETE" });
      if (selectedRelease) await fetchReleaseDetail(selectedRelease.id);
      await Promise.all([fetchReleases(), fetchSongs(), fetchAvailableSongs(), fetchDashboard()]);
    } catch (e) { console.error("Remove track error:", e); }
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100">
      <Header />
      <main className="flex-1">
        {/* ═══════════ HERO ═══════════ */}
        <section className="relative w-full min-h-[100vh] -mt-14 sm:-mt-16 overflow-hidden flex flex-col">
          {/* Video Background */}
          <div className="absolute inset-0 w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('/images/music_industry_abstract_art.png')` }} />
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" poster="/images/music_industry_abstract_art.png">
            <source src={heroVideo} type="video/mp4" />
          </video>

          {/* Multi-layer overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-950/40 via-transparent to-amber-950/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,146,60,0.12),transparent_60%)]" />

          {/* Animated floating icons */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[
              { Icon: Music2, x: "8%", y: "25%", delay: 0, size: "w-6 h-6" },
              { Icon: Globe, x: "85%", y: "18%", delay: 0.5, size: "w-5 h-5" },
              { Icon: Disc3, x: "15%", y: "70%", delay: 1, size: "w-5 h-5" },
              { Icon: DollarSign, x: "80%", y: "65%", delay: 1.5, size: "w-6 h-6" },
              { Icon: Headphones, x: "50%", y: "15%", delay: 2, size: "w-5 h-5" },
            ].map(({ Icon, x, y, delay, size }, i) => (
              <motion.div key={i} className="absolute" style={{ left: x, top: y }}
                animate={{ y: [0, -15, 0], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 4 + i, repeat: Infinity, delay }}>
                <Icon className={`${size} text-orange-500/30`} />
              </motion.div>
            ))}
          </div>

          {/* Hero Content */}
          <div className="relative z-10 flex-1 flex flex-col justify-center">
            <div className="container mx-auto px-4 md:px-8">
              <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                {/* Left: Text */}
                <div className="flex-1 text-center lg:text-left pt-20 sm:pt-24 lg:pt-0">
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-full px-4 py-1.5 mb-5">
                    <Rocket className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">Distribution Hub</span>
                  </motion.div>
                  <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/70">Artist </span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500"
                      style={{ backgroundSize: "200% auto", animation: "shimmer 3s linear infinite" }}>Dashboard</span>
                  </motion.h1>
                  <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="mt-4 text-lg sm:text-xl text-white/60 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    Release, deliver & monetize your music across <span className="text-orange-400 font-semibold">150+ platforms</span> worldwide
                  </motion.p>
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="flex flex-wrap items-center gap-3 mt-6 justify-center lg:justify-start">
                    <Button onClick={() => { setActiveTab("releases"); setShowNewRelease(true); }}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold px-6 py-3 rounded-xl shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.02]">
                      <Plus className="w-4 h-4 mr-2" /> New Release <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("songs")}
                      className="border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 text-white px-6 py-3 rounded-xl">
                      <Music2 className="w-4 h-4 mr-2" /> My Songs
                    </Button>
                  </motion.div>
                </div>

                {/* Right: Stats Dashboard Preview (Desktop) */}
                <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                  className="hidden lg:block w-[380px] shrink-0">
                  <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white/80">Quick Overview</p>
                        <p className="text-[10px] text-white/40">Real-time stats</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { icon: Music2, label: "Songs", value: dashboard?.songs?.total || songs.length || 0, color: "from-orange-500/15 to-amber-500/10" },
                        { icon: Disc3, label: "Releases", value: dashboard?.releases?.total || 0, color: "from-purple-500/15 to-violet-500/10" },
                        { icon: Globe, label: "DSPs", value: dashboard?.dsps?.total || 0, color: "from-blue-500/15 to-cyan-500/10" },
                        { icon: DollarSign, label: "Revenue", value: `$${parseFloat(dashboard?.royalties?.totalNetRevenue || "0").toFixed(0)}`, color: "from-emerald-500/15 to-green-500/10" },
                      ].map((stat) => (
                        <div key={stat.label} className={`bg-gradient-to-br ${stat.color} border border-white/5 rounded-xl p-3`}>
                          <stat.icon className="w-4 h-4 text-orange-500 mb-1.5" />
                          <p className="text-lg font-black text-white">{stat.value}</p>
                          <p className="text-[10px] text-white/40">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Mini activity */}
                    <div className="space-y-2">
                      {[
                        { text: `${dashboard?.partners?.active || 0} active partners`, time: "Connected", color: "text-emerald-400" },
                        { text: `${dashboard?.songs?.available || 0} songs ready`, time: "To distribute", color: "text-blue-400" },
                        { text: `${dashboard?.releases?.byStatus?.live || 0} releases live`, time: "On DSPs", color: "text-purple-400" },
                      ].map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.8 + i * 0.1 }}
                          className="flex items-center gap-2 py-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text-', 'bg-')}`} />
                          <span className="text-[10px] text-white/60 truncate flex-1">{item.text}</span>
                          <span className="text-[9px] text-white/30">{item.time}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Mobile stats (shown below hero text on small screens) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-8 lg:hidden pb-6">
                {[
                  { icon: Music2, label: "Songs", value: dashboard?.songs?.total || songs.length || 0 },
                  { icon: Disc3, label: "Releases", value: dashboard?.releases?.total || 0 },
                  { icon: Globe, label: "DSPs", value: dashboard?.dsps?.total || 0 },
                  { icon: Building2, label: "Partners", value: dashboard?.partners?.total || 0 },
                  { icon: DollarSign, label: "Revenue", value: `$${parseFloat(dashboard?.royalties?.totalNetRevenue || "0").toFixed(2)}` },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                    <Card className="p-3 border-orange-500/20 bg-black/30 backdrop-blur-md shadow-lg">
                      <div className="flex items-center gap-3">
                        <stat.icon className="h-5 w-5 text-orange-500 shrink-0" />
                        <div>
                          <p className="text-xs text-white/50">{stat.label}</p>
                          <h3 className="text-lg font-bold text-white">{stat.value}</h3>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Shimmer animation */}
          <style>{`
            @keyframes shimmer {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `}</style>
        </section>

        {/* ═══════════ TAB NAVIGATION ═══════════ */}
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-white/5">
          <div className="container mx-auto px-4">
            <div className="flex gap-1.5 overflow-x-auto py-2.5 scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25"
                      : "text-white/40 hover:bg-white/5 hover:text-white/70"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="container mx-auto px-4 py-6">
          {loading && !dashboard ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <span className="ml-3 text-muted-foreground">Loading distribution system...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                
                {/* ============ OVERVIEW ============ */}
                {activeTab === "overview" && (
                  <div className="space-y-8">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Card className="p-4 bg-black/20 border-white/5 hover:border-orange-500/30 cursor-pointer transition-all group" onClick={() => { setActiveTab("releases"); setShowNewRelease(true); }}>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 group-hover:from-orange-500/30 group-hover:to-amber-500/20 transition-all"><Plus className="h-5 w-5 text-orange-500" /></div>
                          <div>
                            <h3 className="font-bold text-white">New Release</h3>
                            <p className="text-xs text-white/40">Create single, EP or album</p>
                          </div>
                          <ArrowRight className="h-4 w-4 ml-auto text-white/20 group-hover:text-orange-500 transition-colors" />
                        </div>
                      </Card>
                      <Card className="p-4 bg-black/20 border-white/5 hover:border-purple-500/30 cursor-pointer transition-all group" onClick={() => setActiveTab("partners")}>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 group-hover:from-purple-500/30 group-hover:to-violet-500/20 transition-all"><Building2 className="h-5 w-5 text-purple-500" /></div>
                          <div>
                            <h3 className="font-bold text-white">View Partners</h3>
                            <p className="text-xs text-white/40">{partners.length} white-label partners</p>
                          </div>
                          <ArrowRight className="h-4 w-4 ml-auto text-white/20 group-hover:text-purple-500 transition-colors" />
                        </div>
                      </Card>
                      <Card className="p-4 bg-black/20 border-white/5 hover:border-emerald-500/30 cursor-pointer transition-all group" onClick={() => setActiveTab("audit")}>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 group-hover:from-emerald-500/30 group-hover:to-green-500/20 transition-all"><Shield className="h-5 w-5 text-emerald-500" /></div>
                          <div>
                            <h3 className="font-bold text-white">Module Audit</h3>
                            <p className="text-xs text-white/40">System infrastructure status</p>
                          </div>
                          <ArrowRight className="h-4 w-4 ml-auto text-white/20 group-hover:text-emerald-500 transition-colors" />
                        </div>
                      </Card>
                    </div>

                    {/* Song Catalog Summary */}
                    {songs.length > 0 && (
                      <Card className="border-white/5 bg-black/20 overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                                <Music2 className="h-4 w-4 text-orange-500" />
                              </div>
                              <span className="text-white">My Song Catalog ({songs.length})</span>
                            </CardTitle>
                            <Button size="sm" variant="outline" onClick={() => setActiveTab("songs")} className="text-xs border-white/10 hover:border-orange-500/30 hover:bg-orange-500/5 text-white/60">
                              View All <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                          <CardDescription className="text-white/40">
                            {dashboard?.songs?.available || 0} songs ready to distribute · {dashboard?.songs?.inReleases || 0} in releases
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {songs.slice(0, 4).map((song) => (
                              <div key={song.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 hover:border-orange-500/20 transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                                    {song.coverArt ? (
                                      <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                                    ) : (
                                      <Music2 className="h-5 w-5 text-orange-500" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{song.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      {song.genre && <span>{song.genre}</span>}
                                      {song.isrc && <span className="text-emerald-400">ISRC ✓</span>}
                                      {song.generatedWithAI && <Badge className="bg-purple-500/20 text-purple-400 border-none text-[10px] px-1.5">AI</Badge>}
                                      <span>{song.plays} plays</span>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => quickDistribute(song.id)}
                                  disabled={distributing === song.id}
                                  className="bg-orange-500 hover:bg-orange-600 text-xs h-8"
                                >
                                  {distributing === song.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                  {distributing === song.id ? "" : "Distribute"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {songs.length === 0 && (
                      <Card className="p-8 text-center border-dashed border-2 border-orange-500/20">
                        <Music2 className="h-12 w-12 text-orange-500/30 mx-auto mb-3" />
                        <h3 className="font-semibold text-lg mb-2">No Songs Yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Upload or create songs first. Then come back here to distribute them worldwide.</p>
                        <Button onClick={() => window.location.href = "/music-generator"} className="bg-orange-500 hover:bg-orange-600">
                          <Sparkles className="h-4 w-4 mr-2" /> Create a Song with AI
                        </Button>
                      </Card>
                    )}

                    {/* Active Tools: Rights + Affiliate Distribution */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-orange-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Active Distribution Tools</h2>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <RightsManagementCard />
                        <DistributionCard />
                      </div>
                    </div>

                    {/* Platform Grid */}
                    <Card className="border-white/5 bg-black/20 overflow-hidden">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-blue-400" />
                          </div>
                          <span className="text-white">Target Platforms ({dsps.length})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                          {dsps.map((dsp) => (
                            <div key={dsp.id} className="p-3 rounded-xl bg-black/30 border border-white/5 text-center hover:border-orange-500/20 transition-all">
                              <p className="text-xs font-medium text-white/80 truncate">{dsp.name}</p>
                              <p className="text-[10px] text-white/30 mt-1">
                                {parseFloat(dsp.payPerStream) > 0.01 
                                  ? `$${dsp.payPerStream}/dl`
                                  : `$${dsp.payPerStream}/stream`}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Recent Releases */}
                    {releases.length > 0 && (
                      <Card className="border-white/5 bg-black/20">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/10 flex items-center justify-center">
                              <ListMusic className="h-4 w-4 text-purple-400" />
                            </div>
                            <span className="text-white">Recent Releases</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {releases.slice(0, 5).map((r) => (
                              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/10 flex items-center justify-center">
                                    <Disc3 className="h-5 w-5 text-purple-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{r.title}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{r.type} · UPC: {r.upc || "pending"}</p>
                                  </div>
                                </div>
                                <Badge className={`${statusColor(r.status)} border-none text-xs`}>{r.status}</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Connected Modules Hub */}
                    <Card className="border-white/5 bg-black/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-orange-500" />
                          </div>
                          <span className="text-white">Connected Modules</span>
                        </CardTitle>
                        <CardDescription className="text-white/40">Distribution hub connects to your entire Boostify ecosystem</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {[
                            { label: "Analytics", href: "/analytics", color: "bg-blue-500/15 text-blue-400", desc: "Streaming stats & charts" },
                            { label: "Contracts", href: "/contracts", color: "bg-indigo-500/15 text-indigo-400", desc: "AI legal documents" },
                            { label: "Merch Store", href: "/merchandise", color: "bg-pink-500/15 text-pink-400", desc: "Printful integration" },
                            { label: "Contacts CRM", href: "/contacts", color: "bg-emerald-500/15 text-emerald-400", desc: "Industry contacts" },
                            { label: "PR Management", href: "/pr", color: "bg-violet-500/15 text-violet-400", desc: "Outreach campaigns" },
                            { label: "YouTube Tools", href: "/youtube-views", color: "bg-red-500/15 text-red-400", desc: "Growth & SEO tools" },
                            { label: "Music Generator", href: "/music-generator", color: "bg-purple-500/15 text-purple-400", desc: "AI song creation" },
                            { label: "Video Creator", href: "/video-creator", color: "bg-amber-500/15 text-amber-400", desc: "AI music videos" },
                            { label: "Copyright", href: "/copyright-verify", color: "bg-teal-500/15 text-teal-400", desc: "Blockchain registry" },
                            { label: "Artist Branding", href: "/artist-image-advisor", color: "bg-fuchsia-500/15 text-fuchsia-400", desc: "AI image advisor" },
                            { label: "Social Media", href: "/social-media-generator", color: "bg-cyan-500/15 text-cyan-400", desc: "Content generator" },
                            { label: "Module Audit", href: "#", color: "bg-orange-500/15 text-orange-400", desc: "29 modules tracked", onClick: () => setActiveTab("audit") },
                          ].map((m) => (
                            <div
                              key={m.label}
                              onClick={() => m.onClick ? m.onClick() : (window.location.href = m.href)}
                              className="p-3 rounded-xl bg-black/30 border border-white/5 hover:border-orange-500/20 cursor-pointer transition-all hover:bg-black/40 group"
                            >
                              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${m.color} mb-1.5`}>
                                {m.label}
                              </div>
                              <p className="text-[11px] text-white/30 group-hover:text-white/50 transition-colors">{m.desc}</p>
                              <ArrowRight className="h-3 w-3 text-white/10 group-hover:text-orange-500 transition-colors mt-1" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ============ MY SONGS ============ */}
                {activeTab === "songs" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                          <Music2 className="h-4 w-4 text-orange-500" />
                        </div>
                        My Song Catalog ({songs.length})
                      </h2>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { fetchSongs(); fetchAvailableSongs(); }}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
                        <Button size="sm" onClick={() => window.location.href = "/music-generator"} className="bg-orange-500 hover:bg-orange-600">
                          <Sparkles className="h-4 w-4 mr-2" /> Create Song
                        </Button>
                      </div>
                    </div>

                    {/* Song Status Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <Card className="p-4 bg-black/20 border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Music2 className="h-4 w-4 text-orange-400" />
                          <span className="text-xs text-white/40">Total Songs</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{songs.length}</p>
                      </Card>
                      <Card className="p-4 bg-black/20 border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs text-white/40">In Releases</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{dashboard?.songs?.inReleases || 0}</p>
                      </Card>
                      <Card className="p-4 bg-black/20 border-white/5">
                        <div className="flex items-center gap-2 mb-1">
                          <Upload className="h-4 w-4 text-blue-400" />
                          <span className="text-xs text-white/40">Ready to Distribute</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-400">{dashboard?.songs?.available || 0}</p>
                      </Card>
                    </div>

                    {songs.length === 0 ? (
                      <Card className="p-12 text-center border-dashed border-2 border-white/10 bg-black/20">
                        <Music2 className="h-12 w-12 text-orange-500/30 mx-auto mb-3" />
                        <h3 className="font-semibold text-lg mb-2">No songs in your catalog</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload songs or create them with AI to start distributing worldwide.
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Button onClick={() => window.location.href = "/music-generator"} className="bg-orange-500 hover:bg-orange-600">
                            <Sparkles className="h-4 w-4 mr-2" /> Create with AI
                          </Button>
                          <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
                            <Upload className="h-4 w-4 mr-2" /> Go to Dashboard
                          </Button>
                        </div>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {songs.map((song) => (
                          <Card key={song.id} className="bg-black/20 border-white/5 hover:border-orange-500/20 transition-all">
                            <div className="p-4 flex items-center gap-4">
                              {/* Cover Art */}
                              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center">
                                {song.coverArt ? (
                                  <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                                ) : (
                                  <Music2 className="h-7 w-7 text-orange-500" />
                                )}
                              </div>
                              {/* Song Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold truncate">{song.title}</h3>
                                  {song.generatedWithAI && (
                                    <Badge className="bg-purple-500/20 text-purple-400 border-none text-[10px]">
                                      <Sparkles className="h-2.5 w-2.5 mr-0.5" /> AI Generated
                                    </Badge>
                                  )}
                                  {song.isrc && (
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[10px]">
                                      ISRC: {song.isrc}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  {song.genre && <span className="flex items-center gap-1"><Radio className="h-3 w-3" /> {song.genre}</span>}
                                  {song.mood && <span>{song.mood}</span>}
                                  {song.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {song.duration}s</span>}
                                  <span className="flex items-center gap-1"><Headphones className="h-3 w-3" /> {song.plays} plays</span>
                                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(song.createdAt).toLocaleDateString()}</span>
                                  {song.aiProvider && <span className="text-purple-400">{song.aiProvider}</span>}
                                </div>
                              </div>
                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {song.audioUrl && (
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    const audio = new Audio(song.audioUrl);
                                    audio.play().catch(() => {});
                                  }} className="h-8 w-8 p-0">
                                    <Headphones className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  onClick={() => quickDistribute(song.id)}
                                  disabled={distributing === song.id}
                                  className="bg-orange-500 hover:bg-orange-600 text-xs"
                                >
                                  {distributing === song.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Send className="h-3.5 w-3.5 mr-1" /> Quick Distribute
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* How Quick Distribute Works */}
                    <Card className="border-white/5 bg-black/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                            <Zap className="h-4 w-4 text-orange-500" />
                          </div>
                          Quick Distribute™
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          One-click distribution creates a release, assigns ISRC & UPC codes, and queues delivery to all DSPs.
                        </p>
                        <div className="grid sm:grid-cols-3 gap-4">
                          {[
                            { step: "1", title: "Click Distribute", desc: "Select any song from your catalog" },
                            { step: "2", title: "Auto-Package", desc: "Release created with UPC + ISRC assigned" },
                            { step: "3", title: "Submit for delivery", desc: "Go to Releases tab and hit Submit" },
                          ].map((item) => (
                            <div key={item.step} className="relative p-4 rounded-lg bg-background/40 border border-orange-500/15">
                              <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs">{item.step}</div>
                              <h4 className="font-semibold text-sm mb-1 mt-1">{item.title}</h4>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ============ RELEASES ============ */}
                {activeTab === "releases" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/10 flex items-center justify-center">
                          <Disc3 className="h-4 w-4 text-purple-400" />
                        </div>
                        My Releases
                      </h2>
                      <Button onClick={() => setShowNewRelease(!showNewRelease)} className="bg-orange-500 hover:bg-orange-600">
                        <Plus className="h-4 w-4 mr-2" /> New Release
                      </Button>
                    </div>

                    {/* New Release Form */}
                    <AnimatePresence>
                      {showNewRelease && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                          <Card className="border-white/10 bg-black/20 p-6">
                            <h3 className="font-semibold mb-4">Create New Release</h3>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                type="text"
                                value={newReleaseTitle}
                                onChange={(e) => setNewReleaseTitle(e.target.value)}
                                placeholder="Release title..."
                                className="flex-1 px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:border-orange-500 focus:outline-none text-white"
                              />
                              <select
                                value={newReleaseType}
                                onChange={(e) => setNewReleaseType(e.target.value)}
                                className="px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:border-orange-500 focus:outline-none text-white"
                              >
                                <option value="single">Single</option>
                                <option value="ep">EP</option>
                                <option value="album">Album</option>
                                <option value="compilation">Compilation</option>
                              </select>
                              <Button onClick={createNewRelease} className="bg-orange-500 hover:bg-orange-600" disabled={!newReleaseTitle.trim()}>
                                <Plus className="h-4 w-4 mr-2" /> Create
                              </Button>
                              <Button variant="ghost" onClick={() => setShowNewRelease(false)}><X className="h-4 w-4" /></Button>
                            </div>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Releases List */}
                    {releases.length === 0 ? (
                      <Card className="p-12 text-center border-dashed border-2 border-white/10 bg-black/20">
                        <Disc3 className="h-12 w-12 text-orange-500/30 mx-auto mb-3" />
                        <h3 className="font-semibold text-lg mb-2">No releases yet</h3>
                        <p className="text-sm text-muted-foreground mb-4">Create your first release to start distributing</p>
                        <Button onClick={() => setShowNewRelease(true)} className="bg-orange-500 hover:bg-orange-600">
                          <Plus className="h-4 w-4 mr-2" /> Create First Release
                        </Button>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {releases.map((r) => (
                          <Card key={r.id} className="bg-black/20 border-white/5 hover:border-orange-500/20 transition-all">
                            <div
                              className="p-4 flex items-center gap-4 cursor-pointer"
                              onClick={() => {
                                if (selectedRelease?.id === r.id) {
                                  setSelectedRelease(null);
                                } else {
                                  fetchReleaseDetail(r.id);
                                }
                              }}
                            >
                              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                                {r.coverArtUrl ? (
                                  <img src={r.coverArtUrl} alt={r.title} className="w-full h-full rounded-lg object-cover" />
                                ) : (
                                  <Disc3 className="h-7 w-7 text-orange-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold truncate">{r.title}</h3>
                                  <Badge className={`${statusColor(r.status)} border-none text-xs`}>{r.status.replace("_", " ")}</Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="capitalize flex items-center gap-1"><Package className="h-3 w-3" /> {r.type}</span>
                                  <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> UPC: {r.upc || "—"}</span>
                                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(r.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {r.status === "draft" && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setShowAddSong(r.id); fetchAvailableSongs(); }} className="text-xs border-orange-500/30 hover:bg-orange-500/10">
                                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Song
                                    </Button>
                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); submitReleaseForReview(r.id); }} className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                                      <Send className="h-3.5 w-3.5 mr-1" /> Submit
                                    </Button>
                                  </>
                                )}
                                {selectedRelease?.id === r.id ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            {/* Expanded Release Detail */}
                            <AnimatePresence>
                              {selectedRelease?.id === r.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <ListMusic className="h-4 w-4 text-orange-500" />
                                        Tracks ({selectedRelease.tracks?.length || 0})
                                      </h4>
                                      {r.status === "draft" && (
                                        <Button size="sm" variant="ghost" onClick={() => { setShowAddSong(r.id); fetchAvailableSongs(); }} className="text-xs text-orange-500 hover:text-orange-400">
                                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Song
                                        </Button>
                                      )}
                                    </div>

                                    {(!selectedRelease.tracks || selectedRelease.tracks.length === 0) ? (
                                      <div className="text-center py-6 text-sm text-muted-foreground">
                                        <FileAudio className="h-8 w-8 mx-auto mb-2 text-orange-500/30" />
                                        <p>No tracks yet. Add songs to this release.</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {selectedRelease.tracks.map((track: any, idx: number) => (
                                          <div key={track.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/30 border border-white/5">
                                            <span className="w-6 h-6 rounded-full bg-orange-500/15 flex items-center justify-center text-xs font-bold text-orange-500">
                                              {track.trackNumber || idx + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium truncate">{track.title || track.song?.title || "Untitled"}</p>
                                              <p className="text-xs text-muted-foreground">
                                                ISRC: {track.isrc || "—"}
                                                {track.duration && ` · ${track.duration}`}
                                              </p>
                                            </div>
                                            {r.status === "draft" && (
                                              <Button size="sm" variant="ghost" onClick={() => removeTrack(track.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 p-0">
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Submissions */}
                                    {selectedRelease.submissions && selectedRelease.submissions.length > 0 && (
                                      <div className="mt-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                          <Globe className="h-4 w-4 text-orange-500" />
                                          DSP Submissions
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                          {selectedRelease.submissions.map((sub: any) => (
                                            <div key={sub.id} className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-white/5 text-xs">
                                              <span className={`w-2 h-2 rounded-full ${sub.status === 'live' ? 'bg-emerald-500' : sub.status === 'delivering' ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                                              <span className="truncate">{sub.dspName}</span>
                                              <Badge className="ml-auto text-[10px] px-1.5">{sub.status}</Badge>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* How Distribution Works */}
                    <Card className="border-white/5 bg-black/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </div>
                          How It Works
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid sm:grid-cols-4 gap-4">
                          {[
                            { step: "1", title: "Create Release", desc: "Add title, artwork & metadata" },
                            { step: "2", title: "Add Tracks", desc: "Link songs, auto-assign ISRC" },
                            { step: "3", title: "Submit", desc: "Review & distribute to 150+ DSPs" },
                            { step: "4", title: "Earn", desc: "Track streams & collect royalties" },
                          ].map((item) => (
                            <div key={item.step} className="relative p-4 rounded-lg bg-background/40 border border-orange-500/15">
                              <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xs">{item.step}</div>
                              <h4 className="font-semibold text-sm mb-1 mt-1">{item.title}</h4>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* ============ PARTNERS ============ */}
                {activeTab === "partners" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-purple-400" />
                        </div>
                        Distribution Partners & Outreach ({partners.length})
                      </h2>
                      <Button variant="outline" size="sm" onClick={() => { fetchPartners(); fetchPartnerProfiles(); }}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
                    </div>

                    {/* Tier Legend */}
                    <div className="flex gap-3 text-xs flex-wrap">
                      <Badge className={tierBadge("tier1")}>Tier 1 — Premium</Badge>
                      <Badge className={tierBadge("tier2")}>Tier 2 — Mid</Badge>
                      <Badge className={tierBadge("tier3")}>Tier 3 — Affiliate</Badge>
                    </div>

                    <div className="space-y-3">
                      {partners.map((p) => {
                        const profile = partnerProfiles.find(pp => pp.slug === p.slug);
                        const isExpanded = expandedPartner === p.id;
                        const pkg = outreachPkg[p.id];

                        return (
                        <Card key={p.id} className="bg-black/20 border-white/5 hover:border-orange-500/20 transition-all">
                          <div className="p-4">
                            {/* Header row */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => togglePartnerExpand(p.id)}>
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 relative">
                                  <Building2 className="h-5 w-5 text-purple-400" />
                                  {profile && (
                                    <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-orange-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                                      {profile.priorityScore}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold truncate">{p.name}</h3>
                                    <Badge className={`${tierBadge(p.tier)} text-[10px] px-2 py-0`}>{p.tier.replace("tier", "T")}</Badge>
                                    <Badge className={`${statusColor(p.status)} border-none text-[10px]`}>{p.status}</Badge>
                                    {profile && (
                                      <span className="flex items-center gap-0.5 text-[10px] text-orange-400">
                                        {Array.from({length: Math.min(5, Math.ceil(profile.priorityScore / 2))}).map((_, i) => (
                                          <Star key={i} className="h-2.5 w-2.5 fill-orange-400" />
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                                    <span className="capitalize">{p.type.replace("_", " ")}</span>
                                    <span>{p.territories} territories</span>
                                    {p.contactEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {p.contactEmail}</span>}
                                    {profile && <span className="text-orange-400/80">{profile.b2bPath}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge className={`${statusColor(p.outreachStatus)} border-none text-[10px]`}>
                                  {p.outreachStatus.replace(/_/g, " ")}
                                </Badge>
                                {p.website && (
                                  <Button variant="ghost" size="sm" onClick={() => window.open(p.website!, "_blank")} className="h-8 w-8 p-0">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {p.contactEmail && p.outreachStatus === "not_contacted" && (
                                  <Button
                                    size="sm"
                                    onClick={() => sendOutreach(p.id, "full")}
                                    disabled={sending === p.id}
                                    className="bg-purple-600 hover:bg-purple-700 text-xs h-8"
                                  >
                                    {sending === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                    {sending === p.id ? "" : "Send Email"}
                                  </Button>
                                )}
                                {p.contactEmail && p.outreachStatus === "email_sent" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendOutreach(p.id, "follow_up")}
                                    disabled={sending === p.id}
                                    className="text-xs h-8 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                  >
                                    {sending === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
                                    {sending === p.id ? "" : "Follow Up"}
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => togglePartnerExpand(p.id)}>
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            {/* Features */}
                            {p.features && p.features.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {p.features.map((f, i) => (
                                  <span key={i} className="px-2 py-0.5 text-[10px] rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/15">{f}</span>
                                ))}
                              </div>
                            )}

                            {/* Expanded: Research Profile + Outreach Engine */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                                    {/* Research Profile */}
                                    {profile && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                          <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1"><FileText className="h-3 w-3" /> B2B Path</h4>
                                          <p className="text-xs text-white/40">{profile.b2bPath}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                          <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1"><Zap className="h-3 w-3" /> White-Label</h4>
                                          <p className="text-xs text-white/40">{profile.whiteLabelOffering}</p>
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                          <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1"><Globe className="h-3 w-3" /> API Docs</h4>
                                          {profile.apiDocs !== "N/A" ? (
                                            <a href={profile.apiDocs} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline">{profile.apiDocs}</a>
                                          ) : (
                                            <p className="text-xs text-white/40">Not available</p>
                                          )}
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                          <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1"><Star className="h-3 w-3" /> Fit Notes</h4>
                                          <p className="text-xs text-white/40">{profile.fitNotes}</p>
                                        </div>
                                        {profile.contactRoutes.length > 0 && (
                                          <div className="p-3 rounded-xl bg-black/30 border border-white/5 md:col-span-2">
                                            <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1"><Mail className="h-3 w-3" /> Contact Routes</h4>
                                            <div className="flex flex-wrap gap-2">
                                              {profile.contactRoutes.map((cr, i) => (
                                                <span key={i} className="px-2 py-1 text-[10px] rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/15">
                                                  <strong className="capitalize">{cr.type}:</strong> {cr.value}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Outreach Engine */}
                                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                          <MessageSquare className="h-4 w-4 text-orange-500" /> Outreach Engine
                                        </h4>
                                        {pkg && (
                                          <Badge className="bg-emerald-500/20 text-emerald-400 border-none text-[9px]">{pkg.internalStatusLabel}</Badge>
                                        )}
                                      </div>

                                      {!pkg ? (
                                        <div className="flex items-center justify-center py-4">
                                          <Loader2 className="h-5 w-5 animate-spin text-orange-500/50" />
                                          <span className="ml-2 text-xs text-muted-foreground">Loading outreach package...</span>
                                        </div>
                                      ) : (
                                        <>
                                          {/* Format selector */}
                                          <div className="flex flex-wrap gap-1.5 mb-3">
                                            {[
                                              { key: "fullPartnershipEmail", label: "Full Email", icon: Mail },
                                              { key: "followUpEmail", label: "Follow-Up", icon: Send },
                                              { key: "shortOutreach", label: "Short Intro", icon: Zap },
                                              { key: "linkedInMessage", label: "LinkedIn", icon: Linkedin },
                                              { key: "contactFormMessage", label: "Contact Form", icon: FileText },
                                              { key: "emailSubject", label: "Subject Line", icon: Hash },
                                            ].map(fmt => (
                                              <Button
                                                key={fmt.key}
                                                variant={outreachFormat === fmt.key ? "default" : "outline"}
                                                size="sm"
                                                className={`text-[10px] h-7 px-2 ${outreachFormat === fmt.key ? "bg-orange-500 hover:bg-orange-600 text-white" : "border-orange-500/20 text-orange-300 hover:bg-orange-500/10"}`}
                                                onClick={() => setOutreachFormat(fmt.key)}
                                              >
                                                <fmt.icon className="h-3 w-3 mr-1" /> {fmt.label}
                                              </Button>
                                            ))}
                                          </div>

                                          {/* Content preview */}
                                          <div className="relative">
                                            <div className="bg-black/30 rounded-lg p-3 max-h-64 overflow-y-auto text-xs text-gray-300 whitespace-pre-wrap border border-orange-500/10">
                                              {outreachFormat === "fullPartnershipEmail" || outreachFormat === "followUpEmail" ? (
                                                <div dangerouslySetInnerHTML={{ __html: (pkg as any)[outreachFormat] }} />
                                              ) : (
                                                <p>{(pkg as any)[outreachFormat]}</p>
                                              )}
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="absolute top-2 right-2 h-7 px-2 text-[10px] bg-black/50 hover:bg-orange-500/20"
                                              onClick={() => copyToClipboard((pkg as any)[outreachFormat])}
                                            >
                                              {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                              <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
                                            </Button>
                                          </div>
                                        </>
                                      )}
                                    </div>

                                    {/* ═════════ COMMUNICATION CENTER ═════════ */}
                                    <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                                          <MessageSquare className="h-4 w-4 text-purple-400" /> Communication Center
                                        </h4>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <select
                                            value={p.outreachStatus}
                                            onChange={(e) => updateOutreachStatus(p.id, e.target.value)}
                                            className="bg-black/40 border border-white/10 text-[10px] rounded px-2 py-1 text-white/80 focus:outline-none focus:border-orange-500/40"
                                          >
                                            <option value="not_contacted">not_contacted</option>
                                            <option value="email_sent">email_sent</option>
                                            <option value="replied">replied</option>
                                            <option value="meeting_scheduled">meeting_scheduled</option>
                                            <option value="contract_review">contract_review</option>
                                            <option value="signed">signed</option>
                                          </select>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[10px] border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                                            onClick={() => setComposeOpen(composeOpen === p.id ? null : p.id)}
                                          >
                                            <Send className="h-3 w-3 mr-1" />
                                            {composeOpen === p.id ? "Close composer" : "Custom message"}
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Custom message composer */}
                                      <AnimatePresence>
                                        {composeOpen === p.id && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="space-y-2 mb-3 p-2 rounded-lg bg-black/40 border border-purple-500/20">
                                              <div className="flex gap-2">
                                                <select
                                                  value={composeChannel}
                                                  onChange={(e) => setComposeChannel(e.target.value)}
                                                  className="bg-black/40 border border-white/10 text-[11px] rounded px-2 py-1 text-white/80"
                                                >
                                                  <option value="email">Email</option>
                                                  <option value="linkedin">LinkedIn</option>
                                                  <option value="form">Contact form</option>
                                                  <option value="phone">Phone</option>
                                                  <option value="meeting">Meeting</option>
                                                </select>
                                                <input
                                                  value={composeSubject}
                                                  onChange={(e) => setComposeSubject(e.target.value)}
                                                  placeholder="Subject..."
                                                  className="flex-1 bg-black/40 border border-white/10 text-xs rounded px-2 py-1 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/40"
                                                />
                                              </div>
                                              <textarea
                                                value={composeBody}
                                                onChange={(e) => setComposeBody(e.target.value)}
                                                placeholder="Write your message... (HTML allowed for email)"
                                                rows={5}
                                                className="w-full bg-black/40 border border-white/10 text-xs rounded px-2 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/40"
                                              />
                                              <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-muted-foreground">
                                                  {composeChannel === "email"
                                                    ? `Will send to ${p.contactEmail || "no email on file"} via Brevo`
                                                    : "Will be logged (no external send)"}
                                                </p>
                                                <Button
                                                  size="sm"
                                                  onClick={() => sendCustomMessage(p.id)}
                                                  disabled={composing || !composeSubject.trim() || !composeBody.trim() || (composeChannel === "email" && !p.contactEmail)}
                                                  className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700"
                                                >
                                                  {composing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                                                  Send & log
                                                </Button>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      {/* Outreach log (timeline) */}
                                      <div className="mb-3">
                                        <p className="text-[10px] font-semibold text-purple-300 mb-1.5 uppercase tracking-wider">
                                          Activity timeline ({outreachLogs[p.id]?.length || 0})
                                        </p>
                                        {!outreachLogs[p.id] ? (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Loading log...
                                          </div>
                                        ) : outreachLogs[p.id].length === 0 ? (
                                          <p className="text-[11px] text-muted-foreground italic">No activity yet. Send a message or log a note.</p>
                                        ) : (
                                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                            {outreachLogs[p.id].map((entry: any) => (
                                              <div key={entry.id} className="p-2 rounded-lg bg-black/40 border border-white/5 text-xs">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <Badge className={`text-[9px] border-none ${
                                                      entry.direction === "outbound" ? "bg-blue-500/20 text-blue-300" :
                                                      entry.direction === "inbound" ? "bg-emerald-500/20 text-emerald-300" :
                                                      "bg-gray-500/20 text-gray-300"
                                                    }`}>
                                                      {entry.direction}
                                                    </Badge>
                                                    <Badge className="text-[9px] bg-white/5 text-white/60 border-none">{entry.channel}</Badge>
                                                    {entry.status && (
                                                      <Badge className={`text-[9px] border-none ${
                                                        entry.status === "sent" || entry.status === "delivered" ? "bg-emerald-500/20 text-emerald-300" :
                                                        entry.status === "failed" || entry.status === "bounced" ? "bg-red-500/20 text-red-300" :
                                                        "bg-white/5 text-white/60"
                                                      }`}>
                                                        {entry.status}
                                                      </Badge>
                                                    )}
                                                  </div>
                                                  <span className="text-[10px] text-muted-foreground">
                                                    {new Date(entry.createdAt).toLocaleString()}
                                                  </span>
                                                </div>
                                                {entry.subject && <p className="mt-1 text-[11px] font-medium">{entry.subject}</p>}
                                                {entry.body && (
                                                  <div
                                                    className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-20 overflow-y-auto"
                                                    dangerouslySetInnerHTML={{ __html: String(entry.body).replace(/<script[\s\S]*?<\/script>/gi, "") }}
                                                  />
                                                )}
                                                {entry.recipientEmail && (
                                                  <p className="mt-1 text-[10px] text-muted-foreground">→ {entry.recipientEmail}</p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex gap-1.5 mt-2">
                                          <input
                                            id={`quick-note-${p.id}`}
                                            placeholder="Quick note (e.g. 'Left voicemail, will call back Monday')..."
                                            className="flex-1 bg-black/40 border border-white/10 text-[11px] rounded px-2 py-1 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/40"
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter") {
                                                const target = e.target as HTMLInputElement;
                                                if (target.value.trim()) {
                                                  logManualNote(p.id, target.value.trim());
                                                  target.value = "";
                                                }
                                              }
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[10px] border-white/10"
                                            onClick={() => {
                                              const el = document.getElementById(`quick-note-${p.id}`) as HTMLInputElement;
                                              if (el && el.value.trim()) {
                                                logManualNote(p.id, el.value.trim());
                                                el.value = "";
                                              }
                                            }}
                                          >
                                            Log
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Persistent CRM notes */}
                                      <div>
                                        <p className="text-[10px] font-semibold text-purple-300 mb-1.5 uppercase tracking-wider">Partner notes</p>
                                        <textarea
                                          value={partnerNotes[p.id] ?? ""}
                                          onChange={(e) => setPartnerNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                                          placeholder="Private notes about this partner..."
                                          rows={3}
                                          className="w-full bg-black/40 border border-white/10 text-[11px] rounded px-2 py-1.5 text-white/80 placeholder-white/30 focus:outline-none focus:border-purple-500/40"
                                        />
                                        <div className="flex justify-end mt-1.5">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => saveNotes(p.id)}
                                            disabled={savingNotes === p.id}
                                            className="h-7 text-[10px] border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                          >
                                            {savingNotes === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                            Save notes
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ============ DSPs ============ */}
                {activeTab === "dsps" && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
                        <Globe className="h-4 w-4 text-blue-400" />
                      </div>
                      Digital Service Providers ({dsps.length})
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dsps.map((dsp) => (
                        <Card key={dsp.id} className="bg-black/20 border-white/5 hover:border-orange-500/20 transition-all p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              dsp.category === "streaming" ? "bg-green-500/15" :
                              dsp.category === "download" ? "bg-blue-500/15" :
                              dsp.category === "social" ? "bg-pink-500/15" : "bg-gray-500/15"
                            }`}>
                              {dsp.category === "streaming" ? <Headphones className="h-5 w-5 text-green-400" /> :
                               dsp.category === "social" ? <Smartphone className="h-5 w-5 text-pink-400" /> :
                               dsp.category === "download" ? <FileAudio className="h-5 w-5 text-blue-400" /> :
                               <Radio className="h-5 w-5 text-gray-400" />}
                            </div>
                            <div>
                              <h3 className="font-semibold">{dsp.name}</h3>
                              <Badge className="text-[10px] bg-gray-500/20 text-gray-400 border-none capitalize">{dsp.category}</Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                              <p className="text-white/40">Pay Rate</p>
                              <p className="font-semibold text-orange-400">
                                {parseFloat(dsp.payPerStream) > 0.01 
                                  ? `$${dsp.payPerStream}/download`
                                  : parseFloat(dsp.payPerStream) > 0 
                                    ? `$${dsp.payPerStream}/stream` 
                                    : "Variable"}
                              </p>
                            </div>
                            <div className="p-2 rounded-lg bg-black/30 border border-white/5">
                              <p className="text-white/40">Territories</p>
                              <p className="font-semibold text-white">{dsp.territories}+</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* ============ ROYALTIES ============ */}
                {activeTab === "royalties" && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                      </div>
                      Royalties & Earnings
                    </h2>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { label: "Total Streams", value: dashboard?.royalties?.totalStreams || "0", icon: Headphones, color: "text-green-400" },
                        { label: "Net Revenue", value: `$${parseFloat(dashboard?.royalties?.totalNetRevenue || "0").toFixed(2)}`, icon: DollarSign, color: "text-orange-400" },
                        { label: "Transactions", value: dashboard?.royalties?.transactionCount || 0, icon: BarChart3, color: "text-blue-400" },
                        { label: "Active DSPs", value: dsps.length, icon: Globe, color: "text-purple-400" },
                      ].map((s, i) => (
                        <Card key={s.label} className="p-4 bg-black/20 border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <s.icon className={`h-4 w-4 ${s.color}`} />
                            <span className="text-xs text-white/40">{s.label}</span>
                          </div>
                          <p className="text-2xl font-bold text-white">{s.value}</p>
                        </Card>
                      ))}
                    </div>

                    <Card className="p-8 text-center border-dashed border-2 border-white/10 bg-black/20">
                      <DollarSign className="h-12 w-12 text-orange-500/30 mx-auto mb-3" />
                      <h3 className="font-semibold text-lg mb-2 text-white">Royalties Coming Soon</h3>
                      <p className="text-sm text-white/40 max-w-md mx-auto">
                        Once your releases go live on DSPs, royalty data will appear here with per-platform breakdowns, territory analytics, and payment reports.
                      </p>
                    </Card>
                  </div>
                )}

                {/* ============ SONG DNA ============ */}
                {activeTab === "song-dna" && (
                  <SongDNATab artistId={undefined} />
                )}

                {/* ============ MODULE AUDIT ============ */}
                {activeTab === "audit" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
                          <Shield className="h-4 w-4 text-emerald-400" />
                        </div>
                        Distribution Module Audit
                      </h2>
                      <Button variant="outline" size="sm" onClick={() => fetchDashboard()}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {[
                        { status: "EXISTS_CONNECTED", label: "Connected" },
                        { status: "EXISTS_NOT_CONNECTED", label: "Exists (Not Linked)" },
                        { status: "PARTIAL", label: "Partial" },
                        { status: "MISSING_CREATE_NOW", label: "Missing" },
                        { status: "PLANNED", label: "Planned" },
                      ].map((l) => (
                        <Badge key={l.status} className={`${statusColor(l.status)} border-none`}>{l.label}</Badge>
                      ))}
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(() => {
                        const audit = dashboard?.audit || [];
                        const connected = audit.filter((m) => m.status === "EXISTS_CONNECTED").length;
                        const notConnected = audit.filter((m) => m.status === "EXISTS_NOT_CONNECTED").length;
                        const partial = audit.filter((m) => m.status === "PARTIAL").length;
                        const missing = audit.filter((m) => m.status === "MISSING_CREATE_NOW").length;
                        const planned = audit.filter((m) => m.status === "PLANNED").length;
                        return [
                          { label: "Connected", value: connected, color: "border-emerald-500 text-emerald-400" },
                          { label: "Exists (Unlinked)", value: notConnected, color: "border-blue-500 text-blue-400" },
                          { label: "Partial", value: partial, color: "border-orange-500 text-orange-400" },
                          { label: "Missing", value: missing, color: "border-red-500 text-red-400" },
                          { label: "Total", value: audit.length, color: "border-white/30 text-white" },
                        ].map((s) => (
                          <Card key={s.label} className={`p-3 text-center border-l-4 ${s.color} bg-black/20`}>
                            <p className="text-2xl font-bold">{s.value}</p>
                            <p className="text-xs text-muted-foreground">{s.label}</p>
                          </Card>
                        ));
                      })()}
                    </div>

                    <div className="space-y-3">
                      {(dashboard?.audit || []).map((m, i) => (
                        <Card key={i} className="bg-black/20 border-white/5">
                          <div className="p-4 flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              m.status === "EXISTS_CONNECTED" ? "bg-emerald-500/15" :
                              m.status === "EXISTS_NOT_CONNECTED" ? "bg-yellow-500/15" :
                              m.status === "PARTIAL" ? "bg-orange-500/15" :
                              m.status === "MISSING_CREATE_NOW" ? "bg-red-500/15" : "bg-blue-500/15"
                            }`}>
                              {m.status === "EXISTS_CONNECTED" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> :
                               m.status === "EXISTS_NOT_CONNECTED" ? <Eye className="h-5 w-5 text-yellow-400" /> :
                               m.status === "PARTIAL" ? <AlertCircle className="h-5 w-5 text-orange-400" /> :
                               m.status === "MISSING_CREATE_NOW" ? <X className="h-5 w-5 text-red-400" /> :
                               <Clock className="h-5 w-5 text-blue-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="font-semibold text-sm">{m.module}</h3>
                                <Badge className={`${statusColor(m.status)} border-none text-[10px]`}>{m.status.replace(/_/g, " ")}</Badge>
                                <Badge className={`text-[10px] border-none ${
                                  m.priority === "critical" ? "bg-red-500/20 text-red-400" :
                                  m.priority === "high" ? "bg-orange-500/20 text-orange-400" :
                                  m.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                                  "bg-gray-500/20 text-gray-400"
                                }`}>
                                  {m.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{m.description}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* ============ ADD SONG TO RELEASE MODAL ============ */}
      <AnimatePresence>
        {showAddSong !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowAddSong(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5 text-orange-500" />
                  Add Song to Release
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddSong(null)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                {availableSongs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <Music2 className="h-10 w-10 mx-auto mb-3 text-orange-500/30" />
                    <p className="font-medium mb-1">No songs available</p>
                    <p className="text-xs">All songs are already assigned to releases, or you haven't uploaded any songs yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableSongs.map((song) => (
                      <div key={song.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-orange-500/20 hover:bg-orange-500/5 transition-all">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {song.coverArt ? (
                            <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <Music2 className="h-5 w-5 text-orange-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {song.genre || "—"}{song.duration ? ` · ${song.duration}` : ""}
                            {song.generatedWithAI && " · AI"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addSongToRelease(showAddSong, song.id)}
                          className="bg-orange-500 hover:bg-orange-600 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
