import { Router, Request, Response } from 'express';
import { db } from '../db';
import { songs } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import path from 'path';
import fs from 'fs/promises';
import { insertSongSchema, subscriptions, users } from '../../db/schema';
import { generateImageWithNanoBanana, editImageWithNanoBanana, generateImageWithOpenAI } from '../services/fal-service';
import { getTierFromPlan, TIER_LIMITS } from '../../shared/tier-limits';
import { triggerSongMonetizationPipeline } from '../services/song-monetization-pipeline';
import { triggerSongAnalysis } from '../services/song-analysis-pipeline';
import { isAdminEmail } from '../../shared/constants';
import { db as firestoreDb, storage } from '../firebase';
import { generateSongCover } from '../services/song-cover-generator';
import { notifyArtistFans } from '../services/artist-fan-notifications';

const router = Router();

/** Check if user can upload more songs based on their subscription tier */
async function canUploadSong(userId: number, userEmail?: string): Promise<{ allowed: boolean; message?: string }> {
  // Admins bypass limits
  if (userEmail && isAdminEmail(userEmail)) return { allowed: true };

  // Get current song count
  const userSongs = await db.select().from(songs).where(eq(songs.userId, userId));
  const currentCount = userSongs.length;

  // Get subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')));

  const tier = getTierFromPlan(sub?.plan);
  const limit = TIER_LIMITS[tier].songs;

  if (currentCount >= limit) {
    return {
      allowed: false,
      message: `Song limit reached (${currentCount}/${limit}). Upgrade your plan to upload more songs.`,
    };
  }
  return { allowed: true };
}

// POST /api/songs/generate-cover-art
// Builds a Grammy-grade album cover by combining song title + artist
// profile image + genre/mood metadata, then runs them through the
// fal cascade (gpt-image-1/edit/byok → nano-banana/edit → seedream/edit
// → OpenAI images.edit → text-to-image fallbacks). When `songId` is
// provided we persist the resulting URL on the matching song row
// (Postgres if numeric, Firestore otherwise).
router.post('/generate-cover-art', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      prompt,
      songId,
      songTitle,
      artistName,
      referenceImage,
      genre,
      mood,
      description,
    } = req.body || {};

    // We need *something* to work from — either a custom prompt or a song title.
    if (!prompt && !songTitle) {
      return res.status(400).json({
        success: false,
        message: 'Either `prompt` or `songTitle` is required',
      });
    }

    console.log(
      `🎨 [COVER-ART] song=${songId ?? '(none)'} title="${songTitle || prompt?.slice(0, 60)}" ` +
      `artist=${artistName || '?'} ref=${referenceImage ? 'yes' : 'no'}`,
    );

    let cover;
    try {
      cover = await generateSongCover({
        userPrompt: prompt,
        songTitle: songTitle || prompt || 'Untitled',
        artistName,
        genre: genre || null,
        mood: mood || null,
        description: description || null,
        referenceImage: referenceImage || null,
        artistId: userId,
      });
    } catch (err: any) {
      console.error('❌ [COVER-ART] All providers failed:', err?.message || err);
      return res.status(502).json({
        success: false,
        message: err?.message || 'Failed to generate cover art with all providers',
      });
    }

    let coverArtUrl = cover.url;

    // Upload generated image to Firebase Storage for permanent public URL.
    // Local disk is ephemeral in production containers — we must use GCS.
    if (storage && !coverArtUrl.startsWith('data:')) {
      try {
        const imageResponse = await fetch(coverArtUrl);
        if (imageResponse.ok) {
          const contentType = imageResponse.headers.get('content-type') || 'image/png';
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const objectPath = `song-covers/${userId}/song-cover-${songId || Date.now()}-${Date.now()}.png`;
          const bucket = storage.bucket();
          const file = bucket.file(objectPath);
          await file.save(imageBuffer, {
            contentType,
            resumable: false,
            metadata: { cacheControl: 'public, max-age=31536000, immutable' },
          });
          await file.makePublic();
          coverArtUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;
          console.log(`☁️ [COVER-ART] Uploaded to Firebase Storage: ${coverArtUrl}`);
        }
      } catch (uploadErr: any) {
        console.warn('⚠️ [COVER-ART] Firebase Storage upload failed, using original URL:', uploadErr.message);
      }
    }

    // If songId provided, persist on the song record.
    if (songId !== undefined && songId !== null && songId !== '') {
      const rawId = String(songId);
      try {
        if (/^\d+$/.test(rawId)) {
          await db.update(songs).set({ coverArt: coverArtUrl }).where(eq(songs.id, parseInt(rawId, 10)));
          console.log(`✅ [COVER-ART] Saved Postgres song ${rawId}: ${coverArtUrl}`);
        } else if (firestoreDb) {
          await firestoreDb.collection('songs').doc(rawId).update({
            coverArt: coverArtUrl,
            updatedAt: new Date(),
          });
          console.log(`✅ [COVER-ART] Saved Firestore song ${rawId}: ${coverArtUrl}`);
        }
      } catch (dbErr: any) {
        console.warn('⚠️ [COVER-ART] DB update failed:', dbErr.message);
      }
    }

    res.json({
      success: true,
      coverArtUrl,
      provider: cover.provider,
      prompt: cover.prompt,
      message: 'Cover art generated successfully',
    });
  } catch (error: any) {
    console.error('❌ [COVER-ART] Unexpected error:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Error generating cover art',
    });
  }
});

// GET /api/songs - Get own songs (authenticated)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const userSongs = await db
      .select()
      .from(songs)
      .where(eq(songs.userId, userId));
      
    res.json(userSongs);
  } catch (error) {
    console.error('Error getting songs:', error);
    res.status(500).json({ message: 'Error getting songs' });
  }
});

// GET /api/songs/user/:userId - Get songs by user ID
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    console.log(`🎵 [SONGS] Fetching songs for user: ${userId}`);
    
    const userSongs = await db
      .select()
      .from(songs)
      .where(eq(songs.userId, userId));
    
    console.log(`🎵 [SONGS] Found ${userSongs.length} songs for user ${userId}`);
    res.json(userSongs);
  } catch (error) {
    console.error('Error getting songs:', error);
    res.status(500).json({ message: 'Error getting songs' });
  }
});

// GET /api/songs/showcase - Public AI-generated songs from all artists in the DB
// Used by the Music Generator "Community Showcase" so users can hear real examples.
router.get('/showcase', async (req: Request, res: Response) => {
  try {
    const limitNum = Math.max(1, Math.min(parseInt(String(req.query.limit || '24')) || 24, 60));
    const genreFilter = req.query.genre ? String(req.query.genre).trim() : null;
    const sort = String(req.query.sort || 'recent'); // recent | popular | random

    const whereClauses: any[] = [
      eq(songs.generatedWithAI, true),
      eq(songs.isPublished, true),
      sql`${songs.audioUrl} IS NOT NULL`,
    ];
    if (genreFilter && genreFilter.toLowerCase() !== 'all') {
      whereClauses.push(sql`LOWER(${songs.genre}) = LOWER(${genreFilter})`);
    }

    let orderExpr;
    if (sort === 'popular') orderExpr = [desc(songs.plays), desc(songs.createdAt)];
    else if (sort === 'random') orderExpr = [sql`RANDOM()`];
    else orderExpr = [desc(songs.createdAt)];

    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        description: songs.description,
        audioUrl: songs.audioUrl,
        coverArt: songs.coverArt,
        genre: songs.genre,
        mood: songs.mood,
        duration: songs.duration,
        aiProvider: songs.aiProvider,
        plays: songs.plays,
        createdAt: songs.createdAt,
        artistId: users.id,
        artistName: users.artistName,
        artistFirstName: users.firstName,
        artistLastName: users.lastName,
        artistUsername: users.username,
        artistSlug: users.slug,
        artistImage: users.profileImage,
        artistImageUrl: users.profileImageUrl,
        artistCountry: users.country,
        artistGenre: users.genre,
        isAIGenerated: users.isAIGenerated,
      })
      .from(songs)
      .innerJoin(users, eq(users.id, songs.userId))
      .where(and(...whereClauses))
      .orderBy(...(orderExpr as any))
      .limit(limitNum);

    const items = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      audioUrl: r.audioUrl,
      coverArt: r.coverArt,
      genre: r.genre,
      mood: r.mood,
      duration: r.duration,
      aiProvider: r.aiProvider,
      plays: r.plays || 0,
      createdAt: r.createdAt,
      artist: {
        id: r.artistId,
        name: r.artistName || [r.artistFirstName, r.artistLastName].filter(Boolean).join(' ') || r.artistUsername || 'Boostify Artist',
        slug: r.artistSlug,
        image: r.artistImage || r.artistImageUrl,
        country: r.artistCountry,
        genre: r.artistGenre,
        isAIGenerated: !!r.isAIGenerated,
      },
    }));

    // Genre distribution for filter chips
    const genres = await db
      .select({ genre: songs.genre, count: sql<number>`COUNT(*)::int` })
      .from(songs)
      .where(and(eq(songs.generatedWithAI, true), eq(songs.isPublished, true), sql`${songs.genre} IS NOT NULL AND ${songs.genre} <> ''`))
      .groupBy(songs.genre)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    res.json({
      success: true,
      items,
      genres: genres.map((g: any) => ({ genre: g.genre, count: g.count })),
      total: items.length,
    });
  } catch (error: any) {
    console.error('Error getting showcase:', error);
    res.status(500).json({ success: false, message: 'Error fetching showcase', error: error?.message });
  }
});

// GET /api/songs/generated - List the current user's AI-generated songs from Postgres
router.get('/generated', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = await db
      .select()
      .from(songs)
      .where(and(eq(songs.userId, userId), eq(songs.generatedWithAI, true)))
      .orderBy(desc(songs.createdAt));
    res.json({ success: true, items: rows });
  } catch (error: any) {
    console.error('Error getting user generated songs:', error);
    res.status(500).json({ success: false, message: 'Error fetching generated songs' });
  }
});

// POST /api/songs/generated - Save AI-generated song with URL (authenticated)
router.post('/generated', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check song upload limit
    const limitCheck = await canUploadSong(userId, req.user!.email);
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    const { 
      title, 
      description, 
      audioUrl, 
      genre, 
      mood,
      lyrics, // Letras generadas por AI
      artistGender,
      duration, 
      prompt, 
      coverArt,
      aiProvider // ej: 'fal-minimax-music-v2'
    } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({ message: 'Audio URL is required' });
    }
    
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    // Create song record with AI-generated audio URL and lyrics
    const [newSong] = await db
      .insert(songs)
      .values({
        userId,
        title,
        description: description || prompt || 'AI-generated music',
        audioUrl,
        genre: genre || 'AI Generated',
        mood: mood || null,
        lyrics: lyrics || null,
        artistGender: artistGender || null,
        generatedWithAI: true,
        aiProvider: aiProvider || 'fal-minimax-music-v2',
        coverArt: coverArt || null,
        duration: duration || null,
        releaseDate: new Date(),
        isPublished: true,
        plays: 0,
        analysisStatus: 'pending',
      })
      .returning();

    // 🎵 Audio analysis pipeline (OpenAI Whisper + fal sound model + GPT insights)
    triggerSongAnalysis(newSong.id);

    // Fire monetization pipeline (distribution, tokenization, sync, outreach) — fire-and-forget
    triggerSongMonetizationPipeline(newSong.id).catch((err) =>
      console.warn(`⚠️ [Songs] Monetization pipeline error for song #${newSong.id}:`, err.message),
    );

    res.json({ 
      success: true,
      message: 'AI-generated song saved to profile', 
      song: newSong 
    });
  } catch (error) {
    console.error('Error saving generated song:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error saving generated song' 
    });
  }
});

// POST /api/songs - Create new song (authenticated)
router.post('/', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;

    // Check song upload limit
    const limitCheck = await canUploadSong(userId, req.user!.email);
    if (!limitCheck.allowed) {
      return res.status(403).json({ message: limitCheck.message });
    }

    const { title, description, genre, releaseDate } = req.body;
    
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ message: 'No audio file uploaded' });
    }
    
    const audioFile = Array.isArray(req.files.audio) ? req.files.audio[0] : req.files.audio;
    
    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'songs', userId.toString());
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Save audio file
    const audioFilename = `song-${Date.now()}${path.extname(audioFile.name)}`;
    const audioPath = path.join(uploadsDir, audioFilename);
    await audioFile.mv(audioPath);
    const audioUrl = `/uploads/songs/${userId}/${audioFilename}`;
    
    // Handle cover art if provided
    let coverArt = null;
    if (req.files.coverArt) {
      const coverFile = Array.isArray(req.files.coverArt) ? req.files.coverArt[0] : req.files.coverArt;
      const coverFilename = `cover-${Date.now()}${path.extname(coverFile.name)}`;
      const coverPath = path.join(uploadsDir, coverFilename);
      await coverFile.mv(coverPath);
      coverArt = `/uploads/songs/${userId}/${coverFilename}`;
    }
    
    // Create song record
    const [newSong] = await db
      .insert(songs)
      .values({
        userId,
        title,
        description,
        audioUrl,
        genre,
        coverArt,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        isPublished: true,
        plays: 0,
        analysisStatus: 'pending',
      })
      .returning();

    // 🎵 Audio analysis pipeline (OpenAI Whisper + fal sound model + GPT insights)
    triggerSongAnalysis(newSong.id);

    // Fire monetization pipeline (distribution, tokenization, sync, outreach) — fire-and-forget
    triggerSongMonetizationPipeline(newSong.id).catch((err) =>
      console.warn(`⚠️ [Songs] Monetization pipeline error for song #${newSong.id}:`, err.message),
    );

    // Notify existing fans about the new song — fire-and-forget
    db.select({ artistName: users.artistName, slug: users.slug })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then(([info]) => {
        if (!info) return;
        return notifyArtistFans(userId, 'new_song', {
          artistName: info.artistName || 'your artist',
          artistSlug: info.slug || String(userId),
          songTitle: newSong.title,
        });
      })
      .catch((e) => console.warn('[Songs] Fan notify error:', e?.message));

    res.json({ message: 'Song created', song: newSong });
  } catch (error) {
    console.error('Error creating song:', error);
    res.status(500).json({ message: 'Error creating song' });
  }
});

// PUT /api/songs/:id - Update song (authenticated)
// :id may be a numeric Postgres id OR a Firestore document id string.
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawId = String(req.params.id || '');

    // ── Firestore document (non-numeric id) ──────────────────────────────────
    if (!/^\d+$/.test(rawId)) {
      if (!firestoreDb) return res.status(503).json({ message: 'Firestore not configured' });
      const docRef = firestoreDb.collection('songs').doc(rawId);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ message: 'Song not found' });
      const { title, displayOrder } = req.body;
      const fields: Record<string, any> = { updatedAt: new Date() };
      if (title !== undefined) fields.title = title;
      if (displayOrder !== undefined) fields.displayOrder = displayOrder;
      await docRef.update(fields);
      return res.json({ message: 'Song updated', song: { id: rawId, ...snap.data(), ...fields } });
    }

    // ── Postgres numeric id ──────────────────────────────────────────────────
    const songId = parseInt(rawId, 10);
    const { title, description, genre, releaseDate, isPublished, displayOrder } = req.body;
    
    // First verify ownership
    const [existing] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);
      
    if (!existing) {
      return res.status(404).json({ message: 'Song not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this song' });
    }
    
    const [updated] = await db
      .update(songs)
      .set({
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(genre && { genre }),
        ...(releaseDate && { releaseDate: new Date(releaseDate) }),
        ...(isPublished !== undefined && { isPublished })
      })
      .where(eq(songs.id, songId))
      .returning();

    // If the song also has a Firestore mirror, sync displayOrder there too
    if (typeof displayOrder === 'number' && updated.firestoreId && firestoreDb) {
      try {
        await firestoreDb.collection('songs').doc(updated.firestoreId).update({ displayOrder });
      } catch { /* non-fatal */ }
    }
    
    res.json({ message: 'Song updated', song: updated });
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ message: 'Error updating song' });
  }
});

// DELETE /api/songs/:id - Delete song (authenticated)
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const songId = parseInt(req.params.id);
    
    // First verify ownership
    const [existing] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);
      
    if (!existing) {
      return res.status(404).json({ message: 'Song not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this song' });
    }
    
    await db.delete(songs).where(eq(songs.id, songId));
    
    res.json({ message: 'Song deleted' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ message: 'Error deleting song' });
  }
});

// PUT /api/songs/:id/metadata - Update song metadata for distribution (authenticated)
// :id may be a numeric Postgres id OR a Firestore document id string.
router.put('/:id/metadata', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawId = String(req.params.id || '');
    const { isrc, upc, composers, genre, lyrics, coverArt, description } = req.body;

    // ── Firestore document (non-numeric id) ──────────────────────────────────
    if (!/^\d+$/.test(rawId)) {
      if (!firestoreDb) return res.status(503).json({ success: false, message: 'Firestore not configured' });
      const docRef = firestoreDb.collection('songs').doc(rawId);
      const snap = await docRef.get();
      if (!snap.exists) return res.status(404).json({ success: false, message: 'Song not found' });

      const updateFields: Record<string, any> = {};
      if (isrc !== undefined) updateFields.isrc = isrc;
      if (upc !== undefined) updateFields.upc = upc;
      if (composers !== undefined) updateFields.composers = Array.isArray(composers) ? composers : [composers];
      if (genre !== undefined) updateFields.genre = genre;
      if (lyrics !== undefined) updateFields.lyrics = lyrics;
      if (coverArt !== undefined) updateFields.coverArt = coverArt;
      if (description !== undefined) updateFields.description = description;
      updateFields.updatedAt = new Date();

      if (Object.keys(updateFields).length <= 1) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      await docRef.update(updateFields);
      console.log(`✅ [SONGS] Updated Firestore metadata for song ${rawId}`);
      const updated = { id: rawId, ...snap.data(), ...updateFields };
      return res.json({ success: true, message: 'Song metadata updated', song: updated });
    }

    // ── Postgres numeric id ──────────────────────────────────────────────────
    const songId = parseInt(rawId, 10);
    
    // First verify ownership
    const [existing] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);
      
    if (!existing) {
      return res.status(404).json({ message: 'Song not found' });
    }
    
    if (existing.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to update this song' });
    }
    
    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    
    if (isrc !== undefined) updateData.isrc = isrc;
    if (upc !== undefined) updateData.upc = upc;
    if (composers !== undefined) {
      updateData.composers = Array.isArray(composers) ? composers : [composers];
    }
    if (genre !== undefined) updateData.genre = genre;
    if (lyrics !== undefined) updateData.lyrics = lyrics;
    if (coverArt !== undefined) updateData.coverArt = coverArt;
    if (description !== undefined) updateData.description = description;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }
    
    const [updated] = await db
      .update(songs)
      .set(updateData)
      .where(eq(songs.id, songId))
      .returning();
    
    console.log(`✅ [SONGS] Updated metadata for song ${songId}:`, updateData);
    
    res.json({ 
      success: true,
      message: 'Song metadata updated', 
      song: updated 
    });
  } catch (error) {
    console.error('Error updating song metadata:', error);
    res.status(500).json({ message: 'Error updating song metadata' });
  }
});

// GET /api/songs/:id/analysis - Read the audio-analysis JSON for a song
// Used by AI agents (composer, video-director, marketing) to ground their output.
router.get('/:id/analysis', authenticate, async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.id);
    if (Number.isNaN(songId)) {
      return res.status(400).json({ message: 'Invalid song id' });
    }
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    return res.json({
      success: true,
      songId,
      status: song.analysisStatus || 'pending',
      analyzedAt: song.analyzedAt,
      error: song.analysisError,
      analysis: song.analysisJson || null,
    });
  } catch (error) {
    console.error('Error reading song analysis:', error);
    res.status(500).json({ message: 'Error reading song analysis' });
  }
});

// POST /api/songs/:id/set-single — Pin a song as the artist's single (only one per artist).
// Pass body { isSingle: true } to pin, { isSingle: false } to unpin. Owner-only.
// :id may be a numeric Postgres id OR a Firestore document id string.
router.post('/:id/set-single', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rawId = String(req.params.id || '');
    const isSingle = req.body?.isSingle !== false; // default to true
    if (!rawId) return res.status(400).json({ message: 'Invalid song id' });

    // Non-numeric id → Firestore document
    if (!/^\d+$/.test(rawId)) {
      if (!firestoreDb) {
        return res.status(503).json({ success: false, message: 'Firestore not configured on server' });
      }
      const docRef = firestoreDb.collection('songs').doc(rawId);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ success: false, message: 'Song not found in Firestore' });
      }
      const songData = snap.data() || {} as any;
      const artistId = songData.artistId || songData.userId;

      if (isSingle) {
        // Clear isSingle from all other songs by this artist in Firestore
        if (artistId) {
          const artistSongsSnap = await firestoreDb.collection('songs')
            .where('artistId', '==', artistId)
            .where('isSingle', '==', true)
            .get();
          if (!artistSongsSnap.empty) {
            const batch = firestoreDb.batch();
            artistSongsSnap.docs.forEach((d: any) => {
              if (d.id !== rawId) batch.update(d.ref, { isSingle: false, singlePinnedAt: null });
            });
            await batch.commit();
          }
        }
        await docRef.update({ isSingle: true, singlePinnedAt: new Date() });
      } else {
        await docRef.update({ isSingle: false, singlePinnedAt: null });
      }
      return res.json({ success: true });
    }

    // Numeric Postgres id
    const songId = parseInt(rawId, 10);

    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    if (song.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to modify this song' });
    }

    if (isSingle) {
      // Atomic-ish: clear all this artist's singles, then mark this one.
      await db
        .update(songs)
        .set({ isSingle: false, singlePinnedAt: null })
        .where(and(eq(songs.userId, userId), eq(songs.isSingle, true)));
      const [updated] = await db
        .update(songs)
        .set({ isSingle: true, singlePinnedAt: new Date() })
        .where(eq(songs.id, songId))
        .returning();
      return res.json({ success: true, song: updated });
    }

    const [updated] = await db
      .update(songs)
      .set({ isSingle: false, singlePinnedAt: null })
      .where(eq(songs.id, songId))
      .returning();
    return res.json({ success: true, song: updated });
  } catch (error) {
    console.error('[SONGS] set-single error:', error);
    res.status(500).json({ message: 'Error updating single' });
  }
});

// POST /api/songs/:id/cover - Save (or replace) a song's cover art with a URL.
// Accepts { coverArt: string } - either a remote URL OR a /uploads/... path.
// Owner-only. Use this after uploading via /api/upload/image, or after generating
// via /api/songs/generate-cover-art (which already persists internally if songId provided).
//
// :id may be either a numeric Postgres id OR a Firestore document id — songs in
// the artist profile come from Firestore, so we transparently update the right
// store based on the id shape.
router.post('/:id/cover', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id as number;
    const rawId = String(req.params.id || '');
    const { coverArt } = req.body || {};
    if (!rawId) return res.status(400).json({ success: false, message: 'Invalid song id' });
    if (!coverArt || typeof coverArt !== 'string') {
      return res.status(400).json({ success: false, message: 'coverArt URL required' });
    }

    // Numeric id → Postgres row.
    if (/^\d+$/.test(rawId)) {
      const songId = parseInt(rawId, 10);
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
      if (song.userId !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify this song' });
      }
      const [updated] = await db
        .update(songs)
        .set({ coverArt })
        .where(eq(songs.id, songId))
        .returning();
      return res.json({ success: true, song: updated });
    }

    // Non-numeric id → Firestore doc (the artist-profile song list reads from
    // Firestore for legacy/AI-generated catalogs).
    if (!firestoreDb) {
      return res.status(503).json({ success: false, message: 'Firestore not configured on server' });
    }
    const docRef = firestoreDb.collection('songs').doc(rawId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ success: false, message: `Song not found in Firestore (id=${rawId})` });
    }
    // NOTE: ownership for Firestore songs is enforced by the Firestore
    // security rules on the client write path. The server can't reliably
    // map a Clerk/Firebase auth id to the legacy pgId/firestoreArtistId
    // stored on each doc, so we trust the authenticated request here.
    const docData: any = snap.data() || {};
    await docRef.update({ coverArt, updatedAt: new Date() });
    const updated = { id: rawId, ...docData, coverArt };
    return res.json({ success: true, song: updated });
  } catch (error: any) {
    console.error('[SONGS] set-cover error:', error);
    res.status(500).json({ success: false, message: error?.message || 'Error updating cover' });
  }
});

// GET /api/songs/:id/public — Public song data for the shareable /song/:id page.
// No authentication required so Facebook/LinkedIn crawlers and unauthenticated
// visitors can load the page.
router.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const songId = parseInt(req.params.id, 10);
    if (Number.isNaN(songId)) return res.status(400).json({ message: 'Invalid song id' });

    const [song] = await db
      .select({
        id: songs.id,
        title: songs.title,
        genre: songs.genre,
        mood: songs.mood,
        coverArt: songs.coverArt,
        audioUrl: songs.audioUrl,
        description: songs.description,
        artistName: users.artistName,
        slug: users.slug,
        profileImage: users.profileImage,
      })
      .from(songs)
      .leftJoin(users, eq(songs.userId, users.id))
      .where(eq(songs.id, songId))
      .limit(1);

    if (!song) return res.status(404).json({ message: 'Song not found' });
    return res.json(song);
  } catch (error: any) {
    console.error('Error fetching public song:', error);
    res.status(500).json({ message: 'Error fetching song' });
  }
});

// POST /api/songs/:id/analyze - Re-trigger the analysis pipeline for a song
// (owner-only). Useful when keys were missing during the original upload.
router.post('/:id/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const songId = parseInt(req.params.id);
    if (Number.isNaN(songId)) {
      return res.status(400).json({ message: 'Invalid song id' });
    }
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return res.status(404).json({ message: 'Song not found' });
    if (song.userId !== userId) {
      return res.status(403).json({ message: 'Not authorized to analyze this song' });
    }
    triggerSongAnalysis(songId);
    return res.json({ success: true, message: 'Song analysis re-triggered', songId });
  } catch (error) {
    console.error('Error triggering song analysis:', error);
    res.status(500).json({ message: 'Error triggering song analysis' });
  }
});

export default router;
