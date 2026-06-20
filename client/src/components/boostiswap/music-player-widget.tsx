import React, { useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Music2 } from "lucide-react";

interface Track {
  id: string;
  title: string;
  duration: number;
  url: string;
}

interface MusicPlayerWidgetProps {
  tracks: Track[];
  artistName: string;
}

export function MusicPlayerWidget({ tracks, artistName }: MusicPlayerWidgetProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  if (!tracks || tracks.length === 0) {
    return null;
  }

  const validTracks = tracks.filter((t: Track) => t && t.url);
  if (validTracks.length === 0) {
    return null;
  }

  const currentTrack = validTracks[currentTrackIndex];

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % validTracks.length);
    setIsPlaying(true);
  };

  const playPrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + validTracks.length) % validTracks.length);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    playNext();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/10 rounded-lg p-3 border border-orange-500/30 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Music2 className="h-4 w-4 text-orange-400" />
        <p className="text-xs font-semibold text-orange-300">Listen to {artistName}</p>
      </div>

      <div className="bg-black/30 rounded p-2">
        <p className="text-xs text-white truncate mb-2">{currentTrack.title}</p>
        
        <div className="flex items-center gap-2 justify-between">
          <button
            onClick={playPrev}
            className="p-1 hover:bg-orange-500/20 rounded transition"
            title="Previous track"
          >
            <SkipBack className="h-3 w-3 text-orange-400" />
          </button>

          <button
            onClick={togglePlay}
            className="p-1 hover:bg-orange-500/30 rounded transition"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-orange-400" />
            ) : (
              <Play className="h-4 w-4 text-orange-400" />
            )}
          </button>

          <button
            onClick={playNext}
            className="p-1 hover:bg-orange-500/20 rounded transition"
            title="Next track"
          >
            <SkipForward className="h-3 w-3 text-orange-400" />
          </button>

          <div className="flex-1 flex items-center gap-1 text-xs text-white/70">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-black/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500"
                style={{
                  width: `${(currentTime / currentTrack.duration) * 100}%`,
                }}
              />
            </div>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        <p className="text-xs text-white/50 mt-1">
          Track {currentTrackIndex + 1} of {validTracks.length}
        </p>
      </div>

      {currentTrack.url && (
        <audio
          ref={audioRef}
          src={currentTrack.url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
}
