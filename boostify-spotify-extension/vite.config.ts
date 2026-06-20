import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import manifest from './manifest.json';
import { resolve } from 'path';
import { existsSync } from 'fs';

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
    patchServiceWorker(),
  ],
  build: {
    outDir: 'dist',
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
