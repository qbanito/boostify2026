/**
 * vite.config.timeline.ts — Vite config for the standalone Timeline-only desktop app
 *
 * Key differences:
 *  - Entry: client/timeline.html (not index.html)
 *  - Output: desktop-timeline/renderer/
 *  - Smaller bundle — only pulls TimelineEditor tree
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), themePlugin()],
  envDir: __dirname,
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      "@db": path.resolve(__dirname, "db"),
      "@shared": path.resolve(__dirname, "shared"),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      'react-hook-form',
      '@hookform/resolvers',
      'zustand',
    ],
    esbuildOptions: {
      mainFields: ['module', 'main'],
    },
  },
  root: path.resolve(__dirname, "client"),
  server: {
    port: 5174, // Unique port for timeline dev
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'client', 'timeline.html'),
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
          ],
        },
      },
    },
    outDir: path.resolve(__dirname, "desktop-timeline", "renderer"),
    emptyOutDir: true,
  },
});
