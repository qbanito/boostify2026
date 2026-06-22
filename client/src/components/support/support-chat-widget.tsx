import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, ChevronDown, Mic, MicOff, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { useCommandContext, looksLikeCommand } from '@/lib/command-context';

interface CommandAsset {
  label: string;
  url: string;
  kind: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  assets?: CommandAsset[];
  pending?: boolean;
}

export function SupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceSourceRef = useRef<'text' | 'voice'>('text');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Present (owner-only) when the visitor is on their own artist profile. When
  // set, module-creation commands run through the Artist Command Engine.
  const cmdContext = useCommandContext();

  // Hide the widget whenever a fullscreen video player (or similar) is open.
  useEffect(() => {
    const check = () => setHidden(document.body.dataset.videoPlayerOpen === 'true');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-video-player-open'] });
    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Detect Web Speech API support + clean up recognition / polling on unmount.
  useEffect(() => {
    const w = window as any;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: cmdContext
          ? `🎤 ¡Hola! Soy tu asistente de Boostify. Háblame o escríbeme: puedo crear con tus módulos (“crea una canción”, “diseña una portada”, “harme un video”) o responder tus dudas de la plataforma.`
          : '👋 Hi! I\'m the Boostify Assistant. How can I help you today? Ask me anything about the platform!',
      }]);
    }
  }, [isOpen, messages.length, cmdContext]);

  const finishPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll an in-flight Artist Command run and reflect progress / results in chat.
  const pollCommand = useCallback(async (commandId: string, runId: string) => {
    try {
      const res = await apiRequest({ url: `/api/artist-command/${commandId}`, method: 'GET' });
      const command = res?.command;
      const tasks: any[] = res?.tasks || [];
      if (!command) return;

      const isTerminal = command.status === 'completed' || command.status === 'failed';
      const progress = typeof command.progress === 'number' ? command.progress : 0;

      if (!isTerminal) {
        const running = tasks.find(t => t.status === 'running');
        const label = running?.label ? `Creando: ${running.label}…` : 'Trabajando en tu pedido…';
        setMessages(prev => prev.map(m => m.id === runId
          ? { ...m, pending: true, content: `⚙️ ${label} (${progress}%)` }
          : m));
        return;
      }

      // Terminal state — stop polling and present the result.
      finishPoll();
      setIsLoading(false);
      voiceSourceRef.current = 'text';

      if (command.status === 'failed') {
        setMessages(prev => prev.map(m => m.id === runId
          ? { ...m, pending: false, content: '⚠️ No pude completar la creación. Revisa el panel del Artist Command Engine en tu perfil.' }
          : m));
        return;
      }

      const assets: CommandAsset[] = [];
      let done = 0;
      for (const t of tasks) {
        if (t.status === 'completed') done++;
        const out = t.output;
        if (!out) continue;
        if (out.videoUrl) assets.push({ label: out.title || t.label || 'Video', url: out.videoUrl, kind: 'video' });
        else if (out.audioUrl) assets.push({ label: out.title || t.label || 'Audio', url: out.audioUrl, kind: 'audio' });
        else if (out.imageUrl) assets.push({ label: out.title || t.label || 'Imagen', url: out.imageUrl, kind: 'image' });
      }
      const summary = assets.length
        ? `✅ ¡Listo! Generé ${done} elemento(s). Toca para abrir:`
        : '✅ ¡Listo! Tus módulos terminaron. Mira los resultados en el panel del Artist Command Engine de tu perfil.';
      setMessages(prev => prev.map(m => m.id === runId
        ? { ...m, pending: false, content: summary, assets }
        : m));
    } catch {
      // transient polling error — keep the interval going.
    }
  }, [finishPoll]);

  // Kick off a module-creation command through the Artist Command Engine.
  const runCommand = useCallback(async (text: string) => {
    const ctx = cmdContext;
    if (!ctx) return;
    const runId = `cmd-${Date.now()}`;
    const source = voiceSourceRef.current;
    setMessages(prev => [...prev, {
      id: runId, role: 'assistant', pending: true,
      content: '⚙️ Entendido. Poniendo a trabajar tus módulos…',
    }]);
    setIsLoading(true);
    try {
      const res = await apiRequest('/api/artist-command', {
        method: 'POST',
        data: {
          command: text,
          source,
          artistId: ctx.artistId,
          artistName: ctx.artistName,
          artistImageUrl: ctx.artistImageUrl,
          genre: ctx.genre,
        },
      });
      const commandId = res?.commandId;
      if (!commandId) throw new Error('no command id');
      finishPoll();
      pollRef.current = setInterval(() => pollCommand(commandId, runId), 2500);
      pollCommand(commandId, runId);
    } catch (e: any) {
      finishPoll();
      const msg = /401|unauthor|no autoriz/i.test(e?.message || '')
        ? 'Para crear con tus módulos necesitas iniciar sesión como dueño de este perfil.'
        : 'No pude iniciar la creación. Inténtalo de nuevo en un momento.';
      setMessages(prev => prev.map(m => m.id === runId ? { ...m, pending: false, content: `⚠️ ${msg}` } : m));
      setIsLoading(false);
      voiceSourceRef.current = 'text';
    }
  }, [cmdContext, finishPoll, pollCommand]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Owner on their own profile + a creation phrasing → execute modules.
    if (cmdContext && looksLikeCommand(text)) {
      await runCommand(text);
      return;
    }

    setIsLoading(true);
    try {
      // Build history (exclude the welcome + any in-flight command bubbles).
      const history = messages
        .filter(m => m.id !== 'welcome' && !m.pending)
        .map(m => ({ role: m.role, content: m.content }));

      const result = await apiRequest('/api/support-chat/message', {
        method: 'POST',
        data: { message: text, history },
      });

      if (result.success && result.reply) {
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
        }]);
      } else {
        throw new Error(result.error || 'No response');
      }
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Lo siento, tengo problemas para conectar ahora mismo. Inténtalo de nuevo en un momento.',
      }]);
    } finally {
      setIsLoading(false);
    }
    voiceSourceRef.current = 'text';
  }, [input, isLoading, messages, cmdContext, runCommand]);

  const toggleVoice = useCallback(() => {
    if (listening) {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
      setListening(false);
      return;
    }
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'es-ES';
    recognitionRef.current = rec;
    voiceSourceRef.current = 'voice';
    rec.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [listening]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {hidden ? null : (
      <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => { setIsOpen(true); setHasNewMessage(false); }}
            className="fixed bottom-20 left-4 z-[60] w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 flex items-center justify-center hover:shadow-orange-500/40 hover:scale-105 transition-all"
            aria-label="Open support chat"
          >
            {cmdContext ? <Sparkles className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
            {hasNewMessage && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-background" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-20 left-4 z-[60] w-[340px] sm:w-[380px] max-h-[min(500px,70vh)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl shadow-black/30 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{cmdContext ? 'Boostify Assistant' : 'Boostify Support'}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    {cmdContext ? 'Voz + Módulos · IA' : 'Online — AI Powered'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Minimize chat"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setIsOpen(false); setMessages([]); finishPoll(); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      <span className="inline-flex items-start gap-1.5">
                        {msg.pending && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />}
                        <span>{msg.content}</span>
                      </span>
                    </div>
                    {msg.assets && msg.assets.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.assets.map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-colors"
                          >
                            {a.kind === 'video' ? '🎬' : a.kind === 'audio' ? '🎵' : '🖼️'} {a.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-border bg-card/50 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={cmdContext ? 'Pide “crea una canción…” o pregunta lo que sea' : 'Ask anything about Boostify...'}
                  rows={1}
                  maxLength={2000}
                  className="flex-1 resize-none bg-muted rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 max-h-20 overflow-y-auto"
                  style={{ minHeight: '36px' }}
                />
                {voiceSupported && (
                  <button
                    onClick={toggleVoice}
                    className={`p-2 rounded-xl flex-shrink-0 transition-all ${
                      listening
                        ? 'bg-orange-500/20 text-orange-500 ring-1 ring-orange-500/40'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    aria-label={listening ? 'Detener dictado' : 'Hablar'}
                    title={listening ? 'Detener dictado' : 'Hablar'}
                  >
                    {listening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-orange-500/20 transition-all flex-shrink-0"
                  aria-label="Send message"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground/60 text-center mt-1.5">
                {cmdContext ? 'Boostify AI · voz y creación con tus módulos' : 'Powered by Boostify AI · Responses may not be 100% accurate'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </>
  );
}
