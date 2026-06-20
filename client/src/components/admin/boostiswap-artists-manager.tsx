import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { useToast } from '../../hooks/use-toast';
import { queryClient, apiRequest } from '../../lib/queryClient';
import { 
  Trash2, Edit2, RefreshCw, Eye, Music, User, MapPin, 
  Instagram, Twitter, Youtube, ExternalLink, Save, X, Image as ImageIcon, Zap
} from 'lucide-react';

interface BoostiSwapArtist {
  id: number;
  artistName: string;
  slug: string;
  biography?: string;
  profileImage?: string;
  coverImage?: string;
  genres?: string[];
  country?: string;
  location?: string;
  instagramHandle?: string;
  twitterHandle?: string;
  youtubeHandle?: string;
  spotifyUrl?: string;
  isAIGenerated: boolean;
  createdAt?: string;
}

export function BoostiSwapArtistsManager() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editingArtist, setEditingArtist] = useState<BoostiSwapArtist | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Fetch all BoostiSwap artists (static marketplace artists + those with tokenized songs)
  const { data: artistsData, isLoading, refetch } = useQuery<{ success: boolean; artists: BoostiSwapArtist[] }>({
    queryKey: ['/api/admin/boostiswap-artists'],
  });

  const artists = artistsData?.artists || [];
  const filteredArtists = search 
    ? artists.filter(a => a.artistName?.toLowerCase().includes(search.toLowerCase()) || a.slug?.includes(search.toLowerCase()))
    : artists;

  // Update artist mutation
  const updateArtistMutation = useMutation({
    mutationFn: async (artist: BoostiSwapArtist) => {
      return apiRequest({
        url: `/api/admin/boostiswap-artists/${artist.id}`,
        method: 'PATCH',
        data: artist
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Artist updated successfully' });
      setShowEditDialog(false);
      setEditingArtist(null);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/boostiswap-artists'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update artist',
        variant: 'destructive'
      });
    }
  });

  // Delete artist mutation
  const deleteArtistMutation = useMutation({
    mutationFn: async (artistId: number) => {
      return apiRequest({
        url: `/api/admin/boostiswap-artists/${artistId}`,
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Artist deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/boostiswap-artists'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete artist',
        variant: 'destructive'
      });
    }
  });

  const handleEdit = (artist: BoostiSwapArtist) => {
    setEditingArtist({ ...artist });
    setShowEditDialog(true);
  };

  const handleSave = () => {
    if (editingArtist) {
      updateArtistMutation.mutate(editingArtist);
    }
  };

  const handleDelete = (artistId: number, artistName: string) => {
    if (confirm(`Are you sure you want to delete "${artistName}"? This action cannot be undone.`)) {
      deleteArtistMutation.mutate(artistId);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await apiRequest({
        url: '/api/admin/boostiswap-artists/sync',
        method: 'POST',
      });
      if (data.success) {
        toast({ title: 'Sync Complete', description: data.message });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/boostiswap-artists'] });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Sync failed', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search artists by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-900 border-slate-700"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSync}
            variant="outline"
            size="sm"
            disabled={syncing}
            className="border-green-500/50 text-green-300 hover:bg-green-500/10"
          >
            {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            {syncing ? 'Syncing...' : 'Sync 20 Artists'}
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="border-orange-500/50 text-orange-300"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Artists Grid */}
      <Card className="bg-gradient-to-br from-slate-900/90 to-slate-900/50 border border-orange-500/20">
        <CardHeader>
          <CardTitle className="text-orange-300 flex items-center gap-2">
            <Music className="h-5 w-5" />
            BoostiSwap Artists ({filteredArtists.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading artists...</div>
          ) : filteredArtists.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No artists found</div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArtists.map((artist) => (
                  <Card key={artist.id} className="bg-slate-800/50 border-slate-700 hover:border-orange-500/30 transition-colors">
                    <CardContent className="p-4">
                      {/* Artist Image */}
                      <div className="relative mb-3">
                        {artist.profileImage ? (
                          <img 
                            src={artist.profileImage} 
                            alt={artist.artistName}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-full h-32 bg-slate-700/50 rounded-lg flex items-center justify-center">
                            <User className="h-12 w-12 text-slate-500" />
                          </div>
                        )}
                        <Badge className="absolute top-2 right-2 bg-orange-500/80">
                          ID: {artist.id}
                        </Badge>
                      </div>

                      {/* Artist Info */}
                      <h3 className="font-semibold text-white text-lg mb-1">{artist.artistName}</h3>
                      <p className="text-sm text-slate-400 mb-2">/{artist.slug}</p>
                      
                      {artist.genres && artist.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {artist.genres.slice(0, 3).map((genre, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-orange-500/30 text-orange-300">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {artist.biography && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3">{artist.biography}</p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(artist)}
                          className="flex-1 border-blue-500/50 text-blue-300 hover:bg-blue-500/10"
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/artist/${artist.slug}`, '_blank')}
                          className="border-green-500/50 text-green-300 hover:bg-green-500/10"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(artist.id, artist.artistName || '')}
                          className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                          disabled={deleteArtistMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-orange-500/30">
          <DialogHeader>
            <DialogTitle className="text-orange-300">
              Edit Artist: {editingArtist?.artistName}
            </DialogTitle>
          </DialogHeader>
          
          {editingArtist && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="artistName">Artist Name</Label>
                  <Input
                    id="artistName"
                    value={editingArtist.artistName || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, artistName: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={editingArtist.slug || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, slug: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              {/* Biography */}
              <div className="space-y-2">
                <Label htmlFor="biography">Biography</Label>
                <Textarea
                  id="biography"
                  value={editingArtist.biography || ''}
                  onChange={(e) => setEditingArtist({ ...editingArtist, biography: e.target.value })}
                  className="bg-slate-800 border-slate-700 min-h-[100px]"
                />
              </div>

              {/* Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profileImage">Profile Image URL</Label>
                  <Input
                    id="profileImage"
                    value={editingArtist.profileImage || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, profileImage: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                    placeholder="/artist-images/..."
                  />
                  {editingArtist.profileImage && (
                    <img src={editingArtist.profileImage} alt="Profile" className="h-20 w-20 object-cover rounded" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coverImage">Cover Image URL</Label>
                  <Input
                    id="coverImage"
                    value={editingArtist.coverImage || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, coverImage: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={editingArtist.country || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, country: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={editingArtist.location || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, location: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
              </div>

              {/* Genres */}
              <div className="space-y-2">
                <Label htmlFor="genres">Genres (comma separated)</Label>
                <Input
                  id="genres"
                  value={editingArtist.genres?.join(', ') || ''}
                  onChange={(e) => setEditingArtist({ 
                    ...editingArtist, 
                    genres: e.target.value.split(',').map(g => g.trim()).filter(g => g) 
                  })}
                  className="bg-slate-800 border-slate-700"
                  placeholder="Pop, Rock, Electronic..."
                />
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagramHandle" className="flex items-center gap-1">
                    <Instagram className="h-3 w-3" /> Instagram
                  </Label>
                  <Input
                    id="instagramHandle"
                    value={editingArtist.instagramHandle || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, instagramHandle: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                    placeholder="@username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitterHandle" className="flex items-center gap-1">
                    <Twitter className="h-3 w-3" /> Twitter
                  </Label>
                  <Input
                    id="twitterHandle"
                    value={editingArtist.twitterHandle || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, twitterHandle: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                    placeholder="@username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtubeHandle" className="flex items-center gap-1">
                    <Youtube className="h-3 w-3" /> YouTube
                  </Label>
                  <Input
                    id="youtubeHandle"
                    value={editingArtist.youtubeHandle || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, youtubeHandle: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                    placeholder="Channel URL or @handle"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spotifyUrl" className="flex items-center gap-1">
                    <Music className="h-3 w-3" /> Spotify
                  </Label>
                  <Input
                    id="spotifyUrl"
                    value={editingArtist.spotifyUrl || ''}
                    onChange={(e) => setEditingArtist({ ...editingArtist, spotifyUrl: e.target.value })}
                    className="bg-slate-800 border-slate-700"
                    placeholder="Spotify artist URL"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              className="border-slate-600"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateArtistMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateArtistMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
