/**
 * CRYPTO COMMUNITY DASHBOARD — Right Column Widget
 * Glassmorphism design matching Economic Engine style
 * Shows channel status, feed, proposals, stats + admin controls
 * Connected to BoostiSwap tokens
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe, Send, MessageCircle, Hash, Twitter, ChevronDown, ChevronRight,
  Zap, Users, Vote, BarChart3, Bot, Power, Radio, ExternalLink,
  Loader2, Settings, Plus, RefreshCw, TrendingUp, Coins,
  CheckCircle2, XCircle, AlertTriangle, Eye, ArrowUpRight,
  Search, Target, Megaphone, Database, Sparkles, Play, Pause, Instagram,
  Rocket, Flag, Wallet, DollarSign, Activity, ChevronUp
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface DashboardProps {
  artistId: number | string;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
  };
  isAdmin?: boolean;
}

interface ChannelStatus {
  telegram: boolean;
  discord: boolean;
  twitter: boolean;
}

interface CommunityStats {
  totalPosts: number;
  totalMembers: number;
  activeProposals: number;
  channelsActive: ChannelStatus;
  tokenStats: { symbol: string; price: string; totalSupply: number } | null;
}

interface Post {
  id: number;
  postType: string;
  content: string;
  deliveryStatus: Record<string, boolean>;
  tokenSymbol?: string;
  generatedByAi: boolean;
  createdAt: string;
}

interface Proposal {
  id: number;
  title: string;
  description: string;
  options: { id: number; label: string; votes: number }[];
  status: string;
  totalVotes: number;
  endsAt?: string;
}

interface RealCryptoCommunity {
  id: string;
  name: string;
  symbol: string;
  rank: number | null;
  image: string;
  members: number | null;
  activityScore: number | null;
  communities: Array<{ platform: string; url: string }>;
}

// ── Glow Mesh Background ──
function GlowMesh({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-xl">
      <motion.div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-[60px]"
        style={{ background: `${color}0a` }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ── Channel Icon ──
function ChannelIcon({ channel, active, color }: { channel: string; active: boolean; color: string }) {
  const icons: Record<string, typeof Send> = {
    telegram: Send,
    discord: Hash,
    twitter: Twitter,
  };
  const Icon = icons[channel] || Globe;
  const labels: Record<string, string> = { telegram: 'TG', discord: 'DC', twitter: 'X' };
  return (
    <div
      className="flex flex-col items-center gap-1"
      title={`${channel}: ${active ? 'Connected' : 'Not connected'}`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
        style={{
          background: active ? `${color}25` : '#27272a',
          border: `1px solid ${active ? color : '#3f3f46'}`,
        }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: active ? color : '#71717a' }} />
      </div>
      <span className="text-[10px]" style={{ color: active ? color : '#71717a' }}>
        {labels[channel] || channel}
      </span>
    </div>
  );
}

// ── Post Type Badge ──
function PostTypeBadge({ type, color }: { type: string; color: string }) {
  const map: Record<string, { icon: typeof Send; label: string }> = {
    news: { icon: Radio, label: 'News' },
    price_alert: { icon: TrendingUp, label: 'Price' },
    proposal: { icon: Vote, label: 'Vote' },
    token_update: { icon: Coins, label: 'Token' },
    milestone: { icon: Zap, label: 'Milestone' },
    custom: { icon: MessageCircle, label: 'Post' },
  };
  const item = map[type] || map.custom;
  const Icon = item.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: `${color}20`, color }}
    >
      <Icon className="h-2.5 w-2.5" />
      {item.label}
    </span>
  );
}

// ── Main Dashboard ──
export function CryptoCommunityDashboard({ artistId, colors, isAdmin }: DashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [showPostForm, setShowPostForm] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState('news');
  const [useAi, setUseAi] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showOutreach, setShowOutreach] = useState(false);
  const [scrapeKeywords, setScrapeKeywords] = useState('');
  const [scrapePlatforms, setScrapePlatforms] = useState<string[]>(['instagram']);
  const [outreachPlatform, setOutreachPlatform] = useState<string>('instagram');
  const [outreachCampaignType, setOutreachCampaignType] = useState('community_growth');
  const [generatedPost, setGeneratedPost] = useState<string | null>(null);
  const [showHub, setShowHub] = useState(true);

  // ── Queries ──
  const { data: statsData } = useQuery<{ success: boolean } & CommunityStats>({
    queryKey: [`/api/crypto-community/${artistId}/stats`],
    retry: 1,
    refetchInterval: 30000,
  });

  const { data: postsData } = useQuery<{ success: boolean; posts: Post[] }>({
    queryKey: [`/api/crypto-community/${artistId}/posts`, { limit: 5 }],
    retry: 1,
  });

  const { data: proposalsData } = useQuery<{ success: boolean; proposals: Proposal[] }>({
    queryKey: [`/api/crypto-community/${artistId}/proposals`],
    retry: 1,
  });

  const { data: configData } = useQuery<{ success: boolean; configured: boolean; channels: ChannelStatus; linkedToken: any }>({
    queryKey: [`/api/crypto-community/${artistId}/config`],
    retry: 1,
  });

  const { data: realCommunitiesData, isLoading: realCommunitiesLoading } = useQuery<{
    success: boolean;
    source: 'coingecko' | 'fallback';
    communities: RealCryptoCommunity[];
    updatedAt: string;
  }>({
    queryKey: [`/api/crypto-community/${artistId}/real-communities`, { limit: 6 }],
    retry: 1,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 15,
  });

  // ── Artist Hub overview: tokens + business plan + community KPIs ──
  const { data: overviewData } = useQuery<{
    success: boolean;
    artistName: string;
    tokens: Array<{
      id: number; tokenSymbol: string; tokenName?: string; contractAddress?: string;
      totalSupply: number; availableSupply: number; pricePerTokenUsd?: string;
      royaltyPercentageArtist?: number; isActive: boolean; imageUrl?: string;
      holders: number; soldAmount: number; soldPercentage: number;
    }>;
    tokenSummary: { totalTokens: number; totalHolders: number; totalSupply: number; totalSold: number };
    businessPlan: null | {
      businessName?: string; missionStatement?: string;
      revenueStreams?: Record<string, number>;
      monthlyRevenueEstimate: number;
      financialGoals?: { monthlyTarget?: number; yearlyTarget?: number; investmentAsk?: number };
      goalProgress: number;
      milestonesTotal: number; milestonesCompleted: number;
      activeMilestones: Array<{ id?: string; title: string; date?: string; category?: string; status: string; description?: string; priority?: string }>;
    };
    suggestedAnnouncements: Array<{ id?: string; title: string; description?: string }>;
    community: { totalMembers: number };
  }>({
    queryKey: [`/api/crypto-community/${artistId}/overview`],
    retry: 1,
    refetchInterval: 60000,
  });

  // ── Outreach Queries ──
  const { data: outreachStatsData } = useQuery<{
    success: boolean;
    contacts: { totalContacts: number; byPlatform: Record<string, number>; byStatus: Record<string, number>; byAudienceType: Record<string, number> };
    campaigns: { total: number; active: number; totalSent: number; totalReplied: number };
  }>({
    queryKey: [`/api/crypto-community/${artistId}/outreach/stats`],
    retry: 1,
    enabled: showOutreach,
  });

  const { data: campaignsData } = useQuery<{ success: boolean; campaigns: any[] }>({
    queryKey: [`/api/crypto-community/${artistId}/outreach/campaigns`],
    retry: 1,
    enabled: showOutreach,
  });

  // ── Outreach Mutations ──
  const scrapeMutation = useMutation({
    mutationFn: async (params: { platforms: string[]; keywords: string[] }) => {
      const res = await fetch(`/api/crypto-community/${artistId}/outreach/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, maxPerPlatform: 100 }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const total = (data.results || []).reduce((s: number, r: any) => s + r.saved, 0);
      toast({ title: '✅ Scraping complete', description: `${total} new contacts extracted` });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/outreach/stats`] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Scraping failed', variant: 'destructive' });
    },
  });

  const generatePostMutation = useMutation({
    mutationFn: async (params: { campaignType: string; platform: string }) => {
      const res = await fetch(`/api/crypto-community/${artistId}/outreach/generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedPost(data.post?.message || 'Failed to generate');
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (params: { name: string; campaignType: string; platform: string }) => {
      const res = await fetch(`/api/crypto-community/${artistId}/outreach/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ Campaign created', description: 'AI template generated' });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/outreach/campaigns`] });
    },
  });

  // ── Mutations ──
  const postMutation = useMutation({
    mutationFn: async (params: { postType: string; content: string; generatedByAi: boolean }) => {
      const res = await fetch(`/api/crypto-community/${artistId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          channels: { telegram: true, discord: true, twitter: true },
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ Post sent', description: 'Broadcast to all channels' });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/stats`] });
      setPostContent('');
      setShowPostForm(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to send post', variant: 'destructive' });
    },
  });

  // ── Hub: announce milestone / convert to proposal ──
  const announceMilestoneMutation = useMutation({
    mutationFn: async (m: { milestoneId?: string; milestoneTitle: string; milestoneDescription?: string }) => {
      const res = await fetch(`/api/crypto-community/${artistId}/announce-milestone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '📢 Milestone announced', description: 'Broadcast to all channels' });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/posts`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/stats`] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Announcement failed', variant: 'destructive' });
    },
  });

  const milestoneToProposalMutation = useMutation({
    mutationFn: async (m: { milestoneId?: string; milestoneTitle: string; milestoneDescription?: string }) => {
      const res = await fetch(`/api/crypto-community/${artistId}/milestone-to-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '🗳️ Proposal created', description: 'Community can now vote' });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/proposals`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/stats`] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Proposal creation failed', variant: 'destructive' });
    },
  });

  const announceTokenMutation = useMutation({
    mutationFn: async (t: { tokenSymbol: string; tokenName?: string; soldPercentage: number; pricePerTokenUsd?: string }) => {
      const lines = [
        `💎 $${t.tokenSymbol}${t.tokenName ? ` — ${t.tokenName}` : ''}`,
        t.pricePerTokenUsd ? `Price: $${parseFloat(t.pricePerTokenUsd).toFixed(4)}` : '',
        `Sold: ${t.soldPercentage}% — join the holders before it runs out.`,
        `Trade on BoostiSwap.`,
      ].filter(Boolean).join('\n');
      const res = await fetch(`/api/crypto-community/${artistId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postType: 'token_update',
          content: lines,
          channels: { telegram: true, discord: true, twitter: true },
          tokenSymbol: t.tokenSymbol,
          tokenPrice: t.pricePerTokenUsd ? parseFloat(t.pricePerTokenUsd) : undefined,
          generatedByAi: true,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '🚀 Token broadcast sent', description: 'Holders & community notified' });
      queryClient.invalidateQueries({ queryKey: [`/api/crypto-community/${artistId}/posts`] });
    },
  });

  const stats = statsData?.success ? statsData : null;
  const posts = postsData?.posts || [];
  const proposals = (proposalsData?.proposals || []).filter(p => p.status === 'active');
  const channels = configData?.channels || { telegram: false, discord: false, twitter: false };
  const linkedToken = configData?.linkedToken;
  const activeChannels = Object.values(channels).filter(Boolean).length;
  const realCommunities = realCommunitiesData?.communities || [];

  const compactNumber = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const handlePost = useCallback(() => {
    if (!postContent.trim()) return;
    postMutation.mutate({ postType, content: postContent, generatedByAi: useAi });
  }, [postContent, postType, useAi]);

  return (
    <motion.div
      className="relative overflow-hidden rounded-xl"
      style={{
        background: 'linear-gradient(135deg, rgba(15,15,20,0.95), rgba(20,20,30,0.9))',
        border: `1px solid ${colors.hexBorder}40`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <GlowMesh color={colors.hexAccent} />

      {/* Header */}
      <div
        className="relative flex items-center justify-between p-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${colors.hexAccent}20` }}
          >
            <Globe className="h-4 w-4" style={{ color: colors.hexAccent }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Crypto Community
              {activeChannels > 0 && (
                <span
                  className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}
                >
                  <Radio className="h-2.5 w-2.5" />
                  {activeChannels} Live
                </span>
              )}
            </h3>
            <p className="text-[10px] text-zinc-500">
              {linkedToken ? `$${linkedToken.symbol} · BoostiSwap` : 'Community Agent'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
              className="p-1 rounded hover:bg-white/5 transition"
            >
              <Settings className="h-3.5 w-3.5 text-zinc-500" />
            </button>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">

              {/* Channel Status Row */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <ChannelIcon channel="telegram" active={channels.telegram} color={colors.hexAccent} />
                  <ChannelIcon channel="discord" active={channels.discord} color={colors.hexAccent} />
                  <ChannelIcon channel="twitter" active={channels.twitter} color={colors.hexAccent} />
                </div>
                {linkedToken && (
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{ background: `${colors.hexPrimary}15`, border: `1px solid ${colors.hexPrimary}30` }}
                  >
                    <Coins className="h-3 w-3" style={{ color: colors.hexPrimary }} />
                    <span className="font-mono font-bold" style={{ color: colors.hexPrimary }}>
                      ${linkedToken.symbol}
                    </span>
                    {linkedToken.price && (
                      <span className="text-zinc-400 text-[10px]">
                        ${parseFloat(linkedToken.price).toFixed(4)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Stats Row */}
              {stats && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Posts', value: stats.totalPosts, icon: Send },
                    { label: 'Members', value: stats.totalMembers, icon: Users },
                    { label: 'Proposals', value: stats.activeProposals, icon: Vote },
                  ].map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="text-center p-2 rounded-lg"
                      style={{ background: '#0f0f14' }}
                    >
                      <Icon className="h-3 w-3 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                      <div className="text-sm font-bold text-white">{value}</div>
                      <div className="text-[9px] text-zinc-500">{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Real Crypto Communities */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Users className="h-3 w-3" style={{ color: colors.hexAccent }} />
                    Real Crypto Communities
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${colors.hexAccent}15`,
                      color: colors.hexAccent,
                    }}
                  >
                    {realCommunitiesData?.source === 'coingecko' ? 'Live' : 'Verified'}
                  </span>
                </div>

                {realCommunitiesLoading && (
                  <div
                    className="p-2 rounded-lg flex items-center gap-2 text-[11px]"
                    style={{ background: '#0f0f14', border: `1px solid ${colors.hexBorder}20` }}
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: colors.hexAccent }} />
                    <span className="text-zinc-400">Loading live communities...</span>
                  </div>
                )}

                {!realCommunitiesLoading && realCommunities.length > 0 && (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {realCommunities.map((community) => (
                      <div
                        key={community.id}
                        className="p-2 rounded-lg"
                        style={{ background: '#0f0f14', border: `1px solid ${colors.hexBorder}20` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {community.image ? (
                              <img
                                src={community.image}
                                alt={community.name}
                                className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="text-[11px] text-white font-semibold truncate">
                                {community.name}
                                <span className="text-zinc-500 ml-1">${community.symbol}</span>
                              </div>
                              <div className="text-[9px] text-zinc-500 flex items-center gap-1.5">
                                {community.rank ? <span>Rank #{community.rank}</span> : <span>Crypto project</span>}
                                <span>•</span>
                                <span>{compactNumber(community.members)} members</span>
                              </div>
                            </div>
                          </div>
                          {typeof community.activityScore === 'number' && (
                            <span
                              className="text-[9px] px-1 py-0.5 rounded"
                              style={{ background: `${colors.hexPrimary}15`, color: colors.hexPrimary }}
                            >
                              activity {community.activityScore}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {community.communities.slice(0, 4).map((link) => (
                            <a
                              key={`${community.id}-${link.url}`}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all hover:brightness-110"
                              style={{
                                background: `${colors.hexAccent}12`,
                                color: colors.hexAccent,
                                border: `1px solid ${colors.hexAccent}25`,
                              }}
                            >
                              {link.platform}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!realCommunitiesLoading && realCommunities.length === 0 && (
                  <div
                    className="p-2 rounded-lg text-[11px] text-zinc-500"
                    style={{ background: '#0f0f14', border: '1px dashed #27272a' }}
                  >
                    No community sources available right now.
                  </div>
                )}
              </div>

              {/* ═══════ ARTIST HUB: Tokens + Business Plan + Roadmap ═══════ */}
              {overviewData?.success && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowHub(!showHub)}
                    className="w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: showHub ? `${colors.hexPrimary}15` : '#0f0f14',
                      border: `1px solid ${showHub ? colors.hexPrimary + '30' : '#27272a'}`,
                      color: showHub ? colors.hexPrimary : '#a1a1aa',
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Rocket className="h-3.5 w-3.5" />
                      Artist Crypto Hub
                    </span>
                    <span className="flex items-center gap-1.5">
                      {overviewData.tokenSummary.totalTokens > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${colors.hexPrimary}20`, color: colors.hexPrimary }}>
                          {overviewData.tokenSummary.totalTokens} tokens
                        </span>
                      )}
                      {overviewData.businessPlan && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${colors.hexAccent}15`, color: colors.hexAccent }}>
                          {overviewData.businessPlan.activeMilestones.length} goals
                        </span>
                      )}
                      {showHub ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showHub && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden space-y-2.5"
                      >
                        {/* Mission tagline */}
                        {overviewData.businessPlan?.missionStatement && (
                          <div
                            className="p-2 rounded-lg text-[11px] italic text-zinc-300 leading-relaxed"
                            style={{ background: `${colors.hexPrimary}08`, border: `1px solid ${colors.hexPrimary}15` }}
                          >
                            "{overviewData.businessPlan.missionStatement}"
                          </div>
                        )}

                        {/* Financial goal progress */}
                        {overviewData.businessPlan?.financialGoals?.monthlyTarget ? (
                          <div
                            className="p-2.5 rounded-lg space-y-1.5"
                            style={{ background: '#0f0f14', border: `1px solid ${colors.hexAccent}20` }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                <DollarSign className="h-3 w-3" style={{ color: colors.hexAccent }} />
                                Monthly Goal
                              </span>
                              <span className="text-[10px] font-mono" style={{ color: colors.hexAccent }}>
                                ${overviewData.businessPlan.monthlyRevenueEstimate.toLocaleString()} / ${overviewData.businessPlan.financialGoals.monthlyTarget.toLocaleString()}
                              </span>
                            </div>
                            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#1a1a24' }}>
                              <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all"
                                style={{
                                  width: `${overviewData.businessPlan.goalProgress}%`,
                                  background: `linear-gradient(90deg, ${colors.hexAccent}, ${colors.hexPrimary})`,
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-zinc-500">
                              <span>{overviewData.businessPlan.goalProgress}% to target</span>
                              <span>{overviewData.businessPlan.milestonesCompleted}/{overviewData.businessPlan.milestonesTotal} milestones</span>
                            </div>
                          </div>
                        ) : null}

                        {/* Tokens grid */}
                        {overviewData.tokens.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                                <Coins className="h-3 w-3" style={{ color: colors.hexPrimary }} />
                                Artist Tokens · {overviewData.tokenSummary.totalHolders} holders
                              </span>
                              <a
                                href="/boostiswap"
                                className="text-[9px] flex items-center gap-0.5"
                                style={{ color: colors.hexPrimary }}
                              >
                                View all <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </div>
                            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                              {overviewData.tokens.slice(0, 4).map(t => (
                                <div
                                  key={t.id}
                                  className="p-2 rounded-lg"
                                  style={{ background: '#0f0f14', border: `1px solid ${colors.hexBorder}20` }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <Wallet className="h-3 w-3 flex-shrink-0" style={{ color: colors.hexPrimary }} />
                                      <span className="text-[11px] font-mono font-bold text-white truncate">${t.tokenSymbol}</span>
                                      {t.tokenName && (
                                        <span className="text-[9px] text-zinc-500 truncate">{t.tokenName}</span>
                                      )}
                                      {!t.isActive && (
                                        <span className="text-[8px] px-1 rounded" style={{ background: '#71717a20', color: '#a1a1aa' }}>paused</span>
                                      )}
                                    </div>
                                    {t.pricePerTokenUsd && (
                                      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: colors.hexAccent }}>
                                        ${parseFloat(t.pricePerTokenUsd).toFixed(4)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <div className="relative h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: '#1a1a24' }}>
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-full"
                                        style={{
                                          width: `${t.soldPercentage}%`,
                                          background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-mono text-zinc-500 flex-shrink-0">{t.soldPercentage}%</span>
                                    <span className="text-[9px] text-zinc-500 flex items-center gap-0.5 flex-shrink-0">
                                      <Users className="h-2.5 w-2.5" />{t.holders}
                                    </span>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex gap-1 mt-1.5">
                                      <button
                                        onClick={() => announceTokenMutation.mutate({
                                          tokenSymbol: t.tokenSymbol,
                                          tokenName: t.tokenName,
                                          soldPercentage: t.soldPercentage,
                                          pricePerTokenUsd: t.pricePerTokenUsd,
                                        })}
                                        disabled={announceTokenMutation.isPending}
                                        className="flex-1 py-1 rounded text-[9px] font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                                        style={{
                                          background: `${colors.hexPrimary}20`,
                                          color: colors.hexPrimary,
                                          border: `1px solid ${colors.hexPrimary}30`,
                                        }}
                                      >
                                        <Megaphone className="h-2.5 w-2.5" />
                                        Announce drop
                                      </button>
                                      <a
                                        href={`/boostiswap?token=${t.tokenSymbol}`}
                                        className="px-2 py-1 rounded text-[9px] font-medium flex items-center gap-1"
                                        style={{
                                          background: `${colors.hexAccent}15`,
                                          color: colors.hexAccent,
                                        }}
                                      >
                                        <Activity className="h-2.5 w-2.5" />
                                        Trade
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {overviewData.tokens.length === 0 && (
                          <div
                            className="p-2.5 rounded-lg text-center text-[11px] text-zinc-400"
                            style={{ background: '#0f0f14', border: '1px dashed #27272a' }}
                          >
                            <Coins className="h-4 w-4 mx-auto mb-1 text-zinc-600" />
                            No tokens yet.{' '}
                            <a href="/boostiswap" className="underline" style={{ color: colors.hexPrimary }}>
                              Tokenize a song
                            </a>
                          </div>
                        )}

                        {/* Roadmap milestones from business plan */}
                        {overviewData.businessPlan && overviewData.businessPlan.activeMilestones.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                              <Flag className="h-3 w-3" style={{ color: colors.hexAccent }} />
                              Roadmap → Community
                            </span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {overviewData.businessPlan.activeMilestones.map((m, idx) => (
                                <div
                                  key={m.id || idx}
                                  className="p-2 rounded-lg"
                                  style={{ background: '#0f0f14', border: `1px solid ${colors.hexBorder}20` }}
                                >
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                          style={{
                                            background: m.status === 'in_progress' ? colors.hexAccent : '#a1a1aa',
                                          }}
                                        />
                                        <span className="text-[11px] text-white font-medium truncate">{m.title}</span>
                                      </div>
                                      {m.description && (
                                        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{m.description}</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1 text-[9px] text-zinc-500">
                                        {m.category && <span>{m.category}</span>}
                                        {m.date && <span>· {new Date(m.date).toLocaleDateString()}</span>}
                                        {m.priority && (
                                          <span
                                            className="px-1 rounded"
                                            style={{
                                              background: m.priority === 'critical' ? '#ef444420' : m.priority === 'high' ? '#f59e0b20' : '#27272a',
                                              color: m.priority === 'critical' ? '#ef4444' : m.priority === 'high' ? '#f59e0b' : '#a1a1aa',
                                            }}
                                          >
                                            {m.priority}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => announceMilestoneMutation.mutate({
                                          milestoneId: m.id,
                                          milestoneTitle: m.title,
                                          milestoneDescription: m.description,
                                        })}
                                        disabled={announceMilestoneMutation.isPending}
                                        className="flex-1 py-1 rounded text-[9px] font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                                        style={{
                                          background: `${colors.hexAccent}15`,
                                          color: colors.hexAccent,
                                          border: `1px solid ${colors.hexAccent}25`,
                                        }}
                                      >
                                        <Megaphone className="h-2.5 w-2.5" />
                                        Announce
                                      </button>
                                      <button
                                        onClick={() => milestoneToProposalMutation.mutate({
                                          milestoneId: m.id,
                                          milestoneTitle: m.title,
                                          milestoneDescription: m.description,
                                        })}
                                        disabled={milestoneToProposalMutation.isPending}
                                        className="flex-1 py-1 rounded text-[9px] font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                                        style={{
                                          background: `${colors.hexPrimary}15`,
                                          color: colors.hexPrimary,
                                          border: `1px solid ${colors.hexPrimary}25`,
                                        }}
                                      >
                                        <Vote className="h-2.5 w-2.5" />
                                        To proposal
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {!overviewData.businessPlan && isAdmin && (
                          <div
                            className="p-2.5 rounded-lg text-center text-[11px] text-zinc-400"
                            style={{ background: '#0f0f14', border: '1px dashed #27272a' }}
                          >
                            <Flag className="h-4 w-4 mx-auto mb-1 text-zinc-600" />
                            No business plan yet.{' '}
                            <a href="/business-plan" className="underline" style={{ color: colors.hexAccent }}>
                              Create one
                            </a>{' '}
                            to sync milestones with your community.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Active Proposal */}
              {proposals.length > 0 && (
                <div
                  className="p-2.5 rounded-lg"
                  style={{ background: `${colors.hexAccent}08`, border: `1px solid ${colors.hexAccent}20` }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Vote className="h-3 w-3" style={{ color: colors.hexAccent }} />
                    <span className="text-xs font-semibold text-white">Active Vote</span>
                    <span
                      className="text-[9px] px-1 py-0.5 rounded ml-auto"
                      style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}
                    >
                      {proposals[0].totalVotes} votes
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mb-2 line-clamp-2">{proposals[0].title}</p>
                  <div className="space-y-1">
                    {proposals[0].options.slice(0, 3).map((opt) => {
                      const pct = proposals[0].totalVotes > 0
                        ? ((opt.votes / proposals[0].totalVotes) * 100).toFixed(0)
                        : '0';
                      return (
                        <div key={opt.id} className="relative h-6 rounded overflow-hidden" style={{ background: '#1a1a24' }}>
                          <div
                            className="absolute inset-y-0 left-0 rounded"
                            style={{
                              width: `${pct}%`,
                              background: `${colors.hexAccent}30`,
                            }}
                          />
                          <div className="relative flex items-center justify-between px-2 h-full">
                            <span className="text-[10px] text-zinc-300">{opt.label}</span>
                            <span className="text-[10px] font-mono" style={{ color: colors.hexAccent }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Feed */}
              {posts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Recent Activity</span>
                  </div>
                  {posts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className="p-2 rounded-lg flex items-start gap-2"
                      style={{ background: '#0f0f14' }}
                    >
                      <PostTypeBadge type={post.postType} color={colors.hexAccent} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-zinc-300 line-clamp-2">{post.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {post.deliveryStatus && Object.entries(post.deliveryStatus).map(([ch, ok]) => (
                            <span key={ch} className="text-[9px] flex items-center gap-0.5">
                              {ok ? (
                                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                              ) : (
                                <XCircle className="h-2.5 w-2.5 text-red-400" />
                              )}
                              <span className="text-zinc-500">{ch}</span>
                            </span>
                          ))}
                          {post.generatedByAi && (
                            <span className="text-[9px] text-purple-400 flex items-center gap-0.5">
                              <Bot className="h-2.5 w-2.5" /> AI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Admin: Quick Post */}
              {isAdmin && (
                <div className="space-y-2">
                  {!showPostForm ? (
                    <button
                      onClick={() => setShowPostForm(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all hover:brightness-110"
                      style={{
                        background: `linear-gradient(135deg, ${colors.hexPrimary}30, ${colors.hexAccent}30)`,
                        border: `1px solid ${colors.hexAccent}30`,
                        color: colors.hexAccent,
                      }}
                    >
                      <Send className="h-3 w-3" />
                      Post to Community
                    </button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <div className="flex gap-1.5">
                        {['news', 'price_alert', 'token_update', 'milestone', 'custom'].map(t => (
                          <button
                            key={t}
                            onClick={() => setPostType(t)}
                            className="px-2 py-1 rounded text-[10px] transition-all"
                            style={{
                              background: postType === t ? `${colors.hexAccent}25` : '#1a1a24',
                              color: postType === t ? colors.hexAccent : '#71717a',
                              border: `1px solid ${postType === t ? colors.hexAccent + '50' : '#27272a'}`,
                            }}
                          >
                            {t.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                        placeholder="Write your community update..."
                        className="w-full h-20 px-2.5 py-2 rounded-lg text-xs text-white resize-none focus:outline-none"
                        style={{
                          background: '#0f0f14',
                          border: `1px solid ${colors.hexBorder}30`,
                        }}
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useAi}
                            onChange={(e) => setUseAi(e.target.checked)}
                            className="rounded border-zinc-600 bg-zinc-800"
                          />
                          <Bot className="h-3 w-3 text-purple-400" />
                          <span className="text-[10px] text-zinc-400">AI enhance</span>
                        </label>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setShowPostForm(false)}
                            className="px-2.5 py-1.5 rounded text-[10px] text-zinc-400 hover:bg-zinc-800 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handlePost}
                            disabled={postMutation.isPending || !postContent.trim()}
                            className="px-3 py-1.5 rounded text-[10px] font-medium text-white transition-all disabled:opacity-40"
                            style={{
                              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                            }}
                          >
                            {postMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Broadcast'
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ═══════ OUTREACH SECTION ═══════ */}
              {isAdmin && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowOutreach(!showOutreach)}
                    className="w-full flex items-center justify-between py-2 px-2.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: showOutreach ? `${colors.hexAccent}15` : '#0f0f14',
                      border: `1px solid ${showOutreach ? colors.hexAccent + '30' : '#27272a'}`,
                      color: showOutreach ? colors.hexAccent : '#a1a1aa',
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      Outreach & Audience
                    </span>
                    {outreachStatsData?.contacts && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}>
                        {outreachStatsData.contacts.totalContacts} contacts
                      </span>
                    )}
                    {showOutreach ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>

                  <AnimatePresence>
                    {showOutreach && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden space-y-2.5"
                      >
                        {/* Outreach Stats Grid */}
                        {outreachStatsData?.success && (
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              { label: 'Contacts', value: outreachStatsData.contacts.totalContacts, icon: Database },
                              { label: 'Campaigns', value: outreachStatsData.campaigns.total, icon: Megaphone },
                              { label: 'Sent', value: outreachStatsData.campaigns.totalSent, icon: Send },
                              { label: 'Replied', value: outreachStatsData.campaigns.totalReplied, icon: MessageCircle },
                            ].map(({ label, value, icon: Icon }) => (
                              <div key={label} className="text-center p-1.5 rounded-lg" style={{ background: '#0f0f14' }}>
                                <Icon className="h-3 w-3 mx-auto mb-0.5" style={{ color: colors.hexAccent }} />
                                <div className="text-xs font-bold text-white">{value}</div>
                                <div className="text-[8px] text-zinc-500">{label}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Platform breakdown */}
                        {outreachStatsData?.contacts?.byPlatform && Object.keys(outreachStatsData.contacts.byPlatform).length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {Object.entries(outreachStatsData.contacts.byPlatform).map(([plat, count]) => (
                              <span
                                key={plat}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                                style={{ background: '#1a1a24', color: '#a1a1aa' }}
                              >
                                {plat === 'instagram' && <Instagram className="h-2.5 w-2.5" />}
                                {plat === 'twitter' && <Twitter className="h-2.5 w-2.5" />}
                                {plat === 'tiktok' && <Play className="h-2.5 w-2.5" />}
                                {plat}: {count}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Scrape Controls */}
                        <div
                          className="p-2.5 rounded-lg space-y-2"
                          style={{ background: '#0f0f14', border: '1px solid #27272a' }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Search className="h-3 w-3" style={{ color: colors.hexAccent }} />
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Extract Audience</span>
                          </div>

                          <input
                            value={scrapeKeywords}
                            onChange={(e) => setScrapeKeywords(e.target.value)}
                            placeholder="Keywords: crypto music, nft artist, web3..."
                            className="w-full px-2 py-1.5 rounded text-[11px] text-white bg-black/30 focus:outline-none"
                            style={{ border: `1px solid ${colors.hexBorder}20` }}
                          />

                          <div className="flex gap-1">
                            {['instagram', 'twitter', 'tiktok'].map(p => (
                              <button
                                key={p}
                                onClick={() => {
                                  setScrapePlatforms(prev =>
                                    prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                  );
                                }}
                                className="px-2 py-1 rounded text-[10px] transition-all"
                                style={{
                                  background: scrapePlatforms.includes(p) ? `${colors.hexAccent}25` : '#1a1a24',
                                  color: scrapePlatforms.includes(p) ? colors.hexAccent : '#71717a',
                                  border: `1px solid ${scrapePlatforms.includes(p) ? colors.hexAccent + '50' : '#27272a'}`,
                                }}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={() => {
                              const keywords = scrapeKeywords.split(',').map(k => k.trim()).filter(Boolean);
                              if (keywords.length === 0) keywords.push('crypto music', 'nft artist');
                              scrapeMutation.mutate({ platforms: scrapePlatforms, keywords });
                            }}
                            disabled={scrapeMutation.isPending}
                            className="w-full py-1.5 rounded text-[10px] font-medium text-white transition-all disabled:opacity-40"
                            style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                          >
                            {scrapeMutation.isPending ? (
                              <span className="flex items-center justify-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Scraping...
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1">
                                <Database className="h-3 w-3" /> Extract Contacts
                              </span>
                            )}
                          </button>
                        </div>

                        {/* AI Post Generator */}
                        <div
                          className="p-2.5 rounded-lg space-y-2"
                          style={{ background: '#0f0f14', border: '1px solid #27272a' }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="h-3 w-3" style={{ color: colors.hexAccent }} />
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">AI Outreach Post</span>
                          </div>

                          <div className="flex gap-1 flex-wrap">
                            {['community_growth', 'token_launch', 'collaboration', 'event_promo', 'general'].map(t => (
                              <button
                                key={t}
                                onClick={() => setOutreachCampaignType(t)}
                                className="px-1.5 py-0.5 rounded text-[9px] transition-all"
                                style={{
                                  background: outreachCampaignType === t ? `${colors.hexAccent}25` : '#1a1a24',
                                  color: outreachCampaignType === t ? colors.hexAccent : '#71717a',
                                  border: `1px solid ${outreachCampaignType === t ? colors.hexAccent + '40' : 'transparent'}`,
                                }}
                              >
                                {t.replace('_', ' ')}
                              </button>
                            ))}
                          </div>

                          <div className="flex gap-1">
                            {['instagram', 'twitter', 'telegram'].map(p => (
                              <button
                                key={p}
                                onClick={() => setOutreachPlatform(p)}
                                className="px-2 py-1 rounded text-[10px] transition-all"
                                style={{
                                  background: outreachPlatform === p ? `${colors.hexAccent}25` : '#1a1a24',
                                  color: outreachPlatform === p ? colors.hexAccent : '#71717a',
                                  border: `1px solid ${outreachPlatform === p ? colors.hexAccent + '50' : '#27272a'}`,
                                }}
                              >
                                {p}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={() => generatePostMutation.mutate({ campaignType: outreachCampaignType, platform: outreachPlatform })}
                            disabled={generatePostMutation.isPending}
                            className="w-full py-1.5 rounded text-[10px] font-medium transition-all disabled:opacity-40"
                            style={{
                              background: `${colors.hexAccent}20`,
                              color: colors.hexAccent,
                              border: `1px solid ${colors.hexAccent}30`,
                            }}
                          >
                            {generatePostMutation.isPending ? (
                              <span className="flex items-center justify-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Generating...
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-1">
                                <Sparkles className="h-3 w-3" /> Generate Post
                              </span>
                            )}
                          </button>

                          {generatedPost && (
                            <div
                              className="p-2 rounded-lg text-[11px] text-zinc-300 leading-relaxed"
                              style={{ background: `${colors.hexAccent}08`, border: `1px solid ${colors.hexAccent}15` }}
                            >
                              {generatedPost}
                              <div className="flex gap-1.5 mt-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(generatedPost);
                                    toast({ title: 'Copied!', description: 'Post copied to clipboard' });
                                  }}
                                  className="px-2 py-0.5 rounded text-[9px]"
                                  style={{ background: `${colors.hexAccent}20`, color: colors.hexAccent }}
                                >
                                  Copy
                                </button>
                                <button
                                  onClick={() => {
                                    createCampaignMutation.mutate({
                                      name: `${outreachCampaignType} — ${new Date().toLocaleDateString()}`,
                                      campaignType: outreachCampaignType,
                                      platform: outreachPlatform,
                                    });
                                  }}
                                  className="px-2 py-0.5 rounded text-[9px]"
                                  style={{ background: `${colors.hexPrimary}20`, color: colors.hexPrimary }}
                                >
                                  Create Campaign
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Active Campaigns */}
                        {campaignsData?.campaigns && campaignsData.campaigns.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Campaigns</span>
                            {campaignsData.campaigns.slice(0, 3).map((c: any) => (
                              <div
                                key={c.id}
                                className="p-2 rounded-lg flex items-center justify-between"
                                style={{ background: '#0f0f14' }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] text-white font-medium truncate">{c.name}</div>
                                  <div className="text-[9px] text-zinc-500">
                                    {c.totalSent || 0} sent · {c.totalReplied || 0} replied
                                  </div>
                                </div>
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{
                                    background: c.status === 'active' ? '#10b98120' : c.status === 'draft' ? '#f59e0b20' : '#71717a20',
                                    color: c.status === 'active' ? '#10b981' : c.status === 'draft' ? '#f59e0b' : '#71717a',
                                  }}
                                >
                                  {c.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* BoostiSwap Link */}
              {linkedToken && (
                <a
                  href="/boostiswap"
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] transition-all hover:brightness-110"
                  style={{
                    background: `${colors.hexPrimary}10`,
                    border: `1px solid ${colors.hexPrimary}20`,
                    color: colors.hexPrimary,
                  }}
                >
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  Trade ${linkedToken.symbol} on BoostiSwap
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
