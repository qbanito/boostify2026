/**
 * YouTube Shopping — Product Feed (Google Merchant Center / RSS 2.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Expone el catálogo de la tienda (smart_merch_products) de un artista como un
 * feed de productos estándar que YouTube Shopping / Google Merchant Center / las
 * plataformas de tienda aprobadas pueden ingerir para vender en YouTube.
 *
 *   GET /api/youtube-shopping/feed/:artistId.xml   → RSS 2.0 (g: namespace)
 *   GET /api/youtube-shopping/feed/:artistId.json  → JSON (debug / integraciones)
 *
 * Público (sin auth): un feed de productos se consume por máquinas externas.
 * NOTA: la API de YouTube NO permite taggear productos por código; el artista
 * conecta este feed UNA vez en Google Merchant Center / su tienda aprobada y
 * YouTube ya puede mostrar el merch shelf (requiere elegibilidad YPP).
 */
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

const BASE = (process.env.PUBLIC_ARTIST_BASE_URL || process.env.APP_URL || 'https://www.boostifymusic.com')
  .replace(/\/+$/, '')
  .replace(/^https?:\/\/boostifymusic\.com/i, 'https://www.boostifymusic.com');

function xmlEscape(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Mapea el estado interno del producto a la disponibilidad de Google Merchant.
function availabilityOf(status: string): 'in_stock' | 'out_of_stock' | 'preorder' {
  const s = String(status || '').toLowerCase();
  if (s.includes('sold') || s.includes('out')) return 'out_of_stock';
  if (s.includes('presale') || s.includes('preorder') || s.includes('pre_order') || s.includes('coming')) return 'preorder';
  return 'in_stock';
}

export interface FeedProduct {
  id: number;
  title: string;
  description: string;
  price: string;       // "44.00 USD"
  availability: string;
  link: string;
  imageLink: string;
  brand: string;
  condition: string;
  category: string;
}

export async function loadFeed(artistId: number): Promise<{
  artistName: string;
  slug: string;
  storeUrl: string;
  products: FeedProduct[];
} | null> {
  const u = await pool.query(
    `SELECT artist_name, username, slug FROM users WHERE id=$1`,
    [artistId],
  );
  if (!u.rows.length) return null;
  const artistName = u.rows[0].artist_name || u.rows[0].username || 'Artist';
  const slug = u.rows[0].slug || '';
  const storeUrl = slug ? `${BASE}/artist/${slug}/store` : BASE;

  const pr = await pool.query(
    `SELECT id, title, description, category, image_url, gallery, currency,
            presale_price, status
       FROM smart_merch_products
      WHERE artist_id=$1 AND is_published=true AND status<>'archived'
      ORDER BY created_at DESC`,
    [artistId],
  );

  const products: FeedProduct[] = pr.rows
    .map((r) => {
      const currency = String(r.currency || 'usd').toUpperCase();
      const price = Number(r.presale_price);
      // Primera imagen válida: image_url → gallery[0].
      let imageLink = '';
      if (r.image_url && /^https?:\/\//.test(r.image_url)) imageLink = r.image_url;
      else if (Array.isArray(r.gallery)) {
        const g = r.gallery.find((x: any) => typeof x === 'string' ? /^https?:\/\//.test(x) : /^https?:\/\//.test(x?.url || ''));
        if (g) imageLink = typeof g === 'string' ? g : g.url;
      }
      const link = `${storeUrl}?product=${r.id}&utm_source=google&utm_medium=merchant_feed&utm_campaign=youtube_shopping`;
      const description = String(r.description || `${r.title} — merch oficial de ${artistName}.`)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000);
      return {
        id: Number(r.id),
        title: String(r.title || '').slice(0, 150),
        description,
        price: isFinite(price) && price > 0 ? `${price.toFixed(2)} ${currency}` : '',
        availability: availabilityOf(r.status),
        link,
        imageLink,
        brand: artistName,
        condition: 'new',
        category: String(r.category || ''),
      } as FeedProduct;
    })
    // Google Merchant exige id, title, link, price e image_link.
    .filter((p) => p.title && p.price && p.imageLink);

  return { artistName, slug, storeUrl, products };
}

function buildRss(feed: NonNullable<Awaited<ReturnType<typeof loadFeed>>>): string {
  const items = feed.products
    .map((p) => `    <item>
      <g:id>${p.id}</g:id>
      <g:title>${xmlEscape(p.title)}</g:title>
      <g:description>${xmlEscape(p.description)}</g:description>
      <g:link>${xmlEscape(p.link)}</g:link>
      <g:image_link>${xmlEscape(p.imageLink)}</g:image_link>
      <g:availability>${p.availability}</g:availability>
      <g:price>${xmlEscape(p.price)}</g:price>
      <g:brand>${xmlEscape(p.brand)}</g:brand>
      <g:condition>${p.condition}</g:condition>
      <g:identifier_exists>no</g:identifier_exists>${p.category ? `\n      <g:product_type>${xmlEscape(p.category)}</g:product_type>` : ''}
    </item>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(feed.artistName)} — Boostify Store</title>
    <link>${xmlEscape(feed.storeUrl)}</link>
    <description>Tienda oficial de ${xmlEscape(feed.artistName)} en Boostify Music.</description>
${items}
  </channel>
</rss>`;
}

function parseArtistId(raw: string): number {
  return parseInt(String(raw || '').replace(/\.(xml|json)$/i, ''), 10);
}

// Enlaces profundos a Google Merchant Center (no requieren contexto de cuenta).
const MERCHANT_LINKS = {
  signup: 'https://www.google.com/retail/solutions/merchant-center/',
  dashboard: 'https://merchants.google.com/mc/overview',
  dataSources: 'https://merchants.google.com/mc/products/sources',
  scheduledFetchHelp: 'https://support.google.com/merchants/answer/7439058',
  claimSiteHelp: 'https://support.google.com/merchants/answer/176793',
  youtubeShoppingHelp: 'https://support.google.com/youtube/answer/12258755',
};

function feedUrls(artistId: number) {
  return {
    xml: `${BASE}/api/youtube-shopping/feed/${artistId}.xml`,
    json: `${BASE}/api/youtube-shopping/feed/${artistId}.json`,
  };
}

// GET /api/youtube-shopping/connect-info/:artistId → datos para conectar (JSON).
router.get('/connect-info/:artistId', async (req, res) => {
  try {
    const artistId = parseArtistId(req.params.artistId);
    if (!artistId) return res.status(400).json({ error: 'artistId inválido' });
    const feed = await loadFeed(artistId);
    if (!feed) return res.status(404).json({ error: 'Artista no encontrado' });
    const urls = feedUrls(artistId);
    const storeDomain = (() => { try { return new URL(feed.storeUrl).host; } catch { return ''; } })();
    res.set('Cache-Control', 'no-store');
    res.json({
      artist: feed.artistName,
      storeUrl: feed.storeUrl,
      storeDomain,
      productCount: feed.products.length,
      feed: urls,
      connectPage: `${BASE}/api/youtube-shopping/connect/${artistId}`,
      merchant: MERCHANT_LINKS,
      steps: [
        'Crea o abre tu cuenta de Google Merchant Center.',
        'En Merchant Center entra a "Fuentes de datos" → "Añadir fuente de productos" → "Obtención programada (scheduled fetch)".',
        `Pega la URL del feed (${urls.xml}) y elige frecuencia diaria. Tus productos se sincronizan solos cuando cambian en Boostify.`,
        `Verifica y reclama tu sitio (${storeDomain}) en Merchant Center.`,
        'Para el merch shelf NATIVO en tus videos: en YouTube Studio → Ganancias → Shopping, conecta tu cuenta de Merchant Center (requiere elegibilidad del Programa de Socios de YouTube).',
      ],
    });
  } catch (err: any) {
    console.error('[YouTubeShopping] connect-info error:', err);
    res.status(500).json({ error: err.message });
  }
});

function buildConnectPage(feed: NonNullable<Awaited<ReturnType<typeof loadFeed>>>, artistId: number): string {
  const urls = feedUrls(artistId);
  const storeDomain = (() => { try { return new URL(feed.storeUrl).host; } catch { return ''; } })();
  const preview = feed.products.slice(0, 6).map((p) => `
        <div class="card">
          <div class="thumb" style="background-image:url('${xmlEscape(p.imageLink)}')"></div>
          <div class="meta"><span class="ptitle">${xmlEscape(p.title)}</span><span class="pprice">${xmlEscape(p.price)}</span></div>
        </div>`).join('');
  const steps = [
    ['Crea o abre Google Merchant Center', `Usa el botón de arriba. Es gratis. Si ya tienes cuenta, ábrela.`],
    ['Añade el feed de productos', `En Merchant Center: <b>Fuentes de datos → Añadir fuente de productos → Obtención programada (scheduled fetch)</b>. Pega la URL del feed y elige frecuencia <b>diaria</b>.`],
    ['Sincroniza automáticamente', `No tienes que volver a subir nada: cuando cambies precios o productos en Boostify, el feed se actualiza y Merchant Center los vuelve a leer.`],
    ['Verifica tu sitio', `Reclama y verifica el dominio <b>${xmlEscape(storeDomain)}</b> en Merchant Center.`],
    ['Activa el shelf en YouTube', `Para que los productos salgan DENTRO de tus videos: <b>YouTube Studio → Ganancias → Shopping</b> y conecta tu Merchant Center (requiere estar en el Programa de Socios de YouTube).`],
  ].map(([t, d], i) => `
        <li><span class="num">${i + 1}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('');

  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar Google Merchant Center — ${xmlEscape(feed.artistName)}</title>
<style>
  :root{--bg:#0b0b10;--card:#15151f;--line:#26263a;--txt:#e9e9f2;--mut:#9a9ab0;--pink:#ff2d78;--grad:linear-gradient(135deg,#ff2d78,#7a37ff)}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:880px;margin:0 auto;padding:32px 20px 64px}
  .badge{display:inline-block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--pink);font-weight:700}
  h1{font-size:30px;margin:.3em 0 .2em;line-height:1.15}.lead{color:var(--mut);margin:0 0 24px}
  .actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}
  .btn{display:inline-flex;align-items:center;gap:8px;padding:13px 20px;border-radius:12px;font-weight:700;text-decoration:none;border:1px solid var(--line);color:var(--txt);background:var(--card);cursor:pointer;font-size:15px}
  .btn.primary{background:var(--grad);border:none;color:#fff}
  .feedbox{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:8px 0 4px}
  .feedrow{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .feedrow code{flex:1;min-width:240px;background:#0d0d15;border:1px solid var(--line);border-radius:9px;padding:11px 12px;font-size:13px;color:#cfeaff;overflow:auto;white-space:nowrap}
  .hint{color:var(--mut);font-size:13px;margin:8px 2px 0}
  ol.steps{list-style:none;padding:0;margin:28px 0 0}
  ol.steps li{display:flex;gap:14px;padding:16px 0;border-top:1px solid var(--line)}
  .num{flex:0 0 32px;height:32px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}
  ol.steps h3{margin:2px 0 4px;font-size:17px}ol.steps p{margin:0;color:var(--mut);font-size:14px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;margin:14px 0 0}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .thumb{aspect-ratio:1;background:#0d0d15 center/cover no-repeat}
  .meta{padding:8px 10px;display:flex;flex-direction:column;gap:2px}.ptitle{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pprice{font-size:12px;color:var(--pink);font-weight:700}
  .count{font-weight:800;color:#fff}
  .ok{color:#36d399}
</style></head>
<body><div class="wrap">
  <span class="badge">Boostify · YouTube Shopping</span>
  <h1>Conecta tu tienda con Google Merchant Center</h1>
  <p class="lead">Sincroniza los <span class="count">${feed.products.length}</span> productos de <b>${xmlEscape(feed.artistName)}</b> con Google para venderlos en YouTube y en Google Shopping. El feed se actualiza solo.</p>

  <div class="actions">
    <a class="btn primary" href="${MERCHANT_LINKS.dashboard}" target="_blank" rel="noopener">🟢 Abrir Google Merchant Center</a>
    <a class="btn" href="${MERCHANT_LINKS.signup}" target="_blank" rel="noopener">＋ Crear cuenta (gratis)</a>
    <a class="btn" href="${feed.storeUrl}" target="_blank" rel="noopener">🛍️ Ver la tienda</a>
  </div>

  <div class="feedbox">
    <div style="font-weight:700;margin-bottom:8px">URL del feed (para sincronizar) </div>
    <div class="feedrow">
      <code id="feedUrl">${xmlEscape(urls.xml)}</code>
      <button class="btn primary" onclick="copyFeed()" id="copyBtn">Copiar</button>
    </div>
    <p class="hint">Pega esta URL en Merchant Center como <b>fuente de productos · obtención programada (scheduled fetch)</b>, frecuencia diaria. <a href="${MERCHANT_LINKS.scheduledFetchHelp}" target="_blank" rel="noopener" style="color:#cfeaff">¿Cómo? →</a></p>
  </div>

  <ol class="steps">${steps}
  </ol>

  ${feed.products.length ? `<h3 style="margin-top:30px">Vista previa del feed</h3><div class="grid">${preview}</div>` : ''}

  <p class="hint" style="margin-top:28px">¿Necesitas el feed en otro formato? <a href="${xmlEscape(urls.json)}" target="_blank" rel="noopener" style="color:#cfeaff">Ver JSON</a> · <a href="${xmlEscape(urls.xml)}" target="_blank" rel="noopener" style="color:#cfeaff">Ver XML</a></p>
</div>
<script>
  function copyFeed(){
    var t=document.getElementById('feedUrl').textContent;
    navigator.clipboard.writeText(t).then(function(){
      var b=document.getElementById('copyBtn');b.textContent='¡Copiado! ✓';b.style.opacity='.85';
      setTimeout(function(){b.textContent='Copiar';b.style.opacity='1'},1800);
    });
  }
</script>
</body></html>`;
}

// GET /api/youtube-shopping/connect/:artistId → página guiada para conectar/sincronizar/abrir.
router.get('/connect/:artistId', async (req, res) => {
  try {
    const artistId = parseArtistId(req.params.artistId);
    if (!artistId) return res.status(400).send('artistId inválido');
    const feed = await loadFeed(artistId);
    if (!feed) return res.status(404).send('Artista no encontrado');
    res.set('Cache-Control', 'no-store');
    res.type('html').send(buildConnectPage(feed, artistId));
  } catch (err: any) {
    console.error('[YouTubeShopping] connect page error:', err);
    res.status(500).send('Error al generar la página de conexión');
  }
});

// GET /api/youtube-shopping/feed/:artistId(.xml|.json)
router.get('/feed/:artistId', async (req, res) => {
  try {
    const artistId = parseArtistId(req.params.artistId);
    if (!artistId) return res.status(400).json({ error: 'artistId inválido' });

    const feed = await loadFeed(artistId);
    if (!feed) return res.status(404).json({ error: 'Artista no encontrado' });

    res.set('Cache-Control', 'public, max-age=900'); // 15 min
    res.set('Access-Control-Allow-Origin', '*');

    if (/\.json$/i.test(req.params.artistId)) {
      return res.json({
        artist: feed.artistName,
        store: feed.storeUrl,
        count: feed.products.length,
        products: feed.products,
      });
    }
    res.type('application/xml').send(buildRss(feed));
  } catch (err: any) {
    console.error('[YouTubeShopping] feed error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
