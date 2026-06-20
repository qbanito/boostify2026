/**
 * Concert Ticket Pass Service — anti-fraud signing & verification
 * ===============================================================
 * Every admitted unit (one per ticket bought) gets a unique `passCode` and an
 * HMAC-SHA256 `signature` derived from a stable server secret. A QR code carries
 * the token `passCode.signature`. Because the signature can only be produced
 * with the secret, passes cannot be forged or edited, and the server can verify
 * a scanned token offline (no DB lookup needed to reject a fake).
 *
 * Defense layers built on top of this primitive (in the routes/webhook):
 *   - one pass per unit  → a screenshot of one QR admits only one person
 *   - single-use check-in → atomic UPDATE ... WHERE status='valid'
 *   - void on refund/dispute → a refunded ticket can never scan again
 */
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Stable, secret signing key. Prefers an explicit env var; otherwise derives a
 * deterministic key from another always-present secret (DATABASE_URL) so the
 * signature survives restarts without requiring new configuration.
 */
function resolveSecret(): string {
  const explicit =
    process.env.CONCERT_TICKET_SECRET ||
    process.env.TICKET_SIGNING_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.CLERK_SECRET_KEY;
  if (explicit && explicit.length >= 16) return explicit;
  // Deterministic fallback derived from a stable secret env value.
  const material = process.env.DATABASE_URL || process.env.STRIPE_SECRET_KEY || 'boostify-concert-fallback-secret';
  return createHash('sha256').update(`concert-pass::${material}`).digest('hex');
}

const SECRET = resolveSecret();

/** URL-safe base64 of an HMAC-SHA256 over the canonical pass payload. */
export function signPass(payload: {
  passCode: string;
  orderId: number;
  concertId: number;
  tierId: number | null;
}): string {
  const canonical = `${payload.passCode}|${payload.orderId}|${payload.concertId}|${payload.tierId ?? 0}`;
  return createHmac('sha256', SECRET)
    .update(canonical)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Constant-time comparison of a candidate signature against the expected one. */
export function verifyPassSignature(
  payload: { passCode: string; orderId: number; concertId: number; tierId: number | null },
  signature: string,
): boolean {
  const expected = signPass(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature || '');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Generate a random, collision-resistant public pass code (e.g. "CC-AB12CD34EF"). */
export function generatePassCode(): string {
  return `CC-${randomBytes(6).toString('hex').toUpperCase()}`;
}

/** The opaque token embedded in the QR: `passCode.signature`. */
export function buildPassToken(passCode: string, signature: string): string {
  return `${passCode}.${signature}`;
}

/** Split a scanned token back into its parts. Returns null if malformed. */
export function parsePassToken(token: string): { passCode: string; signature: string } | null {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  const idx = trimmed.indexOf('.');
  if (idx <= 0 || idx >= trimmed.length - 1) return null;
  return { passCode: trimmed.slice(0, idx), signature: trimmed.slice(idx + 1) };
}
