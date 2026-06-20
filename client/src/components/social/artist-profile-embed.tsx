import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { ExternalLink, Music, Users, MapPin, Heart } from "lucide-react";
import { Link } from "wouter";
import { BTFTipButton } from "../btf/btf-tip-button";
import { formatLocation } from "../../lib/formatLocation";

interface ArtistProfileEmbedProps {
  artist: {
    slug?: string;
    displayName?: string;
    artistName?: string;
    photoURL?: string;
    profileImage?: string;
    biography?: string;
    genre?: string;
    genres?: string[];
    location?: string | { city?: string; region?: string; country?: string; countryCode?: string; timezone?: string } | null;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    spotify?: string;
    walletAddress?: string;
  };
}

export function ArtistProfileEmbed({ artist }: ArtistProfileEmbedProps) {
  const artistName = artist.displayName || artist.artistName || "Artist";
  const profileImage = artist.photoURL || artist.profileImage;
  const slug = artist.slug;
  const primaryGenre = Array.isArray(artist.genres) ? artist.genres[0] : artist.genre;

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-orange-500/30 hover:border-orange-500/60 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-16 w-16 border-2 border-orange-500/30">
              <AvatarImage src={profileImage} alt={artistName} />
              <AvatarFallback className="bg-gradient-to-br from-orange-500 to-red-500 text-white">
                {artistName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg line-clamp-1">{artistName}</CardTitle>
              {primaryGenre && (
                <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30 mt-1">
                  {primaryGenre}
                </Badge>
              )}
            </div>
          </div>
          {slug && (
            <Link href={`/artist/${slug}`} asChild>
              <Button 
                size="sm" 
                className="bg-orange-500 hover:bg-orange-600 text-white ml-2"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Biography */}
        {artist.biography && (
          <p className="text-sm text-gray-300 line-clamp-2">
            {artist.biography}
          </p>
        )}

        {/* Location */}
        {formatLocation(artist.location) && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span>{formatLocation(artist.location)}</span>
          </div>
        )}

        {/* Redes Sociales */}
        <div className="flex gap-2 flex-wrap pt-2">
          {artist.spotify && (
            <a 
              href={artist.spotify} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300 hover:bg-green-500/30 transition"
            >
              Spotify
            </a>
          )}
          {artist.instagram && (
            <a 
              href={`https://instagram.com/${artist.instagram}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition"
            >
              Instagram
            </a>
          )}
          {artist.youtube && (
            <a 
              href={artist.youtube} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
            >
              YouTube
            </a>
          )}
          {artist.twitter && (
            <a 
              href={`https://twitter.com/${artist.twitter}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition"
            >
              Twitter
            </a>
          )}
        </div>

        {/* Botón Ver Perfil + Tip */}
        <div className="flex gap-2 mt-3">
          {slug && (
            <Link href={`/artist/${slug}`} asChild>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
                <Music className="h-4 w-4 mr-2" />
                View Profile
              </Button>
            </Link>
          )}
          <BTFTipButton
            artistAddress={artist.walletAddress}
            artistName={artistName}
            artistImage={profileImage}
            size="default"
          />
        </div>
      </CardContent>
    </Card>
  );
}
