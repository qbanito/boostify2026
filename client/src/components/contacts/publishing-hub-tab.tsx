/**
 * Publishing Hub Tab — Sync Licensing & Music Publishing Business Module
 * 
 * Features:
 * - Dashboard with submission/deal stats
 * - Browse active briefs from companies
 * - Submit tracks to briefs or pitch directly to contacts
 * - Track deals with financial terms
 * - Industry messaging
 */

import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "../ui/dialog";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music, Send, FileText, DollarSign, TrendingUp, Building2,
  Briefcase, Globe, Clock, CheckCircle2, XCircle,
  Search, Filter, Plus, Eye, MessageSquare, ArrowRight,
  Sparkles, Star, Film, Tv, Clapperboard, Gamepad2,
  Mic2, Radio, ShoppingBag, Loader2, Copy, Mail,
  FileSignature, Users, BarChart3, Target, Zap,
} from "lucide-react";

const PROJECT_TYPES = [
  { value: "tv_series", label: "TV Series", icon: Tv, color: "text-blue-400" },
  { value: "film", label: "Film", icon: Film, color: "text-purple-400" },
  { value: "commercial", label: "Commercial", icon: ShoppingBag, color: "text-green-400" },
  { value: "video_game", label: "Video Game", icon: Gamepad2, color: "text-pink-400" },
  { value: "trailer", label: "Trailer", icon: Clapperboard, color: "text-orange-400" },
  { value: "podcast", label: "Podcast", icon: Mic2, color: "text-cyan-400" },
  { value: "social_media", label: "Social Media", icon: Globe, color: "text-yellow-400" },
  { value: "corporate", label: "Corporate", icon: Building2, color: "text-gray-400" },
  { value: "other", label: "Other", icon: Radio, color: "text-red-400" },
];

const DEAL_TYPES = [
  { value: "sync_license", label: "Sync License" },
  { value: "master_license", label: "Master License" },
  { value: "publishing_admin", label: "Publishing Admin" },
  { value: "co_publishing", label: "Co-Publishing" },
  { value: "sub_publishing", label: "Sub-Publishing" },
  { value: "blanket_license", label: "Blanket License" },
  { value: "micro_license", label: "Micro License" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400",
  active: "bg-green-500/20 text-green-400",
  submitted: "bg-blue-500/20 text-blue-400",
  under_review: "bg-yellow-500/20 text-yellow-400",
  shortlisted: "bg-purple-500/20 text-purple-400",
  accepted: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  licensed: "bg-emerald-500/20 text-emerald-400",
  deal_in_progress: "bg-orange-500/20 text-orange-400",
  proposed: "bg-blue-500/20 text-blue-400",
  negotiating: "bg-yellow-500/20 text-yellow-400",
  contract_sent: "bg-purple-500/20 text-purple-400",
  contract_signed: "bg-green-500/20 text-green-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-red-500/20 text-red-400",
};

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function PublishingHubTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState("overview");
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showPitchDialog, setShowPitchDialog] = useState(false);
  const [showBriefDialog, setShowBriefDialog] = useState(false);
  const [selectedBrief, setSelectedBrief] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form state for submissions
  const [trackTitle, setTrackTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [genre, setGenre] = useState("");
  const [pitchNote, setPitchNote] = useState("");
  const [suggestedFee, setSuggestedFee] = useState("");

  // Brief form state
  const [briefTitle, setBriefTitle] = useState("");
  const [briefDesc, setBriefDesc] = useState("");
  const [briefType, setBriefType] = useState("tv_series");
  const [briefBudgetMin, setBriefBudgetMin] = useState("");
  const [briefBudgetMax, setBriefBudgetMax] = useState("");

  // Queries
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["/api/publishing/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/publishing/dashboard", { credentials: "include" });
      if (!res.ok) return { submissions: { total: 0, pending: 0, accepted: 0, rejected: 0 }, deals: { total: 0, active: 0, totalEarnings: 0 }, briefs: { available: 0 }, contacts: { publishing: 0, sync: 0, tv: 0 } };
      return res.json();
    },
    enabled: !!user,
  });

  const { data: briefsData, isLoading: briefsLoading } = useQuery({
    queryKey: ["/api/publishing/briefs"],
    queryFn: async () => {
      const res = await fetch("/api/publishing/briefs?status=active", { credentials: "include" });
      if (!res.ok) return { briefs: [], total: 0 };
      return res.json();
    },
    enabled: subTab === "briefs" || subTab === "overview",
  });

  const { data: subsData } = useQuery({
    queryKey: ["/api/publishing/submissions"],
    queryFn: async () => {
      const res = await fetch("/api/publishing/submissions", { credentials: "include" });
      if (!res.ok) return { submissions: [] };
      return res.json();
    },
    enabled: subTab === "submissions" || subTab === "overview",
  });

  const { data: dealsData } = useQuery({
    queryKey: ["/api/publishing/deals"],
    queryFn: async () => {
      const res = await fetch("/api/publishing/deals", { credentials: "include" });
      if (!res.ok) return { deals: [], totalEarnings: 0, activeDeals: 0 };
      return res.json();
    },
    enabled: subTab === "deals" || subTab === "overview",
  });

  const { data: contactsData } = useQuery({
    queryKey: ["/api/publishing/contacts", contactSearch, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (contactSearch) params.set("search", contactSearch);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetch(`/api/publishing/contacts?${params}`, { credentials: "include" });
      if (!res.ok) return { contacts: [], total: 0 };
      return res.json();
    },
    enabled: subTab === "contacts",
  });

  // Mutations
  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/publishing/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Track Submitted!", description: "Your track has been submitted for review." });
      setShowSubmitDialog(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["/api/publishing/submissions"] });
      qc.invalidateQueries({ queryKey: ["/api/publishing/dashboard"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pitchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/publishing/pitch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Pitch Sent!", description: `Submitted to ${data.contactName}` });
      setShowPitchDialog(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["/api/publishing"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createBriefMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/publishing/briefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Brief Created!", description: "Your music brief is now active." });
      setShowBriefDialog(false);
      setBriefTitle(""); setBriefDesc(""); setBriefType("tv_series"); setBriefBudgetMin(""); setBriefBudgetMax("");
      qc.invalidateQueries({ queryKey: ["/api/publishing/briefs"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setTrackTitle(""); setArtistName(""); setTrackUrl(""); setGenre("");
    setPitchNote(""); setSuggestedFee(""); setSelectedBrief(null); setSelectedContact(null);
  };

  const stats = [
    { label: "Submissions", value: dashboard?.submissions?.total || 0, icon: Send, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Active Deals", value: dashboard?.deals?.active || 0, icon: FileSignature, color: "text-green-400", bg: "bg-green-500/10" },
    { label: "Total Earnings", value: formatCurrency(dashboard?.deals?.totalEarnings || 0), icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Open Briefs", value: dashboard?.briefs?.available || 0, icon: FileText, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  const industryContacts = [
    { label: "Publishing", count: dashboard?.contacts?.publishing || 0, color: "text-pink-400" },
    { label: "Sync/Licensing", count: dashboard?.contacts?.sync || 0, color: "text-orange-400" },
    { label: "TV/Film", count: dashboard?.contacts?.tv || 0, color: "text-blue-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div className="relative bg-gradient-to-br from-amber-600/90 via-orange-600/90 to-red-600/90 p-6 sm:p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTUgMGwxNSAxNS0xNSAxNUwwIDE1eiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Clapperboard className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Publishing & Sync Hub</h2>
                  <p className="text-white/70 text-xs">License your music to TV, Film, Games & Commercials</p>
                </div>
              </div>
              <p className="text-white/80 text-sm max-w-xl">
                Connect with music supervisors, submit to open briefs, negotiate deals, and earn sync licensing revenue. Your music belongs on screen.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button onClick={() => setShowBriefDialog(true)} className="bg-white/20 backdrop-blur-sm text-white border border-white/30 hover:bg-white/30">
                <Plus className="w-4 h-4 mr-1.5" /> Post Brief
              </Button>
              <Button onClick={() => { setSubTab("contacts"); }} className="bg-white text-orange-700 hover:bg-orange-50 font-bold">
                <Send className="w-4 h-4 mr-1.5" /> Pitch Music
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Industry Contact Count */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-400" />
            <h3 className="font-bold text-sm">Industry Database</h3>
          </div>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setSubTab("contacts")}>
            Browse All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="flex gap-4">
          {industryContacts.map((c) => (
            <div key={c.label} className="flex items-center gap-2">
              <Star className={`w-3.5 h-3.5 ${c.color}`} />
              <span className="text-sm"><span className="font-bold">{c.count}</span> <span className="text-muted-foreground">{c.label}</span></span>
            </div>
          ))}
        </div>
      </Card>

      {/* Sub-Tabs */}
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="bg-background border inline-flex w-auto min-w-full sm:min-w-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-500/20 text-xs sm:text-sm px-3 flex-1 sm:flex-none">
              <BarChart3 className="w-3.5 h-3.5 mr-1" /> Overview
            </TabsTrigger>
            <TabsTrigger value="briefs" className="data-[state=active]:bg-purple-500/20 text-xs sm:text-sm px-3 flex-1 sm:flex-none">
              <FileText className="w-3.5 h-3.5 mr-1" /> Briefs
            </TabsTrigger>
            <TabsTrigger value="submissions" className="data-[state=active]:bg-blue-500/20 text-xs sm:text-sm px-3 flex-1 sm:flex-none">
              <Send className="w-3.5 h-3.5 mr-1" /> Submissions
            </TabsTrigger>
            <TabsTrigger value="deals" className="data-[state=active]:bg-green-500/20 text-xs sm:text-sm px-3 flex-1 sm:flex-none">
              <FileSignature className="w-3.5 h-3.5 mr-1" /> Deals
            </TabsTrigger>
            <TabsTrigger value="contacts" className="data-[state=active]:bg-pink-500/20 text-xs sm:text-sm px-3 flex-1 sm:flex-none">
              <Building2 className="w-3.5 h-3.5 mr-1" /> Contacts
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ========== OVERVIEW ========== */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Submissions */}
            <Card className="p-5">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" /> Recent Submissions
              </h4>
              {(subsData?.submissions || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Music className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No submissions yet</p>
                  <p className="text-xs mt-1">Submit your first track to a brief or company</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(subsData?.submissions || []).slice(0, 5).map((sub: any) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center gap-3">
                        <Music className="w-4 h-4 text-blue-400" />
                        <div>
                          <p className="text-sm font-medium">{sub.trackTitle}</p>
                          <p className="text-xs text-muted-foreground">{sub.artistName}</p>
                        </div>
                      </div>
                      <Badge className={STATUS_COLORS[sub.status] || "bg-gray-500/20 text-gray-400"}>
                        {sub.status?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent Deals */}
            <Card className="p-5">
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <FileSignature className="w-4 h-4 text-green-400" /> Active Deals
              </h4>
              {(dealsData?.deals || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No deals yet</p>
                  <p className="text-xs mt-1">Start pitching to get your first sync deal</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(dealsData?.deals || []).slice(0, 5).map((deal: any) => (
                    <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                      <div>
                        <p className="text-sm font-medium">{deal.title}</p>
                        <p className="text-xs text-muted-foreground">{deal.companyName} · {deal.dealType?.replace(/_/g, " ")}</p>
                      </div>
                      <div className="text-right">
                        {deal.dealAmount && <p className="text-sm font-bold text-green-400">{formatCurrency(deal.dealAmount)}</p>}
                        <Badge className={STATUS_COLORS[deal.status] || ""}>{deal.status?.replace(/_/g, " ")}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="p-5">
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" /> Quick Actions
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setSubTab("briefs")}>
                <FileText className="w-5 h-5 text-purple-400" />
                <span className="text-xs">Browse Briefs</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setShowSubmitDialog(true)}>
                <Send className="w-5 h-5 text-blue-400" />
                <span className="text-xs">Submit Track</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setSubTab("contacts")}>
                <Mail className="w-5 h-5 text-pink-400" />
                <span className="text-xs">Pitch Companies</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2" onClick={() => setShowBriefDialog(true)}>
                <Plus className="w-5 h-5 text-green-400" />
                <span className="text-xs">Post Brief</span>
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ========== BRIEFS ========== */}
        <TabsContent value="briefs" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Open Briefs
              <Badge variant="secondary">{briefsData?.total || 0}</Badge>
            </h3>
            <Button size="sm" onClick={() => setShowBriefDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Post Brief
            </Button>
          </div>

          {briefsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
          ) : (briefsData?.briefs || []).length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold">No open briefs yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to post a brief or check back later</p>
              <Button className="mt-4" onClick={() => setShowBriefDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> Create a Brief
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(briefsData?.briefs || []).map((brief: any) => {
                const typeInfo = PROJECT_TYPES.find(t => t.value === brief.projectType);
                const TypeIcon = typeInfo?.icon || FileText;
                return (
                  <Card key={brief.id} className="p-5 hover:border-orange-500/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                          <TypeIcon className={`w-5 h-5 ${typeInfo?.color || "text-orange-400"}`} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{brief.title}</h4>
                          <p className="text-xs text-muted-foreground">{typeInfo?.label || brief.projectType}</p>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 text-[10px]">{brief.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{brief.description}</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {(brief.genres || []).slice(0, 3).map((g: string) => (
                        <Badge key={g} variant="outline" className="text-[10px]">{g}</Badge>
                      ))}
                      {(brief.moods || []).slice(0, 2).map((m: string) => (
                        <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {(brief.budgetMin || brief.budgetMax) && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {brief.budgetMin && brief.budgetMax
                              ? `${formatCurrency(brief.budgetMin)} - ${formatCurrency(brief.budgetMax)}`
                              : formatCurrency(brief.budgetMax || brief.budgetMin)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Send className="w-3 h-3" /> {brief.totalSubmissions} submissions
                        </span>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                        setSelectedBrief(brief);
                        setShowSubmitDialog(true);
                      }}>
                        Submit Track <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ========== SUBMISSIONS ========== */}
        <TabsContent value="submissions" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" /> My Submissions
            </h3>
            <Button size="sm" onClick={() => setShowSubmitDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Submission
            </Button>
          </div>

          {(subsData?.submissions || []).length === 0 ? (
            <Card className="p-8 text-center">
              <Send className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold">No submissions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Submit tracks to open briefs or pitch directly to companies</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {(subsData?.submissions || []).map((sub: any) => (
                <Card key={sub.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Music className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{sub.trackTitle}</p>
                        <p className="text-xs text-muted-foreground">{sub.artistName} · {sub.genre || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      {sub.suggestedFee && <span className="text-sm font-bold text-green-400">{formatCurrency(sub.suggestedFee)}</span>}
                      <Badge className={STATUS_COLORS[sub.status] || ""}>{sub.status?.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  {sub.pitchNote && (
                    <p className="text-xs text-muted-foreground mt-2 pl-[52px] line-clamp-2">{sub.pitchNote}</p>
                  )}
                  {sub.reviewerNotes && (
                    <div className="mt-2 pl-[52px] p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-xs text-yellow-400">
                        <MessageSquare className="w-3 h-3 inline mr-1" />
                        Feedback: {sub.reviewerNotes}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== DEALS ========== */}
        <TabsContent value="deals" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-green-400" /> My Deals
            </h3>
            {dealsData?.totalEarnings > 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-400">
                Total Earnings: {formatCurrency(dealsData.totalEarnings)}
              </Badge>
            )}
          </div>

          {(dealsData?.deals || []).length === 0 ? (
            <Card className="p-8 text-center">
              <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold">No deals yet</p>
              <p className="text-sm text-muted-foreground mt-1">When a submission gets accepted, a deal will be created here</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {(dealsData?.deals || []).map((deal: any) => (
                <Card key={deal.id} className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-bold">{deal.title}</h4>
                      <p className="text-sm text-muted-foreground">{deal.companyName} · {deal.projectName || deal.dealType?.replace(/_/g, " ")}</p>
                    </div>
                    <Badge className={STATUS_COLORS[deal.status] || ""}>{deal.status?.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">Deal Amount</p>
                      <p className="font-bold text-sm">{deal.dealAmount ? formatCurrency(deal.dealAmount) : "TBD"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">Your Earnings (85%)</p>
                      <p className="font-bold text-sm text-green-400">{deal.artistEarning ? formatCurrency(deal.artistEarning) : "TBD"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">Territory</p>
                      <p className="font-bold text-sm">{deal.territory || "Worldwide"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">Exclusivity</p>
                      <p className="font-bold text-sm">{deal.exclusivity?.replace(/_/g, " ") || "—"}</p>
                    </div>
                  </div>
                  {deal.contractTerms && (
                    <div className="mt-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <p className="text-xs text-blue-400 flex items-center gap-1">
                        <FileSignature className="w-3 h-3" /> Contract Terms
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{deal.contractTerms}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ========== CONTACTS ========== */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-pink-400" /> Industry Contacts
              <Badge variant="secondary">{contactsData?.total || 0}</Badge>
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search company or contact..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-9 w-full sm:w-[250px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="publishing">Publishing</SelectItem>
                  <SelectItem value="sync">Sync/Licensing</SelectItem>
                  <SelectItem value="tv">TV/Film</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(contactsData?.contacts || []).length === 0 ? (
            <Card className="p-8 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-semibold">No contacts found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Import contacts from the Industry tab or adjust your search
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {(contactsData?.contacts || []).map((contact: any) => (
                <Card key={contact.id} className="p-4 hover:border-pink-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500/20 to-orange-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-pink-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{contact.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {contact.jobTitle && <>{contact.jobTitle} · </>}
                          {contact.companyName || "Independent"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{contact.category?.replace(/_/g, " ")}</Badge>
                      {contact.email && (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                          setSelectedContact(contact);
                          setShowPitchDialog(true);
                        }}>
                          <Send className="w-3 h-3 mr-1" /> Pitch
                        </Button>
                      )}
                    </div>
                  </div>
                  {(contact.country || contact.companyWebsite) && (
                    <div className="flex items-center gap-3 mt-2 pl-[52px] text-xs text-muted-foreground">
                      {contact.country && <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {contact.city ? `${contact.city}, ` : ""}{contact.country}</span>}
                      {contact.companyWebsite && (
                        <a href={contact.companyWebsite.startsWith("http") ? contact.companyWebsite : `https://${contact.companyWebsite}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate max-w-[200px]">
                          {contact.companyWebsite}
                        </a>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ========== SUBMIT TRACK DIALOG ========== */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              Submit Track
              {selectedBrief && <Badge variant="secondary" className="ml-2 text-[10px]">to: {selectedBrief.title}</Badge>}
            </DialogTitle>
            <DialogDescription>
              Submit your track {selectedBrief ? "to this brief" : "for sync licensing consideration"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Track Title *</Label>
                <Input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} placeholder="My Song" />
              </div>
              <div>
                <Label className="text-xs">Artist Name *</Label>
                <Input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Your artist name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Genre</Label>
                <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Pop, Hip-Hop, Electronic..." />
              </div>
              <div>
                <Label className="text-xs">Suggested Fee ($)</Label>
                <Input value={suggestedFee} onChange={(e) => setSuggestedFee(e.target.value)} placeholder="500" type="number" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Track URL (Audio/Streaming Link)</Label>
              <Input value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="https://soundcloud.com/... or audio file URL" />
            </div>
            <div>
              <Label className="text-xs">Pitch Note</Label>
              <Textarea value={pitchNote} onChange={(e) => setPitchNote(e.target.value)} placeholder="Why this track is perfect for the project..." rows={3} />
            </div>
            <Button
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold"
              disabled={!trackTitle || !artistName || submitMutation.isPending}
              onClick={() => submitMutation.mutate({
                briefId: selectedBrief?.id,
                trackTitle, artistName, genre,
                trackUrl, pitchNote,
                suggestedFee: suggestedFee ? parseInt(suggestedFee) : undefined,
              })}
            >
              {submitMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Track
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== PITCH TO CONTACT DIALOG ========== */}
      <Dialog open={showPitchDialog} onOpenChange={setShowPitchDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-pink-400" />
              Pitch to {selectedContact?.fullName || "Contact"}
            </DialogTitle>
            <DialogDescription>
              {selectedContact?.companyName && <>{selectedContact.companyName} · </>}
              {selectedContact?.jobTitle || "Music Industry Professional"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Track Title *</Label>
                <Input value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} placeholder="My Song" />
              </div>
              <div>
                <Label className="text-xs">Artist Name *</Label>
                <Input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Your artist name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Genre</Label>
                <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Pop, Hip-Hop..." />
              </div>
              <div>
                <Label className="text-xs">Suggested Fee ($)</Label>
                <Input value={suggestedFee} onChange={(e) => setSuggestedFee(e.target.value)} placeholder="500" type="number" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Track URL</Label>
              <Input value={trackUrl} onChange={(e) => setTrackUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">Pitch Note</Label>
              <Textarea value={pitchNote} onChange={(e) => setPitchNote(e.target.value)}
                placeholder={`Hi ${selectedContact?.firstName || selectedContact?.fullName || ""},\n\nI'd love to submit my track for your consideration...`}
                rows={4} />
            </div>
            <Button
              className="w-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold"
              disabled={!trackTitle || !artistName || pitchMutation.isPending}
              onClick={() => pitchMutation.mutate({
                contactId: selectedContact?.id,
                trackTitle, artistName, genre,
                trackUrl, pitchNote,
                suggestedFee: suggestedFee ? parseInt(suggestedFee) : undefined,
              })}
            >
              {pitchMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Pitch
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== CREATE BRIEF DIALOG ========== */}
      <Dialog open={showBriefDialog} onOpenChange={setShowBriefDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Post a Music Brief
            </DialogTitle>
            <DialogDescription>
              Describe what kind of music you're looking for — artists can submit tracks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Brief Title *</Label>
              <Input value={briefTitle} onChange={(e) => setBriefTitle(e.target.value)} placeholder="e.g. Upbeat track for Netflix drama Season 3" />
            </div>
            <div>
              <Label className="text-xs">Project Type *</Label>
              <Select value={briefType} onValueChange={setBriefType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Description *</Label>
              <Textarea value={briefDesc} onChange={(e) => setBriefDesc(e.target.value)}
                placeholder="Describe the mood, tempo, instrumentation, and how the music will be used..."
                rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Budget Min ($)</Label>
                <Input value={briefBudgetMin} onChange={(e) => setBriefBudgetMin(e.target.value)} placeholder="200" type="number" />
              </div>
              <div>
                <Label className="text-xs">Budget Max ($)</Label>
                <Input value={briefBudgetMax} onChange={(e) => setBriefBudgetMax(e.target.value)} placeholder="2000" type="number" />
              </div>
            </div>
            <Button
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold"
              disabled={!briefTitle || !briefDesc || createBriefMutation.isPending}
              onClick={() => createBriefMutation.mutate({
                title: briefTitle,
                description: briefDesc,
                projectType: briefType,
                budgetMin: briefBudgetMin ? parseInt(briefBudgetMin) : undefined,
                budgetMax: briefBudgetMax ? parseInt(briefBudgetMax) : undefined,
              })}
            >
              {createBriefMutation.isPending ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Publish Brief
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
