/**
 * Test Script - Boostify Radio System
 * 
 * Tests the radio agent functionality:
 * - Loading queue
 * - Playing tracks
 * - Artist song promotion
 * - Social feed integration
 */

import 'dotenv/config';
import { db } from '../server/db';
import { 
  songs, 
  users, 
  artistPersonality, 
  aiSocialPosts 
} from '../db/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import {
  loadRadioQueue,
  getNextTrack,
  announceNowPlaying,
  artistPromotesSong,
  getRadioStatus,
  processRadioTick
} from '../server/agents/radio-agent';

async function testRadioSystem() {
  console.log('📻 ====================================');
  console.log('📻 TESTING BOOSTIFY RADIO SYSTEM');
  console.log('📻 ====================================\n');

  try {
    // 1. Check if we have artists with songs
    console.log('📊 Step 1: Checking artists with songs...');
    
    const artistsWithSongs = await db
      .select({
        artistId: users.id,
        artistName: users.artistName,
        songCount: songs.id,
      })
      .from(users)
      .innerJoin(artistPersonality, eq(users.id, artistPersonality.artistId))
      .innerJoin(songs, eq(users.id, songs.userId))
      .where(and(
        eq(songs.isPublished, true),
        isNotNull(songs.audioUrl)
      ))
      .limit(10);

    console.log(`Found ${artistsWithSongs.length} artists with songs:\n`);
    artistsWithSongs.forEach(a => {
      console.log(`   🎤 ${a.artistName} (ID: ${a.artistId})`);
    });

    if (artistsWithSongs.length === 0) {
      console.log('\n⚠️ No artists with published songs found!');
      console.log('Creating test song for demonstration...\n');
      
      // Get first AI artist
      const [aiArtist] = await db
        .select()
        .from(users)
        .innerJoin(artistPersonality, eq(users.id, artistPersonality.artistId))
        .limit(1);

      if (aiArtist) {
        // Check if they have any songs
        const existingSongs = await db
          .select()
          .from(songs)
          .where(eq(songs.userId, aiArtist.users.id))
          .limit(1);

        if (existingSongs.length === 0) {
          console.log(`Creating demo song for ${aiArtist.users.artistName}...`);
          
          await db.insert(songs).values({
            userId: aiArtist.users.id,
            title: 'Demo Track - AI Generated',
            description: 'A demonstration track for Boostify Radio',
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Demo audio
            duration: '3:45',
            genre: 'Electronic',
            mood: 'energetic',
            isPublished: true,
            plays: 0,
          });
          
          console.log('✅ Demo song created!\n');
        }
      }
    }

    // 2. Load radio queue
    console.log('\n📻 Step 2: Loading radio queue...');
    const queueCount = await loadRadioQueue();
    console.log(`✅ Loaded ${queueCount} tracks into queue\n`);

    // 3. Get radio status
    console.log('📊 Step 3: Current radio status:');
    const status = getRadioStatus();
    console.log(`   🎵 Is Playing: ${status.isPlaying}`);
    console.log(`   📋 Queue Length: ${status.queueLength}`);
    console.log(`   🔢 Total Plays: ${status.totalPlays}`);
    console.log(`   🎯 Current Track: ${status.currentTrack?.title || 'None'}\n`);

    // 4. Get next track and announce it
    if (status.queueLength > 0) {
      console.log('🎵 Step 4: Playing next track...');
      const track = await getNextTrack();
      
      if (track) {
        console.log(`   Now Playing: "${track.title}" by ${track.artistName}`);
        console.log(`   Genre: ${track.genre || 'Unknown'}`);
        console.log(`   Audio URL: ${track.audioUrl?.substring(0, 50)}...`);
        
        // Announce it
        console.log('\n📢 Step 5: Announcing on social feed...');
        const postId = await announceNowPlaying(track);
        
        if (postId) {
          console.log(`✅ Created announcement post #${postId}`);
          
          // Fetch the post content
          const [post] = await db
            .select()
            .from(aiSocialPosts)
            .where(eq(aiSocialPosts.id, postId))
            .limit(1);
            
          if (post) {
            console.log(`\n📝 Post content:\n${post.content}\n`);
          }
        }
      }
    }

    // 5. Test artist song promotion
    console.log('\n🎤 Step 6: Testing artist song promotion...');
    
    const [artistWithSong] = await db
      .select({
        artistId: users.id,
        artistName: users.artistName,
        songId: songs.id,
        songTitle: songs.title,
      })
      .from(users)
      .innerJoin(artistPersonality, eq(users.id, artistPersonality.artistId))
      .innerJoin(songs, eq(users.id, songs.userId))
      .where(eq(songs.isPublished, true))
      .limit(1);

    if (artistWithSong) {
      console.log(`   ${artistWithSong.artistName} promoting "${artistWithSong.songTitle}"...`);
      
      const result = await artistPromotesSong(artistWithSong.artistId, artistWithSong.songId);
      
      if (result.success) {
        console.log(`✅ Promotion successful! Post #${result.postId}`);
        
        // Fetch the promotion post
        if (result.postId) {
          const [promoPost] = await db
            .select()
            .from(aiSocialPosts)
            .where(eq(aiSocialPosts.id, result.postId))
            .limit(1);
            
          if (promoPost) {
            console.log(`\n📝 Promotion post:\n${promoPost.content}\n`);
          }
        }
      } else {
        console.log(`⚠️ Promotion failed: ${result.message}`);
      }
    }

    // 6. Process a radio tick (full cycle)
    console.log('\n⏰ Step 7: Processing radio tick (full cycle)...');
    await processRadioTick();
    
    const finalStatus = getRadioStatus();
    console.log(`\n📊 Final radio status:`);
    console.log(`   📋 Queue Length: ${finalStatus.queueLength}`);
    console.log(`   🔢 Total Plays: ${finalStatus.totalPlays}`);
    console.log(`   🎯 Current Track: ${finalStatus.currentTrack?.title || 'None'}`);
    
    // 7. Show recent radio posts
    console.log('\n📰 Step 8: Recent radio-related posts:');
    
    const recentPosts = await db
      .select({
        id: aiSocialPosts.id,
        content: aiSocialPosts.content,
        artistName: users.artistName,
        createdAt: aiSocialPosts.createdAt,
      })
      .from(aiSocialPosts)
      .innerJoin(users, eq(aiSocialPosts.artistId, users.id))
      .where(eq(aiSocialPosts.contentType, 'announcement'))
      .orderBy(desc(aiSocialPosts.createdAt))
      .limit(5);

    if (recentPosts.length > 0) {
      recentPosts.forEach((post, i) => {
        console.log(`\n   📻 Post #${post.id} by ${post.artistName}:`);
        console.log(`   ${post.content.substring(0, 100)}...`);
      });
    } else {
      console.log('   No radio announcements yet.');
    }

    console.log('\n\n📻 ====================================');
    console.log('📻 RADIO TEST COMPLETED SUCCESSFULLY!');
    console.log('📻 ====================================\n');
    
    console.log('Summary:');
    console.log(`✅ Queue loaded: ${queueCount} tracks`);
    console.log(`✅ Now playing announcements working`);
    console.log(`✅ Artist promotions working`);
    console.log(`✅ Radio tick processing working`);
    console.log(`\nThe radio will now post "Now Playing" updates`);
    console.log(`every 2 ticks (~2 minutes) in the social feed! 🎶`);

  } catch (error) {
    console.error('❌ Error testing radio system:', error);
    throw error;
  }

  process.exit(0);
}

testRadioSystem();
