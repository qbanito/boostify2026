/**
 * Circuit breaker — protect the platform from unstable upstreams.
 * ==============================================================
 * When a dependency (an AI provider, an external API) starts failing, hammering
 * it with retries makes things worse: every request piles up, holds memory and
 * starves the event loop. A circuit breaker "opens" after N consecutive
 * failures and fails fast for a cooldown window, then probes once ("half-open")
 * before fully closing again.
 *
 * Usage:
 *   const falBreaker = getBreaker('fal');
 *   const out = await falBreaker.exec(() => fetchJSON(url, init, 15000));
 */
export type BreakerState = 'closed' | 'open' | 'half';

export interface BreakerOptions {
  /** Consecutive failures before opening. Default 5. */
  threshold?: number;
  /** How long to stay open before probing again (ms). Default 30000. */
  cooldownMs?: number;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`circuit "${name}" is OPEN`);
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private fails = 0;
  private state: BreakerState = 'closed';
  private openedAt = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(public readonly name: string, opts: BreakerOptions = {}) {
    this.threshold = opts.threshold ?? 5;
    this.cooldownMs = opts.cooldownMs ?? 30_000;
  }

  getState(): BreakerState {
    if (this.state === 'open' && Date.now() - this.openedAt >= this.cooldownMs) {
      return 'half';
    }
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt < this.cooldownMs) {
        throw new CircuitOpenError(this.name);
      }
      // Cooldown elapsed → allow a single probe.
      this.state = 'half';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.fails = 0;
    if (this.state !== 'closed') {
      console.log(`[breaker] ${this.name} → CLOSED`);
    }
    this.state = 'closed';
  }

  private onFailure(): void {
    this.fails += 1;
    if (this.fails >= this.threshold && this.state !== 'open') {
      this.state = 'open';
      this.openedAt = Date.now();
      console.warn(`[breaker] ${this.name} → OPEN (after ${this.fails} failures)`);
    } else if (this.state === 'half') {
      // Probe failed → back to open for another cooldown.
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  stats() {
    return { name: this.name, state: this.getState(), fails: this.fails };
  }
}

// ─── Shared registry so the same upstream uses one breaker process-wide ──────
const registry = new Map<string, CircuitBreaker>();

export function getBreaker(name: string, opts?: BreakerOptions): CircuitBreaker {
  let b = registry.get(name);
  if (!b) {
    b = new CircuitBreaker(name, opts);
    registry.set(name, b);
  }
  return b;
}

export function allBreakerStats() {
  return [...registry.values()].map((b) => b.stats());
}
