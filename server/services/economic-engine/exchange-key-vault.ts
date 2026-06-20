/**
 * BOOSTIFY ECONOMIC ENGINE — Exchange Key Vault
 * Encrypted per-artist API key storage using AES-256-GCM.
 *
 * Each artist stores their OWN keys for each exchange.
 * Keys are encrypted at rest using process.env.CEX_KEY_SECRET.
 *
 * ⚠️ RISK NOTICE: API keys give full trading access. Never share them.
 * Boostify never sees plaintext keys — they are encrypted immediately
 * on arrival and decrypted only in-memory when needed.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { db } from '../../db';
import { cexExchangeKeys } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { SupportedExchangeId, ExchangeCredentials } from './exchange-connector';

// ─── Encryption ──────────────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const raw = process.env.CEX_KEY_SECRET;
  if (!raw || raw.length < 64) {
    throw new Error(
      'CEX_KEY_SECRET is not configured or too short. ' +
      'Set a 64-character hex string (32 bytes) in your .env file. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(raw.slice(0, 64), 'hex');
}

/** Encrypt a plaintext string. Returns "iv:authTag:ciphertext" in hex. */
export function encryptField(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/** Decrypt a value produced by encryptField(). */
export function decryptField(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format');
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ─── Key Vault Operations ─────────────────────────────────────────────────

export interface SaveKeyInput {
  artistId: number;
  exchangeId: SupportedExchangeId;
  label?: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX requires this
  isTestnet: boolean;
  permissions?: string[];
}

/** Persist an artist's exchange API keys (encrypted) to the database. */
export async function saveExchangeKeys(input: SaveKeyInput): Promise<number> {
  const encApiKey = encryptField(input.apiKey);
  const encApiSecret = encryptField(input.apiSecret);
  const encPassphrase = input.passphrase ? encryptField(input.passphrase) : null;

  // Upsert: one row per artist + exchange
  const existing = await db
    .select({ id: cexExchangeKeys.id })
    .from(cexExchangeKeys)
    .where(
      and(
        eq(cexExchangeKeys.artistId, input.artistId),
        eq(cexExchangeKeys.exchangeId, input.exchangeId),
        eq(cexExchangeKeys.isTestnet, input.isTestnet)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(cexExchangeKeys)
      .set({
        label: input.label ?? null,
        apiKeyEnc: encApiKey,
        apiSecretEnc: encApiSecret,
        passphraseEnc: encPassphrase,
        permissions: input.permissions ?? ['read', 'trade'],
        isActive: true,
        lastVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(cexExchangeKeys.id, existing[0].id));
    return existing[0].id;
  }

  const [row] = await db
    .insert(cexExchangeKeys)
    .values({
      artistId: input.artistId,
      exchangeId: input.exchangeId,
      label: input.label ?? null,
      apiKeyEnc: encApiKey,
      apiSecretEnc: encApiSecret,
      passphraseEnc: encPassphrase,
      isTestnet: input.isTestnet,
      permissions: input.permissions ?? ['read', 'trade'],
      isActive: true,
    })
    .returning({ id: cexExchangeKeys.id });

  return row.id;
}

/** Load decrypted credentials for an artist + exchange pair. Returns null if not found. */
export async function loadExchangeCredentials(
  artistId: number,
  exchangeId: SupportedExchangeId,
  isTestnet: boolean
): Promise<ExchangeCredentials | null> {
  const [row] = await db
    .select()
    .from(cexExchangeKeys)
    .where(
      and(
        eq(cexExchangeKeys.artistId, artistId),
        eq(cexExchangeKeys.exchangeId, exchangeId),
        eq(cexExchangeKeys.isTestnet, isTestnet),
        eq(cexExchangeKeys.isActive, true)
      )
    )
    .limit(1);

  if (!row) return null;

  try {
    return {
      exchangeId: row.exchangeId as SupportedExchangeId,
      apiKey: decryptField(row.apiKeyEnc),
      apiSecret: decryptField(row.apiSecretEnc),
      passphrase: row.passphraseEnc ? decryptField(row.passphraseEnc) : undefined,
      isTestnet: row.isTestnet,
    };
  } catch {
    // Decryption failed — key was stored with different CEX_KEY_SECRET
    console.error(`[KeyVault] Failed to decrypt keys for artist ${artistId} / ${exchangeId}`);
    return null;
  }
}

/** Load ALL active exchange configs (metadata only — no keys) for an artist */
export async function getArtistExchangeConfigs(artistId: number) {
  return db
    .select({
      id: cexExchangeKeys.id,
      exchangeId: cexExchangeKeys.exchangeId,
      label: cexExchangeKeys.label,
      isTestnet: cexExchangeKeys.isTestnet,
      permissions: cexExchangeKeys.permissions,
      isActive: cexExchangeKeys.isActive,
      lastVerifiedAt: cexExchangeKeys.lastVerifiedAt,
      createdAt: cexExchangeKeys.createdAt,
    })
    .from(cexExchangeKeys)
    .where(
      and(
        eq(cexExchangeKeys.artistId, artistId),
        eq(cexExchangeKeys.isActive, true)
      )
    );
}

/** Deactivate (soft-delete) an exchange key */
export async function deactivateExchangeKey(keyId: number, artistId: number): Promise<void> {
  await db
    .update(cexExchangeKeys)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(cexExchangeKeys.id, keyId),
        eq(cexExchangeKeys.artistId, artistId) // security: artist can only remove their own keys
      )
    );
}

/** Mark a key as verified with current timestamp */
export async function markKeyVerified(keyId: number): Promise<void> {
  await db
    .update(cexExchangeKeys)
    .set({ lastVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(cexExchangeKeys.id, keyId));
}
