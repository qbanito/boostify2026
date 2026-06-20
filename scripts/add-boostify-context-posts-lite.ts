/**
 * Versión ligera del script para añadir posts sobre Boostify
 * Se enfoca solo en crear algunos posts clave
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Selección reducida de posts en inglés sobre las herramientas de Boostify
const boostifyToolsPostsEn = [
  "Just tried Boostify's AI-powered music mastering tool and I'm blown away! My track sounds so much cleaner and balanced now. Has anyone else experienced similar results with the mastering tools?",
  
  "Boostify's chord progression generator just helped me break through a massive creative block. Fed it a simple melody and it suggested harmonies I wouldn't have thought of. Game changer for songwriters!",
  
  "The new artist promotion tools on Boostify have increased my Spotify streams by 30% in just two weeks. The targeted playlist submission feature is especially effective. What promotion strategies work best for you all?",
  
  "Boostify's music career dashboard has completely changed how I track my progress as an independent artist. Being able to see all my streaming, social, and revenue metrics in one place makes planning so much easier.",
  
  "The new music educational platform on Boostify is fantastic for improving my production skills. The interactive courses on sound design have helped me develop a much more distinctive style. What courses have you found most useful?"
];

// Selección reducida de posts en español sobre las herramientas de Boostify
const boostifyToolsPostsEs = [
  "¡Acabo de probar la herramienta de masterización con IA de Boostify y estoy impresionado! Mi pista suena mucho más limpia y equilibrada ahora. ¿Alguien más ha experimentado resultados similares con las herramientas de masterización?",
  
  "El generador de progresiones de acordes de Boostify me acaba de ayudar a superar un enorme bloqueo creativo. Le di una melodía simple y sugirió armonías en las que no habría pensado. ¡Un cambio de juego para los compositores!",
  
  "Las nuevas herramientas de promoción de artistas en Boostify han aumentado mis reproducciones en Spotify un 30% en solo dos semanas. La función de envío a listas de reproducción dirigidas es especialmente efectiva. ¿Qué estrategias de promoción funcionan mejor para ustedes?",
  
  "El panel de control de carrera musical de Boostify ha cambiado completamente la forma en que sigo mi progreso como artista independiente. Poder ver todas mis métricas de streaming, redes sociales e ingresos en un solo lugar hace que la planificación sea mucho más fácil.",
  
  "La nueva plataforma educativa musical en Boostify es fantástica para mejorar mis habilidades de producción. Los cursos interactivos sobre diseño de sonido me han ayudado a desarrollar un estilo mucho más distintivo. ¿Qué cursos has encontrado más útiles?"
];

// Comentarios específicos sobre Boostify 
const boostifyComments = [
  "I've been using Boostify's vocal processing chain for almost a year now. The clarity and depth it adds to my recordings is remarkable - totally transformed my home studio sound.",
  
  "The social network feature on Boostify has connected me with three collaborators who I'm now working with regularly. The genre-matching algorithm is surprisingly accurate.",
  
  "Boostify's distribution service got my tracks on all major platforms within 48 hours, and their royalty tracking is so transparent compared to others I've used.",
  
  "The interactive music theory tutorials on Boostify taught me more in a month than I learned in a year of traditional lessons. The real-time feedback on practice exercises is fantastic.",
  
  "Boostify's marketing tools helped me target my ad spend much more effectively. The demographic analysis of my listeners saved me from wasting budget on the wrong audience."
];

// Comentarios específicos sobre Boostify en español
const boostifyCommentsEs = [
  "He estado usando la cadena de procesamiento vocal de Boostify durante casi un año. La claridad y profundidad que añade a mis grabaciones es notable - transformó totalmente el sonido de mi estudio casero.",
  
  "La función de red social en Boostify me ha conectado con tres colaboradores con los que ahora trabajo regularmente. El algoritmo de emparejamiento por género es sorprendentemente preciso.",
  
  "El servicio de distribución de Boostify puso mis pistas en todas las plataformas principales en 48 horas, y su seguimiento de regalías es muy transparente en comparación con otros que he usado.",
  
  "Los tutoriales interactivos de teoría musical en Boostify me enseñaron más en un mes de lo que aprendí en un año de lecciones tradicionales. La retroalimentación en tiempo real sobre los ejercicios prácticos es fantástica.",
  
  "Las herramientas de marketing de Boostify me ayudaron a dirigir mi gasto en publicidad de manera mucho más efectiva. El análisis demográfico de mis oyentes me evitó gastar presupuesto en la audiencia equivocada."
];

/**
 * Selecciona aleatoriamente un usuario que hable el idioma especificado
 */
async function getRandomUser(language: 'en' | 'es'): Promise<any> {
  const usersSnapshot = await db.collection('social_users')
    .where('language', '==', language)
    .where('isBot', '==', false)
    .get();
  
  if (usersSnapshot.empty) {
    throw new Error(`No se encontraron usuarios con idioma ${language}`);
  }
  
  const users = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Seleccionar un usuario aleatorio
  return users[Math.floor(Math.random() * users.length)];
}

/**
 * Crea posts específicos sobre Boostify y sus herramientas
 */
async function createBoostifyContextPosts() {
  console.log("🔄 Creando posts sobre Boostify y sus herramientas...");
  
  // Crear posts en inglés
  for (const post of boostifyToolsPostsEn) {
    const user = await getRandomUser('en');
    
    // Fecha ligeramente aleatoria en los últimos 7 días
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(date.getHours() - hoursAgo);
    
    // Crear post
    const postRef = await db.collection('social_posts').add({
      userId: user.id,
      content: post,
      likes: Math.floor(Math.random() * 20),
      createdAt: Timestamp.fromDate(date),
      updatedAt: Timestamp.fromDate(date)
    });
    
    console.log(`✅ Post sobre Boostify (EN) creado por ${user.displayName}`);
    
    // Agregar 1-2 comentarios a este post
    await addBoostifyComments(postRef.id, 'en', 1 + Math.floor(Math.random() * 2));
  }
  
  // Crear posts en español
  for (const post of boostifyToolsPostsEs) {
    const user = await getRandomUser('es');
    
    // Fecha ligeramente aleatoria en los últimos 7 días
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(date.getHours() - hoursAgo);
    
    // Crear post
    const postRef = await db.collection('social_posts').add({
      userId: user.id,
      content: post,
      likes: Math.floor(Math.random() * 20),
      createdAt: Timestamp.fromDate(date),
      updatedAt: Timestamp.fromDate(date)
    });
    
    console.log(`✅ Post sobre Boostify (ES) creado por ${user.displayName}`);
    
    // Agregar 1-2 comentarios a este post
    await addBoostifyComments(postRef.id, 'es', 1 + Math.floor(Math.random() * 2));
  }
}

/**
 * Agrega comentarios relacionados con Boostify a un post específico
 */
async function addBoostifyComments(postId: string, language: 'en' | 'es', count: number) {
  // Obtener post
  const postDoc = await db.collection('social_posts').doc(postId).get();
  const postData = postDoc.data();
  if (!postData) return;
  
  // Comentarios según idioma
  const comments = language === 'en' ? boostifyComments : boostifyCommentsEs;
  
  // Agregar comentarios
  for (let i = 0; i < count; i++) {
    // Obtener usuario aleatorio
    const user = await getRandomUser(language);
    
    // Seleccionar comentario aleatorio
    const commentContent = comments[Math.floor(Math.random() * comments.length)];
    
    // Crear fecha (después de la del post)
    const postDate = postData.createdAt.toDate();
    const hoursAfter = Math.floor(Math.random() * 24); // Entre 0 y 24 horas después
    const commentDate = new Date(postDate.getTime() + hoursAfter * 60 * 60 * 1000);
    
    // Crear comentario
    await db.collection('social_comments').add({
      userId: user.id,
      postId: postId,
      content: commentContent,
      likes: Math.floor(Math.random() * 10),
      isReply: false,
      parentId: null,
      createdAt: Timestamp.fromDate(commentDate),
      updatedAt: Timestamp.fromDate(commentDate)
    });
    
    console.log(`  ✅ Comentario sobre Boostify añadido por ${user.displayName}`);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Iniciando adición de contexto sobre Boostify (versión lite)...");
    
    // Crear posts específicos sobre herramientas de Boostify
    await createBoostifyContextPosts();
    
    console.log("🎉 Proceso completado: contexto de Boostify añadido a la red social.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();