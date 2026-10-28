import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WORLD_TOUR_DESTINATIONS, WORLD_TOUR_SHOTS, insertWorldTour, type TourProject } from '../../shared/world-tour';
import { createTourFrames, createTourVideoPrompt, publicTourShows, tourBoardError, tourVideoInput } from './world-tour-prompts';

function project(): TourProject {
  const item: TourProject = { id: 'tour', artistId: 42, artistName: 'Artist Forty Two', destinationId: 'las-vegas',
    song: { id: 'pg:1', title: 'My real single', audioUrl: 'https://media.example/song.mp3', isSingle: true, genre: 'Afro pop' },
    faceUrl: 'https://media.example/original-face.jpg', lookDirection: 'Silver jacket, natural hair', aspectRatio: '16:9', clipStart: 22,
    frames: [], renders: [], videoPrompt: '', createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z' };
  item.frames = createTourFrames(item).map((frame) => ({ ...frame, imageUrl: `https://media.example/shot-${frame.index}.jpg`, status: 'READY', approved: true, operationId: `shot-${frame.index}`, anchorOperationId: 'shot-2' }));
  item.videoPrompt = createTourVideoPrompt(item);
  return item;
}

test('20 unique countries/destinations and nine contiguous camera shots cover exactly 15 seconds', () => {
  assert.equal(WORLD_TOUR_DESTINATIONS.length, 20);
  assert.equal(new Set(WORLD_TOUR_DESTINATIONS.map((item) => item.country)).size, 20);
  assert.equal(new Set(WORLD_TOUR_DESTINATIONS.map((item) => item.id)).size, 20);
  assert.equal(WORLD_TOUR_SHOTS.length, 9);
  assert.equal(WORLD_TOUR_SHOTS[0].start, 0);
  for (let i = 1; i < 9; i++) assert.equal(WORLD_TOUR_SHOTS[i].start, WORLD_TOUR_SHOTS[i - 1].end);
  assert.equal(WORLD_TOUR_SHOTS[8].end, 15);
});
test('new and saved layouts insert World Tour immediately after Podcast and preserve existing placement', () => {
  assert.deepEqual(insertWorldTour(['songs', 'podcast-clips', 'videos']), ['songs', 'podcast-clips', 'world-tour', 'videos']);
  assert.deepEqual(insertWorldTour(['world-tour', 'songs', 'podcast-clips']), ['world-tour', 'songs', 'podcast-clips']);
});
test('prompts carry the selected song, original identity, look and real camera context', () => {
  const item = project();
  assert.equal(item.frames.length, 9);
  for (const frame of item.frames) {
    assert.match(frame.prompt, /Artist Forty Two/); assert.match(frame.prompt, /My real single/);
    assert.match(frame.prompt, /Silver jacket/); assert.match(frame.prompt, /Preserve the exact identity/);
  }
  assert.match(item.videoPrompt, /Image 1 is the original artist face/);
  assert.match(item.videoPrompt, /Images 2-10/);
});
test('Wan gets one original face plus nine separate shots, fixed 15s, and the selected aspect ratio', () => {
  const item = project(); const input = tourVideoInput(item);
  assert.equal(input.reference_image_urls.length, 10);
  assert.equal(input.reference_image_urls[0], item.faceUrl);
  assert.deepEqual(input.reference_image_urls.slice(1), item.frames.map((frame) => frame.imageUrl));
  assert.equal(input.duration, 15); assert.equal(input.aspect_ratio, '16:9'); assert.equal(input.enable_safety_checker, true);
});
test('unapproved, incomplete and obsolete-anchor boards cannot render', () => {
  const unapproved = project(); unapproved.frames[5].approved = false;
  assert.ok(tourBoardError(unapproved)); assert.throws(() => tourVideoInput(unapproved));
  const incomplete = project(); incomplete.frames[1].status = 'QUEUED'; assert.ok(tourBoardError(incomplete));
  const obsolete = project(); obsolete.frames[0].anchorOperationId = 'old-anchor'; assert.ok(tourBoardError(obsolete));
  const truncated = project(); truncated.frames.pop(); assert.ok(tourBoardError(truncated));
});
test('only completed concerts are public and private draft/audio/billing fields are not serialized', () => {
  const item = project(); item.renders = [
    { id: 'pending', status: 'SYNCING', precisionSync: true, createdAt: item.createdAt },
    { id: 'failed', status: 'FAILED', videoUrl: 'https://media.example/failed.mp4', precisionSync: false, createdAt: item.createdAt },
    { id: 'done', status: 'COMPLETED', videoUrl: 'https://media.example/final.mp4', posterUrl: 'https://media.example/original-poster.jpg', precisionSync: false, createdAt: item.createdAt },
  ];
  const shows = publicTourShows(item);
  assert.equal(shows.length, 1); assert.equal(shows[0].id, 'done');
  assert.equal(shows[0].posterUrl, 'https://media.example/original-poster.jpg');
  assert.doesNotMatch(JSON.stringify(shows), /audioUrl|original-face|lookDirection|videoPrompt|credits|prompt|clipStart/);
});
