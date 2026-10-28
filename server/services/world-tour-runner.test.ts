import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runTourStage, type TourRuntime } from './world-tour-runner';
import { WORLD_TOUR_SYNC_MODEL, WORLD_TOUR_VIDEO_MODEL } from '../../shared/world-tour';

function harness(kind = 'image', precisionSync = false) {
  const op: any = { id: 'stage', projectId: 'project', kind, status: 'PREPARING', phase: 'WAN', model: kind === 'image' ? 'image-model' : WORLD_TOUR_VIDEO_MODEL,
    createdAt: Date.now(), precisionSync, input: { prompt: 'A concert' } };
  const calls = { charges: 0, refunds: 0, submissions: [] as any[], frame: null as any, renderStates: [] as string[], finished: 0 };
  const runtime: TourRuntime = {
    save: async () => {}, charge: async () => { calls.charges++; return { credits: 75 }; },
    prepareAudio: async () => 'https://media.example/exact-song-15s.mp3',
    submit: async (model, input) => { calls.submissions.push({ model, input }); return { requestId: String(calls.submissions.length) }; },
    poll: async () => op.kind === 'image' ? 'https://provider.example/image.jpg' : op.phase === 'SYNC' ? 'https://provider.example/synced.mp4' : 'https://provider.example/wan.mp4',
    faceBase64: async () => 'artist-face-base64',
    saveImage: async () => 'https://our-storage.example/frame.jpg',
    completeFrame: async (_item, url) => { calls.frame = { url, approved: false }; },
    renderState: async (_item, status) => { calls.renderStates.push(status); },
    finishVideo: async (item) => { assert.equal(item.audioUrl, 'https://media.example/exact-song-15s.mp3'); assert.equal(item.rawVideoUrl, 'https://provider.example/wan.mp4'); calls.finished++; return 'https://our-storage.example/final.mp4'; },
    fail: async (item) => { if (item.status !== 'FAILED' && item.creditsCharged) calls.refunds++; item.status = 'FAILED'; },
  };
  return { op, runtime, calls };
}

test('an image stage charges and submits once, persists the image and waits for artist approval', async () => {
  const { op, runtime, calls } = harness();
  await runTourStage(op, runtime); assert.equal(op.status, 'QUEUED');
  await runTourStage(op, runtime); assert.equal(op.status, 'DONE');
  await runTourStage(op, runtime);
  assert.equal(calls.charges, 1); assert.equal(calls.submissions.length, 1);
  assert.deepEqual(calls.frame, { url: 'https://our-storage.example/frame.jpg', approved: false });
});
test('a standard concert uses the clipped song, finishes the mix and publishes only the final video', async () => {
  const { op, runtime, calls } = harness('render');
  await runTourStage(op, runtime);
  assert.deepEqual(calls.submissions[0].input.reference_audio_urls, ['https://media.example/exact-song-15s.mp3']);
  assert.deepEqual(calls.renderStates, []);
  await runTourStage(op, runtime); await runTourStage(op, runtime);
  assert.equal(op.status, 'DONE'); assert.equal(calls.charges, 1); assert.equal(calls.finished, 1);
  assert.deepEqual(calls.renderStates, ['FINALIZING', 'COMPLETED']);
});
test('precision sync runs after Wan, targets the artist face and does not charge a second time', async () => {
  const { op, runtime, calls } = harness('render', true);
  await runTourStage(op, runtime); await runTourStage(op, runtime);
  assert.equal(op.phase, 'SYNC'); assert.deepEqual(calls.renderStates, ['SYNCING']);
  assert.equal(calls.submissions[1].model, WORLD_TOUR_SYNC_MODEL);
  assert.equal(calls.submissions[1].input.options.active_speaker_detection.face_image, 'artist-face-base64');
  await runTourStage(op, runtime);
  assert.equal(op.status, 'DONE'); assert.equal(calls.charges, 1); assert.equal(calls.finished, 1);
  assert.equal(op.outputUrl, 'https://provider.example/synced.mp4');
});
test('a temporary poll failure resumes the existing provider request without a new charge or submission', async () => {
  const { op, runtime, calls } = harness();
  await runTourStage(op, runtime); const poll = runtime.poll;
  runtime.poll = async () => { throw new TypeError('fetch failed'); };
  await runTourStage(op, runtime); assert.equal(op.status, 'QUEUED'); assert.equal(calls.refunds, 0);
  runtime.poll = poll; await runTourStage(op, runtime);
  assert.equal(calls.charges, 1); assert.equal(calls.submissions.length, 1); assert.equal(op.status, 'DONE');
});
test('provider rejection refunds the stage and a failed stage cannot silently submit again', async () => {
  const { op, runtime, calls } = harness();
  runtime.submit = async () => { throw new Error('Provider account has no balance.'); };
  await runTourStage(op, runtime); await runTourStage(op, runtime);
  assert.equal(op.status, 'FAILED'); assert.equal(calls.refunds, 1); assert.equal(calls.charges, 1);
});
test('an uncertain interrupted submission is refunded instead of duplicating a provider call', async () => {
  const { op, runtime, calls } = harness(); op.submitAttemptedAt = Date.now(); op.creditsCharged = 75;
  await runTourStage(op, runtime);
  assert.equal(op.status, 'FAILED'); assert.equal(calls.submissions.length, 0); assert.equal(calls.charges, 0); assert.equal(calls.refunds, 1);
});
test('persisted finalization resumes after a restart without any generation charge', async () => {
  const { op, runtime, calls } = harness(); op.status = 'FINALIZING'; op.outputUrl = 'https://provider.example/image.jpg';
  await runTourStage(op, runtime);
  assert.equal(op.status, 'DONE'); assert.equal(calls.charges, 0); assert.equal(calls.submissions.length, 0); assert.ok(calls.frame);
});
test('stale provider jobs expire and refund instead of polling forever', async () => {
  const { op, runtime, calls } = harness(); op.status = 'QUEUED'; op.creditsCharged = 75; op.createdAt = Date.now() - 49 * 60 * 60 * 1000;
  await runTourStage(op, runtime); assert.equal(op.status, 'FAILED'); assert.equal(calls.refunds, 1);
});
