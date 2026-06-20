/**
 * API Route: /api/agents-sdk
 * OpenAI Agents SDK chat endpoint for Boostify Music.
 * Isolated from existing agent system — no shared state.
 */
import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth";
import { runAgentChat, type ChatInput, type StreamEvent } from "../agents-sdk";
import { z } from "zod";

const router = Router();
router.use(authenticate);

const agentCategories = [
  "music_production",
  "marketing_strategy",
  "social_media",
  "merch_design",
  "career_advice",
  "video_creation",
  "general_question",
] as const;

const chatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  conversationHistory: z.array(z.any()).max(60).optional(),
  artistId: z.number().optional(),
  agentOverride: z.enum(agentCategories).optional(),
});

/**
 * POST /api/agents-sdk/chat
 * Main conversational endpoint. Classifies → routes → responds.
 */
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { message, conversationHistory, artistId, agentOverride } =
      parsed.data;

    const input: ChatInput = {
      message,
      conversationHistory,
      artistId,
      agentOverride,
    };

    const start = Date.now();
    const result = await runAgentChat(input);
    const elapsed = Date.now() - start;

    console.log(
      `[agents-sdk] user=${userId} agent=${result.classification} time=${elapsed}ms`
    );

    return res.json({
      response: result.response,
      agentUsed: result.agentUsed,
      classification: result.classification,
      conversationHistory: result.conversationHistory,
      toolCalls: result.toolCalls,
    });
  } catch (error: any) {
    console.error("[agents-sdk] Chat error:", error?.message || error);
    const isTimeout = error?.message?.includes("timed out");
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? "Agent response timed out" : "Agent processing failed",
      message: error?.message ?? "Unknown error",
    });
  }
});

/**
 * POST /api/agents-sdk/chat/stream
 * SSE streaming endpoint. Sends real-time status updates during agent pipeline.
 */
router.post("/chat/stream", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { message, conversationHistory, artistId, agentOverride } =
      parsed.data;

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const sendSSE = (event: StreamEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const input: ChatInput = {
      message,
      conversationHistory,
      artistId,
      agentOverride,
    };

    const start = Date.now();

    const result = await runAgentChat(input, sendSSE);
    const elapsed = Date.now() - start;

    console.log(
      `[agents-sdk/stream] user=${userId} agent=${result.classification} time=${elapsed}ms`
    );

    // Send final done event with full response
    sendSSE({
      type: "done",
      data: {
        response: result.response,
        agentUsed: result.agentUsed,
        classification: result.classification,
        conversationHistory: result.conversationHistory,
        toolCalls: result.toolCalls,
      },
    });

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("[agents-sdk/stream] Error:", error?.message || error);
    const isTimeout = error?.message?.includes("timed out");
    // If headers already sent, send error as SSE event
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: isTimeout ? "Agent response timed out" : error?.message ?? "Unknown error",
        })}\n\n`
      );
      res.end();
    } else {
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? "Agent response timed out" : "Agent processing failed",
        message: error?.message ?? "Unknown error",
      });
    }
  }
});

/**
 * GET /api/agents-sdk/agents
 * List available agents and their descriptions.
 */
router.get("/agents", (_req: Request, res: Response) => {
  res.json({
    agents: [
      { id: "music_production", name: "Music Producer", icon: "music", description: "Create songs, lyrics, beats, chord progressions" },
      { id: "marketing_strategy", name: "Marketing Strategist", icon: "chart", description: "Launch plans, campaigns, audience growth" },
      { id: "social_media", name: "Social Media Manager", icon: "users", description: "Content strategy, posting, engagement" },
      { id: "merch_design", name: "Merch Designer", icon: "shopping", description: "Merchandise ideas, collections, pricing" },
      { id: "career_advice", name: "Career Manager", icon: "briefcase", description: "Industry advice, contracts, career planning" },
      { id: "video_creation", name: "Video Director", icon: "video", description: "Music video concepts, storyboards, visuals" },
      { id: "general_question", name: "Assistant", icon: "help", description: "General platform help and guidance" },
    ],
  });
});

export default router;
