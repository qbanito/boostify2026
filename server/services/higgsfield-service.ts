/**
 * Higgsfield Soul — image generation service.
 *
 * Wraps the Higgsfield REST API (async queue: submit → poll → download) and
 * persists the result to Firebase Storage, because the Higgsfield CDN URL
 * expires. Preserves the artist's real likeness when a reference image is
 * provided. Gated on HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET — returns
 * undefined (gracefully) when not configured so callers can fall back.
 *
 * Docs: https://docs.higgsfield.ai/docs/how-to/introduction
 */

export interface HiggsfieldImageOptions {
  prompt: string;
  /** Artist reference photo (http/https) to preserve likeness. */
  referenceImageUrl?: string;
  /** e.g. '16:9', '1:1', '9:16'. Default '16:9'. */
  aspectRatio?: string;
  /** Higgsfield quality. Default '1080p'. */
  quality?: string;
  /** Firebase Storage folder to persist into (e.g. 'youtube-thumbnails'). */
  folder: string;
}

export function isHiggsfieldConfigured(): boolean {
  return Boolean(
    process.env.HIGGSFIELD_API_KEY &&
      (process.env.HIGGSFIELD_API_SECRET || process.env.HIGGSFIELD_SECRET),
  );
}

async function persistImageBufferToFirebase(buffer: Buffer, folder: string): Promise<string | null> {
  try {
    const { getStorage } = await import('firebase-admin/storage');
    const bucket = getStorage().bucket();
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true });
    return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  } catch (e: any) {
    console.warn('[higgsfield] persistImageBufferToFirebase failed:', e?.message);
    return null;
  }
}

/**
 * Generates an image with Higgsfield Soul and returns a permanent Firebase URL
 * (or undefined when not configured / on failure). If the Firebase upload
 * fails, falls back to returning the raw Higgsfield CDN URL.
 */
export async function generateHiggsfieldImage(
  opts: HiggsfieldImageOptions,
): Promise<string | undefined> {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET || process.env.HIGGSFIELD_SECRET;
  if (!key || !secret) return undefined;

  const { prompt, referenceImageUrl, aspectRatio = '16:9', quality = '1080p', folder } = opts;
  const ref = referenceImageUrl && /^https?:\/\//.test(referenceImageUrl) ? referenceImageUrl : null;
  const auth = `Key ${key}:${secret}`;

  try {
    const input: Record<string, any> = {
      prompt: ref
        ? `Keep the EXACT same person, face and identity from the reference image. ${prompt}`
        : prompt,
      aspect_ratio: aspectRatio,
      quality,
    };
    if (ref) {
      input.image_reference = ref;
      input.input_images = [ref];
    }

    const submit = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!submit.ok) {
      console.warn('[higgsfield] submit failed:', submit.status);
      return undefined;
    }
    const sub = (await submit.json()) as any;

    let imageUrl: string | null = sub.images?.[0]?.url || null;
    const statusUrl: string | null =
      sub.status_url ||
      (sub.request_id ? `https://platform.higgsfield.ai/requests/${sub.request_id}/status` : null);

    for (let i = 0; i < 30 && !imageUrl && statusUrl; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await fetch(statusUrl, { headers: { Authorization: auth } });
      if (!st.ok) continue;
      const sj = (await st.json()) as any;
      if (sj.status === 'completed') {
        imageUrl = sj.images?.[0]?.url || null;
        break;
      }
      if (sj.status === 'failed' || sj.status === 'nsfw') break;
    }
    if (!imageUrl) return undefined;

    const r = await fetch(imageUrl);
    if (!r.ok) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    const persisted = await persistImageBufferToFirebase(buf, folder);
    return persisted || imageUrl;
  } catch (e: any) {
    console.warn('[higgsfield] generation failed:', e?.message);
    return undefined;
  }
}
