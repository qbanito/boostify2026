import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const router = Router();

// Schema de validación para importación de artistas
const importArtistSchema = z.object({
  artistName: z.string().min(1, "Nombre artístico requerido"),
  email: z.string().email("Email inválido"),
  realName: z.string().optional(),
  biography: z.string().optional(),
  profileImage: z.string().url().optional().or(z.literal('')),
  coverImage: z.string().url().optional().or(z.literal('')),
  country: z.string().optional(),
  location: z.string().optional(),
  genre: z.string().optional(),
  genres: z.array(z.string()).optional(),
  website: z.string().url().optional().or(z.literal('')),
  instagramHandle: z.string().optional(),
  twitterHandle: z.string().optional(),
  youtubeChannel: z.string().optional(),
  spotifyUrl: z.string().url().optional().or(z.literal('')),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  tiktokUrl: z.string().url().optional().or(z.literal('')),
  topYoutubeVideos: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    thumbnailUrl: z.string().url(),
    type: z.string()
  })).optional(),
  concerts: z.object({
    upcoming: z.array(z.object({
      tourName: z.string(),
      location: z.object({
        city: z.string(),
        country: z.string(),
        venue: z.string()
      }),
      date: z.string(),
      status: z.string(),
      source: z.string()
    })).optional(),
    highlights: z.array(z.object({
      eventName: z.string(),
      year: z.number(),
      note: z.string()
    })).optional()
  }).optional()
});

type ImportArtist = z.infer<typeof importArtistSchema>;

// Generar slug único desde el nombre del artista
function generateSlug(artistName: string): string {
  return artistName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-'); // Múltiples guiones a uno solo
}

// Endpoint para validar archivo antes de importar (preview)
router.post('/validate', async (req, res) => {
  try {
    const { data, fileType } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No se proporcionaron datos' });
    }

    let artists: any[] = [];

    // Procesar según el tipo de archivo
    if (fileType === 'json') {
      artists = Array.isArray(data) ? data : [data];
    } else if (fileType === 'excel') {
      // data viene como base64 desde el frontend
      const buffer = Buffer.from(data, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      artists = XLSX.utils.sheet_to_json(worksheet);
      
      // Procesar campos especiales de Excel
      artists = artists.map((artist: any) => {
        // Convertir genres de string a array si es necesario
        if (artist.genres && typeof artist.genres === 'string') {
          artist.genres = artist.genres.split(',').map((g: string) => g.trim());
        }
        
        // Intentar parsear campos JSON si vienen como string
        if (artist.topYoutubeVideos && typeof artist.topYoutubeVideos === 'string') {
          try {
            artist.topYoutubeVideos = JSON.parse(artist.topYoutubeVideos);
          } catch (e) {
            artist.topYoutubeVideos = undefined;
          }
        }
        
        if (artist.concerts && typeof artist.concerts === 'string') {
          try {
            artist.concerts = JSON.parse(artist.concerts);
          } catch (e) {
            artist.concerts = undefined;
          }
        }
        
        return artist;
      });
    }

    // Validar cada artista
    const validationResults = await Promise.all(
      artists.map(async (artist, index) => {
        try {
          // Validar con Zod
          const validated = importArtistSchema.parse(artist);
          
          // Verificar si el email ya existe
          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, validated.email)
          });
          
          return {
            index,
            valid: true,
            data: validated,
            warnings: existingUser ? ['Email ya existe en la base de datos'] : [],
            errors: []
          };
        } catch (error: any) {
          return {
            index,
            valid: false,
            data: artist,
            warnings: [],
            errors: error.errors ? error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`) : [error.message]
          };
        }
      })
    );

    const validCount = validationResults.filter(r => r.valid).length;
    const invalidCount = validationResults.filter(r => !r.valid).length;
    const duplicateCount = validationResults.filter(r => r.warnings.length > 0).length;

    res.json({
      success: true,
      summary: {
        total: artists.length,
        valid: validCount,
        invalid: invalidCount,
        duplicates: duplicateCount
      },
      results: validationResults
    });
  } catch (error: any) {
    console.error('Error validating import:', error);
    res.status(500).json({ 
      error: 'Error al validar el archivo',
      details: error.message 
    });
  }
});

// Endpoint para importar artistas (después de validación)
router.post('/import', async (req, res) => {
  try {
    const { artists, skipDuplicates = true } = req.body;
    
    if (!Array.isArray(artists) || artists.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron artistas válidos' });
    }

    const results = {
      imported: [] as any[],
      skipped: [] as any[],
      errors: [] as any[]
    };

    for (const artist of artists) {
      try {
        // Validar datos
        const validated = importArtistSchema.parse(artist);
        
        // Verificar duplicados
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, validated.email)
        });
        
        if (existingUser) {
          if (skipDuplicates) {
            results.skipped.push({
              email: validated.email,
              reason: 'Email ya existe'
            });
            continue;
          } else {
            // Actualizar artista existente
            const slug = generateSlug(validated.artistName);
            await db.update(users)
              .set({
                artistName: validated.artistName,
                realName: validated.realName,
                biography: validated.biography,
                profileImage: validated.profileImage,
                coverImage: validated.coverImage,
                country: validated.country,
                location: validated.location,
                genre: validated.genre,
                genres: validated.genres,
                website: validated.website,
                instagramHandle: validated.instagramHandle,
                twitterHandle: validated.twitterHandle,
                youtubeChannel: validated.youtubeChannel,
                spotifyUrl: validated.spotifyUrl,
                facebookUrl: validated.facebookUrl,
                tiktokUrl: validated.tiktokUrl,
                topYoutubeVideos: validated.topYoutubeVideos as any,
                concerts: validated.concerts as any,
                slug: slug
              })
              .where(eq(users.id, existingUser.id));
              
            results.imported.push({
              email: validated.email,
              action: 'updated'
            });
            continue;
          }
        }
        
        // Generar slug único
        let slug = generateSlug(validated.artistName);
        let slugCounter = 1;
        
        // Verificar unicidad del slug
        while (true) {
          const existingSlug = await db.query.users.findFirst({
            where: eq(users.slug, slug)
          });
          
          if (!existingSlug) break;
          
          slug = `${generateSlug(validated.artistName)}-${slugCounter}`;
          slugCounter++;
        }
        
        // Insertar nuevo artista
        const [newUser] = await db.insert(users).values({
          artistName: validated.artistName,
          email: validated.email,
          realName: validated.realName,
          biography: validated.biography,
          profileImage: validated.profileImage,
          coverImage: validated.coverImage,
          country: validated.country,
          location: validated.location,
          genre: validated.genre,
          genres: validated.genres,
          website: validated.website,
          instagramHandle: validated.instagramHandle,
          twitterHandle: validated.twitterHandle,
          youtubeChannel: validated.youtubeChannel,
          spotifyUrl: validated.spotifyUrl,
          facebookUrl: validated.facebookUrl,
          tiktokUrl: validated.tiktokUrl,
          topYoutubeVideos: validated.topYoutubeVideos as any,
          concerts: validated.concerts as any,
          slug: slug,
          role: 'artist'
        }).returning();
        
        results.imported.push({
          email: validated.email,
          artistName: validated.artistName,
          id: newUser.id,
          action: 'created'
        });
        
      } catch (error: any) {
        results.errors.push({
          artist: artist.artistName || artist.email,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: artists.length,
        imported: results.imported.length,
        skipped: results.skipped.length,
        errors: results.errors.length
      },
      results
    });
    
  } catch (error: any) {
    console.error('Error importing artists:', error);
    res.status(500).json({ 
      error: 'Error al importar artistas',
      details: error.message 
    });
  }
});

export default router;
