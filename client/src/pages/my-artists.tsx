import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { Link, useLocation } from "wouter";
import {
  Plus,
  User,
  Music,
  MapPin,
  ExternalLink,
  Loader2,
  Sparkles,
  Bot,
  UserPlus,
  Wrench,
  RefreshCw,
  Trash2,
  Search,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown,
  Edit,
  Calendar,
  Disc,
  Zap,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  Star,
  Globe,
  Eye,
  EyeOff
} from "lucide-react";
import { fixGeneratedByForUserArtists } from "../lib/api/artist-profile-service";

// Static constants at module level — not recreated on every render
const MUSIC_GENRES = [
  'Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz',
  'Classical', 'Country', 'Folk', 'Reggae', 'Blues',
  'Metal', 'Punk', 'Alternative', 'Indie', 'Latin',
  'K-Pop', 'J-Pop', 'Trap', 'Techno', 'House', 'EDM',
  'Soul', 'Funk', 'Disco', 'Synthwave', 'Lo-Fi', 'Ambient'
];

const STYLE_OPTIONS = [
  'Minimalist', 'Elegant', 'Urban', 'Vintage', 'Futuristic',
  'Avant-garde', 'Retro', 'Classic', 'Alternative', 'Casual',
  'Cyberpunk', 'Bohemian', 'Grunge', 'Eclectic'
];

const MOOD_OPTIONS = [
  'Energetic', 'Melancholic', 'Dark', 'Bright', 'Ethereal',
  'Aggressive', 'Romantic', 'Rebellious', 'Chill', 'Mysterious',
  'Euphoric', 'Nostalgic', 'Empowering', 'Dreamy'
];

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
};
import { Head } from "../components/ui/head";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { AIGenerationModal } from "../components/artist/ai-generation-modal";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";
import { isAdminEmail } from "@shared/constants";

interface Artist {
  id: number;
  firestoreId: string;
  name: string;
  slug: string;
  biography?: string;
  profileImage?: string;
  coverImage?: string;
  genres?: string[];
  country?: string;
  isAIGenerated: boolean;
  isPublished: boolean;
  createdAt?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  spotify?: string;
}

export default function MyArtistsPage() {
  const { user, isLoading: authLoading, userSubscription } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Detectar si el usuario es admin
  const isAdmin = isAdminEmail(user?.email);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIGenerationModal, setShowAIGenerationModal] = useState(false);
  const [lastGeneratedMasterJson, setLastGeneratedMasterJson] = useState<Record<string, any> | null>(null);
  const [showDnaPanel, setShowDnaPanel] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingArtistId, setDeletingArtistId] = useState<number | null>(null);
  const [deleteConfirmArtist, setDeleteConfirmArtist] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [regeneratingArtistId, setRegeneratingArtistId] = useState<number | null>(null);
  const [togglingAASId, setTogglingAASId] = useState<number | null>(null);
  const [aasStatusMap, setAasStatusMap] = useState<Record<number, boolean>>({});
  const [togglingPublishId, setTogglingPublishId] = useState<number | null>(null);

  // Search, filter, sort, view state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "human" | "ai">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [zoom, setZoom] = useState(3); // 1=largest .. 5=smallest
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", biography: "", genre: "", location: "" });
  const [isEditing, setIsEditing] = useState(false);

  // AI Artist generation params
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [aiParams, setAiParams] = useState({
    genre: '',
    style: '',
    gender: '',
    mood: '',
    artistName: '',
  });

  // Form state for manual artist creation
  const [manualArtistForm, setManualArtistForm] = useState({
    name: "",
    biography: "",
    genre: "",
    location: "",
  });

  // Query para verificar si el usuario puede crear artistas
  const { data: permissionData } = useQuery<{
    canCreate: boolean;
    reason?: string;
    isAdmin: boolean;
    artistCount: number;
    maxAllowed: number;
    hasPremium: boolean;
  }>({
    queryKey: ["/api/artist-generator/can-create-artist"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,   // 5 min — avoid refetch on tab focus
    gcTime: 10 * 60 * 1000,
  });

  // Query para obtener los artistas del usuario
  const { data: artistsData, isLoading: artistsLoading, refetch } = useQuery<{
    success: boolean;
    count: number;
    artists: Artist[];
  }>({
    queryKey: ["/api/artist-generator/my-artists"],
    enabled: !!user,
    staleTime: 2 * 60 * 1000,   // 2 min — list stays fresh without constant refetch
    gcTime: 10 * 60 * 1000,
  });

  // Mutation para crear un nuevo artista
  const createArtistMutation = useMutation({
    mutationFn: async (params?: { genre?: string; style?: string; gender?: string; mood?: string; artistName?: string }) => {
      const body: Record<string, string> = {};
      if (params?.genre) body.genre = params.genre;
      if (params?.style) body.style = params.style;
      if (params?.gender) body.gender = params.gender;
      if (params?.mood) body.mood = params.mood;
      if (params?.artistName) body.artistName = params.artistName;

      const response = await apiRequest({
        url: "/api/artist-generator/generate-artist/secure",
        method: "POST",
        data: body
      });
      return response;
    },
    onSuccess: (data) => {
      // Modal closes automatically when it detects isGenerating = false
      toast({
        title: "Artist created!",
        description: `${data?.artist?.name || data?.name || 'Artist'} has been created successfully`,
      });
      // Invalidate both queries to update permissions and artist list
      queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/my-artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/can-create-artist"] });
      // Show DNA panel if masterJson is available
      const masterJson = data?.artist?.masterJson || data?.masterJson;
      if (masterJson) {
        setLastGeneratedMasterJson(masterJson);
        setShowDnaPanel(true);
      }
      setIsGenerating(false);
    },
    onError: (error: any) => {
      // Close modal immediately on error
      setShowAIGenerationModal(false);
      toast({
        title: "Error",
        description: error.message || "Could not create the artist",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  // Mutation para eliminar un artista
  const deleteArtistMutation = useMutation({
    mutationFn: async (artistId: number) => {
      setDeletingArtistId(artistId);
      const response = await apiRequest({
        url: `/api/artist-generator/delete-artist/${artistId}`,
        method: "DELETE"
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Artist deleted",
        description: "The artist has been deleted successfully",
      });
      // Invalidate both queries to update permissions and artist list
      queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/my-artists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/can-create-artist"] });
      setDeletingArtistId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not delete the artist",
        variant: "destructive",
      });
      setDeletingArtistId(null);
    },
  });

  // Mutation to regenerate artist images
  const regenerateImagesMutation = useMutation({
    mutationFn: async (artistId: number) => {
      setRegeneratingArtistId(artistId);
      const response = await apiRequest({
        url: `/api/artist-generator/regenerate-images/${artistId}`,
        method: "POST"
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Images regenerated!",
        description: "The artist images have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/my-artists"] });
      setRegeneratingArtistId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not regenerate images",
        variant: "destructive",
      });
      setRegeneratingArtistId(null);
    },
  });

  // AAS Toggle Mutation
  const aasToggleMutation = useMutation({
    mutationFn: async (artistId: number) => {
      setTogglingAASId(artistId);
      const response = await apiRequest({
        url: `/api/aas/toggle/${artistId}`,
        method: "POST",
      });
      return response;
    },
    onSuccess: (data: any) => {
      const enabled = data.enabled;
      setAasStatusMap((prev) => ({ ...prev, [togglingAASId!]: enabled }));
      toast({
        title: enabled ? "⚡ AAS Activated" : "AAS Deactivated",
        description: enabled
          ? "Autonomous Artist Survival System is now running"
          : "AAS has been turned off for this artist",
      });
      setTogglingAASId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not toggle AAS",
        variant: "destructive",
      });
      setTogglingAASId(null);
    },
  });

  // Publish/Unpublish Toggle Mutation
  const publishToggleMutation = useMutation({
    mutationFn: async (artistId: number) => {
      setTogglingPublishId(artistId);
      const response = await apiRequest({
        url: `/api/artist-generator/toggle-published/${artistId}`,
        method: "POST",
      });
      return { ...response, artistId };
    },
    onSuccess: (data: any) => {
      const published = data.isPublished;
      toast({
        title: published ? "✅ Artista publicado" : "🔒 Artista ocultado",
        description: published
          ? "El artista ahora es visible públicamente"
          : "El artista está oculto y no aparece en páginas públicas",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/artist-generator/my-artists"] });
      setTogglingPublishId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la visibilidad",
        variant: "destructive",
      });
      setTogglingPublishId(null);
    },
  });

  // Mutation to update existing AI artists
  const fixArtistsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !user?.email) {
        throw new Error('Invalid user');
      }
      return await fixGeneratedByForUserArtists(user.id, user.email);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "✅ Artists Updated",
          description: data.message || `${data.updated} profiles updated successfully`,
        });
        refetch();
      } else {
        toast({
          title: "Information",
          description: data.message || "No artists found to update",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not update the artists",
        variant: "destructive",
      });
    },
  });

  const handleCreateArtist = async () => {
    // Close params dialog, show generation modal, fire mutation with params
    const params = { ...aiParams };
    setShowParamsDialog(false);
    setIsGenerating(true);
    setShowAIGenerationModal(true);

    // Build clean params (only non-empty)
    const cleanParams: Record<string, string> = {};
    if (params.genre) cleanParams.genre = params.genre;
    if (params.style) cleanParams.style = params.style;
    if (params.gender) cleanParams.gender = params.gender;
    if (params.mood) cleanParams.mood = params.mood;
    if (params.artistName) cleanParams.artistName = params.artistName;

    createArtistMutation.mutate(Object.keys(cleanParams).length > 0 ? cleanParams : undefined);

    // Reset params for next generation
    setAiParams({ genre: '', style: '', gender: '', mood: '', artistName: '' });
  };

  const handleCreateManualArtist = async () => {
    if (!manualArtistForm.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the artist",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create slug from name
      const slug = manualArtistForm.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const response = await apiRequest({
        url: "/api/artist-generator/create-manual",
        method: "POST",
        data: {
          name: manualArtistForm.name,
          biography: manualArtistForm.biography,
          genre: manualArtistForm.genre,
          location: manualArtistForm.location,
          slug
        }
      });

      toast({
        title: "Artist created!",
        description: `${manualArtistForm.name} has been created successfully`,
      });

      // Reset form
      setManualArtistForm({
        name: "",
        biography: "",
        genre: "",
        location: "",
      });
      
      setIsDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not create the artist",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteArtist = (artistId: number, artistName: string) => {
    setDeleteConfirmInput("");
    setDeleteConfirmArtist({ id: artistId, name: artistName });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmArtist) return;
    deleteArtistMutation.mutate(deleteConfirmArtist.id);
    setDeleteConfirmArtist(null);
    setDeleteConfirmInput("");
  };

  const artists = artistsData?.artists || [];

  // Filtered & sorted artists
  const filteredArtists = useMemo(() => {
    let result = [...artists];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        (a.name?.toLowerCase().includes(q)) ||
        (a.biography?.toLowerCase().includes(q)) ||
        (a.genres?.some(g => g?.toLowerCase().includes(q))) ||
        (a.country?.toLowerCase().includes(q))
      );
    }
    
    // Type filter
    if (filterType === "ai") result = result.filter(a => a.isAIGenerated);
    if (filterType === "human") result = result.filter(a => !a.isAIGenerated);
    
    // Sort
    switch (sortBy) {
      case "newest":
        result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    
    return result;
  }, [artists, searchQuery, filterType, sortBy]);

  // ─── Windowed rendering ───────────────────────────────────────────────────
  // Rendering every artist at once (each card is an animated motion.div with an
  // image) overloads the page and can blank it out for users with many artists.
  // We render a growing window and load the next page as the sentinel scrolls in.
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, filterType, sortBy, viewMode]);
  const visibleArtists = useMemo(() => filteredArtists.slice(0, visibleCount), [filteredArtists, visibleCount]);
  const hasMore = visibleCount < filteredArtists.length;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMore = useCallback(
    () => setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredArtists.length)),
    [filteredArtists.length],
  );
  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, visibleCount]);

  const handleEditArtist = (artist: Artist) => {
    setEditingArtist(artist);
    setEditForm({
      name: artist.name,
      biography: artist.biography || "",
      genre: artist.genres?.join(", ") || "",
      location: artist.country || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingArtist || !editForm.name.trim()) return;
    setIsEditing(true);
    try {
      await apiRequest({
        url: `/api/artist-generator/update-artist/${editingArtist.id}`,
        method: "PATCH",
        data: {
          name: editForm.name,
          biography: editForm.biography,
          genre: editForm.genre,
          location: editForm.location,
        },
      });
      toast({ title: "Artist updated!", description: `${editForm.name} saved successfully` });
      setIsEditDialogOpen(false);
      setEditingArtist(null);
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not update artist", variant: "destructive" });
    } finally {
      setIsEditing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Show premium landing page for non-logged users with lead capture
    return <ArtistLandingPage />;
  }

  return (
    <PlanTierGuard 
      requiredPlan="premium" 
      userSubscription={userSubscription} 
      featureName="Artist Generation"
      isAdmin={isAdmin}
    >
      <>
        <Head
          title="My Artists | Boostify Music"
          description="Administra todos tus artistas generados con IA en Boostify Music"
          url={window.location.href}
        />
        <div className="min-h-screen bg-[#080810] text-white">
          {/* ── HERO HEADER ── */}
          <div className="relative overflow-hidden border-b border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-900/30 via-[#080810] to-purple-900/20 pointer-events-none" />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(249,115,22,0.18), transparent)' }} />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                      <Music className="h-5 w-5 text-orange-400" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-orange-400 via-orange-300 to-amber-300 bg-clip-text text-transparent">
                      My Artists
                    </h1>
                  </div>
                  <p className="text-white/40 text-sm ml-[52px]">
                    {artists.length > 0 ? `${artists.length} artist${artists.length !== 1 ? 's' : ''} in your roster` : 'Manage your artist roster'}
                  </p>
                </div>
            <div className="flex gap-3 flex-wrap">
              {/* Button to fix existing AI artists */}
              
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                // Only allow opening if user has permission
                if (open && !permissionData?.canCreate && !isAdmin) {
                  toast({
                    title: "Cannot create artist",
                    description: permissionData?.reason || "You don't have permission to create more artists",
                    variant: "destructive"
                  });
                  return;
                }
                setIsDialogOpen(open);
              }}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white disabled:opacity-50"
                    data-testid="button-create-manual-artist"
                    disabled={!permissionData?.canCreate && !isAdmin}
                    title={!permissionData?.canCreate && !isAdmin ? permissionData?.reason : undefined}
                  >
                    <User className="h-4 w-4 mr-2" />
                    Human Artist
                    {!permissionData?.hasPremium && !isAdmin && " 🔒"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Create New Artist</DialogTitle>
                    <DialogDescription className="text-gray-400">
                      Enter the basic artist information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Artist Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g. John Doe"
                        value={manualArtistForm.name}
                        onChange={(e) => setManualArtistForm({ ...manualArtistForm, name: e.target.value })}
                        className="bg-gray-800 border-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="genre">Music Genre</Label>
                      <Input
                        id="genre"
                        placeholder="e.g. Pop, Rock, Hip-Hop"
                        value={manualArtistForm.genre}
                        onChange={(e) => setManualArtistForm({ ...manualArtistForm, genre: e.target.value })}
                        className="bg-gray-800 border-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="e.g. Miami, FL"
                        value={manualArtistForm.location}
                        onChange={(e) => setManualArtistForm({ ...manualArtistForm, location: e.target.value })}
                        className="bg-gray-800 border-gray-700"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="biography">Biography</Label>
                      <Textarea
                        id="biography"
                        placeholder="Tell us about the artist..."
                        rows={4}
                        value={manualArtistForm.biography}
                        onChange={(e) => setManualArtistForm({ ...manualArtistForm, biography: e.target.value })}
                        className="bg-gray-800 border-gray-700"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateManualArtist}
                      disabled={isCreating}
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Artist"
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                onClick={() => setShowParamsDialog(true)}
                disabled={isGenerating || (!permissionData?.canCreate && !isAdmin)}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:opacity-50"
                data-testid="button-create-ai-artist"
                title={!permissionData?.canCreate && !isAdmin ? permissionData?.reason : undefined}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    AI Artist
                    {!permissionData?.hasPremium && !isAdmin && " 🔒"}
                    {permissionData?.hasPremium && !permissionData?.canCreate && !isAdmin && ` (${permissionData?.artistCount}/${permissionData?.maxAllowed})`}
                  </>
                )}
              </Button>

              {/* AI Artist Parameters Dialog */}
              <Dialog open={showParamsDialog} onOpenChange={setShowParamsDialog}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                      <Sparkles className="h-5 w-5 text-orange-500" />
                      Generate AI Artist
                    </DialogTitle>
                    <DialogDescription>
                      Configure parameters to customize your artist. All fields are optional — leave empty for random values.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="ai-artist-name">Artist Name</Label>
                      <Input
                        id="ai-artist-name"
                        placeholder="Leave empty for random name"
                        value={aiParams.artistName}
                        onChange={(e) => setAiParams(p => ({ ...p, artistName: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Music Genre</Label>
                      <Select value={aiParams.genre} onValueChange={(v) => setAiParams(p => ({ ...p, genre: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Random" />
                        </SelectTrigger>
                        <SelectContent>
                          {MUSIC_GENRES.map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Gender</Label>
                      <Select value={aiParams.gender} onValueChange={(v) => setAiParams(p => ({ ...p, gender: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Random" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Visual Style</Label>
                      <Select value={aiParams.style} onValueChange={(v) => setAiParams(p => ({ ...p, style: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Random" />
                        </SelectTrigger>
                        <SelectContent>
                          {STYLE_OPTIONS.map(s => (
                            <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Mood / Vibe</Label>
                      <Select value={aiParams.mood} onValueChange={(v) => setAiParams(p => ({ ...p, mood: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Random" />
                        </SelectTrigger>
                        <SelectContent>
                          {MOOD_OPTIONS.map(m => (
                            <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAiParams({ genre: '', style: '', gender: '', mood: '', artistName: '' })}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                    <Button
                      onClick={handleCreateArtist}
                      className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Generate Artist
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>{/* end action buttons */}
            </div>{/* end hero inner flex */}
          </div>{/* end hero relative */}
        </div>{/* end hero outer */}

          {/* ── MAIN CONTENT ── */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-6">

          {/* Permission Warning Banner */}
          {!permissionData?.canCreate && !isAdmin && (
            <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-3">
              <span className="text-amber-400 text-lg shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-amber-400 font-medium text-sm">
                  {!permissionData?.hasPremium ? "Premium required to create artists" : `Limit reached (${permissionData?.artistCount}/${permissionData?.maxAllowed})`}
                </p>
                <p className="text-amber-400/60 text-xs mt-0.5">
                  {!permissionData?.hasPremium ? "Upgrade to Premium to unlock artist generation" : "Contact support for more slots."}
                </p>
              </div>
              {!permissionData?.hasPremium && (
                <Link href="/music-video-pricing" className="shrink-0">
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-8">Upgrade</Button>
                </Link>
              )}
            </div>
          )}

          {/* Admin Badge */}
          {isAdmin && (
            <div className="mb-5 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2.5">
              <span className="text-purple-400 text-base">👑</span>
              <p className="text-purple-400 font-medium text-sm">Admin Mode — Unlimited Artist Creation</p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-5">
            {[
              { label: 'Total', value: artists.length, color: 'text-orange-400', bg: 'bg-orange-500/10', icon: User },
              { label: 'Human', value: artists.filter(a => !a.isAIGenerated).length, color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: User },
              { label: 'AI', value: artists.filter(a => a.isAIGenerated).length, color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Bot },
              { label: 'Genres', value: new Set(artists.flatMap(a => a.genres || [])).size, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Music },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} className={`rounded-xl p-3 sm:p-4 border border-white/5 ${bg} flex items-center gap-2 sm:gap-3`}>
                <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                <div>
                  <p className="text-white/40 text-[10px] sm:text-xs">{label}</p>
                  <p className={`text-base sm:text-xl font-black ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Plan usage bar */}
          {permissionData && !isAdmin && (
            <div className="mb-5 p-3 bg-white/3 border border-white/8 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/40">{permissionData.hasPremium ? "Artist Slots" : "Plan Limit"}</span>
                <span className="text-xs font-semibold text-white/70">{permissionData.artistCount} / {permissionData.maxAllowed === 9999 ? "∞" : permissionData.maxAllowed}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    permissionData.artistCount >= permissionData.maxAllowed ? "bg-red-500"
                    : permissionData.artistCount / permissionData.maxAllowed >= 0.75 ? "bg-amber-500"
                    : "bg-orange-500"
                  }`}
                  style={{ width: `${permissionData.maxAllowed > 0 ? Math.min(100, (permissionData.artistCount / permissionData.maxAllowed) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ── STICKY TOOLBAR ── */}
          {artists.length > 0 && (
            <div className="sticky top-0 z-20 bg-[#080810]/90 backdrop-blur-md pt-2 pb-3 mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-white/5">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search artists…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-orange-500/60 transition-colors"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                  {/* Filter tabs */}
                  <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden shrink-0">
                    {(["all", "human", "ai"] as const).map((type) => (
                      <button key={type} onClick={() => setFilterType(type)}
                        className={`px-3 py-1.5 text-xs font-medium transition-all ${filterType === type ? "bg-orange-500 text-white" : "text-white/40 hover:text-white"}`}>
                        {type === "all" ? "All" : type === "human" ? "👤 Human" : "🤖 AI"}
                      </button>
                    ))}
                  </div>

                  {/* Sort */}
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/60 focus:outline-none focus:border-orange-500/60 cursor-pointer shrink-0">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="name">A → Z</option>
                  </select>

                  {/* View toggle */}
                  <div className="flex bg-white/5 border border-white/10 rounded-lg overflow-hidden shrink-0">
                    <button onClick={() => setViewMode("grid")}
                      className={`p-2 transition-all ${viewMode === "grid" ? "bg-orange-500 text-white" : "text-white/40 hover:text-white"}`}>
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setViewMode("list")}
                      className={`p-2 transition-all ${viewMode === "list" ? "bg-orange-500 text-white" : "text-white/40 hover:text-white"}`}>
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Zoom controls — only for grid view */}
                  {viewMode === "grid" && (
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden shrink-0">
                      <button onClick={() => setZoom(z => Math.max(1, z - 1))} disabled={zoom === 1}
                        className="p-2 text-white/40 hover:text-white disabled:opacity-25 transition-all" title="Zoom in (fewer, larger cards)">
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-white/30 px-1 tabular-nums w-4 text-center">{zoom}</span>
                      <button onClick={() => setZoom(z => Math.min(5, z + 1))} disabled={zoom === 5}
                        className="p-2 text-white/40 hover:text-white disabled:opacity-25 transition-all" title="Zoom out (more, smaller cards)">
                        <ZoomOut className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Result count */}
                  <div className="flex items-center px-2.5 bg-white/5 border border-white/10 rounded-lg shrink-0">
                    <span className="text-xs text-white/30 tabular-nums">{filteredArtists.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Artists Grid / List */}
          {artistsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
            </div>
          ) : artists.length === 0 ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-white/3 p-12 text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-purple-500/5 pointer-events-none" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/20 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-white">Your Roster is Empty</h3>
                <p className="text-white/40 mb-8 max-w-sm mx-auto text-sm">Build your music empire — create your first artist now.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <div className="flex-1 max-w-[200px] mx-auto sm:mx-0 space-y-2">
                    <div className="p-4 rounded-xl bg-cyan-500/8 border border-cyan-500/20 text-center">
                      <User className="h-7 w-7 text-cyan-400 mx-auto mb-1.5" />
                      <p className="text-sm font-semibold text-cyan-300">Human Artist</p>
                      <p className="text-xs text-white/30 mt-0.5">Your own profile</p>
                    </div>
                    <Button onClick={() => { if (permissionData?.canCreate || isAdmin) setIsDialogOpen(true); }}
                      variant="outline" className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-white hover:border-cyan-500 text-sm">
                      <User className="h-4 w-4 mr-2" /> Create Human
                    </Button>
                  </div>
                  <div className="flex-1 max-w-[200px] mx-auto sm:mx-0 space-y-2">
                    <div className="p-4 rounded-xl bg-orange-500/8 border border-orange-500/20 text-center">
                      <Bot className="h-7 w-7 text-orange-400 mx-auto mb-1.5" />
                      <p className="text-sm font-semibold text-orange-300">AI Artist</p>
                      <p className="text-xs text-white/30 mt-0.5">AI-generated identity</p>
                    </div>
                    <Button onClick={() => setShowParamsDialog(true)} disabled={isGenerating}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-sm">
                      {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bot className="h-4 w-4 mr-2" />}
                      {isGenerating ? "Generating…" : "Create AI"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="rounded-2xl bg-white/3 border border-white/8 p-10 text-center">
              <Search className="h-9 w-9 text-white/20 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white/60 mb-1">No artists found</h3>
              <p className="text-white/30 text-sm">Try a different search or filter</p>
              <button className="mt-4 text-orange-400 text-sm hover:text-orange-300 transition-colors"
                onClick={() => { setSearchQuery(""); setFilterType("all"); }}>Clear filters</button>
            </div>
          ) : viewMode === "grid" ? (() => {
            const GRID_COLS: Record<number, string> = {
              1: 'grid-cols-1',
              2: 'grid-cols-1 sm:grid-cols-2',
              3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
              4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
              5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
            };
            const colClass = GRID_COLS[zoom] || GRID_COLS[3];
            const compact = zoom >= 4;
            return (
            <div className={`grid ${colClass} gap-4`}>
              {visibleArtists.map((artist, index) => (
                <motion.div key={artist.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
                  className="group relative"
                >
                  {/* Card */}
                  <div className="rounded-2xl overflow-hidden border border-white/8 bg-[#0f0f1a] hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 h-full flex flex-col"
                    data-testid={`card-artist-${artist.id}`}>
                    {/* Cover image */}
                    <div className={`relative overflow-hidden bg-gradient-to-br from-white/5 to-black/30 ${compact ? 'aspect-[3/2]' : 'aspect-[4/3]'}`}
                      style={{ contain: 'layout paint', willChange: 'transform' }}>
                      {artist.coverImage || artist.profileImage ? (
                        <img src={artist.coverImage || artist.profileImage} alt={artist.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className={`text-white/10 ${compact ? 'h-10 w-10' : 'h-16 w-16'}`} />
                        </div>
                      )}

                      {/* Gradient overlay at bottom */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-transparent to-transparent opacity-60" />

                      {/* Type badge */}
                      <div className="absolute top-2.5 right-2.5">
                        {artist.isAIGenerated ? (
                          <span className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <Bot className="h-2.5 w-2.5" /> AI
                          </span>
                        ) : (
                          <span className="bg-gradient-to-r from-cyan-500/90 to-blue-500/90 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <User className="h-2.5 w-2.5" /> Human
                          </span>
                        )}
                      </div>

                      {/* AAS active indicator */}
                      {aasStatusMap[artist.id] && (
                        <div className="absolute top-2.5 left-2.5">
                          <span className="bg-yellow-400/90 backdrop-blur-sm text-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                            <Zap className="h-2.5 w-2.5" /> AAS
                          </span>
                        </div>
                      )}

                      {/* Published indicator */}
                      {!artist.isPublished && (
                        <div className="absolute bottom-2.5 left-2.5">
                          <span className="bg-black/80 border border-red-500/60 backdrop-blur-sm text-red-400 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                            <EyeOff className="h-2.5 w-2.5" /> Hidden
                          </span>
                        </div>
                      )}

                      {/* Quick-action overlay on hover */}
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
                        <Link href={`/artist/${artist.slug}`}>
                          <button className="w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-400 flex items-center justify-center transition-colors" title="View profile">
                            <ExternalLink className="h-4 w-4 text-white" />
                          </button>
                        </Link>
                        <button className="w-9 h-9 rounded-full bg-white/20 hover:bg-green-500 flex items-center justify-center transition-colors" title="Edit" onClick={() => handleEditArtist(artist)}>
                          <Edit className="h-4 w-4 text-white" />
                        </button>
                        <button className="w-9 h-9 rounded-full bg-white/20 hover:bg-blue-500 flex items-center justify-center transition-colors"
                          title="Regenerate images" onClick={() => regenerateImagesMutation.mutate(artist.id)} disabled={regeneratingArtistId === artist.id}>
                          {regeneratingArtistId === artist.id ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <RefreshCw className="h-4 w-4 text-white" />}
                        </button>
                        <button className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${aasStatusMap[artist.id] ? 'bg-yellow-400 hover:bg-yellow-300' : 'bg-white/20 hover:bg-yellow-400'}`}
                          title={aasStatusMap[artist.id] ? "Deactivate AAS" : "Activate AAS"} onClick={() => aasToggleMutation.mutate(artist.id)} disabled={togglingAASId === artist.id}>
                          {togglingAASId === artist.id ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Zap className={`h-4 w-4 ${aasStatusMap[artist.id] ? 'text-black' : 'text-white'}`} />}
                        </button>
                        <button className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${artist.isPublished ? 'bg-green-500/90 hover:bg-red-500' : 'bg-red-500/80 hover:bg-green-500'}`}
                          title={artist.isPublished ? "Ocultar artista (despublicar)" : "Publicar artista"} onClick={() => publishToggleMutation.mutate(artist.id)} disabled={togglingPublishId === artist.id}>
                          {togglingPublishId === artist.id ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : artist.isPublished ? <Eye className="h-4 w-4 text-white" /> : <EyeOff className="h-4 w-4 text-white" />}
                        </button>
                        <button className="w-9 h-9 rounded-full bg-white/20 hover:bg-red-500 flex items-center justify-center transition-colors"
                          title="Delete" onClick={() => handleDeleteArtist(artist.id, artist.name)} disabled={deletingArtistId === artist.id}>
                          {deletingArtistId === artist.id ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Trash2 className="h-4 w-4 text-white" />}
                        </button>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className={`flex-1 flex flex-col ${compact ? 'p-3' : 'p-4'}`}>
                      <h3 className={`font-bold text-white truncate ${compact ? 'text-sm mb-1' : 'text-base mb-2'}`}>{artist.name}</h3>

                      {artist.genres && artist.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {artist.genres.slice(0, compact ? 1 : 2).map((genre, idx) => (
                            <span key={idx} className="text-[10px] px-1.5 py-0.5 bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/20">{genre}</span>
                          ))}
                          {artist.genres.length > (compact ? 1 : 2) && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-white/8 text-white/30 rounded-full">+{artist.genres.length - (compact ? 1 : 2)}</span>
                          )}
                        </div>
                      )}

                      {!compact && (
                        <>
                          {artist.country && (
                            <div className="flex items-center gap-1.5 text-xs text-white/35 mb-1">
                              <MapPin className="h-3 w-3 shrink-0" /> {artist.country}
                            </div>
                          )}
                          {artist.biography && (
                            <p className="text-xs text-white/35 line-clamp-2 mb-3 leading-relaxed">{artist.biography}</p>
                          )}
                        </>
                      )}

                      {/* Bottom action bar */}
                      <div className="mt-auto pt-2 flex gap-1.5">
                        <Link href={`/artist/${artist.slug}`} className="flex-1">
                          <button className="w-full py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500 text-orange-400 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-1.5 border border-orange-500/20 hover:border-orange-500">
                            <ExternalLink className="h-3 w-3" /> View
                          </button>
                        </Link>
                        <button className="h-7 w-7 rounded-lg bg-white/5 hover:bg-green-500 text-white/30 hover:text-white flex items-center justify-center transition-all border border-white/8"
                          onClick={() => handleEditArtist(artist)} title="Edit">
                          <Edit className="h-3 w-3" />
                        </button>
                        <button className="h-7 w-7 rounded-lg bg-white/5 hover:bg-blue-500 text-white/30 hover:text-white flex items-center justify-center transition-all border border-white/8"
                          onClick={() => regenerateImagesMutation.mutate(artist.id)} disabled={regeneratingArtistId === artist.id} title="Regenerate images">
                          {regeneratingArtistId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </button>
                        <button className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all border ${aasStatusMap[artist.id] ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400 hover:text-black' : 'bg-white/5 border-white/8 text-white/30 hover:bg-yellow-400 hover:text-black hover:border-yellow-400'}`}
                          onClick={() => aasToggleMutation.mutate(artist.id)} disabled={togglingAASId === artist.id} title="Toggle AAS">
                          {togglingAASId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        </button>
                        <button className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all border ${artist.isPublished ? 'bg-green-500/20 border-green-500/40 text-green-400 hover:bg-red-500 hover:text-white hover:border-red-500' : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-green-500 hover:text-white hover:border-green-500'}`}
                          onClick={() => publishToggleMutation.mutate(artist.id)} disabled={togglingPublishId === artist.id} title={artist.isPublished ? "Ocultar (despublicar)" : "Publicar artista"}>
                          {togglingPublishId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : artist.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                        <button className="h-7 w-7 rounded-lg bg-white/5 hover:bg-red-500 text-white/30 hover:text-white flex items-center justify-center transition-all border border-white/8"
                          onClick={() => handleDeleteArtist(artist.id, artist.name)} disabled={deletingArtistId === artist.id} title="Delete">
                          {deletingArtistId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          );})() : (
            /* LIST VIEW */
            <div className="space-y-2">
              {visibleArtists.map((artist, index) => (
                <div
                  key={artist.id}
                  style={{ animation: `fadeSlideIn 0.18s ease both`, animationDelay: `${Math.min(index * 20, 150)}ms` }}
                >
                  <Card
                    className="bg-gray-900 border-gray-800 hover:border-orange-500/50 transition-all duration-200"
                    data-testid={`card-artist-${artist.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3">
                      {/* Avatar + Info row */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Thumbnail */}
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex-shrink-0">
                          {artist.coverImage || artist.profileImage ? (
                            <img src={artist.coverImage || artist.profileImage} alt={artist.name}
                            loading="lazy" decoding="async"
                            className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Music className="h-6 w-6 text-gray-700" /></div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{artist.name}</h3>
                            {artist.isAIGenerated ? (
                              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-0.5">
                                <Bot className="h-2.5 w-2.5" /> AI
                              </span>
                            ) : (
                              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center gap-0.5">
                                <User className="h-2.5 w-2.5" /> Human
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {artist.genres && artist.genres.length > 0 && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Disc className="h-3 w-3" />
                                {artist.genres.slice(0, 2).join(", ")}
                              </span>
                            )}
                            {artist.country && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {artist.country}
                              </span>
                            )}
                            {artist.createdAt && (
                              <span className="text-xs text-gray-600 hidden sm:flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(artist.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 justify-end sm:justify-start">
                        <Link href={`/artist/${artist.slug}`}>
                          <Button variant="outline" size="icon" className="h-8 w-8 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white" title="View artist profile">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                        <Button variant="outline" size="icon" className="h-8 w-8 border-green-500 text-green-500 hover:bg-green-500 hover:text-white" onClick={() => handleEditArtist(artist)} title="Edit">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white" onClick={() => regenerateImagesMutation.mutate(artist.id)} disabled={regeneratingArtistId === artist.id} title="Regenerate images">
                          {regeneratingArtistId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 border-red-500 text-red-500 hover:bg-red-500 hover:text-white" onClick={() => handleDeleteArtist(artist.id, artist.name)} disabled={deletingArtistId === artist.id}>
                          {deletingArtistId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 ${aasStatusMap[artist.id] ? "border-yellow-400 bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400 hover:text-black" : "border-gray-600 text-gray-500 hover:border-yellow-400 hover:text-yellow-400"}`}
                          onClick={() => aasToggleMutation.mutate(artist.id)}
                          disabled={togglingAASId === artist.id}
                          title={aasStatusMap[artist.id] ? "AAS Active — Click to deactivate" : "Activate AAS Engine"}
                        >
                          {togglingAASId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-8 w-8 ${artist.isPublished ? "border-green-500 bg-green-500/10 text-green-400 hover:bg-red-500 hover:text-white hover:border-red-500" : "border-red-500 bg-red-500/10 text-red-400 hover:bg-green-500 hover:text-white hover:border-green-500"}`}
                          onClick={() => publishToggleMutation.mutate(artist.id)}
                          disabled={togglingPublishId === artist.id}
                          title={artist.isPublished ? "Ocultar artista (despublicar)" : "Publicar artista"}
                        >
                          {togglingPublishId === artist.id ? <Loader2 className="h-3 w-3 animate-spin" /> : artist.isPublished ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-8">
              <Button
                variant="outline"
                onClick={loadMore}
                className="border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Cargar más ({filteredArtists.length - visibleCount} restantes)
              </Button>
            </div>
          )}
          </div>
        </div>

        {/* Edit Artist Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Edit Artist</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update {editingArtist?.name}'s information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Artist Name *</Label>
                <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-gray-800 border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-genre">Music Genre</Label>
                <Input id="edit-genre" placeholder="e.g. Pop, Rock" value={editForm.genre} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })} className="bg-gray-800 border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input id="edit-location" placeholder="e.g. Miami, FL" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="bg-gray-800 border-gray-700" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bio">Biography</Label>
                <Textarea id="edit-bio" rows={4} value={editForm.biography} onChange={(e) => setEditForm({ ...editForm, biography: e.target.value })} className="bg-gray-800 border-gray-700" />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isEditing}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isEditing} className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                {isEditing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Generation Modal */}
        <AIGenerationModal 
          isOpen={showAIGenerationModal}
          isGenerating={createArtistMutation.isPending}
          onClose={() => setShowAIGenerationModal(false)}
        />

        {/* Artist DNA Panel — shows after successful AI generation */}
        <Dialog open={showDnaPanel} onOpenChange={setShowDnaPanel}>
          <DialogContent className="bg-gray-950 border-gray-800 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-400">
                <Sparkles className="h-5 w-5" />
                Artist DNA — {lastGeneratedMasterJson?.canonical?.artist_name}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                The AI generated this canonical identity. All modules (songs, merch, news, EPK) use this as their source of truth.
              </DialogDescription>
            </DialogHeader>

            {lastGeneratedMasterJson && (
              <div className="space-y-4 mt-2">
                {/* Identity */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-semibold text-orange-400 mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" /> Identity
                  </h3>
                  <p className="text-xs text-gray-300 mb-1">
                    <span className="text-gray-500">Tagline:</span> {lastGeneratedMasterJson?.canonical?.tagline}
                  </p>
                  <p className="text-xs text-gray-300 mb-1">
                    <span className="text-gray-500">Archetype:</span> {lastGeneratedMasterJson?.persona?.archetype_name}
                  </p>
                  <p className="text-xs text-gray-300">
                    <span className="text-gray-500">Origin:</span> {lastGeneratedMasterJson?.canonical?.city_of_origin}
                  </p>
                </div>

                {/* Visual DNA */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-semibold text-purple-400 mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Visual DNA
                  </h3>
                  <div className="flex gap-2 mb-2">
                    {lastGeneratedMasterJson?.visual_dna?.color_palette?.map((color: string, i: number) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full border border-gray-700"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <span className="text-xs text-gray-400 self-center ml-1">
                      {lastGeneratedMasterJson?.visual_dna?.palette_name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mb-1">
                    <span className="text-gray-500">Aesthetic:</span> {lastGeneratedMasterJson?.visual_dna?.aesthetic}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lastGeneratedMasterJson?.visual_dna?.fashion_keywords?.map((k: string, i: number) => (
                      <span key={i} className="bg-purple-900/40 text-purple-300 text-xs px-2 py-0.5 rounded">{k}</span>
                    ))}
                  </div>
                </div>

                {/* Musical DNA */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-2">
                    <Music className="h-4 w-4" /> Musical DNA
                  </h3>
                  <p className="text-xs text-gray-300 mb-1">
                    <span className="text-gray-500">Genre:</span> {lastGeneratedMasterJson?.musical_dna?.primary_genre}
                    {lastGeneratedMasterJson?.musical_dna?.secondary_genres?.length > 0 && 
                      ` / ${lastGeneratedMasterJson.musical_dna.secondary_genres.join(', ')}`}
                  </p>
                  <p className="text-xs text-gray-300 mb-1">
                    <span className="text-gray-500">BPM:</span> {lastGeneratedMasterJson?.musical_dna?.bpm_range?.min}–{lastGeneratedMasterJson?.musical_dna?.bpm_range?.max}
                  </p>
                  <p className="text-xs text-gray-300 mb-2">
                    <span className="text-gray-500">Influences:</span> {lastGeneratedMasterJson?.musical_dna?.influences?.join(', ')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {lastGeneratedMasterJson?.musical_dna?.mood_keywords?.map((k: string, i: number) => (
                      <span key={i} className="bg-green-900/40 text-green-300 text-xs px-2 py-0.5 rounded">{k}</span>
                    ))}
                  </div>
                </div>

                {/* Audience & Business */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <Disc className="h-4 w-4" /> Audience & Business
                  </h3>
                  <p className="text-xs text-gray-300 mb-1">
                    <span className="text-gray-500">Primary:</span> {lastGeneratedMasterJson?.audience?.primary_demographic}
                  </p>
                  <p className="text-xs text-gray-300 mb-2">
                    <span className="text-gray-500">Revenue:</span> {lastGeneratedMasterJson?.business_model?.revenue_pillars?.join(' · ')}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => setShowDnaPanel(false)}>
                Close
              </Button>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowDnaPanel(false)}>
                Go to Artist
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Safe Delete Confirmation Modal ──────────────────────────────── */}
        <Dialog open={!!deleteConfirmArtist} onOpenChange={(open) => { if (!open) { setDeleteConfirmArtist(null); setDeleteConfirmInput(""); } }}>
          <DialogContent className="bg-[#0e0e18] border border-red-900/40 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <span>⚠️</span> Eliminar artista permanentemente
              </DialogTitle>
              <DialogDescription className="text-gray-400 pt-1">
                Esta acción es <span className="text-red-400 font-semibold">irreversible</span>. Se borrarán todas las canciones, datos y configuración del artista.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <p className="text-sm text-gray-300">
                Escribe <span className="font-bold text-white bg-zinc-800 px-1.5 py-0.5 rounded">{deleteConfirmArtist?.name}</span> para confirmar:
              </p>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={deleteConfirmArtist?.name ?? ""}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500 outline-none rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmInput === deleteConfirmArtist?.name) handleConfirmDelete(); }}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-zinc-700 text-gray-300 hover:bg-zinc-800" onClick={() => { setDeleteConfirmArtist(null); setDeleteConfirmInput(""); }}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmInput !== deleteConfirmArtist?.name || deleteArtistMutation.isPending}
                onClick={handleConfirmDelete}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-40"
              >
                {deleteArtistMutation.isPending ? "Eliminando..." : "Eliminar definitivamente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </PlanTierGuard>
  );
}
