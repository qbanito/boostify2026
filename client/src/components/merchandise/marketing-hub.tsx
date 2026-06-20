/**
 * Marketing Hub — Full marketing management panel
 * 
 * 5 Tabs:
 *   1. Campaigns — Create, manage, send email & social campaigns
 *   2. Contacts — Customer database (add, import, tag, search)
 *   3. AI Studio — Generate promo images + email/social content with FAL
 *   4. Templates — Email template builder with product integration
 *   5. Analytics — Campaign performance overview
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Mail, Users, Megaphone, BarChart3, Sparkles, Plus, Send,
  Upload, Tags, Eye, Trash2, Pause, Play, Image as ImageIcon,
  Download, Filter, Clock, CheckCircle, XCircle, AlertCircle,
  TrendingUp, DollarSign, MousePointerClick, MailOpen,
  Instagram, Twitter, Loader2, Wand2, Copy, ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface Contact {
  id: number;
  email: string;
  name: string | null;
  source: string;
  tags: string[];
  status: string;
  totalEmailsSent: number;
  totalOpens: number;
  totalClicks: number;
  totalPurchases: number;
  totalSpent: string;
  createdAt: string;
}

interface Campaign {
  id: number;
  name: string;
  description: string | null;
  type: string;
  status: string;
  subject: string | null;
  htmlContent: string | null;
  targetSegment: string;
  targetTags: string[] | null;
  socialPlatforms: string[] | null;
  socialContent: string | null;
  socialImageUrl: string | null;
  productIds: number[] | null;
  discountCode: string | null;
  discountPercent: number | null;
  totalRecipients: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
  revenue: string;
  aiGeneratedImage: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface ContactStats {
  total: number;
  totalSpent: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  tags: Record<string, number>;
}

interface AnalyticsOverview {
  campaigns: {
    total: number;
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalConversions: number;
    totalRevenue: number;
    openRate: string;
    clickRate: string;
  };
  byType: { type: string; count: number; revenue: number }[];
  contacts: { total: number; newLast30Days: number };
}

const CAMPAIGN_TYPES = [
  { value: 'email_blast', label: 'Email Blast', icon: '📧' },
  { value: 'email_promo', label: 'Promo Email', icon: '🎁' },
  { value: 'social_post', label: 'Social Post', icon: '📱' },
  { value: 'social_campaign', label: 'Social Campaign', icon: '📢' },
  { value: 'product_launch', label: 'Product Launch', icon: '🚀' },
  { value: 'flash_sale', label: 'Flash Sale', icon: '⚡' },
];

const SEGMENTS = [
  { value: 'all', label: 'All contacts' },
  { value: 'active_buyers', label: 'Active buyers' },
  { value: 'new_subscribers', label: 'New subscribers' },
  { value: 'inactive', label: 'Inactive (90+ days)' },
  { value: 'vip', label: 'VIP ($100+ spent)' },
  { value: 'custom', label: 'Custom (by tags)' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/15 text-gray-400',
  scheduled: 'bg-blue-500/15 text-blue-400',
  sending: 'bg-amber-500/15 text-amber-400',
  sent: 'bg-green-500/15 text-green-400',
  active: 'bg-green-500/15 text-green-400',
  paused: 'bg-orange-500/15 text-orange-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export function MarketingHub() {
  const [activeTab, setActiveTab] = useState("campaigns");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Marketing Hub</h3>
          <p className="text-xs text-muted-foreground">
            Email campaigns · Contact management · AI content · Social media
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="campaigns" className="text-xs gap-1">
            <Mail className="w-3.5 h-3.5" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs gap-1">
            <Users className="w-3.5 h-3.5" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="ai-studio" className="text-xs gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI Studio
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1">
            <Wand2 className="w-3.5 h-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4"><CampaignsTab /></TabsContent>
        <TabsContent value="contacts" className="mt-4"><ContactsTab /></TabsContent>
        <TabsContent value="ai-studio" className="mt-4"><AIStudioTab /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab /></TabsContent>
        <TabsContent value="analytics" className="mt-4"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1: CAMPAIGNS
// ══════════════════════════════════════════════════════════════

function CampaignsTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/merch-marketing/campaigns'],
    queryFn: async () => {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const res = await fetch(`/api/merch-marketing/campaigns${params}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await fetch(`/api/merch-marketing/campaigns/${campaignId}/send`, { method: 'POST' });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Campaign Sending', description: data.message || 'Emails being sent...' });
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/campaigns'] });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to send campaign', variant: 'destructive' }),
  });

  const pauseMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const res = await fetch(`/api/merch-marketing/campaigns/${campaignId}/pause`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/campaigns'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="paused">Paused</option>
          </select>
          <Badge variant="outline" className="text-xs px-3 py-1.5">{campaigns.length} campaigns</Badge>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="bg-orange-500 hover:bg-orange-600 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Campaign List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : campaigns.length === 0 ? (
        <Card className="p-12 text-center">
          <Mail className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No campaigns yet</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="mt-3">Create your first campaign</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <Card key={campaign.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">
                      {CAMPAIGN_TYPES.find(t => t.value === campaign.type)?.icon || '📧'}
                    </span>
                    <h4 className="font-semibold text-sm truncate">{campaign.name}</h4>
                    <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[campaign.status] || ''}`}>
                      {campaign.status}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{campaign.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Send className="w-3 h-3" /> {campaign.emailsSent} sent
                    </span>
                    <span className="flex items-center gap-1">
                      <MailOpen className="w-3 h-3" /> {campaign.emailsOpened} opened
                    </span>
                    <span className="flex items-center gap-1">
                      <MousePointerClick className="w-3 h-3" /> {campaign.emailsClicked} clicked
                    </span>
                    {parseFloat(campaign.revenue) > 0 && (
                      <span className="flex items-center gap-1 text-green-400">
                        <DollarSign className="w-3 h-3" /> ${parseFloat(campaign.revenue).toFixed(2)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {campaign.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => sendMutation.mutate(campaign.id)}
                      disabled={sendMutation.isPending}
                    >
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                  {campaign.status === 'sending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => pauseMutation.mutate(campaign.id)}
                    >
                      <Pause className="w-3 h-3 mr-1" /> Pause
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}

// ── Create Campaign Dialog ───────────────────────────────────

function CreateCampaignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('email_promo');
  const [subject, setSubject] = useState('');
  const [targetSegment, setTargetSegment] = useState('all');
  const [discountPercent, setDiscountPercent] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/merch-marketing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, description, type, subject,
          targetSegment,
          discountPercent: discountPercent ? parseInt(discountPercent) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Campaign created' });
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/campaigns'] });
      onOpenChange(false);
      setName(''); setDescription(''); setSubject(''); setDiscountPercent('');
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
          <DialogDescription>Create an email or social media campaign</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium mb-1 block">Campaign Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Flash Sale" className="h-9" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {CAMPAIGN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-2 rounded-lg border text-xs text-center transition-all ${
                    type === t.value ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-input hover:bg-muted'
                  }`}
                >
                  <span className="text-lg block mb-0.5">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional..." rows={2} />
          </div>
          {type.startsWith('email') && (
            <div>
              <label className="text-xs font-medium mb-1 block">Email Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="🔥 Don't miss our latest drop!" className="h-9" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Target Audience</label>
              <select
                value={targetSegment}
                onChange={e => setTargetSegment(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs"
              >
                {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Discount %</label>
              <Input value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} placeholder="e.g. 20" type="number" className="h-9" />
            </div>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="w-full bg-orange-500 hover:bg-orange-600"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Campaign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2: CONTACTS
// ══════════════════════════════════════════════════════════════

function ContactsTab() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newTags, setNewTags] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ contacts: Contact[]; pagination: any }>({
    queryKey: ['/api/merch-marketing/contacts', search, filterStatus, filterSource],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterSource) params.set('source', filterSource);
      const res = await fetch(`/api/merch-marketing/contacts?${params}`);
      if (!res.ok) return { contacts: [], pagination: {} };
      return res.json();
    },
  });

  const { data: stats } = useQuery<ContactStats>({
    queryKey: ['/api/merch-marketing/contacts/stats'],
    queryFn: async () => {
      const res = await fetch('/api/merch-marketing/contacts/stats');
      if (!res.ok) return { total: 0, totalSpent: 0, byStatus: {}, bySource: {}, tags: {} };
      return res.json();
    },
  });

  const contacts = data?.contacts || [];
  const pagination = data?.pagination;

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/merch-marketing/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          name: newName || null,
          tags: newTags ? newTags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Contact added' });
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/contacts/stats'] });
      setShowAdd(false);
      setNewEmail(''); setNewName(''); setNewTags('');
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/merch-marketing/contacts/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/contacts/stats'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">Total Contacts</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-400">{stats.byStatus?.active || 0}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">Sources</p>
            <p className="text-2xl font-bold text-blue-400">{Object.keys(stats.bySource || {}).length}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[11px] text-muted-foreground">Tags</p>
            <p className="text-2xl font-bold text-purple-400">{Object.keys(stats.tags || {}).length}</p>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or name..." className="pl-9 h-9" />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>
          <select
            value={filterSource}
            onChange={e => setFilterSource(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-xs"
          >
            <option value="">All Sources</option>
            <option value="manual">Manual</option>
            <option value="import">Imported</option>
            <option value="checkout">Checkout</option>
            <option value="signup">Signup</option>
          </select>
          <Button size="sm" variant="outline" className="h-9 text-xs" onClick={() => setShowImport(true)}>
            <Upload className="w-3.5 h-3.5 mr-1" /> Import
          </Button>
          <Button size="sm" className="h-9 text-xs bg-orange-500 hover:bg-orange-600" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Add Contact inline */}
      {showAdd && (
        <Card className="p-4 border-orange-500/20">
          <h4 className="text-sm font-semibold mb-3">Add Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" className="h-8 text-xs" />
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (optional)" className="h-8 text-xs" />
            <Input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="Tags (comma separated)" className="h-8 text-xs" />
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => addMutation.mutate()} disabled={!newEmail || addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Contact Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Source</th>
                  <th className="text-left p-3 text-xs font-medium text-muted-foreground">Tags</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Emails</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Opens</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-3 text-xs font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-xs font-medium">{c.email}</td>
                    <td className="p-3 text-xs text-muted-foreground">{c.name || '—'}</td>
                    <td className="p-3">
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{c.source}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 3).map(tag => (
                          <Badge key={tag} className="bg-purple-500/15 text-purple-400 border-0 text-[9px] px-1.5 py-0">{tag}</Badge>
                        ))}
                        {(c.tags?.length || 0) > 3 && <Badge variant="secondary" className="text-[9px] px-1 py-0">+{c.tags.length - 3}</Badge>}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-center text-muted-foreground">{c.totalEmailsSent}</td>
                    <td className="p-3 text-xs text-center text-muted-foreground">{c.totalOpens}</td>
                    <td className="p-3 text-center">
                      <Badge className={`text-[9px] px-1.5 py-0 ${
                        c.status === 'active' ? 'bg-green-500/15 text-green-400 border-0'
                          : c.status === 'bounced' ? 'bg-red-500/15 text-red-400 border-0'
                          : 'bg-gray-500/15 text-gray-400 border-0'
                      }`}>{c.status}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => deleteMutation.mutate(c.id)} className="p-1 rounded hover:bg-red-500/10 text-red-400/50 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-xs">No contacts found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="p-3 border-t text-xs text-muted-foreground text-center">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total contacts
            </div>
          )}
        </Card>
      )}

      {/* Import Dialog */}
      <ImportContactsDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}

// ── Import Contacts Dialog ───────────────────────────────────

function ImportContactsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      // Parse CSV or JSON
      let contacts: { email: string; name?: string; tags?: string[] }[] = [];
      
      // Try JSON first
      try {
        contacts = JSON.parse(csvText);
      } catch {
        // Parse as CSV (email,name format)
        const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
          if (parts[0]?.includes('@')) {
            contacts.push({ email: parts[0], name: parts[1] || undefined });
          }
        }
      }

      if (contacts.length === 0) {
        toast({ title: 'No valid contacts found', variant: 'destructive' });
        setImporting(false);
        return;
      }

      const res = await fetch('/api/merch-marketing/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      const data = await res.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/merch-marketing/contacts/stats'] });
    } catch {
      toast({ title: 'Import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
          <DialogDescription>Paste CSV (email,name) or JSON array of contacts</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={`email@example.com, John Doe\nanother@email.com, Jane\n\nOr JSON:\n[{"email": "...", "name": "...", "tags": ["vip"]}]`}
            rows={10}
            className="font-mono text-xs"
          />
          {result && (
            <Card className="p-3 bg-green-500/10 border-green-500/20">
              <p className="text-sm">
                ✅ Imported: <strong>{result.imported}</strong> · Skipped (duplicates): <strong>{result.skipped}</strong>
              </p>
            </Card>
          )}
          <Button onClick={handleImport} disabled={!csvText.trim() || importing} className="w-full bg-orange-500 hover:bg-orange-600">
            {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Import Contacts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3: AI STUDIO
// ══════════════════════════════════════════════════════════════

function AIStudioTab() {
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [artistName, setArtistName] = useState('');
  const [style, setStyle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [usedPrompt, setUsedPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Social content state
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [socialGoal, setSocialGoal] = useState('product_launch');
  const [socialResult, setSocialResult] = useState<{ content: string; hashtags: string[] } | null>(null);
  const [generatingSocial, setGeneratingSocial] = useState(false);

  const { toast } = useToast();

  const generateImage = async () => {
    setGenerating(true);
    setGeneratedImage('');
    try {
      const res = await fetch('/api/merch-marketing/ai/promo-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, productCategory, artistName, style, customPrompt: customPrompt || undefined }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        setUsedPrompt(data.prompt);
      } else {
        toast({ title: 'Error', description: data.error || 'No image generated', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Image generation failed', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const generateSocial = async () => {
    setGeneratingSocial(true);
    setSocialResult(null);
    try {
      const res = await fetch('/api/merch-marketing/ai/social-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: socialPlatform,
          artistName: artistName || 'Boostify Artist',
          campaignGoal: socialGoal,
          products: productName ? [{ name: productName }] : [],
        }),
      });
      const data = await res.json();
      setSocialResult(data);
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setGeneratingSocial(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Promo Image Generator */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-pink-500 to-violet-500 rounded-lg">
            <ImageIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">AI Promo Image Generator</h4>
            <p className="text-[11px] text-muted-foreground">Create product promotional images with FAL nano-banana-2</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Product Name *</label>
              <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Premium Hoodie" className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <select value={productCategory} onChange={e => setProductCategory(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs">
                  <option value="">Auto</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Hoodies">Hoodies</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Wall Art">Wall Art</option>
                  <option value="Drinkware">Drinkware</option>
                  <option value="Phone Cases">Phone Cases</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Artist</label>
                <Input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Artist name" className="h-9" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Style</label>
              <select value={style} onChange={e => setStyle(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs">
                <option value="">Default (Studio Photography)</option>
                <option value="minimalist, clean white background, product-centered">Minimalist</option>
                <option value="vibrant colors, neon lighting, urban street style">Urban/Street</option>
                <option value="luxury, dark background, dramatic lighting, premium feel">Luxury/Premium</option>
                <option value="lifestyle shot, model wearing, outdoor setting, natural light">Lifestyle</option>
                <option value="flat lay, top-down view, styled arrangement, instagram aesthetic">Flat Lay</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Custom Prompt (override)</label>
              <Textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="Leave empty for auto-generated prompt..." rows={2} className="text-xs" />
            </div>
            <Button onClick={generateImage} disabled={!productName || generating} className="w-full bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Promo Image
            </Button>
          </div>

          <div className="flex items-center justify-center">
            {generating ? (
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">Generating with nano-banana-2...</p>
              </div>
            ) : generatedImage ? (
              <div className="space-y-2 w-full">
                <img src={generatedImage} alt="Generated promo" className="w-full rounded-xl shadow-lg" />
                <p className="text-[10px] text-muted-foreground line-clamp-2">{usedPrompt}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => window.open(generatedImage, '_blank')}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Open Full
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => {
                    navigator.clipboard.writeText(generatedImage);
                    toast({ title: 'URL copied' });
                  }}>
                    <Copy className="w-3 h-3 mr-1" /> Copy URL
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-xs">Generated image will appear here</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Social Content Generator */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
            <Megaphone className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Social Media Content Generator</h4>
            <p className="text-[11px] text-muted-foreground">Generate post captions and hashtags for social campaigns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Platform</label>
                <select value={socialPlatform} onChange={e => setSocialPlatform(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs">
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Goal</label>
                <select value={socialGoal} onChange={e => setSocialGoal(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs">
                  <option value="product_launch">Product Launch</option>
                  <option value="flash_sale">Flash Sale</option>
                  <option value="engagement">Engagement</option>
                </select>
              </div>
            </div>
            <Button onClick={generateSocial} disabled={generatingSocial} className="w-full bg-gradient-to-r from-blue-500 to-cyan-500">
              {generatingSocial ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Generate Post
            </Button>
          </div>

          <div>
            {socialResult ? (
              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs whitespace-pre-wrap">{socialResult.content}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {socialResult.hashtags.map(h => (
                    <Badge key={h} className="bg-blue-500/15 text-blue-400 border-0 text-[10px]">{h}</Badge>
                  ))}
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                  const full = socialResult.content + '\n\n' + socialResult.hashtags.join(' ');
                  navigator.clipboard.writeText(full);
                  toast({ title: 'Copied to clipboard' });
                }}>
                  <Copy className="w-3 h-3 mr-1" /> Copy All
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-xs">Social content will appear here</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 4: TEMPLATES
// ══════════════════════════════════════════════════════════════

function TemplatesTab() {
  const [campaignType, setCampaignType] = useState('product_launch');
  const [artistName, setArtistName] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generateTemplate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/merch-marketing/ai/email-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignType,
          artistName: artistName || 'Boostify Artist',
          discountPercent: discountPercent ? parseInt(discountPercent) : undefined,
          products: [
            { name: 'Premium Hoodie', price: '49.99' },
            { name: 'Classic T-Shirt', price: '29.99' },
            { name: 'Snapback Hat', price: '34.99' },
          ],
        }),
      });
      const data = await res.json();
      setGeneratedHtml(data.htmlContent || '');
      setGeneratedSubject(data.subject || '');
    } catch {
      toast({ title: 'Error generating template', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg">
            <Wand2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Email Template Builder</h4>
            <p className="text-[11px] text-muted-foreground">Generate professional email templates for your campaigns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Config */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Campaign Type</label>
              <select value={campaignType} onChange={e => setCampaignType(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs">
                <option value="product_launch">Product Launch</option>
                <option value="flash_sale">Flash Sale</option>
                <option value="email_promo">Promo Email</option>
                <option value="email_blast">General Blast</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Artist Name</label>
              <Input value={artistName} onChange={e => setArtistName(e.target.value)} placeholder="Your artist name" className="h-9" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Discount %</label>
              <Input value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} placeholder="e.g. 20" type="number" className="h-9" />
            </div>
            <Button onClick={generateTemplate} disabled={generating} className="w-full bg-orange-500 hover:bg-orange-600">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Generate Template
            </Button>
            {generatedSubject && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground">Subject:</p>
                <p className="text-xs font-medium">{generatedSubject}</p>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="lg:col-span-2">
            {generatedHtml ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Email Preview</p>
                  <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => {
                    navigator.clipboard.writeText(generatedHtml);
                    toast({ title: 'HTML copied' });
                  }}>
                    <Copy className="w-3 h-3 mr-1" /> Copy HTML
                  </Button>
                </div>
                <div className="border rounded-xl overflow-hidden bg-white" style={{ maxHeight: 500 }}>
                  <iframe
                    srcDoc={generatedHtml}
                    className="w-full h-[480px] border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[300px] text-muted-foreground">
                <div className="text-center">
                  <Mail className="w-16 h-16 mx-auto mb-3 opacity-20" />
                  <p className="text-xs">Generate a template to preview it here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 5: ANALYTICS
// ══════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const { data: overview, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/merch-marketing/analytics/overview'],
    queryFn: async () => {
      const res = await fetch('/api/merch-marketing/analytics/overview');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Card key={i} className="p-6"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-16" /></Card>)}
      </div>
    );
  }

  const c = overview?.campaigns;
  const contacts = overview?.contacts;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-orange-500" />
            <p className="text-[11px] text-muted-foreground">Campaign Revenue</p>
          </div>
          <p className="text-2xl font-bold text-orange-500">${(c?.totalRevenue || 0).toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-blue-500" />
            <p className="text-[11px] text-muted-foreground">Emails Sent</p>
          </div>
          <p className="text-2xl font-bold">{c?.totalSent || 0}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MailOpen className="w-4 h-4 text-green-500" />
            <p className="text-[11px] text-muted-foreground">Open Rate</p>
          </div>
          <p className="text-2xl font-bold text-green-500">{c?.openRate || '0'}%</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MousePointerClick className="w-4 h-4 text-purple-500" />
            <p className="text-[11px] text-muted-foreground">Click Rate</p>
          </div>
          <p className="text-2xl font-bold text-purple-500">{c?.clickRate || '0'}%</p>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Total Campaigns</p>
          <p className="text-xl font-bold">{c?.total || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Conversions</p>
          <p className="text-xl font-bold text-green-400">{c?.totalConversions || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Active Contacts</p>
          <p className="text-xl font-bold">{contacts?.total || 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">New (30 days)</p>
          <p className="text-xl font-bold text-blue-400">{contacts?.newLast30Days || 0}</p>
        </Card>
      </div>

      {/* By Campaign Type */}
      {overview?.byType && overview.byType.length > 0 && (
        <Card className="p-5">
          <h4 className="font-semibold text-sm mb-4">Performance by Campaign Type</h4>
          <div className="space-y-3">
            {overview.byType.map(t => {
              const typeInfo = CAMPAIGN_TYPES.find(ct => ct.value === t.type);
              return (
                <div key={t.type} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span>{typeInfo?.icon || '📧'}</span>
                    <span className="text-sm font-medium">{typeInfo?.label || t.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">{t.count} campaigns</span>
                    <Badge className="bg-green-500/15 text-green-400 border-0">${t.revenue.toFixed(2)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!c?.total && (
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground text-sm">No campaign data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create and send your first campaign to see analytics here</p>
        </Card>
      )}
    </div>
  );
}
