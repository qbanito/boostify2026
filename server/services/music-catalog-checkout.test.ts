import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMusicCatalogCheckout } from './music-catalog-checkout';

const base = { artistId: 7, buyerId: 8, buyerEmail: 'fan@example.test', artistName: 'Artist', amountCents: 101, destinationAccountId: 'acct_example123', successUrl: 'https://example.test/success', cancelUrl: 'https://example.test/cancel' };
test('constructs a destination charge with an exact 20 percent platform fee', () => {
  const result = buildMusicCatalogCheckout(base);
  assert.equal(result.payment_intent_data?.application_fee_amount, 20);
  assert.equal(result.payment_intent_data?.transfer_data?.destination, base.destinationAccountId);
  assert.equal(result.metadata?.settlement, 'stripe_connect');
  assert.equal(result.line_items?.[0].price_data?.unit_amount, 101);
});
test('rejects invalid accounts and amounts', () => {
  assert.throws(() => buildMusicCatalogCheckout({ ...base, destinationAccountId: 'not-an-account' }));
  assert.throws(() => buildMusicCatalogCheckout({ ...base, amountCents: -1 }));
});
