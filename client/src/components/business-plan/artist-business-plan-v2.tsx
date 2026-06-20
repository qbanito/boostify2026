/**
 * Artist Business Plan V2 — AI Full-Generation Panel
 *
 * Blueprint-style: one click generates a complete, investor-grade
 * Business Plan JSON, polls until ready, then displays all modules.
 *
 * Connected to:
 *   • Superstar Blueprint (brand/identity context)
 *   • Economic Engine (real financial data)
 *   • Songs catalog, Merch catalog, artist profile
 *
 * Modules: Executive Summary · Market Analysis · Revenue Model ·
 *          Financial Plan · Pitch Deck · Roadmap · Operations ·
 *          Team · Risk Analysis
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Briefcase, TrendingUp, DollarSign, Globe, Users, Target,
  BarChart3, Zap, RefreshCw, Download, AlertCircle, Clock,
  CheckCircle2, ChevronRight, ChevronLeft, Trophy, Sparkles,
  Map, PieChart, Layers, Shield, Presentation, ArrowUp, ArrowDown,
  Building2, Music, ShoppingBag, Mic, Radio, ChevronDown, ChevronUp,
  Settings,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BusinessPlanDoc {
  _meta: { business_plan_score: number; generated_at: string; artist_name: string };
  executive_summary: {
    vision: string; mission: string; tagline: string; elevator_pitch: string;
    investment_thesis: string;
    key_highlights: Array<{ label: string; value: string; icon: string }>;
  };
  market_analysis: {
    tam: number; sam: number; som: number; currency: string;
    market_narrative: string; market_opportunity: string;
    target_audience: { primary: string; secondary: string; age_range: string; psychographics: string[] };
    competitive_landscape: Array<{ name: string; category: string; differentiator: string }>;
    market_trends: string[];
  };
  revenue_model: {
    primary_streams: Array<{ name: string; description: string; monthly_estimate_usd: number; growth_potential: string }>;
    secondary_streams: Array<{ name: string; description: string; monthly_estimate_usd: number }>;
    total_monthly_revenue_usd: number;
    total_annual_revenue_usd: number;
    revenue_diversification_score: number;
    monetization_strategy: string;
  };
  financial_plan: {
    monthly_revenue: number; monthly_expenses: number; monthly_profit: number;
    profit_margin_pct: number; annual_revenue: number; annual_expenses: number;
    annual_profit: number; investment_ask: number; pre_money_valuation: number;
    break_even_months: number;
    use_of_funds: { marketing: number; production: number; team: number; touring: number; technology: number; reserve: number };
    use_of_funds_narrative: string;
    projections_12m: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
    projections_3yr: Array<{ year: string; revenue: number; expenses: number; profit: number }>;
  };
  pitch_deck: {
    slides: Array<{
      id: number; title: string; subtitle: string; body: string;
      key_stat?: string; key_stat_label?: string;
      bullet_points?: string[]; chart_type?: string; cta?: string;
    }>;
    ask_amount: number; ask_terms: string; closing_statement: string;
  };
  roadmap: {
    current_phase: string;
    phase_1: { name: string; timeframe: string; objective: string; milestones: Array<{ title: string; month: number; category: string; priority: string }> };
    phase_2: { name: string; timeframe: string; objective: string; milestones: Array<{ title: string; month: number; category: string; priority: string }> };
    phase_3: { name: string; timeframe: string; objective: string; milestones: Array<{ title: string; month: number; category: string; priority: string }> };
    kpis: Record<string, string | number>;
  };
  operations: {
    business_model: string; distribution_strategy: string; tech_stack: string[];
    key_partnerships: string[]; content_pipeline: string; release_cadence: string;
    fan_engagement_strategy: string; ip_protection_strategy: string;
  };
  team: {
    founder: { name: string; role: string; bio: string };
    core_team: Array<{ role: string; responsibility: string; status: string }>;
    advisors: Array<{ area: string; value_add: string }>;
    team_narrative: string;
  };
  risk_analysis: {
    risks: Array<{ category: string; risk: string; probability: string; impact: string; mitigation: string }>;
    overall_risk_level: string;
  };
}

interface StatusResponse {
  status: 'pending' | 'generating' | 'completed' | 'failed';
  hasPlan: boolean;
  generatedAt?: string;
  error?: string;
  plan?: BusinessPlanDoc;
}

interface ArtistBusinessPlanV2Props {
  artistId: number;
  artistName: string;
}

// ─── Utils ──────────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#a855f7', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#ec4899'];

const fmtMoney = (n: number) => {
  if (!n || !isFinite(n)) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtNum = (n: number) => {
  if (!n || !isFinite(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
};

const riskColor = (level: string) => ({
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}[level] || 'text-white/50 bg-white/5 border-white/10');

const priorityColor = (p: string) => ({
  critical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  low: 'bg-white/10 text-white/50 border-white/10',
}[p] || 'bg-white/10 text-white/50 border-white/10');

const HIGHLIGHT_ICONS: Record<string, React.ComponentType<any>> = {
  dollar: DollarSign, music: Music, play: BarChart3, trophy: Trophy,
  trending: TrendingUp, users: Users, target: Target,
};

// ─── Sub-components ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    : score >= 50 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  const label = score >= 75 ? 'Investor Ready' : score >= 50 ? 'Developing' : 'Early Stage';
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${color}`}>
      <Briefcase className="w-4 h-4" />
      <span>{score}/100</span>
      <span className="text-xs font-normal opacity-70">— {label}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 text-sm">
      <span className="text-white/40 min-w-[180px] shrink-0">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}

function TagPill({ text }: { text: string }) {
  return <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/60 text-xs">{text}</span>;
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.filter(Boolean).map((t, i) => <TagPill key={i} text={t} />)}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<any>; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-semibold text-white/90 text-sm">
        <Icon className="w-4 h-4 text-purple-400" />
        <span>{title}</span>
      </div>
      <div className="pl-6 space-y-2">{children}</div>
    </div>
  );
}

// ─── Tab: Executive Summary ─────────────────────────────────────────────────────

function ExecSummaryTab({ bp }: { bp: BusinessPlanDoc }) {
  const es = bp.executive_summary;
  const score = bp._meta?.business_plan_score ?? 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <ScoreBadge score={score} />
        <span className="text-white/30 text-xs">Generated {new Date(bp._meta?.generated_at || Date.now()).toLocaleDateString()}</span>
      </div>

      {/* Key highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(es.key_highlights || []).map((h, i) => {
          const Icon = HIGHLIGHT_ICONS[h.icon] || TrendingUp;
          return (
            <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <Icon className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-white font-bold text-sm">{h.value}</div>
              <div className="text-white/40 text-xs mt-0.5">{h.label}</div>
            </div>
          );
        })}
      </div>

      <Section icon={Sparkles} title="Vision & Mission">
        <InfoBlock label="Vision" value={es.vision} />
        <InfoBlock label="Mission" value={es.mission} />
        <InfoBlock label="Tagline" value={<em className="text-purple-300">"{es.tagline}"</em>} />
      </Section>

      <Section icon={Briefcase} title="Elevator Pitch">
        <p className="text-white/70 text-sm leading-relaxed">{es.elevator_pitch}</p>
      </Section>

      <Section icon={TrendingUp} title="Investment Thesis">
        <p className="text-white/70 text-sm leading-relaxed">{es.investment_thesis}</p>
      </Section>
    </div>
  );
}

// ─── Tab: Market Analysis ────────────────────────────────────────────────────────

function MarketTab({ bp }: { bp: BusinessPlanDoc }) {
  const ma = bp.market_analysis;
  const marketData = [
    { name: 'TAM', value: ma.tam, fill: '#a855f7' },
    { name: 'SAM', value: ma.sam, fill: '#6366f1' },
    { name: 'SOM', value: ma.som, fill: '#22c55e' },
  ];
  return (
    <div className="space-y-6">
      {/* Market sizing */}
      <div className="grid grid-cols-3 gap-3">
        {marketData.map(m => (
          <div key={m.name} className="p-4 rounded-xl border" style={{ borderColor: m.fill + '40', backgroundColor: m.fill + '10' }}>
            <div className="text-white/50 text-xs">{m.name}</div>
            <div className="text-white font-bold text-lg mt-1">{fmtMoney(m.value)}</div>
          </div>
        ))}
      </div>

      <Section icon={Globe} title="Market Opportunity">
        <p className="text-white/70 text-sm leading-relaxed">{ma.market_narrative}</p>
        <p className="text-purple-300/80 text-sm leading-relaxed mt-1">{ma.market_opportunity}</p>
      </Section>

      <Section icon={Users} title="Target Audience">
        <InfoBlock label="Primary" value={ma.target_audience?.primary} />
        <InfoBlock label="Secondary" value={ma.target_audience?.secondary} />
        <InfoBlock label="Age Range" value={ma.target_audience?.age_range} />
        {Array.isArray(ma.target_audience?.psychographics) && (
          <InfoBlock label="Psychographics" value={<TagList items={ma.target_audience.psychographics} />} />
        )}
      </Section>

      <Section icon={BarChart3} title="Competitive Landscape">
        <div className="space-y-2">
          {(ma.competitive_landscape || []).map((c, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/90 text-sm font-medium">{c.name}</span>
                <Badge variant="outline" className="text-xs text-white/50 border-white/20">{c.category}</Badge>
              </div>
              <p className="text-white/50 text-xs">{c.differentiator}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={TrendingUp} title="Market Trends">
        <div className="space-y-1">
          {(ma.market_trends || []).map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-white/70">
              <ChevronRight className="w-3 h-3 mt-0.5 text-purple-400 shrink-0" />
              <span>{t}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── Tab: Revenue Model ──────────────────────────────────────────────────────────

function RevenueTab({ bp }: { bp: BusinessPlanDoc }) {
  const rm = bp.revenue_model;
  const pieData = useMemo(() => [
    ...(rm.primary_streams || []).map(s => ({ name: s.name, value: s.monthly_estimate_usd })),
    ...(rm.secondary_streams || []).map(s => ({ name: s.name, value: s.monthly_estimate_usd })),
  ].filter(d => d.value > 0), [rm]);

  const growthColor = (g: string) =>
    g === 'high' ? 'text-emerald-400' : g === 'medium' ? 'text-amber-400' : 'text-white/40';

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="text-emerald-400/60 text-xs">Monthly Revenue</div>
          <div className="text-emerald-300 font-bold text-lg mt-1">{fmtMoney(rm.total_monthly_revenue_usd)}</div>
        </div>
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="text-blue-400/60 text-xs">Annual Revenue</div>
          <div className="text-blue-300 font-bold text-lg mt-1">{fmtMoney(rm.total_annual_revenue_usd)}</div>
        </div>
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="text-purple-400/60 text-xs">Diversification</div>
          <div className="text-purple-300 font-bold text-lg mt-1">{rm.revenue_diversification_score}/100</div>
        </div>
      </div>

      {/* Pie chart */}
      {pieData.length > 0 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
            </RechartsPie>
          </ResponsiveContainer>
        </div>
      )}

      <Section icon={DollarSign} title="Primary Revenue Streams">
        <div className="space-y-2">
          {(rm.primary_streams || []).map((s, i) => (
            <div key={i} className="flex items-start justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white/90 text-sm font-medium">{s.name}</span>
                  <span className={`text-xs ${growthColor(s.growth_potential)}`}>↑ {s.growth_potential} growth</span>
                </div>
                <p className="text-white/50 text-xs mt-0.5">{s.description}</p>
              </div>
              <div className="text-emerald-300 font-bold text-sm ml-4 shrink-0">{fmtMoney(s.monthly_estimate_usd)}/mo</div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Layers} title="Secondary Revenue Streams">
        <div className="space-y-2">
          {(rm.secondary_streams || []).map((s, i) => (
            <div key={i} className="flex items-start justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex-1">
                <span className="text-white/70 text-sm">{s.name}</span>
                <p className="text-white/40 text-xs mt-0.5">{s.description}</p>
              </div>
              <div className="text-white/60 text-sm ml-4 shrink-0">{fmtMoney(s.monthly_estimate_usd)}/mo</div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Target} title="Monetization Strategy">
        <p className="text-white/70 text-sm leading-relaxed">{rm.monetization_strategy}</p>
      </Section>
    </div>
  );
}

// ─── Tab: Financial Plan ────────────────────────────────────────────────────────

function FinancialTab({ bp }: { bp: BusinessPlanDoc }) {
  const fp = bp.financial_plan;
  const [activeChart, setActiveChart] = useState<'12m' | '3yr'>('12m');

  const fundsData = useMemo(() =>
    Object.entries(fp.use_of_funds || {}).map(([k, v], i) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    })).filter(d => d.value > 0),
  [fp]);

  const positive = fp.monthly_profit >= 0;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Revenue', val: fmtMoney(fp.monthly_revenue), color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Monthly Expenses', val: fmtMoney(fp.monthly_expenses), color: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/20' },
          { label: 'Monthly Profit', val: fmtMoney(fp.monthly_profit), color: positive ? 'text-emerald-300' : 'text-rose-300', bg: positive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20' },
          { label: 'Profit Margin', val: `${fp.profit_margin_pct || 0}%`, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
        ].map((k, i) => (
          <div key={i} className={`p-3 rounded-xl border ${k.bg}`}>
            <div className="text-white/40 text-xs">{k.label}</div>
            <div className={`font-bold text-base mt-1 ${k.color}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Investment cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <div className="text-purple-400/60 text-xs">Investment Ask</div>
          <div className="text-purple-300 font-bold text-lg mt-1">{fmtMoney(fp.investment_ask)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="text-white/40 text-xs">Pre-Money Valuation</div>
          <div className="text-white/90 font-bold text-lg mt-1">{fmtMoney(fp.pre_money_valuation)}</div>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="text-white/40 text-xs">Break-Even</div>
          <div className="text-white/90 font-bold text-lg mt-1">{fp.break_even_months} months</div>
        </div>
      </div>

      {/* Projections chart */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveChart('12m')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeChart === '12m' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            12-Month
          </button>
          <button onClick={() => setActiveChart('3yr')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${activeChart === '3yr' ? 'bg-purple-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            3-Year
          </button>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            {activeChart === '12m' ? (
              <AreaChart data={fp.projections_12m || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={v => fmtMoney(v)} width={60} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="#22c55e20" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef444420" name="Expenses" />
                <Area type="monotone" dataKey="profit" stroke="#a855f7" fill="#a855f720" name="Profit" />
              </AreaChart>
            ) : (
              <BarChart data={fp.projections_3yr || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={v => fmtMoney(v)} width={60} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Bar dataKey="profit" fill="#a855f7" name="Profit" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Use of funds */}
      <Section icon={PieChart} title="Use of Funds">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={fundsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                  {fundsData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {fundsData.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-white/60">{d.name}</span>
                <span className="text-white/90 ml-auto font-medium">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/60 text-xs leading-relaxed mt-2">{fp.use_of_funds_narrative}</p>
      </Section>
    </div>
  );
}

// ─── Tab: Pitch Deck ────────────────────────────────────────────────────────────

function PitchDeckTab({ bp }: { bp: BusinessPlanDoc }) {
  const pd = bp.pitch_deck;
  const slides = pd?.slides || [];
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  if (!slide) return <p className="text-white/40 text-sm">No pitch deck data available.</p>;

  const fundsData = useMemo(() => {
    if (slide.chart_type === 'pie' && slide.title?.includes('Funds')) {
      const uof = bp.financial_plan?.use_of_funds;
      return uof ? Object.entries(uof).map(([k, v], i) => ({ name: k, value: v, fill: PIE_COLORS[i % PIE_COLORS.length] })) : [];
    }
    if (slide.chart_type === 'pie' && slide.title?.includes('Revenue')) {
      const rm = bp.revenue_model;
      return [
        ...(rm?.primary_streams || []).map((s, i) => ({ name: s.name, value: s.monthly_estimate_usd, fill: PIE_COLORS[i % PIE_COLORS.length] })),
      ].filter(d => d.value > 0);
    }
    return [];
  }, [slide, bp]);

  const lineData = useMemo(() =>
    slide.chart_type === 'line' ? (bp.financial_plan?.projections_12m || []) : [],
  [slide, bp]);

  return (
    <div className="space-y-4">
      {/* Slide display */}
      <div className="relative min-h-[320px] rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-purple-900/30 to-indigo-900/20 p-6">
        {/* Slide counter */}
        <div className="absolute top-4 right-4 text-white/30 text-xs">{current + 1} / {slides.length}</div>

        {/* Slide content */}
        <div className="space-y-3">
          <div>
            <div className="text-white/40 text-xs uppercase tracking-widest">{slide.title}</div>
            <h3 className="text-white text-xl font-bold mt-1">{slide.subtitle}</h3>
          </div>

          {slide.key_stat && (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-purple-300">{slide.key_stat}</span>
              <span className="text-white/40 text-sm">{slide.key_stat_label}</span>
            </div>
          )}

          <p className="text-white/60 text-sm leading-relaxed">{slide.body}</p>

          {slide.bullet_points && slide.bullet_points.length > 0 && (
            <ul className="space-y-1.5">
              {slide.bullet_points.filter(Boolean).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-purple-400 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Chart for applicable slides */}
          {slide.chart_type === 'pie' && fundsData.length > 0 && (
            <div className="h-32 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={fundsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={50}>
                    {fundsData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => slide.title?.includes('Funds') ? `${v}%` : fmtMoney(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          )}

          {slide.chart_type === 'line' && lineData.length > 0 && (
            <div className="h-32 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#a855f7" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {slide.cta && (
            <div className="pt-2 text-purple-300 font-semibold text-sm">{slide.cta}</div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="border-white/20 text-white/70" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Prev
        </Button>
        {/* Thumbnail dots */}
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-purple-400' : 'bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
        <Button size="sm" variant="outline" className="border-white/20 text-white/70" onClick={() => setCurrent(c => Math.min(slides.length - 1, c + 1))} disabled={current === slides.length - 1}>
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Ask & terms */}
      {pd.ask_amount > 0 && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Investment Ask</span>
            <span className="text-purple-300 font-bold">{fmtMoney(pd.ask_amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">Terms</span>
            <span className="text-white/80 text-sm">{pd.ask_terms}</span>
          </div>
          <p className="text-white/50 text-xs pt-1 italic">"{pd.closing_statement}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Roadmap ────────────────────────────────────────────────────────────────

function RoadmapTab({ bp }: { bp: BusinessPlanDoc }) {
  const rm = bp.roadmap;
  const phases = [rm.phase_1, rm.phase_2, rm.phase_3].filter(Boolean);
  const catColor: Record<string, string> = {
    release: 'text-purple-400', tour: 'text-orange-400', marketing: 'text-pink-400',
    financial: 'text-emerald-400', branding: 'text-cyan-400', growth: 'text-blue-400',
  };

  return (
    <div className="space-y-6">
      <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 inline-block">
        <span className="text-white/50 text-xs">Current Phase: </span>
        <span className="text-purple-300 text-sm font-medium">{rm.current_phase}</span>
      </div>

      {phases.map((phase, pi) => (
        <div key={pi} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 text-sm font-bold">
              {pi + 1}
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{phase.name}</div>
              <div className="text-white/40 text-xs">{phase.timeframe} — {phase.objective}</div>
            </div>
          </div>
          <div className="ml-4 pl-7 border-l border-white/10 space-y-2">
            {(phase.milestones || []).map((m, mi) => (
              <div key={mi} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 text-xs shrink-0 mt-0.5">{m.month}</div>
                <div className="flex-1">
                  <span className="text-white/80 text-sm">{m.title}</span>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-xs ${catColor[m.category] || 'text-white/40'}`}>{m.category}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityColor(m.priority)}`}>{m.priority}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* KPIs */}
      {rm.kpis && Object.keys(rm.kpis).length > 0 && (
        <Section icon={Target} title="Success KPIs">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(rm.kpis).map(([k, v]) => (
              <div key={k} className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="text-white/40 text-xs">{k.replace(/_/g, ' ')}</div>
                <div className="text-white/90 font-semibold text-sm mt-0.5">{typeof v === 'number' ? fmtNum(v) : v}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Tab: Operations + Team + Risks ────────────────────────────────────────────

function OpsTeamRiskTab({ bp }: { bp: BusinessPlanDoc }) {
  const ops = bp.operations;
  const team = bp.team;
  const risk = bp.risk_analysis;

  return (
    <div className="space-y-8">
      {/* Operations */}
      <div className="space-y-4">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" /> Operations</h4>
        <div className="space-y-3 pl-6">
          <InfoBlock label="Business Model" value={ops.business_model} />
          <InfoBlock label="Distribution" value={ops.distribution_strategy} />
          <InfoBlock label="Release Cadence" value={ops.release_cadence} />
          <InfoBlock label="Content Pipeline" value={ops.content_pipeline} />
          <InfoBlock label="Fan Engagement" value={ops.fan_engagement_strategy} />
          <InfoBlock label="IP Protection" value={ops.ip_protection_strategy} />
          {ops.tech_stack?.length > 0 && <InfoBlock label="Tech Stack" value={<TagList items={ops.tech_stack} />} />}
          {ops.key_partnerships?.length > 0 && <InfoBlock label="Partnerships" value={<TagList items={ops.key_partnerships} />} />}
        </div>
      </div>

      {/* Team */}
      <div className="space-y-4">
        <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" /> Team</h4>
        <div className="space-y-3 pl-6">
          {/* Founder */}
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="text-purple-300 font-semibold text-sm">{team.founder?.name}</div>
            <div className="text-white/50 text-xs">{team.founder?.role}</div>
            <p className="text-white/60 text-xs mt-1">{team.founder?.bio}</p>
          </div>
          {/* Core team */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(team.core_team || []).map((m, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/80 text-sm">{m.role}</span>
                  <Badge variant="outline" className={`text-xs border ${m.status === 'existing' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                    {m.status}
                  </Badge>
                </div>
                <p className="text-white/40 text-xs mt-0.5">{m.responsibility}</p>
              </div>
            ))}
          </div>
          <p className="text-white/50 text-xs leading-relaxed">{team.team_narrative}</p>
        </div>
      </div>

      {/* Risks */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h4 className="text-white/80 font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-amber-400" /> Risk Analysis</h4>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${riskColor(risk.overall_risk_level)}`}>
            Overall: {risk.overall_risk_level} risk
          </span>
        </div>
        <div className="space-y-2 pl-6">
          {(risk.risks || []).map((r, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white/60 text-xs bg-white/10 px-2 py-0.5 rounded">{r.category}</span>
                    <span className={`text-xs ${riskColor(r.probability).split(' ')[0]}`}>P: {r.probability}</span>
                    <span className={`text-xs ${riskColor(r.impact).split(' ')[0]}`}>I: {r.impact}</span>
                  </div>
                  <p className="text-white/80 text-sm">{r.risk}</p>
                </div>
              </div>
              <div className="mt-2 flex items-start gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-white/50 text-xs">{r.mitigation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

// ─── Base Data Form ─────────────────────────────────────────────────────────────

interface BaseInputs {
  businessName: string;
  revenueStreams: Record<string, number>;
  monthlyExpenses: Record<string, number>;
  investmentAsk: number;
  monthlyTarget: number;
}

const DEFAULT_INPUTS: BaseInputs = {
  businessName: '',
  revenueStreams: { streaming: 0, merchandise: 0, liveShows: 0, licensing: 0, brandDeals: 0, other: 0 },
  monthlyExpenses: { studio: 0, marketing: 0, equipment: 0, travel: 0, team: 0, other: 0 },
  investmentAsk: 0,
  monthlyTarget: 0,
};

const REVENUE_LABELS: Record<string, string> = {
  streaming: 'Streaming (Spotify, Apple…)', merchandise: 'Merchandise Sales',
  liveShows: 'Live Shows / Gigs', licensing: 'Sync / Licensing',
  brandDeals: 'Brand Deals / Sponsorships', other: 'Other Revenue',
};
const EXPENSE_LABELS: Record<string, string> = {
  studio: 'Studio / Recording', marketing: 'Marketing & Ads',
  equipment: 'Equipment / Gear', travel: 'Travel & Touring',
  team: 'Team / Contractors', other: 'Other Expenses',
};

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-white/60 text-xs min-w-0 flex-1">{label}</Label>
      <div className="relative w-28 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
        <Input
          type="number"
          min={0}
          value={value || ''}
          onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          placeholder="0"
          className="pl-6 h-8 text-xs bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
        />
      </div>
    </div>
  );
}

function BaseDataForm({
  inputs,
  onChange,
  onGenerate,
  onSkip,
  isGenerating,
}: {
  inputs: BaseInputs;
  onChange: (inputs: BaseInputs) => void;
  onGenerate: () => void;
  onSkip: () => void;
  isGenerating: boolean;
}) {
  const [revenueOpen, setRevenueOpen] = useState(true);
  const [expensesOpen, setExpensesOpen] = useState(false);

  const totalRevenue = Object.values(inputs.revenueStreams).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(inputs.monthlyExpenses).reduce((a, b) => a + b, 0);
  const hasAnyData = totalRevenue > 0 || totalExpenses > 0 || inputs.investmentAsk > 0;

  const setRevenue = (key: string, val: number) =>
    onChange({ ...inputs, revenueStreams: { ...inputs.revenueStreams, [key]: val } });
  const setExpense = (key: string, val: number) =>
    onChange({ ...inputs, monthlyExpenses: { ...inputs.monthlyExpenses, [key]: val } });

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <Settings className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Base Financial Data (Optional)</p>
          <p className="text-white/40 text-xs">Enter your numbers to get a more accurate plan — or skip to auto-generate</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Business name */}
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs">Business / Brand Name (optional)</Label>
          <Input
            value={inputs.businessName}
            onChange={e => onChange({ ...inputs, businessName: e.target.value })}
            placeholder={`e.g. "${inputs.businessName || 'Artist LLC'}" — leave blank to auto-fill`}
            className="h-9 text-sm bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
          />
        </div>

        {/* Revenue streams */}
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
            onClick={() => setRevenueOpen(o => !o)}
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Monthly Revenue
              {totalRevenue > 0 && <span className="text-emerald-400 font-bold text-xs">${totalRevenue.toLocaleString()}/mo</span>}
            </span>
            {revenueOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
          </button>
          {revenueOpen && (
            <div className="space-y-2 pl-1">
              {Object.entries(REVENUE_LABELS).map(([key, label]) => (
                <NumInput key={key} label={label} value={inputs.revenueStreams[key] ?? 0} onChange={v => setRevenue(key, v)} />
              ))}
            </div>
          )}
        </div>

        {/* Monthly expenses */}
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
            onClick={() => setExpensesOpen(o => !o)}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-rose-400" />
              Monthly Expenses
              {totalExpenses > 0 && <span className="text-rose-400 font-bold text-xs">${totalExpenses.toLocaleString()}/mo</span>}
            </span>
            {expensesOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
          </button>
          {expensesOpen && (
            <div className="space-y-2 pl-1">
              {Object.entries(EXPENSE_LABELS).map(([key, label]) => (
                <NumInput key={key} label={label} value={inputs.monthlyExpenses[key] ?? 0} onChange={v => setExpense(key, v)} />
              ))}
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Monthly Revenue Target</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
              <Input
                type="number" min={0}
                value={inputs.monthlyTarget || ''}
                onChange={e => onChange({ ...inputs, monthlyTarget: Math.max(0, parseFloat(e.target.value) || 0) })}
                placeholder="5,000"
                className="pl-6 h-9 text-sm bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Investment Ask</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
              <Input
                type="number" min={0}
                value={inputs.investmentAsk || ''}
                onChange={e => onChange({ ...inputs, investmentAsk: Math.max(0, parseFloat(e.target.value) || 0) })}
                placeholder="50,000"
                className="pl-6 h-9 text-sm bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
              />
            </div>
          </div>
        </div>

        {/* Summary bar */}
        {hasAnyData && (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-white/50">Summary:</span>
            <span className="text-emerald-400 font-medium">${totalRevenue.toLocaleString()}/mo revenue</span>
            <span className="text-rose-400 font-medium">${totalExpenses.toLocaleString()}/mo expenses</span>
            {inputs.investmentAsk > 0 && <span className="text-blue-400 font-medium">${inputs.investmentAsk.toLocaleString()} ask</span>}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Button
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isGenerating
              ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
              : <><Zap className="w-3.5 h-3.5 mr-1.5" />{hasAnyData ? 'Generate with my data' : 'Generate Plan'}</>
            }
          </Button>
          {hasAnyData && (
            <Button
              size="sm"
              variant="outline"
              onClick={onSkip}
              disabled={isGenerating}
              className="border-white/20 text-white/60 hover:text-white"
            >
              Auto-generate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ArtistBusinessPlanV2({ artistId, artistName }: ArtistBusinessPlanV2Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = [`/api/business-plan/${artistId}/full-status`];

  const [polling, setPolling] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [baseInputs, setBaseInputs] = useState<BaseInputs>(DEFAULT_INPUTS);
  const [showInputForm, setShowInputForm] = useState(false);

  // Poll for status
  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/business-plan/${artistId}/full-status`);
      return res as StatusResponse;
    },
    refetchInterval: polling ? 3000 : false,
    refetchIntervalInBackground: true,
    retry: false,
    enabled: artistId > 0,
  });

  // Auto-manage polling
  useEffect(() => {
    if (data?.status === 'completed' || data?.status === 'failed') {
      setPolling(false);
      if (data.status === 'failed') setGenError(data.error || 'Generation failed');
    } else if (data?.status === 'generating') {
      setPolling(true);
    }
  }, [data?.status]);

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (withInputs: boolean = true) => {
      const totalRevenue = Object.values(baseInputs.revenueStreams).reduce((a, b) => a + b, 0);
      const totalExpenses = Object.values(baseInputs.monthlyExpenses).reduce((a, b) => a + b, 0);
      const hasData = withInputs && (totalRevenue > 0 || totalExpenses > 0 || baseInputs.investmentAsk > 0);

      const body = hasData ? {
        businessName: baseInputs.businessName || undefined,
        revenueStreams: { ...baseInputs.revenueStreams, courses: 0, crowdfunding: 0 },
        monthlyExpenses: { ...baseInputs.monthlyExpenses, contentCreation: 0, distribution: 0 },
        financialGoals: {
          monthlyTarget: baseInputs.monthlyTarget || 5000,
          yearlyTarget: (baseInputs.monthlyTarget || 5000) * 12,
          savingsTarget: Math.round((baseInputs.monthlyTarget || 5000) * 2),
          investmentAsk: baseInputs.investmentAsk,
        },
      } : {};

      const res = await apiRequest('POST', `/api/business-plan/${artistId}/generate-full`, body);
      return res;
    },
    onSuccess: () => {
      setPolling(true);
      setGenError(null);
      toast({ title: '⚡ Business Plan generation started', description: 'Analyzing your data. Auto-updating…' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      setGenError(err.message);
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  const bp = data?.plan as BusinessPlanDoc | undefined;
  const isGenerating = polling || data?.status === 'generating' || generateMutation.isPending;

  const handleDownload = () => {
    if (!bp) return;
    const blob = new Blob([JSON.stringify(bp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artistName.replace(/\s+/g, '_')}_business_plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Business Plan</h2>
            <Badge variant="outline" className="text-xs text-blue-300 border-blue-500/30">AI-Generated</Badge>
          </div>
          <p className="text-white/50 text-sm">
            Investor-grade plan for {artistName} — connected to Blueprint, Engine & catalog
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {bp && (
            <Button size="sm" variant="outline" className="border-white/20 text-white/70 hover:text-white" onClick={handleDownload}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Export
            </Button>
          )}
          {bp && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInputForm(o => !o)}
              className="border-white/20 text-white/60 hover:text-white"
            >
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              {showInputForm ? 'Hide inputs' : 'Edit inputs'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => generateMutation.mutate(true)}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-500 text-white"
          >
            {isGenerating ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating…</>
            ) : bp ? (
              <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Regenerate</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-1.5" />Generate Plan</>
            )}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-white/50 text-sm p-4 rounded-xl bg-white/5 border border-white/10">
          <Clock className="w-4 h-4 animate-pulse" /> Loading business plan data…
        </div>
      )}

      {/* Inline edit-inputs form (shown when plan already exists and user clicks "Edit inputs") */}
      {bp && showInputForm && !isGenerating && (
        <BaseDataForm
          inputs={baseInputs}
          onChange={setBaseInputs}
          onGenerate={() => { setShowInputForm(false); generateMutation.mutate(true); }}
          onSkip={() => { setShowInputForm(false); generateMutation.mutate(false); }}
          isGenerating={isGenerating}
        />
      )}

      {/* Generating */}
      {isGenerating && !isLoading && (
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
          <div className="flex items-center gap-2 text-blue-300 font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" /> Generating your Business Plan…
          </div>
          <p className="text-white/50 text-xs">
            The AI is reading your full profile, catalog, merch, Superstar Blueprint and economic data
            to create an investor-grade plan. This takes 30–90 seconds.
          </p>
          <Progress value={undefined} className="h-1.5 animate-pulse" />
        </div>
      )}

      {/* Error */}
      {genError && !isGenerating && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-rose-300 font-medium text-sm">Generation failed</p>
            <p className="text-white/40 text-xs mt-0.5">{genError}</p>
          </div>
          <button onClick={() => setGenError(null)} className="text-white/30 hover:text-white/60 text-xs shrink-0 ml-auto">✕</button>
        </div>
      )}

      {/* Empty state — show data input form */}
      {!isLoading && !bp && !isGenerating && data?.status !== 'failed' && (
        <div className="space-y-4">
          <BaseDataForm
            inputs={baseInputs}
            onChange={setBaseInputs}
            onGenerate={() => generateMutation.mutate(true)}
            onSkip={() => generateMutation.mutate(false)}
            isGenerating={isGenerating}
          />
          <div className="flex flex-wrap gap-3 justify-center text-xs text-white/30 pt-2">
            <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Executive Summary</span>
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Market Analysis</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> Revenue Model</span>
            <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Financials</span>
            <span className="flex items-center gap-1"><Presentation className="w-3 h-3" /> Pitch Deck</span>
            <span className="flex items-center gap-1"><Map className="w-3 h-3" /> Roadmap</span>
          </div>
        </div>
      )}

      {/* Main content — tabs */}
      {bp && !isGenerating && (
        <Tabs defaultValue="summary">
          <ScrollArea className="w-full" type="scroll">
            <TabsList className="w-max flex gap-1 bg-white/5 p-1 rounded-xl mb-4">
              {[
                { value: 'summary', label: 'Summary', icon: Sparkles },
                { value: 'market', label: 'Market', icon: Globe },
                { value: 'revenue', label: 'Revenue', icon: DollarSign },
                { value: 'financials', label: 'Financials', icon: BarChart3 },
                { value: 'pitch', label: 'Pitch Deck', icon: Presentation },
                { value: 'roadmap', label: 'Roadmap', icon: Map },
                { value: 'ops', label: 'Ops / Team / Risk', icon: Building2 },
              ].map(t => (
                <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50">
                  <t.icon className="w-3 h-3" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value="summary"><ScrollArea className="max-h-[70vh]"><ExecSummaryTab bp={bp} /></ScrollArea></TabsContent>
          <TabsContent value="market"><ScrollArea className="max-h-[70vh]"><MarketTab bp={bp} /></ScrollArea></TabsContent>
          <TabsContent value="revenue"><ScrollArea className="max-h-[70vh]"><RevenueTab bp={bp} /></ScrollArea></TabsContent>
          <TabsContent value="financials"><ScrollArea className="max-h-[70vh]"><FinancialTab bp={bp} /></ScrollArea></TabsContent>
          <TabsContent value="pitch"><ScrollArea className="max-h-[70vh]"><PitchDeckTab bp={bp} /></ScrollArea></TabsContent>
          <TabsContent value="roadmap"><ScrollArea className="max-h-[70vh]"><RoadmapTab bp={bp} /></ScrollArea></TabsContent>
          <TabsContent value="ops"><ScrollArea className="max-h-[70vh]"><OpsTeamRiskTab bp={bp} /></ScrollArea></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
