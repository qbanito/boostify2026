import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TrendingUp, ShoppingCart, Music2, Loader2 } from "lucide-react";
import { TokenCardVisual } from "./token-card-visual";
import { ArtistDetailModal } from "./artist-detail-modal";
import { artistProfiles, ArtistProfile } from "@/data/artist-profiles";
import { getArtistImage } from "@/data/artist-images";
import { UtilityDisclaimer } from "../btf/utility-disclaimer";

export function ArtistTokensMarketplace() {
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedArtistProfile, setSelectedArtistProfile] =
    useState<ArtistProfile | null>(null);
  const [selectedArtistImage, setSelectedArtistImage] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ["/api/boostiswap/artist-tokens"],
    queryFn: async () => {
      try {
        return await apiRequest({
          url: "/api/boostiswap/artist-tokens",
          method: "GET",
        });
      } catch {
        return Object.values(artistProfiles).slice(0, 12).map((p, i) => ({
          id: i + 1,
          name: p.name,
          tokenSymbol: p.name.substring(0, 3).toUpperCase(),
          pricePerTokenUsd: 1.5 + Math.random() * 4,
          totalSupply: 50000,
          availableSupply: Math.floor(Math.random() * 20000),
          volume24h: Math.floor(Math.random() * 100000),
          holders: Math.floor(Math.random() * 1000),
          imageUrl: getArtistImage(i + 1),
          description: `${p.name} Artist Access Pack`,
          change24h: Math.random() * 30 - 5
        }));
      }
    },
  });

  const uniqueNames = Array.from(new Set(artists.map((a: any) => a.name)));
  const filteredArtists = selectedArtist ? artists.filter((a: any) => a.name === selectedArtist) : artists;

  const getArtistTracks = (artistName: string) => {
    const profile = Object.values(artistProfiles).find(p => p.name.toLowerCase() === artistName.toLowerCase());
    return profile?.tracks || [];
  };

  const handleTokenCardClick = (songId: number, artistName?: string, artistImageUrl?: string) => {
    console.log("🎯 Clicked token card for song ID:", songId, "Artist:", artistName, "Image:", artistImageUrl);
    
    // Find the profile by searching through all profiles for matching name
    let profile: ArtistProfile | null = null;
    
    // First try to find by artist name (exact match)
    if (artistName) {
      profile = Object.values(artistProfiles).find(p => p.name.toLowerCase() === artistName.toLowerCase()) || null;
      console.log("🔍 Found by artist name:", profile?.name);
    }
    
    // If not found, try loose matching (substring)
    if (!profile && artistName) {
      profile = Object.values(artistProfiles).find(p => 
        artistName.toLowerCase().includes(p.name.split(' ')[0].toLowerCase())
      ) || null;
      console.log("🔍 Found by loose match:", profile?.name);
    }
    
    // Try tokenId/songId mapping
    if (!profile) {
      // Map token IDs 1-20 to artist profile IDs 1-20
      const profileId = ((songId - 1) % 20) + 1;
      profile = artistProfiles[profileId] || null;
      console.log("🔍 Found by token ID mapping:", profile?.name);
    }
    
    // Last fallback: use first available profile
    if (!profile) {
      profile = Object.values(artistProfiles)[0] || null;
      console.log("🔍 Using first profile as fallback:", profile?.name);
    }
    
    if (profile) {
      console.log("📊 Opening modal for artist:", profile.name, "with image:", artistImageUrl);
      setSelectedArtistProfile(profile);
      // Use the image from the card, not from getArtistImage
      setSelectedArtistImage(artistImageUrl);
      setIsModalOpen(true);
    } else {
      console.warn("❌ No profile found for song:", songId);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <ArtistDetailModal artist={selectedArtistProfile} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} artistImage={selectedArtistImage} />
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">👤 Artist Access Packs</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Activate artist-specific digital service packs. These packs grant access to AI tools, promotions, and creative services — not financial returns.</p>
      </div>

      {uniqueNames.length > 0 && (
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
          <Button size="sm" variant={selectedArtist === null ? "default" : "outline"} onClick={() => setSelectedArtist(null)} className={selectedArtist === null ? "bg-orange-500 hover:bg-orange-600 whitespace-nowrap" : "whitespace-nowrap"}>
            All Artists
          </Button>
          {uniqueNames.map((artist) => (
            <Button key={artist} size="sm" variant={selectedArtist === artist ? "default" : "outline"} onClick={() => setSelectedArtist(artist as string)} className={selectedArtist === artist ? "bg-orange-500 hover:bg-orange-600 whitespace-nowrap" : "whitespace-nowrap"}>
              {artist}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      ) : filteredArtists.length === 0 ? (
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardContent className="py-12 text-center">
            <Music2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No artist access packs available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {filteredArtists.map((artist: any) => (
            <div key={artist.id} className="group cursor-pointer" data-testid={`artist-token-${artist.id}`}>
              <div className="mb-2 sm:mb-3 transform transition group-hover:scale-105" onClick={() => handleTokenCardClick(artist.id, artist.name, artist.imageUrl)}>
                <TokenCardVisual songName={artist.name} artistName={artist.name} tokenSymbol={artist.tokenSymbol} price={artist.pricePerTokenUsd} artistImage={artist.imageUrl} songImageUrl={artist.imageUrl} change24h={artist.change24h || 0} tracks={getArtistTracks(artist.name)} />
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 sm:p-3 border border-slate-700 space-y-2 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Available</p>
                    <p className="font-semibold text-white">{(artist.availableSupply / 1000).toFixed(0)}K</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Holders</p>
                    <p className="font-semibold text-white">{artist.holders}</p>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded p-2">
                  <p className="text-muted-foreground text-xs">24h Volume</p>
                  <p className="font-semibold text-green-400">${(artist.volume24h / 1000).toFixed(0)}K</p>
                </div>
                {artist.description && <p className="text-xs text-muted-foreground line-clamp-1">{artist.description}</p>}
                <Button onClick={() => handleTokenCardClick(artist.id, artist.name, artist.imageUrl)} className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-xs sm:text-sm py-2 h-auto" data-testid={`button-buy-artist-${artist.id}`}>
                  <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
                  Activate Access
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <UtilityDisclaimer variant="short" size="xs" className="mt-4" />
    </div>
  );
}
