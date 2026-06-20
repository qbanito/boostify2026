/**
 * OpenAI Agents SDK - Shared Client
 * Singleton OpenAI client + SDK configuration
 * Uses OpenRouter (MiMo v2.5 Pro) as primary, OpenAI as fallback
 */
import { OpenAI } from "openai";
import { setDefaultOpenAIKey, setTracingDisabled } from "@openai/agents";
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
  // Prefer OpenRouter key for SDK defaults
  const key = OPENROUTER_API_KEY || OPENAI_API_KEY;
  if (key) {
    setDefaultOpenAIKey(key);
  }
  // Disable tracing export in dev (no OpenAI tracing backend needed)
  if (process.env.NODE_ENV !== "production") {
    setTracingDisabled(true);
  }
  _configured = true;
}
