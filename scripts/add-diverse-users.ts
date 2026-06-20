/**
 * Script para añadir 20 usuarios diversos a la red social con más interacciones aleatorias
 * Incrementa la diversidad de usuarios, posts y comentarios para una experiencia más rica
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { faker } from '@faker-js/faker';

// Lista de nombres variados internacionalmente
const diverseNames = [
  // Nombres en inglés
  { name: "Alex Rivera", language: "en" },
  { name: "Jamal Wilson", language: "en" },
  { name: "Samantha Lee", language: "en" },
  { name: "Ryan Patel", language: "en" },
  { name: "Zoe Mitchell", language: "en" },
  { name: "Malik Johnson", language: "en" },
  { name: "Aisha Khan", language: "en" },
  { name: "Diego Reyes", language: "en" },
  { name: "Leila Sharma", language: "en" },
  { name: "Kwame Osei", language: "en" },
  
  // Nombres en español
  { name: "Lucía Fernández", language: "es" },
  { name: "Javier Rodríguez", language: "es" },
  { name: "Isabella Morales", language: "es" },
  { name: "Mateo Herrera", language: "es" },
  { name: "Valentina Torres", language: "es" },
  { name: "Eduardo López", language: "es" },
  { name: "Camila Ortiz", language: "es" },
  { name: "Gabriel Sánchez", language: "es" },
  { name: "Sofía Ramírez", language: "es" },
  { name: "Alejandro Díaz", language: "es" }
];

// Intereses musicales diversos
const englishMusicInterests = [
  "Jazz", "Hip-hop", "Classical piano", "EDM production", "Indie rock", 
  "Music theory", "Guitar techniques", "Music history", "Vinyl collecting", 
  "Live performance", "Music production", "Songwriting", "Music marketing",
  "Blues", "Soul", "R&B", "Country", "Folk", "Pop music", "Rock classics",
  "Synthesizers", "Beat making", "Music technology", "Orchestra", "Drum techniques"
];

const spanishMusicInterests = [
  "Flamenco", "Reggaetón", "Salsa", "Cumbia", "Música clásica", 
  "Producción musical", "Teoría musical", "Historia de la música latina", 
  "Guitarra española", "Percusión latina", "Composición", "Bachata",
  "Tango", "Música folclórica", "Jazz latino", "Música electrónica", 
  "Rock en español", "Pop latino", "Merengue", "Música andina",
  "Música tropical", "Instrumentos de cuerda", "Canto", "Bossa nova"
];

// Personalidades diversas
const englishPersonalities = [
  "Passionate about music production and always experimenting with new sounds",
  "Professional classical pianist with a love for teaching music theory",
  "Hip-hop enthusiast and aspiring beatmaker with a unique style",
  "Music journalist documenting the evolving indie music scene",
  "Experimental electronic music producer pushing creative boundaries",
  "Professional drummer with experience in various music genres",
  "Folk music collector and preserver of traditional songs",
  "Audio engineer sharing insights about studio recording techniques",
  "Music therapist using music to promote mental wellbeing",
  "Vintage instrument collector and music history enthusiast"
];

const spanishPersonalities = [
  "Productor de flamenco fusión con influencias contemporáneas",
  "Guitarrista clásico dedicado a la enseñanza musical",
  "Compositor de música latina con experiencia en bandas sonoras",
  "DJ especializado en la mezcla de ritmos tradicionales y electrónicos",
  "Violinista profesional con pasión por la música clásica y contemporánea",
  "Cantautor que combina letras poéticas con melodías populares",
  "Percusionista experto en ritmos afrocaribeños y latinos",
  "Profesor de teoría musical especializado en armonía avanzada",
  "Coleccionista de instrumentos tradicionales latinoamericanos",
  "Musicólogo especializado en la evolución de la música latinoamericana"
];

// Posts específicos sobre música (más variados)
const englishMusicPosts = [
  "Finally mastered that complex jazz chord progression I've been working on for weeks! Any other jazz musicians here with tips on improvisation?",
  "What's your favorite DAW for producing hip-hop beats? I've been using FL Studio but considering switching to Ableton for workflow reasons.",
  "Just discovered the amazing world of music from Mali - artists like Ali Farka Touré and Tinariwen are blowing my mind! Any recommendations for similar artists?",
  "Started transcribing solos from my favorite guitarists as a practice exercise. It's challenging but so rewarding for developing my ear!",
  "Opinions on modern music production? Is it getting too formulaic or is the democratization of production tools leading to more innovation?",
  "What classical pieces would you recommend for an intermediate piano player looking to improve technique?",
  "How do you overcome creative blocks when composing? Been staring at an empty project for days and could use some inspiration.",
  "Just picked up a vintage synth from the 80s and having so much fun exploring analog sound design. What's your favorite hardware instrument?",
  "The local underground music scene is thriving right now! Went to an incredible show last night with three bands I'd never heard before.",
  "Anyone experimenting with microtonal music? I'm fascinated by intervals outside the standard Western 12-tone system.",
  "What are your thoughts on AI in music? Just tried some AI-assisted composition tools and was surprised by the results.",
  "Music theory question: how do you approach modulations between distant keys in your compositions?",
  "Looking for recommendations on books about music history, particularly focused on the evolution of electronic music in the 90s.",
  "Just built my first home studio space with acoustic treatment! Any tips for getting the best recordings in a small room?",
  "Do you think formal music education is necessary for success in the industry today? Or is self-teaching a viable path?",
  "What's your process for mixing vocals? Always struggling to get them to sit right in my mixes.",
  "Anyone else obsessed with collecting vinyl? Just found a rare pressing of a favorite album at a local shop!",
  "How do you approach collaboration with other musicians remotely? What tools and workflows have worked for you?",
  "Been experimenting with field recordings in my music lately. The sounds of the city create such interesting textures.",
  "What music documentaries would you recommend to someone wanting to learn more about the history of rock?"
];

const spanishMusicPosts = [
  "¡Finalmente dominé esa compleja progresión de acordes de jazz en la que he estado trabajando durante semanas! ¿Hay otros músicos de jazz aquí con consejos sobre improvisación?",
  "¿Cuál es tu DAW favorito para producir beats de hip-hop? He estado usando FL Studio pero estoy considerando cambiar a Ableton por razones de flujo de trabajo.",
  "Acabo de descubrir el increíble mundo de la música de Mali - ¡artistas como Ali Farka Touré y Tinariwen me están sorprendiendo! ¿Alguna recomendación de artistas similares?",
  "Comencé a transcribir solos de mis guitarristas favoritos como ejercicio de práctica. ¡Es desafiante pero muy gratificante para desarrollar mi oído!",
  "¿Opiniones sobre la producción musical moderna? ¿Se está volviendo demasiado formulaica o la democratización de las herramientas de producción está llevando a más innovación?",
  "¿Qué piezas clásicas recomendarías a un pianista de nivel intermedio que busca mejorar su técnica?",
  "¿Cómo superas los bloqueos creativos al componer? He estado mirando un proyecto vacío durante días y necesito algo de inspiración.",
  "Acabo de comprar un sintetizador vintage de los años 80 y me estoy divirtiendo mucho explorando el diseño de sonido analógico. ¿Cuál es tu instrumento de hardware favorito?",
  "¡La escena musical underground local está prosperando ahora mismo! Fui a un concierto increíble anoche con tres bandas que nunca había escuchado antes.",
  "¿Alguien está experimentando con música microtonal? Me fascinan los intervalos fuera del sistema estándar occidental de 12 tonos.",
  "¿Qué piensas sobre la IA en la música? Acabo de probar algunas herramientas de composición asistida por IA y me sorprendieron los resultados.",
  "Pregunta de teoría musical: ¿cómo abordas las modulaciones entre tonalidades distantes en tus composiciones?",
  "Busco recomendaciones de libros sobre historia de la música, particularmente enfocados en la evolución de la música electrónica en los años 90.",
  "¡Acabo de construir mi primer estudio casero con tratamiento acústico! ¿Algún consejo para obtener las mejores grabaciones en una habitación pequeña?",
  "¿Crees que la educación musical formal es necesaria para tener éxito en la industria actual? ¿O el autoaprendizaje es un camino viable?",
  "¿Cuál es tu proceso para mezclar voces? Siempre me cuesta conseguir que encajen bien en mis mezclas.",
  "¿Alguien más obsesionado con coleccionar vinilos? ¡Acabo de encontrar una edición rara de un álbum favorito en una tienda local!",
  "¿Cómo abordas la colaboración con otros músicos de forma remota? ¿Qué herramientas y flujos de trabajo te han funcionado?",
  "He estado experimentando con grabaciones de campo en mi música últimamente. Los sonidos de la ciudad crean texturas muy interesantes.",
  "¿Qué documentales musicales recomendarías a alguien que quiere aprender más sobre la historia del rock?"
];

// Comentarios más diversos y específicos
const englishComments = [
  "I've found that transcribing Miles Davis solos really helped improve my sense of jazz phrasing and timing.",
  "You should definitely check out Toumani Diabaté if you're getting into Malian music - his kora playing is mesmerizing!",
  "For remote collaboration, we've been using Audiomovers with Reaper and it's been a game changer for real-time feedback.",
  "Have you tried modular synthesis? It completely changed my approach to sound design and composition.",
  "I'm self-taught and have been working professionally for years. Formal education helps, but passion and practice matter more.",
  "For vocal mixing, I always start with subtractive EQ, then compression, then additive EQ. Layering reverbs (short and long) creates nice depth too.",
  "The 'Bass, the final frontier' documentary changed my understanding of how foundational bass is in different music cultures.",
  "Try adding some randomization to your MIDI velocities and timing to make programmed drums sound more human and natural.",
  "I recommend 'Ocean of Sound' by David Toop if you want to understand ambient and experimental music evolution.",
  "A good pop song is all about the hook - I spend more time perfecting my choruses than any other part of my songs.",
  "When recording acoustic guitar, try using two mics - one pointed at the 12th fret and one at the bridge, then blend to taste.",
  "My breakthrough with writer's block came when I started imposing limitations - like using only three chords or one instrument.",
  "For piano technique improvement, Hanon exercises changed my playing dramatically in just a few months of consistent practice.",
  "I think listening critically to music outside your comfort zone is the best education you can get as a musician.",
  "Jazz isn't dead - it's evolved into so many incredible hybrid forms. Check out Kamasi Washington and the LA scene.",
  "The democratization of music production tools has been revolutionary, but it makes standing out much harder.",
  "Small room recording tip: create a makeshift vocal booth with moving blankets and try recording in your closet for dry vocals.",
  "Try the 'rule of three' for arrangements: introduce something new at least every three bars to maintain interest.",
  "For creative inspiration, I've started setting my synths up before bed, then recording first thing in the morning when my mind is fresh.",
  "When blending electronic and acoustic elements, try using subtle sidechaining to create space for each element."
];

const spanishComments = [
  "He descubierto que transcribir solos de Miles Davis realmente ayudó a mejorar mi sentido del fraseo y timing en el jazz.",
  "Definitivamente deberías escuchar a Toumani Diabaté si te estás adentrando en la música de Mali - su forma de tocar la kora es hipnotizante.",
  "Para colaboración remota, hemos estado usando Audiomovers con Reaper y ha sido un cambio radical para retroalimentación en tiempo real.",
  "¿Has probado la síntesis modular? Cambió completamente mi enfoque del diseño de sonido y la composición.",
  "Soy autodidacta y he estado trabajando profesionalmente durante años. La educación formal ayuda, pero la pasión y la práctica importan más.",
  "Para mezclar voces, siempre comienzo con EQ sustractivo, luego compresión, luego EQ aditivo. Superponer reverbs (corta y larga) crea una buena profundidad también.",
  "El documental 'Bass, the final frontier' cambió mi comprensión de lo fundamental que es el bajo en diferentes culturas musicales.",
  "Intenta añadir algo de aleatorización a tus velocidades MIDI y timing para hacer que la batería programada suene más humana y natural.",
  "Recomiendo 'Ocean of Sound' de David Toop si quieres entender la evolución de la música ambient y experimental.",
  "Una buena canción pop se trata del gancho - paso más tiempo perfeccionando mis estribillos que cualquier otra parte de mis canciones.",
  "Al grabar guitarra acústica, prueba usando dos micrófonos - uno apuntando al traste 12 y otro al puente, luego mezcla a gusto.",
  "Mi avance con el bloqueo creativo llegó cuando comencé a imponer limitaciones - como usar solo tres acordes o un instrumento.",
  "Para mejorar la técnica de piano, los ejercicios de Hanon cambiaron mi forma de tocar dramáticamente en solo unos meses de práctica constante.",
  "Creo que escuchar críticamente música fuera de tu zona de confort es la mejor educación que puedes obtener como músico.",
  "El jazz no está muerto - ha evolucionado en tantas formas híbridas increíbles. Echa un vistazo a Kamasi Washington y la escena de LA.",
  "La democratización de las herramientas de producción musical ha sido revolucionaria, pero hace que destacar sea mucho más difícil.",
  "Consejo para grabar en habitaciones pequeñas: crea una cabina vocal improvisada con mantas y prueba grabar en tu armario para voces secas.",
  "Prueba la 'regla de tres' para arreglos: introduce algo nuevo al menos cada tres compases para mantener el interés.",
  "Para inspiración creativa, he comenzado a configurar mis sintetizadores antes de acostarme, luego grabo a primera hora de la mañana cuando mi mente está fresca.",
  "Al mezclar elementos electrónicos y acústicos, prueba usar sidechain sutil para crear espacio para cada elemento."
];

/**
 * Genera una URL de avatar consistente para un usuario basada en su nombre
 */
function generateFakerAvatar(name: string): string {
  // Usar el nombre como semilla para generar el mismo avatar siempre
  const seed = name.toLowerCase().replace(/\s+/g, '');
  
  // Configurar faker con la semilla para consistencia
  faker.seed(hashString(seed));
  
  // Generar un avatar de persona
  return faker.image.avatar();
}

/**
 * Función para convertir un string en un número para seed
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a entero de 32 bits
  }
  return Math.abs(hash);
}

/**
 * Selecciona aleatoriamente N elementos de un array
 */
function getRandomElements<T>(array: T[], n: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

/**
 * Crea usuarios diversos en la red social
 */
async function createDiverseUsers() {
  console.log("🔄 Creando usuarios diversos...");
  
  const userIds: string[] = [];
  
  // Crear cada usuario con perfil detallado
  for (const user of diverseNames) {
    // Seleccionar intereses aleatorios según el idioma
    const interests = user.language === 'en' 
      ? getRandomElements(englishMusicInterests, 3 + Math.floor(Math.random() * 5))
      : getRandomElements(spanishMusicInterests, 3 + Math.floor(Math.random() * 5));
    
    // Seleccionar personalidad según el idioma
    const personality = user.language === 'en'
      ? englishPersonalities[Math.floor(Math.random() * englishPersonalities.length)]
      : spanishPersonalities[Math.floor(Math.random() * spanishPersonalities.length)];
    
    // Generar biografía aleatoria basada en los intereses
    const bioPrefix = user.language === 'en' 
      ? "Music enthusiast focused on " 
      : "Entusiasta musical enfocado en ";
    
    const bio = bioPrefix + interests.join(", ") + ".";
    
    // Fecha actual
    const now = new Date();
    
    // Crear documento de usuario en Firestore
    const userRef = await db.collection('social_users').add({
      displayName: user.name,
      avatar: generateFakerAvatar(user.name),
      bio: bio,
      interests: interests,
      language: user.language,
      isBot: false,
      personality: personality,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now)
    });
    
    userIds.push(userRef.id);
    console.log(`✅ Usuario creado: ${user.name} (${user.language})`);
  }
  
  console.log(`🎉 Creados ${userIds.length} usuarios diversos.`);
  return userIds;
}

/**
 * Crea posts de música para los usuarios
 */
async function createMusicPosts(userIds: string[]) {
  console.log("🔄 Creando posts musicales diversos...");
  
  // Obtener usuarios existentes para determinar su idioma
  const userDocs = await Promise.all(
    userIds.map(id => db.collection('social_users').doc(id).get())
  );
  
  const users = userDocs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  
  const englishUsers = users.filter(user => user.language === 'en');
  const spanishUsers = users.filter(user => user.language === 'es');
  
  const postIds: string[] = [];
  
  // Crear posts en inglés
  for (const post of englishMusicPosts) {
    // Seleccionar usuario aleatorio que hable inglés
    const user = englishUsers[Math.floor(Math.random() * englishUsers.length)];
    
    // Fecha ligeramente aleatoria en las últimas 2 semanas
    const daysAgo = Math.floor(Math.random() * 14);
    const hoursAgo = Math.floor(Math.random() * 24);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(date.getHours() - hoursAgo);
    
    // Crear post
    const postRef = await db.collection('social_posts').add({
      userId: user.id,
      content: post,
      likes: Math.floor(Math.random() * 15),
      createdAt: Timestamp.fromDate(date),
      updatedAt: Timestamp.fromDate(date)
    });
    
    postIds.push(postRef.id);
    console.log(`✅ Post creado en inglés por ${user.displayName}`);
  }
  
  // Crear posts en español
  for (const post of spanishMusicPosts) {
    // Seleccionar usuario aleatorio que hable español
    const user = spanishUsers[Math.floor(Math.random() * spanishUsers.length)];
    
    // Fecha ligeramente aleatoria en las últimas 2 semanas
    const daysAgo = Math.floor(Math.random() * 14);
    const hoursAgo = Math.floor(Math.random() * 24);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(date.getHours() - hoursAgo);
    
    // Crear post
    const postRef = await db.collection('social_posts').add({
      userId: user.id,
      content: post,
      likes: Math.floor(Math.random() * 15),
      createdAt: Timestamp.fromDate(date),
      updatedAt: Timestamp.fromDate(date)
    });
    
    postIds.push(postRef.id);
    console.log(`✅ Post creado en español por ${user.displayName}`);
  }
  
  console.log(`🎉 Creados ${postIds.length} posts musicales diversos.`);
  return postIds;
}

/**
 * Crea comentarios significativos en los posts
 */
async function createMeaningfulComments(userIds: string[]) {
  console.log("🔄 Creando comentarios significativos...");
  
  // Obtener todos los usuarios
  const userDocs = await Promise.all(
    userIds.map(id => db.collection('social_users').doc(id).get())
  );
  
  const users = userDocs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  
  // Obtener todos los usuarios incluyendo los existentes
  const allUsersSnapshot = await db.collection('social_users').get();
  const allUsers = allUsersSnapshot.docs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  
  // Separar usuarios por idioma
  const englishUsers = allUsers.filter(user => user.language === 'en');
  const spanishUsers = allUsers.filter(user => user.language === 'es');
  
  // Obtener todos los posts
  const postsSnapshot = await db.collection('social_posts').get();
  const posts = postsSnapshot.docs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  
  // Filtrar posts por idioma (basado en el usuario que lo creó)
  const englishPosts: any[] = [];
  const spanishPosts: any[] = [];
  
  for (const post of posts) {
    const postUser = allUsers.find(u => u.id === post.userId);
    if (postUser) {
      if (postUser.language === 'en') {
        englishPosts.push(post);
      } else {
        spanishPosts.push(post);
      }
    }
  }
  
  console.log(`Encontrados ${englishPosts.length} posts en inglés y ${spanishPosts.length} posts en español.`);
  
  let commentCount = 0;
  
  // Crear comentarios para posts en inglés
  for (const post of englishPosts) {
    // Determinar número aleatorio de comentarios por post (1-5)
    const numComments = 1 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numComments; i++) {
      // Seleccionar usuario aleatorio que hable inglés
      const user = englishUsers[Math.floor(Math.random() * englishUsers.length)];
      
      // Seleccionar comentario aleatorio en inglés
      const commentContent = englishComments[Math.floor(Math.random() * englishComments.length)];
      
      // Fecha ligeramente posterior a la del post
      const postDate = post.createdAt.toDate();
      const hoursAfter = Math.floor(Math.random() * 48); // Entre 0 y 48 horas después
      const commentDate = new Date(postDate.getTime() + hoursAfter * 60 * 60 * 1000);
      
      // Crear comentario
      await db.collection('social_comments').add({
        userId: user.id,
        postId: post.id,
        content: commentContent,
        likes: Math.floor(Math.random() * 10),
        isReply: false,
        parentId: null,
        createdAt: Timestamp.fromDate(commentDate),
        updatedAt: Timestamp.fromDate(commentDate)
      });
      
      commentCount++;
      console.log(`  ✅ Comentario añadido a post en inglés por ${user.displayName}`);
    }
  }
  
  // Crear comentarios para posts en español
  for (const post of spanishPosts) {
    // Determinar número aleatorio de comentarios por post (1-5)
    const numComments = 1 + Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numComments; i++) {
      // Seleccionar usuario aleatorio que hable español
      const user = spanishUsers[Math.floor(Math.random() * spanishUsers.length)];
      
      // Seleccionar comentario aleatorio en español
      const commentContent = spanishComments[Math.floor(Math.random() * spanishComments.length)];
      
      // Fecha ligeramente posterior a la del post
      const postDate = post.createdAt.toDate();
      const hoursAfter = Math.floor(Math.random() * 48); // Entre 0 y 48 horas después
      const commentDate = new Date(postDate.getTime() + hoursAfter * 60 * 60 * 1000);
      
      // Crear comentario
      await db.collection('social_comments').add({
        userId: user.id,
        postId: post.id,
        content: commentContent,
        likes: Math.floor(Math.random() * 10),
        isReply: false,
        parentId: null,
        createdAt: Timestamp.fromDate(commentDate),
        updatedAt: Timestamp.fromDate(commentDate)
      });
      
      commentCount++;
      console.log(`  ✅ Comentario añadido a post en español por ${user.displayName}`);
    }
  }
  
  console.log(`🎉 Creados ${commentCount} comentarios significativos.`);
}

/**
 * Genera respuestas a comentarios para crear conversaciones
 */
async function createCommentReplies() {
  console.log("🔄 Creando respuestas a comentarios...");
  
  // Obtener todos los usuarios
  const usersSnapshot = await db.collection('social_users').get();
  const users = usersSnapshot.docs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  
  // Separar usuarios por idioma
  const englishUsers = users.filter(user => user.language === 'en');
  const spanishUsers = users.filter(user => user.language === 'es');
  
  // Obtener todos los comentarios
  const commentsSnapshot = await db.collection('social_comments').get();
  const comments = commentsSnapshot.docs.map(doc => {
    return { id: doc.id, ...doc.data() };
  });
  
  // Filtrar comentarios que no son respuestas
  const parentComments = comments.filter(comment => !comment.isReply);
  
  // Seleccionar aleatoriamente 30% de los comentarios para responder
  const commentsToReply = parentComments
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.floor(parentComments.length * 0.3));
  
  let replyCount = 0;
  
  for (const comment of commentsToReply) {
    // Obtener el post al que pertenece el comentario
    const postDoc = await db.collection('social_posts').doc(comment.postId).get();
    const post = postDoc.data();
    
    if (!post) continue;
    
    // Encontrar el usuario que creó el post para determinar el idioma
    const postUser = users.find(u => u.id === post.userId);
    if (!postUser) continue;
    
    // Seleccionar usuario aleatorio que hable el mismo idioma
    const userPool = postUser.language === 'en' ? englishUsers : spanishUsers;
    const user = userPool[Math.floor(Math.random() * userPool.length)];
    
    // Seleccionar contenido de respuesta según el idioma
    const replyPool = postUser.language === 'en' ? englishComments : spanishComments;
    const replyContent = "I agree with your point about " + replyPool[Math.floor(Math.random() * replyPool.length)].toLowerCase();
    
    // Fecha ligeramente posterior a la del comentario original
    const commentDate = comment.createdAt.toDate();
    const hoursAfter = Math.floor(Math.random() * 24); // Entre 0 y 24 horas después
    const replyDate = new Date(commentDate.getTime() + hoursAfter * 60 * 60 * 1000);
    
    // Crear respuesta al comentario
    await db.collection('social_comments').add({
      userId: user.id,
      postId: comment.postId,
      parentId: comment.id,
      content: replyContent,
      likes: Math.floor(Math.random() * 5),
      isReply: true,
      createdAt: Timestamp.fromDate(replyDate),
      updatedAt: Timestamp.fromDate(replyDate)
    });
    
    replyCount++;
    console.log(`  ✅ Respuesta a comentario creada por ${user.displayName}`);
  }
  
  console.log(`🎉 Creadas ${replyCount} respuestas a comentarios.`);
}

/**
 * Función principal para ejecutar el script
 */
async function main() {
  try {
    console.log("🚀 Iniciando creación de usuarios diversos e interacciones...");
    
    // Crear usuarios diversos
    const userIds = await createDiverseUsers();
    
    // Crear posts musicales
    const postIds = await createMusicPosts(userIds);
    
    // Crear comentarios significativos
    await createMeaningfulComments(userIds);
    
    // Crear respuestas a comentarios
    await createCommentReplies();
    
    console.log("✅ Proceso completado exitosamente. Red social enriquecida con usuarios e interacciones diversas.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();