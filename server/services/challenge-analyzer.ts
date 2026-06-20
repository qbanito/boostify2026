/**
 * 🔥 Challenge Analyzer
 *
 * Analyzes a song's virality potential for TikTok/Instagram/YT Shorts challenges.
 * Produces:
 *  - Viral Potential Score (0-100)
 *  - BPM estimate, energy level, danceability
 *  - Challenge name, hashtag, hook text, instructions
 *
 * Creates (or reuses) a challenge_campaigns row in 'ready' status.
 */
import OpenAI from 'openai';
import { db } from '../db';
import { songs, users, challengeCampaigns } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { extractSongClipForPromo } from './song-audio-extractor';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

export interface ViralAnalysisResult {
  campaignId: number;
  viralScore: number;
  bpm: number | null;
  energyLevel: number | null;
  danceability: number | null;
  challengeName: string;
  hashtag: string;
  hookText: string;
  challengeInstructions: string;
  analysis: Record<string, any>;
}

export async function analyzeSongVirality(songId: number): Promise<ViralAnalysisResult> {
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) throw new Error(`Song ${songId} not found`);

  const artistId = ((song as any).artistId ?? (song as any).userId) as number;
  if (!artistId) throw new Error('Song has no artist owner');

  // Reuse existing ready campaign if recent enough (< 7 days)
  const [existing] = await db
    .select()
    .from(challengeCampaigns)
    .where(eq(challengeCampaigns.songId, songId))
    .orderBy(desc(challengeCampaigns.createdAt))
    .limit(1);

  if (existing && existing.status !== 'failed' && existing.status !== 'analyzing') {
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs < 7 * 24 * 60 * 60 * 1000) {
      return {
        campaignId: existing.id,
        viralScore: existing.viralScore ?? 0,
        bpm: existing.bpm ?? null,
        energyLevel: existing.energyLevel ?? null,
        danceability: existing.danceability ?? null,
        challengeName: existing.challengeName,
        hashtag: existing.hashtag,
        hookText: existing.hookText ?? '',
        challengeInstructions: existing.challengeInstructions ?? '',
        analysis: (existing.viralAnalysisJson as Record<string, any>) ?? {},
      };
    }
  }

  // Create new campaign row in 'analyzing'
  const [campaign] = await db
    .insert(challengeCampaigns)
    .values({
      songId,
      artistId,
      challengeName: 'Analyzing…',
      hashtag: '#challenge',
      status: 'analyzing',
    })
    .returning();

  try {
    // Extract 15s hook clip (best-effort — errors are non-fatal)
    let hookAudioUrl: string | null = null;
    try {
      const clip = await extractSongClipForPromo({ songId, strategy: 'hook', targetDuration: 15 });
      hookAudioUrl = clip?.audioPath ?? null;
    } catch (e) {
      logger.warn('[ChallengeAnalyzer] audio extract failed (non-fatal)', { err: (e as any)?.message });
    }

    // Build GPT prompt
    const insights = (song.analysisJson as any)?.insights ?? {};
    const artistName = (song as any).artistName || `Artist #${artistId}`;
    const analysis = await runViralAnalysis({
      songTitle: song.title || `Song #${songId}`,
      artistName,
      duration: (song as any).duration ?? 180,
      insights,
    });

    // Update campaign row
    const [updated] = await db
      .update(challengeCampaigns)
      .set({
        viralScore: analysis.viralScore,
        bpm: analysis.bpm ?? null,
        energyLevel: analysis.energyLevel ?? null,
        danceability: analysis.danceability ?? null,
        viralAnalysisJson: analysis as any,
        challengeName: analysis.challengeName,
        hashtag: analysis.hashtag,
        hookText: analysis.hookText,
        challengeInstructions: analysis.challengeInstructions,
        hookAudioUrl,
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(eq(challengeCampaigns.id, campaign.id))
      .returning();

    // Also update songs.viralScore
    try {
      await db
        .update(songs)
        .set({ viralScore: analysis.viralScore } as any)
        .where(eq(songs.id, songId));
    } catch (_) { /* viralScore column may not exist on all environments */ }

    return {
      campaignId: updated.id,
      viralScore: updated.viralScore ?? 0,
      bpm: updated.bpm ?? null,
      energyLevel: updated.energyLevel ?? null,
      danceability: updated.danceability ?? null,
      challengeName: updated.challengeName,
      hashtag: updated.hashtag,
      hookText: updated.hookText ?? '',
      challengeInstructions: updated.challengeInstructions ?? '',
      analysis: (updated.viralAnalysisJson as Record<string, any>) ?? {},
    };
  } catch (err: any) {
    await db
      .update(challengeCampaigns)
      .set({ status: 'failed', errorMessage: err.message, updatedAt: new Date() })
      .where(eq(challengeCampaigns.id, campaign.id));
    throw err;
  }
}

// ── GPT Virality Analysis ─────────────────────────────────────────────────

interface GPTViralAnalysis {
  viralScore: number;
  bpm: number | null;
  energyLevel: number | null;
  danceability: number | null;
  replicationEase: number;
  trendAlignment: number;
  challengeName: string;
  hashtag: string;
  hookText: string;
  challengeInstructions: string;
  whyViral: string;
  targetAudience: string;
}

async function runViralAnalysis(args: {
  songTitle: string;
  artistName: string;
  duration: number;
  insights: any;
}): Promise<GPTViralAnalysis> {
  const fallback: GPTViralAnalysis = {
    viralScore: 62,
    bpm: null,
    energyLevel: 0.7,
    danceability: 0.65,
    replicationEase: 6,
    trendAlignment: 7,
    challengeName: `${args.artistName} Challenge`,
    hashtag: `#${args.artistName.replace(/\s+/g, '')}Challenge`,
    hookText: `Join the ${args.artistName} challenge — show us your moves!`,
    challengeInstructions: `Record yourself doing the signature move at the drop. Tag a friend and use the hashtag.`,
    whyViral: 'Energetic track with clear rhythmic hook.',
    targetAudience: 'Gen Z / Millennial music fans on TikTok & Instagram',
  };

  if (!OPENAI_API_KEY) return fallback;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a viral music marketing expert specializing in TikTok, Instagram Reels, and YouTube Shorts challenges. Analyze songs and produce viral challenge strategies. Always respond with valid JSON.`,
        },
        {
          role: 'user',
          content: `Analyze this song for viral challenge potential:

Song: "${args.songTitle}"
Artist: "${args.artistName}"
Duration: ${args.duration}s
Genre: ${args.insights?.genre || 'unknown'}
Mood: ${(args.insights?.mood || []).join(', ') || 'unknown'}
Themes: ${(args.insights?.themes || []).join(', ') || 'unknown'}
Summary: ${args.insights?.summary || 'N/A'}

Return JSON with exactly these fields:
{
  "viralScore": <0-100 integer>,
  "bpm": <estimated BPM number or null if unsure>,
  "energyLevel": <0.0-1.0 float>,
  "danceability": <0.0-1.0 float>,
  "replicationEase": <0-10 how easy is it to copy the moves/vibe>,
  "trendAlignment": <0-10 how aligned with current TikTok/IG trends>,
  "challengeName": <creative challenge name, e.g. "The Wave Challenge">,
  "hashtag": <single hashtag like "#WaveChallenge", no spaces>,
  "hookText": <15-word max call-to-action for the challenge>,
  "challengeInstructions": <2-3 sentences: what participants should do>,
  "whyViral": <1 sentence explaining the viral mechanism>,
  "targetAudience": <short description of ideal audience>
}

Viral score formula: energy*30 + danceability*30 + replicationEase*25/10 + trendAlignment*15/10`,
        },
      ],
    });

    const raw = JSON.parse(resp.choices[0].message.content || '{}');
    return {
      viralScore: Math.min(100, Math.max(0, Math.round(raw.viralScore ?? fallback.viralScore))),
      bpm: typeof raw.bpm === 'number' ? Math.round(raw.bpm) : null,
      energyLevel: typeof raw.energyLevel === 'number' ? Math.min(1, Math.max(0, raw.energyLevel)) : fallback.energyLevel,
      danceability: typeof raw.danceability === 'number' ? Math.min(1, Math.max(0, raw.danceability)) : fallback.danceability,
      replicationEase: raw.replicationEase ?? 6,
      trendAlignment: raw.trendAlignment ?? 7,
      challengeName: raw.challengeName || fallback.challengeName,
      hashtag: raw.hashtag?.startsWith('#') ? raw.hashtag : `#${raw.hashtag || 'Challenge'}`,
      hookText: raw.hookText || fallback.hookText,
      challengeInstructions: raw.challengeInstructions || fallback.challengeInstructions,
      whyViral: raw.whyViral || fallback.whyViral,
      targetAudience: raw.targetAudience || fallback.targetAudience,
    };
  } catch (err: any) {
    logger.warn('[ChallengeAnalyzer] GPT analysis failed, using fallback', { err: err?.message });
    return fallback;
  }
}
