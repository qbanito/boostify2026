/**
 * AI Video Studio
 * Boostify HyperFrame Video Engine — Artist Profile Module
 *
 * Tabs:
 * 1. Quick Generate
 * 2. Song Visualizer
 * 3. Avatar Promo
 * 4. Lyric Video
 * 5. Campaign Ads
 * 6. Multilingual Versions
 * 7. Render History
 * 8. Templates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clapperboard, Zap, Music, User, BookOpen, Megaphone,
  Globe, Clock, Layout, Play, Download, Loader2, CheckCircle,
  AlertCircle, Sparkles, RefreshCw, X, ChevronDown, ChevronUp,
  Settings, Video, Film, Share2, ExternalLink, Eye, Trash2,
  Wand2, Mic2, Image as ImageIcon, Target, Star, TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';
import { useToast } from '../../../hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Song {
  id: string | number;
  name?: string;
  title?: string;
  audioUrl?: string;
  coverArt?: string;
  genre?: string;
  mood?: string;
  lyrics?: string;
  bpm?: number;
  duration?: number | string;
}

interface VideoJob {
  id: number;
  artistId: string;
  songId?: string;
  videoType: string;
  platform?: string;
  format?: string;
  language?: string;
  durationSeconds?: number;
  status: 'draft' | 'script_generated' | 'hyperframes_generated' | 'heygen_processing' | 'rendering' | 'completed' | 'failed';
  progressPercent?: number;
  creativeConcept?: { title: string; logline: string; mood: string; emotionalGoal: string; hookLine: string };
  script?: { avatarScript: string; voiceover: string; captions: any[] };
  scenes?: any[];
  heygenVideoUrl?: string;
  hyperframesCompositionHtml?: string;
  errorMessage?: string;
  createdAt: string;
}

interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
}

interface HeyGenVoice {
  voice_id: string;
  name: string;
  language: string;
  gender?: string;
}

interface AvatarScene {
  scene: string;
  label: string;
  icon: string;
  imageUrl: string | null;
  prompt?: string;
  error?: string;
}

interface AIVideoStudioProps {
  artistId: string;
  artistName?: string;
  artistGenre?: string;
  songs?: Song[];
  colors?: { hexPrimary?: string; hexSecondary?: string; hexAccent?: string };
  isOwnProfile?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIDEO_TYPES = [
  { value: 'artist_promo',       label: 'Artist Promo',        icon: '🎤', desc: 'General artist promotion video' },
  { value: 'song_trailer',       label: 'Song Trailer',        icon: '🎬', desc: 'Teaser for a new song' },
  { value: 'lyric_visualizer',   label: 'Lyric Visualizer',    icon: '📝', desc: 'Animated lyric video' },
  { value: 'avatar_announcement',label: 'Avatar Announcement', icon: '🤖', desc: 'AI avatar speaking to fans' },
  { value: 'campaign_ad',        label: 'Campaign Ad',         icon: '📣', desc: 'Paid advertising creative' },
  { value: 'multilingual',       label: 'Multilingual',        icon: '🌐', desc: 'Same video in multiple languages' },
  { value: 'artist_pitch',       label: 'Artist Pitch',        icon: '💼', desc: 'Label / investor pitch video' },
  { value: 'fan_engagement',     label: 'Fan Engagement',      icon: '❤️', desc: 'Fan message / thank you' },
  { value: 'brand_partnership',  label: 'Brand Partnership',   icon: '🤝', desc: 'Co-branded collaboration video' },
  { value: 'spotify_canvas',     label: 'Spotify Canvas',      icon: '🔁', desc: '8s loop for Spotify Canvas' },
  { value: 'youtube_intro',      label: 'YouTube Intro',       icon: '▶️', desc: 'Channel intro sequence' },
  { value: 'tiktok_hook',        label: 'TikTok Hook',         icon: '🎵', desc: 'Viral TikTok hook video' },
] as const;

const PRESETS = [
  { id: 'new_song_announcement', label: 'New Song Announcement', videoType: 'song_trailer',        platform: 'tiktok',     format: '9:16', duration: 30 },
  { id: 'out_now_promo',         label: '"Out Now" Promo',        videoType: 'artist_promo',        platform: 'instagram',  format: '9:16', duration: 15 },
  { id: 'artist_introduction',   label: 'Artist Introduction',    videoType: 'artist_promo',        platform: 'youtube',    format: '16:9', duration: 60 },
  { id: 'fan_message',           label: 'Fan Message',            videoType: 'fan_engagement',      platform: 'instagram',  format: '9:16', duration: 30 },
  { id: 'label_pitch',           label: 'Label Pitch',            videoType: 'artist_pitch',        platform: 'all',        format: '16:9', duration: 90 },
  { id: 'brand_collab',          label: 'Brand Collaboration',    videoType: 'brand_partnership',   platform: 'instagram',  format: '1:1',  duration: 30 },
  { id: 'tiktok_hook',           label: 'TikTok Hook',            videoType: 'tiktok_hook',         platform: 'tiktok',     format: '9:16', duration: 15 },
  { id: 'spotify_canvas',        label: 'Spotify Canvas Loop',    videoType: 'spotify_canvas',      platform: 'spotify',    format: '9:16', duration: 8  },
  { id: 'youtube_trailer',       label: 'YouTube Trailer',        videoType: 'youtube_intro',       platform: 'youtube',    format: '16:9', duration: 60 },
  { id: 'behind_the_song',       label: 'Behind the Song',        videoType: 'fan_engagement',      platform: 'instagram',  format: '9:16', duration: 45 },
];

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'spotify', 'all'];
const FORMATS   = ['9:16', '16:9', '1:1'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

const TAB_LIST = [
  { id: 'quick',        label: 'Quick Generate', icon: Zap },
  { id: 'visualizer',  label: 'Song Visualizer', icon: Music },
  { id: 'avatar',      label: 'Avatar Promo',    icon: User },
  { id: 'lyric',       label: 'Lyric Video',     icon: BookOpen },
  { id: 'campaign',    label: 'Campaign Ads',    icon: Megaphone },
  { id: 'multilingual',label: 'Multilingual',    icon: Globe },
  { id: 'history',     label: 'Render History',  icon: Clock },
  { id: 'templates',   label: 'Templates',       icon: Layout },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: 'Queued',
  script_generated: 'Script Ready',
  hyperframes_generated: 'Composition Ready',
  heygen_processing: 'Avatar Processing…',
  rendering: 'Rendering…',
  completed: 'Done',
  failed: 'Failed',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-zinc-400 bg-zinc-700/50',
  script_generated: 'text-blue-400 bg-blue-900/30',
  hyperframes_generated: 'text-purple-400 bg-purple-900/30',
  heygen_processing: 'text-yellow-400 bg-yellow-900/30',
  rendering: 'text-orange-400 bg-orange-900/30',
  completed: 'text-green-400 bg-green-900/30',
  failed: 'text-red-400 bg-red-900/30',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
    {status === 'rendering' || status === 'heygen_processing'
      ? <Loader2 className="w-3 h-3 animate-spin" />
      : status === 'completed'
      ? <CheckCircle className="w-3 h-3" />
      : status === 'failed'
      ? <AlertCircle className="w-3 h-3" />
      : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
    {STATUS_LABELS[status] || status}
  </span>
);

const ProgressBar: React.FC<{ percent: number; status: string }> = ({ percent, status }) => {
  const colors: Record<string, string> = {
    failed: 'bg-red-500',
    completed: 'bg-green-500',
    rendering: 'bg-orange-500',
    heygen_processing: 'bg-yellow-500',
  };
  const barColor = colors[status] || 'bg-violet-500';
  return (
    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
      <motion.div
        className={`h-1.5 rounded-full ${barColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
};

// ─── Job card ─────────────────────────────────────────────────────────────────

const JobCard: React.FC<{
  job: VideoJob;
  onDelete: (id: number) => void;
  onView: (job: VideoJob) => void;
}> = ({ job, onDelete, onView }) => {
  const typeInfo = VIDEO_TYPES.find(t => t.value === job.videoType);
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3 hover:border-violet-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{typeInfo?.icon || '🎬'}</span>
          <div>
            <p className="text-sm font-semibold text-white">
              {job.creativeConcept?.title || typeInfo?.label || job.videoType}
            </p>
            <p className="text-xs text-zinc-400">{job.platform} · {job.format} · {job.durationSeconds}s</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={job.status} />
          <button onClick={() => onView(job)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(job.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-900/20 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <ProgressBar percent={job.progressPercent ?? 0} status={job.status} />

      {job.creativeConcept?.logline && (
        <p className="text-xs text-zinc-400 italic">"{job.creativeConcept.logline}"</p>
      )}

      {job.status === 'completed' && job.heygenVideoUrl && (
        <a href={job.heygenVideoUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" /> View Avatar Video
        </a>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <p className="text-xs text-red-400">{job.errorMessage.slice(0, 120)}</p>
      )}

      <p className="text-xs text-zinc-600">{new Date(job.createdAt).toLocaleString()}</p>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AIVideoStudio: React.FC<AIVideoStudioProps> = ({
  artistId,
  artistName = 'Artist',
  artistGenre = 'Pop',
  songs = [],
  colors = {},
  isOwnProfile = false,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('quick');
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);

  // ── Quick Generate state ───────────────────────────────────────────────────
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [selectedVideoType, setSelectedVideoType] = useState<string>('artist_promo');
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('tiktok');
  const [selectedFormat, setSelectedFormat] = useState<string>('9:16');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [avatarId, setAvatarId] = useState<string>('');
  const [voiceId, setVoiceId] = useState<string>('');
  const [cta, setCta] = useState<string>('Stream Now');
  const [targetAudience, setTargetAudience] = useState<string>('Music fans 18-35');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Avatar state ───────────────────────────────────────────────────────────
  const [avatarScript, setAvatarScript] = useState<string>('');
  const [avatarBackground, setAvatarBackground] = useState<string>('#0a0a0a');
  const [avatarCaption, setAvatarCaption] = useState(false);

  // ── Artist scene generator state ───────────────────────────────────────────
  const [sceneProfileUrl, setSceneProfileUrl] = useState<string>('');
  const [generatedScenes, setGeneratedScenes] = useState<AvatarScene[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);

  // ── Multilingual state ─────────────────────────────────────────────────────
  const [multilingualLanguages, setMultilingualLanguages] = useState<string[]>(['en', 'es']);

  // ── Data queries ───────────────────────────────────────────────────────────
  const { data: avatarsData } = useQuery({
    queryKey: ['heygen-avatars'],
    queryFn: () => fetch('/api/ai-video-studio/heygen/avatars', { credentials: 'include' }).then(r => r.json()),
    staleTime: 60 * 60 * 1000,
  });

  const { data: voicesData } = useQuery({
    queryKey: ['heygen-voices', selectedLanguage],
    queryFn: () => fetch(`/api/ai-video-studio/heygen/voices?language=${selectedLanguage}`, { credentials: 'include' }).then(r => r.json()),
    staleTime: 60 * 60 * 1000,
  });

  const { data: templatesData } = useQuery({
    queryKey: ['hyperframes-templates'],
    queryFn: () => fetch('/api/ai-video-studio/templates', { credentials: 'include' }).then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['video-jobs', artistId],
    queryFn: () => fetch(`/api/ai-video-studio/${artistId}/jobs`, { credentials: 'include' }).then(r => r.json()),
    refetchInterval: (data: any) => {
      const jobs = data?.jobs ?? [];
      const active = jobs.some((j: VideoJob) => ['draft', 'script_generated', 'hyperframes_generated', 'heygen_processing', 'rendering'].includes(j.status));
      return active ? 4000 : false;
    },
  });

  const avatars: HeyGenAvatar[] = avatarsData?.avatars ?? [];
  const voices: HeyGenVoice[] = voicesData?.voices ?? [];
  const templates: any[] = templatesData?.templates ?? [];
  const jobs: VideoJob[] = jobsData?.jobs ?? [];

  // ── Apply preset ───────────────────────────────────────────────────────────
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset);
    setSelectedVideoType(preset.videoType);
    setSelectedPlatform(preset.platform);
    setSelectedFormat(preset.format);
    setSelectedDuration(preset.duration);
  };

  // ── Generate mutation ──────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async (extra?: { videoType?: string; languages?: string[] }) => {
      const song = songs.find(s => String(s.id) === selectedSongId);
      const payload = {
        videoType: extra?.videoType ?? selectedVideoType,
        artist: {
          id: artistId,
          name: artistName,
          genre: artistGenre,
          avatarId: avatarId || undefined,
          voiceId: voiceId || undefined,
          language: selectedLanguage,
        },
        song: song ? {
          id: String(song.id),
          title: song.name || song.title || 'Untitled',
          audioUrl: song.audioUrl,
          coverArtUrl: song.coverArt,
          genre: song.genre,
          mood: song.mood,
          lyrics: song.lyrics,
          bpm: song.bpm,
          duration: song.duration,
        } : undefined,
        campaign: {
          platform: selectedPlatform,
          format: selectedFormat as '9:16' | '16:9' | '1:1',
          durationSeconds: selectedDuration,
          cta,
          targetAudience,
          language: selectedLanguage,
        },
      };

      const res = await fetch(`/api/ai-video-studio/${artistId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Generate failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: '🎬 Video job started!', description: `Job #${data.jobId} — check Render History for status.` });
      queryClient.invalidateQueries({ queryKey: ['video-jobs', artistId] });
      setActiveTab('history');
    },
    onError: (err: any) => {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Avatar promo mutation ──────────────────────────────────────────────────
  const avatarMutation = useMutation({
    mutationFn: async () => {
      if (!avatarId || !voiceId || !avatarScript) throw new Error('Avatar ID, Voice ID, and script are required');
      const res = await fetch(`/api/ai-video-studio/${artistId}/heygen-avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          avatarId, voiceId, script: avatarScript,
          format: selectedFormat,
          background: { type: 'color', value: avatarBackground },
          caption: avatarCaption,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: '🤖 HeyGen video queued!', description: `Video ID: ${data.videoId}` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (jobId: number) => {
      await fetch(`/api/ai-video-studio/${artistId}/jobs/${jobId}`, { method: 'DELETE', credentials: 'include' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-jobs', artistId] });
    },
  });

  // ── Artist scene generator mutation ────────────────────────────────────────
  const scenesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ai-video-studio/${artistId}/generate-avatar-scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          profileImageUrl: sceneProfileUrl || undefined,
          scenes: selectedScenes.length > 0 ? selectedScenes : undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Scene generation failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedScenes(data.scenes ?? []);
      toast({ title: '✅ Scenes generated!', description: `${data.scenes?.filter((s: AvatarScene) => s.imageUrl).length} images ready` });
    },
    onError: (err: any) => {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  // ── Create photo avatar mutation ───────────────────────────────────────────
  const photoAvatarMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const res = await fetch(`/api/ai-video-studio/${artistId}/create-photo-avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageUrl, avatarName: `${artistName} - AI Avatar` }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Avatar creation failed'); }
      return res.json();
    },
    onSuccess: (data) => {
      setAvatarId(data.avatarId);
      toast({ title: '🤖 HeyGen photo avatar created!', description: `Avatar ID: ${data.avatarId} — now selected in Avatar Promo` });
    },
    onError: (err: any) => {
      toast({ title: 'Avatar creation failed', description: err.message, variant: 'destructive' });
    },
  });

  const SCENE_PRESETS = [
    { id: 'recording_studio', label: 'Recording Studio', icon: '🎙️' },
    { id: 'urban_street',     label: 'Urban Street',     icon: '🌆' },
    { id: 'concert_stage',    label: 'Concert Stage',    icon: '🎤' },
    { id: 'backstage',        label: 'Backstage',        icon: '🎭' },
    { id: 'rooftop_night',    label: 'Rooftop at Night', icon: '🌃' },
    { id: 'music_video_set',  label: 'Music Video Set',  icon: '🎬' },
    { id: 'outdoor_festival', label: 'Music Festival',   icon: '🎪' },
    { id: 'home_studio',      label: 'Home Studio',      icon: '🏠' },
  ] as const;

  const accent = colors.hexAccent || '#7c3aed';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full text-white space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}22` }}>
          <Clapperboard className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">AI Video Studio</h2>
          <p className="text-xs text-zinc-400">Generate videos from your music</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-3 overflow-x-auto scrollbar-hide border-b border-zinc-800 pb-0">
        {TAB_LIST.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                active ? 'border-violet-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >

            {/* ── TAB: Quick Generate ───────────────────────────────────── */}
            {activeTab === 'quick' && (
              <div className="space-y-5">
                {/* Preset grid */}
                <div>
                  <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">Quick Presets</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`p-2.5 rounded-xl text-left text-xs transition-all border ${
                          selectedPreset.id === preset.id
                            ? 'border-violet-500 bg-violet-900/20 text-white'
                            : 'border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-500'
                        }`}
                      >
                        <div className="font-semibold truncate">{preset.label}</div>
                        <div className="text-zinc-500 mt-0.5">{preset.platform} · {preset.format} · {preset.duration}s</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Song selector */}
                {songs.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2">Song (optional)</label>
                    <select
                      value={selectedSongId}
                      onChange={e => setSelectedSongId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="">No specific song</option>
                      {songs.map(s => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name || s.title || `Song ${s.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Core config row */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Platform</label>
                    <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Format</label>
                    <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                      {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Duration</label>
                    <select value={selectedDuration} onChange={e => setSelectedDuration(Number(e.target.value))}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                      {[8, 15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d}s</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Language</label>
                    <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Advanced */}
                <div className="border border-zinc-700/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="flex items-center gap-2"><Settings className="w-3.5 h-3.5" /> Advanced Options</span>
                    {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <AnimatePresence>
                    {advancedOpen && (
                      <motion.div
                        initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-3 border-t border-zinc-700/50">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-zinc-400 block mb-1.5">HeyGen Avatar</label>
                              <select value={avatarId} onChange={e => setAvatarId(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                                <option value="">Auto-select</option>
                                {avatars.map(a => <option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-zinc-400 block mb-1.5">HeyGen Voice</label>
                              <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                                <option value="">Auto-select</option>
                                {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.language})</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-zinc-400 block mb-1.5">Call to Action</label>
                              <input value={cta} onChange={e => setCta(e.target.value)}
                                placeholder="Stream Now"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-400 block mb-1.5">Target Audience</label>
                              <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                                placeholder="Music fans 18-35"
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                            </div>
                          </div>
                          {/* Video type picker */}
                          <div>
                            <label className="text-xs text-zinc-400 block mb-2">Video Type</label>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                              {VIDEO_TYPES.map(vt => (
                                <button key={vt.value} onClick={() => setSelectedVideoType(vt.value)}
                                  className={`flex items-center gap-1.5 p-2 rounded-lg text-xs transition-all ${
                                    selectedVideoType === vt.value
                                      ? 'bg-violet-600/30 border border-violet-500 text-white'
                                      : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-500'
                                  }`}
                                  title={vt.desc}>
                                  <span>{vt.icon}</span>
                                  <span className="truncate font-medium">{vt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Generate button */}
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  className="w-full py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate {selectedPreset.label}</>
                  )}
                </button>

                {/* Active jobs mini-summary */}
                {jobs.filter(j => ['draft','script_generated','hyperframes_generated','heygen_processing','rendering'].includes(j.status)).length > 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3">
                    <p className="text-xs text-yellow-400 font-semibold">
                      {jobs.filter(j => j.status !== 'completed' && j.status !== 'failed').length} job(s) in progress —{' '}
                      <button onClick={() => setActiveTab('history')} className="underline">View History</button>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Song Visualizer ──────────────────────────────────── */}
            {activeTab === 'visualizer' && (
              <div className="space-y-4">
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Music className="w-4 h-4 text-violet-400" />
                    Song Visualizer — Audio-reactive HyperFrames composition
                  </div>
                  <p className="text-xs text-zinc-400">
                    Creates an animated lyric visualizer where the song audio drives the visual composition.
                    HyperFrames generates GSAP-animated captions synced to the audio waveform.
                  </p>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Select Song</label>
                    <select value={selectedSongId} onChange={e => setSelectedSongId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                      <option value="">Choose a song…</option>
                      {songs.map(s => <option key={s.id} value={String(s.id)}>{s.name || s.title}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Format</label>
                      <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Duration</label>
                      <select value={selectedDuration} onChange={e => setSelectedDuration(Number(e.target.value))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        {[15, 30, 60, 90, 120].map(d => <option key={d} value={d}>{d}s</option>)}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => generateMutation.mutate({ videoType: 'lyric_visualizer' })}
                    disabled={generateMutation.isPending || !selectedSongId}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(135deg, #7c3aed, #4f46e5)` }}
                  >
                    {generateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><Film className="w-4 h-4" />Create Visualizer</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB: Avatar Promo ─────────────────────────────────────── */}
            {activeTab === 'avatar' && (
              <div className="space-y-4">

                {/* ── Artist Scene Generator ─────────────────────────────── */}
                <div className="bg-zinc-800/50 border border-violet-500/20 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    Artist Scene Generator — AI Realistic Portraits
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Generate realistic images of the artist in different settings (studio, street, concert…)
                    using their profile picture as identity reference. Then convert any image into a HeyGen
                    talking photo avatar.
                  </p>

                  {/* Profile image URL */}
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Profile Image URL (optional — auto-detected if blank)</label>
                    <input
                      value={sceneProfileUrl}
                      onChange={e => setSceneProfileUrl(e.target.value)}
                      placeholder="https://… leave blank to use artist's current profile image"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  {/* Scene selector */}
                  <div>
                    <label className="text-xs text-zinc-400 block mb-2">Scenes to generate (select all = all 8)</label>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {SCENE_PRESETS.map(s => {
                        const active = selectedScenes.length === 0 || selectedScenes.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedScenes(prev =>
                                prev.includes(s.id)
                                  ? prev.filter(x => x !== s.id)
                                  : [...prev, s.id]
                              );
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-all border ${
                              selectedScenes.includes(s.id)
                                ? 'bg-violet-600/30 border-violet-500 text-white'
                                : selectedScenes.length === 0
                                ? 'bg-zinc-700/50 border-zinc-600 text-zinc-300 hover:border-violet-500/50'
                                : 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
                            }`}
                          >
                            <span>{s.icon}</span>
                            <span className="truncate font-medium">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedScenes.length > 0 && (
                      <button
                        onClick={() => setSelectedScenes([])}
                        className="mt-1.5 text-xs text-zinc-500 hover:text-violet-400 transition-colors"
                      >
                        Reset (select all)
                      </button>
                    )}
                  </div>

                  {/* Generate button */}
                  <button
                    onClick={() => scenesMutation.mutate()}
                    disabled={scenesMutation.isPending}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {scenesMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Generating scenes — this may take a minute…</>
                      : <><Sparkles className="w-4 h-4" />Generate Realistic Artist Scenes</>}
                  </button>

                  {/* Generated scene grid */}
                  {generatedScenes.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                        Generated Scenes — {generatedScenes.filter(s => s.imageUrl).length}/{generatedScenes.length} succeeded
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {generatedScenes.map(scene => (
                          <div key={scene.scene} className="relative group rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-900">
                            {scene.imageUrl ? (
                              <>
                                <img
                                  src={scene.imageUrl}
                                  alt={scene.label}
                                  className="w-full aspect-[4/5] object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity space-y-1.5">
                                  <p className="text-xs font-semibold text-white truncate">{scene.icon} {scene.label}</p>
                                  <div className="flex gap-1.5">
                                    <a
                                      href={scene.imageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-800/80 border border-zinc-600 rounded-lg text-xs text-zinc-300 hover:text-white transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" /> View
                                    </a>
                                    <button
                                      onClick={() => photoAvatarMutation.mutate(scene.imageUrl!)}
                                      disabled={photoAvatarMutation.isPending}
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all"
                                      style={{ background: '#7c3aed' }}
                                    >
                                      {photoAvatarMutation.isPending
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <User className="w-3 h-3" />}
                                      Use as Avatar
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="w-full aspect-[4/5] flex flex-col items-center justify-center bg-zinc-800/50 gap-2 p-3">
                                <AlertCircle className="w-6 h-6 text-red-400" />
                                <p className="text-xs text-red-400 text-center font-medium">{scene.icon} {scene.label}</p>
                                <p className="text-xs text-zinc-500 text-center">{scene.error ?? 'Generation failed'}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {photoAvatarMutation.isSuccess && (
                    <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3 text-xs text-green-400">
                      ✅ Photo avatar created — Avatar ID <code className="font-mono">{(photoAvatarMutation.data as any)?.avatarId}</code> now selected below.
                    </div>
                  )}
                </div>

                {/* ── HeyGen Talking Head ────────────────────────────────── */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <User className="w-4 h-4 text-violet-400" />
                    Avatar Promo — HeyGen AI Talking Head
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Avatar</label>
                      <select value={avatarId} onChange={e => setAvatarId(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        <option value="">Select avatar…</option>
                        {avatars.map(a => <option key={a.avatar_id} value={a.avatar_id}>{a.avatar_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Voice</label>
                      <select value={voiceId} onChange={e => setVoiceId(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        <option value="">Select voice…</option>
                        {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Script (spoken by avatar)</label>
                    <textarea
                      value={avatarScript} onChange={e => setAvatarScript(e.target.value)}
                      placeholder={`Hi, I'm ${artistName}. My new song is out now — stream it on Spotify!`}
                      rows={4}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 resize-none"
                    />
                    <p className="text-xs text-zinc-500 mt-1">{avatarScript.length} chars · Est. {Math.ceil(avatarScript.split(' ').length / 3)}s</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Format</label>
                      <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Background Color</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={avatarBackground} onChange={e => setAvatarBackground(e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0" />
                        <input value={avatarBackground} onChange={e => setAvatarBackground(e.target.value)}
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500" />
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={avatarCaption} onChange={e => setAvatarCaption(e.target.checked)}
                      className="rounded border-zinc-600" />
                    <span className="text-xs text-zinc-300">Auto-captions (HeyGen)</span>
                  </label>
                  <button
                    onClick={() => avatarMutation.mutate()}
                    disabled={avatarMutation.isPending || !avatarId || !voiceId || !avatarScript}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {avatarMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending to HeyGen…</> : <><Wand2 className="w-4 h-4" />Generate Avatar Video</>}
                  </button>
                  {avatarMutation.isSuccess && (
                    <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-3 text-xs text-green-400">
                      ✅ HeyGen video queued. Video ID: {(avatarMutation.data as any)?.videoId}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB: Lyric Video ──────────────────────────────────────── */}
            {activeTab === 'lyric' && (
              <div className="space-y-4">
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <BookOpen className="w-4 h-4 text-violet-400" />
                    Lyric Video — HyperFrames animated captions
                  </div>
                  <p className="text-xs text-zinc-400">
                    Generates a full lyric video using HyperFrames HTML compositions with GSAP-animated text
                    synchronized to your song audio. No build step — pure HTML to MP4.
                  </p>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Song</label>
                    <select value={selectedSongId} onChange={e => setSelectedSongId(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                      <option value="">Choose a song…</option>
                      {songs.map(s => <option key={s.id} value={String(s.id)}>{s.name || s.title}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Platform Format</label>
                      <select value={selectedFormat} onChange={e => setSelectedFormat(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        <option value="16:9">16:9 — YouTube</option>
                        <option value="9:16">9:16 — TikTok/Reels</option>
                        <option value="1:1">1:1 — Instagram</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Language</label>
                      <select value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-violet-500">
                        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={() => generateMutation.mutate({ videoType: 'lyric_visualizer' })}
                    disabled={generateMutation.isPending || !selectedSongId}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {generateMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : <><BookOpen className="w-4 h-4" />Generate Lyric Video</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB: Campaign Ads ─────────────────────────────────────── */}
            {activeTab === 'campaign' && (
              <div className="space-y-4">
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Megaphone className="w-4 h-4 text-violet-400" />
                    Campaign Ads — Platform-specific video ads
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { platform: 'tiktok', format: '9:16', duration: 15, label: 'TikTok Hook Ad' },
                      { platform: 'instagram', format: '9:16', duration: 30, label: 'Instagram Reel Ad' },
                      { platform: 'youtube', format: '16:9', duration: 15, label: 'YouTube Pre-roll (6s)' },
                      { platform: 'facebook', format: '1:1', duration: 30, label: 'Facebook Feed Ad' },
                    ].map(ad => (
                      <button key={ad.platform}
                        onClick={() => {
                          setSelectedPlatform(ad.platform);
                          setSelectedFormat(ad.format);
                          setSelectedDuration(ad.duration);
                          setSelectedVideoType('campaign_ad');
                          generateMutation.mutate({ videoType: 'campaign_ad' });
                        }}
                        disabled={generateMutation.isPending}
                        className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-left hover:border-violet-500/50 transition-colors disabled:opacity-50"
                      >
                        <p className="text-xs font-semibold text-white">{ad.label}</p>
                        <p className="text-xs text-zinc-500">{ad.format} · {ad.duration}s</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: Multilingual ─────────────────────────────────────── */}
            {activeTab === 'multilingual' && (
              <div className="space-y-4">
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Globe className="w-4 h-4 text-violet-400" />
                    Multilingual Versions
                  </div>
                  <p className="text-xs text-zinc-400">Generate the same video in multiple languages. HeyGen handles translation + lip-sync.</p>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-2">Select Languages</label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map(l => (
                        <label key={l.code} className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={multilingualLanguages.includes(l.code)}
                            onChange={e => {
                              if (e.target.checked) setMultilingualLanguages(prev => [...prev, l.code]);
                              else setMultilingualLanguages(prev => prev.filter(x => x !== l.code));
                            }}
                            className="rounded border-zinc-600"
                          />
                          <span className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            multilingualLanguages.includes(l.code)
                              ? 'bg-violet-900/30 border-violet-500 text-white'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}>{l.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      multilingualLanguages.forEach(lang => {
                        setSelectedLanguage(lang);
                        generateMutation.mutate({ videoType: 'multilingual' });
                      });
                    }}
                    disabled={generateMutation.isPending || multilingualLanguages.length < 1}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    {generateMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                      : <><Globe className="w-4 h-4" />Generate {multilingualLanguages.length} Version{multilingualLanguages.length > 1 ? 's' : ''}</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB: Render History ───────────────────────────────────── */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    {jobs.length} Job{jobs.length !== 1 ? 's' : ''}
                  </p>
                  <button onClick={() => refetchJobs()}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {jobs.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500">
                    <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No video jobs yet.</p>
                    <p className="text-xs mt-1">Go to Quick Generate to create your first video.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onView={(j) => setSelectedJob(j)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: Templates ────────────────────────────────────────── */}
            {activeTab === 'templates' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  HyperFrames Composition Templates
                </p>
                {templates.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500">
                    <Layout className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No templates yet.</p>
                    <p className="text-xs mt-1">Templates created from jobs will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((t: any) => (
                      <div key={t.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-3 space-y-2">
                        {t.previewImageUrl && (
                          <img src={t.previewImageUrl} alt="" className="w-full rounded-lg object-cover aspect-video" />
                        )}
                        <p className="text-xs font-semibold text-white">{t.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-400 border border-violet-700/30">{t.category}</span>
                          <span className="text-xs text-zinc-500">{t.format} · {t.durationSeconds}s</span>
                        </div>
                        <button
                          onClick={() => {
                            toast({ title: '📋 Template applied', description: `Using "${t.name}" for your next video.` });
                          }}
                          className="w-full py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs font-medium text-white transition-colors"
                        >
                          Use Template
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Job detail modal */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setSelectedJob(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900">
                <div>
                  <p className="font-bold text-white text-sm">
                    {selectedJob.creativeConcept?.title || `Job #${selectedJob.id}`}
                  </p>
                  <p className="text-xs text-zinc-400">{selectedJob.videoType} · {selectedJob.format} · {selectedJob.durationSeconds}s</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedJob.status} />
                  <button onClick={() => setSelectedJob(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <ProgressBar percent={selectedJob.progressPercent ?? 0} status={selectedJob.status} />

                {selectedJob.creativeConcept && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300 uppercase">Creative Concept</p>
                    <p className="text-sm text-white font-medium">"{selectedJob.creativeConcept.logline}"</p>
                    <p className="text-xs text-zinc-400">Mood: {selectedJob.creativeConcept.mood} · Hook: "{selectedJob.creativeConcept.hookLine}"</p>
                    <p className="text-xs text-zinc-400">{selectedJob.creativeConcept.emotionalGoal}</p>
                  </div>
                )}

                {selectedJob.script && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300 uppercase">Avatar Script</p>
                    <p className="text-sm text-zinc-200 bg-zinc-800 rounded-xl p-3 text-xs leading-relaxed">
                      {selectedJob.script.avatarScript}
                    </p>
                  </div>
                )}

                {selectedJob.scenes && Array.isArray(selectedJob.scenes) && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-zinc-300 uppercase">{selectedJob.scenes.length} Scenes</p>
                    {selectedJob.scenes.map((s: any, i: number) => (
                      <div key={i} className="text-xs bg-zinc-800/60 rounded-xl p-2.5 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Scene {s.sceneNumber}</span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-400">{s.duration}</span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-violet-400 capitalize">{s.mediaType}</span>
                        </div>
                        <p className="text-zinc-300">{s.visualDescription}</p>
                        {s.textOverlay && <p className="text-white font-medium">"{s.textOverlay}"</p>}
                      </div>
                    ))}
                  </div>
                )}

                {selectedJob.heygenVideoUrl && (
                  <a
                    href={selectedJob.heygenVideoUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  >
                    <Play className="w-4 h-4" /> Watch Avatar Video
                  </a>
                )}

                {selectedJob.hyperframesCompositionHtml && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-300 uppercase">HyperFrames Composition</p>
                    <pre className="text-xs text-zinc-400 bg-zinc-800 rounded-xl p-3 overflow-x-auto max-h-40">
                      {selectedJob.hyperframesCompositionHtml.slice(0, 500)}…
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIVideoStudio;
