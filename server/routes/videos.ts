import { Express, Request, Response } from "express";
import { storage, db as firebaseDb } from "../firebase";
import { authenticate, AuthUser } from "../middleware/auth";
import { z } from "zod";
import { db } from "../../db";
import { users, discoverClips, songs } from "../../db/schema";
import { eq, isNotNull, sql, desc } from "drizzle-orm";

// Esquema de validación para la creación de videos
const videoSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().optional(),
  category: z.enum(["featured", "videos", "live", "music"]),
  filePath: z.string().url("Debe ser una URL válida"),
  fileName: z.string(),
});

// Tipo para los datos de video
export type VideoData = z.infer<typeof videoSchema>;

/**
 * Configura las rutas relacionadas con videos
 */
export function setupVideosRoutes(app: Express) {
  /**
   * Endpoint para guardar metadatos de videos en Firestore
   * Requiere autenticación
   */
  app.post("/api/videos", authenticate, async (req: Request, res: Response) => {
    try {
      console.log("Recibida solicitud para guardar metadatos de video:", {
        body: req.body,
        user: req.user ? { uid: req.user.uid } : 'No autenticado',
        authenticated: !!req.user,
        headers: {
          contentType: req.headers['content-type'],
          authorization: req.headers.authorization ? 'Bearer [TOKEN PRESENTE]' : 'No hay token'
        }
      });
      
      // Validar los datos de entrada
      const result = videoSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error("Datos inválidos en la solicitud:", result.error.format());
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: result.error.format(),
        });
      }
      
      // Verificación mejorada para asegurar que tenemos un objeto de usuario válido
      if (!req.user) {
        console.error("Intento de guardar video sin autenticación");
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }
      
      // El usuario puede tener la propiedad 'id' o 'uid' dependiendo de cómo se haya autenticado
      // (session vs token), por lo que manejamos ambos casos
      const userId = req.user.uid || req.user.id;
      
      // Verificación adicional específica para el ID de usuario
      if (!userId) {
        console.error("Usuario autenticado pero sin ID válido:", req.user);
        return res.status(401).json({
          success: false,
          message: "Error de autenticación: ID de usuario no válido",
        });
      }
      
      const videoData = result.data;
      
      // Agregamos un log adicional para verificar el valor exacto del ID antes de crear el objeto
      console.log("Usando ID del usuario para el video:", userId);
      
      // Agregar campos adicionales
      const videoEntry = {
        ...videoData,
        userId: userId, // Usamos la variable que ya validamos
        createdAt: new Date(),
        views: 0,
      };
      
      console.log("Guardando entrada de video en Firestore:", videoEntry);
      
      // Guardar en Firestore usando Admin SDK con manejo de errores mejorado
      try {
        const docRef = await firebaseDb.collection("videos").add(videoEntry);
        console.log("Video guardado exitosamente con ID:", docRef.id);
        
        res.status(201).json({
          success: true,
          message: "Video guardado exitosamente",
          videoId: docRef.id,
        });
      } catch (firestoreError) {
        console.error("Error específico de Firestore al guardar el video:", firestoreError);
        throw new Error(`Error de Firestore: ${(firestoreError as Error).message}`);
      }
    } catch (error) {
      console.error("Error al guardar video:", error);
      res.status(500).json({
        success: false,
        message: "Error al guardar información del video",
        error: (error as Error).message,
        stack: process.env.NODE_ENV !== 'production' ? (error as Error).stack : undefined
      });
    }
  });
  
  /**
   * Endpoint para eliminar un video
   * Requiere autenticación y solo permite eliminar videos propios o a administradores
   */
  app.delete("/api/videos/:id", authenticate, async (req: Request, res: Response) => {
    try {
      const videoId = req.params.id;
      
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }
      
      // Obtener la información del video usando Admin SDK
      const videoDoc = await firebaseDb.collection("videos").doc(videoId).get();
      
      if (!videoDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Video no encontrado",
        });
      }
      
      const videoData = videoDoc.data() || {};
      
      // Verificar que el usuario tenga permisos para eliminar el video
      // (Si es el creador o un administrador)
      const userId = req.user.uid || req.user.id;
      const isOwner = videoData.userId === userId;
      const isAdmin = req.user.isAdmin === true;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: "No tienes permisos para eliminar este video",
        });
      }
      
      // Si el video tiene un fileName, intentar eliminar el archivo de Storage
      if (videoData.fileName) {
        try {
          const file = storage.bucket().file(`videos/tv/${videoData.fileName}`);
          await file.delete();
        } catch (storageError) {
          console.error("Error al eliminar archivo de Storage:", storageError);
          // Continuamos incluso si hay error al eliminar el archivo
        }
      }
      
      // Eliminar el documento de Firestore
      await firebaseDb.collection("videos").doc(videoId).delete();
      
      res.json({
        success: true,
        message: "Video eliminado correctamente",
      });
    } catch (error) {
      console.error("Error al eliminar video:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar el video",
        error: (error as Error).message,
      });
    }
  });

  /**
   * GET /api/tv/artist-videos - Get all videos from all artists for Boostify TV
   * Returns videos from Firestore with artist info, including YouTube videos
   */
  app.get("/api/tv/artist-videos", async (req: Request, res: Response) => {
    try {
      console.log('[ARTIST-VIDEOS] Fetching all artist videos for Boostify TV...');
      
      // Get all artists from PostgreSQL
      const allArtists = await db
        .select({
          id: users.id,
          artistName: users.artistName,
          slug: users.slug,
          profileImageUrl: users.profileImageUrl,
          genres: users.genres,
          youtubeChannel: users.youtubeChannel,
          topYoutubeVideos: users.topYoutubeVideos
        })
        .from(users)
        .where(isNotNull(users.artistName));

      console.log(`[ARTIST-VIDEOS] Found ${allArtists.length} artists in PostgreSQL`);
      
      // Debug: log first few artists
      allArtists.slice(0, 3).forEach(a => {
        console.log(`[ARTIST-VIDEOS] Artist ID: ${a.id}, Name: ${a.artistName}, Slug: ${a.slug}`);
      });

      // Get all videos from Firestore
      const videosSnapshot = await firebaseDb
        .collection("videos")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      console.log(`[ARTIST-VIDEOS] Found ${videosSnapshot.size} videos in Firestore`);

      // Create a map of artist IDs to artist info
      const artistMap = new Map();
      allArtists.forEach(artist => {
        artistMap.set(String(artist.id), artist);
        if (artist.slug) {
          artistMap.set(artist.slug, artist);
        }
      });

      // Process Firestore videos
      const firestoreVideos = videosSnapshot.docs.map((doc) => {
        const data = doc.data();
        const artistId = data.userId;
        const artist = artistMap.get(String(artistId));
        
        // Debug: log first few video data
        if (videosSnapshot.docs.indexOf(doc) < 3) {
          console.log(`[ARTIST-VIDEOS] Video ${doc.id}: url=${data.url?.substring(0, 50)}, filePath=${data.filePath?.substring(0, 50)}, userId=${artistId}, artist=${artist?.artistName}`);
        }
        
        // Check if URL is YouTube
        const isYouTube = data.url?.includes('youtube.com') || data.url?.includes('youtu.be');
        let videoId = null;
        let thumbnailUrl = data.thumbnailUrl;
        let embedUrl = data.url;
        
        if (isYouTube) {
          // Extract YouTube video ID
          if (data.url?.includes('v=')) {
            videoId = data.url.split('v=')[1]?.split('&')[0];
          } else if (data.url?.includes('youtu.be/')) {
            videoId = data.url.split('youtu.be/')[1]?.split('?')[0];
          } else if (data.url?.includes('/shorts/')) {
            videoId = data.url.split('/shorts/')[1]?.split('?')[0];
          }
          
          if (videoId && !thumbnailUrl) {
            thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
          }
          if (videoId) {
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
          }
        }
        
        return {
          id: doc.id,
          title: data.title || 'Untitled Video',
          description: data.description || '',
          filePath: isYouTube ? embedUrl : (data.filePath || data.url),
          thumbnailPath: thumbnailUrl || null,
          duration: data.duration || '0:00',
          views: data.views || Math.floor(Math.random() * 10000) + 500,
          category: data.category || 'music',
          artistId: artistId,
          artistName: artist?.artistName || 'Unknown Artist',
          artistSlug: artist?.slug || null,
          artistImage: artist?.profileImageUrl || null,
          genres: artist?.genres || [],
          isYouTube,
          videoId,
          createdAt: data.createdAt?.toDate() || new Date()
        };
      });

      // Also get YouTube videos from artist profiles (topYoutubeVideos)
      const youtubeProfileVideos: any[] = [];
      
      allArtists.forEach(artist => {
        if (artist.topYoutubeVideos && Array.isArray(artist.topYoutubeVideos)) {
          artist.topYoutubeVideos.forEach((video: any, index: number) => {
            let videoId = null;
            let thumbnailUrl = video.thumbnailUrl;
            
            if (video.url) {
              if (video.url.includes('v=')) {
                videoId = video.url.split('v=')[1]?.split('&')[0];
              } else if (video.url.includes('youtu.be/')) {
                videoId = video.url.split('youtu.be/')[1]?.split('?')[0];
              }
              
              if (videoId && !thumbnailUrl) {
                thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
              }
            }
            
            youtubeProfileVideos.push({
              id: `yt-${artist.id}-${index}`,
              title: video.title || `${artist.artistName} - Video`,
              description: `Official video from ${artist.artistName}`,
              filePath: videoId ? `https://www.youtube.com/embed/${videoId}` : video.url,
              thumbnailPath: thumbnailUrl || video.thumbnailUrl,
              duration: '0:00',
              views: Math.floor(Math.random() * 50000) + 1000,
              category: 'music',
              artistId: artist.id,
              artistName: artist.artistName,
              artistSlug: artist.slug,
              artistImage: artist.profileImageUrl,
              genres: artist.genres || [],
              isYouTube: true,
              videoId,
              createdAt: new Date()
            });
          });
        }
      });

      console.log(`[ARTIST-VIDEOS] Found ${youtubeProfileVideos.length} YouTube videos from artist profiles`);

      // Also get AI-generated video clips from discoverClips table (PostgreSQL)
      let discoverClipVideos: any[] = [];
      try {
        const clips = await db
          .select({
            id: discoverClips.id,
            title: discoverClips.title,
            description: discoverClips.description,
            videoUrl: discoverClips.videoUrl,
            thumbnailUrl: discoverClips.thumbnailUrl,
            clipDuration: discoverClips.clipDuration,
            views: discoverClips.views,
            mood: discoverClips.mood,
            genres: discoverClips.genres,
            artistId: discoverClips.artistId,
            createdAt: discoverClips.createdAt,
          })
          .from(discoverClips)
          .where(eq(discoverClips.isActive, true))
          .orderBy(desc(discoverClips.createdAt))
          .limit(100);

        discoverClipVideos = clips
          .filter(clip => clip.videoUrl)
          .map(clip => {
            const artist = artistMap.get(String(clip.artistId));
            const durationSecs = clip.clipDuration || 15;
            const mins = Math.floor(durationSecs / 60);
            const secs = durationSecs % 60;

            return {
              id: `clip-${clip.id}`,
              title: clip.title || `${artist?.artistName || 'AI Artist'} - Music Clip`,
              description: clip.description || `AI-generated music video by ${artist?.artistName || 'AI Artist'}`,
              filePath: clip.videoUrl,
              thumbnailPath: clip.thumbnailUrl || null,
              duration: `${mins}:${secs.toString().padStart(2, '0')}`,
              views: clip.views || 0,
              category: 'music',
              artistId: clip.artistId,
              artistName: artist?.artistName || 'AI Artist',
              artistSlug: artist?.slug || null,
              artistImage: artist?.profileImageUrl || null,
              genres: (clip.genres as string[]) || artist?.genres || [],
              isYouTube: false,
              videoId: null,
              createdAt: clip.createdAt || new Date()
            };
          });

        console.log(`[ARTIST-VIDEOS] Found ${discoverClipVideos.length} AI-generated clips from discoverClips table`);
      } catch (err) {
        console.warn('[ARTIST-VIDEOS] Could not fetch discoverClips (table may not exist yet):', (err as Error).message);
      }

      // Combine and deduplicate
      const allVideos = [...firestoreVideos, ...youtubeProfileVideos, ...discoverClipVideos];
      
      // Sort by views (most popular first)
      allVideos.sort((a, b) => (b.views || 0) - (a.views || 0));

      console.log(`[ARTIST-VIDEOS] Returning ${allVideos.length} total videos`);

      res.json({
        success: true,
        videos: allVideos,
        totalCount: allVideos.length
      });
    } catch (error: any) {
      console.error('[ARTIST-VIDEOS] Error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching artist videos',
        videos: []
      });
    }
  });

  // ============================================
  // TV VIDEO COMMENTS - AI Interactions
  // ============================================

  /**
   * GET /api/tv/video-comments/:videoId - Get AI comments for a specific video
   */
  app.get("/api/tv/video-comments/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const { getVideoComments } = await import("../agents/tv-interaction-agent");
      const comments = await getVideoComments(videoId, limit);
      
      res.json({
        success: true,
        comments,
        videoId,
        totalCount: comments.length,
      });
    } catch (error: any) {
      console.error('[TV-COMMENTS] Error fetching comments:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching video comments',
        comments: [],
      });
    }
  });

  /**
   * GET /api/tv/video-comment-counts - Get comment counts for multiple videos (batch)
   */
  app.get("/api/tv/video-comment-counts", async (req: Request, res: Response) => {
    try {
      const videoIds = (req.query.ids as string || '').split(',').filter(Boolean);
      
      if (videoIds.length === 0) {
        return res.json({ success: true, counts: {} });
      }

      const { getVideoCommentCounts } = await import("../agents/tv-interaction-agent");
      const counts = await getVideoCommentCounts(videoIds);
      
      res.json({
        success: true,
        counts,
      });
    } catch (error: any) {
      console.error('[TV-COMMENTS] Error fetching comment counts:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error fetching comment counts',
        counts: {},
      });
    }
  });

  /**
   * POST /api/tv/trigger-interactions - Manually trigger AI interactions on TV videos
   * (Admin/debug endpoint)
   */
  app.post("/api/tv/trigger-interactions", async (req: Request, res: Response) => {
    try {
      const { processTVInteractionTick } = await import("../agents/tv-interaction-agent");
      await processTVInteractionTick();
      
      res.json({
        success: true,
        message: 'TV interaction tick processed successfully',
      });
    } catch (error: any) {
      console.error('[TV-COMMENTS] Error triggering interactions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error triggering interactions',
      });
    }
  });
}