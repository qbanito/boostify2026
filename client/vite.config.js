import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * OG Meta Plugin — injects Open Graph tags for /artist/:slug pages
 * so social media crawlers (Facebook, WhatsApp, Twitter) see thumbnails.
 * Uses transformIndexHtml hook which is called for every HTML response.
 */
function ogMetaPlugin() {
  return {
    name: 'og-meta-injection',
    transformIndexHtml: {
      order: 'post',
      async handler(html, ctx) {
        const url = ctx.originalUrl || '';
        const artistMatch = url.match(/^\/artist\/([a-zA-Z0-9_-]+)\/?(\?.*)?$/);
        if (!artistMatch) return html;
        
        const slug = artistMatch[1];
        console.log(`[OG Plugin] 🔍 transformIndexHtml for /artist/${slug}`);
        
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          
          const apiResp = await fetch(`http://localhost:3000/api/artist/by-slug/${slug}`, {
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });
          clearTimeout(timeout);
          
          if (!apiResp.ok) {
            console.log(`[OG Plugin] Artist not found: ${slug}`);
            return html;
          }
          
          const data = await apiResp.json();
          if (!data.success || !data.artist) return html;
          
          const artist = data.artist;
          const artistName = artist.artistName || 'Artist';
          const genre = artist.genres?.[0] || '';
          const biography = artist.biography || '';
          const description = biography.length > 155
            ? biography.slice(0, 152) + '...'
            : biography || `Discover ${artistName}${genre ? `, ${genre} artist` : ''} on Boostify Music.`;
          const title = `${artistName}${genre ? ` - ${genre}` : ''} | Boostify Music`;
          
          const host = ctx.server?.config?.server?.host || 'localhost';
          const port = ctx.server?.config?.server?.port || 5000;
          const baseUrl = `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
          const pageUrl = `${baseUrl}/artist/${slug}`;
          const ogImageUrl = `${baseUrl}/api/og-image/artist/slug/${slug}`;
          
          const esc = (s) => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          
          // Remove existing generic title and description
          html = html.replace(/<title>.*?<\/title>/s, '');
          html = html.replace(/<meta\s+name="description"[^>]*>/g, '');
          
          const ogTags = `
    <!-- OG Meta Tags for ${esc(artistName)} -->
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
          return html;
        } catch (error) {
          console.log(`[OG Plugin] ❌ Error:`, error.message);
          return html;
        }
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    ogMetaPlugin(),
    react(),
    runtimeErrorOverlay(),
    themePlugin()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      "@db": path.resolve(__dirname, "..", "db"),
      "@shared": path.resolve(__dirname, "..", "shared"),
    },
  },
  envDir: path.resolve(__dirname, ".."), // Load .env from project root
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    hmr: {
      host: 'localhost',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
    allowedHosts: [
      'ecb7959a-10a2-43c2-b3de-f9c2a2fb7282-00-5xhhuxyy3b9j.kirk.replit.dev',
      '.replit.dev',
      '.replit.app',
      'localhost',
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
  }
});