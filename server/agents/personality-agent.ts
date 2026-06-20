/**
 * BOOSTIFY AUTONOMOUS AGENTS - Personality Agent
 * Defines and maintains the unique personality of each AI artist
 */

import { ChatOpenAI } from '@langchain/openai';
import { db } from '../db';
import { artistPersonality, users, agentMemory } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { eventBus, AgentEventType, emitMoodChange } from './events';
import type { 
  ArtistPersonality, 
  PersonalityTraits, 
  ArtisticTraits, 
  MoodType, 
  CommunicationStyle 
} from './types';
import { PRIMARY_MODEL } from '../utils/ai-config';

// ============================================
// LLM CONFIGURATION
// ============================================

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.9, // High creativity for personality generation
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// PERSONALITY GENERATION
// ============================================

/**
 * Generate a unique personality for an artist based on their profile
 */
export async function generatePersonality(artistId: number): Promise<ArtistPersonality | null> {
  try {
    // Get artist info
    const [artist] = await db
      .select({
        id: users.id,
        name: users.artistName,
        genres: users.genres,
        biography: users.biography,
        location: users.location,
        country: users.country,
      })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);
    
    if (!artist) {
      console.error(`❌ [PersonalityAgent] Artist ${artistId} not found`);
      return null;
    }

    console.log(`🎭 [PersonalityAgent] Generating personality for ${artist.name}...`);

    // Generate personality using LLM
    const prompt = `You are creating a unique personality for an AI music artist. Generate realistic and coherent personality traits.

ARTIST PROFILE:
- Name: ${artist.name}
- Genres: ${Array.isArray(artist.genres) ? artist.genres.join(', ') : artist.genres || 'Unknown'}
- Biography: ${artist.biography || 'No biography available'}
- Location: ${artist.location || artist.country || 'Unknown'}

Generate a JSON object with these exact fields (all numbers should be 0-100):

{
  "traits": {
    "openness": <number 0-100>,
    "conscientiousness": <number 0-100>,
    "extraversion": <number 0-100>,
    "agreeableness": <number 0-100>,
    "neuroticism": <number 0-100>
  },
  "artisticTraits": {
    "experimentalism": <number 0-100>,
    "commercialism": <number 0-100>,
    "collaboration": <number 0-100>,
    "authenticity": <number 0-100>,
    "ambition": <number 0-100>,
    "vulnerability": <number 0-100>
  },
  "currentMood": "<one of: inspired, reflective, energetic, melancholic, rebellious, peaceful, anxious, confident, frustrated, euphoric>",
  "artisticVision": "<1-2 sentences describing their artistic purpose>",
  "coreValues": ["<value1>", "<value2>", "<value3>"],
  "influences": ["<influence1>", "<influence2>", "<influence3>"],
  "antiInfluences": ["<thing they reject 1>", "<thing they reject 2>"],
  "communicationStyle": "<one of: poetic, direct, mysterious, humorous, philosophical, provocative, gentle, intense>",
  "shortTermGoals": ["<goal1>", "<goal2>"],
  "longTermGoals": ["<goal1>", "<goal2>"],
  "currentFocus": "<what they're currently working on>",
  "activityPattern": {
    "peakCreativityHours": [<hour1>, <hour2>, <hour3>],
    "socialActivityLevel": "<low, medium, or high>",
    "collaborationFrequency": "<rarely, sometimes, or often>",
    "postingFrequency": "<daily, few_times_week, weekly, or sporadic>"
  }
}

Make the personality coherent with their genre and biography. Be creative but realistic.
Return ONLY the JSON, no explanations.`;

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }
    
    const personalityData = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize the data
    const personality: ArtistPersonality = {
      artistId,
      traits: normalizeTraits(personalityData.traits),
      artisticTraits: normalizeArtisticTraits(personalityData.artisticTraits),
      currentMood: validateMood(personalityData.currentMood),
      moodIntensity: 60 + Math.floor(Math.random() * 30), // 60-90 initial intensity
      artisticVision: personalityData.artisticVision || `Creating unique ${artist.genres?.[0] || 'music'} that resonates with souls`,
      coreValues: personalityData.coreValues || ['authenticity', 'creativity', 'connection'],
      influences: personalityData.influences || [],
      antiInfluences: personalityData.antiInfluences || [],
      communicationStyle: validateCommunicationStyle(personalityData.communicationStyle),
      shortTermGoals: personalityData.shortTermGoals || ['Release new music', 'Connect with fans'],
      longTermGoals: personalityData.longTermGoals || ['Build a legacy', 'Inspire others'],
      currentFocus: personalityData.currentFocus || 'Creating new content',
      activityPattern: {
        peakCreativityHours: personalityData.activityPattern?.peakCreativityHours || [10, 14, 22],
        socialActivityLevel: personalityData.activityPattern?.socialActivityLevel || 'medium',
        collaborationFrequency: personalityData.activityPattern?.collaborationFrequency || 'sometimes',
        postingFrequency: personalityData.activityPattern?.postingFrequency || 'few_times_week',
      },
    };

    // Save to database
    await db.insert(artistPersonality).values({
      artistId,
      traits: personality.traits,
      artisticTraits: personality.artisticTraits,
      currentMood: personality.currentMood,
      moodIntensity: personality.moodIntensity,
      artisticVision: personality.artisticVision,
      coreValues: personality.coreValues,
      influences: personality.influences,
      antiInfluences: personality.antiInfluences,
      communicationStyle: personality.communicationStyle,
      shortTermGoals: personality.shortTermGoals,
      longTermGoals: personality.longTermGoals,
      currentFocus: personality.currentFocus,
      activityPattern: personality.activityPattern,
    }).onConflictDoUpdate({
      target: artistPersonality.artistId,
      set: {
        traits: personality.traits,
        artisticTraits: personality.artisticTraits,
        currentMood: personality.currentMood,
        moodIntensity: personality.moodIntensity,
        artisticVision: personality.artisticVision,
        coreValues: personality.coreValues,
        influences: personality.influences,
        antiInfluences: personality.antiInfluences,
        communicationStyle: personality.communicationStyle,
        shortTermGoals: personality.shortTermGoals,
        longTermGoals: personality.longTermGoals,
        currentFocus: personality.currentFocus,
        activityPattern: personality.activityPattern,
        updatedAt: new Date(),
      },
    });

    // Emit event
    eventBus.emitAgentEvent({
      type: AgentEventType.ARTIST_PERSONALITY_INITIALIZED,
      payload: {
        timestamp: new Date(),
        source: 'PersonalityAgent',
        artistId,
        artistName: artist.name,
        mood: personality.currentMood,
        communicationStyle: personality.communicationStyle,
      },
      priority: 'medium',
    });

    console.log(`✅ [PersonalityAgent] Personality generated for ${artist.name}`);
    return personality;

  } catch (error) {
    console.error(`❌ [PersonalityAgent] Error generating personality for ${artistId}:`, error);
    return null;
  }
}

/**
 * Get an artist's personality
 */
export async function getPersonality(artistId: number): Promise<ArtistPersonality | null> {
  try {
    const [personality] = await db
      .select()
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, artistId))
      .limit(1);
    
    if (!personality) {
      return null;
    }

    return {
      artistId: personality.artistId,
      traits: personality.traits as PersonalityTraits,
      artisticTraits: personality.artisticTraits as ArtisticTraits,
      currentMood: personality.currentMood as MoodType,
      moodIntensity: personality.moodIntensity || 50,
      artisticVision: personality.artisticVision || '',
      coreValues: personality.coreValues || [],
      influences: personality.influences || [],
      antiInfluences: personality.antiInfluences || [],
      communicationStyle: personality.communicationStyle as CommunicationStyle,
      shortTermGoals: personality.shortTermGoals as string[] || [],
      longTermGoals: personality.longTermGoals as string[] || [],
      currentFocus: personality.currentFocus || '',
      activityPattern: personality.activityPattern as ArtistPersonality['activityPattern'],
    };
  } catch (error) {
    console.error(`❌ [PersonalityAgent] Error getting personality for ${artistId}:`, error);
    return null;
  }
}

/**
 * Update an artist's mood
 */
export async function updateArtistMood(
  artistId: number, 
  newMood: MoodType, 
  intensity?: number,
  trigger?: string
): Promise<boolean> {
  try {
    // Get current mood
    const [current] = await db
      .select({ currentMood: artistPersonality.currentMood, moodIntensity: artistPersonality.moodIntensity })
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, artistId))
      .limit(1);
    
    if (!current) {
      console.error(`❌ [PersonalityAgent] No personality found for artist ${artistId}`);
      return false;
    }

    const previousMood = current.currentMood as MoodType;
    const newIntensity = intensity ?? current.moodIntensity ?? 50;

    // Update mood
    await db
      .update(artistPersonality)
      .set({
        currentMood: newMood,
        moodIntensity: newIntensity,
        updatedAt: new Date(),
      })
      .where(eq(artistPersonality.artistId, artistId));

    // Create memory of mood change
    await db.insert(agentMemory).values({
      artistId,
      memoryType: 'episodic',
      category: 'event',
      content: `Mood changed from ${previousMood} to ${newMood}${trigger ? ` because: ${trigger}` : ''}`,
      importance: 40,
      emotionalWeight: newIntensity,
      context: {
        emotions: [previousMood, newMood],
        trigger,
      },
    });

    // Emit event
    emitMoodChange(artistId, previousMood, newMood, newIntensity, trigger);

    console.log(`😊 [PersonalityAgent] Artist ${artistId} mood changed: ${previousMood} → ${newMood}`);
    return true;

  } catch (error) {
    console.error(`❌ [PersonalityAgent] Error updating mood for ${artistId}:`, error);
    return false;
  }
}

/**
 * Get mood-appropriate content suggestions
 */
export function getMoodContentSuggestions(mood: MoodType): {
  postTypes: string[];
  tones: string[];
  topics: string[];
} {
  const suggestions: Record<MoodType, { postTypes: string[]; tones: string[]; topics: string[] }> = {
    inspired: {
      postTypes: ['behind_scenes', 'thought', 'announcement'],
      tones: ['excited', 'hopeful', 'visionary'],
      topics: ['new ideas', 'creative process', 'future plans'],
    },
    reflective: {
      postTypes: ['thought', 'text'],
      tones: ['contemplative', 'grateful', 'nostalgic'],
      topics: ['journey', 'lessons learned', 'appreciation'],
    },
    energetic: {
      postTypes: ['video', 'announcement', 'collaboration'],
      tones: ['hyped', 'playful', 'bold'],
      topics: ['upcoming events', 'challenges', 'live moments'],
    },
    melancholic: {
      postTypes: ['text', 'thought'],
      tones: ['vulnerable', 'honest', 'deep'],
      topics: ['emotions', 'art', 'connection'],
    },
    rebellious: {
      postTypes: ['reaction', 'thought', 'announcement'],
      tones: ['defiant', 'provocative', 'unapologetic'],
      topics: ['industry critique', 'authenticity', 'breaking norms'],
    },
    peaceful: {
      postTypes: ['image', 'text', 'behind_scenes'],
      tones: ['calm', 'serene', 'grateful'],
      topics: ['nature', 'simplicity', 'mindfulness'],
    },
    anxious: {
      postTypes: ['thought', 'text'],
      tones: ['honest', 'vulnerable', 'seeking'],
      topics: ['uncertainty', 'growth', 'support'],
    },
    confident: {
      postTypes: ['announcement', 'video', 'song_release'],
      tones: ['bold', 'assured', 'proud'],
      topics: ['achievements', 'new work', 'ambitions'],
    },
    frustrated: {
      postTypes: ['thought', 'reaction'],
      tones: ['raw', 'honest', 'determined'],
      topics: ['challenges', 'obstacles', 'perseverance'],
    },
    euphoric: {
      postTypes: ['video', 'announcement', 'collaboration'],
      tones: ['ecstatic', 'celebratory', 'joyful'],
      topics: ['wins', 'gratitude', 'community'],
    },
  };

  return suggestions[mood] || suggestions.peaceful;
}

/**
 * Decide if an artist would take an action based on personality
 */
export async function wouldArtistDoThis(
  artistId: number,
  action: string,
  context?: Record<string, any>
): Promise<{ wouldDo: boolean; confidence: number; reasoning: string }> {
  try {
    const personality = await getPersonality(artistId);
    if (!personality) {
      return { wouldDo: false, confidence: 0, reasoning: 'No personality found' };
    }

    const prompt = `You are simulating the decision-making of an AI artist with these traits:

PERSONALITY:
- Openness: ${personality.traits.openness}/100
- Conscientiousness: ${personality.traits.conscientiousness}/100
- Extraversion: ${personality.traits.extraversion}/100
- Agreeableness: ${personality.traits.agreeableness}/100
- Neuroticism: ${personality.traits.neuroticism}/100

ARTISTIC TRAITS:
- Experimentalism: ${personality.artisticTraits.experimentalism}/100 (Traditional vs Avant-garde)
- Commercialism: ${personality.artisticTraits.commercialism}/100 (Underground vs Mainstream)
- Collaboration: ${personality.artisticTraits.collaboration}/100 (Solo vs Team)
- Authenticity: ${personality.artisticTraits.authenticity}/100 (Trend-follower vs Trendsetter)

CURRENT STATE:
- Mood: ${personality.currentMood} (intensity: ${personality.moodIntensity}/100)
- Core values: ${personality.coreValues.join(', ')}
- Communication style: ${personality.communicationStyle}

PROPOSED ACTION: ${action}
CONTEXT: ${JSON.stringify(context || {})}

Would this artist take this action? Respond with JSON:
{
  "wouldDo": true/false,
  "confidence": 0-100,
  "reasoning": "Brief explanation based on personality"
}

Return ONLY the JSON.`;

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);
      return {
        wouldDo: Boolean(decision.wouldDo),
        confidence: Math.min(100, Math.max(0, Number(decision.confidence) || 50)),
        reasoning: decision.reasoning || 'No reasoning provided',
      };
    }

    return { wouldDo: Math.random() > 0.5, confidence: 50, reasoning: 'Could not parse decision' };

  } catch (error) {
    console.error(`❌ [PersonalityAgent] Error in decision for ${artistId}:`, error);
    return { wouldDo: false, confidence: 0, reasoning: String(error) };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeTraits(traits: any): PersonalityTraits {
  const normalize = (val: any) => Math.min(100, Math.max(0, Number(val) || 50));
  return {
    openness: normalize(traits?.openness),
    conscientiousness: normalize(traits?.conscientiousness),
    extraversion: normalize(traits?.extraversion),
    agreeableness: normalize(traits?.agreeableness),
    neuroticism: normalize(traits?.neuroticism),
  };
}

function normalizeArtisticTraits(traits: any): ArtisticTraits {
  const normalize = (val: any) => Math.min(100, Math.max(0, Number(val) || 50));
  return {
    experimentalism: normalize(traits?.experimentalism),
    commercialism: normalize(traits?.commercialism),
    collaboration: normalize(traits?.collaboration),
    authenticity: normalize(traits?.authenticity),
    ambition: normalize(traits?.ambition),
    vulnerability: normalize(traits?.vulnerability),
  };
}

function validateMood(mood: any): MoodType {
  const validMoods: MoodType[] = [
    'inspired', 'reflective', 'energetic', 'melancholic', 'rebellious',
    'peaceful', 'anxious', 'confident', 'frustrated', 'euphoric'
  ];
  return validMoods.includes(mood) ? mood : 'peaceful';
}

function validateCommunicationStyle(style: any): CommunicationStyle {
  const validStyles: CommunicationStyle[] = [
    'poetic', 'direct', 'mysterious', 'humorous', 
    'philosophical', 'provocative', 'gentle', 'intense'
  ];
  return validStyles.includes(style) ? style : 'direct';
}
