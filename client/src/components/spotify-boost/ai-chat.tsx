import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SiSpotify } from "react-icons/si";
import { X, Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "How do I get on editorial playlists?",
  "Best release strategy for a single?",
  "How to grow monthly listeners?",
  "Optimize my Spotify for Artists profile",
];

export function SpotifyAiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await fetch("/api/spotify/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: msg, history: messages.slice(-10) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response || data.message || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 text-white shadow-lg shadow-green-900/40 flex items-center justify-center hover:scale-105 transition">
            <SiSpotify className="w-7 h-7" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] h-[500px] rounded-2xl border border-green-500/30 bg-background/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <div>
                  <p className="text-sm font-semibold">SpotifyBot</p>
                  <p className="text-[10px] text-green-100">AI growth assistant</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded-lg p-1 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <Sparkles className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">Hey! I'm SpotifyBot</p>
                  <p className="text-xs text-muted-foreground mb-4">Ask me anything about growing on Spotify</p>
                  <div className="space-y-2">
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)}
                        className="w-full text-left text-xs p-2.5 rounded-lg border hover:bg-green-500/10 hover:border-green-500/40 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-green-400" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    m.role === "user" ? "bg-green-600 text-white" : "bg-muted"
                  }`}>
                    {m.content}
                  </div>
                  {m.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-3 h-3 text-green-400 animate-spin" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2 text-xs text-muted-foreground">Thinking...</div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t flex gap-2">
              <Input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="Ask about Spotify growth..."
                className="text-xs h-9" />
              <Button size="sm" onClick={() => send()} disabled={!input.trim() || loading}
                className="h-9 w-9 p-0 bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
