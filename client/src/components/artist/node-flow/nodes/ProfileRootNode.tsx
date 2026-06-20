/**
 * BOOSTIFY ARTIST NODE FLOW — ProfileRootNode
 * The always-present root node in Profile Sync mode.
 * Lets users switch the target artist → canvas adapts to that artist's profile.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Search, ChevronDown, User, Zap } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProfileRootData {
  artistId: number | null;
  artistSlug: string | null;
  artistName: string | null;
  artistImage: string | null;
  artistGenre: string | null;
  artistCountry: string | null;
  onArtistSelect: (id: number, slug: string) => void;
}

interface ArtistItem {
  id: number;
  slug: string;
  artistName: string;
  image: string | null;
  genre: string | null;
  country: string | null;
}

// ─── Singleton CSS ────────────────────────────────────────────────────────────

const STYLE_ID = 'boostify-profile-root-node';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes root-status-pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74,222,128,0.7); }
      50%       { opacity: 0.7; box-shadow: 0 0 0 5px rgba(74,222,128,0); }
    }
    @keyframes root-shine {
      0%   { background-position: -300% center; }
      100% { background-position: 300% center; }
    }
    .profile-root-search:focus {
      outline: none;
      border-color: rgba(99,102,241,0.7) !important;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.2) !important;
    }
    .profile-root-list-item:hover {
      background: rgba(99,102,241,0.12) !important;
    }
  `;
  document.head.appendChild(s);
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ProfileRootNode = memo(function ProfileRootNode({ data, selected }: NodeProps) {
  const d = data as ProfileRootData;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [artists, setArtists] = useState<ArtistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Fetch list when dropdown first opens
  useEffect(() => {
    if (!open || artists.length > 0) return;
    setLoading(true);
    fetch('/api/profile/list')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(json => setArtists(json.items ?? []))
      .catch(() => setArtists([]))
      .finally(() => setLoading(false));
  }, [open, artists.length]);

  const filtered = query.trim()
    ? artists.filter(a =>
        (a.artistName ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (a.slug ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : artists;

  const hasImage = Boolean(d.artistImage);
  const initials = (d.artistName ?? '?').slice(0, 2).toUpperCase();

  const glow = selected
    ? '0 0 0 2px #6366f1, 0 0 40px rgba(99,102,241,0.55), 0 8px 32px rgba(0,0,0,0.7)'
    : hovered
    ? '0 0 0 1px rgba(99,102,241,0.7), 0 0 26px rgba(99,102,241,0.35), 0 8px 32px rgba(0,0,0,0.6)'
    : '0 0 0 1px rgba(99,102,241,0.28), 0 0 16px rgba(99,102,241,0.15), 0 4px 24px rgba(0,0,0,0.6)';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 240,
        background: 'linear-gradient(145deg, rgba(12,10,28,0.97) 0%, rgba(18,14,42,0.97) 100%)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderTop: '2.5px solid #6366f1',
        borderRadius: 14,
        backdropFilter: 'blur(24px)',
        boxShadow: glow,
        transition: 'box-shadow 0.22s ease',
        fontFamily: 'inherit',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {/* Source handle → connects to profile module nodes */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 12, height: 12,
          background: '#6366f1',
          border: '2px solid rgba(120,130,255,0.4)',
          boxShadow: '0 0 10px #6366f1, 0 0 20px rgba(99,102,241,0.6)',
          right: -6,
        }}
      />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 6,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 0 10px rgba(99,102,241,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Zap size={10} color="#fff" />
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: '#a78bfa', textTransform: 'uppercase' }}>
            Artist Input
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 8, fontWeight: 700, padding: '1px 6px',
            borderRadius: 4, border: '1px solid rgba(99,102,241,0.35)',
            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
          }}>
            ROOT
          </span>
        </div>

        {/* Current artist card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 8px', borderRadius: 10,
          background: 'rgba(99,102,241,0.07)',
          border: '1px solid rgba(99,102,241,0.12)',
        }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
            border: '1.5px solid rgba(99,102,241,0.4)',
            boxShadow: '0 0 14px rgba(99,102,241,0.25)',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {hasImage ? (
              <img
                src={d.artistImage!}
                alt={d.artistName ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{initials}</span>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {d.artistName ?? 'Unknown Artist'}
            </p>
            {(d.artistGenre || d.artistCountry) && (
              <p style={{ fontSize: 9, color: '#64748b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[d.artistGenre, d.artistCountry].filter(Boolean).join(' · ')}
              </p>
            )}
            {d.artistSlug && (
              <p style={{ fontSize: 8, color: '#475569', margin: '1px 0 0' }}>/{d.artistSlug}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Artist switcher ──────────────────────────────────────────── */}
      <div style={{ padding: '8px 10px' }} ref={dropdownRef}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
            background: open ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.09)',
            border: `1px solid ${open ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.2)'}`,
            color: '#a78bfa', fontSize: 10, fontWeight: 600,
            transition: 'all 0.15s ease', outline: 'none',
          }}
        >
          <User size={10} />
          <span style={{ flex: 1, textAlign: 'left' }}>Switch Artist</span>
          <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        {/* Dropdown list */}
        {open && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 9999,
            marginBottom: 4, borderRadius: 10,
            background: 'rgba(10,10,22,0.98)',
            border: '1px solid rgba(99,102,241,0.35)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.8), 0 0 24px rgba(99,102,241,0.12)',
            backdropFilter: 'blur(24px)',
            overflow: 'hidden',
          }}>
            {/* Search input */}
            <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={10} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                <input
                  className="profile-root-search"
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search artists…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '5px 8px 5px 26px',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: 6, color: '#e2e8f0', fontSize: 10,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
              </div>
            </div>

            {/* Artist list */}
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: '14px', textAlign: 'center', color: '#475569', fontSize: 10 }}>
                  Loading artists…
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div style={{ padding: '14px', textAlign: 'center', color: '#475569', fontSize: 10 }}>
                  No artists found
                </div>
              )}
              {!loading && filtered.slice(0, 60).map(a => {
                const isCurrent = a.slug === d.artistSlug;
                return (
                  <button
                    key={a.id}
                    className="profile-root-list-item"
                    onClick={() => {
                      d.onArtistSelect(a.id, a.slug!);
                      setOpen(false);
                      setQuery('');
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 10px',
                      background: isCurrent ? 'rgba(99,102,241,0.2)' : 'transparent',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
                    }}
                  >
                    {/* Mini avatar */}
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {a.image ? (
                        <img src={a.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 8, fontWeight: 800, color: '#818cf8' }}>
                          {(a.artistName ?? '?').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: isCurrent ? '#a78bfa' : '#cbd5e1', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.artistName}
                      </p>
                      {a.genre && (
                        <p style={{ fontSize: 8, color: '#475569', margin: 0 }}>{a.genre}</p>
                      )}
                    </div>
                    {isCurrent && (
                      <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 800 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Status footer ────────────────────────────────────────────── */}
      <div style={{ padding: '2px 12px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#4ade80',
          animation: 'root-status-pulse 2s infinite',
        }} />
        <span style={{ fontSize: 8, color: '#475569', fontWeight: 600 }}>
          Profile Sync · {d.artistSlug ?? '—'}
        </span>
      </div>
    </div>
  );
});
