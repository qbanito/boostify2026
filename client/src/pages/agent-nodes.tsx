/**
 * BOOSTIFY — AGENT NETWORK NODES PAGE
 * Phase 4: Visualización de interacciones IA-IA (AUTONOMOUS_AGENTS_MASTERPLAN)
 *
 * Interactive node-graph visualization of the entire Boostify AI agent ecosystem.
 * Shows all agents as nodes, their connections, live activity, and status.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/header";
import {
  Brain,
  Zap,
  Music2,
  Image,
  Share2,
  Globe2,
  TrendingUp,
  Newspaper,
  DollarSign,
  Briefcase,
  Megaphone,
  Users2,
  GitMerge,
  Cpu,
  Radio,
  BarChart2,
  Video,
  MessageSquare,
  Shield,
  Award,
  Sparkles,
  Activity,
  Network,
  ChevronRight,
  Clock,
  CircleDot,
  Info,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────
//  AGENT DEFINITION
// ─────────────────────────────────────────────

type AgentTier = 0 | 1 | 2 | 3 | 4;

interface AgentNode {
  id: string;
  name: string;
  tier: AgentTier;
  /** 0–1000 SVG coordinate space */
  x: number;
  y: number;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  capabilities: string[];
  file: string;
}

interface AgentEdge {
  source: string;
  target: string;
  type: "bidirectional" | "unidirectional";
  /** Color class for the line */
  color: string;
}

// Canvas: 1000 × 620 SVG units
const CANVAS_W = 1000;
const CANVAS_H = 620;

const AGENT_NODES: AgentNode[] = [
  // ── Tier 0: Orchestrator (center hub) ──
  {
    id: "orchestrator",
    name: "Orchestrator",
    tier: 0,
    x: 500, y: 310,
    color: "#ffffff",
    bgColor: "rgba(255,255,255,0.12)",
    icon: Network,
    description: "Central brain that coordinates all autonomous agents via EventBus.",
    capabilities: ["EventBus coordination", "Queue management", "Agent lifecycle"],
    file: "server/agents/orchestrator.ts",
  },

  // ── Tier 1: Artist Core (purple) ──
  {
    id: "personality",
    name: "Personality",
    tier: 1,
    x: 500, y: 155,
    color: "#a78bfa",
    bgColor: "rgba(167,139,250,0.12)",
    icon: Brain,
    description: "Generates and maintains each AI artist's unique personality traits, mood, and artistic vision.",
    capabilities: ["Trait generation", "Mood tracking", "Artistic vision", "Authenticity scoring"],
    file: "server/agents/personality-agent.ts",
  },
  {
    id: "memory",
    name: "Memory",
    tier: 1,
    x: 360, y: 390,
    color: "#c084fc",
    bgColor: "rgba(192,132,252,0.12)",
    icon: Cpu,
    description: "Manages short-term, long-term, and episodic memory for each AI artist.",
    capabilities: ["Short-term recall", "Long-term storage", "Episodic events", "Memory decay"],
    file: "server/agents/memory-agent.ts",
  },
  {
    id: "decision",
    name: "Decision",
    tier: 1,
    x: 640, y: 390,
    color: "#e879f9",
    bgColor: "rgba(232,121,249,0.12)",
    icon: GitMerge,
    description: "Takes autonomous decisions based on personality + memory context.",
    capabilities: ["Decision trees", "Risk evaluation", "Opportunity detection", "Goal planning"],
    file: "server/agents/decision-agent.ts",
  },

  // ── Tier 2: Creative Agents (cyan) ──
  {
    id: "composer",
    name: "Composer",
    tier: 2,
    x: 190, y: 185,
    color: "#22d3ee",
    bgColor: "rgba(34,211,238,0.10)",
    icon: Music2,
    description: "Generates AI music compositions aligned with the artist's unique style.",
    capabilities: ["Melody generation", "Lyric writing", "Style matching", "MiniMax integration"],
    file: "server/agents/music-agent.ts",
  },
  {
    id: "visual",
    name: "Visual",
    tier: 2,
    x: 810, y: 185,
    color: "#38bdf8",
    bgColor: "rgba(56,189,248,0.10)",
    icon: Image,
    description: "Generates covers, press photos, and visual content synced with the artist's aesthetic.",
    capabilities: ["Cover art", "Press photos", "FAL AI integration", "Style consistency"],
    file: "server/agents/album-art-agent.ts",
  },
  {
    id: "social",
    name: "Social",
    tier: 2,
    x: 150, y: 430,
    color: "#0ea5e9",
    bgColor: "rgba(14,165,233,0.10)",
    icon: Share2,
    description: "Generates social posts, stories, and fan interactions in the artist's voice.",
    capabilities: ["Post creation", "Hashtag strategy", "Fan replies", "Engagement timing"],
    file: "server/agents/social-agent.ts",
  },
  {
    id: "video",
    name: "Video",
    tier: 2,
    x: 850, y: 430,
    color: "#7dd3fc",
    bgColor: "rgba(125,211,252,0.10)",
    icon: Video,
    description: "Generates music video concepts and AI-directed video content.",
    capabilities: ["Video concepts", "Scene scripting", "Kling AI integration", "Visual storytelling"],
    file: "server/agents/music-video-agent.ts",
  },

  // ── Tier 3: Business Agents (emerald) ──
  {
    id: "management",
    name: "Management",
    tier: 3,
    x: 60, y: 305,
    color: "#34d399",
    bgColor: "rgba(52,211,153,0.10)",
    icon: Briefcase,
    description: "Manages artist career decisions, contracts, and strategic partnerships.",
    capabilities: ["Career planning", "Contract review", "Deal evaluation", "Partnership strategy"],
    file: "server/agents/management-agent.ts",
  },
  {
    id: "economy",
    name: "Economy",
    tier: 3,
    x: 940, y: 305,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.10)",
    icon: DollarSign,
    description: "Manages BTF token economics, royalty distribution, and revenue optimization.",
    capabilities: ["Token economics", "Royalty calc", "Revenue streams", "Market analysis"],
    file: "server/agents/economy-agent.ts",
  },
  {
    id: "promotion",
    name: "Promotion",
    tier: 3,
    x: 340, y: 535,
    color: "#4ade80",
    bgColor: "rgba(74,222,128,0.10)",
    icon: Megaphone,
    description: "Orchestrates release campaigns, playlist pitching, and cross-platform promotion.",
    capabilities: ["Release campaigns", "Playlist pitching", "Press outreach", "Sync deals"],
    file: "server/agents/promotion-agent.ts",
  },
  {
    id: "outreach",
    name: "Outreach",
    tier: 3,
    x: 660, y: 535,
    color: "#86efac",
    bgColor: "rgba(134,239,172,0.10)",
    icon: Users2,
    description: "Manages fan relationships, collab proposals, and brand deals.",
    capabilities: ["Fan engagement", "Collab deals", "Brand partnerships", "Community growth"],
    file: "server/agents/outreach-agent.ts",
  },

  // ── Tier 4: Ecosystem Agents (orange) ──
  {
    id: "world",
    name: "World",
    tier: 4,
    x: 500, y: 570,
    color: "#fb923c",
    bgColor: "rgba(251,146,60,0.10)",
    icon: Globe2,
    description: "Simulates the music ecosystem — generates trends, world events, and challenges.",
    capabilities: ["Trend simulation", "World events", "Challenge creation", "Ecosystem balance"],
    file: "server/agents/world-agent.ts",
  },
  {
    id: "news",
    name: "News",
    tier: 4,
    x: 105, y: 100,
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.10)",
    icon: Newspaper,
    description: "Aggregates and generates news about AI artists and the Boostify ecosystem.",
    capabilities: ["News generation", "Press releases", "Artist spotlights", "Industry updates"],
    file: "server/agents/news-agent.ts",
  },
  {
    id: "trending",
    name: "Trending",
    tier: 4,
    x: 895, y: 100,
    color: "#fdba74",
    bgColor: "rgba(253,186,116,0.10)",
    icon: TrendingUp,
    description: "Monitors trending topics across platforms to guide AI artist content strategy.",
    capabilities: ["Trend detection", "Topic analysis", "Viral opportunity", "Platform signals"],
    file: "server/agents/trending-topics-agent.ts",
  },
  {
    id: "collaboration",
    name: "Collab",
    tier: 4,
    x: 500, y: 50,
    color: "#fbbf24",
    bgColor: "rgba(251,191,36,0.10)",
    icon: Sparkles,
    description: "Facilitates AI-to-AI artist collaborations, features, and joint projects.",
    capabilities: ["Collab matching", "Joint songs", "Feature requests", "Relationship building"],
    file: "server/agents/collaboration-agent.ts",
  },
];

// Edges — connections between agents
const AGENT_EDGES: AgentEdge[] = [
  // Orchestrator ↔ all Tier 1
  { source: "orchestrator", target: "personality", type: "bidirectional", color: "#a78bfa" },
  { source: "orchestrator", target: "memory", type: "bidirectional", color: "#c084fc" },
  { source: "orchestrator", target: "decision", type: "bidirectional", color: "#e879f9" },

  // Tier 1 internal triangle
  { source: "personality", target: "memory", type: "bidirectional", color: "#a78bfa" },
  { source: "personality", target: "decision", type: "bidirectional", color: "#a78bfa" },
  { source: "memory", target: "decision", type: "bidirectional", color: "#c084fc" },

  // Personality → Creative
  { source: "personality", target: "composer", type: "unidirectional", color: "#22d3ee" },
  { source: "personality", target: "visual", type: "unidirectional", color: "#38bdf8" },
  { source: "personality", target: "social", type: "unidirectional", color: "#0ea5e9" },

  // Decision → Creative/Business
  { source: "decision", target: "video", type: "unidirectional", color: "#7dd3fc" },
  { source: "decision", target: "promotion", type: "unidirectional", color: "#4ade80" },
  { source: "decision", target: "outreach", type: "unidirectional", color: "#86efac" },

  // Creative ↔ Management/Economy
  { source: "composer", target: "management", type: "unidirectional", color: "#34d399" },
  { source: "visual", target: "economy", type: "unidirectional", color: "#10b981" },

  // Business ↔ Ecosystem
  { source: "management", target: "world", type: "bidirectional", color: "#fb923c" },
  { source: "economy", target: "world", type: "bidirectional", color: "#fb923c" },
  { source: "promotion", target: "world", type: "unidirectional", color: "#f97316" },
  { source: "outreach", target: "collaboration", type: "bidirectional", color: "#fbbf24" },

  // Ecosystem
  { source: "world", target: "news", type: "unidirectional", color: "#f97316" },
  { source: "world", target: "trending", type: "unidirectional", color: "#fdba74" },
  { source: "collaboration", target: "personality", type: "unidirectional", color: "#fbbf24" },
  { source: "trending", target: "decision", type: "unidirectional", color: "#fdba74" },
  { source: "news", target: "social", type: "unidirectional", color: "#f97316" },

  // Orchestrator ↔ World & Collab (ecosystem gateway)
  { source: "orchestrator", target: "world", type: "bidirectional", color: "#fb923c" },
  { source: "orchestrator", target: "collaboration", type: "bidirectional", color: "#fbbf24" },
];

// Tier labels
const TIER_LABELS: Record<AgentTier, { label: string; color: string }> = {
  0: { label: "ORCHESTRATOR", color: "#ffffff" },
  1: { label: "ARTIST CORE", color: "#a78bfa" },
  2: { label: "CREATIVE", color: "#22d3ee" },
  3: { label: "BUSINESS", color: "#34d399" },
  4: { label: "ECOSYSTEM", color: "#fb923c" },
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function getNodeById(id: string): AgentNode | undefined {
  return AGENT_NODES.find(n => n.id === id);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// ─────────────────────────────────────────────
//  EDGE COMPONENT (SVG path with animation)
// ─────────────────────────────────────────────

function EdgeLine({
  edge,
  isHighlighted,
}: {
  edge: AgentEdge;
  isHighlighted: boolean;
}) {
  const src = getNodeById(edge.source);
  const tgt = getNodeById(edge.target);
  if (!src || !tgt) return null;

  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const nodeR = 28;

  const x1 = src.x + ux * nodeR;
  const y1 = src.y + uy * nodeR;
  const x2 = tgt.x - ux * nodeR;
  const y2 = tgt.y - uy * nodeR;

  const opacity = isHighlighted ? 1 : 0.25;
  const strokeW = isHighlighted ? 1.8 : 1;

  return (
    <g>
      {/* Static line */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={edge.color}
        strokeWidth={strokeW}
        strokeOpacity={opacity}
        strokeDasharray="4 6"
      />
      {/* Animated pulse dot */}
      {isHighlighted && (
        <circle r={3} fill={edge.color} opacity={0.9}>
          <animateMotion
            dur={`${1.8 + Math.random() * 1.5}s`}
            repeatCount="indefinite"
            path={`M${x1},${y1} L${x2},${y2}`}
          />
        </circle>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────
//  NODE COMPONENT (SVG circle + icon + label)
// ─────────────────────────────────────────────

const TIER_R: Record<AgentTier, number> = { 0: 32, 1: 26, 2: 22, 3: 20, 4: 18 };

function AgentNodeCircle({
  node,
  isSelected,
  isConnected,
  dimmed,
  usageCount,
  onSelect,
}: {
  node: AgentNode;
  isSelected: boolean;
  isConnected: boolean;
  dimmed: boolean;
  usageCount: number;
  onSelect: (node: AgentNode) => void;
}) {
  const r = TIER_R[node.tier];
  const isActive = usageCount > 0;
  const opacity = dimmed ? 0.2 : 1;

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: "pointer", opacity }}
      onClick={() => onSelect(node)}
    >
      {/* Outer glow ring when selected */}
      {isSelected && (
        <circle
          r={r + 12}
          fill="none"
          stroke={node.color}
          strokeWidth={2}
          strokeOpacity={0.6}
          strokeDasharray="6 4"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 0 0"
            to="360 0 0"
            dur="8s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Active pulse ring */}
      {isActive && (
        <circle r={r + 8} fill="none" stroke={node.color} strokeWidth={1.5} strokeOpacity={0.3}>
          <animate attributeName="r" values={`${r + 4};${r + 16};${r + 4}`} dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Connected ring (connected-to-selected) */}
      {isConnected && !isSelected && (
        <circle
          r={r + 8}
          fill="none"
          stroke={node.color}
          strokeWidth={1.5}
          strokeOpacity={0.45}
          strokeDasharray="3 5"
        />
      )}

      {/* Background circle */}
      <circle
        r={r}
        fill={isSelected ? node.color : node.bgColor}
        stroke={node.color}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeOpacity={0.9}
      />

      {/* Tier-0 special cross lines */}
      {node.tier === 0 && (
        <>
          <line x1={0} y1={-(r - 6)} x2={0} y2={r - 6} stroke={isSelected ? "#000" : node.color} strokeWidth={1.5} strokeOpacity={0.6} />
          <line x1={-(r - 6)} y1={0} x2={r - 6} y2={0} stroke={isSelected ? "#000" : node.color} strokeWidth={1.5} strokeOpacity={0.6} />
        </>
      )}

      {/* Usage badge */}
      {isActive && (
        <g transform={`translate(${r - 4}, ${-r + 4})`}>
          <circle r={7} fill="#0a0a0f" stroke={node.color} strokeWidth={1} />
          <text
            x={0} y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={7}
            fill={node.color}
            fontWeight="bold"
          >
            {usageCount > 99 ? "99+" : usageCount}
          </text>
        </g>
      )}

      {/* Node label */}
      <text
        y={r + 14}
        textAnchor="middle"
        fontSize={9.5}
        fill={isSelected ? node.color : "#e2e8f0"}
        fontWeight={isSelected ? "700" : "500"}
        letterSpacing={0.5}
      >
        {node.name.toUpperCase()}
      </text>

      {/* Tier dot */}
      <circle cx={r - 2} cy={r - 2} r={3.5} fill={node.color} opacity={0.9} />
    </g>
  );
}

// ─────────────────────────────────────────────
//  DETAIL PANEL
// ─────────────────────────────────────────────

function AgentDetailPanel({
  node,
  usageCount,
  onClose,
}: {
  node: AgentNode;
  usageCount: number;
  onClose: () => void;
}) {
  const tierInfo = TIER_LABELS[node.tier];
  const isActive = usageCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      transition={{ duration: 0.22 }}
      className="absolute right-0 top-0 bottom-0 w-72 flex flex-col z-20"
      style={{
        background: "linear-gradient(135deg, rgba(10,10,15,0.97) 0%, rgba(15,15,25,0.95) 100%)",
        borderLeft: `1px solid ${node.color}30`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: `${node.color}20` }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: node.bgColor, border: `1.5px solid ${node.color}60` }}
          >
            <node.icon className="w-5 h-5" style={{ color: node.color }} />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-widest" style={{ color: node.color }}>
              {tierInfo.label}
            </p>
            <h3 className="text-base font-bold text-white">{node.name} Agent</h3>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-b" style={{ borderColor: `${node.color}15` }}>
        <div className="flex items-center gap-2">
          <CircleDot
            className="w-3.5 h-3.5"
            style={{ color: isActive ? "#4ade80" : "#64748b" }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: isActive ? "#4ade80" : "#64748b" }}
          >
            {isActive ? `ACTIVE — ${usageCount} tasks today` : "STANDBY"}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{node.description}</p>
      </div>

      {/* Capabilities */}
      <div className="px-4 py-3 flex-1">
        <p className="text-xs font-semibold tracking-widest text-slate-500 mb-3">CAPABILITIES</p>
        <div className="flex flex-col gap-1.5">
          {node.capabilities.map(cap => (
            <div key={cap} className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: node.color }} />
              <span className="text-xs text-slate-300">{cap}</span>
            </div>
          ))}
        </div>
      </div>

      {/* File reference */}
      <div className="px-4 py-3 border-t" style={{ borderColor: `${node.color}15` }}>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Info className="w-3 h-3" />
          <span className="font-mono">{node.file}</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  ACTIVITY LOG
// ─────────────────────────────────────────────

interface EcosystemData {
  stats: {
    activeAiArtists: number;
    totalRelationships: number;
    eventsToday: number;
    tasksToday: number;
    agentUsageToday: number;
  };
  agentUsage: Record<string, number>;
  recentSessions: Array<{
    id: number;
    agentType: string;
    status: string;
    label: string;
    createdAt: string;
  }>;
  recentWorldEvents: Array<{
    id: number;
    title: string;
    eventType: string;
    status: string;
    createdAt: string;
  }>;
  recentActions: Array<{
    id: number;
    actionType: string;
    status: string;
    createdAt: string;
  }>;
}

const STATUS_COLOR: Record<string, string> = {
  completed: "#4ade80",
  running: "#22d3ee",
  pending: "#fbbf24",
  failed: "#f87171",
  active: "#4ade80",
  scheduled: "#fbbf24",
  ended: "#64748b",
};

function ActivityLog({ data }: { data: EcosystemData | undefined }) {
  const events = [
    ...(data?.recentSessions ?? []).map(s => ({
      key: `s-${s.id}`,
      label: s.label,
      status: s.status,
      time: s.createdAt,
      type: "agent",
    })),
    ...(data?.recentWorldEvents ?? []).map(e => ({
      key: `w-${e.id}`,
      label: e.title ?? e.eventType,
      status: e.status ?? "active",
      time: e.createdAt,
      type: "world",
    })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 18);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold tracking-widest text-slate-400">LIVE ACTIVITY</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-500">
              <Clock className="w-5 h-5" />
              <p className="text-xs">No recent activity</p>
            </div>
          ) : (
            events.map(ev => (
              <motion.div
                key={ev.key}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: STATUS_COLOR[ev.status] ?? "#64748b" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate leading-tight">{ev.label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {ev.type === "world" ? "🌍 " : "🤖 "}
                    {formatRelativeTime(ev.time)}
                  </p>
                </div>
                <span
                  className="text-[9px] font-semibold tracking-wide flex-shrink-0"
                  style={{ color: STATUS_COLOR[ev.status] ?? "#64748b" }}
                >
                  {ev.status.toUpperCase()}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  STATS BAR
// ─────────────────────────────────────────────

function StatsBar({ data }: { data: EcosystemData | undefined }) {
  const stats = [
    {
      label: "AI Artists",
      value: data?.stats.activeAiArtists ?? 0,
      icon: Brain,
      color: "#a78bfa",
    },
    {
      label: "Relationships",
      value: data?.stats.totalRelationships ?? 0,
      icon: GitMerge,
      color: "#22d3ee",
    },
    {
      label: "Events Today",
      value: data?.stats.eventsToday ?? 0,
      icon: Globe2,
      color: "#fb923c",
    },
    {
      label: "Tasks Done",
      value: data?.stats.tasksToday ?? 0,
      icon: Zap,
      color: "#4ade80",
    },
    {
      label: "Agent Calls",
      value: data?.stats.agentUsageToday ?? 0,
      icon: Activity,
      color: "#38bdf8",
    },
  ];

  return (
    <div className="flex items-center gap-4 overflow-x-auto">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-2 flex-shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: `${s.color}15`, border: `1px solid ${s.color}30` }}
          >
            <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-none">{s.value}</p>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  LEGEND
// ─────────────────────────────────────────────

function TierLegend() {
  return (
    <div className="flex items-center gap-4 overflow-x-auto">
      {(Object.entries(TIER_LABELS) as [string, { label: string; color: string }][]).map(
        ([tier, { label, color }]) => (
          <div key={tier} className="flex items-center gap-1.5 flex-shrink-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-[10px] font-medium tracking-wide" style={{ color }}>
              {label}
            </span>
          </div>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────

export default function AgentNodesPage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const { data: ecosystemData } = useQuery<EcosystemData>({
    queryKey: ["/api/agents/ecosystem-nodes"],
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;

  // Determine connected node ids (direct neighbours of selected)
  const connectedIds = new Set<string>();
  if (selectedNodeId) {
    for (const edge of AGENT_EDGES) {
      if (edge.source === selectedNodeId) connectedIds.add(edge.target);
      if (edge.target === selectedNodeId) connectedIds.add(edge.source);
    }
  }

  const handleNodeSelect = useCallback((node: AgentNode) => {
    setSelectedNodeId(prev => (prev === node.id ? null : node.id));
  }, []);

  // Map agentType → node id (rough match)
  const getUsageCount = (nodeId: string): number => {
    if (!ecosystemData?.agentUsage) return 0;
    const map: Record<string, string[]> = {
      composer: ["music", "composer", "music-agent"],
      visual: ["album-art", "visual", "image"],
      social: ["social", "social-media"],
      video: ["video", "music-video"],
      management: ["management", "manager"],
      economy: ["economy"],
      promotion: ["promotion", "promo"],
      outreach: ["outreach", "fan"],
      news: ["news"],
      trending: ["trending", "trends"],
      personality: ["personality"],
      memory: ["memory"],
      decision: ["decision"],
      collaboration: ["collaboration", "collab"],
    };
    const keys = map[nodeId] ?? [nodeId];
    return Object.entries(ecosystemData.agentUsage)
      .filter(([k]) => keys.some(key => k.toLowerCase().includes(key)))
      .reduce((sum, [, v]) => sum + v, 0);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0a0a0f" }}
    >
      <Header />

      <main className="flex-1 flex flex-col pt-16 overflow-hidden">
        {/* ── Top bar ── */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)" }}
            >
              <Network className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">AGENT NETWORK</h1>
              <p className="text-[10px] text-slate-500 tracking-widest">AUTONOMOUS AI ECOSYSTEM</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <StatsBar data={ecosystemData} />
            <button
              onClick={() => setShowLog(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: showLog ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.05)",
                color: showLog ? "#22d3ee" : "#64748b",
                border: `1px solid ${showLog ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <Activity className="w-3.5 h-3.5" />
              Log
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* ── SVG Node Graph ── */}
          <div className="flex-1 relative overflow-hidden">
            {/* Legend strip */}
            <div
              className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-4 py-2 rounded-xl z-10"
              style={{
                background: "rgba(10,10,15,0.85)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
              }}
            >
              <TierLegend />
              <div className="flex items-center gap-1.5 text-slate-500">
                <CircleDot className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px]">Active</span>
                <span className="mx-1">·</span>
                <div className="w-4 h-px border-t border-dashed border-slate-500" />
                <span className="text-[10px] ml-1">Data flow</span>
              </div>
            </div>

            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full"
              style={{ maxHeight: "calc(100vh - 140px)" }}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
                </pattern>
                <radialGradient id="centerGlow" cx="50%" cy="50%" r="40%">
                  <stop offset="0%" stopColor="rgba(167,139,250,0.06)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
              <ellipse
                cx={CANVAS_W / 2} cy={CANVAS_H / 2}
                rx={400} ry={280}
                fill="url(#centerGlow)"
              />

              {/* ── Edges ── */}
              <g>
                {AGENT_EDGES.map((edge, i) => {
                  const isHighlighted =
                    !selectedNodeId ||
                    edge.source === selectedNodeId ||
                    edge.target === selectedNodeId;
                  return (
                    <EdgeLine
                      key={i}
                      edge={edge}
                      isHighlighted={isHighlighted}
                    />
                  );
                })}
              </g>

              {/* ── Nodes ── */}
              <g filter="url(#glow)">
                {AGENT_NODES.map(node => {
                  const isSelected = node.id === selectedNodeId;
                  const isConnected = connectedIds.has(node.id);
                  const dimmed =
                    !!selectedNodeId && !isSelected && !isConnected;
                  return (
                    <AgentNodeCircle
                      key={node.id}
                      node={node}
                      isSelected={isSelected}
                      isConnected={isConnected}
                      dimmed={dimmed}
                      usageCount={getUsageCount(node.id)}
                      onSelect={handleNodeSelect}
                    />
                  );
                })}
              </g>
            </svg>
          </div>

          {/* ── Right panels ── */}
          <div
            className="flex flex-col relative"
            style={{
              width: showLog || selectedNode ? 288 : 0,
              transition: "width 0.25s ease",
              overflow: "hidden",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(10,10,15,0.9)",
              backdropFilter: "blur(16px)",
            }}
          >
            <AnimatePresence mode="wait">
              {selectedNode ? (
                <AgentDetailPanel
                  key={selectedNode.id}
                  node={selectedNode}
                  usageCount={getUsageCount(selectedNode.id)}
                  onClose={() => setSelectedNodeId(null)}
                />
              ) : showLog ? (
                <motion.div
                  key="log"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col h-full"
                >
                  <ActivityLog data={ecosystemData} />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Click-anywhere-to-deselect hint ── */}
        {selectedNodeId && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs text-slate-400 pointer-events-none z-20"
            style={{
              background: "rgba(10,10,15,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Click node again or another node to navigate
          </motion.div>
        )}
      </main>
    </div>
  );
}
