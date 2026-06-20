import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import manifest from './manifest.json';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Copy content script CSS to dist after build
function copyContentCss() {
  return {
    name: 'copy-content-css',
    closeBundle() {
      const src = resolve(__dirname, 'src/content/styles/boostify-overlay.css');
      const destDir = resolve(__dirname, 'dist/assets');
      const dest = resolve(destDir, 'boostify-overlay.css');
      if (existsSync(src)) {
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        copyFileSync(src, dest);
        console.log('[copy-content-css] Copied boostify-overlay.css to dist/assets/');
      }
    }
  };
}

// Patch service worker to add guards for missing `window` and `document` in SW context
function patchServiceWorker() {
  const { readFileSync, writeFileSync, readdirSync } = require('fs');
  return {
    name: 'patch-service-worker',
    closeBundle() {
      const assetsDir = resolve(__dirname, 'dist/assets');
      if (!existsSync(assetsDir)) return;
      const sw = readdirSync(assetsDir).find((f: string) => f.startsWith('index.ts-') && f.endsWith('.js'));
      if (!sw) return;
      const path = resolve(assetsDir, sw);
      let code = readFileSync(path, 'utf8');
      // Add globalThis guards for service worker context
      const guard = 'if(typeof window==="undefined"){globalThis.window=globalThis;globalThis.document={getElementsByTagName:()=>[],querySelector:()=>null,createElement:()=>({relList:{supports:()=>false}}),head:{appendChild:()=>{}}};}';
      if (!code.includes('globalThis.window=globalThis')) {
        code = guard + code;
        writeFileSync(path, code);
        console.log('[patch-service-worker] Added window/document guards to', sw);
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    crx({ manifest }),
    copyContentCss(),
    patchServiceWorker(),
  ],
  build: {
    outDir: 'dist',
    // CRITICAL: Disable modulePreload polyfill — it uses `document` which doesn't exist
    // in service worker context and crashes the background script
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
