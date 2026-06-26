import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Mail, RefreshCw, Loader2, Pause, Play, Power, Sparkles, Inbox, Send,
  TrendingUp, AlertTriangle, CheckCircle2, Globe, Users, Zap, Clock,
  ShieldCheck, Reply, Trophy, XCircle, Activity, Brain,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

// ── Types ──────────────────────────────────────────────────────────────────
interface Overview {
  ceiling: { target: number; sentToday: number; remaining: number };
  providersToday: { provider: string; sent: number }[];
  last7Days: { date: string; sent: number }[];
  funnel: { sent: number; opened: number; clicked: number; replied: number; bounced: number };
  pool: { activeAccounts: number; activeDomains: number; pendingDomains: number };
  leads: { total: number; ready: number; sent: number; claimed: number };
  replies: { total: number; new: number; read: number; replied: number; won: number; lost: number };
  controls: { global: boolean; channels: Record<string, boolean>; pausedChannels: string[]; updatedAt?: string };
  campaigns: { id: string; name: string; schedule: string; audience: string; provider: string; channel: string }[];
}

interface ReplyRow {
  id: number;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  body: string | null;
  provider: string | null;
  lead_handle: string | null;
  status: string;
  received_at: string;
}

interface Recommendation {
  title: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

interface Analysis {
  healthScore: number;
  headline: string;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: Recommendation[];
  generatedAt: string;
  model: string;
  source: 'openai' | 'heuristic';
}

const REPLY_STATUS_STYLE: Record<string, string> = {
  new: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  read: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  replied: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  won: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  lost: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
};

const IMPACT_STYLE: Record<string, string> = {
  high: 'bg-red-500/20 text-red-300 border-red-500/40',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

function pct(n: number, d: number): string {
  if (!d) return '0%';
  return `${Math.round((n / d) * 100)}%`;
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// ── Stat tile ──────────────────────────────────────────────────────────────
function StatTile({ icon: Icon, label, value, sub, tone = 'default' }: {
  icon: any; label: string; value: string | number; sub?: string; tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneStyle = {
    default: 'border-white/10 text-white',
    good: 'border-emerald-500/30 text-emerald-300',
    warn: 'border-amber-500/30 text-amber-300',
    bad: 'border-red-500/30 text-red-300',
  }[tone];
  return (
    <div className={`flex flex-col gap-1 rounded-xl border ${toneStyle} bg-black/30 p-3 min-w-0`}>
      <div className="flex items-center gap-1.5 text-[11px] text-white/50 uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-bold leading-none">{value}</div>
      {sub && <div className="text-[11px] text-white/40 truncate">{sub}</div>}
    </div>
  );
}

export function EmailCommandCenter() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const [busyChannel, setBusyChannel] = useState<string | null>(null);
  const [busyReply, setBusyReply] = useState<number | null>(null);
  const [replyFilter, setReplyFilter] = useState<string>('all');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest('GET', '/api/admin/email-command/overview');
      if (d?.success) setOverview(d as Overview);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el panel de email', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadReplies = useCallback(async (status: string) => {
    try {
      const d = await apiRequest('GET', `/api/admin/email-command/replies?status=${encodeURIComponent(status)}&limit=100`);
      if (d?.success) setReplies(d.replies || []);
    } catch { /* ignore */ }
  }, []);

  const loadAnalysis = useCallback(async () => {
    try {
      const d = await apiRequest('GET', '/api/admin/email-command/analysis');
      if (d?.success && d.analysis) setAnalysis(d.analysis as Analysis);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadOverview();
    loadReplies('all');
    loadAnalysis();
  }, [loadOverview, loadReplies, loadAnalysis]);

  const toggleGlobal = useCallback(async (paused: boolean) => {
    setTogglingGlobal(true);
    try {
      const d = await apiRequest('POST', '/api/admin/email-command/controls', { global: paused });
      if (d?.success) {
        toast({ title: paused ? 'Envíos PAUSADOS' : 'Envíos REANUDADOS', description: paused ? 'Todo el email automático está detenido.' : 'El email automático vuelve a fluir.' });
        loadOverview();
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cambiar el interruptor', variant: 'destructive' });
    } finally {
      setTogglingGlobal(false);
    }
  }, [toast, loadOverview]);

  const toggleChannel = useCallback(async (channel: string, paused: boolean) => {
    setBusyChannel(channel);
    try {
      const d = await apiRequest('POST', '/api/admin/email-command/controls', { channel, paused });
      if (d?.success) loadOverview();
    } catch {
      toast({ title: 'Error', description: 'No se pudo cambiar el canal', variant: 'destructive' });
    } finally {
      setBusyChannel(null);
    }
  }, [toast, loadOverview]);

  const setReplyStatus = useCallback(async (id: number, status: string) => {
    setBusyReply(id);
    try {
      const d = await apiRequest('POST', `/api/admin/email-command/replies/${id}/status`, { status });
      if (d?.success) {
        setReplies((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
        loadOverview();
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar la respuesta', variant: 'destructive' });
    } finally {
      setBusyReply(null);
    }
  }, [toast, loadOverview]);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const d = await apiRequest('POST', '/api/admin/email-command/analyze', {});
      if (d?.success && d.analysis) {
        setAnalysis(d.analysis as Analysis);
        toast({ title: 'Análisis listo', description: `Salud ${d.analysis.healthScore}/100 · ${d.analysis.source === 'openai' ? 'IA' : 'heurístico'}` });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el análisis', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  }, [toast]);

  const onReplyFilter = useCallback((status: string) => {
    setReplyFilter(status);
    loadReplies(status);
  }, [loadReplies]);

  const c = overview?.controls;
  const isPaused = !!c?.global;
  const ceiling = overview?.ceiling;
  const utilization = ceiling && ceiling.target > 0 ? ceiling.sentToday / ceiling.target : 0;
  const maxDay = Math.max(1, ...(overview?.last7Days || []).map((d) => d.sent));
  const maxProvider = Math.max(1, ...(overview?.providersToday || []).map((p) => p.sent));
  const funnel = overview?.funnel;

  return (
    <div className="space-y-4">
      {/* Header + global kill switch */}
      <Card className={`border-0 ${isPaused ? 'bg-red-950/40 ring-1 ring-red-500/40' : 'bg-black/40'}`}>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-pink-400" />
              Email Command Center
              {isPaused && <Badge className="bg-red-500/20 text-red-300 border-red-500/40">PAUSADO</Badge>}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button
                size="sm"
                variant={isPaused ? 'default' : 'destructive'}
                onClick={() => toggleGlobal(!isPaused)}
                disabled={togglingGlobal}
                className="w-full sm:w-auto justify-center"
              >
                {togglingGlobal ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Power className="h-4 w-4 mr-1.5" />}
                {isPaused ? 'Reanudar envíos' : 'Pausar TODO'}
              </Button>
              <Button size="sm" variant="outline" onClick={loadOverview} disabled={loading} className="shrink-0">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-1">
            Control absoluto de cada email automático (plataforma + GitHub Actions). El interruptor pausa al instante todos los envíos.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <StatTile icon={Send} label="Enviados hoy" value={ceiling?.sentToday ?? 0} sub={`de ${ceiling?.target ?? 0}`} tone={utilization > 0.95 ? 'warn' : 'default'} />
            <StatTile icon={Zap} label="Restante" value={ceiling?.remaining ?? 0} sub={pct(ceiling?.sentToday ?? 0, ceiling?.target ?? 0) + ' usado'} tone={utilization < 0.3 ? 'warn' : 'good'} />
            <StatTile icon={Users} label="Cuentas pool" value={overview?.pool.activeAccounts ?? 0} sub="Resend activos" />
            <StatTile icon={Globe} label="Dominios" value={overview?.pool.activeDomains ?? 0} sub={`${overview?.pool.pendingDomains ?? 0} pendientes`} tone={(overview?.pool.activeDomains ?? 0) >= 3 ? 'good' : 'warn'} />
            <StatTile icon={Inbox} label="Respuestas" value={overview?.replies.total ?? 0} sub={`${overview?.replies.new ?? 0} nuevas`} tone={(overview?.replies.new ?? 0) > 0 ? 'good' : 'default'} />
            <StatTile icon={ShieldCheck} label="Leads IG" value={overview?.leads.total ?? 0} sub={`${overview?.leads.ready ?? 0} listos`} />
          </div>
        </CardContent>
      </Card>

      {/* Trend + providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-0 bg-black/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Volumen últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.last7Days?.length ? (
              <div className="flex items-end justify-between gap-1.5 h-28">
                {overview.last7Days.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                    <div className="text-[10px] text-white/50">{d.sent}</div>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-pink-600/60 to-pink-400/80"
                      style={{ height: `${Math.max(4, (d.sent / maxDay) * 84)}px` }}
                    />
                    <div className="text-[9px] text-white/40 truncate w-full text-center">{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40 py-6 text-center">Sin datos de envío todavía.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-black/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4 text-blue-400" /> Por proveedor (hoy)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.providersToday?.length ? (
              <div className="space-y-2">
                {overview.providersToday.slice(0, 8).map((p) => (
                  <div key={p.provider} className="flex items-center gap-2 text-xs">
                    <span className="w-24 sm:w-28 truncate text-white/60 shrink-0">{p.provider}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden min-w-0">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${(p.sent / maxProvider) * 100}%` }} />
                    </div>
                    <span className="w-10 text-right text-white/70 shrink-0">{p.sent}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/40 py-6 text-center">Ningún proveedor ha enviado hoy.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deliverability funnel */}
      <Card className="border-0 bg-black/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-white/70">
            <Reply className="h-4 w-4 text-purple-400" /> Embudo de entregabilidad (30 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <StatTile icon={Send} label="Enviados" value={funnel?.sent ?? 0} />
            <StatTile icon={CheckCircle2} label="Aperturas" value={funnel?.opened ?? 0} sub={pct(funnel?.opened ?? 0, funnel?.sent ?? 0)} tone="good" />
            <StatTile icon={Zap} label="Clicks" value={funnel?.clicked ?? 0} sub={pct(funnel?.clicked ?? 0, funnel?.sent ?? 0)} />
            <StatTile icon={Reply} label="Respuestas" value={funnel?.replied ?? 0} sub={pct(funnel?.replied ?? 0, funnel?.sent ?? 0)} tone="good" />
            <StatTile icon={AlertTriangle} label="Rebotes" value={funnel?.bounced ?? 0} sub={pct(funnel?.bounced ?? 0, funnel?.sent ?? 0)} tone={(funnel?.bounced ?? 0) > 0 ? 'bad' : 'default'} />
          </div>
        </CardContent>
      </Card>

      {/* Automated campaigns + per-channel pause */}
      <Card className="border-0 bg-black/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-white/70">
            <Clock className="h-4 w-4 text-amber-400" /> Campañas automáticas (GitHub Actions)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(overview?.campaigns || []).map((cm) => {
              const paused = !!c?.channels?.[cm.channel];
              return (
                <div key={cm.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-white/10 bg-black/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{cm.name}</span>
                      {paused && <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">PAUSADO</Badge>}
                    </div>
                    <div className="text-[11px] text-white/45 truncate">{cm.schedule} · {cm.audience} · {cm.provider}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={paused ? 'default' : 'outline'}
                    onClick={() => toggleChannel(cm.channel, !paused)}
                    disabled={busyChannel === cm.channel}
                    className="w-full sm:w-auto justify-center shrink-0"
                  >
                    {busyChannel === cm.channel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : paused ? <><Play className="h-3.5 w-3.5 mr-1" />Reanudar</> : <><Pause className="h-3.5 w-3.5 mr-1" />Pausar</>}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-white/40 mt-2">Pausar un canal aquí detiene esa campaña en el próximo cron. El interruptor global tiene prioridad sobre todo.</p>
        </CardContent>
      </Card>

      {/* Replies inbox */}
      <Card className="border-0 bg-black/40">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white/70">
              <Inbox className="h-4 w-4 text-pink-400" /> Bandeja de respuestas
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
              {['all', 'new', 'replied', 'won', 'lost'].map((s) => (
                <button
                  key={s}
                  onClick={() => onReplyFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${replyFilter === s ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' : 'bg-white/5 text-white/50 border-white/10 hover:text-white/80'}`}
                >
                  {s === 'all' ? 'Todas' : s === 'new' ? 'Nuevas' : s === 'replied' ? 'Respondidas' : s === 'won' ? 'Ganadas' : 'Perdidas'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {replies.length ? (
            <ScrollArea className="h-[320px] pr-2">
              <div className="space-y-2">
                {replies.map((r) => (
                  <div key={r.id} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">{r.from_name || r.from_email}</span>
                          <Badge className={`text-[10px] ${REPLY_STATUS_STYLE[r.status] || REPLY_STATUS_STYLE.read}`}>{r.status}</Badge>
                          <span className="text-[11px] text-white/40">{timeAgo(r.received_at)}</span>
                        </div>
                        <div className="text-[11px] text-white/45 truncate">{r.from_email}{r.provider ? ` · ${r.provider}` : ''}</div>
                        {r.subject && <div className="text-xs text-white/70 mt-1 truncate">{r.subject}</div>}
                        {r.body && <div className="text-[11px] text-white/50 mt-1 line-clamp-2 break-words">{r.body}</div>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {([
                        { s: 'read', label: 'Leída', icon: CheckCircle2 },
                        { s: 'replied', label: 'Respondida', icon: Reply },
                        { s: 'won', label: 'Ganada', icon: Trophy },
                        { s: 'lost', label: 'Perdida', icon: XCircle },
                      ] as const).map(({ s, label, icon: Icon }) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={r.status === s ? 'default' : 'outline'}
                          onClick={() => setReplyStatus(r.id, s)}
                          disabled={busyReply === r.id}
                          className="h-7 px-2 text-[11px]"
                        >
                          {busyReply === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Icon className="h-3 w-3 mr-1" />{label}</>}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8">
              <Inbox className="h-8 w-8 mx-auto text-white/20 mb-2" />
              <p className="text-xs text-white/40">Sin respuestas todavía. Se capturan automáticamente vía webhook de Resend o manualmente.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI analyst */}
      <Card className="border-0 bg-gradient-to-br from-purple-950/40 to-black/40 ring-1 ring-purple-500/20">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-sm text-white/80">
              <Brain className="h-4 w-4 text-purple-400" /> Agente IA — Analista de Email
            </CardTitle>
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={analyzing}
              className="w-full sm:w-auto sm:ml-auto justify-center bg-purple-600 hover:bg-purple-500"
            >
              {analyzing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Analizar ahora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analysis ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 ${analysis.healthScore >= 70 ? 'border-emerald-500/50 text-emerald-300' : analysis.healthScore >= 45 ? 'border-amber-500/50 text-amber-300' : 'border-red-500/50 text-red-300'}`}>
                    <span className="text-lg font-bold leading-none">{analysis.healthScore}</span>
                    <span className="text-[8px] text-white/40">/100</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">{analysis.headline}</div>
                    <div className="text-[11px] text-white/40">
                      {analysis.source === 'openai' ? `IA · ${analysis.model}` : 'Heurístico'} · {timeAgo(analysis.generatedAt)}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">{analysis.summary}</p>

              {(analysis.strengths?.length > 0 || analysis.risks?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {analysis.strengths?.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <div className="text-[11px] font-semibold text-emerald-300 mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Fortalezas</div>
                      <ul className="space-y-1">
                        {analysis.strengths.map((s, i) => <li key={i} className="text-[11px] text-white/60">• {s}</li>)}
                      </ul>
                    </div>
                  )}
                  {analysis.risks?.length > 0 && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                      <div className="text-[11px] font-semibold text-red-300 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Riesgos</div>
                      <ul className="space-y-1">
                        {analysis.risks.map((s, i) => <li key={i} className="text-[11px] text-white/60">• {s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {analysis.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wide">Recomendaciones</div>
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{r.title}</span>
                        <Badge className={`text-[10px] ${IMPACT_STYLE[r.impact] || IMPACT_STYLE.low}`}>{r.impact}</Badge>
                        <Badge className="text-[10px] bg-white/5 text-white/50 border-white/10">{r.category}</Badge>
                      </div>
                      <p className="text-[11px] text-white/55 mt-1 break-words">{r.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="h-8 w-8 mx-auto text-purple-400/30 mb-2" />
              <p className="text-xs text-white/40">Pulsa "Analizar ahora" para que el agente revise tus métricas y recomiende mejoras concretas.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default EmailCommandCenter;
