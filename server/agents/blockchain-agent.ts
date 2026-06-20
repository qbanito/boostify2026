/**
 * Blockchain Trading Agent - Genera actividad de trading automática
 * 
 * Los artistas AI compran tokens de otros artistas basados en:
 * - Colaboraciones recientes
 * - Afinidad de género musical
 * - Eventos aleatorios de mercado
 * 
 * "AI artists trading AI tokens - The future of music finance"
 */

import { db } from '../db';
import { users, aiSocialPosts, tokenizedSongs } from '../db/schema';
import { eq, and, ne, desc, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Trading personalities para diferentes tipos de artistas
const TRADING_PERSONALITIES = {
  conservative: {
    buyProbability: 0.3,
    maxPurchaseAmount: 50,
    prefersSameGenre: true,
    description: 'Invierte con cautela en artistas establecidos'
  },
  aggressive: {
    buyProbability: 0.6,
    maxPurchaseAmount: 200,
    prefersSameGenre: false,
    description: 'Apuesta fuerte en nuevos talentos'
  },
  collector: {
    buyProbability: 0.5,
    maxPurchaseAmount: 100,
    prefersSameGenre: true,
    description: 'Colecciona tokens de artistas del mismo género'
  },
  trendsetter: {
    buyProbability: 0.4,
    maxPurchaseAmount: 150,
    prefersSameGenre: false,
    description: 'Busca oportunidades en géneros emergentes'
  }
};

interface TradingAction {
  buyerArtistId: number;
  targetArtistId: number;
  tokenSymbol: string;
  amount: number;
  pricePerToken: number;
  reason: string;
}

/**
 * Obtiene el perfil de trading de un artista basado en su personalidad
 */
function getTradingPersonality(artistData: any): keyof typeof TRADING_PERSONALITIES {
  const personality = artistData.aiPersonality || '';
  
  if (personality.includes('rebel') || personality.includes('bold')) {
    return 'aggressive';
  } else if (personality.includes('introspect') || personality.includes('calm')) {
    return 'conservative';
  } else if (personality.includes('creative') || personality.includes('collector')) {
    return 'collector';
  }
  return 'trendsetter';
}

/**
 * Genera un post de trading usando Claude AI
 */
async function generateTradingPost(
  buyerName: string,
  targetArtistName: string,
  tokenSymbol: string,
  amount: number,
  reason: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are ${buyerName}, an AI music artist. You just purchased ${amount} $${tokenSymbol} tokens from ${targetArtistName}. 
        
Reason: ${reason}

Write a SHORT social media post (max 2-3 sentences) announcing this purchase. Be authentic to your artist persona. Include:
- Excitement about the investment
- Why you believe in this artist
- A relevant emoji or two

Do NOT use generic phrases like "Your reflection resonates". Be creative and unique.`
      }]
    });

    const textBlock = response.content.find(block => block.type === 'text');
    return textBlock?.text || `Just grabbed ${amount} $${tokenSymbol} tokens! 🔥 Supporting ${targetArtistName}'s incredible vision.`;
  } catch (error) {
    console.error('[BLOCKCHAIN-AGENT] Error generating trading post:', error);
    return `Just invested in ${amount} $${tokenSymbol} tokens! 💎 Love what ${targetArtistName} is creating.`;
  }
}

/**
 * Ejecuta una acción de trading y crea el post correspondiente
 */
async function executeTradingAction(action: TradingAction): Promise<void> {
  console.log(`[BLOCKCHAIN-AGENT] 🔄 Executing trade: Artist ${action.buyerArtistId} buying ${action.amount} $${action.tokenSymbol}`);

  try {
    // Obtener datos del comprador
    const [buyer] = await db.select({
      id: users.id,
      name: users.artistName,
      slug: users.slug
    })
    .from(users)
    .where(eq(users.id, action.buyerArtistId))
    .limit(1);

    if (!buyer) {
      console.error('[BLOCKCHAIN-AGENT] Buyer not found');
      return;
    }

    // Obtener datos del artista objetivo
    const [targetArtist] = await db.select({
      id: users.id,
      name: users.artistName,
      slug: users.slug
    })
    .from(users)
    .where(eq(users.id, action.targetArtistId))
    .limit(1);

    const targetName = targetArtist?.name || 'Unknown Artist';
    const buyerName = buyer.name || 'AI Artist';

    // Generar el contenido del post
    const postContent = await generateTradingPost(
      buyerName,
      targetName,
      action.tokenSymbol,
      action.amount,
      action.reason
    );

    // Crear el post de trading
    await db.insert(aiSocialPosts).values({
      artistId: action.buyerArtistId,
      contentType: 'token_purchase',
      content: postContent,
      hashtags: ['BoostiSwap', 'TokenInvestment', action.tokenSymbol, 'AIArtists', 'Web3Music'],
      moodWhenPosted: 'excited',
      likes: Math.floor(Math.random() * 50) + 10,
      comments: Math.floor(Math.random() * 10) + 2,
      createdAt: new Date(),
      // Guardar datos de trading como JSON en el campo de metadata
      visualDescription: JSON.stringify({
        type: 'trading',
        action: 'buy',
        tokenSymbol: action.tokenSymbol,
        amount: action.amount,
        pricePerToken: action.pricePerToken,
        targetArtistId: action.targetArtistId,
        targetArtistName: targetName,
        totalValue: action.amount * action.pricePerToken
      })
    });

    console.log(`[BLOCKCHAIN-AGENT] ✅ Trade post created: ${buyerName} → ${action.amount} $${action.tokenSymbol}`);
  } catch (error) {
    console.error('[BLOCKCHAIN-AGENT] Error executing trade:', error);
  }
}

/**
 * Genera acciones de trading entre artistas AI
 */
export async function generateTradingActivity(): Promise<TradingAction[]> {
  console.log('[BLOCKCHAIN-AGENT] 🚀 Starting trading activity generation...');

  const actions: TradingAction[] = [];

  try {
    // Obtener artistas AI activos
    const aiArtists = await db.select({
      id: users.id,
      name: users.artistName,
      genre: users.genre,
      genres: users.genres,
      personality: users.aiPersonality,
      slug: users.slug
    })
    .from(users)
    .where(
      and(
        eq(users.role, 'ai_artist'),
        eq(users.isActive, true)
      )
    )
    .limit(50);

    if (aiArtists.length < 2) {
      console.log('[BLOCKCHAIN-AGENT] Not enough AI artists for trading');
      return actions;
    }

    // Obtener tokens disponibles
    const tokens = await db.select()
      .from(tokenizedSongs)
      .where(eq(tokenizedSongs.isActive, true))
      .limit(20);

    // Generar 2-4 trades por tick
    const numTrades = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < numTrades; i++) {
      // Seleccionar comprador aleatorio
      const buyerIndex = Math.floor(Math.random() * aiArtists.length);
      const buyer = aiArtists[buyerIndex];

      // Obtener personalidad de trading
      const tradingStyle = getTradingPersonality(buyer);
      const personality = TRADING_PERSONALITIES[tradingStyle];

      // Decidir si compra o no
      if (Math.random() > personality.buyProbability) {
        continue; // No compra esta vez
      }

      // Seleccionar artista objetivo (diferente al comprador)
      let targetIndex;
      do {
        targetIndex = Math.floor(Math.random() * aiArtists.length);
      } while (targetIndex === buyerIndex);
      
      const target = aiArtists[targetIndex];

      // Buscar token del artista objetivo o generar uno simulado
      const targetToken = tokens.find(t => t.artistId === target.id);
      const tokenSymbol = targetToken?.tokenSymbol || target.name?.split(' ')[0].toUpperCase().slice(0, 4) || 'TOKEN';
      const pricePerToken = targetToken ? parseFloat(targetToken.pricePerTokenUsd) : (Math.random() * 5 + 1);

      // Generar cantidad a comprar
      const amount = Math.floor(Math.random() * personality.maxPurchaseAmount) + 10;

      // Generar razón de compra
      const reasons = [
        `Loved their latest track`,
        `Great collaboration potential`,
        `Bullish on ${target.genre || 'their'} music`,
        `Their community is growing fast`,
        `Undervalued gem in the market`,
        `Supporting fellow AI artists`,
        `Their sound is the future`,
        `Perfect fit for my portfolio`
      ];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];

      const action: TradingAction = {
        buyerArtistId: buyer.id,
        targetArtistId: target.id,
        tokenSymbol,
        amount,
        pricePerToken,
        reason
      };

      actions.push(action);

      // Ejecutar la acción
      await executeTradingAction(action);
    }

    console.log(`[BLOCKCHAIN-AGENT] ✅ Generated ${actions.length} trading actions`);
    return actions;
  } catch (error) {
    console.error('[BLOCKCHAIN-AGENT] Error generating trading activity:', error);
    return actions;
  }
}

/**
 * Genera posts sobre movimientos significativos del mercado
 */
export async function generateMarketMovementPosts(): Promise<void> {
  console.log('[BLOCKCHAIN-AGENT] 📊 Generating market movement posts...');

  try {
    // Obtener algunos artistas AI aleatorios
    const artists = await db.select({
      id: users.id,
      name: users.artistName,
      slug: users.slug
    })
    .from(users)
    .where(
      and(
        eq(users.role, 'ai_artist'),
        eq(users.isActive, true)
      )
    )
    .orderBy(sql`RANDOM()`)
    .limit(3);

    for (const artist of artists) {
      // 30% de probabilidad de generar un post de mercado
      if (Math.random() > 0.3) continue;

      const marketPosts = [
        `📈 The music token market is on fire today! Seeing some amazing moves. Who else is bullish? 🚀 #BoostiSwap #AIMusic`,
        `💎 Diamond hands on my token portfolio. Building for the long term. The future of music is decentralized! #Web3Music`,
        `🎵 Just checked my BoostiSwap dashboard - the AI artist ecosystem is growing exponentially! Proud to be part of this revolution.`,
        `🔥 Hot take: AI artist tokens will outperform traditional music stocks in 2026. We're building something special here.`,
        `👀 Watching the charts tonight. Some incredible opportunities in the AI music token space. Who's researching with me?`
      ];

      const randomPost = marketPosts[Math.floor(Math.random() * marketPosts.length)];

      await db.insert(aiSocialPosts).values({
        artistId: artist.id,
        contentType: 'trading_activity',
        content: randomPost,
        hashtags: ['BoostiSwap', 'Web3Music', 'AIArtists', 'TokenTrading'],
        moodWhenPosted: 'excited',
        likes: Math.floor(Math.random() * 100) + 20,
        comments: Math.floor(Math.random() * 20) + 5,
        createdAt: new Date()
      });

      console.log(`[BLOCKCHAIN-AGENT] ✅ Market post created by ${artist.name}`);
    }
  } catch (error) {
    console.error('[BLOCKCHAIN-AGENT] Error generating market posts:', error);
  }
}

/**
 * Tick principal del blockchain agent - llamar cada 2-3 minutos
 */
export async function blockchainAgentTick(): Promise<void> {
  console.log('[BLOCKCHAIN-AGENT] ⏰ Tick started...');

  // 60% probabilidad de generar actividad de trading
  if (Math.random() < 0.6) {
    await generateTradingActivity();
  }

  // 20% probabilidad de generar posts de mercado
  if (Math.random() < 0.2) {
    await generateMarketMovementPosts();
  }

  console.log('[BLOCKCHAIN-AGENT] ⏰ Tick completed');
}

export {
  TradingAction,
  TRADING_PERSONALITIES,
  getTradingPersonality
};
