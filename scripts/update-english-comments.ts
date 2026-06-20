// Script to update all social network comments with English messages

import { db } from '../server/firebase';

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
  
  "Do you have any tips for someone just starting out with music production? Your work is inspiring.",
  
  "Have you considered trying analog gear? It added so much warmth to my recent recordings.",
  
  "This is exactly what the industry needs right now. Thank you for being a voice of reason.",
  
  "Your music has been a huge inspiration for my recent projects. Keep creating amazing things!",
  
  "The drum programming in your tracks is insanely good. Any tutorials you'd recommend?",
  
  "I'm fascinated by your approach to melody. It's so distinctly your own sound.",
  
  "Mixing has been my biggest challenge lately. Any tips for getting that professional sound?",
  
  "Your insights on music theory have completely changed how I compose. Thank you!",
  
  "I just downloaded that plugin you mentioned and it's already improving my workflow. Great recommendation!",
  
  "Would love to hear more about your studio setup sometime. Your recordings sound incredible.",
  
  "This is exactly the motivation I needed today. Sometimes the creative journey can be tough."
];

async function updateAllComments() {
  try {
    console.log("🔄 Starting update of all social network comments...");
    
    // Get all comments
    const commentsSnapshot = await db.collection('social_comments').get();
    
    if (commentsSnapshot.empty) {
      console.log('No comments found');
      return;
    }
    
    console.log(`Found ${commentsSnapshot.size} comments to update`);
    
    // Update each comment with new English content
    let updatedCount = 0;
    
    for (const commentDoc of commentsSnapshot.docs) {
      const commentIndex = updatedCount % englishMusicComments.length;
      const newContent = englishMusicComments[commentIndex];
      
      await db.collection('social_comments').doc(commentDoc.id).update({
        content: newContent,
        updatedAt: new Date()
      });
      
      updatedCount++;
      console.log(`Updated comment ${commentDoc.id} (${updatedCount}/${commentsSnapshot.size})`);
    }
    
    console.log(`✅ Successfully updated ${updatedCount} comments with English music-related content!`);
    
  } catch (error) {
    console.error("❌ Error updating comments:", error);
  }
}

// Run the script
updateAllComments()
  .then(() => {
    console.log("Script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script error:", error);
    process.exit(1);
  });