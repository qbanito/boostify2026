/**
 * wait-then-launch.js — Wait for Vite dev server, then launch Electron
 *
 * Polls http://localhost:5173 until it responds, then spawns electron.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const VITE_URL = 'http://localhost:5174';
const POLL_INTERVAL = 500;
const MAX_WAIT = 30_000;

function checkServer() {
  return new Promise((resolve) => {
    http.get(VITE_URL, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    }).on('error', () => resolve(false));
  });
}

async function waitForVite() {
  const start = Date.now();
  console.log('⏳ Waiting for Vite dev server...');

  while (Date.now() - start < MAX_WAIT) {
    if (await checkServer()) {
      console.log('✅ Vite ready — launching Electron');
      return true;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.error('❌ Vite did not start within 30s');
  return false;
}

async function main() {
  // Build electron (esbuild is fast)
  const buildProc = spawn('node', ['scripts/build-electron.js'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  await new Promise((resolve) => buildProc.on('close', resolve));

  // Wait for Vite
  const ok = await waitForVite();
  if (!ok) process.exit(1);

  // Launch Electron
  const electronBin = path.join(root, 'node_modules', '.bin', 'electron');
  const electronProc = spawn(electronBin, [path.join(root, 'dist-electron', 'main.js')], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  electronProc.on('close', (code) => process.exit(code ?? 0));
}

main();
