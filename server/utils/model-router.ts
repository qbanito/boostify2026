/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOSTIFY MODEL ROUTER — Circuit breaker + selección inteligente de modelos
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mantiene el estado de salud de cada modelo en memoria y selecciona
 * automáticamente el mejor modelo disponible para cada tipo de tarea.
 *
 * Circuit breaker:
 *   - 2 fallos en 10 min → modelo DEGRADED (ignorado por 30 min)
 *   - 5 fallos en 1 hora → modelo DISABLED (ignorado por 2 horas)
 *   - Recuperación automática al expirar el timeout
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { TASK_ROUTES, MODEL_MAP, detectProvider, type ModelProvider, type TaskType } from './model-registry';

// ─── Circuit Breaker State ────────────────────────────────────────────────────

type CircuitState = 'healthy' | 'degraded' | 'disabled';

interface ModelHealth {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;   // ms timestamp
  recoveryAt: number;      // ms — no intentar antes de este tiempo
}

/** Estado de salud en memoria (se resetea al reiniciar el servidor) */
const healthState = new Map<string, ModelHealth>();

const DEGRADED_THRESHOLD = 2;       // fallos para pasar a degraded
const DISABLED_THRESHOLD = 5;       // fallos para pasar a disabled
const FAILURE_WINDOW_MS = 10 * 60 * 1000;   // 10 minutos
const DEGRADED_RECOVERY_MS = 30 * 60 * 1000; // 30 minutos
const DISABLED_RECOVERY_MS = 2 * 60 * 60 * 1000; // 2 horas

/** Obtiene (o inicializa) el estado de salud de un modelo */
function getHealth(modelId: string): ModelHealth {
  if (!healthState.has(modelId)) {
    healthState.set(modelId, {
      state: 'healthy',
      failures: 0,
      lastFailureAt: 0,
      recoveryAt: 0,
    });
  }
  return healthState.get(modelId)!;
}

/**
 * Verifica si un modelo está disponible en este momento.
 * Si el tiempo de recuperación ya pasó, resetea el estado automáticamente.
 */
export function isModelAvailable(modelId: string): boolean {
  const h = getHealth(modelId);
  if (h.state === 'healthy') return true;

  // ¿Ya pasó el tiempo de recuperación?
  if (Date.now() >= h.recoveryAt) {
    // Resetear — segunda oportunidad
    h.state = 'healthy';
    h.failures = 0;
    return true;
  }

  return false;
}

/**
 * Registra un fallo para un modelo y actualiza su estado de circuit breaker.
 * Llamar este método cuando una llamada al modelo devuelve 401/429/500/503.
 */
export function markModelFailed(modelId: string, errorCode?: number): void {
  const h = getHealth(modelId);
  const now = Date.now();

  // Si el último fallo fue hace más de la ventana de tiempo, resetear contador
  if (now - h.lastFailureAt > FAILURE_WINDOW_MS) {
    h.failures = 0;
  }

  h.failures += 1;
  h.lastFailureAt = now;

  // 401 = key inválida → deshabilitar inmediatamente por 2 horas
  if (errorCode === 401) {
    h.state = 'disabled';
    h.failures = DISABLED_THRESHOLD;
    h.recoveryAt = now + DISABLED_RECOVERY_MS;
    console.warn(
      `[ModelRouter] 🔴 ${modelId} DISABLED (401 key invalid) — retry after ${new Date(h.recoveryAt).toISOString()}`
    );
    return;
  }

  if (h.failures >= DISABLED_THRESHOLD) {
    h.state = 'disabled';
    h.recoveryAt = now + DISABLED_RECOVERY_MS;
    console.warn(
      `[ModelRouter] 🔴 ${modelId} DISABLED (${h.failures} failures) — retry after ${new Date(h.recoveryAt).toISOString()}`
    );
  } else if (h.failures >= DEGRADED_THRESHOLD) {
    h.state = 'degraded';
    h.recoveryAt = now + DEGRADED_RECOVERY_MS;
    console.warn(
      `[ModelRouter] 🟡 ${modelId} DEGRADED (${h.failures} failures) — retry after ${new Date(h.recoveryAt).toISOString()}`
    );
  }
}

/**
 * Registra un éxito para un modelo.
 * Resetea el contador de fallos si el modelo vuelve a responder bien.
 */
export function markModelSuccess(modelId: string): void {
  const h = getHealth(modelId);
  if (h.failures > 0) {
    h.failures = Math.max(0, h.failures - 1);
  }
  if (h.state !== 'healthy' && h.failures === 0) {
    h.state = 'healthy';
    h.recoveryAt = 0;
  }
}

// ─── Selección de modelo ──────────────────────────────────────────────────────

export interface ModelSelection {
  /** ID del modelo seleccionado */
  modelId: string;
  /** Proveedor del modelo */
  provider: ModelProvider;
  /** Todos los modelos del cascade (para logs) */
  cascade: string[];
}

/**
 * Selecciona el mejor modelo disponible para un tipo de tarea.
 * Recorre el cascade en orden y devuelve el primero que no esté degradado/disabled.
 * Siempre garantiza un fallback (gpt-4o-mini directo).
 */
export function selectModel(taskType: TaskType): ModelSelection {
  const cascade = TASK_ROUTES[taskType];

  // Defensive: an unknown/unmapped taskType would make `cascade` undefined and
  // crash the `for…of` below. Fall back to the guaranteed OpenAI model instead.
  if (!Array.isArray(cascade) || cascade.length === 0) {
    console.warn(`[ModelRouter] ⚠️ Unknown taskType "${taskType}" — using guaranteed fallback gpt-4o-mini`);
    return { modelId: 'gpt-4o-mini', provider: 'openai', cascade: ['gpt-4o-mini'] };
  }

  for (const modelId of cascade) {
    if (isModelAvailable(modelId)) {
      const provider = detectProvider(modelId);
      return { modelId, provider, cascade };
    }
  }

  // Fallback garantizado: gpt-4o-mini directo (siempre disponible si OPENAI_API_KEY existe)
  console.warn(`[ModelRouter] ⚠️ All cascade models degraded for "${taskType}", using guaranteed fallback`);
  return { modelId: 'gpt-4o-mini', provider: 'openai', cascade };
}

/**
 * Obtiene el siguiente modelo disponible en el cascade después del dado.
 * Útil para retry dentro del mismo request.
 *
 * @returns modelId del siguiente disponible, o undefined si no hay más
 */
export function getNextModel(
  taskType: TaskType,
  failedModelId: string
): string | undefined {
  const cascade = TASK_ROUTES[taskType];
  // Unknown taskType → no cascade; fall back to the guaranteed OpenAI model once.
  if (!Array.isArray(cascade) || cascade.length === 0) {
    return failedModelId !== 'gpt-4o-mini' ? 'gpt-4o-mini' : undefined;
  }
  const idx = cascade.indexOf(failedModelId);
  if (idx === -1) return undefined;

  for (let i = idx + 1; i < cascade.length; i++) {
    if (isModelAvailable(cascade[i])) {
      return cascade[i];
    }
  }

  // Si failedModel no era el garantizado OpenAI, intentar el fallback directo
  if (failedModelId !== 'gpt-4o-mini') return 'gpt-4o-mini';
  return undefined;
}

// ─── Diagnóstico ─────────────────────────────────────────────────────────────

/** Devuelve el estado de salud de todos los modelos que han sido utilizados */
export function getHealthReport(): Record<string, { state: CircuitState; failures: number; recoveryIn?: string }> {
  const report: Record<string, { state: CircuitState; failures: number; recoveryIn?: string }> = {};
  const now = Date.now();

  for (const [modelId, h] of healthState.entries()) {
    const remaining = h.recoveryAt > now ? Math.round((h.recoveryAt - now) / 1000 / 60) + 'min' : undefined;
    report[modelId] = {
      state: h.state,
      failures: h.failures,
      ...(remaining && { recoveryIn: remaining }),
    };
  }

  return report;
}

/** Resetea el estado de todos los modelos (útil para tests o admin resets) */
export function resetAllCircuitBreakers(): void {
  healthState.clear();
  console.log('[ModelRouter] ♻️ All circuit breakers reset');
}
