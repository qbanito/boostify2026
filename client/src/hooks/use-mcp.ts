// Hook para integración con MCP (Model Context Protocol) Server
import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
}

// MCP Context
export interface MCPContext {
  artistId?: string;
  artistName?: string;
  artistGenre?: string[];
  artistStyle?: string;
  recentSongs?: Array<{ title: string; genre: string }>;
  recentVideos?: Array<{ title: string; style: string }>;
  socialStats?: {
    instagram?: number;
    spotify?: number;
    youtube?: number;
  };
  preferences?: Record<string, any>;
}

// Tool execution result
export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Hook para interactuar con el servidor MCP
 */
export function useMCP() {
  const [currentContext, setCurrentContext] = useState<MCPContext | null>(null);

  // Obtener herramientas disponibles
  const { 
    data: tools, 
    isLoading: isLoadingTools,
    error: toolsError 
  } = useQuery({
    queryKey: ['mcp-tools'],
    queryFn: async () => {
      const response = await fetch('/api/mcp/tools');
      if (!response.ok) {
        throw new Error('Failed to fetch MCP tools');
      }
      const data = await response.json();
      return data.tools as MCPTool[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Ejecutar herramienta
  const executeToolMutation = useMutation({
    mutationFn: async ({ 
      toolName, 
      params 
    }: { 
      toolName: string; 
      params: Record<string, any>;
    }) => {
      const response = await fetch('/api/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, params }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute tool');
      }

      return response.json() as Promise<MCPToolResult>;
    },
  });

  // Ejecutar herramienta
  const executeTool = useCallback(
    async (toolName: string, params: Record<string, any> = {}) => {
      return executeToolMutation.mutateAsync({ toolName, params });
    },
    [executeToolMutation]
  );

  // Establecer contexto de sesión
  const setContextMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      context 
    }: { 
      sessionId: string; 
      context: MCPContext;
    }) => {
      const response = await fetch(`/api/mcp/context/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });

      if (!response.ok) {
        throw new Error('Failed to set context');
      }

      setCurrentContext(context);
      return response.json();
    },
  });

  // Establecer contexto
  const setContext = useCallback(
    async (sessionId: string, context: MCPContext) => {
      return setContextMutation.mutateAsync({ sessionId, context });
    },
    [setContextMutation]
  );

  // Mejorar prompt con contexto
  const enhancePromptMutation = useMutation({
    mutationFn: async ({ 
      basePrompt, 
      context 
    }: { 
      basePrompt: string; 
      context: MCPContext;
    }) => {
      const response = await fetch('/api/mcp/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePrompt, context }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance prompt');
      }

      const data = await response.json();
      return data.enhancedPrompt as string;
    },
  });

  // Mejorar prompt
  const enhancePrompt = useCallback(
    async (basePrompt: string, context: MCPContext) => {
      return enhancePromptMutation.mutateAsync({ basePrompt, context });
    },
    [enhancePromptMutation]
  );

  // Construir contexto desde artista
  const buildContextFromArtist = useCallback((artist: any): MCPContext => {
    return {
      artistId: artist.id,
      artistName: artist.name || artist.artistName,
      artistGenre: artist.genres || (artist.genre ? [artist.genre] : []),
      artistStyle: artist.style || artist.artistStyle || '',
      recentSongs: artist.songs?.slice(0, 5).map((s: any) => ({
        title: s.title,
        genre: s.genre || artist.genre,
      })) || [],
      socialStats: {
        instagram: artist.socialStats?.instagram || artist.instagramFollowers,
        spotify: artist.socialStats?.spotify || artist.spotifyMonthlyListeners,
        youtube: artist.socialStats?.youtube || artist.youtubeSubscribers,
      },
      preferences: artist.preferences || {},
    };
  }, []);

  return {
    // Tools
    tools: tools || [],
    isLoadingTools,
    toolsError,

    // Tool execution
    executeTool,
    isExecutingTool: executeToolMutation.isPending,
    toolResult: executeToolMutation.data,
    toolError: executeToolMutation.error,

    // Context management
    currentContext,
    setContext,
    isSettingContext: setContextMutation.isPending,

    // Prompt enhancement
    enhancePrompt,
    isEnhancingPrompt: enhancePromptMutation.isPending,

    // Utilities
    buildContextFromArtist,
  };
}

/**
 * Hook para usar herramientas específicas de agentes
 */
export function useAgentTools(agentType: string) {
  const { tools, executeTool, isExecutingTool } = useMCP();

  // Mapeo de herramientas sugeridas por tipo de agente
  const suggestedToolsByAgent: Record<string, string[]> = {
    'composer': ['get_artist_info', 'get_recent_songs', 'analyze_style'],
    'video-director': ['analyze_style', 'get_market_trends', 'get_artist_info'],
    'marketing': ['get_market_trends', 'analyze_style', 'get_artist_info'],
    'social-media': ['get_market_trends', 'analyze_style'],
    'photographer': ['analyze_style', 'get_artist_info'],
    'merchandise': ['analyze_style', 'get_market_trends'],
    'manager': ['get_market_trends', 'get_artist_info', 'analyze_style'],
  };

  // Filtrar herramientas relevantes para este agente
  const suggestedToolNames = suggestedToolsByAgent[agentType] || [];
  const relevantTools = tools.filter(t => suggestedToolNames.includes(t.name));

  // Ejecutar herramienta del agente
  const runTool = useCallback(
    async (toolName: string, params: Record<string, any>) => {
      if (!suggestedToolNames.includes(toolName)) {
        console.warn(`Tool ${toolName} is not suggested for ${agentType} agent`);
      }
      return executeTool(toolName, params);
    },
    [executeTool, suggestedToolNames, agentType]
  );

  return {
    tools: relevantTools,
    allTools: tools,
    runTool,
    isRunning: isExecutingTool,
  };
}

export default useMCP;
