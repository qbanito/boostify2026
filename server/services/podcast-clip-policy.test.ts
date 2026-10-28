import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canManagePodcastArtist, toPublicPodcastClip } from './podcast-clip-policy';

test('creation is limited to the artist, its manager, or an authenticated admin', () => {
  const artist = { id: 42, generatedBy: 7 };
  assert.equal(canManagePodcastArtist({}, artist), false);
  assert.equal(canManagePodcastArtist({ id: 99 }, artist), false);
  assert.equal(canManagePodcastArtist({ id: 42 }, artist), true);
  assert.equal(canManagePodcastArtist({ id: '7' }, artist), true);
  assert.equal(canManagePodcastArtist({ id: 99, isAdmin: true }, artist), true);
  assert.equal(canManagePodcastArtist({ id: 0, isAdmin: true }, artist), false);
});

test('visitors never receive queued, failed, refunded, or unplayable clips', () => {
  const job = { status: 'COMPLETED', videoUrl: 'https://media.example/clip.mp4' };
  for (const status of ['IN_QUEUE', 'IN_PROGRESS', 'FAILED', 'CANCELLED']) {
    assert.equal(toPublicPodcastClip('clip', { ...job, status }), null);
  }
  assert.equal(toPublicPodcastClip('clip', { ...job, refunded: true }), null);
  assert.equal(toPublicPodcastClip('clip', { ...job, videoUrl: '' }), null);
  assert.equal(toPublicPodcastClip('clip', { ...job, videoUrl: 'javascript:alert(1)' }), null);
});

test('public playback contains only approved episode fields', () => {
  const clip = toPublicPodcastClip('clip-1', {
    status: 'COMPLETED', title: 'Behind the track', videoUrl: 'https://media.example/clip.mp4',
    posterUrl: 'https://media.example/poster.webp', styleId: 'radio',
    completedAt: { toDate: () => new Date('2026-10-28T00:00:00Z') },
    ownerId: 'private-owner', userEmail: 'private@example.com', script: 'Private draft',
    estimatedCredits: 750, statusUrl: 'https://queue.fal.run/private',
  });
  assert.deepEqual(clip, {
    id: 'clip-1', title: 'Behind the track', videoUrl: 'https://media.example/clip.mp4',
    posterUrl: 'https://media.example/poster.webp', styleId: 'radio', duration: 30,
    createdAt: '2026-10-28T00:00:00.000Z',
  });
});
