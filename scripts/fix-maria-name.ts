/**
 * Script para reemplazar el nombre "María González" por un nombre masculino
 * y asignar un avatar masculino correspondiente.
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { faker } from '@faker-js/faker';

// Nombre nuevo masculino para reemplazar a María González
const NEW_NAME = "Marco González";

/**
 * Genera un avatar masculino consistente para el nuevo nombre
 */
function generateMaleAvatar(name: string): string {
  // Usar el nombre como seed para consistencia
  const seed = name.toLowerCase().replace(/\s+/g, '');
  faker.seed(hashString(seed));
  
  // Generar avatar masculino
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
 * Cambia el nombre "María González" a un nombre masculino
 */
async function changeMariaToMale() {
  console.log(`🔄 Buscando usuario "María González" para reemplazar por "${NEW_NAME}"...`);
  
  // Buscar usuario María González
  const usersSnapshot = await db.collection('social_users')
    .where('displayName', '==', 'María González')
    .get();
  
  if (usersSnapshot.empty) {
    console.log("❌ No se encontró ningún usuario con nombre 'María González'.");
    return;
  }
  
  // Generar avatar masculino para el nuevo nombre
  const maleAvatar = generateMaleAvatar(NEW_NAME);
  
  // Actualizar cada coincidencia (debería ser solo una)
  for (const userDoc of usersSnapshot.docs) {
    await db.collection('social_users').doc(userDoc.id).update({
      displayName: NEW_NAME,
      avatar: maleAvatar,
      updatedAt: Timestamp.fromDate(new Date())
    });
    
    console.log(`✅ Usuario actualizado: "María González" → "${NEW_NAME}" con nuevo avatar masculino`);
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log("🚀 Iniciando corrección de nombre específico...");
    
    await changeMariaToMale();
    
    console.log("✅ Proceso completado exitosamente.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el proceso:", error);
    process.exit(1);
  }
}

// Ejecutar la función principal
main();