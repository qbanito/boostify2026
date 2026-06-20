/**
 * BOOSTIFY ARTIST NODE FLOW — NodePalette
 * Left sidebar: grouped draggable node tiles.
 */

import { User, Music2, FileText, Image, Mic2, Video, Share2, CreditCard, UserCog, Newspaper } from 'lucide-react';

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: 'input' | 'process' | 'output';
  description: string;
}

const PALETTE: PaletteItem[] = [
  // Input
  { type: 'artistInput',   label: 'Artist Input',   icon: User,       category: 'input',   description: 'Artist data source' },
  { type: 'songInput',     label: 'Song Input',     icon: Music2,     category: 'input',   description: 'Song data source' },
  // Process
  { type: 'bioGenerator',  label: 'Bio Generator',  icon: FileText,   category: 'process', description: 'AI biography' },
  { type: 'coverArt',      label: 'Cover Art',      icon: Image,      category: 'process', description: 'AI cover image' },
  { type: 'karaoke',       label: 'Karaoke',        icon: Mic2,       category: 'process', description: 'Vocal removal' },
  { type: 'promoClip',     label: 'Promo Clip',     icon: Video,      category: 'process', description: 'Video promo' },
  { type: 'socialPost',    label: 'Social Post',    icon: Share2,     category: 'process', description: 'Caption + hashtags' },
  { type: 'shareCard',     label: 'Share Card',     icon: CreditCard, category: 'process', description: 'PNG share card' },
  // Output
  { type: 'profileUpdate', label: 'Profile Update', icon: UserCog,    category: 'output',  description: 'Save to profile' },
  { type: 'newsPublisher', label: 'News Publisher', icon: Newspaper,  category: 'output',  description: 'Publish to feed' },
];

const CATEGORY_STYLE = {
  input:   { label: 'INPUT',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  process: { label: 'PROCESS', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  output:  { label: 'OUTPUT',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

function onDragStart(e: React.DragEvent, type: string) {
  e.dataTransfer.setData('application/boostify-node', type);
  e.dataTransfer.effectAllowed = 'move';
}

export function NodePalette() {
  const categories = ['input', 'process', 'output'] as const;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        width: 220,
        background: 'rgba(8,8,14,0.95)',
        borderRight: '1px solid rgba(99,102,241,0.15)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-xs font-bold tracking-widest text-slate-400">NODES</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Drag onto canvas</p>
      </div>

      <div className="flex-1 px-3 py-3 space-y-4">
        {categories.map(cat => {
          const style = CATEGORY_STYLE[cat];
          const items = PALETTE.filter(p => p.category === cat);
          return (
            <div key={cat}>
              <p className="text-[9px] font-bold tracking-widest mb-1.5 px-1" style={{ color: style.color }}>
                {style.label}
              </p>
              <div className="space-y-1.5">
                {items.map(item => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={e => onDragStart(e, item.type)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]"
                    style={{
                      background: style.bg,
                      border: `1px solid ${style.color}30`,
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: `${style.color}20` }}
                    >
                      <item.icon className="w-3.5 h-3.5" style={{ color: style.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight">{item.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight truncate">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
