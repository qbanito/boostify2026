import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Music, Play, Pause, ExternalLink, Share2, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

interface PublicSong {
  id: number;
  title: string;
  genre: string | null;
  mood: string | null;
  coverArt: string | null;
  audioUrl: string | null;
  description: string | null;
  artistName: string | null;
  slug: string | null;
  profileImage: string | null;
}

export default function SongSharePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const { data: song, isLoading, isError } = useQuery<PublicSong>({
    queryKey: ["/api/songs", id, "public"],
    queryFn: async () => {
      const res = await fetch(`/api/songs/${id}/public`);
      if (!res.ok) throw new Error("Song not found");
      return res.json();
    },
    enabled: !!id,
    staleTime: 60_000,
  });

  // Update progress bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [song]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${song?.title} — ${song?.artistName} | Boostify Music`,
          text: `🎵 Listen to "${song?.title}" by ${song?.artistName} on Boostify Music`,
          url,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (isError || !song) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <Music className="h-16 w-16 text-white/20" />
        <p className="text-lg text-white/60">Song not found</p>
        <Button variant="outline" onClick={() => navigate("/explore")}>
          Explore Artists
        </Button>
      </div>
    );
  }

  const artistProfileUrl = song.slug ? `/artist/${song.slug}` : "/explore";
  const ogImageUrl = `${window.location.origin}/api/og-image/song/${song.id}`;

  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center p-4 sm:p-8"
      style={{
        background: "linear-gradient(135deg, #060606 0%, #1a0a00 45%, #060606 100%)",
      }}
    >
      {/* Hidden audio element */}
      {song.audioUrl && (
        <audio ref={audioRef} src={song.audioUrl} preload="metadata" />
      )}

      {/* Card */}
      <div className="w-full max-w-md bg-white/[0.04] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Cover Art */}
        <div className="relative w-full aspect-square bg-black">
          {song.coverArt ? (
            <img
              src={song.coverArt}
              alt={song.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900/30 to-black">
              <Music className="h-24 w-24 text-orange-500/40" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Play button overlay */}
          {song.audioUrl && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <span
                className="flex items-center justify-center w-20 h-20 rounded-full shadow-2xl transition-transform group-hover:scale-110"
                style={{
                  background: "linear-gradient(135deg, #ea580c, #f97316)",
                  boxShadow: "0 0 40px rgba(234,88,12,0.4)",
                }}
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8 text-white" fill="white" />
                ) : (
                  <Play className="h-8 w-8 text-white ml-1" fill="white" />
                )}
              </span>
            </button>
          )}
        </div>

        {/* Info Section */}
        <div className="p-6 space-y-4">
          {/* BOOSTIFY MUSIC label */}
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-5 rounded-sm"
              style={{ background: "linear-gradient(180deg, #ea580c, #f97316)" }}
            />
            <span className="text-xs font-bold tracking-widest text-orange-500">
              BOOSTIFY MUSIC
            </span>
          </div>

          {/* Song title + badges */}
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">
              {song.title}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {song.genre && (
                <Badge
                  className="text-white border-none text-xs font-bold"
                  style={{ background: "linear-gradient(135deg, #ea580c, #dc2626)" }}
                >
                  {song.genre.toUpperCase()}
                </Badge>
              )}
              {song.mood && (
                <Badge variant="outline" className="text-white/70 border-white/20 text-xs">
                  {song.mood}
                </Badge>
              )}
            </div>
          </div>

          {/* Artist row */}
          <div className="flex items-center gap-3">
            {song.profileImage && (
              <img
                src={song.profileImage}
                alt={song.artistName || "Artist"}
                className="w-10 h-10 rounded-full object-cover border-2 border-orange-500/50"
              />
            )}
            <span className="text-white/80 font-semibold text-sm">
              {song.artistName || "Artist"}
            </span>
          </div>

          {/* Progress bar (only when audio available) */}
          {song.audioUrl && (
            <div
              className="w-full h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden"
              onClick={handleSeek}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #ea580c, #f97316)",
                }}
              />
            </div>
          )}

          {/* Description */}
          {song.description && (
            <p className="text-white/50 text-sm leading-relaxed line-clamp-3">
              {song.description}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #ea580c, #f97316)",
                border: "none",
              }}
              onClick={() => navigate(artistProfileUrl)}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Artist Profile
            </Button>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={handleShare}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Boostify footer */}
      <div className="mt-8 text-center text-white/30 text-xs">
        Powered by{" "}
        <a
          href="/"
          className="text-orange-500/70 hover:text-orange-500 transition-colors"
        >
          Boostify Music
        </a>
      </div>
    </div>
  );
}
