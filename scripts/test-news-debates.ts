/**
 * Test script for news debates system
 * Ejecutar: npx tsx scripts/test-news-debates.ts
 */

import 'dotenv/config';
import { 
  processNewsTick, 
  generateNewsDebates,
  generateDebateFollowups 
} from '../server/agents/news-agent';
import { db } from '../server/db';
import { aiSocialPosts, aiPostComments, users } from '../db/schema';
import { desc, eq, gte, sql, and, like } from 'drizzle-orm';

async function testNewsDebates() {
  console.log('\n🧪 TESTING NEWS DEBATES SYSTEM\n');
  console.log('='.repeat(60));
  
  // 1. Check existing news posts
  console.log('\n1️⃣ Checking existing news posts...');
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const existingNewsPosts = await db
    .select({
      id: aiSocialPosts.id,
      artistId: aiSocialPosts.artistId,
      content: aiSocialPosts.content,
      aiComments: aiSocialPosts.aiComments,
      createdAt: aiSocialPosts.createdAt
    })
    .from(aiSocialPosts)
    .where(like(aiSocialPosts.content, '%📰%'))
    .orderBy(desc(aiSocialPosts.createdAt))
    .limit(5);
  
  console.log(`   Found ${existingNewsPosts.length} news posts`);
  
  for (const post of existingNewsPosts) {
    const [artist] = await db
      .select({ artistName: users.artistName })
      .from(users)
      .where(eq(users.id, post.artistId))
      .limit(1);
    
    console.log(`   - Post #${post.id} by ${artist?.artistName || 'Unknown'}: ${post.aiComments} AI comments`);
    console.log(`     "${post.content.substring(0, 60)}..."`);
  }
  
  // 2. Generate a news tick (creates new posts)
  console.log('\n2️⃣ Running news tick to generate reactions...');
  
  try {
    await processNewsTick();
    console.log('   ✅ News tick completed');
  } catch (error) {
    console.log('   ⚠️ News tick had issues (may need APIFY_API_KEY):', (error as Error).message);
  }
  
  // 3. Generate debates on existing posts
  console.log('\n3️⃣ Generating debates on news posts...');
  
  const debatesGenerated = await generateNewsDebates();
  console.log(`   ✅ Generated ${debatesGenerated} debate replies`);
  
  // 4. Generate follow-up replies
  console.log('\n4️⃣ Generating follow-up replies (threaded discussions)...');
  
  const followups = await generateDebateFollowups();
  console.log(`   ✅ Generated ${followups} follow-up replies`);
  
  // 5. Show final state
  console.log('\n5️⃣ Showing debate threads...');
  
  const recentComments = await db
    .select({
      id: aiPostComments.id,
      postId: aiPostComments.postId,
      authorId: aiPostComments.authorId,
      content: aiPostComments.content,
      sentiment: aiPostComments.sentiment,
      parentCommentId: aiPostComments.parentCommentId
    })
    .from(aiPostComments)
    .where(eq(aiPostComments.isAiGenerated, true))
    .orderBy(desc(aiPostComments.createdAt))
    .limit(10);
  
  console.log(`\n   Recent debate comments (${recentComments.length}):`);
  
  for (const comment of recentComments) {
    const [author] = await db
      .select({ artistName: users.artistName })
      .from(users)
      .where(eq(users.id, comment.authorId))
      .limit(1);
    
    const indent = comment.parentCommentId ? '     ↳ ' : '   - ';
    const parentNote = comment.parentCommentId ? ' (reply)' : '';
    console.log(`${indent}${author?.artistName || 'Unknown'}${parentNote}: "${comment.content.substring(0, 50)}..."`);
    console.log(`     [Sentiment: ${comment.sentiment}]`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ News debates test complete!\n');
  
  process.exit(0);
}

testNewsDebates().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
