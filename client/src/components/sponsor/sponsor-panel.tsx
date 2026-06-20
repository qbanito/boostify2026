/**
 * SponsorPanel — Full sponsor acquisition interface embedded in Edit Profile Dialog
 * Features: Search brands, manage contacts, create campaigns, track deals, view stats
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Plus,
  Send,
  DollarSign,
  Users,
  Target,
  BarChart3,
  Mail,
  Globe,
  Instagram,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  ExternalLink,
  Eye,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Handshake,
  Zap,
  HelpCircle,
  X,
  CreditCard,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const GUIDE_ITEMS = [
  {
    icon: Target,
    color: '#f97316',
    title: 'What is Sponsor Acquisition?',
    body: 'This module lets you find, contact, and close sponsorship deals with real brands. Search Instagram or Google for companies in your niche, build a contact list, and send personalized outreach emails — all from one place.',
  },
  {
    icon: Search,
    color: '#3b82f6',
    title: 'Search Brands',
    body: 'Use the Search tab to find brands by niche keyword (e.g. "energy drinks", "fashion"), by Instagram handle, Google query, or website URL. Found contacts are automatically saved to your database and deduplicated.',
  },
  {
    icon: Users,
    color: '#a855f7',
    title: 'Manage Contacts',
    body: 'The Contacts tab lists all saved brands. Use "Enrich All" to automatically find missing contact emails using AI. You can also add contacts manually and delete the ones that are no longer relevant.',
  },
  {
    icon: Send,
    color: '#10b981',
    title: 'Campaigns & Outreach',
    body: 'Create a campaign, choose the deal type (Sponsorship, Endorsement, Affiliate, etc.), set a budget range, then select which contacts to email. Boostify generates a personalized proposal email and sends it on your behalf.',
  },
  {
    icon: Handshake,
    color: '#f59e0b',
    title: 'Deals Pipeline',
    body: 'Every interested brand becomes a Deal. Track each deal through Proposed → Accepted → Payment Pending → Active → Completed. You can send follow-up emails, generate Stripe payment links, and mark deals as closed.',
  },
  {
    icon: CreditCard,
    color: '#06b6d4',
    title: 'Getting Paid',
    body: 'When a brand accepts a deal, generate a Stripe payment link directly from the Deals tab. Once paid, 70% of the agreed amount goes to your Boostify wallet automatically and 30% is the platform fee.',
  },
  {
    icon: MessageSquare,
    color: '#ec4899',
    title: 'Follow-ups',
    body: 'Use bulk follow-up to re-engage brands that haven\'t responded. Select one or multiple deals and hit "Send Follow-Up" — Boostify sends a polite reminder email to each brand\'s contact on your behalf.',
  },
  {
    icon: Settings,
    color: '#8b5cf6',
    title: 'Pro Tips',
    body: 'Start with 10–20 niche-relevant contacts, create one campaign, and send a batch. Follow up 3–5 days later. Use the Dashboard tab to track pipeline status and total earnings at a glance.',
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SponsorContact {
  id: number;
  brandName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactRole: string | null;
  website: string | null;
  instagramHandle: string | null;
  instagramFollowers: number | null;
  industry: string;
  status: string;
  lastContactedAt: string | null;
  emailsSent: number;
  createdAt: string;
}

interface SponsorCampaign {
  id: number;
  name: string;
  dealType: string;
  status: string;
  emailsSent: number;
  totalContacts: number;
  dealsCreated: number;
  budgetMin: string | null;
  budgetMax: string | null;
  createdAt: string;
}

interface SponsorDeal {
  deal: {
    id: number;
    title: string;
    dealType: string;
    status: string;
    proposedAmount: string | null;
    agreedAmount: string | null;
    artistEarning: string | null;
    platformFee: string | null;
    stripePaymentUrl: string | null;
    createdAt: string;
  };
  contact: SponsorContact | null;
}

interface SponsorStats {
  totalContacts: number;
  totalCampaigns: number;
  totalDeals: number;
  revenue: {
    total: string;
    artistEarnings: string;
    platformFees: string;
  };
  pipeline: Record<string, number>;
}

interface SponsorPanelProps {
  artistId: string;
  artistName: string;
}

const DEAL_TYPES = [
  { value: 'sponsorship', label: '💰 Sponsorship' },
  { value: 'collaboration', label: '🤝 Collaboration' },
  { value: 'endorsement', label: '⭐ Endorsement' },
  { value: 'product_placement', label: '🎬 Product Placement' },
  { value: 'affiliate', label: '🔗 Affiliate' },
];

const INDUSTRIES = [
  'fashion', 'technology', 'food_beverage', 'fitness', 'beauty',
  'automotive', 'entertainment', 'travel', 'finance', 'education',
  'health', 'sports', 'gaming', 'luxury', 'sustainability', 'other',
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-yellow-500/20 text-yellow-400',
  interested: 'bg-green-500/20 text-green-400',
  negotiating: 'bg-purple-500/20 text-purple-400',
  deal_closed: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  proposed: 'bg-blue-500/20 text-blue-400',
  accepted: 'bg-green-500/20 text-green-400',
  payment_pending: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  completed: 'bg-cyan-500/20 text-cyan-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiPost(path: string, body: any) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function apiGet(path: string) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function apiPatch(path: string, body: any) {
  const res = await fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

async function apiDelete(path: string) {
  const res = await fetch(path, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SponsorPanel({ artistId, artistName }: SponsorPanelProps) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<'search' | 'contacts' | 'campaigns' | 'deals' | 'stats'>('stats');
  const [showGuide, setShowGuide] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['/api/sponsors/stats'],
    queryFn: () => apiGet('/api/sponsors/stats'),
  });

  const { data: contactsData, refetch: refetchContacts } = useQuery({
    queryKey: ['/api/sponsors/contacts'],
    queryFn: () => apiGet('/api/sponsors/contacts'),
    enabled: activeSection === 'contacts' || activeSection === 'campaigns',
  });

  const { data: campaignsData, refetch: refetchCampaigns } = useQuery({
    queryKey: ['/api/sponsors/campaigns'],
    queryFn: () => apiGet('/api/sponsors/campaigns'),
    enabled: activeSection === 'campaigns',
  });

  const { data: dealsData, refetch: refetchDeals } = useQuery({
    queryKey: ['/api/sponsors/deals'],
    queryFn: () => apiGet('/api/sponsors/deals'),
    enabled: activeSection === 'deals',
  });

  const stats: SponsorStats = statsData?.stats || { totalContacts: 0, totalCampaigns: 0, totalDeals: 0, revenue: { total: '0', artistEarnings: '0', platformFees: '0' }, pipeline: {} };
  const contacts: SponsorContact[] = contactsData?.contacts || [];
  const campaigns: SponsorCampaign[] = campaignsData?.campaigns || [];
  const deals: SponsorDeal[] = dealsData?.deals || [];

  return (
    <div className="space-y-4">

      {/* ── GUIDE OVERLAY ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="sponsor-guide"
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
                    <h3 className="text-base font-bold text-white leading-tight">Sponsor Acquisition Guide</h3>
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
                  Sponsor payments processed via Stripe · 70% revenue goes directly to your wallet
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center gap-1 flex-wrap">
        {[
          { key: 'stats', icon: BarChart3, label: 'Dashboard' },
          { key: 'search', icon: Search, label: 'Search' },
          { key: 'contacts', icon: Users, label: 'Contacts' },
          { key: 'campaigns', icon: Target, label: 'Campaigns' },
          { key: 'deals', icon: Handshake, label: 'Deals' },
        ].map(({ key, icon: Icon, label }) => (
          <Button
            key={key}
            type="button"
            variant={activeSection === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection(key as any)}
            className={`text-xs ${activeSection === key ? 'bg-orange-600 hover:bg-orange-700' : 'border-gray-700'}`}
          >
            <Icon className="h-3 w-3 mr-1" />
            {label}
            {key === 'contacts' && stats.totalContacts > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{stats.totalContacts}</Badge>
            )}
            {key === 'deals' && stats.totalDeals > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{stats.totalDeals}</Badge>
            )}
          </Button>
        ))}
        {/* Guide button */}
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-colors flex-shrink-0"
          title="How it works"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Dashboard */}
      {activeSection === 'stats' && (
        <StatsDashboard stats={stats} onNavigate={setActiveSection} />
      )}

      {/* Search Panel */}
      {activeSection === 'search' && (
        <SearchPanel artistId={artistId} onFound={() => { refetchContacts(); }} />
      )}

      {/* Contacts Panel */}
      {activeSection === 'contacts' && (
        <ContactsPanel contacts={contacts} onRefresh={refetchContacts} />
      )}

      {/* Campaigns Panel */}
      {activeSection === 'campaigns' && (
        <CampaignsPanel
          artistId={artistId}
          artistName={artistName}
          campaigns={campaigns}
          contacts={contacts}
          onRefresh={refetchCampaigns}
        />
      )}

      {/* Deals Panel */}
      {activeSection === 'deals' && (
        <DealsPanel deals={deals} onRefresh={refetchDeals} />
      )}
    </div>
  );
}

// ─── Stats Dashboard ──────────────────────────────────────────────────────────

function StatsDashboard({ stats, onNavigate }: { stats: SponsorStats; onNavigate: (s: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onClick={() => onNavigate('contacts')} className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-left hover:border-blue-500/40 transition-colors">
          <Users className="h-4 w-4 text-blue-400 mb-1" />
          <p className="text-lg font-bold text-white">{stats.totalContacts}</p>
          <p className="text-[10px] text-gray-400">Contacts</p>
        </button>
        <button onClick={() => onNavigate('campaigns')} className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-left hover:border-purple-500/40 transition-colors">
          <Target className="h-4 w-4 text-purple-400 mb-1" />
          <p className="text-lg font-bold text-white">{stats.totalCampaigns}</p>
          <p className="text-[10px] text-gray-400">Campaigns</p>
        </button>
        <button onClick={() => onNavigate('deals')} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-left hover:border-green-500/40 transition-colors">
          <Handshake className="h-4 w-4 text-green-400 mb-1" />
          <p className="text-lg font-bold text-white">{stats.totalDeals}</p>
          <p className="text-[10px] text-gray-400">Deals</p>
        </button>
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <DollarSign className="h-4 w-4 text-emerald-400 mb-1" />
          <p className="text-lg font-bold text-white">${parseFloat(stats.revenue.artistEarnings).toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">Your Earnings</p>
        </div>
      </div>

      {/* Pipeline */}
      {Object.keys(stats.pipeline).length > 0 && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <h5 className="text-xs font-semibold text-gray-300 mb-2">Deal Pipeline</h5>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.pipeline).map(([status, count]) => (
              <Badge key={status} className={STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-400'}>
                {status.replace('_', ' ')} ({count})
              </Badge>
            ))}
          </div>
        </div>
      )}

      {stats.totalContacts === 0 && (
        <div className="p-4 text-center bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
          <Target className="h-8 w-8 text-orange-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-300">Start Finding Sponsors</p>
          <p className="text-xs text-gray-500 mt-1">Search Instagram or Google for brands in your niche</p>
          <Button type="button" size="sm" onClick={() => onNavigate('search')} className="mt-3 bg-orange-600 hover:bg-orange-700">
            <Search className="h-3 w-3 mr-1" />
            Search Brands
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Search Panel ─────────────────────────────────────────────────────────────

function SearchPanel({ artistId, onFound }: { artistId: string; onFound: () => void }) {
  const { toast } = useToast();
  const [source, setSource] = useState<string>('instagram');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [saveInfo, setSaveInfo] = useState<{ saved: number; duplicates: number } | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSaveInfo(null);
    try {
      const data = await apiPost('/api/sponsors/search', {
        source,
        query: searchQuery,
        niche: searchQuery,
        instagramUsername: source === 'instagram_profile' ? searchQuery : undefined,
        websiteUrl: source === 'website' ? searchQuery : undefined,
        limit: 15,
      });
      setResults(data.results || []);
      setSaveInfo({ saved: data.saved, duplicates: data.duplicates });
      onFound();
      toast({
        title: `Found ${data.results?.length || 0} brands`,
        description: `${data.saved} saved, ${data.duplicates} already in your database`,
      });
    } catch (error: any) {
      toast({ title: 'Search failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">
              <span className="flex items-center gap-1"><Instagram className="h-3 w-3" /> Instagram</span>
            </SelectItem>
            <SelectItem value="instagram_profile">
              <span className="flex items-center gap-1"><Instagram className="h-3 w-3" /> Profile</span>
            </SelectItem>
            <SelectItem value="google">
              <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Google</span>
            </SelectItem>
            <SelectItem value="website">
              <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> Website</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            source === 'instagram' ? 'e.g. fashion brands, energy drinks...' :
            source === 'instagram_profile' ? '@brandname' :
            source === 'google' ? 'music brand sponsorships...' :
            'https://brand.com'
          }
          className="flex-1 bg-gray-800 border-gray-700 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button type="button" onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} className="bg-orange-600 hover:bg-orange-700" size="sm">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {saveInfo && (
        <div className="flex gap-2 text-xs">
          <Badge className="bg-green-500/20 text-green-400">{saveInfo.saved} saved</Badge>
          <Badge className="bg-gray-500/20 text-gray-400">{saveInfo.duplicates} duplicates</Badge>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700">
              {r.profilePicUrl && <img src={r.profilePicUrl} alt="" className="w-8 h-8 rounded-full" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.brandName}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {r.instagramHandle && `@${r.instagramHandle}`}
                  {r.instagramFollowers && ` • ${(r.instagramFollowers / 1000).toFixed(1)}K followers`}
                  {r.contactEmail && ` • ${r.contactEmail}`}
                </p>
              </div>
              {r.industry && <Badge className="text-[10px]" variant="outline">{r.industry}</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Contacts Panel ───────────────────────────────────────────────────────────

function ContactsPanel({ contacts, onRefresh }: { contacts: SponsorContact[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [enrichingId, setEnrichingId] = useState<number | null>(null);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [newContact, setNewContact] = useState({ brandName: '', contactName: '', contactEmail: '', website: '', instagramHandle: '', industry: 'other' });

  const handleAdd = async () => {
    if (!newContact.brandName.trim()) return;
    try {
      await apiPost('/api/sponsors/contacts', newContact);
      setNewContact({ brandName: '', contactName: '', contactEmail: '', website: '', instagramHandle: '', industry: 'other' });
      setShowAdd(false);
      onRefresh();
      toast({ title: 'Contact added' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/sponsors/contacts/${id}`);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEnrich = async (id: number) => {
    setEnrichingId(id);
    try {
      const result = await apiPost(`/api/sponsors/contacts/${id}/enrich`, {});
      if (result.enriched) {
        toast({ title: 'Contact enriched!', description: `Found email: ${result.email}` });
      } else {
        toast({ title: 'No new data found', description: result.email ? 'Email already on file' : 'Could not find email' });
      }
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Enrichment failed', description: error.message, variant: 'destructive' });
    } finally {
      setEnrichingId(null);
    }
  };

  const handleBulkEnrich = async () => {
    setBulkEnriching(true);
    try {
      const result = await apiPost('/api/sponsors/contacts/bulk-enrich', {});
      toast({ title: `Enrichment complete`, description: `${result.enriched}/${result.total} contacts enriched` });
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Enrichment failed', description: error.message, variant: 'destructive' });
    } finally {
      setBulkEnriching(false);
    }
  };

  const contactsWithoutEmail = contacts.filter(c => !c.contactEmail).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{contacts.length} contacts{contactsWithoutEmail > 0 && ` • ${contactsWithoutEmail} missing email`}</p>
        <div className="flex gap-1">
          {contactsWithoutEmail > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleBulkEnrich} disabled={bulkEnriching} className="text-xs border-orange-700 text-orange-400 hover:bg-orange-900/30">
              {bulkEnriching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
              Enrich All
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onRefresh()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)} className="text-xs border-gray-700">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {showAdd && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Brand Name *" value={newContact.brandName} onChange={(e) => setNewContact({ ...newContact, brandName: e.target.value })} className="bg-gray-900 border-gray-600 text-xs" />
            <Input placeholder="Contact Email" value={newContact.contactEmail} onChange={(e) => setNewContact({ ...newContact, contactEmail: e.target.value })} className="bg-gray-900 border-gray-600 text-xs" />
            <Input placeholder="Contact Name" value={newContact.contactName} onChange={(e) => setNewContact({ ...newContact, contactName: e.target.value })} className="bg-gray-900 border-gray-600 text-xs" />
            <Input placeholder="@instagram" value={newContact.instagramHandle} onChange={(e) => setNewContact({ ...newContact, instagramHandle: e.target.value })} className="bg-gray-900 border-gray-600 text-xs" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAdd} className="bg-green-600 hover:bg-green-700 text-xs">Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-1 max-h-72 overflow-y-auto">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-2 p-2 bg-gray-800/30 rounded border border-gray-800 hover:border-gray-700 transition-colors group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">{c.brandName}</p>
                <Badge className={`text-[10px] ${STATUS_COLORS[c.status] || ''}`}>{c.status}</Badge>
              </div>
              <p className="text-[10px] text-gray-500 truncate">
                {c.contactEmail || 'No email'}
                {c.instagramHandle && ` • @${c.instagramHandle}`}
                {c.instagramFollowers && ` • ${(c.instagramFollowers / 1000).toFixed(1)}K`}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">{c.industry}</Badge>
            {!c.contactEmail && (
              <Button type="button" variant="ghost" size="sm" onClick={() => handleEnrich(c.id)} disabled={enrichingId === c.id} className="h-6 w-6 p-0 text-orange-400 opacity-0 group-hover:opacity-100">
                {enrichingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="h-6 w-6 p-0 text-red-400 opacity-0 group-hover:opacity-100">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="text-center text-xs text-gray-500 py-4">No contacts yet. Use Search to find brands.</p>
        )}
      </div>
    </div>
  );
}

// ─── Campaigns Panel ──────────────────────────────────────────────────────────

function CampaignsPanel({ artistId, artistName, campaigns, contacts, onRefresh }: {
  artistId: string;
  artistName: string;
  campaigns: SponsorCampaign[];
  contacts: SponsorContact[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: '', dealType: 'sponsorship', budgetMin: '', budgetMax: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);

  const handleCreate = async () => {
    if (!newCampaign.name.trim()) return;
    setIsCreating(true);
    try {
      await apiPost('/api/sponsors/campaigns', {
        artistId,
        name: newCampaign.name,
        dealType: newCampaign.dealType,
        budgetMin: newCampaign.budgetMin || undefined,
        budgetMax: newCampaign.budgetMax || undefined,
      });
      setNewCampaign({ name: '', dealType: 'sponsorship', budgetMin: '', budgetMax: '' });
      setShowCreate(false);
      onRefresh();
      toast({ title: 'Campaign created!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSend = async (campaignId: number) => {
    if (selectedContacts.length === 0) {
      toast({ title: 'Select contacts', description: 'Pick at least one contact to send to', variant: 'destructive' });
      return;
    }
    setSendingCampaignId(campaignId);
    try {
      const result = await apiPost(`/api/sponsors/campaigns/${campaignId}/send`, { contactIds: selectedContacts });
      toast({ title: `Sent ${result.sent} emails`, description: result.failed > 0 ? `${result.failed} failed` : undefined });
      setSelectedContacts([]);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    } finally {
      setSendingCampaignId(null);
    }
  };

  const emailableContacts = contacts.filter(c => c.contactEmail);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{campaigns.length} campaigns</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)} className="text-xs border-gray-700">
          <Plus className="h-3 w-3 mr-1" />
          New Campaign
        </Button>
      </div>

      {showCreate && (
        <div className="p-3 bg-gray-800/50 rounded-lg border border-orange-500/30 space-y-2">
          <Input placeholder="Campaign Name *" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} className="bg-gray-900 border-gray-600 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <Select value={newCampaign.dealType} onValueChange={(v) => setNewCampaign({ ...newCampaign, dealType: v })}>
              <SelectTrigger className="bg-gray-900 border-gray-600 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_TYPES.map(dt => <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Min $" type="number" value={newCampaign.budgetMin} onChange={(e) => setNewCampaign({ ...newCampaign, budgetMin: e.target.value })} className="bg-gray-900 border-gray-600 text-xs" />
            <Input placeholder="Max $" type="number" value={newCampaign.budgetMax} onChange={(e) => setNewCampaign({ ...newCampaign, budgetMax: e.target.value })} className="bg-gray-900 border-gray-600 text-xs" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating} className="bg-orange-600 hover:bg-orange-700 text-xs">
              {isCreating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Create
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}

      {campaigns.map((c) => (
        <div key={c.id} className="p-3 bg-gray-800/30 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-white">{c.name}</p>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline" className="text-[10px]">{c.dealType}</Badge>
                <Badge className={STATUS_COLORS[c.status] || 'bg-gray-500/20 text-gray-400'}>{c.status}</Badge>
              </div>
            </div>
            <div className="text-right text-[10px] text-gray-500">
              <p>{c.emailsSent || 0} emails sent</p>
              <p>{c.dealsCreated || 0} deals</p>
            </div>
          </div>

          {/* Contact Selector for Sending */}
          {emailableContacts.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-[10px] text-gray-400 mb-1">Select contacts to send proposal:</p>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto mb-2">
                {emailableContacts.map(contact => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedContacts(prev =>
                      prev.includes(contact.id) ? prev.filter(id => id !== contact.id) : [...prev, contact.id]
                    )}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                      selectedContacts.includes(contact.id)
                        ? 'bg-orange-500/30 border-orange-500 text-orange-300'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {contact.brandName}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSend(c.id)}
                disabled={sendingCampaignId === c.id || selectedContacts.length === 0}
                className="bg-green-600 hover:bg-green-700 text-xs w-full"
              >
                {sendingCampaignId === c.id ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sending...</>
                ) : (
                  <><Send className="h-3 w-3 mr-1" /> Send to {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          )}
        </div>
      ))}

      {campaigns.length === 0 && !showCreate && (
        <p className="text-center text-xs text-gray-500 py-4">No campaigns yet. Create one to start reaching out.</p>
      )}
    </div>
  );
}

// ─── Deals Panel ──────────────────────────────────────────────────────────────

function DealsPanel({ deals, onRefresh }: { deals: SponsorDeal[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [generatingInvoice, setGeneratingInvoice] = useState<number | null>(null);
  const [selectedDeals, setSelectedDeals] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleDealSelection = (dealId: number) => {
    setSelectedDeals(prev =>
      prev.includes(dealId) ? prev.filter(id => id !== dealId) : [...prev, dealId]
    );
  };

  const selectAllDeals = () => {
    if (selectedDeals.length === deals.length) {
      setSelectedDeals([]);
    } else {
      setSelectedDeals(deals.map(d => d.deal.id));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedDeals.length === 0) return;
    setBulkLoading(true);
    try {
      await apiPost('/api/sponsors/deals/bulk/status', { dealIds: selectedDeals, status });
      toast({ title: `${selectedDeals.length} deals updated to ${status}` });
      setSelectedDeals([]);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkFollowUp = async () => {
    if (selectedDeals.length === 0) return;
    setBulkLoading(true);
    try {
      const result = await apiPost('/api/sponsors/deals/bulk/follow-up', { dealIds: selectedDeals });
      toast({ title: `Follow-ups sent: ${result.sent}`, description: result.failed > 0 ? `${result.failed} failed` : undefined });
      setSelectedDeals([]);
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleStatusChange = async (dealId: number, status: string) => {
    try {
      await apiPatch(`/api/sponsors/deals/${dealId}`, { status });
      onRefresh();
      toast({ title: `Deal updated to ${status}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateInvoice = async (dealId: number) => {
    setGeneratingInvoice(dealId);
    try {
      const result = await apiPost(`/api/sponsors/deals/${dealId}/invoice`, {});
      if (result.paymentUrl) {
        toast({ title: 'Payment link generated!', description: 'Send this link to the sponsor.' });
      }
      onRefresh();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const handleFollowUp = async (dealId: number) => {
    try {
      await apiPost(`/api/sponsors/deals/${dealId}/follow-up`, { type: 'follow_up' });
      toast({ title: 'Follow-up sent!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'proposed': return <Clock className="h-3 w-3 text-blue-400" />;
      case 'accepted': case 'active': case 'completed': return <CheckCircle2 className="h-3 w-3 text-green-400" />;
      case 'rejected': case 'cancelled': return <XCircle className="h-3 w-3 text-red-400" />;
      default: return <Clock className="h-3 w-3 text-yellow-400" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{deals.length} deals</p>
        {deals.length > 0 && (
          <button type="button" onClick={selectAllDeals} className="text-[10px] text-orange-400 hover:text-orange-300">
            {selectedDeals.length === deals.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedDeals.length > 0 && (
        <div className="flex items-center gap-1 p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg flex-wrap">
          <span className="text-[10px] text-orange-300 mr-1">{selectedDeals.length} selected</span>
          <Button type="button" variant="ghost" size="sm" onClick={handleBulkFollowUp} disabled={bulkLoading} className="text-[10px] h-6">
            <Mail className="h-3 w-3 mr-1" /> Follow Up All
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => handleBulkStatus('negotiating')} disabled={bulkLoading} className="text-[10px] h-6">
            Negotiating
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => handleBulkStatus('accepted')} disabled={bulkLoading} className="text-[10px] h-6 text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => handleBulkStatus('rejected')} disabled={bulkLoading} className="text-[10px] h-6 text-red-400 ml-auto">
            Reject
          </Button>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {deals.map(({ deal, contact }) => (
          <div key={deal.id} className={`p-3 bg-gray-800/30 rounded-lg border transition-colors ${selectedDeals.includes(deal.id) ? 'border-orange-500/50' : 'border-gray-800'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedDeals.includes(deal.id)}
                  onChange={() => toggleDealSelection(deal.id)}
                  className="mt-1 accent-orange-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {statusIcon(deal.status)}
                    <p className="text-sm font-medium text-white truncate">{deal.title}</p>
                  </div>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{deal.dealType}</Badge>
                    <Badge className={`text-[10px] ${STATUS_COLORS[deal.status] || ''}`}>{deal.status.replace('_', ' ')}</Badge>
                  </div>
                  {contact && <p className="text-[10px] text-gray-500 mt-1">{contact.brandName} {contact.contactEmail && `• ${contact.contactEmail}`}</p>}
                </div>
              </div>
              <div className="text-right">
                {deal.agreedAmount && (
                  <p className="text-sm font-bold text-emerald-400">${parseFloat(deal.agreedAmount).toLocaleString()}</p>
                )}
                {deal.proposedAmount && !deal.agreedAmount && (
                  <p className="text-xs text-gray-400">${parseFloat(deal.proposedAmount).toLocaleString()} proposed</p>
                )}
                {deal.artistEarning && (
                  <p className="text-[10px] text-green-500">You earn ${parseFloat(deal.artistEarning).toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 mt-2 pt-2 border-t border-gray-800">
              {deal.status === 'proposed' && (
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleFollowUp(deal.id)} className="text-[10px] h-6">
                    <Mail className="h-3 w-3 mr-1" /> Follow Up
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleStatusChange(deal.id, 'negotiating')} className="text-[10px] h-6">
                    Negotiating
                  </Button>
                </>
              )}
              {(deal.status === 'negotiating' || deal.status === 'accepted') && (
                <>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleStatusChange(deal.id, 'accepted')} className="text-[10px] h-6 text-green-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => handleGenerateInvoice(deal.id)}
                    disabled={generatingInvoice === deal.id}
                    className="text-[10px] h-6 text-emerald-400"
                  >
                    {generatingInvoice === deal.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <DollarSign className="h-3 w-3 mr-1" />}
                    Invoice
                  </Button>
                </>
              )}
              {deal.stripePaymentUrl && (
                <a href={deal.stripePaymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 px-2 h-6">
                  <ExternalLink className="h-3 w-3" /> Payment Link
                </a>
              )}
              {['proposed', 'negotiating'].includes(deal.status) && (
                <Button type="button" variant="ghost" size="sm" onClick={() => handleStatusChange(deal.id, 'rejected')} className="text-[10px] h-6 text-red-400 ml-auto">
                  Reject
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {deals.length === 0 && (
        <p className="text-center text-xs text-gray-500 py-4">No deals yet. Create a campaign and send proposals to start.</p>
      )}
    </div>
  );
}
