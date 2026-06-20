/**
 * useAgentExecution — Hook for calling the enhanced agent execution API
 * Handles the request lifecycle: loading, results with tool actions, errors
 */
import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import type { ToolResultData } from "@/components/ai/action-cards";

export interface AgentExecutionResponse {
  sessionId: number;
  text: string;
  toolResults: ToolResultData[];
  tokensUsed: number;
  model: string;
  hasActions: boolean;
}

interface UseAgentExecutionOptions {
  agentType: string;
  artistId?: number;
  artistName?: string;
}

export function useAgentExecution({ agentType, artistId, artistName }: UseAgentExecutionOptions) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentExecutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (prompt: string, sessionId?: number) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiRequest('/api/agents/execute', {
        method: 'POST',
        data: {
          agentType,
          prompt,
          artistId,
          artistName,
          sessionId,
        },
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      setResult(data);
      return data as AgentExecutionResponse;
    } catch (err: any) {
      const msg = err?.message || 'Error executing agent';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [agentType, artistId, artistName]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    execute,
    loading,
    result,
    error,
    reset,
    hasToolResults: (result?.toolResults?.length || 0) > 0,
  };
}
