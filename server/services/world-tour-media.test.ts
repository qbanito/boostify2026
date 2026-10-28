import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { prepareTourAudio, finishTourVideo, downloadTourMedia, isPublicTourAddress } from './world-tour-media';

const run = promisify(execFile); const require = createRequire(import.meta.url);
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;
let dir: string; let song: Buffer; let video: Buffer; let prepared: Buffer;
before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'boostify-tour-test-'));
  await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', path.join(dir, 'song.wav')]);
  await run(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=15:duration=15', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=15', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', path.join(dir, 'video.mp4')]);
  song = await fs.readFile(path.join(dir, 'song.wav')); video = await fs.readFile(path.join(dir, 'video.mp4'));
});
after(async () => { if (dir) { for (const file of await fs.readdir(dir)) await fs.unlink(path.join(dir, file)); await fs.rmdir(dir); } });
async function probe(buffer: Buffer, file: string) {
  const output = path.join(dir, file); await fs.writeFile(output, buffer);
  try { await run(ffmpeg, ['-hide_banner', '-i', output]); } catch (error: any) { return String(error.stderr); }
  return '';
}
test('a short source track loops into a usable 15-second reference audio clip', async () => {
  const url = await prepareTourAudio('https://example.test/song.wav', 1, 'operation', {
    download: async () => song,
    save: async (buffer, name, type) => { prepared = buffer; assert.equal(name, 'operation/song-15s.wav'); assert.equal(type, 'audio/wav'); return 'https://example.test/clipped.wav'; },
  });
  assert.equal(url, 'https://example.test/clipped.wav');
  const info = await probe(prepared, 'prepared.wav'); assert.match(info, /Duration: 00:00:15\.00/); assert.match(info, /Audio: pcm_s16le/);
});
test('the final concert contains a 15-second video and the original song mixed with ambience', async () => {
  let final: Buffer | undefined;
  await finishTourVideo('https://example.test/video.mp4', 'https://example.test/clipped.mp3', 'https://example.test/ambience.mp4', 'operation', {
    download: async (url) => url.includes('clipped') ? prepared : video,
    save: async (buffer, name, type) => { final = buffer; assert.equal(name, 'operation/concert.mp4'); assert.equal(type, 'video/mp4'); return 'https://example.test/final.mp4'; },
  });
  const info = await probe(final!, 'final.mp4'); assert.match(info, /Duration: 00:00:15\./); assert.match(info, /Video: h264/); assert.match(info, /Audio: aac/);
});
test('media downloads reject local networks and non-HTTPS schemes before making a request', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.31.0.1', '192.168.1.1', '169.254.169.254', '100.64.1.1', '::1', '::ffff:127.0.0.1', 'fe80::1']) assert.equal(isPublicTourAddress(address), false, address);
  assert.equal(isPublicTourAddress('8.8.8.8'), true);
  await assert.rejects(() => downloadTourMedia('https://127.0.0.1/secret'));
  await assert.rejects(() => downloadTourMedia('http://example.com/song.mp3'));
  await assert.rejects(() => downloadTourMedia('/uploads/../../.env'));
});
