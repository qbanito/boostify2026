import { faker } from '@faker-js/faker/locale/es';
import { faker as fakerEN_US } from '@faker-js/faker/locale/en_US';
import { firestoreSocialNetworkService, SocialUser, Post, Comment } from '../server/services/firestore-social-network.ts';
import { openRouterService } from '../server/services/openrouter-service.ts';

// Configuración
const TOTAL_USERS = 20;
const TOTAL_POSTS = 40;
const TOTAL_COMMENTS = 80;
const BOT_USERS_RATIO = 0.6; // 60% de usuarios serán bots

// Lista de avatares para usuarios (puedes cambiar estas URLs por otras si lo prefieres)
const avatars = [
  'https://api.dicebear.com/7.x/personas/svg?seed=1',
  'https://api.dicebear.com/7.x/personas/svg?seed=2',
  'https://api.dicebear.com/7.x/personas/svg?seed=3',
  'https://api.dicebear.com/7.x/personas/svg?seed=4',
  'https://api.dicebear.com/7.x/personas/svg?seed=5',
  'https://api.dicebear.com/7.x/personas/svg?seed=6',
  'https://api.dicebear.com/7.x/personas/svg?seed=7',
  'https://api.dicebear.com/7.x/personas/svg?seed=8',
  'https://api.dicebear.com/7.x/personas/svg?seed=9',
  'https://api.dicebear.com/7.x/personas/svg?seed=10',
];

// Personalidades para los bots
const personalities = [
  'amigable y conversador, siempre respondiendo positivamente',
  'crítico y analítico, cuestionando constructivamente',
  'creativo y artístico, con un enfoque original',
  'técnico y detallista, aportando conocimiento especializado',
  'motivador y entusiasta, animando a otros',
  'humorístico y divertido, usando un tono ligero',
  'reflexivo y filosófico, explorando ideas profundas',
  'profesional y directo, manteniendo un tono de negocios',
  'empático y comprensivo, mostrando apoyo emocional',
  'didáctico y explicativo, compartiendo conocimiento de forma accesible'
];

// Intereses por categoría
const interests = [
  ['música', 'producción musical', 'composición', 'instrumentos'],
  ['marketing digital', 'promoción musical', 'redes sociales', 'estrategias de marca'],
  ['industria musical', 'sellos discográficos', 'distribución', 'tendencias'],
  ['tecnología musical', 'software de producción', 'equipamiento', 'plugins'],
  ['actuaciones en vivo', 'giras', 'festivales', 'organización de eventos'],
  ['música', 'audio', 'producción', 'mezcla', 'mastering'],
  ['music', 'audio production', 'mixing', 'mastering'],
  ['studio equipment', 'recording techniques', 'sound design'],
  ['songwriting', 'composition', 'lyrics', 'arrangement'],
  ['music industry', 'contracts', 'publishing', 'distribution']
];

// Función para generar respuestas de OpenRouter
async function generateOpenRouterResponse(prompt: string): Promise<string> {
  try {
    // La respuesta puede tardar, así que esperamos con un tiempo máximo
    const response = await Promise.race([
      openRouterService.generateResponse(prompt),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('OpenRouter timeout')), 5000)
      )
    ]);
    
    return response;
  } catch (error) {
    console.log('Using fallback response for seeding');
    return getFallbackResponse(prompt);
  }
}

// Respuestas de respaldo en caso de que falle la API
function getFallbackResponse(prompt: string): string {
  // Detector de idioma simple
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

// Función para limpiar datos existentes
async function clearExistingData() {
  try {
    console.log('No se pueden eliminar documentos automáticamente en este script. Si necesitas limpiar datos, hazlo manualmente en la consola de Firebase.');
  } catch (error) {
    console.error("Error al preparar los datos:", error);
  }
}

// Función principal para poblar la base de datos
async function seedFirestoreSocialNetwork() {
  console.log("🌱 Iniciando proceso de poblado de la red social en Firestore...");
  
  try {
    // Avisar sobre la limpieza de datos
    await clearExistingData();
    
    console.log(`Creando ${TOTAL_USERS} usuarios...`);
    
    // Crear usuarios
    const userIds = [];
    const userMap: {[key: string]: SocialUser} = {};
    
    for (let i = 0; i < TOTAL_USERS; i++) {
      const isSpanish = Math.random() > 0.5;
      const isBot = Math.random() < BOT_USERS_RATIO;
      
      const fullName = isSpanish 
        ? faker.person.fullName() 
        : fakerEN_US.person.fullName();
      
      // Preparar datos del usuario, asegurando que no haya valores undefined
      const userData: Omit<SocialUser, 'id'> = {
        displayName: fullName,
        avatar: avatars[i % avatars.length],
        bio: isSpanish 
          ? faker.person.bio() 
          : fakerEN_US.person.bio(),
        interests: interests[Math.floor(Math.random() * interests.length)],
        language: isSpanish ? 'es' : 'en',
        isBot: isBot,
        // Si es bot, asignar personalidad, si no, dejar como string vacío (no undefined)
        personality: isBot ? personalities[Math.floor(Math.random() * personalities.length)] : '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const user = await firestoreSocialNetworkService.createUser(userData);
      userIds.push(user.id);
      userMap[user.id as string] = user;
      
      console.log(`Creado usuario: ${user.displayName} (${user.language}, Bot: ${user.isBot})`);
    }
    
    console.log(`Creando ${TOTAL_POSTS} posts...`);
    
    // Crear posts
    const postIds = [];
    const postMap: {[key: string]: Post} = {};
    
    for (let i = 0; i < TOTAL_POSTS; i++) {
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const user = userMap[randomUserId as string];
      const isSpanish = user.language === 'es';
      
      const content = isSpanish
        ? faker.lorem.paragraph({ min: 1, max: 3 })
        : fakerEN_US.lorem.paragraph({ min: 1, max: 3 });
      
      const postData: Omit<Post, 'id'> = {
        userId: randomUserId as string,
        content: content,
        likes: Math.floor(Math.random() * 50),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const post = await firestoreSocialNetworkService.createPost(postData);
      postIds.push(post.id);
      postMap[post.id as string] = post;
    }
    
    console.log(`Creando ${TOTAL_COMMENTS} comentarios...`);
    
    // Crear comentarios
    for (let i = 0; i < TOTAL_COMMENTS; i++) {
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const randomPostId = postIds[Math.floor(Math.random() * postIds.length)];
      
      const user = userMap[randomUserId as string];
      const post = postMap[randomPostId as string]; 
      const postUser = userMap[post.userId];
      
      const isSpanish = user.language === 'es';
      const isBot = user.isBot;
      
      let content = '';
      
      if (isBot) {
        // Generar respuesta con IA para usuarios bot
        const postContent = post.content;
        const postUserName = postUser.displayName;
        
        const prompt = isSpanish
          ? `Eres un usuario de una red social musical llamado ${user.displayName} con esta personalidad: "${user.personality}". 
             Responde al siguiente post de ${postUserName} con un comentario natural y contextual (máximo 2 oraciones):
             "${postContent}"`
          : `You are a music social network user named ${user.displayName} with this personality: "${user.personality}". 
             Respond to the following post by ${postUserName} with a natural, contextual comment (maximum 2 sentences):
             "${postContent}"`;
        
        content = await generateOpenRouterResponse(prompt);
      } else {
        content = isSpanish
          ? faker.lorem.sentence({ min: 1, max: 3 })
          : fakerEN_US.lorem.sentence({ min: 1, max: 3 });
      }
      
      const commentData: Omit<Comment, 'id'> = {
        userId: randomUserId as string,
        postId: randomPostId as string,
        parentId: null,
        content: content,
        likes: Math.floor(Math.random() * 20),
        isReply: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await firestoreSocialNetworkService.createComment(commentData);
    }
    
    // Agregar algunas respuestas a comentarios
    const allComments = await Promise.all(
      postIds.map(async pid => firestoreSocialNetworkService.getCommentsByPostId(pid as string))
    );
    const flatComments = allComments.flat();
    
    console.log('Creando respuestas a comentarios...');
    
    for (let i = 0; i < 30 && i < flatComments.length; i++) {
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const parentComment = flatComments[Math.floor(Math.random() * flatComments.length)];
      
      const user = userMap[randomUserId as string];
      const commentUser = userMap[parentComment.userId];
      
      const isSpanish = user.language === 'es';
      const isBot = user.isBot;
      
      let content = '';
      
      if (isBot) {
        // Generar respuesta con IA
        const commentContent = parentComment.content;
        const commentUserName = commentUser.displayName;
        
        const prompt = isSpanish
          ? `Eres un usuario de una red social musical llamado ${user.displayName} con esta personalidad: "${user.personality}". 
             Responde al siguiente comentario de ${commentUserName} con una respuesta natural, breve y contextual:
             "${commentContent}"`
          : `You are a music social network user named ${user.displayName} with this personality: "${user.personality}". 
             Respond to the following comment by ${commentUserName} with a natural, brief, and contextual reply:
             "${commentContent}"`;
        
        content = await generateOpenRouterResponse(prompt);
      } else {
        content = isSpanish
          ? faker.lorem.sentence()
          : fakerEN_US.lorem.sentence();
      }
      
      const replyData: Omit<Comment, 'id'> = {
        userId: randomUserId as string,
        postId: parentComment.postId,
        parentId: parentComment.id as string,
        content: content,
        likes: Math.floor(Math.random() * 10),
        isReply: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await firestoreSocialNetworkService.createComment(replyData);
    }
    
    console.log("✅ Poblado de red social en Firestore completado exitosamente!");
    
  } catch (error) {
    console.error("❌ Error al poblar la red social en Firestore:", error);
  }
}

// Ejecutar el script
seedFirestoreSocialNetwork()
  .then(() => {
    console.log("Script de poblado completado.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error en script de poblado:", error);
    process.exit(1);
  });