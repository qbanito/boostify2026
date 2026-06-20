/**
 * Fashion Studio API Routes
 * 
 * Endpoints para Artist Fashion Studio:
 * - Sessions management
 * - Fashion analysis con OpenAI Vision
 * - Results storage
 * - Portfolio management
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { db as firestoreDb } from '../firebase';
import { 
  fashionSessions, 
  fashionResults,
  fashionAnalysis,
  fashionPortfolio,
  productTryOnHistory,
  fashionVideos,
  merchandise,
  users
} from '../../db/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import * as fal from '@fal-ai/serverless-client';
import { generateImageWithNanoBanana } from '../services/fal-service';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

// Configurar FAL
fal.config({
  credentials: process.env.FAL_KEY || process.env.FAL_API_KEY
});

// ─── Auth helper — resolves Clerk/Firebase string ID to PG integer ───
async function getUserPgId(req: Request): Promise<number | null> {
  const clerkId = (req as any).auth?.userId;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  const rawId = (req as any).user?.id;
  if (!rawId) return null;
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id || null;
}

// ============================================
// FASHION SESSIONS
// ============================================

// Crear sesión de moda
router.post('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado o usuario no encontrado en DB' });
    }

    const { sessionType, metadata } = req.body;

    console.log('📝 Creating session - Body:', req.body);

    if (!sessionType) {
      return res.status(400).json({ error: 'sessionType is required' });
    }

    const validSessionTypes = ['tryon', 'generation', 'analysis', 'video', 'portfolio'];
    if (!validSessionTypes.includes(sessionType)) {
      return res.status(400).json({ 
        error: `Invalid sessionType: ${sessionType}. Must be one of: ${validSessionTypes.join(', ')}` 
      });
    }

    const [session] = await db.insert(fashionSessions).values({
      userId,
      sessionType,
      metadata,
      status: 'active'
    }).returning();

    console.log('✅ Session created:', session);

    res.json({ success: true, session });
  } catch (error: any) {
    console.error('❌ Error creando sesión:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener sesiones del usuario
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const sessions = await db
      .select()
      .from(fashionSessions)
      .where(eq(fashionSessions.userId, userId))
      .orderBy(desc(fashionSessions.createdAt))
      .limit(20);

    res.json({ success: true, sessions });
  } catch (error: any) {
    console.error('Error obteniendo sesiones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener resultados de generación (looks generados por el usuario)
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
    const results = await db
      .select()
      .from(fashionResults)
      .where(eq(fashionResults.userId, userId))
      .orderBy(desc(fashionResults.createdAt))
      .limit(limit);

    res.json({ success: true, results });
  } catch (error: any) {
    console.error('Error obteniendo resultados de fashion:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FAL VIRTUAL TRY-ON
// ============================================

router.post('/tryon', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { modelImageUrl, clothingImageUrl, modelImage: _mi, clothingImage: _ci, sessionId, merchandiseId, artistId: tryonArtistId, artistName: tryonArtistName } = req.body;
    const finalModelImage = modelImageUrl || _mi;
    const finalClothingImage = clothingImageUrl || _ci;

    console.log('🎨 Iniciando Virtual Try-On con FAL...');
    console.log('📸 Model Image URL:', finalModelImage?.substring(0, 100) + '...');
    console.log('👕 Clothing Image URL:', finalClothingImage?.substring(0, 100) + '...');

    const result: any = await fal.subscribe("fal-ai/idm-vton", {
      input: {
        human_image_url: finalModelImage,
        garment_image_url: finalClothingImage,
        category: 'tops',
        auto_mask: true,
        auto_crop: true,
      },
      logs: true,
    });

    console.log('✅ FAL Try-On result:', { 
      hasImage: !!result.image, 
      hasUrl: !!result.image?.url,
      imageUrl: result.image?.url?.substring(0, 100)
    });

    if (result.image && result.image.url) {
      // Guardar resultado en DB
      const [fashionResult] = await db.insert(fashionResults).values({
        sessionId: sessionId || null,
        userId,
        resultType: 'tryon',
        imageUrl: result.image.url,
        metadata: {
          modelImage: finalModelImage,
          clothingImage: finalClothingImage,
          falModel: 'fal-ai/idm-vton'
        }
      }).returning();

      // Si está asociado a un producto, guardar en historial
      if (merchandiseId) {
        await db.insert(productTryOnHistory).values({
          userId,
          merchandiseId,
          modelImage: finalModelImage,
          resultImage: result.image.url,
          falModel: 'fal-ai/idm-vton'
        });
      }

      // Save to Firestore image_galleries so it appears in artist profile gallery
      try {
        if (firestoreDb) {
          const fsUserId = tryonArtistId ? String(tryonArtistId) : String(userId);
          await firestoreDb.collection('image_galleries').add({
            userId: fsUserId,
            singleName: `Virtual Try-On — ${tryonArtistName || 'Artist'}`,
            artistName: tryonArtistName || 'Artist',
            basePrompt: 'virtual-tryon',
            styleInstructions: 'IDM-VTON Virtual Try-On',
            referenceImageUrls: [finalModelImage, finalClothingImage].filter(Boolean),
            generatedImages: [{
              id: `tryon-${Date.now()}`,
              url: result.image.url,
              prompt: 'Virtual Try-On',
              createdAt: new Date().toISOString(),
              isVideo: false,
            }],
            source: 'fashion-studio-tryon',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false,
          });
          console.log('✅ Try-on saved to Firestore image_galleries');
        }
      } catch (fsErr) {
        console.warn('⚠️ Could not save try-on to Firestore:', fsErr);
      }

      res.json({
        success: true,
        resultImageUrl: result.image.url,
        imageUrl: result.image.url,
        resultId: fashionResult.id
      });
    } else {
      console.error('❌ No image generated in result:', result);
      res.status(500).json({ error: 'No se generó imagen' });
    }

  } catch (error: any) {
    console.error('❌ ERROR COMPLETO en try-on:');
    console.error('Message:', error.message);
    console.error('Status:', error.status || error.statusCode);
    console.error('Response:', error.response?.data || error.data);
    console.error('Full error:', JSON.stringify(error, null, 2));
    
    res.status(500).json({ 
      error: error.message || 'Error en try-on',
      details: error.response?.data || error.data
    });
  }
});

// ============================================
// FASHION VIDEO CON KLING
// ============================================

router.post('/generate-video', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { imageUrl, prompt, sessionId, duration = 5, aspectRatio = '16:9' } = req.body;

    console.log('🎬 Generando video fashion con Kling...');

    // Crear registro de video en DB (estado: processing)
    const [video] = await db.insert(fashionVideos).values({
      userId,
      sessionId: sessionId || null,
      videoUrl: '', // Se actualizará cuando termine
      prompt,
      modelImage: imageUrl,
      duration,
      status: 'processing',
      metadata: {
        falModel: 'fal-ai/kling-video',
        aspectRatio
      }
    }).returning();

    // Generar video asíncronamente (Kling v3 Pro — máxima calidad)
    fal.subscribe("fal-ai/kling-video/v3/pro/image-to-video", {
      input: {
        image_url: imageUrl,
        prompt,
        duration,
        aspect_ratio: aspectRatio,
        cfg_scale: 0.5,
      },
      logs: true,
    }).then(async (result: any) => {
      const videoUrl = result.video?.url || result.video_url || null;
      const thumbUrl = result.video?.thumbnail_url || result.thumbnail_url || null;
      if (videoUrl) {
        // Actualizar registro con video completado
        await db.update(fashionVideos)
          .set({ videoUrl, thumbnailUrl: thumbUrl, status: 'completed' })
          .where(eq(fashionVideos.id, video.id));
        console.log('✅ Video completado:', video.id);
        // Save to Firestore 'videos' so it appears in artist profile
        try {
          const { artistId: fsArtistId, artistName: fsArtistName } = req.body;
          const artistUserId = userId; // PG integer userId
          const fsId = fsArtistId ? String(fsArtistId) : String(artistUserId);
          if (firestoreDb) {
            await firestoreDb.collection('videos').add({
              userId: String(artistUserId),
              artistId: fsId,
              videoUrl,
              thumbnailUrl: thumbUrl || '',
              title: `Fashion Video — ${fsArtistName || 'Artist'}`,
              description: prompt,
              source: 'fashion-studio',
              falModel: 'fal-ai/kling-video/v3/pro/image-to-video',
              createdAt: new Date(),
            });
            console.log('✅ Video saved to Firestore videos collection');
          }
        } catch (fsErr) {
          console.warn('⚠️ Could not save video to Firestore:', fsErr);
        }
      } else {
        await db.update(fashionVideos)
          .set({ status: 'failed' })
          .where(eq(fashionVideos.id, video.id));
      }
    }).catch(async (error) => {
      console.error('Error generando video:', error);
      await db.update(fashionVideos)
        .set({ status: 'failed' })
        .where(eq(fashionVideos.id, video.id));
    });

    // Responder inmediatamente con el ID del video
    res.json({
      success: true,
      videoId: video.id,
      status: 'processing',
      message: 'Video en proceso. Verifica el estado en unos minutos.'
    });

  } catch (error: any) {
    console.error('Error iniciando video:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar estado de video
router.get('/video-status/:videoId', authenticate, async (req: Request, res: Response) => {
  try {
    const { videoId } = req.params;

    const [video] = await db
      .select()
      .from(fashionVideos)
      .where(eq(fashionVideos.id, parseInt(videoId)));

    if (!video) {
      return res.status(404).json({ error: 'Video no encontrado' });
    }

    res.json({
      success: true,
      status: video.status,
      videoUrl: video.videoUrl || null,
      videoId: video.id,
      video,
    });

  } catch (error: any) {
    console.error('Error verificando video:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FASHION ANALYSIS CON OPENAI VISION
// ============================================

router.post('/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { imageUrl, prompt, genre, occasion, sessionId, artistName: analyzeArtistName, notes } = req.body;
    const analysisContext = notes || prompt || '';

    console.log('🎨 Analizando moda con OpenAI Vision...');

    // Usar OpenAI para análisis de moda
    const { createTrackedOpenAI } = require('../utils/tracked-openai');
    const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const fullPrompt = `Analyze this fashion image and provide detailed style recommendations.${analysisContext ? `\nContext: ${analysisContext}\n` : ''}
Artist: ${analyzeArtistName || 'N/A'}
Genre context: ${genre || 'N/A'}
Occasion: ${occasion || 'N/A'}

Respond in JSON format with:
{
  "styleScore": number (0-100),
  "colorPalette": array of hex colors,
  "bodyType": string,
  "genreCoherence": number (0-100),
  "suggestions": array of 4 strings with improvement suggestions,
  "moodBoard": {
    "keywords": array of style keywords,
    "artistReferences": array of artist style references,
    "trendReferences": array of current trend references
  },
  "detailedAnalysis": detailed text analysis
}`;

    const messages: any[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: fullPrompt },
          { 
            type: 'image_url', 
            image_url: { 
              url: imageUrl,
              detail: 'high'
            } 
          }
        ]
      }
    ];

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0]?.message?.content || '';

    // Intentar parsear JSON
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (e) {
      // Si no es JSON, crear estructura
      analysis = {
        styleScore: 75,
        colorPalette: ['#000000', '#FFFFFF', '#FF6B6B', '#4ECDC4', '#FFE66D'],
        bodyType: 'Unknown',
        genreCoherence: 70,
        suggestions: [
          responseText.substring(0, 200),
          'Consider adding more genre-specific elements',
          'Experiment with bold accessories',
          'Focus on color coordination'
        ],
        moodBoard: {
          keywords: genre ? [genre, 'modern', 'stylish'] : ['modern', 'stylish'],
          artistReferences: [],
          trendReferences: []
        },
        detailedAnalysis: responseText
      };
    }

    // Guardar análisis en DB
    const [analysisRecord] = await db.insert(fashionAnalysis).values({
      sessionId: sessionId || null,
      userId,
      analysisType: 'style',
      imageUrl,
      recommendations: {
        styleScore: analysis.styleScore,
        colorPalette: analysis.colorPalette,
        bodyType: analysis.bodyType,
        genreCoherence: analysis.genreCoherence,
        suggestions: analysis.suggestions
      },
      moodBoard: analysis.moodBoard,
      geminiResponse: responseText
    }).returning();

    res.json({
      success: true,
      analysis,
      analysisId: analysisRecord.id
    });

  } catch (error: any) {
    console.error('Error en análisis:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PORTFOLIO
// ============================================

// Crear item de portfolio
router.post('/portfolio', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { title, description, images, products, category, season, tags, isPublic } = req.body;

    const [portfolioItem] = await db.insert(fashionPortfolio).values({
      userId,
      title,
      description,
      images,
      products,
      category,
      season,
      tags,
      isPublic: isPublic || false
    }).returning();

    res.json({ success: true, portfolioItem });
  } catch (error: any) {
    console.error('Error creando portfolio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener portfolio del usuario
router.get('/portfolio', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const portfolio = await db
      .select()
      .from(fashionPortfolio)
      .where(eq(fashionPortfolio.userId, userId))
      .orderBy(desc(fashionPortfolio.createdAt));

    res.json({ success: true, portfolio });
  } catch (error: any) {
    console.error('Error obteniendo portfolio:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRODUCTOS DEL ARTISTA
// ============================================

// Obtener productos para try-on (del artista seleccionado o del usuario)
router.get('/products', authenticate, async (req: Request, res: Response) => {
  try {
    const pgUserId = await getUserPgId(req);
    if (!pgUserId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { artistId } = req.query;
    const rawUid = (req as any).user?.uid || (req as any).user?.id;

    console.log('🛍️ Fetching products - artistId:', artistId, 'pgUserId:', pgUserId);

    // Importar Firestore Admin
    const { db: firestoreDb } = await import('../firebase');
    
    if (!firestoreDb) {
      console.log('⚠️ Firestore not available, falling back to PostgreSQL');
      const targetUserId = artistId ? parseInt(artistId as string) : pgUserId;
      const products = await db
        .select()
        .from(merchandise)
        .where(and(
          eq(merchandise.userId, targetUserId),
          eq(merchandise.category, 'apparel')
        ))
        .orderBy(desc(merchandise.createdAt));
      
      return res.json({ success: true, products });
    }

    // Buscar productos en Firestore colección "merchandise"
    const targetFirestoreUserId = artistId || rawUid?.toString() || pgUserId.toString();
    console.log('🔍 Searching Firestore merchandise for userId:', targetFirestoreUserId);

    const merchandiseRef = firestoreDb.collection('merchandise');
    const merchandiseSnapshot = await merchandiseRef
      .where('userId', '==', targetFirestoreUserId)
      .where('category', '==', 'Apparel')
      .get();

    const products = merchandiseSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        userId: data.userId,
        sizes: data.sizes,
        // Mapear imageUrl de Firestore a images array esperado por el frontend
        images: data.imageUrl ? [data.imageUrl] : [],
        createdAt: data.createdAt
      };
    });

    console.log(`✅ Found ${products.length} apparel products in Firestore for userId: ${targetFirestoreUserId}`);

    res.json({ success: true, products });
  } catch (error: any) {
    console.error('❌ Error obteniendo productos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de try-on con productos
router.get('/tryon-history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const history = await db
      .select()
      .from(productTryOnHistory)
      .where(eq(productTryOnHistory.userId, userId))
      .orderBy(desc(productTryOnHistory.createdAt))
      .limit(50);

    res.json({ success: true, history });
  } catch (error: any) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI LOOK GENERATOR — Structured JSON → 4 Outfit Images
// ============================================

interface ArtistLookJSON {
  artistProfile: {
    name: string;
    genre: string;
    subgenres: string[];
    era: string;
    personality: string;
    presentedGender?: string;
    ethnicityNote?: string;
  };
  lookConcept: {
    theme: string;
    mood: string;
    occasion: string;
    season: string;
    colorPalette: string[];
    styleInfluences: string[];
    houseReference?: string;
  };
  outfitPieces: {
    top: { type: string; material: string; color: string; details: string };
    bottom: { type: string; material: string; color: string; details: string };
    footwear: { type: string; material: string; color: string; details: string };
    accessories: Array<{ type: string; description: string }>;
    hair: { style: string; color: string };
  };
  imagePrompts: string[];
}

// Step 1: Generate structured look JSON from artist data
router.post('/generate-look-json', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { artistName, biography, genre, subgenres, profileImageUrl, occasion, mood } = req.body;

    if (!artistName || !genre) {
      return res.status(400).json({ error: 'artistName and genre are required' });
    }

    console.log(`🎨 Generating structured look JSON for ${artistName} (${genre})`);

    const { createTrackedOpenAI } = require('../utils/tracked-openai');
    const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are an expert fashion stylist for music artists. 
You create detailed, genre-authentic outfit concepts that match an artist's musical identity, personality and brand.
Your designs are modern, edgy, and camera-ready for music videos, concerts, and photoshoots.
You MUST respond with a valid JSON object following the exact schema provided.`;

    const userPrompt = `Create a complete fashion look for this music artist:

ARTIST PROFILE:
- Name: ${artistName}
- Genre: ${genre}
- Sub-genres: ${(subgenres || []).join(', ') || 'N/A'}
- Biography: ${biography || 'Emerging artist'}
- Occasion: ${occasion || 'Music video / photoshoot'}
- Desired Mood: ${mood || 'Confident and authentic'}

Generate a JSON following this EXACT structure:
{
  "artistProfile": {
    "name": "artist name",
    "genre": "primary genre",
    "subgenres": ["sub1", "sub2"],
    "era": "contemporary/retro/futuristic",
    "personality": "brief personality description for styling"
  },
  "lookConcept": {
    "theme": "creative theme name for this look",
    "mood": "overall mood/vibe",
    "occasion": "concert/music_video/photoshoot/red_carpet",
    "season": "season or all-season",
    "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "styleInfluences": ["influence1", "influence2", "influence3"]
  },
  "outfitPieces": {
    "top": {
      "type": "specific garment type",
      "material": "fabric/material",
      "color": "color description",
      "details": "design details, prints, hardware, etc."
    },
    "bottom": {
      "type": "specific garment type",
      "material": "fabric/material",
      "color": "color description",
      "details": "design details"
    },
    "footwear": {
      "type": "specific shoe type",
      "material": "material",
      "color": "color",
      "details": "design details"
    },
    "accessories": [
      { "type": "accessory category", "description": "detailed description" },
      { "type": "accessory category", "description": "detailed description" }
    ],
    "hair": {
      "style": "hairstyle description",
      "color": "hair color"
    }
  },
  "imagePrompts": [
    "Full body editorial shot: [detailed prompt describing the artist wearing the complete outfit, studio lighting, fashion magazine quality]",
    "Upper body portrait: [detailed prompt focusing on top, accessories, facial expression, mood lighting]",
    "Dynamic action pose: [detailed prompt with movement, confidence, stage-ready energy]",
    "Street style candid: [detailed prompt, urban setting, natural lighting, lifestyle vibe]"
  ]
}

IMPORTANT RULES for imagePrompts:
- Each prompt must be 80-120 words for maximum detail
- Include specific clothing descriptions in every prompt
- Include lighting, camera angle, and mood
- Reference the genre aesthetic throughout
- Make prompts suitable for AI image generation (Nano Banana 2 model)
- Describe the person as "a ${genre} music artist" not by name`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // If profile image provided, add it for visual context
    if (profileImageUrl && (profileImageUrl.startsWith('http://') || profileImageUrl.startsWith('https://'))) {
      messages[1] = {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: profileImageUrl, detail: 'low' } }
        ]
      };
    }

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      max_tokens: 3000,
      temperature: 0.85,
      response_format: { type: 'json_object' }
    });

    const lookJSON: ArtistLookJSON = JSON.parse(response.choices[0]?.message?.content || '{}');

    console.log(`✅ Look JSON generated: ${lookJSON.lookConcept?.theme || 'Unknown theme'}`);

    res.json({
      success: true,
      lookJSON,
      artistName,
      genre
    });

  } catch (error: any) {
    console.error('❌ Error generating look JSON:', error);
    res.status(500).json({ error: error.message });
  }
});

// Step 2: Generate 4 outfit images from the structured look JSON
router.post('/generate-look-images', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { lookJSON, artistName, sessionId } = req.body as { 
      lookJSON: ArtistLookJSON; 
      artistName: string;
      sessionId?: number;
    };

    if (!lookJSON?.imagePrompts || lookJSON.imagePrompts.length === 0) {
      return res.status(400).json({ error: 'lookJSON with imagePrompts is required' });
    }

    console.log(`🖼️ Generating 4 look images for ${artistName} with Nano Banana 2...`);

    const prompts = lookJSON.imagePrompts.slice(0, 4);
    
    // Generate all 4 images in parallel
    const imageResults = await Promise.allSettled(
      prompts.map(async (prompt, index) => {
        console.log(`  📸 Image ${index + 1}/4: ${prompt.substring(0, 80)}...`);
        const result = await generateImageWithNanoBanana(prompt, {
          aspectRatio: index === 0 ? '3:4' : index === 3 ? '1:1' : '3:4',
          numImages: 1,
          outputFormat: 'png'
        });
        return { index, ...result };
      })
    );

    const images = imageResults.map((result, i) => {
      if (result.status === 'fulfilled' && result.value.success) {
        return {
          index: i,
          imageUrl: result.value.imageUrl,
          prompt: prompts[i],
          success: true
        };
      }
      return {
        index: i,
        imageUrl: null,
        prompt: prompts[i],
        success: false,
        error: result.status === 'rejected' ? result.reason?.message : 'No image generated'
      };
    });

    const successCount = images.filter(img => img.success).length;
    console.log(`✅ Generated ${successCount}/4 images successfully`);

    // Save results to DB
    if (successCount > 0) {
      const successImages = images.filter(img => img.success && img.imageUrl);
      
      // Save to fashion portfolio
      await db.insert(fashionPortfolio).values({
        userId,
        title: `${lookJSON.lookConcept?.theme || 'AI Look'} - ${artistName}`,
        description: `AI-generated look: ${lookJSON.lookConcept?.mood || ''}. Colors: ${lookJSON.lookConcept?.colorPalette?.join(', ') || ''}`,
        images: successImages.map(img => img.imageUrl!),
        category: (lookJSON.lookConcept?.occasion as any) || 'photoshoot',
        season: lookJSON.lookConcept?.season || null,
        tags: [
          lookJSON.artistProfile?.genre,
          ...(lookJSON.lookConcept?.styleInfluences || []),
          'ai-generated'
        ].filter(Boolean) as string[],
        isPublic: false
      });
    }

    res.json({
      success: true,
      images,
      lookJSON,
      totalGenerated: successCount,
      artistName
    });

  } catch (error: any) {
    console.error('❌ Error generating look images:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Editorial realism wrapper ──────────────────────────────────
// Appends a rigorously structured, anti-AI "shot on film" couture wrapper to
// every per-frame prompt so the result reads like a real Vogue/Chanel editorial
// (and preserves the artist's real gender) regardless of what the LLM returned.
function buildEditorialImagePrompt(
  basePrompt: string,
  opts: {
    artistName: string;
    genre: string;
    gender?: string;
    houseReference?: string;
    monochrome?: boolean;
  }
): string {
  const { artistName, genre, gender, houseReference, monochrome } = opts;
  const genderPhrase = gender && /^(masc|fem|andro)/i.test(gender)
    ? `, ${gender.toLowerCase()} presentation (keep this exact gender)`
    : '';
  const house = houseReference ? `${houseReference} ` : 'Vogue / Chanel haute couture ';
  const colorTreatment = monochrome
    ? 'High-contrast fine-art BLACK AND WHITE, Kodak Tri-X 400 film grain, deep blacks, luminous highlights, classic couture monochrome'
    : 'Refined editorial color grading, restrained couture palette, true-to-life skin tones';
  return [
    `${house}haute-couture editorial photograph of ${artistName}, a ${genre} recording artist posed as a professional fashion model${genderPhrase}.`,
    basePrompt.trim(),
    'Styled and lit like a real magazine cover shoot: editorial key light, soft rim light, sculpted shadows.',
    'Medium-format camera look, 85-105mm, shallow depth of field, sharp couture fabric detail.',
    colorTreatment + '.',
    'Photorealistic: visible natural skin texture and pores, real fabric weight, subtle asymmetry, authentic styling.',
    'Shot on film by a master fashion photographer. NOT AI, no plastic skin, no over-smoothing, no distorted hands, no extra fingers, no text or watermark.',
  ].join(' ');
}

// Combined: Generate look JSON + images in one call
router.post('/generate-complete-look', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { artistName, biography, genre, subgenres, profileImageUrl, occasion, mood, monochrome } = req.body;

    if (!artistName || !genre) {
      return res.status(400).json({ error: 'artistName and genre are required' });
    }

    const blackAndWhite = monochrome === true || monochrome === 'true';
    console.log(`🎨 Complete look generation for ${artistName} (${genre})${blackAndWhite ? ' [B&W]' : ''}`);

    // Step 1: Generate JSON
    const { createTrackedOpenAI } = require('../utils/tracked-openai');
    const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are the creative director and casting stylist behind covers for Vogue, Vogue Italia, Numéro, Dazed and the Chanel / Saint Laurent haute-couture campaigns.
You build couture-level editorial concepts for recording artists and direct the photo shoot like a real fashion editorial — not an AI render.
Non-negotiable rules:
- Treat the artist as a professional fashion MODEL on a real set, never a generic "AI person".
- RESPECT the artist's real gender presentation and ethnicity exactly as seen in the reference photo / biography. Never change the subject's gender. State it explicitly in every image prompt.
- Garments must read as genuine haute couture / luxury maison pieces (tailoring, hand-finished fabrics, atelier silhouettes), authentic to the artist's genre.
- Photography must look like it was shot on real film/medium-format by a master (Peter Lindbergh, Paolo Roversi, Steven Meisel): real skin texture and pores, natural asymmetry, no plastic skin, no over-smoothing, no extra fingers, no AI artefacts.
Respond ONLY with valid JSON.`;

    const monoDirective = blackAndWhite
      ? `RENDER EVERY image in high-contrast fine-art BLACK AND WHITE (monochrome), Kodak Tri-X 400 grain, deep blacks and luminous highlights, classic couture-editorial b&w. Color palette in JSON should describe the tonal/grayscale story (e.g. charcoal, graphite, ivory).`
      : `Use a refined, restrained editorial color story (couture palettes, not garish). Color palette = hex array.`;

    const userPrompt = `Design a complete HAUTE-COUTURE EDITORIAL story for this recording artist, at the level of a Vogue cover / Chanel campaign:
Name: ${artistName} | Genre: ${genre} | Sub-genres: ${(subgenres || []).join(', ') || 'N/A'}
Biography: ${biography || 'Emerging artist'} | Occasion: ${occasion || 'editorial photoshoot'} | Mood: ${mood || 'confident, editorial'}
${monoDirective}

Return JSON with:
- artistProfile: { name, genre, subgenres, era, personality, presentedGender ("masculine" | "feminine" | "androgynous", inferred from the reference photo/biography — NEVER invent the opposite gender), ethnicityNote (short, respectful, for casting accuracy) }
- lookConcept: { theme (evocative couture concept name), mood, occasion, season, houseReference (the fashion house/magazine the look channels, e.g. "Chanel Haute Couture", "Vogue Italia editorial"), colorPalette (hex array), styleInfluences (array of designers/eras) }
- outfitPieces: top, bottom, footwear each { type, material, color, details }, accessories (array of { type, description }), hair { style, color }
- imagePrompts: EXACTLY 4 prompts, 90-130 words each, professionally structured.

Each imagePrompt MUST follow this exact structure in prose:
[1 Publication/house reference] → [2 shot type & framing] → [3 the subject described as "a ${genre} recording artist, <presentedGender> model" — keep the real gender] → [4 the full couture outfit from outfitPieces, named precisely] → [5 pose, attitude, gaze] → [6 set/location] → [7 lighting setup (editorial: soft key, rim, dramatic shadow)] → [8 camera/film spec: medium-format, 80-105mm, shallow depth of field, ${blackAndWhite ? 'black & white film grain' : 'fine color grading'}] → [9 realism cues: visible skin texture, natural pores, no airbrushing, photorealistic, shot on film, NOT AI].
The 4 frames are: 1) Full-length couture editorial, 2) Tight beauty/upper-body portrait, 3) Dynamic movement (fabric in motion), 4) Intimate candid backstage moment.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (profileImageUrl && (profileImageUrl.startsWith('http://') || profileImageUrl.startsWith('https://'))) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { type: 'image_url', image_url: { url: profileImageUrl, detail: 'low' } }
        ]
      });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    const aiResponse = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      max_tokens: 4000,
      temperature: 0.85,
      response_format: { type: 'json_object' }
    });

    const lookJSON: ArtistLookJSON = JSON.parse(aiResponse.choices[0]?.message?.content || '{}');
    console.log(`📋 Look concept: "${lookJSON.lookConcept?.theme}" — generating 4 couture images...`);

    // Step 2: Generate 4 images in parallel
    const prompts = (lookJSON.imagePrompts || []).slice(0, 4);
    if (prompts.length === 0) {
      return res.status(500).json({ error: 'AI did not generate image prompts' });
    }

    // Best-quality pipeline: OpenAI gpt-image-1 in EDIT mode (uses the artist's real
    // photo for true likeness → looks like a real model, respects identity & gender),
    // falling back to gpt-image-1 text-to-image, then FAL flux-pro/kontext.
    const { editImageWithGPTImage1, generateImageWithGPTImage1 } = require('../services/fal-service');
    const FAL_KEY_LOOK = process.env.FAL_KEY || process.env.FAL_KEY_BACKUP;
    const hasRef = !!(profileImageUrl && (profileImageUrl.startsWith('http://') || profileImageUrl.startsWith('https://')));
    const presentedGender = lookJSON.artistProfile?.presentedGender;
    const houseReference = lookJSON.lookConcept?.houseReference;

    const imageResults = await Promise.allSettled(
      prompts.map(async (prompt, index) => {
        const finalPrompt = buildEditorialImagePrompt(prompt, {
          artistName,
          genre,
          gender: presentedGender,
          houseReference,
          monochrome: blackAndWhite,
        });
        // portrait for editorial frames, square for the candid backstage frame
        const gptSize = index === 3 ? '1024x1024' : '1024x1536';

        // 1) gpt-image-1 EDIT (likeness-preserving) when we have the artist photo
        if (hasRef) {
          try {
            const edit = await editImageWithGPTImage1(profileImageUrl, finalPrompt, {
              size: gptSize as any,
              quality: 'high',
              outputFolder: 'fashion-looks',
            });
            if (edit?.success && edit.imageUrl) {
              return { index, success: true, imageUrl: edit.imageUrl, provider: 'gpt-image-1-edit' };
            }
          } catch (e) { /* fall through */ }
        }

        // 2) gpt-image-1 text-to-image
        try {
          const gen = await generateImageWithGPTImage1(finalPrompt, { size: gptSize as any, quality: 'high' });
          if (gen?.success && gen.imageUrl) {
            return { index, success: true, imageUrl: gen.imageUrl, provider: 'gpt-image-1' };
          }
        } catch (e) { /* fall through */ }

        // 3) FAL flux-pro/kontext fallback
        try {
          const falRes = await fetch('https://fal.run/fal-ai/flux-pro/kontext/text-to-image', {
            method: 'POST',
            headers: { 'Authorization': `Key ${FAL_KEY_LOOK}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: finalPrompt,
              image_size: index === 3 ? 'square_hd' : 'portrait_4_3',
              num_images: 1,
              num_inference_steps: 28,
              guidance_scale: 3.5,
            }),
          });
          const falData: any = await falRes.json();
          const imageUrl = falData?.images?.[0]?.url || null;
          return { index, success: !!imageUrl, imageUrl, provider: 'fal-flux-kontext' };
        } catch (e) {
          return { index, success: false, imageUrl: null, provider: 'none' };
        }
      })
    );

    const images = imageResults.map((result, i) => {
      if (result.status === 'fulfilled' && result.value.success) {
        return { index: i, imageUrl: result.value.imageUrl, prompt: prompts[i], success: true, provider: (result.value as any).provider };
      }
      return { index: i, imageUrl: null, prompt: prompts[i], success: false };
    });

    const successCount = images.filter(img => img.success).length;

    // Save to portfolio
    const successImages = images.filter(img => img.success && img.imageUrl);
    const { artistId: reqArtistId, artistName: artistNameBody } = req.body;
    if (successImages.length > 0) {
      await db.insert(fashionPortfolio).values({
        userId,
        title: `${lookJSON.lookConcept?.theme || 'AI Look'} - ${artistName}`,
        description: `AI look: ${lookJSON.lookConcept?.mood || ''}`,
        images: successImages.map(img => img.imageUrl!),
        category: (lookJSON.lookConcept?.occasion as any) || 'photoshoot',
        season: lookJSON.lookConcept?.season || null,
        tags: [genre, 'ai-generated', ...(lookJSON.lookConcept?.styleInfluences || []).slice(0, 3)].filter(Boolean) as string[],
        isPublic: false
      });
      // Also save to Firestore image_galleries so it appears in artist profile
      try {
        if (firestoreDb) {
          const fsUserId = reqArtistId ? String(reqArtistId) : String(userId);
          await firestoreDb.collection('image_galleries').add({
            userId: fsUserId,
            singleName: `${lookJSON.lookConcept?.theme || 'AI Look'} — ${artistName}`,
            artistName: artistName || artistNameBody || 'Artist',
            basePrompt: lookJSON.lookConcept?.theme || 'fashion look',
            styleInstructions: (lookJSON.lookConcept?.styleInfluences || []).join(', '),
            referenceImageUrls: [],
            generatedImages: successImages.map((img, i) => ({
              id: `look-${Date.now()}-${i}`,
              url: img.imageUrl!,
              prompt: img.prompt || '',
              createdAt: new Date().toISOString(),
              isVideo: false,
            })),
            source: 'fashion-studio-look-generator',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: false,
          });
          console.log('✅ Look images saved to Firestore image_galleries');
        }
      } catch (fsErr) {
        console.warn('⚠️ Could not save look images to Firestore:', fsErr);
      }
    }

    // Create session record
    const [session] = await db.insert(fashionSessions).values({
      userId,
      sessionType: 'generation',
      metadata: { artistName, genre, theme: lookJSON.lookConcept?.theme },
      status: 'completed'
    }).returning();

    console.log(`\u2705 Complete look done: ${successCount}/4 images, session ${session.id}`);

    res.json({
      success: true,
      lookJSON,
      images,
      totalGenerated: successCount,
      sessionId: session.id,
      artistName
    });

  } catch (error: any) {
    console.error('❌ Error in complete look generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 🎨 ATELIER STUDIO — Premium fashion generation with multi-provider fallback
// ============================================

// In-memory message store (per user) — lightweight messaging for influencer collab.
// Persists for the lifetime of the process; can be migrated to a DB table later.
type AtelierMessage = {
  id: string;
  userId: number;
  artistId?: number | null;
  threadId: string;
  from: 'me' | 'collaborator' | 'ai-stylist';
  authorName?: string;
  authorAvatar?: string;
  body: string;
  attachments?: { type: 'image' | 'lookbook'; url: string }[];
  createdAt: string;
};
const atelierMessages: AtelierMessage[] = [];

// Style presets — curated mood templates surfaced in the UI.
const STYLE_PRESETS: Record<string, { label: string; suffix: string; aspectRatio: '1:1' | '3:4' | '4:3' | '16:9' | '9:16' }> = {
  editorial:   { label: 'Vogue Editorial',   suffix: 'high fashion editorial photography, 85mm lens, soft cinematic lighting, magazine cover quality, sharp details, color graded, depth of field', aspectRatio: '3:4' },
  streetwear:  { label: 'Streetwear',        suffix: 'streetwear photography, urban backdrop, candid pose, golden hour, film grain, Tokyo Harajuku vibe, premium street fashion', aspectRatio: '3:4' },
  glam:        { label: 'Red Carpet Glam',   suffix: 'red carpet photography, dramatic studio lighting, luxurious couture, paparazzi flash, glamorous Hollywood pose, ultra-detailed fabrics', aspectRatio: '3:4' },
  ycoded:      { label: 'Y2K / Cyber',       suffix: 'futuristic Y2K aesthetic, neon lights, holographic textures, cyberpunk fashion, glossy materials, vibrant pink and blue grading', aspectRatio: '3:4' },
  minimal:     { label: 'Quiet Luxury',      suffix: 'quiet luxury minimal aesthetic, beige and ivory palette, soft natural light, clean lines, expensive fabrics, Phoebe Philo era', aspectRatio: '3:4' },
  afrofuturist:{ label: 'Afrofuturist',       suffix: 'afrofuturist couture, metallic textures, tribal patterns reimagined, dramatic silhouettes, golden hour lighting, regal posture', aspectRatio: '3:4' },
  grunge:      { label: 'Grunge Rock',       suffix: 'grunge rock aesthetic, leather and denim, distressed textures, moody lighting, raw editorial vibe, 90s film stock', aspectRatio: '3:4' },
  athleisure:  { label: 'Sport Luxe',        suffix: 'athleisure luxe fashion, performance fabrics, dynamic action pose, clean studio backdrop, contemporary sportswear', aspectRatio: '3:4' },
};

/**
 * POST /api/fashion/atelier/generate
 * Premium image generation with provider fallback chain:
 * fal Nano Banana → OpenAI GPT Image 1 → DALL-E 3 → Replicate Flux
 */
router.post('/atelier/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const {
      prompt,
      stylePreset,
      aspectRatio,
      artistName,
      artistId,
      sessionId,
      negativePrompt,
    } = req.body as {
      prompt: string;
      stylePreset?: keyof typeof STYLE_PRESETS;
      aspectRatio?: string;
      artistName?: string;
      artistId?: number;
      sessionId?: number;
      negativePrompt?: string;
    };

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'prompt is required (min 5 chars)' });
    }

    const preset = stylePreset && STYLE_PRESETS[stylePreset] ? STYLE_PRESETS[stylePreset] : null;
    const finalAspect = (aspectRatio || preset?.aspectRatio || '3:4') as any;

    const fashionContext = artistName
      ? `${artistName}, music artist, fashion-forward styling, `
      : 'fashion-forward styling, ';
    const enhancedPrompt = `${fashionContext}${prompt.trim()}${preset ? `. Style: ${preset.suffix}` : ''}${negativePrompt ? `. Avoid: ${negativePrompt}` : ''}`;

    // Lazy-load to avoid circular issues
    const {
      generateImageWithNanoBanana,
      generateImageWithGPTImage1,
      generateImageWithOpenAI,
      generateImageWithReplicate,
    } = require('../services/fal-service');

    type Attempt = { provider: string; ok: boolean; error?: string; ms: number };
    const attempts: Attempt[] = [];

    const chain: Array<{ name: string; run: () => Promise<any> }> = [
      { name: 'fal-nano-banana-2', run: () => generateImageWithNanoBanana(enhancedPrompt, { aspectRatio: finalAspect, numImages: 1, outputFormat: 'png' }) },
      { name: 'openai-gpt-image-1', run: () => generateImageWithGPTImage1(enhancedPrompt, { quality: 'high' }) },
      { name: 'openai-dall-e-3',    run: () => generateImageWithOpenAI(enhancedPrompt, { quality: 'hd' }) },
      { name: 'replicate-flux',     run: () => generateImageWithReplicate(enhancedPrompt, { aspectRatio: finalAspect }) },
    ];

    let success: { imageUrl: string; provider: string } | null = null;
    for (const link of chain) {
      const t0 = Date.now();
      try {
        const result = await link.run();
        const ms = Date.now() - t0;
        if (result?.success && result?.imageUrl) {
          attempts.push({ provider: link.name, ok: true, ms });
          success = { imageUrl: result.imageUrl, provider: link.name };
          break;
        }
        attempts.push({ provider: link.name, ok: false, error: result?.error || 'no image', ms });
      } catch (err: any) {
        attempts.push({ provider: link.name, ok: false, error: err?.message || String(err), ms: Date.now() - t0 });
      }
    }

    if (!success) {
      return res.status(502).json({ success: false, error: 'All providers failed', attempts });
    }

    // Persist to fashionResults if a session is provided
    if (sessionId) {
      try {
        await db.insert(fashionResults).values({
          sessionId,
          userId,
          resultType: 'generation',
          imageUrl: success.imageUrl,
          metadata: { prompt: enhancedPrompt, falModel: success.provider, tags: stylePreset ? [stylePreset] : [] },
        });
      } catch (e) {
        console.warn('[atelier] could not persist fashionResults:', e);
      }
    }

    res.json({
      success: true,
      imageUrl: success.imageUrl,
      provider: success.provider,
      enhancedPrompt,
      stylePreset: stylePreset || null,
      aspectRatio: finalAspect,
      attempts,
    });
  } catch (error: any) {
    console.error('❌ [atelier] generate error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/fashion/atelier/presets
 */
router.get('/atelier/presets', authenticate, async (_req: Request, res: Response) => {
  res.json({ success: true, presets: STYLE_PRESETS });
});

/**
 * GET /api/fashion/atelier/messages?threadId=...
 */
router.get('/atelier/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });
    const threadId = String(req.query.threadId || 'default');
    const list = atelierMessages
      .filter(m => m.userId === userId && m.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ success: true, messages: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fashion/atelier/messages
 * Body: { threadId, body, attachments?, artistId?, replyAsAI? }
 */
router.post('/atelier/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });
    const { threadId = 'default', body, attachments, artistId, replyAsAI = true, authorName, authorAvatar } = req.body as any;
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'body is required' });

    const userMsg: AtelierMessage = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      artistId: artistId || null,
      threadId,
      from: 'me',
      authorName,
      authorAvatar,
      body: String(body).trim(),
      attachments,
      createdAt: new Date().toISOString(),
    };
    atelierMessages.push(userMsg);

    let aiReply: AtelierMessage | null = null;
    if (replyAsAI) {
      try {
        const { createTrackedOpenAI } = require('../utils/tracked-openai');
        const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const aiResp = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            { role: 'system', content: 'You are an elite fashion atelier stylist for music artists and influencers. Reply concisely (max 3 short sentences) with actionable styling guidance, color palette suggestions, and silhouette ideas. Be warm, modern, and specific.' },
            { role: 'user', content: String(body).slice(0, 2000) },
          ],
          temperature: 0.85,
          max_tokens: 220,
        });
        const text = aiResp.choices?.[0]?.message?.content?.trim() || '';
        if (text) {
          aiReply = {
            id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId,
            artistId: artistId || null,
            threadId,
            from: 'ai-stylist',
            authorName: 'Atelier AI Stylist',
            body: text,
            createdAt: new Date(Date.now() + 1).toISOString(),
          };
          atelierMessages.push(aiReply);
        }
      } catch (e) {
        console.warn('[atelier] AI reply failed:', e);
      }
    }

    res.json({ success: true, message: userMsg, aiReply });
  } catch (error: any) {
    console.error('❌ [atelier] messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fashion/generate-hero
 * Generate a hero image for the artist image advisor page with Flux Pro Kontext T2I.
 * Saves result to Firestore image_galleries so it appears in artist profile gallery.
 */
router.post('/generate-hero', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { prompt, artistId, artistName, imageSize } = req.body as {
      prompt: string;
      artistId?: string | number;
      artistName?: string;
      imageSize?: string;
    };

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_KEY_BACKUP;
    if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

    const enhancedPrompt = `${artistName ? `${artistName}, music artist, ` : ''}${prompt.trim()}, fashion editorial photography, luxury aesthetic, high fashion magazine quality, cinematic lighting`;

    const falRes = await fetch('https://fal.run/fal-ai/flux-pro/kontext/text-to-image', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        image_size: imageSize || 'landscape_16_9',
        num_images: 1,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      console.error('FAL hero image error:', errText);
      return res.status(502).json({ error: 'FAL API failed', detail: errText });
    }

    const falData: any = await falRes.json();
    const imageUrl = falData?.images?.[0]?.url || falData?.image?.url || null;

    if (!imageUrl) {
      return res.status(502).json({ error: 'No image URL returned from FAL' });
    }

    // Save to Firestore image_galleries
    try {
      if (firestoreDb) {
        const fsUserId = artistId ? String(artistId) : String(userId);
        await firestoreDb.collection('image_galleries').add({
          userId: fsUserId,
          singleName: `Hero Image — ${artistName || 'Artist'}`,
          artistName: artistName || 'Artist',
          basePrompt: prompt,
          styleInstructions: 'Hero fashion image',
          referenceImageUrls: [],
          generatedImages: [{
            id: `hero-${Date.now()}-0`,
            url: imageUrl,
            prompt: enhancedPrompt,
            createdAt: new Date().toISOString(),
            isVideo: false,
          }],
          source: 'fashion-studio-hero',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: false,
        });
        console.log('✅ Hero image saved to Firestore image_galleries');
      }
    } catch (fsErr) {
      console.warn('⚠️ Could not save hero image to Firestore:', fsErr);
    }

    res.json({ success: true, imageUrl, prompt: enhancedPrompt });
  } catch (error: any) {
    console.error('❌ generate-hero error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/fashion/generate-images
 * Generate 1-4 fashion images with Flux Pro Kontext T2I (best model).
 * Saves to Firestore image_galleries for artist profile gallery.
 */
router.post('/generate-images', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { prompt, artistId, artistName, numImages, imageSize, sessionTitle } = req.body as {
      prompt: string;
      artistId?: string | number;
      artistName?: string;
      numImages?: number;
      imageSize?: string;
      sessionTitle?: string;
    };

    if (!prompt || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const FAL_KEY = process.env.FAL_KEY || process.env.FAL_KEY_BACKUP;
    if (!FAL_KEY) return res.status(500).json({ error: 'FAL_KEY not configured' });

    const count = Math.min(Math.max(numImages || 1, 1), 4);
    const enhancedPrompt = `${artistName ? `${artistName}, music artist, ` : ''}${prompt.trim()}, high fashion editorial photography, luxury aesthetic, cinematic lighting, professional quality`;

    const falRes = await fetch('https://fal.run/fal-ai/flux-pro/kontext/text-to-image', {
      method: 'POST',
      headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        image_size: imageSize || 'portrait_4_3',
        num_images: count,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text();
      return res.status(502).json({ error: 'FAL API failed', detail: errText });
    }

    const falData: any = await falRes.json();
    const imageUrls: string[] = (falData?.images || []).map((img: any) => img?.url).filter(Boolean);

    if (imageUrls.length === 0) {
      return res.status(502).json({ error: 'No images returned from FAL' });
    }

    // Save to Firestore image_galleries
    try {
      if (firestoreDb) {
        const fsUserId = artistId ? String(artistId) : String(userId);
        await firestoreDb.collection('image_galleries').add({
          userId: fsUserId,
          singleName: sessionTitle || `Fashion Images — ${artistName || 'Artist'}`,
          artistName: artistName || 'Artist',
          basePrompt: prompt,
          styleInstructions: 'Generated with Flux Pro Kontext',
          referenceImageUrls: [],
          generatedImages: imageUrls.map((url, i) => ({
            id: `fashion-img-${Date.now()}-${i}`,
            url,
            prompt: enhancedPrompt,
            createdAt: new Date().toISOString(),
            isVideo: false,
          })),
          source: 'fashion-studio-generate',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPublic: false,
        });
        console.log('✅ Fashion images saved to Firestore image_galleries');
      }
    } catch (fsErr) {
      console.warn('⚠️ Could not save fashion images to Firestore:', fsErr);
    }

    res.json({ success: true, images: imageUrls, count: imageUrls.length });
  } catch (error: any) {
    console.error('❌ generate-images error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
