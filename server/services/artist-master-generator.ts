/**
 * Artist Master JSON Generator
 * Generates the canonical BoostifyArtistMaster document that feeds all AI generation modules.
 * Called FIRST in the artist creation pipeline so all downstream agents share the same identity.
 */

import OpenAI from 'openai';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { withTextFallback } from '../utils/ai-fallback';
import type { BoostifyArtistMaster, ArtistGenerationParams } from '../types/artist-master-schema';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCHEMA_VERSION = '1.0';

/**
 * Builds the system prompt for master JSON generation
 */
function buildSystemPrompt(): string {
  return `You are the Boostify Artist Identity Architect — a senior creative director who designs complete, coherent artist identities for the music industry.
Your output is a single JSON document that becomes the canonical "brain" for every AI generation module: images, songs, merch, news, EPK, social media, and video.
Make the artist feel real, unique, and commercially viable. Each identity should be internally consistent — visual DNA must match musical DNA must match persona archetype.
Output ONLY valid JSON. No markdown, no explanations.`;
}

/**
 * Builds the user prompt for master JSON generation
 */
function buildUserPrompt(params: ArtistGenerationParams): string {
  const genreHint = params.genre ? `Primary genre: ${params.genre}` : 'Pick a commercially viable genre';
  const styleHint = params.style ? `Visual style: ${params.style}` : 'Derive visual style from genre and personality';
  const genderHint = params.gender ? `Artist gender: ${params.gender}` : 'Choose male or female';
  const moodHint = params.mood ? `Overall mood/vibe: ${params.mood}` : 'Derive mood from genre';
  const nameHint = params.artistName ? `Artist name (use exactly): ${params.artistName}` : 'Generate a compelling stage name';

  return `Generate a complete Boostify Master Artist JSON document.

Parameters:
- ${nameHint}
- ${genreHint}
- ${styleHint}
- ${genderHint}
- ${moodHint}

Return a JSON object with EXACTLY this structure (fill all fields with rich, detailed content):
{
  "schema_version": "1.0",
  "generated_at": "<ISO timestamp>",
  "canonical": {
    "artist_name": "<stage name>",
    "real_name": "<real name or null>",
    "gender": "<male|female>",
    "age_range": "<e.g. 24-28>",
    "nationality": "<country>",
    "city_of_origin": "<city, country>",
    "biography_short": "<1-sentence bio>",
    "biography_long": "<3-paragraph professional bio, 200-300 words>",
    "tagline": "<catchphrase, 5-10 words>"
  },
  "visual_dna": {
    "color_palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB"],
    "palette_name": "<descriptive palette name>",
    "aesthetic": "<one-word aesthetic like 'Cyberpunk', 'Noir', 'Tropical'>",
    "fashion_keywords": ["<3-5 fashion descriptors>"],
    "physical_description": "<150-word physical description for image generation, include: gender, age, height, build, skin tone, eye color, hair, facial features, signature accessories, stage outfit>",
    "image_prompt_base": "<Stable Diffusion/FAL AI positive prompt, 50-80 words, hyperrealistic, photorealistic, highly detailed>",
    "image_prompt_negative": "<negative prompt: things to avoid in image generation>"
  },
  "musical_dna": {
    "primary_genre": "<main genre>",
    "secondary_genres": ["<1-2 secondary genres>"],
    "bpm_range": { "min": 80, "max": 140 },
    "key_signatures": ["<2-3 preferred musical keys>"],
    "vocal_style": "<description of vocal style>",
    "production_style": "<production sound description>",
    "influences": ["<3-5 real artist influences>"],
    "mood_keywords": ["<4-6 mood descriptors for song generation>"],
    "instrument_set": ["<3-5 primary instruments in production>"],
    "lyric_themes": ["<4-6 lyric theme categories>"]
  },
  "persona": {
    "archetype_name": "<archetype like 'The Rebel', 'The Visionary', 'The Street Poet'>",
    "personality_traits": ["<5 traits>"],
    "communication_tone": "<how they speak: casual, poetic, cryptic, energetic, etc.>",
    "social_media_voice": "<their social media personality>",
    "interview_style": "<how they handle interviews>",
    "fan_relationship": "<how they engage with fans>"
  },
  "narrative": {
    "origin_story": "<2-3 sentences about their background and rise>",
    "breakthrough_moment": "<the defining moment that changed their career>",
    "current_chapter": "<what they're doing now, their current arc>",
    "artistic_mission": "<their stated artistic purpose>",
    "controversy_angles": ["<2 potential press controversy or intrigue topics>"],
    "press_narrative": "<the main story the press tells about this artist>"
  },
  "audience": {
    "primary_demographic": "<age range + description>",
    "secondary_demographic": "<secondary audience>",
    "psychographics": ["<3-4 psychographic descriptors>"],
    "platforms": ["<top 3 platforms their audience uses>"],
    "engagement_style": "<how fans interact with this artist>"
  },
  "business_model": {
    "revenue_pillars": ["<4-5 revenue streams>"],
    "merch_aesthetic": "<merch visual direction>",
    "brand_partnerships": ["<3 brand categories that fit this artist>"],
    "ticket_price_range": { "min": 25, "max": 200 },
    "streaming_focus": ["<top 2-3 streaming platforms>"]
  },
  "agent_context": {
    "news_agent_brief": "<1-2 sentences briefing the news generation agent on what type of news to create for this artist>",
    "epk_agent_brief": "<1-2 sentences briefing the EPK agent on tone and content focus>",
    "merch_agent_brief": "<1-2 sentences briefing merch agent on design aesthetic>",
    "social_agent_brief": "<1-2 sentences briefing social content agent on voice and content type>",
    "song_agent_brief": "<1-2 sentences briefing the song/lyrics agent on themes and sound>",
    "video_agent_brief": "<1-2 sentences briefing the video generation agent on visual style and mood>"
  },
  "system_rules": {
    "never_say": ["<3-5 things this artist would never say or do>"],
    "always_say": ["<3-5 things this artist always communicates>"],
    "brand_values": ["<3-4 core brand values>"],
    "content_restrictions": ["<any content restrictions for this artist's brand>"]
  },
  "module_views": [
    { "module": "profile", "title": "<page title>", "description": "<artist-specific description for profile page>" },
    { "module": "music", "title": "<page title>", "description": "<artist-specific description for music page>" },
    { "module": "merch", "title": "<page title>", "description": "<artist-specific description for merch store>" },
    { "module": "news", "title": "<page title>", "description": "<artist-specific description for news section>" },
    { "module": "epk", "title": "<page title>", "description": "<artist-specific description for EPK>" }
  ],
  "memory": {
    "key_events": [],
    "known_collaborators": [],
    "released_songs": []
  }
}`;
}

/**
 * Creates a minimal fallback master JSON when AI generation fails
 */
function createFallbackMasterJSON(params: ArtistGenerationParams): BoostifyArtistMaster {
  const name = params.artistName || 'Nova Artist';
  const genre = params.genre || 'Pop';
  const gender = (params.gender?.toLowerCase() === 'female' ? 'female' : 'male') as 'male' | 'female';
  const mood = params.mood || 'energetic';

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    canonical: {
      artist_name: name,
      real_name: null,
      gender,
      age_range: '22-28',
      nationality: 'American',
      city_of_origin: 'Los Angeles, USA',
      biography_short: `${name} is an emerging ${genre} artist redefining the sound of a generation.`,
      biography_long: `${name} emerged from the underground ${genre} scene with a sound that defies categorization. Blending raw emotion with polished production, ${name} has quickly become one of the most talked-about new artists in the industry.\n\nRaised between two cultures, ${name}'s music reflects a complex inner world translated into sonic landscapes that resonate globally. Their debut work drew comparisons to genre legends while maintaining a freshness that is entirely their own.\n\nCurrently based in Los Angeles, ${name} is working on their debut album — a collection of songs that document the journey from unknown to undeniable.`,
      tagline: `The future of ${genre} is here`,
    },
    visual_dna: {
      color_palette: ['#1a1a2e', '#e94560', '#f5f5f5'],
      palette_name: 'Neon Midnight',
      aesthetic: 'Futuristic',
      fashion_keywords: ['urban', 'sleek', 'monochrome', 'statement accessories'],
      physical_description: `${gender === 'female' ? 'Female' : 'Male'} artist, early-to-mid 20s, athletic build with confident stage presence. Striking features with expressive eyes and distinctive style. Known for bold fashion choices that blend streetwear with high fashion elements.`,
      image_prompt_base: `${gender} music artist, ${genre} aesthetic, professional photoshoot, studio lighting, high fashion editorial, hyperrealistic, 8k, sharp focus`,
      image_prompt_negative: 'blurry, low quality, distorted, deformed, ugly, amateur',
    },
    musical_dna: {
      primary_genre: genre,
      secondary_genres: [],
      bpm_range: { min: 90, max: 130 },
      key_signatures: ['C minor', 'A minor'],
      vocal_style: 'Powerful and emotive',
      production_style: 'Modern, clean, commercially polished',
      influences: ['The Weeknd', 'Billie Eilish', 'Drake'],
      mood_keywords: [mood, 'intense', 'authentic', 'raw'],
      instrument_set: ['synthesizer', 'drum machine', 'bass', 'guitar'],
      lyric_themes: ['ambition', 'identity', 'love', 'struggle'],
    },
    persona: {
      archetype_name: 'The Visionary',
      personality_traits: ['authentic', 'driven', 'introspective', 'charismatic', 'rebellious'],
      communication_tone: 'Direct and poetic',
      social_media_voice: 'Cryptic, visual, high-impact',
      interview_style: 'Thoughtful, guarded about personal life',
      fan_relationship: 'Deep loyalty, treats fans as insiders',
    },
    narrative: {
      origin_story: `${name} started making music in their bedroom at age 16, turning personal struggles into universal anthems.`,
      breakthrough_moment: 'A viral moment that turned overnight streams into a global fanbase.',
      current_chapter: `Recording debut album and performing headline shows across North America.`,
      artistic_mission: 'To make music that says what people feel but cannot express.',
      controversy_angles: ['Mysterious persona fuels constant speculation', 'Genre-bending sound divides critics'],
      press_narrative: `The enigmatic ${name} is one of music's most compelling new voices.`,
    },
    audience: {
      primary_demographic: '18-28 year olds who stream obsessively',
      secondary_demographic: '29-35 music enthusiasts',
      psychographics: ['digital natives', 'playlist curators', 'concert-goers', 'fashion-forward'],
      platforms: ['Spotify', 'Instagram', 'TikTok'],
      engagement_style: 'Loyal community building around exclusivity and authenticity',
    },
    business_model: {
      revenue_pillars: ['streaming royalties', 'touring', 'merchandise', 'sync licensing', 'brand deals'],
      merch_aesthetic: 'Minimalist streetwear with artist motifs',
      brand_partnerships: ['fashion brands', 'tech companies', 'lifestyle products'],
      ticket_price_range: { min: 35, max: 150 },
      streaming_focus: ['Spotify', 'Apple Music', 'YouTube Music'],
    },
    agent_context: {
      news_agent_brief: `Generate press-worthy news about ${name}'s music releases, collaborations, and cultural impact in the ${genre} scene.`,
      epk_agent_brief: `Create professional press materials that position ${name} as an emerging force in ${genre} with a compelling origin story.`,
      merch_agent_brief: `Design merch that reflects ${name}'s visual DNA — minimal, bold, with the artist's color palette and signature aesthetic.`,
      social_agent_brief: `Create social content in ${name}'s voice — authentic, slightly cryptic, visually striking, connecting with young music fans.`,
      song_agent_brief: `Generate ${genre} songs that reflect ${name}'s themes of ${['ambition', 'identity', 'love'].join(', ')} with a modern, polished production style.`,
      video_agent_brief: `Create atmospheric visual content matching ${name}'s Neon Midnight aesthetic — cinematic, moody, striking.`,
    },
    system_rules: {
      never_say: ['corny', 'sell-out', 'mainstream', 'just for the money'],
      always_say: ['authentic', 'real', 'artistic vision', 'community'],
      brand_values: ['authenticity', 'artistry', 'innovation', 'connection'],
      content_restrictions: ['no explicit political statements', 'no negativity toward other artists'],
    },
    module_views: [
      { module: 'profile', title: `${name} — Official Artist Page`, description: `Discover the world of ${name} — ${genre} artist redefining the sound of a generation.` },
      { module: 'music', title: `${name} — Discography`, description: `Stream and collect ${name}'s music — from debut singles to full albums.` },
      { module: 'merch', title: `${name} — Official Store`, description: `Wear the aesthetic. Shop ${name}'s official merchandise collection.` },
      { module: 'news', title: `${name} — News & Press`, description: `Latest updates, press coverage, and announcements from ${name}.` },
      { module: 'epk', title: `${name} — Press Kit`, description: `Official electronic press kit for booking, press, and media inquiries.` },
    ],
    memory: {
      key_events: [],
      known_collaborators: [],
      released_songs: [],
    },
  };
}

/**
 * Generates the Master Artist JSON document.
 * This is the FIRST step in the artist creation pipeline.
 * All subsequent AI agents use this as their source of truth.
 */
export async function generateArtistMasterJSON(params: ArtistGenerationParams = {}): Promise<BoostifyArtistMaster> {
  console.log(`🧬 [MasterJSON] Generating master identity for: ${params.artistName || 'new artist'} (${params.genre || 'auto genre'})`);

  const userPrompt = buildUserPrompt(params);
  const systemPrompt = buildSystemPrompt();

  const rawContent = await withTextFallback(
    async () => {
      const response = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
        temperature: 0.85,
      });
      return response.choices[0]?.message?.content || null;
    },
    {
      label: 'generateArtistMasterJSON',
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 3000,
      temperature: 0.85,
      returnNullOnFailure: true,
    }
  );

  if (rawContent) {
    try {
      const parsed = JSON.parse(rawContent) as BoostifyArtistMaster;

      if (!parsed.canonical?.artist_name) {
        throw new Error('Generated JSON missing canonical.artist_name');
      }

      parsed.schema_version = SCHEMA_VERSION;
      parsed.generated_at = new Date().toISOString();

      if (!parsed.memory) {
        parsed.memory = { key_events: [], known_collaborators: [], released_songs: [] };
      }

      console.log(`✅ [MasterJSON] Generated identity: "${parsed.canonical.artist_name}" | ${parsed.musical_dna?.primary_genre} | ${parsed.persona?.archetype_name}`);
      return parsed;
    } catch (parseError) {
      console.error('⚠️ [MasterJSON] Failed to parse AI response, using structured fallback:', parseError instanceof Error ? parseError.message : parseError);
    }
  }

  console.warn('⚠️ [MasterJSON] All AI providers failed, using structured fallback');
  return createFallbackMasterJSON(params);
}

/**
 * Derives the legacy ArtistGenerationParams from a master JSON.
 * Used when passing master JSON context back to generateRandomArtist.
 */
export function deriveParamsFromMaster(master: BoostifyArtistMaster): ArtistGenerationParams {
  return {
    artistName: master.canonical.artist_name,
    genre: master.musical_dna?.primary_genre,
    gender: master.canonical.gender,
    mood: master.musical_dna?.mood_keywords?.[0],
    style: master.visual_dna?.aesthetic,
  };
}
