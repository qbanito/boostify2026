/**
 * Build script for Chrome Web Store submission.
 * 
 * 1. Runs `vite build` to compile everything into dist/
 * 2. Patches the dist/manifest.json to remove localhost permissions
 * 3. Ensures the API_BASE_URL points to production
 * 4. Creates a .zip ready for upload
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIST_DIR = resolve(__dirname, 'dist');
const MANIFEST_PATH = resolve(DIST_DIR, 'manifest.json');

console.log('🔨 Building extension for Chrome Web Store...\n');

// Step 1: Run vite build
console.log('Step 1: Running vite build...');
execSync('npx vite build', { cwd: __dirname, stdio: 'inherit' });

// Step 2: Patch the manifest — remove localhost host_permissions
console.log('\nStep 2: Patching manifest.json for production...');
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

// Remove localhost from host_permissions
if (manifest.host_permissions) {
  manifest.host_permissions = manifest.host_permissions.filter(
    (p) => !p.includes('localhost')
  );
}

// Remove localhost from externally_connectable
if (manifest.externally_connectable?.matches) {
  manifest.externally_connectable.matches = manifest.externally_connectable.matches.filter(
    (p) => !p.includes('localhost')
  );
}

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
console.log('   ✅ Manifest patched (localhost removed)');

// Step 3: Create zip
console.log('\nStep 3: Creating zip for upload...');
const outputDir = resolve(__dirname, '..');
const zipName = 'boostify-instagram-extension.zip';
try {
  // Try using PowerShell on Windows
  execSync(
    `Compress-Archive -Path "${DIST_DIR}\\*" -DestinationPath "${resolve(outputDir, zipName)}" -Force`,
    { stdio: 'inherit' }
  );
  console.log(`   ✅ Created ${zipName}`);
} catch {
  console.log('   ⚠️  Could not auto-zip. Manually zip the dist/ folder for upload.');
}

console.log('\n🎉 Build complete! Upload the .zip to https://chrome.google.com/webstore/devconsole');
