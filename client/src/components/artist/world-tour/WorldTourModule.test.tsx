import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorldTourModule from './WorldTourModule';

function render(isOwner = false, withShows = true, creditExempt = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, queryFn: async () => { throw new Error('Unexpected network request.'); } } } });
  client.setQueryData(['/api/world-tour/artists/42/shows'], { shows: withShows ? [{ id: 'show', title: 'Artist in Tokyo', city: 'Tokyo', country: 'Japan', videoUrl: 'https://media.example/concert.mp4', songTitle: 'The Single', duration: 15, createdAt: '' }] : [] });
  client.setQueryData(['/api/world-tour/artists/42/context'], { songs: [{ id: 'pg:1', title: 'The Single', audioUrl: 'https://media.example/song.mp3', isSingle: true }], faceImages: ['https://media.example/face.jpg'], projects: [], quote: { creditExempt, image: creditExempt ? 0 : 75, storyboard: creditExempt ? 0 : 675, remaining: creditExempt ? 0 : 600, video: creditExempt ? 0 : 375, precisionVideo: creditExempt ? 0 : 1375 } });
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


test('the owner sees an admin exemption only when returned by the server', () => {
  assert.match(render(true, true, true), /Admin access: no credits required/);
  assert.doesNotMatch(render(true, true, false), /Admin access: no credits required/);
});
