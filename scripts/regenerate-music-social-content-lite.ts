/**
 * Versión simplificada del script para regenerar contenido musical
 * No depende de llamadas a la API para la generación de contenido
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

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

// Comentarios predefinidos en inglés
const commentsEn = [
  "I totally agree! Music is so powerful and transformative.",
  "Thanks for sharing this perspective. I've been thinking about this a lot lately as well.",
  "Have you tried listening to Arcade Fire? They're amazing and might give you some inspiration!",
  "Great point! I'd add that music theory really helps with understanding these concepts too.",
  "I'm having a similar experience with my musical journey. Let's connect and share ideas!",
  "Sometimes stepping away from a song for a few days helps me overcome creative blocks.",
  "The new wave of indie rock bands has been really refreshing. Check out Japanese Breakfast and Big Thief.",
  "Nothing beats the feeling of finally mastering a difficult piece after weeks of practice.",
  "I've been using AI tools to help with drum patterns and they're surprisingly good!",
  "I'm planning to attend Primavera Sound this year! The lineup looks incredible."
];

// Comentarios predefinidos en español
const commentsEs = [
  "¡Estoy totalmente de acuerdo! La música es muy poderosa y transformadora.",
  "Gracias por compartir esta perspectiva. He estado pensando mucho en esto últimamente también.",
  "¿Has intentado escuchar a Arcade Fire? ¡Son increíbles y podrían darte algo de inspiración!",
  "¡Gran punto! Agregaría que la teoría musical realmente ayuda a entender estos conceptos también.",
  "Estoy teniendo una experiencia similar en mi camino musical. ¡Conectémonos y compartamos ideas!",
  "A veces, alejarme de una canción por unos días me ayuda a superar los bloqueos creativos.",
  "La nueva ola de bandas de rock indie ha sido muy refrescante. Escucha a Japanese Breakfast y Big Thief.",
  "No hay nada como la sensación de finalmente dominar una pieza difícil después de semanas de práctica.",
  "¡He estado usando herramientas de IA para ayudar con patrones de batería y son sorprendentemente buenas!",
  "¡Planeo asistir a Primavera Sound este año! El cartel se ve increíble."
];

// Comentarios de bot predefinidos en inglés
const botCommentsEn = [
  "As a music theory expert, I'd recommend focusing on the chord progression first when you're stuck on a bridge. Try using a secondary dominant or a borrowed chord from the parallel minor/major to create tension.",
  "The debate around AI in music is fascinating! AI can be a powerful tool for musicians, helping with tasks like mixing and sound design, while leaving the creative decisions to the human artist.",
  "If you're into indie rock, I'd suggest exploring bands like Wolf Alice, The War on Drugs, and Vampire Weekend. They each bring unique elements to the genre and might inspire your own musical journey.",
  "Festival preparation tip: Create a schedule of must-see artists beforehand, but leave room for spontaneous discoveries. Some of the best festival experiences come from stumbling upon new artists!",
  "When learning difficult solos, try the 'chunking' technique - break it down into smaller phrases and practice each at a slow tempo before gradually increasing speed. This builds muscle memory more effectively."
];

// Comentarios de bot predefinidos en español
const botCommentsEs = [
  "Como experto en teoría musical, recomendaría enfocarse primero en la progresión de acordes cuando estés atascado en un puente. Intenta usar un dominante secundario o un acorde prestado del menor/mayor paralelo para crear tensión.",
  "¡El debate sobre la IA en la música es fascinante! La IA puede ser una herramienta poderosa para los músicos, ayudando con tareas como la mezcla y el diseño de sonido, mientras deja las decisiones creativas al artista humano.",
  "Si te gusta el rock indie, te sugeriría explorar bandas como Wolf Alice, The War on Drugs y Vampire Weekend. Cada una aporta elementos únicos al género y podría inspirar tu propio viaje musical.",
  "Consejo para preparación de festivales: Crea un horario de artistas imprescindibles con anticipación, pero deja espacio para descubrimientos espontáneos. ¡Algunas de las mejores experiencias de festivales provienen de toparse con nuevos artistas!",
  "Al aprender solos difíciles, prueba la técnica de 'fragmentación' - divídelo en frases más pequeñas y practica cada una a un tempo lento antes de aumentar gradualmente la velocidad. Esto desarrolla la memoria muscular de manera más efectiva."
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
      // Generar 2-4 comentarios por post
      const commentCount = 2 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < commentCount; i++) {
        // Alternar entre usuarios normales y bots para los comentarios
        let user;
        let commentContent;
        
        if (i % 3 === 0 && botUsers.length > 0) {
          // Usar un bot para este comentario
          const randomIndex = Math.floor(Math.random() * botUsers.length);
          user = botUsers[randomIndex];
          commentContent = botCommentsEn[Math.floor(Math.random() * botCommentsEn.length)];
        } else {
          // Usar un usuario normal
          const randomIndex = Math.floor(Math.random() * englishUsers.length);
          user = englishUsers[randomIndex];
          commentContent = commentsEn[Math.floor(Math.random() * commentsEn.length)];
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
      // Generar 2-4 comentarios por post
      const commentCount = 2 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < commentCount; i++) {
        // Alternar entre usuarios normales y bots para los comentarios
        let user;
        let commentContent;
        
        if (i % 3 === 0 && botUsers.length > 0) {
          // Usar un bot para este comentario
          const randomIndex = Math.floor(Math.random() * botUsers.length);
          user = botUsers[randomIndex];
          commentContent = botCommentsEs[Math.floor(Math.random() * botCommentsEs.length)];
        } else {
          // Usar un usuario normal
          const randomIndex = Math.floor(Math.random() * spanishUsers.length);
          user = spanishUsers[randomIndex];
          commentContent = commentsEs[Math.floor(Math.random() * commentsEs.length)];
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