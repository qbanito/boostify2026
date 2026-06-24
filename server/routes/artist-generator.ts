/**
 * Routes for random artist generation
 */
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { generateRandomArtist } from '../../scripts/generate-random-artist';
import { db } from '../firebase';
import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import { db as pgDb } from '../../db';
import { users, artistNews, songs, tokenizedSongs, userRoles, subscriptions, notifications, newsArticles, managerSchedule, crowdfundingCampaigns, explicitSettings, merchandise, artistBlueprints } from '../../db/schema';
import { eq, desc, and, or, count, sql } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';
import { notifyArtistFans } from '../services/artist-fan-notifications';
// FAL AI Nano Banana for images and MiniMax Music for audio
import { 
  generateImageWithNanoBanana, 
  generateImageWithFaceReference as generateImageWithFaceReferenceFAL,
  generateMusicWithMiniMax,
  generateArtistSongWithFAL,
  generateArtistMerchandise,
  generateArtistProfileVideo
} from '../services/fal-service';
// Hyper-realistic news cover image generator (gpt-image-2/edit cascade)
import { generateNewsImage } from '../services/news-image-generator';
// Google Lyria 3 - Primary model for AI artist songs
import { generateArtistSongWithLyria3 } from '../services/lyria3-service';
// OpenAI for text generation (tracked)
import { createTrackedOpenAI } from '../utils/tracked-openai';

/**
 * Returns the original Clerk user ID string from the request.
 * clerkAuthMiddleware resolves req.user.id to a PostgreSQL integer, so
 * any route that needs to do `WHERE clerkId = ?` must use clerkUserId, not id.
 */
function getClerkId(req: Request): string {
  return (req as any).user?.clerkUserId || (req as any).user?.uid || String((req as any).user?.id || '');
}

// Log database connection status at module load time
console.log('[artist-generator] Module loading...');
console.log(`[artist-generator] Firebase db available: ${!!db}`);
console.log(`[artist-generator] PostgreSQL pgDb available: ${!!pgDb}`);

// OpenAI client for text generation (auto-logged)
const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
import { NotificationTemplates } from '../utils/notifications';
import { generateSocialMediaContent } from '../services/social-media-service';
import { getBlueprintBrief } from '../services/artist-blueprint-generator';
import axios from 'axios';
// BTF-2300 Blockchain Service for automatic NFT registration
import { 
  registerArtistOnChain, 
  isBlockchainServiceAvailable,
  BTF2300_CONTRACT_ADDRESSES 
} from '../services/btf2300-blockchain';
// Resend Email Service for notifications
import { sendArtistGeneratedEmail } from '../services/resend-email-service';
// Master Artist JSON Generator — canonical identity for all AI modules
import { generateArtistMasterJSON, deriveParamsFromMaster } from '../services/artist-master-generator';
// AI Fallback — OpenRouter free-model cascade when OpenAI fails
import { withTextFallback } from '../utils/ai-fallback';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Límite de artistas por usuario (excepto admin)
const MAX_ARTISTS_PER_USER = 1;

/**
 * Helper function para verificar si el usuario puede crear más artistas
 * Retorna { canCreate: boolean, reason?: string, isAdmin: boolean, artistCount: number }
 */
async function canUserCreateArtist(clerkUserId: string, userEmail?: string | null): Promise<{
  canCreate: boolean;
  reason?: string;
  isAdmin: boolean;
  artistCount: number;
  hasPremium: boolean;
  pgUserId?: number;
  isTester?: boolean;
}> {
  console.log(`[canUserCreateArtist] Checking permissions for clerkId: ${clerkUserId}, email: ${userEmail}`);
  
  // Verificar si es admin
  const adminStatus = isAdminEmail(userEmail);
  console.log(`[canUserCreateArtist] Admin status: ${adminStatus}`);
  
  // Obtener el usuario de PostgreSQL
  let userRecord;
  try {
    console.log('[canUserCreateArtist] Querying PostgreSQL for user...');
    userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    console.log(`[canUserCreateArtist] PostgreSQL query result: ${JSON.stringify(userRecord)}`);
  } catch (dbError) {
    console.error('[canUserCreateArtist] PostgreSQL query failed:', dbError);
    throw new Error(`Database connection error: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
  }

  if (userRecord.length === 0) {
    return { 
      canCreate: false, 
      reason: 'User not found in database',
      isAdmin: adminStatus,
      artistCount: 0,
      hasPremium: false
    };
  }

  const pgUserId = userRecord[0].id;
  
  // Check if user has tester role (full platform access)
  let isTester = false;
  try {
    const testerCheck = await pgDb
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, pgUserId))
      .limit(1);
    
    if (testerCheck.length > 0 && testerCheck[0].role === 'tester') {
      isTester = true;
      console.log(`🧪 Tester detected (${userEmail}) - full platform access granted`);
    }
  } catch (roleError) {
    console.error('[canUserCreateArtist] Role check failed:', roleError);
  }

  // Buscar suscripción activa en la tabla subscriptions
  let userSubscription = 'free';
  try {
    const subscriptionRecord = await pgDb
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, pgUserId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);
    
    if (subscriptionRecord.length > 0) {
      userSubscription = subscriptionRecord[0].plan;
    }
    console.log(`[canUserCreateArtist] User subscription: ${userSubscription}`);
  } catch (subError) {
    console.error('[canUserCreateArtist] Subscription query failed:', subError);
    // Continue with free subscription if query fails
  }

  // Verificar suscripción - solo premium/enterprise puede crear artistas
  // Legacy names: premium = enterprise, pro = professional
  // Testers also get premium access
  const hasPremium = isTester || ['premium', 'enterprise', 'professional', 'pro'].includes(userSubscription.toLowerCase());

  // Admin siempre tiene acceso premium
  if (adminStatus) {
    console.log(`👑 Admin detected (${userEmail}) - unlimited artist creation allowed`);
    return {
      canCreate: true,
      isAdmin: true,
      artistCount: 0, // No importa para admin
      hasPremium: true,
      pgUserId,
      isTester: false
    };
  }

  // Tester has full access like premium users
  if (isTester) {
    console.log(`🧪 Tester user detected - full platform access granted`);
    return {
      canCreate: true,
      isAdmin: false,
      artistCount: 0,
      hasPremium: true,
      pgUserId,
      isTester: true
    };
  }

  // Verificar si tiene suscripción premium
  if (!hasPremium) {
    return {
      canCreate: false,
      reason: 'Premium subscription required to create artists. Please upgrade your plan.',
      isAdmin: false,
      artistCount: 0,
      hasPremium: false,
      pgUserId
    };
  }

  // Contar artistas existentes del usuario (generatedBy = pgUserId)
  const artistCountResult = await pgDb
    .select({ count: count() })
    .from(users)
    .where(
      and(
        eq(users.generatedBy, pgUserId),
        eq(users.role, 'artist')
      )
    );

  const currentArtistCount = artistCountResult[0]?.count || 0;

  if (currentArtistCount >= MAX_ARTISTS_PER_USER) {
    return {
      canCreate: false,
      reason: `You have reached the maximum limit of ${MAX_ARTISTS_PER_USER} artist(s) per account. Only admin users can create unlimited artists.`,
      isAdmin: false,
      artistCount: currentArtistCount,
      hasPremium: true,
      pgUserId
    };
  }

  return {
    canCreate: true,
    isAdmin: false,
    artistCount: currentArtistCount,
    hasPremium: true,
    pgUserId
  };
}

/**
 * Helper function para descargar una imagen y convertirla a base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(imageUrl, { 
      responseType: 'arraybuffer',
      timeout: 10000
    });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return base64;
  } catch (error) {
    console.error('Error descargando imagen:', error);
    return null;
  }
}

/**
 * Endpoint para verificar si el usuario puede crear artistas
 * Usado por el frontend para mostrar/ocultar botones de creación
 */
router.get("/can-create-artist", isAuthenticated, async (req: Request, res: Response) => {
  try {
    console.log('[/can-create-artist] Request received');
    
    // Verify database connections are available
    if (!db) {
      console.error('[/can-create-artist] Firebase db is null - Firebase not initialized');
      return res.status(503).json({
        canCreate: false,
        reason: 'Database service unavailable (Firebase)',
        code: 'DB_UNAVAILABLE'
      });
    }
    
    if (!pgDb) {
      console.error('[/can-create-artist] PostgreSQL db is null - Database not initialized');
      return res.status(503).json({
        canCreate: false,
        reason: 'Database service unavailable (PostgreSQL)',
        code: 'DB_UNAVAILABLE'
      });
    }
    
    const clerkUserId = getClerkId(req);
    const userEmail = req.user?.email;
    console.log(`[/can-create-artist] User: ${clerkUserId}, Email: ${userEmail}`);

    if (!clerkUserId) {
      console.log('[/can-create-artist] No clerkUserId - returning 401');
      return res.status(401).json({ 
        canCreate: false,
        reason: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
    }

    console.log('[/can-create-artist] Calling canUserCreateArtist...');
    const permissionCheck = await canUserCreateArtist(clerkUserId, userEmail);
    console.log(`[/can-create-artist] Permission check result: ${JSON.stringify(permissionCheck)}`);

    return res.status(200).json({
      canCreate: permissionCheck.canCreate,
      reason: permissionCheck.reason || null,
      isAdmin: permissionCheck.isAdmin,
      artistCount: permissionCheck.artistCount,
      maxAllowed: MAX_ARTISTS_PER_USER,
      hasPremium: permissionCheck.hasPremium
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[/can-create-artist] ERROR:', errorMessage);
    console.error('[/can-create-artist] Stack:', errorStack);
    return res.status(500).json({
      canCreate: false,
      reason: `Error checking permissions: ${errorMessage}`,
      code: 'SERVER_ERROR',
      debug: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
});

/**
 * Endpoint de diagnóstico para verificar URLs de imágenes de artistas
 * Identifica URLs temporales (FAL, data:, etc.) y las regenera si es necesario
 */
router.get("/diagnose-images", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const clerkUserId = getClerkId(req);
    
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener ID de PostgreSQL del usuario
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const pgUserId = userRecord[0].id;
    const { or } = await import('drizzle-orm');
    
    // Obtener artistas del usuario
    const artistsFromPg = await pgDb
      .select({
        id: users.id,
        artistName: users.artistName,
        profileImage: users.profileImage,
        coverImage: users.coverImage
      })
      .from(users)
      .where(
        or(
          eq(users.id, pgUserId),
          eq(users.generatedBy, pgUserId)
        )
      );

    // Analizar URLs de imágenes
    const analysisResults = artistsFromPg.map(artist => {
      const profileImageStatus = analyzeImageUrl(artist.profileImage);
      const coverImageStatus = analyzeImageUrl(artist.coverImage);
      
      return {
        id: artist.id,
        name: artist.artistName,
        profileImage: {
          url: artist.profileImage?.substring(0, 80) + (artist.profileImage && artist.profileImage.length > 80 ? '...' : ''),
          status: profileImageStatus.status,
          type: profileImageStatus.type
        },
        coverImage: {
          url: artist.coverImage?.substring(0, 80) + (artist.coverImage && artist.coverImage.length > 80 ? '...' : ''),
          status: coverImageStatus.status,
          type: coverImageStatus.type
        }
      };
    });

    // Contar problemas
    const issuesCount = analysisResults.filter(a => 
      a.profileImage.status === 'problematic' || a.coverImage.status === 'problematic'
    ).length;

    res.json({
      success: true,
      totalArtists: analysisResults.length,
      issuesFound: issuesCount,
      artists: analysisResults
    });
  } catch (error) {
    console.error('Error en diagnóstico de imágenes:', error);
    res.status(500).json({ error: 'Error al diagnosticar imágenes' });
  }
});

/**
 * Analiza una URL de imagen y determina si es permanente o temporal
 */
function analyzeImageUrl(url: string | null): { status: 'ok' | 'problematic' | 'missing'; type: string } {
  if (!url) {
    return { status: 'missing', type: 'none' };
  }
  
  // URLs permanentes de Firebase Storage
  if (url.includes('storage.googleapis.com') || url.includes('firebasestorage.googleapis.com')) {
    return { status: 'ok', type: 'firebase-storage' };
  }
  
  // UI Avatars - fallback pero funcional
  if (url.includes('ui-avatars.com')) {
    return { status: 'ok', type: 'ui-avatars' };
  }
  
  // Picsum - placeholder pero funcional
  if (url.includes('picsum.photos')) {
    return { status: 'ok', type: 'picsum-placeholder' };
  }
  
  // URLs temporales de FAL (expiran)
  if (url.includes('fal.media') || url.includes('fal-cdn') || url.includes('v3.fal.media') || url.includes('fal.ai')) {
    return { status: 'problematic', type: 'fal-temporary' };
  }
  
  // Data URLs - no son URLs válidas para el navegador
  if (url.startsWith('data:')) {
    return { status: 'problematic', type: 'data-url' };
  }
  
  // URLs locales (/uploads/...) - no funcionan en producción (efímero)
  if (url.startsWith('/uploads/') || url.includes('/uploads/')) {
    return { status: 'problematic', type: 'local-upload-ephemeral' };
  }
  
  // Otras URLs externas
  return { status: 'ok', type: 'external-url' };
}

/**
 * Endpoint para regenerar imágenes problemáticas de un artista
 */
router.post("/regenerate-images/:artistId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const clerkUserId = getClerkId(req);
    
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener el artista
    const artist = await pgDb
      .select()
      .from(users)
      .where(eq(users.id, parseInt(artistId)))
      .limit(1);

    if (artist.length === 0) {
      return res.status(404).json({ error: 'Artista no encontrado' });
    }

    const artistData = artist[0];
    
    // Verificar permisos
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { or } = await import('drizzle-orm');
    if (artistData.id !== userRecord[0].id && artistData.generatedBy !== userRecord[0].id) {
      return res.status(403).json({ error: 'No tienes permiso para este artista' });
    }

    // Regenerar imágenes con FAL
    console.log(`🔄 Regenerando imágenes para artista: ${artistData.artistName}`);
    
    const { generateArtistImagesWithFAL } = await import('../services/fal-service');
    const genre = artistData.genres?.[0] || 'pop';
    const artistDescription = artistData.biography || `${artistData.artistName}, professional music artist`;
    
    const imageResult = await generateArtistImagesWithFAL(
      artistDescription,
      artistData.artistName || 'Artist',
      genre
    );

    // Actualizar en PostgreSQL
    await pgDb.update(users)
      .set({
        profileImage: imageResult.profileUrl,
        coverImage: imageResult.coverUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, parseInt(artistId)));

    // Actualizar en Firestore si existe
    if (artistData.firestoreId) {
      try {
        await db.collection('generated_artists').doc(artistData.firestoreId).update({
          'look.profile_url': imageResult.profileUrl,
          'look.cover_url': imageResult.coverUrl,
          updatedAt: Timestamp.now()
        });
      } catch (e) {
        console.warn('No se pudo actualizar Firestore:', e);
      }
    }

    console.log(`✅ Imágenes regeneradas para ${artistData.artistName}`);
    
    res.json({
      success: true,
      artistId: parseInt(artistId),
      profileImage: imageResult.profileUrl,
      coverImage: imageResult.coverUrl
    });
  } catch (error) {
    console.error('Error regenerando imágenes:', error);
    res.status(500).json({ 
      error: 'Error al regenerar imágenes',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para recuperar imágenes originales desde Firestore
 * Sincroniza las URLs de look.profile_url y look.cover_url de Firestore a PostgreSQL
 */
router.post("/sync-images-from-firestore/:artistId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const clerkUserId = getClerkId(req);
    
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener el artista de PostgreSQL
    const artist = await pgDb
      .select()
      .from(users)
      .where(eq(users.id, parseInt(artistId)))
      .limit(1);

    if (artist.length === 0) {
      return res.status(404).json({ error: 'Artista no encontrado en PostgreSQL' });
    }

    const artistData = artist[0];
    
    // Verificar permisos
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    
    if (userRecord.length === 0) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { or } = await import('drizzle-orm');
    if (artistData.id !== userRecord[0].id && artistData.generatedBy !== userRecord[0].id) {
      return res.status(403).json({ error: 'No tienes permiso para este artista' });
    }

    // Buscar en Firestore por firestoreId
    if (!artistData.firestoreId) {
      return res.status(404).json({ 
        error: 'Este artista no tiene firestoreId asociado',
        suggestion: 'Intenta regenerar las imágenes con el botón de refresh'
      });
    }

    console.log(`🔍 Buscando imágenes en Firestore para artista: ${artistData.artistName} (firestoreId: ${artistData.firestoreId})`);
    
    const firestoreDoc = await db.collection('generated_artists').doc(artistData.firestoreId).get();
    
    if (!firestoreDoc.exists) {
      return res.status(404).json({ 
        error: 'Documento no encontrado en Firestore',
        firestoreId: artistData.firestoreId 
      });
    }

    const firestoreData = firestoreDoc.data();
    const profileUrl = firestoreData?.look?.profile_url || firestoreData?.profileImage;
    const coverUrl = firestoreData?.look?.cover_url || firestoreData?.coverImage;

    console.log(`📸 Imágenes encontradas en Firestore:`);
    console.log(`   Profile: ${profileUrl?.substring(0, 80)}...`);
    console.log(`   Cover: ${coverUrl?.substring(0, 80)}...`);

    if (!profileUrl && !coverUrl) {
      return res.status(404).json({ 
        error: 'No se encontraron imágenes en Firestore para este artista',
        firestoreData: {
          hasLook: !!firestoreData?.look,
          fields: Object.keys(firestoreData || {})
        }
      });
    }

    // Actualizar PostgreSQL con las URLs de Firestore
    const updateData: any = { updatedAt: new Date() };
    if (profileUrl) updateData.profileImage = profileUrl;
    if (coverUrl) updateData.coverImage = coverUrl;

    await pgDb.update(users)
      .set(updateData)
      .where(eq(users.id, parseInt(artistId)));

    console.log(`✅ Imágenes sincronizadas desde Firestore para ${artistData.artistName}`);

    res.json({
      success: true,
      artistId: parseInt(artistId),
      artistName: artistData.artistName,
      profileImage: profileUrl,
      coverImage: coverUrl,
      source: 'firestore'
    });
  } catch (error) {
    console.error('Error sincronizando imágenes desde Firestore:', error);
    res.status(500).json({ 
      error: 'Error al sincronizar imágenes',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para sincronizar TODOS los artistas desde Firestore (admin/batch)
 */
router.post("/sync-all-images-from-firestore", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const clerkUserId = getClerkId(req);
    
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener ID de PostgreSQL del usuario
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (userRecord.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const pgUserId = userRecord[0].id;
    const { or } = await import('drizzle-orm');
    
    // Obtener artistas del usuario
    const artistsFromPg = await pgDb
      .select()
      .from(users)
      .where(
        or(
          eq(users.id, pgUserId),
          eq(users.generatedBy, pgUserId)
        )
      );

    console.log(`🔄 Sincronizando imágenes de ${artistsFromPg.length} artistas desde Firestore...`);

    const results: any[] = [];
    let synced = 0;
    let failed = 0;
    let skipped = 0;

    for (const artist of artistsFromPg) {
      if (!artist.firestoreId) {
        results.push({ 
          id: artist.id, 
          name: artist.artistName, 
          status: 'skipped', 
          reason: 'no-firestore-id' 
        });
        skipped++;
        continue;
      }

      try {
        const firestoreDoc = await db.collection('generated_artists').doc(artist.firestoreId).get();
        
        if (!firestoreDoc.exists) {
          results.push({ 
            id: artist.id, 
            name: artist.artistName, 
            status: 'skipped', 
            reason: 'firestore-doc-not-found' 
          });
          skipped++;
          continue;
        }

        const firestoreData = firestoreDoc.data();
        const profileUrl = firestoreData?.look?.profile_url || firestoreData?.profileImage;
        const coverUrl = firestoreData?.look?.cover_url || firestoreData?.coverImage;

        if (!profileUrl && !coverUrl) {
          results.push({ 
            id: artist.id, 
            name: artist.artistName, 
            status: 'skipped', 
            reason: 'no-images-in-firestore' 
          });
          skipped++;
          continue;
        }

        // Actualizar PostgreSQL
        const updateData: any = { updatedAt: new Date() };
        if (profileUrl) updateData.profileImage = profileUrl;
        if (coverUrl) updateData.coverImage = coverUrl;

        await pgDb.update(users)
          .set(updateData)
          .where(eq(users.id, artist.id));

        results.push({ 
          id: artist.id, 
          name: artist.artistName, 
          status: 'synced',
          profileImage: profileUrl?.substring(0, 50) + '...',
          coverImage: coverUrl?.substring(0, 50) + '...'
        });
        synced++;
      } catch (err) {
        results.push({ 
          id: artist.id, 
          name: artist.artistName, 
          status: 'error', 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
        failed++;
      }
    }

    console.log(`✅ Sincronización completada: ${synced} sincronizados, ${skipped} saltados, ${failed} errores`);

    res.json({
      success: true,
      total: artistsFromPg.length,
      synced,
      skipped,
      failed,
      results
    });
  } catch (error) {
    console.error('Error en sincronización masiva:', error);
    res.status(500).json({ 
      error: 'Error en sincronización masiva',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para obtener todos los artistas de un usuario
 * Incluye: su propio perfil + artistas generados con IA
 */
router.get("/my-artists", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const clerkUserId = getClerkId(req);
    
    if (!clerkUserId) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado' 
      });
    }

    console.log(`🎨 Obteniendo todos los artistas del usuario Clerk: ${clerkUserId}`);

    // Primero, obtener el ID de PostgreSQL del usuario basado en su clerkId
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (userRecord.length === 0) {
      console.log(`⚠️ Usuario con clerkId ${clerkUserId} no encontrado en PostgreSQL`);
      return res.status(200).json({
        success: true,
        count: 0,
        artists: []
      });
    }

    const pgUserId = userRecord[0].id;
    console.log(`📍 Usuario PostgreSQL ID: ${pgUserId} para Clerk ID: ${clerkUserId}`);

    // Verificar si es admin para mostrar también los artistas de BoostiSwap
    const userEmail = req.user?.emailAddresses?.[0]?.emailAddress || req.user?.email;
    const isAdmin = isAdminEmail(userEmail);

    // Obtener artistas de PostgreSQL
    // 1. Su propio perfil (id = pgUserId AND role = 'artist')
    // 2. Artistas generados por IA (generatedBy = pgUserId)
    // 3. Si es admin: también los artistas estáticos de BoostiSwap (generatedBy = NULL y isAIGenerated = false)
    const { or, isNull } = await import('drizzle-orm');
    
    let artistsFromPg;
    if (isAdmin) {
      // Admin ve: sus artistas + BoostiSwap artists (generatedBy NULL)
      artistsFromPg = await pgDb
        .select()
        .from(users)
        .where(
          or(
            eq(users.id, pgUserId),          // Su propio perfil
            eq(users.generatedBy, pgUserId), // Artistas generados por IA
            isNull(users.generatedBy)        // Artistas estáticos de BoostiSwap (admin only)
          )
        );
      console.log(`👑 Admin mode: incluyendo artistas de BoostiSwap`);
    } else {
      artistsFromPg = await pgDb
        .select()
        .from(users)
        .where(
          or(
            eq(users.id, pgUserId),          // Su propio perfil
            eq(users.generatedBy, pgUserId)   // Artistas generados por IA
          )
        );
    }

    console.log(`✅ Encontrados ${artistsFromPg.length} artistas en PostgreSQL (propio + IA generados${isAdmin ? ' + BoostiSwap' : ''})`);

    // Formatear respuesta
    const formattedArtists = artistsFromPg.map(artist => ({
      id: artist.id,
      firestoreId: artist.firestoreId,
      name: artist.artistName,
      slug: artist.slug,
      biography: artist.biography,
      profileImage: artist.profileImage,
      coverImage: artist.coverImage,
      bannerPosition: artist.bannerPosition,
      loopVideoUrl: artist.loopVideoUrl,
      genres: artist.genres,
      country: artist.country,
      location: artist.location,
      email: artist.email,
      phone: artist.phone,
      isAIGenerated: artist.isAIGenerated,
      isPublished: artist.isPublished,
      createdAt: artist.createdAt,
      instagram: artist.instagramHandle,
      twitter: artist.twitterHandle,
      youtube: artist.youtubeChannel,
      spotify: artist.spotifyUrl
    }));

    res.status(200).json({
      success: true,
      count: formattedArtists.length,
      artists: formattedArtists
    });
  } catch (error) {
    console.error('❌ Error obteniendo artistas del usuario:', error);
    res.status(500).json({ 
      error: 'Error al obtener artistas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Genera un slug único desde el nombre del artista
 */
function generateSlug(artistName: string, attempt = 0): string {
  const baseSlug = artistName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  return attempt > 0 ? `${baseSlug}-${attempt}` : baseSlug;
}

/**
 * GET /api/artist-generator/:artistId/master-json
 * Returns the Master Artist JSON for a specific artist
 */
router.get("/:artistId/master-json", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const clerkUserId = getClerkId(req);

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const artist = await pgDb
      .select({ id: users.id, masterJson: users.masterJson, generatedBy: users.generatedBy, firestoreId: users.firestoreId })
      .from(users)
      .where(eq(users.id, parseInt(artistId)))
      .limit(1);

    if (artist.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Verify ownership
    const userRecord = await pgDb.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (userRecord.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const pgUserId = userRecord[0].id;
    if (artist[0].id !== pgUserId && artist[0].generatedBy !== pgUserId && !isAdminEmail(req.user?.email)) {
      return res.status(403).json({ error: 'Not authorized to access this artist' });
    }

    if (!artist[0].masterJson) {
      return res.status(404).json({ error: 'Master JSON not yet generated for this artist' });
    }

    return res.status(200).json({ success: true, masterJson: artist[0].masterJson });
  } catch (error) {
    console.error('Error fetching master JSON:', error);
    return res.status(500).json({ error: 'Error fetching master JSON' });
  }
});

/**
 * PATCH /api/artist-generator/:artistId/master-json
 * Updates specific fields in the Master Artist JSON
 */
router.patch("/:artistId/master-json", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const clerkUserId = getClerkId(req);
    const updates = req.body;

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const artist = await pgDb
      .select({ id: users.id, masterJson: users.masterJson, generatedBy: users.generatedBy })
      .from(users)
      .where(eq(users.id, parseInt(artistId)))
      .limit(1);

    if (artist.length === 0) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Verify ownership
    const userRecord = await pgDb.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (userRecord.length === 0) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const pgUserId = userRecord[0].id;
    if (artist[0].id !== pgUserId && artist[0].generatedBy !== pgUserId && !isAdminEmail(req.user?.email)) {
      return res.status(403).json({ error: 'Not authorized to modify this artist' });
    }

    const currentMasterJson = (artist[0].masterJson as Record<string, unknown>) || {};
    const updatedMasterJson = { ...currentMasterJson, ...updates };

    await pgDb.update(users)
      .set({ masterJson: updatedMasterJson as any, updatedAt: new Date() })
      .where(eq(users.id, parseInt(artistId)));

    // Also update Firestore if artist has a firestoreId
    try {
      const artistFull = await pgDb.select({ firestoreId: users.firestoreId }).from(users).where(eq(users.id, parseInt(artistId))).limit(1);
      if (artistFull[0]?.firestoreId) {
        await db.collection('generated_artists').doc(artistFull[0].firestoreId).update({ masterJson: updatedMasterJson });
      }
    } catch (fsErr) {
      console.warn('Could not sync master JSON update to Firestore:', fsErr);
    }

    return res.status(200).json({ success: true, masterJson: updatedMasterJson });
  } catch (error) {
    console.error('Error updating master JSON:', error);
    return res.status(500).json({ error: 'Error updating master JSON' });
  }
});

/**
 * Guarda un artista generado en Firestore
 * @param artistData Datos del artista a guardar
 * @returns ID del documento creado
 */
async function saveArtistToFirestore(artistData: any): Promise<string> {
  try {
    // Usar la API de Firebase Admin correctamente
    const docRef = await db.collection('generated_artists').add({
      ...artistData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // Actualizar el documento recién creado para incluir su propio firestoreId
    await docRef.update({
      firestoreId: docRef.id
    });

    console.log(`Artista guardado con ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error al guardar artista en Firestore:', error);
    throw error;
  }
}

/**
 * Guarda un artista generado en PostgreSQL
 * @param artistData Datos del artista desde Firestore
 * @param firestoreId ID del documento en Firestore
 * @param userId ID del usuario creador (opcional)
 * @returns ID del usuario creado en PostgreSQL
 */
async function saveArtistToPostgreSQL(artistData: any, firestoreId: string, clerkUserId?: string): Promise<number> {
  try {
    // Obtener el ID de PostgreSQL del usuario basado en su clerkId
    let postgresUserId: number | null = null;
    if (clerkUserId) {
      const userRecord = await pgDb
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, clerkUserId))
        .limit(1);
      
      if (userRecord.length > 0) {
        postgresUserId = userRecord[0].id;
        console.log(`📍 Usuario PostgreSQL ID: ${postgresUserId} para Clerk ID: ${clerkUserId}`);
      } else {
        console.log(`⚠️ No se encontró usuario con Clerk ID: ${clerkUserId}`);
      }
    }

    // Generar slug único
    let slug = generateSlug(artistData.name);
    let attempt = 0;
    let slugExists = true;
    
    while (slugExists && attempt < 100) {
      const existing = await pgDb.select().from(users).where(eq(users.slug, slug)).limit(1);
      if (existing.length === 0) {
        slugExists = false;
      } else {
        attempt++;
        slug = generateSlug(artistData.name, attempt);
      }
    }

    // Mapear datos de Firestore a PostgreSQL
    const postgresData = {
      role: 'artist' as const,
      artistName: artistData.name,
      slug,
      biography: artistData.biography || null,
      profileImage: artistData.look?.profile_url || artistData.profileImage || null,
      coverImage: artistData.look?.cover_url || artistData.coverImage || null,
      realName: artistData.realName || null,
      country: artistData.country || null,
      genres: artistData.music_genres || [],
      email: artistData.management?.email || null,
      phone: artistData.management?.phone || null,
      instagramHandle: artistData.social_media?.instagram?.handle || null,
      twitterHandle: artistData.social_media?.twitter?.handle || null,
      youtubeChannel: artistData.social_media?.youtube?.handle || null,
      spotifyUrl: artistData.social_media?.spotify?.url || null,
      // Virtual Record Label fields
      firestoreId,
      isAIGenerated: true,
      generatedBy: postgresUserId,
      recordLabelId: null
    };

    const [newUser] = await pgDb.insert(users).values(postgresData).returning({ id: users.id });
    
    console.log(`Artista guardado en PostgreSQL con ID: ${newUser.id}`);
    return newUser.id;
  } catch (error) {
    console.error('Error al guardar artista en PostgreSQL:', error);
    throw error;
  }
}

/**
 * Endpoint para generar un artista aleatorio
 * Puede ser usado con o sin autenticación
 */
router.post("/generate-artist", async (req: Request, res: Response) => {
  try {
    console.log('Recibida solicitud para generar artista aleatorio');

    // Extract optional generation parameters from request body
    const { genre, style, gender, mood, artistName } = req.body || {};
    const generationParams = { genre, style, gender, mood, artistName };

    // 🧬 STEP 1: Generate Master Artist JSON — the canonical identity
    console.log('🧬 Generating Master Artist JSON...');
    const masterJson = await generateArtistMasterJSON(generationParams);
    const derivedParams = deriveParamsFromMaster(masterJson);
    console.log(`✅ Master JSON ready: "${masterJson.canonical.artist_name}" | ${masterJson.musical_dna?.primary_genre}`);

    // Generar datos del artista aleatorio usando los parámetros derivados del Master JSON
    const artistData = await generateRandomArtist(derivedParams);
    console.log('Artista generado exitosamente:', artistData.name);

    // 🖼️ GENERAR IMÁGENES DEL ARTISTA CON FAL AI NANO BANANA PRO
    console.log('🖼️ Generando imágenes del artista con FAL AI Nano Banana Pro...');
    let profileImageUrl = artistData.look?.profile_url || '';
    let coverImageUrl = artistData.look?.cover_url || '';

    try {
      const { generateArtistImagesWithFAL } = await import('../services/fal-service');
      const artistDescription = artistData.look?.description || `${artistData.name}, professional music artist`;
      const imgGenre = artistData.music_genres?.[0] || 'pop';
      
      const imageResult = await generateArtistImagesWithFAL(artistDescription, artistData.name, imgGenre);
      profileImageUrl = imageResult.profileUrl;
      coverImageUrl = imageResult.coverUrl;
      
      // Actualizar artistData con las imágenes generadas
      if (artistData.look) {
        artistData.look.profile_url = profileImageUrl;
        artistData.look.cover_url = coverImageUrl;
      }
      
      console.log(`✅ Imágenes generadas con FAL AI`);
    } catch (imageError) {
      console.error('⚠️ Error generando imágenes:', imageError);
      profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artistData.name)}&size=400&background=random`;
      coverImageUrl = `https://picsum.photos/seed/${artistData.name}/1200/400`;
    }

    // Actualizar artistData con las imágenes
    const artistDataWithImages = {
      ...artistData,
      look: {
        ...artistData.look,
        profile_url: profileImageUrl,
        cover_url: coverImageUrl
      }
    };

    // Guardar artista en Firestore
    const firestoreId = await saveArtistToFirestore(artistDataWithImages);
    console.log(`Artista guardado en Firestore con ID: ${firestoreId}`);

    // NUEVO: Guardar artista en PostgreSQL
    const postgresId = await saveArtistToPostgreSQL(artistDataWithImages, firestoreId);
    console.log(`Artista guardado en PostgreSQL con ID: ${postgresId}`);

    // Actualizar PostgreSQL con las imágenes y masterJson
    await pgDb.update(users)
      .set({
        profileImage: profileImageUrl,
        coverImage: coverImageUrl,
        masterJson: masterJson as any,
      })
      .where(eq(users.id, postgresId));

    // Actualizar Firestore con el ID de PostgreSQL y masterJson
    await db.collection('generated_artists').doc(firestoreId).update({ 
      firestoreId,
      postgresId,
      masterJson,
      'look.profile_url': profileImageUrl,
      'look.cover_url': coverImageUrl
    });

    // 🔗 REGISTRAR ARTISTA EN BLOCKCHAIN (BTF-2300 en Polygon)
    let blockchainResult: { 
      success: boolean; 
      artistId?: number; 
      tokenId?: number; 
      txHash?: string; 
      error?: string;
    } = { success: false, error: 'Blockchain service not available' };
    
    if (isBlockchainServiceAvailable()) {
      console.log('🔗 Registrando artista en blockchain BTF-2300...');
      blockchainResult = await registerArtistOnChain(
        undefined, // Usar platform wallet (el artista no tiene wallet aún)
        artistDataWithImages.name,
        postgresId
      );
      
      if (blockchainResult.success) {
        console.log(`✅ Artista registrado en Polygon!`);
        console.log(`   🆔 On-chain Artist ID: ${blockchainResult.artistId}`);
        console.log(`   🎫 NFT Token ID: ${blockchainResult.tokenId}`);
        console.log(`   🔗 Tx Hash: ${blockchainResult.txHash}`);
        
        // Guardar datos del blockchain en PostgreSQL
        await pgDb.update(users)
          .set({
            blockchainNetwork: 'polygon',
            blockchainArtistId: blockchainResult.artistId,
            blockchainTokenId: blockchainResult.tokenId?.toString(),
            blockchainTxHash: blockchainResult.txHash,
            blockchainContract: BTF2300_CONTRACT_ADDRESSES.artistToken,
            blockchainRegisteredAt: new Date(),
          })
          .where(eq(users.id, postgresId));
          
        // Actualizar Firestore con datos del blockchain
        await db.collection('generated_artists').doc(firestoreId).update({
          blockchain: {
            network: 'polygon',
            contract: BTF2300_CONTRACT_ADDRESSES.artistToken,
            artistId: blockchainResult.artistId,
            tokenId: blockchainResult.tokenId,
            txHash: blockchainResult.txHash,
            registeredAt: new Date().toISOString()
          }
        });
      } else {
        console.warn(`⚠️ No se pudo registrar en blockchain: ${blockchainResult.error}`);
      }
    } else {
      console.log('ℹ️ Blockchain service no disponible. Configura PLATFORM_PRIVATE_KEY para habilitar.');
    }

    // Añadir los IDs al objeto de artista
    const completeArtistData = {
      ...artistDataWithImages,
      firestoreId,
      postgresId,
      profileImage: profileImageUrl,
      coverImage: coverImageUrl,
      masterJson,
      // Datos del blockchain
      blockchain: blockchainResult.success ? {
        network: 'polygon',
        contract: BTF2300_CONTRACT_ADDRESSES.artistToken,
        artistId: blockchainResult.artistId,
        tokenId: blockchainResult.tokenId,
        txHash: blockchainResult.txHash
      } : null
    };

    // Devolver respuesta con datos completos del artista
    res.status(200).json(completeArtistData);
  } catch (error) {
    console.error('Error generando artista aleatorio:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Error al generar artista aleatorio',
        details: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
});

/**
 * Endpoint para crear un artista manualmente
 * 
 * 🔒 RESTRICCIONES:
 * - Requiere suscripción Premium/Enterprise
 * - Límite de 1 artista por cuenta (excepto admin)
 * - Admin (convoycubano@gmail.com) puede crear ilimitados
 */
router.post("/create-manual", isAuthenticated, async (req: Request, res: Response) => {
  try {
    console.log('📝 Recibida solicitud para crear artista manualmente');
    
    const userId = getClerkId(req);
    const userEmail = req.user?.email;
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado',
        code: 'AUTH_REQUIRED'
      });
    }

    // 🔒 VERIFICAR PERMISOS: Premium requerido + límite de 1 artista
    const permissionCheck = await canUserCreateArtist(userId, userEmail);
    
    if (!permissionCheck.canCreate) {
      console.log(`❌ Permission denied for user ${userId}: ${permissionCheck.reason}`);
      return res.status(403).json({
        error: permissionCheck.reason,
        code: permissionCheck.hasPremium ? 'LIMIT_REACHED' : 'PREMIUM_REQUIRED',
        artistCount: permissionCheck.artistCount,
        maxAllowed: MAX_ARTISTS_PER_USER,
        hasPremium: permissionCheck.hasPremium
      });
    }

    console.log(`✅ Permission granted for user ${userId} (Admin: ${permissionCheck.isAdmin}, Artists: ${permissionCheck.artistCount}/${MAX_ARTISTS_PER_USER})`);

    const { name, biography, genre, location, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ 
        error: 'Nombre y slug son requeridos' 
      });
    }

    // Verificar que el slug no exista
    const existingUser = await pgDb.select().from(users).where(eq(users.slug, slug)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe un artista con ese nombre' 
      });
    }

    // Usar el pgUserId del check de permisos para generatedBy
    const generatedByUserId = permissionCheck.pgUserId;

    // Crear artista en PostgreSQL
    const [newArtist] = await pgDb.insert(users).values({
      role: 'artist',
      artistName: name,
      slug,
      biography: biography || null,
      location: location || null,
      genres: genre ? [genre] : [],
      generatedBy: generatedByUserId, // Asociar al usuario creador (PostgreSQL ID)
      isAIGenerated: false, // No es generado por IA
      createdAt: new Date()
    }).returning();

    console.log(`✅ Artista creado manualmente con ID: ${newArtist.id}`);

    res.status(200).json({
      success: true,
      artist: {
        id: newArtist.id,
        name: newArtist.artistName,
        slug: newArtist.slug,
        biography: newArtist.biography,
        location: newArtist.location,
        genres: newArtist.genres,
        isAIGenerated: newArtist.isAIGenerated
      }
    });
  } catch (error) {
    console.error('❌ Error creando artista manualmente:', error);
    res.status(500).json({ 
      error: 'Error al crear artista',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Genera un título creativo para una canción basado en el contexto del artista
 */
function generateCreativeSongTitle(artistName: string, genre: string, mood: string): string {
  const titleTemplates: Record<string, string[]> = {
    'pop': ['Neon Dreams', 'Heartbeat', 'Electric Love', 'Midnight Dance', 'Golden Hour', 'Infinite', 'Stardust', 'Wildfire'],
    'hip-hop': ['Crown Me', 'No Cap', 'Real Talk', 'Stack It Up', 'Zone', 'Drip', 'Legacy', 'Grind Mode'],
    'rap': ['Bars on Fire', 'Untouchable', 'Flow State', 'King Shit', 'Never Fold', 'Run It', 'Boss Move', 'Street Dreams'],
    'electronic': ['Synthwave', 'Drop Zone', 'Neon Nights', 'Bass Drop', 'Electric Feel', 'Pulse', 'Euphoria', 'Rave On'],
    'rock': ['Thunder', 'Breaking Free', 'Rise Up', 'Burning Bright', 'Wild Heart', 'Louder', 'Unbreakable', 'Fire Inside'],
    'indie': ['Autumn Leaves', 'Quiet Storm', 'Fading Light', 'Paper Moon', 'Soft Glow', 'Daydream', 'Whispers', 'Gentle Rain'],
    'r&b': ['Silk', 'Midnight Hour', 'Body Talk', 'Sweet Escape', 'After Dark', 'Vibe', 'Slow Motion', 'Chemistry'],
    'latin': ['Fuego', 'Caliente', 'Ritmo', 'Bailar', 'Tropical Heat', 'Sabor', 'Noche Loca', 'Amor Eterno'],
    'reggaeton': ['Perreo', 'Flow Latino', 'Dembow', 'Gasolina', 'Calor', 'Bellaqueo', 'Movimiento', 'La Disco']
  };
  
  const moodPrefixes: Record<string, string[]> = {
    'energetic': ['High Energy', 'Electric', 'Fire', 'Explosive'],
    'mellow': ['Soft', 'Gentle', 'Calm', 'Peaceful'],
    'upbeat': ['Happy', 'Bright', 'Sunny', 'Joyful'],
    'dark': ['Shadow', 'Midnight', 'Dark', 'Deep'],
    'romantic': ['Love', 'Heart', 'Forever', 'Passion']
  };
  
  const genreTitles = titleTemplates[genre.toLowerCase()] || titleTemplates['pop'];
  const randomTitle = genreTitles[Math.floor(Math.random() * genreTitles.length)];
  
  // A veces añadir prefijo de mood
  if (Math.random() > 0.6) {
    const prefixes = moodPrefixes[mood] || moodPrefixes['energetic'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${prefix} ${randomTitle}`;
  }
  
  return randomTitle;
}

/**
 * Endpoint para generar una sola canción con IA
 * USA FAL AI MiniMax Music V2 para generar audio real con voces
 * Si no se proporciona título, genera uno automáticamente basado en el contexto del artista
 */
router.post("/generate-single-song", async (req: Request, res: Response) => {
  try {
    const {
      artistName, songTitle, genre, mood, artistId, artistGender, artistBio,
      // Blueprint-derived style fields (sent from client when blueprint is available)
      blueprintPrimaryGenre, blueprintVocalStyle, blueprintProductionStyle,
      blueprintInfluences, blueprintMoodKeywords, blueprintLyricThemes,
      blueprintSignatureSound, manualMusicStyle,
    } = req.body;
    
    if (!artistId) {
      return res.status(400).json({ 
        error: 'artistId es requerido' 
      });
    }
    
    // Blueprint genre takes priority when provided; otherwise fall back to sent genre
    const finalGenre = blueprintPrimaryGenre || genre || 'pop';
    const finalMood = mood || 'energetic';
    const finalArtistName = artistName || 'Artist';
    const finalGender = artistGender || 'male';
    
    // Fetch artist DNA from Firestore for coherent song generation
    let artistDNA: {
      biography?: string; musicGenres?: string[]; moodVibe?: string;
      lookDescription?: string; influences?: string[];
      vocalStyle?: string; productionStyle?: string; signatureSound?: string;
      moodKeywords?: string[]; lyricThemes?: string[];
    } | undefined;
    try {
      const artistDoc = await db.collection('generated_artists').doc(artistId).get();
      if (artistDoc.exists) {
        const data = artistDoc.data();
        artistDNA = {
          biography: data?.biography || artistBio || '',
          musicGenres: data?.music_genres || [finalGenre],
          moodVibe: data?.look?.description?.match(/mood:\s*([^.]+)/i)?.[1]?.trim() || '',
          lookDescription: data?.look?.description?.substring(0, 200) || '',
          influences: data?.epk?.factSheet?.influences || [],
        };
        console.log(`🧬 Artist DNA loaded for ${finalArtistName}: genres=[${artistDNA.musicGenres}], influences=[${artistDNA.influences}]`);
      }
    } catch (dnaErr) {
      console.warn('⚠️ Could not load artist DNA, proceeding without it');
    }

    // Layer in blueprint-derived enrichment (client may send from Superstar Blueprint)
    if (!artistDNA) artistDNA = {};
    if (blueprintVocalStyle) artistDNA.vocalStyle = blueprintVocalStyle;
    if (blueprintProductionStyle) artistDNA.productionStyle = blueprintProductionStyle;
    if (blueprintSignatureSound) artistDNA.signatureSound = blueprintSignatureSound;
    if (Array.isArray(blueprintInfluences) && blueprintInfluences.length) {
      artistDNA.influences = [...(artistDNA.influences || []), ...blueprintInfluences].slice(0, 6);
    }
    if (Array.isArray(blueprintMoodKeywords) && blueprintMoodKeywords.length) {
      artistDNA.moodKeywords = blueprintMoodKeywords;
    }
    if (Array.isArray(blueprintLyricThemes) && blueprintLyricThemes.length) {
      artistDNA.lyricThemes = blueprintLyricThemes;
    }
    // Manual style description overrides vocalStyle + productionStyle when provided
    if (manualMusicStyle) {
      artistDNA.productionStyle = manualMusicStyle;
    }

    // If blueprint provided genre sub-genres, include them
    if (blueprintPrimaryGenre && artistDNA.musicGenres) {
      if (!artistDNA.musicGenres.includes(blueprintPrimaryGenre)) {
        artistDNA.musicGenres = [blueprintPrimaryGenre, ...artistDNA.musicGenres].slice(0, 4);
      }
    }
    
    // Si no hay título, generar uno creativo basado en el contexto
    const finalSongTitle = songTitle?.trim() || generateCreativeSongTitle(finalArtistName, finalGenre, finalMood);
    
    console.log(`🎵 Generando canción: "${finalSongTitle}" para ${finalArtistName} (${finalGenre}/${finalMood})`);
    
    // Generar canción — PRIMARY: Lyria 3, FALLBACK: FAL MiniMax V2
    let audioUrl = '';
    let lyrics = '';
    let aiProvider = 'lyria-3-pro';
    
    // 🎵 PRIMARY: Google Lyria 3 Pro
    try {
      console.log(`🎵 [Lyria 3 PRIMARY] Generando: ${finalSongTitle} (${finalMood} ${finalGenre}, voz: ${finalGender})`);
      
      const lyria3Result = await generateArtistSongWithLyria3(
        finalArtistName,
        finalSongTitle,
        finalGenre,
        finalMood,
        finalGender,
        undefined, // customLyrics
        artistBio || '',
        artistDNA
      );
      
      if (lyria3Result.success && lyria3Result.audioUrl) {
        audioUrl = lyria3Result.audioUrl;
        lyrics = lyria3Result.lyrics || '';
        aiProvider = lyria3Result.provider || 'lyria-3-pro';
        console.log(`✅ [Lyria 3] Canción generada: ${audioUrl.substring(0, 60)}...`);
      } else {
        console.warn(`⚠️ [Lyria 3] Failed: ${lyria3Result.error} — Falling back to FAL MiniMax...`);
        throw new Error(lyria3Result.error || 'Lyria 3 generation failed');
      }
    } catch (lyria3Error) {
      // 🔄 FALLBACK: FAL AI MiniMax Music V2
      console.log(`🔄 [FALLBACK] Using FAL MiniMax V2 for ${finalSongTitle}...`);
      aiProvider = 'fal-minimax-music-v2';
      
      try {
        const musicResult = await generateArtistSongWithFAL(
          finalArtistName, 
          finalSongTitle, 
          finalGenre, 
          finalMood, 
          finalGender,
          undefined, // customLyrics
          artistBio || '',
          artistDNA
        );
        
        if (musicResult.success && musicResult.audioUrl) {
          audioUrl = musicResult.audioUrl;
          lyrics = musicResult.lyrics || '';
          console.log(`✅ [FAL Fallback] Canción generada: ${audioUrl.substring(0, 60)}...`);
        } else {
          console.warn(`⚠️ [FAL Fallback] Also failed: ${musicResult.error}`);
          return res.status(500).json({ 
            error: 'No se pudo generar la canción',
            details: musicResult.error
          });
        }
      } catch (falError) {
        console.error('❌ Both Lyria 3 and FAL failed:', falError);
        return res.status(500).json({ 
          error: 'Error al generar música',
          details: falError instanceof Error ? falError.message : 'Error desconocido'
        });
      }
    }
    
    // Guardar canción en Firestore
    try {
      const songDoc = await db.collection('songs').add({
        userId: artistId, // artistId aquí es el firestoreId del artista
        artistId: artistId,
        artistName: finalArtistName,
        name: finalSongTitle,
        title: finalSongTitle,
        audioUrl: audioUrl,
        genre: finalGenre,
        mood: finalMood,
        lyrics: lyrics,
        artistGender: finalGender,
        isPublished: true,
        generatedWithAI: true,
        aiProvider: aiProvider,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log(`✅ Canción guardada en Firestore con ID: ${songDoc.id}`);
      
      res.status(200).json({
        success: true,
        song: {
          id: songDoc.id,
          title: finalSongTitle,
          audioUrl: audioUrl,
          lyrics: lyrics,
          genre: finalGenre,
          mood: finalMood,
          artistName: finalArtistName
        }
      });
    } catch (firestoreError) {
      console.error('❌ Error guardando en Firestore:', firestoreError);
      // Aún devolver éxito si el audio se generó
      res.status(200).json({
        success: true,
        warning: 'Audio generado pero error al guardar en base de datos',
        song: {
          title: finalSongTitle,
          audioUrl: audioUrl,
          lyrics: lyrics,
          artistName: finalArtistName
        }
      });
    }
  } catch (error) {
    console.error('❌ Error en generate-single-song:', error);
    res.status(500).json({ 
      error: 'Error al generar canción',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * 🔁 Backfill / recuperación: regenera las 3 canciones tokenizadas de un artista
 * ya existente cuya generación quedó incompleta (timeout / reinicio del server).
 * Reusa generateTokenizedSongs → inserta en PostgreSQL + Firestore con tokens,
 * calendario de releases y bootstrap de monetización.
 * Si el artista ya tiene canciones, no hace nada salvo que se envíe { force: true }.
 */
router.post('/generate-songs/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ error: 'artistId inválido' });
    }
    const force = req.body?.force === true;

    // Cargar artista desde PostgreSQL
    const [artist] = await pgDb
      .select({ id: users.id, artistName: users.artistName, masterJson: users.masterJson })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);

    if (!artist) {
      return res.status(404).json({ error: 'Artista no encontrado' });
    }

    // ¿Ya tiene canciones?
    const [existing] = await pgDb
      .select({ n: count() })
      .from(songs)
      .where(eq(songs.userId, artistId));
    const existingCount = Number(existing?.n || 0);
    if (existingCount > 0 && !force) {
      return res.status(200).json({
        success: true,
        skipped: true,
        message: `El artista ya tiene ${existingCount} canción(es). Envía { "force": true } para regenerar.`,
        songsCreated: 0,
        existingCount,
      });
    }

    const masterJson: any = artist.masterJson || {};
    const genre = masterJson?.musical_dna?.primary_genre || 'Pop';
    const gender = (masterJson?.canonical?.gender === 'female' ? 'female' : 'male') as 'male' | 'female';

    // Localizar el firestoreId del artista (generated_artists.postgresId == artistId)
    let firestoreId = '';
    try {
      const snap = await db.collection('generated_artists').where('postgresId', '==', artistId).limit(1).get();
      if (!snap.empty) firestoreId = snap.docs[0].id;
    } catch (fsErr) {
      console.warn('⚠️ No se pudo localizar el doc de Firestore del artista:', fsErr);
    }

    const artistDNA = {
      biography: masterJson?.canonical?.biography_long || '',
      musicGenres: [masterJson?.musical_dna?.primary_genre, ...(masterJson?.musical_dna?.secondary_genres || [])].filter(Boolean) as string[],
      moodVibe: masterJson?.musical_dna?.mood_keywords?.[0] || '',
      lookDescription: masterJson?.visual_dna?.physical_description?.substring(0, 200) || '',
      influences: masterJson?.musical_dna?.influences || [],
    };

    console.log(`🔁 [backfill-songs] Regenerando canciones para #${artistId} ${artist.artistName} (${genre}/${gender})${force ? ' [FORCE]' : ''}`);

    const { tokenIds, scheduledSongs } = await generateTokenizedSongs(
      artistId,
      artist.artistName || 'Artist',
      genre,
      String(artistId),
      firestoreId,
      gender,
      artistDNA,
    );

    console.log(`✅ [backfill-songs] ${tokenIds.length} canciones creadas para #${artistId} ${artist.artistName}`);

    if (!res.headersSent) {
      res.status(200).json({
        success: true,
        artistId,
        artistName: artist.artistName,
        songsCreated: tokenIds.length,
        tokenIds,
        songs: scheduledSongs,
      });
    }
  } catch (error) {
    console.error('❌ Error en generate-songs (backfill):', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Error al regenerar canciones',
        details: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }
});

/**
 * Genera 3 canciones tokenizadas automáticas para un artista
 * USA FAL AI MiniMax Music V2 para generar audio real con voces y letras
 * Guarda en PostgreSQL Y en Firestore para sincronización
 */
async function generateTokenizedSongs(
  artistId: number, 
  artistName: string, 
  genre: string, 
  songOwnerId: string, // ID que se usará como userId en Firestore (usar postgresId para artistas generados)
  artistFirestoreId: string,
  artistGender: 'male' | 'female' = 'male',
  artistDNA?: { biography?: string; musicGenres?: string[]; moodVibe?: string; lookDescription?: string; influences?: string[] }
): Promise<{
  tokenIds: number[];
  scheduledSongs: Array<{
    songId: number;
    title: string;
    mood: string;
    tokenId: number;
    releaseDate: string;
    isPublished: boolean;
    lyrics?: string;
  }>;
}> {
  // Solo 3 canciones para reducir costos y tiempo
  // Genre-aware song configs with varied moods
  const GENRE_SONG_STYLES: Record<string, { moods: string[]; suffixes: string[] }> = {
    'reggae': { moods: ['mellow', 'upbeat', 'romantic'], suffixes: ['Riddim', 'Roots', 'Island Vibes'] },
    'soul': { moods: ['romantic', 'mellow', 'dark'], suffixes: ['Heart & Soul', 'Groove', 'Sunday Morning'] },
    'blues': { moods: ['dark', 'mellow', 'romantic'], suffixes: ['Blues', 'Crossroads', 'Delta Night'] },
    'gospel': { moods: ['upbeat', 'energetic', 'mellow'], suffixes: ['Praise', 'Glory', 'Testimony'] },
    'afrobeat': { moods: ['energetic', 'upbeat', 'romantic'], suffixes: ['Vibes', 'Groove', 'Dance'] },
    'trap': { moods: ['dark', 'energetic', 'dark'], suffixes: ['Mode', 'Drip', 'No Cap'] },
    'hip-hop': { moods: ['energetic', 'dark', 'mellow'], suffixes: ['Flow', 'Anthem', 'Chronicles'] },
    'rap': { moods: ['energetic', 'dark', 'mellow'], suffixes: ['Bars', 'Cypher', 'Legacy'] },
    'electronic': { moods: ['energetic', 'upbeat', 'dark'], suffixes: ['Drop', 'Frequency', 'Pulse'] },
    'rock': { moods: ['energetic', 'dark', 'mellow'], suffixes: ['Anthem', 'Thunder', 'Fire'] },
    'pop': { moods: ['upbeat', 'energetic', 'romantic'], suffixes: ['Hit', 'Spotlight', 'Tonight'] },
    'r&b': { moods: ['romantic', 'mellow', 'dark'], suffixes: ['Mood', 'Midnight', 'Feeling'] },
    'reggaeton': { moods: ['energetic', 'upbeat', 'romantic'], suffixes: ['Perreo', 'Fuego', 'Noche'] },
    'latin': { moods: ['romantic', 'energetic', 'upbeat'], suffixes: ['Corazón', 'Ritmo', 'Pasión'] },
    'indie': { moods: ['mellow', 'dark', 'romantic'], suffixes: ['Dreams', 'Golden Hour', 'Fading'] },
    'country': { moods: ['mellow', 'upbeat', 'romantic'], suffixes: ['Road', 'Hometown', 'Sunset'] },
    'jazz': { moods: ['mellow', 'romantic', 'dark'], suffixes: ['Blue Note', 'Moonlight', 'Satin'] },
    'k-pop': { moods: ['energetic', 'upbeat', 'romantic'], suffixes: ['Boom', 'Spotlight', 'Fantasy'] },
    'dancehall': { moods: ['energetic', 'upbeat', 'energetic'], suffixes: ['Bashment', 'Wine', 'Sound'] },
    'lo-fi': { moods: ['mellow', 'romantic', 'dark'], suffixes: ['Tape', 'Memories', 'Rainy Day'] },
    'house': { moods: ['energetic', 'upbeat', 'mellow'], suffixes: ['Groove', 'All Night', 'Feeling'] },
    'metal': { moods: ['dark', 'energetic', 'dark'], suffixes: ['Wrath', 'Inferno', 'Ashes'] },
    'punk': { moods: ['energetic', 'energetic', 'dark'], suffixes: ['Riot', 'Revolt', 'Anarchy'] },
    'disco': { moods: ['upbeat', 'energetic', 'romantic'], suffixes: ['Fever', 'Boogie', 'Glitter'] },
    'funk': { moods: ['energetic', 'upbeat', 'mellow'], suffixes: ['Groove', 'Funk', 'Get Down'] },
  };

  const genreLower = genre.toLowerCase();
  const genreStyle = GENRE_SONG_STYLES[genreLower] || GENRE_SONG_STYLES['pop'];
  
  const songConfigs = [
    { title: `${artistName} - ${genreStyle.suffixes[0]}`, mood: genreStyle.moods[0] },
    { title: `${artistName} - ${genreStyle.suffixes[1]}`, mood: genreStyle.moods[1] },
    { title: `${artistName} - ${genreStyle.suffixes[2]}`, mood: genreStyle.moods[2] },
  ];

  const tokenIds: number[] = [];
  const scheduledSongs: Array<{
    songId: number;
    title: string;
    mood: string;
    tokenId: number;
    releaseDate: string;
    isPublished: boolean;
    lyrics?: string;
  }> = [];
  const initialReleaseDate = new Date();

  console.log(`🎵 Generando ${songConfigs.length} canciones para ${artistName} (${artistGender}) con Google Lyria 3 Pro (fallback: FAL MiniMax)...`);

  for (let i = 0; i < songConfigs.length; i++) {
    const { title, mood } = songConfigs[i];
    const releaseDate = new Date(initialReleaseDate);
    releaseDate.setDate(initialReleaseDate.getDate() + i * 10);
    const isPublishedNow = i === 0;
    let audioUrl = '';
    let lyrics = '';
    let aiProvider = 'lyria-3-pro'; // Track which model generated the song

    // 🎵 PRIMARY: Google Lyria 3 Pro — DeepMind's most advanced music model
    // All 3 songs use Lyria 3 as primary, with FAL MiniMax as fallback
    try {
      console.log(`🎵 [Lyria 3 PRIMARY] Generating song ${i + 1}/${songConfigs.length}: ${title} (Voice: ${artistGender})...`);
      
      const lyria3Result = await generateArtistSongWithLyria3(
        artistName, title, genre, mood, artistGender, undefined, undefined, artistDNA
      );
      
      if (lyria3Result.success && lyria3Result.audioUrl) {
        audioUrl = lyria3Result.audioUrl;
        lyrics = lyria3Result.lyrics || '';
        aiProvider = lyria3Result.provider || 'lyria-3-pro';
        console.log(`✅ [Lyria 3] Song generated: ${audioUrl.substring(0, 60)}...`);
        if (lyrics) {
          console.log(`✅ [Lyria 3] Lyrics: ${lyrics.substring(0, 100)}...`);
        }
      } else {
        console.warn(`⚠️ [Lyria 3] Failed for ${title}: ${lyria3Result.error} — Falling back to FAL MiniMax...`);
        throw new Error(lyria3Result.error || 'Lyria 3 generation failed');
      }

      // Shorter pause for Lyria 3 (rate limit friendly)
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (lyria3Error) {
      // 🔄 FALLBACK: FAL AI MiniMax Music V2
      console.log(`🔄 [FALLBACK] Using FAL MiniMax V2 for ${title}...`);
      aiProvider = 'fal-minimax-music-v2';
      
      try {
        const musicResult = await generateArtistSongWithFAL(artistName, title, genre, mood, artistGender, undefined, undefined, artistDNA);
        
        if (musicResult.success && musicResult.audioUrl) {
          audioUrl = musicResult.audioUrl;
          lyrics = musicResult.lyrics || '';
          console.log(`✅ [FAL Fallback] Song generated: ${audioUrl.substring(0, 60)}...`);
        } else {
          console.warn(`⚠️ [FAL Fallback] Also failed for ${title}: ${musicResult.error}`);
          audioUrl = `https://storage.googleapis.com/boostify-music/samples/placeholder-${genre}.mp3`;
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (falError) {
        console.error(`❌ Both Lyria 3 and FAL failed for ${title}:`, falError);
        audioUrl = `https://storage.googleapis.com/boostify-music/samples/placeholder-${genre}.mp3`;
      }
    }

    // Guardar en PostgreSQL con letras y metadatos de AI
    const [song] = await pgDb.insert(songs).values({
      userId: artistId,
      title: title,
      description: `Tokenized song by ${artistName} - ${mood} ${genre} track`,
      audioUrl: audioUrl,
      releaseDate,
      genre: genre,
      mood: mood,
      lyrics: lyrics,
      artistGender: artistGender,
      generatedWithAI: true,
      aiProvider: aiProvider,
      isPublished: isPublishedNow
    }).returning({ id: songs.id });

    const tokenId = 1000 + artistId * 100 + i;
    const tokenSymbol = `${artistName.substring(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`;

    const [tokenizedSong] = await pgDb.insert(tokenizedSongs).values({
      artistId,
      songName: title,
      tokenId: tokenId,
      tokenSymbol: tokenSymbol,
      totalSupply: 1000,
      availableSupply: 1000,
      pricePerTokenUsd: `${10 + Math.random() * 90}`,
      royaltyPercentageArtist: 80,
      royaltyPercentagePlatform: 20,
      contractAddress: `0x${Math.random().toString(16).substring(2).padEnd(40, '0')}`,
      metadataUri: `ipfs://QmMeta${Math.random().toString(36).substring(7)}`,
      description: `Tokenized ${mood} ${genre} music by ${artistName}`,
      benefits: ['Exclusive Access', 'Revenue Share', 'Creator Rights'],
      isActive: true
    }).returning({ id: tokenizedSongs.id });

    // 🔥 Guardar también en Firestore para sincronización (con letras)
    try {
      await db.collection('songs').add({
        userId: songOwnerId, // Usar songOwnerId (postgresId) para que el cliente encuentre las canciones
        artistId: artistFirestoreId,
        name: title,
        title: title,
        audioUrl: audioUrl, // URL real del audio generado
        releaseDate: releaseDate.toISOString(),
        genre: genre,
        mood: mood,
        lyrics: lyrics, // Letras generadas por AI
        artistGender: artistGender,
        tokenId: tokenId,
        tokenSymbol: tokenSymbol,
        isPublished: isPublishedNow,
        generatedWithAI: true,
        aiProvider: aiProvider,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log(`✅ Canción sincronizada a Firestore #${i + 1}: ${title}`);
    } catch (firebaseError) {
      console.warn(`⚠️ Error guardando en Firestore:`, firebaseError);
    }

    tokenIds.push(tokenId);
    scheduledSongs.push({
      songId: song.id,
      title,
      mood,
      tokenId,
      releaseDate: releaseDate.toISOString(),
      isPublished: isPublishedNow,
      lyrics: lyrics || undefined,
    });

    try {
      const calendarStart = new Date(releaseDate);
      const calendarEnd = new Date(releaseDate);
      calendarEnd.setHours(calendarEnd.getHours() + 1);

      await pgDb.insert(managerSchedule).values({
        userId: artistId,
        title: `Song Release: ${title}`,
        description: `Automated release event for ${artistName} (${genre}) - token ${tokenSymbol}`,
        startTime: calendarStart,
        endTime: calendarEnd,
        location: 'Boostify Digital Platforms',
        type: 'other',
        status: 'scheduled',
      });
    } catch (scheduleError) {
      console.warn(`⚠️ Could not create manager schedule entry for song ${title}:`, scheduleError);
    }

    console.log(`✅ Creada canción tokenizada #${i + 1}: ${title} (Token ID: ${tokenId})`);
  }

  console.log(`🎵 Generación de canciones completada: ${tokenIds.length} canciones creadas`);

  // Trigger monetization pipeline for the immediately-published song (day 0)
  // Skip tokenization since we already created the record above
  const publishedSong = scheduledSongs.find((s) => s.isPublished);
  if (publishedSong) {
    try {
      const { triggerSongMonetizationPipeline } = await import('../services/song-monetization-pipeline');
      triggerSongMonetizationPipeline(publishedSong.songId, { skipTokenization: true }).catch((err) =>
        console.warn(`⚠️ Monetization pipeline error for song #${publishedSong.songId}:`, err.message),
      );
    } catch (importErr) {
      console.warn('⚠️ Could not trigger monetization pipeline:', importErr);
    }
  }

  return { tokenIds, scheduledSongs };
}

async function bootstrapArtistMonetizationModules(
  artistId: number,
  artistName: string,
  genre: string,
): Promise<{ crowdfundingInitialized: boolean; explicitInitialized: boolean }> {
  let crowdfundingInitialized = false;
  let explicitInitialized = false;

  try {
    const existingCampaign = await pgDb.select({ id: crowdfundingCampaigns.id })
      .from(crowdfundingCampaigns)
      .where(eq(crowdfundingCampaigns.userId, artistId))
      .limit(1);

    if (existingCampaign.length === 0) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);

      await pgDb.insert(crowdfundingCampaigns).values({
        userId: artistId,
        title: `Launch Campaign: ${artistName}`,
        description: `Support ${artistName} and fund the next ${genre} era. Campaign auto-created by Boostify Launch Orchestrator.`,
        goalAmount: '25000.00',
        currentAmount: '0.00',
        isActive: false,
        endDate,
        contributorsCount: 0,
      });
    }
    crowdfundingInitialized = true;
  } catch (campaignError) {
    console.warn('⚠️ Error bootstrapping crowdfunding campaign:', campaignError);
  }

  try {
    const existingExplicit = await pgDb.select({ id: explicitSettings.id })
      .from(explicitSettings)
      .where(eq(explicitSettings.artistId, artistId))
      .limit(1);

    if (existingExplicit.length === 0) {
      await pgDb.insert(explicitSettings).values({
        artistId,
        enabled: true,
        monthlyPrice: '9.99',
        yearlyPrice: '89.99',
        singleContentPrice: '4.99',
        welcomeMessage: `Welcome to ${artistName} exclusive content.`,
        contentCategories: ['behind-the-scenes', 'vip-drops', 'studio-moments'],
        chatEnabled: true,
        aiGenerationEnabled: true,
        watermarkEnabled: true,
      });
    }
    explicitInitialized = true;
  } catch (explicitError) {
    console.warn('⚠️ Error bootstrapping explicit settings:', explicitError);
  }

  return { crowdfundingInitialized, explicitInitialized };
}

/**
 * Genera contenido de redes sociales para el artista
 */
async function generateArtistSocialContent(artistId: number, artistName: string, biography: string, slug: string): Promise<any> {
  try {

type LaunchTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
type LaunchTaskKey =
  | 'merchandise'
  | 'news'
  | 'epk'
  | 'profileVideo'
  | 'socialMedia'
  | 'blockchain'
  | 'email'
  | 'crowdfunding'
  | 'explicit';

function buildInitialLaunchTasksState(
  monetizationBootstrap: { crowdfundingInitialized: boolean; explicitInitialized: boolean },
) {
  const now = new Date().toISOString();
  return {
    merchandise: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    news: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    epk: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    profileVideo: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    socialMedia: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    blockchain: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    email: { status: 'pending' as LaunchTaskStatus, attempts: 0, lastUpdatedAt: now },
    crowdfunding: {
      status: (monetizationBootstrap.crowdfundingInitialized ? 'completed' : 'failed') as LaunchTaskStatus,
      attempts: 1,
      lastUpdatedAt: now,
      completedAt: now,
    },
    explicit: {
      status: (monetizationBootstrap.explicitInitialized ? 'completed' : 'failed') as LaunchTaskStatus,
      attempts: 1,
      lastUpdatedAt: now,
      completedAt: now,
    },
  };
}

async function updateLaunchTaskState(
  firestoreId: string,
  taskKey: LaunchTaskKey,
  status: LaunchTaskStatus,
  options?: { attempts?: number; error?: string },
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    [`launchTasks.${taskKey}.status`]: status,
    [`launchTasks.${taskKey}.lastUpdatedAt`]: now,
  };

  if (typeof options?.attempts === 'number') {
    payload[`launchTasks.${taskKey}.attempts`] = options.attempts;
  }

  if (options?.error) {
    payload[`launchTasks.${taskKey}.error`] = options.error.substring(0, 400);
  }

  if (status === 'completed' || status === 'failed' || status === 'skipped') {
    payload[`launchTasks.${taskKey}.completedAt`] = now;
  }

  await db.collection('generated_artists').doc(firestoreId).update(payload);
}

async function processArtistLaunchBackgroundTasks(params: {
  postgresId: number;
  firestoreId: string;
  artistName: string;
  artistData: DocumentData;
  artistSlug: string;
  profileImageUrl: string;
  genre: string;
  biography: string;
  tokenIds: number[];
  emailAddress?: string;
  userName?: string;
  scheduledSongs?: Array<{ songId: number; title: string; releaseDate: string; isPublished: boolean; lyrics?: string }>;
}) {
  const {
    postgresId,
    firestoreId,
    artistName,
    artistData,
    artistSlug,
    profileImageUrl,
    genre,
    biography,
    tokenIds,
    emailAddress,
    userName,
  } = params;

  const MAX_RETRIES = 3;
  const RETRY_BASE_MS = 5000;

  const runTrackedTask = async (
    taskKey: Exclude<LaunchTaskKey, 'crowdfunding' | 'explicit'>,
    taskRunner: () => Promise<unknown>,
  ) => {
    let lastError = '';
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await updateLaunchTaskState(firestoreId, taskKey, 'running', { attempts: attempt });
      try {
        await taskRunner();
        await updateLaunchTaskState(firestoreId, taskKey, 'completed', { attempts: attempt });
        return { taskKey, status: 'completed' as const };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown task error';
        console.warn(`⚠️ [Background] ${taskKey} attempt ${attempt}/${MAX_RETRIES} failed: ${lastError}`);
        if (attempt < MAX_RETRIES) {
          const backoffMs = RETRY_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }
    console.error(`❌ [Background] ${taskKey} failed after ${MAX_RETRIES} attempts: ${lastError}`);
    await updateLaunchTaskState(firestoreId, taskKey, 'failed', { attempts: MAX_RETRIES, error: lastError });
    return { taskKey, status: 'failed' as const, error: lastError };
  };

  const tasks: Array<Promise<{ taskKey: string; status: 'completed' | 'failed' | 'skipped'; error?: string }>> = [
    // NOTE: Merchandise is NOT auto-generated here.
    // The artist must manually trigger product generation from their Official Store page.
    // Products require a completed Superstar Blueprint first — see POST /api/store/ai/generate-design/:userId
    runTrackedTask('news', async () => {
      // 🎵 REGENERATE BIOGRAPHY with song lyrics context for coherence
      const songContext = (params.scheduledSongs || [])
        .filter(s => s.lyrics)
        .map(s => ({ title: s.title, lyrics: s.lyrics, mood: undefined as string | undefined }));
      
      if (songContext.length > 0) {
        try {
          const { generateArtistBiography } = await import('../services/gemini-profile-service');
          const bioResult = await generateArtistBiography({
            name: artistName,
            genre,
            location: artistData.country || undefined,
            influences: artistData.epk?.factSheet?.influences?.join(', ') || undefined,
            songContext,
          });
          if (bioResult.success && bioResult.biography) {
            // Update biography in PostgreSQL and Firestore
            await pgDb.update(users).set({ biography: bioResult.biography }).where(eq(users.id, postgresId));
            await db.collection('generated_artists').doc(firestoreId).update({ biography: bioResult.biography });
            console.log(`✅ [Background] Biography regenerated with song lyrics context (${bioResult.biography.length} chars)`);
          }
        } catch (bioErr) {
          console.warn('⚠️ [Background] Biography regeneration with lyrics context failed:', bioErr);
        }
      }

      // Use event-driven news orchestrator with full calendar
      const { scheduleArtistNewsCalendar } = await import('../services/news-event-orchestrator');
      const songTitles = (params.scheduledSongs || []).map(s => s.title);
      const firstRelease = params.scheduledSongs?.[0]?.releaseDate
        ? new Date(params.scheduledSongs[0].releaseDate)
        : new Date();
      // Build lyrics map: { "Song Title": "lyrics text" }
      const songLyricsMap: Record<string, string> = {};
      for (const s of params.scheduledSongs || []) {
        if (s.lyrics) songLyricsMap[s.title] = s.lyrics;
      }
      await scheduleArtistNewsCalendar(
        postgresId,
        artistName,
        genre,
        biography,
        songTitles,
        firstRelease,
        Object.keys(songLyricsMap).length > 0 ? songLyricsMap : undefined,
      );
    }),
    runTrackedTask('epk', () =>
      generateArtistEPKComplete(
        postgresId,
        artistName,
        { ...artistData, firestoreId },
        profileImageUrl,
      ),
    ),
    runTrackedTask('profileVideo', () =>
      generateArtistProfileVideoBackground(
        postgresId,
        firestoreId,
        artistName,
        profileImageUrl,
        genre,
      ),
    ),
    runTrackedTask('socialMedia', () =>
      generateArtistSocialContent(
        postgresId,
        artistName,
        biography,
        artistSlug,
      ),
    ),
  ];

  if (isBlockchainServiceAvailable()) {
    tasks.push(
      runTrackedTask('blockchain', async () => {
        const result = await registerArtistOnChain(undefined, artistName, postgresId);
        if (result.success) {
          await pgDb.update(users).set({
            blockchainNetwork: 'polygon',
            blockchainArtistId: result.artistId,
            blockchainTokenId: result.tokenId?.toString(),
            blockchainTxHash: result.txHash,
            blockchainContract: BTF2300_CONTRACT_ADDRESSES.artistRegistry,
            blockchainRegisteredAt: new Date(),
          }).where(eq(users.id, postgresId));
        } else {
          throw new Error(result.error || 'Blockchain registration unsuccessful');
        }
      }),
    );
  } else {
    await updateLaunchTaskState(firestoreId, 'blockchain', 'skipped', { attempts: 0 });
    tasks.push(Promise.resolve({ taskKey: 'blockchain', status: 'skipped' as const }));
  }

  if (emailAddress) {
    tasks.push(
      runTrackedTask('email', () =>
        sendArtistGeneratedEmail({
          userEmail: emailAddress,
          userName: userName || 'Artist Creator',
          artistName,
          artistSlug,
          profileImageUrl,
          genres: [genre],
          songsCount: tokenIds.length,
          tokenSymbol: `BTF-${artistName.substring(0, 3).toUpperCase()}`,
        }),
      ),
    );
  } else {
    await updateLaunchTaskState(firestoreId, 'email', 'skipped', { attempts: 0 });
    tasks.push(Promise.resolve({ taskKey: 'email', status: 'skipped' as const }));
  }

  const settled = await Promise.allSettled(tasks);
  let completed = 0;
  let failed = 0;
  let skipped = 0;

  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value.status === 'completed') completed += 1;
      if (result.value.status === 'failed') failed += 1;
      if (result.value.status === 'skipped') skipped += 1;
    } else {
      failed += 1;
    }
  });

  await db.collection('generated_artists').doc(firestoreId).update({
    backgroundTasksPending: false,
    backgroundTasksCompletedAt: Timestamp.now(),
    backgroundTasksSummary: {
      total: tasks.length,
      completed,
      failed,
      skipped,
    },
    'launchPlan.status': failed > 0 ? 'partial_failed' : 'ready',
    launchCompletedAt: new Date().toISOString(),
  });
}
    const profileUrl = `https://boostify.app/artist/${slug}`;
    const socialContent = await generateSocialMediaContent(artistName, biography, profileUrl, artistId);
    console.log('✅ Contenido de redes sociales generado:', socialContent);
    return socialContent;
  } catch (error) {
    console.error('⚠️ Error generando contenido social:', error);
    return { success: false, error: 'No se pudo generar contenido social' };
  }
}

/**
 * Genera 5 noticias de prensa automáticamente para el artista (Background task)
 * Incluye: Release, Performance, Collaboration, Achievement, Lifestyle
 */
async function generateArtistNewsAutomatic(
  artistId: number, 
  artistName: string, 
  genre: string, 
  biography: string,
  profileImageUrl: string
): Promise<{ success: boolean; newsCount: number }> {
  try {
    console.log(`📰 [Background] Generando 5 noticias para ${artistName}...`);
    
    // Descargar imagen del perfil para usar como referencia
    let profileImageBase64: string | null = null;
    if (profileImageUrl) {
      profileImageBase64 = await downloadImageAsBase64(profileImageUrl);
    }
    
    const newsCategories = [
      { category: "release", title: "New Release" },
      { category: "performance", title: "Live Performance" },
      { category: "collaboration", title: "Collaboration" },
      { category: "achievement", title: "Achievement" },
      { category: "lifestyle", title: "Lifestyle" }
    ];
    
    let newsCreated = 0;
    
    for (const { category, title } of newsCategories) {
      try {
        // Generar texto con OpenAI + OpenRouter fallback
        const _newsSystemPrompt = "You are a professional music journalist. Write engaging, authentic news articles about artists.";
        const _newsUserPrompt = `Write a compelling ${category} news article about ${artistName}, a ${genre} artist. Biography: ${biography}. Format as JSON: {"title": "...", "content": "2-3 paragraphs", "summary": "1 sentence"}`;
        const rawNewsText = await withTextFallback(
          async () => {
            const response = await openai.chat.completions.create({
              model: PRIMARY_MODEL,
              messages: [
                { role: "system", content: _newsSystemPrompt },
                { role: "user", content: _newsUserPrompt }
              ],
              response_format: { type: "json_object" },
              max_tokens: 500
            });
            return response.choices[0]?.message?.content?.trim() || null;
          },
          { label: `generateNews-${category}`, prompt: _newsUserPrompt, systemPrompt: _newsSystemPrompt, maxTokens: 500, returnNullOnFailure: true }
        );
        const newsContent = rawNewsText ? JSON.parse(rawNewsText) : {};
        
        // Generar imagen hiper-realista (gpt-image-2/edit con rostro real del artista)
        let imageUrl = profileImageUrl; // Fallback
        try {
          const imageResult = await generateNewsImage({
            title: newsContent.title || `${artistName} - ${title}`,
            artistName,
            genre,
            category,
            context: newsContent.summary || newsContent.content,
            referenceImageUrl: profileImageUrl || null,
            aspectRatio: '16:9',
          });
          if (imageResult?.imageUrl) {
            imageUrl = imageResult.imageUrl;
          }
        } catch (imgErr) {
          console.warn(`⚠️ [Background] Image generation failed for ${category} news, using fallback`);
        }
        
        // Guardar en PostgreSQL
        await pgDb.insert(artistNews).values({
          userId: artistId,
          artistId: artistId,
          title: newsContent.title || `${artistName} - ${title}`,
          content: newsContent.content || `Exciting news about ${artistName}!`,
          summary: newsContent.summary || `Latest update from ${artistName}`,
          imageUrl: imageUrl,
          category: category,
          source: 'AI Generated',
          publishedAt: new Date(),
          createdAt: new Date()
        });
        
        newsCreated++;
        console.log(`✅ [Background] News ${newsCreated}/5 created: ${category}`);
        
      } catch (newsErr) {
        console.error(`⚠️ [Background] Error creating ${category} news:`, newsErr);
      }
    }
    
    console.log(`✅ [Background] ${newsCreated}/5 noticias creadas para ${artistName}`);
    return { success: true, newsCount: newsCreated };
    
  } catch (error) {
    console.error('❌ [Background] Error generating news:', error);
    return { success: false, newsCount: 0 };
  }
}

/**
 * Genera EPK completo con IA para el artista (Background task)
 * Incluye: Biografía mejorada, logros, citas, fact sheet, fotos de prensa
 */
async function generateArtistEPKComplete(
  artistId: number, 
  artistName: string, 
  artistData: any,
  profileImageUrl: string
): Promise<any> {
  try {
    console.log(`📄 [Background] Generando EPK completo para ${artistName}...`);
    
    const genre = artistData.music_genres?.[0] || 'Pop';
    const biography = artistData.biography || '';
    
    // 1. Generar biografía mejorada y datos con OpenAI + OpenRouter fallback
    const _epkSystemPrompt = "You are a professional music publicist creating press materials for artists.";
    const _epkUserPrompt = `Create a complete EPK (Electronic Press Kit) for ${artistName}, a ${genre} artist. 
Original bio: ${biography}

Generate JSON with:
{
  "enhancedBiography": "Professional 3-paragraph biography",
  "shortBio": "One sentence bio for quick press",
  "achievements": ["5 realistic achievements/milestones"],
  "quotes": ["3 inspirational quotes from the artist"],
  "factSheet": {
    "hometown": "city, country",
    "yearsActive": "year - present",
    "label": "Independent or label name",
    "influences": ["3 musical influences"],
    "instruments": ["instruments they play"]
  },
  "pressHighlights": ["3 notable press mentions or features"]
}`;
    const rawEpkText = await withTextFallback(
      async () => {
        const response = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            { role: "system", content: _epkSystemPrompt },
            { role: "user", content: _epkUserPrompt }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1000
        });
        return response.choices[0]?.message?.content?.trim() || null;
      },
      { label: 'generateEPKText', prompt: _epkUserPrompt, systemPrompt: _epkSystemPrompt, maxTokens: 1000, returnNullOnFailure: true }
    );
    const epkTextData = rawEpkText ? JSON.parse(rawEpkText) : {};
    
    // 2. Generar 3 fotos de prensa con FAL AI
    const pressPhotos: string[] = [];
    const photoPrompts = [
      `Professional press headshot of ${genre} music artist, studio lighting, clean background`,
      `${genre} artist performing live on stage, dramatic concert lighting`,
      `Behind the scenes photo of ${genre} musician in recording studio`
    ];
    
    let profileImageBase64: string | null = null;
    if (profileImageUrl) {
      profileImageBase64 = await downloadImageAsBase64(profileImageUrl);
    }
    
    for (const prompt of photoPrompts) {
      try {
        if (profileImageBase64) {
          const imageResult = await generateImageWithFaceReferenceFAL(
            prompt,
            profileImageBase64,
            { width: 1024, height: 1024, num_outputs: 1 }
          );
          if (imageResult?.images?.[0]?.url) {
            pressPhotos.push(imageResult.images[0].url);
          }
        } else {
          const imageResult = await generateImageWithNanoBanana(prompt);
          if (imageResult?.images?.[0]?.url) {
            pressPhotos.push(imageResult.images[0].url);
          }
        }
      } catch (imgErr) {
        console.warn('⚠️ [Background] Press photo generation failed');
      }
    }
    
    // 3. Compilar EPK completo
    const completeEPK = {
      artistName,
      genre,
      enhancedBiography: epkTextData.enhancedBiography || biography,
      shortBio: epkTextData.shortBio || `${artistName} is an emerging ${genre} artist.`,
      achievements: epkTextData.achievements || [],
      quotes: epkTextData.quotes || [],
      factSheet: epkTextData.factSheet || {},
      pressHighlights: epkTextData.pressHighlights || [],
      pressPhotos: pressPhotos,
      socialLinks: {
        instagram: artistData.social_media?.instagram?.url,
        spotify: artistData.social_media?.spotify?.url,
        youtube: artistData.social_media?.youtube?.url,
        tiktok: artistData.social_media?.tiktok?.url
      },
      profileImage: profileImageUrl,
      generatedAt: new Date().toISOString()
    };
    
    // 4. Guardar en Firebase
    await db.collection('generated_artists').doc(artistData.firestoreId || String(artistId)).update({
      epk: completeEPK,
      epkGenerated: true,
      epkGeneratedAt: Timestamp.now()
    });
    
    console.log(`✅ [Background] EPK completo generado para ${artistName} con ${pressPhotos.length} fotos`);
    return completeEPK;
    
  } catch (error) {
    console.error('❌ [Background] Error generating EPK:', error);
    return null;
  }
}

/**
 * Genera merchandise en background (6 productos)
 * Requiere un Superstar Blueprint completado — sin Blueprint, no genera nada.
 * Los productos se guardan como DRAFT (isAvailable: false) para que el artista los apruebe.
 * El sync automático a Printful está DESACTIVADO — el artista debe activar cada producto manualmente.
 */
async function generateArtistMerchandiseBackground(
  artistId: number,
  firestoreId: string,
  artistName: string,
  profileImageUrl: string,
  genre: string
): Promise<void> {
  try {
    console.log(`🛍️ [Background] Verificando Blueprint antes de generar merchandise para ${artistName}...`);

    // ── Blueprint Gate: only generate if the Superstar Blueprint is completed ──
    const [bp] = await pgDb
      .select({
        id: artistBlueprints.id,
        brandArchetype: artistBlueprints.brandArchetype,
        currentEra: artistBlueprints.currentEra,
        primaryGenre: artistBlueprints.primaryGenre,
        blueprintJson: artistBlueprints.blueprintJson,
        generationStatus: artistBlueprints.generationStatus,
      })
      .from(artistBlueprints)
      .where(
        and(
          eq(artistBlueprints.artistId, artistId),
          eq(artistBlueprints.generationStatus, 'completed'),
        ),
      )
      .limit(1);

    if (!bp) {
      console.log(`⏭️ [Background] Merchandise generation skipped — no completed Superstar Blueprint for artist ${artistId} (${artistName}). Artist must generate their Blueprint first.`);
      return;
    }

    console.log(`✅ [Background] Blueprint found (${bp.brandArchetype || 'archetype pending'}) — generating 6 draft merchandise products for ${artistName}...`);

    const merchandiseProducts = await generateArtistMerchandise(artistName, profileImageUrl, bp.primaryGenre || genre);

    // Category normalization: Firestore display → PostgreSQL enum
    const normalizeCategoryForPG = (type: string): 'apparel' | 'accessories' | 'music' | 'other' => {
      if (type === 'T-Shirt' || type === 'Hoodie') return 'apparel';
      if (type === 'Cap' || type === 'Sticker Pack' || type === 'Mug') return 'accessories';
      if (type === 'Poster') return 'other';
      return 'other';
    };

    const sizesForType = (type: string): string[] => {
      if (type === 'T-Shirt' || type === 'Hoodie') return ['S', 'M', 'L', 'XL', 'XXL'];
      if (type === 'Cap') return ['One Size'];
      if (type === 'Poster') return ['18x24"', '24x36"'];
      if (type === 'Mug') return ['11oz', '15oz'];
      return ['Standard'];
    };

    const displayCategory = (type: string): string => {
      if (type === 'T-Shirt' || type === 'Hoodie') return 'Apparel';
      if (type === 'Cap' || type === 'Sticker Pack' || type === 'Mug') return 'Accessories';
      if (type === 'Poster') return 'Art';
      return 'Accessories';
    };
    
    // ── 1. Guardar en Firestore (documento del artista) — productos como DRAFT ──
    // Products use "Artist Name — Product Name" format and are saved as drafts.
    // The artist must review and publish them from their Official Store dashboard.
    const draftProducts = merchandiseProducts.map(p => ({
      ...p,
      name: `${artistName} — ${p.name}`,
      isAvailable: false,
      productStatus: 'archived', // draft until artist approves
    }));

    await db.collection('generated_artists').doc(firestoreId).update({
      merchandise: draftProducts,
      merchandiseGenerated: true,
      merchandiseGeneratedAt: Timestamp.now(),
      merchandisePendingApproval: true,
    });
    
    // ── 2. Guardar cada producto en Firestore colección 'merchandise' como DRAFT ──
    for (const product of draftProducts) {
      const merchDoc = {
        name: product.name,
        description: `Official ${artistName} merchandise • ${product.type} • Boostify Music`,
        price: product.price,
        imageUrl: product.imageUrl,
        category: displayCategory(product.type),
        sizes: sizesForType(product.type),
        userId: artistId,
        artistName: artistName,
        isAvailable: false,
        productStatus: 'archived',
        aiGeneratedDesign: true,
        createdAt: Timestamp.now(),
        generatedByAI: true,
        blueprintId: bp.id,
        brandArchetype: bp.brandArchetype || null,
      };
      await db.collection('merchandise').add(merchDoc);
    }

    // ── 3. Persistir en PostgreSQL merchandise table como DRAFT (dual-write) ──
    for (const product of draftProducts) {
      try {
        await pgDb.insert(merchandise).values({
          userId: artistId,
          name: product.name,
          description: `Official ${artistName} merchandise • ${product.type} • Boostify Music`,
          price: product.price.toFixed(2),
          images: product.imageUrl ? [product.imageUrl] : [],
          category: normalizeCategoryForPG(product.type),
          stock: 100,
          isAvailable: false, // Draft — requires artist approval before going live
          aiGeneratedDesign: true,
          isCustomDesign: false,
          removeBoostifyLogo: false,
        });
      } catch (pgInsertErr) {
        console.warn(`⚠️ [Background] PG merchandise insert failed for ${product.name}:`, pgInsertErr);
      }
    }

    // ── NOTE: Printful auto-sync is INTENTIONALLY DISABLED ──
    // Products are saved as drafts (isAvailable: false). The artist must review each
    // product in their Official Store dashboard and manually publish them before
    // they sync to Printful. This prevents live products from going out without consent.

    console.log(`✅ [Background] ${draftProducts.length} draft merchandise products created for ${artistName} (Firestore + PostgreSQL). Artist must review and publish from their store.`);
  } catch (error) {
    console.error('❌ [Background] Error generating merchandise:', error);
    throw error;
  }
}

/**
 * Genera video de perfil animado para el artista (Background task)
 * Usa FAL AI Wan 2.6 para convertir la imagen de perfil en un video loop
 */
async function generateArtistProfileVideoBackground(
  artistId: number,
  firestoreId: string,
  artistName: string,
  profileImageUrl: string,
  genre: string
): Promise<void> {
  try {
    console.log(`🎬 [Background] Generando video de perfil para ${artistName}...`);
    
    const videoResult = await generateArtistProfileVideo(profileImageUrl, artistName, genre);
    
    if (videoResult.success && videoResult.videoUrl) {
      console.log(`✅ [Background] Video de perfil generado: ${videoResult.videoUrl.substring(0, 60)}...`);
      
      // Actualizar PostgreSQL con el loopVideoUrl
      await pgDb.update(users).set({
        loopVideoUrl: videoResult.videoUrl
      }).where(eq(users.id, artistId));
      
      // Actualizar Firestore
      await db.collection('generated_artists').doc(firestoreId).update({
        loopVideoUrl: videoResult.videoUrl,
        profileVideoGenerated: true,
        profileVideoGeneratedAt: Timestamp.now()
      });
      
      console.log(`✅ [Background] Video de perfil guardado en DB para ${artistName}`);
    } else {
      console.warn(`⚠️ [Background] No se pudo generar video: ${videoResult.error}`);
    }
  } catch (error) {
    console.error('❌ [Background] Error generating profile video:', error);
  }
}

/**
 * Genera EPK automático para el artista (versión simple, legacy)
 */
async function generateArtistEPK(artistId: number, artistName: string, artistData: any): Promise<any> {
  try {
    const epkData = {
      artistName,
      genre: artistData.music_genres || ['Pop'],
      biography: artistData.biography,
      profileImage: artistData.look?.profile_url,
      socialLinks: {
        instagram: artistData.social_media?.instagram?.url,
        spotify: artistData.social_media?.spotify?.url,
        youtube: artistData.social_media?.youtube?.url,
        tiktok: artistData.social_media?.tiktok?.url,
        facebook: artistData.social_media?.facebook?.url
      }
    };
    console.log('✅ EPK generated for:', artistName);
    return epkData;
  } catch (error) {
    console.error('⚠️ Error generating EPK:', error);
    return null;
  }
}

/**
 * Endpoint para generar un artista aleatorio (requiere autenticación)
 * Versión protegida del endpoint anterior
 * ✨ COMPLETO: Genera 10 canciones tokenizadas, contenido social y EPK automáticamente
 * 
 * 🔒 RESTRICCIONES:
 * - Requiere suscripción Premium/Enterprise
 * - Límite de 1 artista por cuenta (excepto admin)
 * - Admin (convoycubano@gmail.com) puede crear ilimitados
 */
router.post("/generate-artist/secure", isAuthenticated, async (req: Request, res: Response) => {
  try {
    console.log('🎵 Received authenticated request to generate artist with ALL features enabled');

    // Verify database connections are available
    if (!db) {
      console.error('[generate-artist/secure] Firebase db is null - Firebase not initialized');
      return res.status(503).json({
        error: 'Database service unavailable (Firebase)',
        code: 'DB_UNAVAILABLE'
      });
    }
    
    if (!pgDb) {
      console.error('[generate-artist/secure] PostgreSQL db is null - Database not initialized');
      return res.status(503).json({
        error: 'Database service unavailable (PostgreSQL)',
        code: 'DB_UNAVAILABLE'
      });
    }

    // Obtener ID del usuario autenticado
    const userId = getClerkId(req);
    const userEmail = req.user?.email;
    console.log(`Solicitud de usuario: ${userId} (${userEmail})`);

    // 🔒 VERIFICAR PERMISOS: Premium requerido + límite de 1 artista
    if (!userId) {
      return res.status(401).json({
        error: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
    }

    const permissionCheck = await canUserCreateArtist(userId, userEmail);
    
    if (!permissionCheck.canCreate) {
      console.log(`❌ Permission denied for user ${userId}: ${permissionCheck.reason}`);
      return res.status(403).json({
        error: permissionCheck.reason,
        code: permissionCheck.hasPremium ? 'LIMIT_REACHED' : 'PREMIUM_REQUIRED',
        artistCount: permissionCheck.artistCount,
        maxAllowed: MAX_ARTISTS_PER_USER,
        hasPremium: permissionCheck.hasPremium
      });
    }

    console.log(`✅ Permission granted for user ${userId} (Admin: ${permissionCheck.isAdmin}, Artists: ${permissionCheck.artistCount}/${MAX_ARTISTS_PER_USER})`);

    // Extract optional generation parameters from request body
    const { genre, style, gender, mood, artistName } = req.body || {};
    const generationParams = { genre, style, gender, mood, artistName };

    // 🧬 STEP 1: Generate Master Artist JSON — the canonical identity
    console.log('🧬 Generating Master Artist JSON...');
    const masterJson = await generateArtistMasterJSON(generationParams);
    const derivedParams = deriveParamsFromMaster(masterJson);
    console.log(`✅ Master JSON ready: "${masterJson.canonical.artist_name}" | ${masterJson.musical_dna?.primary_genre}`);

    // Generar datos del artista aleatorio
    const artistData = await generateRandomArtist(derivedParams);
    console.log('🎨 Artist generated successfully:', artistData.name);

    // 🖼️ GENERAR IMÁGENES DEL ARTISTA CON FAL AI NANO BANANA PRO
    console.log('🖼️ Generando imágenes del artista con FAL AI Nano Banana Pro...');
    let profileImageUrl = artistData.look?.profile_url || '';
    let coverImageUrl = artistData.look?.cover_url || '';

    try {
      const { generateArtistImagesWithFAL } = await import('../services/fal-service');
      // Use masterJson's rich image prompt if available, fallback to legacy description
      const artistDescription = masterJson.visual_dna?.image_prompt_base 
        || artistData.look?.description 
        || `${artistData.name}, professional music artist`;
      const imgGenre = masterJson.musical_dna?.primary_genre || artistData.music_genres?.[0] || 'pop';
      
      const imageResult = await generateArtistImagesWithFAL(artistDescription, artistData.name, imgGenre);
      profileImageUrl = imageResult.profileUrl;
      coverImageUrl = imageResult.coverUrl;
      
      // Actualizar artistData con las imágenes generadas
      if (artistData.look) {
        artistData.look.profile_url = profileImageUrl;
        artistData.look.cover_url = coverImageUrl;
      }
      
      console.log(`✅ Imágenes generadas - Perfil: ${profileImageUrl.substring(0, 60)}...`);
      console.log(`✅ Imágenes generadas - Portada: ${coverImageUrl.substring(0, 60)}...`);
    } catch (imageError) {
      console.error('⚠️ Error generando imágenes, continuando sin ellas:', imageError);
      // Usar placeholders si falla la generación
      profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artistData.name)}&size=400&background=random`;
      coverImageUrl = `https://picsum.photos/seed/${artistData.name}/1200/400`;
    }

    // Guardar artista en Firestore, incluyendo referencia al usuario que lo generó
    const artistDataWithUser = {
      ...artistData,
      generatedBy: userId,
      look: {
        ...artistData.look,
        profile_url: profileImageUrl,
        cover_url: coverImageUrl
      }
    };

    const firestoreId = await saveArtistToFirestore(artistDataWithUser);
    console.log(`✅ Artista guardado en Firestore con ID: ${firestoreId}`);

    // Guardar artista en PostgreSQL con referencia al creador
    const postgresId = await saveArtistToPostgreSQL(artistDataWithUser, firestoreId, userId);
    console.log(`✅ Artista guardado en PostgreSQL con ID: ${postgresId}`);

    // Actualizar PostgreSQL con las imágenes
    await pgDb.update(users)
      .set({
        profileImage: profileImageUrl,
        coverImage: coverImageUrl,
        masterJson: masterJson as any,
      })
      .where(eq(users.id, postgresId));

    // Actualizar Firestore con el ID de PostgreSQL y masterJson
    await db.collection('generated_artists').doc(firestoreId).update({ 
      firestoreId,
      postgresId,
      masterJson,
      'look.profile_url': profileImageUrl,
      'look.cover_url': coverImageUrl
    });

    // 🎵 GENERAR 3 CANCIONES TOKENIZADAS CON AUDIO REAL Y VOCES (FAL AI MiniMax Music V2)
    const artistGender = artistData.gender || 'male'; // Obtener género del artista
    console.log(`🎵 Generando canciones tokenizadas con FAL AI MiniMax Music V2 (Voz: ${artistGender})...`);
    // Build artistDNA from masterJson for fully coherent songs
    const initialArtistDNA = {
      biography: masterJson.canonical.biography_long || artistData.biography || '',
      musicGenres: [masterJson.musical_dna?.primary_genre, ...(masterJson.musical_dna?.secondary_genres || [])].filter(Boolean) as string[],
      moodVibe: masterJson.musical_dna?.mood_keywords?.[0] || '',
      lookDescription: masterJson.visual_dna?.physical_description?.substring(0, 200) || '',
      influences: masterJson.musical_dna?.influences || [],
    };
    const { tokenIds, scheduledSongs } = await generateTokenizedSongs(
      postgresId, 
      artistData.name, 
      artistData.music_genres?.[0] || 'Pop', 
      String(postgresId), // Usar postgresId para que el cliente encuentre las canciones por userId
      firestoreId,
      artistGender as 'male' | 'female',
      initialArtistDNA
    );
    console.log(`✅ ${tokenIds.length} canciones tokenizadas creadas con voces y letras`);

    const monetizationBootstrap = await bootstrapArtistMonetizationModules(
      postgresId,
      artistData.name,
      artistData.music_genres?.[0] || 'Pop',
    );

    const launchPlan = {
      version: '1.0',
      cadenceDays: 10,
      totalSongs: scheduledSongs.length,
      createdAt: new Date().toISOString(),
      status: 'initialized',
      songs: scheduledSongs,
      nextReleaseAt: scheduledSongs.find((s) => !s.isPublished)?.releaseDate || null,
      modules: {
        crowdfunding: monetizationBootstrap.crowdfundingInitialized,
        explicit: monetizationBootstrap.explicitInitialized,
        tokenization: true,
        music: true,
      },
    };

    await db.collection('generated_artists').doc(firestoreId).update({
      launchPlan,
      releaseCalendar: {
        cadenceDays: 10,
        songs: scheduledSongs,
      },
      launchTasks: buildInitialLaunchTasksState(monetizationBootstrap),
      launchStartedAt: new Date().toISOString(),
    });

    // ============================================================
    // 🚀 RESPUESTA INMEDIATA AL CLIENTE
    // El artista + canciones están listos, respondemos ahora
    // Todo lo demás se genera en background
    // ============================================================
    
    console.log('🎉 Enviando respuesta inmediata al cliente...');
    const artistSlug = artistDataWithUser.slug || generateSlug(artistData.name);
    
    // Marcar que hay contenido pendiente de generar
    await db.collection('generated_artists').doc(firestoreId).update({
      backgroundTasksPending: true,
      backgroundTasksStartedAt: Timestamp.now()
    });
    
    // Responder al cliente AHORA (no esperar a merchandise, news, EPK, etc.)
    res.status(200).json({
      success: true,
      message: '✅ Artist created! Additional content (merch, news, EPK) generating in background...',
      artist: {
        ...artistDataWithUser,
        firestoreId,
        postgresId,
        profileImage: profileImageUrl,
        coverImage: coverImageUrl,
        masterJson,
      },
      images: {
        status: 'generated',
        profileUrl: profileImageUrl,
        coverUrl: coverImageUrl,
        provider: 'fal-nano-banana-pro'
      },
      tokenization: {
        status: 'activated',
        songsCreated: tokenIds.length,
        tokenIds: tokenIds,
        releaseSchedule: scheduledSongs,
        audioGenerated: true,
        provider: 'fal-minimax-music'
      },
      backgroundTasks: {
        merchandise: { status: 'generating', products: 6 },
        news: { status: 'generating', articles: 5 },
        epk: { status: 'generating' },
        profileVideo: { status: 'generating', model: 'fal-wan-2.6' },
        socialMedia: { status: 'generating' },
        crowdfunding: { status: monetizationBootstrap.crowdfundingInitialized ? 'initialized' : 'failed' },
        explicit: { status: monetizationBootstrap.explicitInitialized ? 'initialized' : 'failed' },
        blockchain: { status: 'generating' },
        email: { status: 'generating' }
      }
    });

    // ============================================================
    // 🔄 TAREAS EN BACKGROUND (Fire and Forget)
    // El cliente ya recibió respuesta, ahora generamos el resto
    // ============================================================
    
    const bgGenre = artistData.music_genres?.[0] || 'Pop';
    const biography = artistData.biography || '';
    const emailAddress = (req.user as any)?.email || (req.user as any)?.emailAddresses?.[0]?.emailAddress;
    const userName = (req.user as any)?.firstName || (req.user as any)?.username || 'Artist Creator';

    console.log('🔄 Iniciando tareas en background con seguimiento de estado...');
    void processArtistLaunchBackgroundTasks({
      postgresId,
      firestoreId,
      artistName: artistData.name,
      artistData,
      artistSlug,
      profileImageUrl,
      genre: bgGenre,
      biography,
      tokenIds,
      emailAddress,
      userName,
      scheduledSongs,
    }).catch(async (error) => {
      const message = error instanceof Error ? error.message : 'Unknown launch processing error';
      console.error('❌ [Background] Launch processing failed:', message);
      try {
        await db.collection('generated_artists').doc(firestoreId).update({
          backgroundTasksPending: false,
          backgroundTasksCompletedAt: Timestamp.now(),
          'launchPlan.status': 'failed',
          launchProcessingError: message.substring(0, 400),
        });
      } catch (updateError) {
        console.warn('⚠️ Could not update failed launch status:', updateError);
      }
    });
    
    console.log('✅ Todas las tareas background inicializadas con tracking');
    
  } catch (error) {
    console.error('❌ Error generating artist:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to generate artist',
        message: errorMessage,
        code: 'GENERATION_ERROR'
      });
    }
  }
});

/**
 * Endpoint para regenerar campos específicos de un artista
 * Tales como suscripción, compras de videos, o cursos
 */
router.post("/regenerate-artist-field", async (req: Request, res: Response) => {
  try {
    console.log('Recibida solicitud para regenerar campo de artista');

    // Obtener campo y ID del artista
    const { field, artistId } = req.body;
    console.log(`Campo a regenerar: ${field}, Artista ID: ${artistId}`);

    // Validar campo
    const validFields = ['subscription', 'videos', 'courses', 'biography', 'look'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ 
        error: 'Campo no válido',
        details: `El campo debe ser uno de: ${validFields.join(', ')}`
      });
    }

    // Si es subscription, videos, o courses, generar datos nuevos
    let updatedData: any = {};

    if (field === 'subscription') {
      // Datos del plan de suscripción
      const SUBSCRIPTION_PLANS = [
        { name: "Basic", price: 59.99 },
        { name: "Pro", price: 99.99 },
        { name: "Enterprise", price: 149.99 }
      ];
      const selectedPlan = SUBSCRIPTION_PLANS[Math.floor(Math.random() * SUBSCRIPTION_PLANS.length)];

      updatedData.subscription = {
        plan: selectedPlan.name,
        price: selectedPlan.price,
        status: ['active', 'trial', 'expired'][Math.floor(Math.random() * 3)],
        startDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
        renewalDate: new Date(Date.now() + Math.random() * 10000000000).toISOString().split('T')[0]
      };
    } 
    else if (field === 'videos') {
      // Datos de videos generados
      const videoPrice = 199;
      const videosGenerated = Math.floor(Math.random() * 5) + 1;
      const totalVideoSpend = videoPrice * videosGenerated;

      // Generar videos
      const videos = [];
      const VIDEO_TYPES = [
        "Visualizador de audio",
        "Video musical completo",
        "Teaser promocional",
        "Lyric video",
        "Behind the scenes"
      ];

      for (let i = 0; i < videosGenerated; i++) {
        const videoId = `VID-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        videos.push({
          id: videoId,
          title: `Video Musical ${i+1}`,
          type: VIDEO_TYPES[Math.floor(Math.random() * VIDEO_TYPES.length)],
          duration: `${Math.floor(Math.random() * 4) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
          creationDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
          resolution: ["720p", "1080p", "4K"][Math.floor(Math.random() * 3)],
          price: videoPrice
        });
      }

      // Actualizar datos de compras
      updatedData.purchases = {
        videos: {
          count: videosGenerated,
          totalSpent: totalVideoSpend,
          lastPurchase: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
          videos: videos
        }
      };
    } 
    else if (field === 'courses') {
      // Datos de cursos
      const courseCount = Math.floor(Math.random() * 3) + 1;
      const courses = [];
      let totalSpent = 0;

      const COURSE_TITLES = [
        "Producción Musical Avanzada",
        "Marketing Digital para Músicos",
        "Composición para Bandas Sonoras",
        "Técnicas Vocales Profesionales",
        "Distribución Musical en la Era Digital",
        "Masterización de Audio",
        "Estrategias de Lanzamiento Musical",
        "Armonía y Teoría Musical",
        "Creación de Beats"
      ];

      for (let i = 0; i < courseCount; i++) {
        const price = Math.floor(Math.random() * 150) + 149; // 149-299
        totalSpent += price;
        courses.push({
          id: `CRS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          title: COURSE_TITLES[Math.floor(Math.random() * COURSE_TITLES.length)],
          price: price,
          purchaseDate: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
          progress: Math.floor(Math.random() * 101),
          completed: Math.random() > 0.6
        });
      }

      // Actualizar datos de compras
      updatedData.purchases = {
        courses: {
          count: courseCount,
          totalSpent: totalSpent,
          lastPurchase: new Date(Date.now() - Math.random() * 1000000000).toISOString().split('T')[0],
          courses: courses
        }
      };
    }

    console.log(`Datos regenerados para el campo ${field}:`, updatedData);

    // Si hay ID de artista en Firestore, actualizar documento
    if (artistId) {
      const docRef = db.collection('generated_artists').doc(artistId);
      await docRef.update({
        ...updatedData,
        updatedAt: Timestamp.now()
      });
      console.log(`Artista actualizado en Firestore con ID: ${artistId}`);
    }

    // Devolver respuesta con datos regenerados
    res.status(200).json({
      success: true,
      field,
      ...updatedData
    });
  } catch (error) {
    console.error('Error regenerando campo de artista:', error);
    res.status(500).json({ 
      error: 'Error al regenerar campo de artista',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para eliminar un artista por ID de PostgreSQL
 */
router.delete("/delete-artist/:pgId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const pgId = parseInt(req.params.pgId);
    const clerkUserId = getClerkId(req);
    
    console.log(`🗑️ Recibida solicitud para eliminar artista con PostgreSQL ID: ${pgId}`);

    if (isNaN(pgId)) {
      return res.status(400).json({
        error: 'ID de artista no válido',
        details: 'Se requiere un ID numérico válido'
      });
    }

    if (!clerkUserId) {
      return res.status(401).json({ 
        error: 'Usuario no autenticado' 
      });
    }

    // Primero obtener el PostgreSQL ID del usuario autenticado desde su Clerk ID
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (userRecord.length === 0) {
      console.log(`⚠️ Usuario con clerkId ${clerkUserId} no encontrado en PostgreSQL`);
      return res.status(401).json({ 
        error: 'Usuario no encontrado en la base de datos' 
      });
    }

    const pgUserId = userRecord[0].id;
    console.log(`📍 Usuario PostgreSQL ID: ${pgUserId} para Clerk ID: ${clerkUserId}`);

    // 1. Buscar el artista en PostgreSQL
    const [artist] = await pgDb
      .select()
      .from(users)
      .where(eq(users.id, pgId))
      .limit(1);

    if (!artist) {
      return res.status(404).json({
        error: 'Artista no encontrado',
        details: `No se encontró un artista con ID: ${pgId}`
      });
    }

    // 2. Verificar que el usuario tiene permiso para eliminar este artista
    // Admin puede eliminar cualquier artista
    const userEmail = req.user?.emailAddresses?.[0]?.emailAddress || req.user?.email;
    const isAdmin = isAdminEmail(userEmail);
    
    if (isAdmin) {
      console.log(`👑 Admin ${userEmail} - eliminación autorizada para artista ${pgId}`);
    } else {
      // Puede eliminar si:
      // - Es su propio perfil (artist.id === pgUserId)
      // - Él lo generó (artist.generatedBy === pgUserId) — cubre human & AI artists
      // - Es un artista virtual sin dueño (generatedBy === null)
      const isOwnProfile = artist.id === pgUserId;
      const isGeneratedByUser = artist.generatedBy !== null && Number(artist.generatedBy) === Number(pgUserId);
      const isVirtualArtist = artist.role === 'virtual_artist' || artist.isAIGenerated === true;
      
      const canDelete = isOwnProfile || isGeneratedByUser || (isVirtualArtist && artist.generatedBy === null);
      
      console.log(`🔐 Verificando permisos: pgUserId=${pgUserId}, artistId=${artist.id}, generatedBy=${artist.generatedBy}, role=${artist.role}, isAIGenerated=${artist.isAIGenerated}`);
      console.log(`🔐 isOwnProfile=${isOwnProfile}, isGeneratedByUser=${isGeneratedByUser}, isVirtualArtist=${isVirtualArtist}, canDelete=${canDelete}`);
      
      if (!canDelete) {
        return res.status(403).json({
          error: 'No autorizado',
          details: 'No tienes permiso para eliminar este artista'
        });
      }
    }

    // 3. Si tiene firestoreId, eliminar también de Firestore
    if (artist.firestoreId) {
      try {
        const artistRef = db.collection('generated_artists').doc(artist.firestoreId);
        const artistDoc = await artistRef.get();
        
        if (artistDoc.exists) {
          await artistRef.delete();
          console.log(`✅ Artista eliminado de Firestore: ${artist.firestoreId}`);
        }
      } catch (firestoreError) {
        console.error('⚠️ Error eliminando de Firestore (continuando):', firestoreError);
        // Continuamos aunque falle Firestore
      }
    }

    // 4. Eliminar TODOS los registros relacionados antes de eliminar el usuario
    // Use a single transaction with proper FK-chain ordering
    // Some tables reference other non-user tables (e.g. ai_economic_decisions → tokenized_songs)
    // so we must delete child tables before parent tables
    
    try {
      await pgDb.execute(sql.raw(`
        DO $$
        DECLARE
          _pgId integer := ${pgId};
        BEGIN
          -- Phase 1: Nullify non-cascade FK references to this user
          UPDATE users SET generated_by = NULL WHERE generated_by = _pgId;
          UPDATE user_roles SET granted_by = NULL WHERE granted_by = _pgId;
          BEGIN UPDATE token_purchases SET buyer_user_id = NULL WHERE buyer_user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN UPDATE swap_history SET user_id = NULL WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN UPDATE ai_poll_votes SET user_id = NULL WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN UPDATE agent_sessions SET artist_id = NULL WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN UPDATE agent_saved_results SET artist_id = NULL WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          
          -- Phase 2: Delete deep child tables first (tables that reference OTHER tables which reference users)
          -- All tables referencing tokenized_songs (must be deleted BEFORE tokenized_songs)
          BEGIN DELETE FROM ai_economic_decisions WHERE artist_id = _pgId OR target_artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_economic_decisions WHERE target_token_id IN (SELECT id FROM tokenized_songs WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM platform_revenue WHERE source_token_id IN (SELECT id FROM tokenized_songs WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_token_earnings WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_token_earnings WHERE token_id IN (SELECT id FROM tokenized_songs WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          -- All tables referencing songs (must be deleted BEFORE songs)
          BEGIN DELETE FROM ai_generated_music WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_generated_music WHERE song_id IN (SELECT id FROM songs WHERE user_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          -- ai_post_comments → ai_social_posts
          BEGIN DELETE FROM ai_post_comments WHERE author_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_post_comments WHERE post_id IN (SELECT id FROM ai_social_posts WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          -- audience_comments may reference posts
          BEGIN DELETE FROM audience_comments WHERE post_id IN (SELECT id FROM ai_social_posts WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          -- promoted_posts → ai_social_posts
          BEGIN DELETE FROM promoted_posts WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM promoted_posts WHERE post_id IN (SELECT id FROM ai_social_posts WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          -- clip_interactions → discover_clips
          BEGIN DELETE FROM clip_interactions WHERE clip_id IN (SELECT id FROM discover_clips WHERE artist_id = _pgId); EXCEPTION WHEN OTHERS THEN NULL; END;
          
          -- Phase 3: Delete tables that reference users.id with artist_id column
          BEGIN DELETE FROM ai_social_posts WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_personality WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_relationships WHERE artist_id = _pgId OR related_artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM agent_memory WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM agent_action_queue WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_collaborations WHERE initiator_id = _pgId OR target_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_beefs WHERE instigator_id = _pgId OR target_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_artist_treasury WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_artist_evolution WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM discover_clips WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM tv_video_comments WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_stories WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM ai_polls WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_management WHERE artist_id = _pgId OR manager_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM management_decisions WHERE artist_id = _pgId OR manager_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM outreach_campaigns WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM sales_transactions WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM tokenized_songs WHERE artist_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM platform_revenue WHERE source_artist_id = _pgId OR source_user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM render_queue WHERE artist_profile_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          
          -- Phase 4: Delete tables that reference users.id with user_id column
          BEGIN DELETE FROM user_roles WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM subscriptions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_wallet WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM wallet_transactions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM crowdfunding_campaigns WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM marketing_metrics WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM analytics_history WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM contracts WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM audio_demos WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM bookings WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM events WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM investors WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM notifications WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_news WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM musicians WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM course_enrollments WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM user_achievements WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM course_reviews WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM quiz_attempts WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM lesson_progress WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM spotify_curators WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM instagram_connections WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM fashion_sessions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM fashion_results WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM fashion_analysis WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM fashion_portfolio WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM product_tryon_history WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM fashion_videos WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM affiliates WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM affiliate_conversions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM pr_campaigns WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM api_usage_log WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM transactions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM social_media_posts WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM manager_tasks WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM manager_contacts WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM manager_schedule WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM manager_notes WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM course_instructors WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM songs WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_media WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM merchandise WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM liquidity_positions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM outreach_templates WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM outreach_daily_quota WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM agent_sessions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM agent_saved_results WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM agent_usage_stats WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM spotify_connections WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM user_created_artists WHERE creator_user_id = _pgId OR artist_user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM clip_interactions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM user_xp WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM xp_transactions WHERE user_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM music_video_projects WHERE artist_profile_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
          BEGIN DELETE FROM artist_profile_images WHERE artist_profile_id = _pgId; EXCEPTION WHEN OTHERS THEN NULL; END;
        END
        $$;
      `));
    } catch (cleanupErr) {
      console.error('⚠️ Error during batch cleanup (continuing):', cleanupErr);
    }
    
    console.log(`✅ Registros relacionados limpiados para artista: ${pgId}`);

    // 5. Eliminar de PostgreSQL
    await pgDb
      .delete(users)
      .where(eq(users.id, pgId));

    console.log(`✅ Artista eliminado de PostgreSQL: ${pgId}`);

    res.status(200).json({
      success: true,
      message: `Artista eliminado correctamente`,
      deletedId: pgId
    });
  } catch (error) {
    console.error('❌ Error eliminando artista:', error);
    res.status(500).json({
      error: 'Error al eliminar artista',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint LEGACY para eliminar un artista por firestoreId (mantener para compatibilidad)
 */
router.delete("/delete-artist-firestore/:firestoreId", async (req: Request, res: Response) => {
  try {
    const firestoreId = req.params.firestoreId;
    console.log(`Recibida solicitud para eliminar artista con Firestore ID: ${firestoreId}`);

    if (!firestoreId) {
      return res.status(400).json({
        error: 'ID de artista no proporcionado',
        details: 'Se requiere un ID de artista válido para eliminar'
      });
    }

    // Verificar que el artista existe
    const artistRef = db.collection('generated_artists').doc(firestoreId);
    const artistDoc = await artistRef.get();

    if (!artistDoc.exists) {
      return res.status(404).json({
        error: 'Artista no encontrado',
        details: `No se encontró un artista con ID: ${firestoreId}`
      });
    }

    // Eliminar el artista
    await artistRef.delete();
    console.log(`Artista eliminado con ID: ${firestoreId}`);

    res.status(200).json({
      success: true,
      message: `Artista con ID ${firestoreId} eliminado correctamente`,
      deletedId: firestoreId
    });
  } catch (error) {
    console.error('Error eliminando artista:', error);
    res.status(500).json({
      error: 'Error al eliminar artista',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para eliminar todos los artistas generados
 */
router.delete("/delete-all-artists", async (req: Request, res: Response) => {
  try {
    console.log('Recibida solicitud para eliminar todos los artistas');

    // Obtener todos los documentos en la colección
    const artistsRef = db.collection('generated_artists');
    const snapshot = await artistsRef.get();

    if (snapshot.empty) {
      return res.status(200).json({
        success: true,
        message: 'No hay artistas para eliminar',
        count: 0
      });
    }

    // Eliminar cada documento en un batch
    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc: DocumentData) => {
      batch.delete(doc.ref);
      count++;
    });

    // Ejecutar el batch
    await batch.commit();
    console.log(`${count} artistas eliminados correctamente`);

    res.status(200).json({
      success: true,
      message: `${count} artistas eliminados correctamente`,
      count
    });
  } catch (error) {
    console.error('Error eliminando todos los artistas:', error);
    res.status(500).json({
      error: 'Error al eliminar todos los artistas',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para regenerar imágenes de artistas existentes sin imágenes
 */
router.post("/regenerate-artist-images", async (req: Request, res: Response) => {
  try {
    const { generateArtistImages } = await import('../../scripts/generate-artist-images');
    
    console.log('🎨 Iniciando regeneración de imágenes...');

    // Obtener artistas AI sin imágenes en Firestore
    const artistsToUpdate = await pgDb.select()
      .from(users)
      .where(eq(users.isAIGenerated, true));

    console.log(`📊 Encontrados ${artistsToUpdate.length} artistas virtuales`);

    let regenerated = 0;
    for (const artist of artistsToUpdate) {
      if (artist.firestoreId) {
        try {
          const firestoreDoc = await db.collection('generated_artists').doc(artist.firestoreId).get();
          
          if (firestoreDoc.exists) {
            const data = firestoreDoc.data();
            
            // Solo regenerar si NO tiene imágenes
            if (!data?.look?.profile_url || !data?.look?.cover_url) {
              console.log(`🔄 Regenerando imágenes para: ${artist.artistName} con FAL AI Nano Banana Pro`);
              
              // Generar imágenes usando la descripción existente
              const artistGenres = artist.genres || ['pop'];
              const genre = Array.isArray(artistGenres) ? artistGenres[0] : artistGenres;
              const imageUrls = await generateArtistImages(
                data.look.description, 
                artist.artistName || 'Unknown Artist',
                genre
              );
              
              // Actualizar Firestore con las nuevas imágenes
              await db.collection('generated_artists').doc(artist.firestoreId).update({
                'look.profile_url': imageUrls.profileUrl,
                'look.cover_url': imageUrls.coverUrl
              });
              
              // Actualizar PostgreSQL
              await pgDb.update(users)
                .set({
                  profileImage: imageUrls.profileUrl,
                  coverImage: imageUrls.coverUrl
                })
                .where(eq(users.id, artist.id));
              
              console.log(`✅ Imágenes regeneradas para: ${artist.artistName}`);
              regenerated++;
            }
          }
        } catch (error) {
          console.error(`❌ Error regenerando imágenes para ${artist.artistName}:`, error);
        }
      }
    }

    res.json({
      success: true,
      message: `Regeneración completada: ${regenerated} artistas actualizados`,
      regenerated
    });
  } catch (error) {
    console.error('Error en regeneración:', error);
    res.status(500).json({
      error: 'Error al regenerar imágenes',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint temporal para sincronizar imágenes de artistas desde Firestore
 */
router.post("/sync-artist-images", async (req: Request, res: Response) => {
  try {
    console.log('🔄 Iniciando sincronización de imágenes de artistas...');

    // Obtener todos los artistas AI sin imágenes
    const artistsWithoutImages = await pgDb.select()
      .from(users)
      .where(eq(users.isAIGenerated, true));

    console.log(`📊 Encontrados ${artistsWithoutImages.length} artistas virtuales`);

    let updated = 0;
    for (const artist of artistsWithoutImages) {
      console.log(`\n🔍 Procesando: ${artist.artistName} (ID: ${artist.id})`);
      console.log(`   firestoreId: ${artist.firestoreId}`);
      
      if (artist.firestoreId) {
        try {
          const firestoreDoc = await db.collection('generated_artists').doc(artist.firestoreId).get();
          console.log(`   Documento existe: ${firestoreDoc.exists}`);
          
          if (firestoreDoc.exists) {
            const data = firestoreDoc.data();
            console.log(`   Estructura look:`, data?.look ? 'SÍ' : 'NO');
            
            const profileImage = data?.look?.profile_url;
            const coverImage = data?.look?.cover_url;
            
            console.log(`   profile_url: ${profileImage ? 'ENCONTRADO' : 'VACÍO'}`);
            console.log(`   cover_url: ${coverImage ? 'ENCONTRADO' : 'VACÍO'}`);

            if (profileImage || coverImage) {
              await pgDb.update(users)
                .set({
                  profileImage: profileImage || artist.profileImage,
                  coverImage: coverImage || artist.coverImage
                })
                .where(eq(users.id, artist.id));

              console.log(`   ✅ ACTUALIZADO`);
              updated++;
            } else {
              console.log(`   ⚠️ No se encontraron URLs de imágenes`);
            }
          } else {
            console.log(`   ❌ Documento no existe en Firestore`);
          }
        } catch (error) {
          console.error(`   ❌ Error:`, error);
        }
      } else {
        console.log(`   ⚠️ Sin firestoreId`);
      }
    }

    res.json({
      success: true,
      message: `Sincronización completada: ${updated} artistas actualizados`,
      updated
    });
  } catch (error) {
    console.error('Error en sincronización:', error);
    res.status(500).json({
      error: 'Error al sincronizar imágenes',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /toggle-published/:artistId — Toggle isPublished for an artist
// ─────────────────────────────────────────────────────────────────
router.post("/toggle-published/:artistId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const clerkUserId = getClerkId(req);
    if (!clerkUserId) return res.status(401).json({ error: 'No autenticado' });

    const artistId = parseInt(req.params.artistId);
    if (isNaN(artistId)) return res.status(400).json({ error: 'ID de artista inválido' });

    // Resolve the caller's PG user id
    const [userRecord] = await pgDb.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
    if (!userRecord) return res.status(401).json({ error: 'Usuario no encontrado' });
    const pgUserId = userRecord.id;

    // Load the artist
    const [artist] = await pgDb.select({ id: users.id, generatedBy: users.generatedBy, isPublished: users.isPublished }).from(users).where(eq(users.id, artistId)).limit(1);
    if (!artist) return res.status(404).json({ error: 'Artista no encontrado' });

    // Permission: own profile or generated by this user
    const canEdit = artist.id === pgUserId || artist.generatedBy === pgUserId;
    if (!canEdit) return res.status(403).json({ error: 'Sin permiso' });

    const newValue = !artist.isPublished;
    await pgDb.update(users).set({ isPublished: newValue, updatedAt: new Date() }).where(eq(users.id, artistId));

    return res.json({ success: true, isPublished: newValue });
  } catch (error) {
    console.error('[toggle-published] Error:', error);
    res.status(500).json({ error: 'Error al cambiar visibilidad' });
  }
});

/**
 * Endpoint para actualizar el perfil de un artista
 * Actualiza TANTO PostgreSQL COMO Firebase
 * Acepta tanto ID numérico como firestoreId
 */
router.put("/update-artist/:artistId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistIdParam = req.params.artistId;
    const clerkUserId = getClerkId(req);

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener el PostgreSQL ID del usuario autenticado desde su Clerk ID
    const userRecord = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (userRecord.length === 0) {
      console.log(`⚠️ Usuario con clerkId ${clerkUserId} no encontrado en PostgreSQL`);
      return res.status(401).json({ error: 'Usuario no encontrado en la base de datos' });
    }

    const pgUserId = userRecord[0].id;
    console.log(`📝 Actualizando artista ${artistIdParam} por usuario pgId=${pgUserId} (clerkId=${clerkUserId})`);

    const {
      displayName,
      biography,
      genre,
      location,
      profileImage,
      bannerImage,
      bannerPosition,
      loopVideoUrl,
      slug,
      contactEmail,
      contactPhone,
      instagram,
      twitter,
      youtube,
      spotify,
      pageMode
    } = req.body;

    // Buscar artista por ID numérico o firestoreId
    let artist;
    const numericId = parseInt(artistIdParam);
    
    if (!isNaN(numericId)) {
      // Es un ID numérico
      [artist] = await pgDb.select().from(users).where(eq(users.id, numericId)).limit(1);
    } else {
      // Es un firestoreId
      [artist] = await pgDb.select().from(users).where(eq(users.firestoreId, artistIdParam)).limit(1);
    }
    
    if (!artist) {
      return res.status(404).json({ error: 'Artista no encontrado' });
    }

    // Verificar permisos: debe ser el mismo usuario, un artista generado por él, o un artista virtual
    const isOwnProfile = artist.id === pgUserId;
    const isGeneratedByUser = artist.generatedBy === pgUserId;
    const isVirtualArtist = artist.role === 'virtual_artist' || artist.isAIGenerated === true;
    
    console.log(`🔐 Verificando permisos edición: pgUserId=${pgUserId}, artistId=${artist.id}, generatedBy=${artist.generatedBy}, role=${artist.role}`);
    console.log(`🔐 isOwnProfile=${isOwnProfile}, isGeneratedByUser=${isGeneratedByUser}, isVirtualArtist=${isVirtualArtist}`);
    
    // Permitir editar si es el propio perfil, lo generó el usuario, o es un artista AI
    const canEdit = isOwnProfile || isGeneratedByUser || (isVirtualArtist && artist.generatedBy === null);
    
    if (!canEdit) {
      return res.status(403).json({ error: 'No tienes permiso para editar este artista' });
    }

    // Actualizar PostgreSQL
    await pgDb.update(users)
      .set({
        artistName: displayName,
        biography: biography || null,
        genres: genre ? [genre] : artist.genres,
        location: location || null,
        profileImage: profileImage || null,
        coverImage: bannerImage || null,
        bannerPosition: bannerPosition !== undefined && bannerPosition !== null ? String(bannerPosition) : artist.bannerPosition,
        loopVideoUrl: loopVideoUrl || null,
        slug: slug || artist.slug,
        email: contactEmail || null,
        phone: contactPhone || null,
        instagramHandle: instagram || null,
        twitterHandle: twitter || null,
        youtubeChannel: youtube || null,
        spotifyUrl: spotify || null,
        pageMode: pageMode || artist.pageMode || 'artist',
        updatedAt: new Date()
      })
      .where(eq(users.id, artist.id));

    console.log(`✅ PostgreSQL actualizado - Biography: ${biography ? 'SI' : 'NO'}, BannerPos: ${bannerPosition}, LoopVideo: ${loopVideoUrl ? 'SI' : 'NO'}`);

    console.log(`✅ Artista ${artist.id} actualizado en PostgreSQL`);

    // Actualizar Firebase si tiene firestoreId
    if (artist.firestoreId) {
      try {
        const userDocRef = db.collection('users').doc(artist.firestoreId);
        await userDocRef.set({
          uid: artist.firestoreId,
          displayName,
          name: displayName,
          biography: biography || "",
          genre: genre || "",
          location: location || "",
          profileImage: profileImage || "",
          photoURL: profileImage || "",
          bannerImage: bannerImage || "",
          bannerPosition: bannerPosition !== undefined && bannerPosition !== null ? String(bannerPosition) : "50",
          loopVideoUrl: loopVideoUrl || "",
          slug: slug || artist.slug,
          contactEmail: contactEmail || "",
          contactPhone: contactPhone || "",
          instagram: instagram || "",
          twitter: twitter || "",
          youtube: youtube || "",
          spotify: spotify || "",
          pageMode: pageMode || artist.pageMode || "artist",
          updatedAt: new Date()
        }, { merge: true });
        
        console.log(`✅ Artista ${artist.id} actualizado en Firebase`);
      } catch (firebaseError) {
        console.warn(`⚠️ No se pudo actualizar Firebase para artista ${artist.id}:`, firebaseError);
        // No bloqueamos si Firebase falla
      }
    }

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado correctamente'
    });
  } catch (error) {
    console.error('❌ Error actualizando perfil del artista:', error);
    res.status(500).json({ 
      error: 'Error al actualizar perfil',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para generar noticias del artista usando Gemini + Nano Banana
 * Genera 5 noticias con diferentes categorías y contextos relevantes
 */
router.post("/generate-news/:artistId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistIdParam = req.params.artistId;
    const clerkUserId = getClerkId(req); // This is the Clerk userId (string)

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    console.log(`📰 Generando noticias para artista ${artistIdParam}, usuario Clerk: ${clerkUserId}`);

    // Check if user is admin first - admins can generate news for any artist
    const userEmail = req.user?.email;
    const isAdmin = isAdminEmail(userEmail);
    console.log(`📰 User email: ${userEmail}, isAdmin: ${isAdmin}`);

    // First, get the PostgreSQL ID of the requesting user
    const [requestingUser] = await pgDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    
    const requestingUserId = requestingUser?.id;
    console.log(`📰 Requesting user PostgreSQL ID: ${requestingUserId}`);

    let artist;
    const numericId = parseInt(artistIdParam);
    
    if (!isNaN(numericId)) {
      [artist] = await pgDb.select().from(users).where(eq(users.id, numericId)).limit(1);
    } else {
      [artist] = await pgDb.select().from(users).where(eq(users.firestoreId, artistIdParam)).limit(1);
    }
    
    if (!artist) {
      return res.status(404).json({ error: 'Artista no encontrado' });
    }

    // Permission check:
    // 0. isAdmin: admin users can access any artist
    // 1. isOwner: the artist's clerkId matches the requesting user's clerkId
    // 2. isGenerator: the artist was generated by the requesting user (generatedBy is PostgreSQL ID)
    // 3. isSameUser: the artist's PostgreSQL ID matches the requesting user's PostgreSQL ID (user editing their own profile)
    const isOwner = artist.clerkId === clerkUserId;
    const isGenerator = requestingUserId && artist.generatedBy === requestingUserId;
    const isSameUser = requestingUserId && artist.id === requestingUserId;
    
    console.log(`📰 Permission check - isAdmin: ${isAdmin}, isOwner: ${isOwner}, isGenerator: ${isGenerator}, isSameUser: ${isSameUser}`);
    console.log(`📰 artist.clerkId: ${artist.clerkId}, artist.generatedBy: ${artist.generatedBy}, requestingUserId: ${requestingUserId}`);
    
    if (!isAdmin && !isOwner && !isGenerator && !isSameUser) {
      return res.status(403).json({ error: 'No tienes permiso para generar noticias de este artista' });
    }

    const artistName = artist.artistName || artist.firstName || 'Unknown Artist';
    const genre = artist.genres?.[0] || artist.genre || 'music';
    const location = artist.location || artist.country || 'international';
    const biography = artist.biography || 'Emerging artist';

    // Verificar que OpenAI está configurado
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('No hay API key de OpenAI configurada');
    }

    // Enrich with Superstar Blueprint news_brief if available
    const blueprintNewsBrief = artist.id ? await getBlueprintBrief(artist.id, 'news_brief') : null;
    const blueprintContext = blueprintNewsBrief
      ? `\n\nBlueprint context: ${blueprintNewsBrief}\nUse this context to make the news articles more specific to this artist's strategy and brand.`
      : '';

    const newsCategories = [
      {
        category: "release",
        prompt: `Write a compelling news article about ${artistName}, a ${genre} artist, announcing their latest single or album release. Make it exciting and professional, as if written by a music journalist. Include specific release details and what makes this music special. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}${blueprintContext}`
      },
      {
        category: "performance",
        prompt: `Write a news article about ${artistName}'s upcoming or recent live performance. Describe the venue, the energy, fan reactions, and what made this show memorable. Make it vivid and engaging. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}${blueprintContext}`
      },
      {
        category: "collaboration",
        prompt: `Write a news article about ${artistName} collaborating with other artists or producers in the ${genre} scene. Make it newsworthy and exciting, highlighting the creative synergy. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}${blueprintContext}`
      },
      {
        category: "achievement",
        prompt: `Write a news article celebrating ${artistName}'s recent achievement - could be streaming milestones, chart positions, or industry recognition. Make it celebratory and inspirational. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}${blueprintContext}`
      },
      {
        category: "lifestyle",
        prompt: `Write a lifestyle feature article about ${artistName}'s creative process, inspirations, or behind-the-scenes insights. Make it personal and relatable, showing the human side of the artist. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}${blueprintContext}`
      }
    ];

    console.log(`🤖 Generando ${newsCategories.length} noticias con Gemini...`);
    
    // Descargar imagen del perfil del artista para usar como referencia
    let profileImageBase64: string | null = null;
    if (artist.profileImage) {
      console.log(`📸 Descargando imagen del perfil del artista para usar como referencia...`);
      profileImageBase64 = await downloadImageAsBase64(artist.profileImage);
      if (profileImageBase64) {
        console.log(`✅ Imagen del perfil descargada exitosamente`);
      } else {
        console.warn(`⚠️ No se pudo descargar la imagen del perfil, se generarán imágenes sin referencia`);
      }
    }
    
    const generatedNews = [];

    const categoryLabels: Record<string, string> = {
      release: 'New Release',
      performance: 'Live Performance',
      collaboration: 'Collaboration',
      achievement: 'Achievement',
      lifestyle: 'Lifestyle',
    };

    for (let i = 0; i < newsCategories.length; i++) {
      const { category, prompt } = newsCategories[i];
      
      console.log(`📝 Generando noticia ${i + 1}/${newsCategories.length} (${category}) con OpenAI...`);

      try {
        const textResponse = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            {
              role: "system",
              content: "You are a professional music journalist. Always respond with valid JSON in the exact format requested."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.8,
          max_tokens: 1024,
        });

        const textContent = textResponse.choices[0]?.message?.content;
        if (!textContent) {
          throw new Error('No se recibió contenido de texto');
        }

        let newsData;
        try {
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            newsData = JSON.parse(jsonMatch[0]);
          } else {
            newsData = {
              title: `${artistName} - ${category}`,
              content: textContent,
              summary: textContent.substring(0, 150) + '...'
            };
          }
        } catch (parseError) {
          newsData = {
            title: `${artistName} - ${category}`,
            content: textContent,
            summary: textContent.substring(0, 150) + '...'
          };
        }

        console.log(`🎨 Generando imagen hiper-realista para noticia ${i + 1} (gpt-image-2/edit con rostro real)...`);

        const referenceForFace = artist.profileImage
          || (profileImageBase64 ? `data:image/jpeg;base64,${profileImageBase64}` : null);

        const newsImage = await generateNewsImage({
          title: newsData.title,
          artistName,
          genre,
          category,
          context: newsData.summary || newsData.content,
          referenceImageUrl: referenceForFace,
          aspectRatio: '16:9',
        });

        // Adapt to the legacy `imageResult` shape used downstream in this block
        const imageResult = {
          success: newsImage.provider !== 'placeholder',
          imageUrl: newsImage.imageUrl,
          provider: newsImage.provider,
        };

        if (!imageResult.success || !imageResult.imageUrl) {
          console.warn(`⚠️ Error generando imagen para noticia ${i + 1}, usando placeholder`);
        } else {
          console.log(`✅ Imagen generada con ${imageResult.provider}`);
        }

        const newsItem = {
          userId: artist.id,
          title: newsData.title,
          content: newsData.content,
          summary: newsData.summary,
          imageUrl: imageResult.imageUrl || 'https://via.placeholder.com/800x600/FF6B35/FFFFFF?text=News',
          category: category as "release" | "performance" | "collaboration" | "achievement" | "lifestyle",
          isPublished: true,
          views: 0
        };

        const [insertedNews] = await pgDb.insert(artistNews).values(newsItem).returning();
        generatedNews.push(insertedNews);

        // Notify fans of this artist about the new news article — fire-and-forget
        notifyArtistFans(artist.id, 'new_news', {
          artistName,
          artistSlug: (artist as any).slug || String(artist.id),
          newsTitle: newsData.title,
        }).catch((e) => console.warn('[ArtistGen] Fan news notify error:', e?.message));

        // Cross-post to main News page under "artist-news" category
        try {
          const slug = `${artistName}-${category}-${Date.now()}`
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 120);

          const htmlContent = newsData.content
            .split('\n')
            .filter((p: string) => p.trim())
            .map((p: string) => `<p>${p}</p>`)
            .join('\n');

          await pgDb.insert(newsArticles).values({
            slug,
            title: newsData.title,
            subtitle: `${artistName} — ${categoryLabels[category] || category}`,
            summary: newsData.summary || newsData.content.substring(0, 200) + '...',
            htmlContent,
            coverImageUrl: imageResult.imageUrl || null,
            coverImagePrompt: newsImage.prompt,
            imageProvider: newsImage.provider as any,
            category: 'artist-news',
            tags: [genre, artistName.toLowerCase(), category],
            readTimeMinutes: Math.max(2, Math.ceil(newsData.content.length / 1000)),
            status: 'published',
            publishedAt: new Date(),
            generatedBy: `artist-${artist.id}`,
            aiModel: `${PRIMARY_MODEL} + ${newsImage.provider}`,
            views: 0,
            likes: 0,
            shares: 0,
          });
          console.log(`📰 Cross-posted to main News page: ${slug}`);
        } catch (crossPostError) {
          console.error(`⚠️ Failed to cross-post to News page:`, crossPostError);
        }

        console.log(`✅ News ${i + 1}/${newsCategories.length} generated and saved`);

        if (i < newsCategories.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Error generando noticia ${i + 1}:`, error);
      }
    }

    console.log(`✅ ${generatedNews.length} noticias generadas exitosamente`);

    // Enviar notificación al usuario sobre la primera noticia generada
    if (generatedNews.length > 0) {
      try {
        await NotificationTemplates.newsArticleGenerated(
          artist.id,
          generatedNews[0].title,
          generatedNews[0].id
        );
      } catch (notifError) {
        console.error('Error enviando notificación de noticias generadas:', notifError);
      }
    }

    res.status(200).json({
      success: true,
      message: `${generatedNews.length} noticias generadas exitosamente`,
      news: generatedNews,
      count: generatedNews.length
    });

  } catch (error) {
    console.error('❌ Error generando noticias:', error);
    res.status(500).json({ 
      error: 'Error al generar noticias',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para obtener las noticias de un artista
 */
router.get("/news/:artistId", async (req: Request, res: Response) => {
  try {
    const artistIdParam = req.params.artistId;

    console.log(`📰 Obteniendo noticias para artista ${artistIdParam}`);

    let userId: number;
    const numericId = parseInt(artistIdParam);
    
    if (!isNaN(numericId)) {
      userId = numericId;
    } else {
      const [artist] = await pgDb.select().from(users).where(eq(users.firestoreId, artistIdParam)).limit(1);
      if (!artist) {
        return res.status(404).json({ error: 'Artista no encontrado' });
      }
      userId = artist.id;
    }

    const news = await pgDb
      .select()
      .from(artistNews)
      .where(eq(artistNews.userId, userId))
      .orderBy(desc(artistNews.createdAt));

    console.log(`✅ Encontradas ${news.length} noticias para artista ${userId}`);

    res.status(200).json({
      success: true,
      news: news,
      count: news.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo noticias:', error);
    res.status(500).json({ 
      error: 'Error al obtener noticias',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para obtener una noticia individual por ID
 */
router.get("/news-item/:newsId", async (req: Request, res: Response) => {
  try {
    const newsId = parseInt(req.params.newsId);

    if (isNaN(newsId)) {
      return res.status(400).json({ error: 'ID de noticia inválido' });
    }

    console.log(`📰 Obteniendo noticia ${newsId}`);

    // Obtener noticia con información del artista
    const [newsItem] = await pgDb
      .select({
        id: artistNews.id,
        userId: artistNews.userId,
        title: artistNews.title,
        content: artistNews.content,
        summary: artistNews.summary,
        imageUrl: artistNews.imageUrl,
        category: artistNews.category,
        views: artistNews.views,
        createdAt: artistNews.createdAt,
        artistName: users.artistName,
        profileImage: users.profileImage
      })
      .from(artistNews)
      .leftJoin(users, eq(artistNews.userId, users.id))
      .where(eq(artistNews.id, newsId))
      .limit(1);

    if (!newsItem) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Incrementar contador de vistas
    await pgDb
      .update(artistNews)
      .set({ views: newsItem.views + 1 })
      .where(eq(artistNews.id, newsId));

    console.log(`✅ Noticia ${newsId} encontrada`);

    res.status(200).json({
      success: true,
      ...newsItem,
      views: newsItem.views + 1,
      user: {
        artistName: newsItem.artistName,
        profileImage: newsItem.profileImage
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo noticia:', error);
    res.status(500).json({ 
      error: 'Error al obtener noticia',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para editar una noticia individual
 */
router.patch("/news/:newsId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const newsId = parseInt(req.params.newsId);
    const userId = getClerkId(req);
    const { title, content, summary, category } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    console.log(`📝 Editando noticia ${newsId}`);

    // Verificar que la noticia existe y pertenece al usuario
    const [existingNews] = await pgDb
      .select()
      .from(artistNews)
      .where(eq(artistNews.id, newsId))
      .limit(1);

    if (!existingNews) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Verificar propiedad
    const [artist] = await pgDb
      .select()
      .from(users)
      .where(eq(users.id, existingNews.userId))
      .limit(1);

    if (!artist || (artist.id !== userId && artist.generatedBy !== userId)) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta noticia' });
    }

    // Actualizar noticia
    const updateData: any = {
      updatedAt: new Date()
    };

    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (summary) updateData.summary = summary;
    if (category) updateData.category = category;

    await pgDb
      .update(artistNews)
      .set(updateData)
      .where(eq(artistNews.id, newsId));

    console.log(`✅ Noticia ${newsId} actualizada exitosamente`);

    res.status(200).json({
      success: true,
      message: 'Noticia actualizada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error editando noticia:', error);
    res.status(500).json({ 
      error: 'Error al editar noticia',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para eliminar una noticia individual
 */
router.delete("/news/:newsId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const newsId = parseInt(req.params.newsId);
    const userId = getClerkId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    console.log(`🗑️ Eliminando noticia ${newsId}`);

    // Verificar que la noticia existe y pertenece al usuario
    const [existingNews] = await pgDb
      .select()
      .from(artistNews)
      .where(eq(artistNews.id, newsId))
      .limit(1);

    if (!existingNews) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Verificar propiedad
    const [artist] = await pgDb
      .select()
      .from(users)
      .where(eq(users.id, existingNews.userId))
      .limit(1);

    if (!artist || (artist.id !== userId && artist.generatedBy !== userId)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta noticia' });
    }

    // Eliminar noticia
    await pgDb
      .delete(artistNews)
      .where(eq(artistNews.id, newsId));

    console.log(`✅ Noticia ${newsId} eliminada exitosamente`);

    res.status(200).json({
      success: true,
      message: 'Noticia eliminada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error eliminando noticia:', error);
    res.status(500).json({ 
      error: 'Error al eliminar noticia',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Endpoint para regenerar una noticia individual con IA
 */
router.post("/news/:newsId/regenerate", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const newsId = parseInt(req.params.newsId);
    const userId = getClerkId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    console.log(`🔄 Regenerando noticia ${newsId}`);

    // Verificar que la noticia existe y pertenece al usuario
    const [existingNews] = await pgDb
      .select()
      .from(artistNews)
      .where(eq(artistNews.id, newsId))
      .limit(1);

    if (!existingNews) {
      return res.status(404).json({ error: 'Noticia no encontrada' });
    }

    // Verificar propiedad y obtener datos del artista
    const [artist] = await pgDb
      .select()
      .from(users)
      .where(eq(users.id, existingNews.userId))
      .limit(1);

    if (!artist || (artist.id !== userId && artist.generatedBy !== userId)) {
      return res.status(403).json({ error: 'No tienes permiso para regenerar esta noticia' });
    }

    const artistName = artist.artistName || artist.firstName || 'Unknown Artist';
    const genre = artist.genres?.[0] || artist.genre || 'music';
    const biography = artist.biography || 'Emerging artist';

    // Verificar que OpenAI está configurado
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('No hay API key de OpenAI configurada');
    }

    // Prompts según categoría
    const categoryPrompts: Record<string, string> = {
      release: `Write a compelling news article about ${artistName}, a ${genre} artist, announcing their latest single or album release. Make it exciting and professional, as if written by a music journalist. Include specific release details and what makes this music special. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}`,
      performance: `Write a news article about ${artistName}'s upcoming or recent live performance. Describe the venue, the energy, fan reactions, and what made this show memorable. Make it vivid and engaging. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}`,
      collaboration: `Write a news article about ${artistName} collaborating with another artist or brand. Describe the partnership, what it means for fans, and what to expect from this collaboration. Make it exciting and newsworthy. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}`,
      achievement: `Write a news article about ${artistName} achieving a major milestone (awards, chart success, streaming records, etc). Celebrate their success while maintaining journalistic objectivity. Make it inspiring and compelling. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}`,
      lifestyle: `Write a news article about ${artistName}'s lifestyle, creative process, or personal journey as an artist. Give fans insight into who they are beyond the music. Make it personal yet professional. Write in a journalistic style with a catchy headline and 2-3 paragraphs. Format: {"title": "...", "content": "...", "summary": "..."}`
    };

    const prompt = categoryPrompts[existingNews.category] || categoryPrompts.release;

    console.log(`🤖 Generando nuevo contenido con OpenAI para categoría: ${existingNews.category}`);

    // Generar nuevo contenido con OpenAI
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a professional music journalist. Always respond with valid JSON in the exact format requested."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 1024
    });

    let newsData;
    try {
      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('No se recibió respuesta de OpenAI');
      }
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      newsData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Error parseando respuesta de OpenAI:', parseError);
      throw new Error('Error parseando contenido generado');
    }

    // Generar nueva imagen hiper-realista (gpt-image-2/edit con rostro real del artista)
    console.log('🎨 Generando nueva imagen hiper-realista (gpt-image-2/edit)...');

    const newsImage = await generateNewsImage({
      title: newsData.title,
      artistName,
      genre,
      category: (existingNews.category as string) || 'lifestyle',
      context: newsData.summary || newsData.content,
      referenceImageUrl: artist.profileImage || null,
      aspectRatio: '16:9',
    });

    const newImageUrl = newsImage.provider !== 'placeholder'
      ? newsImage.imageUrl
      : existingNews.imageUrl;
    console.log(`✅ Imagen regenerada con ${newsImage.provider}`);

    // Actualizar noticia
    await pgDb
      .update(artistNews)
      .set({
        title: newsData.title,
        content: newsData.content,
        summary: newsData.summary,
        imageUrl: newImageUrl,
        updatedAt: new Date()
      })
      .where(eq(artistNews.id, newsId));

    console.log(`✅ Noticia ${newsId} regenerada exitosamente`);

    // Obtener noticia actualizada
    const [updatedNews] = await pgDb
      .select()
      .from(artistNews)
      .where(eq(artistNews.id, newsId))
      .limit(1);

    res.status(200).json({
      success: true,
      message: 'Noticia regenerada exitosamente',
      news: updatedNews
    });

  } catch (error) {
    console.error('❌ Error regenerando noticia:', error);
    res.status(500).json({ 
      error: 'Error al regenerar noticia',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * GET /api/artist-generator/launch-status/:firestoreId
 * Returns real-time launch orchestration status for an artist.
 */
router.get("/launch-status/:firestoreId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { firestoreId } = req.params;
    if (!firestoreId || firestoreId.length < 5) {
      return res.status(400).json({ error: 'Invalid firestoreId' });
    }

    const doc = await db.collection('generated_artists').doc(firestoreId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const data = doc.data()!;
    const launchTasks = data.launchTasks || {};
    const launchPlan = data.launchPlan || {};

    const taskKeys = Object.keys(launchTasks);
    let completed = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;
    let skipped = 0;

    taskKeys.forEach((key) => {
      const s = launchTasks[key]?.status;
      if (s === 'completed') completed++;
      else if (s === 'failed') failed++;
      else if (s === 'running') running++;
      else if (s === 'skipped') skipped++;
      else pending++;
    });

    const total = taskKeys.length;
    const done = completed + failed + skipped;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

    res.status(200).json({
      firestoreId,
      artistName: data.name || data.artistName,
      launchStatus: launchPlan.status || 'unknown',
      backgroundTasksPending: data.backgroundTasksPending ?? false,
      launchStartedAt: data.launchStartedAt || null,
      launchCompletedAt: data.launchCompletedAt || null,
      progress: {
        total,
        completed,
        failed,
        running,
        pending,
        skipped,
        percentComplete: progressPct,
      },
      tasks: launchTasks,
      releaseCalendar: data.releaseCalendar || null,
      nextReleaseAt: launchPlan.nextReleaseAt || null,
    });
  } catch (error) {
    console.error('❌ Error fetching launch status:', error);
    res.status(500).json({
      error: 'Failed to fetch launch status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;