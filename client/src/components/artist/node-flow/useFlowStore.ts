/**
 * BOOSTIFY ARTIST NODE FLOW — Zustand Store
 * Central state: nodes, edges, execution state, outputs
 */

import { create } from 'zustand';
import {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Connection,
} from '@xyflow/react';

// ─── Node execution state ───────────────────────────────────────────────────

export type NodeStatus = 'idle' | 'running' | 'done' | 'error';

export interface NodeFlowData extends Record<string, unknown> {
  label?: string;
  // Input config (set by user)
  artistId?: number;
  artistSlug?: string;
  songId?: number;
  // Runtime state
  status?: NodeStatus;
  output?: Record<string, unknown>;
  error?: string;
}

// ─── Store types ────────────────────────────────────────────────────────────

interface FlowStore {
  nodes: Node<NodeFlowData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  artistId: number | null;
  artistSlug: string | null;

  // React Flow callbacks
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  // Node selection
  selectNode: (id: string | null) => void;

  // Node management
  setNodes: (nodes: Node<NodeFlowData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: Node<NodeFlowData>) => void;
  updateNodeData: (id: string, patch: Partial<NodeFlowData>) => void;

  // Execution state
  setNodeStatus: (id: string, status: NodeStatus, output?: Record<string, unknown>, error?: string) => void;
  setIsRunning: (v: boolean) => void;
  resetExecution: () => void;

  // Context
  setArtistContext: (artistId: number, artistSlug: string) => void;

  // Flow management
  clearFlow: () => void;
  loadPreset: (preset: { nodes: Node<NodeFlowData>[]; edges: Edge[] }) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function patchNodeData(
  nodes: Node<NodeFlowData>[],
  id: string,
  patch: Partial<NodeFlowData>
): Node<NodeFlowData>[] {
  return nodes.map(n =>
    n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
  );
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useFlowStore = create<FlowStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isRunning: false,
  artistId: null,
  artistSlug: null,

  onNodesChange: changes =>
    set(s => ({ nodes: applyNodeChanges(changes, s.nodes) as Node<NodeFlowData>[] })),

  onEdgesChange: changes =>
    set(s => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: connection =>
    set(s => ({
      edges: addEdge(
        { ...connection, id: `store-edge-${Date.now()}`, type: 'animated', style: { stroke: '#6366f1', strokeWidth: 2 } },
        s.edges
      ),
    })),

  selectNode: id => set({ selectedNodeId: id }),

  setNodes: nodes => set({ nodes }),
  setEdges: edges => set({ edges }),

  addNode: node =>
    set(s => ({ nodes: [...s.nodes, node] })),

  updateNodeData: (id, patch) =>
    set(s => ({ nodes: patchNodeData(s.nodes, id, patch) })),

  setNodeStatus: (id, status, output, error) =>
    set(s => ({
      nodes: patchNodeData(s.nodes, id, { status, output: output ?? {}, error }),
    })),

  setIsRunning: v => set({ isRunning: v }),

  resetExecution: () =>
    set(s => ({
      nodes: s.nodes.map(n => ({
        ...n,
        data: { ...n.data, status: 'idle' as NodeStatus, output: {}, error: undefined },
      })),
      isRunning: false,
    })),

  setArtistContext: (artistId, artistSlug) => set({ artistId, artistSlug }),

  clearFlow: () => set({ nodes: [], edges: [], selectedNodeId: null }),

  loadPreset: ({ nodes, edges }) => {
    const { artistId, artistSlug } = get();
    const hydratedNodes = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        artistId: artistId ?? undefined,
        artistSlug: artistSlug ?? undefined,
        status: 'idle' as NodeStatus,
        output: {},
      },
    }));
    set({ nodes: hydratedNodes, edges, selectedNodeId: null });
  },
}));
