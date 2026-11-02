import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isArtistStudioCreditExempt } from './artist-studio-credit-policy';

test('only the designated admin email is exempt, independent of casing or spacing', () => {
  assert.equal(isArtistStudioCreditExempt('convoycubano@gmail.com'), true);
  assert.equal(isArtistStudioCreditExempt('  CONVOYCUBANO@GMAIL.COM  '), true);
  for (const value of ['info@boostifymusic.com', 'other@example.com', 'convoycubano@gmail.com.attacker.test', '', null, undefined]) {
    assert.equal(isArtistStudioCreditExempt(value), false);
  }
});
