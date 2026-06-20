/**
 * BOOSTIFY Smart Credit Pricing System
 * =====================================
 * Central config for ALL billable operations.
 * 
 * CREDITS: 1 credit = $0.01 USD
 * MARKUP: Default 5x (admin-configurable via DB)
 * 
 * Formula: userCredits = ceil(internalCost * markupMultiplier * 100)
 * Example: $0.04 internal → 0.04 * 5 * 100 = 20 credits ($0.20 to user)
 */

// ============================================
// OPERATION CATEGORIES
// ============================================

export type OperationCategory =
  | 'image_generation'
  | 'video_generation'
  | 'audio_generation'
  | 'lipsync'
  | 'voice_ai'
  | 'text_ai'
  | 'transcription'
  | 'scraping'
  | 'email'
  | 'rendering'
  | 'video_upscale'
  | 'motion_transfer';

export type OperationType = keyof typeof OPERATION_COSTS;

export interface OperationCost {
  category: OperationCategory;
  name: string;
  internalCostUsd: number;        // Actual API cost in USD
  unit: 'per_call' | 'per_second' | 'per_minute' | 'per_image' | 'per_video';
  description: string;
  provider: string;
  model?: string;
}

// ============================================
// DEFAULT MARKUP (5x — admin overridable)
// ============================================

export const DEFAULT_MARKUP_MULTIPLIER = 5.0;
export const CREDITS_PER_DOLLAR = 100; // 1 credit = $0.01

// ============================================
// OPERATION COSTS (Internal API cost in USD)
// ============================================

export const OPERATION_COSTS = {
  // --- IMAGE GENERATION ---
  'image.nano_banana_2': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Generation (Nano Banana 2)',
    internalCostUsd: 0.04,
    unit: 'per_image' as const,
    description: 'AI image generation via Flux 2 Pro',
    provider: 'fal',
    model: 'fal-ai/nano-banana-2',
  },
  'image.nano_banana_2_edit': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Edit (Nano Banana 2)',
    internalCostUsd: 0.045,
    unit: 'per_image' as const,
    description: 'AI image editing/img2img',
    provider: 'fal',
    model: 'fal-ai/nano-banana-2/edit',
  },
  'image.flux_2_pro': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Generation (Flux 2 Pro)',
    internalCostUsd: 0.05,
    unit: 'per_image' as const,
    description: 'High quality Flux 2 Pro image',
    provider: 'fal',
    model: 'fal-ai/flux-2-pro',
  },
  'image.flux_pro': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Generation (Flux Pro)',
    internalCostUsd: 0.005,
    unit: 'per_image' as const,
    description: 'Standard Flux Pro image',
    provider: 'fal',
    model: 'fal-ai/flux-pro',
  },
  'image.flux_schnell': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Generation (Flux Schnell)',
    internalCostUsd: 0.003,
    unit: 'per_image' as const,
    description: 'Fast budget image generation',
    provider: 'fal',
    model: 'fal-ai/flux/schnell',
  },
  'image.flux_dev': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Generation (Flux Dev)',
    internalCostUsd: 0.025,
    unit: 'per_image' as const,
    description: 'Dev-quality image generation',
    provider: 'fal',
    model: 'fal-ai/flux/dev',
  },
  'image.gemini_native': {
    category: 'image_generation' as OperationCategory,
    name: 'Image Generation (Gemini Native)',
    internalCostUsd: 0.005,
    unit: 'per_image' as const,
    description: 'Gemini native image generation',
    provider: 'gemini',
    model: 'gemini-image',
  },

  // --- VIDEO GENERATION ---
  'video.seedance_2_fast': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Seedance 2.0 ByteDance)',
    internalCostUsd: 0.2419,
    unit: 'per_second' as const,
    description: 'ByteDance Seedance 2.0 — most advanced, native synced audio, up to 15s ($0.2419/sec)',
    provider: 'fal',
    model: 'bytedance/seedance-2.0/fast/reference-to-video',
  },
  'video.kling_o3': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Kling 3.0 O3)',
    internalCostUsd: 0.84,
    unit: 'per_video' as const,
    description: 'Premium Kling O3 — 5sec clip',
    provider: 'fal',
    model: 'kling-o3',
  },
  'video.kling_25_turbo': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Kling 2.5 Turbo Pro)',
    internalCostUsd: 0.35,
    unit: 'per_video' as const,
    description: 'Kling 2.5 Turbo — 5sec clip',
    provider: 'fal',
    model: 'kling-2.5-turbo-pro',
  },
  'video.kling_26_pro': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Kling 2.6 Pro)',
    internalCostUsd: 0.35,
    unit: 'per_video' as const,
    description: 'Kling 2.6 Pro — 5sec clip',
    provider: 'fal',
    model: 'kling-2.6-pro',
  },
  'video.kling_o1_ref2v': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Kling O1 Ref2V)',
    internalCostUsd: 0.50,
    unit: 'per_video' as const,
    description: 'Kling O1 with reference — 5sec clip',
    provider: 'fal',
    model: 'kling-o1-ref2v',
  },
  'video.kling_21_pro': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Kling 2.1 Pro)',
    internalCostUsd: 0.45,
    unit: 'per_video' as const,
    description: 'Kling 2.1 Pro — 5sec clip',
    provider: 'fal',
    model: 'kling-2.1-pro',
  },
  'video.veo3_standard': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Veo 3 Standard)',
    internalCostUsd: 2.50,
    unit: 'per_video' as const,
    description: 'Google Veo 3 — premium 5sec clip',
    provider: 'fal',
    model: 'veo-3-standard',
  },
  'video.veo31': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Veo 3.1)',
    internalCostUsd: 1.00,
    unit: 'per_video' as const,
    description: 'Google Veo 3.1 — 5sec clip',
    provider: 'fal',
    model: 'veo-3.1',
  },
  'video.grok_imagine': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (Grok Imagine)',
    internalCostUsd: 0.30,
    unit: 'per_video' as const,
    description: 'xAI Grok video — 6sec clip',
    provider: 'fal',
    model: 'grok-imagine',
  },
  // Happy Horse — viral video models (Alibaba). Priced per 5-second segment.
  // 15-second video = 3 segments. Cost calculation: internalCostUsd * (durationSec / 5).
  'video.happy_horse_i2v': {
    category: 'video_generation' as OperationCategory,
    name: 'Viral Video (Happy Horse Image-to-Video)',
    internalCostUsd: 0.15,
    unit: 'per_second' as const,
    description: 'Alibaba Happy Horse I2V — viral short (up to 15s, $0.15/sec)',
    provider: 'fal',
    model: 'alibaba/happy-horse/image-to-video',
  },
  'video.happy_horse_r2v': {
    category: 'video_generation' as OperationCategory,
    name: 'Viral Video (Happy Horse Reference-to-Video)',
    internalCostUsd: 0.18,
    unit: 'per_second' as const,
    description: 'Alibaba Happy Horse Ref2V — product/scene reference video, $0.18/sec',
    provider: 'fal',
    model: 'alibaba/happy-horse/reference-to-video',
  },
  'image.gpt_image_2_edit': {
    category: 'image_generation' as OperationCategory,
    name: 'Viral Image Edit (GPT-Image-2)',
    internalCostUsd: 0.08,
    unit: 'per_image' as const,
    description: 'OpenAI GPT-Image-2 Edit via FAL — premium viral image edit',
    provider: 'fal',
    model: 'openai/gpt-image-2/edit',
  },
  'video.grok_edit': {
    category: 'video_generation' as OperationCategory,
    name: 'Video Edit (Grok)',
    internalCostUsd: 0.36,
    unit: 'per_video' as const,
    description: 'Grok video editing',
    provider: 'fal',
    model: 'grok-imagine-edit',
  },
  'video.ltx_i2v': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (LTX Image-to-Video)',
    internalCostUsd: 0.10,
    unit: 'per_video' as const,
    description: 'LTX 2.19b image-to-video',
    provider: 'fal',
    model: 'ltx-2-19b',
  },
  'video.ltx_t2v': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (LTX Text-to-Video)',
    internalCostUsd: 0.10,
    unit: 'per_video' as const,
    description: 'LTX 2.3 text-to-video',
    provider: 'fal',
    model: 'ltx-2.3',
  },
  'video.piapi_hailuo': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (PiAPI Hailuo)',
    internalCostUsd: 0.10,
    unit: 'per_video' as const,
    description: 'PiAPI Hailuo text-to-video',
    provider: 'piapi',
    model: 'hailuo-t2v',
  },
  'video.minimax_direct': {
    category: 'video_generation' as OperationCategory,
    name: 'Video (MiniMax Direct)',
    internalCostUsd: 0.10,
    unit: 'per_video' as const,
    description: 'MiniMax direct image-to-video',
    provider: 'minimax',
    model: 'minimax-i2v',
  },

  // --- AUDIO GENERATION ---
  'audio.minimax_music': {
    category: 'audio_generation' as OperationCategory,
    name: 'Music Generation (MiniMax)',
    internalCostUsd: 0.03,
    unit: 'per_call' as const,
    description: 'AI music generation with vocals',
    provider: 'fal',
    model: 'minimax-music-v2',
  },
  'audio.stable_audio': {
    category: 'audio_generation' as OperationCategory,
    name: 'Audio Generation (Stable Audio)',
    internalCostUsd: 0.04,
    unit: 'per_call' as const,
    description: 'Stable Audio text-to-audio',
    provider: 'fal',
    model: 'stable-audio-25',
  },

  // --- LIPSYNC ---
  'lipsync.pixverse': {
    category: 'lipsync' as OperationCategory,
    name: 'Lip Sync (PixVerse)',
    internalCostUsd: 0.20,
    unit: 'per_video' as const,
    description: 'PixVerse AI lip sync on video clip',
    provider: 'fal',
    model: 'pixverse-lipsync',
  },
  'lipsync.musetalk': {
    category: 'lipsync' as OperationCategory,
    name: 'Lip Sync (MuseTalk)',
    internalCostUsd: 0.08,
    unit: 'per_video' as const,
    description: 'MuseTalk talking head generation',
    provider: 'fal',
    model: 'musetalk',
  },

  // --- VOICE AI ---
  'voice.clone': {
    category: 'voice_ai' as OperationCategory,
    name: 'Voice Clone',
    internalCostUsd: 0.02,
    unit: 'per_call' as const,
    description: 'Clone a voice from audio sample',
    provider: 'fal',
    model: 'qwen-3-tts-clone',
  },
  'voice.tts': {
    category: 'voice_ai' as OperationCategory,
    name: 'Text-to-Speech',
    internalCostUsd: 0.02,
    unit: 'per_call' as const,
    description: 'Generate speech from text',
    provider: 'fal',
    model: 'qwen-3-tts',
  },
  'voice.changer': {
    category: 'voice_ai' as OperationCategory,
    name: 'Voice Changer',
    internalCostUsd: 0.03,
    unit: 'per_call' as const,
    description: 'Change voice in audio',
    provider: 'fal',
    model: 'elevenlabs-voice-changer',
  },
  'voice.separate': {
    category: 'voice_ai' as OperationCategory,
    name: 'Audio Separation',
    internalCostUsd: 0.015,
    unit: 'per_call' as const,
    description: 'Separate vocals/instruments',
    provider: 'fal',
    model: 'sam-audio-separate',
  },
  'voice.enhance': {
    category: 'voice_ai' as OperationCategory,
    name: 'Audio Enhancement',
    internalCostUsd: 0.01,
    unit: 'per_call' as const,
    description: 'Enhance audio quality',
    provider: 'fal',
    model: 'deepfilternet3',
  },

  // --- TEXT AI (LLM calls) ---
  'text.gpt4o_mini': {
    category: 'text_ai' as OperationCategory,
    name: 'AI Text (GPT-4o Mini)',
    internalCostUsd: 0.002,
    unit: 'per_call' as const,
    description: 'Quick AI text generation',
    provider: 'openai',
    model: 'gpt-4o-mini',
  },
  'text.gpt4o': {
    category: 'text_ai' as OperationCategory,
    name: 'AI Text (GPT-4o)',
    internalCostUsd: 0.01,
    unit: 'per_call' as const,
    description: 'Standard AI text generation',
    provider: 'openai',
    model: 'gpt-4o',
  },
  'text.gpt41': {
    category: 'text_ai' as OperationCategory,
    name: 'AI Text (GPT-4.1)',
    internalCostUsd: 0.008,
    unit: 'per_call' as const,
    description: 'Advanced AI text/creative generation',
    provider: 'openai',
    model: 'gpt-4.1',
  },
  'text.gpt41_mini': {
    category: 'text_ai' as OperationCategory,
    name: 'AI Text (GPT-4.1 Mini)',
    internalCostUsd: 0.002,
    unit: 'per_call' as const,
    description: 'Efficient AI text generation',
    provider: 'openai',
    model: 'gpt-4.1-mini',
  },
  'text.gemini_flash': {
    category: 'text_ai' as OperationCategory,
    name: 'AI Text (Gemini Flash)',
    internalCostUsd: 0.001,
    unit: 'per_call' as const,
    description: 'Fast Gemini text generation',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
  },
  'text.claude_haiku': {
    category: 'text_ai' as OperationCategory,
    name: 'AI Text (Claude Haiku)',
    internalCostUsd: 0.0005,
    unit: 'per_call' as const,
    description: 'Social agent text via OpenRouter',
    provider: 'openrouter',
    model: 'claude-3-haiku',
  },
  'text.contract_generation': {
    category: 'text_ai' as OperationCategory,
    name: 'Legal Contract Generation',
    internalCostUsd: 0.015,
    unit: 'per_call' as const,
    description: 'AI-generated legal contracts',
    provider: 'openai',
    model: 'gpt-4o',
  },
  'text.course_generation': {
    category: 'text_ai' as OperationCategory,
    name: 'Course Content Generation',
    internalCostUsd: 0.003,
    unit: 'per_call' as const,
    description: 'AI course outline/lesson generation',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
  },

  // --- TRANSCRIPTION ---
  'transcription.whisper': {
    category: 'transcription' as OperationCategory,
    name: 'Audio Transcription (Whisper)',
    internalCostUsd: 0.006,
    unit: 'per_minute' as const,
    description: 'OpenAI Whisper speech-to-text',
    provider: 'openai',
    model: 'whisper-1',
  },

  // --- SCRAPING ---
  'scraping.apify_instagram': {
    category: 'scraping' as OperationCategory,
    name: 'Instagram Data Scrape',
    internalCostUsd: 0.50,
    unit: 'per_call' as const,
    description: 'Apify Instagram profile scraping',
    provider: 'apify',
    model: 'instagram-scraper',
  },
  'scraping.apify_venues': {
    category: 'scraping' as OperationCategory,
    name: 'Venue Discovery Scrape',
    internalCostUsd: 1.00,
    unit: 'per_call' as const,
    description: 'Google Maps venue + contact scraping',
    provider: 'apify',
    model: 'google-maps-scraper',
  },
  'scraping.apify_sponsors': {
    category: 'scraping' as OperationCategory,
    name: 'Sponsor/Brand Discovery',
    internalCostUsd: 0.50,
    unit: 'per_call' as const,
    description: 'Brand/sponsor discovery scraping',
    provider: 'apify',
    model: 'sponsor-scraper',
  },
  'scraping.hunter_search': {
    category: 'scraping' as OperationCategory,
    name: 'Email Discovery (Hunter.io)',
    internalCostUsd: 0.02,
    unit: 'per_call' as const,
    description: 'Hunter.io domain email search',
    provider: 'hunter',
    model: 'domain-search',
  },

  // --- EMAIL ---
  'email.outreach': {
    category: 'email' as OperationCategory,
    name: 'Outreach Email',
    internalCostUsd: 0.002,
    unit: 'per_call' as const,
    description: 'AI-generated + Brevo send',
    provider: 'brevo',
    model: 'transactional',
  },

  // --- RENDERING ---
  'render.shotstack': {
    category: 'rendering' as OperationCategory,
    name: 'Video Render (Shotstack)',
    internalCostUsd: 0.08,
    unit: 'per_minute' as const,
    description: 'Shotstack video rendering',
    provider: 'shotstack',
    model: 'render-v1',
  },

  // --- VIDEO UPSCALE ---
  'video_upscale.qubico': {
    category: 'video_upscale' as OperationCategory,
    name: 'Video Upscale',
    internalCostUsd: 0.08,
    unit: 'per_video' as const,
    description: 'PiAPI Qubico video upscaling',
    provider: 'piapi',
    model: 'qubico-upscale',
  },

  // --- MOTION TRANSFER ---
  'motion.dreamactor': {
    category: 'motion_transfer' as OperationCategory,
    name: 'Motion Transfer (DreamActor)',
    internalCostUsd: 0.50,
    unit: 'per_call' as const,
    description: 'DreamActor v2 motion transfer per clip',
    provider: 'fal',
    model: 'dreamactor-v2',
  },
} as const;

// ============================================
// CREDIT CALCULATION HELPERS
// ============================================

/**
 * Calculate credits for an operation using the default markup
 */
export function calculateCredits(
  operationType: OperationType,
  markup: number = DEFAULT_MARKUP_MULTIPLIER,
  quantity: number = 1
): number {
  const op = OPERATION_COSTS[operationType];
  if (!op) return 0;
  return Math.ceil(op.internalCostUsd * markup * CREDITS_PER_DOLLAR * quantity);
}

/**
 * Calculate credits from raw USD cost (for dynamic operations)
 */
export function creditsFromUsd(
  internalCostUsd: number,
  markup: number = DEFAULT_MARKUP_MULTIPLIER
): number {
  return Math.ceil(internalCostUsd * markup * CREDITS_PER_DOLLAR);
}

/**
 * Convert credits back to USD display price
 */
export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_DOLLAR;
}

/**
 * Get operation info with calculated credit cost
 */
export function getOperationPricing(
  operationType: OperationType,
  markup: number = DEFAULT_MARKUP_MULTIPLIER
): OperationCost & { creditCost: number; userPriceUsd: number } {
  const op = OPERATION_COSTS[operationType];
  if (!op) {
    throw new Error(`Unknown operation type: ${operationType}`);
  }
  const creditCost = calculateCredits(operationType, markup);
  return {
    ...op,
    creditCost,
    userPriceUsd: creditsToUsd(creditCost),
  };
}

/**
 * Get all operations with pricing for a category
 */
export function getCategoryPricing(
  category: OperationCategory,
  markup: number = DEFAULT_MARKUP_MULTIPLIER
): Array<{ type: string } & OperationCost & { creditCost: number; userPriceUsd: number }> {
  return Object.entries(OPERATION_COSTS)
    .filter(([_, op]) => op.category === category)
    .map(([type, op]) => ({
      type,
      ...op,
      creditCost: calculateCredits(type as OperationType, markup),
      userPriceUsd: creditsToUsd(calculateCredits(type as OperationType, markup)),
    }));
}

/**
 * Get complete pricing table for admin dashboard
 */
export function getFullPricingTable(markup: number = DEFAULT_MARKUP_MULTIPLIER) {
  return Object.entries(OPERATION_COSTS).map(([type, op]) => ({
    type,
    ...op,
    creditCost: calculateCredits(type as OperationType, markup),
    userPriceUsd: creditsToUsd(calculateCredits(type as OperationType, markup)),
    markupMultiplier: markup,
  }));
}

// ============================================
// SUBSCRIPTION TIER CREDIT ALLOCATIONS
// ============================================

export interface TierCreditConfig {
  monthlyCredits: number;
  bonusCreditsOnPurchase: number; // % extra when buying credits
  discountOnCredits: number;      // % discount on credit pricing
}

export const TIER_CREDIT_ALLOCATIONS: Record<string, TierCreditConfig> = {
  free: {
    monthlyCredits: 50,           // ~$0.50 — enough to try 2-3 images
    bonusCreditsOnPurchase: 0,
    discountOnCredits: 0,
  },
  artist: {
    monthlyCredits: 200,          // ~$2.00 — ~5 images
    bonusCreditsOnPurchase: 0,
    discountOnCredits: 0,
  },
  creator: {
    monthlyCredits: 500,          // ~$5.00 — ~12 images or 1 short video
    bonusCreditsOnPurchase: 5,    // 5% extra credits on purchase
    discountOnCredits: 0,
  },
  professional: {
    monthlyCredits: 2000,         // ~$20.00 — ~50 images or 3-4 videos
    bonusCreditsOnPurchase: 10,   // 10% extra credits
    discountOnCredits: 5,         // 5% cheaper per-operation
  },
  enterprise: {
    monthlyCredits: 10000,        // ~$100.00 — heavy usage
    bonusCreditsOnPurchase: 20,   // 20% extra credits
    discountOnCredits: 15,        // 15% cheaper per-operation
  },
};

/**
 * Credit purchase packages
 */
export const CREDIT_PACKAGES = [
  { id: 'starter',    credits: 500,    priceUsd: 4.99,    popular: false, label: 'Starter' },
  { id: 'basic',      credits: 1200,   priceUsd: 9.99,    popular: false, label: 'Basic' },
  { id: 'standard',   credits: 3000,   priceUsd: 24.99,   popular: true,  label: 'Standard' },
  { id: 'pro',        credits: 7500,   priceUsd: 49.99,   popular: false, label: 'Pro' },
  { id: 'studio',     credits: 20000,  priceUsd: 99.99,   popular: false, label: 'Studio' },
  { id: 'enterprise', credits: 60000,  priceUsd: 249.99,  popular: false, label: 'Enterprise' },
];
