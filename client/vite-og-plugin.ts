/**
 * Vite Plugin: OG Meta Tag Injection for Artist Pages
 * 
 * This plugin intercepts HTML responses for /artist/:slug routes
 * and injects Open Graph meta tags server-side so that social media
 * crawlers (Facebook, WhatsApp, Twitter, Discord) can read them.
 */
import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';

export function ogMetaPlugin(): Plugin {
  return {
    name: 'og-meta-injection',
    
    configureServer(server: ViteDevServer) {
      console.log('[OG Plugin] ✅ Plugin loaded and configureServer called');
      
      // PRE-middleware: runs BEFORE Vite's built-in SPA fallback and HTML serving
      server.middlewares.use(async (req: any, res: any, next: any) => {
          const url = req.url || '';
          
          // Only intercept artist page HTML requests
          const artistMatch = url.match(/^\/artist\/([a-zA-Z0-9_-]+)\/?(\?.*)?$/);
          if (!artistMatch) {
            return next();
          }
          
          // Skip if the client doesn't accept HTML (e.g., HMR websocket, JS files)
          const accept = req.headers.accept || '';
          if (!accept.includes('text/html')) {
            return next();
          }
          
          const slug = artistMatch[1];
          console.log(`[OG Plugin] 🔍 Intercepting /artist/${slug}`);
          
          try {
            // Fetch artist data from Express API (port 3000)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const apiResponse = await fetch(`http://localhost:3000/api/artist/by-slug/${slug}`, {
              headers: { 'Accept': 'application/json' },
              signal: controller.signal,
            });
            
            clearTimeout(timeout);
            
            if (!apiResponse.ok) {
              console.log(`[OG Plugin] Artist not found: ${slug}`);
              return next();
            }
            
            const data = await apiResponse.json();
            if (!data.success || !data.artist) {
              return next();
            }
            
            const artist = data.artist;
            const artistName = artist.artistName || 'Artist';
            const genre = artist.genres?.[0] || '';
            const biography = artist.biography || '';
            const description = biography.length > 155
              ? `${biography.slice(0, 152)}...`
              : biography || `Discover the music of ${artistName}${genre ? `, ${genre} artist` : ''} on Boostify Music.`;
            const title = `${artistName}${genre ? ` - ${genre}` : ''} | Boostify Music`;
            
            const host = req.headers.host || 'localhost:5000';
            const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
            const baseUrl = `${protocol}://${host}`;
            const pageUrl = `${baseUrl}/artist/${slug}`;
            const ogImageUrl = `${baseUrl}/api/og-image/artist/slug/${slug}`;
            
            const esc = (str: string) => str
              .replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            
            // Read and transform the HTML
            const indexPath = path.resolve(server.config.root, 'index.html');
            let html = fs.readFileSync(indexPath, 'utf-8');
            
            // Let Vite process it (adds HMR client, React refresh, etc.)
            html = await server.transformIndexHtml(url, html);
            
            // Remove existing generic title and description
            html = html.replace(/<title>.*?<\/title>/s, '');
            html = html.replace(/<meta\s+name="description"[^>]*>/g, '');
            
            // Inject OG tags
            const ogTags = `
    <!-- Dynamic OG Meta Tags for ${esc(artistName)} -->
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
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
    <meta name="theme-color" content="#ea580c" />`;
            
            html = html.replace('</head>', `${ogTags}\n  </head>`);
            
            console.log(`[OG Plugin] ✅ Injected OG tags for ${artistName}`);
            
            res.setHeader('Content-Type', 'text/html');
            res.statusCode = 200;
            res.end(html);
            
          } catch (error) {
            console.log(`[OG Plugin] ❌ Error for /artist/${slug}:`, (error as Error).message);
            return next();
          }
        });
    },
  };
}
