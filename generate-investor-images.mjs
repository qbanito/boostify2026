/**
 * Generate professional images for the Boostify Investors Dashboard
 * Using fal.ai flux-pro/kontext/text-to-image model
 */
import fs from 'fs';
import path from 'path';

const FAL_API_KEY = '416abc51-285b-4166-8a0c-d6e1c20cd4ac:fbe103e55dd96ec92891f60f01173199';
const MODEL = 'fal-ai/flux-pro/kontext/text-to-image';

const IMAGES = [
  {
    id: 'hero_dashboard',
    prompt: 'Ultra-professional music technology platform dashboard interface, dark UI design with orange and amber accent colors, holographic data visualizations, AI-powered analytics charts, floating panels with waveforms and spectrograms, futuristic music producer workstation, cinematic 4K quality, deep black background with subtle orange gradient glows, award-winning product design photography, business tech editorial style, ultra sharp, hyperrealistic',
    width: 1280,
    height: 720,
  },
  {
    id: 'ai_music_platform',
    prompt: 'Sleek AI music production software on MacBook Pro laptop on a modern studio desk, dark mode interface showing artist analytics dashboard with revenue charts in orange and amber tones, music waveforms, streaming metrics, professional photography, studio ambient lighting, bokeh background with mixing equipment, editorial tech product photography, photorealistic, 8K',
    width: 1280,
    height: 720,
  },
  {
    id: 'market_opportunity',
    prompt: 'Global music industry market visualization, world map made of glowing orange and amber data points, floating financial graphs and charts showing exponential growth curves, holographic 3D infographic elements, dark background, cinematic business technology illustration, professional investment presentation visual, vibrant yet sophisticated color palette, ultra high detail',
    width: 1280,
    height: 640,
  },
  {
    id: 'ai_technology',
    prompt: 'Abstract AI neural network visualization connected to music soundwaves and musical notes, glowing orange and gold nodes with connection lines forming a brain-like structure, floating music symbols and blockchain hexagons, dark background with deep space aesthetic, ultra high resolution digital art, professional tech company visual, 8K ultra sharp',
    width: 1280,
    height: 640,
  },
  {
    id: 'revenue_streams',
    prompt: 'Sleek financial technology revenue dashboard mockup, multiple income stream visualizations with gradient bars in orange amber purple and green on dark background, cryptocurrency symbols, streaming platform logos stylized, subscription metrics, blockchain tokens, professional fintech visual, editorial clean design, ultra sharp photorealistic render',
    width: 1280,
    height: 640,
  },
  {
    id: 'artist_ecosystem',
    prompt: 'Young diverse independent music artists collaborating in a modern high-tech recording studio, surrounded by holographic UI overlays showing social media metrics, streaming charts and AI tools, warm orange studio lighting, professional editorial photography, cinematic depth of field, inspiring and aspirational mood, 4K professional photography',
    width: 1280,
    height: 720,
  },
];

async function generateImage(img) {
  console.log(`\n[GEN] Generating: ${img.id}...`);

  const response = await fetch(`https://fal.run/${MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: img.prompt,
      image_size: { width: img.width, height: img.height },
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'jpeg',
      safety_tolerance: '2',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err}`);
  }

  const data = await response.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error('No image URL in response: ' + JSON.stringify(data));

  console.log(`  [OK] ${img.id}: ${url}`);
  return { id: img.id, url };
}

async function main() {
  console.log('Starting image generation with fal.ai flux-pro/kontext...\n');
  const results = {};

  for (const img of IMAGES) {
    try {
      const { id, url } = await generateImage(img);
      results[id] = url;
    } catch (err) {
      console.error(`  [FAIL] ${img.id}: ${err.message}`);
      results[img.id] = null;
    }
  }

  console.log('\n\n=== RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  // Save to a JSON file for use in the component
  fs.writeFileSync('investor-images.json', JSON.stringify(results, null, 2));
  console.log('\nSaved to investor-images.json');
}

main().catch(console.error);
