/**
 * BOOSTIFY ARTIST NODE FLOW — ProfilePresetPanel
 * Right panel shown in Profile Sync mode.
 * Contains presets that activate combinations of profile modules.
 */

import { useState } from 'react';
import { Music, Megaphone, DollarSign, Award, Layers, ChevronRight, Zap, ShoppingBag } from 'lucide-react';

// ─── Preset definitions ───────────────────────────────────────────────────────

interface ProfilePreset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  /** Module IDs to activate */
  modules: string[];
  /** Badge label */
  badge?: string;
}

const PROFILE_PRESETS: ProfilePreset[] = [
  {
    id: 'music-promo',
    name: 'Music Promo Pack',
    description: 'Canciones + Promo Clips + Karaoke + Social Posts + Descargas',
    icon: Music,
    color: '#3b82f6',
    badge: 'POPULAR',
    modules: ['songs', 'promo-clips', 'karaoke', 'social-posts', 'downloads', 'videos'],
  },  {
    id: 'social-empire',
    name: 'Social Empire',
    description: 'Broadcast Studio + Social Posts + News + Audience Engine + Fan Club + Inner Circle',
    icon: Megaphone,
    color: '#22d3ee',
    modules: ['social-hub', 'social-posts', 'news', 'audience-engine', 'fanclub', 'explicit-content'],
  },
  {
    id: 'commerce-empire',
    name: 'Commerce Empire',
    description: 'Merch + Fashion Store + Smart Merch + Art Gallery + Vinyl + Amazon Picks',
    icon: ShoppingBag,
    color: '#f97316',
    badge: 'NEW',
    modules: ['merchandise', 'fashion-store', 'smart-merch', 'art-gallery', 'vinyl-records', 'amazon-picks'],
  },
  {
    id: 'monetization-suite',
    name: 'Monetization Suite',
    description: 'Token Assets + Ganancias + Monetize Talent + Crowdfunding + Sponsors + Vinyl Tokens',
    icon: DollarSign,
    color: '#10b981',
    modules: ['tokenization', 'earnings', 'monetize-cta', 'crowdfunding', 'sponsors', 'vinyl-editions'],
  },
  {
    id: 'press-kit-pro',
    name: 'Press Kit Pro',
    description: 'Press Room + The Gateway + Superstar Blueprint + News + Business Blueprint',
    icon: Award,
    color: '#ec4899',
    modules: ['electronic-press-kit', 'agent-gateway', 'artist-blueprint', 'news', 'business-plan'],
  },
  {
    id: 'full-suite',
    name: 'Full Artist Suite',
    description: 'Activa todos los módulos disponibles del perfil',
    icon: Layers,
    color: '#a78bfa',
    badge: 'ALL',
    modules: [
      'songs', 'fanclub', 'videos', 'galleries', 'downloads', 'karaoke', 'lyrics-video',
      'promo-clips', 'ai-video-studio', 'avatar-talk',
      'social-hub', 'social-posts', 'news',
      'merchandise', 'fashion-store', 'smart-merch', 'art-gallery',
      'vinyl-records', 'vinyl-editions', 'amazon-picks',
      'tokenization', 'monetize-cta',
      'earnings', 'crowdfunding', 'sponsors',
      'analytics', 'audience-engine', 'aas-engine',
      'business-plan', 'artist-blueprint',
      'electronic-press-kit', 'agent-gateway',
      'renaissance-studio', 'hologram', 'talk-to-me', 'my-universe',
    ],
  },
];

// ─── Module color map for chips ───────────────────────────────────────────────

const MODULE_COLORS: Record<string, string> = {
  songs: '#3b82f6', videos: '#3b82f6', galleries: '#3b82f6',
  downloads: '#3b82f6', karaoke: '#3b82f6', 'promo-clips': '#3b82f6',
  'lyrics-video': '#7c3aed', 'avatar-talk': '#a855f7', 'ai-video-studio': '#3b82f6',
  'social-hub': '#22d3ee', 'social-posts': '#22d3ee', news: '#22d3ee',
  fanclub: '#22d3ee', 'explicit-content': '#22d3ee', 'audience-engine': '#a78bfa',
  merchandise: '#f97316', 'fashion-store': '#f97316', 'smart-merch': '#f97316',
  'art-gallery': '#f97316', 'vinyl-records': '#f97316', 'vinyl-editions': '#f97316',
  'amazon-picks': '#f97316', tokenization: '#f97316', 'monetize-cta': '#f97316',
  earnings: '#10b981', crowdfunding: '#10b981', sponsors: '#10b981',
  analytics: '#a78bfa', 'aas-engine': '#a78bfa',
  'business-plan': '#f59e0b', 'artist-blueprint': '#f59e0b',
  'electronic-press-kit': '#ec4899', 'agent-gateway': '#ec4899',
  'renaissance-studio': '#8b5cf6', hologram: '#8b5cf6',
  'talk-to-me': '#8b5cf6', 'my-universe': '#8b5cf6',
};

const MODULE_LABELS: Record<string, string> = {
  songs: 'Music', videos: 'Videos', galleries: 'Gallery', downloads: 'Downloads',
  karaoke: 'Karaoke', 'promo-clips': 'Promo Clips', 'lyrics-video': 'Lyrics Video',
  'avatar-talk': 'Avatar Talk', 'ai-video-studio': 'AI Video', 'social-hub': 'Broadcast',
  'social-posts': 'Social Posts', news: 'News', fanclub: 'Fan Club',
  'explicit-content': 'Inner Circle', 'audience-engine': 'Signal Pulse',
  merchandise: 'Merch', 'fashion-store': 'Fashion', 'smart-merch': 'Smart Merch',
  'art-gallery': 'Art Gallery', 'vinyl-records': 'Vinyl', 'vinyl-editions': 'Vinyl Tokens',
  'amazon-picks': 'Amazon', tokenization: 'Tokens',
  'monetize-cta': 'Monetize', earnings: 'Earnings', crowdfunding: 'Crowdfunding',
  sponsors: 'Sponsors', analytics: 'Observatory', 'aas-engine': 'Genesis Engine',
  'business-plan': 'Blueprint', 'artist-blueprint': 'Superstar Blueprint',
  'electronic-press-kit': 'Press Room', 'agent-gateway': 'Gateway',
  'renaissance-studio': 'Renaissance', hologram: 'HoloStage',
  'talk-to-me': 'Talk To Me', 'my-universe': 'My Universe',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface ProfilePresetPanelProps {
  /** IDs of currently active profile modules */
  activeModuleIds: string[];
  /** Activate a list of modules at once */
  onActivatePreset: (moduleIds: string[]) => Promise<void>;
}

export function ProfilePresetPanel({ activeModuleIds, onActivatePreset }: ProfilePresetPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  async function handlePreset(preset: ProfilePreset) {
    if (loading) return;
    setLoading(preset.id);
    setApplied(null);
    try {
      await onActivatePreset(preset.modules);
      setApplied(preset.id);
      setTimeout(() => setApplied(null), 2000);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      style={{
        width: 256,
        display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
        background: 'rgba(7,7,15,0.97)',
        borderLeft: '1px solid rgba(99,102,241,0.12)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(99,102,241,0.1)',
        background: 'linear-gradient(180deg, rgba(13,10,28,0.8) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <div style={{
            width: 18, height: 18, borderRadius: 5,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 8px rgba(99,102,241,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={9} color="#fff" />
          </div>
          <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#a78bfa', textTransform: 'uppercase', margin: 0 }}>
            Profile Presets
          </p>
        </div>
        <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>
          Activa combinaciones de módulos de un clic
        </p>
      </div>

      {/* Preset cards */}
      <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PROFILE_PRESETS.map(preset => {
          const isLoading = loading === preset.id;
          const isApplied = applied === preset.id;
          const activeCount = preset.modules.filter(m => activeModuleIds.includes(m)).length;
          const totalCount = preset.modules.length;
          const allActive = activeCount === totalCount;

          return (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset)}
              disabled={!!loading}
              style={{
                width: '100%', textAlign: 'left', cursor: loading ? 'not-allowed' : 'pointer',
                borderRadius: 12, padding: '10px 12px',
                background: isApplied
                  ? `${preset.color}18`
                  : `${preset.color}0d`,
                border: `1px solid ${isApplied ? preset.color + '60' : preset.color + '28'}`,
                transition: 'all 0.2s ease',
                opacity: loading && !isLoading ? 0.5 : 1,
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.border = `1px solid ${preset.color}60`;
              }}
              onMouseLeave={e => {
                if (!isApplied) (e.currentTarget as HTMLElement).style.border = `1px solid ${preset.color}28`;
              }}
            >
              {/* Shimmer on apply */}
              {isApplied && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 12,
                  background: `linear-gradient(90deg, transparent, ${preset.color}20, transparent)`,
                  animation: 'profile-preset-shimmer 0.6s ease forwards',
                  pointerEvents: 'none',
                }} />
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: `${preset.color}1a`,
                  border: `1px solid ${preset.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isApplied ? `0 0 12px ${preset.color}50` : 'none',
                  transition: 'box-shadow 0.2s',
                }}>
                  <preset.icon size={15} style={{ color: preset.color }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', margin: 0, lineHeight: 1.2 }}>
                      {preset.name}
                    </p>
                    {preset.badge && (
                      <span style={{
                        fontSize: 7, fontWeight: 800, padding: '1px 4px', borderRadius: 3,
                        background: `${preset.color}25`, color: preset.color,
                        border: `1px solid ${preset.color}40`, letterSpacing: '0.05em',
                      }}>
                        {preset.badge}
                      </span>
                    )}
                    <ChevronRight size={10} style={{ color: preset.color, marginLeft: 'auto', flexShrink: 0 }} />
                  </div>
                  <p style={{ fontSize: 9, color: '#64748b', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {preset.description}
                  </p>

                  {/* Module chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {preset.modules.slice(0, 6).map(m => {
                      const isActive = activeModuleIds.includes(m);
                      const col = MODULE_COLORS[m] ?? preset.color;
                      return (
                        <span key={m} style={{
                          fontSize: 8, padding: '1px 5px', borderRadius: 4,
                          background: isActive ? `${col}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isActive ? col + '45' : 'rgba(255,255,255,0.07)'}`,
                          color: isActive ? col : '#475569',
                          fontWeight: isActive ? 700 : 400,
                          transition: 'all 0.15s',
                        }}>
                          {MODULE_LABELS[m] ?? m}
                        </span>
                      );
                    })}
                    {preset.modules.length > 6 && (
                      <span style={{ fontSize: 8, color: '#334155' }}>+{preset.modules.length - 6}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: 8, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${Math.round((activeCount / totalCount) * 100)}%`,
                  background: allActive ? preset.color : `linear-gradient(90deg, ${preset.color}80, ${preset.color})`,
                  boxShadow: allActive ? `0 0 6px ${preset.color}` : 'none',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ fontSize: 8, color: '#334155', margin: '3px 0 0', textAlign: 'right' }}>
                {isApplied ? '✓ Applied!' : isLoading ? 'Activating…' : `${activeCount}/${totalCount} active`}
              </p>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: '#334155', textTransform: 'uppercase', margin: '0 0 6px' }}>
          Categorías
        </p>
        {[
          { color: '#3b82f6', label: 'Music' },
          { color: '#22d3ee', label: 'Social' },
          { color: '#f97316', label: 'Commerce' },
          { color: '#10b981', label: 'Monetize' },
          { color: '#a78bfa', label: 'Growth' },
          { color: '#f59e0b', label: 'Business' },
          { color: '#ec4899', label: 'Identity' },
          { color: '#8b5cf6', label: 'Creative' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0, boxShadow: `0 0 4px ${item.color}80` }} />
            <span style={{ fontSize: 9, color: '#475569' }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
