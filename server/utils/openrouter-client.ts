/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OpenRouter Client — Drop-in OpenAI-compatible client for OpenRouter
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * OpenRouter uses the same API format as OpenAI, so we can use the OpenAI SDK
 * with a different baseURL. This module creates a pre-configured client.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import OpenAI from 'openai';
import {
  OPENROUTER_API_KEY,
  OPENROUTER_BASE_URL,
  OPENAI_API_KEY,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  isOpenRouterConfigured,
  isOpenAIFallbackConfigured,
} from './ai-config';

// ─── Singleton clients ────────────────────────────────────────────────────────

let _openrouterClient: OpenAI | null = null;
let _openaiFallbackClient: OpenAI | null = null;

/**
 * Get the OpenRouter client (primary). Creates one if it doesn't exist.
 */
export function getOpenRouterClient(): OpenAI {
  if (!_openrouterClient) {
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }
    _openrouterClient = new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://boostifymusic.com',
        'X-Title': 'Boostify Music',
      },
    });
  }
  return _openrouterClient;
}

/**
 * Get the OpenAI fallback client. Creates one if it doesn't exist.
 */
export function getOpenAIFallbackClient(): OpenAI {
  if (!_openaiFallbackClient) {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured for fallback');
    }
    _openaiFallbackClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }
  return _openaiFallbackClient;
}

// ─── Smart completion with automatic fallback ─────────────────────────────────

export interface SmartCompletionOptions {
  /** The messages array for chat completion */
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  /** Model override (defaults to PRIMARY_MODEL) */
  model?: string;
  /** Max tokens to generate */
  max_tokens?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Response format (e.g., { type: 'json_object' }) */
  response_format?: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming['response_format'];
  /** Whether to stream the response */
  stream?: boolean;
  /** Additional parameters to pass to the API */
  [key: string]: any;
}

/**
 * Create a chat completion using OpenRouter (primary) with OpenAI fallback.
 *
 * Usage:
 *   const result = await smartCompletion({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   });
 *   console.log(result.choices[0].message.content);
 */
export async function smartCompletion(
  options: SmartCompletionOptions
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const {
    messages,
    model = PRIMARY_MODEL,
    max_tokens,
    temperature,
    response_format,
    stream,
    ...rest
  } = options;

  const completionParams: any = {
    model,
    messages,
    ...(max_tokens !== undefined && { max_tokens }),
    ...(temperature !== undefined && { temperature }),
    ...(response_format && { response_format }),
    ...rest,
  };

  // Try OpenRouter first
  if (isOpenRouterConfigured()) {
    try {
      const client = getOpenRouterClient();
      return await client.chat.completions.create(completionParams) as OpenAI.Chat.Completions.ChatCompletion;
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const msg = err?.message || '';

      // Only fallback on server errors or rate limits — not on client errors
      const shouldFallback =
        status === 429 || // Rate limited
        status === 500 || status === 502 || status === 503 || // Server errors
        msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed');

      if (!shouldFallback) {
        throw err; // Client error (400, 401, 403, etc.) — don't fallback
      }

      console.warn(`⚠️ [AI] OpenRouter failed (${status || msg}), falling back to OpenAI...`);
    }
  }

  // Fallback to OpenAI
  if (isOpenAIFallbackConfigured()) {
    const fallbackParams = { ...completionParams };
    // Use fallback model if the primary model was MiMo
    if (model === PRIMARY_MODEL) {
      fallbackParams.model = FALLBACK_MODEL;
    }

    const client = getOpenAIFallbackClient();
    return await client.chat.completions.create(fallbackParams) as OpenAI.Chat.Completions.ChatCompletion;
  }

  throw new Error(
    'No AI provider available. Set OPENROUTER_API_KEY (primary) or OPENAI_API_KEY (fallback).'
  );
}

/**
 * Create a streaming chat completion using OpenRouter (primary) with OpenAI fallback.
 */
export async function smartCompletionStream(
  options: SmartCompletionOptions
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const {
    messages,
    model = PRIMARY_MODEL,
    max_tokens,
    temperature,
    response_format,
    ...rest
  } = options;

  const completionParams: any = {
    model,
    messages,
    stream: true,
    ...(max_tokens !== undefined && { max_tokens }),
    ...(temperature !== undefined && { temperature }),
    ...(response_format && { response_format }),
    ...rest,
  };

  // Try OpenRouter first
  if (isOpenRouterConfigured()) {
    try {
      const client = getOpenRouterClient();
      return await client.chat.completions.create(completionParams) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const shouldFallback = status === 429 || status >= 500;
      if (!shouldFallback) throw err;
      console.warn(`⚠️ [AI] OpenRouter stream failed, falling back to OpenAI...`);
    }
  }

  // Fallback to OpenAI
  if (isOpenAIFallbackConfigured()) {
    const fallbackParams = { ...completionParams };
    if (model === PRIMARY_MODEL) {
      fallbackParams.model = FALLBACK_MODEL;
    }
    const client = getOpenAIFallbackClient();
    return await client.chat.completions.create(fallbackParams) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  }

  throw new Error('No AI provider available for streaming.');
}
