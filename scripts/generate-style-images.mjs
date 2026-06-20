/**
 * Generate Visual-Style Swatch Images for /video-concepts Step 1
 * ──────────────────────────────────────────────────────────────
 * Uses fal.ai's `fal-ai/gpt-image-1.5` model to render one hero
 * image per visual-soul preset (editorial, romantic, cinematic,
 * vintage_film, minimal_luxury, vibrant, modern). Saves each as
 *
 *     client/public/video-concepts/styles/{id}.jpg
 *
 * The intake form imports this folder via a static URL, so once
 * generated the user immediately sees real photographs instead of the
 * typographic letter swatches.
 *
 * Usage:
 *     node scripts/generate-style-images.mjs            # all 7
 *     node scripts/generate-style-images.mjs cinematic  # one
 *     FORCE=1 node scripts/generate-style-images.mjs    # overwrite
 *
 * Requires FAL_KEY in env.
 */

import { fal } from '@fal-ai/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'client', 'public', 'video-concepts', 'styles');

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
if (!FAL_KEY) {
  console.error('❌ FAL_KEY (or FAL_API_KEY) not set in environment.');
  process.exit(1);
}
fal.config({ credentials: FAL_KEY });

/**
 * Each preset description is engineered for `gpt-image-2` to produce a
 * vertical 4:5 magazine-cover-style frame that *embodies* the style
 * with no on-image text — pure photography & art direction.
 */
const PRESETS = [
  {
    id: 'editorial',
    prompt:
      'Editorial fashion magazine cover photograph, single elegant subject in profile, dramatic side-lit studio with deep shadows, charcoal grey to soft cream gradient backdrop, high-contrast monochrome with a single accent of warm amber, sharp medium-format detail, deliberate composition with generous negative space, vertical 4:5 frame, no text, no logo, no captions, cinematic, refined, premium magazine aesthetic.',
  },
  {
    id: 'romantic',
    prompt:
      'Romantic golden-hour wedding-style photograph, soft warm sunlight backlighting two silhouetted figures gently embracing in a wildflower field, dreamy bokeh, peach and dusty-rose palette with warm amber highlights, gentle film grain, hazy atmosphere, intimate lens compression, vertical 4:5 frame, no text, no overlays, painterly, tender, cinematic warmth.',
  },
  {
    id: 'cinematic',
    prompt:
      'Anamorphic cinematic still from a feature film, single hero subject lit by a deep teal practical light on one side and warm orange tungsten glow on the other, classic teal-and-orange Hollywood color grade, atmospheric haze, oval bokeh, 2.39 anamorphic flares, shallow depth of field, dramatic mood, vertical 4:5 frame, no text, no captions, premium cinema look.',
  },
  {
    id: 'vintage_film',
    prompt:
      'Vintage 16mm film still from the 1970s, warm faded Kodachrome palette of mustard, ochre and tobacco brown, heavy organic film grain, soft halation glow on highlights, gentle light leaks, slightly desaturated skin tones, single subject in a sunlit nostalgic scene, analog warmth, vertical 4:5 frame, no text, no overlays, archival nostalgic feel.',
  },
  {
    id: 'minimal_luxury',
    prompt:
      'Minimal luxury still-life editorial photograph, polished marble surface with a single champagne flute and a folded ivory linen napkin, soft north-facing daylight, palette of champagne, alabaster and stone, abundant negative space, ultra-clean composition, refined high-end perfume-ad aesthetic, sharp tack-focus medium format, vertical 4:5 frame, no text, no logos, calm, expensive, restrained.',
  },
  {
    id: 'vibrant',
    prompt:
      'High-energy party photograph, joyful crowd dancing under saturated magenta and cyan neon strobes with golden confetti mid-air, motion blur on outstretched hands, vivid fuchsia, electric orange and yellow palette, deep blacks, contemporary club/festival energy, sharp shutter capture of a joyful expression, vertical 4:5 frame, no text, no logos, vibrant pop aesthetic.',
  },
  {
    id: 'modern',
    prompt:
      'Modern minimalist design photograph, single architectural subject framed against a stark pure-white seamless backdrop, hard geometric shadows, monochrome black-and-white palette accented by a single chartreuse-lime stripe, sharp clean lines, gallery / brutalist art-direction feel, sharp tack focus, vertical 4:5 frame, no text, no captions, contemporary, designed-not-filmed look.',
  },
];

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function alreadyExists(id) {
  try {
    await fs.access(path.join(OUT_DIR, `${id}.jpg`));
    return true;
  } catch {
    return false;
  }
}

async function downloadToFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  return buf.length;
}

/**
 * Try a list of fal text-to-image endpoints in order. The user requested
 * `openai/gpt-image-2`; fal exposes the OpenAI gpt-image family under a few
 * different ids depending on access tier, so we try them in priority order
 * and fall back to `fal-ai/nano-banana-2` (the proven text-to-image model
 * already used elsewhere in this codebase).
 */
const MODEL_CANDIDATES = [
  {
    id: 'fal-ai/gpt-image-1/text-to-image/byok',
    input: (prompt) => ({
      prompt,
      image_size: 'portrait_4_3',
      num_images: 1,
      quality: 'high',
      openai_api_key: process.env.OPENAI_API_KEY,
    }),
    requires: () => !!process.env.OPENAI_API_KEY,
  },
  {
    id: 'fal-ai/bytedance/seedream/v4/text-to-image',
    input: (prompt) => ({
      prompt,
      image_size: 'portrait_4_3',
      num_images: 1,
    }),
  },
  {
    id: 'fal-ai/nano-banana-2',
    input: (prompt) => ({
      prompt,
      num_images: 1,
      aspect_ratio: '4:5',
      output_format: 'jpeg',
    }),
  },
  {
    id: 'fal-ai/flux-pro/v1.1-ultra',
    input: (prompt) => ({
      prompt,
      aspect_ratio: '4:5',
      num_images: 1,
      output_format: 'jpeg',
    }),
  },
];

async function generateOne(preset) {
  let lastError;
  for (const candidate of MODEL_CANDIDATES) {
    if (candidate.requires && !candidate.requires()) {
      console.log(`   ⏭  ${candidate.id} skipped (missing required env).`);
      continue;
    }
    try {
      console.log(`\n🎨 [${preset.id}] trying ${candidate.id} …`);
      const result = await fal.subscribe(candidate.id, {
        input: candidate.input(preset.prompt),
        logs: false,
      });

      const data = result?.data ?? result;
      const imageUrl =
        data?.images?.[0]?.url ||
        data?.image?.url ||
        (typeof data?.images?.[0] === 'string' ? data.images[0] : null) ||
        null;

      if (!imageUrl) {
        console.error(`   raw response:`, JSON.stringify(data).slice(0, 400));
        throw new Error('No image URL in response');
      }

      const dest = path.join(OUT_DIR, `${preset.id}.jpg`);
      const bytes = await downloadToFile(imageUrl, dest);
      console.log(`   ✅ saved ${dest} (${(bytes / 1024).toFixed(0)} KB) via ${candidate.id}`);
      return;
    } catch (err) {
      const detail =
        err?.body?.detail ||
        err?.response?.data?.detail ||
        err?.message ||
        String(err);
      const msg = typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 200);
      console.warn(`   ⚠️  ${candidate.id} failed: ${msg}`);
      lastError = err;
    }
  }
  throw lastError || new Error('All candidate models failed');
}

async function main() {
  await ensureOutDir();

  const targetId = process.argv[2];
  const force = process.env.FORCE === '1';

  const targets = targetId
    ? PRESETS.filter((p) => p.id === targetId)
    : PRESETS;

  if (targets.length === 0) {
    console.error(`Unknown preset id "${targetId}". Valid: ${PRESETS.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }

  for (const preset of targets) {
    if (!force && (await alreadyExists(preset.id))) {
      console.log(`⏭  [${preset.id}] already exists (use FORCE=1 to overwrite). Skipping.`);
      continue;
    }
    try {
      await generateOne(preset);
    } catch (err) {
      console.error(`❌ [${preset.id}]`, err?.message || err);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
