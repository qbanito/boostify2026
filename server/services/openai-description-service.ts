/**
 * Servicio de OpenAI para mejorar descripciones de músicos
 * Reemplaza gemini-description-service
 * Migrado de Gemini a OpenAI para mayor eficiencia
 */
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

export async function enhanceMusicianDescription(
  name: string,
  instrument: string,
  category: string,
  currentDescription: string
): Promise<string> {
  try {
    const prompt = `You are a professional music industry copywriter. Enhance the following musician description to make it more engaging, professional, and compelling for potential clients.

Musician Name: ${name}
Instrument/Category: ${instrument} (${category})
Current Description: ${currentDescription}

Requirements:
- Keep it concise (2-3 sentences, maximum 150 characters)
- Highlight expertise and unique selling points
- Use professional, engaging language
- Focus on experience, style, and value proposition
- DO NOT add fictional achievements or credentials
- Maintain the core information from the original description

Enhanced Description:`;

    console.log('✏️ Enhancing description with OpenAI GPT-4o-mini...');

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL, // Usamos mini para descripciones cortas (más económico)
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7,
    });

    const enhancedText = response.choices[0]?.message?.content?.trim() || "";
    
    if (!enhancedText) {
      throw new Error('No enhanced description generated');
    }

    console.log('✅ Description enhanced successfully');
    return enhancedText;
  } catch (error) {
    console.error('Error enhancing description with OpenAI:', error);
    throw new Error('Failed to enhance description');
  }
}
