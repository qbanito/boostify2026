import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Bot, CheckCircle2, Loader2, MessageSquare, Minus, RotateCcw, Send, Sparkles, UserRound, X } from 'lucide-react';
import { apiRequest, getAuthHeaders, resolveApiUrl } from '@/lib/queryClient';
import type { ArtistProfileAgentAction } from '../../../../shared/artist-profile-agent';
import type { CopilotUiCommand, CopilotUiResult } from '../../../../shared/artist-profile-copilot';
import { readProfileCopilotEvents } from '../../lib/profile-copilot-stream';
import { PROFILE_ASSISTANT_MODULES } from '../../../../shared/artist-profile-agent';
import type { SpiderEdge, SpiderNode } from './artist-copilot-spider-mode';

const SpiderMode = lazy(() => import('./artist-copilot-spider-mode'));

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function readHistory(key: string, artistName: string): ChatMessage[] {
  try {
    const stored = JSON.parse((key ? window.localStorage.getItem(key) : null) || 'null');
    if (Array.isArray(stored)) {
      const messages = stored.filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').slice(-30);
      if (messages.length) return messages;
    }
  } catch {
    // Ignore malformed or unavailable local history.
  }
  return [{ role: 'assistant', content: `Hi, I’m your Artist Copilot for ${artistName}. I can improve and save your biography, navigate your profile tools, write into their fields, and prepare settings around your music and artist identity. Tell me what you want to work on.` }];
}

export function ArtistProfileAgentChat({
  artistId,
  artistName,
  accent,
  open,
  onClose,
  onActions,
  onUiCommand,
  spiderMode,
  onSpiderModeChange,
}: {
  artistId: number;
  artistName: string;
  accent: string;
  open: boolean;
  onClose: () => void;
  onActions: (actions: ArtistProfileAgentAction[]) => void;
  onUiCommand: (command: CopilotUiCommand, signal?: AbortSignal) => Promise<CopilotUiResult>;
  spiderMode: boolean;
  onSpiderModeChange: (open: boolean) => void;
}) {
  const storageKey = `artist-profile-copilot:v2:${artistId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => readHistory(storageKey, artistName));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController>();
  const uiHandlerRef = useRef(onUiCommand);
  uiHandlerRef.current = onUiCommand;
  const [compact, setCompact] = useState(false);
  const [activity, setActivity] = useState<string[]>([]);
  const [spiderNodes, setSpiderNodes] = useState<SpiderNode[]>([]);
  const visibleSpiderNodes = useRef<SpiderNode[]>([]);
  const [spiderEdges, setSpiderEdges] = useState<SpiderEdge[]>([]);
  const [goal, setGoal] = useState('');
  const lastSpiderNode = useRef<string | null>(null);
  const spiderModeRef = useRef(spiderMode);
  spiderModeRef.current = spiderMode;
  useEffect(() => () => controllerRef.current?.abort(), []);

  const mergeVisibleModules = (result: CopilotUiResult) => {
    if (!result.modules) return;
    const visible = result.modules.filter((module) => module.visible).slice(0, 12);
    visibleSpiderNodes.current = visible.map((module) => ({ id: module.id, name: module.name, surface: module.surface, status: 'visible' }));
    setSpiderNodes((previous) => {
      const next = previous.filter((node) => node.status !== 'visible' || visible.some((module) => module.id === node.id));
      for (const module of visible) if (!next.some((item) => item.id === module.id)) next.push({ id: module.id, name: module.name, surface: module.surface, status: 'visible' });
      return next.slice(-14);
    });
  };

  useEffect(() => {
    if (!spiderMode) return;
    let active = true;
    void uiHandlerRef.current({ type: 'inspect_interface', moduleId: '' }).then((result) => { if (active && result.success) mergeVisibleModules(result); });
    return () => { active = false; };
  }, [spiderMode]);

  const commandNodes = (command: CopilotUiCommand): SpiderNode[] => {
    let ids: string[] = [];
    if (command.type === 'configure_layout') ids = [...command.enableSections, ...command.disableSections, ...command.enableWidgets, ...command.disableWidgets, ...command.moveSections.map((item) => item.id)];
    else if (command.type === 'preview_profile_text' || command.type === 'profile_text_saved') ids = ['profile'];
    else if ('moduleId' in command && command.moduleId) ids = [command.moduleId];
    return Array.from(new Set(ids)).flatMap<SpiderNode>((id): SpiderNode[] => {
      if (id === 'profile') return [{ id, name: 'Profile Editor', surface: 'profile' as const, status: 'working' as const }];
      const module = PROFILE_ASSISTANT_MODULES.find((item) => item.id === id);
      return module ? [{ id, name: module.name, surface: module.surface, status: 'working' as const }] : [];
    });
  };
  const markNodes = (targets: SpiderNode[], status: SpiderNode['status']) => {
    if (!targets.length) return;
    setSpiderNodes((previous) => {
      const next = [...previous];
      for (const target of targets) {
        const existing = next.findIndex((node) => node.id === target.id);
        if (existing >= 0) next.splice(existing, 1);
        next.push({ ...target, status });
      }
      return next.slice(-14);
    });
  };

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30))); } catch { /* local history is optional */ }
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (text = draft) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.slice(-20);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setBusy(true);
    setError('');
    setActivity([]);
    setGoal(message);
    setSpiderEdges([]);
    lastSpiderNode.current = null;
    setSpiderNodes(visibleSpiderNodes.current);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const response = await fetch(resolveApiUrl(`/api/artist-hermes/${artistId}/chat`), {
        method: 'POST',
        headers: await getAuthHeaders(), credentials: 'include', signal: controller.signal,
        body: JSON.stringify({ message, conversationHistory: history, enableProfileTools: true, stream: true }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Copilot request failed (${response.status}).`);
      }
      if (!response.body) throw new Error('Live profile control is unavailable in this browser.');
      let runId = '';
      let complete = false;
      let navigated = false;
      for await (const event of readProfileCopilotEvents(response.body)) {
        if (controller.signal.aborted) break;
        if (event.type === 'session') runId = event.runId;
        if (event.type === 'progress') setActivity((previous) => [...previous.filter((item) => item !== event.message), event.message].slice(-8));
        if (event.type === 'ui_command') {
          if (!runId) throw new Error('The live control session was not initialized.');
          const command = event.command;
          const isNavigation = command.type !== 'inspect_interface' || !!command.moduleId;
          if (isNavigation && !navigated) { navigated = true; if (!spiderModeRef.current) setCompact(true); }
          const targets = commandNodes(command);
          markNodes(targets, 'working');
          for (const target of targets) {
            const from: string = lastSpiderNode.current || 'goal';
            if (from !== target.id) setSpiderEdges((previous) => previous.some((edge) => edge.from === from && edge.to === target.id) ? previous : [...previous, { from, to: target.id }].slice(-20));
            lastSpiderNode.current = target.id;
          }
          let result: CopilotUiResult;
          try { result = await uiHandlerRef.current(command, controller.signal); }
          catch (error: any) { result = { success: false, error: error?.message || 'The interface action failed.' }; }
          markNodes(targets, result.success ? 'done' : 'error');
          if (result.success) mergeVisibleModules(result);
          if (controller.signal.aborted) break;
          await apiRequest({
            url: `/api/artist-hermes/${artistId}/chat/${runId}/ui-result`, method: 'POST',
            body: { requestId: event.requestId, result },
          });
        }
        if (event.type === 'error') throw new Error(event.message);
        if (event.type === 'result') {
          complete = true;
          setMessages((current) => [...current, { role: 'assistant', content: event.response }]);
          if (!event.actionsHandled && event.actions.length) onActions(event.actions);
        }
      }
      if (!complete && !controller.signal.aborted) throw new Error('The connection ended before the task completed. Applied changes remain visible in your profile.');
    } catch (requestError: any) {
      if (!controller.signal.aborted) setError(requestError?.message || 'I could not connect right now. Please try again.');
    } finally {
      if (controllerRef.current === controller) { setBusy(false); controllerRef.current = undefined; }
    }
  };

  const suggestions = [
    'Improve my artist biography and save it',
    'Set up my profile for a new music release',
    'Which tools can help me grow my audience?',
  ];
  const stop = () => {
    controllerRef.current?.abort();
    setBusy(false);
    setError('Task stopped. Completed changes remain in your profile.');
  };
  const openSpiderNode = async (node: SpiderNode) => {
    if (busy) return;
    const command: CopilotUiCommand = node.surface === 'profile'
      ? { type: 'inspect_interface', moduleId: 'profile' }
      : { type: 'open_module', moduleId: node.id, surface: node.surface };
    const result = await uiHandlerRef.current(command);
    if (!result.success) { setError(result.error || 'This module could not be opened.'); markNodes([node], 'error'); return; }
    onSpiderModeChange(false);
    setCompact(true);
  };

  return createPortal((
    <AnimatePresence>
      {open && !spiderMode && compact && (
        <motion.aside data-profile-copilot-chat initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-20 left-4 z-[10040] w-[min(310px,calc(100vw-32px))] rounded-2xl border border-violet-300/25 bg-[#101014] p-4 text-white shadow-2xl" style={{ pointerEvents: 'auto' }} aria-live="polite">
          <div className="flex items-center gap-2 text-sm font-semibold">{busy ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} /> : <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />} Artist Copilot <button type="button" onClick={() => setCompact(false)} className="ml-auto rounded-lg p-1.5 hover:bg-white/10" aria-label="Expand Copilot"><ArrowUpRight className="h-4 w-4" /></button></div>
          <p className="mt-2 text-xs leading-5 text-white/65">{error || activity.at(-1) || (busy ? 'Working on your profile...' : messages.length > 1 ? 'Your reply is ready.' : 'Ready to help with your profile.')}</p>
          <button type="button" onClick={() => setCompact(false)} className="mt-3 text-xs font-medium" style={{ color: accent }}>{busy ? 'View live activity' : 'View reply'}</button>
          {busy && <button type="button" onClick={stop} className="ml-4 text-xs text-white/50 hover:text-white">Stop task</button>}
        </motion.aside>
      )}
      {open && !spiderMode && !compact && (
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          aria-label="Artist Profile Copilot"
          data-profile-copilot-chat
          className="fixed bottom-20 left-4 z-[10040] flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101014] text-white shadow-[0_24px_90px_rgba(0,0,0,.65)]"
          style={{ height: 'min(620px, calc(100dvh - 120px))', pointerEvents: 'auto' }}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: accent, background: `${accent}20` }}><Sparkles className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Artist Profile Copilot</p>
              <p className="truncate text-[11px] text-white/45">Tools, layout and creative direction · {artistName}</p>
            </div>
            <button type="button" disabled={busy} onClick={() => { setMessages(readHistory('', artistName)); setActivity([]); setError(''); }} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 disabled:opacity-30" aria-label="Start a new conversation"><RotateCcw className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => onSpiderModeChange(true)} className="rounded-lg border border-orange-300/20 px-2 py-1.5 text-[10px] font-semibold text-orange-200 hover:bg-orange-300/10" aria-label="Open Spider Mode">Spider</button>
            <button type="button" onClick={() => setCompact(true)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" aria-label="Minimize Copilot"><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white" aria-label="Close Artist Profile Copilot"><X className="h-4 w-4" /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4" aria-live="polite">
            {messages.map((item, index) => {
              const isUser = item.role === 'user';
              return (
                <div key={`${index}-${item.role}`} className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: isUser ? '#fff' : accent, background: isUser ? 'rgba(255,255,255,.1)' : `${accent}20` }}>{isUser ? <UserRound className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}</span>
                  <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-tr-md text-white' : 'rounded-tl-md border border-white/[0.07] bg-white/[0.045] text-white/80'}`} style={isUser ? { background: `${accent}28`, border: `1px solid ${accent}38` } : undefined}>{item.content}</p>
                </div>
              );
            })}
            {busy && <div className="flex items-center gap-2 pl-9 text-xs text-white/45"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reviewing your artist profile and tools…</div>}
            {error && <p role="alert" className="ml-9 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-3 py-2 text-xs text-red-200">{error}</p>}
            {activity.length > 0 && <div className="ml-9 space-y-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.04] p-3" aria-label="Copilot activity">{activity.map((step, index) => <p key={`${index}-${step}`} className="flex items-start gap-2 text-[11px] leading-4 text-white/60">{busy && index === activity.length - 1 ? <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" /> : <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-300" />}{step}</p>)}</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-3 pb-3 sm:px-4">
              {suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={busy} onClick={() => void send(suggestion)} className="rounded-full border border-white/10 px-3 py-1.5 text-left text-[10px] text-white/55 transition hover:border-white/25 hover:text-white disabled:opacity-45">{suggestion}</button>)}
            </div>
          )}

          <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="shrink-0 border-t border-white/10 p-3">
            {busy && <button type="button" onClick={stop} className="mb-2 text-xs text-white/50 hover:text-white">Stop task</button>}
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/35 p-2 focus-within:border-white/25">
              <MessageSquare className="mb-2 ml-1 h-4 w-4 shrink-0 text-white/30" />
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask to open or configure a profile tool…" maxLength={5000} rows={2} disabled={busy} className="max-h-28 min-h-[42px] flex-1 resize-y bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-50" />
              <button type="submit" disabled={!draft.trim() || busy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: accent }} aria-label="Send message"><Send className="h-4 w-4" /></button>
            </div>
            <p className="px-1 pt-2 text-[10px] leading-4 text-white/30">Edits profile text and prepares real module fields. Review generation, credit and publishing actions in their tool.</p>
          </form>
        </motion.section>
      )}
      {open && spiderMode && <Suspense fallback={<div className="fixed inset-0 z-[10060] grid place-items-center bg-black/90 text-sm text-white/70">Opening Spider Mode…</div>}><SpiderMode artistName={artistName} nodes={spiderNodes} edges={spiderEdges} goal={goal} messages={messages} activity={activity} busy={busy} error={error} draft={draft} setDraft={setDraft} onSend={() => void send()} onStop={stop} onClose={() => { onSpiderModeChange(false); setCompact(true); }} onOpenNode={(node) => void openSpiderNode(node)} /></Suspense>}
    </AnimatePresence>
  ), document.body);
}

export default ArtistProfileAgentChat;
