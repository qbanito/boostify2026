import { Express, Request, Response } from "express";
import { db as firebaseDb } from "../firebase";

/**
 * Configura rutas para gestionar archivos en el servidor
 */
export function setupFilesRoutes(app: Express) {
  /**
   * Endpoint para obtener la lista de videos desde Firestore
   * Retorna una lista de objetos con información sobre cada video
   */
  app.get("/api/files/videos/:folder", async (req: Request, res: Response) => {
    try {
      const folder = req.params.folder;
      
      // Obtener videos desde Firestore usando la Admin SDK
      const videosCollection = firebaseDb.collection("videos");
      
      // Consulta para obtener videos ordenados por fecha de creación
      const querySnapshot = await videosCollection
        .orderBy("createdAt", "desc") // Ordenar por fecha de creación (más reciente primero)
        .get();
      
      if (querySnapshot.empty) {
        return res.json({
          success: true,
          videos: [],
          message: "No videos found"
        });
      }
      
      // Convertir los documentos a objetos con el formato esperado
      const videos = querySnapshot.docs.map((doc: any) => {
        const data = doc.data();

        // Support both filePath (Storage uploads) and url (YouTube / external links)
        const rawPath: string = data.filePath || data.url || data.videoUrl || "";
        const isYouTube = rawPath.includes('youtube.com') || rawPath.includes('youtu.be');

        let videoId: string | null = null;
        let thumbnailPath: string | null = data.thumbnailPath || data.thumbnailUrl || null;
        let finalPath = rawPath;

        if (isYouTube) {
          if (rawPath.includes('v=')) videoId = rawPath.split('v=')[1]?.split('&')[0];
          else if (rawPath.includes('youtu.be/')) videoId = rawPath.split('youtu.be/')[1]?.split('?')[0];
          else if (rawPath.includes('/shorts/')) videoId = rawPath.split('/shorts/')[1]?.split('?')[0];
          else if (rawPath.includes('/embed/')) videoId = rawPath.split('/embed/')[1]?.split('?')[0];
          if (videoId) {
            finalPath = `https://www.youtube.com/embed/${videoId}`;
            if (!thumbnailPath) thumbnailPath = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
          }
        }

        // Normalize category: accept news/entertainment/podcast/trending + legacy values
        const rawCategory = data.category || "videos";
        const validCategories = ["featured", "live", "videos", "music", "news", "entertainment", "podcast", "trending"];
        const category = validCategories.includes(rawCategory) ? rawCategory : "videos";

        return {
          id: doc.id,
          title: data.title || "Untitled Video",
          description: data.description || "",
          filePath: finalPath,
          thumbnailPath,
          duration: data.duration || "0:00",
          views: data.views || 0,
          category,
          isYouTube,
          videoId,
          userId: data.userId || null,
          createdAt: data.createdAt?.toDate?.() || new Date()
        };
      }).filter((v: any) => v.filePath && v.filePath.trim() !== "");
      
      res.json({
        success: true,
        videos,
      });
    } catch (error) {
      console.error("Error fetching videos from Firestore:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching videos",
        error: (error as Error).message,
      });
    }
  });
  
  /**
   * Endpoint para obtener detalles de un video específico
   */
  app.get("/api/files/videos/:folder/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      
      // Referencia al documento de Firestore usando Admin SDK
      const videoDoc = await firebaseDb.collection("videos").doc(videoId).get();
      
      if (!videoDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Video not found"
        });
      }
      
      const videoData = videoDoc.data() || {};
      
      // Determinar si la fecha es un Timestamp de Firestore y convertirla si es necesario
      let createdAt = new Date();
      if (videoData.createdAt) {
        if (typeof videoData.createdAt.toDate === 'function') {
          createdAt = videoData.createdAt.toDate();
        } else if (videoData.createdAt instanceof Date) {
          createdAt = videoData.createdAt;
        }
      }
      
      res.json({
        success: true,
        video: {
          id: videoDoc.id,
          title: videoData.title || "Untitled Video",
          description: videoData.description || "",
          filePath: videoData.filePath || "",
          thumbnailPath: videoData.thumbnailPath || null,
          duration: videoData.duration || "0:00",
          views: videoData.views || 0,
          category: videoData.category || "videos",
          createdAt: createdAt
        }
      });
    } catch (error) {
      console.error("Error fetching video details:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching video details",
        error: (error as Error).message,
      });
    }
  });
}