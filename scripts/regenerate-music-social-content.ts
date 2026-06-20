/**
 * Este script regenera el contenido de la red social con posts y comentarios
 * relacionados con música, manteniendo el soporte bilingüe (Inglés/Español)
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { openRouterService } from '../server/services/openrouter-service';

// Lista predefinida de posts sobre música en inglés
const musicPostsEn = [
  "Just discovered some amazing indie bands this weekend! Anyone else into indie rock? Looking for recommendations!",
  "I've been practicing guitar for 6 months now and finally nailed that difficult solo! The journey of learning an instrument is so rewarding.",
  "What do you all think about the latest trend of AI in music production? Is it helping creativity or limiting authentic expression?",
  "Festival season is coming up! Which music festivals are you all planning to attend this year?",
  "I'm working on a new song and stuck on the bridge section. Any fellow songwriters have tips for overcoming creative blocks?"
];

// Lista predefinida de posts sobre música en español
const musicPostsEs = [
  "Acabo de descubrir algunas bandas indie increíbles este fin de semana! ¿Alguien más es fan del rock indie? ¡Busco recomendaciones!",
  "Llevo 6 meses practicando guitarra y finalmente dominé ese difícil solo! El camino de aprender un instrumento es muy gratificante.",
  "¿Qué opinan sobre la tendencia actual de la IA en la producción musical? ¿Está ayudando a la creatividad o limitando la expresión auténtica?",
  "¡Se acerca la temporada de festivales! ¿A qué festivales de música planean asistir este año?",
  "Estoy trabajando en una nueva canción y estoy estancado en la sección del puente. ¿Algún otro compositor tiene consejos para superar bloqueos creativos?"
];

/**
 * Elimina todos los posts y comentarios existentes en Firestore
 */
async function deleteAllPostsAndComments() {
  console.log("🔄 Eliminando posts y comentarios existentes...");
  
  // Eliminar comentarios primero (debido a restricciones de integridad referencial)
  const commentsSnapshot = await db.collection('social_comments').get();
  
  for (const doc of commentsSnapshot.docs) {
    await doc.ref.delete();
  }
  
  console.log(`✅ ${commentsSnapshot.size} comentarios eliminados.`);
  
  // Eliminar posts
  const postsSnapshot = await db.collection('social_posts').get();
  
  for (const doc of postsSnapshot.docs) {
    await doc.ref.delete();
  }
  
  console.log(`✅ ${postsSnapshot.size} posts eliminados.`);
}

/**
 * Obtiene las respuestas de IA para un prompt específico
 */
async function generateAIResponse(prompt: string, language: string, isMusician: boolean = false): Promise<string> {
  try {
    // Contexto adicional para la IA
    const context = isMusician 
      ? "You are an expert musician responding to a social media post about music." 
      : "You are a music enthusiast responding to a social media post about music.";
    
    // Generar respuesta usando OpenRouter
    const response = await openRouterService.generateResponse(prompt, context, language);
    return response;
  } catch (error) {
    console.error("Error generando respuesta AI:", error);
    return language === 'es' 
      ? "Interesante perspectiva sobre la música. ¡Gracias por compartir!" 
      : "Interesting perspective on music. Thanks for sharing!";
  }
}

/**
 * Crea nuevos posts y comentarios relacionados con música
 */
async function createNewMusicContent() {
  try {
    console.log("🔄 Obteniendo usuarios...");
    
    // Obtener todos los usuarios
    const usersSnapshot = await db.collection('social_users').get();
    
    if (usersSnapshot.empty) {
      console.log("❌ No se encontraron usuarios.");
      return;
    }
    
    // Organizar usuarios por idioma y si son bots
    const englishUsers = [];
    const spanishUsers = [];
    const botUsers = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      
      if (userData.isBot) {
        botUsers.push({ id: userDoc.id, ...userData });
      } else if (userData.language === 'en') {
        englishUsers.push({ id: userDoc.id, ...userData });
      } else {
        spanishUsers.push({ id: userDoc.id, ...userData });
      }
    }
    
    console.log(`✅ Usuarios encontrados: ${englishUsers.length} en inglés, ${spanishUsers.length} en español, ${botUsers.length} bots.`);
    
    // Crear posts en inglés
    console.log("🔄 Creando posts en inglés...");
    const englishPostIds = [];
    
    for (const post of musicPostsEn) {
      // Elegir un usuario aleatorio que hable inglés
      const randomIndex = Math.floor(Math.random() * englishUsers.length);
      const user = englishUsers[randomIndex];
      
      const now = new Date();
      
      // Crear post
      const postRef = await db.collection('social_posts').add({
        userId: user.id,
        content: post,
        likes: Math.floor(Math.random() * 10),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      });
      
      englishPostIds.push(postRef.id);
      console.log(`✅ Post creado por ${user.displayName}`);
    }
    
    // Crear posts en español
    console.log("🔄 Creando posts en español...");
    const spanishPostIds = [];
    
    for (const post of musicPostsEs) {
      // Elegir un usuario aleatorio que hable español
      const randomIndex = Math.floor(Math.random() * spanishUsers.length);
      const user = spanishUsers[randomIndex];
      
      const now = new Date();
      
      // Crear post
      const postRef = await db.collection('social_posts').add({
        userId: user.id,
        content: post,
        likes: Math.floor(Math.random() * 10),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      });
      
      spanishPostIds.push(postRef.id);
      console.log(`✅ Post creado por ${user.displayName}`);
    }
    
    // Agregar comentarios a los posts en inglés
    console.log("🔄 Agregando comentarios a posts en inglés...");
    
    for (const postId of englishPostIds) {
      const postDoc = await db.collection('social_posts').doc(postId).get();
      const postData = postDoc.data();
      
      if (!postData) continue;
      
      // Generar 2-4 comentarios por post
      const commentCount = 2 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < commentCount; i++) {
        // Alternar entre usuarios normales y bots para los comentarios
        let user;
        let isBot = false;
        
        if (i % 3 === 0 && botUsers.length > 0) {
          // Usar un bot para este comentario
          const randomIndex = Math.floor(Math.random() * botUsers.length);
          user = botUsers[randomIndex];
          isBot = true;
        } else {
          // Usar un usuario normal
          const randomIndex = Math.floor(Math.random() * englishUsers.length);
          user = englishUsers[randomIndex];
        }
        
        let commentContent;
        
        if (isBot) {
          // Generar respuesta de bot usando IA
          const prompt = `Post: "${postData.content}"\nWrite a thoughtful and helpful comment about this music-related post. Be specific and refer to the content.`;
          commentContent = await generateAIResponse(prompt, 'en', true);
        } else {
          // Lista de posibles comentarios humanos en inglés
          const humanComments = [
            "I totally agree! Music is so powerful.",
            "Thanks for sharing this perspective. I've been thinking the same thing lately.",
            "Have you tried listening to [artist name]? They're amazing and similar to what you described!",
            "Great point! I'd add that music theory really helps with this too.",
            "I'm having a similar experience with my musical journey. Let's connect!",
          ];
          
          commentContent = humanComments[Math.floor(Math.random() * humanComments.length)];
        }
        
        const now = new Date();
        
        // Crear comentario
        await db.collection('social_comments').add({
          userId: user.id,
          postId: postId,
          content: commentContent,
          likes: Math.floor(Math.random() * 5),
          isReply: false,
          parentId: null,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
        
        console.log(`  ✅ Comentario agregado por ${user.displayName}`);
      }
    }
    
    // Agregar comentarios a los posts en español
    console.log("🔄 Agregando comentarios a posts en español...");
    
    for (const postId of spanishPostIds) {
      const postDoc = await db.collection('social_posts').doc(postId).get();
      const postData = postDoc.data();
      
      if (!postData) continue;
      
      // Generar 2-4 comentarios por post
      const commentCount = 2 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < commentCount; i++) {
        // Alternar entre usuarios normales y bots para los comentarios
        let user;
        let isBot = false;
        
        if (i % 3 === 0 && botUsers.length > 0) {
          // Usar un bot para este comentario
          const randomIndex = Math.floor(Math.random() * botUsers.length);
          user = botUsers[randomIndex];
          isBot = true;
        } else {
          // Usar un usuario normal
          const randomIndex = Math.floor(Math.random() * spanishUsers.length);
          user = spanishUsers[randomIndex];
        }
        
        let commentContent;
        
        if (isBot) {
          // Generar respuesta de bot usando IA
          const prompt = `Post: "${postData.content}"\nEscribe un comentario reflexivo y útil sobre este post relacionado con la música. Sé específico y haz referencia al contenido.`;
          commentContent = await generateAIResponse(prompt, 'es', true);
        } else {
          // Lista de posibles comentarios humanos en español
          const humanComments = [
            "¡Estoy totalmente de acuerdo! La música es muy poderosa.",
            "Gracias por compartir esta perspectiva. He estado pensando lo mismo últimamente.",
            "¿Has intentado escuchar a [nombre del artista]? ¡Son increíbles y similares a lo que describiste!",
            "¡Gran punto! Agregaría que la teoría musical realmente ayuda con esto también.",
            "Estoy teniendo una experiencia similar en mi camino musical. ¡Conectémonos!",
          ];
          
          commentContent = humanComments[Math.floor(Math.random() * humanComments.length)];
        }
        
        const now = new Date();
        
        // Crear comentario
        await db.collection('social_comments').add({
          userId: user.id,
          postId: postId,
          content: commentContent,
          likes: Math.floor(Math.random() * 5),
          isReply: false,
          parentId: null,
          createdAt: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        });
        
        console.log(`  ✅ Comentario agregado por ${user.displayName}`);
      }
    }
    
    console.log("🎉 Contenido de la red social musical regenerado exitosamente!");
    
  } catch (error) {
    console.error("❌ Error al crear contenido:", error);
  }
}

// Función principal
async function main() {
  try {
    // Primero eliminar el contenido existente
    await deleteAllPostsAndComments();
    
    // Luego crear nuevo contenido
    await createNewMusicContent();
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el script:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();