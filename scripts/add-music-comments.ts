/**
 * Script para añadir comentarios a los posts existentes en la red social
 * Incrementa la interacción y debate musical en la comunidad
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Comentarios específicos en inglés
const englishComments = [
  "I totally agree with your perspective on music production. The tools have become more accessible, but the art is still in the creativity.",
  "For jazz improvisation, I found that learning the modes for each chord really opened up my playing. Have you tried that approach?",
  "Ableton has been a game-changer for my workflow compared to FL Studio, especially for live performance integration.",
  "If you like Malian music, you should definitely check out Bassekou Kouyate and Songhoy Blues - absolutely mind-blowing talents!",
  "Transcribing solos has been the single most valuable practice technique in my development as a guitarist. It trains both the ear and the fingers.",
  "The democratization of music production has its pros and cons. More voices get heard, but the signal-to-noise ratio has decreased.",
  "I've been incorporating jazz harmony into my hip-hop beats lately, and the results have been really unique. Anyone else experimenting with genre fusion?",
  "What elements of classical music do you think have the most influence on modern production techniques?",
  "Have you tried any of the new AI-assisted music tools? I'm curious about how they might change the creative process.",
  "The link between theory knowledge and creative expression is so important. Understanding the rules gives you the freedom to break them effectively."
];

// Comentarios específicos en español
const spanishComments = [
  "Estoy totalmente de acuerdo con tu perspectiva sobre la producción musical. Las herramientas se han vuelto más accesibles, pero el arte sigue estando en la creatividad.",
  "Para la improvisación de jazz, descubrí que aprender los modos para cada acorde realmente amplió mi forma de tocar. ¿Has probado ese enfoque?",
  "Ableton ha sido un cambio radical para mi flujo de trabajo en comparación con FL Studio, especialmente para la integración de actuaciones en vivo.",
  "Si te gusta la música de Mali, definitivamente deberías escuchar a Bassekou Kouyate y Songhoy Blues - ¡talentos absolutamente alucinantes!",
  "Transcribir solos ha sido la técnica de práctica más valiosa en mi desarrollo como guitarrista. Entrena tanto el oído como los dedos.",
  "La democratización de la producción musical tiene sus pros y contras. Más voces se escuchan, pero la relación señal-ruido ha disminuido.",
  "Últimamente he estado incorporando armonía de jazz en mis beats de hip-hop, y los resultados han sido realmente únicos. ¿Alguien más está experimentando con la fusión de géneros?",
  "¿Qué elementos de la música clásica crees que tienen más influencia en las técnicas de producción modernas?",
  "¿Has probado alguna de las nuevas herramientas musicales asistidas por IA? Tengo curiosidad sobre cómo podrían cambiar el proceso creativo.",
  "El vínculo entre el conocimiento teórico y la expresión creativa es muy importante. Entender las reglas te da la libertad de romperlas de manera efectiva."
];

/**
 * Agrega comentarios a los posts existentes
 */
async function addCommentsToExistingPosts() {
  console.log("🔄 Obteniendo usuarios y posts...");
  
  // Obtener todos los usuarios
  const usersSnapshot = await db.collection('social_users').get();
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Separar usuarios por idioma
  const englishUsers = users.filter(user => user.language === 'en');
  const spanishUsers = users.filter(user => user.language === 'es');
  
  // Obtener todos los posts
  const postsSnapshot = await db.collection('social_posts').get();
  const posts = postsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`✅ Encontrados ${users.length} usuarios y ${posts.length} posts.`);
  
  // Para cada post, agregar 2-5 comentarios
  let commentCount = 0;
  
  for (const post of posts) {
    // Encontrar el usuario que creó el post
    const postUser = users.find(u => u.id === post.userId);
    if (!postUser) continue;
    
    // Determinar idioma del post
    const isEnglishPost = postUser.language === 'en';
    
    // Seleccionar pool de usuarios que comentarán (mismo idioma del post)
    const commentUserPool = isEnglishPost ? englishUsers : spanishUsers;
    
    // Seleccionar pool de comentarios
    const commentPool = isEnglishPost ? englishComments : spanishComments;
    
    // Determinar número aleatorio de comentarios para este post (2-5)
    const numComments = 2 + Math.floor(Math.random() * 4);
    
    console.log(`Añadiendo ${numComments} comentarios al post de ${postUser.displayName} (${postUser.language})`);
    
    // Generar los comentarios
    for (let i = 0; i < numComments; i++) {
      // Seleccionar usuario aleatorio para comentar (distinto al autor del post)
      let commentUser;
      do {
        commentUser = commentUserPool[Math.floor(Math.random() * commentUserPool.length)];
      } while (commentUser.id === postUser.id);
      
      // Seleccionar comentario aleatorio
      const commentText = commentPool[Math.floor(Math.random() * commentPool.length)];
      
      // Generar fecha del comentario (posterior a la del post)
      const postDate = post.createdAt.toDate();
      const hoursAfter = Math.floor(Math.random() * 48); // Entre 0 y 48 horas después
      const commentDate = new Date(postDate.getTime() + hoursAfter * 60 * 60 * 1000);
      
      // Crear el comentario
      await db.collection('social_comments').add({
        userId: commentUser.id,
        postId: post.id,
        content: commentText,
        likes: Math.floor(Math.random() * 8),
        isReply: false,
        parentId: null,
        createdAt: Timestamp.fromDate(commentDate),
        updatedAt: Timestamp.fromDate(commentDate)
      });
      
      commentCount++;
      console.log(`  ✅ Comentario añadido por ${commentUser.displayName}`);
    }
  }
  
  console.log(`🎉 Total de ${commentCount} comentarios añadidos.`);
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Iniciando adición de comentarios musicales a posts existentes...");
    
    await addCommentsToExistingPosts();
    
    console.log("✅ Proceso completado exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();