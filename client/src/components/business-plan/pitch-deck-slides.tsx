/**
 * PITCH DECK SLIDES — Investor-grade carousel for the Business Plan module.
 *
 * Renders the rich `pitchDeckData.slides[]` payload produced by
 * POST /api/business-plan/:id/generate-pitch (v2).
 *
 * - Each slide is a self-contained, themed canvas with charts/images/icons.
 * - Carousel navigation (prev/next/thumbnails) + slide counter.
 * - Falls back gracefully when individual fields are missing.
 */

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart as RechartsPie, Pie, AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Lightbulb, Globe, TrendingUp,
  ShoppingBag, DollarSign, Target, Users, Award, Zap, Rocket, Music,
  PieChart as PieIcon, BarChart3, Sparkles, Trophy, Heart,
} from 'lucide-react';

interface PitchDeckSlidesProps {
  pitchData: any;
  artistName: string;
  colors: { hexAccent: string; hexPrimary?: string };
  fallbackImageUrl?: string | null;
}

const ICON_MAP: Record<string, any> = {
  trending: TrendingUp, 'trending-up': TrendingUp,
  users: Users, music: Music, dollar: DollarSign, globe: Globe,
  trophy: Trophy, 'alert-triangle': AlertTriangle, lightbulb: Lightbulb,
  rocket: Rocket, sparkles: Sparkles, heart: Heart,
};

const PIE_COLORS = ['#a855f7', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const fmtMoney = (n: number) => {
  if (!isFinite(n) || !n) return '$0';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtNum = (n: number) => {
  if (!isFinite(n) || !n) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
};

// ─────────────────────────────────────────────────────────────────────────────
// Slide chrome
// ─────────────────────────────────────────────────────────────────────────────

function SlideShell({
  children, accent, badge, slideIndex, total,
}: {
  children: React.ReactNode; accent: string;
  badge?: string; slideIndex: number; total: number;
}) {
  return (
    <div
      className="relative rounded-2xl border overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top left, ${accent}18, #00000088 60%)`,
        borderColor: `${accent}40`,
        minHeight: 380,
      }}
    >
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      {/* Slide chip */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {badge && (
          <span className="text-[9px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>
            {badge}
          </span>
        )}
        <span className="text-[9px] font-mono text-white/40 px-2 py-0.5 rounded-full bg-black/40 border border-white/5">
          {slideIndex + 1}/{total}
        </span>
      </div>
      <div className="relative p-5 md:p-6 z-[1]">
        {children}
      </div>
    </div>
  );
}

function SlideTitle({ icon: Icon, title, accent, subtitle }: any) {
  return (
    <div className="flex items-start gap-3 mb-4">
      {Icon && (
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}20`, border: `1px solid ${accent}40`, boxShadow: `0 0 14px ${accent}25` }}>
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/40 font-bold">{subtitle || 'Slide'}</div>
        <h3 className="text-base md:text-lg font-black text-white tracking-tight">{title}</h3>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-slide renderers
// ─────────────────────────────────────────────────────────────────────────────

function CoverSlide({ slide, accent, fallbackImage, idx, total, artistName }: any) {
  const img = slide.image || fallbackImage;
  return (
    <SlideShell accent={accent} badge="COVER" slideIndex={idx} total={total}>
      <div className="grid md:grid-cols-2 gap-5 items-center">
        {img && (
          <div className="aspect-square rounded-2xl overflow-hidden border" style={{ borderColor: `${accent}30` }}>
            <img src={img} alt={slide.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className={img ? '' : 'md:col-span-2 text-center'}>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50 font-bold mb-2">Investor Pitch</div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">{slide.title || artistName}</h2>
          <p className="text-sm md:text-base italic text-white/70 mb-4">{slide.subtitle || ''}</p>
          <div className="flex flex-wrap gap-2">
            {slide.meta?.genre && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }}>
                <Music className="inline h-3 w-3 mr-1" /> {slide.meta.genre}
              </span>
            )}
            {slide.meta?.country && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                <Globe className="inline h-3 w-3 mr-1" /> {slide.meta.country}
              </span>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function TextSlide({ slide, accent, idx, total, icon, badge }: any) {
  return (
    <SlideShell accent={accent} badge={badge} slideIndex={idx} total={total}>
      <SlideTitle icon={icon} title={slide.title} accent={accent} subtitle={badge?.toLowerCase()} />
      <p className="text-sm text-white/85 leading-relaxed">{slide.body}</p>
      {slide.highlight && (
        <div className="mt-4 rounded-xl p-3 border" style={{ background: `${accent}12`, borderColor: `${accent}30` }}>
          <div className="text-[9px] uppercase tracking-wider text-white/50 mb-1 font-bold">Key Insight</div>
          <p className="text-sm font-bold text-white">{slide.highlight}</p>
        </div>
      )}
    </SlideShell>
  );
}

function MarketSlide({ slide, accent, idx, total }: any) {
  const sizing = slide.sizing || {};
  const data = [
    { name: 'TAM', value: Number(sizing.tam) || 0 },
    { name: 'SAM', value: Number(sizing.sam) || 0 },
    { name: 'SOM', value: Number(sizing.som) || 0 },
  ];
  return (
    <SlideShell accent={accent} badge="MARKET" slideIndex={idx} total={total}>
      <SlideTitle icon={Globe} title={slide.title} accent={accent} subtitle="Market opportunity" />
      <div className="grid md:grid-cols-2 gap-5">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickFormatter={(v) => fmtMoney(Number(v))} />
              <Tooltip
                contentStyle={{ background: '#0a0612', border: `1px solid ${accent}40`, borderRadius: 8, fontSize: 11 }}
                formatter={(v: any) => fmtMoney(Number(v))}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={[accent, '#22c55e', '#f59e0b'][i] || accent} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={d.name} className="rounded-lg p-2.5 border flex items-center justify-between"
              style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.05)' }}>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">{d.name}</div>
                <div className="text-[10px] text-white/40">
                  {d.name === 'TAM' && 'Total addressable'}
                  {d.name === 'SAM' && 'Serviceable available'}
                  {d.name === 'SOM' && 'Realistic 3-yr capture'}
                </div>
              </div>
              <div className="text-base font-black" style={{ color: [accent, '#22c55e', '#f59e0b'][i] || accent }}>
                {fmtMoney(d.value)}
              </div>
            </div>
          ))}
          {sizing.narrative && (
            <p className="text-[11px] text-white/60 leading-relaxed pt-1">{sizing.narrative}</p>
          )}
        </div>
      </div>
      {Array.isArray(slide.competitors) && slide.competitors.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold mb-2">Competitive landscape</div>
          <div className="grid sm:grid-cols-3 gap-2">
            {slide.competitors.slice(0, 3).map((c: any, i: number) => (
              <div key={i} className="rounded-lg p-2 bg-white/[0.03] border border-white/5">
                <div className="text-xs font-bold text-white">{c.name}</div>
                <div className="text-[10px] text-white/50 mt-0.5">{c.differentiator}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </SlideShell>
  );
}

function TractionSlide({ slide, accent, idx, total }: any) {
  return (
    <SlideShell accent={accent} badge="TRACTION" slideIndex={idx} total={total}>
      <SlideTitle icon={TrendingUp} title={slide.title} accent={accent} subtitle="Traction" />
      <p className="text-sm text-white/85 leading-relaxed mb-3">{slide.body}</p>
      {Array.isArray(slide.highlights) && slide.highlights.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          {slide.highlights.slice(0, 4).map((h: any, i: number) => {
            const Icon = ICON_MAP[h.icon] || Award;
            return (
              <div key={i} className="rounded-xl p-3 border text-center"
                style={{ background: `${accent}10`, borderColor: `${accent}25` }}>
                <Icon className="h-4 w-4 mx-auto mb-1.5" style={{ color: accent }} />
                <div className="text-sm font-black text-white tracking-tight">{h.value}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/50 mt-0.5">{h.label}</div>
              </div>
            );
          })}
        </div>
      )}
      {Array.isArray(slide.gallery) && slide.gallery.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {slide.gallery.slice(0, 6).map((src: string, i: number) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden border border-white/5">
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </SlideShell>
  );
}

function ProductSlide({ slide, accent, idx, total }: any) {
  return (
    <SlideShell accent={accent} badge="PRODUCT" slideIndex={idx} total={total}>
      <SlideTitle icon={Music} title={slide.title} accent={accent} subtitle="Catalog · Merch" />
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2 flex items-center gap-1.5">
            <Music className="h-3 w-3" /> Top Songs
          </div>
          <div className="space-y-1.5">
            {(slide.songs || []).slice(0, 4).map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                {s.image ? (
                  <img src={s.image} alt={s.title} className="w-9 h-9 rounded-md object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ background: `${accent}20` }}>
                    <Music className="h-4 w-4" style={{ color: accent }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{s.title}</div>
                  <div className="text-[10px] text-white/40">{fmtNum(s.plays)} plays</div>
                </div>
              </div>
            ))}
            {(!slide.songs || slide.songs.length === 0) && (
              <div className="text-[11px] text-white/40 italic">No tracks yet — upload to populate.</div>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mb-2 flex items-center gap-1.5">
            <ShoppingBag className="h-3 w-3" /> Merch
          </div>
          <div className="space-y-1.5">
            {(slide.merch || []).slice(0, 4).map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                {m.image ? (
                  <img src={m.image} alt={m.name} className="w-9 h-9 rounded-md object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-md flex items-center justify-center bg-white/5">
                    <ShoppingBag className="h-4 w-4 text-white/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{m.name}</div>
                  <div className="text-[10px] text-white/40">{fmtMoney(m.price)}</div>
                </div>
              </div>
            ))}
            {(!slide.merch || slide.merch.length === 0) && (
              <div className="text-[11px] text-white/40 italic">No merch yet.</div>
            )}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function FinancialsSlide({ slide, accent, idx, total }: any) {
  const streams = slide.revenueStreams || {};
  const data = Object.entries(streams)
    .map(([k, v]) => ({ name: k, value: Number(v) || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  return (
    <SlideShell accent={accent} badge="FINANCIALS" slideIndex={idx} total={total}>
      <SlideTitle icon={BarChart3} title={slide.title} accent={accent} subtitle="Revenue mix" />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-[200px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" stroke="rgba(255,255,255,0.4)" fontSize={9} tickFormatter={(v) => fmtMoney(Number(v))} />
                <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.6)" fontSize={10} width={75} />
                <Tooltip contentStyle={{ background: '#0a0612', border: `1px solid ${accent}40`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => fmtMoney(Number(v))} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[11px] text-white/40 italic">
              Add revenue streams in Financials tab.
            </div>
          )}
        </div>
        <div className="space-y-2">
          {[
            { label: 'Monthly Revenue', value: fmtMoney(slide.monthlyRevenue), color: '#22c55e', icon: TrendingUp },
            { label: 'Monthly Expenses', value: fmtMoney(slide.monthlyExpenses), color: '#ef4444', icon: DollarSign },
            { label: 'Annual Revenue', value: fmtMoney(slide.annualRevenue), color: accent, icon: Sparkles },
            { label: 'Profit Margin', value: `${(slide.profitMargin || 0).toFixed(1)}%`, color: '#f59e0b', icon: Target },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center justify-between rounded-lg p-2.5 border"
                style={{ background: 'rgba(0,0,0,0.3)', borderColor: `${s.color}25` }}>
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-white/60">{s.label}</span>
                </div>
                <span className="text-base font-black" style={{ color: s.color }}>{s.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </SlideShell>
  );
}

function UseOfFundsSlide({ slide, accent, idx, total }: any) {
  const breakdown = slide.breakdown || {};
  const data = Object.entries(breakdown)
    .map(([k, v]) => ({ name: k, value: Number(v) || 0 }))
    .filter((d) => d.value > 0);
  return (
    <SlideShell accent={accent} badge="USE OF FUNDS" slideIndex={idx} total={total}>
      <SlideTitle icon={PieIcon} title={slide.title} accent={accent} subtitle="Capital allocation" />
      <div className="grid md:grid-cols-2 gap-4 items-center">
        <div className="h-[220px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={85} paddingAngle={3} stroke="none"
                >
                  {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0a0612', border: `1px solid ${accent}40`, borderRadius: 8, fontSize: 11 }} formatter={(v: any) => `${v}%`} />
              </RechartsPie>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[11px] text-white/40 italic">
              Generate the pitch to see breakdown.
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-xs text-white/80 capitalize truncate">{d.name}</span>
              </div>
              <span className="text-xs font-bold text-white tabular-nums">{d.value}%</span>
            </div>
          ))}
          {slide.narrative && (
            <p className="text-[11px] text-white/60 leading-relaxed pt-2 border-t border-white/5 mt-2">{slide.narrative}</p>
          )}
        </div>
      </div>
    </SlideShell>
  );
}

function RoadmapSlide({ slide, accent, idx, total }: any) {
  const items = slide.milestones || [];
  return (
    <SlideShell accent={accent} badge="ROADMAP" slideIndex={idx} total={total}>
      <SlideTitle icon={Rocket} title={slide.title} accent={accent} subtitle="Next 12 months" />
      <div className="relative pl-2">
        <div className="absolute left-3 top-2 bottom-2 w-[2px] rounded-full" style={{ background: `${accent}30` }} />
        <div className="space-y-3">
          {items.length === 0 && (
            <div className="text-[11px] text-white/40 italic">No milestones generated.</div>
          )}
          {items.map((m: any, i: number) => (
            <div key={i} className="relative pl-7">
              <div className="absolute left-1 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                style={{ background: '#000', borderColor: accent, boxShadow: `0 0 8px ${accent}50` }}>
                <span className="text-[8px] font-black" style={{ color: accent }}>{i + 1}</span>
              </div>
              <div className="rounded-lg p-2.5 border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: `${accent}20`, color: accent }}>{m.quarter}</span>
                  <span className="text-xs font-bold text-white">{m.title}</span>
                </div>
                {m.metric && <div className="text-[10px] text-white/50 mt-1">→ {m.metric}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function TeamSlide({ slide, accent, idx, total }: any) {
  const members = slide.members || [];
  return (
    <SlideShell accent={accent} badge="TEAM" slideIndex={idx} total={total}>
      <SlideTitle icon={Users} title={slide.title} accent={accent} subtitle="Founders & advisors" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {members.map((m: any, i: number) => (
          <div key={i} className="rounded-xl p-3 border" style={{ background: `${accent}08`, borderColor: `${accent}25` }}>
            <div className="w-12 h-12 rounded-full overflow-hidden mb-2 flex items-center justify-center"
              style={{ background: `${accent}25`, border: `1px solid ${accent}40` }}>
              {i === 0 && slide.artistImage ? (
                <img src={slide.artistImage} alt={m.name} className="w-full h-full object-cover" />
              ) : (
                <Users className="h-5 w-5" style={{ color: accent }} />
              )}
            </div>
            <div className="text-sm font-bold text-white">{m.name}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold mb-1.5" style={{ color: accent }}>{m.role}</div>
            <p className="text-[11px] text-white/60 leading-relaxed">{m.bio}</p>
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-[11px] text-white/40 italic col-span-3">No team data yet.</div>
        )}
      </div>
    </SlideShell>
  );
}

function AskSlide({ slide, accent, idx, total }: any) {
  return (
    <SlideShell accent={accent} badge="THE ASK" slideIndex={idx} total={total}>
      <SlideTitle icon={Trophy} title={slide.title} accent={accent} subtitle="Investment terms" />
      <div className="text-center py-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-bold mb-2">Raising</div>
        <div className="text-4xl md:text-5xl font-black mb-1 tracking-tight" style={{ color: accent, textShadow: `0 0 30px ${accent}60` }}>
          {fmtMoney(slide.amount || 0)}
        </div>
        {slide.equity > 0 && (
          <div className="text-sm text-white/70">
            for <span className="font-bold text-white">{slide.equity}% equity</span>
            {slide.valuation > 0 && (
              <> · post-money <span className="font-bold text-white">{fmtMoney(slide.valuation)}</span></>
            )}
          </div>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        {slide.terms && (
          <div className="rounded-lg p-3 border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: `${accent}25` }}>
            <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold mb-1">Terms</div>
            <p className="text-xs text-white/80">{slide.terms}</p>
          </div>
        )}
        {slide.runway && (
          <div className="rounded-lg p-3 border" style={{ background: 'rgba(0,0,0,0.3)', borderColor: `${accent}25` }}>
            <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold mb-1">Runway</div>
            <p className="text-xs text-white/80">{slide.runway}</p>
          </div>
        )}
      </div>
      {slide.cta && (
        <div className="mt-4 text-center text-sm font-bold italic" style={{ color: accent }}>
          {slide.cta}
        </div>
      )}
    </SlideShell>
  );
}

function VisionSlide({ slide, accent, idx, total }: any) {
  return (
    <SlideShell accent={accent} badge="VISION" slideIndex={idx} total={total}>
      <SlideTitle icon={Sparkles} title={slide.title} accent={accent} subtitle="The future" />
      <div className="grid md:grid-cols-2 gap-4 items-center">
        {slide.image && (
          <div className="aspect-[4/3] rounded-xl overflow-hidden border" style={{ borderColor: `${accent}30` }}>
            <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className={slide.image ? '' : 'md:col-span-2 text-center'}>
          <p className="text-base md:text-lg text-white/90 leading-relaxed font-light italic">"{slide.body}"</p>
        </div>
      </div>
    </SlideShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main carousel
// ─────────────────────────────────────────────────────────────────────────────

export function PitchDeckSlides({ pitchData, artistName, colors, fallbackImageUrl }: PitchDeckSlidesProps) {
  const accent = pitchData?.accentColor || colors.hexAccent;
  const slides: any[] = useMemo(() => {
    if (Array.isArray(pitchData?.slides) && pitchData.slides.length > 0) return pitchData.slides;
    // Backwards compatibility — synthesise minimal slides from legacy fields
    const legacy: any[] = [];
    if (pitchData?.tagline) legacy.push({ id: 'cover', type: 'cover', title: artistName, subtitle: pitchData.tagline, image: fallbackImageUrl });
    if (pitchData?.problemStatement) legacy.push({ id: 'p', type: 'problem', title: 'The Problem', body: pitchData.problemStatement });
    if (pitchData?.solution) legacy.push({ id: 's', type: 'solution', title: 'Solution', body: pitchData.solution });
    if (pitchData?.marketOpportunity) legacy.push({ id: 'm', type: 'problem', title: 'Market', body: pitchData.marketOpportunity });
    if (pitchData?.traction) legacy.push({ id: 't', type: 'problem', title: 'Traction', body: pitchData.traction });
    if (pitchData?.askAmount) legacy.push({ id: 'ask', type: 'ask', title: 'The Ask', amount: pitchData.askAmount, terms: pitchData.askTerms || '' });
    return legacy;
  }, [pitchData, artistName, fallbackImageUrl]);

  const [active, setActive] = useState(0);
  if (slides.length === 0) return null;

  const cur = slides[Math.min(active, slides.length - 1)];

  const renderSlide = (slide: any, idx: number, total: number) => {
    switch (slide.type) {
      case 'cover':
        return <CoverSlide slide={slide} accent={accent} fallbackImage={fallbackImageUrl} idx={idx} total={total} artistName={artistName} />;
      case 'problem':
        return <TextSlide slide={slide} accent={accent} idx={idx} total={total} icon={AlertTriangle} badge="PROBLEM" />;
      case 'solution':
        return <TextSlide slide={slide} accent={accent} idx={idx} total={total} icon={Lightbulb} badge="SOLUTION" />;
      case 'market':
        return <MarketSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'traction':
        return <TractionSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'product':
        return <ProductSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'financials':
        return <FinancialsSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'use-of-funds':
        return <UseOfFundsSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'roadmap':
        return <RoadmapSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'team':
        return <TeamSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'ask':
        return <AskSlide slide={slide} accent={accent} idx={idx} total={total} />;
      case 'vision':
        return <VisionSlide slide={slide} accent={accent} idx={idx} total={total} />;
      default:
        return <TextSlide slide={slide} accent={accent} idx={idx} total={total} icon={Zap} badge={slide.title?.toUpperCase()} />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Active slide */}
      <div>{renderSlide(cur, active, slides.length)}</div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          disabled={active === 0}
          className="w-9 h-9 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30 hover:bg-white/5"
          style={{ borderColor: `${accent}40`, color: accent }}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center gap-1 overflow-x-auto py-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="h-1.5 rounded-full transition-all flex-shrink-0"
              style={{
                width: i === active ? 24 : 8,
                background: i === active ? accent : 'rgba(255,255,255,0.15)',
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={() => setActive((a) => Math.min(slides.length - 1, a + 1))}
          disabled={active === slides.length - 1}
          className="w-9 h-9 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30 hover:bg-white/5"
          style={{ borderColor: `${accent}40`, color: accent }}
          aria-label="Next slide"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
        {slides.map((s, i) => (
          <button
            key={s.id || i}
            onClick={() => setActive(i)}
            className="relative aspect-square rounded-md overflow-hidden border transition-all"
            style={{
              borderColor: i === active ? accent : 'rgba(255,255,255,0.06)',
              boxShadow: i === active ? `0 0 12px ${accent}40` : 'none',
            }}
            aria-label={`Slide ${i + 1}: ${s.title}`}
            title={s.title}
          >
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold uppercase tracking-wider"
              style={{ background: i === active ? `${accent}25` : 'rgba(255,255,255,0.03)', color: i === active ? accent : 'rgba(255,255,255,0.5)' }}>
              {i + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
