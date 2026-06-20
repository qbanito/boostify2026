import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, songs, merchandise, artistMedia } from '../db/schema';
import { eq, count, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import fileUpload from 'express-fileupload';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import { insertSongSchema, insertMerchandiseSchema } from '../../db/schema';
import { 
  ensureArtistProfile, 
  saveSongToProfile, 
  saveVideoToProfile,
  updateProfileImages 
} from '../services/artist-profile-auto';
import { storage } from '../firebase';

const router = Router();

async function findProfileUser(slugOrId: string) {
  const isNumericId = /^\d+$/.test(slugOrId);

  let user;
  if (isNumericId) {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(slugOrId)))
      .limit(1);
  } else {
    [user] = await db
      .select()
      .from(users)
      .where(eq(users.slug, slugOrId))
      .limit(1);

    if (!user) {
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.firestoreId, slugOrId))
        .limit(1);
    }
  }

  return user;
}

// Helper function to generate unique slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/profile/list - Public list of artists for node flow artist picker
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const artists = await db
      .select({
        id: users.id,
        slug: users.slug,
        artistName: users.artistName,
        profileImageUrl: users.profileImageUrl,
        profileImage: users.profileImage,
        genre: users.genre,
        country: users.country,
      })
      .from(users)
      .limit(200);

    const items = artists
      .filter(a => a.slug && a.artistName)
      .map(a => ({
        id: a.id,
        slug: a.slug,
        artistName: a.artistName,
        image: a.profileImage || a.profileImageUrl || null,
        genre: a.genre || null,
        country: a.country || null,
      }));

    res.json({ ok: true, items });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/profile - Get current user's profile (authenticated)
router.get('/user/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const email = req.user!.email;
    
    // Try to find user by Firebase UID (stored as username initially)
    let [user] = await db
      .select({
        id: users.id,
        username: users.username,
        artistName: users.artistName,
        slug: users.slug,
        profileImage: users.profileImage,
        coverImage: users.coverImage,
      })
      .from(users)
      .where(eq(users.username, firebaseUid))
      .limit(1);
      
    // If user doesn't exist in PostgreSQL, create one
    if (!user) {
      const defaultUsername = email?.split('@')[0] || firebaseUid.substring(0, 8);
      const defaultSlug = generateSlug(defaultUsername);
      
      const [newUser] = await db
        .insert(users)
        .values({
          username: firebaseUid, // Use Firebase UID as username for now
          password: 'firebase-user', // Placeholder since Firebase handles auth
          artistName: defaultUsername,
          slug: defaultSlug,
        })
        .returning({
          id: users.id,
          username: users.username,
          artistName: users.artistName,
          slug: users.slug,
          profileImage: users.profileImage,
          coverImage: users.coverImage,
        });
      
      user = newUser;
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ message: 'Error getting user profile' });
  }
});

// GET /api/profile/:slugOrId - Get public profile by slug, ID, or firestoreId
router.get('/:slugOrId', async (req: Request, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const user = await findProfileUser(slugOrId);
      
    if (!user) {
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Get all published content for this user
    const [userSongs, userMerch, userVideos] = await Promise.all([
      db.select().from(songs).where(eq(songs.userId, user.id)),
      db.select().from(merchandise).where(eq(merchandise.userId, user.id)),
      db.select().from(artistMedia).where(eq(artistMedia.userId, user.id))
    ]);
    
    // Return profile data without sensitive information
    // Include all fields needed for frontend to function properly
    const profile = {
      id: user.id,
      pgId: user.id,
      username: user.username,
      artistName: user.artistName || user.username,
      slug: user.slug,
      biography: user.biography,
      genre: user.genre,
      location: user.location,
      website: user.website,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
      bannerPosition: user.bannerPosition,
      loopVideoUrl: user.loopVideoUrl,
      email: user.email,
      phone: user.phone,
      instagramHandle: user.instagramHandle,
      twitterHandle: user.twitterHandle,
      youtubeChannel: user.youtubeChannel,
      spotifyUrl: user.spotifyUrl,
      isAIGenerated: user.isAIGenerated,
      firestoreId: user.firestoreId,
      generatedBy: user.generatedBy,
      profileLayout: user.profileLayout,
      songs: userSongs,
      merchandise: userMerch,
      videos: userVideos
    };
    
    res.json(profile);
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ message: 'Error getting profile' });
  }
});

// GET /api/profile/:slugOrId/analytics-summary - real artist analytics aggregates
router.get('/:slugOrId/analytics-summary', async (req: Request, res: Response) => {
  try {
    const user = await findProfileUser(req.params.slugOrId);
    if (!user) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const [songAgg, videoAgg, merchCatalogAgg, merchSalesAgg, smartMerchAgg] = await Promise.all([
      db
        .select({
          songCount: count(),
          totalPlays: sql<number>`COALESCE(SUM(${songs.plays}), 0)::int`,
        })
        .from(songs)
        .where(eq(songs.userId, user.id)),
      db
        .select({
          videoCount: count(),
          totalViews: sql<number>`COALESCE(SUM(${artistMedia.views}), 0)::int`,
        })
        .from(artistMedia)
        .where(eq(artistMedia.userId, user.id)),
      db
        .select({
          productCount: count(),
        })
        .from(merchandise)
        .where(eq(merchandise.userId, user.id)),
      db.execute(sql`
        SELECT
          COALESCE(SUM(quantity), 0)::int AS sold_units,
          COALESCE(SUM(sale_amount), 0)::text AS total_revenue
        FROM sales_transactions
        WHERE artist_id = ${user.id} AND status = 'completed'
      `),
      db.execute(sql`
        SELECT
          COALESCE(COUNT(*), 0)::int AS product_count,
          COALESCE(SUM(sold_units), 0)::int AS sold_units,
          COALESCE((
            SELECT SUM(subtotal)
            FROM smart_merch_orders
            WHERE artist_id = ${user.id} AND payment_status = 'paid'
          ), 0)::text AS total_revenue
        FROM smart_merch_products
        WHERE artist_id = ${user.id} AND status <> 'archived'
      `),
    ]);

    const merchSalesRow = merchSalesAgg.rows[0] as { sold_units?: string | number; total_revenue?: string } | undefined;
    const smartMerchRow = smartMerchAgg.rows[0] as { product_count?: string | number; sold_units?: string | number; total_revenue?: string } | undefined;

    const songSummary = songAgg[0] || { songCount: 0, totalPlays: 0 };
    const videoSummary = videoAgg[0] || { videoCount: 0, totalViews: 0 };
    const merchCatalogSummary = merchCatalogAgg[0] || { productCount: 0 };

    const merchSoldUnits = Number(merchSalesRow?.sold_units || 0);
    const smartMerchSoldUnits = Number(smartMerchRow?.sold_units || 0);
    const merchRevenue = Number(merchSalesRow?.total_revenue || 0);
    const smartMerchRevenue = Number(smartMerchRow?.total_revenue || 0);
    const smartMerchProductCount = Number(smartMerchRow?.product_count || 0);

    return res.json({
      songCount: Number(songSummary.songCount || 0),
      totalPlays: Number(songSummary.totalPlays || 0),
      videoCount: Number(videoSummary.videoCount || 0),
      totalViews: Number(videoSummary.totalViews || 0),
      catalogProductCount: Number(merchCatalogSummary.productCount || 0) + smartMerchProductCount,
      unitsSold: merchSoldUnits + smartMerchSoldUnits,
      totalRevenue: merchRevenue + smartMerchRevenue,
      merchUnitsSold: merchSoldUnits,
      smartMerchUnitsSold: smartMerchSoldUnits,
      smartMerchProductCount,
    });
  } catch (error) {
    console.error('Error getting analytics summary:', error);
    res.status(500).json({ message: 'Error getting analytics summary' });
  }
});

// PUT /api/profile - Update own profile (authenticated)
router.put('/', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const { artistName, biography, genre, location, website, instagramHandle, twitterHandle, youtubeChannel, slug: requestedSlug } = req.body;
    
    // Find user by Firebase UID (stored in username)
    const [currentUser] = await db.select().from(users).where(eq(users.username, firebaseUid)).limit(1);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = currentUser.id;
    
    // Handle slug update
    let slug = undefined;
    if (requestedSlug !== undefined && requestedSlug.trim() !== '') {
      // Normalize the slug
      slug = generateSlug(requestedSlug);
      
      // Validate slug is not empty after normalization
      if (!slug) {
        return res.status(400).json({ message: 'Invalid slug' });
      }
      
      // Check if slug is already taken by another user
      const [existingUser] = await db.select().from(users).where(eq(users.slug, slug)).limit(1);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ message: 'This URL is already taken. Please choose a different one.' });
      }
    } else if (artistName) {
      // Auto-generate slug if artistName is provided and user doesn't have one
      if (!currentUser.slug) {
        slug = generateSlug(artistName);
        
        // Check if slug already exists
        const [existingUser] = await db.select().from(users).where(eq(users.slug, slug)).limit(1);
        if (existingUser) {
          slug = `${slug}-${userId}`;
        }
      }
    }
    
    const updateData: any = {
      ...(artistName !== undefined && { artistName }),
      ...(biography !== undefined && { biography }),
      ...(genre !== undefined && { genre }),
      ...(location !== undefined && { location }),
      ...(website !== undefined && { website }),
      ...(instagramHandle !== undefined && { instagramHandle }),
      ...(twitterHandle !== undefined && { twitterHandle }),
      ...(youtubeChannel !== undefined && { youtubeChannel }),
      ...(slug && { slug })
    };
    
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
      
    res.json({ message: 'Profile updated', profile: updated });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// POST /api/profile/upload - Upload profile images to Firebase Storage (authenticated)
router.post('/upload', authenticate, async (req: any, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    
    // Find user by Clerk ID (primary auth identifier)
    const [user] = await db.select().from(users).where(eq(users.clerkId, firebaseUid)).limit(1);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = user.id;
    
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }
    
    const uploadedFiles: any = {};
    
    // Helper function to upload file to Firebase Storage
    const uploadToFirebase = async (file: fileUpload.UploadedFile, folder: string): Promise<string> => {
      if (!storage) {
        throw new Error('Firebase Storage not available');
      }
      
      const bucket = storage.bucket();
      const timestamp = Date.now();
      const ext = path.extname(file.name) || '.jpg';
      const fileName = `profiles/${userId}/${folder}-${timestamp}${ext}`;
      const firebaseFile = bucket.file(fileName);
      
      await firebaseFile.save(file.data, {
        metadata: {
          contentType: file.mimetype,
        },
        validation: false,
      });
      
      return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
    };
    
    // Handle profileImage
    if (req.files.profileImage) {
      const file = Array.isArray(req.files.profileImage) ? req.files.profileImage[0] : req.files.profileImage;
      try {
        uploadedFiles.profileImage = await uploadToFirebase(file, 'profile');
        console.log(`✅ Profile image uploaded to Firebase: ${uploadedFiles.profileImage}`);
      } catch (err) {
        console.error('Error uploading profile image to Firebase:', err);
        // Fallback to local storage if Firebase fails
        const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles', userId.toString());
        await fs.mkdir(uploadsDir, { recursive: true });
        const filename = `profile-${Date.now()}${path.extname(file.name)}`;
        const filepath = path.join(uploadsDir, filename);
        await file.mv(filepath);
        uploadedFiles.profileImage = `/uploads/profiles/${userId}/${filename}`;
        console.warn(`⚠️ Used local fallback for profile image: ${uploadedFiles.profileImage}`);
      }
    }
    
    // Handle coverImage
    if (req.files.coverImage) {
      const file = Array.isArray(req.files.coverImage) ? req.files.coverImage[0] : req.files.coverImage;
      try {
        uploadedFiles.coverImage = await uploadToFirebase(file, 'cover');
        console.log(`✅ Cover image uploaded to Firebase: ${uploadedFiles.coverImage}`);
      } catch (err) {
        console.error('Error uploading cover image to Firebase:', err);
        // Fallback to local storage if Firebase fails
        const uploadsDir = path.join(process.cwd(), 'uploads', 'profiles', userId.toString());
        await fs.mkdir(uploadsDir, { recursive: true });
        const filename = `cover-${Date.now()}${path.extname(file.name)}`;
        const filepath = path.join(uploadsDir, filename);
        await file.mv(filepath);
        uploadedFiles.coverImage = `/uploads/profiles/${userId}/${filename}`;
        console.warn(`⚠️ Used local fallback for cover image: ${uploadedFiles.coverImage}`);
      }
    }
    
    // Update user profile with new images
    if (Object.keys(uploadedFiles).length > 0) {
      await db
        .update(users)
        .set(uploadedFiles)
        .where(eq(users.id, userId));
    }
    
    res.json({ message: 'Files uploaded', files: uploadedFiles });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ message: 'Error uploading files' });
  }
});

// POST /api/profile/ensure - Ensure user has a profile (auto-create if needed)
router.post('/ensure', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const email = req.user!.email;
    const displayName = (req.user as any)?.displayName || (req.user as any)?.name;
    const { genre } = req.body;
    
    console.log('🔍 Verificando perfil para usuario:', firebaseUid);
    
    const result = await ensureArtistProfile({
      firebaseUid,
      email,
      displayName,
      genre
    });
    
    res.json({
      success: true,
      profile: result,
      message: result.isNew ? 'Perfil creado automáticamente' : 'Perfil existente'
    });
  } catch (error) {
    console.error('Error ensuring profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error verificando perfil' 
    });
  }
});

// POST /api/profile/save-song - Save a song to user's profile
router.post('/save-song', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const { title, audioUrl, lyrics, genre, duration, fileName, format } = req.body;
    
    // Ensure user has profile first (in PostgreSQL)
    const profile = await ensureArtistProfile({ firebaseUid });
    
    // Save song to Firestore
    const song = await saveSongToProfile({
      artistId: firebaseUid, // Use Firebase UID for Firestore
      title,
      audioUrl,
      lyrics,
      genre,
      duration,
      fileName,
      format
    });
    
    res.json({
      success: true,
      song,
      profileSlug: profile.slug,
      message: 'Canción guardada exitosamente'
    });
  } catch (error) {
    console.error('Error saving song:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error guardando canción' 
    });
  }
});

// POST /api/profile/save-video - Save a video to user's profile
router.post('/save-video', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const { title, videoUrl, thumbnailUrl, songId, description, duration } = req.body;
    
    // Ensure user has profile first (in PostgreSQL)
    const profile = await ensureArtistProfile({ firebaseUid });
    
    // Save video to Firestore (`videos` collection — read by the Artist Profile)
    const video = await saveVideoToProfile({
      artistId: firebaseUid, // Clerk/Firebase UID for Firestore artistId match
      userId: profile.userId, // Numeric PG id — primary key the profile queries by
      slug: profile.slug,
      title,
      videoUrl,
      thumbnailUrl,
      songId,
      description,
      duration
    });
    
    res.json({
      success: true,
      video,
      profileSlug: profile.slug,
      message: 'Video guardado exitosamente'
    });
  } catch (error) {
    console.error('Error saving video:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error guardando video' 
    });
  }
});

// POST /api/profile/update-images - Update profile images automatically
router.post('/update-images', authenticate, async (req: Request, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const { profileImageUrl, coverImageUrl, onlyIfEmpty = true } = req.body;
    
    // Ensure user has profile first
    const profile = await ensureArtistProfile({ firebaseUid });
    
    const updated = await updateProfileImages({
      userId: profile.userId,
      profileImageUrl,
      coverImageUrl,
      onlyIfEmpty
    });
    
    res.json({
      success: true,
      updated,
      message: updated ? 'Imágenes actualizadas' : 'No se requirió actualización'
    });
  } catch (error) {
    console.error('Error updating images:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error actualizando imágenes' 
    });
  }
});

// POST /api/profile/:artistId/layout - Save profile layout configuration
router.post('/profile/:artistId/layout', authenticate, async (req: Request, res: Response) => {
  try {
    const artistIdParam = req.params.artistId;
    const userId = req.user!.id;
    const firebaseUid = req.user!.uid || req.user!.username; // Fallback to username if uid not present
    
    console.log(`🔍 [LAYOUT SAVE] Attempting to save layout for:`, { artistIdParam, userId, firebaseUid });
    
    // Support both numeric ID and UUID
    let artist;
    const isNumericId = /^\d+$/.test(artistIdParam);
    
    if (isNumericId) {
      const artistId = parseInt(artistIdParam);
      [artist] = await db
        .select()
        .from(users)
        .where(eq(users.id, artistId))
        .limit(1);
      console.log(`🔍 [LAYOUT SAVE] Searched by numeric ID ${artistId}, found:`, artist?.username);
    } else {
      // Try firestoreId (UUID)
      [artist] = await db
        .select()
        .from(users)
        .where(eq(users.firestoreId, artistIdParam))
        .limit(1);
      console.log(`🔍 [LAYOUT SAVE] Searched by firestoreId ${artistIdParam}, found:`, artist?.username);
    }
      
    if (!artist) {
      console.log(`❌ [LAYOUT SAVE] Artist not found for:`, artistIdParam);
      return res.status(404).json({ message: 'Artist not found' });
    }
    
    // Allow if: (1) user created this artist via AI, or (2) it's the user's own profile (firestoreId matches)
    const isGeneratedByUser = artist.generatedBy === userId;
    const isOwnProfile = artist.firestoreId === firebaseUid;
    const isOwner = isGeneratedByUser || isOwnProfile;
    
    console.log(`🔍 [LAYOUT SAVE] Ownership check:`, { 
      artistGeneratedBy: artist.generatedBy, 
      userId, 
      isGeneratedByUser,
      artistFirestoreId: artist.firestoreId, 
      firebaseUid, 
      isOwnProfile,
      isOwner
    });
    
    if (!isOwner) {
      console.log(`❌ [LAYOUT SAVE] Unauthorized - not owner`);
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const layoutSchema = z.object({
      order: z.array(z.string()),
      visibility: z.record(z.boolean()),
      expanded: z.record(z.boolean()).optional(),
      rightOrder: z.array(z.string()).optional(),
      rightVisibility: z.record(z.boolean()).optional(),
      rightExpanded: z.record(z.boolean()).optional(),
      colorTheme: z.string().optional(),
      mobileColumnFirst: z.enum(['left', 'right']).optional(),
      fontKey: z.string().optional(),
      sideOverride: z.record(z.enum(['left', 'right'])).optional(),
      // Custom user-defined blocks (text, separator, banner, section).
      // Keyed by block id (e.g. "custom-block-xxxx") which also lives in `order`.
      customBlocks: z.record(z.object({
        id: z.string(),
        kind: z.enum(['text', 'separator', 'banner', 'section']),
        createdAt: z.number().optional(),
      }).passthrough()).optional(),
    });
    
    const layout = layoutSchema.parse(req.body);
    
    await db
      .update(users)
      .set({ 
        profileLayout: layout,
        updatedAt: new Date()
      })
      .where(eq(users.id, artist.id));
    
    console.log(`✅ [LAYOUT SAVE] Layout successfully saved for artist ${artist.id} (${artist.username})`);
    res.json({ success: true, layout });
  } catch (error) {
    console.error('❌ [LAYOUT SAVE] Error saving profile layout:', error);
    res.status(500).json({ message: 'Failed to save profile layout', error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile/generate-character-pack
// Generates 4 studio reference images from the artist's profile photo using
// Flux Kontext (FAL AI). Images are saved to Firestore for use by other modules.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-character-pack', authenticate, async (req: any, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;

    // Resolve user
    const [user] = await db.select().from(users).where(eq(users.clerkId, firebaseUid)).limit(1);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profileImageUrl: string = req.body.profileImageUrl || user.profileImage || user.profileImageUrl;
    if (!profileImageUrl) {
      return res.status(400).json({ success: false, message: 'No profile image available. Please upload a profile photo first.' });
    }

    const artistName: string = user.artistName || user.displayName || user.username || 'Artist';
    const genre: string = req.body.genre || user.genre || 'music';

    console.log(`🎭 [CHARACTER PACK] Generating for "${artistName}" (${genre})…`);
    console.log(`🖼️  Reference: ${profileImageUrl.substring(0, 80)}…`);

    // Lazy import to avoid circular deps
    const { generateArtistCharacterPack } = await import('../services/fal-service');
    const result = await generateArtistCharacterPack(profileImageUrl, artistName, genre);

    if (!result.success || result.images.length === 0) {
      return res.status(500).json({ success: false, message: result.error || 'Character pack generation failed' });
    }

    // ── Save to Firestore ──────────────────────────────────────────────────
    const { db: firestoreDb, FieldValue } = await import('../firebase');
    if (firestoreDb) {
      try {
        const packDoc = {
          userId: user.id,
          artistName,
          genre,
          profileImageUrl,
          images: result.images,
          generatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          version: 1,
        };

        // Store the full pack as a single document keyed by userId
        await firestoreDb.collection('artistCharacterPacks').doc(String(user.id)).set(packDoc, { merge: true });

        // Also store each image individually in the artist gallery
        const galleryRef = firestoreDb
          .collection('artistGallery')
          .doc(String(user.id))
          .collection('characterPack');

        const batchWrite = firestoreDb.batch();
        for (const img of result.images) {
          const docRef = galleryRef.doc(img.angle);
          batchWrite.set(docRef, {
            ...img,
            userId: user.id,
            artistName,
            genre,
            source: 'character-pack',
            savedAt: FieldValue.serverTimestamp(),
          });
        }
        await batchWrite.commit();

        console.log(`✅ [CHARACTER PACK] Saved ${result.images.length} images to Firestore for user ${user.id}`);
      } catch (fsErr: any) {
        console.error('⚠️ [CHARACTER PACK] Firestore save failed (non-fatal):', fsErr.message);
        // Non-fatal — images were generated, just not persisted to Firestore
      }
    }

    // ── Save reference in user row (first image = canonical character ref) ─
    try {
      await db
        .update(users)
        .set({ characterPackGeneratedAt: new Date() } as any)
        .where(eq(users.id, user.id));
    } catch {
      // Column may not exist yet — non-fatal
    }

    return res.json({
      success: true,
      images: result.images,
      count: result.images.length,
      message: `${result.images.length} character reference images generated successfully`,
    });
  } catch (error: any) {
    console.error('❌ [CHARACTER PACK] Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
});

// GET /api/profile/character-pack — Returns the saved character pack for the authenticated user
router.get('/character-pack', authenticate, async (req: any, res: Response) => {
  try {
    const firebaseUid = req.user!.uid || req.user!.id;
    const [user] = await db.select().from(users).where(eq(users.clerkId, firebaseUid)).limit(1);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { db: firestoreDb } = await import('../firebase');
    if (!firestoreDb) {
      return res.json({ success: true, images: [], haspack: false });
    }

    const doc = await firestoreDb.collection('artistCharacterPacks').doc(String(user.id)).get();
    if (!doc.exists) {
      return res.json({ success: true, images: [], haspack: false });
    }

    const data = doc.data();
    return res.json({
      success: true,
      images: data?.images || [],
      haspack: true,
      generatedAt: data?.generatedAt,
      artistName: data?.artistName,
      genre: data?.genre,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
