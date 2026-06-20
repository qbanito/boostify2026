/**
 * Generate futuristic CrowdSync DJ "Live Visuals" assets with OpenAI
 * (GPT Image 1, falling back to DALL-E 3) and upload them to Firebase Storage.
 * Prints the permanent URLs so they can be hardcoded into
 * client/src/pages/boostify-crowdsync-dj.tsx (visualAssets).
 *
 * Run: npx tsx scripts/generate-crowdsync-visuals.ts
 */
import 'dotenv/config';

const VISUALS: { key: string; name: string; prompt: string }[] = [
  {
    key: 'gold-rain',
    name: 'Gold Rain',
    prompt:
      'Futuristic concert stage visual, cascading golden light particles raining down, holographic gold sparks, dark moody background, volumetric light beams, cinematic neon glow, ultra-detailed, 8k, abstract VJ loop frame, premium club aesthetic',
  },
  {
    key: 'blue-tunnel',
    name: 'Blue Tunnel',
    prompt:
      'Futuristic neon blue light tunnel, infinite perspective, glowing cyan and electric blue lines, sci-fi wormhole, cyberpunk laser grid, dark background, volumetric haze, cinematic, ultra-detailed, abstract VJ stage visual, 8k',
  },
  {
    key: 'led-grid',
    name: 'LED Grid',
    prompt:
      'Futuristic glowing LED grid floor and ceiling, magenta and purple neon squares, perspective vanishing point, cyberpunk nightclub, holographic light panels, dark atmosphere, cinematic neon, ultra-detailed abstract stage visual, 8k',
  },
  {
    key: 'solar-drop',
    name: 'Solar Drop',
    prompt:
      'Futuristic sun-drenched festival drop visual, radiant orange and amber energy burst, glowing solar flare rings, warm cinematic light, dark gradient sky, volumetric god rays, ultra-detailed abstract VJ stage visual, premium aesthetic, 8k',
  },
];

async function main() {
  const { generateImageWithGPTImage1, generateImageWithOpenAI } = await import('../server/services/fal-service');
  const results: Record<string, string> = {};

  for (const v of VISUALS) {
    process.stdout.write(`\n🎨 Generating "${v.name}" with OpenAI…\n`);
    try {
      // 1) GPT Image 1 (landscape), 2) DALL-E 3 (1792x1024) fallback
      let res = await generateImageWithGPTImage1(v.prompt, {
        size: '1536x1024',
        quality: 'high',
      });
      if (!res.success || !res.imageUrl) {
        console.warn(`⚠️  GPT Image 1 failed for ${v.name} (${res.error || 'no image'}); trying DALL-E 3…`);
        res = await generateImageWithOpenAI(v.prompt, {
          size: '1792x1024',
          quality: 'hd',
        });
      }
      if (res.success && res.imageUrl) {
        results[v.key] = res.imageUrl;
        console.log(`✅ ${v.name}: ${res.imageUrl}`);
      } else {
        console.error(`❌ ${v.name}: no image returned`, res);
      }
    } catch (err: any) {
      console.error(`❌ ${v.name} failed:`, err?.message || err);
    }
  }

  console.log('\n\n──────── RESULTS (paste into visualAssets) ────────');
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
