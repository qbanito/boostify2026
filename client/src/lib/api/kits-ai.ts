/**
 * Kits AI Client — Routes through backend /api/kits/* with fallback support
 * 
 * Features:
 * - Voice Conversion (Kits.ai → Replicate RVC fallback)
 * - Vocal Separation (Kits.ai → Replicate Demucs fallback)
 * - Voice Models (Kits.ai → built-in catalog fallback)
 * - Voice Blender (Kits.ai native)
 * - API Status check
 */

const API_BASE = '/api/kits';

// ═══════════════════════════════════════════════════════════════
// VOICE CONVERSION
// ═══════════════════════════════════════════════════════════════

export interface VoiceConversionOptions {
  voiceModelId: number;
  audioFile?: File;
  audioUrl?: string;
  pitchShift?: number;
  conversionStrength?: number;
  modelVolumeMix?: number;
}

export interface VoiceConversionJob {
  id: number | string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  outputFileUrl?: string;
  lossyOutputFileUrl?: string;
  provider?: string;
}

export async function createVoiceConversion(options: VoiceConversionOptions): Promise<VoiceConversionJob> {
  const formData = new FormData();
  formData.append('voiceModelId', String(options.voiceModelId));
  if (options.audioFile) formData.append('audio', options.audioFile);
  if (options.audioUrl) formData.append('audioUrl', options.audioUrl);
  if (options.pitchShift !== undefined) formData.append('pitchShift', String(options.pitchShift));
  if (options.conversionStrength !== undefined) formData.append('conversionStrength', String(options.conversionStrength));
  if (options.modelVolumeMix !== undefined) formData.append('modelVolumeMix', String(options.modelVolumeMix));

  const response = await fetch(`${API_BASE}/voice-conversion`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Voice conversion failed');
  }

  return response.json();
}

export async function getVoiceConversion(id: string | number, provider?: string): Promise<VoiceConversionJob> {
  const url = provider
    ? `${API_BASE}/voice-conversion/${id}?provider=${provider}`
    : `${API_BASE}/voice-conversion/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch conversion status');
  return response.json();
}

export async function listVoiceConversions(page = 1, perPage = 20): Promise<{ data: VoiceConversionJob[]; meta: any }> {
  const response = await fetch(`${API_BASE}/voice-conversions?page=${page}&perPage=${perPage}`);
  if (!response.ok) throw new Error('Failed to fetch conversions');
  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// VOICE MODELS
// ═══════════════════════════════════════════════════════════════

export interface VoiceModel {
  id: number;
  title: string;
  tags?: string[];
  imageUrl?: string | null;
  demoUrl?: string | null;
  provider?: string;
}

export async function getVoiceModels(options?: {
  page?: number;
  perPage?: number;
  myModels?: boolean;
  instruments?: boolean;
}): Promise<{ data: VoiceModel[]; meta: any }> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.perPage) params.set('perPage', String(options.perPage));
  if (options?.myModels !== undefined) params.set('myModels', String(options.myModels));
  if (options?.instruments !== undefined) params.set('instruments', String(options.instruments));

  const response = await fetch(`${API_BASE}/voice-models?${params}`);
  if (!response.ok) throw new Error('Failed to fetch voice models');
  return response.json();
}

export async function getVoiceModelById(id: number): Promise<VoiceModel> {
  const response = await fetch(`${API_BASE}/voice-models/${id}`);
  if (!response.ok) throw new Error('Failed to fetch voice model');
  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// VOCAL SEPARATION  
// ═══════════════════════════════════════════════════════════════

export interface VocalSeparationJob {
  id: number | string;
  status: 'running' | 'success' | 'error' | 'cancelled';
  vocalAudioFileUrl?: string;
  backingAudioFileUrl?: string;
  stemFileUrls?: Array<{ instrument: string; url: string }>;
  provider?: string;
}

export async function createVocalSeparation(audioFileOrUrl: File | string): Promise<VocalSeparationJob> {
  if (typeof audioFileOrUrl === 'string') {
    const response = await fetch(`${API_BASE}/vocal-separation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl: audioFileOrUrl }),
    });
    if (!response.ok) throw new Error('Vocal separation failed');
    return response.json();
  }

  const formData = new FormData();
  formData.append('audio', audioFileOrUrl);
  const response = await fetch(`${API_BASE}/vocal-separation`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Vocal separation failed');
  return response.json();
}

export async function getVocalSeparation(id: string | number, provider?: string): Promise<VocalSeparationJob> {
  const url = provider
    ? `${API_BASE}/vocal-separation/${id}?provider=${provider}`
    : `${API_BASE}/vocal-separation/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch separation status');
  return response.json();
}

export async function listVocalSeparations(page = 1, perPage = 20): Promise<{ data: VocalSeparationJob[]; meta: any }> {
  const response = await fetch(`${API_BASE}/vocal-separations?page=${page}&perPage=${perPage}`);
  if (!response.ok) throw new Error('Failed to fetch separations');
  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// VOICE BLENDER
// ═══════════════════════════════════════════════════════════════

export interface VoiceBlenderOptions {
  modelId1: number;
  modelId2: number;
  modelId3?: number;
  modelId4?: number;
  alpha: number;
  alpha2?: number;
  alpha3?: number;
  title?: string;
}

export interface VoiceBlenderJob {
  id: number;
  status: 'running' | 'success' | 'error';
  outputModelId?: number;
  provider?: string;
}

export async function createVoiceBlend(options: VoiceBlenderOptions): Promise<VoiceBlenderJob> {
  const response = await fetch(`${API_BASE}/voice-blender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error('Voice blending failed');
  return response.json();
}

export async function getVoiceBlend(id: number): Promise<VoiceBlenderJob> {
  const response = await fetch(`${API_BASE}/voice-blender/${id}`);
  if (!response.ok) throw new Error('Failed to fetch blender status');
  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD & STATUS
// ═══════════════════════════════════════════════════════════════

export async function uploadAudio(audioFile: File): Promise<{ url: string; provider: string }> {
  const formData = new FormData();
  formData.append('audio', audioFile);
  const response = await fetch(`${API_BASE}/upload-audio`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Audio upload failed');
  return response.json();
}

export interface ApiStatus {
  kitsAi: { configured: boolean; available: boolean };
  replicate: { configured: boolean; available: boolean };
  activeProvider: string;
}

export async function getApiStatus(): Promise<ApiStatus> {
  const response = await fetch(`${API_BASE}/api-status`);
  if (!response.ok) throw new Error('Failed to check API status');
  return response.json();
}

// ═══════════════════════════════════════════════════════════════
// LEGACY EXPORTS (backwards compatibility)
// ═══════════════════════════════════════════════════════════════

export async function masterTrack(audioFile: File) {
  return uploadAudio(audioFile);
}

export async function separateVocals(audioFile: File) {
  return createVocalSeparation(audioFile);
}

export async function splitStems(audioFile: File) {
  return createVocalSeparation(audioFile);
}
