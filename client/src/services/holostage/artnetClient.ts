// ─── Art-Net Client ───────────────────────────────────────────────────────────
// Sends DMX universe data via Art-Net protocol.
// MVP1: Simulation only. MVP2: Real UDP Art-Net via browser WebSocket proxy or Electron.
//
// Art-Net spec:
//   UDP port: 6454
//   Packet: "Art-Net\0" header + OpCode + Protocol version + Sequence + Physical
//           + Universe (16-bit LE) + Length (16-bit BE) + Data[512]

export interface ArtNetConfig {
  ip: string;
  port: number;       // default 6454
  universe: number;   // 0-32767
  subnet: number;     // 0-15
  net: number;        // 0-127
  simulationMode: boolean;
}

export const DEFAULT_ARTNET_CONFIG: ArtNetConfig = {
  ip: '255.255.255.255',
  port: 6454,
  universe: 0,
  subnet: 0,
  net: 0,
  simulationMode: true,
};

type ArtNetUpdateCallback = (universe: number, channels: Uint8Array) => void;

class ArtNetClient {
  private config: ArtNetConfig = { ...DEFAULT_ARTNET_CONFIG };
  private callbacks: ArtNetUpdateCallback[] = [];
  private connected = false;
  private lastSentAt = 0;
  private sendThrottleMs = 1000 / 44; // ~44fps max per Art-Net spec

  // Simulation universe state
  private simUniverse = new Uint8Array(512);

  configure(config: Partial<ArtNetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  connect(): Promise<void> {
    this.connected = true;
    if (!this.config.simulationMode) {
      console.info('[ArtNet] Real Art-Net UDP requires Node.js backend proxy. Using simulation for browser preview.');
    }
    return Promise.resolve();
  }

  disconnect(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
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

    // In real mode: send via backend WebSocket proxy
    // The server-side holostage route will forward via dgram (Node.js UDP)
    this.sendViaProxy(universe, channels);
  }

  // Build Art-Net ArtDMX packet
  buildPacket(universe: number, channels: Uint8Array): Uint8Array {
    const header = new Uint8Array([
      0x41, 0x72, 0x74, 0x2D, 0x4E, 0x65, 0x74, 0x00, // "Art-Net\0"
      0x00, 0x50,  // OpCode: ArtDmx (0x5000, little-endian → 0x00, 0x50)
      0x00, 0x0E,  // Protocol version: 14
      0x00,        // Sequence
      0x00,        // Physical
    ]);

    // Universe: low byte is (universe & 0xF) | (subnet << 4), high byte is net
    const universeLE = new Uint8Array([
      (universe & 0x0F) | ((this.config.subnet & 0x0F) << 4),
      this.config.net & 0x7F,
    ]);

    // Length: number of channels, big-endian (must be even)
    const len = channels.length % 2 === 0 ? channels.length : channels.length + 1;
    const lengthBE = new Uint8Array([(len >> 8) & 0xFF, len & 0xFF]);

    const packet = new Uint8Array(18 + len);
    packet.set(header, 0);
    packet.set(universeLE, 14);
    packet.set(lengthBE, 16);
    packet.set(channels.slice(0, len), 18);

    return packet;
  }

  private sendViaProxy(universe: number, channels: Uint8Array): void {
    // Sends to /ws/holostage/dmx which relays to real Art-Net UDP
    const msg = {
      type: 'artnet_dmx',
      universe,
      channels: Array.from(channels),
      ip: this.config.ip,
      port: this.config.port,
    };
    // Broadcast to any registered WS channel
    if (typeof window !== 'undefined' && (window as Window & { __holostageWS?: WebSocket }).__holostageWS) {
      const ws = (window as Window & { __holostageWS?: WebSocket }).__holostageWS!;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }
  }

  // ─── Subscription ─────────────────────────────────────────────────────────

  onUpdate(cb: ArtNetUpdateCallback): () => void {
    this.callbacks.push(cb);
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb); };
  }

  getSimUniverse(): Uint8Array {
    return new Uint8Array(this.simUniverse);
  }
}

export const artnetClient = new ArtNetClient();
