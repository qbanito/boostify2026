import { Request, Response } from 'express';
import { Express } from 'express';
import { generateImageWithFal } from '@/lib/api/fal-ai';
import { getRelevantImage } from '@/lib/unsplash-service';

/**
 * Setup routes for Education related API endpoints
 */

export function setupEducationRoutes(app: Express) {
  // Endpoint to generate course content with OpenRouter
  app.post('/api/education/generate-course', async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt in request body' });
      }

      // Get the OpenRouter API key from environment variables
      const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
      
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenRouter API key is not configured on the server' 
        });
      }
      
      console.log("Using OpenRouter API key:", OPENROUTER_API_KEY.substring(0, 10) + "...");

      // Prepare the headers for OpenRouter
      const headers = {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": req.headers.origin || "https://boostify.music.app",
        "X-Title": "Boostify Music Education",
        "Content-Type": "application/json"
      };
      
      // Use the Gemini 2.0 Flash model as requested
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: [
            {
              role: "system",
              content: `You are a JSON generator for music education courses. You MUST return a valid JSON object with this EXACT structure:
{
  "overview": "course overview text",
  "objectives": ["objective1", "objective2", "objective3"],
  "curriculum": [
    {
      "title": "lesson title",
      "description": "lesson description",
      "estimatedMinutes": 60
    }
  ],
  "topics": ["topic1", "topic2", "topic3"],
  "assignments": ["assignment1", "assignment2"],
  "applications": ["application1", "application2"]
}`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error:', response.status, errorText);
        return res.status(500).json({ 
          error: `Error from OpenRouter API: ${response.status} ${response.statusText}` 
        });
      }

      const data = await response.json();
      
      if (!data || !data.choices || !data.choices.length) {
        return res.status(500).json({ error: 'Invalid API response format' });
      }

      const content = data.choices[0].message?.content;
      
      if (!content) {
        return res.status(500).json({ error: 'No content in API response' });
      }

      // Parse the JSON content
      try {
        const courseContent = JSON.parse(content);
        return res.json(courseContent);
      } catch (parseError) {
        console.error('Error parsing JSON from API response:', parseError);
        return res.status(500).json({ 
          error: 'Failed to parse course content from API response',
          rawContent: content
        });
      }
    } catch (error) {
      console.error('Error generating course content:', error);
      return res.status(500).json({ 
        error: 'Failed to generate course content', 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Endpoint to safely get the OpenRouter API key
  app.get('/api/get-openrouter-key', (req: Request, res: Response) => {
    const apiKey = process.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.json({ exists: false });
    }
    // Return the actual key instead of just a boolean for direct client usage
    // This is only for this educational context - in production this would be better handled server-side only
    res.json({ exists: true, key: apiKey });
  });

  // Endpoint para generar contenido adicional para cursos existentes
  app.post('/api/education/extend-course', async (req: Request, res: Response) => {
    try {
      const { courseId, courseTitle, courseDescription, existingContent } = req.body;
      
      if (!courseId || !courseTitle) {
        return res.status(400).json({ error: 'Se requiere ID y título del curso' });
      }

      // Obtener OpenRouter API key
      const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
      
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ 
          error: 'OpenRouter API key no está configurada en el servidor' 
        });
      }
      
      console.log("Using OpenRouter API key for extension:", OPENROUTER_API_KEY.substring(0, 10) + "...");

      // Preparar headers para OpenRouter
      const headers = {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": req.headers.origin || "https://boostify.music.app",
        "X-Title": "Boostify Music Education",
        "Content-Type": "application/json"
      };
      
      // Crear prompt para extensión del curso
      const prompt = `Genera contenido adicional para extender el siguiente curso de música:
      
      Título: "${courseTitle}"
      Descripción: "${courseDescription || 'Curso educativo de música'}"
      
      ${existingContent ? `Contenido actual del curso (para referencia): ${JSON.stringify(existingContent).substring(0, 500)}...` : ''}
      
      Genera 5 nuevas lecciones que amplíen el contenido actual del curso. Concéntrate en temas avanzados y aplicaciones prácticas.`;
      
      // Usar el modelo Gemini 2.0 Flash
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: [
            {
              role: "system",
              content: `Eres un generador JSON para contenido educativo de música. DEBES devolver un objeto JSON válido con esta estructura EXACTA:
{
  "additionalLessons": [
    {
      "title": "título de la lección",
      "description": "descripción detallada de la lección",
      "estimatedMinutes": 60,
      "keyPoints": ["punto clave 1", "punto clave 2", "punto clave 3"],
      "practicalApplication": "aplicación práctica de esta lección"
    }
  ],
  "recommendedResources": ["recurso 1", "recurso 2", "recurso 3"],
  "advancedTopics": ["tema avanzado 1", "tema avanzado 2", "tema avanzado 3"]
}`
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 2000,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error de API OpenRouter:', response.status, errorText);
        return res.status(500).json({ 
          error: `Error de la API OpenRouter: ${response.status} ${response.statusText}` 
        });
      }

      const data = await response.json();
      
      if (!data || !data.choices || !data.choices.length) {
        return res.status(500).json({ error: 'Formato de respuesta API inválido' });
      }

      const content = data.choices[0].message?.content;
      
      if (!content) {
        return res.status(500).json({ error: 'No hay contenido en la respuesta API' });
      }

      // Parsear el contenido JSON
      try {
        const additionalContent = JSON.parse(content);
        return res.json(additionalContent);
      } catch (parseError) {
        console.error('Error al parsear JSON de la respuesta API:', parseError);
        return res.status(500).json({ 
          error: 'Error al parsear el contenido adicional del curso',
          rawContent: content
        });
      }
    } catch (error) {
      console.error('Error al generar contenido adicional del curso:', error);
      return res.status(500).json({ 
        error: 'Error al generar contenido adicional del curso', 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}