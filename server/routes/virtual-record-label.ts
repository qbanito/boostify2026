/**
 * Rutas para Virtual Record Label
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../firebase';
import { db as pgDb } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Obtiene los artistas virtuales generados por un usuario
 * @route GET /api/virtual-label/my-artists
 */
router.get('/my-artists', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    
    console.log('🔍 [MY-ARTISTS] req.user:', req.user);
    console.log('🔍 [MY-ARTISTS] userId:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    let postgresUserId: number | null = null;

    // Intentar primero como ID numérico directo
    if (typeof userId === 'number' || !isNaN(Number(userId))) {
      postgresUserId = Number(userId);
      console.log('🔍 [MY-ARTISTS] Using direct userId as postgresUserId:', postgresUserId);
    } else {
      // Si no, buscar por replitId
      const firestoreUsers = await pgDb.select()
        .from(users)
        .where(eq(users.replitId, String(userId)));

      console.log('🔍 [MY-ARTISTS] firestoreUsers found:', firestoreUsers.length);

      if (firestoreUsers.length > 0) {
        postgresUserId = firestoreUsers[0].id;
        console.log('🔍 [MY-ARTISTS] postgresUserId from replitId:', postgresUserId);
      }
    }

    // Obtener artistas virtuales del usuario desde PostgreSQL
    let virtualArtists: any[] = [];
    
    if (postgresUserId) {
      virtualArtists = await pgDb.select()
        .from(users)
        .where(eq(users.generatedBy, postgresUserId));
      console.log('🔍 [MY-ARTISTS] virtualArtists found:', virtualArtists.length);
    } else {
      console.log('⚠️ [MY-ARTISTS] No postgresUserId found');
    }

    // Enriquecer con datos de Firestore
    const enrichedArtists = await Promise.all(
      virtualArtists.map(async (artist) => {
        if (artist.firestoreId) {
          try {
            const firestoreDoc = await db.collection('generated_artists').doc(artist.firestoreId).get();
            if (firestoreDoc.exists) {
              const firestoreData = firestoreDoc.data();
              return {
                ...artist,
                firestoreData: {
                  subscription: firestoreData?.subscription,
                  purchases: firestoreData?.purchases,
                  look: firestoreData?.look,
                  album: firestoreData?.album,
                  social_media: firestoreData?.social_media
                }
              };
            }
          } catch (error) {
            console.error(`Error loading Firestore data for artist ${artist.id}:`, error);
          }
        }
        return artist;
      })
    );

    res.json(enrichedArtists);
  } catch (error) {
    console.error('Error al obtener artistas virtuales:', error);
    res.status(500).json({ 
      error: 'Error al obtener artistas virtuales',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtiene un artista virtual por slug (con datos de Firestore)
 * @route GET /api/virtual-label/artist/:slug
 */
router.get('/artist/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Buscar en PostgreSQL
    const [artist] = await pgDb.select()
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1);

    if (!artist) {
      return res.status(404).json({ error: 'Artista no encontrado' });
    }

    // Si es un artista virtual, cargar datos de Firestore
    let enrichedArtist = { ...artist };
    
    if (artist.isAIGenerated && artist.firestoreId) {
      try {
        const firestoreDoc = await db.collection('generated_artists').doc(artist.firestoreId).get();
        if (firestoreDoc.exists) {
          const firestoreData = firestoreDoc.data();
          enrichedArtist = {
            ...artist,
            firestoreData
          };
        }
      } catch (error) {
        console.error(`Error loading Firestore data:`, error);
      }
    }

    res.json(enrichedArtist);
  } catch (error) {
    console.error('Error al obtener artista virtual:', error);
    res.status(500).json({ 
      error: 'Error al obtener artista virtual',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Actualiza el recordLabelId de artistas
 * @route POST /api/virtual-label/link-artists
 */
router.post('/link-artists', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistIds, recordLabelId } = req.body;

    if (!artistIds || !Array.isArray(artistIds)) {
      return res.status(400).json({ error: 'Se requiere un array de artistIds' });
    }

    if (!recordLabelId) {
      return res.status(400).json({ error: 'Se requiere recordLabelId' });
    }

    // Actualizar cada artista
    const updates = await Promise.all(
      artistIds.map(async (artistId: number) => {
        return pgDb.update(users)
          .set({ recordLabelId })
          .where(eq(users.id, artistId))
          .returning();
      })
    );

    res.json({ 
      success: true, 
      updated: updates.flat().length,
      message: `${updates.flat().length} artistas vinculados al sello`
    });
  } catch (error) {
    console.error('Error al vincular artistas:', error);
    res.status(500).json({ 
      error: 'Error al vincular artistas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtiene estadísticas de artistas virtuales de un usuario
 * @route GET /api/virtual-label/stats
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Buscar en PostgreSQL usando el uid de Firebase
    const firestoreUsers = await pgDb.select()
      .from(users)
      .where(eq(users.replitId, userId));

    let postgresUserId: number | null = null;
    
    if (firestoreUsers.length > 0) {
      postgresUserId = firestoreUsers[0].id;
    }

    if (!postgresUserId) {
      return res.json({
        totalArtists: 0,
        withSubscriptions: 0,
        totalRevenue: 0
      });
    }

    // Obtener artistas virtuales
    const virtualArtists = await pgDb.select()
      .from(users)
      .where(eq(users.generatedBy, postgresUserId));

    // Calcular estadísticas desde Firestore
    let withSubscriptions = 0;
    let totalRevenue = 0;

    await Promise.all(
      virtualArtists.map(async (artist) => {
        if (artist.firestoreId) {
          try {
            const firestoreDoc = await db.collection('generated_artists').doc(artist.firestoreId).get();
            if (firestoreDoc.exists) {
              const data = firestoreDoc.data();
              if (data?.subscription?.status === 'active') {
                withSubscriptions++;
                totalRevenue += data.subscription.price || 0;
              }
              if (data?.purchases?.videos?.totalSpent) {
                totalRevenue += data.purchases.videos.totalSpent;
              }
              if (data?.purchases?.courses?.totalSpent) {
                totalRevenue += data.purchases.courses.totalSpent;
              }
            }
          } catch (error) {
            console.error(`Error loading stats for artist ${artist.id}:`, error);
          }
        }
      })
    );

    res.json({
      totalArtists: virtualArtists.length,
      withSubscriptions,
      totalRevenue
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;
