import { Search, Bell, Menu, X } from 'lucide-react';
import { TOKENS } from '../artist-acquisition/shared/tokens';
import { useAuth } from '../../hooks/use-auth';

interface AlliancesTopbarProps {
  onMenu: () => void;
  searchQuery: string;
  onSearchChange: (v: string) => void;
}

export function AlliancesTopbar({ onMenu, searchQuery, onSearchChange }: AlliancesTopbarProps) {
  const { user } = useAuth();
  const avatarUrl = (user as any)?.profileImage || (user as any)?.imageUrl || null;
  const displayName =
    (user as any)?.firstName
      ? `${(user as any).firstName} ${(user as any).lastName || ''}`.trim()
      : (user as any)?.name || (user as any)?.email || 'Head of Alliances';

  return (
    <header
      className="flex items-center gap-3 px-4 sm:px-6 py-4"
      style={{ borderBottom: `1px solid ${TOKENS.BORDER}`, background: TOKENS.BG_DEEP }}
    >
      <button
        onClick={onMenu}
        className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center shrink-0"
        style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}
        aria-label="Open menu"
      >
        <Menu size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight truncate" style={{ color: TOKENS.TEXT }}>
          Boostify <span style={{ color: TOKENS.ORANGE_GLOW }}>Alliances</span>
        </h1>
        <div className="text-[11.5px] tracking-wide" style={{ color: TOKENS.MUTED }}>
          Identify. Connect. Align. Grow Together.
        </div>
      </div>

      {/* Search */}
      <div
        className="hidden md:flex items-center gap-2 rounded-full px-3.5 h-10 w-[320px] lg:w-[380px]"
        style={{
          background: TOKENS.SURFACE_2,
          border: `1px solid ${TOKENS.BORDER}`,
        }}
      >
        <Search size={14} style={{ color: TOKENS.MUTED }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search artists, contacts, labels…"
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#6b7280]"
          style={{ color: TOKENS.TEXT }}
          data-testid="alliances-topbar-search"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            style={{ color: TOKENS.MUTED }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Bell */}
      <button
        className="relative w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
        aria-label="Notifications"
        title="Notifications (coming soon)"
      >
        <Bell size={15} />
        <span
          className="absolute -top-0.5 -right-0.5 text-[9.5px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
        >
          3
        </span>
      </button>

      {/* Profile */}
      <div
        className="hidden sm:flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full shrink-0"
        style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #ff8a1f, #b35200)',
            color: '#0a0a0a',
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            displayName.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold truncate max-w-[140px]" style={{ color: TOKENS.TEXT }}>
            {displayName}
          </div>
          <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>
            Head of Alliances
          </div>
        </div>
      </div>
    </header>
  );
}
