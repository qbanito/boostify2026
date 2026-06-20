import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { AudienceProfileBuilder } from './AudienceProfileBuilder';
import { ContentPillarsEditor } from './ContentPillarsEditor';
import { HookGenerator } from './HookGenerator';
import { ContentScorePanel } from './ContentScorePanel';
import { WinningPatternsMemory } from './WinningPatternsMemory';
import { DailyContentPlanner } from './DailyContentPlanner';
import {
  Loader2, Target, Users, Zap, BarChart2, CalendarDays, Trophy,
  ChevronRight, ChevronDown, ChevronUp, Sparkles, RefreshCw, Brain, CheckCircle2,
  TrendingUp, MessageSquare, Eye, Share2, MousePointerClick,
  Instagram, Youtube, Music, Radio, Link, ExternalLink,
  HelpCircle, BookOpen, X,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

type Tab = 'overview' | 'audience' | 'pillars' | 'hooks' | 'planner' | 'memory';

interface AudienceCaptureDashboardProps {
  artistId: number;
  artistName?: string;
  genre?: string;
  biography?: string;
  location?: string;
  songs?: Array<{ id: number; title: string }>;
  colors?: { hexPrimary?: string; hexAccent?: string };
  cardStyles?: string;
  cardStyleInline?: React.CSSProperties;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType; desc: string }> = [
  { id: 'overview',  label: 'Overview',  icon: BarChart2,    desc: 'Stats & Quick Generate' },
  { id: 'audience',  label: 'Audience',  icon: Users,        desc: 'Demographics & Triggers' },
  { id: 'pillars',   label: 'Pillars',   icon: Target,       desc: '7 Content Pillars' },
  { id: 'hooks',     label: 'Hooks',     icon: Zap,          desc: 'Hook Generator' },
  { id: 'planner',   label: 'Planner',   icon: CalendarDays, desc: 'Daily Plan' },
  { id: 'memory',    label: 'Memory',    icon: Trophy,       desc: 'Winning Patterns' },
];

const GUIDE_ITEMS = [
  { icon: Target,      color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',
    title: 'What is the Audience Capture Engine?',
    description: 'An AI-powered content strategy system that identifies your ideal audience and generates hooks, scripts, captions and CTAs specifically designed to capture new fans and convert them into loyal followers.' },
  { icon: Sparkles,    color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',
    title: 'Hook → Identity → Emotion → Action',
    description: 'Every piece of content follows this 4-step formula: grab attention with a Hook, reinforce your artist Identity, trigger an Emotion, then guide the viewer to take an Action (follow, stream, share, comment).' },
  { icon: Brain,       color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',
    title: 'Auto-Setup with AI',
    description: 'Click "Auto-setup with AI" to instantly build your audience profile using your biography, genre, location and real data from connected platforms. No manual input needed — done in seconds.' },
  { icon: Users,       color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',
    title: 'Audience Tab',
    description: 'Define your target audience: age range, psychographic archetype, emotional triggers and brand promise. The more precise your profile, the more accurate every AI content generation will be.' },
  { icon: BookOpen,    color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',
    title: 'Content Pillars',
    description: 'Choose up to 7 content pillars (Music, Lifestyle, Behind-the-scenes, etc.) that define your posting themes. These guide the AI to stay on-brand across all platforms.' },
  { icon: Zap,         color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20',
    title: 'Hook Generator',
    description: 'Generates 10 viral hooks tailored to your audience profile and selected song. Each hook follows a proven formula (curiosity, transformation, result-first) and receives a score out of 100.' },
  { icon: CalendarDays,color: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/20',
    title: 'Daily Planner',
    description: 'Builds a complete content plan for today across your active platforms. Each post includes the hook, caption, hashtags, best posting time and visual direction — ready to copy and publish.' },
  { icon: Trophy,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    title: 'Winning Patterns Memory',
    description: 'The AI learns which content formats, hooks and posting times perform best for your artist. Save your winners here and the system replicates those patterns for consistently higher scores.' },
  { icon: BarChart2,   color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',
    title: 'Content Score (7 Dimensions)',
    description: 'Every generated piece is scored across: Hook Strength, Retention Potential, Identity Alignment, Share Potential, Comment Trigger, Conversion Intent and Platform Fit. Aim for 80+ overall.' },
];

export function AudienceCaptureDashboard({
  artistId,
  artistName,
  genre,
  biography,
  location,
  songs = [],
  colors,
  cardStyles,
  cardStyleInline,
  isExpanded,
  onToggleExpand,
}: AudienceCaptureDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [generateResult, setGenerateResult] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const accent = colors?.hexAccent || '#f97316';
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: [`/api/audience-capture/profile/${artistId}`],
    queryFn: () =>
      apiRequest('GET', `/api/audience-capture/profile/${artistId}`) as Promise<{
        profile: any;
        pillars: any[];
      }>,
    staleTime: 60_000,
  });

  // Platform connection status (Instagram / YouTube / Spotify / TikTok)
  const { data: platformStatus, refetch: refetchPlatforms } = useQuery({
    queryKey: [`/api/audience-capture/platform-status/${artistId}`],
    queryFn: () =>
      apiRequest('GET', `/api/audience-capture/platform-status/${artistId}`) as Promise<{
        instagram: { connected: boolean; username?: string; followers?: number; engagementRate?: number };
        youtube: { connected: boolean; channelName?: string; subscribers?: number };
        spotify: { connected: boolean; artistName?: string; monthlyListeners?: number; followers?: number };
        tiktok: { connected: boolean };
      }>,
    staleTime: 120_000,
  });

  const profile = data?.profile;
  const pillars = data?.pillars ?? [];
  const hasProfile = !!profile;
  const activePillars = pillars.filter((p) => p.isActive).length;

  // â”€â”€ Auto-Setup mutation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const autoSetupMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/audience-capture/auto-setup', {
        artistId,
        artistName,
        genre,
        biography,
        location,
        languages: ['es'],
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/audience-capture/profile/${artistId}`] });
      const sources = res?.dataSources;
      const connected = [
        sources?.instagram && 'Instagram',
        sources?.youtube && 'YouTube',
        sources?.spotify && 'Spotify',
        sources?.blueprint && 'Blueprint',
      ].filter(Boolean).join(', ');
      toast({
        title: '🎯 Audience profile created',
        description: connected
          ? `AI used real data from: ${connected}`
          : 'AI has set up your full profile. You can edit it anytime.',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Auto-setup error', description: err.message, variant: 'destructive' });
    },
  });

  // â”€â”€ Quick Generate mutation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/audience-capture/generate', {
        artistId,
        platform: 'instagram',
        goal: 'capture_new_audience',
        contentType: 'hook',
        language: 'es',
        duration: '30s',
      }),
    onSuccess: (res: any) => {
      setGenerateResult(res);
      toast({ title: '⚡ Content generated', description: `Score: ${res.score?.overall ?? '—'}/100` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={22} className="animate-spin" style={{ color: accent }} />
      </div>
    );
  }

  const completeness = Math.round(
    ((hasProfile ? 1 : 0) + Math.min(activePillars, 7) / 7 + (profile?.archetype ? 0.5 : 0) + (profile?.promise ? 0.5 : 0)) / 3 * 100
  );

  const bodyVisible = isExpanded !== false;

  return (
    <div className={cardStyles || 'space-y-0'} style={cardStyles ? cardStyleInline : undefined}>
      {/* Header */}
      <div
        className={cardStyles ? 'mb-3' : 'rounded-2xl border p-4 sm:p-5 mb-1'}
        style={cardStyles ? undefined : {
          background: `linear-gradient(135deg, ${accent}10 0%, transparent 60%)`,
          borderColor: `${accent}30`,
        }}
      >
        {/* Title row */}
        <div
          className="flex items-center justify-between mb-3"
          style={onToggleExpand ? { cursor: 'pointer' } : undefined}
          onClick={onToggleExpand || undefined}
          role={onToggleExpand ? 'button' : undefined}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
            >
              <Target size={18} style={{ color: accent }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                  Audience Capture Engine
                </h2>
                <Badge
                  className="text-[9px] font-bold px-1.5 py-0 h-4 border-0"
                  style={{ background: `${accent}25`, color: accent }}
                >
                  AI
                </Badge>
              </div>
              <p className="text-[11px] text-white/40 leading-tight mt-0.5">
                Hook → Identity → Emotion → Action
              </p>
            </div>
          </div>

          {/* Completeness ring + toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowGuide(true); }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/15 border border-white/8 hover:border-cyan-500/30 transition-all"
              title="How it works"
            >
              <HelpCircle className="w-3.5 h-3.5 text-white/30" />
            </button>
            <div className="text-right">
              <div className="text-lg font-black" style={{ color: completeness >= 70 ? accent : 'rgb(255,255,255,0.3)' }}>
                {completeness}%
              </div>
              <div className="text-[9px] text-white/30 leading-tight">Configured</div>
            </div>
            {onToggleExpand && (
              bodyVisible
                ? <ChevronUp className="h-4 w-4 text-white/40 flex-shrink-0" />
                : <ChevronDown className="h-4 w-4 text-white/40 flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${completeness}%`, background: accent }}
          />
        </div>

        {/* â”€â”€ Empty state with auto-setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {bodyVisible && !hasProfile && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${accent}20` }}
              >
                <Brain size={16} style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white mb-0.5">
                  Set up your audience profile
                </div>
                <p className="text-[11px] text-white/40 mb-3 leading-relaxed">
                  Define who your audience is so every content generation is precise. Use AI in seconds, or set it up manually.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => autoSetupMutation.mutate()}
                    disabled={autoSetupMutation.isPending}
                    className="h-8 text-xs font-semibold gap-1.5 text-white"
                    style={{ background: accent, border: 'none' }}
                  >
                    {autoSetupMutation.isPending ? (
                      <><Loader2 size={13} className="animate-spin" /> Setting up with AI...</>
                    ) : (
                      <><Sparkles size={13} /> Auto-setup with AI</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('audience')}
                    className="h-8 text-xs border-white/15 text-white/70 hover:text-white hover:border-white/30 gap-1"
                  >
                    Set up manually <ChevronRight size={13} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Has profile: quick stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {bodyVisible && hasProfile && (
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                icon: Users,
                label: 'Audience',
                value: profile.primaryAgeRange || '—',
                sub: profile.archetype ? profile.archetype.slice(0, 18) : 'No archetype',
                ok: !!profile.archetype,
                tab: 'audience' as Tab,
              },
              {
                icon: Target,
                label: 'Pillars',
                value: `${activePillars}/7`,
                sub: activePillars >= 3 ? 'Active' : 'Few active',
                ok: activePillars >= 3,
                tab: 'pillars' as Tab,
              },
              {
                icon: Brain,
                label: 'Promise',
                value: profile.tone ? profile.tone.slice(0, 10) : '—',
                sub: profile.promise ? profile.promise.slice(0, 20) : 'No promise',
                ok: !!profile.promise,
                tab: 'audience' as Tab,
              },
            ].map(({ icon: Icon, label, value, sub, ok, tab }) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveTab(tab)}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5 text-left hover:bg-white/[0.06] hover:border-white/15 transition-all group"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon size={12} style={{ color: ok ? accent : 'rgba(255,255,255,0.25)' }} />
                  <span className="text-[10px] text-white/40 font-medium">{label}</span>
                </div>
                <div
                  className="text-sm font-bold truncate mb-0.5"
                  style={{ color: ok ? 'white' : 'rgba(255,255,255,0.3)' }}
                >
                  {value}
                </div>
                <div className="text-[9px] text-white/30 truncate">{sub}</div>
                {!ok && (
                  <div className="text-[9px] mt-1 font-medium" style={{ color: accent }}>
                    Complete →
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {bodyVisible && <>
      {/* Platform Connections ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 mb-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Connected Platforms</span>
          <button
            type="button"
            onClick={() => refetchPlatforms()}
            className="text-[10px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <RefreshCw size={10} /> Refresh
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Instagram */}
          {(() => {
            const ig = platformStatus?.instagram;
            return (
              <a
                href="/instagram-boost"
                className={`rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all hover:border-pink-500/30 ${ig?.connected ? 'border-pink-500/20 bg-pink-500/5' : 'border-white/[0.06] bg-white/[0.02] opacity-60'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Instagram size={13} className={ig?.connected ? 'text-pink-400' : 'text-white/25'} />
                    <span className="text-[10px] font-medium text-white/60">Instagram</span>
                  </div>
                  {ig?.connected ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  ) : (
                    <ExternalLink size={10} className="text-white/20" />
                  )}
                </div>
                {ig?.connected ? (
                  <div>
                    <div className="text-xs font-bold text-white">{ig.followers != null ? (ig.followers >= 1000 ? `${(ig.followers / 1000).toFixed(1)}K` : ig.followers) : '—'}</div>
                    <div className="text-[9px] text-white/35">followers · {ig.engagementRate ? `${ig.engagementRate}% eng` : 'no data'}</div>
                  </div>
                ) : (
                  <div className="text-[9px] text-pink-400/70">Connect extension →</div>
                )}
              </a>
            );
          })()}

          {/* YouTube */}
          {(() => {
            const yt = platformStatus?.youtube;
            return (
              <a
                href="/youtube-views"
                className={`rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all hover:border-red-500/30 ${yt?.connected ? 'border-red-500/20 bg-red-500/5' : 'border-white/[0.06] bg-white/[0.02] opacity-60'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Youtube size={13} className={yt?.connected ? 'text-red-400' : 'text-white/25'} />
                    <span className="text-[10px] font-medium text-white/60">YouTube</span>
                  </div>
                  {yt?.connected ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  ) : (
                    <ExternalLink size={10} className="text-white/20" />
                  )}
                </div>
                {yt?.connected ? (
                  <div>
                    <div className="text-xs font-bold text-white">{yt.subscribers != null ? (yt.subscribers >= 1000 ? `${(yt.subscribers / 1000).toFixed(1)}K` : yt.subscribers) : '—'}</div>
                    <div className="text-[9px] text-white/35">subs · {yt.channelName || 'channel'}</div>
                  </div>
                ) : (
                  <div className="text-[9px] text-red-400/70">Connect extension →</div>
                )}
              </a>
            );
          })()}

          {/* Spotify */}
          {(() => {
            const sp = platformStatus?.spotify;
            return (
              <a
                href="/spotify"
                className={`rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all hover:border-green-500/30 ${sp?.connected ? 'border-green-500/20 bg-green-500/5' : 'border-white/[0.06] bg-white/[0.02] opacity-60'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Music size={13} className={sp?.connected ? 'text-green-400' : 'text-white/25'} />
                    <span className="text-[10px] font-medium text-white/60">Spotify</span>
                  </div>
                  {sp?.connected ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  ) : (
                    <ExternalLink size={10} className="text-white/20" />
                  )}
                </div>
                {sp?.connected ? (
                  <div>
                    <div className="text-xs font-bold text-white">{sp.monthlyListeners != null ? (sp.monthlyListeners >= 1000 ? `${(sp.monthlyListeners / 1000).toFixed(1)}K` : sp.monthlyListeners) : '—'}</div>
                    <div className="text-[9px] text-white/35">listeners/month</div>
                  </div>
                ) : (
                  <div className="text-[9px] text-green-400/70">Connect extension →</div>
                )}
              </a>
            );
          })()}

          {/* TikTok */}
          <a
            href="/tiktok-boost"
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 flex flex-col gap-1.5 opacity-60 hover:opacity-80 hover:border-cyan-500/30 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Radio size={13} className="text-white/25" />
                <span className="text-[10px] font-medium text-white/60">TikTok</span>
              </div>
              <ExternalLink size={10} className="text-white/20" />
            </div>
            <div className="text-[9px] text-cyan-400/70">Boost TikTok →</div>
          </a>
        </div>

        {/* Sync notice */}
        {(platformStatus?.instagram?.connected || platformStatus?.youtube?.connected || platformStatus?.spotify?.connected) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-green-400/70">
            <CheckCircle2 size={11} />
            <span>Real platform data active — Auto-setup will use this data for greater precision</span>
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 overflow-x-auto pb-1 mb-3 hide-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon as React.FC<{ size: number }>;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={
                active
                  ? { background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }
                  : { color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }
              }
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* â”€â”€ Tab content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div>

        {/* â”€â”€ Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Quick generate card */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={14} style={{ color: accent }} />
                  <span className="text-sm font-semibold text-white">Quick Content Generate</span>
                </div>
                {hasProfile && (
                  <Badge className="text-[9px] px-1.5 py-0 h-4 border-0" style={{ background: `${accent}20`, color: accent }}>
                    Ready
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-white/40 mb-3">
                Generate hook, script, caption, CTA and hashtags with auto-score.
              </p>

              {!hasProfile ? (
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <Sparkles size={14} className="text-white/30 flex-shrink-0" />
                  <span className="text-[11px] text-white/40">
                    First set up your audience profile to generate precise content.
                  </span>
                  <Button
                    size="sm"
                    onClick={() => autoSetupMutation.mutate()}
                    disabled={autoSetupMutation.isPending}
                    className="ml-auto h-7 text-[10px] px-2.5 text-white flex-shrink-0"
                    style={{ background: accent, border: 'none' }}
                  >
                    {autoSetupMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : 'Auto-setup'}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="w-full font-semibold h-9 text-sm text-white"
                  style={{ background: accent, border: 'none' }}
                >
                  {generateMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin mr-2" /> Generating…</>
                  ) : (
                    <><Zap size={14} className="mr-2" /> Generate Content</>
                  )}
                </Button>
              )}

              {/* Result */}
              {generateResult && (
                <div className="mt-4 space-y-2.5">
                  {[
                    { label: '⚡ Hook', value: generateResult.hook, icon: Zap },
                    { label: '📝 Script', value: generateResult.script, icon: null },
                    { label: '📱 Caption', value: generateResult.caption, icon: null },
                    { label: '🎯 CTA', value: generateResult.cta, icon: MousePointerClick },
                    { label: '🎨 Visual Prompt', value: generateResult.visualPrompt, icon: null },
                  ].map(({ label, value }) =>
                    value ? (
                      <div
                        key={label}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3"
                      >
                        <div className="text-[10px] font-semibold text-white/35 mb-1">{label}</div>
                        <p className="text-xs text-white/75 leading-relaxed">{value}</p>
                      </div>
                    ) : null
                  )}

                  {generateResult.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {generateResult.hashtags.map((h: string) => (
                        <span
                          key={h}
                          className="text-[10px] px-2 py-0.5 rounded-full border"
                          style={{ color: accent, background: `${accent}10`, borderColor: `${accent}25` }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}

                  {generateResult.score && (
                    <ContentScorePanel
                      score={{
                        hookStrength: generateResult.score.hookStrength ?? 0,
                        retentionPotential: generateResult.score.retentionPotential ?? 0,
                        identityAlignment: generateResult.score.identityAlignment ?? 0,
                        sharePotential: generateResult.score.sharePotential ?? 70,
                        commentTrigger: generateResult.score.commentTrigger ?? 70,
                        conversionIntent: generateResult.score.conversionIntent ?? 0,
                        platformFit: generateResult.score.platformFit ?? 75,
                        overallScore: generateResult.score.overall ?? 0,
                      }}
                    />
                  )}

                  {generateResult.wasRegenerated && (
                    <div className="flex items-center gap-1.5 text-[10px] text-green-400/80">
                      <CheckCircle2 size={11} />
                      Auto-regenerated for higher score
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-[11px] text-white/40 hover:text-white/70 gap-1.5"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                  >
                    <RefreshCw size={11} /> Regenerate
                  </Button>
                </div>
              )}
            </div>

            {/* Metrics preview row */}
            {hasProfile && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('hooks')}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap size={13} style={{ color: accent }} />
                    <span className="text-xs font-semibold text-white">Hook Generator</span>
                  </div>
                  <p className="text-[10px] text-white/35">Generate 10 viral hooks for your next content.</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: accent }}>
                    Generate <ChevronRight size={11} />
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('planner')}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left hover:bg-white/[0.05] transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDays size={13} style={{ color: accent }} />
                    <span className="text-xs font-semibold text-white">Daily Plan</span>
                  </div>
                  <p className="text-[10px] text-white/35">Today's content plan based on your audience.</p>
                  <div className="flex items-center gap-1 mt-2 text-[10px]" style={{ color: accent }}>
                    View plan <ChevronRight size={11} />
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* â”€â”€ Audience Profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === 'audience' && (
          <div className="space-y-3">
            {hasProfile && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40">Profile configured</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] gap-1 text-white/50 hover:text-white/80"
                  onClick={() => autoSetupMutation.mutate()}
                  disabled={autoSetupMutation.isPending}
                >
                  {autoSetupMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Regenerate with AI
                </Button>
              </div>
            )}
            <AudienceProfileBuilder
              artistId={artistId}
              initialProfile={profile}
              onSaved={() => { refetch(); setActiveTab('overview'); }}
            />
          </div>
        )}

        {/* â”€â”€ Pillars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === 'pillars' && (
          <ContentPillarsEditor
            artistId={artistId}
            initialPillars={pillars}
            onSaved={() => { refetch(); }}
          />
        )}

        {/* â”€â”€ Hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === 'hooks' && (
          <HookGenerator
            artistId={artistId}
            songs={songs}
            onSaveWinner={() => {}}
          />
        )}

        {/* â”€â”€ Planner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === 'planner' && (
          <DailyContentPlanner artistId={artistId} />
        )}

        {/* â”€â”€ Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {activeTab === 'memory' && (
          <WinningPatternsMemory artistId={artistId} />
        )}
      </div>
      </>}

      {/* ── Guide Overlay Panel ── */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="relative w-full sm:max-w-md bg-[#0d0d18] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[88dvh] sm:max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 sm:pt-5 pb-4 border-b border-white/6 shrink-0">
              <button
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white">How It Works</h2>
                <p className="text-[11px] text-white/35 mt-0.5">Audience Capture Engine — Complete Guide</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                <BookOpen className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wide">Guide</span>
              </div>
            </div>

            {/* Guide items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {GUIDE_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className={`flex gap-3 p-3.5 rounded-2xl border ${item.border} bg-white/[0.02]`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold mb-1 ${item.color}`}>{item.title}</p>
                    <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}

              {/* Pro tip */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-orange-500/[0.08] border border-orange-500/20">
                <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-orange-300 mb-1">Pro Tip</p>
                  <p className="text-xs text-white/45 leading-relaxed">
                    Start with Auto-setup — it reads your genre, biography and connected platform data to build a precise profile in seconds. Then use the Hook Generator daily to create viral content that resonates with your specific fans.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

