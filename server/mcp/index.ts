// MCP (Model Context Protocol) Server for AI Agents
// This module provides structured context and tools for AI agents

import type { Express } from 'express';
import { log } from '../logger';

// Simple logger wrapper for MCP
const logger = {
  info: (message: string, ...args: any[]) => log(`[MCP] ${message} ${args.length ? JSON.stringify(args) : ''}`, 'mcp'),
  error: (message: string, ...args: any[]) => log(`[MCP ERROR] ${message} ${args.length ? JSON.stringify(args) : ''}`, 'mcp'),
};

// MCP Tool definitions for agents
export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required?: boolean;
  }>;
  handler: (params: Record<string, any>) => Promise<any>;
}

// MCP Context definition
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

// Agent-specific prompts with context injection
export interface AgentPrompt {
  systemPrompt: string;
  contextTemplate: string;
  exampleOutputs: string[];
}

// MCP Server class
export class MCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private contexts: Map<string, MCPContext> = new Map();
  
  constructor() {
    this.registerDefaultTools();
  }
  
  // Register default tools available to all agents
  private registerDefaultTools() {
    // Tool: Get Artist Info
    this.registerTool({
      name: 'get_artist_info',
      description: 'Retrieves detailed information about an artist including their style, genre, and recent activity',
      parameters: {
        artistId: {
          type: 'string',
          description: 'The unique identifier of the artist',
          required: true
        }
      },
      handler: async (params) => {
        const { artistId } = params;
        logger.info(`MCP: Fetching artist info for ${artistId}`);
        
        // This would connect to the database in production
        return {
          success: true,
          data: {
            id: artistId,
            name: 'Artist Name',
            genres: ['Pop', 'Electronic'],
            style: 'Modern, upbeat with electronic influences',
            monthlyListeners: 50000
          }
        };
      }
    });
    
    // Tool: Get Recent Songs
    this.registerTool({
      name: 'get_recent_songs',
      description: 'Gets the most recent songs created by an artist',
      parameters: {
        artistId: {
          type: 'string',
          description: 'The artist ID',
          required: true
        },
        limit: {
          type: 'number',
          description: 'Maximum number of songs to return',
          required: false
        }
      },
      handler: async (params) => {
        const { artistId, limit = 5 } = params;
        logger.info(`MCP: Fetching recent songs for ${artistId}, limit: ${limit}`);
        return {
          success: true,
          songs: []
        };
      }
    });
    
    // Tool: Analyze Style
    this.registerTool({
      name: 'analyze_style',
      description: 'Analyzes the artistic style based on previous work',
      parameters: {
        artistId: {
          type: 'string',
          description: 'The artist ID',
          required: true
        },
        contentType: {
          type: 'string',
          description: 'Type of content to analyze: music, visual, marketing',
          required: true
        }
      },
      handler: async (params) => {
        const { artistId, contentType } = params;
        logger.info(`MCP: Analyzing ${contentType} style for ${artistId}`);
        return {
          success: true,
          analysis: {
            dominantStyle: 'modern',
            colorPalette: ['#FF6B00', '#9333EA', '#3B82F6'],
            toneOfVoice: 'energetic and authentic',
            visualThemes: ['urban', 'night life', 'vibrant']
          }
        };
      }
    });
    
    // Tool: Get Market Trends
    this.registerTool({
      name: 'get_market_trends',
      description: 'Retrieves current market trends relevant to the artist',
      parameters: {
        genre: {
          type: 'string',
          description: 'Music genre to analyze',
          required: true
        },
        region: {
          type: 'string',
          description: 'Geographic region (optional)',
          required: false
        }
      },
      handler: async (params) => {
        const { genre, region = 'global' } = params;
        logger.info(`MCP: Fetching market trends for ${genre} in ${region}`);
        return {
          success: true,
          trends: {
            topGenres: [genre, 'Pop', 'Electronic'],
            emergingStyles: ['Lo-fi', 'Hyperpop'],
            platformGrowth: {
              tiktok: '+25%',
              instagram: '+12%',
              spotify: '+8%'
            }
          }
        };
      }
    });
  }
  
  // Register a new tool
  registerTool(tool: MCPTool) {
    this.tools.set(tool.name, tool);
    logger.info(`MCP: Registered tool "${tool.name}"`);
  }
  
  // Get all available tools
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }
  
  // Execute a tool
  async executeTool(toolName: string, params: Record<string, any>): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`);
    }
    
    logger.info(`MCP: Executing tool "${toolName}" with params:`, params);
    
    try {
      const result = await tool.handler(params);
      logger.info(`MCP: Tool "${toolName}" completed successfully`);
      return result;
    } catch (error) {
      logger.error(`MCP: Tool "${toolName}" failed:`, error);
      throw error;
    }
  }
  
  // Set context for a session
  setContext(sessionId: string, context: MCPContext) {
    this.contexts.set(sessionId, context);
    logger.info(`MCP: Context set for session ${sessionId}`);
  }
  
  // Get context for a session
  getContext(sessionId: string): MCPContext | undefined {
    return this.contexts.get(sessionId);
  }
  
  // Clear context for a session
  clearContext(sessionId: string) {
    this.contexts.delete(sessionId);
    logger.info(`MCP: Context cleared for session ${sessionId}`);
  }
  
  // Build enhanced system prompt with context
  buildEnhancedPrompt(basePrompt: string, context: MCPContext): string {
    const contextSection = `
## Artist Context
${context.artistName ? `- **Artist**: ${context.artistName}` : ''}
${context.artistGenre?.length ? `- **Genres**: ${context.artistGenre.join(', ')}` : ''}
${context.artistStyle ? `- **Style**: ${context.artistStyle}` : ''}
${context.socialStats ? `
- **Social Stats**:
  - Instagram: ${context.socialStats.instagram || 'N/A'} followers
  - Spotify: ${context.socialStats.spotify || 'N/A'} monthly listeners
  - YouTube: ${context.socialStats.youtube || 'N/A'} subscribers
` : ''}
${context.recentSongs?.length ? `
- **Recent Songs**: ${context.recentSongs.map(s => s.title).join(', ')}
` : ''}

## Available Tools
You have access to the following tools:
${Array.from(this.tools.values()).map(t => `- **${t.name}**: ${t.description}`).join('\n')}
`;
    
    return `${basePrompt}\n\n${contextSection}`;
  }
}

// Singleton instance
export const mcpServer = new MCPServer();

// Express routes for MCP API
export function registerMCPRoutes(app: Express) {
  // Get available tools
  app.get('/api/mcp/tools', (req, res) => {
    const tools = mcpServer.getTools().map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));
    res.json({ tools });
  });
  
  // Execute a tool
  app.post('/api/mcp/execute', async (req, res) => {
    try {
      const { toolName, params } = req.body;
      
      if (!toolName) {
        return res.status(400).json({ error: 'Tool name is required' });
      }
      
      const result = await mcpServer.executeTool(toolName, params || {});
      res.json(result);
    } catch (error: any) {
      logger.error('MCP execute error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Set session context
  app.post('/api/mcp/context/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const context = req.body as MCPContext;
      
      mcpServer.setContext(sessionId, context);
      res.json({ success: true, sessionId });
    } catch (error: any) {
      logger.error('MCP context error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get session context
  app.get('/api/mcp/context/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const context = mcpServer.getContext(sessionId);
    
    if (!context) {
      return res.status(404).json({ error: 'Context not found' });
    }
    
    res.json(context);
  });
  
  // Build enhanced prompt
  app.post('/api/mcp/enhance-prompt', (req, res) => {
    try {
      const { basePrompt, context } = req.body;
      
      if (!basePrompt) {
        return res.status(400).json({ error: 'Base prompt is required' });
      }
      
      const enhancedPrompt = mcpServer.buildEnhancedPrompt(basePrompt, context || {});
      res.json({ enhancedPrompt });
    } catch (error: any) {
      logger.error('MCP enhance prompt error:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  logger.info('MCP routes registered');
}

export default mcpServer;
