/**
 * Boostify Hologram Live Show Engine — Backend Routes
 *
 * POST /api/hologram-show/leads          — Lead capture (public)
 * GET  /api/hologram-show/leads          — List leads (admin)
 * POST /api/hologram-show/generate-assets — Generate FAL demo images/videos & cache them
 * GET  /api/hologram-show/assets         — Retrieve cached FAL assets
 */
import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { authenticate } from '../middleware/auth';
import {
  sendHologramClientProposal,
  sendHologramAdminNotification,
} from '../services/hologram-email-service';

const router = Router();

const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const FAL_RUN_URL = 'https://fal.run';
const FAL_QUEUE_URL = 'https://queue.fal.run';
const FAL_IMAGE_ENDPOINT = 'fal-ai/flux-pro/kontext/text-to-image';
const FAL_VIDEO_ENDPOINT = 'fal-ai/kling-video/v3/pro/image-to-video';
const FAL_VIDEO_RESULT_ENDPOINT = 'fal-ai/kling-video';

// ─── Ensure tables exist (idempotent) ────────────────────────────────────────

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hologram_show_requests (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      email            TEXT NOT NULL,
      phone            TEXT,
      company_or_artist TEXT,
      client_type      TEXT,
      experience_type  TEXT,
      number_of_songs  INTEGER DEFAULT 1,
      has_avatar       BOOLEAN DEFAULT FALSE,
      needs_avatar_creation BOOLEAN DEFAULT FALSE,
      budget_range     TEXT,
      timeline         TEXT,
      message          TEXT,
      status           TEXT NOT NULL DEFAULT 'new',
      ip_address       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hologram_show_assets (
      id         SERIAL PRIMARY KEY,
      asset_key  TEXT NOT NULL UNIQUE,
      asset_type TEXT NOT NULL,  -- 'image' | 'video'
      url        TEXT NOT NULL,
      prompt     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Run table creation on module load
ensureTables().catch((e) => console.error('[HologramShow] Table init error:', e?.message));

// ─── FAL Queue helpers ────────────────────────────────────────────────────────

async function falSync(endpoint: string, input: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${FAL_RUN_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`FAL sync failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function falQueueSubmit(endpoint: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${FAL_QUEUE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`FAL submit failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json() as { request_id: string };
  return data.request_id;
}

async function falQueuePoll(endpoint: string, requestId: string, maxWaitMs = 90000): Promise<unknown> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 3000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 8000);

    const statusRes = await fetch(`${FAL_QUEUE_URL}/${endpoint}/requests/${requestId}/status`, {
      headers: { 'Authorization': `Key ${FAL_API_KEY}` },
    });
    const status = await statusRes.json() as { status: string };

    if (status.status === 'COMPLETED') {
      const resultRes = await fetch(`${FAL_QUEUE_URL}/${endpoint}/requests/${requestId}`, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` },
      });
      return resultRes.json();
    }
    if (status.status === 'FAILED') {
      throw new Error(`FAL job failed for ${endpoint}/${requestId}`);
    }
  }
  throw new Error(`FAL job timed out for ${endpoint}/${requestId}`);
}

// ─── Asset definitions ────────────────────────────────────────────────────────

const IMAGE_PROMPTS = [
  {
    key: 'hero_hologram_stage',
    prompt:
      'A music artist performing as a hologram on a massive futuristic concert stage, photorealistic, cinematic lighting, electric blue and orange volumetric light beams, crowd in silhouette, epic scale, 8K quality, wide angle shot',
  },
  {
    key: 'unreal_engine_virtual_stage',
    prompt:
      'Unreal Engine 5 render of a virtual concert stage with hyperrealistic particle effects, glowing neon orange and electric blue panels, floating LED screens showing abstract music waveforms, futuristic architecture, no people, showcase render',
  },
  {
    key: '3d_avatar_creation',
    prompt:
      'Close-up of a photorealistic 3D digital avatar of a music artist being constructed in holographic space, metallic blue lines forming the mesh wireframe overlaid on a realistic face, dark background, Boostify orange glow, technical and futuristic',
  },
  {
    key: 'festival_hologram_crowd',
    prompt:
      'Aerial view of a massive music festival with a giant holographic artist performing on stage, enormous crowd, spectacular light show with orange and electric blue lasers, smoke effects, night time, cinematic drone shot',
  },
  {
    key: 'virtual_stage_design',
    prompt:
      'Architectural visualization of a custom virtual concert stage featuring Boostify branding, orange accent lighting, massive LED video walls, layered lighting rigs, futuristic clean design, no people, product render style',
  },
  {
    key: 'catalog_revival_performance',
    prompt:
      'A legendary music icon hologram performing on stage decades after their prime, photorealistic, nostalgic yet futuristic, warm golden and orange haze, audience watching with emotion, cinematic portrait shot, respectful and inspirational',
  },
];

const VIDEO_PROMPTS = [
  {
    key: 'hologram_artist_performance',
    prompt: 'A holographic music artist performing live on stage, electric blue and orange volumetric light beams swirling around them, particles and energy effects, cinematic slow motion, professional concert cinematography',
    imageKey: 'hero_hologram_stage',
  },
  {
    key: 'virtual_stage_transformation',
    prompt: 'A virtual concert stage transforming from empty arena to full futuristic LED-lit spectacle, camera slowly panning across the stage as lights power on one by one, cinematic reveal shot',
    imageKey: 'unreal_engine_virtual_stage',
  },
  {
    key: 'avatar_in_motion',
    prompt: 'A photorealistic 3D digital avatar of a music artist moving and dancing, holographic particles emanating from their body, electric blue glow, smooth fluid motion, futuristic digital aesthetics',
    imageKey: '3d_avatar_creation',
  },
];

// ─── POST /leads — Lead capture ───────────────────────────────────────────────

router.post('/leads', async (req: Request, res: Response) => {
  try {
    const {
      name, email, phone, companyOrArtist, clientType, experienceType,
      numberOfSongs, hasAvatar, needsAvatarCreation, budgetRange, timeline, message,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'name and email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    await pool.query(
      `INSERT INTO hologram_show_requests
         (name, email, phone, company_or_artist, client_type, experience_type,
          number_of_songs, has_avatar, needs_avatar_creation, budget_range, timeline, message, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        name.trim(),
        email.toLowerCase().trim(),
        phone || null,
        companyOrArtist || null,
        clientType || null,
        experienceType || null,
        parseInt(String(numberOfSongs ?? 1), 10) || 1,
        hasAvatar === true || hasAvatar === 'true',
        needsAvatarCreation === true || needsAvatarCreation === 'true',
        budgetRange || null,
        timeline || null,
        message || null,
        req.ip || null,
      ]
    );

    // Fire emails non-blocking
    const leadData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || null,
      companyOrArtist: companyOrArtist || null,
      clientType: clientType || null,
      experienceType: experienceType || null,
      numberOfSongs: parseInt(String(numberOfSongs ?? 1), 10) || 1,
      hasAvatar: hasAvatar === true || hasAvatar === 'true',
      needsAvatarCreation: needsAvatarCreation === true || needsAvatarCreation === 'true',
      budgetRange: budgetRange || null,
      timeline: timeline || null,
      message: message || null,
    };

    sendHologramClientProposal(leadData).catch((e) =>
      console.warn('[HologramShow] Client proposal email failed:', e?.message)
    );
    sendHologramAdminNotification(leadData).catch((e) =>
      console.warn('[HologramShow] Admin notification email failed:', e?.message)
    );

    return res.json({ success: true, message: 'Your request has been received. Our team will contact you within 24 hours.' });
  } catch (err: any) {
    console.error('[HologramShow] Lead insert error:', err?.message);
    return res.status(500).json({ message: 'Failed to save request. Please try again.' });
  }
});

// ─── GET /leads — List leads (admin only) ─────────────────────────────────────

router.get('/leads', authenticate, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM hologram_show_requests ORDER BY created_at DESC LIMIT 200`
    );
    return res.json({ leads: rows });
  } catch (err: any) {
    console.error('[HologramShow] Leads list error:', err?.message);
    return res.status(500).json({ message: 'Failed to fetch leads' });
  }
});

// ─── POST /generate-assets — FAL image + video generation (admin) ─────────────

router.post('/generate-assets', authenticate, async (req: Request, res: Response) => {
  if (!FAL_API_KEY) {
    return res.status(503).json({ message: 'FAL_KEY not configured' });
  }

  const { type = 'images' } = req.body; // 'images' | 'videos' | 'all'

  res.json({
    success: true,
    message: `Asset generation started for type=${type}. Assets will be stored and available via GET /assets`,
  });

  // Run generation async (do not block response)
  (async () => {
    try {
      if (type === 'images' || type === 'all') {
        for (const imgDef of IMAGE_PROMPTS) {
          try {
            console.log(`[HologramShow] Generating image: ${imgDef.key}`);
            const result = await falSync(FAL_IMAGE_ENDPOINT, {
              prompt: imgDef.prompt,
              aspect_ratio: '16:9',
              image_size: 'landscape_16_9',
              num_images: 1,
              guidance_scale: 3.5,
              num_inference_steps: 28,
              output_format: 'jpeg',
              enable_safety_checker: true,
            });
            const url = (result as any)?.images?.[0]?.url;
            if (url) {
              await pool.query(
                `INSERT INTO hologram_show_assets (asset_key, asset_type, url, prompt)
                 VALUES ($1, 'image', $2, $3)
                 ON CONFLICT (asset_key) DO UPDATE SET url = EXCLUDED.url, created_at = NOW()`,
                [imgDef.key, url, imgDef.prompt]
              );
              console.log(`[HologramShow] ✅ Image stored: ${imgDef.key}`);
            }
          } catch (e: any) {
            console.error(`[HologramShow] Image generation failed for ${imgDef.key}:`, e?.message);
          }
        }
      }

      if (type === 'videos' || type === 'all') {
        for (const vidDef of VIDEO_PROMPTS) {
          try {
            // Look up the source image
            const { rows } = await pool.query(
              `SELECT url FROM hologram_show_assets WHERE asset_key = $1 LIMIT 1`,
              [vidDef.imageKey]
            );
            const imageUrl = rows[0]?.url;
            if (!imageUrl) {
              console.warn(`[HologramShow] No source image for video ${vidDef.key}, skipping.`);
              continue;
            }
            console.log(`[HologramShow] Generating video: ${vidDef.key}`);
            const requestId = await falQueueSubmit(FAL_VIDEO_ENDPOINT, {
              prompt: vidDef.prompt,
              image_url: imageUrl,
              duration: '3',
              aspect_ratio: '16:9',
            });
            const result = await falQueuePoll(FAL_VIDEO_RESULT_ENDPOINT, requestId, 240000) as any;
            const url = result?.video?.url;
            if (url) {
              await pool.query(
                `INSERT INTO hologram_show_assets (asset_key, asset_type, url, prompt)
                 VALUES ($1, 'video', $2, $3)
                 ON CONFLICT (asset_key) DO UPDATE SET url = EXCLUDED.url, created_at = NOW()`,
                [vidDef.key, url, vidDef.prompt]
              );
              console.log(`[HologramShow] ✅ Video stored: ${vidDef.key}`);
            }
          } catch (e: any) {
            console.error(`[HologramShow] Video generation failed for ${vidDef.key}:`, e?.message);
          }
        }
      }
      console.log('[HologramShow] Asset generation complete.');
    } catch (e: any) {
      console.error('[HologramShow] Asset generation error:', e?.message);
    }
  })();
});

// ─── GET /assets — Retrieve cached FAL assets ─────────────────────────────────

router.get('/assets', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT asset_key, asset_type, url FROM hologram_show_assets ORDER BY created_at ASC`
    );
    const assets: Record<string, { type: string; url: string }> = {};
    for (const row of rows) {
      assets[row.asset_key] = { type: row.asset_type, url: row.url };
    }
    return res.json({ assets });
  } catch (err: any) {
    console.error('[HologramShow] Assets fetch error:', err?.message);
    return res.json({ assets: {} }); // Fail gracefully — page uses CSS fallbacks
  }
});

export default router;
