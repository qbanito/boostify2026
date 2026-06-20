/**
 * AAS Agent: Blockchain Operator
 * 
 * Handles all blockchain operations for the artist:
 * - Register artist on Polygon (BTF-2300)
 * - Tokenize songs as ERC-1155 tokens
 * - Check token status and balances
 * 
 * CONNECTED TO:
 * - BTF-2300 Blockchain Service (registerArtistOnChain, tokenizeSongOnChain)
 * - tokenizedSongs table
 * - copyrightCertifications table
 */

import { db } from '../../db';
import { users, songs, tokenizedSongs } from '../../../db/schema';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';
import type { ActionResult } from '../../services/aas/types';
import {
  isBlockchainServiceAvailable,
  registerArtistOnChain,
  tokenizeSongOnChain,
  getTokenCounts,
} from '../../services/btf2300-blockchain';

/**
 * Execute a blockchain action
 */
export async function executeBlockchainAction(
  artistId: number,
  action: string,
  budget: number = 0,
): Promise<ActionResult> {
  try {
    if (!isBlockchainServiceAvailable()) {
      return {
        success: false,
        agent: 'blockchain-operator',
        action,
        costActual: 0,
        revenueGenerated: 0,
        details: 'Blockchain service not available (PLATFORM_PRIVATE_KEY not configured)',
      };
    }

    switch (action) {
      case 'Register artist on blockchain':
        return await registerArtist(artistId);
      case 'Tokenize song on blockchain':
        return await tokenizeSong(artistId);
      case 'Check blockchain status':
        return await checkBlockchainStatus(artistId);
      default:
        return await checkBlockchainStatus(artistId);
    }
  } catch (error: any) {
    return {
      success: false,
      agent: 'blockchain-operator',
      action,
      costActual: 0,
      revenueGenerated: 0,
      details: `Blockchain action failed: ${error.message}`,
    };
  }
}

// ── Register artist on Polygon ────────────────────────────
async function registerArtist(artistId: number): Promise<ActionResult> {
  // Get artist info
  const [artist] = await db.select({
    id: users.id,
    username: users.username,
    walletAddress: users.walletAddress,
  }).from(users).where(eq(users.id, artistId));

  if (!artist) {
    return {
      success: false,
      agent: 'blockchain-operator',
      action: 'Register artist on blockchain',
      costActual: 0,
      revenueGenerated: 0,
      details: 'Artist not found',
    };
  }

  // Check if already has tokenized songs (means already registered)
  const [existing] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.artistId, artistId));

  if ((existing?.c || 0) > 0) {
    return {
      success: true,
      agent: 'blockchain-operator',
      action: 'Register artist on blockchain',
      costActual: 0,
      revenueGenerated: 0,
      details: 'Artist already registered on blockchain',
    };
  }

  const result = await registerArtistOnChain(
    artist.walletAddress ?? undefined,
    artist.username || `Artist-${artistId}`,
    artistId,
  );

  return {
    success: result.success,
    agent: 'blockchain-operator',
    action: 'Register artist on blockchain',
    costActual: result.success ? 0.01 : 0, // ~gas cost in USD
    revenueGenerated: 0,
    details: result.success
      ? `Artist registered on Polygon! Chain ID: ${result.artistId}, Token: ${result.tokenId}, TX: ${result.txHash}`
      : `Registration failed: ${result.error}`,
    lessonsLearned: result.success
      ? ['Artist now has on-chain identity on Polygon via BTF-2300']
      : undefined,
  };
}

// ── Tokenize a song ───────────────────────────────────────
async function tokenizeSong(artistId: number): Promise<ActionResult> {
  // Find a non-tokenized song
  const allSongs = await db.select({
    id: songs.id,
    title: songs.title,
  }).from(songs).where(eq(songs.userId, artistId)).limit(20);

  const tokenizedIds = await db.select({ songId: tokenizedSongs.id })
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.artistId, artistId));

  const tokenizedSet = new Set(tokenizedIds.map(t => t.songId));
  const untokenized = allSongs.filter(s => !tokenizedSet.has(s.id));

  if (untokenized.length === 0) {
    return {
      success: true,
      agent: 'blockchain-operator',
      action: 'Tokenize song on blockchain',
      costActual: 0,
      revenueGenerated: 0,
      details: 'All songs are already tokenized',
    };
  }

  const song = untokenized[0];

  // We need the on-chain artist ID. For simplicity, use the token counts approach
  const counts = await getTokenCounts();
  const onChainArtistId = counts.totalArtists; // Latest registered

  const result = await tokenizeSongOnChain(
    onChainArtistId,
    song.title || `Song-${song.id}`,
    song.id,
    1000,                          // 1000 tokens
    BigInt('1000000000000000'),    // 0.001 MATIC per token
  );

  return {
    success: result.success,
    agent: 'blockchain-operator',
    action: 'Tokenize song on blockchain',
    costActual: result.success ? 0.02 : 0,
    revenueGenerated: 0,
    details: result.success
      ? `Song "${song.title}" tokenized! Token ID: ${result.tokenId}, TX: ${result.txHash}`
      : `Tokenization failed: ${result.error}`,
    lessonsLearned: result.success
      ? [`Song "${song.title}" now tradeable as ERC-1155 token on Polygon`]
      : undefined,
  };
}

// ── Check blockchain status ───────────────────────────────
async function checkBlockchainStatus(artistId: number): Promise<ActionResult> {
  const counts = await getTokenCounts();
  const [tokenized] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.artistId, artistId));

  return {
    success: true,
    agent: 'blockchain-operator',
    action: 'Check blockchain status',
    costActual: 0,
    revenueGenerated: 0,
    details: `Blockchain: ${counts.totalArtists} artists, ${counts.totalSongs} songs on-chain. This artist: ${tokenized?.c || 0} tokenized songs.`,
  };
}
