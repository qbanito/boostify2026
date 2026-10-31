import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { processMusicWebhook } from './music-catalog-webhook';

const stripe = new Stripe('test-signature-only');
const secret = 'whsec_fixture_only';
function fixture(overrides: Record<string, unknown> = {}) {
  const session = { id: 'cs_test_fixture', amount_total: 101, currency: 'usd', payment_status: 'paid', metadata: { type: 'artist_unlock', settlement: 'stripe_connect', artistId: '2', fanUserId: '3' }, ...overrides };
  const body = Buffer.from(JSON.stringify({ id: 'evt_fixture', type: 'checkout.session.completed', livemode: false, data: { object: session } }));
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body.toString(), secret });
  return { body, signature };
}
test('valid signed paid event records the correct buyer and amount', async () => {
  const { body, signature } = fixture(); let recorded: any;
  const status = await processMusicWebhook(body, signature, secret, false, async value => { recorded = value; });
  assert.equal(status, 'processed'); assert.equal(recorded.fanUserId, 3); assert.equal(recorded.amount, 1.01); assert.equal(recorded.settlement, 'stripe_connect');
});
test('unpaid and unrelated events do not grant access', async () => {
  for (const override of [{ payment_status: 'unpaid' }, { metadata: { type: 'other' } }]) {
    const { body, signature } = fixture(override); let calls = 0;
    assert.equal(await processMusicWebhook(body, signature, secret, false, async () => { calls++; }), 'ignored');
    assert.equal(calls, 0);
  }
});
test('rejects invalid signatures and wrong live mode', async () => {
  const { body, signature } = fixture();
  await assert.rejects(processMusicWebhook(body, signature, 'wrong', false, async () => {}));
  await assert.rejects(processMusicWebhook(body, signature, secret, true, async () => {}));
});
test('propagates recording errors so Stripe can retry', async () => {
  const { body, signature } = fixture();
  await assert.rejects(processMusicWebhook(body, signature, secret, false, async () => { throw new Error('database unavailable'); }));
});
