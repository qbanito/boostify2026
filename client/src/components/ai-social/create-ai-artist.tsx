/**
 * Create AI Artist - User-Generated AI Artists Wizard
 * 
 * "Crea tu propio artista IA con personalidad única"
 * 
 * Step-by-step wizard to create a custom AI artist with
 * personality presets, genre selection, and custom traits.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Wand2, Music, Trash2, User, X, Check, ChevronRight, Hexagon } from 'lucide-react';
import { Link } from 'wouter';

function getArtistAvatar(artistId: number, profileImageUrl: string | null): string {
  if (profileImageUrl) return profileImageUrl;
  const gender = artistId % 2 === 0 ? 'women' : 'men';
  const index = (artistId * 7 + 13) % 80;
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

interface PersonalityPreset {
  id: string;
  name: string;
  description: string;
  communicationStyle: string;
  traits: Record<string, number>;
}

interface UserCreatedArtist {
  id: number;
  creatorUserId: number;
  artistUserId: number;
  artistName: string;
  genre: string;
  personalityPreset: string;
  customTraits: Record<string, any>;
  isActive: boolean;
  createdAt: string;
}

const presetEmojis: Record<string, string> = {
  rebel: '🔥', romantic: '💘', party_animal: '🎉', intellectual: '🧠',
  mysterious: '🌙', wholesome: '☀️', aggressive: '⚡', chill: '🌊',
  experimental: '🎭', mainstream: '🌟',
};

const genreOptions = [
  'reggaeton', 'trap', 'pop', 'hip-hop', 'r&b', 'rock', 'indie',
  'electronic', 'latin pop', 'dembow', 'corridos', 'afrobeats',
];

interface CreateAiArtistProps {
  userId?: number;
}

export function CreateAiArtist({ userId }: CreateAiArtistProps) {
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(1); // 1: name+genre, 2: personality, 3: confirm
  const [artistName, setArtistName] = useState('');
  const [genre, setGenre] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const { data: presets } = useQuery<PersonalityPreset[]>({
    queryKey: ['/api/ai-social/user-artists/presets'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/ai-social/user-artists/presets');
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: myArtists, isLoading } = useQuery<UserCreatedArtist[]>({
    queryKey: ['/api/ai-social/user-artists', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await apiRequest('GET', `/api/ai-social/user-artists/${userId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/ai-social/user-artists/create', {
        creatorUserId: userId,
        artistName,
        genre,
        personalityPreset: selectedPreset,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/ai-social/user-artists'] });
        resetWizard();
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/ai-social/user-artists/${id}`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-social/user-artists'] });
    },
  });

  function resetWizard() {
    setShowWizard(false);
    setStep(1);
    setArtistName('');
    setGenre('');
    setSelectedPreset(null);
  }

  if (!userId) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Tus Artistas IA</h3>
          <Badge className="bg-purple-500/20 text-purple-300 text-[10px] border-purple-500/30">
            {myArtists?.length || 0}/3
          </Badge>
        </div>
        {(myArtists?.length || 0) < 3 && (
          <Button
            size="sm"
            className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Crear Artista
          </Button>
        )}
      </div>

      {/* My Artists */}
      {myArtists && myArtists.length > 0 && (
        <div className="space-y-2">
          {myArtists.map((artist) => (
            <Card key={artist.id} className="bg-white/5 border-white/10">
              <CardContent className="p-3 flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-purple-500/40">
                  <AvatarImage src={getArtistAvatar(artist.artistUserId, null)} />
                  <AvatarFallback className="text-xs bg-purple-600">
                    {(artist.artistName || '?')[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{artist.artistName}</span>
                    <span className="text-sm">{presetEmojis[artist.personalityPreset] || '🎵'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className="bg-white/10 text-white/50 text-[9px]">{artist.genre}</Badge>
                    <Badge className="bg-purple-500/15 text-purple-300 text-[9px]">{artist.personalityPreset}</Badge>
                  </div>
                </div>
                <Link href="/btf-artist-mint">
                  <Button
                    size="sm"
                    className="h-7 text-[10px] bg-gradient-to-r from-purple-600 to-orange-600 hover:from-purple-700 hover:to-orange-700 text-white px-2"
                    title="Mint on-chain with BTF"
                  >
                    <Hexagon className="h-3 w-3 mr-1" />
                    Mint
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 text-red-400 hover:text-red-300 p-0"
                  onClick={() => deleteMutation.mutate(artist.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {(!myArtists || myArtists.length === 0) && !isLoading && !showWizard && (
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="p-6 text-center">
            <Sparkles className="h-8 w-8 text-purple-400 mx-auto mb-2" />
            <p className="text-white/70 text-sm">¡Crea tu propio artista IA!</p>
            <p className="text-[11px] text-white/40 mt-1">Dale un nombre, estilo y personalidad única</p>
            <Button
              size="sm"
              className="mt-3 bg-purple-600 hover:bg-purple-700"
              onClick={() => setShowWizard(true)}
            >
              <Wand2 className="h-3 w-3 mr-1" />
              Crear mi primer artista
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Creation Wizard */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white">
                    {step === 1 ? '🎵 Nombre & Género' : step === 2 ? '🧠 Personalidad' : '✨ Confirmar'}
                  </h4>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={resetWizard}>
                    <X className="h-4 w-4 text-white/50" />
                  </Button>
                </div>

                {/* Step 1: Name & Genre */}
                {step === 1 && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Nombre artístico</label>
                      <Input
                        placeholder="e.g. Luna Beats, MC Quantum..."
                        value={artistName}
                        onChange={e => setArtistName(e.target.value)}
                        className="mt-1 bg-white/5 border-white/10 text-white text-sm h-8"
                        maxLength={30}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider">Género musical</label>
                      <div className="grid grid-cols-3 gap-1.5 mt-1">
                        {genreOptions.map(g => (
                          <button
                            key={g}
                            className={cn(
                              "text-[10px] py-1.5 px-2 rounded-md transition-all",
                              genre === g
                                ? "bg-purple-600 text-white ring-1 ring-purple-400"
                                : "bg-white/5 text-white/50 hover:bg-white/10"
                            )}
                            onClick={() => setGenre(g)}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-xs"
                      disabled={!artistName.trim() || !genre}
                      onClick={() => setStep(2)}
                    >
                      Siguiente <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Step 2: Personality */}
                {step === 2 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {presets?.map(preset => (
                        <button
                          key={preset.id}
                          className={cn(
                            "p-2 rounded-lg text-left transition-all",
                            selectedPreset === preset.id
                              ? "bg-purple-600/30 ring-1 ring-purple-400"
                              : "bg-white/5 hover:bg-white/10"
                          )}
                          onClick={() => setSelectedPreset(preset.id)}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm">{presetEmojis[preset.id] || '🎵'}</span>
                            <span className="text-[11px] font-bold text-white">{preset.name}</span>
                          </div>
                          <p className="text-[9px] text-white/40 line-clamp-2">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs border-white/20"
                        onClick={() => setStep(1)}
                      >
                        Atrás
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs"
                        disabled={!selectedPreset}
                        onClick={() => setStep(3)}
                      >
                        Siguiente <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && (
                  <div className="space-y-3">
                    <div className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-purple-600/30 flex items-center justify-center">
                          <User className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <h5 className="font-bold text-white">{artistName}</h5>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge className="bg-white/10 text-white/60 text-[9px]">{genre}</Badge>
                            <Badge className="bg-purple-500/20 text-purple-300 text-[9px]">
                              {presetEmojis[selectedPreset || ''] || '🎵'} {selectedPreset}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/40 mt-2">
                        {presets?.find(p => p.id === selectedPreset)?.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs border-white/20"
                        onClick={() => setStep(2)}
                      >
                        Atrás
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                        onClick={() => createMutation.mutate()}
                        disabled={createMutation.isPending}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {createMutation.isPending ? 'Creando...' : '¡Crear Artista!'}
                      </Button>
                    </div>
                    {createMutation.isError && (
                      <p className="text-[10px] text-red-400 text-center">Error al crear artista. Intenta de nuevo.</p>
                    )}
                  </div>
                )}

                {/* Step Indicator */}
                <div className="flex justify-center gap-1 mt-3">
                  {[1, 2, 3].map(s => (
                    <div
                      key={s}
                      className={cn(
                        "h-1 rounded-full transition-all",
                        s === step ? "w-4 bg-purple-400" : s < step ? "w-2 bg-purple-600" : "w-2 bg-white/10"
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
