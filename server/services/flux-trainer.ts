/**
 * 🧬 Flux LoRA Fast Trainer
 *
 * Wraps fal-ai/flux-lora-fast-training queue API:
 *  - submit job: POST https://queue.fal.run/fal-ai/flux-lora-fast-training
 *  - poll status: GET  https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/{id}/status
 *  - fetch result: GET https://queue.fal.run/fal-ai/flux-lora-fast-training/requests/{id}
 *
 * The API requires a ZIP archive URL (not individual image URLs).
 * This service downloads each reference image, packs them into a ZIP,
 * uploads to FAL storage, then submits the training job.
 */
import axios from 'axios';
import JSZip from 'jszip';
import { fal } from '@fal-ai/client';
import { logger } from '../utils/logger';

const FAL_API_KEY = process.env.FAL_API_KEY || process.env.FAL_API_KEY_BACKUP || '';
const MODEL = 'fal-ai/flux-lora-fast-training';
const QUEUE_BASE = `https://queue.fal.run/${MODEL}`;

function authHeaders() {
  if (!FAL_API_KEY) throw new Error('FAL_API_KEY missing');
  return { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' };
}

function configureFalClient() {
  if (!FAL_API_KEY) throw new Error('FAL_API_KEY missing');
  fal.config({ credentials: FAL_API_KEY });
}

/**
 * Download all image URLs, zip them up, upload the ZIP to FAL storage,
 * return the public ZIP URL.
 */
async function buildAndUploadZip(imageUrls: string[], triggerWord: string): Promise<string> {
  configureFalClient();

  const zip = new JSZip();
  let downloadedCount = 0;

  await Promise.allSettled(
    imageUrls.map(async (url, idx) => {
      try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30_000 });
        const ext = url.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || 'jpg';
        const name = String(idx + 1).padStart(4, '0');
        zip.file(`${name}.${ext}`, res.data as Buffer);
        // Caption file: just the trigger word so the model learns the identity
        zip.file(`${name}.txt`, triggerWord);
        downloadedCount++;
      } catch (err: any) {
        logger.warn('[FluxTrainer] failed to download reference image', { url, err: err?.message });
      }
    }),
  );

  if (downloadedCount < 4) {
    throw new Error(
      `Only ${downloadedCount} of ${imageUrls.length} images downloaded. Need at least 4.`,
    );
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  // Upload using FAL client storage
  const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
  const zipUrl = await fal.storage.upload(zipBlob as any);
  logger.info('[FluxTrainer] ZIP uploaded', { zipUrl, imageCount: downloadedCount });
  return zipUrl;
}

export interface SubmitTrainingInput {
  imageUrls: string[];           // 6–20 reference images (Firebase Storage URLs)
  triggerWord: string;           // e.g. "qbn_artist"
  steps?: number;                // default 1000
}

export interface SubmitTrainingResult {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

export async function submitLoraTraining(
  input: SubmitTrainingInput,
): Promise<SubmitTrainingResult> {
  // Build ZIP and upload — both trainers require a zip archive URL, not raw arrays
  const zipUrl = await buildAndUploadZip(input.imageUrls, input.triggerWord);

  const body: any = {
    images_data_url: zipUrl,
    trigger_word: input.triggerWord,
    steps: input.steps ?? 1000,
    create_masks: true,   // auto face/body mask for better person training
  };

  const r = await axios.post(QUEUE_BASE, body, { headers: authHeaders(), timeout: 30_000 });
  const data = r.data;
  logger.info('[FluxTrainer] submitted', { id: data.request_id, model: MODEL });
  return {
    requestId: data.request_id,
    statusUrl: data.status_url ?? `${QUEUE_BASE}/requests/${data.request_id}/status`,
    responseUrl: data.response_url ?? `${QUEUE_BASE}/requests/${data.request_id}`,
  };
}

export interface TrainingStatus {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: any[];
  queuePosition?: number;
}

export async function getTrainingStatus(requestId: string): Promise<TrainingStatus> {
  const url = `${QUEUE_BASE}/requests/${requestId}/status`;
  const r = await axios.get(url, { headers: authHeaders(), timeout: 15_000 });
  return {
    status: r.data.status,
    logs: r.data.logs,
    queuePosition: r.data.queue_position,
  };
}

export interface TrainingResult {
  loraUrl: string;
  configUrl?: string;
  raw: any;
}

export async function getTrainingResult(requestId: string): Promise<TrainingResult> {
  const url = `${QUEUE_BASE}/requests/${requestId}`;
  const r = await axios.get(url, { headers: authHeaders(), timeout: 30_000 });
  const data = r.data;
  // flux-lora-fast-training returns { diffusers_lora_file: { url }, config_file: { url } }
  const loraUrl: string =
    data?.diffusers_lora_file?.url ||
    data?.lora_file?.url ||
    data?.lora_url ||
    '';
  if (!loraUrl) {
    throw new Error('Training completed but no lora_url in response: ' + JSON.stringify(data));
  }
  return {
    loraUrl,
    configUrl: data?.config_file?.url,
    raw: data,
  };
}
