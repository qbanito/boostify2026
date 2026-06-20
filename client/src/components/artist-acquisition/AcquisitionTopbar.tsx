import { useEffect, useRef, useState } from 'react';
import {
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  Plus,
  Bot,
  Menu,
  X,
  Loader2,
  User as UserIcon,
  LogOut,
  ExternalLink,
  BookOpen,
  Keyboard,
  Mail,
  Sparkles,
  Users,
  Music2,
  Zap,
} from 'lucide-react';
import { Link } from 'wouter';
import { TOKENS } from './shared/tokens';
import { useAuth } from '../../hooks/use-auth';
import { apiRequest } from '../../lib/queryClient';
import { useAcquisitionOverview } from '../../hooks/use-acquisition-overview';

interface AcquisitionTopbarProps {
  onMenu: () => void;
}

type LeadResult = {
  id: number;
  fullName?: string | null;
  email?: string | null;
  country?: string | null;
  score?: number | null;
  tier?: string | null;
  status?: string | null;
  genre?: string | null;
};

// ─── Header ────────────────────────────────────────────────────────────
export function AcquisitionTopbar({ onMenu }: AcquisitionTopbarProps) {
  const { user, logout } = useAuth();
  const overview = useAcquisitionOverview();
  const activity = overview.data?.activity || [];

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LeadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
      if (bellRef.current && !bellRef.current.contains(t)) setBellOpen(false);
      if (helpRef.current && !helpRef.current.contains(t)) setHelpOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // ⌘K / Ctrl+K focuses search; Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileSearchOpen(true);
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 30);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setBellOpen(false);
        setHelpOpen(false);
        setProfileOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const h = setTimeout(async () => {
      try {
        const data = await apiRequest(
          'GET',
          `/api/admin/artist-discovery/leads?q=${encodeURIComponent(q)}&limit=8`
        );
        setResults((data as any)?.leads || []);
      } catch (err) {
        console.error('[Topbar search] failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  // Notifications: count unread = items whose time > lastReadAt (localStorage).
  // We don't have absolute timestamps, so we persist the number "seen" and
  // display anything beyond that as unread.
  const NOTIF_LS_KEY = 'aas.notifications.seenCount';
  const [seenCount, setSeenCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem(NOTIF_LS_KEY);
      return v ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  });
  const unread = Math.max(0, activity.length - seenCount);
  const markAllRead = () => {
    try {
      localStorage.setItem(NOTIF_LS_KEY, String(activity.length));
    } catch {
      /* ignore */
    }
    setSeenCount(activity.length);
  };

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    user?.email?.split('@')[0] ||
    'Admin';
  const displayPlan = user?.isAdmin ? 'Boostify Admin' : 'Boostify Pro';
  const avatarUrl =
    user?.profileImageUrl ||
    user?.profileImage ||
    `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=ff7a00`;

  return (
    <header
      className="flex items-center gap-2 sm:gap-3 md:gap-4 px-3 sm:px-5 md:px-7 h-[60px] md:h-[68px] shrink-0 relative z-30"
      style={{
        background: TOKENS.SURFACE,
        borderBottom: `1px solid ${TOKENS.BORDER}`,
      }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenu}
        className="lg:hidden w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: TOKENS.SURFACE_3,
          border: `1px solid ${TOKENS.BORDER}`,
        }}
        aria-label="Open menu"
      >
        <Menu size={16} style={{ color: TOKENS.TEXT }} />
      </button>

      {/* Desktop/tablet search (inline) with results popover */}
      <div
        ref={searchRef}
        className="hidden md:flex relative flex-1 max-w-[520px]"
      >
        <div
          className="flex items-center gap-2.5 flex-1 h-10 px-3.5 rounded-lg"
          style={{
            background: TOKENS.SURFACE_3,
            border: `1px solid ${searchOpen ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
            transition: 'border-color 0.15s',
          }}
        >
          {searching ? (
            <Loader2
              size={15}
              className="animate-spin"
              style={{ color: TOKENS.ORANGE_GLOW }}
            />
          ) : (
            <Search size={15} style={{ color: TOKENS.MUTED }} />
          )}
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search artists, emails, countries, genres…"
            className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:opacity-60 min-w-0"
            style={{ color: TOKENS.TEXT }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                searchInputRef.current?.focus();
              }}
              className="shrink-0"
              aria-label="Clear search"
            >
              <X size={13} style={{ color: TOKENS.MUTED }} />
            </button>
          )}
          <kbd
            className="hidden lg:inline text-[10.5px] px-1.5 py-0.5 rounded font-mono shrink-0"
            style={{
              color: TOKENS.MUTED,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${TOKENS.BORDER}`,
            }}
          >
            ⌘ K
          </kbd>
        </div>

        {searchOpen && (query || results.length > 0) && (
          <SearchResultsPanel
            query={query}
            results={results}
            searching={searching}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </div>

      {/* Mobile search trigger */}
      <button
        onClick={() => {
          setMobileSearchOpen(true);
          setTimeout(() => searchInputRef.current?.focus(), 30);
        }}
        className="md:hidden w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: TOKENS.SURFACE_3,
          border: `1px solid ${TOKENS.BORDER}`,
        }}
        aria-label="Open search"
      >
        <Search size={16} style={{ color: TOKENS.MUTED }} />
      </button>

      <div className="flex-1 md:flex-[0]" />

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notifications */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => {
              const opening = !bellOpen;
              setBellOpen(opening);
              setHelpOpen(false);
              setProfileOpen(false);
              if (opening) markAllRead();
            }}
            className="relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${bellOpen ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
            }}
            aria-label="Notifications"
          >
            <Bell size={16} style={{ color: TOKENS.MUTED }} />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9.5px] font-bold flex items-center justify-center px-1"
                style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {bellOpen && (
            <NotificationsPanel
              activity={activity}
              loading={overview.isFetching && !overview.data}
              onRefresh={() => overview.refetch()}
              onClose={() => setBellOpen(false)}
            />
          )}
        </div>

        {/* Help */}
        <div ref={helpRef} className="relative hidden sm:block">
          <button
            onClick={() => {
              setHelpOpen((v) => !v);
              setBellOpen(false);
              setProfileOpen(false);
            }}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${helpOpen ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
            }}
            aria-label="Help"
          >
            <HelpCircle size={16} style={{ color: TOKENS.MUTED }} />
          </button>
          {helpOpen && <HelpPanel onClose={() => setHelpOpen(false)} />}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => {
              setProfileOpen((v) => !v);
              setBellOpen(false);
              setHelpOpen(false);
            }}
            className="flex items-center gap-2.5 pl-1.5 pr-2 sm:pl-2 sm:pr-3 h-10 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
            style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${profileOpen ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
            }}
            aria-label="Profile menu"
          >
            <div
              className="w-7 h-7 rounded-full overflow-hidden shrink-0"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, #ff8a1f, #4a1f00)',
                border: `1px solid ${TOKENS.ORANGE_RING}`,
              }}
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="leading-tight hidden sm:block text-left">
              <div
                className="text-[12px] font-semibold truncate max-w-[120px]"
                style={{ color: TOKENS.TEXT }}
              >
                {displayName}
              </div>
              <div className="text-[10.5px]" style={{ color: TOKENS.MUTED }}>
                {displayPlan}
              </div>
            </div>
            <ChevronDown
              size={13}
              className="hidden sm:block"
              style={{
                color: TOKENS.MUTED,
                transform: profileOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            />
          </button>
          {profileOpen && (
            <ProfilePanel
              name={displayName}
              email={user?.email || ''}
              plan={displayPlan}
              avatarUrl={avatarUrl}
              onLogout={async () => {
                setProfileOpen(false);
                await logout();
              }}
              onClose={() => setProfileOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Mobile full-width search overlay */}
      {mobileSearchOpen && (
        <div
          className="md:hidden absolute inset-x-0 top-0 z-50 flex flex-col"
          style={{ background: TOKENS.SURFACE }}
        >
          <div
            className="flex items-center gap-2 px-3 h-[60px]"
            style={{ borderBottom: `1px solid ${TOKENS.BORDER}` }}
          >
            <div
              className="flex items-center gap-2.5 flex-1 h-10 px-3.5 rounded-lg"
              style={{
                background: TOKENS.SURFACE_3,
                border: `1px solid ${TOKENS.ORANGE_RING}`,
              }}
            >
              {searching ? (
                <Loader2
                  size={15}
                  className="animate-spin"
                  style={{ color: TOKENS.ORANGE_GLOW }}
                />
              ) : (
                <Search size={15} style={{ color: TOKENS.MUTED }} />
              )}
              <input
                ref={searchInputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search artists, emails, tracks…"
                className="flex-1 bg-transparent border-0 outline-none text-[13px] placeholder:opacity-60 min-w-0"
                style={{ color: TOKENS.TEXT }}
              />
            </div>
            <button
              onClick={() => {
                setMobileSearchOpen(false);
                setQuery('');
                setResults([]);
              }}
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: TOKENS.SURFACE_3,
                border: `1px solid ${TOKENS.BORDER}`,
              }}
              aria-label="Close search"
            >
              <X size={16} style={{ color: TOKENS.MUTED }} />
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto custom-scroll"
            style={{ maxHeight: 'calc(100vh - 60px)' }}
          >
            <SearchResultsInline
              query={query}
              results={results}
              searching={searching}
            />
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Search Results Panel (desktop popover) ───────────────────────────
function SearchResultsPanel({
  query,
  results,
  searching,
  onClose,
}: {
  query: string;
  results: LeadResult[];
  searching: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-40"
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER}`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
    >
      <SearchResultsInline query={query} results={results} searching={searching} onItemClick={onClose} />
    </div>
  );
}

function SearchResultsInline({
  query,
  results,
  searching,
  onItemClick,
}: {
  query: string;
  results: LeadResult[];
  searching: boolean;
  onItemClick?: () => void;
}) {
  if (!query.trim()) {
    return (
      <div className="px-4 py-3 text-[12px]" style={{ color: TOKENS.MUTED }}>
        Type to search artists by name, email, country or genre. Press{' '}
        <kbd
          className="inline-block px-1.5 rounded text-[10px]"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${TOKENS.BORDER}`,
          }}
        >
          ⌘ K
        </kbd>{' '}
        to focus from anywhere.
      </div>
    );
  }
  if (searching && results.length === 0) {
    return (
      <div
        className="px-4 py-6 text-[12px] flex items-center gap-2"
        style={{ color: TOKENS.MUTED }}
      >
        <Loader2 size={13} className="animate-spin" />
        Searching…
      </div>
    );
  }
  if (!searching && results.length === 0) {
    return (
      <div className="px-4 py-6 text-[12px]" style={{ color: TOKENS.MUTED }}>
        No artists match <span style={{ color: TOKENS.TEXT }}>"{query}"</span>.
      </div>
    );
  }
  return (
    <div className="py-1 max-h-[60vh] overflow-y-auto custom-scroll">
      {results.map((r) => (
        <button
          key={r.id}
          onClick={onItemClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
        >
          <div
            className="w-8 h-8 rounded-full overflow-hidden shrink-0"
            style={{ border: `1px solid ${TOKENS.BORDER}` }}
          >
            <img
              src={`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(r.fullName || r.email || String(r.id))}&backgroundColor=0c0d10`}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[13px] font-semibold truncate"
              style={{ color: TOKENS.TEXT }}
            >
              {r.fullName || r.email || `Lead #${r.id}`}
            </div>
            <div
              className="text-[11px] truncate"
              style={{ color: TOKENS.MUTED }}
            >
              {[r.genre, r.country, r.status].filter(Boolean).join(' · ') ||
                r.email}
            </div>
          </div>
          {typeof r.score === 'number' && (
            <div
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{
                color: TOKENS.ORANGE_GLOW,
                background: TOKENS.ORANGE_SOFT,
                border: `1px solid ${TOKENS.ORANGE_RING}`,
              }}
            >
              {r.score}
              {r.tier ? ` · ${r.tier}` : ''}
            </div>
          )}
        </button>
      ))}
      <div
        className="px-4 py-2 text-[10.5px] flex items-center justify-between"
        style={{
          color: TOKENS.MUTED,
          borderTop: `1px solid ${TOKENS.BORDER}`,
        }}
      >
        <span>
          {results.length} result{results.length === 1 ? '' : 's'}
        </span>
        <span>
          Press <kbd className="font-mono">Esc</kbd> to close
        </span>
      </div>
    </div>
  );
}

// ─── Notifications panel ──────────────────────────────────────────────
function NotificationsPanel({
  activity,
  loading,
  onRefresh,
  onClose,
}: {
  activity: { icon: string; text: string; time: string }[];
  loading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const iconFor = (k: string) => {
    if (k === 'mail') return Mail;
    if (k === 'users') return Users;
    if (k === 'music') return Music2;
    if (k === 'spark') return Sparkles;
    return Bell;
  };
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[320px] sm:w-[360px] rounded-xl overflow-hidden z-40"
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER}`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${TOKENS.BORDER}` }}
      >
        <div
          className="text-[13px] font-semibold"
          style={{ color: TOKENS.TEXT }}
        >
          Notifications
        </div>
        <button
          onClick={onRefresh}
          className="text-[11px] transition-colors hover:text-white flex items-center gap-1"
          style={{ color: TOKENS.MUTED }}
        >
          {loading && <Loader2 size={11} className="animate-spin" />}
          Refresh
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto custom-scroll">
        {activity.length === 0 && !loading && (
          <div
            className="px-4 py-6 text-center text-[12px]"
            style={{ color: TOKENS.MUTED }}
          >
            No recent activity yet. Run a discovery cycle to start capturing
            outreach events.
          </div>
        )}
        {activity.map((ev, i) => {
          const Icon = iconFor(ev.icon);
          return (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-2.5"
              style={{
                borderBottom:
                  i < activity.length - 1
                    ? `1px solid ${TOKENS.BORDER}`
                    : 'none',
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: TOKENS.ORANGE_SOFT,
                  border: `1px solid ${TOKENS.ORANGE_RING}`,
                }}
              >
                <Icon size={12} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[12px] leading-snug"
                  style={{ color: TOKENS.TEXT }}
                >
                  {ev.text}
                </div>
                <div
                  className="text-[10.5px] mt-0.5"
                  style={{ color: TOKENS.MUTED }}
                >
                  {ev.time}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="px-4 py-2.5"
        style={{ borderTop: `1px solid ${TOKENS.BORDER}` }}
      >
        <button
          onClick={() => {
            const el = document.getElementById('aas-inbox');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            onClose();
          }}
          className="text-[11.5px] font-medium transition-colors hover:text-white"
          style={{ color: TOKENS.ORANGE_GLOW }}
        >
          View full activity feed →
        </button>
      </div>
    </div>
  );
}

// ─── Help panel ───────────────────────────────────────────────────────
function HelpPanel({ onClose }: { onClose: () => void }) {
  const Item = ({
    icon: Icon,
    title,
    subtitle,
    href,
    onClick,
  }: {
    icon: any;
    title: string;
    subtitle: string;
    href?: string;
    onClick?: () => void;
  }) => {
    const content = (
      <div
        className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 cursor-pointer"
        onClick={() => {
          onClick?.();
          onClose();
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: TOKENS.ORANGE_SOFT,
            border: `1px solid ${TOKENS.ORANGE_RING}`,
          }}
        >
          <Icon size={12} style={{ color: TOKENS.ORANGE_GLOW }} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[12.5px] font-semibold"
            style={{ color: TOKENS.TEXT }}
          >
            {title}
          </div>
          <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>
            {subtitle}
          </div>
        </div>
        {href && (
          <ExternalLink
            size={11}
            style={{ color: TOKENS.MUTED }}
            className="shrink-0 mt-1"
          />
        )}
      </div>
    );
    return href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    ) : (
      content
    );
  };

  return (
    <div
      className="absolute right-0 top-full mt-2 w-[300px] rounded-xl overflow-hidden z-40"
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER}`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="px-4 py-3 text-[13px] font-semibold"
        style={{
          color: TOKENS.TEXT,
          borderBottom: `1px solid ${TOKENS.BORDER}`,
        }}
      >
        Help & Resources
      </div>
      <Item
        icon={BookOpen}
        title="AAS Documentation"
        subtitle="System guide, agents, JSON schema"
        href="/AI_AGENTS_SYSTEM_GUIDE.md"
      />
      <Item
        icon={Zap}
        title="Quick Start: Run Discovery"
        subtitle="Find emerging artists in minutes"
        onClick={() => {
          const el = document.getElementById('aas-discovery');
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      />
      <Item
        icon={Keyboard}
        title="Keyboard Shortcuts"
        subtitle="⌘K search · Esc close · ? this menu"
      />
      <Item
        icon={Mail}
        title="Contact Support"
        subtitle="support@boostify.music"
        href="mailto:support@boostify.music"
      />
    </div>
  );
}

// ─── Profile panel ────────────────────────────────────────────────────
function ProfilePanel({
  name,
  email,
  plan,
  avatarUrl,
  onLogout,
  onClose,
}: {
  name: string;
  email: string;
  plan: string;
  avatarUrl: string;
  onLogout: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-2 w-[260px] rounded-xl overflow-hidden z-40"
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER}`,
        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ borderBottom: `1px solid ${TOKENS.BORDER}` }}
      >
        <div
          className="w-10 h-10 rounded-full overflow-hidden shrink-0"
          style={{ border: `1px solid ${TOKENS.ORANGE_RING}` }}
        >
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[13px] font-semibold truncate"
            style={{ color: TOKENS.TEXT }}
          >
            {name}
          </div>
          <div
            className="text-[11px] truncate"
            style={{ color: TOKENS.MUTED }}
          >
            {email || plan}
          </div>
        </div>
      </div>
      <div className="py-1">
        <Link href="/profile">
          <div
            className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] cursor-pointer transition-colors hover:bg-white/5"
            onClick={onClose}
            style={{ color: TOKENS.TEXT }}
          >
            <UserIcon size={13} style={{ color: TOKENS.MUTED }} />
            My Profile
          </div>
        </Link>
        <Link href="/admin">
          <div
            className="flex items-center gap-2.5 px-4 py-2 text-[12.5px] cursor-pointer transition-colors hover:bg-white/5"
            onClick={onClose}
            style={{ color: TOKENS.TEXT }}
          >
            <Bot size={13} style={{ color: TOKENS.MUTED }} />
            Admin Dashboard
          </div>
        </Link>
      </div>
      <div
        className="py-1"
        style={{ borderTop: `1px solid ${TOKENS.BORDER}` }}
      >
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-[12.5px] transition-colors hover:bg-white/5 text-left"
          style={{ color: '#fca5a5' }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function PageActions({
  onRefresh,
  onRunDiscovery,
  refreshing,
  running,
}: {
  onRefresh?: () => void;
  onRunDiscovery?: () => void;
  refreshing?: boolean;
  running?: boolean;
} = {}) {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center justify-center gap-2 h-9 px-3 sm:px-3.5 rounded-lg text-[12px] sm:text-[12.5px] font-medium transition-colors hover:bg-white/5 flex-1 sm:flex-none disabled:opacity-60"
        style={{
          background: TOKENS.SURFACE_3,
          color: TOKENS.TEXT,
          border: `1px solid ${TOKENS.BORDER}`,
        }}
      >
        <Bot size={14} style={{ color: TOKENS.ORANGE_GLOW }} className={refreshing ? 'animate-spin' : ''} />
        <span className="whitespace-nowrap">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
      </button>
      <button
        onClick={onRunDiscovery}
        disabled={running}
        className="flex items-center justify-center gap-2 h-9 px-3 sm:px-4 rounded-lg text-[12px] sm:text-[12.5px] font-semibold transition-transform hover:-translate-y-px flex-1 sm:flex-none disabled:opacity-60"
        style={{
          background: 'linear-gradient(180deg, #ff8a1f 0%, #ff7a00 100%)',
          color: '#0a0a0a',
          boxShadow:
            '0 0 0 1px rgba(255,138,31,0.4), 0 8px 24px -8px rgba(255,122,0,0.6)',
        }}
      >
        <Plus size={14} strokeWidth={2.5} />
        <span className="whitespace-nowrap">{running ? 'Running…' : 'Run Discovery'}</span>
      </button>
    </div>
  );
}
