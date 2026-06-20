/**
 * BOOSTIFY NODE FLOW — ProfileModuleNode (Rich Edition)
 * Active profile section shown as a canvas node with real data + actions.
 * Each node mirrors the profile module: shows key stats, params, quick actions.
 */

import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Eye, EyeOff, Lock, ExternalLink, ChevronDown, ChevronUp,
  // kept for inline uses inside rich panel renders
  Music, Download, Share2, Newspaper, Flame, DollarSign, Coins, MapPin,
  // icon map — modern elegant set
  Music2, Film, Mic2, Bot, Clapperboard, Images,
  Antenna, Send,
  Package, ShoppingCart, Sparkles,
  LineChart, Target, Handshake,
  Activity, Radar, Network, TrendingUp, Megaphone,
  PieChart, Brain, Map, FileText, ScrollText,
  Shield, Globe,
  Wand2, Layers, MessageCircle, Heart, Monitor,
  QrCode, CreditCard, BarChart2, Info, Headphones, Crown, Calendar, Bitcoin,
  // widget extras
  Zap, Briefcase, Link2, BookOpen, Cpu, Layout,
  Video,
} from 'lucide-react';

export interface ProfileModuleData {
  moduleId: string;
  moduleName: string;
  categoryLabel: string;
  categoryColor: string;
  isVisible: boolean;
  isOwnerOnly: boolean;
  artistId: string | number | null;
  artistSlug: string | null;
  dataSource?: 'api' | 'firestore' | 'default';
  apiOffline?: boolean;
  // Per-node note/prompt (persisted in localStorage)
  noteText?: string;
  onSaveNote?: (moduleId: string, text: string) => void;
  // Real profile data — counts
  songCount?: number;
  videoCount?: number;
  merchCount?: number;
  topSong?: string;
  latestVideo?: string;
  socialHandles?: { platform: string; handle: string }[];
  // Full arrays for rich node content
  songs?: Array<{ id: string | number; title: string; genre?: string; duration?: string }>;
  videos?: Array<{ id: string | number; title: string; platform?: string }>;
  merchandise?: Array<{ id: string | number; name: string; price?: number; currency?: string }>;
  onToggleVisibility?: (moduleId: string, visible: boolean) => void;
  [key: string]: unknown;
}

// ─── Module icon map ─────────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, React.ElementType> = {
  // MUSIC
  'songs':                Music2,
  'videos':               Film,
  'karaoke':              Mic2,
  'lyrics-video':         Clapperboard,
  'avatar-talk':          Bot,
  'promo-clips':          Clapperboard,
  'galleries':            Images,
  'downloads':            Download,
  // SOCIAL
  'social-hub':           Antenna,
  'social-posts':         Send,
  'news':                 Newspaper,
  'explicit-content':     Flame,
  // COMMERCE
  'merchandise':          Package,
  'amazon-picks':         ShoppingCart,
  'tokenization':         Coins,
  'monetize-cta':         Sparkles,
  // MONETIZE
  'earnings':             LineChart,
  'crowdfunding':         Target,
  'sponsors':             Handshake,
  'venueBooking':         MapPin,
  // GROWTH
  'analytics':            Activity,
  'aas-engine':           Zap,
  'audience-engine':      Radar,
  'influencer-module':    Network,
  'viral-products':       TrendingUp,
  'ads-campaigns':        Megaphone,
  // BUSINESS
  'business-plan':        PieChart,
  'career-suite':         Brain,
  'artist-blueprint':     Map,
  'brand-collabs':        Handshake,
  'observation-engine':   Eye,
  'deep-brief':           FileText,
  // IDENTITY
  'electronic-press-kit': BookOpen,
  'agent-gateway':        Shield,
  'hermes-agent':         ScrollText,
  'artist-domain':        Globe,
  // CREATIVE
  'renaissance-studio':   Wand2,
  'hologram':             Layers,
  'talk-to-me':           MessageCircle,
  'emotional-studio':     Heart,
  'gamma-presentations':  Monitor,
  // WIDGET
  'qr-card':              QrCode,
  'physical-cards':       CreditCard,
  'statistics':           BarChart2,
  'tokenized-music':      Coins,
  'information':          Info,
  'social-media':         Share2,
  'spotify':              Headphones,
  'premium-tools':        Crown,
  'upcoming-shows':       Calendar,
  'economic-engine':      TrendingUp,
  'crypto-community':     Bitcoin,
};

// ─── Module-specific quick stats ─────────────────────────────────────────────

function getModuleStats(data: ProfileModuleData): Array<{ label: string; value: string }> {
  const { moduleId, songCount, videoCount, merchCount, topSong, latestVideo, socialHandles } = data;

  switch (moduleId) {
    case 'songs':
      return [
        { label: 'Tracks', value: String(songCount ?? 0) },
        { label: 'Top Song', value: topSong ? topSong.slice(0, 18) + (topSong.length > 18 ? '…' : '') : '—' },
      ];
    case 'videos':
      return [
        { label: 'Videos', value: String(videoCount ?? 0) },
        { label: 'Latest', value: latestVideo ? latestVideo.slice(0, 18) + (latestVideo.length > 18 ? '…' : '') : '—' },
      ];
    case 'karaoke':
      return [
        { label: 'Source tracks', value: String(songCount ?? 0) },
        { label: 'Mode', value: 'Auto-sync' },
      ];
    case 'merchandise':
      return [
        { label: 'Products', value: String(merchCount ?? 0) },
        { label: 'Store', value: 'Printful' },
      ];
    case 'social-hub':
    case 'social-posts':
      return (socialHandles ?? []).slice(0, 2).map(h => ({ label: h.platform, value: '@' + h.handle.replace('@', '') }));
    case 'earnings':
      return [
        { label: 'Status', value: 'Active' },
        { label: 'Integration', value: 'Stripe + BTF' },
      ];
    case 'analytics':
      return [
        { label: 'Tracking', value: 'Live' },
        { label: 'Plays', value: String(songCount ?? 0) },
      ];
    case 'aas-engine':
      return [
        { label: 'AI Engine', value: 'Genesis ⚡' },
        { label: 'Mode', value: 'Auto' },
      ];
    case 'tokenization':
      return [
        { label: 'Songs', value: String(songCount ?? 0) },
        { label: 'Chain', value: 'Polygon' },
      ];
    case 'electronic-press-kit':
      return [
        { label: 'EPK', value: 'Public' },
        { label: 'Downloads', value: 'Enabled' },
      ];
    case 'crowdfunding':
      return [
        { label: 'Campaign', value: 'Active' },
        { label: 'Platform', value: 'Built-in' },
      ];
    case 'hologram':
      return [
        { label: 'Stage', value: 'HoloStage 3D' },
        { label: 'Engine', value: 'Remotion' },
      ];
    default:
      return [
        { label: 'Status', value: data.isVisible ? 'Live' : 'Hidden' },
        { label: 'Category', value: data.categoryLabel },
      ];
  }
}

// ─── Per-module rich expanded content ────────────────────────────────────────

function ActionBtn({
  href, children, color,
}: { href: string; children: React.ReactNode; color: string }) {
  return (
    <a
      href={href}
      onClick={e => e.stopPropagation()}
      className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[10px] font-bold transition-all hover:opacity-90 w-full"
      style={{ background: `${color}22`, border: `1px solid ${color}35`, color, textDecoration: 'none' }}
    >
      {children}
    </a>
  );
}

function KVRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span className="text-[9px] text-slate-400">{label}</span>
      <span className="text-[10px] font-bold truncate ml-2" style={{ color: color ?? '#fff' }}>{value}</span>
    </div>
  );
}

function ModuleExpandedContent({ d, color }: { d: ProfileModuleData; color: string }) {
  const slug = d.artistSlug ?? '';

  switch (d.moduleId) {

    /* ── MUSIC ─────────────────────────────────────────── */
    case 'songs':
      return (
        <div className="space-y-1.5">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold px-0.5">Your Tracks</p>
          <div className="space-y-0.5 max-h-28 overflow-y-auto pr-0.5">
            {(d.songs ?? []).slice(0, 6).map(s => (
              <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Music className="w-3 h-3 flex-shrink-0" style={{ color }} />
                <span className="text-[10px] text-white truncate flex-1">{s.title}</span>
                {s.genre && <span className="text-[8px] text-slate-500 flex-shrink-0">{s.genre}</span>}
              </div>
            ))}
            {!(d.songs?.length) && <p className="text-[9px] text-slate-500 px-2 italic">No tracks uploaded yet</p>}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <ActionBtn href={`/artist/${slug}#songs`} color={color}>🎵 Manage</ActionBtn>
            <ActionBtn href={`/upload`} color={color}>+ Upload</ActionBtn>
          </div>
          <ActionBtn href={`/mini-studio`} color={color}>✨ Generate with AI</ActionBtn>
        </div>
      );

    case 'videos':
      return (
        <div className="space-y-1.5">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold px-0.5">Your Videos</p>
          <div className="space-y-0.5 max-h-24 overflow-y-auto pr-0.5">
            {(d.videos ?? []).slice(0, 5).map(v => (
              <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <Video className="w-3 h-3 flex-shrink-0" style={{ color }} />
                <span className="text-[10px] text-white truncate flex-1">{v.title}</span>
                {v.platform && <span className="text-[8px] text-slate-500 flex-shrink-0">{v.platform}</span>}
              </div>
            ))}
            {!(d.videos?.length) && <p className="text-[9px] text-slate-500 px-2 italic">No videos yet</p>}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <ActionBtn href={`/artist/${slug}#videos`} color={color}>🎬 Manage</ActionBtn>
            <ActionBtn href={`/upload-video`} color={color}>+ Add Video</ActionBtn>
          </div>
        </div>
      );

    case 'karaoke':
      return (
        <div className="space-y-1.5">
          <KVRow label="Connected tracks" value={String(d.songCount ?? 0)} />
          <KVRow label="Sync mode" value="Auto" color="#4ade80" />
          <KVRow label="Voice detection" value="AI Powered" color={color} />
          <KVRow label="Lyrics engine" value="Timestamped" color={color} />
          <ActionBtn href={`/artist/${slug}#karaoke`} color={color}>🎤 Open Karaoke Studio</ActionBtn>
        </div>
      );

    case 'promo-clips':
      return (
        <div className="space-y-1.5">
          <KVRow label="Engine" value="Seedance AI" color={color} />
          <KVRow label="Source tracks" value={String(d.songCount ?? 0)} />
          <KVRow label="Clip styles" value="Lyrics · Stills · Animated" />
          <div className="grid grid-cols-2 gap-1">
            <ActionBtn href={`/artist/${slug}#promo-clips`} color={color}>🎬 View Clips</ActionBtn>
            <ActionBtn href={`/promo-studio`} color={color}>✨ Generate</ActionBtn>
          </div>
        </div>
      );

    case 'galleries':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI generation" value="Enabled" color="#4ade80" />
          <KVRow label="Storage" value="Cloud" />
          <KVRow label="Visibility" value="Public" color={color} />
          <div className="grid grid-cols-2 gap-1">
            <ActionBtn href={`/artist/${slug}#galleries`} color={color}>🖼️ View Gallery</ActionBtn>
            <ActionBtn href={`/generate-image`} color={color}>✨ AI Image</ActionBtn>
          </div>
        </div>
      );

    case 'downloads':
      return (
        <div className="space-y-1.5">
          <KVRow label="Tracks available" value={String(d.songCount ?? 0)} />
          <KVRow label="Format" value="MP3 · WAV · FLAC" />
          <KVRow label="Access control" value="Public" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#downloads`} color={color}>📥 Manage Downloads</ActionBtn>
        </div>
      );

    /* ── SOCIAL ────────────────────────────────────────── */
    case 'social-hub':
      return (
        <div className="space-y-1.5">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold px-0.5">Connected Platforms</p>
          {(d.socialHandles ?? []).length > 0 ? (
            <div className="space-y-0.5">
              {(d.socialHandles!).map(h => (
                <div key={h.platform} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Share2 className="w-3 h-3 flex-shrink-0" style={{ color }} />
                  <span className="text-[9px] text-slate-400 w-16 flex-shrink-0">{h.platform}</span>
                  <span className="text-[10px] text-white truncate">@{h.handle.replace('@', '')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[9px] text-slate-500 px-2 italic">No social accounts connected</p>
          )}
          <ActionBtn href={`/artist/${slug}#social-hub`} color={color}>📡 Go to Broadcast Studio</ActionBtn>
        </div>
      );

    case 'social-posts':
      return (
        <div className="space-y-1.5">
          <KVRow label="Scheduler" value="Active" color="#4ade80" />
          <KVRow label="AI captions" value="Enabled" color={color} />
          <KVRow label="Platforms" value="IG · X · FB" />
          <ActionBtn href={`/artist/${slug}#social-posts`} color={color}>📲 Manage Posts</ActionBtn>
        </div>
      );

    case 'news':
      return (
        <div className="space-y-1.5">
          <KVRow label="Feed type" value="RSS + Manual" />
          <KVRow label="AI curation" value="Enabled" color={color} />
          <div className="grid grid-cols-2 gap-1">
            <ActionBtn href={`/artist/${slug}#news`} color={color}>📰 View News</ActionBtn>
            <ActionBtn href={`/add-news`} color={color}>+ Add Post</ActionBtn>
          </div>
        </div>
      );

    case 'explicit-content':
      return (
        <div className="space-y-1.5">
          <KVRow label="Access tier" value="Inner Circle" color={color} />
          <KVRow label="Auth method" value="Token gated" color="#4ade80" />
          <KVRow label="Content type" value="Exclusive" />
          <ActionBtn href={`/artist/${slug}#explicit-content`} color={color}>💎 Manage Inner Circle</ActionBtn>
        </div>
      );

    /* ── COMMERCE ──────────────────────────────────────── */
    case 'merchandise':
      return (
        <div className="space-y-1.5">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold px-0.5">Products</p>
          <div className="space-y-0.5 max-h-20 overflow-y-auto pr-0.5">
            {(d.merchandise ?? []).slice(0, 4).map(m => (
              <div key={m.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] text-white truncate flex-1">{m.name}</span>
                {m.price !== undefined && <span className="text-[9px] text-slate-400 flex-shrink-0">${m.price}</span>}
              </div>
            ))}
            {!(d.merchandise?.length) && (
              <>
                <KVRow label="Print-on-Demand" value="Printful" color="#4ade80" />
                <p className="text-[9px] text-slate-500 px-2 italic">No products yet</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <ActionBtn href={`/artist/${slug}#merchandise`} color={color}>👕 View Store</ActionBtn>
            <ActionBtn href={`/merch-studio`} color={color}>+ Add Product</ActionBtn>
          </div>
        </div>
      );

    case 'tokenization':
      return (
        <div className="space-y-1.5">
          <KVRow label="Blockchain" value="Polygon" color={color} />
          <KVRow label="Token standard" value="ERC-1155" />
          <KVRow label="Songs eligible" value={String(d.songCount ?? 0)} />
          <KVRow label="Royalty split" value="Auto-split" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#tokenization`} color={color}>🪙 Tokenize Songs</ActionBtn>
        </div>
      );

    case 'amazon-picks':
      return (
        <div className="space-y-1.5">
          <KVRow label="Integration" value="Amazon Associates" color={color} />
          <KVRow label="Auto-recommendations" value="Enabled" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#amazon-picks`} color={color}>🛍️ Manage Picks</ActionBtn>
        </div>
      );

    /* ── MONETIZE ──────────────────────────────────────── */
    case 'earnings':
      return (
        <div className="space-y-1.5">
          <KVRow label="Payment" value="Stripe + BTF" color={color} />
          <KVRow label="Royalties" value="Auto-collected" color="#4ade80" />
          <KVRow label="Sources" value="Streams · Merch · NFTs" />
          <ActionBtn href={`/artist/${slug}#earnings`} color={color}>💸 View Earnings</ActionBtn>
        </div>
      );

    case 'crowdfunding':
      return (
        <div className="space-y-1.5">
          <KVRow label="Platform" value="Built-in" color={color} />
          <KVRow label="Campaign status" value="Active" color="#4ade80" />
          <KVRow label="Payment" value="Stripe" />
          <ActionBtn href={`/artist/${slug}#crowdfunding`} color={color}>🎯 Manage Campaign</ActionBtn>
        </div>
      );

    case 'sponsors':
      return (
        <div className="space-y-1.5">
          <KVRow label="Outreach AI" value="Active" color={color} />
          <KVRow label="Brands database" value="50K+ brands" />
          <ActionBtn href={`/artist/${slug}#sponsors`} color={color}>🤝 Find Sponsors</ActionBtn>
        </div>
      );

    case 'venueBooking':
      return (
        <div className="space-y-1.5">
          <KVRow label="Booking engine" value="AI Matcher" color={color} />
          <KVRow label="Calendar sync" value="Enabled" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#venueBooking`} color={color}>📍 Manage Bookings</ActionBtn>
        </div>
      );

    /* ── GROWTH ────────────────────────────────────────── */
    case 'audience-engine':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI targeting" value="Active" color="#4ade80" />
          <KVRow label="Signal model" value="MiMo Pro" color={color} />
          <KVRow label="Fan leads" value="Auto-capture" />
          <ActionBtn href={`/artist/${slug}#audience-engine`} color={color}>🎯 View Audience Data</ActionBtn>
        </div>
      );

    case 'analytics':
      return (
        <div className="space-y-1.5">
          <KVRow label="Tracking" value="Live" color="#4ade80" />
          <KVRow label="Play events" value={String(d.songCount ?? 0)} />
          <KVRow label="Dashboard" value="Real-time" color={color} />
          <ActionBtn href={`/artist/${slug}#analytics`} color={color}>📡 Open Observatory</ActionBtn>
        </div>
      );

    case 'aas-engine':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI Engine" value="Genesis ⚡" color={color} />
          <KVRow label="Mode" value="Auto-pilot" color="#4ade80" />
          <KVRow label="Tasks/day" value="Unlimited" />
          <ActionBtn href={`/artist/${slug}#aas-engine`} color={color}>⚡ Open Genesis Engine</ActionBtn>
        </div>
      );

    case 'influencer-module':
      return (
        <div className="space-y-1.5">
          <KVRow label="Network size" value="50K+ influencers" color={color} />
          <KVRow label="AI matching" value="Active" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#influencer-module`} color={color}>📢 Amplify Network</ActionBtn>
        </div>
      );

    case 'viral-products':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI drops" value="On-demand" color={color} />
          <KVRow label="Virality score" value="Computing…" />
          <ActionBtn href={`/artist/${slug}#viral-products`} color={color}>🔥 Ecosystem Drops</ActionBtn>
        </div>
      );

    /* ── BUSINESS ──────────────────────────────────────── */
    case 'business-plan':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI model" value="OpenRouter" color={color} />
          <KVRow label="Plan status" value="AI Generated" color="#4ade80" />
          <KVRow label="Sync" value="Auto-updated" />
          <ActionBtn href={`/artist/${slug}#business-plan`} color={color}>💎 View Business Plan</ActionBtn>
        </div>
      );

    case 'artist-blueprint':
      return (
        <div className="space-y-1.5">
          <KVRow label="Status" value="AI Generated" color="#4ade80" />
          <KVRow label="Milestones" value="12 Active" color={color} />
          <KVRow label="Timeline" value="12 months" />
          <ActionBtn href={`/artist/${slug}#artist-blueprint`} color={color}>🏆 View Superstar Blueprint</ActionBtn>
        </div>
      );

    case 'career-suite':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI atelier" value="Active" color="#4ade80" />
          <KVRow label="Coaching model" value="GPT-4o" color={color} />
          <ActionBtn href={`/artist/${slug}#career-suite`} color={color}>🧠 Open The Atelier</ActionBtn>
        </div>
      );

    case 'observation-engine':
      return (
        <div className="space-y-1.5">
          <KVRow label="Monitoring" value="24/7 Active" color="#4ade80" />
          <KVRow label="Sources" value="Social · Charts · Press" />
          <ActionBtn href={`/artist/${slug}#observation-engine`} color={color}>🔭 Open Observatory</ActionBtn>
        </div>
      );

    case 'deep-brief':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI analysis" value="Deep Research" color={color} />
          <KVRow label="Output" value="Strategic Brief" />
          <ActionBtn href={`/artist/${slug}#deep-brief`} color={color}>💡 Generate Brief</ActionBtn>
        </div>
      );

    /* ── IDENTITY ──────────────────────────────────────── */
    case 'agent-gateway':
      return (
        <div className="space-y-1.5">
          <KVRow label="Active agents" value="3 Live" color="#4ade80" />
          <KVRow label="Gateway status" value="Secured" color={color} />
          <KVRow label="Protocol" value="ARTIST_AGENT v2" />
          <ActionBtn href={`/artist/${slug}#agent-gateway`} color={color}>🛡️ Manage Agents</ActionBtn>
        </div>
      );

    case 'electronic-press-kit':
      return (
        <div className="space-y-1.5">
          <KVRow label="EPK status" value="Public" color="#4ade80" />
          <KVRow label="Downloads" value="Enabled" color={color} />
          <KVRow label="Format" value="PDF + Web" />
          <ActionBtn href={`/artist/${slug}#electronic-press-kit`} color={color}>📰 View Press Kit</ActionBtn>
        </div>
      );

    case 'hermes-agent':
      return (
        <div className="space-y-1.5">
          <KVRow label="Codex status" value="Training" color={color} />
          <KVRow label="Memory" value="Artist-specific" />
          <ActionBtn href={`/artist/${slug}#hermes-agent`} color={color}>📓 Open The Codex</ActionBtn>
        </div>
      );

    case 'artist-domain':
      return (
        <div className="space-y-1.5">
          <KVRow label="Domain" value={`${slug}.boostify.io`} color={color} />
          <KVRow label="SSL" value="Active" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#artist-domain`} color={color}>🌐 Manage Domain</ActionBtn>
        </div>
      );

    /* ── CREATIVE ──────────────────────────────────────── */
    case 'renaissance-studio':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI Studio" value="MiMo Pro" color={color} />
          <KVRow label="Credits" value="Auto-refill" color="#4ade80" />
          <KVRow label="Tools" value="Image · Video · Music" />
          <ActionBtn href={`/artist/${slug}#renaissance-studio`} color={color}>✨ Open Studio</ActionBtn>
        </div>
      );

    case 'hologram':
      return (
        <div className="space-y-1.5">
          <KVRow label="Stage engine" value="Remotion" color={color} />
          <KVRow label="3D mode" value="HoloStage" color="#4ade80" />
          <KVRow label="Avatar" value="AI Generated" />
          <ActionBtn href={`/artist/${slug}#hologram`} color={color}>🎭 Open HoloStage</ActionBtn>
        </div>
      );

    case 'emotional-studio':
      return (
        <div className="space-y-1.5">
          <KVRow label="Mood engine" value="AI Sentiment" color={color} />
          <KVRow label="Palette" value="Dynamic" color="#4ade80" />
          <ActionBtn href={`/artist/${slug}#emotional-studio`} color={color}>🎭 Open Emotional Studio</ActionBtn>
        </div>
      );

    case 'monetize-cta':
      return (
        <div className="space-y-1.5">
          <KVRow label="CTA type" value="Smart Banner" color={color} />
          <KVRow label="Conversion" value="A/B Testing" />
          <ActionBtn href={`/artist/${slug}#monetize-cta`} color={color}>✨ Manage CTA</ActionBtn>
        </div>
      );

    case 'brand-collabs':
      return (
        <div className="space-y-1.5">
          <KVRow label="AI matching" value="Active" color="#4ade80" />
          <KVRow label="Brands DB" value="10K+ brands" color={color} />
          <ActionBtn href={`/artist/${slug}#brand-collabs`} color={color}>🤝 Open The Forge</ActionBtn>
        </div>
      );

    case 'talk-to-me':
      return (
        <div className="space-y-1.5">
          <KVRow label="Powered by" value="ElevenLabs ConvAI" color={color} />
          <KVRow label="Mode" value="Live voice chat" color="#10b981" />
          <KVRow label="Personas" value="Fan · Radio · Deep Dive · Hype" />
          <ActionBtn href={`/artist/${slug}#talk-to-me`} color="#10b981">📞 Open Talk To Me</ActionBtn>
        </div>
      );

    /* ── DEFAULT ───────────────────────────────────────── */
    default:
      return (
        <div className="space-y-1.5">
          <div className="rounded-lg px-2 py-2 space-y-0.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">Module ID</p>
            <p className="text-[10px] text-slate-300 font-mono">{d.moduleId}</p>
          </div>
          <div className="rounded-lg px-2 py-2 space-y-0.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold">Visibility</p>
            <p className="text-[10px] text-slate-300">{d.isVisible ? '✅ Visible on profile' : '🚫 Hidden'}</p>
          </div>
          {d.isOwnerOnly && (
            <div className="rounded-lg px-2 py-1.5" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
              <p className="text-[9px]" style={{ color }}>🔒 Owner-only section</p>
            </div>
          )}
          <ActionBtn href={`/artist/${d.artistSlug}#${d.moduleId}`} color={color}>
            <ExternalLink className="w-3 h-3" /> Open in Profile
          </ActionBtn>
        </div>
      );
  }
}

// ─── Global neon pulse keyframe (injected once) ───────────────────────────────

const PULSE_STYLE_ID = 'boostify-node-pulse';
if (typeof document !== 'undefined' && !document.getElementById(PULSE_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = PULSE_STYLE_ID;
  s.textContent = `
    @keyframes neon-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
    @keyframes neon-ring   { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.2);opacity:0} }
    @keyframes node-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
    .boostify-handle-source:hover, .boostify-handle-target:hover { transform:scale(1.7)!important; }
    .boostify-handle-source, .boostify-handle-target { transition:transform 0.15s, box-shadow 0.15s; }
  `;
  document.head.appendChild(s);
}

// ─── Node component ───────────────────────────────────────────────────────────

export const ProfileModuleNode = memo(({ data, selected }: NodeProps) => {
  const d = data as ProfileModuleData;
  const color = d.categoryColor || '#6366f1';
  const [expanded, setExpanded] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [noteDraft, setNoteDraft] = useState(d.noteText ?? '');
  const [hovered, setHovered] = useState(false);
  const Icon = MODULE_ICONS[d.moduleId] ?? Sparkles;
  const stats = getModuleStats(d);
  const isLive = d.isVisible;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    d.onToggleVisibility?.(d.moduleId, !d.isVisible);
  };

  const handleOpenInProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (d.artistSlug) {
      window.open(`/artist/${d.artistSlug}#${d.moduleId}`, '_blank');
    }
  };

  const handleSaveNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    d.onSaveNote?.(d.moduleId, noteDraft);
    setNoteMode(false);
  };

  const nodeW = expanded || noteMode ? 270 : 220;

  const dataSourceBadge = d.dataSource === 'api'
    ? { label: 'API ✓', color: '#4ade80' }
    : d.dataSource === 'firestore'
    ? { label: 'Firestore ✓', color: '#60a5fa' }
    : null;

  // Dynamic glow intensity
  const glowBase  = isLive ? `0 0 0 1px ${color}60, 0 0 18px ${color}30, 0 4px 24px rgba(0,0,0,0.6)` : '0 2px 12px rgba(0,0,0,0.5)';
  const glowHover = isLive ? `0 0 0 1px ${color}90, 0 0 30px ${color}50, 0 8px 32px rgba(0,0,0,0.7)` : `0 0 0 1px rgba(255,255,255,0.12), 0 4px 20px rgba(0,0,0,0.6)`;
  const glowSel   = `0 0 0 2px ${color}, 0 0 40px ${color}60, 0 8px 40px rgba(0,0,0,0.8)`;

  return (
    // Outer wrapper — no overflow so React Flow handles are NOT clipped
    <div style={{ position: 'relative', width: nodeW, fontFamily: "'Inter', sans-serif" }}>
      {/* ── Neon handles — OUTSIDE overflow:hidden card so they are never clipped ── */}
      <Handle
        type="target"
        position={Position.Left}
        className="boostify-handle-target"
        isConnectable
        style={{
          background: color,
          width: 12, height: 12,
          border: `2px solid rgba(0,0,0,0.8)`,
          boxShadow: `0 0 8px ${color}, 0 0 16px ${color}60`,
          zIndex: 20,
          pointerEvents: 'all',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="boostify-handle-source"
        isConnectable
        style={{
          background: color,
          width: 12, height: 12,
          border: `2px solid rgba(0,0,0,0.8)`,
          boxShadow: `0 0 8px ${color}, 0 0 16px ${color}60`,
          zIndex: 20,
          pointerEvents: 'all',
        }}
      />
      {/* ── Visual card — overflow:hidden here only clips content, NOT the handles above ── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          background: selected
            ? `linear-gradient(145deg, ${color}12 0%, rgba(8,8,20,0.98) 40%, rgba(12,12,28,0.96) 100%)`
            : isLive
            ? `linear-gradient(145deg, ${color}0d 0%, rgba(8,8,18,0.97) 40%, rgba(10,10,22,0.95) 100%)`
            : 'rgba(8,8,14,0.80)',
          border: selected
            ? `1.5px solid ${color}`
            : isLive
            ? `1px solid ${color}55`
            : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          boxShadow: selected ? glowSel : hovered ? glowHover : glowBase,
          opacity: isLive ? 1 : 0.6,
          transition: 'opacity 0.3s, box-shadow 0.25s, border-color 0.25s, width 0.2s, background 0.25s',
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          // Subtle top color stripe
          borderTop: `2px solid ${isLive ? color : 'rgba(255,255,255,0.06)'}`,
        }}
      >

      {/* ── Header ── */}
      <div
        style={{
          background: `linear-gradient(90deg, ${color}28 0%, ${color}10 60%, transparent 100%)`,
          borderBottom: `1px solid ${color}20`,
          padding: '8px 10px 7px',
        }}
        className="flex items-center gap-2"
      >
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color}35, ${color}15)`,
            border: `1px solid ${color}50`,
            boxShadow: `0 0 10px ${color}30`,
          }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white leading-none truncate">{d.moduleName}</p>
          <p className="text-[9px] mt-0.5 font-semibold tracking-wider uppercase" style={{ color: `${color}cc` }}>
            {d.categoryLabel}
          </p>
        </div>
        {d.isOwnerOnly && (
          <Lock className="w-3 h-3 opacity-30 flex-shrink-0" style={{ color }} />
        )}
        {/* Note / edit button */}
        <button
          onClick={(e) => { e.stopPropagation(); setNoteMode(v => !v); if (!noteMode) setExpanded(false); }}
          className="w-5 h-5 rounded flex items-center justify-center transition-all hover:opacity-100 opacity-40 flex-shrink-0"
          style={{ background: noteMode ? `${color}30` : 'transparent' }}
          title="Add note / prompt"
        >
          <BookOpen className="w-2.5 h-2.5" style={{ color }} />
        </button>
      </div>

      {/* ── API-offline error note ── */}
      {d.apiOffline && (
        <div
          className="mx-2.5 mt-1.5 px-2 py-1.5 rounded-lg flex items-start gap-1.5"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <span className="text-[9px] mt-px">⚠️</span>
          <div>
            <p className="text-[9px] font-bold text-amber-400 leading-none">Backend offline</p>
            <p className="text-[8px] text-amber-600 mt-0.5 leading-tight">Showing defaults. Real data loads when API is online.</p>
          </div>
        </div>
      )}
      {d.dataSource === 'firestore' && (
        <div
          className="mx-2.5 mt-1.5 px-2 py-1 rounded flex items-center gap-1.5"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
          <p className="text-[8px] text-blue-400 font-semibold">Synced via Firestore</p>
        </div>
      )}

      {/* ── Note / Prompt editor ── */}
      {noteMode && (
        <div className="px-2.5 pt-2 pb-0">
          <p className="text-[8px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Note / AI Prompt</p>
          <textarea
            className="w-full text-[10px] text-slate-200 bg-transparent rounded-md px-2 py-1.5 resize-none focus:outline-none nodrag"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${color}40`,
              minHeight: 60,
              fontFamily: "'Inter', sans-serif",
            }}
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            placeholder="Add context, instructions or AI prompts for this module…"
          />
          <div className="flex gap-1 mt-1 mb-2">
            <button
              onClick={handleSaveNote}
              className="flex-1 py-1 rounded text-[9px] font-bold transition-all hover:opacity-90"
              style={{ background: `${color}25`, border: `1px solid ${color}40`, color }}
            >
              ✓ Save Note
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setNoteMode(false); setNoteDraft(d.noteText ?? ''); }}
              className="px-2 py-1 rounded text-[9px] text-slate-500 hover:text-slate-300 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              ✕
            </button>
          </div>
          {d.noteText && (
            <div className="px-2 py-1.5 rounded mb-2" style={{ background: `${color}0d`, border: `1px solid ${color}20` }}>
              <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-0.5">Saved note</p>
              <p className="text-[9px] text-slate-300 leading-snug">{d.noteText}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-2.5 py-1.5" style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
        <div className="flex items-center gap-2">
          {/* Animated LIVE indicator */}
          <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: isLive ? '#4ade80' : '#475569',
              animation: isLive ? 'neon-pulse 2s ease-in-out infinite' : 'none',
              boxShadow: isLive ? '0 0 6px #4ade80, 0 0 12px #4ade8060' : 'none',
            }} />
            {isLive && (
              <div style={{
                position: 'absolute', inset: -2, borderRadius: '50%',
                border: '1.5px solid #4ade8080',
                animation: 'neon-ring 2s ease-out infinite',
              }} />
            )}
          </div>
          <span className="text-[9px] font-bold tracking-wider" style={{ color: isLive ? '#4ade80' : '#64748b', textShadow: isLive ? '0 0 8px #4ade8080' : 'none' }}>
            {isLive ? 'LIVE' : 'HIDDEN'}
          </span>
          {dataSourceBadge && (
            <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: `${dataSourceBadge.color}18`, color: dataSourceBadge.color, border: `1px solid ${dataSourceBadge.color}25` }}>
              {dataSourceBadge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Navigate to module in profile */}
          <button
            onClick={handleOpenInProfile}
            className="w-5 h-5 rounded flex items-center justify-center transition-all hover:opacity-100 opacity-40"
            style={{ background: `${color}15` }}
            title="Open in profile"
          >
            <ExternalLink className="w-2.5 h-2.5" style={{ color }} />
          </button>
          {/* Toggle visibility */}
          <button
            onClick={handleToggle}
            className="w-5 h-5 rounded flex items-center justify-center transition-all"
            style={{
              background: d.isVisible ? `${color}25` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${d.isVisible ? color + '40' : 'rgba(255,255,255,0.08)'}`,
            }}
            title={d.isVisible ? 'Hide from profile' : 'Show on profile'}
          >
            {d.isVisible
              ? <Eye className="w-2.5 h-2.5" style={{ color }} />
              : <EyeOff className="w-2.5 h-2.5 text-slate-600" />
            }
          </button>
        </div>
      </div>

      {/* ── Key stats ── */}
      {stats.length > 0 && !noteMode && (
        <div className="px-2.5 py-2 grid grid-cols-2 gap-1.5">
          {stats.map((s, i) => (
            <div
              key={i}
              className="rounded-lg px-2 py-1.5"
              style={{
                background: `linear-gradient(135deg, ${color}08, rgba(255,255,255,0.02))`,
                border: `1px solid ${color}15`,
              }}
            >
              <p className="text-[8px] text-slate-500 font-medium uppercase tracking-wider leading-none">{s.label}</p>
              <p className="text-[11px] text-white font-bold mt-0.5 truncate leading-none" style={{ textShadow: `0 0 10px ${color}40` }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Expand / collapse (hidden in note mode) ── */}
      {!noteMode && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[9px] font-bold tracking-wider uppercase transition-all"
          style={{
            color: `${color}90`,
            borderTop: `1px solid ${color}15`,
            background: expanded ? `${color}0a` : 'transparent',
            textShadow: expanded ? `0 0 8px ${color}60` : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = `${color}12`)}
          onMouseLeave={e => (e.currentTarget.style.background = expanded ? `${color}0a` : 'transparent')}
        >
          {expanded ? <><ChevronUp className="w-2.5 h-2.5" /> Collapse</> : <><ChevronDown className="w-2.5 h-2.5" /> More</>}
        </button>
      )}

      {/* ── Expanded params ── */}
      {expanded && (
        <div
          className="px-2.5 pb-2.5 pt-1.5"
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            background: `linear-gradient(180deg, ${color}05 0%, transparent 100%)`,
            borderTop: `1px solid ${color}10`,
          }}
        >
          <ModuleExpandedContent d={d} color={color} />
        </div>
      )}
      </div>
    </div>
  );
});

ProfileModuleNode.displayName = 'ProfileModuleNode';
