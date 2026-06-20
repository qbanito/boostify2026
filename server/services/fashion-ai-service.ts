/**
 * Fashion AI Service
 * Generates brand identities, collections, products and campaigns for the
 * Fashion Virtual Store module using OpenRouter + FAL AI.
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { generateImageWithNanoBanana, editImageWithNanoBanana } from './fal-service';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Image reference helpers ──────────────────────────────────────────────────

// Video / non-image URLs cannot be used as FAL image references. The artist's
// coverImage is often an .mp4 loop banner, which makes the FAL edit endpoint
// fail with "Could not generate images with the given prompts and images".
const NON_IMAGE_EXT_RE = /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|ogv|m3u8)(\?|#|$)/i;

/** Returns true only for usable still-image URLs (filters out videos/non-http). */
export function isLikelyImageUrl(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (NON_IMAGE_EXT_RE.test(url)) return false;
  return true;
}

/** Normalizes a single URL or list into a deduped array of valid image URLs. */
function toImageRefs(refs?: string | string[]): string[] {
  if (!refs) return [];
  const arr = Array.isArray(refs) ? refs : [refs];
  return Array.from(new Set(arr.filter(isLikelyImageUrl)));
}

// ─── Product category normalization ───────────────────────────────────────────

// The fashion_products table enforces a CHECK constraint on these values, so the
// free-form categories the LLM produces (hoodie, tee, sneakers, …) must be mapped
// onto this fixed set before insert.
export type FashionProductCategory =
  | 'top' | 'bottom' | 'outerwear' | 'footwear'
  | 'accessory' | 'headwear' | 'bodysuit' | 'set';

const CATEGORY_ALIASES: Record<string, FashionProductCategory> = {
  top: 'top', tee: 'top', tshirt: 'top', 't-shirt': 'top', shirt: 'top',
  blouse: 'top', tank: 'top', croptop: 'top', 'crop top': 'top', sweater: 'top',
  knit: 'top', longsleeve: 'top', pullover: 'top',
  bottom: 'bottom', pants: 'bottom', trousers: 'bottom', jeans: 'bottom',
  shorts: 'bottom', skirt: 'bottom', leggings: 'bottom',
  outerwear: 'outerwear', jacket: 'outerwear', coat: 'outerwear', hoodie: 'outerwear',
  blazer: 'outerwear', parka: 'outerwear', vest: 'outerwear', cardigan: 'outerwear',
  footwear: 'footwear', shoes: 'footwear', sneakers: 'footwear', boots: 'footwear',
  heels: 'footwear', sandals: 'footwear', slides: 'footwear',
  accessory: 'accessory', accessories: 'accessory', bag: 'accessory', clutch: 'accessory',
  backpack: 'accessory', belt: 'accessory', jewelry: 'accessory', necklace: 'accessory',
  choker: 'accessory', earrings: 'accessory', ring: 'accessory', bracelet: 'accessory',
  scarf: 'accessory', gloves: 'accessory', sunglasses: 'accessory', eyewear: 'accessory',
  watch: 'accessory', socks: 'accessory',
  headwear: 'headwear', hat: 'headwear', cap: 'headwear', beanie: 'headwear', bucket: 'headwear',
  bodysuit: 'bodysuit', jumpsuit: 'bodysuit', romper: 'bodysuit', dress: 'bodysuit', gown: 'bodysuit',
  set: 'set', tracksuit: 'set', coord: 'set', 'co-ord': 'set', suit: 'set',
};

/** Maps an arbitrary LLM category string onto a valid DB category value. */
export function normalizeProductCategory(raw?: string): FashionProductCategory {
  if (!raw) return 'top';
  const key = raw.toString().trim().toLowerCase();
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  // Try matching individual words (e.g. "graphic tee", "wide-leg pants").
  for (const word of key.split(/[^a-z]+/).filter(Boolean)) {
    if (CATEGORY_ALIASES[word]) return CATEGORY_ALIASES[word];
  }
  return 'accessory';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArtistContext {
  artistName: string;
  genre?: string;
  biography?: string;
  profileImageUrl?: string;
  genres?: string[];
  // Additional still-image references (e.g. profile gallery) used to keep the
  // generated fashion visuals consistent with the artist's real look.
  referenceImages?: string[];
  // Extended context — used for richer brand generation
  country?: string;
  instagramHandle?: string;
  spotifyUrl?: string;
  tiktokUrl?: string;
  concertHighlights?: Array<{ eventName: string; year: number; note?: string }>;
  upcomingTours?: Array<{ tourName: string; location: { city: string; country: string; venue: string }; date: string }>;
  masterJson?: Record<string, any> | null;
}

export interface BrandIdentityResult {
  brandName: string;
  tagline: string;
  aesthetic: string;
  colorPalette: string[];
  typographyStyle: string;
  brandManifesto: string;
  brandStory: string;
  founded: string;
  influences: string[];
  logoUrl?: string;
  moodboardUrls?: string[];
}

export interface CollectionResult {
  name: string;
  season: 'spring_summer' | 'fall_winter' | 'limited' | 'capsule' | 'collab';
  year: number;
  theme: string;
  heroImageUrl?: string;
  lookbookUrls?: string[];
}

export interface ProductConceptResult {
  name: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice: number;
  visualDirection: string;
  colorways: string[];
  materials: string[];
  productImageUrls?: string[];
}

export interface CampaignResult {
  title: string;
  concept: string;
  caption: string;
  hashtags: string[];
  videoPrompt: string;
  campaignImages?: string[];
}

// ─── Brand Identity Generator ────────────────────────────────────────────────

export async function generateBrandIdentity(
  artist: ArtistContext
): Promise<BrandIdentityResult> {
  const genreText = Array.isArray(artist.genres) && artist.genres.length > 0
    ? artist.genres.join(', ')
    : artist.genre || 'music';

  // Build enriched context sections
  const locationLine = artist.country
    ? `Location/Cultural Origin: ${artist.country}`
    : '';

  const socialLine = [
    artist.instagramHandle ? `Instagram: @${artist.instagramHandle}` : '',
    artist.tiktokUrl ? `TikTok: active` : '',
    artist.spotifyUrl ? `Spotify: active` : '',
  ].filter(Boolean).join(' · ');

  const concertLine = artist.concertHighlights?.length
    ? `Concert legacy: ${artist.concertHighlights.map(c => `${c.eventName} (${c.year})`).join(', ')}`
    : '';

  const tourLine = artist.upcomingTours?.length
    ? `Upcoming tours: ${artist.upcomingTours.map(t => `${t.tourName} in ${t.location.city}`).join(', ')}`
    : '';

  // Extract masterJson personality/style notes if available
  const mj = artist.masterJson as any;
  const masterContext = mj ? [
    mj.personality ? `Personality: ${mj.personality}` : '',
    mj.visualStyle ? `Visual style: ${mj.visualStyle}` : '',
    mj.fashionInfluences ? `Fashion influences: ${Array.isArray(mj.fashionInfluences) ? mj.fashionInfluences.join(', ') : mj.fashionInfluences}` : '',
    mj.styleNotes ? `Style notes: ${mj.styleNotes}` : '',
    mj.monthly_listeners ? `Monthly listeners: ${mj.monthly_listeners.toLocaleString()}` : '',
    mj.followers?.instagram ? `Instagram followers: ${mj.followers.instagram.toLocaleString()}` : '',
  ].filter(Boolean).join('\n') : '';

  const prompt = `You are a world-class luxury fashion brand strategist and creative director.

Create a complete fashion brand identity for music artist: "${artist.artistName}"
Genre: ${genreText}
Biography: ${artist.biography?.substring(0, 500) || 'Innovative independent artist'}
${locationLine}
${socialLine}
${concertLine}
${tourLine}
${masterContext}

Generate a premium, cinematic, futuristic fashion brand that feels like this artist owns a living fashion universe — not just a merch store. The brand should feel deeply connected to the artist's music identity, cultural background, and visual world.

Respond ONLY with valid JSON in this exact structure:
{
  "brandName": "UPPERCASE brand name (evocative and editorial, can differ from artist name)",
  "tagline": "Short powerful tagline (max 8 words)",
  "aesthetic": "One-paragraph description of the visual aesthetic — include textures, lighting, silhouettes, color moods",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "typographyStyle": "display / serif / sans / mono / mixed",
  "brandManifesto": "2-3 sentences of powerful brand philosophy",
  "brandStory": "One paragraph origin story connecting music identity to fashion",
  "founded": "Year or era (e.g. 2024 or 'Born from the underground')",
  "influences": ["Fashion house or era 1", "Brand or era 2", "Cultural movement 3"]
}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  const data = JSON.parse(raw);

  // Style references for FAL: primary artist image + gallery references.
  const styleRefs = toImageRefs([artist.profileImageUrl, ...(artist.referenceImages || [])]);

  // Generate logo + moodboard images via FAL → OpenAI fallback
  const logoUrl = await generateFashionImage(
    `Minimalist luxury fashion brand logo for "${data.brandName}". ${data.aesthetic}. 
     Clean vector-style, editorial, high-end fashion house aesthetic. 
     Color palette: ${data.colorPalette?.join(', ')}. Pure black background. Ultra HD.`,
    '1:1',
    styleRefs
  );

  const moodboardUrls: string[] = [];
  const moodPrompt = `Cinematic fashion editorial moodboard for brand "${data.brandName}". 
    ${data.aesthetic}. ${data.brandManifesto}. 
    Influences: ${data.influences?.join(', ')}. 
    Ultra high fashion, magazine quality, dark cinematic lighting.`;

  const mb1 = await generateFashionImage(moodPrompt + ' Wide establishing shot.', '16:9', styleRefs);
  const mb2 = await generateFashionImage(moodPrompt + ' Close-up texture and fabric detail.', '4:5');
  if (mb1) moodboardUrls.push(mb1);
  if (mb2) moodboardUrls.push(mb2);

  return {
    brandName: data.brandName || `${artist.artistName} STUDIO`,
    tagline: data.tagline || 'Fashion beyond music',
    aesthetic: data.aesthetic || '',
    colorPalette: data.colorPalette || ['#0A0A0A', '#F5F5F0', '#C4A882', '#2D2D2D'],
    typographyStyle: data.typographyStyle || 'display',
    brandManifesto: data.brandManifesto || '',
    brandStory: data.brandStory || '',
    founded: data.founded || String(new Date().getFullYear()),
    influences: data.influences || [],
    logoUrl: logoUrl || undefined,
    moodboardUrls,
  };
}

// ─── Collection Generator ────────────────────────────────────────────────────

export async function generateCollection(
  brand: { brandName: string; aesthetic: string; colorPalette: string[] },
  artist: ArtistContext,
  options: {
    season?: string;
    inspiredBySong?: string;
    year?: number;
  } = {}
): Promise<CollectionResult> {
  const year = options.year || new Date().getFullYear();
  const seasonLabel = options.season || 'limited';
  const songRef = options.inspiredBySong ? `Inspired by the song: "${options.inspiredBySong}"` : '';

  const prompt = `You are the creative director for fashion brand "${brand.brandName}".

Create a ${seasonLabel} fashion collection for ${year}.
Brand aesthetic: ${brand.aesthetic}
Artist: ${artist.artistName} (${artist.genre || 'music'})
${songRef}

Respond ONLY with valid JSON:
{
  "name": "Collection name in UPPERCASE (evocative, editorial, 1-3 words)",
  "theme": "2-sentence conceptual direction for the collection",
  "keyPieces": ["piece 1", "piece 2", "piece 3"]
}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.85,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  const data = JSON.parse(raw);

  const styleRefs = toImageRefs([artist.profileImageUrl, ...(artist.referenceImages || [])]);

  const heroPrompt = `Cinematic fashion editorial hero shot for collection "${data.name}" by ${brand.brandName}. 
    ${data.theme}. ${brand.aesthetic}. 
    High fashion magazine cover quality. Dark dramatic lighting. 
    Colors: ${brand.colorPalette?.slice(0, 3).join(', ')}.`;

  const heroImageUrl = await generateFashionImage(heroPrompt, '16:9', styleRefs);

  const lookbookUrls: string[] = [];
  const lbPrompt = `Fashion lookbook editorial spread for "${data.name}" collection, ${brand.brandName}. ${data.theme}. ${brand.aesthetic}.`;
  const lb1 = await generateFashionImage(lbPrompt + ' Full body model shot, dramatic lighting.', '4:5', styleRefs);
  const lb2 = await generateFashionImage(lbPrompt + ' Close-up detail, fabric texture, accessories.', '1:1');
  if (lb1) lookbookUrls.push(lb1);
  if (lb2) lookbookUrls.push(lb2);

  return {
    name: data.name || `${brand.brandName} ${year}`,
    season: seasonLabel as CollectionResult['season'],
    year,
    theme: data.theme || '',
    heroImageUrl: heroImageUrl || undefined,
    lookbookUrls,
  };
}

// ─── Product Concept Generator ────────────────────────────────────────────────

export async function generateProductConcept(
  brand: { brandName: string; aesthetic: string; colorPalette: string[] },
  collection: { name: string; theme: string },
  category: string,
  artistImageUrl?: string,
  referenceImages?: string[]
): Promise<ProductConceptResult> {
  const prompt = `You are a luxury fashion product designer for brand "${brand.brandName}".

Design a ${category} for collection "${collection.name}".
Collection theme: ${collection.theme}
Brand aesthetic: ${brand.aesthetic}

Respond ONLY with valid JSON:
{
  "name": "PRODUCT NAME in UPPERCASE",
  "description": "2-3 sentence product description with storytelling",
  "price": 89,
  "compareAtPrice": 120,
  "visualDirection": "One sentence describing how to photograph this product",
  "colorways": ["color1", "color2"],
  "materials": ["material1", "material2"]
}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 400,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  const data = JSON.parse(raw);

  // Generate 3 product images: flat lay, model, editorial
  const productImageUrls: string[] = [];
  const modelRefs = toImageRefs([artistImageUrl, ...(referenceImages || [])]);

  const basePrompt = `Professional fashion product photography. ${data.name} by ${brand.brandName}. 
    ${data.visualDirection || ''}. ${brand.aesthetic}. 
    Colors: ${brand.colorPalette?.slice(0, 2).join(', ')}.`;

  const img1 = await generateFashionImage(basePrompt + ' Clean flat lay on dark surface, studio lighting.', '1:1');
  const img2 = await generateFashionImage(basePrompt + ' Worn on fashion model, full body editorial shot.', '4:5', modelRefs);
  const img3 = await generateFashionImage(basePrompt + ' Lifestyle cinematic scene, dark dramatic atmosphere.', '16:9');

  if (img1) productImageUrls.push(img1);
  if (img2) productImageUrls.push(img2);
  if (img3) productImageUrls.push(img3);

  return {
    name: data.name || `${collection.name} ${category.toUpperCase()}`,
    description: data.description || '',
    category: normalizeProductCategory(data.category || category),
    price: Number(data.price) || 89,
    compareAtPrice: Number(data.compareAtPrice) || 120,
    visualDirection: data.visualDirection || '',
    colorways: data.colorways || [],
    materials: data.materials || [],
    productImageUrls,
  };
}

// ─── Campaign Generator ───────────────────────────────────────────────────────

export async function generateFashionCampaign(
  brand: { brandName: string; aesthetic: string; colorPalette: string[] },
  collection: { name: string; theme: string },
  artist: ArtistContext,
  targetPlatforms: string[] = ['instagram', 'tiktok']
): Promise<CampaignResult> {
  const platformStr = targetPlatforms.join(', ');

  const prompt = `You are a fashion marketing director for brand "${brand.brandName}".

Create a campaign for collection "${collection.name}" targeting ${platformStr}.
Collection theme: ${collection.theme}
Artist: ${artist.artistName}

Respond ONLY with valid JSON:
{
  "title": "Campaign title",
  "concept": "2-sentence campaign concept/brief",
  "caption": "Ready-to-post caption for Instagram/TikTok (include line breaks, emojis, call-to-action)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "videoPrompt": "One paragraph prompt for generating a campaign video"
}`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.9,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  const data = JSON.parse(raw);

  // Generate 4 campaign images
  const campaignImages: string[] = [];
  const styleRefs = toImageRefs([artist.profileImageUrl, ...(artist.referenceImages || [])]);
  const campBase = `High-end fashion campaign image for "${brand.brandName}" — ${collection.name} collection. 
    ${data.concept || collection.theme}. ${brand.aesthetic}. 
    Magazine editorial quality. Colors: ${brand.colorPalette?.slice(0, 3).join(', ')}.`;

  const formats = [
    { suffix: 'Portrait editorial, dramatic lighting, single model.', ratio: '4:5' as const },
    { suffix: 'Square format, bold product close-up.', ratio: '1:1' as const },
    { suffix: 'Story format, vertical, cinematic mood.', ratio: '9:16' as const },
    { suffix: 'Wide establishing shot, multiple models, urban environment.', ratio: '16:9' as const },
  ];

  for (const fmt of formats) {
    const url = await generateFashionImage(campBase + ' ' + fmt.suffix, fmt.ratio, styleRefs);
    if (url) campaignImages.push(url);
  }

  return {
    title: data.title || `${collection.name} Campaign`,
    concept: data.concept || '',
    caption: data.caption || '',
    hashtags: data.hashtags || [],
    videoPrompt: data.videoPrompt || '',
    campaignImages,
  };
}

// ─── Batch Product Generator ──────────────────────────────────────────────────

/**
 * Generates N product concepts for a collection in a single LLM call (cost
 * efficient) and renders ONE editorial image per product using the artist's
 * image + gallery references. Used by the one-click "Generate Universe" flow.
 */
export async function generateProductLineup(
  brand: { brandName: string; aesthetic: string; colorPalette: string[] },
  collection: { name: string; theme: string },
  count: number,
  artist: ArtistContext
): Promise<ProductConceptResult[]> {
  const n = Math.max(1, Math.min(count, 14));

  const prompt = `You are a luxury fashion product designer for brand "${brand.brandName}".

Design a cohesive lineup of ${n} products for collection "${collection.name}".
Collection theme: ${collection.theme}
Brand aesthetic: ${brand.aesthetic}

Vary the categories across the lineup. Each "category" MUST be one of exactly:
top, bottom, outerwear, footwear, accessory, headwear, bodysuit, set.
Each product must feel premium and on-brand.

Respond ONLY with valid JSON in this exact structure:
{
  "products": [
    {
      "name": "PRODUCT NAME in UPPERCASE",
      "description": "2-3 sentence product description with storytelling",
      "category": "top | bottom | outerwear | footwear | accessory | headwear | bodysuit | set",
      "price": 89,
      "compareAtPrice": 120,
      "visualDirection": "One sentence describing how to photograph this product",
      "colorways": ["color1", "color2"],
      "materials": ["material1", "material2"]
    }
  ]
}
Return exactly ${n} products.`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.85,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const items: any[] = Array.isArray(parsed.products) ? parsed.products.slice(0, n) : [];

  const modelRefs = toImageRefs([artist.profileImageUrl, ...(artist.referenceImages || [])]);

  // Render one editorial image per product. Done in parallel to stay well within
  // the server's request timeout when generating a full 10+ product lineup.
  const results: ProductConceptResult[] = await Promise.all(
    items.map(async (data) => {
      const category = data.category || 'top';
      const basePrompt = `Professional fashion product photography. ${data.name} by ${brand.brandName}. 
        ${data.visualDirection || ''}. ${brand.aesthetic}. 
        Colors: ${brand.colorPalette?.slice(0, 2).join(', ')}.`;

      const img = await generateFashionImage(
        basePrompt + ' Worn on fashion model, full body editorial shot, dark dramatic atmosphere.',
        '4:5',
        modelRefs,
      );

      return {
        name: data.name || `${collection.name} ${category.toUpperCase()}`,
        description: data.description || '',
        category: normalizeProductCategory(data.category || category),
        price: Number(data.price) || 89,
        compareAtPrice: Number(data.compareAtPrice) || 120,
        visualDirection: data.visualDirection || '',
        colorways: data.colorways || [],
        materials: data.materials || [],
        productImageUrls: img ? [img] : [],
      };
    }),
  );

  return results;
}

// ─── Internal image helper ────────────────────────────────────────────────────

/**
 * Maps aspect ratio to the closest OpenAI DALL-E 3 / gpt-image-1 supported size.
 */
const OPENAI_SIZE_MAP: Record<string, '1024x1024' | '1792x1024' | '1024x1792'> = {
  '1:1':  '1024x1024',
  '16:9': '1792x1024',
  '4:5':  '1024x1024',
  '9:16': '1024x1792',
};

/**
 * Generates a fashion image via FAL (Flux) first.
 * On any failure or empty result, falls back to OpenAI DALL-E 3.
 * `referenceImageUrls` may be a single URL or a list; non-image URLs (e.g. .mp4
 * loop banners) are filtered out so the FAL edit endpoint never receives a video.
 */
async function generateFashionImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '4:5' | '9:16' = '1:1',
  referenceImageUrls?: string | string[]
): Promise<string | null> {
  const refs = toImageRefs(referenceImageUrls);

  // ── 1. Try FAL (Flux) ─────────────────────────────────────────────────────
  try {
    let result;
    if (refs.length > 0) {
      result = await editImageWithNanoBanana(refs, prompt, { aspectRatio });
    } else {
      result = await generateImageWithNanoBanana(prompt, { aspectRatio });
    }
    if (result?.success && result.imageUrl) return result.imageUrl;
  } catch (falErr: any) {
    console.warn('[fashion-ai] FAL failed, falling back to OpenAI:', falErr?.message || falErr);
  }

  // ── 2. OpenAI DALL-E 3 fallback ───────────────────────────────────────────
  try {
    const size = OPENAI_SIZE_MAP[aspectRatio] ?? '1024x1024';
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      size,
      quality: 'hd',
      n: 1,
    });
    return response.data?.[0]?.url ?? null;
  } catch (oaiErr: any) {
    console.error('[fashion-ai] OpenAI image fallback also failed:', oaiErr?.message || oaiErr);
    return null;
  }
}
