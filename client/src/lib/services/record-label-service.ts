import OpenAI from 'openai';
import { logger } from "../logger";
import { env } from "../../env";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";

// No lanzar error si no hay API key - simplemente advertir
if (!env.VITE_OPENROUTER_API_KEY) {
  logger.warn('OpenRouter API key is not configured - AI features will be limited');
}

// Crear cliente solo si hay API key
const openai = env.VITE_OPENROUTER_API_KEY ? new OpenAI({
  apiKey: env.VITE_OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
    'X-Title': 'Boostify Music Manager',
  }
}) : null;

// Helper para verificar si AI está disponible
const checkAIAvailable = () => {
  if (!openai) {
    throw new Error('AI features require OpenRouter API key. Please configure VITE_OPENROUTER_API_KEY in your environment.');
  }
  return openai;
};

export const recordLabelService = {
  async generateRemix(track: string, style: string, userId: string) {
    try {
      const ai = checkAIAvailable();
      const prompt = `Generate a modern remix style guide for the track "${track}" in the style of ${style}. Include detailed instructions for tempo, key changes, arrangement modifications, and suggested modern elements to incorporate.`;

      const completion = await ai.chat.completions.create({
        model: "anthropic/claude-3-sonnet",
        messages: [
          {
            role: 'system',
            content: 'You are an expert music producer and remixer.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const remixInstructions = completion.choices[0].message.content;

      return this.saveToFirestore({
        type: 'remix',
        content: {
          track,
          style,
          remixInstructions
        },
        userId,
        createdAt: new Date(),
        status: 'completed'
      });

    } catch (error) {
      logger.error('Error generating remix:', error);
      throw error;
    }
  },

  async generateMaster(track: string, reference: string, userId: string) {
    try {
      const ai = checkAIAvailable();
      const prompt = `Create professional mastering instructions for the track "${track}" using "${reference}" as reference. Include specific recommendations for EQ, compression, limiting, and other mastering techniques.`;

      const completion = await ai.chat.completions.create({
        model: "anthropic/claude-3-sonnet",
        messages: [
          {
            role: 'system',
            content: 'You are an expert mastering engineer.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const masteringInstructions = completion.choices[0].message.content;

      return this.saveToFirestore({
        type: 'mastering',
        content: {
          track,
          reference,
          masteringInstructions
        },
        userId,
        createdAt: new Date(),
        status: 'completed'
      });

    } catch (error) {
      logger.error('Error generating mastering instructions:', error);
      throw error;
    }
  },

  async generateMusicVideo(track: string, style: string, userId: string) {
    try {
      const ai = checkAIAvailable();
      const prompt = `Create a detailed music video concept for "${track}" in the style of ${style}. Include scene descriptions, visual themes, transitions, and special effects recommendations.`;

      const completion = await ai.chat.completions.create({
        model: "anthropic/claude-3-sonnet",
        messages: [
          {
            role: 'system',
            content: 'You are an expert music video director.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const videoInstructions = completion.choices[0].message.content;

      return this.saveToFirestore({
        type: 'video',
        content: {
          track,
          style,
          videoInstructions
        },
        userId,
        createdAt: new Date(),
        status: 'completed'
      });

    } catch (error) {
      logger.error('Error generating video concept:', error);
      throw error;
    }
  },

  async saveToFirestore(data: RecordLabelService) {
    try {
      const docRef = await addDoc(collection(db, 'record_label_services'), {
        ...data,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      logger.error('Error saving to Firestore:', error);
      throw error;
    }
  },

  async getServices(userId: string, type?: string) {
    try {
      let q = query(
        collection(db, 'record_label_services'),
        where('userId', '==', userId)
      );

      if (type) {
        q = query(q, where('type', '==', type));
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.error('Error fetching services:', error);
      throw error;
    }
  }
};

interface RecordLabelService {
  type: 'remix' | 'mastering' | 'video' | 'publishing';
  content: any;
  userId: string;
  createdAt: Date;
  status: 'pending' | 'completed' | 'failed';
}

export default recordLabelService;