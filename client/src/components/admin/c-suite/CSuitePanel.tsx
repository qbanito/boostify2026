/**
 * C-Suite AI Panel — Admin tab UI for Boostify's autonomous executive team.
 *
 * Sub-tabs:
 *   • Overview     — agent grid + live stats + kill switch
 *   • Command      — direct chat with CEO (Neiver Alvarez-AI)
 *   • Approvals    — HITL queue
 *   • Goals        — OKRs + check-ins
 *   • Self-Improve — auto-detected issues + remediation
 *   • Threads      — recent conversations
 *   • Settings     — global flags + per-agent toggles
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import { ScrollArea } from '../../ui/scroll-area';
import { Input } from '../../ui/input';
import { apiRequest } from '../../../lib/queryClient';
import { useToast } from '../../../hooks/use-toast';
import {
  Crown, Bot, Brain, AlertTriangle, Target, Wrench, MessageSquare,
  Settings, ShieldOff, Play, Loader2, CheckCircle2, XCircle, Sparkles,
  Activity, TrendingUp, Zap, Trash2,
} from 'lucide-react';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  autonomy: number;
  active: boolean;
  dryRun: boolean;
  persona: string;
  tools: string[];
  budgetUsdDaily: string;
  escalatesTo?: string;
}

interface CSuiteStats {
  activeAgents: number;
  pendingApprovals: number;
  openIssues: number;
  activeGoals: number;
  activeThreads: number;
}

interface Approval {
  id: number;
  decisionId: number;
  requestedBy: string;
  summary: string;
  riskScore: number;
  expiresAt: string | null;
  status: string;
  createdAt: string;
}

interface Goal {
  id: number;
  scope: string;
  ownerAgent: string;
  title: string;
  metric: string;
  targetValue: string;
  currentValue: string | null;
  baseline: string | null;
  status: 'draft' | 'on_track' | 'at_risk' | 'off_track' | 'achieved' | 'missed';
}

interface SelfImproveIssue {
  id: number;
  detectedBy: string;
  category: string;
  severity: number;
  title: string;
  description: string | null;
  proposedFix: string | null;
  appliedFix: string | null;
  status: string;
  createdAt: string;
}

interface Thread {
  id: number;
  agentId: string;
  topic: string;
  triggeredBy: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
}

// ----------------------------------------------------------------------
// Avatar emoji per role
// ----------------------------------------------------------------------

const AGENT_EMOJI: Record<string, string> = {
  ceo: '👑', cmo: '📣', cro: '💼', cpo: '🎯', cfo: '💰',
  coo: '⚙️', cto: '🛠️', clo: '⚖️', cdo: '📊', ciso: '🛡️',
};

// ======================================================================
// MAIN PANEL
// ======================================================================

export function CSuitePanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');

  // Bootstrap (idempotent seed) on first mount
  const bootstrap = useMutation({
    mutationFn: async () => apiRequest('/api/admin/c-suite/bootstrap', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-suite'] });
    },
  });

  useEffect(() => {
    // Run bootstrap only once per browser session (idempotent server-side, but
    // we avoid spamming the endpoint on every mount/HMR).
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('c-suite:bootstrapped') === '1') return;
    sessionStorage.setItem('c-suite:bootstrapped', '1');
    bootstrap.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-7 w-7 text-orange-400" />
        <div>
          <h2 className="text-2xl font-bold text-white">C-Suite AI</h2>
          <p className="text-sm text-slate-400">
            Autonomous executive team led by Neiver Alvarez-AI · 10 agents · Self-managing & self-improving
          </p>
        </div>
      </div>

      <StatsBar />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-900/60 border border-orange-500/20 flex-wrap h-auto">
          <TabsTrigger value="overview"><Bot className="h-4 w-4 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="command"><MessageSquare className="h-4 w-4 mr-1" />Command</TabsTrigger>
          <TabsTrigger value="approvals"><AlertTriangle className="h-4 w-4 mr-1" />Approvals</TabsTrigger>
          <TabsTrigger value="goals"><Target className="h-4 w-4 mr-1" />Goals</TabsTrigger>
          <TabsTrigger value="self-improve"><Wrench className="h-4 w-4 mr-1" />Self-Improve</TabsTrigger>
          <TabsTrigger value="threads"><Activity className="h-4 w-4 mr-1" />Threads</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1" />Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <AgentsGrid />
        </TabsContent>
        <TabsContent value="command" className="mt-4">
          <CommandCenter />
        </TabsContent>
        <TabsContent value="approvals" className="mt-4">
          <ApprovalsQueue />
        </TabsContent>
        <TabsContent value="goals" className="mt-4">
          <GoalsDashboard />
        </TabsContent>
        <TabsContent value="self-improve" className="mt-4">
          <SelfImprovePanel />
        </TabsContent>
        <TabsContent value="threads" className="mt-4">
          <ThreadsList />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ======================================================================
// STATS BAR
// ======================================================================

function StatsBar() {
  const { data } = useQuery<{ ok: boolean; stats: CSuiteStats }>({
    queryKey: ['c-suite', 'stats'],
    queryFn: () => apiRequest('/api/admin/c-suite/stats'),
    refetchInterval: 15_000,
  });
  const s = data?.stats;
  const items = [
    { label: 'Active Agents', value: s?.activeAgents ?? 0, icon: Bot, color: 'text-emerald-400' },
    { label: 'Pending Approvals', value: s?.pendingApprovals ?? 0, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Open Issues', value: s?.openIssues ?? 0, icon: Wrench, color: 'text-rose-400' },
    { label: 'Active Goals', value: s?.activeGoals ?? 0, icon: Target, color: 'text-orange-400' },
    { label: 'Live Threads', value: s?.activeThreads ?? 0, icon: Activity, color: 'text-sky-400' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.label} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${it.color}`} />
              <div>
                <div className="text-2xl font-bold text-white">{it.value}</div>
                <div className="text-xs text-slate-400">{it.label}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ======================================================================
// AGENTS GRID
// ======================================================================

function AgentsGrid() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ ok: boolean; agents: Agent[] }>({
    queryKey: ['c-suite', 'agents'],
    queryFn: () => apiRequest('/api/admin/c-suite/agents'),
    refetchInterval: 30_000,
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) =>
      apiRequest(`/api/admin/c-suite/agents/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-suite'] });
      toast({ title: 'Agent updated' });
    },
  });

  if (isLoading) return <div className="text-slate-400">Loading agents…</div>;
  const agents = data?.agents ?? [];
  if (!agents.length) return <div className="text-slate-400">No agents seeded yet. Refresh in a moment.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {agents.map((a) => (
        <Card key={a.id} className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-2xl">{AGENT_EMOJI[a.id] || '🤖'}</span>
                <span className="text-white">{a.name}</span>
              </span>
              <Badge variant={a.active ? 'default' : 'secondary'} className={a.active ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : ''}>
                {a.active ? 'ACTIVE' : 'OFF'}
              </Badge>
            </CardTitle>
            <p className="text-xs text-slate-400">{a.role} · {a.model}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-slate-400 line-clamp-3">
              {a.persona.split('\n').find((l) => l.trim()) || ''}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-800/50 rounded p-2 text-center">
                <div className="text-slate-400">Autonomy</div>
                <div className="text-white font-bold">L{a.autonomy}</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2 text-center">
                <div className="text-slate-400">Tools</div>
                <div className="text-white font-bold">{a.tools?.length ?? 0}</div>
              </div>
              <div className="bg-slate-800/50 rounded p-2 text-center">
                <div className="text-slate-400">Budget/d</div>
                <div className="text-white font-bold">${a.budgetUsdDaily}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <Switch
                  checked={a.active}
                  onCheckedChange={(v) => patch.mutate({ id: a.id, body: { active: v } })}
                />
                <span className="text-xs text-slate-300">Active</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={a.dryRun}
                  onCheckedChange={(v) => patch.mutate({ id: a.id, body: { dryRun: v } })}
                />
                <span className="text-xs text-slate-300">Dry-run</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ======================================================================
// COMMAND CENTER (chat with CEO)
// ======================================================================

function CommandCenter() {
  const { toast } = useToast();
  const [agentId, setAgentId] = useState('ceo');
  const [message, setMessage] = useState('');
  const [transcript, setTranscript] = useState<{ role: string; text: string; tool?: string }[]>([]);
  const esRef = useRef<EventSource | null>(null);

  // Subscribe to event stream with auto-reconnect
  useEffect(() => {
    let cancelled = false;
    let backoff = 1000;
    let retryTimer: any;

    const connect = () => {
      if (cancelled) return;
      const es = new EventSource('/api/admin/c-suite/stream', { withCredentials: true });
      esRef.current = es;
      es.onopen = () => { backoff = 1000; };
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === 'assistant_message' && ev.content) {
            setTranscript((t) => [...t, { role: 'assistant', text: ev.content }]);
          } else if (ev.type === 'tool_call') {
            setTranscript((t) => [...t, { role: 'tool', text: JSON.stringify(ev.result).slice(0, 500), tool: ev.toolName }]);
          }
        } catch {}
      };
      es.onerror = () => {
        es.close();
        if (cancelled) return;
        retryTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30_000);
      };
    };
    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      esRef.current?.close();
    };
  }, []);

  const send = useMutation({
    mutationFn: async (msg: string) =>
      apiRequest('/api/admin/c-suite/command', { method: 'POST', body: { agentId, message: msg } }),
    onMutate: (msg) => {
      setTranscript((t) => [...t, { role: 'user', text: msg }]);
    },
    onSuccess: (data: any) => {
      if (data?.result?.finalText) {
        setTranscript((t) => [...t, { role: 'final', text: data.result.finalText }]);
      }
      setMessage('');
    },
    onError: (e: any) => toast({ title: 'Command failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className="bg-slate-900/60 border-orange-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-400">
          <Sparkles className="h-5 w-5" />
          Command Center
        </CardTitle>
        <p className="text-xs text-slate-400">
          Talk directly to your AI executives. Default routes to CEO Neiver Alvarez-AI; use the dropdown to address a specific chief.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-80 border border-slate-700/50 rounded p-3 bg-slate-950/40">
          {transcript.length === 0 && (
            <div className="text-slate-500 text-sm italic">No conversation yet. Send a directive below.</div>
          )}
          {transcript.map((m, i) => (
            <div key={i} className={`mb-3 text-sm ${
              m.role === 'user' ? 'text-orange-300' :
              m.role === 'tool' ? 'text-cyan-300' :
              m.role === 'final' ? 'text-emerald-300 font-semibold' :
              'text-slate-200'
            }`}>
              <strong className="text-xs uppercase opacity-70">
                {m.role === 'tool' ? `🔧 ${m.tool}` : m.role}:
              </strong>
              <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
            </div>
          ))}
        </ScrollArea>
        <div className="flex gap-2">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-white"
          >
            <option value="ceo">👑 CEO</option>
            <option value="cmo">📣 CMO</option>
            <option value="cro">💼 CRO</option>
            <option value="cpo">🎯 CPO</option>
            <option value="cfo">💰 CFO</option>
            <option value="coo">⚙️ COO</option>
            <option value="cto">🛠️ CTO</option>
            <option value="clo">⚖️ CLO</option>
            <option value="cdo">📊 CDO</option>
            <option value="ciso">🛡️ CISO</option>
          </select>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Give a directive, ask a question, request a report… (Enter to send, Shift+Enter for newline)"
            className="bg-slate-800 border-slate-700 text-white min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (message.trim() && !send.isPending) {
                  send.mutate(message);
                }
              }
            }}
          />
          <Button
            onClick={() => send.mutate(message)}
            disabled={!message.trim() || send.isPending}
            className="bg-orange-500 hover:bg-orange-600 gap-2"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span>{send.isPending ? 'Sending…' : 'Send'}</span>
          </Button>
        </div>
        <p className="text-[10px] text-slate-500">
          Tip: Enter to send · Shift+Enter for newline · Live tool calls and assistant turns stream in the transcript above.
        </p>
      </CardContent>
    </Card>
  );
}

// ======================================================================
// APPROVALS QUEUE
// ======================================================================

function ApprovalsQueue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{ ok: boolean; approvals: Approval[] }>({
    queryKey: ['c-suite', 'approvals'],
    queryFn: () => apiRequest('/api/admin/c-suite/approvals'),
    refetchInterval: 10_000,
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: number; decision: 'approve' | 'reject' }) =>
      apiRequest(`/api/admin/c-suite/approvals/${id}/decide`, { method: 'POST', body: { decision } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-suite'] });
      toast({ title: 'Decision recorded' });
    },
  });

  const approvals = data?.approvals ?? [];
  if (!approvals.length) {
    return <Card className="bg-slate-900/60 border-slate-700/50"><CardContent className="p-8 text-center text-slate-400">
      <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
      No pending approvals. Your team is operating cleanly.
    </CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {approvals.map((a) => (
        <Card key={a.id} className="bg-slate-900/60 border-amber-500/30">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Risk {a.riskScore}/10</Badge>
                <span className="text-xs text-slate-400">from {a.requestedBy}</span>
                <span className="text-xs text-slate-500">· {new Date(a.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-white">{a.summary}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                onClick={() => decide.mutate({ id: a.id, decision: 'reject' })}>
                <XCircle className="h-4 w-4 mr-1" />Reject
              </Button>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600"
                onClick={() => decide.mutate({ id: a.id, decision: 'approve' })}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ======================================================================
// GOALS DASHBOARD
// ======================================================================

function GoalsDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{ ok: boolean; goals: Goal[] }>({
    queryKey: ['c-suite', 'goals'],
    queryFn: () => apiRequest('/api/admin/c-suite/goals'),
  });

  const { data: presetData } = useQuery<{ ok: boolean; presets: any[] }>({
    queryKey: ['c-suite', 'goal-presets'],
    queryFn: () => apiRequest('/api/admin/c-suite/goals/presets'),
    staleTime: Infinity,
  });
  const presets = presetData?.presets ?? [];

  const [form, setForm] = useState({ ownerAgent: 'ceo', title: '', metric: '', targetValue: '' });

  const create = useMutation({
    mutationFn: async (body: any) => apiRequest('/api/admin/c-suite/goals', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-suite', 'goals'] });
      setForm({ ownerAgent: 'ceo', title: '', metric: '', targetValue: '' });
      toast({ title: 'Goal created' });
    },
  });

  const fromPreset = useMutation({
    mutationFn: async (presetKey: string) =>
      apiRequest('/api/admin/c-suite/goals/from-preset', {
        method: 'POST',
        body: { presetKey, autoExecute: true },
      }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['c-suite', 'goals'] });
      qc.invalidateQueries({ queryKey: ['c-suite', 'threads'] });
      toast({
        title: 'Preset applied — agent dispatched',
        description: `${r?.goal?.title ?? ''}${r?.executed ? ' · owner agent is now planning strategy' : ''}`,
      });
    },
    onError: (e: any) => toast({ title: 'Preset failed', description: e.message, variant: 'destructive' }),
  });

  const executeGoal = useMutation({
    mutationFn: async (goalId: number) =>
      apiRequest(`/api/admin/c-suite/goals/${goalId}/execute`, { method: 'POST' }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['c-suite', 'threads'] });
      toast({
        title: 'Agent executed turn',
        description: `Thread #${r?.threadId} created. Check the Command Center.`,
      });
    },
    onError: (e: any) => toast({ title: 'Execute failed', description: e.message, variant: 'destructive' }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: number) =>
      apiRequest(`/api/admin/c-suite/goals/${goalId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-suite', 'goals'] });
      toast({ title: 'Goal deleted' });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const goals = data?.goals ?? [];

  const statusColor: Record<string, string> = {
    on_track: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    at_risk: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    off_track: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    achieved: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    missed: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    draft: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  };

  return (
    <div className="space-y-4">
      {/* ---- Quick Presets ---- */}
      {presets.length > 0 && (
        <Card className="bg-slate-900/60 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-cyan-400 flex items-center gap-2">
              <Target className="h-4 w-4" /> Quick Presets
            </CardTitle>
            <p className="text-[11px] text-slate-400 mt-1">
              Click a preset to (1) create the goal and (2) automatically dispatch its owner agent to query current metrics, propose a 14-day plan, and save it as a memory entry. Watch progress in the Command Center / Threads tabs.
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {presets.map((p: any) => (
              <button
                key={p.key}
                onClick={() => fromPreset.mutate(p.key)}
                disabled={fromPreset.isPending}
                className="text-left bg-slate-800/60 border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 transition rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase text-slate-400">
                    {AGENT_EMOJI[p.ownerAgent] ?? '🎯'} {p.ownerAgent}
                  </span>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">
                    {p.category}
                  </Badge>
                </div>
                <div className="text-sm text-white font-medium">{p.title}</div>
                <div className="text-[11px] text-slate-400 mt-1">{p.description}</div>
                <div className="text-[11px] text-cyan-300 mt-1">
                  {p.metric} → {p.targetValue}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900/60 border-orange-500/20">
        <CardHeader><CardTitle className="text-orange-400">New Goal / OKR</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select value={form.ownerAgent} onChange={(e) => setForm({ ...form, ownerAgent: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-2 text-sm text-white">
            {['ceo','cmo','cro','cpo','cfo','coo','cto','clo','cdo','ciso'].map((id) => (
              <option key={id} value={id}>{id.toUpperCase()}</option>
            ))}
          </select>
          <Input placeholder="Title (e.g. Reach 10K MAU)" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
          <Input placeholder="Metric (e.g. mau)" value={form.metric}
            onChange={(e) => setForm({ ...form, metric: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
          <Input placeholder="Target" type="number" value={form.targetValue}
            onChange={(e) => setForm({ ...form, targetValue: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
          <Button onClick={() => create.mutate({ ...form, scope: 'company', targetValue: Number(form.targetValue) })}
            disabled={!form.title || !form.metric || !form.targetValue}
            className="bg-orange-500 hover:bg-orange-600">Create</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {goals.map((g) => {
          const target = Number(g.targetValue) || 1;
          const baseline = Number(g.baseline ?? 0);
          const current = Number(g.currentValue ?? baseline);
          const progress = Math.max(0, Math.min(1, (current - baseline) / (target - baseline || target)));
          return (
            <Card key={g.id} className="bg-slate-900/60 border-slate-700/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{AGENT_EMOJI[g.ownerAgent]} {g.ownerAgent.toUpperCase()}</span>
                  <Badge className={statusColor[g.status]}>{g.status.replace('_',' ')}</Badge>
                </div>
                <h4 className="text-white font-semibold">{g.title}</h4>
                <p className="text-xs text-slate-400">
                  {g.metric}: {current} / {target}
                </p>
                <div className="h-2 bg-slate-800 rounded overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => executeGoal.mutate(g.id)}
                    disabled={executeGoal.isPending}
                    className="flex-1 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                  >
                    {executeGoal.isPending && executeGoal.variables === g.id
                      ? 'Dispatching…'
                      : `▶ Execute · ask ${g.ownerAgent.toUpperCase()} to plan`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Delete goal "${g.title}"? This cannot be undone.`)) {
                        deleteGoal.mutate(g.id);
                      }
                    }}
                    disabled={deleteGoal.isPending}
                    className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                    title="Delete goal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!goals.length && <p className="text-slate-400 text-sm">No goals yet. Create one above.</p>}
      </div>
    </div>
  );
}

// ======================================================================
// SELF-IMPROVEMENT PANEL
// ======================================================================

function SelfImprovePanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{ ok: boolean; items: SelfImproveIssue[] }>({
    queryKey: ['c-suite', 'self-improvement'],
    queryFn: () => apiRequest('/api/admin/c-suite/self-improvement'),
    refetchInterval: 30_000,
  });

  const runCycle = useMutation({
    mutationFn: async () => apiRequest('/api/admin/c-suite/self-improvement/run', { method: 'POST' }),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['c-suite'] });
      toast({ title: 'Self-maintenance cycle dispatched', description: d?.message });
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const items = data?.items ?? [];
  const sevColor = ['', 'text-slate-400', 'text-cyan-400', 'text-amber-400', 'text-orange-400', 'text-rose-400'];

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-orange-500/10 to-rose-500/10 border-orange-500/30">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-orange-400" />
              Auto-detection: CTO scans, files issues, proposes fixes
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Run a maintenance cycle: the CTO agent (Kai) calls runSelfDiagnostics, files issues into this log, and proposes tunings via approvals.
            </p>
          </div>
          <Button onClick={() => runCycle.mutate()} disabled={runCycle.isPending}
            className="bg-orange-500 hover:bg-orange-600">
            {runCycle.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Run Cycle
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {items.map((it) => (
          <Card key={it.id} className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{it.category}</Badge>
                  <span className={`text-xs font-bold ${sevColor[it.severity] ?? ''}`}>SEV {it.severity}</span>
                  <Badge className={
                    it.status === 'applied' || it.status === 'verified' ? 'bg-emerald-500/20 text-emerald-300' :
                    it.status === 'failed' || it.status === 'ignored' ? 'bg-rose-500/20 text-rose-300' :
                    'bg-amber-500/20 text-amber-300'
                  }>{it.status}</Badge>
                </div>
                <span className="text-xs text-slate-500">{new Date(it.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-white">{it.title}</p>
              {it.description && <p className="text-xs text-slate-400 mt-1">{it.description}</p>}
              {it.proposedFix && (
                <p className="text-xs text-cyan-300 mt-2"><strong>Proposed:</strong> {it.proposedFix}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {!items.length && (
          <Card className="bg-slate-900/40 border-slate-700/50"><CardContent className="p-8 text-center text-slate-400">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400" />
            No issues detected. The system is healthy.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}

// ======================================================================
// THREADS LIST
// ======================================================================

function ThreadsList() {
  const { data } = useQuery<{ ok: boolean; threads: Thread[] }>({
    queryKey: ['c-suite', 'threads'],
    queryFn: () => apiRequest('/api/admin/c-suite/threads'),
    refetchInterval: 15_000,
  });
  const threads = data?.threads ?? [];

  return (
    <div className="space-y-2">
      {threads.map((t) => (
        <Card key={t.id} className="bg-slate-900/60 border-slate-700/50">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span>{AGENT_EMOJI[t.agentId]}</span>
                <span className="text-xs text-slate-400">{t.agentId.toUpperCase()}</span>
                <Badge variant="outline" className="text-xs">{t.triggeredBy}</Badge>
                <Badge className={
                  t.status === 'done' ? 'bg-emerald-500/20 text-emerald-300' :
                  t.status === 'failed' ? 'bg-rose-500/20 text-rose-300' :
                  'bg-sky-500/20 text-sky-300'
                }>{t.status}</Badge>
              </div>
              <p className="text-sm text-white truncate">{t.topic}</p>
            </div>
            <span className="text-xs text-slate-500 ml-2">{new Date(t.createdAt).toLocaleString()}</span>
          </CardContent>
        </Card>
      ))}
      {!threads.length && <p className="text-slate-400 text-sm">No threads yet.</p>}
    </div>
  );
}

// ======================================================================
// SETTINGS PANEL
// ======================================================================

function SettingsPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data } = useQuery<{ ok: boolean; settings: any }>({
    queryKey: ['c-suite', 'settings'],
    queryFn: () => apiRequest('/api/admin/c-suite/settings'),
  });

  const patch = useMutation({
    mutationFn: async (body: any) => apiRequest('/api/admin/c-suite/settings', { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['c-suite'] });
      toast({ title: 'Settings saved' });
    },
  });

  const briefing = useMutation({
    mutationFn: async () => apiRequest('/api/admin/c-suite/briefing/run', { method: 'POST' }),
    onSuccess: (d: any) => toast({ title: 'Daily briefing dispatched', description: d?.message }),
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const s = data?.settings;

  return (
    <div className="space-y-4">
      <Card className="bg-rose-500/10 border-rose-500/40">
        <CardHeader><CardTitle className="text-rose-300 flex items-center gap-2">
          <ShieldOff className="h-5 w-5" /> Kill Switch
        </CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-slate-300">When ON, all agents are halted immediately. No tool calls, no LLM calls.</p>
          <Switch checked={!!s?.killSwitch} onCheckedChange={(v) => patch.mutate({ killSwitch: v })} />
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-orange-500/20">
        <CardHeader><CardTitle className="text-orange-400">Global Defaults</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Global dry-run</p>
              <p className="text-xs text-slate-400">Force all agents into dry-run regardless of per-agent setting.</p>
            </div>
            <Switch checked={!!s?.globalDryRun} onCheckedChange={(v) => patch.mutate({ globalDryRun: v })} />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Daily token budget (USD)</label>
            <Input type="number" defaultValue={s?.dailyTokenBudgetUsd}
              onBlur={(e) => patch.mutate({ dailyTokenBudgetUsd: Number(e.target.value) })}
              className="bg-slate-800 border-slate-700 text-white" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/60 border-orange-500/20">
        <CardHeader><CardTitle className="text-orange-400">Daily Briefing</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-slate-300">Have CEO Neiver Alvarez-AI run the daily briefing right now (CEO must be active).</p>
          <Button onClick={() => briefing.mutate()} disabled={briefing.isPending}
            className="bg-orange-500 hover:bg-orange-600">
            {briefing.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
            Run Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default CSuitePanel;
