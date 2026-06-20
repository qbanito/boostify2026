/**
 * AvatarTalkModule — ElevenLabs + Flux + Avatar4 talking head generator
 *
 * Lets the artist generate professional AI talking-head videos from their
 * profile photo. Supports 4 scene presets, custom script, Talk To Me voice,
 * talking style, and a video gallery.
 */
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Mic, Home, Film, Music2, Sparkles, Loader2,
  Play, Pause, Trash2, ChevronDown, X, Check,
  MonitorPlay, AlertCircle, Camera, Wand2,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { getAuthToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
type Scene = 'studio' | 'home' | 'backstage' | 'live';
type TalkingStyle = 'stable' | 'expressive';
type AspectRatio = '9:16' | '16:9' | '1:1';
type VoiceMode = 'talk-to-me' | 'heygen';

interface AvatarVideo {
  id: number;
  artistId: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  prompt?: string | null;
  voice?: string | null;
  scene?: string | null;
  talkingStyle?: string | null;
  aspectRatio?: string | null;
  createdAt: string;
}

interface AvatarTalkModuleProps {
  artistId: string;
  artistName: string;
  artistProfileImage?: string;
  isOwnProfile: boolean;
  colors: { hexAccent: string; hexPrimary: string; hexBorder: string };
}

// ─── Scene Config ─────────────────────────────────────────────────────────────
const SCENES: { id: Scene; label: string; emoji: string; description: string; color: string; icon: any }[] = [
  {
    id: 'studio',
    label: 'Studio',
    emoji: '🎙️',
    description: 'Professional recording environment, serious tone',
    color: '#1e3a5f',
    icon: Mic,
  },
  {
    id: 'home',
    label: 'Home',
    emoji: '🏡',
    description: 'Casual and intimate, personal connection with fans',
    color: '#3d2b1f',
    icon: Home,
  },
  {
    id: 'backstage',
    label: 'Backstage',
    emoji: '🎭',
    description: 'Behind-the-scenes energy before a big show',
    color: '#1a1a1a',
    icon: Film,
  },
  {
    id: 'live',
    label: 'Live Stage',
    emoji: '🎤',
    description: 'Electric stage energy, hype and passion',
    color: '#2d0a4e',
    icon: Music2,
  },
];

// ─── Suggested Scripts per Scene ──────────────────────────────────────────────
const SUGGESTED_SCRIPTS: Record<Scene, string[]> = {
  studio: [
    "Hey everyone, I've been working on something really special in the studio. My new album drops next month and I can't wait for you all to hear it.",
    "I just finished recording the final track of my upcoming project. It's been an incredible journey and I'm so grateful for your support.",
    "Big news: I've been collaborating with some amazing artists and we're about to release something that will change everything.",
  ],
  home: [
    "Hey, I'm just chilling at home but I had to reach out personally. I have some exciting news about my upcoming tour I want to share with you.",
    "I've been reflecting on this incredible year and I just want to say thank you. Your support means everything to me.",
    "Quick update from my living room — the new single is almost ready. I've been working on it all week and it feels amazing.",
  ],
  backstage: [
    "I'm backstage right now, literally minutes before going on stage. I'm so pumped and I wanted to tell you — this show is for you.",
    "You won't believe what's happening backstage right now. The energy is incredible and I can't wait to bring this performance to you.",
    "Just finished soundcheck and the vibes are absolutely immaculate. Tonight's show is going to be unforgettable.",
  ],
  live: [
    "Are you ready? Because I'm about to give you everything I have on this stage tonight. This is what we've been building toward.",
    "I've been dreaming of this moment. Standing here, seeing all of you — this is why I make music. Thank you for making this possible.",
    "This is my passion, my life, my everything. Every song I write, every note I sing — it's all for this moment right here with you.",
  ],
};

// ─── Voice Options ────────────────────────────────────────────────────────────
const VOICES = [
  'Melissa', 'Jenny', 'Ivy', 'Hope', 'Juniper', 'Willow', 'Jane',
  'John Doe', 'Andrew', 'Patrick', 'Rafael', 'Aaron', 'Reid',
  'Warm Pro Narrator', 'Chill Brian', 'Bold Blake',
];

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({
  video,
  onDelete,
  isOwnProfile,
  accent,
}: {
  video: AvatarVideo;
  onDelete: (id: number) => void;
  isOwnProfile: boolean;
  accent: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scene = SCENES.find(s => s.id === video.scene) ?? SCENES[0];

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play(); setPlaying(true); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      className="relative rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid rgba(255,255,255,0.08)`,
        width: video.aspectRatio === '9:16' ? 160 : 240,
      }}
    >
      {/* Video */}
      <div
        className="relative cursor-pointer group"
        style={{ aspectRatio: video.aspectRatio === '9:16' ? '9/16' : video.aspectRatio === '1:1' ? '1/1' : '16/9' }}
        onClick={toggle}
      >
        <video
          ref={videoRef}
          src={video.videoUrl}
          className="w-full h-full object-cover"
          loop
          playsInline
          onEnded={() => setPlaying(false)}
        />
        {/* Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
          <motion.div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: `${accent}cc` }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </motion.div>
        </div>
        {/* Scene badge */}
        <div
          className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white/90"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <span>{scene.emoji}</span>
          <span>{scene.label}</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-white/90 text-xs font-semibold truncate">{video.title || 'Avatar Talk'}</p>
        {video.prompt && (
          <p className="text-white/40 text-[10px] leading-snug line-clamp-2">{video.prompt}</p>
        )}
        {isOwnProfile && (
          <button
            onClick={() => { setDeleting(true); onDelete(video.id); }}
            disabled={deleting}
            className="mt-1 flex items-center gap-1 text-red-400/60 hover:text-red-400 text-[10px] transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AvatarTalkModule({
  artistId,
  artistName,
  artistProfileImage,
  isOwnProfile,
  colors,
}: AvatarTalkModuleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [selectedScene, setSelectedScene] = useState<Scene>('studio');
  const [prompt, setPrompt] = useState('');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('talk-to-me');
  const [voice, setVoice] = useState('Melissa');
  const [talkingStyle, setTalkingStyle] = useState<TalkingStyle>('stable');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [useFluxAvatar, setUseFluxAvatar] = useState(true);
  const [title, setTitle] = useState('');
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);

  // Fetch existing videos
  const { data: videosData, isLoading: loadingVideos } = useQuery({
    queryKey: ['avatar-talk-videos', artistId],
    queryFn: () => apiRequest({ url: `/api/avatar-talk/${artistId}/videos`, method: 'GET' }),
    staleTime: 30_000,
  });

  const { data: talkToMeConfigData } = useQuery({
    queryKey: ['avatar-talk-ttm-config', artistId],
    queryFn: () => apiRequest({ url: `/api/talk-to-me/config/${artistId}`, method: 'GET' }),
    staleTime: 60_000,
  });

  const videos: AvatarVideo[] = (videosData as any)?.videos ?? [];
  const talkToMeConfig = (talkToMeConfigData as any)?.config;
  const talkToMeVoiceLabel = talkToMeConfig?.voice_name
    || (talkToMeConfig?.cloned_voice_id ? 'Cloned artist voice' : talkToMeConfig?.voice_id ? 'Selected ElevenLabs voice' : 'Default ElevenLabs voice');

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (videoId: number) => {
      const token = await getAuthToken();
      return apiRequest({
        url: `/api/avatar-talk/${artistId}/videos/${videoId}`,
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar-talk-videos', artistId] });
    },
    onError: (err: any) => {
      toast({ title: '❌ Delete failed', description: err?.message, variant: 'destructive' });
    },
  });

  const handleGenerate = async () => {
    if (!artistProfileImage) {
      toast({
        title: 'Profile image required',
        description: 'Upload a profile photo first — it will be used as your avatar.',
        variant: 'destructive',
      });
      return;
    }
    if (prompt.trim().length < 10) {
      toast({ title: 'Script too short', description: 'Write at least 10 characters for the avatar to speak.', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    setGenerationStep(useFluxAvatar ? '1/3 — Synthesizing voice with ElevenLabs…' : '1/2 — Synthesizing voice with ElevenLabs…');
    try {
      const token = await getAuthToken();
      if (useFluxAvatar) setGenerationStep('2/3 — Generating Flux Kontext avatar…');
      else setGenerationStep('2/2 — Rendering talking-head video…');
      const data: any = await apiRequest({
        url: `/api/avatar-talk/${artistId}/generate`,
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        data: {
          imageUrl: artistProfileImage,
          artistName,
          prompt: prompt.trim(),
          voiceMode,
          voice: voiceMode === 'heygen' ? voice : undefined,
          useFluxAvatar,
          scene: selectedScene,
          talkingStyle,
          aspectRatio,
          captionsEnabled,
          title: title.trim() || undefined,
        },
      });

      if (data?.success) {
        setGenerationStep(null);
        toast({ title: '🎬 Video ready!', description: 'Your Avatar Talk video has been generated with the selected pipeline.' });
        queryClient.invalidateQueries({ queryKey: ['avatar-talk-videos', artistId] });
        setPrompt('');
        setTitle('');
      } else {
        setGenerationStep(null);
        toast({ title: '❌ Generation failed', description: data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      setGenerationStep(null);
      toast({ title: '❌ Generation failed', description: err?.message || 'Network error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const activeScene = SCENES.find(s => s.id === selectedScene)!;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl"
          style={{ background: `${colors.hexAccent}22`, border: `1px solid ${colors.hexAccent}44` }}
        >
          <MonitorPlay className="w-5 h-5" style={{ color: colors.hexAccent }} />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">Avatar Talk</h3>
          <p className="text-white/40 text-xs">ElevenLabs voice + Flux avatar + FAL Avatar4</p>
        </div>
      </div>

      {/* Video Gallery */}
      {loadingVideos ? (
        <div className="flex items-center gap-2 text-white/30 text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading videos…
        </div>
      ) : videos.length > 0 ? (
        <div>
          <p className="text-white/50 text-xs font-medium mb-3 uppercase tracking-wider">Your Videos</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
            <AnimatePresence>
              {videos.map(v => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onDelete={id => deleteMutation.mutate(id)}
                  isOwnProfile={isOwnProfile}
                  accent={colors.hexAccent}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-10 rounded-2xl gap-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: `1px dashed rgba(255,255,255,0.08)` }}
        >
          <Camera className="w-8 h-8 text-white/15" />
          <p className="text-white/25 text-sm">No videos yet</p>
          {isOwnProfile && (
            <p className="text-white/20 text-xs text-center max-w-xs">
              Generate your first Avatar Talk video below
            </p>
          )}
        </div>
      )}

      {/* Generator — only for own profile */}
      {isOwnProfile && (
        <div
          className="rounded-2xl space-y-5 p-4 sm:p-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)` }}
        >
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" style={{ color: colors.hexAccent }} />
            <span className="text-white/80 text-sm font-medium">Generate New Video</span>
          </div>

          {/* Pipeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Voice Engine</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'talk-to-me' as VoiceMode, label: 'Talk To Me' },
                  { id: 'heygen' as VoiceMode, label: 'HeyGen' },
                ]).map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setVoiceMode(mode.id)}
                    className="py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: voiceMode === mode.id ? `${colors.hexAccent}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${voiceMode === mode.id ? colors.hexAccent : 'rgba(255,255,255,0.08)'}`,
                      color: voiceMode === mode.id ? colors.hexAccent : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Avatar Source</label>
              <button
                onClick={() => setUseFluxAvatar(v => !v)}
                className="w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
                style={{
                  background: useFluxAvatar ? `${colors.hexAccent}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${useFluxAvatar ? colors.hexAccent : 'rgba(255,255,255,0.08)'}`,
                  color: useFluxAvatar ? colors.hexAccent : 'rgba(255,255,255,0.5)',
                }}
              >
                {useFluxAvatar ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {useFluxAvatar ? 'Flux Kontext' : 'Profile Photo'}
              </button>
            </div>
          </div>

          {/* No profile image warning */}
          {!artistProfileImage && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-300/80">
                Upload a profile photo first — the AI uses your face as the avatar. Make sure it shows your face clearly.
              </p>
            </div>
          )}

          {/* Scene selector */}
          <div>
            <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Scene</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SCENES.map(scene => {
                const Icon = scene.icon;
                const active = selectedScene === scene.id;
                return (
                  <motion.button
                    key={scene.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedScene(scene.id)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
                    style={{
                      background: active ? `${colors.hexAccent}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? colors.hexAccent : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <span className="text-lg">{scene.emoji}</span>
                    <span className="text-[11px] font-semibold" style={{ color: active ? colors.hexAccent : 'rgba(255,255,255,0.7)' }}>
                      {scene.label}
                    </span>
                    <span className="text-[9px] text-white/30 leading-snug hidden sm:block">{scene.description}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Script / Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/40 text-xs uppercase tracking-wider">Script</label>
              <span className="text-white/25 text-[10px]">{prompt.length}/500</span>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value.slice(0, 500))}
              placeholder={`What will ${artistName} say in this ${activeScene.label} video?`}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white/80 text-sm placeholder-white/20 resize-none focus:outline-none focus:ring-1 transition-all"
              style={{ ['--tw-ring-color' as any]: colors.hexAccent }}
            />
            {/* Suggested scripts */}
            <div className="mt-2 space-y-1">
              <p className="text-white/25 text-[10px] uppercase tracking-wider">Suggestions</p>
              {SUGGESTED_SCRIPTS[selectedScene].map((s, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(s)}
                  className="w-full text-left text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 rounded-lg px-2 py-1.5 transition-all line-clamp-1"
                >
                  ↳ {s}
                </button>
              ))}
            </div>
          </div>

          {/* Voice + Style row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Voice */}
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Voice</label>
              {voiceMode === 'talk-to-me' ? (
                <div className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm text-white/80 bg-white/5 border border-white/10">
                  <span className="truncate">{talkToMeVoiceLabel}</span>
                  <Mic className="w-3.5 h-3.5 flex-shrink-0" style={{ color: colors.hexAccent }} />
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowVoiceDropdown(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm text-white/80 bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <span>{voice}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-white/30" />
                  </button>
                  <AnimatePresence>
                    {showVoiceDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto scrollbar-thin"
                        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}
                      >
                        {VOICES.map(v => (
                          <button
                            key={v}
                            onClick={() => { setVoice(v); setShowVoiceDropdown(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/8 hover:text-white transition-colors flex items-center justify-between"
                          >
                            {v}
                            {v === voice && <Check className="w-3 h-3" style={{ color: colors.hexAccent }} />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Talking Style */}
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Style</label>
              <div className="flex gap-2">
                {(['stable', 'expressive'] as TalkingStyle[]).map(style => (
                  <button
                    key={style}
                    onClick={() => setTalkingStyle(style)}
                    className="flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all"
                    style={{
                      background: talkingStyle === style ? `${colors.hexAccent}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${talkingStyle === style ? colors.hexAccent : 'rgba(255,255,255,0.08)'}`,
                      color: talkingStyle === style ? colors.hexAccent : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Aspect + Captions + Title row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Aspect Ratio */}
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Format</label>
              <div className="flex gap-2">
                {(['9:16', '16:9', '1:1'] as AspectRatio[]).map(ar => (
                  <button
                    key={ar}
                    onClick={() => setAspectRatio(ar)}
                    className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: aspectRatio === ar ? `${colors.hexAccent}22` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${aspectRatio === ar ? colors.hexAccent : 'rgba(255,255,255,0.08)'}`,
                      color: aspectRatio === ar ? colors.hexAccent : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            {/* Captions */}
            <div>
              <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Captions</label>
              <button
                onClick={() => setCaptionsEnabled(v => !v)}
                className="w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
                style={{
                  background: captionsEnabled ? `${colors.hexAccent}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${captionsEnabled ? colors.hexAccent : 'rgba(255,255,255,0.08)'}`,
                  color: captionsEnabled ? colors.hexAccent : 'rgba(255,255,255,0.5)',
                }}
              >
                {captionsEnabled ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {captionsEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Title (optional) */}
          <div>
            <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 80))}
              placeholder={`e.g. "New Album Announcement"`}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm placeholder-white/20 focus:outline-none focus:ring-1 transition-all"
              style={{ ['--tw-ring-color' as any]: colors.hexAccent }}
            />
          </div>

          {/* Generate button */}
          <motion.button
            whileHover={!generating ? { scale: 1.02 } : undefined}
            whileTap={!generating ? { scale: 0.98 } : undefined}
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: generating
                ? 'rgba(255,255,255,0.05)'
                : `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
              color: generating ? 'rgba(255,255,255,0.3)' : '#fff',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Avatar Talk
              </>
            )}
          </motion.button>

          {generating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: colors.hexAccent }} />
                <p className="text-center text-white/50 text-xs font-medium">
                  {generationStep || 'Processing…'}
                </p>
              </div>
              <p className="text-center text-white/25 text-[10px]">
                Pipeline: Voice → Avatar → Talking Head. Do not close this page.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
