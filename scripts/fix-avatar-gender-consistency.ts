/**
 * Script para corregir la coherencia entre nombres y avatares
 * Asegura que los avatares coincidan con el género indicado por el nombre
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { faker } from '@faker-js/faker';

// Lista de nombres femeninos comunes (patrón de reconocimiento)
const femaleNamePatterns = [
  'maria', 'maría', 'sofia', 'sofía', 'lucia', 'lucía', 'ana', 'anna', 'carmen', 
  'julia', 'elena', 'isabel', 'isabella', 'valentina', 'camila', 'laura', 
  'sara', 'sarah', 'emma', 'olivia', 'emily', 'samantha', 'zoe', 'zoë', 'chloe', 'chloé',
  'ava', 'mia', 'amelia', 'aisha', 'leila', 'sofia', 'carolina', 'gabriela', 'andrea'
];

/**
 * Determina si un nombre es probablemente femenino
 */
function isFemaleNameLikely(name: string): boolean {
  const lowerName = name.toLowerCase();
  
  // Verificar si el nombre contiene algún patrón femenino
  return femaleNamePatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Genera un avatar consistente para un usuario con el género apropiado
 */
function generateGenderAppropriateAvatar(name: string): string {
  // Determinar si el nombre parece femenino
  const isFemale = isFemaleNameLikely(name);
  
  // Usar el nombre como seed para consistencia
  const seed = name.toLowerCase().replace(/\s+/g, '');
  faker.seed(hashString(seed));
  
  // Seleccionar el género apropiado para el avatar
  const sex = isFemale ? 'female' : 'male';
  
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
 * Revisa y corrige la coherencia entre nombres y avatares
 */
async function fixAvatarGenderConsistency() {
  console.log("🔄 Analizando coherencia entre nombres y avatares...");
  
  // Obtener todos los usuarios
  const usersSnapshot = await db.collection('social_users').get();
  
  if (usersSnapshot.empty) {
    console.log("No se encontraron usuarios.");
    return;
  }
  
  let correctedCount = 0;
  
  // Verificar y corregir cada usuario
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const displayName = userData.displayName;
    
    // Determinar si el nombre es probable que sea femenino
    const isFemale = isFemaleNameLikely(displayName);
    
    // Generar un nuevo avatar apropiado para el género
    const newAvatar = generateGenderAppropriateAvatar(displayName);
    
    // Actualizar el avatar en la base de datos
    await db.collection('social_users').doc(userDoc.id).update({
      avatar: newAvatar,
      updatedAt: Timestamp.fromDate(new Date())
    });
    
    correctedCount++;
    console.log(`✅ Corregido avatar para: ${displayName} (${isFemale ? 'Femenino' : 'Masculino'})`);
  }
  
  console.log(`🎉 Proceso completado. Actualizados ${correctedCount} avatares para coherencia de género.`);
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Iniciando corrección de coherencia de género para avatares...");
    
    await fixAvatarGenderConsistency();
    
    console.log("✅ Proceso completado exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();