// ─── HoloSuit Local REST API ────────────────────────────────────────────────────
// Interfaces with HoloSuit Studio's embedded Nancy HTTP server.
// All requests are proxied through the Boostify backend to avoid browser CORS.
//
// HoloSuit Studio local HTTP server (Nancy.dll):
//   Port: 14053  (default)
//   Ref:  StreamingAssets/web/templates/client.html
//
// Available endpoints (proxied via /api/holostage/holosuit-local):
//   POST /calibrate           — trigger HoloSuit T-pose calibration
//   POST /recording/start     — begin recording (body: filename=TakeName)
//   POST /recording/stop      — stop current recording

export interface HoloSuitLocalAPIConfig {
  host: string;      // IP of the machine running HoloSuit Studio
  apiPort: number;   // Nancy HTTP port (default 14053)
}

export interface HoloSuitLocalAPIResult {
  ok: boolean;
  message?: string;
  error?: string;
}

const PROXY_BASE = '/api/holostage/holosuit-local';

// ─── Calibrate ────────────────────────────────────────────────────────────────
// Triggers the HoloSuit T-pose calibration sequence in HoloSuit Studio.

export async function holosuitCalibrate(
  cfg: HoloSuitLocalAPIConfig,
): Promise<HoloSuitLocalAPIResult> {
  try {
    const res = await fetch(`${PROXY_BASE}/calibrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: cfg.host, port: cfg.apiPort }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Recording Start ──────────────────────────────────────────────────────────
// Starts a new recording take in HoloSuit Studio.

export async function holosuitStartRecording(
  cfg: HoloSuitLocalAPIConfig,
  filename: string,
): Promise<HoloSuitLocalAPIResult> {
  try {
    const res = await fetch(`${PROXY_BASE}/recording/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: cfg.host, port: cfg.apiPort, filename }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Recording Stop ───────────────────────────────────────────────────────────
// Stops the current recording take in HoloSuit Studio.

export async function holosuitStopRecording(
  cfg: HoloSuitLocalAPIConfig,
): Promise<HoloSuitLocalAPIResult> {
  try {
    const res = await fetch(`${PROXY_BASE}/recording/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: cfg.host, port: cfg.apiPort }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Ping ─────────────────────────────────────────────────────────────────────
// Check if HoloSuit Studio's local REST server is reachable.

export async function holosuitPing(cfg?: HoloSuitLocalAPIConfig): Promise<boolean> {
  try {
    const qs = cfg ? `?host=${encodeURIComponent(cfg.host)}&port=${cfg.apiPort}` : '';
    const res = await fetch(`${PROXY_BASE}/ping${qs}`, { method: 'GET', signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return data ? data.ok === true : true;
  } catch {
    return false;
  }
}
