/**
 * Este script elimina todos los posts y comentarios existentes
 * y crea nuevos con contenido significativo en inglés relacionado con música.
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Contenido musical de alta calidad para posts en inglés
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

// Contenido para comentarios en inglés
const englishMusicComments = [
  "I completely agree! Your insights on music production are spot on.",
  
  "This is such a great point. I've been thinking about this a lot lately with my own music.",
  
  "Have you tried experimenting with different DAWs? I switched to Ableton last year and it changed my workflow completely.",
  
  "The melody in your latest track is absolutely incredible. Mind sharing some of your composition process?",
  
  "I've been struggling with this exact issue! Thanks for sharing your experience.",
  
  "This reminds me of a technique I learned at a production workshop last month. Total game-changer."
];

// Función para eliminar todos los posts y comentarios
async function deleteAllPostsAndComments() {
  console.log("🧹 Eliminando contenido existente...");
  
  // Borrar todos los comentarios
  const commentsSnapshot = await db.collection('social_comments').get();
  const commentDeletions = commentsSnapshot.docs.map(doc => 
    db.collection('social_comments').doc(doc.id).delete()
  );
  await Promise.all(commentDeletions);
  console.log(`✅ Eliminados ${commentsSnapshot.size} comentarios.`);
  
  // Borrar todos los posts
  const postsSnapshot = await db.collection('social_posts').get();
  const postDeletions = postsSnapshot.docs.map(doc => 
    db.collection('social_posts').doc(doc.id).delete()
  );
  await Promise.all(postDeletions);
  console.log(`✅ Eliminados ${postsSnapshot.size} posts.`);
}

// Función para crear nuevos posts y comentarios
async function createNewPostsAndComments() {
  console.log("🔄 Obteniendo usuarios existentes...");
  
  // Obtener todos los usuarios existentes
  const usersSnapshot = await db.collection('social_users').get();
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  if (users.length === 0) {
    console.log("❌ No se encontraron usuarios en la base de datos.");
    return;
  }
  
  console.log(`✅ Encontrados ${users.length} usuarios.`);
  
  // Separar usuarios en bots y humanos
  const humanUsers = users.filter(user => !user.isBot);
  const botUsers = users.filter(user => user.isBot);
  
  console.log(`📊 Usuarios humanos: ${humanUsers.length}, Usuarios bots: ${botUsers.length}`);
  
  // Crear posts para cada usuario humano
  console.log("📝 Creando nuevos posts...");
  const createdPosts = [];
  
  for (const user of humanUsers) {
    // Cada usuario humano crea 1-3 posts
    const postCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < postCount; i++) {
      // Seleccionar un post aleatorio
      const postContent = englishMusicPosts[Math.floor(Math.random() * englishMusicPosts.length)];
      
      // Crear post
      const postRef = db.collection('social_posts').doc();
      const now = new Date();
      const randomDaysAgo = Math.floor(Math.random() * 14); // hasta 14 días atrás
      const postDate = new Date(now.getTime() - (randomDaysAgo * 24 * 60 * 60 * 1000));
      
      const postData = {
        userId: user.id,
        content: postContent,
        likes: Math.floor(Math.random() * 20),
        createdAt: Timestamp.fromDate(postDate),
        updatedAt: Timestamp.fromDate(postDate)
      };
      
      await postRef.set(postData);
      createdPosts.push({
        id: postRef.id,
        ...postData
      });
      
      console.log(`✅ Post creado para ${user.displayName}`);
    }
  }
  
  console.log(`✅ Creados ${createdPosts.length} posts.`);
  
  // Crear comentarios en los posts
  console.log("💬 Creando comentarios en los posts...");
  let commentCount = 0;
  
  for (const post of createdPosts) {
    // Cada post recibe 2-5 comentarios
    const numComments = Math.floor(Math.random() * 4) + 2;
    
    // Mezclar usuarios bots y humanos para comentar
    const availableCommenters = [...users].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < numComments; i++) {
      if (i >= availableCommenters.length) break;
      
      const commenter = availableCommenters[i];
      
      // Verificar que el comentarista no sea el autor del post
      if (commenter.id === post.userId) continue;
      
      // Seleccionar un comentario aleatorio
      const commentContent = englishMusicComments[Math.floor(Math.random() * englishMusicComments.length)];
      
      // Crear el comentario
      const commentRef = db.collection('social_comments').doc();
      const postDate = post.createdAt.toDate();
      const now = new Date();
      
      // Fecha aleatoria entre la fecha del post y ahora
      const randomTimeOffset = Math.floor(Math.random() * (now.getTime() - postDate.getTime()));
      const commentDate = new Date(postDate.getTime() + randomTimeOffset);
      
      const commentData = {
        userId: commenter.id,
        postId: post.id,
        content: commentContent,
        likes: Math.floor(Math.random() * 10),
        isReply: false,
        parentId: null,
        createdAt: Timestamp.fromDate(commentDate),
        updatedAt: Timestamp.fromDate(commentDate)
      };
      
      await commentRef.set(commentData);
      commentCount++;
      
      console.log(`✅ Comentario creado por ${commenter.displayName}`);
    }
  }
  
  console.log(`✅ Creados ${commentCount} comentarios.`);
}

// Función principal
async function main() {
  try {
    // Eliminar todo el contenido existente
    await deleteAllPostsAndComments();
    
    // Crear nuevo contenido
    await createNewPostsAndComments();
    
    console.log("🎉 Contenido recreado exitosamente!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Ejecutar función principal
main();