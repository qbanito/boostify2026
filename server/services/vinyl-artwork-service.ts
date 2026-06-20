/**
 * Vinyl Artwork Service — Boostify
 * ================================
 * Auto-generates print-ready vinyl artwork for a release:
 *   • FRONT cover  — spectacular album art + album title + artist + "Created by Boostify"
 *   • BACK cover   — full tracklist (song titles + durations) + credits + barcode
 *   • BOOK (booklet) — multi-page insert built from the artist's gallery images
 *                      with crisp text overlays (lyrics / song titles / credits)
 *
 * All assets are rendered at PRINT dimensions (12" sleeve @ 300 DPI = 3600×3600 px)
 * so they can be sent straight to a pressing plant (Diggers Factory etc.).
 *
 * Photographic layers come from AI (gpt-image-1) or the artist's existing high-res
 * art; ALL TEXT is composited as razor-sharp vector SVG via sharp (AI models render
 * garbled text — never trust them for typography on a printable asset).
 */
import sharp from 'sharp';
import { storage } from '../firebase';
import { generateImageWithGPTImage1 } from './fal-service';
import { logger } from '../utils/logger';

// ─── Print spec ───────────────────────────────────────────────────────────────
/** 12" vinyl sleeve artwork @ 300 DPI (12.0" = 3600 px). Square format. */
export const PRINT_SIZE = 3600;
export const PRINT_DPI = 300;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ArtworkTrack {
  side?: string;
  track?: number;
  title: string;
  duration?: string;
}

export interface VinylArtworkInput {
  artistId: number;
  artistName: string;
  albumTitle: string;
  subtitle?: string;
  genre?: string;
  accentColor?: string;          // hex, e.g. "#c9a96a"
  tracklist: ArtworkTrack[];
  galleryImages?: string[];      // for the booklet pages
  baseArtUrl?: string;           // artist's existing high-res art (preferred base)
  lyricsByTitle?: Record<string, string>; // optional lyric line per song title
  includeBook?: boolean;
  generateAi?: boolean;          // try AI base art generation (default true)
}

export interface VinylArtworkResult {
  frontUrl: string;
  backUrl: string;
  bookPages: { url: string; label: string }[];
  provider: string;
  meta: { widthPx: number; heightPx: number; dpi: number; format: string };
}

// ─── Small helpers ──────────────────────────────────────────────────────────
function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function safeHex(hex?: string, fallback = '#c9a96a'): string {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

/** Word-wrap into at most maxLines lines of ~maxChars. */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= maxChars) {
      cur = (cur + ' ' + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    const used = lines.join(' ').length;
    if (used < (text || '').length) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    }
  }
  return lines.slice(0, maxLines);
}

async function downloadToBuffer(url?: string): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    logger.warn?.('[vinyl-artwork] download failed:', (e as Error)?.message);
    return null;
  }
}

/** Produces a rich brand-colored gradient canvas as a guaranteed base layer. */
async function gradientBase(accent: string): Promise<Buffer> {
  const S = PRINT_SIZE;
  const svg = `
    <svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stop-color="${accent}"/>
          <stop offset="42%" stop-color="#1a1714"/>
          <stop offset="100%" stop-color="#050505"/>
        </radialGradient>
        <radialGradient id="halo" cx="50%" cy="42%" r="40%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="url(#g)"/>
      <circle cx="${S / 2}" cy="${S * 0.42}" r="${S * 0.34}" fill="url(#halo)"/>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Resolve the photographic base layer: artist art → AI → gradient. */
async function resolveBaseArt(input: VinylArtworkInput, accent: string): Promise<{ buffer: Buffer; provider: string }> {
  // 1. Artist's existing high-res art (preferred — usually best likeness/quality)
  const existing = await downloadToBuffer(input.baseArtUrl);
  if (existing) return { buffer: existing, provider: 'artist-art' };

  // 2. AI generated spectacular cover art
  if (input.generateAi !== false) {
    try {
      const prompt =
        `Album cover artwork for ${input.genre || 'music'} artist "${input.artistName}", ` +
        `album titled "${input.albumTitle}". Spectacular, premium, cinematic, gallery-quality, ` +
        `dramatic lighting, rich textures, bold conceptual art direction, vinyl record aesthetic, ` +
        `cohesive color palette around ${accent}. Absolutely NO text, NO words, NO letters, NO logos — ` +
        `pure imagery only, leaving clean negative space at the bottom third for a title.`;
      const ai = await generateImageWithGPTImage1(prompt, { size: '1024x1024', quality: 'high' });
      if (ai?.success && ai.imageUrl) {
        const buf = await downloadToBuffer(ai.imageUrl);
        if (buf) return { buffer: buf, provider: 'gpt-image-1' };
      }
    } catch (e) {
      logger.warn?.('[vinyl-artwork] AI base art failed:', (e as Error)?.message);
    }
  }

  // 3. Guaranteed gradient fallback
  return { buffer: await gradientBase(accent), provider: 'gradient' };
}

/** Persist a buffer to Firebase Storage and return a public URL. */
async function persist(buffer: Buffer, artistId: number, name: string): Promise<string> {
  const bucket = storage.bucket();
  const fileName = `vinyl-artwork/${artistId}/${Date.now()}_${name}.jpg`;
  const file = bucket.file(fileName);
  await file.save(buffer, { metadata: { contentType: 'image/jpeg' }, public: true, validation: false });
  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
}

// ─── Front cover ──────────────────────────────────────────────────────────────
async function composeFront(baseArt: Buffer, input: VinylArtworkInput, accent: string): Promise<Buffer> {
  const S = PRINT_SIZE;
  const base = await sharp(baseArt).resize(S, S, { fit: 'cover', position: 'attention', kernel: 'lanczos3' }).toBuffer();

  const pad = Math.round(S * 0.07);
  const avail = S - pad * 2;

  // Auto-fit album title (serif bold caps are wide → use a generous glyph ratio)
  const SERIF_CAP_W = 0.66;
  let titleFont = Math.round(S * 0.088);
  const titleRaw = escapeXml(input.albumTitle.toUpperCase());
  let titleLines: string[] = [];
  for (let i = 0; i < 8; i++) {
    const maxChars = Math.max(5, Math.floor(avail / (titleFont * SERIF_CAP_W)));
    titleLines = wrapLines(titleRaw, maxChars, 3);
    const longest = titleLines.reduce((m, l) => Math.max(m, l.length), 0);
    if (longest * titleFont * SERIF_CAP_W <= avail || titleFont <= S * 0.035) break;
    titleFont = Math.round(titleFont * 0.9);
  }
  const titleLH = Math.round(titleFont * 1.06);
  const artistFont = Math.round(titleFont * 0.34);
  const subFont = Math.round(titleFont * 0.26);
  const blockH = titleLines.length * titleLH;
  const subY = input.subtitle ? Math.round(subFont * 1.7) : 0;

  const baseY = S - pad - subY;          // bottom of title block
  const titleTop = baseY - blockH;
  const artistY = titleTop - Math.round(artistFont * 0.7);

  const titleSpans = titleLines
    .map((ln, i) => `<text x="${pad}" y="${titleTop + (i + 1) * titleLH - Math.round(titleLH * 0.22)}" font-family="'DejaVu Serif','Georgia',serif" font-size="${titleFont}" font-weight="800" fill="#ffffff" letter-spacing="1">${ln}</text>`)
    .join('');

  const subSvg = input.subtitle
    ? `<text x="${pad}" y="${baseY + subFont}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${subFont}" font-weight="500" fill="#ffffff" fill-opacity="0.82" letter-spacing="4">${escapeXml(input.subtitle.toUpperCase())}</text>`
    : '';

  const creditFont = Math.round(S * 0.018);
  const svg = `
    <svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
          <stop offset="55%" stop-color="#000000" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.86"/>
        </linearGradient>
      </defs>
      <!-- legibility veil over the lower half -->
      <rect x="0" y="${Math.round(S * 0.42)}" width="${S}" height="${Math.round(S * 0.58)}" fill="url(#veil)"/>
      <!-- elegant inner frame -->
      <rect x="${Math.round(S * 0.028)}" y="${Math.round(S * 0.028)}" width="${S - Math.round(S * 0.056)}" height="${S - Math.round(S * 0.056)}" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="${Math.round(S * 0.0035)}"/>
      <!-- artist name eyebrow with accent tick -->
      <rect x="${pad}" y="${artistY - artistFont}" width="${Math.round(artistFont * 0.45)}" height="${Math.round(artistFont * 1.15)}" fill="${accent}"/>
      <text x="${pad + Math.round(artistFont * 0.85)}" y="${artistY}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${artistFont}" font-weight="700" fill="${accent}" letter-spacing="6">${escapeXml(input.artistName.toUpperCase())}</text>
      ${titleSpans}
      ${subSvg}
      <!-- Boostify credit -->
      <text x="${S - pad}" y="${S - Math.round(S * 0.03)}" text-anchor="end" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${creditFont}" font-weight="600" fill="#ffffff" fill-opacity="0.55" letter-spacing="3">CREATED BY BOOSTIFY</text>
    </svg>`;

  return sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer();
}

// ─── Back cover ───────────────────────────────────────────────────────────────
async function composeBack(input: VinylArtworkInput, accent: string): Promise<Buffer> {
  const S = PRINT_SIZE;
  const pad = Math.round(S * 0.075);
  const year = new Date().getFullYear();

  const sideA = input.tracklist.filter(t => (t.side || 'A').toUpperCase() === 'A' && t.title);
  const sideB = input.tracklist.filter(t => (t.side || '').toUpperCase() === 'B' && t.title);
  // tracks with no side fall into A
  const noSide = input.tracklist.filter(t => !t.side && t.title);
  const colA = sideA.length ? sideA : noSide;
  const colB = sideB;

  const headFont = Math.round(S * 0.052);
  const subFont = Math.round(S * 0.026);
  const sideLabelFont = Math.round(S * 0.026);
  const trackFont = Math.round(S * 0.024);
  const lineGap = Math.round(trackFont * 1.85);

  // Build a column of tracks as SVG
  const renderColumn = (tracks: ArtworkTrack[], label: string, x: number, startY: number, width: number): { svg: string; endY: number } => {
    if (!tracks.length) return { svg: '', endY: startY };
    let y = startY;
    let out = `<text x="${x}" y="${y}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${sideLabelFont}" font-weight="800" fill="${accent}" letter-spacing="4">SIDE ${label}</text>`;
    y += Math.round(sideLabelFont * 2.0);
    tracks.forEach((t, i) => {
      const num = `${label}${t.track || i + 1}`;
      const title = escapeXml(t.title);
      out += `<text x="${x}" y="${y}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${trackFont}" font-weight="400" fill="#ffffff" fill-opacity="0.92">${num}.  ${title}</text>`;
      if (t.duration) {
        out += `<text x="${x + width}" y="${y}" text-anchor="end" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${trackFont}" fill="#ffffff" fill-opacity="0.5">${escapeXml(t.duration)}</text>`;
      }
      y += lineGap;
    });
    return { svg: out, endY: y };
  };

  const headerBottom = pad + headFont + Math.round(subFont * 1.8);
  const listTop = headerBottom + Math.round(S * 0.06);
  const twoCol = colB.length > 0;
  const colWidth = twoCol ? Math.round((S - pad * 2 - S * 0.06) / 2) : (S - pad * 2);
  const colAx = pad;
  const colBx = twoCol ? pad + colWidth + Math.round(S * 0.06) : pad;

  const a = renderColumn(colA, 'A', colAx, listTop, colWidth);
  const b = twoCol ? renderColumn(colB, 'B', colBx, listTop, colWidth) : { svg: '', endY: listTop };

  const creditsY = Math.max(a.endY, b.endY) + Math.round(S * 0.05);
  const creditFont = Math.round(S * 0.0205);
  const credits = [
    `All songs performed by ${input.artistName}`,
    `Produced & released on Boostify`,
    `Artwork & layout created by Boostify`,
    `© ${year} ${input.artistName} · Boostify Records`,
  ];
  const creditSvg = credits
    .map((c, i) => `<text x="${pad}" y="${creditsY + i * Math.round(creditFont * 1.7)}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${creditFont}" fill="#ffffff" fill-opacity="0.6">${escapeXml(c)}</text>`)
    .join('');

  // Decorative barcode (EAN-like vector bars)
  const bcW = Math.round(S * 0.16), bcH = Math.round(S * 0.07);
  const bcX = S - pad - bcW, bcY = S - pad - bcH - Math.round(S * 0.02);
  let bars = `<rect x="${bcX - 14}" y="${bcY - 14}" width="${bcW + 28}" height="${bcH + 40}" rx="8" fill="#ffffff"/>`;
  let bx = bcX;
  let seed = (input.albumTitle + input.artistName).length;
  for (let i = 0; i < 42 && bx < bcX + bcW; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const w = 2 + (seed % 4);
    if (i % 2 === 0) bars += `<rect x="${bx}" y="${bcY}" width="${w}" height="${bcH}" fill="#000000"/>`;
    bx += w + 2;
  }
  bars += `<text x="${bcX + bcW / 2}" y="${bcY + bcH + 22}" text-anchor="middle" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${Math.round(S * 0.012)}" fill="#000000">BOOSTIFY · ${String(year)}</text>`;

  const svg = `
    <svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0d0c0b"/>
          <stop offset="100%" stop-color="#050505"/>
        </linearGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="url(#bg)"/>
      <rect x="0" y="0" width="${S}" height="${Math.round(S * 0.0045)}" fill="${accent}"/>
      <rect x="${Math.round(S * 0.028)}" y="${Math.round(S * 0.028)}" width="${S - Math.round(S * 0.056)}" height="${S - Math.round(S * 0.056)}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="${Math.round(S * 0.002)}"/>
      <text x="${pad}" y="${pad + headFont}" font-family="'DejaVu Serif',Georgia,serif" font-size="${headFont}" font-weight="800" fill="#ffffff" letter-spacing="1">${escapeXml(input.artistName.toUpperCase())}</text>
      <text x="${pad}" y="${pad + headFont + Math.round(subFont * 1.7)}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${subFont}" fill="${accent}" letter-spacing="3">${escapeXml(input.albumTitle.toUpperCase())}${input.subtitle ? ' · ' + escapeXml(input.subtitle.toUpperCase()) : ''}</text>
      <rect x="${pad}" y="${headerBottom + Math.round(S * 0.02)}" width="${S - pad * 2}" height="2" fill="${accent}" fill-opacity="0.4"/>
      ${a.svg}
      ${b.svg}
      ${creditSvg}
      ${bars}
      <text x="${pad}" y="${S - pad - Math.round(S * 0.005)}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${Math.round(S * 0.026)}" font-weight="800" fill="${accent}" letter-spacing="4">CREATED BY BOOSTIFY</text>
    </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

// ─── Booklet pages ─────────────────────────────────────────────────────────────
async function composeBookPage(
  imageBuf: Buffer | null,
  accent: string,
  opts: { eyebrow?: string; headline?: string; body?: string; pageNo?: number; totalPages?: number; titlePage?: boolean },
): Promise<Buffer> {
  const S = PRINT_SIZE;
  const pad = Math.round(S * 0.08);
  let base: Buffer;
  if (imageBuf) {
    base = await sharp(imageBuf).resize(S, S, { fit: 'cover', position: 'attention', kernel: 'lanczos3' }).toBuffer();
  } else {
    base = await gradientBase(accent);
  }

  const headFont = Math.round(S * (opts.titlePage ? 0.085 : 0.05));
  const headRaw = escapeXml((opts.headline || '').toUpperCase());
  const avail = S - pad * 2;
  const SERIF_CAP_W = 0.66;
  let lines: string[] = [];
  let fittedHeadFont = headFont;
  if (headRaw) {
    let f = headFont;
    for (let i = 0; i < 7; i++) {
      const maxChars = Math.max(5, Math.floor(avail / (f * SERIF_CAP_W)));
      lines = wrapLines(headRaw, maxChars, 3);
      const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
      if (longest * f * SERIF_CAP_W <= avail || f <= S * 0.032) break;
      f = Math.round(f * 0.9);
    }
    fittedHeadFont = f;
  }
  const lh = Math.round(fittedHeadFont * 1.08);
  const eyebrowFont = Math.round(fittedHeadFont * 0.34);
  const bodyFont = Math.round(S * 0.024);

  const blockH = lines.length * lh;
  const headTop = opts.titlePage ? Math.round((S - blockH) / 2) : S - pad - blockH - (opts.body ? Math.round(bodyFont * 4) : 0);
  const eyebrowY = headTop - Math.round(eyebrowFont * 0.7);

  const headSpans = lines
    .map((ln, i) => `<text x="${pad}" y="${headTop + (i + 1) * lh - Math.round(lh * 0.22)}" font-family="'DejaVu Serif',Georgia,serif" font-size="${fittedHeadFont}" font-weight="800" fill="#ffffff" letter-spacing="1">${ln}</text>`)
    .join('');

  const eyebrowSvg = opts.eyebrow
    ? `<text x="${pad}" y="${eyebrowY}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${eyebrowFont}" font-weight="700" fill="${accent}" letter-spacing="5">${escapeXml(opts.eyebrow.toUpperCase())}</text>`
    : '';

  let bodySvg = '';
  if (opts.body) {
    const bodyLines = wrapLines(escapeXml(opts.body), Math.floor(avail / (bodyFont * 0.5)), 4);
    const bodyTop = headTop + blockH + Math.round(bodyFont * 1.6);
    bodySvg = bodyLines
      .map((ln, i) => `<text x="${pad}" y="${bodyTop + i * Math.round(bodyFont * 1.5)}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${bodyFont}" fill="#ffffff" fill-opacity="0.85">${ln}</text>`)
      .join('');
  }

  const footFont = Math.round(S * 0.016);
  const pageStr = opts.pageNo ? `${opts.pageNo}${opts.totalPages ? ' / ' + opts.totalPages : ''}` : '';

  const svg = `
    <svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bookveil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="${opts.titlePage ? 0.45 : 0.05}"/>
          <stop offset="${opts.titlePage ? '100%' : '50%'}" stop-color="#000000" stop-opacity="${opts.titlePage ? 0.45 : 0.12}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect width="${S}" height="${S}" fill="url(#bookveil)"/>
      <rect x="${Math.round(S * 0.03)}" y="${Math.round(S * 0.03)}" width="${S - Math.round(S * 0.06)}" height="${S - Math.round(S * 0.06)}" fill="none" stroke="${accent}" stroke-opacity="0.4" stroke-width="${Math.round(S * 0.0025)}"/>
      ${eyebrowSvg}
      ${headSpans}
      ${bodySvg}
      ${pageStr ? `<text x="${pad}" y="${S - pad}" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${footFont}" fill="#ffffff" fill-opacity="0.5" letter-spacing="2">${pageStr}</text>` : ''}
      <text x="${S - pad}" y="${S - pad}" text-anchor="end" font-family="'DejaVu Sans',Arial,sans-serif" font-size="${footFont}" font-weight="600" fill="${accent}" fill-opacity="0.7" letter-spacing="3">BOOSTIFY</text>
    </svg>`;

  return sharp(base).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 93 }).toBuffer();
}

// ─── Main entry ─────────────────────────────────────────────────────────────
export async function generateVinylArtwork(input: VinylArtworkInput): Promise<VinylArtworkResult> {
  const accent = safeHex(input.accentColor);
  logger.log?.(`[vinyl-artwork] generating for artist ${input.artistId} — "${input.albumTitle}"`);

  // Base photographic layer (shared by front)
  const { buffer: baseArt, provider } = await resolveBaseArt(input, accent);

  const [frontBuf, backBuf] = await Promise.all([
    composeFront(baseArt, input, accent),
    composeBack(input, accent),
  ]);

  const [frontUrl, backUrl] = await Promise.all([
    persist(frontBuf, input.artistId, 'front'),
    persist(backBuf, input.artistId, 'back'),
  ]);

  // Booklet ("book")
  const bookPages: { url: string; label: string }[] = [];
  if (input.includeBook) {
    const gallery = (input.galleryImages || []).filter(u => /^https?:\/\//i.test(u)).slice(0, 8);
    // Download gallery images in parallel (null on failure)
    const galleryBufs = await Promise.all(gallery.map(downloadToBuffer));
    const valid = galleryBufs.filter((b): b is Buffer => !!b);

    const songTitles = input.tracklist.map(t => t.title).filter(Boolean);
    const pages: Promise<Buffer>[] = [];
    const labels: string[] = [];

    // Title page (uses the front base art or first gallery image)
    const coverImg = valid[0] || baseArt;
    const totalEstimate = Math.min(valid.length, 6) + 2;
    pages.push(composeBookPage(coverImg, accent, {
      eyebrow: input.artistName,
      headline: input.albumTitle,
      body: input.subtitle,
      pageNo: 1,
      totalPages: totalEstimate,
      titlePage: true,
    }));
    labels.push('Cover');

    // Interior gallery pages — one per gallery image, captioned with a song/lyric
    const interior = valid.slice(0, 6);
    interior.forEach((buf, i) => {
      const title = songTitles[i % Math.max(1, songTitles.length)] || input.albumTitle;
      const lyric = input.lyricsByTitle?.[title];
      pages.push(composeBookPage(buf, accent, {
        eyebrow: `Track ${i + 1}`,
        headline: title,
        body: lyric ? lyric.split(/\n/)[0]?.slice(0, 120) : undefined,
        pageNo: i + 2,
        totalPages: totalEstimate,
      }));
      labels.push(`Page ${i + 2}`);
    });

    // Credits page (no image → gradient)
    const creditsBody =
      `${songTitles.length} tracks · Performed by ${input.artistName}. ` +
      `Produced and released on Boostify. Artwork created by Boostify. ` +
      `© ${new Date().getFullYear()} ${input.artistName}.`;
    pages.push(composeBookPage(null, accent, {
      eyebrow: 'Credits',
      headline: 'Thank You',
      body: creditsBody,
      pageNo: interior.length + 2,
      totalPages: totalEstimate,
    }));
    labels.push('Credits');

    const builtBufs = await Promise.all(pages);
    const urls = await Promise.all(builtBufs.map((b, i) => persist(b, input.artistId, `book-${i + 1}`)));
    urls.forEach((url, i) => bookPages.push({ url, label: labels[i] }));
  }

  return {
    frontUrl,
    backUrl,
    bookPages,
    provider,
    meta: { widthPx: PRINT_SIZE, heightPx: PRINT_SIZE, dpi: PRINT_DPI, format: '12" sleeve (300 DPI)' },
  };
}
