/**
 * Instrumented OpenAI-compatible client factory
 * Auto-logs every chat.completions.create call to the api_usage_log table
 *
 * DEFAULT: Uses OpenRouter (Xiaomi MiMo v2.5 Pro) as primary model.
 * Pass { apiKey: process.env.OPENAI_API_KEY } to use OpenAI directly.
 */
import OpenAI from 'openai';
import { logApiUsage } from './api-logger';
import { OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENAI_API_KEY, PRIMARY_MODEL, FALLBACK_MODEL } from './ai-config';

/**
 * Creates an OpenAI-compatible client that automatically logs usage to api_usage_log.
 * Drop-in replacement for `new OpenAI(...)`.
 *
 * When called WITHOUT opts → uses OpenRouter (MiMo primary).
 * When called WITH opts → uses the provided config (backward compat).
 */
export function createTrackedOpenAI(opts?: ConstructorParameters<typeof OpenAI>[0]): OpenAI {
  // If no options provided, default to OpenRouter
  const resolvedOpts = opts ?? (OPENROUTER_API_KEY
    ? { apiKey: OPENROUTER_API_KEY, baseURL: OPENROUTER_BASE_URL, defaultHeaders: { 'HTTP-Referer': 'https://boostifymusic.com', 'X-Title': 'Boostify Music' } }
    : { apiKey: OPENAI_API_KEY });

  const client = new OpenAI(resolvedOpts);

  // Wrap chat.completions.create
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  (client.chat.completions as any).create = async function trackedCreate(
    body: any,
    options?: any
  ) {
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | null = null;
    let result: any;

    try {
      result = await originalCreate(body, options);
      return result;
    } catch (err: any) {
      status = 'error';
      errorMessage = err?.message || 'Unknown error';
      throw err;
    } finally {
      const elapsed = Date.now() - startTime;
      const usage = result?.usage;
      const model = result?.model || body?.model || 'unknown';

      // Detect provider from baseURL
      const baseURL = (resolvedOpts as any)?.baseURL || '';
      let provider: 'openai' | 'openrouter' | 'anthropic' | 'other' = 'openai';
      if (baseURL.includes('openrouter')) provider = 'openrouter';

      logApiUsage({
        apiProvider: provider,
        endpoint: 'chat.completions.create',
        model,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || usage?.total_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        responseTime: elapsed,
        status,
        errorMessage,
        metadata: { source: 'tracked-openai' },
      }).catch(() => {}); // fire-and-forget
    }
  };

  return client;
}

/**
 * Default tracked instance — uses OpenRouter (MiMo) when available,
 * falls back to OpenAI. Import this for simple usage.
 */
export const trackedOpenAI = createTrackedOpenAI();
