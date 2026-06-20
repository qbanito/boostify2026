/**
 * One-off / admin trigger for the Singing Performance pipeline.
 *
 * Runs the SAME pipeline as
 *   POST /api/hologram-gallery/:artistId/character-3d/singing-performance
 * but without the Clerk HTTP auth layer, so a trusted operator can run a real
 * (credit-consuming) OmniHuman + sync-lipsync + motion-extract job locally.
 *
 * Usage:
 *   npx tsx scripts/generate-singing-performance.ts <artistId> [songUrl] [--pro] [--start=SEC] [--dur=SEC]
 *   npx tsx scripts/generate-singing-performance.ts 1417            # auto-resolve the artist's first song
 *   npx tsx scripts/generate-singing-performance.ts 1417 https://.../song.mp3 --pro
 *
 * Without a songUrl the avatar still gets a prompt-driven clip (no lipsync).
 */
import 'dotenv/config';

async function resolveSongUrl(artistId: string): Promise<string | null> {
  if (!/^\d+$/.test(artistId)) return null;
  // Use the running dev server's public songs endpoint (no DB path/alias juggling).
  const base = process.env.LOCAL_API_BASE || 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/songs/user/${artistId}`);
    if (!res.ok) return null;
    const list: any[] = await res.json();
    const first = Array.isArray(list) ? list.find((s) => s?.audioUrl) : null;
    if (first?.audioUrl) {
      console.log(`[gen-perf] Using song: ${first.title || 'Untitled'}`);
      return first.audioUrl as string;
    }
  } catch (e) {
    console.warn('[gen-perf] Could not resolve song from local API:', (e as Error)?.message);
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const artistId = positional[0] || '1417';
  let songUrl = positional[1] || '';
  const pro = args.includes('--pro');
  const startArg = args.find((a) => a.startsWith('--start='));
  const durArg = args.find((a) => a.startsWith('--dur='));
  const startSec = startArg ? Number(startArg.split('=')[1]) : 0;
  const duration = durArg ? Number(durArg.split('=')[1]) : 8;

  if (!songUrl) {
    const resolved = await resolveSongUrl(artistId);
    if (resolved) songUrl = resolved;
  }

  console.log(
    `[gen-perf] Singing performance for artist ${artistId} ` +
      `(mode=${songUrl ? 'omnihuman+lipsync' : 'image-to-video'}, pro=${pro}, start=${startSec}s, dur=${duration}s)…`,
  );

  // Dynamic import AFTER dotenv populates process.env so firebase/db init correctly.
  const { triggerSingingPerformance } = await import('../server/routes/hologram-gallery');
  const result = await triggerSingingPerformance(artistId, {
    audioUrl: songUrl || undefined,
    startSec,
    duration,
    lipsyncPro: pro,
  });

  console.log('[gen-perf] ✅ Done. Character doc:');
  console.log(
    JSON.stringify(
      {
        perfStatus: (result as any)?.perfStatus,
        perfMode: (result as any)?.perfMode,
        perfLipsynced: (result as any)?.perfLipsynced,
        performanceVideoUrl: (result as any)?.performanceVideoUrl,
        performanceAudioUrl: (result as any)?.performanceAudioUrl,
        performanceClipDuration: (result as any)?.performanceClipDuration,
        motionFrames: (result as any)?.motionTimeline?.frameCount ?? 0,
        perfError: (result as any)?.perfError,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[gen-perf] ❌ Failed:', err?.message || err);
    process.exit(1);
  });
