/**
 * Artist Enrichment — Profile Builder
 * Takes analyzed data and builds a professional artist profile:
 * - Generates professional biography via Gemini
 * - Generates profile image via FAL AI (based on real photo + genre style)
 * - Updates users table with enriched data
 */

import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateArtistBiography } from '../gemini-profile-service';
import { generateImageWithNanoBanana } from '../fal-service';
import type { AnalyzedProfile } from './profile-analyzer';
import type { CollectedArtistData } from './data-collector';

// ─── Types ──────────────────────────────────────────────────────

export interface BuildResult {
  success: boolean;
  artistId: number;
  updatedFields: string[];
  biographyGenerated: boolean;
  imageGenerated: boolean;
  errors: string[];
  tokensUsed: number;
  costEstimate: number;
}

// ─── Build Artist Image Prompt ──────────────────────────────────

function buildImagePrompt(profile: AnalyzedProfile, data: CollectedArtistData): string {
  const name = profile.verifiedName;
  const genre = profile.verifiedGenres[0] || 'musician';
  const genres = profile.verifiedGenres.join(', ') || 'music';

  // Base prompt for professional artist photo
  let prompt = `Professional music artist portrait photo. ${genre} artist "${name}". `;

  // Add style based on genre
  const genreLower = genre.toLowerCase();
  if (genreLower.includes('hip') || genreLower.includes('rap') || genreLower.includes('trap')) {
    prompt += 'Urban streetwear style, confident pose, dramatic lighting, modern city background. ';
  } else if (genreLower.includes('rock') || genreLower.includes('metal') || genreLower.includes('punk')) {
    prompt += 'Edgy style, leather jacket, moody lighting, concert stage atmosphere. ';
  } else if (genreLower.includes('pop') || genreLower.includes('dance') || genreLower.includes('electr')) {
    prompt += 'Vibrant colors, modern fashion, studio lighting, energetic pose. ';
  } else if (genreLower.includes('jazz') || genreLower.includes('soul') || genreLower.includes('blues')) {
    prompt += 'Sophisticated style, warm lighting, intimate club atmosphere, classic elegance. ';
  } else if (genreLower.includes('country') || genreLower.includes('folk') || genreLower.includes('acoustic')) {
    prompt += 'Natural outdoor setting, warm golden hour lighting, authentic casual style. ';
  } else if (genreLower.includes('latin') || genreLower.includes('reggaeton') || genreLower.includes('salsa')) {
    prompt += 'Colorful vibrant style, tropical atmosphere, energetic Latin music vibe. ';
  } else if (genreLower.includes('classical') || genreLower.includes('orchestra')) {
    prompt += 'Elegant formal attire, concert hall setting, sophisticated and refined. ';
  } else {
    prompt += 'Artistic style, professional photography, creative lighting, music studio atmosphere. ';
  }

  prompt += `Genres: ${genres}. High quality, 4K, professional photographer, sharp focus, bokeh background.`;

  return prompt;
}

// ─── Generate Professional Biography ────────────────────────────

async function generateBiography(
  profile: AnalyzedProfile,
  data: CollectedArtistData
): Promise<{ biography: string | null; tokensUsed: number }> {
  try {
    // Build artist info from collected data
    const artistInfo: any = {
      name: profile.verifiedName,
      genre: profile.verifiedGenres.join(', '),
      location: undefined as string | undefined,
    };

    // Add context from sources
    if (data.instagram?.biography) {
      artistInfo.experience = data.instagram.biography;
    }

    if (profile.biography) {
      artistInfo.achievements = profile.biography;
    }

    if (data.spotify?.topTracks && data.spotify.topTracks.length > 0) {
      artistInfo.songContext = data.spotify.topTracks.map(t => ({
        title: t.name,
        mood: undefined,
        lyrics: undefined,
      }));
    }

    // Add stats as achievements
    const achievements: string[] = [];
    if (data.spotify?.followers) achievements.push(`${data.spotify.followers.toLocaleString()} Spotify followers`);
    if (data.instagram?.followersCount) achievements.push(`${data.instagram.followersCount.toLocaleString()} Instagram followers`);
    if (data.youtube?.subscribers) achievements.push(`${data.youtube.subscribers.toLocaleString()} YouTube subscribers`);
    if (data.instagram?.isVerified) achievements.push('Instagram verified');
    if (achievements.length > 0) {
      artistInfo.achievements = (artistInfo.achievements || '') + ' ' + achievements.join('. ');
    }

    const result = await generateArtistBiography(artistInfo);
    if (result.success && result.biography) {
      return { biography: result.biography, tokensUsed: 0 }; // Gemini tokens separate
    }

    return { biography: null, tokensUsed: 0 };
  } catch (err) {
    console.error('[Enrichment] Biography generation error:', err);
    return { biography: null, tokensUsed: 0 };
  }
}

// ─── Generate Profile Image ────────────────────────────────────

async function generateProfileImage(
  profile: AnalyzedProfile,
  data: CollectedArtistData
): Promise<string | null> {
  try {
    const prompt = buildImagePrompt(profile, data);
    console.log(`[Enrichment] 🎨 Generating profile image for ${profile.verifiedName}`);

    const result = await generateImageWithNanoBanana(prompt, {
      aspectRatio: '1:1',
      numImages: 1,
      outputFormat: 'png',
    });

    if (result.success && result.url) {
      console.log(`[Enrichment] ✅ Profile image generated for ${profile.verifiedName}`);
      return result.url;
    }

    return null;
  } catch (err) {
    console.error('[Enrichment] Image generation error:', err);
    return null;
  }
}

// ─── Master Profile Builder ─────────────────────────────────────

export async function buildArtistProfile(
  artistId: number,
  profile: AnalyzedProfile,
  data: CollectedArtistData,
  options: {
    generateBio?: boolean;
    generateImage?: boolean;
    overwriteExisting?: boolean;
  } = {}
): Promise<BuildResult> {
  const { generateBio = true, generateImage = true, overwriteExisting = false } = options;

  const result: BuildResult = {
    success: false,
    artistId,
    updatedFields: [],
    biographyGenerated: false,
    imageGenerated: false,
    errors: [],
    tokensUsed: profile.tokensUsed || 0,
    costEstimate: 0,
  };

  try {
    // Read current artist data
    const [artist] = await db.select({
      id: users.id,
      artistName: users.artistName,
      biography: users.biography,
      profileImage: users.profileImage,
      genre: users.genre,
      genres: users.genres,
      instagramHandle: users.instagramHandle,
      youtubeChannel: users.youtubeChannel,
      spotifyUrl: users.spotifyUrl,
      tiktokUrl: users.tiktokUrl,
      facebookUrl: users.facebookUrl,
      website: users.website,
      coverImage: users.coverImage,
    }).from(users).where(eq(users.id, artistId)).limit(1);

    if (!artist) {
      result.errors.push('Artist not found');
      return result;
    }

    // Build update object
    const updateData: Record<string, any> = {};

    // Update artist name if we have a verified better name
    if (profile.verifiedName && profile.verifiedName !== artist.artistName && profile.dataConfidence >= 60) {
      // Only update if the existing name seems generic/placeholder
      const existingName = artist.artistName || '';
      if (existingName.length < 3 || existingName.startsWith('Artist ') || existingName.includes('@')) {
        updateData.artistName = profile.verifiedName;
        result.updatedFields.push('artistName');
      }
    }

    // Update genres
    if (profile.verifiedGenres.length > 0 && (!artist.genres || artist.genres.length === 0 || overwriteExisting)) {
      updateData.genres = profile.verifiedGenres;
      updateData.genre = profile.verifiedGenres[0];
      result.updatedFields.push('genres');
    }

    // Update social links (only fill empty ones, unless overwrite)
    if (profile.socialLinks.instagram && (!artist.instagramHandle || overwriteExisting)) {
      updateData.instagramHandle = profile.socialLinks.instagram;
      result.updatedFields.push('instagramHandle');
    }
    if (profile.socialLinks.youtube && (!artist.youtubeChannel || overwriteExisting)) {
      updateData.youtubeChannel = profile.socialLinks.youtube;
      result.updatedFields.push('youtubeChannel');
    }
    if (profile.socialLinks.spotify && (!artist.spotifyUrl || overwriteExisting)) {
      updateData.spotifyUrl = `https://open.spotify.com/artist/${profile.socialLinks.spotify}`;
      result.updatedFields.push('spotifyUrl');
    }
    if (profile.socialLinks.tiktok && (!artist.tiktokUrl || overwriteExisting)) {
      updateData.tiktokUrl = `https://tiktok.com/@${profile.socialLinks.tiktok}`;
      result.updatedFields.push('tiktokUrl');
    }
    if (profile.socialLinks.facebook && (!artist.facebookUrl || overwriteExisting)) {
      updateData.facebookUrl = profile.socialLinks.facebook;
      result.updatedFields.push('facebookUrl');
    }
    if (profile.socialLinks.website && (!artist.website || overwriteExisting)) {
      updateData.website = profile.socialLinks.website;
      result.updatedFields.push('website');
    }

    // Generate professional biography
    if (generateBio && (!artist.biography || artist.biography.length < 100 || overwriteExisting)) {
      const bioResult = await generateBiography(profile, data);
      if (bioResult.biography) {
        updateData.biography = bioResult.biography;
        result.biographyGenerated = true;
        result.updatedFields.push('biography');
        result.costEstimate += 0.001; // Gemini cost estimate
      }
    }

    // Generate profile image
    if (generateImage && (!artist.profileImage || artist.profileImage.includes('ui-avatars') || artist.profileImage.includes('picsum') || overwriteExisting)) {
      const imageUrl = await generateProfileImage(profile, data);
      if (imageUrl) {
        updateData.profileImage = imageUrl;
        result.imageGenerated = true;
        result.updatedFields.push('profileImage');
        result.costEstimate += 0.01; // FAL AI cost estimate
      }
    }

    // Apply updates
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db.update(users).set(updateData).where(eq(users.id, artistId));
      result.success = true;
      console.log(`[Enrichment] ✅ Updated ${result.updatedFields.length} fields for artist ${artistId}: ${result.updatedFields.join(', ')}`);
    } else {
      result.success = true; // Nothing to update is still success
      console.log(`[Enrichment] ℹ️ No updates needed for artist ${artistId}`);
    }

    // Add GPT analysis cost
    result.costEstimate += (result.tokensUsed / 1_000_000) * 0.15; // gpt-4o-mini pricing

    return result;
  } catch (err: any) {
    result.errors.push(err.message || 'Unknown error');
    console.error(`[Enrichment] Profile build error for artist ${artistId}:`, err);
    return result;
  }
}
