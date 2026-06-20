/**
 * Servicio de Gemini para generación de contenido de perfil de artistas
 * Genera biografías profesionales basadas en información del artista
 */
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export interface ArtistInfo {
  name?: string;
  genre?: string;
  location?: string;
  experience?: string;
  achievements?: string;
  influences?: string;
  /** Song titles and lyrics to weave into the biography narrative */
  songContext?: Array<{ title: string; lyrics?: string; mood?: string }>;
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
 * Genera una biografía profesional de artista usando Gemini
 */
export async function generateArtistBiography(artistInfo: ArtistInfo): Promise<BiographyResult> {
  try {
    const { name, genre, location, experience, achievements, influences, songContext } = artistInfo;

    // Build song context block if available
    let songBlock = '';
    if (songContext && songContext.length > 0) {
      const songDetails = songContext.map((s, i) => {
        let detail = `  Song ${i + 1}: "${s.title}"`;
        if (s.mood) detail += ` (mood: ${s.mood})`;
        if (s.lyrics) {
          // Extract clean lyrics (remove section tags and audio descriptions)
          const cleanLyrics = s.lyrics
            .split('\n')
            .filter(line => !line.startsWith('[[') && !line.startsWith('[0') && !line.startsWith('[:') && !line.startsWith('mosic') && !line.startsWith('bpm') && !line.startsWith('duration') && !line.startsWith('good_crop') && line.trim().length > 0)
            .slice(0, 8) // Max 8 lines per song
            .join('\n    ');
          if (cleanLyrics) detail += `\n    Lyrics excerpt:\n    ${cleanLyrics}`;
        }
        return detail;
      }).join('\n');
      songBlock = `\n\nSONGS AND LYRICS (use these to build a coherent narrative — reference themes, emotions, and stories from the lyrics):\n${songDetails}`;
    }

    // Construir prompt personalizado
    const prompt = `You are an elite music biographer who creates immersive, creative artist stories.
Write a compelling, professional artist biography in Spanish (250-350 words) that reads like a mini-documentary narrative.

Artist Name: ${name || 'Unknown Artist'}
Genre: ${genre || 'Various genres'}
Location: ${location || 'Location not specified'}
${experience ? `Experience: ${experience}` : ''}
${achievements ? `Achievements: ${achievements}` : ''}
${influences ? `Influences: ${influences}` : ''}${songBlock}

Guidelines:
- Write in third person with vivid, cinematic language
- Create a COHERENT STORY that connects the artist's background to their music
- If song lyrics are provided, weave their themes and emotions into the biography narrative
  (e.g., if a song talks about rain on the Malecón, mention the artist's connection to that place)
- Invent a compelling origin story that feels authentic to the genre and location
- Include specific details: a formative moment, a turning point, a creative philosophy
- Reference specific songs by name and describe what inspired them
- Make the reader feel like they KNOW this artist personally
- The biography should explain WHY the artist makes the music they make
- Use a tone that reflects the genre (poetic for bolero, street-smart for hip-hop, etc.)
- Write entirely in Spanish
- DO NOT include title or heading, just the biography text
- DO NOT use generic phrases like "artista prometedor" or "talentoso artista"

Generate the biography now:`;

    console.log('🎵 Generating artist biography with Gemini (with song context)...');
    console.log('📝 Artist info:', JSON.stringify({ name, genre, location, hasSongContext: !!songContext?.length }));

    const response = await Promise.race([
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      )
    ]);

    const biography = response.text?.trim() || "";
    
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
