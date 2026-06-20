/**
 * API Usage Logger
 * Registra y rastrea el consumo de APIs
 */

import { db } from '../db';
import { apiUsageLog } from '../db/schema';
import { calculateApiCost } from './api-pricing';

export interface ApiLogInput {
  userId?: number | null;
  apiProvider: 'openai' | 'gemini' | 'fal' | 'anthropic' | 'piapi' | 'openrouter' | 'shotstack' | 'brevo' | 'apify' | 'stripe' | 'other';
  endpoint: string;
  model?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  responseTime?: number;
  status?: 'success' | 'error' | 'rate_limited';
  errorMessage?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Registra una llamada a API
 */
export async function logApiUsage(input: ApiLogInput): Promise<any> {
  try {
    const promptTokens = input.promptTokens || 0;
    const completionTokens = input.completionTokens || input.totalTokens || 0;
    
    // Calcular costo
    const estimatedCost = calculateApiCost(
      input.apiProvider,
      input.model,
      promptTokens,
      completionTokens
    );
    
    // Registrar en base de datos
    const result = await db.insert(apiUsageLog).values({
      userId: input.userId || null,
      apiProvider: input.apiProvider,
      endpoint: input.endpoint,
      model: input.model || null,
      tokensUsed: (promptTokens + completionTokens) || 0,
      promptTokens: promptTokens,
      completionTokens: completionTokens,
      estimatedCost: estimatedCost.toString(),
      responseTime: input.responseTime || null,
      status: input.status || 'success',
      errorMessage: input.errorMessage || null,
      metadata: input.metadata || null
    }).returning();
    
    console.log(`✅ API Usage logged: ${input.apiProvider} - ${input.model} - ${estimatedCost.toFixed(6)} - User: ${input.userId || 'anonymous'}`);
    
    return result[0];
  } catch (error) {
    console.error('❌ Error logging API usage:', error);
    return null;
  }
}

/**
 * Registra múltiples llamadas en batch
 */
export async function logApiUsageBatch(inputs: ApiLogInput[]): Promise<any[]> {
  const results = await Promise.all(
    inputs.map(input => logApiUsage(input))
  );
  return results.filter(r => r !== null);
}

/**
 * Extrae tokens de respuesta de OpenAI
 */
export function extractOpenAITokens(response: any): { promptTokens: number; completionTokens: number } {
  try {
    return {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0
    };
  } catch {
    return { promptTokens: 0, completionTokens: 0 };
  }
}

/**
 * Extrae tokens de respuesta de Gemini
 */
export function extractGeminiTokens(response: any): { promptTokens: number; completionTokens: number } {
  try {
    return {
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount || 0
    };
  } catch {
    return { promptTokens: 0, completionTokens: 0 };
  }
}

/**
 * Extrae tokens de respuesta de Anthropic
 */
export function extractAnthropicTokens(response: any): { promptTokens: number; completionTokens: number } {
  try {
    return {
      promptTokens: response.usage?.input_tokens || 0,
      completionTokens: response.usage?.output_tokens || 0
    };
  } catch {
    return { promptTokens: 0, completionTokens: 0 };
  }
}
