/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY MODEL REGISTRY — Catálogo de modelos AI con metadata de costo/velocidad
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Todos los modelos disponibles, su tier, precio y capacidades.
 * El router usa este registro para decidir qué modelo usar por task type.
 *
 * Tiers:
 *   ultra_fast  — clasificación, tags, decisiones simples   ($0.01–0.1/1M)
 *   fast        — captions, posts cortos, descripciones     ($0.1–0.3/1M)
 *   balanced    — letras, bios, propuestas, análisis        ($0.25–1.25/1M)
 *   quality     — planes, campañas, contenido largo         ($1–10/1M)
 *   premium     — blueprints, business plans (máx calidad)  ($3–15/1M)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/** Nivel de calidad/costo del modelo */
export type ModelTier = 'ultra_fast' | 'fast' | 'balanced' | 'quality' | 'premium';

/** Proveedor del modelo */
export type ModelProvider = 'openrouter' | 'openai' | 'zai';

/**
 * Tipos de tarea disponibles.
 * El router mapea cada tipo al cascade de modelos más económico para esa tarea.
 */
export type TaskType =
  | 'classify'       // detección de género, idioma, sentimiento  → ultra_fast
  | 'tag'            // hashtags, keywords, etiquetas             → ultra_fast
  | 'caption'        // posts IG/TikTok, short social             → fast
  | 'description'    // descripciones de canciones/merch/noticias → fast
  | 'content'        // copywriting general, textos de eventos     → balanced
  | 'lyrics'         // letras de canciones                       → balanced
  | 'bio'            // bios artistas, EPK text                   → balanced
  | 'proposal'       // propuestas email, pitches, outreach       → balanced
  | 'analysis'       // análisis de datos, market research        → balanced
  | 'plan'           // estrategias de campaña, roadmaps          → quality
  | 'blueprint'      // Superstar Blueprint completo              → premium
  | 'business_plan'  // plan de negocio completo                  → premium
  | 'gateway_agent'  // Artist Agent Gateway conversations        → balanced
  | 'code';          // generación de código                      → quality

/** Metadata completa de un modelo */
export interface ModelEntry {
  /** ID del modelo tal como se envía al proveedor (e.g. 'google/gemini-2.0-flash') */
  id: string;
  /** Nombre legible */
  name: string;
  /** Proveedor de la API */
  provider: ModelProvider;
  /** Tier de calidad/costo */
  tier: ModelTier;
  /** Ventana de contexto en tokens */
  contextWindow: number;
  /** Costo por 1M tokens de input en USD */
  inputCostPer1M: number;
  /** Costo por 1M tokens de output en USD */
  outputCostPer1M: number;
  /** Soporta modo JSON estructurado */
  supportsJSON: boolean;
  /** Máximo de tokens de output */
  maxOutputTokens: number;
}

// ─── Catálogo completo de modelos ─────────────────────────────────────────────

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── Ultra Fast (OpenRouter) ──────────────────────────────────────────────────
  {
    id: 'google/gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'openrouter',
    tier: 'ultra_fast',
    contextWindow: 128000,
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.3,
    supportsJSON: true,
    maxOutputTokens: 8192,
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct',
    name: 'Llama 3.2 3B Instruct',
    provider: 'openrouter',
    tier: 'ultra_fast',
    contextWindow: 131072,
    inputCostPer1M: 0.03,
    outputCostPer1M: 0.05,
    supportsJSON: true,
    maxOutputTokens: 4096,
  },

  // ── Fast (OpenRouter) ────────────────────────────────────────────────────────
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'openrouter',
    tier: 'fast',
    contextWindow: 128000,
    inputCostPer1M: 0.1,
    outputCostPer1M: 0.4,
    supportsJSON: true,
    maxOutputTokens: 8192,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    provider: 'openrouter',
    tier: 'fast',
    contextWindow: 131072,
    inputCostPer1M: 0.12,
    outputCostPer1M: 0.3,
    supportsJSON: true,
    maxOutputTokens: 4096,
  },

  // ── Balanced (OpenRouter) ────────────────────────────────────────────────────
  {
    id: 'anthropic/claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'openrouter',
    tier: 'balanced',
    contextWindow: 200000,
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
    supportsJSON: false,
    maxOutputTokens: 4096,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (via OpenRouter)',
    provider: 'openrouter',
    tier: 'balanced',
    contextWindow: 128000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsJSON: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'openrouter',
    tier: 'balanced',
    contextWindow: 200000,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4.0,
    supportsJSON: false,
    maxOutputTokens: 8192,
  },

  // ── Quality (OpenRouter) ─────────────────────────────────────────────────────
  {
    id: 'google/gemini-2.5-pro-preview',
    name: 'Gemini 2.5 Pro Preview',
    provider: 'openrouter',
    tier: 'quality',
    contextWindow: 1000000,
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.0,
    supportsJSON: true,
    maxOutputTokens: 65536,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    tier: 'quality',
    contextWindow: 200000,
    inputCostPer1M: 3.0,
    outputCostPer1M: 15.0,
    supportsJSON: false,
    maxOutputTokens: 8192,
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B Instruct',
    provider: 'openrouter',
    tier: 'quality',
    contextWindow: 131072,
    inputCostPer1M: 2.0,
    outputCostPer1M: 2.0,
    supportsJSON: true,
    maxOutputTokens: 8192,
  },

  // ── Premium (OpenRouter) ─────────────────────────────────────────────────────
  {
    id: 'anthropic/claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'openrouter',
    tier: 'premium',
    contextWindow: 200000,
    inputCostPer1M: 15.0,
    outputCostPer1M: 75.0,
    supportsJSON: false,
    maxOutputTokens: 32000,
  },

  // ── z.ai / Zhipu GLM (fallback económico — API OpenAI-compatible) ─────────────
  // GLM-4.5-Flash es GRATIS → ideal para classify/tag/caption/description.
  // GLM-4.6 ($0.6/$2.2) ≈ 5x más barato que Claude 3.5 Sonnet → plan/code/blueprint.
  // GLM-5.2 (1M context, $1.4/$4.4) → flagship para tareas largas/complejas.
  {
    id: 'glm-4.5-flash',
    name: 'GLM-4.5-Flash (z.ai · gratis)',
    provider: 'zai',
    tier: 'fast',
    contextWindow: 128000,
    inputCostPer1M: 0,
    outputCostPer1M: 0,
    supportsJSON: false,
    maxOutputTokens: 16384,
  },
  {
    id: 'glm-4.7-flashx',
    name: 'GLM-4.7-FlashX (z.ai · ultra barato)',
    provider: 'zai',
    tier: 'ultra_fast',
    contextWindow: 128000,
    inputCostPer1M: 0.07,
    outputCostPer1M: 0.4,
    supportsJSON: false,
    maxOutputTokens: 16384,
  },
  {
    id: 'glm-4.5-air',
    name: 'GLM-4.5-Air (z.ai)',
    provider: 'zai',
    tier: 'balanced',
    contextWindow: 128000,
    inputCostPer1M: 0.2,
    outputCostPer1M: 1.1,
    supportsJSON: false,
    maxOutputTokens: 16384,
  },
  {
    id: 'glm-4.6',
    name: 'GLM-4.6 (z.ai · coding)',
    provider: 'zai',
    tier: 'quality',
    contextWindow: 200000,
    inputCostPer1M: 0.6,
    outputCostPer1M: 2.2,
    supportsJSON: false,
    maxOutputTokens: 32768,
  },
  {
    id: 'glm-5.2',
    name: 'GLM-5.2 (z.ai · flagship 1M)',
    provider: 'zai',
    tier: 'premium',
    contextWindow: 1000000,
    inputCostPer1M: 1.4,
    outputCostPer1M: 4.4,
    supportsJSON: false,
    maxOutputTokens: 65536,
  },

  // ── OpenAI Direct (fallbacks garantizados) ───────────────────────────────────
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini (OpenAI Direct)',
    provider: 'openai',
    tier: 'balanced',
    contextWindow: 128000,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
    supportsJSON: true,
    maxOutputTokens: 16384,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (OpenAI Direct)',
    provider: 'openai',
    tier: 'quality',
    contextWindow: 128000,
    inputCostPer1M: 5.0,
    outputCostPer1M: 15.0,
    supportsJSON: true,
    maxOutputTokens: 16384,
  },
];

// ─── Mapa de acceso rápido ────────────────────────────────────────────────────

/** Acceso O(1) al ModelEntry por ID */
export const MODEL_MAP = new Map<string, ModelEntry>(
  MODEL_REGISTRY.map(m => [m.id, m])
);

/**
 * Obtiene la metadata de un modelo o undefined si no existe en el registro.
 * No lanza error — el caller debe manejar el undefined.
 */
export function getModelMeta(modelId: string): ModelEntry | undefined {
  return MODEL_MAP.get(modelId);
}

/**
 * Detecta el proveedor de un modelo a partir de su ID.
 * Usa el registro primero; si no existe, infiere por convención:
 *   - 'glm-*'        → z.ai (Zhipu GLM)
 *   - contiene '/'   → OpenRouter (e.g. 'anthropic/claude-3-haiku')
 *   - resto          → OpenAI directo (e.g. 'gpt-4o-mini')
 */
export function detectProvider(modelId: string): ModelProvider {
  const meta = MODEL_MAP.get(modelId);
  if (meta) return meta.provider;
  if (/^glm[-.]/i.test(modelId)) return 'zai';
  if (modelId.includes('/')) return 'openrouter';
  return 'openai';
}

// ─── Routes por task type ─────────────────────────────────────────────────────
// Orden: modelo principal → fallbacks de OpenRouter → fallback OpenAI directo

export const TASK_ROUTES: Record<TaskType, string[]> = {
  // Ultra fast — clasificación y tags simples (GLM-4.5-Flash es GRATIS)
  classify: [
    'google/gemini-2.0-flash-lite',
    'glm-4.5-flash',
    'meta-llama/llama-3.2-3b-instruct',
    'gpt-4o-mini',
  ],
  tag: [
    'google/gemini-2.0-flash-lite',
    'glm-4.5-flash',
    'google/gemini-2.0-flash',
    'gpt-4o-mini',
  ],

  // Fast — contenido corto de redes sociales (GLM-4.5-Flash gratis primero)
  caption: [
    'google/gemini-2.0-flash',
    'glm-4.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'gpt-4o-mini',
  ],
  description: [
    'google/gemini-2.0-flash',
    'glm-4.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'gpt-4o-mini',
  ],

  // Balanced — copywriting general / textos de eventos
  content: [
    'google/gemini-2.0-flash',
    'glm-4.5-air',
    'meta-llama/llama-3.3-70b-instruct',
    'gpt-4o-mini',
  ],

  // Balanced — contenido creativo medio
  lyrics: [
    'anthropic/claude-3-haiku',
    'glm-4.5-air',
    'meta-llama/llama-3.3-70b-instruct',
    'gpt-4o-mini',
  ],
  bio: [
    'anthropic/claude-3-haiku',
    'glm-4.5-air',
    'openai/gpt-4o-mini',
    'gpt-4o-mini',
  ],
  proposal: [
    'anthropic/claude-3.5-haiku',
    'glm-4.5-air',
    'anthropic/claude-3-haiku',
    'gpt-4o-mini',
  ],
  analysis: [
    'openai/gpt-4o-mini',
    'glm-4.6',
    'anthropic/claude-3-haiku',
    'gpt-4o-mini',
  ],

  // Quality — contenido estratégico largo (GLM-4.6 ~5x más barato que Sonnet)
  plan: [
    'anthropic/claude-3.5-sonnet',
    'glm-4.6',
    'google/gemini-2.5-pro-preview',
    'gpt-4o',
  ],
  code: [
    'anthropic/claude-3.5-sonnet',
    'glm-4.6',
    'openai/gpt-4o-mini',
    'gpt-4o',
  ],

  // Premium — generación masiva de alta calidad (GLM-5.2 flagship 1M context)
  blueprint: [
    'anthropic/claude-3.5-sonnet',
    'glm-5.2',
    'google/gemini-2.5-pro-preview',
    'gpt-4o',
  ],
  business_plan: [
    'anthropic/claude-3.5-sonnet',
    'glm-5.2',
    'google/gemini-2.5-pro-preview',
    'gpt-4o',
  ],

  // Balanced — agent conversations (fast enough for chat, smart enough for evaluation)
  gateway_agent: [
    'openai/gpt-4o-mini',
    'glm-4.5-air',
    'google/gemini-2.0-flash',
    'anthropic/claude-3-haiku',
  ],
};

/**
 * Estima el costo aproximado de una llamada dado un modelo y cantidad de tokens.
 * @returns costo en USD
 */
export function estimateCallCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const meta = MODEL_MAP.get(modelId);
  if (!meta) return 0;
  return (
    (inputTokens / 1_000_000) * meta.inputCostPer1M +
    (outputTokens / 1_000_000) * meta.outputCostPer1M
  );
}
