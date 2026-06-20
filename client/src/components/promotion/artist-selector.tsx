/**
 * Selector de artista para páginas de promoción
 * Permite elegir entre el perfil propio y artistas generados por AI
 */
import { useState } from "react";
import { useArtistProfile, type ArtistProfile } from "@/hooks/use-artist-profile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Sparkles, Music } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArtistSelectorProps {
  onArtistChange?: (artist: ArtistProfile | null) => void;
  className?: string;
  label?: string;
  showLabel?: boolean;
}

export function ArtistSelector({ 
  onArtistChange, 
  className,
  label = "Promover como",
  showLabel = true
}: ArtistSelectorProps) {
  const { 
    allArtists, 
    currentArtist, 
    selectedArtist, 
    selectArtist,
    isLoading 
  } = useArtistProfile();

  const handleValueChange = (value: string) => {
    const artistId = value === "current" ? null : parseInt(value);
    selectArtist(artistId);
    
    if (onArtistChange) {
      if (artistId === null) {
        onArtistChange(currentArtist);
      } else {
        const artist = allArtists.find(a => a.id === artistId);
        onArtistChange(artist || null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (!currentArtist && allArtists.length === 0) {
    return null;
  }

  const currentValue = selectedArtist?.id === currentArtist?.id 
    ? "current" 
    : String(selectedArtist?.id || "current");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {showLabel && (
        <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {label}
        </label>
      )}
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full sm:w-[280px]">
          <SelectValue placeholder="Seleccionar artista">
            {selectedArtist && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={selectedArtist.profileImage || undefined} />
                  <AvatarFallback className="text-xs">
                    {selectedArtist.artistName?.charAt(0) || "A"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{selectedArtist.artistName}</span>
                {selectedArtist.isAIGenerated && (
                  <Sparkles className="h-3 w-3 text-purple-500" />
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Current user profile */}
          {currentArtist && (
            <SelectItem value="current" className="py-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={currentArtist.profileImage || undefined} />
                  <AvatarFallback className="text-xs">
                    {currentArtist.artistName?.charAt(0) || "Y"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{currentArtist.artistName || "Mi Perfil"}</span>
                  <span className="text-xs text-muted-foreground">Tu perfil</span>
                </div>
              </div>
            </SelectItem>
          )}
          
          {/* AI Generated artists */}
          {allArtists.filter(a => a.isAIGenerated).length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-purple-500" />
                Artistas Generados
              </div>
              {allArtists.filter(a => a.isAIGenerated).map((artist) => (
                <SelectItem key={artist.id} value={String(artist.id)} className="py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={artist.profileImage || undefined} />
                      <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                        {artist.artistName?.charAt(0) || "A"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{artist.artistName}</span>
                      {artist.genres && artist.genres.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Music className="h-2.5 w-2.5" />
                          {artist.genres[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// Componente compacto para usar en tarjetas
interface ArtistBadgeProps {
  artist: ArtistProfile | null;
  size?: "sm" | "md";
}

export function ArtistBadge({ artist, size = "md" }: ArtistBadgeProps) {
  if (!artist) return null;
  
  const sizeClasses = size === "sm" 
    ? "h-5 w-5 text-[10px]" 
    : "h-6 w-6 text-xs";

  return (
    <div className="flex items-center gap-1.5">
      <Avatar className={sizeClasses}>
        <AvatarImage src={artist.profileImage || undefined} />
        <AvatarFallback className={size === "sm" ? "text-[10px]" : "text-xs"}>
          {artist.artistName?.charAt(0) || "A"}
        </AvatarFallback>
      </Avatar>
      <span className={cn("font-medium", size === "sm" ? "text-xs" : "text-sm")}>
        {artist.artistName}
      </span>
      {artist.isAIGenerated && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
          AI
        </Badge>
      )}
    </div>
  );
}
