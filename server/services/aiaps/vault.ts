/**
 * Security Vault — stores sensitive material (passwords, recovery codes, 2FA backups)
 * encrypted-at-rest using AES-256-GCM.
 *
 * Encryption key resolution (in order):
 *   1. AIAPS_VAULT_KEY (32-byte base64) — PREFERRED in production
 *   2. JWT_SECRET (derived) — dev fallback only
 *
 * Stored reference (`vault_ref`) is opaque: `vault:{id}`.
 * Actual ciphertext lives in `aiaps_vault_secrets`.
 */
import crypto from 'node:crypto';
import { pool } from './db';

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiaps_vault_secrets (
      id SERIAL PRIMARY KEY,
      artist_id VARCHAR(64),
      kind VARCHAR(64),
      label VARCHAR(128),
      ciphertext TEXT NOT NULL,
      iv VARCHAR(64) NOT NULL,
      auth_tag VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      rotated_at TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_vault_artist ON aiaps_vault_secrets(artist_id);
  `);
  ensured = true;
}

function getKey(): Buffer {
  const k = process.env.AIAPS_VAULT_KEY;
  if (k) {
    const buf = Buffer.from(k, 'base64');
    if (buf.length === 32) return buf;
  }
  // Dev fallback — DO NOT use in production
  const seed = process.env.JWT_SECRET || 'boostify-dev-vault-key-fallback';
  return crypto.createHash('sha256').update(seed).digest();
}

export async function vaultPut(
  artistId: string | null,
  kind: string,
  label: string,
  plaintext: string,
): Promise<string> {
  await ensureTable();
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const { rows } = await pool.query(
    `INSERT INTO aiaps_vault_secrets (artist_id, kind, label, ciphertext, iv, auth_tag)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [artistId, kind, label, enc.toString('base64'), iv.toString('base64'), authTag.toString('base64')],
  );
  return `vault:${rows[0].id}`;
}

export async function vaultReveal(ref: string): Promise<string | null> {
  await ensureTable();
  const id = parseInt(ref.replace('vault:', ''), 10);
  if (!id) return null;
  const { rows } = await pool.query('SELECT * FROM aiaps_vault_secrets WHERE id=$1', [id]);
  const row = rows[0];
  if (!row) return null;
  const key = getKey();
  const iv = Buffer.from(row.iv, 'base64');
  const enc = Buffer.from(row.ciphertext, 'base64');
  const authTag = Buffer.from(row.auth_tag, 'base64');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch (err: any) {
    console.warn('[AIAPS vault] decrypt failed:', err.message);
    return null;
  }
}

export async function vaultList(artistId?: string): Promise<Array<{ id: number; kind: string; label: string; created_at: Date }>> {
  await ensureTable();
  const { rows } = artistId
    ? await pool.query(
        'SELECT id, kind, label, created_at FROM aiaps_vault_secrets WHERE artist_id=$1 ORDER BY id DESC',
        [artistId],
      )
    : await pool.query(
        'SELECT id, kind, label, created_at FROM aiaps_vault_secrets ORDER BY id DESC LIMIT 200',
      );
  return rows;
}
