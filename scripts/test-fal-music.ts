/**
 * Test script para verificar la generación de música con MiniMax Music V2
 * 
 * Modelo: fal-ai/minimax-music/v2
 * Precio: $0.03 por generación
 * 
 * Ejecutar: npx ts-node scripts/test-fal-music.ts
 */

import axios from 'axios';

const FAL_API_KEY = process.env.FAL_API_KEY || '416abc51-285b-4166-8a0c-d6e1c20cd4ac:fbe103e55dd96ec92891f60f01173199';
const FAL_BASE_URL = 'https://fal.run';

async function testMiniMaxMusic() {
  console.log('🎵 ===== TEST: FAL AI MINIMAX MUSIC V2 =====\n');

  // Parámetros del test
  const stylePrompt = 'Pop, upbeat, energetic, catchy hooks, modern production, clear vocals';
  
  const lyricsPrompt = `[verse]
Walking through the city lights tonight
Boostify got me feeling so alive
Every moment shining bright
This is our time, our fight

[chorus]
Boostify, oh Boostify
We're dancing till the morning light
Boostify, feel the vibe
Nothing's gonna stop us tonight

[verse]
Dreams are chasing through my mind
Leaving all the doubts behind
With every beat, I feel so free
This is where I'm meant to be

[chorus]
Boostify, oh Boostify
We're dancing till the morning light
Boostify, feel the vibe
Nothing's gonna stop us tonight`;

  console.log('📋 Request Parameters:');
  console.log(`  Model: fal-ai/minimax-music/v2`);
  console.log(`  Style Prompt: ${stylePrompt}`);
  console.log(`  Lyrics Length: ${lyricsPrompt.length} caracteres`);
  console.log('');

  try {
    console.log('⏳ Enviando request a FAL AI...\n');
    
    const startTime = Date.now();
    
    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/minimax-music/v2`,
      {
        prompt: stylePrompt,
        lyrics_prompt: lyricsPrompt,
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000, // Máximo bitrate disponible
          format: 'mp3'
        }
      },
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 600000 // 10 minutos
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('✅ RESULTADO:');
    console.log(`  Status: ${response.status}`);
    console.log(`  Tiempo de generación: ${duration} segundos`);
    console.log('');
    console.log('📦 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verificar URL del audio
    const audioUrl = response.data?.audio?.url;
    if (audioUrl) {
      console.log('');
      console.log('🎶 Audio URL generada:');
      console.log(`  ${audioUrl}`);
      console.log('');
      console.log('✅ TEST EXITOSO - MiniMax Music V2 funcionando correctamente!');
    } else {
      console.log('');
      console.log('⚠️ No se encontró URL de audio en la respuesta');
    }

  } catch (error: any) {
    console.error('❌ ERROR:');
    console.error(`  Status: ${error.response?.status || 'N/A'}`);
    console.error(`  Message: ${error.message}`);
    if (error.response?.data) {
      console.error('  Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Ejecutar test
testMiniMaxMusic();
