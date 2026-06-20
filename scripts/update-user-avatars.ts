/**
 * Script para actualizar los avatares de los usuarios en Firestore
 * Agrega colores de fondo consistentes para cada usuario
 */

import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Lista de colores de fondo para avatares
const avatarColors = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500"
];

/**
 * Genera un color de fondo consistente basado en el nombre del usuario
 * @param name Nombre del usuario
 * @returns Clase CSS para el color de fondo
 */
function generateAvatarColor(name: string): string {
  // Convertir el nombre a un número usando la suma de los códigos de carácter
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Usar el módulo para elegir un color del array
  const colorIndex = sum % avatarColors.length;
  return avatarColors[colorIndex];
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
      
      // Generar el color del avatar basado en el nombre
      const avatarColor = generateAvatarColor(displayName);
      
      // Actualizar el documento del usuario con el color del avatar
      await db.collection('social_users').doc(userDoc.id).update({
        avatarColor: avatarColor,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      updatedCount++;
      console.log(`✅ Actualizado avatar para: ${displayName} (${avatarColor})`);
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