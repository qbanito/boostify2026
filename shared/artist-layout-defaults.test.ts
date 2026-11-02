import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_STARTER_CUTOFF, musicStarterOrder, musicStarterVisibility, usesMusicStarter } from './artist-layout-defaults';

test('new music starter enables only music, videos and image galleries', () => {
  const all = ['fanclub', 'songs', 'videos', 'galleries', 'world-tour', 'fashion-store', 'podcast-clips'];
  assert.deepEqual(Object.entries(musicStarterVisibility(all)).filter(([,enabled]) => enabled).map(([id]) => id), ['songs','videos','galleries']);
  assert.deepEqual(musicStarterOrder(all).slice(0,3), ['songs','videos','galleries']);
  assert.deepEqual(new Set(musicStarterOrder(all)), new Set(all));
});
test('existing or undated profiles are not treated as newly created', () => {
  assert.equal(usesMusicStarter('2025-01-01T00:00:00Z'), false);
  assert.equal(usesMusicStarter(null), false);
  assert.equal(usesMusicStarter('invalid'), false);
  assert.equal(usesMusicStarter(MUSIC_STARTER_CUTOFF), true);
  assert.equal(usesMusicStarter('2030-01-01T00:00:00Z'), true);
});
