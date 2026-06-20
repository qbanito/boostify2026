/**
 * OpenClaw Control Panel — Admin Component
 * 
 * Toggle to enable/disable OpenClaw, start/stop gateway,
 * view status, run health checks, and test adapter connections.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
  Power, Activity, Terminal, Zap, 
  RefreshCw, AlertCircle, CheckCircle2, XCircle,
  MessageSquare, Settings, HeartPulse, Loader2, Copy, Check,
} from 'lucide-react';

interface OpenClawStatus {
  enabled: boolean;
  running: boolean;
  pid: number | null;
  port: number;
  uptime: number | null;
  lastHealthCheck: string | null;
  error: string | null;
}

interface HealthCheckResult {
  healthy: boolean;
  latencyMs?: number;
  probedAt: string;
  details?: Record<string, unknown>;
  error?: string;
}

export function OpenClawPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<OpenClawStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [starting, setStarting] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [responseError, setResponseError] = useState<string | null>(null);
  const [adapters, setAdapters] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const errorCountRef = useRef(0);

  const fetchStatus = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      const data = await apiRequest({ url: '/api/admin/openclaw/status', method: 'GET' });
      if (data.success) {
        setStatus(data.status);
        errorCountRef.current = 0;
      }
    } catch (err: any) {
      errorCountRef.current += 1;
      if (!opts?.silent) {
        toast({ title: 'Failed to fetch status', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchAdapters = useCallback(async () => {
    try {
      const data = await apiRequest({ url: '/api/admin/openclaw/adapters', method: 'GET' });
      if (data.success) setAdapters(data.adapters);
    } catch {
      /* silent — non-critical */
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchAdapters();
  }, [fetchStatus, fetchAdapters]);

  // Adaptive polling: 10s when running, 30s when enabled-but-stopped, 60s when disabled,
  // exponential backoff (max 120s) after consecutive errors.
  useEffect(() => {
    const delay = (() => {
      if (errorCountRef.current > 0) {
        return Math.min(10_000 * 2 ** errorCountRef.current, 120_000);
      }
      if (status?.running) return 10_000;
      if (status?.enabled) return 30_000;
      return 60_000;
    })();
    const iv = setTimeout(() => fetchStatus({ silent: true }), delay);
    return () => clearTimeout(iv);
  }, [status, fetchStatus]);

  const handleToggle = async () => {
    if (!status) return;
    setToggling(true);
    try {
      const data = await apiRequest({
        url: '/api/admin/openclaw/toggle',
        method: 'POST',
        data: { enabled: !status.enabled },
      });
      if (data.success) {
        setStatus(data.status);
        fetchAdapters();
        toast({
          title: data.status.enabled ? 'OpenClaw enabled' : 'OpenClaw disabled',
          description: data.status.enabled ? 'Gateway layer is now active' : 'All OpenClaw traffic is paused',
        });
      }
    } catch (err: any) {
      toast({ title: 'Toggle failed', description: err.message, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  const handleStartStop = async () => {
    if (!status) return;
    setStarting(true);
    try {
      const endpoint = status.running ? '/api/admin/openclaw/stop' : '/api/admin/openclaw/start';
      const data = await apiRequest({ url: endpoint, method: 'POST' });
      if (data.success) {
        setStatus(data.status);
        fetchAdapters();
        toast({
          title: status.running ? 'Gateway stopped' : 'Gateway started',
          description: `PID: ${data.status.pid ?? '—'}, port: ${data.status.port}`,
        });
      }
    } catch (err: any) {
      toast({ title: 'Start/stop failed', description: err.message, variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    setHealthResult(null);
    try {
      const data = await apiRequest({ url: '/api/admin/openclaw/health', method: 'GET' });
      setHealthResult({
        healthy: !!data.healthy,
        latencyMs: data.latencyMs,
        probedAt: data.probedAt || new Date().toISOString(),
        details: data.details,
        error: data.error,
      });
      toast({
        title: data.healthy ? 'Gateway healthy' : 'Gateway unhealthy',
        description: data.latencyMs != null ? `Latency: ${data.latencyMs}ms` : (data.error || 'No response'),
        variant: data.healthy ? undefined : 'destructive',
      });
    } catch (err: any) {
      setHealthResult({ healthy: false, error: err.message, probedAt: new Date().toISOString() });
      toast({ title: 'Health check failed', description: err.message, variant: 'destructive' });
    } finally {
      setHealthChecking(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    setResponse(null);
    setResponseError(null);
    try {
      const data = await apiRequest({
        url: '/api/admin/openclaw/message',
        method: 'POST',
        data: { message: message.trim() },
      });
      if (data.success) {
        setResponse(data.result);
      } else {
        setResponseError(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setResponseError(err.message || String(err));
    } finally {
      setSending(false);
    }
  };

  const copyResponse = () => {
    const text = response ? JSON.stringify(response, null, 2) : responseError || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const formatUptime = (ms: number | null): string => {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <Card className="bg-slate-900/80 border-orange-500/20">
        <CardContent className="pt-6 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 text-orange-400 animate-spin mr-2" />
          <span className="text-slate-400">Loading OpenClaw status...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Control Card */}
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-orange-400 flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              OpenClaw Agent Gateway
            </CardTitle>
            <Badge 
              className={
                status?.running 
                  ? 'bg-green-500/20 text-green-300' 
                  : status?.enabled 
                    ? 'bg-yellow-500/20 text-yellow-300' 
                    : 'bg-red-500/20 text-red-300'
              }
            >
              {status?.running ? 'Running' : status?.enabled ? 'Enabled (Stopped)' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle Switch Row */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3">
              <Power className={`h-5 w-5 ${status?.enabled ? 'text-green-400' : 'text-slate-500'}`} />
              <div>
                <p className="text-sm font-medium text-white">OpenClaw System</p>
                <p className="text-xs text-slate-400">Enable/disable the AI agent orchestration layer</p>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
                status?.enabled 
                  ? 'bg-orange-500' 
                  : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  status?.enabled ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
              {toggling && (
                <Loader2 className="absolute inset-0 m-auto h-3 w-3 text-white animate-spin" />
              )}
            </button>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Port</p>
              <p className="text-sm font-mono text-white">{status?.port || '—'}</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">PID</p>
              <p className="text-sm font-mono text-white">{status?.pid || '—'}</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Uptime</p>
              <p className="text-sm font-mono text-white">{formatUptime(status?.uptime ?? null)}</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-xs text-slate-400 mb-1">Health</p>
              <div className="flex items-center gap-1">
                {healthResult
                  ? (healthResult.healthy
                      ? <CheckCircle2 className="h-3 w-3 text-green-400" />
                      : <XCircle className="h-3 w-3 text-red-400" />)
                  : (status?.running
                      ? <CheckCircle2 className="h-3 w-3 text-green-400" />
                      : <XCircle className="h-3 w-3 text-slate-500" />)}
                <p className="text-sm text-white">
                  {healthResult
                    ? (healthResult.latencyMs != null ? `${healthResult.latencyMs}ms` : (healthResult.healthy ? 'OK' : 'Down'))
                    : (status?.running ? 'OK' : 'Off')}
                </p>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {status?.error && (
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300">{status.error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleStartStop}
              disabled={starting || !status?.enabled}
              variant="outline"
              size="sm"
              className={`flex-1 min-w-[8rem] ${
                status?.running 
                  ? 'border-red-500/30 hover:bg-red-500/10 text-red-300' 
                  : 'border-green-500/30 hover:bg-green-500/10 text-green-300'
              }`}
            >
              {starting
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Zap className="h-4 w-4 mr-1" />}
              {starting ? 'Processing…' : status?.running ? 'Stop Gateway' : 'Start Gateway'}
            </Button>
            <Button
              onClick={handleHealthCheck}
              disabled={healthChecking || !status?.running}
              variant="outline"
              size="sm"
              className="border-pink-500/30 hover:bg-pink-500/10 text-pink-300"
              title={status?.running ? 'Probe gateway health' : 'Start gateway first'}
            >
              {healthChecking
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <HeartPulse className="h-4 w-4 mr-1" />}
              Health
            </Button>
            <Button
              onClick={() => fetchStatus()}
              variant="outline"
              size="sm"
              className="border-orange-500/30 hover:bg-orange-500/10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Health result detail */}
          {healthResult && (
            <div className={`p-3 rounded-lg border text-xs ${
              healthResult.healthy
                ? 'bg-green-500/5 border-green-500/20 text-green-200'
                : 'bg-red-500/5 border-red-500/20 text-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {healthResult.healthy ? 'Gateway responded' : 'Gateway unhealthy'}
                </span>
                <span className="text-slate-400">
                  {new Date(healthResult.probedAt).toLocaleTimeString()}
                </span>
              </div>
              {healthResult.error && <p className="mt-1 text-red-300">{healthResult.error}</p>}
              {healthResult.details && Object.keys(healthResult.details).length > 0 && (
                <pre className="mt-2 text-[10px] text-slate-400 overflow-x-auto">
                  {JSON.stringify(healthResult.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adapters Card */}
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-orange-400 flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Boostify Adapters
            </CardTitle>
            <Badge className="bg-slate-800/60 text-slate-300 border border-slate-700 text-[10px]">
              {adapters.length} registered
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {adapters.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No adapters registered</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {adapters.map((adapter) => (
                <div
                  key={adapter}
                  className="flex items-center gap-2 p-2 bg-slate-800/30 rounded border border-slate-700/50"
                >
                  <Activity className="h-3 w-3 text-orange-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-slate-300 truncate">{adapter}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Test Card */}
      {status?.running && (
        <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-400 flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Agent Test Console
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Send a test message to OpenClaw agent..."
                disabled={sending}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                maxLength={2000}
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                disabled={sending || !message.trim()}
                className="bg-orange-500 hover:bg-orange-600 min-w-[4rem]"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
              </Button>
            </div>
            {(response || responseError) && (
              <div className={`rounded border ${
                responseError
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-slate-800/50 border-slate-700'
              }`}>
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/50">
                  <span className={`text-[10px] uppercase tracking-wide font-medium ${
                    responseError ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {responseError ? 'Error' : 'Response'}
                  </span>
                  <button
                    onClick={copyResponse}
                    className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-orange-400 transition-colors"
                    title="Copy"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre className="p-3 text-xs text-slate-300 overflow-auto max-h-60">
                  {responseError || (typeof response === 'string' ? response : JSON.stringify(response, null, 2))}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
