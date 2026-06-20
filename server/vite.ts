import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { log } from "./logger";
import { db as pgDb } from "./db";
import { users, newsArticles } from "@db/schema";
import { and, eq, desc } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";

// Category labels for news SEO
const NEWS_CATEGORY_LABELS: Record<string, string> = {
  "technology": "Technology",
  "innovation": "Innovation",
  "autonomous-artists": "Autonomous Artists",
  "web3": "Web3 & Blockchain",
  "ai-music": "AI Music",
  "platform-updates": "Platform Updates",
  "industry-vision": "Industry Vision",
  "partnerships": "Partnerships",
  "artist-news": "Artist News",
};

const viteLogger = createLogger();

// Get project root for envDir
const projectRoot = path.resolve(__dirname, "..");

// Re-export log for backwards compatibility
export { log };

/**
 * Inject Open Graph meta tags into HTML for artist pages.
 * Social media crawlers (Facebook, WhatsApp, Twitter, Discord, etc.)
 * don't execute JavaScript, so we must inject meta tags server-side.
 */
async function injectArtistOGMeta(html: string, slug: string, baseUrl: string): Promise<string> {
  try {
    const [artist] = await pgDb
      .select({
        artistName: users.artistName,
        biography: users.biography,
        profileImage: users.profileImage,
        coverImage: users.coverImage,
        genres: users.genres,
        genre: users.genre,
        location: users.location,
        country: users.country,
        slug: users.slug,
      })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1);

    if (!artist) return html;

    const artistName = artist.artistName || 'Artist';
    const genre = artist.genres?.[0] || artist.genre || '';
    const biography = artist.biography || '';
    const description = biography.length > 155
      ? `${biography.slice(0, 152)}...`
      : biography || `Discover the music of ${artistName}${genre ? `, ${genre} artist` : ''} on Boostify Music.`;
    const title = `${artistName}${genre ? ` - ${genre}` : ''} | Boostify Music`;
    const pageUrl = `${baseUrl}/artist/${slug}`;
    const ogImageUrl = `${baseUrl}/api/og-image/artist/slug/${slug}`;

    // Escape HTML entities for safe injection
    const esc = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const ogTags = `
    <!-- Dynamic OG Meta Tags (Server-Side Injected) -->
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${esc(ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(artistName)} on Boostify Music" />
    <meta property="og:url" content="${esc(pageUrl)}" />
    <meta property="og:site_name" content="Boostify Music" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@boostifymusic" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${esc(artistName)} on Boostify Music" />
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#ea580c" />
    <title>${esc(title)}</title>`;

    // Replace existing title and description, inject OG tags before </head>
    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace('</head>', `${ogTags}\n  </head>`);

    return html;
  } catch (error) {
    console.error('[OG Meta Injection] Error:', error);
    return html;
  }
}

/**
 * Inject Open Graph meta tags for the shareable playlist widget
 * (/embed/playlist/:id). Crawlers don't run JS, so without this they only see
 * the generic Boostify card. og:image points to a branded playlist card.
 */
async function injectPlaylistOGMeta(html: string, playlistId: number, baseUrl: string): Promise<string> {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const [pl] = await sql`
      SELECT p.title, p.description, p.is_public,
             u.artist_name, u.first_name, u.last_name, u.username,
             (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS track_count
      FROM playlists p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.id = ${playlistId}
      LIMIT 1
    `;

    if (!pl || !pl.is_public) return html;

    const ownerName =
      pl.artist_name ||
      [pl.first_name, pl.last_name].filter(Boolean).join(' ') ||
      pl.username ||
      'Boostify';
    const trackCount = Number(pl.track_count || 0);
    const title = `${pl.title || 'Playlist'} — ${ownerName} | Boostify Music`;
    const description = pl.description
      ? String(pl.description).slice(0, 150)
      : `Playlist by ${ownerName}${trackCount ? ` · ${trackCount} track${trackCount === 1 ? '' : 's'}` : ''} — listen on Boostify Music.`;
    const pageUrl = `${baseUrl}/embed/playlist/${playlistId}`;
    const ogImageUrl = `${baseUrl}/api/og-image/playlist/${playlistId}`;

    const esc = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const ogTags = `
    <!-- Dynamic OG Meta Tags (Server-Side Injected) -->
    <meta property="og:type" content="music.playlist" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${esc(ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(pl.title || 'Playlist')} on Boostify Music" />
    <meta property="og:url" content="${esc(pageUrl)}" />
    <meta property="og:site_name" content="Boostify Music" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@boostifymusic" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(ogImageUrl)}" />
    <meta name="description" content="${esc(description)}" />
    <title>${esc(title)}</title>`;

    html = html.replace(/<title>.*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace('</head>', `${ogTags}\n  </head>`);
    return html;
  } catch (error) {
    console.error('[Playlist OG Injection] Error:', error);
    return html;
  }
}

/**
 * Inject Open Graph + JSON-LD NewsArticle structured data for /news?article=<slug>
 * Crawlers (LinkedIn, Facebook, WhatsApp, Twitter, Slack, Discord, Google) need
 * server-side meta tags because they don't execute JavaScript.
 */
async function injectNewsOGMeta(html: string, slug: string, baseUrl: string): Promise<string> {
  try {
    const [article] = await pgDb
      .select({
        id: newsArticles.id,
        slug: newsArticles.slug,
        title: newsArticles.title,
        subtitle: newsArticles.subtitle,
        summary: newsArticles.summary,
        category: newsArticles.category,
        tags: newsArticles.tags,
        publishedAt: newsArticles.publishedAt,
        updatedAt: newsArticles.updatedAt,
        readTimeMinutes: newsArticles.readTimeMinutes,
        coverImageUrl: newsArticles.coverImageUrl,
      })
      .from(newsArticles)
      .where(and(eq(newsArticles.slug, slug), eq(newsArticles.status, 'published')))
      .limit(1);

    if (!article) return html;

    const categoryLabel = NEWS_CATEGORY_LABELS[article.category || 'technology'] || 'News';
    const rawTitle = article.title || 'Boostify News';
    const title = `${rawTitle} | Boostify Music`;
    const rawDesc = article.summary || article.subtitle || `${categoryLabel} insights from Boostify Music — the AI-driven music marketing platform.`;
    const description = rawDesc.length > 200 ? `${rawDesc.slice(0, 197)}...` : rawDesc;
    const pageUrl = `${baseUrl}/news?article=${encodeURIComponent(slug)}`;
    const canonicalUrl = pageUrl;
    // Use existing image endpoint (compresses + caches). Crawlers will fetch this and resolve to a JPEG.
    const ogImageUrl = `${baseUrl}/api/news/articles/${article.id}/image?og=1`;
    const publishedISO = article.publishedAt ? new Date(article.publishedAt).toISOString() : new Date().toISOString();
    const modifiedISO = article.updatedAt ? new Date(article.updatedAt).toISOString() : publishedISO;
    const tags = (article.tags || []).slice(0, 8);
    const keywords = [categoryLabel, 'Boostify', 'music marketing', 'AI music', ...tags].join(', ');

    const esc = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escJson = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');

    // JSON-LD NewsArticle structured data for Google News & rich results
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: rawTitle,
      description: rawDesc,
      image: [ogImageUrl],
      datePublished: publishedISO,
      dateModified: modifiedISO,
      author: {
        '@type': 'Organization',
        name: 'Boostify Music',
        url: baseUrl,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Boostify Music',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/assets/freepik__boostify_music_organe_abstract_icon.png`,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonicalUrl,
      },
      articleSection: categoryLabel,
      keywords: keywords,
      url: canonicalUrl,
    };

    const tagMetas = tags.map(t => `    <meta property="article:tag" content="${esc(t)}" />`).join('\n');

    const ogTags = `
    <!-- Dynamic SEO + OG Meta (Server-Side Injected for /news) -->
    <link rel="canonical" href="${esc(canonicalUrl)}" />
    <meta name="description" content="${esc(description)}" />
    <meta name="keywords" content="${esc(keywords)}" />
    <meta name="author" content="Boostify Music" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="news_keywords" content="${esc(keywords)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${esc(ogImageUrl)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(rawTitle)}" />
    <meta property="og:url" content="${esc(canonicalUrl)}" />
    <meta property="og:site_name" content="Boostify Music" />
    <meta property="og:locale" content="en_US" />
    <meta property="article:published_time" content="${esc(publishedISO)}" />
    <meta property="article:modified_time" content="${esc(modifiedISO)}" />
    <meta property="article:section" content="${esc(categoryLabel)}" />
    <meta property="article:author" content="Boostify Music" />
${tagMetas}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@boostifymusic" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="${esc(rawTitle)}" />
    <meta name="theme-color" content="#ea580c" />
    <title>${esc(title)}</title>
    <script type="application/ld+json">${escJson(JSON.stringify(jsonLd))}</script>`;

    html = html.replace(/<title>[\s\S]*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace('</head>', `${ogTags}\n  </head>`);

    return html;
  } catch (error) {
    console.error('[News OG Injection] Error:', error);
    return html;
  }
}

/**
 * Inject SEO meta + ItemList JSON-LD for the /news index page.
 * Helps Google Discover & generic SERPs.
 */
async function injectNewsIndexMeta(html: string, baseUrl: string): Promise<string> {
  try {
    const articles = await pgDb
      .select({
        slug: newsArticles.slug,
        title: newsArticles.title,
        publishedAt: newsArticles.publishedAt,
      })
      .from(newsArticles)
      .where(eq(newsArticles.status, 'published'))
      .orderBy(desc(newsArticles.publishedAt))
      .limit(20);

    const title = 'Boostify News — AI Music Marketing Insights & Industry Vision';
    const description = 'Daily AI-generated insights on autonomous artists, AI music, Web3, music marketing, and the evolving streaming industry — from Boostify Music.';
    const canonicalUrl = `${baseUrl}/news`;
    const ogImageUrl = `${baseUrl}/assets/freepik__boostify_music_organe_abstract_icon.png`;

    const esc = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escJson = (str: string) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ').replace(/\r/g, '');

    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Boostify News',
      url: canonicalUrl,
      itemListElement: articles.slice(0, 20).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${baseUrl}/news?article=${encodeURIComponent(a.slug)}`,
        name: a.title,
      })),
    };

    const ogTags = `
    <!-- SEO + OG Meta for /news index -->
    <link rel="canonical" href="${esc(canonicalUrl)}" />
    <link rel="alternate" type="application/rss+xml" title="Boostify Music News" href="${esc(baseUrl)}/feed.xml" />
    <meta name="description" content="${esc(description)}" />
    <meta name="keywords" content="music marketing, AI music, autonomous artists, Web3 music, music industry news, Boostify" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(ogImageUrl)}" />
    <meta property="og:url" content="${esc(canonicalUrl)}" />
    <meta property="og:site_name" content="Boostify Music" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(ogImageUrl)}" />
    <meta name="theme-color" content="#ea580c" />
    <title>${esc(title)}</title>
    <script type="application/ld+json">${escJson(JSON.stringify(itemList))}</script>`;

    html = html.replace(/<title>[\s\S]*?<\/title>/, '');
    html = html.replace(/<meta name="description"[^>]*>/, '');
    html = html.replace('</head>', `${ogTags}\n  </head>`);

    return html;
  } catch (error) {
    console.error('[News Index Meta Injection] Error:', error);
    return html;
  }
}

/**
 * Detect crawler/bot from user-agent. Returns true for known social/search crawlers.
 */
function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|applebot|duckduckbot|yandexbot|baiduspider|pinterest|skype/.test(ua);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    envDir: projectRoot, // Ensure .env is loaded from project root
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Don't exit on Vite errors - just log them
        console.error('[Vite Error]', msg);
      },
    },
    optimizeDeps: {
      // Disable dependency scanning to avoid esbuild EPIPE errors on Windows
      noDiscovery: true,
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
    server: {
      middlewareMode: true,
      hmr: { 
        server,
        host: process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost',
      },
      host: true,
      strictPort: false,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes - they should be handled by Express routes, not Vite
    if (url.startsWith('/api/') || url.startsWith('/api')) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`)

      // Inject OG meta tags for artist pages (critical for social media sharing)
      const artistSlugMatch = url.match(/^\/artist\/([a-zA-Z0-9_-]+)\/?$/);
      console.log(`[OG Debug] URL: ${url}, match: ${!!artistSlugMatch}`);
      if (artistSlugMatch) {
        const slug = artistSlugMatch[1];
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
        const baseUrl = `${protocol}://${host}`;
        console.log(`[OG Debug] Injecting meta for slug: ${slug}, baseUrl: ${baseUrl}`);
        template = await injectArtistOGMeta(template, slug, baseUrl);
        const hasOg = template.includes('og:title');
        console.log(`[OG Debug] After injection, has og:title: ${hasOg}`);
      }

      // Inject OG meta for the shareable playlist widget (/embed/playlist/:id)
      const playlistEmbedMatch = url.match(/^\/embed\/playlist\/(\d+)\/?$/);
      if (playlistEmbedMatch) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
        const baseUrl = `${protocol}://${host}`;
        template = await injectPlaylistOGMeta(template, parseInt(playlistEmbedMatch[1], 10), baseUrl);
      }

      // Inject OG meta + JSON-LD for news article URLs (?article=<slug>)
      const newsArticleMatch = url.match(/^\/news(?:\/?|\?.*)?$/);
      if (newsArticleMatch) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
        const baseUrl = `${protocol}://${host}`;
        const articleQuery = req.query?.article;
        const articleSlug = typeof articleQuery === 'string' ? articleQuery : null;
        if (articleSlug) {
          template = await injectNewsOGMeta(template, articleSlug, baseUrl);
        } else {
          template = await injectNewsIndexMeta(template, baseUrl);
        }
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // With OG meta injection for artist pages
  app.use("*", async (req, res) => {
    const url = req.originalUrl;
    const indexPath = path.resolve(distPath, "index.html");

    // Inject OG meta tags for artist pages in production
    const artistSlugMatch = url.match(/^\/artist\/([a-zA-Z0-9_-]+)\/?$/);
    if (artistSlugMatch) {
      try {
        const slug = artistSlugMatch[1];
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'boostifymusic.com';
        const baseUrl = `${protocol}://${host}`;
        let html = await fs.promises.readFile(indexPath, 'utf-8');
        html = await injectArtistOGMeta(html, slug, baseUrl);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (error) {
        console.error('[Static OG Injection] Error:', error);
      }
    }

    // Inject OG meta for the shareable playlist widget (/embed/playlist/:id)
    const playlistEmbedMatch = url.match(/^\/embed\/playlist\/(\d+)\/?$/);
    if (playlistEmbedMatch) {
      try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'boostifymusic.com';
        const baseUrl = `${protocol}://${host}`;
        let html = await fs.promises.readFile(indexPath, 'utf-8');
        html = await injectPlaylistOGMeta(html, parseInt(playlistEmbedMatch[1], 10), baseUrl);
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (error) {
        console.error('[Static Playlist OG Injection] Error:', error);
      }
    }

    // Inject OG meta + JSON-LD for /news (article detail or index)
    if (/^\/news(?:\/?|\?.*)?$/.test(url)) {
      try {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'boostifymusic.com';
        const baseUrl = `${protocol}://${host}`;
        const articleQuery = req.query?.article;
        const articleSlug = typeof articleQuery === 'string' ? articleQuery : null;
        let html = await fs.promises.readFile(indexPath, 'utf-8');
        if (articleSlug) {
          html = await injectNewsOGMeta(html, articleSlug, baseUrl);
        } else {
          html = await injectNewsIndexMeta(html, baseUrl);
        }
        return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (error) {
        console.error('[Static News OG Injection] Error:', error);
      }
    }

    res.sendFile(indexPath);
  });
}