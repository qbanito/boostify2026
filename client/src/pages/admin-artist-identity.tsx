import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, Fingerprint, AtSign, Mail, Phone, Image as ImageIcon,
  Grid3x3, Rocket, ShieldCheck, UserCheck, Lock, Flame, Activity, CheckCircle2,
  Inbox, Scroll, Settings, Shield, Heart, Puzzle, Search, Play, X, Sparkles,
  AlertTriangle, ChevronRight, User, Menu,
  Instagram, Youtube, Facebook, Music2,
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { apiRequest } from '../lib/queryClient';
import { TOKENS } from '../components/artist-acquisition/shared/tokens';
import { AdminCrossNav } from '../components/admin-shared/AdminCrossNav';

// --------------------------------------------------------------------------
// Sidebar config
// --------------------------------------------------------------------------
const SIDEBAR: { id: string; label: string; icon: any; badge?: number }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'artists', label: 'Artistas', icon: Users },
  { id: 'identities', label: 'Identidades', icon: Fingerprint },
  { id: 'social', label: 'Cuentas Sociales', icon: Grid3x3 },
  { id: 'provisioning', label: 'Provisión', icon: Rocket },
  { id: 'verifications', label: 'Verificaciones', icon: ShieldCheck, badge: 12 },
  { id: 'warmup', label: 'Warm-up', icon: Flame },
  { id: 'health', label: 'Salud de Cuentas', icon: Heart },
  { id: 'incidents', label: 'Incidentes', icon: AlertTriangle, badge: 3 },
  { id: 'phones', label: 'Teléfonos', icon: Phone },
  { id: 'emails', label: 'Correos', icon: Mail },
  { id: 'templates', label: 'Plantillas', icon: Scroll },
  { id: 'settings', label: 'Configuración', icon: Settings },
  { id: 'audit', label: 'Auditoría', icon: Activity },
  { id: 'users', label: 'Usuarios', icon: User },
];

// --------------------------------------------------------------------------
// Status → color
// --------------------------------------------------------------------------
function statusColor(status: string): string {
  if (['active', 'profile_configured', 'secured', 'verified', 'completed'].includes(status)) return '#4ade80';
  if (['verification_pending', 'otp_required', 'warming', 'in_progress'].includes(status)) return '#fbbf24';
  if (['restricted', 'recovery_needed'].includes(status)) return '#ef4444';
  return TOKENS.MUTED;
}

function fmtStatus(s: string) {
  return s?.replace(/_/g, ' ');
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------
export default function AdminArtistIdentity() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['aiaps-overview'],
    queryFn: () => apiRequest('GET', '/api/admin/artist-identity/overview') as any,
    enabled: isAdmin === true,
    refetchInterval: 30000,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: TOKENS.BG_DEEP }}>
        <div className="text-sm" style={{ color: TOKENS.MUTED }}>Loading…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: TOKENS.BG_DEEP }}>
        <div className="max-w-md text-center p-8 rounded-lg" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
          <Shield size={32} className="mx-auto mb-3" style={{ color: TOKENS.ORANGE }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: TOKENS.TEXT }}>Admin access required</h2>
          <p className="text-sm mb-4" style={{ color: TOKENS.MUTED }}>This is the Boostify Artist Identity & Account Provisioning System.</p>
          <Link href="/admin"><span className="text-sm" style={{ color: TOKENS.ORANGE_GLOW }}>← Back to Admin</span></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: TOKENS.BG_DEEP, color: TOKENS.TEXT }}>
      <Sidebar active={activeNav} onSelect={setActiveNav} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} onRefresh={() => refetch()} onCreate={() => setCreateOpen(true)} />
        <div className="flex-1 overflow-y-auto custom-scroll">
          <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
            <AdminCrossNav />
            {isLoading && activeNav === 'dashboard' && (
              <div className="text-sm py-8 text-center" style={{ color: TOKENS.MUTED }}>Cargando…</div>
            )}
            {!isLoading && data?.ok && activeNav === 'dashboard' && <DashboardView data={data} onRefresh={() => refetch()} />}
            {activeNav !== 'dashboard' && <SectionView section={activeNav} overview={data} />}
          </div>
        </div>
      </main>
      {createOpen && <CreateArtistModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); refetch(); }} />}
    </div>
  );
}

// --------------------------------------------------------------------------
// Sidebar
// --------------------------------------------------------------------------
function Sidebar({ active, onSelect, open, onClose }: { active: string; onSelect: (id: string) => void; open: boolean; onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        className={`lg:hidden fixed inset-0 z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      />
      <aside
        className={`flex flex-col shrink-0 z-50 transition-transform duration-200 fixed lg:static top-0 left-0 bottom-0 w-[86vw] max-w-[280px] lg:w-[240px] ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
        style={{ background: TOKENS.SURFACE, borderRight: `1px solid ${TOKENS.BORDER}` }}
      >
        <div className="px-5 pt-5 pb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[20px] font-bold tracking-tight" style={{ color: TOKENS.TEXT }}>BOOSTIFY</div>
            <div className="text-[10px] tracking-[0.16em]" style={{ color: TOKENS.MUTED }}>M U S I C</div>
          </div>
          <button onClick={onClose} className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center" style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}><X size={15} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto custom-scroll px-3 pb-4 space-y-0.5">
          {SIDEBAR.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onSelect(item.id); onClose(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all"
                style={isActive ? {
                  background: 'linear-gradient(90deg, rgba(255,122,0,0.18) 0%, rgba(255,122,0,0.04) 100%)',
                  color: TOKENS.TEXT,
                  border: `1px solid ${TOKENS.ORANGE_RING}`,
                  boxShadow: '0 8px 20px -8px rgba(255,122,0,0.4)',
                } : { color: TOKENS.MUTED, border: '1px solid transparent' }}
              >
                <Icon size={16} strokeWidth={1.8} style={{ color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.MUTED }} />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: TOKENS.BORDER }}>
          <Link href="/admin">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer hover:bg-white/[0.03]" style={{ border: `1px solid ${TOKENS.BORDER}` }}>
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
                <Shield size={14} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate">Boostify Admin</div>
                <div className="text-[10px] truncate" style={{ color: TOKENS.MUTED }}>Super Admin</div>
              </div>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}

// --------------------------------------------------------------------------
// Topbar
// --------------------------------------------------------------------------
function Topbar({ onMenu, onRefresh, onCreate }: { onMenu: () => void; onRefresh: () => void; onCreate: () => void }) {
  return (
    <header
      className="h-[64px] shrink-0 flex items-center gap-3 px-4 md:px-6 sticky top-0 z-30"
      style={{ background: TOKENS.SURFACE, borderBottom: `1px solid ${TOKENS.BORDER}` }}
    >
      <button onClick={onMenu} className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center" style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}>
        <Menu size={16} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] md:text-[15px] font-bold tracking-tight truncate" style={{ color: TOKENS.TEXT }}>
          BOOSTIFY ARTIST IDENTITY & ACCOUNT PROVISIONING SYSTEM
        </div>
        <div className="text-[10.5px] truncate" style={{ color: TOKENS.MUTED }}>
          Sistema de creación, provisión y gestión de cuentas sociales para artistas
        </div>
      </div>
      <div className="hidden md:flex items-center gap-1.5">
        {[Instagram, Music2, Youtube, X, Facebook].map((Ic, i) => (
          <div key={i} className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
            <Ic size={13} style={{ color: TOKENS.MUTED }} />
          </div>
        ))}
        <span className="text-[10px] px-2" style={{ color: TOKENS.MUTED_2 }}>Y MÁS…</span>
      </div>
      <button onClick={onCreate} data-testid="aiaps-new-artist" className="text-[11.5px] px-3 py-1.5 rounded-md font-semibold" style={{ color: '#0a0a0a', background: TOKENS.ORANGE_GLOW, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
        + Nuevo Artista
      </button>
      <button
        onClick={async () => {
          if (!confirm('¿Generar imágenes (avatar + banner) para todos los artistas que no las tienen? Puede tardar varios minutos.')) return;
          const r = await runAction('/api/admin/artist-identity/artists/generate-missing-images');
          alert(`Procesados ${r?.processed || 0} artistas.`);
          onRefresh();
        }}
        className="text-[11.5px] px-3 py-1.5 rounded-md flex items-center gap-1"
        style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
        title="Generar imágenes faltantes con IA"
      >
        <ImageIcon size={12} /> Rellenar Imágenes
      </button>
      <button onClick={onRefresh} className="text-[11.5px] px-3 py-1.5 rounded-md" style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
        Refrescar
      </button>
    </header>
  );
}

// --------------------------------------------------------------------------
// Dashboard view
// --------------------------------------------------------------------------
function DashboardView({ data, onRefresh }: { data: any; onRefresh: () => void }) {
  return (
    <>
      <ArtistActionsBar artist={data.artist} onRefresh={onRefresh} />
      <FlowStrip flow={data.flow} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr] gap-3">
        <ArtistCard artist={data.artist} />
        <IdentityPackageCard artist={data.artist} />
        <PlatformAccountsCard accounts={data.accounts} />
        <WarmupProgressCard progress={data.warmupProgress} warmup={data.warmup} />
        <HealthAndAlerts health={data.health} incidents={data.incidents} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1fr_1.2fr] gap-3">
        <EmailsCard emails={data.emails} />
        <PhoneCard phone={data.phone} />
        <UsernamesCard usernames={data.usernames} />
        <VisualAssetsCard artist={data.artist} />
        <BiosCard artist={data.artist} />
      </div>

      <InboxCard verifications={data.verifications} />

      <ModulesStrip modules={data.modules} />

      <ArchitectureStrip providers={data.providers} />
    </>
  );
}

// --------------------------------------------------------------------------
// Flow strip (14 numbered steps)
// --------------------------------------------------------------------------
const FLOW_ICONS: Record<string, any> = {
  user: User, fingerprint: Fingerprint, at: AtSign, mail: Mail, phone: Phone,
  image: ImageIcon, grid: Grid3x3, rocket: Rocket, shield: ShieldCheck,
  'user-check': UserCheck, lock: Lock, flame: Flame, activity: Activity, check: CheckCircle2,
};
function FlowStrip({ flow }: { flow: any[] }) {
  return (
    <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.18em] font-semibold mb-2.5" style={{ color: TOKENS.MUTED_2 }}>FLUJO MAESTRO DEL SISTEMA</div>
      <div className="flex items-center gap-1 overflow-x-auto custom-scroll pb-1">
        {flow.map((s: any, i: number) => {
          const Icon = FLOW_ICONS[s.icon] || CheckCircle2;
          const isActive = s.n <= 12;
          return (
            <div key={s.id} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1.5 w-[78px]">
                <div className="relative w-10 h-10 rounded-lg flex items-center justify-center" style={{
                  background: isActive ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_3,
                  border: `1px solid ${isActive ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                }}>
                  <Icon size={14} style={{ color: isActive ? TOKENS.ORANGE_GLOW : TOKENS.MUTED }} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}>{s.n}</span>
                </div>
                <div className="text-[9.5px] text-center leading-tight font-medium" style={{ color: isActive ? TOKENS.TEXT : TOKENS.MUTED }}>{s.label}</div>
              </div>
              {i < flow.length - 1 && <ChevronRight size={12} className="shrink-0" style={{ color: TOKENS.MUTED_2 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Artist card
// --------------------------------------------------------------------------
function ArtistCard({ artist }: { artist: any }) {
  const score = artist.readiness_score || 0;
  const bannerStyle = artist.banner_url
    ? { backgroundImage: `url(${artist.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: 'linear-gradient(135deg, #2a1a3e 0%, #0c0d10 100%)' };
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="aspect-[4/3] relative" style={bannerStyle as any}>
        {artist.profile_image_url ? (
          <img src={artist.profile_image_url} alt={artist.stage_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: artist.banner_url ? 'rgba(0,0,0,0.35)' : 'transparent' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
              <User size={24} style={{ color: TOKENS.ORANGE_GLOW }} />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold tracking-tight">{artist.stage_name}</span>
          <CheckCircle2 size={12} style={{ color: '#60a5fa' }} />
        </div>
        <div className="flex gap-1">
          <span className="text-[9.5px] px-1.5 py-0.5 rounded" style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>{artist.artist_type}</span>
          <span className="text-[9.5px] px-1.5 py-0.5 rounded" style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>{artist.genre_primary}</span>
        </div>
        <div className="space-y-1 pt-1">
          <Row label="ID Interno" value={artist.id} />
          <Row label="País" value={artist.country} />
          <Row label="Idioma" value={artist.primary_language} />
          <Row label="Estado" value={<span style={{ color: '#4ade80' }}>● {fmtStatus(artist.launch_status)}</span>} />
        </div>
        <div className="pt-2 mt-2 border-t flex items-center justify-between" style={{ borderColor: TOKENS.BORDER }}>
          <span className="text-[10.5px]" style={{ color: TOKENS.MUTED }}>Readiness Score</span>
          <span className="relative">
            <span className="w-11 h-11 rounded-full flex items-center justify-center text-[12px] font-bold" style={{
              background: `conic-gradient(${TOKENS.ORANGE} ${score * 3.6}deg, ${TOKENS.SURFACE_3} 0)`,
              color: TOKENS.TEXT,
            }}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: TOKENS.SURFACE }}>{score}%</span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span style={{ color: TOKENS.MUTED }}>{label}</span>
      <span className="font-medium truncate ml-2" style={{ color: TOKENS.TEXT }}>{value || '—'}</span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Identity Package Card
// --------------------------------------------------------------------------
function IdentityPackageCard({ artist }: { artist: any }) {
  const aesthetic = Array.isArray(artist.aesthetic_keywords) ? artist.aesthetic_keywords : [];
  const markets = Array.isArray(artist.target_markets) ? artist.target_markets : [];
  const items = [
    { icon: Sparkles, label: 'Brand Voice', value: artist.brand_voice },
    { icon: ImageIcon, label: 'Aesthetic', value: aesthetic.join(', ') || artist.visual_style },
    { icon: Users, label: 'Target Audience', value: artist.audience_type },
    { icon: Grid3x3, label: 'Markets', value: markets.join(', ') },
    { icon: User, label: 'Bio Short', value: artist.short_bio, clamp: true },
    { icon: AtSign, label: 'Link Hub', value: artist.link_hub, mono: true },
  ];
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>ARTIST IDENTITY PACKAGE</div>
      <div className="space-y-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
                <Icon size={11} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>{it.label}</div>
                <div className={`text-[11.5px] font-medium ${it.clamp ? 'line-clamp-2' : 'truncate'}`} style={{ color: TOKENS.TEXT, fontFamily: it.mono ? 'ui-monospace, monospace' : undefined }}>{it.value || '—'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Platform Accounts Card
// --------------------------------------------------------------------------
const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, tiktok: Music2, youtube: Youtube, x: X, facebook: Facebook, spotify: Music2,
};
function PlatformAccountsCard({ accounts }: { accounts: any[] }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>CUENTAS POR PLATAFORMA</div>
      <div className="space-y-1.5">
        {accounts.map((a, i) => {
          const Icon = PLATFORM_ICONS[a.platform] || Grid3x3;
          return (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded-md" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: TOKENS.SURFACE_2 }}>
                <Icon size={11} style={{ color: TOKENS.MUTED }} />
              </div>
              <div className="flex-1 min-w-0 text-[11px] truncate">{a.username || '—'}</div>
              <span className="text-[9.5px] font-mono shrink-0" style={{ color: statusColor(a.status) }}>{fmtStatus(a.status)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Warm-up Progress
// --------------------------------------------------------------------------
function WarmupProgressCard({ progress, warmup }: { progress: any; warmup: any[] }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>WARM-UP PROGRESS</div>
        <span className="text-[11px] font-bold" style={{ color: TOKENS.ORANGE_GLOW }}>{progress.percent}%</span>
      </div>
      <div>
        <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>Fase Actual</div>
        <div className="text-[12px] font-semibold" style={{ color: TOKENS.TEXT }}>Fase {progress.phase} (Días {progress.phase === 1 ? '1-3' : progress.phase === 2 ? '4-7' : progress.phase === 3 ? '8-21' : '21+'})</div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: TOKENS.SURFACE_3 }}>
        <div className="h-full" style={{ width: `${progress.percent}%`, background: `linear-gradient(90deg, ${TOKENS.ORANGE} 0%, ${TOKENS.ORANGE_GLOW} 100%)` }} />
      </div>
      <div className="space-y-1 pt-1">
        {warmup.slice(0, 5).map((t, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 size={11} style={{ color: statusColor(t.status) }} />
            <span className="truncate" style={{ color: t.status === 'completed' ? TOKENS.TEXT : TOKENS.MUTED }}>{t.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Health + Alerts
// --------------------------------------------------------------------------
function HealthAndAlerts({ health, incidents }: { health: any; incidents: any[] }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="text-[10.5px] tracking-[0.14em] font-semibold mb-2" style={{ color: TOKENS.MUTED_2 }}>SALUD DE CUENTAS</div>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0" style={{
            background: `conic-gradient(#22c55e ${health.healthy * 90}deg, #fbbf24 ${health.healthy * 90}deg ${(health.healthy + health.warning) * 90}deg, #ef4444 ${(health.healthy + health.warning) * 90}deg ${(health.healthy + health.warning + health.risk) * 90}deg, ${TOKENS.SURFACE_3} 0)`,
          }}>
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-[13px] font-bold" style={{ background: TOKENS.SURFACE }}>{health.score}%</span>
          </div>
          <div className="flex-1 space-y-1 text-[10.5px]">
            <HealthLegend dot="#22c55e" label="Saludable" n={health.healthy} />
            <HealthLegend dot="#fbbf24" label="Advertencia" n={health.warning} />
            <HealthLegend dot="#ef4444" label="En Riesgo" n={health.risk} />
            <HealthLegend dot={TOKENS.MUTED} label="Inactiva" n={health.inactive} />
          </div>
        </div>
      </div>
      <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="text-[10.5px] tracking-[0.14em] font-semibold mb-2" style={{ color: TOKENS.MUTED_2 }}>ALERTAS ACTIVAS</div>
        <div className="space-y-1.5">
          {incidents.length === 0 && <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>Sin alertas.</div>}
          {incidents.slice(0, 4).map((i) => (
            <div key={i.id} className="flex items-center gap-2 text-[10.5px]">
              <AlertTriangle size={11} style={{ color: i.severity === 'warn' ? '#fbbf24' : '#60a5fa' }} />
              <span className="flex-1 truncate">{i.platform}: {i.title}</span>
              <span style={{ color: TOKENS.MUTED_2 }}>{i.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function HealthLegend({ dot, label, n }: { dot: string; label: string; n: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5" style={{ color: TOKENS.MUTED }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />{label}</span>
      <span className="font-semibold" style={{ color: TOKENS.TEXT }}>{n}</span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Smaller cards row
// --------------------------------------------------------------------------
function EmailsCard({ emails }: { emails: any[] }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>CORREOS ASIGNADOS</div>
      <div className="space-y-1.5">
        {emails.map((e, i) => (
          <div key={i} className="flex items-start gap-2">
            <Mail size={12} className="mt-0.5" style={{ color: TOKENS.ORANGE_GLOW }} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-mono truncate" style={{ color: TOKENS.TEXT }}>{e.address}</div>
              <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>{e.role === 'primary' ? 'Principal' : 'Recovery'} · <span style={{ color: statusColor(e.status) }}>{e.status}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneCard({ phone }: { phone: any }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>TELÉFONO ASIGNADO</div>
      {phone ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Phone size={12} style={{ color: TOKENS.ORANGE_GLOW }} />
            <div className="text-[12px] font-mono font-semibold">{phone.number}</div>
          </div>
          <div className="text-[10.5px]" style={{ color: TOKENS.MUTED }}>{phone.provider} · {phone.country}</div>
          <div className="text-[10.5px]" style={{ color: phone.active ? '#4ade80' : TOKENS.MUTED }}>● {phone.active ? 'Activo' : 'Inactivo'}</div>
        </div>
      ) : <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>Sin asignar</div>}
    </div>
  );
}

function UsernamesCard({ usernames }: { usernames: any[] }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>USERNAMES TOP</div>
      <div className="space-y-1">
        {usernames.map((u, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-mono truncate"><span style={{ color: TOKENS.MUTED_2 }}>{i + 1}.</span> {u.handle}</span>
            <span className="text-[10px] px-1.5 rounded-full shrink-0" style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>{u.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualAssetsCard({ artist }: { artist: any }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>ASSETS VISUALES</div>
      <div className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className="aspect-square rounded-md" style={{ background: `linear-gradient(135deg, #2a1a3e 0%, ${TOKENS.SURFACE_3} 100%)`, border: `1px solid ${TOKENS.BORDER}` }} />
        ))}
      </div>
      <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>+12 más</div>
    </div>
  );
}

function BiosCard({ artist }: { artist: any }) {
  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>BIOS POR PLATAFORMA</div>
      <div className="text-[11px] line-clamp-3" style={{ color: TOKENS.TEXT }}>{artist.short_bio}</div>
      <div className="flex items-center gap-1.5 pt-1">
        {[Instagram, Music2, Youtube, X].map((Ic, i) => (
          <div key={i} className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
            <Ic size={10} style={{ color: TOKENS.MUTED }} />
          </div>
        ))}
      </div>
      <div className="text-[10px]" style={{ color: TOKENS.ORANGE_GLOW }}>Ver todas las variantes</div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Inbox (verifications)
// --------------------------------------------------------------------------
function InboxCard({ verifications }: { verifications: any[] }) {
  return (
    <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>INBOX DE VERIFICACIONES</div>
        <span className="text-[10px]" style={{ color: TOKENS.ORANGE_GLOW }}>Ver todas ({verifications.length})</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {verifications.slice(0, 3).map((v) => {
          const Icon = PLATFORM_ICONS[v.platform] || Inbox;
          return (
            <div key={v.id} className="flex items-center gap-2 p-2 rounded-md" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
                <Icon size={12} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{v.subject}</div>
                <div className="text-[10px] font-mono" style={{ color: TOKENS.ORANGE_GLOW }}>{v.code}</div>
              </div>
              <span className="text-[9.5px] shrink-0" style={{ color: TOKENS.MUTED_2 }}>{v.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Modules strip
// --------------------------------------------------------------------------
const MODULE_ICONS: Record<string, any> = {
  identity: Fingerprint, username: AtSign, email: Mail, phone: Phone,
  provisioning: Rocket, inbox: Inbox, vault: Lock, warmup: Flame,
  health: Heart, compliance: ShieldCheck, audit: Scroll, extensions: Puzzle,
};
function ModulesStrip({ modules }: { modules: any[] }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.18em] font-semibold mb-2" style={{ color: TOKENS.MUTED_2 }}>MÓDULOS DEL SISTEMA</div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {modules.map((m) => {
          const Icon = MODULE_ICONS[m.id] || Puzzle;
          return (
            <div key={m.id} className="p-2.5 rounded-lg hover:border-orange-500/30 transition-colors cursor-pointer" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
              <div className="w-7 h-7 rounded-md flex items-center justify-center mb-2" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
                <Icon size={13} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="text-[11.5px] font-semibold leading-tight truncate">{m.name}</div>
              <div className="text-[9.5px] mt-0.5 line-clamp-2" style={{ color: TOKENS.MUTED }}>{m.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Architecture strip
// --------------------------------------------------------------------------
function ArchitectureStrip({ providers }: { providers: any }) {
  const arch = [
    { icon: '⚛', label: 'Frontend', sub: 'React / Next.js' },
    { icon: '⬢', label: 'Backend', sub: 'Node.js / Python' },
    { icon: '🗄', label: 'Database', sub: 'Firestore / Postgres' },
    { icon: '🔑', label: 'Secrets', sub: 'Vault / KMS' },
    { icon: '⚡', label: 'Integraciones', sub: 'APIs / Webhooks' },
  ];
  const integ = [
    { label: 'Twilio', ok: providers.twilio },
    { label: 'SendGrid', ok: providers.sendgrid },
    { label: 'Cloudinary', ok: providers.cloudinary },
    { label: 'Firebase', ok: providers.firestore },
    { label: 'OpenAI', ok: providers.openai },
    { label: 'Brevo', ok: providers.brevo },
    { label: 'Resend', ok: providers.resend },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="text-[10.5px] tracking-[0.18em] font-semibold mb-2" style={{ color: TOKENS.MUTED_2 }}>ARQUITECTURA</div>
        <div className="flex items-center gap-1 overflow-x-auto custom-scroll">
          {arch.map((a, i) => (
            <div key={i} className="flex items-center shrink-0">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
                <span className="text-[13px]" style={{ color: TOKENS.ORANGE_GLOW }}>{a.icon}</span>
                <div>
                  <div className="text-[11px] font-semibold leading-tight">{a.label}</div>
                  <div className="text-[9.5px]" style={{ color: TOKENS.MUTED }}>{a.sub}</div>
                </div>
              </div>
              {i < arch.length - 1 && <ChevronRight size={11} className="shrink-0" style={{ color: TOKENS.MUTED_2 }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="text-[10.5px] tracking-[0.18em] font-semibold mb-2" style={{ color: TOKENS.MUTED_2 }}>INTEGRACIONES CLAVE</div>
        <div className="flex flex-wrap gap-1.5">
          {integ.map((i) => (
            <span key={i.label} className="text-[10.5px] px-2 py-1 rounded-md flex items-center gap-1.5" style={{
              background: TOKENS.SURFACE_3,
              border: `1px solid ${i.ok ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
              color: i.ok ? TOKENS.TEXT : TOKENS.MUTED,
            }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: i.ok ? '#4ade80' : TOKENS.MUTED_2 }} />
              {i.label}
            </span>
          ))}
          <span className="text-[10.5px] px-2 py-1" style={{ color: TOKENS.MUTED_2 }}>Y más…</span>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Section views — one per sidebar entry
// --------------------------------------------------------------------------
const SECTION_ENDPOINTS: Record<string, string> = {
  artists: '/api/admin/artist-identity/artists',
  identities: '/api/admin/artist-identity/artists',
  social: '/api/admin/artist-identity/social-accounts',
  provisioning: '/api/admin/artist-identity/social-accounts',
  verifications: '/api/admin/artist-identity/verifications',
  warmup: '/api/admin/artist-identity/warmup',
  health: '/api/admin/artist-identity/health',
  incidents: '/api/admin/artist-identity/incidents',
  phones: '/api/admin/artist-identity/phones',
  emails: '/api/admin/artist-identity/emails',
};

const SECTION_TITLES: Record<string, string> = {
  artists: 'Artistas',
  identities: 'Identidades creadas',
  social: 'Cuentas Sociales',
  provisioning: 'Estados de Provisión',
  verifications: 'Verificaciones OTP',
  warmup: 'Warm-up Tasks',
  health: 'Salud de Cuentas',
  incidents: 'Incidentes',
  phones: 'Teléfonos asignados',
  emails: 'Correos y Recuperación',
  templates: 'Plantillas por Plataforma',
  settings: 'Configuración',
  audit: 'Audit Logs',
  users: 'Usuarios del sistema',
};

function SectionView({ section, overview }: { section: string; overview: any }) {
  const endpoint = SECTION_ENDPOINTS[section];
  const { data, isLoading } = useQuery<any>({
    queryKey: ['aiaps-section', section],
    queryFn: () => (endpoint ? (apiRequest('GET', endpoint) as any) : Promise.resolve(null)),
    enabled: !!endpoint,
  });
  const items = data?.items || [];
  const title = SECTION_TITLES[section] || section;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10.5px] tracking-[0.18em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>
            MÓDULO
          </div>
          <div className="text-[18px] font-bold tracking-tight" style={{ color: TOKENS.TEXT }}>{title}</div>
        </div>
        {endpoint && (
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
            {items.length} registros
          </span>
        )}
      </div>

      {isLoading && endpoint && (
        <div className="text-sm py-8 text-center" style={{ color: TOKENS.MUTED }}>Cargando…</div>
      )}

      {section === 'artists' && <ArtistsTable items={items} />}
      {section === 'identities' && <IdentitiesGrid items={items} />}
      {section === 'social' && <SocialAccountsTable items={items} />}
      {section === 'provisioning' && <ProvisioningBoard items={items} />}
      {section === 'verifications' && <VerificationsTable items={items} />}
      {section === 'warmup' && <WarmupTable items={items} />}
      {section === 'health' && <HealthTable items={items} accounts={overview?.accounts || []} />}
      {section === 'incidents' && <IncidentsTable items={items} />}
      {section === 'phones' && <PhonesTable items={items} />}
      {section === 'emails' && <EmailsTable items={items} />}
      {section === 'templates' && <TemplatesView />}
      {section === 'settings' && <SettingsView overview={overview} />}
      {section === 'audit' && <AuditView />}
      {section === 'users' && <UsersView />}
    </div>
  );
}

// ---- Shared table primitives --------------------------------------------
function TableShell({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr style={{ background: TOKENS.SURFACE_2, borderBottom: `1px solid ${TOKENS.BORDER}` }}>
              {headers.map((h) => (
                <th key={h} className="text-left px-3 py-2 font-semibold tracking-wide" style={{ color: TOKENS.MUTED }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
function EmptyRow({ cols, label = 'Sin datos' }: { cols: number; label?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center" style={{ color: TOKENS.MUTED }}>{label}</td>
    </tr>
  );
}
function StatusPill({ status }: { status: string }) {
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ color: statusColor(status), background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
      ● {fmtStatus(status)}
    </span>
  );
}

// ---- Artists ------------------------------------------------------------
function ArtistAvatar({ url, name, size = 32 }: { url?: string; name?: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || ''}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${TOKENS.BORDER}` }}
      />
    );
  }
  const initials = (name || '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="flex items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: TOKENS.ORANGE_SOFT,
        border: `1px solid ${TOKENS.ORANGE_RING}`,
        color: TOKENS.ORANGE_GLOW,
        fontSize: size * 0.38,
      }}
    >
      {initials}
    </div>
  );
}

function ArtistsTable({ items }: { items: any[] }) {
  return (
    <TableShell headers={['', 'ID', 'Nombre', 'País', 'Género', 'Estado', 'Readiness', 'Actualizado']}>
      {items.length === 0 && <EmptyRow cols={8} />}
      {items.map((a) => (
        <tr key={a.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-2 py-2"><ArtistAvatar url={a.profile_image_url} name={a.stage_name} size={28} /></td>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{a.id}</td>
          <td className="px-3 py-2 font-semibold">{a.stage_name}</td>
          <td className="px-3 py-2">{a.country || '—'}</td>
          <td className="px-3 py-2">{a.genre_primary || '—'}</td>
          <td className="px-3 py-2"><StatusPill status={a.launch_status || 'draft'} /></td>
          <td className="px-3 py-2" style={{ color: TOKENS.ORANGE_GLOW }}>{a.readiness_score || 0}%</td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{new Date(a.updated_at).toLocaleDateString()}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Identities (card grid) ---------------------------------------------
function IdentitiesGrid({ items }: { items: any[] }) {
  if (!items.length) return <EmptyState label="Sin identidades creadas." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((a) => {
        const bannerStyle = a.banner_url
          ? { backgroundImage: `url(${a.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #2a1a3e 0%, #0c0d10 100%)' };
        return (
          <div key={a.id} className="rounded-lg overflow-hidden" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
            <div className="h-20 relative" style={bannerStyle as any}>
              <div className="absolute -bottom-5 left-3">
                <ArtistAvatar url={a.profile_image_url} name={a.stage_name} size={44} />
              </div>
            </div>
            <div className="p-3 pt-6 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{a.stage_name}</div>
                  <div className="text-[10px] font-mono" style={{ color: TOKENS.MUTED }}>{a.id}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>{a.readiness_score || 0}%</span>
              </div>
              <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>{a.country || '—'} · {a.genre_primary || '—'}</div>
              <StatusPill status={a.launch_status || 'draft'} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Social accounts ----------------------------------------------------
function SocialAccountsTable({ items }: { items: any[] }) {
  return (
    <TableShell headers={['Artista', 'Plataforma', 'Username', 'Estado', 'Email', 'Phone', 'Actualizado']}>
      {items.length === 0 && <EmptyRow cols={7} />}
      {items.map((s) => {
        const Icon = PLATFORM_ICONS[s.platform] || Grid3x3;
        return (
          <tr key={s.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
            <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{s.artist_id}</td>
            <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><Icon size={11} style={{ color: TOKENS.ORANGE_GLOW }} />{s.platform}</span></td>
            <td className="px-3 py-2 font-mono">{s.username || '—'}</td>
            <td className="px-3 py-2"><StatusPill status={s.status} /></td>
            <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{s.email_asset_id ?? '—'}</td>
            <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{s.phone_asset_id ?? '—'}</td>
            <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{new Date(s.updated_at).toLocaleDateString()}</td>
          </tr>
        );
      })}
    </TableShell>
  );
}

// ---- Provisioning kanban ------------------------------------------------
function ProvisioningBoard({ items }: { items: any[] }) {
  const COLS = ['draft', 'identity_ready', 'pending_signup', 'verification_pending', 'profile_configured', 'secured', 'warming', 'active'];
  const grouped: Record<string, any[]> = {};
  COLS.forEach((c) => (grouped[c] = []));
  items.forEach((i) => {
    const bucket = COLS.includes(i.status) ? i.status : 'draft';
    grouped[bucket].push(i);
  });
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {COLS.map((c) => (
        <div key={c} className="rounded-lg p-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] tracking-wide font-semibold" style={{ color: statusColor(c) }}>{fmtStatus(c).toUpperCase()}</span>
            <span className="text-[10px]" style={{ color: TOKENS.MUTED }}>{grouped[c].length}</span>
          </div>
          <div className="space-y-1">
            {grouped[c].slice(0, 6).map((s) => (
              <div key={s.id} className="p-1.5 rounded text-[10.5px]" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
                <div className="font-mono truncate">{s.username || s.artist_id}</div>
                <div style={{ color: TOKENS.MUTED }}>{s.platform}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Verifications ------------------------------------------------------
function VerificationsTable({ items }: { items: any[] }) {
  return (
    <TableShell headers={['Artista', 'Plataforma', 'Canal', 'Asunto', 'Código', 'Estado', 'Recibido']}>
      {items.length === 0 && <EmptyRow cols={7} />}
      {items.map((v) => (
        <tr key={v.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{v.artist_id}</td>
          <td className="px-3 py-2">{v.platform}</td>
          <td className="px-3 py-2 uppercase" style={{ color: TOKENS.MUTED }}>{v.channel}</td>
          <td className="px-3 py-2 truncate max-w-[240px]">{v.subject}</td>
          <td className="px-3 py-2 font-mono font-bold" style={{ color: TOKENS.ORANGE_GLOW }}>{v.code}</td>
          <td className="px-3 py-2"><StatusPill status={v.status} /></td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{new Date(v.received_at).toLocaleString()}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Warm-up ------------------------------------------------------------
function WarmupTable({ items }: { items: any[] }) {
  return (
    <TableShell headers={['Artista', 'Plataforma', 'Fase', 'Acción', 'Prioridad', 'Riesgo', 'Estado']}>
      {items.length === 0 && <EmptyRow cols={7} />}
      {items.map((w) => (
        <tr key={w.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{w.artist_id}</td>
          <td className="px-3 py-2">{w.platform || '—'}</td>
          <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>Fase {w.phase}</span></td>
          <td className="px-3 py-2">{w.action}</td>
          <td className="px-3 py-2 uppercase text-[10px]" style={{ color: TOKENS.MUTED }}>{w.priority}</td>
          <td className="px-3 py-2 uppercase text-[10px]" style={{ color: TOKENS.MUTED }}>{w.risk}</td>
          <td className="px-3 py-2"><StatusPill status={w.status} /></td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Health -------------------------------------------------------------
function HealthTable({ items, accounts }: { items: any[]; accounts: any[] }) {
  const rows = items.length ? items : accounts.map((a, i) => ({
    id: i,
    artist_id: a.artist_id || '—',
    platform: a.platform,
    health_score: ['active', 'profile_configured', 'secured'].includes(a.status) ? 100 : ['verification_pending', 'warming'].includes(a.status) ? 70 : ['restricted'].includes(a.status) ? 20 : 50,
    status: a.status,
    reported_at: new Date().toISOString(),
  }));
  return (
    <TableShell headers={['Artista', 'Plataforma', 'Score', 'Estado', 'Último reporte']}>
      {rows.length === 0 && <EmptyRow cols={5} />}
      {rows.map((h: any) => (
        <tr key={h.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{h.artist_id}</td>
          <td className="px-3 py-2">{h.platform}</td>
          <td className="px-3 py-2 font-bold" style={{ color: h.health_score >= 80 ? '#4ade80' : h.health_score >= 50 ? '#fbbf24' : '#ef4444' }}>{h.health_score}</td>
          <td className="px-3 py-2"><StatusPill status={h.status} /></td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{new Date(h.reported_at).toLocaleString()}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Incidents ----------------------------------------------------------
function IncidentsTable({ items }: { items: any[] }) {
  const resolve = async (id: number) => {
    try { await apiRequest('POST', `/api/admin/artist-identity/incidents/${id}/resolve`); } catch {}
    window.location.reload();
  };
  return (
    <TableShell headers={['Artista', 'Plataforma', 'Severidad', 'Título', 'Estado', 'Creado', '']}>
      {items.length === 0 && <EmptyRow cols={7} />}
      {items.map((i) => (
        <tr key={i.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{i.artist_id || '—'}</td>
          <td className="px-3 py-2">{i.platform || '—'}</td>
          <td className="px-3 py-2 uppercase text-[10px]" style={{ color: i.severity === 'warn' ? '#fbbf24' : i.severity === 'critical' ? '#ef4444' : '#60a5fa' }}>{i.severity}</td>
          <td className="px-3 py-2">{i.title}</td>
          <td className="px-3 py-2"><StatusPill status={i.status} /></td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{new Date(i.created_at).toLocaleDateString()}</td>
          <td className="px-3 py-2">
            {i.status === 'open' && (
              <button onClick={() => resolve(i.id)} className="text-[10px] px-2 py-1 rounded-md" style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>Resolver</button>
            )}
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Phones -------------------------------------------------------------
function PhonesTable({ items }: { items: any[] }) {
  return (
    <TableShell headers={['Artista', 'Número', 'Proveedor', 'País', 'Propósito', 'Plataformas', 'Activo']}>
      {items.length === 0 && <EmptyRow cols={7} />}
      {items.map((p) => (
        <tr key={p.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{p.artist_id || '—'}</td>
          <td className="px-3 py-2 font-mono font-semibold">{p.number}</td>
          <td className="px-3 py-2">{p.provider}</td>
          <td className="px-3 py-2">{p.country}</td>
          <td className="px-3 py-2">{p.purpose}</td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{Array.isArray(p.platforms) ? p.platforms.join(', ') : '—'}</td>
          <td className="px-3 py-2" style={{ color: p.active ? '#4ade80' : TOKENS.MUTED }}>● {p.active ? 'Sí' : 'No'}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Emails -------------------------------------------------------------
function EmailsTable({ items }: { items: any[] }) {
  return (
    <TableShell headers={['Artista', 'Rol', 'Dirección', 'Proveedor', 'Estado', 'Verificado']}>
      {items.length === 0 && <EmptyRow cols={6} />}
      {items.map((e) => (
        <tr key={e.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{e.artist_id}</td>
          <td className="px-3 py-2 uppercase text-[10px]" style={{ color: TOKENS.ORANGE_GLOW }}>{e.role}</td>
          <td className="px-3 py-2 font-mono">{e.address}</td>
          <td className="px-3 py-2">{e.provider || '—'}</td>
          <td className="px-3 py-2"><StatusPill status={e.status} /></td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{e.verified_at ? new Date(e.verified_at).toLocaleDateString() : '—'}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Templates ----------------------------------------------------------
function TemplatesView() {
  const templates = [
    { platform: 'instagram', bio: 'Cantante y compositora · Dark Pop Cinematic · link ↓', category: 'Musician/Band', cta: 'Listen now' },
    { platform: 'tiktok', bio: 'Dark-pop 🔮 new drop → bio', category: 'Music', cta: 'Follow for drops' },
    { platform: 'youtube', bio: 'Official channel. Cinematic dark pop. New music every month.', category: 'Music', cta: 'Subscribe' },
    { platform: 'x', bio: 'Dark pop artist. Cinematic music & visuals.', category: 'Music', cta: 'Follow' },
    { platform: 'spotify', bio: 'Cinematic dark pop from the Boostify ecosystem.', category: 'Artist', cta: 'Save artist' },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {templates.map((t) => {
        const Icon = PLATFORM_ICONS[t.platform] || Grid3x3;
        return (
          <div key={t.platform} className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
                <Icon size={13} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="text-[13px] font-bold capitalize">{t.platform}</div>
            </div>
            <Row label="Categoría" value={t.category} />
            <Row label="CTA" value={t.cta} />
            <div>
              <div className="text-[10px]" style={{ color: TOKENS.MUTED }}>Bio</div>
              <div className="text-[11.5px]">{t.bio}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Settings -----------------------------------------------------------
function SettingsView({ overview }: { overview: any }) {
  const providers = overview?.providers || {};
  const platforms = overview?.platforms || [];
  const { data: diag, refetch: refetchDiag, isFetching: diagLoading } = useQuery<any>({
    queryKey: ['aiaps-diagnostic'],
    queryFn: () => apiRequest('GET', '/api/admin/artist-identity/diagnostic') as any,
    refetchInterval: 60_000,
  });
  const checks = diag?.checks || [];
  const score = diag?.score ?? null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="flex items-center justify-between">
          <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>DIAGNÓSTICO DEL SISTEMA</div>
          <button
            onClick={() => refetchDiag()}
            disabled={diagLoading}
            className="text-[10.5px] px-2 py-1 rounded"
            style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}`, color: TOKENS.ORANGE_GLOW }}
          >
            {diagLoading ? '...' : 'Recargar'}
          </button>
        </div>
        {score !== null && (
          <div className="text-[22px] font-bold" style={{ color: score >= 90 ? '#4ade80' : score >= 70 ? '#facc15' : '#f87171' }}>
            {score}<span className="text-[12px]" style={{ color: TOKENS.MUTED }}> / 100</span>
          </div>
        )}
        <div className="space-y-1 max-h-[260px] overflow-auto">
          {checks.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between text-[11px]">
              <span className="truncate flex-1">
                <span style={{ color: c.ok ? '#4ade80' : (c.severity === 'critical' ? '#f87171' : '#facc15') }}>
                  {c.ok ? '●' : '●'}
                </span>{' '}
                {c.label}
              </span>
              <span className="font-mono text-[9.5px]" style={{ color: TOKENS.MUTED }}>{c.detail || ''}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>PROVEEDORES</div>
        <div className="space-y-1.5">
          {Object.entries(providers).map(([k, v]: any) => (
            <div key={k} className="flex items-center justify-between text-[11.5px]">
              <span className="capitalize">{k}</span>
              <span style={{ color: v ? '#4ade80' : TOKENS.MUTED }}>● {v ? 'Conectado' : 'No configurado'}</span>
            </div>
          ))}
        </div>
        <div className="text-[10.5px] tracking-[0.14em] font-semibold pt-2" style={{ color: TOKENS.MUTED_2 }}>PLATAFORMAS</div>
        <div className="space-y-1.5">
          {platforms.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between text-[11.5px]">
              <span>{p.name}</span>
              <span style={{ color: p.enabled ? '#4ade80' : TOKENS.MUTED }}>● {p.enabled ? 'Activa' : 'Disponible'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Audit --------------------------------------------------------------
function AuditView() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['aiaps-audit'],
    queryFn: () => apiRequest('GET', '/api/admin/artist-identity/audit?limit=100') as any,
  });
  const items = data?.items || data?.logs || [];
  if (isLoading) return <div className="text-sm py-8 text-center" style={{ color: TOKENS.MUTED }}>Cargando…</div>;
  if (!items.length) return <EmptyState label="Sin entradas de auditoría." />;
  return (
    <TableShell headers={['Acción', 'Operador', 'Target', 'IP', 'Cuándo']}>
      {items.slice(0, 100).map((l: any, i: number) => (
        <tr key={i} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
          <td className="px-3 py-2 font-mono text-[10.5px]">{l.action}</td>
          <td className="px-3 py-2">{l.actorEmail || l.actor_email || '—'}</td>
          <td className="px-3 py-2 font-mono" style={{ color: TOKENS.MUTED }}>{l.targetType || l.target_type}:{l.targetId || l.target_id || ''}</td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{l.ip || '—'}</td>
          <td className="px-3 py-2" style={{ color: TOKENS.MUTED }}>{l.createdAt ? new Date(l.createdAt).toLocaleString() : ''}</td>
        </tr>
      ))}
    </TableShell>
  );
}

// ---- Users --------------------------------------------------------------
function UsersView() {
  const { data, refetch } = useQuery<any>({
    queryKey: ['aiaps-operators'],
    queryFn: () => apiRequest('GET', '/api/admin/artist-identity/operators') as any,
  });
  const operators = data?.items || [];
  const [inviteOpen, setInviteOpen] = useState(false);

  const roles = [
    { id: 'superadmin', name: 'Super Admin', desc: 'Acceso total al sistema', icon: Shield },
    { id: 'operator', name: 'Account Operator', desc: 'Gestiona creación y verificación', icon: UserCheck },
    { id: 'compliance', name: 'Compliance Operator', desc: 'Revisa políticas y cumplimiento', icon: ShieldCheck },
    { id: 'manager', name: 'Artist Manager', desc: 'Administra artistas asignados', icon: Users },
    { id: 'auditor', name: 'Read-only Auditor', desc: 'Lectura de logs y reportes', icon: Scroll },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10.5px] tracking-[0.14em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>OPERADORES ACTIVOS ({operators.length})</div>
        <button
          onClick={() => setInviteOpen(true)}
          className="text-[11px] px-2.5 py-1.5 rounded"
          style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}`, color: TOKENS.ORANGE_GLOW }}
        >
          + Invitar Operador
        </button>
      </div>

      {operators.length > 0 && (
        <TableShell headers={['Email', 'Rol', 'Estado', 'Plataformas', 'Creado']}>
          {operators.map((op: any) => (
            <tr key={op.id} className="border-t" style={{ borderColor: TOKENS.BORDER }}>
              <td className="px-3 py-2 font-mono text-[11px]">{op.email}</td>
              <td className="px-3 py-2">{op.role}</td>
              <td className="px-3 py-2" style={{ color: op.active ? '#4ade80' : TOKENS.MUTED }}>
                {op.active ? '● Activo' : '○ Suspendido'}
              </td>
              <td className="px-3 py-2 text-[10.5px]" style={{ color: TOKENS.MUTED }}>
                {Array.isArray(op.allowed_platforms) ? op.allowed_platforms.join(',') : '—'}
              </td>
              <td className="px-3 py-2 text-[10.5px]" style={{ color: TOKENS.MUTED }}>
                {op.created_at ? new Date(op.created_at).toLocaleDateString() : ''}
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <div className="text-[10.5px] tracking-[0.14em] font-semibold pt-2" style={{ color: TOKENS.MUTED_2 }}>ROLES DISPONIBLES</div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {roles.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.id} className="rounded-lg p-3 space-y-2" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
                  <Icon size={14} style={{ color: TOKENS.ORANGE_GLOW }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{r.name}</div>
                  <div className="text-[10px] font-mono" style={{ color: TOKENS.MUTED }}>{r.id}</div>
                </div>
              </div>
              <div className="text-[11px]" style={{ color: TOKENS.MUTED }}>{r.desc}</div>
            </div>
          );
        })}
      </div>

      {inviteOpen && <InviteOperatorModal onClose={() => setInviteOpen(false)} onSaved={() => { setInviteOpen(false); refetch(); }} />}
    </div>
  );
}

function InviteOperatorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operator');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await runAction('/api/admin/artist-identity/operators', { email, role, display_name: name });
      onSaved();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-lg p-4 space-y-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold">Invitar Operador</div>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <Field label="Email" value={email} onChange={setEmail} placeholder="operador@boostify.com" />
        <Field label="Nombre" value={name} onChange={setName} />
        <div>
          <div className="text-[10.5px] tracking-[0.14em] font-semibold mb-1" style={{ color: TOKENS.MUTED_2 }}>ROL</div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded text-[12px]"
            style={{ background: TOKENS.BG, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.FG }}
          >
            <option value="superadmin">Super Admin</option>
            <option value="operator">Account Operator</option>
            <option value="compliance">Compliance</option>
            <option value="manager">Artist Manager</option>
            <option value="auditor">Auditor (read-only)</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded" style={{ border: `1px solid ${TOKENS.BORDER}` }}>Cancelar</button>
          <button
            onClick={submit}
            disabled={busy || !email}
            className="text-[11px] px-3 py-1.5 rounded"
            style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}`, color: TOKENS.ORANGE_GLOW }}
          >
            {busy ? 'Guardando…' : 'Invitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg py-10 text-center" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}>
      {label}
    </div>
  );
}

// --------------------------------------------------------------------------
// Action helpers
// --------------------------------------------------------------------------
async function runAction(url: string, body?: any): Promise<any> {
  try {
    return await apiRequest('POST', url, body);
  } catch (err: any) {
    alert('Error: ' + (err?.message || 'desconocido'));
    throw err;
  }
}

// --------------------------------------------------------------------------
// Artist Actions Bar (Dashboard) — real action buttons that drive the engines
// --------------------------------------------------------------------------
function ArtistActionsBar({ artist, onRefresh }: { artist: any; onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const exec = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    setLastResult(null);
    try {
      await fn();
      setLastResult(`✓ ${ok}`);
      onRefresh();
    } catch {
      setLastResult('✗ Falló');
    } finally {
      setBusy(null);
    }
  };

  const id = artist?.id;
  const actions = [
    { key: 'identity', label: 'Generar Identidad (AI)', icon: Sparkles, run: () => runAction(`/api/admin/artist-identity/artists/${id}/generate-identity`) },
    { key: 'usernames', label: 'Generar Usernames', icon: AtSign, run: () => runAction(`/api/admin/artist-identity/artists/${id}/generate-usernames`, { platforms: ['instagram', 'tiktok'] }) },
    { key: 'emails', label: 'Provisionar Correos', icon: Mail, run: () => runAction(`/api/admin/artist-identity/artists/${id}/provision-emails`) },
    { key: 'phone', label: 'Comprar Teléfono', icon: Phone, run: () => runAction(`/api/admin/artist-identity/artists/${id}/purchase-phone`, { country: 'US', platforms: ['instagram', 'tiktok'] }) },
    { key: 'images', label: 'Generar Imágenes (AI)', icon: ImageIcon, run: () => runAction(`/api/admin/artist-identity/artists/${id}/generate-images`) },
    { key: 'warmup', label: 'Generar Warm-up (F1)', icon: Flame, run: () => runAction(`/api/admin/artist-identity/artists/${id}/warmup/generate`, { platform: 'instagram', phase: 1 }) },
    { key: 'readiness', label: 'Recalcular Readiness', icon: Activity, run: () => runAction(`/api/admin/artist-identity/artists/${id}/recompute-readiness`) },
    { key: 'health', label: 'Snapshot Salud', icon: Heart, run: () => runAction('/api/admin/artist-identity/health/snapshot', { artist_id: id }) },
  ];

  if (!id) return null;

  return (
    <div className="rounded-lg p-3" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] tracking-[0.18em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>
          ACCIONES SOBRE {artist.stage_name}
        </div>
        {lastResult && (
          <span className="text-[10.5px]" style={{ color: lastResult.startsWith('✓') ? '#4ade80' : '#ef4444' }}>
            {lastResult}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((a) => {
          const Icon = a.icon;
          const isBusy = busy === a.key;
          return (
            <button
              key={a.key}
              disabled={!!busy}
              onClick={() => exec(a.key, a.run, a.label)}
              data-testid={`aiaps-action-${a.key}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-opacity disabled:opacity-50"
              style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
            >
              <Icon size={12} />
              {isBusy ? 'Ejecutando…' : a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Create Artist Modal
// --------------------------------------------------------------------------
function CreateArtistModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [id, setId] = useState('');
  const [stageName, setStageName] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');
  const [bio, setBio] = useState('');
  const [generateIdentity, setGenerateIdentity] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const autoId = () => {
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    setId(`BTF_${rand}`);
  };

  const submit = async () => {
    if (!id || !stageName) {
      setErr('ID y Nombre artístico son obligatorios');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiRequest('POST', '/api/admin/artist-identity/artists', {
        id,
        stage_name: stageName,
        country: country || null,
        genre_primary: genre || null,
        short_bio: bio || null,
      });
      if (generateIdentity) {
        try { await apiRequest('POST', `/api/admin/artist-identity/artists/${id}/generate-identity`); } catch {}
      }
      onCreated();
    } catch (e: any) {
      setErr(e?.message || 'Error al crear');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-[520px] rounded-xl p-5" style={{ background: TOKENS.SURFACE, border: `1px solid ${TOKENS.BORDER}` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10.5px] tracking-[0.18em] font-semibold" style={{ color: TOKENS.MUTED_2 }}>AIAPS</div>
            <div className="text-[18px] font-bold">Nuevo Artista</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center" style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}><X size={14} /></button>
        </div>

        <div className="space-y-3">
          <Field label="ID interno" hint="p.ej. BTF_0002" right={<button onClick={autoId} className="text-[10px]" style={{ color: TOKENS.ORANGE_GLOW }}>Auto</button>}>
            <input value={id} onChange={(e) => setId(e.target.value)} className="w-full bg-transparent text-[13px] outline-none" placeholder="BTF_0002" />
          </Field>
          <Field label="Nombre artístico">
            <input value={stageName} onChange={(e) => setStageName(e.target.value)} className="w-full bg-transparent text-[13px] outline-none" placeholder="LUNA VANTA" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="País">
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full bg-transparent text-[13px] outline-none" placeholder="Estados Unidos" />
            </Field>
            <Field label="Género principal">
              <input value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-transparent text-[13px] outline-none" placeholder="Dark Pop" />
            </Field>
          </div>
          <Field label="Bio corta">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full bg-transparent text-[13px] outline-none resize-none" placeholder="Explora la oscuridad, la belleza y la emoción…" />
          </Field>

          <label className="flex items-center gap-2 text-[12px]" style={{ color: TOKENS.MUTED }}>
            <input type="checkbox" checked={generateIdentity} onChange={(e) => setGenerateIdentity(e.target.checked)} />
            Generar identidad completa con AI al crear
          </label>

          {err && <div className="text-[11px]" style={{ color: '#ef4444' }}>{err}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-[12px] px-3 py-1.5 rounded-md" style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}>
              Cancelar
            </button>
            <button onClick={submit} disabled={busy} data-testid="aiaps-create-submit" className="text-[12px] px-3 py-1.5 rounded-md font-semibold disabled:opacity-50" style={{ color: '#0a0a0a', background: TOKENS.ORANGE_GLOW, border: `1px solid ${TOKENS.ORANGE_RING}` }}>
              {busy ? 'Creando…' : 'Crear Artista'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, right, children }: { label: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}>
      <div className="flex items-center justify-between mb-0.5">
        <div className="text-[10px] tracking-wide" style={{ color: TOKENS.MUTED_2 }}>{label.toUpperCase()}{hint && <span className="ml-1 normal-case" style={{ color: TOKENS.MUTED_2 }}>· {hint}</span>}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
