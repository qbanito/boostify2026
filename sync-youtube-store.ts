/**
 * Backfill: actualiza los videos YA SUBIDOS a YouTube de un artista con la
 * sección de tienda (productos + próximos shows) en la descripción y publica el
 * comentario "SHOP THIS VIDEO" si aún no existe.
 *
 * Uso:  npx tsx sync-youtube-store.ts <artistId> [connUserId] [--no-comment] [--no-desc]
 * Ej.:  npx tsx sync-youtube-store.ts 1417 33
 *
 * Reutiliza las funciones del servicio de YouTube (mismo comportamiento que el
 * endpoint POST /api/lyrics-video/youtube/sync-store) para correrlo sin sesión.
 */
import 'dotenv/config';
import { pool } from './server/db';
import {
  getValidAccessToken,
  updateVideoDescription,
  ensureVideoShopComment,
} from './server/services/youtube-service';

const BASE = (process.env.PUBLIC_ARTIST_BASE_URL || process.env.APP_URL || 'https://www.boostifymusic.com')
  .replace(/\/+$/, '')
  .replace(/^https?:\/\/boostifymusic\.com/i, 'https://www.boostifymusic.com');

const SHOP_SECTION_START = '🛒 ───── TIENDA OFICIAL ─────';
const SHOP_SECTION_END = '───── Apoya a tu artista · Boostify ─────';
const SHOP_COMMENT_MARKER = 'TIENDA OFICIAL';
const LEGACY_SECTION_STARTS = ['🛍️ ───── COMPRA EN ESTE VIDEO ─────', '\uFFFD ───── TIENDA OFICIAL ─────'];
const LEGACY_COMMENT_MARKERS = ['COMPRA EN ESTE VIDEO'];

function withYoutubeUtm(url: string, content?: string): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  let u = `${url}${sep}utm_source=youtube&utm_medium=lyric_video&utm_campaign=shop_this_video`;
  if (content) u += `&utm_content=${encodeURIComponent(content)}`;
  return u;
}
function fmtCommercePrice(price: any, currency = 'usd'): string {
  const n = Number(price);
  if (!isFinite(n) || n <= 0) return '';
  const sym = String(currency || 'usd').toLowerCase() === 'usd' ? '$' : '';
  return `${sym}${n.toFixed(2)}`;
}
function fmtEventDate(iso: any): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}
function buildCommerceLines(o: {
  artistName: string; artistUrl: string; storeUrl: string;
  productItems: any[]; events: any[]; videoTag?: string; includeHeader?: boolean;
}): string[] {
  const { artistName, artistUrl, storeUrl, productItems, events, videoTag, includeHeader = true } = o;
  const lines: string[] = [];
  lines.push(
    includeHeader
      ? `🛒 TIENDA OFICIAL de ${artistName} — merch, shows y música: ${withYoutubeUtm(storeUrl, videoTag)}`
      : `🛒 Tienda oficial de ${artistName}: ${withYoutubeUtm(storeUrl, videoTag)}`,
  );
  if (productItems.length) {
    lines.push('');
    lines.push('🛍️ PRODUCTOS:');
    for (const p of productItems.slice(0, 4)) {
      const price = fmtCommercePrice(p.price, p.currency);
      const link = withYoutubeUtm(`${storeUrl}?product=${p.id}`, videoTag);
      lines.push(`• ${p.title}${price ? ` — ${price}` : ''}: ${link}`);
    }
  }
  if (events.length) {
    lines.push('');
    lines.push(`🎫 PRÓXIMOS SHOWS de ${artistName}:`);
    for (const e of events.slice(0, 4)) {
      const date = fmtEventDate(e.startsAt);
      const place = [e.venue, e.location].filter(Boolean).join(', ');
      const link = withYoutubeUtm(`${artistUrl}?event=${e.id}`, videoTag);
      lines.push(`• ${date ? `${date} · ` : ''}${e.title}${place ? ` (${place})` : ''} → Entradas: ${link}`);
    }
  }
  lines.push('');
  lines.push(`🎵 Escucha y consigue su música: ${withYoutubeUtm(artistUrl, videoTag)}`);
  return lines;
}
function buildShopComment(ctx: any, videoTag?: string): string {
  if (!ctx.productItems.length && !ctx.events.length) return '';
  const head = `🛒 Tienda oficial de ${ctx.artistName} — productos, shows y música 👇`;
  const body = buildCommerceLines({ ...ctx, videoTag });
  return [head, '', ...body].join('\n').slice(0, 9000);
}
function applyShopSection(current: string, lines: string[]): string {
  const MAX = 4900;
  let base = current;
  for (const startMark of [SHOP_SECTION_START, ...LEGACY_SECTION_STARTS]) {
    const start = base.indexOf(startMark);
    if (start >= 0) {
      const endPos = base.indexOf(SHOP_SECTION_END, start);
      base = (base.slice(0, start) + (endPos >= 0 ? base.slice(endPos + SHOP_SECTION_END.length) : '')).trimEnd();
    }
  }
  base = base.trimEnd();
  const section = [SHOP_SECTION_START, ...lines, SHOP_SECTION_END].join('\n');
  let next = base ? `${base}\n\n${section}` : section;
  if (next.length > MAX) {
    const room = MAX - section.length - 2;
    base = room > 0 ? base.slice(0, room).trimEnd() : '';
    next = base ? `${base}\n\n${section}` : section.slice(0, MAX);
  }
  return next;
}

async function main() {
  const artistId = Number(process.argv[2]);
  const connArg = process.argv[3] && !process.argv[3].startsWith('--') ? Number(process.argv[3]) : undefined;
  const doComment = !process.argv.includes('--no-comment');
  const doDesc = !process.argv.includes('--no-desc');
  if (!artistId) {
    console.error('Uso: npx tsx sync-youtube-store.ts <artistId> [connUserId] [--no-comment] [--no-desc]');
    process.exit(1);
  }

  const u = await pool.query(`SELECT artist_name, username, slug FROM users WHERE id=$1`, [artistId]);
  const artistName = u.rows[0]?.artist_name || u.rows[0]?.username || 'Artist';
  const slug = u.rows[0]?.slug || '';
  const artistUrl = slug ? `${BASE}/artist/${slug}` : BASE;
  const storeUrl = slug ? `${BASE}/artist/${slug}/store` : BASE;

  const pr = await pool.query(
    `SELECT id, title, presale_price, currency FROM smart_merch_products
     WHERE artist_id=$1 AND is_published=true AND status<>'archived'
     ORDER BY created_at DESC LIMIT 5`,
    [artistId],
  );
  const productItems = pr.rows
    .filter((r) => r.title)
    .map((r) => ({ id: Number(r.id), title: String(r.title), price: r.presale_price, currency: r.currency || 'usd' }));

  const ev = await pool.query(
    `SELECT id, title, starts_at, venue, location FROM concert_events
     WHERE artist_id=$1 AND status IN ('published','live','on_sale')
       AND (starts_at IS NULL OR starts_at >= NOW())
     ORDER BY starts_at ASC NULLS LAST LIMIT 4`,
    [artistId],
  );
  const events = ev.rows
    .filter((r) => r.title)
    .map((r) => ({ id: Number(r.id), title: String(r.title), startsAt: r.starts_at, venue: r.venue || '', location: r.location || '' }));

  const ctx = { artistName, artistUrl, storeUrl, productItems, events };

  // Resolver la conexión de YouTube (token válido): connUserId del arg → artistId.
  const candidates = [connArg, artistId].filter((x): x is number => !!x);
  let connUser: number | null = null;
  for (const id of candidates) {
    if (await getValidAccessToken(id)) { connUser = id; break; }
  }
  if (!connUser) {
    console.error(`❌ No hay conexión de YouTube válida para [${candidates.join(', ')}]`);
    process.exit(1);
  }

  const jobs = await pool.query(
    `SELECT id, song_title, youtube_url FROM lyrics_video_jobs
     WHERE artist_id=$1 AND youtube_url IS NOT NULL AND youtube_url <> ''
     ORDER BY updated_at DESC`,
    [artistId],
  );

  console.log(`\n🎬 ${artistName} (#${artistId}) — ${jobs.rows.length} videos · conexión YouTube: user ${connUser}`);
  console.log(`   Productos: ${productItems.map((p) => p.title).join(', ') || '—'}`);
  console.log(`   Shows: ${events.map((e) => e.title).join(', ') || '—'}\n`);

  let updated = 0, commented = 0, skipped = 0;
  for (const job of jobs.rows) {
    const videoId = String(job.youtube_url).match(/[?&]v=([\w-]{6,})/)?.[1];
    if (!videoId) { skipped++; console.log(`  ⚠️  job ${job.id}: sin videoId`); continue; }
    const videoTag = `lv${job.id}`;
    const label = `  • ${job.song_title || job.id} [${videoId}]`;

    let descMsg = '—', commentMsg = '—';
    if (doDesc) {
      const lines = buildCommerceLines({ ...ctx, videoTag, includeHeader: false });
      const out = await updateVideoDescription(connUser, videoId, (cur) => applyShopSection(cur, lines));
      descMsg = out.updated ? 'descripción ✓' : `desc: ${out.reason}`;
      if (out.updated) updated++;
    }
    if (doComment) {
      const comment = buildShopComment(ctx, videoTag);
      const out = await ensureVideoShopComment(connUser, videoId, comment, SHOP_COMMENT_MARKER, LEGACY_COMMENT_MARKERS);
      commentMsg = out.posted ? 'comentario ✓' : `coment: ${out.reason}`;
      if (out.posted) commented++;
    }
    console.log(`${label} → ${descMsg} | ${commentMsg}`);
  }

  console.log(`\n✅ Listo: ${updated} descripciones actualizadas, ${commented} comentarios publicados, ${skipped} omitidos.\n`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
