/**
 * Content Moderation Route — Boostify Music Platform
 *
 * Uses the OpenAI Moderation API (omni-moderation-latest) to check all
 * user-generated content (posts, comments, profile text) in real-time.
 *
 * Architecture:
 *  - In-memory store (Map) for the moderation queue; zero schema migrations needed.
 *  - `moderateContent()` is exported and called directly from social-network.ts.
 *  - Admin webhook fires (fire-and-forget) to ADMIN_MODERATION_WEBHOOK_URL when
 *    content is flagged — set this env var to a Make/Zapier/Slack webhook URL.
 *
 * Routes (all under /api/admin/moderation):
 *  GET  /queue          — List flagged items (optional ?status= ?contentType= filter)
 *  GET  /stats          — Aggregate counts
 *  PATCH /queue/:id     — Set status to "approved" or "removed"
 *  DELETE /queue/:id    — Hard-remove entry from queue
 *
 * Routes (public, under /api/moderation):
 *  POST /check          — Check arbitrary text on demand
 */

import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentType = "post" | "comment" | "profile";
export type ModerationStatus = "pending" | "approved" | "removed";

export interface FlaggedItem {
  id: string;
  contentType: ContentType;
  contentId: string | number;
  authorId: string | number;
  authorName?: string;
  /** Truncated to 500 chars for storage safety */
  text: string;
  /** OpenAI category names that were flagged, e.g. ["hate", "violence/graphic"] */
  categories: string[];
  /** Full category score map */
  categoryScores: Record<string, number>;
  /** Highest score across all categories */
  maxScore: number;
  flaggedAt: number; // unix ms
  status: ModerationStatus;
  reviewedAt?: number;
  reviewedBy?: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────
// Persists for the lifetime of the process. For production persistence, swap this
// out for a DB table in social-network-schema.ts.

const moderationStore = new Map<string, FlaggedItem>();

// ─── Threshold ────────────────────────────────────────────────────────────────
// Flag content if OpenAI marks it as flagged OR any category score exceeds this.
const FLAG_THRESHOLD = 0.5;

// ─── Core moderation function (exported for use in social-network.ts) ─────────

/**
 * Sends `text` to the OpenAI Moderation API and stores a FlaggedItem if the
 * content exceeds the toxicity threshold.
 *
 * @returns `{ flagged: true, item }` when content is flagged, `{ flagged: false }` otherwise.
 */
export async function moderateContent(
  text: string,
  contentType: ContentType,
  contentId: string | number,
  authorId: string | number,
  authorName?: string,
): Promise<{ flagged: boolean; item?: FlaggedItem }> {
  if (!text?.trim()) return { flagged: false };

  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[content-moderation] No OPENAI_API_KEY — skipping moderation check");
    return { flagged: false };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const result = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });

    const r = result.results[0];
    if (!r) return { flagged: false };

    // Cast to string-keyed record (OpenAI SDK types are strict but runtime is dynamic)
    const cats = r.categories as unknown as Record<string, boolean>;
    const scores = r.category_scores as unknown as Record<string, number>;

    const flaggedCategories = Object.entries(cats)
      .filter(([, isFlagged]) => isFlagged)
      .map(([cat]) => cat);

    const allScores = Object.values(scores);
    const maxScore = allScores.length > 0 ? Math.max(...allScores) : 0;

    const shouldFlag = r.flagged || maxScore >= FLAG_THRESHOLD;
    if (!shouldFlag) return { flagged: false };

    const item: FlaggedItem = {
      id:             uuidv4(),
      contentType,
      contentId,
      authorId,
      authorName,
      text:           text.slice(0, 500),
      categories:     flaggedCategories.length > 0 ? flaggedCategories : ["high_score"],
      categoryScores: scores,
      maxScore,
      flaggedAt:      Date.now(),
      status:         "pending",
    };

    moderationStore.set(item.id, item);
    console.warn(`[content-moderation] 🚨 Flagged ${contentType} #${contentId} by user ${authorId} — categories: ${item.categories.join(", ")}`);

    // Fire admin webhook asynchronously (never blocks the response)
    sendAdminWebhook(item).catch((e) =>
      console.error("[content-moderation] Webhook delivery error:", e),
    );

    return { flagged: true, item };
  } catch (err: any) {
    // Don't block content creation if moderation API is unavailable
    console.error("[content-moderation] OpenAI API error:", err?.message ?? err);
    return { flagged: false };
  }
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

async function sendAdminWebhook(item: FlaggedItem): Promise<void> {
  const url = process.env.ADMIN_MODERATION_WEBHOOK_URL;
  if (!url) return;

  const payload = {
    event:     "content_flagged",
    timestamp: new Date().toISOString(),
    data: {
      id:          item.id,
      contentType: item.contentType,
      contentId:   item.contentId,
      authorId:    item.authorId,
      authorName:  item.authorName ?? "Unknown",
      excerpt:     item.text.slice(0, 120) + (item.text.length > 120 ? "…" : ""),
      categories:  item.categories,
      maxScore:    item.maxScore.toFixed(3),
      reviewUrl:   `${process.env.APP_URL ?? "https://boostify-music.app"}/admin?tab=moderation`,
    },
  };

  try {
    await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(5000),
    });
    console.log("[content-moderation] Admin webhook delivered");
  } catch (e) {
    console.error("[content-moderation] Webhook delivery failed:", e);
  }
}

// ─── Admin Routes ─────────────────────────────────────────────────────────────

/** GET /queue — list flagged items with optional filters */
router.get("/queue", (_req: Request, res: Response) => {
  const { status, contentType } = _req.query;

  let items = [...moderationStore.values()].sort((a, b) => b.flaggedAt - a.flaggedAt);

  if (status)      items = items.filter((i) => i.status === status);
  if (contentType) items = items.filter((i) => i.contentType === contentType);

  res.json({ items, total: items.length });
});

/** GET /stats — aggregate counts */
router.get("/stats", (_req: Request, res: Response) => {
  const all   = [...moderationStore.values()];
  const since = Date.now() - 86_400_000; // 24 h

  res.json({
    total:    all.length,
    pending:  all.filter((i) => i.status === "pending").length,
    approved: all.filter((i) => i.status === "approved").length,
    removed:  all.filter((i) => i.status === "removed").length,
    today:    all.filter((i) => i.flaggedAt >= since).length,
  });
});

/** PATCH /queue/:id — approve or remove a flagged item */
router.patch("/queue/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reviewedBy } = req.body as { status: ModerationStatus; reviewedBy?: string };

  if (!["approved", "removed"].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'removed'" });
  }

  const item = moderationStore.get(id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  item.status     = status;
  item.reviewedAt = Date.now();
  item.reviewedBy = reviewedBy ?? "admin";
  moderationStore.set(id, item);

  res.json(item);
});

/** DELETE /queue/:id — hard-remove from queue */
router.delete("/queue/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  if (!moderationStore.delete(id)) {
    return res.status(404).json({ error: "Item not found" });
  }
  res.json({ success: true });
});

// ─── Public check endpoint ────────────────────────────────────────────────────

/** POST /check — manually check arbitrary text (used by tests / future integrations) */
router.post("/check", async (req: Request, res: Response) => {
  const {
    text,
    contentType = "post",
    contentId   = "manual",
    authorId    = "unknown",
    authorName,
  } = req.body as {
    text: string;
    contentType?: ContentType;
    contentId?: string | number;
    authorId?: string | number;
    authorName?: string;
  };

  if (!text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  const result = await moderateContent(text, contentType, contentId, authorId, authorName);
  res.json(result);
});

export default router;
