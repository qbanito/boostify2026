/**
 * Artist Superstar Blueprint — Full Page View
 * Route: /artist-blueprint/:artistId
 *
 * Muestra los 13 módulos del blueprint en una página completa
 * con navegación lateral, iconos y diseño premium.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Trophy,
  Zap,
  Music2,
  Eye,
  Target,
  BarChart3,
  DollarSign,
  Globe,
  Users,
  Mic2,
  Megaphone,
  RefreshCw,
  Download,
  ArrowLeft,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Star,
  Palette,
  Radio,
  TrendingUp,
  Package,
  Newspaper,
  Clock,
  Loader2,
  AlertCircle,
  Rocket,
  Crown,
  Shield,
  Film,
  Hash,
  Calendar,
  Map,
  BookOpen,
  Layers,
  HeartHandshake,
  Menu,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlueprintApiResponse {
  success: boolean;
  hasBlueprint: boolean;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  blueprintId?: number;
  globalArtistScore?: number;
  currentEra?: string;
  primaryGenre?: string;
  brandArchetype?: string;
  generatedAt?: string;
  blueprint?: Record<string, unknown>;
  error?: string;
}

// ─── Module config ─────────────────────────────────────────────────────────────

const MODULES = [
  { id: 'artist-dna',      label: 'Artist DNA',        icon: Zap,          color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  { id: 'identity',        label: 'Identidad',          icon: Sparkles,     color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  { id: 'talent',          label: 'Talento',            icon: Mic2,         color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  { id: 'sound',           label: 'Sonido',             icon: Music2,       color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  { id: 'catalog',         label: 'Catálogo',           icon: Layers,       color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  { id: 'visual-universe', label: 'Universo Visual',    icon: Palette,      color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  { id: 'performance',     label: 'Performance',        icon: Radio,        color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  { id: 'launch-campaign', label: 'Campaña de Lanzam.', icon: Rocket,       color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  { id: 'distribution',    label: 'Distribución',       icon: Globe,        color: 'text-teal-400',    bg: 'bg-teal-500/10' },
  { id: 'fanbase',         label: 'Fanbase',            icon: HeartHandshake, color: 'text-red-400',   bg: 'bg-red-500/10' },
  { id: 'pr-narrative',    label: 'PR & Narrativa',     icon: Newspaper,    color: 'text-lime-400',    bg: 'bg-lime-500/10' },
  { id: 'monetization',    label: 'Monetización',       icon: DollarSign,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { id: 'era-evolution',   label: 'Era & Evolución',    icon: TrendingUp,   color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  { id: 'next-actions',    label: 'Next 30 Days',       icon: Target,       color: 'text-violet-400',  bg: 'bg-violet-500/10' },
] as const;

// ─── Small helpers ─────────────────────────────────────────────────────────────

function Tag({ text }: { text: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-xs border border-white/10">
      {text}
    </span>
  );
}

function TagList({ items }: { items: unknown[] }) {
  const strings = items.filter(Boolean).map(String);
  if (!strings.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {strings.map((s, i) => <Tag key={i} text={s} />)}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-white/35 uppercase tracking-wide font-medium">{label}</span>
      <div className="text-white/80 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function SectionCard({ id, icon: Icon, label, iconColor, iconBg, children }: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
        </div>
        <h2 className="text-white font-bold text-lg">{label}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function StatBox({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/8 p-4">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-base leading-snug">{value}</p>
      {sub && <p className="text-white/35 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-white/8 my-2" />;
}

// ─── Score badge ───────────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const level = score >= 80 ? 'Superstar' : score >= 60 ? 'Rising Star' : score >= 40 ? 'Emerging' : 'En Desarrollo';
  const cls = score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            : score >= 60 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            : 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      <Trophy className="w-3.5 h-3.5" />
      {score}/100 · {level}
    </span>
  );
}

// ─── Section renderers ─────────────────────────────────────────────────────────

function ArtistDNASection({ bp }: { bp: Record<string, unknown> }) {
  const d = bp.artist_dna as Record<string, unknown> | undefined;
  if (!d) return <p className="text-white/30 text-sm">Sin datos</p>;
  return (
    <Grid>
      <StatBox label="Nombre Artístico" value={String(d.artist_name || '')} />
      <StatBox label="Tipo" value={String(d.artist_type || '')} />
      <StatBox label="Género Principal" value={String(d.primary_genre || '')} />
      <StatBox label="Etapa de Carrera" value={String(d.career_stage || '')} />
      <StatBox label="Año de Inicio" value={String(d.career_start_year || '')} />
      <StatBox label="Rango de Edad" value={String(d.age_range || '')} />
      <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
        <p className="text-white/40 text-xs mb-1">Esencia de Marca</p>
        <p className="text-white font-medium">{String(d.brand_essence || '')}</p>
      </div>
      <div className="sm:col-span-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4">
        <p className="text-white/40 text-xs mb-1">Tagline</p>
        <p className="text-purple-200 font-semibold text-base italic">"{String(d.tagline || '')}"</p>
      </div>
      {Array.isArray(d.secondary_genres) && d.secondary_genres.length > 0 && (
        <div className="sm:col-span-2">
          <Field label="Géneros Secundarios"><TagList items={d.secondary_genres as unknown[]} /></Field>
        </div>
      )}
    </Grid>
  );
}

function IdentitySection({ bp }: { bp: Record<string, unknown> }) {
  const id = bp.identity as Record<string, unknown> | undefined;
  if (!id) return <p className="text-white/30 text-sm">Sin datos</p>;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 p-5">
        <p className="text-white/40 text-xs mb-1">Arquetipo de Marca</p>
        <p className="text-pink-300 font-bold text-xl">{String(id.brand_archetype || '')}</p>
      </div>
      <Grid>
        <StatBox label="Estilo de Comunicación" value={String(id.communication_style || '')} />
        <StatBox label="Conexión con el Público" value={String(id.audience_connection_style || '')} />
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Voz en Redes Sociales</p>
          <p className="text-white/80">{String(id.social_media_voice || '')}</p>
        </div>
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Firma Visual</p>
          <p className="text-white/80">{String(id.visual_signature || '')}</p>
        </div>
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Propuesta de Valor Única</p>
          <p className="text-white/80">{String(id.unique_value_proposition || '')}</p>
        </div>
      </Grid>
      {Array.isArray(id.personality_traits) && (
        <Field label="Rasgos de Personalidad"><TagList items={id.personality_traits as unknown[]} /></Field>
      )}
    </div>
  );
}

function TalentSection({ bp }: { bp: Record<string, unknown> }) {
  const t = bp.talent as Record<string, unknown> | undefined;
  if (!t) return <p className="text-white/30 text-sm">Sin datos</p>;
  return (
    <div className="space-y-4">
      <Grid>
        <StatBox label="Talento Principal" value={String(t.primary_talent || '')} />
        <StatBox label="Rango Vocal" value={String(t.vocal_range || '')} />
        <StatBox label="Habilidad de Baile" value={String(t.dance_ability || '')} />
        <StatBox label="Producción" value={String(t.production_involvement || '')} />
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Estilo de Performance en Vivo</p>
          <p className="text-white/80">{String(t.live_performance_style || '')}</p>
        </div>
      </Grid>
      {Array.isArray(t.secondary_talents) && (
        <Field label="Talentos Secundarios"><TagList items={t.secondary_talents as unknown[]} /></Field>
      )}
      {Array.isArray(t.instrumental_skills) && (t.instrumental_skills as unknown[]).length > 0 && (
        <Field label="Instrumentos"><TagList items={t.instrumental_skills as unknown[]} /></Field>
      )}
      {Array.isArray(t.development_focus) && (
        <Field label="Áreas de Desarrollo"><TagList items={t.development_focus as unknown[]} /></Field>
      )}
    </div>
  );
}

function SoundSection({ bp }: { bp: Record<string, unknown> }) {
  const s = bp.sound as Record<string, unknown> | undefined;
  if (!s) return <p className="text-white/30 text-sm">Sin datos</p>;
  const bpm = s.bpm_range as Record<string, number> | undefined;
  const score = Number(s.hit_potential_score) || 0;
  return (
    <div className="space-y-4">
      <Grid>
        <StatBox label="Género" value={String(s.primary_genre || '')} />
        <StatBox label="BPM Range" value={bpm ? `${bpm.min} – ${bpm.max} BPM` : '–'} />
        <StatBox
          label="Hit Potential Score"
          value={
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-xl">{score}</span>
              <span className="text-white/40 text-sm">/100</span>
            </div>
          }
        />
        <StatBox label="Estilo Vocal" value={String(s.vocal_style || '')} />
      </Grid>
      <div className="rounded-xl bg-white/5 border border-white/8 p-4">
        <p className="text-white/40 text-xs mb-1">Hit Potential</p>
        <Progress value={score} className="h-2 mt-1" />
      </div>
      <div className="rounded-xl bg-white/5 border border-white/8 p-4">
        <p className="text-white/40 text-xs mb-1">Sonido Signature</p>
        <p className="text-white/80">{String(s.signature_sound || '')}</p>
      </div>
      <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-4">
        <p className="text-white/40 text-xs mb-1">Fórmula de Hit</p>
        <p className="text-cyan-200 font-medium">{String(s.hit_formula || '')}</p>
      </div>
      <div className="rounded-xl bg-white/5 border border-white/8 p-4">
        <p className="text-white/40 text-xs mb-1">Estilo de Producción</p>
        <p className="text-white/80">{String(s.production_style || '')}</p>
      </div>
      {Array.isArray(s.sonic_influences) && (
        <Field label="Influencias Sónicas"><TagList items={s.sonic_influences as unknown[]} /></Field>
      )}
      {Array.isArray(s.mood_keywords) && (
        <Field label="Moods"><TagList items={s.mood_keywords as unknown[]} /></Field>
      )}
      {Array.isArray(s.lyric_themes) && (
        <Field label="Temas de Letra"><TagList items={s.lyric_themes as unknown[]} /></Field>
      )}
      {Array.isArray(s.key_signatures) && (
        <Field label="Tonalidades"><TagList items={s.key_signatures as unknown[]} /></Field>
      )}
      {Array.isArray(s.sub_genres) && (
        <Field label="Sub-géneros"><TagList items={s.sub_genres as unknown[]} /></Field>
      )}
    </div>
  );
}

function CatalogSection({ bp }: { bp: Record<string, unknown> }) {
  const c = bp.catalog as Record<string, unknown> | undefined;
  if (!c) return <p className="text-white/30 text-sm">Sin datos</p>;
  const tracklist = Array.isArray(c.tracklist) ? c.tracklist as Array<{ title: string; mood: string; status: string }> : [];
  return (
    <div className="space-y-4">
      <Grid>
        <StatBox label="Total de Tracks" value={String(c.total_tracks || 0)} />
        <StatBox label="Single Principal" value={String(c.main_single || '–')} />
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Era Concept</p>
          <p className="text-indigo-300 font-semibold">{String(c.era_concept || '')}</p>
        </div>
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Estrategia de Próximo Lanzamiento</p>
          <p className="text-white/80">{String(c.next_release_strategy || '')}</p>
        </div>
      </Grid>
      {tracklist.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Tracklist</p>
          </div>
          {tracklist.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-white/25 text-xs w-5 text-right">{i + 1}</span>
                <span className="text-white/80 text-sm">{t.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {t.mood && <Tag text={t.mood} />}
                <span className={`text-xs ${t.status === 'released' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {Array.isArray(c.unreleased_concepts) && (c.unreleased_concepts as unknown[]).length > 0 && (
        <Field label="Conceptos No Lanzados"><TagList items={c.unreleased_concepts as unknown[]} /></Field>
      )}
    </div>
  );
}

function VisualSection({ bp }: { bp: Record<string, unknown> }) {
  const v = bp.visual_universe as Record<string, unknown> | undefined;
  if (!v) return <p className="text-white/30 text-sm">Sin datos</p>;
  const palette = Array.isArray(v.color_palette) ? v.color_palette as string[] : [];
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white/5 border border-white/8 p-4">
        <p className="text-white/40 text-xs mb-3">Paleta de Color — <span className="text-rose-300">{String(v.palette_name || '')}</span></p>
        <div className="flex gap-3 flex-wrap">
          {palette.map((hex, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className="w-12 h-12 rounded-xl border border-white/15 shadow-lg"
                style={{ backgroundColor: hex }}
              />
              <span className="text-white/40 text-[10px] font-mono">{hex}</span>
            </div>
          ))}
        </div>
      </div>
      <Grid>
        <StatBox label="Estética" value={<span className="text-rose-300 font-semibold">{String(v.aesthetic || '')}</span>} />
        <StatBox label="Estilo Cinematográfico" value={String(v.cinematic_style || '')} />
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Brief de Arte</p>
          <p className="text-white/70 text-sm leading-relaxed">{String(v.art_direction_brief || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Concepto de Logo</p>
          <p className="text-white/80 text-sm">{String(v.logo_concept || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Arte de Portada</p>
          <p className="text-white/80 text-sm">{String(v.cover_art_direction || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Dirección de Video</p>
          <p className="text-white/80 text-sm">{String(v.video_style || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Dirección de Fotografía</p>
          <p className="text-white/80 text-sm">{String(v.photography_direction || '')}</p>
        </div>
      </Grid>
      {Array.isArray(v.fashion_keywords) && (
        <Field label="Estilo Fashion"><TagList items={v.fashion_keywords as unknown[]} /></Field>
      )}
    </div>
  );
}

function PerformanceSection({ bp }: { bp: Record<string, unknown> }) {
  const p = bp.performance as Record<string, unknown> | undefined;
  if (!p) return <p className="text-white/30 text-sm">Sin datos</p>;
  return (
    <div className="space-y-4">
      <Grid>
        <StatBox label="Tipo de Show" value={String(p.show_type || '')} />
        <StatBox label="Capacidad de Touring" value={String(p.touring_capacity || '')} />
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Presencia en Escenario</p>
          <p className="text-white/80">{String(p.stage_presence || '')}</p>
        </div>
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Estrategia de Setlist</p>
          <p className="text-white/80">{String(p.setlist_strategy || '')}</p>
        </div>
      </Grid>
      {Array.isArray(p.live_production_elements) && (
        <Field label="Elementos de Producción en Vivo"><TagList items={p.live_production_elements as unknown[]} /></Field>
      )}
      {Array.isArray(p.performance_rituals) && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Rituales de Performance</p>
          <div className="space-y-2">
            {(p.performance_rituals as string[]).map((r, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <Star className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <span className="text-white/70">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(p.crowd_engagement_tactics) && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Tácticas de Engagement</p>
          <div className="space-y-2">
            {(p.crowd_engagement_tactics as string[]).map((t, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <Users className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <span className="text-white/70">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignSection({ bp }: { bp: Record<string, unknown> }) {
  const c = bp.launch_campaign as Record<string, unknown> | undefined;
  if (!c) return <p className="text-white/30 text-sm">Sin datos</p>;
  const kpis = c.kpis as Record<string, number | string> | undefined;
  const platforms = c.platform_strategy as Record<string, string> | undefined;
  const sequence = Array.isArray(c.launch_sequence) ? c.launch_sequence as string[] : [];
  const audience = c.target_audience as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-5">
        <p className="text-white/40 text-xs mb-1">Nombre de Campaña</p>
        <p className="text-yellow-300 font-bold text-xl">{String(c.campaign_name || '')}</p>
        <p className="text-white/60 text-sm mt-2">{String(c.campaign_concept || '')}</p>
      </div>

      {kpis && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">KPIs</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(kpis).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/5 border border-white/8 p-3">
                <p className="text-white/35 text-[10px] leading-tight mb-1">{k.replace(/_/g, ' ')}</p>
                <p className="text-white font-bold">{typeof v === 'number' ? v.toLocaleString() : String(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {audience && (
        <div className="rounded-xl bg-white/5 border border-white/8 p-4 space-y-2">
          <p className="text-white/40 text-xs font-medium">Audiencia Objetivo</p>
          <div className="text-sm"><span className="text-white/40 text-xs">Primaria: </span><span className="text-white/80">{String(audience.primary || '')}</span></div>
          <div className="text-sm"><span className="text-white/40 text-xs">Secundaria: </span><span className="text-white/80">{String(audience.secondary || '')}</span></div>
          {Array.isArray(audience.psychographics) && (
            <div className="mt-1"><TagList items={audience.psychographics as unknown[]} /></div>
          )}
        </div>
      )}

      {platforms && (
        <div className="rounded-xl bg-white/5 border border-white/8 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/8">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Estrategia por Plataforma</p>
          </div>
          {Object.entries(platforms).map(([platform, strategy]) => (
            <div key={platform} className="flex gap-3 px-4 py-2.5 border-b border-white/5 last:border-0">
              <span className="text-yellow-400 font-semibold text-xs capitalize min-w-[70px] mt-0.5">{platform}</span>
              <span className="text-white/60 text-sm">{String(strategy)}</span>
            </div>
          ))}
        </div>
      )}

      {sequence.length > 0 && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-3">Secuencia de Lanzamiento</p>
          <div className="space-y-2">
            {sequence.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</div>
                <span className="text-white/70 text-sm leading-relaxed">{String(step)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DistributionSection({ bp }: { bp: Record<string, unknown> }) {
  const d = bp.distribution as Record<string, unknown> | undefined;
  if (!d) return <p className="text-white/30 text-sm">Sin datos</p>;
  return (
    <div className="space-y-4">
      <Grid>
        <StatBox label="Frecuencia de Lanzamientos" value={String(d.release_frequency || '')} />
        <div className="sm:col-span-1 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Estrategia General</p>
          <p className="text-white/80 text-sm">{String(d.distribution_strategy || '')}</p>
        </div>
      </Grid>
      {Array.isArray(d.primary_platforms) && (
        <Field label="Plataformas Primarias"><TagList items={d.primary_platforms as unknown[]} /></Field>
      )}
      {Array.isArray(d.secondary_platforms) && (
        <Field label="Plataformas Secundarias"><TagList items={d.secondary_platforms as unknown[]} /></Field>
      )}
      {Array.isArray(d.playlist_targets) && (
        <Field label="Playlists Objetivo"><TagList items={d.playlist_targets as unknown[]} /></Field>
      )}
      {Array.isArray(d.sync_licensing_focus) && (
        <Field label="Sync Licensing"><TagList items={d.sync_licensing_focus as unknown[]} /></Field>
      )}
      {Array.isArray(d.international_markets) && (
        <Field label="Mercados Internacionales"><TagList items={d.international_markets as unknown[]} /></Field>
      )}
    </div>
  );
}

function FanbaseSection({ bp }: { bp: Record<string, unknown> }) {
  const f = bp.fanbase as Record<string, unknown> | undefined;
  if (!f) return <p className="text-white/30 text-sm">Sin datos</p>;
  const segments = Array.isArray(f.fan_segments) ? f.fan_segments as Array<{ name: string; percentage: number; behavior: string }> : [];
  const activation = Array.isArray(f.fan_activation_sequence) ? f.fan_activation_sequence as string[] : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 p-5">
        <p className="text-white/40 text-xs mb-1">Comunidad de Fans</p>
        <p className="text-red-300 font-bold text-2xl">{String(f.community_name || '')}</p>
        <p className="text-white/50 text-sm mt-1">{(Number(f.total_estimated_fans) || 0).toLocaleString()} fans estimados</p>
      </div>

      {segments.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/8 p-4 space-y-4">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Segmentos de Fans</p>
          {segments.map((seg, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-white/80 font-medium">{seg.name}</span>
                <span className="text-red-400 font-semibold">{seg.percentage}%</span>
              </div>
              <Progress value={seg.percentage} className="h-1.5" />
              <p className="text-white/40 text-xs">{seg.behavior}</p>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(f.engagement_tactics) && (
        <Field label="Tácticas de Engagement"><div className="space-y-1.5 mt-1">
          {(f.engagement_tactics as string[]).map((t, i) => (
            <div key={i} className="flex gap-2 items-start text-sm">
              <ChevronRight className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <span className="text-white/70">{t}</span>
            </div>
          ))}
        </div></Field>
      )}

      {activation.length > 0 && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-3">Secuencia de Activación</p>
          <div className="space-y-2">
            {activation.map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</div>
                <span className="text-white/70 text-sm">{String(step)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {f.crm_strategy && (
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Estrategia CRM</p>
          <p className="text-white/80 text-sm">{String(f.crm_strategy)}</p>
        </div>
      )}
    </div>
  );
}

function PRSection({ bp }: { bp: Record<string, unknown> }) {
  const p = bp.pr_narrative as Record<string, unknown> | undefined;
  if (!p) return <p className="text-white/30 text-sm">Sin datos</p>;
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-lime-500/10 to-green-500/10 border border-lime-500/20 p-5">
        <p className="text-white/40 text-xs mb-1">Titular de Prensa</p>
        <p className="text-lime-300 font-bold text-lg italic">"{String(p.press_headline || '')}"</p>
      </div>
      <Grid>
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Historia de Origen</p>
          <p className="text-white/80 text-sm leading-relaxed">{String(p.origin_story || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Momento Breakthrough</p>
          <p className="text-white/80 text-sm">{String(p.breakthrough_moment || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Capítulo Actual</p>
          <p className="text-white/80 text-sm">{String(p.current_chapter || '')}</p>
        </div>
      </Grid>
      {Array.isArray(p.media_angles) && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Ángulos de Media</p>
          <div className="space-y-2">
            {(p.media_angles as string[]).map((a, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <Newspaper className="w-3.5 h-3.5 text-lime-400 mt-0.5 shrink-0" />
                <span className="text-white/70">{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(p.speaking_points) && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Puntos Clave para Entrevistas</p>
          <div className="space-y-2">
            {(p.speaking_points as string[]).map((sp, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <ChevronRight className="w-3.5 h-3.5 text-lime-400 mt-0.5 shrink-0" />
                <span className="text-white/70">{sp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {p.press_contact_strategy && (
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Estrategia de Contacto de Prensa</p>
          <p className="text-white/80 text-sm">{String(p.press_contact_strategy)}</p>
        </div>
      )}
    </div>
  );
}

function MonetizationSection({ bp }: { bp: Record<string, unknown> }) {
  const m = bp.monetization as Record<string, unknown> | undefined;
  if (!m) return <p className="text-white/30 text-sm">Sin datos</p>;
  const merch = Array.isArray(m.merch_products) ? m.merch_products as Array<{ name: string; type: string; price_usd: number }> : [];
  const streamTargets = m.streaming_targets as Record<string, number> | undefined;
  const ticketRange = m.ticket_price_range as Record<string, number> | undefined;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 p-5">
        <p className="text-white/40 text-xs mb-1">Revenue Proyectado — Año 1</p>
        <p className="text-emerald-300 font-bold text-3xl">${(Number(m.projected_year1_revenue_usd) || 0).toLocaleString()}</p>
        <p className="text-white/50 text-sm mt-1">Modelo: {String(m.revenue_model || '')}</p>
      </div>

      <Grid>
        {ticketRange && (
          <StatBox label="Rango de Tickets" value={`$${ticketRange.min} – $${ticketRange.max}`} />
        )}
        <StatBox label="NFT Strategy" value={String(m.nft_strategy || '')} />
      </Grid>

      {Array.isArray(m.revenue_pillars) && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Pilares de Revenue</p>
          <div className="space-y-1.5">
            {(m.revenue_pillars as string[]).map((r, i) => (
              <div key={i} className="flex gap-3 items-center">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
                <span className="text-white/70 text-sm">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {streamTargets && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Streaming Targets</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(streamTargets).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/5 border border-white/8 p-3">
                <p className="text-white/35 text-[10px] mb-1">{k.replace(/_/g, ' ')}</p>
                <p className="text-emerald-400 font-bold">{v.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {merch.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Merchandise</p>
          </div>
          {merch.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0">
              <div>
                <p className="text-white/80 text-sm">{item.name}</p>
                <p className="text-white/35 text-xs capitalize">{item.type}</p>
              </div>
              <span className="text-emerald-400 font-semibold">${item.price_usd}</span>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(m.brand_partnership_targets) && (
        <Field label="Brand Partnerships Objetivo"><TagList items={m.brand_partnership_targets as unknown[]} /></Field>
      )}

      {Array.isArray(m.value_protection_rules) && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
          <p className="text-amber-400 text-xs font-semibold mb-2 uppercase tracking-wide">Reglas de Protección de Valor</p>
          {(m.value_protection_rules as string[]).map((rule, i) => (
            <div key={i} className="flex gap-2 items-start text-sm mb-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <span className="text-amber-200/70">{rule}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EraSection({ bp }: { bp: Record<string, unknown> }) {
  const e = bp.era_evolution as Record<string, unknown> | undefined;
  if (!e) return <p className="text-white/30 text-sm">Sin datos</p>;
  const milestones = Array.isArray(e.era_milestones) ? e.era_milestones as string[] : [];
  const triggers = Array.isArray(e.evolution_triggers) ? e.evolution_triggers as string[] : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 p-5">
        <p className="text-white/40 text-xs mb-1">Era Actual</p>
        <p className="text-amber-300 font-bold text-2xl">{String(e.current_era || '')}</p>
        <p className="text-white/60 text-sm mt-2">{String(e.era_concept || '')}</p>
        <p className="text-white/40 text-xs mt-2">Duración: {String(e.era_duration_months || 12)} meses</p>
      </div>

      {milestones.length > 0 && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-3">Milestones de la Era</p>
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span className="text-white/70 text-sm">{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Grid>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Próxima Era</p>
          <p className="text-amber-200/70 text-sm">{String(e.next_era_concept || '')}</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/8 p-4">
          <p className="text-white/40 text-xs mb-1">Visión de Legado</p>
          <p className="text-white/70 text-sm">{String(e.legacy_vision || '')}</p>
        </div>
      </Grid>

      {triggers.length > 0 && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-2">Triggers de Evolución</p>
          <div className="space-y-1.5">
            {triggers.map((t, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <span className="text-white/70">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NextActionsSection({ bp }: { bp: Record<string, unknown> }) {
  const meta = bp._meta as Record<string, unknown> | undefined;
  const actions = Array.isArray(meta?.next_actions) ? meta!.next_actions as string[] : [];
  const agents = meta?.agents as Record<string, string> | undefined;

  return (
    <div className="space-y-4">
      {actions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-white/35 uppercase tracking-wide font-medium mb-3">Próximas 5 Acciones — Siguientes 30 días</p>
          {actions.map((action, i) => (
            <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
              <div className="w-7 h-7 rounded-full bg-violet-500/25 text-violet-300 text-sm flex items-center justify-center shrink-0 font-bold">{i + 1}</div>
              <span className="text-white/80 text-sm leading-relaxed">{String(action)}</span>
            </div>
          ))}
        </div>
      )}

      {agents && (
        <div className="rounded-xl bg-white/5 border border-white/8 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Briefings para Agentes AI</p>
          </div>
          {Object.entries(agents).map(([agentKey, brief]) => (
            <div key={agentKey} className="px-4 py-3 border-b border-white/5 last:border-0">
              <p className="text-violet-400 text-xs font-semibold capitalize mb-1">{agentKey.replace(/_/g, ' ')}</p>
              <p className="text-white/60 text-sm">{String(brief)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ArtistBlueprintPage() {
  const { artistId } = useParams<{ artistId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('artist-dna');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const [genResult, setGenResult] = useState<'success' | 'error' | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const numericId = parseInt(artistId || '', 10);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const { data, isLoading, refetch } = useQuery<BlueprintApiResponse>({
    queryKey: [`/api/artist-blueprint/${numericId}`],
    queryFn: async () => {
      try {
        return await apiRequest('GET', `/api/artist-blueprint/${numericId}`) as BlueprintApiResponse;
      } catch (err: any) {
        if (err?.message?.includes('404') || err?.status === 404) {
          return { success: false, hasBlueprint: false, status: 'pending' as const };
        }
        throw err;
      }
    },
    enabled: !isNaN(numericId),
    refetchInterval: (q) => q.state.data?.status === 'generating' ? 3000 : false,
  });

  // ─── Generate mutation ───────────────────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/artist-blueprint/${numericId}/generate`);
    },
    onSuccess: () => {
      setGenResult('success');
      setTimeout(() => refetch(), 2000);
    },
    onError: (err: any) => {
      setGenResult('error');
      setGenError(err?.message ?? 'Error al generar');
    },
  });

  // ─── Download ───────────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (!data?.blueprint) return;
    const blob = new Blob([JSON.stringify(data.blueprint, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint_${numericId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Active section tracking ─────────────────────────────────────────────────

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const sections = MODULES.map(m => document.getElementById(m.id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActiveSection(entry.target.id);
      });
    }, { root: container, threshold: 0.3 });
    sections.forEach(s => observer.observe(s));
    return () => observer.disconnect();
  }, [data]);

  // ─── Scroll to section ────────────────────────────────────────────────────────

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      setMobileSidebarOpen(false);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────────

  const bp = data?.blueprint ?? {};
  const artistName = (bp.artist_dna as any)?.artist_name || `Artista #${numericId}`;
  const score = data?.globalArtistScore ?? (bp._meta as any)?.global_artist_score ?? null;
  const era = data?.currentEra ?? (bp.era_evolution as any)?.current_era ?? null;
  const archetype = data?.brandArchetype ?? (bp.identity as any)?.brand_archetype ?? null;
  const genre = data?.primaryGenre ?? (bp.artist_dna as any)?.primary_genre ?? null;
  const generatedAt = data?.generatedAt;
  const status = data?.status ?? 'pending';

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080810] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
          <p className="text-white/50">Cargando blueprint...</p>
        </div>
      </div>
    );
  }

  // ─── Not generated ────────────────────────────────────────────────────────────

  if (!data?.hasBlueprint || status === 'pending') {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-purple-500/15 flex items-center justify-center mx-auto">
            <Trophy className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-2xl mb-2">Superstar Blueprint</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Tu blueprint maestro con 13 módulos aún no fue generado.<br />
              El AI analizará todos los datos del artista y creará una estrategia personalizada de superestrella.
            </p>
          </div>
          {genResult === 'success' && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-sm">
              Generación iniciada — actualizando en segundos...
            </div>
          )}
          {genResult === 'error' && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
              {genError || 'Error al iniciar la generación'}
            </div>
          )}
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generando...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generar Blueprint</>
            )}
          </Button>
          <button
            onClick={() => window.history.back()}
            className="text-white/30 text-sm hover:text-white/60 transition-colors"
          >
            ← Volver al perfil
          </button>
        </div>
      </div>
    );
  }

  // ─── Generating spinner ───────────────────────────────────────────────────────

  if (status === 'generating') {
    return (
      <div className="min-h-screen bg-[#080810] flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-purple-500/15 flex items-center justify-center">
              <Sparkles className="w-9 h-9 text-purple-400" />
            </div>
          </div>
          <h1 className="text-white font-bold text-xl">Generando tu Blueprint...</h1>
          <p className="text-white/40 text-sm">El AI está construyendo tu estrategia de superestrella</p>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-purple-500 animate-[shimmer_2s_ease-in-out_infinite] w-1/2 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // ─── Main page ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080810] flex flex-col">

      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#080810]/90 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">

          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => window.history.back()}
              className="text-white/40 hover:text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base truncate">{artistName}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span className="text-white/35 text-xs">Superstar Blueprint</span>
                {era && <><span className="text-white/20 text-xs">·</span><span className="text-amber-400/80 text-xs">{era}</span></>}
                {genre && <><span className="text-white/20 text-xs">·</span><span className="text-purple-400/80 text-xs">{genre}</span></>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {score !== null && <ScorePill score={Number(score)} />}
            <Button variant="ghost" size="sm" onClick={handleDownload} className="hidden sm:flex text-white/50 hover:text-white gap-1.5">
              <Download className="w-4 h-4" />
              JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="text-white/50 hover:text-white gap-1.5 hidden sm:flex">
              <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              Regenerar
            </Button>
            <button
              className="sm:hidden text-white/50 hover:text-white"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className={`
          fixed sm:sticky top-[57px] left-0 h-[calc(100vh-57px)] sm:h-auto sm:max-h-[calc(100vh-57px)]
          w-60 shrink-0 bg-[#080810] sm:bg-transparent border-r border-white/8
          overflow-y-auto z-30 transition-transform duration-200
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'}
        `}>
          <nav className="p-3 space-y-0.5">
            {MODULES.map((m) => {
              const Icon = m.icon;
              const isActive = activeSection === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => scrollTo(m.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all text-sm ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isActive ? m.bg : 'bg-transparent'}`}>
                    <Icon className={`w-3.5 h-3.5 ${isActive ? m.color : 'text-current'}`} />
                  </div>
                  <span className="truncate font-medium">{m.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />}
                </button>
              );
            })}
          </nav>

          {archetype && (
            <div className="px-4 py-3 border-t border-white/8 mx-3">
              <p className="text-white/25 text-[10px] uppercase tracking-wide mb-1">Arquetipo</p>
              <p className="text-white/60 text-xs font-medium">{archetype}</p>
            </div>
          )}
          {generatedAt && (
            <div className="px-4 py-2 mx-3 mb-3">
              <p className="text-white/20 text-[10px]">
                {new Date(generatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </aside>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-14">

          {/* Hero strip */}
          <div className="rounded-2xl bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-indigo-900/30 border border-white/10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-white/40 text-xs mb-1 uppercase tracking-wider">Superstar Blueprint v2.0</p>
                <h2 className="text-white font-black text-3xl sm:text-4xl">{artistName}</h2>
                <div className="flex flex-wrap gap-2 mt-3">
                  {era && <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">{era}</Badge>}
                  {genre && <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">{genre}</Badge>}
                  {archetype && <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-xs">{archetype}</Badge>}
                </div>
              </div>
              {score !== null && (
                <div className="text-right shrink-0">
                  <p className="text-white/30 text-xs mb-1">Global Artist Score</p>
                  <p className="text-white font-black text-5xl">{score}</p>
                  <p className="text-white/30 text-xs">/100</p>
                </div>
              )}
            </div>
          </div>

          {/* Sections */}
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <SectionCard key={mod.id} id={mod.id} icon={Icon} label={mod.label} iconColor={mod.color} iconBg={mod.bg}>
                {mod.id === 'artist-dna'      && <ArtistDNASection bp={bp} />}
                {mod.id === 'identity'         && <IdentitySection bp={bp} />}
                {mod.id === 'talent'           && <TalentSection bp={bp} />}
                {mod.id === 'sound'            && <SoundSection bp={bp} />}
                {mod.id === 'catalog'          && <CatalogSection bp={bp} />}
                {mod.id === 'visual-universe'  && <VisualSection bp={bp} />}
                {mod.id === 'performance'      && <PerformanceSection bp={bp} />}
                {mod.id === 'launch-campaign'  && <CampaignSection bp={bp} />}
                {mod.id === 'distribution'     && <DistributionSection bp={bp} />}
                {mod.id === 'fanbase'          && <FanbaseSection bp={bp} />}
                {mod.id === 'pr-narrative'     && <PRSection bp={bp} />}
                {mod.id === 'monetization'     && <MonetizationSection bp={bp} />}
                {mod.id === 'era-evolution'    && <EraSection bp={bp} />}
                {mod.id === 'next-actions'     && <NextActionsSection bp={bp} />}
                <Divider />
              </SectionCard>
            );
          })}

          {/* Bottom actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 pb-12">
            <Button onClick={handleDownload} variant="outline" className="border-white/15 text-white/70 hover:text-white gap-2">
              <Download className="w-4 h-4" /> Descargar JSON
            </Button>
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} variant="outline" className="border-white/15 text-white/70 hover:text-white gap-2">
              <RefreshCw className={`w-4 h-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
              Regenerar Blueprint
            </Button>
            <Button onClick={() => window.history.back()} variant="ghost" className="text-white/40 hover:text-white gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver al Perfil
            </Button>
          </div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 sm:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
    </div>
  );
}
