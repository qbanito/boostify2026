/**
 * 📅 Challenge Campaign Builder
 *
 * Generates a 15-day social media campaign calendar for a challenge.
 * Uses GPT-4o to create day-by-day posts for TikTok, Instagram Reels, and YT Shorts.
 *
 * Saves the calendar to challenge_campaigns.campaign_calendar (JSONB).
 */
import OpenAI from 'openai';
import { db } from '../db';
import { songs, challengeCampaigns } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

export interface CampaignDay {
  day: number;
  platform: 'tiktok' | 'instagram' | 'youtube_shorts' | 'all';
  caption: string;
  hashtags: string[];
  contentType: 'launch' | 'repost' | 'challenge_cta' | 'reaction' | 'milestone' | 'winner';
  bestTime: string;          // e.g. "7pm local"
  engagementTip: string;
}

export interface BuildCampaignResult {
  calendar: CampaignDay[];
}

export async function buildChallengeCampaign(campaignId: number): Promise<BuildCampaignResult> {
  const [campaign] = await db
    .select()
    .from(challengeCampaigns)
    .where(eq(challengeCampaigns.id, campaignId))
    .limit(1);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, campaign.songId))
    .limit(1);
  if (!song) throw new Error(`Song ${campaign.songId} not found`);

  const calendar = await generateCalendar({
    songTitle: song.title || `Song #${song.id}`,
    challengeName: campaign.challengeName,
    hashtag: campaign.hashtag,
    hookText: campaign.hookText ?? '',
    instructions: campaign.challengeInstructions ?? '',
    viralScore: campaign.viralScore ?? 0,
    insights: (song.analysisJson as any)?.insights ?? {},
  });

  // Persist to DB
  await db
    .update(challengeCampaigns)
    .set({ campaignCalendar: calendar as any, updatedAt: new Date() })
    .where(eq(challengeCampaigns.id, campaignId));

  return { calendar };
}

// ── GPT Calendar Generator ────────────────────────────────────────────────

async function generateCalendar(args: {
  songTitle: string;
  challengeName: string;
  hashtag: string;
  hookText: string;
  instructions: string;
  viralScore: number;
  insights: any;
}): Promise<CampaignDay[]> {
  const fallback = buildFallbackCalendar(args.challengeName, args.hashtag);
  if (!OPENAI_API_KEY) return fallback;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a viral social media strategist specialized in TikTok/Instagram/YouTube Shorts music challenges. 
Create detailed 15-day campaign calendars that maximize challenge participation and song discovery.
Always return valid JSON only.`,
        },
        {
          role: 'user',
          content: `Create a 15-day viral challenge campaign calendar for:

Song: "${args.songTitle}"
Challenge: ${args.challengeName}
Hashtag: ${args.hashtag}
Hook: "${args.hookText}"
Challenge instructions: "${args.instructions}"
Viral Score: ${args.viralScore}/100
Genre: ${args.insights?.genre || 'unknown'}
Mood: ${(args.insights?.mood || []).join(', ') || 'energetic'}

Campaign phases:
- Days 1-3: LAUNCH — Announce the challenge, drop the video
- Days 4-7: MOMENTUM — Engage early participants, repost best entries
- Days 8-12: SCALE — Cross-platform push, influencer angles, compilations  
- Days 13-15: CELEBRATION — Winners, milestones, next drop tease

Return JSON: { "calendar": [ { "day": 1, "platform": "tiktok", "caption": "...", "hashtags": ["...", "..."], "contentType": "launch", "bestTime": "7pm local", "engagementTip": "..." }, ... ] }

Include 15 days. Mix platforms (tiktok, instagram, youtube_shorts, all). Captions should be engaging, use emojis, and be platform-appropriate. Max 150 chars for captions. Include 3-5 hashtags per day including ${args.hashtag}.`,
        },
      ],
    });

    const raw = JSON.parse(resp.choices[0].message.content || '{}');
    const days: CampaignDay[] = (raw.calendar || []).map((d: any, i: number) => ({
      day: d.day ?? i + 1,
      platform: d.platform ?? 'all',
      caption: d.caption ?? '',
      hashtags: Array.isArray(d.hashtags) ? d.hashtags : [args.hashtag],
      contentType: d.contentType ?? 'challenge_cta',
      bestTime: d.bestTime ?? '7pm local',
      engagementTip: d.engagementTip ?? '',
    }));

    return days.length >= 10 ? days.slice(0, 15) : fallback;
  } catch (err: any) {
    logger.warn('[ChallengeCampaign] GPT calendar failed, using fallback', { err: err?.message });
    return fallback;
  }
}

function buildFallbackCalendar(challengeName: string, hashtag: string): CampaignDay[] {
  const phases: Array<Omit<CampaignDay, 'day'>> = [
    { platform: 'tiktok', caption: `🔥 THE ${challengeName.toUpperCase()} IS HERE! Watch and do it 👇`, hashtags: [hashtag, '#newchallenge', '#fyp', '#music'], contentType: 'launch', bestTime: '7pm local', engagementTip: 'Pin this to your profile for max visibility' },
    { platform: 'instagram', caption: `🚨 Drop everything. ${challengeName} just launched. Your turn! 👆`, hashtags: [hashtag, '#reels', '#challenge', '#viral'], contentType: 'launch', bestTime: '12pm local', engagementTip: 'Share to stories immediately after posting' },
    { platform: 'youtube_shorts', caption: `I started ${challengeName} — who\'s next? 🎯 ${hashtag}`, hashtags: [hashtag, '#shorts', '#challenge', '#trending'], contentType: 'launch', bestTime: '6pm local', engagementTip: 'Reply to every comment in the first hour' },
    { platform: 'tiktok', caption: `Seeing your ${challengeName} entries 👀 keep them coming!`, hashtags: [hashtag, '#fyp', '#duet', '#stitch'], contentType: 'challenge_cta', bestTime: '8pm local', engagementTip: 'Use Stitch or Duet with the best entry you received' },
    { platform: 'instagram', caption: `The energy you all are bringing to ${challengeName} 🔥🔥🔥`, hashtags: [hashtag, '#reels', '#community', '#music'], contentType: 'repost', bestTime: '7pm local', engagementTip: 'Repost fan entries in Stories with credit' },
    { platform: 'all', caption: `Day 6 of ${challengeName} — new song dropping soon for participants 👀`, hashtags: [hashtag, '#exclusive', '#fyp', '#newmusic'], contentType: 'challenge_cta', bestTime: '9pm local', engagementTip: 'Tease upcoming content to keep momentum' },
    { platform: 'tiktok', caption: `My fav ${challengeName} entries so far 💥 (compilation coming)`, hashtags: [hashtag, '#fyp', '#trending', '#challenge'], contentType: 'reaction', bestTime: '7pm local', engagementTip: 'Quote top entries to drive engagement loops' },
    { platform: 'instagram', caption: `WEEK 2 of ${challengeName} 🏆 Who\'s still in? Drop yours!`, hashtags: [hashtag, '#week2', '#challenge', '#reels'], contentType: 'milestone', bestTime: '12pm local', engagementTip: 'Run a poll: "Did you try the challenge?"' },
    { platform: 'youtube_shorts', caption: `Best ${challengeName} entries compilation 🎬 #shorts`, hashtags: [hashtag, '#compilation', '#shorts', '#challenge'], contentType: 'repost', bestTime: '5pm local', engagementTip: 'Feature top creators — they will reshare' },
    { platform: 'tiktok', caption: `${challengeName} is TRENDING 📈 10K+ entries and counting`, hashtags: [hashtag, '#trending', '#fyp', '#milestone'], contentType: 'milestone', bestTime: '8pm local', engagementTip: 'Screenshot the trending page if it appears' },
    { platform: 'all', caption: `FINAL 5 DAYS of ${challengeName} — prizes being announced 🏆`, hashtags: [hashtag, '#finaldays', '#win', '#challenge'], contentType: 'challenge_cta', bestTime: '7pm local', engagementTip: 'Announce a prize or feature to re-ignite urgency' },
    { platform: 'instagram', caption: `Last week! ${challengeName} ends soon ⏰ Drop yours NOW`, hashtags: [hashtag, '#lastchance', '#reels', '#challenge'], contentType: 'challenge_cta', bestTime: '6pm local', engagementTip: 'Stories countdown timer drives last-day surge' },
    { platform: 'tiktok', caption: `Judging the final ${challengeName} entries LIVE tonight 🎤`, hashtags: [hashtag, '#finalist', '#fyp', '#live'], contentType: 'reaction', bestTime: '9pm local', engagementTip: 'Go live while reviewing final entries' },
    { platform: 'all', caption: `${challengeName} WINNERS 🏆✨ Thank you for an insane 2 weeks`, hashtags: [hashtag, '#winner', '#thankyou', '#community'], contentType: 'winner', bestTime: '8pm local', engagementTip: 'Tag winners and reshare their content' },
    { platform: 'all', caption: `${challengeName} wrapped 🎉 New music + challenge dropping soon…`, hashtags: [hashtag, '#newmusic', '#comingsoon', '#fyp'], contentType: 'milestone', bestTime: '7pm local', engagementTip: 'Tease next release to convert fans to followers' },
  ];

  return phases.map((p, i) => ({ ...p, day: i + 1 }));
}
