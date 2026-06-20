/**
 * 🎵 APIFY ARTIST LEAD EXTRACTOR - TEST
 * Actor: code_crafter/leads-finder
 */

const { ApifyClient } = require('apify-client');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env // overrides .env // overrides .env // overrides .env

const APIFY_API_KEY = process.env.APIFY_API_INDUSTRY;
const ACTOR_ID = 'code_crafter/leads-finder';

const apifyClient = new ApifyClient({ token: APIFY_API_KEY });

// Test search for music artists on Instagram
const testSearchParams = {
  // Common parameters for leads-finder actors
  query: 'reggaeton artist',
  platform: 'instagram',
  limit: 5,
  // Alternative parameters the actor might expect
  searchTerms: ['reggaeton artist', 'latin music producer', 'urban artist'],
  maxResults: 5
};

async function testExtraction() {
  console.log('\n' + '='.repeat(60));
  console.log('🎵 APIFY ARTIST LEAD EXTRACTION TEST');
  console.log('='.repeat(60));
  console.log(`\nActor: ${ACTOR_ID}`);
  console.log(`API Key: ${APIFY_API_KEY.substring(0, 20)}...`);
  console.log('─'.repeat(60));

  try {
    // First, let's check the actor info to understand its input schema
    console.log('\n📋 Fetching actor info...');
    const actor = apifyClient.actor(ACTOR_ID);
    const actorInfo = await actor.get();
    
    if (actorInfo) {
      console.log(`\n✅ Actor found: ${actorInfo.name}`);
      console.log(`   Title: ${actorInfo.title || 'N/A'}`);
      console.log(`   Description: ${(actorInfo.description || 'N/A').substring(0, 100)}...`);
    }

    // Try to get the actor's input schema
    console.log('\n📝 Checking available runs/datasets...');
    const runs = await actor.runs().list({ limit: 5 });
    
    if (runs.items && runs.items.length > 0) {
      console.log(`\n📊 Found ${runs.items.length} previous runs:`);
      
      for (const run of runs.items.slice(0, 3)) {
        console.log(`\n   Run ID: ${run.id}`);
        console.log(`   Status: ${run.status}`);
        console.log(`   Started: ${run.startedAt}`);
        
        // Try to get results from this run
        if (run.status === 'SUCCEEDED' && run.defaultDatasetId) {
          console.log(`\n   📥 Fetching results from dataset: ${run.defaultDatasetId}`);
          const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems({ limit: 3 });
          
          if (dataset.items && dataset.items.length > 0) {
            console.log(`\n   ✅ Sample leads found (${dataset.items.length} shown):`);
            
            dataset.items.forEach((item, index) => {
              console.log(`\n   ─── Lead ${index + 1} ───`);
              // Print all available fields
              Object.keys(item).forEach(key => {
                const value = item[key];
                if (value && typeof value !== 'object') {
                  console.log(`   ${key}: ${String(value).substring(0, 80)}`);
                }
              });
            });
          }
        }
      }
    } else {
      console.log('\n⚠️ No previous runs found. Starting a new run...');
      
      // Start a new run with test parameters
      console.log('\n🚀 Starting actor with test parameters...');
      console.log('   Parameters:', JSON.stringify(testSearchParams, null, 2));
      
      const run = await actor.call(testSearchParams, {
        waitSecs: 60, // Wait up to 60 seconds for results
        memory: 256
      });
      
      console.log(`\n   Run status: ${run.status}`);
      
      if (run.defaultDatasetId) {
        const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems({ limit: 5 });
        console.log(`\n   Results: ${dataset.items.length} leads found`);
        
        if (dataset.items.length > 0) {
          console.log('\n   Sample lead:');
          console.log(JSON.stringify(dataset.items[0], null, 2));
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('404')) {
      console.log('\n💡 Actor not found. Let\'s list available actors in your account...');
      
      try {
        const actors = await apifyClient.actors().list();
        console.log(`\nAvailable actors (${actors.items.length}):`);
        actors.items.forEach(a => {
          console.log(`   - ${a.username}/${a.name}: ${a.title || 'No title'}`);
        });
      } catch (e) {
        console.log('Could not list actors:', e.message);
      }
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

// Also try to list datasets directly
async function listDatasets() {
  console.log('\n📂 Listing all datasets in account...');
  
  try {
    const datasets = await apifyClient.datasets().list({ limit: 10 });
    
    if (datasets.items && datasets.items.length > 0) {
      console.log(`\nFound ${datasets.items.length} datasets:\n`);
      
      for (const ds of datasets.items.slice(0, 5)) {
        console.log(`Dataset: ${ds.name || ds.id}`);
        console.log(`   ID: ${ds.id}`);
        console.log(`   Items: ${ds.itemCount || 'unknown'}`);
        console.log(`   Created: ${ds.createdAt}`);
        
        // Get sample items
        if (ds.itemCount > 0) {
          const items = await apifyClient.dataset(ds.id).listItems({ limit: 2 });
          if (items.items.length > 0) {
            console.log(`   Sample fields: ${Object.keys(items.items[0]).join(', ')}`);
          }
        }
        console.log('');
      }
    } else {
      console.log('No datasets found in account.');
    }
  } catch (error) {
    console.error('Error listing datasets:', error.message);
  }
}

// Run tests
(async () => {
  await testExtraction();
  await listDatasets();
})();
