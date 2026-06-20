/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY AI CONFIG — Central model configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PRIMARY MODEL:  gpt-4o-mini (OpenAI direct — para agentes LangChain)
 * SMART ROUTING:  callAI() en smart-ai.ts — usa OpenRouter con cascade inteligente
 * FALLBACK MODEL: gpt-4o-mini (OpenAI directo siempre disponible)
 *
 * Para nuevas funcionalidades: usa callAI() de smart-ai.ts
 * Los agentes LangChain legacy usan PRIMARY_MODEL aquí (OpenAI directo)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── Re-export de TaskType para conveniencia ──────────────────────────────────
export type { TaskType } from './model-registry';

// ─── OpenRouter (primary via smart router) ────────────────────────────────────
export const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || '';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// ─── z.ai / Zhipu GLM (fallback económico — OpenAI-compatible) ─────────────────
// Modelos GLM (GLM-4.5-Flash gratis, GLM-4.6 barato, GLM-5.2 flagship) usados
// como fallback de bajo costo en el smart router. API compatible con OpenAI.
export const ZAI_API_KEY = process.env.ZAI_API_KEY || process.env.ZHIPU_API_KEY || '';

export const ZAI_BASE_URL = 'https://api.z.ai/api/paas/v4';

// ─── OpenAI (directo — para agentes LangChain) ───────────────────────────────
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Modelo principal para agentes LangChain (usan openAIApiKey directo).
 * gpt-4o-mini: rápido, económico, excelente para posts sociales y anuncios.
 * NO usar para blueprints/planes — usar callAI('blueprint', ...) de smart-ai.ts
 */
export const PRIMARY_MODEL = 'gpt-4o-mini';

/** Modelo ligero para tareas simples en agentes LangChain */
export const LIGHT_MODEL = 'gpt-4o-mini';

/** Fallback model cuando el modelo primario falla */
export const FALLBACK_MODEL = 'gpt-4o-mini';

/** Modelo pesado para tareas complejas en agentes LangChain */
export const FALLBACK_HEAVY_MODEL = 'gpt-4o';

// ─── Model selection helpers ───────────────────────────────────────────────────

/**
 * Returns the model string to use for a given task type.
 * Para nuevas funcionalidades, usar callAI() de smart-ai.ts en su lugar.
 */
export function getModel(taskType: 'primary' | 'light' | 'heavy' | 'fallback' | 'fallback-heavy' = 'primary'): string {
  switch (taskType) {
    case 'primary':
      return PRIMARY_MODEL;
    case 'light':
      return LIGHT_MODEL;
    case 'heavy':
      return FALLBACK_HEAVY_MODEL;
    case 'fallback':
      return FALLBACK_MODEL;
    case 'fallback-heavy':
      return FALLBACK_HEAVY_MODEL;
    default:
      return PRIMARY_MODEL;
  }
}

/**
 * Check if OpenRouter is configured and available
 */
export function isOpenRouterConfigured(): boolean {
  return !!OPENROUTER_API_KEY;
}

/**
 * Check if OpenAI fallback is configured
 */
export function isOpenAIFallbackConfigured(): boolean {
  return !!OPENAI_API_KEY;
}

/**
 * Check if z.ai (GLM) low-cost fallback is configured
 */
export function isZaiConfigured(): boolean {
  return !!ZAI_API_KEY;
}

/**
 * Log the current AI configuration on boot
 */
export function logAIConfig(): void {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🤖 AI Configuration (Smart Router Active)');
  console.log(`   OpenRouter: ${OPENROUTER_API_KEY ? '✅ configured' : '❌ NO KEY — will use OpenAI fallback'}`);
  console.log(`   OpenAI:     ${OPENAI_API_KEY ? '✅ configured' : '❌ NO KEY'}`);
  console.log(`   z.ai (GLM): ${ZAI_API_KEY ? '✅ configured (low-cost fallback)' : '❌ NO KEY'}`);
  console.log(`   LangChain agents: ${PRIMARY_MODEL} via OpenAI direct`);
  console.log(`   Smart callAI(): cascade via OpenRouter → z.ai GLM → OpenAI fallback`);
  console.log('═══════════════════════════════════════════════════════');
}
