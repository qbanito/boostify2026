/**
 * Dynamic UI Style System — API Routes
 * 
 * Endpoints:
 *   GET  /api/ui-style/preferences     — Get user's style preferences
 *   PUT  /api/ui-style/preferences     — Save user's style preferences
 *   GET  /api/ui-style/default-preset  — Get admin's platform default preset
 *   PUT  /api/ui-style/default-preset  — Admin: set platform default preset
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { users, platformConfig } from "../../db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// Allowed preset IDs (validated server-side)
const VALID_PRESETS = ["default", "minimal", "vibrant", "neon", "earth", "monochrome", "moon"];

// ─── GET /preferences — fetch user's UI preferences ───
router.get("/preferences", async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) {
      return res.json({ success: true, data: null }); // not logged in = use default
    }

    const [user] = await db
      .select({ uiPreferences: users.uiPreferences })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    res.json({ success: true, data: user?.uiPreferences ?? null });
  } catch (error: any) {
    console.error("[ui-style] Error fetching preferences:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch preferences" });
  }
});

// ─── PUT /preferences — save user's UI preferences ───
router.put("/preferences", async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const { activePreset, autoAdapt } = req.body;

    // Validate preset ID
    if (activePreset && !VALID_PRESETS.includes(activePreset)) {
      return res.status(400).json({ success: false, error: "Invalid preset ID" });
    }

    const prefs = {
      activePreset: activePreset ?? "default",
      autoAdapt: autoAdapt ?? false,
    };

    await db
      .update(users)
      .set({ uiPreferences: prefs, updatedAt: new Date() })
      .where(eq(users.clerkId, clerkId));

    res.json({ success: true, data: prefs });
  } catch (error: any) {
    console.error("[ui-style] Error saving preferences:", error.message);
    res.status(500).json({ success: false, error: "Failed to save preferences" });
  }
});

// ─── GET /default-preset — fetch platform default preset (public) ───
router.get("/default-preset", async (_req: Request, res: Response) => {
  try {
    const [config] = await db
      .select({ value: platformConfig.value })
      .from(platformConfig)
      .where(eq(platformConfig.key, "default_style_preset"))
      .limit(1);

    const preset = (config?.value as any)?.preset ?? "default";
    res.json({ success: true, data: { preset } });
  } catch (error: any) {
    console.error("[ui-style] Error fetching default preset:", error.message);
    // Fallback to "default" if table doesn't exist yet
    res.json({ success: true, data: { preset: "default" } });
  }
});

// ─── PUT /default-preset — admin sets platform default preset ───
router.put("/default-preset", async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    // Check admin status
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    const ADMIN_EMAILS = ["convoycubano@gmail.com", "info@boostifymusic.com"];
    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      return res.status(403).json({ success: false, error: "Admin access required" });
    }

    const { preset } = req.body;
    if (!preset || !VALID_PRESETS.includes(preset)) {
      return res.status(400).json({ success: false, error: "Invalid preset ID" });
    }

    // Upsert the config row
    const existing = await db
      .select({ id: platformConfig.id })
      .from(platformConfig)
      .where(eq(platformConfig.key, "default_style_preset"))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(platformConfig)
        .set({ value: { preset }, updatedAt: new Date(), updatedBy: user.id })
        .where(eq(platformConfig.key, "default_style_preset"));
    } else {
      await db.insert(platformConfig).values({
        key: "default_style_preset",
        value: { preset },
        updatedBy: user.id,
      });
    }

    res.json({ success: true, data: { preset } });
  } catch (error: any) {
    console.error("[ui-style] Error setting default preset:", error.message);
    res.status(500).json({ success: false, error: "Failed to set default preset" });
  }
});

export default router;
