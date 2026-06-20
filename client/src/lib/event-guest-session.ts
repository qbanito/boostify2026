/**
 * event-guest-session.ts
 * ──────────────────────
 * Manages the isolated Cinematic Event Landing guest session.
 *
 * ISOLATION GUARANTEE:
 *  - Uses sessionStorage (tab-scoped, not persisted beyond the tab).
 *  - Key is prefixed with `cel_${slug}` so different events don't collide.
 *  - No interaction with Firebase, Clerk, or any Boostify auth mechanism.
 */

export interface GuestSessionData {
  guestToken: string;
  guestName: string;
  eventSlug: string;
  storedAt: number;   // ms timestamp
}

const KEY_PREFIX = 'cel_';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (mirrors JWT expiry)

function sessionKey(slug: string): string {
  // sanitize slug to prevent storage key injection
  const safe = slug.replace(/[^a-z0-9-]/gi, '');
  return `${KEY_PREFIX}${safe}`;
}

/**
 * Retrieve the stored guest session for an event slug.
 * Returns null if missing or expired.
 */
export function getGuestSession(slug: string): GuestSessionData | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(slug));
    if (!raw) return null;
    const data: GuestSessionData = JSON.parse(raw);
    // Expire client-side if too old (server-side JWT will also reject)
    if (Date.now() - data.storedAt > SESSION_TTL_MS) {
      clearGuestSession(slug);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Persist a new guest session after successful login.
 */
export function setGuestSession(
  slug: string,
  guestToken: string,
  guestName: string
): void {
  const data: GuestSessionData = {
    guestToken,
    guestName,
    eventSlug: slug,
    storedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(sessionKey(slug), JSON.stringify(data));
  } catch {
    // sessionStorage full / unavailable — graceful degradation
  }
}

/**
 * Remove a guest session (e.g. logout, or to re-enter with different name).
 */
export function clearGuestSession(slug: string): void {
  try {
    sessionStorage.removeItem(sessionKey(slug));
  } catch {
    // no-op
  }
}
