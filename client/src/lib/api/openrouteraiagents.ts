import { logger } from "../logger";
/**
 * OpenRouter AI Agents API Integration
 * Módulo para interactuar con agentes de IA basados en OpenRouter
 */

// Colecciones de agentes por categoría
export const AGENT_COLLECTIONS = {
  MANAGERS: 'ai-agents-managers',
  MARKETERS: 'ai-agents-marketers',
  COMPOSERS: 'ai-agents-composers',
  SOCIAL_MEDIA: 'ai-agents-social-media',
  MERCHANDISE: 'ai-agents-merchandise'
};

// Definimos la clase OpenRouterService para el cliente
export class OpenRouterService {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  
  constructor() {
    // Usamos la variable de entorno para la clave API
    this.apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || "";
    this.baseUrl = "https://openrouter.ai/api/v1/chat/completions";
    this.defaultModel = "anthropic/claude-3-haiku";
    
    if (!this.apiKey) {
      logger.warn("⚠️ OpenRouter API key not found. AI responses won't work correctly.");
    }
  }
  
  /**
   * Genera una respuesta de IA utilizando el contexto proporcionado
   * @param prompt El mensaje o pregunta para generar la respuesta
   * @param context Contexto adicional (personalidad, intereses, etc.)
   * @param language Idioma preferido (es o en)
   * @returns La respuesta generada por la IA
   */
  async generateResponse(prompt: string, context?: string, language: string = "en"): Promise<string> {
    // Esta es la versión del cliente que utiliza fetch del navegador
    try {
      if (!this.apiKey) {
        return this.getFallbackResponse(language);
      }
      
      // En el cliente, redirigimos a nuestro propio backend para proteger la clave API
      const response = await fetch("/api/openrouter/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          context,
          language
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Error en API (${response.status}): ${errorText}`);
        return this.getFallbackResponse(language);
      }
      
      const data = await response.json();
      return data.response || this.getFallbackResponse(language);
      
    } catch (error) {
      logger.error("Error generating AI response:", error);
      return this.getFallbackResponse(language);
    }
  }
  
  /**
   * Devuelve una respuesta alternativa en caso de que la API falle
   */
  private getFallbackResponse(language: string = "en"): string {
    // Respuestas genéricas según el idioma
    const fallbackResponses = {
      es: [
        "Lo siento, no puedo responder ahora mismo. Intentémoslo más tarde.",
        "Parece que hay un problema técnico. ¿Podemos continuar esta conversación más tarde?",
        "Estoy procesando mucha información en este momento. Dame un momento para pensar."
      ],
      en: [
        "I'm sorry, I can't respond right now. Let's try again later.",
        "There seems to be a technical issue. Can we continue this conversation later?",
        "I'm processing a lot of information right now. Give me a moment to think."
      ]
    };
    
    const validLanguage = language === "es" ? "es" : "en";
    const responses = fallbackResponses[validLanguage];
    const randomIndex = Math.floor(Math.random() * responses.length);
    
    return responses[randomIndex];
  }
}

// Exportamos una instancia única del servicio
export const openRouterService = new OpenRouterService();

/**
 * Obtiene la lista de agentes de una colección específica
 * @param collectionName Nombre de la colección en Firestore
 * @returns Array de agentes
 */
export async function getAgents(collectionName: string) {
  try {
    // Importamos las funciones de Firestore de forma dinámica
    const { db } = await import('../firebase'); // Cambiado de @/firebase a ruta relativa
    const { collection, getDocs } = await import('firebase/firestore');
    
    // Obtenemos los documentos de la colección
    const querySnapshot = await getDocs(collection(db, collectionName));
    
    // Convertimos los documentos a objetos
    const agents = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return agents;
  } catch (error) {
    logger.error(`Error al obtener agentes de ${collectionName}:`, error);
    return [];
  }
}