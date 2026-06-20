/**
 * OpenClaw Gateway Service for Boostify
 * 
 * Controls the OpenClaw gateway lifecycle and provides a bridge
 * between Boostify's internal APIs and OpenClaw's agent orchestration.
 */
import { spawn, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/** Resolve the full path to the openclaw binary (needed on Windows where .cmd shims fail with spawn) */
function resolveOpenClawBin(): string {
  try {
    if (process.platform === 'win32') {
      const fullPath = execSync('where openclaw', { encoding: 'utf-8', stdio: 'pipe' })
        .split('\n')
        .map(l => l.trim())
        .find(l => l.endsWith('.cmd'));
      if (fullPath) {
        console.log(`[OpenClaw Gateway] Resolved binary: ${fullPath}`);
        return fullPath;
      }
    }
    execSync('openclaw --version', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    // fallback
  }
  return 'openclaw';
}

const OPENCLAW_BIN = resolveOpenClawBin();

export interface OpenClawStatus {
  enabled: boolean;
  running: boolean;
  pid: number | null;
  port: number;
  uptime: number | null;
  lastHealthCheck: string | null;
  error: string | null;
}

export interface OpenClawConfig {
  port: number;
  bind: string;
  model: string;
  verbose: boolean;
  workspace: string;
}

const DEFAULT_CONFIG: OpenClawConfig = {
  port: parseInt(process.env.OPENCLAW_PORT || '18789', 10),
  bind: process.env.OPENCLAW_BIND || 'loopback',
  model: process.env.OPENCLAW_MODEL || 'anthropic/claude-opus-4-6',
  verbose: false,
  workspace: '~/.openclaw/workspace',
};

class OpenClawGateway extends EventEmitter {
  private process: ChildProcess | null = null;
  private _enabled: boolean = process.env.OPENCLAW_ENABLED === 'true';
  private _running: boolean = false;
  private _startTime: number | null = null;
  private _lastHealthCheck: string | null = null;
  private _error: string | null = null;
  private config: OpenClawConfig;
  private healthInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<OpenClawConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get status(): OpenClawStatus {
    return {
      enabled: this._enabled,
      running: this._running,
      pid: this.process?.pid ?? null,
      port: this.config.port,
      uptime: this._startTime ? Date.now() - this._startTime : null,
      lastHealthCheck: this._lastHealthCheck,
      error: this._error,
    };
  }

  async enable(): Promise<void> {
    this._enabled = true;
    this._error = null;
    this.emit('status-change', this.status);
  }

  async disable(): Promise<void> {
    this._enabled = false;
    await this.stop();
    this.emit('status-change', this.status);
  }

  async start(): Promise<OpenClawStatus> {
    if (!this._enabled) {
      throw new Error('OpenClaw is disabled. Enable it first from the admin panel.');
    }

    if (this._running) {
      return this.status;
    }

    try {
      const args = [
        'gateway',
        'run',
        '--port', String(this.config.port),
        '--bind', this.config.bind,
      ];

      if (this.config.verbose) {
        args.push('--verbose');
      }

      console.log(`[OpenClaw Gateway] Spawning: ${OPENCLAW_BIN} ${args.join(' ')}`);

      this.process = spawn(OPENCLAW_BIN, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,  // Required on Windows to resolve .cmd shims
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.log(`[OpenClaw Gateway] ${msg}`);
          this.emit('log', { level: 'info', message: msg });
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.error(`[OpenClaw Gateway] ${msg}`);
          this.emit('log', { level: 'error', message: msg });
        }
      });

      this.process.on('close', (code) => {
        this._running = false;
        this._startTime = null;
        this.stopHealthChecks();
        if (code !== null && code !== 0) {
          this._error = `Gateway exited with code ${code}`;
        }
        this.emit('status-change', this.status);
        console.log(`[OpenClaw Gateway] Process exited with code ${code}`);
      });

      this.process.on('error', (err) => {
        this._running = false;
        this._error = err.message;
        this.emit('status-change', this.status);
        console.error(`[OpenClaw Gateway] Error:`, err.message);
      });

      this._running = true;
      this._startTime = Date.now();
      this._error = null;
      this.startHealthChecks();
      this.emit('status-change', this.status);

      console.log(`[OpenClaw Gateway] Started on ${this.config.bind}:${this.config.port}`);
      return this.status;
    } catch (err: any) {
      this._error = err.message;
      this._running = false;
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.stopHealthChecks();
    if (this._running && this.process) {
      // Use the CLI stop command which handles the lock file properly
      try {
        execSync(`${OPENCLAW_BIN} gateway stop`, { timeout: 5000, stdio: 'pipe' });
      } catch {
        // Fallback to SIGTERM if CLI stop fails
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
        }
      }
    }
    this.process = null;
    this._running = false;
    this._startTime = null;
    this._error = null;
    this.emit('status-change', this.status);
    console.log('[OpenClaw Gateway] Stopped');
  }

  async healthCheck(): Promise<{ ok: boolean; details?: any }> {
    if (!this._running) {
      return { ok: false, details: { error: 'Gateway not running' } };
    }
    try {
      const result = execSync(`${OPENCLAW_BIN} gateway health --port ${this.config.port}`, {
        encoding: 'utf-8',
        timeout: 8000,
        stdio: 'pipe',
      });
      this._lastHealthCheck = new Date().toISOString();
      return { ok: true, details: { output: result.trim() } };
    } catch (err: any) {
      // If the command fails, check if the process is still alive
      if (this.process && !this.process.killed) {
        this._lastHealthCheck = new Date().toISOString();
        return { ok: true, details: { method: 'process-alive' } };
      }
      return { ok: false, details: { error: err.message } };
    }
  }

  async sendMessage(message: string, sessionId?: string): Promise<any> {
    if (!this._running) {
      throw new Error('OpenClaw gateway is not running');
    }

    try {
      const host = this.config.bind === 'loopback' ? '127.0.0.1' : this.config.bind;
      const url = `http://${host}:${this.config.port}/api/agent`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = process.env.OPENCLAW_INTERNAL_TOKEN;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          sessionId: sessionId || 'boostify-main',
        }),
      });
      return await response.json();
    } catch (err: any) {
      throw new Error(`Failed to send message to OpenClaw: ${err.message}`);
    }
  }

  private startHealthChecks(): void {
    this.healthInterval = setInterval(async () => {
      const health = await this.healthCheck();
      if (!health.ok && this._running) {
        this._error = 'Health check failed';
        this.emit('health-fail', health);
      }
    }, 30000);
  }

  private stopHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }
}

// Singleton instance
let instance: OpenClawGateway | null = null;

export function getOpenClawGateway(config?: Partial<OpenClawConfig>): OpenClawGateway {
  if (!instance) {
    instance = new OpenClawGateway(config);
  }
  return instance;
}

export { OpenClawGateway };
