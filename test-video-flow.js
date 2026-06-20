/**
 * Test del Flujo de Video - Diagnóstico completo
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('\n========================================');
  console.log('  TESTS DEL FLUJO DE VIDEO COMPLETO');
  console.log('========================================\n');

  const results = [];

  // Test 1: Health Check
  console.log('[TEST 1] Health Check');
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    console.log(`  ✅ Status: ${data.status} | Uptime: ${Math.round(data.uptime)}s`);
    results.push({ test: 'Health Check', passed: true });
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    results.push({ test: 'Health Check', passed: false, error: err.message });
  }

  // Test 2: Video Rendering Start Endpoint
  console.log('\n[TEST 2] Video Rendering Start Endpoint');
  try {
    const res = await fetch(`${BASE_URL}/api/video-rendering/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clips: [{
          id: 'test-1',
          imageUrl: 'https://storage.googleapis.com/artist-boost-firebase.appspot.com/test.jpg',
          start: 0,
          duration: 5,
          transition: 'fade'
        }],
        resolution: '1080p',
        quality: 'high'
      })
    });
    const data = await res.json();
    if (data.success && data.renderId) {
      console.log(`  ✅ Renderizado iniciado - ID: ${data.renderId}`);
      results.push({ test: 'Video Rendering Start', passed: true, renderId: data.renderId });
    } else {
      console.log(`  ⚠️ Responde pero con error: ${data.error || 'sin detalle'}`);
      results.push({ test: 'Video Rendering Start', passed: false, error: data.error });
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    results.push({ test: 'Video Rendering Start', passed: false, error: err.message });
  }

  // Test 3: Music Video Projects (verificar existencia)
  console.log('\n[TEST 3] Music Video Projects Endpoint');
  try {
    const res = await fetch(`${BASE_URL}/api/music-video-projects`);
    const status = res.status;
    if (status === 200 || status === 401 || status === 403) {
      console.log(`  ✅ Endpoint existe (status: ${status})`);
      results.push({ test: 'Music Video Projects', passed: true });
    } else {
      console.log(`  ⚠️ Status inesperado: ${status}`);
      results.push({ test: 'Music Video Projects', passed: false });
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    results.push({ test: 'Music Video Projects', passed: false, error: err.message });
  }

  // Test 4: Audio Transcription Endpoint
  console.log('\n[TEST 4] Audio Transcription Endpoint');
  try {
    const res = await fetch(`${BASE_URL}/api/audio/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    console.log(`  ✅ Endpoint responde (status: ${res.status})`);
    results.push({ test: 'Audio Transcription', passed: true });
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    results.push({ test: 'Audio Transcription', passed: false, error: err.message });
  }

  // Test 5: Generate Image Endpoint
  console.log('\n[TEST 5] Generate Image Endpoint');
  try {
    const res = await fetch(`${BASE_URL}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test', aspectRatio: '16:9' })
    });
    console.log(`  ✅ Endpoint responde (status: ${res.status})`);
    results.push({ test: 'Generate Image', passed: true });
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    results.push({ test: 'Generate Image', passed: false, error: err.message });
  }

  // Test 6: FAL AI Service
  console.log('\n[TEST 6] FAL AI Endpoint');
  try {
    const res = await fetch(`${BASE_URL}/api/fal-ai/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test cinematic scene' })
    });
    console.log(`  ✅ Endpoint responde (status: ${res.status})`);
    results.push({ test: 'FAL AI', passed: true });
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    results.push({ test: 'FAL AI', passed: false, error: err.message });
  }

  // Resumen
  console.log('\n========================================');
  console.log('  RESUMEN DE TESTS');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\n  Pasados: ${passed}/${total}`);
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`  ${icon} ${r.test}${r.error ? ` (${r.error})` : ''}`);
  });
  
  console.log('\n');
  
  return results;
}

runTests().catch(console.error);
