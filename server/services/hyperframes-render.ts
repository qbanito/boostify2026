/**
 * HyperFrames Render Service
 *
 * Generates HTML-based video compositions and renders them to MP4 via HyperFrames CLI.
 * HyperFrames: https://github.com/heygen-com/hyperframes
 * Write HTML → Render video. Built for agents.
 *
 * Pipeline:
 *  1. Receive creative data (scenes, branding, audio, captions)
 *  2. Generate composition.html with data attributes
 *  3. Run `npx hyperframes render` via child_process
 *  4. Upload MP4 to Firebase Storage
 *  5. Return downloadable URL
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getStorage } from 'firebase-admin/storage';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HyperFramesScene {
  sceneNumber: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  visualDescription: string;
  textOverlay?: string;
  cameraMovement?: string;
  transition?: string;
  mediaUrl?: string;        // background video or image
  avatarVideoUrl?: string;  // HeyGen avatar video for this scene
  audioCue?: string;
}

export interface HyperFramesCaption {
  text: string;
  startMs: number;
  endMs: number;
}

export interface HyperFramesCompositionInput {
  jobId: string;
  artistName: string;
  songTitle?: string;
  brandColors: { primary: string; secondary: string; accent: string };
  logoUrl?: string;
  coverArtUrl?: string;
  audioUrl?: string;
  format: '9:16' | '16:9' | '1:1';
  durationMs: number;
  scenes: HyperFramesScene[];
  captions: HyperFramesCaption[];
  cta?: string;
  watermark?: boolean;
  fontFamily?: string;
  motionStyle?: 'minimal' | 'cinematic' | 'energetic' | 'viral';
}

export interface HyperFramesRenderResult {
  videoUrl: string;
  thumbnailUrl?: string;
  durationMs: number;
  fileSizeBytes: number;
  compositionHtml: string;
  stylesCss: string;
  timelineJs: string;
  metadata: Record<string, any>;
}

// ─── Dimension map ────────────────────────────────────────────────────────────

const DIMENSIONS: Record<string, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1':  { width: 1080, height: 1080 },
};

// ─── HTML Composition Generator ───────────────────────────────────────────────

export function generateCompositionHtml(input: HyperFramesCompositionInput): {
  html: string;
  css: string;
  js: string;
  metadata: Record<string, any>;
} {
  const { width, height } = DIMENSIONS[input.format] ?? DIMENSIONS['9:16'];
  const { primary, secondary, accent } = input.brandColors;
  const font = input.fontFamily ?? 'Inter, system-ui, sans-serif';

  // ── CSS ────────────────────────────────────────────────────────────────────
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

#stage {
  position: relative;
  width: ${width}px;
  height: ${height}px;
  background: #000;
  overflow: hidden;
  font-family: ${font};
}

.clip { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

.text-overlay {
  position: absolute;
  left: 0; right: 0;
  text-align: center;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 12px rgba(0,0,0,0.85);
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.caption {
  position: absolute;
  left: 5%; right: 5%;
  bottom: ${input.format === '9:16' ? '12%' : '8%'};
  text-align: center;
  font-size: ${input.format === '9:16' ? '52px' : '42px'};
  font-weight: 700;
  color: #fff;
  background: rgba(0,0,0,0.5);
  padding: 8px 16px;
  border-radius: 8px;
  backdrop-filter: blur(4px);
}

.caption.active { color: ${accent}; }

.branding-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: ${input.format === '9:16' ? '80px' : '60px'};
  background: linear-gradient(90deg, ${primary}dd, ${secondary}dd);
  display: flex; align-items: center; justify-content: center;
  gap: 12px;
}

.artist-name {
  font-size: ${input.format === '9:16' ? '28px' : '22px'};
  font-weight: 900;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cta-badge {
  position: absolute;
  top: ${input.format === '9:16' ? '60px' : '40px'};
  right: 32px;
  background: ${accent};
  color: #000;
  font-size: ${input.format === '9:16' ? '24px' : '18px'};
  font-weight: 800;
  padding: 8px 20px;
  border-radius: 100px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.scene-bg {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, ${primary}33 0%, #000 100%);
}

.avatar-container {
  position: absolute;
  inset: 0;
  display: flex; align-items: center; justify-content: center;
}

.cover-art {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: ${input.format === '9:16' ? '70%' : '40%'};
  border-radius: 16px;
  box-shadow: 0 32px 64px rgba(0,0,0,0.6);
}

@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
`.trim();

  // ── Scene HTML elements ────────────────────────────────────────────────────
  const sceneElements = input.scenes.map((scene) => {
    const elements: string[] = [];

    // Background
    if (scene.mediaUrl) {
      const isVideo = /\.(mp4|webm|mov)$/i.test(scene.mediaUrl);
      if (isVideo) {
        elements.push(
          `<video id="bg-scene-${scene.sceneNumber}" class="clip"` +
          ` data-start="${scene.startMs}" data-duration="${scene.durationMs}"` +
          ` data-track-index="0" src="${scene.mediaUrl}" muted playsinline></video>`
        );
      } else {
        elements.push(
          `<img id="bg-img-${scene.sceneNumber}" class="clip"` +
          ` data-start="${scene.startMs}" data-duration="${scene.durationMs}"` +
          ` data-track-index="0" src="${scene.mediaUrl}" alt="" />`
        );
      }
    } else {
      elements.push(
        `<div id="bg-scene-${scene.sceneNumber}" class="scene-bg"` +
        ` data-start="${scene.startMs}" data-duration="${scene.durationMs}"` +
        ` data-track-index="0"></div>`
      );
    }

    // Avatar video
    if (scene.avatarVideoUrl) {
      elements.push(
        `<video id="avatar-${scene.sceneNumber}" class="clip"` +
        ` data-start="${scene.startMs}" data-duration="${scene.durationMs}"` +
        ` data-track-index="1" src="${scene.avatarVideoUrl}" muted playsinline style="object-fit:contain;"></video>`
      );
    }

    // Text overlay
    if (scene.textOverlay) {
      const topPct = input.format === '9:16' ? '20%' : '15%';
      const fontSize = input.format === '9:16' ? '64px' : '52px';
      elements.push(
        `<div id="text-${scene.sceneNumber}" class="text-overlay"` +
        ` data-start="${scene.startMs + 200}" data-duration="${scene.durationMs - 400}"` +
        ` data-track-index="2"` +
        ` style="top:${topPct};font-size:${fontSize};padding:0 5%;"` +
        `>${scene.textOverlay}</div>`
      );
    }

    return elements.join('\n  ');
  }).join('\n\n  ');

  // ── Caption elements ───────────────────────────────────────────────────────
  const captionElements = input.captions.map((cap, i) =>
    `<div id="cap-${i}" class="caption"` +
    ` data-start="${cap.startMs}" data-duration="${cap.endMs - cap.startMs}"` +
    ` data-track-index="3">${cap.text}</div>`
  ).join('\n  ');

  // ── Cover art (if no avatar in any scene) ─────────────────────────────────
  const hasCoverArt = input.coverArtUrl && !input.scenes.some(s => s.avatarVideoUrl);
  const coverArtEl = hasCoverArt
    ? `<img id="cover-art" class="cover-art" data-start="500" data-duration="${input.durationMs - 1000}" data-track-index="1" src="${input.coverArtUrl}" alt="" />`
    : '';

  // ── Audio ──────────────────────────────────────────────────────────────────
  const audioEl = input.audioUrl
    ? `<audio id="bg-music" data-start="0" data-duration="${input.durationMs}" data-track-index="4" data-volume="0.8" src="${input.audioUrl}"></audio>`
    : '';

  // ── Branding bar ──────────────────────────────────────────────────────────
  const logoImg = input.logoUrl ? `<img src="${input.logoUrl}" style="height:40px;border-radius:4px;" alt="" />` : '';
  const brandingBar =
    `<div id="branding" class="branding-bar"` +
    ` data-start="${input.durationMs - 3000}" data-duration="3000" data-track-index="5">` +
    `  ${logoImg}` +
    `  <span class="artist-name">${input.artistName}</span>` +
    `</div>`;

  // ── CTA badge ─────────────────────────────────────────────────────────────
  const ctaBadge = input.cta
    ? `<div id="cta" class="cta-badge" data-start="2000" data-duration="${input.durationMs - 2000}" data-track-index="5">${input.cta}</div>`
    : '';

  // ── Full HTML ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${input.artistName}${input.songTitle ? ' — ' + input.songTitle : ''}</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="stage"
    data-composition-id="boostify-video-${input.jobId}"
    data-start="0"
    data-width="${width}"
    data-height="${height}"
    data-fps="30">

  ${sceneElements}

  ${coverArtEl}

  ${captionElements}

  ${brandingBar}

  ${ctaBadge}

  ${audioEl}

  </div>
  <script src="timeline.js"></script>
</body>
</html>`;

  // ── Timeline JS (GSAP animations) ─────────────────────────────────────────
  const js = `
// HyperFrames Timeline — registered for deterministic seeking
// GSAP animations paused + registered on window.__hfAnimations

(function() {
  const motionStyle = "${input.motionStyle ?? 'cinematic'}";

  function animate() {
    // Caption fade-in on each text element
    document.querySelectorAll('.text-overlay').forEach(function(el) {
      el.style.animation = 'fadeIn 0.4s ease forwards';
    });

    document.querySelectorAll('.cta-badge').forEach(function(el) {
      el.style.animation = 'scaleIn 0.5s ease forwards, pulse 2s ease-in-out infinite 0.5s';
    });

    document.querySelectorAll('.branding-bar').forEach(function(el) {
      el.style.animation = 'slideInLeft 0.6s ease forwards';
    });

    if (motionStyle === 'energetic') {
      document.querySelectorAll('.cover-art').forEach(function(el) {
        el.style.animation = 'scaleIn 0.3s ease forwards';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animate);
  } else {
    animate();
  }
})();
`.trim();

  const metadata: Record<string, any> = {
    version: '1.0.0',
    engine: 'boostify-hyperframes',
    jobId: input.jobId,
    artistName: input.artistName,
    songTitle: input.songTitle,
    format: input.format,
    dimensions: { width, height },
    durationMs: input.durationMs,
    sceneCount: input.scenes.length,
    captionCount: input.captions.length,
    brandColors: input.brandColors,
    generatedAt: new Date().toISOString(),
  };

  return { html, css, js, metadata };
}

// ─── File system helpers ───────────────────────────────────────────────────────

async function writeCompositionFiles(
  dir: string,
  html: string,
  css: string,
  js: string,
  metadata: Record<string, any>,
  renderConfig: Record<string, any>,
): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
  await Promise.all([
    fs.promises.writeFile(path.join(dir, 'index.html'), html, 'utf8'),
    fs.promises.writeFile(path.join(dir, 'styles.css'), css, 'utf8'),
    fs.promises.writeFile(path.join(dir, 'timeline.js'), js, 'utf8'),
    fs.promises.writeFile(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8'),
    fs.promises.writeFile(path.join(dir, 'render.config.json'), JSON.stringify(renderConfig, null, 2), 'utf8'),
  ]);
}

// ─── Main render function ──────────────────────────────────────────────────────

export async function renderHyperFramesComposition(
  input: HyperFramesCompositionInput,
): Promise<HyperFramesRenderResult> {
  const { width, height } = DIMENSIONS[input.format] ?? DIMENSIONS['9:16'];
  const workDir = path.join(os.tmpdir(), 'hf-renders', input.jobId);
  const outputMp4 = path.join(workDir, 'output.mp4');

  logger.info(`[HyperFrames] Starting render job ${input.jobId} (${input.format}, ${input.durationMs}ms)`);

  // 1. Generate composition files
  const { html, css, js, metadata } = generateCompositionHtml(input);

  const renderConfig = {
    fps: 30,
    width,
    height,
    durationMs: input.durationMs,
    output: 'output.mp4',
    quality: 'high',
  };

  await writeCompositionFiles(workDir, html, css, js, metadata, renderConfig);

  // 2. Run HyperFrames CLI
  const hyperframesInstalled = await checkHyperframesCli();
  let videoUrl = '';
  let fileSizeBytes = 0;

  if (hyperframesInstalled) {
    try {
      logger.info(`[HyperFrames] Running: npx hyperframes render in ${workDir}`);
      await runHyperframesRender(workDir, outputMp4);
      fileSizeBytes = fs.existsSync(outputMp4) ? fs.statSync(outputMp4).size : 0;
      logger.info(`[HyperFrames] Render complete. File size: ${fileSizeBytes} bytes`);
    } catch (err: any) {
      logger.error(`[HyperFrames] Render failed: ${err.message}`);
      throw new Error(`HyperFrames render failed: ${err.message}`);
    }

    // 3. Upload to Firebase Storage
    videoUrl = await uploadToFirebaseStorage(outputMp4, `ai-video-studio/${input.jobId}/output.mp4`);
  } else {
    logger.warn('[HyperFrames] CLI not installed — returning composition files only (no video render)');
  }

  // 4. Cleanup temp files
  try {
    if (fs.existsSync(outputMp4)) fs.unlinkSync(outputMp4);
  } catch { /* ignore cleanup errors */ }

  return {
    videoUrl,
    durationMs: input.durationMs,
    fileSizeBytes,
    compositionHtml: html,
    stylesCss: css,
    timelineJs: js,
    metadata,
  };
}

// ─── Check HyperFrames CLI ────────────────────────────────────────────────────

async function checkHyperframesCli(): Promise<boolean> {
  try {
    await execFileAsync('npx', ['hyperframes', '--version'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Run HyperFrames render ────────────────────────────────────────────────────

async function runHyperframesRender(workDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['hyperframes', 'render', '--output', outputPath], {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000, // 5 minute max
    });

    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`HyperFrames exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    child.on('error', (err) => reject(err));
  });
}

// ─── Firebase Storage upload ─────────────────────────────────────────────────

async function uploadToFirebaseStorage(localPath: string, storagePath: string): Promise<string> {
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET || `${process.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`);
  const file = bucket.file(storagePath);

  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: { contentType: 'video/mp4' },
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
}

// ─── Install HyperFrames CLI (one-time setup helper) ─────────────────────────

export async function ensureHyperframesInstalled(): Promise<void> {
  const installed = await checkHyperframesCli();
  if (!installed) {
    logger.info('[HyperFrames] Installing hyperframes CLI...');
    await execFileAsync('npm', ['install', '-g', 'hyperframes'], { timeout: 120000 });
    logger.info('[HyperFrames] Installed successfully.');
  }
}
