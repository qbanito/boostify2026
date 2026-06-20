/**
 * ============================================================
 * TEST DE MODELOS FAL AI NANO BANANA
 * ============================================================
 * 
 * MODELOS PRINCIPALES:
 * - fal-ai/nano-banana: Text-to-Image (GENERACIÓN)
 * - fal-ai/nano-banana/edit: Image-to-Image (EDICIÓN)
 * 
 * Precio: $0.039 por imagen (~25 imágenes por $1)
 */
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const FAL_API_KEY = process.env.FAL_API_KEY;
const FAL_BASE_URL = 'https://fal.run';

async function testNanoBananaModels() {
  console.log('🧪 PRUEBA DE MODELOS FAL AI NANO BANANA\n');
  console.log('=' .repeat(60));
  
  // Verificar API key
  if (!FAL_API_KEY) {
    console.error('❌ FAL_API_KEY no está configurada en .env');
    process.exit(1);
  }
  
  console.log('✅ FAL_API_KEY encontrada:', FAL_API_KEY.substring(0, 20) + '...\n');

  // ============================================================
  // TEST 1: nano-banana (Text-to-Image - GENERACIÓN)
  // ============================================================
  console.log('📡 TEST 1: nano-banana (Text-to-Image)');
  console.log('-'.repeat(60));
  
  try {
    const generationBody = {
      prompt: 'Professional product photo of a premium black t-shirt with "Boostify Music" logo printed. Urban streetwear style. Orange and black colors. White background, 4K quality.',
      num_images: 1,
      aspect_ratio: '1:1',
      output_format: 'png',
    };
    
    console.log('   Endpoint: fal-ai/nano-banana');
    console.log('   Request:', JSON.stringify(generationBody, null, 2));
    
    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/nano-banana`,
      generationBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200 && response.data?.images?.[0]?.url) {
      console.log('   ✅ nano-banana (generación) funcionando!');
      console.log('   📷 Imagen:', response.data.images[0].url);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.response?.data || error.message);
  }

  console.log('\n');

  // ============================================================
  // TEST 2: nano-banana/edit (Image-to-Image - EDICIÓN)
  // ============================================================
  console.log('📡 TEST 2: nano-banana/edit (Image-to-Image)');
  console.log('-'.repeat(60));
  
  // Imagen de prueba pública
  const testImageUrl = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=512&h=512&fit=crop';
  
  try {
    const editBody = {
      prompt: 'Transform this into a professional product photo of a black hoodie with artistic music-themed design. Orange accents. White background, studio lighting.',
      image_urls: [testImageUrl], // ARRAY - requisito de nano-banana/edit
      num_images: 1,
      aspect_ratio: 'auto',
      output_format: 'png',
    };
    
    console.log('   Endpoint: fal-ai/nano-banana/edit');
    console.log('   Input image:', testImageUrl);
    console.log('   Request:', JSON.stringify(editBody, null, 2));
    
    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/nano-banana/edit`,
      editBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200 && response.data?.images?.[0]?.url) {
      console.log('   ✅ nano-banana/edit (edición) funcionando!');
      console.log('   📷 Imagen:', response.data.images[0].url);
    }
  } catch (error: any) {
    console.log('   ❌ Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ PRUEBAS COMPLETADAS');
  console.log('\n📋 RESUMEN DE MODELOS:');
  console.log('   • nano-banana: Text-to-Image (solo prompt)');
  console.log('   • nano-banana/edit: Image-to-Image (image_urls como ARRAY)');
  console.log('   • Precio: $0.039 por imagen');
}

// Ejecutar prueba
testNanoBananaModels().catch(console.error);
