/**
 * Rutas para gestión de perfiles de artista generados automáticamente desde videos musicales
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, artistProfileImages, musicVideoProjects } from '../../db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Configurar OpenAI para generar biografías
const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Genera biografía de artista usando Gemini basándose en el concepto del video
 */
async function generateArtistBiography(
  artistName: string,
  concept: any,
  lyrics: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `${artistName} is an innovative artist creating unique visual and musical experiences.`;
  }

  const prompt = `Create a compelling artist biography for "${artistName}" based on their music video concept and lyrics.

MUSIC VIDEO CONCEPT:
${JSON.stringify(concept, null, 2)}

LYRICS SAMPLE:
${lyrics.substring(0, 500)}

Generate a professional artist biography (2-3 paragraphs) that:
- Captures the artist's unique style and vision
- References the visual and musical themes from their work
- Sounds authentic and engaging
- Is written in third person

Return ONLY the biography text, no JSON, no markdown.`;

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      top_p: 0.9,
      max_tokens: 500,
    });

    const biography = response.choices?.[0]?.message?.content?.trim();
    
    if (biography && biography.length > 50) {
      return biography;
    }
  } catch (error) {
    console.error('Error generating biography with OpenAI:', error);
  }

  return `${artistName} is an innovative artist known for their unique blend of visual storytelling and musical artistry. Their work combines cinematic visuals with compelling narratives, creating immersive experiences that resonate with audiences worldwide.`;
}

/**
 * Genera un slug único para el artista
 */
function generateSlug(artistName: string): string {
  return artistName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * POST /api/artist-profiles/create-from-video
 * Crea automáticamente un perfil de artista desde un proyecto de video musical
 */
const createProfileSchema = z.object({
  projectId: z.number(),
  userEmail: z.string().email(),
  creatorUserId: z.number().optional(),
  existingArtistId: z.number().optional(), // ID del artista existente (para no crear duplicados)
  artistName: z.string().min(1),
  songName: z.string().optional(),
  selectedConcept: z.any().optional(),
  lyrics: z.string().optional(),
  referenceImages: z.array(z.string()).default([]),
  conceptImages: z.array(z.object({
    url: z.string(),
    type: z.string(),
    description: z.string().optional()
  })).default([])
});

router.post("/create-from-video", async (req: Request, res: Response) => {
  try {
    console.log('🎨 [CREATE ARTIST PROFILE] Creando perfil desde video...');
    const data = createProfileSchema.parse(req.body);

    // Verificar si ya existe un perfil para este proyecto
    const [existingProject] = await db
      .select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.id, data.projectId))
      .limit(1);

    if (existingProject?.artistProfileId) {
      console.log('✅ [CREATE ARTIST PROFILE] Perfil ya existe por proyecto:', existingProject.artistProfileId);
      const [existingProfile] = await db
        .select()
        .from(users)
        .where(eq(users.id, existingProject.artistProfileId))
        .limit(1);
      
      return res.json({ 
        success: true, 
        profile: existingProfile,
        isNew: false 
      });
    }

    // 🔍 CHECK 1: Si se proporcionó un existingArtistId, usar ese artista directamente
    if (data.existingArtistId) {
      console.log('🔗 [CREATE ARTIST PROFILE] Usando artista existente ID:', data.existingArtistId);
      const [existingArtist] = await db
        .select()
        .from(users)
        .where(eq(users.id, data.existingArtistId))
        .limit(1);
      
      if (existingArtist) {
        // Vincular proyecto con el artista existente
        await db
          .update(musicVideoProjects)
          .set({ artistProfileId: existingArtist.id })
          .where(eq(musicVideoProjects.id, data.projectId));
        
        console.log('✅ [CREATE ARTIST PROFILE] Proyecto vinculado a artista existente:', existingArtist.artistName);
        return res.json({
          success: true,
          profile: existingArtist,
          isNew: false
        });
      }
    }

    // 🔍 CHECK 2: Buscar artista existente por nombre + creador (para evitar duplicados)
    if (data.creatorUserId) {
      const { or } = await import('drizzle-orm');
      
      // Buscar artista con mismo nombre que pertenezca al usuario
      const existingByName = await db
        .select()
        .from(users)
        .where(
          or(
            // Artista generado por IA con mismo nombre
            and(
              eq(users.artistName, data.artistName),
              eq(users.generatedBy, data.creatorUserId)
            ),
            // El propio usuario con mismo nombre de artista
            and(
              eq(users.id, data.creatorUserId),
              eq(users.artistName, data.artistName)
            )
          )
        )
        .limit(1);
      
      if (existingByName.length > 0) {
        const existingArtist = existingByName[0];
        console.log('🔗 [CREATE ARTIST PROFILE] Artista existente encontrado por nombre:', existingArtist.artistName, 'ID:', existingArtist.id);
        
        // Vincular proyecto con el artista existente
        await db
          .update(musicVideoProjects)
          .set({ artistProfileId: existingArtist.id })
          .where(eq(musicVideoProjects.id, data.projectId));
        
        return res.json({
          success: true,
          profile: existingArtist,
          isNew: false
        });
      }
    }

    // Si no existe, crear uno nuevo
    console.log('🆕 [CREATE ARTIST PROFILE] No se encontró artista existente, creando nuevo...');

    // Generar slug único
    let slug = generateSlug(data.artistName);
    let slugCounter = 1;
    while (true) {
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.slug, slug))
        .limit(1);
      
      if (!existing) break;
      slug = `${generateSlug(data.artistName)}-${slugCounter}`;
      slugCounter++;
    }

    // Generar biografía con OpenAI
    console.log('✍️ [CREATE ARTIST PROFILE] Generando biografía con OpenAI...');
    const biography = await generateArtistBiography(
      data.artistName,
      data.selectedConcept,
      data.lyrics || ''
    );

    // Seleccionar imágenes para el perfil
    const profileImage = data.referenceImages[0] || data.conceptImages[0]?.url || '';
    const coverImage = data.conceptImages[0]?.url || data.referenceImages[0] || '';

    // Crear perfil de artista AI-generado
    console.log('👤 [CREATE ARTIST PROFILE] Creando perfil en base de datos...');
    const newProfiles = await db
      .insert(users)
      .values({
        artistName: data.artistName,
        slug,
        biography,
        profileImage,
        coverImage,
        isAIGenerated: true,
        generatedBy: data.creatorUserId || null,
        role: 'artist',
        email: `${slug}@boostify-ai-generated.com`,
        username: slug,
        genres: data.selectedConcept?.mood ? [data.selectedConcept.mood] : []
      })
      .returning();

    const newProfile = newProfiles[0];
    console.log('✅ [CREATE ARTIST PROFILE] Perfil creado:', newProfile.id);

    // Vincular proyecto con el perfil
    await db
      .update(musicVideoProjects)
      .set({ artistProfileId: newProfile.id })
      .where(eq(musicVideoProjects.id, data.projectId));

    // Guardar imágenes de referencia en la galería
    if (data.referenceImages.length > 0) {
      console.log(`📸 [CREATE ARTIST PROFILE] Guardando ${data.referenceImages.length} imágenes de referencia...`);
      const referenceImageRecords = data.referenceImages.map((url, index) => ({
        artistProfileId: newProfile.id,
        musicVideoProjectId: data.projectId,
        imageUrl: url,
        imageType: 'reference' as const,
        title: `Reference Image ${index + 1}`,
        isPublic: true,
        displayOrder: index
      }));

      await db.insert(artistProfileImages).values(referenceImageRecords);
    }

    // Guardar imágenes de conceptos en la galería
    if (data.conceptImages.length > 0) {
      console.log(`🎨 [CREATE ARTIST PROFILE] Guardando ${data.conceptImages.length} imágenes de conceptos...`);
      const conceptImageRecords = data.conceptImages.map((img, index) => ({
        artistProfileId: newProfile.id,
        musicVideoProjectId: data.projectId,
        imageUrl: img.url,
        imageType: 'concept' as const,
        title: img.description || `Concept Image ${index + 1}`,
        description: img.description,
        isPublic: true,
        displayOrder: data.referenceImages.length + index
      }));

      await db.insert(artistProfileImages).values(conceptImageRecords);
    }

    console.log('✅ [CREATE ARTIST PROFILE] Perfil completo creado con éxito');

    res.json({
      success: true,
      profile: newProfile,
      isNew: true,
      imagesStored: data.referenceImages.length + data.conceptImages.length
    });

  } catch (error) {
    console.error('❌ [CREATE ARTIST PROFILE] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/artist-profiles/add-scene-images
 * Agrega imágenes de escenas generadas a la galería del perfil
 */
const addSceneImagesSchema = z.object({
  artistProfileId: z.number(),
  projectId: z.number(),
  sceneImages: z.array(z.object({
    url: z.string(),
    sceneNumber: z.number(),
    shotType: z.string().optional(),
    mood: z.string().optional(),
    timestamp: z.number().optional(),
    description: z.string().optional()
  }))
});

router.post("/add-scene-images", async (req: Request, res: Response) => {
  try {
    console.log('📸 [ADD SCENE IMAGES] Agregando imágenes de escenas...');
    const data = addSceneImagesSchema.parse(req.body);

    // Obtener el orden actual más alto
    const existingImages = await db
      .select()
      .from(artistProfileImages)
      .where(eq(artistProfileImages.artistProfileId, data.artistProfileId));

    const maxOrder = existingImages.reduce((max, img) => 
      Math.max(max, img.displayOrder), 0
    );

    // Crear registros de imágenes de escenas
    const sceneImageRecords = data.sceneImages.map((img, index) => ({
      artistProfileId: data.artistProfileId,
      musicVideoProjectId: data.projectId,
      imageUrl: img.url,
      imageType: 'scene' as const,
      title: `Scene ${img.sceneNumber}`,
      description: img.description || `Scene ${img.sceneNumber} - ${img.shotType || 'Generated'}`,
      sceneMetadata: {
        sceneNumber: img.sceneNumber,
        shotType: img.shotType,
        mood: img.mood,
        timestamp: img.timestamp
      },
      isPublic: true,
      displayOrder: maxOrder + index + 1
    }));

    await db.insert(artistProfileImages).values(sceneImageRecords);

    console.log(`✅ [ADD SCENE IMAGES] ${sceneImageRecords.length} imágenes agregadas`);

    res.json({
      success: true,
      imagesAdded: sceneImageRecords.length
    });

  } catch (error) {
    console.error('❌ [ADD SCENE IMAGES] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/artist-profiles/:profileId/gallery
 * Obtiene todas las imágenes de la galería de un perfil
 */
router.get("/:profileId/gallery", async (req: Request, res: Response) => {
  try {
    const profileId = parseInt(req.params.profileId);
    
    const gallery = await db
      .select()
      .from(artistProfileImages)
      .where(eq(artistProfileImages.artistProfileId, profileId))
      .orderBy(artistProfileImages.displayOrder);

    res.json({
      success: true,
      gallery
    });

  } catch (error) {
    console.error('❌ [GET GALLERY] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/artist-profiles/fix-generated-by
 * Actualiza el campo generatedBy para artistas AI del usuario que tienen generatedBy null
 */
const fixGeneratedBySchema = z.object({
  userId: z.number(),
  userEmail: z.string().email()
});

router.post("/fix-generated-by", async (req: Request, res: Response) => {
  try {
    console.log('🔧 [FIX GENERATED BY] Actualizando artistas AI del usuario...');
    const { userId, userEmail } = fixGeneratedBySchema.parse(req.body);

    // Obtener todos los proyectos del usuario
    const userProjects = await db
      .select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.userEmail, userEmail));

    if (userProjects.length === 0) {
      return res.json({
        success: true,
        updated: 0,
        message: 'No se encontraron proyectos para este usuario'
      });
    }

    // Obtener todos los artistProfileId de los proyectos
    const profileIds = userProjects
      .map(p => p.artistProfileId)
      .filter(id => id !== null) as number[];

    if (profileIds.length === 0) {
      return res.json({
        success: true,
        updated: 0,
        message: 'No se encontraron perfiles de artista vinculados a los proyectos'
      });
    }

    // Actualizar solo los perfiles AI que tienen generatedBy null
    const result = await db
      .update(users)
      .set({ generatedBy: userId })
      .where(
        and(
          inArray(users.id, profileIds),
          eq(users.isAIGenerated, true),
          isNull(users.generatedBy)
        )
      );

    console.log(`✅ [FIX GENERATED BY] Perfiles actualizados correctamente`);

    res.json({
      success: true,
      updated: profileIds.length,
      message: `Se actualizaron ${profileIds.length} perfiles de artista AI`
    });

  } catch (error) {
    console.error('❌ [FIX GENERATED BY] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
