import { useState, useRef, useEffect } from "react";
import { Play, Pause, Heart, MessageCircle, Share2, ChevronUp, ChevronDown, Eye, Maximize2 } from "lucide-react";

interface InfluencerContentItem {
  id: number;
  title: string;
  topic: string;
  contentType: string;
  finalVideoUrl?: string | null;
  avatarVideoUrl?: string | null;
  voiceAudioUrl?: string | null;
  thumbnailUrl?: string | null;
  status: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  hashtags: string[];
  publishedAt?: string | null;
  createdAt: string;
}

interface ContentMiniScreenProps {
  content: InfluencerContentItem[];
  accentColor?: string;
  borderColor?: string;
}

export function ContentMiniScreen({ content, accentColor = '#F97316', borderColor = '#5E2B0C' }: ContentMiniScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentItem = content[currentIndex];

  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [currentIndex]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  const goNext = () => {
    if (currentIndex < content.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (!isFullscreen) {
        containerRef.current.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  if (!content.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[480px] rounded-2xl bg-black/60 border" style={{ borderColor }}>
        <div className="text-4xl mb-3">🎬</div>
        <p className="text-gray-400 text-sm">No content yet</p>
        <p className="text-gray-500 text-xs mt-1">Generate your first influencer video</p>
      </div>
    );
  }

  const videoUrl = currentItem.finalVideoUrl || currentItem.avatarVideoUrl;
  const statusColor = currentItem.status === 'published' ? '#22c55e'
    : currentItem.status === 'ready' ? '#3b82f6'
    : currentItem.status === 'failed' ? '#ef4444'
    : '#eab308';

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-black border"
      style={{ borderColor, aspectRatio: '9/16', maxHeight: isFullscreen ? '100vh' : '520px' }}
    >
      {/* Video / Thumbnail */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            loop
            playsInline
            poster={currentItem.thumbnailUrl || undefined}
            onClick={handlePlayPause}
          />
        ) : currentItem.thumbnailUrl ? (
          <img src={currentItem.thumbnailUrl} alt={currentItem.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="text-5xl">🎤</div>
            <p className="text-gray-400 text-xs">{currentItem.status === 'failed' ? 'Generation failed' : 'Processing...'}</p>
          </div>
        )}

        {/* Play overlay */}
        {videoUrl && !isPlaying && (
          <button
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="h-8 w-8 text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Top overlay — Status + Navigation */}
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: statusColor, color: '#000' }}
          >
            {currentItem.status.toUpperCase()}
          </span>
          <span className="text-[10px] text-gray-300">
            {currentIndex + 1} / {content.length}
          </span>
          <button onClick={toggleFullscreen} className="text-white/70 hover:text-white">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Right side — Navigation arrows */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/60"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex >= content.length - 1}
          className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/60"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Right side — Engagement */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 z-10">
        <div className="flex flex-col items-center">
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:text-red-400">
            <Heart className="h-5 w-5" />
          </button>
          <span className="text-[10px] text-white mt-0.5">{formatCount(currentItem.likes)}</span>
        </div>
        <div className="flex flex-col items-center">
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:text-blue-400">
            <MessageCircle className="h-5 w-5" />
          </button>
          <span className="text-[10px] text-white mt-0.5">{formatCount(currentItem.comments)}</span>
        </div>
        <div className="flex flex-col items-center">
          <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:text-green-400">
            <Share2 className="h-5 w-5" />
          </button>
          <span className="text-[10px] text-white mt-0.5">{formatCount(currentItem.shares)}</span>
        </div>
        <div className="flex flex-col items-center">
          <Eye className="h-4 w-4 text-gray-400" />
          <span className="text-[10px] text-gray-400 mt-0.5">{formatCount(currentItem.views)}</span>
        </div>
      </div>

      {/* Bottom overlay — Title + Hashtags */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent z-10">
        <h3 className="text-white text-sm font-semibold line-clamp-2 mb-1">
          {currentItem.title}
        </h3>
        {currentItem.hashtags && currentItem.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {currentItem.hashtags.slice(0, 4).map((tag, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: accentColor, backgroundColor: `${accentColor}20` }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="text-[10px] text-gray-400 mt-1">
          {currentItem.contentType.replace('_', ' ')} · {currentItem.topic.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
