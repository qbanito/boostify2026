import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db';
import { settleTourCredits } from './world-tour-billing';

test('the named admin bypasses credit storage for both studios and refunds; others enter the charge path', async () => {
  const originalSelect = db.select;
  const originalTransaction = db.transaction;
  try {
    (db as any).select = () => { throw new Error('unexpected credit lookup'); };
    (db as any).transaction = () => { throw new Error('unexpected credit transaction'); };
    for (const studio of ['World Tour', 'Podcast Studio']) {
      for (const refund of [false, true]) {
        const result = await settleTourCredits(' CONVOYCUBANO@GMAIL.COM ', 'test-operation', 5, refund, studio);
        assert.equal(result.credits, 0);
      }
    }
    (db as any).select = () => ({ from: () => ({ where: async () => [{ credits: 500 }] }) });
    (db as any).transaction = async () => { throw new Error('normal charge path reached'); };
    await assert.rejects(() => settleTourCredits('info@boostifymusic.com', 'test-operation', 5), /normal charge path reached/);
  } finally {
    (db as any).select = originalSelect;
    (db as any).transaction = originalTransaction;
  }
});
