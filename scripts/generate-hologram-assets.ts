import 'dotenv/config';
import { pool } from '../db/index';

type AssetDef = {
  key: string;
  prompt: string;
  imageKey?: string;
};

const FAL_KEYS = Array.from(new Set([
  process.env.FAL_KEY,
  process.env.FAL_API_KEY,
  process.env.FAL_KEY_BACKUP,
  process.env.FAL_API_KEY_BACKUP,
].filter(Boolean))) as string[];

const IMAGE_ENDPOINT = 'https://fal.run/fal-ai/flux-pro/kontext/text-to-image';
const VIDEO_ENDPOINT = 'https://queue.fal.run/fal-ai/kling-video/v3/pro/image-to-video';
const VIDEO_RESULT_ENDPOINT = 'https://queue.fal.run/fal-ai/kling-video';

const IMAGE_PROMPTS: AssetDef[] = [
  {
    key: 'hero_hologram_stage',
    prompt: 'A music artist performing as a hologram on a massive futuristic concert stage, photorealistic, cinematic lighting, electric blue and orange volumetric light beams, crowd in silhouette, epic scale, 8K quality, wide angle shot',
  },
  {
    key: 'unreal_engine_virtual_stage',
    prompt: 'Unreal Engine 5 render of a virtual concert stage with hyperrealistic particle effects, glowing neon orange and electric blue panels, floating LED screens showing abstract music waveforms, futuristic architecture, no people, showcase render',
  },
  {
    key: '3d_avatar_creation',
    prompt: 'Close-up of a photorealistic 3D digital avatar of a music artist being constructed in holographic space, metallic blue lines forming the mesh wireframe overlaid on a realistic face, dark background, Boostify orange glow, technical and futuristic',
  },
  {
    key: 'festival_hologram_crowd',
    prompt: 'Aerial view of a massive music festival with a giant holographic artist performing on stage, enormous crowd, spectacular light show with orange and electric blue lasers, smoke effects, night time, cinematic drone shot',
  },
  {
    key: 'virtual_stage_design',
    prompt: 'Architectural visualization of a custom virtual concert stage featuring Boostify branding, orange accent lighting, massive LED video walls, layered lighting rigs, futuristic clean design, no people, product render style',
  },
  {
    key: 'catalog_revival_performance',
    prompt: 'A legendary music icon hologram performing on stage decades after their prime, photorealistic, nostalgic yet futuristic, warm golden and orange haze, audience watching with emotion, cinematic portrait shot, respectful and inspirational',
  },
];

const VIDEO_PROMPTS: AssetDef[] = [
  {
    key: 'hologram_artist_performance',
    prompt: 'A holographic music artist performing live on stage, electric blue and orange volumetric light beams swirling around them, particles and energy effects, cinematic slow motion, professional concert cinematography, no audio',
    imageKey: 'hero_hologram_stage',
  },
  {
    key: 'virtual_stage_transformation',
    prompt: 'A virtual concert stage transforming from empty arena to full futuristic LED-lit spectacle, camera slowly panning across the stage as lights power on one by one, cinematic reveal shot, no audio',
    imageKey: 'unreal_engine_virtual_stage',
  },
  {
    key: 'avatar_in_motion',
    prompt: 'A photorealistic 3D digital avatar of a music artist moving and dancing, holographic particles emanating from their body, electric blue glow, smooth fluid motion, futuristic digital aesthetics, no audio',
    imageKey: '3d_avatar_creation',
  },
];

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hologram_show_assets (
      id         SERIAL PRIMARY KEY,
      asset_key  TEXT NOT NULL UNIQUE,
      asset_type TEXT NOT NULL,
      url        TEXT NOT NULL,
      prompt     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function saveAsset(assetKey: string, assetType: 'image' | 'video', url: string, prompt: string) {
  await pool.query(
    `INSERT INTO hologram_show_assets (asset_key, asset_type, url, prompt)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (asset_key)
     DO UPDATE SET asset_type = EXCLUDED.asset_type, url = EXCLUDED.url, prompt = EXCLUDED.prompt, created_at = NOW()`,
    [assetKey, assetType, url, prompt]
  );
}

async function falFetch(url: string, body: Record<string, unknown>) {
  let lastError: unknown;
  for (const key of FAL_KEYS) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return res.json();
    }

    const text = await res.text().catch(() => '');
    lastError = new Error(`${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
    if (res.status !== 403) break;
    console.warn('FAL key returned 403, trying next configured key...');
  }
  throw lastError;
}

async function generateImage(def: AssetDef) {
  const existing = await getAssetUrl(def.key);
  if (existing) {
    console.log(`Skipping existing image ${def.key}: ${existing}`);
    return existing;
  }

  console.log(`Generating image: ${def.key}`);
  const result = await falFetch(IMAGE_ENDPOINT, {
    prompt: def.prompt,
    aspect_ratio: '16:9',
    image_size: 'landscape_16_9',
    num_images: 1,
    guidance_scale: 3.5,
    num_inference_steps: 28,
    output_format: 'jpeg',
    enable_safety_checker: true,
  }) as any;

  const url = result?.images?.[0]?.url;
  if (!url) {
    throw new Error(`No image URL returned for ${def.key}: ${JSON.stringify(result).slice(0, 500)}`);
  }
  await saveAsset(def.key, 'image', url, def.prompt);
  console.log(`Saved image ${def.key}: ${url}`);
  return url;
}

async function queueSubmit(body: Record<string, unknown>) {
  const result = await falFetch(VIDEO_ENDPOINT, body) as any;
  if (!result?.request_id) {
    throw new Error(`No request_id returned: ${JSON.stringify(result).slice(0, 500)}`);
  }
  return result.request_id as string;
}

async function queueResult(requestId: string, maxWaitMs = 240_000) {
  const deadline = Date.now() + maxWaitMs;
  let delayMs = 5000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs + 3000, 15000);

    for (const key of FAL_KEYS) {
      const statusRes = await fetch(`${VIDEO_RESULT_ENDPOINT}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!statusRes.ok) continue;
      const status = await statusRes.json() as any;
      console.log(`Video job ${requestId}: ${status.status}`);

      if (status.status === 'COMPLETED') {
        const resultRes = await fetch(`${VIDEO_RESULT_ENDPOINT}/requests/${requestId}`, {
          headers: { Authorization: `Key ${key}` },
        });
        if (!resultRes.ok) {
          throw new Error(`Could not fetch video result: ${resultRes.status}`);
        }
        return resultRes.json();
      }
      if (status.status === 'FAILED') {
        throw new Error(`Video job failed: ${JSON.stringify(status).slice(0, 500)}`);
      }
      break;
    }
  }

  throw new Error(`Timed out waiting for video job ${requestId}`);
}

async function getAssetUrl(assetKey: string) {
  const { rows } = await pool.query(
    'SELECT url FROM hologram_show_assets WHERE asset_key = $1 LIMIT 1',
    [assetKey]
  );
  return rows[0]?.url as string | undefined;
}

async function generateVideo(def: AssetDef) {
  if (!def.imageKey) throw new Error(`Missing imageKey for video ${def.key}`);
  const existing = await getAssetUrl(def.key);
  if (existing) {
    console.log(`Skipping existing video ${def.key}: ${existing}`);
    return existing;
  }

  const imageUrl = await getAssetUrl(def.imageKey);
  if (!imageUrl) throw new Error(`No image source found for ${def.key}: ${def.imageKey}`);

  console.log(`Generating video: ${def.key}`);
  const requestId = await queueSubmit({
    prompt: def.prompt,
    image_url: imageUrl,
    duration: '3',
    aspect_ratio: '16:9',
  });
  console.log(`Queued video ${def.key}: ${requestId}`);

  const result = await queueResult(requestId) as any;
  const url = result?.video?.url || result?.videos?.[0]?.url;
  if (!url) {
    throw new Error(`No video URL returned for ${def.key}: ${JSON.stringify(result).slice(0, 500)}`);
  }
  await saveAsset(def.key, 'video', url, def.prompt);
  console.log(`Saved video ${def.key}: ${url}`);
  return url;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  if (FAL_KEYS.length === 0) throw new Error('FAL_KEY/FAL_API_KEY is missing');

  const mode = (process.argv[2] || 'all').toLowerCase();
  await ensureTables();

  if (mode === 'images' || mode === 'all') {
    for (const imageDef of IMAGE_PROMPTS) {
      await generateImage(imageDef);
    }
  }

  if (mode === 'videos' || mode === 'all') {
    for (const videoDef of VIDEO_PROMPTS) {
      await generateVideo(videoDef);
    }
  }

  const { rows } = await pool.query(
    'SELECT asset_key, asset_type, url FROM hologram_show_assets ORDER BY asset_key'
  );
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
