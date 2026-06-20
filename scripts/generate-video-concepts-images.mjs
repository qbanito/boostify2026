#!/usr/bin/env node
/**
 * One-shot image generator for the Boostify Video Concepts landing page.
 *
 * Calls FAL's `openai/gpt-image-2` model at 1024x768 (lower-cost preset)
 * for each prompt and saves the result under
 *   client/public/video-concepts/<slug>.jpg
 *
 * Run with:   node scripts/generate-video-concepts-images.mjs
 * Re-run only the missing slugs:  node scripts/generate-video-concepts-images.mjs --missing
 *
 * Requires `FAL_KEY` in the environment (loaded automatically from `.env`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Tiny .env loader so the script works without dotenv.
function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || process.env.FAL_AI_KEY;
if (!FAL_KEY) {
  console.error('❌ FAL_KEY missing from environment');
  process.exit(1);
}

const OUT_DIR = path.join(ROOT, 'client', 'public', 'video-concepts');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROMPTS = [
  {
    slug: 'hero',
    prompt:
      'Cinematic wide shot of an elegant luxury wedding ballroom at golden hour, soft warm bokeh, dramatic side lighting, anamorphic flares, ultra premium editorial photography, golden chandeliers, silk fabrics, slow motion atmosphere, hyper-realistic, shot on ARRI Alexa, 35mm, color graded teal and amber, magazine quality, no text',
  },
  {
    slug: 'cat-quinceanera',
    prompt:
      'Editorial cinematic portrait of a young Latina quinceañera in a luxurious ballgown holding a tiara, royal palace ballroom interior, dramatic golden chandeliers, dreamy depth of field, fashion magazine cover style, hyper-realistic, soft warm rim light, 35mm photography, no text',
  },
  {
    slug: 'cat-wedding',
    prompt:
      'Cinematic editorial wedding photograph, elegant bride and groom in slow dance, golden sunset light, romantic luxury vineyard venue, anamorphic lens, dreamy depth of field, premium fashion magazine quality, hyper-realistic, soft pastel color palette, no text',
  },
  {
    slug: 'cat-corporate',
    prompt:
      'Premium corporate event keynote moment, executive on illuminated stage with massive LED backdrop, dramatic spotlight beams, sleek modern auditorium with audience silhouettes, cinematic teal-orange color grade, ultra-sharp commercial photography, luxury brand aesthetic, no text',
  },
  {
    slug: 'cat-legacy',
    prompt:
      'Cinematic family legacy portrait, multi-generational family in a vintage warm-lit living room, soft window light, nostalgic film grain, emotional storytelling photography, golden tones, hyper-realistic, editorial style, archival yet timeless mood, no text',
  },
  {
    slug: 'gallery-preview',
    prompt:
      'Sleek black premium app interface mockup floating in dark cinematic space, displaying a private event photo gallery with elegant orange accent details, polished glassmorphism, premium product photography rendering, soft glow, cinematic dark background, no text',
  },
  {
    slug: 'agents-bg',
    prompt:
      'Abstract cinematic visualization of an AI orchestration system, twelve glowing nodes connected by elegant flowing light paths, dark luxury background with subtle gold and orange accents, premium tech aesthetic, depth of field, hyper-detailed, no text',
  },
];

const ARGS = new Set(process.argv.slice(2));
const MISSING_ONLY = ARGS.has('--missing');

async function generate(prompt) {
  const res = await fetch('https://fal.run/openai/gpt-image-2', {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 768 },
      quality: 'low',
      num_images: 1,
      output_format: 'jpeg',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FAL ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  // FAL responses for image models put the URL at images[0].url
  const url = data?.images?.[0]?.url || data?.image?.url || data?.url;
  if (!url) throw new Error(`no image url in response: ${JSON.stringify(data).slice(0, 400)}`);
  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error(`download ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  return buf;
}

async function main() {
  for (const p of PROMPTS) {
    const out = path.join(OUT_DIR, `${p.slug}.jpg`);
    if (MISSING_ONLY && fs.existsSync(out)) {
      console.log(`⏭  ${p.slug} (already present)`);
      continue;
    }
    process.stdout.write(`🎨 ${p.slug} ... `);
    try {
      const buf = await generate(p.prompt);
      fs.writeFileSync(out, buf);
      console.log(`ok (${(buf.byteLength / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.log(`failed: ${e.message}`);
    }
  }
  console.log(`\n✅ Output: ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
