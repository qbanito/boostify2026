/**
 * build-electron.js — Compile main.ts + preload.ts with esbuild
 * Outputs to desktop/dist-electron/
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  outdir: path.join(root, 'dist-electron'),
  external: [
    'electron',
    'electron-updater',
    'electron-store',
  ],
  sourcemap: true,
  minify: process.argv.includes('--minify'),
};

async function main() {
  console.log('⚙️  Building Electron main process...');

  // Main process → ESM (uses import.meta.url)
  await build({
    ...shared,
    entryPoints: [path.join(root, 'electron', 'main.ts')],
    format: 'esm',
  });

  // Preload script → CJS (Electron requires it with require())
  // Use .cjs extension so Node respects CJS even with "type": "module" in package.json
  await build({
    ...shared,
    entryPoints: [path.join(root, 'electron', 'preload.ts')],
    format: 'cjs',
    outExtension: { '.js': '.cjs' },
  });

  console.log('✅ Electron build complete → dist-electron/');
}

main().catch((err) => {
  console.error('❌ Electron build failed:', err);
  process.exit(1);
});
