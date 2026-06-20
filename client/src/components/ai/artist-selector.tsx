// Componente de selección de artista para agentes AI
import { useState } from 'react';
import { Check, ChevronDown, Music2, User, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { ArtistContext } from '../../hooks/use-artist-context';

interface ArtistSelectorProps {
  artists: ArtistContext[];
  selectedArtist: ArtistContext | null;
  onSelect: (artistId: number) => void;
  isLoading?: boolean;
  className?: string;
}

export function ArtistSelector({
  artists,
  selectedArtist,
  onSelect,
  isLoading = false,
  className,
}: ArtistSelectorProps) {
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 bg-[#1C1C24] rounded-lg border border-[#27272A]", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
        <span className="text-sm text-gray-400">Loading artists...</span>
      </div>
    );
  }

  if (artists.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2 bg-[#1C1C24] rounded-lg border border-[#27272A] border-dashed", className)}>
        <User className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-400">No artists found. Create one in My Artists.</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between bg-[#1C1C24] border-[#27272A] hover:bg-[#27272A] hover:border-orange-500/50 transition-all",
            className
          )}
        >
          {selectedArtist ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedArtist.profileImage} alt={selectedArtist.artistName} />
                <AvatarFallback className="bg-orange-500/20 text-orange-500 text-xs">
                  {selectedArtist.artistName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-white">{selectedArtist.artistName}</span>
              {selectedArtist.genre && (
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 text-xs">
                  {selectedArtist.genre}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-gray-400">Select an artist...</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-[#1C1C24] border-[#27272A]">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search artists..." className="border-0" />
          <CommandList>
            <CommandEmpty>No artist found.</CommandEmpty>
            <CommandGroup>
              {artists.map((artist) => (
                <CommandItem
                  key={artist.id}
                  value={artist.artistName}
                  onSelect={() => {
                    onSelect(artist.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#27272A]"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={artist.profileImage} alt={artist.artistName} />
                    <AvatarFallback className="bg-orange-500/20 text-orange-500">
                      {artist.artistName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1">
                    <span className="text-sm text-white">{artist.artistName}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      {artist.genre && <span>{artist.genre}</span>}
                      {artist.songs && artist.songs.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Music2 className="h-3 w-3" />
                          {artist.songs.length} songs
                        </span>
                      )}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 text-orange-500",
                      selectedArtist?.id === artist.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Mini version for embedding in agent cards
export function ArtistSelectorMini({
  artists,
  selectedArtist,
  onSelect,
  isLoading = false,
}: Omit<ArtistSelectorProps, 'className'>) {
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (artists.length === 0) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs hover:bg-orange-500/10"
        >
          {selectedArtist ? (
            <div className="flex items-center gap-1.5">
              <Avatar className="h-4 w-4">
                <AvatarImage src={selectedArtist.profileImage} alt={selectedArtist.artistName} />
                <AvatarFallback className="bg-orange-500/20 text-orange-500 text-[8px]">
                  {selectedArtist.artistName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-gray-300 max-w-[80px] truncate">{selectedArtist.artistName}</span>
            </div>
          ) : (
            <span className="text-gray-400">Select artist</span>
          )}
          <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0 bg-[#1C1C24] border-[#27272A]" align="start">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search..." className="border-0 h-8 text-sm" />
          <CommandList className="max-h-[200px]">
            <CommandEmpty className="py-2 text-xs text-center text-gray-400">No artists found.</CommandEmpty>
            <CommandGroup>
              {artists.map((artist) => (
                <CommandItem
                  key={artist.id}
                  value={artist.artistName}
                  onSelect={() => {
                    onSelect(artist.id);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-sm"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={artist.profileImage} alt={artist.artistName} />
                    <AvatarFallback className="bg-orange-500/20 text-orange-500 text-[10px]">
                      {artist.artistName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-white truncate">{artist.artistName}</span>
                  <Check
                    className={cn(
                      "h-3 w-3 text-orange-500",
                      selectedArtist?.id === artist.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
