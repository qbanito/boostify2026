// Script to fix all Latin content in the social network
// This script finds any content containing Latin placeholder text and replaces it with meaningful English content

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

// High-quality English content for comments about music
const englishMusicComments = [
  "I completely agree! Your insights on music production are spot on.",
  
  "This is such a great point. I've been thinking about this a lot lately with my own music.",
  
  "Have you tried experimenting with different DAWs? I switched to Ableton last year and it changed my workflow completely.",
  
  "The melody in your latest track is absolutely incredible. Mind sharing some of your composition process?",
  
  "I've been struggling with this exact issue! Thanks for sharing your experience.",
  
  "This reminds me of a technique I learned at a production workshop last month. Total game-changer.",
  
  "What VST plugins are you using these days? Always looking for recommendations!",
  
  "Your approach to music marketing is so refreshing compared to what I usually see.",
  
  "I'd love to collaborate on something. Your style would complement my production perfectly.",
  
  "Do you have any tips for someone just starting out with music production? Your work is inspiring."
];

// Function to check if text is likely Latin placeholder
function isLatinPlaceholder(text: string): boolean {
  const latinWords = [
    'est', 'lorem', 'ipsum', 'apostolus', 'ratione', 'paulatim', 
    'venustas', 'suggero', 'condico', 'tenax', 'cogito', 'ergo', 
    'spero', 'taceo', 'desino', 'vulgus', 'abundans', 'aspernatur', 
    'textus', 'substantia', 'demonstro', 'aliquam', 'desolo', 
    'recusandae', 'tempus', 'voco', 'civis'
  ];
  
  // Convert text to lowercase for case-insensitive comparison
  const lowerText = text.toLowerCase();
  
  // Check if any Latin words appear in the text
  return latinWords.some(word => lowerText.includes(word));
}

async function fixAllContent() {
  try {
    console.log("🔄 Starting comprehensive update of all Latin content...");
    
    // Fix posts
    const postsSnapshot = await db.collection('social_posts').get();
    console.log(`Found ${postsSnapshot.size} total posts to check`);
    
    let updatedPostsCount = 0;
    
    for (const postDoc of postsSnapshot.docs) {
      const post = postDoc.data();
      const content = post.content || '';
      
      if (isLatinPlaceholder(content)) {
        const newContent = englishMusicPosts[updatedPostsCount % englishMusicPosts.length];
        
        await db.collection('social_posts').doc(postDoc.id).update({
          content: newContent,
          updatedAt: new Date()
        });
        
        updatedPostsCount++;
        console.log(`Updated post ${postDoc.id} with new English content (${updatedPostsCount} posts updated)`);
      }
    }
    
    // Fix comments
    const commentsSnapshot = await db.collection('social_comments').get();
    console.log(`Found ${commentsSnapshot.size} total comments to check`);
    
    let updatedCommentsCount = 0;
    
    for (const commentDoc of commentsSnapshot.docs) {
      const comment = commentDoc.data();
      const content = comment.content || '';
      
      if (isLatinPlaceholder(content)) {
        const newContent = englishMusicComments[updatedCommentsCount % englishMusicComments.length];
        
        await db.collection('social_comments').doc(commentDoc.id).update({
          content: newContent,
          updatedAt: new Date()
        });
        
        updatedCommentsCount++;
        console.log(`Updated comment ${commentDoc.id} with new English content (${updatedCommentsCount} comments updated)`);
      }
    }
    
    console.log(`✅ Successfully updated ${updatedPostsCount} posts and ${updatedCommentsCount} comments with English content!`);
    
  } catch (error) {
    console.error("❌ Error updating content:", error);
  }
}

// Run the script
fixAllContent()
  .then(() => {
    console.log("Script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });