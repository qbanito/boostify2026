/**
 * AI Fallback Utility
 * Wraps text generation functions with automatic OpenRouter free-model fallback.
 * When the primary AI provider (OpenAI, Gemini) fails, this tries OpenRouter free models.
 *
 * Usage:
 *   const result = await withTextFallback(
 *     () => openai.chat.completions.create(...),
 *     { prompt: "...", systemPrompt: "...", maxTokens: 800 }
 *   );
 */

import { openRouterService } from '../services/openrouter-service';
import type { TextFallbackOptions } from '../services/openrouter-service';

export interface FallbackTextOptions extends TextFallbackOptions {
  /** The user prompt to send to the fallback model */
  prompt: string;
  /** Fallback label for logging (e.g., 'generateArtistBio') */
  label?: string;
}

/**
 * Wraps any text-generation call with OpenRouter free-model fallback.
 * - Calls `primaryFn` first
 * - If it throws or returns null/undefined, calls OpenRouter free cascade
 * - If OpenRouter also fails, returns `fallbackValue` (default: null)
 *
 * @param primaryFn Async function that returns a string or null
 * @param options FallbackTextOptions with prompt, systemPrompt, etc.
 * @param fallbackValue Value to return when everything fails
 */
export async function withTextFallback<T extends string | null>(
  primaryFn: () => Promise<T>,
  options: FallbackTextOptions,
  fallbackValue: T | null = null
): Promise<T | string | null> {
  const label = options.label || 'ai-text';

  try {
    const result = await primaryFn();
    if (result) return result;
    // Primary returned empty/null — fall through to OpenRouter
    console.warn(`[AI Fallback] ${label}: primary returned empty, trying OpenRouter...`);
  } catch (primaryError) {
    console.warn(
      `[AI Fallback] ${label}: primary failed (${primaryError instanceof Error ? primaryError.message : 'unknown'}), trying OpenRouter...`
    );
  }

  // Try OpenRouter free models
  const openRouterResult = await openRouterService.generateTextFallback(options.prompt, {
    maxTokens: options.maxTokens || 800,
    temperature: options.temperature || 0.7,
    systemPrompt: options.systemPrompt,
    returnNullOnFailure: true,
  });

  if (openRouterResult) {
    console.log(`[AI Fallback] ${label}: ✅ OpenRouter fallback succeeded`);
    return openRouterResult;
  }

  console.error(`[AI Fallback] ${label}: All providers failed, returning fallback value`);
  return fallbackValue;
}

/**
 * Checks whether the OpenRouter fallback is available (API key is configured)
 */
export function isOpenRouterFallbackAvailable(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY);
}
