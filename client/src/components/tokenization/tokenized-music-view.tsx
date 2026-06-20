import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, ShoppingCart, Sparkles, Wallet, Loader2 } from 'lucide-react';
import { BuyTokensDialog } from './buy-tokens-dialog';
import { useWeb3 } from '../../hooks/use-web3';

// Componente ConnectButton lazy para evitar errores cuando wagmi no está disponible
const LazyConnectButton = () => {
  const { isWeb3Ready } = useWeb3();
  
  // Don't try to render RainbowKit until WagmiProvider is ready
  if (!isWeb3Ready) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading Wallet...
      </Button>
    );
  }
  
  try {
    const { ConnectButton } = require('@rainbow-me/rainbowkit');
    return <ConnectButton chainStatus="none" showBalance={false} />;
  } catch {
    return (
      <Button variant="outline" disabled>
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }
};

interface TokenizedSong {
  id: number;
  songName: string;
  tokenSymbol: string;
  totalSupply: number;
  availableSupply: number;
  pricePerTokenUsd: string;
  pricePerTokenEth: string;
  imageUrl?: string;
  description?: string;
  benefits?: string[];
  contractAddress: string;
  tokenId: number;
}

interface TokenizedMusicViewProps {
  artistId: string | number;
  postgresId?: number | null;
  isAIGenerated?: boolean;
  artistName?: string;
}

export function TokenizedMusicView({ artistId, postgresId, isAIGenerated, artistName }: TokenizedMusicViewProps) {
  // No usamos hooks de wagmi aquí - el botón de conectar wallet se encarga de todo
  const [selectedSong, setSelectedSong] = useState<TokenizedSong | null>(null);
  
  const numericArtistId = typeof artistId === 'string' ? parseInt(artistId) : artistId;
  const isValidId = !isNaN(numericArtistId);

  const { data: tokenizedSongs = [], isLoading } = useQuery<TokenizedSong[]>({
    queryKey: [`/api/tokenization/songs/active/${numericArtistId}`],
    enabled: isValidId,
  });

  const hasTokenizedSongs = tokenizedSongs.length > 0;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-muted rounded-lg"></div>
        <div className="h-32 bg-muted rounded-lg"></div>
      </div>
    );
  }

  if (!hasTokenizedSongs) {
    return (
      <Card className="overflow-hidden border-dashed" data-testid="tokenized-music-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Tokenized Music
          </CardTitle>
          <CardDescription>
            Coming soon: exclusive song tokens from {artistName || 'this artist'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Buy song fractions, get exclusive benefits and participate in royalties.
            This artist hasn't tokenized music yet — check back soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8" data-testid="tokenized-music-view">
      {hasTokenizedSongs && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Tokenized Music
              </h2>
              <p className="text-muted-foreground">
                Buy exclusive tokens with MetaMask and get special benefits
              </p>
            </div>
            <LazyConnectButton />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tokenizedSongs.map((song) => (
              <Card 
                key={song.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow"
                data-testid={`card-song-${song.id}`}
              >
                {song.imageUrl && (
                  <div className="aspect-square overflow-hidden bg-muted">
                    <img 
                      src={song.imageUrl} 
                      alt={song.songName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="line-clamp-1">{song.songName}</CardTitle>
                      <div className="mt-1">
                        <Badge variant="outline" className="font-mono">
                          {song.tokenSymbol}
                        </Badge>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {song.availableSupply} available
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {song.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {song.description}
                    </p>
                  )}

                  {song.benefits && song.benefits.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold mb-2">Benefits:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {song.benefits.slice(0, 3).map((benefit, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            <span className="line-clamp-1">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">${song.pricePerTokenUsd}</span>
                      <span className="text-sm text-muted-foreground">
                        por token
                      </span>
                    </div>
                    
                    {song.pricePerTokenEth && (
                      <p className="text-xs text-muted-foreground">
                        ≈ {parseFloat(song.pricePerTokenEth).toFixed(6)} ETH
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full mt-4"
                    onClick={() => setSelectedSong(song)}
                    disabled={song.availableSupply === 0}
                    data-testid={`button-buy-tokens-${song.id}`}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {song.availableSupply === 0 ? 'Sold Out' : 'Buy Tokens'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {selectedSong && (
        <BuyTokensDialog
          song={selectedSong}
          artistName={artistName}
          onClose={() => setSelectedSong(null)}
        />
      )}
    </div>
  );
}
