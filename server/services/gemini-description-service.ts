import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });
    const enhancedText = result.text.trim();

    return enhancedText;
  } catch (error) {
    console.error('Error enhancing description with Gemini:', error);
    throw new Error('Failed to enhance description');
  }
}
