/**
 * Identity Engine — generates a complete artist identity package via LLM (OpenAI).
 * Falls back to deterministic templates if OPENAI_API_KEY is missing.
 */
import { pool } from './db';
import { recomputeReadiness } from './readiness';
import { PRIMARY_MODEL } from '../../utils/ai-config';

export interface IdentityInput {
  stage_name: string;
  genre_primary?: string;
  country?: string;
  city?: string;
  visual_style?: string;
  audience_type?: string;
  artist_type?: string;
  primary_language?: string;
}

export interface IdentityOutput {
  long_bio: string;
  short_bio: string;
  slogan: string;
  tagline: string;
  aesthetic_keywords: string[];
  target_markets: string[];
  brand_voice: string;
  ai_disclosure_flags: { is_ai_generated: boolean; requires_disclosure: boolean };
}

const PROMPT = (input: IdentityInput) => `You are the Boostify Artist Identity Engine.
Given this artist seed, produce a complete brand identity in strict JSON (no markdown).

Seed:
${JSON.stringify(input, null, 2)}

Return JSON with keys:
- long_bio (2-3 sentences, cinematic tone)
- short_bio (1 sentence, under 120 chars)
- slogan (under 40 chars)
- tagline (under 30 chars)
- aesthetic_keywords (array of 5 words)
- target_markets (array of 3 ISO country-like codes or region names)
- brand_voice (2-4 words)
- ai_disclosure_flags: { is_ai_generated: boolean, requires_disclosure: boolean }

Audience type: ${input.audience_type || 'Gen Z → Millennial'}.
Genre: ${input.genre_primary || 'Pop'}.
Artist type: ${input.artist_type || 'Virtual'} (if Virtual → is_ai_generated=true).`;

function fallbackIdentity(input: IdentityInput): IdentityOutput {
  const isAI = (input.artist_type || '').toLowerCase().includes('virtual');
  const g = input.genre_primary || 'Pop';
  return {
    long_bio: `${input.stage_name} es un proyecto ${g.toLowerCase()} nacido en el ecosistema Boostify. Fusiona producción cinematográfica con narrativas visuales de alto impacto para una audiencia global.`,
    short_bio: `${g} artist exploring emotion, beauty, and sound.`,
    slogan: 'Light from the dark.',
    tagline: `${g}. Cinematic.`,
    aesthetic_keywords: ['cinematic', 'futuristic', 'bold', 'mystical', 'sleek'],
    target_markets: ['US', 'LATAM', 'Europe'],
    brand_voice: `${g.toLowerCase()} cinematic`,
    ai_disclosure_flags: { is_ai_generated: isAI, requires_disclosure: isAI },
  };
}

export async function generateIdentity(input: IdentityInput): Promise<IdentityOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackIdentity(input);

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You return only valid JSON, no prose.' },
          { role: 'user', content: PROMPT(input) },
        ],
        temperature: 0.8,
      }),
    });
    if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
    const data: any = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return { ...fallbackIdentity(input), ...parsed };
  } catch (err: any) {
    console.warn('[AIAPS identity] LLM failed, using fallback:', err.message);
    return fallbackIdentity(input);
  }
}

/**
 * Apply the generated identity to the artist row.
 */
export async function applyIdentity(artistId: string, identity: IdentityOutput): Promise<void> {
  await pool.query(
    `UPDATE aiaps_artists SET
       long_bio = $2,
       short_bio = $3,
       slogan = $4,
       tagline = $5,
       aesthetic_keywords = $6,
       target_markets = $7,
       brand_voice = $8,
       ai_disclosure_flags = $9,
       updated_at = NOW()
     WHERE id = $1`,
    [
      artistId,
      identity.long_bio,
      identity.short_bio,
      identity.slogan,
      identity.tagline,
      JSON.stringify(identity.aesthetic_keywords),
      JSON.stringify(identity.target_markets),
      identity.brand_voice,
      JSON.stringify(identity.ai_disclosure_flags),
    ],
  );
  await recomputeReadiness(artistId);
}
