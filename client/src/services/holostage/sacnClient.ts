// ─── sACN Client (E1.31) ──────────────────────────────────────────────────────
// Sends DMX universe data via sACN (Streaming ACN / E1.31) protocol.
// MVP1: Simulation. MVP2: Real multicast UDP via backend proxy.
//
// sACN spec:
//   UDP port: 5568
//   Multicast: 239.255.X.Y where X.Y = universe (big-endian)
//   Packet: Root PDU + Framing PDU + DMP PDU

export interface SACNConfig {
  ip: string;
  port: number;         // default 5568
  universe: number;     // 1-63999
  priority: number;     // 0-200, default 100
  sourceUuid: string;   // 128-bit UUID for this sender
  sourceName: string;
  simulationMode: boolean;
}

export const DEFAULT_SACN_CONFIG: SACNConfig = {
  ip: '239.255.0.1',
  port: 5568,
  universe: 1,
  priority: 100,
  sourceUuid: '00000000-0000-0000-0000-000000000001',
  sourceName: 'Boostify StageOS',
  simulationMode: true,
};

type SACNUpdateCallback = (universe: number, channels: Uint8Array) => void;

class SACNClient {
  private config: SACNConfig = { ...DEFAULT_SACN_CONFIG };
  private callbacks: SACNUpdateCallback[] = [];
  private connected = false;
  private sequenceNum = 0;
  private lastSentAt = 0;
  private sendThrottleMs = 1000 / 44;
  private simUniverse = new Uint8Array(512);

  configure(config: Partial<SACNConfig>): void {
    this.config = { ...this.config, ...config };
  }

  connect(): Promise<void> {
    this.connected = true;
    if (!this.config.simulationMode) {
      console.info('[sACN] Real sACN requires Node.js backend proxy. Using simulation for browser preview.');
    }
    return Promise.resolve();
  }

  disconnect(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Compute multicast IP for a given universe
  static universeToMulticast(universe: number): string {
    const hi = (universe >> 8) & 0xFF;
    const lo = universe & 0xFF;
    return `239.255.${hi}.${lo}`;
  }

  // ─── Send DMX data ────────────────────────────────────────────────────────

  sendDmx(universe: number, channels: Uint8Array): void {
    if (!this.connected) return;

    const now = performance.now();
    if (now - this.lastSentAt < this.sendThrottleMs) return;
    this.lastSentAt = now;

    if (this.config.simulationMode) {
      this.simUniverse.set(channels.slice(0, 512));
      this.callbacks.forEach(cb => cb(universe, new Uint8Array(channels)));
      return;
    }

    this.sendViaProxy(universe, channels);
  }

  // Build E1.31 packet (simplified)
  buildPacket(universe: number, channels: Uint8Array): Uint8Array {
    const sourceNameBytes = new TextEncoder().encode(this.config.sourceName.padEnd(64, '\0').slice(0, 64));
    const uuidBytes = this.uuidToBytes(this.config.sourceUuid);

    // Total packet = Root(16+38) + Framing(77) + DMP(10 + 513)
    // Simplified: 126 bytes overhead + 512 data
    const totalLength = 638;
    const packet = new Uint8Array(totalLength);

    // ACN Packet Identifier
    const acnId = [0x00, 0x10, 0x00, 0x00, 0x41, 0x53, 0x43, 0x2D, 0x45, 0x31, 0x2E, 0x31, 0x37, 0x00, 0x00, 0x00];
    packet.set(acnId, 0);

    // Preamble size
    packet[16] = 0x00;
    packet[17] = 0x10;

    // PDU Length (flags + length)
    const pduLen = totalLength - 16;
    packet[18] = 0x70 | ((pduLen >> 8) & 0x0F);
    packet[19] = pduLen & 0xFF;

    // Vector: VECTOR_ROOT_E131_DATA (0x00000004)
    packet[20] = 0x00; packet[21] = 0x00; packet[22] = 0x00; packet[23] = 0x04;

    // Source UUID
    packet.set(uuidBytes, 24);

    // Sequence number
    packet[40] = this.sequenceNum++ & 0xFF;

    // Priority
    packet[41] = this.config.priority & 0xFF;

    // Universe (big-endian)
    packet[113] = (universe >> 8) & 0xFF;
    packet[114] = universe & 0xFF;

    // Start code (0x00 = NULL start code)
    packet[125] = 0x00;

    // Channel data (512 bytes)
    packet.set(channels.slice(0, 512), 126);

    return packet;
  }

  private uuidToBytes(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    }
    return bytes;
  }

  private sendViaProxy(universe: number, channels: Uint8Array): void {
    const msg = {
      type: 'sacn_dmx',
      universe,
      channels: Array.from(channels),
      multicastIp: SACNClient.universeToMulticast(universe),
      port: this.config.port,
      priority: this.config.priority,
    };
    if (typeof window !== 'undefined' && (window as Window & { __holostageWS?: WebSocket }).__holostageWS) {
      const ws = (window as Window & { __holostageWS?: WebSocket }).__holostageWS!;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }
  }

  // ─── Subscription ─────────────────────────────────────────────────────────

  onUpdate(cb: SACNUpdateCallback): () => void {
    this.callbacks.push(cb);
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb); };
  }

  getSimUniverse(): Uint8Array {
    return new Uint8Array(this.simUniverse);
  }
}

export const sacnClient = new SACNClient();
