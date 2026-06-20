/**
 * Normalizes a location value that may be either a plain string or an object
 * shaped like `{ city, region, country, countryCode, timezone }` (as produced
 * by master_json's `identity.location`) into a renderable string.
 *
 * Returns an empty string for null/undefined/empty so callers can short-circuit
 * with `&&`.
 */
export function formatLocation(loc: unknown): string {
  if (!loc) return '';
  if (typeof loc === 'string') return loc.trim();
  if (typeof loc !== 'object') return String(loc);

  const o = loc as Record<string, any>;
  const parts = [o.city, o.region, o.country]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(', ');

  const fallback = o.countryCode || o.timezone;
  return typeof fallback === 'string' ? fallback : '';
}
