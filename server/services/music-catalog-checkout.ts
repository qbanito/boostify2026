import type Stripe from 'stripe';
import { musicCatalogSplit } from '../../shared/music-catalog-pricing';

/** Build a destination charge; callers must authenticate and verify Connect readiness. */
export function buildMusicCatalogCheckout(input: {
  artistId: number;
  buyerId: number;
  buyerEmail: string;
  artistName: string;
  amountCents: number;
  destinationAccountId: string;
  successUrl: string;
  cancelUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  if (!Number.isSafeInteger(input.artistId) || input.artistId <= 0 || !Number.isSafeInteger(input.buyerId) || input.buyerId <= 0) throw new Error('Invalid artist or buyer');
  if (!/^acct_[A-Za-z0-9]+$/.test(input.destinationAccountId)) throw new Error('Invalid connected account');
  if (!input.buyerEmail || !input.artistName.trim()) throw new Error('Missing buyer or artist');
  const { platformFeeCents } = musicCatalogSplit(input.amountCents);
  const metadata = { type: 'artist_unlock', artistId: String(input.artistId), fanUserId: String(input.buyerId), fanEmail: input.buyerEmail, settlement: 'stripe_connect' };
  return {
    mode: 'payment', customer_email: input.buyerEmail,
    line_items: [{ price_data: { currency: 'usd', product_data: { name: `Unlock ${input.artistName} — full catalog` }, unit_amount: input.amountCents }, quantity: 1 }],
    success_url: input.successUrl, cancel_url: input.cancelUrl,
    client_reference_id: String(input.buyerId), metadata,
    payment_intent_data: { transfer_data: { destination: input.destinationAccountId }, application_fee_amount: platformFeeCents, metadata },
  };
}
