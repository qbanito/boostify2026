import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { ogMetaPlugin } from "./client/vite-og-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// El overlay de runtime-error de Replit muestra una modal a pantalla completa por
// CUALQUIER error/rechazo no manejado. Cuando el CDN de Clerk no carga (red, adblock,
// límites de las dev keys) Clerk lanza "failed_to_load_clerk_js"; eso es transitorio y
// ya lo degradamos a warning en main.tsx, así que NO debe tumbar la app con el overlay.
// El filtro deja pasar el resto de errores reales de código.
const isIgnorableRuntimeError = (error: Error) => {
  const msg = `${error?.message ?? ""} ${error?.stack ?? ""}`;
  return /failed_to_load_clerk_js|Failed to load Clerk|clerk\.browser\.js/i.test(msg);
};

export default defineConfig({
  plugins: [
    ogMetaPlugin(),
    react(),
    runtimeErrorOverlay({ filter: (error) => !isIgnorableRuntimeError(error) }),
    themePlugin(),
  ],
  envDir: __dirname, // Load .env from project root
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
      'zustand',
      'zustand/middleware',
    ],
    exclude: [],
  },
  root: path.resolve(__dirname, "client"),
  server: {
    port: 5001,
    strictPort: true,
    host: 'localhost',
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5001,
      clientPort: 5001,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 0,
      },
      '/ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 0,
      },
      '/static-assets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        timeout: 0,
      },
      '/epk': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        timeout: 0,
      },
      '/DEMO%20TIGUER': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        timeout: 0,
      },
    },
    allowedHosts: true, // Allow all hosts in production
  },
  build: {
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
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
          'utils-vendor': ['axios', 'zustand', '@tanstack/react-query'],
        },
      },
    },
    minify: 'terser',
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});