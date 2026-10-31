import test from 'node:test';
import assert from 'node:assert/strict';
import { musicCatalogSplit } from './music-catalog-pricing';

test('splits whole cents without losing a cent', () => {
  for (const amount of [100, 101, 199, 500, 999, 500000]) {
    const { platformFeeCents, artistShareCents } = musicCatalogSplit(amount);
    assert.equal(platformFeeCents, Math.round(amount * 0.2));
    assert.equal(platformFeeCents + artistShareCents, amount);
  }
});
test('rejects invalid amounts', () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => musicCatalogSplit(amount));
});
