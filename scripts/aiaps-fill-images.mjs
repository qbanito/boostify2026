#!/usr/bin/env node
/**
 * Generate profile + banner images for all AIAPS artists missing them.
 * Uses OpenAI gpt-image-1 directly, writes URLs to aiaps_artists.
 * Usage: node scripts/aiaps-fill-images.mjs [--force]
 */
import pg from 'pg';
import 'dotenv/config';

const FORCE = process.argv.includes('--force');
const url = process.env.DATABASE_URL;
const key = process.env.OPENAI_API_KEY;
if (!url) { console.error('DATABASE_URL missing'); process.exit(2); }

const pool = new pg.Pool({ connectionString: url, ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });

async function genImage(prompt, size) {
  if (!key) {
    const seed = encodeURIComponent(prompt.slice(0, 60));
    return { url: `https://source.unsplash.com/${size}/?${seed}`, provider: 'unsplash' };
  }
  try {
    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size, n: 1 }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.warn(`  OpenAI error (${resp.status}):`, JSON.stringify(data).slice(0, 200));
      const seed = encodeURIComponent(prompt.slice(0, 60));
      return { url: `https://source.unsplash.com/${size}/?${seed}`, provider: 'unsplash_fallback' };
    }
    const u = data?.data?.[0]?.url || (data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
    return { url: u, provider: 'openai' };
  } catch (err) {
    console.warn('  fetch failed:', err.message);
    return { url: null, provider: 'error' };
  }
}

const where = FORCE ? '1=1' : 'profile_image_url IS NULL OR banner_url IS NULL';
const { rows } = await pool.query(`SELECT id, stage_name, genre_primary, visual_style, profile_image_url, banner_url FROM aiaps_artists WHERE ${where}`);

console.log(`Artists to process: ${rows.length}`);
for (const a of rows) {
  const style = (a.visual_style || 'cinematic').replace(/[^a-z0-9 ,-]/gi, '');
  const genre = (a.genre_primary || 'pop').replace(/[^a-z0-9 ,-]/gi, '');
  const base = `${style} ${genre} fictional music artist`.trim();
  if (FORCE || !a.profile_image_url) {
    console.log(`[${a.id}] profile...`);
    const r = await genImage(`Stylized editorial portrait of a ${base}, moody studio lighting, soft rim light, neutral background, fashion photography aesthetic, face partially obscured by shadow, no text, no logos, no real person`, '1024x1024');
    if (r.url) {
      await pool.query('UPDATE aiaps_artists SET profile_image_url=$2, updated_at=NOW() WHERE id=$1', [a.id, r.url]);
      console.log(`  → profile set via ${r.provider}`);
    }
  }
  if (FORCE || !a.banner_url) {
    console.log(`[${a.id}] banner...`);
    const r = await genImage(`Abstract cinematic album-art banner, ${base} mood, wide 16:9 composition, atmospheric lighting, no people, no text, no logos`, '1536x1024');
    if (r.url) {
      await pool.query('UPDATE aiaps_artists SET banner_url=$2, updated_at=NOW() WHERE id=$1', [a.id, r.url]);
      console.log(`  → banner set via ${r.provider}`);
    }
  }
}

console.log('\n✅ Done');
const check = await pool.query('SELECT id, stage_name, profile_image_url IS NOT NULL AS has_profile, banner_url IS NOT NULL AS has_banner FROM aiaps_artists');
console.table(check.rows);
await pool.end();
