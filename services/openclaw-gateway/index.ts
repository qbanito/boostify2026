/**
 * OpenClaw Gateway Service for Boostify
 * 
 * Controls the OpenClaw gateway lifecycle and provides a bridge
 * between Boostify's internal APIs and OpenClaw's agent orchestration.
 */
import { spawn, exec, execSync, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/** Resolve the openclaw binary path. */
function getOpenClawBin(): string {
  try {
    // On Windows, resolve the full .cmd path so exec never fails with ENOENT
    if (process.platform === 'win32') {
      const fullPath = execSync('where openclaw', { encoding: 'utf-8', stdio: 'pipe' })
        .split('\n')
        .map(l => l.trim())
        .find(l => l.endsWith('.cmd'));
      if (fullPath) {
        console.log(`[OpenClaw Gateway] Resolved binary: ${fullPath}`);
        return `"${fullPath}"`;
      }
    }
    execSync('openclaw --version', { encoding: 'utf-8', stdio: 'pipe' });
    return 'openclaw';
  } catch {
    return 'openclaw';
  }
}

const OPENCLAW_BIN = getOpenClawBin();

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
  port: 18789,
  bind: 'loopback',
  model: 'anthropic/claude-opus-4-6',
  verbose: false,
  workspace: '~/.openclaw/workspace',
};

class OpenClawGateway extends EventEmitter {
  private process: ChildProcess | null = null;
  private _enabled: boolean = false;
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
        '--auth', 'token',
        '--token', process.env.OPENCLAW_INTERNAL_TOKEN || 'dev-token',
      ];

      if (this.config.verbose) {
        args.push('--verbose');
      }

      console.log(`[OpenClaw Gateway] Spawning: ${OPENCLAW_BIN} ${args.join(' ')}`);

      const cmd = `${OPENCLAW_BIN} ${args.join(' ')}`;
      // Inherit the parent's env as-is (don't override — avoids PATH/Path issues on Windows)
      this.process = exec(cmd);

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
        if (code !== 0) {
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
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this._running = false;
    this._startTime = null;
    this.emit('status-change', this.status);
    console.log('[OpenClaw Gateway] Stopped');
  }

  async healthCheck(): Promise<{ ok: boolean; details?: any }> {
    if (!this._running) {
      return { ok: false, details: { error: 'Gateway not running' } };
    }
    try {
      const result = await new Promise<{ ok: boolean; details?: any }>((resolve) => {
        const cmd = `${OPENCLAW_BIN} gateway health --port ${this.config.port}`;
        exec(cmd, { timeout: 8000 }, (error, stdout, stderr) => {
          if (!error) {
            this._lastHealthCheck = new Date().toISOString();
            resolve({ ok: true, details: { stdout: stdout.trim() } });
          } else {
            resolve({ ok: false, details: { code: error.code, stderr: stderr.trim(), stdout: stdout.trim() } });
          }
        });
      });
      return result;
    } catch {
      return { ok: false, details: { error: 'Gateway unreachable' } };
    }
  }

  private startHealthChecks(): void {
    this.healthInterval = setInterval(async () => {
      const health = await this.healthCheck();
      if (!health.ok && this._running) {
        this._error = 'Health check failed';
        this.emit('health-fail', health);
      }
    }, 30000); // Every 30 seconds
  }

  private stopHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  async sendMessage(message: string, sessionId?: string): Promise<any> {
    if (!this._running) {
      throw new Error('OpenClaw gateway is not running');
    }

    try {
      const url = `http://${this.config.bind}:${this.config.port}/api/agent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
