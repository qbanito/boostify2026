// ─── HoloStage Real-Time Gateway ────────────────────────────────────────────
// The "Show Orchestrator" real-time bridge for Boostify StageOS / HoloStage.
//
// This is the missing server-side counterpart that the browser client already
// reaches for via `window.__holostageWS` (see client/src/services/holostage/
// artnetClient.ts + sacnClient.ts) and the mocap/Live Link receivers.
//
// It connects four kinds of peers over a single WebSocket endpoint
// (`/ws/holostage`) and routes messages by role + room (artistId:showId):
//
//   operator    — the web HoloStage Studio dashboard (drives the show)
//   stage-node  — the on-site bridge app (Tauri) that talks to Unreal/mocap/DMX
//   unreal      — an Unreal Engine runtime (Live Link / Pixel Streaming source)
//   mocap       — a motion-capture source (HoloSuit / phone / Rokoko)
//
// Responsibilities:
//   • Presence + heartbeat for every connected peer.
//   • Role-based routing of show commands, telemetry, mocap / Live Link frames
//     and fail-safe state between operators, the Stage Node and Unreal.
//   • WebRTC signalling passthrough for Pixel Streaming previews.
//   • DMX relay: turns browser `artnet_dmx` / `sacn_dmx` messages into real
//     Art-Net / sACN (E1.31) UDP datagrams via Node `dgram` (browsers cannot
//     emit UDP), with SSRF-safe target validation.
//   • Best-effort show logging into the existing `holostage_show_logs` table.

import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'http';
import { randomUUID } from 'crypto';
import dgram from 'dgram';
import { pool } from './db';

// ─── Constants ──────────────────────────────────────────────────────────────

const GATEWAY_PATH = '/ws/holostage';
const HEARTBEAT_INTERVAL_MS = 30_000;
const ARTNET_DEFAULT_PORT = 6454;
const SACN_DEFAULT_PORT = 5568;
const MAX_DMX_CHANNELS = 512;

type PeerRole = 'operator' | 'stage-node' | 'unreal' | 'mocap';
const VALID_ROLES: PeerRole[] = ['operator', 'stage-node', 'unreal', 'mocap'];

const SHOW_COMMANDS = [
  'START_SHOW', 'STOP_SHOW', 'PAUSE_SHOW', 'RESUME_SHOW',
  'REHEARSE', 'CALIBRATE', 'RECORD_START', 'RECORD_STOP',
  'BLACKOUT', 'SAFE_POSE', 'GO_CUE', 'NEXT_CUE', 'PREV_CUE',
] as const;
type ShowCommand = typeof SHOW_COMMANDS[number];

const FAILSAFE_STATES = ['LIVE', 'BLEND', 'FALLBACK', 'SAFE_POSE'] as const;

// ─── Peer bookkeeping ──────────────────────────────────────────────────────

interface Peer {
  id: string;
  role: PeerRole;
  room: string;          // `${artistId}:${showId}`
  artistId: string;
  showId: string;
  socket: WebSocket;
  isAlive: boolean;
  connectedAt: number;
  label?: string;
}

const peers = new Map<string, Peer>();
/** room -> set of peer ids */
const rooms = new Map<string, Set<string>>();

function roomKey(artistId: string, showId: string): string {
  return `${artistId || 'preview'}:${showId || 'live'}`;
}

function joinRoom(peer: Peer): void {
  let set = rooms.get(peer.room);
  if (!set) { set = new Set(); rooms.set(peer.room, set); }
  set.add(peer.id);
}

function leaveRoom(peer: Peer): void {
  const set = rooms.get(peer.room);
  if (set) {
    set.delete(peer.id);
    if (set.size === 0) rooms.delete(peer.room);
  }
}

function roomPeers(room: string): Peer[] {
  const ids = rooms.get(room);
  if (!ids) return [];
  const out: Peer[] = [];
  for (const id of ids) {
    const p = peers.get(id);
    if (p) out.push(p);
  }
  return out;
}

function send(peer: Peer, obj: unknown): void {
  if (peer.socket.readyState === WebSocket.OPEN) {
    try { peer.socket.send(JSON.stringify(obj)); } catch { /* socket dying */ }
  }
}

/** Send to every peer in `peer`'s room whose role is in `roles`, excluding the sender. */
function relayToRoles(from: Peer, roles: PeerRole[], obj: unknown): number {
  let n = 0;
  for (const p of roomPeers(from.room)) {
    if (p.id === from.id) continue;
    if (!roles.includes(p.role)) continue;
    send(p, obj);
    n++;
  }
  return n;
}

function broadcastPresence(room: string): void {
  const occupants = roomPeers(room).map(p => ({
    id: p.id, role: p.role, label: p.label, connectedAt: p.connectedAt,
  }));
  const msg = { type: 'presence', room, peers: occupants, count: occupants.length };
  for (const p of roomPeers(room)) send(p, msg);
}

// ─── UDP / DMX relay (SSRF-guarded) ─────────────────────────────────────────

let udp: dgram.Socket | null = null;
let artnetSequence = 0;
let sacnSequence = 0;
const GATEWAY_CID = uuidToBytes(randomUUID()); // stable sACN component id for this process

function getUdp(): dgram.Socket {
  if (udp) return udp;
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('error', (err) => console.warn('[holostage-gateway] UDP socket error:', err?.message));
  sock.bind(() => {
    try { sock.setBroadcast(true); } catch { /* not permitted, ignore */ }
    try { sock.setMulticastTTL(16); } catch { /* ignore */ }
  });
  udp = sock;
  return sock;
}

/** Allow only LAN / loopback / Art-Net (2.x, 10.x) unicast + directed broadcast — never the public internet. */
function isAllowedArtnetTarget(ip: string): boolean {
  if (typeof ip !== 'string') return false;
  if (ip === 'localhost') return true;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return false;
  const [a, b] = o;
  if (a === 127) return true;                         // loopback
  if (a === 10) return true;                          // RFC-1918 / Art-Net primary
  if (a === 172 && b >= 16 && b <= 31) return true;   // RFC-1918
  if (a === 192 && b === 168) return true;            // RFC-1918
  if (a === 2) return true;                           // Art-Net legacy range
  if (a === 169 && b === 254) return true;            // link-local
  return false;
}

/** sACN multicast lives in 239.255.0.0/16; also permit LAN unicast for unicast E1.31. */
function isAllowedSacnTarget(ip: string): boolean {
  if (typeof ip !== 'string') return false;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some(n => n > 255)) return false;
  const [a, b] = o;
  if (a === 239 && b === 255) return true;            // E1.31 multicast
  return isAllowedArtnetTarget(ip);                   // unicast E1.31 on the LAN
}

function clampChannels(channels: unknown): number[] {
  if (!Array.isArray(channels)) return [];
  return channels.slice(0, MAX_DMX_CHANNELS).map(v => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(255, Math.round(n)));
  });
}

/** Build a standards-compliant Art-Net ArtDMX packet. */
function buildArtDmxPacket(universe: number, channels: number[], sequence: number): Buffer {
  let len = channels.length;
  if (len % 2 !== 0) len += 1;                 // length must be even
  len = Math.max(2, Math.min(MAX_DMX_CHANNELS, len));
  const buf = Buffer.alloc(18 + len);
  buf.write('Art-Net', 0, 'ascii');            // bytes 0-6, byte 7 stays 0x00 (null term)
  buf.writeUInt16LE(0x5000, 8);                // OpCode = OpOutput / ArtDmx
  buf.writeUInt8(0, 10); buf.writeUInt8(14, 11); // Protocol version 14 (Hi/Lo)
  buf.writeUInt8(sequence & 0xff, 12);         // Sequence
  buf.writeUInt8(0, 13);                       // Physical
  buf.writeUInt8(universe & 0xff, 14);         // SubUni (low byte of 15-bit universe)
  buf.writeUInt8((universe >> 8) & 0x7f, 15);  // Net (high 7 bits)
  buf.writeUInt16BE(len, 16);                  // Length (big-endian)
  for (let i = 0; i < channels.length && i < len; i++) buf.writeUInt8(channels[i], 18 + i);
  return buf;
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, '');
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
  return buf;
}

/** Build a standards-compliant sACN (ANSI E1.31) data packet. */
function buildSacnPacket(universe: number, channels: number[], sequence: number, priority: number): Buffer {
  const slots = Math.max(1, Math.min(MAX_DMX_CHANNELS, channels.length));
  const total = 126 + slots;
  const buf = Buffer.alloc(total);

  // ── Root layer ──
  buf.writeUInt16BE(0x0010, 0);                       // Preamble size
  buf.writeUInt16BE(0x0000, 2);                       // Postamble size
  buf.write('ASC-E1.17', 4, 'ascii');                 // ACN packet identifier (12 bytes, null padded)
  buf.writeUInt16BE(0x7000 | (total - 16), 16);       // Flags(0x7) + root PDU length
  buf.writeUInt32BE(0x00000004, 18);                  // VECTOR_ROOT_E131_DATA
  GATEWAY_CID.copy(buf, 22);                           // CID (16 bytes)

  // ── Framing layer ──
  buf.writeUInt16BE(0x7000 | (total - 38), 38);       // Flags + framing PDU length
  buf.writeUInt32BE(0x00000002, 40);                  // VECTOR_E131_DATA_PACKET
  buf.write('Boostify HoloStage', 44, 'utf8');        // Source name (64 bytes, null padded)
  buf.writeUInt8(Math.max(0, Math.min(200, priority || 100)), 108); // Priority
  buf.writeUInt16BE(0, 109);                          // Synchronization address
  buf.writeUInt8(sequence & 0xff, 111);               // Sequence number
  buf.writeUInt8(0, 112);                             // Options
  buf.writeUInt16BE(universe & 0xffff, 113);          // Universe

  // ── DMP layer ──
  buf.writeUInt16BE(0x7000 | (total - 115), 115);     // Flags + DMP PDU length
  buf.writeUInt8(0x02, 117);                          // VECTOR_DMP_SET_PROPERTY
  buf.writeUInt8(0xa1, 118);                          // Address type & data type
  buf.writeUInt16BE(0x0000, 119);                     // First property address
  buf.writeUInt16BE(0x0001, 121);                     // Address increment
  buf.writeUInt16BE(slots + 1, 123);                  // Property value count (+1 for start code)
  buf.writeUInt8(0x00, 125);                          // DMX start code
  for (let i = 0; i < slots; i++) buf.writeUInt8(channels[i] ?? 0, 126 + i);

  return buf;
}

function relayArtnet(msg: any): { ok: boolean; reason?: string } {
  const ip = String(msg.ip || '').trim();
  if (!isAllowedArtnetTarget(ip)) return { ok: false, reason: 'blocked_target' };
  const port = Number(msg.port) || ARTNET_DEFAULT_PORT;
  if (port < 1 || port > 65535) return { ok: false, reason: 'bad_port' };
  const universe = Number(msg.universe) || 0;
  const channels = clampChannels(msg.channels);
  const packet = buildArtDmxPacket(universe, channels, artnetSequence = (artnetSequence + 1) & 0xff);
  getUdp().send(packet, port, ip === 'localhost' ? '127.0.0.1' : ip);
  return { ok: true };
}

function relaySacn(msg: any): { ok: boolean; reason?: string } {
  const ip = String(msg.multicastIp || msg.ip || '').trim();
  if (!isAllowedSacnTarget(ip)) return { ok: false, reason: 'blocked_target' };
  const port = Number(msg.port) || SACN_DEFAULT_PORT;
  if (port < 1 || port > 65535) return { ok: false, reason: 'bad_port' };
  const universe = Number(msg.universe) || 1;
  const priority = Number(msg.priority) || 100;
  const channels = clampChannels(msg.channels);
  const packet = buildSacnPacket(universe, channels, sacnSequence = (sacnSequence + 1) & 0xff, priority);
  getUdp().send(packet, port, ip);
  return { ok: true };
}

// ─── Best-effort show logging ───────────────────────────────────────────────

async function logShowEvent(showId: string, eventType: string, payload: unknown): Promise<void> {
  const numericId = Number(showId);
  if (!Number.isInteger(numericId) || numericId <= 0) return; // only persist real shows
  try {
    await pool.query(
      `INSERT INTO holostage_show_logs (show_id, event_type, payload, started_at)
       VALUES ($1, $2, $3, NOW())`,
      [numericId, String(eventType).slice(0, 64), JSON.stringify(payload ?? {})],
    );
  } catch {
    // table may not exist yet / transient DB error — never break the relay
  }
}

// ─── Message handling ────────────────────────────────────────────────────────

function handleMessage(peer: Peer, raw: RawData): void {
  let msg: any;
  try { msg = JSON.parse(raw.toString()); } catch { return; }
  if (!msg || typeof msg.type !== 'string') return;

  switch (msg.type) {
    // ── Presence / lifecycle ──
    case 'ping':
      send(peer, { type: 'pong', t: Date.now() });
      return;

    case 'register':
    case 'join': {
      const nextRole = VALID_ROLES.includes(msg.role) ? (msg.role as PeerRole) : peer.role;
      const nextArtist = msg.artistId != null ? String(msg.artistId) : peer.artistId;
      const nextShow = msg.showId != null ? String(msg.showId) : peer.showId;
      const nextRoom = roomKey(nextArtist, nextShow);
      if (nextRoom !== peer.room) { leaveRoom(peer); peer.room = nextRoom; }
      peer.role = nextRole;
      peer.artistId = nextArtist;
      peer.showId = nextShow;
      if (typeof msg.label === 'string') peer.label = msg.label.slice(0, 80);
      joinRoom(peer);
      send(peer, { type: 'registered', id: peer.id, role: peer.role, room: peer.room });
      broadcastPresence(peer.room);
      return;
    }

    // ── DMX relay → real UDP (operators / stage-node) ──
    case 'artnet_dmx': {
      const r = relayArtnet(msg);
      if (!r.ok) send(peer, { type: 'dmx_error', protocol: 'artnet', reason: r.reason });
      return;
    }
    case 'sacn_dmx': {
      const r = relaySacn(msg);
      if (!r.ok) send(peer, { type: 'dmx_error', protocol: 'sacn', reason: r.reason });
      return;
    }

    // ── Show commands: operator → stage-node + unreal ──
    case 'command': {
      const command = String(msg.command || '') as ShowCommand;
      if (!SHOW_COMMANDS.includes(command)) {
        send(peer, { type: 'command_error', reason: 'unknown_command', command });
        return;
      }
      const envelope = {
        type: 'command', command, payload: msg.payload ?? null,
        from: peer.id, at: Date.now(),
      };
      const delivered = relayToRoles(peer, ['stage-node', 'unreal'], envelope);
      send(peer, { type: 'command_ack', command, delivered });
      void logShowEvent(peer.showId, `command:${command}`, { from: peer.role, payload: msg.payload ?? null });
      return;
    }

    // ── Telemetry: stage-node / unreal → operators ──
    case 'telemetry': {
      const envelope = { type: 'telemetry', from: peer.id, role: peer.role, data: msg.data ?? msg.payload ?? {}, at: Date.now() };
      relayToRoles(peer, ['operator'], envelope);
      return;
    }

    // ── Fail-safe state: stage-node / unreal → operators ──
    case 'failsafe': {
      const state = String(msg.state || '');
      if (!FAILSAFE_STATES.includes(state as any)) return;
      relayToRoles(peer, ['operator'], { type: 'failsafe', state, from: peer.id, at: Date.now() });
      void logShowEvent(peer.showId, `failsafe:${state}`, { from: peer.role });
      return;
    }

    // ── Mocap / Live Link frames: mocap / stage-node → unreal + operators ──
    case 'mocap':
    case 'livelink': {
      const envelope = { type: msg.type, from: peer.id, role: peer.role, frame: msg.frame ?? msg.data ?? null, subject: msg.subject ?? null, at: Date.now() };
      relayToRoles(peer, ['unreal', 'operator', 'stage-node'], envelope);
      return;
    }

    // ── Performance cue: song selection / record state shared between the
    //    desktop studio (operator) and the phone camera (mocap), so both ends
    //    stay in sync about which song is being performed and recording state.
    case 'cue': {
      const envelope = { type: 'cue', from: peer.id, role: peer.role, cue: msg.cue ?? null, at: Date.now() };
      relayToRoles(peer, ['operator', 'mocap', 'unreal', 'stage-node'], envelope);
      return;
    }

    // ── WebRTC signalling passthrough (Pixel Streaming preview) ──
    case 'pixelstream-offer':
    case 'pixelstream-answer':
    case 'pixelstream-ice': {
      const envelope = { ...msg, from: peer.id, at: Date.now() };
      // Signalling flows between operators and the unreal / stage-node runtime.
      relayToRoles(peer, peer.role === 'operator' ? ['unreal', 'stage-node'] : ['operator'], envelope);
      return;
    }

    default:
      // Unknown types are ignored (forward-compatible).
      return;
  }
}

// ─── Server setup ──────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;
let heartbeat: NodeJS.Timeout | null = null;

export function initHolostageGateway(httpServer: HttpServer): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  // Manual upgrade handling so we coexist with Socket.io (which owns /socket.io).
  httpServer.on('upgrade', (req: IncomingMessage, socket, head) => {
    let pathname = '';
    try { pathname = new URL(req.url || '', 'http://localhost').pathname; } catch { pathname = req.url || ''; }
    // Only claim our own path; leave every other upgrade (e.g. Socket.io) untouched.
    if (pathname !== GATEWAY_PATH && pathname !== `${GATEWAY_PATH}/dmx`) return;
    wss!.handleUpgrade(req, socket, head, (ws) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
    // Seed role/room from query string so simple clients can connect in one step.
    let q: URLSearchParams;
    try { q = new URL(req.url || '', 'http://localhost').searchParams; } catch { q = new URLSearchParams(); }
    const roleParam = q.get('role');
    const role: PeerRole = VALID_ROLES.includes(roleParam as PeerRole) ? (roleParam as PeerRole) : 'operator';
    const artistId = q.get('artistId') || 'preview';
    const showId = q.get('showId') || 'live';

    const peer: Peer = {
      id: randomUUID(),
      role,
      artistId,
      showId,
      room: roomKey(artistId, showId),
      socket,
      isAlive: true,
      connectedAt: Date.now(),
      label: q.get('label') || undefined,
    };
    peers.set(peer.id, peer);
    joinRoom(peer);

    send(peer, { type: 'welcome', id: peer.id, role: peer.role, room: peer.room, serverTime: Date.now() });
    broadcastPresence(peer.room);

    socket.on('pong', () => { peer.isAlive = true; });
    socket.on('message', (data) => handleMessage(peer, data));
    socket.on('error', () => { /* handled by close */ });
    socket.on('close', () => {
      leaveRoom(peer);
      peers.delete(peer.id);
      broadcastPresence(peer.room);
    });
  });

  // Heartbeat: drop peers that stop responding to pings.
  heartbeat = setInterval(() => {
    for (const peer of peers.values()) {
      if (!peer.isAlive) { try { peer.socket.terminate(); } catch { /* ignore */ } continue; }
      peer.isAlive = false;
      try { peer.socket.ping(); } catch { /* ignore */ }
    }
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  console.log(`🛰️  HoloStage Gateway listening on ws://<host>${GATEWAY_PATH} (Show Orchestrator bridge)`);
  return wss;
}

/** Lightweight stats for health / debugging endpoints. */
export function getGatewayStats() {
  const byRole: Record<string, number> = {};
  for (const p of peers.values()) byRole[p.role] = (byRole[p.role] || 0) + 1;
  return {
    peers: peers.size,
    rooms: rooms.size,
    byRole,
    roomList: Array.from(rooms.keys()),
  };
}
