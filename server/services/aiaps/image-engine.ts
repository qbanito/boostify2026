/**
 * Image Engine — generates artist profile + banner assets.
 * Uses OpenAI Images API (gpt-image-1) when OPENAI_API_KEY is set.
 * Fallback: deterministic placeholder URL via Unsplash source (no key).
 */
import { pool } from './db';
import { recomputeReadiness } from './readiness';

export interface ImageSpec {
  kind: 'profile' | 'banner';
  prompt?: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
}

export async function generateArtistImages(
  artistId: string,
  specs: ImageSpec[] = [{ kind: 'profile' }, { kind: 'banner' }],
): Promise<Array<{ kind: string; url: string; provider: string }>> {
  const { rows } = await pool.query('SELECT * FROM aiaps_artists WHERE id=$1', [artistId]);
  const a = rows[0];
  if (!a) throw new Error('artist_not_found');

  const style = (a.visual_style || 'cinematic').replace(/[^a-z0-9 ,-]/gi, '');
  const genre = (a.genre_primary || 'pop').replace(/[^a-z0-9 ,-]/gi, '');
  const base = `${style} ${genre} fictional music artist`.trim();
  const urls: Array<{ kind: string; url: string; provider: string }> = [];

  for (const spec of specs) {
    const prompt =
      spec.prompt ||
      (spec.kind === 'profile'
        ? `Stylized editorial portrait of a ${base}, moody studio lighting, soft rim light, neutral background, fashion photography aesthetic, face partially obscured by shadow, no text, no logos, no real person`
        : `Abstract cinematic album-art banner, ${base} mood, wide 16:9 composition, atmospheric lighting, no people, no text, no logos`);
    const size = spec.size || (spec.kind === 'banner' ? '1536x1024' : '1024x1024');

    const url = await tryGenerate(prompt, size);
    urls.push(url);

    if (spec.kind === 'profile') {
      await pool.query('UPDATE aiaps_artists SET profile_image_url=$2, updated_at=NOW() WHERE id=$1', [artistId, url.url]);
    } else {
      await pool.query('UPDATE aiaps_artists SET banner_url=$2, updated_at=NOW() WHERE id=$1', [artistId, url.url]);
    }
  }

  await recomputeReadiness(artistId);
  return urls;
}

async function tryGenerate(prompt: string, size: string): Promise<{ kind: string; url: string; provider: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const resp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          size,
          n: 1,
        }),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        const url = data?.data?.[0]?.url || (data?.data?.[0]?.b64_json
          ? `data:image/png;base64,${data.data[0].b64_json}`
          : null);
        if (url) return { kind: size, url, provider: 'openai' };
      }
    } catch (err: any) {
      console.warn('[AIAPS image] OpenAI failed, fallback:', err.message);
    }
  }
  // Fallback: deterministic placeholder
  const seed = encodeURIComponent(prompt.slice(0, 60));
  return {
    kind: size,
    url: `https://source.unsplash.com/${size.replace('x', 'x')}/?${seed}`,
    provider: 'unsplash_fallback',
  };
}
