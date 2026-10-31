import Stripe from 'stripe';

type Unlock = { stripeSessionId: string; artistId: number; fanUserId: number; fanEmail: string | null; amount: number; currency: string; settlement: 'stripe_connect' };

/** Verify the signed raw payload before allowing any entitlement or ledger write. */
export async function processMusicWebhook(rawBody: Buffer, signature: string, secret: string, liveMode: boolean, record: (purchase: Unlock) => Promise<unknown>): Promise<'processed' | 'ignored'> {
  const verifier = new Stripe('webhook-signature-verifier');
  const event = verifier.webhooks.constructEvent(rawBody, signature, secret);
  if (event.livemode !== liveMode || event.account) throw new Error('Unexpected Stripe account or mode');
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return 'ignored';
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata || {};
  if (metadata.type !== 'artist_unlock' || metadata.settlement !== 'stripe_connect') return 'ignored';
  if (session.payment_status !== 'paid') return 'ignored';
  const artistId = Number(metadata.artistId);
  const fanUserId = Number(metadata.fanUserId);
  if (!Number.isSafeInteger(artistId) || artistId <= 0 || !Number.isSafeInteger(fanUserId) || fanUserId <= 0 || !Number.isSafeInteger(session.amount_total) || (session.amount_total ?? 0) < 100 || session.currency !== 'usd' || !session.id) {
    throw new Error('Invalid music catalog payment');
  }
  await record({ stripeSessionId: session.id, artistId, fanUserId, fanEmail: session.customer_details?.email || metadata.fanEmail || null, amount: session.amount_total! / 100, currency: 'usd', settlement: 'stripe_connect' });
  return 'processed';
}
