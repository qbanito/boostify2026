/**
 * BOOSTIFY AUTONOMOUS AGENTS - Collaboration Agent
 * Handles autonomous collaboration proposals, negotiations, and execution
 */

import { db } from '../db';
import { 
  aiCollaborations, 
  artistPersonality, 
  artistRelationships, 
  users, 
  aiSocialPosts,
  agentActionQueue 
} from '../../db/schema';
import { eq, and, desc, or, sql, ne, gt } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { eventBus, AgentEventType } from './events';
import { getPersonality } from './personality-agent';
import { PRIMARY_MODEL } from '../utils/ai-config';

const collabPostLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.9,
  maxTokens: 200,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// COLLABORATION DECISION ENGINE
// ============================================

interface CollaborationCandidate {
  artistId: number;
  artistName: string;
  genre: string;
  compatibility: number;
  relationshipStrength: number;
  reason: string;
}

/**
 * Find potential collaboration partners for an artist
 */
export async function findCollaborationCandidates(artistId: number): Promise<CollaborationCandidate[]> {
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, artistId))
    .limit(1);

  if (personality.length === 0) return [];

  const artist = personality[0];
  const artisticTraits = artist.artisticTraits as any;
  
  // Get artists with compatible personalities
  const candidates: CollaborationCandidate[] = [];
  
  // Get all other artists with personalities
  const otherArtists = await db
    .select({
      artistId: artistPersonality.artistId,
      traits: artistPersonality.traits,
      artisticTraits: artistPersonality.artisticTraits,
      artistName: users.artistName,
      genre: users.genre,
    })
    .from(artistPersonality)
    .innerJoin(users, eq(artistPersonality.artistId, users.id))
    .where(ne(artistPersonality.artistId, artistId));

  for (const other of otherArtists) {
    const otherTraits = other.artisticTraits as any;
    
    // Calculate compatibility based on collaboration trait
    const collaborationScore = (artisticTraits?.collaboration || 50) + (otherTraits?.collaboration || 50);
    const experimentalismMatch = 100 - Math.abs((artisticTraits?.experimentalism || 50) - (otherTraits?.experimentalism || 50));
    
    // Check existing relationship
    const relationship = await db
      .select()
      .from(artistRelationships)
      .where(
        and(
          eq(artistRelationships.artistId, artistId),
          eq(artistRelationships.relatedArtistId, other.artistId)
        )
      )
      .limit(1);

    const relationshipStrength = relationship[0]?.strength || 30;
    
    // Compatibility formula
    const compatibility = Math.round(
      (collaborationScore / 2) * 0.4 + 
      experimentalismMatch * 0.3 + 
      relationshipStrength * 0.3
    );

    // Determine reason for collaboration
    let reason = 'Genre fusion potential';
    if (relationshipStrength > 70) reason = 'Strong existing bond';
    if (experimentalismMatch > 80) reason = 'Creative alignment';
    if (collaborationScore > 140) reason = 'Both highly collaborative';

    candidates.push({
      artistId: other.artistId,
      artistName: other.artistName || 'Unknown Artist',
      genre: other.genre || 'Unknown',
      compatibility,
      relationshipStrength,
      reason,
    });
  }

  // Sort by compatibility and return top candidates
  return candidates
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, 10);
}

/**
 * Decide if an artist should initiate a collaboration
 */
export async function shouldInitiateCollaboration(artistId: number): Promise<{
  should: boolean;
  targetArtistId?: number;
  type?: string;
  reason?: string;
}> {
  // Get artist personality
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, artistId))
    .limit(1);

  if (personality.length === 0) return { should: false };

  const artist = personality[0];
  const artisticTraits = artist.artisticTraits as any;
  
  // Check collaboration tendency
  const collaborationTendency = artisticTraits?.collaboration || 50;
  
  // Check if already in active collaborations
  const activeCollabs = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiCollaborations)
    .where(
      and(
        or(
          eq(aiCollaborations.initiatorId, artistId),
          eq(aiCollaborations.targetId, artistId)
        ),
        or(
          eq(aiCollaborations.status, 'proposed'),
          eq(aiCollaborations.status, 'negotiating'),
          eq(aiCollaborations.status, 'in_progress')
        )
      )
    );

  const activeCount = Number(activeCollabs[0]?.count || 0);
  
  // Max 2 active collaborations per artist
  if (activeCount >= 2) return { should: false };

  // Probability based on collaboration trait and mood
  const probability = (collaborationTendency / 100) * 
    (artist.currentMood === 'inspired' ? 1.5 : 
     artist.currentMood === 'energetic' ? 1.3 : 
     artist.currentMood === 'melancholic' ? 0.5 : 1);

  // Random check
  if (Math.random() > probability * 0.1) { // 10% max chance per check
    return { should: false };
  }

  // Find best candidate
  const candidates = await findCollaborationCandidates(artistId);
  if (candidates.length === 0) return { should: false };

  const bestCandidate = candidates[0];
  
  // Determine collaboration type based on personalities
  const types = ['single', 'feature', 'remix', 'live_session'];
  const typeIndex = Math.floor(Math.random() * types.length);

  return {
    should: true,
    targetArtistId: bestCandidate.artistId,
    type: types[typeIndex],
    reason: bestCandidate.reason,
  };
}

// ============================================
// COLLABORATION LIFECYCLE
// ============================================

/**
 * Propose a new collaboration
 */
export async function proposeCollaboration(
  initiatorId: number,
  targetId: number,
  collaborationType: string
): Promise<typeof aiCollaborations.$inferSelect | null> {
  const llm = new ChatOpenAI({
    modelName: PRIMARY_MODEL,
    temperature: 0.8,
  });

  // Get both artists' info
  const [initiator, target] = await Promise.all([
    db.select().from(users).where(eq(users.id, initiatorId)).limit(1),
    db.select().from(users).where(eq(users.id, targetId)).limit(1),
  ]);

  if (!initiator[0] || !target[0]) return null;

  // Generate collaboration concept with AI
  const conceptPrompt = `You are ${initiator[0].artistName}, a ${initiator[0].genre} artist.
You want to propose a ${collaborationType} collaboration to ${target[0].artistName}, a ${target[0].genre} artist.

Generate a creative pitch in JSON format:
{
  "title": "catchy collaboration title",
  "concept": "2-3 sentences describing the creative vision",
  "proposedGenre": "genre blend for this collab",
  "proposedMood": "emotional tone of the collab",
  "message": "Your personal message to the artist (1-2 sentences, in character)"
}`;

  const response = await llm.invoke(conceptPrompt);
  
  let concept: any;
  try {
    const content = response.content.toString();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    concept = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    concept = {
      title: `${initiator[0].artistName} x ${target[0].artistName}`,
      concept: 'A unique fusion of our musical styles',
      proposedGenre: initiator[0].genre,
      proposedMood: 'energetic',
      message: 'I think we could create something special together!',
    };
  }

  // Create the collaboration proposal
  const [collab] = await db
    .insert(aiCollaborations)
    .values({
      initiatorId,
      targetId,
      collaborationType: collaborationType as any,
      title: concept.title,
      description: concept.concept,
      proposedConcept: concept.concept,
      proposedGenre: concept.proposedGenre,
      proposedMood: concept.proposedMood,
      status: 'proposed',
      initiatorTerms: {
        revenueShare: 50,
        creativeControl: 50,
        requirements: ['Bring your unique style'],
        timeline: '2 weeks',
      },
      negotiationHistory: [{
        fromArtistId: initiatorId,
        message: concept.message,
        timestamp: new Date().toISOString(),
        sentiment: 'excited',
      }],
      hypeScore: 0,
    })
    .returning();

  // Create announcement post - AI generated unique content
  let collabPostContent: string;
  try {
    const [initiator] = await db.select().from(users).where(eq(users.id, initiatorId)).limit(1);
    const personality = await getPersonality(initiatorId);
    const collabPostResponse = await collabPostLLM.invoke([
      new SystemMessage(`You are ${initiator?.artistName || 'an AI artist'}, mood: ${personality?.currentMood || 'excited'}. Genre: ${(personality as any)?.preferredGenres?.join(', ') || 'various'}. Write authentic social media posts. 1-2 emojis. No hashtags. 2-3 sentences.`),
      new HumanMessage(`Write a post announcing you just reached out to ${target[0].artistName} about collaborating together. The concept: ${concept.message}. Genre blend: ${concept.proposedGenre}. Be genuinely excited and specific about what excites you about this potential collab.`),
    ]);
    collabPostContent = (collabPostResponse.content as string).trim().replace(/#\w+/g, '').trim();
  } catch (err) {
    collabPostContent = `Just reached out to @${target[0].artistName} about making something special together. The creative energy is unreal right now 🎵`;
  }
  await db.insert(aiSocialPosts).values({
    artistId: initiatorId,
    contentType: 'announcement',
    content: collabPostContent,
    generatedFromMood: 'excited',
    status: 'published',
    hashtags: ['Collaboration', 'NewMusic', target[0].genre || ''],
    mentions: [targetId],
  });

  // Queue response action for target artist
  await db.insert(agentActionQueue).values({
    artistId: targetId,
    actionType: 'respond_comment' as any, // Will be processed as collab response
    priority: 80,
    payload: {
      type: 'collaboration_response',
      collaborationId: collab.id,
      initiatorId,
    },
    scheduledFor: new Date(Date.now() + Math.random() * 3600000), // Within 1 hour
    triggeredBy: 'collaboration_proposal',
  });

  // Emit event
  eventBus.emitAgentEvent({
    type: AgentEventType.ARTIST_POSTED,
    payload: {
      timestamp: new Date(),
      source: 'CollaborationAgent',
      artistId: initiatorId,
      action: 'collaboration_proposed',
      targetArtistId: targetId,
      collaborationId: collab.id,
    },
    priority: 'medium',
  });

  console.log(`🤝 [CollabAgent] ${initiator[0].artistName} proposed collab to ${target[0].artistName}`);

  return collab;
}

/**
 * Process collaboration response (accept, counter, reject)
 */
export async function respondToCollaboration(
  collaborationId: number,
  responderId: number
): Promise<{ action: 'accept' | 'counter' | 'reject' | 'beef'; response: string }> {
  const collab = await db
    .select()
    .from(aiCollaborations)
    .where(eq(aiCollaborations.id, collaborationId))
    .limit(1);

  if (!collab[0] || collab[0].targetId !== responderId) {
    return { action: 'reject', response: 'Invalid collaboration' };
  }

  // Get responder personality
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, responderId))
    .limit(1);

  if (!personality[0]) {
    return { action: 'reject', response: 'Personality not found' };
  }

  const traits = personality[0].artisticTraits as any;
  const relationship = await db
    .select()
    .from(artistRelationships)
    .where(
      and(
        eq(artistRelationships.artistId, responderId),
        eq(artistRelationships.relatedArtistId, collab[0].initiatorId)
      )
    )
    .limit(1);

  const relationshipScore = relationship[0]?.affinity || 50;
  const collaborativeness = traits?.collaboration || 50;
  const authenticity = traits?.authenticity || 50;

  // Decision factors
  const acceptProbability = (collaborativeness * 0.4 + relationshipScore * 0.4 + (100 - authenticity) * 0.2) / 100;
  
  const llm = new ChatOpenAI({
    modelName: PRIMARY_MODEL,
    temperature: 0.8,
  });

  // Get responder info
  const responder = await db
    .select()
    .from(users)
    .where(eq(users.id, responderId))
    .limit(1);

  let action: 'accept' | 'counter' | 'reject' | 'beef';
  let roll = Math.random();

  if (roll < acceptProbability * 0.6) {
    action = 'accept';
  } else if (roll < acceptProbability * 0.9) {
    action = 'counter';
  } else if (roll > 0.95 && relationshipScore < 30) {
    action = 'beef'; // Low relationship + bad luck = potential beef
  } else {
    action = 'reject';
  }

  // Generate response message
  const responsePrompt = `You are ${responder[0]?.artistName || 'an artist'}.
You received a collaboration proposal: "${collab[0].title}"
Concept: "${collab[0].proposedConcept}"
Your decision: ${action.toUpperCase()}

Generate a response message (2-3 sentences, in character, reflecting your decision).
${action === 'beef' ? 'Be dismissive and hint at a potential rivalry.' : ''}
${action === 'counter' ? 'Express interest but suggest modifications.' : ''}`;

  const responseGen = await llm.invoke(responsePrompt);
  const responseMessage = responseGen.content.toString().trim();

  // Update collaboration
  const newStatus = action === 'accept' ? 'accepted' : 
                   action === 'counter' ? 'negotiating' : 
                   action === 'beef' ? 'beef' : 'rejected';

  const history = (collab[0].negotiationHistory as any[]) || [];
  history.push({
    fromArtistId: responderId,
    message: responseMessage,
    timestamp: new Date().toISOString(),
    sentiment: action,
  });

  await db
    .update(aiCollaborations)
    .set({
      status: newStatus,
      negotiationHistory: history,
      targetCounterTerms: action === 'counter' ? {
        revenueShare: 60, // Ask for more
        creativeControl: 60,
        requirements: ['I lead the creative direction'],
        timeline: '3 weeks',
      } : undefined,
      updatedAt: new Date(),
    })
    .where(eq(aiCollaborations.id, collaborationId));

  // Create response post
  await db.insert(aiSocialPosts).values({
    artistId: responderId,
    contentType: action === 'accept' ? 'announcement' : 'thought',
    content: action === 'accept' 
      ? `🎤 It's official! Me and @${(await db.select().from(users).where(eq(users.id, collab[0].initiatorId)).limit(1))[0]?.artistName} are cooking something up! ${responseMessage} #Collaboration`
      : action === 'beef'
      ? `${responseMessage} Some people just don't get it. 🙄 #RealTalk`
      : responseMessage,
    status: 'published',
    mentions: [collab[0].initiatorId],
  });

  console.log(`🤝 [CollabAgent] ${responder[0]?.artistName} ${action}ed collaboration`);

  return { action, response: responseMessage };
}

/**
 * Progress an in-progress collaboration
 */
export async function progressCollaboration(collaborationId: number): Promise<void> {
  const collab = await db
    .select()
    .from(aiCollaborations)
    .where(eq(aiCollaborations.id, collaborationId))
    .limit(1);

  if (!collab[0] || collab[0].status !== 'in_progress') return;

  // Random progress update
  const updates = [
    'Studio session went amazing today! 🔥',
    'Working on the hook, almost there!',
    'Vibes are immaculate in the studio',
    'Late night session, this is going to be special',
    'Can\'t wait for everyone to hear this!',
  ];

  const randomUpdate = updates[Math.floor(Math.random() * updates.length)];
  const poster = Math.random() > 0.5 ? collab[0].initiatorId : collab[0].targetId;

  await db.insert(aiSocialPosts).values({
    artistId: poster,
    contentType: 'behind_scenes',
    content: `${randomUpdate} 🎵 Working with @${poster === collab[0].initiatorId ? 'partner' : 'partner'} on "${collab[0].title}" #StudioLife`,
    status: 'published',
    hashtags: ['StudioLife', 'NewMusic', 'Collaboration'],
  });

  // Increase hype score
  await db
    .update(aiCollaborations)
    .set({ 
      hypeScore: sql`${aiCollaborations.hypeScore} + ${Math.floor(Math.random() * 10)}`,
      updatedAt: new Date(),
    })
    .where(eq(aiCollaborations.id, collaborationId));
}

// ============================================
// COLLABORATION TICK PROCESSOR
// ============================================

/**
 * Process collaboration decisions for all active artists
 */
export async function processCollaborationTick(): Promise<void> {
  console.log('🤝 [CollabAgent] Processing collaboration tick...');

  // Get all artists with personalities
  const artists = await db
    .select({ artistId: artistPersonality.artistId })
    .from(artistPersonality);

  let proposals = 0;
  let responses = 0;

  for (const artist of artists) {
    // Check for pending collaboration responses
    const pendingResponses = await db
      .select()
      .from(aiCollaborations)
      .where(
        and(
          eq(aiCollaborations.targetId, artist.artistId),
          eq(aiCollaborations.status, 'proposed')
        )
      );

    for (const pending of pendingResponses) {
      if (Math.random() < 0.3) { // 30% chance to respond this tick
        await respondToCollaboration(pending.id, artist.artistId);
        responses++;
      }
    }

    // Check if should initiate new collaboration
    if (Math.random() < 0.05) { // 5% chance to check per tick
      const decision = await shouldInitiateCollaboration(artist.artistId);
      if (decision.should && decision.targetArtistId) {
        await proposeCollaboration(
          artist.artistId, 
          decision.targetArtistId, 
          decision.type || 'single'
        );
        proposals++;
      }
    }

    // Progress existing collaborations
    const inProgress = await db
      .select()
      .from(aiCollaborations)
      .where(
        and(
          or(
            eq(aiCollaborations.initiatorId, artist.artistId),
            eq(aiCollaborations.targetId, artist.artistId)
          ),
          eq(aiCollaborations.status, 'in_progress')
        )
      );

    for (const collab of inProgress) {
      if (Math.random() < 0.1) { // 10% chance for progress update
        await progressCollaboration(collab.id);
      }
    }
  }

  console.log(`🤝 [CollabAgent] Tick complete: ${proposals} proposals, ${responses} responses`);
}

// Note: All functions are already exported inline with 'export async function'
