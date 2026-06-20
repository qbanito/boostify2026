import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { storage } from '../firebase';
import crypto from 'crypto';

const router = Router();

/**
 * Upload a base64-encoded image and return a public URL.
 *
 * Previously this endpoint just echoed the incoming base64 string back as the
 * "URL", which meant cover artwork persisted as a multi-MB data: URL inside
 * the songs row — Postgres rejected very large rows, Firestore docs grew past
 * the 1MB limit, and `<img src>` rendered slowly. Now we upload to Firebase
 * Storage (already used for audio assets) and return the public download URL.
 *
 * Body:
 *   - imageData: data URL (data:image/...;base64,XXXX) OR raw base64 string
 *   - fileName:  desired file name (extension is honored if present)
 *   - folder:    storage folder (default: "uploads")
 */
router.post('/upload-image', authenticate, async (req: Request, res: Response) => {
  try {
    const { imageData, fileName, folder } = req.body || {};

    if (!imageData || !fileName) {
      return res.status(400).json({
        success: false,
        error: 'imageData and fileName are required',
      });
    }

    // Accept either a data URL or a raw base64 payload.
    let mimeType = 'image/png';
    let base64Body = String(imageData);
    const dataUrlMatch = base64Body.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.*)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1];
      base64Body = dataUrlMatch[2];
    }

    if (!/^image\/(png|jpe?g|gif|webp|avif|heic|heif|svg\+xml)$/i.test(mimeType)) {
      return res.status(400).json({
        success: false,
        error: `Unsupported image type: ${mimeType}`,
      });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Body, 'base64');
    } catch {
      return res.status(400).json({
        success: false,
        error: 'imageData is not valid base64',
      });
    }

    // Soft cap at 15MB to avoid abusive uploads.
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        error: 'Image too large (max 15MB).',
      });
    }

    if (!storage) {
      return res.status(503).json({
        success: false,
        error: 'Storage not configured on server',
      });
    }

    const safeFolder = (folder && /^[\w\-./]+$/.test(folder) ? folder : 'uploads').replace(
      /^\/+|\/+$/g,
      '',
    );
    const ext =
      (fileName && fileName.includes('.') ? fileName.split('.').pop() : '') ||
      mimeType.split('/')[1].replace('+xml', '');
    const safeBase =
      String(fileName || 'image')
        .replace(/[^\w\-]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80) || 'image';
    const objectPath = `${safeFolder}/${Date.now()}-${crypto
      .randomBytes(4)
      .toString('hex')}-${safeBase}.${ext}`;

    const bucket = storage.bucket();
    const file = bucket.file(objectPath);

    // Generate a Firebase download token so the URL works on all bucket types
    // (including buckets with uniform bucket-level access that block object ACLs).
    const downloadToken = crypto.randomUUID();

    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedBy: (req as any).user?.uid || (req as any).user?.id || 'unknown',
          originalName: String(fileName).slice(0, 200),
        },
      },
    });

    // Try makePublic() for legacy buckets; silently ignore on uniform-ACL buckets.
    try {
      await file.makePublic();
    } catch {
      // Bucket uses uniform bucket-level access — download token URL is sufficient.
    }

    // Firebase Storage download URL (works with the token regardless of bucket ACL).
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;

    return res.json({
      success: true,
      imageUrl: publicUrl,
      path: objectPath,
    });
  } catch (error: any) {
    console.error('Error uploading image:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to upload image',
    });
  }
});

export default router;

