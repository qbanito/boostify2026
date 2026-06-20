import { env } from "../../env";
import { logger } from "../logger";
import { apiRequest } from "../queryClient";
import { auth, db } from "../../firebase";
import { collection, addDoc, getDocs, doc, getDoc, query, where, orderBy, Timestamp, serverTimestamp } from "firebase/firestore";

interface ImageAdvice {
  styleAnalysis: string;
  recommendations: string[];
  colorPalette: string[];
  brandingTips: string[];
}

export interface SavedImageAdvice extends ImageAdvice {
  id: string;
  createdAt: Date | any;
  userId: string;
  referenceImage?: string;
  genre?: string;
  style?: string;
}

export const imageAdvisorService = {
  async analyzeImage(imageUrl: string): Promise<ImageAdvice> {
    try {
      // Verificar que la API key esté configurada
      if (!env.VITE_OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key not configured");
      }
      
      // Verificar que imageUrl no sea demasiado larga
      if (imageUrl.length > 12000) {
        throw new Error("Image URL too long - please use a smaller image");
      }
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.VITE_OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Artist Image Advisor",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-sonnet",
          messages: [
            {
              role: "system",
              content: `You are an expert image consultant for musicians and artists. Analyze the provided image and create detailed recommendations in JSON format with these exact keys:
              {
                "styleAnalysis": "detailed analysis of current style",
                "recommendations": ["array of specific style recommendations"],
                "colorPalette": ["suggested colors that match the artist's brand"],
                "brandingTips": ["specific branding recommendations"]
              }`
            },
            {
              role: "user",
              content: `Analyze this artist image and provide professional recommendations: ${imageUrl}`
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error("Invalid API response format");
      }
      
      let analysis;
      try {
        analysis = JSON.parse(data.choices[0].message.content);
      } catch (parseError) {
        throw new Error("Failed to parse API response");
      }
      
      // Validar que el análisis tenga la estructura correcta
      if (!analysis.styleAnalysis || !analysis.recommendations) {
        throw new Error("API returned incomplete data");
      }
      
      // Solo guardar en Firestore si tenemos datos válidos
      if (analysis.styleAnalysis && analysis.recommendations) {
        try {
          await this.saveImageAdvice({
            ...analysis,
            referenceImage: imageUrl
          });
        } catch (saveError) {
          logger.warn("Analysis completed but could not save results:", saveError);
          // No lanzamos error aquí para que el análisis se muestre aunque el guardado falle
        }
      }
      
      return analysis;
    } catch (error) {
      logger.error("Error analyzing image:", error);
      throw error;
    }
  },

  async generateVisualRecommendations(style: string, genre: string): Promise<string[]> {
    try {
      // Verificar que la API key esté configurada
      if (!env.VITE_OPENROUTER_API_KEY) {
        throw new Error("OpenRouter API key not configured");
      }
      
      // Verificar parámetros
      if (!style || !genre) {
        throw new Error("Style and genre are required parameters");
      }
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.VITE_OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Artist Image Advisor",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "anthropic/claude-3-sonnet",
          messages: [
            {
              role: "system",
              content: "Generate visual style recommendations for musicians based on their genre and desired style. Return an array of specific recommendations."
            },
            {
              role: "user",
              content: `Generate specific visual style recommendations for a ${genre} artist looking to achieve a ${style} style.`
            }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error("Invalid API response format");
      }
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(data.choices[0].message.content);
      } catch (parseError) {
        throw new Error("Failed to parse API response");
      }
      
      if (!parsedResponse.recommendations || !Array.isArray(parsedResponse.recommendations)) {
        throw new Error("API response missing recommendations array");
      }
      
      const recommendations = parsedResponse.recommendations;
      
      // Solo guardar en Firestore si tenemos datos válidos y no hay errores
      if (recommendations && recommendations.length > 0) {
        try {
          await this.saveImageAdvice({
            styleAnalysis: `Genre-based style analysis for ${genre} with ${style} aesthetic.`,
            recommendations: recommendations,
            colorPalette: [],
            brandingTips: [],
            genre,
            style
          });
        } catch (saveError) {
          logger.warn("Recommendations generated but could not save results:", saveError);
          // No lanzamos error aquí para que las recomendaciones se muestren aunque el guardado falle
        }
      }
      
      return recommendations;
    } catch (error) {
      logger.error("Error generating recommendations:", error);
      throw error;
    }
  },
  
  async saveImageAdvice(advice: Partial<ImageAdvice & { referenceImage?: string, genre?: string, style?: string }>): Promise<string> {
    try {
      // Get current user
      const user = auth.currentUser;
      const userId = user?.uid || 'anonymous';
      
      // Prepare data to save
      const adviceData = {
        ...advice,
        userId,
        // Use serverTimestamp for better consistency across clients
        createdAt: serverTimestamp(),
      };
      
      // Save to Firestore using Firebase v9 syntax
      const resultsCollection = collection(db, 'image_advisor_results');
      const docRef = await addDoc(resultsCollection, adviceData);
      logger.info("Image advice saved with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      logger.error("Error saving image advice:", error);
      // Return an empty string instead of throwing to prevent cascading failures
      return "";
    }
  },
  
  async getSavedResults(): Promise<SavedImageAdvice[]> {
    try {
      // Get current user
      const user = auth.currentUser;
      const userId = user?.uid || 'anonymous';
      
      // Modificamos la consulta para evitar el uso de índices compuestos
      // Primero filtramos solo por userId sin ordenamiento
      const resultsCollection = collection(db, 'image_advisor_results');
      const q = query(
        resultsCollection,
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      
      // Luego procesamos y convertimos los documentos en objetos con el formato adecuado
      const results: SavedImageAdvice[] = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Procesar fecha correctamente
        let createdAt: Date;
        if (data.createdAt instanceof Timestamp) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt?.seconds) {
          createdAt = new Date(data.createdAt.seconds * 1000);
        } else {
          createdAt = new Date(); // Fallback
        }
        
        return {
          id: doc.id,
          styleAnalysis: data.styleAnalysis || '',
          recommendations: data.recommendations || [],
          colorPalette: data.colorPalette || [],
          brandingTips: data.brandingTips || [],
          referenceImage: data.referenceImage,
          genre: data.genre,
          style: data.style,
          createdAt: createdAt,
          userId: data.userId || 'anonymous'
        };
      });
      
      // Ordenamos manualmente por fecha (más recientes primero)
      return results.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return dateB - dateA;
      });
    } catch (error) {
      logger.error("Error retrieving saved results:", error);
      return [];
    }
  },
  
  async getResultById(id: string): Promise<SavedImageAdvice | null> {
    try {
      const resultsCollection = collection(db, 'image_advisor_results');
      const docRef = doc(resultsCollection, id);
      const docSnapshot = await getDoc(docRef);
      
      if (!docSnapshot.exists()) {
        return null;
      }
      
      const data = docSnapshot.data();
      
      // Handle Firestore Timestamp conversion properly
      let createdAt: Date;
      if (data.createdAt instanceof Timestamp) {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt?.seconds) {
        createdAt = new Date(data.createdAt.seconds * 1000);
      } else {
        createdAt = new Date(); // Fallback to current date if no timestamp
      }
      
      return {
        id: docSnapshot.id,
        styleAnalysis: data?.styleAnalysis || '',
        recommendations: data?.recommendations || [],
        colorPalette: data?.colorPalette || [],
        brandingTips: data?.brandingTips || [],
        referenceImage: data?.referenceImage,
        genre: data?.genre,
        style: data?.style,
        createdAt: createdAt,
        userId: data?.userId
      };
    } catch (error) {
      logger.error("Error retrieving result by ID:", error);
      return null;
    }
  }
};

export default imageAdvisorService;
