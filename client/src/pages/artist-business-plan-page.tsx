/**
 * Artist Business Plan — Full Page
 * Route: /business-plan/:artistId
 *
 * Beautiful dedicated page showing the full AI-generated business plan.
 * Public — visible to anyone (no login required to VIEW).
 * Generate/Regenerate button only shown to the artist owner.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useUser } from '@clerk/clerk-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Briefcase, TrendingUp, DollarSign, Globe, Users, Target,
  BarChart3, Zap, RefreshCw, Download, AlertCircle, Clock,
  CheckCircle2, ChevronRight, ChevronLeft, Trophy, Sparkles,
  Map, PieChart, Layers, Shield, Presentation, ArrowLeft,
  Building2, Music, ShoppingBag, Star, Award, Rocket, Settings,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

// ─── Financial Input Types ─────────────────────────────────────────────────────

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
  streaming: 'Streaming (Spotify, Apple…)',
  merchandise: 'Merchandise Sales',
  liveShows: 'Live Shows / Gigs',
  licensing: 'Sync / Licensing',
  brandDeals: 'Brand Deals / Sponsorships',
  other: 'Other Revenue',
};

const EXPENSE_LABELS: Record<string, string> = {
  studio: 'Studio / Recording',
  marketing: 'Marketing & Ads',
  equipment: 'Equipment / Gear',
  travel: 'Travel & Touring',
  team: 'Team / Contractors',
  other: 'Other Expenses',
};

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = React.useState(value > 0 ? String(value) : '');
  // keep in sync when parent resets
  React.useEffect(() => { setRaw(value > 0 ? String(value) : ''); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <Label className="text-white/60 text-xs min-w-0 flex-1 truncate">{label}</Label>
      <div className="relative w-32 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '');
            setRaw(v);
            onChange(v === '' ? 0 : parseInt(v, 10));
          }}
          placeholder="0"
          className="pl-6 h-8 text-xs bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
        />
      </div>
    </div>
  );
}

function FinancialInputForm({
  inputs, onChange, onGenerate, isGenerating,
}: {
  inputs: BaseInputs;
  onChange: (v: BaseInputs) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const [revenueOpen, setRevenueOpen] = React.useState(true);
  const [expensesOpen, setExpensesOpen] = React.useState(false);
  const totalRevenue = Object.values(inputs.revenueStreams).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(inputs.monthlyExpenses).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
          <Settings className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Financial Data <span className="text-white/30 font-normal">(opcional)</span></p>
          <p className="text-white/40 text-xs">Ingresa tus números reales para un plan más preciso — o genera sin datos para usar tu perfil</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Business name */}
        <div className="space-y-1.5">
          <Label className="text-white/60 text-xs">Nombre del negocio / marca (opcional)</Label>
          <Input
            value={inputs.businessName}
            onChange={e => onChange({ ...inputs, businessName: e.target.value })}
            placeholder="e.g. Mi Artista LLC"
            className="h-9 text-sm bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
          />
        </div>

        {/* Revenue */}
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
            onClick={() => setRevenueOpen(o => !o)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Ingresos Mensuales
              {totalRevenue > 0 && <span className="text-emerald-400 font-bold text-xs">${totalRevenue.toLocaleString()}/mo</span>}
            </span>
            {revenueOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
          </button>
          {revenueOpen && (
            <div className="space-y-2 pl-1">
              {Object.entries(REVENUE_LABELS).map(([key, label]) => (
                <NumInput
                  key={key}
                  label={label}
                  value={inputs.revenueStreams[key] ?? 0}
                  onChange={v => onChange({ ...inputs, revenueStreams: { ...inputs.revenueStreams, [key]: v } })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="space-y-2">
          <button
            className="w-full flex items-center justify-between text-sm font-medium text-white/80 hover:text-white transition-colors"
            onClick={() => setExpensesOpen(o => !o)}
            type="button"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-rose-400" />
              Gastos Mensuales
              {totalExpenses > 0 && <span className="text-rose-400 font-bold text-xs">${totalExpenses.toLocaleString()}/mo</span>}
            </span>
            {expensesOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
          </button>
          {expensesOpen && (
            <div className="space-y-2 pl-1">
              {Object.entries(EXPENSE_LABELS).map(([key, label]) => (
                <NumInput
                  key={key}
                  label={label}
                  value={inputs.monthlyExpenses[key] ?? 0}
                  onChange={v => onChange({ ...inputs, monthlyExpenses: { ...inputs.monthlyExpenses, [key]: v } })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs">Meta de ingresos mensuales</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
              <Input
                type="text"
                inputMode="numeric"
                value={inputs.monthlyTarget > 0 ? String(inputs.monthlyTarget) : ''}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  onChange({ ...inputs, monthlyTarget: v === '' ? 0 : parseInt(v, 10) });
                }}
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
                type="text"
                inputMode="numeric"
                value={inputs.investmentAsk > 0 ? String(inputs.investmentAsk) : ''}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  onChange({ ...inputs, investmentAsk: v === '' ? 0 : parseInt(v, 10) });
                }}
                placeholder="50,000"
                className="pl-6 h-9 text-sm bg-white/5 border-white/15 text-white placeholder:text-white/20 focus:border-blue-500/60"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        {(totalRevenue > 0 || totalExpenses > 0) && (
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-white/50">Resumen:</span>
            {totalRevenue > 0 && <span className="text-emerald-400 font-medium">${totalRevenue.toLocaleString()}/mo ingresos</span>}
            {totalExpenses > 0 && <span className="text-rose-400 font-medium">${totalExpenses.toLocaleString()}/mo gastos</span>}
            {inputs.investmentAsk > 0 && <span className="text-blue-400 font-medium">${inputs.investmentAsk.toLocaleString()} ask</span>}
          </div>
        )}

        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
        >
          {isGenerating
            ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Generando…</>
            : <><Zap className="w-4 h-4 mr-2" />{(totalRevenue > 0 || totalExpenses > 0) ? 'Generar con mis datos' : 'Generar Plan'}</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BusinessPlanDoc {
  _meta: { business_plan_score: number; generated_at: string; artist_name: string; artist_id: number };
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
    total_monthly_revenue_usd: number; total_annual_revenue_usd: number;
    revenue_diversification_score: number; monetization_strategy: string;
  };
  financial_plan: {
    monthly_revenue: number; monthly_expenses: number; monthly_profit: number;
    profit_margin_pct: number; annual_revenue: number; annual_expenses: number; annual_profit: number;
    investment_ask: number; pre_money_valuation: number; break_even_months: number;
    use_of_funds: Record<string, number>; use_of_funds_narrative: string;
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

// ─── Constants ─────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#a855f7', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

const TABS = [
  { id: 'summary', label: 'Summary', icon: Sparkles },
  { id: 'market', label: 'Market', icon: Globe },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'financials', label: 'Financials', icon: BarChart3 },
  { id: 'pitch', label: 'Pitch Deck', icon: Presentation },
  { id: 'roadmap', label: 'Roadmap', icon: Map },
  { id: 'ops', label: 'Operations', icon: Building2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'risk', label: 'Risks', icon: Shield },
];

// ─── Utils ──────────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => {
  if (!n || !isFinite(n)) return '$0';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtNum = (n: number | string) => {
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(Math.round(num));
};

const riskBadge = (level: string) => ({
  low: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  high: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}[level?.toLowerCase()] || 'text-white/50 bg-white/5 border-white/10');

const priorityBadge = (p: string) => ({
  critical: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  high: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  medium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  low: 'bg-white/10 text-white/50 border-white/10',
}[p?.toLowerCase()] || 'bg-white/10 text-white/50 border-white/10');

const catColor: Record<string, string> = {
  release: 'text-purple-400', tour: 'text-orange-400', marketing: 'text-pink-400',
  financial: 'text-emerald-400', branding: 'text-cyan-400', growth: 'text-blue-400',
};

// ─── Shared sub-components ──────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/5 border border-white/10 p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, label, color = 'text-purple-400' }: { icon: React.ComponentType<any>; label: string; color?: string }) {
  return (
    <div className={`flex items-center gap-2 font-bold text-white text-base mb-4`}>
      <Icon className={`w-5 h-5 ${color}`} />
      {label}
    </div>
  );
}

function KpiGrid({ items }: { items: Array<{ label: string; value: string; color?: string; bg?: string }> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((k, i) => (
        <div key={i} className={`p-4 rounded-xl border ${k.bg || 'bg-white/5 border-white/10'}`}>
          <div className="text-white/40 text-xs mb-1">{k.label}</div>
          <div className={`font-bold text-lg ${k.color || 'text-white'}`}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-xs border border-white/10">{text}</span>;
}

function BulletList({ items, icon: Icon = ChevronRight, iconClass = 'text-purple-400' }: { items: string[]; icon?: React.ComponentType<any>; iconClass?: string }) {
  return (
    <ul className="space-y-2">
      {items.filter(Boolean).map((b, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-white/70">
          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Tab: Executive Summary ─────────────────────────────────────────────────────

function SummaryTab({ bp }: { bp: BusinessPlanDoc }) {
  const es = bp.executive_summary;
  return (
    <div className="space-y-5">
      {/* Key highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(es.key_highlights || []).map((h, i) => (
          <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-purple-900/30 to-blue-900/20 border border-purple-500/20 text-center">
            <div className="text-purple-300 font-bold text-lg">{h.value}</div>
            <div className="text-white/40 text-xs mt-1">{h.label}</div>
          </div>
        ))}
      </div>

      {/* Vision / Mission / Tagline */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="text-purple-400/60 text-xs uppercase tracking-widest mb-2">Vision</div>
          <p className="text-white/85 text-sm leading-relaxed">{es.vision}</p>
        </Card>
        <Card>
          <div className="text-blue-400/60 text-xs uppercase tracking-widest mb-2">Mission</div>
          <p className="text-white/85 text-sm leading-relaxed">{es.mission}</p>
        </Card>
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <div className="text-yellow-400/60 text-xs uppercase tracking-widest mb-2">Tagline</div>
          <p className="text-yellow-200 font-semibold text-sm leading-relaxed">"{es.tagline}"</p>
        </Card>
      </div>

      {/* Elevator pitch */}
      <Card className="border-emerald-500/20">
        <div className="text-emerald-400/60 text-xs uppercase tracking-widest mb-2">Elevator Pitch</div>
        <p className="text-white/80 text-sm leading-relaxed">{es.elevator_pitch}</p>
      </Card>

      {/* Investment thesis */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2 text-sm">
          <Trophy className="w-4 h-4" /> Investment Thesis
        </div>
        <p className="text-white/75 text-sm leading-relaxed">{es.investment_thesis}</p>
      </Card>
    </div>
  );
}

// ─── Tab: Market Analysis ───────────────────────────────────────────────────────

function MarketTab({ bp }: { bp: BusinessPlanDoc }) {
  const ma = bp.market_analysis;
  const marketData = [
    { name: 'TAM', value: ma.tam, fill: '#a855f7' },
    { name: 'SAM', value: ma.sam, fill: '#3b82f6' },
    { name: 'SOM', value: ma.som, fill: '#22c55e' },
  ];
  return (
    <div className="space-y-5">
      {/* TAM/SAM/SOM cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Addressable Market', val: fmt$(ma.tam), color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: 'Serviceable Addressable Market', val: fmt$(ma.sam), color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Serviceable Obtainable Market', val: fmt$(ma.som), color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        ].map((k, i) => (
          <Card key={i} className={k.bg}>
            <div className="text-white/40 text-xs mb-1">{k.label}</div>
            <div className={`font-black text-xl ${k.color}`}>{k.val}</div>
          </Card>
        ))}
      </div>

      {/* Narrative + visual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={Globe} label="Market Narrative" color="text-blue-400" />
          <p className="text-white/70 text-sm leading-relaxed mb-3">{ma.market_narrative}</p>
          <p className="text-white/60 text-sm leading-relaxed">{ma.market_opportunity}</p>
        </Card>
        <Card>
          <SectionTitle icon={Target} label="Target Audience" color="text-pink-400" />
          <div className="space-y-2 text-sm">
            <div><span className="text-white/40">Primary: </span><span className="text-white/80">{ma.target_audience?.primary}</span></div>
            <div><span className="text-white/40">Secondary: </span><span className="text-white/80">{ma.target_audience?.secondary}</span></div>
            <div><span className="text-white/40">Age Range: </span><span className="text-white/80">{ma.target_audience?.age_range}</span></div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(ma.target_audience?.psychographics || []).map((p, i) => <Pill key={i} text={p} />)}
            </div>
          </div>
        </Card>
      </div>

      {/* Market trends */}
      <Card>
        <SectionTitle icon={TrendingUp} label="Market Trends" color="text-amber-400" />
        <BulletList items={ma.market_trends || []} iconClass="text-amber-400" />
      </Card>

      {/* Competitive landscape */}
      <Card>
        <SectionTitle icon={Layers} label="Competitive Landscape" color="text-rose-400" />
        <div className="space-y-3">
          {(ma.competitive_landscape || []).map((c, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 font-bold text-white/50 text-sm">{i + 1}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white font-semibold text-sm">{c.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">{c.category}</span>
                </div>
                <p className="text-emerald-400 text-xs">{c.differentiator}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Revenue Model ─────────────────────────────────────────────────────────

function RevenueTab({ bp }: { bp: BusinessPlanDoc }) {
  const rm = bp.revenue_model;
  const growthColors: Record<string, string> = {
    high: 'text-emerald-400', medium: 'text-amber-400', low: 'text-rose-400'
  };
  const chartData = [...(rm.primary_streams || []), ...(rm.secondary_streams || [])]
    .filter(s => s.monthly_estimate_usd > 0)
    .map((s, i) => ({ name: s.name, value: s.monthly_estimate_usd, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div className="space-y-5">
      {/* Revenue totals */}
      <KpiGrid items={[
        { label: 'Monthly Revenue', value: fmt$(rm.total_monthly_revenue_usd), color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { label: 'Annual Revenue', value: fmt$(rm.total_annual_revenue_usd), color: 'text-emerald-200', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { label: 'Diversification Score', value: `${rm.revenue_diversification_score}/100`, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
        { label: 'Revenue Streams', value: String((rm.primary_streams?.length || 0) + (rm.secondary_streams?.length || 0)), color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
      ]} />

      {/* Chart + strategy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={PieChart} label="Revenue Mix" color="text-blue-400" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {chartData.map((_, i) => <Cell key={i} fill={chartData[i].fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.fill }} />
                <span className="text-white/50 truncate">{d.name}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle icon={Zap} label="Monetization Strategy" color="text-amber-400" />
          <p className="text-white/70 text-sm leading-relaxed">{rm.monetization_strategy}</p>
        </Card>
      </div>

      {/* Primary streams */}
      <Card>
        <SectionTitle icon={Star} label="Primary Revenue Streams" color="text-purple-400" />
        <div className="space-y-3">
          {(rm.primary_streams || []).map((s, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ background: PIE_COLORS[i % PIE_COLORS.length] + '30', color: PIE_COLORS[i % PIE_COLORS.length] }}>
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-semibold text-sm">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/80 font-bold text-sm">{fmt$(s.monthly_estimate_usd)}<span className="text-white/30 text-xs">/mo</span></span>
                    <span className={`text-xs font-medium ${growthColors[s.growth_potential] || 'text-white/50'}`}>{s.growth_potential}</span>
                  </div>
                </div>
                <p className="text-white/50 text-xs">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Secondary streams */}
      <Card>
        <SectionTitle icon={ShoppingBag} label="Secondary Revenue Streams" color="text-cyan-400" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(rm.secondary_streams || []).map((s, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/80 font-medium text-sm">{s.name}</span>
                <span className="text-cyan-300 font-bold text-sm">{fmt$(s.monthly_estimate_usd)}</span>
              </div>
              <p className="text-white/40 text-xs">{s.description}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Financials ────────────────────────────────────────────────────────────

function FinancialsTab({ bp }: { bp: BusinessPlanDoc }) {
  const fp = bp.financial_plan;
  const [chart, setChart] = useState<'12m' | '3yr'>('12m');
  const positive = fp.monthly_profit >= 0;
  const fundsData = Object.entries(fp.use_of_funds || {})
    .filter(([, v]) => v > 0)
    .map(([k, v], i) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div className="space-y-5">
      <KpiGrid items={[
        { label: 'Monthly Revenue', value: fmt$(fp.monthly_revenue), color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { label: 'Monthly Expenses', value: fmt$(fp.monthly_expenses), color: 'text-rose-300', bg: 'bg-rose-500/10 border-rose-500/20' },
        { label: 'Monthly Profit', value: fmt$(fp.monthly_profit), color: positive ? 'text-emerald-300' : 'text-rose-300', bg: positive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20' },
        { label: 'Profit Margin', value: `${fp.profit_margin_pct || 0}%`, color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
      ]} />

      <KpiGrid items={[
        { label: 'Annual Revenue', value: fmt$(fp.annual_revenue), color: 'text-emerald-200', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        { label: 'Investment Ask', value: fmt$(fp.investment_ask), color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20' },
        { label: 'Pre-Money Valuation', value: fmt$(fp.pre_money_valuation), color: 'text-white/90', bg: 'bg-white/5 border-white/10' },
        { label: 'Break-Even', value: `${fp.break_even_months} mo`, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
      ]} />

      {/* Chart toggle */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle icon={BarChart3} label="Financial Projections" color="text-blue-400" />
          <div className="flex gap-1">
            <button onClick={() => setChart('12m')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${chart === '12m' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:text-white'}`}>12 Months</button>
            <button onClick={() => setChart('3yr')} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${chart === '3yr' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:text-white'}`}>3 Years</button>
          </div>
        </div>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            {chart === '12m' ? (
              <AreaChart data={fp.projections_12m || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={v => fmt$(v)} width={65} />
                <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="#22c55e15" name="Revenue" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef444415" name="Expenses" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" stroke="#a855f7" fill="#a855f715" name="Profit" strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={fp.projections_3yr || []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={v => fmt$(v)} width={65} />
                <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                <Bar dataKey="revenue" fill="#22c55e" name="Revenue" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4,4,0,0]} />
                <Bar dataKey="profit" fill="#a855f7" name="Profit" radius={[4,4,0,0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Use of funds */}
      {fundsData.length > 0 && (
        <Card>
          <SectionTitle icon={PieChart} label="Use of Investment Funds" color="text-purple-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={fundsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {fundsData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {fundsData.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.fill }} />
                    <span className="text-white/70">{d.name}</span>
                  </div>
                  <span className="text-white font-bold">{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-white/50 text-sm mt-3 leading-relaxed">{fp.use_of_funds_narrative}</p>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Pitch Deck ────────────────────────────────────────────────────────────

function PitchDeckTab({ bp }: { bp: BusinessPlanDoc }) {
  const pd = bp.pitch_deck;
  const slides = pd?.slides || [];
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  const chartData = useMemo(() => {
    if (!slide) return [];
    if (slide.chart_type === 'pie' && slide.title?.includes('Funds')) {
      const uof = bp.financial_plan?.use_of_funds;
      return uof ? Object.entries(uof).map(([k, v], i) => ({ name: k, value: v, fill: PIE_COLORS[i % PIE_COLORS.length] })).filter(d => d.value > 0) : [];
    }
    if (slide.chart_type === 'pie') {
      return (bp.revenue_model?.primary_streams || []).map((s, i) => ({ name: s.name, value: s.monthly_estimate_usd, fill: PIE_COLORS[i % PIE_COLORS.length] })).filter(d => d.value > 0);
    }
    if (slide.chart_type === 'line') return bp.financial_plan?.projections_12m || [];
    return [];
  }, [slide, bp]);

  if (!slide) return <p className="text-white/40 text-sm">No pitch deck data available.</p>;

  const SLIDE_GRADIENTS = [
    'from-purple-900/40 to-indigo-900/30', 'from-rose-900/30 to-orange-900/20',
    'from-emerald-900/30 to-teal-900/20', 'from-blue-900/40 to-cyan-900/20',
    'from-amber-900/30 to-yellow-900/20', 'from-pink-900/30 to-fuchsia-900/20',
    'from-slate-900/40 to-gray-900/30', 'from-violet-900/40 to-purple-900/30',
    'from-cyan-900/30 to-blue-900/20', 'from-indigo-900/40 to-purple-900/30',
  ];

  return (
    <div className="space-y-4">
      {/* Slide view */}
      <div className={`relative min-h-[380px] rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br ${SLIDE_GRADIENTS[current % SLIDE_GRADIENTS.length]} p-6 sm:p-8`}>
        <div className="absolute top-4 right-4 text-white/25 text-sm font-mono">{current + 1}/{slides.length}</div>

        <div className="space-y-4 max-w-2xl">
          <div>
            <div className="text-white/30 text-xs uppercase tracking-widest mb-1">{slide.title}</div>
            <h2 className="text-white text-2xl sm:text-3xl font-black leading-tight">{slide.subtitle}</h2>
          </div>

          {slide.key_stat && (
            <div className="flex items-baseline gap-3">
              <span className="text-5xl sm:text-6xl font-black text-white">{slide.key_stat}</span>
              <span className="text-white/40 text-base">{slide.key_stat_label}</span>
            </div>
          )}

          <p className="text-white/65 text-sm sm:text-base leading-relaxed">{slide.body}</p>

          {slide.bullet_points && slide.bullet_points.length > 0 && (
            <ul className="space-y-2">
              {slide.bullet_points.filter(Boolean).map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/75">
                  <ChevronRight className="w-4 h-4 mt-0.5 text-white/40 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {slide.chart_type === 'pie' && chartData.length > 0 && (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                    {chartData.map((_, i) => <Cell key={i} fill={chartData[i].fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          )}

          {slide.chart_type === 'line' && chartData.length > 0 && (
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData as any[]}>
                  <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} />
                  <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: '#0f0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" stroke="#a855f7" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {slide.cta && (
            <div className="mt-2 text-lg font-bold text-white border-l-4 border-purple-400 pl-4">{slide.cta}</div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" className="border-white/20 text-white/70" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Prev
        </Button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`transition-all rounded-full ${i === current ? 'w-6 h-2.5 bg-purple-400' : 'w-2.5 h-2.5 bg-white/20 hover:bg-white/40'}`} />
          ))}
        </div>
        <Button size="sm" variant="outline" className="border-white/20 text-white/70" onClick={() => setCurrent(c => Math.min(slides.length - 1, c + 1))} disabled={current === slides.length - 1}>
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Ask / Terms */}
      {pd.ask_amount > 0 && (
        <Card className="border-purple-500/25 bg-purple-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-purple-400/60 text-xs uppercase tracking-widest mb-1">Investment Round</div>
              <div className="text-purple-200 font-black text-3xl">{fmt$(pd.ask_amount)}</div>
              <div className="text-white/50 text-sm mt-1">{pd.ask_terms}</div>
            </div>
            <div className="max-w-xs">
              <p className="text-white/50 text-sm italic">"{pd.closing_statement}"</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Roadmap ────────────────────────────────────────────────────────────────

function RoadmapTab({ bp }: { bp: BusinessPlanDoc }) {
  const rm = bp.roadmap;
  const phases = [rm.phase_1, rm.phase_2, rm.phase_3].filter(Boolean);
  const PHASE_COLORS = ['bg-purple-600/30 border-purple-500/40 text-purple-300', 'bg-blue-600/30 border-blue-500/40 text-blue-300', 'bg-emerald-600/30 border-emerald-500/40 text-emerald-300'];

  return (
    <div className="space-y-5">
      <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 inline-flex items-center gap-2">
        <Rocket className="w-4 h-4 text-purple-400" />
        <span className="text-white/50 text-sm">Current Phase: </span>
        <span className="text-purple-300 font-semibold text-sm">{rm.current_phase}</span>
      </div>

      <div className="space-y-6">
        {phases.map((phase, pi) => (
          <Card key={pi}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-lg shrink-0 ${PHASE_COLORS[pi]}`}>
                {pi + 1}
              </div>
              <div>
                <div className="text-white font-bold">{phase.name}</div>
                <div className="text-white/40 text-sm">{phase.timeframe}</div>
                <p className="text-white/60 text-sm mt-1">{phase.objective}</p>
              </div>
            </div>
            <div className="space-y-2 pl-2 border-l-2 border-white/10 ml-4">
              {(phase.milestones || []).map((m, mi) => (
                <div key={mi} className="flex items-start gap-3 pl-4 relative">
                  <div className="absolute -left-[9px] top-1.5 w-3.5 h-3.5 rounded-full bg-[#0f0f1e] border-2 border-white/20 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                  </div>
                  <div className="w-6 h-5 rounded bg-white/10 flex items-center justify-center text-white/40 text-xs font-mono shrink-0">{m.month}</div>
                  <div className="flex-1">
                    <span className="text-white/80 text-sm">{m.title}</span>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs ${catColor[m.category?.toLowerCase()] || 'text-white/30'}`}>{m.category}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${priorityBadge(m.priority)}`}>{m.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {rm.kpis && Object.keys(rm.kpis).length > 0 && (
        <Card>
          <SectionTitle icon={Target} label="Year 1 KPIs" color="text-amber-400" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(rm.kpis).map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/40 text-xs capitalize">{k.replace(/_/g, ' ')}</div>
                <div className="text-white font-bold text-base mt-0.5">{typeof v === 'number' ? fmtNum(v) : v}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Operations ────────────────────────────────────────────────────────────

function OpsTab({ bp }: { bp: BusinessPlanDoc }) {
  const ops = bp.operations;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={Building2} label="Business Model" color="text-blue-400" />
          <p className="text-white/70 text-sm leading-relaxed">{ops.business_model}</p>
        </Card>
        <Card>
          <SectionTitle icon={Globe} label="Distribution Strategy" color="text-emerald-400" />
          <p className="text-white/70 text-sm leading-relaxed">{ops.distribution_strategy}</p>
        </Card>
        <Card>
          <SectionTitle icon={Music} label="Content Pipeline" color="text-purple-400" />
          <p className="text-white/70 text-sm leading-relaxed">{ops.content_pipeline}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-white/30 text-xs">Cadence:</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium capitalize">{ops.release_cadence}</span>
          </div>
        </Card>
        <Card>
          <SectionTitle icon={Users} label="Fan Engagement" color="text-pink-400" />
          <p className="text-white/70 text-sm leading-relaxed">{ops.fan_engagement_strategy}</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={Shield} label="IP Protection" color="text-amber-400" />
          <p className="text-white/70 text-sm leading-relaxed">{ops.ip_protection_strategy}</p>
        </Card>
        <Card>
          <SectionTitle icon={Layers} label="Tech Stack & Partnerships" color="text-cyan-400" />
          <div className="space-y-3">
            <div>
              <div className="text-white/40 text-xs mb-2">Tech Stack</div>
              <div className="flex flex-wrap gap-1.5">{(ops.tech_stack || []).map((t, i) => <Pill key={i} text={t} />)}</div>
            </div>
            <div>
              <div className="text-white/40 text-xs mb-2">Key Partnerships</div>
              <div className="flex flex-wrap gap-1.5">{(ops.key_partnerships || []).map((t, i) => <Pill key={i} text={t} />)}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Team ──────────────────────────────────────────────────────────────────

function TeamTab({ bp }: { bp: BusinessPlanDoc }) {
  const team = bp.team;
  return (
    <div className="space-y-4">
      {/* Founder */}
      <Card className="border-purple-500/25 bg-gradient-to-br from-purple-900/20 to-blue-900/10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-600/40 border border-purple-500/40 flex items-center justify-center text-purple-200 font-black text-lg shrink-0">
            {(team.founder?.name || '?').charAt(0)}
          </div>
          <div className="flex-1">
            <div className="text-white font-bold text-lg">{team.founder?.name}</div>
            <div className="text-purple-300 text-sm font-medium">{team.founder?.role}</div>
            <p className="text-white/60 text-sm mt-2 leading-relaxed">{team.founder?.bio}</p>
          </div>
        </div>
      </Card>

      {/* Core team */}
      <div>
        <div className="text-white/50 text-xs uppercase tracking-widest mb-3">Core Team</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(team.core_team || []).map((m, i) => (
            <Card key={i}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-semibold text-sm">{m.role}</span>
                <Badge variant="outline" className={`text-xs border ${m.status === 'existing' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'}`}>
                  {m.status}
                </Badge>
              </div>
              <p className="text-white/50 text-xs">{m.responsibility}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Advisors */}
      {(team.advisors || []).length > 0 && (
        <div>
          <div className="text-white/50 text-xs uppercase tracking-widest mb-3">Advisors Needed</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {team.advisors.map((a, i) => (
              <Card key={i} className="border-amber-500/15">
                <div className="text-amber-300 font-medium text-sm mb-1">{a.area}</div>
                <p className="text-white/50 text-xs">{a.value_add}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="bg-white/3">
        <p className="text-white/60 text-sm leading-relaxed">{team.team_narrative}</p>
      </Card>
    </div>
  );
}

// ─── Tab: Risk Analysis ─────────────────────────────────────────────────────────

function RiskTab({ bp }: { bp: BusinessPlanDoc }) {
  const risk = bp.risk_analysis;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-white/50 text-sm">Overall Risk Level:</span>
        <span className={`px-3 py-1 rounded-full border text-sm font-semibold ${riskBadge(risk.overall_risk_level)}`}>
          {risk.overall_risk_level?.toUpperCase()} RISK
        </span>
      </div>

      <div className="space-y-3">
        {(risk.risks || []).map((r, i) => (
          <Card key={i}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60 font-medium">{r.category}</span>
                <span className={`text-xs font-medium ${riskBadge(r.probability).split(' ')[0]}`}>P: {r.probability}</span>
                <span className={`text-xs font-medium ${riskBadge(r.impact).split(' ')[0]}`}>I: {r.impact}</span>
              </div>
              <span className={`px-2 py-0.5 rounded border text-xs shrink-0 ${riskBadge(r.probability)}`}>
                {r.probability} prob.
              </span>
            </div>
            <p className="text-white/85 text-sm font-medium mb-2">{r.risk}</p>
            <div className="flex items-start gap-2 text-xs text-white/50">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{r.mitigation}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function ArtistBusinessPlanPage() {
  const params = useParams<{ artistId: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const artistId = parseInt(params.artistId || '0', 10);
  const [activeTab, setActiveTab] = useState('summary');
  const [polling, setPolling] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [baseInputs, setBaseInputs] = useState<BaseInputs>(DEFAULT_INPUTS);
  const [showInputForm, setShowInputForm] = useState(false);

  const queryKey = [`/api/business-plan/${artistId}/full-status`];

  const { data, isLoading } = useQuery<StatusResponse>({
    queryKey,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/business-plan/${artistId}/full-status`);
        return res as StatusResponse;
      } catch (err: any) {
        const msg = err?.message ?? '';
        if (msg.startsWith('404') || msg.startsWith('401')) {
          return { status: 'pending', hasPlan: false };
        }
        throw err;
      }
    },
    refetchInterval: polling ? 3000 : false,
    refetchIntervalInBackground: true,
    retry: false,
    enabled: artistId > 0,
  });

  useEffect(() => {
    if (data?.status === 'completed' || data?.status === 'failed') {
      setPolling(false);
      if (data.status === 'failed') setGenError(data.error || 'Generation failed');
    } else if (data?.status === 'generating') {
      setPolling(true);
    }
  }, [data?.status]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const totalRevenue = Object.values(baseInputs.revenueStreams).reduce((a, b) => a + b, 0);
      const totalExpenses = Object.values(baseInputs.monthlyExpenses).reduce((a, b) => a + b, 0);
      const hasData = totalRevenue > 0 || totalExpenses > 0 || baseInputs.investmentAsk > 0;
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
      return apiRequest('POST', `/api/business-plan/${artistId}/generate-full`, body);
    },
    onSuccess: () => {
      setPolling(true);
      setGenError(null);
      toast({ title: '⚡ Generating Business Plan', description: 'Analyzing your profile, catalog & economic data…' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      setGenError(err.message);
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  const bp = data?.plan as BusinessPlanDoc | undefined;
  const isGenerating = polling || data?.status === 'generating' || generateMutation.isPending;
  const score = bp?._meta?.business_plan_score ?? 0;
  const artistName = bp?._meta?.artist_name || `Artist #${artistId}`;
  const isOwner = isLoaded && !!user; // simplified — any logged-in user can try generating

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

  const TAB_CONTENT: Record<string, React.ReactNode> = bp ? {
    summary: <SummaryTab bp={bp} />,
    market: <MarketTab bp={bp} />,
    revenue: <RevenueTab bp={bp} />,
    financials: <FinancialsTab bp={bp} />,
    pitch: <PitchDeckTab bp={bp} />,
    roadmap: <RoadmapTab bp={bp} />,
    ops: <OpsTab bp={bp} />,
    team: <TeamTab bp={bp} />,
    risk: <RiskTab bp={bp} />,
  } : {};

  return (
    <div className="min-h-screen bg-[#080810]">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/20 to-[#080810] pointer-events-none" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.25), transparent)',
        }} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          {/* Back button */}
          <button
            onClick={() => history.back()}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Profile
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-white font-black text-2xl sm:text-3xl leading-tight">Business Plan</h1>
                  <div className="text-white/40 text-sm">{artistName}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-blue-500/30 text-blue-300 text-xs">AI-Generated</Badge>
                {bp && (
                  <>
                    <div className={`px-3 py-1 rounded-full border text-xs font-semibold ${
                      score >= 75 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : score >= 50 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}>
                      <span className="font-black">{score}</span>/100 — {score >= 75 ? 'Investor Ready' : score >= 50 ? 'Developing' : 'Early Stage'}
                    </div>
                    {data?.generatedAt && (
                      <span className="text-white/25 text-xs">
                        Generated {new Date(data.generatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              {bp && (
                <Button size="sm" variant="outline" className="border-white/20 text-white/70 hover:text-white" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1.5" /> Export JSON
                </Button>
              )}
              {isOwner && bp && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowInputForm(o => !o)}
                  className="border-white/20 text-white/60 hover:text-white"
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  {showInputForm ? 'Ocultar' : 'Mis datos'}
                </Button>
              )}
              {isOwner && (
                <Button
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={isGenerating}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                >
                  {isGenerating ? (
                    <><RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</>
                  ) : bp ? (
                    <><RefreshCw className="w-4 h-4 mr-1.5" /> Regenerate</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-1.5" /> Generate Plan</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">

        {/* Financial Input Form */}
        {isOwner && (showInputForm || !bp) && !isGenerating && (
          <FinancialInputForm
            inputs={baseInputs}
            onChange={setBaseInputs}
            onGenerate={() => generateMutation.mutate()}
            isGenerating={isGenerating}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-20 text-white/40">
            <Clock className="w-5 h-5 animate-pulse" />
            <span>Loading business plan…</span>
          </div>
        )}

        {/* Generating */}
        {isGenerating && !isLoading && (
          <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-6 space-y-4 mb-6">
            <div className="flex items-center gap-3 text-blue-300 font-semibold">
              <RefreshCw className="w-5 h-5 animate-spin" />
              Generating your Business Plan…
            </div>
            <p className="text-white/50 text-sm">
              The AI is reading your full artist profile, catalog, merchandise, Superstar Blueprint and economic data
              to create a complete investor-grade plan. This takes 30–90 seconds.
            </p>
            <Progress className="h-1.5 animate-pulse bg-blue-900/40" value={undefined} />
          </div>
        )}

        {/* Error */}
        {genError && !isGenerating && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-5 flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-rose-300 font-semibold">Generation failed</p>
              <p className="text-white/40 text-sm mt-0.5">{genError}</p>
            </div>
            <button onClick={() => setGenError(null)} className="text-white/30 hover:text-white/60 shrink-0">✕</button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !bp && !isGenerating && data?.status !== 'failed' && (
          <div className="flex flex-col items-center justify-center py-24 space-y-5 text-center">
            <div className="w-20 h-20 rounded-3xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
              <Briefcase className="w-10 h-10 text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-black text-xl mb-2">No Business Plan Yet</h3>
              <p className="text-white/40 text-sm max-w-md">
                {isOwner
                  ? 'Generate your AI-powered Business Plan — it reads your full catalog, merch, Superstar Blueprint and Economic Engine to create a complete investor-ready document.'
                  : 'This artist hasn\'t generated their Business Plan yet. Check back soon!'}
              </p>
            </div>
            {isOwner && (
              <Button onClick={() => generateMutation.mutate()} size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                <Zap className="w-5 h-5 mr-2" /> Generate Business Plan
              </Button>
            )}
            <div className="flex flex-wrap gap-3 justify-center text-xs text-white/25">
              {['Executive Summary', 'Market Analysis', 'Revenue Model', 'Financial Plan', 'Pitch Deck', 'Roadmap', 'Operations', 'Team', 'Risks'].map(t => (
                <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Main content with tabs */}
        {bp && !isGenerating && (
          <div className="space-y-0">
            {/* Sticky tab bar */}
            <div className="sticky top-0 z-10 bg-[#080810]/95 backdrop-blur-md pt-2 pb-0 mb-5">
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-1 bg-white/5 border border-white/10 p-1 rounded-xl w-max min-w-full">
                  {TABS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                        activeTab === t.id
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sm:hidden">{t.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tab content */}
            <div className="min-h-[60vh]">
              {TAB_CONTENT[activeTab]}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
