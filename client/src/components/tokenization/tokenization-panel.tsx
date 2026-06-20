import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Coins, TrendingUp, Wallet, Plus, Eye, EyeOff, Sparkles, Image as ImageIcon, Upload, Loader2, Music2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { TokenizedSongPreview } from './tokenized-song-preview';
import { TokenCardVisual } from '../boostiswap/token-card-visual';

interface TokenizedSong {
  id: number;
  songName: string;
  tokenSymbol: string;
  totalSupply: number;
  availableSupply: number;
  pricePerTokenUsd: string;
  royaltyPercentageArtist: number;
  isActive: boolean;
  imageUrl?: string;
  description?: string;
}

interface TokenizationPanelProps {
  artistId: number;
  artistName?: string;
  artistImage?: string;
  /** Songs already uploaded by the artist (from Music section). Used to sync tokenization with existing tracks. */
  availableSongs?: Array<{
    id: string | number;
    name?: string;
    title?: string;
    coverArt?: string;
    imageUrl?: string;
    description?: string;
  }>;
}

export function TokenizationPanel({ artistId, artistName = 'Tu Artista', artistImage, availableSongs = [] }: TokenizationPanelProps) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageTab, setImageTab] = useState<'url' | 'generate'>('url');
  const [artistImageUrl, setArtistImageUrl] = useState<string>(artistImage || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Artist');
  const [formData, setFormData] = useState({
    songName: '',
    tokenSymbol: '',
    totalSupply: 10000,
    pricePerTokenUsd: 0.10,
    contractAddress: '0x0000000000000000000000000000000000000000',
    imageUrl: '',
    description: '',
    benefits: '',
  });

  // Fetch artist info to get current image if not provided
  useEffect(() => {
    const fetchArtistInfo = async () => {
      try {
        const response = await fetch(`/api/artist/${artistId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.artist) {
            if (!artistImage && data.artist.profileImage) {
              setArtistImageUrl(data.artist.profileImage);
            }
          }
        }
      } catch (error) {
        console.log('Could not fetch artist info');
      }
    };

    if (!artistImage) {
      fetchArtistInfo();
    }
  }, [artistId, artistImage]);

  const { data: songs = [], isLoading } = useQuery<TokenizedSong[]>({
    queryKey: ['/api/tokenization/songs', artistId],
  });

  const { data: earnings } = useQuery({
    queryKey: ['/api/tokenization/earnings', artistId],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('🎵 [Tokenization] Enviando datos:', data);
      return apiRequest({
        url: '/api/tokenization/create',
        method: 'POST',
        data: data,
      });
    },
    onSuccess: () => {
      console.log('✅ [Tokenization] Canción tokenizada exitosamente');
      toast({
        title: '¡Canción tokenizada!',
        description: 'Tu canción ha sido tokenizada exitosamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tokenization/songs', artistId] });
      setShowCreateDialog(false);
      setFormData({
        songName: '',
        tokenSymbol: '',
        totalSupply: 10000,
        pricePerTokenUsd: 0.10,
        contractAddress: '0x0000000000000000000000000000000000000000',
        imageUrl: '',
        description: '',
        benefits: '',
      });
    },
    onError: (error: any) => {
      console.error('❌ [Tokenization] Error completo:', error);
      console.error('❌ [Tokenization] Error message:', error?.message);

      // apiRequest throws Error("<status>: <responseBodyText>"). Extract the
      // body and try to parse a JSON message so the toast shows the real
      // validation error instead of "undefined".
      let description = 'No se pudo tokenizar la canción';
      const raw = typeof error?.message === 'string' ? error.message : '';
      const sepIdx = raw.indexOf(': ');
      const bodyText = sepIdx > -1 ? raw.slice(sepIdx + 2) : raw;
      try {
        const parsed = JSON.parse(bodyText);
        description =
          parsed?.message ||
          parsed?.error ||
          (Array.isArray(parsed?.details)
            ? parsed.details
                .map((d: any) => `${(d.path || []).join('.')}: ${d.message}`)
                .join(', ')
            : null) ||
          bodyText ||
          raw ||
          description;
      } catch {
        description = bodyText || raw || description;
      }

      toast({
        title: 'Error de validación',
        description,
        variant: 'destructive',
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (songId: number) => apiRequest({
      url: `/api/tokenization/song/${songId}/toggle`,
      method: 'PUT',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tokenization/songs', artistId] });
      toast({
        title: 'Status updated',
        description: 'Song status has been updated.',
      });
    },
  });

  // Songs that are already tokenized (by name) - so we can hide them from the picker
  const tokenizedNames = new Set(
    songs.map((s) => (s.songName || '').trim().toLowerCase()).filter(Boolean)
  );
  const untokenizedSongs = availableSongs.filter((s) => {
    const n = (s.title || s.name || '').trim().toLowerCase();
    return n && !tokenizedNames.has(n);
  });

  // Auto-fill form when an existing uploaded song is selected from the picker
  const handleSelectExistingSong = (songId: string) => {
    setSelectedSongId(songId);
    if (!songId) return;
    const song = availableSongs.find((s) => String(s.id) === String(songId));
    if (!song) return;
    const name = (song.title || song.name || '').trim();
    const cover = song.coverArt || song.imageUrl || '';
    const baseSym = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const tokenSymbol = baseSym.length >= 2 ? baseSym : `SONG${Math.floor(Math.random() * 9000 + 1000)}`;
    setFormData((prev) => ({
      ...prev,
      songName: name || prev.songName,
      tokenSymbol: prev.tokenSymbol || tokenSymbol,
      imageUrl: cover || prev.imageUrl,
      description: song.description || prev.description,
    }));
  };

  const handleCreate = () => {
    const benefitsArray = formData.benefits.split(',').map(b => b.trim()).filter(Boolean);

    // Auto-generate tokenSymbol if empty: derive from songName, fallback to SONG.
    let tokenSymbol = (formData.tokenSymbol || '').trim().toUpperCase();
    if (!tokenSymbol) {
      const base = (formData.songName || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6);
      tokenSymbol = base.length >= 2 ? base : `SONG${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    if (!formData.songName.trim()) {
      toast({
        title: 'Song name required',
        description: 'Please enter a song name before tokenizing',
        variant: 'destructive',
      });
      return;
    }

    // Sanitize numeric fields — empty inputs become NaN which fails Zod on the
    // server with a confusing 400. Coerce to safe defaults.
    const totalSupply = Number.isFinite(formData.totalSupply) && formData.totalSupply > 0
      ? Math.floor(formData.totalSupply)
      : 10000;
    const pricePerTokenUsd = Number.isFinite(formData.pricePerTokenUsd) && formData.pricePerTokenUsd > 0
      ? formData.pricePerTokenUsd
      : 0.10;

    // imageUrl: only send if it's a real URL; empty string is allowed by the
    // schema but a malformed/relative path would fail .url() validation.
    const imageUrl = (formData.imageUrl || '').trim();
    const safeImageUrl = /^https?:\/\//i.test(imageUrl) ? imageUrl : '';

    createMutation.mutate({
      ...formData,
      // Tell the backend which artist this token belongs to. This is
      // critical when the logged user (e.g. the owner) is tokenizing on
      // behalf of an AI artist they own — otherwise songs end up under
      // the owner's id and never show on the AI artist's profile.
      artistId,
      tokenSymbol,
      totalSupply,
      pricePerTokenUsd,
      imageUrl: safeImageUrl,
      benefits: benefitsArray.length > 0 ? benefitsArray : null,
    });
  };

  const handleImproveDescription = async () => {
    if (!formData.songName) {
      toast({
        title: 'Name required',
        description: 'Enter the song name first',
        variant: 'destructive',
      });
      return;
    }

    setIsImprovingDescription(true);
    try {
      const result = await apiRequest({
        url: '/api/tokenization/ai/improve-description',
        method: 'POST',
        data: {
          songName: formData.songName,
          currentDescription: formData.description,
        },
      });

      setFormData({ ...formData, description: result.description });
      toast({
        title: 'Description improved!',
        description: 'AI has improved your description',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not improve the description',
        variant: 'destructive',
      });
    } finally {
      setIsImprovingDescription(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!formData.songName) {
      toast({
        title: 'Name required',
        description: 'Enter the song name first',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingImage(true);
    try {
      const result = await apiRequest({
        url: '/api/tokenization/ai/generate-image',
        method: 'POST',
        data: {
          songName: formData.songName,
          description: formData.description,
        },
      });

      setFormData({ ...formData, imageUrl: result.imageUrl });
      setImageTab('url');
      toast({
        title: 'Image generated!',
        description: 'AI has generated the image for your song',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Could not generate the image',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const totalEarningsEth = (earnings as any)?.totalEarningsEth || '0';

  return (
    <div className="space-y-6" data-testid="tokenization-panel">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Music Tokenization (Web3)
          </CardTitle>
          <CardDescription>
            Tokenize your songs on blockchain and allow fans to buy tokens with MetaMask
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tokenized Songs</p>
                    <p className="text-2xl font-bold">{songs.length}</p>
                  </div>
                  <Coins className="w-8 h-8 text-primary opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold">{parseFloat(totalEarningsEth).toFixed(4)} ETH</p>
                  </div>
                  <Wallet className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Tokens</p>
                    <p className="text-2xl font-bold">{songs.filter(s => s.isActive).length}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="w-full mb-4" data-testid="button-create-tokenized-song">
                <Plus className="w-4 h-4 mr-2" />
                Tokenize New Song
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tokenize Song</DialogTitle>
                <DialogDescription>
                  Create ERC-1155 tokens for your song on Polygon blockchain
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {availableSongs.length > 0 && (
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Music2 className="w-4 h-4 text-orange-400" />
                      Use an existing uploaded song
                    </Label>
                    <Select value={selectedSongId} onValueChange={handleSelectExistingSong}>
                      <SelectTrigger data-testid="select-existing-song">
                        <SelectValue placeholder={untokenizedSongs.length > 0 ? 'Select a song from your Music library...' : 'All your songs are already tokenized'} />
                      </SelectTrigger>
                      <SelectContent>
                        {untokenizedSongs.map((s) => (
                          <SelectItem key={String(s.id)} value={String(s.id)}>
                            {s.title || s.name || 'Untitled'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Auto-fills name, cover image and description from your Music section.
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="songName">Song Name</Label>
                  <Input
                    id="songName"
                    value={formData.songName}
                    onChange={(e) => setFormData({ ...formData, songName: e.target.value })}
                    placeholder="My Awesome Song"
                    data-testid="input-song-name"
                  />
                </div>

                <div>
                  <Label htmlFor="tokenSymbol">Token Symbol</Label>
                  <Input
                    id="tokenSymbol"
                    value={formData.tokenSymbol}
                    onChange={(e) => setFormData({ ...formData, tokenSymbol: e.target.value })}
                    placeholder="SONG-001"
                    maxLength={20}
                    data-testid="input-token-symbol"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="totalSupply">Total Supply</Label>
                    <Input
                      id="totalSupply"
                      type="number"
                      value={formData.totalSupply}
                      onChange={(e) => setFormData({ ...formData, totalSupply: parseInt(e.target.value) })}
                      data-testid="input-total-supply"
                    />
                  </div>

                  <div>
                    <Label htmlFor="pricePerToken">Price per Token (USD)</Label>
                    <Input
                      id="pricePerToken"
                      type="number"
                      step="0.01"
                      value={formData.pricePerTokenUsd}
                      onChange={(e) => setFormData({ ...formData, pricePerTokenUsd: parseFloat(e.target.value) })}
                      data-testid="input-price-per-token"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="description">Description</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleImproveDescription}
                      disabled={isImprovingDescription || !formData.songName}
                      className="gap-2"
                    >
                      {isImprovingDescription ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Improve with AI
                        </>
                      )}
                    </Button>
                  </div>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your song... (or use AI to generate)"
                    rows={4}
                    data-testid="input-description"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: Enter the song name and click "Improve with AI"
                  </p>
                </div>

                <div>
                  <Label htmlFor="benefits">Benefits (separated by commas)</Label>
                  <Input
                    id="benefits"
                    value={formData.benefits}
                    onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                    placeholder="Exclusive access, Merch discounts, Meet & greet"
                    data-testid="input-benefits"
                  />
                </div>

                <div>
                  <Label>Song Image</Label>
                  <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as 'url' | 'generate')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="url">
                        <Upload className="w-3 h-3 mr-1" />
                        Image URL
                      </TabsTrigger>
                      <TabsTrigger value="generate">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Generar con IA
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="space-y-2">
                      <Input
                        id="imageUrl"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        data-testid="input-image-url"
                      />
                      <p className="text-xs text-muted-foreground">
                        Paste the URL of an existing image
                      </p>
                    </TabsContent>
                    <TabsContent value="generate" className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage || !formData.songName}
                        className="w-full gap-2"
                      >
                        {isGeneratingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating image...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate Image with AI
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        AI will create a professional image based on the song name and description
                      </p>
                    </TabsContent>
                  </Tabs>
                  {formData.imageUrl && (
                    <div className="mt-2">
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleCreate} 
                  disabled={createMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-tokenization"
                >
                  {createMutation.isPending ? 'Tokenizing...' : 'Tokenize Song'}
                </Button>
              </div>

              {/* Token Preview on the Right */}
              <div className="flex flex-col gap-4">
                <div className="sticky top-0">
                  <TokenizedSongPreview
                    songName={formData.songName}
                    tokenSymbol={formData.tokenSymbol}
                    price={formData.pricePerTokenUsd}
                    artistImage={artistImageUrl}
                    songImageUrl={formData.imageUrl}
                    artistName={artistName}
                  />
                </div>
              </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-4">
            <h3 className="font-semibold">Your Tokenized Songs</h3>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : songs.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  You don't have tokenized songs yet. Create your first tokenization!
                </CardContent>
              </Card>
            ) : (
              songs.map((song) => (
                <Card key={song.id} data-testid={`card-tokenized-song-${song.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-start gap-4">
                      <div className="w-40 md:w-40 flex-shrink-0 mx-auto md:mx-0">
                        <TokenCardVisual
                          songName={song.songName}
                          artistName={artistName}
                          tokenSymbol={song.tokenSymbol}
                          price={parseFloat(String(song.pricePerTokenUsd)) || 0}
                          artistImage={artistImageUrl}
                          songImageUrl={song.imageUrl}
                          change24h={0}
                        />
                      </div>
                      <div className="flex-1 min-w-0 w-full flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-semibold truncate">{song.songName}</h4>
                            <Badge variant={song.isActive ? 'default' : 'secondary'}>
                              {song.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 text-sm">
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Symbol</p>
                              <p className="font-medium truncate">{song.tokenSymbol}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Available</p>
                              <p className="font-medium truncate">{song.availableSupply}/{song.totalSupply}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Price</p>
                              <p className="font-medium truncate">${song.pricePerTokenUsd}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-muted-foreground text-xs">Royalty</p>
                              <p className="font-medium truncate">{song.royaltyPercentageArtist}%</p>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleMutation.mutate(song.id)}
                          disabled={toggleMutation.isPending}
                          data-testid={`button-toggle-song-${song.id}`}
                        >
                          {song.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
