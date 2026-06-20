/**
 * AdsCampaignManager — Multi-platform paid ads orchestration widget
 *
 * Tabs:
 *   📋 Campaigns — list + manage saved campaigns
 *   ✦  Create    — build a new campaign (creative picker + AI copy + budget)
 *   🔗 Connect   — manage API credentials (Meta / TikTok)
 *   📊 Analytics — aggregate campaign stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone,
  Plus,
  Facebook,
  Instagram,
  Music2,
  Target,
  DollarSign,
  Calendar,
  Image as ImageIcon,
  Video,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Settings,
  Eye,
  BarChart3,
  Zap,
  Globe,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Link,
  Shield,
  TrendingUp,
  Users,
  MousePointer,
  Send,
  CalendarClock,
  Heart,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';
import { useToast } from '../../../hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

type AdPlatform = 'facebook' | 'instagram' | 'tiktok';
type CampaignObjective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversions' | 'app_installs';
type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed';
type BudgetType = 'daily' | 'lifetime';
type ActiveTab = 'campaigns' | 'create' | 'studio' | 'calendar' | 'autopilot' | 'publish' | 'schedule' | 'connect' | 'analytics';
type ContentScene = 'studio' | 'live_show' | 'viral' | 'behind_scenes' | 'music_video';
type PublishPlatform = 'instagram' | 'tiktok' | 'both';

interface ScheduledPost {
  id: string;
  platform: string;
  imageUrl?: string;
  videoUrl?: string;
  caption: string;
  hashtags: string;
  scheduledAt: string;
  status: 'pending' | 'published' | 'failed';
}

interface TikTokVideo {
  id: string;
  title: string;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  duration?: number;
  create_time?: number;
}

interface IGMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface AdCreative {
  imageUrl: string;
  videoUrl?: string;
  headline: string;
  primaryText: string;
  description?: string;
  callToAction: string;
  linkUrl?: string;
}

interface AdCampaign {
  id: string;
  artistId: string;
  name: string;
  objective: CampaignObjective;
  platforms: AdPlatform[];
  status: CampaignStatus;
  budgetType: BudgetType;
  budgetAmount: number;
  currency: string;
  startDate: string;
  endDate?: string;
  creative: AdCreative;
  targetAudience?: {
    ageMin?: number;
    ageMax?: number;
    countries?: string[];
    interests?: string[];
  };
  stats?: { impressions?: number; clicks?: number; spend?: number; ctr?: number };
  createdAt: string;
  updatedAt: string;
}

interface Creative {
  url: string;
  source: string;
  label: string;
}

interface GeneratedContentImage {
  url: string;
  scene: ContentScene;
  prompt: string;
  aspectRatio: string;
}

interface CalendarPost {
  day: number;
  date: string;
  platform: 'instagram' | 'tiktok';
  scene: ContentScene;
  contentType: 'photo' | 'reel' | 'story' | 'video';
  caption: string;
  hashtags: string;
  visualPrompt: string;
  callToAction: string;
  engagementHook?: string;
}

interface AutopilotPost {
  id: string;
  day: number;
  date: string;
  platform: 'instagram' | 'tiktok';
  scene: ContentScene;
  contentType: string;
  caption: string;
  hashtags: string;
  visualPrompt: string;
  callToAction: string;
  engagementHook?: string;
  imageUrl?: string;
  status: 'pending_approval' | 'scheduled' | 'generating' | 'publishing' | 'published' | 'failed';
  requiresApproval: boolean;
  scheduledAt: string;
  approvedAt?: string;
  publishedAt?: string;
  error?: string;
}

interface Props {
  artistId: string;
  artistName?: string;
  artistGenre?: string;
  artistProfileImageUrl?: string;
  accent?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PLATFORM_META: Record<AdPlatform, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  facebook: {
    label: 'Facebook',
    color: '#1877f2',
    bg: 'rgba(24,119,242,0.15)',
    icon: <Facebook className="w-3.5 h-3.5" />,
  },
  instagram: {
    label: 'Instagram',
    color: '#e1306c',
    bg: 'rgba(225,48,108,0.15)',
    icon: <Instagram className="w-3.5 h-3.5" />,
  },
  tiktok: {
    label: 'TikTok',
    color: '#ff0050',
    bg: 'rgba(255,0,80,0.15)',
    icon: <Music2 className="w-3.5 h-3.5" />,
  },
};

const SCENE_META: Record<ContentScene, { emoji: string; label: string; desc: string; color: string }> = {
  studio: { emoji: '🎙️', label: 'Studio Session', desc: 'Recording & creative process', color: '#8b5cf6' },
  live_show: { emoji: '🎤', label: 'Live Performance', desc: 'Concert & stage energy', color: '#ec4899' },
  viral: { emoji: '🔥', label: 'Viral Moment', desc: 'Trending & shareable content', color: '#f59e0b' },
  behind_scenes: { emoji: '🎬', label: 'Behind the Scenes', desc: 'Candid lifestyle moments', color: '#06b6d4' },
  music_video: { emoji: '🎥', label: 'Music Video', desc: 'Cinematic promo visuals', color: '#34d399' },
};

const OBJECTIVES: Array<{ id: CampaignObjective; label: string; emoji: string; desc: string }> = [
  { id: 'awareness', label: 'Brand Awareness', emoji: '👁️', desc: 'Reach new fans' },
  { id: 'traffic', label: 'Traffic', emoji: '🔗', desc: 'Drive to Spotify / site' },
  { id: 'engagement', label: 'Engagement', emoji: '❤️', desc: 'Likes, shares, saves' },
  { id: 'leads', label: 'Fan Leads', emoji: '📧', desc: 'Capture fan emails' },
  { id: 'conversions', label: 'Sales', emoji: '💰', desc: 'Merch or music sales' },
  { id: 'app_installs', label: 'App Installs', emoji: '📱', desc: 'Get app downloads' },
];

const STATUS_STYLE: Record<CampaignStatus, { color: string; bg: string; label: string }> = {
  draft: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Draft' },
  scheduled: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', label: 'Scheduled' },
  active: { color: '#34d399', bg: 'rgba(52,211,153,0.12)', label: 'Active' },
  paused: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: 'Paused' },
  completed: { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', label: 'Completed' },
  failed: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Failed' },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function AdsCampaignManager({ artistId, artistName = 'Artist', artistGenre = 'music', artistProfileImageUrl, accent = '#ec4899' }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('campaigns');
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [credentials, setCredentials] = useState<Record<string, any>>({});

  // Create form state
  const [form, setForm] = useState<Partial<AdCampaign>>({
    name: '',
    objective: 'awareness',
    platforms: ['facebook', 'instagram'],
    status: 'draft',
    budgetType: 'daily',
    budgetAmount: 10,
    currency: 'USD',
    startDate: new Date().toISOString().split('T')[0],
    creative: { imageUrl: '', headline: '', primaryText: '', callToAction: 'LEARN_MORE', linkUrl: '' },
  });
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [creativeTab, setCreativeTab] = useState<'select' | 'url'>('select');
  const [loadingCreatives, setLoadingCreatives] = useState(false);

  // Credentials form
  const [credsForm, setCredsForm] = useState<Record<string, string>>({});
  const [savingCreds, setSavingCreds] = useState(false);

  // Publish state
  const [publishForm, setPublishForm] = useState({
    caption: '',
    hashtags: '',
    platform: 'instagram' as PublishPlatform,
    selectedImageUrl: '',
    selectedVideoUrl: '',
    mediaType: 'image' as 'image' | 'video',
  });
  const [publishing, setPublishing] = useState(false);
  const [videos, setVideos] = useState<Array<{ url: string; source: string; label: string; thumbnail?: string }>>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Schedule state
  const [scheduleForm, setScheduleForm] = useState({
    platform: 'instagram' as 'instagram' | 'tiktok',
    scheduledAt: '',
    caption: '',
    hashtags: '',
    selectedImageUrl: '',
    selectedVideoUrl: '',
    mediaType: 'image' as 'image' | 'video',
  });
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Analytics state
  const [tiktokVideos, setTiktokVideos] = useState<TikTokVideo[]>([]);
  const [igMedia, setIgMedia] = useState<IGMedia[]>([]);
  const [loadingTikTokAnalytics, setLoadingTikTokAnalytics] = useState(false);
  const [loadingIgAnalytics, setLoadingIgAnalytics] = useState(false);

  // Studio state
  const [studioRefImage, setStudioRefImage] = useState<string>(artistProfileImageUrl || '');
  const [studioScene, setStudioScene] = useState<ContentScene>('studio');
  const [studioAspect, setStudioAspect] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [studioCount, setStudioCount] = useState<1 | 2 | 4>(1);
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioGenerated, setStudioGenerated] = useState<GeneratedContentImage[]>([]);

  // Calendar state
  const [calendarPosts, setCalendarPosts] = useState<CalendarPost[]>([]);
  const [calendarGenerating, setCalendarGenerating] = useState(false);
  const [calendarLoaded, setCalendarLoaded] = useState(false);
  const [calendarSelectedPost, setCalendarSelectedPost] = useState<CalendarPost | null>(null);

  // Autopilot state
  const [autopilotMode, setAutopilotMode] = useState<boolean>(true); // true = auto-publish, false = requires approval
  const [autopilotPosts, setAutopilotPosts] = useState<AutopilotPost[]>([]);
  const [autopilotActivating, setAutopilotActivating] = useState(false);
  const [autopilotLoaded, setAutopilotLoaded] = useState(false);
  const [approvingPostId, setApprovingPostId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [resettingAutopilot, setResettingAutopilot] = useState(false);

  // Load campaigns + credentials on mount
  useEffect(() => {
    loadCampaigns();
    loadCredentials();
  }, [artistId]);

  // Load creatives when on Create or Publish tab
  useEffect(() => {
    if ((activeTab === 'create' || activeTab === 'publish') && creatives.length === 0) {
      loadCreatives();
    }
    if (activeTab === 'publish' && videos.length === 0) {
      loadVideos();
    }
    if (activeTab === 'schedule' && scheduledPosts.length === 0) {
      loadScheduledPosts();
      if (creatives.length === 0) loadCreatives();
      if (videos.length === 0) loadVideos();
    }
    if (activeTab === 'analytics') {
      loadTikTokAnalytics();
      loadIgAnalytics();
    }
    if (activeTab === 'calendar' && !calendarLoaded) {
      loadCalendar();
    }
    if (activeTab === 'studio' && studioRefImage === '' && artistProfileImageUrl) {
      setStudioRefImage(artistProfileImageUrl);
    }
    if (activeTab === 'autopilot') {
      loadAutopilotPosts();
    }
  }, [activeTab]);

  // Poll autopilot status every 5s while posts are generating/publishing
  useEffect(() => {
    if (activeTab !== 'autopilot') return;
    const hasActive = autopilotPosts.some(p => p.status === 'generating' || p.status === 'publishing');
    if (!hasActive) return;
    const interval = setInterval(loadAutopilotPosts, 5000);
    return () => clearInterval(interval);
  }, [activeTab, autopilotPosts]);

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/campaigns`, method: 'GET' });
      if (data?.campaigns) setCampaigns(data.campaigns);
    } catch { /* first load may be empty */ }
    finally { setLoadingCampaigns(false); }
  };

  const loadCredentials = async () => {
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/credentials`, method: 'GET' });
      if (data?.credentials) setCredentials(data.credentials);
    } catch { /* ignore */ }
  };

  const loadCreatives = async () => {
    setLoadingCreatives(true);
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/creatives`, method: 'GET' });
      if (data?.creatives) setCreatives(data.creatives);
    } catch { /* ignore */ }
    finally { setLoadingCreatives(false); }
  };

  const loadVideos = async () => {
    setLoadingVideos(true);
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/creatives/videos`, method: 'GET' });
      if (data?.videos) setVideos(data.videos);
    } catch { /* ignore */ }
    finally { setLoadingVideos(false); }
  };

  const loadScheduledPosts = async () => {
    setLoadingScheduled(true);
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/schedule`, method: 'GET' });
      if (data?.posts) setScheduledPosts(data.posts);
    } catch { /* ignore */ }
    finally { setLoadingScheduled(false); }
  };

  const publishNow = async () => {
    const { caption, hashtags, platform, selectedImageUrl, selectedVideoUrl, mediaType } = publishForm;
    const imageUrl = mediaType === 'image' ? selectedImageUrl : undefined;
    const videoUrl = mediaType === 'video' ? selectedVideoUrl : undefined;
    if (!imageUrl && !videoUrl) {
      toast({ title: 'Select content first', variant: 'destructive' }); return;
    }
    setPublishing(true);
    try {
      const platforms = platform === 'both' ? ['instagram', 'tiktok'] : [platform];
      const results: Record<string, any> = {};
      for (const p of platforms) {
        if (p === 'tiktok' && !videoUrl) { results.tiktok = { success: false, error: 'TikTok requires a video URL' }; continue; }
        const data: any = await apiRequest({
          url: `/api/ads-campaigns/${artistId}/publish/${p}`,
          method: 'POST',
          data: { imageUrl, videoUrl, caption, hashtags },
        });
        results[p] = data;
      }
      const allOk = Object.values(results).every((r: any) => r.success);
      toast({
        title: allOk ? '✅ Published!' : '⚠️ Partial publish',
        description: allOk
          ? `Content posted to ${platforms.join(' & ')}`
          : Object.entries(results).filter(([, r]: any) => !r.success).map(([p, r]: any) => `${p}: ${r.error}`).join(' | '),
        variant: allOk ? 'default' : 'destructive',
      });
      if (allOk) setPublishForm(prev => ({ ...prev, caption: '', hashtags: '', selectedImageUrl: '', selectedVideoUrl: '' }));
    } catch (err: any) {
      toast({ title: 'Publish failed', description: err?.message, variant: 'destructive' });
    } finally { setPublishing(false); }
  };

  const schedulePost = async () => {
    const { platform, scheduledAt, caption, hashtags, selectedImageUrl, selectedVideoUrl, mediaType } = scheduleForm;
    const imageUrl = mediaType === 'image' ? selectedImageUrl : undefined;
    const videoUrl = mediaType === 'video' ? selectedVideoUrl : undefined;
    if (!imageUrl && !videoUrl) { toast({ title: 'Select content first', variant: 'destructive' }); return; }
    if (!scheduledAt) { toast({ title: 'Set a schedule date/time', variant: 'destructive' }); return; }
    setSavingSchedule(true);
    try {
      const data: any = await apiRequest({
        url: `/api/ads-campaigns/${artistId}/schedule`,
        method: 'POST',
        data: { platform, imageUrl, videoUrl, caption, hashtags, scheduledAt: new Date(scheduledAt).toISOString() },
      });
      if (data?.post) {
        setScheduledPosts(prev => [...prev, data.post]);
        setScheduleForm(prev => ({ ...prev, caption: '', hashtags: '', scheduledAt: '', selectedImageUrl: '', selectedVideoUrl: '' }));
        toast({ title: '🗓️ Post scheduled!', description: `Will publish to ${platform} at ${new Date(scheduledAt).toLocaleString()}` });
      }
    } catch (err: any) {
      toast({ title: 'Schedule failed', description: err?.message, variant: 'destructive' });
    } finally { setSavingSchedule(false); }
  };

  const cancelScheduled = async (postId: string) => {
    try {
      await apiRequest({ url: `/api/ads-campaigns/${artistId}/schedule/${postId}`, method: 'DELETE' });
      setScheduledPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: 'Scheduled post cancelled' });
    } catch {
      toast({ title: 'Could not cancel post', variant: 'destructive' });
    }
  };

  const loadTikTokAnalytics = async () => {
    setLoadingTikTokAnalytics(true);
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/analytics/tiktok`, method: 'GET' });
      if (data?.videos) setTiktokVideos(data.videos);
    } catch { /* TikTok not connected */ }
    finally { setLoadingTikTokAnalytics(false); }
  };

  const generateContent = async () => {
    setStudioGenerating(true);
    try {
      const data: any = await apiRequest({
        url: `/api/ads-campaigns/${artistId}/generate-content`,
        method: 'POST',
        data: {
          referenceImageUrl: studioRefImage || null,
          scene: studioScene,
          artistName,
          genre: artistGenre,
          count: studioCount,
          aspectRatio: studioAspect,
        },
      });
      if (data?.images?.length) {
        setStudioGenerated(prev => [...data.images, ...prev]);
        toast({ title: `✨ ${data.images.length} images generated!`, description: `${studioScene.replace('_', ' ')} — ${studioAspect}` });
        // Refresh creatives so they appear in campaign creative picker
        await loadCreatives();
      }
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err?.message, variant: 'destructive' });
    } finally {
      setStudioGenerating(false);
    }
  };

  const generateCalendar = async () => {
    setCalendarGenerating(true);
    try {
      const data: any = await apiRequest({
        url: `/api/ads-campaigns/${artistId}/generate-calendar`,
        method: 'POST',
        data: { artistName, genre: artistGenre, days: 30 },
      });
      if (data?.calendar?.length) {
        setCalendarPosts(data.calendar);
        setCalendarLoaded(true);
        toast({ title: '📅 30-day calendar generated!', description: `${data.calendar.length} posts planned` });
      }
    } catch (err: any) {
      toast({ title: 'Calendar generation failed', description: err?.message, variant: 'destructive' });
    } finally {
      setCalendarGenerating(false);
    }
  };

  const loadCalendar = async () => {
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/calendar`, method: 'GET' });
      if (data?.calendar?.length) {
        setCalendarPosts(data.calendar);
        setCalendarLoaded(true);
      }
    } catch { /* ignore */ }
  };

  const scheduleCalendarPost = async (post: CalendarPost, imageUrl?: string) => {
    if (!imageUrl && studioGenerated.length === 0) {
      toast({ title: 'Generate an image first in the Studio tab', variant: 'destructive' }); return;
    }
    try {
      await apiRequest({
        url: `/api/ads-campaigns/${artistId}/schedule`,
        method: 'POST',
        data: {
          platform: post.platform,
          imageUrl: imageUrl || studioGenerated[0]?.url || '',
          caption: `${post.engagementHook ? post.engagementHook + '\n\n' : ''}${post.caption}\n\n${post.callToAction}`,
          hashtags: post.hashtags,
          scheduledAt: new Date(`${post.date}T12:00:00`).toISOString(),
        },
      });
      toast({ title: `🗓️ Scheduled for ${post.date}`, description: `${post.platform} — ${post.scene.replace('_', ' ')}` });
      setCalendarSelectedPost(null);
    } catch (err: any) {
      toast({ title: 'Schedule failed', description: err?.message, variant: 'destructive' });
    }
  };

  const loadAutopilotPosts = async () => {
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/autopilot/posts`, method: 'GET' });
      if (data?.posts) { setAutopilotPosts(data.posts); setAutopilotLoaded(true); }
    } catch { /* ignore */ }
  };

  const activateAutopilot = async () => {
    if (!calendarPosts.length) {
      toast({ title: 'Generate a 30-day calendar first in the Calendar tab', variant: 'destructive' }); return;
    }
    setAutopilotActivating(true);
    try {
      const data: any = await apiRequest({
        url: `/api/ads-campaigns/${artistId}/autopilot/activate`,
        method: 'POST',
        data: { posts: calendarPosts, autopilotMode, referenceImageUrl: artistProfileImageUrl || studioRefImage || null, artistName, genre: artistGenre },
      });
      if (data?.posts?.length) {
        setAutopilotPosts(data.posts);
        setAutopilotLoaded(true);
        toast({ title: `🤖 Autopilot activated! ${data.posts.length} posts scheduled.`, description: autopilotMode ? 'Posts will publish automatically at their scheduled times.' : 'Posts are awaiting your approval before publishing.' });
      }
    } catch (err: any) {
      toast({ title: 'Autopilot activation failed', description: err?.message, variant: 'destructive' });
    } finally { setAutopilotActivating(false); }
  };

  const approveAutopilotPost = async (postId: string) => {
    setApprovingPostId(postId);
    try {
      await apiRequest({ url: `/api/ads-campaigns/${artistId}/autopilot/approve/${postId}`, method: 'PATCH' });
      setAutopilotPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'scheduled', requiresApproval: false } : p));
      toast({ title: '✅ Post approved — scheduled for auto-publish' });
    } catch (err: any) {
      toast({ title: 'Approval failed', description: err?.message, variant: 'destructive' });
    } finally { setApprovingPostId(null); }
  };

  const approveAllAutopilotPosts = async () => {
    setApprovingAll(true);
    try {
      await apiRequest({ url: `/api/ads-campaigns/${artistId}/autopilot/approve-all`, method: 'PATCH' });
      setAutopilotPosts(prev => prev.map(p => p.status === 'pending_approval' ? { ...p, status: 'scheduled', requiresApproval: false } : p));
      toast({ title: '✅ All posts approved and scheduled!' });
    } catch (err: any) {
      toast({ title: 'Approve all failed', description: err?.message, variant: 'destructive' });
    } finally { setApprovingAll(false); }
  };

  const resetAutopilot = async () => {
    setResettingAutopilot(true);
    try {
      await apiRequest({ url: `/api/ads-campaigns/${artistId}/autopilot/posts`, method: 'DELETE' });
      setAutopilotPosts([]);
      setAutopilotLoaded(false);
      toast({ title: '🗑️ Autopilot reset — ready for a new cycle' });
    } catch (err: any) {
      toast({ title: 'Reset failed', description: err?.message, variant: 'destructive' });
    } finally { setResettingAutopilot(false); }
  };

  const loadIgAnalytics = async () => {
    setLoadingIgAnalytics(true);
    try {
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/analytics/instagram`, method: 'GET' });
      if (data?.media) setIgMedia(data.media);
    } catch { /* no creds */ }
    finally { setLoadingIgAnalytics(false); }
  };

  const generateAdCopy = async () => {
    setGeneratingCopy(true);
    try {
      const data: any = await apiRequest({
        url: `/api/ads-campaigns/${artistId}/generate-copy`,
        method: 'POST',
        data: {
          artistName,
          genre: artistGenre,
          objective: form.objective,
          platform: form.platforms?.[0] || 'facebook',
        },
      });
      if (data?.copy) {
        setForm(prev => ({
          ...prev,
          creative: {
            ...prev.creative!,
            headline: data.copy.headline || prev.creative!.headline,
            primaryText: data.copy.primaryText || prev.creative!.primaryText,
            callToAction: data.copy.callToAction || 'LEARN_MORE',
          },
        }));
        toast({ title: '✦ AI Copy Generated', description: 'Review and customize before publishing' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not generate copy', variant: 'destructive' });
    } finally {
      setGeneratingCopy(false);
    }
  };

  const saveCampaign = async (launchNow = false) => {
    if (!form.name) { toast({ title: 'Campaign name required', variant: 'destructive' }); return; }
    if (!form.platforms?.length) { toast({ title: 'Select at least one platform', variant: 'destructive' }); return; }
    setSavingCampaign(true);
    try {
      const payload = { ...form, status: launchNow ? 'scheduled' : 'draft', artistId };
      const data: any = await apiRequest({ url: `/api/ads-campaigns/${artistId}/campaigns`, method: 'POST', data: payload });
      if (data?.campaign) {
        setCampaigns(prev => [data.campaign, ...prev]);
        toast({ title: '✅ Campaign saved', description: launchNow ? 'Campaign scheduled for launch' : 'Saved as draft' });
        setActiveTab('campaigns');
        resetForm();
      }
    } catch {
      toast({ title: 'Error saving campaign', variant: 'destructive' });
    } finally {
      setSavingCampaign(false);
    }
  };

  const launchCampaign = async (campaignId: string) => {
    setLaunchingId(campaignId);
    try {
      const data: any = await apiRequest({
        url: `/api/ads-campaigns/${artistId}/campaigns/${campaignId}/launch`,
        method: 'POST',
      });
      if (data?.campaign) {
        setCampaigns(prev => prev.map(c => c.id === campaignId ? data.campaign : c));
        const results = data.platformResults || {};
        const allOk = Object.values(results).every((r: any) => r.success);
        toast({
          title: allOk ? '🚀 Campaign Launched!' : '⚠️ Partial Launch',
          description: allOk
            ? 'Campaign is now live on selected platforms'
            : Object.entries(results).filter(([, r]: any) => !r.success).map(([p, r]: any) => `${p}: ${r.error}`).join(' | '),
          variant: allOk ? 'default' : 'destructive',
        });
      }
    } catch (err: any) {
      toast({ title: 'Launch failed', description: err?.message || 'API error', variant: 'destructive' });
    } finally {
      setLaunchingId(null);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    try {
      await apiRequest({ url: `/api/ads-campaigns/${artistId}/campaigns/${campaignId}`, method: 'DELETE' });
      setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      toast({ title: 'Campaign deleted' });
    } catch {
      toast({ title: 'Error deleting campaign', variant: 'destructive' });
    }
  };

  const togglePlatform = (p: AdPlatform) => {
    setForm(prev => ({
      ...prev,
      platforms: prev.platforms?.includes(p) ? prev.platforms.filter(x => x !== p) : [...(prev.platforms || []), p],
    }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      objective: 'awareness',
      platforms: ['facebook', 'instagram'],
      status: 'draft',
      budgetType: 'daily',
      budgetAmount: 10,
      currency: 'USD',
      startDate: new Date().toISOString().split('T')[0],
      creative: { imageUrl: '', headline: '', primaryText: '', callToAction: 'LEARN_MORE', linkUrl: '' },
    });
  };

  const saveCredentials = async () => {
    setSavingCreds(true);
    try {
      await apiRequest({ url: `/api/ads-campaigns/${artistId}/credentials`, method: 'POST', data: credsForm });
      await loadCredentials();
      setCredsForm({});
      toast({ title: '🔐 Credentials saved securely', description: 'Platforms are now ready for ad launches' });
    } catch {
      toast({ title: 'Error saving credentials', variant: 'destructive' });
    } finally {
      setSavingCreds(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const draftCampaigns = campaigns.filter(c => c.status === 'draft');
  const totalSpend = campaigns.reduce((s, c) => s + (c.stats?.spend || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.stats?.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.stats?.clicks || 0), 0);

  const facebookConnected = credentials.facebookAccessTokenSet || credentials.facebookAccessToken?.startsWith('EAA');
  const tiktokConnected = credentials.tiktokAccessTokenSet || !!credentials.tiktokAccessToken;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(139,92,246,0.06))', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)' }}>
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Ads Campaign Manager</h3>
              <p className="text-[11px] text-white/40">Facebook · Instagram · TikTok</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Platform connection pills */}
            {(['facebook', 'instagram', 'tiktok'] as AdPlatform[]).map(p => {
              const meta = PLATFORM_META[p];
              const connected = p === 'tiktok' ? tiktokConnected : facebookConnected;
              return (
                <div key={p} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold"
                  style={{ background: connected ? meta.bg : 'rgba(255,255,255,0.05)', color: connected ? meta.color : 'rgba(255,255,255,0.25)', border: `1px solid ${connected ? meta.color + '33' : 'rgba(255,255,255,0.08)'}` }}>
                  {meta.icon}
                  {connected ? '●' : '○'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        {campaigns.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { label: 'Active', value: activeCampaigns.length, icon: <Zap className="w-3 h-3" />, color: '#34d399' },
              { label: 'Drafts', value: draftCampaigns.length, icon: <Clock className="w-3 h-3" />, color: '#60a5fa' },
              { label: 'Impressions', value: totalImpressions > 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : totalImpressions, icon: <Eye className="w-3 h-3" />, color: '#a78bfa' },
              { label: 'Spend', value: `$${totalSpend.toFixed(0)}`, icon: <DollarSign className="w-3 h-3" />, color: '#fbbf24' },
            ].map(stat => (
              <div key={stat.label} className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center justify-center gap-1 mb-0.5" style={{ color: stat.color }}>
                  {stat.icon}
                </div>
                <p className="text-white font-bold text-sm">{stat.value}</p>
                <p className="text-white/35 text-[9px] uppercase tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 p-1 rounded-xl flex-wrap" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        {([
          { id: 'studio' as ActiveTab, label: 'Studio', emoji: '✨' },
          { id: 'calendar' as ActiveTab, label: 'Calendar', emoji: '📅' },
          { id: 'autopilot' as ActiveTab, label: 'Autopilot', emoji: '🤖' },
          { id: 'campaigns' as ActiveTab, label: 'Ads', emoji: '📋' },
          { id: 'create' as ActiveTab, label: 'Create', emoji: '✦' },
          { id: 'publish' as ActiveTab, label: 'Post', emoji: '🚀' },
          { id: 'schedule' as ActiveTab, label: 'Schedule', emoji: '🗓️' },
          { id: 'analytics' as ActiveTab, label: 'Stats', emoji: '📊' },
          { id: 'connect' as ActiveTab, label: 'Connect', emoji: '🔗' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab.id ? `linear-gradient(135deg, ${accent}, #8b5cf6)` : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
              boxShadow: activeTab === tab.id ? `0 0 16px ${accent}33` : 'none',
            }}
          >
            <span className="mr-1">{tab.emoji}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* ── CAMPAIGNS TAB ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'campaigns' && (
          <motion.div key="campaigns" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-white/35">{campaigns.length} Campaigns</span>
              <button onClick={() => setActiveTab('create')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                <Plus className="w-3 h-3" /> New Campaign
              </button>
            </div>

            {loadingCampaigns ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: `${accent}15` }}>
                  <Megaphone className="w-6 h-6" style={{ color: accent }} />
                </div>
                <p className="text-white font-semibold text-sm">No campaigns yet</p>
                <p className="text-white/35 text-xs max-w-xs mx-auto">Create your first paid ad campaign to reach new fans on Facebook, Instagram and TikTok</p>
                <button onClick={() => setActiveTab('create')} className="mt-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                  Create First Campaign
                </button>
              </div>
            ) : (
              campaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  launching={launchingId === campaign.id}
                  onLaunch={() => launchCampaign(campaign.id)}
                  onDelete={() => deleteCampaign(campaign.id)}
                  accent={accent}
                />
              ))
            )}
          </motion.div>
        )}

        {/* ── CREATE TAB ── */}
        {activeTab === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Campaign name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-1.5">Campaign Name</label>
              <input
                value={form.name || ''}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder={`${artistName} — New Fan Awareness`}
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
              />
            </div>

            {/* Objective */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Objective</label>
              <div className="grid grid-cols-3 gap-2">
                {OBJECTIVES.map(obj => (
                  <button key={obj.id} onClick={() => setForm(p => ({ ...p, objective: obj.id }))}
                    className="p-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: form.objective === obj.id ? `${accent}18` : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${form.objective === obj.id ? accent + '55' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <div className="text-base mb-1">{obj.emoji}</div>
                    <p className="text-white text-[11px] font-bold leading-tight">{obj.label}</p>
                    <p className="text-white/35 text-[9px] mt-0.5">{obj.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Platforms</label>
              <div className="flex gap-2">
                {(['facebook', 'instagram', 'tiktok'] as AdPlatform[]).map(p => {
                  const meta = PLATFORM_META[p];
                  const selected = form.platforms?.includes(p);
                  return (
                    <button key={p} onClick={() => togglePlatform(p)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: selected ? meta.bg : 'rgba(255,255,255,0.04)',
                        color: selected ? meta.color : 'rgba(255,255,255,0.3)',
                        border: `1.5px solid ${selected ? meta.color + '44' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {meta.icon} {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Budget</label>
              <div className="flex gap-2">
                {(['daily', 'lifetime'] as BudgetType[]).map(bt => (
                  <button key={bt} onClick={() => setForm(p => ({ ...p, budgetType: bt }))}
                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{ background: form.budgetType === bt ? `${accent}20` : 'rgba(255,255,255,0.05)', color: form.budgetType === bt ? accent : 'rgba(255,255,255,0.35)', border: `1px solid ${form.budgetType === bt ? accent + '44' : 'rgba(255,255,255,0.08)'}` }}>
                    {bt === 'daily' ? 'Daily' : 'Total'}
                  </button>
                ))}
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                  <input
                    type="number"
                    min={1}
                    value={form.budgetAmount || ''}
                    onChange={e => setForm(p => ({ ...p, budgetAmount: Number(e.target.value) }))}
                    className="w-full pl-7 pr-4 py-2 rounded-xl text-sm bg-transparent outline-none text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                    placeholder="10.00"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  USD
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-1.5">Start Date</label>
                <input type="date" value={form.startDate || ''} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', colorScheme: 'dark' }} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-1.5">End Date <span className="text-white/20 normal-case font-normal">(optional)</span></label>
                <input type="date" value={form.endDate || ''} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', colorScheme: 'dark' }} />
              </div>
            </div>

            {/* Creative */}
            <div className="space-y-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white/35">Creative</span>
                <div className="flex gap-1">
                  {(['select', 'url'] as const).map(t => (
                    <button key={t} onClick={() => setCreativeTab(t)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                      style={{ background: creativeTab === t ? `${accent}22` : 'transparent', color: creativeTab === t ? accent : 'rgba(255,255,255,0.3)' }}>
                      {t === 'select' ? '🖼 From Library' : '🔗 URL'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Creative image selector */}
              {creativeTab === 'select' ? (
                <div>
                  {loadingCreatives ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
                  ) : creatives.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-white/30 text-xs">No images in your library yet.</p>
                      <p className="text-white/20 text-[10px] mt-1">Generate images in Promo Clips or Character Pack first</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {creatives.map((c, i) => {
                        const selected = form.creative?.imageUrl === c.url;
                        return (
                          <button key={i} onClick={() => setForm(p => ({ ...p, creative: { ...p.creative!, imageUrl: c.url } }))}
                            className="relative rounded-xl overflow-hidden group"
                            style={{ aspectRatio: '1', border: `2px solid ${selected ? accent : 'transparent'}`, boxShadow: selected ? `0 0 12px ${accent}55` : 'none' }}>
                            <img src={c.url} alt={c.label} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <p className="text-white text-[8px] text-center px-1 leading-tight">{c.label}</p>
                            </div>
                            {selected && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: accent }}>
                                <CheckCircle className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                            <div className="absolute bottom-1 left-1">
                              <span className="text-[8px] px-1 py-0.5 rounded text-white/80" style={{ background: 'rgba(0,0,0,0.7)' }}>
                                {c.source === 'promo_clips' ? '🎬' : c.source === 'character_pack' ? '👤' : c.source === 'poster' ? '🎭' : '🖼'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={loadCreatives} className="w-full mt-2 py-1.5 rounded-xl text-[10px] text-white/30 hover:text-white/50 transition-colors flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Refresh library
                  </button>
                </div>
              ) : (
                <input value={form.creative?.imageUrl || ''} onChange={e => setForm(p => ({ ...p, creative: { ...p.creative!, imageUrl: e.target.value } }))}
                  placeholder="https://... (image or video URL)"
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }} />
              )}

              {/* Preview selected image */}
              {form.creative?.imageUrl && (
                <div className="flex gap-3 items-start p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <img src={form.creative.imageUrl} alt="Preview" className="w-16 h-20 object-cover rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/50 text-[10px] mb-1">Selected creative</p>
                    <p className="text-white/30 text-[9px] break-all leading-relaxed">{form.creative.imageUrl.slice(0, 60)}...</p>
                  </div>
                </div>
              )}

              {/* Ad copy */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40 font-semibold">Ad Copy</span>
                  <button onClick={generateAdCopy} disabled={generatingCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${accent}20, rgba(139,92,246,0.15))`, color: accent, border: `1px solid ${accent}33` }}>
                    {generatingCopy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI Generate Copy
                  </button>
                </div>
                <input value={form.creative?.headline || ''} onChange={e => setForm(p => ({ ...p, creative: { ...p.creative!, headline: e.target.value } }))}
                  placeholder="Headline (max 40 chars)" maxLength={40}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-transparent outline-none text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />
                <textarea value={form.creative?.primaryText || ''} onChange={e => setForm(p => ({ ...p, creative: { ...p.creative!, primaryText: e.target.value } }))}
                  placeholder="Primary text — the main body of your ad..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm bg-transparent outline-none text-white resize-none"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />
                <div className="grid grid-cols-2 gap-2">
                  <select value={form.creative?.callToAction || 'LEARN_MORE'} onChange={e => setForm(p => ({ ...p, creative: { ...p.creative!, callToAction: e.target.value } }))}
                    className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(24,24,36,0.8)' }}>
                    {['LISTEN_NOW', 'STREAM_NOW', 'WATCH_NOW', 'SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'GET_OFFER', 'DOWNLOAD'].map(cta => (
                      <option key={cta} value={cta} style={{ background: '#111' }}>{cta.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <input value={form.creative?.linkUrl || ''} onChange={e => setForm(p => ({ ...p, creative: { ...p.creative!, linkUrl: e.target.value } }))}
                    placeholder="Destination URL"
                    className="px-3 py-2 rounded-xl text-sm bg-transparent outline-none text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button onClick={() => saveCampaign(false)} disabled={savingCampaign}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                {savingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                Save Draft
              </button>
              <button onClick={() => saveCampaign(true)} disabled={savingCampaign}
                className="flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)`, color: '#fff' }}>
                {savingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Schedule Campaign
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PUBLISH TAB ── */}
        {activeTab === 'publish' && (
          <motion.div key="publish" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Platform selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Platform</label>
              <div className="flex gap-2">
                {(['instagram', 'tiktok', 'both'] as const).map(p => {
                  const label = p === 'both' ? '🌐 Both' : p === 'instagram' ? '📸 Instagram' : '🎵 TikTok';
                  const color = p === 'instagram' ? '#e1306c' : p === 'tiktok' ? '#ff0050' : accent;
                  return (
                    <button key={p} onClick={() => setPublishForm(prev => ({ ...prev, platform: p }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: publishForm.platform === p ? `${color}22` : 'rgba(255,255,255,0.04)',
                        color: publishForm.platform === p ? color : 'rgba(255,255,255,0.3)',
                        border: `1.5px solid ${publishForm.platform === p ? color + '55' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Media type toggle */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Content Type</label>
              <div className="flex gap-2">
                {(['image', 'video'] as const).map(t => (
                  <button key={t} onClick={() => setPublishForm(prev => ({ ...prev, mediaType: t }))}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: publishForm.mediaType === t ? `${accent}20` : 'rgba(255,255,255,0.04)',
                      color: publishForm.mediaType === t ? accent : 'rgba(255,255,255,0.3)',
                      border: `1.5px solid ${publishForm.mediaType === t ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {t === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    {t === 'image' ? 'Image' : 'Video'}
                  </button>
                ))}
              </div>
            </div>

            {/* Content picker */}
            {publishForm.mediaType === 'image' ? (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35">Select Image</label>
                {loadingCreatives ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
                ) : creatives.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-4">No images in your library. Generate some in Promo Clips or Character Pack.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {creatives.map((c, i) => {
                      const selected = publishForm.selectedImageUrl === c.url;
                      return (
                        <button key={i} onClick={() => setPublishForm(prev => ({ ...prev, selectedImageUrl: c.url }))}
                          className="relative rounded-xl overflow-hidden group"
                          style={{ aspectRatio: '1', border: `2px solid ${selected ? accent : 'transparent'}` }}>
                          <img src={c.url} alt={c.label} className="w-full h-full object-cover" />
                          {selected && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: accent }}><CheckCircle className="w-2.5 h-2.5 text-white" /></div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35">Select Video</label>
                {loadingVideos ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
                ) : videos.length === 0 ? (
                  <div className="text-center py-4 space-y-1">
                    <p className="text-white/30 text-xs">No videos found in your library.</p>
                    <p className="text-white/20 text-[10px]">Generate promo clips in the Cinematic Promo Engine first</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {videos.map((v, i) => {
                      const selected = publishForm.selectedVideoUrl === v.url;
                      return (
                        <button key={i} onClick={() => setPublishForm(prev => ({ ...prev, selectedVideoUrl: v.url }))}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all"
                          style={{
                            background: selected ? `${accent}15` : 'rgba(255,255,255,0.04)',
                            border: `1.5px solid ${selected ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
                          }}>
                          {v.thumbnail ? (
                            <img src={v.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}20` }}>
                              <Video className="w-4 h-4" style={{ color: accent }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate">{v.label}</p>
                            <p className="text-white/30 text-[9px] truncate">{v.source}</p>
                          </div>
                          {selected && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
                <button onClick={loadVideos} className="w-full mt-1 py-1 text-[10px] text-white/25 hover:text-white/45 flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            )}

            {/* Caption + Hashtags */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35">Caption</label>
              <textarea value={publishForm.caption}
                onChange={e => setPublishForm(prev => ({ ...prev, caption: e.target.value }))}
                placeholder={`Check out my latest release! 🎵\n\nStream on all platforms — link in bio`}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white resize-none"
                style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }} />
              <input value={publishForm.hashtags}
                onChange={e => setPublishForm(prev => ({ ...prev, hashtags: e.target.value }))}
                placeholder="#newmusic #artist #boostify"
                className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }} />
            </div>

            {/* TikTok notice */}
            {(publishForm.platform === 'tiktok' || publishForm.platform === 'both') && (
              <div className="p-3 rounded-xl flex items-start gap-2" style={{ background: 'rgba(255,0,80,0.08)', border: '1px solid rgba(255,0,80,0.2)' }}>
                <Music2 className="w-4 h-4 text-[#ff0050] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#ff9090]">TikTok requires your account to be connected via OAuth (Connect tab) and <strong>video.publish</strong> scope approved by TikTok. Only video content can be posted.</p>
              </div>
            )}

            <button onClick={publishNow} disabled={publishing}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {publishing ? 'Publishing...' : 'Publish Now'}
            </button>
          </motion.div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === 'schedule' && (
          <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* New scheduled post form */}
            <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/35">Schedule New Post</p>

              {/* Platform */}
              <div className="flex gap-2">
                {(['instagram', 'tiktok'] as const).map(p => {
                  const color = p === 'instagram' ? '#e1306c' : '#ff0050';
                  return (
                    <button key={p} onClick={() => setScheduleForm(prev => ({ ...prev, platform: p }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: scheduleForm.platform === p ? `${color}22` : 'rgba(255,255,255,0.04)',
                        color: scheduleForm.platform === p ? color : 'rgba(255,255,255,0.3)',
                        border: `1.5px solid ${scheduleForm.platform === p ? color + '55' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {p === 'instagram' ? '📸 Instagram' : '🎵 TikTok'}
                    </button>
                  );
                })}
              </div>

              {/* Media type */}
              <div className="flex gap-2">
                {(['image', 'video'] as const).map(t => (
                  <button key={t} onClick={() => setScheduleForm(prev => ({ ...prev, mediaType: t }))}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: scheduleForm.mediaType === t ? `${accent}20` : 'rgba(255,255,255,0.04)',
                      color: scheduleForm.mediaType === t ? accent : 'rgba(255,255,255,0.3)',
                      border: `1.5px solid ${scheduleForm.mediaType === t ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {t === 'image' ? <ImageIcon className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                    {t === 'image' ? 'Image' : 'Video'}
                  </button>
                ))}
              </div>

              {/* Content selector (mini) */}
              {scheduleForm.mediaType === 'image' ? (
                <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto">
                  {creatives.slice(0, 20).map((c, i) => {
                    const sel = scheduleForm.selectedImageUrl === c.url;
                    return (
                      <button key={i} onClick={() => setScheduleForm(prev => ({ ...prev, selectedImageUrl: c.url }))}
                        className="relative rounded-lg overflow-hidden" style={{ aspectRatio: '1', border: `2px solid ${sel ? accent : 'transparent'}` }}>
                        <img src={c.url} alt="" className="w-full h-full object-cover" />
                        {sel && <div className="absolute inset-0 flex items-center justify-center" style={{ background: `${accent}55` }}><CheckCircle className="w-3 h-3 text-white" /></div>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {videos.slice(0, 10).map((v, i) => {
                    const sel = scheduleForm.selectedVideoUrl === v.url;
                    return (
                      <button key={i} onClick={() => setScheduleForm(prev => ({ ...prev, selectedVideoUrl: v.url }))}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-left transition-all"
                        style={{ background: sel ? `${accent}15` : 'rgba(255,255,255,0.04)', border: `1.5px solid ${sel ? accent + '44' : 'transparent'}` }}>
                        <Video className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                        <span className="text-white text-[10px] truncate">{v.label}</span>
                        {sel && <CheckCircle className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: accent }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Caption */}
              <textarea value={scheduleForm.caption}
                onChange={e => setScheduleForm(prev => ({ ...prev, caption: e.target.value }))}
                placeholder="Caption..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl text-sm bg-transparent outline-none text-white resize-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />

              {/* Date/time + hashtags */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">Publish At</label>
                  <input type="datetime-local" value={scheduleForm.scheduledAt}
                    onChange={e => setScheduleForm(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-transparent outline-none text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', colorScheme: 'dark' }} />
                </div>
                <div>
                  <label className="block text-[10px] text-white/30 mb-1">Hashtags</label>
                  <input value={scheduleForm.hashtags}
                    onChange={e => setScheduleForm(prev => ({ ...prev, hashtags: e.target.value }))}
                    placeholder="#newmusic"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-transparent outline-none text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }} />
                </div>
              </div>

              <button onClick={schedulePost} disabled={savingSchedule}
                className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
                Schedule Post
              </button>
            </div>

            {/* Scheduled posts list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/35">{scheduledPosts.filter(p => p.status === 'pending').length} Pending Posts</p>
                <button onClick={loadScheduledPosts} className="text-[10px] text-white/25 hover:text-white/45 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {loadingScheduled ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
              ) : scheduledPosts.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarClock className="w-8 h-8 mx-auto text-white/15 mb-2" />
                  <p className="text-white/30 text-xs">No scheduled posts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledPosts.map(post => (
                    <ScheduledPostCard key={post.id} post={post} onCancel={() => cancelScheduled(post.id)} accent={accent} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── CONNECT TAB ── */}
        {activeTab === 'connect' && (
          <motion.div key="connect" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
            <div className="p-3 rounded-xl flex items-start gap-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-300">Credentials are stored encrypted in your private Firestore. They are never sent to third parties other than the respective ad platforms.</p>
            </div>

            {/* Meta (Facebook + Instagram) */}
            <CredentialSection
              platform="meta"
              title="Meta Ads (Facebook + Instagram)"
              icon={<Facebook className="w-4 h-4" />}
              color="#1877f2"
              connected={!!facebookConnected}
              guide="Create an app at developers.facebook.com → Marketing API → Generate a System User Token with ads_management permission."
              fields={[
                { key: 'facebookAccessToken', label: 'Access Token', placeholder: 'EAAxxxxxxxxxxxxxxxx...' },
                { key: 'facebookAdAccountId', label: 'Ad Account ID', placeholder: 'act_123456789' },
                { key: 'facebookAppId', label: 'App ID (optional)', placeholder: '1234567890' },
                { key: 'instagramAccountId', label: 'Instagram Account ID (optional)', placeholder: '17841xxxxxxxxxx' },
              ]}
              form={credsForm}
              onChange={(key, val) => setCredsForm(p => ({ ...p, [key]: val }))}
              credentials={credentials}
            />

            {/* TikTok */}
            <CredentialSection
              platform="tiktok"
              title="TikTok Ads"
              icon={<Music2 className="w-4 h-4" />}
              color="#ff0050"
              connected={!!tiktokConnected}
              guide="Go to ads.tiktok.com → Assets → Developer Access → Create App → Get your Access Token and Advertiser ID."
              fields={[
                { key: 'tiktokAccessToken', label: 'Access Token', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxx' },
                { key: 'tiktokAdvertiserId', label: 'Advertiser ID', placeholder: '7xxxxxxxxxxxxxxxx' },
                { key: 'tiktokAppId', label: 'App ID (optional)', placeholder: '7xxxxxxxxxxxxxxxx' },
              ]}
              form={credsForm}
              onChange={(key, val) => setCredsForm(p => ({ ...p, [key]: val }))}
              credentials={credentials}
            />

            <button onClick={saveCredentials} disabled={savingCreds || Object.keys(credsForm).length === 0}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
              {savingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Save Credentials
            </button>
          </motion.div>
        )}

        {/* ── STUDIO TAB ── */}
        {activeTab === 'studio' && (
          <motion.div key="studio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Reference image */}
            <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/35">Reference Image</span>
                <span className="text-[10px] text-white/25">Used to maintain artist likeness</span>
              </div>

              {/* Profile image preview + override */}
              <div className="flex gap-3 items-start">
                {studioRefImage && (
                  <img src={studioRefImage} alt="Reference" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 ring-2" style={{ ringColor: accent }} />
                )}
                <div className="flex-1 space-y-2">
                  {!studioRefImage && !artistProfileImageUrl && (
                    <p className="text-white/30 text-xs">No artist profile image found. Enter a URL or select from library.</p>
                  )}
                  {(studioRefImage || artistProfileImageUrl) && (
                    <p className="text-white/40 text-[10px]">Artist profile image detected ✓</p>
                  )}
                  <input
                    value={studioRefImage}
                    onChange={e => setStudioRefImage(e.target.value)}
                    placeholder="Override with another image URL..."
                    className="w-full px-3 py-2 rounded-xl text-xs bg-transparent outline-none text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
                  />
                  {creatives.length > 0 && (
                    <div className="grid grid-cols-6 gap-1 max-h-20 overflow-y-auto">
                      {creatives.slice(0, 12).map((c, i) => (
                        <button key={i} onClick={() => setStudioRefImage(c.url)}
                          className="relative rounded-lg overflow-hidden"
                          style={{ aspectRatio: '1', border: `2px solid ${studioRefImage === c.url ? accent : 'transparent'}` }}>
                          <img src={c.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scene selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Content Scene</label>
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.entries(SCENE_META) as [ContentScene, typeof SCENE_META[ContentScene]][]).map(([key, meta]) => (
                  <button key={key} onClick={() => setStudioScene(key)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                    style={{
                      background: studioScene === key ? `${meta.color}15` : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${studioScene === key ? meta.color + '55' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <span className="text-xl">{meta.emoji}</span>
                    <div className="flex-1">
                      <p className="text-white font-semibold text-xs">{meta.label}</p>
                      <p className="text-white/35 text-[10px]">{meta.desc}</p>
                    </div>
                    {studioScene === key && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: meta.color }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Options: aspect ratio + count */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Format</label>
                <div className="space-y-1">
                  {([['1:1', '⬛ Square', 'Instagram Feed'], ['9:16', '📱 Story', 'Reels / TikTok'], ['16:9', '🖥️ Wide', 'YouTube / FB']] as const).map(([ratio, icon, label]) => (
                    <button key={ratio} onClick={() => setStudioAspect(ratio)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: studioAspect === ratio ? `${accent}20` : 'rgba(255,255,255,0.04)',
                        color: studioAspect === ratio ? accent : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${studioAspect === ratio ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      <span>{icon}</span>
                      <span className="flex-1 text-left">{label}</span>
                      <span className="text-[9px] text-white/25">{ratio}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Images</label>
                <div className="space-y-1">
                  {([1, 2, 4] as const).map(n => (
                    <button key={n} onClick={() => setStudioCount(n)}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: studioCount === n ? `${accent}20` : 'rgba(255,255,255,0.04)',
                        color: studioCount === n ? accent : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${studioCount === n ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {n === 1 ? '1 image' : n === 2 ? '2 images' : '4 images (grid)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate button */}
            <button onClick={generateContent} disabled={studioGenerating}
              className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)`, boxShadow: studioGenerating ? 'none' : `0 0 24px ${accent}44` }}>
              {studioGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generating with FAL AI...</>
              ) : (
                <><Sparkles className="w-4 h-4" />Generate {studioCount} {SCENE_META[studioScene].label} Image{studioCount > 1 ? 's' : ''}</>
              )}
            </button>

            {/* Generated results */}
            {studioGenerated.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/35">Generated Content</span>
                  <button onClick={() => setStudioGenerated([])} className="text-[10px] text-white/25 hover:text-white/45">Clear</button>
                </div>
                <div className={`grid gap-2 ${studioGenerated.length === 1 ? 'grid-cols-1' : studioGenerated.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                  {studioGenerated.map((img, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden group"
                      style={{ aspectRatio: img.aspectRatio === '9:16' ? '9/16' : img.aspectRatio === '16:9' ? '16/9' : '1' }}>
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                        <span className="text-white text-[10px] text-center font-medium">{SCENE_META[img.scene as ContentScene]?.emoji} {img.scene.replace('_', ' ')}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setPublishForm(prev => ({ ...prev, selectedImageUrl: img.url, mediaType: 'image' }))}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
                            style={{ background: '#e1306c' }}
                            title="Post to Instagram">
                            🚀 Post
                          </button>
                          <button
                            onClick={() => setScheduleForm(prev => ({ ...prev, selectedImageUrl: img.url, mediaType: 'image' }))}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
                            style={{ background: accent }}
                            title="Schedule post">
                            🗓️ Schedule
                          </button>
                        </div>
                        <a href={img.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-white/60 hover:text-white/90">
                          <ExternalLink className="w-3 h-3" /> Download
                        </a>
                      </div>
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold text-white"
                          style={{ background: SCENE_META[img.scene as ContentScene]?.color || accent }}>
                          {SCENE_META[img.scene as ContentScene]?.emoji}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/25 text-center">Images auto-saved to Creative Library ✓</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── AUTOPILOT TAB ── */}
        {activeTab === 'autopilot' && (
          <motion.div key="autopilot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Header */}
            <div className="text-center py-3">
              <div className="text-4xl mb-1.5">🤖</div>
              <h2 className="text-white font-bold text-base">Content Autopilot</h2>
              <p className="text-white/40 text-xs mt-0.5">Your AI team publishes for you 24/7 — no action needed</p>
            </div>

            {/* Mode selector */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Publishing Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAutopilotMode(true)}
                  className="py-3 px-3 rounded-xl text-left transition-all"
                  style={{ background: autopilotMode ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)', border: autopilotMode ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="text-sm font-bold text-white">🚀 Auto-Publish</div>
                  <div className="text-[10px] mt-0.5" style={{ color: autopilotMode ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)' }}>Posts go live automatically</div>
                </button>
                <button
                  onClick={() => setAutopilotMode(false)}
                  className="py-3 px-3 rounded-xl text-left transition-all"
                  style={{ background: !autopilotMode ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(255,255,255,0.05)', border: !autopilotMode ? 'none' : '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="text-sm font-bold text-white">✋ Review Mode</div>
                  <div className="text-[10px] mt-0.5" style={{ color: !autopilotMode ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)' }}>You approve each post first</div>
                </button>
              </div>
            </div>

            {/* Activate panel — shown only before first activation */}
            {!autopilotLoaded || autopilotPosts.length === 0 ? (
              <div className="rounded-2xl p-5 text-center space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {!calendarPosts.length ? (
                  <div className="space-y-2">
                    <div className="text-3xl">📅</div>
                    <p className="text-white/50 text-sm">No calendar generated yet.</p>
                    <button onClick={() => setActiveTab('calendar')} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      Go to Calendar tab →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-white font-semibold text-sm">Ready to activate</p>
                      <p className="text-white/40 text-xs">{calendarPosts.length} posts from your calendar · AI will generate visuals automatically</p>
                    </div>
                    <button
                      onClick={activateAutopilot}
                      disabled={autopilotActivating}
                      className="w-full py-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', boxShadow: '0 0 32px rgba(236,72,153,0.3)', opacity: autopilotActivating ? 0.7 : 1 }}
                    >
                      {autopilotActivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-lg">🤖</span>}
                      {autopilotActivating ? 'Activating...' : `Activate Autopilot for ${calendarPosts.length} Days`}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stats row */}
                {(() => {
                  const counts = { pending_approval: 0, scheduled: 0, generating: 0, publishing: 0, published: 0, failed: 0 };
                  autopilotPosts.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
                  const stats = [
                    { label: 'Scheduled', count: counts.scheduled, color: '#34d399' },
                    { label: 'Published', count: counts.published, color: '#94a3b8' },
                    { label: 'Review', count: counts.pending_approval, color: '#f59e0b' },
                    { label: 'Live', count: counts.publishing, color: '#60a5fa' },
                    { label: 'Failed', count: counts.failed, color: '#f87171' },
                  ].filter(s => s.count > 0);
                  return (
                    <div className="flex gap-2 flex-wrap">
                      {stats.map(s => (
                        <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: `${s.color}18`, color: s.color }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: s.color }} />
                          {s.count} {s.label}
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Approve all button — shown only in review mode */}
                {autopilotPosts.some(p => p.status === 'pending_approval') && (
                  <button
                    onClick={approveAllAutopilotPosts}
                    disabled={approvingAll}
                    className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}
                  >
                    {approvingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✅'}
                    {approvingAll ? 'Approving...' : `Approve All ${autopilotPosts.filter(p => p.status === 'pending_approval').length} Pending Posts`}
                  </button>
                )}

                {/* Posts timeline */}
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                  {autopilotPosts.map(post => {
                    const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
                      pending_approval: { label: 'Needs Approval', color: '#f59e0b', dot: '🟡' },
                      scheduled:        { label: 'Scheduled',      color: '#34d399', dot: '🟢' },
                      generating:       { label: 'Generating…',    color: '#a78bfa', dot: '🟣' },
                      publishing:       { label: 'Publishing…',    color: '#60a5fa', dot: '🔵' },
                      published:        { label: 'Published ✓',    color: '#64748b', dot: '✅' },
                      failed:           { label: 'Failed',          color: '#f87171', dot: '❌' },
                    };
                    const s = statusConfig[post.status] || statusConfig.scheduled;
                    const sceneMeta = SCENE_META[post.scene] || { emoji: '🎵', label: post.scene };
                    const isActive = post.status === 'generating' || post.status === 'publishing';

                    return (
                      <div key={post.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${post.status === 'pending_approval' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                        {/* Day badge */}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white" style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                          {post.day}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{sceneMeta.emoji}</span>
                            <span className="text-white text-xs font-semibold truncate">{sceneMeta.label}</span>
                            <span className="text-white/30 text-[10px]">·</span>
                            <span className="text-white/40 text-[10px] capitalize">{post.platform}</span>
                          </div>
                          <div className="text-white/30 text-[9px] mt-0.5">{post.date}</div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-semibold" style={{ color: s.color }}>
                            {isActive ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                            {s.label}
                          </span>
                          {/* Approve button — only for pending_approval */}
                          {post.status === 'pending_approval' && (
                            <button
                              onClick={() => approveAutopilotPost(post.id)}
                              disabled={approvingPostId === post.id}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition-all"
                              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                            >
                              {approvingPostId === post.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '✓'}
                              Approve
                            </button>
                          )}
                          {/* Error tooltip */}
                          {post.status === 'failed' && post.error && (
                            <span className="text-[9px] text-red-400 max-w-20 truncate" title={post.error}>⚠️</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={loadAutopilotPosts} className="flex-1 py-2 rounded-xl text-[10px] font-bold text-white/50 flex items-center justify-center gap-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <RefreshCw className="w-3 h-3" /> Refresh Status
                  </button>
                  <button
                    onClick={resetAutopilot}
                    disabled={resettingAutopilot}
                    className="px-3 py-2 rounded-xl text-[10px] font-bold text-red-400 flex items-center justify-center gap-1.5 transition-all"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)' }}
                  >
                    {resettingAutopilot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Reset
                  </button>
                </div>

                {/* Cron setup note */}
                <div className="rounded-xl p-3 text-[9px] text-white/25 space-y-0.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="font-bold text-white/40">⚙️ Cron Setup (one-time)</p>
                  <p>Configure cron-job.org to POST <code className="text-white/35">boostifymusic.com/api/ads-campaigns/cron/publish-due-posts</code></p>
                  <p>Every 60 min · Header: <code className="text-white/35">x-cron-secret: [CRON_SECRET env var]</code></p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── CALENDAR TAB ── */}
        {activeTab === 'calendar' && (
          <motion.div key="calendar" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Generate button */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">AI Content Calendar</p>
                <p className="text-white/35 text-[10px]">30-day strategy: studio, live shows, viral moments & more</p>
              </div>
              <button onClick={generateCalendar} disabled={calendarGenerating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)`, color: '#fff' }}>
                {calendarGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {calendarPosts.length > 0 ? 'Regenerate' : 'Generate 30-Day Plan'}
              </button>
            </div>

            {calendarPosts.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: `${accent}12` }}>
                  <CalendarClock className="w-7 h-7" style={{ color: accent }} />
                </div>
                <p className="text-white font-semibold text-sm">No calendar yet</p>
                <p className="text-white/30 text-xs max-w-xs mx-auto">Generate a 30-day AI content plan with varied posts: studio sessions, live shows, viral moments and more — all personalized for {artistName}.</p>
              </div>
            ) : (
              <>
                {/* Calendar grid */}
                <div className="space-y-1.5">
                  {calendarPosts.map(post => {
                    const sceneM = SCENE_META[post.scene] || SCENE_META.studio;
                    const platColor = post.platform === 'tiktok' ? '#ff0050' : '#e1306c';
                    const platIcon = post.platform === 'tiktok' ? '🎵' : '📸';
                    return (
                      <button key={post.day} onClick={() => setCalendarSelectedPost(calendarSelectedPost?.day === post.day ? null : post)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                        style={{
                          background: calendarSelectedPost?.day === post.day ? `${sceneM.color}15` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${calendarSelectedPost?.day === post.day ? sceneM.color + '44' : 'rgba(255,255,255,0.07)'}`,
                        }}>
                        {/* Day badge */}
                        <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center"
                          style={{ background: `${sceneM.color}20`, border: `1px solid ${sceneM.color}33` }}>
                          <span className="text-[9px] text-white/40 leading-none">{new Date(post.date + 'T12:00:00').toLocaleDateString('en', { month: 'short' })}</span>
                          <span className="text-base font-black leading-tight" style={{ color: sceneM.color }}>{new Date(post.date + 'T12:00:00').getDate()}</span>
                        </div>

                        {/* Content info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold" style={{ color: sceneM.color }}>{sceneM.emoji} {sceneM.label}</span>
                            <span className="text-[10px] font-medium" style={{ color: platColor }}>{platIcon} {post.platform}</span>
                            <span className="text-[9px] text-white/25 uppercase">{post.contentType}</span>
                          </div>
                          <p className="text-white/55 text-[10px] leading-tight truncate">
                            {post.engagementHook || post.caption.slice(0, 60)}
                          </p>
                        </div>

                        <ChevronDown className="w-3.5 h-3.5 text-white/20 flex-shrink-0" style={{ transform: calendarSelectedPost?.day === post.day ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>
                    );
                  })}
                </div>

                {/* Expanded post detail */}
                <AnimatePresence>
                  {calendarSelectedPost && (
                    <motion.div
                      key={calendarSelectedPost.day}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${SCENE_META[calendarSelectedPost.scene]?.color || accent}33` }}>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{SCENE_META[calendarSelectedPost.scene]?.emoji}</span>
                          <div>
                            <p className="text-white font-bold text-sm">{SCENE_META[calendarSelectedPost.scene]?.label}</p>
                            <p className="text-white/40 text-[10px]">{calendarSelectedPost.date} · {calendarSelectedPost.platform} · {calendarSelectedPost.contentType}</p>
                          </div>
                        </div>

                        {calendarSelectedPost.engagementHook && (
                          <div className="p-2.5 rounded-xl" style={{ background: `${accent}12` }}>
                            <p className="text-[10px] text-white/40 mb-0.5 font-bold">Hook</p>
                            <p className="text-white/80 text-xs font-semibold">"{calendarSelectedPost.engagementHook}"</p>
                          </div>
                        )}

                        <div>
                          <p className="text-[10px] text-white/35 mb-1 font-bold uppercase tracking-wider">Caption</p>
                          <p className="text-white/65 text-xs leading-relaxed">{calendarSelectedPost.caption}</p>
                        </div>

                        <div>
                          <p className="text-[10px] text-white/35 mb-1 font-bold uppercase tracking-wider">Hashtags</p>
                          <p className="text-white/50 text-[10px]">{calendarSelectedPost.hashtags}</p>
                        </div>

                        <div>
                          <p className="text-[10px] text-white/35 mb-1 font-bold uppercase tracking-wider">Visual Direction</p>
                          <p className="text-white/50 text-[10px] italic">{calendarSelectedPost.visualPrompt}</p>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => { setActiveTab('studio'); setStudioScene(calendarSelectedPost.scene); setCalendarSelectedPost(null); }}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                            style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}33` }}>
                            <Sparkles className="w-3.5 h-3.5" /> Generate Visual
                          </button>
                          <button
                            onClick={() => scheduleCalendarPost(calendarSelectedPost)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-white"
                            style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}>
                            <CalendarClock className="w-3.5 h-3.5" /> Schedule
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-5">

            {/* Paid Ads stats summary */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/35 mb-2">Paid Campaigns</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Impressions', value: totalImpressions.toLocaleString(), icon: <Eye className="w-4 h-4" />, color: '#a78bfa' },
                  { label: 'Clicks', value: totalClicks.toLocaleString(), icon: <MousePointer className="w-4 h-4" />, color: '#60a5fa' },
                  { label: 'Spend', value: `$${totalSpend.toFixed(2)}`, icon: <DollarSign className="w-4 h-4" />, color: '#fbbf24' },
                  { label: 'Avg CTR', value: totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : '—', icon: <TrendingUp className="w-4 h-4" />, color: '#34d399' },
                ].map(stat => (
                  <div key={stat.label} className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="flex items-center gap-1.5 mb-1.5" style={{ color: stat.color }}>{stat.icon}<span className="text-[9px] font-bold uppercase tracking-wide text-white/40">{stat.label}</span></div>
                    <p className="text-white font-black text-lg">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* TikTok organic analytics */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">TikTok Videos</p>
                <button onClick={loadTikTokAnalytics} className="text-[10px] text-white/25 hover:text-white/45 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              {loadingTikTokAnalytics ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
              ) : tiktokVideos.length === 0 ? (
                <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(255,0,80,0.05)', border: '1px solid rgba(255,0,80,0.1)' }}>
                  <Music2 className="w-6 h-6 mx-auto text-white/20 mb-2" />
                  <p className="text-white/30 text-xs">No TikTok videos yet. Connect your TikTok account and post content.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tiktokVideos.map(v => (
                    <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {v.cover_image_url && <img src={v.cover_image_url} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{v.title || 'Untitled'}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] text-white/40 flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" /> {(v.view_count || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-white/40 flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" /> {(v.like_count || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-white/40 flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" /> {(v.comment_count || 0).toLocaleString()}</span>
                          <span className="text-[10px] text-white/40 flex items-center gap-0.5"><Share2 className="w-2.5 h-2.5" /> {(v.share_count || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {v.share_url && (
                        <a href={v.share_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <ExternalLink className="w-3.5 h-3.5 text-white/20 hover:text-white/50" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instagram organic media */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">Instagram Posts</p>
                <button onClick={loadIgAnalytics} className="text-[10px] text-white/25 hover:text-white/45 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              {loadingIgAnalytics ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
              ) : igMedia.length === 0 ? (
                <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(225,48,108,0.05)', border: '1px solid rgba(225,48,108,0.1)' }}>
                  <Instagram className="w-6 h-6 mx-auto text-white/20 mb-2" />
                  <p className="text-white/30 text-xs">Configure Meta credentials in Connect tab to see Instagram analytics.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {igMedia.slice(0, 9).map(m => (
                    <div key={m.id} className="rounded-xl overflow-hidden relative group" style={{ aspectRatio: '1' }}>
                      <img src={m.thumbnail_url || m.media_url || ''} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <span className="text-white text-[10px] flex items-center gap-1"><Heart className="w-3 h-3" /> {m.like_count || 0}</span>
                        <span className="text-white text-[10px] flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {m.comments_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Paid campaigns breakdown */}
            {campaigns.filter(c => c.stats?.impressions).length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">By Campaign</p>
                {campaigns.filter(c => c.stats?.impressions).map(c => (
                  <div key={c.id} className="p-3 rounded-xl flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-xs font-semibold truncate">{c.name}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-white/35">{(c.stats?.impressions || 0).toLocaleString()} impr.</span>
                        <span className="text-[10px] text-white/35">{(c.stats?.clicks || 0).toLocaleString()} clicks</span>
                        <span className="text-[10px] text-white/35">${(c.stats?.spend || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {c.platforms.map(p => (
                        <div key={p} style={{ color: PLATFORM_META[p].color }}>{PLATFORM_META[p].icon}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CampaignCard ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign, launching, onLaunch, onDelete, accent }: {
  campaign: AdCampaign;
  launching: boolean;
  onLaunch: () => void;
  onDelete: () => void;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_STYLE[campaign.status];
  const objective = OBJECTIVES.find(o => o.id === campaign.objective);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        {/* Creative thumb */}
        {campaign.creative?.imageUrl ? (
          <img src={campaign.creative.imageUrl} alt="" className="w-12 h-16 object-cover rounded-xl flex-shrink-0" />
        ) : (
          <div className="w-12 h-16 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15` }}>
            <ImageIcon className="w-5 h-5" style={{ color: accent }} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white font-bold text-sm truncate">{campaign.name}</p>
            <span className="flex-shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-white/35">
            <span>{objective?.emoji} {objective?.label}</span>
            <span>${campaign.budgetAmount}/{campaign.budgetType === 'daily' ? 'day' : 'total'}</span>
            <span>{campaign.startDate}</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5">
            {campaign.platforms.map(p => (
              <span key={p} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md font-medium"
                style={{ background: PLATFORM_META[p].bg, color: PLATFORM_META[p].color }}>
                {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
            <button onClick={e => { e.stopPropagation(); onLaunch(); }} disabled={launching}
              className="p-2 rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)`, color: '#fff' }}>
              {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
            className="p-2 rounded-xl text-white/30 hover:text-white/60 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="p-4 space-y-3">
              {campaign.creative?.headline && (
                <div>
                  <p className="text-[10px] text-white/30 mb-0.5">Headline</p>
                  <p className="text-white text-sm font-semibold">"{campaign.creative.headline}"</p>
                </div>
              )}
              {campaign.creative?.primaryText && (
                <div>
                  <p className="text-[10px] text-white/30 mb-0.5">Primary Text</p>
                  <p className="text-white/70 text-xs leading-relaxed">{campaign.creative.primaryText}</p>
                </div>
              )}
              {campaign.creative?.linkUrl && (
                <a href={campaign.creative.linkUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink className="w-3 h-3" /> {campaign.creative.linkUrl}
                </a>
              )}
              {campaign.stats?.impressions !== undefined && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: 'Impressions', value: (campaign.stats.impressions || 0).toLocaleString() },
                    { label: 'Clicks', value: (campaign.stats.clicks || 0).toLocaleString() },
                    { label: 'Spend', value: `$${(campaign.stats.spend || 0).toFixed(2)}` },
                  ].map(s => (
                    <div key={s.label} className="p-2 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-white font-bold text-sm">{s.value}</p>
                      <p className="text-white/30 text-[9px]">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-red-400 hover:text-red-300 transition-colors" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CredentialSection ────────────────────────────────────────────────────────

function CredentialSection({ platform, title, icon, color, connected, guide, fields, form, onChange, credentials }: {
  platform: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  connected: boolean;
  guide: string;
  fields: Array<{ key: string; label: string; placeholder: string }>;
  form: Record<string, string>;
  onChange: (key: string, val: string) => void;
  credentials: Record<string, any>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${connected ? color + '33' : 'rgba(255,255,255,0.08)'}` }}>
      <button className="w-full p-4 flex items-center gap-3 text-left" onClick={() => setExpanded(v => !v)}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20`, color }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{title}</p>
          <p className="text-[10px]" style={{ color: connected ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
            {connected ? '● Connected' : '○ Not connected — tap to configure'}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }}
            className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-xl text-xs text-white/40 leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="font-bold text-white/60">How to get credentials: </span>{guide}
              </div>
              {fields.map(f => (
                <div key={f.key}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5">{f.label}</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={form[f.key] || ''}
                      onChange={e => onChange(f.key, e.target.value)}
                      placeholder={credentials[`${f.key}Set`] ? '••••••••••• (already set)' : f.placeholder}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white pr-10"
                      style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
                      autoComplete="new-password"
                    />
                    {credentials[`${f.key}Set`] && !form[f.key] && (
                      <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ScheduledPostCard ────────────────────────────────────────────────────────

function ScheduledPostCard({ post, onCancel, accent }: {
  post: ScheduledPost;
  onCancel: () => void;
  accent: string;
}) {
  const platformColor = post.platform === 'tiktok' ? '#ff0050' : '#e1306c';
  const platformLabel = post.platform === 'tiktok' ? '🎵 TikTok' : '📸 Instagram';
  const scheduledDate = new Date(post.scheduledAt);
  const isPast = scheduledDate < new Date();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Thumbnail */}
      {(post.imageUrl || post.videoUrl) ? (
        <div className="w-10 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: `${accent}20` }}>
              <Video className="w-4 h-4" style={{ color: accent }} />
            </div>
          )}
        </div>
      ) : null}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: `${platformColor}20`, color: platformColor }}>
            {platformLabel}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
            post.status === 'published' ? 'text-green-400 bg-green-400/10' :
            post.status === 'failed' ? 'text-red-400 bg-red-400/10' :
            'text-blue-400 bg-blue-400/10'
          }`}>
            {post.status}
          </span>
        </div>
        {post.caption && <p className="text-white text-[10px] truncate">{post.caption.slice(0, 60)}</p>}
        <p className="text-white/35 text-[9px] flex items-center gap-1 mt-0.5">
          <Clock className="w-2.5 h-2.5" />
          {isPast ? 'Due: ' : 'At: '}{scheduledDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {post.status === 'pending' && (
        <button onClick={onCancel} className="flex-shrink-0 p-1.5 rounded-lg text-red-400/60 hover:text-red-400 transition-colors" style={{ background: 'rgba(248,113,113,0.08)' }}>
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
