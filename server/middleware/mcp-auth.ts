/**
 * MCP API Key Authentication Middleware
 *
 * Validates requests from external AI agents using API keys.
 * Accepts the key in:
 *   - Header:  X-API-Key: bmcp_...
 *   - Header:  Authorization: Bearer bmcp_...
 *
 * Falls back to the standard `authenticate` middleware (Clerk / Firebase / session)
 * so that browser-based admin access continues to work unchanged.
 */
import { createHash, randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { mcpApiKeys, type SelectMcpApiKey, type MCPApiKeyScope } from '../../db/schema';
import { authenticate } from './auth';

// ─── Extend Express Request ──────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      mcpApiKey?: {
        id: number;
        userId: number;
        name: string;
        keyPrefix: string;
        scopes: MCPApiKeyScope[];
        rateLimit: number;
      };
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

/** SHA-256 hash of the raw key string */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/** Generate a new API key: bmcp_<64 hex chars> */
export function generateApiKey(): string {
  return `bmcp_${randomBytes(32).toString('hex')}`;
}

/** Extract raw key from request headers */
function extractRawKey(req: Request): string | null {
  const xApiKey = req.headers['x-api-key'];
  if (xApiKey && typeof xApiKey === 'string') return xApiKey;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer bmcp_')) {
    return authHeader.slice('Bearer '.length);
  }
  return null;
}

// ─── Core lookup ────────────────────────────────────────────────

async function lookupApiKey(rawKey: string): Promise<SelectMcpApiKey | null> {
  const hash = hashApiKey(rawKey);
  const rows = await db
    .select()
    .from(mcpApiKeys)
    .where(and(eq(mcpApiKeys.keyHash, hash), eq(mcpApiKeys.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

async function touchLastUsed(id: number): Promise<void> {
  await db
    .update(mcpApiKeys)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(mcpApiKeys.id, id));
}

// ─── Middleware ──────────────────────────────────────────────────

/**
 * mcpAuth — Authenticate either via API key OR standard session/Clerk auth.
 *
 * If an API key is present it MUST be valid — we will not fall through to
 * session auth if the key itself is invalid.
 *
 * If no API key header is present we fall back to the standard `authenticate`
 * middleware so browser-based admin panel requests work unchanged.
 */
export async function mcpAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rawKey = extractRawKey(req);

  if (rawKey !== null) {
    // API key path — must validate
    let keyRecord: SelectMcpApiKey | null;
    try {
      keyRecord = await lookupApiKey(rawKey);
    } catch {
      res.status(500).json({ error: 'Authentication service unavailable' });
      return;
    }

    if (!keyRecord) {
      res.status(401).json({ error: 'Invalid or inactive API key' });
      return;
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      res.status(401).json({ error: 'API key has expired' });
      return;
    }

    // Attach key metadata to request
    req.mcpApiKey = {
      id: keyRecord.id,
      userId: keyRecord.userId,
      name: keyRecord.name,
      keyPrefix: keyRecord.keyPrefix,
      scopes: keyRecord.scopes,
      rateLimit: keyRecord.rateLimit,
    };

    // Populate req.user so downstream middleware that checks req.user works
    req.user = {
      id: String(keyRecord.userId),
      uid: String(keyRecord.userId),
      role: 'artist',
      isAdmin: false,
    };

    // Fire-and-forget touch (don't block the response)
    touchLastUsed(keyRecord.id).catch(() => {/* ignore */});

    return next();
  }

  // No API key — fall back to existing session/Clerk/Firebase auth
  return authenticate(req, res, next);
}

/**
 * requireMcpScope — Gate an endpoint to a specific scope.
 * Must be used AFTER mcpAuth.
 *
 * When the request was authenticated via an API key, the scope is checked.
 * When authenticated via a normal session (browser), access is always allowed.
 */
export function requireMcpScope(scope: MCPApiKeyScope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.mcpApiKey) {
      if (!req.mcpApiKey.scopes.includes(scope)) {
        res.status(403).json({
          error: 'Insufficient scope',
          required: scope,
          granted: req.mcpApiKey.scopes,
        });
        return;
      }
    }
    next();
  };
}
