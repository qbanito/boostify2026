import { useEffect } from 'react';
import {
  LayoutDashboard,
  Search as SearchIcon,
  Network,
  Braces,
  Image as ImageIcon,
  LayoutTemplate,
  Sparkles,
  Filter,
  BarChart3,
  Inbox,
  Workflow,
  Plug,
  Settings,
  Play,
  Cpu,
  X,
} from 'lucide-react';
import { TOKENS } from './shared/tokens';

const sections: {
  label?: string;
  items: { id: string; label: string; icon: any; badge?: string }[];
}[] = [
  { items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'DISCOVER',
    items: [
      { id: 'discovery', label: 'Artist Discovery', icon: SearchIcon },
      { id: 'ecosystem', label: 'Ecosystem Graph', icon: Network },
      { id: 'master-json', label: 'Master JSON', icon: Braces },
    ],
  },
  {
    label: 'ENGAGE',
    items: [
      { id: 'visual-assets', label: 'Visual Assets', icon: ImageIcon },
      { id: 'landing', label: 'Landing Page Builder', icon: LayoutTemplate },
      { id: 'sequences', label: 'Smart Sequences', icon: Sparkles },
    ],
  },
  {
    label: 'CONVERT',
    items: [
      { id: 'pipeline', label: 'Conversion Pipeline', icon: Filter },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    items: [
      { id: 'agents', label: 'Agent Console', icon: Cpu },
      { id: 'inbox', label: 'Inbox', icon: Inbox, badge: '12' },
      { id: 'automation', label: 'Automation', icon: Workflow },
      { id: 'integrations', label: 'Integrations', icon: Plug },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface AcquisitionSidebarProps {
  active: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export function AcquisitionSidebar({
  active,
  onSelect,
  open,
  onClose,
}: AcquisitionSidebarProps) {
  // Lock body scroll while drawer is open on mobile/tablet
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <>
      {/* Mobile / tablet overlay */}
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
              <span
                className="text-[20px] font-bold tracking-tight"
                style={{ color: TOKENS.TEXT }}
              >
                Boostify
              </span>
              <Waveform />
            </div>
            <div
              className="text-[11px] mt-0.5 tracking-wider"
              style={{ color: TOKENS.MUTED }}
            >
              Artist Acquisition System
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
        <nav className="flex-1 overflow-y-auto px-3 space-y-5 pb-4 custom-scroll">
          {sections.map((section, i) => (
            <div key={i}>
              {section.label && (
                <div
                  className="px-3 mb-2 text-[10.5px] font-semibold tracking-[0.14em]"
                  style={{ color: TOKENS.MUTED_2 }}
                >
                  {section.label}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className="w-full group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150"
                      style={
                        isActive
                          ? {
                              background:
                                'linear-gradient(90deg, rgba(255,122,0,0.18) 0%, rgba(255,122,0,0.04) 100%)',
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
                        style={{
                          color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
                        }}
                      />
                      <span className="flex-1 text-left truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sound of Growth widget */}
        <div className="px-3 pb-4">
          <SoundOfGrowth />
        </div>
      </aside>
    </>
  );
}

function Waveform() {
  const bars = [3, 8, 5, 11, 7, 4, 9, 6, 3];
  return (
    <div className="flex items-end gap-[2px] h-4">
      {bars.map((h, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 2,
            height: h,
            background: TOKENS.ORANGE_GLOW,
            borderRadius: 1,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}

function SoundOfGrowth() {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,122,0,0.14) 0%, rgba(255,122,0,0.04) 100%)',
        border: `1px solid ${TOKENS.ORANGE_RING}`,
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: 'radial-gradient(circle at 30% 30%, #ff8a1f, #b35200)',
          boxShadow: '0 0 18px rgba(255,138,31,0.4)',
        }}
      >
        <div className="w-3 h-3 rounded-full" style={{ background: '#0a0a0a' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[12.5px] font-semibold truncate"
          style={{ color: TOKENS.TEXT }}
        >
          Sound of Growth
        </div>
        <div className="text-[10.5px] truncate" style={{ color: TOKENS.MUTED }}>
          Boostify AI Radio
        </div>
        <div className="flex items-end gap-[2px] h-2 mt-1">
          {[3, 5, 8, 6, 9, 4, 7, 5, 8, 3, 6, 4].map((h, i) => (
            <span
              key={i}
              style={{
                width: 2,
                height: h,
                background: TOKENS.ORANGE_GLOW,
                opacity: 0.7,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      </div>
      <button
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-110"
        style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
        aria-label="Play"
      >
        <Play size={12} fill="#0a0a0a" />
      </button>
    </div>
  );
}
