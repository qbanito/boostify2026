/**
 * Script para actualizar los avatares de los usuarios con imágenes de faker.js
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { faker } from '@faker-js/faker';

/**
 * Genera una URL de avatar consistente para un usuario basada en su nombre
 * @param name Nombre del usuario
 * @returns URL del avatar generado
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
 * Función simple para convertir un string en un número para seed
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
 * Actualiza los avatares de todos los usuarios
 */
async function updateUserAvatars() {
  try {
    console.log("🔄 Obteniendo usuarios...");
    
    // Obtener todos los usuarios
    const usersSnapshot = await db.collection('social_users').get();
    
    if (usersSnapshot.empty) {
      console.log("❌ No se encontraron usuarios.");
      return;
    }
    
    console.log(`✅ Encontrados ${usersSnapshot.size} usuarios.`);
    
    // Actualizar cada usuario
    let updatedCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const displayName = userData.displayName || "User";
      
      // Generar el avatar del usuario con faker
      const avatarUrl = generateFakerAvatar(displayName);
      
      // Actualizar el documento del usuario con el avatar
      await db.collection('social_users').doc(userDoc.id).update({
        avatar: avatarUrl,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      updatedCount++;
      console.log(`✅ Actualizado avatar para: ${displayName}`);
    }
    
    console.log(`🎉 Proceso completado. Actualizados ${updatedCount} usuarios.`);
  } catch (error) {
    console.error("❌ Error al actualizar avatares:", error);
  }
}

// Función principal
async function main() {
  try {
    await updateUserAvatars();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el script:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();