import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createTrackedOpenAI } from '../utils/tracked-openai';

const router = Router();
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post('/translate', authenticate, async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    let prompt = sourceLanguage
      ? `Translate this text from ${sourceLanguage} to ${targetLanguage}:\n${text}`
      : `Translate this text to ${targetLanguage}:\n${text}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional translator. Provide accurate translations while maintaining the original meaning and context."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    const translatedText = completion.choices[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('Translation failed');
    }

    res.json({
      translatedText,
      confidence: 0.95 // Placeholder confidence score
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ error: error.message || 'Translation failed' });
  }
});

router.post('/detect-language', authenticate, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a language detection system. Respond only with the ISO 639-1 language code of the input text."
        },
        {
          role: "user",
          content: `Detect the language of this text:\n${text}`
        }
      ],
      temperature: 0,
      max_tokens: 10
    });

    const language = completion.choices[0]?.message?.content?.trim();

    if (!language) {
      throw new Error('Language detection failed');
    }

    res.json({ language });
  } catch (error: any) {
    console.error('Language detection error:', error);
    res.status(500).json({ error: error.message || 'Language detection failed' });
  }
});

export default router;