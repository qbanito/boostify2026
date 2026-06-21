/**
 * BOOSTIFY NODE FLOW — InactiveModulesPanel
 * Left sidebar in Profile Sync mode: lists all HIDDEN modules grouped by category.
 * Clicking a module activates it (makes it visible on the profile + canvas).
 */

import { useState } from 'react';
import {
  Eye, ChevronDown, ChevronRight,
  Music2, Film, Mic2, Bot, Clapperboard, Images, Download,
  Antenna, Send, Newspaper, Flame, Share2,
  Package, ShoppingCart, Coins, Sparkles,
  LineChart, Target, Handshake, MapPin,
  Activity, Radar, Network, TrendingUp, Megaphone, Zap,
  PieChart, Brain, Map, FileText, ScrollText,
  Shield, Globe, BookOpen,
  Wand2, Layers, MessageCircle, Heart, Monitor,
  QrCode, CreditCard, BarChart2, Info, Headphones, Crown, Calendar, Bitcoin,
  Plus, Shirt, Palette, Disc3,
} from 'lucide-react';

const ICONS: Record<string, React.ElementType> = {
  // MUSIC
  'songs': Music2, 'videos': Film, 'karaoke': Mic2, 'avatar-talk': Bot,
  'promo-clips': Clapperboard, 'ai-video-studio': Film, 'lyrics-video': Clapperboard,
  'galleries': Images, 'downloads': Download,
  // SOCIAL
  'social-hub': Antenna, 'social-posts': Send, 'fanclub': Heart,
  'news': Newspaper, 'explicit-content': Flame,
  // COMMERCE
  'merchandise': Package, 'amazon-picks': ShoppingCart,
  'fashion-store': Shirt, 'smart-merch': QrCode, 'art-gallery': Palette,
  'vinyl-records': Disc3, 'vinyl-editions': Disc3,
  'tokenization': Coins, 'monetize-cta': Sparkles,
  // MONETIZE
  'earnings': LineChart, 'crowdfunding': Target,
  'sponsors': Handshake, 'venueBooking': MapPin,
  // GROWTH
  'analytics': Activity, 'aas-engine': Zap, 'audience-engine': Radar,
  'influencer-module': Network, 'viral-products': TrendingUp, 'ads-campaigns': Megaphone,
  // BUSINESS
  'business-plan': PieChart, 'career-suite': Brain, 'artist-blueprint': Map,
  'brand-collabs': Handshake, 'observation-engine': FileText, 'deep-brief': FileText,
  // IDENTITY
  'electronic-press-kit': BookOpen, 'agent-gateway': Shield,
  'hermes-agent': ScrollText, 'artist-domain': Globe,
  // CREATIVE
  'renaissance-studio': Wand2, 'hologram': Layers,
  'talk-to-me': MessageCircle, 'emotional-studio': Heart, 'gamma-presentations': Monitor,
  'my-universe': Globe, 'whatsapp-command-center': MessageCircle,
  // WIDGET
  'qr-card': QrCode, 'physical-cards': CreditCard, 'statistics': BarChart2,
  'tokenized-music': Coins, 'information': Info, 'social-media': Share2,
  'spotify': Headphones, 'premium-tools': Crown, 'upcoming-shows': Calendar,
  'economic-engine': TrendingUp, 'crypto-community': Bitcoin,
};

interface InactiveModule {
  moduleId: string;
  moduleName: string;
  categoryLabel: string;
  categoryColor: string;
  isOwnerOnly: boolean;
}

interface InactiveModulesPanelProps {
  inactiveModules: InactiveModule[];
  onActivate: (moduleId: string) => void;
}

// Group by category
function groupByCategory(modules: InactiveModule[]) {
  const groups: Record<string, InactiveModule[]> = {};
  for (const m of modules) {
    const cat = m.categoryLabel;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m);
  }
  return groups;
}

export function InactiveModulesPanel({ inactiveModules, onActivate }: InactiveModulesPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = groupByCategory(inactiveModules);

  const toggle = (cat: string) => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        width: 200,
        background: 'rgba(6,6,12,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Module Library</p>
        <p className="text-[9px] text-slate-600 mt-0.5">Click ＋ to activate</p>
      </div>

      {inactiveModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(99,102,241,0.1)' }}>
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-[11px] font-bold text-white">All modules active!</p>
          <p className="text-[10px] text-slate-500 mt-1">Every profile section is visible.</p>
        </div>
      ) : (
        <div className="flex-1 py-2 space-y-0.5 px-2">
          {Object.entries(groups).map(([cat, mods]) => {
            const color = mods[0]?.categoryColor ?? '#6366f1';
            const isCollapsed = collapsed[cat] ?? false;

            return (
              <div key={cat}>
                {/* Category header */}
                <button
                  onClick={() => toggle(cat)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all hover:bg-white/5"
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-[9px] font-bold tracking-widest uppercase flex-1 text-left" style={{ color }}>
                    {cat}
                  </span>
                  <span className="text-[8px] text-slate-600 font-medium">{mods.length}</span>
                  {isCollapsed
                    ? <ChevronRight className="w-2.5 h-2.5 text-slate-600" />
                    : <ChevronDown className="w-2.5 h-2.5 text-slate-600" />
                  }
                </button>

                {/* Module items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 ml-1 mt-0.5 mb-1">
                    {mods.map(mod => {
                      const Icon = ICONS[mod.moduleId] ?? Sparkles;
                      return (
                        <button
                          key={mod.moduleId}
                          onClick={() => onActivate(mod.moduleId)}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all group"
                          style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.background = `${color}12`;
                            (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.04)';
                          }}
                        >
                          <div
                            className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                            style={{ background: `${color}18` }}
                          >
                            <Icon className="w-2.5 h-2.5" style={{ color: `${color}99` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 group-hover:text-white transition-colors flex-1 leading-tight">
                            {mod.moduleName}
                          </span>
                          <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color }} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-2 flex-shrink-0 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <p className="text-[9px] text-slate-700">
          {inactiveModules.length} hidden · {36 - inactiveModules.length} active
        </p>
      </div>
    </div>
  );
}
