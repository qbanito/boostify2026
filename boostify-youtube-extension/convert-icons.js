const sharp = require('sharp');
const path = require('path');

const sizes = [16, 32, 48, 128];

async function convert() {
  for (const s of sizes) {
    const input = path.join(__dirname, 'public', 'icons', `icon-${s}.svg`);
    const output = path.join(__dirname, 'public', 'icons', `icon-${s}.png`);
    await sharp(input).resize(s, s).png().toFile(output);
    console.log(`Created icon-${s}.png`);
  }
  console.log('All icons converted!');
}

convert().catch(console.error);
