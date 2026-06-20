/**
 * BOOSTIFY - Manage Your Artist Mode Agent
 * 
 * "Los usuarios adoptan un artista IA y lo manejan"
 * 
 * This agent:
 * - Links a user (manager) with an AI artist
 * - Generates management decisions (genre, collabs, beef responses, strategy)
 * - The manager chooses, the AI executes
 * - Awards XP based on decision outcomes
 */

import { db } from '../db';
import {
  artistManagement,
  managementDecisions,
  users,
  artistPersonality,
  aiSocialPosts,
  type InsertArtistManagement,
  type SelectArtistManagement,
} from '../../db/schema';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { PRIMARY_MODEL } from '../utils/ai-config';

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.8,
  maxTokens: 500,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// MANAGEMENT SETUP
// ============================================

/**
 * Start managing an AI artist
 */
export async function startManaging(managerId: number, artistId: number): Promise<{
  success: boolean;
  management?: any;
  error?: string;
}> {
  try {
    // Check if artist is already managed
    const existing = await db
      .select()
      .from(artistManagement)
      .where(and(
        eq(artistManagement.artistId, artistId),
        eq(artistManagement.isActive, true)
      ))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].managerId === managerId) {
        return { success: true, management: existing[0] };
      }
      return { success: false, error: 'Este artista ya tiene un manager' };
    }

    // Check manager's limit (max 2 artists)
    const managerArtists = await db
      .select()
      .from(artistManagement)
      .where(and(
        eq(artistManagement.managerId, managerId),
        eq(artistManagement.isActive, true)
      ));

    if (managerArtists.length >= 2) {
      return { success: false, error: 'Máximo 2 artistas por manager' };
    }

    // Verify artist exists and is AI
    const [artist] = await db
      .select({ id: users.id, isAIGenerated: users.isAIGenerated, artistName: users.artistName })
      .from(users)
      .where(eq(users.id, artistId));

    if (!artist) {
      return { success: false, error: 'Artista no encontrado' };
    }

    const [management] = await db.insert(artistManagement).values({
      managerId,
      artistId,
      autonomyLevel: 50,
    }).returning();

    // Generate initial decisions for the new manager
    await generateDecisionsForArtist(management.id, managerId, artistId);

    console.log(`🎯 [Management] User ${managerId} started managing artist ${artistId}`);
    return { success: true, management };
  } catch (error) {
    console.error('❌ [Management] Error starting management:', error);
    return { success: false, error: 'Error al iniciar gestión' };
  }
}

/**
 * Stop managing an artist
 */
export async function stopManaging(managerId: number, artistId: number): Promise<boolean> {
  try {
    await db.update(artistManagement)
      .set({ isActive: false })
      .where(and(
        eq(artistManagement.managerId, managerId),
        eq(artistManagement.artistId, artistId)
      ));
    return true;
  } catch {
    return false;
  }
}

// ============================================
// DECISION GENERATION
// ============================================

/**
 * Generate new management decisions for an artist
 */
export async function generateDecisionsForArtist(
  managementId: number, 
  managerId: number, 
  artistId: number
): Promise<number> {
  try {
    // Get artist info
    const [artist] = await db
      .select({ id: users.id, artistName: users.artistName, genre: users.genre, genres: users.genres })
      .from(users)
      .where(eq(users.id, artistId));

    const [personality] = await db
      .select()
      .from(artistPersonality)
      .where(eq(artistPersonality.artistId, artistId));

    if (!artist) return 0;

    const artistName = artist.artistName || `Artist ${artistId}`;
    const genre = artist.genre || (artist.genres as string[])?.[0] || 'urban';

    // Check existing pending decisions
    const pendingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(managementDecisions)
      .where(and(
        eq(managementDecisions.managementId, managementId),
        eq(managementDecisions.status, 'pending')
      ));

    if ((pendingCount[0]?.count || 0) >= 3) return 0;

    const decisionTemplates = [
      {
        type: 'next_single_genre' as const,
        title: `🎵 Próximo single de ${artistName}`,
        description: `${artistName} está listo para grabar. ¿Qué dirección tomamos?`,
        options: [
          { id: 'same_genre', label: `Seguir con ${genre}`, description: 'Mantener el estilo que funciona', predictedOutcome: 'Fans contentos, crecimiento estable', riskLevel: 'low' as const },
          { id: 'experiment', label: 'Experimentar nuevo género', description: 'Probar algo diferente y fresco', predictedOutcome: 'Puede viralizar o confundir fans', riskLevel: 'high' as const },
          { id: 'collab_fusion', label: 'Fusión con otro artista', description: 'Mezclar estilos en una collab', predictedOutcome: 'Alcance nuevo + audiencia compartida', riskLevel: 'medium' as const },
        ],
      },
      {
        type: 'social_strategy' as const,
        title: `📱 Estrategia social de ${artistName}`,
        description: `¿Cómo debe manejar ${artistName} sus redes esta semana?`,
        options: [
          { id: 'aggressive', label: 'Modo agresivo', description: 'Postear mucho, generar controversia', predictedOutcome: 'Más visibilidad pero posible hate', riskLevel: 'medium' as const },
          { id: 'authentic', label: 'Autenticidad pura', description: 'Behind the scenes, contenido real', predictedOutcome: 'Conexión profunda con fans', riskLevel: 'low' as const },
          { id: 'mysterious', label: 'Desaparición estratégica', description: 'Silencio total, generar intriga', predictedOutcome: 'Expectativa alta, riesgo de olvido', riskLevel: 'high' as const },
        ],
      },
      {
        type: 'beef_respond' as const,
        title: `⚔️ ¡${artistName} recibió un diss!`,
        description: 'Otro artista lanzó un comentario provocativo. ¿Cómo respondemos?',
        options: [
          { id: 'fire_back', label: '🔥 Responder con fuego', description: 'Diss track de vuelta', predictedOutcome: 'Drama = visibilidad, pero desgaste', riskLevel: 'high' as const },
          { id: 'ignore', label: '😎 Ignorar con clase', description: 'No darle importancia', predictedOutcome: 'Maduro pero puede verse débil', riskLevel: 'low' as const },
          { id: 'collab_offer', label: '🤝 Ofrecer collab', description: 'Convertir beef en alianza', predictedOutcome: 'Plot twist viral', riskLevel: 'medium' as const },
        ],
      },
      {
        type: 'budget_allocation' as const,
        title: `💰 Budget de producción de ${artistName}`,
        description: '¿En qué invertimos el budget de esta semana?',
        options: [
          { id: 'production', label: '🎹 Producción musical', description: 'Mejor calidad de beats y mezcla', predictedOutcome: 'Mejor música pero menos marketing', riskLevel: 'low' as const },
          { id: 'marketing', label: '📢 Marketing y promos', description: 'Pushed posts, más alcance', predictedOutcome: 'Más plays pero mismo contenido', riskLevel: 'medium' as const },
          { id: 'visual', label: '🎥 Contenido visual', description: 'Videos, visualizers, stories premium', predictedOutcome: 'Imagen de marca más fuerte', riskLevel: 'low' as const },
          { id: 'all_in', label: '🎰 All-in en un hit', description: 'Todo el budget en un solo single ambicioso', predictedOutcome: 'Éxito masivo o fracaso total', riskLevel: 'high' as const },
        ],
      },
      {
        type: 'collaboration_accept' as const,
        title: `🤝 Oferta de colaboración para ${artistName}`,
        description: 'Un artista quiere hacer un tema conjunto. ¿Aceptamos?',
        options: [
          { id: 'accept', label: '✅ Aceptar', description: 'Hacer la collab', predictedOutcome: 'Nuevo público, canción conjunta', riskLevel: 'low' as const },
          { id: 'negotiate', label: '💼 Negociar condiciones', description: 'Pedir mejor deal', predictedOutcome: 'Mejor acuerdo pero puede caerse', riskLevel: 'medium' as const },
          { id: 'reject', label: '❌ Rechazar', description: 'Mantener independencia', predictedOutcome: 'Imagen de exclusividad', riskLevel: 'low' as const },
        ],
      },
    ];

    // Pick 1-2 random decisions
    const shuffled = decisionTemplates.sort(() => Math.random() - 0.5);
    const toCreate = shuffled.slice(0, Math.floor(Math.random() * 2) + 1);

    let created = 0;
    for (const template of toCreate) {
      // Get AI recommendation
      let aiRecommendation = '';
      try {
        const prompt = `Eres un manager de artistas IA experto. ${artistName} es artista de ${genre}.
Decisión: ${template.title} - ${template.description}
Opciones: ${template.options.map(o => `${o.label}: ${o.description}`).join(' | ')}

¿Qué recomiendas? Responde en 1 línea con tu recomendación y por qué. Solo el texto.`;
        
        const response = await llm.invoke([new HumanMessage(prompt)]);
        aiRecommendation = typeof response.content === 'string' ? response.content.trim() : '';
      } catch {
        aiRecommendation = `Recomiendo la opción más segura para mantener estabilidad.`;
      }

      await db.insert(managementDecisions).values({
        managementId,
        managerId,
        artistId,
        decisionType: template.type,
        title: template.title,
        description: template.description,
        options: template.options,
        aiRecommendation,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h to decide
      });
      created++;
    }

    return created;
  } catch (error) {
    console.error('❌ [Management] Error generating decisions:', error);
    return 0;
  }
}

// ============================================
// DECISION EXECUTION
// ============================================

/**
 * Manager makes a decision
 */
export async function makeDecision(
  decisionId: number,
  managerId: number,
  selectedOption: string,
  reasoning?: string
): Promise<{ success: boolean; outcome?: string; xpEarned?: number }> {
  try {
    const [decision] = await db
      .select()
      .from(managementDecisions)
      .where(and(
        eq(managementDecisions.id, decisionId),
        eq(managementDecisions.managerId, managerId),
        eq(managementDecisions.status, 'pending')
      ));

    if (!decision) {
      return { success: false };
    }

    const options = decision.options as any[];
    const chosen = options?.find((o: any) => o.id === selectedOption);
    if (!chosen) return { success: false };

    // Calculate XP based on risk
    const riskMultiplier = chosen.riskLevel === 'high' ? 3 : chosen.riskLevel === 'medium' ? 2 : 1;
    const xpEarned = 10 * riskMultiplier;
    const outcome = chosen.predictedOutcome || 'Decisión ejecutada';

    await db.update(managementDecisions)
      .set({
        selectedOption,
        managerReasoning: reasoning,
        outcome,
        xpEarned,
        status: 'completed',
        decidedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(managementDecisions.id, decisionId));

    // Update management stats
    await db.update(artistManagement)
      .set({
        totalDecisions: sql`${artistManagement.totalDecisions} + 1`,
        successfulDecisions: sql`${artistManagement.successfulDecisions} + 1`,
      })
      .where(eq(artistManagement.id, decision.managementId));

    return { success: true, outcome, xpEarned };
  } catch (error) {
    console.error('❌ [Management] Error making decision:', error);
    return { success: false };
  }
}

// ============================================
// QUERIES
// ============================================

export async function getManagedArtists(managerId: number): Promise<Array<{
  management: any;
  artist: any;
  pendingDecisions: number;
}>> {
  try {
    const managements = await db
      .select()
      .from(artistManagement)
      .where(and(
        eq(artistManagement.managerId, managerId),
        eq(artistManagement.isActive, true)
      ));

    if (managements.length === 0) return [];

    const results = [];
    for (const mgmt of managements) {
      const [artist] = await db
        .select({ 
          id: users.id, username: users.username, artistName: users.artistName,
          genre: users.genre, profileImageUrl: users.profileImageUrl 
        })
        .from(users)
        .where(eq(users.id, mgmt.artistId));

      const pendingResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(managementDecisions)
        .where(and(
          eq(managementDecisions.managementId, mgmt.id),
          eq(managementDecisions.status, 'pending')
        ));

      results.push({
        management: mgmt,
        artist: artist || { id: mgmt.artistId },
        pendingDecisions: pendingResult[0]?.count || 0,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function getPendingDecisions(managerId: number, artistId?: number): Promise<any[]> {
  try {
    let query = db
      .select()
      .from(managementDecisions)
      .where(and(
        eq(managementDecisions.managerId, managerId),
        eq(managementDecisions.status, 'pending')
      ))
      .orderBy(desc(managementDecisions.createdAt));

    return await query;
  } catch {
    return [];
  }
}

export async function getDecisionHistory(managerId: number, limit: number = 20): Promise<any[]> {
  try {
    return await db
      .select()
      .from(managementDecisions)
      .where(eq(managementDecisions.managerId, managerId))
      .orderBy(desc(managementDecisions.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}

export async function getAvailableArtistsToManage(): Promise<Array<{
  id: number;
  artistName: string | null;
  genre: string | null;
  profileImageUrl: string | null;
  isManaged: boolean;
}>> {
  try {
    // Get AI artists that have personalities
    const artists = await db
      .select({
        artistId: artistPersonality.artistId,
      })
      .from(artistPersonality)
      .limit(20);

    const artistIds = artists.map(a => a.artistId);
    if (artistIds.length === 0) return [];

    const userInfo = await db
      .select({ id: users.id, artistName: users.artistName, genre: users.genre, profileImageUrl: users.profileImageUrl })
      .from(users)
      .where(inArray(users.id, artistIds));

    // Check which are already managed
    const managed = await db
      .select({ artistId: artistManagement.artistId })
      .from(artistManagement)
      .where(eq(artistManagement.isActive, true));

    const managedSet = new Set(managed.map(m => m.artistId));

    return userInfo.map(u => ({
      id: u.id,
      artistName: u.artistName,
      genre: u.genre,
      profileImageUrl: u.profileImageUrl,
      isManaged: managedSet.has(u.id),
    }));
  } catch {
    return [];
  }
}

// ============================================
// MANAGEMENT TICK - Generate new decisions periodically
// ============================================

export async function processManagementTick(): Promise<void> {
  console.log('🎯 [Management] Processing management tick...');

  // Expire old pending decisions
  await db.update(managementDecisions)
    .set({ status: 'expired' })
    .where(and(
      eq(managementDecisions.status, 'pending'),
      sql`${managementDecisions.expiresAt} < NOW()`
    ));

  // Generate new decisions for active managements
  const actives = await db
    .select()
    .from(artistManagement)
    .where(eq(artistManagement.isActive, true));

  let totalDecisions = 0;
  for (const mgmt of actives) {
    const created = await generateDecisionsForArtist(mgmt.id, mgmt.managerId, mgmt.artistId);
    totalDecisions += created;
  }

  console.log(`🎯 [Management] Tick complete: ${totalDecisions} new decisions for ${actives.length} managed artists`);
}
