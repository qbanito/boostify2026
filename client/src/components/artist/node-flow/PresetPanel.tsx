/**
 * BOOSTIFY ARTIST NODE FLOW — PresetPanel
 * Right sidebar: 4 preset flows to load instantly.
 */

import { Node, Edge } from '@xyflow/react';
import { Rocket, Mic2, Megaphone, Newspaper, ChevronRight } from 'lucide-react';
import { useFlowStore, NodeFlowData } from './useFlowStore';

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  nodes: Omit<Node<NodeFlowData>, 'data'> & { data?: Partial<NodeFlowData> };
  edges: Edge[];
}

// ─── Helper to quickly build preset node lists ──────────────────────────────

function n(id: string, type: string, x: number, y: number, extra: Partial<NodeFlowData> = {}): any {
  return { id, type, position: { x, y }, data: { status: 'idle', output: {}, ...extra } };
}

function e(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'animated', style: { stroke: '#6366f1', strokeWidth: 2 } };
}

const PRESETS: Preset[] = [
  {
    id: 'launch-pack',
    name: 'Launch Pack Completo',
    description: 'Bio → Profile update + Song cover → Share card → Download',
    icon: Rocket,
    color: '#8b5cf6',
    nodes: [
      n('p1-ai', 'artistInput', 100, 180),
      n('p1-bio', 'bioGenerator', 380, 80),
      n('p1-upd', 'profileUpdate', 660, 80),
      n('p1-si', 'songInput', 100, 380),
      n('p1-cov', 'coverArt', 380, 380),
      n('p1-shr', 'shareCard', 660, 380),
    ] as any,
    edges: [
      e('e1', 'p1-ai', 'p1-bio'), e('e2', 'p1-bio', 'p1-upd'),
      e('e3', 'p1-si', 'p1-cov'), e('e4', 'p1-cov', 'p1-shr'),
      e('e5', 'p1-ai', 'p1-cov'),
    ],
  },
  {
    id: 'karaoke-pipeline',
    name: 'Karaoke Pipeline',
    description: 'Song → Karaoke → Share card → Social share',
    icon: Mic2,
    color: '#22d3ee',
    nodes: [
      n('k1-si', 'songInput', 100, 200),
      n('k1-kar', 'karaoke', 380, 200),
      n('k1-shr', 'shareCard', 660, 200),
    ] as any,
    edges: [
      e('ke1', 'k1-si', 'k1-kar'), e('ke2', 'k1-kar', 'k1-shr'),
    ],
  },
  {
    id: 'promo-campaign',
    name: 'Promo Campaign',
    description: 'Artist + Song → Social post + Promo clip → Download',
    icon: Megaphone,
    color: '#f97316',
    nodes: [
      n('pc-ai', 'artistInput', 100, 100),
      n('pc-si', 'songInput', 100, 300),
      n('pc-sp', 'socialPost', 380, 100),
      n('pc-pc', 'promoClip', 380, 300),
      n('pc-shr', 'shareCard', 660, 200),
    ] as any,
    edges: [
      e('pce1', 'pc-ai', 'pc-sp'), e('pce2', 'pc-si', 'pc-sp'),
      e('pce3', 'pc-si', 'pc-pc'), e('pce4', 'pc-sp', 'pc-shr'), e('pce5', 'pc-pc', 'pc-shr'),
    ],
  },
  {
    id: 'press-kit',
    name: 'Press Kit',
    description: 'Artist → Bio → Profile + Cover art + News publisher',
    icon: Newspaper,
    color: '#4ade80',
    nodes: [
      n('pk-ai', 'artistInput', 100, 200),
      n('pk-bio', 'bioGenerator', 380, 100),
      n('pk-cov', 'coverArt', 380, 300),
      n('pk-upd', 'profileUpdate', 660, 100),
      n('pk-news', 'newsPublisher', 660, 300),
    ] as any,
    edges: [
      e('pke1', 'pk-ai', 'pk-bio'), e('pke2', 'pk-ai', 'pk-cov'),
      e('pke3', 'pk-bio', 'pk-upd'), e('pke4', 'pk-cov', 'pk-news'),
      e('pke5', 'pk-bio', 'pk-news'),
    ],
  },
];

export function PresetPanel() {
  const store = useFlowStore();

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{
        width: 256,
        background: 'rgba(8,8,14,0.95)',
        borderLeft: '1px solid rgba(99,102,241,0.15)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-xs font-bold tracking-widest text-slate-400">PRESETS</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Click to load a flow</p>
      </div>

      <div className="flex-1 px-3 py-3 space-y-2.5">
        {PRESETS.map(preset => (
          <button
            key={preset.id}
            onClick={() => store.loadPreset({ nodes: preset.nodes as any, edges: preset.edges })}
            className="w-full text-left rounded-xl p-3.5 transition-all hover:scale-[1.01] active:scale-[0.99] group"
            style={{
              background: `${preset.color}0d`,
              border: `1px solid ${preset.color}30`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: `${preset.color}20` }}
              >
                <preset.icon className="w-4 h-4" style={{ color: preset.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white leading-tight">{preset.name}</p>
                  <ChevronRight
                    className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors flex-shrink-0"
                    style={{ color: preset.color }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{preset.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-white/5 space-y-1.5">
        <p className="text-[9px] font-bold tracking-widest text-slate-600">NODE TYPES</p>
        {[
          { color: '#3b82f6', label: 'Input — data source' },
          { color: '#8b5cf6', label: 'Process — AI action' },
          { color: '#10b981', label: 'Output — save/publish' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <p className="text-[10px] text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
