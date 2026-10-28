import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PodcastClipsModule from './PodcastClipsModule';

const episode = {
  id: 'completed-episode', title: 'Behind the track', videoUrl: 'https://media.example/podcast.mp4',
  styleId: 'radio', duration: 30, createdAt: null,
};

function renderModule(isOwner?: boolean, clips = [episode]) {
  const client = new QueryClient({ defaultOptions: { queries: {
    retry: false, staleTime: Infinity,
    queryFn: async () => { throw new Error('Tests must use the supplied episode fixtures.'); },
  } } });
  client.setQueryData(['/api/podcast-clips/artists/42/clips'], { clips });
  client.setQueryData(['/api/podcast-clips/estimate'], { credits: 750 });
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <PodcastClipsModule artistId={42} artistName="Test Artist" isOwner={isOwner} />
    </QueryClientProvider>,
  );
  client.clear();
  return markup;
}

test('a visitor gets episode playback without any creator or credit controls', () => {
  const html = renderModule();
  assert.match(html, /Podcast Episodes/);
  assert.match(html, /<video[^>]*controls/);
  assert.match(html, /https:\/\/media.example\/podcast.mp4/);
  assert.doesNotMatch(html, /<textarea|Build my concept|Generate 30-second clip|750 credits|podcast style reference/);
});

test('a logged-in non-owner gets the same playback-only view', () => {
  assert.equal(renderModule(false), renderModule());
});

test('the owner gets creation controls alongside the completed episodes', () => {
  const html = renderModule(true);
  assert.match(html, /Build my concept/);
  assert.match(html, /Generate 30-second clip/);
  assert.match(html, /Podcast Episodes/);
  assert.equal((html.match(/podcast style reference/g) || []).length, 10);
});

test('a visitor sees no empty studio when the artist has no completed podcasts', () => {
  assert.equal(renderModule(false, []), '');
});
