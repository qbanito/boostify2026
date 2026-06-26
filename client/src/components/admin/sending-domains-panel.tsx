import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  Mail, Plus, RefreshCw, Loader2, CheckCircle2, Clock, AlertTriangle, Globe, Pause, Play,
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { apiRequest } from '../../lib/queryClient';

interface SendingDomain {
  id: number;
  domain: string;
  from_email: string;
  status: string;
  resend_domain_id: string | null;
  hostinger_bought: boolean;
  dns_written: boolean;
  verified_at: string | null;
  last_error: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  provisioning: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  failed: 'bg-red-500/20 text-red-300 border-red-500/40',
  paused: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

const STATUS_ICON: Record<string, any> = {
  active: CheckCircle2, pending: Clock, provisioning: Loader2, failed: AlertTriangle, paused: Pause,
};

export function SendingDomainsPanel() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<SendingDomain[]>([]);
  const [poolSize, setPoolSize] = useState<number>(0);
  const [supportedTlds, setSupportedTlds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [alreadyBought, setAlreadyBought] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest('GET', '/api/admin/sending-domains');
      if (d?.success) {
        setDomains(d.domains || []);
        setPoolSize(d.poolSize || 0);
        setSupportedTlds(d.supportedTlds || []);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la lista', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const provision = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;
    setProvisioning(true);
    try {
      const d = await apiRequest('POST', '/api/admin/sending-domains/provision', { domain, skipBuy: alreadyBought });
      if (d?.success) {
        toast({ title: 'Dominio provisionado', description: d.message || `${domain} en verificación` });
        setNewDomain('');
        load();
      } else {
        toast({ title: 'No se pudo provisionar', description: d?.error || 'Error', variant: 'destructive' });
        load();
      }
    } catch (e: any) {
      const msg = e?.message || 'Error al provisionar';
      toast({ title: 'No se pudo provisionar', description: msg, variant: 'destructive' });
      load();
    } finally {
      setProvisioning(false);
    }
  };

  const check = async (id: number) => {
    setBusyId(id);
    try {
      const d = await apiRequest('POST', `/api/admin/sending-domains/${id}/check`);
      if (d?.success) {
        if (d.activated) toast({ title: '¡Activado!', description: `Ahora en rotación de envíos (pool: ${d.poolSize})` });
        else toast({ title: 'Aún en verificación', description: `Resend: ${d.resendStatus || 'pending'}. Reintenta en unos minutos.` });
        load();
      }
    } catch { toast({ title: 'Error', description: 'No se pudo verificar', variant: 'destructive' }); }
    finally { setBusyId(null); }
  };

  const toggle = async (id: number, action: 'pause' | 'resume') => {
    setBusyId(id);
    try {
      const d = await apiRequest('POST', `/api/admin/sending-domains/${id}/${action}`);
      if (d?.success) { toast({ title: action === 'pause' ? 'Pausado' : 'Reactivado', description: `Pool: ${d.poolSize}` }); load(); }
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setBusyId(null); }
  };

  const activeCount = domains.filter((d) => d.status === 'active').length;

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-emerald-400" />
            Sending Domains
            <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-300 border-emerald-500/40">
              {poolSize} en rotación
            </Badge>
          </CardTitle>
          <p className="text-sm text-slate-400">
            Provisiona un dominio nuevo de envío de un clic: compra en Hostinger, lo registra en Resend, escribe el DNS,
            dispara la verificación y lo agrega al workflow de envíos cuando verifica.
          </p>
          <p className="text-xs text-amber-300/80 mt-1">
            ⚠️ Si el banco rechaza la compra por API (3D Secure), cómpralo manualmente en hpanel.hostinger.com y marca
            “Ya comprado” — el panel hace el resto (Resend + DNS + verificación) automático.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !provisioning) provision(); }}
              placeholder="boostifymusicclub.store"
              disabled={provisioning}
              className="flex-1 min-w-0 px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            />
            <Button onClick={provision} disabled={provisioning || !newDomain.trim()} className="bg-emerald-600 hover:bg-emerald-500 cursor-pointer">
              {provisioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Provisionar
            </Button>
            <Button variant="outline" onClick={load} disabled={loading} className="cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={alreadyBought}
              onChange={(e) => setAlreadyBought(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-emerald-500 cursor-pointer"
            />
            Ya comprado en Hostinger (saltar compra, solo configurar envíos)
          </label>
          {supportedTlds.length > 0 && (
            <p className="text-xs text-slate-500">
              TLDs soportados: {supportedTlds.map((t) => `.${t}`).join(', ')} · {activeCount} activos · {domains.length} totales
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardContent className="p-0">
          <ScrollArea className="h-[420px]">
            <div className="divide-y divide-slate-800">
              {domains.length === 0 && !loading && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Aún no hay dominios provisionados. Escribe uno arriba y pulsa Provisionar.
                </div>
              )}
              {domains.map((d) => {
                const Icon = STATUS_ICON[d.status] || Clock;
                return (
                  <div key={d.id} className="p-4 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">{d.domain}</span>
                        <Badge variant="outline" className={STATUS_STYLE[d.status] || STATUS_STYLE.pending}>
                          <Icon className={`w-3 h-3 mr-1 ${d.status === 'provisioning' ? 'animate-spin' : ''}`} />
                          {d.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{d.from_email}</p>
                      {d.last_error && <p className="text-xs text-red-400 mt-1">{d.last_error}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {(d.status === 'pending' || d.status === 'failed') && (
                        <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => check(d.id)} className="cursor-pointer">
                          {busyId === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                          Verificar
                        </Button>
                      )}
                      {d.status === 'active' && (
                        <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => toggle(d.id, 'pause')} className="cursor-pointer">
                          <Pause className="w-3 h-3 mr-1" /> Pausar
                        </Button>
                      )}
                      {d.status === 'paused' && (
                        <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => toggle(d.id, 'resume')} className="cursor-pointer">
                          <Play className="w-3 h-3 mr-1" /> Reactivar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export default SendingDomainsPanel;
