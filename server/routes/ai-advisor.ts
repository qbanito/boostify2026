/**
 * AI Advisor Chat API Routes
 * Handles chat requests between users and AI advisors
 */
import { Router, Request, Response } from 'express';
import { getAdvisorChatResponse, isValidAdvisorId, type ArtistData } from '../services/ai-advisor-service';

const router = Router();

interface ChatRequestBody {
  advisorId: string;
  artistId?: number;
  artistData?: ArtistData | null;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * POST /api/ai-advisor/chat
 * Send a message to an AI advisor and get a response
 */
router.post('/chat', async (req: Request<{}, {}, ChatRequestBody>, res: Response) => {
  try {
    const { advisorId, artistId, artistData, messages } = req.body;

    // Validate request
    if (!advisorId) {
      return res.status(400).json({
        success: false,
        error: 'advisorId is required',
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages array is required and must not be empty',
      });
    }

    // Validate advisor ID
    if (!isValidAdvisorId(advisorId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid advisor ID',
      });
    }

    // Validate messages format
    const validRoles = ['system', 'user', 'assistant'];
    for (const msg of messages) {
      if (!msg.role || !validRoles.includes(msg.role)) {
        return res.status(400).json({
          success: false,
          error: 'Each message must have a valid role (system, user, or assistant)',
        });
      }
      if (typeof msg.content !== 'string' || !msg.content.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Each message must have non-empty content',
        });
      }
    }

    // Get response from AI advisor
    const response = await getAdvisorChatResponse({
      advisorId,
      messages,
      userId: (req as any).auth?.userId || undefined,
      artistId,
      artistData,
    });

    return res.json({
      success: true,
      message: response.message,
      usage: response.usage,
    });

  } catch (error: any) {
    console.error('AI Advisor chat error:', error);

    // Handle specific error types
    if (error.message?.includes('timeout')) {
      return res.status(504).json({
        success: false,
        error: 'Request timed out. Please try again.',
      });
    }

    if (error.message?.includes('API key')) {
      return res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to get advisor response',
    });
  }
});

/**
 * GET /api/ai-advisor/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'AI Advisor service is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
