import { db } from '../db';
import { socialUsers, posts, comments } from '../db/social-network-schema';
import { and, eq, desc, asc } from "drizzle-orm";
import { faker } from '@faker-js/faker/locale/es';
import { faker as fakerEN_US } from '@faker-js/faker/locale/en_US';

const TOTAL_USERS = 20;
const TOTAL_POSTS = 40;
const TOTAL_COMMENTS = 80;
const BOT_USERS_RATIO = 0.5;  // 50% of users are bots

const personalities = [
  "Friendly and supportive music enthusiast who always provides positive feedback",
  "Industry veteran who shares insights about professional music production",
  "Tech-savvy producer who frequently talks about new music production tools",
  "Young artist trying to network and collaborate with other musicians",
  "Music marketing specialist who offers promotional advice to artists",
  "Indie label representative looking for new talent",
  "Music journalist who analyzes latest industry trends",
  "Music teacher who offers educational tips and resources",
  "Enthusiastic fan who gets excited about new musical projects",
  "Critical listener who provides constructive feedback on compositions"
];

const interests = [
  ["music production", "sound design", "mixing", "mastering"],
  ["songwriting", "vocals", "live performance", "stage presence"],
  ["music marketing", "artist promotion", "social media strategy"],
  ["music theory", "composition", "arrangement", "orchestration"],
  ["music licensing", "sync opportunities", "royalties", "publishing"],
  ["music technology", "DAWs", "plugins", "virtual instruments"],
  ["music business", "contracts", "management", "distribution"],
  ["collaboration", "networking", "remote recording", "session work"],
  ["music education", "teaching", "mentoring", "workshops"],
  ["indie music", "underground scenes", "independent labels"]
];

const avatars = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music1",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music2",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music3",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music4",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music5",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music6",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music7",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music8",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music9",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music10",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music11",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music12",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music13",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music14",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music15",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music16",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music17",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music18",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music19",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=music20"
];

/**
 * Generate a response using OpenRouter API
 */
async function generateOpenRouterResponse(prompt: string): Promise<string> {
  // For seeding purposes, always use fallback responses
  // This ensures our database is populated even if API keys have issues
  console.log("Using fallback response for seeding");
  return getFallbackResponse(prompt);
}

/**
 * Fallback response in case the API fails
 */
function getFallbackResponse(prompt: string): string {
  // Detect language from the prompt (simple check if it contains Spanish prompts)
  const isSpanish = prompt.includes('Eres un usuario') || 
                   prompt.includes('Responde al siguiente') || 
                   prompt.includes('personalidad');

  const englishResponses = [
    "That's a really interesting perspective! I've been thinking about this topic a lot lately.",
    "I'm not sure I agree with that. In my experience, there are other factors to consider.",
    "Thanks for sharing this! I've learned something new today.",
    "This reminds me of a similar project I worked on recently. The results were surprising!",
    "I'd like to add that collaboration is key in these situations. What do others think?",
    "Have you considered approaching this from a different angle? Sometimes that helps.",
    "I totally agree with your point about music production techniques!",
    "Great insight! The music industry is constantly evolving and adapting.",
    "That's a creative approach to solving this common challenge in music production.",
    "I'm curious to hear more about your experiences with this."
  ];
  
  const spanishResponses = [
    "¡Es una perspectiva muy interesante! He estado pensando mucho en este tema últimamente.",
    "No estoy seguro de estar de acuerdo. En mi experiencia, hay otros factores a considerar.",
    "¡Gracias por compartir esto! He aprendido algo nuevo hoy.",
    "Esto me recuerda a un proyecto similar en el que trabajé recientemente. ¡Los resultados fueron sorprendentes!",
    "Me gustaría añadir que la colaboración es clave en estas situaciones. ¿Qué piensan los demás?",
    "¿Has considerado abordar esto desde un ángulo diferente? A veces eso ayuda.",
    "¡Estoy totalmente de acuerdo con tu punto sobre las técnicas de producción musical!",
    "¡Gran perspectiva! La industria musical está en constante evolución y adaptación.",
    "Ese es un enfoque creativo para resolver este desafío común en la producción musical.",
    "Tengo curiosidad por saber más sobre tus experiencias con esto."
  ];
  
  const responses = isSpanish ? spanishResponses : englishResponses;
  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * First clear any existing tables
 */
async function clearExistingData() {
  try {
    await db.delete(comments);
    await db.delete(posts);
    await db.delete(socialUsers);
    console.log("Cleared existing social network data");
  } catch (error) {
    console.error("Error clearing existing data:", error);
  }
}

/**
 * Main function to seed the social network database
 */
async function seedSocialNetwork() {
  console.log("🌱 Starting social network seeding process...");
  
  try {
    // Clear existing data first
    await clearExistingData();
    
    console.log(`Creating ${TOTAL_USERS} users...`);
    
    // Create users
    const userIds = [];
    
    for (let i = 0; i < TOTAL_USERS; i++) {
      const isSpanish = Math.random() > 0.5;
      const isBot = Math.random() < BOT_USERS_RATIO;
      
      const fullName = isSpanish 
        ? faker.person.fullName() 
        : fakerEN_US.person.fullName();
      
      const user = {
        displayName: fullName,
        avatar: avatars[i % avatars.length],
        bio: isSpanish 
          ? faker.person.bio() 
          : fakerEN_US.person.bio(),
        interests: interests[Math.floor(Math.random() * interests.length)],
        language: isSpanish ? 'es' : 'en',
        isBot: isBot,
        personality: isBot ? personalities[Math.floor(Math.random() * personalities.length)] : null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Use type assertion to handle the typing issue with drizzle-orm
      const result = await db.insert(socialUsers).values(user as any).returning();
      // Type-safe way to handle the ID from the returned result
      if (result[0] && result[0].id !== undefined) {
        userIds.push(result[0].id);
      }
      
      console.log(`Created user: ${user.displayName} (${user.language}, Bot: ${user.isBot})`);
    }
    
    console.log(`Creating ${TOTAL_POSTS} posts...`);
    
    // Create posts
    const postIds = [];
    
    for (let i = 0; i < TOTAL_POSTS; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const user = await db.select().from(socialUsers).where(eq(socialUsers.id, userId)).limit(1);
      const isSpanish = user[0].language === 'es';
      
      const content = isSpanish
        ? faker.lorem.paragraph({ min: 1, max: 3 })
        : fakerEN_US.lorem.paragraph({ min: 1, max: 3 });
      
      const postData = {
        userId: userId,
        content: content,
        likes: Math.floor(Math.random() * 50),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.insert(posts).values(postData as any).returning();
      // Type-safe way to handle the ID from the returned result
      if (result[0] && result[0].id !== undefined) {
        postIds.push(result[0].id);
      }
    }
    
    console.log(`Creating ${TOTAL_COMMENTS} comments...`);
    
    // Create comments
    for (let i = 0; i < TOTAL_COMMENTS; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const postId = postIds[Math.floor(Math.random() * postIds.length)];
      
      const user = await db.select().from(socialUsers).where(eq(socialUsers.id, userId)).limit(1);
      const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
      const postUser = await db.select().from(socialUsers).where(eq(socialUsers.id, post[0].userId)).limit(1);
      
      const isSpanish = user[0].language === 'es';
      const isBot = user[0].isBot;
      
      let content = '';
      
      if (isBot) {
        // Generate AI response for bot users (simulating context awareness)
        const postContent = post[0].content;
        const postUserName = postUser[0].displayName;
        
        const prompt = isSpanish
          ? `Eres un usuario de una red social musical llamado ${user[0].displayName} con esta personalidad: "${user[0].personality}". 
             Responde al siguiente post de ${postUserName} con un comentario natural y contextual (máximo 2 oraciones):
             "${postContent}"`
          : `You are a music social network user named ${user[0].displayName} with this personality: "${user[0].personality}". 
             Respond to the following post by ${postUserName} with a natural, contextual comment (maximum 2 sentences):
             "${postContent}"`;
        
        content = await generateOpenRouterResponse(prompt);
      } else {
        content = isSpanish
          ? faker.lorem.sentence({ min: 1, max: 3 })
          : fakerEN_US.lorem.sentence({ min: 1, max: 3 });
      }
      
      const commentData = {
        userId: userId,
        postId: postId,
        parentId: null,
        content: content,
        likes: Math.floor(Math.random() * 20),
        isReply: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(comments).values(commentData as any);
    }
    
    // Add some replies to comments
    const allComments = await db.select().from(comments);
    
    for (let i = 0; i < 30; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const parentComment = allComments[Math.floor(Math.random() * allComments.length)];
      
      const user = await db.select().from(socialUsers).where(eq(socialUsers.id, userId)).limit(1);
      const commentUser = await db.select().from(socialUsers).where(eq(socialUsers.id, parentComment.userId)).limit(1);
      
      const isSpanish = user[0].language === 'es';
      const isBot = user[0].isBot;
      
      let content = '';
      
      if (isBot) {
        // Generate AI response for replies
        const commentContent = parentComment.content;
        const commentUserName = commentUser[0].displayName;
        
        const prompt = isSpanish
          ? `Eres un usuario de una red social musical llamado ${user[0].displayName} con esta personalidad: "${user[0].personality}". 
             Responde al siguiente comentario de ${commentUserName} con una respuesta natural, breve y contextual:
             "${commentContent}"`
          : `You are a music social network user named ${user[0].displayName} with this personality: "${user[0].personality}". 
             Respond to the following comment by ${commentUserName} with a natural, brief, and contextual reply:
             "${commentContent}"`;
        
        content = await generateOpenRouterResponse(prompt);
      } else {
        content = isSpanish
          ? faker.lorem.sentence()
          : fakerEN_US.lorem.sentence();
      }
      
      const replyData = {
        userId: userId,
        postId: parentComment.postId,
        parentId: parentComment.id,
        content: content,
        likes: Math.floor(Math.random() * 10),
        isReply: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(comments).values(replyData as any);
    }
    
    console.log("✅ Social network seeding completed successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding social network:", error);
  }
}

// Execute the seeding function
seedSocialNetwork()
  .then(() => {
    console.log("Seed script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed script failed:", error);
    process.exit(1);
  });