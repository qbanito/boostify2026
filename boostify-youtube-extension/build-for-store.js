/**
 * Build script for Chrome Web Store submission.
 * 
 * 1. Runs vite build
 * 2. Copies production manifest (no localhost permissions)
 * 3. Packages dist/ into a ZIP ready to upload to CWS
 * 
 * Usage:  npm run build:store
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const ZIP_NAME = 'boostify-youtube-sync-chrome-web-store.zip';

console.log('🔨  Building extension for Chrome Web Store...\n');

// Step 1 — Run vite build
console.log('1/3  Running vite build...');
execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
console.log('');

// Step 2 — Replace manifest with production version (no localhost)
console.log('2/3  Swapping manifest.json → production (no localhost permissions)...');
const prodManifest = path.join(ROOT, 'manifest.production.json');
const distManifest = path.join(DIST, 'manifest.json');

if (fs.existsSync(prodManifest)) {
  fs.copyFileSync(prodManifest, distManifest);
  console.log('     ✅ Production manifest copied');
} else {
  console.warn('     ⚠️  manifest.production.json not found, using default manifest');
}

// Step 3 — Create ZIP
console.log('3/3  Creating ZIP...');
const archiver = (() => {
  try { return require('archiver'); } catch { return null; }
})();

if (archiver) {
  const output = fs.createWriteStream(path.join(ROOT, ZIP_NAME));
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  output.on('close', () => {
    const size = (archive.pointer() / 1024).toFixed(1);
    console.log(`     ✅ ${ZIP_NAME} created (${size} KB)`);
    console.log('\n🎉  Ready to upload at https://chrome.google.com/webstore/devconsole\n');
  });

  archive.on('error', (err) => { throw err; });
  archive.pipe(output);
  archive.directory(DIST, false);
  archive.finalize();
} else {
  // Fallback: use PowerShell on Windows / zip on Unix
  const zipPath = path.join(ROOT, ZIP_NAME);
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${DIST}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`cd "${DIST}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }
  console.log(`     ✅ ${ZIP_NAME} created`);
  console.log('\n🎉  Ready to upload at https://chrome.google.com/webstore/devconsole\n');
}
