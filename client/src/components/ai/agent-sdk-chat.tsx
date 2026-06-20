/**
 * AgentSDKChat - Conversational chat powered by OpenAI Agents SDK
 * Features: SSE streaming with multi-phase loading, typewriter effect,
 * markdown rendering, code blocks with copy, auto-resize textarea,
 * relative timestamps, feedback buttons, and agent routing indicators.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Loader2,
  Music2,
  BarChart2,
  Users,
  ShoppingBag,
  Briefcase,
  Video,
  HelpCircle,
  Sparkles,
  Wrench,
  ChevronDown,
  RotateCcw,
  Copy,
  Check,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Search,
  Zap,
  Brain,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { useArtistContext } from "../../hooks/use-artist-context";

// ─── Types ─────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  agentUsed?: string;
  classification?: string;
  toolCalls?: Array<{ name: string; input: unknown }>;
  timestamp: Date;
  feedback?: "up" | "down";
}

type StreamPhase =
  | "connecting"
  | "classifying"
  | "routing"
  | "thinking"
  | "tool_call"
  | null;

type AgentOverride =
  | "music_production"
  | "marketing_strategy"
  | "social_media"
  | "merch_design"
  | "career_advice"
  | "video_creation"
  | "general_question"
  | undefined;

// ─── Constants ─────────────────────────────────────────────────
const agentIcons: Record<string, typeof Bot> = {
  music_production: Music2,
  marketing_strategy: BarChart2,
  social_media: Users,
  merch_design: ShoppingBag,
  career_advice: Briefcase,
  video_creation: Video,
  general_question: HelpCircle,
};

const agentLabels: Record<string, string> = {
  music_production: "Music Producer",
  marketing_strategy: "Marketing Strategist",
  social_media: "Social Media",
  merch_design: "Merch Designer",
  career_advice: "Career Manager",
  video_creation: "Video Director",
  general_question: "Assistant",
};

const agentColors: Record<string, string> = {
  music_production: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  marketing_strategy: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  social_media: "bg-green-500/20 text-green-400 border-green-500/30",
  merch_design: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  career_advice: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  video_creation: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  general_question: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const phaseConfig: Record<string, { icon: typeof Bot; label: string; color: string }> = {
  connecting: { icon: Zap, label: "Connecting...", color: "text-yellow-400" },
  classifying: { icon: Search, label: "Analyzing your question...", color: "text-blue-400" },
  routing: { icon: Sparkles, label: "Routing to specialist...", color: "text-purple-400" },
  thinking: { icon: Brain, label: "Generating response...", color: "text-orange-400" },
  tool_call: { icon: Wrench, label: "Querying your data...", color: "text-cyan-400" },
};

const suggestions = [
  { text: "Write lyrics for a trap song about success", agent: "music_production" },
  { text: "Create a launch plan for my next single", agent: "marketing_strategy" },
  { text: "TikTok content ideas for this week", agent: "social_media" },
  { text: "Design merch ideas for my brand", agent: "merch_design" },
  { text: "Help me plan my career goals for 2026", agent: "career_advice" },
  { text: "Concept for a cinematic music video", agent: "video_creation" },
];

// ─── Helpers ───────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

/** Render markdown with code blocks, headers, lists, bold, italic, inline code */
function renderMarkdown(text: string) {
  const elements: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks ```
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = codeLines.join("\n");
      elements.push(<CodeBlock key={`cb-${elements.length}`} code={code} language={lang} />);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(<h4 key={i} className="font-semibold text-white mt-3 mb-1 text-sm">{formatInline(line.slice(4))}</h4>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h3 key={i} className="font-bold text-white mt-3 mb-1">{formatInline(line.slice(3))}</h3>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h2 key={i} className="font-bold text-white mt-3 mb-1 text-base">{formatInline(line.slice(2))}</h2>);
      i++; continue;
    }

    // Bullet lists
    if (line.match(/^[-*•]\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-orange-400 flex-shrink-0">•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
      i++; continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)[.)]\s/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-orange-400 flex-shrink-0 font-medium">{numMatch[1]}.</span>
          <span>{formatInline(line.slice(numMatch[0].length))}</span>
        </div>
      );
      i++; continue;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />);
      i++; continue;
    }

    // Normal paragraph
    elements.push(<p key={i}>{formatInline(line)}</p>);
    i++;
  }

  return <>{elements}</>;
}

/** Format bold, italic, inline code */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2]) {
      parts.push(<strong key={match.index} className="text-white font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="text-gray-300 italic">{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="bg-black/30 text-orange-300 px-1.5 py-0.5 rounded text-xs font-mono">
          {match[4]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? <>{parts}</> : text;
}

// ─── Sub-components ────────────────────────────────────────────

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-[#27272A] bg-[#0D0D12]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#16161E] border-b border-[#27272A]">
        <span className="text-[10px] text-gray-500 font-mono">{language || "code"}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="text-gray-500 hover:text-white transition-colors p-0.5"
        >
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs leading-relaxed">
        <code className="text-gray-300 font-mono">{code}</code>
      </pre>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
      title="Copy response"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-gray-500" />}
    </button>
  );
}

function FeedbackButtons({
  feedback,
  onFeedback,
}: {
  feedback?: "up" | "down";
  onFeedback: (f: "up" | "down") => void;
}) {
  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => onFeedback("up")}
        className={`p-1 rounded hover:bg-white/10 ${feedback === "up" ? "text-green-400" : "text-gray-600"}`}
      >
        <ThumbsUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => onFeedback("down")}
        className={`p-1 rounded hover:bg-white/10 ${feedback === "down" ? "text-red-400" : "text-gray-600"}`}
      >
        <ThumbsDown className="h-3 w-3" />
      </button>
    </div>
  );
}

/** Multi-phase loading indicator with animated transitions between phases */
function StreamingIndicator({ phase, agentName }: { phase: StreamPhase; agentName?: string }) {
  const config = phase ? phaseConfig[phase] : null;
  if (!config) return null;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-purple-500/20">
        <Bot className="h-4 w-4 text-orange-400" />
      </div>
      <div className="bg-[#1C1C24] border border-[#27272A] rounded-2xl px-4 py-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 5 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2.5 text-sm"
          >
            <Icon className={`h-4 w-4 ${config.color} animate-pulse`} />
            <span className="text-gray-400">{config.label}</span>
            {phase === "routing" && agentName && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/30 text-orange-400">
                {agentName}
              </Badge>
            )}
            {phase === "thinking" && (
              <span className="flex gap-0.5">
                <span className="w-1 h-1 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Auto-resizing textarea */
function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  disabled,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder: string;
  disabled: boolean;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback((el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    inputRef.current = el;
  }, [inputRef]);

  useEffect(() => {
    const el = localRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  }, [value]);

  return (
    <textarea
      ref={setRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className="flex-1 bg-[#1C1C24] border border-[#27272A] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/20 resize-none scrollbar-thin scrollbar-thumb-[#27272A] disabled:opacity-50 transition-colors"
    />
  );
}

// ─── Main Component ────────────────────────────────────────────
export function AgentSDKChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(null);
  const [streamAgentName, setStreamAgentName] = useState<string | undefined>();
  const [agentOverride, setAgentOverride] = useState<AgentOverride>(undefined);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [, setTick] = useState(0); // force re-render for relative time
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { toast } = useToast();
  const { selectedArtist } = useArtistContext();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamPhase]);

  // Focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Relative time ticker (every 30s)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ─── SSE Streaming send ──────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setStreamPhase("connecting");
    setStreamAgentName(undefined);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agents-sdk/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
          artistId: selectedArtist?.id,
          agentOverride,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const event = JSON.parse(payload);

            if (event.type === "status") {
              setStreamPhase(event.phase);
              if (event.agent) setStreamAgentName(event.agent);
            }

            if (event.type === "done" && event.data) {
              const d = event.data;
              const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: d.response,
                agentUsed: d.agentUsed,
                classification: d.classification,
                toolCalls: d.toolCalls,
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
              if (d.conversationHistory) {
                setConversationHistory(d.conversationHistory);
              }
            }

            if (event.type === "error") {
              throw new Error(event.message || "Stream error");
            }
          } catch (parseErr: any) {
            if (parseErr.message === "Stream error" || parseErr.message?.includes("timed out")) {
              throw parseErr;
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "error" as const,
          content: error.message || "Failed to get response. Try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamPhase(null);
      setStreamAgentName(undefined);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, isLoading, conversationHistory, selectedArtist, agentOverride]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setStreamPhase(null);
  }, []);

  const resetChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationHistory([]);
    setAgentOverride(undefined);
    setIsLoading(false);
    setStreamPhase(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFeedback = useCallback((msgId: string, fb: "up" | "down") => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: m.feedback === fb ? undefined : fb } : m))
    );
  }, []);

  const handleSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  // Memoize message count for conditional UI
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[500px] max-h-[800px]">
      {/* Agent Selector Bar */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          size="sm"
          variant={agentOverride === undefined ? "default" : "outline"}
          className={
            agentOverride === undefined
              ? "bg-orange-500 hover:bg-orange-600 text-white text-xs h-7"
              : "border-[#27272A] text-gray-400 text-xs h-7 hover:text-white hover:border-orange-500/40"
          }
          onClick={() => setAgentOverride(undefined)}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Auto
        </Button>
        {Object.entries(agentLabels).map(([key, label]) => {
          const Icon = agentIcons[key] || Bot;
          const isActive = agentOverride === key;
          return (
            <Button
              key={key}
              size="sm"
              variant={isActive ? "default" : "outline"}
              className={
                isActive
                  ? "bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 flex-shrink-0"
                  : "border-[#27272A] text-gray-400 text-xs h-7 flex-shrink-0 hover:text-white hover:border-orange-500/40"
              }
              onClick={() => setAgentOverride(key as AgentOverride)}
            >
              <Icon className="h-3 w-3 mr-1" />
              {label}
            </Button>
          );
        })}
        {hasMessages && (
          <div className="ml-auto flex-shrink-0">
            <Button size="sm" variant="ghost" className="text-gray-500 hover:text-white text-xs h-7" onClick={resetChat}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-[#27272A]"
      >
        {/* Empty state */}
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 mb-4 relative">
              <Bot className="h-10 w-10 text-orange-500" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0D0D12]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Boostify AI Agents
            </h3>
            <p className="text-gray-400 max-w-md mb-2 text-sm">
              Ask anything about music production, marketing, social media, merch, or your career.
            </p>
            <p className="text-gray-600 max-w-md mb-6 text-xs">
              The AI automatically classifies your question and routes it to the best specialist agent in real-time.
            </p>

            {selectedArtist && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300 flex items-center gap-2">
                <Music2 className="h-3.5 w-3.5" />
                Working with <strong>{(selectedArtist as any).artistName || (selectedArtist as any).name}</strong> — agents can access their profile, songs & merch
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-xl">
              {suggestions.map((s, i) => {
                const Icon = agentIcons[s.agent] || Bot;
                return (
                  <button
                    key={i}
                    className="text-left text-xs p-3 rounded-lg bg-[#1C1C24] border border-[#27272A] text-gray-400 hover:text-white hover:border-orange-500/50 transition-all group"
                    onClick={() => handleSuggestion(s.text)}
                  >
                    <Icon className="h-3.5 w-3.5 text-gray-600 group-hover:text-orange-400 mb-1.5 transition-colors" />
                    {s.text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {/* Error message */}
              {msg.role === "error" && (
                <div className="flex items-start gap-2 max-w-[85%] rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{msg.content}</span>
                    <button
                      className="ml-2 text-xs underline text-red-400 hover:text-red-300"
                      onClick={() => {
                        setInput(messages.filter((m) => m.role === "user").pop()?.content || "");
                        inputRef.current?.focus();
                      }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Assistant message */}
              {msg.role === "assistant" && (
                <>
                  <div className="flex-shrink-0 mt-1">
                    {(() => {
                      const Icon = msg.classification ? agentIcons[msg.classification] || Bot : Bot;
                      return (
                        <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-purple-500/20">
                          <Icon className="h-4 w-4 text-orange-400" />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#1C1C24] border border-[#27272A] text-gray-200 group">
                    {/* Agent badge + actions */}
                    <div className="flex items-center gap-2 mb-2">
                      {msg.classification && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 ${agentColors[msg.classification] || ""}`}>
                          {agentLabels[msg.classification] || msg.agentUsed}
                        </Badge>
                      )}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-gray-500/10 text-gray-500 border-gray-500/30">
                          <Wrench className="h-2.5 w-2.5 mr-1" />
                          {msg.toolCalls.length} tool{msg.toolCalls.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <div className="flex-1" />
                      <CopyButton text={msg.content} />
                      <FeedbackButtons feedback={msg.feedback} onFeedback={(f) => handleFeedback(msg.id, f)} />
                    </div>

                    {/* Rendered markdown content */}
                    <div className="text-sm leading-relaxed space-y-1">
                      {renderMarkdown(msg.content)}
                    </div>

                    {/* Tool calls + timestamp */}
                    <div className="flex items-center justify-between mt-3">
                      {msg.toolCalls && msg.toolCalls.length > 0 ? (
                        <details className="text-[11px] text-gray-500">
                          <summary className="cursor-pointer hover:text-gray-400 flex items-center gap-1">
                            <ChevronDown className="h-3 w-3" />
                            Tools executed
                          </summary>
                          <div className="mt-1.5 space-y-1 pl-4 border-l border-[#27272A]">
                            {msg.toolCalls.map((tc, i) => (
                              <div key={i} className="text-gray-500">
                                <code className="text-orange-400/70 text-[10px]">{tc.name}</code>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : <div />}
                      <span className="text-[10px] text-gray-600">{timeAgo(msg.timestamp)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* User message */}
              {msg.role === "user" && (
                <>
                  <div className="max-w-[80%]">
                    <div className="rounded-2xl px-4 py-3 bg-orange-500 text-white">
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-[10px] text-gray-600">{timeAgo(msg.timestamp)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 mt-1">
                    <div className="p-1.5 rounded-lg bg-orange-500/20">
                      <User className="h-4 w-4 text-orange-400" />
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming phase indicator */}
        {isLoading && <StreamingIndicator phase={streamPhase} agentName={streamAgentName} />}
      </div>

      {/* Input Area */}
      <div className="mt-4">
        {selectedArtist && hasMessages && (
          <div className="mb-2 text-xs text-gray-500 flex items-center gap-1">
            <Music2 className="h-3 w-3" />
            Context: <span className="text-orange-400">{(selectedArtist as any).artistName || (selectedArtist as any).name || "Artist"}</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <AutoTextarea
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            placeholder={agentOverride ? `Ask the ${agentLabels[agentOverride]}...` : "Ask anything about your music career..."}
            disabled={isLoading}
          />
          {isLoading ? (
            <Button onClick={stopGeneration} className="bg-red-500/80 hover:bg-red-500 h-10 px-4 flex-shrink-0">
              <span className="w-3 h-3 bg-white rounded-sm" />
            </Button>
          ) : (
            <Button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:opacity-90 h-10 px-4 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
