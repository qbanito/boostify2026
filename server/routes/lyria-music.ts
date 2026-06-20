/**
 * Lyria 3 Music Generation Routes
 * POST /generate    — start music generation (returns requestId)
 * GET  /status/:id  — poll generation status
 * GET  /audio/:id   — serve locally saved audio files
 */
import { Router, Request, Response } from "express";
import { generateMusicWithLyria3, type Lyria3CompositionParams } from "../services/lyria3-service";
import path from "path";
import fs from "fs";

const router = Router();

// In-memory job cache
interface LyriaJob {
  status: "pending" | "processing" | "completed" | "failed";
  audioUrl?: string;
  lyrics?: string;
  error?: string;
  createdAt: number;
}
const jobs = new Map<string, LyriaJob>();

// Cleanup old jobs every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 30 * 60 * 1000);

/**
 * POST /api/music/lyria/generate
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt, duration, instrumental, genre, bpm, key, mood, customLyrics, language, useClipModel } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: "prompt is required" });
    }

    const requestId = `lyria_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Store job as processing
    jobs.set(requestId, { status: "processing", createdAt: Date.now() });

    console.log(`🎵 [Lyria3-Route] Starting generation: ${requestId}`);

    // Run generation asynchronously
    (async () => {
      try {
        const params: Lyria3CompositionParams = {
          instrumental: instrumental ?? false,
          genre,
          bpm,
          key,
          mood,
          customLyrics,
          language,
          useClipModel: useClipModel ?? false,
          durationHint: duration ? `${duration} seconds` : undefined,
        };

        const result = await generateMusicWithLyria3(prompt, params);

        if (result.success && (result.audioUrl || result.audioBase64)) {
          let audioUrl = result.audioUrl || "";

          // If audioUrl is a local file path (not http), serve via our endpoint
          if (audioUrl && !audioUrl.startsWith("http")) {
            const fileName = path.basename(audioUrl);
            audioUrl = `/api/music/lyria/audio/${fileName}`;
          }

          // If we only got base64, save locally and serve
          if (!audioUrl && result.audioBase64) {
            const os = await import("os");
            const fileName = `lyria3_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
            const filePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(filePath, Buffer.from(result.audioBase64, "base64"));
            audioUrl = `/api/music/lyria/audio/${fileName}`;
          }

          jobs.set(requestId, {
            status: "completed",
            audioUrl,
            lyrics: result.lyrics,
            createdAt: Date.now(),
          });
          console.log(`✅ [Lyria3-Route] Completed: ${requestId} → ${audioUrl}`);
        } else {
          jobs.set(requestId, {
            status: "failed",
            error: result.error || "Generation failed",
            createdAt: Date.now(),
          });
          console.error(`❌ [Lyria3-Route] Failed: ${requestId} — ${result.error}`);
        }
      } catch (err: any) {
        jobs.set(requestId, {
          status: "failed",
          error: err.message || "Unknown error",
          createdAt: Date.now(),
        });
        console.error(`❌ [Lyria3-Route] Error: ${requestId} — ${err.message}`);
      }
    })();

    // Return immediately with requestId for polling
    res.json({ success: true, requestId, message: "Music generation started" });
  } catch (error: any) {
    console.error("❌ [Lyria3-Route] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Unknown error" });
  }
});

/**
 * GET /api/music/lyria/status/:requestId
 */
router.get("/status/:requestId", (req: Request, res: Response) => {
  const { requestId } = req.params;
  const job = jobs.get(requestId);

  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }

  if (job.status === "completed") {
    res.json({
      success: true,
      status: "completed",
      audioUrl: job.audioUrl,
      lyrics: job.lyrics,
    });
  } else if (job.status === "failed") {
    res.json({
      success: false,
      status: "failed",
      error: job.error,
    });
  } else {
    res.json({
      success: true,
      status: job.status,
    });
  }
});

/**
 * GET /api/music/lyria/audio/:fileName
 * Serve locally saved audio files from temp directory
 */
router.get("/audio/:fileName", (req: Request, res: Response) => {
  const { fileName } = req.params;
  // Sanitize filename to prevent path traversal
  const sanitized = path.basename(fileName);
  if (sanitized !== fileName || !sanitized.match(/^lyria3_\d+_[a-z0-9]+\.(mp3|wav)$/)) {
    return res.status(400).json({ error: "Invalid filename" });
  }
  const os = require("os");
  const filePath = path.join(os.tmpdir(), sanitized);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Audio file not found" });
  }
  const ext = path.extname(sanitized).toLowerCase();
  res.setHeader("Content-Type", ext === ".wav" ? "audio/wav" : "audio/mpeg");
  res.setHeader("Content-Disposition", `inline; filename="${sanitized}"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
