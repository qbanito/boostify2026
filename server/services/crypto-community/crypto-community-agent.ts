/**
 * CRYPTO COMMUNITY — Agent Service
 * Orchestrates community management: auto-posting, proposals, price alerts
 * Integrates with BoostiSwap token data and Economic Engine events
 */

import { db } from '../../db';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  cryptoCommunityConfigs,
  cryptoCommunityPosts,
  cryptoCommunityProposals,
  cryptoCommunityMembers,
  cryptoCommunityVotes,
} from '../../../db/crypto-community-schema';
import { tokenizedSongs } from '../../db/schema';
import { ArtistChannelBroadcaster, ArtistChannelConfig } from './channel-adapters';
import { getCryptoContentGenerator } from './content-generator';

export class CryptoCommunityAgent {

  // ── Config Management ──

  async getConfig(artistId: number) {
    const [config] = await db
      .select()
      .from(cryptoCommunityConfigs)
      .where(eq(cryptoCommunityConfigs.artistId, artistId))
      .limit(1);
    return config || null;
  }

  async upsertConfig(artistId: number, data: Partial<typeof cryptoCommunityConfigs.$inferInsert>) {
    const existing = await this.getConfig(artistId);
    if (existing) {
      await db.update(cryptoCommunityConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cryptoCommunityConfigs.id, existing.id));
      return { ...existing, ...data };
    } else {
      const [created] = await db.insert(cryptoCommunityConfigs)
        .values({ artistId, ...data })
        .returning();
      return created;
    }
  }

  // ── Channel Status ──

  async getChannelStatus(artistId: number) {
    const config = await this.getConfig(artistId);
    if (!config) {
      return {
        configured: false,
        channels: { telegram: false, discord: false, twitter: false },
        agentMode: 'manual',
        autoPostEnabled: false,
        linkedToken: null,
      };
    }

    // Get linked token info from BoostiSwap
    let linkedToken = null;
    if (config.linkedTokenId) {
      try {
        const [token] = await db.select()
          .from(tokenizedSongs)
          .where(eq(tokenizedSongs.id, config.linkedTokenId))
          .limit(1);
        if (token) {
          linkedToken = {
            id: token.id,
            symbol: token.tokenSymbol,
            name: token.songName,
            price: token.pricePerTokenUsd,
          };
        }
      } catch (e) { /* token not found */ }
    }

    return {
      configured: true,
      channels: {
        telegram: Boolean(config.telegramBotToken && config.telegramGroupId),
        discord: Boolean(config.discordWebhookUrl),
        twitter: Boolean(config.twitterHandle),
      },
      agentMode: config.agentMode,
      autoPostEnabled: config.autoPostEnabled,
      linkedToken,
      config,
    };
  }

  // ── Post Management ──

  async createPost(artistId: number, params: {
    postType: string;
    content: string;
    channels: Record<string, boolean>;
    tokenSymbol?: string;
    tokenPrice?: number;
    priceChange?: number;
    generatedByAi?: boolean;
  }) {
    const config = await this.getConfig(artistId);
    if (!config) throw new Error('Community not configured');

    // Build broadcaster
    const broadcaster = this.buildBroadcaster(config);
    const generator = getCryptoContentGenerator();

    // Get artist name
    let artistName = 'Artist';
    try {
      const { users } = await import('../../db/schema');
      const [artist] = await db.select({ name: users.artistName })
        .from(users).where(eq(users.id, artistId)).limit(1);
      if (artist?.name) artistName = artist.name;
    } catch (e) { /* fallback */ }

    // Generate AI content if needed, or use raw content
    let deliveryContent: { telegram?: string; discord?: string; twitter?: string };
    if (params.generatedByAi) {
      const generated = await generator.generate({
        type: params.postType as any,
        artistName,
        tokenSymbol: params.tokenSymbol,
        context: params.content,
        channels: Object.entries(params.channels)
          .filter(([_, v]) => v)
          .map(([k]) => k) as any[],
        tokenData: params.tokenPrice ? {
          price: params.tokenPrice,
          change24h: params.priceChange || 0,
          volume24h: 0,
          holders: 0,
          liquidity: 0,
        } : undefined,
      });
      deliveryContent = generated;
    } else {
      deliveryContent = {
        telegram: params.channels.telegram ? params.content : undefined,
        discord: params.channels.discord ? params.content : undefined,
        twitter: params.channels.twitter ? params.content.slice(0, 280) : undefined,
      };
    }

    // Broadcast
    const result = await broadcaster.broadcast(deliveryContent);

    // Save post record
    const [post] = await db.insert(cryptoCommunityPosts).values({
      artistId,
      postType: params.postType,
      content: params.content,
      channels: params.channels,
      deliveryStatus: result,
      tokenSymbol: params.tokenSymbol,
      tokenPrice: params.tokenPrice?.toString(),
      priceChange: params.priceChange?.toString(),
      generatedByAi: params.generatedByAi || false,
    }).returning();

    return { post, delivery: result };
  }

  async getPosts(artistId: number, limit = 20) {
    return db.select()
      .from(cryptoCommunityPosts)
      .where(eq(cryptoCommunityPosts.artistId, artistId))
      .orderBy(desc(cryptoCommunityPosts.createdAt))
      .limit(limit);
  }

  // ── Proposals ──

  async createProposal(artistId: number, params: {
    title: string;
    description: string;
    proposalType?: string;
    options: { id: number; label: string; votes: number }[];
    minTokensToVote?: string;
    endsAt?: Date;
    linkedTokenId?: number;
  }) {
    const [proposal] = await db.insert(cryptoCommunityProposals).values({
      artistId,
      title: params.title,
      description: params.description,
      proposalType: params.proposalType || 'general',
      options: params.options,
      minTokensToVote: params.minTokensToVote || '1',
      endsAt: params.endsAt,
      linkedTokenId: params.linkedTokenId,
      status: 'active',
    }).returning();

    // Auto-broadcast to channels
    try {
      const config = await this.getConfig(artistId);
      if (config?.autoPostEnabled) {
        await this.createPost(artistId, {
          postType: 'proposal',
          content: `New Proposal: ${params.title}\n${params.description}\nOptions: ${params.options.map(o => o.label).join(', ')}`,
          channels: { telegram: true, discord: true, twitter: true },
          generatedByAi: true,
        });
      }
    } catch (e) {
      console.error('[CryptoCommunityAgent] Proposal broadcast failed:', e);
    }

    return proposal;
  }

  async getProposals(artistId: number) {
    return db.select()
      .from(cryptoCommunityProposals)
      .where(eq(cryptoCommunityProposals.artistId, artistId))
      .orderBy(desc(cryptoCommunityProposals.createdAt));
  }

  async voteOnProposal(proposalId: number, memberId: number, optionId: number) {
    // Check existing vote
    const [existing] = await db.select()
      .from(cryptoCommunityVotes)
      .where(and(
        eq(cryptoCommunityVotes.proposalId, proposalId),
        eq(cryptoCommunityVotes.memberId, memberId),
      ))
      .limit(1);

    if (existing) throw new Error('Already voted on this proposal');

    // Get member voting power
    const [member] = await db.select()
      .from(cryptoCommunityMembers)
      .where(eq(cryptoCommunityMembers.id, memberId))
      .limit(1);

    const votingPower = member?.votingPower || '1';

    // Insert vote
    await db.insert(cryptoCommunityVotes).values({
      proposalId,
      memberId,
      optionId,
      votingPower,
    });

    // Update proposal vote count
    await db.update(cryptoCommunityProposals)
      .set({ totalVotes: sql`${cryptoCommunityProposals.totalVotes} + 1` })
      .where(eq(cryptoCommunityProposals.id, proposalId));

    return { success: true, votingPower };
  }

  // ── Community Stats ──

  async getStats(artistId: number) {
    const config = await this.getConfig(artistId);
    const [postCountResult] = await db.select({ count: sql<number>`count(*)` })
      .from(cryptoCommunityPosts)
      .where(eq(cryptoCommunityPosts.artistId, artistId));
    const [memberCountResult] = await db.select({ count: sql<number>`count(*)` })
      .from(cryptoCommunityMembers)
      .where(eq(cryptoCommunityMembers.artistId, artistId));
    const [proposalCountResult] = await db.select({ count: sql<number>`count(*)` })
      .from(cryptoCommunityProposals)
      .where(and(
        eq(cryptoCommunityProposals.artistId, artistId),
        eq(cryptoCommunityProposals.status, 'active'),
      ));

    // Get BoostiSwap token stats if linked
    let tokenStats = null;
    if (config?.linkedTokenId) {
      try {
        const [token] = await db.select()
          .from(tokenizedSongs)
          .where(eq(tokenizedSongs.id, config.linkedTokenId))
          .limit(1);
        if (token) {
          tokenStats = {
            symbol: token.tokenSymbol,
            price: token.pricePerTokenUsd,
            totalSupply: token.totalSupply,
          };
        }
      } catch (e) { /* */ }
    }

    return {
      totalPosts: Number(postCountResult?.count || 0),
      totalMembers: Number(memberCountResult?.count || 0),
      activeProposals: Number(proposalCountResult?.count || 0),
      channelsActive: config ? {
        telegram: Boolean(config.telegramBotToken && config.telegramGroupId),
        discord: Boolean(config.discordWebhookUrl),
        twitter: Boolean(config.twitterHandle),
      } : { telegram: false, discord: false, twitter: false },
      tokenStats,
    };
  }

  // ── Members ──

  async getMembers(artistId: number, limit = 50) {
    return db.select()
      .from(cryptoCommunityMembers)
      .where(eq(cryptoCommunityMembers.artistId, artistId))
      .orderBy(desc(cryptoCommunityMembers.tokensHeld))
      .limit(limit);
  }

  // ── Helper: Build Broadcaster ──

  private buildBroadcaster(config: typeof cryptoCommunityConfigs.$inferSelect): ArtistChannelBroadcaster {
    return new ArtistChannelBroadcaster({
      artistId: config.artistId,
      telegram: config.telegramBotToken && config.telegramGroupId
        ? { botToken: config.telegramBotToken, groupId: config.telegramGroupId }
        : undefined,
      discord: config.discordWebhookUrl
        ? { webhookUrl: config.discordWebhookUrl }
        : undefined,
      twitter: config.twitterHandle
        ? { handle: config.twitterHandle }
        : undefined,
    });
  }
}

// Singleton
let _agent: CryptoCommunityAgent | null = null;
export function getCryptoCommunityAgent(): CryptoCommunityAgent {
  if (!_agent) _agent = new CryptoCommunityAgent();
  return _agent;
}
