/**
 * BOOSTIFY ARTIST NODE FLOW — NodeFlowCanvas
 * React Flow wrapper with animated edges, minimap, custom node types.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  NodeTypes,
  EdgeTypes,
  BaseEdge,
  EdgeProps,
  getBezierPath,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Panel,
  addEdge,
  Connection,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from './useFlowStore';
import { ArtistInputNode } from './nodes/ArtistInputNode';
import { SongInputNode } from './nodes/SongInputNode';
import { BioGeneratorNode } from './nodes/BioGeneratorNode';
import { CoverArtNode } from './nodes/CoverArtNode';
import { KaraokeNode } from './nodes/KaraokeNode';
import { PromoClipNode } from './nodes/PromoClipNode';
import { SocialPostNode } from './nodes/SocialPostNode';
import { ShareCardNode } from './nodes/ShareCardNode';
import { ProfileUpdateNode } from './nodes/ProfileUpdateNode';
import { NewsPublisherNode } from './nodes/NewsPublisherNode';
import { ProfileModuleNode } from './nodes/ProfileModuleNode';
import { ProfileRootNode } from './nodes/ProfileRootNode';
import { NodeDependencyProvider } from './NodeDependencyContext';
import { ScheduleTriggerNode } from './nodes/ScheduleTriggerNode';
import { RouterNode } from './nodes/RouterNode';
import { WebhookTriggerNode } from './nodes/WebhookTriggerNode';
import { PromptBuilderNode } from './nodes/PromptBuilderNode';
import { AgentCommandNode } from './nodes/AgentCommandNode';
import { VideoInputNode } from './nodes/VideoInputNode';
import TalkToMeNode from './nodes/TalkToMeNode';
import PremiumPageNode from './nodes/PremiumPageNode';

// ─── Custom node registry ────────────────────────────────────────────────────

const NODE_TYPES: NodeTypes = {
  artistInput: ArtistInputNode as any,
  songInput: SongInputNode as any,
  bioGenerator: BioGeneratorNode as any,
  coverArt: CoverArtNode as any,
  karaoke: KaraokeNode as any,
  promoClip: PromoClipNode as any,
  socialPost: SocialPostNode as any,
  shareCard: ShareCardNode as any,
  profileUpdate: ProfileUpdateNode as any,
  newsPublisher: NewsPublisherNode as any,
  profileModule: ProfileModuleNode as any,
  profileRoot: ProfileRootNode as any,
  scheduleTrigger: ScheduleTriggerNode as any,
  routerNode: RouterNode as any,
  webhookTrigger: WebhookTriggerNode as any,
  promptBuilder: PromptBuilderNode as any,
  agentCommand: AgentCommandNode as any,
  videoInput: VideoInputNode as any,
  talkToMe: TalkToMeNode as any,
  // ── Premium Page Nodes ─────────────────────────────────────────────────────
  youtubeBoost:    PremiumPageNode as any,
  instagramBoost:  PremiumPageNode as any,
  tiktokBoost:     PremiumPageNode as any,
  artistImage:     PremiumPageNode as any,
  merch:           PremiumPageNode as any,
  contacts:        PremiumPageNode as any,
  aiArtistMint:    PremiumPageNode as any,
};

// ─── Elegant neon edge with flowing shimmer ───────────────────────────────────

const EDGE_ANIM_STYLE = `
  @keyframes edgeFlow {
    from { stroke-dashoffset: 200; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes edgePulse {
    0%, 100% { opacity: 0.35; }
    50%       { opacity: 0.65; }
  }
`;

let _edgeStyleInjected = false;
function injectEdgeStyle() {
  if (_edgeStyleInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = EDGE_ANIM_STYLE;
  document.head.appendChild(s);
  _edgeStyleInjected = true;
}

function NeonEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, id, selected,
}: EdgeProps) {
  injectEdgeStyle();
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const stroke = (style as any)?.stroke ?? '#6366f1';
  const filterId = `neon-${(id ?? 'e').replace(/[^a-zA-Z0-9]/g, '_')}`;

  return (
    <g>
      <defs>
        <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" type="saturate" values="6" result="sat" />
          <feMerge>
            <feMergeNode in="sat" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Wide invisible hit area — makes right-click easy */}
      <path
        d={edgePath} fill="none" stroke="transparent" strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
      />

      {/* Outer diffuse glow */}
      <path
        d={edgePath} fill="none" stroke={stroke}
        strokeWidth={selected ? 12 : 8} strokeOpacity={selected ? 0.18 : 0.1}
        strokeLinecap="round"
        style={{ animation: 'edgePulse 3s ease-in-out infinite', filter: `url(#${filterId})` }}
      />

      {/* Mid glow */}
      <path
        d={edgePath} fill="none" stroke={stroke}
        strokeWidth={selected ? 5 : 3} strokeOpacity={selected ? 0.45 : 0.25}
        strokeLinecap="round"
      />

      {/* Core wire */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: selected ? 2 : 1.5, strokeOpacity: 0.9 }}
      />

      {/* Flowing shimmer — elegant dashed highlight moving along the wire */}
      <path
        d={edgePath} fill="none"
        stroke="#fff"
        strokeWidth={selected ? 1.5 : 1}
        strokeOpacity={selected ? 0.6 : 0.35}
        strokeLinecap="round"
        strokeDasharray="12 188"
        style={{
          animation: `edgeFlow ${selected ? '1.2s' : '2.4s'} linear infinite`,
          filter: `url(#${filterId})`,
        }}
      />

      {/* Second shimmer offset — creates a doubled shimmer wave */}
      <path
        d={edgePath} fill="none"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.5}
        strokeOpacity={selected ? 0.5 : 0.2}
        strokeLinecap="round"
        strokeDasharray="6 194"
        style={{
          animation: `edgeFlow ${selected ? '1.6s' : '3.2s'} linear infinite`,
          animationDelay: '-1.1s',
        }}
      />
    </g>
  );
}

const EDGE_TYPES: EdgeTypes = {
  animated: NeonEdge,
};

// ─── Node types available in right-click "Add node" menu ─────────────────────

// Items with type '__section__' render as non-clickable section headers.
const ADD_NODE_MENU: Array<{ label: string; type: string; icon: string }> = [
  { label: 'Artist Input',    type: 'artistInput',    icon: '🎤' },
  { label: 'Song Input',      type: 'songInput',      icon: '🎵' },
  { label: 'Video Input',     type: 'videoInput',     icon: '🎬' },
  { label: 'Talk To Me',      type: 'talkToMe',       icon: '📞' },
  { label: 'Bio Generator',   type: 'bioGenerator',   icon: '📝' },
  { label: 'Cover Art',       type: 'coverArt',       icon: '🖼️' },
  { label: 'Karaoke',         type: 'karaoke',        icon: '🎶' },
  { label: 'Promo Clip',      type: 'promoClip',      icon: '📹' },
  { label: 'Social Post',     type: 'socialPost',     icon: '📱' },
  { label: 'Share Card',      type: 'shareCard',      icon: '🃏' },
  { label: 'Profile Update',  type: 'profileUpdate',  icon: '🔄' },
  { label: 'News Publisher',  type: 'newsPublisher',  icon: '📰' },
  // ── Automation nodes
  { label: 'Schedule Trigger', type: 'scheduleTrigger', icon: '⏰' },
  { label: 'Router',           type: 'routerNode',       icon: '🔀' },
  { label: 'Webhook Trigger',  type: 'webhookTrigger',   icon: '🌐' },
  { label: 'Prompt Builder',   type: 'promptBuilder',    icon: '💬' },
  // ── Premium page launchers
  { label: '⚡ PREMIUM TOOLS',  type: '__section__',     icon: '' },
  { label: 'YouTube Boost',    type: 'youtubeBoost',    icon: '▶️' },
  { label: 'Instagram Boost',  type: 'instagramBoost',  icon: '📸' },
  { label: 'TikTok Boost',     type: 'tiktokBoost',     icon: '🎵' },
  { label: 'Artist Image',     type: 'artistImage',     icon: '🖼️' },
  { label: 'Merch Store',      type: 'merch',           icon: '👕' },
  { label: 'Contacts',         type: 'contacts',        icon: '📋' },
  { label: 'AI Artist Mint',   type: 'aiArtistMint',    icon: '🪙' },
];

// ─── Context menu ─────────────────────────────────────────────────────────────

type CtxTarget =
  | { type: 'node';  x: number; y: number; nodeId: string; nodeType: string }
  | { type: 'edge';  x: number; y: number; edgeId: string }
  | { type: 'pane';  x: number; y: number; flowPos: { x: number; y: number } };

function ContextMenu({
  ctx,
  onClose,
  onDisconnectNode,
  onDeleteNode,
  onDeleteEdge,
  onAddNode,
  onFitView,
  onAutoLayout,
}: {
  ctx: CtxTarget;
  onClose: () => void;
  onDisconnectNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  onAddNode: (type: string, pos: { x: number; y: number }) => void;
  onFitView: () => void;
  onAutoLayout: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const keyClose = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => {
      document.addEventListener('mousedown', close);
      document.addEventListener('keydown', keyClose);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', keyClose);
    };
  }, [onClose]);

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '6px 12px', textAlign: 'left', fontSize: 12, fontWeight: 500,
    color: '#cbd5e1', background: 'transparent', border: 'none', cursor: 'pointer',
    borderRadius: 6, transition: 'background 0.1s',
  };
  const dangerStyle: React.CSSProperties = { ...btnStyle, color: '#f87171' };
  const divider = <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />;

  // Clamp so it doesn't go off-screen
  const left = Math.min(ctx.x, window.innerWidth - 220);
  const top  = Math.min(ctx.y, window.innerHeight - 400);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', zIndex: 9999,
        left, top,
        width: 210,
        background: 'rgba(10,10,20,0.97)',
        border: '1px solid rgba(99,102,241,0.35)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(16px)',
        padding: '6px 4px',
        fontFamily: "'Inter', sans-serif",
      }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* ── NODE MENU ── */}
      {ctx.type === 'node' && (
        <>
          <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Node
          </div>
          <button
            style={btnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onDisconnectNode(ctx.nodeId); }}
          >
            <span>🔌</span> Disconnect all edges
          </button>
          {ctx.nodeType !== 'profileModule' && (
            <button
              style={dangerStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { onDeleteNode(ctx.nodeId); }}
            >
              <span>🗑️</span> Delete node
            </button>
          )}
          {divider}
          <button
            style={btnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onFitView(); onClose(); }}
          >
            <span>⤢</span> Fit view
          </button>
        </>
      )}

      {/* ── EDGE MENU ── */}
      {ctx.type === 'edge' && (
        <>
          <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Connection
          </div>
          <button
            style={dangerStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onDeleteEdge(ctx.edgeId); }}
          >
            <span>✂️</span> Disconnect (delete)
          </button>
        </>
      )}

      {/* ── PANE MENU ── */}
      {ctx.type === 'pane' && (
        <>
          <div style={{ padding: '4px 12px 6px', fontSize: 10, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Add AI node
          </div>
          {ADD_NODE_MENU.map((item, idx) => {
            if (item.type === '__section__') {
              return (
                <div key={idx} style={{
                  padding: '8px 12px 4px',
                  fontSize: 9, fontWeight: 800,
                  color: '#f59e0b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  borderTop: '1px solid rgba(245,158,11,0.2)',
                  marginTop: 4,
                }}>
                  {item.label}
                </div>
              );
            }
            return (
              <button
                key={item.type}
                style={btnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { onAddNode(item.type, ctx.flowPos); onClose(); }}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            );
          })}
          {divider}
          <button
            style={btnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onAutoLayout(); onClose(); }}
          >
            <span>↻</span> Auto Layout
          </button>
          <button
            style={btnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            onClick={() => { onFitView(); onClose(); }}
          >
            <span>⤢</span> Fit view
          </button>
        </>
      )}
    </div>
  );
}

// ─── Drop zone handling ──────────────────────────────────────────────────────

let nodeIdCounter = 1;
function newId() {
  return `node-${Date.now()}-${nodeIdCounter++}`;
}

interface NodeFlowCanvasProps {
  extraNodes?: any[];
  extraEdges?: any[];
  layoutKey?: number;
  onAutoLayout?: () => void;
  /** Called when two profile-module nodes are connected; use to reorder sections */
  onModuleConnect?: (sourceNodeId: string, targetNodeId: string) => void;
}

export function NodeFlowCanvas({ extraNodes = [], extraEdges = [], layoutKey = 0, onAutoLayout, onModuleConnect }: NodeFlowCanvasProps) {
  const store = useFlowStore();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxTarget | null>(null);

  // Local RF-managed state for extraNodes (profile modules) so React Flow
  // can apply dimension measurements and keep visibility correct.
  const [rfExtraNodes, setRfExtraNodes, onExtraNodesChange] = useNodesState(extraNodes);
  const [rfExtraEdges, setRfExtraEdges, onExtraEdgesChange] = useEdgesState(extraEdges);

  // Sync external extraNodes/Edges into local RF state when they change.
  // IMPORTANT: preserve positions that the user has manually dragged — only
  // adopt the parent-prop position for nodes that are brand new (not yet in RF state).
  useEffect(() => {
    setRfExtraNodes(prev => {
      const prevById = new Map(prev.map(n => [n.id, n]));
      return extraNodes.map(n => {
        const existing = prevById.get(n.id);
        // Keep user-dragged position; update everything else (data, type, etc.)
        return existing ? { ...n, position: existing.position } : n;
      });
    });
  }, [extraNodes]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sync layout edges from parent WITHOUT wiping user-drawn connections.
  // User-created edges have IDs starting with "user-edge-"; preserve them.
  useEffect(() => {
    setRfExtraEdges(prev => {
      const propIdSet = new Set(extraEdges.map(e => e.id));
      const userEdges = prev.filter(e => String(e.id).startsWith('user-edge-') && !propIdSet.has(e.id));
      return [...extraEdges, ...userEdges];
    });
  }, [extraEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger fitView when profile nodes first become populated
  const prevExtraCount = useRef(0);
  useEffect(() => {
    if (extraNodes.length > 0 && prevExtraCount.current === 0) {
      const id = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 200);
      return () => clearTimeout(id);
    }
    prevExtraCount.current = extraNodes.length;
  }, [extraNodes.length, fitView]);

  // Re-layout: reset positions and fit when layoutKey changes
  const prevLayoutKey = useRef(0);
  useEffect(() => {
    if (layoutKey > 0 && layoutKey !== prevLayoutKey.current) {
      prevLayoutKey.current = layoutKey;
      setRfExtraNodes(extraNodes);
      const id = setTimeout(() => fitView({ padding: 0.15, duration: 500 }), 150);
      return () => clearTimeout(id);
    }
  }, [layoutKey, extraNodes, setRfExtraNodes, fitView]);

  // Keyboard shortcut: press F to fit view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName ?? '';
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        fitView({ padding: 0.15, duration: 400 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fitView]);

  // Merge profile module nodes with any user-added AI action nodes
  const allNodes = [...rfExtraNodes, ...store.nodes];
  const allEdges = [...rfExtraEdges, ...store.edges];

  // Combined change handler: route changes to the right state
  const handleNodesChange = useCallback((changes: any) => {
    onExtraNodesChange(changes);
    store.onNodesChange(changes);
  }, [onExtraNodesChange, store]);

  const handleEdgesChange = useCallback((changes: any) => {
    onExtraEdgesChange(changes);
    store.onEdgesChange(changes);
  }, [onExtraEdgesChange, store]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/boostify-node');
    if (!nodeType) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode = {
      id: newId(), type: nodeType, position,
      data: { status: 'idle' as const, artistId: store.artistId ?? undefined, artistSlug: store.artistSlug ?? undefined, output: {} },
    };
    store.addNode(newNode);
  }, [screenToFlowPosition, store]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    store.selectNode(node.id);
    setCtxMenu(null);
  }, [store]);

  const onPaneClick = useCallback(() => {
    store.selectNode(null);
    setCtxMenu(null);
  }, [store]);

  // ── Context menu handlers ─────────────────────────────────────────────────

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: any) => {
    e.preventDefault();
    setCtxMenu({ type: 'node', x: e.clientX, y: e.clientY, nodeId: node.id, nodeType: node.type ?? '' });
  }, []);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: any) => {
    e.preventDefault();
    setCtxMenu({ type: 'edge', x: e.clientX, y: e.clientY, edgeId: edge.id });
  }, []);

  const onPaneContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setCtxMenu({ type: 'pane', x: e.clientX, y: e.clientY, flowPos });
  }, [screenToFlowPosition]);

  // Double-click an edge to disconnect it immediately
  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: any) => {
    setRfExtraEdges(eds => eds.filter(e => e.id !== edge.id));
    store.setEdges(store.edges.filter(e => e.id !== edge.id));
  }, [store, setRfExtraEdges]);

  // Context menu actions
  const handleDisconnectNode = useCallback((nodeId: string) => {
    setRfExtraEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    store.setEdges(store.edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    setCtxMenu(null);
  }, [store, setRfExtraEdges]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    store.setNodes(store.nodes.filter(n => n.id !== nodeId));
    store.setEdges(store.edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    setCtxMenu(null);
  }, [store]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setRfExtraEdges(eds => eds.filter(e => e.id !== edgeId));
    store.setEdges(store.edges.filter(e => e.id !== edgeId));
    setCtxMenu(null);
  }, [store, setRfExtraEdges]);

  const PREMIUM_TYPES = new Set([
    'youtubeBoost', 'instagramBoost', 'tiktokBoost',
    'artistImage', 'merch', 'contacts', 'aiArtistMint',
  ]);

  const handleAddNode = useCallback((nodeType: string, pos: { x: number; y: number }) => {
    const extraData: Record<string, unknown> = {};
    if (PREMIUM_TYPES.has(nodeType)) extraData.pageType = nodeType;
    const newNode = {
      id: newId(), type: nodeType, position: pos,
      data: { status: 'idle' as const, artistId: store.artistId ?? undefined, artistSlug: store.artistSlug ?? undefined, output: {}, ...extraData },
    };
    store.addNode(newNode);
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connection validation ──────────────────────────────────────────────────
  // Blocks invalid wiring so the flow stays a clean DAG that the runner can
  // execute: no self-loops, no duplicate edges, and no cycles (a cycle would
  // silently strand nodes in the topological sort and they'd never run).
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const source = connection.source;
    const target = connection.target;
    if (!source || !target) return false;

    // 1) No node may connect to itself.
    if (source === target) return false;

    // 2) No duplicate edge between the same handles.
    const srcHandle = ('sourceHandle' in connection ? connection.sourceHandle : null) ?? null;
    const tgtHandle = ('targetHandle' in connection ? connection.targetHandle : null) ?? null;
    const duplicate = allEdges.some(e =>
      e.source === source &&
      e.target === target &&
      (e.sourceHandle ?? null) === srcHandle &&
      (e.targetHandle ?? null) === tgtHandle
    );
    if (duplicate) return false;

    // 3) No cycles: adding source→target is invalid if target can already
    //    reach source by following existing edges.
    const adjacency: Record<string, string[]> = {};
    for (const e of allEdges) {
      (adjacency[e.source] ??= []).push(e.target);
    }
    const stack = [target];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === source) return false; // would close a loop
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency[current] ?? []) stack.push(next);
    }
    return true;
  }, [allEdges]);

  // Handle new connections (also accept profile-module → profile-module custom edges)
  const onConnect = useCallback((connection: Connection) => {
    // Reject invalid wiring (self-loop, duplicate, or cycle) before adding it.
    if (!isValidConnection(connection)) return;
    const isExtraSource = rfExtraNodes.some(n => n.id === connection.source);
    const isExtraTarget = rfExtraNodes.some(n => n.id === connection.target);
    if (isExtraSource || isExtraTarget) {
      const edgeId = `user-edge-${Date.now()}`;
      setRfExtraEdges(eds => addEdge(
        { ...connection, id: edgeId, type: 'animated', style: { stroke: '#6366f1', strokeWidth: 2 } },
        eds
      ));
      // Notify parent so it can reorder profile sections based on the connection
      if (connection.source && connection.target) {
        onModuleConnect?.(connection.source, connection.target);
      }
    } else {
      store.onConnect(connection);
    }
  }, [rfExtraNodes, setRfExtraEdges, store, onModuleConnect, isValidConnection]);

  return (
    <NodeDependencyProvider nodes={allNodes} edges={allEdges}>
    <div
      ref={wrapperRef}
      className="w-full h-full"
      style={{
        background: 'radial-gradient(ellipse at 30% 30%, rgba(99,102,241,0.06) 0%, rgba(8,8,18,0.98) 60%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.04) 0%, transparent 50%), #08080e',
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={allNodes}
        edges={allEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onEdgeDoubleClick={onEdgeDoubleClick}
        isValidConnection={isValidConnection}
        deleteKeyCode={['Delete', 'Backspace']}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.2}
        maxZoom={2.5}
        connectionRadius={34}
        connectionLineStyle={{ stroke: '#818cf8', strokeWidth: 2.5 }}
        style={{ background: 'transparent' }}
        defaultEdgeOptions={{
          type: 'animated',
          style: { stroke: '#6366f1', strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={40}
          size={1}
          color="rgba(99,102,241,0.08)"
        />
        <Controls
          style={{
            background: 'rgba(8,8,18,0.92)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 10,
            boxShadow: '0 0 20px rgba(99,102,241,0.15)',
          }}
        />
        <MiniMap
          nodeColor={node => {
            if (node.type === 'profileModule') return (node.data as any)?.categoryColor ?? '#6366f1';
            if (!node.type) return '#6366f1';
            if (node.type.includes('Input')) return '#3b82f6';
            if (['profileUpdate', 'newsPublisher'].includes(node.type)) return '#10b981';
            return '#8b5cf6';
          }}
          style={{
            background: 'rgba(8,8,18,0.92)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 10,
            boxShadow: '0 0 20px rgba(99,102,241,0.15)',
          }}
          maskColor="rgba(4,4,12,0.75)"
        />
        {/* Fit View button */}
        <Panel position="bottom-right">
          <button
            onClick={() => fitView({ padding: 0.15, duration: 400 })}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 11, fontWeight: 700,
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.4)',
              color: '#a5b4fc',
              boxShadow: '0 0 12px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 12px rgba(99,102,241,0.25), inset 0 1px 0 rgba(255,255,255,0.06)')}
            title="Fit all nodes in view (F)"
          >
            ⤢ Fit View
          </button>
        </Panel>
        {/* Connection hint */}
        <Panel position="top-left">
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 9,
              color: 'rgba(148,163,184,0.5)',
              background: 'rgba(8,8,18,0.6)',
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(99,102,241,0.12)',
              backdropFilter: 'blur(8px)',
            }}
          >
            Drag handles to connect · Right-click for options · Double-click edge to disconnect · Del to remove · Snap: 20px grid
          </div>
        </Panel>
        {allNodes.length === 0 && (
          <Panel position="top-center">
            <div
              className="px-6 py-4 rounded-xl text-center pointer-events-none"
              style={{
                background: 'rgba(13,13,26,0.85)',
                border: '1px dashed rgba(99,102,241,0.4)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <p className="text-slate-400 text-sm">Drag nodes from the left panel onto the canvas</p>
              <p className="text-slate-500 text-xs mt-1">or right-click to add an AI node</p>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Context menu portal */}
      {ctxMenu && (
        <ContextMenu
          ctx={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onDisconnectNode={handleDisconnectNode}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onAddNode={handleAddNode}
          onFitView={() => fitView({ padding: 0.15, duration: 400 })}
          onAutoLayout={() => { onAutoLayout?.(); }}
        />
      )}
    </div>
    </NodeDependencyProvider>
  );
}
