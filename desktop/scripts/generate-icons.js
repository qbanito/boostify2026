/**
 * generate-icons.js — Convert generated-icon.png into all formats needed for Electron
 *
 * Outputs:
 *  - desktop/resources/icon.ico  (Windows — multi-size ICO: 16,32,48,64,128,256)
 *  - desktop/resources/icon.png  (256x256 — used by Linux & as fallback)
 *  - desktop/resources/icons/    (Linux icon set: 16,32,48,64,128,256,512)
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const resourcesDir = path.join(root, 'resources');
const iconsDir = path.join(resourcesDir, 'icons');

const SOURCE = path.resolve(root, '..', 'generated-icon.png');
const SIZES = [16, 32, 48, 64, 128, 256, 512];

async function main() {
  // Ensure directories exist
  fs.mkdirSync(iconsDir, { recursive: true });

  console.log(`📸 Source: ${SOURCE}`);
  console.log(`📁 Output: ${resourcesDir}`);

  // Generate individual PNGs for each size
  const pngBuffers = {};
  for (const size of SIZES) {
    const outPath = path.join(iconsDir, `${size}x${size}.png`);
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    
    fs.writeFileSync(outPath, buf);
    pngBuffers[size] = buf;
    console.log(`  ✅ ${size}x${size}.png`);
  }

  // Copy 256x256 as the main icon.png
  fs.copyFileSync(path.join(iconsDir, '256x256.png'), path.join(resourcesDir, 'icon.png'));
  console.log(`  ✅ icon.png (256x256)`);

  // Generate .ico (Windows) from the individual PNGs
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoPngs = icoSizes.map(s => path.join(iconsDir, `${s}x${s}.png`));
  const icoBuffer = await pngToIco(icoPngs);
  fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoBuffer);
  console.log(`  ✅ icon.ico (multi-size: ${icoSizes.join(',')})`);

  console.log('\n🎉 All icons generated!');
}

main().catch(err => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
