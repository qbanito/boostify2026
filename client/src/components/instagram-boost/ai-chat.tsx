/**
 * Instagram AI Chat Assistant (BoostBot)
 * 
 * Floating chat bubble that connects to the OpenClaw-powered Instagram Growth Agent.
 * Appears on the Instagram Boost page to help users improve their accounts.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Target,
  Hash,
  Play,
  TrendingUp,
  Clock,
  AlertCircle,
  User,
  Trash2,
  Minimize2,
  Maximize2,
  Bot,
  Zap,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  gatewayUsed?: boolean;
}

interface Suggestion {
  id: string;
  icon: string;
  label: string;
  prompt: string;
}

const iconMap: Record<string, any> = {
  target: Target,
  pen: Sparkles,
  hash: Hash,
  play: Play,
  'trending-up': TrendingUp,
  clock: Clock,
  alert: AlertCircle,
  user: User,
};

function MarkdownLite({ content }: { content: string }) {
  // Simple markdown renderer for chat messages
  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('## ')) {
          return <h3 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(3)}</h3>;
        }
        if (line.startsWith('### ')) {
          return <h4 key={i} className="font-semibold text-sm mt-2 mb-1">{line.slice(4)}</h4>;
        }
        // Bold
        const boldParts = line.split(/\*\*(.*?)\*\*/g);
        if (boldParts.length > 1) {
          return (
            <p key={i}>
              {boldParts.map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
              )}
            </p>
          );
        }
        // List items
        if (line.match(/^[-•*]\s/)) {
          return <p key={i} className="pl-3">• {line.replace(/^[-•*]\s/, '')}</p>;
        }
        if (line.match(/^\d+\.\s/)) {
          return <p key={i} className="pl-3">{line}</p>;
        }
        // Empty line
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Regular text
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export function InstagramAiChat({
  artistId,
  tabContext,
}: {
  artistId?: number | string;
  tabContext?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['/api/instagram/ai-agent/suggestions'],
    enabled: isOpen && messages.length === 0,
  });

  const suggestions: Suggestion[] = (suggestionsData as any)?.suggestions || [];

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch('/api/instagram/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          artistId,
          tabContext,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get response');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        gatewayUsed: data.gatewayUsed,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: (error: any) => {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Clear history mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/instagram/ai-agent/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artistId }),
      });
      return response.json();
    },
    onSuccess: () => {
      setMessages([]);
      toast({ title: 'Conversation cleared' });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    (text?: string) => {
      const msg = text || message.trim();
      if (!msg || chatMutation.isPending) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: msg,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setMessage('');
      chatMutation.mutate(msg);
    },
    [message, chatMutation],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const chatWidth = isExpanded ? 'w-[calc(100vw-1.5rem)] sm:w-[500px]' : 'w-[calc(100vw-1.5rem)] sm:w-[380px]';
  const chatHeight = isExpanded ? 'h-[calc(100vh-6rem)] sm:h-[600px]' : 'h-[calc(100dvh-6rem)] sm:h-[480px]';

  return (
    <>
      {/* Floating Chat Bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-14 w-14 rounded-full bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 shadow-lg shadow-[#fd1d1d]/25 transition-all hover:scale-110"
            >
              <Bot className="h-6 w-6 text-white" />
            </Button>
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#833ab4] to-[#fcb045] animate-ping opacity-20 pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-3 right-3 sm:bottom-6 sm:right-6 z-50 ${chatWidth} ${chatHeight} flex flex-col`}
          >
            <Card className="flex flex-col h-full overflow-hidden border-2 border-[#833ab4]/30 shadow-2xl shadow-[#833ab4]/10 bg-background/95 backdrop-blur-xl rounded-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">BoostBot</h3>
                    <p className="text-[10px] opacity-80 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" />
                      Instagram Growth Assistant
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                      onClick={() => clearMutation.mutate()}
                      title="Clear conversation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? 'Minimize' : 'Expand'}
                  >
                    {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Welcome message */}
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                        <p className="text-sm">
                          Hey! I'm <strong>BoostBot</strong>, your Instagram growth expert. 
                          I can help you with profile audits, content strategy, hashtags, Reels, and more. 
                          What do you need help with?
                        </p>
                      </div>
                    </div>

                    {/* Quick suggestions */}
                    {suggestions.length > 0 && (
                      <div className="pl-9 flex flex-wrap gap-1.5">
                        {suggestions.slice(0, 6).map((s) => {
                          const Icon = iconMap[s.icon] || Sparkles;
                          return (
                            <button
                              key={s.id}
                              onClick={() => sendMessage(s.prompt)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-full bg-[#833ab4]/10 hover:bg-[#833ab4]/20 border border-[#833ab4]/20 hover:border-[#833ab4]/40 transition-all text-foreground"
                            >
                              <Icon className="h-3 w-3 text-[#833ab4]" />
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Chat messages */}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-3 py-2 max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white rounded-tr-sm'
                          : 'bg-muted/50 rounded-tl-sm'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <MarkdownLite content={msg.content} />
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {chatMutation.isPending && (
                  <div className="flex gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-[#833ab4] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-[#fd1d1d] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-[#fcb045] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-3 py-2 border-t border-border bg-background/80">
                <div className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about growing your Instagram..."
                    className="flex-1 rounded-xl border-[#833ab4]/20 focus-visible:ring-[#833ab4]/30 text-sm"
                    disabled={chatMutation.isPending}
                    maxLength={2000}
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!message.trim() || chatMutation.isPending}
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] hover:opacity-90 text-white shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Powered by OpenClaw + Boostify AI
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
