/**
 * Boostify Image Stylizer
 *
 * Takes a discovered artist's reference photo (YouTube channel thumbnail,
 * Spotify artist image, etc.) and generates a Boostify-branded editorial
 * portrait that we can use on landing pages and outreach materials.
 *
 * Pipeline:
 *   reference URL → FAL Nano Banana 2 (edit) ──┐
 *                                              ├─→ Firebase Storage → DB row
 *                   OpenAI gpt-image-1 (edit) ─┘  (fallback when FAL fails)
 */

import axios from 'axios';
import OpenAI, { toFile } from 'openai';
import { pool } from '../../db';
import { editImageWithNanoBanana } from '../fal-service';
import { storage } from '../../firebase';
import { logger } from '../../utils/logger';

const BOOSTIFY_PROMPT = [
  'Professional music artist editorial portrait in Boostify brand style.',
  'Cinematic high-contrast lighting, moody premium magazine-cover atmosphere.',
  'Sharp detail, 4k quality, studio-grade color grading with deep blacks and subtle teal/purple highlights.',
  'Preserve the subject\'s face, hair and outfit exactly — only upgrade lighting, background, and post-processing.',
  'Remove any logos, watermarks, or UI overlays from the reference.',
  'Centered composition, square framing, suitable for a landing page hero card.',
].join(' ');

export interface StylizeResult {
  success: boolean;
  boostifyUrl?: string;
  provider?: 'fal' | 'openai';
  error?: string;
}

// ─── OpenAI fallback ─────────────────────────────────────────────

let cachedOpenAI: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!cachedOpenAI) cachedOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return cachedOpenAI;
}

async function uploadBufferToStorage(
  buffer: Buffer,
  contentType: string,
  folder: string,
): Promise<string> {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const extension = contentType.split('/')[1] || 'png';
  const fileName = `${folder}/${timestamp}_${randomId}.${extension}`;
  const bucket = storage.bucket();
  const file = bucket.file(fileName);
  await file.save(buffer, { metadata: { contentType }, validation: false });
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
}

async function stylizeWithOpenAI(
  referenceUrl: string,
  artistName: string,
): Promise<StylizeResult> {
  const client = getOpenAI();
  if (!client) return { success: false, error: 'OPENAI_API_KEY not configured' };

  try {
    // Download reference image as a File-like for the edits endpoint
    const dl = await axios.get<ArrayBuffer>(referenceUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
    });
    const refBuffer = Buffer.from(dl.data);
    const mime = (dl.headers['content-type'] as string) || 'image/png';
    const ext = mime.split('/')[1] || 'png';
    const refFile = await toFile(refBuffer, `reference.${ext}`, { type: mime });

    const prompt = `${BOOSTIFY_PROMPT} Artist name: ${artistName}.`;
    logger.log(`[BoostifyStylizer] 🎨 OpenAI gpt-image-1 edit for "${artistName}"`);

    const response = await client.images.edit({
      model: 'gpt-image-1',
      image: refFile,
      prompt,
      size: '1024x1024',
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return { success: false, error: 'OpenAI returned no image data' };

    const outBuffer = Buffer.from(b64, 'base64');
    const url = await uploadBufferToStorage(outBuffer, 'image/png', 'boostify-images/leads');
    return { success: true, boostifyUrl: url, provider: 'openai' };
  } catch (err: any) {
    const msg = err?.response?.data?.error?.message || err?.message || 'unknown';
    logger.error(`[BoostifyStylizer] OpenAI fallback failed for ${artistName}:`, msg);
    return { success: false, error: `openai: ${msg}` };
  }
}

// ─── Main stylizer: FAL primary, OpenAI fallback ─────────────────

export async function stylizeArtistImage(
  referenceUrl: string,
  artistName: string,
): Promise<StylizeResult> {
  if (!referenceUrl) {
    return { success: false, error: 'no reference URL' };
  }

  // 1) Try FAL Nano Banana 2 (faster + cheaper)
  if (process.env.FAL_API_KEY) {
    try {
      const prompt = `${BOOSTIFY_PROMPT} Artist name: ${artistName}.`;
      const result = await editImageWithNanoBanana(referenceUrl, prompt, {
        aspectRatio: '1:1',
        numImages: 1,
        outputFormat: 'webp',
        strength: 0.65,
      });
      if (result.success && result.imageUrl) {
        return { success: true, boostifyUrl: result.imageUrl, provider: 'fal' };
      }
      logger.warn(`[BoostifyStylizer] FAL returned no image for ${artistName}, trying OpenAI...`);
    } catch (err: any) {
      logger.warn(`[BoostifyStylizer] FAL failed for ${artistName}: ${err.message} — falling back to OpenAI`);
    }
  } else {
    logger.warn('[BoostifyStylizer] FAL_API_KEY not set, using OpenAI directly');
  }

  // 2) Fallback to OpenAI gpt-image-1
  const openaiResult = await stylizeWithOpenAI(referenceUrl, artistName);
  if (openaiResult.success) return openaiResult;

  return {
    success: false,
    error: openaiResult.error || 'both FAL and OpenAI failed',
  };
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  byProvider: { fal: number; openai: number };
  errors: Array<{ contactId: number; error: string }>;
}

/**
 * Picks up to `limit` contacts that have a reference image but no Boostify
 * image yet, runs each through the stylizer, and writes the result back.
 */
export async function stylizePendingLeads(limit = 20): Promise<BatchResult> {
  const { rows } = await pool.query<{
    id: number;
    full_name: string;
    profile_image_url: string;
  }>(
    `SELECT id, full_name, profile_image_url
       FROM music_industry_contacts
      WHERE profile_image_url IS NOT NULL
        AND boostify_image_url IS NULL
      ORDER BY id DESC
      LIMIT $1`,
    [limit],
  );

  const result: BatchResult = {
    processed: rows.length,
    succeeded: 0,
    failed: 0,
    byProvider: { fal: 0, openai: 0 },
    errors: [],
  };

  for (const row of rows) {
    const outcome = await stylizeArtistImage(row.profile_image_url, row.full_name);
    if (outcome.success && outcome.boostifyUrl) {
      await pool.query(
        `UPDATE music_industry_contacts
            SET boostify_image_url = $1,
                image_stylized_at = NOW()
          WHERE id = $2`,
        [outcome.boostifyUrl, row.id],
      );
      result.succeeded++;
      if (outcome.provider === 'fal') result.byProvider.fal++;
      else if (outcome.provider === 'openai') result.byProvider.openai++;
      logger.log(`[BoostifyStylizer] ✅ #${row.id} ${row.full_name} (${outcome.provider})`);
    } else {
      result.failed++;
      result.errors.push({ contactId: row.id, error: outcome.error || 'unknown' });
      logger.warn(`[BoostifyStylizer] ❌ #${row.id} ${row.full_name}: ${outcome.error}`);
    }
  }

  logger.log(
    `[BoostifyStylizer] batch done: ${result.succeeded}/${result.processed} succeeded ` +
    `(fal=${result.byProvider.fal}, openai=${result.byProvider.openai})`,
  );
  return result;
}

