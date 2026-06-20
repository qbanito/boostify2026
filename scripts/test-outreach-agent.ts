/**
 * Test the real outreach agent
 */
import 'dotenv/config';
import { selectArtistsForOutreach, executeOutreachCampaign, sendTestEmail } from '../server/agents/outreach-agent';

async function testOutreach() {
  console.log('\n🧪 TESTING OUTREACH AGENT\n');
  
  // 1. Test artist selection
  console.log('1️⃣ Testing artist selection...');
  const artists = await selectArtistsForOutreach(3);
  console.log(`   Found ${artists.length} artists for outreach`);
  if (artists.length > 0) {
    console.log(`   Top artist: ${artists[0].artistName} (${artists[0].genre})`);
  }
  
  // 2. Test campaign in DRY RUN mode (no real emails)
  console.log('\n2️⃣ Testing campaign (DRY RUN)...');
  const results = await executeOutreachCampaign([], 3, true); // dryRun = true
  console.log(`   Campaign results: ${results.length} contacts processed`);
  
  // 3. Send one real test email
  console.log('\n3️⃣ Sending real test email to convoycubano@gmail.com...');
  const testResult = await sendTestEmail('convoycubano@gmail.com', 'Industry Test');
  
  if (testResult.success) {
    console.log('   ✅ Test email sent!');
    console.log(`   📨 Message ID: ${testResult.messageId}`);
  } else {
    console.log(`   ❌ Error: ${testResult.error}`);
  }
  
  console.log('\n✅ Outreach agent test complete!\n');
  process.exit(0);
}

testOutreach().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
