import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { seededRange } from '@/lib/seeded';

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
    change24h: song.change24h ?? Number(seededRange(`chg-${song.id}`, -5, 25).toFixed(2)),
    marketCap: (parseFloat(song.pricePerTokenUsd || '0') * song.totalSupply) || 0,
    volume24h: song.volume24h ?? Math.floor(seededRange(`vol-${song.id}`, 10000, 60000)),
    liquidity: (parseFloat(song.pricePerTokenUsd || '0') * song.availableSupply * 0.3) || 0,
    image: song.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${song.songName}`,
    genre: song.genre || 'Music'
  }));
}
