import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Music2, Play, Pause, Share2, ExternalLink, ArrowLeft, Facebook, Twitter, Link2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useToast } from "../hooks/use-toast";

interface SongData {
  id: number;
  title: string;
  description?: string;
  audioUrl: string;
  coverArt?: string;
  genre?: string;
  mood?: string;
  duration?: string;
  artistName?: string;
  artistSlug?: string;
  profileImage?: string;
  plays: number;
}

export default function SongPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [song, setSong] = useState<SongData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [shareOpen, setShareOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/songs/${id}/public`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.song) setSong(data.song);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !song) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        const m = Math.floor(audio.currentTime / 60);
        const s = Math.floor(audio.currentTime % 60);
        setCurrentTime(`${m}:${s.toString().padStart(2, "0")}`);
      }
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [song]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : `https://boostifymusic.com/song/${id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied!", description: "Share this song anywhere." });
    setShareOpen(false);
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank", "width=600,height=400");
    setShareOpen(false);
  };

  const handleTwitter = () => {
    const text = song ? `🎵 "${song.title}" by ${song.artistName} — listen on Boostify Music` : "Check this out on Boostify Music";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "width=600,height=400");
    setShareOpen(false);
  };

  const handleWhatsApp = () => {
    const text = song ? `🎵 "${song.title}" by ${song.artistName}: ${shareUrl}` : shareUrl;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShareOpen(false);
  };

  const handleLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank", "width=600,height=400");
    setShareOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white gap-4">
        <Music2 className="h-16 w-16 text-orange-500 opacity-40" />
        <p className="text-xl text-muted-foreground">Song not found</p>
        <Button variant="outline" onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Blurred background from cover art */}
      {song.coverArt && (
        <div
          className="fixed inset-0 z-0 opacity-20"
          style={{
            backgroundImage: `url(${song.coverArt})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px)",
          }}
        />
      )}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/80 via-black/60 to-black/95" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => song.artistSlug ? setLocation(`/artist/${song.artistSlug}`) : setLocation("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">{song.artistName || "Back"}</span>
          </button>
          <div className="text-sm font-bold tracking-widest text-orange-500">BOOSTIFY MUSIC</div>
        </div>

        {/* Main player */}
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 gap-8">
          {/* Cover Art */}
          <div className="relative">
            {/* Animated ring when playing */}
            {isPlaying && (
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 opacity-60 animate-spin [animation-duration:3s]" />
            )}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/20 border-2 border-orange-500/30">
              {song.coverArt ? (
                <img
                  src={song.coverArt}
                  alt={song.title}
                  className="w-72 h-72 md:w-96 md:h-96 object-cover"
                />
              ) : (
                <div className="w-72 h-72 md:w-96 md:h-96 bg-gradient-to-br from-orange-950 to-black flex items-center justify-center">
                  <Music2 className="h-24 w-24 text-orange-500 opacity-50" />
                </div>
              )}
            </div>
          </div>

          {/* Song info */}
          <div className="text-center max-w-lg">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 leading-tight">
              {song.title}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-3">
              {song.profileImage && (
                <img src={song.profileImage} alt={song.artistName} className="w-7 h-7 rounded-full border border-orange-500/50 object-cover" />
              )}
              <span className="text-lg text-orange-400 font-semibold">{song.artistName}</span>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {song.genre && <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">{song.genre}</Badge>}
              {song.mood && <Badge variant="outline" className="border-white/10 text-white/60">{song.mood}</Badge>}
            </div>
          </div>

          {/* Audio element (hidden) */}
          <audio ref={audioRef} src={song.audioUrl} preload="metadata" />

          {/* Progress bar */}
          <div className="w-full max-w-md">
            <div
              className="h-1.5 bg-white/10 rounded-full cursor-pointer relative overflow-hidden"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{currentTime}</span>
              <span>{song.duration || "--:--"}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            <button
              onClick={togglePlay}
              className="w-18 h-18 rounded-full bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 transition-all shadow-lg shadow-orange-500/40 flex items-center justify-center p-5"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 text-white" fill="white" />
              ) : (
                <Play className="h-8 w-8 text-white ml-1" fill="white" />
              )}
            </button>
          </div>

          {/* Share + View Profile actions */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {/* Share button with dropdown */}
            <div className="relative">
              <Button
                variant="outline"
                className="border-orange-500/30 hover:bg-orange-500/10 gap-2"
                onClick={() => setShareOpen(!shareOpen)}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              {shareOpen && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-3 flex flex-col gap-1 min-w-[180px] z-50">
                  <button
                    onClick={handleFacebook}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-blue-600/20 text-sm transition-colors"
                  >
                    <Facebook className="h-4 w-4 text-blue-400" /> Facebook
                  </button>
                  <button
                    onClick={handleTwitter}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-sky-500/20 text-sm transition-colors"
                  >
                    <Twitter className="h-4 w-4 text-sky-400" /> Twitter / X
                  </button>
                  <button
                    onClick={handleWhatsApp}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-green-500/20 text-sm transition-colors"
                  >
                    <span className="text-green-400 font-bold text-base">W</span> WhatsApp
                  </button>
                  <button
                    onClick={handleLinkedIn}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-blue-700/20 text-sm transition-colors"
                  >
                    <span className="text-blue-400 font-bold text-base">in</span> LinkedIn
                  </button>
                  <div className="border-t border-white/10 my-1" />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/5 text-sm transition-colors"
                  >
                    <Link2 className="h-4 w-4 text-orange-400" /> Copy Link
                  </button>
                </div>
              )}
            </div>

            {song.artistSlug && (
              <Button
                className="bg-orange-500 hover:bg-orange-600 gap-2"
                onClick={() => setLocation(`/artist/${song.artistSlug}`)}
              >
                <ExternalLink className="h-4 w-4" />
                Artist Profile
              </Button>
            )}
          </div>

          {/* Plays count */}
          {song.plays > 0 && (
            <p className="text-xs text-muted-foreground">{song.plays.toLocaleString()} plays</p>
          )}
        </div>

        {/* Footer */}
        <div className="py-4 text-center">
          <a href="/" className="text-xs text-orange-500/60 hover:text-orange-400 transition-colors tracking-widest font-bold">
            BOOSTIFYMUSIC.COM
          </a>
        </div>
      </div>
    </div>
  );
}
