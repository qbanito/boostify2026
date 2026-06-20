/**
 * Rutas para obtener y gestionar artistas generados
 */
import { Request, Response, Router } from 'express';
import { db } from '../firebase';

const router = Router();

/**
 * Obtiene todos los artistas generados
 * Esta ruta no requiere autenticación porque solo es para fines de análisis de datos
 * @route GET /api/artists/generated
 */
router.get('/api/artists/generated', async (req: Request, res: Response) => {
  try {
    // Log para depuración
    console.log('Accediendo a la ruta /api/artists/generated');
    
    const artistsCollection = db.collection('generated_artists');
    console.log('Obteniendo colección generated_artists');
    
    const artistsSnapshot = await artistsCollection.get();
    console.log(`Artistas encontrados: ${artistsSnapshot.size}`);
    
    if (artistsSnapshot.empty) {
      console.log('No se encontraron artistas generados');
      return res.json([]);
    }
    
    const artists = artistsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Devolviendo ${artists.length} artistas`);
    return res.json(artists);
  } catch (error) {
    console.error('Error al obtener artistas generados:', error);
    return res.status(500).json({ error: 'Error al obtener artistas generados' });
  }
});

/**
 * Obtiene un artista generado por ID
 * @route GET /api/artists/generated/:id
 */
router.get('/api/artists/generated/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`Buscando artista con ID: ${id}`);
    
    // Intento 1: Buscar por ID de documento en Firestore
    const artistRef = db.collection('generated_artists').doc(id);
    const artistDoc = await artistRef.get();
    
    if (artistDoc.exists) {
      console.log(`Artista encontrado con ID de documento: ${id}`);
      return res.json({
        id: artistDoc.id,
        ...artistDoc.data()
      });
    }
    
    // Intento 2: Buscar por campo 'id' o 'firestoreId'
    console.log(`Artista no encontrado como document ID, buscando como campo id o firestoreId`);
    const queryById = await db.collection('generated_artists')
      .where('id', '==', id)
      .limit(1)
      .get();
      
    if (!queryById.empty) {
      const doc = queryById.docs[0];
      console.log(`Artista encontrado con campo id: ${id}`);
      return res.json({
        id: doc.id,
        ...doc.data()
      });
    }
    
    // Intento 3: Buscar por campo 'id' (ART-XXXXX)
    console.log(`Buscando por campo id: ${id}`);
    const queryByPrefixId = await db.collection('generated_artists')
      .where('id', '==', id)
      .limit(1)
      .get();
      
    if (!queryByPrefixId.empty) {
      const doc = queryByPrefixId.docs[0];
      console.log(`Artista encontrado con campo id: ${id}`);
      return res.json({
        id: doc.id,
        ...doc.data()
      });
    }
    
    // No se encontró el artista
    console.log(`No se encontró ningún artista con ID: ${id}`);
    return res.status(404).json({ error: 'Artista no encontrado' });
  } catch (error) {
    console.error('Error al obtener artista generado:', error);
    return res.status(500).json({ error: 'Error al obtener artista generado' });
  }
});

export default router;