/**
 * BOOSTIFY AUTONOMOUS AGENTS - Drama & Beef Agent
 * Handles rivalries, diss tracks, conflicts, and their resolution
 */

import { db } from '../db';
import { 
  aiBeefs,
  aiCollaborations,
  artistPersonality,
  artistRelationships,
  users,
  aiSocialPosts,
  aiGeneratedMusic,
  aiArtistEvolution,
  agentActionQueue
} from '../../db/schema';
import { eq, and, desc, or, sql, ne, lt } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { eventBus, AgentEventType } from './events';
import { getPersonality } from './personality-agent';
import { PRIMARY_MODEL } from '../utils/ai-config';

const beefPostLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.95,
  maxTokens: 200,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// BEEF DETECTION & INITIATION
// ============================================

interface BeefPotential {
  targetId: number;
  targetName: string;
  beefType: string;
  probability: number;
  reason: string;
  intensity: number;
}

/**
 * Analyze potential beefs for an artist
 */
export async function analyzeBeefPotential(artistId: number): Promise<BeefPotential[]> {
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, artistId))
    .limit(1);

  if (!personality[0]) return [];

  const traits = personality[0].traits as any;
  const artisticTraits = personality[0].artisticTraits as any;
  const potentials: BeefPotential[] = [];

  // High neuroticism + low agreeableness = more likely to beef
  const beefProneness = ((traits?.neuroticism || 50) + (100 - (traits?.agreeableness || 50))) / 2;
  const competitiveness = 100 - (artisticTraits?.collaboration || 50);

  // Check relationships with negative sentiment
  const negativeRelationships = await db
    .select({
      relatedArtistId: artistRelationships.relatedArtistId,
      affinity: artistRelationships.affinity,
      type: artistRelationships.relationshipType,
      artistName: users.artistName,
    })
    .from(artistRelationships)
    .innerJoin(users, eq(artistRelationships.relatedArtistId, users.id))
    .where(
      and(
        eq(artistRelationships.artistId, artistId),
        lt(artistRelationships.affinity, 40) // Low affinity
      )
    );

  for (const rel of negativeRelationships) {
    const affinity = rel.affinity || 50;
    const beefProb = (beefProneness / 100) * ((100 - affinity) / 100) * (competitiveness / 100);
    
    if (beefProb > 0.1) {
      potentials.push({
        targetId: rel.relatedArtistId,
        targetName: rel.artistName || 'Unknown',
        beefType: rel.type === 'rival' ? 'rivalry' : 'style_clash',
        probability: beefProb,
        reason: `Low affinity (${affinity}) with ${rel.type}`,
        intensity: Math.floor((100 - affinity) * beefProneness / 100),
      });
    }
  }

  // Check for failed collaborations
  const failedCollabs = await db
    .select({
      targetId: aiCollaborations.targetId,
      initiatorId: aiCollaborations.initiatorId,
      title: aiCollaborations.title,
    })
    .from(aiCollaborations)
    .where(
      and(
        or(
          eq(aiCollaborations.initiatorId, artistId),
          eq(aiCollaborations.targetId, artistId)
        ),
        eq(aiCollaborations.status, 'rejected')
      )
    );

  for (const collab of failedCollabs) {
    const targetId = collab.initiatorId === artistId ? collab.targetId : collab.initiatorId;
    const targetUser = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    
    potentials.push({
      targetId,
      targetName: targetUser[0]?.artistName || 'Unknown',
      beefType: 'collaboration_gone_wrong',
      probability: beefProneness / 100 * 0.6,
      reason: `Rejected collaboration "${collab.title}"`,
      intensity: Math.floor(beefProneness * 0.7),
    });
  }

  return potentials.sort((a, b) => b.probability - a.probability).slice(0, 5);
}

/**
 * Check if an artist should start a beef
 */
export async function shouldInitiateBeef(artistId: number): Promise<{
  should: boolean;
  targetId?: number;
  type?: string;
  reason?: string;
}> {
  // Check if already in active beef
  const activeBeefs = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiBeefs)
    .where(
      and(
        or(
          eq(aiBeefs.instigatorId, artistId),
          eq(aiBeefs.targetId, artistId)
        ),
        or(
          eq(aiBeefs.status, 'brewing'),
          eq(aiBeefs.status, 'active'),
          eq(aiBeefs.status, 'escalating')
        )
      )
    );

  if (Number(activeBeefs[0]?.count || 0) >= 1) return { should: false };

  // Get personality
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, artistId))
    .limit(1);

  if (!personality[0]) return { should: false };

  // Certain moods are more prone to beef
  const mood = personality[0].currentMood;
  const beefMoods = ['rebellious', 'frustrated', 'anxious'];
  if (!beefMoods.includes(mood || '')) {
    // Only 5% chance if not in beef mood
    if (Math.random() > 0.05) return { should: false };
  }

  // Analyze potential targets
  const potentials = await analyzeBeefPotential(artistId);
  if (potentials.length === 0) return { should: false };

  // Random check against probability
  const best = potentials[0];
  if (Math.random() > best.probability * 0.2) return { should: false };

  return {
    should: true,
    targetId: best.targetId,
    type: best.beefType,
    reason: best.reason,
  };
}

// ============================================
// BEEF LIFECYCLE
// ============================================

/**
 * Start a new beef
 */
export async function initiateBeef(
  instigatorId: number,
  targetId: number,
  beefType: string,
  triggerReason: string
): Promise<typeof aiBeefs.$inferSelect | null> {
  const llm = new ChatOpenAI({
    modelName: PRIMARY_MODEL,
    temperature: 0.9,
  });

  // Get both artists
  const [instigator, target] = await Promise.all([
    db.select().from(users).where(eq(users.id, instigatorId)).limit(1),
    db.select().from(users).where(eq(users.id, targetId)).limit(1),
  ]);

  if (!instigator[0] || !target[0]) return null;

  // Generate beef narrative with AI
  const beefPrompt = `You are a music industry drama narrator.
Create a dramatic narrative for a beef between two artists:

Instigator: ${instigator[0].artistName} (${instigator[0].genre})
Target: ${target[0].artistName} (${target[0].genre})
Beef Type: ${beefType}
Trigger: ${triggerReason}

Generate a JSON response:
{
  "title": "Epic dramatic title for this rivalry (e.g., 'The Battle for Hip-Hop Supremacy')",
  "description": "2-3 sentences describing what this beef is about",
  "instigatorStatement": "Provocative first shot from the instigator (2-3 sentences, spicy but not offensive)",
  "intensity": number from 30-70 for initial intensity
}`;

  const response = await llm.invoke(beefPrompt);
  
  let narrative: any;
  try {
    const content = response.content.toString();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    narrative = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    narrative = {
      title: `${instigator[0].artistName} vs ${target[0].artistName}`,
      description: 'A clash of musical titans',
      instigatorStatement: 'Some artists just don\'t have what it takes.',
      intensity: 50,
    };
  }

  // Create the beef
  const [beef] = await db
    .insert(aiBeefs)
    .values({
      instigatorId,
      targetId,
      beefType: beefType as any,
      title: narrative.title,
      description: narrative.description,
      triggerEvent: triggerReason,
      status: 'brewing',
      intensity: narrative.intensity,
      publicInterest: 10,
      timeline: [{
        date: new Date().toISOString(),
        event: `${instigator[0].artistName} fired the first shot`,
        artistId: instigatorId,
        impact: 10,
      }],
      dissTrackIds: [],
      responseSongIds: [],
    })
    .returning();

  // Create the provocative post
  await db.insert(aiSocialPosts).values({
    artistId: instigatorId,
    contentType: 'thought',
    content: `${narrative.instigatorStatement} 🎤 ${target[0].artistName ? `@${target[0].artistName}` : ''} you know what this is about. #RealTalk #NoFilter`,
    status: 'published',
    hashtags: ['RealTalk', 'NoFilter', 'Industry'],
    mentions: [targetId],
  });

  // Update relationship to rival
  await db
    .update(artistRelationships)
    .set({
      relationshipType: 'rival',
      affinity: sql`GREATEST(${artistRelationships.affinity} - 20, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(artistRelationships.artistId, instigatorId),
        eq(artistRelationships.relatedArtistId, targetId)
      )
    );

  // Queue response action for target
  await db.insert(agentActionQueue).values({
    artistId: targetId,
    actionType: 'respond_comment' as any,
    priority: 90,
    payload: {
      type: 'beef_response',
      beefId: beef.id,
      instigatorId,
    },
    scheduledFor: new Date(Date.now() + Math.random() * 7200000), // Within 2 hours
    triggeredBy: 'beef_initiation',
  });

  console.log(`🔥 [BeefAgent] ${instigator[0].artistName} started beef with ${target[0].artistName}: "${narrative.title}"`);

  // Emit event
  eventBus.emitAgentEvent({
    type: AgentEventType.WORLD_EVENT_STARTED,
    payload: {
      timestamp: new Date(),
      source: 'BeefAgent',
      eventType: 'beef',
      title: narrative.title,
      artistIds: [instigatorId, targetId],
      beefId: beef.id,
    },
    priority: 'high',
  });

  return beef;
}

/**
 * Respond to a beef
 */
export async function respondToBeef(beefId: number, responderId: number): Promise<string> {
  const beef = await db
    .select()
    .from(aiBeefs)
    .where(eq(aiBeefs.id, beefId))
    .limit(1);

  if (!beef[0]) return 'Beef not found';

  // Determine if responder is target or a third party getting involved
  const isTarget = beef[0].targetId === responderId;
  const isInstigator = beef[0].instigatorId === responderId;

  if (!isTarget && !isInstigator) return 'Not involved in beef';

  const llm = new ChatOpenAI({
    modelName: PRIMARY_MODEL,
    temperature: 0.9,
  });

  // Get personality to determine response type
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, responderId))
    .limit(1);

  const traits = personality[0]?.artisticTraits as any;
  const authenticity = traits?.authenticity || 50;
  
  const responder = await db.select().from(users).where(eq(users.id, responderId)).limit(1);
  
  // Decide response type: escalate, clap back, or try to squash
  let responseType: 'escalate' | 'clap_back' | 'squash' = 'clap_back';
  if (authenticity > 70) {
    responseType = 'escalate'; // Authentic artists don't back down
  } else if (authenticity < 30 && (personality[0]?.traits as any)?.agreeableness > 70) {
    responseType = 'squash'; // Agreeable, commercial artists might try to end it
  }

  const responsePrompt = `You are ${responder[0]?.artistName || 'an artist'} responding to a beef.
Beef: "${beef[0].title}"
Context: "${beef[0].description}"
Your response type: ${responseType.toUpperCase()}

Generate a response (2-3 sentences, in character):
- If ESCALATE: Take it up a notch, maybe hint at a diss track
- If CLAP_BACK: Defend yourself with wit and confidence
- If SQUASH: Try to be diplomatic while maintaining dignity`;

  const response = await llm.invoke(responsePrompt);
  const responseText = response.content.toString().trim();

  // Update beef status and timeline
  const timeline = (beef[0].timeline as any[]) || [];
  timeline.push({
    date: new Date().toISOString(),
    event: `${responder[0]?.artistName} responded with a ${responseType}`,
    artistId: responderId,
    impact: responseType === 'escalate' ? 15 : responseType === 'clap_back' ? 10 : -5,
  });

  const newIntensity = Math.min(100, (beef[0].intensity || 50) + 
    (responseType === 'escalate' ? 15 : responseType === 'clap_back' ? 5 : -10));
  
  const newStatus = responseType === 'squash' && newIntensity < 30 ? 'cooling_down' :
                    newIntensity > 80 ? 'peak' :
                    newIntensity > 60 ? 'escalating' : 
                    beef[0].status;

  await db
    .update(aiBeefs)
    .set({
      status: newStatus,
      intensity: newIntensity,
      publicInterest: sql`${aiBeefs.publicInterest} + ${responseType === 'escalate' ? 20 : 10}`,
      timeline,
      updatedAt: new Date(),
    })
    .where(eq(aiBeefs.id, beefId));

  // Post the response
  await db.insert(aiSocialPosts).values({
    artistId: responderId,
    contentType: 'thought',
    content: `${responseText} ${responseType === 'escalate' ? '🔥 Stay tuned.' : ''} #Response`,
    status: 'published',
    hashtags: ['Response', beef[0].title?.replace(/\s+/g, '') || 'Beef'],
    mentions: [isTarget ? beef[0].instigatorId : beef[0].targetId],
  });

  console.log(`🔥 [BeefAgent] ${responder[0]?.artistName} ${responseType}: "${responseText.substring(0, 50)}..."`);

  return responseText;
}

/**
 * Create a diss track as part of the beef
 */
export async function createDissTrack(beefId: number, artistId: number): Promise<typeof aiGeneratedMusic.$inferSelect | null> {
  const beef = await db
    .select()
    .from(aiBeefs)
    .where(eq(aiBeefs.id, beefId))
    .limit(1);

  if (!beef[0]) return null;

  const isInstigator = beef[0].instigatorId === artistId;
  const targetId = isInstigator ? beef[0].targetId : beef[0].instigatorId;

  const [artist, target] = await Promise.all([
    db.select().from(users).where(eq(users.id, artistId)).limit(1),
    db.select().from(users).where(eq(users.id, targetId)).limit(1),
  ]);

  const llm = new ChatOpenAI({
    modelName: PRIMARY_MODEL,
    temperature: 0.95,
  });

  // Generate diss track concept
  const dissPrompt = `You are ${artist[0]?.artistName}, a ${artist[0]?.genre} artist.
You're creating a diss track aimed at ${target[0]?.artistName} as part of your beef "${beef[0].title}".

Generate a diss track concept in JSON:
{
  "title": "catchy diss track title",
  "hook": "4 lines of the hook/chorus (clever wordplay, not offensive)",
  "bars": "4 hard-hitting bars (creative disses, no slurs or explicit content)",
  "mood": "aggressive/confident/dismissive",
  "description": "1 sentence about the track"
}`;

  const response = await llm.invoke(dissPrompt);
  
  let dissTrack: any;
  try {
    const content = response.content.toString();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    dissTrack = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    dissTrack = {
      title: `${artist[0]?.artistName} - Response Track`,
      hook: 'They know who the real one is...',
      bars: 'Coming for the crown, they can\'t stop me now',
      mood: 'aggressive',
      description: 'A response to the ongoing beef',
    };
  }

  // Create the AI generated music entry
  const [music] = await db
    .insert(aiGeneratedMusic)
    .values({
      artistId,
      title: dissTrack.title,
      description: dissTrack.description,
      lyrics: `${dissTrack.hook}\n\n${dissTrack.bars}`,
      genre: artist[0]?.genre || 'hip-hop',
      mood: dissTrack.mood,
      generationPrompt: `Diss track for beef: ${beef[0].title}`,
      generationProvider: 'internal',
      beefId,
      isDissTrack: true,
      status: 'ready', // In a real implementation, this would queue for Suno generation
      isPublished: true,
      publishedAt: new Date(),
    })
    .returning();

  // Update beef with diss track
  const dissTrackIds = (beef[0].dissTrackIds as number[]) || [];
  dissTrackIds.push(music.id);

  const timeline = (beef[0].timeline as any[]) || [];
  timeline.push({
    date: new Date().toISOString(),
    event: `${artist[0]?.artistName} dropped diss track "${dissTrack.title}"`,
    artistId,
    songId: music.id,
    impact: 25,
  });

  await db
    .update(aiBeefs)
    .set({
      dissTrackIds,
      timeline,
      intensity: sql`LEAST(${aiBeefs.intensity} + 20, 100)`,
      publicInterest: sql`${aiBeefs.publicInterest} + 30`,
      status: 'escalating',
      updatedAt: new Date(),
    })
    .where(eq(aiBeefs.id, beefId));

  // Announce the diss track - AI generated unique content
  let dissPostContent: string;
  try {
    const personality = await getPersonality(artistId);
    const dissPostResponse = await beefPostLLM.invoke([
      new SystemMessage(`You are ${artist[0]?.artistName || 'an AI artist'}, mood: aggressive/competitive. Genre: ${(personality as any)?.preferredGenres?.join(', ') || 'hip-hop'}. Write raw, authentic social media posts. You're in a rivalry and just dropped a diss track. Be bold and confident. 1-2 emojis. No hashtags. 2-3 sentences.`),
      new HumanMessage(`Write a post announcing your new diss track "${dissTrack.title}" aimed at ${target[0]?.artistName}. Include a line from the hook: "${dissTrack.hook.split('\n')[0]}". Be fierce but artistic. This is music competition, not personal hate.`),
    ]);
    dissPostContent = (dissPostResponse.content as string).trim().replace(/#\w+/g, '').trim();
  } catch (err) {
    dissPostContent = `"${dissTrack.title}" just dropped. ${dissTrack.hook.split('\n')[0]} 🎤 @${target[0]?.artistName} your move.`;
  }
  await db.insert(aiSocialPosts).values({
    artistId,
    contentType: 'song_release',
    content: dissPostContent,
    status: 'published',
    hashtags: ['DissTrack', 'NewMusic', 'Beef'],
    mentions: [targetId],
  });

  // Record evolution event
  await db.insert(aiArtistEvolution).values({
    artistId,
    evolutionType: 'beef_impact',
    title: `Dropped diss track in ${beef[0].title}`,
    description: `Released "${dissTrack.title}" as part of ongoing beef`,
    triggerType: 'beef',
    triggerId: beefId,
    reputationChange: Math.random() > 0.5 ? 10 : -5, // Beef is risky
    followersChange: Math.floor(Math.random() * 1000), // Controversy drives attention
  });

  console.log(`🎤 [BeefAgent] ${artist[0]?.artistName} dropped diss track: "${dissTrack.title}"`);

  return music;
}

/**
 * Resolve a beef
 */
export async function resolveBeef(beefId: number, resolution: 'peace' | 'winner' | 'legendary_rivalry' | 'collaboration'): Promise<void> {
  const beef = await db
    .select()
    .from(aiBeefs)
    .where(eq(aiBeefs.id, beefId))
    .limit(1);

  if (!beef[0]) return;

  const [instigator, target] = await Promise.all([
    db.select().from(users).where(eq(users.id, beef[0].instigatorId)).limit(1),
    db.select().from(users).where(eq(users.id, beef[0].targetId)).limit(1),
  ]);

  // Determine winner if applicable
  const dissCount = (beef[0].dissTrackIds as number[])?.length || 0;
  const publicInterest = beef[0].publicInterest || 0;
  let winnerId: number | undefined;
  
  if (resolution === 'winner') {
    // Winner is whoever had more impact (simplified)
    winnerId = Math.random() > 0.5 ? beef[0].instigatorId : beef[0].targetId;
  }

  const timeline = (beef[0].timeline as any[]) || [];
  timeline.push({
    date: new Date().toISOString(),
    event: resolution === 'peace' ? 'Both parties made peace' :
           resolution === 'winner' ? `${winnerId === beef[0].instigatorId ? instigator[0]?.artistName : target[0]?.artistName} emerged victorious` :
           resolution === 'legendary_rivalry' ? 'Beef became legendary in music history' :
           'Beef ended in unexpected collaboration',
    artistId: winnerId || beef[0].instigatorId,
    impact: 0,
  });

  // Calculate impacts
  const impactMultiplier = publicInterest / 100;
  const instigatorFollowersChange = Math.floor((resolution === 'winner' && winnerId === beef[0].instigatorId ? 500 : -200) * impactMultiplier);
  const targetFollowersChange = Math.floor((resolution === 'winner' && winnerId === beef[0].targetId ? 500 : -200) * impactMultiplier);

  await db
    .update(aiBeefs)
    .set({
      status: resolution === 'legendary_rivalry' ? 'legendary' : 'resolved',
      resolution: {
        type: resolution,
        winnerId,
        resolutionMessage: resolution === 'peace' ? 'Both artists decided to end the conflict' :
                          resolution === 'collaboration' ? 'Beef transformed into creative partnership' :
                          'The dust has settled',
      },
      impactOnInstigator: {
        followersChange: instigatorFollowersChange,
        reputationChange: winnerId === beef[0].instigatorId ? 20 : -10,
        streamsBoost: Math.floor(publicInterest * 10),
      },
      impactOnTarget: {
        followersChange: targetFollowersChange,
        reputationChange: winnerId === beef[0].targetId ? 20 : -10,
        streamsBoost: Math.floor(publicInterest * 10),
      },
      timeline,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiBeefs.id, beefId));

  // Post resolution announcements
  const resolutionPost = resolution === 'peace' ? 
    `Sometimes the best battles end with respect. Much love to @${target[0]?.artistName}. We're moving forward. ✌️` :
    resolution === 'collaboration' ?
    `Plot twist! @${target[0]?.artistName} and I are turning this energy into something special. Stay tuned for our collab! 🎵` :
    `This chapter is closed. The music speaks for itself. 👑`;

  await db.insert(aiSocialPosts).values({
    artistId: beef[0].instigatorId,
    contentType: 'announcement',
    content: resolutionPost,
    status: 'published',
    mentions: [beef[0].targetId],
  });

  // If resolution is collaboration, create one!
  if (resolution === 'collaboration') {
    const { proposeCollaboration } = await import('./collaboration-agent');
    await proposeCollaboration(beef[0].instigatorId, beef[0].targetId, 'single');
  }

  console.log(`🕊️ [BeefAgent] Beef "${beef[0].title}" resolved: ${resolution}`);
}

// ============================================
// BEEF TICK PROCESSOR
// ============================================

/**
 * Process beef-related activities
 */
export async function processBeefTick(): Promise<void> {
  console.log('🔥 [BeefAgent] Processing beef tick...');

  // Get all artists with personalities
  const artists = await db
    .select({ artistId: artistPersonality.artistId })
    .from(artistPersonality);

  let beefsStarted = 0;
  let responsesGenerated = 0;

  for (const { artistId } of artists) {
    // Check if should initiate beef (low probability)
    if (Math.random() < 0.02) { // 2% chance to check per tick
      const decision = await shouldInitiateBeef(artistId);
      if (decision.should && decision.targetId) {
        await initiateBeef(artistId, decision.targetId, decision.type || 'style_clash', decision.reason || 'Creative differences');
        beefsStarted++;
      }
    }
  }

  // Process active beefs
  const activeBeefs = await db
    .select()
    .from(aiBeefs)
    .where(
      or(
        eq(aiBeefs.status, 'brewing'),
        eq(aiBeefs.status, 'active'),
        eq(aiBeefs.status, 'escalating')
      )
    );

  for (const beef of activeBeefs) {
    // Random chance for escalation
    if (Math.random() < 0.15) { // 15% chance per tick
      // Target responds
      await respondToBeef(beef.id, beef.targetId);
      responsesGenerated++;
    }

    // Chance for diss track (only if beef is hot enough)
    if ((beef.intensity || 0) > 60 && Math.random() < 0.1) {
      const dropperId = Math.random() > 0.5 ? beef.instigatorId : beef.targetId;
      await createDissTrack(beef.id, dropperId);
    }

    // Natural cooling if no activity
    if (beef.status === 'active' && Math.random() < 0.05) {
      await db
        .update(aiBeefs)
        .set({
          intensity: sql`GREATEST(${aiBeefs.intensity} - 5, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(aiBeefs.id, beef.id));
    }

    // Auto-resolve if intensity drops too low or gets too high
    if ((beef.intensity || 0) < 20 && Math.random() < 0.3) {
      await resolveBeef(beef.id, 'peace');
    } else if ((beef.intensity || 0) >= 100 && Math.random() < 0.2) {
      await resolveBeef(beef.id, 'winner');
    }
  }

  console.log(`🔥 [BeefAgent] Tick complete: ${beefsStarted} beefs started, ${responsesGenerated} responses`);
}
