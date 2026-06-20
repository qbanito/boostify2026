// Generate PNG icons from SVGs for Chrome Extension
// Run: node generate-icons.mjs
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const sizes = [16, 32, 48, 128];

// Create simple canvas-based PNGs using sharp or fallback to placeholder
async function generateIcons() {
  console.log('Generating extension icons...');
  
  const outDir = 'public/icons';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  try {
    // Try using sharp if available
    const sharp = (await import('sharp')).default;
    
    for (const size of sizes) {
      const svg = generateSVG(size);
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(`${outDir}/icon-${size}.png`);
      console.log(`✓ Generated icon-${size}.png`);
    }
  } catch (e) {
    console.log('sharp not available, creating placeholder PNGs...');
    // Create minimal 1-pixel PNGs as placeholders
    for (const size of sizes) {
      const svg = generateSVG(size);
      writeFileSync(`${outDir}/icon-${size}.svg`, svg);
      console.log(`✓ Generated icon-${size}.svg (convert to PNG manually)`);
    }
  }
}

function generateSVG(size) {
  const rx = Math.round(size * 0.22);
  const sw = Math.max(1, Math.round(size * 0.04));
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="ig" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#833ab4"/>
      <stop offset="50%" style="stop-color:#fd1d1d"/>
      <stop offset="100%" style="stop-color:#fcb045"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#ig)"/>
  <rect x="${size*0.22}" y="${size*0.22}" width="${size*0.56}" height="${size*0.56}" rx="${size*0.15}" stroke="white" stroke-width="${sw}" fill="none"/>
  <circle cx="${size*0.5}" cy="${size*0.5}" r="${size*0.156}" stroke="white" stroke-width="${sw}" fill="none"/>
  <circle cx="${size*0.69}" cy="${size*0.31}" r="${size*0.04}" fill="white"/>
  <path d="M${size*0.44} ${size*0.39}L${size*0.41} ${size*0.5}h${size*0.08}l-${size*0.05} ${size*0.11} ${size*0.12}-${size*0.15}h-${size*0.08}l${size*0.05}-${size*0.08}z" fill="white" opacity="0.85"/>
</svg>`;
}

generateIcons().catch(console.error);
