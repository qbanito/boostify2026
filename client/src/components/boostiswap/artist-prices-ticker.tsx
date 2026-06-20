import React, { useState, useEffect, useRef } from "react";
import { useArtistTokens } from "@/hooks/use-artist-tokens";
import { TrendingUp, TrendingDown } from "lucide-react";

export function ArtistPricesTicker() {
  const artistTokens = useArtistTokens();
  const [animatedTokens, setAnimatedTokens] = useState(artistTokens);
  const initializedRef = useRef(false);

  // Solo actualizar cuando artistTokens cambia de contenido, no de referencia
  useEffect(() => {
    if (!initializedRef.current && artistTokens && artistTokens.length > 0) {
      setAnimatedTokens(artistTokens);
      initializedRef.current = true;
    }
  }, [artistTokens?.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedTokens(prev => prev?.map(token => ({
        ...token,
        price: token.price * (1 + (Math.random() - 0.5) * 0.01),
        change24h: token.change24h + (Math.random() - 0.5) * 0.3,
      })));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!animatedTokens || animatedTokens.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto scrollbar-hide">
      <div className="flex gap-4 pb-2">
        {animatedTokens.map((token) => (
          <div
            key={token.id}
            className="flex-shrink-0 bg-gradient-to-br from-slate-800/80 to-slate-700/50 border border-slate-600 rounded-lg p-4 w-64 hover:border-orange-500/50 transition group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                  {token.symbol.substring(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">Music Token</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xl font-bold text-white">
                ${token.price.toFixed(2)}
              </div>

              <div className={`flex items-center gap-1 text-sm font-semibold ${
                token.change24h >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {token.change24h >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-600/50">
              <p className="text-xs text-muted-foreground">24h Change</p>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full transition-all ${
                    token.change24h >= 0 ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Math.abs(token.change24h) * 15, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">🎵 Boostify Music Tokens • Prices update every 3 seconds</p>
    </div>
  );
}
