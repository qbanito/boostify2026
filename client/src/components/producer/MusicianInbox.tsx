/**
 * MusicianInbox
 * ─────────────────────────────────────────────────────────────
 * Two-pane messaging UI for Producer Tools: conversation list on the
 * left, active thread on the right. Supports:
 *   • Listing conversations with unread badges
 *   • Reading + sending text messages
 *   • Composing a service contract (title, summary, price)
 *   • Accept / reject contract actions inline
 *
 * Uses endpoints under /api/musician-messaging/*
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { useToast } from '../../hooks/use-toast';
import { Loader2, Send, FileSignature, Check, X, MessageSquare, Inbox, Clock, CheckCircle2 } from 'lucide-react';

interface Conversation {
  id: number;
  clientUserId: number;
  musicianId: number;
  musicianUserId: number | null;
  bookingId: number | null;
  subject: string | null;
  status: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  clientUnreadCount: number;
  musicianUnreadCount: number;
  musicianName: string | null;
  musicianPhoto: string | null;
  musicianInstrument: string | null;
}

interface Message {
  id: number;
  conversationId: number;
  senderRole: 'client' | 'musician' | 'system';
  senderUserId: number | null;
  type: 'text' | 'contract' | 'service_quote' | 'audio' | 'file' | 'system_event';
  body: string;
  attachments: any;
  metadata: any;
  createdAt: string;
}

interface Contract {
  id: number;
  conversationId: number;
  title: string;
  summary: string | null;
  terms: any;
  priceAmount: string;
  priceCurrency: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'completed';
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
}

interface ThreadPayload {
  success: boolean;
  conversation: Conversation;
  role: 'client' | 'musician';
  messages: Message[];
  contracts: Contract[];
}

function fmtRelative(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

export function MusicianInbox() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [contractOpen, setContractOpen] = useState(false);

  const convList = useQuery<{ success: boolean; data: Conversation[] }>({
    queryKey: ['/api/musician-messaging/conversations'],
    queryFn: async () => {
      const r = await fetch('/api/musician-messaging/conversations', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load conversations');
      return r.json();
    },
    refetchInterval: 20_000,
  });

  const thread = useQuery<ThreadPayload>({
    queryKey: ['/api/musician-messaging/conversations', activeId, 'messages'],
    enabled: activeId != null,
    queryFn: async () => {
      const r = await fetch(`/api/musician-messaging/conversations/${activeId}/messages`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load thread');
      return r.json();
    },
    refetchInterval: 8_000,
  });

  const sendMsg = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`/api/musician-messaging/conversations/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body, type: 'text' }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed to send');
      return r.json();
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['/api/musician-messaging/conversations', activeId, 'messages'] });
      qc.invalidateQueries({ queryKey: ['/api/musician-messaging/conversations'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const contractAction = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'accept' | 'reject' | 'complete' }) => {
      const r = await fetch(`/api/musician-messaging/contracts/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Action failed');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/musician-messaging/conversations', activeId, 'messages'] });
      toast({ title: 'Contract updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const conversations = convList.data?.data || [];
  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);

  // Auto-select first conversation
  useEffect(() => {
    if (activeId == null && conversations.length > 0) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  const role = thread.data?.role;
  const contractsById = useMemo(() => {
    const map = new Map<number, Contract>();
    (thread.data?.contracts || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [thread.data?.contracts]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-18rem)] min-h-[500px]">
      {/* Left: conversation list */}
      <Card className="bg-slate-900/60 border-orange-500/10 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-sm">Inbox</span>
          <Badge className="ml-auto bg-orange-500/20 text-orange-400 border-orange-500/40">
            {conversations.length}
          </Badge>
        </div>
        <ScrollArea className="flex-1">
          {convList.isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading…
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No conversations yet.</p>
              <p className="text-xs mt-1">Start one from a musician's profile.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                const unread =
                  (c.clientUnreadCount || 0) + (c.musicianUnreadCount || 0);
                return (
                  <li
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isActive ? 'bg-orange-500/10' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex gap-2 items-start">
                      <div className="h-9 w-9 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                        {c.musicianPhoto ? (
                          <img src={c.musicianPhoto} alt={c.musicianName || ''} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                            {c.musicianName?.[0] || '?'}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {c.musicianName || `Musician #${c.musicianId}`}
                          </span>
                          {unread > 0 && (
                            <Badge className="ml-auto bg-orange-500 text-white text-[10px] px-1.5 h-4">
                              {unread}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.lastMessagePreview || c.subject || c.musicianInstrument}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {fmtRelative(c.lastMessageAt)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </Card>

      {/* Right: thread */}
      <Card className="bg-slate-900/60 border-orange-500/10 overflow-hidden flex flex-col">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-full bg-slate-800 overflow-hidden flex-shrink-0">
                  {activeConv.musicianPhoto ? (
                    <img src={activeConv.musicianPhoto} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {activeConv.musicianName || `Musician #${activeConv.musicianId}`}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {activeConv.subject || activeConv.musicianInstrument || 'Conversation'}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setContractOpen(true)}
                className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
              >
                <FileSignature className="h-4 w-4 mr-1.5" /> Contract
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              {thread.isLoading ? (
                <div className="text-center text-sm text-muted-foreground p-6">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" /> Loading…
                </div>
              ) : (
                <ul className="space-y-3">
                  {(thread.data?.messages || []).map((m) => {
                    const mine = role === m.senderRole;
                    const isSystem = m.senderRole === 'system' || m.type === 'system_event';
                    const contractId = m.metadata?.contractId as number | undefined;
                    const contract = contractId ? contractsById.get(contractId) : undefined;

                    if (isSystem) {
                      return (
                        <li key={m.id} className="text-center">
                          <span className="text-xs text-muted-foreground bg-slate-800/60 px-2 py-1 rounded-full">
                            {m.body}
                          </span>
                        </li>
                      );
                    }

                    return (
                      <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? 'bg-orange-500 text-white rounded-br-sm'
                              : 'bg-slate-800 text-foreground rounded-bl-sm'
                          }`}
                        >
                          {m.type === 'contract' && contract ? (
                            <div className="space-y-2 min-w-[240px]">
                              <div className="flex items-center gap-2 font-semibold">
                                <FileSignature className="h-4 w-4" />
                                {contract.title}
                              </div>
                              {contract.summary && (
                                <p className={`text-xs ${mine ? 'text-white/80' : 'text-muted-foreground'}`}>
                                  {contract.summary}
                                </p>
                              )}
                              <div className="text-lg font-bold">
                                ${contract.priceAmount}{' '}
                                <span className="text-xs font-normal uppercase opacity-70">
                                  {contract.priceCurrency}
                                </span>
                              </div>
                              <Badge className={`text-[10px] ${
                                contract.status === 'accepted' ? 'bg-emerald-500/90' :
                                contract.status === 'rejected' ? 'bg-red-500/90' :
                                contract.status === 'completed' ? 'bg-blue-500/90' :
                                'bg-amber-500/90'
                              } text-white border-transparent`}>
                                {contract.status.toUpperCase()}
                              </Badge>
                              {/* Only the opposite side (not sender) can accept/reject */}
                              {contract.status === 'sent' && !mine && (
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white h-7 text-xs"
                                    onClick={() => contractAction.mutate({ id: contract.id, action: 'accept' })}
                                    disabled={contractAction.isPending}
                                  >
                                    <Check className="h-3 w-3 mr-1" /> Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => contractAction.mutate({ id: contract.id, action: 'reject' })}
                                    disabled={contractAction.isPending}
                                  >
                                    <X className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                </div>
                              )}
                              {contract.status === 'accepted' && (
                                <Button
                                  size="sm"
                                  className="bg-blue-500 hover:bg-blue-600 text-white h-7 text-xs w-full"
                                  onClick={() => contractAction.mutate({ id: contract.id, action: 'complete' })}
                                  disabled={contractAction.isPending}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Mark completed
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          )}
                          <div className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-muted-foreground'}`}>
                            {fmtRelative(m.createdAt)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>

            {/* Composer */}
            <div className="border-t border-slate-800 p-3 flex gap-2 items-end">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                rows={2}
                className="flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim()) sendMsg.mutate(draft.trim());
                  }
                }}
              />
              <Button
                onClick={() => draft.trim() && sendMsg.mutate(draft.trim())}
                disabled={!draft.trim() || sendMsg.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        )}
      </Card>

      {activeId && (
        <ContractComposerDialog
          open={contractOpen}
          onOpenChange={setContractOpen}
          conversationId={activeId}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['/api/musician-messaging/conversations', activeId, 'messages'] });
            qc.invalidateQueries({ queryKey: ['/api/musician-messaging/conversations'] });
          }}
        />
      )}
    </div>
  );
}

// ── Contract composer ─────────────────────────────────────────────
function ContractComposerDialog({
  open,
  onOpenChange,
  conversationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: number;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [price, setPrice] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [deadline, setDeadline] = useState('');
  const [revisions, setRevisions] = useState('');
  const [isSending, setIsSending] = useState(false);

  const submit = async () => {
    if (!title.trim() || !price.trim()) {
      toast({ title: 'Missing fields', description: 'Title and price are required', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch(`/api/musician-messaging/conversations/${conversationId}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          summary: summary || undefined,
          priceAmount: Number(price),
          terms: {
            deliverables: deliverables ? deliverables.split('\n').map((s) => s.trim()).filter(Boolean) : undefined,
            deadline: deadline || undefined,
            revisions: revisions || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send');
      toast({ title: 'Contract sent' });
      setTitle(''); setSummary(''); setPrice(''); setDeliverables(''); setDeadline(''); setRevisions('');
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-orange-500" /> New Service Contract
          </DialogTitle>
          <DialogDescription>
            Send an itemized proposal. The recipient can accept or reject it inline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mixing & mastering — 1 track" />
          </div>
          <div className="space-y-1">
            <Label>Summary</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Scope of work, expectations…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Price (USD) *</Label>
              <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250" />
            </div>
            <div className="space-y-1">
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Deliverables (one per line)</Label>
            <Textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={3}
              placeholder="Stereo master WAV 24-bit&#10;Streaming master&#10;Stems" />
          </div>
          <div className="space-y-1">
            <Label>Revisions policy</Label>
            <Input value={revisions} onChange={(e) => setRevisions(e.target.value)} placeholder="Up to 3 revisions included" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={isSending} className="bg-orange-500 hover:bg-orange-600">
            {isSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</> : <><FileSignature className="h-4 w-4 mr-2" /> Send contract</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MusicianInbox;
