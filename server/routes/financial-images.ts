/**
 * Boostify · Financial Enablement — AI Image Generation + Cache
 *
 * Generates marketing visuals for the /financial page using
 * FAL.ai Flux Pro Kontext (text-to-image) — highest quality photorealistic.
 * Caches permanent Firebase Storage URLs so subsequent page loads are instant.
 *
 * Endpoints:
 *   GET  /api/financial-enablement/images
 *        Returns cached URLs (or empty if not generated yet).
 *
 *   POST /api/financial-enablement/images/generate
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
const CACHE_FILE = path.join(CACHE_DIR, "financial-images-cache.json");

// ---------- Image slot definitions ----------
type Slot =
  | "hero_mobile"
  | "showcase_create"
  | "showcase_structure"
  | "showcase_scale"
  | "banner_concert"
  | "calculator_visual"
  | "testimonial_marcus"
  | "testimonial_sofia"
  | "testimonial_damien";

interface SlotDef {
  id: Slot;
  prompt: string;
  aspectRatio: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '3:2' | '2:3';
}

const SLOTS: SlotDef[] = [
  {
    id: "hero_mobile",
    prompt:
      "Cinematic editorial photograph of a young independent music artist in a modern home studio at golden hour. Warm orange and amber ambient light. The artist sits confidently at a desk with a MacBook, studio monitors, and an audio interface. Shallow depth of field, ultra-realistic, 35mm film look, premium magazine quality, deep blacks and warm orange highlights. No text, no watermarks.",
    aspectRatio: "16:9",
  },
  {
    id: "showcase_create",
    prompt:
      "Cinematic concert photograph of a charismatic Black artist performing on stage with a wireless mic, dramatic warm orange and amber stage lighting, rising theatrical smoke, audience silhouettes cheering in the foreground, lens flare, ultra-realistic professional concert photography, high contrast, 35mm film grain. No text.",
    aspectRatio: "4:3",
  },
  {
    id: "showcase_structure",
    prompt:
      "Premium editorial flat-lay photograph of a sleek modern workspace: open MacBook showing colorful revenue charts with orange highlights, a fountain pen, a leather notebook with financial notes, espresso cup, minimal gold accessories. Soft diffused daylight, Scandinavian minimalism, ultra-realistic, magazine quality, shallow depth of field. No legible text.",
    aspectRatio: "4:3",
  },
  {
    id: "showcase_scale",
    prompt:
      "Cinematic abstract photograph of a glowing orange upward arrow rising above a dark city skyline at dusk. Light trails from traffic below, bokeh of golden city lights, dramatic volumetric fog, futuristic premium feel, ultra-realistic CG-photo hybrid, deep blacks with warm orange and amber highlights, cinematic color grade. No text, no logos.",
    aspectRatio: "4:3",
  },
  {
    id: "banner_concert",
    prompt:
      "Wide cinematic panoramic photograph of an enormous sold-out concert arena at night. Thousands of hands raised in the crowd, warm orange and amber stage lights flooding the venue, dramatic atmospheric haze, multiple light beams cutting through smoke, confetti falling, awe-inspiring scale. Ultra-realistic professional concert photography, high dynamic range, deep blacks and warm orange highlights. No text.",
    aspectRatio: "21:9",
  },
  {
    id: "calculator_visual",
    prompt:
      "Stunning 3D rendered illustration of a glowing translucent orange holographic financial dashboard floating in dark space. Floating revenue charts with rising curves, rotating coin stacks, upward growth arrows, digital pie charts — all in warm orange and amber gradient tones. Soft volumetric light, ultra-clean modern fintech aesthetic, premium dark background. No text, no numbers.",
    aspectRatio: "4:3",
  },
  {
    id: "testimonial_marcus",
    prompt:
      "Professional editorial portrait of a confident young Black male hip-hop artist in his late 20s. Wearing a clean minimal streetwear outfit. Warm studio lighting with a subtle orange rim light on a dark gradient background. Neutral expression, direct gaze into camera. Premium magazine quality, ultra-realistic, sharp focus on eyes, shallow depth of field. No text.",
    aspectRatio: "1:1",
  },
  {
    id: "testimonial_sofia",
    prompt:
      "Professional editorial portrait of a confident Asian female music producer in her late 20s. Natural wavy hair, minimal stylish jewelry. Warm studio lighting with a subtle orange rim light on a dark gradient background. Soft confident smile, direct gaze. Premium magazine quality, ultra-realistic, sharp focus on eyes, shallow depth of field. No text.",
    aspectRatio: "1:1",
  },
  {
    id: "testimonial_damien",
    prompt:
      "Professional editorial portrait of a confident Black male singer-songwriter in his early 30s, holding an acoustic guitar casually. Warm cinematic lighting with an orange rim light on a dark moody background. Relaxed expression, direct gaze. Premium magazine quality, ultra-realistic, sharp focus on eyes, shallow depth of field. No text.",
    aspectRatio: "1:1",
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

/** GET /api/financial-enablement/images
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

/** POST /api/financial-enablement/images/generate
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
          outputFolder: 'financial-images',
        });
        if (result.success && result.imageUrl) {
          cache[slot.id] = {
            url: result.imageUrl,
            generatedAt: new Date().toISOString(),
          };
          await writeCache(cache); // persist after each success
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
