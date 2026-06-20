import { Link, useLocation } from 'wouter';
import { Target, Users2, Key, Shield } from 'lucide-react';
import { TOKENS } from '../artist-acquisition/shared/tokens';

/**
 * Cross-navigation strip shared across the three admin dashboards:
 *   /admin/artist-acquisition, /admin/boostify-alliances, /admin/artist-identity
 * Plus a link back to the main /admin hub.
 */
const LINKS: { href: string; label: string; icon: any }[] = [
  { href: '/admin', label: 'Admin', icon: Shield },
  { href: '/admin/artist-acquisition', label: 'Artist Acquisition', icon: Target },
  { href: '/admin/boostify-alliances', label: 'Boostify Alliances', icon: Users2 },
  { href: '/admin/artist-identity', label: 'Identity & Provisioning', icon: Key },
];

export function AdminCrossNav({ compact = false }: { compact?: boolean }) {
  const [location] = useLocation();
  return (
    <div className="flex items-center gap-1 overflow-x-auto custom-scroll">
      {LINKS.map((l) => {
        const Icon = l.icon;
        const active = location === l.href || (l.href !== '/admin' && location.startsWith(l.href));
        return (
          <Link key={l.href} href={l.href}>
            <a
              className={`flex items-center gap-1.5 shrink-0 rounded-md transition-colors ${compact ? 'px-2 py-1 text-[10.5px]' : 'px-2.5 py-1.5 text-[11.5px]'}`}
              style={{
                color: active ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
                background: active ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_3,
                border: `1px solid ${active ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
              }}
              data-testid={`cross-nav-${l.href}`}
            >
              <Icon size={compact ? 11 : 12} />
              <span className="hidden sm:inline">{l.label}</span>
            </a>
          </Link>
        );
      })}
    </div>
  );
}
