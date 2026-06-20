import React, { useState, useEffect } from "react";
import { Music2, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface Track {
  id: string;
  title: string;
  duration: number;
  url: string;
}

interface TokenCardVisualProps {
  songName: string;
  artistName: string;
  tokenSymbol: string;
  price: number;
  artistImage: string;
  songImageUrl?: string;
  change24h: number;
  tracks?: Track[];
}

export function TokenCardVisual({
  songName,
  artistName,
  tokenSymbol,
  price,
  artistImage,
  songImageUrl,
  change24h,
  tracks,
}: TokenCardVisualProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  // Prefer the song-specific image for the card background; fallback to artist image.
  const backgroundImage = songImageUrl || artistImage;
  const [chartData] = useState(() => {
    const data = [];
    for (let i = 0; i < 24; i++) {
      const basePrice = price * (1 + (Math.random() - 0.5) * 0.15);
      data.push({
        time: i,
        value: basePrice,
        pv: basePrice * 1.1
      });
    }
    return data;
  });

  React.useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageError(true);
      img.src = backgroundImage;
    }
  }, [backgroundImage]);

  React.useEffect(() => {
    setAvatarError(false);
  }, [artistImage]);

  // Animated spectrum bars
  const [spectrumHeights, setSpectrumHeights] = useState(Array(12).fill(0.3));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setSpectrumHeights(prev => 
        prev.map(() => 0.2 + Math.random() * 0.8)
      );
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 shadow-xl hover:shadow-2xl transition-all duration-300 group">
      {/* Dynamic Background with Song / Artist Image */}
      <div className="absolute inset-0">
        {backgroundImage && !imageError ? (
          <img
            src={backgroundImage}
            alt={songName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-900 to-slate-900" />
        )}
      </div>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/50 to-slate-950/90" />

      {/* Animated Spectrum Bars - Middle Section */}
      <div className="absolute inset-0 flex items-center justify-center z-5 opacity-40">
        <div className="flex items-end gap-1 h-32">
          {spectrumHeights.map((height, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-orange-500 via-purple-500 to-cyan-500 rounded-full transition-all duration-200 ease-out"
              style={{ height: `${height * 100}%`, minHeight: '4px' }}
            />
          ))}
        </div>
      </div>

      {/* Large Chart - Center Prominent */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 w-3/4 h-2/3 opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.9}/>
                <stop offset="25%" stopColor="#a855f7" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} fill="url(#colorArea)" isAnimationActive={true} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Token Symbol Badge - Top Left */}
      <div className="absolute top-4 left-4 z-20">
        <div className="bg-gradient-to-r from-orange-500/90 to-orange-600/90 backdrop-blur-md rounded-lg px-3 py-1.5 border border-orange-400/70 shadow-lg">
          <p className="text-white font-bold text-xs">{tokenSymbol}</p>
        </div>
      </div>

      {/* Price Change Badge - Top Right (only when no avatar so it doesn't collide) */}
      {change24h !== undefined && change24h !== 0 && !artistImage && (
        <div className="absolute top-4 right-4 z-20">
          <div className={`px-3 py-1.5 rounded-lg font-bold text-xs border shadow-lg backdrop-blur-md flex items-center gap-1 ${
            change24h >= 0
              ? "bg-gradient-to-r from-green-500/90 to-green-600/90 border-green-400/70"
              : "bg-gradient-to-r from-red-500/90 to-red-600/90 border-red-400/70"
          }`}>
            <TrendingUp className="w-3 h-3" />
            {change24h >= 0 ? "+" : ""}{change24h.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Artist Profile Circle - Top Right (smaller to avoid overlap with price) */}
      <div className="absolute top-3 right-3 z-20">
        <div className="w-12 h-12 rounded-full border-2 border-orange-400/80 overflow-hidden shadow-lg bg-gradient-to-br from-slate-700 to-slate-900 backdrop-blur-md ring-1 ring-orange-300/30">
          {artistImage && !avatarError ? (
            <img
              src={artistImage}
              alt={artistName}
              className="w-full h-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600">
              <Music2 className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Content - Bottom Left */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
        {/* Divider Line */}
        <div className="h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent mb-3" />

        {/* Song/Artist Info */}
        <div className="space-y-1.5">
          <h3 className="text-white font-bold text-sm leading-tight truncate drop-shadow-lg">
            {songName}
          </h3>
          <p className="text-orange-300 text-xs font-semibold drop-shadow opacity-90">{artistName}</p>
        </div>

        {/* Price Display with Animation */}
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-orange-400 drop-shadow-lg animate-pulse">
            ${price.toFixed(2)}
          </p>
          <p className="text-xs text-slate-300 opacity-70">
            {change24h >= 0 ? "↑" : "↓"} {Math.abs(change24h).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Animated Glow Borders */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-400/10 via-transparent to-purple-400/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Subtle Animation on Hover */}
      <div className="absolute inset-0 rounded-xl border border-orange-500/0 group-hover:border-orange-500/50 transition-all duration-300 pointer-events-none" />
    </div>
  );
}
