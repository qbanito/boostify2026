import { openai } from "../openai";
import { logger } from "../logger";
import { getAuthToken } from "../firebase";

interface TranslationRequest {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
  confidence?: number;
}

export async function translateText({ text, targetLanguage, sourceLanguage }: TranslationRequest): Promise<TranslationResponse> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    // First try to use our backend translation endpoint
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text,
          targetLanguage,
          sourceLanguage
        })
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      logger.warn('Backend translation failed, falling back to OpenAI:', error);
    }

    // Fallback to OpenAI for translation
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text to ${targetLanguage}. Only respond with the translation, no additional text.`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const translatedText = completion.choices[0]?.message?.content || '';

    return {
      translatedText,
      detectedLanguage: sourceLanguage || 'auto',
      confidence: 0.9
    };
  } catch (error: any) {
    logger.error('Translation error:', error);
    throw new Error(error.message || 'Failed to translate text');
  }
}

export async function detectLanguage(text: string): Promise<string> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    // First try our backend endpoint
    try {
      const response = await fetch('/api/detect-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const { language } = await response.json();
        return language;
      }
    } catch (error) {
      logger.warn('Backend language detection failed, falling back to OpenAI:', error);
    }

    // Fallback to OpenAI for language detection
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a language detection expert. Analyze the following text and respond only with the ISO 639-1 language code (e.g., 'en' for English, 'es' for Spanish). Only respond with the code, no additional text."
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const detectedLanguage = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'en';
    return detectedLanguage;

  } catch (error: any) {
    logger.error('Language detection error:', error);
    throw new Error(error.message || 'Failed to detect language');
  }
}