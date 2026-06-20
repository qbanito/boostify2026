/**
 * Script simplificado para generar algunos usuarios de demostración
 * para la red social en Firestore
 */

import { db } from '../server/firebase';
import { firestoreSocialNetworkService } from '../server/services/firestore-social-network';
import { Timestamp } from 'firebase-admin/firestore';

// Lista de usuarios de demostración
const demoUsers = [
  {
    displayName: "Emily Johnson",
    bio: "Music producer specializing in electronic and ambient genres.",
    interests: ["Electronic Music", "Sound Design", "Mixing"],
    language: "en" as const,
    isBot: false
  },
  {
    displayName: "Michael Rodriguez",
    bio: "Guitar enthusiast and songwriter with a passion for rock and blues.",
    interests: ["Guitar", "Songwriting", "Rock Music"],
    language: "en" as const,
    isBot: false
  },
  {
    displayName: "Carlos Mendoza",
    bio: "Productor musical con experiencia en géneros latinos y electrónicos.",
    interests: ["Producción Musical", "Música Latina", "Mezcla"],
    language: "es" as const,
    isBot: false
  },
  {
    displayName: "Sophie Williams",
    bio: "Classical pianist exploring the intersection of classical and electronic music.",
    interests: ["Piano", "Classical", "Film Scoring"],
    language: "en" as const,
    isBot: false
  },
  {
    displayName: "David Chen",
    bio: "Beat producer and hip-hop enthusiast. Always looking for collaborations.",
    interests: ["Hip Hop", "Beat Making", "Sampling"],
    language: "en" as const,
    isBot: false
  },
  {
    displayName: "María González",
    bio: "Cantante y compositora explorando fusiones de música tradicional y contemporánea.",
    interests: ["Canto", "Composición", "Música Folclórica"],
    language: "es" as const,
    isBot: false
  },
  {
    displayName: "Music Production Bot",
    bio: "AI assistant specializing in music production techniques and workflow optimization.",
    interests: ["Music Production", "Mixing", "Sound Design", "Workflow"],
    language: "en" as const,
    isBot: true,
    personality: "Helpful and technical advisor on music production topics"
  },
  {
    displayName: "Bot de Teoría Musical",
    bio: "Asistente de IA especializado en teoría musical y composición.",
    interests: ["Teoría Musical", "Composición", "Armonía", "Análisis"],
    language: "es" as const,
    isBot: true,
    personality: "Educador paciente que explica conceptos musicales complejos de manera accesible"
  }
];

// Posts de demostración en inglés
const englishPosts = [
  "Just finished a new track using parallel compression on the drums. The punch this technique adds is incredible! Anyone else use this in their productions?",
  
  "What's your favorite VST synth for ambient pads? I've been using Omnisphere but looking to explore some alternatives for my next project.",
  
  "Thoughts on the resurgence of hardware synths? I've been tempted to invest in a Moog, but wondering if it's worth the expense compared to software options.",
  
  "Studio organization tip: color-coding all my tracks by instrument type has dramatically improved my workflow. Anyone else have organizational hacks they swear by?",
  
  "The line between producer and audio engineer continues to blur. How many of you handle both aspects completely in your own projects versus outsourcing mixing/mastering?",
  
  "Just discovered this amazing free drum sample pack with some excellent acoustic kit samples. Link in the comments if anyone's interested!"
];

// Posts de demostración en español
const spanishPosts = [
  "Acabo de finalizar un nuevo tema aplicando compresión paralela en la batería. ¡El impacto que añade esta técnica es increíble! ¿Alguien más la utiliza en sus producciones?",
  
  "¿Cuál es vuestro sintetizador VST favorito para pads ambientales? He estado usando Omnisphere pero busco explorar algunas alternativas para mi próximo proyecto.",
  
  "¿Qué opináis sobre el resurgimiento de los sintetizadores hardware? Me he sentido tentado a invertir en un Moog, pero me pregunto si vale la pena el gasto en comparación con las opciones de software.",
  
  "Consejo de organización de estudio: codificar por colores todas mis pistas por tipo de instrumento ha mejorado dramáticamente mi flujo de trabajo. ¿Alguien más tiene trucos de organización por los que jure?"
];

// Comentarios de demostración en inglés
const englishComments = [
  "Great point! I've been implementing this in my recent productions too.",
  
  "Have you tried Massive X? It's become my go-to for complex sound design.",
  
  "I think the tactile nature of hardware brings something special to the creative process. Worth trying before investing.",
  
  "Love this technique! It's transformed how I approach mixing completely.",
  
  "Would you mind sharing your signal chain for this? The results sound fantastic!"
];

// Comentarios de demostración en español
const spanishComments = [
  "¡Excelente punto! También he estado implementando esto en mis producciones recientes.",
  
  "¿Has probado Massive X? Se ha convertido en mi opción predilecta para diseño de sonido complejo.",
  
  "Creo que la naturaleza táctil del hardware aporta algo especial al proceso creativo. Vale la pena probarlo antes de invertir.",
  
  "¡Me encanta esta técnica! Ha transformado completamente mi enfoque de la mezcla.",
  
  "¿Te importaría compartir tu cadena de señal para esto? ¡Los resultados suenan fantásticos!"
];

// Función para generar una fecha aleatoria en los últimos 30 días
function generateRandomDate(daysBack = 30): Date {
  const now = new Date();
  const randomDaysAgo = Math.floor(Math.random() * daysBack);
  const randomHoursAgo = Math.floor(Math.random() * 23);
  const randomMinutesAgo = Math.floor(Math.random() * 59);
  
  now.setDate(now.getDate() - randomDaysAgo);
  now.setHours(now.getHours() - randomHoursAgo);
  now.setMinutes(now.getMinutes() - randomMinutesAgo);
  
  return now;
}

// Función para obtener un elemento aleatorio de un array
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Función para limpiar la base de datos existente
async function clearDatabase() {
  console.log("🧹 Limpiando la base de datos existente...");
  
  // Borrar todos los comentarios
  const commentsSnapshot = await db.collection('social_comments').get();
  const commentDeletions = commentsSnapshot.docs.map(doc => 
    db.collection('social_comments').doc(doc.id).delete()
  );
  await Promise.all(commentDeletions);
  console.log(`Eliminados ${commentsSnapshot.size} comentarios.`);
  
  // Borrar todos los posts
  const postsSnapshot = await db.collection('social_posts').get();
  const postDeletions = postsSnapshot.docs.map(doc => 
    db.collection('social_posts').doc(doc.id).delete()
  );
  await Promise.all(postDeletions);
  console.log(`Eliminados ${postsSnapshot.size} posts.`);
  
  // Borrar todos los usuarios
  const usersSnapshot = await db.collection('social_users').get();
  const userDeletions = usersSnapshot.docs.map(doc => 
    db.collection('social_users').doc(doc.id).delete()
  );
  await Promise.all(userDeletions);
  console.log(`Eliminados ${usersSnapshot.size} usuarios.`);
}

// Función principal para generar usuarios, posts y comentarios de demostración
async function generateDemoData() {
  // Crear los usuarios de demostración
  console.log("👤 Creando usuarios de demostración...");
  const createdUsers = [];
  
  for (const user of demoUsers) {
    const userData = {
      ...user,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const createdUser = await firestoreSocialNetworkService.createUser(userData);
    createdUsers.push(createdUser);
    console.log(`✅ Usuario creado: ${user.displayName}`);
  }
  
  // Crear 2-3 posts por cada usuario humano
  console.log("\n📝 Creando posts de demostración...");
  const humanUsers = createdUsers.filter(user => !user.isBot);
  const createdPosts = [];
  
  for (const user of humanUsers) {
    const postCount = Math.floor(Math.random() * 2) + 2; // 2-3 posts por usuario
    const postsSource = user.language === "en" ? englishPosts : spanishPosts;
    
    for (let i = 0; i < postCount; i++) {
      if (i >= postsSource.length) break;
      
      const postData = {
        userId: user.id,
        content: postsSource[i],
        likes: Math.floor(Math.random() * 20),
        createdAt: generateRandomDate(30),
        updatedAt: new Date()
      };
      
      const post = await firestoreSocialNetworkService.createPost(postData);
      createdPosts.push(post);
      console.log(`✅ Post creado para ${user.displayName}`);
    }
  }
  
  // Crear 2-4 comentarios por post, utilizando una mezcla de usuarios bot y humanos
  console.log("\n💬 Creando comentarios en los posts...");
  
  for (const post of createdPosts) {
    // Obtener el post completo para conocer el idioma del autor
    const postDoc = await db.collection('social_posts').doc(post.id).get();
    const postData = postDoc.data();
    const postAuthorDoc = await db.collection('social_users').doc(postData?.userId).get();
    const postAuthorData = postAuthorDoc.data();
    const postLanguage = postAuthorData?.language || "en";
    
    // Número aleatorio de comentarios (2-4)
    const commentCount = Math.floor(Math.random() * 3) + 2;
    
    // Seleccionar comentarios según el idioma
    const commentsSource = postLanguage === "en" ? englishComments : spanishComments;
    
    // Crear los comentarios
    for (let i = 0; i < commentCount; i++) {
      if (i >= commentsSource.length) break;
      
      // Seleccionar un usuario aleatorio para comentar (preferir usuarios del mismo idioma)
      const sameLanguageUsers = createdUsers.filter(u => u.language === postLanguage);
      const commenter = getRandomElement(sameLanguageUsers);
      
      const commentData = {
        userId: commenter.id,
        postId: post.id,
        content: commentsSource[i],
        likes: Math.floor(Math.random() * 10),
        isReply: false,
        parentId: null,
        createdAt: generateRandomDate(15),
        updatedAt: new Date()
      };
      
      await firestoreSocialNetworkService.createComment(commentData);
      console.log(`✅ Comentario creado por ${commenter.displayName}`);
    }
  }
  
  console.log("\n🎉 Generación de datos de demostración completada!");
}

// Función principal
async function main() {
  try {
    await clearDatabase();
    await generateDemoData();
    
    console.log("✅ Script finalizado con éxito!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al ejecutar el script:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();