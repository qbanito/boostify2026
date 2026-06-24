/**
 * Investor Room API Routes
 * -------------------------------------------------------------------------
 * Public endpoints powering the interactive pitch-deck module:
 *  - POST /api/investor-room/chat    → talk to the trained investor agent
 *  - POST /api/investor-room/submit  → register viewpoints, email owner + investor
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { investorFeedback } from "../../db/schema";
import {
  chatWithInvestorAgent,
  sendInvestorFeedbackEmails,
  type InvestorChatMessage,
} from "../services/investor-room-agent";

const router = Router();

// ── Lightweight in-memory rate limiter (per IP) ──────────────────────────────
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= max) return false;
  rec.count++;
  return true;
}
// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
}, 5 * 60 * 1000).unref?.();

function clientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── POST /chat — one conversation turn ──────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const ip = clientIp(req);
    if (!rateLimit(ip, 40, 60 * 1000)) {
      return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
    }

    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "messages array required" });
    }

    const cleaned: InvestorChatMessage[] = messages
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    if (cleaned.length === 0) {
      return res.status(400).json({ success: false, error: "No valid messages" });
    }

    const result = await chatWithInvestorAgent(cleaned);
    if (!result.success) return res.status(502).json({ success: false, error: result.error });
    return res.json({ success: true, reply: result.reply });
  } catch (error: any) {
    console.error("[InvestorRoom] /chat error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to process message" });
  }
});

// ─── POST /submit — register viewpoints + send emails ────────────────────────
router.post("/submit", async (req: Request, res: Response) => {
  try {
    const ip = clientIp(req);
    if (!rateLimit(ip, 6, 60 * 60 * 1000)) {
      return res.status(429).json({ success: false, error: "Submission limit reached. Please try again later." });
    }

    const { name, email, company, investorType, interestLevel, viewpoints, transcript } = req.body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ success: false, error: "A valid name is required" });
    }
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: "A valid email is required" });
    }
    if (!viewpoints || typeof viewpoints !== "string" || viewpoints.trim().length < 5) {
      return res.status(400).json({ success: false, error: "Please share your point of view" });
    }

    const allowedType = ["individual", "corporate", "institutional", "other"];
    const allowedInterest = ["low", "medium", "high"];
    const safeType = allowedType.includes(investorType) ? investorType : "individual";
    const safeInterest = allowedInterest.includes(interestLevel) ? interestLevel : "medium";

    const safeTranscript: InvestorChatMessage[] = Array.isArray(transcript)
      ? transcript
          .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-30)
          .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      : [];

    const payload = {
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      company: company ? String(company).trim().slice(0, 200) : undefined,
      investorType: safeType,
      interestLevel: safeInterest,
      viewpoints: viewpoints.trim().slice(0, 8000),
      transcript: safeTranscript,
    };

    // Send emails (owner copy + investor acknowledgement)
    const emailResult = await sendInvestorFeedbackEmails(payload);

    // Persist
    try {
      await db.insert(investorFeedback).values({
        name: payload.name,
        email: payload.email,
        company: payload.company,
        investorType: payload.investorType as any,
        interestLevel: payload.interestLevel as any,
        viewpoints: payload.viewpoints,
        chatTranscript: payload.transcript,
        emailedOwner: emailResult.ownerSent,
        emailedInvestor: emailResult.investorSent,
        ip,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500),
      });
    } catch (dbErr: any) {
      console.error("[InvestorRoom] persist error:", dbErr?.message || dbErr);
    }

    return res.json({
      success: true,
      message: "Your perspective has been received.",
      emailed: emailResult.investorSent,
    });
  } catch (error: any) {
    console.error("[InvestorRoom] /submit error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to submit" });
  }
});

export default router;
