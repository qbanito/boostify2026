/**
 * AIAPS Worker Bridge — minimal polling loop for Chrome extensions
 * (manifest v3 service workers) or Node workers.
 *
 * Usage in extension background script:
 *   import { startAiapsWorker } from './aiaps-worker';
 *   startAiapsWorker({
 *     baseUrl: 'https://boostifymusic.com',
 *     apiKey: await chrome.storage.local.get('aiapsToken'),
 *     workerId: 'ig-ext-' + chrome.runtime.id,
 *     platforms: ['instagram'],
 *     handlers: {
 *       signup: async (job) => ({ ok: true, data: { step: 'form-filled' } }),
 *       verify: async (job) => ({ ok: true }),
 *       configure_profile: async (job) => ({ ok: true }),
 *       post: async (job) => ({ ok: true }),
 *       warmup_action: async (job) => ({ ok: true }),
 *     },
 *   });
 */
export type JobKind = 'signup' | 'verify' | 'configure_profile' | 'warmup_action' | 'health_check' | 'post';

export interface WorkerJob {
  id: number;
  kind: JobKind;
  platform?: string;
  artist_id?: string;
  account_id?: number;
  payload?: any;
}

export type JobHandler = (job: WorkerJob) => Promise<{ ok: boolean; data?: any; error?: string }>;

export interface WorkerConfig {
  baseUrl: string;
  apiKey?: string;
  cookie?: string;
  workerId: string;
  platforms?: string[];
  kinds?: JobKind[];
  pollIntervalMs?: number;
  handlers: Partial<Record<JobKind, JobHandler>>;
  onLog?: (line: string) => void;
}

export function startAiapsWorker(cfg: WorkerConfig): () => void {
  const log = cfg.onLog || ((m: string) => console.log('[aiaps-worker]', m));
  let stopped = false;
  const interval = cfg.pollIntervalMs ?? 30_000;

  const headers = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
    if (cfg.cookie) h.Cookie = cfg.cookie;
    return h;
  };

  async function tick() {
    if (stopped) return;
    try {
      const claim = await fetch(`${cfg.baseUrl}/api/admin/artist-identity/jobs/claim`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ worker_id: cfg.workerId, kinds: cfg.kinds, platforms: cfg.platforms }),
      });
      const claimData = await claim.json().catch(() => ({}));
      const job: WorkerJob | null = claimData?.job || null;
      if (!job) return;

      log(`Claimed job #${job.id} kind=${job.kind}`);
      const handler = cfg.handlers[job.kind];
      let result: { ok: boolean; data?: any; error?: string };
      if (!handler) {
        result = { ok: false, error: `no_handler_for_${job.kind}` };
      } else {
        try {
          result = await handler(job);
        } catch (err: any) {
          result = { ok: false, error: err?.message || String(err) };
        }
      }

      await fetch(`${cfg.baseUrl}/api/admin/artist-identity/jobs/${job.id}/report`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ worker_id: cfg.workerId, ...result }),
      });
      log(`Reported job #${job.id} ok=${result.ok}`);
    } catch (err: any) {
      log(`tick error: ${err?.message || err}`);
    }
  }

  const handle = setInterval(tick, interval);
  tick();
  return () => { stopped = true; clearInterval(handle); };
}
