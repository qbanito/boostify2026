/**
 * Song Monetization Pipeline
 *
 * Single entry point that fires ALL monetization channels when a song is
 * published — whether by the release-publisher worker, a manual upload,
 * or the AI artist-generator.
 *
 * Each channel is independent and failure-isolated: if one fails the
 * others still execute.
 *
 * Distribution note: releases are created with ISRC/UPC and DSP
 * submissions are queued.  Actual delivery happens when a distributor
 * account is connected and the release is approved.
 */

import { db } from '../../db';
import {
  songs,
  users,
  tokenizedSongs,
  publishingBriefs,
  publishingSubmissions,
  outreachCampaigns,
} from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  quickDistributeSong,
  submitRelease,
} from './distribution-orchestrator';
import {
  isBlockchainServiceAvailable,
  tokenizeSongOnChain,
} from './btf2300-blockchain';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineResult {
  songId: number;
  results: {
    distribution: ChannelResult;
    tokenization: ChannelResult;
    syncMatching: ChannelResult;
    outreachFlag: ChannelResult;
  };
  triggeredAt: string;
}

interface ChannelResult {
  status: 'success' | 'skipped' | 'error';
  message: string;
  data?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// MAIN PIPELINE
// ---------------------------------------------------------------------------

export async function triggerSongMonetizationPipeline(
  songId: number,
  options: {
    skipDistribution?: boolean;
    skipTokenization?: boolean;
    skipSyncMatching?: boolean;
    skipOutreach?: boolean;
  } = {},
): Promise<PipelineResult> {
  const triggeredAt = new Date().toISOString();
  console.log(`\n💰 [Monetization-Pipeline] Triggering for song #${songId} at ${triggeredAt}`);

  // Fetch song + owner in parallel
  const [songRows, ] = await Promise.all([
    db.select().from(songs).where(eq(songs.id, songId)).limit(1),
  ]);
  const song = songRows[0];
  if (!song) {
    console.error(`❌ [Monetization-Pipeline] Song #${songId} not found`);
    return {
      songId,
      triggeredAt,
      results: {
        distribution: { status: 'error', message: 'Song not found' },
        tokenization: { status: 'error', message: 'Song not found' },
        syncMatching: { status: 'error', message: 'Song not found' },
        outreachFlag: { status: 'error', message: 'Song not found' },
      },
    };
  }

  const userId = song.userId;

  // Run all channels in parallel — each is failure-isolated
  const [distribution, tokenization, syncMatching, outreachFlag] = await Promise.allSettled([
    options.skipDistribution
      ? Promise.resolve<ChannelResult>({ status: 'skipped', message: 'Skipped by options' })
      : runDistribution(songId, userId),
    options.skipTokenization
      ? Promise.resolve<ChannelResult>({ status: 'skipped', message: 'Skipped by options' })
      : runTokenization(songId, userId, song.title),
    options.skipSyncMatching
      ? Promise.resolve<ChannelResult>({ status: 'skipped', message: 'Skipped by options' })
      : runSyncMatching(songId, userId, song),
    options.skipOutreach
      ? Promise.resolve<ChannelResult>({ status: 'skipped', message: 'Skipped by options' })
      : runOutreachFlag(songId, userId),
  ]);

  const result: PipelineResult = {
    songId,
    triggeredAt,
    results: {
      distribution: unwrapSettled(distribution, 'distribution'),
      tokenization: unwrapSettled(tokenization, 'tokenization'),
      syncMatching: unwrapSettled(syncMatching, 'syncMatching'),
      outreachFlag: unwrapSettled(outreachFlag, 'outreachFlag'),
    },
  };

  console.log(`✅ [Monetization-Pipeline] Song #${songId} — complete`, JSON.stringify(result.results, null, 2));
  return result;
}

// ---------------------------------------------------------------------------
// CHANNEL 1 — DISTRIBUTION (Create release + queue DSPs)
// ---------------------------------------------------------------------------

async function runDistribution(songId: number, userId: number): Promise<ChannelResult> {
  try {
    // quickDistributeSong creates a release, assigns ISRC/UPC, adds track
    const distResult = await quickDistributeSong(userId, songId);
    if (!distResult.success) {
      return { status: 'error', message: distResult.message };
    }

    const releaseId = distResult.release?.id;

    // Queue DSP submissions (they stay "queued" until a distributor is connected)
    if (releaseId) {
      const submitResult = await submitRelease(releaseId);
      console.log(`📦 [Monetization-Pipeline] Distribution queued: ${submitResult.message}`);
      return {
        status: 'success',
        message: `Release created (ID ${releaseId}) — DSPs queued. ${submitResult.message}`,
        data: { releaseId, upc: distResult.release?.upc },
      };
    }

    return {
      status: 'success',
      message: distResult.message,
      data: { releaseId },
    };
  } catch (err: any) {
    console.error(`❌ [Monetization-Pipeline] Distribution error for song #${songId}:`, err.message);
    return { status: 'error', message: err.message };
  }
}

// ---------------------------------------------------------------------------
// CHANNEL 2 — BLOCKCHAIN TOKENIZATION
// ---------------------------------------------------------------------------

async function runTokenization(songId: number, userId: number, songTitle: string): Promise<ChannelResult> {
  try {
    // Check if song is already tokenized
    const existing = await db
      .select({ id: tokenizedSongs.id })
      .from(tokenizedSongs)
      .where(and(eq(tokenizedSongs.artistId, userId), eq(tokenizedSongs.songName, songTitle)))
      .limit(1);

    if (existing.length > 0) {
      return { status: 'skipped', message: 'Song already tokenized' };
    }

    // Try real on-chain tokenization first
    if (isBlockchainServiceAvailable()) {
      const result = await tokenizeSongOnChain(userId, songTitle, songId, 1000);
      if (result.success) {
        return {
          status: 'success',
          message: `Tokenized on-chain: token #${result.tokenId}, tx ${result.txHash}`,
          data: { tokenId: result.tokenId, txHash: result.txHash, onChain: true },
        };
      }
      // Fall through to DB-only if on-chain fails
      console.warn(`⚠️ [Monetization-Pipeline] On-chain tokenization failed, falling back to DB record`);
    }

    // Fallback: create DB-only tokenized song record (same as generateTokenizedSongs does)
    const tokenId = Date.now() % 1_000_000 + songId;
    const tokenSymbol = `BFY${songTitle.replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase()}`;

    await db.insert(tokenizedSongs).values({
      artistId: userId,
      songName: songTitle,
      songUrl: '',
      tokenId,
      tokenSymbol,
      totalSupply: 1000,
      availableSupply: 1000,
      pricePerTokenUsd: '0.99',
      pricePerTokenEth: '0.00050000',
      royaltyPercentageArtist: 80,
      royaltyPercentagePlatform: 20,
      contractAddress: `0x${Buffer.from(songTitle + songId).toString('hex').slice(0, 40).padEnd(40, '0')}`,
      metadataUri: `ipfs://QmMeta${Buffer.from(songTitle).toString('hex').slice(0, 32)}`,
      description: `Boostify Music NFT — "${songTitle}"`,
      benefits: ['Exclusive access', 'Royalty share', 'Community voting'],
      isActive: true,
    });

    return {
      status: 'success',
      message: `Tokenized (DB record) — token ID ${tokenId}, ready for on-chain mint`,
      data: { tokenId, onChain: false },
    };
  } catch (err: any) {
    console.error(`❌ [Monetization-Pipeline] Tokenization error for song #${songId}:`, err.message);
    return { status: 'error', message: err.message };
  }
}

// ---------------------------------------------------------------------------
// CHANNEL 3 — AUTO-MATCH SYNC LICENSING BRIEFS
// ---------------------------------------------------------------------------

async function runSyncMatching(
  songId: number,
  userId: number,
  song: Record<string, any>,
): Promise<ChannelResult> {
  try {
    // Get artist info
    const [artist] = await db
      .select({ id: users.id, displayName: users.displayName, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!artist) {
      return { status: 'skipped', message: 'Artist not found' };
    }

    const artistName = artist.displayName || artist.username || 'Unknown Artist';

    // Find active briefs
    const activeBriefs = await db
      .select()
      .from(publishingBriefs)
      .where(eq(publishingBriefs.status, 'active'));

    if (activeBriefs.length === 0) {
      return { status: 'skipped', message: 'No active publishing briefs to match' };
    }

    const songGenre = (song.genre || '').toLowerCase();
    const songMood = (song.mood || '').toLowerCase();
    let matchCount = 0;

    for (const brief of activeBriefs) {
      // Simple genre + mood matching
      const briefGenres: string[] = (brief.genres as string[] || []).map((g: string) => g.toLowerCase());
      const briefMoods: string[] = (brief.moods as string[] || []).map((m: string) => m.toLowerCase());

      const genreMatch = briefGenres.length === 0 || briefGenres.some((g) => songGenre.includes(g) || g.includes(songGenre));
      const moodMatch = briefMoods.length === 0 || briefMoods.some((m) => songMood.includes(m) || m.includes(songMood));

      if (genreMatch || moodMatch) {
        // Check if already submitted to this brief
        const existingSub = await db
          .select({ id: publishingSubmissions.id })
          .from(publishingSubmissions)
          .where(
            and(
              eq(publishingSubmissions.userId, userId),
              eq(publishingSubmissions.briefId, brief.id),
              eq(publishingSubmissions.trackTitle, song.title),
            ),
          )
          .limit(1);

        if (existingSub.length > 0) continue;

        // Auto-submit
        await db.insert(publishingSubmissions).values({
          userId,
          briefId: brief.id,
          trackTitle: song.title,
          artistName,
          genre: song.genre || null,
          duration: song.duration || null,
          trackUrl: song.audioUrl || null,
          coverArtUrl: song.coverArt || null,
          isrc: song.isrc || null,
          pitchNote: `Auto-submitted by Boostify — ${songMood} ${songGenre} track by ${artistName}.`,
          exclusivityOffer: 'negotiable',
          status: 'submitted',
        });

        // Update brief submission count
        await db
          .update(publishingBriefs)
          .set({
            totalSubmissions: sql`${publishingBriefs.totalSubmissions} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(publishingBriefs.id, brief.id));

        matchCount++;
      }
    }

    if (matchCount === 0) {
      return { status: 'skipped', message: `No matching briefs for genre="${songGenre}" mood="${songMood}"` };
    }

    return {
      status: 'success',
      message: `Auto-submitted to ${matchCount} publishing brief(s)`,
      data: { matchCount, totalBriefsChecked: activeBriefs.length },
    };
  } catch (err: any) {
    console.error(`❌ [Monetization-Pipeline] Sync matching error for song #${songId}:`, err.message);
    return { status: 'error', message: err.message };
  }
}

// ---------------------------------------------------------------------------
// CHANNEL 4 — FLAG FOR OUTREACH
// ---------------------------------------------------------------------------

async function runOutreachFlag(songId: number, userId: number): Promise<ChannelResult> {
  try {
    // Create an outreach campaign entry so the outreach-agent picks it up
    await db.insert(outreachCampaigns).values({
      userId,
      artistId: userId,
      name: `New Release — song #${songId}`,
      description: `Automatically flagged for outreach — new song published.`,
      status: 'draft',
      dailyLimit: 20,
    });

    return {
      status: 'success',
      message: 'Outreach campaign created — agent will pick up on next cycle',
    };
  } catch (err: any) {
    console.error(`❌ [Monetization-Pipeline] Outreach flag error for song #${songId}:`, err.message);
    return { status: 'error', message: err.message };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrapSettled(settled: PromiseSettledResult<ChannelResult>, label: string): ChannelResult {
  if (settled.status === 'fulfilled') return settled.value;
  console.error(`❌ [Monetization-Pipeline] ${label} rejected:`, settled.reason);
  return { status: 'error', message: String(settled.reason) };
}
