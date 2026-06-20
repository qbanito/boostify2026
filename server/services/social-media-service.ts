/**
 * Social Media Content Generator Service
 * Generates viral content for Facebook, Instagram and TikTok using OpenAI
 * Migrated from Gemini to OpenAI for better efficiency
 */
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildEnrichedSystemPrompt } from '../utils/ai-skills-injector';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

export interface SocialMediaPost {
  platform: "facebook" | "instagram" | "tiktok";
  caption: string;
  hashtags: string[];
  cta: string;
  viralScore?: number;
}

export interface SocialMediaGeneratorResult {
  success: boolean;
  posts?: SocialMediaPost[];
  error?: string;
}

const VIRAL_THEMES = [
  "New single dropping soon 🎵",
  "Concert tour coming up 🎤",
  "Exclusive collaboration revealed",
  "Special Meet & Greet for fans",
  "Listen to me on all platforms",
  "Limited edition merch available",
  "Exclusive behind the scenes",
  "Bending music genres",
  "My musical journey so far",
  "Hit composition in progress"
];

/**
 * 14 distinct caption "voices". On every generation we randomly pick a different
 * style per platform so the posts stay fresh and never repeat the same tone.
 */
const CAPTION_STYLES: { id: string; instruction: string }[] = [
  { id: 'poetic',        instruction: 'Poetic & artistic — lyrical, evocative imagery, like a verse from a song.' },
  { id: 'hype',          instruction: 'Bold hype energy — ALL-CAPS bursts, exclamation, pure adrenaline and confidence.' },
  { id: 'storytelling',  instruction: 'Mini-story — open with a personal scene/moment that pulls the reader in.' },
  { id: 'question',      instruction: 'Question hook — open with a provocative question that demands an answer in comments.' },
  { id: 'minimalist',    instruction: 'Minimalist — one or two punchy short lines, lots of white space, mysterious.' },
  { id: 'bts',           instruction: 'Behind-the-scenes — candid, intimate, "let me show you" insider vibe.' },
  { id: 'fomo',          instruction: 'Urgency / FOMO — limited time, "don\'t miss this", countdown energy.' },
  { id: 'emotional',     instruction: 'Emotional & vulnerable — heartfelt, raw, connect on feelings.' },
  { id: 'nostalgic',     instruction: 'Nostalgic — throwback mood, memories, warm retro feeling.' },
  { id: 'motivational',  instruction: 'Motivational — empowering, anthem-like, speak directly to the dreamer.' },
  { id: 'playful',       instruction: 'Playful & witty — humor, cheeky one-liners, meme-aware tone.' },
  { id: 'list',          instruction: 'List / carousel style — quick punchy bullet-like fragments separated by line breaks.' },
  { id: 'confessional',  instruction: 'Confessional — first-person secret reveal, "I never told anyone this".' },
  { id: 'cinematic',     instruction: 'Cinematic — describe the scene like a movie trailer, dramatic and visual.' },
];

/** Picks `n` distinct random caption styles. */
function pickCaptionStyles(n: number): { id: string; instruction: string }[] {
  const pool = [...CAPTION_STYLES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

/**
 * Genera contenido viral para las 3 plataformas y guarda en BD
 */
export async function generateSocialMediaContent(
  artistName: string,
  biography: string,
  profileUrl: string,
  userId?: number
): Promise<SocialMediaGeneratorResult> {
  try {
    const randomTheme = VIRAL_THEMES[Math.floor(Math.random() * VIRAL_THEMES.length)];
    // Pick a DIFFERENT random caption voice per platform every time → fresh posts.
    const [styleIG, styleTT, styleFB] = pickCaptionStyles(3);

    // Build skill-enriched system prompt for the social-hub module
    const systemPrompt = await buildEnrichedSystemPrompt(
      'social-hub',
      'You are an expert in music marketing and viral content creation for independent artists.',
      userId,
    );

    const userPrompt = `Based on the following artist information, generate viral content optimized for 3 different platforms.

ARTIST: ${artistName}
BIOGRAPHY: ${biography}
PROFILE URL: ${profileUrl}
THEME: ${randomTheme}

Generate EXACTLY 3 posts (one for each platform). For EACH post respond with this exact JSON format (no markdown):

For INSTAGRAM (1080x1350):
{
  "platform": "instagram",
  "caption": "[100-300 characters, strategic emojis, inspirational/artistic]",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "cta": "View ${artistName}'s profile"
}

For FACEBOOK (1200x628):
{
  "platform": "facebook",
  "caption": "[200-500 characters, personal, community-oriented, invites conversation]",
  "hashtags": ["tag1", "tag2"],
  "cta": "Visit my profile: ${profileUrl}"
}

For TIKTOK (1080x1920):
{
  "platform": "tiktok",
  "caption": "[80-150 characters, energetic, trend-friendly, viral hook]",
  "hashtags": ["tag1", "tag2", "tag3"],
  "cta": "Link in bio: ${profileUrl}"
}

CAPTION STYLE (use a DIFFERENT voice for each post so they feel unique):
- Instagram → ${styleIG.instruction}
- TikTok → ${styleTT.instruction}
- Facebook → ${styleFB.instruction}

REQUIREMENTS:
- Each post MUST be different in tone and message
- Include relevant emojis (Instagram/TikTok especially)
- Hashtags must be artist-specific and viral
- The CTA must include the profile URL
- Language in English
- Motivating and professional posts

Generate the 3 posts now in valid JSON format:`;

    console.log('🎬 Generating social media content with OpenAI GPT-4o-mini...');

    const response = await Promise.race([
      openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.95,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      )
    ]);

    const responseText = response.choices[0]?.message?.content?.trim() || "";
    
    if (!responseText) {
      throw new Error('No content generated');
    }

    // Parsear respuesta JSON
    const jsonMatches = responseText.match(/\{[\s\S]*?\}/g) || [];
    
    if (jsonMatches.length < 3) {
      throw new Error(`Expected 3 posts, got ${jsonMatches.length}`);
    }

    const posts: SocialMediaPost[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const post = JSON.parse(jsonMatches[i]);
        posts.push({
          platform: post.platform,
          caption: post.caption,
          hashtags: post.hashtags || [],
          cta: post.cta,
          viralScore: Math.floor(Math.random() * 40) + 70 // 70-110 score
        });
      } catch (e) {
        console.error(`Failed to parse post ${i}:`, e);
      }
    }

    if (posts.length === 0) {
      throw new Error('Failed to parse any posts');
    }

    console.log('✅ Social media content generated:', posts.length, 'posts');

    return {
      success: true,
      posts
    };

  } catch (error: any) {
    console.error('❌ Error generating social media content:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to generate social media content'
    };
  }
}

/**
 * Genera contenido viral usando el masterJson del artista para máxima personalización
 */
export async function generateSocialMediaFromMasterJson(
  artistName: string,
  biography: string,
  profileUrl: string,
  masterJson: Record<string, any> | null | undefined,
  userId?: number
): Promise<SocialMediaGeneratorResult> {
  // Extract context from masterJson
  const genre = masterJson?.musical_dna?.genre || masterJson?.canonical?.genre || '';
  const aesthetic = masterJson?.visual_dna?.aesthetic || '';
  const currentChapter = masterJson?.narrative?.currentChapter || '';
  const lyricThemes = Array.isArray(masterJson?.musical_dna?.lyricThemes)
    ? masterJson.musical_dna.lyricThemes.slice(0, 3).join(', ')
    : '';
  const artistGoals = Array.isArray(masterJson?.agent_context?.artistGoals)
    ? masterJson.agent_context.artistGoals[0]
    : '';
  const uniqueVoice = masterJson?.persona?.uniqueVoice || '';
  const audienceAge = masterJson?.audience?.demographics?.ageRange || '';

  // If no masterJson, fallback to standard generation
  if (!masterJson || !genre) {
    return generateSocialMediaContent(artistName, biography, profileUrl, userId);
  }

  try {
    // Pick a DIFFERENT random caption voice per platform every time → fresh posts.
    const [styleIG, styleTT, styleFB] = pickCaptionStyles(3);
    const randomTheme = VIRAL_THEMES[Math.floor(Math.random() * VIRAL_THEMES.length)];

    const prompt = `You are a music marketing expert specializing in viral social media content. Generate 3 highly personalized posts for this artist.

ARTIST PROFILE:
- Name: ${artistName}
- Genre: ${genre}
- Visual Aesthetic: ${aesthetic}
- Current Chapter: ${currentChapter}
- Lyric Themes: ${lyricThemes}
- Unique Voice: ${uniqueVoice}
- Target Audience Age: ${audienceAge}
- Goals: ${artistGoals}
- Bio: ${biography}
- Profile: ${profileUrl}
- Angle for this batch: ${randomTheme}

Generate exactly 3 JSON objects (no markdown, no extra text):

{"platform":"instagram","caption":"[90-250 chars, emojis, poetic/artistic matching their aesthetic]","hashtags":["tag1","tag2","tag3","tag4","tag5"],"cta":"🎵 Listen now → ${profileUrl}","viralScore":${Math.floor(Math.random()*20)+80}}

{"platform":"tiktok","caption":"[60-120 chars, hook first, trend-friendly, their genre energy]","hashtags":["tag1","tag2","tag3","fyp","foryou"],"cta":"Link in bio 👆","viralScore":${Math.floor(Math.random()*20)+80}}

{"platform":"facebook","caption":"[150-400 chars, personal story, connect with fans, their lyric themes]","hashtags":["tag1","tag2"],"cta":"Discover more: ${profileUrl}","viralScore":${Math.floor(Math.random()*20)+75}}

CAPTION STYLE (use a DIFFERENT voice for each post so they never feel repetitive):
- Instagram → ${styleIG.instruction}
- TikTok → ${styleTT.instruction}
- Facebook → ${styleFB.instruction}

Rules: Each post must reflect the artist's unique aesthetic and genre. Use their lyric themes naturally. English language. Output ONLY the 3 JSON objects.`;

    const response = await Promise.race([
      openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.95,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 30s')), 30000)
      )
    ]);

    const text = response.choices[0]?.message?.content?.trim() || '';
    const jsonMatches = text.match(/\{[\s\S]*?\}/g) || [];

    const posts: SocialMediaPost[] = [];
    for (const match of jsonMatches.slice(0, 3)) {
      try {
        const parsed = JSON.parse(match);
        if (parsed.platform && parsed.caption) {
          posts.push({
            platform: parsed.platform,
            caption: parsed.caption,
            hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
            cta: parsed.cta || profileUrl,
            viralScore: parsed.viralScore || Math.floor(Math.random() * 20) + 78,
          });
        }
      } catch (e) { /* skip malformed */ }
    }

    if (posts.length === 0) throw new Error('Failed to parse posts from masterJson generation');

    console.log(`✅ MasterJson social posts generated for ${artistName}: ${posts.length} posts`);
    return { success: true, posts };

  } catch (error: any) {
    console.error('❌ MasterJson social generation error:', error.message);
    // Fallback
    return generateSocialMediaContent(artistName, biography, profileUrl, userId);
  }
}
