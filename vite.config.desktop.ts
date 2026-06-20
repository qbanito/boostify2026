/**
 * vite.config.desktop.ts — Vite config for Electron renderer
 *
 * Differences from the web config:
 *  - Dev port 5173 (avoids collision with web on 5000)
 *  - Output goes to desktop/renderer/ instead of dist/public/
 *  - base "./" for file:// protocol in production
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
  base: './', // Relative paths for file:// in Electron production
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
      '@radix-ui/react-collapsible',
      '@radix-ui/react-use-controllable-state',
      '@radix-ui/react-primitive',
      '@radix-ui/react-slot',
      '@radix-ui/react-compose-refs',
      '@radix-ui/react-context',
      '@radix-ui/react-id',
      '@radix-ui/react-tooltip',
      'react-hook-form',
      '@hookform/resolvers',
      'use-sync-external-store',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/with-selector',
      'zustand',
    ],
    esbuildOptions: {
      mainFields: ['module', 'main'],
    },
  },
  root: path.resolve(__dirname, "client"),
  server: {
    port: 5173, // Different port from web dev
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
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-tabs',
            '@radix-ui/react-avatar',
            '@radix-ui/react-select',
          ],
          'utils-vendor': ['zustand', '@tanstack/react-query'],
        },
      },
    },
    outDir: path.resolve(__dirname, "desktop", "renderer"),
    emptyOutDir: true,
  },
});
