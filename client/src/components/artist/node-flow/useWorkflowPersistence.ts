/**
 * BOOSTIFY — useWorkflowPersistence
 * Handles save / load of AI canvas workflows to/from the server.
 * - Loads workflow from GET /api/node-workflow/:artistId on mount
 * - Exposes manual saveWorkflow(nodes, edges) function
 * - Debounced auto-save (3s after last change)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';

interface WorkflowData {
  nodes: Node[];
  edges: Edge[];
  savedAt?: string;
}

interface UseWorkflowPersistenceReturn {
  loadWorkflow: () => Promise<WorkflowData | null>;
  saveWorkflow: (nodes: Node[], edges: Edge[]) => Promise<void>;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
}

export function useWorkflowPersistence(artistId: number | null | undefined): UseWorkflowPersistenceReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkflow = useCallback(async (): Promise<WorkflowData | null> => {
    if (!artistId) return null;
    try {
      const resp = await fetch(`/api/node-workflow/${artistId}`);
      if (!resp.ok) {
        if (resp.status === 404) return null; // no workflow yet
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json() as WorkflowData;
      if (data.savedAt) setLastSaved(new Date(data.savedAt));
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useWorkflowPersistence] load error:', msg);
      return null;
    }
  }, [artistId]);

  const saveWorkflow = useCallback(async (nodes: Node[], edges: Edge[]): Promise<void> => {
    if (!artistId) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload: WorkflowData = { nodes, edges, savedAt: new Date().toISOString() };
      const resp = await fetch(`/api/node-workflow/${artistId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      setLastSaved(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('[useWorkflowPersistence] save error:', msg);
    } finally {
      setIsSaving(false);
    }
  }, [artistId]);

  /**
   * Debounced auto-save. Call this whenever nodes/edges change in AI mode.
   * Usage: persistence.scheduleSave(nodes, edges)
   * (returned as part of the hook via the debounced wrapper below)
   */
  const scheduleSave = useCallback((nodes: Node[], edges: Edge[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveWorkflow(nodes, edges);
    }, 3000);
  }, [saveWorkflow]);

  // Expose scheduleSave as a stable ref so callers can attach to onNodesChange etc.
  (saveWorkflow as any).__scheduleSave = scheduleSave;

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { loadWorkflow, saveWorkflow, isSaving, lastSaved, error };
}

/**
 * Convenience function to get the debounced variant from the hook return value.
 * Usage:
 *   const persistence = useWorkflowPersistence(artistId);
 *   const scheduleSave = getScheduledSave(persistence.saveWorkflow);
 */
export function getScheduledSave(saveWorkflow: UseWorkflowPersistenceReturn['saveWorkflow']) {
  return (saveWorkflow as any).__scheduleSave as (nodes: Node[], edges: Edge[]) => void;
}
