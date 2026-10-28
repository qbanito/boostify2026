import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorldTourModule from './WorldTourModule';

function render(isOwner = false, withShows = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: async () => { throw new Error('Unexpected network request.'); } } } });
  client.setQueryData(['/api/world-tour/artists/42/shows'], { shows: withShows ? [{ id: 'show', title: 'Artist in Tokyo', city: 'Tokyo', country: 'Japan', videoUrl: 'https://media.example/concert.mp4', songTitle: 'The Single', duration: 15, createdAt: '' }] : [] });
  client.setQueryData(['/api/world-tour/artists/42/context'], { songs: [{ id: 'pg:1', title: 'The Single', audioUrl: 'https://media.example/song.mp3', isSingle: true }], faceImages: ['https://media.example/face.jpg'], projects: [], quote: { image: 75, storyboard: 675, remaining: 600, video: 375, precisionVideo: 1375 } });
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><WorldTourModule artistId={42} artistName="Artist" isOwner={isOwner} /></QueryClientProvider>);
  client.clear(); return html;
}
test('visitors get completed-show playback and no creation, prices, prompts or song selectors', () => {
  const html = render(); assert.match(html, /World Tour concerts/); assert.match(html, /<video[^>]*controls/);
  assert.doesNotMatch(html, /Create my tour board|Choose your single|<textarea|Precision vocal sync|credits|face.jpg/);
});
test('owners get all 20 destinations, planning controls and the completed concert gallery', () => {
  const html = render(true); assert.match(html, /Create my tour board/); assert.match(html, /World Tour concerts/);
  assert.equal((html.match(/aria-label="Select /g) || []).length, 20);
});
test('an empty public profile does not expose an empty creator studio', () => { assert.equal(render(false, false), ''); });
