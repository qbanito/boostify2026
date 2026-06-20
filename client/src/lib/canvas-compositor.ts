/**
 * Canvas Compositor — Composes multiple video streams into a single output
 * Supports layouts: solo, split, grid, pip, interview
 * Renders at 30fps via requestAnimationFrame
 */

export type LayoutMode = 'solo' | 'split' | 'grid' | 'pip' | 'interview';

interface VideoSource {
  id: string;
  displayName: string;
  stream: MediaStream;
  videoElement: HTMLVideoElement;
  isMuted?: boolean;
}

interface OverlayConfig {
  showLowerThirds: boolean;
  lowerThirdText?: string;
  lowerThirdSubtext?: string;
  logoUrl?: string;
  tickerText?: string;
}

export class CanvasCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sources: Map<string, VideoSource> = new Map();
  private layout: LayoutMode = 'solo';
  private focusSourceId: string | null = null;
  private animFrameId: number | null = null;
  private overlay: OverlayConfig = { showLowerThirds: false };
  private outputStream: MediaStream | null = null;

  constructor(width = 1280, height = 720) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getOutputStream(fps = 30): MediaStream {
    if (!this.outputStream) {
      this.outputStream = this.canvas.captureStream(fps);
    }
    return this.outputStream;
  }

  addSource(id: string, displayName: string, stream: MediaStream): void {
    // Create hidden video element to capture frames
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.play().catch(() => {});

    this.sources.set(id, { id, displayName, stream, videoElement: video });

    // Auto-update layout to match participant count
    if (!this.animFrameId) {
      this.startRendering();
    }
  }

  removeSource(id: string): void {
    const source = this.sources.get(id);
    if (source) {
      source.videoElement.pause();
      source.videoElement.srcObject = null;
      this.sources.delete(id);
    }
    if (this.focusSourceId === id) {
      this.focusSourceId = null;
    }
  }

  setLayout(layout: LayoutMode, focusId?: string): void {
    this.layout = layout;
    if (focusId) this.focusSourceId = focusId;
  }

  setOverlay(config: Partial<OverlayConfig>): void {
    this.overlay = { ...this.overlay, ...config };
  }

  private startRendering(): void {
    const render = () => {
      this.renderFrame();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  private renderFrame(): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Black background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const sources = Array.from(this.sources.values());
    if (sources.length === 0) {
      this.renderNoSources(ctx, width, height);
      return;
    }

    switch (this.layout) {
      case 'solo':
        this.renderSolo(ctx, sources, width, height);
        break;
      case 'split':
        this.renderSplit(ctx, sources, width, height);
        break;
      case 'grid':
        this.renderGrid(ctx, sources, width, height);
        break;
      case 'pip':
        this.renderPIP(ctx, sources, width, height);
        break;
      case 'interview':
        this.renderInterview(ctx, sources, width, height);
        break;
    }

    // Render overlays
    if (this.overlay.showLowerThirds && this.overlay.lowerThirdText) {
      this.renderLowerThird(ctx, width, height);
    }
    if (this.overlay.tickerText) {
      this.renderTicker(ctx, width, height);
    }
  }

  private renderNoSources(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#888';
    ctx.font = '24px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for participants...', w / 2, h / 2);
  }

  private renderSolo(ctx: CanvasRenderingContext2D, sources: VideoSource[], w: number, h: number): void {
    const src = this.focusSourceId ? this.sources.get(this.focusSourceId) || sources[0] : sources[0];
    this.drawVideo(ctx, src.videoElement, 0, 0, w, h);
    this.drawNameTag(ctx, src.displayName, w / 2, h - 40);
  }

  private renderSplit(ctx: CanvasRenderingContext2D, sources: VideoSource[], w: number, h: number): void {
    const gap = 4;
    const halfW = (w - gap) / 2;
    for (let i = 0; i < Math.min(sources.length, 2); i++) {
      const x = i * (halfW + gap);
      this.drawVideo(ctx, sources[i].videoElement, x, 0, halfW, h);
      this.drawNameTag(ctx, sources[i].displayName, x + halfW / 2, h - 40);
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D, sources: VideoSource[], w: number, h: number): void {
    const count = sources.length;
    const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const gap = 4;
    const cellW = (w - gap * (cols - 1)) / cols;
    const cellH = (h - gap * (rows - 1)) / rows;

    sources.forEach((src, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellW + gap);
      const y = row * (cellH + gap);
      this.drawVideo(ctx, src.videoElement, x, y, cellW, cellH);
      this.drawNameTag(ctx, src.displayName, x + cellW / 2, y + cellH - 30);
    });
  }

  private renderPIP(ctx: CanvasRenderingContext2D, sources: VideoSource[], w: number, h: number): void {
    // Main source = first or focused
    const main = this.focusSourceId ? this.sources.get(this.focusSourceId) || sources[0] : sources[0];
    this.drawVideo(ctx, main.videoElement, 0, 0, w, h);
    this.drawNameTag(ctx, main.displayName, w / 2, h - 40);

    // PIP: small windows in bottom-right
    const pipW = w * 0.25;
    const pipH = h * 0.25;
    const others = sources.filter(s => s.id !== main.id);
    others.forEach((src, i) => {
      const x = w - pipW - 20;
      const y = h - pipH - 20 - i * (pipH + 10);
      // PIP border
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(x - 2, y - 2, pipW + 4, pipH + 4);
      this.drawVideo(ctx, src.videoElement, x, y, pipW, pipH);
      this.drawNameTag(ctx, src.displayName, x + pipW / 2, y + pipH - 20, 12);
    });
  }

  private renderInterview(ctx: CanvasRenderingContext2D, sources: VideoSource[], w: number, h: number): void {
    // Interview layout: host left 60%, guest right 40%
    const gap = 4;
    const leftW = w * 0.6 - gap / 2;
    const rightW = w * 0.4 - gap / 2;

    if (sources[0]) {
      this.drawVideo(ctx, sources[0].videoElement, 0, 0, leftW, h);
      this.drawNameTag(ctx, sources[0].displayName, leftW / 2, h - 40);
    }
    if (sources[1]) {
      this.drawVideo(ctx, sources[1].videoElement, leftW + gap, 0, rightW, h);
      this.drawNameTag(ctx, sources[1].displayName, leftW + gap + rightW / 2, h - 40);
    }
    // Extra guests in smaller tiles on the right
    for (let i = 2; i < sources.length; i++) {
      const tileH = h / (sources.length - 1);
      const y = (i - 1) * tileH;
      this.drawVideo(ctx, sources[i].videoElement, leftW + gap, y, rightW, tileH - gap);
      this.drawNameTag(ctx, sources[i].displayName, leftW + gap + rightW / 2, y + tileH - gap - 20, 11);
    }
  }

  private drawVideo(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, x: number, y: number, w: number, h: number): void {
    if (video.readyState >= 2) {
      // Cover-fit: maintain aspect ratio
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      const scale = Math.max(w / vw, h / vh);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, x, y, w, h);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y, w, h);
    }
  }

  private drawNameTag(ctx: CanvasRenderingContext2D, name: string, cx: number, y: number, fontSize = 14): void {
    ctx.save();
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    const metrics = ctx.measureText(name);
    const tw = metrics.width + 16;
    const th = fontSize + 10;
    const rx = cx - tw / 2;

    // Semi-transparent bg
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(rx, y - th + 2, tw, th, 4);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(name, cx, y - 3);
    ctx.restore();
  }

  private renderLowerThird(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const barH = 60;
    const y = h - barH - 40;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, w * 0.6, y);
    grad.addColorStop(0, 'rgba(124,58,237,0.9)');
    grad.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, w * 0.6, barH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.overlay.lowerThirdText || '', 20, y + 25);

    if (this.overlay.lowerThirdSubtext) {
      ctx.font = '14px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(this.overlay.lowerThirdSubtext, 20, y + 45);
    }
  }

  private renderTicker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const barH = 28;
    const y = h - barH;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, y, w, barH);
    ctx.fillStyle = '#a78bfa';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'left';
    // Scrolling ticker — position based on time
    const offset = (Date.now() / 30) % (w + ctx.measureText(this.overlay.tickerText!).width);
    ctx.fillText(this.overlay.tickerText!, w - offset, y + 19);
  }

  destroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.sources.forEach(src => {
      src.videoElement.pause();
      src.videoElement.srcObject = null;
    });
    this.sources.clear();
    this.outputStream = null;
  }
}
