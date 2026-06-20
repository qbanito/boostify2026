/**
 * Artist Enrichment — Profile Analyzer
 * Uses GPT-4o to cross-reference data from multiple sources,
 * verify identity, select best photo, and generate structured profile
 */

import OpenAI from 'openai';
import type { CollectedArtistData } from './data-collector';
import { PRIMARY_MODEL } from '../../utils/ai-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Types ──────────────────────────────────────────────────────

export interface AnalyzedProfile {
  verifiedName: string;
  verifiedGenres: string[];
  biography: string; // raw bio from sources (pre-Gemini polish)
  socialLinks: {
    instagram?: string;
    youtube?: string;
    spotify?: string;
    tiktok?: string;
    website?: string;
    facebook?: string;
  };
  bestPhotoUrl?: string;
  photoUrls: string[];
  careerStage?: string;
  dataConfidence: number; // 0-100
  crossReferenceNotes: string;
  tokensUsed: number;
}

// ─── Classify Career Stage ──────────────────────────────────────

function classifyCareerStageLocal(data: CollectedArtistData): string {
  const followers = data.spotify?.followers || 0;
  const popularity = data.spotify?.popularity || 0;
  const igFollowers = data.instagram?.followersCount || 0;
  const ytSubs = data.youtube?.subscribers || 0;

  const totalReach = followers + igFollowers + ytSubs;

  if (popularity >= 80 || totalReach > 1_000_000) return 'Mainstream';
  if (popularity >= 60 || totalReach > 100_000) return 'Mid-Level';
  if (popularity >= 40 || totalReach > 10_000) return 'Developing';
  if (popularity >= 20 || totalReach > 1_000) return 'Emerging';
  return 'Long-Tail';
}

// ─── Calculate Data Completeness ────────────────────────────────

function calculateCompleteness(data: CollectedArtistData): number {
  let score = 0;

  // Spotify found = 25 points
  if (data.spotify) {
    score += 15;
    if (data.spotify.genres.length > 0) score += 5;
    if (data.spotify.imageUrl) score += 5;
  }

  // Instagram found = 25 points
  if (data.instagram) {
    score += 10;
    if (data.instagram.biography) score += 5;
    if (data.instagram.profilePicUrl) score += 5;
    if (data.instagram.topPosts && data.instagram.topPosts.length > 0) score += 5;
  }

  // YouTube found = 20 points
  if (data.youtube) {
    score += 10;
    if (data.youtube.subscribers > 0) score += 5;
    if (data.youtube.thumbnailUrl) score += 5;
  }

  // Google results = 15 points
  if (data.google && data.google.length > 0) {
    score += 10;
    if (data.google.length > 3) score += 5;
  }

  // Website found = 15 points
  if (data.website) {
    score += 10;
    if (data.website.socialLinks && Object.keys(data.website.socialLinks).length > 0) score += 5;
  }

  return Math.min(100, score);
}

// ─── Collect All Photo URLs ─────────────────────────────────────

function collectPhotoUrls(data: CollectedArtistData): string[] {
  const photos: string[] = [];

  if (data.spotify?.imageUrl) photos.push(data.spotify.imageUrl);
  if (data.instagram?.profilePicUrl) photos.push(data.instagram.profilePicUrl);
  if (data.youtube?.thumbnailUrl) photos.push(data.youtube.thumbnailUrl);

  // Instagram top post images
  if (data.instagram?.topPosts) {
    for (const post of data.instagram.topPosts) {
      if (post.displayUrl && photos.length < 10) {
        photos.push(post.displayUrl);
      }
    }
  }

  // Website photos
  if (data.website?.photos) {
    for (const photo of data.website.photos) {
      if (photos.length < 10) photos.push(photo);
    }
  }

  return photos;
}

// ─── GPT-4o Analysis ────────────────────────────────────────────

export async function analyzeArtistData(
  artistName: string,
  data: CollectedArtistData,
  existingBio?: string
): Promise<AnalyzedProfile> {
  const completeness = calculateCompleteness(data);
  const careerStage = classifyCareerStageLocal(data);
  const photoUrls = collectPhotoUrls(data);

  // Build context for GPT
  const contextParts: string[] = [];

  if (data.spotify) {
    contextParts.push(`SPOTIFY: Name="${data.spotify.name}", Genres=[${data.spotify.genres.join(', ')}], Followers=${data.spotify.followers.toLocaleString()}, Popularity=${data.spotify.popularity}/100`);
  }

  if (data.instagram) {
    contextParts.push(`INSTAGRAM: @${data.instagram.username}, Name="${data.instagram.fullName}", Bio="${data.instagram.biography}", Followers=${data.instagram.followersCount.toLocaleString()}, Posts=${data.instagram.postsCount}, Verified=${data.instagram.isVerified}, Engagement=${data.instagram.engagementRate || 'N/A'}%`);
  }

  if (data.youtube) {
    contextParts.push(`YOUTUBE: Channel="${data.youtube.channelName}", Subs=${data.youtube.subscribers.toLocaleString()}, Views=${data.youtube.totalViews.toLocaleString()}, Videos=${data.youtube.videoCount}`);
  }

  if (data.google && data.google.length > 0) {
    const googleSummary = data.google.slice(0, 5).map(r => `  - ${r.title}: ${r.description?.substring(0, 100) || ''}`).join('\n');
    contextParts.push(`GOOGLE RESULTS:\n${googleSummary}`);
  }

  if (data.website) {
    contextParts.push(`WEBSITE: ${data.website.url} — "${data.website.title}" — Bio: ${data.website.bio?.substring(0, 200) || 'N/A'}`);
  }

  if (existingBio) {
    contextParts.push(`EXISTING BIO: "${existingBio.substring(0, 300)}"`);
  }

  const systemPrompt = `You are an artist data analyst. Analyze the following data collected from multiple sources about a musician/artist. Your job is to:

1. VERIFY if all sources refer to the SAME person (cross-reference names, genres, bios)
2. Determine the TRUE artist name (stage name they use most)
3. Extract the correct genres from all sources
4. Select the best social media links found
5. Write a brief factual summary of who this artist is (3-4 sentences, in English)
6. Rate your confidence (0-100) that all data refers to the same person

Respond in JSON format ONLY:
{
  "verifiedName": "Artist Stage Name",
  "verifiedGenres": ["genre1", "genre2"],
  "biographySummary": "Brief factual summary of the artist...",
  "socialLinks": { "instagram": "handle", "youtube": "url", "spotify": "id", "tiktok": "handle", "website": "url", "facebook": "url" },
  "bestPhotoSource": "spotify|instagram|youtube",
  "crossReferenceNotes": "Notes about data consistency...",
  "dataConfidence": 85
}`;

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Artist Name: "${artistName}"\n\nCollected Data:\n${contextParts.join('\n\n')}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0.3,
    });

    const tokensUsed = response.usage?.total_tokens || 0;
    const content = response.choices[0]?.message?.content || '{}';
    const analysis = JSON.parse(content);

    // Select best photo URL based on GPT recommendation
    let bestPhotoUrl = photoUrls[0]; // default to first available
    if (analysis.bestPhotoSource === 'spotify' && data.spotify?.imageUrl) {
      bestPhotoUrl = data.spotify.imageUrl;
    } else if (analysis.bestPhotoSource === 'instagram' && data.instagram?.profilePicUrl) {
      bestPhotoUrl = data.instagram.profilePicUrl;
    } else if (analysis.bestPhotoSource === 'youtube' && data.youtube?.thumbnailUrl) {
      bestPhotoUrl = data.youtube.thumbnailUrl;
    }

    return {
      verifiedName: analysis.verifiedName || artistName,
      verifiedGenres: analysis.verifiedGenres || data.spotify?.genres || [],
      biography: analysis.biographySummary || '',
      socialLinks: analysis.socialLinks || {},
      bestPhotoUrl,
      photoUrls,
      careerStage,
      dataConfidence: Math.min(analysis.dataConfidence || completeness, 100),
      crossReferenceNotes: analysis.crossReferenceNotes || '',
      tokensUsed,
    };
  } catch (err) {
    console.error('[Enrichment] GPT analysis error:', err);

    // Fallback: build profile without GPT
    const socialLinks: AnalyzedProfile['socialLinks'] = {};
    if (data.instagram?.username) socialLinks.instagram = data.instagram.username;
    if (data.youtube?.channelId) socialLinks.youtube = `https://youtube.com/channel/${data.youtube.channelId}`;
    if (data.spotify?.id) socialLinks.spotify = data.spotify.id;
    if (data.website?.socialLinks) {
      if (data.website.socialLinks.tiktok) socialLinks.tiktok = data.website.socialLinks.tiktok;
      if (data.website.socialLinks.facebook) socialLinks.facebook = data.website.socialLinks.facebook;
    }
    if (data.website?.url) socialLinks.website = data.website.url;

    return {
      verifiedName: data.spotify?.name || data.instagram?.fullName || artistName,
      verifiedGenres: data.spotify?.genres || [],
      biography: data.instagram?.biography || data.website?.bio || '',
      socialLinks,
      bestPhotoUrl: photoUrls[0],
      photoUrls,
      careerStage,
      dataConfidence: completeness * 0.6, // lower confidence without GPT
      crossReferenceNotes: 'GPT analysis failed, using raw data fallback',
      tokensUsed: 0,
    };
  }
}
