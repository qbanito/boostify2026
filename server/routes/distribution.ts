/**
 * Distribution API Routes
 * Full CRUD for releases, tracks, partners, DSPs, royalties, and module audit
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { partnerOutreachLog, distributionPartners, users } from "../db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import {
  seedDistributionPartners,
  getPartners, getPartnerById, updatePartner,
  getDSPs,
  createRelease, getUserReleases, getReleaseById, updateRelease, deleteRelease,
  addTrackToRelease, getReleaseTracks, removeTrackFromRelease,
  submitRelease, approveRelease,
  getReleaseSubmissions, updateSubmissionStatus,
  getUserRoyalties, getUserRoyaltySummary, addRoyaltyTransaction,
  getDistributionDashboard, getModuleAudit,
  sendPartnerOutreach, generatePartnershipEmail,
  getPartnerOutreachPackage, getResearchedPartnerProfiles,
  getUserSongs, getAvailableSongs, quickDistributeSong,
  addSongToRelease, getReleaseWithSongs,
  getInfrastructurePlan, getMissingModuleGenerationPlans, getLaunchReadiness,
} from "../services/distribution-orchestrator";

const router = Router();

// ============================================================================
// SEED — Initialize partners & DSPs
// ============================================================================

router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const result = await seedDistributionPartners();
    res.json({ success: true, seeded: result });
  } catch (error: any) {
    console.error("Distribution seed error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DASHBOARD — Aggregated stats
// ============================================================================

router.get("/dashboard/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
    const dashboard = await getDistributionDashboard(userId);
    res.json({ success: true, data: dashboard });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MODULE AUDIT
// ============================================================================

router.get("/audit", async (_req: Request, res: Response) => {
  try {
    const audit = await getModuleAudit();
    res.json({ success: true, modules: audit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PARTNERS
// ============================================================================

router.get("/partners", async (_req: Request, res: Response) => {
  try {
    const partners = await getPartners();
    res.json({ success: true, partners });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/partners/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const partner = await getPartnerById(id);
    if (!partner) return res.status(404).json({ success: false, error: "Partner not found" });
    res.json({ success: true, partner });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/partners/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await updatePartner(id, req.body);
    res.json({ success: true, partner: updated[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/partners/:id/outreach", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const messageType = (req.body?.messageType === "follow_up") ? "follow_up" : "full";
    const result = await sendPartnerOutreach(id, messageType as "full" | "follow_up");
    // Log the event
    try {
      const partner = await getPartnerById(id);
      const userId = await resolveUserPgId(req);
      await db.insert(partnerOutreachLog).values({
        partnerId: id,
        userId: userId ?? null,
        direction: "outbound",
        channel: "email",
        messageType: messageType === "follow_up" ? "template_follow_up" : "template_full",
        subject: messageType === "follow_up" ? "Follow-up template" : "Partnership template",
        body: null,
        recipientEmail: partner?.contactEmail ?? null,
        status: result.success ? "sent" : "failed",
        metadata: result.success ? null : { error: result.message },
      });
    } catch { /* logging is best-effort */ }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/partners/:id/email-preview", async (req: Request, res: Response) => {
  try {
    const partner = await getPartnerById(parseInt(req.params.id));
    if (!partner) return res.status(404).json({ success: false, error: "Partner not found" });
    const email = generatePartnershipEmail(partner.name, partner.slug);
    res.json({ success: true, email });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Full outreach package — all 7 formats
router.get("/partners/:id/outreach-package", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const pkg = await getPartnerOutreachPackage(id);
    if (!pkg) return res.status(404).json({ success: false, error: "Partner not found" });
    res.json({ success: true, outreach: pkg });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Researched partner profiles with B2B paths, API docs, fit notes, priority scores
router.get("/partner-profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = getResearchedPartnerProfiles();
    res.json({ success: true, profiles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// PARTNER COMMUNICATION — outreach log + custom messages + notes
// ───────────────────────────────────────────────────────────────────────────

async function resolveUserPgId(req: Request): Promise<number | null> {
  const clerkId = (req as any).auth?.userId || (req as any).user?.clerkUserId;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  const rawId = (req as any).user?.id;
  if (rawId == null) return null;
  const num = Number(rawId);
  if (!isNaN(num) && num > 0) return num;
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id || null;
}

// List conversation/outreach log for a partner
router.get("/partners/:id/outreach-log", async (req: Request, res: Response) => {
  try {
    const partnerId = parseInt(req.params.id);
    if (isNaN(partnerId)) return res.status(400).json({ success: false, error: "Invalid partner id" });
    const rows = await db.select().from(partnerOutreachLog)
      .where(eq(partnerOutreachLog.partnerId, partnerId))
      .orderBy(desc(partnerOutreachLog.createdAt));
    res.json({ success: true, log: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Append a manual note / event to the outreach log (e.g. "called, left voicemail")
router.post("/partners/:id/outreach-log", async (req: Request, res: Response) => {
  try {
    const partnerId = parseInt(req.params.id);
    if (isNaN(partnerId)) return res.status(400).json({ success: false, error: "Invalid partner id" });
    const userId = await resolveUserPgId(req);
    const {
      direction = "note",
      channel = "internal",
      messageType,
      subject,
      body,
      recipientEmail,
      status = "logged",
      metadata,
    } = req.body || {};

    const [row] = await db.insert(partnerOutreachLog).values({
      partnerId,
      userId: userId ?? null,
      direction,
      channel,
      messageType: messageType ?? null,
      subject: subject ?? null,
      body: body ?? null,
      recipientEmail: recipientEmail ?? null,
      status,
      metadata: metadata ?? null,
    }).returning();

    res.json({ success: true, entry: row });
  } catch (error: any) {
    console.error("Outreach log create error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a log entry
router.delete("/partners/:id/outreach-log/:entryId", async (req: Request, res: Response) => {
  try {
    const entryId = parseInt(req.params.entryId);
    const partnerId = parseInt(req.params.id);
    await db.delete(partnerOutreachLog)
      .where(and(eq(partnerOutreachLog.id, entryId), eq(partnerOutreachLog.partnerId, partnerId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send a custom (user-authored) outreach message via Brevo and log it
router.post("/partners/:id/custom-message", async (req: Request, res: Response) => {
  try {
    const partnerId = parseInt(req.params.id);
    if (isNaN(partnerId)) return res.status(400).json({ success: false, error: "Invalid partner id" });

    const partner = await getPartnerById(partnerId);
    if (!partner) return res.status(404).json({ success: false, error: "Partner not found" });

    const userId = await resolveUserPgId(req);
    const { subject, body, recipientEmail, channel = "email" } = req.body || {};
    if (!subject || !body) return res.status(400).json({ success: false, error: "subject and body are required" });

    const toEmail = recipientEmail || partner.contactEmail;
    let sendStatus: "sent" | "failed" = "sent";
    let sendError: string | undefined;

    if (channel === "email") {
      if (!toEmail) return res.status(400).json({ success: false, error: "No recipient email" });
      if (!process.env.BREVO_API_KEY) {
        sendStatus = "failed";
        sendError = "BREVO_API_KEY not configured";
      } else {
        try {
          const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
              "api-key": process.env.BREVO_API_KEY,
            },
            body: JSON.stringify({
              sender: { name: "Boostify Music", email: "info@boostifymusic.com" },
              to: [{ email: toEmail, name: partner.name }],
              subject,
              htmlContent: body,
            }),
          });
          if (!resp.ok) {
            sendStatus = "failed";
            sendError = await resp.text();
          }
        } catch (e: any) {
          sendStatus = "failed";
          sendError = e.message;
        }
      }
    } else {
      // Non-email channels (linkedin, phone, form): just log, do not send
      sendStatus = "sent";
    }

    const [entry] = await db.insert(partnerOutreachLog).values({
      partnerId,
      userId: userId ?? null,
      direction: "outbound",
      channel,
      messageType: "custom",
      subject,
      body,
      recipientEmail: toEmail ?? null,
      status: sendStatus,
      metadata: sendError ? { error: sendError } : null,
    }).returning();

    if (sendStatus === "sent" && channel === "email") {
      await updatePartner(partnerId, {
        outreachStatus: partner.outreachStatus === "not_contacted" ? "email_sent" : partner.outreachStatus,
        lastContactedAt: new Date(),
      });
    }

    res.json({
      success: sendStatus === "sent",
      entry,
      error: sendError,
    });
  } catch (error: any) {
    console.error("Custom message error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update the free-form notes on a partner (persistent CRM-style notes)
router.patch("/partners/:id/notes", async (req: Request, res: Response) => {
  try {
    const partnerId = parseInt(req.params.id);
    const { notes } = req.body || {};
    const updated = await updatePartner(partnerId, { notes: notes ?? null });
    res.json({ success: true, partner: updated[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update outreach status manually (e.g. mark as replied / meeting_scheduled)
router.patch("/partners/:id/outreach-status", async (req: Request, res: Response) => {
  try {
    const partnerId = parseInt(req.params.id);
    const { outreachStatus } = req.body || {};
    const allowed = ["not_contacted", "email_sent", "replied", "meeting_scheduled", "contract_review", "signed"];
    if (!allowed.includes(outreachStatus)) {
      return res.status(400).json({ success: false, error: "Invalid outreachStatus" });
    }
    const updated = await updatePartner(partnerId, { outreachStatus });
    // Log the status change
    await db.insert(partnerOutreachLog).values({
      partnerId,
      userId: (await resolveUserPgId(req)) ?? null,
      direction: "note",
      channel: "internal",
      messageType: "status_change",
      subject: `Status changed to ${outreachStatus}`,
      body: null,
      status: "logged",
    });
    res.json({ success: true, partner: updated[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DSPs
// ============================================================================

router.get("/dsps", async (_req: Request, res: Response) => {
  try {
    const dsps = await getDSPs();
    res.json({ success: true, dsps });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// RELEASES
// ============================================================================

router.get("/releases/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
    const releases = await getUserReleases(userId);
    res.json({ success: true, releases });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/releases", async (req: Request, res: Response) => {
  try {
    const release = await createRelease(req.body);
    res.json({ success: true, release });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/releases/detail/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const release = await getReleaseById(id);
    if (!release) return res.status(404).json({ success: false, error: "Release not found" });
    const tracks = await getReleaseTracks(id);
    const submissions = await getReleaseSubmissions(id);
    res.json({ success: true, release, tracks, submissions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/releases/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await updateRelease(id, req.body);
    res.json({ success: true, release: updated[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/releases/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await deleteRelease(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/releases/:id/submit", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await submitRelease(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/releases/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = await approveRelease(id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// TRACKS
// ============================================================================

router.post("/tracks", async (req: Request, res: Response) => {
  try {
    const track = await addTrackToRelease(req.body);
    res.json({ success: true, track });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/tracks/:releaseId", async (req: Request, res: Response) => {
  try {
    const releaseId = parseInt(req.params.releaseId);
    const tracks = await getReleaseTracks(releaseId);
    res.json({ success: true, tracks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/tracks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await removeTrackFromRelease(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SUBMISSIONS
// ============================================================================

router.get("/submissions/:releaseId", async (req: Request, res: Response) => {
  try {
    const releaseId = parseInt(req.params.releaseId);
    const submissions = await getReleaseSubmissions(releaseId);
    res.json({ success: true, submissions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/submissions/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status, externalUrl, rejectionReason } = req.body;
    const updated = await updateSubmissionStatus(id, status, { externalUrl, rejectionReason });
    res.json({ success: true, submission: updated[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ROYALTIES
// ============================================================================

router.get("/royalties/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const royalties = await getUserRoyalties(userId);
    const summary = await getUserRoyaltySummary(userId);
    res.json({ success: true, royalties, summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/royalties", async (req: Request, res: Response) => {
  try {
    const tx = await addRoyaltyTransaction(req.body);
    res.json({ success: true, transaction: tx });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SONGS — Artist's existing songs connected to distribution
// ============================================================================

/** Get all songs for the artist */
router.get("/songs/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
    const songs = await getUserSongs(userId);
    res.json({ success: true, songs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get available songs (not yet in any release) */
router.get("/songs/:userId/available", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
    const songs = await getAvailableSongs(userId);
    res.json({ success: true, songs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Quick-distribute: create a release from a single song */
router.post("/songs/:songId/quick-distribute", async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.songId);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const result = await quickDistributeSong(userId, songId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Add a song to an existing release */
router.post("/releases/:releaseId/add-song", async (req: Request, res: Response) => {
  try {
    const releaseId = parseInt(req.params.releaseId);
    const { songId, trackNumber } = req.body;
    if (!songId) return res.status(400).json({ error: "songId is required" });
    const result = await addSongToRelease(releaseId, parseInt(songId), trackNumber);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get a release with full song details */
router.get("/releases/full/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const release = await getReleaseWithSongs(id);
    if (!release) return res.status(404).json({ success: false, error: "Release not found" });
    res.json({ success: true, release });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// INFRASTRUCTURE PLAN (Section F)
// ============================================================================

router.get("/infrastructure", async (_req: Request, res: Response) => {
  try {
    const plan = await getInfrastructurePlan();
    res.json({ success: true, plan });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MISSING MODULE GENERATION (Section G)
// ============================================================================

router.get("/missing-modules", async (_req: Request, res: Response) => {
  try {
    const plans = await getMissingModuleGenerationPlans();
    res.json({ success: true, modules: plans });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// LAUNCH READINESS (Section H)
// ============================================================================

router.get("/launch-readiness", async (_req: Request, res: Response) => {
  try {
    const readiness = await getLaunchReadiness();
    res.json({ success: true, readiness });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
