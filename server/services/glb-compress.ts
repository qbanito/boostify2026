/**
 * GLB compression for hologram 3D characters.
 *
 * Hunyuan 3D Pro produces high-poly, full-resolution GLBs (~40 MB) that are far
 * too heavy to stream into the browser. This compresses them with:
 *   - Draco geometry compression (KHR_draco_mesh_compression)
 *   - WebP texture re-encoding (downscaled to a sane max size)
 *   - dedup / prune / weld cleanup
 *
 * Typical result: ~40 MB → ~3-6 MB with no visible quality loss at viewer scale.
 * Best-effort: if anything fails, the original buffer is returned unchanged.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld, textureCompress } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

let ioPromise: Promise<NodeIO> | null = null;

async function getIO(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      const [encoder, decoder] = await Promise.all([
        draco3d.createEncoderModule(),
        draco3d.createDecoderModule(),
      ]);
      return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'draco3d.encoder': encoder,
        'draco3d.decoder': decoder,
      });
    })();
  }
  return ioPromise;
}

/**
 * Compress a GLB buffer. Returns the compressed buffer, or the original on failure.
 *
 * `quality` presets balance file size vs texture/detail fidelity:
 *   - 'web'      → 2048px, webp q82  (smallest; default for thumbnails / fast load)
 *   - 'balanced' → 2048px, webp q88  (good default for the stage viewer)
 *   - 'hq'       → 4096px, webp q92  (preserve facial / fabric detail for close-ups)
 */
export type GlbQuality = 'web' | 'balanced' | 'hq';

const QUALITY_PRESETS: Record<GlbQuality, { maxTextureSize: number; quality: number }> = {
  web: { maxTextureSize: 2048, quality: 82 },
  balanced: { maxTextureSize: 2048, quality: 88 },
  hq: { maxTextureSize: 4096, quality: 92 },
};

export async function compressGlb(
  input: Buffer,
  opts: { maxTextureSize?: number; quality?: GlbQuality; textureQuality?: number } = {},
): Promise<{ buffer: Buffer; originalBytes: number; compressedBytes: number; compressed: boolean }> {
  const originalBytes = input.byteLength;
  const preset = QUALITY_PRESETS[opts.quality ?? 'balanced'];
  const maxTextureSize = opts.maxTextureSize ?? preset.maxTextureSize;
  const textureQuality = opts.textureQuality ?? preset.quality;

  try {
    const io = await getIO();
    const doc = await io.readBinary(new Uint8Array(input));

    await doc.transform(
      dedup(),
      prune(),
      weld(),
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [maxTextureSize, maxTextureSize],
        quality: textureQuality,
      }),
      draco(),
    );

    const out = await io.writeBinary(doc);
    const buffer = Buffer.from(out);

    // If compression somehow made it larger, keep the original.
    if (buffer.byteLength >= originalBytes) {
      return { buffer: input, originalBytes, compressedBytes: originalBytes, compressed: false };
    }

    return { buffer, originalBytes, compressedBytes: buffer.byteLength, compressed: true };
  } catch (err) {
    console.warn('[glb-compress] compression failed, using original GLB:', (err as Error)?.message);
    return { buffer: input, originalBytes, compressedBytes: originalBytes, compressed: false };
  }
}
