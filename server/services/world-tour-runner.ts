import { WORLD_TOUR_SYNC_MODEL } from '../../shared/world-tour';

export type TourRuntime = {
  save: (op: any) => Promise<void>;
  charge: (op: any) => Promise<{ credits: number }>;
  prepareAudio: (op: any) => Promise<string>;
  submit: (model: string, input: any) => Promise<Record<string, any>>;
  poll: (op: any) => Promise<string | null>;
  faceBase64: (op: any) => Promise<string>;
  saveImage: (op: any) => Promise<string>;
  completeFrame: (op: any, url: string) => Promise<void>;
  renderState: (op: any, status: string, patch?: any) => Promise<void>;
  finishVideo: (op: any) => Promise<string>;
  fail: (op: any, error: any) => Promise<void>;
  log?: (message: string) => void;
  now?: () => number;
};

/** One recoverable step. The repository lease prevents competing workers from processing the same job. */
export async function runTourStage(op: any, runtime: TourRuntime): Promise<void> {
  const now = runtime.now || Date.now;
  if (op.status === 'DONE' || op.status === 'FAILED') return;
  try {
    if (op.status === 'REFUND_PENDING') { await runtime.fail(op, new Error(op.error)); return; }
    if (op.status === 'PREPARING') {
      if (op.submitAttemptedAt) throw new Error('An interrupted submission cannot be safely resubmitted.');
      op.creditsCharged = (await runtime.charge(op)).credits;
      await runtime.save(op);
      if (op.kind === 'render') {
        op.audioUrl ||= await runtime.prepareAudio(op);
        op.input.reference_audio_urls = [op.audioUrl];
        await runtime.save(op);
      }
      op.submitAttemptedAt = now(); await runtime.save(op);
      Object.assign(op, await runtime.submit(op.model, op.input), { status: 'QUEUED' });
      await runtime.save(op); return;
    }
    if (op.status === 'QUEUED') {
      if (now() - op.createdAt >= 48 * 60 * 60 * 1000) throw new Error('The provider job exceeded its recovery window.');
      const url = await runtime.poll(op);
      if (!url) return;
      if (op.kind === 'render' && op.phase === 'WAN') {
        op.rawVideoUrl = url;
        if (op.precisionSync) {
          const face = await runtime.faceBase64(op);
          op.phase = 'SYNC'; op.syncSubmitAttemptedAt = now(); op.status = 'FINALIZING';
          await runtime.save(op);
          const queued = await runtime.submit(WORLD_TOUR_SYNC_MODEL, {
            video_url: url, audio_url: op.audioUrl, sync_mode: 'cut_off',
            options: { active_speaker_detection: { face_image: face, auto_detect: true, v3: true } }, enable_safety_checker: true,
          });
          Object.assign(op, queued, { status: 'QUEUED', syncQueued: true });
          await runtime.save(op); await runtime.renderState(op, 'SYNCING'); return;
        }
      }
      op.outputUrl = url; op.status = 'FINALIZING'; await runtime.save(op);
    }
    if (op.status === 'FINALIZING') {
      if (op.phase === 'SYNC' && !op.syncQueued) throw new Error('Vocal sync submission was interrupted.');
      if (op.kind === 'image') await runtime.completeFrame(op, await runtime.saveImage(op));
      else {
        await runtime.renderState(op, 'FINALIZING');
        await runtime.renderState(op, 'COMPLETED', { videoUrl: await runtime.finishVideo(op) });
      }
      op.status = 'DONE'; await runtime.save(op);
    }
  } catch (error: any) {
    runtime.log?.(error?.message || 'Unknown stage error');
    const transient = op.status === 'QUEUED' && (error?.name === 'TimeoutError' || error?.name === 'AbortError' || /fetch failed/.test(error?.message || '')) && now() - op.createdAt < 48 * 60 * 60 * 1000;
    if (!transient) await runtime.fail(op, error);
  }
}
