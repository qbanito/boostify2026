/**
 * OpenClaw Boostify Adapters
 * 
 * Real implementations that bridge OpenClaw agent actions
 * with Boostify's database, notification system, and internal APIs.
 */
import { db } from '../db';
import {
  managerTasks,
  managerNotes,
  events,
  notifications,
  users,
  songs,
  artistMedia,
  merchandise,
  crowdfundingCampaigns,
  crowdfundingContributions,
  marketingMetrics,
} from '@db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { createNotification } from '../utils/notifications';

// ─── Types ──────────────────────────────────────────────────

export interface TaskPayload {
  artistId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  assignedTo?: string;
}

export interface ContentBriefPayload {
  artistId: string;
  type: 'social' | 'press' | 'email' | 'blog' | 'ad';
  platform?: string;
  tone?: string;
  keywords?: string[];
}

export interface ReleaseReminderPayload {
  artistId: string;
  releaseDate: string;
  releaseName: string;
  channels: string[];
}

export interface ManagerAlertPayload {
  managerId: string;
  type: 'urgent' | 'info' | 'warning';
  message: string;
  relatedArtistId?: string;
}

export interface AssetSyncPayload {
  artistId: string;
  sources: ('google-drive' | 'dropbox' | 'local')[];
  types?: ('image' | 'audio' | 'video' | 'document')[];
}

export interface CampaignFollowupPayload {
  campaignId: string;
  artistId: string;
  action: 'check-metrics' | 'send-update' | 'adjust-budget' | 'pause' | 'resume';
}

export interface MessageClassification {
  channelId: string;
  messageId: string;
  content: string;
  sender: string;
}

// ─── Helpers ────────────────────────────────────────────────

/** Resolve a numeric user ID from a string (could be PG id or Clerk id) */
async function resolveUserId(idStr: string): Promise<number | null> {
  const numericId = parseInt(idStr, 10);
  if (!isNaN(numericId)) {
    const row = await db.select({ id: users.id }).from(users).where(eq(users.id, numericId)).limit(1);
    if (row.length > 0) return row[0].id;
  }
  // Try as Clerk ID
  const row = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, idStr)).limit(1);
  return row.length > 0 ? row[0].id : null;
}

// ─── 1. create_task_for_artist ──────────────────────────────

export async function createTaskForArtist(payload: TaskPayload): Promise<{ success: boolean; taskId?: number; error?: string }> {
  try {
    const userId = await resolveUserId(payload.artistId);
    if (!userId) return { success: false, error: `Artist not found: ${payload.artistId}` };

    const priorityMap: Record<string, 'low' | 'medium' | 'high'> = {
      low: 'low', medium: 'medium', high: 'high', urgent: 'high',
    };

    const [task] = await db.insert(managerTasks).values({
      userId,
      title: payload.title,
      description: payload.description || null,
      priority: priorityMap[payload.priority] || 'medium',
      status: 'pending',
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
    }).returning();

    // Notify the artist
    await createNotification({
      userId,
      type: 'OPENCLAW_TASK',
      title: `Nueva tarea: ${payload.title}`,
      message: payload.description || 'Se ha creado una nueva tarea desde OpenClaw.',
      link: '/manager',
      metadata: { taskId: task.id, priority: payload.priority, source: 'openclaw' },
    });

    console.log(`[OpenClaw Adapter] ✅ Task created: #${task.id} "${payload.title}" for user ${userId}`);
    return { success: true, taskId: task.id };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ create_task_for_artist error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 2. generate_content_brief ──────────────────────────────

export async function generateContentBrief(payload: ContentBriefPayload): Promise<{ success: boolean; noteId?: number; content?: string; error?: string }> {
  try {
    const userId = await resolveUserId(payload.artistId);
    if (!userId) return { success: false, error: `Artist not found: ${payload.artistId}` };

    // Fetch artist context for the brief
    const [artist] = await db.select({
      artistName: users.artistName,
      genre: users.genre,
      genres: users.genres,
      biography: users.biography,
      instagramHandle: users.instagramHandle,
      spotifyUrl: users.spotifyUrl,
    }).from(users).where(eq(users.id, userId)).limit(1);

    // Fetch recent songs for content context
    const recentSongs = await db.select({ title: songs.title, genre: songs.genre })
      .from(songs).where(eq(songs.userId, userId))
      .orderBy(desc(songs.createdAt)).limit(5);

    // Fetch metrics for data-driven brief
    const [metrics] = await db.select()
      .from(marketingMetrics)
      .where(eq(marketingMetrics.userId, userId))
      .limit(1);

    // Build the content brief
    const briefSections: string[] = [];
    briefSections.push(`# Content Brief — ${payload.type.toUpperCase()}`);
    briefSections.push(`**Artist:** ${artist?.artistName || 'Unknown'}`);
    briefSections.push(`**Genre:** ${artist?.genres?.join(', ') || artist?.genre || 'N/A'}`);
    briefSections.push(`**Platform:** ${payload.platform || 'General'}`);
    briefSections.push(`**Tone:** ${payload.tone || 'Authentic, engaging'}`);
    if (payload.keywords?.length) {
      briefSections.push(`**Keywords:** ${payload.keywords.join(', ')}`);
    }
    briefSections.push('');

    // Artist context
    if (artist?.biography) {
      briefSections.push(`## Artist Bio\n${artist.biography.slice(0, 300)}`);
    }

    // Recent releases
    if (recentSongs.length > 0) {
      briefSections.push(`## Recent Releases`);
      recentSongs.forEach(s => briefSections.push(`- ${s.title} (${s.genre || 'N/A'})`));
    }

    // Metrics snapshot
    if (metrics) {
      briefSections.push(`## Current Metrics`);
      briefSections.push(`- Spotify Followers: ${metrics.spotifyFollowers || 0}`);
      briefSections.push(`- Instagram Followers: ${metrics.instagramFollowers || 0}`);
      briefSections.push(`- Monthly Listeners: ${metrics.monthlyListeners || 0}`);
      briefSections.push(`- Total Engagement: ${metrics.totalEngagement || 0}`);
    }

    // Type-specific suggestions
    const suggestions: Record<string, string> = {
      social: '## Suggestions\n- Use carousel format for higher engagement\n- Include call-to-action\n- Tag relevant accounts\n- Use trending audio if applicable',
      press: '## Suggestions\n- Lead with the most newsworthy angle\n- Include quotes from the artist\n- Attach hi-res press photos\n- Include streaming links',
      email: '## Suggestions\n- Personalize the subject line\n- Keep body under 200 words\n- Include one clear CTA\n- Mobile-first design',
      blog: '## Suggestions\n- SEO-optimized title\n- 800-1200 words\n- Include embedded media\n- Internal links to artist profile',
      ad: '## Suggestions\n- A/B test 2-3 creatives\n- Target similar artist audiences\n- Set conversion tracking\n- Budget: start small, scale winners',
    };
    briefSections.push(suggestions[payload.type] || '');

    const briefContent = briefSections.join('\n');

    // Save as a manager note
    const [note] = await db.insert(managerNotes).values({
      userId,
      title: `Content Brief: ${payload.type} — ${payload.platform || 'General'}`,
      content: briefContent,
      category: 'idea',
      tags: ['openclaw', 'content-brief', payload.type, payload.platform || 'general'].filter(Boolean),
    }).returning();

    // Notify the artist
    await createNotification({
      userId,
      type: 'OPENCLAW_BRIEF',
      title: `Content brief generado: ${payload.type}`,
      message: `Se ha creado un brief de contenido para ${payload.platform || 'general'}`,
      link: '/manager',
      metadata: { noteId: note.id, briefType: payload.type, source: 'openclaw' },
    });

    console.log(`[OpenClaw Adapter] ✅ Content brief created: note #${note.id} for user ${userId}`);
    return { success: true, noteId: note.id, content: briefContent };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ generate_content_brief error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 3. schedule_release_reminder ───────────────────────────

export async function scheduleReleaseReminder(payload: ReleaseReminderPayload): Promise<{ success: boolean; eventId?: number; taskId?: number; error?: string }> {
  try {
    const userId = await resolveUserId(payload.artistId);
    if (!userId) return { success: false, error: `Artist not found: ${payload.artistId}` };

    const releaseDate = new Date(payload.releaseDate);
    if (isNaN(releaseDate.getTime())) return { success: false, error: 'Invalid releaseDate' };

    // Create a calendar event for the release
    const [event] = await db.insert(events).values({
      userId,
      title: `🎵 Release: ${payload.releaseName}`,
      description: `Scheduled release reminder.\nChannels: ${payload.channels.join(', ')}`,
      startDate: releaseDate,
      endDate: new Date(releaseDate.getTime() + 60 * 60 * 1000), // 1 hour event
      type: 'release',
      status: 'upcoming',
      metadata: { channels: payload.channels, source: 'openclaw' },
    }).returning();

    // Create a task for pre-release checklist (7 days before)
    const preReleaseDate = new Date(releaseDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [task] = await db.insert(managerTasks).values({
      userId,
      title: `Pre-release checklist: ${payload.releaseName}`,
      description: [
        `Release: ${payload.releaseName}`,
        `Date: ${releaseDate.toISOString().split('T')[0]}`,
        `Channels: ${payload.channels.join(', ')}`,
        '',
        'Checklist:',
        '- [ ] Artwork finalized',
        '- [ ] Distribution submitted',
        '- [ ] Pre-save links created',
        '- [ ] Social media posts scheduled',
        '- [ ] Press kit updated',
        '- [ ] Email blast drafted',
      ].join('\n'),
      priority: 'high',
      status: 'pending',
      dueDate: preReleaseDate > new Date() ? preReleaseDate : new Date(),
    }).returning();

    // Notify the artist
    await createNotification({
      userId,
      type: 'OPENCLAW_RELEASE',
      title: `Reminder programado: ${payload.releaseName}`,
      message: `Se ha creado un evento y checklist para tu lanzamiento del ${releaseDate.toLocaleDateString()}`,
      link: '/manager',
      metadata: { eventId: event.id, taskId: task.id, releaseDate: payload.releaseDate, source: 'openclaw' },
    });

    console.log(`[OpenClaw Adapter] ✅ Release reminder: event #${event.id}, task #${task.id} for user ${userId}`);
    return { success: true, eventId: event.id, taskId: task.id };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ schedule_release_reminder error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 4. send_manager_alert ──────────────────────────────────

export async function sendManagerAlert(payload: ManagerAlertPayload): Promise<{ success: boolean; notificationId?: number; error?: string }> {
  try {
    const managerId = await resolveUserId(payload.managerId);
    if (!managerId) return { success: false, error: `Manager not found: ${payload.managerId}` };

    const typeEmoji: Record<string, string> = { urgent: '🚨', warning: '⚠️', info: 'ℹ️' };
    const emoji = typeEmoji[payload.type] || 'ℹ️';

    // Get related artist name if provided
    let artistName: string | undefined;
    if (payload.relatedArtistId) {
      const artistUserId = await resolveUserId(payload.relatedArtistId);
      if (artistUserId) {
        const [artist] = await db.select({ artistName: users.artistName, firstName: users.firstName })
          .from(users).where(eq(users.id, artistUserId)).limit(1);
        artistName = artist?.artistName || artist?.firstName || undefined;
      }
    }

    const notification = await createNotification({
      userId: managerId,
      type: `OPENCLAW_ALERT_${payload.type.toUpperCase()}`,
      title: `${emoji} ${payload.type === 'urgent' ? 'ALERTA URGENTE' : payload.type === 'warning' ? 'Advertencia' : 'Info'}`,
      message: artistName ? `[${artistName}] ${payload.message}` : payload.message,
      link: '/manager',
      metadata: {
        alertType: payload.type,
        relatedArtistId: payload.relatedArtistId,
        artistName,
        source: 'openclaw',
      },
    });

    // For urgent alerts, also create a high-priority task
    if (payload.type === 'urgent') {
      await db.insert(managerTasks).values({
        userId: managerId,
        title: `🚨 ${payload.message.slice(0, 80)}`,
        description: `Urgent alert from OpenClaw agent.\n\n${payload.message}${artistName ? `\n\nRelated artist: ${artistName}` : ''}`,
        priority: 'high',
        status: 'pending',
        dueDate: new Date(), // Due today
      });
    }

    console.log(`[OpenClaw Adapter] ✅ Manager alert sent: ${payload.type} to user ${managerId}`);
    return { success: true, notificationId: notification?.id };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ send_manager_alert error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 5. sync_artist_assets ──────────────────────────────────

export async function syncArtistAssets(payload: AssetSyncPayload): Promise<{
  success: boolean;
  summary?: { songs: number; media: number; merch: number; total: number };
  error?: string;
}> {
  try {
    const userId = await resolveUserId(payload.artistId);
    if (!userId) return { success: false, error: `Artist not found: ${payload.artistId}` };

    // Gather current asset counts for the artist
    const typeFilter = payload.types || ['image', 'audio', 'video', 'document'];

    const songCount = typeFilter.includes('audio')
      ? (await db.select({ count: sql<number>`count(*)` }).from(songs).where(eq(songs.userId, userId)))[0]?.count || 0
      : 0;

    const mediaCount = typeFilter.includes('video')
      ? (await db.select({ count: sql<number>`count(*)` }).from(artistMedia).where(eq(artistMedia.userId, userId)))[0]?.count || 0
      : 0;

    const merchCount = typeFilter.includes('image')
      ? (await db.select({ count: sql<number>`count(*)` }).from(merchandise).where(eq(merchandise.userId, userId)))[0]?.count || 0
      : 0;

    const total = Number(songCount) + Number(mediaCount) + Number(merchCount);

    // Create a note documenting the sync
    await db.insert(managerNotes).values({
      userId,
      title: `Asset Sync Report — ${new Date().toLocaleDateString()}`,
      content: [
        `# Asset Sync Report`,
        `**Date:** ${new Date().toISOString()}`,
        `**Sources:** ${payload.sources.join(', ')}`,
        `**Types:** ${typeFilter.join(', ')}`,
        '',
        '## Current Assets',
        `- Songs: ${songCount}`,
        `- Videos/Media: ${mediaCount}`,
        `- Merchandise: ${merchCount}`,
        `- **Total: ${total}**`,
        '',
        '_Sync initiated by OpenClaw agent_',
      ].join('\n'),
      category: 'general',
      tags: ['openclaw', 'asset-sync'],
    });

    // Notify the artist
    await createNotification({
      userId,
      type: 'OPENCLAW_SYNC',
      title: 'Asset sync completado',
      message: `Se sincronizaron ${total} assets (${songCount} songs, ${mediaCount} media, ${merchCount} merch)`,
      link: '/manager',
      metadata: { songCount, mediaCount, merchCount, sources: payload.sources, source: 'openclaw' },
    });

    console.log(`[OpenClaw Adapter] ✅ Asset sync: ${total} assets for user ${userId}`);
    return { success: true, summary: { songs: Number(songCount), media: Number(mediaCount), merch: Number(merchCount), total } };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ sync_artist_assets error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 6. create_campaign_followup ────────────────────────────

export async function createCampaignFollowup(payload: CampaignFollowupPayload): Promise<{
  success: boolean;
  followupId?: number;
  data?: Record<string, any>;
  error?: string;
}> {
  try {
    const userId = await resolveUserId(payload.artistId);
    if (!userId) return { success: false, error: `Artist not found: ${payload.artistId}` };

    const campaignId = parseInt(payload.campaignId, 10);
    if (isNaN(campaignId)) return { success: false, error: 'Invalid campaignId' };

    // Fetch the campaign
    const [campaign] = await db.select()
      .from(crowdfundingCampaigns)
      .where(and(eq(crowdfundingCampaigns.id, campaignId), eq(crowdfundingCampaigns.userId, userId)))
      .limit(1);

    if (!campaign) return { success: false, error: `Campaign #${campaignId} not found for this artist` };

    // Fetch contribution metrics
    const contributions = await db.select({
      count: sql<number>`count(*)`,
      totalAmount: sql<string>`COALESCE(sum(amount), '0')`,
    }).from(crowdfundingContributions)
      .where(and(
        eq(crowdfundingContributions.campaignId, campaignId),
        eq(crowdfundingContributions.paymentStatus, 'succeeded'),
      ));

    const contribCount = Number(contributions[0]?.count || 0);
    const contribTotal = contributions[0]?.totalAmount || '0';
    const goalPercent = campaign.goalAmount ? (parseFloat(String(campaign.currentAmount)) / parseFloat(String(campaign.goalAmount)) * 100).toFixed(1) : '0';

    // Action-specific logic
    let actionDescription = '';
    const data: Record<string, any> = {
      campaignTitle: campaign.title,
      currentAmount: campaign.currentAmount,
      goalAmount: campaign.goalAmount,
      contributors: contribCount,
      goalPercent: `${goalPercent}%`,
      isActive: campaign.isActive,
    };

    switch (payload.action) {
      case 'check-metrics':
        actionDescription = `Campaign "${campaign.title}" metrics:\n- Progress: $${campaign.currentAmount}/$${campaign.goalAmount} (${goalPercent}%)\n- Contributors: ${contribCount}\n- Active: ${campaign.isActive}`;
        break;
      case 'send-update':
        actionDescription = `Update notification sent to ${contribCount} contributors of "${campaign.title}"`;
        break;
      case 'pause':
        if (campaign.isActive) {
          await db.update(crowdfundingCampaigns).set({ isActive: false, updatedAt: new Date() }).where(eq(crowdfundingCampaigns.id, campaignId));
          data.isActive = false;
        }
        actionDescription = `Campaign "${campaign.title}" paused`;
        break;
      case 'resume':
        if (!campaign.isActive) {
          await db.update(crowdfundingCampaigns).set({ isActive: true, updatedAt: new Date() }).where(eq(crowdfundingCampaigns.id, campaignId));
          data.isActive = true;
        }
        actionDescription = `Campaign "${campaign.title}" resumed`;
        break;
      case 'adjust-budget':
        actionDescription = `Budget adjustment requested for "${campaign.title}"`;
        break;
    }

    // Create a followup task
    const [task] = await db.insert(managerTasks).values({
      userId,
      title: `Campaign Followup: ${payload.action} — ${campaign.title}`,
      description: actionDescription,
      priority: payload.action === 'pause' || payload.action === 'adjust-budget' ? 'high' : 'medium',
      status: payload.action === 'check-metrics' ? 'completed' : 'pending',
    }).returning();

    // Notify artist
    await createNotification({
      userId,
      type: 'OPENCLAW_CAMPAIGN',
      title: `Campaign followup: ${payload.action}`,
      message: actionDescription.split('\n')[0],
      link: '/crowdfunding',
      metadata: { campaignId, action: payload.action, source: 'openclaw' },
    });

    console.log(`[OpenClaw Adapter] ✅ Campaign followup: ${payload.action} on campaign #${campaignId}`);
    return { success: true, followupId: task.id, data };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ create_campaign_followup error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── 7. classify_incoming_message ───────────────────────────

export async function classifyIncomingMessage(payload: MessageClassification): Promise<{
  success: boolean;
  classification?: {
    intent: string;
    confidence: number;
    suggestedAction: string;
    priority: string;
    tags: string[];
  };
  error?: string;
}> {
  try {
    const content = (payload.content || '').toLowerCase().trim();
    if (!content) return { success: false, error: 'Empty message content' };

    // Rule-based classification with keyword matching
    const rules: Array<{
      patterns: RegExp[];
      intent: string;
      action: string;
      priority: string;
      tags: string[];
      weight: number;
    }> = [
      {
        patterns: [/collab/i, /feature/i, /feat\b/i, /together/i, /colabora/i],
        intent: 'collaboration_request',
        action: 'route_to_artist',
        priority: 'medium',
        tags: ['collaboration', 'inbound'],
        weight: 0.85,
      },
      {
        patterns: [/book/i, /gig/i, /show/i, /concert/i, /event/i, /perform/i, /contrat/i, /actuaci/i],
        intent: 'booking_inquiry',
        action: 'route_to_manager',
        priority: 'high',
        tags: ['booking', 'business'],
        weight: 0.9,
      },
      {
        patterns: [/price/i, /cost/i, /pay/i, /money/i, /invoice/i, /presupuest/i, /precio/i, /cobr/i],
        intent: 'pricing_inquiry',
        action: 'route_to_manager',
        priority: 'medium',
        tags: ['pricing', 'business'],
        weight: 0.85,
      },
      {
        patterns: [/interview/i, /press/i, /article/i, /media/i, /journalist/i, /entrevista/i, /prensa/i],
        intent: 'press_inquiry',
        action: 'route_to_manager',
        priority: 'medium',
        tags: ['press', 'media'],
        weight: 0.85,
      },
      {
        patterns: [/fan/i, /love your/i, /amazing/i, /great music/i, /me encanta/i, /genial/i],
        intent: 'fan_message',
        action: 'auto_respond_thanks',
        priority: 'low',
        tags: ['fan', 'engagement'],
        weight: 0.75,
      },
      {
        patterns: [/help/i, /support/i, /problem/i, /issue/i, /broken/i, /error/i, /ayuda/i, /problema/i],
        intent: 'support_request',
        action: 'route_to_support',
        priority: 'medium',
        tags: ['support'],
        weight: 0.8,
      },
      {
        patterns: [/spam/i, /buy followers/i, /click here/i, /free money/i, /crypto/i, /nft drop/i],
        intent: 'spam',
        action: 'flag_and_ignore',
        priority: 'low',
        tags: ['spam', 'auto-filtered'],
        weight: 0.95,
      },
      {
        patterns: [/release/i, /new song/i, /album/i, /single/i, /lanzamiento/i, /nuevo tema/i],
        intent: 'release_related',
        action: 'route_to_artist',
        priority: 'medium',
        tags: ['release', 'content'],
        weight: 0.8,
      },
      {
        patterns: [/contract/i, /deal/i, /sign/i, /legal/i, /rights/i, /contrato/i, /derechos/i],
        intent: 'legal_inquiry',
        action: 'route_to_manager',
        priority: 'high',
        tags: ['legal', 'business'],
        weight: 0.9,
      },
    ];

    // Find best matching rule
    let bestMatch = {
      intent: 'general_inquiry',
      confidence: 0.3,
      suggestedAction: 'route_to_human',
      priority: 'medium',
      tags: ['unclassified'],
    };

    for (const rule of rules) {
      const matchCount = rule.patterns.filter(p => p.test(content)).length;
      if (matchCount > 0) {
        const confidence = Math.min(rule.weight * (1 + (matchCount - 1) * 0.1), 0.99);
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            intent: rule.intent,
            confidence: parseFloat(confidence.toFixed(2)),
            suggestedAction: rule.action,
            priority: rule.priority,
            tags: rule.tags,
          };
        }
      }
    }

    console.log(`[OpenClaw Adapter] ✅ Message classified: ${bestMatch.intent} (${bestMatch.confidence}) from ${payload.sender}`);
    return { success: true, classification: bestMatch };
  } catch (err: any) {
    console.error('[OpenClaw Adapter] ❌ classify_incoming_message error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Adapter Registry ───────────────────────────────────────

export const OPENCLAW_ADAPTERS = {
  create_task_for_artist: createTaskForArtist,
  generate_content_brief: generateContentBrief,
  schedule_release_reminder: scheduleReleaseReminder,
  send_manager_alert: sendManagerAlert,
  sync_artist_assets: syncArtistAssets,
  create_campaign_followup: createCampaignFollowup,
  classify_incoming_message: classifyIncomingMessage,
} as const;

export type AdapterName = keyof typeof OPENCLAW_ADAPTERS;
