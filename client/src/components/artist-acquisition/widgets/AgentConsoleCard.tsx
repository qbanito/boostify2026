import {
  Search,
  Network,
  Eye,
  Target,
  Braces,
  Layout,
  Image as ImageIcon,
  Mail,
  Users,
  Zap,
  RotateCw,
  Sparkles,
  Play,
  Loader2,
  Clock,
  ScrollText,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { SectionCard } from '../shared/SectionCard';
import { Modal } from '../shared/Modal';
import { TOKENS } from '../shared/tokens';
import { apiRequest } from '../../../lib/queryClient';
import type {
  AcquisitionAgent,
  AcquisitionAgentStatus,
} from '../../../hooks/use-acquisition-overview';

const ICONS: Record<string, any> = {
  search: Search,
  network: Network,
  eye: Eye,
  target: Target,
  braces: Braces,
  layout: Layout,
  image: ImageIcon,
  mail: Mail,
  users: Users,
  zap: Zap,
  rotate: RotateCw,
  sparkles: Sparkles,
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  running: { label: 'Running', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.35)', dot: '#22d3ee' },
  idle: { label: 'Idle', color: '#7bb77b', bg: 'rgba(120,200,120,0.08)', border: 'rgba(120,200,120,0.35)', dot: '#7bb77b' },
  waiting: { label: 'Waiting', color: TOKENS.MUTED, bg: 'rgba(255,255,255,0.04)', border: TOKENS.BORDER, dot: TOKENS.MUTED },
  not_configured: { label: 'Not Configured', color: '#d9a34a', bg: 'rgba(217,163,74,0.08)', border: 'rgba(217,163,74,0.35)', dot: '#d9a34a' },
  not_wired: { label: 'Planned', color: TOKENS.MUTED, bg: 'rgba(255,255,255,0.03)', border: TOKENS.BORDER, dot: TOKENS.MUTED },
  planned: { label: 'Planned', color: TOKENS.MUTED, bg: 'rgba(255,255,255,0.03)', border: TOKENS.BORDER, dot: TOKENS.MUTED },
  error: { label: 'Error', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)', dot: '#ef4444' },
};

const RUNNABLE = new Set(['hunter', 'potential-scorer', 'image-stylizer', 'master-json']);

interface AgentRun {
  id: number;
  agentId: string;
  actorEmail?: string | null;
  status: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  error?: string | null;
  createdAt: string;
}

export function AgentConsoleCard({ data }: { data?: AcquisitionAgent[] }) {
  const agents = data || [];
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [runs, setRuns] = useState<AgentRun[]>([]);

  // Poll /agents/runs every 10s while the log modal is open.
  useEffect(() => {
    if (!logOpen) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res: any = await apiRequest('GET', '/api/admin/artist-acquisition/agents/runs?limit=50');
        if (!cancelled) setRuns(res?.runs || []);
      } catch {
        /* ignore */
      }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [logOpen]);

  const runAgent = async (id: string) => {
    if (!RUNNABLE.has(id) || runningId) return;
    setRunningId(id);
    setMessage(null);
    try {
      // Route through the audited + rate-limited endpoint; it delegates to the
      // underlying discovery routines server-side.
      await apiRequest('POST', `/api/admin/artist-acquisition/agents/${encodeURIComponent(id)}/run`);
      setMessage(`Agent "${id}" invoked.`);
    } catch (err: any) {
      setMessage(`Failed: ${err?.message || 'unknown'}`);
    } finally {
      setRunningId(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <SectionCard
      number="09"
      title="Agent Console"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLogOpen(true)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors hover:bg-white/5"
            style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
            title="View live agent log"
          >
            <ScrollText size={11} />
            View log
          </button>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ color: TOKENS.MUTED, background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
          >
            {agents.length} agents
          </span>
        </div>
      }
      bodyClassName="!py-3"
    >
      {message && (
        <div
          className="text-[11px] mb-2 px-2 py-1 rounded"
          style={{ color: TOKENS.ORANGE_GLOW, background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
        >
          {message}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {agents.map((agent) => {
          const Icon = ICONS[agent.icon] || Sparkles;
          const style = STATUS_STYLE[agent.status] || STATUS_STYLE.planned;
          const runnable = RUNNABLE.has(agent.id);
          const isRunning = runningId === agent.id;
          return (
            <div
              key={agent.id}
              className="flex items-start gap-2.5 p-2.5 rounded-md transition-colors hover:bg-white/[0.03]"
              style={{ border: `1px solid ${TOKENS.BORDER}`, background: TOKENS.SURFACE_3 }}
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: TOKENS.ORANGE_SOFT, border: `1px solid ${TOKENS.ORANGE_RING}` }}
              >
                <Icon size={14} style={{ color: TOKENS.ORANGE_GLOW }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
                    {agent.name}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[9.5px] uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                    style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: style.dot }} />
                    {style.label}
                  </span>
                </div>
                <div
                  className="text-[10.5px] mt-0.5 line-clamp-2"
                  style={{ color: TOKENS.MUTED }}
                  title={agent.description}
                >
                  {agent.description}
                </div>
                {agent.lastRun && (
                  <div
                    className="flex items-center gap-1 text-[10px] mt-1"
                    style={{ color: TOKENS.MUTED }}
                  >
                    <Clock size={9} />
                    Last run {agent.lastRun}
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10.5px]" style={{ color: TOKENS.MUTED }}>
                    {agent.kpi}
                  </span>
                  <button
                    onClick={() => runAgent(agent.id)}
                    disabled={!runnable || isRunning}
                    className="inline-flex items-center gap-1 text-[10.5px] px-2 py-[3px] rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-125"
                    style={{
                      color: runnable ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
                      background: runnable ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_2,
                      border: `1px solid ${runnable ? TOKENS.ORANGE_RING : TOKENS.BORDER}`,
                    }}
                    title={runnable ? 'Invoke agent' : 'Not runnable yet'}
                  >
                    {isRunning ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                    {isRunning ? 'Running' : 'Invoke'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live agent log */}
      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Agent Live Log"
        subtitle="Most recent invocations (auto-refresh every 10s)"
        size="lg"
      >
        {runs.length === 0 ? (
          <div className="text-[12px]" style={{ color: TOKENS.MUTED }}>
            No agent runs logged yet. Invoke an agent to see activity here.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-auto">
            {runs.map((r) => {
              const style = STATUS_STYLE[r.status] || STATUS_STYLE.planned;
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-2.5 p-2 rounded-md text-[11.5px]"
                  style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: style.dot }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: TOKENS.TEXT }}>
                        {r.agentId}
                      </span>
                      <span
                        className="uppercase tracking-wider text-[9.5px] px-1.5 rounded-full"
                        style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
                      >
                        {style.label}
                      </span>
                      {r.durationMs != null && (
                        <span style={{ color: TOKENS.MUTED }}>{r.durationMs}ms</span>
                      )}
                      <span style={{ color: TOKENS.MUTED }}>
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {r.actorEmail && (
                      <div className="text-[10.5px] mt-0.5" style={{ color: TOKENS.MUTED }}>
                        by {r.actorEmail}
                      </div>
                    )}
                    {r.error && (
                      <div
                        className="text-[10.5px] mt-1 px-1.5 py-0.5 rounded"
                        style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                      >
                        {r.error}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </SectionCard>
  );
}
