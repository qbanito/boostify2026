/**
 * Helper to mirror remote URLs (FAL outputs) into Firebase Storage so we
 * own the artifacts and they survive past FAL's CDN retention.
 */
import axios from 'axios';
import { storage } from '../firebase';
import { logger } from '../utils/logger';

export async function mirrorUrlToFirebase(
  remoteUrl: string,
  folder: string,
  filename?: string,
): Promise<string> {
  try {
    const resp = await axios.get(remoteUrl, {
      responseType: 'arraybuffer',
      timeout: 120_000,
    });
    const buffer = Buffer.from(resp.data);
    const mimeType: string = resp.headers['content-type'] || 'application/octet-stream';

    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const ext = (mimeType.split('/')[1] || 'bin').split(';')[0];
    const fname = filename || `${ts}_${rand}.${ext}`;
    const path = `${folder}/${fname}`;

    const bucket = storage.bucket();
    const file = bucket.file(path);
    await file.save(buffer, {
      metadata: { contentType: mimeType },
      validation: false,
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
      bucket.name,
    )}/o/${encodeURIComponent(path)}?alt=media`;
    logger.info('[StorageMirror] uploaded', { path, size: buffer.length });
    return publicUrl;
  } catch (err: any) {
    logger.error('[StorageMirror] failed:', err?.message);
    return remoteUrl; // fallback to original URL
  }
}
