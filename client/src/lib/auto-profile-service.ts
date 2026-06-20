import { logger } from "./logger";
/**
 * Auto-Profile Service - Manages automatic artist profile creation and updates
 * 
 * This service integrates with the video generation workflow to automatically:
 * - Create artist profiles when needed
 * - Save songs to Firestore when audio is uploaded
 * - Save videos to Firestore when generation completes
 * - Update profile images with generated content
 */

interface EnsureProfileResult {
  success: boolean;
  profile?: {
    userId: number;
    slug: string;
    artistName: string;
    isNew: boolean;
  };
  message?: string;
}

interface SaveSongResult {
  success: boolean;
  song?: any;
  profileSlug?: string;
  message?: string;
}

interface SaveVideoResult {
  success: boolean;
  video?: any;
  profileSlug?: string;
  message?: string;
}

interface UpdateImagesResult {
  success: boolean;
  updated?: boolean;
  message?: string;
}

/**
 * Ensures the user has an artist profile (creates automatically if needed)
 */
export async function ensureArtistProfile(genre?: string): Promise<EnsureProfileResult> {
  try {
    const response = await fetch('/api/profile/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Important for Replit Auth
      body: JSON.stringify({ genre })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error ensuring profile');
    }

    return data;
  } catch (error: any) {
    logger.error('❌ Error ensuring artist profile:', error);
    return {
      success: false,
      message: error.message || 'Error creando perfil'
    };
  }
}

/**
 * Saves a song to the user's profile (Firestore)
 */
export async function saveSongToProfile(options: {
  title: string;
  audioUrl: string;
  lyrics?: string;
  genre?: string;
  duration?: number;
  fileName?: string;
  format?: string;
}): Promise<SaveSongResult> {
  try {
    const response = await fetch('/api/profile/save-song', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error saving song');
    }

    return data;
  } catch (error: any) {
    logger.error('❌ Error saving song:', error);
    return {
      success: false,
      message: error.message || 'Error guardando canción'
    };
  }
}

/**
 * Saves a video to the user's profile (Firestore)
 */
export async function saveVideoToProfile(options: {
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  songId?: string;
  description?: string;
  duration?: string;
}): Promise<SaveVideoResult> {
  try {
    const response = await fetch('/api/profile/save-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error saving video');
    }

    return data;
  } catch (error: any) {
    logger.error('❌ Error saving video:', error);
    return {
      success: false,
      message: error.message || 'Error guardando video'
    };
  }
}

/**
 * Updates profile images (photo and banner) automatically
 * Only updates if the user doesn't have images yet
 */
export async function updateProfileImages(options: {
  profileImageUrl?: string;
  coverImageUrl?: string;
  onlyIfEmpty?: boolean;
}): Promise<UpdateImagesResult> {
  try {
    const response = await fetch('/api/profile/update-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...options,
        onlyIfEmpty: options.onlyIfEmpty !== false // Default to true
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error updating images');
    }

    return data;
  } catch (error: any) {
    logger.error('❌ Error updating profile images:', error);
    return {
      success: false,
      message: error.message || 'Error actualizando imágenes'
    };
  }
}

/**
 * Complete workflow: Ensure profile, save song, update images
 * This is a convenience function that handles the full auto-profile workflow
 */
export async function autoProfileWorkflow(options: {
  songTitle: string;
  audioUrl: string;
  lyrics?: string;
  genre?: string;
  duration?: number;
  profileImageUrl?: string;
  coverImageUrl?: string;
}): Promise<{
  profile?: any;
  song?: any;
  imagesUpdated?: boolean;
  errors?: string[];
}> {
  const errors: string[] = [];
  
  // Step 1: Ensure profile exists
  const profileResult = await ensureArtistProfile(options.genre);
  if (!profileResult.success) {
    errors.push(`Profile: ${profileResult.message}`);
  }
  
  // Step 2: Save song
  const songResult = await saveSongToProfile({
    title: options.songTitle,
    audioUrl: options.audioUrl,
    lyrics: options.lyrics,
    genre: options.genre,
    duration: options.duration
  });
  if (!songResult.success) {
    errors.push(`Song: ${songResult.message}`);
  }
  
  // Step 3: Update images if provided
  let imagesUpdated = false;
  if (options.profileImageUrl || options.coverImageUrl) {
    const imagesResult = await updateProfileImages({
      profileImageUrl: options.profileImageUrl,
      coverImageUrl: options.coverImageUrl,
      onlyIfEmpty: true
    });
    if (imagesResult.success) {
      imagesUpdated = imagesResult.updated || false;
    } else {
      errors.push(`Images: ${imagesResult.message}`);
    }
  }
  
  return {
    profile: profileResult.profile,
    song: songResult.song,
    imagesUpdated,
    errors: errors.length > 0 ? errors : undefined
  };
}
