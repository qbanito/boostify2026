import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Upload, Sparkles, RefreshCw, Download, Copy, CheckCircle2, Instagram,
  Loader2, Users, Send, FileSpreadsheet, ExternalLink, Radar, TrendingUp, Mail,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

interface Stats { total: number; new: number; ready: number; sent: number; claimed: number; }
interface FunnelStage { key: string; label: string; count: number; pctOfTop: number; convFromPrev: number; }
interface FunnelSource { source: string; imported: number; sent: number; claimed: number; claimRate: number; }
interface Funnel { stages: FunnelStage[]; overallConversion: number; bySource: FunnelSource[]; }
interface Lead {
  id: number; handle: string; full_name: string; profile_url: string;
  profile_image_url: string | null; followers: number | null; email: string | null;
  slug: string | null; claim_url: string | null; dm_text_es: string | null;
  dm_text_en: string | null; dm_lang: 'es' | 'en' | null; dm_status: string; user_id: number | null;
}

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  sent: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  claimed: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
};

export function InstagramLeadsPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [variant, setVariant] = useState<string>('launch');
  const [applyingVariant, setApplyingVariant] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [discovery, setDiscovery] = useState<{ withIg: number; imported: number } | null>(null);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [emailInfo, setEmailInfo] = useState<{ emailable: number; withEmail: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async () => {
    try {
      const d = await apiRequest('GET', '/api/admin/instagram-leads/stats');
      if (d?.success) setStats(d);
    } catch { /* ignore */ }
  }, []);

  const loadDiscovery = useCallback(async () => {
    try {
      const d = await apiRequest('GET', '/api/admin/instagram-leads/discovery-available');
      if (d?.success) setDiscovery({ withIg: d.withIg, imported: d.imported });
    } catch { /* ignore */ }
  }, []);

  const loadFunnel = useCallback(async () => {
    try {
      const d = await apiRequest('GET', '/api/admin/instagram-leads/funnel');
      if (d?.success) setFunnel({ stages: d.stages, overallConversion: d.overallConversion, bySource: d.bySource });
    } catch { /* ignore */ }
  }, []);

  const loadEmailInfo = useCallback(async () => {
    try {
      const d = await apiRequest('GET', '/api/admin/instagram-leads/email-available');
      if (d?.success) setEmailInfo({ emailable: d.emailable, withEmail: d.withEmail });
    } catch { /* ignore */ }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest('GET', `/api/admin/instagram-leads/list?status=${statusFilter}&limit=300`);
      if (d?.success) setLeads(d.leads || []);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la lista', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadLeads(); }, [loadLeads]);
  useEffect(() => { loadDiscovery(); }, [loadDiscovery]);
  useEffect(() => { loadFunnel(); }, [loadFunnel]);
  useEffect(() => { loadEmailInfo(); }, [loadEmailInfo]);

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    const isCsv = lower.endsWith('.csv');
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    if (!isCsv && !isExcel) {
      toast({ title: 'Archivo inválido', description: 'Selecciona un CSV o Excel (.xlsx, .xls)', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      let csvContent: string;
      if (isExcel) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        csvContent = XLSX.utils.sheet_to_csv(sheet);
      } else {
        csvContent = await file.text();
      }
      const d = await apiRequest('POST', '/api/admin/instagram-leads/import-csv', { csvContent });
      if (d?.success) {
        toast({
          title: '✅ Importado',
          description: `${d.valid} válidos · ${d.inserted} nuevos · ${d.updated} actualizados · ${d.invalid} inválidos`,
        });
        await Promise.all([loadStats(), loadLeads(), loadFunnel()]);
      } else {
        toast({ title: 'Error', description: d?.message || 'Falló la importación', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Falló la importación', variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const d = await apiRequest('POST', '/api/admin/instagram-leads/generate', { limit: 200, lang: 'both', variant });
      if (d?.success) {
        toast({
          title: '🎨 Perfiles generados',
          description: `${d.created} perfiles reclamables creados${d.failed ? ` · ${d.failed} fallidos` : ''}`,
        });
        await Promise.all([loadStats(), loadLeads(), loadFunnel()]);
      } else {
        toast({ title: 'Error', description: d?.message || 'Falló la generación', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Falló la generación', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const applyVariant = async () => {
    setApplyingVariant(true);
    try {
      const d = await apiRequest('POST', '/api/admin/instagram-leads/refresh-dm', { variant });
      if (d?.success) {
        toast({ title: '✍️ Copy actualizado', description: `Variante aplicada a ${d.updated} leads` });
        await loadLeads();
      } else {
        toast({ title: 'Error', description: d?.message || 'Falló al aplicar', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Falló al aplicar', variant: 'destructive' });
    } finally {
      setApplyingVariant(false);
    }
  };

  const ingestDiscovery = async () => {
    setIngesting(true);
    try {
      const d = await apiRequest('POST', '/api/admin/instagram-leads/ingest-discovery', { limit: 500 });
      if (d?.success) {
        toast({
          title: '🔍 Importados del Hunter',
          description: `${d.inserted} nuevos artistas · ${d.scanned} revisados${d.skipped ? ` · ${d.skipped} ya existían` : ''}`,
        });
        await Promise.all([loadStats(), loadLeads(), loadDiscovery(), loadFunnel()]);
      } else {
        toast({ title: 'Error', description: d?.message || 'Falló la importación del Hunter', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Falló la importación del Hunter', variant: 'destructive' });
    } finally {
      setIngesting(false);
    }
  };

  const sendEmails = async () => {
    setEmailing(true);
    try {
      const d = await apiRequest('POST', '/api/admin/instagram-leads/send-emails', { limit: 200 });
      if (d?.success) {
        toast({
          title: '📧 Emails de claim enviados',
          description: `${d.sent} enviados${d.failed ? ` · ${d.failed} fallidos` : ''}${d.skipped ? ` · ${d.skipped} sin email válido` : ''}`,
        });
        await Promise.all([loadStats(), loadLeads(), loadFunnel(), loadEmailInfo()]);
      } else {
        toast({ title: 'Error', description: d?.message || 'Falló el envío de emails', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Falló el envío de emails', variant: 'destructive' });
    } finally {
      setEmailing(false);
    }
  };

  const refreshImages = async () => {
    setRefreshing(true);
    try {
      const d = await apiRequest('POST', '/api/admin/instagram-leads/refresh-images', { limit: 500 });
      if (d?.success) {
        toast({
          title: '🖼️ Imágenes re-alojadas',
          description: `${d.updated} imágenes movidas a almacenamiento permanente${d.failed ? ` · ${d.failed} fallidas` : ''}`,
        });
        await loadLeads();
      } else {
        toast({ title: 'Error', description: d?.message || 'Falló el refresco', variant: 'destructive' });
      }
    } catch (e: any) {
      // The server may keep working past the HTTP timeout — reload to reflect progress.
      toast({ title: 'Procesando…', description: 'El servidor sigue re-alojando imágenes. Recarga en unos segundos.', });
      await loadLeads();
    } finally {
      setRefreshing(false);
    }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch { /* ignore */ }
  };

  const markSent = async (handle: string) => {
    try {
      const d = await apiRequest('POST', '/api/admin/instagram-leads/mark-sent', { handles: [handle] });
      if (d?.success) {
        toast({ title: 'Marcado como enviado', description: `@${handle}` });
        await Promise.all([loadStats(), loadLeads(), loadFunnel()]);
      }
    } catch { /* ignore */ }
  };

  const exportReady = () => {
    const ready = leads.filter((l) => l.claim_url);
    if (!ready.length) {
      toast({ title: 'Nada que exportar', description: 'Genera perfiles primero', variant: 'destructive' });
      return;
    }
    const cell = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['handle', 'full_name', 'profile_url', 'image_to_attach', 'claim_url', 'dm_lang', 'recommended_dm', 'dm_text_es', 'dm_text_en'];
    const lines = [headers.join(',')];
    for (const r of ready) {
      const recommended = r.dm_lang === 'es' ? r.dm_text_es : r.dm_text_en;
      lines.push([r.handle, r.full_name, r.profile_url, r.profile_image_url, r.claim_url, r.dm_lang || 'en', recommended, r.dm_text_es, r.dm_text_en]
        .map(cell).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ig-dm-outreach-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, color: 'text-white' },
    { label: 'Nuevos', value: stats?.new ?? 0, color: 'text-slate-300' },
    { label: 'Listos para DM', value: stats?.ready ?? 0, color: 'text-emerald-400' },
    { label: 'Enviados', value: stats?.sent ?? 0, color: 'text-blue-400' },
    { label: 'Reclamados', value: stats?.claimed ?? 0, color: 'text-orange-400' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shrink-0">
            <Instagram className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white">Instagram Leads</h2>
            <p className="text-sm text-slate-400">
              Importa leads de Instagram → crea perfiles reclamables → genera el DM con su imagen y link.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadStats(); loadLeads(); loadFunnel(); }}
          className="border-slate-700 text-slate-300">
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refrescar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion funnel */}
      {funnel && funnel.stages?.length > 0 && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2 text-white">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400" /> Embudo de conversión
              </span>
              <span className="text-xs font-normal text-slate-400">
                Importado → Reclamado:{' '}
                <span className="text-orange-400 font-semibold">{funnel.overallConversion}%</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {(() => {
              const top = funnel.stages[0]?.count || 0;
              const colors = ['bg-slate-600', 'bg-emerald-600', 'bg-blue-600', 'bg-orange-500'];
              return funnel.stages.map((st, i) => {
                const widthPct = top > 0 ? Math.max((st.count / top) * 100, st.count > 0 ? 6 : 0) : 0;
                return (
                  <div key={st.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{st.label}</span>
                      <span className="text-slate-400">
                        <span className="text-white font-semibold">{st.count.toLocaleString()}</span>
                        {i > 0 && (
                          <span className="ml-2 text-slate-500">
                            ({st.convFromPrev}% del paso previo)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-800/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[i] || 'bg-slate-600'} transition-all duration-500`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              });
            })()}

            {funnel.bySource.length > 0 && (
              <div className="pt-2 mt-1 border-t border-slate-800">
                <div className="text-xs text-slate-500 mb-2">Por fuente</div>
                <div className="space-y-1.5">
                  {funnel.bySource.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-300 truncate">{s.source}</span>
                      <span className="text-slate-400 shrink-0">
                        {s.imported.toLocaleString()} imp · {s.sent.toLocaleString()} env ·{' '}
                        <span className="text-orange-400 font-semibold">{s.claimed.toLocaleString()} recl</span>
                        {s.sent > 0 && <span className="text-slate-500"> ({s.claimRate}%)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import + Generate */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-white">
              <Upload className="h-4 w-4 text-pink-400" /> 1 · Importar CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging ? 'border-pink-500 bg-pink-500/10' : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {importing ? (
                <Loader2 className="h-6 w-6 mx-auto text-pink-400 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-6 w-6 mx-auto text-slate-400" />
              )}
              <p className="text-sm text-slate-300 mt-2">
                {importing ? 'Importando…' : 'Arrastra tu CSV o Excel de Apify o haz clic'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                .csv, .xlsx, .xls · Detecta: username, fullName, profilePicUrl, biography, email, followers
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Radar className="h-3.5 w-3.5 text-violet-400" /> Descubrimiento automático (Hunter)
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {discovery
                      ? `${discovery.withIg} artistas con Instagram descubiertos · ${discovery.imported} ya importados`
                      : 'Trae artistas descubiertos por el motor Hunter'}
                    {' · '}se sincroniza solo cada 2 h
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={ingesting}
                  className="h-8 px-2.5 border-violet-700/60 text-violet-200 hover:bg-violet-500/10 shrink-0"
                  onClick={ingestDiscovery}>
                  {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radar className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Importar del Hunter</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-emerald-400" /> 2 · Generar perfiles + DM packs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400">
              Crea un perfil de artista reclamable por cada lead nuevo (biografía, imagen, handle),
              y genera el link de claim + el texto del DM en español e inglés.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 shrink-0">Estilo del DM:</span>
              <Select value={variant} onValueChange={setVariant}>
                <SelectTrigger className="h-8 flex-1 border-slate-700 bg-slate-950 text-xs text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="launch">🚀 Lanzamiento (intriga + reservado)</SelectItem>
                  <SelectItem value="exclusive">✨ Exclusivo (invitación curada)</SelectItem>
                  <SelectItem value="direct">⚡ Directo (corto y al grano)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} disabled={generating || !(stats?.new)}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white">
                {generating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Users className="h-4 w-4 mr-1.5" />}
                Generar {stats?.new ? `(${stats.new})` : ''}
              </Button>
              <Button variant="outline" onClick={applyVariant} disabled={applyingVariant || !(stats?.ready)}
                className="border-slate-700 text-slate-300" title="Re-aplica el estilo de DM elegido a todos los leads ya generados (A/B test)">
                {applyingVariant ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                Aplicar copy
              </Button>
              <Button variant="outline" onClick={refreshImages} disabled={refreshing}
                className="border-slate-700 text-slate-300">
                {refreshing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
                Refrescar imágenes
              </Button>
              <Button variant="outline" onClick={exportReady}
                className="border-slate-700 text-slate-300">
                <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
              </Button>
            </div>

            {/* Email outreach — for the ~37% of leads that came with an email */}
            <div className="rounded-lg border border-sky-700/40 bg-sky-500/5 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-sky-200 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Outreach por email (automático)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {emailInfo
                      ? <>{emailInfo.emailable} leads con email listos para enviar · {emailInfo.withEmail} tienen email en total</>
                      : 'Envía el email de claim a los leads que sí trajeron correo.'}
                    {' · '}los marca como “enviado”.
                  </p>
                </div>
                <Button size="sm" disabled={emailing || !(emailInfo?.emailable)}
                  className="h-8 px-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shrink-0"
                  onClick={sendEmails}>
                  {emailing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span className="ml-1.5">Enviar emails {emailInfo?.emailable ? `(${emailInfo.emailable})` : ''}</span>
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-amber-400/80 leading-snug">
              ⚠️ No envía DMs automáticamente (los DMs masivos violan los ToS de Instagram y banean cuentas).
              Exporta el CSV y envía los DMs de forma controlada / manual.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leads table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm text-white">Leads</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-8 bg-slate-800 border-slate-700 text-slate-300 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="new">Nuevos</SelectItem>
              <SelectItem value="ready">Listos para DM</SelectItem>
              <SelectItem value="sent">Enviados</SelectItem>
              <SelectItem value="claimed">Reclamados</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 mx-auto text-slate-500 animate-spin" /></div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Sin leads. Importa un CSV para empezar.</div>
          ) : (
            <ScrollArea className="h-[480px]">
              <div className="divide-y divide-slate-800">
                {leads.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 p-3 hover:bg-slate-800/40">
                    {l.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.profile_image_url} alt={l.handle}
                        className="h-10 w-10 rounded-full object-cover bg-slate-800 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 p-1.5">
                        <img src="/assets/boostify-logo.svg" alt="Boostify" className="h-full w-full object-contain opacity-80" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">{l.full_name || l.handle}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_STYLE[l.dm_status] || ''}`}>
                          {l.dm_status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <a href={l.profile_url} target="_blank" rel="noreferrer"
                          className="hover:text-pink-400 inline-flex items-center gap-0.5">
                          @{l.handle}<ExternalLink className="h-3 w-3" />
                        </a>
                        {l.followers != null && <span>· {l.followers.toLocaleString()} followers</span>}
                        {l.slug && <span className="truncate">· /artist/{l.slug}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {l.claim_url && (
                        <Button size="sm" variant="outline" className="h-7 px-2 border-slate-700 text-slate-300"
                          onClick={() => copy(l.claim_url!, `link-${l.id}`)}>
                          {copiedId === `link-${l.id}` ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          <span className="ml-1 hidden sm:inline">Link</span>
                        </Button>
                      )}
                      {(l.dm_text_es || l.dm_text_en) && (
                        <Button size="sm" variant="outline" className="h-7 px-2 border-slate-700 text-slate-300"
                          onClick={() => copy((l.dm_lang === 'es' ? l.dm_text_es : l.dm_text_en) || l.dm_text_en || l.dm_text_es!, `dm-${l.id}`)}>
                          {copiedId === `dm-${l.id}` ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          <span className="ml-1 hidden sm:inline">DM</span>
                          <span className="ml-1 text-[10px] uppercase text-slate-500">{(l.dm_lang || 'en')}</span>
                        </Button>
                      )}
                      {l.dm_status === 'ready' && (
                        <Button size="sm" className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => markSent(l.handle)}>
                          <Send className="h-3.5 w-3.5" />
                          <span className="ml-1 hidden sm:inline">Enviado</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default InstagramLeadsPanel;
