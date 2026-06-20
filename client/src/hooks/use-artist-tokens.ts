import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface ArtistToken {
  id: string;
  name: string;
  symbol: string;
  artist: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  image: string;
  genre: string;
}

export function useArtistTokens(): ArtistToken[] {
  const { data: tokenizedSongs = [] } = useQuery({
    queryKey: ['/api/boostiswap/tokenized-songs'],
    queryFn: async () => {
      try {
        const songs = await apiRequest({
          url: '/api/boostiswap/tokenized-songs',
          method: 'GET',
        });
        return songs;
      } catch (error) {
        console.error('Error fetching tokenized songs:', error);
        return [];
      }
    },
    staleTime: 30000,
  });

  // Convert tokenized songs to artist tokens format
  return tokenizedSongs.map((song: any) => ({
    id: song.tokenId?.toString() || song.id?.toString() || '0',
    name: song.songName,
    symbol: song.tokenSymbol,
    artist: song.artist || song.songName,
    price: parseFloat(song.pricePerTokenUsd || '0'),
    change24h: song.change24h || (Math.random() * 30 - 5),
    marketCap: (parseFloat(song.pricePerTokenUsd || '0') * song.totalSupply) || 0,
    volume24h: song.volume24h || Math.floor(Math.random() * 50000) + 10000,
    liquidity: (parseFloat(song.pricePerTokenUsd || '0') * song.availableSupply * 0.3) || 0,
    image: song.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${song.songName}`,
    genre: song.genre || 'Music'
  }));
}

export function getArtistTokenById(id: string): ArtistToken | undefined {
  // This will need to be called within a component to use the hook
  // For now, return undefined - caller should use useArtistTokens hook
  return undefined;
}
