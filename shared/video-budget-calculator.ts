/**
 * BOOSTIFY Video Budget Calculator
 * Calculates dynamic pricing for music video generation
 * Based on: song duration, model selection, features, corrections buffer
 * 
 * MARKUP: 4x internal cost = user price
 * All prices in USD, verified Feb 2026 from fal.ai
 */

// ============================================
// MODEL PRICING (Internal cost per unit)
// ============================================

export interface ModelPricing {
  id: string;
  name: string;
  tier: 'cinematic' | 'ultra' | 'premium' | 'studio' | 'standard';
  costPerSecond: number;     // $/sec without audio
  costPerSecondAudio: number; // $/sec with audio
  maxDuration: number;        // seconds
  description: string;
}

export const VIDEO_MODEL_PRICING: Record<string, ModelPricing> = {
  'seedance-2-fast': {
    id: 'seedance-2-fast',
    name: 'Seedance 2.0 (ByteDance)',
    tier: 'cinematic',
    costPerSecond: 0.2419,
    costPerSecondAudio: 0.2419,
    maxDuration: 15,
    description: 'Most advanced — native synced audio, director-level camera, realistic physics, multi-shot up to 15s',
  },
  'veo-3-standard': {
    id: 'veo-3-standard',
    name: 'Google Veo 3 Standard',
    tier: 'cinematic',
    costPerSecond: 0.50,
    costPerSecondAudio: 0.75,
    maxDuration: 10,
    description: 'Maximum quality — Google\'s flagship, native audio, best physics',
  },
  'veo-3.1': {
    id: 'veo-3.1',
    name: 'Google Veo 3.1',
    tier: 'ultra',
    costPerSecond: 0.20,
    costPerSecondAudio: 0.40,
    maxDuration: 10,
    description: 'First/Last frame control — ideal transitions, 1080p with audio',
  },
  'kling-o3': {
    id: 'kling-o3',
    name: 'Kling 3.0 (O3)',
    tier: 'premium',
    costPerSecond: 0.168,
    costPerSecondAudio: 0.224,
    maxDuration: 10,
    description: 'Newest Kling — exclusive on FAL, exceptional motion quality',
  },
  'kling-2.6-pro': {
    id: 'kling-2.6-pro',
    name: 'Kling 2.6 Pro',
    tier: 'studio',
    costPerSecond: 0.07,
    costPerSecondAudio: 0.14,
    maxDuration: 10,
    description: 'Best value — cinematic quality, native audio, fluid motion',
  },
  'kling-2.1-pro': {
    id: 'kling-2.1-pro',
    name: 'Kling 2.1 Pro',
    tier: 'standard',
    costPerSecond: 0.09,
    costPerSecondAudio: 0.09,
    maxDuration: 10,
    description: 'Reliable quality — proven model, good consistency',
  },
  'grok-imagine': {
    id: 'grok-imagine',
    name: 'Grok Imagine Video',
    tier: 'standard',
    costPerSecond: 0.05,
    costPerSecondAudio: 0.05,
    maxDuration: 6,
    description: 'Fast generation — xAI model, quick iterations',
  },
};

export const IMAGE_MODEL_PRICING: Record<string, { name: string; costPerImage: number }> = {
  'seedream-4':    { name: 'Seedream 4 (ByteDance) — Most advanced, cinematic detail', costPerImage: 0.03 },
  'flux-2-pro':    { name: 'Flux 2 Pro — Best quality (recommended)', costPerImage: 0.05 },
  'flux-pro':      { name: 'Flux Pro — High quality, fast',           costPerImage: 0.005 },
  'flux-schnell':  { name: 'Flux Schnell — Ultra fast, budget',       costPerImage: 0.003 },
};

// ============================================
// COST CONSTANTS
// ============================================

const OPENAI_FIXED_COST = 0.96; // Whisper + 3 GPT-4o calls + prompt enhancement
const LIPSYNC_COST_PER_SEC = 0.04; // PixVerse lipsync
const MOTION_TRANSFER_COST_PER_CLIP = 0.50; // DreamActor v2 per 5s clip
const MOTION_TRANSFER_CLIPS = 5; // Fixed 5 key motion transfer clips
const RENDER_COST_PER_MIN = 0.40; // Shotstack pay-as-you-go
const RENDER_PASSES = 4; // preview + 2 corrections + final
const PERFORMANCE_RATIO = 0.30; // 30% of clips are PERFORMANCE (need lipsync)
const IMAGE_CORRECTION_BUFFER = 1.35; // 35% extra images for corrections
const VIDEO_REGEN_BUFFER = 1.25; // 25% extra videos for re-generations
const USER_CORRECTION_BUFFER = 0.15; // 15% of total for user correction rounds

const MARKUP_MULTIPLIER = 5.0;

// ============================================
// TYPES
// ============================================

export interface BudgetConfig {
  songDurationSec: number;
  clipDurationSec: number; // 3, 4, or 5
  videoModelId: string;
  imageModelId: string;
  includesLipsync: boolean;
  includesMotion: boolean;
  includesMicrocuts: boolean;
  resolution: '720p' | '1080p' | '4k';
}

export interface CostBreakdown {
  images: { count: number; unitCost: number; total: number };
  videos: { count: number; unitCost: number; total: number };
  lipsync: { count: number; unitCost: number; total: number };
  motion: { count: number; unitCost: number; total: number };
  openai: { total: number };
  render: { passes: number; unitCost: number; total: number };
  corrections: { buffer: number; total: number };
}

export interface BudgetResult {
  // Counts
  numClips: number;
  numPerformanceClips: number;
  totalVideoSeconds: number;
  
  // Costs
  costBreakdown: CostBreakdown;
  internalCost: number;
  markupMultiplier: number;
  userPrice: number;
  displayPrice: number; // Rounded to commercial price ($X9)
  
  // Per-unit
  costPerClip: number;
  
  // Model info
  videoModel: ModelPricing;
  imageModel: { name: string; costPerImage: number };
  
  // Tier label
  tierLabel: string;
  tierEmoji: string;
}

// ============================================
// CALCULATOR
// ============================================

export function calculateVideoBudget(config: BudgetConfig): BudgetResult {
  const videoModel = VIDEO_MODEL_PRICING[config.videoModelId] || VIDEO_MODEL_PRICING['kling-2.6-pro'];
  const imageModel = IMAGE_MODEL_PRICING[config.imageModelId] || IMAGE_MODEL_PRICING['flux-2-pro'];
  
  // Calculate clip counts
  const numClips = Math.ceil(config.songDurationSec / config.clipDurationSec);
  const numPerformanceClips = Math.ceil(numClips * PERFORMANCE_RATIO);
  const clipVideoSec = Math.min(config.clipDurationSec, videoModel.maxDuration);
  const totalVideoSeconds = numClips * clipVideoSec;
  
  // Song duration in minutes for render
  const songMinutes = config.songDurationSec / 60;
  
  // ---- IMAGES ----
  const imageCount = Math.ceil(numClips * IMAGE_CORRECTION_BUFFER);
  const imageCost = imageCount * imageModel.costPerImage;
  
  // ---- VIDEOS ----
  const videoCount = Math.ceil(numClips * VIDEO_REGEN_BUFFER);
  const videoUnitCost = clipVideoSec * videoModel.costPerSecond;
  const videoCost = videoCount * videoUnitCost;
  
  // ---- LIPSYNC ----
  let lipsyncCount = 0;
  let lipsyncCost = 0;
  if (config.includesLipsync) {
    lipsyncCount = Math.ceil(numPerformanceClips * 1.25); // 25% re-sync buffer
    lipsyncCost = lipsyncCount * clipVideoSec * LIPSYNC_COST_PER_SEC;
  }
  
  // ---- MOTION TRANSFER ----
  let motionCount = 0;
  let motionCost = 0;
  if (config.includesMotion) {
    motionCount = MOTION_TRANSFER_CLIPS;
    motionCost = motionCount * MOTION_TRANSFER_COST_PER_CLIP;
  }
  
  // ---- OPENAI ----
  const openaiCost = OPENAI_FIXED_COST;
  
  // ---- RENDER ----
  const renderUnitCost = songMinutes * RENDER_COST_PER_MIN;
  const renderCost = RENDER_PASSES * renderUnitCost;
  
  // ---- CORRECTIONS BUFFER ----
  const subtotal = imageCost + videoCost + lipsyncCost + motionCost + openaiCost + renderCost;
  const correctionsCost = subtotal * USER_CORRECTION_BUFFER;
  
  // ---- TOTALS ----
  const internalCost = subtotal + correctionsCost;
  const userPrice = internalCost * MARKUP_MULTIPLIER;
  
  // Round to commercial price ending in 9
  const displayPrice = roundToCommercialPrice(userPrice);
  
  const costBreakdown: CostBreakdown = {
    images: { count: imageCount, unitCost: imageModel.costPerImage, total: imageCost },
    videos: { count: videoCount, unitCost: videoUnitCost, total: videoCost },
    lipsync: { count: lipsyncCount, unitCost: clipVideoSec * LIPSYNC_COST_PER_SEC, total: lipsyncCost },
    motion: { count: motionCount, unitCost: MOTION_TRANSFER_COST_PER_CLIP, total: motionCost },
    openai: { total: openaiCost },
    render: { passes: RENDER_PASSES, unitCost: renderUnitCost, total: renderCost },
    corrections: { buffer: USER_CORRECTION_BUFFER, total: correctionsCost },
  };
  
  // Tier info
  const tierMap: Record<string, { label: string; emoji: string }> = {
    'cinematic': { label: 'CINEMATIC', emoji: '💎' },
    'ultra': { label: 'ULTRA', emoji: '🥇' },
    'premium': { label: 'PREMIUM', emoji: '🥈' },
    'studio': { label: 'STUDIO', emoji: '🥉' },
    'standard': { label: 'STANDARD', emoji: '⭐' },
  };
  const tier = tierMap[videoModel.tier] || tierMap['standard'];
  
  return {
    numClips,
    numPerformanceClips,
    totalVideoSeconds,
    costBreakdown,
    internalCost: Math.round(internalCost * 100) / 100,
    markupMultiplier: MARKUP_MULTIPLIER,
    userPrice: Math.round(userPrice * 100) / 100,
    displayPrice,
    costPerClip: Math.round((displayPrice / numClips) * 100) / 100,
    videoModel,
    imageModel,
    tierLabel: tier.label,
    tierEmoji: tier.emoji,
  };
}

/**
 * Round to nearest commercial price ending in 9
 * e.g. $212 → $219, $348 → $349, $87 → $89
 */
function roundToCommercialPrice(price: number): number {
  if (price <= 50) return Math.ceil(price / 10) * 10 - 1; // $49, $39, etc.
  if (price <= 100) return Math.ceil(price / 10) * 10 - 1; // $99, $89, etc.
  if (price <= 200) return Math.ceil(price / 50) * 50 - 1; // $149, $199
  if (price <= 500) return Math.ceil(price / 50) * 50 - 1; // $249, $349, $499
  return Math.ceil(price / 100) * 100 - 1; // $599, $799, etc.
}

/**
 * Get all available video models sorted by tier
 */
export function getAvailableVideoModels(): ModelPricing[] {
  return Object.values(VIDEO_MODEL_PRICING).sort((a, b) => {
    const order = { cinematic: 0, ultra: 1, premium: 2, studio: 3, standard: 4 };
    return (order[a.tier] ?? 5) - (order[b.tier] ?? 5);
  });
}

/**
 * Format seconds to human readable duration
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format price to USD display
 */
export function formatPrice(price: number): string {
  return `$${price.toFixed(0)}`;
}
