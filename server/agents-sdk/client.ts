/**
 * OpenAI Agents SDK - Shared Client
 * Singleton OpenAI client + SDK configuration.
 *
 * SDK agents (gpt-4.1-mini + tool calling) run on OPENAI DIRECT — native
 * agent models. If only OpenRouter is configured, we set a FULL custom
 * client (key + baseURL together) so auth stays consistent.
 * ⚠️ Never mix an OpenRouter key with the default api.openai.com base URL —
 * that combination 401s every SDK call.
 */
import { OpenAI } from "openai";
import { setDefaultOpenAIKey, setDefaultOpenAIClient, setTracingDisabled } from "@openai/agents";
import { OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENAI_API_KEY } from "../utils/ai-config";

let _client: OpenAI | null = null;
let _configured = false;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    // Prefer OpenRouter (MiMo primary)
    if (OPENROUTER_API_KEY) {
      _client = new OpenAI({
        apiKey: OPENROUTER_API_KEY,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          'HTTP-Referer': 'https://boostifymusic.com',
          'X-Title': 'Boostify Music',
        },
      });
    } else if (OPENAI_API_KEY) {
      _client = new OpenAI({ apiKey: OPENAI_API_KEY });
    } else {
      throw new Error("No AI provider configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY");
    }
  }
  return _client;
}

/** Call once at startup to configure the SDK defaults */
export function configureAgentsSDK() {
  if (_configured) return;
  if (OPENAI_API_KEY) {
    // Native path: agent models (gpt-4.1-mini) live on OpenAI
    setDefaultOpenAIKey(OPENAI_API_KEY);
  } else if (OPENROUTER_API_KEY) {
    // Consistent key+baseURL pair (bare key against api.openai.com would 401)
    setDefaultOpenAIClient(new OpenAI({
      apiKey: OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': 'https://boostifymusic.com',
        'X-Title': 'Boostify Music',
      },
    }) as any);
  }
  // Disable tracing export in dev (no OpenAI tracing backend needed)
  if (process.env.NODE_ENV !== "production") {
    setTracingDisabled(true);
  }
  _configured = true;
}
