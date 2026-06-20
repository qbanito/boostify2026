/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY SMART AI — Cliente unificado de IA con enrutamiento inteligente
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Función única `callAI()` que reemplaza todos los usos de `createTrackedOpenAI()`.
 *
 * Flujo de ejecución:
 *   1. Selecciona el mejor modelo disponible para el taskType (via model-router)
 *   2. Crea el cliente correcto (OpenRouter o OpenAI directo)
 *   3. Ejecuta la llamada
 *   4. Si falla → marca modelo como fallido + reintenta con el siguiente del cascade
 *   5. Registra costo y latencia en api_usage_log
 *   6. Devuelve string limpio (sin wrapping del SDK)
 *
 * Uso básico:
 *   const text = await callAI('bio', [
 *     { role: 'system', content: 'Eres un escritor de bios...' },
 *     { role: 'user', content: 'Escribe una bio para...' },
 *   ]);
 *
 * Con opciones:
 *   const json = await callAI('blueprint', messages, {
 *     maxTokens: 8000,
 *     temperature: 0.7,
 *     requireJSON: true,
 *   });
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import OpenAI from 'openai';
import { logApiUsage } from './api-logger';
import { selectModel, markModelFailed, markModelSuccess, getNextModel } from './model-router';
import { MODEL_MAP, estimateCallCost, type TaskType } from './model-registry';
import { OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENAI_API_KEY, ZAI_API_KEY, ZAI_BASE_URL } from './ai-config';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type { TaskType };

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export interface CallAIOptions {
  /** Temperatura de generación (0 = determinista, 1 = creativo, 2 = máx) */
  temperature?: number;
  /** Máximo de tokens de output */
  maxTokens?: number;
  /**
   * Si true, fuerza response_format: json_object cuando el modelo lo soporta.
   * Solo usar cuando el prompt explícitamente pida JSON.
   */
  requireJSON?: boolean;
  /** ID del usuario para logging (opcional) */
  userId?: number | null;
  /** Label para logs (e.g. 'blueprint-generator', 'news-generator') */
  label?: string;
  /**
   * Forzar un modelo específico ignorando el router.
   * Usar solo para casos muy específicos — normalmente dejar que el router decida.
   */
  forceModel?: string;
}

// ─── Helper: limpia bloques markdown que algunos modelos (GLM, Llama) añaden ──
// Algunos modelos envuelven JSON en ```json ... ``` incluso cuando se pide JSON
// puro. Este helper lo stripea para que JSON.parse() funcione en todos los callers.
function stripMarkdownJson(text: string): string {
  const trimmed = text.trim();
  // Caso 1: ```json ... ``` o ``` ... ```
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fenced) return fenced[1].trim();
  // Caso 2: empieza con ``` sin cierre (truncado)
  if (trimmed.startsWith('```')) return trimmed.replace(/^```(?:json)?\s*\n?/i, '').trim();
  return text;
}

// ─── Singleton clientes ───────────────────────────────────────────────────────

let _openrouterClient: OpenAI | null = null;
let _openaiClient: OpenAI | null = null;
let _zaiClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!_openrouterClient) {
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY no está configurada');
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

function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no está configurada');
    _openaiClient = new OpenAI({ apiKey: OPENAI_API_KEY });
  }
  return _openaiClient;
}

function getZaiClient(): OpenAI {
  if (!_zaiClient) {
    if (!ZAI_API_KEY) throw new Error('ZAI_API_KEY no está configurada');
    _zaiClient = new OpenAI({
      apiKey: ZAI_API_KEY,
      baseURL: ZAI_BASE_URL,
    });
  }
  return _zaiClient;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Llama a la IA con el modelo más apropiado para la tarea.
 * Maneja fallbacks automáticamente vía circuit breaker.
 *
 * @param taskType - Tipo de tarea (determina qué modelo usar)
 * @param messages - Array de mensajes en formato OpenAI
 * @param opts     - Opciones opcionales (temperatura, tokens, JSON mode, etc.)
 * @returns        Contenido de texto de la respuesta, o lanza error si todo falla
 */
export async function callAI(
  taskType: TaskType,
  messages: ChatMessage[],
  opts: CallAIOptions = {}
): Promise<string> {
  const {
    temperature = 0.7,
    maxTokens,
    requireJSON = false,
    userId = null,
    label = taskType,
    forceModel,
  } = opts;

  // Seleccionar modelo inicial
  let selection = forceModel
    ? {
        modelId: forceModel,
        provider: (MODEL_MAP.get(forceModel)?.provider ?? (forceModel.includes('/') ? 'openrouter' : 'openai')) as 'openrouter' | 'openai',
        cascade: [forceModel],
      }
    : selectModel(taskType);

  let currentModelId = selection.modelId;
  let attempt = 0;
  const MAX_ATTEMPTS = 4;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    const modelMeta = MODEL_MAP.get(currentModelId);
    const provider = modelMeta?.provider ?? (currentModelId.includes('/') ? 'openrouter' : 'openai');
    const startTime = Date.now();

    try {
      // Elegir el cliente correcto
      const client =
        provider === 'openrouter' ? getOpenRouterClient() :
        provider === 'zai'        ? getZaiClient() :
        getOpenAIClient();

      // Construir params base
      const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: currentModelId,
        messages,
        temperature,
        ...(maxTokens && { max_tokens: maxTokens }),
      };

      // JSON mode solo si el modelo lo soporta y se solicita explícitamente
      if (requireJSON && (modelMeta?.supportsJSON ?? false)) {
        params.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(params);

      const content = response.choices[0]?.message?.content ?? '';
      const usage = response.usage;
      const elapsed = Date.now() - startTime;

      // Registrar éxito en circuit breaker
      markModelSuccess(currentModelId);

      // Log de uso (fire-and-forget)
      logApiUsage({
        userId,
        apiProvider: provider === 'openrouter' ? 'openrouter' : provider === 'zai' ? 'openrouter' : 'openai',
        endpoint: 'chat.completions',
        model: currentModelId,
        promptTokens: usage?.prompt_tokens ?? 0,
        completionTokens: usage?.completion_tokens ?? 0,
        totalTokens: usage?.total_tokens ?? 0,
        responseTime: elapsed,
        status: 'success',
        metadata: {
          taskType,
          label,
          attempt,
          provider: provider,
          estimatedCostUSD: estimateCallCost(
            currentModelId,
            usage?.prompt_tokens ?? 0,
            usage?.completion_tokens ?? 0
          ).toFixed(6),
        },
      }).catch(() => {});

      if (attempt > 1) {
        console.log(`[SmartAI] ✅ ${label} succeeded with fallback model: ${currentModelId} (attempt ${attempt})`);
      }

      // Algunos modelos (GLM, Llama) envuelven JSON en bloques markdown.
      // Limpiamos aquí para que todos los callers reciban JSON parseable.
      return requireJSON ? stripMarkdownJson(content) : content;
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      const errorCode = err?.status ?? err?.response?.status ?? 0;
      const errorMsg = err?.message ?? 'Unknown error';

      console.warn(
        `[SmartAI] ⚠️ ${label} failed on ${currentModelId} (attempt ${attempt}, ${errorCode}): ${errorMsg}`
      );

      // Registrar fallo en circuit breaker
      markModelFailed(currentModelId, errorCode);

      // Log del error (fire-and-forget)
      logApiUsage({
        userId,
        apiProvider: provider === 'openrouter' ? 'openrouter' : provider === 'zai' ? 'openrouter' : 'openai',
        endpoint: 'chat.completions',
        model: currentModelId,
        responseTime: elapsed,
        status: errorCode === 429 ? 'rate_limited' : 'error',
        errorMessage: errorMsg,
        metadata: { taskType, label, attempt, errorCode, provider },
      }).catch(() => {});

      // Buscar el siguiente modelo disponible
      const nextModel = forceModel ? undefined : getNextModel(taskType, currentModelId);
      if (!nextModel) {
        // Último recurso: intentar gpt-4o-mini directo si no lo hemos probado ya
        if (currentModelId !== 'gpt-4o-mini') {
          currentModelId = 'gpt-4o-mini';
          continue;
        }
        // Todo falló
        break;
      }

      currentModelId = nextModel;
    }
  }

  throw new Error(
    `[SmartAI] All models failed for task "${taskType}" after ${attempt} attempts. ` +
    `Check API keys and model availability.`
  );
}

/**
 * Versión simplificada de callAI para casos donde solo se necesita system + user prompt.
 * Evita tener que construir el array de mensajes manualmente.
 */
export async function callAISimple(
  taskType: TaskType,
  systemPrompt: string,
  userPrompt: string,
  opts: CallAIOptions = {}
): Promise<string> {
  return callAI(
    taskType,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    opts
  );
}

// ─── Re-exportaciones de conveniencia ─────────────────────────────────────────
export { selectModel, getHealthReport, resetAllCircuitBreakers } from './model-router';
export { MODEL_REGISTRY, TASK_ROUTES } from './model-registry';
