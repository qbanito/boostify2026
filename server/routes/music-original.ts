/**
 * Boostify Music — Original Song Pipeline
 *
 * POST /api/music-original/create
 *   Creates a new original song: authorship declaration → generation → stems → certificate
 *
 * POST /api/music-original/certify-existing
 *   Certifies an existing uploaded song from the artist profile:
 *   authorship declaration → stems → hash → certificate
 *
 * GET  /api/music-original/my
 *   List all original song projects for the authenticated user
 *
 * GET  /api/music-original/:id
 *   Get a single project by ID
 *
 * GET  /api/music-original/songs
 *   List the artist's uploaded songs (for the "certify existing" dropdown)
 */

import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { db } from '../db';
import { songs, users } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { generateOriginalSong } from '../services/smart-music-router';
import { separateStems } from '../services/voice-ai-service';
import { sendCopyrightCertificate } from '../services/copyright-email';
import { neon } from '@neondatabase/serverless';
import { log } from '../vite';

const router = Router();
const sql = neon(process.env.DATABASE_URL!);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashEvidencePacket(data: object): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

async function updateProject(id: string, fields: Record<string, any>): Promise<void> {
  const sets = Object.keys(fields)
    .map((k, i) => `"${camelToSnake(k)}" = $${i + 2}`)
    .join(', ');
  const values = Object.values(fields);
  await sql(`UPDATE original_song_projects SET ${sets}, updated_at = NOW() WHERE id = $1`, [id, ...values]);
}

function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase();
}

async function getProjectById(id: string, userId: number): Promise<any> {
  const rows = await sql(
    `SELECT * FROM original_song_projects WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}

// ─── POST /create — New original song ─────────────────────────────────────────

router.post('/create', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const {
      title,
      genre = 'Pop',
      mood = 'Energético',
      language = 'es',
      isInstrumental = false,
      creativeStory,
      originalVerse,
      customLyrics,
      declarationSigned, // boolean — front-end checkbox
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!declarationSigned) return res.status(400).json({ error: 'Artist must sign the authorship declaration' });
    if (!originalVerse && !creativeStory) {
      return res.status(400).json({ error: 'At least a creative story or original verse is required' });
    }

    const now = new Date();

    // 1. Create project record
    const projectId = `osp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await sql(
      `INSERT INTO original_song_projects
         (id, user_id, title, genre, mood, language, is_instrumental,
          creative_story, original_verse, custom_lyrics, declaration_signed_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'generating')`,
      [projectId, userId, title, genre, mood, language, isInstrumental,
        creativeStory || null, originalVerse || null, customLyrics || null, now]
    );

    // Return immediately — processing is async
    res.json({ ok: true, projectId, status: 'generating' });

    // 2. Generate music (background)
    setImmediate(async () => {
      try {
        log(`[MusicOriginal] Generating song for project ${projectId}`, 'music-original');

        const genResult = await generateOriginalSong({
          title, genre, mood, language, isInstrumental,
          customLyrics: customLyrics || undefined,
          originalVerse: originalVerse || undefined,
        });

        if (!genResult.success || !genResult.audioUrl) {
          await updateProject(projectId, { status: 'failed', errorMessage: genResult.error || 'Generation failed' });
          return;
        }

        await updateProject(projectId, {
          audioUrl: genResult.audioUrl,
          generationModel: genResult.modelUsed,
          status: 'separating',
        });

        // 3. Separate stems
        log(`[MusicOriginal] Separating stems for ${projectId}`, 'music-original');
        let stemsResult: any = null;
        try {
          stemsResult = await separateStems(genResult.audioUrl);
        } catch (e: any) {
          log(`[MusicOriginal] Stem separation failed: ${e.message}`, 'music-original');
        }

        const stemsAt = stemsResult ? new Date() : null;
        await updateProject(projectId, {
          stemsVocalsUrl: stemsResult?.stems?.find((s: any) => s.type === 'vocals')?.audioUrl || null,
          stemsDrumsUrl: stemsResult?.stems?.find((s: any) => s.type === 'drums')?.audioUrl || null,
          stemsBassUrl: stemsResult?.stems?.find((s: any) => s.type === 'bass')?.audioUrl || null,
          stemsOtherUrl: stemsResult?.stems?.find((s: any) => s.type === 'other')?.audioUrl || null,
          stemsSeparatedAt: stemsAt,
          status: 'certifying',
        });

        // 4. Hash evidence packet
        const hashAt = new Date();
        const packet = {
          projectId,
          userId,
          title,
          genre,
          mood,
          language,
          isInstrumental,
          creativeStory: creativeStory || null,
          originalVerse: originalVerse || null,
          audioUrl: genResult.audioUrl,
          generationModel: genResult.modelUsed,
          platform: 'Boostify Music — Original Song Pipeline',
          declarationSignedAt: now.toISOString(),
          hashGeneratedAt: hashAt.toISOString(),
        };
        const docHash = hashEvidencePacket(packet);

        await updateProject(projectId, {
          documentHash: docHash,
          certifiedAt: hashAt,
          status: 'complete',
        });

        // 5. Send certificate email
        const [userRow] = await db.select({ email: users.email, artistName: users.artistName, firstName: users.firstName })
          .from(users).where(eq(users.id, userId));

        if (userRow?.email) {
          const collaboratorRows = await sql(
            `SELECT * FROM song_collaborators WHERE song_project_id = $1`, [projectId]
          );
          await sendCopyrightCertificate({
            artistName: userRow.artistName || userRow.firstName || 'Artista',
            artistEmail: userRow.email,
            songTitle: title,
            genre,
            language,
            isInstrumental,
            creativeStory,
            originalVerse,
            declarationSignedAt: now,
            generationCompletedAt: hashAt,
            stemsSeparatedAt: stemsAt || undefined,
            hashGeneratedAt: hashAt,
            certifiedAt: hashAt,
            projectId,
            documentHash: docHash,
            collaborators: collaboratorRows.map((c: any) => ({
              name: c.musician_name,
              instrument: c.instrument,
              role: c.role,
              agreementType: c.agreement_type,
              agreementSignedAt: c.agreement_signed_at ? new Date(c.agreement_signed_at) : undefined,
              deliveredAt: c.delivered_at ? new Date(c.delivered_at) : undefined,
            })),
          });
        }

        log(`[MusicOriginal] Pipeline complete for ${projectId}`, 'music-original');

        // Emit platform event for song certification (auto-promotes to IG + notifies followers)
        try {
          const { emitPlatformEvent } = await import('../services/platform-events-service');
          await emitPlatformEvent('song_certified', {
            actorUserId: userId,
            songTitle: title,
            artistName: userRow?.artistName || userRow?.firstName || 'Artista',
            imageUrl: null,
          }, true);
        } catch (_) { /* fire-and-forget */ }
      } catch (err: any) {
        log(`[MusicOriginal] Pipeline error: ${err.message}`, 'music-original');
        await updateProject(projectId, { status: 'failed', errorMessage: err.message });
      }
    });

  } catch (err: any) {
    console.error('[MusicOriginal] /create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /certify-existing — Certify a song already in the artist profile ───

router.post('/certify-existing', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const {
      existingSongId,
      creativeStory,
      originalVerse,
      declarationSigned,
    } = req.body;

    if (!existingSongId) return res.status(400).json({ error: 'existingSongId required' });
    if (!declarationSigned) return res.status(400).json({ error: 'Artist must sign the authorship declaration' });

    // Verify the song belongs to the user
    const [song] = await db.select().from(songs)
      .where(and(eq(songs.id, Number(existingSongId)), eq(songs.userId, userId)));

    if (!song) return res.status(404).json({ error: 'Song not found or not owned by this artist' });

    const now = new Date();
    const projectId = `osp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    await sql(
      `INSERT INTO original_song_projects
         (id, user_id, existing_song_id, title, genre, mood, language, is_instrumental,
          creative_story, original_verse, audio_url, declaration_signed_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'separating')`,
      [projectId, userId, song.id, song.title, song.genre || 'Pop', song.mood || '', 'es',
        false, creativeStory || null, originalVerse || null, song.audioUrl, now]
    );

    res.json({ ok: true, projectId, status: 'separating' });

    // Background processing
    setImmediate(async () => {
      try {
        log(`[MusicOriginal] Certifying existing song ${song.id} → project ${projectId}`, 'music-original');

        // Stem separation
        let stemsResult: any = null;
        try {
          stemsResult = await separateStems(song.audioUrl);
        } catch (e: any) {
          log(`[MusicOriginal] Stem separation failed: ${e.message}`, 'music-original');
        }

        const stemsAt = stemsResult ? new Date() : null;
        await updateProject(projectId, {
          stemsVocalsUrl: stemsResult?.stems?.find((s: any) => s.type === 'vocals')?.audioUrl || null,
          stemsDrumsUrl: stemsResult?.stems?.find((s: any) => s.type === 'drums')?.audioUrl || null,
          stemsBassUrl: stemsResult?.stems?.find((s: any) => s.type === 'bass')?.audioUrl || null,
          stemsOtherUrl: stemsResult?.stems?.find((s: any) => s.type === 'other')?.audioUrl || null,
          stemsSeparatedAt: stemsAt,
          status: 'certifying',
        });

        // Hash
        const hashAt = new Date();
        const packet = {
          projectId,
          userId,
          existingSongId: song.id,
          title: song.title,
          genre: song.genre,
          mood: song.mood,
          audioUrl: song.audioUrl,
          firestoreId: song.firestoreId || null,
          creativeStory: creativeStory || null,
          originalVerse: originalVerse || null,
          platform: 'Boostify Music — Existing Song Certification',
          declarationSignedAt: now.toISOString(),
          hashGeneratedAt: hashAt.toISOString(),
        };
        const docHash = hashEvidencePacket(packet);

        await updateProject(projectId, {
          documentHash: docHash,
          certifiedAt: hashAt,
          status: 'complete',
        });

        // Send certificate
        const [userRow] = await db.select({ email: users.email, artistName: users.artistName, firstName: users.firstName })
          .from(users).where(eq(users.id, userId));

        if (userRow?.email) {
          const collaboratorRows = await sql(`SELECT * FROM song_collaborators WHERE song_project_id = $1`, [projectId]);
          await sendCopyrightCertificate({
            artistName: userRow.artistName || userRow.firstName || 'Artista',
            artistEmail: userRow.email,
            songTitle: song.title,
            genre: song.genre || 'Pop',
            language: 'es',
            isInstrumental: false,
            creativeStory,
            originalVerse,
            declarationSignedAt: now,
            stemsSeparatedAt: stemsAt || undefined,
            hashGeneratedAt: hashAt,
            certifiedAt: hashAt,
            projectId,
            documentHash: docHash,
            collaborators: collaboratorRows.map((c: any) => ({
              name: c.musician_name,
              instrument: c.instrument,
              role: c.role,
              agreementType: c.agreement_type,
              agreementSignedAt: c.agreement_signed_at ? new Date(c.agreement_signed_at) : undefined,
              deliveredAt: c.delivered_at ? new Date(c.delivered_at) : undefined,
            })),
          });
        }

        log(`[MusicOriginal] Existing song certification complete: ${projectId}`, 'music-original');

        // Emit platform event for certification
        try {
          const { emitPlatformEvent } = await import('../services/platform-events-service');
          await emitPlatformEvent('song_certified', {
            actorUserId: userId,
            songTitle: song.title,
            artistName: userRow?.artistName || userRow?.firstName || 'Artista',
            imageUrl: null,
          }, true);
        } catch (_) { /* fire-and-forget */ }
      } catch (err: any) {
        log(`[MusicOriginal] Certification error: ${err.message}`, 'music-original');
        await updateProject(projectId, { status: 'failed', errorMessage: err.message });
      }
    });

  } catch (err: any) {
    console.error('[MusicOriginal] /certify-existing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /songs — Artist's uploaded songs for the dropdown ───────────────────

router.get('/songs', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const artistSongs = await db.select({
      id: songs.id,
      title: songs.title,
      genre: songs.genre,
      mood: songs.mood,
      audioUrl: songs.audioUrl,
      coverArt: songs.coverArt,
      lyrics: songs.lyrics,
      createdAt: songs.createdAt,
    }).from(songs)
      .where(eq(songs.userId, userId))
      .orderBy(desc(songs.createdAt))
      .limit(50);

    res.json({ songs: artistSongs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /my — List user's original song projects ─────────────────────────────

router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const rows = await sql(
      `SELECT * FROM original_song_projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    res.json({ projects: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:id — Single project status (used for polling) ─────────────────────

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const project = await getProjectById(req.params.id, userId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Fetch collaborators
    const collabs = await sql(
      `SELECT * FROM song_collaborators WHERE song_project_id = $1`, [project.id]
    );

    res.json({ project, collaborators: collabs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
