/**
 * 🚀 Parallel Generation Service - Generación de imágenes en paralelo
 * 
 * Características:
 * - Concurrencia controlada (4 imágenes simultáneas por defecto)
 * - Queue con prioridad
 * - Retry automático con exponential backoff
 * - Progress streaming
 * - Cache inteligente
 */

import { logger } from '../utils/logger';

// ========== TIPOS ==========

export interface GenerationTask<T = any> {
  id: string;
  priority: number;  // Mayor = más prioritario
  execute: () => Promise<T>;
  onProgress?: (progress: number) => void;
  retries?: number;
}

export interface GenerationResult<T = any> {
  id: string;
  success: boolean;
  result?: T;
  error?: string;
  duration: number;
  retryCount: number;
}

export interface ParallelGenerationOptions {
  maxConcurrent?: number;      // Máximo de tareas simultáneas (default: 4)
  maxRetries?: number;         // Reintentos por tarea (default: 2)
  retryDelay?: number;         // Delay inicial entre reintentos (default: 1000ms)
  retryMultiplier?: number;    // Multiplicador de backoff (default: 2)
  timeout?: number;            // Timeout por tarea en ms (default: 120000)
  onTaskComplete?: (result: GenerationResult) => void;
  onProgress?: (completed: number, total: number) => void;
}

// ========== SERVICIO PRINCIPAL ==========

/**
 * Ejecuta múltiples tareas de generación en paralelo con control de concurrencia
 */
export async function executeParallel<T>(
  tasks: GenerationTask<T>[],
  options: ParallelGenerationOptions = {}
): Promise<GenerationResult<T>[]> {
  const {
    maxConcurrent = 4,
    maxRetries = 2,
    retryDelay = 1000,
    retryMultiplier = 2,
    timeout = 120000,
    onTaskComplete,
    onProgress
  } = options;

  logger.log(`[ParallelGen] 🚀 Iniciando ${tasks.length} tareas con concurrencia ${maxConcurrent}`);

  // Ordenar por prioridad (mayor primero)
  const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);
  
  const results: GenerationResult<T>[] = [];
  let completedCount = 0;
  let activeCount = 0;
  let taskIndex = 0;

  // Ejecutar una tarea con reintentos
  const executeTask = async (task: GenerationTask<T>): Promise<GenerationResult<T>> => {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Crear promise con timeout
        const result = await Promise.race([
          task.execute(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);

        return {
          id: task.id,
          success: true,
          result,
          duration: Date.now() - startTime,
          retryCount
        };
      } catch (error: any) {
        lastError = error;
        retryCount = attempt;
        
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(retryMultiplier, attempt);
          logger.warn(`[ParallelGen] ⚠️ Task ${task.id} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}. Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    return {
      id: task.id,
      success: false,
      error: lastError?.message || 'Unknown error',
      duration: Date.now() - startTime,
      retryCount
    };
  };

  // Worker que procesa tareas de la cola
  const worker = async (): Promise<void> => {
    while (taskIndex < sortedTasks.length) {
      const currentIndex = taskIndex++;
      const task = sortedTasks[currentIndex];
      
      if (!task) break;

      activeCount++;
      logger.log(`[ParallelGen] 🔄 Procesando tarea ${task.id} (${currentIndex + 1}/${sortedTasks.length})`);
      
      const result = await executeTask(task);
      results.push(result);
      
      activeCount--;
      completedCount++;

      if (result.success) {
        logger.log(`[ParallelGen] ✅ Task ${task.id} completada en ${result.duration}ms`);
      } else {
        logger.error(`[ParallelGen] ❌ Task ${task.id} falló: ${result.error}`);
      }

      onTaskComplete?.(result);
      onProgress?.(completedCount, sortedTasks.length);
    }
  };

  // Crear workers según concurrencia máxima
  const workers = Array(Math.min(maxConcurrent, sortedTasks.length))
    .fill(null)
    .map(() => worker());

  // Esperar a que todos los workers terminen
  await Promise.all(workers);

  // Ordenar resultados por orden original de tareas
  const orderedResults = tasks.map(task => 
    results.find(r => r.id === task.id)!
  );

  const successCount = orderedResults.filter(r => r.success).length;
  const totalDuration = orderedResults.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = Math.round(totalDuration / orderedResults.length);

  logger.log(`[ParallelGen] 🏁 Completado: ${successCount}/${tasks.length} exitosas, tiempo promedio: ${avgDuration}ms`);

  return orderedResults;
}

/**
 * Genera imágenes en paralelo con un generador común
 */
export async function generateImagesParallel<T>(
  items: T[],
  generator: (item: T, index: number) => Promise<string>,
  options: ParallelGenerationOptions & {
    getItemId?: (item: T, index: number) => string;
  } = {}
): Promise<Array<{ item: T; imageUrl: string | null; error?: string }>> {
  const { getItemId = (_, i) => `img_${i}` } = options;

  const tasks: GenerationTask<string>[] = items.map((item, index) => ({
    id: getItemId(item, index),
    priority: items.length - index, // Primeros tienen más prioridad
    execute: () => generator(item, index)
  }));

  const results = await executeParallel(tasks, options);

  return items.map((item, index) => {
    const result = results[index];
    return {
      item,
      imageUrl: result.success ? result.result || null : null,
      error: result.error
    };
  });
}

/**
 * Divide un array en chunks de tamaño especificado
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Ejecuta tareas en chunks secuenciales, pero paralelo dentro de cada chunk
 */
export async function executeInChunks<T>(
  tasks: GenerationTask<T>[],
  chunkSize: number = 4,
  options: Omit<ParallelGenerationOptions, 'maxConcurrent'> = {}
): Promise<GenerationResult<T>[]> {
  const chunks = chunkArray(tasks, chunkSize);
  const allResults: GenerationResult<T>[] = [];
  
  let completedChunks = 0;
  
  for (const chunk of chunks) {
    logger.log(`[ParallelGen] 📦 Procesando chunk ${completedChunks + 1}/${chunks.length} (${chunk.length} tareas)`);
    
    const chunkResults = await executeParallel(chunk, {
      ...options,
      maxConcurrent: chunkSize, // Todos en paralelo dentro del chunk
      onProgress: (completed, total) => {
        const overallCompleted = (completedChunks * chunkSize) + completed;
        const overallTotal = tasks.length;
        options.onProgress?.(overallCompleted, overallTotal);
      }
    });
    
    allResults.push(...chunkResults);
    completedChunks++;
  }
  
  return allResults;
}

// ========== UTILIDADES ==========

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry con exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  multiplier: number = 2
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(multiplier, attempt);
        logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  throw lastError || new Error('All retries failed');
}

/**
 * Wrapper para limitar concurrencia de cualquier función async
 */
export function createConcurrencyLimiter(maxConcurrent: number = 4) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length > 0 && activeCount < maxConcurrent) {
      const resolve = queue.shift()!;
      resolve();
    }
  };

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (activeCount >= maxConcurrent) {
      await new Promise<void>(resolve => queue.push(resolve));
    }

    activeCount++;
    try {
      return await fn();
    } finally {
      activeCount--;
      next();
    }
  };
}

/**
 * Crea un pool de workers reutilizable
 */
export function createWorkerPool<TInput, TOutput>(
  worker: (input: TInput) => Promise<TOutput>,
  maxConcurrent: number = 4
) {
  const limiter = createConcurrencyLimiter(maxConcurrent);

  return {
    async process(input: TInput): Promise<TOutput> {
      return limiter(() => worker(input));
    },
    
    async processMany(inputs: TInput[]): Promise<TOutput[]> {
      return Promise.all(inputs.map(input => limiter(() => worker(input))));
    },
    
    async processManyOrdered(inputs: TInput[]): Promise<TOutput[]> {
      const results: TOutput[] = new Array(inputs.length);
      await Promise.all(
        inputs.map(async (input, index) => {
          results[index] = await limiter(() => worker(input));
        })
      );
      return results;
    }
  };
}
