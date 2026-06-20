/**
 * Test Script: FAL AI Integration Test
 * Verifica que los endpoints de FAL funcionan correctamente:
 * 1. nano-banana para imágenes
 * 2. kling-video para videos
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:5000';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: any;
  duration?: number;
}

const results: TestResult[] = [];

async function testNanoBananaGenerate(): Promise<TestResult> {
  console.log('\n🍌 TEST 1: Nano-Banana Image Generation');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/fal/nano-banana/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Professional music video scene, cinematic lighting, artist performing on stage, high quality, 4k',
        aspectRatio: '16:9'
      })
    });

    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    
    if (data.imageUrl) {
      console.log(`🖼️ Image URL: ${data.imageUrl.substring(0, 80)}...`);
      console.log(`⏳ Processing Time: ${data.processingTime}s`);
      
      return {
        test: 'Nano-Banana Generate',
        success: true,
        message: 'Image generated successfully',
        data: { imageUrl: data.imageUrl, processingTime: data.processingTime },
        duration
      };
    } else {
      console.log(`❌ Error: ${data.error}`);
      return {
        test: 'Nano-Banana Generate',
        success: false,
        message: data.error || 'No image URL returned',
        duration
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Error: ${error}`);
    return {
      test: 'Nano-Banana Generate',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

async function testNanoBananaWithFace(): Promise<TestResult> {
  console.log('\n🎭 TEST 2: Nano-Banana with Face Reference');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Usar una imagen de prueba pública
    const testImageUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400';
    
    const response = await fetch(`${BASE_URL}/api/fal/nano-banana/generate-with-face`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Professional musician performing on stage, dramatic lighting, concert atmosphere, same person as reference',
        referenceImages: [testImageUrl],
        aspectRatio: '16:9',
        sceneId: 1
      })
    });

    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`🎭 Used Face Reference: ${data.usedFaceReference}`);
    
    if (data.imageUrl) {
      console.log(`🖼️ Image URL: ${data.imageUrl.substring(0, 80)}...`);
      
      return {
        test: 'Nano-Banana with Face',
        success: true,
        message: 'Image with face reference generated successfully',
        data: { imageUrl: data.imageUrl, usedFaceReference: data.usedFaceReference },
        duration
      };
    } else {
      console.log(`❌ Error: ${data.error}`);
      return {
        test: 'Nano-Banana with Face',
        success: false,
        message: data.error || 'No image URL returned',
        duration
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Error: ${error}`);
    return {
      test: 'Nano-Banana with Face',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

async function testKlingVideoGenerate(): Promise<TestResult> {
  console.log('\n🎬 TEST 3: Kling Video Generation (Image-to-Video)');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    // Usar una imagen de prueba pública
    const testImageUrl = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800';
    
    const response = await fetch(`${BASE_URL}/api/fal/kling-video/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Smooth cinematic motion, camera slowly panning, professional music video, dramatic lighting',
        imageUrl: testImageUrl,
        model: 'o1-standard-i2v',
        duration: '5',
        aspectRatio: '16:9'
      })
    });

    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    
    if (data.requestId) {
      console.log(`🎫 Request ID: ${data.requestId}`);
      console.log(`📹 Model: ${data.model}`);
      console.log(`⏳ Estimated Time: ${data.estimatedTime}`);
      console.log(`\n💡 Video generation is async. Use GET /api/fal/kling-video/${data.requestId} to check status.`);
      
      return {
        test: 'Kling Video Generate',
        success: true,
        message: 'Video generation job submitted successfully',
        data: { requestId: data.requestId, model: data.model, estimatedTime: data.estimatedTime },
        duration
      };
    } else if (data.videoUrl) {
      console.log(`🎥 Video URL: ${data.videoUrl.substring(0, 80)}...`);
      
      return {
        test: 'Kling Video Generate',
        success: true,
        message: 'Video generated synchronously',
        data: { videoUrl: data.videoUrl },
        duration
      };
    } else {
      console.log(`❌ Error: ${data.error}`);
      return {
        test: 'Kling Video Generate',
        success: false,
        message: data.error || 'No request ID or video URL returned',
        duration
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Error: ${error}`);
    return {
      test: 'Kling Video Generate',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

async function testBatchGeneration(): Promise<TestResult> {
  console.log('\n📦 TEST 4: Batch Image Generation');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/fal/nano-banana/generate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: [
          'Artist singing on stage, spotlight, dramatic shadows',
          'Close-up of hands playing guitar, cinematic',
          'Wide shot of concert crowd, atmospheric lighting'
        ],
        aspectRatio: '16:9'
      })
    });

    const data = await response.json();
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`✅ Success: ${data.success}`);
    console.log(`📈 Success Count: ${data.successCount}/${data.totalProcessed}`);
    console.log(`⏳ Total Processing Time: ${data.processingTime}s`);
    
    if (data.results) {
      data.results.forEach((result: any, index: number) => {
        if (result.success) {
          console.log(`  ✅ Image ${index + 1}: ${result.imageUrl?.substring(0, 50)}...`);
        } else {
          console.log(`  ❌ Image ${index + 1}: ${result.error}`);
        }
      });
      
      return {
        test: 'Batch Generation',
        success: data.successCount > 0,
        message: `${data.successCount}/${data.totalProcessed} images generated`,
        data: { successCount: data.successCount, totalProcessed: data.totalProcessed, results: data.results },
        duration
      };
    } else {
      return {
        test: 'Batch Generation',
        success: false,
        message: data.error || 'No results returned',
        duration
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Error: ${error}`);
    return {
      test: 'Batch Generation',
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration
    };
  }
}

async function checkFalApiStatus(): Promise<TestResult> {
  console.log('\n🔍 TEST 0: FAL API Configuration Check');
  console.log('=' .repeat(50));
  
  try {
    const response = await fetch(`${BASE_URL}/api/fal/debug-failover`);
    const data = await response.json();
    
    console.log(`📊 Has Primary Key: ${data.hasPrimaryKey}`);
    console.log(`📊 Has Backup Key: ${data.hasBackupKey}`);
    console.log(`📊 Failover Enabled: ${data.failoverEnabled}`);
    console.log(`💬 Message: ${data.message}`);
    
    return {
      test: 'FAL API Status',
      success: data.hasPrimaryKey,
      message: data.message,
      data
    };
  } catch (error) {
    console.log(`❌ Error: ${error}`);
    return {
      test: 'FAL API Status',
      success: false,
      message: error instanceof Error ? error.message : 'Cannot connect to server'
    };
  }
}

async function runAllTests() {
  console.log('🚀 BOOSTIFY - FAL AI Integration Test Suite');
  console.log('=' .repeat(60));
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🌐 Server: ${BASE_URL}`);
  
  // Test 0: Check API status
  results.push(await checkFalApiStatus());
  
  if (!results[0].success) {
    console.log('\n❌ FAL API not configured. Aborting tests.');
    printSummary();
    return;
  }
  
  // Test 1: Simple image generation
  results.push(await testNanoBananaGenerate());
  
  // Test 2: Image with face reference
  results.push(await testNanoBananaWithFace());
  
  // Test 3: Video generation
  results.push(await testKlingVideoGenerate());
  
  // Test 4: Batch generation
  results.push(await testBatchGeneration());
  
  printSummary();
}

function printSummary() {
  console.log('\n');
  console.log('=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const time = result.duration ? ` (${(result.duration / 1000).toFixed(2)}s)` : '';
    console.log(`${icon} ${result.test}: ${result.message}${time}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`📈 Results: ${passed} passed, ${failed} failed`);
  console.log('=' .repeat(60));
  
  if (passed === results.length) {
    console.log('\n🎉 All tests passed! FAL AI integration is working correctly.');
    console.log('\n📋 Next steps for Timeline integration:');
    console.log('   1. Generated images will be displayed in TimelineEditor clips');
    console.log('   2. Images are stored via imageUrl property in clip metadata');
    console.log('   3. Video generation creates async tasks with polling');
  } else {
    console.log('\n⚠️ Some tests failed. Check the errors above.');
  }
}

// Run tests
runAllTests().catch(console.error);
