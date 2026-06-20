/**
 * Test Script: FAL Video Generation with Kling O1
 * Verifica que el modelo fal-ai/kling-video/o1/standard/reference-to-video funciona
 */

import { fal } from "@fal-ai/client";
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configurar FAL
const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
if (!FAL_API_KEY) {
  console.error('❌ FAL_API_KEY no está configurada');
  console.log('Variables encontradas:', Object.keys(process.env).filter(k => k.includes('FAL')));
  process.exit(1);
}

fal.config({
  credentials: FAL_API_KEY
});

const TEST_IMAGE = "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800"; // Artist on stage
const TEST_PROMPT = "A musician performing on stage with dramatic lighting, camera slowly zooming in";

async function testKlingO1ReferenceToVideo() {
  console.log('\n🎬 TEST: Kling O1 Reference-to-Video');
  console.log('=' .repeat(50));
  console.log('Model: fal-ai/kling-video/o1/standard/reference-to-video');
  console.log('Image:', TEST_IMAGE);
  console.log('Prompt:', TEST_PROMPT);
  
  try {
    const result = await fal.subscribe("fal-ai/kling-video/o1/standard/reference-to-video", {
      input: {
        prompt: TEST_PROMPT,
        reference_images: [TEST_IMAGE],
        duration: "5",
        aspect_ratio: "16:9"
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log('📊 Status:', update.status);
      }
    });
    
    console.log('\n✅ SUCCESS!');
    console.log('Video URL:', result.data?.video?.url || result.data?.output_url || 'N/A');
    console.log('Full result:', JSON.stringify(result.data, null, 2));
    
    return { success: true, data: result.data };
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Full error:', error);
    return { success: false, error: error.message };
  }
}

async function testKlingO1ImageToVideo() {
  console.log('\n🎬 TEST: Kling O1 Image-to-Video');
  console.log('=' .repeat(50));
  console.log('Model: fal-ai/kling-video/o1/standard/image-to-video');
  
  try {
    const result = await fal.subscribe("fal-ai/kling-video/o1/standard/image-to-video", {
      input: {
        prompt: TEST_PROMPT,
        image_url: TEST_IMAGE,
        duration: "5"
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log('📊 Status:', update.status);
      }
    });
    
    console.log('\n✅ SUCCESS!');
    console.log('Video URL:', result.data?.video?.url || result.data?.output_url || 'N/A');
    
    return { success: true, data: result.data };
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

async function testModelAvailability() {
  console.log('\n🔍 Verificando disponibilidad de modelos Kling O1...\n');
  
  const models = [
    'fal-ai/kling-video/o1/standard/reference-to-video',
    'fal-ai/kling-video/o1/standard/image-to-video',
    'fal-ai/kling-video/v2.1/pro/image-to-video'
  ];
  
  for (const model of models) {
    try {
      // Solo verificar si el modelo existe (sin generar)
      console.log(`📋 ${model} - Verificando...`);
      const info = await fetch(`https://queue.fal.run/${model}`, {
        method: 'HEAD',
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`
        }
      });
      console.log(`   Status: ${info.status} ${info.status === 200 || info.status === 405 ? '✅' : '❌'}`);
    } catch (e) {
      console.log(`   ❌ Error verificando modelo`);
    }
  }
}

// Main
async function main() {
  console.log('\n🚀 BOOSTIFY - FAL Video Generation Test');
  console.log('=' .repeat(50));
  
  await testModelAvailability();
  
  // Descomentar para hacer test real (consume créditos FAL)
  // await testKlingO1ReferenceToVideo();
  // await testKlingO1ImageToVideo();
  
  console.log('\n✅ Tests completados');
  console.log('Para ejecutar test de generación real, descomenta las líneas en main()');
}

main().catch(console.error);
