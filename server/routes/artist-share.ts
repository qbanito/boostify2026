/**
 * server/routes/artist-share.ts
 *
 * Rich social-media sharing for artist profiles.
 *
 *   GET /api/artist-share/:slug        → HTML share page with full OG/Twitter
 *                                        meta tags (rich embeds on WhatsApp,
 *                                        Facebook, X, LinkedIn, Telegram…) and
 *                                        an instant redirect to /artist/:slug
 *                                        for human visitors.
 *   GET /api/artist-share/:slug/card   → Spectacular 1200×630 JPEG card composed
 *                                        with sharp: blurred backdrop, circular
 *                                        profile photo with glow ring, artist
 *                                        name, elegant bio excerpt, genre pill
 *                                        and Boostify branding.
 */

import { Router, type Request, type Response } from 'express';
import sharp from 'sharp';
import { db } from '../db';
import { users } from '@db/schema';
import { eq, or } from 'drizzle-orm';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// SVG text uses the same escaping rules as HTML
const escXml = escapeHtml;

function getBaseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
  return `${proto}://${host}`;
}

/** Strip HTML tags + collapse whitespace from a biography. */
function cleanBio(raw?: string | null): string {
  return String(raw || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word-wrap into at most maxLines lines of ~maxChars, ellipsis on overflow. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (lines.length < maxLines && line) lines.push(line.trim());
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{3}$/, '') + '…';
  }
  return lines;
}

/** Fetch a remote image with a timeout; returns null on any failure.
 *  Rejects anything that isn't a sharp-decodable raster image (e.g. .mp4 video
 *  banners, HTML error pages, PDFs) so the card pipeline never crashes. */
async function fetchImage(url?: string | null): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  // Fast pre-filter: skip obvious non-image assets before downloading them.
  if (/\.(mp4|webm|mov|m4v|avi|mkv|flv|mp3|wav|m4a|aac|ogg|opus|pdf|json|txt)(\?|#|$)/i.test(url)) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    // Only accept real images; reject video/html/json/etc. by content-type.
    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    // Authoritative check: if sharp can't read it, it's unusable (covers
    // octet-stream URLs and animated/unsupported formats).
    try {
      await sharp(buf).metadata();
    } catch {
      return null;
    }
    return buf;
  } catch {
    return null;
  }
}

async function findArtist(slugOrId: string) {
  const conditions = /^\d+$/.test(slugOrId)
    ? or(eq(users.slug, slugOrId), eq(users.id, parseInt(slugOrId, 10)))
    : eq(users.slug, slugOrId);
  const [artist] = await db
    .select({
      id: users.id,
      slug: users.slug,
      artistName: users.artistName,
      username: users.username,
      biography: users.biography,
      genre: users.genre,
      genres: users.genres,
      location: users.location,
      profileImage: users.profileImage,
      profileImageUrl: users.profileImageUrl,
      coverImage: users.coverImage,
    })
    .from(users)
    .where(conditions)
    .limit(1);
  return artist || null;
}

// ─── GET /api/artist-share/:slug/card — 1200×630 OG image ───────────────────

const CARD_W = 1200;
const CARD_H = 630;
const AVATAR_SIZE = 340;
const AVATAR_X = 90;
const AVATAR_Y = (CARD_H - AVATAR_SIZE) / 2;

router.get('/:slug/card', async (req: Request, res: Response) => {
  try {
    const artist = await findArtist(req.params.slug);
    if (!artist) return res.status(404).send('Artist not found');

    const name = artist.artistName || artist.username || 'Boostify Artist';
    const photoUrl = artist.profileImage || artist.profileImageUrl || null;
    const coverUrl = artist.coverImage || null;
    const genre = artist.genre || (Array.isArray(artist.genres) ? artist.genres[0] : '') || '';
    const bio = cleanBio(artist.biography);

    // fetchImage rejects non-images (e.g. .mp4 video banners), so a video cover
    // resolves to null and the background gracefully falls back to the photo.
    const [coverBuf, avatarBuf] = await Promise.all([
      fetchImage(coverUrl),
      fetchImage(photoUrl),
    ]);
    const bgBuf = coverBuf || avatarBuf;

    // ── 1. Background: blurred + darkened artwork, or branded gradient ──────
    let base: sharp.Sharp;
    if (bgBuf) {
      base = sharp(bgBuf)
        .resize(CARD_W, CARD_H, { fit: 'cover', position: 'attention' })
        .blur(18)
        .modulate({ brightness: 0.55, saturation: 1.25 });
    } else {
      const gradientSvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
        <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e1b4b"/><stop offset="50%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#831843"/>
        </linearGradient></defs>
        <rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>
      </svg>`;
      base = sharp(Buffer.from(gradientSvg));
    }

    // ── 2. Scrim: gradient overlay + decorative elements ────────────────────
    const eqBars = Array.from({ length: 14 }, (_, i) => {
      const h = 18 + Math.round(58 * Math.abs(Math.sin(i * 1.7 + 1)));
      const x = 560 + i * 22;
      return `<rect x="${x}" y="${536 - h}" width="10" height="${h}" rx="5" fill="#a78bfa" opacity="${0.25 + (i % 3) * 0.18}"/>`;
    }).join('');

    const scrimSvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0a0118" stop-opacity="0.92"/>
          <stop offset="45%" stop-color="#0a0118" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#0a0118" stop-opacity="0.45"/>
        </linearGradient>
        <linearGradient id="topbar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#8b5cf6"/><stop offset="50%" stop-color="#ec4899"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#scrim)"/>
      <rect width="${CARD_W}" height="10" fill="url(#topbar)"/>
      <rect y="${CARD_H - 10}" width="${CARD_W}" height="10" fill="url(#topbar)"/>
      <!-- vinyl rings, right side -->
      <g opacity="0.16" stroke="#ffffff" fill="none">
        <circle cx="1150" cy="110" r="150" stroke-width="2"/>
        <circle cx="1150" cy="110" r="110" stroke-width="1.5"/>
        <circle cx="1150" cy="110" r="70" stroke-width="1"/>
        <circle cx="1150" cy="110" r="26" stroke-width="6" stroke="#ec4899"/>
      </g>
      ${eqBars}
    </svg>`;

    // ── 3. Circular avatar with glow ring ────────────────────────────────────
    const composites: sharp.OverlayOptions[] = [
      { input: Buffer.from(scrimSvg), top: 0, left: 0 },
    ];

    let hasAvatar = false;
    if (avatarBuf) {
      const circleMask = Buffer.from(
        `<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="#fff"/></svg>`
      );
      try {
        const avatar = await sharp(avatarBuf)
          .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'attention' })
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .png()
          .toBuffer();
        composites.push({ input: avatar, top: Math.round(AVATAR_Y), left: AVATAR_X });
        hasAvatar = true;
      } catch (e) {
        // Bad avatar image — skip it rather than failing the whole card.
        console.warn('[artist-share] avatar render skipped:', (e as Error).message);
      }
    }

    // ── 4. Text layer: ring, name, genre pill, bio, branding ────────────────
    const textX = hasAvatar ? AVATAR_X + AVATAR_SIZE + 60 : 90;
    const maxNameChars = hasAvatar ? 16 : 24;
    const nameSize = name.length > maxNameChars ? (name.length > 26 ? 46 : 58) : 72;
    const bioLines = wrapText(
      bio || `Discover the music of ${name} on Boostify.`,
      hasAvatar ? 38 : 52,
      3
    );
    const bioSvg = bioLines
      .map((l, i) => `<text x="${textX}" y="${360 + i * 42}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="27" fill="#d4d4d8" font-style="italic">${escXml(l)}</text>`)
      .join('');
    const genrePill = genre
      ? `<rect x="${textX}" y="160" rx="17" ry="17" width="${34 + genre.length * 13}" height="34" fill="#8b5cf6" opacity="0.9"/>
         <text x="${textX + 17 + (genre.length * 13) / 2}" y="183" text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" letter-spacing="2">${escXml(genre.toUpperCase())}</text>`
      : '';
    const ringCx = AVATAR_X + AVATAR_SIZE / 2;
    const ringCy = AVATAR_Y + AVATAR_SIZE / 2;
    const avatarRing = hasAvatar
      ? `<circle cx="${ringCx}" cy="${ringCy}" r="${AVATAR_SIZE / 2 + 6}" fill="none" stroke="url(#ring)" stroke-width="7"/>
         <circle cx="${ringCx}" cy="${ringCy}" r="${AVATAR_SIZE / 2 + 18}" fill="none" stroke="#8b5cf6" stroke-width="1.5" opacity="0.5"/>`
      : '';

    const textSvg = `<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#8b5cf6"/><stop offset="50%" stop-color="#ec4899"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="nameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e9d5ff"/>
        </linearGradient>
      </defs>
      ${avatarRing}
      <text x="${textX}" y="130" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#a78bfa" letter-spacing="6">ARTIST SPOTLIGHT</text>
      ${genrePill}
      <text x="${textX}" y="${236 + nameSize * 0.4}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="${nameSize}" font-weight="bold" fill="url(#nameGrad)">${escXml(name)}</text>
      ${bioSvg}
      <!-- branding -->
      <polygon points="${textX},${CARD_H - 78} ${textX},${CARD_H - 50} ${textX + 24},${CARD_H - 64}" fill="#ec4899"/>
      <text x="${textX + 38}" y="${CARD_H - 56}" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" letter-spacing="3">BOOSTIFY MUSIC</text>
      <text x="${CARD_W - 60}" y="${CARD_H - 56}" text-anchor="end" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="19" fill="#a1a1aa">▶ Listen now</text>
    </svg>`;

    composites.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

    const out = await base
      .composite(composites)
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    return res.send(out);
  } catch (err: any) {
    console.error('[artist-share] card error:', err);
    return res.status(500).send('Error generating share card');
  }
});

// ─── GET /api/artist-share/:slug — OG share page + redirect ─────────────────

router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const artist = await findArtist(req.params.slug);
    if (!artist) {
      return res.status(404).set('Content-Type', 'text/html; charset=utf-8')
        .send('<!doctype html><meta charset="utf-8"><title>Not found</title><h1>Artist not found</h1>');
    }

    const base = getBaseUrl(req);
    const name = escapeHtml(artist.artistName || artist.username || 'Boostify Artist');
    const slug = artist.slug || String(artist.id);
    const profileUrl = `${base}/artist/${encodeURIComponent(slug)}`;
    const cardUrl = `${base}/api/artist-share/${encodeURIComponent(slug)}/card`;
    const bio = cleanBio(artist.biography);
    const desc = escapeHtml(
      bio ? (bio.length > 200 ? bio.slice(0, 197) + '…' : bio) : `Listen to ${artist.artistName || 'this artist'} on Boostify Music — exclusive tracks, videos and more.`
    );
    const genre = escapeHtml(artist.genre || (Array.isArray(artist.genres) ? artist.genres[0] : '') || '');

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — Boostify Music</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${profileUrl}" />
<meta property="og:type" content="profile" />
<meta property="og:site_name" content="Boostify Music" />
<meta property="og:title" content="${name} — Boostify Music" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${profileUrl}" />
<meta property="og:image" content="${cardUrl}" />
<meta property="og:image:secure_url" content="${cardUrl}" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${name} on Boostify Music" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${name} — Boostify Music" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${cardUrl}" />
${genre ? `<meta property="music:genre" content="${genre}" />` : ''}
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
    background: radial-gradient(ellipse at top, #1e1b4b 0%, #0a0118 60%); color: #f5f5f5; }
  .wrap { text-align: center; padding: 32px 20px; max-width: 680px; }
  .card { width: 100%; max-width: 600px; border-radius: 16px; box-shadow: 0 24px 64px rgba(139,92,246,.35); }
  h1 { font-size: 26px; margin: 24px 0 6px; }
  p { color: #a1a1aa; margin: 0 0 24px; }
  .btn { display: inline-block; padding: 13px 34px; border-radius: 999px; font-weight: 700; text-decoration: none;
    color: #fff; background: linear-gradient(135deg, #8b5cf6, #ec4899); }
</style>
</head>
<body>
  <div class="wrap">
    <img class="card" src="${cardUrl}" alt="${name}" />
    <h1>${name}</h1>
    <p>${desc}</p>
    <a class="btn" href="${profileUrl}">Ver perfil completo →</a>
  </div>
  <script>setTimeout(function(){ window.location.replace(${JSON.stringify(profileUrl + '#music')}); }, 1200);</script>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    return res.send(html);
  } catch (err: any) {
    console.error('[artist-share] page error:', err);
    return res.status(500).send('Error');
  }
});

export default router;
