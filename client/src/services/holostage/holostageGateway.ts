// ─── HoloStage Gateway (client connector) ───────────────────────────────────
// Thin browser-side client for the server `/ws/holostage` Show Orchestrator
// bridge (see server/holostage-gateway.ts).
//
// Connecting does three things:
//   1. Opens a WebSocket to `/ws/holostage` (same origin → Vite proxies to the
//      API server in dev, same host in prod).
//   2. Publishes the live socket as `window.__holostageWS` so the existing
//      Art-Net / sACN clients (artnetClient.ts / sacnClient.ts) start relaying
//      DMX out through the server's UDP bridge.
//   3. Registers this peer (role + room) so commands / telemetry / mocap frames
//      are routed to the Stage Node and Unreal runtime in the same show room.

export type GatewayRole = 'operator' | 'stage-node' | 'unreal' | 'mocap';

export interface GatewayConnectOptions {
  artistId?: string | number;
  showId?: string | number;
  role?: GatewayRole;
  label?: string;
}

export interface GatewayStatus {
  connected: boolean;
  role: GatewayRole;
  room: string;
  peerId: string | null;
  reconnectAttempts: number;
}

type GatewayMessage = { type: string; [k: string]: any };
type MessageHandler = (msg: GatewayMessage) => void;

const WS_PATH = '/ws/holostage';
const MAX_BACKOFF_MS = 15_000;

class HolostageGateway {
  private ws: WebSocket | null = null;
  private opts: Required<GatewayConnectOptions> = {
    artistId: 'preview', showId: 'live', role: 'operator', label: '',
  };
  private peerId: string | null = null;
  private room = 'preview:live';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  /** type -> handlers; '*' receives every message. */
  private handlers = new Map<string, Set<MessageHandler>>();

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  connect(options: GatewayConnectOptions = {}): void {
    this.opts = {
      artistId: options.artistId != null ? String(options.artistId) : this.opts.artistId,
      showId: options.showId != null ? String(options.showId) : this.opts.showId,
      role: options.role ?? this.opts.role,
      label: options.label ?? this.opts.label,
    };
    this.manualClose = false;
    this.open();
  }

  private open(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams({
      role: this.opts.role,
      artistId: String(this.opts.artistId),
      showId: String(this.opts.showId),
    });
    if (this.opts.label) params.set('label', this.opts.label);
    const url = `${proto}://${window.location.host}${WS_PATH}?${params.toString()}`;

    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { this.scheduleReconnect(); return; }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      // Activate the dormant DMX relay path used by artnetClient / sacnClient.
      (window as Window & { __holostageWS?: WebSocket }).__holostageWS = ws;
      this.sendRaw({
        type: 'register',
        role: this.opts.role,
        artistId: this.opts.artistId,
        showId: this.opts.showId,
        label: this.opts.label || undefined,
      });
      this.emit({ type: '__open' });
    };

    ws.onmessage = (event) => {
      let msg: GatewayMessage;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'welcome' || msg.type === 'registered') {
        if (typeof msg.id === 'string') this.peerId = msg.id;
        if (typeof msg.room === 'string') this.room = msg.room;
      }
      this.emit(msg);
    };

    ws.onclose = () => {
      const w = window as Window & { __holostageWS?: WebSocket };
      if (w.__holostageWS === ws) delete w.__holostageWS;
      this.peerId = null;
      this.emit({ type: '__close' });
      if (!this.manualClose) this.scheduleReconnect();
    };

    ws.onerror = () => { /* close handler drives reconnect */ };
  }

  private scheduleReconnect(): void {
    if (this.manualClose) return;
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(this.reconnectAttempts, 5));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
      const w = window as Window & { __holostageWS?: WebSocket };
      if (w.__holostageWS === this.ws) delete w.__holostageWS;
    }
    this.ws = null;
    this.peerId = null;
  }

  // ─── Sending ─────────────────────────────────────────────────────────────

  private sendRaw(obj: GatewayMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify(obj)); return true; } catch { return false; }
    }
    return false;
  }

  send(type: string, data: Record<string, unknown> = {}): boolean {
    return this.sendRaw({ type, ...data });
  }

  /** Dispatch a show command to the Stage Node + Unreal runtime in this room. */
  sendCommand(command: string, payload?: unknown): boolean {
    return this.sendRaw({ type: 'command', command, payload: payload ?? null });
  }

  /** Publish telemetry (used when this peer is a stage-node / unreal source). */
  sendTelemetry(data: Record<string, unknown>): boolean {
    return this.sendRaw({ type: 'telemetry', data });
  }

  /** Publish a fail-safe state transition. */
  sendFailsafe(state: 'LIVE' | 'BLEND' | 'FALLBACK' | 'SAFE_POSE'): boolean {
    return this.sendRaw({ type: 'failsafe', state });
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  /** Subscribe to a message type ('*' for all). Returns an unsubscribe fn. */
  on(type: string, handler: MessageHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) { set = new Set(); this.handlers.set(type, set); }
    set.add(handler);
    return () => { set!.delete(handler); };
  }

  onCommand(handler: MessageHandler): () => void { return this.on('command', handler); }
  onTelemetry(handler: MessageHandler): () => void { return this.on('telemetry', handler); }
  onPresence(handler: MessageHandler): () => void { return this.on('presence', handler); }
  onFailsafe(handler: MessageHandler): () => void { return this.on('failsafe', handler); }
  onMocap(handler: MessageHandler): () => void {
    const offA = this.on('mocap', handler);
    const offB = this.on('livelink', handler);
    return () => { offA(); offB(); };
  }

  private emit(msg: GatewayMessage): void {
    const exact = this.handlers.get(msg.type);
    if (exact) for (const h of exact) { try { h(msg); } catch { /* handler error */ } }
    const all = this.handlers.get('*');
    if (all) for (const h of all) { try { h(msg); } catch { /* handler error */ } }
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  getStatus(): GatewayStatus {
    return {
      connected: !!this.ws && this.ws.readyState === WebSocket.OPEN,
      role: this.opts.role,
      room: this.room,
      peerId: this.peerId,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export const holostageGateway = new HolostageGateway();
