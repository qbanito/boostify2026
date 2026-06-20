/**
 * Test WAN Video API
 */

import 'dotenv/config';

const WAN_API_KEY = process.env.WAN_API_KEY;

async function testWanApi() {
  console.log('🎬 Testing WAN Video API...\n');
  
  if (!WAN_API_KEY) {
    console.error('❌ WAN_API_KEY not found in .env');
    return;
  }
  
  console.log('✅ API Key found:', WAN_API_KEY.slice(0, 10) + '...');
  
  // Test API endpoint - check account/balance
  try {
    const response = await fetch('https://api.wan.video/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${WAN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n📡 API Response Status:', response.status);
    
    const data = await response.json();
    console.log('📦 Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ WAN API is working!');
    } else {
      console.log('\n⚠️ API returned an error');
    }
  } catch (error) {
    console.error('❌ Error connecting to WAN API:', (error as Error).message);
    
    // Try alternative endpoint
    console.log('\n🔄 Trying alternative endpoints...');
    
    const endpoints = [
      'https://api.wan.video/v1/videos',
      'https://api.piapi.ai/api/wan/v1/video',
      'https://api.piapi.ai/api/v1/task'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WAN_API_KEY}`,
            'X-API-Key': WAN_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        console.log(`  ${endpoint}: ${res.status}`);
        if (res.status !== 404) {
          const text = await res.text();
          console.log(`    Response: ${text.slice(0, 200)}`);
        }
      } catch (e) {
        console.log(`  ${endpoint}: Connection failed`);
      }
    }
  }
}

testWanApi();
