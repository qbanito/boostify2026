/**
 * Script para generar 100 usuarios con posts y comentarios realistas
 * para simular una comunidad activa en la red social.
 */

import { db } from '../server/firebase';
import { firestoreSocialNetworkService } from '../server/services/firestore-social-network';
import { Timestamp } from 'firebase-admin/firestore';

// Nombres para usuarios en inglés
const englishFirstNames = [
  'Emma', 'Noah', 'Olivia', 'Liam', 'Ava', 'William', 'Sophia', 'Mason', 'Isabella', 'James',
  'Charlotte', 'Elijah', 'Amelia', 'Alexander', 'Mia', 'Benjamin', 'Harper', 'Michael', 'Evelyn', 'Daniel',
  'Abigail', 'Logan', 'Emily', 'Matthew', 'Elizabeth', 'Lucas', 'Sofia', 'Jackson', 'Avery', 'David',
  'Ella', 'Joseph', 'Scarlett', 'Samuel', 'Grace', 'Henry', 'Chloe', 'John', 'Victoria', 'Andrew'
];

const englishLastNames = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King',
  'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter'
];

// Nombres para usuarios en español
const spanishFirstNames = [
  'María', 'José', 'Ana', 'Juan', 'Carmen', 'Manuel', 'Laura', 'Antonio', 'Isabel', 'Francisco',
  'Elena', 'Carlos', 'Sofía', 'Javier', 'Pilar', 'Miguel', 'Teresa', 'David', 'Patricia', 'Rafael',
  'Cristina', 'Alejandro', 'Lucía', 'Pedro', 'Mónica', 'Roberto', 'Andrea', 'Fernando', 'Marta', 'Jorge',
  'Silvia', 'Alberto', 'Rosa', 'Daniel', 'Beatriz', 'Pablo', 'Nuria', 'Ángel', 'Raquel', 'Sergio'
];

const spanishLastNames = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
  'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina',
  'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Núñez'
];

// Personalidades para usuarios bot
const botPersonalities = [
  "Friendly music enthusiast who loves to share recommendations",
  "Knowledgeable producer who provides technical advice",
  "Supportive community member who encourages everyone's musical journey",
  "Industry insider with occasional insights about the business",
  "Curious newbie who asks thoughtful questions about music production",
  "Passionate vinyl collector with a love for analog sound",
  "Nostalgic music fan who often references classic albums",
  "Trend-focused analyst who spots emerging genres and artists",
  "Gear enthusiast who loves discussing equipment and setups",
  "Collaborative musician always looking for new project partners"
];

// Personalidades para usuarios bot en español
const spanishBotPersonalities = [
  "Entusiasta musical amigable que adora compartir recomendaciones",
  "Productor con conocimientos que brinda consejos técnicos",
  "Miembro solidario de la comunidad que anima el viaje musical de todos",
  "Persona del sector con visiones ocasionales sobre el negocio musical",
  "Principiante curioso que hace preguntas interesantes sobre producción musical",
  "Coleccionista apasionado de vinilos con amor por el sonido analógico",
  "Fan nostálgico de la música que a menudo hace referencia a álbumes clásicos",
  "Analista centrado en tendencias que detecta géneros y artistas emergentes",
  "Entusiasta del equipo que adora hablar de equipamiento y configuraciones",
  "Músico colaborativo siempre en busca de nuevos compañeros de proyecto"
];

// Intereses para usuarios
const englishInterests = [
  "Electronic Music Production", "Jazz", "Hip Hop", "Classical Composition",
  "Sound Design", "Mixing & Mastering", "Live Performance", "Music Theory",
  "Studio Recording", "Guitar", "Piano", "Singing", "Songwriting",
  "Audio Engineering", "Synthesizers", "Sampling", "Beat Making",
  "Drum Programming", "Orchestra", "Music Marketing", "DJ Techniques",
  "Film Scoring", "Music Licensing", "Music Business", "Music History"
];

const spanishInterests = [
  "Producción de Música Electrónica", "Jazz", "Hip Hop", "Composición Clásica",
  "Diseño de Sonido", "Mezcla y Masterización", "Actuación en Vivo", "Teoría Musical",
  "Grabación en Estudio", "Guitarra", "Piano", "Canto", "Composición",
  "Ingeniería de Audio", "Sintetizadores", "Sampleo", "Creación de Beats",
  "Programación de Batería", "Orquesta", "Marketing Musical", "Técnicas de DJ",
  "Música para Cine", "Licencias Musicales", "Negocio Musical", "Historia de la Música"
];

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
  
  "After years of producing electronic music, I've started to incorporate more live instruments into my tracks. The organic textures add so much depth and emotion.",
  
  "Studio organization tip: I've started color-coding all my tracks by instrument type, and it's made my workflow so much faster. Anyone else have organization tips?",
  
  "I've been diving deep into sound design lately. Creating unique textures from field recordings has completely transformed my production style.",
  
  "What's your favorite microphone for recording acoustic guitar? I've been using an SM57, but wondering if there's something better for capturing the natural resonance.",
  
  "Music theory question: How do you approach modulations in your compositions? I love the emotional shift of going from minor to the relative major.",
  
  "Just upgraded my home studio with acoustic treatment and the difference is incredible. If you're on the fence about investing in acoustic panels, DO IT.",
  
  "The line between genres continues to blur and I think it's fantastic. My latest project combines elements of jazz, electronic, and hip-hop. Anyone else experimenting with genre fusion?",
  
  "Finally took the plunge and invested in a quality audio interface. The reduction in latency and improved preamps have been game-changing for my recording process.",
  
  "What's your approach to writer's block? I've found that stepping completely away from music and engaging with other art forms helps reset my creative thinking.",
  
  "The importance of proper gain staging cannot be overstated. Spent the weekend revisiting some older projects and properly setting levels made mixing so much easier.",
  
  "Anyone else feel like they need to constantly battle the urge to keep adding more elements to a track? I'm learning that sometimes less really is more.",
  
  "Just released my new EP today! Six months of work, countless revisions, and a lot of late nights finally paid off. Link in comments if anyone wants to give it a listen.",
  
  "How do you all approach building dynamic arrangements? I've been studying some of my favorite tracks to understand how they maintain interest throughout.",
  
  "The recent vinyl revival has been amazing for independent artists. Just got my first 7\" pressed and the feeling of holding your music in physical form is unbeatable.",
  
  "Finding the right collaborators can completely transform your music. Working with a dedicated mixing engineer for the first time, and the quality difference is night and day.",
  
  "What's your preferred DAW and why? I've been a Logic user for years but considering exploring Ableton for its session view and performance capabilities."
];

// Contenido musical para posts en español
const spanishMusicPosts = [
  "¡Acabo de terminar de grabar una nueva pista! El proceso de mezcla llevó más tiempo del esperado, pero el resultado final suena increíble. No puedo esperar para compartirlo con todos ustedes la próxima semana.",
  
  "¿Qué monitores de estudio están usando todos? Estoy considerando actualizar mi configuración actual y me encantaría algunas recomendaciones basadas en experiencia.",
  
  "Ayer asistí a un taller sobre técnicas de producción musical. Aprender sobre compresión paralela cambió por completo mis pistas de batería. ¿Alguien más usa esta técnica?",
  
  "La transición de la distribución tradicional de música al streaming ha cambiado completamente la forma en que lanzamos música. Como artista independiente, me parece que lanzar singles con más frecuencia funciona mejor que los álbumes.",
  
  "He estado experimentando con compases inusuales últimamente. El 7/8 se siente sorprendentemente natural una vez que te acostumbras. ¿Cuál es tu canción favorita que no esté en 4/4?",
  
  "Pregunta para los compositores: ¿empiezan con letra, melodía o progresión de acordes? Siempre he sido una persona que comienza con acordes, pero estoy tratando de cambiar mi proceso.",
  
  "Acabo de descubrir este increíble plugin VST que simula perfectamente sintetizadores analógicos vintage. El sonido es increíblemente cálido y auténtico. Compartiré el nombre si alguien está interesado.",
  
  "La colaboración musical se ha vuelto mucho más fácil con la tecnología moderna. Actualmente estoy trabajando en una pista con un vocalista de Australia mientras yo estoy en España. ¡Internet es asombroso!",
  
  "¿Qué opináis sobre la IA en la producción musical? He probado algunos servicios de masterización con IA y me sorprendió la calidad. Sin embargo, sigo prefiriendo la masterización humana para lanzamientos importantes.",
  
  "Después de años produciendo música electrónica, he comenzado a incorporar más instrumentos en vivo en mis pistas. Las texturas orgánicas añaden mucha profundidad y emoción.",
  
  "Consejo de organización de estudio: he empezado a codificar por colores todas mis pistas según el tipo de instrumento, y ha hecho que mi flujo de trabajo sea mucho más rápido. ¿Alguien más tiene consejos de organización?",
  
  "Últimamente me he sumergido en el diseño de sonido. Crear texturas únicas a partir de grabaciones de campo ha transformado completamente mi estilo de producción.",
  
  "¿Cuál es tu micrófono favorito para grabar guitarra acústica? He estado usando un SM57, pero me pregunto si hay algo mejor para capturar la resonancia natural.",
  
  "Pregunta de teoría musical: ¿Cómo abordáis las modulaciones en vuestras composiciones? Me encanta el cambio emocional de pasar de menor a su relativo mayor.",
  
  "Acabo de mejorar mi estudio casero con tratamiento acústico y la diferencia es increíble. Si estáis dudando sobre invertir en paneles acústicos, HACEDLO.",
  
  "La línea entre géneros sigue difuminándose y creo que es fantástico. Mi último proyecto combina elementos de jazz, electrónica y hip-hop. ¿Alguien más experimenta con la fusión de géneros?",
  
  "Finalmente me decidí e invertí en una interfaz de audio de calidad. La reducción de latencia y los preamplificadores mejorados han sido revolucionarios para mi proceso de grabación.",
  
  "¿Cuál es vuestro enfoque para el bloqueo creativo? He descubierto que alejarme completamente de la música y relacionarme con otras formas de arte ayuda a reiniciar mi pensamiento creativo.",
  
  "La importancia de una correcta organización de ganancia no puede ser subestimada. Pasé el fin de semana revisando algunos proyectos antiguos y configurar adecuadamente los niveles hizo que la mezcla fuera mucho más fácil.",
  
  "¿Alguien más siente que constantemente debe luchar contra el impulso de seguir añadiendo más elementos a una pista? Estoy aprendiendo que a veces menos es más.",
  
  "¡Acabo de lanzar mi nuevo EP hoy! Seis meses de trabajo, innumerables revisiones y muchas noches en vela finalmente dieron sus frutos. Enlace en comentarios si alguien quiere escucharlo.",
  
  "¿Cómo abordáis todos la construcción de arreglos dinámicos? He estado estudiando algunas de mis pistas favoritas para entender cómo mantienen el interés a lo largo de toda la canción.",
  
  "El reciente resurgimiento del vinilo ha sido increíble para los artistas independientes. Acabo de prensar mi primer vinilo de 7\" y la sensación de tener tu música en forma física es inmejorable.",
  
  "Encontrar los colaboradores adecuados puede transformar completamente tu música. Trabajando con un ingeniero de mezcla dedicado por primera vez, y la diferencia de calidad es como de la noche al día.",
  
  "¿Cuál es tu DAW preferido y por qué? He sido usuario de Logic durante años pero estoy considerando explorar Ableton por su vista de sesión y capacidades de interpretación en vivo."
];

// Contenido para comentarios en inglés
const englishMusicComments = [
  "I completely agree! Your insights on music production are spot on.",
  
  "This is such a great point. I've been thinking about this a lot lately with my own music.",
  
  "Have you tried experimenting with different DAWs? I switched to Ableton last year and it changed my workflow completely.",
  
  "The melody in your latest track is absolutely incredible. Mind sharing some of your composition process?",
  
  "I've been struggling with this exact issue! Thanks for sharing your experience.",
  
  "This reminds me of a technique I learned at a production workshop last month. Total game-changer.",
  
  "What VST plugins are you using these days? Always looking for recommendations!",
  
  "Your approach to music marketing is so refreshing compared to what I usually see.",
  
  "I'd love to collaborate on something. Your style would complement my production perfectly.",
  
  "Do you have any tips for someone just starting out with music production? Your work is inspiring.",
  
  "I had a similar experience when I was working on my last EP. It's amazing how these small details can make such a big difference.",
  
  "That's exactly what I needed to hear right now. Been stuck in a creative rut for weeks.",
  
  "Have you considered uploading your tutorials to YouTube? Your explanations are always so clear and helpful.",
  
  "What sample packs do you recommend for this style? Been looking to expand my sound library.",
  
  "Just listened to the track you linked and it's fantastic! The sound design is next level.",
  
  "How do you approach mixing vocals? They sit so perfectly in your mixes.",
  
  "Going to try this technique tomorrow. Will let you know how it works out!",
  
  "The arrangement in your latest release is so dynamic. Never gets boring even after multiple listens.",
  
  "Do you work with a mastering engineer or handle that yourself? Your masters sound so professional.",
  
  "This community has been such a valuable resource for me. Thanks for consistently sharing your knowledge.",
  
  "Just picked up that synth you recommended and you were right – absolutely game-changing for my productions!",
  
  "Have you presented at any music production conferences? You'd be a great speaker with all this knowledge.",
  
  "How do you balance your creative process with the business side of music? Always struggle with that myself.",
  
  "The acoustic treatment made a huge difference in my studio too. Wish I'd done it years ago!",
  
  "Do you think hardware synths are still worth the investment in today's software-dominated world?"
];

// Contenido para comentarios en español
const spanishMusicComments = [
  "¡Estoy completamente de acuerdo! Tus perspectivas sobre producción musical dan en el clavo.",
  
  "Este es un gran punto. He estado pensando mucho en esto últimamente con mi propia música.",
  
  "¿Has probado a experimentar con diferentes DAWs? Cambié a Ableton el año pasado y transformó mi flujo de trabajo completamente.",
  
  "La melodía en tu última pista es absolutamente increíble. ¿Te importaría compartir algo de tu proceso de composición?",
  
  "¡He estado luchando con exactamente este problema! Gracias por compartir tu experiencia.",
  
  "Esto me recuerda a una técnica que aprendí en un taller de producción el mes pasado. Completamente revolucionario.",
  
  "¿Qué plugins VST estás usando últimamente? ¡Siempre busco recomendaciones!",
  
  "Tu enfoque del marketing musical es tan refrescante comparado con lo que suelo ver.",
  
  "Me encantaría colaborar en algo. Tu estilo complementaría perfectamente mi producción.",
  
  "¿Tienes algún consejo para alguien que está empezando con la producción musical? Tu trabajo es inspirador.",
  
  "Tuve una experiencia similar cuando estaba trabajando en mi último EP. Es increíble cómo estos pequeños detalles pueden marcar una gran diferencia.",
  
  "Eso es exactamente lo que necesitaba escuchar ahora mismo. He estado en un bache creativo durante semanas.",
  
  "¿Has considerado subir tus tutoriales a YouTube? Tus explicaciones son siempre tan claras y útiles.",
  
  "¿Qué paquetes de samples recomiendas para este estilo? He estado buscando expandir mi biblioteca de sonidos.",
  
  "Acabo de escuchar la pista que enlazaste y es fantástica! El diseño de sonido está a otro nivel.",
  
  "¿Cómo enfocas la mezcla de voces? Se sientan perfectamente en tus mezclas.",
  
  "Voy a probar esta técnica mañana. ¡Te contaré cómo funciona!",
  
  "El arreglo en tu último lanzamiento es tan dinámico. Nunca se vuelve aburrido incluso después de varias escuchas.",
  
  "¿Trabajas con un ingeniero de masterización o lo manejas tú mismo? Tus masters suenan muy profesionales.",
  
  "Esta comunidad ha sido un recurso tan valioso para mí. Gracias por compartir constantemente tu conocimiento.",
  
  "Acabo de conseguir ese sintetizador que recomendaste y tenías razón – ¡absolutamente revolucionario para mis producciones!",
  
  "¿Has presentado en alguna conferencia de producción musical? Serías un gran ponente con todo este conocimiento.",
  
  "¿Cómo equilibras tu proceso creativo con el lado comercial de la música? Siempre lucho con eso.",
  
  "El tratamiento acústico también marcó una gran diferencia en mi estudio. ¡Ojalá lo hubiera hecho hace años!",
  
  "¿Crees que los sintetizadores hardware siguen valiendo la inversión en el mundo actual dominado por software?"
];

// Función para generar un número aleatorio entre min y max (inclusivo)
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Función para elegir un elemento aleatorio de un array
function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Función para generar un nombre aleatorio basado en el idioma
function generateRandomName(language: 'en' | 'es'): string {
  if (language === 'en') {
    return `${getRandomElement(englishFirstNames)} ${getRandomElement(englishLastNames)}`;
  } else {
    return `${getRandomElement(spanishFirstNames)} ${getRandomElement(spanishLastNames)}`;
  }
}

// Función para generar intereses aleatorios basados en el idioma
function generateRandomInterests(language: 'en' | 'es', count: number): string[] {
  const interestsPool = language === 'en' ? englishInterests : spanishInterests;
  const interests: string[] = [];
  
  while (interests.length < count) {
    const interest = getRandomElement(interestsPool);
    if (!interests.includes(interest)) {
      interests.push(interest);
    }
  }
  
  return interests;
}

// Función para generar una personalidad aleatoria basada en el idioma
function generateRandomPersonality(language: 'en' | 'es'): string {
  return language === 'en' 
    ? getRandomElement(botPersonalities)
    : getRandomElement(spanishBotPersonalities);
}

// Función para generar una fecha aleatoria en los últimos 30 días
function generateRandomDate(daysBack = 30): Date {
  const now = new Date();
  const randomDaysAgo = getRandomInt(0, daysBack);
  const randomHoursAgo = getRandomInt(0, 23);
  const randomMinutesAgo = getRandomInt(0, 59);
  
  now.setDate(now.getDate() - randomDaysAgo);
  now.setHours(now.getHours() - randomHoursAgo);
  now.setMinutes(now.getMinutes() - randomMinutesAgo);
  
  return now;
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

// Función principal para generar usuarios, posts y comentarios
async function generateUsers(userCount = 100) {
  console.log(`🧑‍🤝‍🧑 Generando ${userCount} usuarios...`);
  
  // Arrays para almacenar usuarios, posts y comentarios creados
  const createdUsers: any[] = [];
  const createdPosts: any[] = [];
  
  // Crear usuarios (70% humanos, 30% bots)
  const botCount = Math.floor(userCount * 0.3);
  const humanCount = userCount - botCount;
  
  // Crear usuarios humanos
  for (let i = 0; i < humanCount; i++) {
    // Determinar idioma: 60% inglés, 40% español
    const language = Math.random() < 0.6 ? 'en' : 'es';
    const displayName = generateRandomName(language);
    const interestCount = getRandomInt(2, 6);
    const interests = generateRandomInterests(language, interestCount);
    
    const userData = {
      displayName,
      bio: language === 'en' 
        ? `Music enthusiast with interest in ${interests.join(', ')}.`
        : `Entusiasta de la música con interés en ${interests.join(', ')}.`,
      interests,
      language,
      isBot: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const user = await firestoreSocialNetworkService.createUser(userData);
    createdUsers.push(user);
    
    // Aviso de progreso cada 10 usuarios
    if (i % 10 === 0 || i === humanCount - 1) {
      console.log(`Creados ${i + 1} de ${humanCount} usuarios humanos.`);
    }
  }
  
  // Crear usuarios bot
  for (let i = 0; i < botCount; i++) {
    // Determinar idioma: 60% inglés, 40% español
    const language = Math.random() < 0.6 ? 'en' : 'es';
    const displayName = generateRandomName(language);
    const interestCount = getRandomInt(3, 8);
    const interests = generateRandomInterests(language, interestCount);
    const personality = generateRandomPersonality(language);
    
    const userData = {
      displayName,
      bio: language === 'en' 
        ? `AI-powered music assistant specializing in ${interests.slice(0, 3).join(', ')}.`
        : `Asistente musical con IA especializado en ${interests.slice(0, 3).join(', ')}.`,
      interests,
      language,
      isBot: true,
      personality,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const user = await firestoreSocialNetworkService.createUser(userData);
    createdUsers.push(user);
    
    // Aviso de progreso cada 5 usuarios
    if (i % 5 === 0 || i === botCount - 1) {
      console.log(`Creados ${i + 1} de ${botCount} usuarios bot.`);
    }
  }
  
  console.log(`✅ Creados ${createdUsers.length} usuarios en total.`);
  
  // Crear posts (aproximadamente 2-5 posts por cada usuario humano)
  console.log("📝 Creando posts...");
  const humanUsers = createdUsers.filter(user => !user.isBot);
  
  for (const user of humanUsers) {
    const postCount = getRandomInt(2, 5);
    
    for (let i = 0; i < postCount; i++) {
      const language = user.language;
      const content = language === 'en' 
        ? getRandomElement(englishMusicPosts)
        : getRandomElement(spanishMusicPosts);
      
      const likes = getRandomInt(0, 25);
      const createdAt = generateRandomDate(30);
      
      const postData = {
        userId: user.id,
        content,
        likes,
        createdAt,
        updatedAt: createdAt
      };
      
      const post = await firestoreSocialNetworkService.createPost(postData);
      createdPosts.push(post);
    }
  }
  
  console.log(`✅ Creados ${createdPosts.length} posts.`);
  
  // Crear comentarios (2-8 comentarios por post)
  console.log("💬 Creando comentarios...");
  let totalComments = 0;
  
  for (const post of createdPosts) {
    const commentCount = getRandomInt(2, 8);
    
    // Obtener el post completo para saber el idioma
    const postDoc = await db.collection('social_posts').doc(post.id).get();
    const postData = postDoc.data();
    const postCreator = await db.collection('social_users').doc(postData?.userId).get();
    const postLanguage = postCreator.data()?.language || 'en';
    
    // Obtener algunos usuarios aleatorios para comentar (prefiriendo el mismo idioma)
    const sameLanguageUsers = createdUsers.filter(u => u.language === postLanguage);
    const otherLanguageUsers = createdUsers.filter(u => u.language !== postLanguage);
    
    // Preferir usuarios del mismo idioma (75% probabilidad)
    const commenters = [
      ...sameLanguageUsers.sort(() => 0.5 - Math.random()).slice(0, Math.floor(commentCount * 0.75)),
      ...otherLanguageUsers.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(commentCount * 0.25))
    ].sort(() => 0.5 - Math.random()).slice(0, commentCount);
    
    for (let i = 0; i < commentCount; i++) {
      const commenter = commenters[i];
      
      // Si no hay suficientes comentaristas, tomar uno aleatorio
      if (!commenter) {
        continue;
      }
      
      const language = commenter.language;
      const content = language === 'en'
        ? getRandomElement(englishMusicComments)
        : getRandomElement(spanishMusicComments);
      
      const likes = getRandomInt(0, 10);
      // El comentario debe ser posterior al post
      const postDate = postData?.createdAt.toDate() || new Date();
      const maxDaysAfter = Math.max(1, Math.floor((new Date().getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24)));
      const createdAt = generateRandomDate(maxDaysAfter);
      
      // Asegurarse de que la fecha del comentario sea posterior a la del post
      if (createdAt < postDate) {
        createdAt.setDate(postDate.getDate() + getRandomInt(0, 5));
        createdAt.setHours(postDate.getHours() + getRandomInt(1, 12));
      }
      
      const commentData = {
        userId: commenter.id,
        postId: post.id,
        content,
        likes,
        isReply: false,
        parentId: null,
        createdAt,
        updatedAt: createdAt
      };
      
      await firestoreSocialNetworkService.createComment(commentData);
      totalComments++;
      
      // Mostrar progreso cada 20 comentarios
      if (totalComments % 20 === 0) {
        console.log(`Creados ${totalComments} comentarios...`);
      }
    }
  }
  
  console.log(`✅ Creados ${totalComments} comentarios en total.`);
  
  // Crear algunas respuestas a comentarios (para mayor profundidad en la interacción)
  console.log("↪️ Creando respuestas a comentarios...");
  
  // Obtener todos los comentarios
  const commentsSnapshot = await db.collection('social_comments').get();
  const comments = commentsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Seleccionar aleatoriamente 30% de los comentarios para tener respuestas
  const commentsToReply = comments
    .filter(comment => !comment.isReply)  // Solo comentarios que no sean respuestas
    .sort(() => 0.5 - Math.random())     // Aleatorizar
    .slice(0, Math.floor(comments.length * 0.3)); // Tomar 30%
  
  let totalReplies = 0;
  
  for (const comment of commentsToReply) {
    // 1-3 respuestas por comentario
    const replyCount = getRandomInt(1, 3);
    
    // Obtener el autor del comentario original para conocer el idioma
    const commentAuthorDoc = await db.collection('social_users').doc(comment.userId).get();
    const commentLanguage = commentAuthorDoc.data()?.language || 'en';
    
    // Preferir usuarios del mismo idioma
    const sameLanguageUsers = createdUsers.filter(u => u.language === commentLanguage);
    const otherLanguageUsers = createdUsers.filter(u => u.language !== commentLanguage);
    
    const responders = [
      ...sameLanguageUsers.sort(() => 0.5 - Math.random()).slice(0, Math.floor(replyCount * 0.75)),
      ...otherLanguageUsers.sort(() => 0.5 - Math.random()).slice(0, Math.ceil(replyCount * 0.25))
    ].sort(() => 0.5 - Math.random()).slice(0, replyCount);
    
    for (let i = 0; i < replyCount; i++) {
      const responder = responders[i];
      
      if (!responder) {
        continue;
      }
      
      const language = responder.language;
      const content = language === 'en'
        ? getRandomElement(englishMusicComments)
        : getRandomElement(spanishMusicComments);
      
      const likes = getRandomInt(0, 5);
      
      // La respuesta debe ser posterior al comentario
      const commentDate = comment.createdAt.toDate();
      const maxDaysAfter = Math.max(1, Math.floor((new Date().getTime() - commentDate.getTime()) / (1000 * 60 * 60 * 24)));
      const createdAt = generateRandomDate(maxDaysAfter);
      
      // Asegurarse de que la fecha de la respuesta sea posterior a la del comentario
      if (createdAt < commentDate) {
        createdAt.setDate(commentDate.getDate() + getRandomInt(0, 3));
        createdAt.setHours(commentDate.getHours() + getRandomInt(1, 8));
      }
      
      const replyData = {
        userId: responder.id,
        postId: comment.postId,
        parentId: comment.id,
        content,
        likes,
        isReply: true,
        createdAt,
        updatedAt: createdAt
      };
      
      await firestoreSocialNetworkService.createComment(replyData);
      totalReplies++;
      
      // Mostrar progreso cada 10 respuestas
      if (totalReplies % 10 === 0) {
        console.log(`Creadas ${totalReplies} respuestas...`);
      }
    }
  }
  
  console.log(`✅ Creadas ${totalReplies} respuestas a comentarios.`);
  console.log("🎉 Generación de datos completada con éxito!");
}

// Función principal
async function main() {
  try {
    // Limpiar la base de datos existente
    await clearDatabase();
    
    // Generar 20 usuarios con posts y comentarios (reducido para evitar timeout)
    await generateUsers(20);
    
    console.log("✅ Script finalizado con éxito!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al ejecutar el script:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();