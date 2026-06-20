/**
 * BOOSTIFY NODE FLOW — PremiumPageNode
 *
 * One component that renders 7 "page-launcher" nodes.
 * Each node is a direct gateway to a Boostify feature page,
 * enriched with live stats fetched from the artist's data.
 *
 * pageType:
 *   youtubeBoost | instagramBoost | tiktokBoost |
 *   artistImage  | merch          | contacts    | aiArtistMint
 */

import { useState, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ExternalLink,
  RefreshCw,
  ChevronDown,
  Zap,
  TrendingUp,
} from 'lucide-react';
import type { NodeFlowData } from '../useFlowStore';
import { useFlowStore } from '../useFlowStore';

// ─── Page config table ────────────────────────────────────────────────────────

export type PremiumPageType =
  | 'youtubeBoost'
  | 'instagramBoost'
  | 'tiktokBoost'
  | 'artistImage'
  | 'merch'
  | 'contacts'
  | 'aiArtistMint';

interface PageConfig {
  label:       string;
  emoji:       string;
  color:       string;
  description: string;
  route:       string;
  badge:       string;
  statKeys:    string[];    // output keys this node exposes
  fetchPath:   (artistId?: string | number) => string;
  formatStats: (data: any, artistData?: any) => StatItem[];
}

interface StatItem { label: string; value: string; highlight?: boolean }

const PAGE_CONFIGS: Record<PremiumPageType, PageConfig> = {
  youtubeBoost: {
    label:       'YouTube Boost',
    emoji:       '▶️',
    color:       '#ff0000',
    description: 'Grow your channel with AI-powered tools',
    route:       '/youtube-views',
    badge:       'GROWTH',
    statKeys:    ['channelUrl', 'subscribers', 'growthScore'],
    fetchPath:   (id) => `/api/youtube/channel-status?artistId=${id || ''}`,
    formatStats: (_d, artist) => [
      { label: 'Channel',     value: artist?.youtubeHandle || 'Not linked',   highlight: !!artist?.youtubeHandle },
      { label: 'Genre',       value: artist?.genres?.[0]   || '—' },
      { label: 'AI tools',    value: '6 active',            highlight: true },
    ],
  },

  instagramBoost: {
    label:       'Instagram Boost',
    emoji:       '📸',
    color:       '#e1306c',
    description: 'AI captions, hashtags, viral score & more',
    route:       '/instagram-boost',
    badge:       'SOCIAL',
    statKeys:    ['handle', 'followers', 'engagementRate'],
    fetchPath:   (id) => `/api/instagram/boost-status?artistId=${id || ''}`,
    formatStats: (_d, artist) => [
      { label: 'Handle',       value: artist?.instagramHandle ? `@${artist.instagramHandle}` : 'Not linked', highlight: !!artist?.instagramHandle },
      { label: 'Caption AI',   value: 'Available',  highlight: true },
      { label: 'Hashtag packs', value: '12 sets' },
    ],
  },

  tiktokBoost: {
    label:       'TikTok Boost',
    emoji:       '🎵',
    color:       '#010101',
    description: 'Viral score, trends, reel creator & calendar',
    route:       '/tiktok-boost',
    badge:       'VIRAL',
    statKeys:    ['handle', 'followers', 'viralScore'],
    fetchPath:   (id) => `/api/tiktok/boost-status?artistId=${id || ''}`,
    formatStats: (_d, artist) => [
      { label: 'Viral Score',   value: '8.4/10',     highlight: true },
      { label: 'Trend Match',   value: 'High' },
      { label: 'Content Ideas', value: '∞ AI-gen' },
    ],
  },

  artistImage: {
    label:       'Artist Image',
    emoji:       '🖼️',
    color:       '#8b5cf6',
    description: 'AI visual identity: photos, covers, personas',
    route:       '/artist-image-advisor',
    badge:       'IDENTITY',
    statKeys:    ['profileImage', 'coverImage', 'styleScore'],
    fetchPath:   (id) => `/api/image-gallery?artistId=${id || ''}`,
    formatStats: (d, artist) => [
      { label: 'Profile image', value: artist?.profileImage ? '✓ Set' : 'Missing', highlight: !!artist?.profileImage },
      { label: 'Gallery shots', value: d?.total != null ? String(d.total) : '—' },
      { label: 'AI Advisor',    value: 'Ready',   highlight: true },
    ],
  },

  merch: {
    label:       'Merch Store',
    emoji:       '👕',
    color:       '#f97316',
    description: 'Printful merch, bundles, seasonal drops',
    route:       '/merchandise',
    badge:       'COMMERCE',
    statKeys:    ['productCount', 'revenue', 'storeUrl'],
    fetchPath:   (id) => `/api/merch/summary?artistId=${id || ''}`,
    formatStats: (d, _artist) => [
      { label: 'Products',  value: d?.total != null ? String(d.total) : '—' },
      { label: 'Provider',  value: 'Printful',   highlight: true },
      { label: 'Bundles',   value: 'Available' },
    ],
  },

  contacts: {
    label:       'Contacts',
    emoji:       '📋',
    color:       '#06b6d4',
    description: 'Music industry contacts, venues & outreach campaigns',
    route:       '/contacts',
    badge:       'NETWORK',
    statKeys:    ['contactCount', 'activeOutreach', 'venues'],
    fetchPath:   (id) => `/api/venue-outreach/summary?artistId=${id || ''}`,
    formatStats: (d, _artist) => [
      { label: 'Contacts',  value: d?.total != null ? String(d.total) : '—' },
      { label: 'Outreach',  value: 'AI-powered',  highlight: true },
      { label: 'Venues DB', value: 'Google Maps' },
    ],
  },

  aiArtistMint: {
    label:       'AI Artist Mint',
    emoji:       '🪙',
    color:       '#f59e0b',
    description: 'Mint your artist identity on blockchain (BTF-2300)',
    route:       '/btf-artist-mint',
    badge:       'WEB3',
    statKeys:    ['mintStatus', 'tokenId', 'blockchainNetwork'],
    fetchPath:   (id) => `/api/tokenization/status?artistId=${id || ''}`,
    formatStats: (d, _artist) => [
      { label: 'Status',   value: d?.minted ? '✓ Minted' : 'Not minted', highlight: d?.minted },
      { label: 'Network',  value: d?.network || 'Polygon' },
      { label: 'Standard', value: 'BTF-2300',   highlight: true },
    ],
  },
};

// ─── Animation injection ─────────────────────────────────────────────────────

let _injected = false;
function injectAnim() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes ppnRingRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes ppnGlow       { 0%,100%{opacity:.8} 50%{opacity:.3} }
    @keyframes ppnShimmer    { 0%{left:-60%} 100%{left:120%} }
  `;
  document.head.appendChild(s);
}
injectAnim();

// ─── BorderRing ────────────────────────────────────────────────────────────────

function BorderRing({ color }: { color: string }) {
  return (
    <div style={{
      position: 'absolute', inset: -1.5, borderRadius: 18, pointerEvents: 'none', zIndex: 10,
      border: `1.5px solid ${color}55`,
      boxShadow: `0 0 16px ${color}33`,
    }} />
  );
}

// ─── StatBadge ────────────────────────────────────────────────────────────────

function StatBadge({ item, color }: { item: StatItem; color: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg"
      style={{ background: item.highlight ? `${color}18` : '#ffffff08' }}>
      <span className="text-[10px]" style={{ color: '#9ca3af' }}>{item.label}</span>
      <span className="text-[10px] font-semibold" style={{ color: item.highlight ? color : '#cbd5e1' }}>
        {item.value}
      </span>
    </div>
  );
}

// ─── PremiumPageNode ──────────────────────────────────────────────────────────

export default function PremiumPageNode({ id, data }: NodeProps<NodeFlowData>) {
  const { updateNodeData, setNodeStatus } = useFlowStore();

  const pageType = ((data as any).pageType || 'youtubeBoost') as PremiumPageType;
  const cfg = PAGE_CONFIGS[pageType] || PAGE_CONFIGS.youtubeBoost;

  // ── State ────────────────────────────────────────────────────────────────
  const [expanded, setExpanded]   = useState(false);
  const [stats,    setStats]      = useState<StatItem[]>([]);
  const [loading,  setLoading]    = useState(false);
  const [loaded,   setLoaded]     = useState(false);

  const artistId   = (data as any).artistId   || '';
  const artistName = (data as any).artistName || 'Artist';

  // ── Load stats on expand ─────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      // Fetch page-specific stats
      const pageRes = await fetch(cfg.fetchPath(artistId), { credentials: 'include' }).catch(() => null);
      const pageData = pageRes?.ok ? await pageRes.json().catch(() => null) : null;

      // Fetch base artist data (for social handles, images etc.)
      let artistData: any = null;
      if (artistId) {
        const artistRes = await fetch(`/api/artist/by-slug/${artistId}`, { credentials: 'include' }).catch(() => null)
          ?? await fetch(`/api/profile?userId=${artistId}`, { credentials: 'include' }).catch(() => null);
        if (artistRes?.ok) {
          const j = await artistRes.json().catch(() => null);
          artistData = j?.artist || j?.profile || j;
        }
      }

      setStats(cfg.formatStats(pageData, artistData));
      setLoaded(true);

      // Persist outputs to node data
      updateNodeData(id, { [`${pageType}Stats`]: pageData || {}, loaded: true });
      setNodeStatus(id, 'success', { pageType, loaded: true });
    } catch {
      setStats(cfg.formatStats(null, null));
    } finally {
      setLoading(false);
    }
  }, [loaded, artistId, cfg, id, pageType, updateNodeData, setNodeStatus]);

  useEffect(() => {
    if (expanded && !loaded) loadStats();
  }, [expanded, loaded, loadStats]);

  // ── Navigate to page ─────────────────────────────────────────────────────
  const openPage = useCallback(() => {
    window.open(cfg.route, '_blank', 'noopener');
  }, [cfg.route]);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 20 }}
      style={{
        width: 290,
        position: 'relative',
        borderRadius: 18,
        background: 'linear-gradient(145deg,#0d1b2a,#0f1729)',
        boxShadow: expanded
          ? `0 8px 32px ${cfg.color}22`
          : '0 4px 20px #00000055',
        overflow: 'visible',
        fontFamily: "'Inter',sans-serif",
      }}
    >
      <BorderRing color={cfg.color} />

      {/* ── Input handle ────────────────────────────────────────────────── */}
      <Handle type="target" position={Position.Left} id="artistId"
        style={{ top: 28, left: -8, width: 14, height: 14, borderRadius: 7,
          background: cfg.color, border: '2px solid #0d1b2a', zIndex: 20 }} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        className="nodrag w-full flex items-center justify-between px-4 pt-3 pb-2 hover:opacity-90 transition-opacity"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5">
          {/* Icon bubble */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
            style={{ background: `linear-gradient(135deg, ${cfg.color}cc, ${cfg.color}66)` }}
          >
            {cfg.emoji}
          </div>
          <div className="text-left">
            <p className="text-white text-xs font-bold leading-tight">{cfg.label}</p>
            <p className="text-[10px]" style={{ color: cfg.color + 'cc' }}>{cfg.badge}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Premium badge */}
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
            style={{ background: `${cfg.color}22`, color: cfg.color }}
          >
            ⚡ PRO
          </span>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={13} style={{ color: '#6b7280' }} />
          </motion.div>
        </div>
      </button>

      {/* ── Description bar ─────────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <p className="text-[10px]" style={{ color: '#6b7280' }}>{cfg.description}</p>
      </div>

      {/* ── Expanded content ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="nodrag px-4 pb-4 space-y-3">
              {/* Artist context */}
              {artistName && artistName !== 'Artist' && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}33` }}
                >
                  <Zap size={11} style={{ color: cfg.color }} />
                  <span className="text-[10px] text-white truncate">{artistName}</span>
                </div>
              )}

              {/* Stats */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                    Quick Stats
                  </p>
                  {loaded && (
                    <button
                      className="nodrag flex items-center gap-1 text-[9px]"
                      style={{ color: cfg.color }}
                      onClick={(e) => { e.stopPropagation(); setLoaded(false); loadStats(); }}
                    >
                      <RefreshCw size={9} /> Refresh
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: '#ffffff08' }} />
                    ))}
                  </div>
                ) : stats.length > 0 ? (
                  <div className="space-y-1">
                    {stats.map((s, i) => <StatBadge key={i} item={s} color={cfg.color} />)}
                  </div>
                ) : (
                  <div className="h-7 flex items-center justify-center rounded-lg" style={{ background: '#ffffff06' }}>
                    <p className="text-[10px]" style={{ color: '#4b5563' }}>No data — connect Artist Input node</p>
                  </div>
                )}
              </div>

              {/* Launch button */}
              <button
                className="nodrag w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-white transition-all active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}aa)`,
                  boxShadow: `0 4px 16px ${cfg.color}44`,
                }}
                onClick={openPage}
              >
                <TrendingUp size={12} />
                Open {cfg.label}
                <ExternalLink size={10} style={{ opacity: 0.7 }} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Output handle ────────────────────────────────────────────────── */}
      <Handle type="source" position={Position.Right} id="data"
        style={{ top: 28, right: -8, width: 14, height: 14, borderRadius: 7,
          background: cfg.color, border: '2px solid #0d1b2a', zIndex: 20 }} />
    </motion.div>
  );
}
