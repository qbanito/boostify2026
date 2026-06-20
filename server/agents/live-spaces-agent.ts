/**
 * BOOSTIFY - Live Spaces Agent
 * 
 * "Audio rooms where AI artists host lives, audience agents participate"
 * 
 * This agent:
 * - Creates live audio rooms with AI artists as hosts
 * - Generates real-time conversation between AI artists
 * - Audience agents enter, ask questions, react
 * - Simulates a live audio experience
 */

import { db } from '../db';
import {
  liveRooms,
  liveChatMessages,
  users,
  artistPersonality,
  type InsertLiveRoom,
} from '../../db/schema';
import { eq, and, desc, sql, gt } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.9,
  maxTokens: 300,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const ROOM_TOPICS = [
  { type: 'discussion' as const, topics: [
    '¿El reggaeton está muerto o más vivo que nunca?',
    '¿Cuál es el mejor álbum del año?',
    'Top 5 productores que están cambiando la música',
    'IA vs artistas reales: ¿quién gana?',
    '¿Drake o Kendrick? El debate definitivo',
    'Los features más inesperados de la historia',
  ]},
  { type: 'listening_party' as const, topics: [
    '🎧 Listening party: Mi nuevo single',
    '🎵 Reaccionando a las nuevas releases',
    'Escuchando demos en vivo — opiniones cero filtro',
  ]},
  { type: 'ama' as const, topics: [
    'AMA: Pregúntame lo que quieras',
    'Behind the scenes de mi proceso creativo',
    'Respondiendo a los haters en vivo',
  ]},
  { type: 'beef_battle' as const, topics: [
    '⚔️ Debate en vivo: ¿Quién tiene mejor flow?',
    '🔥 Clash de estilos: Trap vs Reggaeton',
    'Cara a cara: Respondiendo a la controversia',
  ]},
  { type: 'freestyle' as const, topics: [
    '🎤 Freestyle session en vivo',
    'Improvisando sobre beats random',
  ]},
];

// ============================================
// ROOM CREATION
// ============================================

export async function createLiveRoom(): Promise<any | null> {
  try {
    // Pick a random AI artist as host
    const artists = await db
      .select({ 
        id: artistPersonality.artistId,
        mood: artistPersonality.currentMood,
      })
      .from(artistPersonality)
      .limit(20);

    if (artists.length === 0) return null;

    const hostIdx = Math.floor(Math.random() * artists.length);
    const host = artists[hostIdx];

    // Get host info
    const [hostUser] = await db
      .select({ id: users.id, artistName: users.artistName, genre: users.genre })
      .from(users)
      .where(eq(users.id, host.id));

    if (!hostUser) return null;

    // Pick random room type and topic
    const typeGroup = ROOM_TOPICS[Math.floor(Math.random() * ROOM_TOPICS.length)];
    const topic = typeGroup.topics[Math.floor(Math.random() * typeGroup.topics.length)];

    // Maybe pick a co-host
    const coHosts: number[] = [];
    if (typeGroup.type === 'beef_battle' || typeGroup.type === 'discussion' || Math.random() > 0.5) {
      const otherArtists = artists.filter(a => a.id !== host.id);
      if (otherArtists.length > 0) {
        coHosts.push(otherArtists[Math.floor(Math.random() * otherArtists.length)].id);
      }
    }

    const title = `${hostUser.artistName || 'Artist'} en VIVO`;

    const [room] = await db.insert(liveRooms).values({
      hostArtistId: host.id,
      title,
      topic,
      roomType: typeGroup.type,
      status: 'live',
      coHosts,
      currentListeners: Math.floor(Math.random() * 30) + 5,
      peakListeners: 0,
      transcript: [],
      highlightMoments: [],
      startedAt: new Date(),
    }).returning();

    // Generate opening messages
    await generateRoomMessages(room.id, host.id, coHosts, topic, typeGroup.type);

    console.log(`🎙️ [LiveSpaces] Created room: "${title}" - ${topic}`);
    return room;
  } catch (error) {
    console.error('❌ [LiveSpaces] Error creating room:', error);
    return null;
  }
}

// ============================================
// MESSAGE GENERATION
// ============================================

async function generateRoomMessages(
  roomId: number,
  hostId: number,
  coHosts: number[],
  topic: string,
  roomType: string
): Promise<void> {
  try {
    // Get all speakers
    const speakerIds = [hostId, ...coHosts];
    const speakers: Array<{ id: number; name: string; personality?: any }> = [];
    
    for (const id of speakerIds) {
      const [user] = await db
        .select({ id: users.id, artistName: users.artistName })
        .from(users)
        .where(eq(users.id, id));
      
      const [personality] = await db
        .select()
        .from(artistPersonality)
        .where(eq(artistPersonality.artistId, id));

      if (user) {
        speakers.push({ 
          id, 
          name: user.artistName || `Artist_${id}`,
          personality: personality || null 
        });
      }
    }

    if (speakers.length === 0) return;

    // System message
    await db.insert(liveChatMessages).values({
      roomId,
      userId: hostId,
      message: `🔴 EN VIVO: ${speakers[0].name} inició un Space — "${topic}"`,
      messageType: 'system',
      isAI: true,
    });

    // Host opening
    const hostName = speakers[0].name;
    const openingPrompt = `Eres ${hostName}, un artista de música urbana/pop en un Twitter Space en vivo.
Tema: "${topic}". Tipo: ${roomType}.
Di algo para abrir el Space — saluda, presenta el tema. 1-2 oraciones cortas, estilo casual, con emojis. Solo el texto.`;

    try {
      const hostOpening = await llm.invoke([new HumanMessage(openingPrompt)]);
      const msg = typeof hostOpening.content === 'string' ? hostOpening.content.trim() : '';
      
      await db.insert(liveChatMessages).values({
        roomId, userId: hostId,
        message: msg || `¡Qué onda familia! Bienvenidos al Space 🔥 Hoy hablamos de: ${topic}`,
        messageType: 'chat',
        isAI: true,
      });
    } catch {
      await db.insert(liveChatMessages).values({
        roomId, userId: hostId,
        message: `¡Qué onda! Arrancamos este Space 🎙️ Tema de hoy: ${topic}`,
        messageType: 'chat',
        isAI: true,
      });
    }

    // Co-host response
    if (speakers.length > 1) {
      const coHostName = speakers[1].name;
      try {
        const coPrompt = `Eres ${coHostName} en un Twitter Space con ${hostName}. Tema: "${topic}".
Responde al host brevemente. 1 oración casual con emoji. Solo el texto.`;
        const coResponse = await llm.invoke([new HumanMessage(coPrompt)]);
        const coMsg = typeof coResponse.content === 'string' ? coResponse.content.trim() : '';
        
        await db.insert(liveChatMessages).values({
          roomId, userId: speakers[1].id,
          message: coMsg || `¡Presente! Este tema está buenísimo 🔥`,
          messageType: 'chat',
          isAI: true,
        });
      } catch {
        await db.insert(liveChatMessages).values({
          roomId, userId: speakers[1].id,
          message: `¡Qué honor estar aquí! Vamos a darle 💪`,
          messageType: 'chat',
          isAI: true,
        });
      }
    }

    // Simulate some audience chats
    const audienceMessages = [
      '🔥🔥🔥', 'W Space!!', 'lets gooo', 'finally!!', 'hablamos de eso 👀',
      'real talk 💯', 'me encanta esto', 'facts', 'primo esto es fuego',
      'el host tiene razón tbh', 'yo pienso diferente...', 'GOAT 🐐',
    ];

    const numAudienceMessages = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < numAudienceMessages; i++) {
      const msg = audienceMessages[Math.floor(Math.random() * audienceMessages.length)];
      await db.insert(liveChatMessages).values({
        roomId,
        userId: hostId, // placeholder
        message: msg,
        messageType: 'reaction',
        isAI: true,
      });
    }
  } catch (error) {
    console.error('❌ [LiveSpaces] Error generating messages:', error);
  }
}

/**
 * Add a new message to an active room
 */
export async function addLiveMessage(
  roomId: number, 
  userId: number, 
  message: string,
  isAI: boolean = false,
  messageType: string = 'chat'
): Promise<void> {
  await db.insert(liveChatMessages).values({
    roomId, userId, message,
    messageType: messageType as any,
    isAI,
  });

  // Update listener count
  await db.update(liveRooms)
    .set({ 
      currentListeners: sql`${liveRooms.currentListeners} + 1`,
      peakListeners: sql`GREATEST(${liveRooms.peakListeners}, ${liveRooms.currentListeners} + 1)`,
    })
    .where(eq(liveRooms.id, roomId));
}

/**
 * Generate AI response in an active room
 */
export async function generateAIResponse(roomId: number): Promise<string | null> {
  try {
    const [room] = await db
      .select()
      .from(liveRooms)
      .where(eq(liveRooms.id, roomId));

    if (!room || room.status !== 'live') return null;

    // Get recent messages for context
    const recentMessages = await db
      .select()
      .from(liveChatMessages)
      .where(eq(liveChatMessages.roomId, roomId))
      .orderBy(desc(liveChatMessages.createdAt))
      .limit(10);

    const [host] = await db
      .select({ artistName: users.artistName })
      .from(users)
      .where(eq(users.id, room.hostArtistId));

    const hostName = host?.artistName || 'Host';
    const context = recentMessages.reverse().map(m => m.message).join('\n');

    const prompt = `Eres ${hostName} en un Space en vivo. Tema: "${room.topic}".
Conversación reciente:
${context}

Continúa la conversación de forma natural. 1-2 oraciones. Casual, con emojis. Solo el texto.`;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const msg = typeof response.content === 'string' ? response.content.trim() : '';

    if (msg) {
      await db.insert(liveChatMessages).values({
        roomId,
        userId: room.hostArtistId,
        message: msg,
        messageType: 'chat',
        isAI: true,
      });
    }

    return msg;
  } catch (error) {
    console.error('❌ [LiveSpaces] Error generating AI response:', error);
    return null;
  }
}

// ============================================
// QUERIES
// ============================================

export async function getActiveRooms(): Promise<any[]> {
  try {
    const rooms = await db
      .select()
      .from(liveRooms)
      .where(eq(liveRooms.status, 'live'))
      .orderBy(desc(liveRooms.startedAt));

    // Enrich with host info
    const enriched = [];
    for (const room of rooms) {
      const [host] = await db
        .select({ id: users.id, artistName: users.artistName, profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.id, room.hostArtistId));

      enriched.push({
        ...room,
        host: host || { id: room.hostArtistId, artistName: 'Unknown' },
      });
    }
    return enriched;
  } catch {
    return [];
  }
}

export async function getRoomMessages(roomId: number, limit: number = 50): Promise<any[]> {
  try {
    const messages = await db
      .select()
      .from(liveChatMessages)
      .where(eq(liveChatMessages.roomId, roomId))
      .orderBy(liveChatMessages.createdAt)
      .limit(limit);

    // Enrich with user info
    const enriched = [];
    for (const msg of messages) {
      const [user] = await db
        .select({ id: users.id, artistName: users.artistName, username: users.username, profileImageUrl: users.profileImageUrl })
        .from(users)
        .where(eq(users.id, msg.userId));

      enriched.push({
        ...msg,
        user: user || { id: msg.userId, artistName: 'Listener' },
      });
    }
    return enriched;
  } catch {
    return [];
  }
}

export async function endRoom(roomId: number): Promise<void> {
  await db.update(liveRooms)
    .set({ status: 'ended', endedAt: new Date() })
    .where(eq(liveRooms.id, roomId));
}

// ============================================
// LIVE SPACES TICK
// ============================================

export async function processLiveSpacesTick(): Promise<void> {
  console.log('🎙️ [LiveSpaces] Processing tick...');

  // End rooms older than 30 minutes
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  await db.update(liveRooms)
    .set({ status: 'ended', endedAt: new Date() })
    .where(and(
      eq(liveRooms.status, 'live'),
      sql`${liveRooms.startedAt} < ${thirtyMinAgo}`
    ));

  // Check if we need a new room (max 2 active at a time)
  const activeRooms = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(liveRooms)
    .where(eq(liveRooms.status, 'live'));

  const activeCount = activeRooms[0]?.count || 0;

  if (activeCount < 2 && Math.random() > 0.4) {
    await createLiveRoom();
  }

  // Generate new AI messages in active rooms
  const rooms = await db
    .select()
    .from(liveRooms)
    .where(eq(liveRooms.status, 'live'));

  for (const room of rooms) {
    if (Math.random() > 0.3) {
      await generateAIResponse(room.id);
    }
  }

  console.log(`🎙️ [LiveSpaces] Tick complete: ${rooms.length} active rooms`);
}
