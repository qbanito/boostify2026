import { useEffect } from 'react';
import {
  LayoutDashboard,
  Radar,
  CircleDot,
  Handshake,
  Package,
  Send,
  TrendingUp,
  BarChart3,
  Play,
  X,
} from 'lucide-react';
import { TOKENS } from '../artist-acquisition/shared/tokens';

const items: { id: string; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'artist-radar', label: 'Artist Radar', icon: Radar },
  { id: 'decision-circle', label: 'Decision Circle', icon: CircleDot },
  { id: 'offers', label: 'Offers', icon: Handshake },
  { id: 'assets', label: 'Assets', icon: Package },
  { id: 'outreach', label: 'Outreach', icon: Send },
  { id: 'deals', label: 'Deals', icon: TrendingUp },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

interface AlliancesSidebarProps {
  active: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export function AlliancesSidebar({ active, onSelect, open, onClose }: AlliancesSidebarProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        className={`lg:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
        aria-hidden="true"
      />
      <aside
        className={`flex flex-col h-full shrink-0 z-50 transition-transform duration-200 ease-out
          fixed lg:static top-0 left-0 bottom-0
          w-[86vw] max-w-[300px] lg:w-[252px]
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{
          background: TOKENS.SURFACE,
          borderRight: `1px solid ${TOKENS.BORDER}`,
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-5 pb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-[20px] font-bold tracking-tight" style={{ color: TOKENS.TEXT }}>
                Boostify
              </span>
            </div>
            <div className="text-[11px] mt-0.5 tracking-wider" style={{ color: TOKENS.MUTED }}>
              Alliances · Strategic OS
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}
            aria-label="Close menu"
          >
            <X size={15} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 space-y-1 pb-4 custom-scroll">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                data-testid={`alliances-nav-${item.id}`}
                className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-150"
                style={
                  isActive
                    ? {
                        background:
                          'linear-gradient(90deg, rgba(255,122,0,0.20) 0%, rgba(255,122,0,0.04) 100%)',
                        color: TOKENS.TEXT,
                        border: `1px solid ${TOKENS.ORANGE_RING}`,
                        boxShadow:
                          '0 0 0 1px rgba(255,122,0,0.05), 0 8px 20px -8px rgba(255,122,0,0.4)',
                      }
                    : {
                        color: TOKENS.MUTED,
                        border: '1px solid transparent',
                      }
                }
              >
                <Icon
                  size={16}
                  strokeWidth={1.8}
                  style={{ color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.MUTED }}
                />
                <span className="flex-1 text-left truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sound footer */}
        <div className="px-3 pb-4">
          <SoundCard />
        </div>
      </aside>
    </>
  );
}

function BrandMark() {
  const bars = [4, 10, 6, 13, 8, 5, 11];
  return (
    <div className="flex items-end gap-[2px] h-5 px-1 rounded-md" style={{ background: 'rgba(255,122,0,0.08)' }}>
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 2.5,
            height: h,
            background: TOKENS.ORANGE_GLOW,
            borderRadius: 1,
            boxShadow: '0 0 6px rgba(255,138,31,0.6)',
          }}
        />
      ))}
    </div>
  );
}

function SoundCard() {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,122,0,0.14) 0%, rgba(255,122,0,0.03) 100%)',
        border: `1px solid ${TOKENS.ORANGE_RING}`,
      }}
    >
      <div className="flex items-end gap-[2px] h-6 mb-2">
        {[3, 6, 10, 5, 12, 7, 9, 4, 11, 6, 8, 3, 10, 5, 7].map((h, i) => (
          <span
            key={i}
            style={{
              width: 2.5,
              height: h,
              background: TOKENS.ORANGE_GLOW,
              opacity: 0.8,
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <div className="text-[11px] font-semibold" style={{ color: TOKENS.TEXT }}>
        Sound moves culture.
      </div>
      <div className="text-[10.5px] mb-2" style={{ color: TOKENS.MUTED }}>
        Alliances move legacy.
      </div>
      <div className="flex items-center gap-2">
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', color: TOKENS.MUTED }}
          aria-label="Previous"
        >
          <span className="text-xs">«</span>
        </button>
        <button
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: TOKENS.ORANGE,
            color: '#0a0a0a',
            boxShadow: '0 0 18px rgba(255,138,31,0.45)',
          }}
          aria-label="Play"
        >
          <Play size={13} fill="#0a0a0a" />
        </button>
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', color: TOKENS.MUTED }}
          aria-label="Next"
        >
          <span className="text-xs">»</span>
        </button>
      </div>
    </div>
  );
}
