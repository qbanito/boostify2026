import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { TokenCardVisual } from "../boostiswap/token-card-visual";

interface TokenizedSongPreviewProps {
  songName: string;
  tokenSymbol: string;
  price: number;
  artistImage?: string;
  songImageUrl?: string;
  artistName?: string;
}

export function TokenizedSongPreview({
  songName,
  tokenSymbol,
  price,
  artistImage = "https://api.dicebear.com/7.x/avataaars/svg?seed=Artist",
  songImageUrl,
  artistName = "Your Artist Name",
}: TokenizedSongPreviewProps) {
  return (
    <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700 overflow-hidden">
      <CardHeader className="border-b border-slate-700/50">
        <CardTitle className="flex items-center gap-2">
          🎨 Token Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground mb-4">
          This is how your token will appear in the marketplace
        </p>
        
        <div className="max-w-sm mx-auto">
          <TokenCardVisual
            songName={songName || "Song Name"}
            artistName={artistName}
            tokenSymbol={tokenSymbol || "TOKEN"}
            price={price || 0}
            artistImage={artistImage}
            songImageUrl={songImageUrl}
            change24h={0}
          />
        </div>

        <div className="mt-6 p-4 bg-slate-900/50 rounded-lg text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token Symbol:</span>
            <span className="font-semibold text-orange-400">{tokenSymbol || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price per Token:</span>
            <span className="font-semibold text-white">
              ${typeof price === "number" ? price.toFixed(2) : "0.00"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Artist Display:</span>
            <span className="font-semibold text-white text-right max-w-xs truncate">
              {artistName}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
