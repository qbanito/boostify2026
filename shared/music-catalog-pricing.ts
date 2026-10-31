/** Stripe marketplace split in integer cents. The platform keeps 20% of gross. */
export function musicCatalogSplit(totalCents: number): { platformFeeCents: number; artistShareCents: number } {
  if (!Number.isSafeInteger(totalCents) || totalCents < 1) throw new Error('Invalid catalog payment amount');
  const platformFeeCents = Math.round(totalCents * 20 / 100);
  return { platformFeeCents, artistShareCents: totalCents - platformFeeCents };
}
