import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Loader2, MessageSquare, Send, Sparkles, Trash2, UserRound } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function initialMessages(artistName: string, storageKey: string): ChatMessage[] {
  if (typeof window !== 'undefined') {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (Array.isArray(stored)) {
        return stored.filter((item) =>
          item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
        ).slice(-40);
      }
    } catch {
      // Ignore invalid or outdated browser storage.
    }
  }
  return [{
    role: 'assistant',
    content: `Hi, I’m Hermes, your artist manager for ${artistName}. I can help with your music, brand, visuals, releases, and career priorities. What are you working on today?`,
  }];
}

export function HermesChat({
  artistId,
  artistName,
  accent,
  isOwner,
}: {
  artistId: number;
  artistName: string;
  accent: string;
  isOwner: boolean;
}) {
  const { toast } = useToast();
  const storageKey = `hermes-chat-${artistId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(artistName, storageKey));
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // Chat remains usable when browser storage is unavailable.
    }
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async ({ message, history }: { message: string; history: ChatMessage[] }) =>
      apiRequest({
        url: `/api/artist-hermes/${artistId}/chat`,
        method: 'POST',
        body: { message, conversationHistory: history.slice(-20) },
      }),
    onSuccess: (data: any) => {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: data?.response || 'I could not prepare a response. Please try again.',
      }]);
    },
    onError: () => {
      toast({ title: 'Hermes could not reply', description: 'Please try again in a moment.', variant: 'destructive' });
    },
  });

  const sendMessage = (text = draft) => {
    const message = text.trim();
    if (!message || chatMutation.isPending || !isOwner) return;
    const history = messages.slice(-20);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    chatMutation.mutate({ message, history });
  };

  const clearChat = () => {
    const greeting = initialMessages(artistName, '__hermes_empty__');
    setMessages(greeting);
  };

  const suggestions = [
    `Build a 7-day plan around my latest release`,
    `What makes my artist identity distinctive?`,
    `Give me a fresh visual concept for my next video`,
  ];

  return (
    <section className="p-4 md:p-5" aria-label="Chat with Hermes">
      <div className="mx-auto flex max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/25" style={{ minHeight: 480 }}>
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color: accent, background: `${accent}1d` }}>
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Hermes Artist Manager</p>
              <p className="mt-0.5 text-[11px] text-white/45">OpenAI Agents SDK · GPT‑6 Astra · private to {artistName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55 transition hover:border-white/20 hover:text-white"
            title="Clear this device’s chat history"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        </header>

        {!isOwner ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-white/50">
            Only the artist can chat with their private Hermes manager.
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: 440 }}>
              {messages.map((message, index) => {
                const isUser = message.role === 'user';
                return (
                  <div key={`${index}-${message.role}`} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ color: isUser ? '#d4d4d8' : accent, background: isUser ? 'rgba(255,255,255,0.09)' : `${accent}1d` }}>
                      {isUser ? <UserRound className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </div>
                    <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-tr-md text-white' : 'rounded-tl-md bg-white/[0.055] text-white/80'}`} style={isUser ? { background: `${accent}25`, border: `1px solid ${accent}35` } : { border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                );
              })}
              {chatMutation.isPending && (
                <div className="flex items-center gap-2.5 text-xs text-white/45">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: accent, background: `${accent}1d` }}><Bot className="h-3.5 w-3.5" /></div>
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Hermes is thinking through your artist context…</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {suggestions.map((suggestion) => (
                  <button key={suggestion} type="button" disabled={chatMutation.isPending} onClick={() => sendMessage(suggestion)} className="rounded-full border border-white/10 px-3 py-1.5 text-left text-[11px] text-white/55 transition hover:border-white/20 hover:text-white disabled:opacity-50">
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/30 p-2 focus-within:border-white/20">
                <MessageSquare className="mb-2 ml-1 h-4 w-4 shrink-0 text-white/30" />
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }}
                  placeholder={`Ask Hermes about ${artistName}…`}
                  maxLength={5000}
                  rows={2}
                  className="max-h-32 min-h-[42px] flex-1 resize-y bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/25"
                  disabled={chatMutation.isPending}
                />
                <button type="submit" disabled={!draft.trim() || chatMutation.isPending} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-black transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40" style={{ background: accent }} aria-label="Send message">
                  {chatMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="px-1 pt-2 text-[10px] text-white/30">Hermes can draft and advise. It won’t publish or contact anyone without your approval. Chat history is saved on this device.</p>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
