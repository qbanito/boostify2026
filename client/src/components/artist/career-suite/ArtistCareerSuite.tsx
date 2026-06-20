/**
 * Artist Career Suite — Module UI
 *
 * Shows the activation CTA when the artist has no subscription / pending status.
 * When approved/active, shows a tabbed dashboard:
 *   - Chat (pick personal agent OR corporate consultant, send message, see reply)
 *   - Threads (recent conversation history)
 *   - Goals
 *   - Settings
 *
 * Mobile-first, matches Apple-minimal preset used elsewhere in the app.
 * Uses the shared TOKENS palette so it slots into the existing module grid.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HelpCircle, BookOpen, X, Brain, Target, Users, Zap,
  CalendarDays, Trophy, BarChart2, Sparkles, MessageSquare, Settings2,
} from 'lucide-react';
import { TOKENS, FONT_MONO } from '../../artist-modules-shared/tokens';

type SessionType = 'personal' | 'corporate';
type AgentSummary = { agentKey: string; name?: string; role?: string };

interface SubscriptionRow {
  id: number;
  artistId: string;
  plan: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'cancelled' | 'expired';
  requestedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decisionNote?: string | null;
}

interface StatusResponse {
  ok: boolean;
  artistId: string;
  active: boolean;
  subscription: SubscriptionRow | null;
  agents?: Array<{ agentKey: string; name: string; role: string; active: boolean }>;
}

interface CatalogResponse {
  ok: boolean;
  personalAgents: AgentSummary[];
  corporateAgents: string[];
}

interface ThreadRow {
  id: number;
  agentKey: string;
  sessionType: SessionType;
  topic: string | null;
  status: string;
  createdAt: string;
}

interface MessageRow {
  id: number;
  threadId: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolName?: string | null;
  toolResult?: unknown;
  createdAt: string;
}

interface CommandResult {
  ok: boolean;
  result?: { threadId: number; finalText: string; toolCalls: number; totalCostUsd: number };
  error?: string;
}

const CORPORATE_LABELS: Record<string, string> = {
  ceo: 'CEO',
  cmo: 'CMO',
  cro: 'CRO',
  cpo: 'CPO',
  cfo: 'CFO',
  coo: 'COO',
  cto: 'CTO',
  clo: 'CLO',
  cdo: 'CDO',
  ciso: 'CISO',
};

const GUIDE_ITEMS: Array<{
  icon: React.FC<{ size: number; color?: string }>;
  color: string;
  bg: string;
  border: string;
  title: string;
  description: string;
}> = [
  {
    icon: Brain as any, color: '#c084fc', bg: 'rgba(192,132,252,0.1)', border: 'rgba(192,132,252,0.25)',
    title: 'What is the AI Career Suite?',
    description: 'Your dedicated AI executive team — Manager, Marketing Director, A&R Consultant, Merch Strategist and Finance Advisor — all working together to accelerate your music career.',
  },
  {
    icon: MessageSquare as any, color: '#67e8f9', bg: 'rgba(103,232,249,0.1)', border: 'rgba(103,232,249,0.25)',
    title: 'Chat — Personal Team',
    description: 'Send messages directly to any of your personal agents. Each one specializes in their domain and remembers previous threads. Ask your Manager for strategy, Marketing for campaigns, or Finance for budget advice.',
  },
  {
    icon: Users as any, color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)',
    title: 'Corporate Consultation',
    description: "Get high-level guidance from Boostify's corporate C-Suite (CEO, CMO, CFO, CTO and more). These consultations cover platform strategy, revenue optimization and scaling decisions.",
  },
  {
    icon: BarChart2 as any, color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)',
    title: 'Threads — Conversation History',
    description: 'Every conversation is saved as a thread. Browse past sessions, review AI recommendations and track how your strategy has evolved over time.',
  },
  {
    icon: Target as any, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)',
    title: 'Goals — Track Your Milestones',
    description: 'Set specific career goals (streams, followers, revenue) and assign them to the right agent. Your team references these goals to keep every recommendation aligned with your targets.',
  },
  {
    icon: Zap as any, color: '#818cf8', bg: 'rgba(129,140,248,0.1)', border: 'rgba(129,140,248,0.25)',
    title: 'Agent Specializations',
    description: 'Manager: career roadmap. Marketing: campaigns & hooks. A&R: sound direction. Merch: product strategy. Finance: revenue & budgeting. Each agent has deep context about your artist profile.',
  },
  {
    icon: Settings2 as any, color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)',
    title: 'Settings — Control Your Suite',
    description: 'Use the kill switch to pause all agents instantly. Enable dry-run mode to test AI recommendations without real writes. Cancel your subscription at any time from the settings panel.',
  },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!r.ok) {
    let body: any = null;
    try {
      body = await r.json();
    } catch {}
    throw new Error(body?.error || `HTTP ${r.status}`);
  }
  return r.json();
}

export interface ArtistCareerSuiteProps {
  /** The artist whose suite this is (string in case it's a Clerk id). */
  artistId: string;
}

export function ArtistCareerSuite({ artistId }: ArtistCareerSuiteProps) {
  const qc = useQueryClient();

  const statusQ = useQuery<StatusResponse>({
    queryKey: ['artist-suite-status', artistId],
    queryFn: () => api<StatusResponse>(`/api/artist/suite/status?artistId=${encodeURIComponent(artistId)}`),
    refetchInterval: 30_000,
  });

  const catalogQ = useQuery<CatalogResponse>({
    queryKey: ['artist-suite-catalog'],
    queryFn: () => api<CatalogResponse>('/api/artist/suite/catalog'),
    staleTime: Infinity,
  });

  const sub = statusQ.data?.subscription;
  const isActive = !!statusQ.data?.active;

  // ----- Activation flow -----
  const activateMut = useMutation({
    mutationFn: () =>
      api<{ ok: boolean; subscription: SubscriptionRow; autoApproved: boolean }>(
        `/api/artist/suite/activate`,
        { method: 'POST', body: JSON.stringify({ artistId }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['artist-suite-status', artistId] }),
  });

  // ─────── render: not yet activated / pending / rejected ───────
  if (!sub) {
    return (
      <ActivationCard
        title="Activate your AI Career Suite"
        description="Your personal AI executive team — 5 agents (Manager, Marketing, A&R, Merch, Finance) plus consultative access to the Boostify corporate C-Suite. Activation requires admin approval."
        cta="Request activation"
        loading={activateMut.isPending}
        onClick={() => activateMut.mutate()}
        error={activateMut.error?.message || statusQ.error?.message}
      />
    );
  }
  if (sub.status === 'pending') {
    return (
      <StatusCard
        accent={TOKENS.ORANGE}
        title="Pending admin approval"
        description={`Requested ${new Date(sub.requestedAt).toLocaleString()}. An admin will review and approve shortly.`}
      />
    );
  }
  if (sub.status === 'rejected') {
    return (
      <StatusCard
        accent={TOKENS.DANGER}
        title="Request rejected"
        description={sub.decisionNote || 'An admin rejected your activation request.'}
        action={
          <button
            onClick={() => activateMut.mutate()}
            disabled={activateMut.isPending}
            style={primaryBtn}
          >
            Submit a new request
          </button>
        }
      />
    );
  }
  if (sub.status === 'cancelled' || sub.status === 'expired') {
    return (
      <StatusCard
        accent={TOKENS.MUTED}
        title={sub.status === 'expired' ? 'Subscription expired' : 'Subscription cancelled'}
        description="Reactivate to resume working with your AI executives."
        action={
          <button
            onClick={() => activateMut.mutate()}
            disabled={activateMut.isPending}
            style={primaryBtn}
          >
            Reactivate
          </button>
        }
      />
    );
  }

  // ───────── Active suite ─────────
  return (
    <ActiveSuite
      artistId={artistId}
      catalog={catalogQ.data}
      personalAgents={statusQ.data?.agents || []}
      isActive={isActive}
    />
  );
}

// ───────── Active dashboard ─────────

function ActiveSuite({
  artistId,
  catalog,
  personalAgents,
  isActive,
}: {
  artistId: string;
  catalog?: CatalogResponse;
  personalAgents: Array<{ agentKey: string; name: string; role: string; active: boolean }>;
  isActive: boolean;
}) {
  const [tab, setTab] = useState<'chat' | 'threads' | 'goals' | 'settings'>('chat');
  const [sessionType, setSessionType] = useState<SessionType>('personal');
  const [agentKey, setAgentKey] = useState<string>(personalAgents[0]?.agentKey || 'manager');
  const [openThreadId, setOpenThreadId] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Switch agent list when the user toggles personal/corporate
  useEffect(() => {
    if (sessionType === 'personal') {
      setAgentKey(personalAgents[0]?.agentKey || 'manager');
    } else {
      setAgentKey(catalog?.corporateAgents?.[0] || 'ceo');
    }
  }, [sessionType, personalAgents.length, catalog?.corporateAgents?.length]);

  return (
    <div
      style={{
        background: TOKENS.SURFACE,
        border: `1px solid ${TOKENS.BORDER}`,
        borderRadius: 16,
        padding: 0,
        overflow: 'hidden',
        color: TOKENS.TEXT,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${TOKENS.BORDER_SOFT}`,
          background: TOKENS.SURFACE_2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🧠</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>AI Career Suite</div>
            <div style={{ fontSize: 11.5, color: TOKENS.MUTED, fontFamily: FONT_MONO }}>
              {isActive ? 'active' : 'approved'} · elite tier
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowGuide(true); }}
            title="How it works"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <HelpCircle size={14} color={TOKENS.MUTED} />
          </button>
        </div>
        <TabBar
          tabs={[
            { id: 'chat', label: 'Chat' },
            { id: 'threads', label: 'Threads' },
            { id: 'goals', label: 'Goals' },
            { id: 'settings', label: 'Settings' },
          ]}
          active={tab}
          onChange={(t) => setTab(t as any)}
        />
      </div>

      <div style={{ padding: 18 }}>
        {tab === 'chat' && (
          <ChatPane
            artistId={artistId}
            sessionType={sessionType}
            setSessionType={setSessionType}
            agentKey={agentKey}
            setAgentKey={setAgentKey}
            personalAgents={personalAgents}
            corporateAgents={catalog?.corporateAgents || []}
          />
        )}
        {tab === 'threads' && (
          <ThreadsPane
            artistId={artistId}
            openThreadId={openThreadId}
            setOpenThreadId={setOpenThreadId}
          />
        )}
        {tab === 'goals' && <GoalsPane artistId={artistId} agentKey={agentKey} />}
        {tab === 'settings' && <SettingsPane artistId={artistId} />}
      </div>

      {showGuide && <GuideOverlay onClose={() => setShowGuide(false)} />}
    </div>
  );
}

// ─── Chat pane ───

function ChatPane({
  artistId,
  sessionType,
  setSessionType,
  agentKey,
  setAgentKey,
  personalAgents,
  corporateAgents,
}: {
  artistId: string;
  sessionType: SessionType;
  setSessionType: (s: SessionType) => void;
  agentKey: string;
  setAgentKey: (k: string) => void;
  personalAgents: Array<{ agentKey: string; name: string; role: string }>;
  corporateAgents: string[];
}) {
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<
    Array<{ role: 'user' | 'assistant' | 'error'; content: string; meta?: string }>
  >([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendMut = useMutation({
    mutationFn: (message: string) =>
      api<CommandResult>(`/api/artist/suite/command`, {
        method: 'POST',
        body: JSON.stringify({ artistId, agentKey, sessionType, message }),
      }),
    onSuccess: (r, message) => {
      if (r.ok && r.result) {
        setHistory((h) => [
          ...h,
          { role: 'user', content: message },
          {
            role: 'assistant',
            content: r.result!.finalText || '(no reply)',
            meta: `$${r.result!.totalCostUsd.toFixed(5)} · ${r.result!.toolCalls} tool call(s)`,
          },
        ]);
      } else {
        setHistory((h) => [
          ...h,
          { role: 'user', content: message },
          { role: 'error', content: r.error || 'Unknown error' },
        ]);
      }
    },
    onError: (err: any, message) => {
      setHistory((h) => [
        ...h,
        { role: 'user', content: message },
        { role: 'error', content: err.message || String(err) },
      ]);
    },
  });

  const handleSend = () => {
    const msg = draft.trim();
    if (!msg) return;
    setDraft('');
    sendMut.mutate(msg);
  };

  const agentOptions =
    sessionType === 'personal'
      ? personalAgents.map((a) => ({ value: a.agentKey, label: a.name || a.agentKey }))
      : corporateAgents.map((k) => ({
          value: k,
          label: `${CORPORATE_LABELS[k] || k.toUpperCase()} (consultation)`,
        }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SegButton
          active={sessionType === 'personal'}
          onClick={() => setSessionType('personal')}
        >
          Personal team
        </SegButton>
        <SegButton
          active={sessionType === 'corporate'}
          onClick={() => setSessionType('corporate')}
        >
          Corporate consultation
        </SegButton>
      </div>

      <select
        value={agentKey}
        onChange={(e) => setAgentKey(e.target.value)}
        style={{
          background: TOKENS.SURFACE_2,
          border: `1px solid ${TOKENS.BORDER}`,
          color: TOKENS.TEXT,
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 14,
          width: '100%',
          maxWidth: 360,
        }}
      >
        {agentOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Conversation log */}
      <div
        style={{
          minHeight: 240,
          maxHeight: 420,
          overflowY: 'auto',
          background: TOKENS.SURFACE_2,
          border: `1px solid ${TOKENS.BORDER_SOFT}`,
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {history.length === 0 && (
          <div style={{ color: TOKENS.MUTED, fontSize: 13, padding: 24, textAlign: 'center' }}>
            No messages yet. Ask your{' '}
            {sessionType === 'personal' ? agentKey : `${agentKey.toUpperCase()} consultant`} anything.
          </div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '10px 12px',
              borderRadius: 12,
              background:
                m.role === 'user'
                  ? TOKENS.ORANGE_SOFT
                  : m.role === 'error'
                  ? 'rgba(239,68,68,0.12)'
                  : TOKENS.SURFACE_3,
              border: `1px solid ${
                m.role === 'error' ? TOKENS.DANGER : TOKENS.BORDER_SOFT
              }`,
              fontSize: 13.5,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {m.content}
            {m.meta && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: TOKENS.MUTED,
                  fontFamily: FONT_MONO,
                }}
              >
                {m.meta}
              </div>
            )}
          </div>
        ))}
        {sendMut.isPending && (
          <div
            style={{
              alignSelf: 'flex-start',
              fontSize: 12,
              color: TOKENS.MUTED,
              fontFamily: FONT_MONO,
            }}
          >
            thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Ask ${agentKey}…`}
          rows={2}
          style={{
            flex: 1,
            background: TOKENS.SURFACE_2,
            border: `1px solid ${TOKENS.BORDER}`,
            color: TOKENS.TEXT,
            borderRadius: 12,
            padding: 10,
            fontSize: 14,
            resize: 'vertical',
          }}
        />
        <button
          onClick={handleSend}
          disabled={sendMut.isPending || !draft.trim()}
          style={primaryBtn}
        >
          {sendMut.isPending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ─── Threads pane ───

function ThreadsPane({
  artistId,
  openThreadId,
  setOpenThreadId,
}: {
  artistId: string;
  openThreadId: number | null;
  setOpenThreadId: (n: number | null) => void;
}) {
  const threadsQ = useQuery<{ ok: boolean; threads: ThreadRow[] }>({
    queryKey: ['artist-suite-threads', artistId],
    queryFn: () =>
      api(`/api/artist/suite/threads?artistId=${encodeURIComponent(artistId)}&limit=50`),
  });

  const messagesQ = useQuery<{ ok: boolean; thread: ThreadRow; messages: MessageRow[] }>({
    queryKey: ['artist-suite-thread-messages', artistId, openThreadId],
    enabled: openThreadId != null,
    queryFn: () =>
      api(
        `/api/artist/suite/threads/${openThreadId}/messages?artistId=${encodeURIComponent(
          artistId,
        )}`,
      ),
  });

  if (openThreadId != null) {
    return (
      <div>
        <button onClick={() => setOpenThreadId(null)} style={ghostBtn}>
          ← back to threads
        </button>
        <div style={{ marginTop: 12 }}>
          {messagesQ.isLoading ? (
            <Muted text="Loading…" />
          ) : messagesQ.data?.messages?.length ? (
            messagesQ.data.messages
              .filter((m) => m.role !== 'system')
              .map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: TOKENS.SURFACE_2,
                    border: `1px solid ${TOKENS.BORDER_SOFT}`,
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: TOKENS.MUTED }}>
                    {m.role}
                    {m.toolName ? ` · ${m.toolName}` : ''}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>
                    {m.content || (m.toolResult ? JSON.stringify(m.toolResult, null, 2) : '')}
                  </div>
                </div>
              ))
          ) : (
            <Muted text="No messages." />
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {threadsQ.isLoading && <Muted text="Loading…" />}
      {threadsQ.data?.threads?.length === 0 && <Muted text="No threads yet." />}
      {threadsQ.data?.threads?.map((t) => (
        <button
          key={t.id}
          onClick={() => setOpenThreadId(t.id)}
          style={{
            textAlign: 'left',
            background: TOKENS.SURFACE_2,
            border: `1px solid ${TOKENS.BORDER_SOFT}`,
            borderRadius: 10,
            padding: 12,
            color: TOKENS.TEXT,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500 }}>{t.topic || '(no topic)'}</div>
          <div style={{ fontSize: 11, color: TOKENS.MUTED, fontFamily: FONT_MONO, marginTop: 4 }}>
            {t.sessionType} · {t.agentKey} · {t.status} ·{' '}
            {new Date(t.createdAt).toLocaleString()}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Goals pane ───

function GoalsPane({ artistId, agentKey }: { artistId: string; agentKey: string }) {
  const qc = useQueryClient();
  const goalsQ = useQuery<{ ok: boolean; goals: any[] }>({
    queryKey: ['artist-suite-goals', artistId],
    queryFn: () => api(`/api/artist/suite/goals?artistId=${encodeURIComponent(artistId)}`),
  });

  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState('streams_total');
  const [target, setTarget] = useState('100000');

  const createMut = useMutation({
    mutationFn: () =>
      api(`/api/artist/suite/goals`, {
        method: 'POST',
        body: JSON.stringify({
          artistId,
          ownerAgent: agentKey,
          title,
          metric,
          targetValue: target,
        }),
      }),
    onSuccess: () => {
      setTitle('');
      qc.invalidateQueries({ queryKey: ['artist-suite-goals', artistId] });
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          background: TOKENS.SURFACE_2,
          border: `1px solid ${TOKENS.BORDER_SOFT}`,
          borderRadius: 12,
          padding: 12,
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: 8,
        }}
      >
        <input
          placeholder="Goal title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            placeholder="target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            style={{ ...inputStyle, width: 120 }}
          />
        </div>
        <button
          disabled={!title || createMut.isPending}
          onClick={() => createMut.mutate()}
          style={primaryBtn}
        >
          {createMut.isPending ? '…' : `Create goal (owner: ${agentKey})`}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {goalsQ.data?.goals?.length === 0 && <Muted text="No goals yet." />}
        {goalsQ.data?.goals?.map((g: any) => (
          <div
            key={g.id}
            style={{
              background: TOKENS.SURFACE_2,
              border: `1px solid ${TOKENS.BORDER_SOFT}`,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500 }}>{g.title}</div>
            <div
              style={{
                fontSize: 11,
                color: TOKENS.MUTED,
                fontFamily: FONT_MONO,
                marginTop: 4,
              }}
            >
              {g.ownerAgent} · {g.metric} · target {g.targetValue} · {g.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings pane ───

function SettingsPane({ artistId }: { artistId: string }) {
  const qc = useQueryClient();
  const settingsQ = useQuery<{ ok: boolean; settings: any }>({
    queryKey: ['artist-suite-settings', artistId],
    queryFn: () => api(`/api/artist/suite/settings?artistId=${encodeURIComponent(artistId)}`),
  });

  const patchMut = useMutation({
    mutationFn: (patch: Record<string, any>) =>
      api(`/api/artist/suite/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ artistId, ...patch }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['artist-suite-settings', artistId] }),
  });

  const cancelMut = useMutation({
    mutationFn: () =>
      api(`/api/artist/suite/cancel`, {
        method: 'POST',
        body: JSON.stringify({ artistId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['artist-suite-status', artistId] }),
  });

  const s = settingsQ.data?.settings || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle
        label="Kill switch (pause all agents)"
        checked={!!s.killSwitch}
        onChange={(v) => patchMut.mutate({ killSwitch: v })}
      />
      <Toggle
        label="Dry-run mode (no real writes)"
        checked={s.dryRunGlobal !== false}
        onChange={(v) => patchMut.mutate({ dryRunGlobal: v })}
      />
      <button onClick={() => cancelMut.mutate()} style={dangerBtn}>
        Cancel subscription
      </button>
    </div>
  );
}

// ─── Building blocks ───

function ActivationCard({
  title,
  description,
  cta,
  loading,
  onClick,
  error,
}: {
  title: string;
  description: string;
  cta: string;
  loading: boolean;
  onClick: () => void;
  error?: string;
}) {
  return (
    <div
      style={{
        background: TOKENS.SURFACE,
        border: `1px solid ${TOKENS.BORDER}`,
        borderRadius: 16,
        padding: 22,
        color: TOKENS.TEXT,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>🧠 {title}</div>
      <div style={{ fontSize: 13.5, color: TOKENS.MUTED, lineHeight: 1.55 }}>{description}</div>
      <button onClick={onClick} disabled={loading} style={{ ...primaryBtn, alignSelf: 'flex-start' }}>
        {loading ? 'Submitting…' : cta}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: TOKENS.DANGER, fontFamily: FONT_MONO }}>{error}</div>
      )}
    </div>
  );
}

function StatusCard({
  title,
  description,
  accent,
  action,
}: {
  title: string;
  description: string;
  accent: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: TOKENS.SURFACE,
        border: `1px solid ${TOKENS.BORDER}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 16,
        padding: 22,
        color: TOKENS.TEXT,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, color: TOKENS.MUTED, marginTop: 6, lineHeight: 1.5 }}>
        {description}
      </div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            background: active === t.id ? TOKENS.ORANGE_SOFT : 'transparent',
            color: active === t.id ? TOKENS.ORANGE_GLOW : TOKENS.MUTED,
            border: 'none',
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? TOKENS.ORANGE_SOFT : TOKENS.SURFACE_2,
        color: active ? TOKENS.ORANGE_GLOW : TOKENS.TEXT,
        border: `1px solid ${active ? TOKENS.ORANGE : TOKENS.BORDER}`,
        padding: '7px 12px',
        borderRadius: 999,
        fontSize: 12.5,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER_SOFT}`,
        borderRadius: 10,
        padding: 10,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Muted({ text }: { text: string }) {
  return (
    <div style={{ color: TOKENS.MUTED, fontSize: 13, padding: 24, textAlign: 'center' }}>{text}</div>
  );
}

const inputStyle: React.CSSProperties = {
  background: TOKENS.SURFACE_3,
  border: `1px solid ${TOKENS.BORDER}`,
  color: TOKENS.TEXT,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
};

const primaryBtn: React.CSSProperties = {
  background: TOKENS.ORANGE,
  color: '#0a0a0a',
  border: 'none',
  padding: '9px 16px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  color: TOKENS.MUTED,
  border: `1px solid ${TOKENS.BORDER_SOFT}`,
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
};

const dangerBtn: React.CSSProperties = {
  background: 'transparent',
  color: TOKENS.DANGER,
  border: `1px solid ${TOKENS.DANGER}`,
  padding: '8px 14px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

// ─── Guide Overlay ───

function GuideOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#0d0d18',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '88dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
            }}
          >
            <X size={15} color="rgba(255,255,255,0.55)" />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>How It Works</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              AI Career Suite — Complete Guide
            </div>
          </div>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 999,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              flexShrink: 0,
            }}
          >
            <BookOpen size={12} color="#a5b4fc" />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Guide
            </span>
          </div>
        </div>

        {/* Scrollable items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {GUIDE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                style={{
                  display: 'flex', gap: 12, padding: '12px 14px',
                  borderRadius: 16, border: `1px solid ${item.border}`,
                  background: 'rgba(255,255,255,0.015)',
                }}
              >
                <div
                  style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 10,
                    background: item.bg, border: `1px solid ${item.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon size={16} color={item.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 4 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.48)', lineHeight: 1.55 }}>
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pro tip */}
          <div
            style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              borderRadius: 16, border: '1px solid rgba(249,115,22,0.22)',
              background: 'rgba(249,115,22,0.07)',
            }}
          >
            <Sparkles size={15} color="#fb923c" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fb923c', marginBottom: 4 }}>
                Pro Tip
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
                Start by chatting with your Manager agent to define a 90-day career roadmap. Then assign goals to each specialist — your AI team will align their advice to hit those milestones faster.
              </div>
            </div>
          </div>

          {/* Bottom safe area spacer */}
          <div style={{ height: 8 }} />
        </div>
      </div>
    </div>
  );
}

export default ArtistCareerSuite;
