/**
 * BOOSTIFY - User-Generated AI Artists Agent
 * 
 * "Los usuarios crean su propio artista IA con personalidad customizada"
 * 
 * This agent:
 * - Handles creation of user-generated AI artists
 * - Sets up personality, traits, and artistic direction
 * - The created artist generates music, posts, and interacts autonomously
 * - Premium feature for monetization
 */

import { db } from '../db';
import {
  userCreatedArtists,
  users,
  artistPersonality,
  type InsertUserCreatedArtist,
  type SelectUserCreatedArtist,
} from '../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

// ============================================
// PERSONALITY PRESETS
// ============================================

const PERSONALITY_PRESETS: Record<string, {
  traits: { openness: number; conscientiousness: number; extraversion: number; agreeableness: number; neuroticism: number };
  communicationStyle: string;
  description: string;
}> = {
  rebel: {
    traits: { openness: 70, conscientiousness: 30, extraversion: 80, agreeableness: 20, neuroticism: 60 },
    communicationStyle: 'aggressive',
    description: 'Rompe reglas, sin filtro, puro fuego',
  },
  romantic: {
    traits: { openness: 80, conscientiousness: 60, extraversion: 50, agreeableness: 85, neuroticism: 50 },
    communicationStyle: 'romantic',
    description: 'Poeta del corazón, letras que enamoran',
  },
  party_animal: {
    traits: { openness: 60, conscientiousness: 20, extraversion: 95, agreeableness: 70, neuroticism: 20 },
    communicationStyle: 'funny',
    description: 'La fiesta no para, puro perreo y vibras',
  },
  intellectual: {
    traits: { openness: 95, conscientiousness: 80, extraversion: 40, agreeableness: 60, neuroticism: 40 },
    communicationStyle: 'philosophical',
    description: 'Lírico profundo, cada barra tiene significado',
  },
  mysterious: {
    traits: { openness: 50, conscientiousness: 70, extraversion: 20, agreeableness: 40, neuroticism: 30 },
    communicationStyle: 'mysterious',
    description: 'Enigmático, deja que la música hable',
  },
  wholesome: {
    traits: { openness: 70, conscientiousness: 80, extraversion: 65, agreeableness: 95, neuroticism: 15 },
    communicationStyle: 'motivational',
    description: 'Positivo, inspira y motiva a todos',
  },
  aggressive: {
    traits: { openness: 40, conscientiousness: 50, extraversion: 85, agreeableness: 15, neuroticism: 70 },
    communicationStyle: 'aggressive',
    description: 'Confrontacional, beef machine, sin miedo',
  },
  chill: {
    traits: { openness: 75, conscientiousness: 40, extraversion: 35, agreeableness: 80, neuroticism: 10 },
    communicationStyle: 'poetic',
    description: 'Relajado, lo-fi vibes, paz interior',
  },
  experimental: {
    traits: { openness: 99, conscientiousness: 45, extraversion: 55, agreeableness: 50, neuroticism: 45 },
    communicationStyle: 'philosophical',
    description: 'Vanguardia pura, rompe géneros y expectativas',
  },
  mainstream: {
    traits: { openness: 40, conscientiousness: 75, extraversion: 80, agreeableness: 70, neuroticism: 30 },
    communicationStyle: 'street',
    description: 'Comercial y exitoso, hits para las masas',
  },
};

// ============================================
// CREATE AI ARTIST
// ============================================

/**
 * Create a new AI artist for a user
 */
export async function createUserAiArtist(params: {
  creatorUserId: number;
  artistName: string;
  genre: string;
  subGenres?: string[];
  bio?: string;
  personalityPreset: string;
  customTraits?: any;
  artisticDirection?: string;
  influences?: string[];
  communicationStyle?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; artist?: any; error?: string }> {
  try {
    // Check if user already has max artists (free: 1, premium: 3)
    const existingArtists = await db
      .select()
      .from(userCreatedArtists)
      .where(and(
        eq(userCreatedArtists.creatorUserId, params.creatorUserId),
        eq(userCreatedArtists.isActive, true)
      ));

    if (existingArtists.length >= 3) {
      return { success: false, error: 'Máximo 3 artistas por usuario (plan Premium)' };
    }

    if (existingArtists.length >= 1 && !existingArtists.some(a => a.isPremium)) {
      // Check if any existing are premium - if not, limit to 1 for free users
      // For now, allow up to 3 for everyone (MVP)
    }

    // Create the user record for the AI artist
    const [artistUser] = await db.insert(users).values({
      username: params.artistName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      artistName: params.artistName,
      role: 'artist',
      genre: params.genre,
      genres: [params.genre, ...(params.subGenres || [])],
      biography: params.bio || `${params.artistName} es un artista IA creado en Boostify`,
      isAIGenerated: true,
      generatedBy: params.creatorUserId,
      profileImageUrl: params.avatarUrl || null,
    }).returning();

    // Get personality traits
    const preset = PERSONALITY_PRESETS[params.personalityPreset] || PERSONALITY_PRESETS.custom;
    const traits = params.customTraits || preset?.traits || PERSONALITY_PRESETS.mainstream.traits;
    const commStyle = params.communicationStyle || preset?.communicationStyle || 'street';

    // Create personality
    await db.insert(artistPersonality).values({
      artistId: artistUser.id,
      traits,
      artisticTraits: {
        experimentalism: traits.openness,
        commercialism: 100 - traits.openness,
        collaboration: traits.agreeableness,
        authenticity: traits.conscientiousness,
        ambition: 70,
        vulnerability: Math.max(traits.neuroticism, 30),
      },
      currentMood: 'inspired',
      moodIntensity: 70,
      artisticVision: params.artisticDirection || `Artista de ${params.genre} que busca dejar su marca`,
      coreValues: [params.genre, 'creatividad', 'autenticidad'],
      influences: params.influences || [],
      antiInfluences: [],
      communicationStyle: commStyle as any,
      shortTermGoals: `Lanzar primer single de ${params.genre}`,
      longTermGoals: 'Llegar al #1 del chart de Boostify',
      currentFocus: 'music_creation',
      activityPattern: {
        postFrequency: 'medium',
        peakHours: [20, 21, 22],
        weekdayActivity: 0.7,
        weekendActivity: 0.9,
      },
    });

    // Create the user-created artist record
    const [created] = await db.insert(userCreatedArtists).values({
      creatorUserId: params.creatorUserId,
      artistUserId: artistUser.id,
      artistName: params.artistName,
      genre: params.genre,
      subGenres: params.subGenres || [],
      avatarUrl: params.avatarUrl,
      bio: params.bio,
      personalityPreset: params.personalityPreset as any,
      customTraits: traits,
      artisticDirection: params.artisticDirection,
      influences: params.influences || [],
      communicationStyle: commStyle as any,
    }).returning();

    console.log(`🎨 [UserArtist] Created AI artist "${params.artistName}" (id ${artistUser.id}) for user ${params.creatorUserId}`);

    return {
      success: true,
      artist: {
        ...created,
        userId: artistUser.id,
        username: artistUser.username,
        presetDescription: preset?.description || 'Personalidad customizada',
      },
    };
  } catch (error) {
    console.error('❌ [UserArtist] Error creating artist:', error);
    return { success: false, error: 'Error al crear el artista' };
  }
}

// ============================================
// QUERIES
// ============================================

export async function getUserCreatedArtists(userId: number): Promise<SelectUserCreatedArtist[]> {
  try {
    return await db
      .select()
      .from(userCreatedArtists)
      .where(and(
        eq(userCreatedArtists.creatorUserId, userId),
        eq(userCreatedArtists.isActive, true)
      ))
      .orderBy(desc(userCreatedArtists.createdAt));
  } catch {
    return [];
  }
}

export async function getPresets(): Promise<Record<string, any>> {
  return Object.entries(PERSONALITY_PRESETS).reduce((acc, [key, val]) => ({
    ...acc,
    [key]: { ...val, id: key },
  }), {});
}

export async function deactivateUserArtist(creatorUserId: number, artistId: number): Promise<boolean> {
  try {
    await db.update(userCreatedArtists)
      .set({ isActive: false })
      .where(and(
        eq(userCreatedArtists.creatorUserId, creatorUserId),
        eq(userCreatedArtists.id, artistId)
      ));
    return true;
  } catch {
    return false;
  }
}
