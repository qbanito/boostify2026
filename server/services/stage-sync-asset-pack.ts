// ────────────────────────────────────────────────────────────────────
// StageSync — Default Visual Asset Pack Generator
// ────────────────────────────────────────────────────────────────────
// Generates the 11 demo images (6 setlist song covers + 5 visual scenes)
// using OpenAI Images API (gpt-image-1) and saves them to
// `public/stage-sync/`. Idempotent: only generates files that don't yet
// exist on disk unless `force=true` is passed.
// ────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

// Vite serves client/public as the static root in dev (and bundles it
// into dist in prod). Writing there means the assets are available at
// `/stage-sync/<file>.png` without any extra static-mount config.
const PUBLIC_DIR = path.resolve(process.cwd(), 'client', 'public', 'stage-sync');

export interface AssetSpec {
  slug: string;       // file name without extension
  kind: 'song' | 'scene';
  prompt: string;
  size: '1024x1024' | '1536x1024' | '1024x1536';
}

// ── Curated prompts for the demo show "ROMY ÁLVAREZ LIVE EXPERIENCE" ──
export const DEFAULT_ASSETS: AssetSpec[] = [
  // Setlist songs (square 1:1)
  {
    slug: 'song-lluvia-de-oro',
    kind: 'song',
    size: '1024x1024',
    prompt:
      'Cinematic concert cover art for the song "Lluvia de Oro": a young Latina pop singer in a flowing white dress on a dramatic stage, with golden glitter and sparks raining down around her, warm cinematic backlight, anamorphic lens flare, 35mm film grain, ultra-photoreal, no text, no watermark, no logo',
  },
  {
    slug: 'song-mar-azul',
    kind: 'song',
    size: '1024x1024',
    prompt:
      'Cinematic concert cover art for the song "Mar Azul": ocean waves bathed in deep cobalt-blue stage lighting with a silhouette of a female pop artist, bioluminescent water reflections, dreamy glow, ultra-photoreal, no text',
  },
  {
    slug: 'song-fuego-interior',
    kind: 'song',
    size: '1024x1024',
    prompt:
      'Cinematic concert cover art for "Fuego Interior": dramatic red and orange stage flames behind a passionate Latin pop singer, sparks, embers floating, cinematic warm color grade, ultra-photoreal, no text',
  },
  {
    slug: 'song-baila-conmigo',
    kind: 'song',
    size: '1024x1024',
    prompt:
      'Cinematic dance-pop concert cover art for "Baila Conmigo": vibrant magenta and violet club lights, abstract motion blur of dancers, rhythmic confetti, energetic festival vibe, ultra-photoreal, no text',
  },
  {
    slug: 'song-destino-perfecto',
    kind: 'song',
    size: '1024x1024',
    prompt:
      'Cinematic acoustic-pop cover art for "Destino Perfecto": soft golden-hour stage with starry sky backdrop, intimate spotlight on a microphone stand, warm bokeh, romantic atmosphere, ultra-photoreal, no text',
  },
  {
    slug: 'song-somos-luz',
    kind: 'song',
    size: '1024x1024',
    prompt:
      'Cinematic anthemic-pop cover art for "Somos Luz": stadium audience holding up phone lights like a galaxy of stars, beams of warm white light from above, uplifting epic finale mood, ultra-photoreal, no text',
  },

  // Scenes (16:9 wide)
  {
    slug: 'scene-intro-soft-silk',
    kind: 'scene',
    size: '1536x1024',
    prompt:
      'Wide cinematic stage visual: soft silk fabric flowing in slow motion, milky pastel colors, subtle pearl shimmer, very slow ambient feel, dreamy soft focus, no people, no text, no logos. Designed as a concert intro backdrop.',
  },
  {
    slug: 'scene-verse-golden-waves',
    kind: 'scene',
    size: '1536x1024',
    prompt:
      'Wide cinematic stage visual: rolling abstract golden waves of liquid light, slow undulating motion, warm honey palette, elegant minimal composition, no people, no text, no logos. Concert verse backdrop.',
  },
  {
    slug: 'scene-chorus-gold-rain',
    kind: 'scene',
    size: '1536x1024',
    prompt:
      'Wide cinematic stage visual: heavy golden rain of glittering particles cascading from above, dramatic backlight, rich amber palette, energetic chorus moment, no people, no text, no logos. Concert chorus backdrop.',
  },
  {
    slug: 'scene-bridge-abstract-light',
    kind: 'scene',
    size: '1536x1024',
    prompt:
      'Wide cinematic stage visual: abstract beams of warm white light cutting through volumetric haze, geometric prisms, contemplative atmosphere, no people, no text, no logos. Concert bridge backdrop.',
  },
  {
    slug: 'scene-final-divine-sunlight',
    kind: 'scene',
    size: '1536x1024',
    prompt:
      'Wide cinematic stage visual: explosive divine sunlight breaking through clouds, golden god-rays, epic uplifting finale, powerful warm glow, no people, no text, no logos. Concert grand-finale backdrop.',
  },
];

// ────────────────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  await fs.promises.mkdir(PUBLIC_DIR, { recursive: true });
}

async function generateOne(spec: AssetSpec): Promise<{ slug: string; url: string; provider: string; bytes: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const resp = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: spec.prompt,
      size: spec.size,
      n: 1,
      quality: 'high',
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`openai_failed_${resp.status}: ${txt.slice(0, 300)}`);
  }

  const data: any = await resp.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('openai_no_b64');

  const buf = Buffer.from(b64, 'base64');
  const fileName = `${spec.slug}.png`;
  const filePath = path.join(PUBLIC_DIR, fileName);
  await fs.promises.writeFile(filePath, buf);

  return {
    slug: spec.slug,
    url: `/stage-sync/${fileName}`,
    provider: 'openai:gpt-image-1',
    bytes: buf.length,
  };
}

export async function generateDefaultAssetPack(opts: { force?: boolean; only?: string[] } = {}) {
  await ensureDir();
  const results: Array<{ slug: string; url: string; provider: string; bytes?: number; skipped?: boolean; error?: string }> = [];

  for (const spec of DEFAULT_ASSETS) {
    if (opts.only && !opts.only.includes(spec.slug)) continue;

    const filePath = path.join(PUBLIC_DIR, `${spec.slug}.png`);
    const exists = fs.existsSync(filePath);

    if (exists && !opts.force) {
      results.push({ slug: spec.slug, url: `/stage-sync/${spec.slug}.png`, provider: 'cached', skipped: true });
      continue;
    }

    try {
      const out = await generateOne(spec);
      results.push(out);
      // Be polite to the API
      await new Promise((r) => setTimeout(r, 600));
    } catch (e: any) {
      results.push({ slug: spec.slug, url: '', provider: 'error', error: e?.message || String(e) });
    }
  }

  return {
    dir: PUBLIC_DIR,
    publicBase: '/stage-sync',
    total: DEFAULT_ASSETS.length,
    generated: results.filter((r) => r.provider === 'openai:gpt-image-1').length,
    cached: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => r.provider === 'error').length,
    results,
  };
}

export function listExistingAssets(): Array<{ slug: string; url: string; exists: boolean }> {
  return DEFAULT_ASSETS.map((spec) => {
    const filePath = path.join(PUBLIC_DIR, `${spec.slug}.png`);
    return {
      slug: spec.slug,
      url: `/stage-sync/${spec.slug}.png`,
      exists: fs.existsSync(filePath),
    };
  });
}
