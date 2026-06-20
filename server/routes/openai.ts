import { Request, Response } from 'express';
import { Express } from 'express';
import fetch from 'node-fetch';
import { logApiUsage } from '../utils/api-logger';
import { calculateApiCost } from '../utils/api-pricing';

// Configuración de OpenRouter
// Eliminamos espacios en blanco extra que puedan estar en la clave API
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Configura las rutas para OpenAI/OpenRouter
 */
export function setupOpenAIRoutes(app: Express) {
  /**
   * Route for generating chat completions
   * No requerimos autenticación aquí ya que es una API interna y la clave está en el backend
   */
  app.post('/api/chat/completions', async (req: Request, res: Response) => {
    try {
      const { messages, model = 'anthropic/claude-3-haiku', temperature = 0.7 } = req.body;

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OpenRouter API key is not configured on the server' });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      console.log('Making request to OpenRouter with model:', model);
      console.log('Messages length:', messages.length);

      // Log complete request details for debugging
      console.log('OpenRouter API Request:', {
        url: `${BASE_URL}/chat/completions`,
        model,
        messagesCount: messages.length,
        apiKeyPresent: !!OPENROUTER_API_KEY,
      });
      
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': req.headers.referer || 'https://boostify-music.app',
          'X-Title': 'Boostify Music Assistant',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error details:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        return res.status(response.status).json({ 
          error: `OpenRouter API error: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }

      const data = await response.json();
      
      // Log API usage
      if (data.usage) {
        await logApiUsage({
          apiProvider: 'openai',
          endpoint: '/chat/completions',
          model: model || 'anthropic/claude-3-haiku',
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          status: 'success'
        });
      }
      
      return res.json(data);
    } catch (error) {
      console.error('Error in chat completion endpoint:', error);
      
      // Log API error
      await logApiUsage({
        apiProvider: 'openai',
        endpoint: '/chat/completions',
        model: model || 'anthropic/claude-3-haiku',
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  /**
   * Manager Tools Content Generation Endpoint
   * This endpoint receives requests from the client and proxies them to OpenRouter
   * with proper server-side authentication
   */
  app.post('/api/manager/generate-content', async (req: Request, res: Response) => {
    try {
      const { prompt, type } = req.body;

      if (!prompt || !type) {
        return res.status(400).json({ error: 'Prompt and type are required' });
      }

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: 'OpenRouter API key is not configured on the server' });
      }

      console.log(`Generating ${type} content with prompt:`, prompt);

      // Prepare system prompt based on content type
      let systemPrompt;
      let modelToUse = "anthropic/claude-3-sonnet"; // Default model
      let maxTokens = 2000; // Default max tokens
      
      switch (type) {
        case 'technical':
          systemPrompt = `You are an expert sound engineer specialized in creating technical riders for music artists. 
          Create comprehensive, well-structured technical riders that include:
          1. Sound equipment requirements (PA systems, microphones, monitors, etc.)
          2. Lighting requirements
          3. Stage setup and backline details
          4. Power requirements
          5. Special requirements or artist preferences
          
          Format the response with clear sections, headings, and organize the information logically for venue staff.`;
          break;
          
        case 'requirements':
          systemPrompt = `You are an artist management specialist who creates detailed requirements lists for music artists. 
          Generate comprehensive, well-structured requirement documents that cover:
          1. Hospitality requirements (food, beverages, green room setup)
          2. Accommodation preferences and standards
          3. Transportation needs
          4. Security requirements
          5. Personnel needs
          6. Special requests and preferences
          
          Format the response with clear sections, tables when appropriate, and professional, diplomatic language.`;
          break;
          
        case 'budget':
          systemPrompt = `You are a financial manager for music industry projects. 
          Create detailed, well-structured budget breakdowns with:
          1. Clear categorization of expenses
          2. Line-item details with estimated costs
          3. Contingency allocations
          4. Revenue projections when applicable
          5. Summary totals and key financial metrics
          
          Format the response with professional tables and sections that would be suitable for presentation to stakeholders.`;
          break;
          
        case 'logistics':
          systemPrompt = `You are a logistics coordinator for music tours and events. 
          Create detailed logistics plans that include:
          1. Transportation schedules and details
          2. Equipment handling procedures
          3. Accommodation arrangements
          4. Timeline with key milestones and deadlines
          5. Personnel assignments and responsibilities
          6. Contingency plans for common issues
          
          Format the response with clear chronological organization, tables for schedules, and practical, actionable details.`;
          break;
          
        case 'hiring':
          systemPrompt = `You are a human resources specialist for the music industry. 
          Create professional job descriptions that include:
          1. Clear job titles and reporting structure
          2. Detailed responsibilities and duties
          3. Required qualifications and experience
          4. Preferred skills and knowledge
          5. Music industry-specific requirements
          
          Format each position with clear sections and use industry-standard terminology appropriate for music business professionals.`;
          break;
          
        case 'calendar':
          systemPrompt = `You are an event planning and scheduling specialist for the music industry. 
          Create detailed schedule plans that include:
          1. Day-by-day or hour-by-hour timelines
          2. Specific assignments and responsibilities
          3. Location details and logistics considerations
          4. Setup and breakdown times
          5. Buffer periods and contingency planning
          
          Format the response with clear chronological organization, easy-to-scan time blocks, and practical details for all team members.`;
          break;
          
        case 'ai':
          systemPrompt = `You are an AI music industry consultant providing expert insights and recommendations. 
          Generate thoughtful analysis that includes:
          1. Strategic recommendations based on industry best practices
          2. Actionable steps tailored to the specific situation
          3. Alternative approaches with pros and cons
          4. Resources and tools that might be helpful
          5. Timeline considerations for implementation
          
          Present your insights in a clear, structured format with sections and bullet points for easy reference.`;
          break;
          
        default:
          systemPrompt = `You are an expert AI assistant specialized in ${type} management for music artists and events. Provide detailed, well-structured responses.`;
      }
      
      // For longer content types, increase max tokens
      if (['technical', 'budget', 'logistics'].includes(type)) {
        maxTokens = 3000;
      }
      
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': req.headers.referer || 'https://boostify-music.app',
          'X-Title': 'Boostify Music Manager Tools',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: maxTokens
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouter API error details:', {
          status: response.status,
          statusText: response.statusText,
          errorText
        });
        
        return res.status(response.status).json({ 
          error: `OpenRouter API error: ${response.status} ${response.statusText}`,
          details: errorText
        });
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        return res.status(500).json({ error: 'Invalid response format from OpenRouter' });
      }
      
      return res.json({ content: data.choices[0].message.content });
    } catch (error) {
      console.error('Error in manager content generation endpoint:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
}