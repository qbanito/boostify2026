/**
 * Influencer Module — ElevenLabs voice cloning, HeyGen avatar, content pipeline & scheduling
 * Reads masterJson to enrich content topics, voice name, and avatar hints.
 */

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";

// Pipeline statuses that mean a video is still rendering (used to drive live polling)
const IN_PROGRESS_STATUSES = ['draft', 'generating', 'generating_voice', 'generating_avatar', 'generating_broll'];
const isInProgress = (c: any) => IN_PROGRESS_STATUSES.includes(c?.status);
import {
  Mic, Camera, Calendar, Play, Loader2, CheckCircle2,
  AlertCircle, Wand2, ChevronDown, ChevronUp, Settings, Video,
  Clock, Trash2, Upload, Volume2, Eye, Share2, Heart,
  MessageCircle, Megaphone, ArrowRight, Sparkles, Info, Flame,
  Image as ImageIcon, Coins, Zap, ShoppingBag, Music, Rocket,
} from "lucide-react";

interface InfluencerModuleProps {
  userId: number;
  artistName: string;
  isOwner: boolean;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
    textMuted: string;
    bgGradient: string;
    shadow: string;
  };
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const CONTENT_TYPES = [
  { value: 'entertainment',    label: '🎭 Entertainment'  },
  { value: 'educational',      label: '💡 Educational'    },
  { value: 'behind_scenes',    label: '🎬 Behind Scenes'  },
  { value: 'music_breakdown',  label: '🎵 Music Breakdown'},
  { value: 'opinion',          label: '🔥 Hot Take'       },
  { value: 'collab_call',      label: '🤝 Collab Call'    },
  { value: 'challenge',        label: '⚡ Challenge'       },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily', desc: '1 video/day' },
  { value: 'weekly', label: 'Weekly', desc: 'Recommended' },
  { value: 'biweekly', label: 'Bi-weekly', desc: 'Every 2 weeks' },
  { value: 'custom', label: 'Custom', desc: 'Set your own' },
];

// -- Reference video URLs for demo loop --
const DEMO_VIDEOS = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
];

export function InfluencerModule({ userId, artistName, isOwner, colors, isExpanded: isExpandedProp, onToggleExpand }: InfluencerModuleProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userEmail = (user as any)?.email || '';
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = isExpandedProp !== undefined ? isExpandedProp : internalExpanded;
  const [activeTab, setActiveTab] = useState<'preview' | 'create' | 'viral' | 'setup' | 'schedule'>('preview');

  // -- Queries --
  const { data: masterJsonData } = useQuery({
    queryKey: [`/api/artist-generator/${userId}/master-json`],
    enabled: !!userId,
    retry: false, // gracefully skip if not AI-generated artist
  });

  const { data: voiceData } = useQuery({
    queryKey: [`/api/influencer/voice/${userId}`],
    enabled: !!userId,
  });

  const { data: avatarData } = useQuery({
    queryKey: [`/api/influencer/avatar/${userId}`],
    enabled: !!userId,
  });

  const { data: contentData } = useQuery({
    queryKey: [`/api/influencer/content/${userId}`],
    enabled: !!userId,
    // Live-poll while any video is still rendering so the UI updates itself.
    refetchInterval: (q: any) => {
      const items = (q.state.data as any)?.content || [];
      return Array.isArray(items) && items.some(isInProgress) ? 4000 : false;
    },
  });

  const { data: publishedData } = useQuery({
    queryKey: [`/api/influencer/content/published/${userId}`],
    enabled: !!userId && !isOwner,
  });

  const { data: scheduleData } = useQuery({
    queryKey: [`/api/influencer/schedule/${userId}`],
    enabled: !!userId && isOwner,
  });

  const masterJson = (masterJsonData as any)?.masterJson ?? null;
  const voiceProfile = (voiceData as any)?.profile;
  const avatarProfile = (avatarData as any)?.profile;
  const contentItems = isOwner ? (contentData as any)?.content || [] : (publishedData as any)?.content || [];
  const scheduleConfig = (scheduleData as any)?.config;
  const hasSetup = !!(voiceProfile && avatarProfile);
  const hasVoice = !!voiceProfile;
  const hasAvatar = !!avatarProfile;

  // Derived from masterJson
  const genre        = masterJson?.musical_dna?.primary_genre || '';
  const aesthetic    = masterJson?.visual_dna?.aesthetic || '';
  const archetype    = masterJson?.persona?.archetype_name || '';
  const accentColors = masterJson?.visual_dna?.color_palette || [];

  if (!isOwner && contentItems.length === 0) return null;

  const tabs = isOwner
    ? [
        { id: 'preview' as const, label: 'Preview', icon: Video },
        { id: 'create' as const, label: 'Create', icon: Wand2 },
        { id: 'viral' as const, label: 'Viral Studio', icon: Flame },
        { id: 'setup' as const, label: 'Setup', icon: Settings },
        { id: 'schedule' as const, label: 'Schedule', icon: Calendar },
      ]
    : [{ id: 'preview' as const, label: 'Content', icon: Video }];

  return (
    <div
      className="rounded-3xl overflow-hidden transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(15,15,20,0.98) 100%)`,
        borderWidth: '1px',
        borderColor: colors.hexBorder,
        boxShadow: `0 0 40px ${colors.hexAccent}10`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => onToggleExpand ? onToggleExpand() : setInternalExpanded(!internalExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `${colors.hexAccent}20` }}
          >
            <Megaphone className="h-5 w-5" style={{ color: colors.hexAccent }} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              AI Influencer Studio
              {contentItems.length > 0 && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: colors.hexAccent + '25', color: colors.hexAccent }}
                >
                  {contentItems.length} videos
                </span>
              )}
            </div>
            <div className="text-[11px] text-gray-500">
              {hasSetup
                ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-green-400">●</span>
                    Voice &amp; Avatar ready
                    {genre && <span className="text-gray-600">· {genre}{aesthetic ? ` · ${aesthetic}` : ''}</span>}
                  </span>
                )
                : (
                  <span>Clone voice · Create avatar · Generate content</span>
                )
              }
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasVoice && (
            <div className="flex items-center gap-1">
              <Mic className="h-3 w-3 text-green-400" />
              <span className="text-[9px] text-green-400">Voice</span>
            </div>
          )}
          {hasAvatar && (
            <div className="flex items-center gap-1">
              <Camera className="h-3 w-3 text-blue-400" />
              <span className="text-[9px] text-blue-400">Avatar</span>
            </div>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Tab Bar */}
          <div className="flex gap-1 p-1 rounded-2xl bg-black/50 border border-white/5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab.id ? 'text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'
                }`}
                style={activeTab === tab.id ? {
                  backgroundColor: colors.hexAccent + '20',
                  color: colors.hexAccent,
                  boxShadow: `0 2px 12px ${colors.hexAccent}15`,
                } : {}}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Preview Tab � Video Loop + Content Feed */}
          {activeTab === 'preview' && (
            <VideoPreviewSection
              content={contentItems}
              colors={colors}
              isOwner={isOwner}
              artistName={artistName}
            />
          )}

          {/* Create Tab */}
          {activeTab === 'create' && isOwner && (
            <GeneratePanel
              userId={userId}
              colors={colors}
              hasSetup={hasSetup}
              queryClient={queryClient}
              artistName={artistName}
              masterJson={masterJson}
              contentItems={contentItems}
              onGoToPreview={() => setActiveTab('preview')}
            />
          )}

          {/* Viral Studio Tab — Happy Horse + GPT-Image-2 */}
          {activeTab === 'viral' && isOwner && (
            <ViralStudioPanel
              userId={userId}
              userEmail={userEmail}
              colors={colors}
              artistName={artistName}
              queryClient={queryClient}
            />
          )}

          {/* Setup Tab */}
          {activeTab === 'setup' && isOwner && (
            <SetupPanel
              userId={userId}
              colors={colors}
              voiceProfile={voiceProfile}
              avatarProfile={avatarProfile}
              queryClient={queryClient}
              artistName={artistName}
              masterJson={masterJson}
            />
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && isOwner && (
            <SchedulePanel
              userId={userId}
              colors={colors}
              config={scheduleConfig}
              queryClient={queryClient}
            />
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------
// VIDEO PREVIEW � Loop demo with overlay
// -----------------------------------------------

function VideoPreviewSection({ content, colors, isOwner, artistName }: {
  content: any[];
  colors: any;
  isOwner: boolean;
  artistName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [publishMsg, setPublishMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [publishingPlatform, setPublishingPlatform] = useState<'instagram' | 'tiktok' | null>(null);

  // Use real published videos if available, otherwise show demo
  const hasRealContent = content.some((c: any) => c.finalVideoUrl || c.avatarVideoUrl);
  const renderingItem = content.find((c: any) => isInProgress(c)) || null;
  const currentItem = content[currentIndex];
  const videoUrl = hasRealContent && currentItem
    ? (currentItem.finalVideoUrl || currentItem.avatarVideoUrl)
    : null;

  const handlePublish = async (platform: 'instagram' | 'tiktok') => {
    if (!currentItem?.id) return;
    setPublishingPlatform(platform);
    setPublishMsg(null);
    try {
      const response = await fetch(`/api/influencer/content/${currentItem.id}/publish-${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: currentItem.userId }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setPublishMsg({ kind: 'success', text: data.message || `Queued for ${platform}` });
      } else {
        setPublishMsg({ kind: 'error', text: data.error || `Publish to ${platform} failed` });
      }
    } catch (err: any) {
      setPublishMsg({ kind: 'error', text: err.message || 'Network error' });
    } finally {
      setPublishingPlatform(null);
    }
  };

  const goNext = () => {
    if (hasRealContent && content.length > 1) {
      setCurrentIndex((currentIndex + 1) % content.length);
    }
  };

  const goPrev = () => {
    if (hasRealContent && content.length > 1) {
      setCurrentIndex((currentIndex - 1 + content.length) % content.length);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="space-y-3">
      {/* 9:16 Video Container */}
      <div
        className="relative rounded-2xl overflow-hidden bg-black mx-auto"
        style={{
          aspectRatio: '9/16',
          maxHeight: '480px',
          border: `1px solid ${colors.hexBorder}`,
        }}
      >
        {videoUrl ? (
          /* Real content video */
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            onClick={handlePlayPause}
          />
        ) : (
          /* Demo placeholder with animated gradient */
          <div className="w-full h-full relative flex flex-col items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${colors.hexPrimary}30, ${colors.hexAccent}15, #000)`,
            }}
          >
            {/* Animated circles */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse"
                style={{ background: colors.hexAccent, top: '20%', left: '-10%' }}
              />
              <div
                className="absolute w-48 h-48 rounded-full blur-3xl opacity-15 animate-pulse"
                style={{ background: colors.hexPrimary, bottom: '20%', right: '-5%', animationDelay: '1s' }}
              />
            </div>

            {/* Center content */}
            <div className="relative z-10 text-center px-6 space-y-4">
              <div
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                style={{ background: `${colors.hexAccent}20`, border: `2px solid ${colors.hexAccent}40` }}
              >
                {renderingItem
                  ? <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.hexAccent }} />
                  : <Video className="h-8 w-8" style={{ color: colors.hexAccent }} />}
              </div>
              <div>
                <p className="text-white font-bold text-sm">
                  {renderingItem ? 'Rendering your AI video…' : 'Your AI Videos Appear Here'}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  {renderingItem
                    ? 'This updates automatically when it\u2019s ready — a couple of minutes.'
                    : 'Set up your voice & avatar, then generate your first AI influencer video'}
                </p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-2 justify-center">
                  <div className="text-[10px] px-3 py-1 rounded-full bg-white/5 text-gray-400">
                    9:16 Vertical Format
                  </div>
                  <div className="text-[10px] px-3 py-1 rounded-full bg-white/5 text-gray-400">
                    ~$0.82/video
                  </div>
                </div>
              )}
            </div>

            {/* Overlay text banner */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
              <p className="text-white font-bold text-xs">{artistName}</p>
              <p className="text-gray-400 text-[10px]">AI-generated influencer content will appear here</p>
            </div>
          </div>
        )}

        {/* Navigation overlay for real content */}
        {videoUrl && (
          <>
            {/* Left/Right tap zones */}
            <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={goPrev} />
            <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={goNext} />

            {/* Play/Pause center */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center z-5 bg-black/30" onClick={handlePlayPause}>
                <Play className="h-12 w-12 text-white/80" />
              </div>
            )}

            {/* Content info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
              <p className="text-white font-bold text-xs">{currentItem?.title || artistName}</p>
              <p className="text-gray-300 text-[10px] mt-0.5">{currentItem?.topic}</p>
              {currentItem?.hashtags?.length > 0 && (
                <p className="text-[10px] mt-1" style={{ color: colors.hexAccent }}>
                  {currentItem.hashtags.slice(0, 3).map((h: string) => `#${h}`).join(' ')}
                </p>
              )}
            </div>

            {/* Right sidebar engagement */}
            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
              <div className="flex flex-col items-center">
                <Heart className="h-6 w-6 text-white" />
                <span className="text-[10px] text-white mt-0.5">{currentItem?.likes || 0}</span>
              </div>
              <div className="flex flex-col items-center">
                <MessageCircle className="h-6 w-6 text-white" />
                <span className="text-[10px] text-white mt-0.5">{currentItem?.comments || 0}</span>
              </div>
              <div className="flex flex-col items-center">
                <Share2 className="h-6 w-6 text-white" />
                <span className="text-[10px] text-white mt-0.5">{currentItem?.shares || 0}</span>
              </div>
              <div className="flex flex-col items-center">
                <Eye className="h-5 w-5 text-white" />
                <span className="text-[10px] text-white mt-0.5">{currentItem?.views || 0}</span>
              </div>
            </div>

            {/* Page indicator */}
            {content.length > 1 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                {content.slice(0, 8).map((_: any, i: number) => (
                  <div
                    key={i}
                    className={`h-0.5 rounded-full transition-all ${i === currentIndex ? 'w-6' : 'w-2'}`}
                    style={{ backgroundColor: i === currentIndex ? colors.hexAccent : 'rgba(255,255,255,0.3)' }}
                  />
                ))}
              </div>
            )}

            {/* Status badge */}
            {currentItem?.status && (
              <div className="absolute top-3 right-3 z-10">
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: currentItem.status === 'published' ? '#22c55e30' : currentItem.status === 'ready' ? '#3b82f630' : '#eab30830',
                    color: currentItem.status === 'published' ? '#22c55e' : currentItem.status === 'ready' ? '#3b82f6' : '#eab308',
                  }}
                >
                  {currentItem.status}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Content count */}
      {content.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-gray-500">{content.length} video{content.length !== 1 ? 's' : ''} generated</span>
          {hasRealContent && (
            <span className="text-[11px] text-gray-500">
              {currentIndex + 1} / {content.length}
            </span>
          )}
        </div>
      )}

      {/* Publish buttons (owner + has real video) */}
      {isOwner && videoUrl && currentItem?.id && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePublish('instagram')}
              disabled={publishingPlatform !== null}
              className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #833AB4, #FD1D1D, #FCB045)',
                color: 'white',
              }}
            >
              {publishingPlatform === 'instagram'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Queueing...</>
                : <><Rocket className="h-3.5 w-3.5" /> Publish to Instagram</>
              }
            </button>
            <button
              onClick={() => handlePublish('tiktok')}
              disabled={publishingPlatform !== null}
              className="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40 bg-black border border-white/20 text-white"
            >
              {publishingPlatform === 'tiktok'
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Queueing...</>
                : <><Music className="h-3.5 w-3.5" /> Publish to TikTok</>
              }
            </button>
          </div>
          {publishMsg && (
            <div
              className={`flex items-start gap-2 p-2.5 rounded-lg border text-[10px] leading-relaxed ${
                publishMsg.kind === 'success'
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {publishMsg.kind === 'success'
                ? <CheckCircle2 className="h-3 w-3 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              }
              <span>{publishMsg.text}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------
// GENERATE PANEL
// -----------------------------------------------

function GeneratePanel({ userId, colors, hasSetup, queryClient, artistName, masterJson, contentItems, onGoToPreview }: {
  userId: number;
  colors: any;
  hasSetup: boolean;
  queryClient: any;
  artistName: string;
  masterJson?: any;
  contentItems?: any[];
  onGoToPreview?: () => void;
}) {
  const [topic, setTopic] = useState('');
  const [contentType, setContentType] = useState('entertainment');
  const [duration, setDuration] = useState(60);

  // Build smart topic suggestions from masterJson DNA (no extra API call needed)
  const smartTopics: string[] = masterJson ? [
    masterJson.narrative?.current_chapter
      ? `\ud83c\udfa7 ${masterJson.narrative.current_chapter}` : null,
    masterJson.narrative?.breakthrough_moment
      ? `\u2728 My breakthrough moment` : null,
    ...(masterJson.musical_dna?.lyric_themes?.slice(0, 3).map((t: string) =>
      `\ud83d\udcac My thoughts on: ${t}`) ?? []),
    masterJson.persona?.archetype_name
      ? `\ud83d\udc40 Being ${masterJson.persona.archetype_name}` : null,
    ...(masterJson.musical_dna?.influences?.slice(0, 2).map((inf: string) =>
      `\ud83c\udfb6 Inspired by ${inf}`) ?? []),
  ].filter(Boolean).slice(0, 6) as string[] : [];

  // Fall back to API suggestions only if no masterJson context
  const { data: topicsData } = useQuery({
    queryKey: [`influencer-topics-${userId}`],
    queryFn: () => apiRequest({ url: '/api/influencer/topics/suggest', method: 'POST', data: { userId, count: 5 } }),
    enabled: !!userId && hasSetup && smartTopics.length === 0,
  });

  const suggestedTopics = smartTopics.length > 0
    ? smartTopics
    : ((topicsData as any)?.topics || []);

  const generateMutation = useMutation({
    mutationFn: (data: any) => apiRequest({ url: '/api/influencer/content/generate', method: 'POST', data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/influencer/content/${userId}`] }),
  });

  // Live pipeline tracking — the parent polls the content list while anything renders.
  const items = contentItems || [];
  const inProgressItem = items.find(isInProgress) || null;
  const justReady = !inProgressItem && generateMutation.isSuccess
    ? items.find((c: any) => c.status === 'ready' || c.status === 'published')
    : null;
  const STEP_LABELS: Record<string, string> = {
    draft: 'Writing the script…',
    generating: 'Starting pipeline…',
    generating_voice: 'Generating voice audio…',
    generating_avatar: 'Rendering avatar video…',
    generating_broll: 'Adding visual b-roll…',
  };
  const stepLabel = inProgressItem ? (STEP_LABELS[inProgressItem.status] || 'Rendering…') : '';

  if (!hasSetup) {
    return (
      <div className="text-center py-10 space-y-3">
        <div
          className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
          style={{ background: `${colors.hexAccent}15` }}
        >
          <AlertCircle className="h-7 w-7" style={{ color: colors.hexAccent }} />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Setup Required</p>
          <p className="text-gray-500 text-xs mt-1">Clone your voice and create your avatar in the Setup tab first</p>
        </div>
        <div className="flex items-center gap-2 justify-center text-xs">
          <ArrowRight className="h-3 w-3 text-gray-500" />
          <span className="text-gray-500">Go to</span>
          <span style={{ color: colors.hexAccent }} className="font-medium">Setup</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Topic Input */}
      <div>
        <label className="text-xs font-semibold text-gray-300 mb-2 block">What should {artistName} talk about?</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g., My creative process, new album drop..."
          className="w-full bg-black/60 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all"
          style={{ borderColor: colors.hexBorder, ['--tw-ring-color' as any]: colors.hexAccent }}
        />
        {suggestedTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestedTopics.map((t: string, i: number) => (
              <button
                key={i}
                onClick={() => setTopic(t)}
                className="text-[10px] px-2.5 py-1 rounded-full border transition-all hover:scale-105"
                style={{
                  borderColor: topic === t ? colors.hexAccent : 'rgba(255,255,255,0.08)',
                  color: topic === t ? colors.hexAccent : '#9ca3af',
                  background: topic === t ? colors.hexAccent + '10' : 'rgba(255,255,255,0.03)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content Type Grid */}
      <div>
        <label className="text-xs font-semibold text-gray-300 mb-2 block">Content Style</label>
        <div className="grid grid-cols-2 gap-1.5">
          {CONTENT_TYPES.map(ct => (
            <button
              key={ct.value}
              onClick={() => setContentType(ct.value)}
              className={`text-xs py-2 px-3 rounded-xl transition-all text-left ${
                contentType === ct.value ? 'text-white' : 'text-gray-500 hover:text-gray-400'
              }`}
              style={contentType === ct.value ? {
                backgroundColor: colors.hexAccent + '15',
                color: colors.hexAccent,
                border: `1px solid ${colors.hexAccent}30`,
              } : { border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-300">Duration</label>
          <span className="text-xs font-mono" style={{ color: colors.hexAccent }}>{duration}s</span>
        </div>
        <input
          type="range" min={15} max={180} step={15} value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: colors.hexAccent, background: `linear-gradient(to right, ${colors.hexAccent}, ${colors.hexAccent}40)` }}
        />
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>15s</span><span>60s</span><span>120s</span><span>180s</span>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={() => generateMutation.mutate({ userId, topic: topic || 'trending', contentType, targetDurationSec: duration })}
        disabled={generateMutation.isPending || !!inProgressItem}
        className="w-full py-3.5 rounded-2xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: colors.hexAccent, boxShadow: `0 4px 20px ${colors.hexAccent}40` }}
      >
        {generateMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
        ) : inProgressItem ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Rendering Video…</>
        ) : (
          <><Wand2 className="h-4 w-4" /> Generate AI Video</>
        )}
      </button>

      {/* Cost estimate */}
      <p className="text-[10px] text-gray-600 text-center">
        Estimated cost: ~$0.82 per video (script + voice + avatar + rendering)
      </p>

      {/* Live pipeline progress — updates automatically while rendering */}
      {inProgressItem && (
        <div
          className="p-3 rounded-xl border space-y-2"
          style={{ background: colors.hexAccent + '10', borderColor: colors.hexAccent + '30' }}
        >
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.hexAccent }} />
            <span className="text-xs font-semibold text-white">{stepLabel}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full animate-pulse"
              style={{
                width: inProgressItem.status === 'generating_broll' ? '85%'
                  : inProgressItem.status === 'generating_avatar' ? '65%'
                  : inProgressItem.status === 'generating_voice' ? '40%'
                  : '20%',
                background: colors.hexAccent,
              }}
            />
          </div>
          <p className="text-[10px] text-gray-500">
            "{inProgressItem.title || inProgressItem.topic || 'Your video'}" — this can take a couple of minutes. You can keep browsing.
          </p>
        </div>
      )}

      {justReady && (
        <button
          onClick={() => onGoToPreview?.()}
          className="w-full flex items-center gap-2 justify-center p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs text-green-400 font-medium">Video ready! Tap to watch in Preview →</span>
        </button>
      )}

      {generateMutation.isError && (
        <div className="flex items-center gap-2 justify-center p-2 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs text-red-400">{(generateMutation.error as any)?.message || 'Generation failed'}</span>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------
// SETUP PANEL — Voice + Avatar
// -----------------------------------------------

function SetupPanel({ userId, colors, voiceProfile, avatarProfile, queryClient, artistName, masterJson }: {
  userId: number;
  colors: any;
  voiceProfile: any;
  avatarProfile: any;
  queryClient: any;
  artistName: string;
  masterJson?: any;
}) {
  const canonicalName = masterJson?.canonical?.artist_name || artistName;
  const [voiceProvider, setVoiceProvider] = useState<'gemini' | 'elevenlabs'>('gemini');
  const [voiceName, setVoiceName] = useState(canonicalName + "'s Voice");
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState('Aoede');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [voiceSuccess, setVoiceSuccess] = useState('');
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Multi-image avatar upload state (4 slots)
  const [avatarImages, setAvatarImages] = useState<(File | null)[]>([null, null, null, null]);
  const [avatarPreviews, setAvatarPreviews] = useState<(string | null)[]>([null, null, null, null]);
  const [uploadingAvatarMulti, setUploadingAvatarMulti] = useState(false);
  const [avatarMultiError, setAvatarMultiError] = useState('');
  const avatarFileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Fallback profile photo preview (shown before avatar exists)
  const { data: profileImageData } = useQuery({
    queryKey: [`/api/influencer/profile-image/${userId}`],
    enabled: !!userId && !avatarProfile,
    retry: false,
  });
  const profilePhotoUrl = (profileImageData as any)?.imageUrl || null;

  const GEMINI_VOICE_LIST = [
    { id: 'Aoede',  label: 'Aoede',  desc: 'Warm female' },
    { id: 'Charon', label: 'Charon', desc: 'Deep male' },
    { id: 'Fenrir', label: 'Fenrir', desc: 'Bold male' },
    { id: 'Kore',   label: 'Kore',   desc: 'Bright female' },
    { id: 'Puck',   label: 'Puck',   desc: 'Energetic male' },
    { id: 'Zephyr', label: 'Zephyr', desc: 'Airy, modern' },
  ];

  const geminiSetupMutation = useMutation({
    mutationFn: (data: any) => apiRequest({ url: '/api/influencer/voice/gemini-setup', method: 'POST', data }),
    onSuccess: (data: any) => {
      if ((data as any).success) {
        setVoiceSuccess(`Voice "${(data as any).voiceName}" set up via Gemini TTS!`);
        queryClient.invalidateQueries({ queryKey: [`/api/influencer/voice/${userId}`] });
      } else {
        setVoiceError((data as any).error || 'Gemini voice setup failed');
      }
    },
    onError: (err: any) => setVoiceError(err.message || 'Setup failed'),
  });

  const avatarMutation = useMutation({
    mutationFn: (data: any) => apiRequest({ url: '/api/influencer/avatar/create', method: 'POST', data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/influencer/avatar/${userId}`] }),
  });

  const avatarAutoMutation = useMutation({
    mutationFn: () => apiRequest({ url: '/api/influencer/avatar/auto-create', method: 'POST', data: { userId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/influencer/avatar/${userId}`] }),
  });

  const deleteVoiceMutation = useMutation({
    mutationFn: () => apiRequest({ url: `/api/influencer/voice/${userId}`, method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/influencer/voice/${userId}`] }),
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => apiRequest({ url: `/api/influencer/avatar/${userId}`, method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/influencer/avatar/${userId}`] }),
  });

  // Handle voice file upload
  const handleVoiceUpload = useCallback(async (file: File) => {
    setUploadingVoice(true);
    setVoiceError('');
    setVoiceSuccess('');

    try {
      const formData = new window.FormData();
      formData.append('audio', file);
      formData.append('userId', String(userId));
      formData.append('voiceName', voiceName);
      formData.append('language', 'en');

      const response = await fetch('/api/influencer/voice/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setVoiceSuccess(`Voice "${data.voiceName}" cloned via ${data.provider || 'ElevenLabs'}!`);
        queryClient.invalidateQueries({ queryKey: [`/api/influencer/voice/${userId}`] });
      } else {
        setVoiceError(data.error || 'Voice cloning failed');
      }
    } catch (err: any) {
      setVoiceError(err.message || 'Upload failed');
    } finally {
      setUploadingVoice(false);
    }
  }, [userId, voiceName, queryClient]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVoiceUpload(file);
  };

  // Multi-image avatar handlers
  const handleAvatarSlotSelect = (idx: number, file: File | null) => {
    setAvatarImages(prev => {
      const next = [...prev];
      next[idx] = file;
      return next;
    });
    setAvatarPreviews(prev => {
      const next = [...prev];
      if (next[idx]) URL.revokeObjectURL(next[idx]!);
      next[idx] = file ? URL.createObjectURL(file) : null;
      return next;
    });
    setAvatarMultiError('');
  };

  const handleAvatarMultiUpload = useCallback(async () => {
    const files = avatarImages.filter((f): f is File => !!f);
    if (files.length === 0) {
      setAvatarMultiError('Pick at least one photo');
      return;
    }
    setUploadingAvatarMulti(true);
    setAvatarMultiError('');
    try {
      const fd = new window.FormData();
      fd.append('userId', String(userId));
      fd.append('avatarStyle', 'casual');
      files.forEach(f => fd.append('images', f));
      const response = await fetch('/api/influencer/avatar/create-multi', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: [`/api/influencer/avatar/${userId}`] });
        // Clear previews
        avatarPreviews.forEach(p => p && URL.revokeObjectURL(p));
        setAvatarImages([null, null, null, null]);
        setAvatarPreviews([null, null, null, null]);
      } else {
        setAvatarMultiError(data.error || 'Avatar creation failed');
      }
    } catch (err: any) {
      setAvatarMultiError(err.message || 'Upload failed');
    } finally {
      setUploadingAvatarMulti(false);
    }
  }, [avatarImages, avatarPreviews, userId, queryClient]);

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: voiceProfile ? '#22c55e20' : colors.hexAccent + '20',
              color: voiceProfile ? '#22c55e' : colors.hexAccent,
            }}
          >
            {voiceProfile ? '✓' : '1'}
          </div>
          <span className="text-[11px] text-gray-400">Voice</span>
        </div>
        <div className="flex-1 h-px bg-gray-800" />
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: avatarProfile ? '#22c55e20' : colors.hexAccent + '20',
              color: avatarProfile ? '#22c55e' : colors.hexAccent,
            }}
          >
            {avatarProfile ? '✓' : '2'}
          </div>
          <span className="text-[11px] text-gray-400">Avatar</span>
        </div>
        <div className="flex-1 h-px bg-gray-800" />
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: voiceProfile && avatarProfile ? '#22c55e20' : 'rgba(255,255,255,0.05)',
              color: voiceProfile && avatarProfile ? '#22c55e' : '#6b7280',
            }}
          >
            {voiceProfile && avatarProfile ? '✓' : '3'}
          </div>
          <span className="text-[11px] text-gray-400">Create</span>
        </div>
      </div>

      {/* -- Voice Identity Card -- */}
      <div
        className="p-5 rounded-2xl border transition-all"
        style={{
          borderColor: voiceProfile ? '#22c55e30' : colors.hexBorder,
          background: 'rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: voiceProfile ? '#22c55e15' : colors.hexAccent + '15' }}
          >
            <Mic className="h-4 w-4" style={{ color: voiceProfile ? '#22c55e' : colors.hexAccent }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">Voice Identity</div>
            <div className="text-[10px] text-gray-500">
              {voiceProfile
                ? `Active via ${voiceProfile.elevenLabsVoiceId?.startsWith('gemini:') ? 'Gemini TTS' : 'ElevenLabs'}`
                : 'Choose a voice provider below'}
            </div>
          </div>
          {voiceProfile && <CheckCircle2 className="h-4 w-4 text-green-400" />}
        </div>

        {voiceProfile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <Volume2 className="h-4 w-4 text-green-400" />
              <div className="flex-1">
                <span className="text-xs text-white font-medium">{voiceProfile.voiceName}</span>
                {voiceProfile.elevenLabsVoiceId?.startsWith('gemini:') && (
                  <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">
                    Gemini {voiceProfile.elevenLabsVoiceId.replace('gemini:', '')}
                  </span>
                )}
              </div>
            </div>
            {voiceProfile.voiceSampleUrl && (
              <audio src={voiceProfile.voiceSampleUrl} controls className="w-full h-8 opacity-80" />
            )}
            <button
              onClick={() => deleteVoiceMutation.mutate()}
              disabled={deleteVoiceMutation.isPending}
              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Remove voice
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Voice name input */}
            <input
              type="text"
              value={voiceName}
              onChange={e => setVoiceName(e.target.value)}
              placeholder="Voice name..."
              className="w-full bg-black/40 border rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
              style={{ borderColor: colors.hexBorder }}
            />

            {/* Provider tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/5">
              <button
                onClick={() => { setVoiceProvider('gemini'); setVoiceError(''); setVoiceSuccess(''); }}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={voiceProvider === 'gemini'
                  ? { backgroundColor: colors.hexAccent + '20', color: colors.hexAccent }
                  : { color: '#6b7280' }}
              >
                ✨ Gemini TTS
              </button>
              <button
                onClick={() => { setVoiceProvider('elevenlabs'); setVoiceError(''); setVoiceSuccess(''); }}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={voiceProvider === 'elevenlabs'
                  ? { backgroundColor: colors.hexAccent + '20', color: colors.hexAccent }
                  : { color: '#6b7280' }}
              >
                🎙 Clone (ElevenLabs)
              </button>
            </div>

            {/* Gemini: preset voice selector */}
            {voiceProvider === 'gemini' && (
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500">High-quality AI voices — no audio sample needed</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {GEMINI_VOICE_LIST.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedGeminiVoice(v.id)}
                      className="py-2 px-1 rounded-xl text-center transition-all"
                      style={selectedGeminiVoice === v.id ? {
                        backgroundColor: colors.hexAccent + '18',
                        border: `1px solid ${colors.hexAccent}40`,
                        color: colors.hexAccent,
                      } : {
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: '#9ca3af',
                      }}
                    >
                      <div className="text-[11px] font-semibold">{v.label}</div>
                      <div className="text-[9px] opacity-70 mt-0.5">{v.desc}</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => geminiSetupMutation.mutate({ userId, voiceName, geminiVoiceId: selectedGeminiVoice })}
                  disabled={geminiSetupMutation.isPending}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{ backgroundColor: colors.hexAccent }}
                >
                  {geminiSetupMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up...</>
                    : <><Sparkles className="h-4 w-4" /> Use {selectedGeminiVoice}</>
                  }
                </button>
              </div>
            )}

            {/* ElevenLabs: audio upload */}
            {voiceProvider === 'elevenlabs' && (
              <div className="space-y-3">
                <p className="text-[10px] text-gray-500">Upload your voice — ElevenLabs will clone it exactly</p>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => audioInputRef.current?.click()}
                  disabled={uploadingVoice}
                  className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] border"
                  style={{ borderColor: colors.hexAccent + '40', color: colors.hexAccent, background: colors.hexAccent + '08' }}
                >
                  {uploadingVoice
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Cloning...</>
                    : <><Upload className="h-4 w-4" /> Upload Voice Sample</>
                  }
                </button>
                <p className="text-[10px] text-gray-600 text-center">MP3, WAV, M4A · min 10 seconds</p>
              </div>
            )}

            {voiceError && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400">{voiceError}</span>
              </div>
            )}
            {voiceSuccess && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                <span className="text-[10px] text-green-400">{voiceSuccess}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -- Avatar Card -- */}
      <div
        className="p-5 rounded-2xl border transition-all"
        style={{
          borderColor: avatarProfile ? '#22c55e30' : colors.hexBorder,
          background: 'rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: avatarProfile ? '#22c55e15' : colors.hexAccent + '15' }}
          >
            <Camera className="h-4 w-4" style={{ color: avatarProfile ? '#22c55e' : colors.hexAccent }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">AI Avatar</div>
            <div className="text-[10px] text-gray-500">
              {avatarProfile ? 'HeyGen avatar ready' : 'Create a talking avatar from your photo'}
            </div>
          </div>
          {avatarProfile && <CheckCircle2 className="h-4 w-4 text-green-400" />}
        </div>

        {avatarProfile ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {(avatarProfile.avatarPreviewUrl || avatarProfile.sourceImageUrl) && (
                <img
                  src={avatarProfile.avatarPreviewUrl || avatarProfile.sourceImageUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-xl object-cover border border-white/10"
                />
              )}
              <div>
                <div className="text-xs text-white">Style: {avatarProfile.avatarStyle || 'casual'}</div>
                <div className="text-[10px] text-gray-500">HeyGen talking photo avatar</div>
              </div>
            </div>
            <button
              onClick={() => deleteAvatarMutation.mutate()}
              disabled={deleteAvatarMutation.isPending}
              className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" /> Remove avatar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Profile photo fallback preview */}
            {profilePhotoUrl && (
              <div
                className="flex items-center gap-3 p-3 rounded-xl border"
                style={{ borderColor: colors.hexBorder, background: 'rgba(255,255,255,0.02)' }}
              >
                <img
                  src={profilePhotoUrl}
                  alt="Your profile"
                  className="w-14 h-14 rounded-xl object-cover border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white">Current profile photo</div>
                  <div className="text-[10px] text-gray-500">Will be used as primary if you don't upload custom shots</div>
                </div>
              </div>
            )}

            {/* 4-image uploader (2x2 grid) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-white">Upload up to 4 reference photos</p>
                <span className="text-[10px] text-gray-500">{avatarImages.filter(Boolean).length}/4</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3].map((i) => {
                  const preview = avatarPreviews[i];
                  return (
                    <div key={i} className="relative">
                      <input
                        ref={avatarFileRefs[i]}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                        className="hidden"
                        onChange={(e) => handleAvatarSlotSelect(i, e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        onClick={() => avatarFileRefs[i].current?.click()}
                        disabled={uploadingAvatarMulti}
                        className="aspect-square w-full rounded-xl border overflow-hidden flex items-center justify-center transition-all hover:scale-[1.02] disabled:opacity-40"
                        style={{
                          borderColor: preview ? colors.hexAccent + '60' : colors.hexBorder,
                          borderStyle: preview ? 'solid' : 'dashed',
                          background: preview ? 'transparent' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        {preview ? (
                          <img src={preview} alt={`Slot ${i + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <ImageIcon className="h-4 w-4" style={{ color: colors.hexAccent + '80' }} />
                            <span className="text-[9px] text-gray-500">{i === 0 ? 'Primary' : `#${i + 1}`}</span>
                          </div>
                        )}
                      </button>
                      {preview && !uploadingAvatarMulti && (
                        <button
                          type="button"
                          onClick={() => handleAvatarSlotSelect(i, null)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/80 border border-white/20 text-white flex items-center justify-center hover:bg-red-500/80"
                          aria-label="Remove image"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-500 text-center">PNG / JPG / WebP · max 10MB each</p>
            </div>

            <button
              onClick={handleAvatarMultiUpload}
              disabled={uploadingAvatarMulti || avatarImages.filter(Boolean).length === 0}
              className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40"
              style={{ backgroundColor: colors.hexAccent }}
            >
              {uploadingAvatarMulti
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating avatar...</>
                : <><Upload className="h-4 w-4" /> Create Avatar from {avatarImages.filter(Boolean).length || 'My'} Photo{avatarImages.filter(Boolean).length === 1 ? '' : 's'}</>
              }
            </button>

            {avatarMultiError && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400">{avatarMultiError}</span>
              </div>
            )}

            {/* Or use auto profile image */}
            <button
              onClick={() => avatarAutoMutation.mutate()}
              disabled={avatarAutoMutation.isPending || uploadingAvatarMulti}
              className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all disabled:opacity-40"
              style={{ borderColor: colors.hexAccent + '40', color: colors.hexAccent, background: colors.hexAccent + '08' }}
            >
              {avatarAutoMutation.isPending
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Creating...</>
                : <><Camera className="h-3 w-3" /> Use My Profile Image Instead</>
              }
            </button>

            {/* Visual DNA hint */}
            {masterJson?.visual_dna?.image_prompt_base && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl border border-blue-500/15 bg-blue-500/5">
                <Info className="h-3 w-3 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-300 leading-relaxed">
                  <span className="font-medium text-blue-200">Visual DNA:</span>{' '}
                  {String(masterJson.visual_dna.image_prompt_base).slice(0, 100)}
                  {String(masterJson.visual_dna.image_prompt_base).length > 100 ? '...' : ''}
                </p>
              </div>
            )}

            {/* Fallback: manual URL */}
            <details className="group">
              <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 list-none flex items-center gap-1">
                <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                Or paste a custom photo URL
              </summary>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="Paste face photo URL (jpg/png)..."
                  className="w-full bg-black/40 border rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none"
                  style={{ borderColor: colors.hexBorder }}
                />
                <button
                  onClick={() => avatarMutation.mutate({ userId, imageUrl })}
                  disabled={!imageUrl || avatarMutation.isPending}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all disabled:opacity-40"
                  style={{ borderColor: colors.hexAccent + '40', color: colors.hexAccent, background: colors.hexAccent + '08' }}
                >
                  {avatarMutation.isPending
                    ? <><Loader2 className="h-3 w-3 animate-spin" /> Creating...</>
                    : <><Camera className="h-3 w-3" /> Create from URL</>
                  }
                </button>
              </div>
            </details>

            {(avatarAutoMutation.isError || avatarMutation.isError) && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                <span className="text-[10px] text-red-400">
                  {(avatarAutoMutation.error as any)?.message || (avatarMutation.error as any)?.message || 'Avatar creation failed'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status summary */}
      {voiceProfile && avatarProfile && (
        <div
          className="p-3 rounded-xl text-center"
          style={{ background: '#22c55e10', border: '1px solid #22c55e20' }}
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-xs text-green-400 font-semibold">All set! Go to Create to generate content.</span>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------
// SCHEDULE PANEL
// -----------------------------------------------

function SchedulePanel({ userId, colors, config, queryClient }: {
  userId: number;
  colors: any;
  config: any;
  queryClient: any;
}) {
  const [frequency, setFrequency] = useState(config?.frequency || 'weekly');
  const [autoGenerate, setAutoGenerate] = useState(config?.autoGenerate ?? true);
  const [autoPublish, setAutoPublish] = useState(config?.autoPublish ?? false);
  const [isActive, setIsActive] = useState(config?.isActive ?? false);
  const [preferredHour, setPreferredHour] = useState(config?.preferredHour ?? 12);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest({ url: `/api/influencer/schedule/${userId}`, method: 'PUT', data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/influencer/schedule/${userId}`] }),
  });

  return (
    <div className="space-y-5">
      {/* Master toggle */}
      <div
        className="flex items-center justify-between p-4 rounded-2xl border"
        style={{ borderColor: isActive ? '#22c55e30' : colors.hexBorder, background: 'rgba(0,0,0,0.4)' }}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-green-500/15' : 'bg-white/5'}`}>
            <Clock className="h-4 w-4" style={{ color: isActive ? '#22c55e' : '#6b7280' }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Auto-Generation</div>
            <div className="text-[10px] text-gray-500">{isActive ? 'Content generated automatically' : 'Paused'}</div>
          </div>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          className={`w-11 h-6 rounded-full transition-all flex items-center ${isActive ? '' : 'bg-gray-700'}`}
          style={isActive ? { backgroundColor: '#22c55e' } : {}}
        >
          <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Frequency */}
      <div>
        <label className="text-xs font-semibold text-gray-300 mb-2 block">Frequency</label>
        <div className="grid grid-cols-2 gap-1.5">
          {FREQUENCY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFrequency(opt.value)}
              className="text-left py-2.5 px-3 rounded-xl transition-all"
              style={frequency === opt.value ? {
                backgroundColor: colors.hexAccent + '15',
                color: colors.hexAccent,
                border: `1px solid ${colors.hexAccent}30`,
              } : { border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
            >
              <div className="text-xs font-medium" style={{ color: frequency === opt.value ? colors.hexAccent : '#d1d5db' }}>
                {opt.label}
              </div>
              <div className="text-[10px]" style={{ color: frequency === opt.value ? colors.hexAccent + '80' : '#6b7280' }}>
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preferred hour */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-300">Publish Time</label>
          <span className="text-xs font-mono" style={{ color: colors.hexAccent }}>{preferredHour}:00 UTC</span>
        </div>
        <input
          type="range" min={0} max={23} value={preferredHour}
          onChange={e => setPreferredHour(Number(e.target.value))}
          className="w-full h-1 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: colors.hexAccent }}
        />
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        {[
          { label: 'Auto-generate scripts', value: autoGenerate, setter: setAutoGenerate },
          { label: 'Auto-publish when ready', value: autoPublish, setter: setAutoPublish },
        ].map(toggle => (
          <div key={toggle.label} className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{toggle.label}</span>
            <button
              onClick={() => toggle.setter(!toggle.value)}
              className={`w-9 h-5 rounded-full transition-all flex items-center ${toggle.value ? '' : 'bg-gray-700'}`}
              style={toggle.value ? { backgroundColor: colors.hexAccent } : {}}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${toggle.value ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={() => saveMutation.mutate({ frequency, autoGenerate, autoPublish, isActive, preferredHour })}
        disabled={saveMutation.isPending}
        className="w-full py-3 rounded-2xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
        style={{ backgroundColor: colors.hexAccent, boxShadow: `0 4px 20px ${colors.hexAccent}40` }}
      >
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
        Save Schedule
      </button>

      {saveMutation.isSuccess && (
        <div className="flex items-center gap-2 justify-center p-2 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs text-green-400">Schedule saved!</span>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 🔥 VIRAL STUDIO PANEL — Happy Horse + GPT-Image-2 + Cost Estimator
// =============================================================
//
// Workflow:
//  1. Choose promotion target (song / video / merch / Boostify service)
//  2. Describe what you want
//  3. (Optional) attach reference images (product / look) -> uses Reference-to-Video
//  4. Live cost estimator (credits + USD) before clicking Generate
//  5. Pipeline: viral image → optional GPT-Image-2 edit → 5/10/15s viral video
//
// Backend: POST /api/influencer/viral/{estimate-cost,generate-image,edit-image,
//                                      image-to-video,reference-to-video,generate-full}

type ViralTarget = 'song' | 'video' | 'merch' | 'service';

const VIRAL_TARGETS: Array<{ id: ViralTarget; label: string; icon: any; tagline: string }> = [
  { id: 'service', label: 'Boostify Service', icon: Rocket,    tagline: 'Promote boostifymusic.com/create-artist' },
  { id: 'song',    label: 'Song Release',     icon: Music,     tagline: 'Hype your new track on socials' },
  { id: 'video',   label: 'Music Video',      icon: Video,     tagline: 'Tease your music video on Reels/TikTok' },
  { id: 'merch',   label: 'Product / Merch',  icon: ShoppingBag, tagline: 'Reference-to-video product spot' },
];

function ViralStudioPanel({ userId, userEmail, colors, artistName, queryClient }: {
  userId: number;
  userEmail?: string;
  colors: any;
  artistName: string;
  queryClient: any;
}) {
  const [target, setTarget] = useState<ViralTarget>('service');
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<5 | 10 | 15>(10);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [useImageEdit, setUseImageEdit] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [refInput, setRefInput] = useState('');
  const [estimate, setEstimate] = useState<any>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const usingReference = referenceUrls.length > 0;

  // -- Build "steps" array for cost estimation based on current selections --
  const steps = (() => {
    const arr: Array<'image' | 'imageEdit' | 'i2v' | 'r2v'> = [];
    if (!usingReference) arr.push('image');
    if (useImageEdit) arr.push('imageEdit');
    arr.push(usingReference ? 'r2v' : 'i2v');
    return arr;
  })();

  // -- Estimate cost (debounced manual call) --
  const refreshEstimate = useCallback(async () => {
    setEstimateLoading(true);
    try {
      const res = await apiRequest({
        url: '/api/influencer/viral/estimate-cost',
        method: 'POST',
        data: { steps, duration, userEmail: userEmail || undefined },
      });
      setEstimate(res);
    } catch (e: any) {
      setEstimate(null);
    } finally {
      setEstimateLoading(false);
    }
  }, [JSON.stringify(steps), duration, userEmail]);

  // Re-estimate whenever inputs change
  useEffectIfChanged([steps.join(','), duration], () => { void refreshEstimate(); });

  function addReferenceUrl() {
    const url = refInput.trim();
    if (!url) return;
    if (referenceUrls.length >= 4) {
      setError('Máximo 4 imágenes de referencia.');
      return;
    }
    setReferenceUrls(prev => [...prev, url]);
    setRefInput('');
    setError(null);
  }

  function removeReferenceUrl(idx: number) {
    setReferenceUrls(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError('Describe el contenido viral que quieres generar.');
      return;
    }
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const res = await apiRequest({
        url: '/api/influencer/viral/generate-full',
        method: 'POST',
        data: {
          userId,
          userEmail: userEmail || undefined,
          prompt,
          target,
          artistName,
          duration,
          aspectRatio,
          resolution,
          useImageEdit,
          editPrompt: editPrompt || undefined,
          referenceImageUrls: usingReference ? referenceUrls : undefined,
        },
      });
      setResult(res);
      queryClient.invalidateQueries({ queryKey: [`/api/influencer/content/${userId}`] });
    } catch (e: any) {
      setError(e?.message || 'Generation failed');
    } finally {
      setRunning(false);
    }
  }

  const accent = colors.hexAccent;
  const targetMeta = VIRAL_TARGETS.find(t => t.id === target)!;

  return (
    <div className="space-y-4">
      {/* Header / Hero */}
      <div
        className="rounded-2xl p-4 border"
        style={{
          borderColor: accent + '30',
          background: `linear-gradient(135deg, ${accent}10 0%, transparent 60%)`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: accent + '25' }}
          >
            <Flame className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-white">Viral Content Studio</div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Pipeline IA: imagen viral → edición opcional GPT-Image-2 → video 5-15s con Happy Horse.
              Coste mostrado antes de generar.
            </div>
          </div>
        </div>
      </div>

      {/* Promotion target selector */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          ¿Qué quieres promocionar?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {VIRAL_TARGETS.map(t => {
            const Icon = t.icon;
            const active = target === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTarget(t.id)}
                className="text-left p-3 rounded-xl border transition-all"
                style={{
                  borderColor: active ? accent : 'rgba(255,255,255,0.08)',
                  background: active ? accent + '15' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: active ? accent : '#9ca3af' }} />
                  <div className="text-xs font-semibold text-white">{t.label}</div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">{t.tagline}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Describe el contenido viral
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          placeholder={
            target === 'service'
              ? `Ej: ${artistName || 'una persona común'} se transforma en una superestrella IA en segundos, neon glass aesthetic, momento "wow"`
              : target === 'song'
              ? 'Ej: visual de hype para mi nuevo single, beat drop, color saturation, vertical, audio-reactive'
              : target === 'video'
              ? 'Ej: teaser cinematográfico de mi nuevo music video, gancho visual primer segundo, cyberpunk'
              : 'Ej: producto giro 360, fondo limpio, luz premium, satisfying motion'
          }
          className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {/* Reference images (optional → triggers R2V) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Imágenes de referencia <span className="text-gray-600 normal-case">(opcional · activa Reference-to-Video)</span>
          </div>
          <span className="text-[10px] text-gray-500">{referenceUrls.length}/4</span>
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="url"
            value={refInput}
            onChange={e => setRefInput(e.target.value)}
            placeholder="https://… (URL pública de imagen)"
            className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReferenceUrl(); } }}
          />
          <button
            onClick={addReferenceUrl}
            disabled={!refInput.trim() || referenceUrls.length >= 4}
            className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 transition-colors"
            style={{ background: accent + '20', color: accent }}
          >
            + Add
          </button>
        </div>
        {referenceUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {referenceUrls.map((url, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-white/10" style={{ width: 64, height: 64 }}>
                <img src={url} alt="ref" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeReferenceUrl(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image edit toggle (GPT-Image-2) */}
      <div className="rounded-xl p-3 border border-white/10 bg-black/30">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useImageEdit}
            onChange={e => setUseImageEdit(e.target.checked)}
            className="accent-white"
          />
          <ImageIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-white font-semibold">Refinar imagen con GPT-Image-2 (premium)</span>
          <span className="text-[10px] text-gray-500">+coste</span>
        </label>
        {useImageEdit && (
          <input
            type="text"
            value={editPrompt}
            onChange={e => setEditPrompt(e.target.value)}
            placeholder="Instrucciones de edición (vacío = usa el prompt principal)"
            className="mt-2 w-full px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none"
          />
        )}
      </div>

      {/* Duration / aspect / resolution */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Duración</div>
          <div className="flex gap-1">
            {[5, 10, 15].map(d => (
              <button
                key={d}
                onClick={() => setDuration(d as 5 | 10 | 15)}
                className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                style={duration === d
                  ? { background: accent + '25', color: accent }
                  : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af' }}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Formato</div>
          <select
            value={aspectRatio}
            onChange={e => setAspectRatio(e.target.value as any)}
            className="w-full py-1.5 rounded-lg text-[11px] bg-black/40 border border-white/10 text-white"
          >
            <option value="9:16">9:16 Vertical</option>
            <option value="1:1">1:1 Square</option>
            <option value="16:9">16:9 Horizontal</option>
          </select>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Resolución</div>
          <select
            value={resolution}
            onChange={e => setResolution(e.target.value as any)}
            className="w-full py-1.5 rounded-lg text-[11px] bg-black/40 border border-white/10 text-white"
          >
            <option value="480p">480p</option>
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
          </select>
        </div>
      </div>

      {/* Cost Estimator */}
      <div
        className="rounded-2xl p-4 border"
        style={{
          borderColor: accent + '40',
          background: `linear-gradient(135deg, ${accent}08 0%, transparent 80%)`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4" style={{ color: accent }} />
            <span className="text-xs font-bold text-white">Estimación de coste</span>
          </div>
          <button
            onClick={() => void refreshEstimate()}
            className="text-[10px] text-gray-500 hover:text-white"
          >
            {estimateLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Recalcular'}
          </button>
        </div>
        {estimate ? (
          <>
            <div className="space-y-1.5">
              {estimate.breakdown?.map((b: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">{b.step}</span>
                  <span className="text-white font-mono">
                    {b.credits} cr · ${b.usd.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white">Total</span>
              <div className="text-right">
                <div className="text-sm font-bold" style={{ color: accent }}>
                  {estimate.totalCredits} créditos
                </div>
                <div className="text-[10px] text-gray-500 font-mono">
                  ≈ ${estimate.totalUserPriceUsd?.toFixed(2)} · coste API ${estimate.totalUsd?.toFixed(2)}
                </div>
              </div>
            </div>
            {typeof estimate.userBalance === 'number' && (
              <div
                className="mt-2 flex items-center justify-between text-[10px] rounded-lg px-2.5 py-1.5"
                style={{
                  background: estimate.canAfford === false ? '#ef444415' : '#22c55e12',
                  color: estimate.canAfford === false ? '#f87171' : '#4ade80',
                }}
              >
                <span>Tu saldo: {estimate.userBalance} créditos</span>
                <span className="font-semibold">
                  {estimate.canAfford === false ? 'Saldo insuficiente' : 'Saldo suficiente ✓'}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-gray-500">
            {estimateLoading ? 'Calculando…' : 'Configura los parámetros para ver el coste.'}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={running || !prompt.trim()}
        className="w-full py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${colors.hexPrimary} 100%)`,
          color: '#000',
          boxShadow: `0 6px 24px ${accent}40`,
        }}
      >
        {running ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando contenido viral…
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Generar Viral · {targetMeta.label}
          </>
        )}
      </button>

      {/* Result */}
      {result?.success && (
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40">
          <video
            src={result.videoUrl}
            poster={result.thumbnailUrl}
            controls
            autoPlay
            loop
            className="w-full"
            style={{ maxHeight: 480 }}
          />
          <div className="p-3 space-y-1">
            <div className="text-[11px] text-gray-400">
              Duración: {result.duration}s · Coste: ${result.totalCostUsd?.toFixed(3)} · Tiempo: {(result.elapsedMs / 1000).toFixed(1)}s
            </div>
            <div className="flex gap-2 mt-2">
              <a
                href={result.videoUrl}
                download
                className="flex-1 text-center py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                Descargar
              </a>
              <button
                onClick={() => navigator.clipboard.writeText(result.videoUrl)}
                className="flex-1 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                Copiar URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tiny effect helper that re-runs only when the serialized deps change
function useEffectIfChanged(deps: any[], fn: () => void) {
  const ref = useRef<string>('');
  const key = JSON.stringify(deps);
  if (ref.current !== key) {
    ref.current = key;
    // defer to next tick so state updates settle
    queueMicrotask(fn);
  }
}
