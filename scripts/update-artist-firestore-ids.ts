/**
 * Script para actualizar el campo firestoreId en los artistas existentes
 * Este script se ejecuta una sola vez para corregir los documentos existentes
 */
import { db } from '../server/firebase';
import { Timestamp } from 'firebase-admin/firestore';

async function updateArtistFirestoreIds() {
  try {
    console.log('Iniciando actualización de IDs de Firestore para artistas existentes...');
    
    // Obtener la colección de artistas
    const artistsCollection = db.collection('generated_artists');
    const snapshot = await artistsCollection.get();
    
    if (snapshot.empty) {
      console.log('No se encontraron artistas para actualizar.');
      return;
    }
    
    console.log(`Encontrados ${snapshot.size} artistas para actualizar.`);
    let updateCount = 0;
    
    // Procesar cada documento en un batch para eficiencia
    const batchSize = 500; // Máximo tamaño de batch en Firestore
    let batch = db.batch();
    let operationCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Si el artista no tiene firestoreId, añadirlo
      if (!data.firestoreId) {
        const docRef = artistsCollection.doc(doc.id);
        batch.update(docRef, { 
          firestoreId: doc.id,
          updatedAt: Timestamp.now()
        });
        
        operationCount++;
        updateCount++;
        
        // Si alcanzamos el límite del batch, ejecutarlo y crear uno nuevo
        if (operationCount >= batchSize) {
          await batch.commit();
          console.log(`Procesados ${operationCount} artistas en batch.`);
          batch = db.batch();
          operationCount = 0;
        }
      }
    }
    
    // Ejecutar el último batch si hay operaciones pendientes
    if (operationCount > 0) {
      await batch.commit();
      console.log(`Procesados ${operationCount} artistas en último batch.`);
    }
    
    console.log(`Actualización completada. Se actualizaron ${updateCount} artistas.`);
  } catch (error) {
    console.error('Error actualizando IDs de Firestore:', error);
    throw error;
  }
}

// Ejecutar la función principal
updateArtistFirestoreIds()
  .then(() => {
    console.log('Proceso de actualización finalizado con éxito.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error durante el proceso de actualización:', error);
    process.exit(1);
  });