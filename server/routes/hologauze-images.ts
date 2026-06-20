/**
 * Boostify · Hologauze Live Concert System — AI Image Generation + Cache
 *
 * Generates premium cinematic marketing visuals for the HologauzeConcertSection
 * using FAL.ai Flux Pro Kontext (text-to-image).
 * Caches permanent Firebase Storage URLs so subsequent page loads are instant.
 *
 * Endpoints:
 *   GET  /api/hologauze/images
 *        Returns cached URLs (or empty if not generated yet).
 *
 *   POST /api/hologauze/images/generate
 *        Triggers generation for all (or a subset of) slots.
 *        Use ?force=1 to regenerate already-cached slots.
 */

import { Router, type Request, type Response } from "express";
import fs from "fs/promises";
import path from "path";
import { generateImageWithFluxKontextPro } from "../services/fal-service";

const router = Router();

// ---------- Cache location ----------
const CACHE_DIR = path.join(process.cwd(), "server", "data");
const CACHE_FILE = path.join(CACHE_DIR, "hologauze-images-cache.json");

// ---------- Image slot definitions ----------
type Slot =
  | "hero_concert"
  | "control_dashboard"
  | "tech_pipeline"
  | "stage_setup"
  | "premium_venue"
  | "control_room";

interface SlotDef {
  id: Slot;
  prompt: string;
  aspectRatio: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "3:2" | "2:3";
}

const SLOTS: SlotDef[] = [
  {
    id: "hero_concert",
    prompt:
      "Create a cinematic premium live concert scene showing a virtual artist projected through a transparent Hologauze screen on a large indoor stage. The artist appears life-size as a realistic holographic stage illusion, standing in front of a deep black background with subtle orange accent lighting. The scene includes a transparent holographic gauze screen suspended on stage, professional projection atmosphere, audience silhouettes in the foreground, high-end music technology, dark gray and black color palette, metallic stage details, realistic concert photography style, dramatic atmospheric haze, volumetric light beams. Ultra-realistic, cinematic, premium, 16:9 aspect ratio. No text, no logos.",
    aspectRatio: "16:9",
  },
  {
    id: "control_dashboard",
    prompt:
      "Create a futuristic dark-mode software dashboard interface for a live holographic concert control system. The interface shows a virtual artist preview panel, a setlist timeline with song cards, projection output status indicators, audio waveform synchronization, motion capture status, scene trigger buttons, an emergency stop control, and Hologauze screen alignment grid. Premium SaaS interface design, black and graphite gray background, subtle orange accent highlights on active controls, clean modern UI with thin borders, high-end live show control system aesthetic. No text visible, no logos, 16:9 aspect ratio.",
    aspectRatio: "16:9",
  },
  {
    id: "tech_pipeline",
    prompt:
      "Create a cinematic technical visualization of a live holographic concert production pipeline. Show a glowing 3D virtual artist figure in a digital preparation stage, connected via luminous data streams to motion capture sensors, a show timeline interface, a projection rendering server, a high-power laser projector, a transparent Hologauze screen, and a live audience silhouette. Futuristic but professional production environment, deep black background, orange and graphite gray Boostify color palette, flowing light paths connecting each stage, realistic production technology aesthetic, high detail, cinematic composition. No text, no logos, 16:9.",
    aspectRatio: "16:9",
  },
  {
    id: "stage_setup",
    prompt:
      "Create a professional stage setup photograph for a Hologauze holographic concert. A large transparent gauze mesh screen is suspended across a premium indoor stage, a powerful high-lumen projector beam is precisely aligned toward the screen, and a virtual artist appears on the gauze as a realistic live performer silhouette. The venue is dark and premium, with subtle orange and amber stage lighting, black and metallic gray stage design, realistic professional concert equipment in the background, dramatic shadows, high production value atmosphere. Ultra-realistic, no text, no logos, 16:9 aspect ratio.",
    aspectRatio: "16:9",
  },
  {
    id: "premium_venue",
    prompt:
      "Create a luxury indoor concert venue photograph with a Hologauze-powered virtual artist holographic concert. A lifelike holographic performer appears on a large stage through a transparent gauze screen, in front of a seated audience in an elegant premium venue with curved architecture, dark premium interior with soft ambient lighting, subtle orange and graphite accent tones, immersive entertainment atmosphere, realistic volumetric projection effect, high-end production quality, cinematic depth of field. Realistic, no text, no logos, 16:9 aspect ratio.",
    aspectRatio: "16:9",
  },
  {
    id: "control_room",
    prompt:
      "Create a cinematic backstage production control room for a live holographic concert. Professional operators work at a large curved desk monitoring multiple widescreen displays showing a virtual artist stage preview, a show setlist timeline, Hologauze projection feed alignment, live audio waveforms, motion capture data streams, and stage camera feeds. Dark professional environment, warm orange and amber interface accent lighting, premium live event technology, realistic workstation equipment, cinematic depth, high detail, atmospheric glow from screens. No text, no logos, 16:9 aspect ratio.",
    aspectRatio: "16:9",
  },
];

// ---------- Cache helpers ----------
type Cache = Partial<Record<Slot, { url: string; generatedAt: string }>>;

async function readCache(): Promise<Cache> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as Cache;
  } catch {
    return {};
  }
}

async function writeCache(cache: Cache): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

// ---------- Routes ----------

/** GET /api/hologauze/images
 *  Returns cached URLs map. Missing slots are simply absent from the map.
 */
router.get("/images", async (_req: Request, res: Response) => {
  try {
    const cache = await readCache();
    const images: Record<string, string> = {};
    for (const [k, v] of Object.entries(cache)) {
      if (v?.url) images[k] = v.url;
    }
    res.json({ success: true, images, slots: SLOTS.map((s) => s.id) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/hologauze/images/generate
 *  Body: { slots?: Slot[], force?: boolean }
 *  Query: ?force=1
 */
router.post("/images/generate", async (req: Request, res: Response) => {
  try {
    if (!process.env.FAL_API_KEY) {
      return res.status(400).json({
        success: false,
        error: "FAL_API_KEY is not configured on the server.",
      });
    }

    const force = req.query.force === "1" || req.body?.force === true;
    const requested: Slot[] | undefined = Array.isArray(req.body?.slots)
      ? (req.body.slots as Slot[])
      : undefined;

    const cache = await readCache();
    const targets = SLOTS.filter((s) => {
      if (requested && !requested.includes(s.id)) return false;
      if (!force && cache[s.id]?.url) return false;
      return true;
    });

    const results: Array<{ slot: Slot; url?: string; error?: string }> = [];

    // Sequential generation to avoid rate limits
    for (const slot of targets) {
      try {
        const result = await generateImageWithFluxKontextPro(slot.prompt, {
          aspectRatio: slot.aspectRatio,
          outputFolder: "hologauze-images",
        });
        if (result.success && result.imageUrl) {
          cache[slot.id] = {
            url: result.imageUrl,
            generatedAt: new Date().toISOString(),
          };
          await writeCache(cache);
          results.push({ slot: slot.id, url: result.imageUrl });
        } else {
          results.push({
            slot: slot.id,
            error: result.error || "unknown generation failure",
          });
        }
      } catch (err: any) {
        results.push({ slot: slot.id, error: err.message });
      }
    }

    const images: Record<string, string> = {};
    for (const [k, v] of Object.entries(cache)) {
      if (v?.url) images[k] = v.url;
    }

    res.json({
      success: true,
      generated: results.filter((r) => r.url).length,
      failed: results.filter((r) => r.error).length,
      results,
      images,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
