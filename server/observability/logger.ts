/**
 * Structured logger — zero new dependencies.
 * ==========================================
 * Emits single-line JSON in production (parseable by Render/Datadog/Logtail)
 * and a readable line in development. Carries a per-request id so a request's
 * logs can be correlated. Intentionally tiny: console under the hood, so it
 * never adds startup cost or a dependency.
 */
import { ROLE } from '../bootstrap/role';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[(process.env.LOG_LEVEL as Level) || 'info'] ?? LEVELS.info;
const PRETTY = process.env.NODE_ENV !== 'production';

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const base = { level, time: new Date().toISOString(), role: ROLE, msg, ...fields };
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (PRETTY) {
    const extra = fields && Object.keys(fields).length ? ' ' + JSON.stringify(fields) : '';
    sink(`[${level}] ${msg}${extra}`);
  } else {
    sink(JSON.stringify(base));
  }
}

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function make(bindings: Record<string, unknown> = {}): Logger {
  const merge = (f?: Record<string, unknown>) => ({ ...bindings, ...f });
  return {
    debug: (m, f) => emit('debug', m, merge(f)),
    info: (m, f) => emit('info', m, merge(f)),
    warn: (m, f) => emit('warn', m, merge(f)),
    error: (m, f) => emit('error', m, merge(f)),
    child: (b) => make({ ...bindings, ...b }),
  };
}

export const logger = make();
