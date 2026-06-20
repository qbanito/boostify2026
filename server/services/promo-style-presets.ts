/**
 * 🎨 Promo Style Presets — cinematic / editorial / street / etc.
 *
 * Each preset enriches the prompt with photography/cinematography vocabulary
 * so flux-pro/kontext outputs feel like real captures, not "AI looking" art.
 */

export type PromoStyle =
  | 'cinematic'
  | 'editorial_photography'
  | 'street_documentary'
  | 'neon_cyberpunk'
  | 'golden_hour'
  | 'studio_album_cover';

export interface StylePreset {
  id: PromoStyle;
  label: string;
  description: string;
  promptSuffix: string;      // appended to the creative prompt
  negativePrompt?: string;
  cameraSetup: string;       // for movement prompt in Kling later
}

export const PROMO_STYLE_PRESETS: Record<PromoStyle, StylePreset> = {
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Anamorphic film look — Arri Alexa, teal & orange grade, shallow DOF.',
    promptSuffix:
      'shot on Arri Alexa, anamorphic lens flare, 2.39:1 aspect, teal-and-orange color grade, shallow depth of field, soft volumetric lighting, fine 35mm film grain, photorealistic, cinematic still, hyper-detailed skin texture',
    negativePrompt: 'cartoon, illustration, painting, 3d render, plastic skin, oversaturated, text, watermark, logo',
    cameraSetup: 'slow dolly-in, anamorphic squeeze, subtle parallax',
  },
  editorial_photography: {
    id: 'editorial_photography',
    label: 'Editorial',
    description: 'Vogue-style editorial — hard light, 85mm portrait, magazine retouch.',
    promptSuffix:
      'editorial fashion photography, Vogue magazine cover style, 85mm f/1.4 portrait lens, hard rim light, beauty dish key, studio backdrop, sharp tack-focus eyes, high-end skin retouch, professional color, photorealistic',
    negativePrompt: 'cartoon, illustration, 3d, plastic, oversaturated, lowres, text, watermark',
    cameraSetup: 'static portrait, micro-tilt, breathing motion',
  },
  street_documentary: {
    id: 'street_documentary',
    label: 'Street',
    description: 'Leica documentary — available light, candid, Kodak Portra 400.',
    promptSuffix:
      'street documentary photography, Leica M11 35mm Summilux, available light only, candid moment, Kodak Portra 400 film stock, natural skin tones, urban background bokeh, photorealistic, gritty texture, true-to-life colors',
    negativePrompt: 'studio lighting, posed, glossy, retouched, illustration, cartoon, text, watermark',
    cameraSetup: 'handheld, slight shake, walk-and-talk feel',
  },
  neon_cyberpunk: {
    id: 'neon_cyberpunk',
    label: 'Neon',
    description: 'Wong Kar-wai meets Blade Runner — neon, rain, RGB lights.',
    promptSuffix:
      'neon-lit night scene, Tokyo back-alley vibes, rain-slick pavement reflections, magenta and cyan rim lights, atmospheric haze, Wong Kar-wai meets Blade Runner, anamorphic lens, photorealistic',
    negativePrompt: 'daylight, illustration, cartoon, oversaturated cliche, text, watermark',
    cameraSetup: 'slow side-track, neon flicker, rain motion',
  },
  golden_hour: {
    id: 'golden_hour',
    label: 'Golden Hour',
    description: 'Magic-hour backlight — Roger Deakins, 50mm anamorphic.',
    promptSuffix:
      'golden hour magic light, sun backlight rim, 50mm anamorphic, Roger Deakins cinematography, warm tones with cool shadows, lens flare, dust particles in air, photorealistic, cinematic still',
    negativePrompt: 'flat light, cartoon, illustration, lowres, text, watermark',
    cameraSetup: 'slow push-in, light flicker, breeze on hair',
  },
  studio_album_cover: {
    id: 'studio_album_cover',
    label: 'Album Cover',
    description: 'Studio strobe + seamless paper — large format album-cover feel.',
    promptSuffix:
      'studio strobe lighting, seamless backdrop, large-format 4x5 camera look, ultra-sharp detail, magazine cover layout-friendly, beauty retouch, photorealistic',
    negativePrompt: 'cartoon, illustration, 3d render, blur, lowres, watermark',
    cameraSetup: 'static, micro-zoom, deliberate stillness',
  },
};

export function styleList(): StylePreset[] {
  return Object.values(PROMO_STYLE_PRESETS);
}

export function getStyle(id: string): StylePreset {
  const preset = PROMO_STYLE_PRESETS[id as PromoStyle];
  if (!preset) return PROMO_STYLE_PRESETS.cinematic;
  return preset;
}
