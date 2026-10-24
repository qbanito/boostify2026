/**
 * Lyria 3 Music Generation Routes
 * POST /generate    — start music generation (returns requestId)
 * GET  /status/:id  — poll generation status
 * GET  /audio/:id   — serve locally saved audio files
 */
import { Router, Request, Response } from "express";
import { generateMusicWithLyria3, isLyriaConfigured, type Lyria3CompositionParams } from "../services/lyria3-service";
import { isAuthenticated, getUserId } from "../middleware/clerk-auth";
import { db, FieldValue } from "../firebase";
import path from "path";
import fs from "fs";

const router = Router();

const JOBS = "music_generation_jobs";

/**
 * POST /api/music/lyria/generate
 */
router.post("/generate", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: "Sign in to generate music." });
    const { prompt, duration, instrumental, genre, bpm, key, mood, customLyrics, language, useClipModel } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 5000) {
      return res.status(400).json({ success: false, error: "Enter a prompt up to 5,000 characters." });
    }
    if (!isLyriaConfigured()) {
      return res.status(503).json({ success: false, error: "Google music generation is not configured." });
    }

    const requestId = `lyria_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const jobRef = db.collection(JOBS).doc(requestId);
    await jobRef.set({
      userId,
      provider: useClipModel ? "lyria-3-clip-preview" : "lyria-3.5",
      status: "processing",
      prompt: prompt.trim(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

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

        await jobRef.set({
          userId,
            status: "completed",
          provider: result.provider,
            audioUrl,
            lyrics: result.lyrics,
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
          console.log(`✅ [Lyria3-Route] Completed: ${requestId} → ${audioUrl}`);
        } else {
          await jobRef.set({
            userId,
            status: "failed",
            error: result.error || "Generation failed",
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          console.error(`❌ [Lyria3-Route] Failed: ${requestId} — ${result.error}`);
        }
      } catch (err: any) {
        await jobRef.set({
          userId,
          status: "failed",
          error: err.message || "Unknown error",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
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
router.get("/status/:requestId", isAuthenticated, async (req: Request, res: Response) => {
  const { requestId } = req.params;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ success: false, error: "Sign in to view this generation." });
  const snapshot = await db.collection(JOBS).doc(requestId).get();
  const job: any = snapshot.exists ? snapshot.data() : null;

  if (!job) {
    return res.status(404).json({ success: false, error: "Job not found" });
  }
  if (job.userId !== userId) return res.status(403).json({ success: false, error: "This generation belongs to another account." });

  if (job.status === "completed") {
    res.json({
      success: true,
      status: "completed",
      audioUrl: job.audioUrl,
      lyrics: job.lyrics,
      provider: job.provider,
    });
  } else if (job.status === "failed") {
    res.json({
      success: false,
      status: "failed",
      error: job.error,
      provider: job.provider,
    });
  } else {
    res.json({
      success: true,
      status: job.status,
      provider: job.provider,
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
