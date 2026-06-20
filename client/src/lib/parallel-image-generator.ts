/**
 * 🚀 Parallel Image Generation with Rate Limiting
 * Sistema de generación de imágenes en paralelo con control de rate
 * 
 * Features:
 * - Semáforo para limitar concurrencia
 * - Cola de prioridad (PERFORMANCE primero)
 * - Rate limiting para evitar throttling de API
 * - Retry con backoff exponencial
 * - Callbacks para progreso en tiempo real
 */

type ShotCategory = 'PERFORMANCE' | 'B-ROLL' | 'STORY';

interface GenerationTask {
  id: string;
  sceneIndex: number;
  prompt: string;
  shotCategory: ShotCategory;
  faceReferenceUrl?: string;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

interface GenerationResult {
  id: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
  timeTaken: number;
}

interface ParallelGenerationOptions {
  maxConcurrent: number;           // Max parallel requests (default: 3)
  requestDelayMs: number;          // Delay between starting new requests (default: 500ms)
  rateLimitPerMinute: number;      // Max requests per minute (default: 30)
  prioritizePerformance: boolean;  // Process PERFORMANCE shots first
  onProgress: (completed: number, total: number, current: GenerationTask) => void;
  onImageComplete: (result: GenerationResult) => void;
  onBatchComplete: (results: GenerationResult[]) => void;
  onError: (task: GenerationTask, error: Error) => void;
}

/**
 * Semaphore para control de concurrencia
 */
class Semaphore {
  private permits: number;
  private queue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    
    return new Promise<void>(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.permits++;
    }
  }
}

/**
 * Rate Limiter usando token bucket
 */
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(requestsPerMinute: number) {
    this.maxTokens = requestsPerMinute;
    this.tokens = requestsPerMinute;
    this.refillRate = requestsPerMinute / 60000; // tokens per ms
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Calculate wait time for next token
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await this.delay(waitTime);
    this.refill();
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Priority queue para ordenar tareas
 */
class PriorityQueue<T extends { priority: number }> {
  private items: T[] = [];

  enqueue(item: T): void {
    this.items.push(item);
    this.items.sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  dequeue(): T | undefined {
    return this.items.shift();
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }
}

/**
 * Parallel Image Generator
 */
export class ParallelImageGenerator {
  private semaphore: Semaphore;
  private rateLimiter: RateLimiter;
  private queue: PriorityQueue<GenerationTask>;
  private options: ParallelGenerationOptions;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isCancelled: boolean = false;
  private completedCount: number = 0;
  private totalCount: number = 0;
  private results: GenerationResult[] = [];
  private pausePromise: Promise<void> | null = null;
  private pauseResolve: (() => void) | null = null;

  constructor(options: Partial<ParallelGenerationOptions>) {
    // OPTIMIZADO para nano-banana-pro: 2x más rápido, mejor concurrencia
    this.options = {
      maxConcurrent: options.maxConcurrent ?? 6,        // Aumentado de 3 a 6
      requestDelayMs: options.requestDelayMs ?? 200,    // Reducido de 500 a 200ms
      rateLimitPerMinute: options.rateLimitPerMinute ?? 60, // Aumentado de 30 a 60
      prioritizePerformance: options.prioritizePerformance ?? true,
      onProgress: options.onProgress ?? (() => {}),
      onImageComplete: options.onImageComplete ?? (() => {}),
      onBatchComplete: options.onBatchComplete ?? (() => {}),
      onError: options.onError ?? (() => {})
    };

    this.semaphore = new Semaphore(this.options.maxConcurrent);
    this.rateLimiter = new RateLimiter(this.options.rateLimitPerMinute);
    this.queue = new PriorityQueue();
  }

  /**
   * Get priority based on shot category
   */
  private getCategoryPriority(category: ShotCategory): number {
    if (!this.options.prioritizePerformance) return 50;
    
    switch (category) {
      case 'PERFORMANCE': return 100; // Highest
      case 'STORY': return 75;
      case 'B-ROLL': return 50;
      default: return 50;
    }
  }

  /**
   * Add tasks to the queue
   */
  addTasks(tasks: Omit<GenerationTask, 'priority' | 'retryCount' | 'maxRetries'>[]): void {
    tasks.forEach(task => {
      this.queue.enqueue({
        ...task,
        priority: this.getCategoryPriority(task.shotCategory),
        retryCount: 0,
        maxRetries: 3
      });
    });
    this.totalCount = this.queue.size();
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<GenerationResult[]> {
    if (this.isRunning) {
      console.warn('Generator is already running');
      return this.results;
    }

    this.isRunning = true;
    this.isCancelled = false;
    this.completedCount = 0;
    this.results = [];
    
    const workers: Promise<void>[] = [];

    // Start worker threads
    for (let i = 0; i < this.options.maxConcurrent; i++) {
      workers.push(this.worker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);
    
    this.isRunning = false;
    this.options.onBatchComplete(this.results);
    
    return this.results;
  }

  /**
   * Worker that processes tasks from the queue
   */
  private async worker(): Promise<void> {
    while (!this.queue.isEmpty() && !this.isCancelled) {
      // Check for pause
      if (this.isPaused) {
        await this.waitForResume();
        if (this.isCancelled) break;
      }

      const task = this.queue.dequeue();
      if (!task) break;

      try {
        // Acquire semaphore permit
        await this.semaphore.acquire();
        
        // Wait for rate limit
        await this.rateLimiter.waitForToken();

        // Delay between requests
        if (this.completedCount > 0) {
          await this.delay(this.options.requestDelayMs);
        }

        // Generate image
        const result = await this.generateImage(task);
        
        this.results.push(result);
        this.completedCount++;
        
        this.options.onProgress(this.completedCount, this.totalCount, task);
        this.options.onImageComplete(result);

      } catch (error) {
        // Handle retry
        if (task.retryCount < task.maxRetries) {
          task.retryCount++;
          task.priority -= 10; // Lower priority on retry
          this.queue.enqueue(task);
        } else {
          const result: GenerationResult = {
            id: task.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timeTaken: 0
          };
          this.results.push(result);
          this.completedCount++;
          this.options.onError(task, error instanceof Error ? error : new Error('Unknown error'));
        }
      } finally {
        this.semaphore.release();
      }
    }
  }

  /**
   * Generate a single image
   */
  private async generateImage(task: GenerationTask): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      const endpoint = task.faceReferenceUrl 
        ? '/api/fal/nano-banana/generate-with-face'
        : '/api/fal/nano-banana/generate';

      const payload = task.faceReferenceUrl
        ? {
            prompt: task.prompt,
            faceImageUrl: task.faceReferenceUrl,
            negativePrompt: 'blurry, low quality, deformed, ugly, bad anatomy, collage, multiple images, grid, split screen',
            width: 1280,
            height: 720
          }
        : {
            prompt: task.prompt,
            negativePrompt: 'blurry, low quality, deformed, ugly, bad anatomy, collage, multiple images, grid, split screen',
            width: 1280,
            height: 720
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const timeTaken = Date.now() - startTime;

      if (data.imageUrl || data.url) {
        return {
          id: task.id,
          success: true,
          imageUrl: data.imageUrl || data.url,
          timeTaken
        };
      } else {
        throw new Error('No image URL in response');
      }
    } catch (error) {
      const timeTaken = Date.now() - startTime;
      
      // Apply exponential backoff before retrying
      if (task.retryCount > 0) {
        const backoffTime = Math.min(1000 * Math.pow(2, task.retryCount), 10000);
        await this.delay(backoffTime);
      }

      throw error;
    }
  }

  /**
   * Pause processing
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    
    this.isPaused = true;
    this.pausePromise = new Promise(resolve => {
      this.pauseResolve = resolve;
    });
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    this.pauseResolve?.();
    this.pausePromise = null;
    this.pauseResolve = null;
  }

  /**
   * Cancel processing
   */
  cancel(): void {
    this.isCancelled = true;
    if (this.isPaused) {
      this.resume();
    }
  }

  /**
   * Wait for resume signal
   */
  private async waitForResume(): Promise<void> {
    if (this.pausePromise) {
      await this.pausePromise;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    completed: number;
    total: number;
    remaining: number;
    progress: number;
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      completed: this.completedCount,
      total: this.totalCount,
      remaining: this.queue.size(),
      progress: this.totalCount > 0 ? (this.completedCount / this.totalCount) * 100 : 0
    };
  }
}

/**
 * Hook-friendly wrapper for React components
 */
export function createImageGenerator(options: Partial<ParallelGenerationOptions>): ParallelImageGenerator {
  return new ParallelImageGenerator(options);
}

/**
 * Utility: Batch scenes into generation tasks
 */
export function prepareBatchTasks(
  scenes: Array<{
    id: string;
    sceneIndex: number;
    prompt: string;
    shotCategory: ShotCategory;
    faceReferenceUrl?: string;
  }>
): Omit<GenerationTask, 'priority' | 'retryCount' | 'maxRetries'>[] {
  return scenes.map(scene => ({
    id: scene.id,
    sceneIndex: scene.sceneIndex,
    prompt: scene.prompt,
    shotCategory: scene.shotCategory,
    faceReferenceUrl: scene.faceReferenceUrl
  }));
}

export default ParallelImageGenerator;
