import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import sharp from 'sharp';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path as string;

export function isPublicTourAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0))
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  return isIP(ip) === 6 && /^[23][0-9a-f]{3}:/i.test(ip);
}

/** Pin the validated DNS address and validate every redirect before downloading media. */
export async function downloadTourMedia(raw: string, maxBytes = 100 * 1024 * 1024, redirects = 0): Promise<Buffer> {
  if (raw.startsWith('/uploads/')) {
    const root = path.resolve('uploads');
    const file = path.resolve(root, decodeURIComponent(raw.slice('/uploads/'.length)));
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid local media path.');
    if ((await fs.stat(file)).size > maxBytes) throw new Error('Media is too large.');
    return fs.readFile(file);
  }
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || redirects > 4) throw new Error('A public HTTPS media URL is required.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((entry) => !isPublicTourAddress(entry.address))) throw new Error('Private network media addresses are not allowed.');
  const pinned = addresses.find((entry) => entry.family === 4) || addresses[0];
  return new Promise((resolve, reject) => {
    const request = https.get(url, { lookup: ((_host: string, options: any, callback: any) => {
      if (options?.all) callback(null, [pinned]); else callback(null, pinned.address, pinned.family);
    }) as any }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadTourMedia(new URL(response.headers.location, url).href, maxBytes, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error('Could not download the selected media.')); return; }
      const chunks: Buffer[] = []; let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { request.destroy(new Error('Media exceeds the download limit.')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(45_000, () => request.destroy(new Error('Media download timed out.')));
    request.on('error', reject);
  });
}

export async function saveTourAsset(buffer: Buffer, name: string, contentType: string): Promise<string> {
  const { storage } = await import('../firebase');
  const file = storage.bucket().file(`world-tour/${name}`);
  await file.save(buffer, { public: true, resumable: false, metadata: { contentType, cacheControl: 'public,max-age=31536000,immutable' } });
  return `https://storage.googleapis.com/${storage.bucket().name}/world-tour/${name}`;
}

/** A fixed 1K contact sheet carries all nine approved frames inside H3 Max's included 4K reference-token allowance. */
export async function prepareTourStoryboardSheet(projectId: string, urls: string[]): Promise<string> {
  if (urls.length !== 9 || urls.some((url) => !/^https:\/\//.test(url))) throw new Error('The approved nine-shot board is required.');
  const cells = await Promise.all(urls.map(async (url) => sharp(await downloadTourMedia(url, 20 * 1024 * 1024))
    .rotate().resize(300, 300, { fit: 'cover', position: 'attention' }).jpeg({ quality: 88 }).toBuffer()));
  const layers: sharp.OverlayOptions[] = cells.map((input, index) => ({ input, left: 25 + (index % 3) * 325, top: 25 + Math.floor(index / 3) * 325 }));
  const labels = cells.map((_cell, index) => ({ input: Buffer.from(`<svg width="300" height="40"><rect width="300" height="40" fill="rgba(0,0,0,.7)"/><text x="14" y="27" fill="white" font-size="20" font-family="Arial">SHOT ${String(index + 1).padStart(2, '0')}</text></svg>`),
    left: 25 + (index % 3) * 325, top: 25 + Math.floor(index / 3) * 325 + 260 }));
  const sheet = await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#080808' } })
    .composite([...layers, ...labels]).jpeg({ quality: 90 }).toBuffer();
  return saveTourAsset(sheet, `${projectId}/references/nine-shot-board.jpg`, 'image/jpeg');
}

type TourMediaIO = { download: typeof downloadTourMedia; save: typeof saveTourAsset };
const mediaIO: TourMediaIO = { download: downloadTourMedia, save: saveTourAsset };

async function inTemp<T>(action: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'boostify-world-tour-'));
  try { return await action(dir); }
  finally {
    for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file)).catch(() => {});
    await fs.rmdir(dir).catch(() => {});
  }
}

export async function prepareTourAudio(audioUrl: string, start: number, key: string, io: TourMediaIO = mediaIO): Promise<string> {
  return inTemp(async (dir) => {
    const source = path.join(dir, 'source.audio'); const output = path.join(dir, 'clip.wav');
    await fs.writeFile(source, await io.download(audioUrl));
    await run(ffmpegPath, ['-y', '-stream_loop', '-1', '-ss', String(start), '-i', source, '-t', '15', '-vn',
      '-af', 'asetpts=N/SR/TB,atrim=duration=15,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.08,afade=t=out:st=14.85:d=0.15', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', output], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    const audio = await fs.readFile(output);
    if (audio.length < 10_000) throw new Error('The selected song fragment could not be prepared.');
    return io.save(audio, `${key}/song-15s.wav`, 'audio/wav');
  });
}

export async function finishTourVideo(videoUrl: string, audioUrl: string, ambienceUrl: string, key: string, io: TourMediaIO = mediaIO): Promise<string> {
  return inTemp(async (dir) => {
    const visual = path.join(dir, 'visual.mp4'); const audio = path.join(dir, 'song.mp3');
    const ambience = path.join(dir, 'ambience.mp4'); const output = path.join(dir, 'concert.mp4');
    const [v, a, crowd] = await Promise.all([io.download(videoUrl), io.download(audioUrl), io.download(ambienceUrl)]);
    await Promise.all([fs.writeFile(visual, v), fs.writeFile(audio, a), fs.writeFile(ambience, crowd)]);
    let hasAmbience = false;
    try { await run(ffmpegPath, ['-hide_banner', '-i', ambience], { timeout: 15_000 }); }
    catch (error: any) { hasAmbience = /Audio:/.test(error.stderr || ''); }
    const inputs = ['-y', '-i', visual, '-i', audio, ...(hasAmbience ? ['-i', ambience] : [])];
    const mapping = hasAmbience
      ? ['-filter_complex', '[2:a]volume=0.10[crowd];[1:a][crowd]amix=inputs=2:duration=first:dropout_transition=0,volume=2,alimiter=limit=0.95[mix]', '-map', '0:v:0', '-map', '[mix]']
      : ['-map', '0:v:0', '-map', '1:a:0'];
    await run(ffmpegPath, [...inputs, ...mapping, '-t', '15', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output], { timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
    const final = await fs.readFile(output);
    if (final.length < 10_000) throw new Error('The concert video could not be finalized.');
    return io.save(final, `${key}/concert.mp4`, 'video/mp4');
  });
}
