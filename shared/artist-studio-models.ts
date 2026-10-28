/** Provider rates verified from Fal's pricing catalog. Client prices are always 3x raw provider spend. */
export const STUDIO_MARGIN = 3;
export const STUDIO_CREDITS_PER_DOLLAR = 100;
export const PODCAST_TTS_MODEL = 'fal-ai/elevenlabs/tts/multilingual-v2';
export const PODCAST_TTS_USD_PER_1000_CHARS = .1;
export type StudioModel = { id: string; name: string; endpoint: string; providerUsdPerUnit: number; unit: 'second' | 'minute'; requiresSpeech?: boolean; longDurationMultiplier?: number; referenceTokensIncluded?: number; referenceUsdPer1000Tokens?: number; referenceTokensPerRun?: number; note: string };

export const PODCAST_MODELS: StudioModel[] = [
  { id: 'wan-3', name: 'WAN 3.0', endpoint: 'alibaba/wan-3.0/reference-to-video', providerUsdPerUnit: .10, unit: 'second', note: 'Photoreal reference video with native generated audio · 720p' },
  { id: 'wan-prime', name: 'WAN 3.0 Prime', endpoint: 'alibaba/wan-3.0-prime/reference-to-video', providerUsdPerUnit: .14, unit: 'second', note: 'Enhanced prompt interpretation with native generated audio · 720p' },
  { id: 'minimax-lipsync', name: 'MiniMax H3 Max Lip Sync', endpoint: 'minimax/h3-max/lip-sync/image-to-video', providerUsdPerUnit: .08, unit: 'second', requiresSpeech: true, longDurationMultiplier: 1.2, note: 'Precise 768p speech-driven lip sync' },
  { id: 'sync-lipsync-v3', name: 'Sync Lipsync V3', endpoint: 'fal-ai/sync-lipsync/v3/image-to-video', providerUsdPerUnit: 8, unit: 'minute', requiresSpeech: true, note: 'Expressive talking portrait synchronized to speech' },
  { id: 'veed-fabric', name: 'VEED Fabric 1.0', endpoint: 'veed/fabric-1.0', providerUsdPerUnit: .08, unit: 'second', requiresSpeech: true, note: 'Polished presenter animation with voice sync' },
];

export const WORLD_TOUR_MODELS: StudioModel[] = [
  { id: 'wan-3', name: 'WAN 3.0', endpoint: 'alibaba/wan-3.0/reference-to-video', providerUsdPerUnit: .10, unit: 'second', note: 'Uses the full nine-image concert storyboard · 720p' },
  { id: 'wan-prime', name: 'WAN 3.0 Prime', endpoint: 'alibaba/wan-3.0-prime/reference-to-video', providerUsdPerUnit: .14, unit: 'second', note: 'Enhanced interpretation of all nine storyboard images · 720p' },
  { id: 'minimax-h3', name: 'MiniMax H3 Max', endpoint: 'minimax/h3-max/reference-to-video', providerUsdPerUnit: .08, unit: 'second', referenceTokensIncluded: 4096, referenceUsdPer1000Tokens: .02, referenceTokensPerRun: 2848, note: '768p multi-reference video using the nine-shot board and artist portrait' },
  { id: 'kling-o3-standard', name: 'Kling O3 Standard', endpoint: 'fal-ai/kling-video/o3/standard/reference-to-video', providerUsdPerUnit: .14, unit: 'second', note: 'Multi-shot concert video; samples four storyboard references' },
  { id: 'kling-o3-pro', name: 'Kling O3 Pro', endpoint: 'fal-ai/kling-video/o3/pro/reference-to-video', providerUsdPerUnit: .14, unit: 'second', note: 'Premium multi-shot concert video; samples four storyboard references' },
];

export function studioProviderCostUsd(model: StudioModel, durationSeconds: number, speechCharacters = 0): number {
  const mediaCost = (model.unit === 'minute' ? durationSeconds / 60 * model.providerUsdPerUnit : durationSeconds * model.providerUsdPerUnit)
    * (model.longDurationMultiplier && durationSeconds > 15 ? model.longDurationMultiplier : 1);
  return mediaCost + (model.requiresSpeech ? speechCharacters / 1000 * PODCAST_TTS_USD_PER_1000_CHARS : 0);
}
export function worldTourProviderCostUsd(model: StudioModel, durationSeconds: number): number {
  const refTokens = model.referenceTokensPerRun ?? 0;
  const extraTokens = Math.max(0, refTokens - (model.referenceTokensIncluded || 0));
  const refCost = extraTokens / 1000 * (model.referenceUsdPer1000Tokens || 0);
  return studioProviderCostUsd(model, durationSeconds) + refCost;
}
export function studioCreditsFromUsd(providerCostUsd: number): number {
  return Math.ceil(providerCostUsd * STUDIO_MARGIN * STUDIO_CREDITS_PER_DOLLAR);
}
export function studioModelById(models: StudioModel[], id: unknown): StudioModel | undefined {
  return models.find((model) => model.id === id);
}
