import { firestoreSocialNetworkService, Post } from '../server/services/firestore-social-network.ts';
import { db } from '../server/firebase.ts';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, updateDoc, doc, Timestamp } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase with config from environment
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

console.log("Firebase initialized with config:", {
  projectId: firebaseConfig.projectId,
  apiKey: firebaseConfig.apiKey ? "[FOUND]" : "[MISSING]",
  authDomain: firebaseConfig.authDomain ? "[FOUND]" : "[MISSING]",
});

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
  
  "After years of producing electronic music, I've started to incorporate more live instruments into my tracks. The organic textures add so much depth and emotion.",
  
  "Social media marketing is both the best and worst part of being an independent musician today. Anyone found a good balance between promotion and actually making music?",
  
  "Just experienced a very productive creative block. Sometimes stepping away from music for a few days gives you a completely new perspective. Came back with fresh ears and finally finished that track.",
  
  "Vinyl is making such a huge comeback! Just got my latest EP pressed on beautiful blue vinyl and the demand has been amazing. Anyone else investing in physical releases?",
  
  "Does anyone else struggle with naming their tracks? I have five finished instrumentals sitting on my hard drive because I can't come up with proper titles!",
  
  "Music licensing has been a great additional revenue stream for me this year. Getting my tracks in commercials and YouTube videos has really helped support my creative work.",
  
  "The line between genres keeps getting blurrier and I love it. My latest project incorporates elements of jazz, electronic, and hip-hop. Genre fusion is the future!",
  
  "What's your approach to writer's block? I find that setting strict limitations (like using only 3 chords or writing in an unusual scale) helps me break through creative barriers.",
  
  "Studio upgrade day! Finally invested in proper acoustic treatment and the difference in my mixes is night and day. Don't underestimate room acoustics, folks.",
  
  "Anyone here use Ableton's session view for live performances? Looking for tips on creating a dynamic live electronic set that isn't just pressing play.",
  
  "The connection between visual art and music is fascinating. I've started collaborating with a visual artist for my live shows and it's elevated the whole experience tremendously."
];

// Function to update English posts with better content
async function updateEnglishPosts() {
  try {
    console.log("🔄 Starting update of English language posts...");
    
    const firestore = getFirestore();
    
    // Step 1: Get all users with English language
    const usersRef = collection(firestore, 'social_users');
    const enUsersQuery = query(usersRef, where('language', '==', 'en'));
    const enUsersSnapshot = await getDocs(enUsersQuery);
    
    const englishUserIds: string[] = [];
    enUsersSnapshot.forEach(userDoc => {
      englishUserIds.push(userDoc.id);
    });
    
    console.log(`Found ${englishUserIds.length} English-speaking users`);
    
    // Step 2: Find all posts by these English users
    const postsRef = collection(firestore, 'social_posts');
    let updatedCount = 0;
    
    // For each English user, get and update their posts
    for (const userId of englishUserIds) {
      const userPostsQuery = query(postsRef, where('userId', '==', userId));
      const userPostsSnapshot = await getDocs(userPostsQuery);
      
      console.log(`Found ${userPostsSnapshot.size} posts for user ${userId}`);
      
      // Update each post with a meaningful music content
      let i = 0;
      for (const postDoc of userPostsSnapshot.docs) {
        const musicContent = englishMusicPosts[updatedCount % englishMusicPosts.length];
        
        // Finding Latin placeholder text
        const currentContent = postDoc.data().content || '';
        if (currentContent.includes('Est ') || 
            currentContent.includes('Lorem ') || 
            currentContent.includes('apostolus') ||
            currentContent.includes('ratione') ||
            currentContent.includes('paulatim')) {
          
          // Update the post with meaningful content
          const postRef = doc(firestore, 'social_posts', postDoc.id);
          await updateDoc(postRef, {
            content: musicContent,
            updatedAt: Timestamp.now()
          });
          
          console.log(`Updated post ${postDoc.id} with new music content`);
          updatedCount++;
        }
        i++;
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