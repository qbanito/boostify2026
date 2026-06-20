/**
 * Versión ligera del script para añadir usuarios diversos
 * Se enfoca solo en crear usuarios y algunos posts básicos
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { faker } from '@faker-js/faker';

// Lista de nombres variados internacionalmente (reducida a 10)
const diverseNames = [
  // Nombres en inglés
  { name: "Alex Rivera", language: "en" },
  { name: "Jamal Wilson", language: "en" },
  { name: "Samantha Lee", language: "en" },
  { name: "Zoe Mitchell", language: "en" },
  { name: "Aisha Khan", language: "en" },
  
  // Nombres en español
  { name: "Lucía Fernández", language: "es" },
  { name: "Javier Rodríguez", language: "es" },
  { name: "Isabella Morales", language: "es" },
  { name: "Mateo Herrera", language: "es" },
  { name: "Valentina Torres", language: "es" }
];

// Intereses musicales diversos
const englishMusicInterests = [
  "Jazz", "Hip-hop", "Classical piano", "EDM production", "Indie rock", 
  "Music theory", "Guitar techniques", "Music history", "Vinyl collecting", 
  "Live performance"
];

const spanishMusicInterests = [
  "Flamenco", "Reggaetón", "Salsa", "Cumbia", "Música clásica", 
  "Producción musical", "Teoría musical", "Historia de la música latina", 
  "Guitarra española", "Percusión latina"
];

// Personalidades diversas
const englishPersonalities = [
  "Passionate about music production and always experimenting with new sounds",
  "Professional classical pianist with a love for teaching music theory",
  "Hip-hop enthusiast and aspiring beatmaker with a unique style",
  "Music journalist documenting the evolving indie music scene",
  "Experimental electronic music producer pushing creative boundaries"
];

const spanishPersonalities = [
  "Productor de flamenco fusión con influencias contemporáneas",
  "Guitarrista clásico dedicado a la enseñanza musical",
  "Compositor de música latina con experiencia en bandas sonoras",
  "DJ especializado en la mezcla de ritmos tradicionales y electrónicos",
  "Violinista profesional con pasión por la música clásica y contemporánea"
];

// Posts específicos sobre música (reducido a 10)
const englishMusicPosts = [
  "Finally mastered that complex jazz chord progression I've been working on for weeks! Any other jazz musicians here with tips on improvisation?",
  "What's your favorite DAW for producing hip-hop beats? I've been using FL Studio but considering switching to Ableton for workflow reasons.",
  "Just discovered the amazing world of music from Mali - artists like Ali Farka Touré and Tinariwen are blowing my mind! Any recommendations for similar artists?",
  "Started transcribing solos from my favorite guitarists as a practice exercise. It's challenging but so rewarding for developing my ear!",
  "Opinions on modern music production? Is it getting too formulaic or is the democratization of production tools leading to more innovation?"
];

const spanishMusicPosts = [
  "¡Finalmente dominé esa compleja progresión de acordes de jazz en la que he estado trabajando durante semanas! ¿Hay otros músicos de jazz aquí con consejos sobre improvisación?",
  "¿Cuál es tu DAW favorito para producir beats de hip-hop? He estado usando FL Studio pero estoy considerando cambiar a Ableton por razones de flujo de trabajo.",
  "Acabo de descubrir el increíble mundo de la música de Mali - ¡artistas como Ali Farka Touré y Tinariwen me están sorprendiendo! ¿Alguna recomendación de artistas similares?",
  "Comencé a transcribir solos de mis guitarristas favoritos como ejercicio de práctica. ¡Es desafiante pero muy gratificante para desarrollar mi oído!",
  "¿Opiniones sobre la producción musical moderna? ¿Se está volviendo demasiado formulaica o la democratización de las herramientas de producción está llevando a más innovación?"
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
      ? getRandomElements(englishMusicInterests, 3 + Math.floor(Math.random() * 2))
      : getRandomElements(spanishMusicInterests, 3 + Math.floor(Math.random() * 2));
    
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
 * Función principal para ejecutar el script
 */
async function main() {
  try {
    console.log("🚀 Iniciando creación de usuarios diversos e interacciones...");
    
    // Crear usuarios diversos
    const userIds = await createDiverseUsers();
    
    // Crear posts musicales
    await createMusicPosts(userIds);
    
    console.log("✅ Proceso completado exitosamente. Red social enriquecida con nuevos usuarios y posts.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();