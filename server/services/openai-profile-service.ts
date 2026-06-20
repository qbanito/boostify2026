/**
 * Servicio de OpenAI para generación de contenido de perfil de artistas
 * Reemplaza gemini-profile-service - Genera biografías profesionales basadas en información del artista
 * Migrado de Gemini a OpenAI para mayor eficiencia
 */
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

export interface ArtistInfo {
  name?: string;
  genre?: string;
  location?: string;
  experience?: string;
  achievements?: string;
  influences?: string;
}

export interface BiographyResult {
  success: boolean;
  biography?: string;
  error?: string;
}

export interface GenresResult {
  success: boolean;
  genres?: string[];
  error?: string;
}

/**
 * Genera una biografía profesional de artista usando OpenAI GPT-4o
 */
export async function generateArtistBiography(artistInfo: ArtistInfo): Promise<BiographyResult> {
  try {
    const { name, genre, location, experience, achievements, influences } = artistInfo;

    // Construir prompt personalizado
    const prompt = `You are a professional music biographer. Write a compelling, professional artist biography in Spanish (150-200 words) based on the following information:

Artist Name: ${name || 'Unknown Artist'}
Genre: ${genre || 'Various genres'}
Location: ${location || 'Location not specified'}
${experience ? `Experience: ${experience}` : ''}
${achievements ? `Achievements: ${achievements}` : ''}
${influences ? `Influences: ${influences}` : ''}

Guidelines:
- Write in third person
- Make it engaging and professional
- Highlight unique aspects of the artist
- Keep it concise but impactful
- Use a tone that reflects the genre
- Write entirely in Spanish
- DO NOT include title or heading, just the biography text

Generate the biography now:`;

    console.log('🎵 Generating artist biography with OpenAI GPT-4o...');
    console.log('📝 Artist info:', JSON.stringify(artistInfo));

    const response = await Promise.race([
      openai.chat.completions.create({
        model: PRIMARY_MODEL, // Usamos mini para biografías (más económico)
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      )
    ]);

    const biography = response.choices[0]?.message?.content?.trim() || "";
    
    if (!biography) {
      throw new Error('No biography text generated');
    }

    console.log('✅ Biography generated successfully:', biography.substring(0, 100) + '...');

    return {
      success: true,
      biography
    };

  } catch (error: any) {
    console.error('❌ Error generating biography:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Failed to generate biography'
    };
  }
}

/**
 * Sugiere géneros musicales basados en la descripción del artista
 */
export async function suggestGenres(description: string): Promise<GenresResult> {
  try {
    const prompt = `Based on this artist description, suggest 3-5 relevant music genres. Return ONLY a JSON array of strings with the genre names.

Description: ${description}

Return format: ["genre1", "genre2", "genre3"]`;

    console.log('🎵 Suggesting genres with OpenAI GPT-4o-mini...');

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content?.trim() || "[]";
    const genres = JSON.parse(content);

    return {
      success: true,
      genres
    };

  } catch (error: any) {
    console.error('❌ Error suggesting genres:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to suggest genres'
    };
  }
}
