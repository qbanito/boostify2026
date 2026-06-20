// Script to update English posts with meaningful content using the admin SDK

import { db } from '../server/firebase';

// High-quality English content for posts about music
const englishMusicPosts = [
  "Just finished recording a new track! The mixing process took longer than expected, but the final result sounds incredible. Can't wait to share it with all of you next week.",
  
  "What studio monitors are you all using? I'm considering upgrading my current setup and would love some recommendations based on experience.",
  
  "Attended a workshop on music production techniques yesterday. Learning about parallel compression was a game-changer for my drum tracks. Anyone else use this technique?",
  
  "The transition from traditional music distribution to streaming has completely changed how we release music. As an independent artist, I find that releasing singles more frequently works better than albums.",
  
  "Been experimenting with unusual time signatures lately. 7/8 feels surprisingly natural once you get into it. What's your favorite non-4/4 song?",
  
  "Question for the songwriters here: do you start with lyrics, melody, or chord progression? I've always been a chord-first person, but trying to switch up my process.",
  
  "Just discovered this amazing VST plugin that simulates vintage analog synths perfectly. The sound is incredibly warm and authentic. I'll share the name if anyone's interested.",
  
  "Music collaboration has become so much easier with modern technology. Currently working on a track with a vocalist from Australia while I'm based in Canada. The internet is amazing!",
  
  "Thoughts on AI in music production? I've tried some AI mastering services and was surprised by the quality. I still prefer human mastering for important releases though.",
  
  "After years of producing electronic music, I've started to incorporate more live instruments into my tracks. The organic textures add so much depth and emotion."
];

async function updateEnglishPosts() {
  try {
    console.log("🔄 Starting update of English language posts using admin SDK...");
    
    // First get all users with English language
    const usersSnapshot = await db.collection('social_users').where('language', '==', 'en').get();
    
    if (usersSnapshot.empty) {
      console.log('No English users found');
      return;
    }
    
    console.log(`Found ${usersSnapshot.size} English-speaking users`);
    
    // For each English-speaking user, get their posts
    let updatedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      const postsSnapshot = await db.collection('social_posts').where('userId', '==', userId).get();
      console.log(`Found ${postsSnapshot.size} posts for user ${userId}`);
      
      // For each post, update with meaningful content
      for (const postDoc of postsSnapshot.docs) {
        const post = postDoc.data();
        
        // Update all posts from English users, regardless of current content
        {
          
          // Update with meaningful music-related content
          const musicContent = englishMusicPosts[updatedCount % englishMusicPosts.length];
          
          await db.collection('social_posts').doc(postDoc.id).update({
            content: musicContent,
            updatedAt: new Date()
          });
          
          console.log(`Updated post ${postDoc.id} with new music content`);
          updatedCount++;
        }
      }
    }
    
    console.log(`✅ Successfully updated ${updatedCount} English posts with music-related content!`);
    
  } catch (error) {
    console.error("❌ Error updating English posts:", error);
  }
}

// Run the script
updateEnglishPosts()
  .then(() => {
    console.log("Script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });