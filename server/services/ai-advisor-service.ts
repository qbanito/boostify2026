/**
 * AI Advisor Chat Service
 * Provides real-time chat with AI advisors powered by OpenAI
 */
import { createTrackedOpenAI } from '../utils/tracked-openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

export interface AdvisorChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ArtistData {
  artistName: string;
  genre?: string;
  genres?: string[];
  biography?: string;
  style?: string;
  songs?: Array<{
    title: string;
    genre?: string;
    mood?: string;
  }>;
}

export interface AdvisorChatOptions {
  advisorId: string;
  messages: AdvisorChatMessage[];
  userId?: string;
  artistId?: number;
  artistData?: ArtistData | null;
}

/**
 * Get chat completion from OpenAI for AI advisor
 */
export async function getAdvisorChatResponse(options: AdvisorChatOptions): Promise<{
  message: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  try {
    if (!openai.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const artistInfo = options.artistData 
      ? ` for artist "${options.artistData.artistName}" (${options.artistData.genres?.join(', ') || options.artistData.genre || 'unknown genre'})`
      : '';
    
    console.log(`🤖 AI Advisor ${options.advisorId} responding${artistInfo}...`);

    const messages: ChatCompletionMessageParam[] = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await Promise.race([
      openai.chat.completions.create({
        model: PRIMARY_MODEL, // Using gpt-4o-mini for faster, cost-effective responses
        messages,
        max_tokens: 1024,
        temperature: 0.8, // Slightly higher for more conversational responses
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OpenAI API timeout after 30 seconds')), 30000)
      )
    ]);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    console.log(`✅ AI Advisor ${options.advisorId} responded successfully`);

    return {
      message: content,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  } catch (error: any) {
    console.error(`❌ AI Advisor error:`, error.message);
    throw error;
  }
}

/**
 * Validate advisor ID exists
 */
export function isValidAdvisorId(advisorId: string): boolean {
  const validAdvisors = [
    'publicist',
    'manager', 
    'producer',
    'creative',
    'business',
    'marketing',
    'lawyer',
    'support',
    'analytics',
    'strategist',
  ];
  return validAdvisors.includes(advisorId);
}
