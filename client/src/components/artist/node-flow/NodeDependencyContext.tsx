/**
 * BOOSTIFY NODE FLOW — NodeDependencyContext
 * Computes in real-time, for every node on the canvas, which required/optional
 * upstream nodes are connected vs. missing — based on the live edges state.
 *
 * Usage (inside any React Flow node component):
 *   const dep = useNodeDependency(nodeId);
 *   dep.missing   → InputRequirement[] not yet connected
 *   dep.met       → InputRequirement[] already connected
 *   dep.isReady   → all required inputs are met
 */

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { Node, Edge } from '@xyflow/react';
import { NODE_SCHEMA, InputRequirement } from './NODE_SCHEMA';

// ─── Context types ────────────────────────────────────────────────────────────

export interface NodeDependencyState {
  /** All declared input requirements for this node type */
  required: InputRequirement[];
  /** Which required/optional inputs ARE connected */
  met: InputRequirement[];
  /** Which inputs are NOT yet connected */
  missing: InputRequirement[];
  /** True when every `required: true` input is connected */
  isReady: boolean;
  /** Source node types that are currently wired into this node */
  connectedSourceTypes: string[];
}

type DependencyMap = Record<string, NodeDependencyState>;

// ─── Context ─────────────────────────────────────────────────────────────────

const NodeDependencyContext = createContext<DependencyMap>({});

// ─── Provider ─────────────────────────────────────────────────────────────────

interface Props {
  nodes: Node[];
  edges: Edge[];
  children: ReactNode;
}

export function NodeDependencyProvider({ nodes, edges, children }: Props) {
  // Build a nodeId → nodeType lookup
  const nodeTypeById = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    nodes.forEach(n => { if (n.type) map[n.id] = n.type; });
    return map;
  }, [nodes]);

  // Build a nodeId → Set<sourceNodeTypes> lookup from current edges
  const connectedTypesById = useMemo<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {};
    edges.forEach(e => {
      const sourceType = nodeTypeById[e.source];
      if (!sourceType) return;
      if (!map[e.target]) map[e.target] = new Set();
      map[e.target].add(sourceType);
    });
    return map;
  }, [edges, nodeTypeById]);

  // Compute the full dependency map
  const depMap = useMemo<DependencyMap>(() => {
    const result: DependencyMap = {};
    nodes.forEach(node => {
      const schema = NODE_SCHEMA[node.type ?? ''];
      if (!schema) return; // profileModule / profileRoot → no schema, skip

      const connectedTypes = connectedTypesById[node.id] ?? new Set<string>();
      const connectedSourceTypes = Array.from(connectedTypes);

      const met: InputRequirement[] = [];
      const missing: InputRequirement[] = [];

      schema.inputs.forEach(req => {
        if (connectedTypes.has(req.nodeType)) {
          met.push(req);
        } else {
          missing.push(req);
        }
      });

      const isReady = schema.inputs
        .filter(r => r.required)
        .every(r => connectedTypes.has(r.nodeType));

      result[node.id] = {
        required: schema.inputs,
        met,
        missing,
        isReady,
        connectedSourceTypes,
      };
    });
    return result;
  }, [nodes, connectedTypesById]);

  return (
    <NodeDependencyContext.Provider value={depMap}>
      {children}
    </NodeDependencyContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Returns the dependency state for a specific node ID. */
export function useNodeDependency(nodeId: string): NodeDependencyState | null {
  const map = useContext(NodeDependencyContext);
  return map[nodeId] ?? null;
}
