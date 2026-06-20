#!/usr/bin/env tsx
/**
 * Boostify MCP Stdio Transport
 *
 * Implements the MCP (Model Context Protocol) over stdin/stdout using JSON-RPC 2.0.
 * Designed for LOCAL AI agent use — not the web server.
 *
 * Compatible with:
 *   - Claude Desktop (claude_desktop_config.json)
 *   - VS Code MCP extensions
 *   - Any custom local agent that spawns a child process
 *
 * Protocol:  JSON-RPC 2.0, newline-delimited (one message per line)
 * Stdin:     reads JSON-RPC request messages
 * Stdout:    writes JSON-RPC response messages  (ONLY protocol traffic)
 * Stderr:    writes human-readable log messages (NEVER protocol traffic)
 *
 * Usage:
 *   npx tsx server/mcp/stdio-transport.ts
 *   npm run mcp:stdio
 *
 * Claude Desktop config  (~/.config/claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "boostify": {
 *         "command": "npx",
 *         "args": ["tsx", "/absolute/path/to/server/mcp/stdio-transport.ts"],
 *         "env": {
 *           "DATABASE_URL": "<your-neon-database-url>"
 *         }
 *       }
 *     }
 *   }
 */

import 'dotenv/config';
import * as readline from 'readline';
import { MCP_TOOLS, executeTool } from '../routes/mcp-server.js';

// ─── Protocol constants ──────────────────────────────────────────────────────

const MCP_PROTOCOL_VERSION = '2024-11-05';

const JSONRPC_ERROR = {
  PARSE_ERROR:      -32700,
  INVALID_REQUEST:  -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS:   -32602,
  INTERNAL_ERROR:   -32603,
} as const;

// ─── JSON-RPC 2.0 types ──────────────────────────────────────────────────────

type JsonRpcId = number | string | null;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcOkResponse<T = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: T;
}

interface JsonRpcErrResponse {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse<T = unknown> = JsonRpcOkResponse<T> | JsonRpcErrResponse;

// ─── MCP-specific param shapes ───────────────────────────────────────────────

interface InitializeParams {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo?: { name: string; version: string };
}

interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

// ─── Output helpers ──────────────────────────────────────────────────────────

/** Write a single JSON-RPC response to stdout (protocol channel). */
function send<T>(response: JsonRpcResponse<T>): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

/** Reply with a successful result. */
function ok<T>(id: JsonRpcId, result: T): void {
  send<T>({ jsonrpc: '2.0', id, result });
}

/** Reply with a JSON-RPC error. */
function rpcErr(id: JsonRpcId, code: number, message: string, data?: unknown): void {
  const error: { code: number; message: string; data?: unknown } = { code, message };
  if (data !== undefined) error.data = data;
  send<never>({ jsonrpc: '2.0', id, error });
}

/** Write a human-readable log line to stderr only. Never use stdout for logs. */
function log(msg: string): void {
  process.stderr.write(`[boostify-mcp] ${msg}\n`);
}

// ─── Method handlers ─────────────────────────────────────────────────────────

function handleInitialize(id: JsonRpcId, params: InitializeParams): void {
  const clientName = params.clientInfo?.name ?? 'unknown';
  const clientVer  = params.clientInfo?.version ?? '?';
  log(`initialize from ${clientName} v${clientVer} (protocol ${params.protocolVersion})`);

  ok(id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'boostify-mcp-server',
      version: '1.0.0',
    },
  });
}

function handleToolsList(id: JsonRpcId): void {
  ok(id, {
    tools: MCP_TOOLS.map(t => ({
      name:        t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
}

async function handleToolsCall(id: JsonRpcId, params: ToolCallParams): Promise<void> {
  const { name, arguments: toolArgs = {} } = params;

  const toolDef = MCP_TOOLS.find(t => t.name === name);
  if (!toolDef) {
    rpcErr(id, JSONRPC_ERROR.INVALID_PARAMS, `Unknown tool: ${name}`, {
      available: MCP_TOOLS.map(t => t.name),
    });
    return;
  }

  log(`tool/call: ${name}`);

  try {
    const result = await executeTool(name, toolArgs);
    ok(id, {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
      isError: false,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log(`tool error [${name}]: ${message}`);
    // Per MCP spec: tool errors are returned as results with isError=true,
    // NOT as JSON-RPC errors (those are reserved for protocol-level failures).
    ok(id, {
      content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
      isError: true,
    });
  }
}

// ─── Type guard ──────────────────────────────────────────────────────────────

function isJsonRpcRequest(val: unknown): val is JsonRpcRequest {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return v['jsonrpc'] === '2.0' && typeof v['method'] === 'string';
}

// ─── Message dispatcher ──────────────────────────────────────────────────────

async function dispatch(raw: string): Promise<void> {
  // 1. Parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    rpcErr(null, JSONRPC_ERROR.PARSE_ERROR, 'Parse error');
    return;
  }

  // 2. Validate shape
  if (!isJsonRpcRequest(parsed)) {
    rpcErr(null, JSONRPC_ERROR.INVALID_REQUEST, 'Invalid Request');
    return;
  }

  const { method, params = {}, id = null } = parsed;

  // Notifications have no id — we must NOT respond to them.
  const isNotification = parsed.id === undefined;

  // 3. Route
  switch (method) {
    case 'initialize':
      if (!isNotification) handleInitialize(id, params as InitializeParams);
      break;

    case 'initialized':
      // Notification sent by client after receiving initialize response — no reply needed.
      log('Client ready (initialized notification received)');
      break;

    case 'ping':
      if (!isNotification) ok(id, {});
      break;

    case 'tools/list':
      if (!isNotification) handleToolsList(id);
      break;

    case 'tools/call':
      if (!isNotification) await handleToolsCall(id, params as ToolCallParams);
      break;

    default:
      if (!isNotification) {
        rpcErr(id, JSONRPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
      break;
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

log(`Boostify MCP Server — stdio transport`);
log(`${MCP_TOOLS.length} tools available across ${new Set(MCP_TOOLS.map(t => t.category)).size} categories`);
log(`MCP protocol version: ${MCP_PROTOCOL_VERSION}`);
log('Waiting for messages on stdin…');

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false,
});

rl.on('line', (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return; // skip blank lines

  dispatch(trimmed).catch((e: unknown) => {
    log(`Unhandled error in dispatch: ${e instanceof Error ? e.message : String(e)}`);
  });
});

rl.on('close', () => {
  log('stdin closed — shutting down');
  process.exit(0);
});

// Keep the process alive; readline keeps stdin open until it closes.
