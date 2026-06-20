/**
 * SEO Router — sitemap.xml, robots.txt, news-sitemap.xml
 *
 * Improves search-engine discoverability of Boostify pages and news articles.
 * - /sitemap.xml         → master sitemap index (links to news & main sitemaps)
 * - /sitemap-main.xml    → static landing pages (/, /news, /pricing, etc.)
 * - /sitemap-news.xml    → all published news articles + Google News tags
 * - /robots.txt          → crawl directives + sitemap pointer
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { newsArticles, users } from '@db/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';

const router = Router();

const STATIC_PATHS: { loc: string; changefreq: string; priority: string }[] = [
  { loc: '/',            changefreq: 'daily',   priority: '1.0' },
  { loc: '/news',        changefreq: 'hourly',  priority: '0.9' },
  { loc: '/pricing',     changefreq: 'weekly',  priority: '0.8' },
  { loc: '/artists',     changefreq: 'daily',   priority: '0.8' },
  { loc: '/about',       changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact',     changefreq: 'monthly', priority: '0.5' },
  { loc: '/privacy',     changefreq: 'yearly',  priority: '0.3' },
  { loc: '/terms',       changefreq: 'yearly',  priority: '0.3' },
];

function getBaseUrl(req: Request): string {
  const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'boostifymusic.com';
  return `${protocol}://${host}`;
}

function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Sitemap Index ─────────────────────────────────────────────
router.get('/sitemap.xml', (req: Request, res: Response) => {
  const base = getBaseUrl(req);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${escXml(base)}/sitemap-main.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${escXml(base)}/sitemap-news.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${escXml(base)}/sitemap-artists.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// ─── Static pages sitemap ──────────────────────────────────────
router.get('/sitemap-main.xml', (req: Request, res: Response) => {
  const base = getBaseUrl(req);
  const now = new Date().toISOString();
  const urls = STATIC_PATHS.map(p => `  <url>
    <loc>${escXml(base + p.loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// ─── News articles sitemap (with Google News namespace) ────────
router.get('/sitemap-news.xml', async (req: Request, res: Response) => {
  try {
    const base = getBaseUrl(req);
    const articles = await db
      .select({
        slug: newsArticles.slug,
        title: newsArticles.title,
        publishedAt: newsArticles.publishedAt,
        updatedAt: newsArticles.updatedAt,
        category: newsArticles.category,
        tags: newsArticles.tags,
        coverImageUrl: newsArticles.coverImageUrl,
        id: newsArticles.id,
      })
      .from(newsArticles)
      .where(eq(newsArticles.status, 'published'))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(1000);

    // Google News only allows last 2 days; full sitemap also lists older items.
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;

    const urls = articles.map(a => {
      const loc = `${base}/news?article=${encodeURIComponent(a.slug)}`;
      const lastmod = (a.updatedAt || a.publishedAt || new Date()).toISOString();
      const isRecent = a.publishedAt && new Date(a.publishedAt).getTime() > twoDaysAgo;
      const newsBlock = isRecent ? `
    <news:news>
      <news:publication>
        <news:name>Boostify Music</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${(a.publishedAt as Date).toISOString()}</news:publication_date>
      <news:title>${escXml(a.title || '')}</news:title>
      ${a.tags && a.tags.length ? `<news:keywords>${escXml(a.tags.slice(0, 10).join(', '))}</news:keywords>` : ''}
    </news:news>` : '';
      const imageBlock = a.coverImageUrl ? `
    <image:image>
      <image:loc>${escXml(`${base}/api/news/articles/${a.id}/image`)}</image:loc>
      <image:title>${escXml(a.title || '')}</image:title>
    </image:image>` : '';
      return `  <url>
    <loc>${escXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${newsBlock}${imageBlock}
  </url>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.send(xml);
  } catch (error) {
    console.error('[SEO] sitemap-news error:', error);
    res.status(500).send('Error generating news sitemap');
  }
});

// ─── Artists sitemap ───────────────────────────────────────────
router.get('/sitemap-artists.xml', async (req: Request, res: Response) => {
  try {
    const base = getBaseUrl(req);
    const artists = await db
      .select({
        slug: users.slug,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(isNotNull(users.slug), isNotNull(users.artistName)))
      .limit(5000);

    const urls = artists
      .filter(a => a.slug)
      .map(a => {
        const lastmod = (a.updatedAt || new Date()).toISOString();
        return `  <url>
    <loc>${escXml(`${base}/artist/${a.slug}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (error) {
    console.error('[SEO] sitemap-artists error:', error);
    res.status(500).send('Error generating artists sitemap');
  }
});

// ─── RSS Feed (news distribution + Google Discover signal) ────
router.get('/feed.xml', async (req: Request, res: Response) => {
  try {
    const base = getBaseUrl(req);
    const articles = await db
      .select({
        id: newsArticles.id,
        slug: newsArticles.slug,
        title: newsArticles.title,
        summary: newsArticles.summary,
        category: newsArticles.category,
        publishedAt: newsArticles.publishedAt,
        coverImageUrl: newsArticles.coverImageUrl,
      })
      .from(newsArticles)
      .where(eq(newsArticles.status, 'published'))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(50);

    const items = articles.map(a => {
      const link = `${base}/news?article=${encodeURIComponent(a.slug)}`;
      const pubDate = a.publishedAt ? new Date(a.publishedAt).toUTCString() : new Date().toUTCString();
      const desc = a.summary || a.title || '';
      const enclosure = a.coverImageUrl
        ? `      <enclosure url="${escXml(`${base}/api/news/articles/${a.id}/image?og=1`)}" type="image/jpeg" />`
        : '';
      return `    <item>
      <title>${escXml(a.title || '')}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="true">${escXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escXml(desc)}</description>
      <category>${escXml(a.category || 'technology')}</category>
${enclosure}
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Boostify Music News</title>
    <link>${escXml(base)}/news</link>
    <atom:link href="${escXml(base)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>AI-powered insights on music marketing, autonomous artists, AI music, and Web3 from Boostify Music.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>`;
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=900');
    res.send(xml);
  } catch (error) {
    console.error('[SEO] feed.xml error:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

// ─── robots.txt ────────────────────────────────────────────────
router.get('/robots.txt', (req: Request, res: Response) => {
  const base = getBaseUrl(req);
  const body = `# Boostify Music — robots.txt
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Allow: /api/news/articles/
Allow: /api/og-image/
Disallow: /admin/
Disallow: /dashboard
Disallow: /settings

# AI crawlers — explicitly allowed for content discovery
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Sitemaps
Sitemap: ${base}/sitemap.xml
Sitemap: ${base}/sitemap-news.xml
Sitemap: ${base}/sitemap-artists.xml
`;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(body);
});

export default router;
