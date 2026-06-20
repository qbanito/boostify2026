/**
 * AI Proposal Generator
 * Uses OpenAI to generate personalized sponsor proposal copy based on:
 * - Artist data (genre, bio, stats)
 * - Brand data (industry, description, follower count)
 * - Deal type (sponsorship, collaboration, etc.)
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { buildSkillsOnlyPrompt } from '../utils/ai-skills-injector';

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '' });

interface AIProposalInput {
  artistName: string;
  artistGenre: string;
  artistBio: string;
  instagramFollowers?: number;
  spotifyListeners?: number;
  brandName: string;
  brandIndustry?: string;
  brandDescription?: string;
  dealType: string;
  budgetMin?: number;
  budgetMax?: number;
}

interface AIProposalOutput {
  customMessage: string;
  subjectLine: string;
  whatsIncluded: string[];
}

/**
 * Generate personalized proposal copy via OpenAI
 * Falls back to generic copy if OpenAI is unavailable
 */
export async function generateAIProposal(input: AIProposalInput): Promise<AIProposalOutput> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ OpenAI API key not set — using generic proposal copy');
    return getGenericProposal(input);
  }

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.7,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: buildSkillsOnlyPrompt(
            'sponsors',
            `You are a professional brand partnerships manager for Boostify Music, a platform connecting music artists with brand sponsors. Write concise, compelling proposal copy. Output JSON only.`,
          ),
        },
        {
          role: 'user',
          content: `Generate a personalized sponsor proposal for:

ARTIST: ${input.artistName} (${input.artistGenre})
Bio: ${(input.artistBio || '').slice(0, 300)}
Instagram: ${input.instagramFollowers ? `${(input.instagramFollowers / 1000).toFixed(1)}K followers` : 'N/A'}
Spotify: ${input.spotifyListeners ? `${(input.spotifyListeners / 1000).toFixed(1)}K monthly listeners` : 'N/A'}

BRAND: ${input.brandName}
Industry: ${input.brandIndustry || 'General'}
About: ${(input.brandDescription || '').slice(0, 300)}

DEAL TYPE: ${input.dealType}
BUDGET: ${input.budgetMin && input.budgetMax ? `$${input.budgetMin} - $${input.budgetMax}` : 'Flexible'}

Return JSON with exactly these fields:
{
  "customMessage": "2-3 sentences explaining why this artist is perfect for this specific brand. Reference the brand's industry and the artist's audience. Be direct and professional, not overly salesy.",
  "subjectLine": "Short email subject line (max 60 chars). Make it specific to the brand.",
  "whatsIncluded": ["Array of 4-6 deliverables tailored to the brand's industry and deal type"]
}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        customMessage: parsed.customMessage || '',
        subjectLine: parsed.subjectLine || `Partnership Opportunity — ${input.artistName} x ${input.brandName}`,
        whatsIncluded: Array.isArray(parsed.whatsIncluded) ? parsed.whatsIncluded : [],
      };
    }

    return getGenericProposal(input);
  } catch (error) {
    console.error('❌ AI proposal generation failed:', error);
    return getGenericProposal(input);
  }
}

/** Fallback generic proposal when AI is unavailable */
function getGenericProposal(input: AIProposalInput): AIProposalOutput {
  const industryHooks: Record<string, string> = {
    fashion: `${input.artistName}'s unique style and visual aesthetic perfectly aligns with ${input.brandName}'s brand identity, making this a natural fit for fashion-forward content.`,
    tech: `${input.artistName}'s innovative approach to music and digital presence resonates with ${input.brandName}'s tech-savvy audience.`,
    beverage: `${input.artistName}'s high-energy performances and lifestyle content create the perfect setting for ${input.brandName} product integration.`,
    food: `${input.artistName}'s authentic connection with fans creates organic opportunities for ${input.brandName} to reach a passionate community.`,
    sports: `${input.artistName}'s audience overlaps significantly with sports enthusiasts, making this an ideal activation for ${input.brandName}.`,
    gaming: `${input.artistName}'s digital-native fanbase and gaming community ties make this partnership a perfect match for ${input.brandName}.`,
    cosmetics: `${input.artistName}'s visual brand and beauty-conscious audience create a seamless integration opportunity for ${input.brandName}.`,
  };

  return {
    customMessage: industryHooks[input.brandIndustry || ''] ||
      `${input.artistName}'s growing audience and authentic brand make this a compelling partnership opportunity for ${input.brandName}.`,
    subjectLine: `Partnership Opportunity — ${input.artistName} x ${input.brandName}`,
    whatsIncluded: [
      'Social media mentions and stories',
      'Brand integration in music content',
      'Detailed campaign analytics report',
      'Professional photo/video assets',
      'Live event brand presence',
      'Monthly performance reporting',
    ],
  };
}
